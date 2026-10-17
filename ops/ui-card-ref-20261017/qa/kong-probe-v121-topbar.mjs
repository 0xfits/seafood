/**
 * Kong 实现方读数探针 · design-system v1.21 §23「顶栏实黄」（`T114`–`T119`）
 * 覆盖 AC-1（日档像素）/ AC-2（夜档冻结）/ AC-3（前景硬门 · 含**真 hover**）/ AC-4（不透明不穿透）/
 *      AC-8（两向灵敏度自证 + 夜档反向臂）/ AC-9（零几何 · 逐元素 dump）/ AC-10（移动档）。
 *
 * 口径（承仓内既有配方 ops/v119-msg-panel/qa/probe-geometry-qa.mjs + ops/ui-card-ref-20261017/qa/kong-probe-card-ui.mjs）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `KONG_DIST`（零 dev server / 零后端 / 零库写）
 *   · API 一律 `context.route` 内**内存自截**（夹具写在探针里 · 真实感商品名，非 FIXTURE 串）
 *   · 主题态 = `addInitScript` 预置 `localStorage.theme`（站点自身 `data-theme` 口径）
 *   · 禁动画（reducedMotion:'reduce' + 注入 animation/transition:none）+ 稳态采样（rAF×2 + 固定窗）
 *   · ★ 加载期随机源归一化：Footer.jsx 模块加载期 `Math.random()` 选合作品牌文案 ⇒ addInitScript 冻结
 *     `Math.random`（缺它则同版两轮 dump 不同 —— 本探针先跑噪声基线自证）
 *   · 合成像素 = `page.screenshot()` 的 PNG **在页内 canvas 解码后 getImageData 回读**
 *     （即浏览器**合成后**像素，非单层声明值；承技能「合成像素」一条）
 *   · 真 hover = Playwright `page.hover()`（★ 裸 CDP Input.dispatchMouseEvent 在本机 5s 超时、
 *     CSS.forcePseudoState 不生效 ⇒ 本探针不用那两条通道）
 *
 * 用法：
 *   KONG_DIST=<dist> KONG_SHOTS=1 KONG_PREFIX=v121 node ops/ui-card-ref-20261017/qa/kong-probe-v121-topbar.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.KONG_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/readings/kong-v121-readings.json')
const SHOTS = process.env.KONG_SHOTS === '1'
const PREFIX = process.env.KONG_PREFIX || 'v121'
const SHOTS_DIR = path.join(REPO, 'ops/ui-card-ref-20261017/shots')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// ---- 夹具（内存 JSON · 真实感商品名，截图给 Kevin 目视用；零后端 / 零库写） ----------------------
const PRIZES = [
  { bID: 1, name: '九成新 Sony WH-1000XM4 头戴降噪耳机', description: '自用一年，包装配件齐全，无划痕', points: 899, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: '全新未拆 双立人 珐琅铸铁锅 24cm', description: '搬家出闲置，吊牌尚在', points: 660, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: 'iPad Air 5 64G 深空灰 含妙控键盘', description: '屏幕无伤，电池健康 96%', points: 1200, stores_count: 0, claims_count: 0, time_end: '2026-12-31' },
  { bID: 4, name: '山姆代购 新西兰车厘子 5斤装', description: '冷链直发，同城可自提', points: 259, stores_count: 2, claims_count: 7 },
]
const apiResponse = (method, pathname) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/home') return data({ tasks: [], prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  if (pathname.startsWith('/api/task/all')) return data([{ tID: 1, title: '周末社区集市摆摊招募', is_open: true, points: 10, participants_count: 0 }])
  if (pathname.startsWith('/api/prize/all')) return data(PRIZES)
  if (pathname === '/api/messages/unread-count') return data({ unread_total: 0 })
  if (pathname === '/api/prize-item') return data([])
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内测量器 ---------------------------------------------------------------------------------
const MEASURE = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const px = (s) => { const m = String(s || '').match(/rgba?\\(([^)]+)\\)/); if (!m) return null
    const p = m[1].split(',').map((v) => parseFloat(v)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const over = (fg, bg) => ({ r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)), g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)), b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)), a: 1 })
  // 有效底 = 沿祖先链把 background-color 逐层向下合成（首个 alpha=1 的层为止）
  const effBg = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const c = px(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0) { layers.push({ c, tag: n.tagName.toLowerCase(), id: n.id || null, cls: (n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || '' })
        if (c.a >= 1) break }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 }   // 兜底 = 白（文档底）
    const chain = []
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      base = over(layers[i].c, base)
      chain.push(layers[i].tag + (layers[i].id ? '#' + layers[i].id : '') + (layers[i].cls ? '.' + String(layers[i].cls).split(' ')[0] : '') + '=' + 'rgba(' + layers[i].c.r + ',' + layers[i].c.g + ',' + layers[i].c.b + ',' + layers[i].c.a + ')')
    }
    return { rgb: 'rgb(' + base.r + ',' + base.g + ',' + base.b + ')', chain }
  }
  const rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height), top: round(r.top), bottom: round(r.bottom), left: round(r.left), right: round(r.right) } }
  const vis = (el) => !!(el && el.getClientRects().length > 0)
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const clsOf = (el) => { const c = el.className; return c && c.baseVal !== undefined ? c.baseVal : (c || '') }

  const header = document.getElementById('header')
  const region = document.querySelector('.sf-region-top')
  const container = document.querySelector('.sf-route-container')
  const hcs = cs(header); const rcs = cs(region); const ccs = cs(container)
  const hdr = effBg(header)

  // ---- 顶栏内前景全集（自顶栏根递归取「自身承载文本」的叶子 + 图标） ----
  const fgs = []
  const push = (el, kind) => {
    const c = cs(el)
    const bg = effBg(el)
    fgs.push({
      kind, tag: el.tagName.toLowerCase(), cls: clsOf(el),
      text: (el.textContent || '').trim().slice(0, 28),
      hooks: ['sf-topbar-brand', 'sf-topbar-hover-brand-fg'].filter((h) => clsOf(el).includes(h)).concat(clsOf(el).includes('nav-link') ? ['nav-link' + (clsOf(el).includes('active') ? '+active' : '')] : []),
      color: c.color, fontSize: c.fontSize, fontWeight: c.fontWeight,
      effBg: bg.rgb, effBgChain: bg.chain,
      rect: rectOf(el), opacity: c.opacity,
    })
  }
  const walk = (el) => {
    if (!vis(el)) return
    const tag = el.tagName.toLowerCase()
    const kids = [...el.children]
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
    if (ownText) push(el, 'text')
    if (tag === 'svg' && el.getClientRects().length) push(el, 'icon')
    kids.forEach(walk)
  }
  if (header) walk(header)

  // ---- 逐元素几何 dump（父版 vs 现版归因用；结构键 = tag+全 class+同名序号，键内不含坐标） ----
  const dump = []
  const keyCount = {}
  if (header) {
    const all = [...document.querySelectorAll('.sf-shell *, #header *')].filter((el) => vis(el))
    const owner = (el) => el.closest('[data-sf-region]')
    for (const el of all) {
      const base = el.tagName.toLowerCase() + '.' + String(clsOf(el)).trim().split(/\\s+/).join('.')
      keyCount[base] = (keyCount[base] || 0) + 1
      const key = base + '#' + keyCount[base]
      const c = cs(el)
      const r = el.getBoundingClientRect()
      dump.push([key, Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100, Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100,
        c.backgroundColor, c.color, c.borderTopColor + '/' + c.borderTopWidth, c.backdropFilter,
        (owner(el) || {}).getAttribute ? owner(el).getAttribute('data-sf-region') : null,
        (el.closest('#header') ? 'header' : 'outside')])
    }
  }

  // ---- 顶栏内取点：合成像素 + 命中测试 ----
  const w = window.innerWidth
  const hh = header ? header.getBoundingClientRect().height : 0
  const points = [[4, 4], [Math.round(w / 2), 3], [w - 6, 4], [6, Math.round(hh / 2)], [Math.round(w * 0.3), 8]]
  const hits = points.map(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return { point: [x, y], tag: el ? el.tagName.toLowerCase() : null, cls: el ? clsOf(el) : null,
      inHeader: !!(header && el && header.contains(el)), isHeaderItself: el === header }
  })

  return {
    url: location.href, pathname: location.pathname,
    theme: document.documentElement.getAttribute('data-theme'),
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    viewport: { w, h: window.innerHeight },
    tokens: {
      topbarBg: cs(document.documentElement).getPropertyValue('--sf-topbar-bg').trim(),
      topbarBorder: cs(document.documentElement).getPropertyValue('--sf-topbar-border').trim(),
      brandFg: cs(document.documentElement).getPropertyValue('--sf-brand-fg').trim(),
      atHeaderBrandFg: hcs ? hcs.getPropertyValue('--sf-brand-fg').trim() : null,
    },
    header: header ? {
      cls: clsOf(header), bg: hcs.backgroundColor, bgImage: hcs.backgroundImage, effBg: hdr.rgb, effBgChain: hdr.chain,
      backdropFilter: hcs.backdropFilter, webkitBackdropFilter: hcs.webkitBackdropFilter,
      borderBottom: hcs.borderBottomWidth + ' ' + hcs.borderBottomStyle + ' ' + hcs.borderBottomColor,
      borderBottomColor: hcs.borderBottomColor, borderBottomWidth: hcs.borderBottomWidth,
      opacity: hcs.opacity, position: hcs.position, top: hcs.top, zIndex: hcs.zIndex, boxShadow: hcs.boxShadow,
      rect: rectOf(header),
    } : null,
    regionTop: region ? { bg: rcs.backgroundColor, rect: rectOf(region), opacity: rcs.opacity } : null,
    routeContainer: container ? { bg: ccs.backgroundColor, rect: rectOf(container), maxWidth: ccs.maxWidth, paddingL: ccs.paddingLeft, paddingR: ccs.paddingRight, marginL: ccs.marginLeft } : null,
    shell: document.querySelector('.sf-shell') ? { bg: cs(document.querySelector('.sf-shell')).backgroundColor, rect: rectOf(document.querySelector('.sf-shell')) } : null,
    pageH: document.documentElement.scrollHeight,
    fgs, pts: points, hits, dumpCount: dump.length,
  }
})()`

const DUMP_FN = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const vis = (el) => !!(el && el.getClientRects().length > 0)
  const clsOf = (el) => { const c = el.className; return c && c.baseVal !== undefined ? c.baseVal : (c || '') }
  const out = []; const keyCount = {}
  const root = document.querySelector('.sf-shell') || document.body
  for (const el of [...root.querySelectorAll('*')].filter(vis)) {
    const base = el.tagName.toLowerCase() + '.' + String(clsOf(el)).trim().split(/\\s+/).join('.')
    keyCount[base] = (keyCount[base] || 0) + 1
    const c = getComputedStyle(el); const r = el.getBoundingClientRect()
    out.push([base + '#' + keyCount[base], round(r.x), round(r.y), round(r.width), round(r.height),
      c.backgroundColor, c.color, c.borderTopColor + '/' + c.borderTopWidth, c.backdropFilter,
      el.closest('#header') ? 'header' : (el.closest('[data-sf-region="footer"]') ? 'footer' : 'else')])
  }
  return out
})()`

// ---- 页内 PNG 解码取像素（浏览器合成后的像素 · 零 npm 依赖） --------------------------------------
async function decodePixels(browser, b64, points, rows) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  const r = await p.evaluate(async ({ b64, points, rows }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
    const samples = points.map(([x, y]) => {
      const d = g.getImageData(Math.max(0, Math.min(c.width - 1, Math.round(x))), Math.max(0, Math.min(c.height - 1, Math.round(y))), 1, 1).data
      return { point: [x, y], rgb: `rgb(${d[0]},${d[1]},${d[2]})`, a: d[3] }
    })
    const histograms = (rows || []).map((y) => {
      const d = g.getImageData(0, Math.max(0, Math.min(c.height - 1, Math.round(y))), c.width, 1).data
      const hist = {}
      for (let i = 0; i < d.length; i += 4) { const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; hist[k] = (hist[k] || 0) + 1 }
      const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => ({ rgb: `rgb(${k})`, px: n }))
      return { row: y, width: c.width, topColors: top }
    })
    return { w: c.width, h: c.height, samples, histograms }
  }, { b64, points, rows })
  await ctx.close()
  return r
}

async function newPage(browser, w, h, theme) {
  const context = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light',
  })
  await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)}); Math.random = () => 0.42;`)
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    }
    const rel = decodeURIComponent(u.pathname)
    let file = path.join(DIST, rel)
    if (!path.resolve(file).startsWith(path.resolve(DIST))) return route.fulfill({ status: 403, body: '' })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(20000)
  return { context, page }
}

const NOANIM = '*,*::before,*::after{animation:none!important;transition:none!important}'

async function settle(page) {
  await page.waitForTimeout(150)
  await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
  await page.waitForTimeout(120)
}

// 读某个选择器的 computed color + 有效底（hover 态用）
const COLOR_OF = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)})
  if (!el) return null
  const px = (s) => { const m = String(s || '').match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  let base = { r: 255, g: 255, b: 255, a: 1 }
  const layers = []
  for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } }
  for (let i = layers.length - 1; i >= 0; i -= 1) { const c = layers[i]; base = { r: Math.round(c.r * c.a + base.r * (1 - c.a)), g: Math.round(c.g * c.a + base.g * (1 - c.a)), b: Math.round(c.b * c.a + base.b * (1 - c.a)), a: 1 } }
  const cs = getComputedStyle(el)
  return { sel: ${JSON.stringify(sel)}, tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 24),
    color: cs.color, bgSelf: cs.backgroundColor, effBg: 'rgb(' + base.r + ',' + base.g + ',' + base.b + ')',
    fontSize: cs.fontSize, fontWeight: cs.fontWeight, outline: cs.outlineWidth }
})()`

// ---- 主流程 -------------------------------------------------------------------------------------
const CASES = [
  { label: '390_day', w: 390, h: 844, theme: 'light' },
  { label: '390_night', w: 390, h: 844, theme: 'dark' },
  { label: '1440_day', w: 1440, h: 900, theme: 'light' },
  { label: '1440_night', w: 1440, h: 900, theme: 'dark' },
  { label: '1600_day', w: 1600, h: 900, theme: 'light' },
  { label: '1600_night', w: 1600, h: 900, theme: 'dark' },
  { label: '375_day', w: 375, h: 812, theme: 'light' },
  { label: '320_day', w: 320, h: 640, theme: 'light' },
]

const out = {
  probe: 'ops/ui-card-ref-20261017/qa/kong-probe-v121-topbar.mjs',
  dist: DIST, distAssets: fs.existsSync(path.join(DIST, 'assets')) ? fs.readdirSync(path.join(DIST, 'assets')).sort() : [],
  startedAt: new Date().toISOString(), states: {}, hover: {}, scroll: {}, selfproof: {}, shots: [], abortedHosts: [], errors: [],
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })

  for (const kase of CASES) {
    const { label, w, h, theme } = kase
    try {
      const { context, page } = await newPage(browser, w, h, theme)
      await page.goto(ORIGIN + '/', { waitUntil: 'load' })
      await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 }).catch(() => out.errors.push(`${label}: reward-card 未出现`))
      await page.addStyleTag({ content: NOANIM })
      await settle(page)
      const m = await page.evaluate(MEASURE)
      const dump = await page.evaluate(DUMP_FN)
      const shotBuf = await page.screenshot()
      const rows = [1, Math.max(1, Math.round(m.header ? m.header.rect.h / 2 : 20)), Math.max(2, Math.round((m.header ? m.header.rect.h : 40) - 3))]
      const decoded = await decodePixels(browser, shotBuf.toString('base64'), m.pts, rows)

      // ---- 滚动复读（不穿透 / alpha 保持） ----
      await page.evaluate('window.scrollTo(0, 400)')
      await page.waitForTimeout(200)
      const scrolled = await page.evaluate(MEASURE)
      const hitScrolled = await page.evaluate(`(() => { const el = document.elementFromPoint(4, 4); const h = document.getElementById('header'); return { tag: el ? el.tagName.toLowerCase() : null, cls: el ? (el.className || '') : null, inHeader: !!(h && el && h.contains(el)) } })()`)
      await page.evaluate('window.scrollTo(0, 0)')
      await page.waitForTimeout(150)

      // ---- 真 hover（Playwright page.hover） ----
      const hov = {}
      const hamSel = '[data-sf-m="header-mobile-menu"]'
      const hovers = [
        ['nav-link 社区任务', '#header .nav-link[href]'],
        ['主题钮', '#header button[title]'],
      ]
      for (const [name, sel] of hovers) {
        try {
          const el = await page.$(sel)
          const box = el ? await el.boundingBox() : null
          if (!el) { hov[name] = { status: 'NO_ELEMENT', sel }; continue }
          if (!box) { hov[name] = { status: 'NOT_VISIBLE_AT_THIS_VIEWPORT', sel }; continue }
          const before = await page.evaluate(COLOR_OF(sel))
          await el.hover({ timeout: 4000 })
          await page.waitForTimeout(220)
          const after = await page.evaluate(COLOR_OF(sel))
          hov[name] = { status: 'MEASURED', sel, before, after, changed: before && after ? before.color !== after.color : null, box }
        } catch (e) { hov[name] = { status: 'HOVER_FAILED', sel, err: String(e).slice(0, 200) } }
      }
      // 注册 / 登录 钮（按文本定位，样式类同名两条）
      try {
        const regBtn = await page.$('#header .sf-topbar-hover-brand-fg')
        const box = regBtn ? await regBtn.boundingBox() : null
        if (!regBtn || !box) {
          hov['注册/登录钮(src 类钩)'] = { status: regBtn ? 'NOT_VISIBLE_AT_THIS_VIEWPORT（≤767 桌面档隐藏）' : 'NO_ELEMENT' }
        } else {
          const spanSel = '#header .sf-topbar-hover-brand-fg span'
          const beforeBtn = await page.evaluate(COLOR_OF('#header .sf-topbar-hover-brand-fg'))
          const beforeSpan = await page.evaluate(COLOR_OF(spanSel))
          await regBtn.hover({ timeout: 4000 })
          await page.waitForTimeout(220)
          const afterBtn = await page.evaluate(COLOR_OF('#header .sf-topbar-hover-brand-fg'))
          const afterSpan = await page.evaluate(COLOR_OF(spanSel))
          hov['注册/登录钮(src 类钩)'] = { status: 'MEASURED', sel: '#header .sf-topbar-hover-brand-fg', before: beforeBtn, after: afterBtn, spanBefore: beforeSpan, spanAfter: afterSpan, changed: beforeBtn && afterBtn ? beforeBtn.color !== afterBtn.color : null, box }
        }
      } catch (e) { hov['注册/登录钮(src 类钩)'] = { status: 'HOVER_FAILED', err: String(e).slice(0, 200) } }
      // 汉堡钮 hover（移动档 · 自带底 · 现状维持）
      try {
        const ham = await page.$(hamSel)
        const hamBox = ham ? await ham.boundingBox() : null
        if (!ham || !hamBox) hov['汉堡钮'] = { status: 'NOT_VISIBLE_AT_THIS_VIEWPORT（桌面档无汉堡）' }
        else {
          const before = await page.evaluate(COLOR_OF(hamSel))
          await ham.hover({ timeout: 4000 }); await page.waitForTimeout(220)
          const after = await page.evaluate(COLOR_OF(hamSel))
          hov['汉堡钮'] = { status: 'MEASURED', sel: hamSel, before, after, changed: before && after ? before.color !== after.color || before.bgSelf !== after.bgSelf : null }
          await page.mouse.move(1, 500)
          await page.waitForTimeout(150)
        }
      } catch (e) { hov['汉堡钮'] = { status: 'HOVER_FAILED', err: String(e).slice(0, 200) } }

      // ---- 截图 ----
      if (SHOTS) {
        await page.evaluate('window.scrollTo(0,0)'); await page.waitForTimeout(200)
        const p1 = path.join(SHOTS_DIR, `${PREFIX}-${w}-${theme === 'dark' ? '夜档' : '日档'}.png`)
        await page.screenshot({ path: p1 })
        out.shots.push({ label: `${w}-${theme}`, path: p1 })
        if (label === '1440_day') {
          const ph = path.join(SHOTS_DIR, `${PREFIX}-hover-nav-link-日档.png`)
          const navEl = await page.$('#header .nav-link[href]')
          if (navEl) { await navEl.hover({ timeout: 4000 }); await page.waitForTimeout(250) }
          await page.screenshot({ path: ph, clip: { x: 0, y: 0, width: Math.min(w, 900), height: 90 } })
          out.shots.push({ label: 'hover-nav-link-1440', path: ph })
          const pr = path.join(SHOTS_DIR, `${PREFIX}-hover-登录钮-日档.png`)
          const regEl = await page.$('#header .sf-topbar-hover-brand-fg')
          if (regEl) { await regEl.hover({ timeout: 4000 }); await page.waitForTimeout(250) }
          await page.screenshot({ path: pr, clip: { x: Math.max(0, w - 420), y: 0, width: 420, height: 90 } })
          out.shots.push({ label: 'hover-login-1440', path: pr })
          await page.mouse.move(1, 500)
        }
      }

      // ---- 移动档：汉堡面板展开态 ----
      let panel = null
      if (w <= 767) {
        const btn = await page.$(hamSel)
        if (btn) {
          await btn.click()
          await page.waitForTimeout(300)
          panel = await page.evaluate(`(() => {
            const px = (s) => { const m = String(s||'').match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r:p[0], g:p[1], b:p[2], a: p.length>3?p[3]:1 } }
            const over = (fg, bg) => ({ r: Math.round(fg.r*fg.a+bg.r*(1-fg.a)), g: Math.round(fg.g*fg.a+bg.g*(1-fg.a)), b: Math.round(fg.b*fg.a+bg.b*(1-fg.a)) })
            const eff = (el) => { const ls = []; for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c && c.a>0) { ls.push(c); if (c.a>=1) break } }
              let b = { r:255,g:255,b:255 }; for (let i=ls.length-1;i>=0;i-=1) b = over(ls[i], b); return 'rgb('+b.r+','+b.g+','+b.b+')' }
            const h = document.getElementById('header')
            const ok = (el) => { const c = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0,120), text: (el.textContent||'').trim().slice(0,20), color: c.color, bgSelf: c.backgroundColor, effBg: eff(el), fontSize: c.fontSize, fontWeight: c.fontWeight } }
            const items = [...document.querySelectorAll('#header a, #header button')].filter((el) => el.getClientRects().length > 0 && el.offsetTop > 60).map(ok)
            const panelEl = document.querySelector('[data-sf-m="header-mobile-menu"]')
            return { headerRect: (() => { const r = h.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })(),
              headerBg: getComputedStyle(h).backgroundColor, headerBackdrop: getComputedStyle(h).backdropFilter,
              panelText: px(panelEl ? getComputedStyle(panelEl).color : '') ? 'ok' : 'n/a', items }
          })()`)
          if (SHOTS && label === '390_day') {
            const pp = path.join(SHOTS_DIR, `${PREFIX}-390-日档-汉堡面板展开.png`)
            await page.screenshot({ path: pp })
            out.shots.push({ label: '390-日档-汉堡面板展开', path: pp })
          }
          await btn.click(); await page.waitForTimeout(200)
        }
      }

      // ---- 活动态（.nav-link.active）：命中页 /task 复取 ----
      let active = null
      if (w > 767) {
        await page.goto(ORIGIN + '/task', { waitUntil: 'load' })
        await page.addStyleTag({ content: NOANIM })
        await settle(page)
        active = await page.evaluate(`(() => {
          const el = document.querySelector('#header .nav-link.active')
          const cnt = document.querySelectorAll('#header .nav-link.active').length
          if (!el) return { count: 0, note: '现取在场 0 处' }
          const c = getComputedStyle(el)
          return { count: cnt, text: (el.textContent||'').trim(), color: c.color, bg: c.backgroundColor, fontSize: c.fontSize, fontWeight: c.fontWeight }
        })()`)
        await page.goto(ORIGIN + '/', { waitUntil: 'load' })
        await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 10000 }).catch(() => {})
        await page.addStyleTag({ content: NOANIM }); await settle(page)
      }

      out.states[label] = { ...m, dump, scrolled: { header: scrolled.header, hits: scrolled.hits, elementAt44: hitScrolled }, decoded, hover: hov, panel, active, shotPath: SHOTS ? out.shots.filter((s) => s.label === `${w}-${theme}`).map((s) => s.path)[0] : null }
      await context.close()
      console.log(`OK ${label}`)
    } catch (e) {
      out.errors.push(`${label}: ${String(e).slice(0, 300)}`)
      console.log(`ERR ${label} ${String(e).slice(0, 200)}`)
    }
  }

  // ---- 灵敏度自证（AC-8 两向 + AC-2 反向臂）· 1440 日 / 夜各一臂 --------------------------------
  for (const theme of ['light', 'dark']) {
    const { context, page } = await newPage(browser, 1440, 900, theme)
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 }).catch(() => {})
    await page.addStyleTag({ content: NOANIM })
    await settle(page)
    const read = () => page.evaluate(`(() => { const h = document.getElementById('header'); const c = getComputedStyle(h); return { bg: c.backgroundColor, backdrop: c.backdropFilter, border: c.borderBottomColor, navHoverInjected: null } })()`)
    const arms = { baseline: await read() }
    // 注入臂 1：负控（把 var(--sf-topbar-bg) 换 #FFFFFF）
    const s1 = await page.addStyleTag({ content: ':root:not([data-theme="dark"]) #header{background-color:#FFFFFF}' })
    await settle(page); arms.negControlWhite = await read()
    await s1.evaluate((el) => el.remove()); await settle(page)
    // 注入臂 2：复原（等价于「移除本单规则」：回到改前的 95% 白 + blur）
    const s2 = await page.addStyleTag({ content: ':root:not([data-theme="dark"]) #header{background-color:rgba(255,255,255,0.95);backdrop-filter:blur(4px);border-bottom-color:rgb(229,231,235)}' })
    await settle(page); arms.revertToPreRule = await read()
    await s2.evaluate((el) => el.remove()); await settle(page)
    arms.afterRevertRemoval = await read()
    // 注入臂 3：★ 夜档反向臂 —— 不加日档限定的裸规则（应把夜档压成 rgb(11,12,14)）
    const s3 = await page.addStyleTag({ content: '#header{background-color:var(--sf-topbar-bg)}' })
    await settle(page); arms.noThemeGuard = await read()
    await s3.evaluate((el) => el.remove()); await settle(page)
    arms.finalAfterAll = await read()
    out.selfproof[theme] = arms
    await context.close()
  }

  out.finishedAt = new Date().toISOString()
  out.abortedHosts = [...new Set(out.abortedHosts)]
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
  const summary = Object.fromEntries(Object.entries(out.states).map(([k, v]) => [k, {
    theme: v.theme, hdr: v.header ? { bg: v.header.bg, backdrop: v.header.backdropFilter, border: v.header.borderBottom, rect: v.header.rect } : null,
    regionRect: v.regionTop ? v.regionTop.rect : null, fgCount: v.fgs.length, dumpCount: v.dumpCount,
    pixelRow1: v.decoded && v.decoded.histograms && v.decoded.histograms[0] ? v.decoded.histograms[0].topColors[0] : null,
    hover: Object.fromEntries(Object.entries(v.hover || {}).map(([n, h]) => [n, h.status === 'MEASURED' ? `${h.before && h.before.color} -> ${h.after && h.after.color}` : h.status])),
    active: v.active, panelHeaderRect: v.panel ? v.panel.headerRect : null,
    scrolledHeaderBg: v.scrolled && v.scrolled.header ? v.scrolled.header.bg : null,
    scrolledHit44: v.scrolled ? v.scrolled.elementAt44 : null,
  }]))
  console.log(JSON.stringify({ out: OUT, dist: DIST, distAssets: out.distAssets, states: summary, selfproof: out.selfproof, shots: out.shots.map((s) => s.path), errors: out.errors }, null, 2))
  await browser.close()
}
main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
