/**
 * 项目页 `/:slug` · 项目金库区探针（★ Kevin 2026-10-23 ② · 迁移 0073）
 *
 * 判据（逐条对齐派单验证项）：
 *   ① 行数与余额匹配：金库区行数 = 读口 `vault[]` 行数、逐行 `data-sf-cid` 对齐、余额文案 =
 *      `project.vaultLine`（`{{symbol}} 余额 {{balance}}`，`balance` 是后端已换算的十进制串 ⇒ 前端零换算）；
 *      登录用户 `data-sf-authed="1"`、每行**金额输入 + 【充值】钮**（`data-sf-action="vault-recharge"`）都在场。
 *   ② 匿名只读（独立 context、无登录种子）：区仍在、行仍渲染余额，但**零输入、零充值钮**、零写请求。
 *   ③ 充值成功（mock 路由桩）：填 250 点【充值】⇒ 恰 1 次 `POST /api/project/:id/vault/recharge`，
 *      载荷**恰** `{cid, amount}`（amount 原样字符串，不在前端换算/四舍五入）；响应余额 = 1250
 *      ⇒ 内联 ok（`project.vaultRechargeOk`，金额/符号/新余额三参）+ 静默重拉 ⇒ 该行余额行刷新为 1250、
 *      输入框清空、零错误残留。
 *   ④ 失败臂（内联 + 机读三件）：
 *      · 空金额（本地前置闸）⇒ **零请求**、`data-sf-err-code="PROJECT_VAULT_AMOUNT_INVALID"`；
 *      · 服务端 400 `VAULT_RECHARGE_INSUFFICIENT` ⇒ 内联 err、`data-sf-err-code/-reason/-status` 全在场、
 *        文案 = `project.vaultFailDetail` 套中文映射、**不重拉**（余额不变）。
 *   ⑤ 形态两负控（读口形状决定渲不渲）：
 *      · 空金库 ∧ 有次币腿 ⇒ 合成一条 0 余额行（登录用户有充值入口）；
 *      · 空金库 ∧ 无次币腿 ⇒ 整区不渲染。
 *   ⑥ 390 / 1536 两档：`scrollWidth - clientWidth = 0`、行不出视口 + 零 pageerror。
 *
 * 手法（= ops/project-page/probe-project-page.mjs）：
 *   · 静态服务 = `context.route` 把 http://sf.local/** 映射到磁盘 dist（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全部在 `context.route` 内自截（零后端 / 零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node ops/project/probe-project-vault.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/project/readings/probe-project-vault.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const VIEWER_UID = 971001
const PROJECT_ID = 11
const BTTC = { cid: 4, symbol: 'BTTC', balance: '1000' }
const USDT = { cid: 7, symbol: 'USDT', balance: '25.5' }

const baseView = (patch = {}) => ({
  project_id: PROJECT_ID,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单，按批结算。',
  headcount: 3,
  hired_count: 1,
  recruit_min_account_days: 1,
  wage_batt_per_claim: 30,
  wage_cid: 4,
  wage_currency_amount: 20,
  wage_interval_hours: 4,
  status: 'recruiting',
  my_role: 'none',
  owner_uid: '970213',
  avatar_url: null,
  campaigns: [],
  vault: [{ ...BTTC }, { ...USDT }],
  ...patch,
})

const STATE = {
  view: baseView(),
  userPayload: { uID: VIEWER_UID },
  rechargeMode: 'ok', // ok | insufficient | cid_invalid
  calls: [],
  bodies: [],
}

const ok = (data) => ({ success: true, data })
const fail = (status, code, details) => ({
  __status: status,
  body: { success: false, error: { code, details } },
})

const vaultOf = () => (Array.isArray(STATE.view.vault) ? STATE.view.vault : [])

const apiResponse = (method, pathname, rawBody) => {
  const body = (() => {
    try { return rawBody ? JSON.parse(rawBody) : null } catch { return null }
  })()
  if (pathname === '/api/user') return ok(STATE.userPayload)
  if (pathname === '/api/currencies') return ok([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }, { cid: 7, symbol: 'USDT' }])
  if (pathname === '/api/project/sui') { STATE.calls.push({ method, path: pathname }); return ok(STATE.view) }
  if (pathname === '/api/project/all') return ok([])
  if (pathname === '/api/batt') {
    return ok({
      batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true,
      bttc: { balance: '0', status: 'listed', canMint: false, canBurn: false, usdBalance: '0', policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1 } },
    })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })

  const recharge = pathname.match(/^\/api\/project\/(\d+)\/vault\/recharge$/)
  if (recharge && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    STATE.bodies.push({ projectId: recharge[1], body })
    if (STATE.rechargeMode === 'insufficient') {
      return fail(400, 'VAULT_RECHARGE_INSUFFICIENT', {
        reason: 'VAULT_RECHARGE_INSUFFICIENT', need: body?.amount, have: '10',
      })
    }
    if (STATE.rechargeMode === 'cid_invalid') {
      return fail(400, 'PROJECT_VAULT_CID_INVALID', { reason: 'PROJECT_VAULT_CID_INVALID', cid: body?.cid })
    }
    const cid = Number(body?.cid)
    const add = Number(body?.amount)
    const rows = vaultOf().map((row) => (
      Number(row.cid) === cid
        ? { ...row, balance: String(Number(row.balance || '0') + (Number.isFinite(add) ? add : 0)) }
        : row
    ))
    STATE.view = { ...STATE.view, vault: rows }
    const row = rows.find((r) => Number(r.cid) === cid) || {}
    return ok({
      project_id: PROJECT_ID, cid, symbol: row.symbol ?? '', amount: String(body?.amount ?? ''),
      balance: String(row.balance ?? '0'), vault: rows,
    })
  }
  if (method === 'GET' && /^\/api\/project\/[^/]+$/.test(pathname)) {
    STATE.calls.push({ method, path: pathname })
    return fail(404, 'PROJECT_NOT_FOUND', { reason: 'project_not_found' })
  }
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数（金库区 / 行 / 输入 / 内联提示 / 几何） --------------------------------------------
const SNAP_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const section = q('[data-sf-m="project-vault"]')
  const notice = q('[data-sf-m="project-vault-notice"]')
  const rows = qa('[data-sf-m="project-vault-row"]').map((row) => {
    const cid = row.getAttribute('data-sf-cid')
    const input = row.querySelector('[data-sf-m="project-vault-amount"]')
    const btn = row.querySelector('[data-sf-action="vault-recharge"]')
    const bal = row.querySelector('[data-sf-m="project-vault-balance"]')
    const r = row.getBoundingClientRect()
    const ir = input ? input.getBoundingClientRect() : null
    return {
      cid,
      balanceText: txt(bal),
      hasInput: !!input,
      inputValue: input ? input.value : null,
      inputRight: ir ? Math.round(ir.right * 10) / 10 : null,
      hasButton: !!btn,
      buttonText: txt(btn),
      buttonDisabled: btn ? !!btn.disabled : null,
      right: Math.round(r.right * 10) / 10,
      left: Math.round(r.left * 10) / 10,
      height: Math.round(r.height * 10) / 10,
    }
  })
  return {
    pathname: location.pathname,
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    pagePresent: !!q('[data-sf-m="project-page"]'),
    vault: {
      present: !!section,
      authed: section ? section.getAttribute('data-sf-authed') : null,
      title: txt(q('[data-sf-m="project-vault-title"]')),
      rowCount: rows.length,
      rows,
      inputCount: qa('[data-sf-m="project-vault-amount"]').length,
      buttonCount: qa('[data-sf-action="vault-recharge"]').length,
      notice: notice ? {
        kind: notice.getAttribute('data-sf-kind'),
        text: txt(notice),
        cid: notice.getAttribute('data-sf-cid'),
        code: notice.getAttribute('data-sf-err-code'),
        reason: notice.getAttribute('data-sf-err-reason'),
        status: notice.getAttribute('data-sf-err-status'),
      } : null,
      right: section ? Math.round(section.getBoundingClientRect().right * 10) / 10 : null,
      left: section ? Math.round(section.getBoundingClientRect().left * 10) / 10 : null,
    },
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
      const payload = apiResponse(req.method(), u.pathname, req.postData())
      const status = payload && payload.__status ? payload.__status : 200
      const body = payload && payload.__status ? payload.body : payload
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' },
      body: fs.readFileSync(file),
    })
  })
}

const writes = () => STATE.calls.filter((c) => c.method !== 'GET')
const projectReads = () => STATE.calls.filter((c) => c.path === '/api/project/sui')
const lineOf = (symbol, balance) => ZH.project.vaultLine.replace('{{symbol}}', symbol).replace('{{balance}}', balance)

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 971001, uid: 971001, token: 'probe-token', bio: 'probe', name: 'Probe' }))
    localStorage.setItem('token', 'probe-token')
  })
  await attachRoutes(context)

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))

  const out = {
    probe: 'ops/project/probe-project-vault.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: {
      project: `${PROJECT_ID}/sui`,
      vault: [BTTC, USDT],
      viewer: VIEWER_UID,
      auth: 'localStorage seed only',
      api: 'context.route in-probe JSON（零后端 / 零库写）',
    },
    states: {}, assertions: {}, pageErrors,
  }

  const open = async (url, waitSel) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    if (waitSel) await page.waitForSelector(waitSel, { timeout: 8000 }).catch(() => {})
    await settle(page)
    return page.evaluate(SNAP_FN)
  }

  const rowOf = (snap, cid) => snap.vault.rows.find((r) => r.cid === String(cid)) || null

  // ============================ ① 登录臂：行数 / 余额 / 充值入口 ============================
  STATE.view = baseView()
  STATE.calls.length = 0
  STATE.bodies.length = 0
  const authed = await open('/sui', '[data-sf-m="project-vault"]')
  out.states['1536_authed'] = authed.vault
  out.assertions.authedRows = {
    sectionPresent: authed.vault.present === true,
    authedFlag: authed.vault.authed === '1',
    titleIsLocale: authed.vault.title === ZH.project.vaultTitle,
    // 行数 = 读口 `vault[]` 行数（2），且顺序/币种对齐
    rowCountMatchesApi: authed.vault.rowCount === 2,
    cidsInOrder: JSON.stringify(authed.vault.rows.map((r) => r.cid)) === JSON.stringify(['4', '7']),
    balanceMatchesBttc: Boolean(rowOf(authed, 4)) && rowOf(authed, 4).balanceText === lineOf('BTTC', '1000'),
    balanceMatchesUsdt: Boolean(rowOf(authed, 7)) && rowOf(authed, 7).balanceText === lineOf('USDT', '25.5'),
    inputPerRow: authed.vault.inputCount === 2
      && authed.vault.rows.every((r) => r.hasInput && r.inputValue === ''),
    buttonPerRow: authed.vault.buttonCount === 2
      && authed.vault.rows.every((r) => r.hasButton && r.buttonText === ZH.project.vaultRechargeBtn && r.buttonDisabled === false),
    noNoticeInitially: authed.vault.notice === null,
    zeroWritesOnLoad: writes().length === 0,
  }

  // ============================ ② 充值成功臂（mock 桩：1000 + 250 = 1250） ============================
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await page.fill('[data-sf-m="project-vault-row"][data-sf-cid="4"] [data-sf-m="project-vault-amount"]', '250')
  await page.click('[data-sf-m="project-vault-row"][data-sf-cid="4"] [data-sf-action="vault-recharge"]')
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-sf-m="project-vault-notice"]')
    return Boolean(n) && n.getAttribute('data-sf-kind') === 'ok'
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const afterOk = await page.evaluate(SNAP_FN)
  const okBody = STATE.bodies[0] || null
  out.states['1536_recharge_ok'] = {
    vault: afterOk.vault,
    writes: STATE.calls.filter((c) => c.method !== 'GET'),
    body: okBody,
    reads: projectReads().length,
  }
  out.assertions.rechargeOk = {
    postOnce: STATE.bodies.length === 1,
    pathIsVaultRecharge: Boolean(okBody && okBody.projectId === String(PROJECT_ID)),
    // 载荷闭集：恰 `{cid, amount}`，amount 原样字符串（前端零换算）
    bodyExactlyPair: Boolean(okBody) && JSON.stringify(okBody.body) === JSON.stringify({ cid: 4, amount: '250' }),
    amountIsString: Boolean(okBody) && typeof okBody.body?.amount === 'string',
    noticeOk: Boolean(afterOk.vault.notice && afterOk.vault.notice.kind === 'ok'),
    noticeText: Boolean(afterOk.vault.notice
      && afterOk.vault.notice.text === ZH.project.vaultRechargeOk
        .replace('{{amount}}', '250').replace('{{symbol}}', 'BTTC').replace('{{balance}}', '1250')),
    noticeCid: Boolean(afterOk.vault.notice && afterOk.vault.notice.cid === '4'),
    balanceUpdated: Boolean(rowOf(afterOk, 4)) && rowOf(afterOk, 4).balanceText === lineOf('BTTC', '1250'),
    otherRowUntouched: Boolean(rowOf(afterOk, 7)) && rowOf(afterOk, 7).balanceText === lineOf('USDT', '25.5'),
    inputCleared: Boolean(rowOf(afterOk, 4)) && rowOf(afterOk, 4).inputValue === '',
    relisted: projectReads().length >= 1,
    noErrHooks: Boolean(afterOk.vault.notice) && afterOk.vault.notice.code === '',
  }

  // ============================ ③ 本地前置闸：空金额 ⇒ 零请求 + 内联机读码 ============================
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await page.click('[data-sf-m="project-vault-row"][data-sf-cid="7"] [data-sf-action="vault-recharge"]')
  await settle(page)
  const emptyAmount = await page.evaluate(SNAP_FN)
  out.states['1536_amount_empty'] = { vault: emptyAmount.vault, writes: writes().map((c) => c.path) }
  out.assertions.amountGuard = {
    zeroRequests: writes().length === 0,
    inlineErr: Boolean(emptyAmount.vault.notice && emptyAmount.vault.notice.kind === 'err'),
    textIsLocale: Boolean(emptyAmount.vault.notice && emptyAmount.vault.notice.text === ZH.project.vaultErrAmountInvalid),
    codeHook: Boolean(emptyAmount.vault.notice && emptyAmount.vault.notice.code === 'PROJECT_VAULT_AMOUNT_INVALID'),
    cidIsRow: Boolean(emptyAmount.vault.notice && emptyAmount.vault.notice.cid === '7'),
    balanceUnchanged: Boolean(rowOf(emptyAmount, 7)) && rowOf(emptyAmount, 7).balanceText === lineOf('USDT', '25.5'),
  }

  // ============================ ④ 服务端失败臂：400 余额不足 ⇒ 内联三件、不重拉 ============================
  // 夹具复位（上一臂的成功桩把内存余额改成了 1250）⇒ 本臂基线必须是读口的原始 1000
  STATE.view = baseView()
  STATE.rechargeMode = 'insufficient'
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await open('/sui', '[data-sf-m="project-vault"]')
  const readsBeforeFail = projectReads().length
  await page.fill('[data-sf-m="project-vault-row"][data-sf-cid="4"] [data-sf-m="project-vault-amount"]', '9999')
  await page.click('[data-sf-m="project-vault-row"][data-sf-cid="4"] [data-sf-action="vault-recharge"]')
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-sf-m="project-vault-notice"]')
    return Boolean(n) && n.getAttribute('data-sf-kind') === 'err'
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const failSnap = await page.evaluate(SNAP_FN)
  out.states['1536_recharge_fail'] = {
    vault: failSnap.vault,
    writes: STATE.calls.filter((c) => c.method !== 'GET'),
    reads: { before: readsBeforeFail, after: projectReads().length },
  }
  out.assertions.rechargeFail = {
    postOnce: STATE.bodies.length === 1,
    inlineErr: Boolean(failSnap.vault.notice && failSnap.vault.notice.kind === 'err'),
    errCodeHook: Boolean(failSnap.vault.notice && failSnap.vault.notice.code === 'VAULT_RECHARGE_INSUFFICIENT'),
    errReasonHook: Boolean(failSnap.vault.notice && failSnap.vault.notice.reason === 'VAULT_RECHARGE_INSUFFICIENT'),
    errStatusHook: Boolean(failSnap.vault.notice && failSnap.vault.notice.status === '400'),
    textIsMapped: Boolean(failSnap.vault.notice
      && failSnap.vault.notice.text === ZH.project.vaultFailDetail
        .replace('{{detail}}', ZH.project.vaultErrInsufficient)
        .replace('{{status}}', '400')),
    // 失败不谎报成功、不重拉（余额仍是 1000）
    noOkNotice: !(failSnap.vault.notice && failSnap.vault.notice.kind === 'ok'),
    noRelistAfterFail: projectReads().length === readsBeforeFail,
    balanceUnchanged: Boolean(rowOf(failSnap, 4)) && rowOf(failSnap, 4).balanceText === lineOf('BTTC', '1000'),
  }

  // —— 第二条失败臂：400 币种闸（PROJECT_VAULT_CID_INVALID）⇒ 另一条中文映射 + 机读码对拍 ——
  STATE.rechargeMode = 'cid_invalid'
  STATE.view = baseView()
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await open('/sui', '[data-sf-m="project-vault"]')
  await page.fill('[data-sf-m="project-vault-row"][data-sf-cid="7"] [data-sf-m="project-vault-amount"]', '5')
  await page.click('[data-sf-m="project-vault-row"][data-sf-cid="7"] [data-sf-action="vault-recharge"]')
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-sf-m="project-vault-notice"]')
    return Boolean(n) && n.getAttribute('data-sf-err-code') === 'PROJECT_VAULT_CID_INVALID'
  }, null, { timeout: 8000 }).catch(() => {})
  await settle(page)
  const cidFail = await page.evaluate(SNAP_FN)
  out.states['1536_cid_fail'] = { vault: cidFail.vault, writes: STATE.calls.filter((c) => c.method !== 'GET') }
  out.assertions.rechargeCidFail = {
    inlineErr: Boolean(cidFail.vault.notice && cidFail.vault.notice.kind === 'err'),
    errCodeHook: Boolean(cidFail.vault.notice && cidFail.vault.notice.code === 'PROJECT_VAULT_CID_INVALID'),
    errStatusHook: Boolean(cidFail.vault.notice && cidFail.vault.notice.status === '400'),
    textIsMapped: Boolean(cidFail.vault.notice
      && cidFail.vault.notice.text === ZH.project.vaultFailDetail
        .replace('{{detail}}', ZH.project.vaultErrCidInvalid)
        .replace('{{status}}', '400')),
  }
  STATE.rechargeMode = 'ok'

  // ============================ ⑤ 形态负控：合成 0 余额行 / 整区不渲染 ============================
  // ⑤-a 空金库 ∧ 有次币腿（wage_cid=4, amount=20）⇒ 合成一条 0 余额行（登录用户能充值）
  STATE.view = baseView({ vault: [] })
  STATE.calls.length = 0
  const synth = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_synthetic_zero_row'] = synth.vault
  out.assertions.syntheticRow = {
    sectionPresent: synth.vault.present === true,
    singleRow: synth.vault.rowCount === 1,
    cidIsWageCid: Boolean(synth.vault.rows[0]) && synth.vault.rows[0].cid === '4',
    balanceZero: Boolean(synth.vault.rows[0]) && synth.vault.rows[0].balanceText === lineOf('BTTC', '0'),
    rechargeEntryPresent: synth.vault.buttonCount === 1 && synth.vault.inputCount === 1,
  }

  // ⑤-b 空金库 ∧ 无次币腿（wage_cid=null / amount=0）⇒ 整区不渲染
  STATE.view = baseView({ vault: [], wage_cid: null, wage_currency_amount: 0 })
  const none = await open('/sui', '[data-sf-m="project-page"]')
  out.states['1536_no_vault'] = none.vault
  out.assertions.noVault = {
    sectionAbsent: none.vault.present === false,
    zeroRows: none.vault.rowCount === 0,
    zeroInputs: none.vault.inputCount === 0,
    pageStillRendered: none.pagePresent === true,
  }

  // ============================ ⑥ 匿名臂（独立 context、无登录种子） ============================
  STATE.view = baseView()
  const guestCtx = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  guestCtx.addInitScript(() => { localStorage.setItem('theme', 'light') })
  await attachRoutes(guestCtx)
  const guestPage = await guestCtx.newPage()
  guestPage.on('pageerror', (e) => pageErrors.push('[guest] ' + String(e && e.message)))
  STATE.calls.length = 0
  STATE.bodies.length = 0
  await guestPage.goto(ORIGIN + '/sui', { waitUntil: 'load' })
  await settle(guestPage)
  await guestPage.waitForSelector('[data-sf-m="project-vault"]', { timeout: 8000 }).catch(() => {})
  await settle(guestPage)
  const guestSnap = await guestPage.evaluate(SNAP_FN)
  out.states['1536_guest'] = guestSnap.vault
  out.assertions.guestReadOnly = {
    sectionPresent: guestSnap.vault.present === true,
    authedFlag: guestSnap.vault.authed === '0',
    rowsVisible: guestSnap.vault.rowCount === 2,
    balancesVisible: Boolean(rowOf(guestSnap, 4)) && rowOf(guestSnap, 4).balanceText === lineOf('BTTC', '1000'),
    noInputs: guestSnap.vault.inputCount === 0,
    noButtons: guestSnap.vault.buttonCount === 0,
    zeroWrites: writes().length === 0,
  }
  await guestCtx.close()

  // ============================ ⑦ 两档几何（390 / 1536） ============================
  STATE.view = baseView()
  const geometry = {}
  for (const [label, width, height] of [['390', 390, 844], ['1536', 1536, 960]]) {
    await page.setViewportSize({ width, height })
    const snap = await open('/sui', '[data-sf-m="project-vault"]')
    geometry[label] = {
      overflowPx: snap.overflowPx,
      rowCount: snap.vault.rowCount,
      sectionLeft: snap.vault.left,
      sectionRight: snap.vault.right,
      rowRightMax: Math.max(0, ...snap.vault.rows.map((r) => r.right)),
      inputRightMax: Math.max(0, ...snap.vault.rows.map((r) => r.inputRight || 0)),
      rowHeights: [...new Set(snap.vault.rows.map((r) => r.height))],
    }
  }
  await page.setViewportSize({ width: 1536, height: 960 })
  out.states.geometry = geometry
  out.assertions.geometry = {
    zeroOverflow390: geometry['390'].overflowPx === 0,
    zeroOverflow1536: geometry['1536'].overflowPx === 0,
    rowsRenderedBoth: geometry['390'].rowCount === 2 && geometry['1536'].rowCount === 2,
    sectionInsideViewport390: geometry['390'].sectionLeft >= 0 && geometry['390'].sectionRight <= 390,
    sectionInsideViewport1536: geometry['1536'].sectionLeft >= 0 && geometry['1536'].sectionRight <= 1536,
    rowsInsideViewport390: geometry['390'].rowRightMax <= 390,
    rowsInsideViewport1536: geometry['1536'].rowRightMax <= 1536,
    inputsInsideViewport390: geometry['390'].inputRightMax <= 390,
    inputsInsideViewport1536: geometry['1536'].inputRightMax <= 1536,
    rowHeightStable: JSON.stringify(geometry['390'].rowHeights) === JSON.stringify(geometry['1536'].rowHeights),
    zeroPageErrors: pageErrors.length === 0,
  }

  await browser.close()
  out.finishedAt = new Date().toISOString()
  out.assertions.geometry.zeroPageErrors = pageErrors.length === 0

  const required = [
    // ① 登录臂行数 / 余额 / 入口
    'authedRows.sectionPresent', 'authedRows.authedFlag', 'authedRows.titleIsLocale',
    'authedRows.rowCountMatchesApi', 'authedRows.cidsInOrder',
    'authedRows.balanceMatchesBttc', 'authedRows.balanceMatchesUsdt',
    'authedRows.inputPerRow', 'authedRows.buttonPerRow',
    'authedRows.noNoticeInitially', 'authedRows.zeroWritesOnLoad',
    // ② 充值成功
    'rechargeOk.postOnce', 'rechargeOk.pathIsVaultRecharge', 'rechargeOk.bodyExactlyPair',
    'rechargeOk.amountIsString', 'rechargeOk.noticeOk', 'rechargeOk.noticeText', 'rechargeOk.noticeCid',
    'rechargeOk.balanceUpdated', 'rechargeOk.otherRowUntouched', 'rechargeOk.inputCleared',
    'rechargeOk.relisted', 'rechargeOk.noErrHooks',
    // ③ 本地前置闸
    'amountGuard.zeroRequests', 'amountGuard.inlineErr', 'amountGuard.textIsLocale',
    'amountGuard.codeHook', 'amountGuard.cidIsRow', 'amountGuard.balanceUnchanged',
    // ④ 服务端失败臂
    'rechargeFail.postOnce', 'rechargeFail.inlineErr', 'rechargeFail.errCodeHook',
    'rechargeFail.errReasonHook', 'rechargeFail.errStatusHook', 'rechargeFail.textIsMapped',
    'rechargeFail.noOkNotice', 'rechargeFail.noRelistAfterFail', 'rechargeFail.balanceUnchanged',
    'rechargeCidFail.inlineErr', 'rechargeCidFail.errCodeHook', 'rechargeCidFail.errStatusHook',
    'rechargeCidFail.textIsMapped',
    // ⑤ 形态负控
    'syntheticRow.sectionPresent', 'syntheticRow.singleRow', 'syntheticRow.cidIsWageCid',
    'syntheticRow.balanceZero', 'syntheticRow.rechargeEntryPresent',
    'noVault.sectionAbsent', 'noVault.zeroRows', 'noVault.zeroInputs', 'noVault.pageStillRendered',
    // ⑥ 匿名只读
    'guestReadOnly.sectionPresent', 'guestReadOnly.authedFlag', 'guestReadOnly.rowsVisible',
    'guestReadOnly.balancesVisible', 'guestReadOnly.noInputs', 'guestReadOnly.noButtons',
    'guestReadOnly.zeroWrites',
    // ⑦ 几何
    'geometry.zeroOverflow390', 'geometry.zeroOverflow1536', 'geometry.rowsRenderedBoth',
    'geometry.sectionInsideViewport390', 'geometry.sectionInsideViewport1536',
    'geometry.rowsInsideViewport390', 'geometry.rowsInsideViewport1536',
    'geometry.inputsInsideViewport390', 'geometry.inputsInsideViewport1536',
    'geometry.rowHeightStable', 'geometry.zeroPageErrors',
  ]
  const verdicts = required.map((key) => {
    const [group, field] = key.split('.')
    const value = out.assertions[group] ? out.assertions[group][field] : undefined
    return { key, value, pass: value === true }
  })
  out.verdict = { required: verdicts, failed: verdicts.filter((v) => !v.pass).map((v) => v.key), pass: verdicts.every((v) => v.pass) }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, pass: out.verdict.pass, failed: out.verdict.failed, pageErrors }, null, 2))
  process.exit(out.verdict.pass ? 0 : 1)
}

main().catch((error) => {
  console.error('PROBE_CRASH', error)
  process.exit(2)
})
