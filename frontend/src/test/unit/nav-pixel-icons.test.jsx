/**
 * 顶栏四图标换像素图（Kevin 2026-10-22 需求单）
 *
 * 覆盖（Kevin 四图：悬赏=贝壳含珍珠 / 市场=鲸鱼 / 管理面板=章鱼 / 订单=龙虾）：
 *   ① 桌面左 nav 三项（管理员档）各含 `<img>` 且 **src 逐一对拍** `/icons/nav/nav-{bounty,market,admin}.png`；
 *     （非管理员档 = 前两项；nav 内 lucide `<svg>` 零残留）
 *   ② 「订单」按钮（桌面 `header-orders` + 移动面板 `header-orders-mobile`）img src = `nav-orders.png`；
 *   ③ 移动汉堡面板内像素图同步（任务项 = bounty、订单项 = orders）；
 *   ④ 四图渲染规格统一：`h-[18px] w-[18px] shrink-0` + `imageRendering: pixelated` + `alt=""` + `aria-hidden`；
 *   ⑤ 资产在库：`frontend/public/icons/nav/` 四个 PNG 存在且非空；
 *   ⑥ 源码零残留：Header.jsx 不再 import lucide 的 Gift/Store/ShieldCheck（Store 仍归底栏 nav.js），
 *      旧 `order.svg` 图标 import 退役。
 *
 * 说明：18px 实际几何 / pixelated 计算样式 / 图片请求 200 由探针 `ops/header-nav/probe-header-nav.mjs`
 * 在真实 Chromium + dist 上断言；本文件锁 DOM 结构与 src 真源。
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})
H.tables = { zh }

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t }) }))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  updateSession: (p) => p,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const ADMIN = vi.hoisted(() => ({ can: false }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => (ADMIN.can
    ? { can_access_admin: true, preferred_admin_path: '/dashboard' }
    : { can_access_admin: false, preferred_admin_path: '/dashboard' })),
  hasAdminPermission: vi.fn(() => ADMIN.can),
}))

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async () => []),
  fetchCurrentUser: vi.fn(async () => ({ uID: 7, EVM: '0xabc' })),
  getAuthHeaders: vi.fn(() => ({})),
  updateMyProfile: vi.fn(),
}))

vi.mock('../../balances-api', () => ({
  fetchUserBalances: vi.fn(async () => []),
  formatBalanceAmount: (v) => String(v),
  toBalanceRows: () => [],
}))

import Header from '../../components/Header'

// 真源常量（与 Header.jsx NAV_ICON_SRC 一字对拍；改这里必须连动源码与探针 EXPECT_SRCS）
const SRC = {
  bounty: '/icons/nav/nav-bounty.png',
  market: '/icons/nav/nav-market.png',
  admin: '/icons/nav/nav-admin.png',
  orders: '/icons/nav/nav-orders.png',
}

const REPO_FRONTEND = process.cwd()

const renderHeaderAt = (entry = '/') => render(<MemoryRouter initialEntries={[entry]}><Header /></MemoryRouter>)

// 管理项由异步 fetchAdminAccess 决定 ⇒ 轮询等三项落齐（与探针 waitForFunction 同口径）
const waitForNavCount = async (n) => {
  const nav = () => document.querySelector('#header nav')
  for (let i = 0; i < 50 && nav().querySelectorAll('a').length < n; i += 1) {
    await act(() => new Promise((r) => setTimeout(r, 10)))
  }
  return nav()
}

const iconSpec = (img) => ({
  src: img.getAttribute('src'),
  className: img.getAttribute('className') || img.className || '',
  // jsdom 不算样式 ⇒ style 以内联对象属性断言；像素级渲染由探针在真实 Chromium 断言
  pixelated: img.style.imageRendering,
  alt: img.getAttribute('alt'),
  ariaHidden: img.getAttribute('aria-hidden'),
})

beforeEach(() => {
  H.lang = 'zh'
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' }
  ADMIN.can = false
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
  document.documentElement.setAttribute('data-theme', 'light')
  localStorage.setItem('user', JSON.stringify(AUTH.user))
  localStorage.setItem('token', 't')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('nav-pixel-icons · 顶栏四图标 = 像素图（贝壳/鲸鱼/章鱼/龙虾）', () => {
  it('① 桌面左 nav 三项（管理员档）img src 逐一对拍：bounty/market/admin + lucide svg 零残留', async () => {
    ADMIN.can = true
    renderHeaderAt('/')
    const nav = await waitForNavCount(3)
    const links = [...nav.querySelectorAll('a')]
    expect(links.map((a) => a.textContent.trim())).toEqual([zh.task, zh.shard, zh.admin_panel])
    expect(links.map((a) => iconSpec(a.querySelector('img')).src)).toEqual([SRC.bounty, SRC.market, SRC.admin])
    // 图标判据换型后，nav 内不得再出现 lucide `<svg>`
    expect(nav.querySelectorAll('svg').length).toBe(0)
  })

  it('①b 非管理员档 = 前两项（bounty/market），无 admin 图', () => {
    renderHeaderAt('/')
    const links = [...document.querySelector('#header nav').querySelectorAll('a')]
    expect(links).toHaveLength(2)
    expect(links.map((a) => iconSpec(a.querySelector('img')).src)).toEqual([SRC.bounty, SRC.market])
  })

  it('② 「订单」按钮（桌面）img src = nav-orders.png（龙虾图）', () => {
    renderHeaderAt('/')
    const btn = document.querySelector('[data-sf-m="header-orders"]')
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('href')).toBe('/profile')
    expect(iconSpec(btn.querySelector('img')).src).toBe(SRC.orders)
    expect(btn.querySelector('svg')).toBeNull()
    expect(btn.textContent).toContain(zh.header.orders)
  })

  it('③ 移动汉堡面板同步：任务项 = bounty、订单项 = orders（像素图进面板，不再用旧 order.svg）', () => {
    renderHeaderAt('/')
    act(() => { fireEvent.click(document.querySelector('[data-sf-m="header-mobile-menu"]')) })
    const panel = document.querySelector('.md\\:hidden.bg-white')
    expect(panel).not.toBeNull()
    const imgs = [...panel.querySelectorAll('a img')]
    expect(imgs.map((el) => el.getAttribute('src'))).toContain(SRC.bounty)
    const ordersLink = document.querySelector('[data-sf-m="header-orders-mobile"]')
    expect(ordersLink).not.toBeNull()
    expect(iconSpec(ordersLink.querySelector('img')).src).toBe(SRC.orders)
    // 旧订单图标（../images/order.svg）在面板内零残留
    expect(imgs.some((el) => String(el.getAttribute('src')).includes('order.svg'))).toBe(false)
  })

  it('④ 四图渲染规格统一：h-[18px] w-[18px] shrink-0 + pixelated + alt="" + aria-hidden', async () => {
    ADMIN.can = true
    renderHeaderAt('/')
    await waitForNavCount(3)
    act(() => { fireEvent.click(document.querySelector('[data-sf-m="header-mobile-menu"]')) })
    const imgs = [
      ...document.querySelectorAll('#header nav a img'),
      document.querySelector('[data-sf-m="header-orders"] img'),
      document.querySelector('[data-sf-m="header-orders-mobile"] img'),
    ]
    expect(imgs.length).toBe(5) // 桌面 3 + 订单桌面 1 + 订单移动 1（移动面板任务项与桌面共享断言于 ③）
    for (const img of imgs) {
      const spec = iconSpec(img)
      expect(spec.className).toContain('h-[18px]')
      expect(spec.className).toContain('w-[18px]')
      expect(spec.className).toContain('shrink-0')
      expect(spec.pixelated).toBe('pixelated')
      expect(spec.alt).toBe('')
      expect(spec.ariaHidden).toBe('true')
    }
  })

  it('⑤ 资产在库：public/icons/nav/ 四个 PNG 存在且非空', () => {
    const dir = path.join(REPO_FRONTEND, 'public/icons/nav')
    for (const file of ['nav-bounty.png', 'nav-market.png', 'nav-admin.png', 'nav-orders.png']) {
      const p = path.join(dir, file)
      expect(fs.existsSync(p)).toBe(true)
      expect(fs.statSync(p).size).toBeGreaterThan(0)
    }
  })

  it('⑥ 源码零残留：Header.jsx 退役 Gift/Store/ShieldCheck 与 order.svg import（Store 归底栏 nav.js）', () => {
    const source = fs.readFileSync(path.join(REPO_FRONTEND, 'src/components/Header.jsx'), 'utf8')
    expect(source).not.toMatch(/import\s*\{[^}]*\bGift\b[^}]*\}\s*from\s*'lucide-react'/)
    expect(source).not.toMatch(/import\s*\{[^}]*\bStore\b[^}]*\}\s*from\s*'lucide-react'/)
    expect(source).not.toMatch(/import\s*\{[^}]*\bShieldCheck\b[^}]*\}\s*from\s*'lucide-react'/)
    expect(source).not.toContain('order.svg')
    expect(source).not.toContain('orderIcon')
    // 像素图真源在场
    for (const src of Object.values(SRC)) expect(source).toContain(`'${src}'`)
  })
})
