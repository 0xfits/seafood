import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Gavel, RefreshCw, Check, X, Clock, User, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission,
} from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'

const STATUS_VALUES = ['open', 'accepted', 'submitted', 'settled', 'disputed', 'rejected', 'cancelled']
const STATUS_LABEL_KEY = {
  open: 'adminArbitrationReview.statusOpen',
  accepted: 'adminArbitrationReview.statusAccepted',
  submitted: 'adminArbitrationReview.statusSubmitted',
  settled: 'adminArbitrationReview.statusSettled',
  disputed: 'adminArbitrationReview.statusDisputed',
  rejected: 'adminArbitrationReview.statusRejected',
  cancelled: 'adminArbitrationReview.statusCancelled',
}

/**
 * 招工仲裁页（批 8⑤ · 平台仲裁兜底闸）。
 * 数据契约 = `route-layer.spec` v2.10 §25.2 读口 `GET /api/admin/arbitration` 的 `data`（招工行数组）。
 * 仲裁动作 = §25.2 动作口 `POST /api/admin/arbitration/:jobId`，请求体 `{action, reason}`。
 * 权限 = `review_tasks`（+ 面板入口 `dashboard_access`）。**页面内不得内嵌任何工程口径**。
 */
const ArbitrationReviewPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [reasons, setReasons] = useState({})

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
      const data = await fetchApiJson(`/api/admin/arbitration${query}`, {
        headers: getAuthHeaders(currentUser),
      })
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading arbitration list:', error)
      toast.error(t('adminArbitrationReview.loadFailed', { message: error.message }))
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

  const decide = async (jobId, action) => {
    const reason = reasonOf(jobId)
    if (!reason) {
      toast.error(t('adminArbitrationReview.reasonRequired'))
      return
    }
    setBusyId(jobId)
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
      await fetchApiJson(`/api/admin/arbitration/${jobId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          reason,
          create_key: adminOpsKey(currentUser?.uID, 'job_arbitrate', jobId),
        }),
      })
      toast.success(action === 'approve' ? t('adminArbitrationReview.approved') : t('adminArbitrationReview.rejected'))
      setReasons((prev) => ({ ...prev, [jobId]: '' }))
      await loadItems()
    } catch (error) {
      console.error('Error recording arbitration:', error)
      toast.error(t('adminArbitrationReview.actionFailed', { message: error.message }))
    } finally {
      setBusyId(null)
    }
  }

  const statusLabel = (status) => (STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : status)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminArbitrationReview.title')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminArbitrationReview.intro')}
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
        <label className="text-gray-600">{t('adminArbitrationReview.filterLabel')}</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
        >
          <option value="">{t('adminArbitrationReview.filterAll')}</option>
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
            {t('adminArbitrationReview.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              {t('adminArbitrationReview.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colId')}</th>
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colTitle')}</th>
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colStatus')}</th>
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colReward')}</th>
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colEmployer')}</th>
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colCreated')}</th>
                    <th className="py-2 pr-4">{t('adminArbitrationReview.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.job_id} className="border-b align-top">
                      <td className="py-3 pr-4 font-mono">{row.job_id}</td>
                      <td className="py-3 pr-4">{row.title}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100">{statusLabel(row.status)}</span>
                      </td>
                      <td className="py-3 pr-4 font-mono">{row.reward}</td>
                      <td className="py-3 pr-4 font-mono flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {row.employer_uid}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {row.time_created ? String(row.time_created) : t('adminCommon.notSet')}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-2 min-w-[16rem]">
                          <input
                            type="text"
                            value={reasons[row.job_id] || ''}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [row.job_id]: e.target.value }))}
                            placeholder={t('adminArbitrationReview.reasonPlaceholder')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              disabled={!canManage || busyId === row.job_id}
                              onClick={() => decide(row.job_id, 'approve')}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {t('adminArbitrationReview.approve')}
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={!canManage || busyId === row.job_id}
                              onClick={() => decide(row.job_id, 'reject')}
                            >
                              <X className="w-4 h-4 mr-1" />
                              {t('adminArbitrationReview.reject')}
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
              {t('adminArbitrationReview.intro')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ArbitrationReviewPage
