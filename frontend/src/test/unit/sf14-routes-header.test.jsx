/**
 * sf14 · Kevin 2026-10-14 需求单 · 路由族（App.jsx 内层相对段）
 *
 * 覆盖：
 *   ① /profile 落地重定向：index ⇒ /profile/trades/bought（未登录 ⇒ 既有 ProtectedRoute 登录引导）
 *   ② profile/trades/:subTab · profile/favorites · profile/settings 三子路径共用 ProfilePage（ProtectedRoute 包裹）
 *   ③ activities 顶层新增（与 messages 平级，ProtectedRoute —— 签到需登录）
 *
 * 断言过期⇒前推记录：本文件新增；原 app-routes.test.jsx 只钉 / 与 /login，不受影响。
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

vi.mock('../../pages/HomePage', () => ({ default: () => <div>home page content</div> }))
vi.mock('../../pages/TaskPage', () => ({ default: () => <div>task page content</div> }))
vi.mock('../../pages/ProfilePage', () => ({ default: () => <div>profile page content</div> }))
vi.mock('../../pages/ActivitiesPage', () => ({ default: () => <div>activities page content</div> }))
vi.mock('../../pages/ShardPage', () => ({ default: () => <div>shard page content</div> }))
vi.mock('../../pages/AuthPage', () => ({ default: ({ mode }) => <div>{mode} auth page</div> }))
vi.mock('../../components/Header', () => ({ default: () => <div>site header</div> }))
vi.mock('../../components/Footer', () => ({ default: () => <div>site footer</div> }))
vi.mock('../../components/LoginModal', () => ({ default: () => null }))
vi.mock('../../components/layout/AdminLayout', () => ({ default: () => <div>admin layout</div> }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(),
  hasAdminPermission: vi.fn(() => false),
}))
vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

import App from '../../App'
import { useAuth } from '../../auth-context'

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </MemoryRouter>,
)

describe('sf14 · /profile 族与 activities 路由（LangShell 内层相对段）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('①a 未登录访问 /profile ⇒ 重定向到 /profile/trades/bought 后被 ProtectedRoute 引去登录（登录引导，零新造）', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    renderAt('/profile')
    expect(screen.getByText('login auth page')).toBeInTheDocument()
  })

  it('①b 登录访问 /profile ⇒ 落地 = 我的交易（/profile/trades/bought 渲染 ProfilePage）', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7 } })
    renderAt('/profile')
    expect(screen.getByText('profile page content')).toBeInTheDocument()
  })

  it('② profile/trades/:subTab 与 profile/favorites、profile/settings 都渲染 ProfilePage（同组件不同视图）', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7 } })
    for (const entry of ['/profile/trades/published', '/profile/trades/sold', '/profile/trades/bought', '/profile/favorites', '/profile/settings']) {
      const { unmount } = renderAt(entry)
      expect(screen.getByText('profile page content'), `entry=${entry}`).toBeInTheDocument()
      unmount()
    }
  })

  it('③a 登录访问 /activities ⇒ 渲染 activities 独立页', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7 } })
    renderAt('/activities')
    expect(screen.getByText('activities page content')).toBeInTheDocument()
  })

  it('③b 未登录访问 /activities ⇒ 既有 ProtectedRoute 登录引导（签到需登录）', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    renderAt('/activities')
    expect(screen.getByText('login auth page')).toBeInTheDocument()
  })
})
