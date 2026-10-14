/**
 * sf14 · Kevin 2026-10-14 需求单 · Header「订单」入口 + /profile 侧栏视图派生 + 四语新键
 *
 * 覆盖：
 *   ① Header 右上角「订单」按钮（图标 + 文案 → /profile；登录态内外都渲染）+ 移动面板「订单」入口
 *   ② ProfilePage 侧栏钩子与视图派生（/profile 落地 = bought；trades/:subTab 非法值 ⇒ bought；favorites/settings）
 *   ③ ActivitiesPage 页根钩子 + BattCheckinPanel 原样搬入（锚点 id 保留）
 *   ④ 四语新键齐备（header.orders / profileNav.* / activitiesPage.title / item.favorite*）
 *
 * 断言过期⇒前推记录（本单映射，另见报告）：
 *   r9-84 ③b/⑥、r9-batt-meter ③/JobDetail 例、d1-error-machineface ③：`/profile#batt-checkin` ⇒ `/activities#batt-checkin`
 *   ledger-flow ①②④⑦：裸渲染路径 '/profile' ⇒ '/profile/settings'（账本面归位 settings 视图）
 *   i18n-batch-b2：'/en/profile' ⇒ '/en/profile/settings'
 */
import React from 'react'
import { render, cleanup, act, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, hk, en, vn }

const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})
H.tables = TABLES

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t }) }))

// 可变鉴权态（每个用例按需改写）
const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  updateSession: (p) => p,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ can_access_admin: false, preferred_admin_path: '/dashboard' })),
  hasAdminPermission: vi.fn(() => false),
}))

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async () => []),
  fetchCurrentUser: vi.fn(async () => ({ uID: 7, EVM: '0xabc', bio: 'hello' })),
  getAuthHeaders: vi.fn(() => ({})),
  updateMyProfile: vi.fn(),
}))

vi.mock('../../ledger-api', () => ({
  fetchMyLedger: vi.fn(async () => ({ rows: [], nextBeforeTxid: null })),
  LEDGER_PAGE_SIZE: 20,
}))

vi.mock('../../messages-api', () => ({
  fetchTelegramBindStatus: vi.fn(async () => ({ tg_linked: false })),
  isTelegramNotConfigured: vi.fn(() => false),
  startTelegramBind: vi.fn(),
  unbindTelegram: vi.fn(),
}))

vi.mock('../../batt-checkin', () => ({
  fetchBatt: vi.fn(async () => null),
  fetchCheckinStatus: vi.fn(async () => null),
  postCheckin: vi.fn(),
  postMakeup: vi.fn(),
  utcDay: (n) => n,
}))

vi.mock('../../bttc-api', () => ({ postBttcMint: vi.fn(), postBttcBurn: vi.fn() }))

import Header from '../../components/Header'
import ProfilePage from '../../pages/ProfilePage'
import ActivitiesPage from '../../pages/ActivitiesPage'

const renderAt = (ui, entry) => render(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)

beforeEach(() => {
  H.lang = 'zh'
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('sf14 ① · Header「订单」入口（图标 + 文案 → /profile）', () => {
  it('桌面右上角有「订单」按钮：href=/profile、含图标 img、文案 = zh.header.orders（登录态）', () => {
    renderAt(<Header />, '/')
    const btn = document.querySelector('[data-sf-m="header-orders"]')
    expect(btn).not.toBeNull()
    expect(btn.tagName).toBe('A')
    expect(btn.getAttribute('href')).toBe('/profile')
    expect(btn.querySelector('img')).not.toBeNull()
    expect(btn.textContent).toContain(zh.header.orders)
  })

  it('未登录同样渲染「订单」按钮（进 profile 由既有 ProtectedRoute 出登录引导）', () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    renderAt(<Header />, '/')
    const btn = document.querySelector('[data-sf-m="header-orders"]')
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('href')).toBe('/profile')
  })

  it('移动汉堡面板含「订单」入口（header-orders-mobile，href=/profile，点击即收面板）', () => {
    renderAt(<Header />, '/')
    act(() => { fireEvent.click(document.querySelector('[data-sf-m="header-mobile-menu"]')) })
    const link = document.querySelector('[data-sf-m="header-orders-mobile"]')
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/profile')
    expect(link.textContent).toContain(zh.header.orders)
  })

  it('四语前缀下「订单」按钮 href 带同档语言前缀', () => {
    const cases = [['/en', '/en/profile'], ['/hk', '/hk/profile'], ['/vn', '/vn/profile']]
    for (const [entry, expected] of cases) {
      cleanup()
      renderAt(<Header />, entry)
      expect(document.querySelector('[data-sf-m="header-orders"]').getAttribute('href')).toBe(expected)
    }
  })
})

