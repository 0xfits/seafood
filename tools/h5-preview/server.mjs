#!/usr/bin/env node
/**
 * 海鲜市场 (seafood) · H5 预览服务
 * ---------------------------------------------------------------------------
 * 作用：一个**零依赖**的 Node 服务（Node 18 可跑，纯 ESM），把 vite dev 上的
 *      全站页面在 0.0.0.0:5800 上「原样」暴露出来，并提供 /_preview 的 H5 预览外壳：
 *        · 设备宽度预设 + 手机框 iframe（宽度 = 真实断点，直接命中 H5 骨架）
 *        · 路由快捷项 / 地址栏与 iframe 双向同步
 *        · 上游（vite dev）健康指示，未运行时给明确指引
 *        · 局域网真机地址（os.networkInterfaces()）
 *
 * 为什么不直接开 vite：vite dev 默认只绑 IPv6 [::1]:5787（本机实测），
 * 手机 / 其他设备在局域网根本连不上；本服务绑 0.0.0.0，做透明反代。
 *
 * 上游：默认 http://[::1]:5787（vite dev 只绑 IPv6）。可用 H5_UPSTREAM 覆盖。
 *       启动时探测（::1 优先，失败退 127.0.0.1），运行中 ECONNREFUSED 会重探。
 *
 * 反代要点：把 Host 改写成上游 authority（localhost:5787）—— 否则 vite 的
 *       server.allowedHosts 检查会对局域网 IP 请求返 403；同时带
 *       x-forwarded-host / x-forwarded-proto，剥除 hop-by-hop 头，并转发
 *       WebSocket upgrade（HMR）。
 *
 * 约束：零 npm 依赖；Node v18 可用；不改前端产品代码。
 */

import http from 'node:http';
import os from 'node:os';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
const PORT = Number(process.env.H5_PORT || 5800);
const BIND = process.env.H5_BIND || '0.0.0.0';

const DEFAULT_UPSTREAM_PORT = 5787;
const CANDIDATE_HOSTS = ['::1', '127.0.0.1']; // ::1 优先（vite dev 默认只绑 IPv6）

// 上游状态（可变）
const upstream = {
  connectHost: '::1',
  port: DEFAULT_UPSTREAM_PORT,
  // 发往上游的 Host 头：必须是 vite allowedHosts 认得的名字（localhost）
  hostHeader: `localhost:${DEFAULT_UPSTREAM_PORT}`,
  explicit: false, // 是否来自 H5_UPSTREAM
  ok: null, // 最近一次探测结果
  lastProbe: 0,
};

function parseUpstream(spec) {
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(spec) ? spec : `http://${spec}`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const port = Number(url.port) || 80;
  return { connectHost: host, port, hostHeader: `localhost:${port}`, explicit: true };
}

if (process.env.H5_UPSTREAM) {
  Object.assign(upstream, parseUpstream(process.env.H5_UPSTREAM));
}

function upstreamUrl() {
  const h = upstream.connectHost.includes(':') ? `[${upstream.connectHost}]` : upstream.connectHost;
  return `http://${h}:${upstream.port}`;
}

// ---------------------------------------------------------------------------
// 上游探测
// ---------------------------------------------------------------------------
function probe(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    let req;
    try {
      req = http.request({ host, port, path: '/', method: 'GET', agent: false }, (res) => {
        res.resume();
        fin(true);
      });
    } catch (_) {
      return fin(false);
    }
    req.setTimeout(timeoutMs, () => {
      try {
        req.destroy();
      } catch (_) {}
      fin(false);
    });
    req.on('error', () => fin(false));
    req.end();
  });
}

let resolving = null;
function resolveUpstream() {
  if (resolving) return resolving;
  resolving = (async () => {
    try {
      if (upstream.explicit) {
        upstream.ok = await probe(upstream.connectHost, upstream.port);
      } else {
        let found = false;
        for (const h of CANDIDATE_HOSTS) {
          if (await probe(h, DEFAULT_UPSTREAM_PORT)) {
            upstream.connectHost = h;
            upstream.port = DEFAULT_UPSTREAM_PORT;
            upstream.hostHeader = `localhost:${DEFAULT_UPSTREAM_PORT}`;
            found = true;
            break;
          }
        }
        upstream.ok = found;
      }
      upstream.lastProbe = Date.now();
      return upstream.ok;
    } finally {
      resolving = null;
    }
  })();
  return resolving;
}

// ---------------------------------------------------------------------------
// 头处理
// ---------------------------------------------------------------------------
const REQ_HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const RESP_HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade',
]);

