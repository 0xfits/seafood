import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardContent, Badge } from '../../components/ui'
import { Users, Shield, Search, AlertCircle, RefreshCw, Coins } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatEvmAddress } from '../../utils'
import { fetchApiJson, getAuthHeaders, getStoredUser, isAdminUser, loadAdminUsersWithAssets } from '../../admin-utils'

const formatDateTime = (value) => {
  if (!value) return '未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString()
}

const UsersManagement = () => {
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
      if (!currentUser || !isAdminUser(currentUser)) {
        throw new Error('当前登录用户不是管理员')
      }

      const result = await loadAdminUsersWithAssets(currentUser)
      setUsers(result.users)
      setStats(result.stats)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error(`加载用户数据失败: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const toggleAdminRole = async (user) => {
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

    const nextAdmin = !user.is_admin
    const confirmed = window.confirm(
      nextAdmin
        ? `确认将用户 #${user.uID} 提升为管理员？`
        : `确认撤销用户 #${user.uID} 的管理员权限？`
    )

    if (!confirmed) return

    setUpdatingUserId(user.uID)
    try {
      const updated = await fetchApiJson('/api/admin/user/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uID: user.uID,
          is_admin: nextAdmin,
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

      toast.success(nextAdmin ? '管理员权限已授予' : '管理员权限已撤销')
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error(`更新用户失败: ${error.message}`)
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
                <p className="text-sm text-gray-600">管理员</p>
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
                <p className="text-sm text-gray-600">有资产记录</p>
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
                <p className="text-sm text-gray-600">总积分</p>
                <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">用户管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            当前页面使用真实用户和积分资产数据。用户禁用状态接口尚未接通，因此不再展示伪状态。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索用户ID、地址或简介..."
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
                    简介
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    积分
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    注册时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最近登录
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
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      {user.bio || '暂无简介'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-medium">{(user.points || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_admin ? 'success' : 'secondary'}>
                        {user.is_admin ? '管理员' : '普通用户'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(user.time_reg)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(user.time_login_last)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAdminRole(user)}
                          disabled={updatingUserId === user.uID}
                          className="text-blue-600 hover:text-blue-700"
                          title={user.is_admin ? '撤销管理员权限' : '授予管理员权限'}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/dashboard/points?q=${encodeURIComponent(user.EVM || String(user.uID))}`)}
                          className="text-yellow-600 hover:text-yellow-700"
                          title="前往积分管理"
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
              <p className="text-gray-500">没有找到匹配的用户</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default UsersManagement
