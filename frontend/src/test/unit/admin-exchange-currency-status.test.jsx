/**
 * 交易所管理第 4 个 tab「币种管理」（`/dashboard/exchange/currency-status`，闸 `manage_settings`）
 *
 * 契约（逐条钉死）：
 *  A. 路由与 tab：`App.jsx` 子路由挂 `ProtectedRoute requiredPermission="manage_settings"`；
 *     `EXCHANGE_TABS` 第 4 项 = `currencyStatus`；**按权限过滤**沿用既有机制
 *     （只有 `review_tasks` ⇒ 本 tab 不可见；只有 `manage_settings` ⇒ 可见）；
 *  B. 面板：读 `GET /api/admin/currency/status`（`data` = 4 键行数组）；
 *     列 = cid / 符号 / 状态 / 上线时间（`listed_at` 空 ⇒ `—`）；**状态列直接读 `status`**；
 *  C. 行操作按状态机：`draft → [delisted]`（`T135-b`：上市走建币审核，本页不渲）/ `listed → [frozen, delisted]` /
 *     `frozen → [listed, delisted]` / `delisted → []`；`$`（cid = 1）行**零按钮**；
 *  D. 危险动作（冻结 / 下架）二次确认：**未确认不发请求**；
 *  E. 提交体恰 `{status, create_key}`（`memo` 留空 ⇒ 不带该键），`create_key` 形如
 *     `ops:<uid>:currency_status:<cid>:<to>`；
 *  F. 成功 ⇒ 默认 toast + 重拉列表；失败 ⇒ 列表上方内联（按 `details.reason` 人话映射），**不弹错误 toast**；
 *  G. i18n：状态词复用现役 `adminCurrencyReview.status*`，本单新增键 ≤10 且四语齐备。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), language: 'zh', resolvedLanguage: 'zh' },
  }),
}))

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

// 权限 / 请求真源（与 `admin-utils` 同名同形，可控）
const STATE = vi.hoisted(() => ({
  access: { is_admin: false, can_access_admin: true, permissions: [], preferred_admin_path: '/dashboard' },
  fetch: null,
}))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => STATE.access),
  getStoredUser: () => ({ uID: '7' }),
  getAuthHeaders: () => ({ Authorization: 'Bearer probe-token' }),
  fetchApiJson: (...args) => STATE.fetch(...args),
  hasAdminPermission: (access, permission) => {
    if (!access) return false
    if (access.is_admin) return true
    if (!permission) return Boolean(access.can_access_admin)
    if (Array.isArray(permission)) return permission.some((item) => (access.permissions || []).includes(item))
    return (access.permissions || []).includes(permission)
  },
}))

// 其余三面板打桩（避免连带拉它们的接口）；本面板走真实现
vi.mock('../../pages/admin/FeeRatePage', () => ({ default: () => <div>fee rate panel</div> }))
vi.mock('../../pages/admin/CurrencyReviewPage', () => ({ default: () => <div>currency review panel</div> }))
vi.mock('../../pages/admin/ReferralWeightMatrixPage', () => ({ default: () => <div>weight matrix panel</div> }))
vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../components/LoginModal', () => ({ default: () => null }))

import App from '../../App'
import CurrencyStatusPage, { actionsForRow } from '../../pages/admin/CurrencyStatusPage'
import { useAuth } from '../../auth-context'
import toast from 'react-hot-toast'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')

const LIST_URL = '/api/admin/currency/status'

/** 夹具：四态 + `$`；`listed_at` 覆盖「有值 / null」两档。 */
const ROWS = [
  { cid: '1', symbol: '$', status: 'listed', listed_at: '2026-01-01 00:00:00' },
  { cid: '3', symbol: 'AAA', status: 'listed', listed_at: '2026-10-01 08:00:00' },
  { cid: '5', symbol: 'BBB', status: 'frozen', listed_at: '2026-10-02 08:00:00' },
  { cid: '7', symbol: 'CCC', status: 'draft', listed_at: null },
  { cid: '9', symbol: 'DDD', status: 'delisted', listed_at: '2026-10-03 08:00:00' },
]

