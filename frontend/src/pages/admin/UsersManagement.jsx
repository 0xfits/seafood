import React, { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui'
import { Users, Plus, Edit, Shield, Search } from 'lucide-react'

const UsersManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/user/all', {
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`
        }
      })
      const data = await response.json()
      if (data.ok) {
        setUsers(data.data || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
      // 如果API不存在，使用模拟数据
      const mockUsers = [
        {
          uID: 1,
          EVM: '0x59f9f640d15ebb053c94a816232cf8ce91b209b0',
          email: 'admin@jinli.com',
          points: 10000,
          is_admin: true,
          role: 'admin',
          created_at: new Date().toISOString()
        },
        {
          uID: 2,
          EVM: '0x1234567890123456789012345678901234567890',
          email: 'user1@example.com',
          points: 2500,
          is_admin: false,
          role: 'user',
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          uID: 3,
          EVM: '0x2345678901234567890123456789012345678901',
          email: 'user2@example.com',
          points: 800,
          is_admin: false,
          role: 'user',
          created_at: new Date(Date.now() - 172800000).toISOString()
        },
        {
          uID: 4,
          EVM: '0x3456789012345678901234567890123456789012',
          email: 'user3@example.com',
          points: 3200,
          is_admin: false,
          role: 'user',
          created_at: new Date(Date.now() - 259200000).toISOString()
        }
      ]
      setUsers(mockUsers)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => 
    user.EVM?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">用户管理</h2>
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          添加用户
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索用户地址或邮箱..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card key={user.uID}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">用户 #{user.uID}</h3>
                    <p className="text-sm text-gray-600 mt-1">{user.EVM}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="primary">{user.points} 积分</Badge>
                      {user.is_admin && <Badge variant="warning">管理员</Badge>}
                      {user.role === 'admin' && <Badge variant="warning">管理员</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Shield className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default UsersManagement
