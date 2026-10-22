/**
 * 顶栏三菜单项 + 「订单」按钮：像素图图标 + 文案 + 管理面板去紫底（Kevin 2026-10-21 需求②/③ + 2026-10-22 像素图单）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 桌面左 nav 三项（管理员档）+ 右上「订单」按钮逐项：含 `<img>` 且 **src 逐一对拍**
 *      （悬赏=nav-bounty 贝壳 / 市场=nav-market 鲸鱼 / 管理面板=nav-admin 章鱼 / 订单=nav-orders 龙虾）、
 *      18×18、`imageRendering: pixelated`、alt="" + aria-hidden；文案非空；
 *   ② 「悬赏」项文案 = 当前语种 `task` 键值（zh「悬赏」），且 nav 全量文案**不含**「悬赏中心」
 *      （页面标题 `taskPage.title` 另断：必须仍为「悬赏中心」）；en 档同断 src 集；
 *   ③ `/icons/nav/*.png` 图片请求全部 200 且 content-type = image/png；
 *   ④ 管理面板按钮与其它两项**同款**：`backgroundColor` / `color` / `padding` / `borderRadius` /
 *      `fontSize` / `fontWeight` / 高度逐值相等（负控：紫底回填 ⇒ 必须转红）；
 *   ⑤ 390 / 1536 两档：`scrollWidth - clientWidth = 0`、零 pageerror / 零 console error；
 *      顶栏高度 65px 不变（h-16 64 + 1px 下边框；换图不得撑高头部）。
 *      390 档加开汉堡面板：面板内 `nav-*` img src 同步断言（移动面板同步的探针侧证据）。
 *
 * 手法（同 ops/profile-nav/probe-profile-nav.mjs 体例）：
 *   · 静态服务 = context.route 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（EVM = 合约管理员地址）+ `/api/admin/me` 自截 ⇒ 三项齐；
 *   · 负控臂 PROBE_NEG=1 ⇒ 四突变：① 管理项染回紫底；② 「悬赏」文案改回「悬赏中心」；
 *     ③ 悬赏项图标「改回 lucide」（img 摘除换 svg）；④ 市场项「换错图」（src 改指贝壳图）
 *     —— 对应判据必须全部转红。
 *
 * 用法：QA_DIST=<dist> [PROBE_NEG=1] node probe-header-nav.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/header-nav/readings/probe-header-nav.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const NEG = process.env.PROBE_NEG === '1'

const readLocale = (lang, ref) => JSON.parse(
  ref
    ? execSync(`git -C ${REPO} show ${ref}:frontend/src/locales/${lang}.json`, { encoding: 'utf8' })
    : fs.readFileSync(path.join(REPO, `frontend/src/locales/${lang}.json`), 'utf8'),
)
const NEW = { zh: readLocale('zh'), en: readLocale('en'), hk: readLocale('hk'), vn: readLocale('vn') }

/** 期望 nav 文案（zh：悬赏 / 市场 / 管理面板） */
const EXPECT_LABELS_ZH = [NEW.zh.task, NEW.zh.shard, NEW.zh.admin_panel]
/** 期望 img src（与 Header.jsx NAV_ICON_SRC 逐一对拍；src 与语种无关 ⇒ en 档复用） */
const EXPECT_SRCS = ['/icons/nav/nav-bounty.png', '/icons/nav/nav-market.png', '/icons/nav/nav-admin.png']
/** 「订单」按钮（桌面 + 移动面板）期望 src = 龙虾图 */
const ORDERS_SRC = '/icons/nav/nav-orders.png'
/** 旧长文案（顶栏内必须缺席） */
const OLD_ZH_LONG = '悬赏中心'
/** 文案/底色对拍的关键样式键 */
const STYLE_KEYS = ['backgroundColor', 'color', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'fontSize', 'fontWeight']

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'

