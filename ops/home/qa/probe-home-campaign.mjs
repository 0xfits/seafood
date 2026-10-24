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
async function withPage(browser, vp, fixtures, { path: visitPath, waitFor }, read, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    // ★ T130：默认 `reduce`（历史四臂口径不变）；chip hover 臂必须 `no-preference`，
    //   否则 `.sf-chip` 的 reduced-motion 降级（transform:none）会把「抬升 1px」读成 none。
    reducedMotion: opts.reducedMotion || 'reduce',
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
        border_width: cs.borderTopWidth,
        border_color: cs.borderTopColor,
        transform: cs.transform,
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

// ── HDR-1LINE（2026-10-24 · Kevin）· 版块头部「标题 + 说明」同行读数 ─────────────
/** 两块头部几何：`rect.top` 差（同行判据 ≤2px）+ h2 右缘 < 说明左缘 + 说明字号 14px
 *  + 右侧 chip 不被挤压（chip 左缘必须在两块文字右缘之外）。 */
const readHeaderRows = (page) => page.evaluate(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect()
    const f = (n) => Number(n.toFixed(2))
    return { top: f(r.top), left: f(r.left), right: f(r.right), bottom: f(r.bottom), w: f(r.width), h: f(r.height) }
  }
  const one = (h2Sel, leadSel) => {
    const h2 = document.querySelector(h2Sel)
    const lead = document.querySelector(leadSel)
    if (!h2 || !lead) return null
    const hr = box(h2)
    const lr = box(lead)
    const row = h2.parentElement
    return {
      tag_h2: h2.tagName,
      tag_lead: lead.tagName,
      text_h2: (h2.textContent || '').trim(),
      text_lead: (lead.textContent || '').trim(),
      font_h2: getComputedStyle(h2).fontSize,
      font_lead: getComputedStyle(lead).fontSize,
      line_height_lead: getComputedStyle(lead).lineHeight,
      row_class: (row?.className || '').trim(),
      same_parent: h2.parentElement === lead.parentElement,
      lead_next_sibling: h2.nextElementSibling === lead,
      p_in_row: row ? row.querySelectorAll('p').length : -1,
      h2: hr,
      lead: lr,
      top_delta: Number(Math.abs(hr.top - lr.top).toFixed(2)),
      right_left_ok: hr.right < lr.left,
      dollar_in_lead: [...lead.querySelectorAll('span')].some((s) => (s.textContent || '').trim() === '$'),
    }
  }
  const chip = document.querySelector('[data-sf-m="home-viewall"]')
  // 「换了行也算合规」的保守判读：说明整体落到 h2 下一行（顶 >= h2 底 - 2）
  const wrapped = (r) => Boolean(r) && r.lead.top >= r.h2.bottom - 2
  const camp = one('[data-sf-m="home-camp"] h2', '[data-sf-m="home-camp-lead"]')
  const feat = one('[data-sf-m="home-featured-head"] h2', '[data-sf-m="home-featured-lead"]')
  return {
    camp,
    featured: feat,
    camp_wrapped: wrapped(camp),
    featured_wrapped: wrapped(feat),
    chip: chip ? box(chip) : null,
    doc: {
      client_width: document.documentElement.clientWidth,
      scroll_width: document.documentElement.scrollWidth,
      inner_width: window.innerWidth,
    },
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

// ── T130 · 可点 chip（`.sf-chip`）读数 ──────────────────────────────────────
/** 静态形状/配色（computed，日档默认；主题由页面 localStorage 决定） */
const readChipStatic = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const cs = getComputedStyle(el)
  return {
    tag: el.tagName,
    class: el.className,
    text: (el.textContent || '').trim(),
    href: el.getAttribute('href'),
    display: cs.display,
    align_items: cs.alignItems,
    gap: cs.gap,
    padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    font_size: cs.fontSize,
    line_height: cs.lineHeight,
    border_radius: cs.borderTopLeftRadius,
    bg: cs.backgroundColor,
    border_width: cs.borderTopWidth,
    border_color: cs.borderTopColor,
    color: cs.color,
    transform: cs.transform,
    box_shadow: cs.boxShadow,
  }
}, sel)

