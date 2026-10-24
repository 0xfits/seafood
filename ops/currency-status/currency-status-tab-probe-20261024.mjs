// 探针：交易所管理第 4 个 tab「币种管理」（`/dashboard/exchange/currency-status` · 闸 `manage_settings`）
//
// 契约 = `route-layer.spec` §49.25 / §49.25.11 + `design-system.spec` §36（`T135` / `T135-a`~`c`）。
// 四臂（**全部用夹具，生产库零写入 / 零真登录**）：
//   A 1536×900：四 tab 在场且顺序正确 · 点第 4 项进入币种管理 · 列表行数 · 四态按钮矩阵逐行 ·
//               `$`（cid=1）行禁操作（零可点控件）· 零横向溢出
//   B 390×844 ：同一路由窄屏：零横向溢出 · 表头隐藏（卡行式）
//   C 二次确认：冻结（危险动作）弹确认层；**取消 ⇒ 零 POST**；**确认 ⇒ POST 体恰 {status, create_key}** · 成功后就地重拉
//   D 解冻（frozen → listed）**不**弹确认层
//
// 用法：先起站点（`npm run build` 后 `npx vite preview --port 5297 --strictPort`），再
//   PROBE_BASE=http://localhost:5297 node ops/currency-status/currency-status-tab-probe-20261024.mjs
// 端口纪律：专用 5297，**避让** 5800 / 3100 / 5199 / 5555 / 5499。
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const BASE = process.env.PROBE_BASE || 'http://localhost:5297'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/Users/kevin/bistro/seafood/ops/currency-status/readings/currency-status-tab-probe-20261024.json'
fs.mkdirSync('/Users/kevin/bistro/seafood/ops/currency-status/readings', { recursive: true })
const ROUTE = '/dashboard/exchange/currency-status'

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const jwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: '7', evm: '0xqa0000000000000000000000000000000000qa', iat: now, sst: now, exp: now + 86400 }),
  'qa-signature-not-verified-locally-ok',
].join('.')
const SESSION = JSON.stringify({ token: jwt, uID: '7', EVM: '0xqa0000000000000000000000000000000000qa', bio: 'currency-status QA probe' })

// 夹具：四态 + `$`；`listed_at` 覆盖「有值 / null」
const ROWS = [
  { cid: '1', symbol: '$', status: 'listed', listed_at: '2026-01-01 00:00:00' },
  { cid: '3', symbol: 'AAA', status: 'listed', listed_at: '2026-10-01 08:00:00' },
  { cid: '5', symbol: 'BBB', status: 'frozen', listed_at: '2026-10-02 08:00:00' },
  { cid: '7', symbol: 'CCC', status: 'draft', listed_at: null },
  { cid: '9', symbol: 'DDD', status: 'delisted', listed_at: '2026-10-03 08:00:00' },
]
const EXPECT_ACTIONS = {
  '1': [],
  '3': ['currency-status-action-frozen', 'currency-status-action-delisted'],
  '5': ['currency-status-action-listed', 'currency-status-action-delisted'],
  // `T135-b`：`draft` 不渲「上市」（后端 `LISTING_REQUIRES_FEE_PATH` 恒 409）⇒ 仅「下架」
  '7': ['currency-status-action-delisted'],
  '9': [],
}

const readings = {}
const pageErrors = []

