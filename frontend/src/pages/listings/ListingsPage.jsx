import React, { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLangPath } from '../../utils'
import { fetchListingFeed, fetchMyListingOrders, refundListingOrder } from './listing-api'
import './listings.css'

// ============================================================================
// 商品线 · 列表 + 我的商品订单 + 退款入口（P4-B4c-ii-b / Kong）
// 列表：`GET /api/prize/all`（**已注册** :382；读侧已换源 `listing`：`bID`=listing_id、`name`=title、`points`=price）
//       —— 这是**商品读面**（§4.6 批 2 换源），行键沿用旧形状 ⇒ 页面按 `bID` 跳详情。
// 详情：见 ./ListingDetailPage.jsx（`GET /api/prize/:bID`）。
// 我的订单：`GET /api/prize-item`（**已注册** :546）→ `listing_order`（`buyer_uid=me AND status='paid'`，
//       `database.ts:1066`）＝**买家轴**，行键 `gID`=order_id。
// 退款：`POST /api/listing-orders/:orderId/refund`（**已注册** :1590；**actor = 仅卖方**）。
//       ★ 「按卖家列订单」的读口**未注册** ⇒ `order_id` 只能**手填**（与招工线 `accept` 缺读口时同一处置：
//         手填 + 明文说明），**不自造**列表。非卖方 ⇒ 服务端 `403 AUTH_FORBIDDEN`（负例已实测）。
//       ★ 退款**不回滚库存**（既有单点裁定 `REFUND_ROLLS_BACK_STOCK = false`，`listing-funds-service.ts:163`）。
// 幂等键：退款面 = **服务端派生**（`biz:listing:refund:<order_id>`，`0015_listing.sql:667`）⇒ 本页不传键。
// 失败态：走 R107 链 ⇒ 页面不会出现 `[object Object]`。
// 断点：窄屏一列 + 底部 tab（shell 承担）；中档 2 列；宽屏 4 列（本页 CSS 的断点层）。
// ============================================================================
const FEED_LIMIT = 60

const ListingsPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [feed, setFeed] = useState({ phase: 'loading', rows: [], message: '' })
  const [orders, setOrders] = useState({ phase: 'idle', rows: [], message: '' })
  const [refund, setRefund] = useState({ phase: 'idle', message: '' })
  const [orderId, setOrderId] = useState('')

  const loadFeed = useCallback(async () => {
    setFeed({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const rows = await fetchListingFeed(user, FEED_LIMIT)
      const list = Array.isArray(rows) ? rows : []
      setFeed({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('listings.empty') })
    } catch (error) {
      setFeed({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [user, t])

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setOrders({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const rows = await fetchMyListingOrders(user)
      const list = Array.isArray(rows) ? rows : []
      setOrders({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('listings.myOrdersEmpty') })
    } catch (error) {
      setOrders({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { loadFeed() }, [loadFeed])
  useEffect(() => { loadOrders() }, [loadOrders])

  const onRefund = async (event) => {
    event.preventDefault()
    const id = String(orderId).trim()
    if (!id) {
      setRefund({ phase: 'error', message: t('listings.refundNeedId') })
      return
    }
    setRefund({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await refundListingOrder(id, user) // 键 = 服务端派生 ⇒ 不传
      setRefund({ phase: 'ok', message: t('listings.refundOk') })
      await loadOrders()
    } catch (error) {
      setRefund({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const entry = buildLangPath(location.pathname, undefined)
  const root = (p) => (entry === '/' ? p : `${entry}${p}`)

  return (
    <div className="sf-layout" data-sf-m="listing-feed-layout">
      <div className="sf-layout-main">
        <div className="sf-listings">
          <div className="sf-listings-head" data-sf-m="listing-feed-hero">
            <h1 className="sf-listings-title">{t('listings.list')}</h1>
            <p className="sf-listings-note">{t('listings.listNote')}</p>
            <div className="sf-listings-actions">
              <Link className="sf-listings-link" to={root('/listing/new')} data-sf-m="listing-publish-link">{t('listings.publish')}</Link>
              <button className="sf-btn sf-listings-btn" type="button" onClick={loadFeed} data-sf-m="listing-refresh">{t('listings.refresh')}</button>
            </div>
          </div>

          {feed.rows.length === 0 ? (
            <div className="sf-listings-empty" data-sf-m="listing-feed-empty" data-sf-phase={feed.phase}>
              {feed.message || t('listings.empty')}
            </div>
          ) : (
            <div className="sf-listings-grid" data-sf-m="listing-grid">
              {feed.rows.map((row) => {
                const listingId = row.bID ?? row.listing_id ?? row.id
                return (
                  <Link className="sf-listings-card" key={String(listingId)} to={root(`/listing/${listingId}`)} data-sf-m="listing-card">
                    <div className="sf-listings-thumb" data-sf-m="listing-thumb" />
                    <div className="sf-listings-card-title">{String(row.name ?? row.title ?? t('noData'))}</div>
                    <div className="sf-listings-price">
                      <span className="sf-listings-price-cur">$</span>
                      <span className="sf-listings-price-num">{String(row.points ?? row.price ?? '-')}</span>
                      <span className="sf-listings-price-unit">{t('listings.priceUnit')}</span>
                    </div>
                    <span className="sf-listings-tag">{String(row.status ?? t('listings.listed'))}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-listings-panel" data-sf-m="listing-orders">
          <h2 className="sf-listings-title">{t('listings.myOrders')}</h2>
          {orders.rows.length === 0
            ? <div className="sf-listings-empty" data-sf-m="listing-orders-empty" data-sf-phase={orders.phase}>{orders.message || t('listings.myOrdersEmpty')}</div>
            : orders.rows.map((row) => (
              <div className="sf-listings-item" key={String(row.gID ?? row.order_id)} data-sf-m="listing-order">
                <div className="sf-listings-item-title">{`#${String(row.gID ?? row.order_id ?? '-')}`}</div>
                <div className="sf-listings-meta">{`${t('listings.listingId')} #${String(row.bID ?? row.listing_id ?? '-')}`}</div>
              </div>
            ))}
          <p className="sf-listings-meta">{t('listings.ordersNote')}</p>
        </div>

        <div className="sf-listings-panel" data-sf-m="listing-refund">
          <h2 className="sf-listings-title">{t('listings.refund')}</h2>
          <form className="sf-listings-row" onSubmit={onRefund}>
            <input
              className="sf-listings-input"
              data-sf-m="listing-input-order"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder={t('listings.orderId')}
            />
            <button className="sf-btn sf-listings-btn" type="submit" data-sf-m="listing-refund-btn" disabled={refund.phase === 'loading'}>
              {t('listings.refund')}
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
          <p className="sf-listings-meta">{t('listings.refundNote')}</p>
          <p className="sf-listings-meta">{t('listings.refundStockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default ListingsPage
