/**
 * 首页【推荐 / 新发】两标签真浏览器读数（FEED-SORT-v2 · 2026-10-22 Kevin「排序改回前端」）
 * ---------------------------------------------------------------------------
 * 静态服务（`frontend/dist`）+ `context.route` 夹具 ⇒ 零后端依赖、零写库、可重复。
 *
 * 判据（每档视口）：
 *   ① 奖励区恰 **2** 个标签（推荐 / 新发），默认激活 = 推荐，且**零计数芯片**；
 *   ② 旧四档文案（全部 / 限量版 / 高价值 / 已兑换）在页面上**零命中**；
 *   ③ **切档零请求**：点【新发】后 `/api/prize/all` 与其余 `/api/` 请求数**一律不变**；
 *   ④ **DOM 顺序 = 期望序列**：推荐档按 `feed_score` 降序（→ 时间 → bID），新发档按 `time_created`
 *      降序（→ bID）；夹具的到达序与两档期望序都不全同 ⇒ 能分辨「真的重排了」；
 *   ⑤ `sort` 参数不再切换：任何请求 URL 都**不带** `sort=`；
 *   ⑥ **FLIP**：切档瞬间网格进入 `data-sf-flip=running`、位移卡带 `data-sf-flip-move`；
 *      另起 `reducedMotion: 'reduce'` 上下文 ⇒ 顺序照换但**零动画属性**（降级臂），
 *      收尾后 `data-sf-flip` 必须被清掉（动画不留常驻内联样式）；
 *   ⑦ 卡高仍 392（切档不得改卡几何）；390 / 1536 两档零横向溢出，pageerror / console error 全 0。
 *
 * 负控：`PROBE_NEG=1` ⇒ **不点标签**（DOM 停在推荐序）却按「新发期望序」判定 ⇒
 *   臂④（newOrder）必红 —— 证明顺序尺子能分辨，不是恒真。
 *
 * 用法：cd frontend && npm run build && node ops/home/qa/probe-feed-tabs.mjs
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
const PORT = 5792
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(OUT_DIR, 'probe-feed-tabs.json')
const NEG = process.env.PROBE_NEG === '1'

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' }

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, BASE).pathname)
    let filePath = path.join(DIST, urlPath)
    if (!filePath.startsWith(DIST)) { res.writeHead(403).end(); return }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(DIST, 'index.html')
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
  server.listen(PORT, '127.0.0.1', () => resolve(server))
})

/**
 * 夹具：8 行。`feed_score` 降序 == 卡片推荐序；`time_created` 的先后与分数**不同向**
 * ⇒ 新发序 ≠ 推荐序（能分辨「切档真的重排了」）。
 */
const FIXTURE = [
  { id: 'A1', score: '0.912345', time: '2026-10-20T00:00:00.000Z' },
  { id: 'A2', score: '0.834000', time: '2026-10-22T00:00:00.000Z' },
  { id: 'A3', score: '0.771000', time: '2026-10-19T00:00:00.000Z' },
  { id: 'A4', score: '0.665000', time: '2026-10-21T00:00:00.000Z' },
  { id: 'A5', score: '0.540000', time: '2026-10-18T00:00:00.000Z' },
  { id: 'A6', score: '0.470000', time: '2026-10-22T06:00:00.000Z' },
  { id: 'A7', score: '0.320000', time: '2026-10-17T00:00:00.000Z' },
  { id: 'A8', score: '0.210000', time: '2026-10-21T12:00:00.000Z' },
]

const rowsOf = () => FIXTURE.map((row) => ({
  bID: row.id,
  item_code: row.id,
  title: `商品 ${row.id}`,
  description: `商品 ${row.id}\n描述`,
  price: '5',
  points: 100,
  stock: 1,
  status: 'listed',
  item_type: 'PhysicalFreeShip',
  item_condition: 'BrandNewSealed',
  media_urls: [],
  seller_evm: '0x59ffffffb0',
  seller_credit: 'new',
  wants: 0,
  views: 0,
  feed_score: row.score,
  time_created: row.time,
  cid: 1,
}))

