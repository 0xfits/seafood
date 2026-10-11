import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { getLanguageFromUrl } from '../../utils'
import { fetchMyListingOrders, refundListingOrder, shipListingOrder, receiveListingOrder } from './item-api'
import './item.css'

// ============================================================================
// 闲置物品线 · 「我的订单」整块（原 `pages/listings/ListingsPage.jsx` 的侧栏三面板，
// 2026-10-11 合并单迁出：`ListingsPage` 的**列表渲染**已删（唯一列表 = 首页），
// 本组能力**零丢失**地落在首页的「我的订单」区块（登录后渲染）。
//
// 能力映射（逐项）：
//   · 我的订单列表   ← `GET /api/prize-item`（**已注册** :546）→ `listing_order`（`buyer_uid=me`，买家轴），行键 `gID`=order_id
//   · 退款           ← `POST /api/listing-orders/:orderId/refund`（**actor = 仅卖方**；键 = 服务端派生 ⇒ 不传）
//   · 发货           ← `POST /api/listing-orders/:orderId/ship`（actor = 卖方本人）
//   · 收货           ← `POST /api/listing-orders/:orderId/receive`（actor = 买方本人）
//   · 空态           ← `orders.message` / `listings.myOrdersEmpty`（= 改名单后 `item.myOrdersEmpty`）
//   ★「按卖家列订单」读口未注册 ⇒ `order_id` 只能**手填**（与招工线缺读口同一处置：手填 + 明文说明），**不自造**列表。
//   ★ 退款**不回滚库存**（既有单点裁定 `REFUND_ROLLS_BACK_STOCK = false`）。
// ============================================================================

// P9③：`listing_order.status` 取值域 = `listing_order_status_enum` 白名单（6 值 · 承 §32.4(b)）∪ 兜底 `unknown`
const ORDER_STATUS_KEYS = ['created', 'paid', 'shipped', 'received', 'refunded', 'cancelled']

