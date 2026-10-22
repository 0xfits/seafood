/**
 * `/campaign/:ref` · **操作主场**（Kevin 2026-10-22：项目页概况化，全部操作入口迁本页）
 *
 * 覆盖面：
 *   ① owner 视图三入口 + 上下线 + 行级编辑/删除**可达**（发布任务 / 发布子任务 / 上线·下线 /
 *      campaign-subtask-edit·delete），任务卡带 `task_status` 徽标，项目归属行链 `/<slug>`；
 *   ② 【发布任务】：campaign 已锁定（无活动选择器、锁本活动），提交载荷 ref/键集对拍，
 *      成功 ⇒ 收面板 + 页内结论 + **静默重读**（fetchCampaignDetail 二次调用）；
 *   ③ 【发布子任务】：卡内就地开表单（活动 + 任务双锁），提交前**新鲜重读**项目读口再整组追加，
 *      旧行一条不少；★ 存量 prediction（读口剥文案 ⇒ ab_legacy）被跳过、载荷不含其文案（原
 *      project-publish ⑤ 同题迁移到新挂载点）；
 *   ④ 普通用户（非 owner ∧ 无 manage_tasks）⇒ **零操作钮**，只读视图与项目归属行仍在，
 *      `task_status` 徽标仍可见（只读信息，非操作）；
 *   ⑤ 未登录 ⇒ 同④零操作钮、零管理员取数；
 *   ⑥ 归属项目读口失败 ⇒ **安全降级只读**（绝不本地猜权限），项目归属行整行不渲染；
 *   ⑦ prediction 且父 task 非 draft ⇒ 无【编辑】、只留锁定说明；删除仍可用（同旧契约）。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const API = vi.hoisted(() => ({
  fetchCampaignDetail: vi.fn(),
  fetchCampaignCurrencies: vi.fn(),
  fetchProjectDetail: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  appendProjectSubtasks: vi.fn(),
}))
vi.mock('../../pages/campaign/campaign-api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCampaignDetail: API.fetchCampaignDetail,
  fetchCampaignCurrencies: API.fetchCampaignCurrencies,
}))
vi.mock('../../pages/project/project-api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProjectDetail: API.fetchProjectDetail,
  createProjectCampaignTask: API.createProjectCampaignTask,
  appendProjectSubtasks: API.appendProjectSubtasks,
}))

const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import CampaignDetailPage from '../../pages/campaign/CampaignDetailPage'
const renderCampaign = (ref = '501') => render(
  <MemoryRouter initialEntries={[`/campaign/${ref}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/campaign/:ref" element={<CampaignDetailPage />} />
    </Routes>
  </MemoryRouter>,
)

const subtasks = () => ([
  { subtask_id: 901, type_code: 'x_verify', title: '转发推文', content: '附链接', payload: { links: ['https://x.com/a'] }, sort: 1, required: true },
  { subtask_id: 902, type_code: 'survey', title: '填写问卷', content: '', payload: { answers: { q1: 'a' } }, sort: 2, required: false },
])

const taskOf = (patch = {}) => ({
  task_id: 555,
  campaign_id: '501',
  title: '转发推文',
  description: '转发并截图',
  status: 'active',
  sort: 1,
  time_start: null,
  time_end: null,
  reward_amount_primary: '5',
  reward_cid_secondary: null,
  reward_amount_secondary: null,
  subtasks: subtasks(),
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

/** 项目读口行（页面归属行 + owner 闸的数据面）；campaigns 嵌套同时喂 SubtaskForm 的新鲜读。 */
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

const fill = (root, selector, value) => {
  const el = root.querySelector(selector)
  expect(el, selector).not.toBeNull()
  fireEvent.change(el, { target: { value } })
  return el
}

const submit = (root, formSel) => {
  const form = root.querySelector(formSel)
  expect(form, formSel).not.toBeNull()
  fireEvent.submit(form)
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  API.fetchCampaignDetail.mockResolvedValue(campaignOf())
  API.fetchCampaignCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }])
  API.fetchProjectDetail.mockResolvedValue(projectRow())
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
  API.createProjectCampaignTask.mockResolvedValue({ task_id: 777 })
  API.appendProjectSubtasks.mockResolvedValue({ task_id: 555 })
})

afterEach(cleanup)