const setAccess = (permissions) => {
  STATE.access = { is_admin: false, can_access_admin: true, permissions, preferred_admin_path: '/dashboard' }
}

/** 默认桩：GET 列表 ⇒ 夹具；POST ⇒ 成功回执。各用例可改写。 */
const installFetch = (overrides = {}) => {
  STATE.fetch = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET'
    if (method === 'GET' && url === LIST_URL) return ROWS
    if (method === 'POST' && url.startsWith('/api/admin/currency/')) {
      return { cid: url.split('/')[4], from_status: 'listed', status: 'frozen', cancelled_orders: 1, deposit_action: 'none' }
    }
    throw new Error(`unexpected request ${method} ${url}`)
  })
  if (overrides.fetch) STATE.fetch = overrides.fetch
  return STATE.fetch
}

const apiError = (props) => Object.assign(new Error(props.message || 'request failed'), props)

const renderPanel = async () => {
  const utils = render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CurrencyStatusPage />
    </MemoryRouter>
  )
  await waitFor(() => expect(document.querySelectorAll('[data-sf-m="currency-status-row"]').length).toBe(ROWS.length))
  return utils
}

const rowOf = (cid) => document.querySelector(`[data-sf-m="currency-status-row"][data-cid="${cid}"]`)
const buttonsOf = (cid) =>
  Array.from(rowOf(cid).querySelectorAll('button')).map((b) => b.getAttribute('data-sf-m'))

