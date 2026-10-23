/**
 * sf14 · Kevin 2026-10-14 需求单 · 路由族（App.jsx 内层相对段）
 *
 * 覆盖：
 *   ① /profile 落地重定向：index ⇒ /profile/trades/bought（未登录 ⇒ 既有 ProtectedRoute 登录引导）
 *   ② profile/trades/:subTab · profile/favorites · profile/settings 三子路径共用 ProfilePage（ProtectedRoute 包裹）
 *   ③ `/wage` 为签到/电量落点（签到独立页 `/activities` 已于 2026-10-20 硬删 ⇒ 旧段命中 catch-all 提示页）
 *
 * 断言过期⇒前推记录：本文件新增；原 app-routes.test.jsx 只钉 / 与 /login，不受影响。
 *   2026-10-20（签到并入 /wage）：③a/③b 原为「/activities 渲染独立页 / 未登录落登录引导」⇒
 *     前推为「/wage 渲染领工资页」＋「/activities 不再命中任何内层段（落 catch-all，登录与否都一样）」。
 *   2026-10-21（`:slug` 项目页上线）：单段未知路径（含退役段 `/activities`）现由内层末位
 *     `:slug` 承接 ⇒ 先经项目读口 `GET /api/project/:ref` 判存在，404 后落同一张 `<NotFoundPage />`。
 *     故 ③b/③c 从「同步 catch-all」前推为「异步 404 ⇒ 同款提示页」，并 mock 项目读口
 *     （本文件不触网、不给真 fetchApiJson 兜底路径）。
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../../pages/wage/WagePage', () => ({ default: () => <div>wage page content</div> }))
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

// 项目页读口替身（2026-10-21）：退役段 /activities 现由 `:slug` 承接 ⇒ 读口 404 后才落提示页。
// 本文件只核「落哪张页」，故让读口恒 404；币种表给空数组（次币符号不影响断言）。
vi.mock('../../pages/project/project-api', () => ({
  fetchProjectDetail: vi.fn(() => Promise.reject(Object.assign(new Error('project_not_found'), { status: 404 }))),
  fetchProjectCurrencies: vi.fn(() => Promise.resolve([])),
  rechargeProjectVault: vi.fn(),
}))

import App from '../../App'
import { useAuth } from '../../auth-context'

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </MemoryRouter>,
)

describe('sf14 · /profile 族与 /wage 落点（LangShell 内层相对段）', () => {
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

  it('③a 登录访问 /wage ⇒ 渲染领工资页（电量 + 签到区已并入该页顶部）', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7 } })
    renderAt('/wage')
    expect(screen.getByText('wage page content')).toBeInTheDocument()
  })

  it('③b `/activities` 已无路由段 ⇒ 登录态也落提示页（读口 404 ⇒ 同款 not-found，不再是签到页）', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7 } })
    const { container } = renderAt('/activities')
    expect(screen.queryByText('wage page content')).toBeNull()
    expect(container.querySelector('[data-sf-m="activities-page"]')).toBeNull()
    await waitFor(() => expect(container.querySelector('[data-sf-m="not-found-page"]')).not.toBeNull())
  })

  it('③c 未登录访问 /activities ⇒ 同为提示页（不再经 ProtectedRoute 出登录引导）', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    const { container } = renderAt('/activities')
    expect(screen.queryByText('login auth page')).toBeNull()
    await waitFor(() => expect(container.querySelector('[data-sf-m="not-found-page"]')).not.toBeNull())
  })
})
