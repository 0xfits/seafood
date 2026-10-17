/**
 * Neng 独立质检 v1.21 —— 腿 3：AC-9 零几何（父版 worktree 对照 · 8 档）+ 噪声基线 + AC-5 归因式不动面
 *   采数口径承 frontend-parity-acceptance §13：禁动画 / 只采可见元素 / 结构键不入坐标 / 加载期随机源声明式归一化。
 *   父版 = git worktree @ 4b388d0 独立 build（不 npm install · node_modules 软链挂 frontend/ 子目录）。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const HOSTNAME = 'sf.local'
const CUR_DIST = path.join(REPO, 'frontend/dist')
const PARENT_DIST = '/Users/kevin/.hermes/profiles/zang/cache/scratch/neng-v121/parent/frontend/dist'
const OUT_GEO = path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-geometry.json')
const OUT_ATTRIB = path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-attrib.json')
const require_ = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require_('playwright')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }
const PRIZES = [
  { bID: 1, name: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修', description: '自用一年，电池健康度 91%，原装盒与充电线齐全', points: 29, stores_count: 3, claims_count: 12, image_url: '', url_image: '' },
  { bID: 2, name: '全新未拆封 罗技 MX Master 3S 无线鼠标', description: '年会奖品，包装完好未拆封', points: 6600, stores_count: 1, claims_count: 2, gift_limit: 5 },
  { bID: 3, name: '自用一年 MacBook Air M2 13 英寸 星空色', description: '循环次数 88 次，附原装 35W 双口充电器', points: 3200, stores_count: 0, claims_count: 0, time_end: '2026-12-31' },
]
const TASKS = [{ tID: 1, title: '招募：周末市集摊位布展协助', note: '六日两天 10:00-16:00', is_open: true, points: 10, participants_count: 3 }]
const data = (d) => ({ success: true, data: d })
const apiResponse = (method, p) => {
  if (p === '/api/home') return data({ tasks: TASKS, prizes: PRIZES, claimed_prize_ids: [], user_points: 0 })
  if (p.startsWith('/api/task/all')) return data(TASKS)
  if (p.startsWith('/api/prize/all')) return data(PRIZES)
  if (p === '/api/prize-item') return data([])
  if (p.startsWith('/api/prize/')) return data(PRIZES.find((x) => String(x.bID) === p.split('/').pop()) || null)
  if (p === '/api/messages/unread-count') return data({ unread_total: 0 })
  if (p === '/api/messages') return data({ threads: [], next_cursor: null, total: 0 })
  if (method === 'GET') return data({ rows: [], next_cursor: null, total: 0 })
  return data({})
}
async function open(browser, { theme, width, height, dist }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'zh-CN' })
  if (theme) await context.addInitScript(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url())
    if (u.hostname !== HOSTNAME) return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    const rel = decodeURIComponent(u.pathname); let file = path.join(dist, rel)
    if (!path.resolve(file).startsWith(path.resolve(dist))) return route.fulfill({ status: 403, body: '' })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(dist, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
  return { context, page: await context.newPage() }
}
async function settle(page, max = 90) {
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
async function goto(page, url, waitSel) {
  await page.goto(ORIGIN + url, { waitUntil: 'load' }); await settle(page)
  if (waitSel) { try { await page.waitForSelector(waitSel, { timeout: 8000 }) } catch (e) {} }
  await settle(page)
}

const COLLECT = `(() => {
  const round = (n) => Math.round(n * 100) / 100
  const STYLE_PROPS = ['backgroundColor','color','borderTopColor','borderBottomColor','borderLeftColor','borderRightColor','borderTopWidth','borderBottomWidth','borderLeftWidth','boxShadow','outlineColor','filter','opacity','backdropFilter','fontSize','fontWeight']
  const out = []
  const seq = new Map()
  for (const el of document.querySelectorAll('body *')) {
    if (el.getClientRects().length === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '')
    const base = el.tagName + '#' + cls
    const n = (seq.get(base) || 0); seq.set(base, n + 1)
    const r = el.getBoundingClientRect()
    const attrs = {}
    for (const a of el.attributes) { if (a.name === 'style' || a.name === 'class' || a.name === 'd') continue; attrs[a.name] = a.value }
    const style = {}; for (const p of STYLE_PROPS) style[p] = cs[p]
    out.push({ key: base + '~' + n, tag: el.tagName, cls, id: el.id || '', inHeader: !!el.closest('#header'),
      attrs, rect: [round(r.x), round(r.y), round(r.width), round(r.height)], style,
      text: (el.children.length === 0 ? (el.textContent || '').trim().slice(0, 60) : '') })
  }
  const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return [round(r.x), round(r.y), round(r.width), round(r.height)] }
  return { pathname: location.pathname, theme: document.documentElement.getAttribute('data-theme'),
    viewport: { w: window.innerWidth, h: window.innerHeight }, visibleCount: out.length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
    rects: { header: pick('#header'), topRegion: pick('.sf-region-top'), routeContainer: pick('.sf-route-container'), shell: pick('.sf-shell') },
    elements: out }
})()`

// 声明式归一化：Footer.jsx:12 模块加载期 Math.random() ⇒ <img alt>/<a title> 每载不同（噪声源具名）
function normalize(s) {
  return { ...s, elements: s.elements.map((e) => { const a = { ...e.attrs }; if ('alt' in a) a.alt = '<N>'; if ('title' in a) a.title = '<N>'; return { ...e, attrs: a } }) }
}
const snapshot = async (browser, opts, url) => {
  const { context, page } = await open(browser, opts)
  await goto(page, url, '#header')
  const snap = await page.evaluate(COLLECT)
  await context.close()
  return snap
}
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex')

function diff(cur, par) {
  const mapC = new Map(cur.elements.map((e) => [e.key, e])); const mapP = new Map(par.elements.map((e) => [e.key, e]))
  const onlyC = [...mapC.keys()].filter((k) => !mapP.has(k)); const onlyP = [...mapP.keys()].filter((k) => !mapC.has(k))
  const pairBy = (keysSrc, mapSrc, mapOther) => { // 用 (tag|rect|text) 配对（位移不掺键）
    const out = []
    for (const k of keysSrc) { const e = mapSrc.get(k); const cand = [...mapOther.entries()].find(([k2, o]) => { if (!keysSrc.includes(k2)) return false; return false }) ; void cand; void e }
    return out
  }
  void pairBy
  const styles = []; const rects = []; const attrs = []; const texts = []
  const details = []
  for (const [k, c] of mapC) {
    const p = mapP.get(k); if (!p) continue
    const f = []
    if (JSON.stringify(c.rect) !== JSON.stringify(p.rect)) { f.push('rect'); rects.push(k) }
    for (const s of Object.keys(c.style)) if (c.style[s] !== p.style[s]) f.push('style.' + s)
    if (c.style.backgroundColor !== p.style.backgroundColor || c.style.color !== p.style.color || c.style.borderBottomColor !== p.style.borderBottomColor) styles.push(k)
    if (JSON.stringify(c.attrs) !== JSON.stringify(p.attrs)) { f.push('attrs'); attrs.push(k) }
    if (c.text !== p.text) { f.push('text'); texts.push(k) }
    if (f.length) details.push({ key: k, fields: f, inHeader: c.inHeader, styleCur: c.style, stylePar: p.style, rectCur: c.rect, rectPar: p.rect })
  }
  // 未配对（键变：class 差异）→ 按 (tag|rect|text) 配对
  const unpairedC = onlyC.map((k) => mapC.get(k)); const unpairedP = onlyP.map((k) => mapP.get(k))
  const pairedMoved = []
  for (const c of unpairedC) {
    const i = unpairedP.findIndex((p) => p.tag === c.tag && JSON.stringify(p.rect) === JSON.stringify(c.rect) && p.text === c.text && !p.__used)
    if (i >= 0) {
      const p = unpairedP[i]; p.__used = true
      const f = []
      for (const s of Object.keys(c.style)) if (c.style[s] !== p.style[s]) f.push('style.' + s)
      if (JSON.stringify(c.attrs) !== JSON.stringify(p.attrs)) f.push('attrs')
      pairedMoved.push({ keyCur: c.key, keyPar: p.key, fields: f, inHeader: c.inHeader, clsCur: c.cls, clsPar: p.cls, styleCur: c.style, stylePar: p.style, rectCur: c.rect, rectPar: p.rect, text: c.text })
    }
  }
  const unmatchedC = unpairedC.filter((c) => !pairedMoved.some((m) => m.keyCur === c.key))
  const unmatchedP = unpairedP.filter((p) => !p.__used)
  return { onlyCur: onlyC, onlyPar: onlyP, pairedMoved, unmatchedCur: unmatchedC.map((e) => e.key), unmatchedPar: unmatchedP.map((e) => e.key), details, counts: { rect: rects.length, style: styles.length, attrs: attrs.length, text: texts.length, onlyCur: onlyC.length, onlyPar: onlyP.length, paired: pairedMoved.length, unmatchedCur: unmatchedC.length, unmatchedPar: unmatchedP.length } }
}

function attribClassify(d, headerBgOK) {
  const allowed = []; const unexpected = []
  for (const m of d.pairedMoved) {
    const isBrand = /sf-topbar-brand|sf-topbar-hover-brand-fg/.test(m.clsCur) || /text-yellow-600|text-yellow-400/.test(m.clsPar)
    const onlyColor = m.fields.every((f) => f === 'style.color' || f === 'attrs')
    const noRect = JSON.stringify(m.rectCur) === JSON.stringify(m.rectPar)
    if (m.inHeader && isBrand && onlyColor && noRect) allowed.push({ ...m, why: 'T119② 由顶栏底色承载的前景（class 互换 = 落地实现）' })
    else unexpected.push({ ...m, why: 'not-attributable' })
  }
  for (const dt of d.details) {
    const f = dt.fields
    const onlyChrome = f.every((x) => f.length && ['style.backgroundColor', 'style.color', 'style.borderBottomColor', 'style.backgroundImage', 'style.backdropFilter', 'style.opacity'].includes(x))
    if (headerBgOK && dt.inHeader && onlyChrome) allowed.push({ ...dt, why: 'T119① 顶栏底色/边框色（含 backdrop/opacity 接住）' })
    else unexpected.push({ ...dt, why: 'not-attributable' })
  }
  return { allowed, unexpected }
}

const RESULT = { meta: { curDist: CUR_DIST, parentDist: PARENT_DIST }, noise: {}, geometry: {}, attrib: {}, counterfactual: {} }
const t0 = Date.now(); const log = (...a) => console.log('[leg3]', ((Date.now() - t0) / 1000).toFixed(1) + 's', ...a)

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] })
try {
  // ---- 噪声基线：同版（现版）'/'-1440-light 两轮，归一化 sha 必须相同 ----
  const n1 = normalize(await snapshot(browser, { theme: 'light', width: 1440, height: 1000, dist: CUR_DIST }, '/'))
  const n2 = normalize(await snapshot(browser, { theme: 'light', width: 1440, height: 1000, dist: CUR_DIST }, '/'))
  const n1raw = await snapshot(browser, { theme: 'light', width: 1440, height: 1000, dist: CUR_DIST }, '/')
  const n2raw = await snapshot(browser, { theme: 'light', width: 1440, height: 1000, dist: CUR_DIST }, '/')
  RESULT.noise = {
    normRound1: sha(n1), normRound2: sha(n2), normEqual: sha(n1) === sha(n2),
    rawRound1: sha(n1raw), rawRound2: sha(n2raw), rawEqual: sha(n1raw) === sha(n2raw),
    normDiff: diff(n1, n2), noiseSource: 'frontend/src/components/Footer.jsx:12 模块加载期 Math.random() ⇒ <img alt>/<a title>',
  }
  log('noise', RESULT.noise.normEqual, RESULT.noise.rawEqual, JSON.stringify(RESULT.noise.normDiff.counts))

  // ---- AC-9 / AC-5：矩阵 ----
  const MATRIX = []
  for (const theme of ['light', 'dark']) for (const w of [390, 1440, 1600]) MATRIX.push({ theme, w, url: '/' })
  MATRIX.push({ theme: 'light', w: 375, url: '/' }, { theme: 'light', w: 320, url: '/' })
  MATRIX.push({ theme: 'dark', w: 375, url: '/' }, { theme: 'dark', w: 320, url: '/' })
  const ROUTES = ['/task', '/exchange', '/profile', '/messages', '/item/1']
  for (const url of ROUTES) for (const theme of ['light', 'dark']) MATRIX.push({ theme, w: 1440, url })

  for (const m of MATRIX) {
    const opts = { theme: m.theme, width: m.w, height: m.w <= 390 ? 900 : 1000 }
    const c = normalize(await snapshot(browser, { ...opts, dist: CUR_DIST }, m.url))
    const p = normalize(await snapshot(browser, { ...opts, dist: PARENT_DIST }, m.url))
    const d = diff(c, p)
    const key = `${m.url}|${m.theme}|${m.w}`
    const entry = {
      key, url: m.url, theme: m.theme, w: m.w,
      curRects: c.rects, parRects: p.rects,
      rectEqual: JSON.stringify(c.rects) === JSON.stringify(p.rects),
      visibleCount: c.visibleCount, visibleCountParent: p.visibleCount,
      docOverflow: c.docOverflow, pageHeight: c.pageHeight, pageHeightParent: p.pageHeight,
      diffCounts: d.counts,
    }
    const cls = attribClassify(d, true)
    entry.allowed = cls.allowed.map((x) => ({ key: x.key || x.keyCur, why: x.why, fields: x.fields }))
    entry.unexpected = cls.unexpected.map((x) => ({ key: x.key || x.keyCur, why: x.why, fields: x.fields, inHeader: x.inHeader, styleCur: x.styleCur, stylePar: x.stylePar }))
    RESULT.geometry[key] = entry
    log('MATRIX', key, 'rectEqual', entry.rectEqual, 'counts', JSON.stringify(d.counts), 'unexpected', entry.unexpected.length)
    if (entry.unexpected.length) log('   >>> unexpected detail', JSON.stringify(entry.unexpected).slice(0, 800))
  }

  // ---- 反事实臂（日 / 夜两档分别回退；含 3 个 class 字面复原）----
  for (const theme of ['light', 'dark']) {
    const { context, page } = await open(browser, { theme, width: 1440, height: 1000, dist: CUR_DIST })
    await goto(page, '/', '#header')
    const before = normalize(await page.evaluate(COLLECT))
    const injected = await page.evaluate((th) => {
      const day = th !== 'dark'
      const css = day
        ? `html:not([data-theme="dark"]) #header{background-color:rgba(255,255,255,0.95)!important;background-image:none!important;border-bottom-color:rgb(229,231,235)!important;opacity:1!important;backdrop-filter:blur(4px)!important;-webkit-backdrop-filter:blur(4px)!important}
html:not([data-theme="dark"]) #header .sf-topbar-brand{color:rgb(202,138,4)!important}
html:not([data-theme="dark"]) #header .sf-topbar-hover-brand-fg:hover{color:rgb(202,138,4)!important}
html:not([data-theme="dark"]) #header .nav-link:hover,html:not([data-theme="dark"]) #header .nav-link.active{color:#d97706!important}`
        : `html[data-theme="dark"] #header{background-color:rgb(31,41,55)!important;border-bottom-color:rgb(55,65,81)!important;backdrop-filter:blur(4px)!important}`
      const st = document.createElement('style'); st.id = 'neng-cf'; st.textContent = css; document.head.appendChild(st)
      // class 字面复原（测量期 DOM 变更 · 已披露）
      const restored = []
      document.querySelectorAll('#header .sf-topbar-brand, #header .sf-topbar-hover-brand-fg').forEach((el, i) => {
        const orig = el.className.replace(/\s*sf-topbar-brand\s*/g, ' ').replace(/\s*sf-topbar-hover-brand-fg\s*/g, ' ').trim()
        let next
        if (el.classList.contains('sf-topbar-brand')) next = orig + ' text-yellow-600 dark:text-yellow-400'
        else next = orig.replace('transition-colors', 'hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors')
        el.setAttribute('class', next); restored.push({ i, next })
      })
      return { cssInjected: !!document.getElementById('neng-cf'), restored }
    }, theme)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const after = normalize(await page.evaluate(COLLECT))
    const headerNow = await page.evaluate(`(()=>{const e=document.getElementById('header');const c=getComputedStyle(e);return {bg:c.backgroundColor,bd:c.borderBottomColor,bf:c.backdropFilter,op:c.opacity}})()`)
    const parSnap = normalize(await snapshot(browser, { theme, width: 1440, height: 1000, dist: PARENT_DIST }, '/'))
    const dCf = diff(after, parSnap)
    RESULT.counterfactual[theme] = {
      injected, headerAfterRevert: headerNow,
      headerBefore: (await page.evaluate(`(()=>{const e=document.getElementById('header');const c=getComputedStyle(e);return {bg:c.backgroundColor}})()`)),
      diffVsParent: dCf.counts, unexpected: dCf.counts.onlyCur + dCf.counts.onlyPar + dCf.details.length + dCf.pairedMoved.length,
      detail: { onlyCur: dCf.onlyCur.slice(0, 8), onlyPar: dCf.onlyPar.slice(0, 8), details: dCf.details.slice(0, 8), paired: dCf.pairedMoved.slice(0, 8) },
      counterfactualEmpty: dCf.counts.onlyCur === 0 && dCf.counts.onlyPar === 0 && dCf.details.length === 0 && dCf.pairedMoved.length === 0,
      beforeCounts: before.visibleCount,
    }
    log('CF', theme, 'empty=', RESULT.counterfactual[theme].counterfactualEmpty, JSON.stringify(dCf.counts), JSON.stringify(headerNow))
    await context.close()
  }

  fs.writeFileSync(OUT_GEO, JSON.stringify(RESULT, null, 2))
  fs.writeFileSync(OUT_ATTRIB, JSON.stringify({ noise: RESULT.noise, counterfactual: RESULT.counterfactual, matrix: RESULT.geometry }, null, 2))
  log('WROTE', OUT_GEO, OUT_ATTRIB)
} finally { await browser.close() }
