import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Layers, Save, RefreshCw, Sigma, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission,
} from '../../admin-utils'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'

// 同费率页：写口守卫的逐字镜像（真源 = `backend-ts/src/commission.ts:175-191`）；不得自造范围。
const FEE_RATE_MIN = 100
const LEVELS_MIN = 1
const LEVELS_MAX = 10
const WEIGHTS_SUM_MAX = 10000

/**
 * 返佣权重矩阵页（8② · 权重矩阵）。
 * 数据契约 = `route-layer.spec` v2.4 §19.5(b)：`levels` = 行数 / 逐层权重 = 每行权重单元格 /
 * `weights_sum_bp` = Σ 校验显示；**归一化分母 = 页面预演、不是存储值**。
 * 保存走**与费率页同一条**写口（`levels` / 权重 / 费率同属一行政策）—— 「合片」的结构依据。
 * **不在页面内嵌任何权重数值**：初值一律运行时从读口取（§19.5）。
 */
const ReferralWeightMatrixPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [policy, setPolicy] = useState(null)
  const [feeRateBp, setFeeRateBp] = useState('')
  const [levels, setLevels] = useState(LEVELS_MIN)
  const [weights, setWeights] = useState([])
  const [savedSignature, setSavedSignature] = useState('')
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadPolicy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signatureOf = (lv, ws) => JSON.stringify({ lv: Number(lv), ws: (ws || []).map(Number) })

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
      const lv = Number(data?.levels) || LEVELS_MIN
      const ws = (data?.weights_bp || []).map((w) => Number(w))
      setPolicy(data || null)
      setFeeRateBp(String(data?.fee_rate_bp ?? ''))
      setLevels(lv)
      setWeights(ws)
      setSavedSignature(signatureOf(lv, ws))
    } catch (error) {
      console.error('Error loading weight matrix:', error)
      toast.error(t('adminWeightMatrix.loadFailed', { message: error.message }))
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

  const resizeLevels = (nextLevels) => {
    const lv = Number(nextLevels)
    setLevels(lv)
    if (!Number.isInteger(lv) || lv < LEVELS_MIN || lv > LEVELS_MAX) return
    setWeights((prev) => {
      const next = prev.slice(0, lv)
      while (next.length < lv) next.push(0)
      return next
    })
  }

  const setWeightAt = (index, value) => {
    setWeights((prev) => {
      const next = [...prev]
      next[index] = value === '' ? '' : Number(value)
      return next
    })
  }

  const numericWeights = weights.map((w) => (w === '' ? NaN : Number(w)))
  const sumBp = numericWeights.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0)
  const allIntegers = numericWeights.length === Number(levels)
    && numericWeights.every((w) => Number.isInteger(w) && w >= 0)
  const sumValid = allIntegers && sumBp > 0 && sumBp <= WEIGHTS_SUM_MAX
  const firstPositive = numericWeights.length > 0 && numericWeights[0] > 0
  const shapeValid = allIntegers
    && Number.isInteger(Number(levels))
    && Number(levels) >= LEVELS_MIN && Number(levels) <= LEVELS_MAX
  const valid = shapeValid && sumValid && firstPositive
  const hasChanges = savedSignature !== signatureOf(levels, weights)
  const canManage = hasAdminPermission(access, 'manage_settings')

  const saveMatrix = async () => {
    if (!valid) {
      toast.error(t('adminWeightMatrix.invalidMatrix'))
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
      // 唯一写口（与费率页共用）：改矩阵时**原样带上**现行费率，避免连带改掉费率面。
      const saved = await fetchApiJson('/api/admin/commission_policy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fee_rate_bp: Number(feeRateBp),
          levels: Number(levels),
          weights_bp: numericWeights,
        }),
      })
      const lv = Number(saved?.levels) || LEVELS_MIN
      const ws = (saved?.weights_bp || []).map((w) => Number(w))
      setPolicy(saved || null)
      setFeeRateBp(String(saved?.fee_rate_bp ?? ''))
      setLevels(lv)
      setWeights(ws)
      setSavedSignature(signatureOf(lv, ws))
      toast.success(t('adminWeightMatrix.saved'))
    } catch (error) {
      console.error('Error saving weight matrix:', error)
      toast.error(t('adminWeightMatrix.saveFailed', { message: error.message }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.weightMatrix')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminWeightMatrix.intro')}
            {!canManage && ` ${t('adminCommon.readOnlyNotice')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
          <Button variant="primary" onClick={saveMatrix} disabled={loading || !hasChanges || !canManage || !valid}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? t('adminCommon.saving') : t('adminWeightMatrix.saveButton')}
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
            {hasChanges ? t('adminWeightMatrix.unsavedChanges') : t('adminWeightMatrix.noChanges')}
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  {t('adminWeightMatrix.cardMatrix')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('adminWeightMatrix.labelLevels')}</label>
                  <input
                    type="number"
                    min={LEVELS_MIN}
                    max={LEVELS_MAX}
                    value={levels}
                    onChange={(e) => resizeLevels(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="py-2 pr-4">{t('adminWeightMatrix.colLevel')}</th>
                        <th className="py-2 pr-4">{t('adminWeightMatrix.colWeight')}</th>
                        <th className="py-2 pr-4">{t('adminWeightMatrix.colShare')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weights.map((w, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-medium">{index + 1}</td>
                          <td className="py-2 pr-4">
                            <input
                              type="number"
                              value={w}
                              onChange={(e) => setWeightAt(index, e.target.value)}
                              className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {sumBp > 0 && Number.isFinite(numericWeights[index])
                              ? `${((numericWeights[index] / sumBp) * 100).toFixed(2)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Sigma className="w-4 h-4" />
                  {t('adminWeightMatrix.sumLabel', { value: sumBp, max: WEIGHTS_SUM_MAX })}
                </div>

                {!valid && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    {!shapeValid && t('adminWeightMatrix.invalidShape', { min: LEVELS_MIN, max: LEVELS_MAX })}
                    {shapeValid && !firstPositive && t('adminWeightMatrix.invalidFirst')}
                    {shapeValid && firstPositive && !sumValid && t('adminWeightMatrix.invalidSum', { max: WEIGHTS_SUM_MAX })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sigma className="w-5 h-5" />
                  {t('adminWeightMatrix.cardStored')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('adminWeightMatrix.labelStoredSum')}</span>
                  <span className="font-mono">{policy?.weights_sum_bp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('adminWeightMatrix.labelStoredFeeRate')}</span>
                  <span className="font-mono">{policy?.fee_rate_bp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{t('adminWeightMatrix.labelEffectiveFrom')}</span>
                  <span className="font-mono">{policy?.effective_from}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default ReferralWeightMatrixPage
