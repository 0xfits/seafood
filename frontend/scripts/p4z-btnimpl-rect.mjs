// Unit P6-BTN-IMPL · 真浏览器两档对照（切档 rect 逐值相等 + 口径读数 + 两档截图）
//
// 用法：node scripts/p4z-btnimpl-rect.mjs [baseURL] [shotDir]
//   baseURL 默认 http://localhost:5787（vite 只绑 IPv6 ⇒ 必须用 localhost，用 127.0.0.1 会连不上）
//   shotDir 默认 $TMPDIR/p6-btn-impl-shots（不往仓库写图片）
// 退出码：0 = 两档 rect 逐值相等且无阴影/无渐变；1 = 有差异（stdout 给出逐条差异）；2 = 运行异常
import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5787'
const SHOT_DIR = process.argv[3] || process.env.P6_BTN_SHOT_DIR || path.join(os.tmpdir(), 'p6-btn-impl-shots')
const SELS = { primary_btn_a: '.btn-a', secondary_btn_a_alt: '.btn-a-alt' }

// 浏览器可执行文件解析：优先 $P6_BTN_CHROME；否则自动挑 ms-playwright 缓存里版本号最大的 chrome-headless-shell
// （仓内 playwright 包要求的 revision 与缓存不一致时，避免 `npx playwright install` 额外下载）
const resolveExecutable = () => {
  if (process.env.P6_BTN_CHROME) return process.env.P6_BTN_CHROME
  const roots = [
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright'),
  ]
  const cands = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const d of fs.readdirSync(root)) {
      for (const rel of [
        ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
        ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
        ['chrome-linux', 'chrome-headless-shell'],
      ]) {
        const p = path.join(root, d, rel[0], rel[1])
        if (fs.existsSync(p)) cands.push(p)
      }
    }
  }
  return cands.sort().pop()
}
const MOVE_KEYS = ['x', 'y', 'width', 'height']
const THEME_VARY_KEYS = ['backgroundColor', 'color', 'borderTopColor']

const readPage = async (page) => page.evaluate((sels) => {
  const out = {}
  for (const [name, sel] of Object.entries(sels)) {
    const el = document.querySelector(sel)
    if (!el) { out[name] = null; continue }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    out[name] = {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      cls: el.className,
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderTopColor: cs.borderTopColor,
      borderTopWidth: cs.borderTopWidth,
      borderTopStyle: cs.borderTopStyle,
      borderRadius: cs.borderTopLeftRadius,
      boxShadow: cs.boxShadow,
      backgroundImage: cs.backgroundImage,
      clipPath: cs.clipPath,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      height: cs.height,
    }
  }
  out.__theme = document.documentElement.getAttribute('data-theme')
  return out
}, SELS)

// 切档走应用自身的开关（/theme-preview 的日/夜按钮 ⇒ applyTheme：写 <html data-theme> + localStorage['theme']）
const setTheme = async (page, attr) => {
  await page.goto(`${BASE}/theme-preview`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="toggle-day"]', { timeout: 20000 })
  await page.click(attr === 'light' ? '[data-sf-m="toggle-day"]' : '[data-sf-m="toggle-night"]')
  await page.waitForFunction((a) => document.documentElement.getAttribute('data-theme') === a, attr, { timeout: 10000 })
}

const main = async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const exe = resolveExecutable()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const shots = {}
  const out = {}
  for (const attr of ['light', 'dark']) {
    await setTheme(page, attr)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.btn-a', { timeout: 20000 })
    await page.waitForSelector('.btn-a-alt', { timeout: 20000 })
    out[attr] = await readPage(page)
    const shot = path.join(SHOT_DIR, `p6-btn-impl-${attr}.png`)
    await page.screenshot({ path: shot })
    shots[attr] = shot
  }
  await browser.close()

  const failures = []
  const diffs = {}
  for (const name of Object.keys(SELS)) {
    const d = out.light[name]
    const n = out.dark[name]
    if (!d || !n) { failures.push(`${name}: 未渲染（day=${!!d} night=${!!n}）`); continue }
    for (const k of MOVE_KEYS) {
      if (d.rect[k] !== n.rect[k]) failures.push(`${name}.rect.${k}: day=${d.rect[k]} night=${n.rect[k]}`)
    }
    for (const k of ['paddingLeft', 'paddingRight', 'borderRadius', 'borderTopWidth', 'height']) {
      if (d[k] !== n[k]) failures.push(`${name}.${k}: day=${d[k]} night=${n[k]}`)
    }
    if (d.boxShadow !== 'none' || n.boxShadow !== 'none') failures.push(`${name}.boxShadow: day=${d.boxShadow} night=${n.boxShadow}`)
    if (d.backgroundImage !== 'none' || n.backgroundImage !== 'none') failures.push(`${name}.backgroundImage: day=${d.backgroundImage} night=${n.backgroundImage}`)
    for (const k of THEME_VARY_KEYS) if (d[k] !== n[k]) (diffs[name] = diffs[name] || []).push(k)
  }
  const report = {
    unit: 'P6-BTN-IMPL',
    base: BASE,
    screenshots: shots,
    readout: out,
    rect_identical: failures.length === 0,
    varying_on_theme_switch: diffs,
    failures,
  }
  console.log(JSON.stringify(report, null, 2))
  if (failures.length) process.exitCode = 1
}

main().catch((e) => { console.error('FATAL', e && e.stack ? e.stack : e); process.exitCode = 2 })
