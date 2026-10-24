/**
 * HOME-CAMP-v2 真浏览器读数（2026-10-21 · 首页【热门任务】去 mock 收尾）
 * ---------------------------------------------------------------------------
 * 后端口径**未提交前**本探针自给数据面（`context.route` 夹具）＋自带静态服务
 * （`frontend/dist`）⇒ 零后端依赖、零写库、可重复。
 *
 * 本版**替换**旧判据（`mock_cards` / `mock_not_clickable` / `exactly_five_cards`
 * 三条已整块删除 —— 去 mock 后「恰 5 卡」「mock 卡不可点」都是死判据）。
 * 四臂：
 *   ① rowcount —— 卡数 = 读口**可见行数**（`status==='active'`）且 ≤5；**不补位**：
 *      夹具 5 可见行 ⇒ 5 卡，夹具 3 可见行 ⇒ 3 卡（旧的「恒 5 张」口径已废）；
 *      另验：非 active 行不上卡、「第一轮」置首、卡 → `/task/<task_id>`、旧 jobs 面零请求；
 *   ② empty —— 读口 0 行 ⇒ 版块空态（`home-camp-empty`）∧ 零卡 ∧ 无 grid ⇒ **零假卡**；
 *   ③ parity —— 加 `/api/campaign/all` 夹具并**访问 `/campaign`**，与首页卡逐行对拍
 *      `task_id` / 标题 / 金额（三列全部相等、集合相等；ended 行两面都不出现）；
 *   ④ viewports —— 390 / 1536 两档：零横向溢出 + pageerror/console error/window error 全 0。
 *
 * 夹具（`HOME_ROWS` 6 行 + 一份与之一致的 `CAMPAIGN_ALL`）：
 *   · 5 行 active（含「第一轮」，位于第 2 行 ⇒ 验置首）+ 1 行 ended（101…106）；
 *   · 第 1 行 `project_avatar_url` 在场（圆形 <img>）；「第一轮」缺席（首字兜底 + tone）；
 *   · `/campaign` 侧：4 个 active 活动，嵌套任务与首页读口**逐字同源**（含那 1 行 ended）。
 *
 * 用法：cd frontend && npm run build && node ops/home/qa/probe-home-campaign.mjs
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const DIST = path.join(REPO, 'frontend/dist')
const OUT_DIR = path.join(REPO, 'ops/home/qa/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })

const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 5790
const BASE = `http://127.0.0.1:${PORT}`

const VP_WIDE = { name: 'vp1536', w: 1536, h: 960 }
const VP_MOBILE = { name: 'vp390', w: 390, h: 844 }

// ── 静态服务（SPA 回退 index.html）────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, BASE).pathname)
    let filePath = path.join(DIST, urlPath)
    if (!filePath.startsWith(DIST)) { res.writeHead(403).end(); return }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (path.extname(urlPath)) { res.writeHead(404).end('not found'); return }
      filePath = path.join(DIST, 'index.html')
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
  server.listen(PORT, '127.0.0.1', () => resolve(server))
})

// ── 夹具：首页读口行（`GET /api/home/campaign-tasks`）─────────────────────────
// 可见行 = status==='active' ⇒ 101/102/103/104/105 共 5 行；106 为 ended（两面都不该出现）。
const HOME_ROWS = [
  {
    task_id: 101, campaign_id: 511, title: '预热任务甲', status: 'active',
    joined_count: 5, joined_target: 50,
    reward_amount_primary: '8', reward_amount_secondary: null, reward_cid_secondary: null,
    campaign_title: '暖场活动', project_title: '星链楼市', project_slug: 'xinglian',
    project_avatar_url: '/api/media/probe-project-a.png',
  },
  {
    // ★ 第 2 行才是「第一轮」⇒ 验主卡置首；头像 url 缺席 ⇒ 首字兜底臂
    task_id: 102, campaign_id: 510, title: '第一轮', status: 'active',
    joined_count: 66, joined_target: 300,
    reward_amount_primary: '15', reward_amount_secondary: '40', reward_cid_secondary: 2,
    campaign_title: '冬季主活动', project_title: '深海流动性', project_slug: 'shenhai',
    project_avatar_url: '',
  },
  {
    task_id: 103, campaign_id: 512, title: '收尾任务丙', status: 'active',
    joined_count: 9, joined_target: 90,
    reward_amount_primary: '3', reward_amount_secondary: null, reward_cid_secondary: null,
    campaign_title: '收官活动', project_title: '云上集市', project_slug: 'yunshang',
    project_avatar_url: '',
  },
  {
    task_id: 104, campaign_id: 513, title: '加场任务丁', status: 'active',
    joined_count: 12, joined_target: 120,
    reward_amount_primary: '4', reward_amount_secondary: null, reward_cid_secondary: null,
    campaign_title: '加场活动', project_title: '喵喵矿场', project_slug: 'miaomiao',
    project_avatar_url: '',
  },
  {
    task_id: 105, campaign_id: 513, title: '补充任务戊', status: 'active',
    joined_count: 7, joined_target: 70,
    reward_amount_primary: '5', reward_amount_secondary: null, reward_cid_secondary: null,
    campaign_title: '加场活动', project_title: '喵喵矿场', project_slug: 'miaomiao',
    project_avatar_url: '',
  },
  {
    // ★ 非 active ⇒ 唯一谓词必须挡掉（首页与 /campaign 两面都不得出现）
    task_id: 106, campaign_id: 512, title: '已截止任务己', status: 'ended',
    joined_count: 30, joined_target: 30,
    reward_amount_primary: '6', reward_amount_secondary: null, reward_cid_secondary: null,
    campaign_title: '收官活动', project_title: '云上集市', project_slug: 'yunshang',
    project_avatar_url: '',
  },
]

/** 夹具「3 可见行」案（验**不补位**：3 行 ⇒ 3 卡，不是 5 张）。 */
const HOME_ROWS_THREE = [HOME_ROWS[0], HOME_ROWS[1], HOME_ROWS[3], HOME_ROWS[5]]

