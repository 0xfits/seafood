/**
 * `/task` · **campaign 任务列表页** 单测（job 下线收尾 · 本单新增）
 *
 * 口径（Kevin 2026-10-21：job / 悬赏体系弃用 ⇒ `/task` 改挂 campaign 任务）：
 *   ① 列表渲染：`GET /api/home/campaign-tasks` 行 ⇒ 复用首页卡 `HomeCampaignCard` 逐行成卡
 *      （项目名 / 活动名 / 标题 / 状态 / 参与 / 奖励）；
 *   ② 卡 href = `/task/<task_id>`，**点卡**真跳该任务页（路由互不吞）；
 *   ③ 空态：读口回空数组 ⇒ 空态卡（`taskPage.emptyAvailable`）+ 零卡；
 *   ④ 错误态：读口 reject ⇒ 空态 + `role="alert"` 错误行（文案 = `错误: <message>`）；
 *   ⑤ 旧 job 面零命中：零 `/api/task/all` 直连、零发布入口 `/task/new`、零 `/bounty/*` 链接。
 *
 * 手法：真 `TaskPage` + 真 `HomeCampaignCard` + 真 i18n（zh 兜底，jsdom 路径无语言前缀）；
 *   只 mock 接线层 `../../home-api` 与登录态 `../../auth-context`（本仓既有先例：home-page.test.jsx）。
 */
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../home-api', () => ({
  fetchHomeCampaignTasks: vi.fn(),
  fetchHomeCurrencies: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

import '../../i18n'
import TaskPage from '../../pages/TaskPage'
import { fetchHomeCampaignTasks, fetchHomeCurrencies } from '../../home-api'
import { useAuth } from '../../auth-context'

const ROWS = [
  {
    task_id: 101, campaign_id: 501, title: '转发推文', status: 'active',
    joined_count: 3, joined_target: 50, reward_amount_primary: '5',
    campaign_title: '秋季招募', project_title: '海鲜打包', project_slug: 'sui', project_avatar_url: '',
  },
  {
    task_id: 102, campaign_id: 501, title: '填写问卷', status: 'active',
    joined_count: 7, reward_amount_primary: '3',
    campaign_title: '秋季招募', project_title: '海鲜分拣', project_slug: 'fenjian', project_avatar_url: '',
  },
]

const ANON = { user: null, isAuthenticated: false }

const renderTaskPage = (entry = '/task') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/task" element={<TaskPage />} />
      <Route path="/task/:taskId" element={<div data-sf-m="task-detail-stub">detail</div>} />
    </Routes>
  </MemoryRouter>
)

const cardsOf = (container) => [...container.querySelectorAll('[data-sf-m="home-camp-card"]')]

