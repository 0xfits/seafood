/**
 * P6-I18N-LIT-B4a · 后台管理面前半（`adminNav` / `adminLayout` / `adminCommon` / `dashPage` /
 *                `adminTasks` / `adminRewards`）四语化验收
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 走**真实** i18n 实例（`import '../../i18n'`）+ `i18n.changeLanguage('en')`，**不 mock** `react-i18next`；
 *      后台三文件均只读 `i18n.t`（无路由语前缀派生）⇒ `changeLanguage` 即真「en 档」；
 *   ② 数据面只 mock `../../admin-utils`（权限/取数口）；组件树其余全真；
 *   ③ 反证 = 简体原文在 en 档渲染期不得出现（逐条 `queryByText` 断言）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, permissions: [], can_access_admin: true })),
  fetchApiJson: vi.fn(async (url) => {
    if (String(url).includes('/api/task/all')) {
      return [{ tID: 1, title: 'Task A', note: '', refcode: 'task', points: 10, is_open: true, time_updated: 1700000000 }]
    }
    // `/api/prize/all`：name/description 留空 ⇒ 走「#ID / 无描述」兜底键
    return [{ bID: 7, name: '', description: '', points: 10, total_quantity: 3, stores_count: 5, claims_count: 2, lifecycle_status: 'expired' }]
  }),
  getAuthHeaders: vi.fn(() => ({})),
  getStoredUser: vi.fn(() => ({ uID: 1, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: vi.fn(() => true),
}))

import AdminLayout from '../../components/layout/AdminLayout'
import TasksManagement from '../../pages/admin/TasksManagement'
import RewardsManagement from '../../pages/admin/RewardsManagement'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']

afterEach(() => { cleanup() })

describe('P6-I18N-LIT-B4a · en 档渲染英文（后台面三个页面）', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('AdminLayout（侧边栏 + 顶栏 + 账号区）：导航/面板名/角色/在线 全走英文', async () => {
    render(<MemoryRouter initialEntries={['/']}><AdminLayout /></MemoryRouter>)

    // 侧边栏 8 条导航（`adminNav.*`）
    for (const label of [
      'Dashboard', 'Task Management', 'Prize Management', 'Shard Management',
      'User Management', 'Permission Management', 'Points Management', 'System Settings',
    ]) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    // 面板名（`adminLayout.panelTitle`，侧栏标题 + 顶栏标题两处）
    expect(screen.getAllByText('Admin Panel').length).toBeGreaterThanOrEqual(2)
    // 账号区
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Log out')).toBeInTheDocument()
    // 反证：简体原文不出现
    expect(screen.queryByText('管理面板')).toBeNull()
    expect(screen.queryByText('仪表板')).toBeNull()
    expect(screen.queryByText('在线')).toBeNull()
  })

  it('TasksManagement（en 档）：页头 / 只读告示 / 刷新 / 兜底描述 / 积分 / 开关态 全走英文', async () => {
    render(<TasksManagement />)

    expect(await screen.findByText('Task Management')).toBeInTheDocument()
    expect(screen.getByText(/read-only mode/)).toBeInTheDocument()
    expect(screen.getByText('Refresh')).toBeInTheDocument()
    expect(await screen.findByText('Task A')).toBeInTheDocument()
    // `note` 为空 ⇒ 兜底键 `adminCommon.noDescription`
    expect(screen.getByText('No description')).toBeInTheDocument()
    // `adminCommon.pointsValue` = '{{value}} points'
    expect(screen.getByText('10 points')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.queryByText('暂无描述')).toBeNull()
    expect(screen.queryByText('刷新')).toBeNull()
    expect(screen.queryByText('任务管理')).toBeNull()
  })

  it('RewardsManagement（en 档）：页头 / 兜底名 / 徽标（总量·库存·已兑换·过期）全走英文', async () => {
    render(<RewardsManagement />)

    expect(await screen.findByText('Prize Management')).toBeInTheDocument()
    expect(screen.getByText(/read-only mode/)).toBeInTheDocument()
    // `name` 为空 ⇒ `adminRewards.fallbackName`
    expect(await screen.findByText('Prize #7')).toBeInTheDocument()
    expect(screen.getByText('No description')).toBeInTheDocument()
    expect(screen.getByText('Total: 3')).toBeInTheDocument()
    expect(screen.getByText('Stock: 5')).toBeInTheDocument()
    expect(screen.getByText('Redeemed: 2')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.queryByText('奖品管理')).toBeNull()
    expect(screen.queryByText('已过期')).toBeNull()
  })
})

describe('P6-I18N-LIT-B4a · 四语 locale 键集（6 命名空间 144 键 + 逐文件相等）', () => {
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()
  // 本批新增命名空间 → 键数（逐命名空间硬断言，防「键名写错但四语同步错」）
  const NEW_NS = { adminNav: 16, adminLayout: 5, adminCommon: 28, dashPage: 58, adminTasks: 14, adminRewards: 42 }
  const NEW_KEY_TOTAL = Object.values(NEW_NS).reduce((a, b) => a + b, 0)
  // B4a 交付时合计 = 144；B4b（后台剩余面）给既有 `adminCommon` 追加 19 键 ⇒ 现值 163。
  // 保留 144 作为 B4a 历史口径锚点（防「顺手改大期望值」掩盖键名事故）。
  const B4A_ADDED = 144
  const B4B_ADDED_TO_ADMINCOMMON = 19

  it('新增键四语齐备、非空串；四文件拍平键集逐文件相等', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    console.info('[B4a] locale 键数读数', JSON.stringify(counts))
    console.info('[B4a] 本批新增键数', NEW_KEY_TOTAL)

    // ③ 键集相等：四文件拍平键数取值集合 = {643}（B4b 后），且与 zh 逐项对拍
    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    expect(counts.zh).toEqual({ top: 102, flat: 704 }) // P6-MISC-FIX ① 新增 listings.statusLabel 5 键（678⇒683）；批 7-A 新增 ledger.flowMore + ledger.kind.*（20 kind 全覆盖）共 21 键（683⇒704）
    expect(NEW_KEY_TOTAL).toBe(B4A_ADDED + B4B_ADDED_TO_ADMINCOMMON)

    // 本批 6 命名空间：键数逐一对齐 + 四语取值齐备非空
    for (const [ns, size] of Object.entries(NEW_NS)) {
      expect(sets.zh).not.toContain(ns)
      for (const lang of LANGS) {
        const table = tables[lang][ns]
        expect(typeof table).toBe('object')
        expect(Object.keys(table).sort()).toEqual(Object.keys(tables.zh[ns]).sort())
        expect(Object.keys(table).length).toBe(size)
        for (const value of Object.values(table)) {
          expect(typeof value).toBe('string')
          expect(value.trim().length).toBeGreaterThan(0)
        }
      }
    }
    // 抽查：en / vn 不得残留 CJK 表意文字（hk 为繁体中文，`儀表板` 等本就用 CJK ⇒ 不在断言内）
    const CJK = /[\u4E00-\u9FFF]/
    for (const ns of ['adminNav', 'adminLayout', 'adminCommon', 'dashPage', 'adminTasks', 'adminRewards']) {
      for (const [k, v] of Object.entries(tables.en[ns])) expect(CJK.test(v), `en.${ns}.${k}`).toBe(false)
      for (const [k, v] of Object.entries(tables.vn[ns])) expect(CJK.test(v), `vn.${ns}.${k}`).toBe(false)
    }
    // hk 必须是繁体（不得是简体原文）：抽查 3 条简体/繁体异形
    expect(tables.hk.adminNav.dashboard).toBe('儀表板')
    expect(tables.hk.adminLayout.systemAdmin).toBe('系統管理')
    expect(tables.hk.adminRewards.expired).toBe('已過期')
  })

  it('zh 词典取值与本批改写前的原文逐字一致（既有 zh 断言/截图基线不受影响）', () => {
    const zh = JSON.parse(fs.readFileSync(path.join(SRC, 'locales/zh.json'), 'utf8'))
    expect(zh.adminNav.tasks).toBe('任务管理')
    expect(zh.adminLayout.panelTitle).toBe('管理面板')
    expect(zh.adminCommon.pointsValue).toBe('{{value}} 积分')
    expect(zh.dashPage.pendingTitle).toBe('普通用户 Task Progress 审批')
    expect(zh.dashPage.verifyApproved).toBe('任务已通过审核')
    expect(zh.adminTasks.stateClosed).toBe('关闭')
    expect(zh.adminRewards.expired).toBe('已过期')
    expect(zh.adminRewards.floorPriceLabel).toBe('保底单片价：')
  })
})
