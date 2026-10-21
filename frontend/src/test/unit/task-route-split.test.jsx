/**
 * 路由归属单测：`/task` = campaign 任务列表 · `/task/<id>` = campaign 任务页 · `/task/review` = 审核队列
 *
 * 判据（Kevin 2026-10-21 裁定后逐条）：
 *   ① `/task`（无段）⇒ 任务列表页（段数不同，与 `task/:taskId` 不互吞）
 *   ② `/task/review` ⇒ 审核页（静态段优先于 `:taskId`）
 *   ③ `/task/7` ⇒ **campaign 任务页**（真页面渲染 + 读口行回填 `data-sf-task="7"`）
 *   ④ `/task/new` ⇒ **404**（发布页随 job 体系下线；该 URL 落 `task/:taskId` 的纯数字闸 ⇒ `NotFoundPage`）
 *   ⑤ `/bounty/9` ⇒ **404**（悬赏详情页与路由一并删除 ⇒ 内层 catch-all）
 *   ⑥ 四语前缀档（`/en/task/7`、`/vn/task/new`）同样成立（内层相对段，前缀由 LangShell 承担）
 *
 * 手法：
 *   · 真 `App.jsx`（含 LangShell 内层路由表）；列表页 / 审核页 / 活动页 = 替身（零网络）；
 *   · **任务页用真组件**（`CampaignTaskPage`）—— `/task/new` 的 404 由页面自身的纯数字闸给出，
 *     替身化会把这条判据测成「替身恒渲染」，故只替身其读口（`campaign-api`，零网络）。
 */
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

// 壳替身：只做 children 透传（Header/Footer/浮动菜单不参与本单判据）
vi.mock('../../shell/AppShell', () => ({
  default: ({ children }) => <div data-testid="shell">{children}</div>,
}))

vi.mock('../../site-text-overlay', async () => {
  const actual = await vi.importActual('../../site-text-overlay')
  return {
    ...actual,
    applySiteTextOverlay: () => 0,
    fetchSiteTextOverlay: async () => null,
  }
})

vi.mock('../../auth-context', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(),
  hasAdminPermission: vi.fn(() => false),
}))

// 任务页读口替身（零网络）：任意数字号都回一行 active 任务
vi.mock('../../pages/campaign/campaign-api', () => ({
  fetchCampaignTask: vi.fn(async (taskId) => ({
    task_id: String(taskId),
    title: `TASK_${taskId}`,
    description: '',
    status: 'active',
    reward_amount_primary: '5',
    reward_cid_secondary: null,
    reward_amount_secondary: null,
    joined_count: 0,
    campaign: { id: '501', title: 'CAMP', status: 'active' },
    project: { id: '11', title: 'PROJ', slug: 'proj', avatar_url: null, status: 'recruiting' },
    subtasks: [],
  })),
  fetchCampaignCurrencies: vi.fn(async () => []),
}))

const P = vi.hoisted(() => ({
  home: () => <div>PAGE_HOME</div>,
  task: () => <div>PAGE_TASK_LIST</div>,
  jobReview: () => <div>PAGE_TASK_REVIEW</div>,
  campaignList: () => <div>PAGE_CAMPAIGN_LIST</div>,
  campaignDetail: () => <div>PAGE_CAMPAIGN_DETAIL</div>,
  project: () => <div>PAGE_PROJECT</div>,
  login: () => <div>PAGE_LOGIN</div>,
  notFound: () => <div>PAGE_NOT_FOUND</div>,
}))

vi.mock('../../pages/HomePage', () => ({ default: P.home }))
vi.mock('../../pages/TaskPage', () => ({ default: P.task }))
vi.mock('../../pages/jobs/JobReviewPage', () => ({ default: P.jobReview }))
vi.mock('../../pages/campaign/CampaignListPage', () => ({ default: P.campaignList }))
vi.mock('../../pages/campaign/CampaignDetailPage', () => ({ default: P.campaignDetail }))
vi.mock('../../pages/project/ProjectPage', () => ({ default: P.project }))
vi.mock('../../pages/AuthPage', () => ({ default: P.login }))
vi.mock('../../pages/NotFoundPage', () => ({ default: P.notFound }))

import App from '../../App'

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </MemoryRouter>,
)

const markers = () => screen.queryAllByText(/^PAGE_/).map((node) => node.textContent)
const taskPageEl = () => document.querySelector('[data-sf-m="task-page"]')

beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

describe('路由归属：/task 家族（列表 / 审核）', () => {
  const CASES = [
    ['/task', 'PAGE_TASK_LIST'],
    ['/task/review', 'PAGE_TASK_REVIEW'],
    ['/hk/task', 'PAGE_TASK_LIST'],
    ['/campaign/501', 'PAGE_CAMPAIGN_DETAIL'],
  ]

  it.each(CASES)('%s ⇒ %s（且只有这一个页面命中）', (entry, expected) => {
    renderAt(entry)
    expect(markers()).toEqual([expected])
  })

  it('/task 与 /task/7 是两个不同体系：列表页 ≠ 任务页', async () => {
    renderAt('/task')
    expect(markers()).toEqual(['PAGE_TASK_LIST'])
    expect(taskPageEl()).toBeNull()
    cleanup()
    renderAt('/task/7')
    await waitFor(() => expect(taskPageEl()).not.toBeNull())
    expect(taskPageEl().getAttribute('data-sf-task')).toBe('7')
    expect(markers()).toEqual([]) // 未落任何替身页（列表/审核/404 都不在场）
  })
})

// ============================================================================
// 已下线的 job 面：发布 `/task/new` 与悬赏详情 `/bounty/:jobId`
//   ★ 2026-10-21 Kevin 裁定：job 体系弃用 ⇒ 两条路由与其页面一并删除。
//     `/task/new` 会被 `task/:taskId` 动态段吃掉（静态段不存在）⇒ 页面自身的**纯数字闸**把
//     非数字 taskId 判为不存在 ⇒ `<NotFoundPage />`（不发读口请求）；
//     `/bounty/9` 无对应路由 ⇒ 内层 catch-all 提示页（无重定向）。
// ============================================================================
describe('已下线 job 面落 404（/task/new · /bounty/:jobId）', () => {
  const GONE = ['/task/new', '/vn/task/new', '/bounty/9', '/en/bounty/9']

  it.each(GONE)('%s ⇒ PAGE_NOT_FOUND（且只有这一个页面命中）', (entry) => {
    renderAt(entry)
    expect(markers()).toEqual(['PAGE_NOT_FOUND'])
    expect(taskPageEl()).toBeNull()
  })

  it('两处都不得命中任务列表页 / 任务页 / 审核页（不是「换了个页面继续渲染」）', () => {
    for (const entry of ['/task/new', '/bounty/9']) {
      cleanup()
      renderAt(entry)
      expect(markers(), entry).not.toContain('PAGE_TASK_LIST')
      expect(markers(), entry).not.toContain('PAGE_TASK_REVIEW')
      expect(taskPageEl(), entry).toBeNull()
    }
  })
})
