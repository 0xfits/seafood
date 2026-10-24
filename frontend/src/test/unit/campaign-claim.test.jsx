/**
 * 活动 · 电量与【领取】面单测（2026-10-23）
 *
 * 覆盖（对齐派单验证项）：
 *   ① 提交面板常驻小字「提交需 1 电量」：三类面板（通用 / 答题 / 预测）各一枚，与登录态无关；
 *   ② 提交成功：`reward_pending` 缺省 ⇒ 既有成功文案；`reward_pending:true` ⇒ 「奖励已入待领取」；
 *   ③ 提交失败 `409 + details.reason='batt_insufficient'` ⇒ 内联「电量不足，无法提交」（非通用失败文案）；
 *   ④ 提交载荷形状（通用 `{answers:{q1}}` / x_verify `{links}` / quiz `{answers:{picks}}`）；
 *   ⑤ 三处【领取】按钮：子任务行 / 任务完成奖（`/task/:id`）、活动一键领取（`/campaign/:ref`）
 *      —— 渲染判据 = 读口 `pending_rewards`，`data-sf-action="claim"`，点击 URL / 方法 / 载荷逐字；
 *   ⑥ 活动级一键领取 = **只发一个请求**（一次点击共扣 1 电量，绝不按 item 循环）；
 *   ⑦ 三错误文案：`batt_insufficient` / `nothing_to_claim` / 其他 ⇒ 各自内联文案；
 *   ⑧ 成功后重拉详情（`onClaimed` ⇒ 复读读口）；
 *   ⑨ 匿名零按钮：三处均不渲染任何 `[data-sf-action="claim"]`，且零写请求；
 *   ⑩ 四语齐备：本批 13 个新键 zh/hk/en/vn 全有且非空（en/vn 零 CJK）。
 *
 * 口径：真 `campaign-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 task-detail-page 先例）；
 *   i18n 用真 zh 词典逐字断言。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const H = vi.hoisted(() => {
  const state = { table: {} }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    if (v === undefined) return key
    return opts ? String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : v
  }
  return state
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: H.t, i18n: { resolvedLanguage: 'zh', language: 'zh', changeLanguage: vi.fn() } }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 77 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// ★ Kevin 2026-10-24 裁定：领取成功 = **Toast**（`react-hot-toast`），失败仍内联。
//   ⇒ 成功断言改在 toast 的**调用参数**上，同时钉死「不再有内联 ok 节点」；
//     失败断言继续看内联 err 节点，并额外钉死「失败不得弹 toast」。
const TOAST = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: TOAST }))

import CampaignTaskPage from '../../pages/campaign/CampaignTaskPage'
import CampaignDetailPage from '../../pages/campaign/CampaignDetailPage'
import SubtaskItem from '../../pages/campaign/SubtaskItem'
import { pendingItemsOf, pendingRewardsOf } from '../../pages/campaign/campaign-util'

const TABLES = { zh, en, hk, vn }
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

const T = (key, vars) => H.t(key, vars)

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  headers: { get: () => null },
})
const ok = (data) => jsonResponse(200, { success: true, data })
const fail = (status, code, details) => jsonResponse(status, {
  success: false,
  error: { code, message: code, ...(details ? { details } : {}) },
})

const CURRENCIES = [{ cid: 1, symbol: '$', name: 'USDT' }, { cid: 2, symbol: 'batt', name: 'BATT' }]

const PENDING_SUBTASK = { kind: 'subtask', ref_id: 9001, title: '转发官方推文', cid: '1', amount: '5' }
const PENDING_TASK = { kind: 'task', ref_id: 1, title: '第一轮', cid: '1', amount: '15' }

const taskView = (patch = {}) => ({
  task_id: 1,
  title: '第一轮',
  description: '完成首轮任务',
  status: 'active',
  time_start: '2026-10-01T00:00:00.000Z',
  time_end: '2026-11-01T00:00:00.000Z',
  reward_amount_primary: '15',
  reward_cid_secondary: null,
  reward_amount_secondary: null,
  joined_count: 3,
  joined_target: 100,
  campaign: { id: 501, title: '新赛季社区任务', status: 'active' },
  project: { id: 11, title: '星链楼市', slug: 'xinglian', avatar_url: '', status: 'recruiting' },
  pending_rewards: { items: [], total_by_cid: {} },
  subtasks: [
    { subtask_id: 9001, type_code: 'x_verify', title: '转发官方推文', content: '附上链接', required: true, sort: 1 },
  ],
  ...patch,
})

const campaignView = (patch = {}) => ({
  campaign_id: 501,
  snowflake_id: '999',
  title: '新赛季社区任务',
  description: '完成三件事',
  status: 'active',
  time_start: '2026-10-01T00:00:00.000Z',
  time_end: '2026-11-01T00:00:00.000Z',
  project_id: 11,
  pending_rewards: {
    items: [PENDING_SUBTASK, { ...PENDING_TASK, ref_id: 2, title: '第二轮', amount: '10' }],
    total_by_cid: { 1: '15' },
  },
  tasks: [{
    task_id: 1,
    title: '第一轮',
    status: 'active',
    reward_amount_primary: '15',
    subtasks: [{ subtask_id: 9001, type_code: 'x_verify', title: '转发官方推文', required: true }],
  }],
  ...patch,
})

/** 路由化 fetch：读口 + 提交口 + 领取三口 + 币种表 + 归属项目 + 管理员三键。 */
const wrap = (spec) => {
  if (!spec) return fail(404, 'NOT_FOUND')
  const status = Number(spec.status) || 200
  // `body` = 现成响应体（成功/失败信封）；`data` = 直给数据 ⇒ 包一层 `{success:true,data}`
  if (spec.body) return jsonResponse(status, spec.body)
  return jsonResponse(status, { success: true, data: spec.data })
}

