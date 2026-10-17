/**
 * Neng 独立质检 v1.21 —— 腿 2：AC-3 前景硬门（**真 hover** = Playwright page.hover()）
 *   + 夜档前景维持现状 + 专项判定①（主题钮走 .nav-link 系）+ 专项判定②（移动面板「登录」胶囊 + 父版同形）
 * 合成像素证据 = Page.captureScreenshot + PNG 回读（区域众数）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const HOSTNAME = 'sf.local'
const CUR_DIST = path.join(REPO, 'frontend/dist')
const PARENT_DIST = '/Users/kevin/.hermes/profiles/zang/cache/scratch/neng-v121/parent/frontend/dist'
const OUT = path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-hover-contrast.json')
const require_ = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require_('playwright')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}
const PRIZES = [
  { bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%，原装盒与充电线齐全', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆封', points: 6600, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: '自用一年 MacBook Air M2 13 英寸 星空色', description: '循环次数 88 次，附原装 35W 双口充电器', points: 3200, stores_count: 0, claims_count: 0, time_end: '2026-12-31' },
]
const TASKS = [{ tID: 1, title: '招募：周末市集摊位布展协助', note: '六日两天 10:00-16:00', is_open: true, points: 10, participants_count: 3 }]
const data = (d) => ({ success: true, data: d })
const apiResponse = (method, p) => {
  if (p === '/api/home') return data({ tasks: TASKS, prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  if (p.startsWith('/api/task/all')) return data(TASKS)
  if (p.startsWith('/api/prize/all')) return data(PRIZES)
  if (p === '/api/prize-item') return data([])
  if (p.startsWith('/api/prize/')) return data(PRIZES.find((x) => String(x.bID) === p.split('/').pop()) || null)
  if (p === '/api/messages/unread-count') return data({ unread_total: 0 })
  if (p === '/api/messages') return data({ threads: [], next_cursor: null, total: 0 })
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}
async function open(browser, { theme, width, height, dist }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== HOSTNAME) return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    const rel = decodeURIComponent(u.pathname); let file = path.join(dist, rel)
    if (!path.resolve(file).startsWith(path.resolve(dist))) return route.fulfill({ status: 403, body: '' })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(dist, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  return { context, page: await context.newPage() }
}
async function settle(page, max = 60) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(`(()=>{const r=document.getElementById('root');return (r?r.innerHTML.length:0)+'|'+document.querySelectorAll('*').length})()`)
    if (sig === prev) return i
    prev = sig
  }
  return -1
}
async function goto(page, url, waitSel) {
  await page.goto(ORIGIN + url, { waitUntil: 'load' }); await settle(page)
  if (waitSel) { try { await page.waitForSelector(waitSel, { timeout: 8000 }) } catch (e) {} }
  await settle(page)
}

// 通用：在给定 sel 上取「base / hover」两态读数（真 hover = page.hover）
const READ = `(sel) => {
  const el = document.querySelector(sel)
  if (!el) return { found: false, sel }
  const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
  return { found: true, sel, cls: String(el.className||''), color: cs.color, backgroundColor: cs.backgroundColor,
    fontSize: cs.fontSize, fontWeight: cs.fontWeight, opacity: cs.opacity,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    isHoverMatched: el.matches(':hover'), text: (el.textContent||'').trim().slice(0,30),
    chainBg: (() => { const out=[]; let n=el; while(n && n.nodeType===1){ const c=getComputedStyle(n); out.push({tag:n.tagName, bg:c.backgroundColor, bgi:c.backgroundImage}); n=n.parentElement } return out })() }
}`

const LUM = (r, g, b) => { const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const parseRgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(',').map((x) => parseFloat(x.trim())); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 } }
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
const ratio = (f, b) => { const l1 = LUM(f.r, f.g, f.b), l2 = LUM(b.r, b.g, b.b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return Math.round(((hi + 0.05) / (lo + 0.05)) * 1000) / 1000 }

let DEC = null
async function decoder(browser) {
  if (DEC) return DEC
  const ctx = await browser.newContext({ viewport: { width: 32, height: 32 } }); const p = await ctx.newPage(); await p.goto('about:blank')
  DEC = { ctx, p }; return DEC
}
async function regionMode(browser, page, rect, name, insetPx = 3) {
  const r = { x: rect.x + insetPx, y: rect.y + insetPx, w: Math.max(2, rect.w - 2 * insetPx), h: Math.max(2, rect.h - 2 * insetPx) }
  const clip = { x: 0, y: 0, width: Math.ceil(Math.max(1, r.x + r.w + 4)), height: Math.ceil(Math.max(1, r.y + r.h + 4)) }
  const box = {
    x: Math.max(0, Math.floor(clip.x)), y: Math.max(0, Math.floor(clip.y)),
    width: Math.max(1, Math.floor(clip.width)), height: Math.max(1, Math.floor(clip.height)),
  }
  const buf = await (async () => {
    try { return await page.screenshot({ clip: box }) } catch (e1) {
      try { await page.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return await page.screenshot({ clip: box }) } catch (e2) { return await page.screenshot({ fullPage: true }) }
    }
  })()
  const shot = { data: buf.toString('base64') }
  const { p } = await decoder(browser)
  const out = await p.evaluate(async ({ b64, r, clip }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const x0 = Math.max(0, Math.round(r.x - clip.x)), y0 = Math.max(0, Math.round(r.y - clip.y))
    const x1 = Math.min(c.width, Math.round(r.x - clip.x + r.w)), y1 = Math.min(c.height, Math.round(r.y - clip.y + r.h))
    if (x1 <= x0 || y1 <= y0) return { error: 'empty' }
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
    const hist = new Map(); let n = 0
    for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]; hist.set(k, (hist.get(k) || 0) + 1); n += 1 }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, cnt]) => { const [rr, gg, bb, aa] = k.split(',').map(Number); return { rgba: k, rgb: `rgb(${rr}, ${gg}, ${bb})`, a: aa / 255, count: cnt, frac: Math.round(cnt / n * 1000) / 1000 } })
    return { box: [x0, y0, x1, y0 + (y1 - y0)], pixels: n, top }
  }, { b64: shot.data, r, clip })
  return out
}

async function measureEl(browser, page, sel, { name, threshold, hover = false, note = '' }) {
  const base = await page.evaluate(`(${READ})(${JSON.stringify(sel)})`)
  if (!base.found) return { name, sel, found: false, note }
  let hoverRes = null, hoverError = null, hoverShot = null
  if (hover) {
    try {
      await page.hover(sel, { timeout: 4000 })
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      hoverRes = await page.evaluate(`(${READ})(${JSON.stringify(sel)})`)
    } catch (e) { hoverError = String(e).slice(0, 200) }
  }
  const elForBg = hoverRes && hoverRes.found ? hoverRes : base
  const bgPix = await regionMode(browser, page, { x: elForBg.rect.x, y: elForBg.rect.y, w: elForBg.rect.w, h: elForBg.rect.h }, name)
  if (hoverRes) { try { hoverShot = await page.screenshot({ clip: { x: Math.max(0, hoverRes.rect.x - 30), y: Math.max(0, hoverRes.rect.y - 10), width: Math.min(1440, hoverRes.rect.w + 60), height: hoverRes.rect.h + 20 } }).then((b) => crypto.createHash('sha256').update(b).digest('hex')) } catch (e) {} }
  const bgPixRGB = bgPix && bgPix.top ? parseRgb(bgPix.top[0].rgb) : null
  const fgBase = parseRgb(base.color)
  const fgHover = hoverRes && hoverRes.found ? parseRgb(hoverRes.color) : null
  const mk = (fg, bg) => {
    if (!fg || !bg) return null
    const eff = fg.a < 1 ? over(fg, bg) : fg
    return { fgDeclared: fg, fgComposited: eff, bgPixel: bg, ratio: ratio(eff, bg), threshold, pass: ratio(eff, bg) >= threshold }
  }
  return {
    name, sel, found: true, note,
    base: { color: base.color, backgroundColor: base.backgroundColor, fontSize: base.fontSize, fontWeight: base.fontWeight, cls: base.cls, rect: base.rect, isHoverMatched: base.isHoverMatched, text: base.text },
    hoverState: hover ? { color: hoverRes && hoverRes.found ? hoverRes.color : null, isHoverMatched: hoverRes && hoverRes.found ? hoverRes.isHoverMatched : null, backgroundColor: hoverRes && hoverRes.found ? hoverRes.backgroundColor : null, hoverError, changedFromBase: !!(hoverRes && hoverRes.found && hoverRes.color !== base.color) } : null,
    bgComposite: bgPix,
    contrastBase: mk(fgBase, bgPixRGB),
    contrastHover: hover ? mk(fgHover, bgPixRGB) : null,
    hoverShotSha: hoverShot,
  }
}

const RESULT = { meta: { curDist: CUR_DIST, parentDist: PARENT_DIST }, light: {}, lightParent: {}, dark: {}, darkParent: {}, darkParentNav: {}, specialThemeButton: {}, specialLoginPill: {}, mobilePanel: {}, mobilePanelParent: {} }
const t0 = Date.now(); const log = (...a) => console.log('[leg2]', ((Date.now() - t0) / 1000).toFixed(1) + 's', ...a)

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] })
try {
  // ---------- 日档（现版 dist）----------
  {
    const { context, page } = await open(browser, { theme: 'light', width: 1440, height: 1000, dist: CUR_DIST })
    await goto(page, '/', '#header')
    const targets = [
      { name: 'logo(20px/700 大字)', sel: '#header a.sf-topbar-brand', threshold: 3, hover: false },
      { name: 'nav-link base', sel: '#header nav a.nav-link:nth-of-type(1)', threshold: 4.5, hover: true },
      { name: 'register btn base/hover', sel: '#header button.sf-topbar-hover-brand-fg:nth-of-type(1)', threshold: 4.5, hover: true },
      { name: 'login btn base/hover', sel: '#header button.sf-topbar-hover-brand-fg:nth-of-type(2)', threshold: 4.5, hover: true },
      { name: 'theme btn (nav-link · 图标)', sel: '#header button.nav-link[title]', threshold: 4.5, hover: true, note: '册 §23.3 第 8 行把它记作汉堡族（自带 hover:bg-gray-100）—— 实为 nav-link 类' },
      { name: 'hamburger (390 才可见 · 桌面档记录)', sel: '[data-sf-m="header-mobile-menu"]', threshold: 4.5, hover: true },
    ]
    for (const t of targets) { RESULT.light[t.name] = await measureEl(browser, page, t.sel, t); log('L', t.name, 'base', RESULT.light[t.name].base && RESULT.light[t.name].base.color, 'hover', RESULT.light[t.name].hoverState && RESULT.light[t.name].hoverState.color, 'hoverMatched', RESULT.light[t.name].hoverState && RESULT.light[t.name].hoverState.isHoverMatched, 'bgPixel', RESULT.light[t.name].bgComposite && RESULT.light[t.name].bgComposite.top[0].rgb, 'ratioBase', RESULT.light[t.name].contrastBase && RESULT.light[t.name].contrastBase.ratio, 'ratioHover', RESULT.light[t.name].contrastHover && RESULT.light[t.name].contrastHover.ratio) }
    // nav-link.active：/task 命中页
    await goto(page, '/task', '#header')
    const act = await page.evaluate(`(${READ})('#header .nav-link.active')`)
    const activeEntry = { name: 'nav-link.active (/task)', found: act.found, base: act.found ? { color: act.color, backgroundColor: act.backgroundColor, cls: act.cls, rect: act.rect, text: act.text } : null }
    if (act.found) {
      const bgPix = await regionMode(browser, page, { x: act.rect.x, y: act.rect.y, w: act.rect.w, h: act.rect.h }, 'active')
      const bg1 = parseRgb(bgPix.top[0].rgb)
      activeEntry.bgComposite = bgPix
      activeEntry.contrast = (() => { const f = parseRgb(act.color); const eff = f.a < 1 ? over(f, bg1) : f; return { fg: act.color, bgPixel: bgPix.top[0].rgb, ratio: ratio(eff, bg1), threshold: 4.5, pass: ratio(eff, bg1) >= 4.5 } })()
      activeEntry.hoverOnActive = await (async () => { try { await page.hover('#header .nav-link.active', { timeout: 4000 }); const h = await page.evaluate(`(${READ})('#header .nav-link.active')`); return { color: h.color, isHoverMatched: h.isHoverMatched, bg: h.backgroundColor } } catch (e) { return { hoverError: String(e).slice(0, 150) } } })()
    }
    RESULT.lightActive = activeEntry
    log('L active', JSON.stringify(activeEntry).slice(0, 600))
    await context.close()
  }

  // ---------- 日档（父版 dist = 4b388d0 worktree build）----------
  {
    const { context, page } = await open(browser, { theme: 'light', width: 1440, height: 1000, dist: PARENT_DIST })
    await goto(page, '/', '#header')
    const targets = [
      { name: 'logo', sel: '#header a.sf-tap-inline', threshold: 3 },
      { name: 'nav-link base', sel: '#header nav a.nav-link:nth-of-type(1)', threshold: 4.5, hover: true },
      { name: 'register btn', sel: '#header button[class*="hover\\\\:text-yellow-600"]', threshold: 4.5, hover: true },
      { name: 'theme btn (nav-link · 图标)', sel: '#header button.nav-link[title]', threshold: 4.5, hover: true },
    ]
    for (const t of targets) { RESULT.lightParent[t.name] = await measureEl(browser, page, t.sel, t); log('LP', t.name, RESULT.lightParent[t.name].found !== false ? [RESULT.lightParent[t.name].base.color, RESULT.lightParent[t.name].hoverState && RESULT.lightParent[t.name].hoverState.color, RESULT.lightParent[t.name].bgComposite.top[0].rgb, RESULT.lightParent[t.name].contrastBase.ratio, RESULT.lightParent[t.name].contrastHover && RESULT.lightParent[t.name].contrastHover.ratio] : 'NOT_FOUND') }
    const hdr = await page.evaluate(`(${READ})('#header')`)
    RESULT.lightParentHeader = { backgroundColor: hdr.backgroundColor, backdropFilter: hdr.backdropFilter, borderBottom: hdr.borderBottomWidth + ' ' + hdr.borderBottomColor, opacity: hdr.opacity }
    await context.close()
  }

  // ---------- 夜档（现版）----------
  {
    const { context, page } = await open(browser, { theme: 'dark', width: 1440, height: 1000, dist: CUR_DIST })
    await goto(page, '/', '#header')
    const targets = [
      { name: 'logo', sel: '#header a.sf-topbar-brand', threshold: 3 },
      { name: 'nav-link base', sel: '#header nav a.nav-link:nth-of-type(1)', threshold: 4.5, hover: true },
      { name: 'orders nav-link', sel: '#header a[data-sf-m="header-orders"]', threshold: 4.5 },
      { name: 'register btn', sel: '#header button.sf-topbar-hover-brand-fg:nth-of-type(1)', threshold: 4.5, hover: true },
      { name: 'login btn', sel: '#header button.sf-topbar-hover-brand-fg:nth-of-type(2)', threshold: 4.5, hover: true },
      { name: 'theme btn (nav-link · 图标)', sel: '#header button.nav-link[title]', threshold: 4.5, hover: true },
    ]
    for (const t of targets) { RESULT.dark[t.name] = await measureEl(browser, page, t.sel, t); const e = RESULT.dark[t.name]; log('D', t.name, e.found !== false ? [e.base.color, e.base.backgroundColor, e.bgComposite.top[0].rgb, e.contrastBase.ratio, e.hoverState && [e.hoverState.color, e.hoverState.isHoverMatched, e.contrastHover && e.contrastHover.ratio]] : 'NOT_FOUND') }
    await context.close()
  }

  // ---------- 夜档（父版）----------
  {
    const { context, page } = await open(browser, { theme: 'dark', width: 1440, height: 1000, dist: PARENT_DIST })
    await goto(page, '/', '#header')
    const targets = [
      { name: 'logo', sel: '#header a.sf-tap-inline', threshold: 3 },
      { name: 'nav-link base', sel: '#header nav a.nav-link:nth-of-type(1)', threshold: 4.5, hover: true },
      { name: 'register btn', sel: '#header button[class*="hover\\\\:text-yellow-600"]', threshold: 4.5 },
      { name: 'theme btn (nav-link · 图标)', sel: '#header button.nav-link[title]', threshold: 4.5, hover: true },
    ]
    for (const t of targets) { RESULT.darkParent[t.name] = await measureEl(browser, page, t.sel, t); const e = RESULT.darkParent[t.name]; log('DP', t.name, e.found !== false ? [e.base.color, e.bgComposite.top[0].rgb, e.contrastBase.ratio, e.hoverState && [e.hoverState.color, e.contrastHover && e.contrastHover.ratio]] : 'NOT_FOUND') }
    await context.close()
  }

  // ---------- 专项②：移动面板「登录 / 注册」胶囊（390 · 现版 + 父版）----------
  for (const [which, dist] of [['cur', CUR_DIST], ['parent', PARENT_DIST]]) {
    const { context, page } = await open(browser, { theme: 'light', width: 390, height: 900, dist })
    await goto(page, '/', '#header')
    await page.click('[data-sf-m="header-mobile-menu"]')
    await settle(page)
    const panelInfo = await page.evaluate(() => {
      const wrap = document.querySelector('#header > div.md\\:hidden') || document.querySelector('#header div.md\\:hidden')
      const cs = wrap ? getComputedStyle(wrap) : null
      return { panelFound: !!wrap, panelBg: cs ? cs.backgroundColor : null, panelOpacity: cs ? cs.opacity : null }
    })
    const pills = {}
    for (const [k, sel] of [['register', '#header button.bg-blue-600'], ['login', '#header button.bg-yellow-600']]) {
      const e = await measureEl(browser, page, sel, { name: 'mobile-' + k, threshold: 4.5, hover: false })
      if (e.found) {
        const bg = parseRgb(e.bgComposite.top[0].rgb)
        const fg = parseRgb(e.base.color)
        const eff = fg.a < 1 ? over(fg, bg) : fg
        e.pill = { whiteTextOnOwnBg: { fg: e.base.color, bgPixel: e.bgComposite.top[0].rgb, ratio: ratio(eff, bg) } }
        // 未合成路径（白字 on 未合成 bg-blue-600/bg-yellow-600）也一并登记（N52 两路并列）
        const declared = parseRgb(e.base.backgroundColor || 'rgba(0,0,0,0)')
        e.pill.uncompositedPath = { declaredBg: e.base.backgroundColor, ratioIfPureWhite: declared ? ratio({ r: 255, g: 255, b: 255, a: 1 }, declared) : null }
      }
      pills[k] = e
    }
    const out = { panel: panelInfo, pills }
    if (which === 'cur') RESULT.mobilePanel = out; else RESULT.mobilePanelParent = out
    log('mobile pill', which, JSON.stringify({ panel: panelInfo, reg: pills.register.pill, login: pills.login.pill }).slice(0, 700))
    await context.close()
  }

  fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 2))
  log('WROTE ' + OUT)
} finally {
  await browser.close()
  if (DEC) await DEC.ctx.close().catch(() => {})
}
