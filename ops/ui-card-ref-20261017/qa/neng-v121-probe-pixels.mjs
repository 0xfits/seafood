/**
 * Neng（质检员）独立质检 v1.21「顶栏实黄」—— 腿 1：
 *   AC-1 日档顶栏合成像素（PNG 回读） / AC-2 夜档冻结 + 反向臂 / AC-4 不透明不穿透
 *   AC-8 灵敏度两向自证 / AC-10 移动档 + 汉堡面板展开态
 *   + 截图（390/1600 × 日/夜 + hover）
 *
 * 纪律：零 dev server / 零后端 / 零库写（context.route 映射磁盘 dist）；只读 dist；
 *      所有像素证据走 Page.captureScreenshot + PNG 像素回读（**不是**声明值 / 计算值）。
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
const OUT_DIR = path.join(REPO, 'ops/ui-card-ref-20261017/qa')
const SHOT_DIR = path.join(REPO, 'ops/ui-card-ref-20261017/shots')

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

// ---- 夹具：真实感商品文案（Kevin 目视用；不用开发串） ----
const PRIZES = [
  { bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%，原装盒与充电线齐全', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆封', points: 6600, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: '自用一年 MacBook Air M2 13 英寸 星空色', description: '循环次数 88 次，附原装 35W 双口充电器', points: 3200, stores_count: 0, claims_count: 0, time_end: '2026-12-31' },
  { bID: 4, name: '宜家 BEKANT 电动升降桌 160x80 白面', description: '无划痕，自提优先，可代叫货拉拉', points: 1200, stores_count: 2, claims_count: 4 },
  { bID: 5, name: '索尼 WH-1000XM5 头戴式降噪耳机', description: '耳罩无脱皮，附收纳包与 3.5mm 线', points: 900, stores_count: 1, claims_count: 1 },
  { bID: 6, name: '捷安特 ATX860 山地车 27.5 寸 21 速', description: '去年买的，骑行不到 300 公里，定期保养', points: 2600, stores_count: 1, claims_count: 0 },
]
const TASKS = [
  { tID: 1, title: '招募：周末市集摊位布展协助', note: '六日两天 10:00-16:00', is_open: true, points: 10, participants_count: 3 },
  { tID: 2, title: '代取快递并配送至驿站', note: '两小时内完成', is_open: true, points: 5, participants_count: 1 },
]
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

async function open(browser, { theme, width, height, dist = CUR_DIST }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== HOSTNAME) return route.abort()
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    }
    const rel = decodeURIComponent(u.pathname)
    let file = path.join(dist, rel)
    if (!path.resolve(file).startsWith(path.resolve(dist))) return route.fulfill({ status: 403, body: '' })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(dist, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  return { context, page }
}

async function settle(page, max = 90) {
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
async function goto(page, url, waitSel = null) {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (waitSel) { try { await page.waitForSelector(waitSel, { timeout: 10000 }) } catch (e) { /* 调用方记录 */ } }
  await settle(page)
}

// ---------------------------------------------------------------------------
// PNG 像素回读：CDP Page.captureScreenshot → 独立解码页 canvas.getImageData → 直方图
// ---------------------------------------------------------------------------
let DECODER = null
async function decoder(browser) {
  if (DECODER) return DECODER
  const ctx = await browser.newContext({ viewport: { width: 32, height: 32 } })
  const p = await ctx.newPage()
  await p.goto('about:blank')
  DECODER = { ctx, p }
  return DECODER
}

/** 稳健截屏：clip → (失败) 归零滚动重试 → (再失败) fullPage（文档坐标；未滚动时与 clip 同坐标系）*/
async function robustShot(page, box) {
  const info = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, sy: scrollY, sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }))
  try { const buf = await page.screenshot({ clip: box }); return { data: buf.toString('base64'), mode: 'clip', info } } catch (e1) {
    try {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const buf = await page.screenshot({ clip: box }); return { data: buf.toString('base64'), mode: 'clip-scroll0', e1: String(e1).split('\n')[0], info }
    } catch (e2) { const buf = await page.screenshot({ fullPage: true }); return { data: buf.toString('base64'), mode: 'fullPage', e1: String(e1).split('\n')[0], e2: String(e2).split('\n')[0], info } }
  }
}

