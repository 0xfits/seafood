import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

vi.mock('../../pages/HomePage', () => ({
  default: () => <div>home page content</div>,
}))

vi.mock('../../pages/RewardPage', () => ({
  default: () => <div>reward page content</div>,
}))

vi.mock('../../pages/TaskPage', () => ({
  default: () => <div>task page content</div>,
}))

vi.mock('../../pages/ProfilePage', () => ({
  default: () => <div>profile page content</div>,
}))

vi.mock('../../pages/DashboardPage', () => ({
  default: () => <div>dashboard page content</div>,
}))

vi.mock('../../pages/ShardPage', () => ({
  default: () => <div>shard page content</div>,
}))

vi.mock('../../pages/AuthPage', () => ({
  default: ({ mode }) => <div>{mode} auth page</div>,
}))

vi.mock('../../components/Header', () => ({
  default: () => <div>site header</div>,
}))

vi.mock('../../components/Footer', () => ({
  default: () => <div>site footer</div>,
}))

vi.mock('../../components/LoginModal', () => ({
  default: () => null,
}))

vi.mock('../../components/layout/AdminLayout', () => ({
  default: () => <div>admin layout</div>,
}))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(),
  hasAdminPermission: vi.fn(() => false),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

import App from '../../App'
import { useAuth } from '../../auth-context'

// 读出 MemoryRouter 里的真实 location，用于断言重定向结果
const LocationProbe = () => {
  const location = useLocation()

  return (
    <>
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="query">{`${location.search}${location.hash}`}</span>
    </>
  )
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  )

const expectPathname = async (expected) => {
  await waitFor(() => {
    expect(screen.getByTestId('pathname').textContent).toBe(expected)
  })
}

// 验收口径：页面主体必须有内容（改正前 /hk/vn 的 main 是空的）
const expectMainNotBlank = async () => {
  await waitFor(() => {
    expect(screen.getByRole('main').textContent.trim().length).toBeGreaterThan(0)
  })
}

describe('语言前缀规范化重定向（防御层）', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    })
  })

  it.each([
    ['/hk/vn', '/hk', 'home page content'],
    ['/en/en', '/en', 'home page content'],
    ['/zh', '/', 'home page content'],
    ['/vn/reward/', '/vn/reward', 'reward page content'],
  ])('把 %s 自愈为 %s 并渲染主体内容', async (from, to, content) => {
    renderAt(from)

    await expectPathname(to)
    expect(screen.getByText(content)).toBeInTheDocument()
    await expectMainNotBlank()
  })

  it('把 /zh/reward 自愈为 /reward，主体不再是空白', async () => {
    // 注：/reward（无语言前缀）由既有路由决定渲染哪个页面（zh 子路径目前命中首页），
    // 属既有缺陷、不在本次修复范围；本用例只断言重定向结果与「主体非空」。
    renderAt('/zh/reward')

    await expectPathname('/reward')
    await expectMainNotBlank()
  })

  it.each([
    ['/', '/', 'home page content'],
    ['/vn', '/vn', 'home page content'],
    ['/hk', '/hk', 'home page content'],
    ['/vn/reward', '/vn/reward', 'reward page content'],
  ])('规范路径 %s 不触发重定向且渲染内容', async (path, expected, content) => {
    renderAt(path)

    await expectPathname(expected)
    expect(screen.getByText(content)).toBeInTheDocument()
  })

  it('规范路径 /reward 保持原样（不额外加重定向）', async () => {
    renderAt('/reward')

    await expectPathname('/reward')
    await expectMainNotBlank()
  })

  it('无语言前缀的 /login 不被加前缀', async () => {
    renderAt('/login')

    await expectPathname('/login')
    expect(screen.getByText('login auth page')).toBeInTheDocument()
  })

  it('无语言前缀的 /register 不被加前缀', async () => {
    renderAt('/register')

    await expectPathname('/register')
    expect(screen.getByText('register auth page')).toBeInTheDocument()
  })

  it('无语言前缀的 /dashboard 不被加前缀（未登录跳登录页，路径里不出现语言前缀）', async () => {
    renderAt('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/login')
    })
    expect(screen.getByTestId('pathname').textContent).not.toMatch(/^\/(en|hk|vn)\b/)
  })

  it('重定向时保留 query 与 hash', async () => {
    renderAt('/hk/vn/reward?tab=open#top')

    await expectPathname('/hk/reward')
    expect(screen.getByTestId('query').textContent).toBe('?tab=open#top')
    expect(screen.getByText('reward page content')).toBeInTheDocument()
  })
})
