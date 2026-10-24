// 探针：底栏恒 **4 格**（2026-10-24 · Kevin 裁定：只下移动底栏【卖闲置】；桌面悬浮菜单保留）
// 四臂：
//   A 游客 390×844 @/item/new —— 4 格 · 几何四等宽（每格宽 = 底栏宽 / 4）· 零横向溢出 · 点【我的】落登录引导
//   B 假会话 390×844 @/ —— 登录态亦 4 格（底栏对 4 项恒染）
//   C 桌面 1440×900 —— 底栏 display:none、DOM 仍 4 格
//   D 桌面 1536×900 —— 悬浮菜单【卖闲置】**可见**（链上 display 非 none + 尺寸 > 0）且 href = /item/new
// 零真登录 / 零真发布 / 零库写（B 臂 /api/** 拦截回 503，防假 token 触发 401 清会话污染读数）。
// BASE 默认 5800（H5 预览口）；换口：PROBE_BASE=http://localhost:5787 node probe-tabbar.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const BASE = process.env.PROBE_BASE || 'http://localhost:5800'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/Users/kevin/bistro/seafood/ops/tabbar-mine-guest/probe-guest.json'
const EXPECTED_KEYS = ['home', 'shard', 'messages', 'profile']

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const jwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: '999', evm: '0xqa0000000000000000000000000000000000qa', iat: now, sst: now, exp: now + 86400 }),
  'qa-signature-not-verified-locally-ok',
].join('.')
const FAKE_SESSION = JSON.stringify({ token: jwt, uID: '999', EVM: '0xqa0000000000000000000000000000000000qa', bio: 'tabbar QA probe' })

const collectTabs = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => ({
      key: a.getAttribute('data-sf-nav'),
      href: a.getAttribute('href'),
      label: a.textContent.trim(),
    }))
  )

const tabbarDisplay = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.sf-tabbar')
    return el ? getComputedStyle(el).display : null
  })

// 几何：轨道数（computed gridTemplateColumns）+ 逐格宽 + 横向溢出（不回卷）
const tabbarGeometry = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.sf-tabbar')
    if (!bar) return null
    const cs = getComputedStyle(bar)
    const tracks = (cs.gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean)
    const rect = bar.getBoundingClientRect()
    const tabs = Array.from(bar.querySelectorAll('a[data-sf-nav]')).map((a) => {
      const r = a.getBoundingClientRect()
      return { key: a.getAttribute('data-sf-nav'), width: +r.width.toFixed(2), left: +r.left.toFixed(2), right: +r.right.toFixed(2) }
    })
    const doc = document.documentElement
    return {
      barWidth: +rect.width.toFixed(2),
      barLeft: +rect.left.toFixed(2),
      barRight: +rect.right.toFixed(2),
      gridTemplateColumns: cs.gridTemplateColumns,
      trackCount: tracks.length,
      quarter: +(rect.width / 4).toFixed(2),
      tabs,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      horizontalOverflowPx: doc.scrollWidth - doc.clientWidth,
      lastTabRightAligned: Math.abs(tabs[tabs.length - 1].right - rect.right) <= 1,
    }
  })

// 悬浮菜单【卖闲置】：可见性 = 自身与祖先链 display 非 none + 尺寸 > 0
const floatMenuSell = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-sf-m="floatmenu"] a[data-sf-fm="sell"]')
    if (!el) return { present: false }
    const r = el.getBoundingClientRect()
    let node = el
    let hiddenBy = null
    while (node && node.nodeType === 1) {
      const d = getComputedStyle(node).display
      if (d === 'none') { hiddenBy = node.className || node.tagName; break }
      node = node.parentElement
    }
    return {
      present: true,
      href: el.getAttribute('href'),
      label: el.textContent.trim(),
      display: getComputedStyle(el).display,
      rect: { w: +r.width.toFixed(2), h: +r.height.toFixed(2), top: +r.top.toFixed(2), left: +r.left.toFixed(2) },
      hiddenBy,
      visible: hiddenBy === null && r.width > 0 && r.height > 0,
      menuKeys: Array.from(document.querySelectorAll('[data-sf-m="floatmenu-item"]')).map((e) => e.getAttribute('data-sf-fm')),
    }
  })

