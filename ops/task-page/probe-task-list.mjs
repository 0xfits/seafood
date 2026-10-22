/**
 * `/task` 任务列表页 · 收尾探针（Kevin 2026-10-21 · job 下线收尾）
 *
 * 验证项（逐条对齐派单）：
 *   ① `/task` **渲染 campaign 卡**：`[data-sf-m="task-list-grid"]` 里逐行 `home-camp-card`，
 *      卡数 = 读口行数、标题/项目/活动逐卡对得上、`href = /task/<task_id>`、`data-sf-camp-mock="0"`；
 *   ② **点卡进 `/task/:id`**：点首卡 ⇒ pathname `/task/101` 且页面级钩子 `[data-sf-m="task-page"]`
 *      带 `data-sf-task="101"`（卡与跳转同一任务号，不是活动页）；
 *   ③ 旧 job 面落 404：`/task/new`（发布口，非数字号闸）与 `/bounty/1`（悬赏详情，路由已删）
 *      **都**落 `[data-sf-m="not-found-page"]`；且 `/task/new` **零** `/api/campaign/task/new` 请求；
 *   ④ 390 / 1536 两档：**零横向溢出**（`documentElement.scrollWidth - clientWidth === 0` 且零真·offender，
 *      横滚容器内的越界元素只记 `scrollContained`）、**零 pageerror**、**零 `/api/task/all` 命中**。
 *   ⑤（TASK-LIST-SUBTASK-v1，2026-10-22）`/task` 卡内**子任务区**：子任务行在场（类型徽标 + 标题 +
 *      必做小标）、超 2 条 ⇒ 「+N 项子任务」、缺键 ⇒ 整块不渲染、长标题单行截断（ellipsis 生效）、
 *      **卡内零溢出**（每卡 scrollWidth ≤ clientWidth）、**同行卡等高**（逐行 max-min === 0）、零 pageerror；
 *   ⑥ **首页卡零回归**：首页热门任务卡即便读口行带 `subtasks` 也**不渲染**子任务区（开关只在 /task 开）。
 *
 * 手法（同 ops/task-page/probe-task-page.mjs 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子；API 全在 `context.route` 内自截（零后端 / 零库写）；
 *   · 判据显式合成每臂的 `pass`（读数不参与总判）。
 *
 * 用法：QA_DIST=<dist> node probe-task-list.mjs <out.json>
 *   PROBE_NEG=1 ⇒ 负控臂：任务读口恒空 ⇒ ① 必须转红（尺子灵敏度自证）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/task-page/readings/probe-task-list.json')
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

// ---- 夹具（行形状逐字对齐 `GET /api/home/campaign-tasks` 冻结契约） ---------------------------
const LIST_ROWS = [
  {
    task_id: 101, campaign_id: 501, title: '转发推文', status: 'active',
    joined_count: 3, joined_target: 50, reward_amount_primary: '5',
    reward_cid_secondary: null, reward_amount_secondary: null,
    campaign_title: '秋季招募', project_title: '海鲜打包', project_slug: 'sui', project_avatar_url: null,
    // ★ 加性 `subtasks[]`（后端并行单口径）：3 条（1 长标题验截断 · 1 非必做）⇒ 卡内只列 2 + 「+1」
    subtasks: [
      { subtask_id: '901', type_code: 'x_verify', title: '把本次活动的推广长图转发到个人主页并截图回传（要求附上完整链接与时间戳）', required: true, sort: 1 },
      { subtask_id: '902', type_code: 'survey', title: '填写问卷', required: false, sort: 2 },
      { subtask_id: '903', type_code: 'quiz', title: '答题三题', required: false, sort: 3 },
    ],
  },
  {
    task_id: 102, campaign_id: 501, title: '填写问卷', status: 'active',
    joined_count: 7, joined_target: null, reward_amount_primary: '3',
    campaign_title: '秋季招募', project_title: '海鲜分拣', project_slug: 'fenjian', project_avatar_url: null,
    // ★ 恰好 1 条（onchain_snapshot ⇒ 徽标「链上快照」；required ⇒ 必做小标）
    subtasks: [
      { subtask_id: '911', type_code: 'onchain_snapshot', title: '链上持仓快照', required: true, sort: 1 },
    ],
  },
  {
    task_id: 103, campaign_id: 502, title: '拍摄到货视频', status: 'active',
    joined_count: 0, joined_target: 20, reward_amount_primary: '8',
    campaign_title: '春季活动', project_title: '海鲜打包', project_slug: 'sui', project_avatar_url: null,
  },
]

const TASK_DETAIL = {
  task_id: '101',
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

const STATE = { calls: [] }

const ok = (data) => ({ success: true, data })

// 负控臂：列表读口恒空 ⇒ ① 必须以「零卡」转红（尺子灵敏度自证）
const listRows = () => (NEG ? [] : LIST_ROWS)

const apiResponse = (method, pathname, body) => {
  STATE.calls.push({ method, path: pathname, body: body || null })

  // ★ 旧 job 读口：若前端回退去拉，命中本支并留痕（臂④ 另有零命中判据）
  if (pathname === '/api/task/all') return ok([{ tID: 1, title: '旧悬赏幽灵' }])

  if (pathname === '/api/home/campaign-tasks') return ok(listRows())
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: '平台积分' }])
  if (pathname === '/api/user') return ok({ uID: UID, uid: UID, name: 'Probe', admin: {} })
  if (pathname === `/api/user/asset/${UID}`) return ok({ points: 0, time_update: null })
  if (pathname === '/api/prize-item') return ok([])
  if (pathname.startsWith('/api/prize/all')) return ok({ rows: [], total: 0 })
  if (pathname.startsWith('/api/user/balances')) return ok([{ cid: 1, symbol: '$', name: '平台积分', balance: '100' }])
  if (pathname.startsWith('/api/campaign/task/')) {
    const ref = pathname.slice('/api/campaign/task/'.length)
    if (ref === '101') return ok(TASK_DETAIL)
    return { success: false, error: { code: 'NOT_FOUND', message: 'task not found' } }
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
  // offender 只算页面级溢出：祖先带 `overflow-x: auto|scroll` 的越界元素 = 设计内横滚（登记不作缺陷）
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
    scrollContained: scrollContainers.size,
    hooks: {
      listGrid: !!q('[data-sf-m="task-list-grid"]'),
      listTitle: txt(q('[data-sf-m="task-list-title"]')),
      listEmpty: !!q('[data-sf-m="task-list-empty"]'),
      taskPage: !!q('[data-sf-m="task-page"]'),
      taskPageTask: q('[data-sf-m="task-page"]')?.getAttribute('data-sf-task') || null,
      taskTitle: txt(q('[data-sf-m="task-title"]')),
      notFound: !!q('[data-sf-m="not-found-page"]'),
      jobsFormWrap: !!q('[data-sf-m="jobs-form-wrap"]'),
      jobsDetail: !!q('[data-sf-m="jobs-detail"]'),
    },
    cards: cards.map((c) => {
      const box = c.getBoundingClientRect()
      const more = c.querySelector('[data-sf-m="home-camp-subtask-more"]')
      return {
        tag: c.tagName.toLowerCase(),
        href: c.getAttribute('href'),
        task: c.getAttribute('data-sf-task'),
        mock: c.getAttribute('data-sf-camp-mock'),
        title: txt(c.querySelector('[data-sf-m="home-camp-title"]')),
        project: txt(c.querySelector('[data-sf-m="home-camp-project"]')),
        campaign: txt(c.querySelector('[data-sf-m="home-camp-campaign"]')),
        // ── 子任务区读数（TASK-LIST-SUBTASK-v1）：行 / 徽标 / 必做 / 截断 / 几何 ──
        subtaskBlock: !!c.querySelector('[data-sf-m="home-camp-subtasks"]'),
        subtaskCount: c.querySelectorAll('[data-sf-m="home-camp-subtask"]').length,
        moreRest: more ? Number(more.getAttribute('data-sf-rest')) : null,
        subtasks: [...c.querySelectorAll('[data-sf-m="home-camp-subtask"]')].map((row) => {
          const titleEl = row.querySelector('[data-sf-m="home-camp-subtask-title"]')
          return {
            type: row.querySelector('[data-sf-m="home-camp-subtask-type"]')?.getAttribute('data-sf-type') || null,
            badge: txt(row.querySelector('[data-sf-m="home-camp-subtask-type"]')),
            title: txt(titleEl),
            required: !!row.querySelector('[data-sf-m="home-camp-subtask-required"]'),
            // 截断 = 标题真被收口（scrollWidth 超 clientWidth）且走 ellipsis
            truncated: !!titleEl && titleEl.scrollWidth > titleEl.clientWidth + 1
              && getComputedStyle(titleEl).textOverflow === 'ellipsis',
          }
        }),
        boxW: Math.round(box.width),
        boxH: Math.round(box.height),
        rowTop: Math.round(c.getBoundingClientRect().top),
        innerOverflowPx: Math.max(0, c.scrollWidth - c.clientWidth),
      }
    }),
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
    let p = ''
    try { p = new URL(page.url()).pathname } catch { p = '' }
    consoleErrors.push(`${p} :: ${m.text().slice(0, 300)}`)
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
    probe: 'ops/task-page/probe-task-list.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    negArm: NEG,
    fixtures: {
      listRows: LIST_ROWS.map((r) => r.task_id),
      firstCard: LIST_ROWS[0].task_id,
      auth: 'localStorage seed only（零真登录）',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {},
    assertions: {},
  }

  for (const [label, viewport] of [['1536', { width: 1536, height: 960 }], ['390', { width: 390, height: 844 }]]) {
    const { page, pageErrors, consoleErrors } = await newPageWith(browser, viewport)

    // ① `/task` 渲染 campaign 卡
    STATE.calls.length = 0
    const listSnap = await open(page, '/task', '[data-sf-m="home-camp-card"], [data-sf-m="task-list-empty"]')
    out.states[`${label}_task_list`] = listSnap
    const listCalls = STATE.calls.filter((c) => c.path === '/api/home/campaign-tasks')
    const listArm = {
      grid: listSnap.hooks.listGrid === true,
      cardCount: listSnap.cards.length,
      everyCardIsTask: listSnap.cards.every((c) => c.tag === 'a' && c.href === `/task/${c.task}`),
      titles: listSnap.cards.map((c) => c.title),
      hrefs: listSnap.cards.map((c) => c.href),
      allRealCards: listSnap.cards.every((c) => c.mock === '0'),
      readOnce: listCalls.length === 1,
      noNotFound: listSnap.hooks.notFound === false,
      noLegacyJobPage: listSnap.hooks.jobsFormWrap === false && listSnap.hooks.jobsDetail === false,
    }
    out.assertions[`taskListRendersCampaignCards_${label}`] = {
      ...listArm,
      // ★ 判据只读「结构 + 逐卡对号 + 读口恰一次」；`cardCount` 是读数，转而用 `titles` 长度对夹具行数比较
      pass: listArm.grid
        && listArm.cardCount === LIST_ROWS.length
        && listArm.titles.length === LIST_ROWS.length
        && LIST_ROWS.every((row, i) => listArm.titles[i] === row.title)
        && listArm.everyCardIsTask
        && listArm.allRealCards
        && listArm.readOnce
        && listArm.noNotFound
        && listArm.noLegacyJobPage,
    }

    // ⑤ `/task` 卡内子任务区（TASK-LIST-SUBTASK-v1）：行在场 · 2+N · 缺键不占位 · 截断 · 卡内零溢出 · 等高
    const st = listSnap.cards
    const rowGroups = new Map()
    for (const c of st) {
      if (!rowGroups.has(c.rowTop)) rowGroups.set(c.rowTop, [])
      rowGroups.get(c.rowTop).push(c.boxH)
    }
    const stArm = {
      perCard: st.map((c) => ({
        task: c.task,
        block: c.subtaskBlock,
        rows: c.subtaskCount,
        moreRest: c.moreRest,
        types: c.subtasks.map((s) => s.type),
        badges: c.subtasks.map((s) => s.badge),
        titles: c.subtasks.map((s) => s.title),
        requireds: c.subtasks.map((s) => s.required),
        truncated: c.subtasks.map((s) => s.truncated),
        boxH: c.boxH,
        innerOverflowPx: c.innerOverflowPx,
      })),
      // 行在场：101 三条子任务只列 2 + 「+1」；102 恰 1 条无 +N；103 缺键 ⇒ 整块不渲染
      card101: {
        rows: st[0]?.subtaskCount ?? -1,
        moreRest: st[0]?.moreRest ?? null,
        badges: st[0]?.subtasks.map((s) => s.badge) ?? [],
        titles: st[0]?.subtasks.map((s) => s.title) ?? [],
        types: st[0]?.subtasks.map((s) => s.type) ?? [],
        requireds: st[0]?.subtasks.map((s) => s.required) ?? [],
      },
      card102: {
        rows: st[1]?.subtaskCount ?? -1,
        moreRest: st[1]?.moreRest ?? null,
        badges: st[1]?.subtasks.map((s) => s.badge) ?? [],
        requireds: st[1]?.subtasks.map((s) => s.required) ?? [],
      },
      card103: { block: st[2]?.subtaskBlock ?? null, rows: st[2]?.subtaskCount ?? -1 },
      rowsCappedAtTwo: st.every((c) => c.subtaskCount <= 2),
      truncatedFirst: st[0]?.subtasks[0]?.truncated === true,
      zeroInnerOverflow: st.every((c) => c.innerOverflowPx === 0),
      rowHeights: [...rowGroups.values()].map((hs) => ({ min: Math.min(...hs), max: Math.max(...hs) })),
      equalHeights: [...rowGroups.values()].every((hs) => Math.max(...hs) - Math.min(...hs) === 0),
      pageErrors,
    }
    out.assertions[`taskCardSubtaskRows_${label}`] = {
      ...stArm,
      pass: stArm.card101.rows === 2
        && stArm.card101.moreRest === 1
        && stArm.card101.types[0] === 'x_verify'
        && stArm.card101.types[1] === 'survey'
        && stArm.card101.badges[0] === 'X 验证'
        && stArm.card101.badges[1] === '问卷'
        && stArm.card101.titles[0] === '把本次活动的推广长图转发到个人主页并截图回传（要求附上完整链接与时间戳）'
        && stArm.card101.titles[1] === '填写问卷'
        && stArm.card101.requireds[0] === true
        && stArm.card101.requireds[1] === false
        && stArm.card102.rows === 1
        && stArm.card102.moreRest === null
        && stArm.card102.badges[0] === '链上快照'
        && stArm.card102.requireds[0] === true
        && stArm.card103.block === false
        && stArm.card103.rows === 0
        && stArm.rowsCappedAtTwo
        && stArm.truncatedFirst
        && stArm.zeroInnerOverflow
        && stArm.equalHeights
        && stArm.pageErrors.length === 0,
    }

    // ② 点卡进 `/task/:id`
    let clickArm = { clicked: false }
    if (listArm.cardCount > 0) {
      await page.click('[data-sf-m="task-list-grid"] [data-sf-m="home-camp-card"]')
      await page.waitForSelector('[data-sf-m="task-page"]', { timeout: 8000 }).catch(() => {})
      await settle(page)
      const afterClick = await page.evaluate(SNAP_FN)
      out.states[`${label}_task_after_click`] = afterClick
      clickArm = {
        clicked: true,
        pathname: afterClick.pathname,
        taskHook: afterClick.hooks.taskPage === true,
        taskIdEcho: afterClick.hooks.taskPageTask === String(LIST_ROWS[0].task_id),
        titleEcho: afterClick.hooks.taskTitle === LIST_ROWS[0].title,
        notNotFound: afterClick.hooks.notFound === false,
        // 落点必须是任务页而不是活动页
        notCampaignPath: !afterClick.pathname.startsWith('/campaign/'),
      }
    }
    out.assertions[`cardClickOpensTaskPage_${label}`] = {
      ...clickArm,
      pass: clickArm.clicked === true
        && clickArm.pathname === `/task/${LIST_ROWS[0].task_id}`
        && clickArm.taskHook === true
        && clickArm.taskIdEcho === true
        && clickArm.titleEcho === true
        && clickArm.notNotFound === true
        && clickArm.notCampaignPath === true,
    }

    // ③ 旧 job 面（`/task/new` · `/bounty/1`）落 404
    STATE.calls.length = 0
    const newSnap = await open(page, '/task/new', '[data-sf-m="not-found-page"]')
    const newCalls = STATE.calls.map((c) => c.path)
    const bountySnap = await open(page, '/bounty/1', '[data-sf-m="not-found-page"]')
    out.states[`${label}_task_new`] = newSnap
    out.states[`${label}_bounty`] = bountySnap
    const goneArm = {
      taskNewNotFound: newSnap.hooks.notFound === true,
      taskNewNoPublishForm: newSnap.hooks.jobsFormWrap === false && newSnap.hooks.listGrid === false,
      // 非数字号闸：`/task/new` 不得向后端要一个不存在的任务
      taskNewNoDetailFetch: newCalls.every((p) => !p.startsWith('/api/campaign/task/')),
      bountyNotFound: bountySnap.hooks.notFound === true,
      bountyNoJobPage: bountySnap.hooks.jobsDetail === false,
    }
    out.assertions[`legacyJobRoutesNotFound_${label}`] = {
      ...goneArm,
      taskNewCalls: newCalls,
      pass: Object.values(goneArm).every(Boolean),
    }

    // ④ 溢出 / pageerror / 旧读口零命中（本档所有页面一起判）
    const snaps = [listSnap, newSnap, bountySnap]
    if (out.states[`${label}_task_after_click`]) snaps.push(out.states[`${label}_task_after_click`])
    const allPaths = STATE.calls.map((c) => c.path)
    const legacyHits = allPaths.filter((p) => p === '/api/task/all')
    const overflowArm = {
      overflowPx: snaps.map((s) => s.overflowPx),
      offenders: snaps.flatMap((s) => s.offenders),
      scrollContained: snaps.map((s) => s.scrollContained),
      zeroOverflow: snaps.every((s) => s.overflowPx === 0 && s.offenders.length === 0),
      pageErrors,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      zeroPageError: pageErrors.length === 0,
      legacyTaskAllHits: legacyHits.length,
      zeroLegacyTaskAll: legacyHits.length === 0,
    }
    out.assertions[`noOverflowNoPageError_${label}`] = {
      ...overflowArm,
      pass: overflowArm.zeroOverflow && overflowArm.zeroPageError && overflowArm.zeroLegacyTaskAll,
    }

    // ⑥ 首页「热门任务」卡零回归：同一读口行带 `subtasks` ⇒ 首页卡**不渲染**子任务区
    STATE.calls.length = 0
    const homeSnap = await open(page, '/', '[data-sf-m="home-camp-grid"]')
    out.states[`${label}_home`] = homeSnap
    const homeCards = homeSnap.cards
    const homeArm = {
      grid: homeSnap.hooks.listGrid === true || !!homeCards.length,
      cardCount: homeCards.length,
      cardsWithSubtaskBlock: homeCards.filter((c) => c.subtaskBlock).length,
      zeroSubtaskRows: homeCards.every((c) => c.subtaskCount === 0),
      pageErrors,
    }
    out.assertions[`homeCardNoSubtaskBlock_${label}`] = {
      ...homeArm,
      // 卡数是读数不作判据（首页行集走可见性谓词）；判据 = 有卡时全部零子任务区
      pass: homeCards.length > 0
        && homeArm.cardsWithSubtaskBlock === 0
        && homeArm.zeroSubtaskRows
        && homeArm.pageErrors.length === 0,
    }
    await page.context().close()
  }

  await browser.close()

  const a = out.assertions
  const passOf = (obj) => obj?.pass === true
  out.summary = {
    taskListRendersCampaignCards: passOf(a.taskListRendersCampaignCards_1536) && passOf(a.taskListRendersCampaignCards_390),
    cardClickOpensTaskPage: passOf(a.cardClickOpensTaskPage_1536) && passOf(a.cardClickOpensTaskPage_390),
    legacyJobRoutesNotFound: passOf(a.legacyJobRoutesNotFound_1536) && passOf(a.legacyJobRoutesNotFound_390),
    noOverflowNoPageError: passOf(a.noOverflowNoPageError_1536) && passOf(a.noOverflowNoPageError_390),
    taskCardSubtaskRows: passOf(a.taskCardSubtaskRows_1536) && passOf(a.taskCardSubtaskRows_390),
    homeCardNoSubtaskBlock: passOf(a.homeCardNoSubtaskBlock_1536) && passOf(a.homeCardNoSubtaskBlock_390),
  }
  out.summaryAll = Object.values(out.summary).every(Boolean)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out.summary, null, 2))
  console.log(`[PROBE] ${OUT}  negArm=${NEG}  all=${out.summaryAll}`)
  // 负控臂：① 必须转红（其余项仍应常绿）；正臂：全绿
  process.exit(NEG ? (out.summary.taskListRendersCampaignCards ? 1 : 0) : (out.summaryAll ? 0 : 1))
}

run().catch((e) => { console.error(e); process.exit(2) })