describe('sf14 ② · ProfilePage 侧栏与视图派生', () => {
  it('侧栏根 + 分组钩子齐备（profile-nav / profile-nav-trades / 三子项 / favorites / settings）', async () => {
    const { container } = renderAt(<ProfilePage />, '/profile/settings')
    // 资料加载是异步的（fetchCurrentUser 替身）⇒ 等 settings 内容挂载后再断言
    await waitFor(() => expect(container.querySelector('[data-sf-m="profile-nav"]')).not.toBeNull())
    for (const hook of ['profile-nav-trades', 'profile-nav-published', 'profile-nav-sold', 'profile-nav-bought', 'profile-nav-favorites', 'profile-nav-settings']) {
      expect(container.querySelector(`[data-sf-m="${hook}"]`), hook).not.toBeNull()
    }
  })

  it('/profile 裸渲染（落地口径）⇒ 我的交易-我买到的（trades-bought-list + -empty 钩子）', async () => {
    const { container } = renderAt(<ProfilePage />, '/profile')
    await waitFor(() => expect(container.querySelector('[data-sf-m="trades-bought-list"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="trades-bought-empty"]')).not.toBeNull()
  })

  it('trades/:subTab 非法值 ⇒ 按 bought 处理（不渲染非法钩子）', async () => {
    const { container } = renderAt(<ProfilePage />, '/profile/trades/nonsense')
    await waitFor(() => expect(container.querySelector('[data-sf-m="trades-bought-list"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="trades-nonsense-list"]')).toBeNull()
  })

  it('published/sold 子页各挂对应 list/-empty 钩子；favorites 挂 fav-list/-empty；settings 挂 settings-view', async () => {
    const { container: c1 } = renderAt(<ProfilePage />, '/profile/trades/published')
    await waitFor(() => expect(c1.querySelector('[data-sf-m="trades-published-list"]')).not.toBeNull())
    expect(c1.querySelector('[data-sf-m="trades-published-empty"]')).not.toBeNull()
    cleanup()

    const { container: c2 } = renderAt(<ProfilePage />, '/profile/trades/sold')
    await waitFor(() => expect(c2.querySelector('[data-sf-m="trades-sold-list"]')).not.toBeNull())
    expect(c2.querySelector('[data-sf-m="trades-sold-empty"]')).not.toBeNull()
    cleanup()

    const { container: c3 } = renderAt(<ProfilePage />, '/profile/favorites')
    await waitFor(() => expect(c3.querySelector('[data-sf-m="fav-list"]')).not.toBeNull())
    expect(c3.querySelector('[data-sf-m="fav-list-empty"]')).not.toBeNull()
    cleanup()

    const { container: c4 } = renderAt(<ProfilePage />, '/profile/settings')
    await waitFor(() => expect(c4.querySelector('[data-sf-m="settings-view"]')).not.toBeNull())
    // 既有内容归位抽检：账本面板与 Telegram 卡都在 settings 视图内
    expect(c4.querySelector('[data-sf-m="jobs-flow"]')).not.toBeNull()
    expect(c4.querySelector('[data-sf-m="tg-bind-card"]')).not.toBeNull()
  })
})

describe('sf14 ③ · ActivitiesPage（签到与活动独立页）', () => {
  it('页根钩子 activities-page + 标题（activitiesPage.title）+ 签到锚点卡在场（BattCheckinPanel 原样搬入）', async () => {
    const { container } = renderAt(<ActivitiesPage />, '/activities')
    expect(container.querySelector('[data-sf-m="activities-page"]')).not.toBeNull()
    expect(container.querySelector('h1')).not.toBeNull()
    expect(container.querySelector('h1').textContent).toContain(zh.activitiesPage.title)
    // 锚点机制保留：BattCheckinPanel 的 id=batt-checkin 卡在本页渲染
    expect(document.getElementById('batt-checkin')).not.toBeNull()
  })
})

describe('sf14 ④ · 四语新键齐备（键集逐文件相同）', () => {
  const NEW_KEYS = [
    'header.orders',
    'profileNav.title',
    'profileNav.published',
    'profileNav.sold',
    'profileNav.bought',
    'profileNav.favorites',
    'profileNav.settings',
    'profileNav.emptyPublished',
    'profileNav.emptySold',
    'profileNav.emptyBought',
    'profileNav.emptyFavorites',
    'activitiesPage.title',
    'item.favorite',
    'item.favorited',
    'item.favoriteOk',
    'item.favoriteFail',
    'item.favoriteLogin',
  ]

  it('17 个新键 × 4 语全部存在且非空字符串', () => {
    const lookup = (table, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), table)
    for (const key of NEW_KEYS) {
      for (const lang of ['zh', 'en', 'hk', 'vn']) {
        const value = lookup(TABLES[lang], key)
        expect(typeof value, `${lang}.${key}`).toBe('string')
        expect(value.trim().length, `${lang}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('冻结键表抽检（zh/en/hk/vn 逐字）', () => {
    expect(zh.header.orders).toBe('订单')
    expect(en.header.orders).toBe('Orders')
    expect(hk.header.orders).toBe('訂單')
    expect(vn.header.orders).toBe('Đơn hàng')
    expect(zh.profileNav.title).toBe('我的交易')
    expect(en.profileNav.bought).toBe('Purchases')
    expect(hk.profileNav.settings).toBe('賬戶設置')
    expect(vn.activitiesPage.title).toBe('Điểm danh & Hoạt động')
  })
})