const routed = (opts = {}) => {
  const state = {
    task: opts.taskBody !== undefined ? opts.taskBody : taskView(),
    campaign: opts.campaignBody !== undefined ? opts.campaignBody : campaignView(),
    proof: opts.proof || { status: 200, data: { time_created: '2026-10-23T01:00:00.000Z' } },
    claim: opts.claim || { status: 200, data: { subtask_id: 9001, cid: '1', amount: '5', batt_after: 9 } },
    taskClaim: opts.taskClaim || { status: 200, data: { task_id: 1, cid: '1', amount: '15', batt_after: 8 } },
    campaignClaim: opts.campaignClaim || {
      status: 200,
      data: { claimed: [{ ...PENDING_SUBTASK }, { ...PENDING_TASK, ref_id: 2 }], total_primary: '15', batt_after: 7 },
    },
  }
  const fetchMock = vi.fn(async (url, options = {}) => {
    const u = String(url)
    const method = String(options?.method || 'GET').toUpperCase()
    // ★ 每条返回都**新建**响应对象（`json()` 只能读一次；复用同一对象会导致第二次解析炸）
    if (u.includes('/api/campaign/subtask/') && u.endsWith('/proof')) return wrap(state.proof)
    if (u.includes('/api/campaign/subtask/') && u.endsWith('/claim')) return wrap(state.claim)
    if (u.startsWith('/api/campaign/task/') && u.endsWith('/claim')) return wrap(state.taskClaim)
    if (u.startsWith('/api/campaign/task/')) return jsonResponse(200, { success: true, data: state.task })
    if (method === 'POST' && u === '/api/campaign/501/claim') return wrap(state.campaignClaim)
    if (u === '/api/campaign/501') return jsonResponse(200, { success: true, data: state.campaign })
    if (u.includes('/api/currencies')) return ok(CURRENCIES)
    if (u.includes('/api/project/')) return ok({ id: 11, title: '星链楼市', slug: 'xinglian', owner_uid: 77, status: 'recruiting' })
    if (u.includes('/api/user')) return ok({ uID: 77, manage_tasks: true })
    return fail(404, 'NOT_FOUND')
  })
  return { fetchMock, state }
}

