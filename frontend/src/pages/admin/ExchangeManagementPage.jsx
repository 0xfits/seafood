import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchAdminAccess, getStoredUser, hasAdminPermission } from '../../admin-utils'

/**
 * 交易所管理（Kevin 2026-10-24 裁定 · 三轮中的第①轮）：`/dashboard/exchange` 由单页改成
 *   **同页 Tab 模块**，三个面板各占一条可直达子路由：
 *
 *   - `/dashboard/exchange`                      ⇒ index 重定向到 `fee-rate`（保旧书签）
 *   - `/dashboard/exchange/fee-rate`            ⇒ `FeeRatePage`（费率），闸 `manage_settings`
 *   - `/dashboard/exchange/currency-review`     ⇒ `CurrencyReviewPage`（币种审核），闸 `review_tasks`
 *   - `/dashboard/exchange/commission-levels`   ⇒ `ReferralWeightMatrixPage`（费率等级 + 权重矩阵），闸 `manage_settings`
 *   - `/dashboard/exchange/currency-status`     ⇒ `CurrencyStatusPage`（币种管理 · 上架 / 冻结 / 下架），闸 `manage_settings`
 *     （第④面：`route-layer.spec` §49.25 / `design-system.spec` §36 `T135`；**与写口同键**）
 *
 * 本组件只是**壳**：页面标题（沿用 `adminNav.feeRate` 键，值 = 交易所管理）+ tab 条 + `<Outlet/>`。
 * 面板内部逻辑零改（各自仍带读写自检与守卫）。
 *
 * 权限口径（裁定硬要求）：
 *   ① **不得在外层统一设闸** —— 闸逐条落在 `App.jsx` 的子路由上（`ProtectedRoute requiredPermission`）；
 *   ② tab 条**只渲染当前用户有权限的那几条**（`fetchAdminAccess` + `hasAdminPermission`，与侧栏同一判据）；
 *      无权限者直接访问无权限的子路径 ⇒ 仍由该子路由自己的 `ProtectedRoute` 拦下（本壳不接管）。
 *
 * tab 形态复用 T130 的公共 chip（`.sf-chip` / 选中态修饰 `.is-active`，`styles.css` 顶层）——
 *   零新增样式、零新增主题 token。
 */

/** tab 真源（顺序 = 展示顺序）：`key` 同时是 `adminNav.*` 的文案键名。 */
const EXCHANGE_TABS = [
  { key: 'feeRate', path: '/dashboard/exchange/fee-rate', permission: 'manage_settings' },
  { key: 'currencyReview', path: '/dashboard/exchange/currency-review', permission: 'review_tasks' },
  { key: 'weightMatrix', path: '/dashboard/exchange/commission-levels', permission: 'manage_settings' },
  { key: 'currencyStatus', path: '/dashboard/exchange/currency-status', permission: 'manage_settings' },
]

const ExchangeManagementPage = () => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  useEffect(() => {
    let cancelled = false
    const loadAccess = async () => {
      const currentUser = getStoredUser()
      if (!currentUser) return
      const nextAccess = await fetchAdminAccess(currentUser)
      if (!cancelled) setAccess(nextAccess)
    }
    loadAccess()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleTabs = useMemo(
    () => EXCHANGE_TABS.filter((tab) => hasAdminPermission(access, tab.permission)),
    [access]
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.feeRate')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('adminNav.feeRateDesc')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('adminNav.feeRate')}>
        {visibleTabs.map((tab) => {
          const active = pathname === tab.path
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              role="tab"
              aria-selected={active}
              data-sf-m={`exchange-tab-${tab.key}`}
              className={() => `sf-chip${active ? ' is-active' : ''}`}
            >
              {t(`adminNav.${tab.key}`)}
            </NavLink>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}

export default ExchangeManagementPage
