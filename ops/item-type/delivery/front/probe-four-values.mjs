/**
 * 商品分类四值（迁移 0054）前端探针 —— 发布页级联三控件 + 卡面两枚标签
 * ============================================================================
 * 配方（承 `ops/v119-msg-panel/qa/probe-geometry-qa.mjs` / `ops/item-actionbar-20261017/probe`）：
 *   · `context.route` 把 `http://sf.local/**` 映射到磁盘 `frontend/dist` ⇒ **零 dev server**
 *   · API 一律在 route 内内存自截（夹具 + 请求录制）⇒ **零真后端 / 零库写**
 *   · 登录态 = `addInitScript` 预置 `localStorage.user/token`（真 token 头不影响渲染断言）
 *   · 禁动画 + rAF 静默等待（稳态采样，不用固定 ms 判冷启动）
 *
 * 判据（design §26.12.8 / route §49.11.1 / data §40.8.1）：
 *   ① 四组合载荷：digital+auto ⇒ DigitalAutoDeliver / digital+manual ⇒ DigitalManualDeliver /
 *      physical+free ⇒ PhysicalFreeShip / physical+buyer ⇒ PhysicalBuyerShip；**绝不出现裸 `Digital`**
 *   ② 分支互斥：数字分支不渲染运费控件 / 实物分支不渲染交付控件（不渲染 ≠ display:none）
 *   ③ 切换一级 ⇒ 二级值清空（stale 不进载荷：切后提交必须被闸拦住）
 *   ④ 两个必选闸均零请求（一级未选 / 数字二级未选 / 实物二级未选 ⇒ POST /api/listing 与 /api/media 各 0）
 *   ⑤ 标签矩阵（四值 + NULL 五行夹具）：黄标数 = 1、绿标数 = 1、总标数 = 2，均 row1 首子元素
 *   ⑥ computed：黄 rgb(255,230,15) / 绿 rgb(74,222,128) / 字 rgb(32,32,32) / 12px / 行 48 / 卡 392
 *   ⑦ 负控：把绿标底色临时改回黄 ⇒ 探针的绿色断言必红（自证尺子有分辨力），随后恢复
 *
 * 用法：node probe-four-values.mjs [out.json] [distDir]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const HERE = '/Users/kevin/bistro/seafood/ops/item-type/delivery/front'
const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const OUT = process.argv[2] || path.join(HERE, 'readings/probe-four-values.json')
const DIST = process.argv[3] || path.join(REPO, 'frontend/dist')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8',
}

// ---- 卡面夹具：四值 + NULL 五行（命中值 / 其余枚举值 / 未分类各一行）----------------------
const FEED = [
  { bID: 901, item_type: 'PhysicalFreeShip', name: '实木书桌 九成新·包邮', title: '实木书桌 九成新·包邮' },
  { bID: 902, item_type: 'DigitalAutoDeliver', name: '设计素材合集·自动发货', title: '设计素材合集·自动发货' },
  { bID: 903, item_type: 'DigitalManualDeliver', name: '在线课程·手动发货', title: '在线课程·手动发货' },
  { bID: 904, item_type: 'PhysicalBuyerShip', name: '旧款胶片相机·运费自付', title: '旧款胶片相机·运费自付' },
  { bID: 905, item_type: null, name: '未分类的闲置物品', title: '未分类的闲置物品' },
].map((row) => ({
  ...row,
  cid: 1, price: 128, points: 128, stock: 1, status: 'available', statusText: '',
  stores_count: 1, wants: 2, description: '',
  seller: { uid: 970301, nickname: '0x12**cd', avatar: null, credit: 'new' },
  media_urls: [], image: null,
}))

const CURRENCIES = [{ cid: 1, symbol: '$', name: '平台积分' }]

const okBody = (data) => ({ success: true, data })

const newCtx = async (browser, reqLog, { width = 1536, height = 1000, auth = false } = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  await context.addInitScript(([isAuth]) => {
    localStorage.setItem('theme', 'light')
    if (isAuth) {
      localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
      localStorage.setItem('token', 'qa-token')
    } else {
      localStorage.removeItem('user'); localStorage.removeItem('token')
    }
  }, [auth])
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      let body = null
      try { body = req.postDataJSON() } catch (e) { body = req.postData() }
      reqLog.push({ method: req.method(), path: u.pathname, body })
      if (u.pathname === '/api/prize/all') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okBody(FEED)) })
      if (u.pathname === '/api/home') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(okBody({ tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0, is_authenticated: false })),
        })
      }
      if (u.pathname === '/api/currencies') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okBody(CURRENCIES)) })
      if (u.pathname === '/api/listing' && req.method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okBody({ listing_id: 990001, bID: 990001 })) })
      }
      if (/^\/api\/listing\/\d+$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okBody({ ok: true })) })
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okBody([])) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(okBody({})) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  return { context, page }
}

const settle = async (page, max = 60) => {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(`(()=>{const r=document.getElementById('root');return (r?r.innerHTML.length:0)+'|'+document.querySelectorAll('*').length})()`)
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

// ── 卡面读数（同一把尺子也用于负控）────────────────────────────────────────────
const TAG_MEASURE = `(() => {
  const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
  const rows = cards.map((card) => {
    const row = card.querySelector('[data-sf-m="reward-card-title"]');
    const y = card.querySelector('.sf-reward-ship-tag');
    const g = card.querySelector('.sf-reward-auto-tag');
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent,
        isFirstChild: row.firstElementChild === el,
        bg: cs.backgroundColor, fg: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight, radius: cs.borderTopLeftRadius,
        paddingY: cs.paddingTop, paddingX: cs.paddingLeft, marginRight: cs.marginRight,
        display: cs.display, verticalAlign: cs.verticalAlign,
        w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
      };
    };
    return {
      bID: (card.getAttribute('href') || '').split('/').pop(),
      titleText: row.textContent,
      row1H: Math.round(row.getBoundingClientRect().height),
      cardH: Math.round(card.getBoundingClientRect().height),
      yellow: pick(y), green: pick(g),
    };
  });
  return {
    cardCount: cards.length,
    yellowCount: document.querySelectorAll('.sf-reward-ship-tag').length,
    greenCount: document.querySelectorAll('.sf-reward-auto-tag').length,
    totalCount: document.querySelectorAll('.sf-reward-ship-tag, .sf-reward-auto-tag').length,
    rows,
  };
})()`

const main = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'probe-four-values.mjs · 商品分类四值（0054）前端',
    startedAt: new Date().toISOString(),
    origin: ORIGIN, dist: DIST,
    fixtures: { feed: FEED.map((r) => ({ bID: r.bID, item_type: r.item_type })), api: 'context.route 内存自截（零后端 / 零库写）' },
    expectations: {
      yellowBg: 'rgb(255, 230, 15)', greenBg: 'rgb(74, 222, 128)', fg: 'rgb(32, 32, 32)',
      fontSize: '12px', row1H: 48, cardH: 392,
    },
    states: {}, checks: {}, notes: [], pageErrors: [], consoleErrors: [],
  }
  const check = (key, pass, detail) => {
    out.checks[key] = { pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) }
    return Boolean(pass)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // A · 首页 feed：标签矩阵 + computed
  // ══════════════════════════════════════════════════════════════════════════
  {
    const reqLog = []
    const { context, page } = await newCtx(browser, reqLog, { width: 1536, height: 1000 })
    page.on('pageerror', (e) => out.pageErrors.push(String(e && e.message)))
    page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 200)) })
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
    await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 })
    await settle(page)
    const m = await page.evaluate(TAG_MEASURE)
    out.states.feed = m

    const rowOf = (id) => m.rows.find((r) => String(r.bID) === String(id))
    const free = rowOf(901); const auto = rowOf(902); const manual = rowOf(903)
    const buyer = rowOf(904); const none = rowOf(905)

    check('A1_cardCount_5', m.cardCount === 5, m.cardCount)
    // ⑤ 全 feed 计数：显示矩阵（只验「显示出来了」= 没验条件）
    check('A2_yellowCount_1', m.yellowCount === 1, m.yellowCount)
    check('A3_greenCount_1', m.greenCount === 1, m.greenCount)
    check('A4_totalTagCount_2', m.totalCount === 2, m.totalCount)
    check('A5_PhysicalFreeShip_yellowOnly', Boolean(free?.yellow) && !free?.green, { yellow: Boolean(free?.yellow), green: Boolean(free?.green), text: free?.yellow?.text })
    check('A6_DigitalAutoDeliver_greenOnly', Boolean(auto?.green) && !auto?.yellow, { green: Boolean(auto?.green), yellow: Boolean(auto?.yellow), text: auto?.green?.text })
    check('A7_DigitalManualDeliver_noTag', !manual?.yellow && !manual?.green)
    check('A8_PhysicalBuyerShip_noTag', !buyer?.yellow && !buyer?.green)
    check('A9_NULL_noTag', !none?.yellow && !none?.green)
    // 同位置：两枚标签都是 row1 的首个子元素（标题文字之前）
    check('A10_yellowIsFirstChild', free?.yellow?.isFirstChild === true)
    check('A11_greenIsFirstChild', auto?.green?.isFirstChild === true)
    // ⑥ computed 色值 / 字号 / 几何
    check('A12_yellowBg', free?.yellow?.bg === 'rgb(255, 230, 15)', free?.yellow?.bg)
    check('A13_greenBg', auto?.green?.bg === 'rgb(74, 222, 128)', auto?.green?.bg)
    check('A14_textColor_black', free?.yellow?.fg === 'rgb(32, 32, 32)' && auto?.green?.fg === 'rgb(32, 32, 32)', { yellow: free?.yellow?.fg, green: auto?.green?.fg })
    check('A15_fontSize_12', free?.yellow?.fontSize === '12px' && auto?.green?.fontSize === '12px', { yellow: free?.yellow?.fontSize, green: auto?.green?.fontSize })
    check('A16_row1_48', free?.row1H === 48 && auto?.row1H === 48, { free: free?.row1H, auto: auto?.row1H })
    check('A17_card_392', free?.cardH === 392 && auto?.cardH === 392, { free: free?.cardH, auto: auto?.cardH })
    // 同几何（两枚标签逐项相等，只差底色）
    const GEOM = ['fontSize', 'fontWeight', 'lineHeight', 'radius', 'paddingY', 'paddingX', 'marginRight', 'display', 'verticalAlign', 'h']
    const diff = GEOM.filter((k) => free?.yellow?.[k] !== auto?.green?.[k])
    check('A18_geometryIdentical', diff.length === 0, { diff, yellow: free?.yellow, green: auto?.green })

    // ── ⑦ 负控：把绿标底色临时改回黄 ⇒ 绿色断言必须变红（自证尺子有分辨力）──
    const styleHandle = await page.addStyleTag({ content: '.sf-reward-card.sf-reward-card{--sf-reward-tag-auto-bg:#FFE60F !important}' })
    await settle(page)
    const bad = await page.evaluate(TAG_MEASURE)
    const badGreen = bad.rows.find((r) => String(r.bID) === '902')?.green?.bg
    check('N1_negativeControl_turnsRed', badGreen !== 'rgb(74, 222, 128)' && badGreen === 'rgb(255, 230, 15)', { observed: badGreen, expectWouldFail: 'rgb(74, 222, 128)' })
    await styleHandle.evaluate((el) => el.remove())
    await settle(page)
    const restored = await page.evaluate(TAG_MEASURE)
    const backGreen = restored.rows.find((r) => String(r.bID) === '902')?.green?.bg
    check('N2_restored_greenAgain', backGreen === 'rgb(74, 222, 128)', backGreen)
    out.states.feedNegativeControl = { duringNegativeControl: badGreen, afterRestore: backGreen }

    await context.close()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // B · 发布页：级联三控件 ⇒ 四值载荷 + 互斥渲染 + 切换清空 + 必选闸零请求
  // ══════════════════════════════════════════════════════════════════════════
  const GROUP_STATE = `(() => ({
    typeGroup: document.querySelectorAll('[data-sf-m="item-select-type"]').length,
    deliverGroup: document.querySelectorAll('[data-sf-m="item-select-deliver"]').length,
    shipGroup: document.querySelectorAll('[data-sf-m="item-select-ship"]').length,
    deliverChecked: [...document.querySelectorAll('[data-sf-m="item-select-deliver"] input')].map((el) => el.checked),
    shipChecked: [...document.querySelectorAll('[data-sf-m="item-select-ship"] input')].map((el) => el.checked),
    typeAriaInvalid: document.querySelector('[data-sf-m="item-select-type"]')?.getAttribute('aria-invalid') || null,
    deliverAriaInvalid: document.querySelector('[data-sf-m="item-select-deliver"]')?.getAttribute('aria-invalid') || null,
    shipAriaInvalid: document.querySelector('[data-sf-m="item-select-ship"]')?.getAttribute('aria-invalid') || null,
    typeMissClass: (document.querySelector('[data-sf-m="item-select-type"]')?.className || '').includes('sf-item-choice-miss'),
    deliverMissClass: (document.querySelector('[data-sf-m="item-select-deliver"]')?.className || '').includes('sf-item-choice-miss'),
    shipMissClass: (document.querySelector('[data-sf-m="item-select-ship"]')?.className || '').includes('sf-item-choice-miss'),
    statusPhase: document.querySelector('[data-sf-m="item-status"]')?.getAttribute('data-sf-phase') || null,
    statusText: document.querySelector('[data-sf-m="item-status"]')?.textContent || null,
  }))()`

  const listingPosts = (log) => log.filter((r) => r.method === 'POST' && r.path === '/api/listing')
  const mediaPosts = (log) => log.filter((r) => r.method === 'POST' && r.path === '/api/media')
  const waitForCount = async (page, fn, n, timeout = 6000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (fn() >= n) return true
      await page.waitForTimeout(100)
    }
    return false
  }

  const openPublish = async (page) => {
    await page.goto(`${ORIGIN}/item/new`, { waitUntil: 'load' })
    await page.waitForSelector('[data-sf-m="item-select-type"]', { timeout: 15000 })
    await settle(page)
  }
  const fillBasics = async (page) => {
    await page.fill('[data-sf-m="item-input-title"]', '四值探针商品')
    await page.fill('[data-sf-m="item-input-price"]', '128')
  }

  const runCombo = async ({ typeSel, secondSel, secondGroup, expect }) => {
    const reqLog = []
    const { context, page } = await newCtx(browser, reqLog, { width: 1536, height: 1000, auth: true })
    page.on('pageerror', (e) => out.pageErrors.push(String(e && e.message)))
    page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 200)) })
    await openPublish(page)
    const initial = await page.evaluate(GROUP_STATE)
    await page.click(`[data-sf-m="item-input-type-${typeSel}"]`)
    await settle(page)
    const afterType = await page.evaluate(GROUP_STATE)
    await page.click(`[data-sf-m="item-input-${secondGroup}-${secondSel}"]`)
    await fillBasics(page)
    await page.click('[data-sf-m="item-primary"]')
    const fired = await waitForCount(page, () => listingPosts(reqLog).length, 1)
    const bodies = listingPosts(reqLog).map((r) => r.body)
    const payload = bodies[0] || null
    const rec = {
      typeSel, secondSel, secondGroup, expect,
      initial, afterType, fired,
      listingPostCount: bodies.length,
      item_type: payload?.item_type ?? null,
      payloadKeys: payload ? Object.keys(payload) : null,
      secondFieldKeys: payload ? Object.keys(payload).filter((k) => /ship|deliver/i.test(k) && k !== 'item_type') : null,
      mediaPostCount: mediaPosts(reqLog).length,
    }
    await context.close()
    return rec
  }

  const combos = [
    { key: 'B1_digital_auto', typeSel: 'digital', secondGroup: 'deliver', secondSel: 'auto', expect: 'DigitalAutoDeliver' },
    { key: 'B2_digital_manual', typeSel: 'digital', secondGroup: 'deliver', secondSel: 'manual', expect: 'DigitalManualDeliver' },
    { key: 'B3_physical_free', typeSel: 'physical', secondGroup: 'ship', secondSel: 'free', expect: 'PhysicalFreeShip' },
    { key: 'B4_physical_buyer', typeSel: 'physical', secondGroup: 'ship', secondSel: 'buyer', expect: 'PhysicalBuyerShip' },
  ]
  out.states.combos = {}
  for (const combo of combos) {
    const rec = await runCombo(combo)
    out.states.combos[combo.key] = rec
    check(`${combo.key}_payload`, rec.item_type === combo.expect && rec.listingPostCount === 1, { got: rec.item_type, want: combo.expect })
    check(`${combo.key}_noBareDigital`, rec.item_type !== 'Digital', rec.item_type)
    check(`${combo.key}_noSecondField`, (rec.secondFieldKeys || []).length === 0, rec.secondFieldKeys)
    // ② 分支互斥渲染：数字 ⇒ 无运费组；实物 ⇒ 无交付组
    const wantDeliver = combo.typeSel === 'digital' ? 1 : 0
    const wantShip = combo.typeSel === 'physical' ? 1 : 0
    check(`${combo.key}_branchExclusive`, rec.afterType.deliverGroup === wantDeliver && rec.afterType.shipGroup === wantShip,
      { deliverGroup: rec.afterType.deliverGroup, shipGroup: rec.afterType.shipGroup })
  }
  check('B0_initial_noSecondGroup', Object.values(out.states.combos).every((r) => r.initial.deliverGroup === 0 && r.initial.shipGroup === 0),
    Object.fromEntries(Object.entries(out.states.combos).map(([k, v]) => [k, { d: v.initial.deliverGroup, s: v.initial.shipGroup }])))

  // ── ③ 切换一级 ⇒ 二级清空（stale 不进载荷；切后提交必须被闸拦住、零请求）──
  {
    const reqLog = []
    const { context, page } = await newCtx(browser, reqLog, { width: 1536, height: 1000, auth: true })
    page.on('pageerror', (e) => out.pageErrors.push(String(e && e.message)))
    await openPublish(page)
    await page.click('[data-sf-m="item-input-type-physical"]')
    await page.click('[data-sf-m="item-input-ship-free"]')
    const picked = await page.evaluate(GROUP_STATE)
    await page.click('[data-sf-m="item-input-type-digital"]')
    await settle(page)
    const switched = await page.evaluate(GROUP_STATE)
    await fillBasics(page)
    const before = listingPosts(reqLog).length
    await page.click('[data-sf-m="item-primary"]')
    await page.waitForTimeout(800)
    const after = listingPosts(reqLog).length
    const gated = await page.evaluate(GROUP_STATE)
    await context.close()
    out.states.switchClears = { picked, switched, afterSubmit: gated, listingPostsBefore: before, listingPostsAfter: after }
    check('C1_switch_clearsShipValue', picked.shipChecked.includes(true) && switched.shipGroup === 0, { pickedShip: picked.shipChecked, switchedShipGroup: switched.shipGroup })
    check('C2_switch_clearsDeliverValue', switched.deliverGroup === 1 && switched.deliverChecked.every((c) => c === false), switched.deliverChecked)
    check('C3_staleNotInPayload_zeroRequest', after === before && gated.deliverAriaInvalid === 'true', { before, after, deliverAriaInvalid: gated.deliverAriaInvalid })
  }

  // ── ④ 必选闸：一级未选 / 数字二级未选 / 实物二级未选 ⇒ 零请求 ──
  const gateCase = async ({ key, typeSel }) => {
    const reqLog = []
    const { context, page } = await newCtx(browser, reqLog, { width: 1536, height: 1000, auth: true })
    page.on('pageerror', (e) => out.pageErrors.push(String(e && e.message)))
    await openPublish(page)
    if (typeSel) await page.click(`[data-sf-m="item-input-type-${typeSel}"]`)
    await fillBasics(page)
    await page.click('[data-sf-m="item-primary"]')
    await page.waitForTimeout(900)
    const state = await page.evaluate(GROUP_STATE)
    const rec = { typeSel: typeSel || null, listingPosts: listingPosts(reqLog).length, mediaPosts: mediaPosts(reqLog).length, state }
    await context.close()
    out.states[key] = rec
    return rec
  }

  const g1 = await gateCase({ key: 'D1_gate_noType' })
  check('D1_gate_noType_zeroRequests', g1.listingPosts === 0 && g1.mediaPosts === 0 && g1.state.typeAriaInvalid === 'true' && g1.state.typeMissClass === true, g1)
  const g2 = await gateCase({ key: 'D2_gate_noDeliver', typeSel: 'digital' })
  check('D2_gate_noDeliver_zeroRequests', g2.listingPosts === 0 && g2.mediaPosts === 0 && g2.state.deliverAriaInvalid === 'true' && g2.state.deliverMissClass === true, g2)
  const g3 = await gateCase({ key: 'D3_gate_noShip', typeSel: 'physical' })
  check('D3_gate_noShip_zeroRequests', g3.listingPosts === 0 && g3.mediaPosts === 0 && g3.state.shipAriaInvalid === 'true' && g3.state.shipMissClass === true, g3)
  const statusTexts = [g1.state.statusText, g2.state.statusText, g3.state.statusText]
  check('D4_gate_reusesExistingKey', statusTexts.every((s) => s && s === statusTexts[0]), statusTexts)

  out.pageErrors = out.pageErrors.slice(0, 20)
  out.consoleErrors = out.consoleErrors.slice(0, 20)
  const failed = Object.entries(out.checks).filter(([, v]) => !v.pass).map(([k]) => k)
  out.verdict = failed.length === 0 ? 'PASS' : 'FAIL'
  out.failedChecks = failed

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  await browser.close()

  console.log(`[probe] ${out.verdict} · checks ${Object.keys(out.checks).length - failed.length}/${Object.keys(out.checks).length}`)
  if (failed.length) console.log('[probe] FAILED: ' + failed.join(', '))
  console.log('[probe] out = ' + OUT)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('[probe] crashed:', error)
  process.exit(2)
})
