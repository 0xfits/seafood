/**
 * 项目页 `/:slug` 前端探针（Kevin 2026-10-21 · 步 2：嵌套列表 + 三入口表单）
 *
 * 判据（逐条对齐派单验证项）：
 *   ① `/wage` 卡 href：行有合法 slug ⇒ 整卡是 `<a>` 且 href 含 `/sui`（历史行无 slug ⇒ 仍 `<article>`）；
 *   ② `/sui` 渲染项目头 + 详细介绍 + **三级嵌套**（campaign → task → subtask，数量 / 状态 / 类型徽标）；
 *   ③ 入口布局（Kevin 2026-10-21 追加）：顶部操作区**只剩【发布活动】**；【发布任务】在每张活动卡头、
 *      【发布子任务】在每张任务卡头（owner 可见；普通用户三处零入口零表单；无活动/无任务 ⇒ 入口缺席）；
 *   ④ 三表单提交载荷**逐键对拍**（含「立即上线」二次 PATCH、次币成对、subtasks 整组追加不丢旧行）；
 *   ④' 下沉表单**预选锁定**：卡内表单就地渲染、不渲染选择器，锁的 ref = 被点那张卡（campaignId/taskId 对拍，
 *      多活动臂另验「点第 2 张卡 ⇒ 锁 501≠502」）；
 *   ⑤ 保留段 `/wage` 不被 `:slug` 吞（项目页 hook 零出现、wage 页 hook 在场、零项目读口）；
 *   ⑥ 390 / 1536 两档零溢出（scrollWidth - clientWidth = 0）+ 零 pageerror。
 *   ⑦ 【编辑项目】模态框（Kevin 2026-10-21②：编辑自 /wage 卡移入本页，入口 = 操作区第 1 枚）：
 *      显隐（owner 有 / 普通用户与 ended 无）、开合（背板 / ✕ / Esc 三路关闭**零 PATCH 零重拉**）、
 *      背景滚动锁定、字段预填（含次币成对 + 注册天数四选一预选）、**载荷只带变化字段**、
 *      成功 ⇒ 关框 + 页内提示 + 重拉拿新标题、400 `SLUG_TAKEN` / 409 `project_headcount_below_hired`
 *      **框内内联且框不关**、非四档（90）⇒ 预选一天 + 提示行且保存载荷收敛为 1；
 *      两档几何（390 面板全宽不出界 / 1536 居中且面板宽 ≤640）。
 *
 * 手法（同 ops/wage/front probe 体例）：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node ops/project-page/probe-project-page.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/project-page/readings/probe-project-page.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const OWNER_UID = '970213'
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString()

// ---- 夹具（探针内内存；形状 = `GET /api/project/:ref` 与 `/api/project/all` 契约行） ----------
const wageRow = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单，按批结算。',
  headcount: 3,
  hired_count: 1,
  recruit_min_account_days: 1,
  wage_batt_per_claim: 30,
  wage_cid: null,
  wage_currency_amount: 0,
  wage_interval_hours: 4,
  status: 'recruiting',
  my_role: 'none',
  owner_uid: OWNER_UID,
  ...patch,
})

const projectView = () => ({
  ...wageRow(),
  owner_uid: OWNER_UID,
  // ★ 模态框臂（2026-10-21②）：次币对（cid 4 + 50）验「预填成对」；注册天数取四档值 7
  //   验「预选一周、无提示行」（非四档 90 的提示臂在 modal 段的 legacy 子臂里临时改）。
  wage_cid: 4,
  wage_currency_amount: 50,
  recruit_min_account_days: 7,
  campaigns: [
    {
      campaign_id: 501,
      snowflake_id: '7501',
      project_id: '11',
      title: '秋季招募',
      description: '打包旺季，冲量奖励。',
      status: 'active',
      time_start: iso(-3),
      time_end: iso(20),
      tasks: [
        {
          task_id: 555,
          campaign_id: '501',
          title: '转发推文',
          description: '转发并截图发回。',
          status: 'active',
          sort: 1,
          time_start: null,
          time_end: null,
          reward_amount_primary: '5',
          reward_cid_secondary: null,
          reward_amount_secondary: null,
          subtasks: [
            { subtask_id: 901, type_code: 'x_verify', title: '转发主帖', content: '附截图', payload: { links: ['https://x.com/a'] }, sort: 1, required: true },
            { subtask_id: 902, type_code: 'survey', title: '填写问卷', content: '', payload: { answers: { q1: 'a' } }, sort: 2, required: false },
          ],
        },
        {
          task_id: 556,
          campaign_id: '501',
          title: '打包冲量',
          description: '日打包 30 单。',
          status: 'draft',
          sort: 2,
          time_start: null,
          time_end: null,
          reward_amount_primary: '8',
          reward_cid_secondary: '4',
          reward_amount_secondary: '10',
          subtasks: [],
        },
      ],
    },
  ],
})

// 多活动臂用夹具：第 2 张活动卡（无 snowflake ⇒ ref 回落 campaign_id；task_id 全局唯一 ⇒ 用 557，
// 绝不复用 501 下的 556——复用会让「板卡内一枚入口」的读数被「同一 id 两张卡」污染）
const secondCampaign = () => ({
  campaign_id: 502,
  project_id: '11',
  title: '冬季招募',
  description: '冬季打包高峰。',
  status: 'draft',
  time_start: null,
  time_end: null,
  tasks: [
    {
      task_id: 557,
      campaign_id: '502',
      title: '冷库复核',
      description: '复核冷库批次。',
      status: 'draft',
      sort: 1,
      time_start: null,
      time_end: null,
      reward_amount_primary: '8',
      reward_cid_secondary: null,
      reward_amount_secondary: null,
      subtasks: [],
    },
  ],
})

const STATE = {
  view: projectView(),
  userPayload: { uID: Number(OWNER_UID) },
  wageRows: [wageRow(), wageRow({ project_id: 12, snowflake_id: '70012', slug: null, title: '冷库分拣' })],
  calls: [],
  bodies: { campaign: [], campaignPatch: [], task: [], subtaskPatch: [], projectPatch: [] },
  // 项目编辑写口（`PATCH /api/project/:id`）响应模式：ok（合并进视图）/ slug（400 SLUG_TAKEN）/
  // headcount（409 缩容低于在职）——逐臂切换，验「框内内联且框不关」。
  patchMode: 'ok',
}

const ok = (data) => ({ success: true, data })
// 非 2xx 响应：带 `__status` 标记 ⇒ attachRoutes 按真状态码下发（页面侧 fetchApiJson 才会按
// 「非 ok / success:false」抛错，`error.details.reason` 得以走上字段级内联链路）。
const fail = (status, code, details) => ({
  __status: status,
  body: { success: false, error: { code, details } },
})

const apiResponse = (method, pathname, rawBody) => {
  const body = (() => {
    try { return rawBody ? JSON.parse(rawBody) : null } catch { return null }
  })()
  if (pathname === '/api/user') { STATE.calls.push({ method, path: pathname }); return ok(STATE.userPayload) }
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }])
  if (pathname === '/api/project/all') { STATE.calls.push({ method, path: pathname }); return ok(STATE.wageRows) }
  if (pathname === '/api/project/sui') { STATE.calls.push({ method, path: pathname }); return ok(STATE.view) }
  if (pathname === '/api/batt') return ok({ batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true, bttc: { balance: '0', status: 'listed', canMint: false, canBurn: false, usdBalance: '0', policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1 } } })
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })

  if (pathname === '/api/campaign' && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.campaign.push(body)
    return ok({ campaign_id: 601, snowflake_id: '7601', title: body?.title ?? '', description: body?.description ?? '', status: 'draft', tasks: [] })
  }
  const patchCampaign = pathname.match(/^\/api\/campaign\/(\d+)$/)
  if (patchCampaign && method === 'PATCH') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.campaignPatch.push({ ref: patchCampaign[1], body })
    return ok({ campaign_id: Number(patchCampaign[1]), status: body?.status ?? 'draft', tasks: [] })
  }
  const createTask = pathname.match(/^\/api\/campaign\/(\d+)\/task$/)
  if (createTask && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.task.push({ ref: createTask[1], body })
    return ok({ task_id: 557, campaign_id: createTask[1], title: body?.title ?? '', subtasks: [] })
  }
  const patchTask = pathname.match(/^\/api\/campaign\/task\/(\d+)$/)
  if (patchTask && method === 'PATCH') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.subtaskPatch.push({ ref: patchTask[1], body })
    // 服务端行为模拟（**永不 DELETE**）：带 id ⇒ 覆盖同 id 行；不带 id ⇒ 追加新行
    const taskId = patchTask[1]
    for (const campaign of STATE.view.campaigns) {
      const task = (campaign.tasks || []).find((row) => String(row.task_id) === taskId)
      if (!task) continue
      const next = Array.isArray(task.subtasks) ? [...task.subtasks] : []
      for (const item of Array.isArray(body?.subtasks) ? body.subtasks : []) {
        if (item.subtask_id) {
          const at = next.findIndex((row) => String(row.subtask_id) === String(item.subtask_id))
          if (at >= 0) next[at] = { ...next[at], ...item }
        } else {
          next.push({ ...item, subtask_id: 999 + next.length })
        }
      }
      task.subtasks = next
    }
    return ok({ task_id: Number(taskId), subtasks: [] })
  }

  // 项目编辑写口（Kevin 2026-10-21②）：只认项目主键 `PATCH /api/project/<id>`；
  // 载荷留痕（验「只带变化字段」），成功则合并进视图 ⇒ 保存后的重拉读到新值。
  const patchProject = pathname.match(/^\/api\/project\/(\d+)$/)
  if (patchProject && method === 'PATCH') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.projectPatch.push({ ref: patchProject[1], body })
    if (STATE.patchMode === 'slug') return fail(400, 'SLUG_TAKEN', { reason: 'SLUG_TAKEN', field: 'slug' })
    if (STATE.patchMode === 'headcount') {
      return fail(409, 'PROJECT_HEADCOUNT_BELOW_HIRED', {
        reason: 'project_headcount_below_hired', headcount: body?.headcount, hired_count: STATE.view.hired_count,
      })
    }
    STATE.view = { ...STATE.view, ...(body || {}) }
    return ok({ ...STATE.view })
  }
  // 未知项目 slug（如已删页 `/activities` 落到 `:slug`）⇒ 读口按真契约 404
  // （旧通用 GET 兜底返回 `{rows:[]}` 会让项目页把「不存在的项目」渲染成空项目页）。
  if (method === 'GET' && /^\/api\/project\/[^/]+$/.test(pathname)) {
    STATE.calls.push({ method, path: pathname })
    return fail(404, 'PROJECT_NOT_FOUND', { reason: 'project_not_found' })
  }
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数 ---------------------------------------------------------------------------------
const SNAP_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const card = q('[data-sf-m="wage-card"]')
  const proj = q('[data-sf-m="project-page"]')
  return {
    pathname: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    wage: {
      pagePresent: !!q('[data-sf-m="wage-page"]'),
      cards: qa('[data-sf-m="wage-card"]').length,
      firstTag: card ? card.tagName : null,
      firstHref: card ? card.getAttribute('href') : null,
      secondTag: qa('[data-sf-m="wage-card"]')[1] ? qa('[data-sf-m="wage-card"]')[1].tagName : null,
      secondHref: qa('[data-sf-m="wage-card"]')[1] ? qa('[data-sf-m="wage-card"]')[1].getAttribute('href') : null,
    },
    project: {
      present: !!proj,
      slug: proj ? proj.getAttribute('data-sf-slug') : null,
      title: txt(q('[data-sf-m="project-title"]')),
      status: txt(q('[data-sf-m="project-status"]')),
      desc: txt(q('[data-sf-m="project-desc-text"]')),
      campaigns: qa('[data-sf-m="project-campaign"]').length,
      campaignTitles: qa('[data-sf-m="project-campaign-link"]').map((el) => txt(el)),
      campaignHrefs: qa('[data-sf-m="project-campaign-link"]').map((el) => el.getAttribute('href')),
      campaignStates: qa('[data-sf-m="project-campaign-status"]').map((el) => el.getAttribute('data-sf-state')),
      campaignTaskCounts: qa('[data-sf-m="project-campaign-tasks"]').map((el) => txt(el)),
      tasks: qa('[data-sf-m="project-task"]').length,
      taskTitles: qa('[data-sf-m="project-task-title"]').map((el) => txt(el)),
      taskRewards: qa('[data-sf-m="project-task-reward"]').map((el) => el.getAttribute('data-sf-amount')),
      subtasks: qa('[data-sf-m="project-subtask"]').length,
      subtaskTitles: qa('[data-sf-m="project-subtask-title"]').map((el) => txt(el)),
      subtaskTypes: qa('[data-sf-m="project-subtask-type"]').map((el) => el.getAttribute('data-sf-type') || txt(el)),
      subtaskRequired: qa('[data-sf-m="project-subtask-required"]').map((el) => el.getAttribute('data-sf-required')),
      subtasksEmpty: qa('[data-sf-m="project-subtasks-empty"]').length,
      notFound: qa('[data-sf-m="not-found-page"]').length,
      loading: qa('[data-sf-m="project-loading"]').length,
      error: qa('[data-sf-m="project-error"]').length,
      right: proj ? Math.round(proj.getBoundingClientRect().right * 10) / 10 : null,
    },
    manage: {
      present: !!q('[data-sf-m="project-manage"]'),
      // 顶部操作区入口（Kevin 2026-10-21②：2 枚 = 【编辑项目】+【发布活动】；
      // 卡片内入口用下面两组独立读数）
      entries: qa('[data-sf-m="project-manage"] [data-sf-m^="project-entry-"]').length,
      entryTexts: qa('[data-sf-m="project-manage"] [data-sf-m^="project-entry-"]').map((el) => txt(el)),
      // 卡片内入口：活动卡【发布任务】（ref 列表）/ 任务卡【发布子任务】（task 列表）
      cardTaskEntries: qa('[data-sf-m="project-campaign-entry-task"]').map((el) => el.getAttribute('data-sf-ref')),
      cardSubtaskEntries: qa('[data-sf-m="project-task-entry-subtask"]').map((el) => el.getAttribute('data-sf-task')),
      // 入口是否在所属卡头内（而不是漂在列表外）
      taskEntryInCampaignHead: qa('[data-sf-m="project-campaign"] > .sf-project-campaign-head [data-sf-m="project-campaign-entry-task"]').length,
      subtaskEntryInTaskHead: qa('[data-sf-m="project-task"] > .sf-project-task-head [data-sf-m="project-task-entry-subtask"]').length,
      // 归属读数（closest/contains 判定）：入口是否真在**自己**那张卡的卡头里，且每张卡恰一枚
      cards: {
        campaignOwnHead: qa('[data-sf-m="project-campaign-entry-task"]').filter((el) => {
          const card = el.closest('[data-sf-m="project-campaign"]')
          const head = card ? card.querySelector(':scope > .sf-project-campaign-head') : null
          return Boolean(head) && head.contains(el)
        }).length,
        subtaskOwnHead: qa('[data-sf-m="project-task-entry-subtask"]').filter((el) => {
          const card = el.closest('[data-sf-m="project-task"]')
          const head = card ? card.querySelector(':scope > .sf-project-task-head') : null
          return Boolean(head) && head.contains(el)
        }).length,
        campaignCardsExactlyOne: qa('[data-sf-m="project-campaign"]').filter((el) => (
          el.querySelectorAll(':scope > .sf-project-campaign-head [data-sf-m="project-campaign-entry-task"]').length === 1
        )).length,
        taskCardsExactlyOne: qa('[data-sf-m="project-task"]').filter((el) => (
          el.querySelectorAll(':scope > .sf-project-task-head [data-sf-m="project-task-entry-subtask"]').length === 1
        )).length,
      },
      // 下沉表单的锁定读数 + 选择器缺席读数
      locked: {
        campaign: (() => { const el = q('[data-sf-m="project-form-campaign-locked"]'); return el ? el.getAttribute('data-sf-ref') : null })(),
        task: (() => {
          const el = q('[data-sf-m="project-form-task-locked"]')
          return el ? { campaign: el.getAttribute('data-sf-campaign'), task: el.getAttribute('data-sf-ref') } : null
        })(),
        campaignText: txt(q('[data-sf-m="project-form-campaign-locked"]')),
        taskText: txt(q('[data-sf-m="project-form-task-locked"]')),
      },
      selects: {
        campaign: qa('[data-sf-field="campaign"]').length,
        task: qa('[data-sf-field="task"]').length,
      },
      formsInManage: qa('[data-sf-m="project-manage"] [data-sf-m^="project-form-"]').length,
      taskFormInCard: qa('[data-sf-m="project-campaign"] [data-sf-m="project-form-task"]').length,
      subtaskFormInTask: qa('[data-sf-m="project-task"] [data-sf-m="project-form-subtask"]').length,
      forms: {
        campaign: qa('[data-sf-m="project-form-campaign"]').length,
        task: qa('[data-sf-m="project-form-task"]').length,
        subtask: qa('[data-sf-m="project-form-subtask"]').length,
      },
      notice: (() => {
        const n = q('[data-sf-m="project-manage"] > [data-sf-m="project-form-notice"]') || q('[data-sf-m="project-form-notice"]')
        return n ? { kind: n.getAttribute('data-sf-kind'), text: txt(n) } : null
      })(),
      needCampaign: qa('[data-sf-m="project-form-need-campaign"]').length,
      rows: qa('[data-sf-m="project-row"]').length,
      inputs: qa('.sf-project-input').length,
      inputMaxRight: Math.max(0, ...qa('.sf-project-input').map((el) => el.getBoundingClientRect().right)),
      submitDisabled: (() => { const b = q('[data-sf-m="project-form-submit"]'); return b ? !!b.disabled : null })(),
    },
    // 【编辑项目】模态框读数（Kevin 2026-10-21②）：portal 到 body ⇒ 必须从 document 直接取
    // （不在 [data-sf-m="project-page"] 子树里——portal 到 body）。
    modal: (() => {
      const m = q('[data-sf-m="project-edit"]')
      const panel = q('[data-sf-m="project-edit-panel"]')
      const val = (sel) => { const el = q(sel); return el ? el.value : null }
      const pr = panel ? panel.getBoundingClientRect() : null
      const errs = {}
      for (const el of qa('[data-sf-edit-err]')) errs[el.getAttribute('data-sf-edit-err')] = txt(el)
      return {
        present: !!m,
        panelPresent: !!panel,
        role: panel ? panel.getAttribute('role') : null,
        ariaModal: panel ? panel.getAttribute('aria-modal') : null,
        title: txt(q('[data-sf-m="project-edit-title"]')),
        width: pr ? Math.round(pr.width * 10) / 10 : null,
        left: pr ? Math.round(pr.left * 10) / 10 : null,
        right: pr ? Math.round(pr.right * 10) / 10 : null,
        bodyOverflow: document.body.style.overflow,
        entrancePresent: !!q('[data-sf-m="project-entry-edit"]'),
        entranceText: txt(q('[data-sf-m="project-entry-edit"]')),
        saveText: txt(q('[data-sf-m="project-edit-save"]')),
        closePresent: !!q('[data-sf-m="project-edit-close"]'),
        backdropPresent: !!q('[data-sf-m="project-edit-backdrop"]'),
        fields: {
          title: val('[data-sf-edit="title"]'),
          description: val('[data-sf-edit="description"]'),
          slug: val('[data-sf-edit="slug"]'),
          headcount: val('[data-sf-edit="headcount"]'),
          minDays: val('[data-sf-edit="minDays"]'),
          minDaysTag: (() => { const el = q('[data-sf-edit="minDays"]'); return el ? el.tagName : null })(),
          minDaysValues: qa('[data-sf-edit="minDays"] option').map((o) => o.value),
          minDaysHint: txt(q('[data-sf-edit-hint="minDays"]')),
          batt: val('[data-sf-edit="batt"]'),
          interval: val('[data-sf-edit="interval"]'),
          cid: val('[data-sf-edit="cid"]'),
          amount: val('[data-sf-edit="amount"]'),
          amountDisabled: (() => { const el = q('[data-sf-edit="amount"]'); return el ? !!el.disabled : null })(),
          status: val('[data-sf-edit="status"]'),
        },
        errs,
      }
    })(),
    apiCalls: [],
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
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

const keysOf = (obj) => Object.keys(obj || {}).sort()

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

  const out = {
    probe: 'ops/project-page/probe-project-page.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { campaigns: 1, tasks: 2, subtasks: 2, auth: 'localStorage seed only', api: 'context.route in-probe JSON（零后端 / 零库写）' },
    states: {}, assertions: {}, pageErrors,
  }

  const open = async (url, waitSel) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    if (waitSel) await page.waitForSelector(waitSel, { timeout: 8000 }).catch(() => {})
    await settle(page)
    return page.evaluate(SNAP_FN)
  }

  // ============================ ① /wage 卡 href（slug 链接） ============================
  STATE.calls.length = 0
  const wageSnap = await open('/wage', '[data-sf-m="wage-card"]')
  out.states['1536_wage'] = wageSnap.wage
  out.assertions.wageCard = {
    cardsRendered: wageSnap.wage.cards === 2,
    slugCardIsLink: wageSnap.wage.firstTag === 'A',
    slugHrefIsProjectPage: String(wageSnap.wage.firstHref || '').endsWith('/sui'),
    legacyRowStaysArticle: wageSnap.wage.secondTag === 'ARTICLE' && wageSnap.wage.secondHref === null,
  }

  // ============================ ⑤ 保留段 /wage 不被 :slug 吞 ============================
  out.assertions.reserved = {
    wagePageRendered: wageSnap.wage.pagePresent === true,
    noProjectPageHook: wageSnap.project.present === false,
    noProjectReadForWage: !STATE.calls.some((c) => c.path === '/api/project/wage'),
    noNotFound: wageSnap.project.notFound === 0,
  }

  // ============================ ② /sui 项目头 + 介绍 + 三级嵌套 ============================
  STATE.calls.length = 0
  const projSnap = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_project'] = projSnap.project
  out.assertions.projectPage = {
    headRendered: Boolean(projSnap.project.title) && projSnap.project.status !== null,
    descRendered: projSnap.project.desc === '每天打包 20 单，按批结算。',
    readPath: STATE.calls.some((c) => c.path === '/api/project/sui'),
    campaigns1: projSnap.project.campaigns === 1,
    campaignTitleLinked: String(projSnap.project.campaignHrefs[0] || '').endsWith('/campaign/501'),
    campaignState: projSnap.project.campaignStates[0] === 'active',
    tasks2: projSnap.project.tasks === 2,
    taskTitles: JSON.stringify(projSnap.project.taskTitles) === JSON.stringify(['转发推文', '打包冲量']),
    taskRewards: JSON.stringify(projSnap.project.taskRewards) === JSON.stringify(['5', '8']),
    subtasks2: projSnap.project.subtasks === 2,
    // 徽标文案 = 四语文案（禁直出 `x_verify` 这类 code）：zh 表逐字对拍
    subtaskTypes5: JSON.stringify(projSnap.project.subtaskTypes)
      === JSON.stringify([ZH.campaign.type.x_verify, ZH.campaign.type.survey]),
    subtaskCodesNotLeaked: !projSnap.project.subtaskTypes.some((text) => /^(x_verify|onchain_snapshot|survey|prediction|quiz)$/.test(String(text))),
    requiredFlags: JSON.stringify(projSnap.project.subtaskRequired) === JSON.stringify(['1', '0']),
  }

  // ============================ ③ 入口显隐（owner 臂） ============================
  out.assertions.entryOwner = {
    managePresent: projSnap.manage.present === true,
    // 顶部 2 枚【编辑项目】+【发布活动】（2026-10-21② 注入编辑入口；任务/子任务入口仍下沉卡片）
    topTwoEntries: projSnap.manage.entries === 2,
    editEntryFirst: JSON.stringify(projSnap.manage.entryTexts)
      === JSON.stringify([ZH.wage.editTitle, ZH.project.entryCampaign]),
    topEntryIsCampaign: projSnap.manage.entryTexts[1] === ZH.project.entryCampaign,
    noTopTaskEntry: !projSnap.manage.entryTexts.includes(ZH.project.entryTask),
    noTopSubtaskEntry: !projSnap.manage.entryTexts.includes(ZH.project.entrySubtask),
    oneTaskEntryPerCampaign: JSON.stringify(projSnap.manage.cardTaskEntries) === JSON.stringify(['501']),
    // 每张任务卡恰一枚（含「无子任务」的 556——入口按卡渲染，不按已有子任务行数）
    oneSubtaskEntryPerTask: JSON.stringify(projSnap.manage.cardSubtaskEntries) === JSON.stringify(['555', '556']),
    taskEntryInCampaignHead: projSnap.manage.taskEntryInCampaignHead === 1,
    subtaskEntryInTaskHead: projSnap.manage.subtaskEntryInTaskHead === 2
      && projSnap.manage.subtaskEntryInTaskHead === projSnap.project.tasks,
    // 归属：入口在**自己**卡片的卡头里（closest 判定），且每卡恰一枚（不是 0 枚 / 不是 2 枚）
    everyCampaignCardOwnsOneEntry: projSnap.manage.cards.campaignOwnHead === 1
      && projSnap.manage.cards.campaignCardsExactlyOne === 1,
    everyTaskCardOwnsOneEntry: projSnap.manage.cards.subtaskOwnHead === 2
      && projSnap.manage.cards.taskCardsExactlyOne === 2,
    formsClosedByDefault: projSnap.manage.forms.campaign === 0 && projSnap.manage.forms.task === 0 && projSnap.manage.forms.subtask === 0,
  }

  // ============================ ④-a 发布 campaign（草稿臂） ============================
  await page.click('[data-sf-m="project-entry-campaign"]')
  await settle(page)
  const campaignFormSnap = await page.evaluate(SNAP_FN)
  await page.fill('[data-sf-m="project-form-campaign"] [data-sf-field="title"]', '冬季招募')
  await page.fill('[data-sf-m="project-form-campaign"] [data-sf-field="description"]', '冬季打包高峰。')
  await page.fill('[data-sf-m="project-form-campaign"] [data-sf-field="timeStart"]', '2026-12-01T10:00')
  await page.fill('[data-sf-m="project-form-campaign"] [data-sf-field="timeEnd"]', '2026-12-31T10:00')
  STATE.bodies.campaign.length = 0
  STATE.bodies.campaignPatch.length = 0
  await page.click('[data-sf-m="project-form-campaign"] [data-sf-m="project-form-submit"]')
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-sf-m="project-manage"] > [data-sf-m="project-form-notice"]')
    return !!n
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const afterDraft = await page.evaluate(SNAP_FN)
  const draftBody = STATE.bodies.campaign[0] || {}
  out.states['1536_form_campaign_draft'] = {
    form: campaignFormSnap.manage.forms,
    body: draftBody,
    keys: keysOf(draftBody),
    patches: JSON.parse(JSON.stringify(STATE.bodies.campaignPatch)),
    notice: afterDraft.manage.notice,
  }
  out.assertions.campaignDraft = {
    formOpened: campaignFormSnap.manage.forms.campaign === 1,
    postOnce: STATE.bodies.campaign.length === 1,
    keysExactlyClosedSet: JSON.stringify(keysOf(draftBody)) === JSON.stringify(['description', 'project_id', 'time_end', 'time_start', 'title']),
    projectIdFromPage: draftBody.project_id === '11',
    titleAndDesc: draftBody.title === '冬季招募' && draftBody.description === '冬季打包高峰。',
    timesIso: /^\d{4}-\d{2}-\d{2}T.*Z$/.test(String(draftBody.time_start)) && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(String(draftBody.time_end)),
    noStatusKey: !Object.prototype.hasOwnProperty.call(draftBody, 'status'),
    noRewardKeys: !Object.prototype.hasOwnProperty.call(draftBody, 'reward_amount_primary'),
    noLaunchPatch: STATE.bodies.campaignPatch.length === 0,
    noticeOk: Boolean(afterDraft.manage.notice && afterDraft.manage.notice.kind === 'ok'),
    relisted: STATE.calls.filter((c) => c.path === '/api/project/sui').length >= 2,
  }

  // ============================ ④-b 发布 campaign（立即上线臂） ============================
  await page.click('[data-sf-m="project-entry-campaign"]')
  await settle(page)
  await page.fill('[data-sf-m="project-form-campaign"] [data-sf-field="title"]', '冬季招募·上线')
  await page.click('[data-sf-m="project-form-campaign"] [data-sf-field="launch"]')
  STATE.bodies.campaign.length = 0
  STATE.bodies.campaignPatch.length = 0
  await page.click('[data-sf-m="project-form-campaign"] [data-sf-m="project-form-submit"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-m="project-manage"] > [data-sf-m="project-form-notice"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const afterLaunch = await page.evaluate(SNAP_FN)
  out.states['1536_form_campaign_launch'] = {
    post: STATE.bodies.campaign[0] || null,
    patch: JSON.parse(JSON.stringify(STATE.bodies.campaignPatch)),
    notice: afterLaunch.manage.notice,
  }
  out.assertions.campaignLaunch = {
    postOnce: STATE.bodies.campaign.length === 1,
    patchOnce: STATE.bodies.campaignPatch.length === 1,
    patchRefIsCreated: STATE.bodies.campaignPatch[0]?.ref === '601',
    patchBodyOnlyStatus: JSON.stringify(STATE.bodies.campaignPatch[0]?.body) === JSON.stringify({ status: 'active' }),
    noticeOk: Boolean(afterLaunch.manage.notice && afterLaunch.manage.notice.kind === 'ok'),
  }

  // ============================ ④-c 发布任务（入口在活动卡内；锁 501；次币成对 + 一行子任务） ==========
  await page.click('[data-sf-m="project-campaign-entry-task"][data-sf-ref="501"]')
  await settle(page)
  const taskFormSnap = await page.evaluate(SNAP_FN)
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="title"]', '打包冲量')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="description"]', '日打包 30 单。')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="reward"]', '8')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="sort"]', '2')
  await page.selectOption('[data-sf-m="project-form-task"] [data-sf-field="cid"]', '4')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="amount"]', '10')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-row="0"] [data-sf-field="title"]', '提交截图')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-row="0"] [data-sf-field="content"]', '三张截图')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-row="0"] [data-sf-field="sort"]', '1')
  STATE.bodies.task.length = 0
  await page.click('[data-sf-m="project-form-task"] [data-sf-m="project-form-submit"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-m="project-manage"] > [data-sf-m="project-form-notice"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const taskCall = STATE.bodies.task[0] || {}
  const taskBody = taskCall.body || {}
  const taskSub = Array.isArray(taskBody.subtasks) ? taskBody.subtasks[0] : null
  out.states['1536_form_task'] = {
    formOpened: taskFormSnap.manage.forms,
    ref: taskCall.ref,
    body: taskBody,
    keys: keysOf(taskBody),
    subtask: taskSub,
    subtaskKeys: keysOf(taskSub),
  }
  out.assertions.taskForm = {
    formOpened: taskFormSnap.manage.forms.task === 1,
    // 下沉形态：表单就地在该活动卡内、顶部操作区里没有表单
    formInsideCampaignCard: taskFormSnap.manage.taskFormInCard === 1,
    noFormInManage: taskFormSnap.manage.formsInManage === 0,
    // 预选锁定：锁的是被点的活动 501，活动选择器不渲染
    lockedCampaignRef: taskFormSnap.manage.locked.campaign === '501',
    lockedCampaignText: String(taskFormSnap.manage.locked.campaignText || '').includes('秋季招募'),
    noCampaignSelector: taskFormSnap.manage.selects.campaign === 0,
    postOnce: STATE.bodies.task.length === 1,
    campaignRef: taskCall.ref === '501',
    keysExactlyClosedSet: JSON.stringify(keysOf(taskBody)) === JSON.stringify([
      'description', 'reward_amount_primary', 'reward_amount_secondary', 'reward_cid_secondary', 'sort', 'subtasks', 'time_end', 'time_start', 'title',
    ]),
    rewardPrimaryUsd: taskBody.reward_amount_primary === '8',
    secondaryPair: taskBody.reward_cid_secondary === '4' && taskBody.reward_amount_secondary === '10',
    oneSubtask: Array.isArray(taskBody.subtasks) && taskBody.subtasks.length === 1,
    subtaskKeysExactly: JSON.stringify(keysOf(taskSub)) === JSON.stringify(['content', 'payload', 'required', 'sort', 'title', 'type_code']),
    subtaskFields: Boolean(taskSub) && taskSub.type_code === 'x_verify' && taskSub.title === '提交截图' && taskSub.content === '三张截图' && taskSub.sort === 1 && taskSub.required === true,
    noStatusKey: !Object.prototype.hasOwnProperty.call(taskBody, 'status'),
  }

  // ============================ ④-d 发布子任务（整组追加，不丢旧行） ============================
  // 前置：把夹具行恢复成「任务 555 有 2 条旧子任务」的干净态（任务表单那臂不改 555）
  STATE.bodies.subtaskPatch.length = 0
  const beforePatch = STATE.view.campaigns[0].tasks[0].subtasks.length
  await page.click('[data-sf-m="project-task-entry-subtask"][data-sf-task="555"]')
  await settle(page)
  const subFormSnap = await page.evaluate(SNAP_FN)
  await page.selectOption('[data-sf-m="project-form-subtask"] [data-sf-field="type"]', 'quiz')
  await page.fill('[data-sf-m="project-form-subtask"] [data-sf-field="title"]', '答题复核')
  await page.fill('[data-sf-m="project-form-subtask"] [data-sf-field="content"]', '三道题')
  await page.fill('[data-sf-m="project-form-subtask"] [data-sf-field="sort"]', '3')
  const readsBefore = STATE.calls.filter((c) => c.path === '/api/project/sui').length
  await page.click('[data-sf-m="project-form-subtask"] [data-sf-m="project-form-submit"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-m="project-manage"] > [data-sf-m="project-form-notice"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const subCall = STATE.bodies.subtaskPatch[0] || {}
  const group = Array.isArray(subCall.body?.subtasks) ? subCall.body.subtasks : []
  const afterSub = await page.evaluate(SNAP_FN)
  const readsAfter = STATE.calls.filter((c) => c.path === '/api/project/sui').length
  out.states['1536_form_subtask'] = {
    formOpened: subFormSnap.manage.forms,
    ref: subCall.ref,
    group,
    groupIds: group.map((row) => row.subtask_id ?? null),
    reads: { before: readsBefore, after: readsAfter },
    subtasksRenderedAfter: afterSub.project.subtasks,
    notice: afterSub.manage.notice,
  }
  out.assertions.subtaskForm = {
    formOpened: subFormSnap.manage.forms.subtask === 1,
    // 下沉形态：表单就地在该任务卡内
    formInsideTaskCard: subFormSnap.manage.subtaskFormInTask === 1,
    // 双预选锁定：活动 501 + 任务 555，两个选择器都不渲染
    lockedCampaignRef: subFormSnap.manage.locked.task?.campaign === '501',
    lockedTaskRef: subFormSnap.manage.locked.task?.task === '555',
    lockedTextHasBoth: String(subFormSnap.manage.locked.taskText || '').includes('秋季招募')
      && String(subFormSnap.manage.locked.taskText || '').includes('转发推文'),
    noCampaignSelector: subFormSnap.manage.selects.campaign === 0,
    noTaskSelector: subFormSnap.manage.selects.task === 0,
    patchedOnce: STATE.bodies.subtaskPatch.length === 1,
    patchTaskRef: subCall.ref === '555',
    onlySubtasksKey: JSON.stringify(keysOf(subCall.body)) === JSON.stringify(['subtasks']),
    groupIsOldPlusOne: group.length === beforePatch + 1,
    oldRowsResentWithId: group.filter((row) => row.subtask_id).length === beforePatch,
    oldIdsPreserved: JSON.stringify(group.filter((row) => row.subtask_id).map((row) => String(row.subtask_id))) === JSON.stringify(['901', '902']),
    oldPayloadPreserved: JSON.stringify(group[0]?.payload) === JSON.stringify({ links: ['https://x.com/a'] }),
    newRowLast: group.length > 0 && !group[group.length - 1].subtask_id && group[group.length - 1].type_code === 'quiz' && group[group.length - 1].title === '答题复核',
    freshReadBeforePatch: readsAfter >= readsBefore + 1,
    listReRendered: afterSub.project.subtasks === beforePatch + 1,
    noticeOk: Boolean(afterSub.manage.notice && afterSub.manage.notice.kind === 'ok'),
  }

  // ============================ ④-e 多活动臂：每卡一枚 + 点哪张锁哪张（campaignId / taskId 对拍） =====
  STATE.view.campaigns.push(secondCampaign())
  STATE.bodies.task.length = 0
  const multiSnap = await open('/sui', '[data-sf-m="project-page"]')
  await page.click('[data-sf-m="project-campaign-list"] > [data-sf-m="project-campaign"]:nth-child(2) [data-sf-m="project-campaign-entry-task"]')
  await settle(page)
  const multiTaskSnap = await page.evaluate(SNAP_FN)
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="title"]', '冷库复核')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="reward"]', '8')
  await page.fill('[data-sf-m="project-form-task"] [data-sf-field="sort"]', '1')
  await page.click('[data-sf-m="project-form-task"] [data-sf-m="project-form-submit"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-m="project-manage"] > [data-sf-m="project-form-notice"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const multiTaskCall = STATE.bodies.task[0] || {}
  // 按「活动 502 卡内的任务 557」定位：选择器锚到活动卡，杜绝同 id 命中别张卡（读数串卡）
  await page.click('[data-sf-m="project-campaign"][data-sf-ref="502"] [data-sf-m="project-task"][data-sf-task="557"] [data-sf-m="project-task-entry-subtask"]')
  await settle(page)
  const multiSubSnap = await page.evaluate(SNAP_FN)
  await page.click('[data-sf-m="project-form-subtask"] [data-sf-m="project-form-cancel"]')
  await settle(page)
  STATE.view.campaigns.pop()
  out.states['1536_multi_campaign'] = {
    entries: multiSnap.manage.entryTexts,
    cardTaskEntries: multiSnap.manage.cardTaskEntries,
    cardSubtaskEntries: multiSnap.manage.cardSubtaskEntries,
    lockedTask: multiTaskSnap.manage.locked,
    lockedSubtask: multiSubSnap.manage.locked,
    postedRef: multiTaskCall.ref,
    selects: multiSubSnap.manage.selects,
    formsAfterSubtaskEntry: multiSubSnap.manage.forms,
    cards: multiSnap.manage.cards,
  }
  out.assertions.multiCampaign = {
    topStillTwoEntries: multiSnap.manage.entries === 2
      && multiSnap.manage.entryTexts[0] === ZH.wage.editTitle
      && multiSnap.manage.entryTexts[1] === ZH.project.entryCampaign,
    oneTaskEntryPerCard: JSON.stringify(multiSnap.manage.cardTaskEntries) === JSON.stringify(['501', '502']),
    // 3 张任务卡（501:555 / 501:556 / 502:557）各一枚，id 全局唯一 ⇒ 数组无重复
    oneSubtaskEntryPerTask: JSON.stringify(multiSnap.manage.cardSubtaskEntries) === JSON.stringify(['555', '556', '557']),
    everyCampaignCardOwnsOneEntry: multiSnap.manage.cards.campaignOwnHead === 2
      && multiSnap.manage.cards.campaignCardsExactlyOne === 2,
    everyTaskCardOwnsOneEntry: multiSnap.manage.cards.subtaskOwnHead === 3
      && multiSnap.manage.cards.taskCardsExactlyOne === 3
      && multiSnap.manage.subtaskEntryInTaskHead === 3,
    // 点第 2 张活动卡 ⇒ 锁第 2 张（501 不得串到 502 上）
    lockedSecondCampaign: multiTaskSnap.manage.locked.campaign === '502',
    lockedSecondCampaignText: String(multiTaskSnap.manage.locked.campaignText || '').includes('冬季招募'),
    formInSecondCard: multiTaskSnap.manage.taskFormInCard === 1,
    noCampaignSelector: multiTaskSnap.manage.selects.campaign === 0,
    postedToClickedCampaign: multiTaskCall.ref === '502',
    // 点第 2 张任务卡 ⇒ 锁 502 / 556
    subtaskLockedBoth: multiSubSnap.manage.locked.task?.campaign === '502' && multiSubSnap.manage.locked.task?.task === '557',
    // 只开一张：点 502 的任务入口后，全局恰 1 个子任务表单（不得两张卡各开一个）
    oneSubtaskFormOpen: multiSubSnap.manage.forms.subtask === 1,
    subtaskNoSelectors: multiSubSnap.manage.selects.campaign === 0 && multiSubSnap.manage.selects.task === 0,
    subtaskFormInTaskCard: multiSubSnap.manage.subtaskFormInTask === 1,
  }

  // ============================ ⑦ 【编辑项目】模态框（Kevin 2026-10-21②）============================
  // 口径（编辑自 /wage 卡移入本页）：入口 = 操作区第 1 枚；点开 = 模态（portal 到 body）；
  //   背板 / ✕ / Esc 三路关闭**零 PATCH 零重拉**；载荷只带变化字段；400/409 在框内内联且框不关；
  //   成功 ⇒ 关框 + 页内提示 + 重拉（标题即时更新）；非四档注册天数（90）⇒ 预选一天 + 提示行。
  STATE.patchMode = 'ok'
  STATE.view = projectView() // 复位（前面的臂改过 title / subtasks / 二活动）
  STATE.bodies.projectPatch.length = 0
  STATE.calls.length = 0

  const mClosed = await open('/sui', '[data-sf-m="project-page"]')
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  const mOpen = await page.evaluate(SNAP_FN)
  const readsBeforeEsc = STATE.calls.filter((c) => c.path === '/api/project/sui').length
  await page.keyboard.press('Escape')
  await settle(page)
  const mAfterEsc = await page.evaluate(SNAP_FN)
  const escPatches = STATE.bodies.projectPatch.length
  const readsAfterEsc = STATE.calls.filter((c) => c.path === '/api/project/sui').length

  // 背板：点视口左上角（面板居中/全宽但无 backdrop 覆盖之外的命中 ⇒ 5,5 必落在背板上）
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  const mBackdropOpen = await page.evaluate(SNAP_FN)
  await page.mouse.click(5, 5)
  await settle(page)
  const mAfterBackdrop = await page.evaluate(SNAP_FN)
  const backdropPatches = STATE.bodies.projectPatch.length

  // ✕（标题栏关闭钮）
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  const mXOpen = await page.evaluate(SNAP_FN)
  await page.click('[data-sf-m="project-edit-close"]')
  await settle(page)
  const mAfterX = await page.evaluate(SNAP_FN)
  const xPatches = STATE.bodies.projectPatch.length

  // —— 保存臂：只改标题 ⇒ 载荷**恰** {title}，成功关框 + 提示 + 重拉 ——
  STATE.bodies.projectPatch.length = 0
  const readsBeforeSave = STATE.calls.filter((c) => c.path === '/api/project/sui').length
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  await page.fill('[data-sf-edit="title"]', '海鲜打包·周末班')
  await page.click('[data-sf-m="project-edit-save"]')
  await page.waitForFunction(() => !document.querySelector('[data-sf-m="project-edit"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const mSaved = await page.evaluate(SNAP_FN)
  const savePatch = STATE.bodies.projectPatch[0] || null
  const readsAfterSave = STATE.calls.filter((c) => c.path === '/api/project/sui').length

  // —— 400 SLUG_TAKEN：框内 slug 内联、框不关（零成功重拉） ——
  STATE.patchMode = 'slug'
  STATE.bodies.projectPatch.length = 0
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  await page.fill('[data-sf-edit="slug"]', 'taken-slug')
  await page.click('[data-sf-m="project-edit-save"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-edit-err="slug"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const mSlugErr = await page.evaluate(SNAP_FN)
  await page.keyboard.press('Escape')
  await settle(page)

  // —— 409 project_headcount_below_hired：headcount 字段内联（含已招数值）、框不关 ——
  STATE.patchMode = 'headcount'
  STATE.view = { ...STATE.view, hired_count: 3 }
  await open('/sui', '[data-sf-m="project-page"]')
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  await page.fill('[data-sf-edit="headcount"]', '1')
  await page.click('[data-sf-m="project-edit-save"]')
  await page.waitForFunction(() => !!document.querySelector('[data-sf-edit-err="headcount"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const mHeadErr = await page.evaluate(SNAP_FN)
  await page.keyboard.press('Escape')
  await settle(page)

  // —— 非四档（90）⇒ 预选「一天」+ 历史值提示；原样保存 ⇒ 载荷恰 {recruit_min_account_days: 1} ——
  STATE.patchMode = 'ok'
  STATE.view = { ...STATE.view, hired_count: 1, recruit_min_account_days: 90 }
  STATE.bodies.projectPatch.length = 0
  await open('/sui', '[data-sf-m="project-page"]')
  await page.click('[data-sf-m="project-entry-edit"]')
  await settle(page)
  const mLegacy = await page.evaluate(SNAP_FN)
  await page.click('[data-sf-m="project-edit-save"]')
  await page.waitForFunction(() => !document.querySelector('[data-sf-m="project-edit"]'), null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const mLegacySaved = await page.evaluate(SNAP_FN)
  const legacyPatch = STATE.bodies.projectPatch[0] || null

  out.states['1536_modal'] = {
    closed: mClosed.modal,
    open: mOpen.modal,
    afterEsc: { modal: mAfterEsc.modal, patches: escPatches, reads: { before: readsBeforeEsc, after: readsAfterEsc } },
    backdrop: { open: mBackdropOpen.modal.present, after: mAfterBackdrop.modal, patches: backdropPatches },
    closeX: { open: mXOpen.modal.present, after: mAfterX.modal, patches: xPatches },
    saved: { modal: mSaved.modal, project: mSaved.project, notice: mSaved.manage.notice, patch: savePatch, reads: { before: readsBeforeSave, after: readsAfterSave } },
    slugConflict: { errs: mSlugErr.modal.errs, modalPresent: mSlugErr.modal.present, patches: STATE.bodies.projectPatch.length },
    headcountConflict: { errs: mHeadErr.modal.errs, modalPresent: mHeadErr.modal.present },
    legacy: { fields: mLegacy.modal.fields, patch: legacyPatch, closedAfterSave: mLegacySaved.modal.present === false },
  }

  out.assertions.modal = {
    // 入口：操作区第 1 枚、文案 = wage.editTitle；默认关框
    entranceInActions: mClosed.manage.entries === 2
      && mClosed.manage.entryTexts[0] === ZH.wage.editTitle,
    entranceText: mClosed.modal.entranceText === ZH.wage.editTitle,
    closedByDefault: mClosed.modal.present === false && mClosed.modal.panelPresent === false,
    // 开框：dialog 语义 + 标题 + 背景滚动锁定
    opensOnEntry: mOpen.modal.present === true && mOpen.modal.panelPresent === true,
    dialogSemantics: mOpen.modal.role === 'dialog' && mOpen.modal.ariaModal === 'true',
    titleText: mOpen.modal.title === ZH.wage.editTitle,
    saveAndClosePresent: Boolean(mOpen.modal.saveText) && mOpen.modal.closePresent === true
      && mOpen.modal.backdropPresent === true,
    scrollLockedWhileOpen: mOpen.modal.bodyOverflow === 'hidden',
    // 预填 = 行值（次币成对 / 注册天数四档预选）
    prefilledCore: mOpen.modal.fields.title === '海鲜打包'
      && mOpen.modal.fields.description === '每天打包 20 单，按批结算。'
      && mOpen.modal.fields.headcount === '3'
      && mOpen.modal.fields.batt === '30'
      && mOpen.modal.fields.interval === '4'
      && mOpen.modal.fields.slug === 'sui',
    prefilledPair: mOpen.modal.fields.cid === '4' && mOpen.modal.fields.amount === '50'
      && mOpen.modal.fields.amountDisabled === false,
    prefilledStatus: mOpen.modal.fields.status === 'recruiting',
    minDaysFourOptions: mOpen.modal.fields.minDaysTag === 'SELECT'
      && JSON.stringify(mOpen.modal.fields.minDaysValues) === JSON.stringify(['1', '7', '30', '365']),
    minDaysPreselect7: mOpen.modal.fields.minDays === '7' && mOpen.modal.fields.minDaysHint === null,
    // 关闭三路：零 PATCH / 零重拉 / 滚动还原
    // ★ 还原口径 = 回到**开框前**的 inline 值（宿主页已由别处置为 'unset'，禁硬编码 ''）
    escCloses: mAfterEsc.modal.present === false && mAfterEsc.modal.bodyOverflow === mClosed.modal.bodyOverflow,
    escZeroWrites: escPatches === 0 && readsAfterEsc === readsBeforeEsc,
    backdropCloses: mBackdropOpen.modal.present === true && mAfterBackdrop.modal.present === false,
    backdropZeroWrites: backdropPatches === 0,
    closeXCloses: mXOpen.modal.present === true && mAfterX.modal.present === false,
    closeXZeroWrites: xPatches === 0,
    // 保存：只带变化字段 + 关框 + 提示 + 重拉拿新标题
    savePatchExactlyTitle: Boolean(savePatch && savePatch.ref === '11'
      && JSON.stringify(Object.keys(savePatch.body).sort()) === JSON.stringify(['title'])
      && savePatch.body.title === '海鲜打包·周末班'),
    saveClosesModal: mSaved.modal.present === false,
    saveNoticeOk: Boolean(mSaved.manage.notice && mSaved.manage.notice.kind === 'ok'
      && mSaved.manage.notice.text === ZH.wage.editSaved),
    saveRelistsPage: readsAfterSave >= readsBeforeSave + 1,
    saveUpdatesHeadTitle: mSaved.project.title === '海鲜打包·周末班',
    // 400 / 409：框内内联、框不关
    slugConflictInline: mSlugErr.modal.errs.slug === ZH.project.errSlugTaken,
    slugConflictKeepsModal: mSlugErr.modal.present === true,
    headcountConflictInline: mHeadErr.modal.errs.headcount
      === ZH.wage.errHeadcountBelowHired.replace('{{hired}}', '3'),
    headcountConflictKeepsModal: mHeadErr.modal.present === true,
    // 非四档（90）：预选一天 + 提示行；原样保存 ⇒ 载荷收敛为 1
    legacyPicksDay1: mLegacy.modal.fields.minDays === '1'
      && mLegacy.modal.fields.minDaysHint === ZH.bountyProject.minDaysLegacy.replace('{{n}}', '90'),
    legacySaveConverges: Boolean(legacyPatch && JSON.stringify(legacyPatch.body) === JSON.stringify({ recruit_min_account_days: 1 }))
      && mLegacySaved.modal.present === false,
  }
  STATE.patchMode = 'ok'
  STATE.view = projectView()

  // ============================ ③-b 普通用户臂（非 owner ∧ 无管理员能力） ============================
  // ★ owner 判定取读口行 `owner_uid`（不是 /api/user）⇒ 两处同时改：行主换人 + /api/user 无管理员三键
  STATE.userPayload = { uID: 999999 }
  STATE.view = { ...STATE.view, owner_uid: '900001' }
  STATE.calls.length = 0
  const plainSnap = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_plain_user'] = plainSnap.manage
  out.assertions.entryPlain = {
    manageAbsent: plainSnap.manage.present === false,
    // 编辑入口同一闸（管理面板整块不在 ⇒ 零编辑入口、零模态框）
    noEditEntry: plainSnap.modal.entrancePresent === false && plainSnap.modal.present === false,
    zeroEntries: plainSnap.manage.entries === 0,
    zeroForms: plainSnap.manage.forms.campaign === 0 && plainSnap.manage.forms.task === 0 && plainSnap.manage.forms.subtask === 0,
    zeroCardEntries: plainSnap.manage.cardTaskEntries.length === 0 && plainSnap.manage.cardSubtaskEntries.length === 0,
    nestedStillVisible: plainSnap.project.campaigns === 1 && plainSnap.project.subtasks >= 2,
    zeroWrites: STATE.calls.filter((c) => c.method !== 'GET').length === 0,
  }
  STATE.userPayload = { uID: Number(OWNER_UID) }
  STATE.view = { ...STATE.view, owner_uid: OWNER_UID }

  // ============================ ⑥ 两档几何 / 零 pageerror ============================
  const geometry = {}
  for (const [label, width, height] of [['390', 390, 844], ['1536', 1536, 960]]) {
    await page.setViewportSize({ width, height })
    const snap = await open('/sui', '[data-sf-m="project-page"]')
    await page.click('[data-sf-m="project-campaign-entry-task"]')
    await settle(page)
    const formSnap = await page.evaluate(SNAP_FN)
    // ★ 模态框几何（2026-10-21②）：点【编辑项目】⇒ 取面板盒子 + 页面溢出（面板 max-width:100%
    //   与输入 width:100% 必须保证两档都不产生横向溢出）
    await page.click('[data-sf-m="project-entry-edit"]')
    await settle(page)
    const modalSnap = await page.evaluate(SNAP_FN)
    await page.keyboard.press('Escape')
    await settle(page)
    geometry[label] = {
      overflowPx: snap.overflowPx,
      projectRight: snap.project.right,
      tasks: snap.project.tasks,
      subtasks: snap.project.subtasks,
      formOverflowPx: formSnap.overflowPx,
      inputMaxRight: Math.round(formSnap.manage.inputMaxRight * 10) / 10,
      rows: formSnap.manage.rows,
      entries: formSnap.manage.entries,
      modalPresent: modalSnap.modal.present,
      modalWidth: modalSnap.modal.width,
      modalLeft: modalSnap.modal.left,
      modalRight: modalSnap.modal.right,
      modalOverflowPx: modalSnap.overflowPx,
      modalBodyOverflow: modalSnap.modal.bodyOverflow,
    }
  }
  await page.setViewportSize({ width: 1536, height: 960 })
  out.states['geometry'] = geometry
  out.assertions.geometry = {
    zeroOverflow390: geometry['390'].overflowPx === 0 && geometry['390'].formOverflowPx === 0,
    zeroOverflow1536: geometry['1536'].overflowPx === 0 && geometry['1536'].formOverflowPx === 0,
    inputsWithinViewport390: geometry['390'].inputMaxRight <= 390,
    inputsWithinViewport1536: geometry['1536'].inputMaxRight <= 1536,
    formRendersOnBoth: geometry['390'].rows >= 1 && geometry['1536'].rows >= 1,
    // 模态框两档：390 面板不出视口（左右都在 [0,390]）、1536 面板宽 ≤640 且居中不贴边
    modalFits390: geometry['390'].modalPresent === true
      && geometry['390'].modalLeft >= 0 && geometry['390'].modalRight <= 390,
    modalFits1536: geometry['1536'].modalPresent === true
      && geometry['1536'].modalWidth <= 640 && geometry['1536'].modalLeft > 0
      && geometry['1536'].modalRight <= 1536,
    modalZeroOverflow: geometry['390'].modalOverflowPx === 0 && geometry['1536'].modalOverflowPx === 0
      && geometry['390'].modalBodyOverflow === 'hidden',
    zeroPageErrors: pageErrors.length === 0,
  }

  await browser.close()
  out.finishedAt = new Date().toISOString()
  out.assertions.geometry.zeroPageErrors = pageErrors.length === 0

  const required = [
    'wageCard.cardsRendered', 'wageCard.slugCardIsLink', 'wageCard.slugHrefIsProjectPage', 'wageCard.legacyRowStaysArticle',
    'reserved.wagePageRendered', 'reserved.noProjectPageHook', 'reserved.noProjectReadForWage', 'reserved.noNotFound',
    'projectPage.headRendered', 'projectPage.descRendered', 'projectPage.readPath', 'projectPage.campaigns1',
    'projectPage.campaignTitleLinked', 'projectPage.campaignState', 'projectPage.tasks2', 'projectPage.taskTitles',
    'projectPage.taskRewards', 'projectPage.subtasks2', 'projectPage.subtaskTypes5',
    'projectPage.subtaskCodesNotLeaked', 'projectPage.requiredFlags',
    'entryOwner.managePresent', 'entryOwner.topTwoEntries', 'entryOwner.editEntryFirst',
    'entryOwner.topEntryIsCampaign',
    'entryOwner.noTopTaskEntry', 'entryOwner.noTopSubtaskEntry', 'entryOwner.oneTaskEntryPerCampaign',
    'entryOwner.oneSubtaskEntryPerTask', 'entryOwner.taskEntryInCampaignHead', 'entryOwner.subtaskEntryInTaskHead',
    'entryOwner.everyCampaignCardOwnsOneEntry', 'entryOwner.everyTaskCardOwnsOneEntry',
    'entryOwner.formsClosedByDefault',
    'campaignDraft.formOpened', 'campaignDraft.postOnce', 'campaignDraft.keysExactlyClosedSet',
    'campaignDraft.projectIdFromPage', 'campaignDraft.titleAndDesc', 'campaignDraft.timesIso',
    'campaignDraft.noStatusKey', 'campaignDraft.noRewardKeys', 'campaignDraft.noLaunchPatch',
    'campaignDraft.noticeOk', 'campaignDraft.relisted',
    'campaignLaunch.postOnce', 'campaignLaunch.patchOnce', 'campaignLaunch.patchRefIsCreated',
    'campaignLaunch.patchBodyOnlyStatus', 'campaignLaunch.noticeOk',
    'taskForm.formOpened', 'taskForm.formInsideCampaignCard', 'taskForm.noFormInManage',
    'taskForm.lockedCampaignRef', 'taskForm.lockedCampaignText', 'taskForm.noCampaignSelector',
    'taskForm.postOnce', 'taskForm.campaignRef', 'taskForm.keysExactlyClosedSet',
    'taskForm.rewardPrimaryUsd', 'taskForm.secondaryPair', 'taskForm.oneSubtask', 'taskForm.subtaskKeysExactly',
    'taskForm.subtaskFields', 'taskForm.noStatusKey',
    'subtaskForm.formOpened', 'subtaskForm.formInsideTaskCard', 'subtaskForm.lockedCampaignRef',
    'subtaskForm.lockedTaskRef', 'subtaskForm.lockedTextHasBoth', 'subtaskForm.noCampaignSelector',
    'subtaskForm.noTaskSelector', 'subtaskForm.patchedOnce', 'subtaskForm.patchTaskRef', 'subtaskForm.onlySubtasksKey',
    'subtaskForm.groupIsOldPlusOne', 'subtaskForm.oldRowsResentWithId', 'subtaskForm.oldIdsPreserved',
    'subtaskForm.oldPayloadPreserved', 'subtaskForm.newRowLast', 'subtaskForm.freshReadBeforePatch',
    'subtaskForm.listReRendered', 'subtaskForm.noticeOk',
    'multiCampaign.topStillTwoEntries', 'multiCampaign.oneTaskEntryPerCard', 'multiCampaign.oneSubtaskEntryPerTask',
    'multiCampaign.everyCampaignCardOwnsOneEntry', 'multiCampaign.everyTaskCardOwnsOneEntry',
    'multiCampaign.oneSubtaskFormOpen',
    'multiCampaign.lockedSecondCampaign', 'multiCampaign.lockedSecondCampaignText', 'multiCampaign.formInSecondCard',
    'multiCampaign.noCampaignSelector', 'multiCampaign.postedToClickedCampaign', 'multiCampaign.subtaskLockedBoth',
    'multiCampaign.subtaskNoSelectors', 'multiCampaign.subtaskFormInTaskCard',
    // ⑦【编辑项目】模态框（2026-10-21②）：入口 / 开合 / 预填 / 三路关闭 / 载荷收敛 / 400·409 内联 / 非四档
    'modal.entranceInActions', 'modal.entranceText', 'modal.closedByDefault',
    'modal.opensOnEntry', 'modal.dialogSemantics', 'modal.titleText',
    'modal.saveAndClosePresent', 'modal.scrollLockedWhileOpen',
    'modal.prefilledCore', 'modal.prefilledPair', 'modal.prefilledStatus',
    'modal.minDaysFourOptions', 'modal.minDaysPreselect7',
    'modal.escCloses', 'modal.escZeroWrites',
    'modal.backdropCloses', 'modal.backdropZeroWrites',
    'modal.closeXCloses', 'modal.closeXZeroWrites',
    'modal.savePatchExactlyTitle', 'modal.saveClosesModal', 'modal.saveNoticeOk',
    'modal.saveRelistsPage', 'modal.saveUpdatesHeadTitle',
    'modal.slugConflictInline', 'modal.slugConflictKeepsModal',
    'modal.headcountConflictInline', 'modal.headcountConflictKeepsModal',
    'modal.legacyPicksDay1', 'modal.legacySaveConverges',
    'entryPlain.manageAbsent', 'entryPlain.noEditEntry',
    'entryPlain.zeroEntries', 'entryPlain.zeroForms', 'entryPlain.zeroCardEntries',
    'entryPlain.nestedStillVisible',
    'entryPlain.zeroWrites',
    'geometry.zeroOverflow390', 'geometry.zeroOverflow1536', 'geometry.inputsWithinViewport390',
    'geometry.inputsWithinViewport1536', 'geometry.formRendersOnBoth',
    'geometry.modalFits390', 'geometry.modalFits1536', 'geometry.modalZeroOverflow',
    'geometry.zeroPageErrors',
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