const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)
const qa = (m) => [...document.querySelectorAll(`[data-sf-m="${m}"]`)]
const claimButtons = () => [...document.querySelectorAll('[data-sf-action="claim"]')]
const callsTo = (fetchMock, fragment) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(fragment))
const bodyOf = (call) => JSON.parse(String(call?.[1]?.body ?? 'null'))

const renderTask = () => render(
  <MemoryRouter initialEntries={['/task/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/task/:taskId" element={<CampaignTaskPage />} /></Routes>
  </MemoryRouter>,
)

const renderCampaign = () => render(
  <MemoryRouter initialEntries={['/campaign/501']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/campaign/:ref" element={<CampaignDetailPage />} /></Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  H.table = zh
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 77 }
  TOAST.success.mockClear()
  TOAST.error.mockClear()
  window.localStorage.clear()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear() })

// ============================================================================
// ② 读口形状解析（纯函数）
// ============================================================================
describe('② pending_rewards 解析', () => {
  it('缺字段 / 坏行一律空面；kind 闭集外的行丢弃；ref_id 归一为串', () => {
    expect(pendingRewardsOf(null)).toEqual({ items: [], totalByCid: {} })
    expect(pendingRewardsOf({})).toEqual({ items: [], totalByCid: {} })
    const parsed = pendingRewardsOf({
      pending_rewards: {
        items: [
          PENDING_SUBTASK,
          { kind: 'bogus', ref_id: 3, cid: '1', amount: '1' },
          { kind: 'task', ref_id: 4, cid: '1', amount: '' },
          null,
          'x',
        ],
        total_by_cid: { 1: '5', 2: 'nope' },
      },
    })
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]).toEqual({ kind: 'subtask', refId: '9001', title: '转发官方推文', cid: '1', amount: '5' })
    expect(parsed.totalByCid).toEqual({ 1: '5' })
    expect(pendingItemsOf(parsed, 'subtask', 9001)).toHaveLength(1)
    expect(pendingItemsOf(parsed, 'task', 9001)).toHaveLength(0)
  })
})

// ============================================================================
// ① 提交面板：常驻「提交需 1 电量」
// ============================================================================
describe('① 提交需 1 电量（常驻小字）', () => {
  const renderSubtask = (type, payload) => render(
    <MemoryRouter>
      <ul>
        <SubtaskItem
          subtask={{ subtask_id: 9001, type_code: type, title: '任务', payload, required: true }}
          t={T}
          lang="zh"
          user={AUTH.user}
          isAuthenticated={AUTH.isAuthenticated}
          onRefresh={vi.fn()}
        />
      </ul>
    </MemoryRouter>,
  )

  it('通用面板：小字在提交按钮旁且逐字 = 「提交需 1 电量」', () => {
    renderSubtask('survey', {})
    const actions = q('campaign-proof-submit').parentElement
    const hint = actions.querySelector('[data-sf-m="campaign-proof-batt"]')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toBe('提交需 1 电量')
    expect(hint.className).toContain('sf-campaign-cost-hint')
  })

  it('答题面板与预测面板各有一枚（小字与可点性无关：预测未选时也在场）', () => {
    cleanup()
    renderSubtask('quiz', { options: { a: '甲', b: '乙', c: '丙', d: '丁' }, reward_amount: '2' })
    expect(q('campaign-quiz-batt')).not.toBeNull()
    expect(q('campaign-quiz-batt').textContent).toBe('提交需 1 电量')
    cleanup()
    renderSubtask('prediction', { deadline: new Date(Date.now() + 3600 * 1000).toISOString() })
    expect(q('campaign-prediction-batt')).not.toBeNull()
    expect(q('campaign-prediction-batt').textContent).toBe('提交需 1 电量')
  })

  it('匿名档同样常驻（成本要在点之前告知）', () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    renderSubtask('survey', {})
    expect(q('campaign-proof-batt')?.textContent).toBe('提交需 1 电量')
  })
})

