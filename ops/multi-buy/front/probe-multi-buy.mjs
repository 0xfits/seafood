/**
 * 多件购买前端 · 浏览器探针（design §26.18 / route §49.17 / data §40.13 · 本单自检）
 * 配方承 ops/item-detail/front/probe-condition-form.mjs：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server / 零真后端 / **零库写**）
 *   · 登录态 = localStorage 种子（addInitScript，token = 自造 JWT、exp 远期）
 *   · API 全部 context.route 内内存自截；`POST /api/listing` / `PATCH /api/listing/:id` /
 *     `POST /api/listing/:id/buy` 的**请求体**被 Node 侧记账 ⇒ 断言不看页面自报
 *
 * 判据（派单 ①–④，390 / 1536 两档各跑一遍）：
 *   ① 发布页：stock=1 ⇒ 开关**零渲染**；stock=5 ⇒ 有且**默认关**；降回 1 ⇒ 自动关且整块消失；
 *      回涨 5 ⇒ 仍关（单向，不自动恢复）。开开关后提交 ⇒ POST 载荷 `allow_multi_buy === true`。
 *   ② 详情页（授权）：点【立即购买】⇒ 弹层开、**本次零请求**、默认 1、提示含 cap；
 *      取消 ⇒ 零请求；再开后填 3 + 确认 ⇒ 恰好 1 次购买、载荷 `quantity === '3'`。
 *   ③ 详情页（未授权 / stock=1）⇒ 零弹层、直买 1 件、载荷 `quantity === '1'`。
 *   ④ 两档几何：层内两键完整在视口内、底栏几何开层前后不变、零横向溢出、零 pageerror。
 * 用法：node probe-multi-buy.mjs [out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/multi-buy/front/readings/front-multi-buy-probe.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MY_UID = 970213
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const FAKE_JWT = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ sub: String(MY_UID), evm: '0x9702130000000000000000000000000000000213', iat: 1760000000, exp: 4102444800 })}.probe`

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
}

// ---- 夹具 ------------------------------------------------------------------------------------
/** 编辑读口行（`GET /api/listing/:id/edit` · 14 键形状；`allow_multi_buy` = 迁移 0061 第 14 键）。 */
const editRow = (over = {}) => ({
  listing_id: 501, title: 'FIXTURE 桌面音箱', price: 128, cid: 1, status: 'listed', stock: 5,
  media_urls: [], time_created: '2026-10-20 10:00:00',
  description: 'FIXTURE 桌面音箱\n九成新 音质正常 箱说齐', item_type: 'PhysicalFreeShip', condition: 'LikeNew',
  allow_multi_buy: true, ...over,
})
const EDIT_501 = editRow({ listing_id: 501, stock: 5, allow_multi_buy: true })
const EDIT_502 = editRow({ listing_id: 502, stock: 1, allow_multi_buy: true }) // 正常终态：授权但只剩 1 件

/** 详情行（`GET /api/prize/:ref`）：卖家 = 他人 ⇒ 买家态（购买钮可用）。 */
const SELLER = { uid: 880001, nickname: '0x88**01', avatar: null, credit: 'good' }
const detailRow = (over = {}) => ({
  listing_id: 601, bID: 601, item_code: 'MB00001', name: 'FIXTURE 多件商品', title: 'FIXTURE 多件商品',
  points: 66, price: 66, cid: 1, stock: 5, status: 'listed', media_urls: [],
  description: 'FIXTURE 多件商品\n可批量买', item_type: 'PhysicalFreeShip', condition: 'LikeNew',
  seller: SELLER, wants: 2, views: 9, allow_multi_buy: true, ...over,
})
const DETAIL = {
  601: detailRow(),                                                                  // 授权 · stock 5 ⇒ cap 5
  602: detailRow({ listing_id: 602, bID: 602, item_code: 'MB00002', allow_multi_buy: false }), // 未授权
  603: detailRow({ listing_id: 603, bID: 603, item_code: 'MB00003', stock: 20 }),            // 授权 · stock 20 ⇒ cap 10
  604: detailRow({ listing_id: 604, bID: 604, item_code: 'MB00004', stock: 1 }),             // 授权 · stock 1 ⇒ 不生效
}

const postBodies = []   // ★ 载荷记账（Node 侧）
const patchBodies = []
const buyBodies = []

