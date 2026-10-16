/**
 * Neng 独立质检探针 · 几何 + 交互 + 冻结面（v119 消息面板化）
 * 由 Neng（质检员）自写自跑，**不采信实现方探针与其读数**。
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server）
 *   · 登录态 = localStorage 种子（addInitScript）；API 一律 context.route 内自截（零真后端 / 零库写）
 *   · 禁动画 + 稳态采样；只读不写；页面内注入仅用于尺子灵敏度自证（绝不改仓内源码）
 * 用法：QA_DIST=<dist> node probe-geometry-qa.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/v119-msg-panel/qa/geometry-qa.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// ---- 夹具（探针内内存 JSON，绝不触网 / 绝不写库） ------------------------------------------------
const MY_UID = 970213
const CONVS = [
  { conversation_id: 7, counterpart_uid: 970301, listing_title: 'FIXTURE 商品 A', last_body_preview: 'FIXTURE 预览一', unread_count: 250, time_updated: '2026-10-16 10:00:00' },
  { conversation_id: 8, counterpart_uid: 970302, listing_title: 'FIXTURE 商品 B', last_body_preview: 'FIXTURE 预览二', unread_count: 3, time_updated: '2026-10-16 09:00:00' },
  { conversation_id: 9, counterpart_uid: 970303, listing_title: 'FIXTURE 商品 C', last_body_preview: 'FIXTURE 预览三', unread_count: 0, time_updated: '2026-10-16 08:00:00' },
]
const KNOWN = new Set(CONVS.map((c) => c.conversation_id))
const apiResponse = (method, pathname) => {
  const data = (d) => ({ success: true, data: d })
  if (pathname === '/api/messages/unread-count') return data({ unread_total: 250 })
  if (pathname === '/api/messages/conversations' && method === 'GET') return data({ rows: CONVS.map((c) => ({ ...c })), next_cursor: null })
  if (pathname === '/api/messages/conversations' && method === 'POST') return data({ conversation_id: 7, created: false })
  const m = pathname.match(/^\/api\/messages\/conversations\/(\d+)\/messages$/)
  if (m && method === 'GET') {
    const id = Number(m[1])
    if (!KNOWN.has(id)) return { success: false, error: { code: 'MSG_CONVERSATION_NOT_FOUND', i18n_key: 'msg.err.MSG_CONVERSATION_NOT_FOUND' } }
    const conv = CONVS.find((c) => c.conversation_id === id)
    return data({
      conversation: { conversation_id: id, listing_id: 42, listing_title: conv.listing_title, counterpart_uid: conv.counterpart_uid, role: 'buyer' },
      rows: [ { msg_id: 2, from_uid: conv.counterpart_uid, body: 'FIXTURE 对方消息一' }, { msg_id: 1, from_uid: MY_UID, body: 'FIXTURE 我的消息一' } ],
      next_before_msg_id: null,
    })
  }
  if (m && method === 'POST') return data({ msg_id: 3, time_created: '2026-10-16 11:00:00', conversation_id: Number(m[1]) })
  if (/^\/api\/messages\/conversations\/\d+\/read$/.test(pathname)) return data({ last_read_msg_id: 2 })
  if (/^\/api\/telegram\//.test(pathname)) return { success: false, error: { code: 'TG_NOT_CONFIGURED', i18n_key: 'tg.err.TG_NOT_CONFIGURED' } }
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}

// ---- 页内测量器 -------------------------------------------------------------------------------
const MEASURE_FN = `(() => {
  const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x*100)/100, y: Math.round(r.y*100)/100, w: Math.round(r.width*100)/100, h: Math.round(r.height*100)/100, left: Math.round(r.left*100)/100, right: Math.round(r.right*100)/100, top: Math.round(r.top*100)/100, bottom: Math.round(r.bottom*100)/100 } }
  const inter = (a, b) => (!a || !b) ? null : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const vis = (el) => !!el && el.getClientRects().length > 0
  const vrc = (el) => vis(el) ? rc(el) : null
  const css = (el) => (el ? getComputedStyle(el).display : null)
  const panel = document.querySelector('.sf-mp')
  const fm = document.querySelector('.sf-fm')
  const content = document.querySelector('#sf-route-container')
  const list = document.querySelector('[data-sf-m="messages-panel-list"]')
  const thread = document.querySelector('[data-sf-m="messages-panel-thread"]')
  const close = document.querySelector('[data-sf-m="messages-panel-close"]')
  const back = document.querySelector('[data-sf-m="messages-back"]')
  const send = document.querySelector('[data-sf-m="messages-send-btn"]')
  const p = vrc(panel), f = rc(fm), c = rc(content), l = rc(list), t = rc(thread)
  const regions = [...document.querySelectorAll('[data-sf-region]')].map((e) => e.getAttribute('data-sf-region'))
  const uniqRegions = regions.filter((v, i) => regions.indexOf(v) === i)
  return {
    url: location.href, pathname: location.pathname, search: location.search,
    historyLength: history.length, scrollY: window.scrollY,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    docEl: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight },
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panelPresent: !!panel, panelVisible: vis(panel), panel: p,
    panelRightOffset: p ? Math.round((window.innerWidth - p.right) * 100) / 100 : null,
    fm: f, fmDisplay: css(fm), fmVisible: vis(fm),
    gapToFloatMenu: (p && f) ? Math.round((f.left - p.right) * 100) / 100 : null,
    intersectArea: inter(p, f),
    content: c,
    contentRightVsPanelLeft: (c && p) ? Math.round((p.left - c.right) * 100) / 100 : null,
    listCol: l, listColDisplay: css(list), threadCol: t, threadColDisplay: css(thread),
    listPlusThread: (l && t) ? Math.round((l.w + t.w) * 100) / 100 : null,
    shellClass: (document.querySelector('.sf-shell') || {}).className || null,
    shellPaddingRight: (() => { const s = document.querySelector('.sf-shell'); return s ? getComputedStyle(s).paddingRight : null })(),
    closeBtn: vrc(close), backLink: vrc(back), backDisplay: css(back), sendBtn: vrc(send), sendBtnDisabled: send ? send.disabled : null,
    closeAria: close ? close.getAttribute('aria-label') : null,
    inputPlaceholder: (document.querySelector('[data-sf-m="messages-input"]') || {}).placeholder || null,
    regs: uniqRegions, regionCount: regions.length, panelRegionCount: panel ? panel.querySelectorAll('[data-sf-region]').length : null,
    hookSet: [...new Set([...document.querySelectorAll('[data-sf-m]')].map((e) => e.getAttribute('data-sf-m')))].sort(),
    hookCount: document.querySelectorAll('[data-sf-m]').length,
    listEmptyText: (document.querySelector('[data-sf-m="messages-list-empty"]')||{}).textContent || null,
    detailEmptyText: (document.querySelector('[data-sf-m="messages-detail-empty"]')||{}).textContent || null,
    detailEmptyCount: document.querySelectorAll('[data-sf-m="messages-detail-empty"]').length,
    threadStatusText: (document.querySelector('[data-sf-m="messages-thread-status"]')||{}).textContent || null,
    threadStatusPhase: (document.querySelector('[data-sf-m="messages-thread-status"]')||{}).dataset ? document.querySelector('[data-sf-m="messages-thread-status"]').dataset.sfPhase : null,
    aboutText: (document.querySelector('[data-sf-m="messages-about"]')||{}).textContent || null,
    convRowCount: document.querySelectorAll('[data-sf-m="messages-conversation-item"]').length,
    convHrefs: [...document.querySelectorAll('[data-sf-m="messages-conversation-item"]')].map((e) => e.getAttribute('href')),
    mineCount: document.querySelectorAll('[data-sf-m="messages-msg-mine"]').length,
    theirsCount: document.querySelectorAll('[data-sf-m="messages-msg-theirs"]').length,
    badgeTexts: [...document.querySelectorAll('[data-sf-m="messages-conversation-unread"]')].map((e) => e.textContent),
    badgeAria: [...document.querySelectorAll('[data-sf-m="messages-conversation-unread"]')].map((e) => e.getAttribute('aria-label')),
    floatMenuBadge: (document.querySelector('[data-sf-m="floatmenu-unread-badge"]')||{}).textContent || null,
    tabBadge: (document.querySelector('[data-sf-m="tabbar-unread-badge"]')||{}).textContent || null,
    elementCount: document.querySelectorAll('*').length,
    tabHrefs: [...document.querySelectorAll('.sf-tab')].map((e) => e.getAttribute('href')),
    fmItemHrefs: [...document.querySelectorAll('[data-sf-m="floatmenu-item"]')].map((e) => e.getAttribute('href')),
    panelTitleText: (document.querySelector('.sf-mp .sf-panel-title')||{}).textContent || null,
    hostFirstChildTag: (document.getElementById('sf-route-container')?.firstElementChild?.tagName) || null,
    legacyHookCount: document.querySelectorAll('[data-sf-m="messages-page"]').length,
    placeholderHookCount: document.querySelectorAll('[data-sf-m^="messages-x"]').length,
  }
})()`

async function settle(page, max = 80) {
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

async function goto(page, url, opts = {}) {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (opts.expectPanel) {
    try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
    await settle(page)
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
    localStorage.setItem('token', 'qa-token')
  })
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

  const out = {
    probe: 'probe-geometry-qa.mjs (Neng 独立质检 · 自写)',
    startedAt: new Date().toISOString(), dist: DIST, chrome: CHROME,
    fixtures: { auth: 'localStorage only', api: 'context.route in-probe JSON (no backend, zero db write)', unreadTotal: 250, convRows: CONVS.length, myUid: MY_UID, knownConvIds: [...KNOWN] },
    states: {}, rulerSensitivity: {}, interactions: {}, matrix: {}, ac6Runtime: {}, notes: {}, pageErrors, consoleErrors,
  }
  const measure = async (label, url, opts = {}) => {
    await goto(page, url, opts)
    const snap = await page.evaluate(MEASURE_FN)
    out.states[label] = snap
    return snap
  }

  // =========================== 几何：桌面四档 =====================================
  await measure('1440_home_closed', '/')
  const open1440 = await measure('1440_exchange_open_list', '/exchange?msg=1', { expectPanel: true })
  await measure('1440_exchange_open_thread', '/exchange?msg=1&c=7', { expectPanel: true })
  await measure('1440_messages_direct', '/messages', { expectPanel: true })
  await measure('1440_messages_direct_thread', '/messages?c=8', { expectPanel: true })

  // ★ 尺子灵敏度自证 ①：页内注入（只改探针页内样式）把面板宽/右偏移/左栏改掉 ⇒ 判据必须变红
  await goto(page, '/exchange?msg=1', { expectPanel: true })
  await page.evaluate(`(() => { const s = document.createElement('style'); s.id='qa-perturb';
    s.textContent = '.sf-mp{width:555px !important;right:60px !important} .sf-mp-list{flex:0 0 200px !important}'; document.head.appendChild(s) })()`)
  await settle(page)
  const perturbed = await page.evaluate(MEASURE_FN)
  out.rulerSensitivity.perturb = {
    injected: 'page-level <style>: .sf-mp{width:555px;right:60px} .sf-mp-list{flex:0 0 200px}（仅探针页内，仓内源码零改动）',
    panelW: perturbed.panel && perturbed.panel.w, panelRightOffset: perturbed.panelRightOffset,
    listColW: perturbed.listCol && perturbed.listCol.w, threadColW: perturbed.threadCol && perturbed.threadCol.w,
    gapToFloatMenu: perturbed.gapToFloatMenu, intersectArea: perturbed.intersectArea, overflowPx: perturbed.overflowPx, contentRightVsPanelLeft: perturbed.contentRightVsPanelLeft,
  }
  out.rulerSensitivity.rulers = {
    panelWidth_600: { shipped: open1440.panel && open1440.panel.w, perturbed: perturbed.panel && perturbed.panel.w, sensitive: !!(open1440.panel && perturbed.panel && Math.abs(open1440.panel.w - perturbed.panel.w) > 1) },
    rightOffset_104: { shipped: open1440.panelRightOffset, perturbed: perturbed.panelRightOffset, sensitive: Math.abs(open1440.panelRightOffset - perturbed.panelRightOffset) > 1 },
    gap_16: { shipped: open1440.gapToFloatMenu, perturbed: perturbed.gapToFloatMenu, sensitive: open1440.gapToFloatMenu !== perturbed.gapToFloatMenu },
    intersect_0: { shipped: open1440.intersectArea, perturbed: perturbed.intersectArea, sensitive: open1440.intersectArea !== perturbed.intersectArea },
    listCol_240: { shipped: open1440.listCol && open1440.listCol.w, perturbed: perturbed.listCol && perturbed.listCol.w, sensitive: !!(open1440.listCol && perturbed.listCol && Math.abs(open1440.listCol.w - perturbed.listCol.w) > 1) },
    threadCol_360: { shipped: open1440.threadCol && open1440.threadCol.w, perturbed: perturbed.threadCol && perturbed.threadCol.w, sensitive: !!(open1440.threadCol && perturbed.threadCol && Math.abs(open1440.threadCol.w - perturbed.threadCol.w) > 1) },
  }
  await goto(page, '/exchange?msg=1', { expectPanel: true })
  out.rulerSensitivity.afterRestorePanelWidth = (await page.evaluate(MEASURE_FN)).panel.w

  for (const w of [1199, 1024, 768]) {
    await page.setViewportSize({ width: w, height: 900 })
    await measure(`${w}_exchange_open_list`, '/exchange?msg=1', { expectPanel: true })
  }
  // ★ 尺子灵敏度自证 ②：768 档注入越界宽 ⇒ 溢出判据必须变红
  await page.setViewportSize({ width: 768, height: 900 })
  const beforeOverflowArm = await measure('768_overflow_arm_before', '/exchange?msg=1', { expectPanel: true })
  await page.evaluate(`(() => { const s=document.createElement('style'); s.textContent='.sf-mp{width:900px !important;right:0 !important}'; document.head.appendChild(s) })()`)
  await settle(page)
  const overflowArm = await page.evaluate(MEASURE_FN)
  out.rulerSensitivity.overflowRuler = {
    arm: 'page 内注入 .sf-mp{width:900px;right:0} @768（只改探针页内样式）',
    overflowPx_before: beforeOverflowArm.overflowPx, overflowPx_perturbed: overflowArm.overflowPx,
    panelW_before: beforeOverflowArm.panel.w, panelW_perturbed: overflowArm.panel.w,
    intersectArea_perturbed: overflowArm.intersectArea, gap_perturbed: overflowArm.gapToFloatMenu,
    sensitive: overflowArm.overflowPx > 0 || overflowArm.intersectArea > 0,
  }

  // =========================== 几何：手机四宽 =====================================
  await page.setViewportSize({ width: 767, height: 900 })
  await measure('767_messages_msg_list', '/messages?msg=1', { expectPanel: true })
  await measure('767_messages_msg_thread', '/messages?msg=1&c=7', { expectPanel: true })
  for (const w of [390, 375, 320]) {
    await page.setViewportSize({ width: w, height: 844 })
    await measure(`${w}_messages_msg_list`, '/messages?msg=1', { expectPanel: true })
    await measure(`${w}_messages_msg_thread`, '/messages?msg=1&c=7', { expectPanel: true })
  }

  // =========================== AC-6 结构不变式（运行时） ===========================
  await page.setViewportSize({ width: 1440, height: 900 })
  await goto(page, '/')
  out.ac6Runtime.regionsClosed = (await page.evaluate(MEASURE_FN)).regs
  await goto(page, '/exchange?msg=1', { expectPanel: true })
  const openSnap = await page.evaluate(MEASURE_FN)
  out.ac6Runtime.regionsOpen = openSnap.regs
  out.ac6Runtime.panelRegionCountOpen = openSnap.panelRegionCount
  out.ac6Runtime.panelElementCountOpen = await page.evaluate(`document.querySelectorAll('.sf-mp *').length`)
  out.ac6Runtime.panelRegionAttrInPanel = await page.evaluate(`document.querySelectorAll('.sf-mp [data-sf-region]').length`)

  const shapeJuice = `(() => {
    const norm = (v) => String(v == null ? '' : v).replace(/\\s+/g, ' ').trim()
    const pathOf = (el) => { const p = []; let n = el; while (n && n.parentElement) { p.unshift([...n.parentElement.children].indexOf(n)); n = n.parentElement } return p.join('/') }
    const themeBtn = (document.querySelector('svg.lucide-sun, svg.lucide-moon') || {}).closest ? document.querySelector('svg.lucide-sun, svg.lucide-moon').closest('button') : null
    const excluded = new Set()
    if (themeBtn) { excluded.add(themeBtn); for (const el of themeBtn.querySelectorAll('*')) excluded.add(el) }
    const shape = []
    let totalVisible = 0
    for (const el of document.querySelectorAll('*')) {
      if (!el.getClientRects().length) continue
      totalVisible += 1
      if (excluded.has(el)) continue
      const attrs = []
      for (const a of el.attributes) { if (a.name === 'class' || a.name === 'style') continue; attrs.push(a.name + '=' + norm(a.value)) }
      shape.push([el.tagName, norm(el.getAttribute('class')), attrs.sort().join('&'), pathOf(el)].join('|'))
    }
    return { shape, totalVisible, excluded: excluded.size }
  })()`
  await goto(page, '/exchange?msg=1', { expectPanel: true })
  const light = await page.evaluate(shapeJuice)
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await goto(page, '/exchange?msg=1', { expectPanel: true })
  const dark = await page.evaluate(shapeJuice)
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  const lightSet = new Set(light.shape), darkSet = new Set(dark.shape)
  out.ac6Runtime.theme = {
    lightTotal: light.totalVisible, darkTotal: dark.totalVisible, lightExcluded: light.excluded, darkExcluded: dark.excluded,
    shapeEqual: JSON.stringify(light.shape) === JSON.stringify(dark.shape),
    shapeLenLight: light.shape.length, shapeLenDark: dark.shape.length,
    lightOnly: light.shape.filter((k) => !darkSet.has(k)).slice(0, 8),
    darkOnly: dark.shape.filter((k) => !lightSet.has(k)).slice(0, 8),
    totalDeltaEqualsIconSubtreeDelta: (light.totalVisible - dark.totalVisible) === (light.excluded - dark.excluded),
  }

  // =========================== 交互（AC-2 + 四入口） ================================
  const I = out.interactions
  // --- 桌面 AC-2：用桌面可见入口②（悬浮菜单「消息」）做真点击 ---
  await goto(page, '/exchange')
  await page.evaluate(() => { window.scrollTo(0, Math.min(300, document.documentElement.scrollHeight - window.innerHeight)) })
  await settle(page)
  const beforeClick = await page.evaluate(MEASURE_FN)
  await page.evaluate(() => {
    window.__qaHost = document.getElementById('sf-route-container')
    window.__qaHostChild = window.__qaHost && window.__qaHost.firstElementChild
    window.__qaHostGrand = window.__qaHostChild && window.__qaHostChild.firstElementChild
    window.__qaScroll = window.scrollY
  })
  await page.click('[data-sf-fm="messages"]')
  try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
  await settle(page)
  const afterClick = await page.evaluate(MEASURE_FN)
  I.entry2_floatMenu_desktop = {
    entryHref: await page.evaluate(() => document.querySelector('[data-sf-fm="messages"]').getAttribute('href')),
    pathnameBefore: beforeClick.pathname, pathnameAfter: afterClick.pathname, searchBefore: beforeClick.search, searchAfter: afterClick.search,
    pathnameIdentical: beforeClick.pathname === afterClick.pathname,
    onlySearchChanged: beforeClick.pathname === afterClick.pathname && beforeClick.search !== afterClick.search,
    panelPresentAfter: afterClick.panelPresent,
    hostSameRef: await page.evaluate(() => document.getElementById('sf-route-container') === window.__qaHost),
    hostChildSameRef: await page.evaluate(() => document.getElementById('sf-route-container').firstElementChild === window.__qaHostChild),
    hostGrandChildSameRef: await page.evaluate(() => document.getElementById('sf-route-container').firstElementChild.firstElementChild === window.__qaHostGrand),
    scrollable: beforeClick.docEl.scrollHeight > beforeClick.docEl.clientHeight,
    scrollYBeforeClick: beforeClick.scrollY, scrollYAfterClick: afterClick.scrollY,
    scrollYUnchanged: beforeClick.scrollY === afterClick.scrollY,
    historyBefore: beforeClick.historyLength, historyAfterOpen: afterClick.historyLength,
  }
  // 后退键关面板
  await page.goBack(); await settle(page)
  const afterBack = await page.evaluate(MEASURE_FN)
  I.backButton = { pathname: afterBack.pathname, search: afterBack.search, panelClosed: !afterBack.panelPresent, historyLength: afterBack.historyLength }
  // 面板内「×」关面板（replace ⇒ history 不长）
  await page.click('[data-sf-fm="messages"]')
  try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
  await settle(page)
  const opened2 = await page.evaluate(MEASURE_FN)
  await page.click('[data-sf-m="messages-panel-close"]')
  await settle(page)
  const closed2 = await page.evaluate(MEASURE_FN)
  I.closeButton = {
    pathnameAfterOpen: opened2.pathname, searchAfterOpen: opened2.search,
    pathnameAfterClose: closed2.pathname, searchAfterClose: closed2.search,
    panelClosed: !closed2.panelPresent,
    historyAfterOpen: opened2.historyLength, historyAfterClose: closed2.historyLength,
    historyNotGrown: opened2.historyLength === closed2.historyLength,
  }
  // 刷新 ?msg=1 仍开面板
  await page.goto(ORIGIN + '/exchange?msg=1', { waitUntil: 'load' }); await settle(page)
  I.refreshMsg1 = { panelPresent: (await page.evaluate(MEASURE_FN)).panelPresent }
  // 入口④ /messages 直链 ⇒ 首页 + 面板；× ⇒ 回首页
  await goto(page, '/messages', { expectPanel: true })
  const direct = await page.evaluate(MEASURE_FN)
  I.entry4_directMessages = { pathname: direct.pathname, search: direct.search, panelPresent: direct.panelPresent, title: direct.panelTitleText }
  await page.click('[data-sf-m="messages-panel-close"]'); await settle(page)
  const directClosed = await page.evaluate(MEASURE_FN)
  I.entry4_closeToHome = { pathnameAfterClose: directClosed.pathname, searchAfterClose: directClosed.search, panelClosed: !directClosed.panelPresent }
  // 入口③ 详情页「聊一聊」
  await goto(page, '/item/123')
  const chat = await page.evaluate(() => ({ href: (document.querySelector('[data-sf-m="item-chat"]') || {}).getAttribute ? document.querySelector('[data-sf-m="item-chat"]').getAttribute('href') : null, count: document.querySelectorAll('[data-sf-m="item-chat"]').length }))
  let entry3 = { linkHref: chat.href, linkCount: chat.count }
  if (chat.count > 0) {
    const before3 = await page.evaluate(MEASURE_FN)
    await page.click('[data-sf-m="item-chat"]')
    try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
    await settle(page)
    const after3 = await page.evaluate(MEASURE_FN)
    entry3 = { ...entry3, pathnameBefore: before3.pathname, pathnameAfter: after3.pathname, pathnameIdentical: before3.pathname === after3.pathname, searchAfter: after3.search, panelPresent: after3.panelPresent, convRows: after3.convRowCount, mineCount: after3.mineCount, theirsCount: after3.theirsCount, aboutText: after3.aboutText, activeHrefs: after3.convHrefs, closeAria: after3.closeAria }
  }
  I.entry3_itemChat = entry3
  // 入口① 底栏第 4 格（桌面不可见 ⇒ 在 390 真点击；桌面另证 href 与 DOM-click 行为）
  await goto(page, '/exchange')
  I.entry1_bottomTab_desktop = await page.evaluate(`(() => {
    const tab = document.querySelector('[data-sf-nav="messages"]')
    const vis = tab ? tab.getClientRects().length > 0 : null
    const href = tab ? tab.getAttribute('href') : null
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    tab.dispatchEvent(ev)
    return { href, visibleAtDesktop: vis, defaultPreventedPlain: ev.defaultPrevented }
  })()`)
  await settle(page)
  const tabDomClick = await page.evaluate(MEASURE_FN)
  I.entry1_bottomTab_desktop.afterDomClick = { pathname: tabDomClick.pathname, search: tabDomClick.search, panelPresent: tabDomClick.panelPresent }
  await page.setViewportSize({ width: 390, height: 844 })
  await goto(page, '/')
  const beforeTab = await page.evaluate(MEASURE_FN)
  await page.click('[data-sf-nav="messages"]')
  try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
  await settle(page)
  const afterTab = await page.evaluate(MEASURE_FN)
  I.entry1_bottomTab_mobile = {
    href: await page.evaluate(() => document.querySelector('[data-sf-nav="messages"]').getAttribute('href')),
    pathnameBefore: beforeTab.pathname, pathnameAfter: afterTab.pathname, pathnameIdentical: beforeTab.pathname === afterTab.pathname,
    searchAfter: afterTab.search, panelPresent: afterTab.panelPresent, tabVisible: beforeTab.tabHrefs.length > 0,
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  // 修饰键 / 中键不拦（走 href 新标签）
  const popupFor = async (mods, button) => {
    let url = null
    const onPage = (p) => { url = p.url() }
    context.on('page', onPage)
    try {
      await page.click('[data-sf-fm="messages"]', { modifiers: mods || [], button: button || 'left' })
      await page.waitForTimeout(1500)
    } catch (e) { url = 'CLICK_ERROR:' + String(e.message).slice(0, 120) }
    context.off('page', onPage)
    const s = await page.evaluate(MEASURE_FN)
    return { popupUrl: url, pathname: s.pathname, search: s.search, panelPresent: s.panelPresent }
  }
  await goto(page, '/exchange'); I.modifierClick_ctrl = await popupFor(['Control'])
  await goto(page, '/exchange'); I.modifierClick_meta = await popupFor(['Meta'])
  await goto(page, '/exchange'); I.middleClick = await popupFor(null, 'middle')
  await goto(page, '/exchange')
  I.defaultPreventedProbe = await page.evaluate(`(() => {
    const tab = document.querySelector('[data-sf-nav="messages"]')
    const fmItem = document.querySelector('[data-sf-fm="messages"]')
    const fire = (el, init) => { const ev = new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true }, init)); el.dispatchEvent(ev); return ev.defaultPrevented }
    return { tab_plain: fire(tab, { button: 0 }), tab_ctrl: fire(tab, { button: 0, ctrlKey: true }), tab_meta: fire(tab, { button: 0, metaKey: true }), tab_shift: fire(tab, { button: 0, shiftKey: true }), tab_alt: fire(tab, { button: 0, altKey: true }), tab_middle: fire(tab, { button: 1 }), fm_plain: fire(fmItem, { button: 0 }), fm_ctrl: fire(fmItem, { button: 0, ctrlKey: true }), fm_middle: fire(fmItem, { button: 1 }) }
  })()`)

  // 四态矩阵 M1–M4 + 边界
  await goto(page, '/exchange')
  const matrix = {}
  for (const [k, u, expect] of [
    ['M1_item', '/item/123', false], ['M2_item_msg', '/item/123?msg=1', true], ['M3_item_msg_c', '/item/123?msg=1&c=7', true],
    ['M4_messages_c', '/messages?c=7', true], ['M4b_item_c_only', '/item/123?c=7', true],
    ['msg0_explicit_off', '/item/123?msg=0', false], ['unknown_param', '/item/123?zzz=1', false],
  ]) {
    await goto(page, u, { expectPanel: expect })
    const s = await page.evaluate(MEASURE_FN)
    matrix[k] = { url: u, expectPanel: expect, panelPresent: s.panelPresent, pathname: s.pathname, search: s.search, listColDisplay: s.listColDisplay, threadColDisplay: s.threadColDisplay, aboutText: s.aboutText, detailEmptyText: s.detailEmptyText, detailEmptyCount: s.detailEmptyCount }
  }
  await goto(page, '/messages?c=999999', { expectPanel: true })
  const badC = await page.evaluate(MEASURE_FN)
  matrix.invalid_c = { pathname: badC.pathname, search: badC.search, panelPresent: badC.panelPresent, urlUnchanged: badC.search === '?c=999999', threadStatusText: badC.threadStatusText, threadStatusPhase: badC.threadStatusPhase }
  out.matrix = matrix

  out.finishedAt = new Date().toISOString()
  out.launchMode = 'chromium(headless) + 本机 Chrome • context.route 静态映射 dist • 零 dev server • 零真后端 • 零库写'
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('WROTE', OUT)
  console.log('pageErrors', JSON.stringify(pageErrors))
  await browser.close()
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
