/**
 * 交易所管理 Tab 模块 ＋ 两页下架（Kevin 2026-10-24 裁定 · 三轮中的第①轮）
 *
 * 契约（本文件逐条钉死）：
 *  A. `/dashboard/exchange` 是**同页 Tab 模块**：
 *     ① 壳 = `pages/admin/ExchangeManagementPage.jsx`：页面标题（`adminNav.feeRate`）+ tab 条 + `<Outlet/>`；
 *        tab 条复用公共 chip（`.sf-chip` / 选中态 `.is-active`，T130）、`role=tablist/tab` + `aria-selected`；
 *     ② index ⇒ **重定向到 `fee-rate`**；三条可直达子路径各渲对应面板：
 *        `fee-rate`（manage_settings · FeeRatePage）/ `currency-review`（review_tasks · CurrencyReviewPage）/
 *        `commission-levels`（manage_settings · ReferralWeightMatrixPage）；
 *     ③ **闸逐子路由各自设**（外层壳不设闸）；tab 只渲染当前用户有权限的那几条；
 *     ④ 旧地址：`/dashboard/fee-rate ⇒ /dashboard/exchange`、`/dashboard/currency-review ⇒ /dashboard/exchange/currency-review`、
 *        `/dashboard/weight-matrix ⇒ /dashboard/exchange/commission-levels`（`<Navigate replace>`）；
 *     ⑤ 侧栏只留一项「交易所管理」→ `/dashboard/exchange`，weight-matrix / currency-review 两项已删。
 *  B. 两页下架：`ArbitrationReviewPage`（生产 404 死页）/ `PermissionsManagement`（后端仍在、前端删）
 *     ⇒ 页面文件 / 路由 / 侧栏项三处零残留，旧地址落提示页；**后端与 i18n 键一律不动**。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), language: 'zh', resolvedLanguage: 'zh' },
  }),
}))

// 三个面板只验「落在哪个子路由」，内部逻辑各自有专门用例 ⇒ 面板本身打桩
vi.mock('../../pages/admin/FeeRatePage', () => ({ default: () => <div>fee rate panel</div> }))
vi.mock('../../pages/admin/CurrencyReviewPage', () => ({ default: () => <div>currency review panel</div> }))
vi.mock('../../pages/admin/ReferralWeightMatrixPage', () => ({ default: () => <div>weight matrix panel</div> }))
vi.mock('../../pages/admin/CurrencyStatusPage', () => ({ default: () => <div>currency status panel</div> }))

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../components/LoginModal', () => ({ default: () => null }))

// 权限真源（与 `admin-utils.hasAdminPermission` 逐字同构）—— tab 可见性要按真语义判，不能一律 true
const ACCESS = vi.hoisted(() => ({
  current: { is_admin: false, can_access_admin: true, permissions: [], preferred_admin_path: '/dashboard' },
}))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ACCESS.current),
  getStoredUser: () => ({ uid: 1 }),
  hasAdminPermission: (access, permission) => {
    if (!access) return false
    if (access.is_admin) return true
    if (!permission) return Boolean(access.can_access_admin)
    if (Array.isArray(permission)) return permission.some((item) => (access.permissions || []).includes(item))
    return (access.permissions || []).includes(permission)
  },
}))

import App from '../../App'
import { useAuth } from '../../auth-context'
import zh from '../../locales/zh.json'

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

const setAccess = (permissions, extra = {}) => {
  ACCESS.current = {
    is_admin: false,
    can_access_admin: true,
    permissions,
    preferred_admin_path: '/dashboard',
    ...extra,
  }
}

/** 生产代码面（排除 test 目录）逐个文件读源码。 */
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'test') continue
      walk(p, out)
    } else if (/\.(js|jsx)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

describe('① 静态钉死：交易所管理壳 / 三条子路由 / 旧址 redirect', () => {
  it('App.jsx：壳 = ExchangeManagementPage，index 重定向 fee-rate，三条子路由各自带闸', () => {
    const app = read('App.jsx')

    expect(app).toContain("import ExchangeManagementPage from './pages/admin/ExchangeManagementPage'")
    expect(app).toContain('<Route path="exchange" element={<ExchangeManagementPage />}>')
    expect(app).toContain('<Route index element={<Navigate to="fee-rate" replace />} />')

    // 逐子路由的闸（**不得**在壳上挂 ProtectedRoute）
    expect(app).toContain(
      '<Route path="fee-rate" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><FeeRatePage /></ProtectedRoute>} />'
    )
    expect(app).toContain(
      '<Route path="currency-review" element={<ProtectedRoute adminOnly={true} requiredPermission="review_tasks"><CurrencyReviewPage /></ProtectedRoute>} />'
    )
    expect(app).toContain(
      '<Route path="commission-levels" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><ReferralWeightMatrixPage /></ProtectedRoute>} />'
    )
  })

  it('App.jsx：三条旧址 redirect 均在（`<Navigate replace>`）', () => {
    const app = read('App.jsx')
    expect(app).toContain('<Route path="fee-rate" element={<Navigate to="/dashboard/exchange" replace />} />')
    expect(app).toContain(
      '<Route path="currency-review" element={<Navigate to="/dashboard/exchange/currency-review" replace />} />'
    )
    expect(app).toContain(
      '<Route path="weight-matrix" element={<Navigate to="/dashboard/exchange/commission-levels" replace />} />'
    )
  })

  it('壳形态：`.sf-chip` + `.is-active` + role=tablist/tab + aria-selected + `<Outlet/>`', () => {
    const shell = read('pages/admin/ExchangeManagementPage.jsx')
    expect(shell).toContain('sf-chip')
    expect(shell).toContain('is-active')
    expect(shell).toContain('role="tablist"')
    expect(shell).toContain('role="tab"')
    expect(shell).toContain('aria-selected={active}')
    expect(shell).toContain('<Outlet />')
    expect(shell).toContain("t('adminNav.feeRate')")
    // 权限过滤走既有判据（fetchAdminAccess + hasAdminPermission）
    expect(shell).toContain('fetchAdminAccess')
    expect(shell).toContain('hasAdminPermission')
  })
})

describe('② 静态钉死：两页下架零残留（仲裁审核 / 权限管理）', () => {
  it('页面文件已删除（壳文件在场）', () => {
    expect(fs.existsSync(path.join(SRC, 'pages/admin/ArbitrationReviewPage.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/admin/PermissionsManagement.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/admin/ExchangeManagementPage.jsx'))).toBe(true)
  })

  it('App.jsx 零残留（组件名 / 段名 / import）', () => {
    const app = read('App.jsx')
    expect(app).not.toContain('ArbitrationReviewPage')
    expect(app).not.toContain('PermissionsManagement')
    expect(app).not.toMatch(/path="arbitration-review"/)
    expect(app).not.toMatch(/path="permissions"/)
  })

  it('侧栏只留一项「交易所管理」：四项旧入口零残留', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).not.toContain('/dashboard/permissions')
    expect(layout).not.toContain('/dashboard/arbitration-review')
    expect(layout).not.toContain('/dashboard/weight-matrix')
    expect(layout).not.toContain('/dashboard/currency-review')
    expect(layout).not.toContain("t('adminNav.permissions')")
    expect(layout).not.toContain("t('adminNav.weightMatrix')")
    expect(layout).not.toContain("t('adminNav.currencyReview')")
    expect(layout).not.toContain("t('adminNav.arbitrationReview')")
    // 只留一项：`/dashboard/exchange` 在侧栏出现且仅出现一次
    expect(layout.match(/path: '\/dashboard\/exchange',/g)).toHaveLength(1)
  })

  it('全 src（排除 test）无 `/dashboard/arbitration-review` / `/dashboard/permissions` 字面', () => {
    const hits = []
    for (const abs of walk(SRC)) {
      const text = read(path.relative(SRC, abs))
      for (const needle of ['/dashboard/arbitration-review', '/dashboard/permissions']) {
        if (text.includes(needle)) hits.push(`${path.relative(SRC, abs)}|${needle}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('i18n 键保留不删（沿 `dashboard-pages-removed` 先例：只登记孤儿）', () => {
    expect(zh.adminNav.permissions).toBe('权限管理')
    expect(zh.adminNav.arbitrationReview).toBe('招工仲裁')
    expect(zh.adminNav.weightMatrix).toBeTruthy()
    expect(zh.adminNav.currencyReview).toBeTruthy()
  })
})

describe('③ 运行时：三条子路由各自渲出对应面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
    setAccess(['manage_settings', 'review_tasks'])
  })

  it('index ⇒ 重定向到 fee-rate，渲费率面板', async () => {
    renderAt('/dashboard/exchange')
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/fee-rate'))
    await waitFor(() => expect(screen.getByText('fee rate panel')).toBeInTheDocument())
  })

  it('/dashboard/exchange/currency-review ⇒ 币种审核面板', async () => {
    renderAt('/dashboard/exchange/currency-review')
    await waitFor(() => expect(screen.getByText('currency review panel')).toBeInTheDocument())
    expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/currency-review')
  })

  it('/dashboard/exchange/commission-levels ⇒ 权重矩阵面板', async () => {
    renderAt('/dashboard/exchange/commission-levels')
    await waitFor(() => expect(screen.getByText('weight matrix panel')).toBeInTheDocument())
    expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/commission-levels')
  })

  it('tab 条：四条 tab、选中态 = `.is-active` + aria-selected=true（仅当前子路由）', async () => {
    renderAt('/dashboard/exchange/commission-levels')
    const tabs = await screen.findAllByRole('tab')
    expect(tabs).toHaveLength(4) // [exchange-currency-status（2026-10-24）：第 4 项 currency-status 落地 ⇒ 3⇒4]
    for (const tab of tabs) {
      expect(tab.className).toContain('sf-chip')
      expect(tab.getAttribute('aria-selected')).toBe(tab.getAttribute('href') === '/dashboard/exchange/commission-levels' ? 'true' : 'false')
      expect(tab.className.includes('is-active')).toBe(tab.getAttribute('href') === '/dashboard/exchange/commission-levels')
    }
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/dashboard/exchange/fee-rate',
      '/dashboard/exchange/currency-review',
      '/dashboard/exchange/commission-levels',
      '/dashboard/exchange/currency-status',
    ])
  })
})

describe('④ 运行时：tab 只渲染有权限的那几条（闸仍逐子路由各自设）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
  })

  it('只有 review_tasks：只出 currency-review 一条 tab，另两条不在场', async () => {
    setAccess(['review_tasks'])
    renderAt('/dashboard/exchange/currency-review')

    await waitFor(() => expect(screen.getByText('currency review panel')).toBeInTheDocument())
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].getAttribute('href')).toBe('/dashboard/exchange/currency-review')
    expect(document.querySelector('a[href="/dashboard/exchange/fee-rate"]')).toBeNull()
    expect(document.querySelector('a[href="/dashboard/exchange/commission-levels"]')).toBeNull()
  })

  it('只有 manage_settings：出 fee-rate + commission-levels + currency-status 三条，币种审核 tab 不在场', async () => {
    setAccess(['manage_settings'])
    renderAt('/dashboard/exchange/fee-rate')

    await waitFor(() => expect(screen.getByText('fee rate panel')).toBeInTheDocument())
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/dashboard/exchange/fee-rate',
      '/dashboard/exchange/commission-levels',
      '/dashboard/exchange/currency-status',
    ])
    expect(document.querySelector('a[href="/dashboard/exchange/currency-review"]')).toBeNull()
  })

  it('无相应权限该子路由仍由**它自己的**闸拦下（壳不接管）：review_tasks 用户打不开 fee-rate', async () => {
    setAccess(['review_tasks'])
    renderAt('/dashboard/exchange/fee-rate')

    await waitFor(() => expect(screen.queryByText('fee rate panel')).toBeNull())
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).not.toBe('/dashboard/exchange/fee-rate'))
  })
})

describe('⑤ 运行时：旧址 redirect（保书签）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
    setAccess(['manage_settings', 'review_tasks'])
  })

  it('/dashboard/fee-rate ⇒ 两级重定向落 /dashboard/exchange/fee-rate 并渲费率面板', async () => {
    renderAt('/dashboard/fee-rate')
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/fee-rate'))
    await waitFor(() => expect(screen.getByText('fee rate panel')).toBeInTheDocument())
  })

  it('/dashboard/currency-review ⇒ /dashboard/exchange/currency-review', async () => {
    renderAt('/dashboard/currency-review')
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/currency-review'))
    await waitFor(() => expect(screen.getByText('currency review panel')).toBeInTheDocument())
  })

  it('/dashboard/weight-matrix ⇒ /dashboard/exchange/commission-levels', async () => {
    renderAt('/dashboard/weight-matrix')
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/dashboard/exchange/commission-levels'))
    await waitFor(() => expect(screen.getByText('weight matrix panel')).toBeInTheDocument())
  })
})

describe('⑥ 运行时：两页下架后旧地址落提示页（404 形态，不重定向）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
    setAccess(['manage_settings', 'review_tasks', 'manage_permissions'])
  })

  for (const dead of ['/dashboard/arbitration-review', '/dashboard/permissions']) {
    it(`${dead} ⇒ 提示页（pathname 不变、无面板）`, async () => {
      const { container } = renderAt(dead)

      await waitFor(() => expect(container.querySelector('[data-sf-m="not-found-page"]')).not.toBeNull())
      expect(screen.getByTestId('pathname').textContent).toBe(dead)
      expect(screen.queryByText('fee rate panel')).toBeNull()
      expect(screen.queryByText('currency review panel')).toBeNull()
    })
  }
})