const apiResponse = (method, pathname, body) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/currencies') return data([{ cid: 1, symbol: '$', name: '社区积分' }])
  if (pathname === '/api/listing/mine') return data([EDIT_501, EDIT_502])
  if (pathname === '/api/listing' && method === 'POST') {
    postBodies.push(body)
    return data({ ...EDIT_501, listing_id: 9001, status: 'draft', allow_multi_buy: body?.allow_multi_buy === true })
  }
  const editMatch = pathname.match(/^\/api\/listing\/(\d+)\/edit$/)
  if (editMatch) {
    const id = Number(editMatch[1])
    return data(id === 502 ? EDIT_502 : EDIT_501)
  }
  const buyMatch = pathname.match(/^\/api\/listing\/(\d+)\/buy$/)
  if (buyMatch && method === 'POST') {
    buyBodies.push({ listingId: Number(buyMatch[1]), body })
    return data({ order_id: 7001 })
  }
  if (/^\/api\/listing\/\d+$/.test(pathname) && method === 'PATCH') {
    patchBodies.push({ listingId: Number(pathname.split('/').pop()), body })
    return data({ ...EDIT_501, ...(body || {}) })
  }
  const prizeMatch = pathname.match(/^\/api\/prize\/([^/]+)$/)
  if (prizeMatch && method === 'GET') {
    const key = String(prizeMatch[1])
    const hit = DETAIL[key] || Object.values(DETAIL).find((r) => r.item_code === key)
    if (hit) return data({ ...hit })
  }
  if (pathname === '/api/home') return data({ tasks: [], user_points: 0, claimed_prize_ids: [], prizes: [] })
  if (pathname === '/api/favorites') return data([])
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内测量器（只读 DOM） -------------------------------------------------------------------
const MEASURE_PUBLISH = `(() => {
  const q = (s) => document.querySelector(s)
  const m = (k) => q('[data-sf-m="' + k + '"]')
  const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const wrap = m('item-multi-buy')
  const box = m('item-input-multi-buy-box')
  const label = m('item-input-multi-buy')
  return {
    present: !!wrap,
    boxPresent: !!box,
    checked: box ? box.checked : null,
    labelText: label ? label.textContent.trim() : null,
    labelRect: rc(label),
    tapH: label ? Math.round(label.getBoundingClientRect().height) : null,
    fontSize: label ? getComputedStyle(label).fontSize : null,
    stockValue: m('item-input-stock') ? m('item-input-stock').value : null,
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    statusPhase: m('item-status') ? m('item-status').getAttribute('data-sf-phase') : null,
  }
})()`

const MEASURE_DETAIL = `(() => {
  const q = (s) => document.querySelector(s)
  const m = (k) => q('[data-sf-m="' + k + '"]')
  const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const layer = m('item-buy-qty-layer')
  const input = m('item-buy-qty-input')
  const ok = m('item-buy-qty-ok')
  const cancel = m('item-buy-qty-cancel')
  const bar = m('item-actionbar')
  return {
    detailPhase: m('item-detail-empty') ? m('item-detail-empty').getAttribute('data-sf-phase') : 'ok',
    layerOpen: !!layer,
    sheetRect: rc(m('item-buy-qty-sheet')),
    hintText: m('item-buy-qty-hint') ? m('item-buy-qty-hint').textContent.trim() : null,
    titleText: m('item-buy-qty-title') ? m('item-buy-qty-title').textContent.trim() : null,
    inputValue: input ? input.value : null,
    inputMin: input ? input.getAttribute('min') : null,
    inputMax: input ? input.getAttribute('max') : null,
    okRect: rc(ok),
    okDisabled: ok ? ok.disabled : null,
    cancelRect: rc(cancel),
    okText: ok ? ok.textContent.trim() : null,
    cancelText: cancel ? cancel.textContent.trim() : null,
    barRect: rc(bar),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    regionCount: document.querySelectorAll('[data-sf-region]').length,
  }
})()`

