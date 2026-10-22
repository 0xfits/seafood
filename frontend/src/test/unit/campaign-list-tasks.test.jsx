import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

import '../../i18n'
import CampaignListPage from '../../pages/campaign/CampaignListPage'
import HomePage from '../../pages/HomePage'
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { useAuth } from '../../auth-context'

// ============================================================================
// `/campaign` 活动卡内任务列（2026-10-21 · 前端半）
//   ① 卡内列出该活动下**任务标题 + 奖励 + 状态**，行 = 唯一谓词（active 活动 ∧ active 任务）；
//   ② 活动下无可见任务 ⇒ 既有键 `campaign.tasksEmpty` 文案（零新增键）；
//   ③ ★ 与首页「热门任务」**同源**：同一批任务数据在两处渲染出的 task_id / 标题 / 奖励一致
//      （ended 行两处都不出现 —— 同一谓词，所以不存在「首页有、活动页没有」的漂移）。
// ============================================================================

const homeTask = (task) => ({
  task_id: task.task_id,
  campaign_id: 700,
  title: task.title,
  status: task.status,
  joined_count: 3,
  reward_amount_primary: task.reward_amount_primary,
  reward_amount_secondary: null,
  reward_cid_secondary: null,
  campaign_title: '主活动',
  project_title: '主项目',
  project_avatar_url: '',
})

const campaignOf = (tasks, overrides = {}) => ({
  campaign_id: 700,
  snowflake_id: 'snow-700',
  title: '主活动',
  description: '活动简述',
  status: 'active',
  time_start: null,
  time_end: null,
  tasks,
  ...overrides,
})

const TASKS = [
  { task_id: 902, title: '进行中甲', status: 'active', reward_amount_primary: '10' },
  { task_id: 901, title: '第一轮', status: 'active', reward_amount_primary: '25' },
  { task_id: 903, title: '已截止丙', status: 'ended', reward_amount_primary: '5' },
]

