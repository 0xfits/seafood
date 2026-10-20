/**
 * 发布/编辑页 · 商品成色控件浏览器探针（迁移 0057 · route §49.14.3 · 本单自检）
 * 配方承 ops/item-detail/front/probe-front.mjs：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server / 零真后端 / **零库写**）
 *   · 登录态 = localStorage 种子（addInitScript，token = 自造 JWT、exp 远期）
 *   · API 全部 context.route 内内存自截；`POST /api/listing` 的**请求体**被 Node 侧记账 ⇒ 载荷断言不看页面内自报
 * 用法：node probe-condition-form.mjs [out.json]
 * 判据（派单 ①–④，390 / 1536 两档各跑一遍）：
 *   ① 实物分支 ⇒ 成色四选一组在场（4 个 radio + 四个中文标签）
 *   ② 选「几乎全新」后发布 ⇒ 拦截到的载荷 `item_condition === 'LikeNew'`（且 `item_type` = 实物四值之一）
 *   ③ 编辑页 `/item/501/edit` 预填后 = likeNew 选中（mine 行键 `condition`）
 *   ④ 数字分支 ⇒ 成色控件零渲染（组与四个选项都 0 命中）
 *   ⑤ 全程零 pageerror ＋ 零横向溢出
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/item-detail/front/readings/front-condition-probe.json')
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
/** 「我的挂单」行（`/api/listing/mine` 11 键形状）：实物 + 包邮 + 成色 = LikeNew（编辑页预填臂）。 */
const MINE_ROW = {
  listing_id: 501, title: 'FIXTURE 桌面音箱', price: 128, cid: 1, status: 'listed', stock: 1,
  media_urls: [], time_created: '2026-10-20 10:00:00',
  description: 'FIXTURE 桌面音箱\n九成新 音质正常 箱说齐', item_type: 'PhysicalFreeShip', condition: 'LikeNew',
}
/** 发布成功后的详情行（`POST /api/listing` 之后路由跳详情，避免落 catch-all）。 */
const NEW_ROW = {
  listing_id: 9001, bID: 9001, name: 'FIXTURE 新发布成色商品', title: 'FIXTURE 新发布成色商品',
  points: 66, price: 66, cid: 1, stock: 1, status: 'draft', media_urls: [],
  description: 'FIXTURE 新发布成色商品', item_type: 'PhysicalFreeShip', condition: 'LikeNew',
  seller: { uid: MY_UID, nickname: '0x97**13', avatar: null, credit: 'good' }, wants: 0, views: 1,
}

const postBodies = []   // ★ 载荷记账（Node 侧），判据不依赖页面自报
const patchBodies = []

