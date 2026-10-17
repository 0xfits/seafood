/**
 * Neng 独立质检 v1.21 —— 腿 2b（补测）：
 *   · 移动档 390 汉堡钮 base/hover（真 page.hover）—— 桌面档不可见 ⇒ 必须单独在 390 测
 *   · 父版「注册 / 登录」hover（腿 2 的 CSS 选择器转义失败 ⇒ 改 :has-text）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const REPO = '/Users/kevin/bistro/seafood'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const CUR_DIST = path.join(REPO, 'frontend/dist')
const PARENT_DIST = '/Users/kevin/.hermes/profiles/zang/cache/scratch/neng-v121/parent/frontend/dist'
const OUT = path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-hover-contrast-b.json')
const require_ = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require_('playwright')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }
const PRIZES = [{ bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' }, { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆封', points: 6600, stores_count: 1, claims_count: 2 }]
async function open(browser, { theme, width, height, dist }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: u.pathname === '/api/home' ? { tasks: [], prizes: PRIZES, claimed_prize_ids: [], user_points: 0 } : u.pathname.startsWith('/api/prize/all') ? PRIZES : { rows: [], next_cursor: null, total: 0 } }) })
    let f = path.join(dist, decodeURIComponent(u.pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory() || !path.extname(f)) f = path.join(dist, 'index.html')
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) })
  })
  return { context, page: await context.newPage() }
}
async function settle(page) { await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); await page.waitForTimeout(150) }
const READ = `(sel) => { const el = document.querySelector(sel); if (!el) return { found:false, sel }; const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
  return { found:true, sel, cls:String(el.className||''), color:cs.color, backgroundColor:cs.backgroundColor, fontSize:cs.fontSize, fontWeight:cs.fontWeight,
  rect:{x:r.x,y:r.y,w:r.width,h:r.height}, isHoverMatched: el.matches(':hover'), text:(el.textContent||'').trim().slice(0,20), visible: el.getClientRects().length>0 } }`
const LUM = (r, g, b) => { const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const parseRgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(',').map((x) => parseFloat(x.trim())); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 } }
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
const ratio = (f, b) => { const l1 = LUM(f.r, f.g, f.b), l2 = LUM(b.r, b.g, b.b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return Math.round(((hi + 0.05) / (lo + 0.05)) * 1000) / 1000 }
let DEC = null
async function decoder(browser) { if (DEC) return DEC; const c = await browser.newContext({ viewport: { width: 32, height: 32 } }); const p = await c.newPage(); await p.goto('about:blank'); DEC = { c, p }; return DEC }
async function bgPixel(browser, page, rect) {
  const r = { x: Math.round(rect.x) + 2, y: Math.round(rect.y) + 2, w: Math.max(2, Math.round(rect.w) - 4), h: Math.max(2, Math.round(rect.h) - 4) }
  const clip = { x: 0, y: 0, width: Math.ceil(r.x + r.w + 2), height: Math.ceil(r.y + r.h + 2) }
  let buf
  try { buf = await page.screenshot({ clip }) } catch (e) { buf = await page.screenshot({ fullPage: true }) }
  const { p } = await decoder(browser)
  return p.evaluate(async ({ b64, r }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(c.width, r.x + r.w), y1 = Math.min(c.height, r.y + r.h)
    if (x1 <= x0 || y1 <= y0) return { error: 'empty' }
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; const hist = new Map(); let n = 0
    for (let i = 0; i < d.length; i += 4) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]; hist.set(k, (hist.get(k) || 0) + 1); n += 1 }
    return { pixels: n, top: [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, cnt]) => { const [rr, gg, bb, aa] = k.split(',').map(Number); return { rgba: k, rgb: `rgb(${rr}, ${gg}, ${bb})`, a: aa / 255, frac: Math.round(cnt / n * 1000) / 1000 } }) }
  }, { b64: buf.toString('base64'), r })
}
async function measureHandle(browser, page, findJs, { name, threshold, hover = false, note = '' }) {
  const h0 = await page.evaluateHandle(findJs)
  const el = h0.asElement()
  if (!el) return { name, sel: findJs, found: false, note }
  const base = await el.evaluate((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight, cls: String(e.className || ''), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, isHoverMatched: e.matches(':hover'), text: (e.textContent || '').trim().slice(0, 20), visible: e.getClientRects().length > 0 } })
  let h = null, err = null
  if (hover) {
    try { await el.hover({ timeout: 4000 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); h = await el.evaluate((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { color: cs.color, backgroundColor: cs.backgroundColor, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, isHoverMatched: e.matches(':hover') } }) } catch (e) { err = String(e).slice(0, 160) }
  }
  const tgt = h || base
  const bgp = await bgPixel(browser, page, tgt.rect)
  const bg = bgp.top ? parseRgb(bgp.top[0].rgb) : null
  const mk = (c) => { const f = parseRgb(c); if (!f || !bg) return null; const eff = f.a < 1 ? over(f, bg) : f; return { color: c, bgPixel: bgp.top[0].rgb, ratio: ratio(eff, bg), threshold, pass: ratio(eff, bg) >= threshold } }
  return { name, findJs, note, found: true, base, hoverState: hover ? { color: h && h.color, isHoverMatched: h && h.isHoverMatched, hoverError: err, changed: !!(h && h.color !== base.color) } : null, bgComposite: bgp, contrastBase: mk(base.color), contrastHover: hover ? mk(h && h.color ? h.color : base.color) : null }
}

async function measure(browser, page, sel, { name, threshold, hover = false, note = '' }) {
  const base = await page.evaluate(`(${READ})(${JSON.stringify(sel)})`)
  if (!base.found) return { name, sel, found: false, note }
  let h = null, err = null
  if (hover) { try { await page.hover(sel, { timeout: 4000 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); h = await page.evaluate(`(${READ})(${JSON.stringify(sel)})`) } catch (e) { err = String(e).slice(0, 160) } }
  const tgt = h && h.found ? h : base
  const bgp = await bgPixel(browser, page, tgt.rect)
  const bg = bgp.top ? parseRgb(bgp.top[0].rgb) : null
  const mk = (c) => { const f = parseRgb(c); if (!f || !bg) return null; const eff = f.a < 1 ? over(f, bg) : f; return { color: c, bgPixel: bgp.top[0].rgb, ratio: ratio(eff, bg), threshold, pass: ratio(eff, bg) >= threshold } }
  return { name, sel, note, found: true, base: { color: base.color, backgroundColor: base.backgroundColor, fontSize: base.fontSize, fontWeight: base.fontWeight, cls: base.cls, rect: base.rect, visible: base.visible, text: base.text }, hoverState: hover ? { color: h && h.found ? h.color : null, isHoverMatched: h && h.found ? h.isHoverMatched : null, backgroundColor: h && h.found ? h.backgroundColor : null, changed: !!(h && h.found && h.color !== base.color), hoverError: err } : null, bgComposite: bgp, contrastBase: mk(base.color), contrastHover: hover ? mk(h && h.found ? h.color : base.color) : null }
}
const R = {}
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] })
try {
  // 移动档 390 日档：汉堡 base/hover + 移动面板项
  {
    const { context, page } = await open(browser, { theme: 'light', width: 390, height: 900, dist: CUR_DIST })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' }); await settle(page); await page.waitForSelector('#header', { timeout: 8000 }).catch(() => {}); await settle(page)
    R.mobileCur = {}
    R.mobileCur.hamburger = await measure(browser, page, '[data-sf-m="header-mobile-menu"]', { name: 'hamburger 390', threshold: 4.5, hover: true })
    console.log('[leg2b] hamburger', JSON.stringify({ base: R.mobileCur.hamburger.base, hover: R.mobileCur.hamburger.hoverState, bg: R.mobileCur.hamburger.bgComposite.top[0], cB: R.mobileCur.hamburger.contrastBase, cH: R.mobileCur.hamburger.contrastHover }))
    await context.close()
  }
  // 父版：注册/登录 hover（ElementHandle 路径 —— CSS 里没有可用的稳定类名）
  for (const [which, dist, theme] of [['parentLight', PARENT_DIST, 'light'], ['parentDark', PARENT_DIST, 'dark']]) {
    const { context, page } = await open(browser, { theme, width: 1440, height: 1000, dist })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' }); await settle(page); await page.waitForSelector('#header', { timeout: 8000 }).catch(() => {}); await settle(page)
    R[which] = {}
    const findReg = `[...document.querySelectorAll('#header button')].find(b => b.textContent.includes('注册'))`
    const findLogin = `[...document.querySelectorAll('#header button')].find(b => b.textContent.includes('登录'))`
    R[which].register = await measureHandle(browser, page, findReg, { name: which + ' 注册', threshold: 4.5, hover: true })
    R[which].login = await measureHandle(browser, page, findLogin, { name: which + ' 登录', threshold: 4.5, hover: true })
    console.log('[leg2b]', which, 'reg', JSON.stringify({ c: R[which].register.base && R[which].register.base.color, h: R[which].register.hoverState, bg: R[which].register.bgComposite && R[which].register.bgComposite.top[0], cB: R[which].register.contrastBase, cH: R[which].register.contrastHover }))
    console.log('[leg2b]', which, 'login', JSON.stringify({ c: R[which].login.base && R[which].login.base.color, h: R[which].login.hoverState, cH: R[which].login.contrastHover }))
    await context.close()
  }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 2)); console.log('[leg2b] WROTE', OUT)
} finally { await browser.close(); if (DEC) await DEC.c.close().catch(() => {}) }
