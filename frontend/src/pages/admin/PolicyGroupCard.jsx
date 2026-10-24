import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchApiJson, getAuthHeaders, getStoredUser } from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'

/**
 * 数值策略分组卡（**搬家件** · Kevin 2026-10-24 批次 A / `route-layer.spec` v2.53 §49.26）。
 *
 * 来历：原站点文案页（P9① §27.2；2026-10-24 已删）的数值配置区，随
 * 「站点文案」页下线拆成**按归属落到四张页**的三组（任务电量 / 签到两组已删）：
 *   ① `invite_reward_policy` ⇒ **积分页**（`/dashboard/points`）· 闸 `manage_points`
 *   ② `rating_policy`        ⇒ **用户页**（`/dashboard/users`）· 写闸 `manage_settings`（写口同键）
 *   ③ `mint_burn_policy`     ⇒ **电量页**（`/dashboard/power` · 新页）· 闸 `manage_settings`
 *
 * 写口**逐字沿用**原实现（**不得**改口径）：
 *   `POST /api/admin/settings`，形态 B 信封 `{ key, value, create_key: adminOpsKey(uid,'setting',key) }`；
 *   `value` = 该组 `fields` 的**数值对象**（`Number()` 化后逐键写入，非有限数即中止）；
 *   成功后**不重取后端**（原页亦无该组读回口 ⇒ 以契约默认值作初值，行为等价）。
 *
 * 零新增字段 / 零新增策略组 / 零新增 i18n 键：标签一律复用 `adminSiteText.*` 既有四语键。
 */
export const POLICY_INVITE = {
  key: 'invite_reward_policy',
  labelKey: 'adminSiteText.policyInvite',
  fields: ['signupBatt', 'firstTaskUsd', 'rewardLevels'],
  defaults: { signupBatt: 30, firstTaskUsd: 10, rewardLevels: 6 },
}

export const POLICY_RATING = {
  key: 'rating_policy',
  labelKey: 'adminSiteText.policyRating',
  fields: ['storageDecimals', 'displayDecimals', 'defaultStars'],
  defaults: { storageDecimals: 4, displayDecimals: 0, defaultStars: 3 },
}

export const POLICY_MINT_BURN = {
  key: 'mint_burn_policy',
  labelKey: 'adminSiteText.policyMintBurn',
  fields: ['mintBattCost', 'mintFeeUsd', 'burnBttcCost', 'burnFeeUsd', 'burnBattGain'],
  defaults: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 },
}

const PolicyGroupCard = ({ group, canManage, readOnlyNotice = false }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState({ ...group.defaults })
  const [busy, setBusy] = useState(false)

  const currentUser = getStoredUser()
  const authHeaders = getAuthHeaders(currentUser)

  const setCell = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }))

  const save = async () => {
    const value = {}
    for (const field of group.fields) {
      const num = Number(draft[field])
      if (!Number.isFinite(num)) {
        toast.error(t('adminSiteText.saveFailed', { message: field }))
        return
      }
      value[field] = num
    }
    setBusy(true)
    try {
      if (!authHeaders.Authorization) {
        toast.error(t('adminCommon.sessionExpired'))
        navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'))
        return
      }
      await fetchApiJson('/api/admin/settings', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: group.key, value, create_key: adminOpsKey(currentUser?.uID, 'setting', group.key) }),
      })
      toast.success(t('adminSiteText.saved'))
    } catch (error) {
      console.error(`Error saving ${group.key}:`, error)
      toast.error(t('adminSiteText.saveFailed', { message: error.message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-sf-m={`admin-policy-${group.key}`}>
      <CardHeader>
        <CardTitle>{t(group.labelKey)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {group.fields.map((field) => (
            <label key={field} className="flex flex-col text-sm">
              <span className="text-gray-600 mb-1">{t(`adminSiteText.${field}`)}</span>
              <input
                type="number"
                data-sf-m={`admin-policy-${group.key}-${field}`}
                value={draft[field]}
                onChange={(e) => setCell(field, e.target.value)}
                disabled={!canManage}
                className="px-2 py-1 border border-gray-300 rounded"
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400">{t('adminSiteText.numbersHint')}</p>
        {/* 控件闸 = 写口闸（`manage_settings`）。无该权限 ⇒ 控件 disabled + 本行只读提示，
            **不隐藏卡片**（页面可见性由各页路由闸决定）；文案复用既有键，零新增 i18n。 */}
        {!canManage && readOnlyNotice && (
          <p data-sf-m={`admin-policy-${group.key}-readonly`} className="text-xs text-gray-500">
            {t('adminCommon.readOnlyNotice')}
          </p>
        )}
        <Button variant="ghost" disabled={!canManage || busy} onClick={save}>
          <Save className="w-4 h-4 mr-1" />
          {busy ? t('adminSiteText.saving') : t('adminSiteText.saveNumbers')}
        </Button>
      </CardContent>
    </Card>
  )
}

export default PolicyGroupCard
