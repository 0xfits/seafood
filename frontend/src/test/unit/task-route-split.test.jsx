/**
 * 路由重切单测（Kevin 2026-10-21 需求①）：`/task/<id>` = campaign 任务页 · `/bounty/<id>` = 悬赏详情
 *
 * 判据（逐条对齐派单「路由冲突处理」）：
 *   ① `/task/new` ⇒ 发布悬赏页（静态段不被 `:taskId` 吃掉）
 *   ② `/task/review` ⇒ 审核页（同上）
 *   ③ `/task`（无段）⇒ 任务/悬赏列表页（段数不同，与 `task/:taskId` 不互吞）
 *   ④ `/task/7` ⇒ **campaign 任务页**（旧 job 详情不再占此路径）
 *   ⑤ `/bounty/9` ⇒ **悬赏详情**（迁入后的地址）
 *   ⑥ 四语前缀档（`/en/task/7`、`/en/bounty/9`）同样可达（内层相对段，前缀由 LangShell 承担）
 *
 * 手法：真 `App.jsx`（含 LangShell 内层路由表）+ 各页面替身（零网络、零模块副作用）；
 *   外壳替身只做 children 透传（本单验路由归属，不验壳）。
 */
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
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

const P = vi.hoisted(() => ({
  home: () => <div>PAGE_HOME</div>,
  task: () => <div>PAGE_TASK_LIST</div>,
  publishJob: () => <div>PAGE_TASK_NEW</div>,
  jobReview: () => <div>PAGE_TASK_REVIEW</div>,
  jobDetail: () => <div>PAGE_BOUNTY_DETAIL</div>,
  campaignTask: () => <div>PAGE_CAMPAIGN_TASK</div>,
  campaignList: () => <div>PAGE_CAMPAIGN_LIST</div>,
  campaignDetail: () => <div>PAGE_CAMPAIGN_DETAIL</div>,
  project: () => <div>PAGE_PROJECT</div>,
  login: () => <div>PAGE_LOGIN</div>,
  notFound: () => <div>PAGE_NOT_FOUND</div>,
}))

vi.mock('../../pages/HomePage', () => ({ default: P.home }))
vi.mock('../../pages/TaskPage', () => ({ default: P.task }))
vi.mock('../../pages/jobs/PublishJobPage', () => ({ default: P.publishJob }))
vi.mock('../../pages/jobs/JobReviewPage', () => ({ default: P.jobReview }))
vi.mock('../../pages/jobs/JobDetailPage', () => ({ default: P.jobDetail }))
vi.mock('../../pages/campaign/CampaignTaskPage', () => ({ default: P.campaignTask }))
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

beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

describe('路由重切：/task 家族与 /bounty 不互吞', () => {
  const CASES = [
    ['/task', 'PAGE_TASK_LIST'],
    ['/task/new', 'PAGE_TASK_NEW'],
    ['/task/review', 'PAGE_TASK_REVIEW'],
    ['/task/7', 'PAGE_CAMPAIGN_TASK'],
    ['/bounty/9', 'PAGE_BOUNTY_DETAIL'],
    ['/en/task/7', 'PAGE_CAMPAIGN_TASK'],
    ['/en/bounty/9', 'PAGE_BOUNTY_DETAIL'],
    ['/hk/task', 'PAGE_TASK_LIST'],
    ['/vn/task/new', 'PAGE_TASK_NEW'],
  ]

  it.each(CASES)('%s ⇒ %s（且只有这一个页面命中）', (entry, expected) => {
    renderAt(entry)
    const hit = markers()
    expect(hit).toEqual([expected])
  })

  it('/task 与 /task/7 是两个不同体系：列表页 ≠ 任务页，悬赏详情只在 /bounty', () => {
    renderAt('/task')
    expect(markers()).toEqual(['PAGE_TASK_LIST'])
    cleanup()
    renderAt('/task/7')
    expect(markers()).toEqual(['PAGE_CAMPAIGN_TASK'])
    cleanup()
    renderAt('/bounty/9')
    expect(markers()).toEqual(['PAGE_BOUNTY_DETAIL'])
    expect(markers()).not.toContain('PAGE_CAMPAIGN_TASK')
  })

  it('/campaign/:id 与 /task/:id 分属两条体系（活动详情不被任务页吞）', () => {
    renderAt('/campaign/501')
    expect(markers()).toEqual(['PAGE_CAMPAIGN_DETAIL'])
  })
})
