/**
 * 项目页 `/:slug` · 加入 / 切换 / 已在职 三态入口探针（★ 2026-10-23）
 *
 * 判据（逐条对齐派单验证项）：
 *   ① 三态按钮（只认详情读口 `GET /api/project/:ref` 的登录态加性四键）：
 *        `my_role='none'` ∧ 无 `my_current_project_id` ⇒ `project-entry-join`（文案 = project.joinEntry）；
 *        `my_role='none'` ∧ `my_current_project_id=12` ⇒ `project-entry-switch`（文案 = project.switchEntry）；
 *        `my_role='hired'` ⇒ `project-entry-hired`（文案 = project.alreadyHired 且 disabled）；
 *        三态**互斥**（同屏恰一枚入口；confirm 行展开时恰两枚 = 确认 + 取消）。
 *   ② 切换确认行：点【切换到此项目】⇒ 行内 `project-entry-switch-confirm` + `project-switch-confirm-text`
 *      （文案含「当前在职」标题），**确认前零 apply 请求**（点开 = 纯本地状态）；【取消】⇒ 回到切换态、
 *      仍零请求；【确认切换】⇒ 恰 1 次 `POST /api/project/:id/apply`，载荷**恰** `{switch:true}`
 *      ⇒ 内联 ok 提示（switchedOk）+ 静默重拉 ⇒ 入口翻成【已在职】。
 *   ③ 加入态：点【加入此项目】⇒ 恰 1 次 POST，载荷**恰** `{}`（空对象，不得夹带 switch）；
 *      ⇒ 内联 ok（joinedToast）+ 重拉 ⇒ 【已在职】。
 *   ④ 失败臂：409 `project_headcount_full` ⇒ 入口区**内联 err**（中文四闸映射 + HTTP 409）、
 *      不谎报成功（无 ok 提示、仍是切换态、不重拉）；恰 1 次写请求。
 *   ⑤ 客态（独立 context、无登录种子）：`project-join` 整区不渲染、零写请求。
 *   ⑥ 390 / 1536 两档：`scrollWidth - clientWidth = 0`、入口不出视口 + 零 pageerror。
 *
 * 手法（= ops/project-page/probe-project-page.mjs）：
 *   · 静态服务 = `context.route` 把 http://sf.local/** 映射到磁盘 dist（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全部在 `context.route` 内自截（零后端 / 零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node ops/project/probe-project-join.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/project/readings/probe-project-join.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const VIEWER_UID = 971001 // 非 owner（owner_uid = 970213）⇒ canManage=false ⇒ 加入区自己承载内联提示
const PROJECT_ID = 11
const OTHER_PROJECT_ID = '12'
const OTHER_PROJECT_TITLE = '冷库分拣'

const baseView = (patch = {}) => ({
  project_id: PROJECT_ID,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单，按批结算。',
  headcount: 3,
  hired_count: 1,
  recruit_min_account_days: 1,
  wage_batt_per_claim: 30,
  wage_cid: 4,
  wage_currency_amount: 20,
  wage_interval_hours: 4,
  status: 'recruiting',
  owner_uid: '970213',
  avatar_url: null,
  campaigns: [],
  ...patch,
})

const STATE = {
  view: baseView(),
  userPayload: { uID: VIEWER_UID },
  applyMode: 'ok', // ok | full（409 满员）| not_recruiting（409 招募期）
  calls: [],
  bodies: [],
}

const ok = (data) => ({ success: true, data })
const fail = (status, code, details) => ({
  __status: status,
  body: { success: false, error: { code, details } },
})

const apiResponse = (method, pathname, rawBody) => {
  const body = (() => {
    try { return rawBody ? JSON.parse(rawBody) : null } catch { return null }
  })()
  if (pathname === '/api/user') return ok(STATE.userPayload)
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }])
  if (pathname === '/api/project/sui') { STATE.calls.push({ method, path: pathname }); return ok(STATE.view) }
  if (pathname === '/api/project/all') return ok([])
  if (pathname === '/api/batt') {
    return ok({
      batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
      bttc: { balance: '0', status: 'listed', canMint: false, canBurn: false, usdBalance: '0', policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1 } },
    })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })

  const apply = pathname.match(/^\/api\/project\/(\d+)\/apply$/)
  if (apply && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.push({ projectId: apply[1], body })
    if (STATE.applyMode === 'full') {
      return fail(409, 'PROJECT_HEADCOUNT_FULL', { reason: 'project_headcount_full' })
    }
    if (STATE.applyMode === 'not_recruiting') {
      return fail(409, 'PROJECT_NOT_RECRUITING', { reason: 'project_not_recruiting' })
    }
    // 成功：本项目在职 ⇒ 三态翻成【已在职】（切换臂响应加性 `switched_from`）
    const switchedFrom = body && body.switch === true ? OTHER_PROJECT_ID : null
    STATE.view = baseView({
      ...STATE.view,
      my_role: 'hired',
      my_hired_at: new Date().toISOString(),
      my_current_project_id: null,
      my_current_project_title: null,
    })
    return ok({ applied: true, project: { project_id: PROJECT_ID, title: STATE.view.title }, switched_from: switchedFrom })
  }
  if (method === 'GET' && /^\/api\/project\/[^/]+$/.test(pathname)) {
    STATE.calls.push({ method, path: pathname })
    return fail(404, 'PROJECT_NOT_FOUND', { reason: 'project_not_found' })
  }
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数（加入区 / 三态入口 / 内联提示 / 几何） ----------------------------------------------
const SNAP_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const entry = (sel) => {
    const el = q(sel)
    if (!el) return { present: false }
    const r = el.getBoundingClientRect()
    return {
      present: true,
      text: txt(el),
      action: el.getAttribute('data-sf-action'),
      disabled: !!el.disabled,
      h: Math.round(r.height * 10) / 10,
      right: Math.round(r.right * 10) / 10,
    }
  }
  const section = q('[data-sf-m="project-join"]')
  const notice = section ? section.querySelector('[data-sf-m="project-form-notice"]') : null
  const r = section ? section.getBoundingClientRect() : null
  const de = document.documentElement
  return {
    pathname: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    pagePresent: !!q('[data-sf-m="project-page"]'),
    join: {
      present: !!section,
      // 三态互斥读数：每枚入口独立取（不靠「谁先命中」）
      joinEntry: entry('[data-sf-m="project-entry-join"]'),
      switchEntry: entry('[data-sf-m="project-entry-switch"]'),
      confirmEntry: entry('[data-sf-m="project-entry-switch-confirm"]'),
      cancelEntry: entry('[data-sf-m="project-entry-switch-cancel"]'),
      hiredEntry: entry('[data-sf-m="project-entry-hired"]'),
      confirmText: txt(q('[data-sf-m="project-switch-confirm-text"]')),
      entryCount: section ? section.querySelectorAll('[data-sf-m^="project-entry-"]').length : 0,
      notice: notice ? { kind: notice.getAttribute('data-sf-kind'), text: txt(notice) } : null,
      right: r ? Math.round(r.right * 10) / 10 : null,
      left: r ? Math.round(r.left * 10) / 10 : null,
    },
    manage: {
      present: !!q('[data-sf-m="project-manage"]'),
      notice: (() => {
        const n = q('[data-sf-m="project-manage"] [data-sf-m="project-form-notice"]')
        return n ? { kind: n.getAttribute('data-sf-kind'), text: txt(n) } : null
      })(),
    },
  }
})()`

async function settle(page, max = 40) {
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(`(()=>{const r=document.getElementById('root');return (r?r.innerHTML.length:0)+'|'+document.querySelectorAll('*').length})()`)
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      const payload = apiResponse(req.method(), u.pathname, req.postData())
      const status = payload && payload.__status ? payload.__status : 200
      const body = payload && payload.__status ? payload.body : payload
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' },
      body: fs.readFileSync(file),
    })
  })
}

const writes = () => STATE.calls.filter((c) => c.method !== 'GET')
const reads = () => STATE.calls.filter((c) => c.path === '/api/project/sui')

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 971001, uid: 971001, token: 'probe-token', bio: 'probe', name: 'Probe' }))
    localStorage.setItem('token', 'probe-token')
  })
  await attachRoutes(context)

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))

  const out = {
    probe: 'ops/project/probe-project-join.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: {
      project: `${PROJECT_ID}/sui`,
      viewer: VIEWER_UID,
      owner: 970213,
      auth: 'localStorage seed only',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {}, assertions: {}, pageErrors,
  }

  const open = async (url, waitSel) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    if (waitSel) await page.waitForSelector(waitSel, { timeout: 8000 }).catch(() => {})
    await settle(page)
    return page.evaluate(SNAP_FN)
  }

  // ============================ ① 加入态（my_role=none ∧ 无在职项目） ============================
  STATE.view = baseView({ my_role: 'none' })
  STATE.calls.length = 0
  STATE.bodies.length = 0
  const joinSnap = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_join_state'] = joinSnap.join
  out.assertions.joinState = {
    sectionPresent: joinSnap.join.present === true,
    joinEntryPresent: joinSnap.join.joinEntry.present === true,
    joinEntryText: joinSnap.join.joinEntry.text === ZH.project.joinEntry,
    joinEntryAction: joinSnap.join.joinEntry.action === 'join',
    joinEntryEnabled: joinSnap.join.joinEntry.disabled === false,
    // 三态互斥：同屏只有一枚入口，且不是切换 / 已在职
    onlyOneEntry: joinSnap.join.entryCount === 1,
    noSwitchEntry: joinSnap.join.switchEntry.present === false,
    noHiredEntry: joinSnap.join.hiredEntry.present === false,
    noConfirmRow: joinSnap.join.confirmEntry.present === false && joinSnap.join.cancelEntry.present === false,
    noNoticeYet: joinSnap.join.notice === null,
    manageAbsent: joinSnap.manage.present === false,
    zeroWritesOnLoad: writes().length === 0,
  }

  // ============================ ② 加入点击 ⇒ 恰 1 次 POST {} ⇒ 已在职 ============================
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await page.click('[data-sf-m="project-entry-join"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-m="project-entry-hired"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const afterJoin = await page.evaluate(SNAP_FN)
  const joinBody = STATE.bodies[0] || null
  out.states['1536_after_join'] = {
    join: afterJoin.join,
    writes: STATE.calls.filter((c) => c.method !== 'GET'),
    body: joinBody,
    reads: reads().length,
  }
  out.assertions.joinClick = {
    postOnce: STATE.bodies.length === 1,
    pathIsApply: Boolean(joinBody && joinBody.projectId === String(PROJECT_ID)),
    bodyEmpty: Boolean(joinBody) && JSON.stringify(joinBody.body) === '{}',
    noSwitchKey: Boolean(joinBody) && !Object.prototype.hasOwnProperty.call(joinBody.body || {}, 'switch'),
    noticeOk: Boolean(afterJoin.join.notice && afterJoin.join.notice.kind === 'ok'),
    noticeText: Boolean(afterJoin.join.notice && afterJoin.join.notice.text === ZH.wage.joinedToast.replace('{{title}}', '海鲜打包')),
    flippedToHired: afterJoin.join.hiredEntry.present === true && afterJoin.join.joinEntry.present === false,
    hiredEntryDisabled: afterJoin.join.hiredEntry.disabled === true,
    // 重拉 = 三态翻转的**唯一**来源（`my_role` 是读口加的键，本地没有）⇒ 至少 1 次详情读口
    relisted: reads().length >= 1,
  }

  // ============================ ③ 已在职态（重进页面） ============================
  STATE.calls.length = 0
  const hiredSnap = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_hired_state'] = hiredSnap.join
  out.assertions.hiredState = {
    hiredEntryPresent: hiredSnap.join.hiredEntry.present === true,
    hiredEntryText: hiredSnap.join.hiredEntry.text === ZH.project.alreadyHired,
    hiredEntryDisabled: hiredSnap.join.hiredEntry.disabled === true,
    onlyOneEntry: hiredSnap.join.entryCount === 1,
    noJoinEntry: hiredSnap.join.joinEntry.present === false,
    noSwitchEntry: hiredSnap.join.switchEntry.present === false,
    zeroWrites: writes().length === 0,
  }

  // ============================ ④ 切换态（my_current_project_id=12） ============================
  STATE.view = baseView({ my_role: 'none', my_current_project_id: OTHER_PROJECT_ID, my_current_project_title: OTHER_PROJECT_TITLE })
  STATE.calls.length = 0
  STATE.bodies.length = 0
  const switchSnap = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_switch_state'] = switchSnap.join
  out.assertions.switchState = {
    switchEntryPresent: switchSnap.join.switchEntry.present === true,
    switchEntryText: switchSnap.join.switchEntry.text === ZH.project.switchEntry,
    switchEntryAction: switchSnap.join.switchEntry.action === 'switch',
    onlyOneEntry: switchSnap.join.entryCount === 1,
    noJoinEntry: switchSnap.join.joinEntry.present === false,
    zeroWritesOnLoad: writes().length === 0,
  }

  // ============================ ④-b 点开切换 ⇒ 行内确认、确认前零 apply ============================
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await page.click('[data-sf-m="project-entry-switch"]')
  await settle(page)
  const confirmSnap = await page.evaluate(SNAP_FN)
  out.states['1536_switch_confirm_open'] = { join: confirmSnap.join, writes: writes().map((c) => c.path) }
  out.assertions.switchConfirm = {
    confirmRowOpens: confirmSnap.join.confirmEntry.present === true,
    confirmEntryAction: confirmSnap.join.confirmEntry.action === 'switch',
    cancelPresent: confirmSnap.join.cancelEntry.present === true,
    confirmTextHasCurrentTitle: String(confirmSnap.join.confirmText || '').includes(OTHER_PROJECT_TITLE),
    confirmTextIsLocale: Boolean(confirmSnap.join.confirmText)
      && confirmSnap.join.confirmText === ZH.project.switchConfirm.replace('{{title}}', OTHER_PROJECT_TITLE),
    // ★ 确认前零 apply（点开 = 纯本地状态，不发请求）
    zeroWritesBeforeConfirm: writes().length === 0,
    switchEntryReplaced: confirmSnap.join.switchEntry.present === false,
    twoEntriesOnly: confirmSnap.join.entryCount === 2,
  }

  // 取消 ⇒ 回到切换态、仍零请求
  await page.click('[data-sf-m="project-entry-switch-cancel"]')
  await settle(page)
  const cancelSnap = await page.evaluate(SNAP_FN)
  out.states['1536_switch_cancelled'] = { join: cancelSnap.join, writes: writes().map((c) => c.path) }
  out.assertions.switchCancel = {
    backToSwitch: cancelSnap.join.switchEntry.present === true && cancelSnap.join.confirmEntry.present === false,
    zeroWritesAfterCancel: writes().length === 0,
    confirmTextGone: cancelSnap.join.confirmText === null,
  }

  // ============================ ④-c 确认切换 ⇒ 恰 1 次 POST {switch:true} ⇒ 已在职 ============================
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await page.click('[data-sf-m="project-entry-switch"]')
  await settle(page)
  await page.click('[data-sf-m="project-entry-switch-confirm"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-m="project-entry-hired"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const afterSwitch = await page.evaluate(SNAP_FN)
  const switchBody = STATE.bodies[0] || null
  out.states['1536_after_switch'] = {
    join: afterSwitch.join,
    writes: STATE.calls.filter((c) => c.method !== 'GET'),
    body: switchBody,
    reads: reads().length,
  }
  out.assertions.switchConfirmSubmit = {
    postOnce: STATE.bodies.length === 1,
    // 载荷闭集：恰 `{switch:true}`（不得夹带其它键）
    bodyExactlySwitch: Boolean(switchBody) && JSON.stringify(switchBody.body) === JSON.stringify({ switch: true }),
    pathIsApply: Boolean(switchBody && switchBody.projectId === String(PROJECT_ID)),
    noticeOk: Boolean(afterSwitch.join.notice && afterSwitch.join.notice.kind === 'ok'),
    noticeText: Boolean(afterSwitch.join.notice
      && afterSwitch.join.notice.text === ZH.project.switchedOk.replace('{{title}}', '海鲜打包')),
    flippedToHired: afterSwitch.join.hiredEntry.present === true,
    confirmRowGone: afterSwitch.join.confirmEntry.present === false && afterSwitch.join.confirmText === null,
    relisted: reads().length >= 1,
  }

  // ============================ ⑤ 失败臂：409 满员 ⇒ 内联 err、不谎报成功 ============================
  STATE.view = baseView({ my_role: 'none', my_current_project_id: OTHER_PROJECT_ID, my_current_project_title: OTHER_PROJECT_TITLE })
  STATE.applyMode = 'full'
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await open('/sui', '[data-sf-m="project-page"]')
  await page.click('[data-sf-m="project-entry-switch"]')
  await settle(page)
  const readsBeforeFail = reads().length
  await page.click('[data-sf-m="project-entry-switch-confirm"]')
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-sf-m="project-join"] [data-sf-m="project-form-notice"]')
    return Boolean(n) && n.getAttribute('data-sf-kind') === 'err'
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const failSnap = await page.evaluate(SNAP_FN)
  out.states['1536_apply_fail'] = {
    join: failSnap.join,
    writes: STATE.calls.filter((c) => c.method !== 'GET'),
    reads: { before: readsBeforeFail, after: reads().length },
  }
  out.assertions.applyFail = {
    inlineErr: Boolean(failSnap.join.notice && failSnap.join.notice.kind === 'err'),
    reasonTranslated: Boolean(failSnap.join.notice
      && failSnap.join.notice.text === ZH.project.joinFailDetail
        .replace('{{detail}}', ZH.project.reasonHeadcountFull)
        .replace('{{status}}', '409')),
    notFlipped: failSnap.join.switchEntry.present === true && failSnap.join.hiredEntry.present === false,
    noOkNotice: !(failSnap.join.notice && failSnap.join.notice.kind === 'ok'),
    postOnce: STATE.bodies.length === 1,
    noRelistAfterFail: reads().length === readsBeforeFail,
    confirmRowCollapsed: failSnap.join.confirmEntry.present === false,
  }
  STATE.applyMode = 'ok'

  // ============================ ⑥ 客态臂（独立 context、无登录种子） ============================
  const guestCtx = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  guestCtx.addInitScript(() => { localStorage.setItem('theme', 'light') })
  await attachRoutes(guestCtx)
  const guestPage = await guestCtx.newPage()
  guestPage.on('pageerror', (e) => pageErrors.push('[guest] ' + String(e && e.message)))
  STATE.view = baseView({}) // 读口对匿名整键缺省 my_role / my_current_project_id
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await guestPage.goto(ORIGIN + '/sui', { waitUntil: 'load' })
  await settle(guestPage)
  await guestPage.waitForSelector('[data-sf-m="project-page"]', { timeout: 8000 }).catch(() => {})
  await settle(guestPage)
  const guestSnap = await guestPage.evaluate(SNAP_FN)
  out.states['1536_guest'] = { join: guestSnap.join, pagePresent: guestSnap.pagePresent }
  out.assertions.guest = {
    pageRendered: guestSnap.pagePresent === true,
    noJoinSection: guestSnap.join.present === false,
    noEntries: guestSnap.join.entryCount === 0,
    zeroWrites: writes().length === 0,
  }
  await guestCtx.close()

  // ============================ ⑦ 两档几何（390 / 1536） ============================
  STATE.view = baseView({ my_role: 'none', my_current_project_id: OTHER_PROJECT_ID, my_current_project_title: OTHER_PROJECT_TITLE })
  const geometry = {}
  for (const [label, width, height] of [['390', 390, 844], ['1536', 1536, 960]]) {
    await page.setViewportSize({ width, height })
    const snap = await open('/sui', '[data-sf-m="project-page"]')
    // 确认行也占一档（390 最窄形态）
    await page.click('[data-sf-m="project-entry-switch"]')
    await settle(page)
    const confirmG = await page.evaluate(SNAP_FN)
    geometry[label] = {
      overflowPx: snap.overflowPx,
      joinRight: snap.join.right,
      joinLeft: snap.join.left,
      entryH: snap.join.switchEntry.h,
      confirmOverflowPx: confirmG.overflowPx,
      confirmRight: confirmG.join.confirmEntry.right,
      confirmEntryCount: confirmG.join.entryCount,
      entries: [
        confirmG.join.confirmEntry.present, confirmG.join.cancelEntry.present,
      ].filter(Boolean).length,
    }
  }
  await page.setViewportSize({ width: 1536, height: 960 })
  out.states.geometry = geometry
  out.assertions.geometry = {
    zeroOverflow390: geometry['390'].overflowPx === 0,
    zeroOverflow1536: geometry['1536'].overflowPx === 0,
    zeroOverflowConfirm390: geometry['390'].confirmOverflowPx === 0,
    zeroOverflowConfirm1536: geometry['1536'].confirmOverflowPx === 0,
    entryInsideViewport390: geometry['390'].joinRight <= 390 && geometry['390'].joinLeft >= 0,
    entryInsideViewport1536: geometry['1536'].joinRight <= 1536 && geometry['1536'].joinLeft >= 0,
    confirmInsideViewport390: geometry['390'].confirmRight <= 390,
    confirmRowRenders390: geometry['390'].entries === 2 && geometry['390'].confirmEntryCount === 2,
    // 入口钮高度两档一致（量的是布局稳定性；本页 .sf-project-btn 高度 = 40px，取实测值不臆造 44）
    entryHeightStable: geometry['390'].entryH === geometry['1536'].entryH && geometry['390'].entryH > 0,
    zeroPageErrors: pageErrors.length === 0,
  }

  await browser.close()
  out.finishedAt = new Date().toISOString()
  out.assertions.geometry.zeroPageErrors = pageErrors.length === 0

  const required = [
    // ① 加入态（未在职）
    'joinState.sectionPresent', 'joinState.joinEntryPresent', 'joinState.joinEntryText', 'joinState.joinEntryAction',
    'joinState.joinEntryEnabled', 'joinState.onlyOneEntry', 'joinState.noSwitchEntry', 'joinState.noHiredEntry',
    'joinState.noConfirmRow', 'joinState.noNoticeYet', 'joinState.manageAbsent', 'joinState.zeroWritesOnLoad',
    // ② 加入提交
    'joinClick.postOnce', 'joinClick.pathIsApply', 'joinClick.bodyEmpty', 'joinClick.noSwitchKey',
    'joinClick.noticeOk', 'joinClick.noticeText', 'joinClick.flippedToHired', 'joinClick.hiredEntryDisabled',
    'joinClick.relisted',
    // ③ 已在职
    'hiredState.hiredEntryPresent', 'hiredState.hiredEntryText', 'hiredState.hiredEntryDisabled',
    'hiredState.onlyOneEntry', 'hiredState.noJoinEntry', 'hiredState.noSwitchEntry', 'hiredState.zeroWrites',
    // ④ 切换态
    'switchState.switchEntryPresent', 'switchState.switchEntryText', 'switchState.switchEntryAction',
    'switchState.onlyOneEntry', 'switchState.noJoinEntry', 'switchState.zeroWritesOnLoad',
    // ④-b 确认行（确认前零请求）
    'switchConfirm.confirmRowOpens', 'switchConfirm.confirmEntryAction', 'switchConfirm.cancelPresent',
    'switchConfirm.confirmTextHasCurrentTitle', 'switchConfirm.confirmTextIsLocale',
    'switchConfirm.zeroWritesBeforeConfirm', 'switchConfirm.switchEntryReplaced', 'switchConfirm.twoEntriesOnly',
    'switchCancel.backToSwitch', 'switchCancel.zeroWritesAfterCancel', 'switchCancel.confirmTextGone',
    // ④-c 确认提交
    'switchConfirmSubmit.postOnce', 'switchConfirmSubmit.bodyExactlySwitch', 'switchConfirmSubmit.pathIsApply',
    'switchConfirmSubmit.noticeOk', 'switchConfirmSubmit.noticeText', 'switchConfirmSubmit.flippedToHired',
    'switchConfirmSubmit.confirmRowGone', 'switchConfirmSubmit.relisted',
    // ⑤ 失败臂
    'applyFail.inlineErr', 'applyFail.reasonTranslated', 'applyFail.notFlipped', 'applyFail.noOkNotice',
    'applyFail.postOnce', 'applyFail.noRelistAfterFail', 'applyFail.confirmRowCollapsed',
    // ⑥ 客态
    'guest.pageRendered', 'guest.noJoinSection', 'guest.noEntries', 'guest.zeroWrites',
    // ⑦ 几何
    'geometry.zeroOverflow390', 'geometry.zeroOverflow1536',
    'geometry.zeroOverflowConfirm390', 'geometry.zeroOverflowConfirm1536',
    'geometry.entryInsideViewport390', 'geometry.entryInsideViewport1536',
    'geometry.confirmInsideViewport390', 'geometry.confirmRowRenders390',
    'geometry.entryHeightStable', 'geometry.zeroPageErrors',
  ]
  const verdicts = required.map((key) => {
    const [group, field] = key.split('.')
    const value = out.assertions[group] ? out.assertions[group][field] : undefined
    return { key, value, pass: value === true }
  })
  out.verdict = { required: verdicts, failed: verdicts.filter((v) => !v.pass).map((v) => v.key), pass: verdicts.every((v) => v.pass) }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, pass: out.verdict.pass, failed: out.verdict.failed, pageErrors }, null, 2))
  process.exit(out.verdict.pass ? 0 : 1)
}

main().catch((error) => {
  console.error('PROBE_CRASH', error)
  process.exit(2)
})