// ---- API 自截（只读面；零后端 / 零库写） --------------------------------------------------------
const STATE = { calls: [] }
const ok = (data) => ({ success: true, data })
const apiResponse = (method, pathname) => {
  if (pathname === '/api/admin/me') {
    return ok({ is_admin: true, can_access_admin: true, preferred_admin_path: '/dashboard', permissions: ['all'] })
  }
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: 'US Dollar' }])
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (pathname === '/api/task/all' || pathname === '/api/task-progress' || pathname === '/api/prize/all') return ok([])
  if (pathname === '/api/user/stats') return ok({ points: 0, level: 1, completed: 0, pending: 0 })
  if (pathname === '/api/tasklist/pending-verification/count') return ok({ count: 0 })
  if (pathname.startsWith('/api/tasklist/pending-verification')) return ok([])
  if (pathname === '/api/user/balances') return ok([{ symbol: '$', amount: '0' }])
  if (/^\/api\/user\/asset\//.test(pathname)) return ok({ balance: '0', points: 0, currency: [] })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数 -----------------------------------------------------------------------------------
const SNAP_FN = () => {
  const q = (s) => document.querySelector(s)
  const de = document.documentElement
  // 顶栏 nav：/dashboard 等页另有侧栏 `<nav>` ⇒ 只认 `#header nav`（Header 不渲染 ⇒ nav = null）
  const nav = q('#header nav')
  const links = nav ? [...nav.querySelectorAll('a')] : []
  const header = q('#header')
  const cs = (el) => {
    const s = getComputedStyle(el)
    const out = {}
    for (const k of ['backgroundColor', 'color', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'fontSize', 'fontWeight']) out[k] = s[k]
    return out
  }
  const items = links.map((a) => {
    const r = a.getBoundingClientRect()
    // 2026-10-22 像素图单：图标判据从 `<svg>`（lucide）改为 `<img src>`（像素图 PNG）
    const img = a.querySelector('img')
    const ir = img ? img.getBoundingClientRect() : null
    const ics = img ? getComputedStyle(img) : null
    const span = a.querySelector('span')
    return {
      href: a.getAttribute('href'),
      label: a.textContent.replace(/\s+/g, ' ').trim(),
      spanLabel: span ? span.textContent.trim() : null,
      hasImg: !!img,
      imgSrc: img ? img.getAttribute('src') : null,
      img: ir && ics ? { w: Math.round(ir.width), h: Math.round(ir.height), alt: img.getAttribute('alt'), ariaHidden: img.getAttribute('aria-hidden'), pixelated: ics.imageRendering, naturalOk: img.complete && img.naturalWidth > 0 } : null,
      box: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) },
      style: cs(a),
    }
  })
  // 「订单」按钮（nav 外的独立 Link；与三菜单项同属「四图标」口径）
  const ordersBtn = document.querySelector('[data-sf-m="header-orders"]')
  let orders = null
  if (ordersBtn) {
    const oImg = ordersBtn.querySelector('img')
    const oIr = oImg ? oImg.getBoundingClientRect() : null
    const oIcs = oImg ? getComputedStyle(oImg) : null
    const oSpan = ordersBtn.querySelector('span')
    orders = {
      href: ordersBtn.getAttribute('href'),
      spanLabel: oSpan ? oSpan.textContent.trim() : null,
      hasImg: !!oImg,
      imgSrc: oImg ? oImg.getAttribute('src') : null,
      img: oIr && oIcs ? { w: Math.round(oIr.width), h: Math.round(oIr.height), alt: oImg.getAttribute('alt'), ariaHidden: oImg.getAttribute('aria-hidden'), pixelated: oIcs.imageRendering, naturalOk: oImg.complete && oImg.naturalWidth > 0 } : null,
    }
  }
  const hr = header ? header.getBoundingClientRect() : null
  return {
    pathname: location.pathname,
    lang: (document.documentElement.getAttribute('lang') || '') + '|' + location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    offenders: [...document.querySelectorAll('*')].filter((el) => {
      const b = el.getBoundingClientRect()
      return b.width > 0 && b.right > de.clientWidth + 1
    }).slice(0, 12).map((el) => `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}@${Math.round(el.getBoundingClientRect().right)}`),
    header: hr ? { h: Math.round(hr.height), y: Math.round(hr.y) } : null,
    navLabels: links.map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
    navText: nav ? nav.textContent.replace(/\s+/g, ' ').trim() : '',
    items,
    orders,
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

const attachRoutes = (ctx) => ctx.route('**/*', async (route) => {
  const req = route.request()
  const u = new URL(req.url())
  if (u.hostname !== 'sf.local') return route.fulfill({ status: 204, body: '' })
  if (u.pathname.startsWith('/api/')) {
    STATE.calls.push(`${req.method()} ${u.pathname}`)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
  }
  let file = path.join(DIST, decodeURIComponent(u.pathname))
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
})

const seedAuth = (ctx) => ctx.addInitScript((negArm) => {
  localStorage.setItem('theme', 'light')
  const user = { uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe', EVM: '0x59f9f640d15ebb053c94a816232cf8ce91b209b0' }
  localStorage.setItem('user', JSON.stringify(user))
  localStorage.setItem('token', 'probe-token')
  if (!negArm) return
  // 负控：① 管理项染回紫底（旧特殊样式）；② 「悬赏」文案改回「悬赏中心」⇒ 两条判据都必须转红
  //       ③ 悬赏项图标「改回 lucide」：img 摘除换同位 svg ⇒ hasImg/src/尺寸判据必须转红
  //       ④ 市场项「换错图」：src 改指贝壳图 ⇒ src 逐一对拍必须转红（尺寸不变 ⇒ 红来自 src 判据）
  const inject = () => {
    const links = [...document.querySelectorAll('#header nav a')]
    // ① 管理面板项染回紫底（按 href 定位，不依赖渲染顺序/项数）
    const admin = links.find((a) => (a.getAttribute('href') || '').startsWith('/dashboard'))
    if (admin) {
      admin.style.backgroundColor = 'rgb(147,51,234)'
      admin.style.color = 'rgb(255,255,255)'
    }
    // ② 首项文案改回长口径
    const first = links[0]
    const span = first && first.querySelector('span')
    if (span && span.textContent !== '悬赏中心') span.textContent = '悬赏中心'
    // ③ 悬赏项「改回 lucide」：摘 img、插 svg（lucide 形态：class 含 lucide-gift，16px）
    if (first && !first.querySelector('svg')) {
      const im = first.querySelector('img')
      if (im) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('class', 'lucide lucide-gift h-4 w-4')
        svg.setAttribute('aria-hidden', 'true')
        im.replaceWith(svg)
      }
    }
    // ④ 市场项「换错图」：src 改指贝壳图（本应是鲸鱼图）
    const second = links[1]
    const sim = second && second.querySelector('img')
    if (sim && sim.getAttribute('src') !== '/icons/nav/nav-bounty.png') sim.setAttribute('src', '/icons/nav/nav-bounty.png')
  }
  setInterval(inject, 60)
}, NEG)

const newPageWith = async (browser, viewport) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seedAuth(context)
  await attachRoutes(context)
  const page = await context.newPage()
  const errors = { pageErrors: [], consoleErrors: [], resourceErrors: [], imgResponses: [] }
  // ③ 图片请求 200：记录 /icons/nav/ 下每一笔响应（状态码 + content-type）
  page.on('response', (resp) => {
    try {
      const u = new URL(resp.url())
      if (u.pathname.startsWith('/icons/nav/')) errors.imgResponses.push({ path: u.pathname, status: resp.status(), contentType: resp.headers()['content-type'] || '' })
    } catch { /* 非 URL 响应忽略 */ }
  })
  page.on('pageerror', (e) => errors.pageErrors.push(String(e && e.message)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text().slice(0, 200)
    if (/Failed to load resource/i.test(text)) errors.resourceErrors.push(text)
    else errors.consoleErrors.push(text)
  })
  return { page, errors }
}