// ── 夹具：活动列表（`GET /api/campaign/all`）—— 与 HOME_ROWS 同源 ──────────────
const taskOf = (id) => {
  const row = HOME_ROWS.find((r) => r.task_id === id)
  return {
    task_id: row.task_id, campaign_id: row.campaign_id, title: row.title, status: row.status,
    reward_amount_primary: row.reward_amount_primary,
    reward_amount_secondary: row.reward_amount_secondary,
    reward_cid_secondary: row.reward_cid_secondary,
    subtasks: [],
  }
}
const CAMPAIGN_ALL = [
  {
    campaign_id: 510, title: '冬季主活动', status: 'active',
    description: '冬季主活动简述', time_start: '2026-10-01T00:00:00Z', time_end: '2026-12-31T00:00:00Z',
    tasks: [taskOf(102)],
  },
  {
    campaign_id: 511, title: '暖场活动', status: 'active',
    description: '暖场活动简述', tasks: [taskOf(101)],
  },
  {
    campaign_id: 512, title: '收官活动', status: 'active',
    description: '收官活动简述', tasks: [taskOf(103), taskOf(106)],
  },
  {
    campaign_id: 513, title: '加场活动', status: 'active',
    description: '加场活动简述', tasks: [taskOf(104), taskOf(105)],
  },
]

const PRIZE_ROWS = [
  { bID: 9001, name: '探针商品', description: '探针描述', points: 120, stores_count: 3, claims_count: 0, media_urls: [] },
]

// 1×1 透明 PNG（头像图臂的请求不能 404 —— 否则网络失败会污染 console error 计数）
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const ERR_HOOKS = `
  window.__sfErrors = [];
  window.addEventListener('error', (e) => window.__sfErrors.push('error: ' + (e.message || String(e.error))));
  window.addEventListener('unhandledrejection', (e) => window.__sfErrors.push('rejection: ' + String((e.reason && e.reason.message) || e.reason)));
`

const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'ok', data }) })

