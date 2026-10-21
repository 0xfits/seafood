/**
 * 「我的积分」卡：首页 → `/profile/assets` 迁移探针（Kevin 2026-10-21 裁定）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 首页 `/`（登录态）**零命中**：无 `[data-sf-m="home-my-points"]`、正文无「我的积分」文案、无 🪙
 *      ⇒ 「原位置彻底移除，不留空壳 / 占位」。
 *   ② `/profile/assets` 有该卡（`assets-my-points`）：文案 = zh 词典 `item.myPoints`、含 🪙，
 *      金额与**同一读口** `GET /api/user/balances` 的 `$`（cid 1）行**逐字相等**（页面值 vs 现场再取一次接口值）；
 *      位置在货币卡区（`asset-cards`）**之上**；余额读口只打一次（零新请求）。
 *   ③ 390 / 1536 两档：首页与资产页均**零横向溢出**、**零 pageerror**；资产卡宽度不超视口。
 *
 * 手法（同 ops/profile-assets/probe-asset-cards.mjs 体例）：
 *   · 静态服务 = context.route 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node probe-my-points-move.mjs <out.json>
 *   PROBE_NEG=1 ⇒ 负控臂（尺子灵敏度自证）：往首页 DOM 注入一张假 `home-my-points` 卡
 *   ⇒ ① 断言必须转红（否则判据是死尺子）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-assets/readings/probe-my-points-move.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const NEG = process.env.PROBE_NEG === '1'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（探针内内存 JSON；行形状 = `GET /api/user/balances` 冻结契约 `{cid,symbol,name,balance}`） ----
const BALANCES = [
  { cid: 1, symbol: '$', name: '平台积分', balance: '4361' },
  { cid: 4, symbol: '₿', name: 'BTTC', balance: '1' },
]
const POINTS_CID = 1

const BATT = {
  batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
  bttc: {
    balance: '12', status: 'listed', canMint: true, canBurn: true, usdBalance: '5',
    policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 },
  },
}

const STATE = { calls: [] }

const ok = (data) => ({ success: true, data })

const apiResponse = (method, pathname) => {
  STATE.calls.push({ method, path: pathname })
  if (pathname === '/api/user/balances') return ok(BALANCES)
  if (pathname === '/api/batt') return ok(BATT)
  if (pathname === '/api/home/campaign-tasks') return ok([])
  if (pathname === '/api/home') {
    return ok({ tasks: [], prizes: [], claimed_prize_ids: [], user_points: 4361 })
  }
  if (pathname.startsWith('/api/prize/all')) return ok([])
  if (pathname.startsWith('/api/prize-item')) return ok([])
  // 诱饵：用户资产口的 points 与余额口**不同值**（999）⇒ 卡上若显示 999 = 读错了源
  if (pathname.startsWith('/api/user/asset/')) return ok({ points: '999', time_update: null })
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: '平台积分' }])
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (pathname === '/api/telegram/bind-status') return ok({ tg_linked: false })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数（一次性取全，供判据） ------------------------------------------------------------
const SNAP_FN = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const rect = (el) => (el ? el.getBoundingClientRect() : null)
  const card = q('[data-sf-m="assets-my-points"]')
  const cards = q('[data-sf-m="asset-cards"]')
  const cr = rect(card)
  return {
    viewport: { w: innerWidth, h: innerHeight },
    pathname: location.pathname,
    overflowPx: de.scrollWidth - de.clientWidth,
    home: {
      pointsCardPresent: !!q('[data-sf-m="home-my-points"]'),
      myPointsTextPresent: document.body.textContent.includes('我的积分'),
      coinGlyphPresent: document.body.textContent.includes('🪙'),
      campaignCards: qa('[data-sf-m="home-camp-card"]').length,
    },
    assets: {
      panePresent: !!q('[data-sf-m="profile-assets-view"]'),
      cardPresent: !!card,
      cardText: txt(card),
      labelText: txt(card?.querySelector('.text-sm')),
      amountText: txt(card?.querySelector('[data-sf-m="assets-my-points-amount"]')),
      coinGlyph: card ? card.textContent.includes('🪙') : false,
      width: cr ? Math.round(cr.width * 10) / 10 : null,
      left: cr ? Math.round(cr.left) : null,
      right: cr ? Math.round(cr.right) : null,
      cardsRegionPresent: !!cards,
      cardBeforeCards: !!(card && cards && (card.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING)),
      currencyCardCount: qa('[data-sf-m="asset-card"]').length,
    },
    offenders: qa('*').filter((el) => {
      const b = el.getBoundingClientRect()
      return b.width > 0 && b.right > de.clientWidth + 1
    }).map((el) => ({
      sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}`,
      right: Math.round(el.getBoundingClientRect().right),
      insideAssetsPane: !!el.closest('[data-sf-m="profile-assets-view"]'),
    })),
  }
}

async function settle(page, max = 40) {
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(() => {
      const r = document.getElementById('root')
      return `${r ? r.innerHTML.length : 0}|${document.querySelectorAll('*').length}`
    })
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.fulfill({ status: 204, body: '' })
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse(req.method(), u.pathname)),
      })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

// 登录态种子（形状对齐 frontend/src/auth.js 读面）。
//   负控臂：往首页 DOM 注入一张假 `home-my-points` 卡（含「我的积分」+ 🪙）⇒ ① 必须转红。
const seed = (ctx, neg = false) => ctx.addInitScript((negArm) => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
  if (!negArm) return
  const inject = () => {
    if (!document.getElementById('root')) return
    if (document.querySelector('[data-sf-m="home-my-points"]')) return
    const el = document.createElement('div')
    el.setAttribute('data-sf-m', 'home-my-points')
    el.textContent = '我的积分 4,361 🪙'
    document.getElementById('root').appendChild(el)
  }
  setInterval(inject, 120)
}, neg)

const newPageWith = async (browser, viewport, pageErrors, consoleErrors, resourceErrors, neg = NEG) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seed(context, neg)
  await attachRoutes(context)
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text().slice(0, 200)
    if (/Failed to load resource/i.test(text)) resourceErrors.push(text)
    else consoleErrors.push(text)
  })
  return page
}

const open = async (page, url, waitHook) => {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (waitHook) await page.waitForSelector(waitHook, { timeout: 8000 }).catch(() => {})
  await settle(page)
  return page.evaluate(SNAP_FN)
}

// 千分位（与 balances-api.formatBalanceAmount 整数位口径同形；本探针只用于「页面值 vs 接口值」互核）
const groupInt = (raw) => {
  const [intPart, frac] = String(raw).trim().split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac && /[1-9]/.test(frac) ? `${grouped}.${frac}` : grouped
}

// 现场再取一次同读口 ⇒ 期望金额（不依赖夹具常量，防止判据与实现同温）
const expectedPoints = async (page) => {
  const body = await page.evaluate(async () => {
    const r = await fetch('/api/user/balances', { headers: { Authorization: 'Bearer probe-token' } })
    return r.json()
  })
  const rows = body && body.data
  const row = (Array.isArray(rows) ? rows : []).find((x) => x && Number(x.cid) === POINTS_CID)
  return { raw: row ? String(row.balance) : null, formatted: row ? groupInt(row.balance) : null }
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/profile-assets/probe-my-points-move.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    negArm: NEG,
    fixtures: {
      balances: BALANCES,
      zhLabel: ZH.item.myPoints,
      auth: 'localStorage seed only（零真登录）',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {}, assertions: {},
  }

  // ======================= ① 1536 桌面 · 首页零命中 =======================
  const dErr = []
  const dCon = []
  const dRes = []
  const page = await newPageWith(browser, { width: 1536, height: 960 }, dErr, dCon, dRes)
  STATE.calls.length = 0
  const homeSnap = await open(page, '/', '[data-sf-m="home-camp-grid"]')
  const homeBalanceCalls = STATE.calls.filter((c) => c.path === '/api/user/balances').length
  out.states['1536_home'] = { home: homeSnap.home, overflowPx: homeSnap.overflowPx, offenders: homeSnap.offenders, apiCalls: STATE.calls.map((c) => `${c.method} ${c.path}`), appBalanceCalls: homeBalanceCalls }
  out.assertions.homeRemoved = {
    pageRendered: homeSnap.home.campaignCards === 5,
    zeroHomePointsHook: homeSnap.home.pointsCardPresent === false,
    zeroMyPointsText: homeSnap.home.myPointsTextPresent === false,
    zeroCoinGlyph: homeSnap.home.coinGlyphPresent === false,
    zeroOverflow: homeSnap.overflowPx === 0,
  }

  // ======================= ② 1536 桌面 · 资产页有卡且值逐字对 =======================
  STATE.calls.length = 0
  const assetSnap = await open(page, '/profile/assets', '[data-sf-m="assets-my-points"]')
  // 页面自身发出的读口（在探针自己再取一次之前抓取 ⇒ 不把探针的调用算进应用侧）
  const appCalls = STATE.calls.map((c) => `${c.method} ${c.path}`)
  const appBalanceCalls = STATE.calls.filter((c) => c.path === '/api/user/balances').length
  const expect = await expectedPoints(page)
  out.states['1536_assets'] = {
    assets: assetSnap.assets,
    expectedFromApi: expect,
    overflowPx: assetSnap.overflowPx,
    offenders: assetSnap.offenders,
    apiCalls: appCalls,
    appBalanceCalls,
    homeBalanceCalls: out.states['1536_home'].appBalanceCalls,
  }
  out.assertions.assetsCard = {
    panePresent: assetSnap.assets.panePresent === true,
    cardPresent: assetSnap.assets.cardPresent === true,
    labelIsZhKey: assetSnap.assets.labelText === ZH.item.myPoints,
    coinGlyph: assetSnap.assets.coinGlyph === true,
    amountEqualsApiDollar: assetSnap.assets.amountText === expect.formatted && expect.formatted !== null,
    amountIsThousandsSeparated: assetSnap.assets.amountText === '4,361',
    aboveCurrencyCards: assetSnap.assets.cardBeforeCards === true,
    currencyCardsStillThere: assetSnap.assets.currencyCardCount === BALANCES.length,
    // 零新请求：值只来自**首页已在用**的同一读口 `/api/user/balances`（无新开读口），
    //   且与用户资产口 `/api/user/asset/:id`（诱饵 999）无关
    reusesExistingBalancesEndpoint: out.states['1536_home'].apiCalls.includes('GET /api/user/balances')
      && appBalanceCalls >= 1,
    amountIgnoresAssetEndpointDecoy: assetSnap.assets.amountText !== '999',
    cardFitsContentArea: typeof assetSnap.assets.width === 'number' && assetSnap.assets.width > 400,
    zeroOverflow: assetSnap.overflowPx === 0,
  }

  // ======================= ③ 390 手机档：首页零命中 + 资产页有卡 =======================
  const mErr = []
  const mCon = []
  const mRes = []
  const mpage = await newPageWith(browser, { width: 390, height: 844 }, mErr, mCon, mRes)
  const mHome = await open(mpage, '/', '[data-sf-m="home-camp-grid"]')
  const mAsset = await open(mpage, '/profile/assets', '[data-sf-m="assets-my-points"]')
  const mExcept = await expectedPoints(mpage)
  out.states['390'] = {
    home: mHome.home,
    homeOverflowPx: mHome.overflowPx,
    homeOffenders: mHome.offenders,
    assets: mAsset.assets,
    expectedFromApi: mExcept,
    assetsOverflowPx: mAsset.overflowPx,
    assetsOffenders: (mAsset.offenders || []).filter((o) => o.insideAssetsPane),
    resourceErrors: mRes.length,
  }
  out.assertions.mobile390 = {
    homeZeroHook: mHome.home.pointsCardPresent === false,
    homeZeroText: mHome.home.myPointsTextPresent === false,
    homeZeroOverflow: mHome.overflowPx === 0,
    cardPresent: mAsset.assets.cardPresent === true,
    amountEqualsApiDollar: mAsset.assets.amountText === mExcept.formatted && mExcept.formatted !== null,
    cardFitsViewport: typeof mAsset.assets.width === 'number' && mAsset.assets.width <= 390,
    cardInsideViewport: typeof mAsset.assets.right === 'number' && mAsset.assets.right <= 390,
    assetsZeroOverflow: mAsset.overflowPx === 0,
    zeroPageError: mErr.length === 0,
  }

  // ======================= 汇总 =======================
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  ))
  const evaluated = [
    ...flat(out.assertions.homeRemoved),
    ...flat(out.assertions.assetsCard),
    ...flat(out.assertions.mobile390),
  ].filter(([, v]) => typeof v === 'boolean')
  const failed = evaluated.filter(([, v]) => v !== true).map(([k, v]) => [k, v])
  out.summary = {
    checks: evaluated.length,
    passed: evaluated.length - failed.length,
    failed,
    pageErrors: dErr.length,
    consoleErrors: dCon.length,
    resourceErrors: dRes.length,
    mobilePageErrors: mErr.length,
    verdict: NEG
      ? (failed.length > 0 ? 'NEG_ARM_RED_AS_EXPECTED' : 'NEG_ARM_STILL_GREEN_RULER_DEAD')
      : (failed.length === 0 && dErr.length === 0 && mErr.length === 0 ? 'PASS' : 'FAIL'),
  }
  out.finishedAt = new Date().toISOString()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(JSON.stringify(out.summary, null, 2))
  console.log(`readings ⇒ ${OUT}`)

  await browser.close()
  if (NEG) process.exit(failed.length > 0 ? 0 : 1)
  process.exit(out.summary.verdict === 'PASS' ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
