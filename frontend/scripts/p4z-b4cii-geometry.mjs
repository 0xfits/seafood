// P4-B4c-ii-a ② 真实浏览器几何量测（复用 4c-i 的 `p4z-b4c-geometry.mjs` 尺子，改目标页为本单新增页）
// 目标：新增页（/task/new 发布、/task/review 审核入口）在**日/夜两档 rect 逐值相等**，
//       并沿用三条对照：① 尺子灵敏度（1px 刻意错位必须判出）② 可重复性（同档两次逐字节相同）
//       ③ 横竖屏（1440 / 390）结构签名不变（差异只允许落在 nav 形态 / 栅格降列 —— 与主题无关）。
// 无 dev server、无静态服务：page.route 把 http://sf.local/** 映射到 frontend/dist 磁盘文件；
// 外部 CDN 一律 abort ⇒ 量测环境完全本地、确定性可复现。主题切换 = 直接改 <html data-theme>
//（`[data-theme="dark"]` = 夜档，真源 `src/theme/theme-tokens.css:155`；与 ThemeProvider/main.jsx 同一属性），
// 并用「skin 值确实变了」证明这把尺子不是对着一个没换肤的页面量出来的。
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../dist')
const OUT_DIR = process.argv[2]
if (!OUT_DIR) throw new Error('usage: node scripts/p4z-b4cii-geometry.mjs <runDirAbs>')
const OUT = path.join(OUT_DIR, 'post', 'b4cii-geometry.json')
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

const PAGES = [
  { name: 'task_new', url: `${ORIGIN}/task/new` },
  { name: 'task_review', url: `${ORIGIN}/task/review` },
]

const SELECTORS = [
  '[data-sf-region="topnav"]',
  '[data-sf-region="content"]',
  '[data-sf-region="tabbar"]',
  '#sf-route-container',
  '[data-sf-m="jobs-hero"]',
  '[data-sf-m="jobs-form"]',
  '[data-sf-m="jobs-input-title"]',
  '[data-sf-m="jobs-input-reward"]',
  '[data-sf-m="jobs-primary"]',
  '[data-sf-m="jobs-status"]',
  '[data-sf-m="jobs-side"]',
  '[data-sf-m="jobs-queue"]',
  '[data-sf-m="jobs-refresh"]',
  '[data-sf-region="footer"]',
]

const MEASURE_JS = `(() => {
  const keys = ${JSON.stringify(SELECTORS)}
  const rects = {}
  for (const sel of keys) {
    const el = document.querySelector(sel)
    if (!el) { rects[sel] = null; continue }
    const r = el.getBoundingClientRect()
    rects[sel] = { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) }
  }
  const card = document.querySelector('[data-sf-m="jobs-form"]') || document.querySelector('[data-sf-m="jobs-queue"]')
  const cs = card ? getComputedStyle(card) : null
  const tabbarEl = document.querySelector('[data-sf-region="tabbar"]')
  return JSON.stringify({
    attr: document.documentElement.getAttribute('data-theme'),
    path: location.pathname,
    rects,
    skin: cs ? { bg: cs.backgroundColor, borderColor: cs.borderTopColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, color: cs.color } : null,
    pageBg: getComputedStyle(document.querySelector('[data-sf-region="shell"]') || document.body).backgroundColor,
    tabbar: tabbarEl ? { display: getComputedStyle(tabbarEl).display, cols: getComputedStyle(tabbarEl).gridTemplateColumns } : null,
    signature: Array.from(document.querySelectorAll('[data-sf-region],[data-sf-nav]')).map((el) => el.tagName + '[' + (el.getAttribute('data-sf-region') || 'nav=' + el.getAttribute('data-sf-nav')) + ']').join('>'),
    elementCount: document.querySelectorAll('*').length,
    hasObjectObject: document.body.innerText.includes('[object Object]'),
  })
})()`

