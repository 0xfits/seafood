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
    ['/vn//reward', '/vn/reward', 'reward page content'],
    ['//hk', '/hk', 'home page content'],
  ])('把 %s 自愈为 %s 并渲染主体内容', async (from, to, content) => {
    renderAt(from)

    await expectPathname(to)
    expect(screen.getByText(content)).toBeInTheDocument()
    await expectMainNotBlank()
  })

  it('把 /zh/reward 自愈为 /reward 并渲染奖励页', async () => {
    renderAt('/zh/reward')

    await expectPathname('/reward')
    expect(screen.getByText('reward page content')).toBeInTheDocument()
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

  it('规范路径 /reward 保持原样（不额外加重定向）且渲染奖励页', async () => {
    renderAt('/reward')

    await expectPathname('/reward')
    expect(screen.getByText('reward page content')).toBeInTheDocument()
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

// P0 正向判据：中文无前缀子路径必须渲染各自页面（含改名单后的 /exchange）。
// 判负自证：把外层路由改回 `/:lang?/*`（可选语言段）时，除 '/' 外本组用例全部转红（/reward、/task、/exchange ⇒ home page content）。
describe('中文无前缀子路径渲染（P0）', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    })
  })

  it.each([
    ['/', '/', 'home page content'],
    ['/reward', '/reward', 'reward page content'],
    ['/task', '/task', 'task page content'],
    ['/exchange', '/exchange', 'shard page content'],
    ['/en/reward', '/en/reward', 'reward page content'],
    ['/en/task', '/en/task', 'task page content'],
    ['/en/exchange', '/en/exchange', 'shard page content'],
    ['/hk/exchange', '/hk/exchange', 'shard page content'],
    ['/vn/exchange', '/vn/exchange', 'shard page content'],
    ['/vn/reward', '/vn/reward', 'reward page content'],
  ])('%s 渲染 %s 对应的页面内容', async (path, expected, content) => {
    renderAt(path)

    await expectPathname(expected)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByText(content)).toBeInTheDocument()

    if (content !== 'home page content') {
      // 页面真的换掉了：不再是首页欢迎语
      expect(screen.queryByText('home page content')).toBeNull()
    }
  })
})

// 旧页面路径 /shard 的兼容重定向（本单改名单：/shard → /exchange）。
// 契约：四语前缀下旧路径均重定向到同语言前缀下的 exchange 页，且主体有内容（旧链接不破损）。
describe('旧页面路径 /shard → /exchange 兼容重定向（四语前缀）', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    })
  })

  it.each([
    ['/shard', '/exchange', 'shard page content'],
    ['/en/shard', '/en/exchange', 'shard page content'],
    ['/hk/shard', '/hk/exchange', 'shard page content'],
    ['/vn/shard', '/vn/exchange', 'shard page content'],
  ])('把旧路径 %s 重定向为 %s 并渲染交易所页', async (from, to, content) => {
    renderAt(from)

    await expectPathname(to)
    expect(screen.getByText(content)).toBeInTheDocument()
    expect(screen.queryByText('home page content')).toBeNull()
    await expectMainNotBlank()
  })

  it('重定向时保留 query 与 hash', async () => {
    renderAt('/hk/shard?side=bid#book')

    await expectPathname('/hk/exchange')
    expect(screen.getByTestId('query').textContent).toBe('?side=bid#book')
    expect(screen.getByText('shard page content')).toBeInTheDocument()
  })

  it('zh 显式前缀 /zh/shard 经两步自愈最终落到无前缀 /exchange', async () => {
    renderAt('/zh/shard')

    await expectPathname('/exchange')
    expect(screen.getByText('shard page content')).toBeInTheDocument()
  })
})
