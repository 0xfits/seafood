import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}))

import toast from 'react-hot-toast'
import HomePage from '../../pages/HomePage'
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { useAuth } from '../../auth-context'

const renderHomePage = () => render(
  <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HomePage />
  </MemoryRouter>
)

describe('HomePage', () => {
  let consoleWarnSpy

  beforeEach(() => {
    vi.clearAllMocks()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getAuthHeaders.mockReturnValue({})
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    })
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('falls back to legacy task and prize requests when the home endpoint is unavailable', async () => {
    fetchApiJson.mockImplementation(async (url) => {
      if (url === '/api/home?task_limit=6&prize_limit=8') {
        throw new Error('Not found')
      }

      if (url === '/api/task/all?limit=6') {
        return [
          {
            tID: 1,
            title: '任务回退 A',
            note: '任务描述',
            points: 88,
            is_open: true,
            participants_count: 5,
          },
        ]
      }

      if (url === '/api/prize/all?limit=8') {
        return [
          {
            bID: 2,
            name: '奖励回退 A',
            description: '奖励描述',
            points: 120,
            stores_count: 3,
            claims_count: 0,
          },
        ]
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    renderHomePage()

    expect(await screen.findByRole('heading', { name: '任务回退 A' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '奖励回退 A' })).toBeInTheDocument()

    expect(fetchApiJson).toHaveBeenCalledWith(
      '/api/task/all?limit=6',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(fetchApiJson).toHaveBeenCalledWith(
      '/api/prize/all?limit=8',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('restores claimed reward state through legacy authenticated requests', async () => {
    useAuth.mockReturnValue({
      user: {
        uID: 9,
        token: 'home-token',
        access_token: 'home-token',
      },
      isAuthenticated: true,
    })
    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer home-token' })

    fetchApiJson.mockImplementation(async (url, options = {}) => {
      if (url === '/api/home?task_limit=6&prize_limit=8') {
        throw new Error('route not deployed')
      }

      if (url === '/api/task/all?limit=6') {
        return [
          {
            tID: 3,
            title: '任务回退 B',
            note: '任务描述',
            points: 66,
            is_open: true,
            participants_count: 2,
          },
        ]
      }

      if (url === '/api/prize/all?limit=8') {
        return [
          {
            bID: 7,
            name: '奖励回退 B',
            description: '奖励描述',
            points: 180,
            stores_count: 1,
            claims_count: 1,
          },
        ]
      }

      if (url === '/api/prize-item') {
        expect(options).toEqual(expect.objectContaining({
          headers: { Authorization: 'Bearer home-token' },
          signal: expect.any(AbortSignal),
        }))
        return [{ bID: 7 }]
      }

      if (url === '/api/user/asset/9') {
        return { points: 520 }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    renderHomePage()

    expect(await screen.findByRole('heading', { name: '任务回退 B' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '奖励回退 B' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('已兑换')).toBeInTheDocument()
    })

    expect(getAuthHeaders).toHaveBeenCalledWith({
      uID: 9,
      token: 'home-token',
      access_token: 'home-token',
    })
    expect(fetchApiJson).toHaveBeenCalledWith(
      '/api/user/asset/9',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(toast.error).not.toHaveBeenCalled()
  })
})
