import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import { buyListing, createListingBuyTracker, fetchListingDetail, listingBuyFingerprint } from './listing-api'
import './listings.css'

// P7-E 小尾巴批-β ①：`listing.status` 取值域 = `public.listing.status` 的 CHECK 白名单
//   （现取：`backend-ts/migrations/0015_listing.sql:137` ⇒ `draft|listed|delisted|frozen`，默认 `draft`）
//   与列表页（`ListingsPage.jsx`）同一键族 `listings.statusLabel.*`（四语齐备）。
const LISTING_STATUS_KEYS = ['draft', 'listed', 'delisted', 'frozen']

// ============================================================================
// 商品线 · 详情 + 购买（P4-B4c-ii-b / Kong）
// 详情：`GET /api/prize/:bID`（**已注册** :433）= `listing` 行（`bID` = `listing_id`）；miss ⇒ 404（R107）。
// 购买：`POST /api/listing/:listingId/buy`（**已注册** :1569）。
//   ★ **金额与对手方一律服务端取数**：payload 只有 `create_key` + `quantity`
//     （`listing-funds-service.ts:210,214` 逐字只读这两键）；页面**没有**任何 price/seller 输入参与请求
//     —— 客户端就算传 `price`/`seller_uid`/`buyer_uid` 也被忽略（实测读数见报告 §HTTP-B8）。
//   ★ 幂等键 = **前端供键**（fail-loud：缺 `cli:` 键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）。
//   `self_purchase_not_allowed`：卖家买自己的商品 ⇒ 400（服务端闸，页面不做客户端判价/判人）。
// 失败态：走 R107 链 ⇒ 页面不会出现 `[object Object]`。
// ============================================================================
const ListingDetailPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { listingId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [detail, setDetail] = useState({ phase: 'loading', row: null, message: '' })
  const [quantity, setQuantity] = useState('1')
  const [buy, setBuy] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createListingBuyTracker(), [])

  const load = useCallback(async () => {
    setDetail({ phase: 'loading', row: null, message: t('loading') })
    try {
      const row = await fetchListingDetail(listingId, user)
      setDetail({ phase: row ? 'ok' : 'empty', row: row || null, message: row ? '' : t('listings.empty') })
    } catch (error) {
      // 404（miss）与 5xx 都走这里：文案已是 R107 链解出的**字符串**
      setDetail({ phase: 'error', row: null, message: String(error?.message || t('error')) })
    }
  }, [listingId, user, t])

  useEffect(() => { load() }, [load])

  const onBuy = async (event) => {
    event.preventDefault()
    if (buy.phase === 'loading') return
    const createKey = tracker.keyFor(listingBuyFingerprint({ listingId, quantity }))
    setBuy({ phase: 'loading', message: t('jobs.submitting') })
    try {
      const view = await buyListing(listingId, { quantity: String(quantity).trim(), createKey, user })
      tracker.reset()
      setBuy({ phase: 'ok', message: `${t('listings.buyOk')} · ${t('listings.orderId')} #${view?.order_id ?? '-'}` })
      await load()
    } catch (error) {
      setBuy({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const row = detail.row || {}
  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）；用户内容字段取当前语言，空串/缺字段 ⇒ 回落原文
  const lang = getLanguageFromUrl(location.pathname)
  // F2 修复：站内链接 = 当前语言前缀 + 站内路径（唯一构造器 utils.buildLocalizedPath）
  const root = (p) => buildLocalizedPath(lang, p)
  const title = pickLocalized(row, 'title', lang) || pickLocalized(row, 'name', lang) || t('listings.detail')
  const description = pickLocalized(row, 'description', lang) || ''

  // P7-E 小尾巴批-β ①：listing 状态**不得原样渲染枚举**（原 `String(row.status ?? '-')` 会把
  //   `draft`/`listed` 等 DB 枚举直接给用户看）。已知取值 ⇒ 四语标签；**未知取值 ⇒ 本地化兜底**
  //   （`listings.statusLabel.unknown`）；原值留 `title`/`data-sf-status`（仅排查用）。
  //   缺省/空串 ⇒ 维持既有口径（现网 `GET /api/prize/:bID` 读侧不返回 `status` ⇒ 实测 distinct = {缺失}）
  //   ⇒ 本页原口径 = `-`（与列表页「缺失 ⇒ 已上架」**不同**，不擅自改动）。
  const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
  const statusText = statusRaw === ''
    ? '-'
    : (LISTING_STATUS_KEYS.includes(statusRaw)
      ? t(`listings.statusLabel.${statusRaw}`)
      : t('listings.statusLabel.unknown'))

  return (
    <div className="sf-layout" data-sf-m="listing-detail-layout">
      <div className="sf-layout-main">
        <div className="sf-listings">
          <div className="sf-listings-head" data-sf-m="listing-detail-hero">
            <h1 className="sf-listings-title">
              {String(title)}
              {/* 「翻译中」小标（ready/缺省 ⇒ null） */}
              <TranslatingBadge status={contentStatus(row)} />
            </h1>
            <p
              className="sf-listings-note"
              data-sf-status={statusRaw || undefined}
              title={statusRaw || undefined}
            >{`${t('listings.listingId')} #${String(row.listing_id ?? row.bID ?? listingId ?? '-')} · ${statusText}`}</p>
            <div className="sf-listings-actions">
              <Link className="sf-listings-link" to={root('/listing')} data-sf-m="listing-back-link">{t('listings.list')}</Link>
              <button className="sf-btn sf-listings-btn" type="button" onClick={load} data-sf-m="listing-detail-refresh">{t('listings.refresh')}</button>
            </div>
          </div>

          {detail.phase !== 'ok' ? (
            <div className="sf-listings-empty" data-sf-m="listing-detail-empty" data-sf-phase={detail.phase}>
              {detail.message || t('noData')}
            </div>
          ) : (
            <div className="sf-listings-panel" data-sf-m="listing-detail">
              <div className="sf-listings-thumb" data-sf-m="listing-detail-thumb" />
              <div className="sf-listings-price">
                <span className="sf-listings-price-cur">$</span>
                <span className="sf-listings-price-num">{String(row.price ?? row.points ?? '-')}</span>
                <span className="sf-listings-price-unit">{t('listings.priceUnit')}</span>
              </div>
              <p className="sf-listings-meta">{t('listings.stock')}{` ${String(row.stock ?? '-')}`}</p>
              <p className="sf-listings-meta">{String(description)}</p>
            </div>
          )}

          <form className="sf-listings-panel" onSubmit={onBuy} data-sf-m="listing-buy-form">
            <h2 className="sf-listings-title">{t('listings.buy')}</h2>
            <div className="sf-listings-form">
              <label className="sf-listings-field">
                <span className="sf-listings-label">{t('listings.quantity')}</span>
                <input
                  className="sf-listings-input"
                  data-sf-m="listing-input-qty"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  required
                />
              </label>
            </div>
            <p className="sf-listings-meta">{t('listings.buyNote')}</p>
            <div className="sf-listings-row">
              <button className="sf-btn sf-listings-btn" type="submit" data-sf-m="listing-buy-btn" disabled={buy.phase === 'loading' || !isAuthenticated}>
                {t('listings.buy')}
              </button>
              <span
                className={`sf-listings-status${buy.phase === 'error' ? ' sf-listings-err' : ''}${buy.phase === 'ok' ? ' sf-listings-ok' : ''}`}
                data-sf-m="listing-buy-status"
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
        <div className="sf-listings-panel" data-sf-m="listing-detail-side">
          <h2 className="sf-listings-title">{t('listings.line')}</h2>
          <p className="sf-listings-meta">{t('listings.priceServerNote')}</p>
          <p className="sf-listings-meta">{t('listings.refundStockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default ListingDetailPage
