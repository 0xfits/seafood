import React, { useEffect, useState } from 'react'
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalTitle } from '../../components/ui'
import { Plus, Edit, Trash2, Eye, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'

const EMPTY_BRAND = {
  symbol: '',
  name: '',
  description: '',
  url_image: '',
  points: 0,
  gift_limit: 0,
}

const RewardsManagement = () => {
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [modalMode, setModalMode] = useState('create')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedReward, setSelectedReward] = useState(null)
  const [formState, setFormState] = useState(EMPTY_BRAND)

  const canManageRewards = hasAdminPermission(access, 'manage_rewards')

  useEffect(() => {
    loadRewards()
  }, [])

  const loadRewards = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)
      const currentUser = getStoredUser()
      if (currentUser) {
        setAccess(await fetchAdminAccess(currentUser))
      }
      const data = await fetchApiJson('/api/brand/all')
      setRewards(data || [])
    } catch (error) {
      console.error('Error loading rewards:', error)
      toast.error(`加载奖励失败: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const openCreateModal = () => {
    setModalMode('create')
    setSelectedReward(null)
    setFormState(EMPTY_BRAND)
    setIsModalOpen(true)
  }

  const openViewModal = (reward) => {
    setModalMode('view')
    setSelectedReward(reward)
    setFormState({
      symbol: reward.symbol || '',
      name: reward.name || '',
      description: reward.description || '',
      url_image: reward.image_url || reward.url_image || '',
      points: reward.points || 0,
      gift_limit: reward.gift_limit || 0,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (reward) => {
    setModalMode('edit')
    setSelectedReward(reward)
    setFormState({
      symbol: reward.symbol || '',
      name: reward.name || '',
      description: reward.description || '',
      url_image: reward.image_url || reward.url_image || '',
      points: reward.points || 0,
      gift_limit: reward.gift_limit || 0,
    })
    setIsModalOpen(true)
  }

  const saveReward = async () => {
    const currentUser = getStoredUser()
    const headers = {
      ...getAuthHeaders(currentUser),
      'Content-Type': 'application/json',
    }

    if (!headers.Authorization) {
      toast.error('登录状态已失效，请重新登录')
      return
    }

    if (!formState.name.trim() || !formState.symbol.trim()) {
      toast.error('品牌名称和符号不能为空')
      return
    }

    setSaving(true)
    try {
      const payload = {
        symbol: formState.symbol.trim(),
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        url_image: formState.url_image.trim() || null,
        points: Number(formState.points) || 0,
        gift_limit: Number(formState.gift_limit) || 0,
      }

      if (modalMode === 'edit' && selectedReward?.bID) {
        await fetchApiJson('/api/admin/brand/update', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            bID: selectedReward.bID,
            ...payload,
          }),
        })
        toast.success('奖励品牌已更新')
      } else {
        await fetchApiJson('/api/admin/brand/create', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
        toast.success('奖励品牌已创建')
      }

      setIsModalOpen(false)
      setSelectedReward(null)
      setFormState(EMPTY_BRAND)
      await loadRewards({ silent: true })
    } catch (error) {
      console.error('Error saving brand:', error)
      toast.error(`保存奖励品牌失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteReward = async (reward) => {
    const currentUser = getStoredUser()
    const headers = {
      ...getAuthHeaders(currentUser),
      'Content-Type': 'application/json',
    }

    if (!headers.Authorization) {
      toast.error('登录状态已失效，请重新登录')
      return
    }

    const confirmed = window.confirm(`确认删除奖励品牌“${reward.name}”？如果已有库存或领取记录，将不会允许删除。`)
    if (!confirmed) return

    setDeletingId(reward.bID)
    try {
      await fetchApiJson('/api/admin/brand/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ bID: reward.bID }),
      })
      toast.success('奖励品牌已删除')
      await loadRewards({ silent: true })
    } catch (error) {
      console.error('Error deleting brand:', error)
      toast.error(`删除奖励品牌失败: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const isReadonlyModal = modalMode === 'view' || !canManageRewards

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">奖励管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            当前账号{canManageRewards ? '可管理奖励品牌。' : '为只读模式。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadRewards({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          <Button variant="primary" onClick={openCreateModal} disabled={!canManageRewards}>
            <Plus className="w-4 h-4 mr-2" />
            添加奖励
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {rewards.map((reward) => (
            <Card key={reward.bID}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{reward.name || `品牌 #${reward.bID}`}</h3>
                    <p className="text-sm text-gray-600 mt-1">{reward.description || '暂无描述'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="primary">{reward.points} 积分</Badge>
                      <Badge variant="secondary">库存: {reward.stores_count || 0}</Badge>
                      <Badge variant="secondary">已领取: {reward.claims_count || 0}</Badge>
                      <Badge variant="warning">限额: {reward.gift_limit || 0}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openViewModal(reward)} title="查看详情">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(reward)} disabled={!canManageRewards} title="编辑奖励">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteReward(reward)}
                      disabled={!canManageRewards || deletingId === reward.bID}
                      title="删除奖励"
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
            {modalMode === 'create' ? '添加奖励品牌' : modalMode === 'edit' ? '编辑奖励品牌' : '奖励品牌详情'}
          </ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">符号</label>
              <input
                type="text"
                value={formState.symbol}
                onChange={(e) => setFormState((prev) => ({ ...prev, symbol: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">名称</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">描述</label>
            <textarea
              value={formState.description}
              onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">图片 URL</label>
            <input
              type="text"
              value={formState.url_image}
              onChange={(e) => setFormState((prev) => ({ ...prev, url_image: e.target.value }))}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">兑换积分</label>
              <input
                type="number"
                min="0"
                value={formState.points}
                onChange={(e) => setFormState((prev) => ({ ...prev, points: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">限额</label>
              <input
                type="number"
                min="0"
                value={formState.gift_limit}
                onChange={(e) => setFormState((prev) => ({ ...prev, gift_limit: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              关闭
            </Button>
            {!isReadonlyModal && (
              <Button variant="primary" onClick={saveReward} disabled={saving}>
                {saving ? '保存中...' : '保存奖励'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RewardsManagement
