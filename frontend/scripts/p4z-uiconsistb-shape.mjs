// Unit P6-UI-CONSIST-B · 形状收敛读数脚本（**只读站、不写仓**）
// 用法: node scripts/p4z-uiconsistb-shape.mjs <label>       label ∈ {before, after}
//   静态服务 frontend/dist 于 127.0.0.1:5792（本单授权端口；5787/5791 一律不碰）
//   外部源一律 abort ⇒ 读数离线确定
// 产出: $HOME/.hermes/profiles/zang/cache/scratch/p6-uiconsist-b/<label>/{shape-<label>.json, shots/}
// 退出码: 0 完成；2 运行异常；3 有读数失败
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LABEL = process.argv[2] || 'run'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../dist')
const PORT = 5792
const ORIGIN = `http://127.0.0.1:${PORT}`
const OUT = path.join(os.homedir(), '.hermes/profiles/zang/cache/scratch/p6-uiconsist-b', LABEL)
const SHOTS = path.join(OUT, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })
const log = (...a) => console.log(...a)

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  let file = path.join(DIST, url)
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

// 四个目标家族 + 旧语义按钮（Zang 裁定①：.btn-md.btn-proceed / .btn-inactive 实测仍有切角）
const FAMILY = {
  card: ['.sf-card', '.sf-panel', '.sf-listings-card', '.sf-jobs-item', '.sf-mkt-item', '[class~="border-gray-200"]'],
  input: ['.sf-box', '.sf-listings-input', '.sf-jobs-input', '.sf-mkt-input', 'input[class~="px-3"]'],
  chip: ['.sf-chip', '.sf-tag', '.sf-listings-tag', '.sf-jobs-tag', '.sf-price'],
  tab: ['.sf-tab', '.sf-tabbar', 'button[class~="px-3"][class~="py-1.5"]'],
  legacyBtn: ['.btn-proceed', '.btn-inactive', '.btn-primary', '.btn-outline', '.btn-ghost', '.btn-success', '.btn-warning', '.btn-sm', '.btn-md', '.btn-lg'],
}
const ALL = Object.values(FAMILY).flat()
const PAGES = ['/', '/login', '/listing', '/theme-preview']
const THEMES = ['light', 'dark']

const resolveExecutable = () => {
  if (process.env.P6_UI_CHROME) return process.env.P6_UI_CHROME
  const roots = [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright')]
  const cands = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const d of fs.readdirSync(root)) {
      for (const rel of [['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'], ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'], ['chrome-linux', 'chrome-headless-shell']]) {
        const p = path.join(root, d, rel[0], rel[1])
        if (fs.existsSync(p)) cands.push(p)
      }
    }
  }
  return cands.sort().pop()
}

const READER = `(sels) => {
  const rd = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return {
    rect: [+r.x.toFixed(2), +r.y.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)],
    clipPath: cs.clipPath, boxShadow: cs.boxShadow, radius: cs.borderTopLeftRadius,
    border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
    bg: cs.backgroundColor } }
  const out = {}
  for (const s of sels) {
    const els = [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0)
    out[s] = els.length ? { ...rd(els[0]), n: els.length } : null
  }
  return out
}`

