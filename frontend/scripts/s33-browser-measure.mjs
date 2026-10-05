// S33 · B12 阶段二 —— 判据① 浏览器臂：5 路由 × {日,夜} × 1280 = 10 臂
//   对「被删类名/ID」与「被删完整选择器」逐条 querySelectorAll(...).length 必须 = 0；
//   ★ 本单额外：① 祖先/后代组合形态探针（.<n> * / * > .<n>）；② 整页 DOM class/id 全量扫描与
//     被删名求交（= ∅）——防「独立类名查不到但复合/后代选择器命中某元素」的盲区。
//   手段同阶段一（复用本仓先例 scripts/p4z-b4cii-geometry.mjs）：无 dev server，page.route ↦ frontend/dist；
//   非 ORIGIN 的外部请求（CDN/字体）一律 abort；主题 = 直接改 <html data-theme>。
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '..', 'dist')
const MAN = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const OUT = process.argv[3]
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' }

const items = MAN.items.filter((i) => i.kind !== 'keyframes')
const SELECTORS = [...new Set(items.map((i) => i.sel))]
const names = new Set()
for (const i of items) for (const m of i.sel.matchAll(/[.#]([A-Za-z_][\w-]*)/g)) names.add(m[1])
const NAMES = [...names].sort()
const ROUTES = ['/', '/login', '/task', '/listing', '/shard']

const MEASURE = (sel, nm) => `(() => {
  const out = { path: location.pathname, attr: document.documentElement.getAttribute('data-theme'), nameHits: [], comboHits: [], selHits: [], selErrors: [], domClassHits: [], domIdHits: [] }
  const NAMES = ${JSON.stringify(nm)}
  for (const n of NAMES) {
    for (const q of ['.' + CSS.escape(n), '.' + CSS.escape(n) + ' *', '* > .' + CSS.escape(n)]) {
      try { const c = document.querySelectorAll(q).length; if (c) (q.indexOf(' ') > 0 ? out.comboHits : out.nameHits).push({ q, c }) } catch (e) { out.selErrors.push({ q, e: String(e).slice(0,80) }) }
    }
    try { if (document.getElementById(n)) out.domIdHits.push(n) } catch (e) {}
  }
  const SELS = ${JSON.stringify(sel)}
  for (const s of SELS) { try { const c = document.querySelectorAll(s).length; if (c) out.selHits.push({ s, c }) } catch (e) { out.selErrors.push({ s, e: String(e).slice(0,80) }) } }
  const ns = new Set(NAMES)
  const seen = new Set()
  for (const el of document.querySelectorAll('*')) {
    if (el.classList) for (const c of el.classList) if (ns.has(c) && !seen.has('c:' + c)) { seen.add('c:' + c); out.domClassHits.push(c) }
    if (el.id && ns.has(el.id) && !seen.has('i:' + el.id)) { seen.add('i:' + el.id); out.domIdHits.push(el.id) }
  }
  return JSON.stringify(out)
})()`

const main = async () => {
  const ev = { startedAt: new Date().toISOString(), origin: ORIGIN, deletedNames: NAMES.length, deletedSelectors: SELECTORS.length, routes: ROUTES, arms: [], verdict: {} }
  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined })
  ev.browserVersion = browser.version()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => { try { window.localStorage.setItem('user', JSON.stringify({ uID: 1, EVM: '0xprobe', token: 'probe-token' })) } catch {} })
  const page = await ctx.newPage()
  const blocked = []
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.origin !== ORIGIN) { blocked.push(u.href); return route.abort() }
    let f = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
    return route.fulfill({ path: f, contentType: MIME[path.extname(f)] || 'application/octet-stream' })
  })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))
  let bad = 0, anySelErr = 0
  for (const r of ROUTES) {
    await page.goto(ORIGIN + r, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
      await page.waitForTimeout(150)
      const res = JSON.parse(await page.evaluate(MEASURE(SELECTORS, NAMES)))
      const n = res.nameHits.length + res.comboHits.length + res.selHits.length + res.domClassHits.length + res.domIdHits.length
      if (n) bad += 1
      anySelErr += res.selErrors.length
      ev.arms.push({ route: r, theme, landedPath: res.path, attr: res.attr, nameHits: res.nameHits, comboHits: res.comboHits, selHits: res.selHits, domClassHits: res.domClassHits, domIdHits: res.domIdHits, selErrors: res.selErrors.slice(0, 5), selErrorCount: res.selErrors.length, allZero: n === 0 })
    }
  }
  ev.blocked_origins = Array.from(new Set(blocked.map((u) => new URL(u).origin)))
  ev.page_errors = pageErrors
  ev.verdict = { arms: ev.arms.length, deletedNames: NAMES.length, deletedSelectors: SELECTORS.length, armsWithHits: bad, selErrors: anySelErr, all_zero: bad === 0, PASS: bad === 0 }
  ev.finishedAt = new Date().toISOString()
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2))
  await browser.close()
  console.log(JSON.stringify({ out: OUT, arms: ev.arms.length, deletedNames: NAMES.length, deletedSelectors: SELECTORS.length, armsWithHits: bad, all_zero: ev.verdict.all_zero, pageErrors: pageErrors.length, selErrors: anySelErr, blocked_origins: ev.blocked_origins }, null, 1))
}
main().catch((e) => { console.error('PROBE_FAILED', e); process.exitCode = 1 })
