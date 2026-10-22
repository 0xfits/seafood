/**
 * 后台两页下架 · 收尾探针（Kevin 2026-10-22 · /dashboard/listing-review 与 /dashboard/rewards 下架）
 *
 * 验证项（逐条对齐派单）：
 *   ① 旧 URL 不再是这两页：`/dashboard/rewards` 与 `/dashboard/listing-review` 打开后，
 *      主内容区（AdminLayout 的 `<main>`）为**空**（react-router v6 父路由 `/dashboard/*` 仍匹配、
 *      子路由无匹配 ⇒ 壳在、Outlet 空；**不是** 404 页、也无重定向 —— 行为按现路由树如实判），
 *      且两页的页面标记（`奖品管理` / `商品合规审核` h2）零出现；
 *   ② 侧栏零残留 + 其余项在场：`nav` 里 `/dashboard/rewards`、`/dashboard/listing-review`
 *      两个 href 零出现；dashboard / tasks / shards / users / permissions / points / settings /
 *      fee-rate / weight-matrix / currency-review / arbitration-review / site-text / audit-console
 *      十三项 href 全在场；
 *   ③ `/dashboard/tasks` 正常：`/api/campaign/all` 恰 1 次、主区含「任务管理」（TasksManagement）；
 *   ④ 1536 / 390 两档：三个被访 URL（两旧 URL + tasks）**零横向溢出**（scrollWidth-clientWidth===0，
 *      设计内横滚容器只记 scrollContained）、**零 pageerror**；
 *   ⑤ 全程零 `/api/prize/all`、零 `/api/admin/listing` 命中（下架页的读口，UI 已无引用；后端口保留）。
 *
 * 手法（同 ops/task-page/probe-task-list.mjs 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到 `frontend/dist`（零 dev server）；
 *   · 管理员会话 = localStorage 种子 + `/api/admin/me` 自截（is_admin=true；零后端 / 零库写）；
 *   · 判据显式合成每臂 `pass`（读数不参与总判）。
 *
 * 用法：QA_DIST=<dist> node remove-review-rewards.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/dashboard/readings/remove-review-rewards.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const UID = 970214

// 夹具（campaign 读口行形状逐字对齐 i18n-batch-b4a 的 mock：任务管理面板走 `GET /api/campaign/all`）
const CAMPAIGN_ROWS = [{
  campaign_id: 501,
  title: '秋季招募',
  status: 'active',
  tasks: [{ task_id: 55, title: 'Task A', description: '', status: 'active', reward_amount_primary: '10' }],
}]

const STATE = { calls: [] }
const ok = (data) => ({ success: true, data })

const apiResponse = (method, pathname) => {
  STATE.calls.push({ method, path: pathname })
  if (pathname === '/api/admin/me') {
    return ok({ is_admin: true, permissions: [], can_access_admin: true, preferred_admin_path: '/dashboard' })
  }
  if (pathname === '/api/campaign/all') return ok(CAMPAIGN_ROWS)
  if (pathname === '/api/user') return ok({ uID: UID, uid: UID, name: 'Probe', admin: {} })
  if (pathname === `/api/user/asset/${UID}`) return ok({ points: 0, time_update: null })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0, tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 })
  return ok({})
}

// ---- 页内读数 ---------------------------------------------------------------------------------
const SNAP_FN = () => {
  const de = document.documentElement
  const main = document.querySelector('main')
  const sidebarLinks = [...document.querySelectorAll('nav a[href^="/dashboard"]')]
    .map((a) => a.getAttribute('href'))
  const inScrollX = (el) => {
    for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return p
    }
    return null
  }
  const scrollContainers = new Set()
  const offenders = []
  for (const el of document.querySelectorAll('*')) {
    const b = el.getBoundingClientRect()
    if (!(b.width > 0 && b.right > de.clientWidth + 1)) continue
    const sc = inScrollX(el)
    if (sc) { scrollContainers.add(sc); continue }
    if (offenders.length < 8) {
      offenders.push({
        sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}`,
        right: Math.round(b.right),
      })
    }
  }
  return {
    pathname: location.pathname,
    overflowPx: de.scrollWidth - de.clientWidth,
    scrollContained: scrollContainers.size,
    offenders,
    // AdminLayout 壳：侧栏 href 清单 + 主区（Outlet 落点）文本
    sidebarHrefs: sidebarLinks,
    hasNotFoundHook: !!document.querySelector('[data-sf-m="not-found-page"]'),
    mainEmpty: main ? main.textContent.replace(/\s+/g, '').length === 0 : null,
    mainText: main ? main.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null,
    bodyHasPrizeH2: document.body.innerText.includes('奖品管理'),
    bodyHasListingH2: document.body.innerText.includes('商品合规审核'),
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

const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') return route.fulfill({ status: 204, body: '' })
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse(req.method(), u.pathname)),
      })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

// 管理员会话 = localStorage 种子（getStoredUser 读 `user` + `token`；权限面走自截的 /api/admin/me）
const seed = (ctx) => ctx.addInitScript((uid) => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: uid, uid, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
}, UID)

const newPageWith = async (browser, viewport) => {
  const pageErrors = []
  const consoleErrors = []
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seed(context)
  await attachRoutes(context)
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    let p = ''
    try { p = new URL(page.url()).pathname } catch { p = '' }
    consoleErrors.push(`${p} :: ${m.text().slice(0, 300)}`)
  })
  return { page, pageErrors, consoleErrors }
}

const open = async (page, url) => {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  return page.evaluate(SNAP_FN)
}

const SIDEBAR_ABSENT = ['/dashboard/rewards', '/dashboard/listing-review']
const SIDEBAR_PRESENT = [
  '/dashboard', '/dashboard/tasks', '/dashboard/shards', '/dashboard/users',
  '/dashboard/permissions', '/dashboard/points', '/dashboard/settings', '/dashboard/fee-rate',
  '/dashboard/weight-matrix', '/dashboard/currency-review', '/dashboard/arbitration-review',
  '/dashboard/site-text', '/dashboard/audit-console',
]

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/dashboard/remove-review-rewards.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: {
      auth: 'localStorage seed + 自截 /api/admin/me（is_admin=true；零真登录 / 零后端 / 零库写）',
      api: 'context.route in-probe JSON；campaign/all 一行两任务',
    },
    states: {},
    assertions: {},
  }

  for (const [label, viewport] of [['1536', { width: 1536, height: 960 }], ['390', { width: 390, height: 844 }]]) {
    const { page, pageErrors } = await newPageWith(browser, viewport)

    // ① `/dashboard/rewards` 不再是奖品管理页
    STATE.calls.length = 0
    const rewardsSnap = await open(page, '/dashboard/rewards')
    out.states[`${label}_rewards`] = rewardsSnap
    const rewardsArm = {
      shellInPlace: rewardsSnap.sidebarHrefs.length === SIDEBAR_PRESENT.length,
      mainEmpty: rewardsSnap.mainEmpty === true,
      noPrizeH2: rewardsSnap.bodyHasPrizeH2 === false,
      noNotFoundPage: rewardsSnap.hasNotFoundHook === false, // 行为读数：落管理壳空 Outlet，非 404 页
      noPrizeApi: STATE.calls.every((c) => !c.path.startsWith('/api/prize')),
    }
    out.assertions[`rewardsPageGone_${label}`] = {
      ...rewardsArm,
      behavior: 'AdminLayout 壳渲染（/dashboard/* 父路由匹配、子路由无匹配 ⇒ Outlet 空；非 404/非重定向）',
      pass: rewardsArm.shellInPlace && rewardsArm.mainEmpty && rewardsArm.noPrizeH2 && rewardsArm.noNotFoundPage && rewardsArm.noPrizeApi,
    }

    // ① `/dashboard/listing-review` 不再是商品审核页
    STATE.calls.length = 0
    const listingSnap = await open(page, '/dashboard/listing-review')
    out.states[`${label}_listing_review`] = listingSnap
    const listingArm = {
      shellInPlace: listingSnap.sidebarHrefs.length === SIDEBAR_PRESENT.length,
      mainEmpty: listingSnap.mainEmpty === true,
      noListingH2: listingSnap.bodyHasListingH2 === false,
      noNotFoundPage: listingSnap.hasNotFoundHook === false,
      noListingApi: STATE.calls.every((c) => !c.path.startsWith('/api/admin/listing')),
    }
    out.assertions[`listingReviewPageGone_${label}`] = {
      ...listingArm,
      behavior: '同上：AdminLayout 壳 + 空 Outlet',
      pass: listingArm.shellInPlace && listingArm.mainEmpty && listingArm.noListingH2 && listingArm.noNotFoundPage && listingArm.noListingApi,
    }

    // ② 侧栏零残留 + 其余项在场（借用 tasks 页的壳读数） + ③ tasks 正常
    STATE.calls.length = 0
    const tasksSnap = await open(page, '/dashboard/tasks')
    out.states[`${label}_tasks`] = tasksSnap
    const campaignCalls = STATE.calls.filter((c) => c.path === '/api/campaign/all').length
    const sidebarArm = {
      absentGone: SIDEBAR_ABSENT.every((h) => !tasksSnap.sidebarHrefs.includes(h)),
      presentAll: SIDEBAR_PRESENT.every((h) => tasksSnap.sidebarHrefs.includes(h)),
      sidebarCount: tasksSnap.sidebarHrefs.length,
    }
    out.assertions[`sidebarClean_${label}`] = {
      ...sidebarArm,
      pass: sidebarArm.absentGone && sidebarArm.presentAll && tasksSnap.sidebarHrefs.length === SIDEBAR_PRESENT.length,
    }
    const tasksArm = {
      mainNotEmpty: tasksSnap.mainEmpty === false,
      tasksH2: (tasksSnap.mainText || '').includes('任务管理'),
      campaignAllOnce: campaignCalls === 1,
    }
    out.assertions[`tasksIntact_${label}`] = { ...tasksArm, pass: tasksArm.mainNotEmpty && tasksArm.tasksH2 && tasksArm.campaignAllOnce }

    // ④ 几何 / 稳定：三 URL 零溢出、零 pageerror
    const geoArm = {
      overflow: { rewards: rewardsSnap.overflowPx, listing: listingSnap.overflowPx, tasks: tasksSnap.overflowPx },
      offenders: { rewards: rewardsSnap.offenders, listing: listingSnap.offenders, tasks: tasksSnap.offenders },
      scrollContained: { rewards: rewardsSnap.scrollContained, listing: listingSnap.scrollContained, tasks: tasksSnap.scrollContained },
      pageErrors,
    }
    out.assertions[`geometry_${label}`] = {
      ...geoArm,
      pass: geoArm.overflow.rewards === 0 && geoArm.overflow.listing === 0 && geoArm.overflow.tasks === 0 && pageErrors.length === 0,
    }

    await page.context().close()
  }

  // ⑤ 全程零下架页读口命中（prize/all 与 admin/listing 由 ①② 臂分别断言，这里汇总留痕）
  out.assertions.retiredEndpointsSummary = {
    note: 'GET /api/prize/all 与 GET /api/admin/listing 后端口保留（无 UI 后闲置无害）；本探针全程零命中由两臂 noPrizeApi / noListingApi 分担',
  }

  out.pass = Object.entries(out.assertions).every(([k, v]) => (k === 'retiredEndpointsSummary' ? true : v.pass === true))
  out.finishedAt = new Date().toISOString()

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  const lines = Object.entries(out.assertions)
    .filter(([k]) => k !== 'retiredEndpointsSummary')
    .map(([k, v]) => `${v.pass ? 'PASS' : 'FAIL'} ${k}`)
  console.log(lines.join('\n'))
  console.log(`TOTAL ${out.pass ? 'PASS' : 'FAIL'} → ${OUT}`)
  await browser.close()
  process.exit(out.pass ? 0 : 1)
}

run().catch((e) => { console.error('PROBE CRASH:', e); process.exit(2) })
