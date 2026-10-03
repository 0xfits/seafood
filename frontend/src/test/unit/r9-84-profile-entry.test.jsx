/**
 * R-9-84 → R-9-85 单测（本单同步重写）：「我的/用户菜单」右上角**合并为唯一按钮**
 *
 * 背景：R-9-84 曾在右上角新增一个独立直达 `Link`（`User` + 地址缩写 → `/profile`），
 *       与既有用户菜单触发器并排 ⇒ 视觉上两个菜单。R-9-85（Kevin 定档）合并为一个：
 *       删独立 Link；把**用户菜单触发器**改为唯一按钮 = `User` + 地址缩写 + `ChevronDown`（仍 HoverMenu）。
 *
 * 断言：
 *   ① 右上角恰一个控件（`data-sf-m` 钩子计数 = 1，桌面场景；R-9-84 两个旧入口均为 0）
 *   ② 按钮文案 = 地址缩写形态（`0x` + 4 位 + `...` + 4 位，既有派生）；含 `User` + `ChevronDown`
 *   ③ 下拉含：个人资料（四语前缀 href 各一例）· 电量与签到（`…/profile#batt-checkin`）·
 *      退出登录 · 积分块；且**不含**「管理后台」（反向断言，R-9-84 结论保持）
 *   ④ 未登录 ⇒ 桌面 + 移动两处均不渲染
 *   ⑤ 左侧 nav 仍**不含**「个人资料」（R-9-84 结论保持）
 *   ⑥ 移动端：唯一入口 = 汉堡；点开面板 ⇒ 面板内含与桌面同款各项
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

const USER_MENU = '[data-sf-m="header-user-menu"]'
const PROFILE = '[data-sf-m="header-profile"]'
const BATT = '[data-sf-m="header-batt-checkin"]'
const LOGOUT = '[data-sf-m="header-logout"]'
const MOBILE_MENU = '[data-sf-m="header-mobile-menu"]'
const MOBILE_USER = '[data-sf-m="header-user-menu-mobile"]'
const MOBILE_PROFILE = '[data-sf-m="header-profile-mobile"]'
const MOBILE_BATT = '[data-sf-m="header-batt-checkin-mobile"]'
const MOBILE_LOGOUT = '[data-sf-m="header-logout-mobile"]'
// R-9-84 已删除的两个旧入口（合并后必须为 0）
const OLD_DESKTOP = '[data-sf-m="header-profile-entry"]'
const OLD_MOBILE = '[data-sf-m="header-profile-entry-mobile"]'

const renderAt = (entry) => render(<MemoryRouter initialEntries={[entry]}><Header /></MemoryRouter>)

/** 右上角「用户/我的」控件计数：合并后应恰为 1（旧两入口均 0） */
const profileControlCount = () =>
  [USER_MENU, OLD_DESKTOP, OLD_MOBILE]
    .map((sel) => document.querySelectorAll(sel).length)
    .reduce((a, b) => a + b, 0)

const openMenu = () => {
  const trigger = document.querySelector(USER_MENU)
  expect(trigger).toBeTruthy()
  act(() => { fireEvent.mouseEnter(trigger.parentElement) })
  act(() => { vi.advanceTimersByTime(200) })
  return document.querySelector(USER_MENU).parentElement.querySelector('div.absolute')
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

describe('R-9-85 右上角合并为唯一菜单按钮（文案 = 钱包地址缩写）', () => {
  it('① 右上角恰一个控件（data-sf-m 计数 = 1；R-9-84 两个旧入口均为 0）', () => {
    renderAt('/')
    expect(document.querySelectorAll(USER_MENU).length).toBe(1)
    expect(document.querySelectorAll(OLD_DESKTOP).length).toBe(0)
    expect(document.querySelectorAll(OLD_MOBILE).length).toBe(0)
    expect(profileControlCount()).toBe(1)
  })

  it('② 按钮文案 = 地址缩写形态 + 含 User 图标 + ChevronDown', () => {
    renderAt('/')
    const btn = document.querySelector(USER_MENU)
    expect(btn).not.toBeNull()
    expect(btn.tagName).toBe('BUTTON')
    const text = btn.textContent.trim()
    // 既有派生切片：slice(0,6) + '...' + slice(-4) ⇒ `0x` + 4 位十六进制 + `...` + 4 位十六进制
    expect(text).toBe('0xABCD...EF12')
    expect(text).toMatch(/^0x[0-9A-Fa-f]{4}\.\.\.[0-9A-Fa-f]{4}$/)
    // 文案不再是「个人资料」
    expect(text).not.toContain(zh.profile)
    // 图标：User + ChevronDown 各一
    expect(btn.querySelector('svg.lucide-user')).not.toBeNull()
    expect(btn.querySelector('svg.lucide-chevron-down')).not.toBeNull()
    expect(btn.querySelectorAll('svg').length).toBe(2)
  })

  it('③a 下拉「个人资料」项 href 指向四语前缀下的 /profile（zh/en/hk/vn 各一例）', () => {
    const cases = [
      ['/', '/profile'],
      ['/en', '/en/profile'],
      ['/hk', '/hk/profile'],
      ['/vn', '/vn/profile'],
    ]
    vi.useFakeTimers()
    for (const [entry, expected] of cases) {
      cleanup()
      renderAt(entry)
      const link = openMenu().querySelector(PROFILE)
      expect(link, `entry=${entry}`).not.toBeNull()
      expect(link.getAttribute('href')).toBe(expected)
      expect(link.textContent).toContain(zh.profile)
    }
    vi.useRealTimers()
  })

  it('③b 下拉「电量与签到」项 href = …/profile#batt-checkin（四语）+ 保留 R-9-83 钩子', () => {
    const cases = [
      ['/', '/profile#batt-checkin'],
      ['/en', '/en/profile#batt-checkin'],
      ['/hk', '/hk/profile#batt-checkin'],
      ['/vn', '/vn/profile#batt-checkin'],
    ]
    vi.useFakeTimers()
    for (const [entry, expected] of cases) {
      cleanup()
      renderAt(entry)
      const link = openMenu().querySelector(BATT)
      expect(link, `entry=${entry}`).not.toBeNull()
      expect(link.getAttribute('href')).toBe(expected)
      expect(link.textContent).toContain(zh.checkinPanel.checkinButton)
      expect(link.textContent).toContain(zh.battCard.title)
    }
    vi.useRealTimers()
  })

  it('③c 下拉含 积分块 + 退出登录；且**不含**「管理后台」（反向断言，四语）', () => {
    vi.useFakeTimers()
    renderAt('/')
    const menu = openMenu()
    expect(menu).not.toBeNull()
    expect(menu.textContent).toContain(zh.common.communityPoints)
    expect(menu.querySelector(LOGOUT)).not.toBeNull()
    expect(menu.querySelector(LOGOUT).textContent).toContain(zh.logout)
    // ★ 反向断言：下拉内**不得**出现「管理后台/管理面板」（管理后台仅在左侧 nav）
    expect(menu.textContent).not.toContain(zh.admin_panel)
    expect(menu.textContent).not.toContain(hk.admin_panel)
    expect(menu.textContent).not.toContain(en.admin_panel)
    expect(menu.textContent).not.toContain(vn.admin_panel)
    vi.useRealTimers()
  })

  it('③d 管理员身份下，下拉仍**不含**「管理后台」（R-9-84 结论保持）', async () => {
    ADMIN.access = { can_access_admin: true, preferred_admin_path: '/dashboard' }
    vi.useFakeTimers()
    renderAt('/')
    await act(async () => { await Promise.resolve() })
    const menu = openMenu()
    expect(menu).not.toBeNull()
    expect(menu.textContent).not.toContain(zh.admin_panel)
    vi.useRealTimers()
  })

  it('④ 未登录 ⇒ 桌面 + 移动两处用户/我的入口均不渲染', () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    renderAt('/')
    // 桌面：无用户菜单触发器（改为 注册/登录 按钮）
    expect(document.querySelector(USER_MENU)).toBeNull()
    // 移动：无用户区；且历史两入口均不存在
    expect(document.querySelector(MOBILE_USER)).toBeNull()
    expect(document.querySelector(OLD_DESKTOP)).toBeNull()
    expect(document.querySelector(OLD_MOBILE)).toBeNull()
    // 打开移动面板后仍无用户区（未登录）⇒ 移动端不渲染
    act(() => { fireEvent.click(document.querySelector(MOBILE_MENU)) })
    expect(document.querySelector(MOBILE_USER)).toBeNull()
    expect(document.querySelector(MOBILE_PROFILE)).toBeNull()
    expect(document.querySelector(MOBILE_BATT)).toBeNull()
    expect(document.querySelector(MOBILE_LOGOUT)).toBeNull()
  })

  it('⑤ 左侧 nav 仍不含「个人资料」（且非管理员时仅 奖励/任务/碎片）', () => {
    renderAt('/')
    const nav = document.querySelector('nav')
    expect(nav).not.toBeNull()
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent.trim())
    expect(labels).not.toContain(zh.profile)
    expect(labels).not.toContain(hk.profile)
    expect(labels).toEqual([zh.reward, zh.task, zh.shard])
  })

  it('⑥ 移动端：唯一入口 = 汉堡；面板内 = 与桌面同款各项（个人资料 / 电量与签到 / 退出登录）', () => {
    renderAt('/')
    // md:hidden 块内只有汉堡一个入口（旧独立 Link 已删）
    expect(document.querySelector(MOBILE_MENU)).not.toBeNull()
    expect(document.querySelector(OLD_MOBILE)).toBeNull()
    act(() => { fireEvent.click(document.querySelector(MOBILE_MENU)) })
    const profile = document.querySelector(MOBILE_PROFILE)
    const batt = document.querySelector(MOBILE_BATT)
    const logout = document.querySelector(MOBILE_LOGOUT)
    expect(profile).not.toBeNull()
    expect(profile.getAttribute('href')).toBe('/profile')
    expect(profile.textContent).toContain(zh.profile)
    expect(batt).not.toBeNull()
    expect(batt.getAttribute('href')).toBe('/profile#batt-checkin')
    expect(batt.textContent).toContain(zh.checkinPanel.checkinButton)
    expect(logout).not.toBeNull()
    expect(logout.textContent).toContain(zh.logout)
  })
})