const main = async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r))
  const exe = resolveExecutable()
  log(`[${LABEL}] dist=${DIST} exe=${exe || '(default)'}`)
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.route('**', (route) => (route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort()))
  const page = await ctx.newPage()
  const styles = {}, iso = {}, shots = {}, errors = []
  const setTheme = async (theme) => {
    await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((a) => localStorage.setItem('theme', a), theme)
  }
  // 注入式 IIFE：把选择器集嵌入表达式字符串（Playwright 对「字符串函数」不传 arg ⇒ 必须立即调用）
  const CALL = `((${READER})(${JSON.stringify(ALL)}))`
  const visit = async (p) => {
    await page.goto(ORIGIN + p, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1200)
    return page.evaluate(CALL)
  }

  // ① 逐类 × 逐档 计算样式读数（1280×900，断言 innerWidth）
  for (const theme of THEMES) {
    await setTheme(theme)
    for (const p of PAGES) {
      try {
        const d = await visit(p)
        const iw = await page.evaluate(() => window.innerWidth)
        if (iw !== 1280) throw new Error(`innerWidth=${iw}（1280 档未生效）`)
        styles[`${theme}|${p}`] = d
      } catch (e) { errors.push(`style ${theme}|${p}: ${String((e && e.message) || e)}`) }
    }
    log(`[${LABEL}] styles ${theme} done`)
  }

  // ② 切档 rect 同构（同一批元素 light vs dark 逐值相等）
  const rectsOf = async (theme) => {
    await setTheme(theme)
    const out = {}
    for (const p of PAGES) {
      try {
        const d = await visit(p)
        for (const s of ALL) out[`${p}::${s}`] = d[s] ? d[s].rect : null
      } catch (e) { errors.push(`iso ${theme}|${p}: ${String((e && e.message) || e)}`) }
    }
    return out
  }
  const light = await rectsOf('light')
  const dark = await rectsOf('dark')
  const keys = Object.keys(light)
  const diffs = []
  for (const k of keys) {
    const a = light[k], b = dark[k]
    if (!a || !b) { iso[k] = a === b ? 'both-null' : 'one-null'; continue }
    if (a.join(',') !== b.join(',')) { diffs.push({ k, light: a, dark: b }); iso[k] = 'DIFF' } else iso[k] = 'equal'
  }
  log(`[${LABEL}] iso done diffs=${diffs.length}`)

  // ③ 两档 × 三宽度截图（每个宽度断言 innerWidth）
  const WIDTHS = [[390, 844], [1280, 900], [1600, 900]]
  for (const [w, h] of WIDTHS) {
    await page.setViewportSize({ width: w, height: h })
    for (const theme of THEMES) {
      await setTheme(theme)
      for (const p of ['/', '/listing', '/theme-preview']) {
        try {
          await page.goto(ORIGIN + p, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForTimeout(1200)
          const iw = await page.evaluate(() => window.innerWidth)
          if (iw !== w) { errors.push(`innerWidth=${iw} ≠ ${w} @${theme}|${p}`); continue }
          const f = path.join(SHOTS, `${LABEL}-${theme}-${w}x${h}-${p.replace(/[^a-z]/gi, '') || 'root'}.png`)
          await page.screenshot({ path: f })
          shots[`${theme}|${w}x${h}|${p}`] = f
        } catch (e) { errors.push(`shot ${theme}|${w}x${h}|${p}: ${String((e && e.message) || e)}`) }
      }
    }
    log(`[${LABEL}] shots ${w} done`)
  }

  await browser.close()
  server.close()
  const report = { unit: 'P6-UI-CONSIST-B', label: LABEL, at: new Date().toISOString(), families: FAMILY, styles, iso, diffs: { count: diffs.length, list: diffs }, shots, errors }
  const jf = path.join(OUT, `shape-${LABEL}.json`)
  fs.writeFileSync(jf, JSON.stringify(report, null, 2))
  const fmt = (v) => (v ? `n=${v.n} r=${v.radius} sh=${v.boxShadow} clip=${v.clipPath} bd=${v.border}` : 'null')
  for (const theme of THEMES) for (const p of PAGES) {
    const d = styles[`${theme}|${p}`]
    if (!d) { log(`STYLE ${theme} ${p} MISSING`); continue }
    log(`STYLE ${theme} ${p}`)
    for (const [fam, sels] of Object.entries(FAMILY)) for (const s of sels) if (d[s]) log(`  [${fam}] ${s} ${fmt(d[s])}`)
  }
  log(`ISO keys=${keys.length} diffs=${diffs.length}`)
  for (const d of diffs.slice(0, 20)) log(`  DIFF ${d.k} light=${JSON.stringify(d.light)} dark=${JSON.stringify(d.dark)}`)
  if (errors.length) { log('ERRORS:'); for (const e of errors) log('  ' + e) }
  log('JSON=' + jf)
  log('SHOTS=' + SHOTS)
  if (errors.length) process.exitCode = 3
}

main().catch((e) => { console.error('FATAL', e && e.stack ? e.stack : e); process.exitCode = 2 })
