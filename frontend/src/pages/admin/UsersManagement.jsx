import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, Badge } from '../../components/ui'
import { Users, Shield, Search, AlertCircle, RefreshCw, Coins } from 'lucide-react'
import toast from 'react-hot-toast'
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../../utils'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission, loadAdminUsersWithAssets } from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'

const formatDateTime = (value, t) => {
  if (!value) return t('unknown')
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? t('unknown') : date.toLocaleString()
}

const UsersManagement = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({
    userCount: 0,
    adminCount: 0,
    assetCount: 0,
    totalPoints: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return users

    return users.filter((user) =>
      user.EVM?.toLowerCase().includes(query) ||
      user.uID?.toString().includes(query) ||
      user.bio?.toLowerCase().includes(query)
    )
  }, [users, searchTerm])

  const loadUsers = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const currentUser = getStoredUser()
      if (!currentUser) {
        throw new Error(t('adminCommon.notLoggedIn'))
      }

      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) {
        throw new Error(t('adminCommon.noAdminAccess'))
      }

      setAccess(accessInfo)
      const result = await loadAdminUsersWithAssets(currentUser)
      setUsers(result.users)
      setStats(result.stats)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error(t('adminUsers.loadFailed', { message: error.message }))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const canManageUsers = hasAdminPermission(access, 'manage_users')
  const canManagePoints = hasAdminPermission(access, 'manage_points')

  const toggleAdminRole = async (user) => {
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

    const nextAdmin = !user.is_admin
    const confirmed = window.confirm(
      nextAdmin
        ? t('adminUsers.confirmGrant', { id: user.uID })
        : t('adminUsers.confirmRevoke', { id: user.uID })
    )

    if (!confirmed) return

    setUpdatingUserId(user.uID)
    try {
      // §2.4 **S1** / §9.B **B1**（DL36）：`/api/admin/user/update` 现为请求侧强校验
      //   ⇒ 键形态 `ops:<admin_uid>:user_update:<target_uid>`（真源 = `backend-ts/src/index.ts:991`；
      //   前缀硬闸 = `admin-service.ts:76-78`；服务端**只校验前缀、不落库** ⇒ 形状契约）。
      const updated = await fetchApiJson('/api/admin/user/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uID: user.uID,
          is_admin: nextAdmin,
          create_key: adminOpsKey(currentUser?.uID, 'user_update', user.uID),
        }),
      })

      setUsers((prev) =>
        prev.map((item) =>
          item.uID === user.uID
            ? { ...item, ...updated, points: item.points, asset_updated_at: item.asset_updated_at, has_asset: item.has_asset }
            : item
        )
      )

      setStats((prev) => ({
        ...prev,
        adminCount: Math.max(0, prev.adminCount + (nextAdmin ? 1 : -1)),
      }))

      toast.success(nextAdmin ? t('adminUsers.grantSuccess') : t('adminUsers.revokeSuccess'))
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error(t('adminUsers.updateFailed', { message: error.message }))
    } finally {
      setUpdatingUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('adminCommon.statUsers')}</p>
                <p className="text-2xl font-bold">{stats.userCount}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('adminCommon.adminRole')}</p>
                <p className="text-2xl font-bold">{stats.adminCount}</p>
              </div>
              <Shield className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('adminUsers.statAssets')}</p>
                <p className="text-2xl font-bold">{stats.assetCount}</p>
              </div>
              <Coins className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('adminCommon.statTotalPoints')}</p>
                <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.users')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminUsers.intro')}
            {canManageUsers ? t('adminUsers.introManage') : t('adminUsers.introReadOnly')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('adminUsers.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => loadUsers({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refreshData')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">{t('adminCommon.loading')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colUserId')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colWallet')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colBio')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.points')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colRole')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colRegistered')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colLastLogin')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.uID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{user.uID}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {formatEvmAddress(user.EVM) || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      {user.bio || t('adminUsers.noBio')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-medium">{(user.points || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_admin ? 'success' : 'secondary'}>
                        {user.is_admin ? t('adminCommon.adminRole') : t('adminCommon.normalUser')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(user.time_reg, t)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(user.time_login_last, t)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAdminRole(user)}
                          disabled={!canManageUsers || updatingUserId === user.uID}
                          className="text-blue-600 hover:text-blue-700"
                          title={!canManageUsers ? t('adminUsers.tipNoManageUsers') : user.is_admin ? t('adminUsers.tipRevoke') : t('adminUsers.tipGrant')}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => canManagePoints && navigate(`/dashboard/points?q=${encodeURIComponent(user.EVM || String(user.uID))}`)}
                          disabled={!canManagePoints}
                          className="text-yellow-600 hover:text-yellow-700"
                          title={canManagePoints ? t('adminUsers.tipGoPoints') : t('adminUsers.tipNoManagePoints')}
                        >
                          <Coins className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('adminCommon.noMatchingUsers')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default UsersManagement
