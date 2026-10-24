import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Zap, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui'
import { fetchAdminAccess, getStoredUser, hasAdminPermission } from '../../admin-utils'
import PolicyGroupCard, { POLICY_MINT_BURN } from './PolicyGroupCard'

/**
 * 【电量】页（`/dashboard/power` · Kevin 2026-10-24 批次 A / `route-layer.spec` v2.53 §49.26）。
 *
 * 唯一内容 = **铸造与销毁**数值组（`mint_burn_policy`：`mintBattCost` / `mintFeeUsd` /
 * `burnBttcCost` / `burnFeeUsd` / `burnBattGain`）。该组原住站点文案页（已删）的「数值配置」区，随站点文案页下线**原样搬入**：写口、幂等键、字段名、契约默认值一字不动。
 *
 * 闸 = **`manage_settings`**（路由层 `ProtectedRoute requiredPermission="manage_settings"` +
 * 页内 `canManage` 同键，双保险；不新增权限码）。
 * 页面标题 = 「电量」复用既有四语键 `battCard.title`（zh 电量 / en Energy / hk 電量 / vn Năng lượng）
 * ⇒ **零新增 i18n 键**（四语拍平 1453 不变）。
 */
const PowerPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      setInitialLoading(true)
      const currentUser = getStoredUser()
      if (!currentUser) throw new Error(t('adminCommon.notLoggedIn'))
      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) throw new Error(t('adminCommon.noAdminAccess'))
      setAccess(accessInfo)
    } catch (error) {
      console.error('Error loading power policy access:', error)
      toast.error(t('adminSiteText.loadFailed', { message: error.message }))
    } finally {
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canManage = hasAdminPermission(access, 'manage_settings')

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
    toast.success(t('adminCommon.refresh'))
  }

  if (initialLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">{t('adminCommon.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {t('battCard.title')}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminSiteText.intro')}
            {!canManage && ` ${t('adminCommon.readOnlyNotice')}`}
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
        </Button>
      </div>

      <PolicyGroupCard group={POLICY_MINT_BURN} canManage={canManage} />
    </div>
  )
}

export default PowerPage
