import React, { useEffect, useState } from 'react'
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalTitle } from '../../components/ui'
import { Trophy, Plus, Edit, Trash2, Eye, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'

const EMPTY_TASK = {
  title: '',
  note: '',
  refcode: '',
  points: 0,
  is_open: true,
  link0: '',
  linkB: '',
}

const formatDateTime = (value) => {
  if (!value) return '未设置'
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? '未设置' : date.toLocaleString()
}

const TasksManagement = () => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [modalMode, setModalMode] = useState('create')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [formState, setFormState] = useState(EMPTY_TASK)

  const canManageTasks = hasAdminPermission(access, 'manage_tasks')

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const currentUser = getStoredUser()
      if (currentUser) {
        setAccess(await fetchAdminAccess(currentUser))
      }

      const data = await fetchApiJson('/api/task/all')
      setTasks(data || [])
    } catch (error) {
      console.error('Error loading tasks:', error)
      toast.error(`加载任务失败: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const openCreateModal = () => {
    setModalMode('create')
    setSelectedTask(null)
    setFormState(EMPTY_TASK)
    setIsModalOpen(true)
  }

  const openViewModal = (task) => {
    setModalMode('view')
    setSelectedTask(task)
    setFormState({
      title: task.title || '',
      note: task.note || '',
      refcode: task.refcode || '',
      points: task.points || 0,
      is_open: Boolean(task.is_open),
      link0: task.link0 || task.linkA || '',
      linkB: task.linkB || '',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (task) => {
    setModalMode('edit')
    setSelectedTask(task)
    setFormState({
      title: task.title || '',
      note: task.note || '',
      refcode: task.refcode || '',
      points: task.points || 0,
      is_open: Boolean(task.is_open),
      link0: task.link0 || task.linkA || '',
      linkB: task.linkB || '',
    })
    setIsModalOpen(true)
  }

  const saveTask = async () => {
    const currentUser = getStoredUser()
    const headers = {
      ...getAuthHeaders(currentUser),
      'Content-Type': 'application/json',
    }

    if (!headers.Authorization) {
      toast.error('登录状态已失效，请重新登录')
      return
    }

    if (!formState.title.trim()) {
      toast.error('任务标题不能为空')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: formState.title.trim(),
        note: formState.note.trim() || null,
        refcode: formState.refcode.trim() || null,
        points: Number(formState.points) || 0,
        is_open: Boolean(formState.is_open),
        link0: formState.link0.trim() || null,
        linkB: formState.linkB.trim() || null,
      }

      if (modalMode === 'edit' && selectedTask?.tID) {
        await fetchApiJson('/api/admin/task/update', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tID: selectedTask.tID,
            ...payload,
          }),
        })
        toast.success('任务已更新')
      } else {
        await fetchApiJson('/api/admin/task/create', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
        toast.success('任务已创建')
      }

      setIsModalOpen(false)
      setSelectedTask(null)
      setFormState(EMPTY_TASK)
      await loadTasks({ silent: true })
    } catch (error) {
      console.error('Error saving task:', error)
      toast.error(`保存任务失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async (task) => {
    const currentUser = getStoredUser()
    const headers = {
      ...getAuthHeaders(currentUser),
      'Content-Type': 'application/json',
    }

    if (!headers.Authorization) {
      toast.error('登录状态已失效，请重新登录')
      return
    }

    const confirmed = window.confirm(`确认删除任务“${task.title}”？如果已有参与记录，将不会允许删除。`)
    if (!confirmed) return

    setDeletingId(task.tID)
    try {
      await fetchApiJson('/api/admin/task/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tID: task.tID }),
      })
      toast.success('任务已删除')
      await loadTasks({ silent: true })
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error(`删除任务失败: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const isReadonlyModal = modalMode === 'view' || !canManageTasks

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">任务管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            当前账号{canManageTasks ? '可执行任务的新增、编辑和删除。' : '为只读模式。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadTasks({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          <Button variant="primary" onClick={openCreateModal} disabled={!canManageTasks}>
            <Plus className="w-4 h-4 mr-2" />
            添加任务
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.tID}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{task.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{task.note || '暂无描述'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="primary">{task.points} 积分</Badge>
                      <Badge variant="secondary">{task.refcode || 'task'}</Badge>
                      <Badge variant={task.is_open ? 'success' : 'warning'}>{task.is_open ? '开启' : '关闭'}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      更新时间: {formatDateTime(task.time_updated || task.updated_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openViewModal(task)} title="查看详情">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(task)} disabled={!canManageTasks} title="编辑任务">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTask(task)}
                      disabled={!canManageTasks || deletingId === task.tID}
                      title="删除任务"
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
          <ModalTitle>
            {modalMode === 'create' ? '添加任务' : modalMode === 'edit' ? '编辑任务' : '任务详情'}
          </ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">标题</label>
            <input
              type="text"
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">描述</label>
            <textarea
              value={formState.note}
              onChange={(e) => setFormState((prev) => ({ ...prev, note: e.target.value }))}
              rows={4}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Refcode</label>
              <input
                type="text"
                value={formState.refcode}
                onChange={(e) => setFormState((prev) => ({ ...prev, refcode: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">积分</label>
              <input
                type="number"
                min="0"
                value={formState.points}
                onChange={(e) => setFormState((prev) => ({ ...prev, points: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">主链接</label>
            <input
              type="text"
              value={formState.link0}
              onChange={(e) => setFormState((prev) => ({ ...prev, link0: e.target.value }))}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">备用链接</label>
            <input
              type="text"
              value={formState.linkB}
              onChange={(e) => setFormState((prev) => ({ ...prev, linkB: e.target.value }))}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(formState.is_open)}
              onChange={(e) => setFormState((prev) => ({ ...prev, is_open: e.target.checked }))}
              disabled={isReadonlyModal}
              className="w-4 h-4"
            />
            任务开启
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              关闭
            </Button>
            {!isReadonlyModal && (
              <Button variant="primary" onClick={saveTask} disabled={saving}>
                {saving ? '保存中...' : '保存任务'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TasksManagement