/** 截屏 → 逐区域直方图（区域坐标 = CSS px，未滚动页面坐标）
 *  ★ 取数路径按 Zang 止损指引：**不用裸 CDP Page.captureScreenshot**（本机报 Invalid parameters），
 *    改 Playwright `page.screenshot`（含 fullPage 兜底）→ 解码页 canvas.getImageData（**仍是合成后像素**）。 */
async function shotHistogram(browser, page, regions, clip) {
  const box = {
    x: Math.max(0, Math.floor(clip.x)), y: Math.max(0, Math.floor(clip.y)),
    width: Math.max(1, Math.floor(clip.width)), height: Math.max(1, Math.floor(clip.height)),
  }
  const shot = await robustShot(page, box)
  const { p } = await decoder(browser)
  const out = await p.evaluate(async ({ b64, regions, clip }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const out = { imageSize: [img.naturalWidth, img.naturalHeight], regions: {} }
    for (const r of regions) {
      const x0 = Math.max(0, Math.round(r.x - clip.x)); const y0 = Math.max(0, Math.round(r.y - clip.y))
      const x1 = Math.min(c.width, Math.round(r.x - clip.x + r.w)); const y1 = Math.min(c.height, Math.round(r.y - clip.y + r.h))
      if (x1 <= x0 || y1 <= y0) { out.regions[r.name] = { error: 'empty-region', box: [x0, y0, x1, y1] }; continue }
      const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      const hist = new Map()
      let n = 0
      for (let i = 0; i < d.length; i += 4) {
        const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]
        hist.set(k, (hist.get(k) || 0) + 1); n += 1
      }
      const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([rgba, count]) => {
          const [r_, g_, b_, a_] = rgba.split(',').map(Number)
          return { rgba, rgb: `rgb(${r_}, ${g_}, ${b_})`, a: a_ / 255, count, frac: Math.round((count / n) * 1000) / 1000 }
        })
      out.regions[r.name] = { box: [x0, y0, x1, y1], pixels: n, top }
    }
    return out
  }, { b64: shot.data, regions, clip })
  return { ...out, captureMode: shot.mode, captureInfo: shot.info, captureErr: shot.e1 || null }
}

// ---------------------------------------------------------------------------
// 元素读数（计算值 —— 与像素回读并列；合成像素才是承重证据）
// ---------------------------------------------------------------------------
const READ_EL = `(sel) => {
  const el = document.querySelector(sel)
  if (!el) return { found: false, sel }
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const chain = []
  let n = el
  while (n && n.nodeType === 1) {
    const c = getComputedStyle(n)
    chain.push({ tag: n.tagName, id: n.id || null, bg: c.backgroundColor, bgi: c.backgroundImage, a: c.opacity })
    n = n.parentElement
  }
  return {
    found: true, sel,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    color: cs.color, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage,
    opacity: cs.opacity, backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
    borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomStyle + ' ' + cs.borderBottomColor,
    borderBottomColor: cs.borderBottomColor, borderBottomWidth: cs.borderBottomWidth,
    fontSize: cs.fontSize, fontWeight: cs.fontWeight,
    text: (el.textContent || '').trim().slice(0, 40),
    cls: String(el.className || ''),
    chain,
  }
}`

const rc = (x, y, w, h) => ({ x, y, w, h })
const inset = (rect, px = 4) => rc(rect.x + px, rect.y + px, Math.max(2, rect.w - 2 * px), Math.max(2, rect.h - 2 * px))

