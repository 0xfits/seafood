// Unit P6-UI-CONSIST · 只读取数脚本 v2（**不写仓、不改站**）
// 1) 生产站两档（light/dark）× 5 个代表页：**经验发现**所有「卡片/输入框/芯片/Tab/按钮」类元素的实测计算样式
// 2) 变体 A/B/C 对照截图：只在自己的无头页面里注入 CSS（addStyleTag），不落任何仓内文件
// 用法: node scripts/p4z-uiconsist-probe.mjs [baseURL] [outDir]
import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.argv[2] || 'https://ssseafood.vercel.app'
const OUT = process.argv[3] || path.join(os.homedir(), '.hermes/profiles/zang/cache/scratch/p6-uiconsist')
const SHOTS = path.join(OUT, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

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

const PAGES = ['/', '/login', '/task', '/listing', '/shard']
const THEMES = ['light', 'dark']

// 变体：用「属性子串」选择器 ⇒ 覆盖面经验化，并回读命中的具体 class（自证命中）
const CLS = {
  card: '[class*="card"],[class*="panel"]',
  item: '[class*="item"]',
  field: 'input,select,textarea,[class*="input"],[class*="box"],[class*="search"]',
  chip: '[class*="chip"],[class*="tag"],[class*="badge"]',
  tab: '[class*="tab"]',
}
const R8 = 'border-radius:8px!important;box-shadow:none!important'
const V = {
  A: `/* 变体 A（最小）：只动与按钮直接相邻的卡片外框 + 输入框 */\n${CLS.card},${CLS.item},${CLS.field}{${R8}}`,
  B: `/* 变体 B（成套）：卡片 + 输入框 + 芯片 + Tab 统一扁平圆角（色板/布局不动） */\n${CLS.card},${CLS.item},${CLS.field}{${R8}}\n${CLS.chip}{border-radius:6px!important;box-shadow:none!important}\n${CLS.tab}{border-radius:6px!important}`,
  C: `/* 变体 C（折中）：只去切角 + 硬位移阴影，保留黑边与既有圆角 */\n${CLS.card},${CLS.item},${CLS.field},${CLS.chip},${CLS.tab},.btn,.sf-btn{clip-path:none!important;-webkit-clip-path:none!important;box-shadow:none!important}`,
}

const READER = `(() => {
  const rd = (el) => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return {
    rect: [+r.x.toFixed(2), +r.y.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)],
    borderW: cs.borderTopWidth, borderS: cs.borderTopStyle, borderC: cs.borderTopColor,
    radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, clip: cs.clipPath,
    bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0, 60), color: cs.color,
    padX: cs.paddingLeft, font: cs.fontSize, display: cs.display } }
  const RE = /(card|panel|chip|tag|badge|box|search|input|select|tab|btn|item|price|foot|fab)/i
  const seen = {}
  for (const el of document.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase()
    const isField = ['input', 'select', 'textarea'].includes(tag)
    const cls = typeof el.className === 'string' ? el.className : ''
    if (!isField && !RE.test(cls)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 12 || r.height < 10) continue
    const key = (isField ? tag + ':' : '') + cls.split(/\\s+/).filter((c) => RE.test(c)).sort().join('.')
    if (seen[key]) continue
    seen[key] = { tag, cls: cls.slice(0, 120), ...rd(el) }
  }
  return { theme: document.documentElement.getAttribute('data-theme'), innerWidth: window.innerWidth,
    pathname: location.pathname, discovered: seen }
})()`

const setTheme = async (page, attr) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.evaluate((a) => localStorage.setItem('theme', a), attr)
}

const VARPROBE = (sels) => {
  const rd = (sel) => {
    const els = [...document.querySelectorAll(sel)]
    const el = els.find((e) => e.getBoundingClientRect().width > 12)
    if (!el) return null
    const cs = getComputedStyle(el)
    return { n: els.length, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60), radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, clip: cs.clipPath, borderC: cs.borderTopColor, borderW: cs.borderTopWidth }
  }
  const out = {}
  for (const k of Object.keys(sels)) out[k] = rd(sels[k])
  return out
}