// ============================================================================
// ②③④ 提交成功 / 失败 / 载荷
// ============================================================================
describe('②③④ 提交结果与载荷', () => {
  const renderSurvey = () => {
    const { fetchMock, state } = routed()
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MemoryRouter>
        <ul>
          <SubtaskItem
            subtask={{ subtask_id: 9001, type_code: 'survey', title: '问卷', payload: {}, required: true }}
            t={T}
            lang="zh"
            user={AUTH.user}
            isAuthenticated={AUTH.isAuthenticated}
            onRefresh={vi.fn()}
          />
        </ul>
      </MemoryRouter>,
    )
    return { fetchMock, state }
  }

  it('成功（旧后端 / 无 reward_pending）⇒ 既有文案；载荷 = {answers:{q1}}', async () => {
    const { fetchMock } = renderSurvey()
    fireEvent.change(q('campaign-proof-text'), { target: { value: '我的看法' } })
    fireEvent.click(q('campaign-proof-submit'))
    await waitFor(() => expect(q('campaign-proof-notice')).not.toBeNull())
    expect(q('campaign-proof-notice').textContent).toBe(zh.campaign.submit.ok)
    const call = callsTo(fetchMock, '/api/campaign/subtask/9001/proof')[0]
    expect(call[1].method).toBe('POST')
    expect(bodyOf(call)).toEqual({ answers: { q1: '我的看法' } })
  })

  it('成功且 reward_pending:true ⇒ 「奖励已入待领取」（替掉旧成功文案）', async () => {
    const { fetchMock } = renderSurvey()
    // 覆盖提交口响应：带加性字段
    fetchMock.mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/proof')) return ok({ time_created: '2026-10-23T01:00:00.000Z', reward_pending: true, batt_after: 9 })
      return fail(404, 'NOT_FOUND')
    })
    fireEvent.change(q('campaign-proof-text'), { target: { value: '我的看法' } })
    fireEvent.click(q('campaign-proof-submit'))
    await waitFor(() => expect(q('campaign-proof-notice')).not.toBeNull())
    expect(q('campaign-proof-notice').textContent).toBe('奖励已入待领取')
  })

  it('409 batt_insufficient ⇒ 内联「电量不足，无法提交」（不是通用失败文案）', async () => {
    const { fetchMock } = renderSurvey()
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/proof')) return fail(409, 'CAMPAIGN_PROOF_REJECTED', { reason: 'batt_insufficient' })
      return fail(404, 'NOT_FOUND')
    })
    fireEvent.change(q('campaign-proof-text'), { target: { value: '我的看法' } })
    fireEvent.click(q('campaign-proof-submit'))
    await waitFor(() => expect(q('campaign-proof-notice')).not.toBeNull())
    expect(q('campaign-proof-notice').textContent).toBe('电量不足，无法提交')
    expect(q('campaign-proof-notice').getAttribute('data-sf-kind')).toBe('err')
  })
})

