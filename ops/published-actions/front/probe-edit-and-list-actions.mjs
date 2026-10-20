/**
 * 发布动作三连 · 前端探针（编辑页 + 列表行内动作）· 2026-10-20
 * 体例承 `ops/v119-msg-panel/qa/probe-geometry-qa.mjs`：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（**真构建产物**，零 dev server）
 *   · 登录态 = localStorage 种子（addInitScript）；API 一律 context.route 内自截（**零真后端 / 零库写**）
 *   · 「库」= 探针内内存夹具（10 键行，PATCH 按 route §49.12.2 语义回写：title=描述首行派生）
 * 覆盖（派单验证四条）：
 *   ① 编辑页预填五项与库内一致 / cid 只读 / 草稿库存禁用 + 提示 / item_type 反推级联
 *   ② 改描述保存 ⇒ PATCH 只带 description（零 title/cid/stock）⇒ 库内 description 变且首行即新标题 ⇒ 回我发布的
 *   ③ 列表仅 draft|listed 有按钮；降价弹层 等值/加价/0/非整数 均置灰 + 内联提示；合法降价 ⇒ PATCH 只带 {price} 且行内数字即时更新（不跳页、不整表重取）
 *   ④ 全程零 pageerror
 * 用法：node probe-edit-and-list-actions.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, `ops/published-actions/front/readings/probe-edit-list-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')}Z.json`)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（内存「库」；行键 = GET /api/listing/mine 的 10 键族） -----------------------------
const ROWS = [
  { listing_id: 501, title: '探针商品 甲（草稿）', price: '88', cid: 1, status: 'draft', stock: '5', media_urls: ['/api/media/11'], time_created: 1760000000, description: '探针商品 甲（草稿）\n描述第二行', item_type: 'DigitalAutoDeliver' },
  { listing_id: 502, title: '探针商品 乙（在售）', price: '66', cid: 1, status: 'listed', stock: '3', media_urls: [], time_created: 1760000001, description: '探针商品 乙（在售）', item_type: null },
  { listing_id: 503, title: '探针商品 丙（已售）', price: '30', cid: 1, status: 'sold', stock: '0', media_urls: [], time_created: 1760000002, description: '探针商品 丙（已售）', item_type: 'PhysicalFreeShip' },
  { listing_id: 504, title: '探针商品 丁（已下架）', price: '20', cid: 1, status: 'delisted', stock: '1', media_urls: [], time_created: 1760000003, description: '探针商品 丁（已下架）', item_type: null },
]
const view = (row) => ({
  listing_id: row.listing_id, title: row.title, price: String(row.price), cid: row.cid,
  status: row.status, stock: String(row.stock), media_urls: [...row.media_urls],
  time_created: row.time_created, description: row.description, item_type: row.item_type,
})

const patchBodies = []   // { listingId, body } 逐笔登记（判定「只传变化字段」）
let mineGetCount = 0     // GET /api/listing/mine 次数（判定「不整表重取」）

const apiResponse = (method, pathname, body) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/listing/mine' && method === 'GET') { mineGetCount += 1; return data(ROWS.map(view)) }
  const m = pathname.match(/^\/api\/listing\/(\d+)$/)
  if (m && method === 'PATCH') {
    const row = ROWS.find((r) => r.listing_id === Number(m[1]))
    if (!row) return { success: false, error: { code: 'LISTING_NOT_FOUND' } }
    patchBodies.push({ listingId: row.listing_id, body: JSON.parse(JSON.stringify(body || {})) })
    // route §49.12.2 语义（夹具级）：title 退场=描述首行派生；可改字段 5 个；draft 改 stock ⇒ 409
    if (body && body.title !== undefined) return { success: false, error: { code: 'NOT_SUPPORTED' } }
    if (body && (body.to_status !== undefined || body.status !== undefined)) return { success: false, error: { code: 'BOTH_MODES' } }
    if (typeof body?.description === 'string') {
      row.description = body.description
      row.title = String(body.description).split('\n')[0]
    }
    if (body?.price !== undefined) row.price = String(body.price)
    if (body?.stock !== undefined) {
      if (row.status !== 'listed') return { success: false, error: { code: 'LISTING_STATE_CONFLICT', details: { reason: 'listing_stock_change_requires_listed' } } }
      row.stock = String(body.stock)
    }
    if (Array.isArray(body?.media_urls)) row.media_urls = body.media_urls.map(String)
    if (body?.item_type !== undefined) row.item_type = body.item_type
    return data(view(row))
  }
  if (pathname === '/api/currencies') return data([{ cid: 1, symbol: '$', name: '' }])
  if (/^\/api\/media\/\d+$/.test(pathname)) return data({})
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内读取器（用例内采集；读数点都在 DOM 仍挂载时） --------------------------------------
const READ_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const val = (el) => (el ? el.value : null)
  return {
    url: location.pathname + location.search,
    formPresent: !!q('[data-sf-m="item-form"]'),
    editLoading: !!q('[data-sf-m="item-edit-loading"]'),
    editLoadError: !!q('[data-sf-m="item-edit-load-error"]'),
    heading: val(q('[data-sf-m="item-hero"] h1')) || (q('[data-sf-m="item-hero"] h1')||{}).textContent || null,
    description: val(q('[data-sf-m="item-input-note"]')),
    price: val(q('[data-sf-m="item-input-price"]')),
    stock: val(q('[data-sf-m="item-input-stock"]')),
    stockDisabled: q('[data-sf-m="item-input-stock"]') ? q('[data-sf-m="item-input-stock"]').disabled : null,
    stockLockedHint: (q('[data-sf-m="item-stock-locked"]')||{}).textContent || null,
    cidReadonly: q('[data-sf-m="item-cid-readonly"]') ? {
      value: q('[data-sf-m="item-cid-readonly"]').value,
      readOnly: q('[data-sf-m="item-cid-readonly"]').readOnly,
      tagName: q('[data-sf-m="item-cid-readonly"]').tagName,
    } : null,
    cidSelectCount: qa('[data-sf-m="item-select-cid"]').length,
    typeChecked: qa('[data-sf-m="item-input-type-digital"],[data-sf-m="item-input-type-physical"]').filter((e) => e.checked).map((e) => e.getAttribute('data-sf-m')),
    deliverGroupPresent: !!q('[data-sf-m="item-select-deliver"]'),
    deliverChecked: qa('[data-sf-m="item-input-deliver-auto"],[data-sf-m="item-input-deliver-manual"]').filter((e) => e.checked).map((e) => e.getAttribute('data-sf-m')),
    shipGroupPresent: !!q('[data-sf-m="item-select-ship"]'),
    existingThumbs: qa('[data-sf-m^="item-image-existing-"] > img').length,
    saveBtnText: (q('[data-sf-m="item-primary"]')||{}).textContent || null,
    rows: qa('[data-sf-m="trades-published-item"]').map((w) => ({
      status: w.getAttribute('data-sf-status'),
      title: (w.querySelector('.sf-prof-row-title')||{}).textContent || null,
      priceText: (w.querySelector('[data-sf-m="trades-published-price"]')||{}).textContent || null,
      isLink: (w.querySelector('[data-sf-m="trades-published-link"]')||{}).tagName || null,
      hasActions: !!w.querySelector('[data-sf-m="trades-published-actions"]'),
      lowerBtn: !!w.querySelector('[data-sf-m="trades-published-lower"]'),
      editBtn: !!w.querySelector('[data-sf-m="trades-published-edit"]'),
      buttonInsideLink: !!w.querySelector('[data-sf-m="trades-published-link"] button'),
      lowerPanel: !!w.querySelector('[data-sf-m="trades-published-lower-panel"]'),
      lowerInput: (w.querySelector('[data-sf-m="trades-published-lower-input"]')||{}).value ?? null,
      lowerOkDisabled: w.querySelector('[data-sf-m="trades-published-lower-ok"]') ? w.querySelector('[data-sf-m="trades-published-lower-ok"]').disabled : null,
      lowerHint: (w.querySelector('[data-sf-m="trades-published-lower-err"]')||{}).textContent || null,
    })),
    actionsCount: qa('[data-sf-m="trades-published-actions"]').length,
    emptyText: (q('[data-sf-m="trades-published-empty"]')||{}).textContent || null,
  }
})()`

const settle = async (page) => {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.waitForTimeout(120)
}

const run = async () => {
  const result = { generatedAt: new Date().toISOString(), mode: 'MOCK-API (fixture 库) + dist 真构建产物', origin: ORIGIN, cases: {}, pageErrors: [], consoleErrors: [], patchBodies: null, mineGetLog: null }
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
    localStorage.setItem('token', 'qa-token')
  })
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin === ORIGIN) {
      if (url.pathname.startsWith('/api/')) {
        let body = null
        try { body = req.postDataJSON() } catch { body = null }
        return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(apiResponse(req.method(), url.pathname, body)) })
      }
      const file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      }
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'index.html')) })
    }
    return route.abort()
  })

  const page = await context.newPage()
  page.on('pageerror', (err) => result.pageErrors.push(String(err?.message || err)))
  page.on('console', (msg) => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()) })
  const goto = async (p) => { await page.goto(`${ORIGIN}${p}`, { waitUntil: 'domcontentloaded' }) }

  // ===== ① 编辑页预填（draft 行 501：DigitalAutoDeliver） =====
  // ★ 判据基线先行快照：mock PATCH 会原地改 ROWS[0]（description/title），若在流程末尾
  //   才用 ROWS[0] 对比 pre 快照，会拿「已改后的夹具」比「改前值」恒假红（2026-10-20 实测）。
  const EXPECTED_PRE = { description: ROWS[0].description, price: ROWS[0].price, stock: ROWS[0].stock, thumbs: ROWS[0].media_urls.length }
  await goto('/item/501/edit')
  await page.waitForSelector('[data-sf-m="item-form"]', { timeout: 15000 })
  await settle(page)
  result.cases.pre = await page.evaluate(READ_FN)

  // ===== ② 改描述保存 ⇒ 只传 description ⇒ 回列表 ⇒ 首行即新标题 =====
  const NEW_DESC = '降价 probe 新标题行\n第二行内容（探针）'
  await page.fill('[data-sf-m="item-input-note"]', NEW_DESC)
  await page.click('[data-sf-m="item-primary"]')
  await page.waitForURL('**/profile/trades/published', { timeout: 15000 })
  await page.waitForSelector('[data-sf-m="trades-published-item"]', { timeout: 15000 })
  await settle(page)
  result.cases.saved = await page.evaluate(READ_FN)
  result.cases.savedPatchBodies = patchBodies.map((x) => ({ ...x }))
  result.cases.rowAfterSave = ROWS.find((r) => r.listing_id === 501)

  // ===== ③b listed 行编辑页（item_type=NULL 不猜补 + 库存可改） =====
  patchBodies.length = 0
  await goto('/item/502/edit')
  await page.waitForSelector('[data-sf-m="item-form"]', { timeout: 15000 })
  await settle(page)
  result.cases.preListed = await page.evaluate(READ_FN)

  // ===== ③ 列表行内动作 =====
  await goto('/profile/trades/published')
  await page.waitForSelector('[data-sf-m="trades-published-item"]', { timeout: 15000 })
  await settle(page)
  result.cases.list = await page.evaluate(READ_FN)
  result.cases.mineGetCountAtListLoad = mineGetCount

  const row502 = page.locator('[data-sf-m="trades-published-item"][data-sf-status="listed"]')
  await row502.locator('[data-sf-m="trades-published-lower"]').click()
  await page.waitForSelector('[data-sf-m="trades-published-lower-panel"]', { timeout: 5000 })
  const gate = {}
  for (const [label, value] of [['equal', '66'], ['raise', '67'], ['zero', '0'], ['nonInteger', '65.5'], ['valid', '65']]) {
    await page.fill('[data-sf-m="trades-published-lower-input"]', value)
    await settle(page)
    gate[label] = await page.evaluate(() => {
      const panel = document.querySelector('[data-sf-m="trades-published-lower-panel"]')
      const ok = panel.querySelector('[data-sf-m="trades-published-lower-ok"]')
      return { value: panel.querySelector('[data-sf-m="trades-published-lower-input"]').value, okDisabled: ok.disabled, hint: (panel.querySelector('[data-sf-m="trades-published-lower-err"]') || {}).textContent || null }
    })
  }
  result.cases.lowerGate = gate
  const pathBefore = await page.evaluate(() => location.pathname)
  const mineBefore = mineGetCount
  await page.click('[data-sf-m="trades-published-lower-ok"]')
  await page.waitForSelector('[data-sf-m="trades-published-lower-panel"]', { state: 'detached', timeout: 5000 })
  await settle(page)
  result.cases.afterLower = await page.evaluate(READ_FN)
  result.cases.afterLowerPatchBodies = patchBodies.map((x) => ({ ...x }))
  result.cases.noNavigation = (await page.evaluate(() => location.pathname)) === pathBefore
  result.cases.mineGetCountAfterLower = mineGetCount
  result.cases.mineGetCountUnchanged = mineGetCount === mineBefore
  result.cases.rowAfterLower = ROWS.find((r) => r.listing_id === 502)

  // ===== ④ pageerror 汇总 =====
  result.cases.pageErrorCount = result.pageErrors.length
  result.verdict = {
    '① 预填一致': result.cases.pre.description === EXPECTED_PRE.description && result.cases.pre.price === EXPECTED_PRE.price && result.cases.pre.stock === EXPECTED_PRE.stock && result.cases.pre.existingThumbs === EXPECTED_PRE.thumbs,
    '① cid 只读': result.cases.pre.cidReadonly?.readOnly === true && result.cases.pre.cidSelectCount === 0,
    '① 草稿库存禁用+提示': result.cases.pre.stockDisabled === true && Boolean(result.cases.pre.stockLockedHint),
    '① 级联反推': result.cases.pre.typeChecked.join() === 'item-input-type-digital' && result.cases.pre.deliverChecked.join() === 'item-input-deliver-auto' && result.cases.pre.shipGroupPresent === false,
    '② 只传变化字段': JSON.stringify(result.cases.savedPatchBodies) === JSON.stringify([{ listingId: 501, body: { description: NEW_DESC } }]),
    '② 库内变+首行即标题': result.cases.rowAfterSave?.description === NEW_DESC && result.cases.rowAfterSave?.title === '降价 probe 新标题行',
    '② 回列表': String(result.cases.saved.url).includes('/profile/trades/published'),
    '③ 仅 draft|listed 有按钮': result.cases.list.actionsCount === 2 && result.cases.list.rows.every((r) => r.hasActions === (r.status === 'draft' || r.status === 'listed')),
    '③ 无 button 嵌 a': result.cases.list.rows.every((r) => r.buttonInsideLink === false) && result.cases.list.rows.every((r) => r.isLink === 'A'),
    '③ 闸四非法全置灰': gate.equal.okDisabled && gate.raise.okDisabled && gate.zero.okDisabled && gate.nonInteger.okDisabled,
    '③ 非法有内联提示': Boolean(gate.equal.hint) && Boolean(gate.raise.hint) && Boolean(gate.zero.hint),
    '③ 合法降价即时更新': result.cases.noNavigation === true && result.cases.mineGetCountUnchanged === true && (result.cases.afterLower.rows.find((r) => r.status === 'listed') || {}).priceText?.includes('$65') === true,
    '③ PATCH 只带 price': JSON.stringify(result.cases.afterLowerPatchBodies) === JSON.stringify([{ listingId: 502, body: { price: 65 } }]),
    '④ 零 pageerror': result.pageErrors.length === 0,
  }
  result.allPass = Object.values(result.verdict).every(Boolean)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(`[probe] out=${OUT}`)
  console.log(`[probe] allPass=${result.allPass}`)
  for (const [k, v] of Object.entries(result.verdict)) console.log(`  ${v ? 'PASS' : 'FAIL'}  ${k}`)
  await browser.close()
  if (!result.allPass) process.exitCode = 1
}

run().catch((err) => { console.error('[probe] fatal', err); process.exit(2) })