/** 真 hover（`page.hover` = 真实鼠标事件，非 forcePseudoState）后读 computed；读完把鼠标移开 */
const readChipHover = async (page, sel) => {
  await page.hover(sel)
  await page.waitForTimeout(260) // 过渡 .15s，留足落定时间
  const v = await page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      transform: cs.transform,
      bg: cs.backgroundColor,
      color: cs.color,
      border_color: cs.borderTopColor,
      box_shadow: cs.boxShadow,
    }
  }, sel)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(260)
  return v
}

/** matrix(1, 0, 0, 1, 0, -1) ⇒ 抬升 1px（也不接受 none / 0） */
const liftsOnePixel = (transform) => /matrix\(\s*1,\s*0,\s*0,\s*1,\s*0,\s*-1\s*\)/.test(String(transform))

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
    // ⑤ ★ 2026-10-24（Kevin · T130 改锚）：【热门任务】右上入口 = 文案「全部悬赏」+ **公共 chip**
    //   （`.sf-chip`：透明底 + 1px 细边框；旧 `btn-ghost` / 半透明白底判据随本单作废 ⇒ 改锚为 chip 口径，
    //   强度不降：仍逐条断言类名在场/退场 + 计算底色 + 细边框 + 链接）
    viewall_present: Boolean(wide.reading.viewall),
    viewall_text_is_all_bounties: wide.reading.viewall?.text === '全部悬赏',
    viewall_wears_chip: Boolean(wide.reading.viewall?.class?.split(/\s+/).includes('sf-chip')),
    viewall_not_ghost: Boolean(wide.reading.viewall)
      && !wide.reading.viewall.class.split(/\s+/).includes('btn-ghost'),
    viewall_not_proceed: Boolean(wide.reading.viewall)
      && !wide.reading.viewall.class.split(/\s+/).includes('btn-proceed'),
    // 「透明底 + 1px 细边框」的**计算值**取证（旧 ghost 白底 / proceed 蓝 rgb(59,130,246) 都不得再出现）
    viewall_bg_transparent: /^rgba\(0,\s*0,\s*0,\s*0\)$/.test(wide.reading.viewall?.bg || ''),
    viewall_border_1px: wide.reading.viewall?.border_width === '1px',
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

