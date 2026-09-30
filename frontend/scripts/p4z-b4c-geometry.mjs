// P4-B4c-i ① 真实浏览器几何量测（Playwright + 本机 Chromium）
// 目标：拿「主题切换前后同一批元素 getBoundingClientRect 逐值相等」的机器证据，
//       并给这把尺子做灵敏度对照（1px 刻意错位必须被判出）与可重复性对照（同档重复量测逐字节相同）。
// 无 dev server、无静态服务：用 page.route 把 http://sf.local/** 映射到 frontend/dist 磁盘文件，
// 外部 CDN（Google Fonts / Tailwind CDN / jsDelivr）一律 abort ⇒ 量测环境完全本地、确定性可复现。
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../dist')
const OUT_DIR = '/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b4c-20260930T210239'
const OUT = path.join(OUT_DIR, 'geometry.json')
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

const ROUND = (r) => ({ x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) })

// 页面内量测脚本（返回 JSON 字符串）
const MEASURE_JS = `(() => {
  const keys = ['[data-sf-m="hero"]','[data-sf-m="search"]','[data-sf-m="chips"]','[data-sf-m="layout"]','[data-sf-m="grid"]','[data-sf-m="card-1"]','[data-sf-m="card-4"]','[data-sf-m="side"]','[data-sf-m="price-1"]','[data-sf-m="toggle-day"]','[data-sf-m="toggle-night"]','[data-sf-region="tabbar"]','[data-sf-region="topnav"]','#sf-route-container']
  const rects = {}
  for (const sel of keys) {
    const el = document.querySelector(sel)
    if (!el) { rects[sel] = null; continue }
    const r = el.getBoundingClientRect()
    rects[sel] = { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) }
  }
  const card = document.querySelector('[data-sf-m="card-1"]')
  const cs = card ? getComputedStyle(card) : null
  const tabbarEl = document.querySelector('[data-sf-region="tabbar"]')
  const shell = document.querySelector('[data-sf-region="shell"]')
  return JSON.stringify({
    theme: window.__sfThemePreview ? window.__sfThemePreview.getTheme() : null,
    attr: document.documentElement.getAttribute('data-theme'),
    rects,
    skin: cs ? { bg: cs.backgroundColor, borderColor: cs.borderTopColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow } : null,
    tabbar: tabbarEl ? { display: getComputedStyle(tabbarEl).display, cols: getComputedStyle(tabbarEl).gridTemplateColumns, rect: (() => { const r = tabbarEl.getBoundingClientRect(); return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) } })() } : null,
    shellBg: shell ? getComputedStyle(shell).backgroundColor : null,
    tabRects: Array.from(document.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => {
      const r = a.getBoundingClientRect()
      return { nav: a.getAttribute('data-sf-nav'), href: a.getAttribute('href'), x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) }
    }),
    // DOM 结构签名：区域序列 + 底栏 tab 序列（顺序与语义绑定），不含 class/文本
    signature: Array.from(document.querySelectorAll('[data-sf-region],[data-sf-nav]')).map((el) => el.tagName + '[' + (el.getAttribute('data-sf-region') || 'nav=' + el.getAttribute('data-sf-nav')) + ']').join('>'),
    elementCount: document.querySelectorAll('*').length,
    tokenProbe: {
      pageBg: getComputedStyle(document.querySelector('[data-sf-region="shell"]')).backgroundColor,
      cardRadius: cs ? cs.borderTopLeftRadius : null,
      cardShadow: cs ? cs.boxShadow : null,
      cardBorder: cs ? cs.borderTopColor : null,
    },
  })
})()`

