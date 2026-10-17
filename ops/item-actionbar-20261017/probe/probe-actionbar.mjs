/**
 * /item/:id 底部操作栏「goofish 形态」几何探针（Kong 实现单 · 与改前/改后共用同一份）
 *
 * 依据：仓内配方 ops/v119-msg-panel/qa/probe-geometry-qa.mjs
 *   · context.route 把 http://sf.local/** 映射到磁盘 frontend/dist ⇒ 零 dev server
 *   · API 一律在 route 内内存自截 ⇒ 零真后端 / 零库写
 *   · 主题 = addInitScript 预置 localStorage.theme；禁动画 + 稳态采样
 * 用法：node probe-actionbar.mjs <out.json> <label:pre|post> [distDir]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const OUT = process.argv[2] || path.join(REPO, 'ops/item-actionbar-20261017/readings/probe.json')
const LABEL = process.argv[3] || 'post'
const DIST = process.argv[4] || path.join(REPO, 'frontend/dist')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const SHOTS = path.join(REPO, 'ops/item-actionbar-20261017/shots')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// ---- 夹具（内存 JSON，零触网 / 零库写）-------------------------------------------------
const MY_UID = 970213
const SELLER_UID = 970301
const LISTINGS = {
  888: {
    bID: 888, listing_id: 888, cid: 1, status: 'listed', stock: 1,
    name: '九成新 尼康 Z fc 相机 含 28mm 饼干头', title: '九成新 尼康 Z fc 相机 含 28mm 饼干头',
    points: 2680, price: 2680,
    description: '自用不到一年，快门数约 3200，附原装电池与肩带，支持当面验机。',
    seller: { uid: SELLER_UID, name: '海边旧物' },
  },
  900: {
    bID: 900, listing_id: 900, cid: 1, status: 'listed', stock: 3,
    name: '复古黄铜台灯 书房工作灯', title: '复古黄铜台灯 书房工作灯',
    points: 320, price: 320,
    description: '自家闲置，灯罩无磕碰，亮度三档可调。',
    seller: { uid: MY_UID, name: '我自己' },
  },
  902: {
    bID: 902, listing_id: 902, cid: 1, status: 'listed', stock: 2,
    name: '手工陶瓷马克杯 一对', title: '手工陶瓷马克杯 一对',
    points: 96, price: 96,
    description: '柴烧釉色，两只一套，容量 320ml。',
    seller: { uid: SELLER_UID, name: '海边旧物' },
  },
}
const FAVORITES = [{ listing_id: 902, title: '手工陶瓷马克杯 一对', price: 96, cid: 1, status: 'listed' }]

const apiResponse = (method, pathname) => {
  const ok = (d) => ({ success: true, data: d })
  const m = pathname.match(/^\/api\/prize\/(\d+)$/)
  if (m && method === 'GET') {
    const row = LISTINGS[Number(m[1])]
    if (!row) return { success: false, error: { code: 'PRIZE_NOT_FOUND', i18n_key: 'prize.err.PRIZE_NOT_FOUND' } }
    return ok(row)
  }
  if (pathname === '/api/favorites' && method === 'GET') return ok(FAVORITES)
  if (pathname === '/api/favorites' && method === 'POST') return ok({ listing_id: 888 })
  if (/^\/api\/favorites\/\d+$/.test(pathname)) return ok({ ok: true })
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (/^\/api\/telegram\//.test(pathname)) return { success: false, error: { code: 'TG_NOT_CONFIGURED' } }
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

const MEASURE_FN = `(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0
  const rc = (el) => { if (!vis(el)) return null; const r = el.getBoundingClientRect(); const n = (v) => Math.round(v * 100) / 100; return { x: n(r.x), y: n(r.y), w: n(r.width), h: n(r.height), left: n(r.left), right: n(r.right), top: n(r.top), bottom: n(r.bottom) } }
  const cs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null)
  const box = (el, key) => {
    const r = rc(el)
    if (!r) return null
    const svgs = [...(el.querySelectorAll('svg') || [])].filter(vis)
    return {
      key, text: (el.textContent || '').trim(), tag: el.tagName,
      rect: r,
      bg: cs(el, 'background-color'), color: cs(el, 'color'),
      radiusTL: cs(el, 'border-top-left-radius'), radiusTR: cs(el, 'border-top-right-radius'),
      radiusBL: cs(el, 'border-bottom-left-radius'), radiusBR: cs(el, 'border-bottom-right-radius'),
      borderTopColor: cs(el, 'border-top-color'), borderTopWidth: cs(el, 'border-top-width'),
      fontSize: cs(el, 'font-size'), fontWeight: cs(el, 'font-weight'),
      padding: [cs(el, 'padding-top'), cs(el, 'padding-right'), cs(el, 'padding-bottom'), cs(el, 'padding-left')].join(' '),
      flex: cs(el, 'flex'),
      disabled: el.disabled === undefined ? null : el.disabled,
      ariaPressed: el.getAttribute('aria-pressed'),
      dataSfFav: el.getAttribute('data-sf-fav'),
      dataSfPhase: el.getAttribute('data-sf-phase'),
      icons: svgs.map((s) => ({ cls: s.getAttribute('class'), fill: s.getAttribute('fill') || getComputedStyle(s).fill, rect: rc(s), stroke: s.getAttribute('stroke') || getComputedStyle(s).stroke })),
    }
  }
  const bar = document.querySelector('[data-sf-m="item-actionbar"]')
  const group = document.querySelector('.sf-item-cta-group')
  const chat = document.querySelector('[data-sf-m="item-chat-btn"]')
  const buyEl = document.querySelector('[data-sf-m="item-buy-btn"]')
  const fav = document.querySelector('[data-sf-m="fav-toggle"]')
  const buyStatus = document.querySelector('[data-sf-m="item-buy-status"]')
  const chatStatus = document.querySelector('[data-sf-m="item-chat-status"]')
  const rowEl = document.querySelector('.sf-item-actionbar-row')
  const b = box(bar, 'actionbar'), g = box(group, 'group'), c = box(chat, 'chat'), u = box(buyEl, 'buy'), f = box(fav, 'fav')
  const rowBox = box(rowEl, 'row')
  const bs = rc(buyStatus), cx = rc(chatStatus)
  const req = ['item-actionbar', 'item-buy-btn', 'fav-toggle', 'item-chat-btn', 'item-buy-status', 'item-chat-status']
  const hookCounts = Object.fromEntries(req.map((k) => [k, document.querySelectorAll('[data-sf-m="' + k + '"]').length]))
  return {
    url: location.href, pathname: location.pathname, viewport: { w: innerWidth, h: innerHeight },
    htmlTheme: document.documentElement.getAttribute('data-theme'),
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bar: b, group: g, chat: c, buy: u, fav: f,
    barFlexDirection: cs(bar, 'flex-direction'), barGap: cs(bar, 'gap'),
    barMinHeight: cs(bar, 'min-height'), barWidth: rc(bar) ? rc(bar).w : null,
    barPosition: cs(bar, 'position'),
    buyStatusBox: bs, chatStatusBox: cx,
    hookCounts,
    groupRadius: g ? g.radiusTL : null,
    groupOverflow: group ? getComputedStyle(group).overflow : null,
    row: rowBox,
    // 派生量（探针自算，避免报告里手算；比例基数 = 按钮行的**内宽**，即 flex 容器宽）
    gapGroupToFav: (g && f) ? Math.round((f.rect.left - g.rect.right) * 100) / 100 : null,
    seamDelta: (c && u) ? Math.round((u.rect.left - c.rect.right) * 100) / 100 : null,
    chatShareOfGroup: (c && g && g.rect.w) ? Math.round((c.rect.w / g.rect.w) * 10000) / 100 : null,
    buyShareOfGroup: (u && g && g.rect.w) ? Math.round((u.rect.w / g.rect.w) * 10000) / 100 : null,
    rowWidth: rowBox ? rowBox.rect.w : null,
    groupShareOfRow: (g && rowBox) ? Math.round((g.rect.w / rowBox.rect.w) * 10000) / 100 : null,
    favShareOfRow: (f && rowBox) ? Math.round((f.rect.w / rowBox.rect.w) * 10000) / 100 : null,
    gapShareOfRow: (g && f && rowBox) ? Math.round(((f.rect.left - g.rect.right) / rowBox.rect.w) * 10000) / 100 : null,
    groupShareOfBar: (g && b && b.rect.w) ? Math.round((g.rect.w / b.rect.w) * 10000) / 100 : null,
    favShareOfBar: (f && b && b.rect.w) ? Math.round((f.rect.w / b.rect.w) * 10000) / 100 : null,
    groupWidthVsFavDouble: (g && f) ? Math.round((g.rect.w / (f.rect.w * 2)) * 10000) / 100 : null,
    statusBelowButtons: (bs && b) ? Math.round((bs.top - Math.max(c ? c.rect.bottom : -1, u ? u.rect.bottom : -1, f ? f.rect.bottom : -1)) * 100) / 100 : null,
    elementCount: document.querySelectorAll('*').length,
  }
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
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'probe-actionbar.mjs (Kong · /item/:id 操作栏 goofish 形态)',
    label: LABEL, startedAt: new Date().toISOString(), dist: DIST, chrome: CHROME,
    fixtures: { auth: 'localStorage only', api: 'context.route in-probe JSON (no backend, zero db write)', myUid: MY_UID, sellerUid: SELLER_UID, listings: Object.keys(LISTINGS), favorites: FAVORITES.map((r) => r.listing_id) },
    states: {}, rulerSensitivity: {}, shots: [], notes: [], pageErrors: [], consoleErrors: [],
  }

  // ---- 比例判据口径（= 参考图 ref/goofish-ref.png 列主类逐像素实测，容差 ±0.5pp）----
  // 口径勘误：派单原给 58:42 / 64% / 12.5% 为目测错值；实测 50:50 / 72.8% / 4.6% / 22.6%。
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol
  const RATIO_SPEC = {
    groupShareOfRow: { key: 'a_groupShare_72_8', target: 72.8, tol: 0.5, range: '72.3–73.3' },
    chatShareOfGroup: { key: 'a_chatShare_50_0', target: 50.0, tol: 0.5, range: '49.5–50.5' },
    buyShareOfGroup: { key: 'a_buyShare_50_0', target: 50.0, tol: 0.5, range: '49.5–50.5' },
    favShareOfRow: { key: 'a_favShare_22_6', target: 22.6, tol: 0.5, range: '22.1–23.1' },
    gapShareOfRow: { key: 'a_gapShare_4_6', target: 4.6, tol: 0.5, range: '4.1–5.1' },
  }
  const RATIO_KEYS = Object.values(RATIO_SPEC).map((s) => s.key)
  const ratioPredicates = (s) => {
    const r = {}
    for (const [field, spec] of Object.entries(RATIO_SPEC)) {
      const v = s ? s[field] : null
      r[spec.key] = v == null ? null : near(v, spec.target, spec.tol)
    }
    r.a_seamDeltaZero = s && s.seamDelta != null ? s.seamDelta === 0 : null
    return r
  }
  const ratioValues = (s) => Object.fromEntries([
    ...Object.keys(RATIO_SPEC).map((f) => [f, s ? s[f] : null]),
    ['seamDelta', s ? s.seamDelta : null],
  ])

  const newCtx = async ({ width, height, theme, auth }) => {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    await context.addInitScript(([t, a]) => {
      localStorage.setItem('theme', t)
      if (a) {
        localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
        localStorage.setItem('token', 'qa-token')
      } else {
        localStorage.removeItem('user'); localStorage.removeItem('token')
      }
    }, [theme, auth])
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
    const page = await context.newPage()
    page.on('pageerror', (e) => out.pageErrors.push(String(e && e.message)))
    page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 200)) })
    return { context, page }
  }

  const snap = async (page, label, id, { shot = false } = {}) => {
    await page.goto(`${ORIGIN}/item/${id}`, { waitUntil: 'load' })
    await settle(page)
    try { await page.waitForSelector('[data-sf-m="item-actionbar"]', { timeout: 8000 }) } catch (e) { out.notes.push(`${label}: waitForSelector item-actionbar timeout`) }
    await settle(page)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await settle(page)
    const s = await page.evaluate(MEASURE_FN)
    s.id = id
    out.states[label] = s
    if (shot) {
      const p = path.join(SHOTS, `${LABEL}-${label}.png`)
      fs.mkdirSync(SHOTS, { recursive: true })
      await page.screenshot({ path: p })
      out.shots.push(p)
    }
    return s
  }

  // ---- 四主态：1440×900 / 390×844 × 日 / 夜 ----
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const theme of ['light', 'dark']) {
      const { context, page } = await newCtx({ width: w, height: h, theme, auth: true })
      await snap(page, `${w}_${theme}`, 888, { shot: true })
      await context.close()
    }
  }

  // ---- 卖家本人（组合条只剩立即购买 ⇒ :only-child）----
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { context, page } = await newCtx({ width: w, height: h, theme: 'light', auth: true })
    await snap(page, `${w}_seller_onlybuy`, 900, { shot: w === 390 })
    await context.close()
  }

  // ---- 已收藏态（星标实心 + aria-pressed）----
  {
    const { context, page } = await newCtx({ width: 1440, height: 900, theme: 'light', auth: true })
    await snap(page, 'favored_1440_light', 902)
    await context.close()
  }

  // ---- 未登录（立即购买 disabled / 聊一聊与收藏可点走登录引导）----
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { context, page } = await newCtx({ width: w, height: h, theme: 'light', auth: false })
    await snap(page, `${w}_anon`, 888)
    await context.close()
  }

  // ---- 尺子灵敏度自证（**只做页内注入，源码零改动**）：三处扰动各自把「对应判据」打红，移除注入后回绿 ----
  // 主证 = 派单要求的那一条：组合条 72.8% → 60%（`a_groupShare_72_8` 与 `a_gapShare_4_6` 必红）；
  // 辅证 1 = 聊一聊 50% → 58%（`a_chatShare_50_0` / `a_buyShare_50_0` 必红；证明组内比例尺子也有分辨力）；
  // 辅证 2 = 收藏 22.6% → 30%（`a_favShare_22_6` 必红）。
  out.rulerSensitivity = { method: 'page-level <style id="qa-perturb"> in probe only; repo source untouched', cases: {} }
  {
    const { context, page } = await newCtx({ width: 1440, height: 900, theme: 'light', auth: true })
    const base = await snap(page, 'ruler_base', 888)
    const inject = async (css) => {
      await page.evaluate(`(() => { let s = document.getElementById('qa-perturb');
        if (!s) { s = document.createElement('style'); s.id = 'qa-perturb'; document.head.appendChild(s) }
        s.textContent = ${JSON.stringify(css)} })()`)
      await settle(page)
      return page.evaluate(MEASURE_FN)
    }
    const clear = async () => {
      await page.evaluate(`(() => { const s = document.getElementById('qa-perturb'); if (s) s.remove() })()`)
      await settle(page)
      return page.evaluate(MEASURE_FN)
    }
    const cases = [
      { name: 'group_72_8_to_60', css: '.sf-item-cta-group{flex:0 0 60% !important}', mustRed: ['a_groupShare_72_8'] },
      { name: 'chat_50_to_58', css: '.sf-btn.sf-item-cta-chat{flex:0 0 58% !important}', mustRed: ['a_chatShare_50_0'] },
      { name: 'fav_22_6_to_30', css: '.sf-btn.sf-item-cta-fav{flex:0 0 30% !important}', mustRed: ['a_favShare_22_6'] },
    ]
    const baseP = ratioPredicates(base)
    for (const c of cases) {
      const pert = await inject(c.css)
      const pertP = ratioPredicates(pert)
      const back = await clear()
      const backP = ratioPredicates(back)
      const flippedRed = RATIO_KEYS.filter((k) => baseP[k] === true && pertP[k] === false)
      const flippedGreen = RATIO_KEYS.filter((k) => baseP[k] === true && backP[k] === true)
      out.rulerSensitivity.cases[c.name] = {
        injected: `page-level <style>: ${c.css}（仅探针页内；仓内源码零改动）`,
        values: { shipped: ratioValues(base), perturbed: ratioValues(pert), restored: ratioValues(back) },
        predicates: { shipped: baseP, perturbed: pertP, restored: backP },
        mustRed: c.mustRed,
        mustRedAllFlipped: c.mustRed.every((k) => baseP[k] === true && pertP[k] === false),
        flippedRed,
        restoredGreen: flippedGreen,
        restoredAllGreen: RATIO_KEYS.every((k) => backP[k] === true) && backP.a_seamDeltaZero === true,
      }
    }
    out.rulerSensitivity.mustRedSensitive = Object.values(out.rulerSensitivity.cases).every((c) => c.mustRedAllFlipped === true)
    out.rulerSensitivity.restoredAllGreen = Object.values(out.rulerSensitivity.cases).every((c) => c.restoredAllGreen === true)
    out.rulerSensitivity.shippedAllGreen = RATIO_KEYS.every((k) => baseP[k] === true) && baseP.a_seamDeltaZero === true
    out.rulerSensitivity.sensitive = out.rulerSensitivity.mustRedSensitive && out.rulerSensitivity.restoredAllGreen
    await context.close()
  }

  // ---- 日/夜几何逐值比较（同视口）----
  const geoOf = (s) => s && JSON.stringify({
    bar: s.bar && [s.bar.rect.x, s.bar.rect.y, s.bar.rect.w, s.bar.rect.h],
    group: s.group && [s.group.rect.x, s.group.rect.y, s.group.rect.w, s.group.rect.h, s.group.radiusTL],
    chat: s.chat && [s.chat.rect.x, s.chat.rect.w, s.chat.rect.h],
    buy: s.buy && [s.buy.rect.x, s.buy.rect.w, s.buy.rect.h],
    fav: s.fav && [s.fav.rect.x, s.fav.rect.w, s.fav.rect.h],
    row: s.row && [s.row.rect.x, s.row.rect.w, s.row.rect.h],
    gap: s.gapGroupToFav, seam: s.seamDelta,
  })
  out.themeGeoEqual = {
    1440: geoOf(out.states['1440_light']) === geoOf(out.states['1440_dark']),
    390: geoOf(out.states['390_light']) === geoOf(out.states['390_dark']),
    light1440: geoOf(out.states['1440_light']),
    dark1440: geoOf(out.states['1440_dark']),
    light390: geoOf(out.states['390_light']),
    dark390: geoOf(out.states['390_dark']),
  }

  // ---- 判据（同一份代码同时用于 pre / post；pre 预期多数为 false = 尺子有分辨力）----
  const radiusAtLeastHalf = (b) => {
    if (!b) return null
    const r = parseFloat(String(b.radiusTL || '0'))
    return b.rect.h ? r >= (b.rect.h / 2) * 0.99 : null
  }
  const perState = (k, s) => {
    if (!s || !s.bar) return { key: k, present: false }
    const twoSeg = !!s.chat && !!s.buy && !!s.group
    return {
      key: k,
      present: true,
      hooks: s.hookCounts,
      hooksComplete: Object.values(s.hookCounts).every((n) => n === 1) || Object.values(s.hookCounts).filter((n) => n >= 1).length >= 5,
      a_seamless: twoSeg ? s.seamDelta === 0 : null,
      a_groupWiderThanDoubleFav: s.group && s.fav ? s.group.rect.w > s.fav.rect.w * 2 : null,
      a_gapPositive: s.gapGroupToFav != null ? s.gapGroupToFav > 0 : null,
      ...ratioPredicates(s),
      a_groupPillRadius: radiusAtLeastHalf(s.group),
      a_seamSquare: (s.chat && s.buy) ? ['radiusTR', 'radiusBR'].every((p) => parseFloat(s.chat[p]) === 0) && ['radiusTL', 'radiusBL'].every((p) => parseFloat(s.buy[p]) === 0) : null,
      a_favPillRadius: radiusAtLeastHalf(s.fav),
      a_touch44: s.buy && s.buy.rect.h >= 44 ? true : (s.buy ? false : null),
      a_buySolid: s.buy ? (s.buy.bg !== 'rgb(255, 230, 15)') : null,
      a_chatYellow: s.chat ? s.chat.bg : null,
      a_favAlt: s.fav ? s.fav.bg : null,
      a_chatIcon: s.chat ? s.chat.icons.some((i) => /lucide-message-circle/.test(i.cls || '')) : null,
      a_favIcon: s.fav ? s.fav.icons.some((i) => /lucide-star/.test(i.cls || '')) : null,
      a_statusBelowButtons: s.statusBelowButtons == null ? 'no-status-text' : s.statusBelowButtons > 0,
      a_barCol: s.barFlexDirection,
      a_buyDisabled: s.buy ? s.buy.disabled : null,
      a_chatDisabled: s.chat ? s.chat.disabled : null,
      a_favDisabled: s.fav ? s.fav.disabled : null,
      a_onlyChildFullWidth: s.chat ? null : (s.group ? s.group.rect.w : null),
      a_overflowPx: s.overflowPx,
    }
  }
  out.verdict = {}
  for (const [k, s] of Object.entries(out.states)) out.verdict[k] = perState(k, s)
  out.verdict.themeGeoEqual = out.themeGeoEqual

  // ---- 比例门（四主态）：口径 72.8 / 50 / 50 / 22.6 / 4.6 + seamDelta === 0，全绿才算过 ----
  out.ratioGate = { spec: Object.fromEntries(Object.entries(RATIO_SPEC).map(([f, s2]) => [f, { target: s2.target, tol: s2.tol, range: s2.range }])), states: {} }
  for (const k of ['1440_light', '1440_dark', '390_light', '390_dark']) {
    const v = out.verdict[k] || {}
    const row = Object.fromEntries([...RATIO_KEYS, 'a_seamDeltaZero'].map((kk) => [kk, v[kk]]))
    out.ratioGate.states[k] = { ...row, values: ratioValues(out.states[k]), pass: [...RATIO_KEYS, 'a_seamDeltaZero'].every((kk) => v[kk] === true) }
  }
  out.ratioGate.themeGeoEqual = { 1440: out.themeGeoEqual['1440'], 390: out.themeGeoEqual['390'] }
  out.ratioGate.allPass = Object.values(out.ratioGate.states).every((r) => r.pass === true)
    && out.themeGeoEqual['1440'] === true && out.themeGeoEqual['390'] === true
  out.ratioGate.rulerSensitive = out.rulerSensitivity.sensitive === true

  out.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('WROTE', OUT)
  console.log('pageErrors', JSON.stringify(out.pageErrors))
  console.log('consoleErrors', JSON.stringify(out.consoleErrors.slice(0, 4)))
  await browser.close()
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