/** 路由夹具。★ 注册顺序 = 逆优先级（Playwright 后注册者先匹配）⇒ 兜底口先注册。 */
async function routeFixtures(context, { homeRows, campaignAll = CAMPAIGN_ALL }) {
  await context.route('**/api/**', (route) => route.fulfill(ok([])))
  await context.route('**/api/home/campaign-tasks', (route) => route.fulfill(ok(homeRows)))
  await context.route('**/api/campaign/all', (route) => route.fulfill(ok(campaignAll)))
  await context.route('**/api/currencies', (route) => route.fulfill(ok([
    { cid: 1, symbol: '$', name: 'USD' }, { cid: 2, symbol: 'batt', name: 'BATT' },
  ])))
  await context.route('**/api/media/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }))
  await context.route('**/api/prize/all*', (route) => route.fulfill(ok(PRIZE_ROWS)))
  await context.route('**/api/home?*', (route) => route.fulfill(ok({
    tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0,
  })))
  // 旧 jobs 悬赏口：**故意可应答**（[]）—— 若前端仍请求即被 oldApiHits 记到，不靠 404 掩盖
  await context.route('**/api/task/all*', (route) => route.fulfill(ok([])))
}

/** 开一臂：独立 context（viewport + 夹具）→ 访问 → 读数 → 收错误。 */
async function withPage(browser, vp, fixtures, { path: visitPath, waitFor }, read) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    reducedMotion: 'reduce',
  })
  const apiRequests = []
  const oldApiHits = []
  context.on('request', (req) => {
    const url = req.url()
    if (!url.includes('/api/')) return
    const rel = url.replace(BASE, '')
    apiRequests.push(rel)
    if (/\/api\/task\/all/.test(url) || /task_limit/.test(url)) oldApiHits.push(rel)
  })
  await routeFixtures(context, fixtures)

  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  await page.addInitScript(ERR_HOOKS)

  await page.goto(`${BASE}${visitPath}`, { waitUntil: 'domcontentloaded' })
  if (waitFor) {
    await page.waitForFunction((sel) => Boolean(document.querySelector(sel)), waitFor, { timeout: 20000 })
  }
  await page.waitForTimeout(500)

  const reading = await read(page)
  const winErrors = await page.evaluate(() => window.__sfErrors || [])
  await context.close()
  return { reading, pageErrors, consoleErrors, winErrors, apiRequests, oldApiHits }
}

// ── 页面读数 ────────────────────────────────────────────────────────────────
const readHome = (page) => page.evaluate(() => {
  const grid = document.querySelector('[data-sf-m="home-camp-grid"]')
  const empty = document.querySelector('[data-sf-m="home-camp-empty"]')
  const cards = [...document.querySelectorAll('[data-sf-m="home-camp-card"]')]
  const avatars = cards.map((card) => {
    const avatar = card.querySelector('[data-sf-m="home-camp-avatar"]')
    return {
      tone: avatar ? avatar.getAttribute('data-sf-tone') : null,
      has_img: avatar ? Boolean(avatar.querySelector('img')) : false,
      initial: avatar ? (avatar.querySelector('.sf-home-camp-avatar-initial')?.textContent || null) : null,
    }
  })
  return {
    card_count: cards.length,
    grid_present: Boolean(grid),
    empty_present: Boolean(empty),
    empty_text: empty ? (empty.textContent || '').replace(/\s+/g, ' ').trim() : null,
    empty_title: empty?.querySelector('p:first-child')?.textContent?.trim() ?? null,
    empty_hint: empty?.querySelector('p:last-child')?.textContent?.trim() ?? null,
    section_heading: (document.querySelector('[data-sf-m="home-camp"] h2')?.textContent || '').trim(),
    // ★ 2026-10-24（Kevin）：【热门任务】右上入口读数（文案 / 变体类 / 链接 / 计算色）
    viewall: (() => {
      const btn = document.querySelector('[data-sf-m="home-viewall"]')
      if (!btn) return null
      const cs = getComputedStyle(btn)
      return {
        text: (btn.textContent || '').trim(),
        class: btn.className,
        href: btn.closest('a')?.getAttribute('href') ?? null,
        bg: cs.backgroundColor,
        color: cs.color,
        box_shadow: cs.boxShadow,
      }
    })(),
    card_class_count: document.querySelectorAll('.sf-home-camp-card').length,
    rows: cards.map((card, index) => ({
      task_id: card.getAttribute('data-sf-task'),
      title: (card.querySelector('[data-sf-m="home-camp-title"]')?.textContent || '').trim(),
      amount: card.querySelector('[data-sf-m="home-camp-reward"] [data-sf-amount]')?.getAttribute('data-sf-amount') ?? null,
      main: card.getAttribute('data-sf-camp-main') === '1',
      href: card.getAttribute('href'),
      tag: card.tagName,
      avatar: avatars[index],
      text: (card.textContent || '').replace(/\s+/g, ' ').trim(),
    })),
    doc: {
      client_width: document.documentElement.clientWidth,
      scroll_width: document.documentElement.scrollWidth,
      inner_width: window.innerWidth,
    },
  }
})

