/**
 * 「交易区 → 我的置换」profileNav.title 四语改名探针（2026-10-21 · 只改值不改键）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 侧栏组名（[data-sf-m="profile-nav-trades"] .sf-prof-nav-title）与三页 h1
 *      （.sf-prof-pane-title = title · published/sold/bought）含新名：
 *      zh 我的置换 / en My Swaps / hk 我的置換 / vn Trao đổi của tôi（vn 待复核）；
 *      nav aria-label 同键同步；h1 组成式含未动的 profileNav.published/sold/bought。
 *   ② 旧值零命中（旧值由 `git show HEAD:frontend/src/locales/<lang>.json` 现取，不是手抄）：
 *      profileNav 全站面（trades 三页 + settings + assets，四语）#root 文本内
 *      「我的交易」/ My Trades / Giao dịch của tôi 各自缺席。
 *   ③ 390 / 1536 两档：目标页 `scrollWidth - clientWidth = 0` + 零 pageerror / 零 console error。
 *   负控臂 PROBE_NEG=1 ⇒ 往 #root 塞回旧值「我的交易」：② 的零命中判据必须转红
 *      （且红点必须全部落在零命中族内 = 尺子灵敏度 + 无附带误伤自证）。
 *
 * 手法（同 ops/profile-nav/probe-profile-nav.mjs 体例）：
 *   · 静态服务 = context.route 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）。
 *
 * 用法：QA_DIST=<dist> [PROBE_NEG=1] node probe-profile-nav-swap.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-nav/readings/probe-swap-profile-nav.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const NEG = process.env.PROBE_NEG === '1'

const readLocale = (lang, ref) => JSON.parse(
  ref
    ? execSync(`git -C ${REPO} show ${ref}:frontend/src/locales/${lang}.json`, { encoding: 'utf8' })
    : fs.readFileSync(path.join(REPO, `frontend/src/locales/${lang}.json`), 'utf8'),
)
const NEW = { zh: readLocale('zh'), en: readLocale('en'), hk: readLocale('hk'), vn: readLocale('vn') }
const OLD = { zh: readLocale('zh', 'HEAD'), en: readLocale('en', 'HEAD'), hk: readLocale('hk', 'HEAD'), vn: readLocale('vn', 'HEAD') }

const LANGS = [['zh', ''], ['en', '/en'], ['hk', '/hk'], ['vn', '/vn']]
const TRADES_ROUTES = [['published', '/profile/trades/published'], ['sold', '/profile/trades/sold'], ['bought', '/profile/trades/bought']]
/** 侧栏钩子口径（不变式：改名不动钩子/顺序） */
const NAV_ORDER = ['profile-nav-assets', 'profile-nav-published', 'profile-nav-sold', 'profile-nav-bought', 'profile-nav-favorites', 'profile-nav-settings']

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- API 自截（只读面；写口不触发 ⇒ 零库写） --------------------------------------------------
const apiResponse = (method, pathname) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$', name: 'US Dollar' }])
  if (pathname === '/api/batt') {
    return ok({
      batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
      bttc: { balance: '12', status: 'listed', canMint: true, canBurn: true, usdBalance: '5', policy: {} },
    })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (pathname === '/api/task/all' || pathname === '/api/task-progress') return ok([])
  if (/^\/api\/user\/asset\//.test(pathname)) return ok({ balance: '0', currency: [] })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数 -----------------------------------------------------------------------------------
const SNAP_FN = () => {
  const q = (s) => document.querySelector(s)
  const de = document.documentElement
  const nav = q('[data-sf-m="profile-nav"]')
  const group = q('[data-sf-m="profile-nav-trades"]')
  const groupTitle = group ? group.querySelector('.sf-prof-nav-title') : null
  const h1 = q('.sf-prof-pane-title')
  const root = q('#root')
  return {
    pathname: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    nav: {
      present: !!nav,
      ariaLabel: nav ? nav.getAttribute('aria-label') : null,
      linkHooks: nav ? [...nav.querySelectorAll('a[data-sf-m]')].map((a) => a.getAttribute('data-sf-m')) : [],
      groupPresent: !!group,
      groupTitle: groupTitle ? groupTitle.textContent.trim() : null,
    },
    h1: h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : null,
    rootText: root ? root.textContent.replace(/\s+/g, ' ').trim() : '',
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
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
  }
  let file = path.join(DIST, decodeURIComponent(u.pathname))
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
})

const seedAuth = (ctx) => ctx.addInitScript((negArm) => {
  localStorage.setItem('theme', 'light')
  const user = { uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }
  localStorage.setItem('user', JSON.stringify(user))
  localStorage.setItem('token', 'probe-token')
  if (!negArm) return
  // 负控：把旧值「我的交易」塞回 #root 正文 ⇒ ② 的零命中判据必须转红
  const inject = () => {
    const root = document.getElementById('root')
    if (root && !document.getElementById('neg-old-title')) {
      const span = document.createElement('span')
      span.id = 'neg-old-title'
      span.textContent = '我的交易'
      root.appendChild(span)
    }
  }
  setInterval(inject, 100)
}, NEG)

const newPageWith = async (browser, viewport) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seedAuth(context)
  await attachRoutes(context)
  const page = await context.newPage()
  const errors = { pageErrors: [], consoleErrors: [], resourceErrors: [] }
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

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`dist 缺 index.html: ${DIST}`)
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/profile-nav/probe-profile-nav-swap.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { auth: 'localStorage seed only（零真登录）', api: 'context.route in-probe JSON（零后端 / 零库写）', negativeControl: NEG },
    newTitles: Object.fromEntries(LANGS.map(([l]) => [l, NEW[l].profileNav.title])),
    oldTitles: Object.fromEntries(LANGS.map(([l]) => [l, OLD[l].profileNav.title])),
    pendingReview: { vn: 'Trao đổi của tôi 为派单待复核译名' },
    states: {}, assertions: {}, errors: {},
  }
  // 零命中族判据键名前缀（负控臂据此把红点圈在 ② 族内）
  const OLD_ABSENT_PREFIX = 'oldAbsent'

  // ======================= 1536 桌面档 =======================
  const d = await newPageWith(browser, { width: 1536, height: 960 })

  // ①+② 四语 × trades 三页
  for (const [lang, prefix] of LANGS) {
    const states = {}
    const asserts = {}
    for (const [sub, route] of TRADES_ROUTES) {
      const snap = await open(d.page, `${prefix}${route}`, '[data-sf-m="profile-nav"]')
      states[sub] = {
        pathname: snap.pathname,
        overflowPx: snap.overflowPx,
        groupTitle: snap.nav.groupTitle,
        navAriaLabel: snap.nav.ariaLabel,
        h1Text: snap.h1,
        linkHooks: snap.nav.linkHooks,
        oldTitleInRootText: (snap.rootText || '').includes(OLD[lang].profileNav.title),
      }
      asserts[`${sub}_navPresent`] = snap.nav.present === true
      asserts[`${sub}_groupPresent`] = snap.nav.groupPresent === true
      asserts[`${sub}_groupTitleEqualsNew`] = snap.nav.groupTitle === NEW[lang].profileNav.title
      asserts[`${sub}_ariaEqualsNew`] = snap.nav.ariaLabel === NEW[lang].profileNav.title
      asserts[`${sub}_h1ContainsNew`] = typeof snap.h1 === 'string' && snap.h1.includes(NEW[lang].profileNav.title)
      asserts[`${sub}_h1ContainsUnchangedSub`] = typeof snap.h1 === 'string' && snap.h1.includes(NEW[lang].profileNav[sub])
      asserts[`${sub}_hooksUnchanged`] = sameArr(snap.nav.linkHooks, NAV_ORDER)
      asserts[`${OLD_ABSENT_PREFIX}Root_${sub}`] = states[sub].oldTitleInRootText === false
      asserts[`${sub}_zeroOverflow`] = snap.overflowPx === 0
    }
    out.states[`1536_trades_${lang}`] = states
    out.assertions[`trades_${lang}`] = asserts
  }

  // ② zh 档 profileNav 全站面补扫（settings / assets 两页）
  const zhExtras = {}
  const zhExtraAsserts = {}
  for (const [name, route] of [['settings', '/profile/settings'], ['assets', '/profile/assets']]) {
    const snap = await open(d.page, route, '[data-sf-m="profile-nav"]')
    zhExtras[name] = {
      pathname: snap.pathname, overflowPx: snap.overflowPx,
      groupTitle: snap.nav.groupTitle, navAriaLabel: snap.nav.ariaLabel,
      oldTitleInRootText: (snap.rootText || '').includes(OLD.zh.profileNav.title),
    }
    zhExtraAsserts[`${name}_groupTitleEqualsNew`] = snap.nav.groupTitle === NEW.zh.profileNav.title
    zhExtraAsserts[`${OLD_ABSENT_PREFIX}Root_${name}`] = zhExtras[name].oldTitleInRootText === false
    zhExtraAsserts[`${name}_zeroOverflow`] = snap.overflowPx === 0
  }
  out.states['1536_zh_extras'] = zhExtras
  out.assertions.zhExtras = zhExtraAsserts

  out.errors['1536'] = d.errors
  out.assertions.desktopClean = {
    zeroPageError: d.errors.pageErrors.length === 0,
    zeroConsoleError: d.errors.consoleErrors.length === 0 && d.errors.resourceErrors.length === 0,
  }
  await d.page.context().close()

  // ======================= 390 手机档 =======================
  const m = await newPageWith(browser, { width: 390, height: 844 })
  const mBought = await open(m.page, '/profile/trades/bought', '[data-sf-m="profile-nav"]')
  const mSettings = await open(m.page, '/profile/settings', '[data-sf-m="profile-nav"]')
  out.states['390'] = {
    trades_bought: {
      overflowPx: mBought.overflowPx, groupTitle: mBought.nav.groupTitle,
      navAriaLabel: mBought.nav.ariaLabel, h1Text: mBought.h1,
      oldTitleInRootText: (mBought.rootText || '').includes(OLD.zh.profileNav.title),
    },
    settings: {
      overflowPx: mSettings.overflowPx,
      oldTitleInRootText: (mSettings.rootText || '').includes(OLD.zh.profileNav.title),
    },
  }
  out.assertions.mobile390 = {
    boughtGroupTitleEqualsNew: mBought.nav.groupTitle === NEW.zh.profileNav.title,
    boughtAriaEqualsNew: mBought.nav.ariaLabel === NEW.zh.profileNav.title,
    boughtH1ContainsNew: typeof mBought.h1 === 'string' && mBought.h1.includes(NEW.zh.profileNav.title),
    boughtZeroOverflow: mBought.overflowPx === 0,
    settingsZeroOverflow: mSettings.overflowPx === 0,
    [`${OLD_ABSENT_PREFIX}Root_bought`]: out.states['390'].trades_bought.oldTitleInRootText === false,
    [`${OLD_ABSENT_PREFIX}Root_settings`]: out.states['390'].settings.oldTitleInRootText === false,
  }
  out.errors['390'] = m.errors
  out.assertions.mobileClean = {
    zeroPageError: m.errors.pageErrors.length === 0,
    zeroConsoleError: m.errors.consoleErrors.length === 0 && m.errors.resourceErrors.length === 0,
  }
  await m.page.context().close()

  // ======================= 汇总 =======================
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  ))
  const evaluated = Object.values(out.assertions).flatMap((group) => flat(group)).filter(([, v]) => typeof v === 'boolean')
  const failed = evaluated.filter(([, v]) => v !== true).map(([k]) => k)
  const failedNonZeroHit = failed.filter((k) => !k.includes(OLD_ABSENT_PREFIX))
  out.summary = {
    checks: evaluated.length,
    passed: evaluated.length - failed.length,
    failed,
    pageErrors: d.errors.pageErrors.length + m.errors.pageErrors.length,
    consoleErrors: d.errors.consoleErrors.length + m.errors.consoleErrors.length,
    resourceErrors: d.errors.resourceErrors.length + m.errors.resourceErrors.length,
    verdict: NEG
      ? (failed.length > 0 && failedNonZeroHit.length === 0 ? 'NEG_ARM_RED_AS_EXPECTED' : (failed.length === 0 ? 'NEG_ARM_STILL_GREEN_RULER_DEAD' : 'NEG_ARM_RED_WITH_COLLATERAL'))
      : (failed.length === 0 ? 'PASS' : 'FAIL'),
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
