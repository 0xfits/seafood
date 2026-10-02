// Unit P6-UI-CONSIST · 补测 A：窄屏（390）Tab 栏形状语言 + 回读硬阴影完整串（只读）
// 用法: node scripts/p4z-uiconsist-narrow.mjs [baseURL] [outDir]
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

const READ = (sels) => {
  const rd = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { rect: [+r.x.toFixed(2), +r.y.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)],
      borderW: cs.borderTopWidth, borderC: cs.borderTopColor, radius: cs.borderTopLeftRadius,
      shadow: cs.boxShadow, clip: cs.clipPath, bg: cs.backgroundColor, color: cs.color,
      font: cs.fontSize, display: cs.display, pad: cs.paddingTop + ' ' + cs.paddingBottom }
  }
  const out = { innerWidth: window.innerWidth, theme: document.documentElement.getAttribute('data-theme') }
  for (const s of sels) out[s] = rd(s)
  out.tabbarDisplay = (() => { const e = document.querySelector('.sf-tabbar'); return e ? getComputedStyle(e).display : null })()
  return out
}
const SELS = ['.sf-tabbar', '.sf-tab', '.sf-tab.is-active', '.sf-tab-ic', '.sf-listings-card', '.sf-listings-input']

const main = async () => {
  // 1) 先把 probe.json 里的完整阴影串打出来（口径：实测计算值）
  const jf = path.join(OUT, 'probe.json')
  const j = JSON.parse(fs.readFileSync(jf, 'utf8'))
  const want = /(sf-listings-card|sf-listings-panel|sf-mkt-panel|sf-listings-input|sf-mkt-input|sf-mkt-select|sf-listings-tag|sf-listings-price|btn-proceed|btn-inactive|btn-a|sf-btn)/
  console.log('== FULL_COMPUTED (from probe.json, 1280) ==')
  for (const [k, v] of Object.entries(j.readout)) {
    if (v.__error) continue
    for (const [key, e] of Object.entries(v.discovered)) {
      if (!want.test(key)) continue
      console.log(`${k} | ${key} | shadow=${e.shadow} | clip=${e.clip} | border=${e.borderW} ${e.borderS} ${e.borderC} | radius=${e.radius} | bg=${e.bg} | bgImg=${e.bgImg}`)
    }
  }

  // 2) 390 窄屏：Tab 栏形状语言
  const exe = resolveExecutable()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const out = {}
  for (const theme of ['light', 'dark']) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.evaluate((a) => localStorage.setItem('theme', a), theme)
    for (const p of ['/task', '/listing']) {
      try {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(2200)
        let d = await page.evaluate(READ, SELS)
        if (d.innerWidth !== 390) { // §5.7⑥：宽度必须断言 innerWidth，不达则重载重设
          await page.reload({ waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(2000)
          d = await page.evaluate(READ, SELS)
        }
        out[`${theme}|${p}`] = d
        await page.screenshot({ path: path.join(SHOTS, `narrow-${theme}-${p.replace('/', '')}.png`) })
      } catch (e) { out[`${theme}|${p}`] = { __error: String((e && e.message) || e) } }
    }
  }
  // 变体 B 窄屏对照（仅无头注入，不写仓）
  await page.goto(BASE + '/task', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.addStyleTag({ content: '[class*="tab"]{border-radius:6px!important}[class*="card"]{border-radius:8px!important;box-shadow:none!important}' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(SHOTS, 'narrow-light-task-variantB.png') })
  const vb = await page.evaluate(READ, SELS)
  await browser.close()

  fs.writeFileSync(path.join(OUT, 'narrow.json'), JSON.stringify({ out, variantB_narrow: vb }, null, 2))
  console.log('== NARROW 390 ==')
  for (const [k, v] of Object.entries(out)) {
    if (v.__error) { console.log(`${k} ERROR ${v.__error}`); continue }
    console.log(`${k} innerWidth=${v.innerWidth} theme=${v.theme} tabbarDisplay=${v.tabbarDisplay}`)
    for (const s of SELS) if (v[s]) console.log(`  ${s} rect=${JSON.stringify(v[s].rect)} b=${v[s].borderW}/${v[s].borderC} r=${v[s].radius} sh=${v[s].shadow} clip=${v[s].clip} bg=${v[s].bg} font=${v[s].font} display=${v[s].display}`)
  }
  console.log(`VARIANT_B_narrow tab=${JSON.stringify(vb['.sf-tab'])} card=${JSON.stringify(vb['.sf-listings-card'])}`)
}

main().catch((e) => { console.error('FATAL', e && e.stack ? e.stack : e); process.exitCode = 2 })
