/**
 * 【我的邀请】`/profile/invite` 真浏览器探针（Kevin 2026-10-24 需求）
 *
 * 口径（逐条对齐派单验证项 ①–⑥）：
 *   ① 左栏菜单顺序：`我的邀请` 条目**存在**且排在 `我的收藏` 与 `账户设置` **之间**（按 DOM 钩子序列核，不按类名）；
 *   ② 未绑定态：6 格可输入（各格 `disabled=false`）、在**第 1 格粘贴 `000100`** ⇒ 6 格逐个填满（`0 0 0 1 0 0`）、
 *      **提交钮转为可用**；且点提交发出的 `POST /api/referral/bind` 体里 `inviter_uid === 100`（补零解析在前端完成）；
 *   ③ 提交成功（夹具 200）⇒ **Toast 出现**（成功文案只在 Toast，**卡内零成功文案**）；
 *   ④ 提交失败（夹具 409 `LD003` + `REFERRAL_ALREADY_BOUND`）⇒ **卡内内联 `role="alert"`** 且 **无 Toast**；
 *   ⑤ 已绑定态（夹具 `bound=true` / `parent_uid=100`）⇒ 显示「已绑定邀请人 000100」+ 6 格 `disabled` + **无提交钮**；
 *   ⑥ 390 / 1536 零横向溢出、`pageerror` 0；**≤767 每格触控 ≥ 44px**（390 与 767 两档实测）。
 *
 * 手法（同 `ops/profile-assets/probe-asset-cards.mjs` 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（`addInitScript`）；**全部 API 在 route 内自截**（零后端、**生产库零写入**）；
 *   · 禁动画 + 稳态采样；只读仓内文件，不写源码。
 *
 * 用法：node ops/profile-invite/probe-profile-invite.mjs [out.json]
 *   QA_DIST=<dist> 可覆盖产物目录。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-invite/readings/probe-profile-invite.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const NAV_INVITE = ZH.profileNav.invite            // 我的邀请
const NAV_FAVORITES = ZH.profileNav.favorites      // 我的收藏
const NAV_SETTINGS = ZH.profileNav.settings        // 账户设置
const OK_TEXT = ZH.invite.ok                       // 邀请人绑定成功
const ERR_TEXT = ZH.invite.err                     // 绑定失败：…
const BOUND_TEXT = ZH.invite.bound                 // 已绑定邀请人

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（探针内内存；形状 = 冻结契约，**不触真实后端 / 不写库**） ----
const STATE = {
  me: { bound: false, parent_uid: null, bound_at: null, depth: null },
  bindMode: 'ok',            // 'ok' | 'conflict'
  calls: [],
}

const apiResponse = (method, pathname, bodyText) => {
  const ok = (data, message) => ({ success: true, data, message })
  const fail = (code, message, details) => ({ success: false, error: { code, message, ...(details ? { details } : {}) } })

  if (pathname === '/api/referral/me') {
    STATE.calls.push({ method, path: pathname })
    return { status: 200, body: ok(STATE.me) }
  }
  if (pathname === '/api/referral/bind') {
    let parsed = {}
    try { parsed = JSON.parse(bodyText || '{}') } catch { parsed = {} }
    STATE.calls.push({ method, path: pathname, body: parsed })
    if (STATE.bindMode === 'conflict') {
      return {
        status: 409,
        body: fail('LD003', 'Referral already bound', { reason: 'REFERRAL_ALREADY_BOUND', bound_parent_uid: '100' }),
      }
    }
    // 成功臂：夹具回执（`depth` 是只读回执 —— 真值由 DB 触发器算，这里只演形状）
    STATE.me = { bound: true, parent_uid: 100, bound_at: '2026-10-24T05:00:00.000Z', depth: 2 }
    return { status: 200, body: ok({ parent_uid: 100, depth: 2, bound_at: '2026-10-24T05:00:00.000Z' }, 'Referral bound') }
  }
  if (pathname === '/api/user') {
    return { status: 200, body: ok({ uID: 100100, uid: 100100, name: 'Probe', bio: 'probe', avatar_url: null }) }
  }
  if (/^\/api\/user\/asset\//.test(pathname)) return { status: 200, body: ok({ points: '100', time_update: null }) }
  if (pathname === '/api/user/balances') return { status: 200, body: ok([]) }
  if (pathname === '/api/messages/unread-count') return { status: 200, body: ok({ unread_total: 0 }) }
  if (pathname === '/api/batt') return { status: 200, body: ok({ batt: 70, capBatt: 100, canAccept: true, bttc: null }) }
  if (method === 'GET') return { status: 200, body: ok({ rows: [], next_cursor: null, total: 0 }) }
  return { status: 200, body: ok({}) }
}

// ---- 页内读数（一次性取全） ----
const SNAP_FN = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
  const rect = (el) => (el ? el.getBoundingClientRect() : null)
  const de = document.documentElement
  const nav = q('[data-sf-m="profile-nav"]')
  const pane = q('[data-sf-m="invite-pane"]')
  const paneText = txt(pane)
  const cells = qa('[data-sf-m^="invite-otp-cell-"]')
  const submit = q('[data-sf-m="invite-submit"]')
  const err = q('[data-sf-m="invite-error"]')
  const toastRoot = q('[data-sf-m="toast-host"]')
  // Toast 取证：任何含成功文案、且**不在邀请 pane 内**的元素（react-hot-toast 的 role=status 面）
  const toastLike = qa('body *').filter((el) => {
    const t = txt(el)
    return t && t.length < 120 && (t === window.__probeOkText || t.includes(window.__probeOkText))
      && !el.closest('[data-sf-m="invite-pane"]')
  }).map((el) => ({
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    ariaLive: el.getAttribute('aria-live'),
    text: txt(el),
    inToastHost: !!el.closest('[data-sf-m="toast-host"]'),
  }))
  const cw = de.clientWidth
  const scrollHostOf = (el) => {
    let p = el.parentElement
    while (p && p !== document.body) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return String(p.className || p.tagName).split(' ')[0]
      p = p.parentElement
    }
    return null
  }
  const offenders = qa('*').filter((el) => {
    const b = el.getBoundingClientRect()
    return b.width > 0 && b.right > cw + 1
  }).map((el) => ({
    sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}`,
    right: Math.round(el.getBoundingClientRect().right),
    // 刻意放在 `overflow-x:auto` 容器内（手机档横向页签）⇒ 自身滚动，不算文档溢出
    inScrollHost: scrollHostOf(el),
  }))
  return {
    viewport: { w: innerWidth, h: innerHeight },
    pathname: location.pathname,
    overflowPx: de.scrollWidth - cw,
    offenders,
    nav: {
      present: !!nav,
      hookOrder: nav ? [...nav.querySelectorAll('[data-sf-m]')].map((el) => el.getAttribute('data-sf-m')) : [],
      itemOrder: nav ? [...nav.querySelectorAll('[data-sf-m]')].map((el) => txt(el)) : [],
      inviteLabel: nav ? txt(nav.querySelector('[data-sf-m="profile-nav-invite"]')) : null,
      inviteHref: nav ? (nav.querySelector('[data-sf-m="profile-nav-invite"]') || {}).getAttribute?.('href') : null,
    },
    pane: {
      present: !!pane,
      title: txt(pane ? pane.querySelector('h1') : null),
      text: paneText,
      cellCount: cells.length,
      cells: cells.map((el) => {
        const r = rect(el)
        return {
          hook: el.getAttribute('data-sf-m'),
          value: el.value,
          disabled: !!el.disabled,
          inputMode: el.getAttribute('inputmode'),
          w: r ? Math.round(r.width * 10) / 10 : null,
          h: r ? Math.round(r.height * 10) / 10 : null,
        }
      }),
      digits: cells.map((el) => el.value).join(''),
      submit: submit ? { present: true, disabled: !!submit.disabled, text: txt(submit) } : { present: false },
      bound: {
        present: !!q('[data-sf-m="invite-bound"]'),
        uid: txt(q('[data-sf-m="invite-bound-uid"]')),
        text: txt(q('[data-sf-m="invite-bound"]')),
        hint: txt(q('#sf-invite-bound-hint')),
      },
      error: err ? { present: true, role: err.getAttribute('role'), text: txt(err) } : { present: false },
      hasOkText: paneText ? paneText.includes(window.__probeOkText) : false,
      loading: !!q('[data-sf-m="invite-loading"]'),
    },
    toast: {
      hostPresent: !!toastRoot,
      hits: toastLike,
      textAll: qa('[role="status"], [data-sf-m="toast-host"] *').map((el) => txt(el)).filter(Boolean).slice(0, 12),
    },
  }
}

async function settle(page, max = 40) {
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(() => {
      const r = document.getElementById('root')
      return `${r ? r.innerHTML.length : 0}|${document.querySelectorAll('*').length}`
    })
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

const seedAuth = (ctx) => ctx.addInitScript((okText) => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: 100100, uid: 100100, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
  window.__probeOkText = okText
  // 禁动画（读数稳定）
  const st = document.createElement('style')
  st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st))
}, OK_TEXT)

const newPage = async (browser, viewport) => {
  const pageErrors = []
  const consoleErrors = []
  const ctx = await browser.newContext({ viewport, locale: 'zh-CN' })
  await attachRoutes(ctx)
  await seedAuth(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
  return { ctx, page, pageErrors, consoleErrors }
}

const open = async (page, url, selector) => {
  await page.goto(`${ORIGIN}${url}`, { waitUntil: 'domcontentloaded' })
  if (selector) await page.waitForSelector(selector, { timeout: 8000 }).catch(() => {})
  await settle(page)
  return page.evaluate(SNAP_FN)
}

/** 在第 1 格粘贴整串（合成 ClipboardEvent；React onPaste 走同一入口） */
const pasteAt = async (page, index, text) => {
  await page.evaluate(({ i, t }) => {
    const el = document.querySelector(`[data-sf-m="invite-otp-cell-${i}"]`)
    if (!el) return
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, { i: index, t: text })
  await settle(page)
}

const main = async () => {
  const out = { meta: { dist: DIST, origin: ORIGIN, startedAt: new Date().toISOString(), fixture: 'in-page route interception (zero backend / zero db write)' }, states: {}, assertions: {} }
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--disable-lcd-text'],
  })

  // ======================= ① 左栏菜单定序（1536 桌面档） =======================
  const d = await newPage(browser, { width: 1536, height: 960 })
  const navSnap = await open(d.page, '/profile/invite', '[data-sf-m="invite-pane"]')
  const hookOrder = navSnap.nav.hookOrder
  const iFav = hookOrder.indexOf('profile-nav-favorites')
  const iInv = hookOrder.indexOf('profile-nav-invite')
  const iSet = hookOrder.indexOf('profile-nav-settings')
  out.states.nav = navSnap.nav
  out.assertions.nav = {
    navPresent: navSnap.nav.present === true,
    inviteHookPresent: iInv >= 0,
    inviteBetweenFavoritesAndSettings: iFav >= 0 && iInv === iFav + 1 && iSet === iInv + 1,
    inviteLabelIsInvite: navSnap.nav.inviteLabel === NAV_INVITE,
    favoritesLabelIntact: navSnap.nav.itemOrder[hookOrder.indexOf('profile-nav-favorites')] === NAV_FAVORITES,
    settingsLabelIntact: navSnap.nav.itemOrder[hookOrder.indexOf('profile-nav-settings')] === NAV_SETTINGS,
    inviteHrefLocalized: /\/profile\/invite$/.test(navSnap.nav.inviteHref || ''),
  }

  // ======================= ② 未绑定态：6 格 / 粘贴 / 提交可用 =======================
  STATE.me = { bound: false, parent_uid: null, bound_at: null, depth: null }
  STATE.bindMode = 'ok'
  STATE.calls.length = 0
  const beforePaste = await open(d.page, '/profile/invite', '[data-sf-m="invite-pane"]')
  await pasteAt(d.page, 0, '000100')
  const afterPaste = await d.page.evaluate(SNAP_FN)
  out.states.unbound = { beforePaste: beforePaste.pane, afterPaste: afterPaste.pane, calls: STATE.calls.map((c) => `${c.method} ${c.path}`) }
  out.assertions.unbound = {
    panePresent: beforePaste.pane.present === true,
    titleIsInvite: beforePaste.pane.title === NAV_INVITE,
    sixCells: beforePaste.pane.cellCount === 6,
    cellsEditable: beforePaste.pane.cells.every((c) => c.disabled === false),
    cellsNumericInputMode: beforePaste.pane.cells.every((c) => c.inputMode === 'numeric'),
    submitHiddenBefore6: beforePaste.pane.submit.present === true && beforePaste.pane.submit.disabled === true,
    pasteFillsAllSix: afterPaste.pane.digits === '000100',
    submitEnabledAfterPaste: afterPaste.pane.submit.present === true && afterPaste.pane.submit.disabled === false,
    noErrorBeforeSubmit: afterPaste.pane.error.present === false,
  }

  // ======================= ③ 提交成功 ⇒ Toast（卡内零成功文案） =======================
  STATE.calls.length = 0
  await d.page.evaluate(() => { window.__toastMark = document.body.innerHTML.length })
  await d.page.click('[data-sf-m="invite-submit"]')
  await d.page.waitForFunction((okText) => {
    const hits = [...document.querySelectorAll('body *')].filter((el) => {
      const t = (el.textContent || '').trim()
      return t === okText && !el.closest('[data-sf-m="invite-pane"]')
    })
    return hits.length > 0
  }, OK_TEXT, { timeout: 6000 }).catch(() => {})
  await settle(d.page)
  const okSnap = await d.page.evaluate(SNAP_FN)
  const bindCall = STATE.calls.filter((c) => c.path === '/api/referral/bind').pop()
  out.states.success = { pane: okSnap.pane, toast: okSnap.toast, bindBody: bindCall ? bindCall.body : null, calls: STATE.calls.map((c) => `${c.method} ${c.path}`) }
  out.assertions.success = {
    postSent: !!bindCall,
    inviterUidParsed: bindCall ? Number(bindCall.body?.inviter_uid) === 100 : false,
    toastShown: okSnap.toast.hits.length > 0,
    toastNotInsidePane: okSnap.toast.hits.every((h) => h.inToastHost || !h.text.includes(NAV_INVITE)),
    noInlineSuccessText: okSnap.pane.hasOkText === false,
    noInlineSuccessHook: okSnap.pane.error.present === false,
    meReloadedAfterBind: STATE.calls.some((c) => c.path === '/api/referral/me') && okSnap.pane.bound.present === true,
    boundUidPadded: okSnap.pane.bound.uid === '000100',
    cellsClearedAfterBind: okSnap.pane.digits === '000100' || okSnap.pane.digits === '',
  }

  // ======================= ④ 失败（409）⇒ 内联 alert + 无 Toast =======================
  const f = await newPage(browser, { width: 1536, height: 960 })
  STATE.me = { bound: false, parent_uid: null, bound_at: null, depth: null }
  STATE.bindMode = 'conflict'
  STATE.calls.length = 0
  await open(f.page, '/profile/invite', '[data-sf-m="invite-pane"]')
  await pasteAt(f.page, 0, '000100')
  await f.page.click('[data-sf-m="invite-submit"]')
  await f.page.waitForSelector('[data-sf-m="invite-error"]', { timeout: 6000 }).catch(() => {})
  await f.page.waitForTimeout(1200)   // Toast 若存在应在 1.2s 内出现（等满再判「无」）
  const failSnap = await f.page.evaluate(SNAP_FN)
  const failCall = STATE.calls.filter((c) => c.path === '/api/referral/bind').pop()
  out.states.failure409 = {
    pane: failSnap.pane,
    toast: failSnap.toast,
    bindBody: failCall ? failCall.body : null,
    calls: STATE.calls.map((c) => `${c.method} ${c.path}`),
  }
  const errText = failSnap.pane.error.text || ''
  out.assertions.failure409 = {
    postSent: !!failCall,
    inlineAlertShown: failSnap.pane.error.present === true && failSnap.pane.error.role === 'alert',
    inlineTextIsInviteErr: errText === ERR_TEXT,
    inlineHidesMachineCode: !/REFERRAL_|LD003/.test(errText),
    noToast: failSnap.toast.hits.length === 0,
    noOkTextAnywhere: (failSnap.toast.textAll || []).every((t) => !t.includes(OK_TEXT)),
    paneStillInteractive: failSnap.pane.present === true && failSnap.pane.submit.present === true,
    cellsKept: failSnap.pane.digits === '000100',
    zeroPageError: f.pageErrors.length === 0,
  }

  // ======================= ⑤ 已绑定态：只读 =======================
  const b = await newPage(browser, { width: 1536, height: 960 })
  STATE.bindMode = 'ok'
  STATE.me = { bound: true, parent_uid: 100, bound_at: '2026-10-24T05:00:00.000Z', depth: 2 }
  STATE.calls.length = 0
  const boundSnap = await open(b.page, '/profile/invite', '[data-sf-m="invite-pane"]')
  out.states.bound = { pane: boundSnap.pane, calls: STATE.calls.map((c) => `${c.method} ${c.path}`) }
  out.assertions.bound = {
    boundBlockShown: boundSnap.pane.bound.present === true,
    boundTextHasLabel: (boundSnap.pane.bound.text || '').includes(BOUND_TEXT),
    boundUidZeroPadded: boundSnap.pane.bound.uid === '000100',
    sixCellsShown: boundSnap.pane.cellCount === 6,
    cellsAllDisabled: boundSnap.pane.cells.length === 6 && boundSnap.pane.cells.every((c) => c.disabled === true),
    cellsReadShowBoundUid: boundSnap.pane.digits === '000100',
    noSubmitButton: boundSnap.pane.submit.present === false,
    hintShown: !!boundSnap.pane.bound.hint,
    zeroPageError: b.pageErrors.length === 0,
  }

  // ======================= ⑥ 390 / 1536 零溢出 + 触控 ≥44（≤767） =======================
  out.assertions.desktop1536 = {
    zeroOverflow: navSnap.overflowPx === 0,
    noOffenders: (navSnap.offenders || []).filter((o) => !o.inScrollHost).length === 0,
    zeroPageError: d.pageErrors.length === 0,
    zeroConsoleError: d.consoleErrors.length === 0,
  }

  const mobile = {}
  for (const width of [390, 767]) {
    const m = await newPage(browser, { width, height: 844 })
    STATE.me = { bound: false, parent_uid: null, bound_at: null, depth: null }
    STATE.bindMode = 'ok'
    const snap = await open(m.page, '/profile/invite', '[data-sf-m="invite-pane"]')
    mobile[`w${width}`] = { snapshot: { overflowPx: snap.overflowPx, offenders: snap.offenders, pane: snap.pane, nav: snap.nav }, pageErrors: m.pageErrors, consoleErrors: m.consoleErrors }
    out.assertions[`mobile${width}`] = {
      sixCells: snap.pane.cellCount === 6,
      zeroOverflow: snap.overflowPx === 0,
      noOffenders: (snap.offenders || []).filter((o) => !o.inScrollHost).length === 0,
      // 诚实登记：390 档横向页签刻意在 `.sf-prof-nav`（`overflow-x:auto`）内滚动
      offscreenInsideScrollHost: (snap.offenders || []).filter((o) => o.inScrollHost).length,
      eachCellAtLeast44: snap.pane.cells.length === 6 && snap.pane.cells.every((c) => c.h >= 44 && c.w >= 44),
      zeroPageError: m.pageErrors.length === 0,
      inviteInNav: snap.nav.hookOrder.includes('profile-nav-invite'),
    }
    await m.ctx.close()
  }
  out.states.mobile = mobile

  // ======================= 汇总 =======================
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  ))
  const evaluated = flat(out.assertions).filter(([, v]) => typeof v === 'boolean')
  const failed = evaluated.filter(([, v]) => v !== true).map(([k, v]) => [k, v])
  out.summary = {
    checks: evaluated.length,
    passed: evaluated.length - failed.length,
    failed,
    pageErrors: d.pageErrors.length + f.pageErrors.length + b.pageErrors.length,
    verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  }
  out.finishedAt = new Date().toISOString()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(JSON.stringify(out.summary, null, 2))
  console.log(`readings ⇒ ${OUT}`)

  await browser.close()
  process.exit(out.summary.verdict === 'PASS' ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
