/**
 * 路由改名单单测（Kong，2026-10-03）—— `/shard` → `/exchange` 的回归契约
 *
 * 契约（Kevin 定档：只改 URL，不动文案键）：
 *  ① 页面路径 = `/exchange`（App.jsx 内层相对段 + 导航真源 shell/nav.js + Header 菜单）。
 *  ② 导航项真源：`key`/`labelKey` 保持 `'shard'`；`path`/`route` = `'exchange'` ⇒ 标签仍取 `t('shard')`（四语一字不动）。
 *  ③ 四语前缀 `/exchange`、`/en/exchange`、`/hk/exchange`、`/vn/exchange` 均可直达（不经重定向）。
 *  ④ 旧路径 `/shard`（含四语前缀）经一条 `<Navigate>` 重定向到同语言前缀下的 `/exchange`（旧链接不破损）。
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../pages/HomePage', () => ({ default: () => <div>home page content</div> }))
vi.mock('../../pages/RewardPage', () => ({ default: () => <div>reward page content</div> }))
vi.mock('../../pages/TaskPage', () => ({ default: () => <div>task page content</div> }))
vi.mock('../../pages/ProfilePage', () => ({ default: () => <div>profile page content</div> }))
vi.mock('../../pages/DashboardPage', () => ({ default: () => <div>dashboard page content</div> }))
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
import { SHELL_NAV_ITEMS, navPathInLang, isNavItemActive, visibleNavItems } from '../../shell/nav'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
import vn from '../../locales/vn.json'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../..')
const read = (p) => fs.readFileSync(p, 'utf8')

const shardItem = SHELL_NAV_ITEMS.find((i) => i.key === 'shard')

// 读出 MemoryRouter 里的真实 location，用于断言重定向结果
const LocationProbe = () => {
  const location = useLocation()

  return <span data-testid="pathname">{location.pathname}</span>
}

const renderAt = (p) =>
  render(
    <MemoryRouter initialEntries={[p]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  )

const expectPathname = async (expected) => {
  await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe(expected))
}

describe('① 导航真源：path/route = exchange，key/labelKey 保持 shard', () => {
  it('shell/nav.js 的 shard 项只改 path/route，「碎片」文案键一字不动', () => {
    expect(shardItem).toBeTruthy()
    expect(shardItem.key).toBe('shard')
    expect(shardItem.labelKey).toBe('shard') // ★ 文案键不变 ⇒ 标签仍取 t('shard')
    expect(shardItem.path).toBe('exchange')
    expect(shardItem.route).toBe('exchange')
  })

  it('四语标签键取值逐字冻结（t(\'shard\') 未受影响）', () => {
    expect(zh.shard).toBe('碎片市场')
    expect(hk.shard).toBe('碎片市場')
    expect(en.shard).toBe('Shard Market')
    expect(vn.shard).toBe('Chợ mảnh')
  })

  it('四语前缀下导航 href = 同前缀的 /exchange', () => {
    expect(navPathInLang(shardItem, 'zh')).toBe('/exchange')
    expect(navPathInLang(shardItem, 'en')).toBe('/en/exchange')
    expect(navPathInLang(shardItem, 'hk')).toBe('/hk/exchange')
    expect(navPathInLang(shardItem, 'vn')).toBe('/vn/exchange')
  })

  it('激活判定：/exchange 与 /en/exchange 命中；且导航项顺序/可见性未变（key 仍是 shard）', () => {
    expect(isNavItemActive('/exchange', shardItem)).toBe(true)
    expect(isNavItemActive('/hk/exchange/anything', shardItem)).toBe(true)
    expect(isNavItemActive('/reward', shardItem)).toBe(false)
    expect(visibleNavItems(false).map((i) => i.key)).toEqual(['home', 'reward', 'task', 'shard'])
    expect(visibleNavItems(true).map((i) => i.key)).toEqual(['home', 'reward', 'task', 'shard', 'profile'])
  })

  it('App.jsx 源：交易所页挂在 path="exchange"；旧 /shard 由一条 Navigate 重定向承接', () => {
    const app = read(path.join(SRC, 'App.jsx'))
    expect(app).toContain('<Route path="exchange" element={<ShardPage />} />')
    expect(app).toContain('<Route path="shard" element={<LegacyExchangeRedirect />} />')
    // 组件名/文件 ShardPage 不改（本单只改 URL）
    expect(app).toContain("import ShardPage from './pages/ShardPage'")
  })
})

describe('② 四语 /exchange 直达（不触发重定向）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
  })

  it.each([
    ['/exchange', '/exchange'],
    ['/en/exchange', '/en/exchange'],
    ['/hk/exchange', '/hk/exchange'],
    ['/vn/exchange', '/vn/exchange'],
  ])('%s 渲染交易所页且 pathname 不变', async (entry, expected) => {
    renderAt(entry)

    await expectPathname(expected)
    expect(screen.getByText('shard page content')).toBeInTheDocument()
    expect(screen.queryByText('home page content')).toBeNull()
  })
})

describe('③ 旧路径 /shard 重定向（四语前缀 + query/hash）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
  })

  it.each([
    ['/shard', '/exchange'],
    ['/en/shard', '/en/exchange'],
    ['/hk/shard', '/hk/exchange'],
    ['/vn/shard', '/vn/exchange'],
  ])('旧 %s ⇒ %s 并渲染交易所页', async (entry, expected) => {
    renderAt(entry)

    await expectPathname(expected)
    expect(screen.getByText('shard page content')).toBeInTheDocument()
  })

  it('重定向保留 query/hash', async () => {
    renderAt('/en/shard?side=bid#book')

    await expectPathname('/en/exchange')
    expect(screen.getByText('shard page content')).toBeInTheDocument()
  })
})