// ---------------------------------------------------------------------------
describe('① owner 视图：三入口 + 上下线 + 行级编辑/删除可达，徽标与项目归属行在场', () => {
  it('owner（owner_uid=本人）⇒ 发布任务 / 发布子任务 / 上下线 / 编辑 / 删除全部渲染', async () => {
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task"]')).not.toBeNull())

    // 操作区【发布任务】（campaign 已锁定）
    expect(container.querySelector('[data-sf-m="campaign-entry-task"]')).not.toBeNull()
    // 任务卡：task_status 徽标 + 上下线开关（active ⇒ 下一步 draft）+ 卡内【发布子任务】
    const badge = container.querySelector('[data-sf-m="campaign-task-status"]')
    expect(badge.getAttribute('data-sf-state')).toBe('active')
    const toggle = container.querySelector('[data-sf-m="campaign-task-status-toggle"]')
    expect(toggle.getAttribute('data-sf-task')).toBe('555')
    expect(toggle.getAttribute('data-sf-next')).toBe('draft')
    const entry = container.querySelector('[data-sf-m="campaign-task-entry-subtask"]')
    expect(entry.getAttribute('data-sf-task')).toBe('555')
    // 子任务行级【编辑】【删除】（每行一对）
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-edit"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-delete"]')).toHaveLength(2)
    // 项目归属行（头像 + 项目名 → /<slug>；无 avatar ⇒ 回落字牌）
    const row = container.querySelector('[data-sf-m="campaign-project-row"]')
    expect(row.getAttribute('href')).toBe('/sui')
    expect(row.querySelector('[data-sf-m="campaign-project-avatar"]')).not.toBeNull()
    expect(row.querySelector('[data-sf-m="campaign-project-title"]').textContent).toBe('海鲜打包')
  })

  it('【上线/下线】draft ⇒ 下一步 active（draft⇄active 双向可切；ended 封板无钮）', async () => {
    API.fetchCampaignDetail.mockResolvedValue(campaignOf({ tasks: [taskOf({ status: 'draft' })] }))
    const first = renderCampaign()
    await waitFor(() => expect(first.container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).not.toBeNull())
    expect(first.container.querySelector('[data-sf-m="campaign-task-status-toggle"]').getAttribute('data-sf-next')).toBe('active')
    first.unmount()

    API.fetchCampaignDetail.mockResolvedValue(campaignOf({ tasks: [taskOf({ status: 'ended' })] }))
    const second = renderCampaign()
    await waitFor(() => expect(second.container.querySelector('[data-sf-m="campaign-task"]')).not.toBeNull())
    expect(second.container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).toBeNull()
    expect(second.container.querySelector('[data-sf-m="campaign-task-status"]').getAttribute('data-sf-state')).toBe('ended')
  })
})

