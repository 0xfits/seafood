/**
 * 媒体单前端阶段 A · 浏览器探针（读侧展示：占位图资产 + media_urls 接线）
 * 体例照 ops/v119-msg-panel/qa/probe-geometry-qa.mjs：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server）
 *   · API 一律 context.route 内内存自截（零真后端 / 零库写）
 *   · 「真图分支」= 把 /api/home 与 /api/prize/1 的响应里 media_urls 填 '/api/media/1'，
 *     并截获该 URL 返一张 1×1 PNG（不写库）
 * 用法：node probe-phase-a.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/media-upload/frontend-a/probe-readings.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

// 1×1 透明 PNG（公开常量字节；run 前已用 sips 自证 pixelWidth=1/pixelHeight=1）
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
}

// ---- 夹具（探针内内存 JSON，绝不触网 / 绝不写库） --------------------------------------------
const state = { mode: 'placeholder' } // 'placeholder' | 'real'

const PRIZE_ROW_BASE = {
  bID: 1, listing_id: 1,
  name: '深海拾遗 · 探针夹具',
  title: '深海拾遗 · 探针夹具',
  description: 'QA 探针夹具行：内存自截响应，非真库行。',
  points: 120, price: 120, stock: 5, status: 'listed',
  stores_count: 3, claims_count: 0, symbol: '',
  image_url: '', url_image: '',
}
const prizeRow = () => ({
  ...PRIZE_ROW_BASE,
  media_urls: state.mode === 'real' ? ['/api/media/1'] : [],
})

const apiResponse = (method, pathname) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/home') return data({ tasks: [], prizes: [prizeRow()], claimed_prize_ids: [], user_points: 0 })
  if (pathname.startsWith('/api/prize/all')) return data([prizeRow()])
  if (pathname === '/api/prize/1') return data(prizeRow())
  if (pathname.startsWith('/api/prize-item')) return data([])
  if (pathname.startsWith('/api/user/asset/')) return data({ points: 0 })
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

const serveDist = (u) => {
  let file = path.join(DIST, decodeURIComponent(u.pathname))
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file)) return { status: 404, body: '' }
  return { status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }
}

const settleImages = (page) => page.evaluate(() => Promise.all(
  [...document.images].map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = res }))),
))

const readPage = (page) => page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')]
  const ph = imgs.filter((i) => (i.getAttribute('src') || '').includes('placeholder-item'))
  const real = imgs.filter((i) => i.getAttribute('src') === '/api/media/1')
  const thumb = document.querySelector('img[data-sf-m="item-detail-thumb"]')
  const sfItem = document.querySelector('.sf-item')
  const thumbHVar = sfItem ? getComputedStyle(sfItem).getPropertyValue('--sf-st-card-thumb-h').trim() : null
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 } }
  return {
    url: location.href,
    totalImgs: imgs.length,
    placeholderCount: ph.length,
    placeholderSrcs: [...new Set(ph.map((i) => i.getAttribute('src')))],
    placeholderNatural: ph.map((i) => i.naturalWidth),
    realCount: real.length,
    realNatural: real.map((i) => i.naturalWidth),
    thumb: thumb ? {
      src: thumb.getAttribute('src'), alt: thumb.getAttribute('alt'),
      naturalWidth: thumb.naturalWidth, complete: thumb.complete,
      box: rect(thumb), objectFit: getComputedStyle(thumb).objectFit, display: getComputedStyle(thumb).display,
    } : null,
    thumbHVar,
  }
})

async function runCell(browser, { width, height, mode, url, label }) {
  state.mode = mode
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => { localStorage.setItem('theme', 'light') })
  const assetHits = []
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname === '/api/media/1') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 })
    }
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    }
    const served = serveDist(u)
    if (u.pathname.includes('placeholder-item')) assetHits.push({ pathname: u.pathname, status: served.status, contentType: served.contentType })
    if (served.status === 404) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: served.status, headers: served.contentType ? { 'content-type': served.contentType } : {}, body: served.body })
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle').catch(() => {})
  await settleImages(page)
  const snap = await readPage(page)
  await context.close()
  return { label, viewport: { width, height }, mode, ...snap, assetHits, pageErrors, consoleErrors }
}

const judge = (c) => {
  const noPageError = c.pageErrors.length === 0
  if (c.mode === 'placeholder') {
    const hasPlaceholder = c.placeholderCount >= 1
    const decodes = c.placeholderNatural.length > 0 && c.placeholderNatural.every((n) => n === 320)
    const noReal = c.realCount === 0
    const thumbOk = c.thumb ? (c.thumb.src.includes('placeholder-item') && c.thumb.naturalWidth === 320 && !!c.thumb.alt) : true
    const thumbOnlyForDetail = c.thumb ? (c.thumb.box && c.thumbHVar ? Math.abs(c.thumb.box.h - parseFloat(c.thumbHVar)) < 0.5 : false) : true
    return { hasPlaceholder, decodes320: decodes, noReal, thumbPlaceholderOk: thumbOk, thumbBoxMatchesVar: thumbOnlyForDetail, noPageError, pass: hasPlaceholder && decodes && noReal && thumbOk && thumbOnlyForDetail && noPageError }
  }
  const hasReal = c.realCount >= 1
  const decodesPng = c.realNatural.length > 0 && c.realNatural.every((n) => n === 1)
  const noPlaceholder = c.placeholderCount === 0
  const thumbOk = c.thumb ? (c.thumb.src === '/api/media/1' && c.thumb.naturalWidth === 1 && c.thumb.complete && !!c.thumb.alt) : true
  return { hasReal, decodesPng1x1: decodesPng, noPlaceholder, thumbRealOk: thumbOk, noPageError, pass: hasReal && decodesPng && noPlaceholder && thumbOk && noPageError }
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const cells = []
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    for (const mode of ['placeholder', 'real']) {
      cells.push(await runCell(browser, { width, height, mode, url: '/', label: `home_${width}_${mode}` }))
      cells.push(await runCell(browser, { width, height, mode, url: '/item/1', label: `detail_${width}_${mode}` }))
    }
  }
  await browser.close()
  const out = {
    probe: 'probe-phase-a.mjs · 媒体单前端阶段 A（占位图资产 + media_urls 接线）',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixture: { png: '1x1 PNG at /api/media/1', prizeRow: { ...PRIZE_ROW_BASE, media_urls: "<mode-dependent>" } },
    pngBytes: PNG_1X1.length,
    cells: cells.map((c) => ({ ...c, verdict: judge(c) })),
    allPass: cells.every((c) => judge(c).pass),
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ allPass: out.allPass, cells: out.cells.map((c) => ({ label: c.label, pass: c.verdict.pass, pageErrors: c.pageErrors.length })) }, null, 2))
  console.log('OUT=' + OUT)
}

main().catch((e) => { console.error('PROBE-FAILED', e); process.exit(1) })
