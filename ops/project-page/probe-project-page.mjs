/**
 * 项目页 `/:slug` 前端探针（Kevin 2026-10-21 · 步 2：嵌套列表 + 三入口表单）
 *
 * 判据（逐条对齐派单验证项）：
 *   ① `/wage` 卡 href：行有合法 slug ⇒ 整卡是 `<a>` 且 href 含 `/sui`（历史行无 slug ⇒ 仍 `<article>`）；
 *   ② `/sui` 渲染项目头 + 详细介绍 + **三级嵌套**（campaign → task → subtask，数量 / 状态 / 类型徽标）；
 *   ③ 入口显隐：owner 三入口可见；普通用户（非 owner ∧ 无 manage_tasks）零入口零表单；
 *   ④ 三表单提交载荷**逐键对拍**（含「立即上线」二次 PATCH、次币成对、subtasks 整组追加不丢旧行）；
 *   ⑤ 保留段 `/wage` 不被 `:slug` 吞（项目页 hook 零出现、wage 页 hook 在场、零项目读口）；
 *   ⑥ 390 / 1536 两档零溢出（scrollWidth - clientWidth = 0）+ 零 pageerror。
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

const STATE = {
  view: projectView(),
  userPayload: { uID: Number(OWNER_UID) },
  wageRows: [wageRow(), wageRow({ project_id: 12, snowflake_id: '70012', slug: null, title: '冷库分拣' })],
  calls: [],
  bodies: { campaign: [], campaignPatch: [], task: [], subtaskPatch: [] },
}

const ok = (data) => ({ success: true, data })

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
      entries: qa('[data-sf-m^="project-entry-"]').length,
      entryTexts: qa('[data-sf-m^="project-entry-"]').map((el) => txt(el)),
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname, req.postData())) })
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
    threeEntries: projSnap.manage.entries === 3,
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

  // ============================ ④-c 发布任务（次币成对 + 一行子任务） ============================
  await page.click('[data-sf-m="project-entry-task"]')
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
  await page.click('[data-sf-m="project-entry-subtask"]')
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

  // ============================ ③-b 普通用户臂（非 owner ∧ 无管理员能力） ============================
  // ★ owner 判定取读口行 `owner_uid`（不是 /api/user）⇒ 两处同时改：行主换人 + /api/user 无管理员三键
  STATE.userPayload = { uID: 999999 }
  STATE.view = { ...STATE.view, owner_uid: '900001' }
  STATE.calls.length = 0
  const plainSnap = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_plain_user'] = plainSnap.manage
  out.assertions.entryPlain = {
    manageAbsent: plainSnap.manage.present === false,
    zeroEntries: plainSnap.manage.entries === 0,
    zeroForms: plainSnap.manage.forms.campaign === 0 && plainSnap.manage.forms.task === 0 && plainSnap.manage.forms.subtask === 0,
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
    await page.click('[data-sf-m="project-entry-task"]')
    await settle(page)
    const formSnap = await page.evaluate(SNAP_FN)
    geometry[label] = {
      overflowPx: snap.overflowPx,
      projectRight: snap.project.right,
      tasks: snap.project.tasks,
      subtasks: snap.project.subtasks,
      formOverflowPx: formSnap.overflowPx,
      inputMaxRight: Math.round(formSnap.manage.inputMaxRight * 10) / 10,
      rows: formSnap.manage.rows,
      entries: formSnap.manage.entries,
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
    'entryOwner.managePresent', 'entryOwner.threeEntries', 'entryOwner.formsClosedByDefault',
    'campaignDraft.formOpened', 'campaignDraft.postOnce', 'campaignDraft.keysExactlyClosedSet',
    'campaignDraft.projectIdFromPage', 'campaignDraft.titleAndDesc', 'campaignDraft.timesIso',
    'campaignDraft.noStatusKey', 'campaignDraft.noRewardKeys', 'campaignDraft.noLaunchPatch',
    'campaignDraft.noticeOk', 'campaignDraft.relisted',
    'campaignLaunch.postOnce', 'campaignLaunch.patchOnce', 'campaignLaunch.patchRefIsCreated',
    'campaignLaunch.patchBodyOnlyStatus', 'campaignLaunch.noticeOk',
    'taskForm.formOpened', 'taskForm.postOnce', 'taskForm.campaignRef', 'taskForm.keysExactlyClosedSet',
    'taskForm.rewardPrimaryUsd', 'taskForm.secondaryPair', 'taskForm.oneSubtask', 'taskForm.subtaskKeysExactly',
    'taskForm.subtaskFields', 'taskForm.noStatusKey',
    'subtaskForm.formOpened', 'subtaskForm.patchedOnce', 'subtaskForm.patchTaskRef', 'subtaskForm.onlySubtasksKey',
    'subtaskForm.groupIsOldPlusOne', 'subtaskForm.oldRowsResentWithId', 'subtaskForm.oldIdsPreserved',
    'subtaskForm.oldPayloadPreserved', 'subtaskForm.newRowLast', 'subtaskForm.freshReadBeforePatch',
    'subtaskForm.listReRendered', 'subtaskForm.noticeOk',
    'entryPlain.manageAbsent', 'entryPlain.zeroEntries', 'entryPlain.zeroForms', 'entryPlain.nestedStillVisible',
    'entryPlain.zeroWrites',
    'geometry.zeroOverflow390', 'geometry.zeroOverflow1536', 'geometry.inputsWithinViewport390',
    'geometry.inputsWithinViewport1536', 'geometry.formRendersOnBoth', 'geometry.zeroPageErrors',
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
