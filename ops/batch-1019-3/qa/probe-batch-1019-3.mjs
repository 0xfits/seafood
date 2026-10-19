/**
 * BATCH-1019-3 · 独立质检探针（分页 82e465e + 6列/1536 10ef6b1）
 * ---------------------------------------------------------------------------
 * 栈：真 vite dev(5787，/api 反代 → 5788) + 真 dev 后端(5788)。
 * 段：
 *   A · real   —— 零拦截，390/1440：首屏卡数 = min(36, dev listed=9)，无重复 bID，
 *                到底出 feed-end，无 feed-loading 残留，skip 只发 0。
 *   B · paged-a —— 仅拦截 GET /api/prize/all*（36/36/10，第 2↔3 页重叠 2 行）：
 *                卡数 36→72→80、skip 0→36→72、去重后无重复、到底 feed-end、无 loading 残留。
 *   C · paged-b —— 36/36/10，第 1↔2 页重叠 2 行（证明跨页去重：36+34=70）。
 *   D · layout —— 390/1024/1280/1440/1536/1920 × light/dark：computed 列数、容器宽、居中、溢出。
 *   E · routes —— /、/item/1、/task 零 pageerror、#root 非空。
 * 输出：ops/batch-1019-3/qa/readings/{probe-paging,probe-layout,probe-routes}.json
 * 用法：node ops/batch-1019-3/qa/probe-batch-1019-3.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5787'
const OUT_DIR = path.join(REPO, 'ops/batch-1019-3/qa/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'vp390', width: 390, height: 844 },
  { name: 'vp1440', width: 1440, height: 900 },
]
const LAYOUT_VIEWPORTS = [
  { name: 'vp390', width: 390, height: 844, expectCols: 2 },
  { name: 'vp1024', width: 1024, height: 800, expectCols: 4 },
  { name: 'vp1280', width: 1280, height: 900, expectCols: 6 },
  { name: 'vp1440', width: 1440, height: 900, expectCols: 6 },
  { name: 'vp1536', width: 1536, height: 900, expectCols: 6 },
  { name: 'vp1920', width: 1920, height: 1080, expectCols: 6 },
]

const ERR_HOOKS = `
  window.__sfErrors = [];
  window.addEventListener('error', (e) => window.__sfErrors.push('error: ' + (e.message || String(e.error))));
  window.addEventListener('unhandledrejection', (e) => window.__sfErrors.push('rejection: ' + String((e.reason && e.reason.message) || e.reason)));
`

const row = (bID) => ({
  bID,
  name: `海边小屋 · 分页夹具 ${bID}`,
  description: '分页夹具描述',
  points: 800 + bID,
  price: 800 + bID,
  stores_count: 2,
  claims_count: 0,
  media_urls: [],
  image_url: '',
  url_image: '',
})

// paged-a：1..36 / 37..72 / 71..80（第 3 页与第 2 页重叠 71,72 两行）
const FIXTURE_A = {
  0: Array.from({ length: 36 }, (_, i) => row(i + 1)),
  36: Array.from({ length: 36 }, (_, i) => row(i + 37)),
  72: Array.from({ length: 10 }, (_, i) => row(i + 71)),
}
// paged-b：1..36 / 35..70 / 71..80（第 2 页与第 1 页重叠 35,36 两行）
const FIXTURE_B = {
  0: Array.from({ length: 36 }, (_, i) => row(i + 1)),
  36: Array.from({ length: 36 }, (_, i) => row(i + 35)),
  72: Array.from({ length: 10 }, (_, i) => row(i + 71)),
}

const READ_STATE = `(() => {
  const q = (h) => document.querySelector('[data-sf-m="' + h + '"]');
  const grid = q('feed-grid');
  const cards = [...document.querySelectorAll('[data-sf-m="feed-grid"] [data-sf-m="reward-card"]')];
  const ids = cards.map((el) => {
    const a = el.matches('a') ? el : el.querySelector('a');
    const href = (a && a.getAttribute('href')) || el.getAttribute('href') || '';
    const m = href.match(/\\/item\\/(\\d+)/);
    return m ? Number(m[1]) : null;
  });
  const cs = grid ? getComputedStyle(grid) : null;
  const cont = document.querySelector('.sf-route-container');
  const cRect = cont ? cont.getBoundingClientRect() : null;
  return {
    cards: cards.length,
    ids,
    distinctIds: new Set(ids.filter((x) => x !== null)).size,
    grid: !!grid,
    gridCols: cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : null,
    gridTemplateColumns: cs ? cs.gridTemplateColumns : null,
    loading: !!q('feed-loading'),
    end: !!q('feed-end'),
    error: !!q('feed-error'),
    retry: !!q('feed-retry'),
    sentinel: !!q('feed-sentinel'),
    containerW: cRect ? +cRect.width.toFixed(2) : null,
    containerL: cRect ? +cRect.left.toFixed(2) : null,
    shellMaxW: getComputedStyle(document.documentElement).getPropertyValue('--sf-st-shell-max-w').trim(),
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    rootHtmlLen: (document.getElementById('root') || {}).innerHTML ? document.getElementById('root').innerHTML.length : 0,
    themeAttr: document.documentElement.getAttribute('data-theme'),
  };
})()`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function rollToEnd(page, { maxSteps = 60, stepWait = 220 } = {}) {
  const timeline = []
  let prev = -1
  let quiet = 0
  for (let i = 0; i < maxSteps; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await sleep(stepWait)
    const s = await page.evaluate(READ_STATE)
    timeline.push({ step: i, cards: s.cards, distinct: s.distinctIds, loading: s.loading, end: s.end, error: s.error, retry: s.retry })
    if (s.end || s.error) break
    if (s.cards === prev) {
      quiet += 1
      if (quiet >= 4) break
    } else {
      quiet = 0
    }
    prev = s.cards
  }
  await sleep(500)
  return { timeline, final: await page.evaluate(READ_STATE) }
}

const uniq = (arr) => [...new Set(arr)]

function pageWatchers(page) {
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  return { pageErrors, consoleErrors }
}

async function runArm(browser, vp, { interceptFixture = null, label }) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'reduce',
  })
  const hits = []
  const failed = []
  context.on('requestfailed', (req) => {
    if (req.url().includes('/api/prize/all')) failed.push({ url: req.url(), err: req.failure()?.errorText })
  })
  context.on('request', (req) => {
    if (!req.url().includes('/api/prize/all')) return
    const u = new URL(req.url())
    hits.push({ skip: u.searchParams.get('skip'), limit: u.searchParams.get('limit') })
  })
  if (interceptFixture) {
    await context.route('**/api/prize/all*', async (route) => {
      const u = new URL(route.request().url())
      const skip = Number(u.searchParams.get('skip') || 0)
      const rows = interceptFixture[skip] || []
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data: rows }),
      })
    })
  }
  await context.addInitScript(ERR_HOOKS)
  const page = await context.newPage()
  const { pageErrors, consoleErrors } = pageWatchers(page)

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 25000 })
  await sleep(700)
  const first = await page.evaluate(READ_STATE)
  const before = { ...first, rawRequests: [...hits] }

  const rolled = await rollToEnd(page)
  const winErrors = await page.evaluate(() => window.__sfErrors || [])

  const out = {
    arm: label,
    viewport: `${vp.width}x${vp.height}`,
    fixture: !!interceptFixture,
    first_screen: {
      cards: first.cards,
      distinct: first.distinctIds,
      ids: first.ids,
      duplicate_ids: first.ids.filter((x, i) => x !== null && first.ids.indexOf(x) !== i),
      sentinel: first.sentinel, end: first.end, loading: first.loading, error: first.error, retry: first.retry,
    },
    requests: {
      raw: hits,
      distinct_skips: uniq(hits.map((h) => h.skip)),
      limits: uniq(hits.map((h) => h.limit)),
      failed: failed,
    },
    scroll_timeline: rolled.timeline,
    final: {
      cards: rolled.final.cards,
      distinct: rolled.final.distinctIds,
      duplicate_ids: rolled.final.ids.filter((x, i) => x !== null && rolled.final.ids.indexOf(x) !== i),
      end: rolled.final.end, loading: rolled.final.loading, error: rolled.final.error, retry: rolled.final.retry,
      sentinel: rolled.final.sentinel,
    },
    pageErrors,
    consoleErrors,
    windowErrors: winErrors,
  }
  await context.close()
  return out
}