const main = async () => {
  const evidence = { startedAt: new Date().toISOString(), origin: ORIGIN, dist: DIST, pages: PAGES.map((p) => p.name), arms: {}, verdict: {}, notes: [] }
  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await chromium.launch({ executablePath: CHROME })
  evidence.browserVersion = browser.version()
  evidence.executablePath = CHROME
  evidence.notes.push(`静态资源不经网络服务：page.route 把 ${ORIGIN}/** 映射到 ${DIST}；外部 CDN 请求一律 abort。`)
  evidence.notes.push('主题切换 = 直接改 <html data-theme>（light/dark）；真换肤由 skin/pageBg 值变化证明。')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  // 量测「已登录形态」的表单/面板：localStorage['user'] 带 token ⇒ useAuth().isAuthenticated = true
  //（`frontend/src/auth.js:35` 读同一键）。**API 调用在本探针内不联网**（同源 /api/** 落 dist 兜底 index.html
  // ⇒ JSON 解析失败 ⇒ 页面进确定性「失败态」文案，正好把错误态也纳入几何量测）。
  await context.addInitScript(() => {
    try { window.localStorage.setItem('user', JSON.stringify({ uID: 1, EVM: '0xprobe', token: 'probe-token' })) } catch { /* 隐私模式忽略 */ }
  })
  const page = await context.newPage()

  const blocked = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) { blocked.push(url.href); return route.abort() }
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ path: file, contentType: MIME[path.extname(file)] || 'application/octet-stream' })
  })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))

  const read = async () => JSON.parse(await page.evaluate(MEASURE_JS))
  const stable = async (label) => {
    let prev = null
    for (let i = 0; i < 40; i += 1) {
      const cur = await read()
      if (prev && JSON.stringify(prev) === JSON.stringify(cur)) { evidence.arms[`${label}_stable_reads`] = i + 1; return cur }
      prev = cur
      await page.waitForTimeout(250)
    }
    throw new Error(`unstable: ${label}`)
  }
  const setTheme = async (attr, label) => {
    await page.evaluate((a) => document.documentElement.setAttribute('data-theme', a), attr)
    await page.waitForTimeout(150)
    return stable(label)
  }

  for (const p of PAGES) {
    await page.goto(p.url, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(400)

    const day1 = await setTheme('light', `${p.name}_day1`)
    const day2 = await stable(`${p.name}_day2`)
    evidence.arms[`${p.name}_day_repeat_byte_identical`] = JSON.stringify(day1) === JSON.stringify(day2)

    // 尺子灵敏度：1px 刻意错位（改 [data-sf-m="jobs-form"] 的 padding-top）
    const target = '[data-sf-m="jobs-form"]'
    const snapshot = await page.evaluate((sel) => {
      const el = document.querySelector(sel); if (!el) return null
      const prev = el.getAttribute('style'); el.style.paddingTop = '1px'; return prev
    }, target)
    const perturbed = await stable(`${p.name}_perturbed`)
    evidence.arms[`${p.name}_perturbation`] = {
      target,
      injected: 'padding-top: 1px',
      day: day1.rects[target],
      perturbed: perturbed.rects[target],
      detected: JSON.stringify(day1.rects[target]) !== JSON.stringify(perturbed.rects[target]),
    }
    if (snapshot !== undefined) {
      await page.evaluate(({ sel, prev }) => {
        const el = document.querySelector(sel); if (!el) return
        if (prev === null) el.removeAttribute('style'); else el.setAttribute('style', prev)
      }, { sel: target, prev: snapshot })
    }
    const restored = await stable(`${p.name}_restored`)
    evidence.arms[`${p.name}_perturbation_restored_byte_identical`] = JSON.stringify(day1.rects) === JSON.stringify(restored.rects)

    // 核心读数：夜档
    const night = await setTheme('dark', `${p.name}_night`)
    const back = await setTheme('light', `${p.name}_back`)
    evidence.arms[`${p.name}_night`] = night
    evidence.arms[`${p.name}_day_return_byte_identical`] = JSON.stringify(day1) === JSON.stringify(back)

    const geoDiff = Object.keys(day1.rects).filter((k) => JSON.stringify(day1.rects[k]) !== JSON.stringify(night.rects[k]))
      .map((k) => ({ key: k, day: day1.rects[k], night: night.rects[k] }))
    evidence.verdict[p.name] = {
      measured_elements: Object.keys(day1.rects).length,
      present_elements: Object.values(day1.rects).filter(Boolean).length,
      geometry_diff_count: geoDiff.length,
      geometry_diffs: geoDiff,
      skin_changed: JSON.stringify(day1.skin) !== JSON.stringify(night.skin) || day1.pageBg !== night.pageBg,
      day_skin: day1.skin,
      night_skin: night.skin,
      page_bg_day: day1.pageBg,
      page_bg_night: night.pageBg,
      attr_day: day1.attr,
      attr_night: night.attr,
      same_dom_signature_day_vs_night: day1.signature === night.signature,
      element_count_day: day1.elementCount,
      element_count_night: night.elementCount,
      contains_object_object: day1.hasObjectObject,
      day_repeat_byte_identical: evidence.arms[`${p.name}_day_repeat_byte_identical`],
      day_return_byte_identical: evidence.arms[`${p.name}_day_return_byte_identical`],
      perturbation_detected: evidence.arms[`${p.name}_perturbation`].detected,
      perturbation_restored_byte_identical: evidence.arms[`${p.name}_perturbation_restored_byte_identical`],
    }

    // 横竖屏同构（结构签名 + 底栏形态）
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const portrait = await stable(`${p.name}_portrait390`)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)
    const wideBack = await stable(`${p.name}_wide_back`)
    evidence.arms[`${p.name}_portrait390`] = portrait
    evidence.verdict[p.name].responsive = {
      signature_equal_wide_vs_portrait: day1.signature === portrait.signature,
      signature_equal_wide_vs_wideBack: day1.signature === wideBack.signature,
      tabbar_display_wide: day1.tabbar ? day1.tabbar.display : null,
      tabbar_display_portrait: portrait.tabbar ? portrait.tabbar.display : null,
      element_count_wide: day1.elementCount,
      element_count_portrait: portrait.elementCount,
    }
  }

  evidence.blocked_external_origins = Array.from(new Set(blocked.map((u) => new URL(u).origin)))
  evidence.page_errors = pageErrors
  evidence.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.join(OUT_DIR, 'post'), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2))
  await browser.close()

  const summary = { out: OUT, page_errors: pageErrors, blocked_origins: evidence.blocked_external_origins }
  for (const p of PAGES) summary[p.name] = evidence.verdict[p.name]
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exitCode = 1 })
