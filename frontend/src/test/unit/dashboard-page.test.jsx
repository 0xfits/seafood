import React, { act } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

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
      if (url === '/api/brand/all') return [{ bID: 1 }]
      if (url === '/api/tasklist/pending-verification/count') return { count: pendingItems.length }
      if (url === '/api/tasklist/pending-verification?limit=50') return pendingItems
      if (url === '/api/tasklist/101/verify') {
        pendingItems = []
        return { success: true }
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    await renderDashboard()

    expect(await screen.findByText('待审核任务')).toBeInTheDocument()

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
      if (url === '/api/brand/all') return [{ bID: 1 }]
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
})