describe('TaskPage · campaign 任务列表', () => {
  let consoleWarnSpy
  let fetchSpy

  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue(ANON)
    fetchHomeCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }])
    // 断言「页面不经裸 fetch 直连旧读口」：任何裸 fetch 调用都会命中本替身并抛错。
    fetchSpy = vi.fn(() => { throw new Error('NETWORK_DISABLED_IN_TEST') })
    vi.stubGlobal('fetch', fetchSpy)
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    consoleWarnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('① 列表渲染：campaign 行逐条成卡（项目 / 活动 / 标题 / 状态 / 参与 / 奖励）', async () => {
    fetchHomeCampaignTasks.mockResolvedValue(ROWS)

    const { container } = renderTaskPage()

    expect(await screen.findByRole('heading', { name: '悬赏中心' })).toBeInTheDocument()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(2))

    const cards = cardsOf(container)
    expect(cards[0].textContent).toContain('转发推文')
    expect(cards[0].textContent).toContain('海鲜打包')
    expect(cards[0].textContent).toContain('秋季招募')
    // 状态徽标：active ⇒ `common.ongoing`
    expect(cards[0].querySelector('[data-sf-m="home-camp-status"]').getAttribute('data-sf-state')).toBe('active')
    expect(cards[0].textContent).toContain('进行中')
    // 参与：带 joined_target ⇒ 已参与 X / 共 Y 人
    expect(cards[0].textContent).toContain('已参与 3 / 共 50 人')
    // 奖励：主奖励恒 $ + 金额
    expect(cards[0].querySelector('[data-sf-m="home-camp-reward"]').textContent).toContain('5')

    expect(cards[1].textContent).toContain('填写问卷')
    expect(cards[1].textContent).toContain('海鲜分拣')
    // 无 joined_target ⇒ 只显已参与 X 人
    expect(cards[1].textContent).toContain('已参与 7 人')

    // 读口恰一次；币种表恰一次
    expect(fetchHomeCampaignTasks).toHaveBeenCalledTimes(1)
    expect(fetchHomeCurrencies).toHaveBeenCalledTimes(1)
  })

  it('② 卡 href = /task/<task_id>，点卡真跳该任务页', async () => {
    fetchHomeCampaignTasks.mockResolvedValue(ROWS)

    const { container } = renderTaskPage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(2))

    const cards = cardsOf(container)
    expect(cards[0].tagName).toBe('A')
    expect(cards[0].getAttribute('href')).toBe('/task/101')
    expect(cards[0].getAttribute('data-sf-task')).toBe('101')
    expect(cards[1].getAttribute('href')).toBe('/task/102')
    // 卡主目标 = 任务页（不是活动页）
    expect(cards[0].getAttribute('href').startsWith('/campaign/')).toBe(false)

    await userEvent.click(cards[1])
    expect(await screen.findByText('detail')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '悬赏中心' })).toBeNull()
  })

  it('③ 空态：读口回空数组 ⇒ 空态卡 + 零卡（不渲染残卡）', async () => {
    fetchHomeCampaignTasks.mockResolvedValue([])

    const { container } = renderTaskPage()

    expect(await screen.findByText('暂无可用悬赏')).toBeInTheDocument()
    expect(screen.getByText('请稍后再来查看')).toBeInTheDocument()
    expect(container.querySelector('[data-sf-m="task-list-grid"]')).toBeNull()
    expect(cardsOf(container)).toHaveLength(0)
    // 空态 ≠ 错误态：无 alert 行
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('④ 错误态：读口 reject ⇒ 空态 + role=alert 错误行（文案 = 错误: <message>）', async () => {
    fetchHomeCampaignTasks.mockRejectedValue(new Error('campaign down'))

    const { container } = renderTaskPage()

    expect(await screen.findByText('暂无可用悬赏')).toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('data-sf-m')).toBe('task-list-error')
    expect(alert.textContent).toBe('错误: campaign down')
    expect(cardsOf(container)).toHaveLength(0)
    // 降级路径留痕（console.warn，不是未捕获异常）
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('⑤ 旧 job 面零命中：无 /api/task/all 直连、无发布入口 /task/new、无 /bounty/* 链接', async () => {
    fetchHomeCampaignTasks.mockResolvedValue(ROWS)

    const { container } = renderTaskPage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(2))

    // 裸 fetch 零调用（读口恒走 `home-api` 接线层 ⇒ 不可能命中旧 `/api/task/all`）
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fetchHomeCampaignTasks.mock.calls.every(([user]) => user === null || user === undefined)).toBe(true)

    // 页内链接闭集 = 任务卡（/task/:id）+ 审核口（/task/review）；无发布口、无悬赏详情口
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs.some((href) => String(href).includes('/task/new'))).toBe(false)
    expect(hrefs.some((href) => String(href).startsWith('/bounty/'))).toBe(false)
    expect(hrefs).toContain('/task/review')
    expect(screen.queryByText('发布悬赏')).toBeNull()
    expect(container.querySelector('[data-sf-m="jobs-form-wrap"]')).toBeNull()
  })
})
