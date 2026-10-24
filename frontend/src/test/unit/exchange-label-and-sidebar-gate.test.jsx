/**
 * 「市场」→「海底交易所」文案定稿 + 侧栏【交易所管理】闸修正（Kevin 2026-10-24）
 *
 * 契约：
 *  A. 侧栏闸 = `manage_settings ∨ review_tasks`（数组 ⇒ 任一命中即可见；判据仍是既有
 *     `admin-utils.hasAdminPermission`，零新增判定函数）。只有 review_tasks 的管理员
 *     必须能看到【交易所管理】入口（币种审核 tab 住在里面）；只有 manage_settings 的也要能看到。
 *  B. `shard` 键的**值**四语改写（键名不动、零键漂移）：zh/hk「海底交易所」/ en「Exchange」/ vn「Sàn」。
 *     顶栏（`Header.jsx` 取 `t('shard')`）与手机底栏（`shell/nav.js` labelKey `'shard'`）**同键同值**
 *     ⇒ 渲染出的文案必须逐字相等。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, hk, en, vn }

// 与仓内既有用例同构的嵌套解析 mock：t('a.b') ⇒ 逐段下钻当前语表
const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})
H.tables = TABLES

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: H.t, i18n: { changeLanguage: vi.fn(), language: 'zh', resolvedLanguage: 'zh' } }),
}))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
  updateSession: (p) => p,
  logout: vi.fn(),
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH, AuthProvider: ({ children }) => children }))

// 权限**真源**：只有 fetchAdminAccess / getStoredUser 打桩，hasAdminPermission 走真实实现
const ACCESS = vi.hoisted(() => ({
  current: { is_admin: false, can_access_admin: true, permissions: [], preferred_admin_path: '/dashboard' },
}))
vi.mock('../../admin-utils', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchAdminAccess: vi.fn(async () => ACCESS.current),
    getStoredUser: () => ({ uid: 1 }),
  }
})

vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchApiJson: vi.fn(async () => []),
    fetchCurrentUser: vi.fn(async () => ({ uID: 7, EVM: '0xabc' })),
    getAuthHeaders: vi.fn(() => ({})),
    clearAuthSession: vi.fn(),
  }
})
vi.mock('../../balances-api', () => ({
  fetchUserBalances: vi.fn(async () => []),
  formatBalanceAmount: (v) => String(v),
  toBalanceRows: () => [],
}))

import AdminLayout from '../../components/layout/AdminLayout'
import Header from '../../components/Header'
import BottomTabBar from '../../shell/BottomTabBar'
import { SHELL_NAV_ITEMS } from '../../shell/nav'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')

const setAccess = (permissions, extra = {}) => {
  ACCESS.current = { is_admin: false, can_access_admin: true, permissions, preferred_admin_path: '/dashboard', ...extra }
}

const renderAdminLayout = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminLayout />
    </MemoryRouter>
  )

const sidebarExchangeLink = () => document.querySelector('a[href="/dashboard/exchange"]')

const renderShellAt = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header />
      <BottomTabBar />
    </MemoryRouter>
  )

beforeEach(() => {
  H.lang = 'zh'
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('A 侧栏【交易所管理】闸 = manage_settings ∨ review_tasks', () => {
  it('源码：该项 requiredPermission 为两值数组（沿用仓内数组先例，未新造判定函数）', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).toContain("requiredPermission: ['manage_settings', 'review_tasks'],")
    // 判据仍是既有 hasAdminPermission
    expect(layout).toContain('hasAdminPermission(access, item.requiredPermission)')
  })

  it('仅有 review_tasks 的管理员：侧栏能看到【交易所管理】', async () => {
    setAccess(['review_tasks'])
    renderAdminLayout()

    await waitFor(() => expect(sidebarExchangeLink()).not.toBeNull())
    expect(sidebarExchangeLink().textContent.trim()).toBe(zh.adminNav.feeRate)
    // 该档下 manage_settings-only 的项仍不可见（闸没有被放宽成「谁都看」）
    // ★ 2026-10-24 批次 A：负控由已下线的 `/dashboard/site-text` 改为 `/dashboard/settings`
    //   （同为 manage_settings-only 项）—— 判据等价、不降强度。
    expect(document.querySelector('a[href="/dashboard/settings"]')).toBeNull()
  })

  it('仅有 manage_settings 的管理员：侧栏同样能看到【交易所管理】', async () => {
    setAccess(['manage_settings'])
    renderAdminLayout()

    await waitFor(() => expect(sidebarExchangeLink()).not.toBeNull())
    expect(sidebarExchangeLink().textContent.trim()).toBe(zh.adminNav.feeRate)
  })

  it('两权限俱无（且非 is_admin）：入口不可见（判负）', async () => {
    setAccess(['manage_points'])
    renderAdminLayout()

    await waitFor(() => expect(document.querySelector('a[href="/dashboard/points"]')).not.toBeNull())
    expect(sidebarExchangeLink()).toBeNull()
  })
})

describe('B「海底交易所」四语取值 + 顶菜单/底栏同键同值', () => {
  it('shard 键四语值逐字（键名与键集零漂移）', () => {
    expect(zh.shard).toBe('海底交易所')
    expect(hk.shard).toBe('海底交易所')
    expect(en.shard).toBe('Exchange')
    expect(vn.shard).toBe('Sàn')
    // 键集四语一致、总键数不变（135）
    for (const lang of ['zh', 'en', 'hk', 'vn']) expect(Object.keys(TABLES[lang])).toHaveLength(136)
  })

  it('导航真源：底栏第 2 格 labelKey 仍为 shard（键名不动）', () => {
    const item = SHELL_NAV_ITEMS.find((i) => i.key === 'shard')
    expect(item.labelKey).toBe('shard')
    expect(item.path).toBe('exchange')
  })

  it('顶菜单取 t(\'shard\')（Header.jsx 真源）', () => {
    expect(read('components/Header.jsx')).toContain("{ path: 'exchange', label: t('shard'), icon: NAV_ICON_SRC.market },")
  })

  it.each([
    ['zh', '/exchange'],
    ['en', '/en/exchange'],
    ['hk', '/hk/exchange'],
    ['vn', '/vn/exchange'],
  ])('%s：顶菜单文案 = 底栏文案 = locale 值，且逐字相等', async (lang, entry) => {
    H.lang = lang
    renderShellAt(entry)

    const headerLink = await waitFor(() => {
      const a = Array.from(document.querySelectorAll('#header nav a')).find((el) =>
        (el.getAttribute('href') || '').endsWith('/exchange')
      )
      expect(a).toBeTruthy()
      return a
    })
    const tab = document.querySelector('[data-sf-region="tabbar"] a[data-sf-nav="shard"]')
    expect(tab).not.toBeNull()

    expect(headerLink.textContent.trim()).toBe(TABLES[lang].shard)
    expect(tab.textContent.trim()).toBe(TABLES[lang].shard)
    expect(headerLink.textContent.trim()).toBe(tab.textContent.trim())
  })
})
