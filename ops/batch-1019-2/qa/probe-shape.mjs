// QA probe (batch-1019-2): 底栏形态 / 桌面-详情 / 首页回归 —— 5800 同源入口。
// 零真登录 / 零真发布 / 零库写（B 臂 /api/** 拦截回 503，防假 token 触发 401 清会话）。
// 判负对照（尺子灵敏度）：游客臂内注入假 profile tab ⇒ 计数 6，移除 ⇒ 计数 5。
// 登录引导判据 = URL 含 /login **或**页面出现连接钱包文案；**不**用「有 input」当判据。
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5800'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/Users/kevin/bistro/seafood/ops/batch-1019-2/qa/readings/ac1-ac3-ac8-browser-master.json'

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const jwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: '999', evm: '0xqa0000000000000000000000000000000000qa', iat: now, sst: now, exp: now + 86400 }),
  'qa-signature-not-verified-locally-ok',
].join('.')
const FAKE_SESSION = JSON.stringify({ token: jwt, uID: '999', EVM: '0xqa0000000000000000000000000000000000qa', bio: 'batch-1019-2 QA probe' })

const collectTabs = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => ({
      key: a.getAttribute('data-sf-nav'),
      href: a.getAttribute('href'),
      label: a.textContent.trim(),
    }))
  )

const tabbarInfo = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.sf-tabbar')
    return el
      ? { exists: true, classes: el.className, display: getComputedStyle(el).display }
      : { exists: false, classes: null, display: null }
  })

const newGuestCtx = async (browser, viewport) => {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.addInitScript(() => localStorage.clear())
  return { ctx, page, pageErrors }
}

const result = { generatedAt: new Date().toISOString(), entry: BASE, arms: {} }
const browser = await chromium.launch({ executablePath: CHROME, headless: true })

try {
  // ── 臂 A：游客 390×844 · /item/new（5800 同源入口）—— 恒 5 格 + 判负对照 + 点「我的」落登录引导
  {
    const { ctx, page, pageErrors } = await newGuestCtx(browser, { width: 390, height: 844 })
    await page.goto(BASE + '/item/new', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 30000 })
    await page.waitForTimeout(400)
    const tabs = await collectTabs(page)
    const countBefore = tabs.length
    // 判负对照：注入假 profile tab ⇒ 6；移除 ⇒ 5
    const countInjected = await page.evaluate(() => {
      const nav = document.querySelector('[data-sf-region="tabbar"]')
      const real = nav.querySelector('a[data-sf-nav="profile"]')
      const fake = real.cloneNode(true)
      fake.setAttribute('data-sf-probe-fake', '1')
      nav.appendChild(fake)
      return document.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]').length
    })
    const countRemoved = await page.evaluate(() => {
      document.querySelector('[data-sf-region="tabbar"] a[data-sf-probe-fake="1"]')?.remove()
      return document.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]').length
    })
    const urlBeforeClick = page.url()
    await page.click('[data-sf-region="tabbar"] a[data-sf-nav="profile"]')
    let urlAfterClick = page.url()
    try {
      await page.waitForURL('**/login**', { timeout: 10000 })
      urlAfterClick = page.url()
    } catch {}
    await page.waitForTimeout(800)
    const loginGuide = await page.evaluate(() => {
      const text = document.body ? document.body.innerText.replace(/\s+/g, ' ').trim() : ''
      return {
        url: location.pathname + location.search,
        urlHasLogin: location.pathname.includes('/login'),
        textHasWalletPhrase: /连接钱包|钱包签名|使用现有钱包|Connect Wallet/i.test(text),
        inputCountObservationOnly: document.querySelectorAll('input').length,
        snippet: text.slice(0, 220),
      }
    })
    result.arms.A_guest390_itemnew = {
      urlBeforeClick,
      tabs,
      tabCount: countBefore,
      negativeControl: { countInjected, countRemoved },
      clickProfile: { urlAfterClick, loginGuide },
      pageErrors,
    }
    await ctx.close()
  }

  // ── 臂 A2：游客 390×844 · /en —— href 语言前缀正确性
  {
    const { ctx, page, pageErrors } = await newGuestCtx(browser, { width: 390, height: 844 })
    await page.goto(BASE + '/en', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 30000 })
    await page.waitForTimeout(400)
    const tabs = await collectTabs(page)
    result.arms.A2_guest390_en = { url: page.url(), tabs, tabCount: tabs.length, pageErrors }
    await ctx.close()
  }

  // ── 臂 B：假会话 390×844 · /（/api/** 503 拦截，会话保持）—— 5 格不变
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await ctx.route('**/api/**', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'PROBE_UPSTREAM_BLOCKED' } }) })
    )
    await ctx.addInitScript((session) => localStorage.setItem('user', session), FAKE_SESSION)
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 30000 })
    await page.waitForTimeout(400)
    const tabs = await collectTabs(page)
    const sessionPersisted = await page.evaluate(() => localStorage.getItem('user') !== null)
    result.arms.B_fakeSession390_home = { url: page.url(), tabs, tabCount: tabs.length, sessionPersisted, pageErrors }
    await ctx.close()
  }

  // ── 臂 C：桌面 1440×900 · 游客 · / —— computed display=none 且 DOM 恒 5 tabs（attached 等待）
  {
    const { ctx, page, pageErrors } = await newGuestCtx(browser, { width: 1440, height: 900 })
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 30000, state: 'attached' })
    await page.waitForTimeout(400)
    const tabs = await collectTabs(page)
    const bar = await tabbarInfo(page)
    result.arms.C_desktop1440_home = { url: page.url(), tabCountInDom: tabs.length, keysInDom: tabs.map((t) => t.key), tabbar: bar, pageErrors }
    await ctx.close()
  }

  // ── 臂 D：390×844 · 游客 · /item/1 —— 详情路由 is-detail 隐藏
  {
    const { ctx, page, pageErrors } = await newGuestCtx(browser, { width: 390, height: 844 })
    await page.goto(BASE + '/item/1', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav]', { timeout: 30000, state: 'attached' })
    await page.waitForTimeout(600)
    const tabs = await collectTabs(page)
    const bar = await tabbarInfo(page)
    const body = await page.evaluate(() => (document.body ? document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 160) : ''))
    result.arms.D_detail390_item1 = { url: page.url(), tabCountInDom: tabs.length, tabbar: bar, isDetailClass: bar.classes.includes('is-detail'), bodySnippet: body, pageErrors }
    await ctx.close()
  }

  // ── 臂 H：390×844 · 游客 · / —— #root 非空 + 零 pageerror
  {
    const { ctx, page, pageErrors } = await newGuestCtx(browser, { width: 390, height: 844 })
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root', { timeout: 30000 })
    await page.waitForTimeout(800)
    const rootLen = await page.evaluate(() => (document.querySelector('#root') ? document.querySelector('#root').innerHTML.length : 0))
    result.arms.H_home390_guest = { url: page.url(), rootInnerHTMLLength: rootLen, pageErrors }
    await ctx.close()
  }
} finally {
  await browser.close()
}

fs.mkdirSync('/Users/kevin/bistro/seafood/ops/batch-1019-2/qa/readings', { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log('WROTE:', OUT)
console.log(JSON.stringify(result.arms, null, 1).slice(0, 4000))
