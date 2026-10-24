import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Save, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { adminOpsKey } from '../../idempotency'
import { RoleNamesCard, SiteTextCard } from './AdminOverlayCards'

/**
 * 基本设置（Kevin 2026-10-24 裁定 · 三轮中的第②轮：`/dashboard/settings` 重构为**单字段**面板）
 *
 * 语义（本页唯一契约）：
 *  ① **只保留 `siteName` 一个字段**。它是 `system_settings` 里**唯一有真消费方**的键
 *     （`backend-ts/src/messages-service.ts` 读它做 Telegram 通知文案里的站点名）；
 *     而原页面暴露的另外 8 个字段（`siteDescription` / `maintenance` / `allowRegistration` /
 *     `emailNotifications` / `defaultLanguage` / `pointsPerTask` / `maxDailyTasks` /
 *     `rewardCooldown`）在后端**零消费方** ⇒ UI / state / 校验全部删除（i18n 键保留不删，登记孤儿）。
 *  ② 读 = `GET /api/admin/settings`，只取 `siteName`；写 = `POST /api/admin/settings`，
 *     请求体**恰为** `{ siteName }` —— **不发**其它 8 个字段、**不发**全量对象。
 *     后端是**补丁合并**语义（`assertSystemSettingsPatch`：「不补默认值 —— 未给字段在
 *     `saveSystemSettings` 里与现态合流」）⇒ 只发一个键不会清空其它键。
 *  ③ 闸 = `manage_settings`（不变）；成功 / 失败沿用页面既有 toast（承 T126：资金无关设置不强制新造）。
 *
 * ★ `ops:` 幂等键走 **`Idempotency-Key` 请求头**而不是 body：后端 `resolveAdminOpsKey` 的取值优先级是
 *   `body.create_key → body.idempotency_key → Idempotency-Key 头`（三处等价，服务端只校验前缀、不落库）⇒
 *   走头才能让**请求体键集精确为 `['siteName']`**。判据见 `src/test/unit/admin-basic-settings.test.jsx`。
 */
const SystemSettings = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // ★ 待保存值必须与界面语言无关（`t(...)` 只能当标签 / 说明）：初值取空串，落定值一律来自后端读口。
  const [siteName, setSiteName] = useState('')
  const [savedSiteName, setSavedSiteName] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
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
      const data = await fetchApiJson('/api/admin/settings', {
        headers: getAuthHeaders(currentUser),
      })

      // 只认 `siteName`（其余 8 键在本页无 UI ⇒ 不入 state，避免又被发回去）
      const nextSiteName = data && typeof data.siteName === 'string' ? data.siteName : ''
      setSiteName(nextSiteName)
      setSavedSiteName(nextSiteName)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error(t('adminSettings.loadFailed', { message: error.message }))
    } finally {
      setInitialLoading(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const currentUser = getStoredUser()
      const headers = {
        ...getAuthHeaders(currentUser),
        'Content-Type': 'application/json',
        // §2.4 S1 / §9.B B1（DL36）：后台写必须带 `ops:` 幂等键（前缀硬闸，服务端不落库）。
        'Idempotency-Key': adminOpsKey(currentUser?.uID, 'setting', 'system_settings'),
      }
      if (!headers.Authorization) {
        toast.error(t('adminCommon.sessionExpired'))
        navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'))
        return
      }

      // ★ 请求体恰为 `{ siteName }` —— 补丁合并语义，其它键（含全量对象）一律不出现。
      const saved = await fetchApiJson('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ siteName }),
      })

      const nextSiteName = saved && typeof saved.siteName === 'string' ? saved.siteName : siteName
      setSiteName(nextSiteName)
      setSavedSiteName(nextSiteName)
      toast.success(t('adminSettings.saved'))
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(t('adminSettings.saveFailed', { message: error.message }))
    } finally {
      setLoading(false)
    }
  }

  // ── 弃用面下线（P4-B4b-i · §2.4 **S5** / §5.1「一键重置设置」行）──────────────────────
  // `POST /api/admin/settings/reset` 已由后端落为 **`410` + `R107`** ⇒ 前端**零调用**（判据 = §9.B B5）。

  const hasChanges = siteName !== savedSiteName
  const canManageSettings = hasAdminPermission(access, 'manage_settings')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.settings')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminSettings.intro')}
            {!canManageSettings && ` ${t('adminCommon.readOnlyNotice')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={saveSettings} disabled={loading || !hasChanges || !canManageSettings}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? t('adminCommon.saving') : t('adminSettings.saveButton')}
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
            {hasChanges ? t('adminSettings.unsavedChanges') : t('adminSettings.noChanges')}
          </div>

          <div className="grid gap-6">
            <Card data-sf-m="admin-basic-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  {t('adminSettings.cardBasic')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 站点名称 = `siteName`。文案复用既有四语键 `adminSiteText.labelSiteTitle`
                    （zh「站点名称」/ hk「站點名稱」/ en「Site name」/ vn「Tên trang」）⇒ 零新增键、零计数前推。 */}
                <div>
                  <label htmlFor="admin-setting-site-name" className="block text-sm font-medium mb-2">
                    {t('adminSiteText.labelSiteTitle')}
                  </label>
                  <input
                    id="admin-setting-site-name"
                    data-sf-m="admin-setting-site-name"
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Kevin 2026-10-24 批次 A（`route-layer.spec` v2.53 §49.26）：站点文案页下线
                ⇒ 其中的「角色文案」（`role_names` 覆盖层）与「站点文案」（`site_text_overrides` 覆盖层）
                两块**原样搬入**本页；写口 / 幂等键 / 四语键集一字不动，闸同本页 = `manage_settings`。 */}
            <RoleNamesCard canManage={canManageSettings} />
            <SiteTextCard canManage={canManageSettings} />
          </div>
        </>
      )}
    </div>
  )
}

export default SystemSettings