async function runLayout(browser, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'reduce',
  })
  await context.addInitScript((t) => { window.localStorage.setItem('theme', t) }, theme)
  await context.addInitScript(ERR_HOOKS)
  const page = await context.newPage()
  const { pageErrors, consoleErrors } = pageWatchers(page)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 25000 })
  await sleep(600)
  const s = await page.evaluate(READ_STATE)
  const extra = await page.evaluate(() => {
    const grid = document.querySelector('[data-sf-m="feed-grid"]')
    const cards = [...document.querySelectorAll('[data-sf-m="feed-grid"] [data-sf-m="reward-card"]')]
    const first = cards[0] ? cards[0].getBoundingClientRect() : null
    const cs = getComputedStyle(grid)
    return {
      gridClassName: grid.className,
      columnGap: cs.columnGap,
      gridW: +grid.getBoundingClientRect().width.toFixed(2),
      firstCardW: first ? +first.width.toFixed(2) : null,
      cardHeights: cards.slice(0, 6).map((c) => +c.getBoundingClientRect().height.toFixed(1)),
      shellMaxWOnRoot: getComputedStyle(document.documentElement).getPropertyValue('--sf-st-shell-max-w').trim(),
      shellBg: getComputedStyle(document.querySelector('.sf-shell') || document.documentElement).backgroundColor,
    }
  })
  await context.close()
  return {
    theme,
    vp: vp.name,
    width: vp.width,
    expectCols: vp.expectCols,
    ...s,
    ...extra,
    colsMatch: s.gridCols === vp.expectCols,
    centered: s.containerW != null ? Math.abs(s.containerL - (vp.width - s.containerW) / 2) <= 1.5 : null,
    overflowX: s.docScrollW - s.docClientW,
    pageErrors,
    consoleErrors,
  }
}

