/**
 * Toast 双轨 · 真浏览器探针（Kevin 2026-10-24 裁定 · design `T126` / §40 `T139`）
 *
 * 口径（逐条对齐派单验证项 ①–⑤）：
 *   ① **强化档（余额增加类，`toastCredit`）水平中心偏差 ≤ 2px**、**纵向中心落在视口 25%–55%**；
 *   ② **实测 computed `font-size` ≥ 18px**（含类名 `sf-toast-credit`、`role="status"` 在场）；
 *   ③ **普通 toast 仍在右上**（`rect.top < 120` 且 `rect.right` 靠右 ≥ 视口右 1/2 线以外）、字号仍 ≈14px、
 *      字号仍 = 仓内既有实测 16px、容器 `z-index` 仍 = 9999（= react-hot-toast 2.6.0 内联值，**未被动过**）；
 *   ④ **深色档**：强化 toast 的文字 / 底色随主题 token 翻档（`color` = 夜档 `--sf-page-fg`、
 *      `background` = 夜档 `--sf-surface-bg`），字号与居中口径不变；
 *   ⑤ **零 `pageerror`**；另记强化档在场时容器 `z-index` = 50（**< 模态框 60**，派单硬口径）。
 *
 * 手法（同 `ops/profile-invite/probe-profile-invite.mjs` 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（`addInitScript`）；**全部 API 在 route 内自截**（零后端、**生产库零写入**）；
 *   · 触发面 = 真实交互：`/wage` 点【领工资】⇒ 余额增加类；`/profile/invite` 点【绑定】⇒ 普通提示类；
 *   · 只读仓内文件，不写源码；读数落 `ops/toast-credit/readings/probe-toast-credit.json`。
 *
 * 用法：node ops/toast-credit/probe-toast-credit.mjs [out.json]
 *   QA_DIST=<dist> 可覆盖产物目录。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/toast-credit/readings/probe-toast-credit.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// 夜档 token 实测值（`frontend/src/theme/theme-tokens.css` 的 `[data-theme="dark"]` 段，探针内落字面，
// 用于把「颜色 token 已生效」变成可断言的 rgb 三元组；不引入第二份真源给运行时代码用）
const DARK_TOKENS = { '--sf-page-fg': '#E8EAED', '--sf-surface-bg': '#101114' }
const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
}

// ---- 夹具（探针内内存；形状 = 契约，**不触真实后端 / 不写库**） ----
const STATE = {
  me: { bound: false, parent_uid: null, bound_at: null, depth: null },
  calls: [],
  // ⑥ 货币文案顺序段的夹具开关（默认值 = 原几何段所用夹具，改前改后同一份）
  wageSymbol: '$',
  claim: { wage_batt: 3, wage_currency_amount: '10' },
}

const WAGE_ROW = {
  project_id: 501, snowflake_id: '501', slug: 'probe-wage',
  title: '码头搬运（探针）', description: '探针项目：只用于 Toast 几何读数',
  headcount: 5, hired_count: 1,
  wage_batt_per_claim: 3, wage_cid: 2, wage_currency_amount: '10', wage_interval_hours: 1,
  status: 'open', my_role: 'hired', my_hired_at: '2026-10-20T00:00:00.000Z', next_claim_at: null,
}

const apiResponse = (method, pathname, bodyText) => {
  const ok = (data, message) => ({ success: true, data, message })
  const nextAt = new Date(Date.now() + 3600 * 1000).toISOString()

  if (pathname === '/api/project/all') {
    STATE.calls.push({ method, path: pathname })
    return { status: 200, body: ok([WAGE_ROW]) }
  }
  if (/^\/api\/project\/\d+\/claim$/.test(pathname)) {
    STATE.calls.push({ method, path: pathname })
    return { status: 200, body: ok({ ...STATE.claim, batt_after: 73, next_claim_at: nextAt }, 'claimed') }
  }
  if (pathname === '/api/currencies') return { status: 200, body: ok([{ cid: 2, symbol: STATE.wageSymbol, name: 'Probe' }]) }
  if (pathname === '/api/batt') return { status: 200, body: ok({ batt: 70, capBatt: 100, canAccept: true, bttc: null }) }
  if (pathname === '/api/referral/me') {
    STATE.calls.push({ method, path: pathname })
    return { status: 200, body: ok(STATE.me) }
  }
  if (pathname === '/api/referral/bind') {
    let parsed = {}
    try { parsed = JSON.parse(bodyText || '{}') } catch { parsed = {} }
    STATE.calls.push({ method, path: pathname, body: parsed })
    STATE.me = { bound: true, parent_uid: 100, bound_at: '2026-10-24T05:00:00.000Z', depth: 2 }
    return { status: 200, body: ok({ parent_uid: 100, depth: 2, bound_at: '2026-10-24T05:00:00.000Z' }, 'Referral bound') }
  }
  if (pathname === '/api/user') {
    return { status: 200, body: ok({ uID: 100100, uid: 100100, name: 'Probe', bio: 'probe', avatar_url: null }) }
  }
  if (/^\/api\/user\/asset\//.test(pathname)) return { status: 200, body: ok({ points: '100', time_update: null }) }
  if (pathname === '/api/user/balances') return { status: 200, body: ok([]) }
  if (pathname === '/api/messages/unread-count') return { status: 200, body: ok({ unread_total: 0 }) }
  if (method === 'GET') return { status: 200, body: ok({ rows: [], next_cursor: null, total: 0 }) }
  return { status: 200, body: ok({}) }
}

// ---- 页内读数：两条轨道的几何 / 排版 / 层级 + 主题色（一次取全） ----
const SNAP_FN = () => {
  const de = document.documentElement
  const vw = de.clientWidth
  const vh = de.clientHeight
  const host = document.querySelector('[data-rht-toaster]')
  const credit = document.querySelector('.sf-toast-credit')
  const wrapOf = (el) => (el ? el.parentElement : null)
  const rectOf = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      left: Math.round(r.left * 10) / 10, top: Math.round(r.top * 10) / 10,
      right: Math.round(r.right * 10) / 10, bottom: Math.round(r.bottom * 10) / 10,
      width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10,
      cx: Math.round((r.left + r.width / 2) * 10) / 10, cy: Math.round((r.top + r.height / 2) * 10) / 10,
    }
  }
  const bars = [...document.querySelectorAll('[role="status"]')]
  const ordinary = bars.filter((el) => !el.classList.contains('sf-toast-credit'))
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const c0 = cs(credit)
  const o0 = cs(ordinary[0])
  return {
    vw, vh,
    host: host
      ? {
        zIndex: cs(host).zIndex, position: cs(host).position,
        top: cs(host).top, left: cs(host).left, right: cs(host).right,
      }
      : null,
    credit: credit
      ? {
        text: (credit.textContent || '').replace(/\s+/g, ' ').trim(),
        className: credit.className,
        rect: rectOf(credit),
        wrapRect: rectOf(wrapOf(credit)),
        fontSize: c0.fontSize,
        fontWeight: c0.fontWeight,
        color: c0.color,
        background: c0.backgroundColor,
        borderTopWidth: c0.borderTopWidth,
        borderTopColor: c0.borderTopColor,
        boxShadow: c0.boxShadow,
        animationName: c0.animationName,
        hCenterDev: Math.abs(Math.round((rectOf(credit).cx - vw / 2) * 10) / 10),
        vCenterRatio: Math.round(((rectOf(credit).cy / vh) * 1000)) / 1000,
      }
      : null,
    ordinary: ordinary.map((el) => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      className: el.className,
      rect: rectOf(el),
      fontSize: cs(el).fontSize,
      rightGap: Math.round((vw - el.getBoundingClientRect().right) * 10) / 10,
    })),
    ordinaryFontSize: ordinary.length ? (o0 ? o0.fontSize : null) : null,
    theme: de.getAttribute('data-theme'),
    tokenProbe: (() => {
      const s = getComputedStyle(de)
      return { pageFg: s.getPropertyValue('--sf-page-fg').trim(), surfaceBg: s.getPropertyValue('--sf-surface-bg').trim() }
    })(),
  }
}

async function settle(page, max = 40) {
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(() => `${document.body.innerHTML.length}|${document.querySelectorAll('*').length}`)
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.fulfill({ status: 204, body: '' })
    if (u.pathname.startsWith('/api/')) {
      const { status, body } = apiResponse(req.method(), u.pathname, req.postData())
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

const seedAuth = (theme) => (ctx) => ctx.addInitScript((th) => {
  localStorage.setItem('theme', th)
  localStorage.setItem('user', JSON.stringify({ uID: 100100, uid: 100100, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
  // 禁动画 / 过渡：读数取稳态（入场动画由单测 + 样式文本断言，几何不靠动画时长）
  const st = document.createElement('style')
  st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st))
}, theme)

const newPage = async (browser, viewport, theme = 'light', locale = 'zh-CN') => {
  const pageErrors = []
  const consoleErrors = []
  const ctx = await browser.newContext({ viewport, locale })
  await attachRoutes(ctx)
  await seedAuth(theme)(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
  return { ctx, page, pageErrors, consoleErrors }
}

const open = async (page, url, selector) => {
  await page.goto(`${ORIGIN}${url}`, { waitUntil: 'domcontentloaded' })
  if (selector) await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {})
  await settle(page)
}

/** 领工资（真实交互）⇒ 等强化 toast 出现并稳态化 */
const claimWageToast = async (page) => {
  await page.waitForSelector('[data-sf-m="wage-current-claim"]', { timeout: 10000 })
  await page.click('[data-sf-m="wage-current-claim"]')
  await page.waitForSelector('.sf-toast-credit', { timeout: 8000 })
  await settle(page)
  return page.evaluate(SNAP_FN)
}

