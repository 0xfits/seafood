/**
 * /wage 前端探针（Kevin 2026-10-20 需求②：悬浮菜单改版 + 新页面）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 悬浮菜单 5 项、无【反馈】、**首位 = 领工资**且 href 含 `/wage`（顺序 = 领工资/卖闲置/消息/APP/客服）；
 *   ② `/wage` 列表渲染 10 项、招募中/已截止态、加入与领工资按钮态（置灰依据逐条核）；
 *   ③ 领工资成功 ⇒ **Toast 到账提示**（2026-10-24 起，卡内零成功文案、无模态框）+ 列表重拉；
 *      失败（400 间隔未到）⇒ 卡内内联提示（失败不改 Toast）、卡仍在；
 *   ④ 390 / 1536 两档：`scrollWidth - clientWidth = 0` + 零 pageerror。
 *   ⑤ 客态臂（独立 context、无登录种子）：未登录**也**渲染项目卡（项目名 / 工资行 / 次币可见）+
 *      页顶轻提示与列表并存；点【加入】/【领工资】⇒ 卡内登录提示、**零写请求**（apply/claim 各 0）。
 *   ⑥ 项目卡**零编辑**（Kevin 2026-10-21②：编辑整体移入项目页 `/:slug` 的【编辑项目】+ 模态框）——
 *      本页三臂（owner 行 / manage_tasks 管理员载荷 / 普通用户）**全部零【编辑】钮**、
 *      **零 PATCH**、**零 `/api/user` 三键取数**；卡内零表单根 / 零字段容器 / 零提示行 /
 *      零注册天数 select（旧 wage-edit 表单件全绝迹）；两档（1536 / 390）同判；
 *      整卡链接保留（有 slug ⇒ `<a href="…/slug">`，历史行 ⇒ `<article>`）。
 *      编辑本身的字段 / 校验 / 载荷 / 模态框行为由 `ops/project-page/probe-project-page.mjs` 的 modal 臂覆盖。
 *   ⑦ 卡头头像（Kevin 2026-10-22）：每张卡卡头左组首位 = **40px 圆形头像**，与标题同一行、垂直居中；
 *      行有 `avatar_url` ⇒ `<img src>`（`object-fit:cover`、`alt=""`），无 ⇒ 项目名首字 + `data-sf-tone`
 *      （档位 = 前端唯一真源 `avatarToneOf(name)`，1..10）；标题 `min-width:0` + ellipsis ⇒ 卡头不因头像折行；
 *      1536 / 390 两档尺寸/圆形/档位稳定、零横向溢出、零 pageerror。
 *
 * 手法（同 ops/v119-msg-panel 体例）：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *   · 悬浮菜单遮挡（2026-10-21② 退场）：旧卡头【编辑】钮曾是唯一与 1536 档 nav.sf-fm 相交的卡内控件
 *     （相交属 Kevin 2026-10-11 既定「只登记不判负」口径）；编辑移入项目页后本页卡内控件只剩
 *     主行动钮（加入/领工资），实测恒与浮层不相交 ⇒ 遮挡测量臂与登记表一并退场，本探针零 force 点击。
 *
 * 用法：QA_DIST=<dist> node probe-wage.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
// 头像档位真源 = 前端同一份纯函数（探针直接引用源码，不复制 hash）：
//   卡头 `data-sf-tone` 必须等于 `avatarToneOf(项目名)` ⇒ 首字彩底由名字决定这条可机判。
import { avatarToneOf } from '../../../frontend/src/avatar-tone.js'

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
// ★ Kevin 2026-10-21：行契约含 `recruit_min_account_days` —— 四档值（1/7/30/365）与
//   非四档值（0 / 90）各留一行，供 E4 预填/提示臂用（其余行给常规四档值）。
//   ★ E4c 保存臂行（104）币对必须取 null/null（=「无（仅 batt）」合法态）：wage_cid=1 会撞
//     validateEdit 的「Number(cid)===1 ⇒ errCurrencyInvalid」（cid 1 = 主币 $ 不得作次币对），
//     保存在校验段即中断 ⇒ PATCH 恒 0、三判据假红（2026-10-21 复跑实测；探针夹具修正，非产品修正）。
const ROWS = [
  // ① 已入职 + 可领（无下次可领时间）⇒【领工资】可点（成功臂；带次币定额 ⇒ 到账提示两币都在）
  { project_id: 101, snowflake_id: '7101', title: '海鲜打包', description: '每天打包 20 单，按批结算。', headcount: 3, hired_count: 2, recruit_min_account_days: 1, wage_batt_per_claim: 30, wage_cid: 4, wage_currency_amount: 20, wage_interval_hours: 4, status: 'recruiting', my_role: 'hired', my_hired_at: '2026-10-18T02:00:00.000Z' },
  { project_id: 102, snowflake_id: '7102', title: '冷库分拣', description: '早班分拣冻品。', headcount: 4, hired_count: 1, recruit_min_account_days: 7, wage_batt_per_claim: 25, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 6, status: 'recruiting', my_role: 'none' },
  // ★ 2026-10-21②：103 带合法 slug ⇒ 整卡是 `<a href="…/wend-an">`（编辑搬走后「入口保留」的可验面）；
  //   101 保持无 slug（历史行）⇒ 仍是 `<article>`（不得因去编辑被误链到不存在的项目页）。
  // ★ 2026-10-22 卡头头像（Kevin：/wage 项目卡显示各 project 的 avatar）：
  //   103 / 105 两行带 `avatar_url`（⇒ `<img>` 臂）；其余 8 行整键缺省（⇒ 首字彩底臂）。
  { project_id: 103, snowflake_id: '7103', slug: 'wend-an', title: '文案校对', description: '校对商品描述与错别字。', headcount: 5, hired_count: 2, recruit_min_account_days: 1, wage_batt_per_claim: 20, wage_cid: 4, wage_currency_amount: 50, wage_interval_hours: 8, status: 'recruiting', my_role: 'none', avatar_url: '/api/media/9001' },
  { project_id: 104, snowflake_id: '7104', title: '客服值守', description: '白天在线答疑。', headcount: 2, hired_count: 0, recruit_min_account_days: 90, wage_batt_per_claim: 18, wage_cid: null, wage_currency_amount: null, wage_interval_hours: 12, status: 'recruiting', my_role: 'none' },
  { project_id: 105, snowflake_id: '7105', title: '图片精修', description: '商品图去背与调色。', headcount: 6, hired_count: 3, recruit_min_account_days: 365, wage_batt_per_claim: 22, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 6, status: 'recruiting', my_role: 'none', avatar_url: '/api/media/9002' },
  { project_id: 106, snowflake_id: '7106', title: '同城跑腿', description: '当天送达同城订单。', headcount: 8, hired_count: 4, recruit_min_account_days: 1, wage_batt_per_claim: 15, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 10, status: 'recruiting', my_role: 'none' },
  { project_id: 107, snowflake_id: '7107', title: '夜间补货', description: '凌晨补货上架。', headcount: 2, hired_count: 2, recruit_min_account_days: 30, wage_batt_per_claim: 28, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 12, status: 'recruiting', my_role: 'none' },
  { project_id: 108, snowflake_id: '7108', title: '冷库盘点', description: '季度盘点，已结束招募。', headcount: 3, hired_count: 3, recruit_min_account_days: 1, wage_batt_per_claim: 12, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 24, status: 'closed', my_role: 'none' },
  { project_id: 109, snowflake_id: '7109', title: '旧仓搬迁', description: '已截止的搬迁项目。', headcount: 4, hired_count: 4, recruit_min_account_days: 1, wage_batt_per_claim: 10, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 24, status: 'closed', my_role: 'none' },
  { project_id: 110, snowflake_id: '7110', title: '跨境选品', description: '选品与比价。', headcount: 5, hired_count: 1, recruit_min_account_days: 0, wage_batt_per_claim: 35, wage_cid: 4, wage_currency_amount: 80, wage_interval_hours: 8, status: 'recruiting', my_role: 'none' },
]

// 行主缺省 900001（=「别人」）：owner_uid 是【编辑】可见性的行键（真实后端恒透出 ⇒ 契约 12 键行）；
// owner 臂用 STATE.rows 把 103 改成自己的 uID，resetRows() 即回「别人」。
for (const r of ROWS) r.owner_uid = '900001'

// 卡头头像两形态夹具划分（103 / 105 带 url ⇒ `<img>`；其余首字彩底）。
const AVATAR_IMG_IDS = ROWS.filter((r) => typeof r.avatar_url === 'string' && r.avatar_url.trim()).map((r) => String(r.project_id))
const AVATAR_INITIAL_IDS = ROWS.filter((r) => !(typeof r.avatar_url === 'string' && r.avatar_url.trim())).map((r) => String(r.project_id))
// 头像臂用的 1×1 PNG（/api/media/* 直出，避免 <img> 因 404 变成破图）
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')

const CUR = [{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }]

// 非 2xx 响应：带 `__status` 标记 ⇒ attachRoutes 按真状态码下发（同 ops/project-page 探针机制），
// 页面侧 fetchApiJson 才会按「非 ok / success:false」抛错 ⇒ 项目页走 not-found 分支。
const fail = (status, code, details) => ({
  __status: status,
  body: { success: false, error: { code, details } },
})

// 可变探针状态：失败臂 / 倒计时臂 / 匿名臂靠它切换（不重启浏览器、不改夹具文件）
const STATE = {
  claimFail: false,
  claimFailReason: 'WAGE_INTERVAL_NOT_REACHED',
  countdownMs: 0, // > 0 ⇒ 101 行按「现在 + N ms」透出 next_claim_at（倒计时臂）
  afterClaimNextAt: null, // 领工资成功 ⇒ 刷新后的行带上这个 next_claim_at（验「刷新拿新时间」）
  anon: false, // true ⇒ 三键（my_role/my_hired_at/next_claim_at）整键缺省（匿名臂）
  userPayload: { uID: 970213 }, // GET /api/user 载荷（编辑三臂切换 admin 三键；fetchApiJson 取 data）
  patches: [], // PATCH /api/project/:id 载荷留痕（断言「只含变化字段」）
  rows: ROWS.map((r) => ({ ...r })),
  calls: [],
}

const resetRows = () => { STATE.rows = ROWS.map((r) => ({ ...r })) }

/** 按 STATE 现算要下发的行（模拟服务端在请求时刻算 next_claim_at / 匿名单缺省三键）。 */
const servedRows = () => STATE.rows.map((row) => {
  let out = { ...row }
  if (row.project_id === 101 && STATE.countdownMs > 0) {
    out = { ...out, next_claim_at: new Date(Date.now() + STATE.countdownMs).toISOString() }
  }
  if (STATE.anon) {
    delete out.my_role
    delete out.my_hired_at
    delete out.next_claim_at
  }
  return out
})

