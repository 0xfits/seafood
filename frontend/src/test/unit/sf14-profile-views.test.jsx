/**
 * sf14 · Kevin 2026-10-14 需求单 · Header「订单」入口 + /profile 侧栏视图派生 + 四语新键
 *
 * 覆盖：
 *   ① Header 右上角「订单」按钮（图标 + 文案 → /profile；登录态内外都渲染）+ 移动面板「订单」入口
 *   ② ProfilePage 侧栏钩子与视图派生（/profile 落地 = bought；trades/:subTab 非法值 ⇒ bought；favorites/settings）
 *   ③ `/wage` 页顶部渲染电量卡（锚点卡 + 电量点阵在场；**签到 UI 已下线**，项目列表在其下方）
 *   ④ 四语新键齐备（header.orders / profileNav.* / activitiesPage.title / item.favorite*）
 *
 * 断言过期⇒前推记录（本单映射，另见报告）：
 *   2026-10-20（签到并入 /wage、/activities 页删除）：③ 由「ActivitiesPage 页根钩子 + 标题」
 *     前推为「WagePage 顶部签到卡 + 列表顺序」；原页面文件与 `activities.css` 已硬删。
 *   `activitiesPage.title` 键**保留不删**（键数连锁成本），故 ④ 的两条四语断言一字不动。
 *   r9-84 ③b/⑥、r9-batt-meter ③/JobDetail 例、d1-error-machineface ③：`/activities#batt-checkin` ⇒ `/wage#batt-checkin`
 *   ledger-flow ①②④⑦：裸渲染路径 '/profile' ⇒ '/profile/settings'（账本面归位 settings 视图）
 *   i18n-batch-b2：'/en/profile' ⇒ '/en/profile/settings'
 *   D7 收尾（阶段二接手单）：
 *     · HomePage 断言 `not.toContain('MyOrdersPanel')` ⇒ 前推为「禁 import + 禁 JSX 渲染点」两断言
 *       （组件名允许存留于 D7 迁移注释 = 文档语义，非死引用）。
 *     · 补 `fs`/`path` 模块导入（HomePage 源码断言用例用到但原文件未导入 ⇒ ReferenceError）。
 *     · favorites 用例替身改有状态（DELETE 后重载 GET 返回 [] ⇒ 「行消失」才可测）。
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, cleanup, act, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// D7 收尾：需求④ 两个用例直接驱动 `fetchApiJson` 替身（vi.mock 工厂里的同一个 vi.fn）⇒ 必须具名导入。
import { fetchApiJson, getAuthHeaders } from '../../auth'
// 2026-10-20 需求①②：BTTC 资产块迁入 /profile/assets ⇒ 本文件需直接驱动 `fetchBatt` 替身。
import { fetchBatt } from '../../batt-checkin'

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
  confirmTelegramBind: vi.fn(),
}))

vi.mock('../../batt-checkin', () => ({
  // 2026-10-20：签到卡并入 /wage ⇒ 本文件的替身改为「有账户」形状（组件仅消费 fetchBatt）。
  // 2026-10-20 需求③：签到 UI 已下线 ⇒ fetchCheckinStatus / postCheckin / postMakeup 无消费点，保留替身仅为工厂形状稳定。
  fetchBatt: vi.fn(async () => ({ batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true, bttc: null })),
  fetchCheckinStatus: vi.fn(async () => ({ streakDay: 3, streakCapDays: 7, checkedInToday: false, canMakeup: false, makeupCostUsd: '1' })),
  postCheckin: vi.fn(),
  postMakeup: vi.fn(),
  utcDay: (n) => n,
}))

// /wage 列表取数替身（本文件只验渲染点与遮挡顺序，不验取数逻辑 ⇒ 单行夹具即可）。
vi.mock('../../pages/wage/wage-api', () => ({
  fetchWageProjects: vi.fn(async () => ([
    { project_id: 101, title: '海鲜打包', description: '每天打包 20 单。', headcount: 3, hired_count: 2, wage_batt_per_claim: 30, wage_cid: 1, wage_currency_amount: 0, wage_interval_hours: 4, status: 'recruiting', my_role: 'none' },
  ])),
  fetchWageCurrencies: vi.fn(async () => ([{ cid: 1, symbol: '$' }])),
  applyToWageProject: vi.fn(),
  claimWage: vi.fn(),
}))

vi.mock('../../bttc-api', () => ({ postBttcMint: vi.fn(), postBttcBurn: vi.fn() }))

import Header from '../../components/Header'
import ProfilePage from '../../pages/ProfilePage'
import WagePage from '../../pages/wage/WagePage'

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
    for (const hook of ['profile-nav-trades', 'profile-nav-published', 'profile-nav-sold', 'profile-nav-bought', 'profile-nav-favorites', 'profile-nav-invite', 'profile-nav-assets', 'profile-nav-settings']) {
      expect(container.querySelector(`[data-sf-m="${hook}"]`), hook).not.toBeNull()
    }
  })

  it('侧栏 DOM 顺序 = 我的资产 → 我的交易(三子项) → 我的收藏 → 账户设置', async () => {
    const { container } = renderAt(<ProfilePage />, '/profile/settings')
    await waitFor(() => expect(container.querySelector('[data-sf-m="profile-nav"]')).not.toBeNull())
    const nav = container.querySelector('[data-sf-m="profile-nav"]')
    // 直接按文档顺序取钩子（含分组容器），断言与需求口径逐项相等
    const order = [...nav.querySelectorAll('[data-sf-m]')]
      .map((el) => el.getAttribute('data-sf-m'))
      .filter((h) => h !== 'profile-nav')
    expect(order).toEqual([
      'profile-nav-assets',
      'profile-nav-trades',
      'profile-nav-published',
      'profile-nav-sold',
      'profile-nav-bought',
      'profile-nav-favorites',
      'profile-nav-invite',
      'profile-nav-settings',
    ])
  })

  it('/profile/assets ⇒ 我的资产：侧栏 profile-nav-assets 为当前项 + BTTC 资产块（余额 / 铸造 / 分解）在场', async () => {
    fetchBatt.mockResolvedValue({
      batt: 70, capBatt: 100, canAccept: true,
      bttc: { balance: '12', status: 'listed', canMint: true, canBurn: false, usdBalance: '5', policy: {} },
    })
    const { container } = renderAt(<ProfilePage />, '/profile/assets')
    await waitFor(() => expect(container.querySelector('[data-sf-m="profile-assets-view"]')).not.toBeNull())

    // ① 侧栏当前项（aria-current=page）+ 文案 = 真 zh 词典
    const nav = container.querySelector('[data-sf-m="profile-nav-assets"]')
    expect(nav).not.toBeNull()
    expect(nav.getAttribute('href')).toBe('/profile/assets')
    expect(nav.getAttribute('aria-current')).toBe('page')
    expect(nav.textContent).toBe(zh.profileNav.assets)

    // ② 资产块：余额 + 【铸造】/【分解】两按钮（文案键沿用 bttcPanel.*）
    const asset = container.querySelector('[data-sf-m="bttc-asset"]')
    expect(asset).not.toBeNull()
    expect(asset.textContent).toContain(zh.bttcPanel.symbol)
    // 读口值异步落盘 ⇒ 等余额真值（不是初始占位 '—'）
    await waitFor(() => expect(asset.textContent).toContain('12'))
    const labels = [...asset.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(labels).toContain(zh.bttcPanel.mintButton)
    expect(labels).toContain(zh.bttcPanel.burnButton)
    // ③ 签到场不再自留资产块（半套 = 0）：/wage 侧断言见 ③ 组
  })

  it('/profile/assets ⇒ 「我的积分」卡在货币卡区**上方**，值 = 同一读口 `/api/user/balances` 的 `$`（cid 1）', async () => {
    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer t' })
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      if (u === '/api/user/balances') {
        return [
          { cid: 1, symbol: '$', name: '平台积分', balance: '4361' },
          { cid: 4, symbol: '₿', name: 'BTTC', balance: '1' },
        ]
      }
      return []
    })

    const { container } = renderAt(<ProfilePage />, '/profile/assets')
    const points = await waitFor(() => {
      const el = container.querySelector('[data-sf-m="assets-my-points"]')
      expect(el).not.toBeNull()
      return el
    })

    // ① 内容与首页旧卡一致：label（zh 词典真值）/ 千分位金额逐字相等 / 🪙
    expect(points.textContent).toContain(zh.item.myPoints)
    expect(points.querySelector('[data-sf-m="assets-my-points-amount"]').textContent).toBe('4,361')
    expect(points.textContent).toContain('🪙')

    // ② 位置：DOM 顺序在货币卡区**之上**（且货币卡区未吞并 / 未消失）
    const cards = container.querySelector('[data-sf-m="asset-cards"]')
    expect(cards).not.toBeNull()
    expect(points.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // ③ 零新请求：余额读口只打一次（同一源，不另开口子）
    const balanceCalls = fetchApiJson.mock.calls.filter(([url]) => String(url) === '/api/user/balances')
    expect(balanceCalls).toHaveLength(1)

    // 还原替身（本文件其余用例依赖「返回 []」的默认口径）
    fetchApiJson.mockImplementation(async () => [])
    getAuthHeaders.mockReturnValue({})
  })

  it('/profile 裸渲染（落地口径）⇒ 我的交易-我买到的：MyOrdersPanel 原样挂载（D7 渲染点迁移）+ 冻结钩子', async () => {
    const { container } = renderAt(<ProfilePage />, '/profile')
    await waitFor(() => expect(container.querySelector('[data-sf-m="trades-bought-list"]')).not.toBeNull())
    // D7：item-orders-section 钩子随渲染点迁到 profile 侧（组件原样复用）
    expect(container.querySelector('[data-sf-m="item-orders-section"]')).not.toBeNull()
    // 空态（替身回 [] ⇒ MyOrdersPanel 内部空态，钩子经 props 换名）
    await waitFor(() => expect(container.querySelector('[data-sf-m="trades-bought-empty"]')).not.toBeNull())
  })

  it('D7：HomePage 源面不再 import / 渲染 MyOrdersPanel（渲染点已迁出，首页零死钩子）', () => {
    const home = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/HomePage.jsx'), 'utf8')
    // 断言前推：组件名允许存留于 D7 迁移注释（文档语义）；真正禁止的是 import 与 JSX 渲染点。
    expect(home).not.toContain("from './item/MyOrdersPanel'")
    expect(home).not.toContain('<MyOrdersPanel')
    expect(home).not.toContain('home-my-orders')
  })

  it('D7：「我卖出的」子页含 发货+退款 动作面（同款输入+按钮形态，trades-sold-actions）', async () => {
    const { container } = renderAt(<ProfilePage />, '/profile/trades/sold')
    await waitFor(() => expect(container.querySelector('[data-sf-m="trades-sold-list"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="trades-sold-actions"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-m="trades-sold-input-order"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-m="trades-sold-ship-btn"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-m="trades-sold-refund-btn"]')).not.toBeNull()
  })

  it('需求④：published 子页渲染 listing/mine 行（标题/价格/状态查表，不渲染原始枚举）', async () => {
    fetchApiJson.mockImplementation(async (url) => {
      if (String(url).includes('/api/listing/mine')) {
        return [{ listing_id: 5, title: '旧相机', price: '88', status: 'listed', stock: 2, cid: 1, media_urls: [], time_created: 1750000000 }]
      }
      return []
    })
    const { container } = renderAt(<ProfilePage />, '/profile/trades/published')
    await waitFor(() => expect(container.querySelector('[data-sf-m="trades-published-item"]')).not.toBeNull())
    const row = container.querySelector('[data-sf-m="trades-published-item"]')
    expect(row.textContent).toContain('旧相机')
    expect(row.textContent).toContain('$88')
    expect(row.textContent).toContain(zh.item.statusLabel.listed)
    expect(row.textContent).not.toContain('listed')
  })

  it('需求④：favorites 子页渲染收藏行 + 取消收藏行消失（幂等 DELETE 后重载）', async () => {
    // 有状态替身：DELETE 落账后，重载 GET /api/favorites 返回 [] —— 否则「行消失」永远不成立。
    let deleted = false
    fetchApiJson.mockImplementation(async (url, options) => {
      const u = String(url)
      if (u === '/api/favorites' && (!options || !options.method)) {
        return deleted ? [] : [{ listing_id: 9, title: '收藏的物品', price: '12', status: 'listed', time_created: 1750000000 }]
      }
      if (u === '/api/favorites/9' && options?.method === 'DELETE') {
        deleted = true
        return { ok: true }
      }
      return []
    })
    const { container } = renderAt(<ProfilePage />, '/profile/favorites')
    await waitFor(() => expect(container.querySelector('[data-sf-m="fav-item"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="fav-remove"]')).not.toBeNull()
    fireEvent.click(container.querySelector('[data-sf-m="fav-remove"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="fav-list-empty"]')).not.toBeNull())
    // 删除确实走了幂等 DELETE 口
    const del = fetchApiJson.mock.calls.find((c) => String(c[0]) === '/api/favorites/9')
    expect(del).toBeTruthy()
    expect(del[1].method).toBe('DELETE')
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

describe('sf14 ③ · WagePage 顶部电量卡（签到 UI 已下线，电量点阵仍在）', () => {
  it('电量卡锚点 id=batt-checkin + 电量点阵在场；签到按钮 / 连续签到天数 / 补签文案一律 0 命中；项目列表位于其下方', async () => {
    const { container } = renderAt(<WagePage />, '/wage')

    // ① 电量卡在场（锚点 id 与 BattMeter 钩子都保留 ⇒ `/wage#batt-checkin` 深链仍直达）
    await waitFor(() => expect(document.getElementById('batt-checkin')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="wage-checkin"]')).not.toBeNull()
    await waitFor(() => expect(document.querySelector('[data-sf-m="batt-meter"]')).not.toBeNull())

    // ② 签到 UI 已整体下线（Kevin 2026-10-20 需求③）⇒ 负断言（文案一律取真 zh 词典）
    const checkinCard = document.getElementById('batt-checkin')
    const buttons = [...checkinCard.querySelectorAll('button')]
    expect(buttons.some((b) => b.textContent.trim() === zh.checkinPanel.checkinButton)).toBe(false)
    expect(buttons.some((b) => b.textContent.trim() === zh.checkinPanel.makeupButton)).toBe(false)
    expect(checkinCard.textContent).not.toContain(zh.checkinPanel.streakDays)
    expect(checkinCard.textContent).not.toContain(zh.checkinPanel.makeupCost)
    expect(checkinCard.textContent).not.toContain(zh.checkinPanel.brokenHint)
    // 全页层面同样 0 命中（防「签到区搬到别处」）
    expect(container.textContent).not.toContain(zh.checkinPanel.streakDays)

    // ③ 项目列表仍在，且 DOM 顺序在电量卡之后（= 页面上位于其下方）
    await waitFor(() => expect(container.querySelector('[data-sf-m="wage-list"]')).not.toBeNull())
    const checkin = container.querySelector('[data-sf-m="wage-checkin"]')
    const list = container.querySelector('[data-sf-m="wage-list"]')
    const relation = checkin.compareDocumentPosition(list)
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('未登录 ⇒ 电量卡不渲染（组件既有策略：返回 null），项目列表照常公开浏览（不白屏）', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { container } = renderAt(<WagePage />, '/wage')
    await waitFor(() => expect(container.querySelector('[data-sf-m="wage-list"]')).not.toBeNull())
    expect(document.getElementById('batt-checkin')).toBeNull()
    expect(container.querySelector('[data-sf-m="wage-login"]')).not.toBeNull()
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
    expect(zh.profileNav.title).toBe('我的置换')
    expect(en.profileNav.bought).toBe('Purchases')
    expect(hk.profileNav.settings).toBe('賬戶設置')
    expect(vn.activitiesPage.title).toBe('Điểm danh & Hoạt động')
  })
})
