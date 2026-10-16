/**
 * Neng 生产终验探针 · v119 消息面板化（方案 1 · 就地叠加）· 生产 site = 0xseafood.com
 *
 * 纪律（本单硬约束）：
 *   · 生产面**只读**：本探针对 `0xseafood.com` 的**一切非 GET/HEAD 请求一律 abort 并逐条记账**
 *     （由探针自身强制，不依赖应用自律）⇒ 结构上不可能写生产库。
 *   · 本机 DNS 被劫持 ⇒ Chromium 启动参 `--host-resolver-rules="MAP 0xseafood.com 76.76.21.21"`。
 *   · 未登录态（不注入任何 token / 不登录；无凭据可用亦不猜）。
 *   · 真浏览器 error 钩子（window.onerror / unhandledrejection / console.error）在**文档创建前**注入；
 *     ★ 尺子灵敏度自证：主动抛一条未捕获异常，必须被钩子捕获（否则「零异常」是假绿）。
 *   · 禁动画 + 稳态采样（连续两拍 DOM 签名逐字节相同才取数）。
 * 用法：node probe-prod.mjs <outDir>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'https://0xseafood.com'
const RESOLVE_ARG = '--host-resolver-rules=MAP 0xseafood.com 76.76.21.21'
const OUTDIR = process.argv[2] || path.join(REPO, 'ops/v119-msg-panel/prod')

// ---- 页内测量器（与本地质检同口径） -------------------------------------------------------------
const MEASURE_FN = `(() => {
  const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x*100)/100, y: Math.round(r.y*100)/100, w: Math.round(r.width*100)/100, h: Math.round(r.height*100)/100, left: Math.round(r.left*100)/100, right: Math.round(r.right*100)/100, top: Math.round(r.top*100)/100, bottom: Math.round(r.bottom*100)/100 } }
  const inter = (a, b) => (!a || !b) ? null : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const vis = (el) => !!el && el.getClientRects().length > 0
  const vrc = (el) => vis(el) ? rc(el) : null
  const css = (el) => (el ? getComputedStyle(el).display : null)
  const root = document.getElementById('root')
  const panel = document.querySelector('.sf-mp')
  const fm = document.querySelector('.sf-fm')
  const content = document.querySelector('#sf-route-container')
  const list = document.querySelector('[data-sf-m="messages-panel-list"]')
  const thread = document.querySelector('[data-sf-m="messages-panel-thread"]')
  const close = document.querySelector('[data-sf-m="messages-panel-close"]')
  const send = document.querySelector('[data-sf-m="messages-send-btn"]')
  const p = vrc(panel), f = rc(fm), c = rc(content), l = rc(list), t = rc(thread)
  const regions = [...document.querySelectorAll('[data-sf-region]')].map((e) => e.getAttribute('data-sf-region'))
  const uniqRegions = regions.filter((v, i) => regions.indexOf(v) === i)
  const qa = window.__qaErrors || { onerror: [], rejection: [], consoleError: [] }
  return {
    url: location.href, pathname: location.pathname, search: location.search,
    historyLength: history.length, scrollY: window.scrollY,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    rootInnerHTMLLen: root ? root.innerHTML.length : -1,
    rootChildCount: root ? root.children.length : -1,
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
    closeBtn: vrc(close), sendBtn: vrc(send),
    closeAria: close ? close.getAttribute('aria-label') : null,
    regs: uniqRegions, regionCount: regions.length, panelRegionCount: panel ? panel.querySelectorAll('[data-sf-region]').length : null,
    panelElementCount: panel ? panel.querySelectorAll('*').length : null,
    hookSet: [...new Set([...document.querySelectorAll('[data-sf-m]')].map((e) => e.getAttribute('data-sf-m')))].sort(),
    listEmptyText: (document.querySelector('[data-sf-m="messages-list-empty"]')||{}).textContent || null,
    detailEmptyText: (document.querySelector('[data-sf-m="messages-detail-empty"]')||{}).textContent || null,
    loginHintHooks: [...new Set([...document.querySelectorAll('[data-sf-m*="login"],[data-sf-m*="auth"],[data-sf-m*="sign"]')].map((e) => e.getAttribute('data-sf-m')))],
    convRowCount: document.querySelectorAll('[data-sf-m="messages-conversation-item"]').length,
    panelTitleText: (document.querySelector('.sf-mp .sf-panel-title')||{}).textContent || null,
    elementCount: document.querySelectorAll('*').length,
    legacyHookCount: document.querySelectorAll('[data-sf-m="messages-page"]').length,
    errors: { onerror: qa.onerror.slice(), rejection: qa.rejection.slice(), consoleError: qa.consoleError.slice() },
    hookAlive: !!window.__qaErrors,
  }
})()`

const SELFTEST_FN = `(() => {
  if (!window.__qaErrors) return 'HOOK_ABSENT'
  window.__qaErrors.onerror.length = 0; window.__qaErrors.rejection.length = 0; window.__qaErrors.consoleError.length = 0
  setTimeout(() => { throw new Error('QA_SELFTEST_UNCAUGHT') }, 0)
  Promise.reject(new Error('QA_SELFTEST_REJECTION'))
  console.error('QA_SELFTEST_CONSOLE_ERROR')
  return 'FIRED'
})()`

async function settle(page, max = 90) {
  try { await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }) } catch (e) { /* aborted nav */ }
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {})
    const sig = await page.evaluate(`(()=>{const r=document.getElementById('root');return (r?r.innerHTML.length:0)+'|'+document.querySelectorAll('*').length})()`).catch(() => 'ERR')
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

