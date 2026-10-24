import React, { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// P6-I18N-LIT-B4a：DashboardPage 已接 `t()`（后台面字面量走 locale）⇒ 测试须挂真实 i18n 实例；
// jsdom 路径 `/` ⇒ 语言 = zh，故本文既有中文断言（zh 词典取值与原文逐字一致）不受影响。
import '../../i18n'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(),
  fetchApiJson: vi.fn(),
  getAuthToken: vi.fn(),
  hasAdminPermission: vi.fn(),
  isAdminUser: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

import toast from 'react-hot-toast'
import DashboardPage from '../../pages/DashboardPage'
import { useAuth } from '../../auth-context'
import { fetchAdminAccess, fetchApiJson, getAuthToken, hasAdminPermission, isAdminUser } from '../../admin-utils'

/**
 * ★ 2026-10-24（Kevin 裁定 · `/dashboard` 审核面板下线）：本页原「Task Progress 审批」面板
 *   整块拆除 —— 它消费的审核队列两口（tasklist pending 队列 + 其 /count）与动作口
 *   `POST /api/tasklist/:id/verify` 已于 `43ea14a`（2026-10-21，job 领域下线）随 21 条路由从
 *   backend-ts 删除，生产实测 404（`LEDGER_REF_NOT_FOUND` / `ref_type=endpoint`）
 *   ⇒ 面板长期只显示「加载失败」。
 *
 * 本文件把「面板在场」类用例改为**反向判据**（面板 / 读口 / 写口一并不得在场），
 * 仍留 ①②③ 三条在役判据（零审核请求 · 其余统计与管理入口不受误伤 · job 面零残留）。
 *
 * 删除的用例与原因（判据底随实现一并消失，非降强度）：
 *   ① 原「reloads pending review endpoints after approving a submission」—— 面板、通过/驳回钮、
 *      pending 两口与 `handleVerifyTask` 全删，锚点已不存在（其判据被下方「零审核读口」反向用例接管）；
 *   ② 原「falls back to the pending list length when the count endpoint fails」—— 被测函数
 *      `resolvePendingVerificationCount`（count 失败降级取列表长度）已随面板删除；
 *   ③ 原「S18：已登录用户（无 review_tasks）⇒ 队列面板按登录态放开」—— 队列门本身已删。
 */

const currentUser = {
  uID: 7,
  EVM: '0x1234567890123456789012345678901234567890',
  token: 'dashboard-token',
}

const reviewAccess = {
  is_admin: false,
  permissions: ['review_tasks'],
  can_access_admin: true,
}

const renderDashboard = async () => {
  let view

  await act(async () => {
    view = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardPage />
      </MemoryRouter>
    )
  })

  return view
}

const calledUrls = () => fetchApiJson.mock.calls.map(([url]) => String(url))

describe('DashboardPage（管理总览 · 审核面板已下线）', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuth.mockReturnValue({
      user: currentUser,
      isAuthenticated: true,
    })

    fetchAdminAccess.mockResolvedValue(reviewAccess)
    getAuthToken.mockImplementation((user) => user?.token || '')
    isAdminUser.mockReturnValue(false)
    hasAdminPermission.mockImplementation((access, permission) => {
      if (!access) return false
      if (access.is_admin) return true
      if (!permission) return Boolean(access.can_access_admin)
      if (Array.isArray(permission)) {
        return permission.some((item) => (access.permissions || []).includes(item))
      }
      return (access.permissions || []).includes(permission)
    })
  })

  it('① 审核面板零残留：零审核读口请求、无通过/驳回钮、无搜索框、无队列与「待审核」卡', async () => {
    // ★ 负对照内建：读口分支里**只**有 user/stats 与 prize/all ⇒ 页面一旦回退去拉审核队列，
    //   mock 会抛 `Unexpected URL`（toast 报「部分数据加载失败」）⇒ 本例如红。
    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/user/stats') return { user_count: 10, admin_count: 1, total_points: 500 }
      if (url === '/api/prize/all') return [{ bID: 1 }]
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()

    expect(await screen.findByText('管理总览')).toBeInTheDocument()

    const urls = calledUrls()
    expect(urls.filter((url) => url.includes('/api/tasklist/'))).toEqual([])
    expect(urls.some((url) => /pending|verify/i.test(url))).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()

    // 面板 UI 零残留（标题 / 搜索框 / 通过驳回钮 / 队列摘要 / 待审核统计卡）
    expect(screen.queryByText('普通用户 Task Progress 审批')).toBeNull()
    expect(screen.queryByPlaceholderText('搜索 Task Progress 任务、地址或提交内容...')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: '通过审核' })).toBeNull()
    expect(screen.queryByRole('button', { name: '驳回' })).toBeNull()
    expect(screen.queryByText('待审核提交')).toBeNull()
    // 反向断言的对照：其余统计卡与入口面板仍在（不是「整页被拆空」蒙对）
    expect(screen.getByText('总用户数')).toBeInTheDocument()
    expect(screen.getByText('管理入口')).toBeInTheDocument()
  })

  it('② 角色徽标保留非审核语义：审核员 / 员工 / 管理员三档照旧', async () => {
    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/user/stats') return { user_count: 10, admin_count: 1, total_points: 500 }
      if (url === '/api/prize/all') return [{ bID: 1 }]
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()
    expect(await screen.findByText('审核员')).toBeInTheDocument()

    // 无任何权限 ⇒ 后台成员
    cleanup()
    hasAdminPermission.mockReturnValue(false)
    await renderDashboard()
    expect(await screen.findByText('后台成员')).toBeInTheDocument()

    // 管理员
    cleanup()
    fetchAdminAccess.mockResolvedValue({ is_admin: true, permissions: [], can_access_admin: true })
    await renderDashboard()
    expect(await screen.findByText('管理员')).toBeInTheDocument()
  })

  it('③ job 下线收尾：零 `/api/task/all` 请求，「任务总数」卡已撤（campaign 读口给不出真总数）', async () => {
    // ★ 负对照内建：读口分支里**没有** `/api/task/all` ⇒ 一旦页面回退去拉旧悬赏全表，
    //   本 mock 会抛 `Unexpected URL`（toast 报「部分数据加载失败」）⇒ 本例两条断言同时转红。
    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/user/stats') return { user_count: 10, admin_count: 1, total_points: 500 }
      if (url === '/api/prize/all') return [{ bID: 1 }, { bID: 2 }]
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()

    expect(await screen.findByText('管理总览')).toBeInTheDocument()
    expect(calledUrls().some((url) => url.includes('/api/task/all'))).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()
    // 在役四张统计卡（用户 / 管理员 / 积分 / 奖品）；「任务类型」卡与「待审核」卡均已撤
    expect(screen.queryByText('任务类型')).toBeNull()
    expect(screen.queryByText('待审核提交')).toBeNull()
    expect(screen.getByText('总用户数')).toBeInTheDocument()
    expect(screen.getByText('管理员数量')).toBeInTheDocument()
    expect(screen.getByText('累计积分')).toBeInTheDocument()
    expect(screen.getByText('奖品数量')).toBeInTheDocument()
  })

  it('④ 无后台权限 ⇒ 「权限不足」卡（且零统计读口）', async () => {
    fetchAdminAccess.mockResolvedValue({ is_admin: false, permissions: [], can_access_admin: false })
    hasAdminPermission.mockReturnValue(false)

    await renderDashboard()

    expect(await screen.findByText('权限不足')).toBeInTheDocument()
    expect(screen.queryByText('管理总览')).toBeNull()
    expect(fetchApiJson).not.toHaveBeenCalled()
  })
})
