/**
 * Neng 独立质检探针 · AC-5 归因（未打开态 ⇒ 零影响）· v119 消息面板化 —— 第二轮（归一化口径修正）
 * 由 Neng 自写自跑。归一化口径（**声明式、两族**）：
 *   · nrm_alt        = 剔除 `alt` 值（记录用 · 第一轮口径，会残留 title 噪声）
 *   · nrm_alt_title  = 剔除 `alt` 与 `title` 两属性值（本判决采用的口径 —— 具名噪声源
 *                      `frontend/src/components/Footer.jsx` 模块加载期 `Math.random()` 同时喂 `<img alt>` 与其外层 `<a title>`）
 * 结构键 = tag + 全 class + 语义属性（除 alt/title **值**）+ 结构路径；**坐标不掺进键**。
 * 三件必做（承 §21.8 / AC-5）：
 *   (a) 同版连跑两轮 ⇒ 归一化 sha256 必须相同（噪声基线可重复）
 *   (b) 未打开态（多页 × 两档）改前 ⇄ 改后 归一化差异集必须 = 0（/messages 单列：预期差异）
 *   (c) 扰动臂非空：① 反事实（closed ⇄ open）② 同页注入 .sf-mp{display:none} ③ **同页注入一个额外可见元素**
 *       （③ = 针对「本页判 0 会不会是因为尺子在这页上瞎」的对偶检验）
 * 用法：QA_NEW=<new dist> QA_OLD=<old dist> node probe-attribution-qa.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const NEW = process.env.QA_NEW || path.join(REPO, 'frontend/dist')
const OLD = process.env.QA_OLD
const OUT = process.argv[2] || path.join(REPO, 'ops/v119-msg-panel/qa/attribution-qa.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }

const MY_UID = 970213
const CONVS = [
  { conversation_id: 7, counterpart_uid: 970301, listing_title: 'FIXTURE 商品 A', last_body_preview: 'FIXTURE 预览一', unread_count: 250, time_updated: '2026-10-16 10:00:00' },
  { conversation_id: 8, counterpart_uid: 970302, listing_title: 'FIXTURE 商品 B', last_body_preview: 'FIXTURE 预览二', unread_count: 3, time_updated: '2026-10-16 09:00:00' },
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
    return data({ conversation: { conversation_id: id, listing_id: 42, listing_title: conv.listing_title, counterpart_uid: conv.counterpart_uid, role: 'buyer' }, rows: [{ msg_id: 2, from_uid: conv.counterpart_uid, body: 'FIXTURE 对方消息一' }, { msg_id: 1, from_uid: MY_UID, body: 'FIXTURE 我的消息一' }], next_before_msg_id: null })
  }
  if (m && method === 'POST') return data({ msg_id: 3, time_created: '2026-10-16 11:00:00', conversation_id: Number(m[1]) })
  if (/read$/.test(pathname)) return data({ last_read_msg_id: 2 })
  if (/^\/api\/telegram\//.test(pathname)) return { success: false, error: { code: 'TG_NOT_CONFIGURED', i18n_key: 'tg.err.TG_NOT_CONFIGURED' } }
  if (method === 'GET') return data([])
  return data({})
}

const KEYS_FN = `(() => {
  const norm = (v) => String(v == null ? '' : v).replace(/\\s+/g, ' ').trim()
  const pathOf = (el) => { const p = []; let n = el; while (n && n.parentElement) { p.unshift([...n.parentElement.children].indexOf(n)); n = n.parentElement } return p.join('/') }
  const raw = [], nrmAlt = [], nrmAltTitle = []
  const altTitle = []
  for (const el of document.querySelectorAll('*')) {
    if (!el.getClientRects().length) continue
    const aR = [], aA = [], aAT = []
    for (const a of el.attributes) {
      if (a.name === 'class' || a.name === 'style') continue
      aR.push(a.name + '=' + norm(a.value))
      aA.push(a.name === 'alt' ? 'alt' : a.name + '=' + norm(a.value))
      aAT.push((a.name === 'alt' || a.name === 'title') ? a.name : a.name + '=' + norm(a.value))
      if (a.name === 'alt' || a.name === 'title') altTitle.push({ path: pathOf(el), tag: el.tagName, cls: norm(el.getAttribute('class')), attr: a.name, value: norm(a.value) })
    }
    const base = [el.tagName, norm(el.getAttribute('class')), pathOf(el)].join('|')
    raw.push(base + '|' + aR.sort().join('&'))
    nrmAlt.push(base + '|' + aA.sort().join('&'))
    nrmAltTitle.push(base + '|' + aAT.sort().join('&'))
  }
  return { raw, nrmAlt, nrmAltTitle, altTitle, visibleCount: raw.length, panelPresent: !!document.querySelector('.sf-mp') }
})()`

const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex')
const diff = (a, b) => { const sb = new Set(b), sa = new Set(a); return { aOnly: a.filter((k) => !sb.has(k)), bOnly: b.filter((k) => !sa.has(k)), size: a.filter((k) => !sb.has(k)).length + b.filter((k) => !sa.has(k)).length } }

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

async function main() {
  if (!OLD) { console.error('QA_OLD required'); process.exit(2) }
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = { probe: 'probe-attribution-qa.mjs round2 (Neng 独立质检 · 自写)', startedAt: new Date().toISOString(), newDist: NEW, oldDist: OLD, chrome: CHROME, launchMode: 'chromium(headless) + 本机 Chrome • context.route 静态映射两版 dist • 零 dev server • 零真后端 • 零库写', normalization: { nrm_alt: '剔除 alt 值', nrm_alt_title: '剔除 alt 与 title 两属性值（判决采用）' }, pages: {}, noise: {}, arms: {}, messagesDirect: {}, pageErrors: [], runAnomalies: [] }

  const run = async (dist, vp, tasks) => {
    const context = await browser.newContext({ viewport: vp, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    context.addInitScript(() => {
      localStorage.setItem('theme', 'light')
      localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'qa-token', bio: 'qa', name: 'QA' }))
      localStorage.setItem('token', 'qa-token')
    })
    await context.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url())
      if (u.hostname !== 'sf.local') return route.abort()
      if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
      let file = path.join(dist, decodeURIComponent(u.pathname))
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(dist, 'index.html')
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
    })
    const pg = await context.newPage()
    pg.on('pageerror', (e) => out.pageErrors.push(`[${dist === NEW ? 'new' : 'old'}] ${String(e && e.message)}`))
    const res = {}
    for (const t of tasks) {
      await pg.goto(ORIGIN + t.url, { waitUntil: 'load' })
      await settle(pg)
      if (t.expectPanel) { try { await pg.waitForSelector('.sf-mp', { timeout: 8000 }) } catch (e) {} await settle(pg) }
      if (t.inject) { await pg.evaluate(t.inject); await settle(pg) }
      const got = await pg.evaluate(KEYS_FN)
      if (!got) out.runAnomalies.push({ dist: dist === NEW ? 'new' : 'old', key: t.key, url: t.url })
      res[t.key] = got
    }
    await context.close()
    return res
  }

  const PAGES = [
    { key: '1440_home', url: '/', vp: { width: 1440, height: 900 } },
    { key: '1440_exchange', url: '/exchange', vp: { width: 1440, height: 900 } },
    { key: '1440_item', url: '/item/123', vp: { width: 1440, height: 900 } },
    { key: '1440_task', url: '/task', vp: { width: 1440, height: 900 } },
    { key: '1440_profile', url: '/profile', vp: { width: 1440, height: 900 } },
    { key: '390_home', url: '/', vp: { width: 390, height: 844 } },
    { key: '390_exchange', url: '/exchange', vp: { width: 390, height: 844 } },
    { key: '390_item', url: '/item/123', vp: { width: 390, height: 844 } },
  ]

  for (const p of PAGES) {
    const g = async (dist) => { const rr = await run(dist, p.vp, [{ key: 'k', url: p.url }]); return (rr && rr.k) || empty }
    const n1 = await g(NEW)
    const n2 = await g(NEW)
    const o1 = await g(OLD)
    const o2 = await g(OLD)
    const cRaw = diff(n1.raw, o1.raw)
    const cAlt = diff(n1.nrmAlt, o1.nrmAlt)
    const cAT = diff(n1.nrmAltTitle, o1.nrmAltTitle)
    out.pages[p.key] = {
      url: p.url, viewport: p.vp, visibleNew: n1.visibleCount, visibleOld: o1.visibleCount,
      repeat_new_raw: sha(n1.raw) === sha(n2.raw), repeat_new_alt: sha(n1.nrmAlt) === sha(n2.nrmAlt), repeat_new_altTitle: sha(n1.nrmAltTitle) === sha(n2.nrmAltTitle),
      repeat_old_raw: sha(o1.raw) === sha(o2.raw), repeat_old_alt: sha(o1.nrmAlt) === sha(o2.nrmAlt), repeat_old_altTitle: sha(o1.nrmAltTitle) === sha(o2.nrmAltTitle),
      cross_raw: cRaw.size, cross_nrm_alt: cAlt.size, cross_nrm_alt_title: cAT.size,
      cross_alt_aOnly: cAlt.aOnly.slice(0, 4), cross_alt_bOnly: cAlt.bOnly.slice(0, 4),
      cross_altTitle_aOnly: cAT.aOnly.slice(0, 4), cross_altTitle_bOnly: cAT.bOnly.slice(0, 4),
      panelPresentNew: n1.panelPresent, panelPresentOld: o1.panelPresent,
    }
  }

  // (a) 噪声根因具名：同版多轮
  const nr = []
  for (let i = 0; i < 6; i += 1) { const r6 = await run(NEW, { width: 1440, height: 900 }, [{ key: 'h', url: '/' }]); nr.push((r6 && r6.h) || empty) }
  out.noise = {
    page: '/', viewport: { w: 1440, h: 900 }, runs: nr.length,
    rawShaDistinct: [...new Set(nr.map((r) => sha(r.raw)))].length,
    altShaDistinct: [...new Set(nr.map((r) => sha(r.nrmAlt)))].length,
    altTitleShaDistinct: [...new Set(nr.map((r) => sha(r.nrmAltTitle)))].length,
    altTitleValuesPerRun: nr.map((r) => r.altTitle.map((v) => `${v.attr}=${v.value}`)),
    altTitleLocations: nr[0].altTitle,
    rawDiff_r1_r2: diff(nr[0].raw, nr[1].raw),
    altDiff_r1_r2: diff(nr[0].nrmAlt, nr[1].nrmAlt),
    altTitleDiff_r1_r2: diff(nr[0].nrmAltTitle, nr[1].nrmAltTitle),
  }

  // (c) 扰动臂
  const vp = { width: 1440, height: 900 }
  const injectHide = `(() => { const s = document.createElement('style'); s.textContent = '.sf-mp{display:none !important}'; document.head.appendChild(s); return document.querySelectorAll('.sf-mp').length })()`
  const injectExtra = `(() => { const d = document.createElement('div'); d.className = 'qa-extra-visible-element'; d.textContent = 'QA EXTRA'; const host = document.getElementById('sf-route-container') || document.body; host.appendChild(d); return host.contains(d) })()`
  const empty = { raw: [], nrmAlt: [], nrmAltTitle: [], altTitle: [], visibleCount: 0, panelPresent: null }
  const r = async (url, opts = {}) => { const rr = await run(NEW, vp, [{ key: 'k', url, ...opts }]); return (rr && rr.k) || empty }
  const aClosed = await r('/')
  const bOpen = await r('/?msg=1', { expectPanel: true })
  const cOpenHidden = await r('/?msg=1', { expectPanel: true, inject: injectHide })
  const dClosedInjected = await r('/', { inject: injectHide })
  const eClosedExtra = await r('/', { inject: injectExtra })
  const oldClosed = ((await run(OLD, vp, [{ key: 'k', url: '/' }])) || {}).k || empty
  out.arms = {
    counterfactual_closed_vs_open: { panelPresent: [aClosed.panelPresent, bOpen.panelPresent], diff_altTitle: diff(aClosed.nrmAltTitle, bOpen.nrmAltTitle).size, aOnly: diff(aClosed.nrmAltTitle, bOpen.nrmAltTitle).aOnly.slice(0, 6), bOnly: diff(aClosed.nrmAltTitle, bOpen.nrmAltTitle).bOnly.slice(0, 6) },
    counterfactual_oldClosed_vs_newOpen: { diff_altTitle: diff(oldClosed.nrmAltTitle, bOpen.nrmAltTitle).size },
    injection_hideOnClosedPage: { diff_altTitle: diff(aClosed.nrmAltTitle, dClosedInjected.nrmAltTitle).size, note: '未打开态无 .sf-mp ⇒ 注入无靶；归一化后差异集 = 0（预期）' },
    injection_hideOnOpenPage: { diff_altTitle: diff(bOpen.nrmAltTitle, cOpenHidden.nrmAltTitle).size, aOnly: diff(bOpen.nrmAltTitle, cOpenHidden.nrmAltTitle).aOnly.slice(0, 6), bOnly: diff(bOpen.nrmAltTitle, cOpenHidden.nrmAltTitle).bOnly.slice(0, 6), note: '打开态隐藏面板 ⇒ 面板子树消失' },
    injection_extraVisibleElementOnClosedPage: { diff_altTitle: diff(aClosed.nrmAltTitle, eClosedExtra.nrmAltTitle).size, aOnly: diff(aClosed.nrmAltTitle, eClosedExtra.nrmAltTitle).aOnly.slice(0, 4), bOnly: diff(aClosed.nrmAltTitle, eClosedExtra.nrmAltTitle).bOnly.slice(0, 4), note: '★ 对偶检验：在本判「0 差异」的同一页上注入一个额外可见元素 ⇒ 差异集**必须非空**（否则该页的 0 是尺子瞎了）' },
    rulerHasResolution: diff(aClosed.nrmAltTitle, bOpen.nrmAltTitle).size > 0 && diff(bOpen.nrmAltTitle, cOpenHidden.nrmAltTitle).size > 0 && diff(aClosed.nrmAltTitle, eClosedExtra.nrmAltTitle).size > 0,
  }

  const mNew = await r('/messages', { expectPanel: true })
  const mOld = ((await run(OLD, vp, [{ key: 'k', url: '/messages' }])) || {}).k || empty
  const md = diff(mNew.nrmAltTitle, mOld.nrmAltTitle)
  out.messagesDirect = { note: 'AC-5 口径外 · 单列（/messages 语义变更是本单设计意图）', diffSize: md.size, newOnly: md.aOnly.slice(0, 14), oldOnly: md.bOnly.slice(0, 14), visibleNew: mNew.visibleCount, visibleOld: mOld.visibleCount }

  out.finishedAt = new Date().toISOString()
  return out
}

main().then((out) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); console.log('WROTE', OUT); console.log('pageErrors', JSON.stringify(out.pageErrors)); console.log('runAnomalies', JSON.stringify(out.runAnomalies)); }).catch((e) => { console.error('PROBE_FAILED', e); process.exit(1) })