const main = async () => {
  const exe = resolveExecutable()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const readout = {}, shots = {}

  for (const theme of THEMES) {
    await setTheme(page, theme)
    for (const p of PAGES) {
      const key = `${theme}|${p}`
      try {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 20000 }).catch(() => {})
        await page.waitForTimeout(2200) // ≤3s 单次等待
        const data = await page.evaluate(READER)
        if (!data || data.innerWidth !== 1280) throw new Error(`innerWidth=${data && data.innerWidth}（视口档未生效）`)
        readout[key] = data
        const shot = path.join(SHOTS, `base-${theme}-${p.replace(/[^a-z]/gi, '') || 'root'}.png`)
        await page.screenshot({ path: shot })
        shots[key] = shot
      } catch (e) {
        readout[key] = { __error: String((e && e.message) || e) }
      }
    }
  }

  const VARIANTS = {}
  for (const theme of THEMES) {
    await setTheme(page, theme)
    for (const p of ['/task', '/listing']) {
      for (const name of ['base', 'A', 'B', 'C']) {
        try {
          await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 })
          await page.waitForTimeout(2000)
          if (name !== 'base') await page.addStyleTag({ content: V[name] })
          await page.waitForTimeout(400)
          VARIANTS[`${theme}|${p}|${name}`] = await page.evaluate(VARPROBE, CLS)
          await page.screenshot({ path: path.join(SHOTS, `variant-${theme}-${p.replace('/', '')}-${name}.png`) })
        } catch (e) {
          VARIANTS[`${theme}|${p}|${name}`] = { __error: String((e && e.message) || e) }
        }
      }
    }
  }

  await browser.close()
  const report = { unit: 'P6-UI-CONSIST', base: BASE, at: new Date().toISOString(), selector_groups: CLS, screenshots: shots, readout, variants: VARIANTS }
  const jf = path.join(OUT, 'probe.json')
  fs.writeFileSync(jf, JSON.stringify(report, null, 2))

  for (const theme of THEMES) {
    for (const p of PAGES) {
      const d = readout[`${theme}|${p}`]
      if (!d || d.__error) { console.log(`PAGE ${theme} ${p} ERROR ${d && d.__error}`); continue }
      console.log(`PAGE ${theme} ${p} -> pathname=${d.pathname} innerWidth=${d.innerWidth} keys=${Object.keys(d.discovered).length}`)
      for (const [k, v] of Object.entries(d.discovered)) {
        const sh = v.shadow === 'none' ? 'none' : v.shadow.replace(/rgba?\([^)]*\)/g, '…')
        console.log(`  ${k} <${v.tag}> rect=${JSON.stringify(v.rect)} b=${v.borderW}/${v.borderS}/${v.borderC} r=${v.radius} sh=${sh} clip=${v.clip === 'none' ? 'none' : 'CLIP'} bg=${v.bg}`)
      }
    }
  }
  for (const k of Object.keys(VARIANTS)) {
    const v = VARIANTS[k]
    if (v.__error) { console.log(`VAR ${k} ERROR ${v.__error}`); continue }
    const parts = Object.entries(v).map(([g, x]) => `${g}[${x ? `n=${x.n} cls=${x.cls} r=${x.radius} sh=${x.shadow === 'none' ? 'none' : 'HARD'} clip=${x.clip === 'none' ? 'none' : 'CLIP'}` : 'null'}]`)
    console.log(`VAR ${k} ${parts.join(' ')}`)
  }
  console.log('JSON=' + jf)
  console.log('SHOTS=' + SHOTS)
}

main().catch((e) => { console.error('FATAL', e && e.stack ? e.stack : e); process.exitCode = 2 })