const open = async (page, url, waitHook) => {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (waitHook) await page.waitForSelector(waitHook, { timeout: 8000 }).catch(() => {})
  await settle(page)
  return page.evaluate(SNAP_FN)
}

const sameArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i])
const allEqual = (arr) => arr.length > 0 && arr.every((v) => v === arr[0])

const styleDiff = (items) => {
  const out = {}
  for (const k of STYLE_KEYS) {
    const vals = items.map((i) => i.style[k])
    out[k] = { values: vals, allEqual: allEqual(vals) }
  }
  return out
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`dist 缺 index.html: ${DIST}`)
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/header-nav/probe-header-nav.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { auth: 'localStorage seed（EVM = 管理员合约地址）+ /api/admin/me 自截（零后端 / 零库写）', negativeControl: NEG },
    expected: { labelsZh: EXPECT_LABELS_ZH, imgSrcs: EXPECT_SRCS, ordersSrc: ORDERS_SRC, pageTitleZh: NEW.zh.taskPage.title, oldLongCopy: OLD_ZH_LONG },
    states: {}, assertions: {}, errors: {},
  }

  // ======================= 1536 桌面档 =======================
  const d = await newPageWith(browser, { width: 1536, height: 960 })
  const desk = await open(d.page, '/', '#header nav')
  // 等三项落齐（isAdmin 由异步 /api/admin/me 决定）
  await d.page.waitForFunction(() => document.querySelectorAll('#header nav a').length >= 3, null, { timeout: 8000 }).catch(() => {})
  const deskSnap = await d.page.evaluate(SNAP_FN)
  out.states['1536_home'] = { navLabels: deskSnap.navLabels, header: deskSnap.header, overflowPx: deskSnap.overflowPx, items: deskSnap.items }
  out.errors['1536_home'] = d.errors

  const items = deskSnap.items
  const adminItem = items[2] || null
  const styleDiffOut = styleDiff(items)

  out.assertions.icons = {
    navCount: items.length,
    everyHasImg: items.length === 3 && items.every((i) => i.hasImg === true),
    // src 逐一对拍：悬赏=贝壳 / 市场=鲸鱼 / 管理面板=章鱼
    imgSrcsExact: sameArr(items.map((i) => i.imgSrc), EXPECT_SRCS),
    everyImg18: items.every((i) => i.img && i.img.w === 18 && i.img.h === 18),
    everyImgPixelated: items.every((i) => i.img && i.img.pixelated === 'pixelated'),
    everyImgAltEmptyAriaHidden: items.every((i) => i.img && i.img.alt === '' && i.img.ariaHidden === 'true'),
    everyImgDecoded: items.every((i) => i.img && i.img.naturalOk === true),
    everyHasLabel: items.every((i) => typeof i.spanLabel === 'string' && i.spanLabel.length > 0),
  }

  // ③ 图片请求 200：/icons/nav/ 每笔响应 200 + image/png，且四个 src 都被请求过
  const imgReqs = d.errors.imgResponses || []
  out.assertions.imgAssets200 = {
    requestsRecorded: imgReqs.length,
    allStatus200: imgReqs.length >= 4 && imgReqs.every((r) => r.status === 200),
    allPngMime: imgReqs.every((r) => r.contentType === 'image/png'),
    allFourSrcsHit: [EXPECT_SRCS[0], EXPECT_SRCS[1], EXPECT_SRCS[2], ORDERS_SRC].every((s) => imgReqs.some((r) => r.path === s)),
    noResourceErrors: d.errors.resourceErrors.length === 0,
  }

  // 「订单」按钮（nav 外独立 Link）：龙虾图 + src 对拍
  out.assertions.ordersEntry = {
    present: !!deskSnap.orders,
    hrefIsProfile: deskSnap.orders ? deskSnap.orders.href === '/profile' : false,
    hasImg: deskSnap.orders ? deskSnap.orders.hasImg === true : false,
    imgSrcExact: deskSnap.orders ? deskSnap.orders.imgSrc === ORDERS_SRC : false,
    img18: deskSnap.orders && deskSnap.orders.img ? deskSnap.orders.img.w === 18 && deskSnap.orders.img.h === 18 : false,
    pixelated: deskSnap.orders && deskSnap.orders.img ? deskSnap.orders.img.pixelated === 'pixelated' : false,
    altEmptyAriaHidden: deskSnap.orders && deskSnap.orders.img ? deskSnap.orders.img.alt === '' && deskSnap.orders.img.ariaHidden === 'true' : false,
    labelExact: deskSnap.orders ? deskSnap.orders.spanLabel === NEW.zh.header.orders : false,
  }

  out.assertions.copy = {
    labelsExact: sameArr(deskSnap.navLabels, EXPECT_LABELS_ZH),
    bountyIsShort: (items[0] || {}).label === '悬赏',
    navHasNoOldLongCopy: !deskSnap.navText.includes(OLD_ZH_LONG),
    pageTitleStillCenter: NEW.zh.taskPage.title === OLD_ZH_LONG,
  }

  out.assertions.adminNeutralStyle = {
    adminPresent: !!adminItem,
    hrefIsDashboard: adminItem ? adminItem.href === '/dashboard' : false,
    sameBackground: adminItem ? adminItem.style.backgroundColor === items[0].style.backgroundColor && adminItem.style.backgroundColor === items[1].style.backgroundColor : false,
    sameForeground: adminItem ? adminItem.style.color === items[0].style.color : false,
    sameHeight: allEqual(items.map((i) => i.box.h)),
    samePadding: allEqual(items.map((i) => i.style.paddingLeft + '/' + i.style.paddingTop)),
    styleDiff: styleDiffOut,
  }

  out.assertions.layout = {
    // 基线 65 = h-16（64 内容）+ 1px 下边框（§23 T116 冻结宽度 1px）⇒ 追加图标不得撑高
    headerHeightBaseline65: deskSnap.header ? deskSnap.header.h === 65 : false,
    linkHeightNotStretched: items.every((i) => i.box.h <= 40),
    zeroOverflow1536: deskSnap.overflowPx === 0,
    zeroPageError1536: d.errors.pageErrors.length === 0 && d.errors.consoleErrors.length === 0,
  }

  // 语种档：/en 悬赏文案 = en.task（同一按钮，四语键值同步）
  const enSnap = await open(d.page, '/en', '#header nav')
  await d.page.waitForFunction(() => document.querySelectorAll('#header nav a').length >= 3, null, { timeout: 8000 }).catch(() => {})
  const enSnap2 = await d.page.evaluate(SNAP_FN)
  out.states['1536_en'] = { navLabels: enSnap2.navLabels, overflowPx: enSnap2.overflowPx }
  out.assertions.i18n = {
    enLabelsExact: sameArr(enSnap2.navLabels, [NEW.en.task, NEW.en.shard, NEW.en.admin_panel]),
    // src 与语种无关：en 档同断 img 存在 + src 集逐字（防止按语种渲染出不同图）
    enHasImg: enSnap2.items.length === 3 && enSnap2.items.every((i) => i.hasImg),
    enImgSrcsExact: sameArr(enSnap2.items.map((i) => i.imgSrc), EXPECT_SRCS),
    enOrdersSrcExact: enSnap2.orders ? enSnap2.orders.imgSrc === ORDERS_SRC : false,
    zeroOverflow1536en: enSnap2.overflowPx === 0,
  }

  // /dashboard 档：管理项为**当前项**时也必须走普通 active 口径（无紫底）
  const dashSnap = await open(d.page, '/dashboard', '#header nav')
  await d.page.waitForFunction(() => document.querySelectorAll('#header nav a').length >= 3, null, { timeout: 8000 }).catch(() => {})
  const dash = await d.page.evaluate(SNAP_FN)
  out.states['1536_dashboard'] = { navLabels: dash.navLabels, overflowPx: dash.overflowPx, items: dash.items }
  // 事实记录：/dashboard 由管理端自身布局承载（自带侧栏 `<nav>`），**不渲染站点 Header**
  //   ⇒ 旧 `startsWith('/dashboard')` 紫底分支只能在**其它页面**上的「管理面板」项生效（即恒紫）。
  //   本档只做「页内零 pageerror」+「顶栏 nav 不出现」两条事实读数，不参与样式对拍。
  out.assertions.dashboardPage = {
    headerNavNotRendered: dash.items.length === 0,
    siteHeaderAbsent: dash.items.length === 0,
    zeroOverflowDashboard: dash.overflowPx === 0,
    zeroPageErrorDashboard: d.errors.pageErrors.length === 0 && d.errors.consoleErrors.length === 0,
  }

  // ======================= 390 移动档 =======================
  const m = await newPageWith(browser, { width: 390, height: 844 })
  const mob = await open(m.page, '/', '#header nav')
  out.states['390_home'] = { header: mob.header, overflowPx: mob.overflowPx, offenders: mob.offenders.slice(0, 6) }
  out.errors['390_home'] = m.errors
  out.assertions.layout390 = {
    zeroOverflow390: mob.overflowPx === 0,
    zeroPageError390: m.errors.pageErrors.length === 0 && m.errors.consoleErrors.length === 0,
    offendersNone: mob.offenders.length === 0,
  }

  // 390 + 开汉堡面板：移动面板内像素图同步断言（面板 = menuItems − exchange ⇒ 任务项 + 订单项）
  await m.page.click('[data-sf-m="header-mobile-menu"]')
  await settle(m.page)
  const mobPanel = await m.page.evaluate(() => {
    const panel = document.querySelector('div.md\\:hidden.bg-white')
    const imgs = panel ? [...panel.querySelectorAll('a img')] : []
    const ordersLink = document.querySelector('[data-sf-m="header-orders-mobile"]')
    const oImg = ordersLink ? ordersLink.querySelector('img') : null
    const pix = (el) => (el ? getComputedStyle(el).imageRendering : null)
    return {
      panelOpen: !!panel,
      panelImgSrcs: imgs.map((el) => el.getAttribute('src')),
      panelPixelated: imgs.map((el) => pix(el)),
      ordersMobileSrc: oImg ? oImg.getAttribute('src') : null,
      ordersMobilePixelated: pix(oImg),
      overflowOpened: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  out.states['390_panel_open'] = mobPanel
  out.assertions.mobilePanelSync = {
    panelOpen: mobPanel.panelOpen === true,
    taskImgSrcExact: mobPanel.panelImgSrcs.includes('/icons/nav/nav-bounty.png'),
    ordersMobileImgSrcExact: mobPanel.ordersMobileSrc === ORDERS_SRC,
    allPixelated: mobPanel.panelPixelated.every((p) => p === 'pixelated') && mobPanel.ordersMobilePixelated === 'pixelated',
    noOldOrderSvg: mobPanel.panelImgSrcs.every((s) => !String(s).includes('order.svg')),
    zeroOverflowPanelOpen: mobPanel.overflowOpened === 0,
  }

  // 汇总
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => {
    if (k === 'styleDiff' || v === null || typeof v !== 'object') {
      return typeof v === 'boolean' ? [[`${prefix}${k}`, v]] : []
    }
    if (Array.isArray(v)) return []
    return flat(v, `${prefix}${k}.`)
  })
  const checks = [...flat(Object.fromEntries(Object.entries(out.assertions).filter(([k]) => k !== 'adminNeutralStyle'))),
    ...flat(out.assertions.adminNeutralStyle), ...flat(out.assertions.layout390)]
  const failed = checks.filter(([, v]) => v === false)
  out.summary = { checks: checks.length, failed: failed.length, failedNames: failed.map(([k]) => k), verdict: failed.length === 0 ? 'PASS' : 'FAIL' }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, summary: out.summary, negativeControl: NEG }, null, 2))
  await browser.close()
  if (failed.length) process.exitCode = NEG ? 0 : 1
}

main().catch((e) => { console.error(e); process.exit(1) })