const renderAppAt = (p) =>
  render(
    <MemoryRouter initialEntries={[p]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>
  )

describe('① 静态钉死：子路由 / 闸 / tab 真源', () => {
  it('App.jsx：第 4 条子路由 currency-status 挂 manage_settings 闸', () => {
    const app = read('App.jsx')
    expect(app).toContain("import CurrencyStatusPage from './pages/admin/CurrencyStatusPage'")
    expect(app).toContain(
      '<Route path="currency-status" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><CurrencyStatusPage /></ProtectedRoute>} />'
    )
    // index 仍重定向 fee-rate（未动）
    expect(app).toContain('<Route index element={<Navigate to="fee-rate" replace />} />')
  })

  it('壳：EXCHANGE_TABS 第 4 项 = currencyStatus（manage_settings），前三项未动', () => {
    const shell = read('pages/admin/ExchangeManagementPage.jsx')
    const tabs = shell.match(/\{ key: '(\w+)', path: '([^']+)', permission: '(\w+)' \}/g)
    expect(tabs).toEqual([
      "{ key: 'feeRate', path: '/dashboard/exchange/fee-rate', permission: 'manage_settings' }",
      "{ key: 'currencyReview', path: '/dashboard/exchange/currency-review', permission: 'review_tasks' }",
      "{ key: 'weightMatrix', path: '/dashboard/exchange/commission-levels', permission: 'manage_settings' }",
      "{ key: 'currencyStatus', path: '/dashboard/exchange/currency-status', permission: 'manage_settings' }",
    ])
    // 权限过滤仍走既有机制（不新造）
    expect(shell).toContain('hasAdminPermission(access, tab.permission)')
  })

  it('i18n：新增键 ≤10、四语齐备、状态词复用现役 adminCurrencyReview.*', () => {
    const locales = { zh, en, hk, vn }
    const nsKeys = Object.keys(zh.adminCurrencyStatus)
    expect(nsKeys.length + 1).toBeLessThanOrEqual(10) // + adminNav.currencyStatus
    for (const [lang, table] of Object.entries(locales)) {
      expect(table.adminNav.currencyStatus, lang).toBeTruthy()
      expect(Object.keys(table.adminCurrencyStatus).sort(), lang).toEqual(nsKeys.sort())
      for (const key of nsKeys) expect(String(table.adminCurrencyStatus[key]).trim().length, `${lang}.${key}`).toBeGreaterThan(0)
    }
    // 四态词条不另造：复用现役键
    const src = read('pages/admin/CurrencyStatusPage.jsx')
    for (const key of ['statusDraft', 'statusListed', 'statusFrozen', 'statusDelisted']) {
      expect(src).toContain(`adminCurrencyReview.${key}`)
    }
    expect(src).not.toMatch(/statusLabel\.(draft|listed|frozen|delisted)/)
    // 四语互异（真翻译）
    expect(new Set(Object.values(locales).map((l) => l.adminNav.currencyStatus)).size).toBe(4)
  })
})

describe('② 状态机（纯函数）+ 运行时按钮矩阵', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccess(['manage_settings'])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
    installFetch()
  })

  it('actionsForRow：四态逐格 + `$` 恒空', () => {
    // `T135-b`：`draft` 不渲「上市」（后端 `LISTING_REQUIRES_FEE_PATH` 恒 409）⇒ 仅「下架」
    expect(actionsForRow({ cid: '7', status: 'draft' })).toEqual(['delisted'])
    expect(actionsForRow({ cid: '3', status: 'listed' })).toEqual(['frozen', 'delisted'])
    expect(actionsForRow({ cid: '5', status: 'frozen' })).toEqual(['listed', 'delisted'])
    expect(actionsForRow({ cid: '9', status: 'delisted' })).toEqual([])
    expect(actionsForRow({ cid: '1', status: 'listed' })).toEqual([])
    expect(actionsForRow({ cid: '11', status: 'unknown' })).toEqual([])
  })

  it('运行时：逐行按钮集 = 状态机可达集（不可达**不渲染**，不是灰按钮）', async () => {
    await renderPanel()
    expect(buttonsOf('7')).toEqual(['currency-status-action-delisted'])
    expect(rowOf('7').querySelector('[data-sf-m="currency-status-draft-hint"]')).not.toBeNull()
    expect(rowOf('3').querySelector('[data-sf-m="currency-status-draft-hint"]')).toBeNull()
    expect(buttonsOf('3')).toEqual(['currency-status-action-frozen', 'currency-status-action-delisted'])
    expect(buttonsOf('5')).toEqual(['currency-status-action-listed', 'currency-status-action-delisted'])
    // 终态：零按钮（无操作）
    expect(buttonsOf('9')).toEqual([])
    expect(rowOf('9').querySelector('[data-sf-m="currency-status-final"]')).not.toBeNull()
    // 灰度断言：全场没有 disabled 的「不可达」按钮假占位
    const all = Array.from(document.querySelectorAll('[data-sf-m^="currency-status-action-"]'))
    expect(all.filter((b) => b.hasAttribute('data-cid') && b.getAttribute('data-cid') === '9')).toHaveLength(0)
  })

  it('`$`（cid = 1）行：零按钮 / 零可点控件 + 禁用提示在场', async () => {
    await renderPanel()
    const row = rowOf('1')
    expect(buttonsOf('1')).toEqual([])
    expect(row.querySelectorAll('a')).toHaveLength(0)
    expect(row.querySelectorAll('[role="button"]')).toHaveLength(0)
    const locked = row.querySelector('[data-sf-m="currency-status-locked"]')
    expect(locked).not.toBeNull()
    expect(locked.getAttribute('title')).toBe('adminCurrencyStatus.locked')
  })

  it('列恰 4 + 操作列；状态列直读 `status`；`listed_at` 空 ⇒ `—`', async () => {
    await renderPanel()
    const headers = Array.from(document.querySelectorAll('.sf-curstatus-table thead th')).map((th) => th.textContent.trim())
    expect(headers).toEqual([
      'adminCurrencyReview.colId',
      'adminCurrencyReview.colSymbol',
      'adminCurrencyReview.colStatus',
      'adminCurrencyStatus.colListedAt',
      'adminCommon.colActions',
    ])
    // 状态列：data-status === 行 status 原值（零派生）
    const statusCell = rowOf('5').querySelector('[data-sf-m="currency-status-status"]')
    expect(statusCell.getAttribute('data-status')).toBe('frozen')
    expect(statusCell.textContent.trim()).toBe('adminCurrencyReview.statusFrozen')
    // 行 data-status 亦为原值
    expect(rowOf('7').getAttribute('data-status')).toBe('draft')
    // listed_at = null ⇒ `—`（不得空白、不得用 time_created 顶替）
    expect(within(rowOf('7')).getByText('—')).toBeTruthy()
    expect(within(rowOf('3')).getByText('2026-10-01 08:00:00')).toBeTruthy()
  })
})