const renderCampaign = () => render(
  <MemoryRouter initialEntries={['/campaign']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <CampaignListPage />
  </MemoryRouter>
)

const renderHome = () => render(
  <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HomePage />
  </MemoryRouter>
)

/** 同一批任务数据 → 两处各自的读口形状（首页平坦行 / 活动嵌套行）。 */
const wireBothSurfaces = ({ tasks = TASKS, campaigns } = {}) => {
  fetchApiJson.mockImplementation(async (url) => {
    const u = String(url)
    if (u === '/api/campaign/all') return campaigns ?? [campaignOf(tasks)]
    if (u === '/api/home/campaign-tasks') return tasks.map(homeTask)
    if (u === '/api/currencies') return [{ cid: 1, symbol: '$' }]
    if (u === '/api/home?prize_limit=8') return { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 }
    if (u === '/api/prize-item') return []
    if (u === '/api/prize/all?skip=0&limit=36&sort=recommend') return []
    throw new Error(`Unexpected URL: ${u}`)
  })
}

const taskRowsOf = (container) => [...container.querySelectorAll('[data-sf-m="campaign-card-task-item"]')]
const taskLinkOf = (item) => item.querySelector('[data-sf-m="campaign-card-task"]')
const homeCardsOf = (container) => [...container.querySelectorAll('[data-sf-m="home-camp-card"]')]

describe('/campaign · 活动卡内任务列', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthHeaders.mockReturnValue({})
    useAuth.mockReturnValue({ user: null, isAuthenticated: false })
  })

  it('卡内列出任务标题 + 奖励 + 状态，行数 = 该活动可见任务数（ended 不进列表面）', async () => {
    wireBothSurfaces()

    const { container } = renderCampaign()
    await waitFor(() => expect(taskRowsOf(container)).toHaveLength(2))

    const rows = taskRowsOf(container)
    expect(rows.map((row) => taskLinkOf(row).getAttribute('data-sf-task'))).toEqual(['902', '901'])
    // 读口顺序（sort ASC）原样：不重排活动内任务
    expect(rows[0].textContent).toContain('进行中甲')
    expect(rows[0].textContent).toContain('10')
    expect(rows[0].querySelector('[data-sf-m="campaign-card-task-status"]').textContent).toBe('进行中')
    expect(rows[1].textContent).toContain('第一轮')
    expect(rows[1].textContent).toContain('25')
    // 奖励走 data-sf-amount（金额字符串原样，零精度改写）
    expect(rows[1].querySelector('[data-sf-m="campaign-card-task-reward"]').getAttribute('data-sf-amount')).toBe('25')
    // 任务行 → 任务自己的页面（唯一构造器，zh 档无前缀）
    expect(taskLinkOf(rows[1]).getAttribute('href')).toBe('/task/901')
    // ended 任务不在列表面
    expect(container.textContent).not.toContain('已截止丙')
    // 活动标题行 / 详情入口不受影响
    expect(container.querySelector('[data-sf-m="campaign-card-link"]').getAttribute('href')).toBe('/campaign/700')
    expect(container.querySelector('[data-sf-m="campaign-card-title"]').textContent).toBe('主活动')
  })

  it('活动下无可见任务 ⇒ 既有键 campaign.tasksEmpty 文案（零任务行）', async () => {
    wireBothSurfaces({
      campaigns: [campaignOf([{ task_id: 903, title: '已截止丙', status: 'ended', reward_amount_primary: '5' }])],
    })

    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-card-tasks-empty"]')).not.toBeNull())

    expect(taskRowsOf(container)).toHaveLength(0)
    expect(container.querySelector('[data-sf-m="campaign-card-tasks-empty"]').textContent).toBe('活动下暂无任务')
    expect(screen.getByText('活动下暂无任务')).toBeInTheDocument()
  })

  it('★ 与首页同源：同一批任务在两处渲染出的 task_id / 标题 / 奖励一致（ended 两处都不出现）', async () => {
    wireBothSurfaces()

    const campaignView = renderCampaign()
    await waitFor(() => expect(taskRowsOf(campaignView.container)).toHaveLength(2))
    const campaignTasks = taskRowsOf(campaignView.container).map((row) => ({
      id: taskLinkOf(row).getAttribute('data-sf-task'),
      title: row.querySelector('[data-sf-m="campaign-card-task-title"]').textContent,
      amount: row.querySelector('[data-sf-m="campaign-card-task-reward"]').getAttribute('data-sf-amount'),
    }))

    const homeView = renderHome()
    await waitFor(() => expect(homeCardsOf(homeView.container)).toHaveLength(2))
    // 首页：主卡（第一轮）置首，其余保持读口相对顺序
    const homeCards = homeCardsOf(homeView.container).map((card) => ({
      id: card.getAttribute('data-sf-task'),
      title: card.querySelector('[data-sf-m="home-camp-title"]').textContent,
      amount: card.querySelector('[data-sf-amount]').getAttribute('data-sf-amount'),
    }))

    expect(homeCards.map((card) => card.id)).toEqual(['901', '902'])
    // 两处 = 同一批任务（集合相等），标题与金额逐条一致
    expect([...homeCards.map((card) => card.id)].sort()).toEqual([...campaignTasks.map((task) => task.id)].sort())
    for (const card of homeCards) {
      const twin = campaignTasks.find((task) => task.id === card.id)
      expect(twin).toBeDefined()
      expect(twin.title).toBe(card.title)
      expect(twin.amount).toBe(card.amount)
    }
    // ended 行两处都为零命中（同一谓词，不存在单边漂移）
    expect(campaignView.container.textContent).not.toContain('已截止丙')
    expect(homeView.container.textContent).not.toContain('已截止丙')
  })

  it('活动列表读口失败 ⇒ 页内错误块 + 重试（不清空到无提示）', async () => {
    let attempt = 0
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      if (u === '/api/campaign/all') {
        attempt += 1
        if (attempt === 1) throw new Error('boom')
        return [campaignOf([TASKS[0]])]
      }
      throw new Error(`Unexpected URL: ${u}`)
    })

    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-error"]')).not.toBeNull())

    fireEvent.click(container.querySelector('[data-sf-m="campaign-retry"]'))
    await waitFor(() => expect(taskRowsOf(container)).toHaveLength(1))
    expect(taskLinkOf(taskRowsOf(container)[0]).getAttribute('data-sf-task')).toBe('902')
  })
})
