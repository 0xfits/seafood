import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import { buyListing, createListingBuyTracker, fetchListingDetail, listingBuyFingerprint } from './item-api'
import './item.css'

// P7-E 小尾巴批-β ①：`listing.status` 取值域 = `public.listing.status` 的 CHECK 白名单
//   （现取：`backend-ts/migrations/0015_listing.sql:137` ⇒ `draft|listed|delisted|frozen`，默认 `draft`）
//   与列表（首页）同一键族 `item.statusLabel.*`（四语齐备）。
const LISTING_STATUS_KEYS = ['draft', 'listed', 'delisted', 'frozen']

// ============================================================================
// 闲置物品线 · 详情 + 购买（原 `pages/listings/ListingDetailPage.jsx`；2026-10-11 合并单改名单为 `item`）
// 路由（LangShell 内层相对段）：
//   · `item/:itemId`（**原 `listing/:listingId`**）⇒ 详情；
//   · **同路由 `?id=` 兼容**：`item`（无 `/item/:itemId` 段）由 App.jsx 挂**本组件**，
//     无 params 时按 query 的 `id` 渲染详情；两者都无 id ⇒ 重定向首页 `/`（保留语言前缀）。
// 详情：`GET /api/prize/:bID`（**已注册** :433）= `listing` 行（`bID` = `listing_id`）；miss ⇒ 404（R107）。
// 购买：`POST /api/listing/:listingId/buy`（**已注册** :1569）。
//   ★ **金额与对手方一律服务端取数**：payload 只有 `create_key` + `quantity`（`listing-funds-service.ts:210,214`）
//     —— 页面**没有**任何 price/seller 输入参与请求；客户端传 `price`/`seller_uid`/`buyer_uid` 也被忽略。
//   ★ 幂等键 = **前端供键**（fail-loud：缺 `cli:` 键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）。
// 后端面一字不动：`/api/prize/…` 与 `/api/listing…` 路径名保持不变（本单只改前端路由与文件命名）。
// ============================================================================
const ItemDetailPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { itemId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [detail, setDetail] = useState({ phase: 'loading', row: null, message: '' })
  const [quantity, setQuantity] = useState('1')
  const [buy, setBuy] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createListingBuyTracker(), [])

  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）
  const lang = getLanguageFromUrl(location.pathname)
  // F2 修复：站内链接 = 当前语言前缀 + 站内路径（唯一构造器 utils.buildLocalizedPath）
  const root = (p) => buildLocalizedPath(lang, p)

  // `?id=` 兼容：无 `/item/:itemId` 段（同路由 `item`）时取 query 的 `id`（同一组件两处挂载）
  const queryId = new URLSearchParams(location.search).get('id')
  const id = itemId || queryId || ''

  const load = useCallback(async () => {
    setDetail({ phase: 'loading', row: null, message: t('loading') })
    try {
      const row = await fetchListingDetail(id, user)
      setDetail({ phase: row ? 'ok' : 'empty', row: row || null, message: row ? '' : t('item.empty') })
    } catch (error) {
      // 404（miss）与 5xx 都走这里：文案已是 R107 链解出的**字符串**
      setDetail({ phase: 'error', row: null, message: String(error?.message || t('error')) })
    }
  }, [id, user, t])

  useEffect(() => { if (id) load() }, [id, load])

  // 无 id（`/item` 且无 `?id`）⇒ 自洽处理：重定向首页（保留语言前缀；Kevin 口径「一句话可改」）。
  if (!id) {
    return <Navigate to={root('/')} replace />
  }

  const onBuy = async (event) => {
    event.preventDefault()
    if (buy.phase === 'loading') return
    const createKey = tracker.keyFor(listingBuyFingerprint({ listingId: id, quantity }))
    setBuy({ phase: 'loading', message: t('jobs.submitting') })
    try {
      const view = await buyListing(id, { quantity: String(quantity).trim(), createKey, user })
      tracker.reset()
      setBuy({ phase: 'ok', message: `${t('item.buyOk')} · ${t('item.orderId')} #${view?.order_id ?? '-'}` })
      await load()
    } catch (error) {
      setBuy({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const row = detail.row || {}
  const title = pickLocalized(row, 'title', lang) || pickLocalized(row, 'name', lang) || t('item.detail')
  const description = pickLocalized(row, 'description', lang) || ''

  // P7-E 小尾巴批-β ①：listing 状态**不得原样渲染枚举**。已知取值 ⇒ 四语标签；未知 ⇒ 本地化兜底（`item.statusLabel.unknown`）；
  //   原值留 `title`/`data-sf-status`（仅排查用）。缺省/空串 ⇒ 维持既有口径 = `-`（与列表「缺失 ⇒ 已上架」**不同**）。
  const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
  const statusText = statusRaw === ''
    ? '-'
    : (LISTING_STATUS_KEYS.includes(statusRaw)
      ? t(`item.statusLabel.${statusRaw}`)
      : t('item.statusLabel.unknown'))

  return (
    <div className="sf-layout" data-sf-m="item-detail-layout">
      <div className="sf-layout-main">
        <div className="sf-item">
          <div className="sf-item-head" data-sf-m="item-detail-hero">
            <h1 className="sf-item-title">
              {String(title)}
              {/* 「翻译中」小标（ready/缺省 ⇒ null） */}
              <TranslatingBadge status={contentStatus(row)} />
            </h1>
            <p
              className="sf-item-note"
              data-sf-status={statusRaw || undefined}
              title={statusRaw || undefined}
            >{`${t('item.listingId')} #${String(row.listing_id ?? row.bID ?? id ?? '-')} · ${statusText}`}</p>
            <div className="sf-item-actions">
              <Link className="sf-item-link" to={root('/')} data-sf-m="item-back-link">{t('item.list')}</Link>
              <button className="sf-btn sf-item-btn" type="button" onClick={load} data-sf-m="item-detail-refresh">{t('item.refresh')}</button>
            </div>
          </div>

          {detail.phase !== 'ok' ? (
            <div className="sf-item-empty" data-sf-m="item-detail-empty" data-sf-phase={detail.phase}>
              {detail.message || t('noData')}
            </div>
          ) : (
            <div className="sf-item-panel" data-sf-m="item-detail">
              <div className="sf-item-thumb" data-sf-m="item-detail-thumb" />
              <div className="sf-item-price">
                <span className="sf-item-price-cur">$</span>
                <span className="sf-item-price-num">{String(row.price ?? row.points ?? '-')}</span>
                <span className="sf-item-price-unit">{t('item.priceUnit')}</span>
              </div>
              <p className="sf-item-meta">{t('item.stock')}{` ${String(row.stock ?? '-')}`}</p>
              <p className="sf-item-meta">{String(description)}</p>
            </div>
          )}

          <form className="sf-item-panel" onSubmit={onBuy} data-sf-m="item-buy-form">
            <h2 className="sf-item-title">{t('item.buy')}</h2>
            <div className="sf-item-form">
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.quantity')}</span>
                <input
                  className="sf-item-input"
                  data-sf-m="item-input-qty"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  required
                />
              </label>
            </div>
            <p className="sf-item-meta">{t('item.buyNote')}</p>
            <div className="sf-item-row">
              <button className="sf-btn sf-item-btn" type="submit" data-sf-m="item-buy-btn" disabled={buy.phase === 'loading' || !isAuthenticated}>
                {t('item.buy')}
              </button>
              <span
                className={`sf-item-status${buy.phase === 'error' ? ' sf-item-err' : ''}${buy.phase === 'ok' ? ' sf-item-ok' : ''}`}
                data-sf-m="item-buy-status"
                data-sf-phase={buy.phase}
                role="status"
              >
                {buy.message || (isAuthenticated ? '' : t('pleaseLogin'))}
              </span>
            </div>
          </form>
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-item-panel" data-sf-m="item-detail-side">
          <h2 className="sf-item-title">{t('item.line')}</h2>
          <p className="sf-item-meta">{t('item.priceServerNote')}</p>
          <p className="sf-item-meta">{t('item.refundStockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default ItemDetailPage