const readCampaign = (page) => page.evaluate(() => {
  const items = [...document.querySelectorAll('[data-sf-m="campaign-card-task-item"]')]
  const links = [...document.querySelectorAll('[data-sf-m="campaign-card-task"]')]
  return {
    item_count: items.length,
    rows: links.map((link) => {
      const li = link.closest('li')
      return {
        task_id: link.getAttribute('data-sf-task'),
        title: (link.querySelector('[data-sf-m="campaign-card-task-title"]')?.textContent || '').trim(),
        amount: li?.querySelector('[data-sf-m="campaign-card-task-reward"]')?.getAttribute('data-sf-amount') ?? null,
        status: link.getAttribute('data-sf-state'),
      }
    }),
    campaign_count: document.querySelectorAll('[data-sf-m="campaign-card"]').length,
  }
})

// ── 臂 ──────────────────────────────────────────────────────────────────────
const visibleOf = (rows) => rows.filter((row) => row.status === 'active').slice(0, 5)

/** 口径预言（探针侧独立实现）：可见行 ⇒ 「第一轮」置首、其余保持相对顺序、最多 5 张。 */
const expectedOrderOf = (rows) => {
  const visible = visibleOf(rows)
  const mainIndex = visible.findIndex((row) => String(row.title).trim() === '第一轮')
  const ordered = mainIndex > 0
    ? [visible[mainIndex], ...visible.filter((_, index) => index !== mainIndex)]
    : visible
  return ordered.map((row) => String(row.task_id))
}

async function armRowcount(browser) {
  const expectedIds = expectedOrderOf(HOME_ROWS)
  const wide = await withPage(browser, VP_WIDE, { homeRows: HOME_ROWS },
    { path: '/', waitFor: '[data-sf-m="home-camp-card"]' }, readHome)
  const three = await withPage(browser, VP_WIDE, { homeRows: HOME_ROWS_THREE },
    { path: '/', waitFor: '[data-sf-m="home-camp-card"]' }, readHome)

  const rows = wide.reading.rows
  const readIds = rows.map((row) => row.task_id)
  const main = rows.find((row) => row.main) || null
  const tone = Number(main?.avatar?.tone)

  const judgement = {
    // ① 卡数 = 可见行数（≤5），逐 task_id 同序（「第一轮」置首）
    cards_equal_visible_rows: wide.reading.card_count === expectedIds.length && wide.reading.card_count <= 5,
    card_ids_match_visible_rows: JSON.stringify(readIds) === JSON.stringify(expectedIds),
    main_card_first: Boolean(main) && rows[0]?.main === true && main.title === '第一轮',
    main_card_links_task: main?.href === '/task/102',
    card_links_task_page: rows.every((row) => row.href === `/task/${row.task_id}`),
    // 非 active 行不得上卡（ended 106 缺席）
    ended_row_excluded: !readIds.includes('106') && !wide.reading.rows.some((row) => row.text.includes('已截止任务己')),
    // 零假卡：每张卡都落在期望可见集内，且真带读口字段（标题 + 金额），无占位卡
    no_fake_cards: rows.every((row) => expectedIds.includes(row.task_id))
      && rows.every((row) => Boolean(row.title) && row.amount !== null && row.amount !== ''),
    // 不补位：3 可见行 ⇒ 3 卡（不是 5）
    no_padding_below_five: three.reading.card_count === 3
      && JSON.stringify(three.reading.rows.map((row) => row.task_id)) === JSON.stringify(expectedOrderOf(HOME_ROWS_THREE)),
    // 主卡走首字兜底（无 <img> + initial + tone 1..10）；其余含真图行（圆形 <img>）
    avatar_two_forms: Boolean(rows.find((row) => row.avatar?.has_img))
      && main?.avatar?.has_img === false
      && Boolean(main?.avatar?.initial)
      && tone >= 1 && tone <= 10,
    old_jobs_api_hits_zero: wide.oldApiHits.length === 0 && three.oldApiHits.length === 0,
    pageerror_zero: wide.pageErrors.length === 0 && three.pageErrors.length === 0,
    window_error_zero: wide.winErrors.length === 0 && three.winErrors.length === 0,
    // ⑤ ★ 2026-10-24（Kevin）：【热门任务】右上入口 = 文案「全部悬赏」+ 弱化 ghost（非 proceed 蓝底）+ 仍指 /campaign
    viewall_present: Boolean(wide.reading.viewall),
    viewall_text_is_all_bounties: wide.reading.viewall?.text === '全部悬赏',
    viewall_wears_ghost: Boolean(wide.reading.viewall?.class?.split(/\s+/).includes('btn-ghost')),
    viewall_not_proceed: Boolean(wide.reading.viewall)
      && !wide.reading.viewall.class.split(/\s+/).includes('btn-proceed'),
    // 弱化「不再蓝底」的**计算值**取证（proceed 蓝 = --tone-blue #3b82f6 ⇒ rgb(59, 130, 246)）
    viewall_bg_is_ghost_white: /^rgba\(255,\s*255,\s*255,\s*0\.55\)$/.test(wide.reading.viewall?.bg || ''),
    viewall_bg_not_blue: !/59,\s*130,\s*246/.test(wide.reading.viewall?.bg || ''),
    viewall_href_campaign: wide.reading.viewall?.href === '/campaign',
  }
  return {
    arm: 'rowcount',
    viewport: VP_WIDE.name,
    fixture: { rows: HOME_ROWS.length, visible: expectedIds.length, three_rows_visible: visibleOf(HOME_ROWS_THREE).length },
    expected_ids: expectedIds,
    reading: { five_rows: wide.reading, three_rows: three.reading },
    old_jobs_api_hits: wide.oldApiHits,
    pageerror: wide.pageErrors,
    console_errors: wide.consoleErrors,
    window_errors: wide.winErrors,
    judgement,
  }
}

async function armEmpty(browser) {
  const arm = await withPage(browser, VP_WIDE, { homeRows: [] },
    { path: '/', waitFor: '[data-sf-m="home-camp-empty"]' }, readHome)
  const judgement = {
    zero_cards: arm.reading.card_count === 0,
    no_grid: arm.reading.grid_present === false,
    // 空态两根文案 = 既有 i18n 键 `taskPage.emptyAvailable/Hint`（zh 档字面，零新增键）
    empty_state_shown: arm.reading.empty_present === true
      && arm.reading.empty_title === '暂无可用悬赏'
      && arm.reading.empty_hint === '请稍后再来查看',
    // 零假卡：任何「卡形状」元素（`.sf-home-camp-card`，含无钩子占位）都不得出现
    no_fake_cards: arm.reading.card_class_count === 0,
    // 版块本身仍在（标题在位），只是卡区走空态
    section_present: arm.reading.section_heading.length > 0,
    pageerror_zero: arm.pageErrors.length === 0,
    window_error_zero: arm.winErrors.length === 0,
  }
  return {
    arm: 'empty',
    viewport: VP_WIDE.name,
    reading: arm.reading,
    api_requests: [...new Set(arm.apiRequests)],
    pageerror: arm.pageErrors,
    console_errors: arm.consoleErrors,
    window_errors: arm.winErrors,
    judgement,
  }
}

async function armParity(browser) {
  const home = await withPage(browser, VP_WIDE, { homeRows: HOME_ROWS },
    { path: '/', waitFor: '[data-sf-m="home-camp-card"]' }, readHome)
  const list = await withPage(browser, VP_WIDE, {},
    { path: '/campaign', waitFor: '[data-sf-m="campaign-list"]' }, readCampaign)

  const homeRows = home.reading.rows.map((row) => ({ task_id: row.task_id, title: row.title, amount: row.amount }))
  const listRows = list.reading.rows.map((row) => ({ task_id: row.task_id, title: row.title, amount: row.amount }))
  const listMap = new Map(listRows.map((row) => [row.task_id, row]))
  const homeIds = homeRows.map((row) => row.task_id).sort()
  const listIds = listRows.map((row) => row.task_id).sort()

  const mismatches = homeRows
    .filter((row) => {
      const peer = listMap.get(row.task_id)
      return !peer || peer.title !== row.title || String(peer.amount) !== String(row.amount)
    })
    .map((row) => ({ home: row, campaign: listMap.get(row.task_id) ?? null }))

  const judgement = {
    // ③ 同一批任务：两个面的 task_id 集合逐字相等
    same_task_id_set: JSON.stringify(homeIds) === JSON.stringify(listIds),
    // 逐行对拍：标题 + 金额
    same_titles: mismatches.length === 0 || mismatches.every((m) => m.campaign && m.campaign.title === m.home.title),
    same_amounts: mismatches.every((m) => m.campaign && String(m.campaign.amount) === String(m.home.amount)),
    all_rows_matched: mismatches.length === 0 && homeRows.length > 0,
    // 非 active 行两面都不出现
    ended_row_absent_both: !homeIds.includes('106') && !listIds.includes('106'),
    campaign_items_all_linked: list.reading.item_count === list.reading.rows.length,
  }
  return {
    arm: 'parity',
    viewport: VP_WIDE.name,
    home: { count: homeRows.length, rows: homeRows },
    campaign: { count: listRows.length, campaign_count: list.reading.campaign_count, rows: listRows },
    mismatches,
    judgement,
  }
}

