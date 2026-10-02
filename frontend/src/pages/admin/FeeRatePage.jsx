import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Percent, Save, RefreshCw, Clock, User, Hash, Sigma } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission,
} from '../../admin-utils'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'

// 写口守卫的**逐字镜像**（真源 = `backend-ts/src/commission.ts:175-191`）：
//   `fee_rate_bp ∈ [100, 500]` / `levels ∈ [1, 10]` / `weights_bp.length === levels` /
//   逐元素非负整数 / `Σ weights_bp <= 10000` / `Σ = 0` ⇒ 拒 / `weights_bp[0] = 0` ⇒ 拒。
//   前端**不得自造范围**（spec §19.5(a)/(b)）—— 这里只是把**被服务端接受**的取值提前拦一次，
//   真值是服务端守卫；此处任何数字都不得与守卫分叉。
const FEE_RATE_MIN = 100
const FEE_RATE_MAX = 500
const LEVELS_MIN = 1
const LEVELS_MAX = 10
const WEIGHTS_SUM_MAX = 10000

/**
 * 费率页（8② · 费率配置）。
 * 数据契约 = `route-layer.spec` v2.4 §19.5(a)：字段读取口 `GET /api/admin/commission_policy` 的
 * `data`（形态 A = 现行政策本体 8 键）；保存走**唯一**写口。
 * **不在页面内嵌任何经济数值**：数值一律运行时从读口取（§19.5）。
 */
const FeeRatePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [policy, setPolicy] = useState(null)
  const [feeRateBp, setFeeRateBp] = useState('')
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadPolicy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emptyPolicy = () => ({
    policy_id: '',
    fee_rate_bp: FEE_RATE_MIN,
    levels: LEVELS_MIN,
    weights_bp: [],
    effective_from: '',
    created_by: '',
    time_created: '',
    weights_sum_bp: 0,
  })

  const loadPolicy = async () => {
    try {
      setInitialLoading(true)
      const currentUser = getStoredUser()
      if (!currentUser) {
        throw new Error(t('adminCommon.notLoggedIn'))
      }
      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) {
        throw new Error(t('adminCommon.noAdminAccess'))
      }
      setAccess(accessInfo)

      const data = await fetchApiJson('/api/admin/commission_policy', {
        headers: getAuthHeaders(currentUser),
      })
      const normalized = { ...emptyPolicy(), ...data }
      setPolicy(normalized)
      setFeeRateBp(String(normalized.fee_rate_bp))
    } catch (error) {
      console.error('Error loading commission policy:', error)
      toast.error(t('adminFeeRate.loadFailed', { message: error.message }))
    } finally {
      setInitialLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await loadPolicy()
    toast.success(t('adminCommon.refresh'))
    setRefreshing(false)
  }

  const feeRateValue = Number(feeRateBp)
  const feeRateValid = Number.isInteger(feeRateValue)
    && feeRateValue >= FEE_RATE_MIN && feeRateValue <= FEE_RATE_MAX
  const hasChanges = Boolean(policy) && String(policy.fee_rate_bp) !== String(feeRateBp)
  const canManage = hasAdminPermission(access, 'manage_settings')

  const saveFeeRate = async () => {
    if (!feeRateValid) {
      toast.error(t('adminFeeRate.invalidFeeRate', { min: FEE_RATE_MIN / 100, max: FEE_RATE_MAX / 100 }))
      return
    }
    setLoading(true)
    try {
      const currentUser = getStoredUser()
      const headers = {
        ...getAuthHeaders(currentUser),
        'Content-Type': 'application/json',
      }
      if (!headers.Authorization) {
        toast.error(t('adminCommon.sessionExpired'))
        navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'))
        return
      }
      // 唯一写口（本页与权重矩阵页共用同一条政策行）：改费率时**原样带上**现行层数 / 权重，
      // 以免把矩阵面连带改掉；生效时刻交由服务端（当前生效）。
      const saved = await fetchApiJson('/api/admin/commission_policy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fee_rate_bp: feeRateValue,
          levels: Number(policy.levels),
          weights_bp: (policy.weights_bp || []).map((w) => Number(w)),
        }),
      })
      const normalized = { ...emptyPolicy(), ...saved }
      setPolicy(normalized)
      setFeeRateBp(String(normalized.fee_rate_bp))
      toast.success(t('adminFeeRate.saved'))
    } catch (error) {
      console.error('Error saving fee rate:', error)
      toast.error(t('adminFeeRate.saveFailed', { message: error.message }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.feeRate')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminFeeRate.intro')}
            {!canManage && ` ${t('adminCommon.readOnlyNotice')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
          <Button variant="primary" onClick={saveFeeRate} disabled={loading || !hasChanges || !canManage}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? t('adminCommon.saving') : t('adminFeeRate.saveButton')}
          </Button>
        </div>
      </div>

      {initialLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">{t('adminCommon.loading')}</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-600">
            {hasChanges ? t('adminFeeRate.unsavedChanges') : t('adminFeeRate.noChanges')}
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  {t('adminFeeRate.cardCurrent')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('adminFeeRate.labelFeeRate')}</label>
                  <input
                    type="number"
                    value={feeRateBp}
                    onChange={(e) => setFeeRateBp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('adminFeeRate.rangeHint', {
                      min: FEE_RATE_MIN / 100,
                      max: FEE_RATE_MAX / 100,
                    })}
                  </p>
                </div>
                <div className="text-sm text-gray-700">
                  {t('adminFeeRate.percentPreview', {
                    value: Number.isFinite(feeRateValue) ? (feeRateValue / 100).toFixed(2) : '—',
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sigma className="w-5 h-5" />
                  {t('adminFeeRate.cardAudit')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Hash className="w-4 h-4" />{t('adminFeeRate.labelPolicyId')}
                  </span>
                  <span className="font-mono">{policy?.policy_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Clock className="w-4 h-4" />{t('adminFeeRate.labelEffectiveFrom')}
                  </span>
                  <span className="font-mono">{policy?.effective_from}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <User className="w-4 h-4" />{t('adminFeeRate.labelCreatedBy')}
                  </span>
                  <span className="font-mono">{policy?.created_by}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Clock className="w-4 h-4" />{t('adminFeeRate.labelTimeCreated')}
                  </span>
                  <span className="font-mono">{policy?.time_created}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Sigma className="w-4 h-4" />{t('adminFeeRate.labelWeightsSum')}
                  </span>
                  <span className="font-mono">{policy?.weights_sum_bp}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default FeeRatePage