function upstreamHeaders(req, { upgrade = false } = {}) {
  const out = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (upgrade) {
      // 握手需要保留 connection/upgrade；只剥代理相关
      if (lk === 'proxy-authenticate' || lk === 'proxy-authorization' || lk === 'te' || lk === 'trailer') continue;
    } else if (REQ_HOP_BY_HOP.has(lk)) {
      continue;
    }
    out[k] = v;
  }
  // 关键：改写成上游 authority，绕过 vite allowedHosts 对局域网 IP 的 403
  out.host = upstream.hostHeader;
  out['x-forwarded-host'] = req.headers.host || '';
  out['x-forwarded-proto'] = 'http';
  const remote = (req.socket && req.socket.remoteAddress) || '';
  const prev = req.headers['x-forwarded-for'];
  out['x-forwarded-for'] = prev ? `${prev}, ${remote}` : remote;
  return out;
}

function responseHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (RESP_HOP_BY_HOP.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 友好降级页 / 502
// ---------------------------------------------------------------------------
function friendlyErrorPage({ title, detail }) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e7e9ee;
       font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  .card{max-width:620px;margin:24px;padding:26px 28px;border:1px solid #2a2f3a;border-radius:14px;background:#161a22}
  h1{margin:0 0 10px;font-size:19px}
  code{background:#0b0d12;border:1px solid #262b35;border-radius:6px;padding:1px 6px;font-size:13px}
  a{color:#8ab4ff}
  .muted{color:#98a1b3;font-size:13px}
  ol{margin:12px 0 0;padding-left:20px}
</style></head><body><div class="card">
  <h1>${title}</h1>
  <p>${detail}</p>
  <ol>
    <li>在 <b>ctrl 面板</b>里启动 <b>『海鲜市场 前端』(5787)</b>。</li>
    <li>确认 npm 里 <code>vite dev</code> 已在运行（<code>lsof -nP -iTCP:5787 -sTCP:LISTEN</code> 应看到 <code>[::1]:5787</code>）。</li>
    <li>回到 <a href="/_preview">/_preview</a> 刷新即可。</li>
  </ol>
  <p class="muted">上游目标：<code>${upstreamUrl()}</code> · 预览服务 PID <code>${process.pid}</code></p>
</div></body></html>`;
}

function sendFriendly502(res) {
  const body = friendlyErrorPage({
    title: '上游 vite dev 未运行 (502)',
    detail: '反代目标连不上，页面暂时无法渲染。这不是预览服务本身的问题。',
  });
  try {
    res.writeHead(502, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  } catch (_) {
    try {
      res.destroy();
    } catch (__) {}
  }
}

// ---------------------------------------------------------------------------
// 局域网 IP
// ---------------------------------------------------------------------------
function lanList() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push({ name, address: ni.address });
    }
  }
  out.sort((a, b) => {
    if (a.name === b.name) return a.address.localeCompare(b.address);
    if (a.name === 'en0') return -1;
    if (b.name === 'en0') return 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

// ---------------------------------------------------------------------------
// /_preview 外壳（自含 HTML，不引任何外部资源）
// ---------------------------------------------------------------------------
function previewHtml() {
  const cfg = {
    port: PORT,
    lans: lanList(),
    upstream: { url: upstreamUrl(), connectHost: upstream.connectHost, port: upstream.port, ok: upstream.ok },
    pid: process.pid,
  };
  const cfgJson = JSON.stringify(cfg).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>海鲜市场 · H5 预览</title>
<style>
  :root{color-scheme:dark;--bg:#0f1115;--panel:#161a22;--line:#2a2f3a;--fg:#e7e9ee;--muted:#98a1b3;--acc:#8ab4ff;--ok:#3fb950;--bad:#f85149}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--fg);
    font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  header.bar{position:sticky;top:0;z-index:10;background:var(--panel);border-bottom:1px solid var(--line);padding:10px 14px;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}
  .title{font-weight:700;display:flex;align-items:center;gap:8px}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--muted);display:inline-block;flex:none}
  .dot.ok{background:var(--ok)} .dot.bad{background:var(--bad)}
  .status{font-weight:400;font-size:12.5px;color:var(--muted)}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  button{background:#222836;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px}
  button:hover{border-color:var(--acc)}
  button.active{background:var(--acc);color:#0b0d12;border-color:var(--acc);font-weight:700}
  input#addr{background:#0b0d12;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;width:300px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  main{padding:22px 14px 8px;display:flex;justify-content:center}
  .stage{display:flex;justify-content:center;width:100%}
  .phone{position:relative;border:10px solid #000;border-radius:26px;background:#000;box-shadow:0 12px 40px rgba(0,0,0,.5);flex:none}
  .phone iframe{display:block;border:0;background:#fff;border-radius:16px}
  .dim{font-size:12px;color:var(--muted);text-align:center;margin-top:6px}
  section.realdev{max-width:900px;margin:18px auto 40px;padding:16px 18px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
  section.realdev h2{margin:0 0 10px;font-size:15px}
  .copyrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
  code{background:#0b0d12;border:1px solid #262b35;border-radius:6px;padding:2px 7px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;word-break:break-all}
  .caveat{color:var(--muted);font-size:12.5px;margin:10px 0 0}
  .lanrow{margin:4px 0;font-size:13px}
</style>
</head>
<body>
<header class="bar">
  <div class="title"><span class="dot" id="dot"></span>海鲜市场 · H5 预览<span class="status" id="statusText">检测上游…</span></div>
  <a href="/_preview/colors" style="color:var(--acc);font-size:12.5px;text-decoration:none">色彩/底色诊断 →</a>
  <div class="row" id="presets"></div>
  <div class="row" id="routes"></div>
  <form class="row" id="addrForm"><input id="addr" spellcheck="false" autocomplete="off" placeholder="/reward"><button type="submit">前往</button></form>
</header>
<main>
  <div class="stage">
    <div>
      <div class="phone" id="phone"><iframe id="phone-iframe" src="/" title="H5 preview"></iframe></div>
      <div class="dim" id="dim"></div>
    </div>
  </div>
</main>
<section class="realdev">
  <h2>真机访问（同一局域网）</h2>
  <div id="lanlist"></div>
  <div class="copyrow"><code id="lanurl"></code><button id="copyBtn" type="button">一键复制</button></div>
  <p class="caveat">口径：iframe 宽度 = 真实断点，等同手机竖屏布局；但底部安全区 / 地址栏伸缩 / 键盘弹出仍需真机验证。<br>
  真机打开上面同一路径的地址即可看到同款页面（手机与电脑需在同一 Wi-Fi）。</p>
</section>
<script>
(function(){
  var CFG = ${cfgJson};
  var PRESETS = [{w:320,h:568},{w:375,h:667},{w:390,h:844},{w:414,h:896},{w:768,h:1024}];
  var ROUTES = ['/','/reward','/task','/listing','/exchange','/task/new','/listing/new','/login','/profile'];
  var DEFAULT = {w:390,h:844};

  var iframe = document.getElementById('phone-iframe');
  var phone = document.getElementById('phone');
  var addr = document.getElementById('addr');
  var dot = document.getElementById('dot');
  var statusText = document.getElementById('statusText');
  var dim = document.getElementById('dim');
  var presetsEl = document.getElementById('presets');
  var routesEl = document.getElementById('routes');
  var lanUrlEl = document.getElementById('lanurl');
  var copyBtn = document.getElementById('copyBtn');
  var lanlistEl = document.getElementById('lanlist');

  var size = {w:DEFAULT.w,h:DEFAULT.h};
  var lastAddr = '';
  var upstreamOk = (CFG.upstream && CFG.upstream.ok) === true;

  function applySize(){
    phone.style.width = size.w + 'px';
    phone.style.height = size.h + 'px';
    iframe.style.width = size.w + 'px';
    iframe.style.height = size.h + 'px';
    dim.textContent = size.w + ' x ' + size.h + (size.w <= 767 ? ' · 命中 H5 断点 (<=767)' : ' · 命中桌面断点 (>767)');
  }

  function renderPresets(){
    presetsEl.innerHTML = '';
    PRESETS.forEach(function(p){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.w + 'x' + p.h;
      if (p.w === size.w && p.h === size.h) b.className = 'active';
      b.onclick = function(){ size = {w:p.w,h:p.h}; applySize(); renderPresets(); };
      presetsEl.appendChild(b);
    });
  }

  function renderRoutes(){
    routesEl.innerHTML = '';
    ROUTES.forEach(function(r){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = r;
      b.onclick = function(){ navigate(r); };
      routesEl.appendChild(b);
    });
  }

  function currentPath(){
    try {
      var w = iframe.contentWindow;
      if (w && w.location && w.location.pathname) {
        return w.location.pathname + (w.location.search || '') + (w.location.hash || '');
      }
    } catch (e) { /* 跨源或未就绪，忽略 */ }
    return null;
  }

  function navigate(p){
    if (!p) p = '/';
    if (p.charAt(0) !== '/') p = '/' + p;
    try { iframe.contentWindow.location.href = p; }
    catch (e) { iframe.src = p; }
    lastAddr = p;
    addr.value = p;
    updateLanUrl();
  }

  function updateLanUrl(){
    var path = currentPath() || lastAddr || '/';
    var ip = (CFG.lans && CFG.lans[0] && CFG.lans[0].address) || 'localhost';
    lanUrlEl.textContent = 'http://' + ip + ':' + CFG.port + path;
  }

  function syncFromIframe(){
    var p = currentPath();
    if (p === null) return;
    if (p !== lastAddr) {
      lastAddr = p;
      if (document.activeElement !== addr) addr.value = p;
      updateLanUrl();
    }
  }
  setInterval(syncFromIframe, 400);

  document.getElementById('addrForm').addEventListener('submit', function(ev){
    ev.preventDefault();
    navigate(addr.value.trim());
  });

  // 上游健康轮询
  function setStatus(ok){
    upstreamOk = ok;
    dot.className = 'dot ' + (ok ? 'ok' : 'bad');
    if (ok) {
      statusText.textContent = '上游运行中 (' + CFG.upstream.connectHost + ':' + CFG.upstream.port + ')';
    } else {
      statusText.textContent = '上游未运行 —— 请在 ctrl 面板里启动『海鲜市场 前端』(5787)';
    }
  }
  function pollHealth(){
    fetch('/_preview/health', { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(j){ setStatus(!!j.upstreamOk); })
      .catch(function(){ setStatus(false); });
  }
  setStatus(upstreamOk);
  pollHealth();
  setInterval(pollHealth, 3000);

  // 真机地址
  function renderLan(){
    lanlistEl.innerHTML = '';
    if (!CFG.lans.length) { lanlistEl.textContent = '未检测到局域网 IPv4 地址。'; return; }
    CFG.lans.forEach(function(l){
      var d = document.createElement('div');
      d.className = 'lanrow';
      d.textContent = l.name + ' → ' + l.address;
      lanlistEl.appendChild(d);
    });
  }
  copyBtn.onclick = function(){
    var txt = lanUrlEl.textContent;
    var done = function(){ copyBtn.textContent = '已复制'; setTimeout(function(){ copyBtn.textContent = '一键复制'; }, 1400); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function(){ fallbackCopy(txt, done); });
      else fallbackCopy(txt, done);
    } catch (e) { fallbackCopy(txt, done); }
  };
  function fallbackCopy(txt, done){
    var ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); done();
  }

  iframe.addEventListener('load', function(){ syncFromIframe(); });

  applySize();
  renderPresets();
  renderRoutes();
  renderLan();
  updateLanUrl();
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// /_preview/colors —— 色彩 / 底色诊断页（自含 HTML，不引任何外部资源）
// ---------------------------------------------------------------------------
// 用途：手机真机「日档背景发灰」这类现象，口头描述不足以定位 ⇒ 让页面自己报数。
//   ① 色卡区：一批站内关键 hex 用 canvas fillRect + getImageData 取**实际 sRGB 字节**
//      （页内自算，不经 CSS）—— 两台设备同屏对比「同一 hex 到底渲染成什么」。
//   ② 站内自测区：一个**同源 iframe** 加载站点路径，直接读站内真实计算值：
//      colorScheme / .sf-shell 背景 / --sf-page-bg / --sf-topbar-bg /
//      视口上中下 3 点 elementFromPoint 命中元素与其（及最近不透明祖先的）背景 /
//      prefers-color-scheme / UA。
//   ③ 一键复制：所有读数拼成纯文本（一行一项）。
//   若 iframe 内部不可读（跨源 / 沙箱），或加载到的不是站点页面（非 HTML / 无 .sf-shell）
//   ⇒ **明确报错态并降级**：只保留「同源判定 + UA + matchMedia + 色卡回读」，绝不报假值。
//   src 可用 `?src=<path>` 覆盖（用于反向对照）。
function colorsHtml() {
  const meta = { port: PORT, pid: process.pid, upstream: upstreamUrl(), lan: lanList() };
  const metaJson = JSON.stringify(meta).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>海鲜市场 · 色彩/底色诊断</title>
<style>
  :root{color-scheme:dark;--bg:#0f1115;--panel:#161a22;--line:#2a2f3a;--fg:#e7e9ee;--muted:#98a1b3;--acc:#8ab4ff;--ok:#3fb950;--bad:#f85149}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--fg);
    font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  header.bar{position:sticky;top:0;z-index:10;background:var(--panel);border-bottom:1px solid var(--line);
    padding:10px 14px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;justify-content:space-between}
  .title{font-weight:700;display:flex;align-items:center;gap:8px}
  h2{font-size:13.5px;margin:0 0 9px}
  section{max-width:940px;margin:14px auto;padding:13px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
  button{background:#222836;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px}
  button:hover{border-color:var(--acc)}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:9px}
  input#src{background:#0b0d12;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;
    width:260px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
  .sw{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#0b0d12}
  .chip{height:46px}
  .meta{padding:5px 7px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);word-break:break-all}
  .meta b{color:var(--fg);font-weight:600}
  .kv{font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-all}
  .kv.err{border:1px solid var(--bad);background:#2a1416;border-radius:8px;padding:9px;color:#ffb4ad}
  .pill{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
  .pill.ok{color:var(--ok);border-color:#2a5b34}
  .pill.bad{color:var(--bad);border-color:#6b2a2a}
  textarea{width:100%;min-height:240px;background:#0b0d12;color:var(--fg);border:1px solid var(--line);border-radius:8px;
    padding:9px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;overflow:auto}
  .frame-wrap{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#000}
  iframe#site{display:block;width:100%;height:560px;border:0;background:#fff}
  .cap{color:var(--muted);font-size:12px;margin:9px 0 0}
</style>
</head>
<body>
<header class="bar">
  <div class="title">海鲜市场 · 色彩/底色诊断 <span class="pill" id="pill">初始化…</span></div>
  <button id="copyTop" type="button">复制全部读数</button>
</header>

<section>
  <h2>① 色卡回读 · canvas fillRect + getImageData（页内实测 sRGB 字节）</h2>
  <div class="grid" id="swatches"></div>
  <p class="cap" id="swcap"></p>
</section>

<section>
  <h2>② 站内自测 · 同源 iframe 内真实计算值</h2>
  <div class="row">
    <span>iframe src</span>
    <input id="src" value="/" spellcheck="false" autocomplete="off">
    <button id="rerun" type="button">重新自测</button>
    <span class="pill" id="stPill">…</span>
  </div>
  <div class="kv" id="selftest">等待 iframe 就绪…</div>
</section>

<section>
  <h2>③ 站内 iframe 视口（可见，供肉眼对照）</h2>
  <div class="frame-wrap"><iframe id="site" src="/" title="site"></iframe></div>
</section>

<section>
  <h2>④ 可复制读数（一行一项）</h2>
  <div class="row"><button id="copyOut" type="button">复制</button><span class="pill" id="copyState"></span></div>
  <textarea id="out" readonly spellcheck="false"></textarea>
</section>

<script>
(function(){
  var META = ${metaJson};
  var SWATCHES = [
    ['品牌黄 #FDE815（日档 page/topbar bg）', '#FDE815'],
    ['夜档底 #0B0C0E（dark page/topbar bg）', '#0B0C0E'],
    ['日档主文字 #0A0A0A（--sf-page-fg）', '#0A0A0A'],
    ['夜档主文字 #E8EAED（--sf-page-fg）', '#E8EAED'],
    ['日档卡片底 #FFFFFF', '#FFFFFF'],
    ['夜档卡片底 #15171B（--sf-me-bg）', '#15171B'],
    ['灰参照 #808080', '#808080'],
    ['日档描边 #030402', '#030402'],
    ['日档按钮底 #FFE60F（--sf-btna-bg）', '#FFE60F']
  ];

  var siteIframe = document.getElementById('site');
  var swLines = [];
  var st = { status: 'init', fields: [], error: null };
  var degrade = '（自测未运行）';
  var token = 0;

  var cvs = document.createElement('canvas');
  cvs.width = 1; cvs.height = 1;
  var ctx = cvs.getContext('2d', { willReadFrequently: true });

  function h2(n){ var s = Math.round(n).toString(16).toUpperCase(); return s.length < 2 ? '0' + s : s; }
  function cspace(){ try { var a = ctx.getContextAttributes ? ctx.getContextAttributes() : null; return (a && a.colorSpace) || '(unknown)'; } catch (e) { return '(n/a)'; } }

  function measure(hex){
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 1, 1);
    var d = null;
    try { d = ctx.getImageData(0, 0, 1, 1, { colorSpace: 'srgb' }).data; }
    catch (e) { try { d = ctx.getImageData(0, 0, 1, 1).data; } catch (e2) { return null; } }
    var got = '#' + h2(d[0]) + h2(d[1]) + h2(d[2]);
    return { r: d[0], g: d[1], b: d[2], a: d[3], got: got,
             rgb: 'rgb(' + d[0] + ', ' + d[1] + ', ' + d[2] + ')', same: got === hex.toUpperCase() };
  }

  function renderSwatches(){
    var host = document.getElementById('swatches');
    host.innerHTML = '';
    swLines.length = 0;
    for (var i = 0; i < SWATCHES.length; i++){
      var name = SWATCHES[i][0], hex = SWATCHES[i][1], m = measure(hex);
      var box = document.createElement('div'); box.className = 'sw';
      var chip = document.createElement('div'); chip.className = 'chip'; chip.style.background = hex;
      var meta = document.createElement('div'); meta.className = 'meta';
      if (!m) { meta.innerHTML = '<b>' + hex + '</b><br>回读失败'; }
      else {
        meta.innerHTML = '<b>' + hex + '</b><br>' + m.rgb + '<br>' + m.got +
          (m.same ? '' : ' <span style="color:#f85149">!= 输入</span>') + '<br>' + name;
      }
      box.appendChild(chip); box.appendChild(meta); host.appendChild(box);
      swLines.push('swatch ' + hex + ' => ' + (m ? m.rgb + ' (' + m.got + (m.same ? '' : ' != input') + ')' : 'FAILED') + '  · ' + name);
    }
    document.getElementById('swcap').textContent = 'canvas 2d colorSpace=' + cspace() + ' · 色卡 ' +
      SWATCHES.length + ' 块（回读值在每块下方）。同一 hex 在两台设备回读应一致；若这里一致而站点发灰 ⇒ 问题在站内 CSS / UA 强制深色。';
    swLines.push('canvas 2d colorSpace: ' + cspace());
  }

  function shortSel(doc, el){
    if (!el || el.nodeType !== 1) return '(非元素)';
    if (el === doc.documentElement) return 'html';
    if (el === doc.body) return 'body';
    var parts = [], n = el, guard = 0;
    while (n && n.nodeType === 1 && n !== doc.body && guard++ < 5){
      var tag = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(tag + '#' + n.id); break; }
      var cls = '';
      if (typeof n.className === 'string' && n.className.trim()) {
        cls = '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.');
      }
      parts.unshift(tag + cls);
      n = n.parentElement;
    }
    return parts.join(' > ') || '(未知)';
  }
  function swBg(win, el){
    try { return win.getComputedStyle(el).backgroundColor; } catch (e) { return '(读失败)'; }
  }
  function opaque(bg){
    if (!bg || bg === 'transparent') return false;
    if (bg.indexOf('rgba(') === 0 && /,\\s*0\\s*\\)$/.test(bg)) return false;
    return true;
  }
  function bgOwner(doc, win, el){
    var n = el, guard = 0;
    while (n && n.nodeType === 1 && guard++ < 14){
      var b = swBg(win, n);
      if (opaque(b)) return { sel: shortSel(doc, n), bg: b };
      n = n.parentElement;
    }
    return { sel: '(到 html 仍透明)', bg: '(UA 画布默认)' };
  }

  function readSelfTest(){
    var out = { status: 'ok', fields: [], error: null };
    var doc = null, win = null;
    try { doc = siteIframe.contentDocument; win = siteIframe.contentWindow; } catch (e) { doc = null; }
    if (!doc || !doc.documentElement || !win){
      out.status = 'cross-origin';
      out.error = '浏览器不允许读取 iframe 内部文档（跨源或沙箱）⇒ 降级：只保留 父页 UA / matchMedia / 色卡回读。';
      return out;
    }
    var ct = '';
    try { ct = doc.contentType || ''; } catch (e) {}
    var shell = null;
    try { shell = doc.querySelector('.sf-shell'); } catch (e) {}
    if (ct && ct !== 'text/html' && !shell){
      out.status = 'not-html';
      out.error = 'iframe 加载到的不是站点 HTML 页面（content-type=' + ct + '）⇒ 该 src 不存在或不是站内页面；不做任何数值推断。';
      return out;
    }
    if (!shell){
      out.status = 'missing-anchor';
      out.error = 'iframe 文档里没有 .sf-shell（站点外壳未渲染 / 该 src 不是站内页面 / 上游 502）⇒ 不做任何数值推断。';
      return out;
    }
    var html = doc.documentElement, body = doc.body;
    var csHtml = win.getComputedStyle(html);
    var csShell = win.getComputedStyle(shell);
    var csBody = body ? win.getComputedStyle(body) : null;
    function put(k, v){ out.fields.push([k, v]); }
    var href = '(不可读)';
    try { href = win.location.href; } catch (e) {}
    put('iframe href', href);
    put('iframe title', doc.title || '(空)');
    put('iframe content-type', ct || '(空)');
    put('iframe innerWidth x innerHeight', win.innerWidth + ' x ' + win.innerHeight);
    put('html[data-theme]', html.getAttribute('data-theme') || '(无 → 日档默认)');
    put('getComputedStyle(documentElement).colorScheme', csHtml.colorScheme || '(空)');
    put('getComputedStyle(body).colorScheme', csBody ? (csBody.colorScheme || '(空)') : '(无 body)');
    put('documentElement computed backgroundColor', csHtml.backgroundColor);
    put('body computed backgroundColor', csBody ? csBody.backgroundColor : '(无 body)');
    put('.sf-shell computed backgroundColor', csShell.backgroundColor);
    put('.sf-shell computed color', csShell.color);
    put('--sf-page-bg (parsed)', (csShell.getPropertyValue('--sf-page-bg') || csHtml.getPropertyValue('--sf-page-bg') || '(空)').trim());
    put('--sf-topbar-bg (parsed)', (csShell.getPropertyValue('--sf-topbar-bg') || csHtml.getPropertyValue('--sf-topbar-bg') || '(空)').trim());
    put('iframe matchMedia(prefers-color-scheme: dark).matches', String(win.matchMedia('(prefers-color-scheme: dark)').matches));
    put('iframe navigator.userAgent', win.navigator.userAgent);
    var pts = [['上部', 0.15], ['中部', 0.50], ['下部', 0.90]];
    var W = win.innerWidth || 0, H = win.innerHeight || 0;
    for (var i = 0; i < pts.length; i++){
      var x = Math.round(W * 0.5), y = Math.round(H * pts[i][1]);
      var el = null;
      try { el = doc.elementFromPoint(x, y); } catch (e) {}
      var key = 'elementFromPoint(' + x + ',' + y + ') ' + pts[i][0];
      if (!el) { put(key, '(无命中元素)'); continue; }
      var owner = bgOwner(doc, win, el);
      put(key, shortSel(doc, el) + ' | self bg=' + swBg(win, el) + ' | 画底色的=' + owner.sel + ' bg=' + owner.bg);
    }
    return out;
  }

  function compose(){
    var L = [];
    L.push('[seafood color-probe] ' + new Date().toISOString());
    L.push('page url: ' + location.href);
    L.push('probe service: h5-preview pid=' + META.pid + ' port=' + META.port + ' upstream=' + META.upstream);
    L.push('parent navigator.userAgent: ' + navigator.userAgent);
    L.push('parent matchMedia(prefers-color-scheme: dark).matches: ' + window.matchMedia('(prefers-color-scheme: dark)').matches);
    L.push('parent devicePixelRatio: ' + (window.devicePixelRatio || 1));
    L.push('parent innerWidth x innerHeight: ' + window.innerWidth + ' x ' + window.innerHeight);
    L.push('--- [1] swatch readback (canvas fillRect -> getImageData) ---');
    for (var i = 0; i < swLines.length; i++) L.push(swLines[i]);
    L.push('--- [2] in-site self test (same-origin iframe) ---');
    if (st.status === 'ok'){
      L.push('self-test status: ok');
      for (var j = 0; j < st.fields.length; j++) L.push(st.fields[j][0] + ': ' + st.fields[j][1]);
    } else {
      L.push('self-test status: ' + st.status);
      L.push('self-test ERROR: ' + (st.error || '(无详情)'));
    }
    L.push('--- [3] degrade note ---');
    L.push(degrade);
    var txt = L.join('\\n');
    document.getElementById('out').value = txt;
    return txt;
  }

  function render(){
    var box = document.getElementById('selftest');
    var pill = document.getElementById('stPill');
    var lines = [];
    if (st.status === 'ok'){
      box.className = 'kv'; pill.className = 'pill ok'; pill.textContent = '同源可读 · OK';
      lines.push('self-test status: ok（同源 iframe 内部可读）');
      for (var i = 0; i < st.fields.length; i++) lines.push(st.fields[i][0] + ': ' + st.fields[i][1]);
      degrade = '未降级：同源 iframe 内部可读，② 区为站内真实计算值。';
    } else {
      box.className = 'kv err'; pill.className = 'pill bad'; pill.textContent = 'ERROR · ' + st.status;
      lines.push('SELF-TEST ERROR (' + st.status + ')');
      lines.push(st.error || '(无详情)');
      degrade = '已降级（' + st.status + '）：' + (st.error || '') + ' 降级时只保证 父页 UA / matchMedia / 色卡回读 三项有效；站点内部读数缺失（不报假值）。';
      lines.push(degrade);
    }
    box.textContent = lines.join('\\n');
    compose();
  }

  function run(src){
    token++;
    var my = token;
    if (src != null) siteIframe.src = src;
    var box = document.getElementById('selftest');
    var pill = document.getElementById('stPill');
    box.className = 'kv'; box.textContent = '等待 iframe 就绪…';
    pill.className = 'pill'; pill.textContent = '等待…';
    st = { status: 'init', fields: [], error: null };
    degrade = '（自测进行中）';
    var t0 = Date.now();
    (function poll(){
      if (my !== token) return;
      var ready = false;
      try {
        var d = siteIframe.contentDocument;
        if (d && d.documentElement){
          var ct2 = '';
          try { ct2 = d.contentType || ''; } catch (e) {}
          if (d.querySelector && d.querySelector('.sf-shell')) ready = true;
          else if (ct2 && ct2 !== 'text/html') ready = true;
          else if (d.readyState === 'complete' && (Date.now() - t0) > 2500) ready = true;
        }
      } catch (e) {}
      if (ready || (Date.now() - t0) > 9000){
        if (my !== token) return;
        st = readSelfTest();
        render();
        return;
      }
      setTimeout(poll, 300);
    })();
  }

  function copy(text, btn){
    function fb(t, d2){
      var ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); d2();
    }
    var done = function(){ var o = btn.textContent; btn.textContent = '已复制'; setTimeout(function(){ btn.textContent = o; }, 1400); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function(){ fb(text, done); }); return; }
    } catch (e) {}
    fb(text, done);
  }

  var qs = new URLSearchParams(location.search);
  var initialSrc = qs.get('src') || '/';
  document.getElementById('src').value = initialSrc;

  document.getElementById('copyTop').onclick = function(){ copy(compose(), this); };
  document.getElementById('copyOut').onclick = function(){
    copy(compose(), this);
    document.getElementById('copyState').textContent = '已复制（' + new Date().toLocaleTimeString() + '）';
  };
  document.getElementById('rerun').onclick = function(){
    run(document.getElementById('src').value.trim() || '/');
  };

  renderSwatches();
  document.getElementById('pill').textContent = 'h5-preview pid ' + META.pid;
  run(initialSrc);
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// /_preview/health
// ---------------------------------------------------------------------------
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function handleHealth(res) {
  const ok = await probe(upstream.connectHost, upstream.port, 1200);
  upstream.ok = ok;
  upstream.lastProbe = Date.now();
  sendJson(res, 200, {
    ok: true,
    pid: process.pid,
    port: PORT,
    bind: BIND,
    upstream: upstreamUrl(),
    upstreamConnectHost: upstream.connectHost,
    upstreamPort: upstream.port,
    upstreamHostHeader: upstream.hostHeader,
    upstreamOk: ok,
    upstreamExplicit: upstream.explicit,
    uptimeSec: Math.round(process.uptime()),
    lan: lanList(),
    ts: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// 反代（HTTP）
// ---------------------------------------------------------------------------
function proxyHttp(req, res) {
  const preq = http.request(
    {
      host: upstream.connectHost,
      port: upstream.port,
      path: req.url,
      method: req.method,
      headers: upstreamHeaders(req),
      agent: false,
    },
    (pres) => {
      upstream.ok = true;
      upstream.lastProbe = Date.now();
      if (res.headersSent) return;
      res.writeHead(pres.statusCode || 502, pres.statusMessage || '', responseHeaders(pres.headers));
      pres.pipe(res);
      pres.on('error', () => {
        try {
          res.destroy();
        } catch (_) {}
      });
    }
  );

  preq.on('error', (err) => {
    const code = err && err.code;
    if (code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'EADDRNOTAVAIL') {
      upstream.ok = false;
      resolveUpstream(); // 重探（::1 优先）
    }
    if (!res.headersSent) sendFriendly502(res);
    else {
      try {
        res.destroy();
      } catch (_) {}
    }
  });

  req.on('error', () => {
    try {
      preq.destroy();
    } catch (_) {}
  });
  res.on('close', () => {
    try {
      preq.destroy();
    } catch (_) {}
  });

  req.pipe(preq);
}

// ---------------------------------------------------------------------------
// 反代（WebSocket upgrade / HMR）
// ---------------------------------------------------------------------------
function proxyUpgrade(req, socket, head) {
  const preq = http.request({
    host: upstream.connectHost,
    port: upstream.port,
    path: req.url,
    method: req.method,
    headers: upstreamHeaders(req, { upgrade: true }),
    agent: false,
  });

  const kill = () => {
    try {
      socket.destroy();
    } catch (_) {}
    try {
      preq.destroy();
    } catch (_) {}
  };

  preq.on('upgrade', (pres, psocket, phead) => {
    upstream.ok = true;
    upstream.lastProbe = Date.now();
    let raw = `HTTP/1.1 ${pres.statusCode} ${pres.statusMessage || 'Switching Protocols'}\r\n`;
    for (const [k, v] of Object.entries(pres.headers)) {
      if (k.toLowerCase() === 'transfer-encoding') continue;
      raw += `${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`;
    }
    raw += '\r\n';
    try {
      socket.write(raw);
    } catch (_) {
      return kill();
    }
    if (phead && phead.length) socket.unshift(phead);
    if (head && head.length) psocket.write(head);
    psocket.pipe(socket);
    socket.pipe(psocket);
    socket.on('error', kill);
    psocket.on('error', kill);
    socket.on('close', () => {
      try {
        psocket.destroy();
      } catch (_) {}
    });
    psocket.on('close', () => {
      try {
        socket.destroy();
      } catch (_) {}
    });
  });

  preq.on('response', (pres) => {
    // 上游没接受 upgrade（当作普通请求回了）
    try {
      socket.write(`HTTP/1.1 ${pres.statusCode} ${pres.statusMessage || 'Error'}\r\nConnection: close\r\n\r\n`);
    } catch (_) {}
    kill();
  });
  preq.on('error', kill);
  socket.on('error', kill);

  preq.end();
}

// ---------------------------------------------------------------------------
// 服务器
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://placeholder').pathname;
  } catch (_) {
    pathname = req.url || '/';
  }

  if (pathname === '/_preview/health') {
    handleHealth(res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { ok: false });
    });
    return;
  }
  if (pathname === '/_preview/colors' || pathname === '/_preview/colors/') {
    const body = colorsHtml();
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  if (pathname === '/_preview' || pathname === '/_preview/') {
    const body = previewHtml();
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  proxyHttp(req, res);
});

server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://placeholder').pathname;
  } catch (_) {
    pathname = req.url || '/';
  }
  if (pathname === '/_preview' || pathname === '/_preview/' || pathname === '/_preview/colors' || pathname === '/_preview/colors/' || pathname === '/_preview/health') {
    try {
      socket.destroy();
    } catch (_) {}
    return;
  }
  proxyUpgrade(req, socket, head);
});

server.on('clientError', (err, socket) => {
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch (_) {}
});

server.listen(PORT, BIND, () => {
  const lans = lanList();
  console.log(`[h5-preview] listening on http://${BIND}:${PORT} (pid ${process.pid})`);
  console.log(`[h5-preview] preview shell: http://localhost:${PORT}/_preview`);
  lans.forEach((l) => console.log(`[h5-preview]   LAN (${l.name}): http://${l.address}:${PORT}/_preview`));
  resolveUpstream().then((ok) => {
    console.log(`[h5-preview] upstream probe: ${upstreamUrl()} => ${ok ? 'OK' : 'DOWN'} (Host header ${upstream.hostHeader})`);
  });
});

process.on('SIGTERM', () => {
  console.log('[h5-preview] SIGTERM, closing…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
});
