import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalTitle } from '../../components/ui'
import { Search, Plus, Minus, Users, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatEvmAddress } from '../../utils'
import { fetchApiJson, getAuthHeaders, getStoredUser, isAdminUser, loadAdminUsersWithAssets } from '../../admin-utils'

const formatDateTime = (value) => {
  if (!value) return '从未更新'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '从未更新' : date.toLocaleString()
}

const PointsManagement = () => {
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
      if (!currentUser || !isAdminUser(currentUser)) {
        throw new Error('当前登录用户不是管理员')
      }

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
      toast.error(`加载用户积分失败: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleAdjustPoints = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason) {
      toast.error('请填写完整的调整信息')
      return
    }

    const amount = parseInt(adjustAmount, 10)
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('请输入有效的积分数额')
      return
    }

    const currentUser = getStoredUser()
    const headers = {
      ...getAuthHeaders(currentUser),
      'Content-Type': 'application/json',
    }

    if (!headers.Authorization) {
      toast.error('登录状态已失效，请重新登录')
      navigate('/login')
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

      toast.success(`成功为用户 #${selectedUser.uID}${adjustType === 'add' ? '增加' : '减少'} ${amount} 积分`)
      setShowAdjustModal(false)
      setSelectedUser(null)
      setAdjustAmount('')
      setAdjustReason('')
      setAdjustType('add')
    } catch (error) {
      console.error('Error adjusting points:', error)
      toast.error(`积分调整失败: ${error.message}`)
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
                <p className="text-sm text-gray-600">总用户数</p>
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
                <p className="text-sm text-gray-600">总积分</p>
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
                <p className="text-sm text-gray-600">平均积分</p>
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
                <p className="text-sm text-gray-600">零积分用户</p>
                <p className="text-2xl font-bold">{stats.zeroPoints}</p>
              </div>
              <Minus className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">用户积分管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            当前页面使用真实用户和资产积分数据，调整接口已接入管理员鉴权。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索用户地址或ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <Button variant="outline" onClick={() => loadUsers({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? '刷新中...' : '刷新数据'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    钱包地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    当前积分
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后更新
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
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
                        <span className="ml-2 text-sm text-gray-500">积分</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(user.asset_updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_admin ? 'success' : 'secondary'}>
                        {user.is_admin ? '管理员' : '普通用户'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjustModal(user, 'add')}
                          className="text-green-600 hover:text-green-700"
                          title="增加积分"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjustModal(user, 'subtract')}
                          className="text-red-600 hover:text-red-700"
                          title="减少积分"
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
              <p className="text-gray-500">没有找到匹配的用户</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showAdjustModal} onClose={() => !adjusting && setShowAdjustModal(false)}>
        <ModalHeader>
          <ModalTitle>{`${adjustType === 'add' ? '增加' : '减少'}积分`}</ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          {selectedUser && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                操作用户: <span className="font-medium">#{selectedUser.uID}</span>
              </p>
              <p className="text-sm text-gray-600">
                钱包地址:
                <span className="font-mono text-xs bg-white px-2 py-1 rounded ml-2">
                  {selectedUser.EVM}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                当前积分: <span className="font-bold">{selectedUser.points || 0}</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {adjustType === 'add' ? '增加' : '减少'}积分数额
            </label>
            <input
              type="number"
              min="1"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="请输入积分数额"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              调整原因
            </label>
            <textarea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="请输入调整原因..."
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
              取消
            </Button>
            <Button
              variant={adjustType === 'add' ? 'success' : 'warning'}
              onClick={handleAdjustPoints}
              disabled={adjusting}
            >
              {adjusting ? '处理中...' : `确认${adjustType === 'add' ? '增加' : '减少'}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PointsManagement
