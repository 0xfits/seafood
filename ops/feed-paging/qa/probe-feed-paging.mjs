/**
 * FEED-PAGING-v1 真浏览器读数（2026-10-19）
 * ---------------------------------------------------------------------------
 * 两臂，各两档（390×844 / 1440×900）：
 *   ARM A · real   —— 零拦截：真 vite dev(5787) / h5 预览(5800) + 真 dev 后端(5788)。
 *                     验「只列可展示商品」+ 首屏卡数 = listed 实际数（dev listed=9 < 36 ⇒ 终止）。
 *   ARM B · paged  —— 仅拦截 `GET /api/prize/all*`（内存夹具 36/36/10，第 2 页与第 1 页重叠 2 行）：
 *                     验滚动分页 skip 0→36→72、卡数单调递增、bID 去重、终止后加载态/按钮消失。
 *                     **披露**：dev 库 listed 行数 < 36（现取 9）⇒ 真网络下不存在第 2 页，
 *                     分页臂只能以拦截形态取证（其余 /api/home 等仍走真后端）。
 * 判据：卡数 / 请求序列 / 重复 bID / pageerror=0 / console error=0。
 * 用法：node ops/feed-paging/qa/probe-feed-paging.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT_DIR = path.join(REPO, 'ops/feed-paging/qa/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'vp390', width: 390, height: 844, base: 'http://localhost:5800' },   // h5 预览（同源反代 5787）
  { name: 'vp1440', width: 1440, height: 900, base: 'http://localhost:5787' },
]

const prizeRow = (bID) => ({
  bID,
  name: `分页夹具商品 ${bID}`,
  description: '夹具描述',
  points: 1000 + bID,
  price: 1000 + bID,
  stores_count: 2,
  claims_count: 0,
  media_urls: [],
})

const PAGED = {
  0: Array.from({ length: 36 }, (_, i) => prizeRow(i + 1)),            // 1..36
  36: Array.from({ length: 36 }, (_, i) => prizeRow(i + 35)),          // 35..70（与上一页重叠 35/36）
  72: Array.from({ length: 10 }, (_, i) => prizeRow(i + 71)),          // 71..80（10 < 36 ⇒ 终止）
}

const ERR_HOOKS = `
  window.__sfErrors = [];
  window.addEventListener('error', (e) => window.__sfErrors.push('error: ' + (e.message || String(e.error))));
  window.addEventListener('unhandledrejection', (e) => window.__sfErrors.push('rejection: ' + String(e.reason && e.reason.message || e.reason)));
`

const cardCount = (page) => page.evaluate(() => document.querySelectorAll('[data-sf-m="reward-card"]').length)
const cardIds = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sf-m="reward-card"]')]
  .map((el) => el.getAttribute('href') || '')
  .map((h) => (h.match(/\/item\/([^/?#]+)/) || [])[1] || null)
  .filter(Boolean))

const has = (page, hook) => page.evaluate((h) => !!document.querySelector(`[data-sf-m="${h}"]`), hook)

const scrollToBottom = async (page) => {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
}

async function readRealListed() {
  const res = await fetch('http://localhost:5788/api/prize/all?skip=0&limit=36')
  const json = await res.json()
  const rows = Array.isArray(json.data) ? json.data : []
  return { status: res.status, success: json.success === true, rows: rows.map((r) => r.bID) }
}

async function armReal(browser, vp, realListed) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' })
  const requests = []
  context.on('request', (req) => { if (req.url().includes('/api/prize/all')) requests.push(new URL(req.url()).pathname + new URL(req.url()).search) })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  await page.addInitScript(ERR_HOOKS)

  await page.goto(vp.base + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 20000 })
  await page.waitForTimeout(400)

  const firstScreen = await cardCount(page)
  const ids = await cardIds(page)
  const beforeScroll = {
    sentinel: await has(page, 'feed-sentinel'),
    end: await has(page, 'feed-end'),
    loading: await has(page, 'feed-loading'),
    retry: await has(page, 'feed-retry'),
    requests: [...requests],
  }

  await scrollToBottom(page)
  await page.waitForTimeout(900)
  const afterScroll = {
    cards: await cardCount(page),
    ids: (await cardIds(page)).length,
    end: await has(page, 'feed-end'),
    loading: await has(page, 'feed-loading'),
    retry: await has(page, 'feed-retry'),
    requests: [...requests],
  }
  const winErrors = await page.evaluate(() => window.__sfErrors || [])

  await context.close()
  const nonListed = ids.filter((id) => !realListed.rows.includes(Number(id)))
  return {
    arm: 'real',
    viewport: `${vp.width}x${vp.height}`,
    base: vp.base,
    listed_api: { status: realListed.status, success: realListed.success, count: realListed.rows.length, bIDs: realListed.rows },
    first_screen_cards: firstScreen,
    first_screen_equal_listed: firstScreen === realListed.rows.length,
    cards_not_in_listed_api: nonListed,
    before_scroll: beforeScroll,
    after_scroll: afterScroll,
    // 终止后滚动不得再发商品页请求（dev 有 React.StrictMode ⇒ 首屏 skip=0 会被双发、首条被 abort）
    scroll_sent_no_extra_request: afterScroll.requests.length === beforeScroll.requests.length,
    strictmode_dev_double_mount: true,
    pageerror_count: pageErrors.length,
    pageerror: pageErrors,
    console_error_count: consoleErrors.length,
    console_errors: consoleErrors,
    window_error_count: winErrors.length,
    window_errors: winErrors,
  }
}

async function armPaged(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' })
  const requests = []
  await context.route('**/api/prize/all*', async (route) => {
    const url = new URL(route.request().url())
    const skip = Number(url.searchParams.get('skip') || 0)
    const limit = Number(url.searchParams.get('limit') || 0)
    requests.push({ skip, limit })
    const body = { success: true, message: 'ok', data: PAGED[skip] ?? [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  await page.addInitScript(ERR_HOOKS)

  await page.goto(vp.base + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 20000 })
  await page.waitForTimeout(400)

  const steps = []
  let cards = await cardCount(page)
  steps.push({ step: 'first-screen', cards, requests: requests.length })

  // 反复滚到底，直到终止（feed-end 出现）或无进展；上限 8 步（防无限循环）
  for (let i = 0; i < 8; i += 1) {
    const ended = await has(page, 'feed-end')
    if (ended) break
    await scrollToBottom(page)
    await page.waitForTimeout(700)
    const next = await cardCount(page)
    steps.push({ step: `scroll-${i + 1}`, cards: next, requests: requests.length, end: await has(page, 'feed-end') })
    if (next === cards && (await has(page, 'feed-end'))) break
    cards = next
  }

  const ids = await cardIds(page)
  const skipOrder = [...new Set(requests.map((r) => r.skip))]
  const skipCounts = requests.reduce((acc, r) => { acc[r.skip] = (acc[r.skip] || 0) + 1; return acc }, {})
  const final = {
    cards: await cardCount(page),
    unique_ids: new Set(ids).size,
    duplicate_ids: ids.length - new Set(ids).size,
    sentinel: await has(page, 'feed-sentinel'),
    end: await has(page, 'feed-end'),
    loading: await has(page, 'feed-loading'),
    retry: await has(page, 'feed-retry'),
  }
  const winErrors = await page.evaluate(() => window.__sfErrors || [])

  await context.close()
  return {
    arm: 'paged',
    viewport: `${vp.width}x${vp.height}`,
    base: vp.base,
    fixture: { page_rows: { 0: PAGED[0].length, 36: PAGED[36].length, 72: PAGED[72].length }, expected_unique: 80 },
    requests,
    skip_order: skipOrder,
    skip_counts: skipCounts,
    // ★ dev 有 React.StrictMode ⇒ 挂载期首屏请求双发（skip=0 两条，首条被 abort）⇒ 顺序判据取
    //   「首见 skip 序」并allow 仅 skip=0 出现两次；生产构建无此双发。
    request_sequence_ok: JSON.stringify(skipOrder) === JSON.stringify([0, 36, 72])
      && requests.every((r) => r.limit === 36)
      && Object.entries(skipCounts).every(([skip, n]) => (skip === '0' ? n <= 2 : n === 1)),
    strictmode_dev_double_mount: true,
    steps,
    monotonic: steps.every((s, i) => i === 0 || s.cards >= steps[i - 1].cards),
    final,
    pageerror_count: pageErrors.length,
    pageerror: pageErrors,
    console_error_count: consoleErrors.length,
    console_errors: consoleErrors,
    window_error_count: winErrors.length,
    window_errors: winErrors,
  }
}