// T130 臂：首页两个 feed tab ＋【全部悬赏】入口都是公共 `.sf-chip` —— 形状/配色/选中态/**真 hover 抬升**。
async function armChip(browser) {
  const SEL_VIEWALL = '[data-sf-m="home-viewall"]'
  const SEL_REC = '[data-sf-m="feed-tab-recommend"]'
  const SEL_NEW = '[data-sf-m="feed-tab-new"]'

  const run = await withPage(
    browser, VP_WIDE, { homeRows: HOME_ROWS },
    { path: '/', waitFor: SEL_VIEWALL },
    async (page) => {
      const viewall = await readChipStatic(page, SEL_VIEWALL)
      const tabs = { recommend: await readChipStatic(page, SEL_REC), new: await readChipStatic(page, SEL_NEW) }
      // 静态读数先取完再 hover（hover 会改 transform，不能污染静态读数）
      const viewall_hover = await readChipHover(page, SEL_VIEWALL)
      const tab_hover = {
        recommend: await readChipHover(page, SEL_REC),
        new: await readChipHover(page, SEL_NEW),
      }
      return { viewall, tabs, viewall_hover, tab_hover }
    },
    { reducedMotion: 'no-preference' },
  )

  const r = run.reading
  const v = r.viewall
  const rec = r.tabs.recommend
  const nw = r.tabs.new
  const isChip = (el) => Boolean(el) && String(el.class).split(/\s+/).includes('sf-chip')
  const isActive = (el) => Boolean(el) && String(el.class).split(/\s+/).includes('is-active')
  const transparent = (bg) => String(bg) === 'rgba(0, 0, 0, 0)' || String(bg) === 'transparent'
  const YELLOW_500 = 'rgb(234, 179, 8)' // bg-yellow-500 既有落点（tailwind-compat.css:372）

  const judgement = {
    // ① 入口：`.sf-chip` 命中 ∧ 旧 Button 变体退场
    viewall_is_chip: isChip(v) && !String(v?.class || '').includes('btn-ghost'),
    viewall_href_campaign: v?.href === '/campaign',
    viewall_text: (v?.text || '') === '全部悬赏',
    // ② 形状：text-sm(14px) / px-3 py-1.5 / rounded-md(6px) / inline-flex + 居中
    // display：源码为 `inline-flex`；作为 flex 子项时浏览器 blockify 成 `flex` ⇒ 两者皆合法（仍须 flex 系）
    viewall_geometry: ['inline-flex', 'flex'].includes(v?.display) && v?.align_items === 'center'
      && v?.font_size === '14px' && v?.padding === '6px 12px 6px 12px'
      && v?.border_radius === '6px',
    // ③ 透明底 + 1px 细边框 + 零阴影
    viewall_bg_transparent: transparent(v?.bg),
    viewall_border_1px: v?.border_width === '1px',
    viewall_no_shadow: v?.box_shadow === 'none',
    // ④ 真 hover：抬升 1px，且不变色 / 不变边 / 不加阴影（与 `.btn:hover` 逐字一致）
    viewall_hover_lift: liftsOnePixel(r.viewall_hover?.transform),
    viewall_hover_rest_unchanged: transparent(r.viewall_hover?.bg)
      && r.viewall_hover?.color === v?.color
      && r.viewall_hover?.border_color === v?.border_color
      && r.viewall_hover?.box_shadow === 'none',
    // ⑤ 两 tab：同 popup 形状 ∧ 选中档黄底白字黄边 ∧ 未选档透明
    tabs_both_chip: isChip(rec) && isChip(nw),
    tab_active_yellow: isActive(rec) && rec?.bg === YELLOW_500 && rec?.border_color === YELLOW_500
      && rec?.color === 'rgb(255, 255, 255)',
    tab_inactive_transparent: !isActive(nw) && transparent(nw?.bg) && nw?.border_width === '1px',
    tab_geometry_matches: rec?.font_size === '14px' && nw?.font_size === '14px'
      && rec?.padding === '6px 12px 6px 12px' && nw?.padding === '6px 12px 6px 12px'
      && rec?.border_radius === '6px' && nw?.border_radius === '6px',
    // ⑥ 两 tab 的 hover 也抬升 1px（选中档同样可点 ⇒ 同样反馈）
    tab_hover_lift_both: liftsOnePixel(r.tab_hover?.recommend?.transform)
      && liftsOnePixel(r.tab_hover?.new?.transform),
    tab_hover_no_color_change: r.tab_hover?.recommend?.bg === rec?.bg
      && r.tab_hover?.new?.bg === nw?.bg,
    no_pageerror: run.pageErrors.length === 0 && run.winErrors.length === 0,
  }

  return {
    arm: 'chip',
    viewport: VP_WIDE.name,
    reduced_motion: 'no-preference',
    reading: r,
    pageerror: run.pageErrors,
    console_errors: run.consoleErrors,
    judgement,
  }
}

