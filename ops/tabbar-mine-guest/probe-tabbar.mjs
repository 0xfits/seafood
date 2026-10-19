// 探针：底栏恒 5 格（含未登录）—— Kevin 2026-10-19 缺陷单「_preview 未登录 tabbar 缺【我的】」
// 三臂：A 游客 390×844 @5800/item/new（Kevin 报障同源入口）· B 假会话 390×844 · C 桌面 1440 display:none
// 零真登录 / 零真发布 / 零库写（B 臂 /api/** 拦截回 503，防假 token 触发 401 清会话污染读数）。
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5800'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/Users/kevin/bistro/seafood/ops/tabbar-mine-guest/probe-guest.json'

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

const topnavSummary = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-sf-region="topnav"]')
    return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null
  })

const result = { generatedAt: new Date().toISOString(), entry: BASE, viewportMobile: '390x844', viewportDesktop: '1440x900', arms: {} }
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
      hasProfileTab: tabs.some((t) => t.key === 'profile'),
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
    await page_addSession(ctx)
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 20000 })
    await page.waitForTimeout(300)
    const tabs = await collectTabs(page)
    const topnav = await topnavSummary(page)
    const sessionPersisted = await page.evaluate(() => localStorage.getItem('user') !== null)
    result.arms.fake_session_mobile_390 = {
      url: page.url(),
      tabs,
      tabCount: tabs.length,
      hasProfileTab: tabs.some((t) => t.key === 'profile'),
      sessionPersisted,
      topnavSnippet: topnav,
      pageErrors,
    }
    await ctx.close()
  }

  // ── 臂 C：桌面 1440×900 · 游客 · display:none 不变 ────────────────────────
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
    result.arms.desktop_1440_guest = {
      url: page.url(),
      tabCountInDom: tabs.length,
      keysInDom: tabs.map((t) => t.key),
      tabbarComputedDisplay: display,
      pageErrors,
    }
    await ctx.close()
  }

  async function page_addSession(ctx) {
    await ctx.addInitScript((session) => {
      localStorage.setItem('user', session)
    }, FAKE_SESSION)
  }

  // ── 判定 ────────────────────────────────────────────────────────────────
  const a = result.arms.guest_mobile_390
  const b = result.arms.fake_session_mobile_390
  const c = result.arms.desktop_1440_guest
  result.verdict = {
    guest_tabCount_is5: a.tabCount === 5,
    guest_hasProfile: a.hasProfileTab,
    guest_click_lands_login_guide: a.clickProfile.loginGuide.url.includes('/login') && a.clickProfile.loginGuide.pageTextHasLoginWord && /连接钱包|钱包签名|使用现有钱包/.test(a.clickProfile.loginGuide.snippet),
    guest_zero_pageerror: a.pageErrors.length === 0,
    fakesession_tabCount_is5: b.tabCount === 5,
    desktop_display_none: c.tabbarComputedDisplay === 'none',
    desktop_dom_tabs_5: c.tabCountInDom === 5,
  }
  result.verdict.all_pass = Object.values(result.verdict).every((v) => v === true)
} finally {
  await browser.close()
}

fs.mkdirSync('/Users/kevin/bistro/seafood/ops/tabbar-mine-guest', { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log('VERDICT:', JSON.stringify(result.verdict))
console.log('WROTE:', OUT)
