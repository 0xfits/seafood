/**
 * 探针 · /exchange「标的币种」combobox（Kevin 2026-10-21）
 * 体例承 ops/v119-msg-panel/qa/probe-geometry-qa.mjs：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server / 零后端 / 零库写）
 *   · API 一律 context.route 内内存自截（夹具可随单定制；全部只读面，零写口触发）
 *   · pageerror / unhandledrejection 钩子全程在听
 * 臂：
 *   ① 下拉列出全部 listed 币（`symbol · name · #cid`）且 **cid 1 不在列表**
 *   ② 输入 `bttc` 过滤剩 1 项；Enter ⇒ URL `?base=4` + 订单簿请求按该 cid 发出 + 输入框回显 symbol
 *   ③ 390 / 1536 两档：零横向溢出 + 零 pageerror + 面板行触控 ≥44（390 档）
 * 用法：node probe-market-base-combobox.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/market/base-combobox/readings/probe-result.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
}

// 夹具（内存 JSON，形态对齐 dev 库：平台币 $ cid=1；BTTC symbol='₿' name='BTTC' cid=4）
const CURRENCIES = [
  { cid: 1, symbol: '$', name: 'USD' },
  { cid: 4, symbol: '₿', name: 'BTTC' },
  { cid: 10, symbol: 'Ω', name: 'Omega Coin' },
  { cid: 21, symbol: 'T', name: 'Test Coin' },
]
const apiResponse = (method, pathname, record) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/currencies') return ok(CURRENCIES.map((r) => ({ ...r })))
  let m = pathname.match(/^\/api\/market\/(\d+)\/orderbook$/)
  if (m && method === 'GET') { record.orderbook.push(Number(m[1])); return ok([]) }
  m = pathname.match(/^\/api\/market\/(\d+)\/trades$/)
  if (m && method === 'GET') { record.trades.push(Number(m[1])); return ok([]) }
  if (pathname === '/api/order' && method === 'GET') return ok([])
  if (pathname.startsWith('/api/user/ledger')) return { success: true, data: [], next_before_txid: null }
  if (pathname.startsWith('/api/user')) return ok(null) // 会话恢复面：匿名空
  return ok(null)
}

const serveDist = (route, request) => {
  const u = new URL(request.url())
  if (u.pathname.startsWith('/api/')) {
    return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(apiResponse(request.method(), u.pathname, RECORD)) })
  }
  const rel = u.pathname === '/' ? '/index.html' : u.pathname
  const file = path.join(DIST, rel)
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  }
  // SPA fallback
  return route.fulfill({ status: 200, contentType: MIME['.html'], body: fs.readFileSync(path.join(DIST, 'index.html')) })
}

const RECORD = { orderbook: [], trades: [] }

const newPage = async (browser, { width, height }) => {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e?.message || e)))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })
  await context.route('**/*', serveDist)
  return { context, page, errors }
}

const openPanel = async (page) => {
  const input = page.locator('[data-sf-m="mkt-input-base"]')
  await input.waitFor({ state: 'visible', timeout: 15000 })
  await input.click()
  await page.locator('[data-sf-m="mkt-base-listbox"]').waitFor({ state: 'visible', timeout: 10000 })
  return input
}

const overflowOf = (page) => page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))