const settle = async (page, sel) => {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  if (sel) await page.waitForSelector(sel, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(220)
}

const setInput = (page, hook, value) => page.evaluate(([k, v]) => {
  const el = document.querySelector('[data-sf-m="' + k + '"]')
  if (!el) throw new Error('missing hook ' + k)
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, [hook, value])

const clickHook = (page, key) => page.evaluate((k) => {
  const el = document.querySelector('[data-sf-m="' + k + '"]')
  if (!el) throw new Error('missing hook ' + k)
  el.click()
}, key)

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const errors = []
  const readings = { generatedAt: new Date().toISOString(), dist: DIST, cases: {} }

  const newContext = async (viewport, mobile) => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
    context.addInitScript(([token, uid]) => {
      localStorage.setItem('user', JSON.stringify({ uID: uid, token, evm: '0x9702130000000000000000000000000000000213' }))
      localStorage.setItem('theme', 'light')
    }, [FAKE_JWT, MY_UID])
    await context.route('**/*', async (route) => {
      const req = route.request()
      const u = new URL(req.url())
      if (u.origin === ORIGIN || u.hostname === 'sf.local') {
        if (u.pathname.startsWith('/api/')) {
          let body = null
          try { body = req.postDataJSON() } catch { body = null }
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname, body)) })
        }
        const rel = u.pathname === '/' ? '/index.html' : u.pathname
        const file = path.join(DIST, rel)
        if (!fs.existsSync(file)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'index.html')) })
        return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })
    context.on('pageerror', (e) => errors.push({ where: 'pageerror', message: String(e) }))
    context.on('console', (msg) => { if (msg.type() === 'error') errors.push({ where: 'console', message: msg.text() }) })
    return context
  }

  const oneViewport = async (tag, viewport, mobile) => {
    const ctx = await newContext(viewport, mobile)
    const page = await ctx.newPage()
    const measurePublish = () => page.evaluate(MEASURE_PUBLISH)
    const measureDetail = () => page.evaluate(MEASURE_DETAIL)
    const c = { buysPerStep: {} }

    // ---------- ① 发布页：可见性 / 默认关 / 单向自动关 / 载荷 ----------
    await page.goto(`${ORIGIN}/item/new`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-form"]')
    c.publishStock1 = await measurePublish()               // 默认 stock='1' ⇒ 零渲染

    await setInput(page, 'item-input-stock', '5')
    await page.waitForTimeout(160)
    c.publishStock5 = await measurePublish()               // 有且默认关

    await clickHook(page, 'item-input-multi-buy-box')
    await page.waitForTimeout(140)
    c.publishStock5on = await measurePublish()             // 开

    await setInput(page, 'item-input-stock', '1')
    await page.waitForTimeout(160)
    c.publishStock1Downgrade = await measurePublish()      // 降量 ⇒ 整块消失（自动关）

    await setInput(page, 'item-input-stock', '5')
    await page.waitForTimeout(160)
    c.publishStock5Back = await measurePublish()           // 回涨 ⇒ 仍关（不自动恢复）

    // 重新打开开关 + 填完整表单 ⇒ 提交 ⇒ 载荷记账
    await clickHook(page, 'item-input-multi-buy-box')
    await page.waitForTimeout(120)
    await setInput(page, 'item-input-note', 'FIXTURE 多件购买探针商品\n可批量买 5 件')
    await setInput(page, 'item-input-price', '66')
    await clickHook(page, 'item-input-type-physical')
    await page.waitForTimeout(120)
    await clickHook(page, 'item-input-ship-free')
    await page.waitForTimeout(120)
    await clickHook(page, 'item-input-condition-likeNew')
    await page.waitForTimeout(120)
    c.publishBeforeSubmit = await measurePublish()
    const postsBefore = postBodies.length
    await clickHook(page, 'item-primary')
    for (let i = 0; i < 60 && postBodies.length === postsBefore; i += 1) await page.waitForTimeout(100)
    await page.waitForTimeout(200)
    c.publishPostWait = { before: postsBefore, after: postBodies.length }

    // ---------- 编辑页：预填 / 唯一变化 / 库存 1 的空渲染 ----------
    await page.goto(`${ORIGIN}/item/501/edit`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-form"]')
    c.edit501 = await measurePublish()                     // 授权 + stock 5 ⇒ 勾上

    // 真实变化臂：取消勾选 ⇒ PATCH 必须带 `allow_multi_buy: false`（显式关授权）
    await clickHook(page, 'item-input-multi-buy-box')
    await page.waitForTimeout(140)
    c.edit501Unchecked = await measurePublish()
    const patchesBefore = patchBodies.length
    await clickHook(page, 'item-primary')
    for (let i = 0; i < 60 && patchBodies.length === patchesBefore; i += 1) await page.waitForTimeout(100)
    await page.waitForTimeout(200)
    c.edit501PatchWait = { before: patchesBefore, after: patchBodies.length }

    await page.goto(`${ORIGIN}/item/502/edit`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-form"]')
    c.edit502 = await measurePublish()                     // 授权但 stock=1 ⇒ 零渲染

    const patchesBefore2 = patchBodies.length
    await clickHook(page, 'item-primary')
    for (let i = 0; i < 60 && patchBodies.length === patchesBefore2; i += 1) await page.waitForTimeout(100)
    await page.waitForTimeout(200)
    c.edit502PatchWait = { before: patchesBefore2, after: patchBodies.length }

    // 未变臂：只改价格 ⇒ PATCH **不带** `allow_multi_buy`（不把库值抄回去）
    await page.goto(`${ORIGIN}/item/501/edit`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-form"]')
    await setInput(page, 'item-input-price', '129')
    await page.waitForTimeout(140)
    const patchesBefore3 = patchBodies.length
    await clickHook(page, 'item-primary')
    for (let i = 0; i < 60 && patchBodies.length === patchesBefore3; i += 1) await page.waitForTimeout(100)
    await page.waitForTimeout(200)
    c.edit501PricePatchWait = { before: patchesBefore3, after: patchBodies.length }

    // ---------- ② 详情页（授权 · stock 5 ⇒ cap 5） ----------
    await page.goto(`${ORIGIN}/item/601`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-buy-btn"]')
    c.detail601Before = await measureDetail()

    let buyCount = buyBodies.length
    await clickHook(page, 'item-buy-btn')
    await page.waitForTimeout(260)
    c.detail601Layer = await measureDetail()
    c.buysPerStep.openAuth = buyBodies.length - buyCount

    await clickHook(page, 'item-buy-qty-cancel')
    await page.waitForTimeout(220)
    c.detail601Cancelled = await measureDetail()
    c.buysPerStep.cancelAuth = buyBodies.length - buyCount

    buyCount = buyBodies.length
    await clickHook(page, 'item-buy-btn')
    await page.waitForTimeout(220)
    await setInput(page, 'item-buy-qty-input', '3')
    await page.waitForTimeout(140)
    c.detail601Qty3 = await measureDetail()
    await clickHook(page, 'item-buy-qty-ok')
    for (let i = 0; i < 60 && buyBodies.length === buyCount; i += 1) await page.waitForTimeout(100)
    await page.waitForTimeout(260)
    c.buysPerStep.confirmAuth = buyBodies.length - buyCount
    c.detail601AfterBuy = await measureDetail()

    // ---------- ③ 详情页（未授权 · stock 5） ----------
    await page.goto(`${ORIGIN}/item/602`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-buy-btn"]')
    buyCount = buyBodies.length
    await clickHook(page, 'item-buy-btn')
    await page.waitForTimeout(320)
    c.detail602 = await measureDetail()
    c.buysPerStep.unauthDirect = buyBodies.length - buyCount

    // ---------- ③b 详情页（授权 · stock 20 ⇒ cap 10）+ stock 1 不生效 ----------
    await page.goto(`${ORIGIN}/item/603`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-buy-btn"]')
    buyCount = buyBodies.length
    await clickHook(page, 'item-buy-btn')
    await page.waitForTimeout(260)
    c.detail603Cap10 = await measureDetail()
    c.buysPerStep.openCap10 = buyBodies.length - buyCount
    await clickHook(page, 'item-buy-qty-cancel')
    await page.waitForTimeout(160)

    await page.goto(`${ORIGIN}/item/604`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-buy-btn"]')
    buyCount = buyBodies.length
    await clickHook(page, 'item-buy-btn')
    await page.waitForTimeout(320)
    c.detail604Stock1 = await measureDetail()
    c.buysPerStep.stock1Direct = buyBodies.length - buyCount

    readings.cases[tag] = c
    await ctx.close()
  }

  await oneViewport('h5_390', { width: 390, height: 844 }, true)
  await oneViewport('web_1536', { width: 1536, height: 960 }, false)

  readings.postBodies = postBodies
  readings.patchBodies = patchBodies
  readings.buyBodies = buyBodies
  readings.pageErrors = errors

  // ---- 判据 ---------------------------------------------------------------------------------
  const inViewport = (r, vp) => !!r && r.y >= 0 && r.x >= 0 && r.y + r.h <= vp.h + 1 && r.x + r.w <= vp.w + 1
  const judge = (c) => {
    if (!c) return null
    const post = postBodies.find((b) => b && Array.isArray(b.media_urls) && b.stock === '5')
    const buy3 = buyBodies.find((b) => b.body && b.body.quantity === '3')
    const buy1Unauth = buyBodies.find((b) => b.listingId === 602)
    const buy1Stock1 = buyBodies.find((b) => b.listingId === 604)
    const patch501 = patchBodies.find((p) => p.listingId === 501 && p.body && p.body.allow_multi_buy === false)
    const patch501Price = patchBodies.find((p) => p.listingId === 501 && p.body && p.body.price === 129)
    const patch502 = patchBodies.find((p) => p.listingId === 502)
    return {
      // ① 可见性 / 默认关 / 单向
      hiddenAtStock1: c.publishStock1.present === false && c.publishStock1.boxPresent === false,
      shownAtStock5DefaultOff: c.publishStock5.present === true && c.publishStock5.boxPresent === true
        && c.publishStock5.checked === false,
      autoOffOnDowngrade: c.publishStock1Downgrade.present === false && c.publishStock1Downgrade.checked === null,
      noAutoRestoreOnRaise: c.publishStock5Back.present === true && c.publishStock5Back.checked === false,
      labelText: c.publishStock5.labelText,
      labelTapAtLeast44: (c.publishStock5.tapH ?? 0) >= 44,
      labelFontAtLeast12: parseFloat(c.publishStock5.fontSize || '0') >= 12,
      publishPayloadTrue: !!post && post.allow_multi_buy === true,
      // 编辑页
      editPrefillChecked: c.edit501.present === true && c.edit501.checked === true,
      // ★ 2026-10-20 探针串扰修正：本臂与「取消勾选写 false」共用 listing 501，
      //   旧判据 `!patch501` 会把那条 false patch 误当成「只改价格的 patch」⇒ 恒假红。
      //   正确判据 = 只改价格的那条 patch 不得携带 allow_multi_buy。
      editPatchNoMultiBuyWhenUnchanged: !!patch501Price && patch501Price.body.allow_multi_buy === undefined,
      editUncheckWritesFalse: !!patch501 && patch501.body.allow_multi_buy === false,
      editStock1Hidden: c.edit502.present === false,
      editStock1PatchNoMultiBuy: !patch502 || patch502.body.allow_multi_buy === undefined,
      // ② 授权态弹层
      layerOpensZeroRequest: c.detail601Layer.layerOpen === true && c.buysPerStep.openAuth === 0,
      layerDefaultOne: c.detail601Layer.inputValue === '1',
      layerShowsCap: String(c.detail601Layer.hintText || '').includes('5') && c.detail601Layer.inputMax === '5',
      layerMinMax: c.detail601Layer.inputMin === '1' && c.detail601Layer.inputMax === '5',
      cancelZeroRequest: c.detail601Cancelled.layerOpen === false && c.buysPerStep.cancelAuth === 0,
      confirmPayloadQty: c.buysPerStep.confirmAuth === 1 && !!buy3 && buy3.listingId === 601,
      // ③ 未授权 / stock 1 ⇒ 直买 1 件
      unauthNoLayerQty1: c.detail602.layerOpen === false && c.buysPerStep.unauthDirect === 1
        && !!buy1Unauth && buy1Unauth.body.quantity === '1',
      stock1NoLayerQty1: c.detail604Stock1.layerOpen === false && c.buysPerStep.stock1Direct === 1
        && !!buy1Stock1 && buy1Stock1.body.quantity === '1',
      // 上限 = min(stock, 10)
      cap10WhenStock20: c.detail603Cap10.layerOpen === true && c.detail603Cap10.inputMax === '10'
        && String(c.detail603Cap10.hintText || '').includes('10'),
      // ④ 几何 / 零溢出 / 零 pageerror
      layerButtonsInViewport: inViewport(c.detail601Layer.okRect, c.detail601Layer.viewport)
        && inViewport(c.detail601Layer.cancelRect, c.detail601Layer.viewport),
      actionbarStableAfterClose: JSON.stringify(c.detail601Before.barRect) === JSON.stringify(c.detail601Cancelled.barRect),
      zeroOverflow: [c.publishStock5, c.publishStock1Downgrade, c.detail601Layer, c.detail602].every((x) => x.overflowPx === 0),
      noNewRegion: c.detail601Layer.regionCount === c.detail601Before.regionCount,
    }
  }

  readings.verdict = {
    pageErrorCount: errors.length,
    postCount: postBodies.length,
    patchCount: patchBodies.length,
    buyCount: buyBodies.length,
    h5_390: judge(readings.cases.h5_390),
    web_1536: judge(readings.cases.web_1536),
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(readings, null, 2))
  console.log(`saved: ${OUT}`)
  console.log(`pageErrors: ${errors.length} · posts: ${postBodies.length} · patches: ${patchBodies.length} · buys: ${buyBodies.length}`)
  console.log(JSON.stringify(readings.verdict, null, 2))
  await browser.close()
}

run().catch((e) => { console.error('PROBE CRASH:', e); process.exit(1) })
