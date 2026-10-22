/**
 * /exchange 价格走势（sparkline）真浏览器读数（2026-10-22 · Kevin「要显示标的的价格走势」）
 * ---------------------------------------------------------------------------
 * 静态服务（`frontend/dist`）+ `context.route` 夹具 ⇒ 零后端依赖、零写库、可重复。
 *
 * 判据（公开面三臂 + 双档几何）：
 *   ① 成交 N 笔（夹具注入 3 笔）⇒ `[data-sf-m="mkt-trend"]` 在场、`data-sf-points="3"`、
 *      内含 `<svg>`、标注最高/最低/最新三值；
 *   ② 成交 0 笔 ⇒ 走势块显示空态（`mkt-trend-empty`），**不画假点**（`data-sf-points="0"`）；
 *   ③ 390 / 1536 两档零横向溢出、pageerror / console error 全 0。
 *
 * 负控：`PROBE_NEG=1` ⇒ 夹具注入 0 笔但断言按 3 笔走 ⇒ 臂① 必红（尺子有分辨力）。
 *
 * 用法：cd frontend && npm run build && node ops/market/front/probe-exchange-trend.mjs
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const DIST = path.join(REPO, 'frontend/dist')
const OUT_DIR = path.join(REPO, 'ops/market/front/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })

const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 5793
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(OUT_DIR, 'probe-exchange-trend.json')
const NEG = process.env.PROBE_NEG === '1'

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' }

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, BASE).pathname)
    let fp = path.join(DIST, urlPath)
    if (!fp.startsWith(DIST)) { res.writeHead(403).end(); return }
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(DIST, 'index.html')
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' })
    fs.createReadStream(fp).pipe(res)
  })
  server.listen(PORT, '127.0.0.1', () => resolve(server))
})

// 3 笔成交（最新在前，与后端读口同序）；负控臂将其清空
const TRADES = [
  { trID: 3, bID: 4, buy_oID: 11, sell_oID: 12, buyer_uID: 1, seller_uID: 2, price: '1020', volume: '1', time_created: 1792668900, brand_symbol: '' },
  { trID: 2, bID: 4, buy_oID: 13, sell_oID: 14, buyer_uID: 1, seller_uID: 2, price: '1005', volume: '2', time_created: 1792668840, brand_symbol: '' },
  { trID: 1, bID: 4, buy_oID: 8, sell_oID: 2, buyer_uID: 109, seller_uID: 100, price: '1000', volume: '1', time_created: 1792668762, brand_symbol: '' },
]
const tradesFixture = () => (NEG ? [] : TRADES)

const BOOK = [
  { side: 'buy', price: '995', volume: '101' },
  { side: 'sell', price: '1005', volume: '100' },
]

const main = async () => {
  const server = await serve()
  const browser = await chromium.launch({ executablePath: CHROME })
  const out = { neg: NEG, arms: {}, errors: {} }

  for (const vp of [{ name: 'vp1536', w: 1536, h: 1000 }, { name: 'vp390', w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.w < 500, hasTouch: vp.w < 500 })
    const page = await ctx.newPage()
    const errs = { pageErrors: [], consoleErrors: [] }
    page.on('pageerror', (e) => errs.pageErrors.push(String(e).slice(0, 120)))
    page.on('console', (m) => { if (m.type() === 'error') errs.consoleErrors.push(m.text().slice(0, 120)) })

    // 兜底必须最先注册（Playwright 后注册者优先）
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
    await ctx.route('**/api/market/*/trades*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tradesFixture() }) }))
    await ctx.route('**/api/market/*/orderbook*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: BOOK }) }))
    await ctx.route('**/api/currencies*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ cid: '1', symbol: '$', name: '积分' }, { cid: '4', symbol: '₿', name: 'BTTC' }] }) }))

    await page.goto(`${BASE}/exchange?base=4`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(900)

    const snap = await page.evaluate(() => {
      const el = document.querySelector('[data-sf-m="mkt-trend"]')
      const svg = el ? el.querySelector('svg') : null
      const text = el ? el.textContent.replace(/\s+/g, ' ').trim() : null
      return {
        present: !!el,
        points: el ? el.getAttribute('data-sf-points') : null,
        dir: el ? el.getAttribute('data-sf-dir') : null,
        hasSvg: !!svg,
        text,
        empty: !!document.querySelector('[data-sf-m="mkt-trend-empty"]'),
        overflowPx: document.documentElement.scrollWidth - window.innerWidth,
      }
    })

    const expectPoints = '3' // 负控臂：夹具清零但期望不变 ⇒ 臂必红（尺子灵敏度自证）
    out.arms[`${vp.name}_trendWithPoints`] = {
      pass: snap.present && snap.points === expectPoints && snap.hasSvg,
      points: snap.points,
      expectPoints,
      hasSvg: snap.hasSvg,
      empty: snap.empty,
    }
    out.arms[`${vp.name}_rangeLabels`] = {
      pass: /最高|max/i.test(String(snap.text)) && /最低|min/i.test(String(snap.text)) && /最新|last/i.test(String(snap.text)),
      text: snap.text,
    }
    out.arms[`${vp.name}_zeroOverflow`] = { pass: snap.overflowPx <= 0, overflowPx: snap.overflowPx }
    out.arms[`${vp.name}_noErrors`] = { pass: errs.pageErrors.length === 0, pageErrors: errs.pageErrors.length, consoleErrors: errs.consoleErrors.length }
    out.errors[vp.name] = { pageErrors: errs.pageErrors, consoleErrors: errs.consoleErrors }
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
