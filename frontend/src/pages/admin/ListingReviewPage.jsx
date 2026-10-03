import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { ShieldCheck, RefreshCw, Check, X, Clock, User, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission,
} from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'

const STATUS_VALUES = ['draft', 'listed', 'delisted', 'frozen']
const STATUS_LABEL_KEY = {
  draft: 'adminListingReview.statusDraft',
  listed: 'adminListingReview.statusListed',
  delisted: 'adminListingReview.statusDelisted',
  frozen: 'adminListingReview.statusFrozen',
}
const TARGET_VALUES = ['delisted', 'frozen']
const TARGET_LABEL_KEY = {
  delisted: 'adminListingReview.targetDelisted',
  frozen: 'adminListingReview.targetFrozen',
}

/**
 * 商品合规审核页（批 8⑤ · 商品合规审核闸）。
 * 数据契约 = `route-layer.spec` v2.10 §25.2 读口 `GET /api/admin/listing` 的 `data`（商品行数组）。
 * 审核动作 = §25.2 动作口 `POST /api/admin/listing/:listingId/takedown`，请求体 `{action, reason, target_status}`。
 * 权限 = `review_tasks`（+ 面板入口 `dashboard_access`）。**页面内不得内嵌任何工程口径**。
 */
const ListingReviewPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [reasons, setReasons] = useState({})
  const [targets, setTargets] = useState({})

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadItems = async () => {
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

      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
      const data = await fetchApiJson(`/api/admin/listing${query}`, {
        headers: getAuthHeaders(currentUser),
      })
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading listing review list:', error)
      toast.error(t('adminListingReview.loadFailed', { message: error.message }))
    } finally {
      setInitialLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await loadItems()
    toast.success(t('adminCommon.refresh'))
    setRefreshing(false)
  }

  const canManage = hasAdminPermission(access, 'review_tasks')
  const reasonOf = (id) => String(reasons[id] || '').trim()
  const targetOf = (id) => targets[id] || 'delisted'

  const decide = async (listingId, action) => {
    const reason = reasonOf(listingId)
    if (!reason) {
      toast.error(t('adminListingReview.reasonRequired'))
      return
    }
    setBusyId(listingId)
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
      await fetchApiJson(`/api/admin/listing/${listingId}/takedown`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          reason,
          target_status: targetOf(listingId),
          create_key: adminOpsKey(currentUser?.uID, 'listing_takedown', listingId),
        }),
      })
      toast.success(action === 'approve' ? t('adminListingReview.approved') : t('adminListingReview.rejected'))
      setReasons((prev) => ({ ...prev, [listingId]: '' }))
      await loadItems()
    } catch (error) {
      console.error('Error recording listing review:', error)
      toast.error(t('adminListingReview.actionFailed', { message: error.message }))
    } finally {
      setBusyId(null)
    }
  }

  const statusLabel = (status) => (STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : status)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminListingReview.title')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminListingReview.intro')}
            {!canManage && ` ${t('adminCommon.readOnlyNotice')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label className="text-gray-600">{t('adminListingReview.filterLabel')}</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
        >
          <option value="">{t('adminListingReview.filterAll')}</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>{statusLabel(value)}</option>
          ))}
        </select>
        <Button variant="ghost" onClick={loadItems}>{t('adminCommon.refresh')}</Button>
      </div>

      {initialLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">{t('adminCommon.loading')}</p>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {t('adminListingReview.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {t('adminListingReview.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">{t('adminListingReview.colId')}</th>
                    <th className="py-2 pr-4">{t('adminListingReview.colTitle')}</th>
                    <th className="py-2 pr-4">{t('adminListingReview.colStatus')}</th>
                    <th className="py-2 pr-4">{t('adminListingReview.colOwner')}</th>
                    <th className="py-2 pr-4">{t('adminListingReview.colCreated')}</th>
                    <th className="py-2 pr-4">{t('adminListingReview.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.listing_id} className="border-b align-top">
                      <td className="py-3 pr-4 font-mono">{row.listing_id}</td>
                      <td className="py-3 pr-4">{row.title}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100">{statusLabel(row.status)}</span>
                      </td>
                      <td className="py-3 pr-4 font-mono flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {row.seller_uid}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {row.time_created ? String(row.time_created) : t('adminCommon.notSet')}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-2 min-w-[16rem]">
                          <label className="text-xs text-gray-500">{t('adminListingReview.targetLabel')}</label>
                          <select
                            value={targetOf(row.listing_id)}
                            onChange={(e) => setTargets((prev) => ({ ...prev, [row.listing_id]: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                          >
                            {TARGET_VALUES.map((value) => (
                              <option key={value} value={value}>{t(TARGET_LABEL_KEY[value])}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={reasons[row.listing_id] || ''}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [row.listing_id]: e.target.value }))}
                            placeholder={t('adminListingReview.reasonPlaceholder')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              disabled={!canManage || busyId === row.listing_id}
                              onClick={() => decide(row.listing_id, 'approve')}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {t('adminListingReview.approve')}
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={!canManage || busyId === row.listing_id}
                              onClick={() => decide(row.listing_id, 'reject')}
                            >
                              <X className="w-4 h-4 mr-1" />
                              {t('adminListingReview.reject')}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {t('adminListingReview.intro')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ListingReviewPage
