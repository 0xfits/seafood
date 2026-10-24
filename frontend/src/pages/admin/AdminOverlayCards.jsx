import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchApiJson, getAuthHeaders, getStoredUser } from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { fetchSiteTextOverlay, OVERLAY_LANGS, ROLE_NAME_KEYS, SITE_TEXT_KEYS } from '../../site-text-overlay'

/**
 * 角色文案 + 站点文案 **两块覆盖层卡**（**搬家件** · Kevin 2026-10-24 批次 A /
 * `route-layer.spec` v2.53 §49.26）。
 *
 * 来历：原站点文案页（P9① · `route-layer.spec` v2.12 §27.2；2026-10-24 已删）
 * （`data-layer.spec` §30.2）的「角色文案」区与「站点文案」区，随站点文案页下线**原样搬到**
 * `/dashboard/settings`（闸 `manage_settings`）。搬迁**不改口径**：
 *   · 读口 = 公开 `GET /api/role-names`（`fetchSiteTextOverlay`；失败 ⇒ `null` ⇒ 回落 locale 基值，**绝不空串**）；
 *   · 写口 = `POST /api/admin/settings` 形态 B `{ key, value, create_key: adminOpsKey(uid,'setting',key) }`，
 *     `key` 逐字为 `role_names` / `site_text_overrides`；
 *   · 四语闭集 / 角色键 / 站点键均取自 `site-text-overlay`（与后端同序），**本文件不新增任何键**。
 */
const LANGS = OVERLAY_LANGS
const ROLES = ROLE_NAME_KEYS
const SITE_KEYS = SITE_TEXT_KEYS
const SITE_LABEL_KEY = {
  siteTitle: 'adminSiteText.labelSiteTitle',
  siteSlogan: 'adminSiteText.labelSiteSlogan',
  slogan: 'adminSiteText.labelSiteSloganLegacy',
}

const useOverlayWriter = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState('')

  const saveKey = async (key, value, successMessage) => {
    const currentUser = getStoredUser()
    const authHeaders = getAuthHeaders(currentUser)
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
    } catch (error) {
      console.error(`Error saving ${key}:`, error)
      toast.error(t('adminSiteText.saveFailed', { message: error.message }))
    } finally {
      setBusy('')
    }
  }

  return { busy, saveKey }
}

/** 角色文案（覆盖层 `role_names`）。 */
export const RoleNamesCard = ({ canManage }) => {
  const { t } = useTranslation()
  const { busy, saveKey } = useOverlayWriter()
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(ROLES.map((r) => [r, '']))]))
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const overlay = await fetchSiteTextOverlay()
      if (cancelled) return
      const next = Object.fromEntries(LANGS.map((l) => [l, {}]))
      for (const lang of LANGS) {
        for (const role of ROLES) {
          const override = overlay && overlay.role_names && overlay.role_names[role] ? overlay.role_names[role][lang] : ''
          next[lang][role] = typeof override === 'string' && override.trim().length ? override : t(`roleNames.${role}`)
        }
      }
      setDraft(next)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    const value = {}
    for (const role of ROLES) {
      value[role] = {}
      for (const lang of LANGS) {
        const text = String(draft[lang][role] || '').trim()
        if (!text) {
          toast.error(t('adminSiteText.saveFailed', { message: t('adminRoleNames.noChanges') }))
          return
        }
        value[role][lang] = text
      }
    }
    await saveKey('role_names', value, t('adminRoleNames.saved'))
  }

  const langLabel = useMemo(() => Object.fromEntries(LANGS.map((l) => [l, l.toUpperCase()])), [])

  return (
    <Card data-sf-m="admin-role-names">
      <CardHeader>
        <CardTitle>{t('adminRoleNames.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{t('adminRoleNames.intro')}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">{t('adminRoleNames.roleField')}</th>
                {LANGS.map((l) => (
                  <th key={l} className="py-2 pr-4">{langLabel[l]}</th>
                ))}
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
                        data-sf-m={`admin-role-name-${role}-${l}`}
                        value={draft[l][role]}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [l]: { ...prev[l], [role]: e.target.value } }))}
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
        <Button variant="primary" disabled={!canManage || busy === 'role_names'} onClick={save}>
          <Save className="w-4 h-4 mr-1" />
          {busy === 'role_names' ? t('adminRoleNames.saving') : t('adminRoleNames.saveButton')}
        </Button>
      </CardContent>
    </Card>
  )
}

/** 站点文案（覆盖层 `site_text_overrides`）。 */
export const SiteTextCard = ({ canManage }) => {
  const { t } = useTranslation()
  const { busy, saveKey } = useOverlayWriter()
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(SITE_KEYS.map((k) => [k, '']))]))
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const overlay = await fetchSiteTextOverlay()
      if (cancelled) return
      const next = Object.fromEntries(LANGS.map((l) => [l, {}]))
      for (const lang of LANGS) {
        for (const key of SITE_KEYS) {
          const override = overlay && overlay.site_text_overrides && overlay.site_text_overrides[key] ? overlay.site_text_overrides[key][lang] : ''
          next[lang][key] = typeof override === 'string' && override.trim().length ? override : t(key)
        }
      }
      setDraft(next)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    const value = {}
    for (const key of SITE_KEYS) {
      value[key] = {}
      for (const lang of LANGS) {
        const text = String(draft[lang][key] || '').trim()
        if (!text) {
          toast.error(t('adminSiteText.saveFailed', { message: t('adminSiteText.saving') }))
          return
        }
        value[key][lang] = text
      }
    }
    await saveKey('site_text_overrides', value, t('adminSiteText.saved'))
  }

  const langLabel = useMemo(() => Object.fromEntries(LANGS.map((l) => [l, l.toUpperCase()])), [])

  return (
    <Card data-sf-m="admin-site-text">
      <CardHeader>
        <CardTitle>{t('adminSiteText.sectionSite')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">{t('adminRoleNames.langField')}</th>
                {LANGS.map((l) => (
                  <th key={l} className="py-2 pr-4">{langLabel[l]}</th>
                ))}
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
                        data-sf-m={`admin-site-text-${key}-${l}`}
                        value={draft[l][key]}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [l]: { ...prev[l], [key]: e.target.value } }))}
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
        <Button variant="primary" disabled={!canManage || busy === 'site_text_overrides'} onClick={save}>
          <Save className="w-4 h-4 mr-1" />
          {busy === 'site_text_overrides' ? t('adminSiteText.saving') : t('adminSiteText.saveSite')}
        </Button>
      </CardContent>
    </Card>
  )
}
