/**
 * HOME-CAMP-v1 真浏览器读数（2026-10-21 · Kevin 首页【热门任务】前端半）
 * ---------------------------------------------------------------------------
 * 后端并行单尚未提交 ⇒ 本探针**自给全部数据面**（`context.route` 夹具），并自带
 * 静态服务（`frontend/dist`）⇒ 零后端依赖、零写库、可重复。
 *
 * 两档视口（各一臂，同一套夹具）：
 *   vp1536 —— 断言「版块恰 5 卡、五等宽、排满一行（grid 5 轨）」；
 *   vp390  —— 断言「单行横滚（scrollWidth > clientWidth）、页面零横向溢出」。
 *
 * 夹具（4 条真行 + mock 补 1）：
 *   · 第二行才是「第一轮」⇒ 验主卡置首；
 *   · 第 1 行 project_avatar_url 在场（圆形 <img>）；
 *   · 「第一轮」行 project_avatar_url 缺席（首字兜底 + data-sf-tone）。
 *
 * 判据（两档同套）：
 *   ① `[data-sf-m="home-camp-card"]` 恰 5 张且宽差 ≤ 1px；
 *   ② 首卡 `data-sf-camp-main="1"`，含「第一轮」+ 活动名「冬季主活动」+ 项目头像元素；
 *   ③ vp1536 计算样式 display=grid / 5 轨；vp390 display=flex 且横滚；两档页面零横向溢出；
 *      两档 pageerror=0 / console error=0 / window error=0；
 *   ④ 旧 jobs 面零请求：`/api/task/all*` 与任何含 `task_limit` 的 URL 命中 = 0。
 *
 * 用法：node ops/home/qa/probe-home-campaign.mjs
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

const VIEWPORTS = [
  { name: 'vp1536', width: 1536, height: 960 },
  { name: 'vp390', width: 390, height: 844 },
]

// ── 静态服务（SPA 回退 index.html）────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
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

// ── 夹具 ────────────────────────────────────────────────────────────────────
const CAMPAIGN_ROWS = [
  {
    task_id: 101, campaign_id: 511, title: '预热任务甲', status: 'active',
    joined_count: 5, joined_target: 50,
    reward_amount_primary: '8', reward_amount_secondary: null, reward_cid_secondary: null,
    campaign_title: '暖场活动', project_title: '星链楼市', project_slug: 'xinglian',
    project_avatar_url: '/api/media/probe-project-a.png',
  },
  {
    // ★ 第二行才是「第一轮」⇒ 验主卡置首；头像 url 缺席 ⇒ 首字兜底臂
    task_id: 102, campaign_id: 510, title: '第一轮', status: 'active',
    joined_count: 66, joined_target: 300,
    reward_amount_primary: '15', reward_amount_secondary: '40', reward_cid_secondary: 2,
    campaign_title: '冬季主活动', project_title: '深海流动性', project_slug: 'shenhai',
    project_avatar_url: '',
  },
  {
    task_id: 103, campaign_id: 512, title: '收尾任务丙', status: 'ended',
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
]

const PRIZE_ROWS = [
  { bID: 9001, name: '探针商品', description: '探针描述', points: 120, stores_count: 3, claims_count: 0, media_urls: [] },
]

// 1×1 透明 PNG（头像图臂的请求不能 404 —— 否则 network 失败会污染 console error 计数）
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const ERR_HOOKS = `
  window.__sfErrors = [];
  window.addEventListener('error', (e) => window.__sfErrors.push('error: ' + (e.message || String(e.error))));
  window.addEventListener('unhandledrejection', (e) => window.__sfErrors.push('rejection: ' + String((e.reason && e.reason.message) || e.reason)));
`

async function runArm(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'reduce',
  })
  const requests = []
  const oldApiHits = []

  context.on('request', (req) => {
    const url = req.url()
    if (!url.includes('/api/')) return
    requests.push(url.replace(BASE, ''))
    if (/\/api\/task\/all/.test(url) || /task_limit/.test(url)) oldApiHits.push(url.replace(BASE, ''))
  })

  // ★ 路由注册顺序 = 逆优先级（Playwright：**后注册者先匹配**）⇒ 兜底口必须先注册，
  //   具体夹具口随后注册才压得住它（首版写反：兜底口吞掉 campaign-tasks ⇒ 版块全 mock，实测抓到）。
  await context.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'ok', data: [] }),
  }))
  await context.route('**/api/home/campaign-tasks', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'ok', data: CAMPAIGN_ROWS }),
  }))
  await context.route('**/api/currencies', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'ok', data: [{ cid: 1, symbol: '$', name: 'USD' }, { cid: 2, symbol: 'batt', name: 'BATT' }] }),
  }))
  await context.route('**/api/media/**', (route) => route.fulfill({
    status: 200, contentType: 'image/png', body: PNG_1PX,
  }))
  await context.route('**/api/prize/all*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'ok', data: PRIZE_ROWS }),
  }))
  await context.route('**/api/home?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true, message: 'ok',
      data: { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 },
    }),
  }))
  // 旧 jobs 悬赏口：**故意可应答**（[]）—— 若前端仍请求即被 oldApiHits 记到，不靠 404 掩盖
  await context.route('**/api/task/all*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'ok', data: [] }),
  }))

  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  await page.addInitScript(ERR_HOOKS)

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="home-camp-card"]', { timeout: 20000 })
  await page.waitForTimeout(600)

  const read = await page.evaluate(() => {
    const grid = document.querySelector('[data-sf-m="home-camp-grid"]')
    const cards = [...document.querySelectorAll('[data-sf-m="home-camp-card"]')]
    const main = cards.find((card) => card.getAttribute('data-sf-camp-main') === '1') || null
    const rects = cards.map((card) => {
      const r = card.getBoundingClientRect()
      return { x: Math.round(r.x * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }
    })
    const firstCard = cards[0]
    const avatarOf = (card) => card?.querySelector('[data-sf-m="home-camp-avatar"]')
    const mainAvatar = avatarOf(main)
    const secondReal = cards.find((card) => (card.textContent || '').includes('星链楼市')) || null
    const secondAvatar = avatarOf(secondReal)
    const gs = grid ? getComputedStyle(grid) : null
    return {
      card_count: cards.length,
      widths: rects.map((r) => r.w),
      heights: rects.map((r) => r.h),
      first_is_main: firstCard ? firstCard.getAttribute('data-sf-camp-main') === '1' : false,
      main_index: main ? cards.indexOf(main) : -1,
      main_text: main ? (main.textContent || '').replace(/\s+/g, ' ').trim() : '',
      main_href: main ? (main.getAttribute('href') || null) : null,
      main_has_avatar: Boolean(mainAvatar),
      main_avatar_img: mainAvatar ? Boolean(mainAvatar.querySelector('img')) : null,
      main_avatar_initial: mainAvatar ? (mainAvatar.querySelector('.sf-home-camp-avatar-initial')?.textContent || null) : null,
      main_avatar_tone: mainAvatar ? mainAvatar.getAttribute('data-sf-tone') : null,
      img_card_href: secondReal ? (secondReal.getAttribute('href') || null) : null,
      img_card_img_src: secondAvatar?.querySelector('img')?.getAttribute('src') || null,
      mock_cards: cards.filter((card) => card.getAttribute('data-sf-camp-mock') === '1').length,
      mock_clickable: cards.filter((card) => card.getAttribute('data-sf-camp-mock') === '1' && card.tagName === 'A').length,
      grid_display: gs ? gs.display : null,
      grid_tracks: gs ? gs.gridTemplateColumns : null,
      grid_client_width: grid ? grid.clientWidth : null,
      grid_scroll_width: grid ? grid.scrollWidth : null,
      grid_scrolls: grid ? grid.scrollWidth > grid.clientWidth + 2 : null,
      doc_scroll_width: document.documentElement.scrollWidth,
      doc_client_width: document.documentElement.clientWidth,
      inner_width: window.innerWidth,
    }
  })

  const winErrors = await page.evaluate(() => window.__sfErrors || [])
  await context.close()

  const equalWidth = read.widths.length === 5 && (Math.max(...read.widths) - Math.min(...read.widths)) <= 1
  const tracks = read.grid_tracks ? read.grid_tracks.split(' ').filter((part) => /px$/.test(part)) : []
  const fiveColumns = vp.width > 1024
    ? (read.grid_display === 'grid' && tracks.length === 5)
    : (read.grid_display === 'flex' && read.grid_scrolls === true)
  const noPageOverflow = read.doc_scroll_width <= read.doc_client_width + 1 && read.doc_scroll_width <= read.inner_width + 1

  return {
    viewport: `${vp.width}x${vp.height}`,
    cards: read,
    judgement: {
      exactly_five_cards: read.card_count === 5,
      equal_width_cards: equalWidth,
      five_columns_or_scroll: fiveColumns,
      no_page_overflow: noPageOverflow,
      main_card_first: read.first_is_main && read.main_index === 0,
      main_card_labeled: read.main_text.includes('第一轮') && read.main_text.includes('冬季主活动'),
      main_card_avatar: read.main_has_avatar === true,
      avatar_two_forms: Boolean(read.img_card_img_src) && read.main_avatar_img === false
        && Boolean(read.main_avatar_initial) && Number(read.main_avatar_tone) >= 1 && Number(read.main_avatar_tone) <= 10,
      main_card_links_campaign: read.main_href === '/campaign/510',
      mock_not_clickable: read.mock_clickable === 0,
      old_jobs_api_hits_zero: oldApiHits.length === 0,
      pageerror_zero: pageErrors.length === 0,
      console_error_zero: consoleErrors.length === 0,
      window_error_zero: winErrors.length === 0,
    },
    old_jobs_api_hits: oldApiHits,
    api_requests: requests,
    pageerror: pageErrors,
    console_errors: consoleErrors,
    window_errors: winErrors,
  }
}

