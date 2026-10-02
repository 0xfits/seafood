import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, localizeFields } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import {
  QUOTE_CID,
  cancelAllOrders,
  cancelOrder,
  createOrderPlaceTracker,
  fetchMarketTrades,
  fetchMyOrders,
  fetchOrderBook,
  orderPlaceFingerprint,
  placeOrder,
} from './market-api'
// 批 7-A：「账本流水」面板 = 已注册读口 `GET /api/user/ledger?kind=transfer`
//   （§5.1「碎片读口 ②」：旧 `GET /api/shard/transfer` 的语义由本读口取代）
import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../../ledger-api'
import './market.css'

// ============================================================================
// 交易所线 · 页面（P4-B4c-ii-b / Kong）
// 接线（全部**已注册**路径；真源 backend-ts/src/index.ts，逐面行号见 ./market-api.js）：
//   行情/盘口 GET /api/market/:base_cid/orderbook  · 成交流水 GET /api/market/:base_cid/trades（公开只读）
//   我的挂单 GET /api/order（actor）· 挂单 POST /api/order（`create_key` fail-loud）
//   撤单 DELETE /api/order/:oID · 全撤 DELETE /api/order（**query only**，本页不发 body）
// 幂等键：挂单 = **前端供键**（`cli:`，tracker 保证同一次操作重试同键）；撤单/全撤 = 服务端派生（`biz:market:cancel:<id>`）。
// 金额口径：挂单的 `price`/`amount` 是交易**要约**（供给侧自主出价，§4.8.1）；`owner_uid` 一律服务端取 token actor，
//   本页**结构性不传**（传了也会被服务端丢弃，回包 `client_owner_uid_ignored`）。成交价 = 买单限价（M3），本页不做撮合。
// 空态口径（批 7-A 更新）：「账本流水」读口（`GET /api/user/ledger`）**已注册** ⇒ 本页渲染**真数据**
//   （本页面板走**转让口径** `?kind=transfer`，看下方 `loadLedger`）；**仅当真·零流水**时才显示空态。
//   本页的「成交流水」是**另一个面**（`market_trade`，只读），两者不可混为一谈。
// 退化币对（§5.103 裁定 · P4-B4c-ii-c ②）：`baseCid === QUOTE_CID`（`$` 对自身）⇒ **不发** `orderbook`/`trades` 请求，
//   空态文案 = `market.pairDegenerate`（四语），与「真无挂单」（`market.bookEmpty`，请求发出去、回包为空）**区分**。
// 失败态：一律走 R107 链（`error.message` 已是字符串）⇒ 页面不会出现 `[object Object]`。
// 断点：窄屏单列 + 底部 tab（shell 承担）；宽屏行情两列 / 盘口+流水两列（本页 CSS 的断点层）。
// ============================================================================
const MARKET_LIMIT = 50

// P7-E 小尾巴批-β ②：`market_order` 枚举字段取值域 = CHECK 白名单（现取真源，**不猜**）
//   · `status`：`backend-ts/migrations/0016_market.sql:144` ⇒ `open|partial|filled|cancelled`，默认 `open`
//   · `side`  ：`backend-ts/migrations/0016_market.sql:130` ⇒ `buy|sell`（CHECK 在 :130；`:135` 是 price 注释 —— 本单订正）
//   ★ 父单提示的「真源 = `0015_listing.sql` 的 `listing_order.status`」**不适用于本行**：
//     本页「我的挂单」= `GET /api/order` ⇒ `database.ts:3538 listOrdersByUser`（`SELECT o.* FROM market_order`）
//     ⇒ 回包 `side`/`status` 来自 **`market_order`**（`normalizeMarketOrder` 均实返，非空）。以现取为准。
//   标签键 = 本单新增 `orders.statusLabel.*` / `orders.sideLabel.*`（四语齐备，含 `unknown` 兜底）。
const MARKET_ORDER_STATUS_KEYS = ['open', 'partial', 'filled', 'cancelled']
const MARKET_ORDER_SIDE_KEYS = ['buy', 'sell']

const MarketPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()

  const [base, setBase] = useState('')
  const [form, setForm] = useState({ side: 'buy', price: '', amount: '' })
  const [book, setBook] = useState({ phase: 'idle', rows: [], message: '' })
  const [trades, setTrades] = useState({ phase: 'idle', rows: [], message: '' })
  const [mine, setMine] = useState({ phase: 'idle', rows: [], message: '' })
  // 批 7-A：账本流水（转让口径）= `GET /api/user/ledger?kind=transfer` 真数据；
  //   `next` = `next_before_txid` 游标（`null` = 到底）；真·零流水 ⇒ 空态。
  const [ledger, setLedger] = useState({ rows: [], next: null, message: '' })
  const [act, setAct] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createOrderPlaceTracker(), [])

  const baseCid = Number(base)
  const basePositive = Number.isInteger(baseCid) && baseCid > 0
  // §5.103 裁定：`baseCid === QUOTE_CID`（`$` 对自身）= **退化币对** —— 与「`quote_cid` 恒 1 且 base≠quote」互斥
  // ⇒ 该路径恒空态；本页**结构性不发请求**（不是「请求回来恰好是空」）。
  const baseDegenerate = basePositive && baseCid === QUOTE_CID
  const baseValid = basePositive && !baseDegenerate

  // 行情（公开面）：**只有合法且非退化**的 base_cid 才请求（退化 ⇒ 不发；未填/非法 ⇒ 不发）
  const loadMarket = useCallback(async () => {
    if (baseDegenerate) {
      const message = t('market.pairDegenerate')
      setBook({ phase: 'empty', rows: [], message })
      setTrades({ phase: 'empty', rows: [], message })
      return
    }
    if (!baseValid) {
      setBook({ phase: 'empty', rows: [], message: t('market.bookEmpty') })
      setTrades({ phase: 'empty', rows: [], message: t('market.tradesEmpty') })
      return
    }
    setBook({ phase: 'loading', rows: [], message: t('loading') })
    setTrades({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const [bookRows, tradeRows] = await Promise.all([
        fetchOrderBook(baseCid, user),
        fetchMarketTrades(baseCid, user, MARKET_LIMIT),
      ])
      const b = Array.isArray(bookRows) ? bookRows : []
      const tr = Array.isArray(tradeRows) ? tradeRows : []
      setBook({ phase: b.length ? 'ok' : 'empty', rows: b, message: b.length ? '' : t('market.bookEmpty') })
      setTrades({ phase: tr.length ? 'ok' : 'empty', rows: tr, message: tr.length ? '' : t('market.tradesEmpty') })
    } catch (error) {
      const message = String(error?.message || t('error'))
      setBook({ phase: 'error', rows: [], message })
      setTrades({ phase: 'error', rows: [], message })
    }
  }, [baseValid, baseCid, user, t])

  const loadMine = useCallback(async () => {
    if (!isAuthenticated) {
      setMine({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setMine({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const rows = await fetchMyOrders(user)
      const list = Array.isArray(rows) ? rows : []
      setMine({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('market.mineEmpty') })
    } catch (error) {
      setMine({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { loadMarket() }, [loadMarket])
  useEffect(() => { loadMine() }, [loadMine])

  // 批 7-A：账本流水（**转让口径** `kind=transfer`；§5.1「碎片读口 ②」语义替代面）。
  //   未登录 ⇒ 空态；已登录 ⇒ 读 `GET /api/user/ledger?kind=transfer`（DL25 keyset 分页）。
  const loadLedger = useCallback(async (beforeTxid = null) => {
    if (!isAuthenticated) {
      setLedger({ rows: [], next: null, message: t('pleaseLogin') })
      return
    }
    try {
      const { rows, nextBeforeTxid } = await fetchMyLedger({
        user,
        kind: 'transfer',
        beforeTxid,
        limit: LEDGER_PAGE_SIZE,
      })
      setLedger((prev) => ({
        rows: beforeTxid ? [...prev.rows, ...rows] : rows,
        next: nextBeforeTxid,
        message: '',
      }))
    } catch (error) {
      setLedger((prev) => ({ ...prev, message: String(error?.message || t('error')) }))
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { loadLedger(null) }, [loadLedger])

  const refresh = async () => {
    await Promise.all([loadMarket(), loadMine(), loadLedger(null)])
  }

  const onPlace = async (event) => {
    event.preventDefault()
    if (act.phase === 'loading') return
    if (!baseValid) {
      setAct({ phase: 'error', message: t('market.baseNote') })
      return
    }
    const fingerprint = orderPlaceFingerprint({ side: form.side, baseCid, price: form.price, amount: form.amount })
    const createKey = tracker.keyFor(fingerprint) // 同一次操作重试 ⇒ 同键（服务端 fail-loud，缺键 ⇒ 400）
    setAct({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await placeOrder({
        side: form.side,
        baseCid,
        price: String(form.price).trim(),
        amount: String(form.amount).trim(),
        createKey,
        user,
      })
      tracker.reset()
      setAct({ phase: 'ok', message: t('market.placeOk') })
      await refresh()
    } catch (error) {
      setAct({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const onCancel = async (orderId) => {
    setAct({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await cancelOrder(orderId, user) // 键 = 服务端派生 ⇒ 前端不传；手续费不退（DL87）
      setAct({ phase: 'ok', message: t('market.cancelOk') })
      await refresh()
    } catch (error) {
      setAct({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const onCancelAll = async () => {
    setAct({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await cancelAllOrders(user) // **query only**：本层不发 body（§9.B B12）
      setAct({ phase: 'ok', message: t('market.cancelAllOk') })
      await refresh()
    } catch (error) {
      setAct({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const lastTrade = trades.rows[0] || null
  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）。
  //   · 「我的挂单」行 = `market_order` 行（`/api/order`）⇒ 面板渲染的文本键只有 `side`/`status`（枚举文本）。
  //     本页对这两个键（+ 预留 `name`/`title`）走**本地化读口**：载荷带 `*_<lang>` 即生效；
  //     载荷没有该后缀列（现取：TR-1b 未合并）⇒ **零行为变化**；`zh` 档 ⇒ 行原样（`localizeFields` 直返）。
  //   · 盘口（`listOrderBook`）/成交流水（`listTradesByBrand`）行**无用户录入文本**（逐键取证见报告 §3）。
  const lang = getLanguageFromUrl(location.pathname)
  const mineRows = mine.rows.map((row) => localizeFields(row, ['name', 'title', 'side', 'status'], lang))

  return (
    <div className="sf-layout" data-sf-m="mkt-layout">
      <div className="sf-layout-main">
        <div className="sf-mkt" data-sf-m="mkt">
          <div className="sf-mkt-head" data-sf-m="mkt-hero">
            <h1 className="sf-mkt-title">{t('market.title')}</h1>
            <p className="sf-mkt-note">{t('market.note')}</p>
            <div className="sf-mkt-actions">
              <Link className="sf-mkt-link" to={buildLocalizedPath(lang, '/listing')}>{t('listings.line')}</Link>
              <Link className="sf-mkt-link" to={buildLocalizedPath(lang, '/listing/new')}>{t('listings.publish')}</Link>
              <button className="sf-btn sf-mkt-btn" type="button" onClick={refresh} data-sf-m="mkt-refresh">{t('market.refresh')}</button>
            </div>
          </div>

          {/* 行情条：窄屏单列 / 宽屏两列；无成交 ⇒ 显示占位，不用假数据 */}
          <div className="sf-mkt-ticker" data-sf-m="mkt-ticker">
            <div>
              <div className="sf-mkt-pair">{`#${baseValid ? baseCid : '-'} / #${QUOTE_CID}`}</div>
              <div className="sf-mkt-last">{trades.phase === 'ok' && lastTrade ? String(lastTrade.price ?? '-') : '-'}</div>
            </div>
            <div>
              <div className="sf-mkt-pair">{t('market.trades')}</div>
              <div className="sf-mkt-meta">{`${trades.phase} · ${trades.rows.length}`}</div>
            </div>
          </div>

          {/* 挂单：`create_key` = 前端供键（fail-loud） */}
          <form className="sf-mkt-panel" onSubmit={onPlace} data-sf-m="mkt-form">
            <div className="sf-mkt-form">
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.side')}</span>
                <select
                  className="sf-mkt-select"
                  data-sf-m="mkt-side"
                  value={form.side}
                  onChange={(e) => setForm((p) => ({ ...p, side: e.target.value }))}
                >
                  <option value="buy">{t('market.buy')}</option>
                  <option value="sell">{t('market.sell')}</option>
                </select>
              </label>
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.baseCid')}</span>
                <input
                  className="sf-mkt-input"
                  data-sf-m="mkt-input-base"
                  value={base}
                  inputMode="numeric"
                  onChange={(e) => setBase(e.target.value)}
                  placeholder={t('market.baseNote')}
                />
              </label>
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.price')}</span>
                <input
                  className="sf-mkt-input"
                  data-sf-m="mkt-input-price"
                  value={form.price}
                  inputMode="numeric"
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  required
                />
              </label>
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.amount')}</span>
                <input
                  className="sf-mkt-input"
                  data-sf-m="mkt-input-amount"
                  value={form.amount}
                  inputMode="numeric"
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="sf-mkt-row">
              <button className="sf-btn sf-mkt-btn" type="submit" data-sf-m="mkt-primary" disabled={act.phase === 'loading' || !isAuthenticated}>
                {t('market.place')}
              </button>
              <span
                className={`sf-mkt-status${act.phase === 'error' ? ' sf-mkt-err' : ''}${act.phase === 'ok' ? ' sf-mkt-ok' : ''}`}
                data-sf-m="mkt-status"
                data-sf-phase={act.phase}
                role="status"
              >
                {act.message}
              </span>
            </div>
            <p className="sf-mkt-note">{t('market.placeNote')}</p>
          </form>

          {/* 盘口 + 成交流水：窄屏单列 / 宽屏两列（DOM 顺序恒定） */}
          <div className="sf-mkt-cols">
            <div className="sf-mkt-panel" data-sf-m="mkt-book">
              <h2 className="sf-mkt-title">{t('market.book')}</h2>
              {book.rows.length === 0
                ? <div className="sf-mkt-empty" data-sf-m="mkt-book-empty">{book.message || t('market.bookEmpty')}</div>
                : book.rows.map((row, i) => (
                  <div className="sf-mkt-book-row" key={`${row.side}-${row.price}-${i}`}>
                    <span className={row.side === 'buy' ? 'sf-mkt-side-buy' : 'sf-mkt-side-sell'}>
                      {row.side === 'buy' ? t('market.buy') : t('market.sell')}
                    </span>
                    <span>{String(row.price ?? '-')}</span>
                    <span>{String(row.volume ?? '-')}</span>
                  </div>
                ))}
              <p className="sf-mkt-note">{t('market.bookNote')}</p>
            </div>

            <div className="sf-mkt-panel" data-sf-m="mkt-trades">
              <h2 className="sf-mkt-title">{t('market.trades')}</h2>
              {trades.rows.length === 0
                ? <div className="sf-mkt-empty" data-sf-m="mkt-trades-empty">{trades.message || t('market.tradesEmpty')}</div>
                : trades.rows.map((row, i) => (
                  <div className="sf-mkt-trade-row" key={String(row.trade_id ?? i)}>
                    <span>{String(row.price ?? '-')}</span>
                    <span>{String(row.amount ?? '-')}</span>
                    <span>{`#${String(row.buyer_uID ?? '-')}→#${String(row.seller_uID ?? '-')}`}</span>
                  </div>
                ))}
              <p className="sf-mkt-note">{t('market.tradesNote')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-mkt-panel" data-sf-m="mkt-mine">
          <h2 className="sf-mkt-title">{t('market.mine')}</h2>
          <div className="sf-mkt-row">
            <button
              className="sf-btn sf-mkt-btn"
              type="button"
              onClick={onCancelAll}
              data-sf-m="mkt-cancel-all"
              disabled={!isAuthenticated || act.phase === 'loading'}
            >
              {t('market.cancelAll')}
            </button>
          </div>
          {mine.rows.length === 0
            ? <div className="sf-mkt-empty" data-sf-m="mkt-mine-empty">{mine.message || t('market.mineEmpty')}</div>
            : mineRows.map((row) => {
              // P7-E 小尾巴批-β ②：枚举字段（`status`/`side`）**不得原样渲染**（原文把 `market_order`
              //   的 DB 枚举 `open`/`buy` 等直接给用户看）。已知取值 ⇒ 四语标签（`orders.statusLabel.*`
              //   / `orders.sideLabel.*`）；**未知取值 ⇒ 本地化兜底**；原值留 `title`/`data-sf-*`（仅排查用）；
              //   缺省/空串 ⇒ 空串（维持既有口径）。
              const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
              const statusText = statusRaw === ''
                ? ''
                : (MARKET_ORDER_STATUS_KEYS.includes(statusRaw)
                  ? t(`orders.statusLabel.${statusRaw}`)
                  : t('orders.statusLabel.unknown'))
              const sideRaw = row.side == null || row.side === '' ? '' : String(row.side)
              const sideText = sideRaw === ''
                ? ''
                : (MARKET_ORDER_SIDE_KEYS.includes(sideRaw)
                  ? t(`orders.sideLabel.${sideRaw}`)
                  : t('orders.sideLabel.unknown'))
              return (
                <div className="sf-mkt-item" key={String(row.order_id ?? row.oID)} data-sf-m="mkt-order">
                  <div className="sf-mkt-item-title" data-sf-side={sideRaw || undefined} title={sideRaw || undefined}>
                    {`#${String(row.order_id ?? row.oID ?? '-')} · ${sideText}`}
                    {/* 「翻译中」小标（`i18n_status ∈ {pending, partial}`；ready/缺省 ⇒ null） */}
                    <TranslatingBadge status={contentStatus(row)} />
                  </div>
                  <div className="sf-mkt-price">{String(row.price ?? '-')}</div>
                  <div className="sf-mkt-meta" data-sf-status={statusRaw || undefined} title={statusRaw || undefined}>{`${String(row.amount ?? '-')}/${String(row.amount_filled ?? '-')} · ${statusText}`}</div>
                  <button
                    className="sf-btn sf-mkt-btn"
                    type="button"
                    onClick={() => onCancel(String(row.order_id ?? row.oID ?? ''))}
                    data-sf-m="mkt-cancel-one"
                  >
                    {t('market.cancel')}
                  </button>
                </div>
              )
            })}
          <p className="sf-mkt-note">{t('market.mineNote')}</p>
        </div>

        {/* 账本流水（**转让口径**）：读口 = 已注册 `GET /api/user/ledger?kind=transfer`
            （§5.1「碎片读口 ②」；批 7-A 接线）⇒ 渲染真数据；**仅当真·零流水**时才显示空态。 */}
        <div className="sf-mkt-panel" data-sf-m="mkt-ledger">
          <h2 className="sf-mkt-title">{t('ledger.flow')}</h2>
          {ledger.rows.length === 0
            ? <div className="sf-mkt-empty" data-sf-m="mkt-ledger-empty">{ledger.message || t('ledger.flowEmpty')}</div>
            : (
              <div data-sf-m="mkt-ledger-list">
                {ledger.rows.map((entry) => (
                  <div className="sf-mkt-item" key={String(entry.txid)} data-sf-m="mkt-ledger-item">
                    <div className="sf-mkt-item-title">{t(`ledger.kind.${entry.kind}`)}</div>
                    <div className="sf-mkt-meta">
                      {`${Number(entry.delta) > 0 ? '+' : ''}${entry.delta}`}
                      {' · '}
                      {entry.time_created ? new Date(entry.time_created * 1000).toLocaleDateString() : '—'}
                    </div>
                  </div>
                ))}
                {ledger.next != null && (
                  <button
                    type="button"
                    className="sf-mkt-btn"
                    data-sf-m="mkt-ledger-more"
                    onClick={() => loadLedger(ledger.next)}
                  >
                    {t('ledger.flowMore')}
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

export default MarketPage
