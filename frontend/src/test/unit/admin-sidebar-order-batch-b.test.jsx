/**
 * 后台侧栏**改名 + 重排**（Kevin 2026-10-24 批次 B）—— 七项定序 / 六项文案 / path 不漂移
 *
 * 口径（与 `i18n-batch-b4a` 一致：真 i18n 实例、只 mock `../../admin-utils`）：
 *   ① 运行时：zh 档侧栏 `<nav>` 内七项文本**逐字且逐序** = ['总览','用户','积分','电量','交易所','审计','设置']；
 *   ② 静态：`AdminLayout.jsx` 的 `title:` 取键序列 = dashboard / users / points / battCard.title / feeRate / auditConsole / settings
 *      （与 ① 互为交叉证据：文案来自真实的四个 locale 表，不是测试自造的字面量）；
 *   ③ 六项改名四语逐字（zh / hk / en / vn），键名与键集零漂移（`adminNav` 30 键不变）；
 *   ④ 七项 `path` 一字不动（`/dashboard`、`/dashboard/users`、`/dashboard/points`、`/dashboard/power`、
 *      `/dashboard/exchange`、`/dashboard/audit-console`、`/dashboard/settings`），且每项只有一处声明。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, permissions: [], can_access_admin: true })),
  fetchApiJson: vi.fn(async () => ({})),
  getAuthHeaders: vi.fn(() => ({})),
  getStoredUser: vi.fn(() => ({ uID: 1, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: vi.fn(() => true),
}))

import AdminLayout from '../../components/layout/AdminLayout'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const readTable = (lang) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
const readSrc = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

// 七项定序（zh 真值）＝本单的验收真源
const ORDER_ZH = ['总览', '用户', '积分', '电量', '交易所', '审计', '设置']
const ORDER_KEYS = [
  'adminNav.dashboard',
  'adminNav.users',
  'adminNav.points',
  'battCard.title',
  'adminNav.feeRate',
  'adminNav.auditConsole',
  'adminNav.settings',
]
const ORDER_PATHS = [
  '/dashboard',
  '/dashboard/users',
  '/dashboard/points',
  '/dashboard/power',
  '/dashboard/exchange',
  '/dashboard/audit-console',
  '/dashboard/settings',
]

afterEach(() => { cleanup() })

describe('批次 B · 侧栏七项定序（总览 → 用户 → 积分 → 电量 → 交易所 → 审计 → 设置）', () => {
  beforeEach(async () => { await i18n.changeLanguage('zh') })

  it('① 运行时（zh 真表）：`<nav>` 内七项文本逐字逐序 = 总览/用户/积分/电量/交易所/审计/设置', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><AdminLayout /></MemoryRouter>)

    await waitFor(() => {
      const nav = container.querySelector('nav')
      expect(nav).not.toBeNull()
      expect(nav.querySelectorAll('a').length).toBe(7)
    })
    const nav = container.querySelector('nav')
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent.trim())
    expect(labels).toEqual(ORDER_ZH)

    // 交叉证据：这七个字面量确实等于四语真表里的对应键值（不是测试自造）
    const zh = readTable('zh')
    const expected = ORDER_KEYS.map((key) => key.split('.').reduce((o, k) => o[k], zh))
    expect(labels).toEqual(expected)
    expect(labels).toEqual(ORDER_ZH)
  })

  it('② 静态：`title:` 取键序列 = 新定序（数组元素顺序即渲染顺序）', () => {
    const layout = readSrc('components/layout/AdminLayout.jsx')
    const keys = [...layout.matchAll(/title: t\('([^']+)'\),/g)].map((m) => m[1])
    // 品牌行 / 退出按钮不用 `title: t(...)` 形态 ⇒ 该序列恰为七个侧栏项的取键
    expect(keys).toEqual(ORDER_KEYS)
  })

  it('③ 七项 path 未变、逐项仅声明一次、顺序与新定序一致', () => {
    const layout = readSrc('components/layout/AdminLayout.jsx')
    const paths = [...layout.matchAll(/path: '(\/dashboard[^']*)',/g)].map((m) => m[1])
    expect(paths).toEqual(ORDER_PATHS)
    for (const p of ORDER_PATHS) {
      expect(layout.split(`path: '${p}',`).length - 1, p).toBe(1)
    }
    // 旧路（重排前）已不存在：设置不再是第 4 项、电量不再是第 6 项
    expect(paths.indexOf('/dashboard/settings')).toBe(6)
    expect(paths.indexOf('/dashboard/power')).toBe(3)
  })
})

describe('批次 B · 六项改名：四语逐字（键名不动 ⇒ 零键漂移）', () => {
  const EXPECT = {
    // key: [zh, hk, en, vn]
    dashboard: ['总览', '總覽', 'Overview', 'Tổng quan'],
    users: ['用户', '用戶', 'Users', 'Người dùng'],
    points: ['积分', '積分', 'Points', 'Điểm'],
    settings: ['设置', '設定', 'Settings', 'Cài đặt'],
    feeRate: ['交易所', '交易所', 'Exchange', 'Sàn'],
    auditConsole: ['审计', '審計', 'Audit', 'Kiểm toán'],
  }

  it('① 逐项 × 逐语取值逐字相等（zh / hk / en / vn）', () => {
    // ★ 注意：LANGS 的既有顺序是 [zh, en, hk, vn]，而下方 EXPECT 的列序是 [zh, hk, en, vn]
    //   ⇒ 这里显式用列序常量，避免「按 LANGS 索引取列」错位（本文件首跑即踩过）。
    const COLS = ['zh', 'hk', 'en', 'vn']
    const tables = Object.fromEntries(COLS.map((l) => [l, readTable(l)]))
    for (const [key, vals] of Object.entries(EXPECT)) {
      COLS.forEach((lang, i) => {
        expect(tables[lang].adminNav[key], `${lang}.adminNav.${key}`).toBe(vals[i])
      })
    }
  })

  it('② 键名与键集零漂移：`adminNav` 四语均 30 键，且本批改名的六个键名仍在（未改名）', () => {
    for (const lang of LANGS) {
      const table = readTable(lang).adminNav
      expect(Object.keys(table).length, lang).toBe(30)
      for (const key of Object.keys(EXPECT)) expect(table[key], `${lang}.${key}`).toBeDefined()
    }
    // 负向锁：旧值不得残留在**本键**上
    const zh = readTable('zh')
    for (const legacy of ['仪表板', '用户管理', '积分管理', '基本设置', '交易所管理', '审计台']) {
      expect(Object.values(zh.adminNav)).not.toContain(legacy)
    }
  })

  it('③ 描述键不受影响（只改标题值，`*Desc` 一字未动）', () => {
    const zh = readTable('zh')
    expect(zh.adminNav.dashboardDesc).toBe('系统概览和统计')
    expect(zh.adminNav.usersDesc).toBe('管理用户账户')
    expect(zh.adminNav.pointsDesc).toBe('调整用户积分')
    expect(zh.adminNav.settingsDesc).toBe('站点名称等基础信息')
    expect(zh.adminNav.feeRateDesc).toBe('交易所费率与参数')
    expect(zh.adminNav.auditConsoleDesc).toBe('只读检索各表留痕记录')
  })
})

describe('批次 B · 其它语言档渲染（en / hk / vn 侧栏同序）', () => {
  it.each([
    ['en', ['Overview', 'Users', 'Points', 'Energy', 'Exchange', 'Audit', 'Settings']],
    ['hk', ['總覽', '用戶', '積分', '電量', '交易所', '審計', '設定']],
    ['vn', ['Tổng quan', 'Người dùng', 'Điểm', 'Năng lượng', 'Sàn', 'Kiểm toán', 'Cài đặt']],
  ])('%s 档：侧栏七项同序同值', async (lang, expected) => {
    await i18n.changeLanguage(lang)
    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><AdminLayout /></MemoryRouter>)
    await waitFor(() => expect(container.querySelectorAll('nav a').length).toBe(7))
    const labels = Array.from(container.querySelectorAll('nav a')).map((a) => a.textContent.trim())
    expect(labels).toEqual(expected)
    // 旧值零残留（抽查三项）
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.queryByText('Basic settings')).toBeNull()
    expect(screen.queryByText('Audit console')).toBeNull()
    await i18n.changeLanguage('zh')
  })
})
