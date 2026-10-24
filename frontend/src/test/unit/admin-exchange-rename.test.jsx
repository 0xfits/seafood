/**
 * 后台【费率配置】→【交易所管理】改名（Kevin 2026-10-24 裁定）—— 只改页名与路径的单测
 *
 * 契约：
 *  ① 页面路径 = `/dashboard/exchange/fee-rate`（`App.jsx` 内层相对段；壳 `/dashboard/exchange` 的 index 即重定向到此，
 *     旧 `/dashboard/fee-rate` 保书签落 redirect）。
 *  ② 侧栏项真源：`adminNav.feeRate` / `adminNav.feeRateDesc` **键名不变**（只改值）⇒ href = `/dashboard/exchange`。
 *  ③ 组件名 / 文件名 `FeeRatePage` 保留（最小改动）；闸仍 `manage_settings`。
 *  ④ 项目页保留字表**不动**：`fee-rate` 与 `exchange` 两段都仍在 `RESERVED_PROJECT_SEGMENTS`（历史 slug 继续保护）。
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), language: 'zh', resolvedLanguage: 'zh' },
  }),
}))

vi.mock('../../pages/admin/FeeRatePage', () => ({ default: () => <div>fee rate page content</div> }))
vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../components/LoginModal', () => ({ default: () => null }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({
    is_admin: true,
    can_access_admin: true,
    permissions: ['manage_settings'],
    preferred_admin_path: '/dashboard',
  })),
  getStoredUser: () => ({ uid: 1 }),
  hasAdminPermission: () => true,
}))

import App from '../../App'
import { useAuth } from '../../auth-context'
import { RESERVED_PROJECT_SEGMENTS } from '../../project-slug'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')

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

describe('① 路由与侧栏改锚：fee-rate ⇒ exchange（2026-10-24 第①轮：exchange 升为 Tab 模块）', () => {
  it('App.jsx：交易所是壳 + 三条子路由（fee-rate 自带闸 manage_settings、组件仍 FeeRatePage）', () => {
    const app = read('App.jsx')
    expect(app).toContain('<Route path="exchange" element={<ExchangeManagementPage />}>')
    expect(app).toContain(
      '<Route path="fee-rate" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><FeeRatePage /></ProtectedRoute>} />'
    )
    expect(app).toContain("import FeeRatePage from './pages/admin/FeeRatePage'")
    expect(app).toContain("import ExchangeManagementPage from './pages/admin/ExchangeManagementPage'")
    // 旧段（顶层 `fee-rate`）只保留 redirect，不再挂页面：`path="fee-rate"` 的全仓出现点 = 内层子路由 + 旧址 redirect 两处
    expect(app.match(/path="fee-rate"/g)).toHaveLength(2)
    expect(app).toContain('<Route path="fee-rate" element={<Navigate to="/dashboard/exchange" replace />} />')
  })

  it('AdminLayout 侧栏：href = /dashboard/exchange，key 仍 adminNav.feeRate（只改值不改键）', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).toContain("path: '/dashboard/exchange',")
    expect(layout).not.toContain("'/dashboard/fee-rate'")
    expect(layout).toContain("title: t('adminNav.feeRate')")
    expect(layout).toContain("description: t('adminNav.feeRateDesc')")
  })

  it('四语文案值（键集不动）：交易所管理 / 交易所费率与参数', () => {
    expect(zh.adminNav.feeRate).toBe('交易所管理')
    expect(hk.adminNav.feeRate).toBe('交易所管理')
    expect(en.adminNav.feeRate).toBe('Exchange')
    expect(vn.adminNav.feeRate).toBe('Quản lý sàn')
    expect(zh.adminNav.feeRateDesc).toBe('交易所费率与参数')
    expect(hk.adminNav.feeRateDesc).toBe('交易所費率與參數')
    expect(en.adminNav.feeRateDesc).toBe('Exchange fee rate and parameters')
    expect(vn.adminNav.feeRateDesc).toBe('Tỷ lệ phí và tham số sàn')
  })

  it('项目页保留字表不动：fee-rate 与 exchange 仍在（37 段不变）', () => {
    expect(RESERVED_PROJECT_SEGMENTS).toHaveLength(37)
    expect(RESERVED_PROJECT_SEGMENTS).toContain('fee-rate')
    expect(RESERVED_PROJECT_SEGMENTS).toContain('exchange')
  })
})

describe('② 运行时：新路径渲染费率页 + 侧栏链接指向新路径', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
  })

  it('/dashboard/exchange（index）⇒ 落到 fee-rate 子路径渲费率页，侧栏项 href = /dashboard/exchange', async () => {
    renderAt('/dashboard/exchange')

    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/fee-rate'))
    await waitFor(() => expect(screen.getByText('fee rate page content')).toBeInTheDocument())

    const link = await screen.findByRole('link', { name: 'adminNav.feeRate' })
    expect(link).toHaveAttribute('href', '/dashboard/exchange')
    // 旧路径不再挂在侧栏上
    expect(document.querySelector('a[href="/dashboard/fee-rate"]')).toBeNull()
  })

  it('旧 /dashboard/fee-rate 保书签：redirect 到 /dashboard/exchange 再落到 fee-rate 子路径（不再有独立页）', async () => {
    renderAt('/dashboard/fee-rate')

    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/fee-rate'))
    // 页面本体仍是同一个费率面板（redirect 链，不是新页面）
    await waitFor(() => expect(screen.getByText('fee rate page content')).toBeInTheDocument())
  })
})