;(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`dist missing: ${DIST} (run cd frontend && npm run build first)`)
  }
  const server = await serve()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = { at: new Date().toISOString(), fixture: { rows: CAMPAIGN_ROWS.length, viewports: VIEWPORTS.map((v) => v.name) }, arms: [] }
  try {
    for (const vp of VIEWPORTS) results.arms.push(await runArm(browser, vp))
  } finally {
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }

  results.verdict = Object.fromEntries(results.arms.map((arm) => [arm.viewport, Object.values(arm.judgement).every(Boolean)]))
  results.judgement_detail = Object.fromEntries(results.arms.map((arm) => [arm.viewport, arm.judgement]))
  results.all_pass = Object.values(results.verdict).every(Boolean)

  const out = path.join(OUT_DIR, 'probe-home-campaign.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({
    verdict: results.verdict,
    all_pass: results.all_pass,
    detail: results.judgement_detail,
    arms: results.arms.map((arm) => ({
      viewport: arm.viewport,
      cards: arm.cards.card_count,
      widths: arm.cards.widths,
      heights: arm.cards.heights,
      grid: arm.cards.grid_display,
      tracks: arm.cards.grid_tracks,
      scroll: [arm.cards.grid_client_width, arm.cards.grid_scroll_width],
      doc: [arm.cards.doc_client_width, arm.cards.doc_scroll_width],
      main: arm.cards.main_text,
      href: arm.cards.main_href,
      avatar_initial: arm.cards.main_avatar_initial,
      avatar_tone: arm.cards.main_avatar_tone,
      img_src: arm.cards.img_card_img_src,
      old_hits: arm.old_jobs_api_hits,
      errs: [arm.pageerror.length, arm.console_errors.length, arm.window_errors.length],
    })),
  }, null, 2))
  console.log('READING=' + out)
  if (!results.all_pass) process.exitCode = 2
})().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
