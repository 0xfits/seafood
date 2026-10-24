import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { getLanguageFromUrl } from '../../utils'
import { fetchMyListingOrders, refundListingOrder, shipListingOrder, receiveListingOrder } from './item-api'
import { toastCredit } from '../../toast-credit'
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

// 可选钩子名（sf14 · D7 变更 2026-10-14）：渲染点自首页迁至 /profile 我的交易-我买到的，
// 冻结契约钩子 = trades-bought-list / trades-bought-empty ⇒ 经 props 换名（默认值 = 旧名，渲染一字不变）。
const MyOrdersPanel = ({ listHook = 'item-orders', emptyHook = 'item-orders-empty' }) => {
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
      // ★ 2026-10-24 Toast 双轨（承 T126 / T139）：退款到账 = **余额增加类** ⇒ 成功只走
      //   `toastCredit`（页面正中 / 18px / 5s），卡内**不写**成功文案；失败仍内联（下方 catch）。
      toastCredit(t('item.refundOk'))
      setRefund({ phase: 'ok', message: '' })
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
      const okText = `${base} · ${t(`listingOrders.statusLabel.${statusKey}`)}`
      if (action === 'ship') {
        // 发货**不在**「余额增加类」名单（T139 逐条清单）⇒ 内联照旧，一字不改
        setOrderAction({ phase: 'ok', message: okText })
      } else {
        // ★ 2026-10-24 Toast 双轨（T139）：确认收货 = **卖方货款入账** = 余额增加类
        //   ⇒ 成功只走 `toastCredit`（页面正中 / 18px / 5s），卡内零成功文案；失败仍内联。
        toastCredit(okText)
        setOrderAction({ phase: 'ok', message: '' })
      }
    } catch (error) {
      setOrderAction({ phase: 'error', message: String(error?.message || t('listingOrders.actionFail')) })
    }
  }

  return (
    <section className="sf-item-orders" data-sf-m="item-orders-section" data-sf-lang={lang}>
      <div className="sf-item-panel" data-sf-m={listHook}>
        <h2 className="sf-item-title">{t('item.myOrders')}</h2>
        {orders.rows.length === 0
          ? <div className="sf-item-empty" data-sf-m={emptyHook} data-sf-phase={orders.phase}>{orders.message || t('item.myOrdersEmpty')}</div>
          : orders.rows.map((row) => (
            <div className="sf-item-item" key={String(row.gID ?? row.order_id)} data-sf-m="item-order">
              <div className="sf-item-item-title">{`#${String(row.gID ?? row.order_id ?? '-')}`}</div>
              <div className="sf-item-meta">{`${t('item.listingId')} #${String(row.bID ?? row.listing_id ?? '-')}`}</div>
            </div>
          ))}
        <p className="sf-item-meta">{t('item.ordersNote')}</p>
      </div>

      <div className="sf-item-panel" data-sf-m="item-refund">
        <h2 className="sf-item-title">{t('item.refund')}</h2>
        <form className="sf-item-row" onSubmit={onRefund}>
          <input
            className="sf-item-input"
            data-sf-m="item-input-order"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder={t('item.orderId')}
          />
          <button className="sf-btn sf-item-btn" type="submit" data-sf-m="item-refund-btn" disabled={refund.phase === 'loading'}>
            {t('item.refund')}
          </button>
        </form>
        <span
          className={`sf-item-status${refund.phase === 'error' ? ' sf-item-err' : ''}${refund.phase === 'ok' ? ' sf-item-ok' : ''}`}
          data-sf-m="item-refund-status"
          data-sf-phase={refund.phase}
          role="status"
        >
          {refund.message}
        </span>
        <p className="sf-item-meta">{t('item.refundNote')}</p>
        <p className="sf-item-meta">{t('item.refundStockNote')}</p>
      </div>

      {/* P9③：订单发货 / 收货（actor = 卖方 / 买方本人）。「按卖家列订单」读口未注册 ⇒ 沿用退款面板「手填订单号」形态。 */}
      <div className="sf-item-panel" data-sf-m="item-order-actions">
        <h2 className="sf-item-title">{t('item.myOrders')}</h2>
        <div className="sf-item-row">
          <input
            className="sf-item-input"
            data-sf-m="item-input-order-action"
            value={orderActionId}
            onChange={(event) => setOrderActionId(event.target.value)}
            placeholder={t('item.orderId')}
          />
          <button
            className="sf-btn sf-item-btn"
            type="button"
            data-sf-m="item-ship-btn"
            onClick={() => onOrderAction('ship')}
            disabled={orderAction.phase === 'loading'}
          >
            {t('listingOrders.shipButton')}
          </button>
          <button
            className="sf-btn sf-item-btn"
            type="button"
            data-sf-m="item-receive-btn"
            onClick={() => onOrderAction('receive')}
            disabled={orderAction.phase === 'loading'}
          >
            {t('listingOrders.receiveButton')}
          </button>
        </div>
        <span
          className={`sf-item-status${orderAction.phase === 'error' ? ' sf-item-err' : ''}${orderAction.phase === 'ok' ? ' sf-item-ok' : ''}`}
          data-sf-m="item-order-action-status"
          data-sf-phase={orderAction.phase}
          role="status"
        >
          {orderAction.message}
        </span>
      </div>
    </section>
  )
}