const MyOrdersPanel = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [orders, setOrders] = useState({ phase: 'idle', rows: [], message: '' })
  const [refund, setRefund] = useState({ phase: 'idle', message: '' })
  const [orderId, setOrderId] = useState('')
  const [orderActionId, setOrderActionId] = useState('')
  const [orderAction, setOrderAction] = useState({ phase: 'idle', message: '' })

  const lang = getLanguageFromUrl(location.pathname)

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setOrders({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const rows = await fetchMyListingOrders(user)
      const list = Array.isArray(rows) ? rows : []
      setOrders({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('item.myOrdersEmpty') })
    } catch (error) {
      setOrders({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { loadOrders() }, [loadOrders])

  const onRefund = async (event) => {
    event.preventDefault()
    const id = String(orderId).trim()
    if (!id) {
      setRefund({ phase: 'error', message: t('item.refundNeedId') })
      return
    }
    setRefund({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await refundListingOrder(id, user) // 键 = 服务端派生 ⇒ 不传
      setRefund({ phase: 'ok', message: t('item.refundOk') })
      await loadOrders()
    } catch (error) {
      setRefund({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // P9③：发货 / 收货动作口（回执 `status` ⇒ 经 `listingOrders.statusLabel.*` 本地化展示；**不渲染原始枚举**）
  const onOrderAction = async (action) => {
    const id = String(orderActionId).trim()
    if (!id) {
      setOrderAction({ phase: 'error', message: t('item.refundNeedId') })
      return
    }
    setOrderAction({ phase: 'loading', message: t('jobs.submitting') })
    try {
      const data = action === 'ship' ? await shipListingOrder(id, user) : await receiveListingOrder(id, user)
      const statusRaw = String(data?.status ?? '')
      const statusKey = ORDER_STATUS_KEYS.includes(statusRaw) ? statusRaw : 'unknown'
      const base = action === 'ship' ? t('listingOrders.shipOk') : t('listingOrders.receiveOk')
      setOrderAction({ phase: 'ok', message: `${base} · ${t(`listingOrders.statusLabel.${statusKey}`)}` })
    } catch (error) {
      setOrderAction({ phase: 'error', message: String(error?.message || t('listingOrders.actionFail')) })
    }
  }

  return (
    <section className="sf-item-orders" data-sf-m="listing-orders-section" data-sf-lang={lang}>
      <div className="sf-listings-panel" data-sf-m="listing-orders">
        <h2 className="sf-listings-title">{t('item.myOrders')}</h2>
        {orders.rows.length === 0
          ? <div className="sf-listings-empty" data-sf-m="listing-orders-empty" data-sf-phase={orders.phase}>{orders.message || t('item.myOrdersEmpty')}</div>
          : orders.rows.map((row) => (
            <div className="sf-listings-item" key={String(row.gID ?? row.order_id)} data-sf-m="listing-order">
              <div className="sf-listings-item-title">{`#${String(row.gID ?? row.order_id ?? '-')}`}</div>
              <div className="sf-listings-meta">{`${t('item.listingId')} #${String(row.bID ?? row.listing_id ?? '-')}`}</div>
            </div>
          ))}
        <p className="sf-listings-meta">{t('item.ordersNote')}</p>
      </div>

      <div className="sf-listings-panel" data-sf-m="listing-refund">
        <h2 className="sf-listings-title">{t('item.refund')}</h2>
        <form className="sf-listings-row" onSubmit={onRefund}>
          <input
            className="sf-listings-input"
            data-sf-m="listing-input-order"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder={t('item.orderId')}
          />
          <button className="sf-btn sf-listings-btn" type="submit" data-sf-m="listing-refund-btn" disabled={refund.phase === 'loading'}>
            {t('item.refund')}
          </button>
        </form>
        <span
          className={`sf-listings-status${refund.phase === 'error' ? ' sf-listings-err' : ''}${refund.phase === 'ok' ? ' sf-listings-ok' : ''}`}
          data-sf-m="listing-refund-status"
          data-sf-phase={refund.phase}
          role="status"
        >
          {refund.message}
        </span>
        <p className="sf-listings-meta">{t('item.refundNote')}</p>
        <p className="sf-listings-meta">{t('item.refundStockNote')}</p>
      </div>

      {/* P9③：订单发货 / 收货（actor = 卖方 / 买方本人）。「按卖家列订单」读口未注册 ⇒ 沿用退款面板「手填订单号」形态。 */}
      <div className="sf-listings-panel" data-sf-m="listing-order-actions">
        <h2 className="sf-listings-title">{t('item.myOrders')}</h2>
        <div className="sf-listings-row">
          <input
            className="sf-listings-input"
            data-sf-m="listing-input-order-action"
            value={orderActionId}
            onChange={(event) => setOrderActionId(event.target.value)}
            placeholder={t('item.orderId')}
          />
          <button
            className="sf-btn sf-listings-btn"
            type="button"
            data-sf-m="listing-ship-btn"
            onClick={() => onOrderAction('ship')}
            disabled={orderAction.phase === 'loading'}
          >
            {t('listingOrders.shipButton')}
          </button>
          <button
            className="sf-btn sf-listings-btn"
            type="button"
            data-sf-m="listing-receive-btn"
            onClick={() => onOrderAction('receive')}
            disabled={orderAction.phase === 'loading'}
          >
            {t('listingOrders.receiveButton')}
          </button>
        </div>
        <span
          className={`sf-listings-status${orderAction.phase === 'error' ? ' sf-listings-err' : ''}${orderAction.phase === 'ok' ? ' sf-listings-ok' : ''}`}
          data-sf-m="listing-order-action-status"
          data-sf-phase={orderAction.phase}
          role="status"
        >
          {orderAction.message}
        </span>
      </div>
    </section>
  )
}

export default MyOrdersPanel
