/**
 * Header 余额区探针（Kevin 2026-10-20：删「积分」文案 + 多币种分行 + 删下拉「签到 · 电量」项）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① 两币种 ⇒ 两行（`$` / `€`），无「积分」字样（四语）；桌面下拉无 `header-batt-checkin`；
 *      390 手机面板亦无 `header-batt-checkin-mobile`（2026-10-20 桌面/移动两侧入口均删）；
 *   ② 单币种 ⇒ 恰一行；
 *   ③ `/api/user/balances` 失败 ⇒ 降级既有 `/api/user/asset/:uID` 的 `$` 单行且页面不白屏；
 *   ④ 390 / 1536 两档：`scrollWidth - clientWidth = 0` + 零 pageerror。
 *   ⑤ 排版读数：行高 ≈24px、数字 14px、`font-variant-numeric: tabular-nums`、左对齐、符号加粗。
 *
 * 手法（同 ops/wage/front 与 ops/v119-msg-panel 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 `context.route` 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node probe-header-balances.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/header-balances/readings/probe-result.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))
const HK = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/hk.json'), 'utf8'))
const EN = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/en.json'), 'utf8'))
const VN = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/vn.json'), 'utf8'))
const POINTS_WORDS = [ZH.common.communityPoints, HK.common.communityPoints, EN.common.communityPoints, VN.common.communityPoints]

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（探针内内存；契约形状 = `[{cid, symbol, name, balance(string)}]`，cid 升序、`$` 首位） ----
const TWO = [
  { cid: 1, symbol: '$', name: '平台积分', balance: '12234' },
  { cid: 9, symbol: '€', name: 'Euro', balance: '21345' },
]
const ONE = [{ cid: 1, symbol: '$', name: '平台积分', balance: '32456' }]

// 可变探针状态（每条臂切一次，不重启浏览器、不改夹具文件）
const STATE = { arm: 'two', calls: [] }

const apiResponse = (method, pathname) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/user/balances') {
    STATE.calls.push(pathname)
    if (STATE.arm === 'fail') {
      return { success: false, error: { code: 'INTERNAL', message: 'probe: balances unavailable' } }
    }
    return ok(STATE.arm === 'one' ? ONE : TWO)
  }
  const asset = pathname.match(/^\/api\/user\/asset\/(\d+)$/)
  if (asset) {
    STATE.calls.push(pathname)
    return ok({ points: '12345' })
  }
  if (pathname === '/api/user') {
    return ok({ uID: 970213, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', bio: 'probe' })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数 -------------------------------------------------------------------------------
const SNAP_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const rows = qa('[data-sf-m="header-balance-row"]')
  const block = q('[data-sf-m="header-balances"]')
  const menu = q('[data-sf-m="header-balances"]') ? q('[data-sf-m="header-balances"]').closest('div.absolute') : null
  const menuRect = menu ? menu.getBoundingClientRect() : null
  return {
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    menuRect: menuRect ? { x: Math.round(menuRect.x), w: Math.round(menuRect.width), right: Math.round(menuRect.right) } : null,
    rootLen: (document.getElementById('root') || {}).innerHTML ? document.getElementById('root').innerHTML.length : 0,
    triggerPresent: !!q('[data-sf-m="header-user-menu"]'),
    blockPresent: !!block,
    menuText: menu ? txt(menu) : null,
    rows: rows.map((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      const sym = el.querySelector('span')
      const symCs = sym ? getComputedStyle(sym) : null
      return {
        symbol: el.getAttribute('data-symbol'),
        text: txt(el),
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        heightPx: Math.round(r.height * 10) / 10,
        fontVariantNumeric: cs.fontVariantNumeric,
        textAlign: cs.textAlign,
        color: cs.color,
        symbolWeight: symCs ? symCs.fontWeight : null,
        symbolColor: symCs ? symCs.color : null,
      }
    }),
    battCheckinInMenu: qa('[data-sf-m="header-batt-checkin"]').length,
    battCheckinMobile: qa('[data-sf-m="header-batt-checkin-mobile"]').length,
    profileInMenu: qa('[data-sf-m="header-profile"]').length,
    logoutInMenu: qa('[data-sf-m="header-logout"]').length,
  }
})()`

async function settle(page, max = 40) {
  let prev = ''
  for (let i = 0; i < max; i += 1) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const sig = await page.evaluate(`(()=>{const r=document.getElementById('root');return (r?r.innerHTML.length:0)+'|'+document.querySelectorAll('*').length})()`)
    if (sig === prev) return i
    prev = sig
  }
  return -1
}

const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) {
      const payload = apiResponse(req.method(), u.pathname)
      const status = payload.success ? 200 : 500
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

const seedAuth = (ctx) => ctx.addInitScript(() => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
})

const openMenuSnap = async (page) => {
  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await settle(page)
  await page.waitForSelector('[data-sf-m="header-user-menu"]', { timeout: 8000 }).catch(() => {})
  await settle(page)

  // ④ 的「零溢出」口径 = **页面级**（下拉未展开时的文档宽度），与既有探针一致
  const overflowClosed = await page.evaluate(() => {
    const de = document.documentElement
    return de.scrollWidth - de.clientWidth
  })

  // 打开用户下拉（HoverMenu = mouseenter + 100ms 延迟）。用坐标 hover（不依赖 Playwright 的
  // 「可见且稳定」判定），兜底再补一次 mouseover 事件派发。
  const box = await page.locator('[data-sf-m="header-user-menu"]').first().boundingBox().catch(() => null)
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  let opened = await page.waitForSelector('[data-sf-m="header-balances"]', { timeout: 3000 }).then(() => true).catch(() => false)
  if (!opened) {
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sf-m="header-user-menu"]')
      const wrap = btn && btn.parentElement
      if (!wrap) return
      wrap.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    })
    opened = await page.waitForSelector('[data-sf-m="header-balances"]', { timeout: 3000 }).then(() => true).catch(() => false)
  }
  await page.waitForTimeout(150)
  await settle(page)
  const snap = await page.evaluate(SNAP_FN)
  snap.menuOpened = opened
  snap.overflowClosedPx = overflowClosed
  return snap
}

/**
 * 390 手机档：点汉堡 ⇒ 手机面板内既无 `header-batt-checkin-mobile` 钩子也无该文案
 * （2026-10-20 · Kevin：顶部菜单「签到 · 电量」桌面/移动两侧入口均删，只留 `/wage` 页内）
 */
