/**
 * 活动页步 2 · 前端探针（真实 Chrome + route 拦截 mock，不碰真后端）
 *
 * 覆盖（与派单【验证】逐条对齐）：
 *   ① 未投票 ⇒ 双选项按钮可点（且高度 ≥44）；
 *   ② 投票后锁定（POST 一次、按钮 disabled、无提交按钮、已投文案、复读触发）；
 *   ③ 结算后 ⇒ 正确项高亮（is-correct）+ 错误项置灰（is-wrong）+ 个人 `won/payout` 展示；
 *      并覆盖「服务端 my_proof 直接锁定」一态；
 *   ④ 其余四类提交面板渲染 + 提交成功态（X 验证 / 链上快照 / 问卷 / 答题，逐类断言 POST 载荷）；
 *   ⑤ 390 / 1536 双档零横向溢出、零 pageerror。
 *
 * 运行：node ops/campaign/front/probe-campaign-step2.mjs（需 frontend dev 在 5787）
 * 读数：同目录 probe-step2-result.json
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

const ok = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
})

const FUTURE = new Date(Date.now() + 3 * 3600 * 1000).toISOString()
const PAST = new Date(Date.now() - 3600 * 1000).toISOString()

const predictionSub = (patch = {}) => ({
  subtask_id: 90011,
  task_id: 8001,
  type_code: 'prediction',
  type_label: '预测',
  title: '今晚谁先卖完？',
  content: '按 22:00 结算',
  payload: { option_a: '甲摊', option_b: '乙摊', prize_amount: '120', deadline: FUTURE },
  sort: 4,
  required: true,
  prediction_state: 'open',
  ...patch,
})

const proofSubs = () => ([
  { subtask_id: 90021, task_id: 8002, type_code: 'x_verify', type_label: 'X 验证', title: '转发活动帖', content: '转发并附上链接', payload: {}, sort: 1, required: true, prediction_state: null },
  { subtask_id: 90022, task_id: 8002, type_code: 'onchain_snapshot', type_label: '链上快照', title: '快照持仓', content: null, payload: {}, sort: 2, required: false, prediction_state: null },
  { subtask_id: 90023, task_id: 8002, type_code: 'survey', type_label: '问卷', title: '口味问卷', content: null, payload: { questions: [{ key: 'taste', label: '喜欢哪种口味', options: ['原味', '辣味'] }, { key: 'why', label: '为什么' }] }, sort: 3, required: false, prediction_state: null },
  { subtask_id: 90024, task_id: 8002, type_code: 'quiz', type_label: '答题', title: '知识题', content: '1+1=?', payload: {}, sort: 5, required: false, prediction_state: null },
])

const campaignOf = (subtasks, patch = {}) => ({
  campaign_id: 8000,
  snowflake_id: '88000',
  title: '步 2 探针活动',
  description: 'prediction + 四类提交',
  status: 'active',
  time_start: PAST,
  time_end: FUTURE,
  tasks: [{ task_id: 8001, campaign_id: 8000, title: '主任务', description: '', status: 'active', time_start: PAST, time_end: FUTURE, sort: 1, reward_amount_primary: '5', reward_cid_secondary: null, reward_amount_secondary: null, subtasks }],
  ...patch,
})

const session = async (ctx) => {
  await ctx.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ uID: 970301, EVM: '0x1234567890abcdef1234567890abcdef12345678', nickname: 'probe' }))
    localStorage.setItem('token', 'x.y.z')
  })
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

const out = { prediction: {}, fourTypes: {}, geometry: {} }
const browser = await chromium.launch({ executablePath: EXE })

// ============================================================ ① 开放态 + ② 投票后锁定
{
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
  await session(ctx)
  const posted = []
  let detail = campaignOf([predictionSub()])
  await ctx.route('**/api/**', (route) => {
    const req = route.request()
    const url = req.url()
    if (url.includes('/api/campaign/subtask/') && url.endsWith('/proof') && req.method() === 'POST') {
      posted.push(JSON.parse(req.postData() || '{}'))
      // 提交成功后：读口开始带 my_proof（模拟后端并行单的加性字段）
      detail = campaignOf([predictionSub({ my_proof: { payload: { choice: 'a' }, time_created: new Date().toISOString() } })])
      return route.fulfill(ok({ proof_id: '1', subtask_id: '90011', payload: { choice: 'a' }, status: 'submitted', time_created: new Date().toISOString() }))
    }
    if (url.includes('/api/campaign/all')) return route.fulfill(ok([]))
    if (/\/api\/campaign\/\d+/.test(url)) return route.fulfill(ok(detail))
    if (url.includes('/api/currencies')) return route.fulfill(ok([]))
    return route.fulfill(ok({}))
  })
  const page = await ctx.newPage()
  const rec = hookPage(page)
  await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('[data-sf-m="campaign-prediction"]', { timeout: 15000 })

  rec.open = await page.evaluate(() => {
    const votes = [...document.querySelectorAll('[data-sf-m="campaign-vote"]')]
    return {
      count: votes.length,
      disabled: votes.map((v) => v.disabled),
      heights: votes.map((v) => Math.round(v.getBoundingClientRect().height)),
      locked: document.querySelector('[data-sf-m="campaign-prediction"]')?.getAttribute('data-sf-locked'),
      submitVisible: !!document.querySelector('[data-sf-m="campaign-prediction-submit"]'),
      texts: votes.map((v) => v.textContent.trim()),
    }
  })

  await page.click('[data-sf-m="campaign-vote"][data-sf-choice="a"]')
  await page.waitForTimeout(120)
  rec.picked = await page.evaluate(() => document.querySelector('[data-sf-m="campaign-vote"][data-sf-choice="a"]')?.getAttribute('data-sf-picked'))
  await page.click('[data-sf-m="campaign-prediction-submit"]')
  await page.waitForFunction(() => document.querySelector('[data-sf-m="campaign-prediction"]')?.getAttribute('data-sf-locked') === '1', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)

  rec.afterVote = await page.evaluate(() => {
    const votes = [...document.querySelectorAll('[data-sf-m="campaign-vote"]')]
    return {
      posted: null,
      locked: document.querySelector('[data-sf-m="campaign-prediction"]')?.getAttribute('data-sf-locked'),
      disabled: votes.map((v) => v.disabled),
      picked: votes.map((v) => v.getAttribute('data-sf-picked')),
      submitVisible: !!document.querySelector('[data-sf-m="campaign-prediction-submit"]'),
      resultText: document.querySelector('[data-sf-m="campaign-prediction-result"]')?.textContent || null,
      notice: document.querySelector('[data-sf-m="campaign-prediction-notice"]')?.textContent || null,
    }
  })
  rec.afterVote.posted = posted
  rec.pageerrors = rec.pageerrors
  rec.consoleErrors = rec.consoleErrors
  out.prediction.open = rec.open
  out.prediction.picked = rec.picked
  out.prediction.afterVote = rec.afterVote
  out.prediction.pageerrors = rec.pageerrors
  await ctx.close()
}

// ============================================================ ③ 服务端 my_proof 锁定 + 结算态
{
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } })
  await session(ctx)
  const detail = campaignOf([
    predictionSub({
      prediction_state: 'settled',
      payload: { option_a: '甲摊', option_b: '乙摊', prize_amount: '120', deadline: PAST, correct_option: 'a' },
      my_proof: { payload: { choice: 'a' }, time_created: new Date().toISOString() },
      my_outcome: { choice: 'a', won: true, payout: '60' },
    }),
  ])
  await ctx.route('**/api/**', (route) => {
    const url = route.request().url()
    if (/\/api\/campaign\/\d+/.test(url)) return route.fulfill(ok(detail))
    if (url.includes('/api/campaign/all')) return route.fulfill(ok([]))
    if (url.includes('/api/currencies')) return route.fulfill(ok([]))
    return route.fulfill(ok({}))
  })
  const page = await ctx.newPage()
  const rec = hookPage(page)
  await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('[data-sf-m="campaign-prediction"]', { timeout: 15000 })

  rec.settled = await page.evaluate(() => {
    const votes = [...document.querySelectorAll('[data-sf-m="campaign-vote"]')]
    const other = votes.find((v) => v.getAttribute('data-sf-choice') === 'b')
    const result = document.querySelector('[data-sf-m="campaign-prediction-result"]')
    return {
      state: document.querySelector('[data-sf-m="campaign-prediction"]')?.getAttribute('data-sf-state'),
      classes: votes.map((v) => v.className),
      disabled: votes.map((v) => v.disabled),
      picked: votes.map((v) => v.getAttribute('data-sf-picked')),
      correctFlag: votes.map((v) => v.getAttribute('data-sf-correct')),
      wrongOpacity: other ? getComputedStyle(other).opacity : null,
      won: result?.getAttribute('data-sf-won'),
      payout: result?.getAttribute('data-sf-payout'),
      resultText: result?.textContent || null,
      payoutText: document.querySelector('[data-sf-m="campaign-prediction-payout"]')?.textContent || null,
      submitVisible: !!document.querySelector('[data-sf-m="campaign-prediction-submit"]'),
    }
  })
  rec.pageerrors = rec.pageerrors
  out.prediction.settled = rec.settled
  out.prediction.settledPageerrors = rec.pageerrors
  await ctx.close()
}

// ============================================================ ④ 四类提交面板
{
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 1200 } })
  await session(ctx)
  const posted = []
  const mediaHits = []
  let detail = campaignOf(proofSubs())
  await ctx.route('**/api/**', (route) => {
    const req = route.request()
    const url = req.url()
    if (url.includes('/api/campaign/subtask/') && url.endsWith('/proof') && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      posted.push(body)
      const id = Number(url.split('/subtask/')[1].split('/')[0])
      detail = campaignOf(proofSubs().map((s) => (s.subtask_id === id
        ? { ...s, my_proof: { payload: body, time_created: new Date().toISOString() } }
        : s)))
      return route.fulfill(ok({ proof_id: String(id), subtask_id: String(id), payload: body, status: 'submitted', time_created: new Date().toISOString() }))
    }
    if (/\/api\/campaign\/\d+/.test(url)) return route.fulfill(ok(detail))
    if (url.includes('/api/campaign/all')) return route.fulfill(ok([]))
    if (url.includes('/api/currencies')) return route.fulfill(ok([]))
    if (url.includes('/api/media') && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      mediaHits.push({ content_type: body.content_type, bytes: String(body.data_base64 || '').length })
      return route.fulfill(ok({ url: `/api/media/${mediaHits.length}` }))
    }
    return route.fulfill(ok({}))
  })
  const page = await ctx.newPage()
  const rec = hookPage(page)
  await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('[data-sf-m="campaign-proof-panel"]', { timeout: 15000 })

  rec.rendered = await page.evaluate(() => {
    const panel = (type) => document.querySelector(`[data-sf-m="campaign-proof-panel"][data-sf-type="${type}"]`)
    return {
      panels: [...document.querySelectorAll('[data-sf-m="campaign-proof-panel"]')].map((p) => p.getAttribute('data-sf-type')),
      xLink: !!panel('x_verify')?.querySelector('[data-sf-m="campaign-proof-link"]'),
      xFile: !!panel('x_verify')?.querySelector('[data-sf-m="campaign-proof-file"]'),
      addr: !!panel('onchain_snapshot')?.querySelector('[data-sf-m="campaign-proof-addr"]'),
      surveyQuestions: panel('survey')?.querySelectorAll('[data-sf-m="campaign-proof-question"]').length,
      surveyChoices: panel('survey')?.querySelectorAll('[data-sf-m="campaign-proof-choice"]').length,
      surveyText: !!panel('survey')?.querySelector('[data-sf-m="campaign-proof-question-text"]'),
      quizInput: !!panel('quiz')?.querySelector('[data-sf-m="campaign-proof-answer"]'),
    }
  })

  // X 验证：先传一张 1×1 PNG（复用 POST /api/media），再填链接提交 ⇒ 载荷含 screenshots
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')
  await page.setInputFiles('[data-sf-type="x_verify"] [data-sf-m="campaign-proof-file"]', { name: 'shot.png', mimeType: 'image/png', buffer: png })
  await page.waitForTimeout(600)
  rec.shotThumb = await page.evaluate(() => document.querySelectorAll('[data-sf-m="campaign-proof-shot"]').length)
  await page.fill('[data-sf-m="campaign-proof-link"]', 'https://x.com/seafood/status/123')
  await page.click('[data-sf-type="x_verify"] [data-sf-m="campaign-proof-submit"]')
  await page.waitForTimeout(500)

  // 链上快照：先填坏地址看提示，再填好地址提交
  await page.fill('[data-sf-m="campaign-proof-addr"]', 'oops')
  await page.waitForTimeout(100)
  rec.addrBadHint = await page.textContent('[data-sf-m="campaign-proof-addr-hint"]')
  const addr = '0x1234567890abcdef1234567890abcdef12345678'
  await page.fill('[data-sf-m="campaign-proof-addr"]', addr)
  await page.waitForTimeout(100)
  rec.addrGoodHint = await page.textContent('[data-sf-m="campaign-proof-addr-hint"]')
  await page.click('[data-sf-type="onchain_snapshot"] [data-sf-m="campaign-proof-submit"]')
  await page.waitForTimeout(500)

  // 问卷
  await page.click('[data-sf-type="survey"] [data-sf-m="campaign-proof-choice"] >> nth=1')
  await page.fill('[data-sf-type="survey"] [data-sf-m="campaign-proof-question-text"]', '因为够鲜')
  await page.click('[data-sf-type="survey"] [data-sf-m="campaign-proof-submit"]')
  await page.waitForTimeout(500)

  // 答题
  await page.fill('[data-sf-m="campaign-proof-answer"]', '42')
  await page.click('[data-sf-type="quiz"] [data-sf-m="campaign-proof-submit"]')
  await page.waitForTimeout(600)

  rec.afterSubmit = await page.evaluate(() => ({
    submitted: [...document.querySelectorAll('[data-sf-m="campaign-proof-submitted"]')].map((n) => n.textContent.trim()),
    notices: [...document.querySelectorAll('[data-sf-m="campaign-proof-notice"]')].map((n) => n.textContent.trim()),
  }))
  rec.posted = posted
  rec.mediaHits = mediaHits
  rec.pageerrors = rec.pageerrors
  out.fourTypes = rec
  await ctx.close()
}

// ============================================================ ⑤ 390 / 1536 零溢出
for (const width of [390, 1536]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  await session(ctx)
  const detail = campaignOf([
    predictionSub({ prediction_state: 'settled', payload: { option_a: '甲摊', option_b: '乙摊', prize_amount: '120', deadline: PAST, correct_option: 'b' }, my_proof: { payload: { choice: 'b' }, time_created: new Date().toISOString() }, my_outcome: { choice: 'b', won: true, payout: '60' } }),
    ...proofSubs(),
  ])
  await ctx.route('**/api/**', (route) => {
    const url = route.request().url()
    if (/\/api\/campaign\/\d+/.test(url)) return route.fulfill(ok(detail))
    if (url.includes('/api/campaign/all')) return route.fulfill(ok([]))
    if (url.includes('/api/currencies')) return route.fulfill(ok([]))
    return route.fulfill(ok({}))
  })
  const page = await ctx.newPage()
  const rec = hookPage(page)
  await page.goto(`${BASE}/campaign/8000`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('[data-sf-m="campaign-proof-panel"]', { timeout: 15000 })
  await page.waitForTimeout(250)
  const box = await overflowOf(page)
  const votes = await page.evaluate(() => [...document.querySelectorAll('[data-sf-m="campaign-vote"]')].map((v) => Math.round(v.getBoundingClientRect().height)))
  out.geometry[String(width)] = { ...box, voteHeights: votes, pageerrors: rec.pageerrors, consoleErrors: rec.consoleErrors }
  await ctx.close()
}

await browser.close()
fs.writeFileSync(path.join(HERE, 'probe-step2-result.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
