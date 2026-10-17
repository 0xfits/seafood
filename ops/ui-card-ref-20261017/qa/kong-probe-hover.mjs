/**
 * Kong 补充读数 · 卡片底/边 + hover 行为（§22 `T109`/Q5/Q6 + Zang 日档口径「纯白 + 浅灰 1px 边 + hover:shadow-lg（无黄环、不位移）」）
 * 口径同主探针（route→dist、内存 API、addInitScript 主题、禁动画、稳态采样）。
 * 用法：node ops/ui-card-ref-20261017/qa/kong-probe-hover.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const DIST = path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/readings/kong-hover-readings.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

const CARD_MEASURE = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const card = document.querySelector('[data-sf-m="reward-card"]')
  const inner = card && card.firstElementChild
  const cs = inner ? getComputedStyle(inner) : null
  const r = inner ? inner.getBoundingClientRect() : null
  return {
    rootTag: card ? card.tagName : null,
    innerTag: inner ? inner.tagName : null,
    innerClasses: inner ? inner.className : null,
    innerBg: cs ? cs.backgroundColor : null,
    borderWidth: cs ? [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join('/') : null,
    borderColor: cs ? cs.borderTopColor : null,
    borderRadius: cs ? cs.borderTopLeftRadius : null,
    boxShadow: cs ? cs.boxShadow : null,
    transform: cs ? cs.transform : null,
    rect: r ? { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) } : null,
    ringWidth: cs ? cs.getPropertyValue('--tw-ring-shadow').trim() : null,
    outlineWidth: cs ? cs.outlineWidth : null,
  }
})()`

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = { probe: 'ops/ui-card-ref-20261017/qa/kong-probe-hover.mjs（Kong 补充读数）', startedAt: new Date().toISOString(), states: {}, abortedHosts: [] }
  for (const [label, theme] of [['390_day', 'light'], ['390_night', 'dark'], ['1440_day', 'light']]) {
    const context = await browser.newContext({ viewport: label.startsWith('390') ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' })
    await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
    await context.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url())
      if (u.hostname !== 'sf.local') { out.abortedHosts.push(u.href.slice(0, 120)); return route.abort() }
      if (u.pathname.startsWith('/api/')) {
        const data = (d) => ({ success: true, data: d })
        const body = u.pathname === '/api/home'
          ? data({ tasks: [], prizes: [{ bID: 1, name: 'FIXTURE 商品一', points: 29, stores_count: 3, claims_count: 12 }, { bID: 2, name: 'FIXTURE 商品二', points: 6600, stores_count: 1 }], claimed_prize_ids: [], user_points: 0 })
          : data({ rows: [], next_cursor: null, total: 0 })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      }
      let file = path.join(DIST, decodeURIComponent(u.pathname))
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
    })
    const page = await context.newPage()
    await page.goto(ORIGIN + '/', { waitUntil: 'load' })
    await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 10000 }).catch(() => {})
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
    await page.evaluate(`(() => { const c = document.querySelector('[data-sf-m="reward-card"]'); if (c) c.scrollIntoView({ block: 'center' }) })()`)
    await page.waitForTimeout(120)
    const before = await page.evaluate(CARD_MEASURE)
    await page.hover('[data-sf-m="reward-card"]')
    await page.waitForTimeout(250)
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' })
    await page.waitForTimeout(120)
    const hovered = await page.evaluate(CARD_MEASURE)
    // 第二个卡片（rarity=epic ⇒ 稀有度描边）用于对照：证明渐变底已去、描边仍在
    out.states[label] = {
      theme, before, hovered,
      hoverDelta: {
        boxShadowChanged: before.boxShadow !== hovered.boxShadow,
        rectUnchanged: JSON.stringify(before.rect) === JSON.stringify(hovered.rect),
        transformUnchanged: before.transform === hovered.transform,
      },
    }
    await context.close()
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, states: Object.fromEntries(Object.entries(out.states).map(([k, v]) => [k, { before: v.before, hovered: v.hovered, hoverDelta: v.hoverDelta }])), abortedHosts: [...new Set(out.abortedHosts)] }, null, 2))
  await browser.close()
}
main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
