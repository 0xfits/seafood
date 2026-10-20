/**
 * /profile/assets + /wage 前端探针（Kevin 2026-10-20 需求①②③④ 收尾单 · 步 2）
 *
 * 口径（逐条对齐派单验证项）：
 *   ① `/profile/assets`（登录 mock）⇒ BTTC 资产块在场：余额 12 +【铸造】+【分解】；
 *   ② `/wage` ⇒ **无签到按钮**、**无「连续签到天数」文案**，但**电量点阵仍在**（工资累积展示依赖它）；
 *   ③ claim 响应带 `streak:3` + `bonus_amount:'4'` ⇒ 卡内提示含「已连续 3 次领工资」与「$4」；
 *   ④ 390 / 1536 两档：两条路由各自 `scrollWidth - clientWidth = 0` + 零 pageerror。
 *
 * 手法（同 ops/wage/front/probe-wage.mjs 体例）：
 *   · 静态服务 = context.route 把 `http://sf.local/**` 映射到磁盘 `frontend/dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node probe-profile-assets.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-assets/readings/probe-profile-assets.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

// 负控臂（尺子灵敏度自证）：PROBE_NEG=1 ⇒ ①claim 响应抽掉 streak/bonus；②往电量卡里注入
//   「签到」按钮 + 「连续签到天数」文案。若探针仍全绿 ⇒ 判据是死尺子（对本次改动不敏感）。
const NEG = process.env.PROBE_NEG === '1'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

// ---- 夹具（探针内内存 JSON；行形状 = 已冻结的 project 读口 15 键 + 登录态三键） ------------------
const ROWS = [
  // ① 在职 + 可领（无 next_claim_at）⇒【领工资】可点（③ 的 streak/bonus 臂就打这张卡）
  { project_id: 101, snowflake_id: '7101', title: '海鲜打包', description: '每天打包 20 单，按批结算。', headcount: 3, hired_count: 2, wage_batt_per_claim: 30, wage_cid: 4, wage_currency_amount: 20, wage_interval_hours: 4, status: 'recruiting', my_role: 'hired', my_hired_at: '2026-10-18T02:00:00.000Z' },
  { project_id: 102, snowflake_id: '7102', title: '冷库分拣', description: '早班分拣冻品。', headcount: 4, hired_count: 1, wage_batt_per_claim: 25, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 6, status: 'recruiting', my_role: 'none' },
  { project_id: 103, snowflake_id: '7103', title: '文案校对', description: '校对商品描述与错别字。', headcount: 5, hired_count: 2, wage_batt_per_claim: 20, wage_cid: 4, wage_currency_amount: 50, wage_interval_hours: 8, status: 'recruiting', my_role: 'none' },
]

const CUR = [{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }]

// 读口 `/api/batt` 的 bttc 子对象（canMint/canBurn 皆为真 ⇒ 两个按钮在场且可点）
const BATT = {
  batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
  bttc: {
    balance: '12', status: 'listed', canMint: true, canBurn: true, usdBalance: '5',
    policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 },
  },
}

const STATE = {
  // ③：领工资成功响应（带加性 streak / bonus_amount；next_claim_at 给未来值 ⇒ 领完卡面置灰 + 倒计时）
  claimData: {
    wage_batt: 30,
    wage_currency_amount: 20,
    ...(process.env.PROBE_NEG === '1' ? {} : { streak: 3, bonus_amount: '4' }),
    next_claim_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  },
  rows: ROWS.map((r) => ({ ...r })),
  calls: [],
}

const apiResponse = (method, pathname) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/project/all') {
    STATE.calls.push({ method, path: pathname })
    return ok(STATE.rows)
  }
  if (pathname === '/api/currencies') return ok(CUR)
  if (pathname === '/api/batt') {
    STATE.calls.push({ method, path: pathname })
    return ok(BATT)
  }
  const claim = pathname.match(/^\/api\/project\/(\d+)\/claim$/)
  if (claim && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    // 成功 ⇒ 之后列表重拉要带新的 next_claim_at（真源在服务端）
    STATE.rows = STATE.rows.map((r) => (
      String(r.project_id) === claim[1] ? { ...r, next_claim_at: STATE.claimData.next_claim_at } : r
    ))
    return ok(STATE.claimData)
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数（一次性取全，供判据） ------------------------------------------------------------
const SNAP_FN = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const btnTexts = (root) => (root ? [...root.querySelectorAll('button')].map((b) => ({
    text: txt(b), disabled: !!b.disabled,
  })) : [])
  const assetRoot = q('[data-sf-m="bttc-asset"]')
  const assetCard = q('[data-sf-m="bttc-asset-card"]')
  const card = document.getElementById('batt-checkin')
  const wrap = q('[data-sf-m="wage-checkin"]')
  const meter = q('[data-sf-m="batt-meter"]')
  const list = q('[data-sf-m="wage-list"]')
  const notice = q('[data-sf-m="wage-card-notice"]')
  const cr = card ? card.getBoundingClientRect() : null
  const lr = list ? list.getBoundingClientRect() : null
  const assetBtns = btnTexts(assetRoot)
  const checkinBtns = btnTexts(card)
  // 横向溢出归因：列出右缘越界的元素（用来把「存量侧栏溢出」与「本单新增面板溢出」分开）
  const cw = de.clientWidth
  const offenders = [...document.querySelectorAll('*')].filter((el) => {
    const b = el.getBoundingClientRect()
    return b.width > 0 && b.right > cw + 1
  }).map((el) => ({
    sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')}`,
    right: Math.round(el.getBoundingClientRect().right),
    insideAssetsPane: !!el.closest('[data-sf-m="profile-assets-view"]'),
  }))
  return {
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - cw,
    offenders,
    pathname: location.pathname,
    assets: {
      panePresent: !!q('[data-sf-m="profile-assets-view"]'),
      cardPresent: !!assetCard,
      panelPresent: !!assetRoot,
      panelText: txt(assetRoot),
      symbolText: assetRoot ? txt(assetRoot.querySelector('span')) : null,
      balanceText: assetRoot ? txt(assetRoot.querySelector('span.text-2xl')) : null,
      battSummary: txt(q('[data-sf-m="bttc-asset-batt"]')),
      buttons: assetBtns,
      shortfallPresent: !!q('[data-sf-m="bttc-mint-shortfall"]'),
    },
    wage: {
      wrapperPresent: !!wrap,
      hasCard: !!card,
      cardId: card ? card.id : null,
      hasMeter: !!meter,
      meterText: txt(meter),
      checkinButtonTexts: checkinBtns.map((b) => b.text),
      cardText: card ? txt(card) : null,
      pageText: txt(q('#root')),
      cardBottom: cr ? Math.round(cr.bottom * 10) / 10 : null,
      listTop: lr ? Math.round(lr.top * 10) / 10 : null,
      listPresent: !!list,
      listBelowCard: !!(cr && lr && cr.bottom <= lr.top),
      page: {
        hasPage: !!q('[data-sf-m="wage-page"]'),
        hasList: !!q('[data-sf-m="wage-list"]'),
      },
    },
    claim: {
      noticePresent: !!notice,
      noticeKind: notice ? notice.getAttribute('data-sf-kind') : null,
      noticeText: txt(notice),
      streakHookPresent: !!q('[data-sf-m="wage-card-streak"]'),
      streakText: txt(q('[data-sf-m="wage-card-streak"]')),
      claimedCardText: txt(q('[data-sf-project="101"]')),
      actionText: txt(q('[data-sf-project="101"] [data-sf-action="claim"]')),
      actionDisabled: (() => {
        const b = q('[data-sf-project="101"] [data-sf-action="claim"]')
        return b ? !!b.disabled : null
      })(),
    },
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
    // 非本站主机（字体 / 外链）：回 204 空体而不是 abort —— abort 会在 console 里留 ERR_FAILED，
    //   混进读数把「资源类噪声」误读成脚本异常（本单判据是零 pageerror）。
    if (u.hostname !== 'sf.local') return route.fulfill({ status: 204, body: '' })
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname)) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

const seedAuth = (ctx, neg = false) => ctx.addInitScript((negArm) => {
  localStorage.setItem('theme', 'light')
  localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }))
  localStorage.setItem('token', 'probe-token')
  if (!negArm) return
  // 负控注入：把「签到按钮 / 连续签到天数」塞回电量卡 ⇒ 负断言必须转红（否则判据无效）
  const inject = () => {
    const card = document.getElementById('batt-checkin')
    if (!card || card.querySelector('#neg-injected')) return
    const box = card.querySelector('.space-y-3') || card
    const span = document.createElement('span')
    span.id = 'neg-injected'
    span.textContent = '连续签到天数: 3'
    const btn = document.createElement('button')
    btn.textContent = '签到'
    box.appendChild(span)
    box.appendChild(btn)
  }
  setInterval(inject, 150)
}, neg)

const newPageWith = async (browser, viewport, pageErrors, consoleErrors, resourceErrors) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  seedAuth(context, NEG)
  await attachRoutes(context)
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text().slice(0, 200)
    // 非 sf.local 主机的字体/外链在 route 里被 abort ⇒ 记作资源类（非脚本异常），单独归档
    if (/Failed to load resource/i.test(text)) resourceErrors.push(text)
    else consoleErrors.push(text)
  })
  return page
}

const open = async (page, url, waitHook) => {
  await page.goto(ORIGIN + url, { waitUntil: 'load' })
  await settle(page)
  if (waitHook) await page.waitForSelector(waitHook, { timeout: 8000 }).catch(() => {})
  await settle(page)
  return page.evaluate(SNAP_FN)
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const pageErrors = []
  const consoleErrors = []
  const resourceErrors = []

  const out = {
    probe: 'ops/profile-assets/probe-profile-assets.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: {
      rows: ROWS.length,
      hired: ROWS.filter((r) => r.my_role === 'hired').length,
      claimData: STATE.claimData,
      auth: 'localStorage seed only（零真登录）',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {}, assertions: {}, pageErrors, consoleErrors, resourceErrors,
  }

  // ======================= 1536 桌面档 =======================
  const page = await newPageWith(browser, { width: 1536, height: 960 }, pageErrors, consoleErrors, resourceErrors)

  // ---- ① /profile/assets：BTTC 余额 + 【铸造】/【分解】在场 ----
  STATE.calls.length = 0
  const assetSnap = await open(page, '/profile/assets', '[data-sf-m="bttc-asset"]')
  const assetCalls = STATE.calls.map((c) => `${c.method} ${c.path}`)
  out.states['1536_assets'] = { assets: assetSnap.assets, overflowPx: assetSnap.overflowPx, apiCalls: assetCalls }
  const mintLabel = ZH.bttcPanel.mintButton
  const burnLabel = ZH.bttcPanel.burnButton
  const btns = assetSnap.assets.buttons
  out.assertions.assets = {
    panePresent: assetSnap.assets.panePresent === true,
    panelPresent: assetSnap.assets.panelPresent === true,
    balanceIs12: assetSnap.assets.balanceText === '12',
    symbolIsBttc: /\u20bf BTTC|BTTC/.test(assetSnap.assets.panelText || ''),
    mintPresent: btns.some((b) => b.text === mintLabel),
    burnPresent: btns.some((b) => b.text === burnLabel),
    mintEnabled: btns.some((b) => b.text === mintLabel && b.disabled === false),
    burnEnabled: btns.some((b) => b.text === burnLabel && b.disabled === false),
    battSummaryPresent: Boolean(assetSnap.assets.battSummary),
    readsWired: assetCalls.includes('GET /api/batt'),
    zeroOverflow: assetSnap.overflowPx === 0,
  }
  out.assertions.assets.buttonTexts = btns.map((b) => b.text)

  // ---- ② /wage：无签到按钮 / 无连续签到天数，电量点阵仍在 ----
  STATE.calls.length = 0
  const wageSnap = await open(page, '/wage', '[data-sf-m="wage-checkin"]')
  const checkinButton = ZH.checkinPanel.checkinButton
  const streakDaysText = ZH.checkinPanel.streakDays
  out.states['1536_wage'] = { wage: wageSnap.wage, overflowPx: wageSnap.overflowPx, apiCalls: STATE.calls.map((c) => c.path) }
  out.assertions.wageNoCheckin = {
    cardPresent: wageSnap.wage.hasCard === true && wageSnap.wage.cardId === 'batt-checkin',
    meterPresent: wageSnap.wage.hasMeter === true,
    meterHasBatt: /70/.test(wageSnap.wage.meterText || ''),
    noCheckinButton: !(wageSnap.wage.checkinButtonTexts || []).includes(checkinButton),
    noStreakDaysInCard: !String(wageSnap.wage.cardText || '').includes(streakDaysText),
    noStreakDaysInPage: !String(wageSnap.wage.pageText || '').includes(streakDaysText),
    noMakeupCopy: !String(wageSnap.wage.pageText || '').includes(ZH.checkinPanel.makeupButton)
      && !String(wageSnap.wage.pageText || '').includes(ZH.checkinPanel.brokenHint),
    listBelowCard: wageSnap.wage.listBelowCard === true,
    zeroOverflow: wageSnap.overflowPx === 0,
    checkinButtonTexts: wageSnap.wage.checkinButtonTexts,
  }

  // ---- ③ claim 响应带 streak:3 + bonus_amount:'4' ----
  STATE.calls.length = 0
  await page.click('[data-sf-project="101"] [data-sf-action="claim"]')
  await page.waitForSelector('[data-sf-m="wage-card-notice"]', { timeout: 8000 }).catch(() => {})
  await settle(page)
  const claimSnap = await page.evaluate(SNAP_FN)
  const expectedStreak = ZH.wage.streakReward.replace('{{n}}', '3').replace('{{bonus}}', '4')
  out.states['1536_claim'] = {
    claim: claimSnap.claim,
    expectedStreakText: expectedStreak,
    apiCalls: STATE.calls.map((c) => `${c.method} ${c.path}`),
  }
  out.assertions.claimStreak = {
    noticePresent: claimSnap.claim.noticePresent === true,
    noticeKind: claimSnap.claim.noticeKind,
    streakLinePresent: claimSnap.claim.streakHookPresent === true,
    streakTextExact: claimSnap.claim.streakText === expectedStreak,
    containsStreak3: String(claimSnap.claim.noticeText || '').includes('已连续 3 次领工资'),
    containsBonus4: String(claimSnap.claim.noticeText || '').includes('$4'),
    claimedStillShown: String(claimSnap.claim.noticeText || '').includes('30'),
    claimPostedOnce: STATE.calls.filter((c) => c.method === 'POST' && /\/claim$/.test(c.path)).length === 1,
    // 领完用服务端新 next_claim_at 置灰 + 倒计时
    nextClaimGated: claimSnap.claim.actionDisabled === true,
  }

  // ======================= 390 手机档 =======================
  // ★ 手机档必须先把夹具复位（1536 档那一发 claim 已把 next_claim_at 写进 STATE.rows，
  //   不复位则手机档卡面初始即置灰、claim 臂结构上不可达）。
  const resetRows = () => { STATE.rows = ROWS.map((r) => ({ ...r })) }
  resetRows()
  const mErrors = []
  const mConsole = []
  const mResource = []
  const mpage = await newPageWith(browser, { width: 390, height: 844 }, mErrors, mConsole, mResource)
  const mAsset = await open(mpage, '/profile/assets', '[data-sf-m="bttc-asset"]')
  // 存量对照臂：`/profile/settings` 与 `/profile/assets` 同属 ProfilePage 外壳（侧栏 `sf-prof-nav` 同一份）
  //   ⇒ 它在本单之前就存在；两者溢出量相等 ⇒ /profile/assets 的溢出 100% 归因于存量侧栏，不是本单新增。
  const mControl = await open(mpage, '/profile/settings', '[data-sf-m="profile-content"]')
  const mWage = await open(mpage, '/wage', '[data-sf-m="wage-checkin"]')
  await mpage.click('[data-sf-project="101"] [data-sf-action="claim"]').catch(() => {})
  await mpage.waitForSelector('[data-sf-m="wage-card-notice"]', { timeout: 8000 }).catch(() => {})
  await settle(mpage)
  const mClaim = await mpage.evaluate(SNAP_FN)
  out.states['390'] = {
    assets: { assets: mAsset.assets, overflowPx: mAsset.overflowPx, offenders: mAsset.offenders },
    control_settings: { overflowPx: mControl.overflowPx, offenders: mControl.offenders },
    wage: { wage: mWage.wage, overflowPx: mWage.overflowPx, offenders: mWage.offenders },
    claim: { claim: mClaim.claim, overflowPx: mClaim.overflowPx },
    resourceErrors: mResource.length,
  }
  const assetsPaneOffenders = (mAsset.offenders || []).filter((o) => o.insideAssetsPane)
  out.assertions.mobile390 = {
    // 归因式判据：资产面板本体零越界 + 溢出量与存量对照臂（/profile/settings）逐相等
    assetsPaneNoOffenders: assetsPaneOffenders.length === 0,
    assetsOverflowEqualsStockControl: mAsset.overflowPx === mControl.overflowPx,
    wageZeroOverflow: mWage.overflowPx === 0,
    claimZeroOverflow: mClaim.overflowPx === 0,
    assetsPanelPresent: mAsset.assets.panelPresent === true,
    assetsBalanceIs12: mAsset.assets.balanceText === '12',
    mintBurnPresent: mAsset.assets.buttons.some((b) => b.text === mintLabel)
      && mAsset.assets.buttons.some((b) => b.text === burnLabel),
    meterPresent: mWage.wage.hasMeter === true,
    noCheckinButton: !(mWage.wage.checkinButtonTexts || []).includes(checkinButton),
    noStreakDays: !String(mWage.wage.pageText || '').includes(streakDaysText),
    streakLinePresent: mClaim.claim.streakHookPresent === true,
    zeroPageError: mErrors.length === 0 && mResource.length === 0,
  }
  out.states['390'].assetsPaneOffenders = assetsPaneOffenders

  // ======================= 汇总 =======================
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  ))
  // 只有布尔项参与判定；数组/字符串项是「读数回填」（供人复核），不计分
  const evaluated = [
    ...flat(out.assertions.assets),
    ...flat(out.assertions.wageNoCheckin),
    ...flat(out.assertions.claimStreak),
    ...flat(out.assertions.mobile390),
  ].filter(([, v]) => typeof v === 'boolean')
  const failed = evaluated.filter(([, v]) => v !== true).map(([k, v]) => [k, v])
  out.summary = {
    checks: evaluated.length,
    passed: evaluated.length - failed.length,
    failed,
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
    resourceErrors: resourceErrors.length,
    verdict: NEG
      ? (failed.length > 0 ? 'NEG_ARM_RED_AS_EXPECTED' : 'NEG_ARM_STILL_GREEN_RULER_DEAD')
      : (failed.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0 ? 'PASS' : 'FAIL'),
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