describe('③ 二次确认（危险动作）与请求体', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccess(['manage_settings'])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
    installFetch()
  })

  it('冻结：未确认 ⇒ 不发请求；文案含符号 + 动作', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderPanel()
    rowOf('3').querySelector('[data-sf-m="currency-status-action-frozen"]').click()

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(confirmSpy.mock.calls[0][0]).toBe('adminCurrencyStatus.confirm')
    expect(STATE.fetch.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(0)
    expect(toast.success).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('下架：未确认 ⇒ 不发请求', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderPanel()
    rowOf('3').querySelector('[data-sf-m="currency-status-action-delisted"]').click()
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(STATE.fetch.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(0)
    confirmSpy.mockRestore()
  })

  it('解冻（frozen → listed）不套确认层：直接提交', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    await renderPanel()
    rowOf('5').querySelector('[data-sf-m="currency-status-action-listed"]').click()
    await waitFor(() => expect(STATE.fetch.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1))
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('确认后：URL = /api/admin/currency/<cid>/status；体恰 {status, create_key}（无 memo）', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderPanel()
    rowOf('3').querySelector('[data-sf-m="currency-status-action-frozen"]').click()

    await waitFor(() => expect(STATE.fetch.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1))
    const [url, options] = STATE.fetch.mock.calls.find((c) => c[1]?.method === 'POST')
    expect(url).toBe('/api/admin/currency/3/status')
    const body = JSON.parse(options.body)
    expect(Object.keys(body).sort()).toEqual(['create_key', 'status'])
    expect(body.status).toBe('frozen')
    expect(body.create_key).toBe('ops:7:currency_status:3:frozen')
    expect('memo' in body).toBe(false)
    confirmSpy.mockRestore()
  })

  it('下架：create_key 末段 = 目标状态（同形 ops:<uid>:currency_status:<cid>:<to>）', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderPanel()
    rowOf('7').querySelector('[data-sf-m="currency-status-action-delisted"]').click()
    await waitFor(() => expect(STATE.fetch.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1))
    const [, options] = STATE.fetch.mock.calls.find((c) => c[1]?.method === 'POST')
    expect(JSON.parse(options.body)).toEqual({
      status: 'delisted',
      create_key: 'ops:7:currency_status:7:delisted',
    })
    confirmSpy.mockRestore()
  })
})