// ============================================================================
// ⑤⑥⑧ 三处【领取】
// ============================================================================
describe('⑤ 子任务行【领取】', () => {
  it('有 pending ⇒ 一枚 claim 按钮；点击 ⇒ POST /api/campaign/subtask/9001/claim + 空载荷；成功走 Toast（无内联 ok 节点）', async () => {
    const { fetchMock } = routed({
      taskBody: taskView({ pending_rewards: { items: [PENDING_SUBTASK], total_by_cid: { 1: '5' } } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderTask()
    await waitFor(() => expect(qa('task-subtask-claim').length).toBe(1))
    const row = qa('task-subtask-claim')[0]
    expect(row.getAttribute('data-sf-subtask')).toBe('9001')
    expect(row.textContent).toContain('待领取 $5')
    const button = row.querySelector('[data-sf-action="claim"]')
    expect(button).not.toBeNull()
    expect(button.getAttribute('data-sf-claim')).toBe('subtask')

    const before = callsTo(fetchMock, '/api/campaign/task/1').length
    fireEvent.click(button)
    // ★ 成功 ⇒ toast.success(文案含到账数值, { duration: 5000 })；组件内不再渲染内联成功节点
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [msg, opts] = TOAST.success.mock.calls[0]
    expect(msg).toBe('已领取 $5')
    // ★ 2026-10-24 Toast 双轨：余额增加类 ⇒ `toastCredit`（正中 / 18px / 5s）
    expect(opts).toEqual(expect.objectContaining({ duration: 5000, position: 'top-center', className: 'sf-toast-credit' }))
    expect(TOAST.error).not.toHaveBeenCalled()
    expect(q('task-subtask-claim-btn-notice')).toBeNull()
    const call = callsTo(fetchMock, '/api/campaign/subtask/9001/claim')[0]
    expect(call[1].method).toBe('POST')
    expect(bodyOf(call)).toEqual({})
    // 成功后重拉详情（待领取行以读口为准）
    await waitFor(() => expect(callsTo(fetchMock, '/api/campaign/task/1').length).toBeGreaterThan(before))
  })

  it('无 pending ⇒ 零 claim 按钮（不造点了必 409 的入口）', async () => {
    const { fetchMock } = routed()
    vi.stubGlobal('fetch', fetchMock)
    renderTask()
    await waitFor(() => expect(q('task-page')).not.toBeNull())
    expect(claimButtons()).toHaveLength(0)
    expect(q('task-subtask-claim')).toBeNull()
  })
})

describe('⑤ 任务完成奖【领取】', () => {
  it('pending 含 kind=task ⇒ 按钮在奖励区；点击 ⇒ POST /api/campaign/task/1/claim', async () => {
    const { fetchMock } = routed({
      taskBody: taskView({ pending_rewards: { items: [PENDING_TASK], total_by_cid: { 1: '15' } } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderTask()
    await waitFor(() => expect(q('task-reward-claim')).not.toBeNull())
    expect(q('task-reward-pending').textContent).toBe('待领取 $15')
    const button = q('task-reward-claim').querySelector('[data-sf-action="claim"]')
    expect(button.getAttribute('data-sf-claim')).toBe('task')
    fireEvent.click(button)
    // ★ 成功 ⇒ Toast（任务完成奖：`campaign.claim.ok` 插值 amount），内联 ok 节点不再存在
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [msg, opts] = TOAST.success.mock.calls[0]
    expect(msg).toBe('已领取 $15')
    // ★ 2026-10-24 Toast 双轨：余额增加类 ⇒ `toastCredit`（正中 / 18px / 5s）
    expect(opts).toEqual(expect.objectContaining({ duration: 5000, position: 'top-center', className: 'sf-toast-credit' }))
    expect(q('task-reward-claim-btn-notice')).toBeNull()
    const call = callsTo(fetchMock, '/api/campaign/task/1/claim')[0]
    expect(call[1].method).toBe('POST')
    expect(bodyOf(call)).toEqual({})
  })
})

describe('⑤⑥ 活动级【一键领取】', () => {
  it('pending 非空 ⇒ 一键按钮 + 成本小字；点击 ⇒ **只发一个** POST /api/campaign/501/claim', async () => {
    const { fetchMock } = routed()
    vi.stubGlobal('fetch', fetchMock)
    renderCampaign()
    await waitFor(() => expect(q('campaign-claim-bar')).not.toBeNull())
    expect(q('campaign-claim-bar').getAttribute('data-sf-ref')).toBe('501')
    expect(q('campaign-claim-cost').textContent).toBe('一键领取共扣 1 电量')
    const button = q('campaign-claim-all')
    expect(button.getAttribute('data-sf-action')).toBe('claim')
    expect(button.textContent).toBe('一键领取')

    fireEvent.click(button)
    // ★ 活动级成功 ⇒ 一条 Toast（`campaign.claim.allOk` 带 {n}/{amount} 插值），无内联 ok 节点
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [msg, opts] = TOAST.success.mock.calls[0]
    expect(msg).toBe('已领取 2 项，共 $15')
    // ★ 2026-10-24 Toast 双轨：余额增加类 ⇒ `toastCredit`（正中 / 18px / 5s）
    expect(opts).toEqual(expect.objectContaining({ duration: 5000, position: 'top-center', className: 'sf-toast-credit' }))
    expect(q('campaign-claim-all-notice')).toBeNull()
    // ★ 一次点击共扣 1 电量 ⇒ 请求恰 1 条，且没有任何 per-item 的 claim 子路径
    expect(callsTo(fetchMock, '/claim')).toHaveLength(1)
    const call = callsTo(fetchMock, '/claim')[0]
    expect(String(call[0])).toBe('/api/campaign/501/claim')
    expect(call[1].method).toBe('POST')
    expect(bodyOf(call)).toEqual({})
    // 成功后重拉详情
    await waitFor(() => expect(callsTo(fetchMock, '/api/campaign/501').length).toBeGreaterThanOrEqual(2))
  })

  it('无 pending ⇒ 零按钮（活动页零 claim 入口）', async () => {
    const { fetchMock } = routed({ campaignBody: campaignView({ pending_rewards: { items: [], total_by_cid: {} } }) })
    vi.stubGlobal('fetch', fetchMock)
    renderCampaign()
    await waitFor(() => expect(q('campaign-detail-head')).not.toBeNull())
    expect(claimButtons()).toHaveLength(0)
    expect(q('campaign-claim-bar')).toBeNull()
  })
})

// ============================================================================
// ⑦ 三错误文案
// ============================================================================
describe('⑦ 领取失败三文案', () => {
  const renderWithFail = (response) => {
    const { fetchMock } = routed({
      taskBody: taskView({ pending_rewards: { items: [PENDING_SUBTASK], total_by_cid: {} } }),
    })
    fetchMock.mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/claim')) return response
      if (u.startsWith('/api/campaign/task/1')) return ok(taskView({ pending_rewards: { items: [PENDING_SUBTASK], total_by_cid: {} } }))
      if (u.includes('/api/currencies')) return ok(CURRENCIES)
      return fail(404, 'NOT_FOUND')
    })
    vi.stubGlobal('fetch', fetchMock)
    renderTask()
    return fetchMock
  }

  it('batt_insufficient ⇒ 「电量不足，无法领取」', async () => {
    renderWithFail(fail(409, 'CAMPAIGN_CLAIM_REJECTED', { reason: 'batt_insufficient' }))
    await waitFor(() => expect(q('task-subtask-claim-btn')).not.toBeNull())
    fireEvent.click(q('task-subtask-claim-btn'))
    await waitFor(() => expect(q('task-subtask-claim-btn-notice')).not.toBeNull())
    expect(q('task-subtask-claim-btn-notice').textContent).toBe('电量不足，无法领取')
    expect(q('task-subtask-claim-btn-notice').getAttribute('data-sf-kind')).toBe('err')
    // ★ 失败必须留在内联，不得改 Toast（Kevin 2026-10-24 明定）
    expect(TOAST.success).not.toHaveBeenCalled()
  })

  it('nothing_to_claim ⇒ 「暂无可领取的奖励」', async () => {
    renderWithFail(fail(409, 'nothing_to_claim'))
    await waitFor(() => expect(q('task-subtask-claim-btn')).not.toBeNull())
    fireEvent.click(q('task-subtask-claim-btn'))
    await waitFor(() => expect(q('task-subtask-claim-btn-notice')).not.toBeNull())
    expect(q('task-subtask-claim-btn-notice').textContent).toBe('暂无可领取的奖励')
    expect(TOAST.success).not.toHaveBeenCalled()
  })

  it('其他失败（500）⇒ 「领取失败，请稍后重试」', async () => {
    renderWithFail(fail(500, 'INTERNAL'))
    await waitFor(() => expect(q('task-subtask-claim-btn')).not.toBeNull())
    fireEvent.click(q('task-subtask-claim-btn'))
    await waitFor(() => expect(q('task-subtask-claim-btn-notice')).not.toBeNull())
    expect(q('task-subtask-claim-btn-notice').textContent).toBe('领取失败，请稍后重试')
    expect(TOAST.success).not.toHaveBeenCalled()
  })
})

// ============================================================================
// ⑨ 匿名零按钮
// ============================================================================
describe('⑨ 匿名零按钮（三处合计）', () => {
  it('任务页：pending 在场但匿名 ⇒ 零 claim 按钮、零 claim 请求', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { fetchMock } = routed({
      taskBody: taskView({ pending_rewards: { items: [PENDING_SUBTASK, PENDING_TASK], total_by_cid: {} } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderTask()
    await waitFor(() => expect(q('task-page')).not.toBeNull())
    expect(claimButtons()).toHaveLength(0)
    expect(q('task-subtask-claim')).toBeNull()
    expect(q('task-reward-claim')).toBeNull()
    expect(callsTo(fetchMock, '/claim')).toHaveLength(0)
  })

  it('活动页：pending 在场但匿名 ⇒ 零一键领取按钮、零 claim 请求', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { fetchMock } = routed()
    vi.stubGlobal('fetch', fetchMock)
    renderCampaign()
    await waitFor(() => expect(q('campaign-detail-head')).not.toBeNull())
    expect(claimButtons()).toHaveLength(0)
    expect(callsTo(fetchMock, '/claim')).toHaveLength(0)
  })
})

// ============================================================================
// ⑩ 四语齐备
// ============================================================================
describe('⑩ 四语齐备（本批 13 键）', () => {
  const NEW_KEYS = [
    'campaign.submit.battCost',
    'campaign.submit.battInsufficient',
    'campaign.submit.rewardPending',
    'campaign.claim.cta',
    'campaign.claim.claiming',
    'campaign.claim.all',
    'campaign.claim.allCost',
    'campaign.claim.pending',
    'campaign.claim.ok',
    'campaign.claim.allOk',
    'campaign.claim.battInsufficient',
    'campaign.claim.nothingToClaim',
    'campaign.claim.failed',
  ]
  const pick = (table, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), table)

  it('13 键 × 四语全有且非空；en/vn 零 CJK；hk 用繁体字面', () => {
    for (const lang of LANGS) {
      for (const key of NEW_KEYS) {
        const value = pick(TABLES[lang], key)
        expect(typeof value, `${lang}.${key}`).toBe('string')
        expect(value.trim(), `${lang}.${key}`).not.toBe('')
        if (lang === 'en' || lang === 'vn') expect(CJK.test(value), `${lang}.${key} 残留中文`).toBe(false)
      }
    }
    expect(pick(zh, 'campaign.claim.all')).toBe('一键领取')
    expect(pick(hk, 'campaign.claim.all')).toBe('一鍵領取')
    expect(pick(zh, 'campaign.submit.battCost')).toBe('提交需 1 电量')
    // 插值占位符四语同形（漏 `{{amount}}` ⇒ 到账金额不上屏）
    for (const lang of LANGS) {
      expect(pick(TABLES[lang], 'campaign.claim.ok')).toContain('{{amount}}')
      expect(pick(TABLES[lang], 'campaign.claim.allOk')).toContain('{{n}}')
      expect(pick(TABLES[lang], 'campaign.claim.allOk')).toContain('{{amount}}')
      expect(pick(TABLES[lang], 'campaign.claim.pending')).toContain('{{amount}}')
    }
  })
})
