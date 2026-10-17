/**
 * 入口可达性补充读数（改后）：点卡片**空白/标题区** ⇒ pathname 必须 = /item/<id>
 * 配方同 probe-home-card-cta.mjs（context.route 映射 dist，零 dev server / 零后端）
 * 用法：node probe-click-entry.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = path.join(REPO, 'frontend/dist')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }

const PRIZES = [
  { bID: 3041, name: '九成新山地自行车 捷安特 ATX 720', description: '骑行约 200 公里，链条已上油。', points: 3200, stores_count: 3, claims_count: 12, gift_limit: 1, time_end: '2026-11-30 23:59:59' },
  { bID: 3042, name: 'iPad Air 5 64G 深空灰', description: '屏幕无划痕，电池健康 94%。', points: 2680, stores_count: 1, claims_count: 4, gift_limit: 0 },
]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const results = { ranAt: new Date().toISOString(), arms: {} }

for (const vp of [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce', locale: 'zh-CN' })
  await context.addInitScript(() => { try { localStorage.setItem('theme', 'light') } catch (e) {} })
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.origin !== ORIGIN) return route.fulfill({ status: 204, body: '' })
    if (u.pathname.startsWith('/api/')) {
      const body = u.pathname === '/api/home'
        ? { success: true, data: { tasks: [], prizes: PRIZES, claimed_prize_ids: [], user_points: 0 } }
        : { success: true, data: { rows: [], next_cursor: null, total: 0 } }
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) })
    }
    let rel = decodeURIComponent(u.pathname) === '/' ? '/index.html' : decodeURIComponent(u.pathname)
    let file = path.join(DIST, rel)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="reward-card"]')
  const card = page.locator('[data-sf-m="reward-card"]').first()
  await card.scrollIntoViewIfNeeded()
  // 点卡片标题区（= 非胶囊位置），验证入口由整卡承载
  const title = card.locator('h3').first()
  await title.click()
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(300)
  results.arms[vp.name] = { clickedAt: 'card h3 title', pathname: new URL(page.url()).pathname, href: await page.evaluate(() => location.href) }
  await context.close()
}
await browser.close()
const out = path.join(REPO, 'ops/home-card-remove-cta-20261017/readings/click-entry-after.json')
fs.writeFileSync(out, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results.arms, null, 2))
console.log('written:', path.relative(REPO, out))
