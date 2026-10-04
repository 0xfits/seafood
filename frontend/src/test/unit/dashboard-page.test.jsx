import React, { act } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('DashboardPage', () => {
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

    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('reloads pending review endpoints after approving a submission', async () => {
    let pendingItems = [
      {
        jID: 101,
        tID: 12,
        info_input: 'proof-link',
        time_submitted: '2026-04-06T08:00:00Z',
        task: {
          title: '待审核任务',
          points: 88,
        },
        user: {
          EVM: '0xaabbccddeeff0011223344556677889900aabbcc',
        },
      },
    ]

    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/user/stats') return { user_count: 10, admin_count: 1, total_points: 500 }
      if (url === '/api/task/all') return [{ tID: 1 }, { tID: 2 }]
      if (url === '/api/prize/all') return [{ bID: 1 }]
      if (url === '/api/tasklist/pending-verification/count') return { count: pendingItems.length }
      if (url === '/api/tasklist/pending-verification?limit=50') return pendingItems
      if (url === '/api/tasklist/101/verify') {
        pendingItems = []
        return { success: true }
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()

    expect(await screen.findByText('普通用户 Task Progress 审批')).toBeInTheDocument()
    expect(await screen.findByText('待审核任务')).toBeInTheDocument()
    expect(screen.getByText(/仅展示普通用户提交的 Task Progress。/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '通过审核' }))

    await waitFor(() => {
      expect(
        fetchApiJson.mock.calls.filter(([url]) => url === '/api/tasklist/pending-verification/count')
      ).toHaveLength(2)
      expect(
        fetchApiJson.mock.calls.filter(([url]) => url === '/api/tasklist/pending-verification?limit=50')
      ).toHaveLength(2)
    })

    expect(fetchApiJson).toHaveBeenCalledWith(
      '/api/tasklist/101/verify',
      expect.objectContaining({
        method: 'POST',
      })
    )
    expect(await screen.findByText('当前没有待审核提交')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('任务已通过审核')
  })

  it('falls back to the pending list length when the count endpoint fails', async () => {
    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/user/stats') return { user_count: 10, admin_count: 1, total_points: 500 }
      if (url === '/api/task/all') return [{ tID: 1 }, { tID: 2 }]
      if (url === '/api/prize/all') return [{ bID: 1 }]
      if (url === '/api/tasklist/pending-verification/count') {
        throw new Error('count failed')
      }
      if (url === '/api/tasklist/pending-verification?limit=50') {
        return [
          {
            jID: 201,
            tID: 21,
            info_input: 'proof-a',
            task: { title: '任务 A', points: 10 },
            user: { EVM: '0x1111111111111111111111111111111111111111' },
          },
          {
            jID: 202,
            tID: 22,
            info_input: 'proof-b',
            task: { title: '任务 B', points: 20 },
            user: { EVM: '0x2222222222222222222222222222222222222222' },
          },
        ]
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()

    expect(await screen.findByText(/待审核总数 2。/)).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('部分数据加载失败：待审核数量')
  })

  it('S18：已登录用户（无 review_tasks）⇒ 队列面板按登录态放开（不再收敛为无权限）', async () => {
    // ★ 负对照内建：`hasAdminPermission` 恒 false（= 无 review_tasks）。若队列门回退为 admin-only
    //   ⇒ 不发队列读 ⇒ 本例如红（非假门）。
    fetchAdminAccess.mockResolvedValue({ is_admin: false, can_access_admin: true, permissions: [] })
    hasAdminPermission.mockReturnValue(false)
    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/user/stats') return { user_count: 10, admin_count: 1, total_points: 500 }
      if (url === '/api/task/all') return []
      if (url === '/api/prize/all') return []
      if (url === '/api/tasklist/pending-verification/count') return { count: 1 }
      if (url === '/api/tasklist/pending-verification?limit=50') {
        return [{ jID: 301, tID: 31, info_input: 'proof', task: { title: '任务 C', points: 5 }, user: { EVM: '0xabc' } }]
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()

    // 门 = 登录态 ⇒ 登录即取队列（admin-only 门面下此处会 0 次）
    await waitFor(() => {
      expect(
        fetchApiJson.mock.calls.filter(([url]) => url === '/api/tasklist/pending-verification?limit=50')
      ).toHaveLength(1)
    })
    // 原「无审核权限」空态分支已随门面放开删除（本仓禁死代码）⇒ 队列内容直达
    expect(screen.queryByText('当前账号没有审核权限')).toBeNull()
    expect(await screen.findByText('任务 C')).toBeInTheDocument()
  })
})
