/**
 * /task 文案「招工→任务」+ /profile 侧栏顺序 探针（Kevin 2026-10-21 需求①+②）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 侧栏 DOM 顺序逐项 = [assets, published, sold, bought, favorites, settings]
 *      （`profile-nav-trades` 分组容器包住 published/sold/bought；全量钩子序 =
 *       assets → trades 分组 → 三子项 → favorites → settings）；
 *      `aria-current` 语义不变（/profile/settings ⇒ settings；/profile/assets ⇒ assets）；
 *      钩子齐备且 390 移动档同一顺序（侧栏 = 横向页签，共用同一组）。
 *   ② `/task/new` 四语（zh / en / hk / vn）各一档：页面正文**无「招工」字样**，
 *      且**旧文案逐条缺席**（旧值由 `git show HEAD:frontend/src/locales/<lang>.json` 现取，
 *      不是手抄），新文案（jobs.publish / jobs.line）在场。
 *      vn 档 = 待复核（派单标注）：只做「旧 việc 类表述缺席 + 新 nhiệm vụ 在场」判据。
 *   ③ 390 / 1536 两档：`/profile/settings` 与 `/task/new` 各自 `scrollWidth - clientWidth = 0`
 *      + 零 pageerror / 零 console error。
 *
 * 手法（同 ops/profile-assets/probe-profile-assets.mjs 体例）：
 *   · 静态服务 = context.route 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 负控臂 PROBE_NEG=1 ⇒ 往 DOM 里塞回「招工」并把 assets 移回末位：判据必须转红（尺子灵敏度自证）。
 *
 * 用法：QA_DIST=<dist> [PROBE_NEG=1] node probe-profile-nav.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-nav/readings/probe-profile-nav.json')
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

/** 侧栏顺序口径（链接钩子，文档顺序） */
const NAV_ORDER = ['profile-nav-assets', 'profile-nav-published', 'profile-nav-sold', 'profile-nav-bought', 'profile-nav-favorites', 'profile-nav-settings']
/** 全量钩子口径（含 trades 分组容器） */
const NAV_HOOKS_ALL = ['profile-nav-assets', 'profile-nav-trades', 'profile-nav-published', 'profile-nav-sold', 'profile-nav-bought', 'profile-nav-favorites', 'profile-nav-settings']

