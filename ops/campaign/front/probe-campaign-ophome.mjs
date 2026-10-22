/**
 * 活动页操作主场（Kevin 2026-10-22 · 项目页概况化）· 前端探针（真实 Chrome + route 拦截 mock，不碰真后端）
 *
 * 复用 `probe-campaign-step2.mjs` 模板（真实 Chrome + API 通配拦截 + localStorage 会话）。
 * 四臂（与验收逐条对齐）：
 *   ① owner 臂：/campaign/:ref 五类操作钮全部渲染（发布任务 / 发布子任务 / 上下线 / 行级编辑 / 删除）
 *      + task_status 徽标 + 项目归属行（→ /<slug>）；
 *   ② 【发布子任务】双锁臂：表单落在任务卡内（活动 + 任务双锁，两选择器不在），
 *      提交前新鲜重读（GET /api/project/:slug）⇒ PATCH 组 = 可重发旧行 + 新行
 *      （legacy prediction 行 option_style=ab_legacy 被跳过、载荷不含其文案）+ 成功收面板；
 *   ③ 项目页概况层臂：/:slug 概况区**零操作钮**（连零 button）、活动名链 /campaign/:ref、
 *      任务摘要行链 /task/:id、子任务清单不上项目页；
 *   ④ 只读臂：普通用户（非 owner）与未登录 ⇒ 五类操作元素全不渲染（徽标与归属行照旧）；
 *      未登录零 /api/user 取数。
 *   ⑤ 390 / 1536 双档零横向溢出、零 pageerror（活动页 owner 视图 + 项目页）。
 *
 * 运行：node ops/campaign/front/probe-campaign-ophome.mjs（需 frontend dev 在 5787）
 * 读数：ops/campaign/front/probe-ophome-result.json ＋ 入库 ops/campaign/readings/p74-campaign-ophome-<RUN>.json
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5787'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..') // ops/campaign
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z').replace('T', 'T')

const ok = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
})

const FUTURE = new Date(Date.now() + 3 * 3600 * 1000).toISOString()
const PAST = new Date(Date.now() - 3600 * 1000).toISOString()

const OWNER_UID = 970301

// 任务 8001：可重发旧行（x_verify 带 payload）＋ 存量 legacy prediction 行（读口剥文案 ⇒ ab_legacy）
const subtasksOf = () => ([
  { subtask_id: 90021, task_id: 8001, type_code: 'x_verify', type_label: 'X 验证', title: '转发推文', content: '附链接', payload: { links: ['https://x.com/a'] }, sort: 1, required: true, prediction_state: null },
  { subtask_id: 90022, task_id: 8001, type_code: 'prediction', type_label: '预测', title: '谁会赢', content: null, payload: { prize_amount: '10', deadline: '2026-11-05T00:00:00.000Z' }, sort: 3, required: false, prediction_state: 'open', option_style: 'ab_legacy' },
])

const taskOf = (patch = {}) => ({
  task_id: 8001,
  campaign_id: 8000,
  title: '转发推文',
  description: '转发并截图',
  status: 'active',
  sort: 1,
  time_start: PAST,
  time_end: FUTURE,
  reward_amount_primary: '5',
  reward_cid_secondary: null,
  reward_amount_secondary: null,
  subtasks: subtasksOf(),
  ...patch,
})

const campaignOf = (patch = {}) => ({
  campaign_id: 8000,
  snowflake_id: '88000',
  project_id: '11',
  title: '秋季招募',
  description: '活动说明',
  status: 'active',
  time_start: PAST,
  time_end: FUTURE,
  tasks: [taskOf()],
  ...patch,
})

const projectRow = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: OWNER_UID,
  avatar_url: null,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [campaignOf()],
  ...patch,
})

const session = async (ctx, uid = OWNER_UID) => {
  await ctx.addInitScript((id) => {
    localStorage.setItem('user', JSON.stringify({ uID: id, EVM: '0x1234567890abcdef1234567890abcdef12345678', nickname: 'probe' }))
    localStorage.setItem('token', 'x.y.z')
  }, uid)
}

const hookPage = (page) => {
  const rec = { pageerrors: [], consoleErrors: [] }
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 120)) })
  return rec
}

const overflowOf = (page) => page.evaluate(() => ({
  docScrollW: document.documentElement.scrollWidth,
  bodyScrollW: document.body.scrollWidth,
  innerW: window.innerWidth,
  over: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
}))

const must = (cond, msg) => { if (!cond) throw new Error(msg) }

// ---------------------------------------------------------------------------
const out = { owner: {}, subtaskAppend: {}, projectOverview: {}, readonly: {}, geometry: {} }
const browser = await chromium.launch({ executablePath: EXE })

/** 统一 API mock：活动详情 / 项目读口（页面 load + 表单新鲜读同源）/ 币种 / 其余兜底。 */
const mockApi = (ctx, { project = projectRow(), campaign = campaignOf(), onPatchTask } = {}) => {
  const hits = { campaignDetail: 0, projectDetail: 0, user: 0, patchTask: [] }
  ctx.route('**/api/**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (url.includes('/api/campaign/task/') && method === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}')
      hits.patchTask.push(body)
      if (onPatchTask) return onPatchTask(route, body)
      return route.fulfill(ok({}))
    }
    if (/\/api\/campaign\/\d+$/.test(url)) {
      hits.campaignDetail += 1
      return route.fulfill(ok(campaign))
    }
    if (url.includes('/api/campaign/all')) return route.fulfill(ok([]))
    if (/\/api\/project\/[^/]+$/.test(url)) {
      hits.projectDetail += 1
      return route.fulfill(ok(project))
    }
    if (url.includes('/api/currencies')) return route.fulfill(ok([]))
    if (url.includes('/api/user')) {
      hits.user += 1
      return route.fulfill(ok({}))
    }
    return route.fulfill(ok({}))
  })
  return hits
}