// ── HDR-1LINE 臂：两块头部「标题 + 说明」同一行（1536 必同行；390 允许换行但零横向溢出）──
async function armHeader(browser) {
  const wide = await withPage(browser, VP_WIDE, { homeRows: HOME_ROWS },
    { path: '/', waitFor: '[data-sf-m="home-camp-lead"]' }, readHeaderRows)
  const mobile = await withPage(browser, VP_MOBILE, { homeRows: HOME_ROWS },
    { path: '/', waitFor: '[data-sf-m="home-camp-lead"]' }, readHeaderRows)

  const w = wide.reading
  const m = mobile.reading
  const sameLine = (r) => Boolean(r) && r.top_delta <= 2 && r.right_left_ok
  const blockedOrWrapped = (r, wrapped) => sameLine(r) || (Boolean(r) && wrapped === true)
  const block = (r) => (r ? {
    h2_text: r.text_h2,
    lead_text: r.text_lead,
    lead_tag: r.tag_lead,
    lead_font: r.font_lead,
    top_delta: r.top_delta,
    h2_right: r.h2.right,
    lead_left: r.lead.left,
    same_line: sameLine(r),
  } : null)

  const chip = w.chip
  const textRight = Math.max(w.camp?.lead.right ?? 0, w.featured?.lead.right ?? 0, w.camp?.h2.right ?? 0)

  const judgement = {
    // ① 两块都在场，h2 / 说明**文案不变**（zh 档字面；文案改动 ⇒ 本判据红）
    both_h2_text: w.camp?.text_h2 === '热门任务' && w.featured?.text_h2 === '精选奖励',
    both_lead_text: w.camp?.text_lead === '参与任务赚取$' && w.featured?.text_lead === '用$兑换精彩礼品',
    // ② 说明 = `<span>` + 14px（原 16px 的块级 <p> 已退场）；`$` 仍在说明内
    lead_is_span_both: w.camp?.tag_lead === 'SPAN' && w.featured?.tag_lead === 'SPAN',
    lead_font_14_both: w.camp?.font_lead === '14px' && w.featured?.font_lead === '14px',
    no_p_in_rows: w.camp?.p_in_row === 0 && w.featured?.p_in_row === 0,
    dollar_in_lead_both: w.camp?.dollar_in_lead === true && w.featured?.dollar_in_lead === true,
    // ③ 同一行（1536）：h2 与说明 rect.top 差 ≤2px **且** h2 右缘 < 说明左缘
    camp_same_line: sameLine(w.camp),
    featured_same_line: sameLine(w.featured),
    both_same_line: sameLine(w.camp) && sameLine(w.featured),
    top_delta_within_2px: (w.camp?.top_delta ?? 99) <= 2 && (w.featured?.top_delta ?? 99) <= 2,
    // ④ 右侧 chip 未被挤压（仍在文字右缘之外，且宽度 > 0）
    chip_not_squeezed: Boolean(chip) && chip.w > 0 && chip.left >= textRight,
    // ⑤ 390 档：允许换行，但不得横向溢出、不得文字互相压盖；两块头部不得溢出视口
    mobile_no_overflow: m.doc.scroll_width <= m.doc.client_width + 1
      && m.doc.scroll_width <= m.doc.inner_width + 1,
    mobile_rows_legible: blockedOrWrapped(m.camp, m.camp_wrapped) && blockedOrWrapped(m.featured, m.featured_wrapped),
    mobile_lead_within_viewport: (m.camp?.lead.right ?? 0) <= m.doc.client_width + 1
      && (m.featured?.lead.right ?? 0) <= m.doc.client_width + 1,
    mobile_chip_present: Boolean(m.chip),
    pageerror_zero: wide.pageErrors.length === 0 && mobile.pageErrors.length === 0
      && wide.winErrors.length === 0 && mobile.winErrors.length === 0,
  }

  return {
    arm: 'header',
    spec: '两块版块头部 = h2 + 说明并成一行（rect.top 差 ≤2px ∧ h2 右缘 < 说明左缘）；390 允许换行',
    reading: {
      vp1536: { camp: block(w.camp), featured: block(w.featured), chip: w.chip, doc: w.doc },
      vp390: {
        camp: block(m.camp),
        featured: block(m.featured),
        camp_wrapped: m.camp_wrapped,
        featured_wrapped: m.featured_wrapped,
        chip: m.chip,
        doc: m.doc,
      },
    },
    pageerror: [...wide.pageErrors, ...mobile.pageErrors],
    console_errors: [...wide.consoleErrors, ...mobile.consoleErrors],
    judgement,
  }
}

;(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`dist missing: ${DIST} (run cd frontend && npm run build first)`)
  }
  const server = await serve()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = {
    at: new Date().toISOString(),
    spec: 'HOME-CAMP-v2 · 去 mock 四臂 + T130 chip 臂（`.sf-chip` 形状/选中态/真 hover 抬升 1px）',
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
    results.arms.push(await armChip(browser))
    results.arms.push(await armHeader(browser))
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
      header: results.arms[5]?.reading,
    },
  }, null, 2))
  console.log('READING=' + out)
  if (!results.all_pass) process.exitCode = 2
})().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