async function runRoutes(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(ERR_HOOKS)
  const page = await context.newPage()
  const { pageErrors, consoleErrors } = pageWatchers(page)
  const out = []
  for (const route of ['/', '/item/1', '/task']) {
    pageErrors.length = 0
    consoleErrors.length = 0
    let status = null
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 })
      status = res ? res.status() : null
    } catch (e) {
      out.push({ route, gotoError: String(e.message || e) })
      continue
    }
    await sleep(800)
    const s = await page.evaluate(READ_STATE)
    const bodyText = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120))
    out.push({
      route,
      status,
      rootHtmlLen: s.rootHtmlLen,
      textLen: bodyText.length,
      textSample: bodyText,
      docOverflowX: s.docScrollW - s.docClientW,
      pageErrors: [...pageErrors],
      consoleErrors: [...consoleErrors],
    })
  }
  await context.close()
  return out
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const meta = { base: BASE, at: new Date().toISOString(), chrome: CHROME }

  const paging = { ...meta, arms: [] }
  for (const vp of VIEWPORTS) {
    paging.arms.push(await runArm(browser, vp, { label: 'real' }))
    paging.arms.push(await runArm(browser, vp, { label: 'paged-a', interceptFixture: FIXTURE_A }))
    paging.arms.push(await runArm(browser, vp, { label: 'paged-b', interceptFixture: FIXTURE_B }))
    console.log('paging done', vp.name, paging.arms.slice(-3).map((a) => `${a.arm}:${a.first_screen.cards}->${a.final.cards} end=${a.final.end} skips=${a.requests.distinct_skips}`).join(' | '))
  }
  fs.writeFileSync(path.join(OUT_DIR, 'probe-paging.json'), JSON.stringify(paging, null, 2))

  const layout = { ...meta, rows: [] }
  for (const theme of ['light', 'dark']) {
    for (const vp of LAYOUT_VIEWPORTS) {
      const r = await runLayout(browser, vp, theme)
      layout.rows.push(r)
      console.log(`layout ${theme} ${vp.name}(${vp.width}) cols=${r.gridCols}/${vp.expectCols} contW=${r.containerW} L=${r.containerL} centered=${r.centered} overflow=${r.overflowX} maxW=${r.shellMaxW} errs=${r.pageErrors.length}/${r.consoleErrors.length}`)
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'probe-layout.json'), JSON.stringify(layout, null, 2))

  const routes = { ...meta, rows: await runRoutes(browser) }
  fs.writeFileSync(path.join(OUT_DIR, 'probe-routes.json'), JSON.stringify(routes, null, 2))
  console.log('routes', routes.rows.map((r) => `${r.route}:root=${r.rootHtmlLen},pe=${r.pageErrors && r.pageErrors.length}`).join(' | '))

  await browser.close()
  console.log('DONE')
}

run().catch((e) => {
  console.error('PROBE-FAILED', e)
  process.exit(1)
})