const main = async () => {
  const evidence = { startedAt: new Date().toISOString(), origin: ORIGIN, dist: DIST, arms: {}, notes: [] }
  // 本机 Chromium 版本与 playwright 期望不一致（缺 chromium_headless_shell-1208）⇒
  // 不经下载、直接用本机真实 Google Chrome（用户浏览器），playwright 自动使用独立临时 profile，
  // 绝不触碰用户自己的 Chrome profile；探针结束即关闭。
  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await chromium.launch({ executablePath: CHROME })
  evidence.browserVersion = browser.version()
  evidence.executablePath = CHROME
  let server = 'playwright-route-disk'
  evidence.notes.push(`静态资源不经网络服务：page.route 把 ${ORIGIN}/** 映射到 ${DIST}（${server}）；外部 CDN 请求一律 abort。`)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()

  const blocked = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) {
      blocked.push(url.href)
      return route.abort()
    }
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ path: file, contentType: MIME[path.extname(file)] || 'application/octet-stream' })
  })

  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))

  await page.goto(`${ORIGIN}/theme-preview`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__sfThemePreview, null, { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)

  const read = async () => JSON.parse(await page.evaluate(MEASURE_JS))

  // 稳定帧协议：连续两次读数逐字节相同才算稳定（避免采到过渡态）
  const stable = async (label) => {
    let prev = null
    for (let i = 0; i < 40; i += 1) {
      const cur = await read()
      if (prev && JSON.stringify(prev) === JSON.stringify(cur)) {
        evidence.arms[`${label}_stable_reads`] = i + 1
        return cur
      }
      prev = cur
      await page.waitForTimeout(250)
    }
    throw new Error(`unstable: ${label}`)
  }

  const setTheme = async (theme) => {
    await page.evaluate((t) => window.__sfThemePreview.setTheme(t), theme)
    await page.waitForTimeout(150)
    return stable(`after_set_${theme}`)
  }

  // ---------- 臂 1：日档基线（A1 / A2 两次，判尺子可重复） ----------
  const a1 = await setTheme('day')
  const a2 = await stable('day_repeat')
  evidence.arms.day_A1 = a1
  evidence.arms.day_A2 = a2
  evidence.arms.day_repeat_byte_identical = JSON.stringify(a1) === JSON.stringify(a2)

  // ---------- 臂 2：尺子灵敏度 —— 1px 刻意错位必须被判出，且整条 style 复原后逐字节回基线 ----------
  const perturb = await page.evaluate(() => {
    const el = document.querySelector('[data-sf-m="chips"]')
    const snapshot = el.getAttribute('style')
    el.style.paddingTop = '1px'
    const r = el.getBoundingClientRect()
    return { snapshot, rect: { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) } }
  })
  const perturbed = await stable('perturbed')
  evidence.arms.perturbation = {
    target: '[data-sf-m="chips"]',
    injected: 'padding-top: 1px',
    before: a1.rects['[data-sf-m="chips"]'],
    after: perturbed.rects['[data-sf-m="chips"]'],
    detected: JSON.stringify(a1.rects['[data-sf-m="chips"]']) !== JSON.stringify(perturbed.rects['[data-sf-m="chips"]']),
  }
  await page.evaluate((snapshot) => {
    const el = document.querySelector('[data-sf-m="chips"]')
    if (snapshot === null) el.removeAttribute('style')
    else el.setAttribute('style', snapshot)
  }, perturb.snapshot)
  const restored = await stable('restored')
  evidence.arms.perturbation_restored = restored.rects['[data-sf-m="chips"]']
  evidence.arms.perturbation_restored_byte_identical = JSON.stringify(a1.rects) === JSON.stringify(restored.rects)

  // ---------- 臂 3：切到夜档（主题同构的核心读数） ----------
  const night = await setTheme('night')
  evidence.arms.night = night

  // ---------- 臂 4：切回日档（必须逐字节回基线 = 无状态残留） ----------
  const back = await setTheme('day')
  evidence.arms.day_return = back
  evidence.arms.day_return_byte_identical = JSON.stringify(a1) === JSON.stringify(back)

  // ---------- 判定 ----------
  const geoDiff = []
  for (const key of Object.keys(a1.rects)) {
    if (JSON.stringify(a1.rects[key]) !== JSON.stringify(night.rects[key])) {
      geoDiff.push({ key, day: a1.rects[key], night: night.rects[key] })
    }
  }
  evidence.verdict = {
    measured_elements: Object.keys(a1.rects).length,
    geometry_diff_count: geoDiff.length,
    geometry_diffs: geoDiff,
    skin_changed: JSON.stringify(a1.skin) !== JSON.stringify(night.skin),
    day_skin: a1.skin,
    night_skin: night.skin,
    same_dom_signature_day_vs_night: a1.signature === night.signature,
    element_count_day: a1.elementCount,
    element_count_night: night.elementCount,
    attr_day: a1.attr,
    attr_night: night.attr,
    theme_flag_a1: a1.theme,
    theme_flag_night: night.theme,
  }

  // ---------- 臂 5：横竖屏（1440 / 390）DOM 结构同构，差异只落在导航形态与栅格 ----------
  const wide = await stable('wide_1440')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  const portrait = await stable('portrait_390')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(300)
  const wideBack = await stable('wide_back')
  evidence.arms.wide_1440 = wide
  evidence.arms.portrait_390 = portrait
  evidence.arms.wide_return = wideBack
  evidence.responsive = {
    signature_equal_wide_vs_portrait: wide.signature === portrait.signature,
    signature_equal_wide_vs_wideBack: wide.signature === wideBack.signature,
    element_count_wide: wide.elementCount,
    element_count_portrait: portrait.elementCount,
    tabbar_display_wide: wide.tabbar ? wide.tabbar.display : null,
    tabbar_display_portrait: portrait.tabbar ? portrait.tabbar.display : null,
    topnav_rect_wide: wide.rects['[data-sf-region="topnav"]'],
    topnav_rect_portrait: portrait.rects['[data-sf-region="topnav"]'],
    tabbar_rect_wide: wide.rects['[data-sf-region="tabbar"]'],
    tabbar_rect_portrait: portrait.rects['[data-sf-region="tabbar"]'],
    tab_rects_wide: wide.tabRects,
    tab_rects_portrait: portrait.tabRects,
    grid_rect_wide: wide.rects['[data-sf-m="grid"]'],
    grid_rect_portrait: portrait.rects['[data-sf-m="grid"]'],
  }

  evidence.blocked_external_requests = Array.from(new Set(blocked.map((u) => new URL(u).origin)))
  evidence.page_errors = pageErrors
  evidence.finishedAt = new Date().toISOString()

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2))
  await browser.close()

  console.log(JSON.stringify({
    out: OUT,
    measured_elements: evidence.verdict.measured_elements,
    geometry_diff_count: evidence.verdict.geometry_diff_count,
    skin_changed: evidence.verdict.skin_changed,
    day_repeat_byte_identical: evidence.arms.day_repeat_byte_identical,
    day_return_byte_identical: evidence.arms.day_return_byte_identical,
    perturbation_detected: evidence.arms.perturbation.detected,
    perturbation_restored_byte_identical: evidence.arms.perturbation_restored_byte_identical,
    same_dom_signature_day_vs_night: evidence.verdict.same_dom_signature_day_vs_night,
    signature_equal_wide_vs_portrait: evidence.responsive.signature_equal_wide_vs_portrait,
    tabbar_display_wide: evidence.responsive.tabbar_display_wide,
    tabbar_display_portrait: evidence.responsive.tabbar_display_portrait,
    element_count_wide: evidence.responsive.element_count_wide,
    element_count_portrait: evidence.responsive.element_count_portrait,
    page_errors: evidence.page_errors,
    blocked_origins: evidence.blocked_external_requests,
  }, null, 2))
}

main().catch((e) => {
  console.error('PROBE_FAILED', e)
  process.exitCode = 1
})