main().catch((e) => { console.error(e); process.exit(1) })

async function main() {
  const out = {
    meta: {
      dist: DIST, origin: ORIGIN, startedAt: new Date().toISOString(),
      fixture: 'in-page route interception (zero backend / zero db write)',
    },
    states: {}, assertions: {}, counts: {},
  }
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--disable-lcd-text'],
  })
  const pageErrors = []
  const consoleErrors = []

  // ============ ① ② 强化档：1536×960 桌面档 —— 领工资（余额增加类） ============
  const d = await newPage(browser, { width: 1536, height: 960 }, 'light')
  await open(d.page, '/wage', '[data-sf-m="wage-current-claim"]')
  const creditSnap = await claimWageToast(d.page)
  pageErrors.push(...d.pageErrors)
  consoleErrors.push(...d.consoleErrors)
  out.states.creditDesktop = creditSnap

  // ============ ① 手机档：390×844 —— 同一强化档几何 ============
  const m = await newPage(browser, { width: 390, height: 844 }, 'light')
  await open(m.page, '/wage', '[data-sf-m="wage-current-claim"]')
  const creditMobile = await claimWageToast(m.page)
  pageErrors.push(...m.pageErrors)
  consoleErrors.push(...m.consoleErrors)
  out.states.creditMobile = creditMobile

  // ============ ③ 普通 toast：/profile/invite 绑定成功（非余额）⇒ 仍右上 ============
  const o = await newPage(browser, { width: 1536, height: 960 }, 'light')
  STATE.me = { bound: false, parent_uid: null, bound_at: null, depth: null }
  await open(o.page, '/profile/invite', '[data-sf-m="invite-pane"]')
  await o.page.evaluate(() => {
    const el = document.querySelector('[data-sf-m="invite-otp-cell-0"]')
    if (!el) return
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', '000100')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await settle(o.page)
  await o.page.click('[data-sf-m="invite-submit"]')
  await o.page.waitForFunction(() => {
    const bars = [...document.querySelectorAll('[role="status"]')]
    return bars.some((el) => !el.classList.contains('sf-toast-credit') && (el.textContent || '').trim().length > 0)
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(o.page)
  const ordSnap = await o.page.evaluate(SNAP_FN)
  pageErrors.push(...o.pageErrors)
  consoleErrors.push(...o.consoleErrors)
  out.states.ordinary = ordSnap

  // ============ ④ 深色档：强化 toast 的颜色 token 生效、字号与居中不变 ============
  const k = await newPage(browser, { width: 1536, height: 960 }, 'dark')
  await open(k.page, '/wage', '[data-sf-m="wage-current-claim"]')
  const creditDark = await claimWageToast(k.page)
  pageErrors.push(...k.pageErrors)
  consoleErrors.push(...k.consoleErrors)
  out.states.creditDark = creditDark

  // ============ ⑥ 货币文案顺序（T139-a）：领工资同返 batt + 次币 ⇒ Toast 必须「单位 + 数量」 ============
  // 夹具：一次领取同时返回 ⚡️30 与次币 20（zh / en 两档）。次币符号 = **`₿`**（生产 `/api/currencies`
  // 实证：cid 4 ⇒ symbol `₿` / name BTTC）⇒ 期望**逐字**「已领到 ⚡️30 与 ₿20」（en：`Claimed ⚡️30 and ₿20`）。
  // 正断言（严格连写，不接受空格）：`⚡️30` 与 `₿20` 在场；反断言：`⚡️ 30` / `₿ 20` / `20 ₿` / `20 BTTC` /
  // `$ 10` 均不在场（前两者 = 单位+空格+数量，后两者 = 数量在前 —— 任一命中即判负）。
  const currencyOrder = {}
  for (const lang of ['zh', 'en']) {
    STATE.wageSymbol = '\u20BF'
    STATE.claim = { wage_batt: 30, wage_currency_amount: '20' }
    const c = await newPage(browser, { width: 1536, height: 960 }, 'light', lang === 'en' ? 'en-US' : 'zh-CN')
    await open(c.page, `/${lang}/wage`, '[data-sf-m="wage-current-claim"]')
    const snap = await claimWageToast(c.page)
    pageErrors.push(...c.pageErrors)
    consoleErrors.push(...c.consoleErrors)
    const text = snap.credit ? snap.credit.text : ''
    currencyOrder[lang] = {
      url: `/${lang}/wage`,
      text,
      htmlLang: snap.theme === undefined ? null : await c.page.evaluate(() => document.documentElement.lang || ''),
      // 正断言 = **严格连写**（单位紧贴数量；`\s*` 会放过坏形，故一律不用）
      battUnitFirst: /\u26A1\uFE0F?30/.test(text),
      currencyUnitFirst: /\u20BF20/.test(text),
      // 反断言 = 坏形全不在场：emoji 空格 / 符号空格 / 数量在前 / 裸币种代码 / 字面 `$ ` 带空格
      noEmojiSpace: !/\u26A1\uFE0F?\s+30/.test(text),
      noSymbolSpace: !/\u20BF\s+20/.test(text),
      noTrailingSymbol: !/20\s*\u20BF/.test(text),
      noTickerQuantity: !/20\s*BTTC/.test(text),
      noTickerAtAll: !/BTTC/.test(text),
      noLiteralDollarSpace: !/\$\s+\d/.test(text),
    }
    await c.ctx.close()
  }
  STATE.wageSymbol = '$'
  STATE.claim = { wage_batt: 3, wage_currency_amount: '10' }
  out.states.currencyOrder = currencyOrder

  await browser.close()

  // ============================== 断言（逐条可归因） ==============================
  const creditOk = (s) => Boolean(s && s.credit)
  const desktop = creditSnap.credit
  const mobile = creditMobile.credit
  const dark = creditDark.credit
  const ord = ordSnap.ordinary[0]

  const checks = {
    // ① 位置：水平居中偏差 ≤2px、纵向中心落在 25%–55%
    'credit.desktop.present': creditOk(creditSnap),
    'credit.desktop.class': Boolean(desktop && desktop.className.split(/\s+/).includes('sf-toast-credit')),
    'credit.desktop.hasText': Boolean(desktop && desktop.text.length > 0),
    'credit.desktop.hCenterDevLe2px': Boolean(desktop && desktop.hCenterDev <= 2),
    'credit.desktop.vCenterIn25to55': Boolean(desktop && desktop.vCenterRatio >= 0.25 && desktop.vCenterRatio <= 0.55),
    'credit.mobile.hCenterDevLe2px': Boolean(mobile && mobile.hCenterDev <= 2),
    'credit.mobile.vCenterIn25to55': Boolean(mobile && mobile.vCenterRatio >= 0.25 && mobile.vCenterRatio <= 0.55),
    // ② 字号 ≥18px（桌面 + 手机 + 夜档）
    'credit.desktop.fontSizeGe18': Boolean(desktop && parseFloat(desktop.fontSize) >= 18),
    'credit.mobile.fontSizeGe18': Boolean(mobile && parseFloat(mobile.fontSize) >= 18),
    'credit.dark.fontSizeGe18': Boolean(dark && parseFloat(dark.fontSize) >= 18),
    // 层级：强化档在场 ⇒ 容器 50（< 模态框 60）
    'credit.desktop.hostZ50': Boolean(creditSnap.host && creditSnap.host.zIndex === '50'),
    'credit.desktop.hostBelowModal60': Boolean(creditSnap.host && Number(creditSnap.host.zIndex) < 60),
    // ③ 普通 toast 仍右上、仍 14px、容器仍 9999
    'ordinary.present': Boolean(ord),
    'ordinary.topLt120': Boolean(ord && ord.rect.top < 120),
    'ordinary.rightHalf': Boolean(ord && ord.rect.cx > ordSnap.vw / 2),
    // 普通类字号 = **仓内既有实测值 16px**（react-hot-toast 默认，本仓改前无任何 `.sf-toast*` 规则）；
    // 本单只新增 `.sf-toast-credit` 与「强化档在场时压容器层级」两条，均不匹配普通 toast ⇒ 一字未动。
    'ordinary.fontSizeUnchanged16': Boolean(ord && parseFloat(ord.fontSize) === 16),
    'ordinary.hostZ9999': ordSnap.host ? ordSnap.host.zIndex === '9999' : false,
    'ordinary.notCreditClass': Boolean(ord && !ord.className.split(/\s+/).includes('sf-toast-credit')),
    // ④ 深色档：文字 / 底色随 token 翻档（#E8EAED / #101114）
    'dark.themeApplied': creditDark.theme === 'dark',
    'dark.colorIsPageFg': Boolean(dark && dark.color === hexToRgb(DARK_TOKENS['--sf-page-fg'])),
    'dark.bgIsSurface': Boolean(dark && dark.background === hexToRgb(DARK_TOKENS['--sf-surface-bg'])),
    'dark.hCenterDevLe2px': Boolean(dark && dark.hCenterDev <= 2),
    // ⑥ T139-a 货币文案顺序：领工资同返 batt + 次币 ⇒ 「单位 + 数量」，四语同序（此处验 zh / en）
    'currency.zh.present': Boolean(currencyOrder.zh && currencyOrder.zh.text.length > 0),
    'currency.zh.battUnitFirst': Boolean(currencyOrder.zh && currencyOrder.zh.battUnitFirst),
    'currency.zh.noEmojiSpace': Boolean(currencyOrder.zh && currencyOrder.zh.noEmojiSpace),
    'currency.zh.symbolBeforeAmount': Boolean(currencyOrder.zh && currencyOrder.zh.currencyUnitFirst),
    'currency.zh.noSymbolSpace': Boolean(currencyOrder.zh && currencyOrder.zh.noSymbolSpace),
    'currency.zh.noQtyBeforeSymbol': Boolean(currencyOrder.zh && currencyOrder.zh.noTrailingSymbol),
    'currency.zh.noQtyBeforeTicker': Boolean(currencyOrder.zh && currencyOrder.zh.noTickerQuantity),
    'currency.zh.noTickerLiteral': Boolean(currencyOrder.zh && currencyOrder.zh.noTickerAtAll),
    'currency.en.present': Boolean(currencyOrder.en && currencyOrder.en.text.length > 0),
    'currency.en.battUnitFirst': Boolean(currencyOrder.en && currencyOrder.en.battUnitFirst),
    'currency.en.noEmojiSpace': Boolean(currencyOrder.en && currencyOrder.en.noEmojiSpace),
    'currency.en.symbolBeforeAmount': Boolean(currencyOrder.en && currencyOrder.en.currencyUnitFirst),
    'currency.en.noSymbolSpace': Boolean(currencyOrder.en && currencyOrder.en.noSymbolSpace),
    'currency.en.noQtyBeforeSymbol': Boolean(currencyOrder.en && currencyOrder.en.noTrailingSymbol),
    'currency.en.noQtyBeforeTicker': Boolean(currencyOrder.en && currencyOrder.en.noTickerQuantity),
    'currency.en.noTickerLiteral': Boolean(currencyOrder.en && currencyOrder.en.noTickerAtAll),
    // ⑤
    'pageerror.zero': pageErrors.length === 0,
  }

  const passed = Object.values(checks).filter(Boolean).length
  out.assertions = checks
  out.counts = {
    checks: Object.keys(checks).length,
    passed,
    failed: Object.keys(checks).length - passed,
    pageerror: pageErrors.length,
    consoleErrors: consoleErrors.length,
  }
  out.readings = {
    desktop: desktop ? { hCenterDev: desktop.hCenterDev, vCenterRatio: desktop.vCenterRatio, fontSize: desktop.fontSize, hostZ: creditSnap.host.zIndex, text: desktop.text } : null,
    mobile: mobile ? { hCenterDev: mobile.hCenterDev, vCenterRatio: mobile.vCenterRatio, fontSize: mobile.fontSize } : null,
    dark: dark ? { color: dark.color, background: dark.background, fontSize: dark.fontSize, hCenterDev: dark.hCenterDev, vCenterRatio: dark.vCenterRatio, theme: creditDark.theme } : null,
    ordinary: ord ? { top: ord.rect.top, rightGap: ord.rightGap, fontSize: ord.fontSize, hostZ: ordSnap.host.zIndex } : null,
    currencyOrder: Object.fromEntries(Object.entries(currencyOrder).map(([lang, v]) => [lang, {
      url: v.url, text: v.text,
      battUnitFirst: v.battUnitFirst, noEmojiSpace: v.noEmojiSpace,
      currencyUnitFirst: v.currencyUnitFirst, noSymbolSpace: v.noSymbolSpace,
      noTrailingSymbol: v.noTrailingSymbol, noTickerQuantity: v.noTickerQuantity, noTickerAtAll: v.noTickerAtAll,
      noLiteralDollarSpace: v.noLiteralDollarSpace,
    }])),
  }
  out.errors = { pageerror: pageErrors.slice(0, 10), console: consoleErrors.slice(0, 10) }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)

  const failedKeys = Object.entries(checks).filter(([, v]) => !v).map(([k2]) => k2)
  console.log(JSON.stringify({ out: OUT, counts: out.counts, readings: out.readings, failed: failedKeys }, null, 2))
  if (failedKeys.length) process.exitCode = 2
}
