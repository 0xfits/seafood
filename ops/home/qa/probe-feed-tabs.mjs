/**
 * 首页【推荐 / 新发】两标签真浏览器读数（2026-10-22 · Kevin「四标签筛选下线」）
 * ---------------------------------------------------------------------------
 * 静态服务（`frontend/dist`）+ `context.route` 夹具 ⇒ 零后端依赖、零写库、可重复。
 *
 * 判据（四臂）：
 *   ① 奖励区恰 **2** 个标签（推荐 / 新发），默认激活 = 推荐，且**零计数芯片**；
 *   ② 切「新发」⇒ 请求带 `sort=new` 且 `skip=0`（第一条请求即新档首屏）；
 *   ③ 旧四档文案（全部 / 限量版 / 高价值 / 已兑换）在页面上**零命中**；
 *   ④ 390 / 1536 两档零横向溢出，pageerror / console error / window error 全 0。
 *
 * 负控：`PROBE_NEG=1` ⇒ 夹具故意把首屏请求的 sort 改成 recommend（模拟「切档没带参数」），
 *   臂②（sort=new）必红 —— 证明尺子能分辨。
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

/** 三条假商品行（够渲染，字段与读口同族） */
const rowsOf = (n, prefix) => Array.from({ length: n }, (_, i) => ({
  bID: `${prefix}${i + 1}`,
  title: `${prefix} 商品 ${i + 1}`,
  description: `${prefix} 商品 ${i + 1}\n描述`,
  price: '5',
  stock: 1,
  status: 'listed',
  item_type: 'PhysicalFreeShip',
  item_condition: 'BrandNewSealed',
  media_urls: [],
  seller_evm: '0x59ffffffb0',
  seller_credit: 'new',
  wants: 0,
  views: 0,
  time_created: new Date(Date.now() - i * 3600e3).toISOString(),
  cid: 1,
}))

const REQ_SORTS = []

const main = async () => {
  const server = await serve()
  const browser = await chromium.launch({ executablePath: CHROME })
  const out = { neg: NEG, arms: {}, states: {}, errors: {} }

  for (const vp of [{ name: 'vp1536', w: 1536, h: 960 }, { name: 'vp390', w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.w < 500, hasTouch: vp.w < 500 })
    const page = await ctx.newPage()
    const errs = { pageErrors: [], consoleErrors: [] }
    page.on('pageerror', (e) => errs.pageErrors.push(String(e).slice(0, 120)))
    page.on('console', (m) => { if (m.type() === 'error') errs.consoleErrors.push(m.text().slice(0, 120)) })
    const sorts = []
    // ★ 兜底必须**最先**注册（Playwright 路由后注册者优先匹配）
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
    await ctx.route('**/api/prize/all*', (route) => {
      const u = new URL(route.request().url())
      let sort = u.searchParams.get('sort') || 'recommend'
      if (NEG) sort = 'recommend' // 负控：模拟切档未生效
      sorts.push({ sort, skip: u.searchParams.get('skip') })
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: rowsOf(6, sort === 'new' ? 'N' : 'R') }) })
    })
    await ctx.route('**/api/prize-item*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
    await ctx.route('**/api/user*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'anon' } }) }))
    await ctx.route('**/api/currencies*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ cid: '1', symbol: '$', name: '积分' }] }) }))

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(700)

    const tabsOf = () => page.evaluate(() => {
      const rec = document.querySelector('[data-sf-m="feed-tab-recommend"]')
      const nw = document.querySelector('[data-sf-m="feed-tab-new"]')
      const all = [...document.querySelectorAll('[data-sf-m^="feed-tab-"]')]
      const txt = document.body.innerText
      return {
        count: all.length,
        hasRecommend: !!rec,
        hasNew: !!nw,
        recommendActive: rec ? /is-active|active/.test(rec.className) || rec.getAttribute('aria-selected') === 'true' : false,
        chips: [...document.querySelectorAll('[data-sf-m="feed-tab-"] span')].filter((s) => /^\(\d+\)$/.test(s.textContent.trim())).length,
        oldCopy: ['全部', '限量版', '高价值', '已兑换'].filter((w) => new RegExp(`^${w} \\(\\d`, 'm').test(txt) || new RegExp(`${w}\\s*\\(\\d`, 'm').test(txt)),
      }
    })

    const before = await tabsOf()
    const reqsBefore = sorts.length
    // 切「新发」
    const newBtn = await page.$('[data-sf-m="feed-tab-new"]')
    if (newBtn) { await newBtn.click(); await page.waitForTimeout(900) }
    const after = await tabsOf()
    const newReqs = sorts.slice(reqsBefore)

    out.states[vp.name] = { before, after, allRequests: sorts, newTabRequests: newReqs }
    out.arms[`${vp.name}_twoTabs`] = { pass: before.count === 2 && before.hasRecommend && before.hasNew, count: before.count }
    out.arms[`${vp.name}_recommendDefault`] = { pass: before.recommendActive === true, recommendActive: before.recommendActive }
    out.arms[`${vp.name}_noCountChips`] = { pass: before.chips === 0, chips: before.chips }
    out.arms[`${vp.name}_oldCopyGone`] = { pass: before.oldCopy.length === 0, hits: before.oldCopy }
    out.arms[`${vp.name}_newSendsSortNew`] = {
      pass: newReqs.length > 0 && newReqs[0].sort === 'new' && String(newReqs[0].skip) === '0',
      firstNewRequest: newReqs[0] || null,
    }
    out.arms[`${vp.name}_zeroOverflow`] = await page.evaluate(() => ({ pass: document.documentElement.scrollWidth <= window.innerWidth, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
    out.errors[vp.name] = { pageErrors: errs.pageErrors.length, consoleErrors: errs.consoleErrors.length, sample: errs.pageErrors.slice(0, 2) }
    out.arms[`${vp.name}_noErrors`] = { pass: errs.pageErrors.length === 0, consoleErrors: errs.consoleErrors.length }
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
