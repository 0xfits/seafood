/**
 * Neng 独立质检探针 ② · 入口③ / 修饰键 / 溢出尺子功能性 / 日夜间构（噪声归一）· v119 消息面板化
 * 用法：QA_DIST=<dist> node probe-interactions-qa2.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/v119-msg-panel/qa/interactions-qa.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }

const MY_UID = 970213
const SELLER_UID = 999999
const CONVS = [{ conversation_id: 7, counterpart_uid: 970301, listing_title: 'FIXTURE 商品 A', last_body_preview: 'FIXTURE 预览一', unread_count: 250, time_updated: '2026-10-16 10:00:00' }]
const ITEM = { bID: 123, listing_id: 123, title: 'FIXTURE 商品 X', name: 'FIXTURE 商品 X', price: 100, status: 'listed', stock: 5, description: 'FIXTURE 描述', seller: { uid: SELLER_UID }, seller_uid: SELLER_UID }
const apiResponse = (method, pathname) => {
  const data = (d) => ({ success: true, data: d })
  if (/^\/api\/prize\/\d+$/.test(pathname)) return data(method === 'PATCH' ? ITEM : { ...ITEM })
  if (pathname === '/api/messages/unread-count') return data({ unread_total: 250 })
  if (pathname === '/api/messages/conversations' && method === 'GET') return data({ rows: CONVS.map((c) => ({ ...c })), next_cursor: null })
  if (pathname === '/api/messages/conversations' && method === 'POST') return data({ conversation_id: 7, created: false })
  const m = pathname.match(/^\/api\/messages\/conversations\/(\d+)\/messages$/)
  if (m && method === 'GET') {
    const id = Number(m[1]); const conv = CONVS.find((c) => c.conversation_id === id) || CONVS[0]
    return data({ conversation: { conversation_id: id, listing_id: 42, listing_title: conv.listing_title, counterpart_uid: conv.counterpart_uid, role: 'buyer' }, rows: [{ msg_id: 2, from_uid: conv.counterpart_uid, body: 'FIXTURE 对方消息一' }, { msg_id: 1, from_uid: MY_UID, body: 'FIXTURE 我的消息一' }], next_before_msg_id: null })
  }
  if (m && method === 'POST') return data({ msg_id: 3, time_created: '2026-10-16 11:00:00', conversation_id: Number(m[1]) })
  if (/read$/.test(pathname)) return data({ last_read_msg_id: 2 })
  if (/^\/api\/telegram\//.test(pathname)) return { success: false, error: { code: 'TG_NOT_CONFIGURED', i18n_key: 'tg.err.TG_NOT_CONFIGURED' } }
  if (method === 'GET') return data([])
  return data({})
}

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
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex')

const SHAPE_FN = (normalizeAltTitle) => `(() => {
  const blank = ${normalizeAltTitle ? 'true' : 'false'}
  const norm = (v) => String(v == null ? '' : v).replace(/\\s+/g, ' ').trim()
  const pathOf = (el) => { const p = []; let n = el; while (n && n.parentElement) { p.unshift([...n.parentElement.children].indexOf(n)); n = n.parentElement } return p.join('/') }
  const themeIcon = document.querySelector('svg.lucide-sun, svg.lucide-moon')
  const themeBtn = themeIcon && themeIcon.closest ? themeIcon.closest('button') : null
  const excluded = new Set()
  if (themeBtn) { excluded.add(themeBtn); for (const el of themeBtn.querySelectorAll('*')) excluded.add(el) }
  const shape = []
  let total = 0
  for (const el of document.querySelectorAll('*')) {
    if (!el.getClientRects().length) continue
    total += 1
    if (excluded.has(el)) continue
    const attrs = []
    for (const a of el.attributes) {
      if (a.name === 'class' || a.name === 'style') continue
      if (blank && (a.name === 'alt' || a.name === 'title')) { attrs.push(a.name); continue }
      attrs.push(a.name + '=' + norm(a.value))
    }
    shape.push([el.tagName, norm(el.getAttribute('class')), attrs.sort().join('&'), pathOf(el)].join('|'))
  }
  return { shape, total, excluded: excluded.size }
})()`

const diff = (a, b) => { const sb = new Set(b), sa = new Set(a); return { aOnly: a.filter((k) => !sb.has(k)), bOnly: b.filter((k) => !sa.has(k)), size: a.filter((k) => !sb.has(k)).length + b.filter((k) => !sa.has(k)).length } }

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
    localStorage.setItem('token', 'qa-token')
  })
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))

  const out = { probe: 'probe-interactions-qa2.mjs (Neng 独立质检 · 自写)', startedAt: new Date().toISOString(), dist: DIST, fixtureItem: ITEM, pageErrors }
  const goto = async (url, expectPanel) => { await page.goto(ORIGIN + url, { waitUntil: 'load' }); await settle(page); if (expectPanel) { try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {} await settle(page) } }
  const snap = () => page.evaluate(`(() => ({
    pathname: location.pathname, search: location.search, href: location.href, historyLength: history.length, scrollY: window.scrollY,
    panelPresent: !!document.querySelector('.sf-mp'), panelW: (document.querySelector('.sf-mp')||{getBoundingClientRect:()=>({width:null})}).getBoundingClientRect().width,
    aboutText: (document.querySelector('[data-sf-m="messages-about"]')||{}).textContent || null,
    convRows: document.querySelectorAll('[data-sf-m="messages-conversation-item"]').length,
    mine: document.querySelectorAll('[data-sf-m="messages-msg-mine"]').length,
    theirs: document.querySelectorAll('[data-sf-m="messages-msg-theirs"]').length,
    closeAria: (document.querySelector('[data-sf-m="messages-panel-close"]')||{}).getAttribute ? document.querySelector('[data-sf-m="messages-panel-close"]').getAttribute('aria-label') : null,
    chatBtnPresent: !!document.querySelector('[data-sf-m="item-chat-btn"]'),
    chatBtnTag: (document.querySelector('[data-sf-m="item-chat-btn"]')||{}).tagName || null,
    chatBtnHref: (document.querySelector('[data-sf-m="item-chat-btn"]')||{}).getAttribute ? document.querySelector('[data-sf-m="item-chat-btn"]').getAttribute('href') : null,
    fmMessagesHref: (document.querySelector('[data-sf-fm="messages"]')||{}).getAttribute ? document.querySelector('[data-sf-fm="messages"]').getAttribute('href') : null,
    tabMessagesHref: (document.querySelector('[data-sf-nav="messages"]')||{}).getAttribute ? document.querySelector('[data-sf-nav="messages"]').getAttribute('href') : null,
    docEl: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fmLeft: (() => { const f = document.querySelector('.sf-fm'); return f ? f.getBoundingClientRect().left : null })(),
    panelRight: (() => { const p = document.querySelector('.sf-mp'); return p ? p.getBoundingClientRect().right : null })(),
    gap: (() => { const p = document.querySelector('.sf-mp'); const f = document.querySelector('.sf-fm'); return (p && f) ? Math.round((f.getBoundingClientRect().left - p.getBoundingClientRect().right) * 100) / 100 : null })(),
  }))()`)

  // ---- 入口③ 详情页「聊一聊」真点击（就地叠加） ----
  await goto('/item/123', false)
  const before3 = await snap()
  let entry3 = { beforePathname: before3.pathname, chatBtnPresent: before3.chatBtnPresent, chatBtnTag: before3.chatBtnTag, chatBtnHref: before3.chatBtnHref }
  if (before3.chatBtnPresent) {
    await page.click('[data-sf-m="item-chat-btn"]')
    try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
    await settle(page)
    const after3 = await snap()
    entry3 = {
      ...entry3, pathnameAfter: after3.pathname, pathnameIdentical: before3.pathname === after3.pathname,
      searchAfter: after3.search, panelPresent: after3.panelPresent, aboutText: after3.aboutText,
      mine: after3.mine, theirs: after3.theirs, convRows: after3.convRows,
      urlMatchesT105: /(^|\/)messages$/.test(after3.pathname) || new URLSearchParams(after3.search).get('msg') === '1' || !!new URLSearchParams(after3.search).get('c'),
    }
  }
  out.entry3_itemChat = entry3

  // ---- 修饰键 / 中键：枚举 context 内全部 page ----
  const popupProbe = async (mods, button) => {
    await goto('/exchange', false)
    const beforePages = context.pages().map((p) => p.url())
    let err = null
    try {
      if (button && button !== 'left') await page.click('[data-sf-fm="messages"]', { button })
      else await page.click('[data-sf-fm="messages"]', { modifiers: mods || [] })
      await page.waitForTimeout(1800)
    } catch (e) { err = String(e.message).slice(0, 140) }
    const afterPages = context.pages().map((p) => p.url())
    const created = afterPages.filter((u) => !beforePages.includes(u))
    const s = await snap()
    for (const p of context.pages()) { if (p !== page && p.url() === 'about:blank') { try { await p.close() } catch (e) {} } }
    return { modifiers: mods || null, button: button || 'left', clickError: err, newPages: created, newPageCount: created.length, mainPathname: s.pathname, mainSearch: s.search, mainPanelPresent: s.panelPresent, mainHistoryLength: s.historyLength }
  }
  out.click_ctrl = await popupProbe(['Control'])
  out.click_meta = await popupProbe(['Meta'])
  out.click_shift = await popupProbe(['Shift'])
  out.click_alt = await popupProbe(['Alt'])
  out.click_middle = await popupProbe(null, 'middle')
  out.click_plain = await popupProbe(null, 'left')

  // ---- 溢出尺子「功能性」自证：注入真溢出 ⇒ 该读数必须变红 ----
  await goto('/exchange', false)
  const overflowBefore = (await snap()).overflowPx
  await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = '.sf-route-container{width:3000px !important}'; document.head.appendChild(s) })()`)
  await settle(page)
  const overflowAfter = (await snap()).overflowPx
  out.overflowRulerFunctional = {
    arm: 'page 内注入 .sf-route-container{width:3000px}（只改探针页内样式）',
    overflowPx_before: overflowBefore, overflowPx_after: overflowAfter,
    rulerCanGoRed: overflowAfter > 0,
    note: '本判据（scrollWidth-clientWidth）在面板化改动下恒 0 —— 面板为 position:fixed 浮层、不参与滚动宽 ⇒ 对本改动不敏感；此处证明尺子本身有分辨力',
  }

  // ---- 日 / 夜同构（噪声归一） ----
  const themeRun = async (theme) => {
    await page.evaluate((th) => localStorage.setItem('theme', th), theme)
    await goto('/exchange?msg=1', true)
    const raw = await page.evaluate(SHAPE_FN(false))
    const nrm = await page.evaluate(SHAPE_FN(true))
    await page.evaluate(() => localStorage.setItem('theme', 'light'))
    return { raw, nrm, shaRaw: sha(raw.shape), shaNrm: sha(nrm.shape) }
  }
  const L1 = await themeRun('light'); const L2 = await themeRun('light')
  const D1 = await themeRun('dark'); const D2 = await themeRun('dark')
  const normDiffL = diff(L1.nrm.shape, L2.nrm.shape)
  const normDiffLD = diff(L1.nrm.shape, D1.nrm.shape)
  const rawDiffLD = diff(L1.raw.shape, D1.raw.shape)
  out.theme = {
    light1: { total: L1.raw.total, excluded: L1.raw.excluded, len: L1.raw.shape.length },
    light2: { total: L2.raw.total, excluded: L2.raw.excluded, len: L2.raw.shape.length },
    dark1: { total: D1.raw.total, excluded: D1.raw.excluded, len: D1.raw.shape.length },
    dark2: { total: D2.raw.total, excluded: D2.raw.excluded, len: D2.raw.shape.length },
    raw_light1_vs_light2_diff: diff(L1.raw.shape, L2.raw.shape),
    raw_light1_vs_dark1_diff: rawDiffLD,
    normalized_light1_vs_light2_diffSize: normDiffL.size,
    normalized_light1_vs_dark1_diffSize: normDiffLD.size,
    normalized_light1_vs_dark1_aOnly: normDiffLD.aOnly.slice(0, 6),
    normalized_light1_vs_dark1_bOnly: normDiffLD.bOnly.slice(0, 6),
    shapeEqual_normalized: normDiffLD.size === 0,
    shapeEqual_raw: rawDiffLD.size === 0,
    totalDeltaEqualsIconSubtreeDelta_lightVsDark: (L1.raw.total - D1.raw.total) === (L1.raw.excluded - D1.raw.excluded),
  }

  // ---- 非 zh 语言档（en）----
  await goto('/en/exchange', false)
  const enClosed = await snap()
  await page.click('[data-sf-fm="messages"]')
  try { await page.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {}
  await settle(page)
  const enOpen = await snap()
  out.localeEn = {
    fmMessagesHref: enClosed.fmMessagesHref, tabMessagesHref: enClosed.tabMessagesHref,
    pathnameBefore: enClosed.pathname, pathnameAfter: enOpen.pathname, pathnameIdentical: enClosed.pathname === enOpen.pathname,
    searchAfter: enOpen.search, panelPresent: enOpen.panelPresent, closeAria: enOpen.closeAria,
  }
  await goto('/en/messages', true)
  const enDirect = await snap()
  out.localeEn.directMessages = { pathname: enDirect.pathname, panelPresent: enDirect.panelPresent, closeAria: enDirect.closeAria }

  out.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log('WROTE', OUT)
  console.log('pageErrors', JSON.stringify(pageErrors))
  await browser.close()
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
