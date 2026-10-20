/**
 * /wage 前端探针（Kevin 2026-10-20 需求②：悬浮菜单改版 + 新页面）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 悬浮菜单 5 项、无【反馈】、**首位 = 领工资**且 href 含 `/wage`（顺序 = 领工资/卖闲置/消息/APP/客服）；
 *   ② `/wage` 列表渲染 10 项、招募中/已截止态、加入与领工资按钮态（置灰依据逐条核）；
 *   ③ 领工资成功 ⇒ 卡内到账提示 + 列表重拉；失败（400 间隔未到）⇒ 卡内内联提示、卡仍在；
 *   ④ 390 / 1536 两档：`scrollWidth - clientWidth = 0` + 零 pageerror。
 *   ⑤ 客态臂（独立 context、无登录种子）：未登录**也**渲染项目卡（项目名 / 工资行 / 次币可见）+
 *      页顶轻提示与列表并存；点【加入】/【领工资】⇒ 卡内登录提示、**零写请求**（apply/claim 各 0）。
 *
 * 手法（同 ops/v119-msg-panel 体例）：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node probe-wage.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/wage/front/readings/probe-result.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（探针内内存 JSON；契约形状 = 派单冻结的 11 键行） --------------------------------------
const soon = () => new Date(Date.now() + 2 * 3600 * 1000 + 95 * 1000).toISOString()
const ROWS = [
  // ① 已入职 + 可领（无下次可领时间）⇒【领工资】可点（成功臂）
  { project_id: 101, snowflake_id: '7101', title: '海鲜打包', description: '每天打包 20 单，按批结算。', headcount: 3, hired_count: 2, wage_batt_per_claim: 30, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 4, status: 'recruiting', my_role: 'hired' },
  { project_id: 102, snowflake_id: '7102', title: '冷库分拣', description: '早班分拣冻品。', headcount: 4, hired_count: 1, wage_batt_per_claim: 25, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 6, status: 'recruiting', my_role: 'none' },
  { project_id: 103, snowflake_id: '7103', title: '文案校对', description: '校对商品描述与错别字。', headcount: 5, hired_count: 2, wage_batt_per_claim: 20, wage_cid: 4, wage_currency_amount: 50, wage_interval_hours: 8, status: 'recruiting', my_role: 'none' },
  { project_id: 104, snowflake_id: '7104', title: '客服值守', description: '白天在线答疑。', headcount: 2, hired_count: 0, wage_batt_per_claim: 18, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 12, status: 'recruiting', my_role: 'none' },
  { project_id: 105, snowflake_id: '7105', title: '图片精修', description: '商品图去背与调色。', headcount: 6, hired_count: 3, wage_batt_per_claim: 22, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 6, status: 'recruiting', my_role: 'none' },
  { project_id: 106, snowflake_id: '7106', title: '同城跑腿', description: '当天送达同城订单。', headcount: 8, hired_count: 4, wage_batt_per_claim: 15, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 10, status: 'recruiting', my_role: 'none' },
  { project_id: 107, snowflake_id: '7107', title: '夜间补货', description: '凌晨补货上架。', headcount: 2, hired_count: 2, wage_batt_per_claim: 28, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 12, status: 'recruiting', my_role: 'none' },
  { project_id: 108, snowflake_id: '7108', title: '冷库盘点', description: '季度盘点，已结束招募。', headcount: 3, hired_count: 3, wage_batt_per_claim: 12, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 24, status: 'closed', my_role: 'none' },
  { project_id: 109, snowflake_id: '7109', title: '旧仓搬迁', description: '已截止的搬迁项目。', headcount: 4, hired_count: 4, wage_batt_per_claim: 10, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 24, status: 'closed', my_role: 'none' },
  { project_id: 110, snowflake_id: '7110', title: '跨境选品', description: '选品与比价。', headcount: 5, hired_count: 1, wage_batt_per_claim: 35, wage_cid: 4, wage_currency_amount: 80, wage_interval_hours: 8, status: 'recruiting', my_role: 'none' },
]

const CUR = [{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }]

// 可变探针状态：失败臂靠它切换（不重启浏览器、不改夹具文件）
const STATE = { claimFail: false, claimFailReason: 'WAGE_INTERVAL_NOT_REACHED', rows: ROWS.map((r) => ({ ...r })), calls: [] }

const apiResponse = (method, pathname) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/project/all') {
    STATE.calls.push({ method, path: pathname })
    return ok(STATE.rows)
  }
  if (pathname === '/api/currencies') return ok(CUR)
  const claim = pathname.match(/^\/api\/project\/(\d+)\/claim$/)
  if (claim && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    if (STATE.claimFail) {
      return { success: false, error: { code: 'WAGE_CLAIM_TOO_SOON', details: { reason: STATE.claimFailReason, remaining_seconds: 90 } } }
    }
    // 成功：batt 到账（并在列表里抹掉下次可领时间 ⇒ 由前端按间隔起倒计时）
    return ok({ wage_batt: 30, wage_currency_amount: 0 })
  }
  const apply = pathname.match(/^\/api\/project\/(\d+)\/apply$/)
  if (apply && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    return ok({ applied: true })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数（一次性取全，供 Python 侧判据） ----------------------------------------------------
const SNAP_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const fm = q('[data-sf-m="floatmenu"]')
  const fmItems = fm ? qa('[data-sf-m="floatmenu-item"]') : []
  const cards = qa('[data-sf-m="wage-card"]')
  return {
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    floatmenu: {
      present: !!fm,
      count: fmItems.length,
      keys: fmItems.map((el) => el.getAttribute('data-sf-fm')),
      labels: fmItems.map((el) => txt(el)),
      hrefs: fmItems.map((el) => el.getAttribute('href')),
      dividers: fm ? qa('.sf-fm-div').length : 0,
      feedbackHooks: qa('[data-sf-fm="feedback"]').length,
      feedbackFormHooks: qa('[data-sf-m^="floatmenu-feedback"]').length,
      menuText: fm ? txt(fm) : null,
    },
    page: {
      hasPage: !!q('[data-sf-m="wage-page"]'),
      hasList: !!q('[data-sf-m="wage-list"]'),
      hasLogin: !!q('[data-sf-m="wage-login"]'),
      hasEmpty: !!q('[data-sf-m="wage-empty"]'),
      hasError: !!q('[data-sf-m="wage-error"]'),
    },
    cards: cards.map((c) => {
      const st = c.querySelector('[data-sf-m="wage-card-status"]')
      const act = c.querySelector('[data-sf-m="wage-card-action"]')
      const hint = c.querySelector('[data-sf-m="wage-card-hint"]')
      const extra = c.querySelector('[data-sf-m="wage-card-wage-extra"]')
      const notice = c.querySelector('[data-sf-m="wage-card-notice"]')
      const r = c.getBoundingClientRect()
      return {
        project: c.getAttribute('data-sf-project'),
        title: txt(c.querySelector('[data-sf-m="wage-card-title"]')),
        statusText: txt(st),
        statusState: st ? st.getAttribute('data-sf-state') : null,
        headcount: txt(c.querySelector('[data-sf-m="wage-card-headcount"]')),
        wage: txt(c.querySelector('[data-sf-m="wage-card-wage"]')),
        wageExtra: txt(extra),
        action: act ? act.getAttribute('data-sf-action') : null,
        actionText: txt(act),
        actionDisabled: act ? !!act.disabled : null,
        needLogin: act ? act.getAttribute('data-sf-need-login') : null,
        loginLink: !!c.querySelector('[data-sf-m="wage-card-login-link"]'),
        claimable: act ? act.getAttribute('data-sf-claimable') : null,
        remaining: act ? act.getAttribute('data-sf-remaining') : null,
        actionH: act ? Math.round(act.getBoundingClientRect().height * 10) / 10 : null,
        hint: txt(hint),
        noticeKind: notice ? notice.getAttribute('data-sf-kind') : null,
        noticeText: txt(notice),
        right: Math.round(r.right * 10) / 10,
      }
    }),
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

// ---- 路由接线（登录态 / 客态两个 context 共用同一套：静态 dist + 页内 API 自截）---------------
const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
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
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }))
    localStorage.setItem('token', 'probe-token')
  })
  await attachRoutes(context)

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

  const out = {
    probe: 'ops/wage/front/probe-wage.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { rows: ROWS.length, recruiting: ROWS.filter((r) => r.status === 'recruiting').length, closed: ROWS.filter((r) => r.status === 'closed').length, hired: ROWS.filter((r) => r.my_role === 'hired').length, auth: 'localStorage seed only（零真登录）', api: 'context.route in-probe JSON（零后端 / 零库写）' },
    states: {}, assertions: {}, pageErrors, consoleErrors,
  }

  const open = async (url) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    await page.waitForSelector('[data-sf-m="wage-page"]', { timeout: 8000 }).catch(() => {})
    await settle(page)
    return page.evaluate(SNAP_FN)
  }

  // ============================ ① 悬浮菜单（1536 桌面档） ============================
  const menuSnap = await open('/')
  out.states['1536_menu'] = menuSnap.floatmenu
  out.assertions.menu = {
    fiveItems: menuSnap.floatmenu.count === 5,
    noFeedback: menuSnap.floatmenu.feedbackHooks === 0
      && menuSnap.floatmenu.feedbackFormHooks === 0
      && !/反馈|反饋|Feedback/i.test(menuSnap.floatmenu.menuText || ''),
    // ★ Kevin 2026-10-20 二次收口：领工资提到**第一位**（其余相对顺序不变）
    firstIsWage: menuSnap.floatmenu.keys[0] === 'wage'
      && menuSnap.floatmenu.labels[0] === ZH.wage.menuLabel
      && String(menuSnap.floatmenu.hrefs[0] || '').includes('/wage'),
    orderMatches: JSON.stringify(menuSnap.floatmenu.keys) === JSON.stringify(['wage', 'sell', 'messages', 'app', 'support']),
    dividers4: menuSnap.floatmenu.dividers === 4,
    order: menuSnap.floatmenu.keys,
    labels: menuSnap.floatmenu.labels,
    hrefs: menuSnap.floatmenu.hrefs,
    dividers: menuSnap.floatmenu.dividers,
  }

  // ============================ ② 列表（1536） =====================================
  STATE.calls.length = 0
  const listSnap = await open('/wage')
  out.states['1536_list'] = { page: listSnap.page, cards: listSnap.cards, overflowPx: listSnap.overflowPx }
  const byId = Object.fromEntries(listSnap.cards.map((c) => [c.project, c]))
  out.assertions.list = {
    tenCards: listSnap.cards.length === 10,
    recruitingCards: listSnap.cards.filter((c) => c.statusState === 'recruiting').length === 8,
    closedCards: listSnap.cards.filter((c) => c.statusState === 'closed').length === 2,
    recruitingCount: listSnap.cards.filter((c) => c.statusState === 'recruiting').length,
    closedCount: listSnap.cards.filter((c) => c.statusState === 'closed').length,
    statusTexts: [...new Set(listSnap.cards.map((c) => c.statusText))],
    headcountText: byId['101'] && byId['101'].headcount,
    wageText: byId['101'] && byId['101'].wage,
    currencyExtra: byId['103'] && byId['103'].wageExtra,
    hiredCardClaimEnabled: byId['101'] && byId['101'].action === 'claim' && byId['101'].actionDisabled === false,
    otherJoinDisabled: ['102', '103', '104', '105', '106', '110'].every((id) => byId[id] && byId[id].action === 'join' && byId[id].actionDisabled === true),
    otherHintOneAtATime: ['102', '103'].every((id) => byId[id] && byId[id].hint === ZH.wage.oneAtATime),
    // ★ 已招满臂在「无人在职」时单独取（有在职项目时 oneAtATime 是更强的理由、优先展示）⇒ 见下方 fullExtraArm
    fullCardDisabledWithHint: null,
    closedNoAction: ['108', '109'].every((id) => byId[id] && byId[id].action === null),
  }

  // ===== 已招满臂（无人在职态）：把唯一在职行的 my_role 抹成 none 后重载 =====
  STATE.rows = STATE.rows.map((r) => (r.project_id === 101 ? { ...r, my_role: 'none' } : r))
  const fullSnap = await open('/wage')
  const byIdFull = Object.fromEntries(fullSnap.cards.map((c) => [c.project, c]))
  out.states['1536_full_arm'] = {
    c107: byIdFull['107'],
    c102: byIdFull['102'],
  }
  out.assertions.list.fullCardDisabledWithHint = Boolean(
    byIdFull['107'] && byIdFull['107'].actionDisabled === true && byIdFull['107'].hint === ZH.wage.full
  )
  out.assertions.list.joinEnabledWhenFree = Boolean(
    byIdFull['102'] && byIdFull['102'].action === 'join' && byIdFull['102'].actionDisabled === false
      && byIdFull['102'].hint === null
  )
  // 复原夹具（后续领工资臂需要 101 仍为在职）+ 重载页面让卡面回到在职态
  STATE.rows = STATE.rows.map((r) => (r.project_id === 101 ? { ...r, my_role: 'hired' } : r))
  STATE.calls.length = 0
  await open('/wage') // 这一发 = 卡面初始拉取（作为「领完重拉」的计数基线）

  // ============================ ③ 领工资成功臂 =====================================
  await page.click('[data-sf-project="101"] [data-sf-action="claim"]')
  await settle(page)
  await page.waitForFunction(() => !!document.querySelector('[data-sf-project="101"] [data-sf-m="wage-card-notice"]'), null, { timeout: 5000 }).catch(() => {})
  await settle(page)
  const afterClaim = await page.evaluate(SNAP_FN)
  const c101 = afterClaim.cards.find((c) => c.project === '101')
  out.states['1536_claim_ok'] = {
    noticeKind: c101 && c101.noticeKind,
    noticeText: c101 && c101.noticeText,
    claimable: c101 && c101.claimable,
    remaining: c101 && c101.remaining,
    hint: c101 && c101.hint,
    listRefetched: STATE.calls.filter((c) => c.path === '/api/project/all').length,
    claimPosts: STATE.calls.filter((c) => /\/claim$/.test(c.path)),
  }
  out.assertions.claimOk = {
    postCount1: STATE.calls.filter((c) => /\/claim$/.test(c.path)).length === 1,
    postPath: (STATE.calls.find((c) => /\/claim$/.test(c.path)) || {}).path,
    noticeOk: c101 && c101.noticeKind === 'ok',
    noticeHasBatt: c101 && /batt\s*30/.test(c101.noticeText || ''),
    cardRefreshedAndGated: c101 && c101.claimable === '0' && Number(c101.remaining) > 0,
    listRefetched: STATE.calls.filter((c) => c.path === '/api/project/all').length >= 2,
    cardStillPresent: afterClaim.cards.length === 10,
  }

  // ============================ ③ 领工资失败臂（400 间隔未到） =====================
  STATE.claimFail = true
  STATE.calls.length = 0
  const failSnap = await open('/wage')
  const c101b = failSnap.cards.find((c) => c.project === '101')
  out.assertions.beforeFailClick = { claimable: c101b && c101b.claimable, disabled: c101b && c101b.actionDisabled }
  await page.click('[data-sf-project="101"] [data-sf-action="claim"]')
  await settle(page)
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-sf-project="101"] [data-sf-m="wage-card-notice"]')
    return !!n && n.getAttribute('data-sf-kind') === 'err'
  }, null, { timeout: 5000 }).catch(() => {})
  await settle(page)
  const afterFail = await page.evaluate(SNAP_FN)
  const c101c = afterFail.cards.find((c) => c.project === '101')
  out.states['1536_claim_fail'] = {
    noticeKind: c101c && c101c.noticeKind,
    noticeText: c101c && c101c.noticeText,
    claimable: c101c && c101c.claimable,
    remaining: c101c && c101c.remaining,
    cards: afterFail.cards.length,
    bodyTextEmpty: (await page.evaluate(`document.getElementById('root').innerHTML.length`)) < 200,
  }
  out.assertions.claimFail = {
    noticeErr: c101c && c101c.noticeKind === 'err',
    noticeIsReason: c101c && c101c.noticeText === ZH.wage.claimTooSoon,
    noWhiteScreen: afterFail.cards.length === 10,
    countdownFromServer: c101c && c101c.claimable === '0' && Number(c101c.remaining) > 0,
  }
  STATE.claimFail = false

  // ============================ ④ 两档几何 / pageerror =============================
  for (const [label, width, height] of [['390', 390, 844], ['1536', 1536, 960]]) {
    await page.setViewportSize({ width, height })
    const snap = await open('/wage')
    out.states[`${label}_geometry`] = {
      overflowPx: snap.overflowPx,
      cards: snap.cards.length,
      cardRightMax: Math.max(...snap.cards.map((c) => c.right)),
      actionHeights: [...new Set(snap.cards.map((c) => c.actionH).filter(Boolean))],
      floatmenuCount: snap.floatmenu.count,
    }
  }
  out.assertions.geometry = {
    zeroOverflow390: out.states['390_geometry'].overflowPx === 0,
    zeroOverflow1536: out.states['1536_geometry'].overflowPx === 0,
    cards390: out.states['390_geometry'].cards === 10,
    touchTarget44On390: out.states['390_geometry'].actionHeights.every((h) => h >= 44),
    cardRightWithinViewport390: out.states['390_geometry'].cardRightMax <= 390,
    zeroPageErrors: pageErrors.length === 0,
  }

  // ============================ ⑤ 客态公开浏览臂（独立 context，无登录种子）================
  // 口径：`/api/project/all` 是无闸公开读口 ⇒ 未登录也必须渲染项目卡；写口（加入 / 领工资）
  //       点击只弹**卡内登录提示**、零写请求。旧形态「未登录 ⇒ 整页只有登录块、零请求」已作废。
  const guestCtx = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  guestCtx.addInitScript(() => { localStorage.setItem('theme', 'light') }) // 只种主题，不种登录态
  await attachRoutes(guestCtx)
  const guestPage = await guestCtx.newPage()
  guestPage.on('pageerror', (e) => pageErrors.push('[guest] ' + String(e && e.message)))

  const openGuest = async (url) => {
    await guestPage.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(guestPage)
    await guestPage.waitForSelector('[data-sf-m="wage-card"]', { timeout: 8000 }).catch(() => {})
    await settle(guestPage)
    return guestPage.evaluate(SNAP_FN)
  }
  const clickGuest = async (sel) => {
    const el = await guestPage.$(sel)
    if (!el) return false
    await el.click()
    await settle(guestPage)
    return true
  }

  STATE.calls.length = 0
  const guestSnap = await openGuest('/wage')
  const gById = Object.fromEntries(guestSnap.cards.map((c) => [c.project, c]))
  const guestJoinClicked = await clickGuest('[data-sf-project="102"] [data-sf-action="join"]')
  const guestAfterJoin = await guestPage.evaluate(SNAP_FN)
  const g102 = guestAfterJoin.cards.find((c) => c.project === '102')
  const guestClaimClicked = await clickGuest('[data-sf-project="101"] [data-sf-action="claim"]')
  const guestAfterClaim = await guestPage.evaluate(SNAP_FN)
  const g101guest = guestAfterClaim.cards.find((c) => c.project === '101')
  const writeCalls = STATE.calls.filter((c) => /\/(apply|claim)$/.test(c.path))

  out.states['1536_guest'] = {
    page: guestSnap.page,
    cardCount: guestSnap.cards.length,
    titles: guestSnap.cards.map((c) => c.title),
    overflowPx: guestSnap.overflowPx,
    c101: gById['101'],
    c102: gById['102'],
    c103: gById['103'],
    afterJoinClick: g102,
    afterClaimClick: g101guest,
    writeCalls,
  }
  out.assertions.guest = {
    cardsVisible: guestSnap.cards.length === ROWS.length,
    cardCount: guestSnap.cards.length,
    listRendered: guestSnap.page.hasList === true,
    bannerWithList: guestSnap.page.hasLogin === true && guestSnap.page.hasList === true,
    titleVisible: Boolean(gById['102'] && gById['102'].title === '冷库分拣'),
    wageVisible: Boolean(gById['101'] && /batt\s*30/.test(gById['101'].wage || '')),
    currencyExtraVisible: Boolean(gById['103'] && /BTTC/.test(gById['103'].wageExtra || '')),
    joinEnabled: Boolean(
      gById['102'] && gById['102'].action === 'join'
        && gById['102'].actionDisabled === false && gById['102'].needLogin === '1'
    ),
    joinClickLoginPrompt: guestJoinClicked && Boolean(
      g102 && g102.noticeKind === 'login' && (g102.noticeText || '').includes(ZH.wage.loginRequired) && g102.loginLink
    ),
    claimClickLoginPrompt: guestClaimClicked && Boolean(
      g101guest && g101guest.noticeKind === 'login' && (g101guest.noticeText || '').includes(ZH.wage.loginRequired)
    ),
    zeroWriteRequests: writeCalls.length === 0,
    writeCallPaths: writeCalls.map((c) => c.path),
    cardsStableAfterClicks: guestAfterClaim.cards.length === ROWS.length,
    zeroOverflowGuest: guestSnap.overflowPx === 0,
  }
  await guestCtx.close()

  // 客态 390 档（手机 H5 同源）：轻提示条不得把列表挤出横向溢出，触控目标仍 ≥44
  const guestMobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  guestMobileCtx.addInitScript(() => { localStorage.setItem('theme', 'light') })
  await attachRoutes(guestMobileCtx)
  const guestMobilePage = await guestMobileCtx.newPage()
  guestMobilePage.on('pageerror', (e) => pageErrors.push('[guest390] ' + String(e && e.message)))
  await guestMobilePage.goto(ORIGIN + '/wage', { waitUntil: 'load' })
  await settle(guestMobilePage)
  await guestMobilePage.waitForSelector('[data-sf-m="wage-card"]', { timeout: 8000 }).catch(() => {})
  await settle(guestMobilePage)
  const guestMobile = await guestMobilePage.evaluate(SNAP_FN)
  out.states['390_guest'] = {
    overflowPx: guestMobile.overflowPx,
    cards: guestMobile.cards.length,
    actionHeights: [...new Set(guestMobile.cards.map((c) => c.actionH).filter(Boolean))],
    cardRightMax: Math.max(...guestMobile.cards.map((c) => c.right)),
    hasBannerAndList: guestMobile.page.hasLogin && guestMobile.page.hasList,
  }
  out.assertions.guest.zeroOverflow390 = guestMobile.overflowPx === 0
  out.assertions.guest.cards390 = guestMobile.cards.length === ROWS.length
  out.assertions.guest.touchTarget44On390 = out.states['390_guest'].actionHeights.every((h) => h >= 44)
  out.assertions.guest.bannerAndList390 = guestMobile.page.hasLogin && guestMobile.page.hasList
  await guestMobileCtx.close()

  await browser.close()
  out.finishedAt = new Date().toISOString()
  const required = [
    'menu.fiveItems', 'menu.noFeedback', 'menu.firstIsWage', 'menu.orderMatches', 'menu.dividers4',
    'list.tenCards', 'list.recruitingCards', 'list.closedCards', 'list.hiredCardClaimEnabled', 'list.otherJoinDisabled',
    'list.joinEnabledWhenFree',
    'list.otherHintOneAtATime', 'list.fullCardDisabledWithHint', 'list.closedNoAction',
    'claimOk.postCount1', 'claimOk.noticeOk', 'claimOk.noticeHasBatt', 'claimOk.cardRefreshedAndGated', 'claimOk.listRefetched',
    'claimFail.noticeErr', 'claimFail.noticeIsReason', 'claimFail.noWhiteScreen',
    'geometry.zeroOverflow390', 'geometry.zeroOverflow1536', 'geometry.cards390',
    'geometry.touchTarget44On390', 'geometry.zeroPageErrors',
    // ⑤ 客态公开浏览臂（未登录也渲染列表 + 写口需登录）
    'guest.cardsVisible', 'guest.listRendered', 'guest.bannerWithList', 'guest.titleVisible',
    'guest.wageVisible', 'guest.currencyExtraVisible', 'guest.joinEnabled',
    'guest.joinClickLoginPrompt', 'guest.claimClickLoginPrompt', 'guest.zeroWriteRequests',
    'guest.cardsStableAfterClicks', 'guest.zeroOverflowGuest',
    'guest.zeroOverflow390', 'guest.cards390', 'guest.touchTarget44On390', 'guest.bannerAndList390',
  ]
  const verdicts = required.map((key) => {
    const [group, field] = key.split('.')
    const value = out.assertions[group] ? out.assertions[group][field] : undefined
    return { key, value, pass: value === true }
  })
  out.verdict = { required: verdicts, failed: verdicts.filter((v) => !v.pass).map((v) => v.key), pass: verdicts.every((v) => v.pass) }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, verdict: out.verdict, pageErrors, consoleErrors: consoleErrors.slice(0, 5) }, null, 2))
  process.exit(out.verdict.pass ? 0 : 1)
}

main().catch((error) => {
  console.error('PROBE_CRASH', error)
  process.exit(2)
})