const overflow = (page) =>
  page.evaluate(() => {
    const de = document.documentElement
    const rows = Array.from(document.querySelectorAll('[data-sf-m="currency-status-row"]')).map((r) => ({
      cid: r.getAttribute('data-cid'),
      scrollWidth: r.scrollWidth,
      clientWidth: r.clientWidth,
    }))
    return {
      viewport: window.innerWidth,
      docScrollWidth: de.scrollWidth,
      docClientWidth: de.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowingRows: rows.filter((r) => r.scrollWidth > r.clientWidth + 1),
      rows,
    }
  })

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const posts = []
  let dialogs = []

  const makeContext = async (viewport) => {
    const ctx = await browser.newContext({ viewport })
    await ctx.route('**/api/**', async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
      if (url.pathname === '/api/admin/me') {
        return json(200, {
          success: true,
          data: { is_admin: true, can_access_admin: true, permissions: ['manage_settings', 'review_tasks'], preferred_admin_path: '/dashboard' },
        })
      }
      if (url.pathname === '/api/admin/currency/status' && req.method() === 'GET') {
        return json(200, { success: true, message: 'fixture', data: ROWS })
      }
      if (/^\/api\/admin\/currency\/\d+\/status$/.test(url.pathname) && req.method() === 'POST') {
        const cid = url.pathname.split('/')[4]
        posts.push({ cid, body: JSON.parse(req.postData() || '{}') })
        return json(200, {
          success: true,
          message: 'Currency status updated',
          data: { cid, from_status: 'listed', status: 'frozen', cancelled_orders: 1, deposit_action: 'none' },
        })
      }
      return json(503, { success: false, error: { code: 'FIXTURE_UNSTUBBED', message: `${req.method()} ${url.pathname}` } })
    })
    await ctx.addInitScript((session) => localStorage.setItem('user', session), SESSION)
    return ctx
  }

  const collect = async (page) => {
    page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)))
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() })
      if (dialog.type() === 'confirm' && globalThis.__DISMISS_CONFIRM__) await dialog.dismiss()
      else await dialog.accept()
    })
  }

  // ---------- 臂 A：1536 桌面 ----------
  {
    const ctx = await makeContext({ width: 1536, height: 900 })
    const page = await ctx.newPage()
    await collect(page)
    await page.goto(`${BASE}/dashboard/exchange/fee-rate`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-sf-m^="exchange-tab-"]', { timeout: 15000 })

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-sf-m^="exchange-tab-"]')).map((el) => ({
        key: el.getAttribute('data-sf-m'),
        href: el.getAttribute('href'),
        label: el.textContent.trim(),
        active: el.className.includes('is-active'),
      }))
    )

    // 点第 4 项进入币种管理
    await page.click('[data-sf-m="exchange-tab-currencyStatus"]')
    await page.waitForSelector('[data-sf-m="currency-status-row"]', { timeout: 15000 })
    const url = page.url()
    const activeTab = await page.evaluate(() => {
      const el = document.querySelector('[data-sf-m="exchange-tab-currencyStatus"]')
      return { active: el.className.includes('is-active'), ariaSelected: el.getAttribute('aria-selected') }
    })

    const matrix = await page.evaluate((expect) => {
      const out = {}
      for (const cid of Object.keys(expect)) {
        const row = document.querySelector(`[data-sf-m="currency-status-row"][data-cid="${cid}"]`)
        out[cid] = {
          status: row ? row.getAttribute('data-status') : null,
          buttons: row ? Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('data-sf-m')) : null,
          clickable: row ? row.querySelectorAll('button, a, [role="button"], input, select').length : null,
          locked: row ? Boolean(row.querySelector('[data-sf-m="currency-status-locked"]')) : null,
          draftHint: row ? Boolean(row.querySelector('[data-sf-m="currency-status-draft-hint"]')) : null,
          statusText: row ? (row.querySelector('[data-sf-m="currency-status-status"]')?.textContent || '').trim() : null,
          listedAtText: row ? Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim())[3] : null,
        }
      }
      return out
    }, EXPECT_ACTIONS)

    const of = await overflow(page)
    await ctx.close()
    readings.A_desktop = { viewport: '1536x900', tabs, url, activeTab, rows: ROWS.length, matrix, overflow: of }
  }

  // ---------- 臂 B：390 窄屏 ----------
  {
    const ctx = await makeContext({ width: 390, height: 844 })
    const page = await ctx.newPage()
    await collect(page)
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-sf-m="currency-status-row"]', { timeout: 15000 })
    // 壳层前提：`AdminLayout` 侧栏（`w-64` = 256px）无响应式折叠，390 下会把 main 挤到 36px
    // —— 那是壳层既有行为（非本 tab，且本单禁改壳）。按用户可见的折叠键收起侧栏后再量本 tab 自身溢出口径。
    await page.locator('div.w-64.flex-col').first().locator('button').first().click()
    await page.waitForTimeout(600)
    const of = await overflow(page)
    const layout = await page.evaluate(() => ({
      theadDisplay: document.querySelector('.sf-curstatus-table thead') ? getComputedStyle(document.querySelector('.sf-curstatus-table thead')).display : null,
      rowDisplay: document.querySelector('.sf-curstatus-table tbody tr') ? getComputedStyle(document.querySelector('.sf-curstatus-table tbody tr')).display : null,
      tabWrapHeight: document.querySelector('[role="tablist"]')?.getBoundingClientRect().height ?? null,
      sidebarWidth: document.querySelector('div.flex.h-screen > div')?.getBoundingClientRect().width ?? null,
      mainWidth: document.querySelector('main')?.getBoundingClientRect().width ?? null,
    }))
    await ctx.close()
    readings.B_mobile = { viewport: '390x844', sidebarCollapsed: true, overflow: of, layout }
  }

  // ---------- 臂 C：二次确认（取消 ⇒ 零 POST；确认 ⇒ POST 体 + 重拉） ----------
  {
    const ctx = await makeContext({ width: 1536, height: 900 })
    const page = await ctx.newPage()
    await collect(page)
    let listGets = 0
    page.on('request', (r) => {
      if (r.method() === 'GET' && new URL(r.url()).pathname === '/api/admin/currency/status') listGets += 1
    })
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-sf-m="currency-status-row"]', { timeout: 15000 })
    const getsBefore = listGets

    // ① 取消 ⇒ 不提交
    globalThis.__DISMISS_CONFIRM__ = true
    dialogs = []
    await page.click('[data-sf-m="currency-status-row"][data-cid="3"] [data-sf-m="currency-status-action-frozen"]')
    await page.waitForTimeout(400)
    const afterDismiss = { dialogs: [...dialogs], posts: posts.length }

    // ② 确认 ⇒ 提交 + 重拉
    globalThis.__DISMISS_CONFIRM__ = false
    dialogs = []
    await page.click('[data-sf-m="currency-status-row"][data-cid="3"] [data-sf-m="currency-status-action-frozen"]')
    await page.waitForTimeout(900)
    const afterAccept = { dialogs: [...dialogs], posts: posts.length, listGetsDelta: listGets - getsBefore }

    await ctx.close()
    readings.C_confirm = { posts, afterDismiss, afterAccept }
  }

  // ---------- 臂 D：解冻不套确认层 ----------
  {
    const ctx = await makeContext({ width: 1536, height: 900 })
    const page = await ctx.newPage()
    await collect(page)
    dialogs = []
    const before = posts.length
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-sf-m="currency-status-row"]', { timeout: 15000 })
    await page.click('[data-sf-m="currency-status-row"][data-cid="5"] [data-sf-m="currency-status-action-listed"]')
    await page.waitForTimeout(700)
    readings.D_unfreeze = { dialogs: [...dialogs], posted: posts.length - before }
    await ctx.close()
  }

  await browser.close()

  // ---------- 判据 ----------
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail })

  const A = readings.A_desktop
  add('A1 四 tab 在场且顺序 = fee-rate/currency-review/commission-levels/currency-status',
    A.tabs.length === 4 &&
      JSON.stringify(A.tabs.map((t) => t.href)) === JSON.stringify([
        '/dashboard/exchange/fee-rate',
        '/dashboard/exchange/currency-review',
        '/dashboard/exchange/commission-levels',
        '/dashboard/exchange/currency-status',
      ]), A.tabs.map((t) => t.href))
  add('A2 点击第 4 项 ⇒ URL 落 currency-status 且 tab 选中（.is-active + aria-selected）',
    A.url.endsWith(ROUTE) && A.activeTab.active && A.activeTab.ariaSelected === 'true', A.url)
  add('A3 列表行数 = 夹具 5 行', Object.keys(A.matrix).length === 5)
  add('A4 按钮矩阵逐行 = 状态机可达集',
    Object.entries(EXPECT_ACTIONS).every(([cid, expect]) => JSON.stringify(A.matrix[cid].buttons) === JSON.stringify(expect)),
    Object.fromEntries(Object.entries(A.matrix).map(([k, v]) => [k, v.buttons])))
  add('A5 `$`（cid=1）行零可点控件 + 守卫标记在场',
    A.matrix['1'].clickable === 0 && A.matrix['1'].locked === true, A.matrix['1'])
  add('A6 终态 delisted 行零按钮', A.matrix['9'].buttons.length === 0)
  add('A7 状态列直读 status（data-status 原值 + 词条）',
    A.matrix['5'].status === 'frozen' && A.matrix['7'].status === 'draft', A.matrix['5'].status)
  add('A8 listed_at 为 null ⇒ `—`', A.matrix['7'].listedAtText === '—', A.matrix['7'].listedAtText)
  add('A9 `draft` 行带只读提示（`T135-b`：上市需走建币审核）且提示非可点控件',
    A.matrix['7'].draftHint === true && A.matrix['7'].buttons.length === 1 && A.matrix['7'].clickable === 1, A.matrix['7'])
  add('A10 1536 零横向溢出',
    A.overflow.docScrollWidth <= A.overflow.docClientWidth + 1 && A.overflow.overflowingRows.length === 0, A.overflow.docScrollWidth)

  const B = readings.B_mobile
  add('B1 390 零横向溢出（侧栏折叠后量本 tab）',
    B.overflow.docScrollWidth <= B.overflow.docClientWidth + 1 && B.overflow.overflowingRows.length === 0,
    { doc: B.overflow.docScrollWidth, viewport: B.overflow.viewport, main: B.layout.mainWidth, rows: B.overflow.overflowingRows })
  add('B2 390 卡行式（表头隐藏、行 display=block）', B.layout.theadDisplay === 'none' && B.layout.rowDisplay === 'block', B.layout)

  const C = readings.C_confirm
  add('C1 冻结弹二次确认（confirm 类型，文案含符号）',
    C.afterDismiss.dialogs.length === 1 && C.afterDismiss.dialogs[0].type === 'confirm' && C.afterDismiss.dialogs[0].message.includes('AAA'),
    C.afterDismiss.dialogs)
  add('C2 取消 ⇒ 零 POST', C.afterDismiss.posts === 0, C.afterDismiss.posts)
  add('C3 确认 ⇒ 恰 1 次 POST 且体 = {status, create_key}（无 memo）',
    C.afterAccept.posts === 1 &&
      (() => {
        const b = posts[0]?.body || {}
        return JSON.stringify(Object.keys(b).sort()) === JSON.stringify(['create_key', 'status']) &&
          b.status === 'frozen' && /^ops:7:currency_status:3:frozen$/.test(b.create_key)
      })(), posts)
  add('C4 成功后就地重拉列表（GET 次数 +1）', C.afterAccept.listGetsDelta >= 1, C.afterAccept.listGetsDelta)

  const D = readings.D_unfreeze
  add('D1 解冻（frozen→listed）不弹确认层且直接提交', D.dialogs.length === 0 && D.posted === 1, D)

  add('E1 零 pageerror', pageErrors.length === 0, pageErrors)

  const ok = checks.every((c) => c.ok)
  const payload = { ok, base: BASE, checks, readings, pageErrors }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
  console.log(JSON.stringify({ ok, failed: checks.filter((c) => !c.ok), checks: checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}`), file: OUT }, null, 2))
  process.exit(ok ? 0 : 1)
}

run().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
