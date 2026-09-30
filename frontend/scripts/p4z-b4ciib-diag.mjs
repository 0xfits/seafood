// 诊断：market 页 `[data-sf-m="mkt-ticker"]` 在日/夜两档的盒模型读数（定位 2px 差异的真因）
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../dist')
const OUT_DIR = process.argv[2]
if (!OUT_DIR) throw new Error('usage: node scripts/p4z-b4ciib-diag.mjs <runDirAbs>')
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }

const JS = `(() => {
  const t = document.querySelector('[data-sf-m="mkt-ticker"]')
  if (!t) return JSON.stringify({ missing: true })
  const cs = getComputedStyle(t)
  const kids = Array.from(t.children).map((el) => {
    const c = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { tag: el.tagName, h: +r.height.toFixed(3), fontSize: c.fontSize, lineHeight: c.lineHeight, fontFamily: c.fontFamily, margin: c.margin, display: c.display }
  })
  const textRows = Array.from(t.querySelectorAll('.sf-mkt-pair,.sf-mkt-last,.sf-mkt-meta')).map((el) => {
    const c = getComputedStyle(el); const r = el.getBoundingClientRect()
    return { cls: el.className, h: +r.height.toFixed(3), fontSize: c.fontSize, lineHeight: c.lineHeight, fontFamily: c.fontFamily }
  })
  return JSON.stringify({
    theme: document.documentElement.getAttribute('data-theme'),
    rect: t.getBoundingClientRect().height,
    height: cs.height, minHeight: cs.minHeight, maxHeight: cs.maxHeight,
    boxSizing: cs.boxSizing, padding: cs.padding, borderWidth: cs.borderTopWidth, borderStyle: cs.borderTopStyle,
    cssVarTickerH: cs.getPropertyValue('--sf-k-ticker-h').trim(),
    display: cs.display, gridRows: cs.gridTemplateRows, align: cs.alignItems,
    bodyFont: getComputedStyle(document.body).fontFamily, bodySize: getComputedStyle(document.body).fontSize, bodyLine: getComputedStyle(document.body).lineHeight,
    htmlSize: getComputedStyle(document.documentElement).fontSize,
    kids, textRows,
  })
})()`

const main = async () => {
  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => { try { localStorage.setItem('user', JSON.stringify({ uID: 1, EVM: '0xprobe', token: 'p' })) } catch {} })
  const page = await ctx.newPage()
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) return route.abort()
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ path: file, contentType: MIME[path.extname(file)] || 'application/octet-stream' })
  })
  await page.goto(`${ORIGIN}/shard`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const day = JSON.parse(await page.evaluate(JS))
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(400)
  const night = JSON.parse(await page.evaluate(JS))
  const cssFile = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.css'))
  const cssHas = cssFile.map((f) => ({ f, hasVar: fs.readFileSync(path.join(DIST, 'assets', f), 'utf8').includes('--sf-k-ticker-h') }))
  fs.mkdirSync(path.join(OUT_DIR, 'post'), { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'post', 'b4ciib-ticker-diag.json'), JSON.stringify({ day, night, cssHas }, null, 2))
  console.log(JSON.stringify({ day, night, cssHas }, null, 2))
  await browser.close()
}

main().catch((e) => { console.error('DIAG_FAILED', e); process.exitCode = 1 })
