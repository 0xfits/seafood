/**
 * R-9-84 单测（本单新增）：「我的」入口移到顶部菜单右上角（变体 A + 钱包地址缩写文案）
 *   ① 右上角新入口存在：`[data-sf-m="header-profile-entry"]`（`User` 图标 + 地址缩写）
 *   ② `href` 指向**四语前缀下**的 `/profile`（zh/en/hk/vn 各一例，走既有 buildPath 口径）
 *   ③ 地址缩写形态 = 既有派生（`0x` + 6 位 + `...` + 4 位）——原始派生切片，非新造格式
 *   ④ 未登录 ⇒ 不渲染（桌面 + 移动端两入口均缺）
 *   ⑤ 左侧 nav **不再含**「个人资料」（menuItems 已移除 profile）
 *   ⑥ 头像下拉中「电量与签到」项仍在（防回归，R-9-83）+ 「个人资料」重复项已移除
 */
import React from 'react'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
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
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const ADMIN = vi.hoisted(() => ({ access: { can_access_admin: false, preferred_admin_path: '/dashboard' } }))
vi.mock('../../admin-utils', () => ({ fetchAdminAccess: vi.fn(async () => ADMIN.access) }))

import Header from '../../components/Header'

const DESKTOP = '[data-sf-m="header-profile-entry"]'
const MOBILE = '[data-sf-m="header-profile-entry-mobile"]'
const USER_MENU = '[data-sf-m="header-user-menu"]'
const BATT = '[data-sf-m="header-batt-checkin"]'

const renderAt = (entry) => render(<MemoryRouter initialEntries={[entry]}><Header /></MemoryRouter>)

const openMenu = () => {
  const trigger = document.querySelector(USER_MENU)
  expect(trigger).toBeTruthy()
  act(() => { fireEvent.mouseEnter(trigger.parentElement) })
  act(() => { vi.advanceTimersByTime(200) })
}

beforeEach(() => {
  H.lang = 'zh'
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' }
  ADMIN.access = { can_access_admin: false, preferred_admin_path: '/dashboard' }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('R-9-84 右上角「我的」入口', () => {
  it('① 登录后桌面 + 移动端均渲染新入口（User 图标 + 地址缩写，文案不再是「个人资料」）', () => {
    renderAt('/')
    const desktop = document.querySelector(DESKTOP)
    const mobile = document.querySelector(MOBILE)
    expect(desktop).not.toBeNull()
    expect(mobile).not.toBeNull()
    // 文案 = 地址缩写；不得再是「个人资料」
    expect(desktop.textContent.trim()).toBe('0xABCD...EF12')
    expect(desktop.textContent).not.toContain(zh.profile)
    // 入口为 Link（<a>），内容含 User 图标（lucide svg）
    expect(desktop.tagName).toBe('A')
    expect(desktop.querySelector('svg')).not.toBeNull()
  })

  it('② href 指向四语前缀下的 /profile（zh/en/hk/vn 各一例）', () => {
    const cases = [
      ['/', '/profile'],
      ['/en', '/en/profile'],
      ['/hk', '/hk/profile'],
      ['/vn', '/vn/profile'],
    ]
    for (const [entry, expected] of cases) {
      cleanup()
      renderAt(entry)
      const desktop = document.querySelector(DESKTOP)
      expect(desktop, `entry=${entry}`).not.toBeNull()
      expect(desktop.getAttribute('href')).toBe(expected)
      expect(document.querySelector(MOBILE).getAttribute('href')).toBe(expected)
    }
  })

  it('③ 地址缩写形态 = 既有派生（0x + 6 位 + ... + 4 位）', () => {
    renderAt('/')
    const text = document.querySelector(DESKTOP).textContent.trim()
    expect(text).toBe('0xABCD...EF12')
    // 既有派生切片：slice(0,6) + '...' + slice(-4) ⇒ 0x 起 4 位十六进制 + ... + 4 位十六进制
    expect(text).toMatch(/^0x[0-9A-Fa-f]{4}\.\.\.[0-9A-Fa-f]{4}$/)
  })

  it('④ 未登录 ⇒ 两处入口均不渲染', () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    renderAt('/')
    expect(document.querySelector(DESKTOP)).toBeNull()
    expect(document.querySelector(MOBILE)).toBeNull()
  })

  it('⑤ 左侧 nav 不再含「个人资料」（且非管理员时仅 奖励/任务/碎片）', () => {
    renderAt('/')
    const nav = document.querySelector('nav')
    expect(nav).not.toBeNull()
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent.trim())
    expect(labels).not.toContain(zh.profile)
    expect(labels).not.toContain(hk.profile)
    expect(labels).toEqual([zh.reward, zh.task, zh.shard])
  })

  it('⑥ 头像下拉：「电量与签到」项仍在（R-9-83 防回归）；重复的「个人资料」项已移除', () => {
    vi.useFakeTimers()
    renderAt('/')
    openMenu()
    const batt = document.querySelector(BATT)
    expect(batt).not.toBeNull()
    expect(batt.getAttribute('href')).toBe('/profile#batt-checkin')
    expect(batt.textContent).toContain(zh.checkinPanel.checkinButton)
    expect(batt.textContent).toContain(zh.battCard.title)
    // 下拉内不再有重复的「个人资料」项
    const menu = document.querySelector(USER_MENU).parentElement.querySelector('div.absolute')
    expect(menu).not.toBeNull()
    expect(menu.textContent).not.toContain(zh.profile)
    // 积分项仍在
    expect(menu.textContent).toContain(zh.common.communityPoints)
    vi.useRealTimers()
  })

  it('⑥b 管理员下拉**不含**「管理后台/管理面板」项（反向断言，防再犯）', async () => {
    ADMIN.access = { can_access_admin: true, preferred_admin_path: '/dashboard' }
    vi.useFakeTimers()
    renderAt('/')
    // 等 fetchAdminAccess 的 promise 落定后菜单项重渲染
    await act(async () => { await Promise.resolve() })
    openMenu()
    const menu = document.querySelector(USER_MENU).parentElement.querySelector('div.absolute')
    expect(menu).not.toBeNull()
    // ★ 反向断言：下拉内**不得**出现「管理后台/管理面板」（管理后台仅在左侧 nav）
    expect(menu.textContent).not.toContain(zh.admin_panel)
    expect(menu.textContent).not.toContain(hk.admin_panel)
    expect(menu.textContent).not.toContain(en.admin_panel)
    expect(menu.textContent).not.toContain(vn.admin_panel)
    vi.useRealTimers()
  })
})
