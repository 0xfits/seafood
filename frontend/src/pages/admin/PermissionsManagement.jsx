import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalTitle } from '../../components/ui'
import { Plus, Edit, Trash2, RefreshCw, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { formatEvmAddress } from '../../utils'

const EMPTY_FORM = {
  id: '',
  name: '',
  description: '',
  permissions: '',
  user_ids: [],
}

const PermissionsManagement = () => {
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [formState, setFormState] = useState(EMPTY_FORM)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  const groupedUserMap = useMemo(() => {
    const map = new Map()
    users.forEach((user) => map.set(user.uID, user))
    return map
  }, [users])

  const loadPermissions = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const currentUser = getStoredUser()
      if (!currentUser) {
        throw new Error('未登录')
      }

      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) {
        throw new Error('当前账号没有后台访问权限')
      }

      setAccess(accessInfo)
      const data = await fetchApiJson('/api/admin/permissions', {
        headers: getAuthHeaders(currentUser),
      })

      setGroups(data.groups || [])
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error loading permission groups:', error)
      toast.error(`加载权限数据失败: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  const canManagePermissions = hasAdminPermission(access, 'manage_permissions')

  const openCreateModal = () => {
    setEditingGroupId(null)
    setFormState(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (group) => {
    setEditingGroupId(group.id)
    setFormState({
      id: group.id,
      name: group.name || '',
      description: group.description || '',
      permissions: (group.permissions || []).join(', '),
      user_ids: group.user_ids || [],
    })
    setIsModalOpen(true)
  }

  const toggleUserSelection = (uID) => {
    setFormState((prev) => ({
      ...prev,
      user_ids: prev.user_ids.includes(uID)
        ? prev.user_ids.filter((id) => id !== uID)
        : [...prev.user_ids, uID],
    }))
  }

  const saveGroup = async () => {
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

    const permissions = formState.permissions
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (!formState.name.trim()) {
      toast.error('权限组名称不能为空')
      return
    }

    if (permissions.length === 0) {
      toast.error('至少填写一个权限标识')
      return
    }

    setSaving(true)
    try {
      await fetchApiJson('/api/admin/permissions/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: editingGroupId || undefined,
          name: formState.name.trim(),
          description: formState.description.trim(),
          permissions,
          user_ids: formState.user_ids,
        }),
      })

      toast.success(editingGroupId ? '权限组已更新' : '权限组已创建')
      setIsModalOpen(false)
      setFormState(EMPTY_FORM)
      setEditingGroupId(null)
      await loadPermissions({ silent: true })
    } catch (error) {
      console.error('Error saving permission group:', error)
      toast.error(`保存权限组失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteGroup = async (group) => {
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

    const confirmed = window.confirm(`确认删除权限组“${group.name}”？`)
    if (!confirmed) return

    setDeletingId(group.id)
    try {
      await fetchApiJson('/api/admin/permissions/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: group.id }),
      })
      toast.success('权限组已删除')
      await loadPermissions({ silent: true })
    } catch (error) {
      console.error('Error deleting permission group:', error)
      toast.error(`删除权限组失败: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">权限管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            “管理员访问”组映射真实后台访问权限，其余权限组是持久化的运营分工配置。
            {!canManagePermissions && ' 当前账号为只读模式。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadPermissions({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          <Button variant="primary" onClick={openCreateModal} disabled={!canManagePermissions}>
            <Plus className="w-4 h-4 mr-2" />
            添加权限组
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{group.name}</h3>
                      {group.readonly ? (
                        <Badge variant="warning" size="sm" className="flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          只读
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">可编辑</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{group.description || '暂无描述'}</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {(group.permissions || []).map((permission) => (
                        <Badge key={permission} variant="secondary">{permission}</Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">
                        {group.user_ids?.length || 0} 个用户
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(group.user_ids || []).length > 0 ? (
                          group.user_ids.map((uID) => {
                            const user = groupedUserMap.get(uID)
                            return (
                              <Badge key={`${group.id}-${uID}`} variant="primary">
                                {user ? `#${uID} ${formatEvmAddress(user.EVM)}` : `#${uID}`}
                              </Badge>
                            )
                          })
                        ) : (
                          <span className="text-xs text-gray-400">暂无分配成员</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(group)}
                      disabled={group.readonly || !canManagePermissions}
                      title={!canManagePermissions ? '当前账号没有 manage_permissions 权限' : group.readonly ? '系统权限组不可编辑' : '编辑权限组'}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGroup(group)}
                      disabled={group.readonly || deletingId === group.id || !canManagePermissions}
                      title={!canManagePermissions ? '当前账号没有 manage_permissions 权限' : group.readonly ? '系统权限组不可删除' : '删除权限组'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>{editingGroupId ? '编辑权限组' : '添加权限组'}</ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">名称</label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              placeholder="例如：内容审核组"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">描述</label>
            <textarea
              value={formState.description}
              onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              placeholder="说明这组权限负责什么。"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">权限标识</label>
            <input
              type="text"
              value={formState.permissions}
              onChange={(e) => setFormState((prev) => ({ ...prev, permissions: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              placeholder="逗号分隔，例如：review_tasks, manage_rewards"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">分配成员</label>
            <div className="max-h-[260px] overflow-auto border border-gray-200 rounded-lg p-3 space-y-2">
              {users.map((user) => (
                <label key={user.uID} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.user_ids.includes(user.uID)}
                    onChange={() => toggleUserSelection(user.uID)}
                    className="w-4 h-4"
                  />
                  <span>#{user.uID}</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {formatEvmAddress(user.EVM)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button variant="primary" onClick={saveGroup} disabled={saving || !canManagePermissions}>
              {saving ? '保存中...' : '保存权限组'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PermissionsManagement
