import React, { useEffect, useState } from 'react'
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalTitle } from '../../components/ui'
import { Plus, Edit, Trash2, Eye, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { getMinimumShardPrice, isPrizePriceFloorEligible } from '../../prize-market'

const toLocalDateTimeValue = (value) => {
  if (!value) return ''
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return ''
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return adjusted.toISOString().slice(0, 16)
}

const EMPTY_BRAND = {
  symbol: '',
  name: '',
  description: '',
  url_image: '',
  points: 0,
  market_floor_points: 0,
  total_quantity: 1,
  free_shard_ratio: 0,
  time_start: toLocalDateTimeValue(Date.now()),
  time_end: '',
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
  const canPublishPrizes = hasAdminPermission(access, ['manage_rewards', 'publish_prizes'])

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
      const data = await fetchApiJson('/api/prize/all')
      setRewards(data || [])
    } catch (error) {
      console.error('Error loading rewards:', error)
      toast.error(`加载奖品失败: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const openCreateModal = () => {
    setModalMode('create')
    setSelectedReward(null)
    setFormState({
      ...EMPTY_BRAND,
      time_start: toLocalDateTimeValue(Date.now()),
    })
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
      market_floor_points: reward.market_floor_points || 0,
      total_quantity: reward.total_quantity || reward.gift_limit || 1,
      free_shard_ratio: reward.free_shard_ratio || 0,
      time_start: toLocalDateTimeValue(reward.time_start),
      time_end: toLocalDateTimeValue(reward.time_end),
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
      market_floor_points: reward.market_floor_points || 0,
      total_quantity: reward.total_quantity || reward.gift_limit || 1,
      free_shard_ratio: reward.free_shard_ratio || 0,
      time_start: toLocalDateTimeValue(reward.time_start),
      time_end: toLocalDateTimeValue(reward.time_end),
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
      toast.error('奖品名称和符号不能为空')
      return
    }

    if (!formState.time_end) {
      toast.error('请设置奖品有效期截止时间')
      return
    }

    const priceFloorEligible = isPrizePriceFloorEligible(formState.time_start, formState.time_end)

    setSaving(true)
    try {
      const payload = {
        symbol: formState.symbol.trim(),
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        url_image: formState.url_image.trim() || null,
        points: Number(formState.points) || 0,
        market_floor_points: priceFloorEligible ? Math.max(0, Number(formState.market_floor_points) || 0) : 0,
        total_quantity: Math.max(1, Number(formState.total_quantity) || 1),
        gift_limit: Math.max(1, Number(formState.total_quantity) || 1),
        free_shard_ratio: Math.min(100, Math.max(0, Number(formState.free_shard_ratio) || 0)),
        time_start: formState.time_start ? new Date(formState.time_start).toISOString() : null,
        time_end: formState.time_end ? new Date(formState.time_end).toISOString() : null,
      }

      // §2.4 S5：`POST /api/admin/prize/{create,update}`（410 + R107 + sunset）**已删除**
      // ⇒ 写分支不再发起任何调用（页面只读化；判据 = §9.B B5「13 面前端零调用」）。
      setIsModalOpen(false)
      setSelectedReward(null)
      setFormState(EMPTY_BRAND)
      await loadRewards({ silent: true })
    } catch (error) {
      console.error('Error saving prize:', error)
      toast.error(`保存奖品失败: ${error.message}`)
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

    const confirmed = window.confirm(`确认删除奖品“${reward.name}”？如果已有库存或领取记录，将不会允许删除。`)
    if (!confirmed) return

    setDeletingId(reward.bID)
    try {
      // §2.4 S5：`POST /api/admin/prize/delete`（410 + R107 + sunset）**已删除** ⇒ 不再发起调用。
      await loadRewards({ silent: true })
    } catch (error) {
      console.error('Error deleting prize:', error)
      toast.error(`删除奖品失败: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const isReadonlyModal = modalMode === 'view' || (modalMode === 'create' ? !canPublishPrizes : !canManageRewards)
  const priceFloorEligible = isPrizePriceFloorEligible(formState.time_start, formState.time_end)
  const minimumShardPrice = priceFloorEligible ? getMinimumShardPrice(formState.market_floor_points) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">奖品管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            当前账号为只读模式：管理员发布/编辑/删除商品入口已下线
            （`POST /api/admin/prize/*` = `410`，§5.1「后台发布商品」行）。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadRewards({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          {/* §2.4 S5：`POST /api/admin/prize/create` 已 410 ⇒ 发布入口删除（页面只读化） */}
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
                    <h3 className="font-semibold">{reward.name || `奖品 #${reward.bID}`}</h3>
                    <p className="text-sm text-gray-600 mt-1">{reward.description || '暂无描述'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="primary">{reward.points} 积分</Badge>
                      <Badge variant="secondary">总量: {reward.total_quantity || reward.gift_limit || 0}</Badge>
                      <Badge variant="secondary">库存: {reward.stores_count || 0}</Badge>
                      <Badge variant="secondary">已兑换: {reward.claims_count || 0}</Badge>
                      <Badge variant="secondary">当前碎片: {reward.current_shard_supply || 0}</Badge>
                      {reward.price_floor_enabled && (
                        <Badge variant="secondary">保底价: {reward.minimum_shard_price || 0} J/片</Badge>
                      )}
                      <Badge variant="warning">
                        {reward.lifecycle_status === 'circulation'
                          ? `流通中 ${Math.ceil((reward.circulation_seconds || 0) / 86400)} 天`
                          : reward.lifecycle_status === 'liquidation'
                            ? `清算中 ${Math.ceil((reward.liquidation_seconds || 0) / 86400)} 天`
                            : '已过期'}
                      </Badge>
                      <Badge variant="secondary">免费碎片: {reward.free_shard_ratio || 0}%</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openViewModal(reward)} title="查看详情">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {/* §2.4 S5：编辑(`admin/prize/update`)/删除(`admin/prize/delete`) 均 410 ⇒ 只留「查看」 */}
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
            {modalMode === 'create' ? '发布奖品' : modalMode === 'edit' ? '编辑奖品' : '奖品详情'}
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
              <label className="block text-sm font-medium mb-2">保底积分值</label>
              <input
                type="number"
                min="0"
                value={formState.market_floor_points}
                onChange={(e) => setFormState((prev) => ({ ...prev, market_floor_points: e.target.value }))}
                disabled={isReadonlyModal || !priceFloorEligible}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <p className="mt-2 text-xs text-gray-500">
                {priceFloorEligible
                  ? `当前配置将把单片最低成交价锁定为 ${minimumShardPrice} J；低于该价格的订单不会成交。`
                  : '奖品有效期需超过 30 天，才可设置市场保底积分值。'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">奖品总量</label>
              <input
                type="number"
                min="1"
                value={formState.total_quantity}
                onChange={(e) => setFormState((prev) => ({ ...prev, total_quantity: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              保底单片价：
              <span className="ml-2 font-semibold text-gray-900">
                {priceFloorEligible ? `${minimumShardPrice} J` : '未启用'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">有效开始时间</label>
              <input
                type="datetime-local"
                value={formState.time_start}
                onChange={(e) => setFormState((prev) => ({ ...prev, time_start: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">有效截止时间</label>
              <input
                type="datetime-local"
                value={formState.time_end}
                onChange={(e) => setFormState((prev) => ({ ...prev, time_end: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">免费碎片比例 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formState.free_shard_ratio}
                onChange={(e) => setFormState((prev) => ({ ...prev, free_shard_ratio: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              最多免费碎片：
              <span className="ml-2 font-semibold text-gray-900">
                {Math.floor((Number(formState.total_quantity) || 0) * 1000 * ((Number(formState.free_shard_ratio) || 0) / 100))}
              </span>
            </div>
          </div>
          {selectedReward && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">已兑换</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.issued_quantity || selectedReward.claims_count || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">已兑现</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.redeemed_quantity || selectedReward.activated_count || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">可流通碎片上限</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.market_shard_cap || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">保底积分值</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.market_floor_points || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">已送出免费碎片</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.free_shards_distributed || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">剩余免费碎片</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.free_shards_remaining || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">剩余流通空间</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.remaining_market_shards || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">保底单片价</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.minimum_shard_price || 0} J</div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              关闭
            </Button>
            {/* §2.4 S5：保存（`admin/prize/create|update`）已 410 ⇒ 保存按钮删除（模态框为只读详情） */}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RewardsManagement
