/**
 * /task/new · 阻断面板内嵌【新建项目】表单探针 —— 注册天数条件四选一（Kevin 2026-10-21）
 * --------------------------------------------------------------------------------------------
 * 口径（逐条对齐派单验证项）：
 *   ① 阻断面板在场 ⇒ 点【新建项目】展开内嵌表单：注册天数条件 = `<select>` **恰 4 项**
 *      （value = 1/7/30/365），文案逐字 = zh `bountyProject.days1/7/30/365`，默认选中「一天」（1）；
 *      旧 number 手填钩子 `jobs-project-input-min-days` 不得回归；
 *   ② 选「一周」（value 7）提交 ⇒ `POST /api/project` 载荷 `recruit_min_account_days === 7`
 *      （载荷键集仍 = 服务端 CREATE_KEYS 子集，次币未选 ⇒ 两键不发）；
 *   ③ 不动它直接提交（其余必填填好）⇒ 载荷 `recruit_min_account_days === 1`（新建默认 = 一天）；
 *   ④ 390 / 1536 两档（表单展开态）：`scrollWidth - clientWidth = 0` + 零 pageerror。
 *
 * 手法（同 ops/wage/front/probe-wage.mjs 体例）：
 *   · 静态服务 = context.route 把 http://sf.local/** 映射到磁盘 dist（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 context.route 内自截（零后端、零库写）；
 *   · `GET /api/project/all` 返回空数组 ⇒ 恒走「阻断面板」分支（发布表单不渲染，判定面单纯）。
 *
 * 用法：QA_DIST=<dist> node probe-project-form.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/task-bounty/readings/probe-project-form-result.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const CUR = [{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }]

// 可变探针状态：POST /api/project 载荷留痕（判据②③）；projects 空 ⇒ 恒阻断面板
const STATE = {
  projects: [],
  projectPosts: [],
  calls: [],
}

const apiResponse = (method, pathname, rawBody) => {
  const ok = (data) => ({ success: true, data })
  if (pathname === '/api/project/all') {
    STATE.calls.push({ method, path: pathname })
    return ok(STATE.projects)
  }
  if (pathname === '/api/currencies') return ok(CUR)
  if (pathname === '/api/user') {
    STATE.calls.push({ method, path: pathname })
    return ok({ uID: 970213 })
  }
  if (pathname === '/api/project' && method === 'POST') {
    STATE.calls.push({ method, path: pathname })
    let body = {}
    try { body = rawBody ? JSON.parse(rawBody) : {} } catch { body = {} }
    STATE.projectPosts.push(body)
    return ok({ project_id: '11' })
  }
  if (pathname === '/api/messages/unread-count') return ok({ unread_total: 0 })
  if (method === 'GET') return ok({ rows: [], next_cursor: null, total: 0 })
  return ok({})
}

// ---- 页内读数 --------------------------------------------------------------------------------
const SNAP_FN = `(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const de = document.documentElement
  const gate = q('[data-sf-m="jobs-project-gate"]')
  const form = q('[data-sf-m="jobs-project-form"]')
  const sel = q('[data-sf-m="jobs-project-select-min-days"]')
  return {
    viewport: { w: innerWidth, h: innerHeight },
    overflowPx: de.scrollWidth - de.clientWidth,
    pathname: location.pathname,
    gate: { present: !!gate, text: txt(q('[data-sf-m="jobs-project-gate-text"]')) },
    form: {
      present: !!form,
      hasOldNumberInput: !!q('[data-sf-m="jobs-project-input-min-days"]'),
      minDays: sel
        ? {
            tag: sel.tagName,
            value: sel.value,
            count: sel.options.length,
            values: [...sel.options].map((o) => o.value),
            labels: [...sel.options].map((o) => o.textContent),
          }
        : null,
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

// 探针离线口径按设计 abort 的外链留痕（字体 / 样式 CDN；hostname ≠ sf.local ⇒ route.abort）
const abortedExternal = []

const attachRoutes = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.hostname !== 'sf.local') {
      // 探针离线口径：外链（字体 / 样式 CDN）按设计 abort ⇒ 页面 console 随之出现 net::ERR_FAILED，
      // 属 mock 拦截设计（见 main 末尾 consoleErrorsAttribution），不是页面缺陷。留痕前 20 条。
      if (abortedExternal.length < 20) abortedExternal.push(u.hostname + u.pathname.slice(0, 80))
      return route.abort()
    }
    if (u.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(req.method(), u.pathname, req.postData())) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) })
  })
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  context.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: 970213, uid: 970213, token: 'probe-token', bio: 'probe', name: 'Probe' }))
    localStorage.setItem('token', 'probe-token')
  })
  await attachRoutes(context)

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

  const out = {
    probe: 'ops/task-bounty/probe-project-form.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { projects: '[]（恒阻断面板）', auth: 'localStorage seed only（零真登录）', api: 'context.route in-probe JSON（零后端 / 零库写）' },
    states: {}, assertions: {}, pageErrors, consoleErrors,
  }

  const open = async (url) => {
    await page.goto(ORIGIN + url, { waitUntil: 'load' })
    await settle(page)
    await page.waitForSelector('[data-sf-m="jobs-project-gate"]', { timeout: 8000 }).catch(() => {})
    await settle(page)
    return page.evaluate(SNAP_FN)
  }
  const openForm = async () => {
    await page.click('[data-sf-m="jobs-project-open"]')
    await page.waitForSelector('[data-sf-m="jobs-project-form"]', { timeout: 8000 }).catch(() => {})
    await settle(page)
  }
  const fillRequired = async () => {
    await page.fill('[data-sf-m="jobs-project-input-title"]', '探针项目')
    await page.fill('[data-sf-m="jobs-project-input-headcount"]', '3')
    await page.fill('[data-sf-m="jobs-project-input-batt"]', '5')
    await page.fill('[data-sf-m="jobs-project-input-interval"]', '24')
  }

  // ============================ ① 阻断面板 + 四选一 select（1536） ============================
  STATE.calls.length = 0
  const snap1 = await open('/task/new')
  out.states['1536_gate'] = snap1
  await openForm()
  const snapForm = await page.evaluate(SNAP_FN)
  out.states['1536_form'] = snapForm
  out.assertions.gate = {
    pathname: snap1.pathname === '/task/new',
    gatePresent: snap1.gate.present === true && snap1.gate.text === ZH.bountyProject.needProject,
    publishFormHidden: !(await page.$('[data-sf-m="jobs-form"]')),
  }
  out.assertions.minDaysSelect = {
    present: snapForm.form.present === true,
    isSelect: snapForm.form.minDays && snapForm.form.minDays.tag === 'SELECT',
    exactly4: snapForm.form.minDays && snapForm.form.minDays.count === 4,
    values: snapForm.form.minDays ? snapForm.form.minDays.values : null,
    valuesAreDays: Boolean(snapForm.form.minDays
      && JSON.stringify(snapForm.form.minDays.values) === JSON.stringify(['1', '7', '30', '365'])),
    labelsAreI18n: Boolean(snapForm.form.minDays && JSON.stringify(snapForm.form.minDays.labels) === JSON.stringify([
      ZH.bountyProject.days1, ZH.bountyProject.days7, ZH.bountyProject.days30, ZH.bountyProject.days365,
    ])),
    defaultIsDay1: Boolean(snapForm.form.minDays && snapForm.form.minDays.value === '1'),
    oldNumberInputGone: snapForm.form.hasOldNumberInput === false,
    labels: snapForm.form.minDays ? snapForm.form.minDays.labels : null,
  }

  // ============================ ② 选「一周」提交 ⇒ 载荷 7 ======================================
  STATE.projectPosts.length = 0
  await page.selectOption('[data-sf-m="jobs-project-select-min-days"]', '7')
  await fillRequired()
  await page.click('[data-sf-m="jobs-project-submit"]')
  await page.waitForFunction(() => true).catch(() => {})
  await settle(page)
  out.states['1536_submit_week'] = { posts: JSON.parse(JSON.stringify(STATE.projectPosts)) }
  out.assertions.submitWeek = {
    postOnce: STATE.projectPosts.length === 1,
    payloadDays7: Boolean(STATE.projectPosts[0] && STATE.projectPosts[0].recruit_min_account_days === 7),
    payloadKeysStillCreateSubset: Boolean(STATE.projectPosts[0] && JSON.stringify(Object.keys(STATE.projectPosts[0]).sort()) === JSON.stringify([
      'create_key', 'description', 'headcount', 'recruit_min_account_days',
      'title', 'wage_batt_per_claim', 'wage_interval_hours',
    ])),
  }

  // ============================ ③ 不动天数直接提交（重载回默认）⇒ 载荷 1 ======================
  STATE.projectPosts.length = 0
  await open('/task/new')
  await openForm()
  await fillRequired()
  const snapDefault = await page.evaluate(SNAP_FN)
  await page.click('[data-sf-m="jobs-project-submit"]')
  await settle(page)
  out.states['1536_submit_default'] = { select: snapDefault.form.minDays, posts: JSON.parse(JSON.stringify(STATE.projectPosts)) }
  out.assertions.submitDefault = {
    selectStillDay1: Boolean(snapDefault.form.minDays && snapDefault.form.minDays.value === '1'),
    postOnce: STATE.projectPosts.length === 1,
    payloadDays1: Boolean(STATE.projectPosts[0] && STATE.projectPosts[0].recruit_min_account_days === 1),
  }

  // ============================ ④ 两档几何（表单展开态）=======================================
  for (const [label, width, height] of [['1536', 1536, 960], ['390', 390, 844]]) {
    await page.setViewportSize({ width, height })
    await open('/task/new')
    await openForm()
    const snap = await page.evaluate(SNAP_FN)
    out.states[`${label}_form_geometry`] = { overflowPx: snap.overflowPx, gate: snap.gate.present, form: snap.form.present }
  }
  out.assertions.geometry = {
    zeroOverflow1536: out.states['1536_form_geometry'].overflowPx === 0,
    zeroOverflow390: out.states['390_form_geometry'].overflowPx === 0,
    formStillOpenBoth: out.states['1536_form_geometry'].form === true && out.states['390_form_geometry'].form === true,
    zeroPageErrors: pageErrors.length === 0,
  }

  await browser.close()
  out.finishedAt = new Date().toISOString()
  out.assertions.geometry.zeroPageErrors = pageErrors.length === 0

  // —— consoleErrors 定性（2026-10-21 复跑注记）：console 里的 `net::ERR_FAILED` 全部来自外链
  //    字体/样式 CDN（Google Fonts / cdnjs font-awesome / jsDelivr SmileySans）——这些请求被本探针
  //    的离线口径**按设计 abort**（attachRoutes：hostname ≠ sf.local ⇒ route.abort），属 mock 拦截
  //    设计、非页面缺陷 ⇒ 在判负中**显式忽略**；除此之外的 console error 仍然判负（加严断言）。
  const consoleErrorsUnexpected = consoleErrors.filter((t) => !t.includes('net::ERR_FAILED'))
  out.consoleErrorsAttribution = {
    total: consoleErrors.length,
    byDesign: 'ERR_FAILED = 外链字体/样式 CDN 被探针离线口径按设计 abort ⇒ 显式忽略、不判负',
    abortedExternalSample: abortedExternal.slice(0, 8),
    unexpected: consoleErrorsUnexpected,
  }
  out.assertions.console = { onlyAbortedExternalCdnErrors: consoleErrorsUnexpected.length === 0 && abortedExternal.length > 0 }

  const required = [
    'gate.pathname', 'gate.gatePresent', 'gate.publishFormHidden',
    'minDaysSelect.present', 'minDaysSelect.isSelect', 'minDaysSelect.exactly4',
    'minDaysSelect.valuesAreDays', 'minDaysSelect.labelsAreI18n', 'minDaysSelect.defaultIsDay1',
    'minDaysSelect.oldNumberInputGone',
    'submitWeek.postOnce', 'submitWeek.payloadDays7', 'submitWeek.payloadKeysStillCreateSubset',
    'submitDefault.selectStillDay1', 'submitDefault.postOnce', 'submitDefault.payloadDays1',
    'geometry.zeroOverflow1536', 'geometry.zeroOverflow390', 'geometry.formStillOpenBoth', 'geometry.zeroPageErrors',
    // console 卫生（加严）：ERR_FAILED（外链 CDN 被离线口径按设计 abort）显式忽略，其余 console error 判负
    'console.onlyAbortedExternalCdnErrors',
  ]
  const verdicts = required.map((key) => {
    const [group, field] = key.split('.')
    const value = out.assertions[group] ? out.assertions[group][field] : undefined
    return { key, value, pass: value === true }
  })
  out.verdict = { required: verdicts, failed: verdicts.filter((v) => !v.pass).map((v) => v.key), pass: verdicts.every((v) => v.pass) }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ out: OUT, verdict: out.verdict, pageErrors, consoleErrors: consoleErrors.slice(0, 5) }, null, 2))
  process.exit(out.verdict.pass ? 0 : 1)
}

main().catch((error) => {
  console.error('PROBE_CRASH', error)
  process.exit(2)
})
