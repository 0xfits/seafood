/**
 * 首页【去 animate-fade-in 容器】真浏览器读数（2026-10-21 · Kevin「首页移除容器 animate-fade-in」）
 * ---------------------------------------------------------------------------
 * 静态服务（`frontend/dist`）+ `context.route` 夹具 ⇒ 零后端依赖、零写库、可重复。
 *
 * 判据（四臂 + 断点边长）：
 *   ① 首页 `[class*="animate-fade-in"]` 命中 **0**（hero 与商品卡都不再套 `FadeIn` 的 `<div>`）；
 *   ② 卡几何不回退：卡高 **392** / 图 **240** / 四行 **48 | 32 | 24 | 48**（直落网格子项后）；
 *   ③ 列数与断点行为不变：1536 & 1280 = **6**、1279 & 768 = **4**、767 & 390 = **2**；
 *      且卡宽 = 所在列宽（卡根撑满格宽 ⇒ 不需要额外 `width` 补丁）；
 *   ④ 零横向溢出 + pageerror / console error / window error 全 0。
 *
 * 用法：cd frontend && npm run build && node ops/home/qa/probe-home-no-fadein.mjs
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
const PORT = 5791
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(OUT_DIR, 'probe-home-no-fadein.json')

// 断点边长全覆盖（T121 口径：768–1279 = 4 列、≥1280 = 6 列、≤767 = 2 列）
const VIEWPORTS = [
  { name: 'vp1536', w: 1536, h: 960, expectCols: 6 },
  { name: 'vp1280', w: 1280, h: 900, expectCols: 6 },
  { name: 'vp1279', w: 1279, h: 900, expectCols: 4 },
  { name: 'vp768', w: 768, h: 900, expectCols: 4 },
  { name: 'vp767', w: 767, h: 900, expectCols: 2 },
  { name: 'vp390', w: 390, h: 844, expectCols: 2 },
]

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

// ── 夹具 ────────────────────────────────────────────────────────────────────
// 商品卡：12 行（≥ 两屏网格行，够读列数与卡宽）；标题长短混排（验 min-width:0 不被撑破）。
const mkReward = (i) => ({
  bID: 9000 + i,
  item_code: `PROBE-${9000 + i}`,
  title: i % 3 === 0
    ? `探针商品标题超长文本用于验证直落网格子项后的换行与截断行为第${i}号`
    : `探针商品${i}`,
  description: '探针描述',
  points_required: 100 + i,
  wants: i * 3,
  image: '/api/media/probe-item.png',
  status: 'available',
  item_type: i % 2 === 0 ? 'PhysicalFreeShip' : null,
  seller: { uid: 7, nickname: '0x12**12', avatar: null, credit: 'excellent' },
})
const PRIZE_ROWS = Array.from({ length: 12 }, (_, i) => mkReward(i))

const HOME_ROWS = [
  { task_id: 101, campaign_id: 511, title: '预热任务甲', status: 'active', joined_count: 5, joined_target: 50, reward_amount_primary: '8', campaign_title: '暖场活动', project_title: '星链楼市', project_avatar_url: '' },
  { task_id: 102, campaign_id: 510, title: '第一轮', status: 'active', joined_count: 66, joined_target: 300, reward_amount_primary: '15', reward_amount_secondary: '40', reward_cid_secondary: 2, campaign_title: '冬季主活动', project_title: '深海流动性', project_avatar_url: '' },
]

// 1×1 透明 PNG（商品图请求不得 404，否则污染 console error 计数）
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
async function routeFixtures(context) {
  await context.route('**/api/**', (route) => route.fulfill(ok([])))
  await context.route('**/api/home/campaign-tasks', (route) => route.fulfill(ok(HOME_ROWS)))
  await context.route('**/api/currencies', (route) => route.fulfill(ok([
    { cid: 1, symbol: '$', name: 'USD' }, { cid: 2, symbol: 'batt', name: 'BATT' },
  ])))
  await context.route('**/api/media/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }))
  await context.route('**/api/prize/all*', (route) => route.fulfill(ok(PRIZE_ROWS)))
  await context.route('**/api/prize-item*', (route) => route.fulfill(ok([])))
  await context.route('**/api/user/asset/**', (route) => route.fulfill(ok({ points: 42 })))
  await context.route('**/api/home?*', (route) => route.fulfill(ok({
    tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0,
  })))
}

