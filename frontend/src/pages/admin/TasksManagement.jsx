import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

const formatDateTime = (value, t) => {
  if (!value) return t('adminCommon.notSet')
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? t('adminCommon.notSet') : date.toLocaleString()
}

const TasksManagement = () => {
  const { t } = useTranslation()
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
  const canPublishTasks = hasAdminPermission(access, ['manage_tasks', 'publish_tasks'])

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
      toast.error(t('adminTasks.loadFailed', { message: error.message }))
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

  // ── 弃用面下线（P4-B4b-i · §2.4 **S5** / §5.1「后台发布招工」行）───────────────────
  // `POST /api/admin/task/{create,update,delete}`（原 `:130` / `:140` / `:177`）三**写口**已由后端落为
  // **`410` + `R107` + `details.sunset`**（**已撤 `requireAdmin`** ⇒ 无 token 亦 `410`）⇒ 前端**零调用**
  // （判据 = §9.B **B5**）。处置 = **页面只读化**：列表仍走 `GET /api/task/all`，写按钮与写分支删除。
  // 口径依据：§5.1 逐字「用户需求③：管理员不再发布 task/reward」+ §5.2「删三条写调用（页面只读化）」。

  const isReadonlyModal = true

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.tasks')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('adminTasks.readOnlyNotice')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadTasks({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
          {/* §2.4 S5：`POST /api/admin/task/create` 已 410 ⇒ 新增入口删除（页面只读化） */}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">{t('adminCommon.loading')}</div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.tID}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{task.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{task.note || t('adminCommon.noDescription')}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="primary">{t('adminCommon.pointsValue', { value: task.points })}</Badge>
                      <Badge variant="secondary">{task.refcode || 'task'}</Badge>
                      <Badge variant={task.is_open ? 'success' : 'warning'}>{task.is_open ? t('adminTasks.stateOpen') : t('adminTasks.stateClosed')}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      {t('adminTasks.updatedAt', { time: formatDateTime(task.time_updated || task.updated_at, t) })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openViewModal(task)} title={t('adminCommon.viewDetail')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {/* §2.4 S5：编辑(`admin/task/update`)/删除(`admin/task/delete`) 均 410 ⇒ 只留「查看」 */}
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
            {modalMode === 'create' ? t('adminTasks.modalCreate') : modalMode === 'edit' ? t('adminTasks.modalEdit') : t('adminTasks.modalView')}
          </ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('adminTasks.labelTitle')}</label>
            <input
              type="text"
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('adminTasks.labelDesc')}</label>
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
              <label className="block text-sm font-medium mb-2">{t('adminTasks.labelPoints')}</label>
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
            <label className="block text-sm font-medium mb-2">{t('adminTasks.labelMainLink')}</label>
            <input
              type="text"
              value={formState.link0}
              onChange={(e) => setFormState((prev) => ({ ...prev, link0: e.target.value }))}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('adminTasks.labelBackupLink')}</label>
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
            {t('adminTasks.enabled')}
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              {t('adminCommon.close')}
            </Button>
            {/* §2.4 S5：保存（`admin/task/create|update`）已 410 ⇒ 保存按钮删除（模态框为只读详情） */}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TasksManagement