const read = { arms: [], generatedAt: new Date().toISOString(), dist: DIST }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
try {
  // ---- 臂①② · 390 档（触控档） ----------------------------------------------------------
  {
    const { context, page, errors } = await newPage(browser, { width: 390, height: 844 })
    await page.goto(`${ORIGIN}/exchange`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400) // 稳态：选项源 fetch 落地
    const overflowBefore = await overflowOf(page)

    const input = await openPanel(page)
    const opts = await page.locator('[data-sf-m="mkt-base-option"]').all()
    const texts = []
    for (const o of opts) texts.push((await o.textContent()).trim())
    const cids = []
    for (const o of opts) cids.push(await o.getAttribute('data-sf-cid'))
    // 触控高度（≤767 档 ≥44）
    const heights = []
    for (const o of opts) heights.push((await o.boundingBox()).height)
    const overflowOpen = await overflowOf(page)

    read.arms.push({
      arm: '① 全量列出 + 触控高度（390）',
      optionCount: opts.length,
      texts, cids,
      cid1Absent: !cids.includes('1'),
      optionMinHeight: Math.min(...heights),
      touch44: Math.min(...heights) >= 43.5,
      overflowXBefore: overflowBefore.overflowX,
      overflowXPanelOpen: overflowOpen.overflowX,
      pageErrors: errors.slice(),
    })

    // 臂②：输入 bttc 过滤 ⇒ 1 项；Enter ⇒ URL base=4 + 订单簿请求 + 回显 symbol
    await input.fill('')
    await input.pressSequentially('bttc', { delay: 30 })
    await page.waitForTimeout(150)
    const filtered = await page.locator('[data-sf-m="mkt-base-option"]').all()
    const filteredCids = []
    for (const o of filtered) filteredCids.push(await o.getAttribute('data-sf-cid'))
    const filteredTexts = []
    for (const o of filtered) filteredTexts.push((await o.textContent()).trim())

    const recordBefore = RECORD.orderbook.length
    await input.press('Enter')
    await page.waitForTimeout(500)
    const url = page.url()
    const inputValue = await input.inputValue()
    const panelGone = (await page.locator('[data-sf-m="mkt-base-listbox"]').count()) === 0
    const orderbookCalls = RECORD.orderbook.slice()

    read.arms.push({
      arm: '② bttc 过滤 + Enter 写回（390）',
      filteredCount: filtered.length,
      filteredCids, filteredTexts,
      urlAfterEnter: url,
      urlHasBase4: /[?&]base=4(&|$)/.test(url),
      inputValueAfterEnter: inputValue,
      echoIsSymbol: inputValue === '₿',
      panelClosedAfterEnter: panelGone,
      orderbookCallsAfter: orderbookCalls,
      orderbookNewCalls: orderbookCalls.length - recordBefore,
      orderbookHit4: orderbookCalls.includes(4),
      pageErrors: errors.slice(),
    })
    await context.close()
  }

  // ---- 臂③ · 1536 档（桌面档） ----------------------------------------------------------
  {
    const { context, page, errors } = await newPage(browser, { width: 1536, height: 960 })
    await page.goto(`${ORIGIN}/exchange`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    const overflowBefore = await overflowOf(page)
    const input = await openPanel(page)
    const overflowOpen = await overflowOf(page)
    const optCount = await page.locator('[data-sf-m="mkt-base-option"]').count()
    // 键盘路径（桌面）：ArrowDown + Enter 选中第一项（cid 4）
    await input.press('ArrowDown')
    await input.press('Enter')
    await page.waitForTimeout(500)
    const url = page.url()
    const inputValue = await input.inputValue()

    read.arms.push({
      arm: '③ 1536 档零溢出 + 键盘选择',
      optionCount: optCount,
      overflowXBefore: overflowBefore.overflowX,
      overflowXPanelOpen: overflowOpen.overflowX,
      urlAfterEnter: url,
      urlHasBase4: /[?&]base=4(&|$)/.test(url),
      inputValueAfterEnter: inputValue,
      pageErrors: errors.slice(),
    })
    await context.close()
  }

  // ---- 汇总判定 --------------------------------------------------------------------------
  const a1 = read.arms[0]; const a2 = read.arms[1]; const a3 = read.arms[2]
  read.verdict = {
    arm1_listAll_noCid1: a1.optionCount === 3 && a1.cid1Absent && a1.texts.some((x) => x.includes('BTTC')),
    arm1_touch44_390: a1.touch44,
    arm2_filterBttc_one: a2.filteredCount === 1 && a2.filteredCids[0] === '4',
    arm2_enter_writeUrl_base4: a2.urlHasBase4,
    arm2_enter_orderbook_sent: a2.orderbookHit4,
    arm2_echo_symbol: a2.echoIsSymbol && a2.panelClosedAfterEnter,
    arm3_390_no_overflow: a1.overflowXBefore === 0 && a1.overflowXPanelOpen === 0,
    arm3_1536_no_overflow: a3.overflowXBefore === 0 && a3.overflowXPanelOpen === 0,
    zero_pageerror: [...a1.pageErrors, ...a2.pageErrors, ...a3.pageErrors].length === 0,
  }
  read.allGreen = Object.values(read.verdict).every(Boolean)
} finally {
  await browser.close()
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(read, null, 2))
console.log(JSON.stringify({ out: OUT, allGreen: read.allGreen, verdict: read.verdict }, null, 2))