async function armViewports(browser) {
  const cases = []
  for (const vp of [VP_MOBILE, VP_WIDE]) {
    const run = await withPage(browser, vp, { homeRows: HOME_ROWS },
      { path: '/', waitFor: '[data-sf-m="home-camp-card"]' }, readHome)
    const d = run.reading.doc
    const noOverflow = d.scroll_width <= d.client_width + 1 && d.scroll_width <= d.inner_width + 1
    cases.push({
      viewport: vp.name,
      width: vp.w,
      doc: d,
      cards: run.reading.card_count,
      no_page_overflow: noOverflow,
      pageerror: run.pageErrors,
      console_errors: run.consoleErrors,
      window_errors: run.winErrors,
    })
  }
  const judgement = {
    no_page_overflow_both: cases.every((c) => c.no_page_overflow),
    cards_equal_five_both: cases.every((c) => c.cards === 5),
    pageerror_zero_both: cases.every((c) => c.pageerror.length === 0),
    console_error_zero_both: cases.every((c) => c.console_errors.length === 0),
    window_error_zero_both: cases.every((c) => c.window_errors.length === 0),
  }
  return { arm: 'viewports', cases, judgement }
}

;(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`dist missing: ${DIST} (run cd frontend && npm run build first)`)
  }
  const server = await serve()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = {
    at: new Date().toISOString(),
    spec: 'HOME-CAMP-v2 · 去 mock 四臂（旧 mock_cards / mock_not_clickable / exactly_five_cards 判据已删除）',
    fixture: {
      home_rows: HOME_ROWS.length,
      home_visible: visibleOf(HOME_ROWS).length,
      home_rows_three_case: visibleOf(HOME_ROWS_THREE).length,
      campaign_rows: CAMPAIGN_ALL.length,
      campaign_active_tasks: CAMPAIGN_ALL.flatMap((c) => c.tasks).filter((t) => t.status === 'active').length,
      viewports: [VP_MOBILE.name, VP_WIDE.name],
    },
    arms: [],
  }
  try {
    results.arms.push(await armRowcount(browser))
    results.arms.push(await armEmpty(browser))
    results.arms.push(await armParity(browser))
    results.arms.push(await armViewports(browser))
  } finally {
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }

  results.judgement_detail = Object.fromEntries(results.arms.map((arm) => [arm.arm, arm.judgement]))
  results.verdict = Object.fromEntries(results.arms.map((arm) => [arm.arm, Object.values(arm.judgement).every(Boolean)]))
  results.all_pass = Object.values(results.verdict).every(Boolean)

  const out = path.join(OUT_DIR, 'probe-home-campaign.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({
    verdict: results.verdict,
    all_pass: results.all_pass,
    detail: results.judgement_detail,
    readings: {
      rowcount: {
        five: results.arms[0].reading.five_rows.card_count,
        three: results.arms[0].reading.three_rows.card_count,
        ids: results.arms[0].reading.five_rows.rows.map((r) => `${r.task_id}:${r.title}:$${r.amount}`),
      },
      empty: {
        cards: results.arms[1].reading.card_count,
        grid: results.arms[1].reading.grid_present,
        text: results.arms[1].reading.empty_text,
      },
      parity: {
        home: results.arms[2].home.rows.map((r) => `${r.task_id}:${r.title}:$${r.amount}`),
        campaign: results.arms[2].campaign.rows.map((r) => `${r.task_id}:${r.title}:$${r.amount}`),
        mismatches: results.arms[2].mismatches,
      },
      viewports: results.arms[3].cases.map((c) => ({
        vp: c.viewport, cards: c.cards, doc: c.doc, overflow: c.no_page_overflow,
        errs: [c.pageerror.length, c.console_errors.length, c.window_errors.length],
      })),
    },
  }, null, 2))
  console.log('READING=' + out)
  if (!results.all_pass) process.exitCode = 2
})().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
