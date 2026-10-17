/**
 * Kong 实现方自证探针 · §22 首页商品卡片 UI（v1.20 · T109–T113）
 * 覆盖 AC-1 / AC-2 / AC-3 / AC-4（读数由 kong-ac4-tmp 单测补） / AC-6（静态项另落）。
 *
 * 口径（承仓内既有配方 `ops/v119-msg-panel/qa/probe-geometry-qa.mjs` 头部）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server / 零后端 / 零库写）
 *   · API 一律在 `context.route` 内**内存自截**（夹具写在探针里）
 *   · 主题态 = `addInitScript` 预置 `localStorage.theme`（站点自身 `data-theme` 口径）
 *   · 禁动画（reducedMotion + 注入 `animation:none/transition:none`）+ 稳态采样（rAF×2 + 签名静默）
 *   · 尺子灵敏度自证：注入 `align-items: flex-start !important` ⇒ AC-2 基线差必须变红（仅探针页内，仓内源码零改动）
 *
 * 用法：node ops/ui-card-ref-20261017/qa/kong-probe-card-ui.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.KONG_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/readings/kong-render-readings.json')
const SHOTS = path.join(REPO, 'ops/ui-card-ref-20261017/shots')
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

// ---- 夹具（探针内内存 JSON；零真后端 / 零库写） ------------------------------------------------
const PRIZES = [
  { bID: 1, name: 'FIXTURE 商品一（探针夹具）', description: '探针夹具描述一 —— 用于卡片版式读数', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: 'FIXTURE 商品二（rarity=epic）', description: '探针夹具描述二', points: 6600, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: 'FIXTURE 商品三', description: '探针夹具描述三', points: 1200, stores_count: 0, claims_count: 0, time_end: '2026-12-31' },
]
const apiResponse = (method, pathname) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/home') {
    return data({ tasks: [], prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  }
  if (pathname.startsWith('/api/task/all')) return data([{ tID: 1, title: 'FIXTURE 任务', is_open: true, points: 10, participants_count: 0 }])
  if (pathname.startsWith('/api/prize/all')) return data(PRIZES)
  if (pathname === '/api/messages/unread-count') return data({ unread_total: 0 })
  if (pathname === '/api/prize-item') return data([])
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内测量器 -------------------------------------------------------------------------------
const MEASURE = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const bg = (el) => { const c = cs(el); return c ? c.backgroundColor : null }
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height), top: round(r.top), bottom: round(r.bottom), left: round(r.left), right: round(r.right) } }
  // 基线尺：零尺寸 inline-block（vertical-align: baseline）⇒ 其 bottom 即该行基线
  const baselineOf = (el) => {
    if (!el) return null
    const s = document.createElement('span')
    s.setAttribute('style', 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline')
    el.appendChild(s)
    const b = round(s.getBoundingClientRect().bottom)
    s.remove()
    return b
  }
  const card = document.querySelector('[data-sf-m="reward-card"]')
  const shell = document.querySelector('.sf-shell')
  const rc = document.querySelector('.sf-route-container')
  const top = document.querySelector('.sf-region-top')
  const priceBox = card ? card.querySelector('.sf-reward-price') : null
  const cur = card ? card.querySelector('.sf-reward-price-cur') : null
  const num = card ? card.querySelector('.sf-reward-price-num') : null
  const cta = card ? card.querySelector('[data-sf-m="reward-card-view"]') : null
  const pcs = cs(priceBox); const ccs = cs(cur); const ncs = cs(num)
  const rootCs = cs(document.documentElement)
  const regions = [...document.querySelectorAll('[data-sf-region]')].map((e) => e.getAttribute('data-sf-region'))
  const uniqRegions = regions.filter((v, i) => regions.indexOf(v) === i)
  const cardInner = card && card.firstElementChild ? card.firstElementChild : null

  let price = null
  if (cur && num && priceBox) {
    const cr = rect(cur); const nr = rect(num)
    price = {
      sameParent: cur.parentElement === num.parentElement,
      parentTag: priceBox.tagName,
      parentDisplay: pcs.display,
      parentAlignItems: pcs.alignItems,
      parentBorderWidth: [pcs.borderTopWidth, pcs.borderRightWidth, pcs.borderBottomWidth, pcs.borderLeftWidth].join('/'),
      parentBackground: pcs.backgroundColor,
      parentPadding: [pcs.paddingTop, pcs.paddingRight, pcs.paddingBottom, pcs.paddingLeft].join('/'),
      order: [...priceBox.children].map((c) => (c.classList.contains('sf-reward-price-cur') ? 'cur' : c.classList.contains('sf-reward-price-num') ? 'num' : c.tagName)),
      cur: { rect: cr, fontSize: ccs.fontSize, fontWeight: ccs.fontWeight, color: ccs.color, text: cur.textContent },
      num: { rect: nr, fontSize: ncs.fontSize, fontWeight: ncs.fontWeight, color: ncs.color, text: num.textContent },
      heightRatio: round(cr.h / nr.h),
      curBaseline: baselineOf(cur),
      numBaseline: baselineOf(num),
      baselineDelta: round(Math.abs(baselineOf(cur) - baselineOf(num))),
      curIsSpan: cur.tagName === 'SPAN',
    }
  }

  return {
    url: location.href, pathname: location.pathname, search: location.search,
    theme: document.documentElement.getAttribute('data-theme'),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    bg: { shell: bg(shell), routeContainer: bg(rc), regionTop: bg(top), cardInner: bg(cardInner) },
    tokenResolved: {
      atRootPageBg: rootCs.getPropertyValue('--sf-page-bg').trim(),
      atRootSurfaceBg: rootCs.getPropertyValue('--sf-surface-bg').trim(),
      atRootNumFg: rootCs.getPropertyValue('--sf-price-num-fg').trim(),
      atCardCurFg: cs(card) ? cs(card).getPropertyValue('--sf-price-cur-fg').trim() : null,
      atCardNumFg: cs(card) ? cs(card).getPropertyValue('--sf-price-num-fg').trim() : null,
      atCardUnitFg: cs(card) ? cs(card).getPropertyValue('--sf-price-unit-fg').trim() : null,
    },
    cardCount: document.querySelectorAll('[data-sf-m="reward-card"]').length,
    card: card ? {
      tagName: card.tagName,
      href: card.getAttribute('href'),
      dataSfM: card.getAttribute('data-sf-m'),
      innerTag: cardInner ? cardInner.tagName : null,
      innerClasses: cardInner ? cardInner.className : null,
      childrenCount: card.children.length,
      nestedInteractiveCount: card.querySelectorAll('a,button,input,select,textarea').length,
      nestedInteractiveTags: [...card.querySelectorAll('a,button,input,select,textarea')].map((e) => e.tagName),
    } : null,
    cta: cta
      ? { present: true, tagName: cta.tagName, hook: cta.getAttribute('data-sf-m'), text: (cta.textContent || '').trim(), href: cta.getAttribute('href') }
      : { present: false },
    price,
    regions: uniqRegions, regionCount: regions.length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
})()`

// 卡片「空白区」候选点搜索：命中元素必须是卡片根 `<a>` 自身或其内层 Card 盒（＝纯 padding/底色区），
// 且**不得**落在 CTA 胶囊上 —— 用于 AC-3 的「真点空白区 ⇒ 跳转」。
const BLANK_POINT = `(() => {
  const card = document.querySelector('[data-sf-m="reward-card"]')
  if (!card) return { ok: false, reason: 'no-card' }
  card.scrollIntoView({ block: 'center' })
  const r = card.getBoundingClientRect()
  const inner = card.firstElementChild
  const candidates = []
  for (let fx = 3; fx < r.width - 3; fx += 4) {
    for (let fy = 3; fy < r.height - 3; fy += 4) {
      const x = Math.round(r.left + fx); const y = Math.round(r.top + fy)
      if (x < 2 || y < 2 || x > window.innerWidth - 2 || y > window.innerHeight - 2) continue
      const el = document.elementFromPoint(x, y)
      if (!el) continue
      if (!card.contains(el)) continue
      if (el.closest('[data-sf-m="reward-card-view"]')) continue
      if (el === card) candidates.push({ x, y, hit: 'card-root', strict: true })
      else if (el === inner) candidates.push({ x, y, hit: 'card-inner-box', strict: true })
      else if (el.tagName !== 'IMG' && el.tagName !== 'BUTTON' && el.tagName !== 'A') candidates.push({ x, y, hit: el.tagName + '.' + String(el.className).slice(0, 40), strict: false })
    }
  }
  const strict = candidates.filter((c) => c.strict)
  const pick = strict[0] || candidates[0] || null
  return { ok: !!pick, cardRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, pick, strictCount: strict.length, anyCount: candidates.length }
})()`

async function settle(page, max = 80) {
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

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`dist 缺失：${DIST}`)
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/ui-card-ref-20261017/qa/kong-probe-card-ui.mjs（Kong 实现方自证）',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { api: 'context.route 内存自截（零后端 / 零库写）', prizes: PRIZES.map((p) => ({ bID: p.bID, points: p.points })) },
    shotsDir: SHOTS,
    states: {}, clicks: {}, rulerSensitivity: {}, screenshots: [], ac: {}, pageErrors: [], consoleErrors: [], notes: {},
  }
  const pageErrors = []; const consoleErrors = []

  const open = async (theme, viewport) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
    await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
    await context.route('**/*', async (route) => {
      const req = route.request()
      const u = new URL(req.url())
      if (u.hostname !== 'sf.local') return route.abort()
      if (u.pathname.startsWith('/api/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
      }
      let file = path.join(DIST, decodeURIComponent(u.pathname))
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
    })
    const p = await context.newPage()
    p.on('pageerror', (e) => pageErrors.push(String(e && e.message).slice(0, 200)))
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
    return { context, page: p }
  }

  const goto = async (page, url) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    try { await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 10000 }) } catch (e) { out.notes[`wait_${url}`] = 'no reward-card within 10s' }
    await settle(page)
  }

  // ============ 四档读数（390/1440 × 日/夜） + 四张截图 ============================
  for (const [label, theme, viewport] of [
    ['390_day', 'light', { width: 390, height: 844 }],
    ['390_night', 'dark', { width: 390, height: 844 }],
    ['1440_day', 'light', { width: 1440, height: 900 }],
    ['1440_night', 'dark', { width: 1440, height: 900 }],
  ]) {
    const { context, page } = await open(theme, viewport)
    await goto(page, '/')
    const snap = await page.evaluate(MEASURE)
    snap.cardsTotal = snap.cardCount
    out.states[label] = snap
    // 截图 = 首页商品列表区（把卡片滚进视口中心，再截满视口 ⇒ 尺寸逐字 = 档位）
    if (snap.cardCount > 0) {
      await page.evaluate(`(() => { const c = document.querySelector('[data-sf-m="reward-card"]'); if (c) c.scrollIntoView({ block: 'center' }) })()`)
      await settle(page)
      const shot = path.join(SHOTS, `after-${label.split('_')[0]}-${theme === 'dark' ? '夜档' : '日档'}.png`)
      await page.screenshot({ path: shot })
      out.screenshots.push({ label, theme, path: shot, sha256: null })
    }
    await context.close()
  }

  // ============ 真点卡片空白区 ⇒ pathname = /item/<id>（zh 390 + en 390） ============
  for (const [label, url, expect] of [['zh_390', '/', '/item/'], ['en_390', '/en', '/en/item/']]) {
    const { context, page } = await open('light', { width: 390, height: 844 })
    await goto(page, url)
    const before = await page.evaluate(`(() => ({ pathname: location.pathname, hrefs: [...document.querySelectorAll('[data-sf-m="reward-card"]')].map(a=>a.getAttribute('href')) }))()`)
    const bp = await page.evaluate(BLANK_POINT)
    out.clicks[label] = { url, expectPrefix: expect, before, blankPoint: bp }
    if (bp.ok) {
      await page.mouse.click(bp.pick.x, bp.pick.y)
      await page.waitForTimeout(600)
      try { await page.waitForFunction(`location.pathname !== ${JSON.stringify(new URL(ORIGIN + url).pathname)}`, { timeout: 4000 }) } catch (e) { /* 记录未跳转 */ }
      await settle(page, 20)
      out.clicks[label].after = await page.evaluate(`(() => ({ pathname: location.pathname, url: location.href }))()`)
    }
    await context.close()
  }

  // ============ 尺子灵敏度自证（AC-2 基线差 / 高度比；仅探针页内注入） ============
  {
    const { context, page } = await open('light', { width: 1440, height: 900 })
    await goto(page, '/')
    const base = await page.evaluate(MEASURE)
    await page.addStyleTag({ content: '.sf-reward-price{align-items:flex-start !important} .sf-reward-price-cur{font-size:0.4em !important}' })
    await settle(page)
    const pert = await page.evaluate(MEASURE)
    out.rulerSensitivity = {
      injected: '.sf-reward-price{align-items:flex-start !important} .sf-reward-price-cur{font-size:0.4em !important}（探针页内 <style>，仓内源码零改动）',
      baselineDelta: { shipped: base.price && base.price.baselineDelta, perturbed: pert.price && pert.price.baselineDelta },
      baselineRulerSensitive: !!(base.price && pert.price && pert.price.baselineDelta > 1),
      heightRatio: { shipped: base.price && base.price.heightRatio, perturbed: pert.price && pert.price.heightRatio },
      ratioRulerSensitive: !!(base.price && pert.price && Math.abs(pert.price.heightRatio - 0.75) > 0.05),
    }
    await context.close()
  }

  out.pageErrors = [...new Set(pageErrors)]
  out.consoleErrors = [...new Set(consoleErrors)]

  // ============ AC 判定（读数 → 逐条） ============
  const S = out.states
  const day390 = S['390_day']; const night390 = S['390_night']
  const day1440 = S['1440_day']; const night1440 = S['1440_night']
  const near = (a, b, tol = 0) => a != null && b != null && Math.abs(a - b) <= tol
  const priceChecks = (st, label) => {
    const p = st.price
    if (!p) return { ok: false, why: `${label}: price block missing` }
    const fails = []
    if (!p.sameParent) fails.push('not-same-parent')
    if (p.parentDisplay !== 'flex') fails.push(`parentDisplay=${p.parentDisplay}`)
    if (p.parentAlignItems !== 'baseline') fails.push(`alignItems=${p.parentAlignItems}`)
    if (p.baselineDelta > 1) fails.push(`baselineDelta=${p.baselineDelta}`)
    if (!(p.heightRatio >= 0.70 && p.heightRatio <= 0.85)) fails.push(`heightRatio=${p.heightRatio}`)
    if (!(Number(p.num.fontWeight) >= 700)) fails.push(`numFontWeight=${p.num.fontWeight}`)
    if (p.parentBorderWidth !== '0px/0px/0px/0px') fails.push(`borderWidth=${p.parentBorderWidth}`)
    if (p.parentBackground !== 'rgba(0, 0, 0, 0)') fails.push(`bg=${p.parentBackground}`)
    if (p.parentPadding !== '0px/0px/0px/0px') fails.push(`padding=${p.parentPadding}`)
    if (!p.curIsSpan) fails.push('$ not in <span>')
    if (JSON.stringify(p.order) !== JSON.stringify(['cur', 'num'])) fails.push(`order=${JSON.stringify(p.order)}`)
    if (p.cur.text !== '$') fails.push(`curText=${p.cur.text}`)
    if (p.num.color !== st.bg.__numExpect) fails.push(`numColor=${p.num.color} vs ${st.bg.__numExpect}`)
    return { ok: fails.length === 0, fails, measured: { baselineDelta: p.baselineDelta, heightRatio: p.heightRatio, numFontWeight: p.num.fontWeight, numColor: p.num.color, curColor: p.cur.color, numFontSize: p.num.fontSize, curFontSize: p.cur.fontSize, order: p.order, parentDisplay: p.parentDisplay, parentAlignItems: p.parentAlignItems, parentBorderWidth: p.parentBorderWidth, parentBackground: p.parentBackground, parentPadding: p.parentPadding } }
  }
  // 期望色：卡内重绑后的日档值（#030402 ⇒ rgb(3, 4, 2)）—— 两档同貌（Zang 追加裁定）
  for (const st of [day390, night390, day1440, night1440]) if (st) st.bg.__numExpect = 'rgb(3, 4, 2)'

  const ac = {}
  ac['AC-1'] = {
    day_390: { shell: day390.bg.shell, routeContainer: day390.bg.routeContainer, regionTop: day390.bg.regionTop },
    night_390: { shell: night390.bg.shell, routeContainer: night390.bg.routeContainer, regionTop: night390.bg.regionTop },
    day_1440: { shell: day1440.bg.shell, routeContainer: day1440.bg.routeContainer, regionTop: day1440.bg.regionTop },
    night_1440: { shell: night1440.bg.shell, routeContainer: night1440.bg.routeContainer, regionTop: night1440.bg.regionTop },
    ok: [day390, day1440].every((s) => s.bg.shell === 'rgb(245, 247, 249)' && s.bg.routeContainer === 'rgb(255, 255, 255)' && s.bg.regionTop === 'rgb(253, 232, 21)')
      && [night390, night1440].every((s) => s.bg.shell === 'rgb(11, 12, 14)' && s.bg.routeContainer === 'rgb(16, 17, 20)' && s.bg.regionTop === 'rgb(11, 12, 14)'),
  }
  ac['AC-2'] = {
    zh_390_day: priceChecks(day390, 'zh@390 day'),
    zh_390_night: priceChecks(night390, 'zh@390 night'),
    zh_1440_day: priceChecks(day1440, 'zh@1440 day'),
    zh_1440_night: priceChecks(night1440, 'zh@1440 night'),
    cardLocalRebind: { day390: day390.tokenResolved, night390: night390.tokenResolved },
    ok: false, // 下面统一算
  }
  ac['AC-2'].ok = ['zh_390_day', 'zh_390_night', 'zh_1440_day', 'zh_1440_night'].every((k) => ac['AC-2'][k].ok)
  const cardChecks = (st, label, expectHref) => {
    const c = st.card
    if (!c) return { ok: false, why: `${label}: card root missing` }
    const fails = []
    if (c.tagName !== 'A') fails.push(`rootTag=${c.tagName}`)
    if (c.href !== expectHref) fails.push(`href=${c.href} vs ${expectHref}`)
    if (c.nestedInteractiveCount !== 0) fails.push(`nestedInteractive=${c.nestedInteractiveCount} ${JSON.stringify(c.nestedInteractiveTags)}`)
    if (!st.cta.present) fails.push('cta-hook-missing')
    else {
      if (!['SPAN'].includes(st.cta.tagName)) fails.push(`ctaTag=${st.cta.tagName}`)
      if (st.cta.text !== '查看详情' && st.cta.text.length === 0) fails.push(`ctaText=${st.cta.text}`)
    }
    if (c.dataSfM !== 'reward-card') fails.push(`dataSfM=${c.dataSfM}`)
    return { ok: fails.length === 0, fails, measured: { tagName: c.tagName, href: c.href, nestedInteractiveCount: c.nestedInteractiveCount, cta: st.cta, cardCount: st.cardCount } }
  }
  const zhCard = cardChecks(day390, 'zh@390', '/item/1')
  const enSt = out.states; // /en 档读数见 clicks.en_390.before.hrefs
  ac['AC-3'] = {
    zh_390: zhCard,
    zh_390_night: cardChecks(night390, 'zh@390 night', '/item/1'),
    zh_1440: cardChecks(day1440, 'zh@1440', '/item/1'),
    en_390_hrefs: out.clicks.en_390 ? out.clicks.en_390.before.hrefs : null,
    en_390_hrefOk: !!(out.clicks.en_390 && out.clicks.en_390.before.hrefs[0] === '/en/item/1'),
    click_zh: { blankPoint: out.clicks.zh_390 && out.clicks.zh_390.blankPoint.pick, afterPathname: out.clicks.zh_390 && out.clicks.zh_390.after ? out.clicks.zh_390.after.pathname : null, ok: !!(out.clicks.zh_390 && out.clicks.zh_390.after && out.clicks.zh_390.after.pathname === '/item/1') },
    click_en: { blankPoint: out.clicks.en_390 && out.clicks.en_390.blankPoint.pick, afterPathname: out.clicks.en_390 && out.clicks.en_390.after ? out.clicks.en_390.after.pathname : null, ok: !!(out.clicks.en_390 && out.clicks.en_390.after && out.clicks.en_390.after.pathname === '/en/item/1') },
    ok: false,
  }
  ac['AC-3'].ok = zhCard.ok && ac['AC-3'].zh_390_night.ok && ac['AC-3'].zh_1440.ok && ac['AC-3'].en_390_hrefOk && ac['AC-3'].click_zh.ok && ac['AC-3'].click_en.ok
  ac['AC-4'] = { note: '由 kong-ac4-tmp 单测（vitest）另出读数；本探针附「无 Router」态下 dist 页面零相关异常', pageErrors: out.pageErrors }
  ac['AC-6'] = {
    themeTokensPerKeyEqual: null, // 由 kong-static-readings.txt 另出
    regions: { day390: day390.regions, night390: night390.regions, day1440: day1440.regions },
    regionsIdentical: JSON.stringify(day390.regions) === JSON.stringify(night390.regions) && JSON.stringify(day390.regions) === JSON.stringify(day1440.regions),
    docOverflow: { day390: day390.docOverflow, day1440: day1440.docOverflow, night390: night390.docOverflow, night1440: night1440.docOverflow },
    ok: JSON.stringify(day390.regions) === JSON.stringify(night390.regions) && JSON.stringify(day390.regions) === JSON.stringify(day1440.regions),
  }
  out.ac = ac

  // 截图 sha256
  const crypto = await import('node:crypto')
  out.screenshots = out.screenshots.map((s) => (fs.existsSync(s.path)
    ? { ...s, bytes: fs.statSync(s.path).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(s.path)).digest('hex') }
    : s))

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({
    out: OUT,
    verdicts: Object.fromEntries(Object.entries(ac).map(([k, v]) => [k, v.ok === undefined ? 'INFO' : (v.ok ? 'PASS' : 'FAIL')])),
    clicked: { zh: ac['AC-3'].click_zh, en: ac['AC-3'].click_en },
    ruler: out.rulerSensitivity,
    screenshots: out.screenshots,
    pageErrors: out.pageErrors,
    consoleErrors: out.consoleErrors.slice(0, 5),
    notes: out.notes,
  }, null, 2))

  await browser.close()
}

main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
