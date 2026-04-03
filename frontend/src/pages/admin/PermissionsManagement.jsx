import React, { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui'
import { Shield, Plus, Edit, Trash2, UserCheck, UserX } from 'lucide-react'

const PermissionsManagement = () => {
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    try {
      // 模拟权限数据
      const mockPermissions = [
        {
          id: 1,
          name: '管理员权限',
          description: '完全访问权限',
          users: ['0x59f9f640d15ebb053c94a816232cf8ce91b209b0'],
          permissions: ['read', 'write', 'delete', 'admin']
        },
        {
          id: 2,
          name: '审核员权限',
          description: '任务审核权限',
          users: ['0x1234567890123456789012345678901234567890'],
          permissions: ['read', 'write']
        }
      ]
      setPermissions(mockPermissions)
    } catch (error) {
      console.error('Error loading permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">权限管理</h2>
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          添加权限组
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {permissions.map((permission) => (
            <Card key={permission.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{permission.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{permission.description}</p>
                    <div className="flex gap-2 mt-2">
                      {permission.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary">{perm}</Badge>
                      ))}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        {permission.users.length} 个用户
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <UserCheck className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
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

export default PermissionsManagement
