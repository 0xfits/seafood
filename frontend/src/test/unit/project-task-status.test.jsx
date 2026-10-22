/**
 * 任务卡 · **上线 / 下线开关**（Kevin 2026-10-21 · 任务页步 3）
 *
 * ★ Kevin 2026-10-22：任务/子任务全部操作入口迁 `/campaign/:ref`（项目页概况层零操作钮）
 *   ⇒ 本文件挂载点自项目页 `ProjectNestedList` 迁至 `CampaignDetailPage`（新主场整页渲染），
 *   断言契约**逐条原样保留**（载荷闭集 / 内联错误 / 回调页面层），仅标注与探针随迁：
 *   `project-task-status*` → `campaign-task-status*`；页面层回调改由页内结论
 *   （`campaign-manage-notice` = `project.okLaunched` / `project.okDraft`）+ 静默重读取证。
 *
 * 覆盖面（四臂，全部走真实 `project-api.patchProjectTaskStatus`，只把最底层 `fetchApiJson` 换成
 * 按 URL 路由的 spy ⇒「URL / 方法 / body 闭集」是**整链**取证，不是 mock 掉 API 层后的空断言）：
 *   ① draft 任务 + owner ⇒ 钮文案 =【上线】；点后 `PATCH /api/campaign/task/:id`，body **恰**
 *      `{"status":"active"}`（单字段：不得夹带 subtasks / title / 奖励）；
 *   ② active 任务 ⇒ 钮文案 =【下线】，body **恰** `{"status":"draft"}`；
 *   ③ 非 owner / 非管理员 ⇒ **零钮**（状态徽标仍在，只读可见）；
 *   ④ PATCH 失败（409/403/网络）⇒ 卡片内**就地内联**错误（`project.publishFailed`），
 *      不给页内结论（不谎报已上线）。此外：`ended` 任务封板 ⇒ 无钮。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 键回显的 t：断言里直接比键名（文案真源在 locale，四语齐备由 s8 门把关）。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 最底层出口 = fetchApiJson（auth.js）。只换这一个 ⇒ campaign-api / project-api 的
// URL / 方法 / body 全链现取（spy 按 URL 路由，GET / PATCH 各归各）。
const NET = vi.hoisted(() => ({ fetchApiJson: vi.fn(), getAuthHeaders: vi.fn(() => ({})) }))
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchApiJson: NET.fetchApiJson, getAuthHeaders: NET.getAuthHeaders }
})

const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import CampaignDetailPage from '../../pages/campaign/CampaignDetailPage'

// --------------------------------------------------------------------------- fixtures
const taskOf = (patch = {}) => ({
  task_id: 555,
  campaign_id: 501,
  title: '转发推文',
  description: '转发并截图',
  status: 'draft',
  sort: 1,
  time_start: null,
  time_end: null,
  reward_amount_primary: '5',
  reward_cid_secondary: null,
  reward_amount_secondary: null,
  subtasks: [],
  ...patch,
})

const campaignOf = (patch = {}) => ({
  campaign_id: 501,
  snowflake_id: '70501',
  project_id: '11',
  title: '秋季招募',
  description: '活动说明',
  status: 'active',
  time_start: '2026-10-01T00:00:00.000Z',
  time_end: '2026-10-31T00:00:00.000Z',
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
  owner_uid: 7,
  avatar_url: null,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [campaignOf()],
  ...patch,
})

// --------------------------------------------------------------------------- NET 路由
// `fetchApiJson` 被整替 ⇒ 返回值即 API 层拿到的解包后数据（success 信封在本出口内，一并被替）。
const NET_STATE = { campaign: null, project: null, taskPatch: null }

const netCalls = (url, method) => NET.fetchApiJson.mock.calls.filter(([u, o = {}]) =>
  u === url && (method ? o.method === method : !o.method))

beforeEach(() => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  NET.getAuthHeaders.mockClear()
  NET_STATE.campaign = campaignOf()
  NET_STATE.project = projectRow()
  NET_STATE.taskPatch = null // undefined ⇒ resolve {}
  NET.fetchApiJson.mockImplementation((url, options = {}) => {
    if (url === '/api/currencies') return Promise.resolve([])
    if (url === '/api/campaign/501') return Promise.resolve(NET_STATE.campaign)
    if (url.startsWith('/api/project/')) return Promise.resolve(NET_STATE.project)
    if (url === '/api/campaign/task/555' && options.method === 'PATCH') {
      const behavior = NET_STATE.taskPatch
      if (typeof behavior === 'function') return Promise.resolve().then(() => behavior(options))
      return Promise.resolve(behavior ?? {})
    }
    return Promise.reject(Object.assign(new Error(`no net route: ${url}`), { status: 404 }))
  })
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
})

afterEach(cleanup)

const renderCampaign = (ref = '501') => render(
  <MemoryRouter initialEntries={[`/campaign/${ref}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/campaign/:ref" element={<CampaignDetailPage />} />
    </Routes>
  </MemoryRouter>,
)

const toggleOf = (container) => container.querySelector('[data-sf-m="campaign-task-status-toggle"]')
const badgeOf = (container) => container.querySelector('[data-sf-m="campaign-task-status"]')

// ---------------------------------------------------------------------------
describe('项目任务卡 · 上线 / 下线开关（挂载点：/campaign/:ref）', () => {
  it('① draft ⇒ 【上线】：PATCH /api/campaign/task/555，body 恰 {"status":"active"}，成功给页内结论 + 静默重读', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft' })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(toggleOf(container)).not.toBeNull())

    const badge = badgeOf(container)
    expect(badge.textContent).toBe('campaign.statusDraft')
    expect(badge.getAttribute('data-sf-state')).toBe('draft')

    const btn = toggleOf(container)
    expect(btn.textContent).toBe('project.taskOnline')
    expect(btn.getAttribute('data-sf-next')).toBe('active')
    expect(btn.getAttribute('data-sf-task')).toBe('555')

    fireEvent.click(btn)

    await waitFor(() => expect(netCalls('/api/campaign/task/555', 'PATCH')).toHaveLength(1))
    const [url, options] = netCalls('/api/campaign/task/555', 'PATCH')[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ status: 'active' }) // 单字段闭集：多一键即负
    expect(Object.keys(JSON.parse(options.body))).toHaveLength(1)

    // 成功 ⇒ 页内结论（project.okLaunched，键随 next='active'）+ 静默重读（详情读口 ≥ 2 次）
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-manage-notice"]').textContent).toBe('project.okLaunched'))
    expect(netCalls('/api/campaign/501').length).toBeGreaterThanOrEqual(2)
    // 成功路径不得残留内联错误
    expect(container.querySelector('[data-sf-m="campaign-task-status-err"]')).toBeNull()
  })

  it('② active ⇒ 【下线】：body 恰 {"status":"draft"}，页内结论 project.okDraft', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'active' })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(toggleOf(container)).not.toBeNull())

    const badge = badgeOf(container)
    expect(badge.textContent).toBe('campaign.statusActive')

    const btn = toggleOf(container)
    expect(btn.textContent).toBe('project.taskOffline')
    expect(btn.getAttribute('data-sf-next')).toBe('draft')

    fireEvent.click(btn)

    await waitFor(() => expect(netCalls('/api/campaign/task/555', 'PATCH')).toHaveLength(1))
    const [url, options] = netCalls('/api/campaign/task/555', 'PATCH')[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(JSON.parse(options.body)).toEqual({ status: 'draft' })
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-manage-notice"]').textContent).toBe('project.okDraft'))
  })

  it('③ 非 owner / 非管理员 ⇒ 零钮、零写请求；状态徽标仍可见', async () => {
    NET_STATE.project = projectRow({ owner_uid: 99 })
    for (const status of ['draft', 'active']) {
      NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status })] })
      const { container, unmount } = renderCampaign()
      await waitFor(() => expect(badgeOf(container)).not.toBeNull())
      expect(toggleOf(container)).toBeNull()
      expect(container.querySelectorAll('[data-sf-m="campaign-task-status-toggle"]')).toHaveLength(0)
      expect(badgeOf(container).getAttribute('data-sf-state')).toBe(status)
      unmount()
    }
    // 零写请求（GET 读口不算）
    expect(netCalls('/api/campaign/task/555', 'PATCH')).toHaveLength(0)
  })

  it('④ PATCH 失败 ⇒ 卡片内联错误（project.publishFailed），不给页内结论、徽标不变', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'active' })] })
    NET_STATE.taskPatch = () => {
      throw Object.assign(new Error('task_invalid_transition'), { status: 409 })
    }
    const { container } = renderCampaign()
    await waitFor(() => expect(toggleOf(container)).not.toBeNull())

    fireEvent.click(toggleOf(container))

    await waitFor(() => {
      const err = container.querySelector('[data-sf-m="campaign-task-status-err"]')
      expect(err).not.toBeNull()
      expect(err.textContent).toBe('project.publishFailed')
      expect(err.getAttribute('role')).toBe('alert')
      expect(err.getAttribute('data-sf-task')).toBe('555')
    })
    // 不谎报已上线：页内无成功结论
    expect(container.querySelector('[data-sf-m="campaign-manage-notice"]')).toBeNull()
    // 失败后收手：按钮恢复可用（可重试），徽标仍是原状态
    expect(toggleOf(container).disabled).toBe(false)
    expect(badgeOf(container).getAttribute('data-sf-state')).toBe('active')
  })

  it('⑤ ended 任务封板 ⇒ 无上线/下线钮（状态徽标仍在）', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'ended' })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(badgeOf(container)).not.toBeNull())
    expect(toggleOf(container)).toBeNull()
    expect(container.querySelectorAll('[data-sf-m="campaign-task-status-toggle"]')).toHaveLength(0)
    expect(badgeOf(container).getAttribute('data-sf-state')).toBe('ended')
  })
})
