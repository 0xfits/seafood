/**
 * `/task/:taskId` 任务页 · 收尾探针（Kevin 2026-10-21 · 任务页步 2 收尾）
 *
 * 验证项（逐条对齐派单）：
 *   ① `/task/1` **渲染任务页**（`[data-sf-m="task-page"]`，任务号回填 `data-sf-task="1"`，
 *      标题 / 活动链 / 子任务齐备；非 404 提示页）；
 *   ② 首页「热门任务」真卡 **href = `/task/:taskId`**（`data-sf-task` 与 href 末段逐卡相等；
 *      mock 卡不可点、零 `href`）；
 *   ③ **路由互不吞**：`/task`（招工列表）/ `/task/new`（发布）/ `/bounty/:id`（悬赏详情）/
 *      `/task/:id`（本页）四者各落各的钩子，互不出现对方的页面级钩子；
 *   ④ **上线后首页真卡出现**：项目页任务卡【上线】（draft⇒active）⇒ `PATCH /api/campaign/task/:id`
 *      载荷恰 `{status:'active'}` ⇒ 回首页，原来不出现的那条真卡出现且 href = `/task/:id`
 *      （不是 mock 卡：`data-sf-camp-mock="0"`）；
 *   ⑤ 390 / 1536 两档：任务页与首页 **零横向溢出**、**零 pageerror**。
 *      · 「溢出」的判据 = `documentElement.scrollWidth - clientWidth === 0` **且**零「真·offender」；
 *        祖先带 `overflow-x: auto|scroll` 的元素不算 offender（首页「热门任务」≤1024px 是**设计内单行横滚**，
 *        240px 卡必然有 rect 超出视口 —— 记在 `scrollContained` 里，只作诊断）；
 *      · 每臂另给 `pass`（判据的显式合成），总判只读 `pass` —— 臂里的数值读数（`realCards` /
 *        `*OverflowPx` / `consoleErrorCount`）是**读数不是判据**，不得参与 `every(v === true)`。
 *
 * 手法（同 ops/profile-assets/probe-my-points-move.mjs 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子；API 全在 `context.route` 内自截（零后端 / 零库写）；
 *   · 「上线」由探针内的假后端承接：PATCH 落库到内存 STATE，首页读口按 STATE 现算 ⇒ 前后对比可信。
 *
 * 用法：QA_DIST=<dist> node probe-task-page.mjs <out.json>
 *   PROBE_NEG=1 ⇒ 负控臂：强制首页读口恒空（模拟「上线没生效」）⇒ ④ 必须转红（尺子灵敏度自证）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/task-page/readings/probe-task-page.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const NEG = process.env.PROBE_NEG === '1'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const UID = 970213

// ---- 夹具（内存 JSON；行形状逐字对齐后端冻结契约） -------------------------------------------
const PROJECT = {
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: UID,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [
    {
      campaign_id: 501,
      title: '秋季招募',
      description: '活动说明',
      status: 'active',
      time_start: '2026-10-01T00:00:00.000Z',
      time_end: '2026-10-31T00:00:00.000Z',
      tasks: [
        {
          task_id: 55,
          title: '草稿任务甲',
          description: '待上线',
          status: 'draft',
          sort: 1,
          time_start: null,
          time_end: null,
          reward_amount_primary: '5',
          reward_cid_secondary: null,
          reward_amount_secondary: null,
          subtasks: [],
        },
      ],
    },
  ],
}

const TASK_DETAIL = {
  task_id: '1',
  title: '转发推文',
  description: '转发并截图',
  status: 'active',
  time_start: null,
  time_end: null,
  reward_amount_primary: '5',
  reward_cid_secondary: null,
  reward_amount_secondary: null,
  joined_count: 3,
  joined_target: 50,
  campaign: { id: '501', title: '秋季招募', status: 'active' },
  project: { id: '11', title: '海鲜打包', slug: 'sui', avatar_url: null, status: 'recruiting' },
  subtasks: [
    { subtask_id: '901', type_code: 'x_verify', title: '转发推文', content: '附链接', sort: 1, required: true },
    { subtask_id: '902', type_code: 'survey', title: '填写问卷', content: '', sort: 2, required: false },
  ],
}

// 首页热门任务：两条**已上线**真行（task 1 / 2）＋ 项目页那条 draft（task 55）**不在**读口返回里
const HOME_TASKS_ACTIVE = [
  { task_id: 1, campaign_id: 501, title: '转发推文', status: 'active', joined_count: 3, joined_target: 50, reward_amount_primary: '5', campaign_title: '秋季招募', project_title: '海鲜打包', project_avatar_url: null },
  { task_id: 2, campaign_id: 501, title: '填写问卷', status: 'active', joined_count: 7, joined_target: 100, reward_amount_primary: '3', campaign_title: '春季活动', project_title: '海鲜分拣', project_avatar_url: null },
]

const STATE = {
  calls: [],
  taskStatus: { 55: 'draft' }, // 项目页那条：上线前 draft（不进首页读口），点【上线】后 → active
}

const ok = (data) => ({ success: true, data })

// 首页读口按 STATE 现算：draft 任务**不出现**（与后端 `t.status <> 'draft'` 同口径）
const homeRows = () => {
  const rows = [...HOME_TASKS_ACTIVE]
  if (STATE.taskStatus[55] === 'active') {
    rows.push({
      task_id: 55, campaign_id: 501, title: '草稿任务甲', status: 'active', joined_count: 0, joined_target: null,
      reward_amount_primary: '5', campaign_title: '秋季招募', project_title: '海鲜打包', project_avatar_url: null,
    })
  }
  return NEG ? [] : rows // 负控臂：读口恒空 ⇒ ④ 必须转红
}

const apiResponse = (method, pathname, body) => {
  STATE.calls.push({ method, path: pathname, body: body || null })

  if (pathname === '/api/home/campaign-tasks') return ok(homeRows())
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: '平台积分' }])
  if (pathname === '/api/user') return ok({ uID: UID, uid: UID, name: 'Probe', admin: { manage_tasks: true } })
  if (pathname === `/api/user/asset/${UID}`) return ok({ points: 0, time_update: null })
  if (pathname === '/api/prize-item') return ok([])
  // 招工列表页（`/task`）的读口是**裸数组**（真实后端形状）：探针臂③ 会打开 `/task`，
  // 若落到下面的通用对象兜底 ⇒ `(rows||[]).map` 抛 TypeError（console error，不是页面级 pageerror）。
  // 夹具必须逐字对齐后端形状（`GET /api/task/all` → 数组；`GET /api/task-progress` → 数组）。
  if (pathname === '/api/task/all') return ok([])
  if (pathname === '/api/task-progress') return ok([])
  if (pathname.startsWith('/api/prize/all')) return ok({ rows: [], total: 0 })
  if (pathname.startsWith('/api/user/balances')) return ok([{ cid: 1, symbol: '$', name: '平台积分', balance: '100' }])
  if (pathname.startsWith('/api/campaign/task/')) {
    const ref = pathname.slice('/api/campaign/task/'.length)
    if (method === 'PATCH') {
      let parsed = null
      try { parsed = JSON.parse(body || '{}') } catch { parsed = null }
      const next = parsed && typeof parsed === 'object' ? parsed.status : undefined
      if (next === 'active' || next === 'draft') STATE.taskStatus[ref] = next
      return ok({ task_id: ref, status: STATE.taskStatus[ref] || next })
    }
    if (ref === '1') return ok(TASK_DETAIL)
    return ok({ ...TASK_DETAIL, task_id: ref })
  }
  if (pathname === '/api/project/sui') {
    const view = JSON.parse(JSON.stringify(PROJECT))
    view.campaigns[0].tasks[0].status = STATE.taskStatus[55] || 'draft'
    return ok(view)
  }
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0, tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 })
  return ok({})
}

// ---- 页内读数 ---------------------------------------------------------------------------------
const SNAP_FN = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const cards = qa('[data-sf-m="home-camp-card"]')
  // 溢出 offenders 只算**真·页面级**溢出：祖先里有 `overflow-x: auto|scroll` 的元素 = 设计内的横滚容器
  // （首页「热门任务」≤1024px 就是单行横滚，240px 卡必然有 rect 超出视口 —— 不是页面溢出，见 styles.css 1150-1152）。
  const inScrollX = (el) => {
    for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return p
    }
    return null
  }
  const scrollContainers = new Set()
  const offenders = []
  for (const el of qa('*')) {
    const b = el.getBoundingClientRect()
    if (!(b.width > 0 && b.right > de.clientWidth + 1)) continue
    const sc = inScrollX(el)
    if (sc) { scrollContainers.add(sc); continue }
    if (offenders.length < 8) {
      offenders.push({
        sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}`,
        right: Math.round(b.right),
      })
    }
  }
  return {
    pathname: location.pathname,
    overflowPx: de.scrollWidth - de.clientWidth,
    offenders,
    scrollContained: scrollContainers.size, // 诊断：被横滚容器收住的越界元素（非缺陷，仅记账）
    hooks: {
      taskPage: !!q('[data-sf-m="task-page"]'),
      taskPageTask: q('[data-sf-m="task-page"]')?.getAttribute('data-sf-task') || null,
      taskTitle: txt(q('[data-sf-m="task-title"]')),
      taskSubtasks: qa('[data-sf-m="task-subtask"]').length,
      homeGrid: !!q('[data-sf-m="home-camp-grid"]'),
      jobsNav: !!q('[data-sf-m="jobs-nav"]'),
      jobsFormWrap: !!q('[data-sf-m="jobs-form-wrap"]'),
      jobsDetail: !!q('[data-sf-m="jobs-detail"]'),
      notFound: !!q('[data-sf-m="not-found-page"]'),
      projectPage: !!q('[data-sf-m="project-page"]'),
      projectToggle: q('[data-sf-m="project-task-status-toggle"]')
        ? {
          next: q('[data-sf-m="project-task-status-toggle"]').getAttribute('data-sf-next'),
          text: txt(q('[data-sf-m="project-task-status-toggle"]')),
          disabled: q('[data-sf-m="project-task-status-toggle"]').disabled,
        }
        : null,
      projectTaskState: q('[data-sf-m="project-task-status"]')?.getAttribute('data-sf-state') || null,
      projectTaskErr: txt(q('[data-sf-m="project-task-status-err"]')),
    },
    cards: cards.map((c) => ({
      tag: c.tagName.toLowerCase(),
      href: c.getAttribute('href'),
      task: c.getAttribute('data-sf-task'),
      mock: c.getAttribute('data-sf-camp-mock'),
      title: txt(c.querySelector('[data-sf-m="home-camp-title"]')),
    })),
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
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse(req.method(), u.pathname, req.postData())),
      })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

const seed = (ctx) => ctx.addInitScript((uid) => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: uid, uid, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
}, UID)

const newPageWith = async (browser, viewport) => {
  const pageErrors = []
  const consoleErrors = []
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seed(context)
  await attachRoutes(context)
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // 带出触发时的 pathname（定位用；`consoleErrorCount` 只作诊断，判据仍是 `pageErrors`）
    let path = ''
    try { path = new URL(page.url()).pathname } catch { path = '' }
    consoleErrors.push(`${path} :: ${m.text().slice(0, 300)}`)
  })
  return { page, pageErrors, consoleErrors }
}

const open = async (page, url, waitHook) => {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (waitHook) await page.waitForSelector(waitHook, { timeout: 8000 }).catch(() => {})
  await settle(page)
  return page.evaluate(SNAP_FN)
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/task-page/probe-task-page.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    negArm: NEG,
    fixtures: {
      taskDetail: TASK_DETAIL.task_id,
      projectSlug: PROJECT.slug,
      draftTaskInProject: 55,
      homeActiveRows: HOME_TASKS_ACTIVE.map((r) => r.task_id),
      auth: 'localStorage seed only（零真登录）',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {},
    assertions: {},
  }

  for (const [label, viewport] of [['1536', { width: 1536, height: 960 }], ['390', { width: 390, height: 844 }]]) {
    const { page, pageErrors, consoleErrors } = await newPageWith(browser, viewport)

    // ① 任务页
    const taskSnap = await open(page, '/task/1', '[data-sf-m="task-page"]')
    out.states[`${label}_task`] = taskSnap
    const taskArm = {
      hook: taskSnap.hooks.taskPage === true,
      taskIdEcho: taskSnap.hooks.taskPageTask === '1',
      notNotFound: taskSnap.hooks.notFound === false,
      hasSubtasks: taskSnap.hooks.taskSubtasks >= 2,
    }
    out.assertions[`taskPageRendered_${label}`] = {
      ...taskArm,
      pass: Object.values(taskArm).every(Boolean),
    }

    // ② 首页真卡 href = /task/:id
    const homeSnap = await open(page, '/', '[data-sf-m="home-camp-grid"]')
    const real = homeSnap.cards.filter((c) => c.mock === '0')
    out.states[`${label}_home`] = homeSnap
    const hrefArm = {
      realCards: real.length,
      allRealHrefTaskPage: real.length > 0 && real.every((c) => c.href === `/task/${c.task}`),
      hrefs: real.map((c) => c.href),
      mockCardsUnclickable: homeSnap.cards.filter((c) => c.mock === '1').every((c) => c.tag === 'div' && !c.href),
      noCampaignHrefOnReal: real.every((c) => !String(c.href || '').startsWith('/campaign/')),
    }
    out.assertions[`homeCardHref_${label}`] = {
      ...hrefArm,
      // ★ pass 显式由判据合成：`realCards` 是**读数**（2 张真卡），不是判据 —— 让它参与 `every(v===true)`
      //   就等于「真卡数 2 ⇒ 判红」，读数越对越红（旧版总判即因此误红）。
      pass: hrefArm.realCards > 0 && hrefArm.allRealHrefTaskPage
        && hrefArm.mockCardsUnclickable && hrefArm.noCampaignHrefOnReal,
    }

    // ③ 路由互不吞
    const routes = {}
    for (const [url, own, others] of [
      ['/task', 'jobsNav', ['taskPage', 'jobsFormWrap', 'jobsDetail']],
      ['/task/new', 'jobsFormWrap', ['taskPage', 'jobsNav', 'jobsDetail']],
      ['/bounty/9', 'jobsDetail', ['taskPage', 'jobsFormWrap', 'jobsNav']],
      ['/task/1', 'taskPage', ['jobsNav', 'jobsFormWrap', 'jobsDetail']],
    ]) {
      const snap = await open(page, url, null)
      routes[url] = { own: snap.hooks[own] === true, othersPresent: others.filter((k) => snap.hooks[k] === true) }
    }
    out.states[`${label}_routes`] = routes
    const routeArm = Object.fromEntries(Object.entries(routes).map(([u, r]) => [u, r.own && r.othersPresent.length === 0]))
    out.assertions[`routeSeparation_${label}`] = {
      arms: routeArm,
      pass: Object.values(routeArm).every(Boolean),
    }

    // ④ 上线（draft⇒active）后首页真卡出现
    const before = homeSnap.cards.some((c) => c.task === '55')
    STATE.calls.length = 0
    const projectSnap = await open(page, '/sui', '[data-sf-m="project-task-status-toggle"]')
    out.states[`${label}_project`] = projectSnap
    const toggle0 = projectSnap.hooks.projectToggle
    await page.click('[data-sf-m="project-task-status-toggle"]')
    await page.waitForTimeout(400)
    await settle(page)
    const afterProject = await page.evaluate(SNAP_FN)
    out.states[`${label}_project_after`] = afterProject
    const patch = STATE.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/campaign/task/55')
    let patchBody = null
    try { patchBody = patch.length ? JSON.parse(patch[0].body || '{}') : null } catch { patchBody = 'unparsable' }
    const afterHome = await open(page, '/', '[data-sf-m="home-camp-grid"]')
    out.states[`${label}_home_after`] = afterHome
    const card55 = afterHome.cards.find((c) => c.task === '55')
    const onlineArm = {
      draftAbsentBefore: before === false,
      toggleRenderedBefore: !!toggle0, // 上线前 draft ⇒ 该钮存在
      toggleNextWasActive: toggle0 ? toggle0.next === 'active' : false,
      patchSent: patch.length === 1,
      patchPayloadExact: JSON.stringify(patchBody) === JSON.stringify({ status: 'active' }),
      noInlineError: afterProject.hooks.projectTaskErr === null,
      realCardAppeared: !!card55 && card55.mock === '0',
      cardHrefTaskPage: !!card55 && card55.href === '/task/55',
      notMockFilled: afterHome.cards.filter((c) => c.mock === '1').length <= 2,
    }
    out.assertions[`taskOnlineAppearsInHome_${label}`] = {
      ...onlineArm,
      pass: Object.values(onlineArm).every(Boolean),
    }
    // 复位（390 档重跑用同一 STATE ⇒ 回 draft）
    STATE.taskStatus[55] = 'draft'

    // ⑤ 溢出 / pageerror（本档所有页面一起判）
    const snaps = [taskSnap, homeSnap, projectSnap, afterHome]
    const overflowArm = {
      taskOverflowPx: taskSnap.overflowPx,
      homeOverflowPx: homeSnap.overflowPx,
      projectOverflowPx: projectSnap.overflowPx,
      afterHomeOverflowPx: afterHome.overflowPx,
      // ★ 两档合一的判据：四页**都**零页面级溢出（`documentElement` 横滚量）且**真·offender 零**
      //   （横滚容器内的越界元素登记在 `scrollContained`，不算溢出 —— 那是设计内的单行横滚）。
      zeroOverflow: snaps.every((s) => s.overflowPx === 0 && s.offenders.length === 0),
      offenders: snaps.flatMap((s) => s.offenders),
      scrollContained: snaps.map((s) => s.scrollContained),
      pageErrors,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      zeroPageError: pageErrors.length === 0,
    }
    out.assertions[`noOverflowNoPageError_${label}`] = {
      ...overflowArm,
      pass: overflowArm.zeroOverflow && overflowArm.zeroPageError,
    }
    await page.context().close()
  }

  await browser.close()

  // 总判（负控臂下允许 ④ 转红；其它项必须常绿）
  const a = out.assertions
  // ★ 每臂自己给出 `pass`（判据的**显式合成**）⇒ 总判只读 `pass`。
  //   禁回到「对整对象 `every(v === true)`」：臂里带数值/数组**读数**（`realCards: 2`、
  //   `homeOverflowPx: 0`、`consoleErrorCount: 2`），那样判据全绿而总判恒红（旧版即此病）。
  const passOf = (obj) => obj?.pass === true
  out.summary = {
    taskPageRendered: passOf(a.taskPageRendered_1536) && passOf(a.taskPageRendered_390),
    homeCardHref: passOf(a.homeCardHref_1536) && passOf(a.homeCardHref_390),
    routeSeparation: passOf(a.routeSeparation_1536) && passOf(a.routeSeparation_390),
    taskOnlineAppears: passOf(a.taskOnlineAppearsInHome_1536) && passOf(a.taskOnlineAppearsInHome_390),
    noOverflowNoPageError: passOf(a.noOverflowNoPageError_1536) && passOf(a.noOverflowNoPageError_390),
  }
  out.summaryAll = Object.values(out.summary).every(Boolean)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out.summary, null, 2))
  console.log(`[PROBE] ${OUT}  negArm=${NEG}  all=${out.summaryAll}`)
  process.exit(NEG ? (out.summary.taskOnlineAppears ? 1 : 0) : (out.summaryAll ? 0 : 1))
}

run().catch((e) => { console.error(e); process.exit(2) })