const result = {
  generatedAt: new Date().toISOString(),
  entry: BASE,
  viewportMobile: '390x844',
  viewportDesktop: '1440x900',
  viewportDesktopWide: '1536x900',
  expectedTabKeys: EXPECTED_KEYS,
  arms: {},
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true })

try {
  // ── 臂 A：游客（未登录）· 390×844 · /item/new ─────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.addInitScript(() => localStorage.clear())
    await page.goto(BASE + '/item/new', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 20000 })
    const tabs = await collectTabs(page)
    const geometry = await tabbarGeometry(page)
    const urlBeforeClick = page.url()
    // 游客点「我的」→ /profile（ProtectedRoute）→ 登录引导
    await page.click('[data-sf-region="tabbar"] a[data-sf-nav="profile"]')
    let urlAfterClick = page.url()
    try {
      await page.waitForURL('**/login', { timeout: 10000 })
      urlAfterClick = page.url()
    } catch {}
    await page.waitForSelector('input', { timeout: 10000 }).catch(() => {})
    const loginGuide = await page.evaluate(() => {
      const text = document.body ? document.body.innerText.replace(/\s+/g, ' ').trim() : ''
      return {
        url: location.pathname,
        inputCount: document.querySelectorAll('input').length,
        passwordInputCount: document.querySelectorAll('input[type="password"]').length,
        pageTextHasLoginWord: /登录|登入|login/i.test(text),
        snippet: text.slice(0, 200),
      }
    })
    result.arms.guest_mobile_390 = {
      urlBeforeClick,
      tabs,
      tabCount: tabs.length,
      hasSellTab: tabs.some((t) => t.key === 'sell'),
      geometry,
      clickProfile: { urlAfterClick, loginGuide },
      pageErrors,
    }
    await ctx.close()
  }

  // ── 臂 B：假会话（登录态读形状 = auth.js normalizeAuthUser）· 390×844 · / ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    // 503 不触发 S1 清会话（只有 401+AUTH_UNAUTHORIZED 清）⇒ 假会话在 UI 内保持登录态读数稳定
    await ctx.route('**/api/**', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'PROBE_UPSTREAM_BLOCKED' } }) })
    )
    await ctx.addInitScript((session) => {
      localStorage.setItem('user', session)
    }, FAKE_SESSION)
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 20000 })
    await page.waitForTimeout(300)
    const tabs = await collectTabs(page)
    const geometry = await tabbarGeometry(page)
    const sessionPersisted = await page.evaluate(() => localStorage.getItem('user') !== null)
    result.arms.fake_session_mobile_390 = {
      url: page.url(),
      tabs,
      tabCount: tabs.length,
      hasSellTab: tabs.some((t) => t.key === 'sell'),
      geometry,
      sessionPersisted,
      pageErrors,
    }
    await ctx.close()
  }

  // ── 臂 C：桌面 1440×900 · 游客 · 底栏 display:none 不变 ────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.addInitScript(() => localStorage.clear())
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 20000, state: 'attached' })
    const tabs = await collectTabs(page)
    const display = await tabbarDisplay(page)
    const fm = await floatMenuSell(page)
    result.arms.desktop_1440_guest = {
      url: page.url(),
      tabCountInDom: tabs.length,
      keysInDom: tabs.map((t) => t.key),
      tabbarComputedDisplay: display,
      floatmenuSell: fm,
      pageErrors,
    }
    await ctx.close()
  }

  // ── 臂 D：桌面 1536×900 · 游客 · 浮菜单【卖闲置】可见 + href ───────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 900 } })
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.addInitScript(() => localStorage.clear())
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-m="floatmenu"] a[data-sf-fm="sell"]', { timeout: 20000 })
    const fm = await floatMenuSell(page)
    const tabs = await collectTabs(page)
    const display = await tabbarDisplay(page)
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, horizontalOverflowPx: doc.scrollWidth - doc.clientWidth }
    })
    result.arms.desktop_1536_guest = {
      url: page.url(),
      floatmenuSell: fm,
      tabbarComputedDisplay: display,
      tabCountInDom: tabs.length,
      keysInDom: tabs.map((t) => t.key),
      overflow,
      pageErrors,
    }
    await ctx.close()
  }

  // ── 判定 ────────────────────────────────────────────────────────────────
  const a = result.arms.guest_mobile_390
  const b = result.arms.fake_session_mobile_390
  const c = result.arms.desktop_1440_guest
  const d = result.arms.desktop_1536_guest
  const g = a.geometry
  const equalColumns = g.tabs.every((t) => Math.abs(t.width - g.quarter) <= 1)
  result.verdict = {
    // 底栏 4 格 / 无 sell
    guest_tabCount_is4: a.tabCount === 4,
    guest_keys_are_home_shard_messages_profile: JSON.stringify(a.tabs.map((t) => t.key)) === JSON.stringify(EXPECTED_KEYS),
    guest_no_sell_tab: a.tabs.some((t) => t.key === 'sell') === false,
    guest_no_itemnew_href: a.tabs.some((t) => (t.href || '').includes('/item/new')) === false,
    // 几何：4 轨道 + 四等宽（= 底栏宽 / 4）+ 零横向溢出 + 末格贴右
    guest_grid_trackCount_is4: g.trackCount === 4,
    guest_four_equal_columns: equalColumns,
    guest_zero_horizontal_overflow: g.horizontalOverflowPx <= 0,
    guest_last_tab_flush_right: g.lastTabRightAligned,
    // 游客点【我的】仍落登录引导（格位变动未伤交互）
    guest_click_lands_login_guide:
      a.clickProfile.loginGuide.url.includes('/login') &&
      a.clickProfile.loginGuide.pageTextHasLoginWord &&
      /连接钱包|钱包签名|使用现有钱包/.test(a.clickProfile.loginGuide.snippet),
    guest_zero_pageerror: a.pageErrors.length === 0,
    // 登录态同样 4 格（恒染）
    fakesession_tabCount_is4: b.tabCount === 4,
    fakesession_no_sell_tab: b.hasSellTab === false,
    fakesession_grid_trackCount_is4: b.geometry.trackCount === 4,
    // 桌面：底栏只是 CSS 隐藏，DOM 仍 4 格
    desktop1440_display_none: c.tabbarComputedDisplay === 'none',
    desktop1440_dom_tabs_4: c.tabCountInDom === 4,
    // 桌面 1536：**浮菜单【卖闲置】仍在且可见**（本单裁定的反向正断言）
    desktop1536_floatmenu_sell_present: d.floatmenuSell.present === true,
    desktop1536_floatmenu_sell_visible: d.floatmenuSell.visible === true,
    desktop1536_floatmenu_sell_href_itemnew: d.floatmenuSell.href === '/item/new',
    desktop1536_floatmenu_keys_intact:
      JSON.stringify(d.floatmenuSell.menuKeys) === JSON.stringify(['wage', 'sell', 'messages', 'app', 'support']),
    desktop1536_tabbar_hidden: d.tabbarComputedDisplay === 'none',
    desktop1536_zero_horizontal_overflow: d.overflow.horizontalOverflowPx <= 0,
  }
  result.verdict.all_pass = Object.values(result.verdict).every((v) => v === true)
  result.geometry_reading = {
    mobile390: {
      barWidth: g.barWidth,
      quarter: g.quarter,
      gridTemplateColumns: g.gridTemplateColumns,
      trackCount: g.trackCount,
      tabWidths: g.tabs.map((t) => t.width),
      horizontalOverflowPx: g.horizontalOverflowPx,
    },
    desktop1536: { floatmenuSell: d.floatmenuSell.rect, horizontalOverflowPx: d.overflow.horizontalOverflowPx },
  }
} finally {
  await browser.close()
}

fs.mkdirSync('/Users/kevin/bistro/seafood/ops/tabbar-mine-guest', { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log('VERDICT:', JSON.stringify(result.verdict))
console.log('GEOMETRY:', JSON.stringify(result.geometry_reading))
console.log('WROTE:', OUT)