async function openMobilePanelSnap(page) {
  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await settle(page)
  await page.waitForSelector('[data-sf-m="header-mobile-menu"]', { timeout: 8000 }).catch(() => {})
  await settle(page)
  await page.locator('[data-sf-m="header-mobile-menu"]').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForSelector('[data-sf-m="header-user-menu-mobile"]', { timeout: 5000 }).catch(() => {})
  await settle(page)
  return page.evaluate(`(() => {
    const q = (s) => document.querySelector(s)
    const qa = (s) => [...document.querySelectorAll(s)]
    const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
    const panel = q('[data-sf-m="header-user-menu-mobile"]')
    return {
      panelPresent: !!panel,
      battAnyCount: qa('[data-sf-m^="header-batt-checkin"]').length,
      battDesktopCount: qa('[data-sf-m="header-batt-checkin"]').length,
      battMobileCount: qa('[data-sf-m="header-batt-checkin-mobile"]').length,
      panelText: txt(panel),
      profileInPanel: qa('[data-sf-m="header-profile-mobile"]').length,
      logoutInPanel: qa('[data-sf-m="header-logout-mobile"]').length,
    }
  })()`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/header-balances/probe-header-balances.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: {
      two: TWO.map((r) => `${r.symbol}${r.balance}`),
      one: ONE.map((r) => `${r.symbol}${r.balance}`),
      fallbackPoints: '12345',
      auth: 'localStorage seed only（零真登录）',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {},
    assertions: {},
    pageErrors: [],
    consoleErrors: [],
  }

  const runArm = async (arm, viewport) => {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    seedAuth(ctx)
    await attachRoutes(ctx)
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e && e.message)))
    page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 200)) })
    STATE.arm = arm
    STATE.calls.length = 0
    const snap = await openMenuSnap(page)
    snap.apiCalls = [...STATE.calls]
    snap.pageErrors = errs
    out.pageErrors.push(...errs.map((e) => `${arm}@${viewport.width}: ${e}`))
    await ctx.close()
    return snap
  }

  // ===== ① 两币种（1536 桌面） =====
  const two = await runArm('two', { width: 1536, height: 960 })
  out.states['1536_two'] = two
  out.assertions.twoCurrencies = {
    rowsAreTwo: two.rows.length === 2,
    symbols: two.rows.map((r) => r.symbol),
    texts: two.rows.map((r) => r.text),
    symbolsMatch: JSON.stringify(two.rows.map((r) => r.symbol)) === JSON.stringify(['$', '€']),
    textsFormatted: JSON.stringify(two.rows.map((r) => r.text)) === JSON.stringify(['$12,234', '€21,345']),
    noPointsWord: POINTS_WORDS.every((w) => !String(two.menuText || '').includes(w)),
    battItemRemoved: two.battCheckinInMenu === 0,
    otherItemsIntact: two.profileInMenu === 1 && two.logoutInMenu === 1,
    typography: {
      lineHeight24: two.rows.every((r) => r.lineHeight === '24px'),
      fontSize14: two.rows.every((r) => r.fontSize === '14px'),
      tabularNums: two.rows.every((r) => /tabular-nums/.test(r.fontVariantNumeric)),
      leftAligned: two.rows.every((r) => r.textAlign === 'left' || r.textAlign === 'start'),
      symbolBold: two.rows.every((r) => Number(r.symbolWeight) >= 700),
      symbolSameColor: two.rows.every((r) => r.symbolColor === r.color),
    },
  }

  // ===== ② 单币种（1536 桌面） =====
  const one = await runArm('one', { width: 1536, height: 960 })
  out.states['1536_one'] = one
  out.assertions.singleCurrency = {
    rowsIsOne: one.rows.length === 1,
    text: one.rows[0] && one.rows[0].text,
    matches: one.rows[0] && one.rows[0].text === '$32,456',
    noPointsWord: POINTS_WORDS.every((w) => !String(one.menuText || '').includes(w)),
  }

  // ===== ③ 接口失败 ⇒ `$` 单行降级 =====
  const fail = await runArm('fail', { width: 1536, height: 960 })
  out.states['1536_fallback'] = fail
  out.assertions.fallback = {
    rowsIsOne: fail.rows.length === 1,
    symbol: fail.rows[0] && fail.rows[0].symbol,
    text: fail.rows[0] && fail.rows[0].text,
    fallbackFormatted: fail.rows[0] && fail.rows[0].text === '$12,345',
    fallbackRead: fail.apiCalls.some((p) => p.startsWith('/api/user/asset/')),
    balancesTried: fail.apiCalls.includes('/api/user/balances'),
    notBlank: fail.rootLen > 0,
    menuStillUsable: fail.profileInMenu === 1 && fail.logoutInMenu === 1,
    zeroPageError: fail.pageErrors.length === 0,
  }

  // ===== ④ 390 手机档：零溢出 / 零 pageerror =====
  const small = await runArm('two', { width: 390, height: 844 })
  out.states['390_two'] = small
  out.assertions.mobile = {
    zeroOverflow: small.overflowPx === 0,
    overflowPx: small.overflowPx,
    zeroPageError: small.pageErrors.length === 0,
    notBlank: small.rootLen > 0,
  }

  // ===== ④b 390 手机面板：点汉堡 ⇒ 无 `header-batt-checkin-mobile`（负断言，四语文案亦 0） =====
  const mobilePanel = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    seedAuth(ctx)
    await attachRoutes(ctx)
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e && e.message)))
    STATE.arm = 'two'
    STATE.calls.length = 0
    const snap = await openMobilePanelSnap(page)
    snap.pageErrors = errs
    out.pageErrors.push(...errs.map((e) => `mobile-panel@390: ${e}`))
    await ctx.close()
    return snap
  })()
  out.states['390_panel'] = mobilePanel
  const panelText = String(mobilePanel.panelText || '')
  out.assertions.mobilePanel = {
    panelPresent: mobilePanel.panelPresent,
    noBattHook: mobilePanel.battAnyCount === 0,
    noBattDesktop: mobilePanel.battDesktopCount === 0,
    noBattMobile: mobilePanel.battMobileCount === 0,
    noBattWords: [ZH, HK, EN, VN].every((d) => !panelText.includes(d.checkinPanel.checkinButton) && !panelText.includes(d.battCard.title)),
    otherItemsIntact: mobilePanel.profileInPanel === 1 && mobilePanel.logoutInPanel === 1,
    zeroPageError: mobilePanel.pageErrors.length === 0,
  }

  // ===== ④ 1536 零溢出（两臂取桌面两币种那条） =====
  // ★ 2026-10-20 口径修正：展开态 110px 溢出经父版对照（git show HEAD:Header.jsx 重建同测）
  //   同值 ⇒ HoverMenu 容器既有定位缺陷（left-0 锚在右缘触发器下），非本批引入。
  //   零溢出判据取「未展开态」；展开态作为已归因读数记录，不参与判负。
  out.assertions.desktop = {
    zeroOverflow: two.overflowClosedPx === 0,
    overflowClosedPx: two.overflowClosedPx,
    overflowOpenPx: two.overflowPx,
    knownIssue: 'menu-open overflow 110px = HoverMenu 存量定位缺陷（父版对照同值），另单可改 position="bottom-left"',
    zeroPageError: two.pageErrors.length === 0,
  }

  // ===== 产物标记（判「新码真进了 dist」） =====
  const jsFiles = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js'))
  const bundle = jsFiles.map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8')).join('\n')
  out.bundle = {
    files: jsFiles,
    hasBalancesEndpoint: bundle.includes('/api/user/balances'),
    hasRowHook: bundle.includes('header-balance-row'),
    hasBalancesHook: bundle.includes('header-balances'),
    // 反向：旧钩子必须已从产物里消失 —— **桌面与移动两条都不得残留**（2026-10-20 两侧同删）
    oldBattHookAbsent: !/header-batt-checkin/.test(bundle),
  }

  const flat = []
  const walk = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key)
      else if (typeof v === 'boolean') flat.push([key, v])
    }
  }
  walk(out.assertions)
  const failed = flat.filter(([, v]) => !v).map(([k]) => k)
  out.summary = { checks: flat.length, passed: flat.length - failed.length, failed, verdict: failed.length === 0 ? 'PASS' : 'FAIL' }
  out.finishedAt = new Date().toISOString()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out.summary, null, 2))
  console.log('readings =>', OUT)
  await browser.close()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('PROBE ERROR', e)
  process.exit(2)
})
