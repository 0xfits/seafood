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
  if (pathname === '/_preview' || pathname === '/_preview/health') {
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
