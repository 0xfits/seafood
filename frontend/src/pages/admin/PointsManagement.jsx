import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalTitle } from '../../components/ui'
import { Search, Plus, Minus, Users, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../../utils'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission, loadAdminUsersWithAssets } from '../../admin-utils'

const formatDateTime = (value, t) => {
  if (!value) return t('adminPoints.neverUpdated')
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? t('adminPoints.neverUpdated') : date.toLocaleString()
}

const PointsManagement = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({
    userCount: 0,
    totalPoints: 0,
    avgPoints: 0,
    zeroPoints: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustType, setAdjustType] = useState('add')
  const [adjusting, setAdjusting] = useState(false)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return users

    return users.filter((user) =>
      user.EVM?.toLowerCase().includes(query) ||
      user.uID?.toString().includes(query)
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
      setStats({
        userCount: result.stats.userCount,
        totalPoints: result.stats.totalPoints,
        avgPoints: result.stats.avgPoints,
        zeroPoints: result.stats.zeroPoints,
      })
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error(t('adminPoints.loadFailed', { message: error.message }))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const canManagePoints = hasAdminPermission(access, 'manage_points')

  const handleAdjustPoints = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason) {
      toast.error(t('adminPoints.invalidForm'))
      return
    }

    const amount = parseInt(adjustAmount, 10)
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error(t('adminPoints.invalidAmount'))
      return
    }

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

    setAdjusting(true)
    try {
      const result = await fetchApiJson('/api/admin/points/adjust', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uID: selectedUser.uID,
          amount: adjustType === 'add' ? amount : -amount,
          reason: adjustReason,
          operator: currentUser?.EVM || 'admin',
        }),
      })

      setUsers((prev) => {
        const nextUsers = prev.map((user) =>
          user.uID === selectedUser.uID
            ? {
                ...user,
                points: result.new_points,
                asset_updated_at: result.timestamp,
              }
            : user
        )
        const totalPoints = nextUsers.reduce((sum, user) => sum + (user.points || 0), 0)
        setStats((prevStats) => ({
          ...prevStats,
          totalPoints,
          avgPoints: nextUsers.length > 0 ? Math.round(totalPoints / nextUsers.length) : 0,
          zeroPoints: nextUsers.filter((user) => !user.points).length,
        }))
        return nextUsers
      })

      toast.success(t(adjustType === 'add' ? 'adminPoints.adjustSuccessAdd' : 'adminPoints.adjustSuccessSubtract', { id: selectedUser.uID, amount }))
      setShowAdjustModal(false)
      setSelectedUser(null)
      setAdjustAmount('')
      setAdjustReason('')
      setAdjustType('add')
    } catch (error) {
      console.error('Error adjusting points:', error)
      toast.error(t('adminPoints.adjustFailed', { message: error.message }))
    } finally {
      setAdjusting(false)
    }
  }

  const openAdjustModal = (user, type) => {
    setSelectedUser(user)
    setAdjustType(type)
    setShowAdjustModal(true)
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
                <p className="text-sm text-gray-600">{t('adminCommon.statTotalPoints')}</p>
                <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('adminPoints.statAvg')}</p>
                <p className="text-2xl font-bold">{stats.avgPoints.toLocaleString()}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('adminPoints.statZero')}</p>
                <p className="text-2xl font-bold">{stats.zeroPoints}</p>
              </div>
              <Minus className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('adminPoints.title')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminPoints.intro')}
            {canManagePoints ? t('adminPoints.introManage') : t('adminCommon.readOnlyNotice')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('adminPoints.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <Button variant="outline" onClick={() => loadUsers({ silent: true })} disabled={refreshing}>
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
                    {t('adminCommon.colPoints')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colUpdated')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('adminCommon.colRole')}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-gray-900">
                          {(user.points || 0).toLocaleString()}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">{t('common.points')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(user.asset_updated_at, t)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_admin ? 'success' : 'secondary'}>
                        {user.is_admin ? t('adminCommon.adminRole') : t('adminCommon.normalUser')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => canManagePoints && openAdjustModal(user, 'add')}
                          disabled={!canManagePoints}
                          className="text-green-600 hover:text-green-700"
                          title={canManagePoints ? t('adminPoints.addPoints') : t('adminPoints.tipNoManagePermission')}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => canManagePoints && openAdjustModal(user, 'subtract')}
                          disabled={!canManagePoints}
                          className="text-red-600 hover:text-red-700"
                          title={canManagePoints ? t('adminPoints.subtractPoints') : t('adminPoints.tipNoManagePermission')}
                        >
                          <Minus className="w-4 h-4" />
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

      <Modal isOpen={showAdjustModal} onClose={() => !adjusting && setShowAdjustModal(false)}>
        <ModalHeader>
          <ModalTitle>{t(adjustType === 'add' ? 'adminPoints.addPoints' : 'adminPoints.subtractPoints')}</ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          {selectedUser && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                {t('adminPoints.targetUser')} <span className="font-medium">#{selectedUser.uID}</span>
              </p>
              <p className="text-sm text-gray-600">
                {t('adminPoints.wallet')}
                <span className="font-mono text-xs bg-white px-2 py-1 rounded ml-2">
                  {selectedUser.EVM}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                {t('adminPoints.currentPoints')} <span className="font-bold">{selectedUser.points || 0}</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t(adjustType === 'add' ? 'adminPoints.amountLabelAdd' : 'adminPoints.amountLabelSubtract')}
            </label>
            <input
              type="number"
              min="1"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder={t('adminPoints.amountPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('adminPoints.reasonLabel')}
            </label>
            <textarea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={t('adminPoints.reasonPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowAdjustModal(false)}
              disabled={adjusting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant={adjustType === 'add' ? 'success' : 'warning'}
              onClick={handleAdjustPoints}
              disabled={adjusting}
            >
              {adjusting ? t('adminPoints.processing') : t(adjustType === 'add' ? 'adminPoints.confirmAdd' : 'adminPoints.confirmSubtract')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PointsManagement