describe('④ 成功 / 失败口径', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccess(['manage_settings'])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
  })

  it('成功 ⇒ 默认 toast（非 error）+ 重拉列表（GET 次数 2）', async () => {
    const fetchMock = installFetch()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderPanel()
    const before = fetchMock.mock.calls.filter((c) => (c[1]?.method || 'GET') === 'GET').length

    rowOf('3').querySelector('[data-sf-m="currency-status-action-frozen"]').click()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('adminCurrencyStatus.done'))
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter((c) => (c[1]?.method || 'GET') === 'GET').length).toBe(before + 1)
    )
    expect(toast.error).not.toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  const CASES = [
    {
      name: 'ACTIVE_ORDERS_REMAIN',
      error: () => apiError({ status: 409, code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { reason: 'ACTIVE_ORDERS_REMAIN', cid: '3' } }),
      expectText: 'adminCurrencyStatus.reasonActiveOrders',
    },
    {
      name: 'LISTING_REQUIRES_FEE_PATH',
      error: () => apiError({ status: 409, code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { reason: 'LISTING_REQUIRES_FEE_PATH', cid: '7' } }),
      expectText: 'adminCurrencyStatus.reasonFeePath',
    },
    {
      name: 'SYSTEM_CURRENCY_IMMUTABLE',
      error: () => apiError({ status: 409, code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { reason: 'SYSTEM_CURRENCY_IMMUTABLE', cid: '1' } }),
      expectText: 'adminCurrencyStatus.locked',
    },
    {
      name: 'LEDGER_CURRENCY_INVALID_TRANSITION',
      error: () => apiError({ status: 409, code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { reason: 'LEDGER_CURRENCY_INVALID_TRANSITION', cid: '9' } }),
      expectText: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    },
    {
      name: '权限类（403）',
      error: () => apiError({ status: 403, code: 'AUTH_PERMISSION_NOT_GRANTED', details: { reason: 'PERMISSION_NOT_GRANTED' } }),
      expectText: 'adminCommon.noAdminAccess',
    },
  ]

  for (const item of CASES) {
    it(`失败 ${item.name} ⇒ 列表上方内联文案（data-reason 可核），不弹错误 toast`, async () => {
      let calls = 0
      STATE.fetch = vi.fn(async (url, options = {}) => {
        const method = options.method || 'GET'
        if (method === 'GET' && url === LIST_URL) return ROWS
        calls += 1
        throw item.error()
      })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      await renderPanel()

      const target = rowOf('3').querySelector('[data-sf-m="currency-status-action-frozen"]')
      target.click()

      const banner = await waitFor(() => {
        const el = document.querySelector('[data-sf-m="currency-status-error"]')
        expect(el).not.toBeNull()
        return el
      })
      expect(calls).toBeGreaterThan(0)
      expect(banner.textContent).toContain(item.expectText)
      expect(banner.getAttribute('role')).toBe('alert')
      expect(banner.getAttribute('data-cid')).toBe('3')
      expect(toast.error).not.toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
      window.confirm.mockRestore()
    })
  }
})

describe('⑤ tab 权限过滤（运行时，兼容既有机制）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uid: 1 } })
    installFetch()
  })

  it('只有 review_tasks ⇒ 本 tab 不可见（仅 1 条 tab）', async () => {
    setAccess(['review_tasks'])
    renderAppAt('/dashboard/exchange/currency-review')
    await waitFor(() => expect(screen.getByText('currency review panel')).toBeInTheDocument())
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(document.querySelector('a[href="/dashboard/exchange/currency-status"]')).toBeNull()
  })

  it('只有 manage_settings ⇒ 本 tab 可见（3 条：fee-rate / commission-levels / currency-status）', async () => {
    setAccess(['manage_settings'])
    renderAppAt('/dashboard/exchange/currency-status')
    await waitFor(() =>
      expect(
        screen.getAllByRole('tab').map((tab) => tab.getAttribute('href'))
      ).toEqual([
        '/dashboard/exchange/fee-rate',
        '/dashboard/exchange/commission-levels',
        '/dashboard/exchange/currency-status',
      ])
    )
    // 面板真渲染（真接口桩）
    await waitFor(() => expect(document.querySelectorAll('[data-sf-m="currency-status-row"]').length).toBe(ROWS.length))
  })

  it('全权限 ⇒ 四 tab 顺序 = 费率 / 单位审核 / 权重矩阵 / 币种管理', async () => {
    setAccess(['manage_settings', 'review_tasks'])
    renderAppAt('/dashboard/exchange/fee-rate')
    await waitFor(() =>
      expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('href'))).toEqual([
        '/dashboard/exchange/fee-rate',
        '/dashboard/exchange/currency-review',
        '/dashboard/exchange/commission-levels',
        '/dashboard/exchange/currency-status',
      ])
    )
  })

  it('无 manage_settings 的用户直达本子路径 ⇒ 由本子路由自己的闸拦下（壳不接管）', async () => {
    setAccess(['review_tasks'])
    renderAppAt('/dashboard/exchange/currency-status')
    await waitFor(() => expect(document.querySelectorAll('[data-sf-m="currency-status-row"]').length).toBe(0))
    expect(document.querySelector('[data-sf-m="currency-status-panel"]')).toBeNull()
  })
})