const apiResponse = (method, pathname, body) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/currencies') return data([{ cid: 1, symbol: '$', name: '社区积分' }])
  if (pathname === '/api/listing/mine') return data([MINE_ROW])
  if (pathname === '/api/listing' && method === 'POST') {
    postBodies.push(body)
    return data({ ...MINE_ROW, listing_id: 9001, status: 'draft', item_condition: body?.item_condition ?? null })
  }
  if (/^\/api\/listing\/\d+$/.test(pathname) && method === 'PATCH') {
    patchBodies.push({ listingId: Number(pathname.split('/').pop()), body })
    return data({ ...MINE_ROW, ...(body?.item_condition !== undefined ? { condition: body.item_condition } : {}) })
  }
  if (pathname === '/api/prize/9001' || pathname === '/api/prize/501') return data({ ...NEW_ROW })
  if (pathname === '/api/home') return data({ tasks: [], user_points: 0, claimed_prize_ids: [], prizes: [] })
  if (pathname === '/api/favorites') return data([])
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内测量器（只读 DOM，不做业务判断） ------------------------------------------------------
const MEASURE = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const m = (k) => q('[data-sf-m="' + k + '"]')
  const ma = (k) => qa('[data-sf-m="' + k + '"]')
  const grp = m('item-select-condition')
  const inputs = grp ? [...grp.querySelectorAll('input[type="radio"]')] : []
  const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  return {
    url: location.href,
    lang: document.documentElement.lang || null,
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    typeGroup: !!m('item-select-type'),
    typeChecked: qa('input[name="item_type"]').filter((el) => el.checked).map((el) => el.value),
    shipChecked: qa('input[name="item_shipping"]').filter((el) => el.checked).map((el) => el.value),
    deliverCount: ma('item-input-deliver-auto').length + ma('item-input-deliver-manual').length,
    condition: {
      groupPresent: !!grp,
      role: grp ? grp.getAttribute('role') : null,
      ariaRequired: grp ? grp.getAttribute('aria-required') : null,
      ariaInvalid: grp ? grp.getAttribute('aria-invalid') : null,
      missClass: grp ? grp.className.split(' ').includes('sf-item-choice-miss') : null,
      rect: rc(grp),
      radioCount: inputs.length,
      values: inputs.map((el) => el.value),
      labels: grp ? [...grp.querySelectorAll('.sf-item-choice-text')].map((el) => el.textContent) : [],
      checkedValues: inputs.filter((el) => el.checked).map((el) => el.value),
      hookCount: ma('item-input-condition-brandNewSealed').length + ma('item-input-condition-likeNew').length
        + ma('item-input-condition-minorWear').length + ma('item-input-condition-heavyWear').length,
      // 探针自身的取数路径自检：任意 condition 相关钩子的总数（数字分支必须 = 0）
      anyConditionHook: qa('[data-sf-m^="item-input-condition-"]').length + (grp ? 1 : 0),
    },
    formPresent: !!m('item-form'),
    statusPhase: m('item-status') ? m('item-status').getAttribute('data-sf-phase') : null,
    statusText: m('item-status') ? m('item-status').textContent : null,
  }
})()`

const settle = async (page, sel = '[data-sf-m="item-form"]') => {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.waitForSelector(sel, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(200)
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const errors = []
  const readings = {
    generatedAt: new Date().toISOString(), dist: DIST,
    fixtures: { mineRow: { listing_id: MINE_ROW.listing_id, item_type: MINE_ROW.item_type, condition: MINE_ROW.condition } },
    cases: {},
  }

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

  const clickHook = (page, key) => page.evaluate((k) => {
    const el = document.querySelector('[data-sf-m="' + k + '"]')
    if (!el) throw new Error('missing hook ' + k)
    el.click()
  }, key)

  const fillForm = (page, description, price) => page.evaluate(([d, p]) => {
    const set = (key, value) => {
      const el = document.querySelector('[data-sf-m="' + key + '"]')
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('item-input-note', d)
    set('item-input-price', p)
  }, [description, price])

  const oneViewport = async (tag, viewport, mobile) => {
    const ctx = await newContext(viewport, mobile)
    const page = await ctx.newPage()
    const measure = () => page.evaluate(MEASURE)
    const caseData = {}

    // ① 实物分支 ⇒ 四选一在场；④ 数字分支 ⇒ 零控件
    await page.goto(`${ORIGIN}/item/new`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    caseData.initial = await measure()          // 一级未选 ⇒ 成色零渲染
    await clickHook(page, 'item-input-type-physical')
    await page.waitForTimeout(120)
    caseData.physicalBranch = await measure()   // ① 四选一在场
    await clickHook(page, 'item-input-type-digital')
    await page.waitForTimeout(120)
    caseData.digitalBranch = await measure()    // ④ 数字分支零控件

    // ② 实物 + 包邮 + 成色「几乎全新」⇒ 提交 ⇒ 载荷记账
    await clickHook(page, 'item-input-type-physical')
    await page.waitForTimeout(120)
    await clickHook(page, 'item-input-ship-free')
    await fillForm(page, 'FIXTURE 成色探针商品\n九成新 随手出', '66')
    await clickHook(page, 'item-input-condition-likeNew')
    await page.waitForTimeout(120)
    caseData.beforeSubmit = await measure()     // 选中态读数（checkedValues）
    const postsBefore = postBodies.length
    await clickHook(page, 'item-primary')
    // 等 Node 侧的 POST 记账落定（最多 5s）
    for (let i = 0; i < 50 && postBodies.length === postsBefore; i += 1) await page.waitForTimeout(100)
    caseData.submitWait = { postsBefore, postsAfter: postBodies.length }
    await page.waitForTimeout(200)
    caseData.afterSubmit = await measure().catch(() => null)

    // ③ 编辑页预填（mine 行 condition = LikeNew）
    await page.goto(`${ORIGIN}/item/501/edit`, { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-sf-m="item-select-condition"]')
    caseData.edit = await measure()

    // ③b 编辑改成「严重磨损」⇒ PATCH 只带 item_condition（草稿/在售均可改）
    const patchesBefore = patchBodies.length
    await clickHook(page, 'item-input-condition-heavyWear')
    await page.waitForTimeout(100)
    caseData.editChanged = await measure()
    await clickHook(page, 'item-primary')
    for (let i = 0; i < 50 && patchBodies.length === patchesBefore; i += 1) await page.waitForTimeout(100)
    caseData.editPatchWait = { patchesBefore, patchesAfter: patchBodies.length }
    await page.waitForTimeout(200)

    readings.cases[tag] = caseData
    await ctx.close()
  }

  await oneViewport('h5_390', { width: 390, height: 844 }, true)
  await oneViewport('web_1536', { width: 1536, height: 960 }, false)

  readings.postBodies = postBodies
  readings.patchBodies = patchBodies
  readings.pageErrors = errors

  // ---- 判据（全部由上方原始读数 / Node 侧载荷推导）----
  const ZH_LABELS = ['全新未拆封', '几乎全新', '细微磕碰划痕', '严重磨损']
  const FOUR = ['BrandNewSealed', 'LikeNew', 'MinorWear', 'HeavyWear']
  const judge = (c) => {
    if (!c) return null
    const post = postBodies.find((b) => b && b.item_condition === 'LikeNew')
    return {
      // ① 实物分支四选一在场（4 radio / 四值 / 四个中文标签 / 钩子 4 件）
      physicalGroupShown: c.physicalBranch.condition.groupPresent === true
        && c.physicalBranch.condition.radioCount === 4
        && JSON.stringify(c.physicalBranch.condition.values) === JSON.stringify(FOUR)
        && JSON.stringify(c.physicalBranch.condition.labels) === JSON.stringify(ZH_LABELS)
        && c.physicalBranch.condition.hookCount === 4
        && c.physicalBranch.condition.role === 'radiogroup'
        && c.physicalBranch.condition.ariaRequired === 'true',
      // ④ 数字分支零控件（含一级未选态）
      digitalZeroControls: c.digitalBranch.condition.groupPresent === false
        && c.digitalBranch.condition.anyConditionHook === 0
        && c.initial.condition.anyConditionHook === 0,
      // ② 选中「几乎全新」⇒ 发布载荷 item_condition=LikeNew
      selectedLikeNew: JSON.stringify(c.beforeSubmit.condition.checkedValues) === JSON.stringify(['LikeNew']),
      payloadLikeNew: !!post && post.item_type === 'PhysicalFreeShip',
      // ③ 编辑页预填 = likeNew 选中
      editPrefillLikeNew: JSON.stringify(c.edit.condition.checkedValues) === JSON.stringify(['LikeNew']),
      // ③b 改「严重磨损」⇒ PATCH 只带成色
      editPatchConditionOnly: patchBodies.some((p) => p.body && p.body.item_condition === 'HeavyWear'
        && Object.keys(p.body).length === 1),
      zeroOverflow: c.physicalBranch.overflowPx === 0 && (!c.edit || c.edit.overflowPx === 0),
    }
  }

  readings.verdict = {
    pageErrorCount: errors.length,
    postCount: postBodies.length,
    patchCount: patchBodies.length,
    h5_390: judge(readings.cases.h5_390),
    web_1536: judge(readings.cases.web_1536),
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(readings, null, 2))
  console.log(`saved: ${OUT}`)
  console.log(`pageErrors: ${errors.length} · posts: ${postBodies.length} · patches: ${patchBodies.length}`)
  console.log(JSON.stringify(readings.verdict, null, 2))
  await browser.close()
}

run().catch((e) => { console.error('PROBE CRASH:', e); process.exit(1) })
