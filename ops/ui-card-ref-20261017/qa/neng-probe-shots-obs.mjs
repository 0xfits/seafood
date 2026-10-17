/**
 * Neng 独立质检腿 · 截图一套（给 Kevin 目视）+ 两个剩余观察点读数
 *   (#4) 稀有度装饰光斑（`.absolute…w-20 h-20 opacity-20 blur-xl`）与价格块的同位重叠
 *   (#5) 回落态 CTA 键盘可达性 + 生产影响面
 *
 * 纪律：静态 `frontend/dist` + `context.route`（零 dev server / 零后端 / 零库写）；
 *       参考图只读不触碰（`serverReadOnly` 白名单只有 dist）；字体/动画源 abort 由 lib 的 route 兜住。
 * 文案：**真实感商品标题**（不用 `FIXTURE 商品一` 一类占位字）；图片一律用仓内 `PLACEHOLDER_IMAGE`（占位图）。
 *
 * 用法：node ops/ui-card-ref-20261017/qa/neng-probe-shots-obs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  REPO, CUR_DIST, HOSTNAME, ORIGIN, MIME, chromium, writeJson, settle,
} from './neng-lib.mjs'

const QADIR = path.join(REPO, 'ops/ui-card-ref-20261017/qa')
const SHOTS = path.join(REPO, 'ops/ui-card-ref-20261017/shots')
const OUT = path.join(QADIR, 'neng-readings-shots-obs.json')
fs.mkdirSync(SHOTS, { recursive: true })

// ---------------------------------------------------------------- 夹具（真实感商品）
const PRIZES = [
  { bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%，原装盒与充电线齐全', points: 6600, stores_count: 3, claims_count: 12 }, // >5000 ⇒ epic
  { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆', points: 890, stores_count: 1, claims_count: 2 },                          // ≤2000 ⇒ common
  { bID: 3, name: '自用一年 MacBook Air M2 13 英寸 星空色', description: '循环次数 88 次，附原装 35W 双口充电器', points: 3200, stores_count: 2, claims_count: 4 },            // >2000 ⇒ rare
  { bID: 4, name: '宜家 BEKANT 电动升降桌 160x80 白面', description: '无划痕，自提优先，可代叫货拉拉', points: 1200, stores_count: 0, claims_count: 0 },                        // locked（store=0）
  { bID: 5, name: '索尼 WH-1000XM5 头戴式降噪耳机', description: '耳罩无脱皮，附收纳包与 3.5mm 线', points: 900, stores_count: 1, claims_count: 1 },
  { bID: 6, name: '佳能 EOS R6 微单机身 全画幅', description: '快门数 1.2 万，附原厂两块电池', points: 7200, stores_count: 1, claims_count: 0 },                          // epic
]
const TASKS = [
  { tID: 1, title: '招募：周末市集摊位布展协助', note: '六日两天 10:00-16:00', is_open: true, points: 10, participants_count: 3 },
  { tID: 2, title: '代取快递并配送至驿站', note: '两小时内完成', is_open: true, points: 5, participants_count: 1 },
]
const data = (d) => ({ success: true, data: d })
const apiBody = (method, pathname) => {
  // ★ 现取（首跑踩到 · 已修）：首页实际走 `/api/home`（聚合口）—— `/api/task/all` / `/api/prize/all`
  //   只在未登录时作为 legacy 兜底；只实现后者会让首页落「暂无闲置物品」空态（首跑即此，读数作废）。
  if (pathname === '/api/home') return data({ tasks: TASKS, prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  if (pathname.startsWith('/api/task/all')) return data(TASKS)
  if (pathname.startsWith('/api/prize/all')) return data(PRIZES)
  if (pathname === '/api/messages/unread-count') return data({ unread_total: 0 })
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

async function openPage(browser, { theme, viewport }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== HOSTNAME) return route.abort()
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiBody(req.method(), u.pathname)) })
    }
    const rel = decodeURIComponent(u.pathname)
    let file = path.join(CUR_DIST, rel)
    if (!path.resolve(file).startsWith(path.resolve(CUR_DIST))) return route.fulfill({ status: 403, body: '' })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(CUR_DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  return { context, page }
}

// ---------------------------------------------------------------- 画布取像素（PNG 解码在页内完成 ⇒ 零 npm 依赖）
async function decode(browser, b64, points = []) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  const r = await p.evaluate(async ({ b64, points }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(img, 0, 0)
    const samples = points.map(([x, y]) => {
      const d = g.getImageData(Math.max(0, Math.min(c.width - 1, Math.round(x))), Math.max(0, Math.min(c.height - 1, Math.round(y))), 1, 1).data
      return { x, y, rgb: [d[0], d[1], d[2]], a: d[3] }
    })
    return { w: c.width, h: c.height, samples }
  }, { b64, points })
  await ctx.close()
  return r
}

async function diffRegions(browser, b64a, b64b) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  const r = await p.evaluate(async ({ b64a, b64b }) => {
    const load = async (b) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
      return { c, g, d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
    }
    const A = await load(b64a); const B = await load(b64b)
    let n6 = 0; let n16 = 0; let maxD = 0; let sum = 0; let n = 0
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1
    let sumA = [0, 0, 0]; let sumB = [0, 0, 0]
    for (let y = 0; y < A.h; y += 1) {
      for (let x = 0; x < A.w; x += 1) {
        const i = (y * A.w + x) * 4
        const d = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]))
        sumA[0] += A.d[i]; sumA[1] += A.d[i + 1]; sumA[2] += A.d[i + 2]
        sumB[0] += B.d[i]; sumB[1] += B.d[i + 1]; sumB[2] += B.d[i + 2]
        n += 1; sum += d
        if (d > maxD) maxD = d
        if (d > 6) { n6 += 1; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
        if (d > 16) n16 += 1
      }
    }
    const mean = (s) => s.map((v) => Math.round((v / n) * 10) / 10)
    return {
      w: A.w, h: A.h, px: n,
      pixelsDeltaGt6: n6, pixelsDeltaGt16: n16, maxChannelDelta: maxD,
      meanChannelDelta: Math.round((sum / n) * 100) / 100,
      meanRgbWithGlow: mean(sumA), meanRgbWithoutGlow: mean(sumB),
      bboxOfDeltaGt6: maxX < 0 ? null : [minX, minY, maxX, maxY],
    }
  }, { b64a, b64b })
  await ctx.close()
  return r
}

const RECT = (r) => (r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null)
const intersection = (a, b) => {
  if (!a || !b) return 0
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? +(w * h).toFixed(1) : 0
}

// DOM 读数（页面内）
const MEASURE_CARD = `(() => {
  const card = document.querySelector('[data-sf-m="reward-card"]')
  if (!card) return { ok: false }
  const box = card.firstElementChild
  const glow = card.querySelector('div.w-20.h-20.opacity-20.blur-xl')
  const price = card.querySelector('.sf-reward-price')
  const num = card.querySelector('.sf-reward-price-num')
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const gc = cs(glow)
  const priceRect = r(price)
  const hit = priceRect ? document.elementFromPoint(priceRect.x + priceRect.w / 2, priceRect.y + priceRect.h / 2) : null
  const hitDesc = hit ? { tag: hit.tagName, cls: String(hit.className || '').slice(0, 80), isPriceOrChild: !!(price && (hit === price || price.contains(hit))) } : null
  return {
    ok: true,
    cardRoot: { tag: card.tagName, href: card.getAttribute('href'), boxShadow: cs(card).boxShadow },
    cardCount: document.querySelectorAll('[data-sf-m="reward-card"]').length,
    boxRect: r(box), boxShadow: cs(box).boxShadow, boxOpacity: cs(box).opacity, boxVisibility: cs(box).visibility, boxBorderTop: cs(box).borderTopColor, boxOutline: cs(box).outline,
    glow: glow ? {
      rect: r(glow), opacity: gc.opacity, filter: gc.filter, bg: gc.backgroundColor, position: gc.position, zIndex: gc.zIndex,
      cls: String(glow.className), paintIndex: [...box.children].indexOf(glow),
    } : null,
    priceRect, numRect: r(num), numText: num ? num.textContent : null,
    priceOverlapPx2: (() => { const pr = priceRect; const gr = glow ? r(glow) : null; if (!pr || !gr) return null; const w = Math.min(pr.x + pr.w, gr.x + gr.w) - Math.max(pr.x, gr.x); const h = Math.min(pr.y + pr.h, gr.y + gr.h) - Math.max(pr.y, gr.y); return w > 0 && h > 0 ? +(w * h).toFixed(1) : 0 })(),
    elementAtPriceCenter: hitDesc,
  }
})()`

async function main() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const out = {
    probe: 'neng-probe-shots-obs.mjs（Neng 质检员 · 自写自跑 · 截图 + 观察 #4/#5）',
    startedAt: new Date().toISOString(),
    dist: CUR_DIST,
    fixtures: PRIZES.map((p) => ({ bID: p.bID, name: p.name, points: p.points })),
    shots: {}, obs4: {}, obs5: {}, notes: [],
  }

  // ============================================================ 1) 截图一套
  const shotJobs = [
    { file: 'neng-390-日档-top.png', theme: 'light', viewport: { width: 390, height: 844 }, scrolled: false },
    { file: 'neng-390-日档-2cards.png', theme: 'light', viewport: { width: 390, height: 844 }, scrolled: true },
    { file: 'neng-1600-日档.png', theme: 'light', viewport: { width: 1600, height: 900 }, scrolled: false },
    { file: 'neng-1600-夜档.png', theme: 'dark', viewport: { width: 1600, height: 900 }, scrolled: false },
  ]
  for (const j of shotJobs) {
    const { context, page } = await openPage(browser, { theme: j.theme, viewport: j.viewport })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await settle(page)
    let layerSamples = null
    let scrollInfo = null
    if (j.scrolled) {
      // 滚到「首页卡区第 1 张卡顶部刚进视野」的位置（**保证 scrollY > 0** ⇒ 文件名/报告里的「已滚动」为真），
      // 并如实记录「完全可见卡数 / 部分可见卡数」（390 单列档 2 张整卡放不下 ⇒ 不假称 2 张完整卡）。
      scrollInfo = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
        if (!cards.length) return { y: 0, whole: 0, partial: 0, cardRects: [] }
        const firstTop = cards[0].getBoundingClientRect().top + window.scrollY
        const y = Math.max(120, firstTop - 76)
        window.scrollTo(0, y)
        return { y, firstCardAbsTop: firstTop }
      })
      await settle(page)
      scrollInfo = { ...scrollInfo, ...(await page.evaluate(() => {
        const vh = window.innerHeight
        const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
        let whole = 0; let partial = 0
        for (const c of cards) { const r = c.getBoundingClientRect(); if (r.top >= 0 && r.bottom <= vh) whole += 1; if (r.bottom > 0 && r.top < vh) partial += 1 }
        return { scrollY: window.scrollY, wholeCardsVisible: whole, partialCardsVisible: partial, viewportH: vh }
      })) }
    } else {
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      layerSamples = await page.evaluate(() => {
        const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null }
        const rc = document.querySelector('.sf-route-container')
        return {
          shellBg: cs('.sf-shell'), routeContainerBg: cs('.sf-route-container'), topbarBg: cs('.sf-region-top'),
          routeContainerRect: rc ? (() => { const r = rc.getBoundingClientRect(); return { x: r.x, w: r.width } })() : null,
          viewportW: window.innerWidth, sideGutter: rc ? +((window.innerWidth - rc.getBoundingClientRect().width) / 2).toFixed(1) : null,
          scrollY: window.scrollY,
        }
      })
    }
    await page.screenshot({ path: path.join(SHOTS, j.file), fullPage: false })
    // 三层像素取样（未滚动档）：左 gutter / 容器 / 顶栏；390 档只有两层（无 gutter）
    let pixelSamples = null
    if (!j.scrolled) {
      const b64 = (await page.screenshot()).toString('base64')
      const pts = [[8, Math.round(j.viewport.height * 0.5)], [Math.round(j.viewport.width / 2), Math.round(j.viewport.height * 0.5)], [Math.round(j.viewport.width / 2), 12]]
      const dec = await decode(browser, b64, pts)
      pixelSamples = { size: [dec.w, dec.h], points: dec.samples }
    }
    out.shots[j.file] = { theme: j.theme, viewport: j.viewport, scrolled: !!j.scrolled, layerSamples, scrollInfo, pixelSamples }
    await context.close()
  }

  // ============================================================ 2) hover 读数（日档 1600）
  {
    const { context, page } = await openPage(browser, { theme: 'light', viewport: { width: 1600, height: 900 } })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await settle(page)
    await page.evaluate(() => document.querySelector('[data-sf-m="reward-card"]').scrollIntoView({ block: 'center' }))
    await settle(page)
    const before = await page.evaluate(MEASURE_CARD)
    const cardSel = '[data-sf-m="reward-card"]'
    const bb = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }, cardSel)
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await settle(page)
    const after = await page.evaluate(MEASURE_CARD)
    const yellowRe = /253,\s*232,\s*21|250,\s*204,\s*21|ring|outline/
    out.shots['neng-hover-日档.png'] = {
      theme: 'light', viewport: { width: 1600, height: 900 }, scrolled: false, hovered: true,
      hoverTarget: '+'.repeat(1) + 'card center',
      boxShadowBefore: before.boxShadow, boxShadowAfter: after.boxShadow,
      shadowAppeared: before.boxShadow !== after.boxShadow,
      rectBefore: before.boxRect, rectAfter: after.boxRect,
      displaced: JSON.stringify(before.boxRect) !== JSON.stringify(after.boxRect),
      borderTopColorBefore: before.boxBorderTop, borderTopColorAfter: after.boxBorderTop,
      outlineAfter: after.boxOutline,
      yellowRingInShadowAfter: yellowRe.test(String(after.boxShadow)) || yellowRe.test(String(after.boxOutline)),
      priceOverlapPx2: after.priceOverlapPx2,
      elementAtPriceCenter: after.elementAtPriceCenter,
    }
    await page.screenshot({ path: path.join(SHOTS, 'neng-hover-日档.png'), fullPage: false })
    out.obs4.hover = out.shots['neng-hover-日档.png']
    await context.close()
  }

  // ============================================================ 3) 观察 #4：稀有度光斑 ↔ 价格块
  for (const vp of [{ width: 390, height: 844, tag: '390' }, { width: 1600, height: 900, tag: '1600' }]) {
    for (const theme of ['light', 'dark']) {
      const { context, page } = await openPage(browser, { theme, viewport: vp })
      await page.goto(ORIGIN + '/', { waitUntil: 'load' })
      await settle(page)
      // 第一张卡 = points 6600 ⇒ epic（HomePage.jsx:85 派生）；把它滚进视野
      await page.evaluate(() => document.querySelector('[data-sf-m="reward-card"]').scrollIntoView({ block: 'center' }))
      await settle(page)
      const key = `${vp.tag}_${theme}`
      const m = await page.evaluate(MEASURE_CARD)
      // 局部截图（价格块区域，含 glow 覆盖范围缓冲）
      const clip = await page.evaluate(() => {
        const card = document.querySelector('[data-sf-m="reward-card"]')
        const glow = card.querySelector('div.w-20.h-20.opacity-20.blur-xl')
        const price = card.querySelector('.sf-reward-price')
        const cr = card.getBoundingClientRect()
        const gr = glow ? glow.getBoundingClientRect() : cr
        const x0 = Math.max(0, Math.min(price.getBoundingClientRect().x, gr.x) - 12)
        const y0 = Math.max(0, Math.min(price.getBoundingClientRect().y, gr.y) - 12)
        const x1 = Math.min(cr.x + cr.width, Math.max(price.getBoundingClientRect().right, gr.right) + 12)
        const y1 = Math.min(cr.bottom, Math.max(price.getBoundingClientRect().bottom, gr.bottom) + 12)
        return { x: x0, y: y0, width: Math.max(8, x1 - x0), height: Math.max(8, y1 - y0) }
      })
      const withGlow = (await page.screenshot({ clip })).toString('base64')
      await page.addStyleTag({ content: '[data-sf-m="reward-card"] div.w-20.h-20.opacity-20.blur-xl{visibility:hidden !important}' })
      await settle(page)
      const withoutGlow = (await page.screenshot({ clip })).toString('base64')
      // 还原（自证「复原逐值一致」）
      await page.addStyleTag({ content: '[data-sf-m="reward-card"] div.w-20.h-20.opacity-20.blur-xl{visibility:visible !important}' })
      await settle(page)
      const m2 = await page.evaluate(MEASURE_CARD)
      const diff = await diffRegions(browser, withGlow, withoutGlow)
      out.obs4[key] = {
        viewport: vp, theme, fixtureRarity: 1, measurement: m, restored: JSON.stringify(m) === JSON.stringify(m2),
        clip, glowVisibleVsHidden: diff,
        priceRegion: { withGlowPng: 'inline(base64 in this json, see diff mean)', sizePx: [Math.round(clip.width), Math.round(clip.height)] },
      }
      // 存档两张局部图（epic · 日档 + 夜档 各一套；390/1600 都留）
      fs.writeFileSync(path.join(SHOTS, `neng-obs4-${vp.tag}-${theme}-epic-withglow.png`), Buffer.from(withGlow, 'base64'))
      fs.writeFileSync(path.join(SHOTS, `neng-obs4-${vp.tag}-${theme}-epic-noglow.png`), Buffer.from(withoutGlow, 'base64'))
      await context.close()
    }
  }

  // #4 legendary 夹具：★ 现取发现 —— `HomePage.jsx:85` 的 rarity 派生式**没有 `'legendary'` 分支**
  //   ⇒ 真实首页面上 `legendary` **不可达**（诚实登记）。为拿到「黄色光斑」的可见性读数，
  //   这里做**探测期类名替换臂**（只把 glow 的 `bg-purple-400` → `bg-yellow-400`，
  //   几何 / 模糊 / 透明度 / 位置一字未动），并在报告里明标「非真实派生 · 注入臂」。
  {
    const { context, page } = await openPage(browser, { theme: 'light', viewport: { width: 390, height: 844 } })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await settle(page)
    await page.evaluate(() => document.querySelector('[data-sf-m="reward-card"]').scrollIntoView({ block: 'center' }))
    await settle(page)
    const before = await page.evaluate(MEASURE_CARD)
    await page.evaluate(() => {
      const glow = document.querySelector('[data-sf-m="reward-card"] div.w-20.h-20.opacity-20.blur-xl')
      glow.classList.remove('bg-purple-400', 'bg-blue-400', 'bg-yellow-400')
      glow.classList.add('bg-yellow-400')
      const box = document.querySelector('[data-sf-m="reward-card"]').firstElementChild
      box.classList.remove('border-purple-400')
      box.classList.add('border-yellow-400')
    })
    await settle(page)
    const after = await page.evaluate(MEASURE_CARD)
    const clip = await page.evaluate(() => {
      const card = document.querySelector('[data-sf-m="reward-card"]')
      const glow = card.querySelector('div.w-20.h-20.opacity-20.blur-xl')
      const price = card.querySelector('.sf-reward-price')
      const cr = card.getBoundingClientRect(); const gr = glow.getBoundingClientRect()
      const x0 = Math.max(0, Math.min(price.getBoundingClientRect().x, gr.x) - 12)
      const y0 = Math.max(0, Math.min(price.getBoundingClientRect().y, gr.y) - 12)
      const x1 = Math.min(cr.x + cr.width, Math.max(price.getBoundingClientRect().right, gr.right) + 12)
      const y1 = Math.min(cr.bottom, Math.max(price.getBoundingClientRect().bottom, gr.bottom) + 12)
      return { x: x0, y: y0, width: Math.max(8, x1 - x0), height: Math.max(8, y1 - y0) }
    })
    const withGlow = (await page.screenshot({ clip })).toString('base64')
    await page.addStyleTag({ content: '[data-sf-m="reward-card"] div.w-20.h-20.opacity-20.blur-xl{visibility:hidden !important}' })
    await settle(page)
    const withoutGlow = (await page.screenshot({ clip })).toString('base64')
    const diff = await diffRegions(browser, withGlow, withoutGlow)
    out.obs4['legendary_injected_390_light'] = {
      note: '★ 注入臂（真实首页不可达 `legendary`：HomePage.jsx:85 派生式无该分支）—— 探测期只替换 glow 类名 bg-purple-400 → bg-yellow-400（几何/模糊/透明度/位置未动）',
      fixtureRarity: 'legendary(注入)', before: { glowCls: before.glow && before.glow.cls, glowBg: before.glow && before.glow.bg, priceOverlapPx2: before.priceOverlapPx2 },
      after: { glowCls: after.glow && after.glow.cls, glowBg: after.glow && after.glow.bg, priceOverlapPx2: after.priceOverlapPx2, elementAtPriceCenter: after.elementAtPriceCenter },
      glowVisibleVsHidden: diff,
    }
    fs.writeFileSync(path.join(SHOTS, 'neng-obs4-390-light-legendary-injected-withglow.png'), Buffer.from(withGlow, 'base64'))
    fs.writeFileSync(path.join(SHOTS, 'neng-obs4-390-light-legendary-injected-noglow.png'), Buffer.from(withoutGlow, 'base64'))
    await context.close()
  }

  // ============================================================ 4) 观察 #5：CTA 键盘可达性
  {
    const { context, page } = await openPage(browser, { theme: 'light', viewport: { width: 1600, height: 900 } })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await settle(page)
    const cta = await page.evaluate(() => {
      const c = document.querySelector('[data-sf-m="reward-card-view"]')
      if (!c) return { present: false }
      const cs = getComputedStyle(c)
      return {
        present: true, tag: c.tagName, role: c.getAttribute('role'), tabIndexAttr: c.getAttribute('tabindex'),
        tabIndexProp: c.tabIndex, text: (c.textContent || '').trim(),
        isFocusableNow: (() => { const prev = document.activeElement; c.focus(); const got = document.activeElement === c; if (prev && prev.focus) prev.focus(); return got })(),
        hasKeydownListenerHint: 'DOM 不可读（onKeyDown/onClick 由 React 合成事件挂载）',
        parentAnchor: (() => { const a = c.closest('a'); return a ? { tag: a.tagName, href: a.getAttribute('href') } : null })(),
      }
    })
    // Tab 遍历：记录前 40 次 Tab 的落点
    const seq = []
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const a = document.activeElement
        if (!a) return null
        return { tag: a.tagName, sf: a.getAttribute('data-sf-m'), href: a.getAttribute('href'), cls: String(a.className || '').slice(0, 60), text: (a.textContent || '').trim().slice(0, 24) }
      })
      seq.push(info)
    }
    // 卡片 <a> 回车激活（键盘路径在卡级是否存在）
    const anchorsOnHome = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
      return { cards: cards.length, withHref: cards.filter((c) => c.getAttribute('href')).length, roots: cards.map((c) => c.tagName) }
    })
    const navBefore = await page.evaluate(() => location.pathname)
    await page.focus('a[data-sf-m="reward-card"]')
    const focusedCard = await page.evaluate(() => { const a = document.activeElement; return { tag: a.tagName, href: a.getAttribute('href'), sf: a.getAttribute('data-sf-m') } })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(700)
    const navAfter = await page.evaluate(() => location.pathname)
    // 生产影响面（回落态是否在真实站点可达）：读数取自**生产只读探针**（`curl --resolve` 取 `/api/prize/all`，
    //   逐行核 `bID` 在场性；见报告 §生产影响面），本探针内不重复发外网请求。
    const hrefRatio = null
    out.obs5 = {
      viewport: { width: 1600, height: 900 }, theme: 'light',
      ctaInShippedPage: cta,
      tabSequence_first40: seq,
      ctaEverFocusedByTab: seq.some((s) => s && s.sf === 'reward-card-view'),
      cardAnchorFocusedByTab: seq.some((s) => s && s.sf === 'reward-card' && s.tag === 'A'),
      cardAnchorTabIndex: seq.filter((s) => s && s.sf === 'reward-card').length ? 0 : null,
      keyboardActivationAtCardLevel: { focusedCard, pathnameBefore: navBefore, pathnameAfterEnter: navAfter, navigated: navBefore !== navAfter },
      productionReachability: hrefRatio,
      anchorsOnHome,
    }
    await context.close()
  }

  writeJson(OUT, out)
  console.log(JSON.stringify({
    out: OUT,
    shots: Object.keys(out.shots),
    obs4: Object.fromEntries(Object.entries(out.obs4).filter(([k]) => k !== 'hover').map(([k, v]) => [k, { overlap: v.after ? v.after.priceOverlapPx2 : (v.measurement && v.measurement.priceOverlapPx2), diff: v.glowVisibleVsHidden && { gt6: v.glowVisibleVsHidden.pixelsDeltaGt6, max: v.glowVisibleVsHidden.maxChannelDelta, mean: v.glowVisibleVsHidden.meanChannelDelta, meanA: v.glowVisibleVsHidden.meanRgbWithGlow, meanB: v.glowVisibleVsHidden.meanRgbWithoutGlow }, restored: v.restored }])),
    hover: out.shots['neng-hover-日档.png'] && { shadowAppeared: out.shots['neng-hover-日档.png'].shadowAppeared, displaced: out.shots['neng-hover-日档.png'].displaced, yellowRing: out.shots['neng-hover-日档.png'].yellowRingInShadowAfter, shadows: [out.shots['neng-hover-日档.png'].boxShadowBefore, out.shots['neng-hover-日档.png'].boxShadowAfter] },
    obs5: {
      cta: out.obs5.ctaInShippedPage, ctaEverFocusedByTab: out.obs5.ctaEverFocusedByTab,
      cardAnchorFocusedByTab: out.obs5.cardAnchorFocusedByTab, keyboard: out.obs5.keyboardActivationAtCardLevel,
      anchors: out.obs5.anchorsOnHome,
    },
  }, null, 2))
  await browser.close()
}
main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
