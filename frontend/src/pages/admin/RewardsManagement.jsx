import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      toast.error(t('adminRewards.loadFailed', { message: error.message }))
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
      toast.error(t('adminCommon.sessionExpired'))
      return
    }

    if (!formState.name.trim() || !formState.symbol.trim()) {
      toast.error(t('adminRewards.nameSymbolRequired'))
      return
    }

    if (!formState.time_end) {
      toast.error(t('adminRewards.endTimeRequired'))
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
      toast.error(t('adminRewards.saveFailed', { message: error.message }))
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
      toast.error(t('adminCommon.sessionExpired'))
      return
    }

    const confirmed = window.confirm(t('adminRewards.confirmDelete', { name: reward.name }))
    if (!confirmed) return

    setDeletingId(reward.bID)
    try {
      // §2.4 S5：`POST /api/admin/prize/delete`（410 + R107 + sunset）**已删除** ⇒ 不再发起调用。
      await loadRewards({ silent: true })
    } catch (error) {
      console.error('Error deleting prize:', error)
      toast.error(t('adminRewards.deleteFailed', { message: error.message }))
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
          <h2 className="text-2xl font-bold">{t('adminNav.rewards')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('adminRewards.readOnlyNotice')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadRewards({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
          {/* §2.4 S5：`POST /api/admin/prize/create` 已 410 ⇒ 发布入口删除（页面只读化） */}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">{t('adminCommon.loading')}</div>
      ) : (
        <div className="grid gap-4">
          {rewards.map((reward) => (
            <Card key={reward.bID}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{reward.name || t('adminRewards.fallbackName', { id: reward.bID })}</h3>
                    <p className="text-sm text-gray-600 mt-1">{reward.description || t('adminCommon.noDescription')}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="primary">{t('adminCommon.pointsValue', { value: reward.points })}</Badge>
                      <Badge variant="secondary">{t('adminRewards.total', { value: reward.total_quantity || reward.gift_limit || 0 })}</Badge>
                      <Badge variant="secondary">{t('adminRewards.stock', { value: reward.stores_count || 0 })}</Badge>
                      <Badge variant="secondary">{t('adminRewards.claimed', { value: reward.claims_count || 0 })}</Badge>
                      <Badge variant="secondary">{t('adminRewards.currentShards', { value: reward.current_shard_supply || 0 })}</Badge>
                      {reward.price_floor_enabled && (
                        <Badge variant="secondary">{t('adminRewards.floorPrice', { value: reward.minimum_shard_price || 0 })}</Badge>
                      )}
                      <Badge variant="warning">
                        {reward.lifecycle_status === 'circulation'
                          ? t('adminRewards.circulating', { days: Math.ceil((reward.circulation_seconds || 0) / 86400) })
                          : reward.lifecycle_status === 'liquidation'
                            ? t('adminRewards.liquidating', { days: Math.ceil((reward.liquidation_seconds || 0) / 86400) })
                            : t('adminRewards.expired')}
                      </Badge>
                      <Badge variant="secondary">{t('adminRewards.freeShardsRatio', { value: reward.free_shard_ratio || 0 })}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openViewModal(reward)} title={t('adminCommon.viewDetail')}>
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
            {modalMode === 'create' ? t('adminRewards.modalCreate') : modalMode === 'edit' ? t('adminRewards.modalEdit') : t('adminRewards.modalView')}
          </ModalTitle>
        </ModalHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelSymbol')}</label>
              <input
                type="text"
                value={formState.symbol}
                onChange={(e) => setFormState((prev) => ({ ...prev, symbol: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelName')}</label>
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
            <label className="block text-sm font-medium mb-2">{t('adminRewards.labelDescription')}</label>
            <textarea
              value={formState.description}
              onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              disabled={isReadonlyModal}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('adminRewards.labelImageUrl')}</label>
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
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelPoints')}</label>
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
              <label className="block text-sm font-medium mb-2">{t('adminRewards.floorPointsLabel')}</label>
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
                  ? t('adminRewards.floorPriceHint', { price: minimumShardPrice })
                  : t('adminRewards.floorPriceIneligible')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelTotalQuantity')}</label>
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
              {t('adminRewards.floorPriceLabel')}
              <span className="ml-2 font-semibold text-gray-900">
                {priceFloorEligible ? `${minimumShardPrice} J` : t('adminRewards.notEnabled')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelStart')}</label>
              <input
                type="datetime-local"
                value={formState.time_start}
                onChange={(e) => setFormState((prev) => ({ ...prev, time_start: e.target.value }))}
                disabled={isReadonlyModal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelEnd')}</label>
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
              <label className="block text-sm font-medium mb-2">{t('adminRewards.labelFreeRatio')}</label>
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
              {t('adminRewards.maxFreeShards')}
              <span className="ml-2 font-semibold text-gray-900">
                {Math.floor((Number(formState.total_quantity) || 0) * 1000 * ((Number(formState.free_shard_ratio) || 0) / 100))}
              </span>
            </div>
          </div>
          {selectedReward && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statRedeemed')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.issued_quantity || selectedReward.claims_count || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statActivated')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.redeemed_quantity || selectedReward.activated_count || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statShardCap')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.market_shard_cap || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.floorPointsLabel')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.market_floor_points || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statFreeDistributed')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.free_shards_distributed || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statFreeRemaining')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.free_shards_remaining || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statMarketRemaining')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.remaining_market_shards || 0}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('adminRewards.statMinShardPrice')}</div>
                <div className="mt-1 font-semibold text-gray-900">{selectedReward.minimum_shard_price || 0} J</div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              {t('adminCommon.close')}
            </Button>
            {/* §2.4 S5：保存（`admin/prize/create|update`）已 410 ⇒ 保存按钮删除（模态框为只读详情） */}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RewardsManagement