const apiResponse = (method, pathname, rawBody) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/project/all') {
    STATE.calls.push({ method, path: pathname })
    return ok(servedRows())
  }
  if (pathname === '/api/currencies') return ok(CUR)
  // 【编辑】三臂（Kevin 2026-10-21）：/api/user 三键载荷按臂切换（owner / manage_tasks / 普通）；
  // PATCH 写口留痕载荷（断言「只含变化字段」）并合并进夹具行 ⇒ 保存后的重拉读到新值。
  if (pathname === '/api/user') {
    STATE.calls.push({ method, path: pathname })
    return ok(STATE.userPayload)
  }
  const patchEdit = pathname.match(/^\/api\/project\/(\d+)$/)
  if (patchEdit && method === 'PATCH') {
    STATE.calls.push({ method, path: pathname })
    let body = {}
    try { body = rawBody ? JSON.parse(rawBody) : {} } catch { body = {} }
    STATE.patches.push({ path: pathname, projectId: Number(patchEdit[1]), body })
    STATE.rows = STATE.rows.map((r) => (r.project_id === Number(patchEdit[1]) ? { ...r, ...body } : r))
    const row = STATE.rows.find((r) => r.project_id === Number(patchEdit[1]))
    return ok(row ? { ...row } : {})
  }
  // 签到面（Kevin 2026-10-20：电量卡 + 签到区并入 /wage 顶部 ⇒ 探针必须喂这两个读口）
  if (pathname === '/api/batt') {
    STATE.calls.push({ method, path: pathname })
    return ok({
      batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
      bttc: {
        balance: '12', status: 'listed', canMint: false, canBurn: false, usdBalance: '5',
        policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1 },
      },
    })
  }
  if (pathname === '/api/checkin') {
    STATE.calls.push({ method, path: pathname })
    return ok({ streakDay: 3, streakCapDays: 7, checkedInToday: false, canMakeup: false, makeupCostUsd: '1' })
  }
  const claim = pathname.match(/^\/api\/project\/(\d+)\/claim$/)
  if (claim && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    if (STATE.claimFail) {
      return { success: false, error: { code: 'WAGE_CLAIM_TOO_SOON', details: { reason: STATE.claimFailReason, remaining_seconds: 90 } } }
    }
    // 成功：batt + 次币两笔到账；★ **响应里不返 next_claim_at** ⇒ 前端必须靠「刷新列表」拿新时间，
    //   这一臂专验「成功 ⇒ 重拉 ⇒ 用服务端新 next_claim_at 重新置灰」这条链（不靠本地按间隔猜）。
    if (STATE.afterClaimNextAt) {
      STATE.rows = STATE.rows.map((r) => (
        r.project_id === Number(claim[1]) ? { ...r, next_claim_at: STATE.afterClaimNextAt } : r
      ))
    }
    return ok({ wage_batt: 30, wage_currency_amount: 20 })
  }
  const apply = pathname.match(/^\/api\/project\/(\d+)\/apply$/)
  if (apply && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    return ok({ applied: true })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  // 未知项目 ref（如已删页 `/activities` 落到 `:slug`）⇒ 读口按真契约 404。
  // 须排在通用 GET 兜底之前，否则 `{rows:[]}` 会让项目页把「不存在的项目」渲染成空项目页
  // （`/activities` 的 catch-all「页面不存在」也就永远不出现）。
  if (method === 'GET' && /^\/api\/project\/[^/]+$/.test(pathname)) {
    STATE.calls.push({ method, path: pathname })
    return fail(404, 'PROJECT_NOT_FOUND', { reason: 'project_not_found' })
  }
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
    // ★ 2026-10-24：资金变动类成功反馈 = Toast ⇒ 读数改看 react-hot-toast 的容器
    //   （[data-rht-toaster] 是它自己打的容器钩子；条目 role="status"），
    //   同时留一条独立读数证明「模态框已整体撤掉」（判据数不减）。
    toasts: qa('[data-rht-toaster] [role="status"]').map((el) => txt(el)),
    claimModal: {
      present: !!q('[data-sf-m="wage-claim"]'),
      count: qa('[data-sf-m="wage-claim"]').length,
    },
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
    // ★ 2026-10-23「在职 ⇒ 本页零【加入】+ 无「同时只能在一个项目打工」」的两条全页读数
    //   （不按卡取 —— 判据是「整页一个都不许有」，按卡取会漏掉别的卡漏网）。
    wageGate: {
      joinCount: qa('[data-sf-action="join"]').length,
      claimCount: qa('[data-sf-action="claim"]').length,
      oneAtATimePresent: !!q('[data-sf-m="wage-one-at-a-time"]'),
      oneAtATimeText: (() => { const el = q('[data-sf-m="wage-one-at-a-time"]'); return el ? txt(el) : null })(),
    },
    // 签到区（电量卡 + 签到；自 /activities 并入本页顶部）
    checkin: (() => {
      const card = document.getElementById('batt-checkin')
      const wrap = q('[data-sf-m="wage-checkin"]')
      const meter = q('[data-sf-m="batt-meter"]')
      const list = q('[data-sf-m="wage-list"]')
      const btns = [...document.querySelectorAll('#batt-checkin button, #batt-checkin a')]
      const btnTexts = btns.map((el) => txt(el))
      const r = card ? card.getBoundingClientRect() : null
      const lr = list ? list.getBoundingClientRect() : null
      return {
        wrapperPresent: !!wrap,
        hasCard: !!card,
        cardId: card ? card.id : null,
        hasMeter: !!meter,
        meterText: meter ? txt(meter) : null,
        buttonTexts: btnTexts,
        cardTop: r ? Math.round(r.top * 10) / 10 : null,
        cardBottom: r ? Math.round(r.bottom * 10) / 10 : null,
        listTop: lr ? Math.round(lr.top * 10) / 10 : null,
        listPresent: !!list,
        cardRight: r ? Math.round(r.right * 10) / 10 : null,
        // hash 深链：锚点卡落在视口内（'/wage#batt-checkin' 直达可跳过页头）
        cardInViewport: r ? r.top >= -1 && r.top < innerHeight : null,
        scrollY: Math.round(scrollY),
        activitiesPageHooks: qa('[data-sf-m="activities-page"]').length,
        notFoundHooks: qa('[data-sf-m="not-found-page"]').length,
        pathname: location.pathname,
      }
    })(),
    // 编辑面总读数（全页一次性）：任一 > 0 ⇒ 行内编辑残留
    editSurface: {
      editButtons: qa('[data-sf-m="wage-card-edit"]').length,
      formRoots: qa('[data-sf-m="wage-edit"]').length,
      fields: qa('[data-sf-edit]').length,
      hints: qa('[data-sf-edit-hint]').length,
      errs: qa('[data-sf-edit-err]').length,
      saveButtons: qa('[data-sf-m="wage-edit-save"]').length,
      minDaysSelect: qa('[data-sf-edit="minDays"]').length,
      minDaysHint: qa('[data-sf-edit-hint="minDays"]').length,
      option365: qa('option[value="365"]').length,
    },
    cards: cards.map((c) => {
      const st = c.querySelector('[data-sf-m="wage-card-status"]')
      const act = c.querySelector('[data-sf-m="wage-card-action"]')
      const hint = c.querySelector('[data-sf-m="wage-card-hint"]')
      const extra = c.querySelector('[data-sf-m="wage-card-wage-extra"]')
      const notice = c.querySelector('[data-sf-m="wage-card-notice"]')
      const badge = c.querySelector('[data-sf-m="wage-card-joined"]')
      const ttl = c.querySelector('[data-sf-m="wage-card-title"]')
      const av = c.querySelector('[data-sf-m="wage-card-avatar"]')
      const avImg = av ? av.querySelector('img') : null
      const avInit = av ? av.querySelector('.sf-wage-card-avatar-initial') : null
      const avCs = av ? getComputedStyle(av) : null
      const avR = av ? av.getBoundingClientRect() : null
      // 圆角读数：border-radius 50% 的 computed 值会把百分比原样返（如 "50%"）⇒ 按短边折算成 px，
      // 否则「圆形」判据会被读成 50px 而假过。
      const avRadiusRaw = avCs ? avCs.borderTopLeftRadius : null
      const avRadiusPx = avR
        ? (String(avRadiusRaw).indexOf('%') >= 0
          ? (parseFloat(avRadiusRaw) / 100) * Math.min(avR.width, avR.height)
          : parseFloat(avRadiusRaw))
        : null
      const tR = ttl ? ttl.getBoundingClientRect() : null
      const tCs = ttl ? getComputedStyle(ttl) : null
      const r = c.getBoundingClientRect()
      const cs = getComputedStyle(c)
      const tint = getComputedStyle(c, '::before')
      return {
        left: Math.round(r.left * 10) / 10,
        // ★ 2026-10-22 卡头头像读数：40px 圆形 / 两形态（img ・ 首字彩底）/ 档位 / 与标题同一行
        avatar: av ? {
          present: true,
          mode: av.getAttribute('data-sf-avatar'),
          tone: av.getAttribute('data-sf-tone'),
          w: Math.round(avR.width * 10) / 10,
          h: Math.round(avR.height * 10) / 10,
          radiusPx: Math.round(avRadiusPx * 10) / 10,
          radiusRaw: avRadiusRaw,
          overflow: avCs.overflow,
          imgSrc: avImg ? avImg.getAttribute('src') : null,
          imgAlt: avImg ? avImg.getAttribute('alt') : null,
          imgFit: avImg ? getComputedStyle(avImg).objectFit : null,
          initial: avInit ? txt(avInit) : null,
          bgImage: avCs.backgroundImage.slice(0, 80),
          left: Math.round(avR.left * 10) / 10,
          right: Math.round(avR.right * 10) / 10,
          top: Math.round(avR.top * 10) / 10,
          bottom: Math.round(avR.bottom * 10) / 10,
          centerY: Math.round(((avR.top + avR.bottom) / 2) * 10) / 10,
        } : { present: false },
        head: {
          titleCenterY: tR ? Math.round(((tR.top + tR.bottom) / 2) * 10) / 10 : null,
          titleTop: tR ? Math.round(tR.top * 10) / 10 : null,
          titleLeft: tR ? Math.round(tR.left * 10) / 10 : null,
          titleH: tR ? Math.round(tR.height * 10) / 10 : null,
          titleTextOverflow: tCs ? tCs.textOverflow : null,
          titleWhiteSpace: tCs ? tCs.whiteSpace : null,
          titleEllipsis: tCs ? tCs.textOverflow === 'ellipsis' && tCs.whiteSpace === 'nowrap' : null,
        },
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
        // 已加入卡的区分度（data 旗标 / 徽标 / 描边 / 叠加层）
        joined: c.getAttribute('data-sf-joined'),
        role: c.getAttribute('data-sf-role'),
        joinedBadge: txt(badge),
        joinCount: c.querySelectorAll('[data-sf-action="join"]').length,
        claimCount: c.querySelectorAll('[data-sf-action="claim"]').length,
        // 零编辑臂（2026-10-21②）：本页不得再出现【编辑】钮（判定已搬到项目页）
        editBtn: !!c.querySelector('[data-sf-m="wage-card-edit"]'),
        editBtnText: txt(c.querySelector('[data-sf-m="wage-card-edit"]')),
        // 整卡链接读数（编辑搬走后「入口保留」）：有 slug ⇒ A + href；历史行 ⇒ ARTICLE + null
        cardTag: c.tagName,
        cardHref: c.getAttribute('href'),
        bgColor: cs.backgroundColor,
        borderLeftWidth: cs.borderLeftWidth,
        borderLeftColor: cs.borderLeftColor,
        tintBg: tint.backgroundColor,
        tintOpacity: tint.opacity,
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
    // 媒体口直出 1×1 PNG：卡头 `<img>` 头像臂需要一张真图（否则破图会影响几何读数）
    if (u.pathname.startsWith('/api/media/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX })
    }
    if (u.pathname.startsWith('/api/')) {
      const payload = apiResponse(req.method(), u.pathname, req.postData())
      const status = payload && payload.__status ? payload.__status : 200
      const body = payload && payload.__status ? payload.body : payload
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
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

  // ============================ ① 签到区（登录态 · /wage 顶部）======================
  // 口径（Kevin 2026-10-20）：电量卡 + 签到区**并入 /wage 顶部**（原 /activities 已删）。
  // 断言 = ① 登录态渲染电量点阵 + 签到按钮（mock 会话 + 内存读口）；
  //        ② 项目列表仍在，且位于签到区**下方**（DOM 位置 + 几何 top 双证）；
  //        ③ 两个读口真被调用（不是靠本地假数据渲染出来的卡）。
  const openAny = async (url) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    return page.evaluate(SNAP_FN)
  }
  STATE.calls.length = 0
  const ciSnap = await open('/wage')
  const ci = ciSnap.checkin
  out.states['1536_checkin'] = {
    checkin: ci,
    page: ciSnap.page,
    cards: ciSnap.cards.length,
    overflowPx: ciSnap.overflowPx,
    apiCalls: STATE.calls.map((c) => c.path),
  }
  out.assertions.checkin = {
    wrapperPresent: ci.wrapperPresent === true,
    cardPresent: ci.hasCard === true && ci.cardId === 'batt-checkin',
    meterPresent: ci.hasMeter === true,
    meterHasBattText: /70/.test(ci.meterText || ''),
    // ★ 签到 UI 下线订正（Kevin 2026-10-20 需求③ · 已随 c5fb450 落库；BTTC 铸/解迁 /profile/assets）：
    //   卡面 = 电量表独存，【签到】/【铸造】/【分解】一律零在场（反向断言 = 不得回归）；
    //   读口 = /api/batt 在用、/api/checkin 零调用（UI 下线 ⇒ 不再读）。
    //   HEAD 探针对拍证据：/tmp/probe-head-result.json 同此 3 键红（判据早于契约变更，非本单引入）。
    checkinUiRetired: (ci.buttonTexts || []).length === 0 && ci.hasMeter === true,
    mintAreaRetired: (ci.buttonTexts || []).length === 0,
    battReadWired: STATE.calls.some((c) => c.path === '/api/batt') && !STATE.calls.some((c) => c.path === '/api/checkin'),
    listBelowCheckin: ci.listPresent === true && ci.cardBottom !== null && ci.listTop !== null && ci.cardBottom <= ci.listTop,
    gapPx: ci.cardBottom !== null && ci.listTop !== null ? Math.round((ci.listTop - ci.cardBottom) * 10) / 10 : null,
    cardsStillListed: ciSnap.cards.length === ROWS.length,
    zeroOverflow: ciSnap.overflowPx === 0,
  }

  // 旧页面深链的替代落点：`/wage#batt-checkin`（锚点机制随组件搬入 ⇒ 仍可直达签到卡）
  const hashSnap = await openAny('/wage#batt-checkin')
  out.states['1536_hash_deeplink'] = hashSnap.checkin
  out.assertions.hashDeepLink = {
    cardPresent: hashSnap.checkin.hasCard === true,
    cardInViewport: hashSnap.checkin.cardInViewport === true,
    listStillBelow: hashSnap.checkin.listPresent === true,
  }

  // ============================ ③ 旧页 `/activities` 已删除 ========================
  // 硬删、无 301（同 /reward 一族）：同 URL 呈现 catch-all「页面不存在」提示页，不再白屏。
  const goneSnap = await openAny('/activities')
  out.states['1536_activities_gone'] = goneSnap.checkin
  out.assertions.activitiesGone = {
    pathnameIsActivities: goneSnap.checkin.pathname === '/activities',
    noActivitiesPageHook: goneSnap.checkin.activitiesPageHooks === 0,
    catchAllNotFound: goneSnap.checkin.notFoundHooks === 1,
    notRedirectedToWage: goneSnap.page.hasPage === false,
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
    // ★ 2026-10-23 契约（在职 ⇒ 本页零【加入】）：此前是「别人的【加入】置灰」，现在是**整页一个都不渲染**。
    //   判据按「整页计数」取（不逐卡取），杜绝某张卡漏网仍算绿。
    otherNoJoinWhenHired: ['102', '103', '104', '105', '106', '110'].every((id) => byId[id] && byId[id].joinCount === 0 && byId[id].action !== 'join'),
    pageWideZeroJoinWhenHired: listSnap.wageGate.joinCount === 0,
    // ★ 「同时只能在一个项目打工」也不再随卡出现（在职时整页唯一的那句也不渲染）
    noOneAtATimeWhenHired: ['102', '103'].every((id) => byId[id] && byId[id].hint !== ZH.wage.oneAtATime)
      && listSnap.wageGate.oneAtATimePresent === false,
    // ★ 已招满臂在「无人在职」时单独取（有在职项目时 oneAtATime 是更强的理由、优先展示）⇒ 见下方 fullExtraArm
    fullCardDisabledWithHint: null,
    closedNoAction: ['108', '109'].every((id) => byId[id] && byId[id].action === null),
  }

  // ★ 派单三臂之一：已加入行**只渲染【领工资】，不得再出现【加入】**；
  //   并核「已加入 = 另一套配色」（data 旗标 + 徽标 + 左侧强调边 + 淡黄叠加层），未加入卡一字不动。
  const joinedCard = byId['101']
  const plainCard = byId['102']
  out.states['1536_joined_card'] = { joined: joinedCard, plain: plainCard }
  out.assertions.joinedCard = {
    hiredOnlyClaim: Boolean(joinedCard && joinedCard.action === 'claim' && joinedCard.claimCount === 1 && joinedCard.joinCount === 0),
    noCardMixesJoinAndClaim: listSnap.cards.every((c) => !(c.joinCount > 0 && c.claimCount > 0)),
    // ★ 在职臂：**别处的卡也不再有【加入】**（新契约 —— 加入/切换入口只在项目页 `/:slug`）
    noOtherJoinButtonsWhenHired: ['102', '103', '104', '105', '106', '110'].every((id) => byId[id] && byId[id].joinCount === 0 && byId[id].claimCount === 0),
    joinedFlag: Boolean(joinedCard && joinedCard.joined === '1'),
    plainFlag: Boolean(plainCard && plainCard.joined === '0'),
    joinedBadgeText: Boolean(joinedCard && joinedCard.joinedBadge === ZH.wage.joinedBadge),
    plainNoBadge: Boolean(plainCard && plainCard.joinedBadge === null),
    badgeCount1: listSnap.cards.filter((c) => c.joined === '1').length === 1,
    borderDiffers: Boolean(
      joinedCard && plainCard
        && joinedCard.borderLeftWidth !== plainCard.borderLeftWidth
        && joinedCard.borderLeftColor !== plainCard.borderLeftColor
    ),
    borderIsAccent: Boolean(joinedCard && joinedCard.borderLeftWidth === '4px' && joinedCard.borderLeftColor === 'rgb(255, 230, 15)'),
    tintDiffers: Boolean(
      joinedCard && plainCard && joinedCard.tintBg !== plainCard.tintBg && joinedCard.tintOpacity === '0.12'
    ),
    plainTintNone: Boolean(plainCard && plainCard.tintOpacity !== '0.12'),
  }

  // ===== 已招满臂（无人在职态）：把唯一在职行的 my_role 抹成 none 后重载 =====
  STATE.rows = STATE.rows.map((r) => (r.project_id === 101 ? { ...r, my_role: 'none' } : r))
  const fullSnap = await open('/wage')
  const byIdFull = Object.fromEntries(fullSnap.cards.map((c) => [c.project, c]))
  out.states['1536_full_arm'] = {
    c107: byIdFull['107'],
    c102: byIdFull['102'],
    wageGate: fullSnap.wageGate,
  }
  out.assertions.list.fullCardDisabledWithHint = Boolean(
    byIdFull['107'] && byIdFull['107'].actionDisabled === true && byIdFull['107'].hint === ZH.wage.full
  )
  // ★ 未在职臂（新契约的正向面）：无人在职 ⇒ 招募中的卡**全部**有【加入】+ 页头那句提示在场。
  //   计数 = 8（101..107 + 110 全是 `status=recruiting`；107 已招满 ⇒ 钮在但 disabled 并挂「已招满」，
  //   已截止的 108/109 零动作按钮）。判据取**整页计数**（不按卡白名单），漏一张即红。
  out.assertions.list.joinCountWhenFree = fullSnap.wageGate.joinCount === 8
  out.assertions.list.oneAtATimeWhenFree = fullSnap.wageGate.oneAtATimePresent === true
    && fullSnap.wageGate.oneAtATimeText === ZH.wage.oneAtATime
  out.assertions.list.joinEnabledWhenFree = Boolean(
    byIdFull['102'] && byIdFull['102'].action === 'join' && byIdFull['102'].actionDisabled === false
      && byIdFull['102'].hint === null
  )
  // 复原夹具（后续领工资臂需要 101 仍为在职）+ 重载页面让卡面回到在职态
  STATE.rows = STATE.rows.map((r) => (r.project_id === 101 ? { ...r, my_role: 'hired' } : r))
  STATE.calls.length = 0
  await open('/wage') // 这一发 = 卡面初始拉取（作为「领完重拉」的计数基线）

  // ============================ ③-b 倒计时臂（next_claim_at 未到 ⇒ 置灰 + 倒计时；到点自动可点）==
  // 口径：hired 行带 `next_claim_at`（未来 6s）⇒ 按钮置灰 + 「m:ss 后可领」、点了零请求；
  //       走真实时间（不 mock 时钟）⇒ 1s tick 自动转可用 ⇒ 可点领薪、卡内显示 batt + 次币，
  //       并用**刷新拿到的服务端新 next_claim_at**（3h25m，故意不等于 wage_interval_hours 4h）重新置灰。
  STATE.countdownMs = 6000
  STATE.afterClaimNextAt = new Date(Date.now() + 3 * 3600 * 1000 + 25 * 60 * 1000).toISOString()
  STATE.calls.length = 0
  const cdSnap = await open('/wage')
  const cd0 = cdSnap.cards.find((c) => c.project === '101')
  out.states['1536_countdown_before'] = cd0
  // 置灰期间点击必须零写请求（disabled 按钮的 click 不触发 handler）
  await page.evaluate(() => {
    const b = document.querySelector('[data-sf-project="101"] [data-sf-action="claim"]')
    if (b) b.click()
  })
  await settle(page)
  const cdClicksWhileGated = STATE.calls.filter((c) => /\/claim$/.test(c.path)).length

  const cdDue = await page.waitForFunction(() => {
    const b = document.querySelector('[data-sf-project="101"] [data-sf-action="claim"]')
    return !!b && b.getAttribute('data-sf-claimable') === '1'
  }, null, { timeout: 20000 }).then(() => true).catch(() => false)
  await settle(page)
  const cd1 = (await page.evaluate(SNAP_FN)).cards.find((c) => c.project === '101')
  out.states['1536_countdown_after'] = { due: cdDue, card: cd1 }

  // 到点后撤掉「按请求时刻重算 next_claim_at」的模拟 ⇒ 领薪成功后的刷新读到的是服务端**新时间**
  STATE.countdownMs = 0
  await page.click('[data-sf-project="101"] [data-sf-action="claim"]')
  // ★ 2026-10-24：成功改 Toast（卡内零成功文案）⇒ 等 toast 出现，不再等卡内 ok 节点
  await page.waitForFunction(() => {
    const t = document.querySelector('[data-rht-toaster] [role="status"]')
    return !!t && /已领到/.test(t.textContent || '')
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const cd2 = (await page.evaluate(SNAP_FN)).cards.find((c) => c.project === '101')
  const cdSnap2 = await page.evaluate(SNAP_FN)
  const cdRemaining = Number(cd2 && cd2.remaining)
  out.states['1536_countdown_claim'] = {
    card: cd2,
    toastTexts: cdSnap2.toasts,
    claimModal: cdSnap2.claimModal,
    remainingSeconds: cdRemaining,
    intervalFallbackSeconds: 4 * 3600,
    serverNextAtSeconds: Math.round((Date.parse(STATE.afterClaimNextAt) - Date.now()) / 1000),
    claimPosts: STATE.calls.filter((c) => /\/claim$/.test(c.path)).length,
    listFetches: STATE.calls.filter((c) => c.path === '/api/project/all').length,
  }
  out.assertions.countdown = {
    gatedWithCountdown: Boolean(
      cd0 && cd0.action === 'claim' && cd0.actionDisabled === true && cd0.claimable === '0'
        && Number(cd0.remaining) > 0 && Number(cd0.remaining) <= 7 && /后可领$/.test(cd0.hint || '')
    ),
    zeroWriteWhileGated: cdClicksWhileGated === 0,
    autoEnabledAtDueTime: cdDue === true && Boolean(cd1 && cd1.actionDisabled === false && cd1.claimable === '1' && cd1.hint === null),
    // 到账（batt + 次币）改由 Toast 承载；同时卡内不得有 ok 节点、DOM 里不得有模态框
    claimOkWithBothCurrencies: Boolean(
      cdSnap2.toasts.some((s) => /⚡️\s*30/.test(s || '') && /20\s*BTTC/.test(s || ''))
        && (cd2 && cd2.noticeKind !== 'ok')
        && cdSnap2.claimModal.count === 0
    ),
    // 重新置灰的剩余量 ≈ 服务端新 next_claim_at（3h25m）而不是本地间隔兜底（4h）⇒ 证明「刷新拿新时间」生效
    regatedByServerNextAt: cdRemaining > 12000 && cdRemaining <= 12400,
    claimPostCount1: STATE.calls.filter((c) => /\/claim$/.test(c.path)).length === 1,
    listRefetchedAfterClaim: STATE.calls.filter((c) => c.path === '/api/project/all').length >= 2,
  }

  // 复原：倒计时臂改过的行与状态全部回位，再跑原有的「领工资成功臂」
  STATE.countdownMs = 0
  resetRows()
  STATE.calls.length = 0
  await open('/wage')

  // ============================ ③ 领工资成功臂 =====================================
  await page.click('[data-sf-project="101"] [data-sf-action="claim"]')
  await settle(page)
  // ★ 2026-10-24：成功反馈 = Toast ⇒ 等 toast 条目出现（不再等卡内 ok 节点）
  await page.waitForFunction(() => {
    const t = document.querySelector('[data-rht-toaster] [role="status"]')
    return !!t && /已领到/.test(t.textContent || '')
  }, null, { timeout: 5000 }).catch(() => {})
  await settle(page)
  const afterClaim = await page.evaluate(SNAP_FN)
  const c101 = afterClaim.cards.find((c) => c.project === '101')
  const claimToast = (afterClaim.toasts || []).join(' | ')
  out.states['1536_claim_ok'] = {
    toastTexts: afterClaim.toasts,
    claimModal: afterClaim.claimModal,
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
    // 成功反馈 = Toast：文案含到账 batt 与次币；卡内零 ok 节点；模态框计数 0
    toastOk: afterClaim.toasts.length >= 1 && /已领到/.test(claimToast),
    toastHasBatt: /⚡️\s*30/.test(claimToast),
    toastHasCurrency: /20\s*BTTC/.test(claimToast),
    cardNoOkNotice: c101 && c101.noticeKind !== 'ok',
    claimModalGone: afterClaim.claimModal.count === 0,
    cardRefreshedAndGated: c101 && c101.claimable === '0' && Number(c101.remaining) > 0,
    listRefetched: STATE.calls.filter((c) => c.path === '/api/project/all').length >= 2,
    cardStillPresent: afterClaim.cards.length === 10,
  }

  // ============================ ③ 领工资失败臂（400 间隔未到） =====================
  // 前置：清掉 101 的 next_claim_at —— 成功臂刷新后它已被置灰，而失败臂需要一个**可点**的按钮。
  resetRows()
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
  const geoSnaps = {}
  for (const [label, width, height] of [['390', 390, 844], ['1536', 1536, 960]]) {
    await page.setViewportSize({ width, height })
    const snap = await open('/wage')
    geoSnaps[label] = snap
    out.states[`${label}_geometry`] = {
      overflowPx: snap.overflowPx,
      cards: snap.cards.length,
      cardRightMax: Math.max(...snap.cards.map((c) => c.right)),
      actionHeights: [...new Set(snap.cards.map((c) => c.actionH).filter(Boolean))],
      floatmenuCount: snap.floatmenu.count,
      // 签到区在两档都必须在场、且在视口内不溢出（并入顶部后不得把列表挤出去）
      checkinPresent: snap.checkin.hasCard === true,
      checkinRight: snap.checkin.cardRight,
      checkinAboveList: snap.checkin.cardBottom !== null && snap.checkin.listTop !== null
        && snap.checkin.cardBottom <= snap.checkin.listTop,
      checkinButtons: snap.checkin.buttonTexts,
      // ★ 2026-10-22 卡头头像（两档读数留证）：形态 / 尺寸 / 档位
      avatarModes: snap.cards.map((c) => `${c.project}:${c.avatar.mode}`),
      avatarSizes: [...new Set(snap.cards.map((c) => `${c.avatar.w}x${c.avatar.h}`))],
      avatarTones: snap.cards.filter((c) => c.avatar.mode === 'initial').map((c) => c.avatar.tone),
      // 已加入卡的配色区分在两档都必须成立（joined 卡 = 4px 黄边 + 淡黄叠加 + 徽标）
      joinedCards: snap.cards.filter((c) => c.joined === '1').length,
      joinedBorder: (snap.cards.find((c) => c.joined === '1') || {}).borderLeftWidth,
      joinedTint: (snap.cards.find((c) => c.joined === '1') || {}).tintOpacity,
      joinedBadge: (snap.cards.find((c) => c.joined === '1') || {}).joinedBadge,
      plainBorder: (snap.cards.find((c) => c.joined === '0') || {}).borderLeftWidth,
      plainTint: (snap.cards.find((c) => c.joined === '0') || {}).tintOpacity,
    }
  }
  out.assertions.geometry = {
    zeroOverflow390: out.states['390_geometry'].overflowPx === 0,
    zeroOverflow1536: out.states['1536_geometry'].overflowPx === 0,
    cards390: out.states['390_geometry'].cards === 10,
    touchTarget44On390: out.states['390_geometry'].actionHeights.every((h) => h >= 44),
    cardRightWithinViewport390: out.states['390_geometry'].cardRightMax <= 390,
    checkin390: out.states['390_geometry'].checkinPresent === true
      && out.states['390_geometry'].checkinAboveList === true
      && out.states['390_geometry'].checkinRight <= 390,
    checkin1536: out.states['1536_geometry'].checkinPresent === true
      && out.states['1536_geometry'].checkinAboveList === true,
    zeroPageErrors: pageErrors.length === 0,
    // ★ 已加入卡两档都可辨（底色/描边与普通卡 computed 值不同）
    joinedDistinct390: out.states['390_geometry'].joinedCards === 1
      && out.states['390_geometry'].joinedBorder !== out.states['390_geometry'].plainBorder
      && out.states['390_geometry'].joinedTint !== out.states['390_geometry'].plainTint,
    joinedBadge390: out.states['390_geometry'].joinedBadge === ZH.wage.joinedBadge,
    joinedDistinct1536: out.states['1536_geometry'].joinedCards === 1
      && out.states['1536_geometry'].joinedBorder !== out.states['1536_geometry'].plainBorder
      && out.states['1536_geometry'].joinedTint !== out.states['1536_geometry'].plainTint,
    joinedBadge1536: out.states['1536_geometry'].joinedBadge === ZH.wage.joinedBadge,
  }

  // ============================ ⑦ 卡头头像（Kevin 2026-10-22）=========================
  // 口径：卡头左组首位 = 40px 圆形头像，与标题同一行、垂直居中；
  //   行有 `avatar_url` ⇒ `<img src>`（object-fit:cover、alt=""）；
  //   无 ⇒ 项目名首字 + `data-sf-tone`（档位 = 前端唯一真源 `avatarToneOf(name)`，1..10）；
  //   两档（1536 / 390）尺寸/圆形/同行/标题 ellipsis 全等，零溢出、零 pageerror。
  const AVATAR_TITLE = Object.fromEntries(ROWS.map((r) => [String(r.project_id), r.title]))
  const AVATAR_URL = Object.fromEntries(ROWS.map((r) => [
    String(r.project_id),
    typeof r.avatar_url === 'string' ? r.avatar_url.trim() : '',
  ]))
  const cardsOf = (snap) => snap.cards
  const byProject = (snap) => Object.fromEntries(snap.cards.map((c) => [c.project, c]))
  const wideAvatars = cardsOf(geoSnaps['1536'])
  const narrowAvatars = cardsOf(geoSnaps['390'])
  const wideById = byProject(geoSnaps['1536'])
  const narrowById = byProject(geoSnaps['390'])
  const tonesOf = (snap) => Object.fromEntries(
    snap.cards.map((c) => [c.project, c.avatar && c.avatar.mode === 'initial' ? c.avatar.tone : null])
  )
  const bothCards = [...wideAvatars.map((c) => ['1536', c]), ...narrowAvatars.map((c) => ['390', c])]

  out.states['1536_avatar'] = {
    rows: AVATAR_IMG_IDS.length,
    imgCards: AVATAR_IMG_IDS.map((id) => (wideById[id] || {}).avatar || null),
    initialCards: AVATAR_INITIAL_IDS.map((id) => ({ project: id, avatar: (wideById[id] || {}).avatar || null, head: (wideById[id] || {}).head || null })),
  }
  out.states['390_avatar'] = {
    imgCards: AVATAR_IMG_IDS.map((id) => (narrowById[id] || {}).avatar || null),
    initialCards: AVATAR_INITIAL_IDS.map((id) => ({ project: id, avatar: (narrowById[id] || {}).avatar || null, head: (narrowById[id] || {}).head || null })),
    overflowPx: geoSnaps['390'].overflowPx,
  }
  out.assertions.avatar = {
    // ① 每张卡都有头像（10/10，两档同判）
    avatarOnEveryCard: bothCards.every(([, c]) => c.avatar && c.avatar.present === true) && wideAvatars.length === ROWS.length,
    // ② 尺寸 = 40×40（两档同值，几何常量）
    avatarSize40Both: bothCards.every(([, c]) => c.avatar.w === 40 && c.avatar.h === 40),
    // ③ 圆形：圆角半径 = 短边一半（40px 圆形 ⇒ 半径 20px；百分比按短边折算后判，不拿 50 当 px 假过）
    avatarCircleBoth: bothCards.every(([, c]) => (
      c.avatar.radiusPx !== null && Math.abs(c.avatar.radiusPx * 2 - Math.min(c.avatar.w, c.avatar.h)) <= 0.5
    )),
    avatarClipBoth: bothCards.every(([, c]) => c.avatar.overflow === 'hidden'),
    // ④ 两形态按夹具分流：有 url 的恰好 2 张 `<img>`、其余 8 张首字彩底
    avatarTwoForms: wideAvatars.filter((c) => c.avatar.mode === 'img').map((c) => c.project).sort().join(',')
      === AVATAR_IMG_IDS.slice().sort().join(',')
      && wideAvatars.filter((c) => c.avatar.mode === 'initial').map((c) => c.project).sort().join(',')
      === AVATAR_INITIAL_IDS.slice().sort().join(','),
    // ⑤ `<img>` 臂：src = 行内 avatar_url、object-fit:cover、alt="" 装饰图、零首字/零档位
    avatarImgArm: AVATAR_IMG_IDS.every((id) => {
      const c = wideById[id]
      return Boolean(
        c && c.avatar.mode === 'img'
          && c.avatar.imgSrc === AVATAR_URL[id]
          && c.avatar.imgFit === 'cover'
          && c.avatar.imgAlt === ''
          && c.avatar.initial === null
          && c.avatar.tone === null
      )
    }),
    // ⑥ 首字臂：首字 = 项目名首字、档位 = avatarToneOf(名字) 且落在 1..10、零 `<img>`
    avatarInitialArm: AVATAR_INITIAL_IDS.every((id) => {
      const c = wideById[id]
      const expectedInitial = Array.from(String(AVATAR_TITLE[id]).trim())[0] || '?'
      return Boolean(
        c && c.avatar.mode === 'initial'
          && c.avatar.initial === expectedInitial
          && c.avatar.imgSrc === null
          && Number(c.avatar.tone) === avatarToneOf(AVATAR_TITLE[id])
      )
    }),
    avatarToneInRange: bothCards
      .filter(([, c]) => c.avatar.mode === 'initial')
      .every(([, c]) => Number(c.avatar.tone) >= 1 && Number(c.avatar.tone) <= 10),
    // ⑦ 档位由名字决定且**稳定**：两档（两次独立加载）逐项目同值
    avatarToneStable: JSON.stringify(tonesOf(geoSnaps['1536'])) === JSON.stringify(tonesOf(geoSnaps['390'])),
    // ⑧ 与标题同一行且垂直居中（40px 头像中心 = 标题行中心 ⇒ 卡头没被头像挤折行）
    avatarSameRowBoth: bothCards.every(([, c]) => (
      c.head.titleCenterY !== null && Math.abs(c.avatar.centerY - c.head.titleCenterY) <= 1.5
    )),
    // ⑨ 标题单行 ellipsis（min-width:0 + text-overflow）⇒ 长名/窄档不换行；行高不超过一行
    avatarTitleEllipsisBoth: bothCards.every(([, c]) => c.head.titleEllipsis === true),
    avatarTitleSingleLine: bothCards.every(([, c]) => c.head.titleH !== null && c.head.titleH <= 24),
    // ⑩ 头像不出卡（左右都在卡内），两档零横向溢出
    avatarInsideCardBoth: bothCards.every(([, c]) => c.avatar.left >= c.left - 0.5 && c.avatar.right <= c.right + 0.5),
    avatarZeroOverflow390: geoSnaps['390'].overflowPx === 0,
    avatarZeroOverflow1536: geoSnaps['1536'].overflowPx === 0,
    avatarCardCountBoth: geoSnaps['390'].cards.length === ROWS.length && geoSnaps['1536'].cards.length === ROWS.length,
  }

  // ============================ ⑥ 项目卡【零编辑】（Kevin 2026-10-21②：编辑已移入项目页）=========
  // 口径：编辑入口（旧卡头【编辑】+ 卡内行内表单）**整体搬到项目页** `/:slug` 的【编辑项目】+ 模态框
  //   ⇒ 本页必须：零【编辑】钮、零行内表单件（表单根 / 字段 / 提示行 / 注册天数 select / 保存钮）、
  //   **零 PATCH**、**零 `/api/user` 三键取数**（管理员判定随入口一起搬走）。
  //   三臂摆位互相独立（本页不调 loadListingEditAdmin ⇒ 无模块级缓存串味）：
  //     Z1 owner 行（103 的 owner_uid = 我）+ /api/user 带 manage_tasks ⇒ 最强负向；
  //     Z2 两档视口（1536 / 390）同判；Z3 manage_tasks 管理员载荷（非 owner）；Z4 普通用户；
  //     Z5 历史注册天数（0 / 90 行）⇒ 旧四选一控件不得回归。
  //   ★ 判据数不减：本组 34 条（= 旧【编辑】三臂 + 四选一臂之和）。

  // —— Z1 owner 臂：即使「我的项目 + 管理员载荷」也不许出钮 / 不许取三键 ——
  resetRows()
  STATE.userPayload = { uID: 970213, admin: { can_access_admin: true, is_admin: false, permissions: ['manage_tasks'] } }
  STATE.rows = STATE.rows.map((r) => (r.project_id === 103 ? { ...r, owner_uid: '970213' } : r))
  STATE.calls.length = 0
  STATE.patches.length = 0
  const z1 = await open('/wage')
  const z1ById = Object.fromEntries(z1.cards.map((c) => [c.project, c]))
  out.states['1536_zeroedit_owner'] = {
    cards: z1.cards.length,
    editCards: z1.cards.filter((c) => c.editBtn).map((c) => c.project),
    editSurface: z1.editSurface,
    userFetches: STATE.calls.filter((c) => c.path === '/api/user').length,
    patches: JSON.parse(JSON.stringify(STATE.patches)),
    link: {
      slugCard: z1ById['103'] ? { tag: z1ById['103'].cardTag, href: z1ById['103'].cardHref } : null,
      legacyCard: z1ById['101'] ? { tag: z1ById['101'].cardTag, href: z1ById['101'].cardHref } : null,
    },
  }
  out.assertions.zeroEditOwner = {
    zeroEditButtonsAnywhere: z1.cards.every((c) => c.editBtn === false),
    ownerCardNoEdit: Boolean(z1ById['103'] && z1ById['103'].editBtn === false),
    othersNoEdit: ['101', '102', '104', '108'].every((id) => z1ById[id] && z1ById[id].editBtn === false),
    zeroEditFormRoots: z1.editSurface.formRoots === 0 && z1.editSurface.saveButtons === 0,
    zeroEditFieldContainers: z1.editSurface.fields === 0 && z1.editSurface.errs === 0,
    zeroEditHints: z1.editSurface.hints === 0,
    zeroUserFetches: STATE.calls.filter((c) => c.path === '/api/user').length === 0,
    zeroPatches: STATE.patches.length === 0,
    cardLinkIntact: Boolean(
      z1ById['103'] && z1ById['103'].cardTag === 'A' && String(z1ById['103'].cardHref || '').endsWith('/wend-an')
        && z1ById['101'] && z1ById['101'].cardTag === 'ARTICLE' && z1ById['101'].cardHref === null
    ),
  }

  // —— Z2 两档视口：1536 / 390 都不得出现编辑面（旧 390「展开态零溢出」臂的正向化订正）——
  STATE.calls.length = 0
  STATE.patches.length = 0
  const z2a = await open('/wage')
  await page.setViewportSize({ width: 390, height: 844 })
  const z2b = await open('/wage')
  await page.setViewportSize({ width: 1536, height: 960 })
  out.states['zeroedit_viewports'] = {
    wide: { surface: z2a.editSurface, cards: z2a.cards.length, overflowPx: z2a.overflowPx },
    mobile: { surface: z2b.editSurface, cards: z2b.cards.length, overflowPx: z2b.overflowPx },
    patches: STATE.patches.length,
    userFetches: STATE.calls.filter((c) => c.path === '/api/user').length,
  }
  out.assertions.zeroEditViewports = {
    zeroEditButtons1536: z2a.editSurface.editButtons === 0,
    zeroEditForms1536: z2a.editSurface.formRoots === 0,
    zeroEditFields1536: z2a.editSurface.fields === 0,
    zeroPatches1536: STATE.patches.length === 0,
    zeroEditButtons390: z2b.editSurface.editButtons === 0,
    zeroEditForms390: z2b.editSurface.formRoots === 0,
    zeroEditFields390: z2b.editSurface.fields === 0,
    zeroOverflow390NoEditForm: z2b.overflowPx === 0 && z2b.cards.length === ROWS.length,
  }

  // —— Z3 manage_tasks 管理员臂（他人卡）：旧口径「管理员全卡有钮」⇒ 新口径「管理员也零钮」——
  resetRows()
  STATE.userPayload = { uID: 970213, admin: { can_access_admin: true, is_admin: false, permissions: ['manage_tasks'] } }
  STATE.calls.length = 0
  STATE.patches.length = 0
  const z3 = await open('/wage')
  const z3ById = Object.fromEntries(z3.cards.map((c) => [c.project, c]))
  out.states['1536_zeroedit_admin'] = {
    editCards: z3.cards.filter((c) => c.editBtn).map((c) => c.project),
    editSurface: z3.editSurface,
    userFetches: STATE.calls.filter((c) => c.path === '/api/user').length,
    payloadAdmin: STATE.userPayload.admin,
  }
  out.assertions.zeroEditAdmin = {
    adminPayloadApplied: STATE.userPayload.admin.permissions.includes('manage_tasks'),
    zeroEditOnAllCards: z3.cards.every((c) => c.editBtn === false),
    hiredCardNoEdit: Boolean(z3ById['101'] && z3ById['101'].editBtn === false),
    closedCardNoEdit: Boolean(z3ById['108'] && z3ById['108'].editBtn === false),
    zeroUserFetches: STATE.calls.filter((c) => c.path === '/api/user').length === 0,
    zeroPatches: STATE.patches.length === 0,
  }

  // —— Z4 普通用户臂（无 admin 三键、非 owner）：同样零钮零请求 ——
  resetRows()
  STATE.userPayload = { uID: 970213 }
  STATE.calls.length = 0
  STATE.patches.length = 0
  const z4 = await open('/wage')
  out.states['1536_zeroedit_user'] = {
    editCount: z4.cards.filter((c) => c.editBtn).length,
    editSurface: z4.editSurface,
    userFetches: STATE.calls.filter((c) => c.path === '/api/user').length,
  }
  out.assertions.zeroEditUser = {
    noEditButtonsAnywhere: z4.cards.every((c) => c.editBtn === false),
    zeroUserFetches: STATE.calls.filter((c) => c.path === '/api/user').length === 0,
    zeroPatchRequests: STATE.patches.length === 0,
  }

  // —— Z5 历史注册天数（0 / 90 行）：旧四选一 select / 提示行不得在本页回归 ——
  resetRows()
  STATE.rows = STATE.rows.map((r) => (
    [104, 110].includes(r.project_id) ? { ...r, owner_uid: '970213' } : r
  ))
  STATE.calls.length = 0
  STATE.patches.length = 0
  const z5 = await open('/wage')
  out.states['1536_zeroedit_mindays'] = {
    surface: z5.editSurface,
    cards: z5.cards.length,
    patches: STATE.patches.length,
    // 0 / 90 两行确实在列表里（夹具真的覆盖了历史值分支）
    legacyRowsVisible: ['104', '110'].every((id) => z5.cards.some((c) => c.project === id)),
  }
  out.assertions.zeroEditFields = {
    noMinDaysSelect: z5.editSurface.minDaysSelect === 0,
    noOption365InPage: z5.editSurface.option365 === 0,
    noMinDaysHint: z5.editSurface.minDaysHint === 0,
    noEditFieldContainers: z5.editSurface.fields === 0 && z5.editSurface.hints === 0,
    noSaveControl: z5.editSurface.saveButtons === 0,
    legacyRowsVisible: ['104', '110'].every((id) => z5.cards.some((c) => c.project === id)),
    zeroPatches: STATE.patches.length === 0,
    zeroUserFetches: STATE.calls.filter((c) => c.path === '/api/user').length === 0,
  }

  // 收尾复原：载荷/行回位（后续客态臂未登录、不取 /api/user，不受影响）
  STATE.userPayload = { uID: 970213 }
  resetRows()

  // ============================ ⑤ 客态公开浏览臂（独立 context，无登录种子）================
  // 口径：`/api/project/all` 是无闸公开读口 ⇒ 未登录也必须渲染项目卡；写口（加入 / 领工资）
  //       点击只弹**卡内登录提示**、零写请求。旧形态「未登录 ⇒ 整页只有登录块、零请求」已作废。
  // ★ 匿名载荷按真契约走：`my_role` / `my_hired_at` / `next_claim_at` **三键整键缺省**
  //   ⇒ 不得被当成 'hired'（卡面必须全是【加入】、无【领工资】、无【已加入】徽标）。
  STATE.anon = true
  STATE.countdownMs = 0
  resetRows()
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
  // 匿名载荷没有 my_role ⇒ 101（登录态下是「已加入」的那张）也必须是【加入】，点了只弹登录提示
  const guestJoin101Clicked = await clickGuest('[data-sf-project="101"] [data-sf-action="join"]')
  const guestAfterJoin101 = await guestPage.evaluate(SNAP_FN)
  const g101guest = guestAfterJoin101.cards.find((c) => c.project === '101')
  const writeCalls = STATE.calls.filter((c) => /(apply|claim)$/.test(c.path))

  out.states['1536_guest'] = {
    page: guestSnap.page,
    cardCount: guestSnap.cards.length,
    titles: guestSnap.cards.map((c) => c.title),
    overflowPx: guestSnap.overflowPx,
    c101: gById['101'],
    c102: gById['102'],
    c103: gById['103'],
    afterJoinClick: g102,
    afterJoinClick101: g101guest,
    writeCalls,
  }
  out.assertions.guest = {
    cardsVisible: guestSnap.cards.length === ROWS.length,
    cardCount: guestSnap.cards.length,
    listRendered: guestSnap.page.hasList === true,
    bannerWithList: guestSnap.page.hasLogin === true && guestSnap.page.hasList === true,
    titleVisible: Boolean(gById['102'] && gById['102'].title === '冷库分拣'),
    wageVisible: Boolean(gById['101'] && (gById['101'].wage || '').includes(
      ZH.wage.wageLine.replace('{{hours}}', '4').replace('{{batt}}', '30')
    )),
    currencyExtraVisible: Boolean(gById['103'] && /BTTC/.test(gById['103'].wageExtra || '')),
    // ★ 三键缺省 ⇒ 不得被读成 hired：无一张卡有【领工资】、无一张卡是【已加入】态，全部【加入】
    noClaimButtons: guestSnap.cards.every((c) => c.claimCount === 0 && c.action !== 'claim'),
    // 招募中的卡全部是【加入】（8 张）；已截止的两张本来就没有动作按钮（状态标签体现）
    allCardsJoinOnly: guestSnap.cards.filter((c) => c.joinCount === 1).length === 8
      && guestSnap.cards.filter((c) => c.statusState === 'closed' && c.action === null).length === 2,
    noJoinedFlag: guestSnap.cards.every((c) => c.joined === '0' && c.joinedBadge === null),
    rolesAnonymous: guestSnap.cards.every((c) => c.role === 'anonymous'),
    joinEnabled: Boolean(
      gById['102'] && gById['102'].action === 'join'
        && gById['102'].actionDisabled === false && gById['102'].needLogin === '1'
    ),
    joinClickLoginPrompt: guestJoinClicked && Boolean(
      g102 && g102.noticeKind === 'login' && (g102.noticeText || '').includes(ZH.wage.loginRequired) && g102.loginLink
    ),
    joinClickLoginPrompt101: guestJoin101Clicked && Boolean(
      g101guest && g101guest.noticeKind === 'login' && (g101guest.noticeText || '').includes(ZH.wage.loginRequired)
    ),
    zeroWriteRequests: writeCalls.length === 0,
    writeCallPaths: writeCalls.map((c) => c.path),
    cardsStableAfterClicks: guestAfterJoin101.cards.length === ROWS.length,
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
  // ★ 全部臂跑完再复核一次累计 pageerror（含新增的签到 / `/activities` 已删 / 客态臂）
  out.assertions.geometry.zeroPageErrors = pageErrors.length === 0
  out.assertions.avatar.zeroPageErrors = pageErrors.length === 0
  const required = [
    'menu.fiveItems', 'menu.noFeedback', 'menu.firstIsWage', 'menu.orderMatches', 'menu.dividers4',
    'checkin.wrapperPresent', 'checkin.cardPresent', 'checkin.meterPresent', 'checkin.meterHasBattText',
    // 签到 UI 下线订正（c5fb450 契约）：三键 1:1 更名，判据数不减（语义随契约订正，反向断言加严）
    'checkin.checkinUiRetired', 'checkin.mintAreaRetired', 'checkin.battReadWired',
    'checkin.listBelowCheckin', 'checkin.cardsStillListed', 'checkin.zeroOverflow',
    'hashDeepLink.cardPresent', 'hashDeepLink.cardInViewport', 'hashDeepLink.listStillBelow',
    'activitiesGone.pathnameIsActivities', 'activitiesGone.noActivitiesPageHook',
    'activitiesGone.catchAllNotFound', 'activitiesGone.notRedirectedToWage',
    'list.tenCards', 'list.recruitingCards', 'list.closedCards', 'list.hiredCardClaimEnabled', 'list.otherNoJoinWhenHired',
    'list.pageWideZeroJoinWhenHired', 'list.noOneAtATimeWhenHired',
    'list.joinCountWhenFree', 'list.oneAtATimeWhenFree', 'list.joinEnabledWhenFree',
    'list.fullCardDisabledWithHint', 'list.closedNoAction',
    // 已加入卡：只有【领工资】、不再有【加入】（在职 ⇒ 别处卡也不再有【加入】），且换一套配色（徽标 / 黄边 / 淡黄叠加）
    'joinedCard.hiredOnlyClaim', 'joinedCard.noCardMixesJoinAndClaim', 'joinedCard.noOtherJoinButtonsWhenHired',
    'joinedCard.joinedFlag', 'joinedCard.plainFlag', 'joinedCard.joinedBadgeText', 'joinedCard.plainNoBadge',
    'joinedCard.badgeCount1', 'joinedCard.borderDiffers', 'joinedCard.borderIsAccent',
    'joinedCard.tintDiffers', 'joinedCard.plainTintNone',
    // 倒计时：未到点置灰 + 倒计时、到点自动可点、成功到账（batt + 次币）、刷新拿服务端新时间重新置灰
    'countdown.gatedWithCountdown', 'countdown.zeroWriteWhileGated', 'countdown.autoEnabledAtDueTime',
    'countdown.claimOkWithBothCurrencies', 'countdown.regatedByServerNextAt',
    'countdown.claimPostCount1', 'countdown.listRefetchedAfterClaim',
    'claimOk.postCount1', 'claimOk.toastOk', 'claimOk.toastHasBatt', 'claimOk.toastHasCurrency',
    'claimOk.cardNoOkNotice', 'claimOk.claimModalGone',
    'claimOk.cardRefreshedAndGated', 'claimOk.listRefetched',
    'claimFail.noticeErr', 'claimFail.noticeIsReason', 'claimFail.noWhiteScreen',
    'geometry.zeroOverflow390', 'geometry.zeroOverflow1536', 'geometry.cards390',
    'geometry.touchTarget44On390', 'geometry.zeroPageErrors', 'geometry.checkin390', 'geometry.checkin1536',
    'geometry.joinedDistinct390', 'geometry.joinedBadge390',
    'geometry.joinedDistinct1536', 'geometry.joinedBadge1536',
    // ⑤ 客态公开浏览臂（未登录也渲染列表 + 写口需登录；三键缺省不得读成 hired）
    'guest.cardsVisible', 'guest.listRendered', 'guest.bannerWithList', 'guest.titleVisible',
    'guest.wageVisible', 'guest.currencyExtraVisible', 'guest.joinEnabled',
    'guest.noClaimButtons', 'guest.allCardsJoinOnly', 'guest.noJoinedFlag', 'guest.rolesAnonymous',
    'guest.joinClickLoginPrompt', 'guest.joinClickLoginPrompt101', 'guest.zeroWriteRequests',
    'guest.cardsStableAfterClicks', 'guest.zeroOverflowGuest',
    'guest.zeroOverflow390', 'guest.cards390', 'guest.touchTarget44On390', 'guest.bannerAndList390',
    // ⑥ 项目卡【零编辑】（Kevin 2026-10-21②：编辑移入项目页 ⇒ 本页零钮 / 零 PATCH / 零 /api/user；
    //    判据数不减：34 条 = 旧 ⑥ 三臂 + ⑦ 四选一臂之和，逐条正向化）
    'zeroEditOwner.zeroEditButtonsAnywhere', 'zeroEditOwner.ownerCardNoEdit', 'zeroEditOwner.othersNoEdit',
    'zeroEditOwner.zeroEditFormRoots', 'zeroEditOwner.zeroEditFieldContainers', 'zeroEditOwner.zeroEditHints',
    'zeroEditOwner.zeroUserFetches', 'zeroEditOwner.zeroPatches', 'zeroEditOwner.cardLinkIntact',
    'zeroEditViewports.zeroEditButtons1536', 'zeroEditViewports.zeroEditForms1536',
    'zeroEditViewports.zeroEditFields1536', 'zeroEditViewports.zeroPatches1536',
    'zeroEditViewports.zeroEditButtons390', 'zeroEditViewports.zeroEditForms390',
    'zeroEditViewports.zeroEditFields390', 'zeroEditViewports.zeroOverflow390NoEditForm',
    'zeroEditAdmin.adminPayloadApplied', 'zeroEditAdmin.zeroEditOnAllCards',
    'zeroEditAdmin.hiredCardNoEdit', 'zeroEditAdmin.closedCardNoEdit',
    'zeroEditAdmin.zeroUserFetches', 'zeroEditAdmin.zeroPatches',
    'zeroEditUser.noEditButtonsAnywhere', 'zeroEditUser.zeroUserFetches', 'zeroEditUser.zeroPatchRequests',
    // ⑤' 历史注册天数（0 / 90 行）⇒ 旧四选一控件 / 提示行不得在本页回归
    'zeroEditFields.noMinDaysSelect', 'zeroEditFields.noOption365InPage', 'zeroEditFields.noMinDaysHint',
    'zeroEditFields.noEditFieldContainers', 'zeroEditFields.noSaveControl',
    'zeroEditFields.legacyRowsVisible', 'zeroEditFields.zeroPatches', 'zeroEditFields.zeroUserFetches',
    // ⑦ 卡头头像（Kevin 2026-10-22）：40px 圆形 / 有 url 渲图、无则首字彩底 /
    //   档位由名字决定且两档稳定 / 与标题同行居中 / 标题 ellipsis / 两档零溢出零 pageerror
    'avatar.avatarOnEveryCard', 'avatar.avatarSize40Both', 'avatar.avatarCircleBoth', 'avatar.avatarClipBoth',
    'avatar.avatarTwoForms', 'avatar.avatarImgArm', 'avatar.avatarInitialArm', 'avatar.avatarToneInRange',
    'avatar.avatarToneStable', 'avatar.avatarSameRowBoth', 'avatar.avatarTitleEllipsisBoth',
    'avatar.avatarTitleSingleLine', 'avatar.avatarInsideCardBoth',
    'avatar.avatarZeroOverflow390', 'avatar.avatarZeroOverflow1536', 'avatar.avatarCardCountBoth',
    'avatar.zeroPageErrors',
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