// ── 页面读数 ────────────────────────────────────────────────────────────────
const readHome = (page) => page.evaluate(() => {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100
  const grid = document.querySelector('[data-sf-m="feed-grid"]')
  const cards = [...document.querySelectorAll('.sf-reward-card')]
  const first = cards[0] || null
  const rowsOf = (card) => ({
    title: card.querySelector('.row1-wrap-title'),
    service: card.querySelector('.row2-wrap-service'),
    price: card.querySelector('.row3-wrap-price'),
    seller: card.querySelector('.row4-wrap-seller'),
  })
  const box = (el) => (el ? { h: px(getComputedStyle(el).height), w: px(getComputedStyle(el).width) } : null)
  const rows = first ? rowsOf(first) : {}
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean) : []

  return {
    // ① 动画容器命中（全页 + 首页列表容器内）
    fade_hits_doc: document.querySelectorAll('[class*="animate-fade-in"]').length,
    fade_hits_home_list: document.querySelectorAll('[data-sf-m="home-item-list"] [class*="animate-fade-in"]').length,
    fade_hits_feed: document.querySelectorAll('[data-sf-m="feed-grid"] [class*="animate-fade-in"]').length,
    slide_up_hits: document.querySelectorAll('[class*="animate-slide-up"]').length,
    // hero 结构与容器链
    hero_first_child_tag: document.querySelector('[data-sf-m="home-item-list"]')?.children[0]?.tagName ?? null,
    feed_grid_parent: grid?.parentElement?.getAttribute('data-sf-m') ?? null,
    feed_grid_parent_tag: grid?.parentElement?.tagName ?? null,
    // ② 卡几何
    card_count: cards.length,
    grid_child_count: grid ? grid.children.length : 0,
    grid_children_all_cards: grid ? [...grid.children].every((n) => n.classList.contains('sf-reward-card')) : false,
    card_h: box(first)?.h ?? null,
    card_w: box(first)?.w ?? null,
    img_h: box(first?.querySelector('.image-container'))?.h ?? null,
    img_w: box(first?.querySelector('.image-container'))?.w ?? null,
    row_title_h: box(rows.title)?.h ?? null,
    row_service_h: box(rows.service)?.h ?? null,
    row_price_h: box(rows.price)?.h ?? null,
    row_seller_h: box(rows.seller)?.h ?? null,
    inner_h: box(first?.querySelector('.sf-reward-inner'))?.h ?? null,
    // ③ 列数
    cols_count: cols.length,
    cols: cols.map(px),
    gap: grid ? px(getComputedStyle(grid).columnGap) : null,
    // 卡宽是否撑满格宽（= 列宽）
    card_w_equals_col: first ? Math.abs(px(getComputedStyle(first).width) - parseFloat(cols[0])) < 0.5 : false,
    // ④ 溢出
    doc_scroll_w: document.documentElement.scrollWidth,
    doc_client_w: document.documentElement.clientWidth,
    overflow_x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
})

async function withPage(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    reducedMotion: 'reduce',
  })
  await routeFixtures(context)

  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  await page.addInitScript(ERR_HOOKS)

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-sf-m="feed-grid"] .sf-reward-card')),
    undefined,
    { timeout: 20000 },
  )
  await page.waitForTimeout(400)

  const reading = await readHome(page)
  const winErrors = await page.evaluate(() => window.__sfErrors || [])
  await context.close()
  return { reading, pageErrors, consoleErrors, winErrors }
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
const server = await serve()
const browser = await chromium.launch({ executablePath: CHROME, headless: true })

const results = {}
const failures = []
try {
  for (const vp of VIEWPORTS) {
    const { reading, pageErrors, consoleErrors, winErrors } = await withPage(browser, vp)
    const r = reading

    const checks = {
      fade_zero: r.fade_hits_doc === 0,
      card_h_392: r.card_h === 392,
      inner_h_392: r.inner_h === 392,
      img_240: r.img_h === 240,
      rows_48_32_24_48: [r.row_title_h, r.row_service_h, r.row_price_h, r.row_seller_h].join('/') === '48/32/24/48',
      cols: r.cols_count === vp.expectCols,
      card_fills_col: r.card_w_equals_col === true,
      grid_children_are_cards: r.grid_children_all_cards === true && r.grid_child_count === r.card_count,
      no_overflow: r.overflow_x <= 0,
      no_errors: pageErrors.length === 0 && consoleErrors.length === 0 && winErrors.length === 0,
    }
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
    if (failed.length) failures.push({ viewport: vp.name, failed, reading: r, pageErrors, consoleErrors, winErrors })

    results[vp.name] = {
      width: vp.w,
      expect_cols: vp.expectCols,
      checks,
      failed,
      reading: r,
      pageErrors,
      consoleErrors,
      winErrors,
    }
    console.log(
      `${vp.name.padEnd(7)} cols=${r.cols_count}/${vp.expectCols} card=${r.card_h}h×${r.card_w}w img=${r.img_h} rows=${r.row_title_h}/${r.row_service_h}/${r.row_price_h}/${r.row_seller_h} fade=${r.fade_hits_doc} ovf=${r.overflow_x} err=${pageErrors.length + consoleErrors.length + winErrors.length} => ${failed.length ? 'FAIL ' + failed.join(',') : 'PASS'}`,
    )
  }
} finally {
  await browser.close()
  server.close()
}

const out = {
  generated_at: new Date().toISOString(),
  base: BASE,
  purpose: '首页去 animate-fade-in 容器：零命中 + 卡几何 392/240/48|32|24|48 + 断点列数 6/4/2 + 零溢出零错误',
  pass: failures.length === 0,
  failures,
  viewports: results,
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`\n${out.pass ? 'ALL PASS' : 'FAILURES: ' + failures.length}  →  ${OUT}`)
process.exit(out.pass ? 0 : 1)
