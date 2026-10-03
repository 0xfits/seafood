import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Type, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { fetchSiteTextOverlay, OVERLAY_LANGS, ROLE_NAME_KEYS, SITE_TEXT_KEYS } from '../../site-text-overlay'

/**
 * 站点文案与数值配置页（P9① · `route-layer.spec` v2.12 §27.2 / §26.6）。
 * = 角色文案（`role_names` 覆盖层）+ 站点标语（`site_text_overrides` 覆盖层）+ 数值项（`B1`–`B5` 策略键）。
 * 写口 = 复用 `POST /api/admin/settings`（形态 B 信封 · `ops:<uid>:setting:<键名>`）；权限 = `manage_settings`。
 * 读口（角色 / 标语）= 公开 `GET /api/role-names`；数值键的**读回**归 P9②–⑤（本片无专用读口 ⇒ 以契约默认值初值）。
 * **页面内不得内嵌任何工程口径**（六类禁漏）。
 */
const LANGS = OVERLAY_LANGS
const ROLES = ROLE_NAME_KEYS
const SITE_KEYS = SITE_TEXT_KEYS
const SITE_LABEL_KEY = {
  siteTitle: 'adminSiteText.labelSiteTitle',
  siteSlogan: 'adminSiteText.labelSiteSlogan',
  slogan: 'adminSiteText.labelSiteSloganLegacy',
}

// 数值策略分组 · 字段（键名逐字 = `app_config` 合法键 / 值对象字段名）· 契约默认值（§29.2 / §30 定案）。
const POLICY_GROUPS = [
  { key: 'batt_policy', labelKey: 'adminSiteText.policyBatt', fields: ['taskCostBatt', 'capBatt', 'floorBatt', 'acceptThresholdBatt'], defaults: { taskCostBatt: 9, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 9 } },
  { key: 'checkin_policy', labelKey: 'adminSiteText.policyCheckin', fields: ['baseRewardBatt', 'streakCapDays', 'streakDay7RewardBatt', 'makeupCostUsd', 'makeupDailyLimit'], defaults: { baseRewardBatt: 30, streakCapDays: 7, streakDay7RewardBatt: 60, makeupCostUsd: 100, makeupDailyLimit: 1 } },
  { key: 'invite_reward_policy', labelKey: 'adminSiteText.policyInvite', fields: ['signupBatt', 'firstTaskUsd', 'rewardLevels'], defaults: { signupBatt: 30, firstTaskUsd: 10, rewardLevels: 6 } },
  { key: 'mint_burn_policy', labelKey: 'adminSiteText.policyMintBurn', fields: ['mintBattCost', 'mintFeeUsd', 'burnBttcCost', 'burnFeeUsd', 'burnBattGain'], defaults: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 } },
  { key: 'rating_policy', labelKey: 'adminSiteText.policyRating', fields: ['storageDecimals', 'displayDecimals', 'defaultStars'], defaults: { storageDecimals: 4, displayDecimals: 0, defaultStars: 3 } },
]

const emptyRoleDraft = () => Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(ROLES.map((r) => [r, '']))]))
const emptySiteDraft = () => Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(SITE_KEYS.map((k) => [k, '']))]))
const emptyPolicyDraft = () => Object.fromEntries(POLICY_GROUPS.map((g) => [g.key, { ...g.defaults }]))

const SiteTextPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState('')
  const [roleDraft, setRoleDraft] = useState(emptyRoleDraft)
  const [siteDraft, setSiteDraft] = useState(emptySiteDraft)
  const [policyDraft, setPolicyDraft] = useState(emptyPolicyDraft)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildRoleDraft = (overlay) => {
    const next = emptyRoleDraft()
    for (const lang of LANGS) {
      for (const role of ROLES) {
        const override = overlay && overlay.role_names && overlay.role_names[role] ? overlay.role_names[role][lang] : ''
        next[lang][role] = typeof override === 'string' && override.trim().length ? override : t(`roleNames.${role}`)
      }
    }
    return next
  }

  const buildSiteDraft = (overlay) => {
    const next = emptySiteDraft()
    for (const lang of LANGS) {
      for (const key of SITE_KEYS) {
        const override = overlay && overlay.site_text_overrides && overlay.site_text_overrides[key] ? overlay.site_text_overrides[key][lang] : ''
        next[lang][key] = typeof override === 'string' && override.trim().length ? override : t(key)
      }
    }
    return next
  }

  const load = async () => {
    try {
      setInitialLoading(true)
      const currentUser = getStoredUser()
      if (!currentUser) throw new Error(t('adminCommon.notLoggedIn'))
      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) throw new Error(t('adminCommon.noAdminAccess'))
      setAccess(accessInfo)
      const overlay = await fetchSiteTextOverlay()
      setRoleDraft(buildRoleDraft(overlay))
      setSiteDraft(buildSiteDraft(overlay))
    } catch (error) {
      console.error('Error loading site text overlay:', error)
      toast.error(t('adminSiteText.loadFailed', { message: error.message }))
    } finally {
      setInitialLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await load()
    toast.success(t('adminCommon.refresh'))
    setRefreshing(false)
  }

  const canManage = hasAdminPermission(access, 'manage_settings')

  const currentUser = getStoredUser()
  const authHeaders = getAuthHeaders(currentUser)

  const saveKey = async (key, value, successMessage) => {
    setBusy(key)
    try {
      if (!authHeaders.Authorization) {
        toast.error(t('adminCommon.sessionExpired'))
        navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'))
        return
      }
      await fetchApiJson('/api/admin/settings', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, create_key: adminOpsKey(currentUser?.uID, 'setting', key) }),
      })
      toast.success(successMessage)
      await load()
    } catch (error) {
      console.error(`Error saving ${key}:`, error)
      toast.error(t('adminSiteText.saveFailed', { message: error.message }))
    } finally {
      setBusy('')
    }
  }

  const saveRoleNames = async () => {
    const value = {}
    for (const role of ROLES) {
      value[role] = {}
      for (const lang of LANGS) {
        const text = String(roleDraft[lang][role] || '').trim()
        if (!text) {
          toast.error(t('adminSiteText.saveFailed', { message: t('adminRoleNames.noChanges') }))
          return
        }
        value[role][lang] = text
      }
    }
    await saveKey('role_names', value, t('adminRoleNames.saved'))
  }

  const saveSiteText = async () => {
    const value = {}
    for (const key of SITE_KEYS) {
      value[key] = {}
      for (const lang of LANGS) {
        const text = String(siteDraft[lang][key] || '').trim()
        if (!text) {
          toast.error(t('adminSiteText.saveFailed', { message: t('adminSiteText.saving') }))
          return
        }
        value[key][lang] = text
      }
    }
    await saveKey('site_text_overrides', value, t('adminSiteText.saved'))
  }

  const savePolicy = async (group) => {
    const value = {}
    for (const field of group.fields) {
      const raw = policyDraft[group.key][field]
      const num = Number(raw)
      if (!Number.isFinite(num)) {
        toast.error(t('adminSiteText.saveFailed', { message: field }))
        return
      }
      value[field] = num
    }
    await saveKey(group.key, value, t('adminSiteText.saved'))
  }

  const setRoleCell = (lang, role, v) => setRoleDraft((prev) => ({ ...prev, [lang]: { ...prev[lang], [role]: v } }))
  const setSiteCell = (lang, key, v) => setSiteDraft((prev) => ({ ...prev, [lang]: { ...prev[lang], [key]: v } }))
  const setPolicyCell = (key, field, v) => setPolicyDraft((prev) => ({ ...prev, [key]: { ...prev[key], [field]: v } }))

  const langLabel = useMemo(() => Object.fromEntries(LANGS.map((l) => [l, l.toUpperCase()])), [])

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
          <h2 className="text-2xl font-bold flex items-center gap-2"><Type className="w-5 h-5" />{t('adminSiteText.title')}</h2>
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

      {/* 角色文案（覆盖层 role_names） */}
      <Card>
        <CardHeader><CardTitle>{t('adminRoleNames.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">{t('adminRoleNames.intro')}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">{t('adminRoleNames.roleField')}</th>
                  {LANGS.map((l) => (<th key={l} className="py-2 pr-4">{langLabel[l]}</th>))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role} className="border-b">
                    <td className="py-2 pr-4 font-medium">{t(`roleNames.${role}`)}</td>
                    {LANGS.map((l) => (
                      <td key={l} className="py-2 pr-4">
                        <input
                          type="text"
                          value={roleDraft[l][role]}
                          onChange={(e) => setRoleCell(l, role, e.target.value)}
                          disabled={!canManage}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="primary" disabled={!canManage || busy === 'role_names'} onClick={saveRoleNames}>
            <Save className="w-4 h-4 mr-1" />{busy === 'role_names' ? t('adminRoleNames.saving') : t('adminRoleNames.saveButton')}
          </Button>
        </CardContent>
      </Card>

      {/* 站点标语（覆盖层 site_text_overrides） */}
      <Card>
        <CardHeader><CardTitle>{t('adminSiteText.sectionSite')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">{t('adminRoleNames.langField')}</th>
                  {LANGS.map((l) => (<th key={l} className="py-2 pr-4">{langLabel[l]}</th>))}
                </tr>
              </thead>
              <tbody>
                {SITE_KEYS.map((key) => (
                  <tr key={key} className="border-b">
                    <td className="py-2 pr-4 font-medium">{t(SITE_LABEL_KEY[key])}</td>
                    {LANGS.map((l) => (
                      <td key={l} className="py-2 pr-4">
                        <input
                          type="text"
                          value={siteDraft[l][key]}
                          onChange={(e) => setSiteCell(l, key, e.target.value)}
                          disabled={!canManage}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">{t('adminSiteText.siteLangHint')}</p>
          <Button variant="primary" disabled={!canManage || busy === 'site_text_overrides'} onClick={saveSiteText}>
            <Save className="w-4 h-4 mr-1" />{busy === 'site_text_overrides' ? t('adminSiteText.saving') : t('adminSiteText.saveSite')}
          </Button>
        </CardContent>
      </Card>

      {/* 数值配置（B1–B5 策略键） */}
      <Card>
        <CardHeader><CardTitle>{t('adminSiteText.sectionNumbers')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-400">{t('adminSiteText.numbersHint')}</p>
          {POLICY_GROUPS.map((group) => (
            <div key={group.key} className="border rounded p-3 space-y-2">
              <div className="font-medium">{t(group.labelKey)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.fields.map((field) => (
                  <label key={field} className="flex flex-col text-sm">
                    <span className="text-gray-600 mb-1">{t(`adminSiteText.${field}`)}</span>
                    <input
                      type="number"
                      value={policyDraft[group.key][field]}
                      onChange={(e) => setPolicyCell(group.key, field, e.target.value)}
                      disabled={!canManage}
                      className="px-2 py-1 border border-gray-300 rounded"
                    />
                  </label>
                ))}
              </div>
              <Button variant="ghost" disabled={!canManage || busy === group.key} onClick={() => savePolicy(group)}>
                <Save className="w-4 h-4 mr-1" />{busy === group.key ? t('adminSiteText.saving') : t('adminSiteText.saveNumbers')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default SiteTextPage
