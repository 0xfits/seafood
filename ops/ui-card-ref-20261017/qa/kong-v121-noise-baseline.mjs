/**
 * Kong · v1.21 噪声基线自证：**同一 dist 连跑两轮**逐元素 dump 必须逐字节相同
 * （否则父版 vs 现版的差异集里混着加载期随机 ⇒ 判据不成立）。
 * 随机源 = Footer.jsx 模块加载期 Math.random() ⇒ 本探针在 addInitScript 里**冻结** Math.random。
 * 用法：KONG_DIST=<dist> node .../kong-v121-noise-baseline.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const DIST = process.env.KONG_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/readings/kong-v121-noise-baseline.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

const DUMP_FN = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const vis = (el) => !!(el && el.getClientRects().length > 0)
  const clsOf = (el) => { const c = el.className; return c && c.baseVal !== undefined ? c.baseVal : (c || '') }
  const out = []; const keyCount = {}
  const root = document.querySelector('.sf-shell') || document.body
  for (const el of [...root.querySelectorAll('*')].filter(vis)) {
    const base = el.tagName.toLowerCase() + '.' + String(clsOf(el)).trim().split(/\\s+/).join('.')
    keyCount[base] = (keyCount[base] || 0) + 1
    const c = getComputedStyle(el); const r = el.getBoundingClientRect()
    out.push([base + '#' + keyCount[base], round(r.x), round(r.y), round(r.width), round(r.height),
      c.backgroundColor, c.color, c.borderTopColor + '/' + c.borderTopWidth, c.backdropFilter,
      el.closest('#header') ? 'header' : (el.closest('[data-sf-region="footer"]') ? 'footer' : 'else')])
  }
  return out
})()`

async function once(browser, freezeRandom) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' })
  await context.addInitScript(`localStorage.setItem('theme','light');${freezeRandom ? 'Math.random = () => 0.42;' : ''}`)
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0, rows: [], next_cursor: null, total: 0 } }) })
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await page.waitForTimeout(700)
  const dump = await page.evaluate(DUMP_FN)
  await context.close()
  return dump
}

const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const f1 = await once(browser, true)
const f2 = await once(browser, true)
const r1 = await once(browser, false)
const r2 = await once(browser, false)
const res = {
  probe: 'ops/ui-card-ref-20261017/qa/kong-v121-noise-baseline.mjs', dist: DIST, at: new Date().toISOString(),
  frozenRandom: { rounds: 2, elements: [f1.length, f2.length], sha: [sha(f1), sha(f2)], identical: sha(f1) === sha(f2) },
  rawRandom: { rounds: 2, elements: [r1.length, r2.length], sha: [sha(r1), sha(r2)], identical: sha(r1) === sha(r2) },
}
fs.writeFileSync(OUT, JSON.stringify(res, null, 2))
console.log(JSON.stringify(res, null, 2))
await browser.close()
