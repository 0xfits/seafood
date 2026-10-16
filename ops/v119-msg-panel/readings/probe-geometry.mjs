#!/usr/bin/env node
/**
 * v1.19 §21 消息面板化（方案 1「就地叠加」）· 浏览器几何 / 行为读数（AC-2 / AC-3 / AC-4 / AC-6-DOM）
 * --------------------------------------------------------------------------------------------
 * 口径（承仓内先例 `frontend/scripts/p4z-b4c-geometry.mjs`）：
 *   · **无 dev server、无静态服务、零后端、零库写**：`page.route` 把 `http://sf.local/**` 映射到
 *     `frontend/dist` 磁盘文件；**`/api/messages/**` 一律由探针内夹具自截**（`page.route` 返回
 *     内存 JSON）⇒ **绝不触碰共用 dev 库**（不起真后端、不 POST `:5555/api/*`、不写 `/api/messages/*`）；
 *     外部 CDN 一律 abort ⇒ 量测环境完全本地、确定性可复现（同一把尺对 `dist-old` 亦可复用）。
 *   · **登录态只走 `localStorage` 种子**（`addInitScript` 写 `user` / `token`），不走真鉴权。
 *   · 动画禁用（`reducedMotion:'reduce'`）+ 稳态采样（连续 2 次读数逐字节相同，间隔 ≥3 帧），
 *     **不用固定 ms 等待**。
 *   · 每态强制 `#root` 有子树（白屏即判负），记录 pageerror / console error。
 * 用法：node probe-geometry.mjs <distDir> <outJson>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// playwright 装在 `frontend/node_modules`（本脚本落在 `ops/` 下 ⇒ 无本地 node_modules）：
// 用 `createRequire` 锚到前端包根解析，避免依赖运行 cwd / NODE_PATH。
const FRONTEND_ROOT = process.env.SF_FRONTEND_ROOT || '/Users/kevin/bistro/seafood/frontend'
const { chromium } = createRequire(path.join(FRONTEND_ROOT, 'package.json'))('playwright')

const DIST = path.resolve(process.argv[2] || '/Users/kevin/bistro/seafood/frontend/dist')
const OUT = path.resolve(process.argv[3] || '/Users/kevin/bistro/seafood/ops/v119-msg-panel/readings/geometry.json')
const ORIGIN = 'http://sf.local'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const VIEW = { width: 1440, height: 900 }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2',
}

// ================= 探针内夹具（★ 唯一数据来源；零库写） =================
const MY_UID = 970213
const UNREAD_TOTAL = 250                                   // > 99 ⇒ 角标必须封顶 `99+`
const CONV_ROWS = [
  { conversation_id: 7, counterpart_uid: 970301, listing_title: 'FIXTURE 商品 A', last_body_preview: 'FIXTURE 预览一', unread_count: 250 },
  { conversation_id: 8, counterpart_uid: 970302, listing_title: 'FIXTURE 商品 B', last_body_preview: 'FIXTURE 预览二', unread_count: 3 },
  { conversation_id: 9, counterpart_uid: 970303, listing_title: 'FIXTURE 商品 C', last_body_preview: 'FIXTURE 预览三', unread_count: 0 },
]
const THREAD_ROWS = [
  { msg_id: 901, from_uid: 970301, body: 'FIXTURE 对方消息一' },
  { msg_id: 902, from_uid: MY_UID, body: 'FIXTURE 我的消息一' },
]
const CONVERSATION = { conversation_id: 7, listing_id: 123, listing_title: 'FIXTURE 商品 A', role: 'buyer', counterpart_uid: 970301 }
const ok = (data) => ({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ success: true, data }) })

const installFixtures = async (context) => {
  await context.route('**/api/messages/**', (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname
    const method = route.request().method()
    if (p === '/api/messages/unread-count') return route.fulfill(ok({ unread_total: UNREAD_TOTAL }))
    if (p === '/api/messages/conversations' && method === 'GET') {
      return route.fulfill(ok({ rows: CONV_ROWS, next_cursor: { before_time: '2026-10-16T08:00:00.000Z', before_id: 9 } }))
    }
    if (p === '/api/messages/conversations' && method === 'POST') {
      return route.fulfill(ok({ conversation_id: 7, listing_id: 123, listing_title: 'FIXTURE 商品 A', created: false }))
    }
    if (/^\/api\/messages\/conversations\/[^/]+\/messages$/.test(p)) {
      if (method === 'POST') return route.fulfill(ok({ msg_id: 903, conversation_id: 7, time_created: '2026-10-16T10:00:00.000Z' }))
      return route.fulfill(ok({ conversation: CONVERSATION, rows: THREAD_ROWS, next_before_msg_id: null }))
    }
    if (/^\/api\/messages\/conversations\/[^/]+\/read$/.test(p)) return route.fulfill(ok({ last_read_msg_id: 902 }))
    return route.fulfill(ok({}))
  })
}

// 登录态种子（**只写 localStorage**，不碰任何服务端面）
const AUTH_INIT = `(() => { try {
  localStorage.setItem('user', JSON.stringify({ uID: ${MY_UID}, uid: ${MY_UID}, token: 'probe-token-zang-v119', access_token: 'probe-token-zang-v119', bio: 'probe' }))
  localStorage.setItem('token', 'probe-token-zang-v119')
} catch (e) {} })()`

const MEASURE = `(() => {
  const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect()
    return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2),
             left: +b.left.toFixed(2), right: +b.right.toFixed(2), top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2) } }
  const Q = (s) => document.querySelector(s)
  const QA = (s) => Array.from(document.querySelectorAll(s))
  const T = (el) => (el ? String(el.textContent || '').replace(/\\s+/g, ' ').trim() : null)
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false
    const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
  const panel = Q('[data-sf-m="messages-panel"]')
  const fm = Q('[data-sf-m="floatmenu"]')
  const pr = R(panel); const fr = R(fm)
  const fmVisible = vis(fm); const panelVisible = vis(panel)
  let intersect = 0, gap = null
  if (panelVisible && fmVisible && pr && fr) {
    const iw = Math.max(0, Math.min(pr.right, fr.right) - Math.max(pr.left, fr.left))
    const ih = Math.max(0, Math.min(pr.bottom, fr.bottom) - Math.max(pr.top, fr.top))
    intersect = +(iw * ih).toFixed(3)
    gap = +(fr.left - pr.right).toFixed(2)
  }
  const rc = R(Q('[data-sf-region="content"]'))
  const closeBtn = Q('[data-sf-m="messages-panel-close"]')
  const back = Q('[data-sf-m="messages-back"]')
  const sendBtn = Q('[data-sf-m="messages-send-btn"]')
  const input = Q('[data-sf-m="messages-input"]')
  const body = Q('.sf-mp-body')
  const listCol = Q('[data-sf-m="messages-panel-list"]')
  const threadCol = Q('[data-sf-m="messages-panel-thread"]')
  const docEl = { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
                  scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight }
  const convRows = QA('[data-sf-m="messages-conversation-item"]')
  const badges = QA('[data-sf-m="messages-conversation-unread"]')
  const mine = QA('[data-sf-m="messages-msg-mine"]')
  const theirs = QA('[data-sf-m="messages-msg-theirs"]')
  const readOnly = (el) => { const b = R(el); return b ? { w: b.w, h: b.h } : null }
  return JSON.stringify({
    url: location.pathname + location.search,
    pathname: location.pathname,
    search: location.search,
    historyLength: history.length,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    docEl,
    overflowPx: docEl.scrollWidth - docEl.clientWidth,
    scrollY: window.scrollY,
    rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : -1,
    regions: QA('[data-sf-region]').map((e) => e.getAttribute('data-sf-region')),
    shellClass: (Q('[data-sf-shell="app"]') || {}).className || null,
    panelPresent: !!panel,
    panelVisible,
    panel: pr,
    panelBodyClass: body ? body.className : null,
    panelTitleText: T(Q('.sf-mp-head h2')),
    panelAriaLabel: panel ? panel.getAttribute('aria-label') : null,
    fm: fr,
    fmVisible,
    fmDisplay: fm ? getComputedStyle(fm).display : null,
    fmUnreadBadgeText: T(Q('[data-sf-m="floatmenu-unread-badge"]')),
    tabUnreadBadgeText: T(Q('[data-sf-m="tabbar-unread-badge"]')),
    intersectArea: intersect,
    gapToFloatMenu: gap,
    content: rc,
    contentRightVsPanelLeft: (rc && pr) ? +(rc.right - pr.left).toFixed(2) : null,
    listCol: R(listCol),
    listColDisplay: listCol ? getComputedStyle(listCol).display : null,
    threadCol: R(threadCol),
    threadColDisplay: threadCol ? getComputedStyle(threadCol).display : null,
    closeBtn: R(closeBtn),
    closeBtnAria: closeBtn ? closeBtn.getAttribute('aria-label') : null,
    backLink: R(back),
    backDisplay: back ? getComputedStyle(back).display : null,
    backText: T(back),
    sendBtn: R(sendBtn),
    sendBtnText: T(sendBtn),
    sendBtnDisabled: sendBtn ? sendBtn.disabled : null,
    inputPlaceholder: input ? input.getAttribute('placeholder') : null,
    hookSet: QA('[data-sf-m^="messages-"]').map((e) => e.getAttribute('data-sf-m')).sort(),
    placeholderHooks: QA('[data-sf-m="messages-x-placeholder"]').length,
    legacyPageHook: QA('[data-sf-m="messages-page"]').length,
    elementCount: QA('*').length,
    theme: document.documentElement.getAttribute('data-theme'),
    // ---- 内容面渲染读数（列表行 / 气泡 / 99+ 角标 / 文案） ----
    convRowCount: convRows.length,
    convRows: convRows.map((el) => ({
      peer: T(el.querySelector('.sf-msg-conv-peer')),
      title: T(el.querySelector('.sf-msg-conv-title')),
      preview: T(el.querySelector('.sf-msg-conv-preview')),
      href: el.getAttribute('href'),
      rect: readOnly(el),
    })),
    badgeCount: badges.length,
    badges: badges.map((el) => ({ text: T(el), aria: el.getAttribute('aria-label'), rect: readOnly(el) })),
    mineCount: mine.length, mineTexts: mine.map(T),
    theirsCount: theirs.length, theirsTexts: theirs.map(T),
    aboutText: T(Q('[data-sf-m="messages-about"]')),
    listEmptyText: T(Q('[data-sf-m="messages-list-empty"]')),
    detailEmptyText: T(Q('[data-sf-m="messages-detail-empty"]')),
    loadMoreCount: QA('[data-sf-m="messages-load-more"]').length,
  })
})()`

const main = async () => {
  const evidence = {
    startedAt: new Date().toISOString(), dist: DIST, chrome: CHROME,
    zeroDbWrite: true,
    fixtures: { authSource: 'localStorage only', apiSource: 'page.route in-probe JSON (no backend)', unreadTotal: UNREAD_TOTAL, convRows: CONV_ROWS.length, myUid: MY_UID },
    states: {}, notes: [],
  }
  const browser = await chromium.launch({ executablePath: CHROME })
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await context.addInitScript(AUTH_INIT)
  const blocked = new Set()
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) { blocked.add(url.origin); return route.abort() }
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ path: file, contentType: MIME[path.extname(file)] || 'application/octet-stream' })
  })
  // ★ 夹具路由在兜底路由**之后**注册 ⇒ 优先级更高（Playwright 后注册者先匹配）。
  await installFixtures(context)
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(String(m.text()).slice(0, 300)) })

  const FRAMES = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))))

  const stable = async (label) => {
    let prev = null
    for (let i = 0; i < 40; i += 1) {
      const cur = await page.evaluate(MEASURE)
      if (prev && prev === cur) return JSON.parse(cur)
      prev = cur
      await FRAMES()
    }
    throw new Error(`unstable state: ${label}`)
  }

  const gotoSettled = async (url, waitSel) => {
    await page.goto(`${ORIGIN}${url}`, { waitUntil: 'load' })
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, null, { timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    if (waitSel === false) await FRAMES()
    else await page.waitForSelector('[data-sf-m="messages-panel"]', { timeout: 10000 })
    await FRAMES()
  }

  // ================= AC-3 / AC-4 / AC-2 / AC-6-DOM 逐态读数 =================
  const cases = [
    ['1440_home_closed', '/', 1440, 900, false],
    ['1440_exchange_msg_open_list', '/exchange?msg=1', 1440, 900, true],
    ['1440_item_msg_open_thread', '/item/123?msg=1&c=7', 1440, 900, true],
    ['1440_messages_direct', '/messages', 1440, 900, true],
    ['1440_messages_direct_thread', '/messages?c=7', 1440, 900, true],
    ['1199_exchange_msg_open_list', '/exchange?msg=1', 1199, 900, true],
    ['1024_exchange_msg_open_list', '/exchange?msg=1', 1024, 900, true],
    ['768_exchange_msg_open_list', '/exchange?msg=1', 768, 900, true],
    ['767_messages_msg_list', '/messages?msg=1', 767, 900, true],
    ['390_messages_msg_list', '/messages?msg=1', 390, 844, true],
    ['390_messages_msg_thread', '/messages?msg=1&c=7', 390, 844, true],
    ['375_messages_msg_list', '/messages?msg=1', 375, 812, true],
    ['320_messages_msg_thread', '/messages?msg=1&c=7', 320, 640, true],
  ]
  for (const [label, url, w, h, expectPanel] of cases) {
    await page.setViewportSize({ width: w, height: h })
    await gotoSettled(url, expectPanel ? '[data-sf-m="messages-panel"]' : false)
    const read = await stable(label)
    read.expectPanel = expectPanel
    if (!expectPanel) {
      // 反事实必要性：未打开态必须无面板钩子
      read.assert_no_panel = read.panelPresent === false && read.hookSet.length === 0
    } else if (w >= 768) {
      // ≥768 档：双栏 + 零横向溢出 + 面板↔浮菜单相离 + 正文右缘 ≤ 面板左缘
      read.assertions = {
        panelWidth: read.panel ? read.panel.w : null,
        panelRightOffset: read.panel ? +(read.viewport.w - read.panel.right).toFixed(2) : null,
        leftColW: read.listCol ? read.listCol.w : null,
        rightColW: read.threadCol ? read.threadCol.w : null,
        leftPlusRight: (read.listCol && read.threadCol) ? +(read.listCol.w + read.threadCol.w).toFixed(2) : null,
        leftPlusRightEqPanelW: (read.listCol && read.threadCol && read.panel)
          ? Math.abs((read.listCol.w + read.threadCol.w) - read.panel.w) < 1.5 : null,
        gapToFloatMenu: read.gapToFloatMenu,
        intersectZero: read.intersectArea === 0,
        zeroHorizontalOverflow: read.overflowPx <= 0,
        contentRightLePanelLeft: read.contentRightVsPanelLeft != null && read.contentRightVsPanelLeft <= 0,
      }
    } else {
      // ≤767 档：**面板全屏**（100vw × 100vh）+ **让位量 = 0**（⇒ 正文在面板之下属预期，不适用
      // 「正文右缘 ≤ 面板左缘」判据）；判据 = 面板尺寸 = 视口 + 零横向溢出 + 单栏两态（另一列 display:none）
      read.assertions = {
        panelWidth: read.panel ? read.panel.w : null,
        panelHeight: read.panel ? read.panel.h : null,
        fullScreen: !!(read.panel && read.panel.w === read.viewport.w && read.panel.h === read.viewport.h),
        zeroHorizontalOverflow: read.overflowPx <= 0,
        singleColumn: (read.listColDisplay === 'none') !== (read.threadColDisplay === 'none'),
        fullScreenOverlayExpected: !!(read.panel && read.panel.w === read.viewport.w),
      }
      read.note = '≤767 档 `contentRightVsPanelLeft` 不适用（面板全屏覆盖、让位量 0）⇒ 判据改用 `fullScreen` + `singleColumn`'
    }
    evidence.states[label] = read
  }

  // ================= AC-4：≤767 触控目标 ≥44（关闭键 / 返回 / 发送） =================
  const tap = (label, key) => {
    const s = evidence.states[label]
    const r = key === 'close' ? s.closeBtn : (key === 'back' ? s.backLink : s.sendBtn)
    return { state: label, key, w: r ? r.w : null, h: r ? r.h : null, visible: !!(r && r.w > 0 && r.h > 0), pass: !!(r && r.w > 0 && r.h > 0 && r.h >= 44) }
  }
  evidence.touchTargets = [
    tap('390_messages_msg_thread', 'close'),
    tap('390_messages_msg_thread', 'back'),
    tap('390_messages_msg_thread', 'send'),
    tap('375_messages_msg_list', 'close'),
    tap('320_messages_msg_thread', 'close'),
    tap('320_messages_msg_thread', 'back'),
    tap('320_messages_msg_thread', 'send'),
    tap('767_messages_msg_list', 'close'),
  ]

  // ================= AC-6-DOM：日 / 夜两档面板 DOM 形状逐项相等 =================
  const shapeOf = () => page.evaluate(`(() => {
    const SHAPE = ['href','id','role','type','aria-current','aria-label','data-sf-region','data-sf-nav','data-sf-shell','data-sf-m','data-sf-phase','data-sf-fm']
    return Array.from(document.querySelectorAll('[data-sf-m="messages-panel"] *')).map((el) => {
      const attrs = SHAPE.map((a) => { const v = el.getAttribute(a); return v === null ? null : a + '=' + v }).filter(Boolean)
      return el.tagName + '[' + attrs.join('|') + ']'
    }).join('>')
  })()`)
  const themeRead = async (theme) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${ORIGIN}/messages?c=7`, { waitUntil: 'load' })
    await page.evaluate((t) => window.localStorage.setItem('theme', t), theme)
    await page.goto(`${ORIGIN}/messages?c=7`, { waitUntil: 'load' })
    await page.waitForSelector('[data-sf-m="messages-panel"]', { timeout: 10000 })
    await page.evaluate(() => document.fonts.ready)
    await FRAMES()
    return { shape: await shapeOf(), count: await page.evaluate(() => document.querySelectorAll('[data-sf-m="messages-panel"] *').length), attr: await page.evaluate(() => document.documentElement.getAttribute('data-theme')) }
  }
  const day = await themeRead('light')
  const night = await themeRead('dark')
  evidence.themeShape = {
    dayAttr: day.attr, nightAttr: night.attr,
    dayCount: day.count, nightCount: night.count,
    shapeEqual: day.shape === night.shape,
    shapeLen: day.shape.length,
  }

  // ================= AC-2：不换页 + 原地（宿主不重挂 + scrollY 不变） =================
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, null, { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  const before = await page.evaluate(`(() => {
    window.scrollTo(0, 400)
    window.__hostEl = document.querySelector('[data-sf-region="content"] > *')
    window.__hostCount = document.querySelectorAll('[data-sf-region="content"] *').length
    return { pathname: location.pathname, search: location.search, scrollY: window.scrollY, historyLength: history.length, hostTag: window.__hostEl ? window.__hostEl.tagName : null, hostCount: window.__hostCount }
  })()`)
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))))
  const before2 = await page.evaluate(() => ({ scrollY: window.scrollY }))
  await page.click('[data-sf-fm="messages"]')
  await page.waitForSelector('[data-sf-m="messages-panel"]', { timeout: 10000 })
  await FRAMES()
  const after = await page.evaluate(`(() => ({
    pathname: location.pathname, search: location.search, scrollY: window.scrollY, historyLength: history.length,
    hostSameNode: document.querySelector('[data-sf-region="content"] > *') === window.__hostEl,
    hostCount: document.querySelectorAll('[data-sf-region="content"] *').length,
    panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]'),
    shellClass: document.querySelector('[data-sf-shell="app"]').className,
    panelRect: (() => { const b = document.querySelector('[data-sf-m="messages-panel"]').getBoundingClientRect(); return { x: +b.x.toFixed(2), w: +b.width.toFixed(2) } })(),
  }))()`)
  // ① 浏览器后退键天然关面板（参数进 history）
  await page.goBack()
  await FRAMES()
  const afterBack = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, scrollY: window.scrollY, panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]') }))
  // ② 重新打开（同一次点击路径）后按「×」关闭：`replace` 保当前页、不新增 history、面板消失、宿主节点同一性保持
  await page.click('[data-sf-fm="messages"]')
  await page.waitForSelector('[data-sf-m="messages-panel"]', { timeout: 10000 })
  await page.click('[data-sf-m="messages-panel-close"]')
  await FRAMES()
  const afterClose = await page.evaluate(() => ({
    pathname: location.pathname, search: location.search, scrollY: window.scrollY, historyLength: history.length,
    panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]'),
    shellClass: document.querySelector('[data-sf-shell="app"]').className,
    hostSameNode: document.querySelector('[data-sf-region="content"] > *') === window.__hostEl,
  }))
  evidence.ac2 = {
    before, beforeScrollAfterFrame: before2, after, afterBack, afterClose,
    verdict: {
      pathnameUnchanged: before.pathname === after.pathname && after.pathname === '/',
      hostNotRemounted: after.hostSameNode === true && after.hostCount === before.hostCount,
      scrollYUnchanged: before.scrollY === after.scrollY,
    },
  }

  // ================= 附加：直链态「×」⇒ 回首页（口径外延）+ 入口① 底栏就地叠加 =================
  await page.goto(`${ORIGIN}/messages`, { waitUntil: 'load' })
  await page.waitForSelector('[data-sf-m="messages-panel"]', { timeout: 10000 })
  await page.click('[data-sf-m="messages-panel-close"]')
  await FRAMES()
  const directClose = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]') }))

  await page.goto(`${ORIGIN}/exchange`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, null, { timeout: 20000 })
  await page.setViewportSize({ width: 390, height: 844 }) // 底栏档（≤767 才显示 tabbar）
  await page.waitForSelector('[data-sf-region="tabbar"] a[data-sf-nav="messages"]', { state: 'visible', timeout: 10000 })
  const tabBefore = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, href: document.querySelector('[data-sf-region="tabbar"] a[data-sf-nav="messages"]').getAttribute('href') }))
  await page.click('[data-sf-region="tabbar"] a[data-sf-nav="messages"]')
  await FRAMES()
  const tabAfter = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]') }))
  // 修饰键（meta）= 不拦截 ⇒ 退化为直链落点（新标签页由浏览器接管；此处断言「不 preventDefault」= 不改当前页）
  await page.goto(`${ORIGIN}/exchange`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, null, { timeout: 20000 })
  const modBefore = await page.evaluate(() => location.pathname + location.search)
  await page.evaluate(() => document.querySelector('[data-sf-region="tabbar"] a[data-sf-nav="messages"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })))
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))))
  const modAfter = await page.evaluate(() => ({ url: location.pathname + location.search, panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]') }))
  // 悬浮菜单入口②（1440）：同一就地叠加路径
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${ORIGIN}/exchange`, { waitUntil: 'load' })
  await page.waitForSelector('[data-sf-fm="messages"]', { state: 'visible', timeout: 10000 })
  const fmBefore = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, href: document.querySelector('[data-sf-fm="messages"]').getAttribute('href'), badge: (document.querySelector('[data-sf-m="floatmenu-unread-badge"]') || {}).textContent || null }))
  await page.click('[data-sf-fm="messages"]')
  await FRAMES()
  const fmAfter = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]') }))
  evidence.entryWiring = { directClose, tabBefore, tabAfter, modifierBefore: modBefore, modifierAfter: modAfter, floatMenuBefore: fmBefore, floatMenuAfter: fmAfter }

  evidence.blockedExternalOrigins = Array.from(blocked)
  evidence.pageErrors = pageErrors
  evidence.consoleErrors = consoleErrors
  // ================= 判据汇总（AC-2 / AC-3 / AC-4 逐条） =================
  const S = evidence.states
  evidence.verdict = {
    'AC-2 不换页 + 原地': evidence.ac2.verdict,
    'AC-3 桌面几何(1440/1199/1024/768)': {
      1440: S['1440_exchange_msg_open_list'].assertions,
      1199: S['1199_exchange_msg_open_list'].assertions,
      1024: S['1024_exchange_msg_open_list'].assertions,
      768: S['768_exchange_msg_open_list'].assertions,
      panelWidth600at1440: S['1440_exchange_msg_open_list'].assertions.panelWidth === 600,
      rightOffset104at1440: S['1440_exchange_msg_open_list'].assertions.panelRightOffset === 104,
      left240_right360_at1440: S['1440_exchange_msg_open_list'].assertions.leftColW === 240 && S['1440_exchange_msg_open_list'].assertions.rightColW === 360,
      left240_right360_at1199: S['1199_exchange_msg_open_list'].assertions.leftColW === 240 && S['1199_exchange_msg_open_list'].assertions.rightColW === 360,
      left240_right360_at1024: S['1024_exchange_msg_open_list'].assertions.leftColW === 240 && S['1024_exchange_msg_open_list'].assertions.rightColW === 360,
    },
    'AC-4 手机档(≤767)': {
      '767': S['767_messages_msg_list'].assertions,
      '390_list': S['390_messages_msg_list'].assertions,
      '390_thread': S['390_messages_msg_thread'].assertions,
      '375_list': S['375_messages_msg_list'].assertions,
      '320_thread': S['320_messages_msg_thread'].assertions,
      touchTargetsAllPass: evidence.touchTargets.every((t) => t.pass),
    },
    'AC-6 日夜间构（DOM 形状逐项相等）': evidence.themeShape,
    '未打开态零面板钩子': evidence.states['1440_home_closed'].assert_no_panel,
  }
  evidence.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2))
  await browser.close()

  const s = evidence.states
  const pick = (k) => ({ panel: s[k].panel, listCol: s[k].listCol, threadCol: s[k].threadCol, overflowPx: s[k].overflowPx, gap: s[k].gapToFloatMenu, intersect: s[k].intersectArea, assertions: s[k].assertions })
  console.log(JSON.stringify({
    out: OUT,
    '1440': pick('1440_exchange_msg_open_list'),
    '1199': pick('1199_exchange_msg_open_list'),
    '1024': pick('1024_exchange_msg_open_list'),
    '768': pick('768_exchange_msg_open_list'),
    '390_list': pick('390_messages_msg_list'),
    '390_thread': { panel: s['390_messages_msg_thread'].panel, back: s['390_messages_msg_thread'].backLink, send: s['390_messages_msg_thread'].sendBtn, cols: [s['390_messages_msg_thread'].listColDisplay, s['390_messages_msg_thread'].threadColDisplay] },
    '320_thread': { panel: s['320_messages_msg_thread'].panel, back: s['320_messages_msg_thread'].backLink, send: s['320_messages_msg_thread'].sendBtn },
    contents_1440: {
      convRowCount: s['1440_messages_direct'].convRowCount,
      badges: s['1440_messages_direct'].badges,
      rows: s['1440_messages_direct'].convRows,
      panelTitle: s['1440_messages_direct'].panelTitleText,
      closeAria: s['1440_messages_direct'].closeBtnAria,
      detailEmpty: s['1440_messages_direct'].detailEmptyText,
      floatMenuBadge: s['1440_messages_direct'].fmUnreadBadgeText,
    },
    contents_1440_thread: {
      mine: s['1440_messages_direct_thread'].mineTexts, theirs: s['1440_messages_direct_thread'].theirsTexts,
      about: s['1440_messages_direct_thread'].aboutText, placeholder: s['1440_messages_direct_thread'].inputPlaceholder,
      send: s['1440_messages_direct_thread'].sendBtnText, sendDisabled: s['1440_messages_direct_thread'].sendBtnDisabled,
    },
    touchTargets: evidence.touchTargets,
    ac2: evidence.ac2.verdict,
    themeShape: evidence.themeShape,
    entryWiring: evidence.entryWiring,
    pageErrors: pageErrors,
    consoleErrors: consoleErrors,
  }, null, 2))
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exitCode = 1 })