async function goto(page, url, opts = {}) {
  const errors = []
  try {
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 45000 })
  } catch (e) { errors.push('GOTO:' + String(e.message).slice(0, 160)) }
  await settle(page)
  if (opts.expectPanel) {
    try { await page.waitForSelector('.sf-mp', { timeout: 10000 }) } catch (e) { /* record below */ }
    await settle(page)
  }
  return errors
}

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [RESOLVE_ARG] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  // ★ error 钩子：文档创建前注入
  await context.addInitScript(() => {
    window.__qaErrors = { onerror: [], rejection: [], consoleError: [] }
    window.addEventListener('error', (e) => { try { window.__qaErrors.onerror.push(String((e && (e.message || (e.error && e.error.message))) || 'unknown')) } catch (_) {} })
    window.addEventListener('unhandledrejection', (e) => { try { const r = e && e.reason; window.__qaErrors.rejection.push(String((r && (r.message || r)) || 'unknown')) } catch (_) {} })
    const orig = console.error.bind(console)
    console.error = (...a) => { try { window.__qaErrors.consoleError.push(a.map((x) => String((x && x.message) || x)).join(' ').slice(0, 300)) } catch (_) {} ; return orig(...a) }
  })

  // ---- 只读闸：非 GET/HEAD ⇒ abort 并记账 -------------------------------------------------------
  const requestLog = []
  const blockedWrites = []
  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const m = req.method().toUpperCase()
    const entry = { method: m, host: u.hostname, path: u.pathname, search: u.search, rtype: req.resourceType() }
    if (entry.host === '0xseafood.com') requestLog.push(entry)
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      blockedWrites.push({ ...entry, aborted: true, postDataPreview: String(req.postData() || '').slice(0, 200) })
      return route.abort()
    }
    return route.continue()
  })

  const page = await context.newPage()
  const pageErrors = []
  const consoleAll = []
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleAll.push(m.text().slice(0, 240)) })
  page.on('requestfailed', (r) => { if (!r.failure()) return })

  const out = {
    probe: 'probe-prod.mjs（Neng 生产终验 · 自写）',
    startedAt: new Date().toISOString(),
    target: BASE, launchArgs: [RESOLVE_ARG], chrome: CHROME,
    auth: '未登录（零凭据、零 localStorage 注入）',
    readOnlyGate: 'context.route 拦截：一切非 GET/HEAD/OPTIONS 一律 abort（探针侧强制）',
    states: {}, geometry1440: {}, interactions: {}, mobile: {}, rulerSensitivity: {}, readOnly: {}, notes: {},
    pageErrors, consoleErrorsNodeSide: consoleAll,
  }
  const measure = async (label, url, opts = {}) => {
    const gotoErr = await goto(page, url, opts)
    const snap = await page.evaluate(MEASURE_FN)
    if (gotoErr.length) snap.gotoErrors = gotoErr
    out.states[label] = snap
    return snap
  }

  // ===== §2 四态 + 白屏判决（1440×900） =========================================================
  const four = {}
  for (const u of ['/', '/exchange', '/item/1', '/messages']) {
    const s = await measure('state_' + (u === '/' ? 'home' : u.replace(/\W+/g, '_')), u, { expectPanel: u === '/messages' })
    four[u] = {
      pathname: s.pathname, search: s.search, status: 'ok',
      rootInnerHTMLLen: s.rootInnerHTMLLen, rootChildCount: s.rootChildCount,
      elementCount: s.elementCount, panelPresent: s.panelPresent,
      onerror: s.errors.onerror.length, rejection: s.errors.rejection.length, consoleErrorHook: s.errors.consoleError.length,
      hookAlive: s.hookAlive, gotoErrors: s.gotoErrors || [],
      blankScreen: !(s.rootInnerHTMLLen > 0),
    }
  }
  out.fourStates = four

  // ===== 尺子灵敏度自证（error 钩子真能接住未捕获异常） ==========================================
  await goto(page, '/')
  const st1 = await page.evaluate(SELFTEST_FN)
  await page.waitForTimeout(400)
  await settle(page)
  const st2 = await page.evaluate(MEASURE_FN)
  out.rulerSensitivity.errorHook = {
    fired: st1,
    caught_onerror: st2.errors.onerror.some((x) => x.includes('QA_SELFTEST_UNCAUGHT')),
    caught_rejection: st2.errors.rejection.some((x) => x.includes('QA_SELFTEST_REJECTION')),
    caught_consoleError: st2.errors.consoleError.some((x) => x.includes('QA_SELFTEST_CONSOLE_ERROR')),
    captured_sample: { onerror: st2.errors.onerror, rejection: st2.errors.rejection, consoleError: st2.errors.consoleError },
  }
  await goto(page, '/') // 复原（清掉自证的钩子残留）

  // ===== §3 生产功能面（只读 · 1440） ===========================================================
  // (a) /messages 直链态几何
  const g1 = await measure('geo_1440_messages_direct', '/messages', { expectPanel: true })
  out.geometry1440.messages_direct = {
    pathname: g1.pathname, search: g1.search, panelPresent: g1.panelPresent,
    panelW: g1.panel && g1.panel.w, panelH: g1.panel && g1.panel.h,
    panelRightOffset: g1.panelRightOffset,
    listColW: g1.listCol && g1.listCol.w, threadColW: g1.threadCol && g1.threadCol.w,
    listPlusThread: g1.listPlusThread,
    listColDisplay: g1.listColDisplay, threadColDisplay: g1.threadColDisplay,
    gapToFloatMenu: g1.gapToFloatMenu, fmPresent: !!g1.fm, fmDisplay: g1.fmDisplay, intersectArea: g1.intersectArea,
    overflowPx: g1.overflowPx, docEl: g1.docEl, contentRightVsPanelLeft: g1.contentRightVsPanelLeft,
    panelRegionCount: g1.panelRegionCount, regs: g1.regs, regsSorted: [...g1.regs].sort(),
    listEmptyText: g1.listEmptyText, detailEmptyText: g1.detailEmptyText, loginHintHooks: g1.loginHintHooks,
    convRowCount: g1.convRowCount, panelTitleText: g1.panelTitleText, closeAria: g1.closeAria,
    panelElementCount: g1.panelElementCount, hookSet: g1.hookSet,
  }
  // (b) ?msg=1 叠加态几何（入口② 打开后的形态，.sf-fm 在场）
  const g2 = await measure('geo_1440_exchange_msg1', '/exchange?msg=1', { expectPanel: true })
  out.geometry1440.exchange_msg1 = {
    pathname: g2.pathname, search: g2.search, panelPresent: g2.panelPresent,
    panelW: g2.panel && g2.panel.w, panelH: g2.panel && g2.panel.h, panelRightOffset: g2.panelRightOffset,
    listColW: g2.listCol && g2.listCol.w, threadColW: g2.threadCol && g2.threadCol.w, listPlusThread: g2.listPlusThread,
    gapToFloatMenu: g2.gapToFloatMenu, fmPresent: !!g2.fm, fmDisplay: g2.fmDisplay, intersectArea: g2.intersectArea,
    overflowPx: g2.overflowPx, contentRightVsPanelLeft: g2.contentRightVsPanelLeft,
    panelRegionCount: g2.panelRegionCount, regs: g2.regs,
  }

  // (c) 悬浮菜单「消息」真点击 ⇒ pathname 不变 + search → ?msg=1
  await goto(page, '/exchange')
  await page.evaluate(() => { window.scrollTo(0, Math.min(300, document.documentElement.scrollHeight - window.innerHeight)) })
  await settle(page)
  const beforeClick = await page.evaluate(MEASURE_FN)
  await page.evaluate(() => {
    window.__qaHost = document.getElementById('sf-route-container')
    window.__qaHostChild = window.__qaHost && window.__qaHost.firstElementChild
    window.__qaHostGrand = window.__qaHostChild && window.__qaHostChild.firstElementChild
  })
  const fmEntry = await page.evaluate(`(() => { const e = document.querySelector('[data-sf-fm="messages"]'); return e ? { present: true, tag: e.tagName, href: e.getAttribute('href'), visible: e.getClientRects().length > 0 } : { present: false } })()`)
  let clickErr = null
  try { await page.click('[data-sf-fm="messages"]', { timeout: 8000 }) } catch (e) { clickErr = String(e.message).slice(0, 160) }
  try { await page.waitForSelector('.sf-mp', { timeout: 10000 }) } catch (e) { /* recorded via panelPresent */ }
  await settle(page)
  const afterClick = await page.evaluate(MEASURE_FN)
  out.interactions.floatMenuMessages = {
    entry: fmEntry, clickError: clickErr,
    pathnameBefore: beforeClick.pathname, pathnameAfter: afterClick.pathname,
    searchBefore: beforeClick.search, searchAfter: afterClick.search,
    pathnameIdentical: beforeClick.pathname === afterClick.pathname,
    searchBecameMsg1: afterClick.search === '?msg=1',
    onlySearchChanged: beforeClick.pathname === afterClick.pathname && beforeClick.search !== afterClick.search,
    panelPresentAfter: afterClick.panelPresent,
    hostSameRef: await page.evaluate(() => document.getElementById('sf-route-container') === window.__qaHost),
    hostChildSameRef: await page.evaluate(() => document.getElementById('sf-route-container').firstElementChild === window.__qaHostChild),
    hostGrandChildSameRef: await page.evaluate(() => document.getElementById('sf-route-container').firstElementChild.firstElementChild === window.__qaHostGrand),
    scrollYBefore: beforeClick.scrollY, scrollYAfter: afterClick.scrollY,
    historyBefore: beforeClick.historyLength, historyAfterOpen: afterClick.historyLength,
    onerror: afterClick.errors.onerror, rejection: afterClick.errors.rejection,
  }
  // (d) 浏览器后退 ⇒ 关面板
  await page.goBack({ timeout: 30000 }).catch(() => {})
  await settle(page)
  const afterBack = await page.evaluate(MEASURE_FN)
  out.interactions.backButton = { pathname: afterBack.pathname, search: afterBack.search, panelClosed: !afterBack.panelPresent, historyLength: afterBack.historyLength }

  // (e) 面板「×」关面板
  await goto(page, '/exchange')
  try { await page.click('[data-sf-fm="messages"]', { timeout: 8000 }) } catch (e) {}
  try { await page.waitForSelector('.sf-mp', { timeout: 10000 }) } catch (e) {}
  await settle(page)
  const opened2 = await page.evaluate(MEASURE_FN)
  let closeErr = null
  try { await page.click('[data-sf-m="messages-panel-close"]', { timeout: 8000 }) } catch (e) { closeErr = String(e.message).slice(0, 160) }
  await settle(page)
  const closed2 = await page.evaluate(MEASURE_FN)
  out.interactions.closeButton = {
    closeError: closeErr,
    pathnameAfterOpen: opened2.pathname, searchAfterOpen: opened2.search,
    pathnameAfterClose: closed2.pathname, searchAfterClose: closed2.search,
    panelClosed: !closed2.panelPresent,
    historyAfterOpen: opened2.historyLength, historyAfterClose: closed2.historyLength,
  }

  // (f) /messages 直链态「×」⇒ 回首页
  const direct = await measure('geo_1440_messages_direct_preclose', '/messages', { expectPanel: true })
  let closeErr2 = null
  try { await page.click('[data-sf-m="messages-panel-close"]', { timeout: 8000 }) } catch (e) { closeErr2 = String(e.message).slice(0, 160) }
  await settle(page)
  const directClosed = await page.evaluate(MEASURE_FN)
  out.interactions.directMessagesClose = {
    closeError: closeErr2, pathnameOnLoad: direct.pathname, searchOnLoad: direct.search,
    pathnameAfterClose: directClosed.pathname, searchAfterClose: directClosed.search,
    panelClosed: !directClosed.panelPresent, backToHome: directClosed.pathname === '/',
  }

  // (g) ≤390 档：面板是否全屏 + 单栏
  await page.setViewportSize({ width: 390, height: 844 })
  const m1 = await measure('mobile_390_msg1_list', '/messages?msg=1', { expectPanel: true })
  const m2 = await measure('mobile_390_msg1_thread', '/messages?msg=1&c=1', { expectPanel: true })
  out.mobile = {
    '390_list': { viewport: m1.viewport, panel: m1.panel, fullscreen: !!(m1.panel && Math.abs(m1.panel.w - 390) < 1.5 && Math.abs(m1.panel.h - 844) < 1.5), listColDisplay: m1.listColDisplay, threadColDisplay: m1.threadColDisplay, overflowPx: m1.overflowPx, closeBtn: m1.closeBtn, sendBtn: m1.sendBtn, regs: m1.regs, pathtitle: m1.panelTitleText },
    '390_thread': { viewport: m2.viewport, panel: m2.panel, fullscreen: !!(m2.panel && Math.abs(m2.panel.w - 390) < 1.5 && Math.abs(m2.panel.h - 844) < 1.5), listColDisplay: m2.listColDisplay, threadColDisplay: m2.threadColDisplay, overflowPx: m2.overflowPx, closeBtn: m2.closeBtn, sendBtn: m2.sendBtn },
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  // ===== 只读面记账 ========================================================================
  const nonGet = requestLog.filter((r) => !['GET', 'HEAD', 'OPTIONS'].includes(r.method))
  const pathTally = {}
  for (const r of requestLog) { const k = r.method + ' ' + r.path; pathTally[k] = (pathTally[k] || 0) + 1 }
  out.readOnly = {
    totalRequestsToOrigin: requestLog.length,
    nonGetRequests: nonGet,
    blockedWrites,
    pathTally,
  }

  out.finishedAt = new Date().toISOString()
  out.pageErrors = pageErrors
  out.consoleErrorsNodeSide = consoleAll
  fs.writeFileSync(path.join(OUTDIR, 'prod-probe.json'), JSON.stringify(out, null, 2))
  console.log('WROTE', path.join(OUTDIR, 'prod-probe.json'))
  console.log('pageErrors =', JSON.stringify(pageErrors))
  console.log('blockedWrites =', JSON.stringify(blockedWrites))
  await browser.close()
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