/** 期望序（探针内**独立**实现一遍三键降序：与前端纯函数互为交叉验证，不是抄它的输出） */
const expectedOrder = (mode) => [...FIXTURE]
  .sort((a, b) => {
    if (mode === 'recommend') {
      const d = Number(b.score) - Number(a.score)
      if (d !== 0) return d
    }
    const t = Date.parse(b.time) - Date.parse(a.time)
    if (t !== 0) return t
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  })
  .map((row) => row.id)

const EXPECTED = { recommend: expectedOrder('recommend'), new: expectedOrder('new') }

/** 读 DOM：卡序（href 末段）+ 标签态 + 卡高 */
const readDom = (page) => page.evaluate(() => {
  const grid = document.querySelector('[data-sf-m="feed-grid"]')
  const cards = grid ? [...grid.querySelectorAll('[data-sf-m="reward-card"]')] : []
  const rec = document.querySelector('[data-sf-m="feed-tab-recommend"]')
  const nw = document.querySelector('[data-sf-m="feed-tab-new"]')
  const allTabs = [...document.querySelectorAll('[data-sf-m^="feed-tab-"]')]
  return {
    order: cards.map((el) => (el.getAttribute('href') || '').split('/').filter(Boolean).pop()),
    heights: cards.slice(0, 6).map((el) => Math.round(el.getBoundingClientRect().height)),
    tabCount: allTabs.length,
    hasRecommend: !!rec,
    hasNew: !!nw,
    recommendActive: rec ? rec.getAttribute('aria-selected') === 'true' : false,
    newActive: nw ? nw.getAttribute('aria-selected') === 'true' : false,
    chips: allTabs.filter((el) => /\(\s*\d+\s*\)/.test(el.textContent || '')).length,
    oldCopy: ['全部', '限量版', '高价值', '已兑换'].filter((w) => new RegExp(`${w}\\s*\\(\\d`, 'm').test(document.body.innerText)),
  }
})

