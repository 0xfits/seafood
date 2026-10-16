#!/usr/bin/env node
/**
 * v1.19 §21 · **AC-5 归因式读数**：面板**未打开**时宿主页与**改前**（`fd34ca0` 产物）逐元素差异集
 * ------------------------------------------------------------------------------------------
 * 配方（承 §13 归因配方 / 仓内先例 `p4z-b4c-geometry.mjs`）：
 *   · 两个 dist 各自用 `page.route` 映射到 `http://sf.local/**`（同一把尺、同一份外部资源阻断集）；
 *   · **`/api/messages/**` 一律由探针内夹具自截**（`page.route` 内存 JSON，零后端、**零库写**）；
 *     登录态只走 `localStorage` 种子（`addInitScript`）⇒ 两版对照面完全同源；
 *   · **禁动画**（`reducedMotion:'reduce'`）+ 稳态采样（连续 ≥3 帧读数逐字节相同）；
 *   · 结构键 = 标签 + 语义属性（`data-sf-*` / `id` / `role` / `aria-*` / `href` / `name` / `placeholder` / `alt`）
 *     + 结构路径 `#root/i/j` + `getBoundingClientRect`（0.1 精度）+ 可见性；**只采可见元素**
 *     （`display:none` / `visibility:hidden` / `opacity:0` / 零尺寸一律不计）；
 *     **键内不含坐标别名**（坐标是键的一个**字段**，键主体 = 标签 + 全属性 + 路径序号）。
 *   · **(b) 尺子可重复性噪声基线**：同一 dist 同一页连采两次 ⇒ 归一化键集 `sha256` 必须相同；
 *   · **(c) 尺子灵敏度自证（两条，缺一不可）**：
 *       c1 反事实：改后「打开面板」态 vs 改前基线 ⇒ 差异集**必须非空**；
 *       c2 同页微扰：改后「打开面板」态 vs **同态 + 注入 `.sf-mp{display:none}`（面板强制隐藏）**
 *          ⇒ 差异集**必须非空**（否则「差异集 = 0」可能只是尺子无分辨力）。
 * 用法：node probe-attribution.mjs <distNew> <distOld> <outJson>
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

// playwright 装在 `frontend/node_modules`（本脚本落在 `ops/` 下 ⇒ 无本地 node_modules）：
// 用 `createRequire` 锚到前端包根解析，避免依赖运行 cwd / NODE_PATH。
const FRONTEND_ROOT = process.env.SF_FRONTEND_ROOT || '/Users/kevin/bistro/seafood/frontend'
const { chromium } = createRequire(path.join(FRONTEND_ROOT, 'package.json'))('playwright')

const DIST_NEW = path.resolve(process.argv[2])
const DIST_OLD = path.resolve(process.argv[3])
const OUT = path.resolve(process.argv[4] || '/Users/kevin/bistro/seafood/ops/v119-msg-panel/readings/attribution.json')
const NORM_OUT = OUT.replace(/\.json$/, '') + '.normalized.json'
const ORIGIN = 'http://sf.local'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' }

// ================= 探针内夹具（与 probe-geometry.mjs 逐字同源；零库写） =================
const MY_UID = 970213
const UNREAD_TOTAL = 250
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
    if (p === '/api/messages/conversations' && method === 'GET') return route.fulfill(ok({ rows: CONV_ROWS, next_cursor: null }))
    if (p === '/api/messages/conversations' && method === 'POST') return route.fulfill(ok({ conversation_id: 7, listing_id: 123, created: false }))
    if (/^\/api\/messages\/conversations\/[^/]+\/messages$/.test(p)) {
      if (method === 'POST') return route.fulfill(ok({ msg_id: 903 }))
      return route.fulfill(ok({ conversation: CONVERSATION, rows: THREAD_ROWS, next_before_msg_id: null }))
    }
    if (/^\/api\/messages\/conversations\/[^/]+\/read$/.test(p)) return route.fulfill(ok({ last_read_msg_id: 902 }))
    return route.fulfill(ok({}))
  })
}

const AUTH_INIT = `(() => { try {
  localStorage.setItem('user', JSON.stringify({ uID: ${MY_UID}, uid: ${MY_UID}, token: 'probe-token-zang-v119', access_token: 'probe-token-zang-v119', bio: 'probe' }))
  localStorage.setItem('token', 'probe-token-zang-v119')
} catch (e) {} })()`

const SIG = `(() => {
  const SHAPE = ['class','href','id','role','type','aria-current','aria-label','aria-hidden','data-sf-region','data-sf-nav','data-sf-shell','data-sf-m','data-sf-phase','data-sf-fm','name','placeholder','alt']
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false
    const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
  const keys = []            // ★ 结构键：标签 + 全 class + 语义属性 + 结构路径序号（**不含坐标**）
  const rects = {}           // 坐标 / 尺寸**另存**（键 = 同一结构键）⇒ 不掺进键
  const walk = (el, p) => {
    Array.from(el.children).forEach((child, i) => {
      const path = p + '/' + i
      const tag = child.tagName
      if (visible(child)) {
        const attrs = SHAPE.map((a) => { const v = child.getAttribute(a); return v === null ? null : a + '=' + v }).filter(Boolean).sort()
        const k = [tag, path, attrs.join(',')].join('|')
        keys.push(k)
        const b = child.getBoundingClientRect()
        rects[k] = [+b.x.toFixed(1), +b.y.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)].join(',')
      } else {
        keys.push([tag, path, 'INVISIBLE'].join('|'))
      }
      walk(child, path)
    })
  }
  const root = document.getElementById('root')
  if (root) walk(root, '#root')
  return JSON.stringify({ keys, rects, count: keys.length, url: location.pathname + location.search,
    regions: Array.from(document.querySelectorAll('[data-sf-region]')).map((e) => e.getAttribute('data-sf-region')),
    panelPresent: !!document.querySelector('[data-sf-m="messages-panel"]'),
    elementCount: document.querySelectorAll('*').length,
    scrollHeight: document.documentElement.scrollHeight })
})()`

// 禁动画（承 §13 归因配方）：`reducedMotion:'reduce'` + 注入禁 `animation` / `transition`。
// 动机（本单实测）：`/` 上存在一个**未受 `prefers-reduced-motion` 保护**的 CSS 动画元素
// （`class=go1858758034`，`15.8×15.8` @ `x≈1159`）⇒ 其 rect 逐帧抖动（`1158.7…1160.6`），
// 不注入则该页签名**永不稳态**（实测 40 轮不收敛）。注入后 raw 签名逐字节稳态（实测 8 连读 `rawDiff=0`）。
const FREEZE = '*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}'

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')

const main = async () => {
  const evidence = {
    startedAt: new Date().toISOString(), distNew: DIST_NEW, distOld: DIST_OLD,
    zeroDbWrite: true, fixtures: { apiSource: 'page.route in-probe JSON (no backend)', authSource: 'localStorage only', unreadTotal: UNREAD_TOTAL },
    pages: {}, notes: [],
  }
  const browser = await chromium.launch({ executablePath: CHROME })

  const mkPage = async (dist) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    await context.addInitScript(AUTH_INIT)
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== ORIGIN) return route.abort()
      let file = path.join(dist, decodeURIComponent(url.pathname))
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
      return route.fulfill({ path: file, contentType: MIME[path.extname(file)] || 'application/octet-stream' })
    })
    await installFixtures(context)   // ★ 后注册 ⇒ 优先级更高
    const page = await context.newPage()
    const errs = []
    const cerrs = []
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)))
    page.on('console', (m) => { if (m.type() === 'error') cerrs.push(String(m.text()).slice(0, 300)) })
    return { context, page, errs, cerrs }
  }

  const newSide = await mkPage(DIST_NEW)
  const oldSide = await mkPage(DIST_OLD)

  // 等待选择器（`null` = 不等待）；旧版无面板 ⇒ 直链态等的是旧页钩子 `messages-page`。
  const measure = async (side, url, vp, waitSelector = null, injectPanelHidden = false) => {
    await side.page.setViewportSize(vp)
    await side.page.goto(`${ORIGIN}${url}`, { waitUntil: 'load' })
    await side.page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, null, { timeout: 20000 })
    await side.page.evaluate(() => document.fonts.ready)
    if (waitSelector) await side.page.waitForSelector(waitSelector, { timeout: 10000 })
    await side.page.addStyleTag({ content: FREEZE })            // ★ 禁动画（承 §13 配方；必注入，见 FREEZE 注释）
    if (injectPanelHidden) await side.page.addStyleTag({ content: '.sf-mp{display:none !important}' })
    // 稳态：连续 ≥3 帧读数逐字节相同
    let prev = null
    for (let i = 0; i < 40; i += 1) {
      const cur = await side.page.evaluate(SIG)
      if (prev && prev === cur) return JSON.parse(cur)
      prev = cur
      await side.page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))))
    }
    throw new Error(`unstable signature: ${url}`)
  }

  const diff = (a, b) => {
    const sa = new Set(a.keys); const sb = new Set(b.keys)
    const onlyOld = [...sa].filter((k) => !sb.has(k)).sort()
    const onlyNew = [...sb].filter((k) => !sa.has(k)).sort()
    return {
      onlyOld: onlyOld.length, onlyNew: onlyNew.length, total: onlyOld.length + onlyNew.length,
      sample: [...onlyOld.slice(0, 8).map((k) => `OLD_ONLY ${k}`), ...onlyNew.slice(0, 8).map((k) => `NEW_ONLY ${k}`)],
    }
  }
  // 归一化 = 结构面 + 几何面（坐标另存于 `rects`，键 = 结构键）—— 去掉一切时间 / 进程面。
  // 因 `FREEZE` 已冻动画 ⇒ 几何面亦逐字节稳态，故一并纳入归一化（尺子更强：结构 + 几何双面可重复）。
  const normalize = (r) => JSON.stringify({
    keyCount: r.keys.length,
    keys: [...r.keys].sort(),
    rects: Object.entries(r.rects).sort(),
    regions: r.regions,
    panelPresent: r.panelPresent,
    elementCount: r.elementCount,
  })
  const rectDigest = (r) => sha256(JSON.stringify(Object.entries(r.rects).sort()))

  const vps = [{ width: 1440, height: 900, tag: '1440' }, { width: 390, height: 844, tag: '390' }]
  const urls = ['/', '/exchange', '/item/123', '/messages']
  const digests = { old: {}, new: {} }
  const normPages = {}

  for (const vp of vps) {
    for (const url of urls) {
      const isMessages = url === '/messages'          // 直链落点：**打开态**（两侧语义本就不同 ⇒ 不作归因基准）
      const key = `${vp.tag}${url}`
      // 两侧等待钩子不同：旧版 `/messages` = 独立真页（`messages-page`）；新版 = 面板（`messages-panel`）。
      const waitOld = isMessages ? '[data-sf-m="messages-page"]' : null
      const waitNew = isMessages ? '[data-sf-m="messages-panel"]' : null
      const oldA = await measure(oldSide, url, vp, waitOld)
      const oldB = await measure(oldSide, url, vp, waitOld)
      const newA = await measure(newSide, url, vp, waitNew)
      const newB = await measure(newSide, url, vp, waitNew)
      const oldHashA = sha256(normalize(oldA)); const oldHashB = sha256(normalize(oldB))
      const newHashA = sha256(normalize(newA)); const newHashB = sha256(normalize(newB))
      digests.old[key] = oldHashA; digests.new[key] = newHashA
      normPages[key] = {
        url, viewport: vp.tag, opened: isMessages,
        old: { keys: [...oldA.keys].sort(), rects: Object.entries(oldA.rects).sort(), regions: oldA.regions, panelPresent: oldA.panelPresent, elementCount: oldA.elementCount },
        new: { keys: [...newA.keys].sort(), rects: Object.entries(newA.rects).sort(), regions: newA.regions, panelPresent: newA.panelPresent, elementCount: newA.elementCount },
      }
      evidence.pages[key] = {
        url, viewport: vp.tag, opened: isMessages,
        rulerRepeatable: {
          old: oldHashA === oldHashB, new: newHashA === newHashB,
          oldSha256: [oldHashA, oldHashB], newSha256: [newHashA, newHashB],
          oldRectDigest: [rectDigest(oldA), rectDigest(oldB)], newRectDigest: [rectDigest(newA), rectDigest(newB)],
          geometricallyRepeatable: rectDigest(oldA) === rectDigest(oldB) && rectDigest(newA) === rectDigest(newB),
        },
        panelPresent: { old: oldA.panelPresent, new: newA.panelPresent },
        regions: { old: oldA.regions, new: newA.regions },
        elementCount: { old: oldA.elementCount, new: newA.elementCount },
        visibleKeyCount: { old: oldA.keys.length, new: newA.keys.length },
        diff_old_vs_new: diff(oldA, newA),
        diff_repeat_control: {
          oldA_vs_oldB: diff(oldA, oldB).total, newA_vs_newB: diff(newA, newB).total,
          oldRepeatShaEqual: oldHashA === oldHashB, newRepeatShaEqual: newHashA === newHashB,
        },
        rectDiff_old_vs_new: (() => {
          const ea = Object.entries(oldA.rects); const eb = Object.entries(newA.rects)
          const ma = new Map(ea); const mb = new Map(eb)
          const moved = [...ma.keys()].filter((k) => mb.has(k) && mb.get(k) !== ma.get(k))
          return { movedCount: moved.length, sample: moved.slice(0, 5).map((k) => `${k} @ ${ma.get(k)} -> ${mb.get(k)}`) }
        })(),
      }
    }
  }

  // ---------- (c1) 反事实（尺子灵敏度 · 改后打开态 vs 改前基线）⇒ 必须非空 ----------
  const oldHome = await measure(oldSide, '/', { width: 1440, height: 900 }, null)
  const newOpen = await measure(newSide, '/?msg=1', { width: 1440, height: 900 }, '[data-sf-m="messages-panel"]')
  evidence.counterfactual = {
    oldUrl: oldHome.url, newUrl: newOpen.url,
    oldPanelPresent: oldHome.panelPresent, newPanelPresent: newOpen.panelPresent,
    diff: diff(oldHome, newOpen),
    verdict_nonEmpty: diff(oldHome, newOpen).total > 0,
  }

  // ---------- (c2) 同页微扰（面板强制隐藏）⇒ 必须非空 ----------
  const sameOpen = await measure(newSide, '/?msg=1', { width: 1440, height: 900 }, '[data-sf-m="messages-panel"]')
  const openHidden = await measure(newSide, '/?msg=1', { width: 1440, height: 900 }, '[data-sf-m="messages-panel"]', true)
  evidence.sensitivity = {
    method: 'same dist, same url (/?msg=1), same viewport; only perturbation = injected `.sf-mp{display:none !important}`',
    normalPanelPresent: sameOpen.panelPresent,
    hiddenPanelPresent: openHidden.panelPresent,
    normalKeys: sameOpen.keys.length, hiddenKeys: openHidden.keys.length,
    diff: diff(sameOpen, openHidden),
    verdict_nonEmpty: diff(sameOpen, openHidden).total > 0,
  }

  evidence.pageErrors = { new: newSide.errs, old: oldSide.errs }
  evidence.consoleErrors = { new: newSide.cerrs, old: oldSide.cerrs }
  evidence.normalization = { formula: 'sha256(JSON({keyCount, keys(sorted), regions, panelPresent, elementCount}))', perPageSha256: digests }
  const normDoc = { distNew: DIST_NEW, distOld: DIST_OLD, pages: normPages, counterfactual: { oldUrl: oldHome.url, newUrl: newOpen.url, total: evidence.counterfactual.diff.total }, sensitivity: { total: evidence.sensitivity.diff.total } }
  const normText = JSON.stringify(normDoc, null, 2)
  evidence.normalizedFile = NORM_OUT
  evidence.normalizedSha256 = sha256(normText)
  evidence.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2))
  fs.writeFileSync(NORM_OUT, normText)
  await browser.close()

  const summary = {}
  let attributionZero = true
  for (const [k, v] of Object.entries(evidence.pages)) {
    summary[k] = { diff: v.diff_old_vs_new.total, repeatable: v.rulerRepeatable.old && v.rulerRepeatable.new, panel: v.panelPresent }
    if (v.url !== '/messages' && v.diff_old_vs_new.total !== 0) attributionZero = false
  }
  summary.counterfactual_total = evidence.counterfactual.diff.total
  summary.sensitivity_total = evidence.sensitivity.diff.total
  summary.attributionZeroOnUnopened = attributionZero
  summary.normalizedSha256 = evidence.normalizedSha256
  summary.pageErrors = evidence.pageErrors
  console.log(JSON.stringify({ out: OUT, normOut: NORM_OUT, summary }, null, 2))
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exitCode = 1 })