// ---------------------------------------------------------------------------
describe('② 操作区【发布任务】：campaign 已锁定 + 载荷对拍 + 静默重读', () => {
  it('点【发布任务】⇒ 表单就地打开、锁 501、无活动选择器；提交 POST 到 501，成功收面板给结论并重读', async () => {
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-entry-task"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-entry-task"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-task"]')).not.toBeNull())

    // 预选锁定：锁的是本页活动，选择器不渲染
    const locked = container.querySelector('[data-sf-m="project-form-campaign-locked"]')
    expect(locked.getAttribute('data-sf-ref')).toBe('501')
    expect(locked.textContent).toContain('秋季招募')
    expect(container.querySelector('[data-sf-m="project-form-task"] [data-sf-field="campaign"]')).toBeNull()

    const form = '[data-sf-m="project-form-task"]'
    fill(container, `${form} [data-sf-field="title"]`, '转发推文')
    fill(container, `${form} [data-sf-field="description"]`, '转发并截图')
    fill(container, `${form} [data-sf-field="reward"]`, '5')
    fill(container, `${form} [data-sf-field="sort"]`, '2')
    fill(container, `${form} [data-sf-row="0"] [data-sf-field="title"]`, '转发')
    fill(container, `${form} [data-sf-row="0"] [data-sf-field="content"]`, '附链接')
    fill(container, `${form} [data-sf-row="0"] [data-sf-field="sort"]`, '1')
    submit(container, form)

    await waitFor(() => expect(API.createProjectCampaignTask).toHaveBeenCalledTimes(1))
    const [campaignRef, payload] = API.createProjectCampaignTask.mock.calls[0]
    expect(campaignRef).toBe('501')
    expect(payload).toEqual({
      title: '转发推文',
      description: '转发并截图',
      time_start: null,
      time_end: null,
      sort: 2,
      reward_amount_primary: '5',
      subtasks: [{
        type_code: 'x_verify',
        title: '转发',
        content: '附链接',
        payload: {},
        sort: 1,
        required: true,
      }],
    })
    expect(payload).not.toHaveProperty('status')

    // 成功 ⇒ 收面板 + 页内结论 + 静默重读（fetchCampaignDetail ≥ 2 次）
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-task"]')).toBeNull())
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-manage-notice"]').textContent).toBe('project.published'))
    expect(API.fetchCampaignDetail.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
describe('③ 卡内【发布子任务】：双锁 + 新鲜重读整组追加（旧行一条不少）', () => {
  it('点任务卡入口 ⇒ 表单落在该卡、活动+任务双锁；提交前重读 → PATCH 组 = 旧 2 + 新 1', async () => {
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]')).not.toBeNull())
    const readBefore = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())

    // 就地渲染在任务卡内；活动 + 任务均锁定，两个选择器都不在
    const taskCard = container.querySelector('[data-sf-m="campaign-task"]')
    expect(taskCard.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull()
    const locked = taskCard.querySelector('[data-sf-m="project-form-task-locked"]')
    expect(locked.getAttribute('data-sf-campaign')).toBe('501')
    expect(locked.getAttribute('data-sf-ref')).toBe('555')
    expect(container.querySelector('[data-sf-m="project-form-subtask"] [data-sf-field="campaign"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-form-subtask"] [data-sf-field="task"]')).toBeNull()

    const form = '[data-sf-m="project-form-subtask"]'
    fill(container, `${form} [data-sf-field="type"]`, 'survey')
    fill(container, `${form} [data-sf-field="title"]`, '新问卷')
    fill(container, `${form} [data-sf-field="content"]`, '填写')
    fill(container, `${form} [data-sf-field="sort"]`, '3')
    submit(container, form)

    await waitFor(() => expect(API.appendProjectSubtasks).toHaveBeenCalledTimes(1))
    // 提交前**新鲜重读**（不用页面缓存）：重读发生在 PATCH 之前（调用顺序可判）
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(readBefore)
    const freshOrder = API.fetchProjectDetail.mock.invocationCallOrder[readBefore]
    expect(freshOrder).toBeLessThan(API.appendProjectSubtasks.mock.invocationCallOrder[0])
    const [taskRef, group] = API.appendProjectSubtasks.mock.calls[0]
    expect(taskRef).toBe('555')
    expect(group).toHaveLength(3)
    expect(group[0].subtask_id).toBe('901')
    expect(group[0].payload).toEqual({ links: ['https://x.com/a'] })
    expect(group[1].subtask_id).toBe('902')
    expect(group[2]).toEqual({
      type_code: 'survey',
      title: '新问卷',
      content: '填写',
      payload: {},
      sort: 3,
      required: true,
    })
    expect(group.filter((row) => row.subtask_id).map((row) => row.subtask_id)).toEqual(['901', '902'])

    // 成功 ⇒ 收卡内表单 + 页内结论
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull())
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-manage-notice"]').textContent).toBe('project.published'))
  })

  it('★ 存量 prediction 行（读口剥文案 ⇒ option_style=ab_legacy）⇒ PATCH 载荷只剩可重发行 + 新行', async () => {
    const legacyStripped = {
      subtask_id: 903, task_id: 555, type_code: 'prediction', type_label: '预测',
      title: '谁会赢', content: null,
      payload: { prize_amount: '10', deadline: '2026-11-05T00:00:00.000Z' },
      sort: 3, required: false, prediction_state: 'open', option_style: 'ab_legacy',
    }
    API.fetchCampaignDetail.mockResolvedValue(campaignOf({ tasks: [taskOf({ subtasks: [...subtasks(), legacyStripped] })] }))
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())

    const form = '[data-sf-m="project-form-subtask"]'
    fill(container, `${form} [data-sf-field="type"]`, 'survey')
    fill(container, `${form} [data-sf-field="title"]`, '新问卷')
    fill(container, `${form} [data-sf-field="content"]`, '填写')
    fill(container, `${form} [data-sf-field="sort"]`, '4')
    submit(container, form)

    await waitFor(() => expect(API.appendProjectSubtasks).toHaveBeenCalledTimes(1))
    const [taskRef, group] = API.appendProjectSubtasks.mock.calls[0]
    expect(taskRef).toBe('555')
    expect(group.filter((row) => row.subtask_id).map((row) => row.subtask_id)).toEqual(['901', '902'])
    expect(group.some((row) => row.subtask_id === '903')).toBe(false)
    expect(group.at(-1)).toEqual({
      type_code: 'survey',
      title: '新问卷',
      content: '填写',
      payload: {},
      sort: 4,
      required: true,
    })
    // 整条载荷里没有存量行的两枚选项文案（口径不得被前端改写）
    expect(JSON.stringify(group)).not.toContain('option_a')
  })
})

// ---------------------------------------------------------------------------
describe('④⑤ 普通用户 / 未登录 ⇒ 零操作钮（只读视图与徽标照旧）', () => {
  it('普通用户（非 owner ∧ 无 manage_tasks）⇒ 五类操作元素全不渲染；只读面 + 归属行 + 徽标在场', async () => {
    API.fetchProjectDetail.mockResolvedValue(projectRow({ owner_uid: 99 }))
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task"]')).not.toBeNull())

    expect(container.querySelector('[data-sf-m="campaign-entry-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-edit"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-delete"]')).toHaveLength(0)
    expect(container.querySelector('[data-sf-m="campaign-manage"]')).toBeNull()
    // 只读视图原样：任务卡 + 子任务徽标 + required 标记
    expect(container.querySelector('[data-sf-m="campaign-task-title"]').textContent).toBe('转发推文')
    const badges = [...container.querySelectorAll('[data-sf-m="campaign-subtask-type"]')].map((el) => el.textContent)
    expect(badges).toEqual(['campaign.type.x_verify', 'campaign.type.survey'])
    expect(container.querySelector('[data-sf-m="campaign-subtask-required"]').getAttribute('data-sf-required')).toBe('1')
    // task_status 徽标 = 只读信息，仍可见；项目归属行仍可见
    expect(container.querySelector('[data-sf-m="campaign-task-status"]').getAttribute('data-sf-state')).toBe('active')
    expect(container.querySelector('[data-sf-m="campaign-project-row"]').getAttribute('href')).toBe('/sui')
    // 零写请求
    expect(API.createProjectCampaignTask).not.toHaveBeenCalled()
    expect(API.appendProjectSubtasks).not.toHaveBeenCalled()
  })

  it('未登录 ⇒ 同样零操作钮，且零管理员三键取数', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="campaign-entry-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-edit"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-delete"]')).toHaveLength(0)
    expect(ADMIN.loadListingEditAdmin).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('⑥ 归属项目读口失败 ⇒ 安全降级只读（绝不本地猜权限）', () => {
  it('项目读口 reject ⇒ 即便 owner_uid 匹配也不出操作钮；归属行整行不渲染', async () => {
    API.fetchProjectDetail.mockRejectedValue(new Error('boom'))
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task"]')).not.toBeNull())
    await waitFor(() => expect(API.fetchProjectDetail).toHaveBeenCalled())

    expect(container.querySelector('[data-sf-m="campaign-entry-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask-edit"]')).toHaveLength(0)
    expect(container.querySelector('[data-sf-m="campaign-project-row"]')).toBeNull()
    // 只读视图不受影响
    expect(container.querySelector('[data-sf-m="campaign-task-title"]').textContent).toBe('转发推文')
  })
})

// ---------------------------------------------------------------------------
describe('⑦ prediction 发布后锁（父 task 非 draft）⇒ 无【编辑】、只留锁定说明', () => {
  it('active task 的 prediction 行 ⇒ campaign-subtask-locked 在场、无编辑钮；删除仍可用', async () => {
    const predictionRow = {
      subtask_id: 5011, task_id: 555, type_code: 'prediction', type_label: '预测',
      title: '谁会赢', content: null, payload: { prize_amount: '10', deadline: '2026-11-05T00:00:00.000Z' },
      sort: 4, required: true, prediction_state: 'open', option_style: 'yes_no',
    }
    API.fetchCampaignDetail.mockResolvedValue(campaignOf({ tasks: [taskOf({ status: 'active', subtasks: [predictionRow] })] }))
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-subtask-locked"]')).not.toBeNull())

    const row = container.querySelector('[data-sf-m="campaign-subtask"][data-sf-subtask="5011"]')
    expect(row.querySelector('[data-sf-m="campaign-subtask-edit"]')).toBeNull()
    expect(row.querySelector('[data-sf-m="campaign-subtask-locked"]').textContent).toBe('project.predictionLocked')
    // 删除不受此锁（服务端只在「有凭证」时拒）
    expect(row.querySelector('[data-sf-m="campaign-subtask-delete"]')).not.toBeNull()
    // 非 prediction 语义的锁不波及别的行（此处唯一行即 prediction，行数自证）
    expect(container.querySelectorAll('[data-sf-m="campaign-subtask"]')).toHaveLength(1)
  })
})
