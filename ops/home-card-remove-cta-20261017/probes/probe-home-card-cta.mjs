/**
 * seafood · 首页商品卡片「查看详情」胶囊移除 · 改前/改后读数探针
 * 配方照 ops/v119-msg-panel/qa/probe-geometry-qa.mjs：
 *   · context.route 把 http://sf.local/** 映射到磁盘 frontend/dist ⇒ 零 dev server、零后端、零库写
 *   · /api/* 一律在 route 内内存自截（夹具文案用真实感文本）
 *   · 两档视口 1440 / 390，各读：卡内 reward-card-view 计数 · 卡根 tag+href · 卡内交互元素计数
 * 用法：node probe-home-card-cta.mjs <stage:before|after> <outDir>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const STAGE = process.argv[2] || 'before'
const OUTDIR = process.argv[3] || path.join(REPO, 'ops/home-card-remove-cta-20261017')
const DIST = path.join(REPO, 'frontend/dist')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// ---- 夹具（真实感文案；内存 JSON，绝不触网 / 绝不写库） ---------------------------
const PRIZES = [
  {
    bID: 3041, name: '九成新山地自行车 捷安特 ATX 720',
    description: '骑行约 200 公里，链条已上油，车架无磕碰、变速顺畅。自提，地铁 5 号线杨美站 B 口。',
    points: 3200, stores_count: 3, claims_count: 12, gift_limit: 1,
    time_end: '2026-11-30 23:59:59', create_time: '2026-10-02 09:12:00',
  },
  {
    bID: 3042, name: 'iPad Air 5 64G 深空灰（含原装保护壳）',
    description: '2024 年购于官网，日常追剧与记笔记使用，屏幕无划痕，电池健康 94%，附充电器与保护壳。',
    points: 2680, stores_count: 1, claims_count: 4, gift_limit: 0,
    time_end: null, create_time: '2026-10-05 14:30:00',
  },
  {
    bID: 3043, name: '北欧实木书桌 120cm 原木色',
    description: '橡木贴面，桌面有一处浅浅的水杯印，承重稳当。需自行搬运，罗湖布心花园自提。',
    points: 860, stores_count: 2, claims_count: 7, gift_limit: 0,
    time_end: null, create_time: '2026-10-08 18:05:00',
  },
  {
    bID: 3044, name: '手冲咖啡套装 V60 滤杯 + 手摇磨豆机',
    description: '滤杯、分享壶、电子秤与磨豆机一套齐全，磨盘刚换新，附赠一包未开封浅烘豆。',
    points: 540, stores_count: 5, claims_count: 21, gift_limit: 2,
    time_end: '2026-10-31 23:59:59', create_time: '2026-10-11 10:20:00',
  },
]

const ok = (data) => ({ success: true, data })
const apiResponse = (method, pathname) => {
  if (pathname === '/api/home') {
    return ok({ tasks: [], prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  }
  if (pathname === '/api/prize/all') return ok(PRIZES)
  if (pathname === '/api/task/all') return ok([])
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

const MEASURE_FN = `(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0
  const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')].filter(vis)
  const INTERACTIVE = 'a,button,input,select,textarea,[role="button"],[tabindex]'
  return {
    url: location.href,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    cardCount: cards.length,
    viewCtaCount: document.querySelectorAll('[data-sf-m="reward-card-view"]').length,
    claimCtaCount: document.querySelectorAll('[data-sf-m="reward-card-claim"]').length,
    cards: cards.map((c) => {
      const interactive = [...c.querySelectorAll(INTERACTIVE)].filter((e) => e.tagName.toLowerCase() !== c.tagName.toLowerCase())
      const lastRow = c.querySelector('.flex.items-center.justify-between')
      return {
        tag: c.tagName.toLowerCase(),
        href: c.getAttribute('href'),
        to: c.getAttribute('to'),
        title: (c.querySelector('h3,h2') || {}).textContent || null,
        interactiveCount: interactive.length,
        interactiveTags: interactive.map((e) => e.tagName.toLowerCase()),
        viewCtaInside: c.querySelectorAll('[data-sf-m="reward-card-view"]').length,
        lastRowChildCount: lastRow ? lastRow.children.length : null,
        lastRowText: lastRow ? lastRow.textContent.replace(/\\s+/g, ' ').trim() : null,
        rect: rc(c),
        ctaBoxes: [...c.querySelectorAll('[data-sf-m="reward-card-view"]')].map((e) => ({ tag: e.tagName.toLowerCase(), rect: rc(e), text: e.textContent.trim() })),
      }
    }),
    bodyText: document.body.innerText.slice(0, 400),
  }
})()`

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
]

fs.mkdirSync(path.join(OUTDIR, 'readings'), { recursive: true })
fs.mkdirSync(path.join(OUTDIR, 'shots'), { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const results = { stage: STAGE, dist: DIST, origin: ORIGIN, ranAt: new Date().toISOString(), views: {} }

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  })
  await context.addInitScript(() => {
    try { localStorage.setItem('theme', 'light') } catch (e) {}
  })
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.origin === ORIGIN) {
      if (u.pathname.startsWith('/api/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(apiResponse(req.method(), u.pathname)),
        })
      }
      let rel = decodeURIComponent(u.pathname)
      if (rel === '/' || rel === '') rel = '/index.html'
      let file = path.join(DIST, rel)
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
      const ext = path.extname(file).toLowerCase()
      return route.fulfill({
        status: 200,
        contentType: MIME[ext] || 'application/octet-stream',
        body: fs.readFileSync(file),
      })
    }
    return route.fulfill({ status: 204, body: '' })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 })
  // 禁动画 + 等两帧稳定
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.waitForFunction(() => document.querySelectorAll('[data-sf-m="reward-card"]').length > 0)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const data = await page.evaluate(MEASURE_FN)

  // 取景：把第一张卡滚进视口（证明被改元素在画面内）
  const firstCardTop = await page.evaluate(() => {
    const c = document.querySelector('[data-sf-m="reward-card"]')
    return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : 0
  })
  await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 160)), firstCardTop)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const shotPath = path.join(OUTDIR, 'shots', `${STAGE}-home-${vp.name}.png`)
  await page.screenshot({ path: shotPath, fullPage: false })
  const cardInView = await page.evaluate(() => {
    const c = document.querySelector('[data-sf-m="reward-card"]')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.height > 0
  })

  results.views[vp.name] = { ...data, shot: path.relative(REPO, shotPath), cardFullyInViewport: cardInView, pageErrors }
  await context.close()
}

await browser.close()

const outFile = path.join(OUTDIR, 'readings', `probe-${STAGE}.json`)
fs.writeFileSync(outFile, JSON.stringify(results, null, 2))

for (const [name, v] of Object.entries(results.views)) {
  console.log(`--- ${name} ---`)
  console.log(`url=${v.url} cards=${v.cardCount} viewCta=${v.viewCtaCount} claimCta=${v.claimCtaCount}`)
  v.cards.forEach((c) => console.log(`  tag=${c.tag} href=${c.href} interactive=${c.interactiveCount}[${c.interactiveTags}] lastRowChildren=${c.lastRowChildCount} title=${JSON.stringify(c.title)}`))
  console.log(`  cardFullyInViewport=${v.cardFullyInViewport} pageErrors=${v.pageErrors.length} shot=${v.shot}`)
}
console.log('written:', path.relative(REPO, outFile))