try {
  // ================================================ ① owner 臂：五类操作钮全渲染
  {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
    await session(ctx)
    const hits = mockApi(ctx)
    const page = await ctx.newPage()
    const rec = hookPage(page)
    await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('[data-sf-m="campaign-task"]', { timeout: 15000 })

    out.owner = await page.evaluate(() => ({
      entryTask: !!document.querySelector('[data-sf-m="campaign-entry-task"]'),
      toggle: document.querySelector('[data-sf-m="campaign-task-status-toggle"]')?.getAttribute('data-sf-next') || null,
      entrySubtask: document.querySelector('[data-sf-m="campaign-task-entry-subtask"]')?.getAttribute('data-sf-task') || null,
      editBtns: document.querySelectorAll('[data-sf-m="campaign-subtask-edit"]').length,
      deleteBtns: document.querySelectorAll('[data-sf-m="campaign-subtask-delete"]').length,
      lockedRows: document.querySelectorAll('[data-sf-m="campaign-subtask-locked"]').length,
      badge: document.querySelector('[data-sf-m="campaign-task-status"]')?.getAttribute('data-sf-state') || null,
      projectRow: document.querySelector('[data-sf-m="campaign-project-row"]')?.getAttribute('href') || null,
      projectTitle: document.querySelector('[data-sf-m="campaign-project-title"]')?.textContent || null,
    }))
    out.owner.campaignDetailCalls = hits.campaignDetail
    out.owner.pageerrors = rec.pageerrors

    // 操作区【发布任务】就地开表单、锁本活动
    await page.click('[data-sf-m="campaign-entry-task"]')
    await page.waitForSelector('[data-sf-m="project-form-task"]', { timeout: 8000 })
    out.owner.taskFormLocked = await page.evaluate(() => ({
      locked: document.querySelector('[data-sf-m="project-form-campaign-locked"]')?.getAttribute('data-sf-ref') || null,
      noCampaignSelect: !document.querySelector('[data-sf-m="project-form-task"] [data-sf-field="campaign"]'),
    }))
    must(out.owner.entryTask, 'owner 臂：campaign-entry-task 缺')
    must(out.owner.toggle === 'draft', `owner 臂：toggle next=${out.owner.toggle}`)
    must(out.owner.entrySubtask === '8001', 'owner 臂：campaign-task-entry-subtask 缺/挂错卡')
    must(out.owner.editBtns === 1 && out.owner.deleteBtns === 2, `owner 臂：edit=${out.owner.editBtns} delete=${out.owner.deleteBtns}`)
    must(out.owner.lockedRows === 1, 'owner 臂：legacy prediction 行缺锁定说明')
    must(out.owner.badge === 'active', 'owner 臂：task_status 徽标缺')
    must(out.owner.projectRow === '/sui' && out.owner.projectTitle === '海鲜打包', 'owner 臂：项目归属行缺')
    must(out.owner.taskFormLocked.locked === '8000' && out.owner.taskFormLocked.noCampaignSelect, 'owner 臂：发布任务未锁本活动')
    must(out.owner.pageerrors.length === 0, `owner 臂：pageerror ${JSON.stringify(out.owner.pageerrors)}`)
    await ctx.close()
  }

  // ================================================ ② 【发布子任务】双锁 + 新鲜重读整组追加
  {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 1200 } })
    await session(ctx)
    let hits
    const page = await ctx.newPage()
    hits = mockApi(ctx)
    const rec = hookPage(page)
    await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('[data-sf-m="campaign-task-entry-subtask"]', { timeout: 15000 })

    await page.click('[data-sf-m="campaign-task-entry-subtask"]')
    await page.waitForSelector('[data-sf-m="project-form-subtask"]', { timeout: 8000 })

    out.subtaskAppend.locks = await page.evaluate(() => {
      const card = document.querySelector('[data-sf-m="campaign-task"]')
      const form = card.querySelector('[data-sf-m="project-form-subtask"]')
      const locked = card.querySelector('[data-sf-m="project-form-task-locked"]')
      return {
        inCard: !!form,
        campaign: locked?.getAttribute('data-sf-campaign') || null,
        task: locked?.getAttribute('data-sf-ref') || null,
        noCampaignSelect: !form.querySelector('[data-sf-field="campaign"]'),
        noTaskSelect: !form.querySelector('[data-sf-field="task"]'),
      }
    })
    must(out.subtaskAppend.locks.inCard, '双锁臂：表单不在任务卡内')
    must(out.subtaskAppend.locks.campaign === '8000' && out.subtaskAppend.locks.task === '8001', `双锁臂：锁=${JSON.stringify(out.subtaskAppend.locks)}`)
    must(out.subtaskAppend.locks.noCampaignSelect && out.subtaskAppend.locks.noTaskSelect, '双锁臂：选择器未锁死')

    // 填一行 survey 并提交（提交前表单自己新鲜重读项目读口）
    const readsBefore = hits.projectDetail
    await page.selectOption('[data-sf-m="project-form-subtask"] [data-sf-field="type"]', 'survey')
    await page.fill('[data-sf-m="project-form-subtask"] [data-sf-field="title"]', '新问卷')
    await page.fill('[data-sf-m="project-form-subtask"] [data-sf-field="sort"]', '3')
    await page.click('[data-sf-m="project-form-submit"]')
    await page.waitForFunction(() => !document.querySelector('[data-sf-m="project-form-subtask"]'), { timeout: 8000 })
    await page.waitForTimeout(300)

    out.subtaskAppend.freshReadBeforePatch = hits.projectDetail > readsBefore
    const group = hits.patchTask[0]?.subtasks || []
    out.subtaskAppend.patchTask = hits.patchTask[0] || null
    out.subtaskAppend.groupIds = group.map((r) => r.subtask_id ?? null)
    out.subtaskAppend.legacyTextLeak = JSON.stringify(hits.patchTask[0] || {}).includes('option_a')
    out.subtaskAppend.notice = await page.evaluate(() => document.querySelector('[data-sf-m="campaign-manage-notice"]')?.textContent || null)
    out.subtaskAppend.pageerrors = rec.pageerrors

    must(out.subtaskAppend.freshReadBeforePatch, '双锁臂：提交前没有新鲜重读')
    must(hits.patchTask.length === 1, `双锁臂：PATCH 次数=${hits.patchTask.length}`)
    must(group.length === 2, `双锁臂：整组=${group.length}（应 2 = 可重发旧行 1 + 新行 1）`)
    must(group[0].subtask_id === '90021' && JSON.stringify(group[0].payload) === JSON.stringify({ links: ['https://x.com/a'] }), '双锁臂：旧行未原样重发')
    must(group[1] && !group[1].subtask_id && group[1].type_code === 'survey' && group[1].title === '新问卷', '双锁臂：新行不在组尾')
    must(!group.some((r) => r.subtask_id === '90022'), '双锁臂：legacy prediction 行未被跳过')
    must(!out.subtaskAppend.legacyTextLeak, '双锁臂：载荷泄漏 option_a 文案')
    must(!!out.subtaskAppend.notice, '双锁臂：成功后无页内结论')
    must(out.subtaskAppend.pageerrors.length === 0, `双锁臂：pageerror ${JSON.stringify(out.subtaskAppend.pageerrors)}`)
    await ctx.close()
  }

  // ================================================ ③ 项目页概况层：零操作钮
  {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
    await session(ctx)
    mockApi(ctx)
    const page = await ctx.newPage()
    const rec = hookPage(page)
    await page.goto(`${BASE}/sui`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('[data-sf-m="project-campaigns"]', { timeout: 15000 })

    out.projectOverview = await page.evaluate(() => ({
      overviewButtons: document.querySelectorAll('[data-sf-m="project-campaigns"] button').length,
      campaignLink: document.querySelector('[data-sf-m="project-campaign-link"]')?.getAttribute('href') || null,
      taskLink: document.querySelector('[data-sf-m="project-task-link"]')?.getAttribute('href') || null,
      subtaskRows: document.querySelectorAll('[data-sf-m="project-subtask"]').length,
      forms: document.querySelectorAll('[data-sf-m="project-form-subtask"]').length,
      manageKept: !!document.querySelector('[data-sf-m="project-entry-campaign"]'), // 项目级操作留本页
    }))
    out.projectOverview.pageerrors = rec.pageerrors
    must(out.projectOverview.overviewButtons === 0, `概况层臂：概况区 button=${out.projectOverview.overviewButtons}`)
    must(out.projectOverview.campaignLink === '/campaign/8000', '概况层臂：活动名未链 /campaign/8000')
    must(out.projectOverview.taskLink === '/task/8001', '概况层臂：任务摘要行未链 /task/8001')
    must(out.projectOverview.subtaskRows === 0 && out.projectOverview.forms === 0, '概况层臂：子任务清单/表单上了项目页')
    must(out.projectOverview.pageerrors.length === 0, `概况层臂：pageerror ${JSON.stringify(out.projectOverview.pageerrors)}`)
    await ctx.close()
  }

  // ================================================ ④ 只读臂：普通用户 / 未登录
  {
    // 普通用户（非 owner）
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
    await session(ctx, 970302)
    const hits = mockApi(ctx)
    const page = await ctx.newPage()
    const rec = hookPage(page)
    await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('[data-sf-m="campaign-task"]', { timeout: 15000 })
    out.readonly.user = await page.evaluate(() => ({
      entryTask: !!document.querySelector('[data-sf-m="campaign-entry-task"]'),
      toggle: !!document.querySelector('[data-sf-m="campaign-task-status-toggle"]'),
      entrySubtask: !!document.querySelector('[data-sf-m="campaign-task-entry-subtask"]'),
      editBtns: document.querySelectorAll('[data-sf-m="campaign-subtask-edit"]').length,
      deleteBtns: document.querySelectorAll('[data-sf-m="campaign-subtask-delete"]').length,
      manageSection: !!document.querySelector('[data-sf-m="campaign-manage"]'),
      badge: document.querySelector('[data-sf-m="campaign-task-status"]')?.getAttribute('data-sf-state') || null,
      projectRow: document.querySelector('[data-sf-m="campaign-project-row"]')?.getAttribute('href') || null,
    }))
    out.readonly.user.pageerrors = rec.pageerrors
    must(!out.readonly.user.entryTask && !out.readonly.user.toggle && !out.readonly.user.entrySubtask, '只读臂（普通用户）：操作钮泄漏')
    must(out.readonly.user.editBtns === 0 && out.readonly.user.deleteBtns === 0 && !out.readonly.user.manageSection, '只读臂（普通用户）：管理面泄漏')
    must(out.readonly.user.badge === 'active' && out.readonly.user.projectRow === '/sui', '只读臂（普通用户）：只读信息缺失')
    must(out.readonly.user.pageerrors.length === 0, '只读臂（普通用户）：pageerror')
    await ctx.close()

    // 未登录（零 /api/user 取数）
    const ctx2 = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
    const hits2 = mockApi(ctx2)
    const page2 = await ctx2.newPage()
    const rec2 = hookPage(page2)
    await page2.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
    await page2.waitForSelector('[data-sf-m="campaign-task"]', { timeout: 15000 })
    out.readonly.anon = await page2.evaluate(() => ({
      entryTask: !!document.querySelector('[data-sf-m="campaign-entry-task"]'),
      toggle: !!document.querySelector('[data-sf-m="campaign-task-status-toggle"]'),
      editBtns: document.querySelectorAll('[data-sf-m="campaign-subtask-edit"]').length,
      deleteBtns: document.querySelectorAll('[data-sf-m="campaign-subtask-delete"]').length,
    }))
    out.readonly.anon.userApiCalls = hits2.user
    out.readonly.anon.pageerrors = rec2.pageerrors
    must(!out.readonly.anon.entryTask && !out.readonly.anon.toggle, '只读臂（未登录）：操作钮泄漏')
    must(out.readonly.anon.editBtns === 0 && out.readonly.anon.deleteBtns === 0, '只读臂（未登录）：管理面泄漏')
    must(out.readonly.anon.userApiCalls === 0, '只读臂（未登录）：打了 /api/user')
    must(out.readonly.anon.pageerrors.length === 0, '只读臂（未登录）：pageerror')
    await ctx2.close()
  }

  // ================================================ ⑤ 390 / 1536 零溢出零 pageerror
  for (const width of [390, 1536]) {
    for (const [key, pathUrl] of [['campaign', '/campaign/8000'], ['project', '/sui']]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } })
      await session(ctx)
      mockApi(ctx)
      const page = await ctx.newPage()
      const rec = hookPage(page)
      await page.goto(`${BASE}${pathUrl}`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector('[data-sf-m="campaign-task"]', { timeout: 15000 })
      await page.waitForTimeout(250)
      const box = await overflowOf(page)
      out.geometry[`${key}@${width}`] = { ...box, pageerrors: rec.pageerrors, consoleErrors: rec.consoleErrors }
      must(box.over <= 0, `几何 ${key}@${width}：横向溢出 ${box.over}px`)
      must(rec.pageerrors.length === 0, `几何 ${key}@${width}：pageerror ${JSON.stringify(rec.pageerrors)}`)
      await ctx.close()
    }
  }

  out.allPass = true
} catch (error) {
  out.allPass = false
  out.fatal = String(error && error.message ? error.message : error).slice(0, 400)
}

await browser.close()

// 读数落盘（模板同目录）＋ 入库（readings/，p65/p72/p73 同体例）
fs.writeFileSync(path.join(HERE, 'probe-ophome-result.json'), JSON.stringify(out, null, 2))
const checks = Object.entries(out)
  .filter(([k]) => !['allPass', 'fatal', 'geometry'].includes(k))
  .map(([k, v]) => ({ id: k, pass: v ? v.pass !== false : false }))
const reading = {
  run: RUN,
  name: 'p74-campaign-ophome',
  at: new Date().toISOString(),
  mode: 'post-impl',
  allPass: out.allPass === true,
  fatal: out.fatal || null,
  checks,
  readings: out,
}
fs.mkdirSync(path.join(ROOT, 'readings'), { recursive: true })
const file = path.join(ROOT, 'readings', `p74-campaign-ophome-${RUN}.json`)
fs.writeFileSync(file, JSON.stringify(reading, null, 2))
console.log(JSON.stringify({ saved: file, allPass: reading.allPass, fatal: reading.fatal }, null, 1))