(async () => {
  const realListed = await readRealListed()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const results = { at: new Date().toISOString(), real_listed: realListed, real: [], paged: [] }
  try {
    for (const vp of VIEWPORTS) results.real.push(await armReal(browser, vp, realListed))
    for (const vp of VIEWPORTS) results.paged.push(await armPaged(browser, vp))
  } finally {
    await browser.close()
  }

  const verdictOf = (r) => {
    if (r.arm === 'real') {
      return r.first_screen_equal_listed && r.cards_not_in_listed_api.length === 0
        && r.after_scroll.cards === r.first_screen_cards
        && r.pageerror_count === 0 && r.window_error_count === 0 && r.console_error_count === 0
        && r.before_scroll.end === true && r.before_scroll.retry === false
        && r.scroll_sent_no_extra_request === true
    }
    return r.request_sequence_ok && r.monotonic && r.final.cards === 80 && r.final.duplicate_ids === 0
      && r.final.end === true && r.final.loading === false && r.final.retry === false
      && r.pageerror_count === 0 && r.window_error_count === 0 && r.console_error_count === 0
  }
  results.verdict = {
    real: Object.fromEntries(results.real.map((r) => [r.viewport, verdictOf(r)])),
    paged: Object.fromEntries(results.paged.map((r) => [r.viewport, verdictOf(r)])),
  }
  results.all_pass = [...Object.values(results.verdict.real), ...Object.values(results.verdict.paged)].every(Boolean)

  const out = path.join(OUT_DIR, 'probe-feed-paging.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({
    verdict: results.verdict,
    all_pass: results.all_pass,
    real_listed_count: realListed.rows.length,
    real: results.real.map((r) => ({ vp: r.viewport, cards: r.first_screen_cards, ids: r.after_scroll.ids, reqs: r.after_scroll.requests.length, errs: [r.pageerror_count, r.console_error_count, r.window_error_count] })),
    paged: results.paged.map((r) => ({ vp: r.viewport, final: r.final, reqs: r.requests.map((x) => x.skip), errs: [r.pageerror_count, r.console_error_count, r.window_error_count] })),
  }, null, 2))
  console.log('READING=' + out)
})().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })