/**
 * 顶栏四项「选中态」一致性（Kevin 2026-10-22）
 * ---------------------------------------------------------------------------
 * 现象：`.nav-link.active` 给了底色（#f3f4f6 + 橙字），但此前只有「悬赏 / 市场」会拿到
 *   active 类 ——「订单」完全没有 active 判据，「管理面板」还在用 `includes()` 且头部不在
 *   /dashboard 挂载。本文件钉死统一判据 `navActive()` 的四个落点：
 *
 *   ① `/task`、`/task/1`（子路径）、`/en/task`（语言前缀）⇒ **悬赏** active；
 *   ② `/exchange` ⇒ **市场** active；
 *   ③ `/dashboard`、`/dashboard/tasks`（仅管理员项在场时）⇒ **管理面板** active；
 *   ④ `/profile`、`/profile/assets`（子路径）⇒ **订单** active；
 *   ⑤ 负向：`/` 首页 ⇒ 四项**均不**带 active（不误染）；
 *   ⑥ 四项共用同一 class 名（`nav-link` + `active`），即同一份底样式。
 */
import React from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

// 极简 t：读取 zh 文案（缺失回键名），不足的插值回落键名
const t = (key, values) => {
  const parts = String(key).split('.')
  let cur = zh
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
    else return key
  }
  if (typeof cur !== 'string') return key
  return values ? cur.replace(/\{\{(\w+)\}\}/g, (m, k) => (values[k] === undefined ? m : String(values[k]))) : cur
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  updateSession: (p) => p,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 管理员项是否渲染由 fetchAdminAccess 决定 ⇒ 本文件默认「是管理员」
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ can_access_admin: true, preferred_admin_path: '/dashboard' })),
  hasAdminPermission: vi.fn(() => true),
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

const renderAt = (entry) => render(<MemoryRouter initialEntries={[entry]}><Header /></MemoryRouter>)

/** 桌面导航四项的 `[标签, 是否 active]` */
const navState = (container) => {
  const links = [...container.querySelectorAll('nav a')]
  return links.map((a) => ({ label: a.textContent.trim(), active: a.classList.contains('active'), cls: a.className }))
}
const ordersActive = (container) => {
  const el = container.querySelector('[data-sf-m="header-orders"]')
  return el ? el.classList.contains('active') : null
}

afterEach(cleanup)

describe('顶栏选中态：四项同一样式', () => {
  it('① /task 与 /task/1 ⇒ 悬赏 active（其余三项不 active）', async () => {
    for (const entry of ['/task', '/task/1', '/en/task']) {
      const { container, unmount } = renderAt(entry)
      await waitFor(() => expect(container.querySelectorAll('nav a').length).toBe(3))
      const rows = navState(container)
      expect(rows[0].active, `${entry} 悬赏`).toBe(true)
      expect(rows[1].active, `${entry} 市场`).toBe(false)
      expect(rows[2].active, `${entry} 管理面板`).toBe(false)
      expect(ordersActive(container), `${entry} 订单`).toBe(false)
      unmount()
    }
  })

  it('② /exchange ⇒ 市场 active', async () => {
    const { container } = renderAt('/exchange')
    await waitFor(() => expect(container.querySelectorAll('nav a').length).toBe(3))
    const rows = navState(container)
    expect(rows[0].active).toBe(false)
    expect(rows[1].active).toBe(true)
    expect(rows[2].active).toBe(false)
    expect(ordersActive(container)).toBe(false)
  })

  it('③ /dashboard 与 /dashboard/tasks ⇒ 管理面板 active（管理员项在场时）', async () => {
    for (const entry of ['/dashboard', '/dashboard/tasks']) {
      const { container, unmount } = renderAt(entry)
      await waitFor(() => expect(container.querySelectorAll('nav a').length).toBe(3))
      const rows = navState(container)
      expect(rows[2].label).toBe(t('admin_panel'))
      expect(rows[2].active, `${entry} 管理面板`).toBe(true)
      expect(rows[0].active).toBe(false)
      expect(rows[1].active).toBe(false)
      unmount()
    }
  })

  it('④ /profile 与 /profile/assets ⇒ 订单 active（子路径同样命中）', async () => {
    for (const entry of ['/profile', '/profile/assets', '/en/profile']) {
      const { container, unmount } = renderAt(entry)
      await waitFor(() => expect(ordersActive(container)).not.toBeNull())
      expect(ordersActive(container), `${entry} 订单`).toBe(true)
      navState(container).forEach((r) => expect(r.active, `${entry} ${r.label}`).toBe(false))
      unmount()
    }
  })

  it('⑤ 首页 / ⇒ 四项均不 active（不误染）', async () => {
    const { container } = renderAt('/')
    await waitFor(() => expect(container.querySelectorAll('nav a').length).toBe(3))
    navState(container).forEach((r) => expect(r.active).toBe(false))
    expect(ordersActive(container)).toBe(false)
  })

  it('⑥ 四项共用同一 class 基线（`nav-link`，active 由同一个 `.nav-link.active` 规则上色）', async () => {
    const { container } = renderAt('/exchange')
    await waitFor(() => expect(container.querySelectorAll('nav a').length).toBe(3))
    const all = [...container.querySelectorAll('nav a'), container.querySelector('[data-sf-m="header-orders"]')]
    expect(all.length).toBe(4)
    all.forEach((el) => expect(el.className).toContain('nav-link'))
  })
})