// ============================================================================
// 卖家侧订单动作面（sf14 · D7 变更 2026-10-14）：「我卖出的」子页承载 发货 + 退款 两个写动作。
// 与上方退款/发货/收货面板同一「手填订单号 + 按钮」形态；actor = 卖家本人（服务端判权）；
// 文案全部复用既有 listingOrders.* / item.* 键，零新增重复。
// ============================================================================
export const SellerOrderActions = ({ onDone }) => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [orderId, setOrderId] = useState('')
  const [action, setAction] = useState({ phase: 'idle', message: '' })

  const run = async (kind) => {
    if (!isAuthenticated) {
      setAction({ phase: 'error', message: t('pleaseLogin') })
      return
    }
    const id = String(orderId).trim()
    if (!id) {
      setAction({ phase: 'error', message: t('item.refundNeedId') })
      return
    }
    setAction({ phase: 'loading', message: t('jobs.submitting') })
    try {
      const data = kind === 'ship' ? await shipListingOrder(id, user) : await refundListingOrder(id, user)
      const base = kind === 'ship' ? t('listingOrders.shipOk') : t('item.refundOk')
      // 发货回执 `status` ⇒ 经 listingOrders.statusLabel.* 本地化展示（不渲染原始枚举；缺省 ⇒ 只报动作成功）
      const statusRaw = String(data?.status ?? '')
      const message = kind === 'ship' && ORDER_STATUS_KEYS.includes(statusRaw)
        ? `${base} · ${t(`listingOrders.statusLabel.${statusRaw}`)}`
        : base
      setAction({ phase: 'ok', message })
      if (onDone) await onDone()
    } catch (error) {
      setAction({ phase: 'error', message: String(error?.message || (kind === 'ship' ? t('listingOrders.actionFail') : t('error'))) })
    }
  }

  return (
    <div className="sf-item-panel" data-sf-m="trades-sold-actions">
      <h2 className="sf-item-title">{t('item.myOrders')}</h2>
      <div className="sf-item-row">
        <input
          className="sf-item-input"
          data-sf-m="trades-sold-input-order"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder={t('item.orderId')}
        />
        <button
          className="sf-btn sf-item-btn"
          type="button"
          data-sf-m="trades-sold-ship-btn"
          onClick={() => run('ship')}
          disabled={action.phase === 'loading'}
        >
          {t('listingOrders.shipButton')}
        </button>
        <button
          className="sf-btn sf-item-btn"
          type="button"
          data-sf-m="trades-sold-refund-btn"
          onClick={() => run('refund')}
          disabled={action.phase === 'loading'}
        >
          {t('item.refund')}
        </button>
      </div>
      <span
        className={`sf-item-status${action.phase === 'error' ? ' sf-item-err' : ''}${action.phase === 'ok' ? ' sf-item-ok' : ''}`}
        data-sf-m="trades-sold-action-status"
        data-sf-phase={action.phase}
        role="status"
      >
        {action.message}
      </span>
    </div>
  )
}

export default MyOrdersPanel
