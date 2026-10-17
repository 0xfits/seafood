/**
 * Neng 独立质检 v1.21 —— 腿 5：截图（Kevin 目视确认）
 *   390 / 1600 × 日 / 夜 = 4 张（**未滚动 · 含页头 + ≥2 张商品卡**，文案为真实感商品标题）
 *   + 1 张 hover 态（导航项 · 真 page.hover）
 * 落 `ops/ui-card-ref-20261017/shots/neng-v121-*.png` + sha256 清单。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const REPO = '/Users/kevin/bistro/seafood'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const DIST = path.join(REPO, 'frontend/dist')
const SHOTS = path.join(REPO, 'ops/ui-card-ref-20261017/shots')
const require_ = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require_('playwright')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }
const PRIZES = [
  { bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%，原装盒与充电线齐全', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆封', points: 6600, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: '自用一年 MacBook Air M2 13 英寸 星空色', description: '循环次数 88 次，附原装 35W 双口充电器', points: 3200, stores_count: 0, claims_count: 0 },
  { bID: 4, name: '宜家 BEKANT 电动升降桌 160x80 白面', description: '无划痕，自提优先，可代叫货拉拉', points: 1200, stores_count: 2, claims_count: 4 },
  { bID: 5, name: '索尼 WH-1000XM5 头戴式降噪耳机', description: '耳罩无脱皮，附收纳包与 3.5mm 线', points: 900, stores_count: 1, claims_count: 1 },
  { bID: 6, name: '捷安特 ATX860 山地车 27.5 寸 21 速', description: '去年买的，骑行不到 300 公里，定期保养', points: 2600, stores_count: 1, claims_count: 0 },
]
const TASKS = [{ tID: 1, title: '招募：周末市集摊位布展协助', note: '六日两天 10:00-16:00', is_open: true, points: 10, participants_count: 3 }, { tID: 2, title: '代取快递并配送至驿站', note: '两小时内完成', is_open: true, points: 5, participants_count: 1 }]
async function open(browser, { theme, width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      const d = (x) => JSON.stringify({ success: true, data: x })
      let body = d({ rows: [], next_cursor: null, total: 0 })
      if (u.pathname === '/api/home') body = d({ tasks: TASKS, prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
      else if (u.pathname.startsWith('/api/task/all')) body = d(TASKS)
      else if (u.pathname.startsWith('/api/prize/all')) body = d(PRIZES)
      else if (u.pathname.startsWith('/api/prize/')) body = d(PRIZES.find((x) => String(x.bID) === u.pathname.split('/').pop()) || null)
      return route.fulfill({ status: 200, contentType: 'application/json', body })
    }
    let f = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory() || !path.extname(f)) f = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) })
  })
  return { context, page: await context.newPage() }
}
const cardInfo = `(() => {
  const cards = [...document.querySelectorAll('.sf-card, a.sf-card, article.sf-card')].filter((e) => e.getClientRects().length > 0)
  const uniq = cards.filter((e, i, a) => a.findIndex((x) => x.getBoundingClientRect().top === e.getBoundingClientRect().top && x.getBoundingClientRect().left === e.getBoundingClientRect().left) === i)
  const vis = uniq.map((e) => { const r = e.getBoundingClientRect(); return { cls: String(e.className).slice(0, 70), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), fullyVisible: r.top >= 0 && r.bottom <= innerHeight, text: (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60) } })
  return { scrollY: window.scrollY, innerH: innerHeight, headerRect: (() => { const r = document.getElementById('header').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] })(), cards: vis, fullyVisibleCount: vis.filter((v) => v.fullyVisible).length }
})()`
const out = { shots: [] }
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] })
try {
  for (const [w, h] of [[390, 900], [1600, 1000]]) {
    for (const theme of ['light', 'dark']) {
      const { context, page } = await open(browser, { theme, width: w, height: h })
      await page.goto(ORIGIN + '/', { waitUntil: 'load' })
      await page.waitForSelector('#header', { timeout: 10000 }).catch(() => {})
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(500)
      const info = await page.evaluate(cardInfo)
      const file = path.join(SHOTS, `neng-v121-${w}-${theme === 'light' ? '日档' : '夜档'}.png`)
      await page.screenshot({ path: file })
      const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      out.shots.push({ file: path.relative(REPO, file), theme, width: w, height: h, scrollY: info.scrollY, headerRect: info.headerRect, fullyVisibleCards: info.fullyVisibleCount, totalCards: info.cards.length, firstCardText: (info.cards[0] || {}).text || null, sha256: sha, bytes: fs.statSync(file).size })
      console.log('[leg5]', w, theme, 'scrollY', info.scrollY, 'header', JSON.stringify(info.headerRect), 'cards', info.fullyVisibleCount + '/' + info.cards.length, '| 1st:', (info.cards[0] || {}).text)
      await context.close()
    }
  }
  // hover 态（1600 日档 · 真 page.hover 导航项）
  {
    const { context, page } = await open(browser, { theme: 'light', width: 1600, height: 1000 })
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await page.waitForSelector('#header', { timeout: 10000 }).catch(() => {})
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
    const sel = '#header nav a.nav-link:nth-of-type(1)'
    await page.hover(sel, { timeout: 5000 })
    await page.waitForTimeout(200)
    const st = await page.evaluate(`(()=>{const e=document.querySelector('${sel}');const c=getComputedStyle(e);return {color:c.color,hover:e.matches(':hover'),r:[Math.round(e.getBoundingClientRect().x),Math.round(e.getBoundingClientRect().top),Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)],text:(e.textContent||'').trim()}})()`)
    const file = path.join(SHOTS, 'neng-v121-hover-navlink-日档-1600.png')
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1600, height: 140 } })
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    out.shots.push({ file: path.relative(REPO, file), theme: 'light', width: 1600, height: 140, kind: 'hover-nav-link', hoverState: st, sha256: sha, bytes: fs.statSync(file).size })
    console.log('[leg5] hover shot', JSON.stringify(st))
    await context.close()
  }
  fs.writeFileSync(path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-shots.json'), JSON.stringify(out, null, 2))
  fs.writeFileSync(path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-shots-sha256.txt'), out.shots.map((s) => `${s.sha256}  ${s.file}`).join('\n') + '\n')
  console.log('[leg5] WROTE shots + sha256')
} finally { await browser.close() }
