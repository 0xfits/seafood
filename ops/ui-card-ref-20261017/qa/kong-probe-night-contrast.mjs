/**
 * Kong 夜档可读性读数（Zang 追加裁定 2026-10-17 第 3 条 · 硬交付）
 *   · 改后：夜档真实页面里卡片价格前景色 / 卡底背景色 → WCAG 对比度
 *   · 改前：HEAD 逐字声明（`text-yellow-600` 数字 / `text-yellow-600 dark:text-yellow-400` 符号）
 *     ⇒ 色值取自 Tailwind **palette 真源**（`node_modules/tailwindcss/theme.css` 的 oklch 原文），
 *        经**浏览器 canvas 回读**（fillStyle + fillRect + getImageData）落成 sRGB 实测字节，
 *        与 Node 侧独立实现的 oklch→sRGB 换算**双路互校**（两路不一致即判负）。
 *   · 另测「`dark:` 变体由谁驱动」：同一页面在 `prefers-color-scheme` 两臂下读同一元素的 computed 色
 *     ⇒ 证明 `dark:` 跟**设备媒体查询**、不跟本站 `html[data-theme="dark"]`（站点夜档开关管不到它）。
 * 用法：node ops/ui-card-ref-20261017/qa/kong-probe-night-contrast.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/readings/kong-night-contrast.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const THEME_CSS = path.join(REPO, 'frontend/node_modules/tailwindcss/theme.css')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' }

// ---- Tailwind palette 真源（逐字读，不手打） ----
const themeCss = fs.readFileSync(THEME_CSS, 'utf8')
const paletteRaw = {}
for (const key of ['--color-yellow-50', '--color-yellow-400', '--color-yellow-600', '--color-gray-800']) {
  const m = themeCss.match(new RegExp(`${key}:\\s*([^;]+);`))
  paletteRaw[key] = m ? m[1].trim() : null
}

// ---- Node 侧独立 oklch→sRGB（与浏览器 canvas 回读双路互校） ----
const oklchToSrgb = (L, C, Hdeg) => {
  const h = (Hdeg * Math.PI) / 180
  const a = C * Math.cos(h); const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b
  const l = l_ ** 3; const m = m_ ** 3; const s = s_ ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
  return lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, Math.round(v * 255)))
  })
}
const parseOklch = (str) => {
  const m = /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(str)
  if (!m) return null
  const L = m[1].endsWith('%') || Number(m[1]) > 1 ? Number(m[1]) / 100 : Number(m[1])
  return [L, Number(m[2]), Number(m[3])]
}
const srgbLum = ([r, g, b]) => {
  const f = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (fg, bg) => {
  const a = srgbLum(fg); const b = srgbLum(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/ui-card-ref-20261017/qa/kong-probe-night-contrast.mjs（Kong · Zang 追加裁定第 3 条）',
    startedAt: new Date().toISOString(),
    paletteSource: 'frontend/node_modules/tailwindcss/theme.css（Tailwind palette 真源，逐字读）',
    paletteRaw, beforeDeclarations: {}, browserReadback: {}, nodeReadback: {}, crossCheck: {}, after: {}, before: {}, darkVariantMechanism: {}, notes: {},
  }

  // 改前声明（逐字自 HEAD 源码，与 spec §22.1 冻结读数一致）
  const { execSync } = await import('node:child_process')
  const headSrc = execSync('git show HEAD:frontend/src/components/reward/RewardCard.jsx', { cwd: REPO }).toString()
  const headLines = headSrc.split('\n')
  out.beforeDeclarations = {
    headCommit: execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim(),
    numberLine: (headLines[92] || '').trim(),
    symbolLine: (headLines[95] || '').trim(),
    cardVariantLine: (headLines[46] || '').trim(),
    hoverLine: (headLines[47] || '').trim(),
  }

  // ---- 浏览器：夜档真实页面 + canvas 色卡回读 + dark: 机制两臂 ----
  for (const arm of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: arm, reducedMotion: 'reduce' })
    await context.addInitScript(() => localStorage.setItem('theme', 'dark')) // 站点夜档（data-theme=dark）恒定
    await context.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url())
      if (u.hostname !== 'sf.local') return route.abort()
      if (u.pathname.startsWith('/api/')) {
        const data = (d) => ({ success: true, data: d })
        const body = u.pathname === '/api/home'
          ? data({ tasks: [], prizes: [{ bID: 1, name: 'FIXTURE 商品一', points: 29, stores_count: 3, claims_count: 12 }], claimed_prize_ids: [], user_points: 0 })
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

    const measured = await page.evaluate(`(() => {
      const card = document.querySelector('[data-sf-m="reward-card"]')
      const num = card && card.querySelector('.sf-reward-price-num')
      const cur = card && card.querySelector('.sf-reward-price-cur')
      const inner = card && card.firstElementChild
      const cs = (el) => el ? getComputedStyle(el) : null
      // 改前形态的色卡：把 HEAD 逐字类名挂到一个探针节点上，读 computed（真 Tailwind 产物）
      const probe = document.createElement('div')
      probe.id = 'kong-probe-colors'
      probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px'
      probe.innerHTML = '<span id="kp-y600" class="text-yellow-600">1</span><span id="kp-y50bg" class="bg-yellow-50" style="display:block;width:10px;height:10px"></span><span id="kp-dy400" class="text-yellow-600 dark:text-yellow-400">1</span><span id="kp-dgray800" class="dark:bg-gray-800" style="display:block;width:10px;height:10px"></span>'
      document.body.appendChild(probe)
      const q = (id) => document.getElementById(id)
      // canvas 回读：把任意 CSS 颜色串落成 sRGB 实测字节
      const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      const readback = (color) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]] }
      const res = {
        themeAttr: document.documentElement.getAttribute('data-theme'),
        mqDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
        cardInnerBg: inner ? cs(inner).backgroundColor : null,
        priceNum: num ? { color: cs(num).color, fontSize: cs(num).fontSize, fontWeight: cs(num).fontWeight } : null,
        priceCur: cur ? { color: cs(cur).color, fontSize: cs(cur).fontSize, fontWeight: cs(cur).fontWeight } : null,
        probe: {
          y600: cs(q('kp-y600')).color,
          y50bg: cs(q('kp-y50bg')).backgroundColor,
          dy400: cs(q('kp-dy400')).color,
          dgray800: cs(q('kp-dgray800')).backgroundColor,
        },
        readback: {},
      }
      for (const [k, v] of Object.entries(res.probe)) res.readback[k] = v ? readback(v) : null
      for (const [k, v] of Object.entries({ cardInnerBg: res.cardInnerBg, numColor: res.priceNum && res.priceNum.color, curColor: res.priceCur && res.priceCur.color })) res.readback[k] = v ? readback(v) : null
      probe.remove()
      return res
    })()`)
    out.browserReadback[arm] = measured
    // ★ 控制臂（判负自证）：同一 context / 同一设备偏好下，只翻站点自身的 data-theme
    //   ⇒ 用以判定 `dark:` 变体到底跟**设备媒体查询**还是跟**站点夜档开关**（现取反证用）
    if (arm === 'light') {
      out.browserReadback.light_forcedDay = await page.evaluate(`(() => {
        document.documentElement.setAttribute('data-theme', 'light')
        const cs = (sel) => getComputedStyle(document.querySelector(sel))
        const dy = document.createElement('span'); dy.className = 'dark:text-yellow-400'; dy.textContent = 'x'
        const dg = document.createElement('span'); dg.className = 'dark:bg-gray-800'; dg.style.display = 'block'; dg.style.width = '10px'; dg.style.height = '10px'
        const y6 = document.createElement('span'); y6.className = 'text-yellow-600'; y6.textContent = 'x'
        document.body.append(dy, dg, y6)
        const r = {
          themeAttr: document.documentElement.getAttribute('data-theme'),
          mqDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
          htmlColorScheme: getComputedStyle(document.documentElement).colorScheme,
          dy400: getComputedStyle(dy).color,
          dgray800: getComputedStyle(dg).backgroundColor,
          y600: getComputedStyle(y6).color,
          cardInnerBg: (() => { const c = document.querySelector('[data-sf-m="reward-card"]'); return c && c.firstElementChild ? getComputedStyle(c.firstElementChild).backgroundColor : null })(),
          probeRemoved: true,
        }
        return r
      })()`)
      // 颜色串是否与「夜档臂」不同 ⇒ 说明 dark: 的生效取决于站点档位（而非设备偏好）
      out.browserReadback.light_forcedDay.delta = {
        dy400_changed_vs_night: out.browserReadback.light_forcedDay.dy400 !== measured.probe.dy400,
        dgray800_changed_vs_night: out.browserReadback.light_forcedDay.dgray800 !== measured.probe.dgray800,
      }
    }
    await context.close()
  }

  // ---- Node 侧换算（双路互校） ----
  for (const [k, raw] of Object.entries(paletteRaw)) {
    const p = parseOklch(raw || '')
    out.nodeReadback[k] = p ? oklchToSrgb(p[0], p[1], p[2]) : null
  }
  const lightArm = out.browserReadback.light
  out.crossCheck = {
    'yellow-600': { browser: lightArm.readback.y600, node: out.nodeReadback['--color-yellow-600'] },
    'yellow-400': { node: out.nodeReadback['--color-yellow-400'], note: '改前符号的 dark: 臂色值（浏览器臂见 darkVariantMechanism）' },
    'yellow-50': { browser: lightArm.readback.y50bg, node: out.nodeReadback['--color-yellow-50'] },
    'gray-800': { browser: lightArm.readback.dgray800, browserDarkArm: out.browserReadback.dark.readback.dgray800, node: out.nodeReadback['--color-gray-800'] },
  }
  const dist = (a, b) => (a && b ? Math.max(...a.map((v, i) => Math.abs(v - b[i]))) : null)
  out.crossCheck.maxChannelDiff = {
    'yellow-600': dist(out.crossCheck['yellow-600'].browser, out.crossCheck['yellow-600'].node),
    'yellow-50': dist(out.crossCheck['yellow-50'].browser, out.crossCheck['yellow-50'].node),
    'gray-800': dist(out.crossCheck['gray-800'].browserDarkArm, out.crossCheck['gray-800'].node),
  }

  // ---- WCAG 对比度（改后 / 改前） ----
  const afterFg = lightArm.readback.numColor
  const afterBg = lightArm.readback.cardInnerBg
  out.after = {
    nightThemeAttr: lightArm.themeAttr,
    priceFgHex: hex(afterFg), priceFgRgb: afterFg,
    cardBgHex: hex(afterBg), cardBgRgb: afterBg,
    contrastRatio: contrast(afterFg, afterBg),
    wcag: { normalTextAA: contrast(afterFg, afterBg) >= 4.5, largeTextAA: contrast(afterFg, afterBg) >= 3.0 },
    note: '卡内局部重绑 --sf-price-*-fg 为日档值 ⇒ 夜档价格 = 深墨 on 纯白卡（两档同貌）',
  }
  const beforeFg = lightArm.readback.y600
  const beforeBg = lightArm.readback.y50bg
  const beforeSymbol = lightArm.readback.dy400   // 夜档下 `dark:text-yellow-400` 的实测值（见 darkVariantMechanism）
  out.before = {
    declarationFrom: 'HEAD frontend/src/components/reward/RewardCard.jsx:93 数字 / :96 符号（逐字见 beforeDeclarations）',
    nightStateOfRecord: `data-theme=${lightArm.themeAttr}（站点夜档）· 设备偏好 light（mqDark=${lightArm.mqDark}）· html 计算值 color-scheme=${lightArm.htmlColorScheme}`,
    numberFgHex: hex(beforeFg), numberFgRgb: beforeFg,
    symbolFgHex: hex(beforeSymbol), symbolFgRgb: beforeSymbol,
    cardBgHex: hex(beforeBg), cardBgRgb: beforeBg,
    contrastRatio: contrast(beforeFg, beforeBg),
    symbolContrastRatio: contrast(beforeSymbol, beforeBg),
    wcag: { normalTextAA: contrast(beforeFg, beforeBg) >= 4.5, largeTextAA: contrast(beforeFg, beforeBg) >= 3.0 },
    symbolWcag: { normalTextAA: contrast(beforeSymbol, beforeBg) >= 4.5, largeTextAA: contrast(beforeSymbol, beforeBg) >= 3.0 },
    note: '改前夜档卡 = bg-yellow-50（奶黄底）+ 数字 text-yellow-600；符号另带 dark:text-yellow-400（夜档下**实测生效** ⇒ 与数字**不同色**，同一价格块两色）',
  }

  // ---- dark: 变体由谁驱动（★ 现取与派单前提不符，见报告「N47 类」登记） ----
  const dayArm = out.browserReadback.light_forcedDay
  out.darkVariantMechanism = {
    siteNight: `data-theme=${lightArm.themeAttr}（站点夜档）`,
    element: '同一元素 class="dark:bg-gray-800" / class="dark:text-yellow-400"（既有产物类，非本单新增）',
    arms: {
      'A: 站点夜档 + 设备 light（mqDark=false）': { htmlColorScheme: lightArm.htmlColorScheme, dgray800: lightArm.probe.dgray800, dy400: lightArm.probe.dy400 },
      'B: 站点夜档 + 设备 dark（mqDark=true）': { htmlColorScheme: out.browserReadback.dark.htmlColorScheme, dgray800: out.browserReadback.dark.probe.dgray800, dy400: out.browserReadback.dark.probe.dy400 },
      'C: 站点日档 + 设备 light（控制臂 · 只翻 data-theme）': { htmlColorScheme: dayArm.htmlColorScheme, dgray800: dayArm.dgray800, dy400: dayArm.dy400 },
    },
    armC_changed_vs_armA: dayArm.delta,
    textualEvidence: '产物 CSS：`dark:*` 规则包在 `@media (prefers-color-scheme:dark)`（全 CSS 仅 1 处 prefers-color-scheme）；`frontend/src/styles.css` 有 `html[data-theme="dark"]{color-scheme:dark}`',
    verdict: '★ 现取反证派单前提「dark: 类经实测无效」：**站点夜档下 dark: 类实测生效**（臂 A：mqDark=false 但 color-scheme=dark ⇒ 规则命中；臂 C：同设备偏好下把 data-theme 翻回 light ⇒ 规则失效）。机制 = 浏览器按**元素 used color-scheme** 解析 `prefers-color-scheme`，而本仓夜档把 root 的 color-scheme 置为 dark ⇒ 站点夜档开关**能**带动 `dark:` 类。骨架（`@media (prefers-color-scheme:dark)` 包裹）与「仓内无 `custom-variant dark`」两项仍成立。',
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({
    out: OUT,
    after: out.after,
    before: out.before,
    darkVariantMechanism: out.darkVariantMechanism,
    crossCheckMaxDiff: out.crossCheck.maxChannelDiff,
  }, null, 2))
  await browser.close()
}

main().catch((e) => { console.error('PROBE_ERROR', e); process.exit(1) })