const LANGS = [['zh', ''], ['en', '/en'], ['hk', '/hk'], ['vn', '/vn']]
/** 旧文案里被点名的键（jobs 全组 + wage.empty）：逐条取旧值，作为「必须缺席」的禁词 */
const COPY_KEYS = ['jobs.line', 'jobs.list', 'jobs.publish', 'jobs.publishOk', 'jobs.detail', 'jobs.title', 'jobs.description', 'jobs.itemTitle', 'wage.empty']
const pick = (dict, dotted) => dotted.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- API 自截（只读面；写口不触发 ⇒ 零库写） --------------------------------------------------
const STATE = { calls: [] }
const CUR = [{ cid: 1, symbol: '$', name: 'US Dollar' }, { cid: 4, symbol: 'BTTC', name: 'BitTorrent' }]
const apiResponse = (method, pathname) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/currencies') return ok(CUR)
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
  const links = nav ? [...nav.querySelectorAll('a[data-sf-m]')] : []
  const hookOf = (el) => el.getAttribute('data-sf-m')
  const group = q('[data-sf-m="profile-nav-trades"]')
  const groupChildren = group ? [...group.children].map((el) => hookOf(el) || el.tagName.toLowerCase()) : []
  const rects = links.map((a) => {
    const r = a.getBoundingClientRect()
    return { hook: hookOf(a), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
  const navBox = nav ? nav.getBoundingClientRect() : null
  const navStyle = nav ? getComputedStyle(nav) : null
  const cw = de.clientWidth
  const root = q('#root')
  return {
    pathname: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - cw,
    offenders: [...document.querySelectorAll('*')].filter((el) => {
      const b = el.getBoundingClientRect()
      return b.width > 0 && b.right > cw + 1
    }).slice(0, 12).map((el) => `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}@${Math.round(el.getBoundingClientRect().right)}`),
    nav: {
      present: !!nav,
      linkHooks: links.map(hookOf),
      allHooks: nav ? [...nav.querySelectorAll('[data-sf-m]')].map(hookOf) : [],
      groupHooks: nav ? [...nav.querySelectorAll('[data-sf-m="profile-nav-trades"] [data-sf-m]')].map(hookOf) : [],
      groupChildren,
      labels: links.map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
      ariaCurrent: links.filter((a) => a.getAttribute('aria-current')).map(hookOf),
      hrefs: links.map((a) => a.getAttribute('href')),
      box: navBox ? { x: Math.round(navBox.x), y: Math.round(navBox.y), w: Math.round(navBox.width), h: Math.round(navBox.height) } : null,
      flexDirection: navStyle ? navStyle.flexDirection : null,
      rects,
    },
    task: {
      hero: !!q('[data-sf-m="jobs-hero"]'),
      form: !!q('[data-sf-m="jobs-form"]'),
      titleInput: !!q('[data-sf-m="jobs-input-title"]'),
      submitText: (q('[data-sf-m="jobs-primary"]') || {}).textContent || null,
      sideTitle: q('[data-sf-m="jobs-side"]') ? (q('[data-sf-m="jobs-side"]').textContent || '').replace(/\s+/g, ' ').trim() : null,
    },
    text: root ? root.textContent.replace(/\s+/g, ' ').trim() : '',
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
  const user = { uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }
  localStorage.setItem('user', JSON.stringify(user))
  localStorage.setItem('token', 'probe-token')
  if (!negArm) return
  // 负控：① 把「招工」塞回正文；② 把 assets 链接移回末位（旧顺序）⇒ 两条判据都必须转红
  const inject = () => {
    const root = document.getElementById('root')
    if (root && !document.getElementById('neg-copy')) {
      const span = document.createElement('span')
      span.id = 'neg-copy'
      span.textContent = '招工'
      root.appendChild(span)
    }
    const nav = document.querySelector('[data-sf-m="profile-nav"]')
    const assets = nav && nav.querySelector('[data-sf-m="profile-nav-assets"]')
    if (nav && assets && nav.lastElementChild !== assets) nav.appendChild(assets)
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
    probe: 'ops/profile-nav/probe-profile-nav.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { auth: 'localStorage seed only（零真登录）', api: 'context.route in-probe JSON（零后端 / 零库写）', negativeControl: NEG },
    expected: { navOrder: NAV_ORDER, navAllHooks: NAV_HOOKS_ALL },
    states: {}, assertions: {}, errors: {},
  }

  // ======================= 1536 桌面档 =======================
  const d = await newPageWith(browser, { width: 1536, height: 960 })

  // ① 侧栏顺序：/profile/settings（登录态稳定、无异步内容干扰）
  const navSnap = await open(d.page, '/profile/settings', '[data-sf-m="profile-nav"]')
  out.states['1536_profile_settings'] = { pathname: navSnap.pathname, overflowPx: navSnap.overflowPx, nav: navSnap.nav }
  out.assertions.navOrder = {
    navPresent: navSnap.nav.present === true,
    linkOrderExact: sameArr(navSnap.nav.linkHooks, NAV_ORDER),
    allHooksExact: sameArr(navSnap.nav.allHooks, NAV_HOOKS_ALL),
    assetsFirst: navSnap.nav.linkHooks[0] === 'profile-nav-assets',
    tradesGroupAfterAssets: navSnap.nav.allHooks.indexOf('profile-nav-trades') > navSnap.nav.allHooks.indexOf('profile-nav-assets'),
    tradesGroupOwnsThree: sameArr(navSnap.nav.groupHooks, ['profile-nav-published', 'profile-nav-sold', 'profile-nav-bought']),
    ariaCurrentIsSettings: sameArr(navSnap.nav.ariaCurrent, ['profile-nav-settings']),
    labelsMatchZh: sameArr(navSnap.nav.labels, [
      NEW.zh.profileNav.assets, NEW.zh.profileNav.published, NEW.zh.profileNav.sold,
      NEW.zh.profileNav.bought, NEW.zh.profileNav.favorites, NEW.zh.profileNav.settings,
    ]),
    zeroOverflow: navSnap.overflowPx === 0,
  }
  out.states['1536_profile_settings'].expectedLabels = out.assertions.navOrder.labelsMatchZh

  // aria-current 不变：/profile/assets ⇒ assets 为当前项
  const assetNav = await open(d.page, '/profile/assets', '[data-sf-m="profile-nav"]')
  out.assertions.navAriaAssets = {
    ariaCurrentIsAssets: sameArr(assetNav.nav.ariaCurrent, ['profile-nav-assets']),
    assetsHref: (assetNav.nav.hrefs[0] || '') === '/profile/assets',
    orderStableAcrossRoutes: sameArr(assetNav.nav.linkHooks, NAV_ORDER),
    zeroOverflow: assetNav.overflowPx === 0,
  }

  // ② /task/new 四语：无「招工」+ 旧文案逐条缺席 + 新文案在场
  const taskStates = {}
  const copyAssert = {}
  for (const [lang, prefix] of LANGS) {
    const snap = await open(d.page, `${prefix}/task/new`, '[data-sf-m="jobs-form"]')
    const text = snap.text || ''
    const oldValues = COPY_KEYS.map((k) => pick(OLD[lang], k)).filter((v) => typeof v === 'string' && v.trim())
    const present = oldValues.filter((v) => text.includes(v))
    const newLine = NEW[lang].jobs.line
    const newPublish = NEW[lang].jobs.publish
    const newTitle = NEW[lang].jobs.title
    taskStates[lang] = {
      pathname: snap.pathname,
      hero: snap.task.hero, form: snap.task.form, titleInput: snap.task.titleInput,
      submitText: snap.task.submitText, sideTitle: snap.task.sideTitle,
      overflowPx: snap.overflowPx,
      textSample: text.slice(0, 400),
      oldValues,
      oldValuesStillPresent: present,
    }
    copyAssert[lang] = {
      formPresent: snap.task.form === true && snap.task.titleInput === true,
      noHiringChars: !text.includes('招工'),
      noOldCopy: present.length === 0,
      newLinePresent: text.includes(newLine),
      newPublishPresent: text.includes(newPublish),
      newTitlePresent: text.includes(newTitle),
      zeroOverflow: snap.overflowPx === 0,
      ...(lang === 'en' ? { noJobWord: !/\bjobs?\b/i.test(text) } : {}),
      ...(lang === 'vn' ? { noViecWord: !/\bviệc\b/iu.test(text) } : {}),
    }
  }
  out.states['1536_task_new'] = taskStates
  out.assertions.taskNewCopy = copyAssert

  // 附：/task 列表页（同族共用 jobs.*）zh 档无「招工」
  const listSnap = await open(d.page, '/task', '[data-sf-m="task-page"]')
  out.states['1536_task_list'] = {
    pathname: listSnap.pathname, hasTaskPage: !!listSnap.text,
    listEmptyLabelPresent: (listSnap.text || '').includes(NEW.zh.wage.empty) || (listSnap.text || '').includes(NEW.zh.jobs.list),
    textSample: (listSnap.text || '').slice(0, 300),
  }
  out.assertions.taskListCopy = {
    noHiringChars: !(listSnap.text || '').includes('招工'),
    newListLabelOrEmptyPresent: out.states['1536_task_list'].listEmptyLabelPresent,
  }

  out.errors['1536'] = d.errors
  out.assertions.desktopClean = {
    zeroPageError: d.errors.pageErrors.length === 0,
    zeroConsoleError: d.errors.consoleErrors.length === 0 && d.errors.resourceErrors.length === 0,
  }
  await d.page.context().close()

  // ======================= 390 手机档 =======================
  const m = await newPageWith(browser, { width: 390, height: 844 })
  const mNav = await open(m.page, '/profile/settings', '[data-sf-m="profile-nav"]')
  const mTask = await open(m.page, '/task/new', '[data-sf-m="jobs-form"]')
  out.states['390'] = {
    profile_settings: { overflowPx: mNav.overflowPx, nav: mNav.nav, offenders: mNav.offenders },
    task_new: { overflowPx: mTask.overflowPx, offenders: mTask.offenders, submitText: mTask.task.submitText },
  }
  out.assertions.mobile390 = {
    navOrderExact: sameArr(mNav.nav.linkHooks, NAV_ORDER),
    navIsHorizontalTabs: mNav.nav.flexDirection === 'row' && (mNav.nav.box ? mNav.nav.box.w > mNav.nav.box.h : false),
    profileZeroOverflow: mNav.overflowPx === 0,
    taskZeroOverflow: mTask.overflowPx === 0,
    taskNoHiringChars: !(mTask.text || '').includes('招工'),
    taskFormPresent: mTask.task.form === true,
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
  out.summary = {
    checks: evaluated.length,
    passed: evaluated.length - failed.length,
    failed,
    pageErrors: d.errors.pageErrors.length + m.errors.pageErrors.length,
    consoleErrors: d.errors.consoleErrors.length + m.errors.consoleErrors.length,
    resourceErrors: d.errors.resourceErrors.length + m.errors.resourceErrors.length,
    verdict: NEG
      ? (failed.length > 0 ? 'NEG_ARM_RED_AS_EXPECTED' : 'NEG_ARM_STILL_GREEN_RULER_DEAD')
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
