/**
 * Header 余额行可点 + `/profile/assets` 币种卡片探针（Kevin 2026-10-21 需求①②）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① Header 用户下拉里**每一行余额都是链接** `<a href="…/profile/assets">`（带语言前缀）、整行可点
 *      （行高 ≥ 24px + hover 底色变化 + 原生可聚焦）；点一行真跳到 `/profile/assets`；
 *      已在 `/profile/assets` 时这些行仍带 href（「已在此页仍可跳」）。
 *   ② `/profile/assets` 顶部按 `GET /api/user/balances` 渲染**每种货币一张卡**（mock `$4361` / `₿1` / `€100`
 *      ⇒ 恰 3 张），逐张核 符号 / 千分位金额 / 货币名，且顺序沿用后端。
 *   ③ 铸造 / 分解仍在同一页（`bttc-asset` 面板与两个按钮在场且可点）。
 *   ④ 390 单列 / 1536 多列（按 `gridTemplateColumns` 真实轨道数数，不按类名）；零横向溢出、零 pageerror。
 *   ⑤ 取数失败臂：`/api/user/balances` 500 ⇒ 内联错误 + 【重试】（不白屏）；恢复 200 后点【重试】⇒ 3 张卡回来。
 *
 * 手法（同 ops/profile-assets/probe-profile-assets.mjs 体例）：
 *   · 静态服务 = context.route 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node probe-asset-cards.mjs <out.json>
 *   PROBE_NEG=1 ⇒ 负控臂（尺子灵敏度自证）：把余额行换回 `<li>` 纯文本、把卡区渲成单卡
 *   ⇒ ①/② 断言必须转红（否则判据是死尺子）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-assets/readings/probe-asset-cards.json')
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
  { cid: 9, symbol: '€', name: 'Euro', balance: '100' },
]
// 逐张期望（符号 / 千分位金额 / 货币名）—— 顺序沿用后端（cid 升序、`$` 首位）
const EXPECT_CARDS = [
  { symbol: '$', amount: '4,361', name: '平台积分' },
  { symbol: '₿', amount: '1', name: 'BTTC' },
  { symbol: '€', amount: '100', name: 'Euro' },
]

const BATT = {
  batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
  bttc: {
    balance: '12', status: 'listed', canMint: true, canBurn: true, usdBalance: '5',
    policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 },
  },
}

const STATE = {
  balancesStatus: 200,
  calls: [],
}

const apiResponse = (method, pathname) => {
  const ok = (data) => ({ success: true, data })
  const fail = (code) => ({ success: false, error: { code, message: 'probe fixture failure' } })
  if (pathname === '/api/user/balances') {
    STATE.calls.push({ method, path: pathname, status: STATE.balancesStatus })
    if (STATE.balancesStatus !== 200) return fail('PROBE_BALANCES_FAIL')
    return ok(BALANCES)
  }
  if (pathname === '/api/batt') {
    STATE.calls.push({ method, path: pathname })
    return ok(BATT)
  }
  // Header 降级口（余额接口失败时用到；只给 points 单值）
  if (/^\/api\/user\/asset\//.test(pathname)) return ok({ points: '4361', time_update: null })
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: '平台积分' }])
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
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
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null)
  const btnTexts = (root) => (root ? [...root.querySelectorAll('button')].map((b) => ({ text: txt(b), disabled: !!b.disabled })) : [])
  const pane = q('[data-sf-m="profile-assets-view"]')
  const grid = q('[data-sf-m="asset-cards-grid"]')
  const assetRoot = q('[data-sf-m="bttc-asset"]')
  const headerRows = qa('[data-sf-m="header-balance-row"]').map((el) => {
    const r = rect(el)
    return {
      tag: el.tagName.toLowerCase(),
      href: el.getAttribute('href'),
      symbol: el.getAttribute('data-symbol'),
      text: txt(el),
      height: r ? Math.round(r.height * 10) / 10 : null,
      width: r ? Math.round(r.width * 10) / 10 : null,
      tabIndex: el.tabIndex,
      focusable: (() => { el.focus(); return document.activeElement === el })(),
      bg: bg(el),
      insideMenu: !!el.closest('div.absolute'),
    }
  })
  const cards = qa('[data-sf-m="asset-card"]').map((el) => {
    const r = rect(el)
    return {
      symbol: txt(el.querySelector('[data-sf-m="asset-card-symbol"]')),
      amount: txt(el.querySelector('[data-sf-m="asset-card-amount"]')),
      name: txt(el.querySelector('[data-sf-m="asset-card-name"]')),
      dataSymbol: el.getAttribute('data-symbol'),
      dataName: el.getAttribute('data-name'),
      width: r ? Math.round(r.width * 10) / 10 : null,
    }
  })
  const cw = de.clientWidth
  const offenders = [...document.querySelectorAll('*')].filter((el) => {
    const b = el.getBoundingClientRect()
    return b.width > 0 && b.right > cw + 1
  }).map((el) => ({
    sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}`,
    right: Math.round(el.getBoundingClientRect().right),
    insideAssetsPane: !!el.closest('[data-sf-m="profile-assets-view"]'),
  }))
  return {
    viewport: { w: innerWidth, h: innerHeight },
    pathname: location.pathname,
    overflowPx: de.scrollWidth - cw,
    offenders,
    header: {
      menuOpen: !!q('[data-sf-m="header-balances"]'),
      rows: headerRows,
    },
    assets: {
      panePresent: !!pane,
      cardsPresent: !!grid,
      cardCount: cards.length,
      cards,
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean) : [],
      panelPresent: !!assetRoot,
      panelText: txt(assetRoot),
      buttons: btnTexts(assetRoot),
      errorPresent: !!q('[data-sf-m="asset-cards-error"]'),
      errorText: txt(q('[data-sf-m="asset-cards-error"]')),
      retryPresent: !!q('[data-sf-m="asset-cards-retry"]'),
      pageErrorTitle: txt(q('h1')),
    },
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
      const body = apiResponse(req.method(), u.pathname)
      const status = STATE.balancesStatus !== 200 && u.pathname === '/api/user/balances' ? 500 : 200
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

// 登录态种子（形状对齐 frontend/src/auth.js 读面）。负控臂：把余额行换回纯文本 `<li>`、
//   卡区只渲一张 —— 若探针仍全绿 ⇒ 判据对本次改动不敏感（死尺子）。
const seedAuth = (ctx, neg = false) => ctx.addInitScript((negArm) => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
  if (!negArm) return
  const inject = () => {
    document.querySelectorAll('[data-sf-m="header-balance-row"]').forEach((el) => {
      if (el.tagName === 'LI') return
      const li = document.createElement('li')
      li.setAttribute('data-sf-m', 'header-balance-row')
      li.setAttribute('data-symbol', el.getAttribute('data-symbol') || '')
      li.textContent = el.textContent
      el.replaceWith(li)
    })
    const grid = document.querySelector('[data-sf-m="asset-cards-grid"]')
    if (grid && grid.children.length > 1) {
      while (grid.children.length > 1) grid.removeChild(grid.lastElementChild)
    }
  }
  setInterval(inject, 120)
}, neg)

const newPageWith = async (browser, viewport, pageErrors, consoleErrors, resourceErrors, neg = NEG) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seedAuth(context, neg)
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

const openUserMenu = async (page) => {
  // 先把鼠标挪开：鼠标停在触发器的同一点时 `page.hover` 不产生新的 mouseover ⇒ 菜单不会展开
  await page.mouse.move(2, 2)
  await settle(page, 3)
  await page.hover('[data-sf-m="header-user-menu"]')
  await page.waitForSelector('[data-sf-m="header-balances"]', { timeout: 5000 }).catch(() => {})
  await settle(page)
}

const sameCards = (cards, expected) => cards.length === expected.length && cards.every((card, i) => (
  card.symbol === expected[i].symbol && card.amount === expected[i].amount && card.name === expected[i].name
))

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const pageErrors = []
  const consoleErrors = []
  const resourceErrors = []
  const errPageErrors = []

  const out = {
    probe: 'ops/profile-assets/probe-asset-cards.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: {
      balances: BALANCES,
      expectedCards: EXPECT_CARDS,
      auth: 'localStorage seed only（零真登录）',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {}, assertions: {}, pageErrors, consoleErrors, resourceErrors, errorArmPageErrors: errPageErrors,
  }

  // ======================= 1536 桌面档：Header 余额行 + 资产卡 =======================
  const page = await newPageWith(browser, { width: 1536, height: 960 }, pageErrors, consoleErrors, resourceErrors)

  STATE.calls.length = 0
  await open(page, '/')
  // 展开态读数只作归档：下拉的 110px 横向溢出是 HoverMenu 容器（`left-0` 锚在右缘触发器下）的
  //   **存量定位缺陷**（仓内既有探针已归因）⇒ 零溢出判据取**未展开态**，展开态不判。
  const closedSnap = await page.evaluate(SNAP_FN)
  await openUserMenu(page)
  const headerSnap = await page.evaluate(SNAP_FN)
  // hover 底色真取值：page.hover 走真实鼠标事件（getComputedStyle 直读拿不到「hover 时」的值）
  const rowSel = '[data-sf-m="header-balance-row"]'
  const bgBefore = await page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el).backgroundColor : null
  }, rowSel)
  await page.hover(rowSel).catch(() => {})
  await settle(page, 4)
  const bgAfter = await page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el).backgroundColor : null
  }, rowSel)
  const rows = headerSnap.header.rows
  out.states['1536_header'] = {
    menuOpen: headerSnap.header.menuOpen,
    rows,
    hover: { bgBefore, bgAfter },
    overflowPx: headerSnap.overflowPx,
    overflowClosedPx: closedSnap.overflowPx,
    overflowExpandedAttributed: 'HoverMenu 存量定位缺陷（展开态 left-0 溢出），不判',
    apiCalls: STATE.calls.map((c) => `${c.method} ${c.path}`),
  }
  out.assertions.header = {
    menuOpen: headerSnap.header.menuOpen === true,
    rowsRendered: rows.length === BALANCES.length,
    allRowsAreAnchors: rows.every((r) => r.tag === 'a'),
    allRowsLinkToAssets: rows.every((r) => typeof r.href === 'string' && /\/profile\/assets$/.test(r.href)),
    linksCarryLangPrefixConsistently: rows.every((r) => r.href === rows[0].href),
    rowTextUnchanged: rows.map((r) => r.text).join('|') === EXPECT_CARDS.map((c) => `${c.symbol}${c.amount}`).join('|'),
    rowHeightAtLeast24: rows.every((r) => typeof r.height === 'number' && r.height >= 24),
    rowFullWidthClickable: rows.every((r) => typeof r.width === 'number' && r.width > 120),
    rowsKeyboardFocusable: rows.every((r) => r.focusable === true && r.tabIndex >= 0),
    hoverBackgroundChanges: bgBefore !== bgAfter,
    zeroOverflowClosed: closedSnap.overflowPx === 0,
  }

  // 真点一行 ⇒ 落到 /profile/assets
  await page.click(rowSel).catch(() => {})
  await page.waitForFunction(() => /\/profile\/assets$/.test(location.pathname), { timeout: 5000 }).catch(() => {})
  await settle(page)
  const afterClick = await page.evaluate(SNAP_FN)
  out.states['1536_click'] = { pathname: afterClick.pathname, overflowPx: afterClick.overflowPx }
  out.assertions.rowClick = {
    navigatedToAssets: /\/profile\/assets$/.test(afterClick.pathname),
  }

  // ---- 卡片区（3 张，逐张核符号 / 金额 / 名称）----
  const assetSnap = await open(page, '/profile/assets', '[data-sf-m="asset-card"]')
  const assetCalls = STATE.calls.map((c) => `${c.method} ${c.path}`)
  const mintLabel = ZH.bttcPanel.mintButton
  const burnLabel = ZH.bttcPanel.burnButton
  const btns = assetSnap.assets.buttons
  out.states['1536_assets'] = {
    assets: {
      ...assetSnap.assets,
      buttons: btns,
    },
    overflowPx: assetSnap.overflowPx,
    apiCalls: assetCalls,
  }
  out.assertions.cards = {
    panePresent: assetSnap.assets.panePresent === true,
    gridPresent: assetSnap.assets.cardsPresent === true,
    cardCountIs3: assetSnap.assets.cardCount === 3,
    cardsMatchFixture: sameCards(assetSnap.assets.cards, EXPECT_CARDS),
    orderFollowsBackend: assetSnap.assets.cards.map((c) => c.dataSymbol).join('|') === EXPECT_CARDS.map((c) => c.symbol).join('|'),
    namesFromBackend: assetSnap.assets.cards.map((c) => c.dataName).join('|') === EXPECT_CARDS.map((c) => c.name).join('|'),
    amountThousandsSeparated: assetSnap.assets.cards[0]?.amount === '4,361',
    noErrorBanner: assetSnap.assets.errorPresent === false,
    readsBalances: assetCalls.some((c) => c === 'GET /api/user/balances'),
    zeroOverflow: assetSnap.overflowPx === 0,
  }
  out.assertions.desktopGrid = {
    multiColumn: assetSnap.assets.gridColumns.length >= 2,
    columns: assetSnap.assets.gridColumns.length,
  }
  out.assertions.mintBurn = {
    panelPresent: assetSnap.assets.panelPresent === true,
    mintPresent: btns.some((b) => b.text === mintLabel),
    burnPresent: btns.some((b) => b.text === burnLabel),
    mintEnabled: btns.some((b) => b.text === mintLabel && b.disabled === false),
    burnEnabled: btns.some((b) => b.text === burnLabel && b.disabled === false),
    pageTitle: assetSnap.assets.pageErrorTitle === ZH.profileNav.assets,
  }

  // ---- 已在 /profile/assets：余额行仍带 href（「已在此页仍可跳」）----
  await openUserMenu(page)
  const onPageSnap = await page.evaluate(SNAP_FN)
  const onPageRows = onPageSnap.header.rows
  out.states['1536_on_assets_header'] = { pathname: onPageSnap.pathname, rows: onPageRows }
  out.assertions.samePageStillLinked = {
    onAssetsPage: onPageSnap.pathname === '/profile/assets',
    rowsStillAnchors: onPageRows.length === BALANCES.length
      && onPageRows.every((r) => r.tag === 'a' && /\/profile\/assets$/.test(r.href || '')),
  }
  // 关掉下拉，避免影响后续臂（鼠标移开即收）
  await page.mouse.move(2, 2)
  await settle(page, 3)

  // ======================= 390 手机档 =======================
  const mErrors = []
  const mConsole = []
  const mResource = []
  const mpage = await newPageWith(browser, { width: 390, height: 844 }, mErrors, mConsole, mResource)
  const mAsset = await open(mpage, '/profile/assets', '[data-sf-m="asset-card"]')
  const mAssetOffenders = (mAsset.offenders || []).filter((o) => o.insideAssetsPane)
  out.states['390'] = {
    assets: { ...mAsset.assets, buttons: mAsset.assets.buttons },
    overflowPx: mAsset.overflowPx,
    offenders: mAsset.offenders,
    assetsPaneOffenders: mAssetOffenders,
    resourceErrors: mResource.length,
  }
  out.assertions.mobile390 = {
    cardCountIs3: mAsset.assets.cardCount === 3,
    cardsMatchFixture: sameCards(mAsset.assets.cards, EXPECT_CARDS),
    singleColumn: mAsset.assets.gridColumns.length === 1,
    cardsFitViewport: mAsset.assets.cards.every((c) => typeof c.width === 'number' && c.width <= 390),
    paneNoOffenders: mAssetOffenders.length === 0,
    zeroOverflow: mAsset.overflowPx === 0,
    mintBurnPresent: mAsset.assets.buttons.some((b) => b.text === mintLabel)
      && mAsset.assets.buttons.some((b) => b.text === burnLabel),
    zeroPageError: mErrors.length === 0,
  }

  // ======================= ⑤ 取数失败 ⇒ 内联错误 + 重试 =======================
  const epage = await newPageWith(browser, { width: 1536, height: 960 }, errPageErrors, [], [])
  STATE.balancesStatus = 500
  STATE.calls.length = 0
  const failSnap = await open(epage, '/profile/assets', '[data-sf-m="asset-cards-error"]')
  out.states['fail_arm'] = {
    assets: { errorPresent: failSnap.assets.errorPresent, errorText: failSnap.assets.errorText, retryPresent: failSnap.assets.retryPresent, cardCount: failSnap.assets.cardCount, panelPresent: failSnap.assets.panelPresent },
    apiCalls: STATE.calls.map((c) => `${c.method} ${c.path} ${c.status}`),
  }
  // 恢复 200 ⇒ 点【重试】⇒ 3 张卡回来
  STATE.balancesStatus = 200
  await epage.click('[data-sf-m="asset-cards-retry"]').catch(() => {})
  await epage.waitForSelector('[data-sf-m="asset-card"]', { timeout: 5000 }).catch(() => {})
  await settle(epage)
  const retrySnap = await epage.evaluate(SNAP_FN)
  out.states['retry_arm'] = { assets: { cardCount: retrySnap.assets.cardCount, cards: retrySnap.assets.cards, errorPresent: retrySnap.assets.errorPresent } }
  out.assertions.failureAndRetry = {
    errorBannerShown: failSnap.assets.errorPresent === true,
    retryButtonShown: failSnap.assets.retryPresent === true,
    noBlankPage: failSnap.assets.panePresent === true && failSnap.assets.panelPresent === true,
    noCardsWhileFailing: failSnap.assets.cardCount === 0,
    retryRestoresCards: retrySnap.assets.cardCount === 3 && sameCards(retrySnap.assets.cards, EXPECT_CARDS),
    retryClearsError: retrySnap.assets.errorPresent === false,
    zeroPageErrorInFailArm: errPageErrors.length === 0,
  }

  // ======================= 汇总 =======================
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  ))
  const evaluated = [
    ...flat(out.assertions.header),
    ...flat(out.assertions.rowClick),
    ...flat(out.assertions.samePageStillLinked),
    ...flat(out.assertions.cards),
    ...flat(out.assertions.desktopGrid),
    ...flat(out.assertions.mintBurn),
    ...flat(out.assertions.mobile390),
    ...flat(out.assertions.failureAndRetry),
  ].filter(([, v]) => typeof v === 'boolean')
  const failed = evaluated.filter(([, v]) => v !== true).map(([k, v]) => [k, v])
  out.summary = {
    checks: evaluated.length,
    passed: evaluated.length - failed.length,
    failed,
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
    resourceErrors: resourceErrors.length,
    errorArmPageErrors: errPageErrors.length,
    verdict: NEG
      ? (failed.length > 0 ? 'NEG_ARM_RED_AS_EXPECTED' : 'NEG_ARM_STILL_GREEN_RULER_DEAD')
      : (failed.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0 ? 'PASS' : 'FAIL'),
  }
  out.finishedAt = new Date().toISOString()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(JSON.stringify(out.summary, null, 2))
  console.log(`readings ⇒ ${OUT}`)

  await browser.close()
  const ok = NEG ? out.summary.verdict === 'NEG_ARM_RED_AS_EXPECTED' : out.summary.verdict === 'PASS'
  process.exit(ok ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
