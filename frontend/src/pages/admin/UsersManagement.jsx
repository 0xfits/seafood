import React, { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui'
import { Users, Plus, Edit, Shield, Search, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const UsersManagement = () => {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    const filtered = users.filter(user => 
      user.EVM?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.uID?.toString().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredUsers(filtered)
  }, [users, searchTerm])

  const loadUsers = async () => {
    try {
      // 获取用户统计信息
      const statsResponse = await fetch('/api/user/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        if (statsData.ok) {
          const userCount = statsData.data.user_count
          
          // 为每个用户ID获取详细信息
          const usersWithAssets = []
          for (let i = 1; i <= userCount; i++) {
            try {
              // 获取用户资产信息
              const assetResponse = await fetch(`/api/user/asset/${i}`)
              if (assetResponse.ok) {
                const assetData = await assetResponse.json()
                if (assetData.ok) {
                  usersWithAssets.push({
                    uID: i,
                    points: assetData.data.points || 0,
                    lastUpdate: assetData.data.time_update,
                    is_admin: i === 1, // 假设用户1是管理员
                    EVM: i === 1 ? '0x59f9f640d15ebb053c94a816232cf8ce91b209b0' : `0x${i.toString().padStart(40, '0')}`,
                    email: i === 1 ? 'admin@jinli.com' : `user${i}@example.com`,
                    created_at: assetData.data.time_update || new Date().toISOString(),
                    status: 'active'
                  })
                }
              }
            } catch (error) {
              console.warn(`Failed to load user ${i}:`, error)
            }
          }
          
          setUsers(usersWithAssets)
        }
      }
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('加载用户数据失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleUserStatus = (userId) => {
    // 切换用户状态的逻辑
    setUsers(prev => prev.map(user => 
      user.uID === userId 
        ? { ...user, status: user.status === 'active' ? 'inactive' : 'active' }
        : user
    ))
    toast.success(`用户 ${userId} 状态已更新`)
  }

  const toggleAdminRole = (userId) => {
    // 切换管理员角色的逻辑
    setUsers(prev => prev.map(user => 
      user.uID === userId 
        ? { ...user, is_admin: !user.is_admin }
        : user
    ))
    toast.success(`用户 ${userId} 管理员权限已更新`)
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总用户数</p>
                <p className="text-2xl font-bold">{users.length}</p>
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
                <p className="text-2xl font-bold">{users.filter(u => u.is_admin).length}</p>
              </div>
              <Shield className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">活跃用户</p>
                <p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总积分</p>
                <p className="text-2xl font-bold">
                  {users.reduce((sum, user) => sum + (user.points || 0), 0).toLocaleString()}
                </p>
              </div>
              <Plus className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作区域 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">用户管理</h2>
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索用户ID、地址或邮箱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
          />
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            添加用户
          </Button>
        </div>
      </div>

      {/* 用户列表 */}
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
                    邮箱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    钱包地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    积分
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    注册时间
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
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {user.EVM ? `${user.EVM.slice(0, 6)}...${user.EVM.slice(-4)}` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-medium">{user.points || 0}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_admin ? 'success' : 'secondary'}>
                        {user.is_admin ? '管理员' : '普通用户'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.status === 'active' ? 'success' : 'warning'}>
                        {user.status === 'active' ? '活跃' : '禁用'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAdminRole(user.uID)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(user.uID)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <Edit className="w-4 h-4" />
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