const main = async () => {
  const server = await serve()
  const browser = await chromium.launch({ executablePath: CHROME })
  const out = { neg: NEG, expected: EXPECTED, arms: {}, states: {}, errors: {} }

  const scenarios = [
    { name: 'vp1536', w: 1536, h: 960, reducedMotion: 'no-preference' },
    { name: 'vp390', w: 390, h: 844, reducedMotion: 'no-preference' },
    { name: 'rm1536', w: 1536, h: 960, reducedMotion: 'reduce' },
  ]

  for (const vp of scenarios) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      isMobile: vp.w < 500,
      hasTouch: vp.w < 500,
      reducedMotion: vp.reducedMotion,
    })
    const page = await ctx.newPage()
    const errs = { pageErrors: [], consoleErrors: [] }
    page.on('pageerror', (e) => errs.pageErrors.push(String(e).slice(0, 120)))
    page.on('console', (m) => { if (m.type() === 'error') errs.consoleErrors.push(m.text().slice(0, 120)) })

    const requests = []
    const apiRequests = []
    // ★ 兜底必须**最先**注册（Playwright 路由后注册者优先匹配）
    await ctx.route('**/api/**', (r) => {
      apiRequests.push(new URL(r.request().url()).pathname)
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    })
    await ctx.route('**/api/prize/all*', (route) => {
      const u = new URL(route.request().url())
      // 夹具与参数无关：**任何** sort 都返回同一批行（= 服务器默认序稳定）
      requests.push({ path: u.pathname, search: u.search, sort: u.searchParams.get('sort'), skip: u.searchParams.get('skip') })
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: rowsOf() }) })
    })
    await ctx.route('**/api/prize-item*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
    await ctx.route('**/api/user*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'anon' } }) }))
    await ctx.route('**/api/currencies*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ cid: '1', symbol: '$', name: '积分' }] }) }))

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 15000 })
    await page.waitForTimeout(400)

    const before = await readDom(page)
    const reqsBefore = requests.length
    const apiBefore = apiRequests.length

    // 切【新发】，并在同一拍观察 FLIP（invert 帧在 click 的同步 commit 里就已落 DOM）
    const flip = await page.evaluate(async () => {
      const grid = document.querySelector('[data-sf-m="feed-grid"]')
      const btn = document.querySelector('[data-sf-m="feed-tab-new"]')
      if (!btn) return { clicked: false, moving: 0, hook: null }
      btn.click()
      let moving = 0
      const deadline = performance.now() + 240
      while (performance.now() < deadline) {
        moving = Math.max(moving, grid ? grid.querySelectorAll('[data-sf-flip-move]').length : 0)
        if (moving > 0) break
        await new Promise((r) => requestAnimationFrame(r))
      }
      return { clicked: true, moving, hook: grid ? grid.getAttribute('data-sf-flip') : null }
    })
    await page.waitForTimeout(380) // 等 FLIP 收尾（260ms + 60ms 清理）

    const after = await readDom(page)
    const newReqs = requests.slice(reqsBefore)
    const newApiReqs = apiRequests.slice(apiBefore)
    const flipCleared = await page.evaluate(() => {
      const grid = document.querySelector('[data-sf-m="feed-grid"]')
      return grid ? grid.getAttribute('data-sf-flip') : null
    })

    const key = vp.name
    const isReduced = vp.reducedMotion === 'reduce'
    out.states[key] = { before, after, allRequests: requests, newTabRequests: newReqs, newApiRequests: newApiReqs, flip, flipCleared }
    out.arms[`${key}_twoTabs`] = { pass: before.tabCount === 2 && before.hasRecommend && before.hasNew, count: before.tabCount }
    out.arms[`${key}_recommendDefault`] = { pass: before.recommendActive === true, recommendActive: before.recommendActive }
    out.arms[`${key}_noCountChips`] = { pass: before.chips === 0, chips: before.chips }
    out.arms[`${key}_oldCopyGone`] = { pass: before.oldCopy.length === 0, hits: before.oldCopy }
    out.arms[`${key}_recommendOrder`] = {
      pass: JSON.stringify(before.order) === JSON.stringify(EXPECTED.recommend),
      dom: before.order,
      expected: EXPECTED.recommend,
    }
    out.arms[`${key}_switchZeroRequests`] = {
      pass: newReqs.length === 0 && newApiReqs.length === 0,
      newPrizeAllRequests: newReqs.length,
      newApiRequests: newApiReqs,
    }
    out.arms[`${key}_sortParamNeverSent`] = {
      pass: requests.every((r) => r.sort === null),
      sorts: [...new Set(requests.map((r) => r.sort))],
    }
    out.arms[`${key}_newOrder`] = {
      pass: JSON.stringify(after.order) === JSON.stringify(EXPECTED.new),
      dom: after.order,
      expected: EXPECTED.new,
      newActive: after.newActive,
    }
    out.arms[`${key}_flip${isReduced ? 'Degraded' : 'Animated'}`] = isReduced
      ? { pass: flip.clicked === true && flip.moving === 0 && flip.hook === null, moving: flip.moving, hook: flip.hook }
      : { pass: flip.clicked === true && flip.moving > 0 && flip.hook === 'running', moving: flip.moving, hook: flip.hook }
    out.arms[`${key}_flipCleared`] = { pass: flipCleared === null, hook: flipCleared }
    out.arms[`${key}_cardHeight392`] = {
      pass: before.heights.length > 0 && before.heights.every((h) => h === 392),
      heights: before.heights,
    }
    out.arms[`${key}_zeroOverflow`] = await page.evaluate(() => ({
      pass: document.documentElement.scrollWidth <= window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    out.errors[key] = { pageErrors: errs.pageErrors.length, consoleErrors: errs.consoleErrors.length, sample: errs.pageErrors.slice(0, 2) }
    out.arms[`${key}_noErrors`] = { pass: errs.pageErrors.length === 0, consoleErrors: errs.consoleErrors.length }

    // ★ 负控：不点标签（DOM 停在推荐序），却按「新发期望序」判 ⇒ 顺序尺子必红
    if (NEG) {
      out.arms[`${key}_newOrder`] = {
        ...out.arms[`${key}_newOrder`],
        pass: JSON.stringify(before.order) === JSON.stringify(EXPECTED.new),
        negForced: true,
      }
    }
    await ctx.close()
  }

  await browser.close()
  server.close()

  const failed = Object.entries(out.arms).filter(([, v]) => v.pass !== true).map(([k]) => k)
  out.summary = { checks: Object.keys(out.arms).length, failed: failed.length, failedNames: failed, verdict: failed.length ? 'FAIL' : 'PASS' }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, summary: out.summary }, null, 2))
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