/** 元素的「合成像素」证据：区域直方图众数 */
async function compositeOf(browser, page, rect, name) {
  const region = inset(rect, Math.min(4, Math.max(1, Math.floor(rect.w / 6))))
  const h = await shotHistogram(browser, page, [{ name, ...region }], rc(0, 0, Math.ceil(rect.x + rect.w + 8), Math.ceil(rect.y + rect.h + 8)))
  const r = h.regions[name]
  return { region: r.box, pixels: r.pixels, dominant: r.top[0], top: r.top.slice(0, 3) }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const RESULT = { meta: {}, ac1: {}, ac2: {}, ac4: {}, ac8: {}, ac10: {}, shots: [] }
const t0 = Date.now()
const log = (...a) => console.log('[leg1]', ((Date.now() - t0) / 1000).toFixed(1) + 's', ...a)

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] })
try {
  RESULT.meta = {
    curDist: CUR_DIST, parentDist: PARENT_DIST,
    curAssets: fs.readdirSync(path.join(CUR_DIST, 'assets')).filter((f) => /^index-/.test(f)).sort(),
    parentAssets: fs.readdirSync(path.join(PARENT_DIST, 'assets')).filter((f) => /^index-/.test(f)).sort(),
    viewportHeights: {},
  }
  log('assets', JSON.stringify(RESULT.meta.curAssets), JSON.stringify(RESULT.meta.parentAssets))

  // ===== AC-1 / AC-4：日档顶栏（390 / 1440 / 1600）=======
  for (const w of [390, 1440, 1600]) {
    const h = w === 390 ? 900 : 1000
    const { context, page } = await open(browser, { theme: 'light', width: w, height: h })
    await goto(page, '/', '#header')
    const el = await page.evaluate(`(${READ_EL})('#header')`)
    const headerRect = { x: el.rect.x, y: el.rect.y, w: el.rect.w, h: el.rect.h }
    // 合成像素：整顶栏区域众数 + 顶栏中部单点
    const full = await shotHistogram(browser, page, [
      { name: 'headerFull', ...rc(0, 0, w, el.rect.h) },
      { name: 'headerMidPoint', ...rc(Math.round(w / 2), 30, 4, 4) },
      { name: 'headerLeftNoGlyph', ...rc(4, Math.round(el.rect.h) - 18, 24, 8) },
      { name: 'aboveContent', ...rc(0, Math.round(el.rect.h), w, 2) },
    ], rc(0, 0, w, h))
    const elThemeBtn = await page.evaluate(`(${READ_EL})('#header button.nav-link[title]')`)
    const scroll = await page.evaluate(() => ({ scrollY: window.scrollY }))
    // AC-4②：滚动复读
    await page.evaluate(() => window.scrollTo(0, 400))
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const afterScroll = await page.evaluate(`(${READ_EL})('#header')`)
    const shotScrolled = await robustShot(page, { x: 0, y: 0, width: w, height: 40 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    // AC-4③：真点法 elementFromPoint
    const efp = await page.evaluate(() => {
      const el = document.getElementById('header')
      const r = el.getBoundingClientRect()
      const pts = [[Math.round(r.width / 2), Math.round(r.height / 2)], [10, 10], [Math.round(r.width) - 10, Math.round(r.height / 2)]]
      return pts.map(([x, y]) => {
        const hit = document.elementFromPoint(x, y)
        return { pt: [x, y], hit: hit ? hit.tagName + (hit.id ? '#' + hit.id : '') + '.' + String(hit.className || '').split(' ').slice(0, 3).join('.') : null, insideHeader: hit ? !!hit.closest('#header') : false, tag: hit ? hit.tagName : null }
      })
    })
    RESULT.ac1['w' + w] = {
      header: { backgroundColor: el.backgroundColor, color: el.color, opacity: el.opacity, backdropFilter: el.backdropFilter, borderBottom: el.borderBottom, borderBottomColor: el.borderBottomColor, borderBottomWidth: el.borderBottomWidth, backgroundImage: el.backgroundImage, rect: el.rect },
      compositeHeaderFull: full.regions.headerFull,
      compositeMidPoint: full.regions.headerMidPoint,
      compositeLeftNoGlyph: full.regions.headerLeftNoGlyph,
      regionBelowHeader: full.regions.aboveContent,
      themeButton: { cls: elThemeBtn.cls, color: elThemeBtn.color, rect: elThemeBtn.rect },
      scrollY: scroll.scrollY,
    }
    RESULT.ac4['w' + w] = {
      afterScroll: { backgroundColor: afterScroll.backgroundColor, backdropFilter: afterScroll.backdropFilter, rect: afterScroll.rect, opacity: afterScroll.opacity },
      scrolledShotSha: crypto.createHash('sha256').update(shotScrolled.data, 'base64').digest('hex'),
      scrolledShotMode: shotScrolled.mode,
      elementFromPoint: efp,
      allInsideHeader: efp.every((e) => e.insideHeader),
    }
    log('AC-1/4 w' + w, el.backgroundColor, el.opacity, el.backdropFilter, el.borderBottomColor, '| composite', full.regions.headerFull.top[0].rgb, 'a=' + full.regions.headerFull.top[0].a, '| efp ok', RESULT.ac4['w' + w].allInsideHeader)
    await context.close()
  }

  // ===== AC-2：夜档冻结（390/1440/1600）+ 反向臂 =====
  for (const w of [390, 1440, 1600]) {
    const h = w === 390 ? 900 : 1000
    const { context, page } = await open(browser, { theme: 'dark', width: w, height: h })
    await goto(page, '/', '#header')
    const el = await page.evaluate(`(${READ_EL})('#header')`)
    const full = await shotHistogram(browser, page, [{ name: 'headerFull', ...rc(0, 0, w, el.rect.h) }], rc(0, 0, w, h))
    const elThemeBtn = await page.evaluate(`(${READ_EL})('#header button.nav-link[title]')`)
    // ★ 反向臂：**测量期注入**「去掉日档限定」的等价规则 ⇒ 夜档必须被压成 rgb(11,12,14)
    const tag = await page.addStyleTag({ content: '#header{background-color:var(--sf-topbar-bg) !important}' })
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const rev = await page.evaluate(`(${READ_EL})('#header')`)
    const revPix = await shotHistogram(browser, page, [{ name: 'headerFull', ...rc(0, 0, w, el.rect.h) }], rc(0, 0, w, h))
    const injectedPresent = await page.evaluate(() => [...document.querySelectorAll('style')].some((s) => s.textContent.includes('!important')))
    await page.evaluate((t) => { document.querySelectorAll('style').forEach((s) => { if (s.textContent === t || s.textContent.includes('var(--sf-topbar-bg) !important')) s.remove() }) }, 'x')
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const restored = await page.evaluate(`(${READ_EL})('#header')`)
    RESULT.ac2['w' + w] = {
      header: { backgroundColor: el.backgroundColor, opacity: el.opacity, backdropFilter: el.backdropFilter, borderBottom: el.borderBottom, borderBottomWidth: el.borderBottomWidth, backgroundImage: el.backgroundImage, rect: el.rect },
      compositeHeaderFull: full.regions.headerFull,
      themeButton: { cls: elThemeBtn.cls, color: elThemeBtn.color },
      reverseArm: {
        injectedRule: '#header{background-color:var(--sf-topbar-bg) !important}',
        injectedPresent,
        afterInject: { backgroundColor: rev.backgroundColor, backgroundImage: rev.backgroundImage },
        afterInjectComposite: revPix.regions.headerFull.top[0],
        afterRemove: { backgroundColor: restored.backgroundColor },
        redWhenUnqualified: rev.backgroundColor !== el.backgroundColor,
      },
    }
    log('AC-2 w' + w, el.backgroundColor, el.backdropFilter, el.borderBottom, '| reverse arm:', el.backgroundColor, '=>', rev.backgroundColor, 'composite', revPix.regions.headerFull.top[0].rgb, '| restore', restored.backgroundColor)
    await context.close()
  }

  // ===== AC-8：灵敏度两向自证（日档 · 1440）=====
  {
    const { context, page } = await open(browser, { theme: 'light', width: 1440, height: 1000 })
    await goto(page, '/', '#header')
    const base = await page.evaluate(`(${READ_EL})('#header')`)
    const basePix = await shotHistogram(browser, page, [{ name: 'header', ...rc(0, 0, 1440, base.rect.h) }], rc(0, 0, 1440, 1000))
    // 负控臂
    await page.addStyleTag({ content: '#header{background-color:#FFFFFF !important;background-image:none !important;backdrop-filter:none !important}' })
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const negEl = await page.evaluate(`(${READ_EL})('#header')`)
    const negPix = await shotHistogram(browser, page, [{ name: 'header', ...rc(0, 0, 1440, negEl.rect.h) }], rc(0, 0, 1440, 1000))
    // 复原臂
    await page.evaluate(() => { document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('#FFFFFF !important')) s.remove() }) })
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const backEl = await page.evaluate(`(${READ_EL})('#header')`)
    const backPix = await shotHistogram(browser, page, [{ name: 'header', ...rc(0, 0, 1440, backEl.rect.h) }], rc(0, 0, 1440, 1000))
    RESULT.ac8 = {
      base: { computed: base.backgroundColor, composite: basePix.regions.header.top[0] },
      negativeControl: { rule: '#header{background-color:#FFFFFF !important}', computed: negEl.backgroundColor, composite: negPix.regions.header.top[0], turnedRed: negEl.backgroundColor === 'rgb(255, 255, 255)' },
      restore: { computed: backEl.backgroundColor, composite: backPix.regions.header.top[0], backToBaseline: backEl.backgroundColor === base.backgroundColor && backPix.regions.header.top[0].rgba === basePix.regions.header.top[0].rgba },
      pixelSensitivity: negPix.regions.header.top[0].rgba !== basePix.regions.header.top[0].rgba,
    }
    log('AC-8', JSON.stringify(RESULT.ac8))
    await context.close()
  }

  // ===== AC-10：移动档 390 / 375 / 320 + 汉堡面板展开态 =====
  for (const w of [390, 375, 320]) {
    const { context, page } = await open(browser, { theme: 'light', width: w, height: 900 })
    await goto(page, '/', '#header')
    const el = await page.evaluate(`(${READ_EL})('#header')`)
    const pix = await shotHistogram(browser, page, [{ name: 'headerFull', ...rc(0, 0, w, el.rect.h) }], rc(0, 0, w, 900))
    const entry = { header: { backgroundColor: el.backgroundColor, opacity: el.opacity, backdropFilter: el.backdropFilter, rect: el.rect }, composite: pix.regions.headerFull.top[0] }
    if (w === 390) {
      // 汉堡面板展开
      await page.click('[data-sf-m="header-mobile-menu"]')
      await settle(page)
      const openEl = await page.evaluate(`(${READ_EL})('#header')`)
      const panelSel = {
        panelWrap: '#header > div.md\\:hidden',
        regPill: '#header button.bg-blue-600',
        loginPill: '#header button.bg-yellow-600',
        langLabel: '#header .text-sm.font-medium',
      }
      entry.openState = { headerRect: openEl.rect, headerBg: openEl.backgroundColor }
      for (const [k, s] of Object.entries(panelSel)) {
        const e = await page.evaluate(`(${READ_EL})(${JSON.stringify(s)})`)
        if (!e.found) { entry.openState[k] = { found: false }; continue }
        const comp = await compositeOf(browser, page, { x: e.rect.x, y: e.rect.y, w: e.rect.w, h: e.rect.h }, k)
        entry.openState[k] = { found: true, sel: s, color: e.color, backgroundColor: e.backgroundColor, fontSize: e.fontSize, fontWeight: e.fontWeight, rect: e.rect, text: e.text, composite: comp.dominant }
      }
      log('AC-10 390 panel', JSON.stringify(entry.openState).slice(0, 900))
    }
    RESULT.ac10['w' + w] = entry
    log('AC-10 w' + w, el.backgroundColor, el.opacity, 'composite', pix.regions.headerFull.top[0].rgb, 'a=' + pix.regions.headerFull.top[0].a)
    await context.close()
  }

  fs.writeFileSync(path.join(OUT_DIR, 'neng-v121-pixels.json'), JSON.stringify(RESULT, null, 2))
  log('WROTE neng-v121-pixels.json')
} finally {
  await browser.close()
  if (DECODER) await DECODER.ctx.close().catch(() => {})
}
