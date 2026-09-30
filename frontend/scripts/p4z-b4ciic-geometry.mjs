// P4-B4c-ii-c ③ 真实浏览器几何量测（复制 4c-ii-b 的 `p4z-b4ciib-geometry.mjs` 尺子，目标页换成本单改动页：/shard · /login）
// 目标：本单页面（/listing 商品列表、/listing/new 上架、/listing/1 详情、/shard 交易所线）在**日/夜两档 rect 逐值相等**，
//       三条对照照旧：① 尺子灵敏度（1px 刻意错位必须判出）② 可重复性（同档两次逐字节相同）
//       ③ 横竖屏（1440 / 390）结构签名不变（差异只允许落在 nav 形态 / 栅格降列 —— 与主题无关）。
// 无 dev server、无静态服务：page.route 把 http://sf.local/** 映射到 frontend/dist 磁盘文件；外部 CDN 一律 abort。
// 主题切换 = 直接改 <html data-theme>（`[data-theme="dark"]` = 夜档），并用 skin/pageBg 值变化证明尺子确实换了肤。
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../dist')
const OUT_DIR = process.argv[2]
if (!OUT_DIR) throw new Error('usage: node scripts/p4z-b4ciib-geometry.mjs <runDirAbs>')
const OUT = path.join(OUT_DIR, 'post', 'b4ciic-geometry.json')
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

// 本单新增/改动的页面（`/shard` = 交易所线，本单整体换页；路由与导航未动）
const PAGES = [
  // 本单 ② 改动页：交易所线（退化币对空态分支 + 不发请求）
  { name: 'market', url: `${ORIGIN}/shard`, perturb: '[data-sf-m="mkt-form"]' },
  // 本单 ① 改动页：登录面板（WalletAuthPanel 根节点新增 data-sf-m 供尺子取点）
  { name: 'login', url: `${ORIGIN}/login`, perturb: '[data-sf-m="auth-wallet-panel"]' },
]

const SELECTORS = [
  '[data-sf-region="topnav"]',
  '[data-sf-region="content"]',
  '[data-sf-region="tabbar"]',
  '#sf-route-container',
  '[data-sf-region="footer"]',
  // 商品线
  '[data-sf-m="listing-feed-hero"]',
  '[data-sf-m="listing-grid"]',
  '[data-sf-m="listing-card"]',
  '[data-sf-m="listing-thumb"]',
  '[data-sf-m="listing-orders"]',
  '[data-sf-m="listing-refund"]',
  '[data-sf-m="listing-input-order"]',
  '[data-sf-m="listing-refund-btn"]',
  '[data-sf-m="listing-hero"]',
  '[data-sf-m="listing-form"]',
  '[data-sf-m="listing-input-title"]',
  '[data-sf-m="listing-input-price"]',
  '[data-sf-m="listing-primary"]',
  '[data-sf-m="listing-status"]',
  '[data-sf-m="listing-side"]',
  '[data-sf-m="listing-detail-hero"]',
  '[data-sf-m="listing-detail-empty"]',
  '[data-sf-m="listing-buy-form"]',
  '[data-sf-m="listing-input-qty"]',
  '[data-sf-m="listing-buy-btn"]',
  '[data-sf-m="listing-buy-status"]',
  '[data-sf-m="listing-detail-side"]',
  // 交易所线
  '[data-sf-m="mkt-hero"]',
  '[data-sf-m="mkt-ticker"]',
  '[data-sf-m="mkt-form"]',
  '[data-sf-m="mkt-input-base"]',
  '[data-sf-m="mkt-input-price"]',
  '[data-sf-m="mkt-input-amount"]',
  '[data-sf-m="mkt-primary"]',
  '[data-sf-m="mkt-status"]',
  '[data-sf-m="mkt-book"]',
  '[data-sf-m="mkt-book-empty"]',
  '[data-sf-m="mkt-trades"]',
  '[data-sf-m="mkt-trades-empty"]',
  '[data-sf-m="mkt-mine"]',
  '[data-sf-m="mkt-cancel-all"]',
  '[data-sf-m="mkt-ledger"]',
  '[data-sf-m="mkt-ledger-empty"]',
  // 登录面板（本单 ①）
  '[data-sf-m="auth-wallet-panel"]',
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
  const card = document.querySelector('[data-sf-m="listing-card"]') || document.querySelector('[data-sf-m="mkt-form"]')
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
  // 量测「已登录形态」：localStorage['user'] 带 token ⇒ useAuth().isAuthenticated = true。
  // API 调用在本探针内**不联网**（同源 /api/** 落 dist 兜底 index.html ⇒ JSON 解析失败 ⇒ 页面进确定性「失败态」文案，
  // 正好把 R107 失败态也纳入几何量测；文案必须是字符串，不得出现 [object Object]）。
  await context.addInitScript(() => {
    try { window.localStorage.setItem('user', JSON.stringify({ uID: 1, EVM: '0xprobe', token: 'probe-token', bio: 'probe profile ready' })) } catch { /* 隐私模式忽略 */ }
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

    // 尺子灵敏度：1px 刻意错位（改本页主面板的 padding-top）
    const target = p.perturb
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
