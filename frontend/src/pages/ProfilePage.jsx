import React, { useCallback, useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { User, Mail, Calendar, Trophy, Star, Edit3, Save, X } from 'lucide-react'

// 新的 UI 组件
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'
import { useTranslation } from 'react-i18next'
// 用户头像编辑（Kevin 2026-10-22）：账户设置 pane 顶部 —— 64px 头像 + 换图/恢复默认；
//   上传走 `image-compress` → `POST /api/media` → `POST /api/user/profile {avatar_url}`（写口本单新增）。
import ProfileAvatarEditor from '../components/ProfileAvatarEditor'
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../utils'
// ★ route §49.16：商品详情链接段统一取 `item_code`（缺失回落数字 id）。
import { itemLinkId } from '../item-link'
import { contentStatus, pickLocalized } from '../i18n-content'
import TranslatingBadge from '../components/i18n/TranslatingBadge'
// P9②：电量卡 + 签到区（Kevin 2026-10-14 需求③：已迁出；2026-10-20 起落点 = /wage 顶部 —— 本文件不再渲染）。
import RatingTimelinessPanel from '../components/RatingTimelinessPanel'
// Kevin 2026-10-20 需求①②：BTTC 资产块（余额 / 铸造 / 分解）自 `/wage#batt-checkin` 迁入本页「我的资产」。
import BttcAssetPanel from '../components/BttcAssetPanel'
// Kevin 2026-10-21 需求②：`/profile/assets` 顶部按币种的余额卡片（读口 = 既有 `GET /api/user/balances`；
//   归一 / 千分位格式化一律复用 balances-api，本页零自算）。
import { fetchUserBalances, formatBalanceAmount, toBalanceCards } from '../balances-api'
// 招工线 / 我的 共用的 token + 栅格层（P4-B4c-ii-a）：与 TaskPage 招工线族同一份样式表
import './jobs/jobs.css'
// Kevin 2026-10-14 需求②：桌面侧栏布局样式（页面局部 --sf-l-*，零新主题 token）
import './profile.css'
// D7 变更（2026-10-14）：MyOrdersPanel 渲染点自首页迁入「我买到的」子页（组件复用；发货/收货/退款可达）
import MyOrdersPanel, { SellerOrderActions } from './item/MyOrdersPanel'
// 发布列表行内动作（2026-10-20 · design §26.13）：【降价】= 字段模式 PATCH（只传 price）；
//   【编辑】= 跳 /item/:id/edit。取数层 = item-api（本页其余交易取数仍在 trades-api，不跨线复用）。
import { updateListingFields } from './item/item-api'
// sf14 需求④：交易/收藏取数层（契约冻结；后端并行单实现中）
import { addFavorite, fetchFavorites, fetchMyListings, fetchSoldOrders, removeFavorite } from '../trades-api'
import { fetchApiJson, fetchCurrentUser, getAuthHeaders, updateMyProfile } from '../auth'
import { useAuth } from '../auth-context'
import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../ledger-api'
// v1.17 §20.2（T102）· Telegram 通知绑定面（`/api/telegram` 族 3 条读/写口；env 缺 ⇒ 503 TG_NOT_CONFIGURED 降级）。
import {
  confirmTelegramBind,
  fetchTelegramBindStatus,
  isTelegramNotConfigured,
  startTelegramBind,
  unbindTelegram,
} from '../messages-api'
// tg-bind-v2 扫码主路径：QR = react-qr-code（零依赖纯 SVG；禁外部 QR 图片服务——隐私/可用性）。
import QRCode from 'react-qr-code'

const toDate = (value) => new Date(typeof value === 'number' ? value * 1000 : value)

// ============================================================================
// Kevin 2026-10-14 需求②：/profile 桌面档重构 = 「左侧菜单 + 右侧内容」
// ----------------------------------------------------------------------------
// 视图派生（单一真源 = `profileViewOf`，按 pathname 尾段解析）：
//   · /profile(/:lang 前缀)                 ⇒ 我的交易-我买到的（落地口径；生产路由先重定向到 trades/bought）
//   · /profile/trades/published|sold|bought ⇒ 我的交易三子页（非法值按 bought 处理）
//   · /profile/favorites                    ⇒ 我的收藏
//   · /profile/assets                       ⇒ 我的资产（BTTC 资产块：余额 / 铸造 / 分解；2026-10-20 需求①②）
//   · /profile/settings                     ⇒ 账户设置
// 左栏菜单（桌面 ≥768 固定宽，手机 ≤767 横向页签，见 profile.css）：我的交易（三子项）/ 我的收藏 / 账户设置。
// 既有内容归位（派单方裁定）：账户设置 = 基本信息卡（bio 编辑往返）+ 用户资产卡 + 账本读数
//   + 任务统计与成就徽章 + 碎片持仓 + Telegram 通知卡 + 评分/时效面板；电量卡 + 签到 = `/wage` 顶部。
// 钩子（§质检探针）：profile-nav（侧栏根）/ profile-nav-trades / profile-nav-{published,sold,bought,favorites,assets,settings}
//   / profile-assets-view（我的资产 pane；内含 bttc-asset 面板钩子）
//   / trades-{published,sold,bought}-list（各配 -empty）/ fav-list（配 -empty）/ settings-view。
// ============================================================================

// `profile/trades/:subTab` 合法取值（非法值按 bought 处理）
const PROFILE_TRADE_TABS = ['published', 'sold', 'bought']
const PROFILE_DEFAULT_TRADE_TAB = 'bought'

// 行内状态**不得原样渲染枚举**（承 ItemDetailPage/MyOrdersPanel 同一口径）：
//   listing.status = draft|listed|delisted|frozen（item.statusLabel.*）；listing_order.status = 6 值白名单（listingOrders.statusLabel.*）。
//   未知取值 ⇒ 各族 `unknown` 兜底键；缺省/空串 ⇒ `unknown` 同兜底（与「列表缺失」口径不同，从紧）。
const LISTING_STATUS_KEYS = ['draft', 'listed', 'delisted', 'frozen']
const ORDER_STATUS_KEYS = ['created', 'paid', 'shipped', 'received', 'refunded', 'cancelled']
// S8① 静态键守卫口径：家族名不得以**裸点号字面量**出场（'item.statusLabel' 会被判「非叶键缺四语」）⇒
// 与 MyOrdersPanel / ItemDetailPage 同形：模板族键进 t()（前缀族弱断言）+ `unknown` 兜底走叶键字面量。
const listingStatusLabel = (t, raw) => {
  const value = String(raw ?? '')
  return LISTING_STATUS_KEYS.includes(value) ? t(`item.statusLabel.${value}`) : t('item.statusLabel.unknown')
}
const orderStatusLabel = (t, raw) => {
  const value = String(raw ?? '')
  return ORDER_STATUS_KEYS.includes(value) ? t(`listingOrders.statusLabel.${value}`) : t('listingOrders.statusLabel.unknown')
}

const profileViewOf = (pathname) => {
  const parts = String(pathname).replace(/\/+$/, '').split('/')
  const last = parts[parts.length - 1] || ''
  const prev = parts[parts.length - 2] || ''
  if (last === 'favorites') return { kind: 'favorites', subTab: '' }
  if (last === 'settings') return { kind: 'settings', subTab: '' }
  if (last === 'assets') return { kind: 'assets', subTab: '' }
  if (prev === 'trades') {
    return { kind: 'trades', subTab: PROFILE_TRADE_TABS.includes(last) ? last : PROFILE_DEFAULT_TRADE_TAB }
  }
  // /profile（含裸渲染兜底口径）：默认视图 = 我的交易-我买到的（与 index 重定向落地一致）
  return { kind: 'trades', subTab: PROFILE_DEFAULT_TRADE_TAB }
}

// ============================================================================
// 我的交易 · 三个子页（published=我发布的 / sold=我卖出的 / bought=我买到的）
// ----------------------------------------------------------------------------
// Kevin 2026-10-14 需求④ 数据接线（后端契约冻结）+ D7 变更（2026-10-14）：
//   published ⇒ GET /api/listing/mine（trades-api）；sold ⇒ GET /api/listing-orders/sold（trades-api）
//     + 发货/退款动作面（SellerOrderActions，复用 item-api 既有写口，同款输入+按钮形态）；
//   bought ⇒ **MyOrdersPanel 原样挂载**（渲染点自首页迁入；`/api/prize-item` 买家轴 + 退款/发货/收货仍可达；
//     钩子经可选 props 换名为冻结契约 trades-bought-list / trades-bought-empty）。
//   行内状态走既有四语标签族（item.statusLabel.* / listingOrders.statusLabel.*），不渲染原始枚举。
// ============================================================================
const TradesPane = ({ subTab, user, isAuthenticated, lang }) => {
  const tab = PROFILE_TRADE_TABS.includes(subTab) ? subTab : PROFILE_DEFAULT_TRADE_TAB
  if (tab === 'published') return <PublishedList user={user} isAuthenticated={isAuthenticated} lang={lang} />
  if (tab === 'sold') return <SoldList user={user} isAuthenticated={isAuthenticated} />
  return <BoughtPane isAuthenticated={isAuthenticated} />
}

// 我发布的：GET /api/listing/mine ⇒ 行(listing_id/title/price/cid/status/stock/media_urls/time_created/description/item_type)
// 行内动作（2026-10-20 · design §26.13）：仅 draft|listed 显示【降价】【编辑】两按钮（sold/delisted 只读）；
//   行结构 = 「链接区 + 动作区」两段 —— **禁止 button 嵌 `<a>`**（a>button 非法嵌套 + 双发导航）。
// 【降价】= 行内弹层：整数且 1 ≤ 新价 < 现价（涨价走编辑页）；提交 = 字段模式 PATCH **只传 `{price}`**；
//   成功后**行内价格即时更新**（改本地该行，不跳页、不整表重取）。
// 【编辑】= 跳 `/item/:id/edit`（独立编辑页，同语言前缀）。
const PublishedList = ({ user, isAuthenticated, lang }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'idle', rows: [], message: '' })
  // 行内【降价】弹层状态（`lowerFor` = 正在降价的 listing_id 字符串；'' = 无弹层）
  const [lowerFor, setLowerFor] = useState('')
  const [lowerValue, setLowerValue] = useState('')
  const [lowerBusy, setLowerBusy] = useState(false)
  const [lowerErr, setLowerErr] = useState('')

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setState((prev) => ({ ...prev, phase: 'loading', message: '' }))
    try {
      const rows = await fetchMyListings(user)
      const list = Array.isArray(rows) ? rows : []
      setState({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('profileNav.emptyPublished') })
    } catch (error) {
      setState({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { load() }, [load])

  const rowIdOf = (row) => String(row?.listing_id ?? row?.bID ?? '')
  const lowerRow = state.rows.find((row) => rowIdOf(row) === lowerFor) || null
  // 闸 = **整数**且 `1 ≤ 新价 < 现价`；非法 ⇒ 确认按钮置灰 + 内联提示（不发起请求）。
  const lowerPrice = /^\d+$/.test(String(lowerValue).trim()) ? Number(String(lowerValue).trim()) : NaN
  const currentPrice = Number(String(lowerRow?.price ?? '').trim())
  const lowerInvalid = !(
    Number.isInteger(lowerPrice)
    && lowerPrice >= 1
    && Number.isFinite(currentPrice)
    && lowerPrice < currentPrice
  )
  const lowerInputEmpty = String(lowerValue).trim() === ''

  const openLower = (row) => { setLowerFor(rowIdOf(row)); setLowerValue(''); setLowerErr('') }
  const closeLower = () => { setLowerFor(''); setLowerValue(''); setLowerErr('') }

  const submitLower = async () => {
    if (!lowerRow || lowerInvalid || lowerBusy) return
    setLowerBusy(true)
    setLowerErr('')
    try {
      await updateListingFields(rowIdOf(lowerRow), { price: lowerPrice }, user)
      // 成功 ⇒ 只改本地这一行（价格即时可见），**不跳页、不整表重取**
      setState((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => (rowIdOf(row) === lowerFor ? { ...row, price: lowerPrice } : row)),
      }))
      closeLower()
    } catch (error) {
      setLowerErr(String(error?.message || t('error')))
    } finally {
      setLowerBusy(false)
    }
  }

  return (
    <div className="sf-prof-pane" data-sf-m="trades-published-list">
      <h1 className="sf-prof-pane-title">
        {t('profileNav.title')} · {t('profileNav.published')}
      </h1>
      {state.rows.length === 0 ? (
        <div className="sf-prof-empty" data-sf-m="trades-published-empty" data-sf-phase={state.phase}>
          {state.message || t('profileNav.emptyPublished')}
        </div>
      ) : (
        state.rows.map((row) => {
          const id = rowIdOf(row)
          // ★ route §49.16：**详情链接**用 `item_code`（规范形，缺失回落数字 id）；
          //   `id`（数字）继续承担行内动作 —— 【降价】PATCH / 【编辑】`/item/:id/edit` 端口只认数字。
          const linkId = itemLinkId(row) || id
          // `row?.status`（可选链）取值：既避开「String(<obj>.<field> ?? …)」工程口径形态面（p4z 类级断言），
          //   也顺带把 canAct 与 data-sf-status 收到同一取值上
          const statusText = String(row?.status ?? '')
          const canAct = statusText === 'draft' || statusText === 'listed'
          return (
            <div
              key={id}
              className="sf-prof-row-wrap"
              data-sf-m="trades-published-item"
              data-sf-status={statusText}
            >
              {/* 链接区（整行可点进详情）+ 动作区（按钮在 `<Link>` **外**，杜绝 a>button） */}
              <Link
                className="sf-prof-row"
                data-sf-m="trades-published-link"
                to={buildLocalizedPath(lang, `/item/${linkId}`)}
              >
                <span className="sf-prof-row-title">{String(row.title ?? '-')}</span>
                <span className="sf-prof-row-meta" data-sf-m="trades-published-price">
                  {`$${String(row.price ?? '-')}`}
                  {' · '}
                  {`${t('item.stock')} ${String(row.stock ?? '-')}`}
                  {' · '}
                  {listingStatusLabel(t, row.status)}
                </span>
              </Link>
              {canAct ? (
                <div className="sf-prof-row-actions" data-sf-m="trades-published-actions">
                  <button
                    type="button"
                    className="sf-prof-btn"
                    data-sf-m="trades-published-lower"
                    onClick={() => openLower(row)}
                  >
                    {t('item.lowerPrice')}
                  </button>
                  <button
                    type="button"
                    className="sf-prof-btn"
                    data-sf-m="trades-published-edit"
                    onClick={() => navigate(buildLocalizedPath(lang, `/item/${id}/edit`))}
                  >
                    {t('common.edit')}
                  </button>
                </div>
              ) : null}
              {lowerFor === id ? (
                <div className="sf-prof-lower" data-sf-m="trades-published-lower-panel">
                  <label className="sf-prof-lower-field">
                    <span className="sf-prof-lower-label">{t('item.newPrice')}</span>
                    <input
                      className="sf-prof-lower-input"
                      data-sf-m="trades-published-lower-input"
                      value={lowerValue}
                      onChange={(event) => { setLowerValue(event.target.value); setLowerErr('') }}
                      inputMode="numeric"
                      autoFocus
                    />
                  </label>
                  <span className="sf-prof-lower-hint" data-sf-m="trades-published-lower-err" role="status">
                    {lowerInvalid && !lowerInputEmpty ? t('item.lowerPriceInvalid') : ''}
                  </span>
                  <button
                    type="button"
                    className="sf-prof-btn"
                    data-sf-m="trades-published-lower-ok"
                    disabled={lowerInvalid || lowerBusy}
                    onClick={submitLower}
                  >
                    {lowerBusy ? t('jobs.submitting') : t('item.lowerPrice')}
                  </button>
                  <button
                    type="button"
                    className="sf-prof-btn"
                    data-sf-m="trades-published-lower-cancel"
                    onClick={closeLower}
                  >
                    ×
                  </button>
                  {lowerErr ? (
                    <span className="sf-prof-lower-fail" data-sf-m="trades-published-lower-fail" role="alert">{lowerErr}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}

// 我卖出的：GET /api/listing-orders/sold ⇒ 行 = prize-item 同族（gID/bID）+ status；含 发货+退款 动作面
const SoldList = ({ user, isAuthenticated }) => {
  const { t } = useTranslation()
  const [state, setState] = useState({ phase: 'idle', rows: [], message: '' })

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setState((prev) => ({ ...prev, phase: 'loading', message: '' }))
    try {
      const rows = await fetchSoldOrders(user)
      const list = Array.isArray(rows) ? rows : []
      setState({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('profileNav.emptySold') })
    } catch (error) {
      setState({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="sf-prof-pane" data-sf-m="trades-sold-list">
      <h1 className="sf-prof-pane-title">
        {t('profileNav.title')} · {t('profileNav.sold')}
      </h1>
      {state.rows.length === 0 ? (
        <div className="sf-prof-empty" data-sf-m="trades-sold-empty" data-sf-phase={state.phase}>
          {state.message || t('profileNav.emptySold')}
        </div>
      ) : (
        state.rows.map((row) => (
          <div key={String(row.gID ?? row.order_id)} className="sf-prof-row" data-sf-m="trades-sold-item">
            <span className="sf-prof-row-title">{`#${String(row.gID ?? row.order_id ?? '-')}`}</span>
            <span className="sf-prof-row-meta">
              {`${t('item.listingId')} #${String(row.bID ?? row.listing_id ?? '-')}`}
              {' · '}
              {orderStatusLabel(t, row.status)}
            </span>
          </div>
        ))
      )}
      {/* D7 变更：卖家侧 发货 + 退款 动作（同款输入+按钮形态；组件复用自 MyOrdersPanel.jsx，零新文案键） */}
      <SellerOrderActions onDone={load} />
    </div>
  )
}

// 我买到的：MyOrdersPanel 原样挂载（D7 渲染点迁移；未登录兜底态与组件内 pleaseLogin 口径一致）
const BoughtPane = ({ isAuthenticated }) => {
  const { t } = useTranslation()

  return (
    <div className="sf-prof-pane">
      <h1 className="sf-prof-pane-title">
        {t('profileNav.title')} · {t('profileNav.bought')}
      </h1>
      {!isAuthenticated ? (
        <div className="sf-prof-empty" data-sf-m="trades-bought-list">
          <span data-sf-m="trades-bought-empty">{t('pleaseLogin')}</span>
        </div>
      ) : (
        <MyOrdersPanel listHook="trades-bought-list" emptyHook="trades-bought-empty" />
      )}
    </div>
  )
}

// ============================================================================
// 我的收藏（Kevin 2026-10-14 需求④）：GET /api/favorites（收藏时间行）；行内「取消收藏」走幂等 DELETE；
//   空态 ⇒ profileNav.emptyFavorites。
// ============================================================================
const FavoritesPane = ({ user, isAuthenticated, lang }) => {
  const { t } = useTranslation()
  const [state, setState] = useState({ phase: 'idle', rows: [], message: '' })

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setState((prev) => ({ ...prev, phase: 'loading', message: '' }))
    try {
      const rows = await fetchFavorites(user)
      const list = Array.isArray(rows) ? rows : []
      setState({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('profileNav.emptyFavorites') })
    } catch (error) {
      setState({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { load() }, [load])

  const onRemove = async (listingId) => {
    try {
      await removeFavorite(listingId, user)
      await load() // 状态翻转 = 可见反馈（移除后行即刻消失）
    } catch (error) {
      toast.error(t('item.favoriteFail'))
    }
  }

  return (
    <div className="sf-prof-pane" data-sf-m="fav-list">
      <h1 className="sf-prof-pane-title">{t('profileNav.favorites')}</h1>
      {state.rows.length === 0 ? (
        <div className="sf-prof-empty" data-sf-m="fav-list-empty" data-sf-phase={state.phase}>
          {state.message || t('profileNav.emptyFavorites')}
        </div>
      ) : (
        state.rows.map((row) => (
          <div key={String(row.listing_id ?? row.bID)} className="sf-prof-row" data-sf-m="fav-item">
            <Link
              className="sf-prof-row-title"
              data-sf-m="fav-item-link"
              // ★ route §49.16：收藏行读口**不含** `item_code`（不在四读口闭集内）⇒ 回落数字 id 属预期降级。
              to={buildLocalizedPath(lang, `/item/${itemLinkId(row) ?? String(row.listing_id ?? row.bID ?? '-')}`)}
            >
              {String(row.title ?? '-')}
            </Link>
            <span className="sf-prof-row-meta">
              {`$${String(row.price ?? '-')}`}
              {' · '}
              {row.time_created ? toDate(row.time_created).toLocaleDateString() : '—'}
            </span>
            <Button variant="inactive" size="sm" onClick={() => onRemove(String(row.listing_id ?? row.bID))} data-sf-m="fav-remove">
              {t('item.favorite')}
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

// ============================================================================
// v1.17 §20.2（`T102`）· 「Telegram 通知」卡（三态 + 降级 · 归 AC-4）
// ----------------------------------------------------------------------------
// ① **未配置降级卡**：env 缺 ⇒ 绑定接口 `503 TG_NOT_CONFIGURED`（route §41.9；**不是** 500）⇒
//    静态降级文案 `telegram.notConfigured`、**无任何操作按钮**；不重试、不轮询 env 状态。
//    ★ 降级只落**卡片内**，绝不冒泡成整页报错（AC-4 判负项）。
// ② **未绑定态**：`telegram.bind` ⇒ `POST /api/telegram/bind/start` ⇒ 展示 `codeLabel` + `codeSteps`
//    （`{{bot}}`/`{{code}}` 插值 + 10 分钟有效）+ **等待回执**；成功（状态转 `tg_linked`）= `bindSuccess` → 转态③。
// ③ **已绑定态**：`telegram.bound` + `tg_linked_at` 日期 + `telegram.unbind` ⇒ **二次确认内联**
//    （不新造弹窗模板）⇒ 成功回态②。
// ★ **隐私红线（写死）**：绑定面**绝不显示** `tg_user_id` 数值 / 任何 Telegram handle
//   （route §41.5 判负②的读面对应）⇒ 本组件只消费 `tg_linked` / `tg_linked_at`，其余响应键**不读不渲染**。
// ★ **无轮询**（T103 同口径）：等待回执 = 用户点击「确认」触发一次状态读（`tg-bind-action`），
//   不是定时器；与 §20.6「三时点取数、禁 setInterval」一致。
// ★ 钩子（§20.5）：`tg-bind-card` / `tg-bind-status` / `tg-bind-code` / `tg-bind-steps` /
//   `tg-bind-action` / `tg-unbind-action`；根另挂 `data-sf-tg-state`（AC-4 采数用，属排查面）。
// ★ tg-bind-v2（2026-10-14 单）· 扫码绑定升主路径：code 态新增面板 `tg-bind-qr`（QR 内容 =
//   `https://t.me/<bot_username>`，**不带 start 载荷**——深链载荷限 64 字符且仅 A-Za-z0-9_-，刻意不用）
//   + `tg-bind-open` 新开链接 + `tg-bind-code-input` 短码输入（8 位纯数字 ⇒ inputMode=numeric 唤起数字键盘；提交前 trim 归一，toUpperCase 对数字为恒等）
//   + `tg-bind-confirm` ⇒ `POST /api/telegram/bind/confirm`；bot_username 缺/空 ⇒ 面板隐藏、回退旧长码路径。
//   旧长码路径**保留为次入口**（同一次 bind/start 响应，`<details>` 折叠；钩子与文案一字不改）。
//   新增 i18n 键 8 条（telegram.qrHint/qrOpen/codeInputPlaceholder/confirmBind/codeNotFound/
//   codeExpired/codeConsumed/accountTaken，四语同补）；confirm 失败按 TG 族 reason 映射文案。
// ★ 零新主题 token / 零新结构常量（v2 起不再是「零新 i18n 键」——见上条 8 键；样式全走既有 Tailwind 既有类）。
// ★ 依赖面纪律：effect 依赖 **`uid` 原始值**（不用 `sessionUser` 对象身份）—— 本仓测试替身每帧
//   新建 auth 对象，依赖对象身份会无限重渲染（同 ProfilePage 既有 effect 的 `sessionUser?.uID` 口径）。
// ============================================================================
const TelegramBindCard = () => {
  const { t } = useTranslation()
  const { isAuthenticated, user: sessionUser } = useAuth()
  const uid = sessionUser?.uID ?? sessionUser?.uid ?? null
  const [state, setState] = useState('loading') // loading | notConfigured | unbound | code | bound
  const [boundAt, setBoundAt] = useState(null)
  const [issued, setIssued] = useState(null) // { code, bot }
  const [shortCode, setShortCode] = useState('') // tg-bind-v2：扫码主路径的短码输入（提交前归一）
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')

  // 态②/③ 的取数 = `GET /api/telegram/bind/status`（**响应无 `tg_user_id`**）。
  useEffect(() => {
    if (!isAuthenticated || uid == null) return undefined
    let alive = true
    const run = async () => {
      try {
        const data = await fetchTelegramBindStatus(sessionUser)
        if (!alive) return
        setBoundAt(data?.tg_linked_at ?? null)
        setState(data?.tg_linked ? 'bound' : 'unbound')
      } catch (error) {
        if (!alive) return
        if (isTelegramNotConfigured(error)) { setState('notConfigured'); return }
        setNotice(String(error?.message || t('error')))
        setState('unbound')
      }
    }
    run()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isAuthenticated])

  // 态② ⇒ 取绑定码（env 缺 ⇒ 同一 503 降级判据，就地转降级卡）。
  const onBind = async () => {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const data = await startTelegramBind(sessionUser)
      setIssued({ code: String(data?.code ?? ''), bot: String(data?.bot_username ?? '') })
      setState('code')
    } catch (error) {
      if (isTelegramNotConfigured(error)) { setState('notConfigured'); return }
      setNotice(t('telegram.bindFailed'))
    } finally {
      setBusy(false)
    }
  }

  // 等待回执：用户点击触发**一次**状态读（无轮询）；已绑定 ⇒ `bindSuccess` + 转态③。
  const onConfirmBind = async () => {
    if (busy) return
    setBusy(true)
    try {
      const data = await fetchTelegramBindStatus(sessionUser)
      if (data?.tg_linked) {
        setBoundAt(data?.tg_linked_at ?? null)
        setIssued(null)
        setConfirming(false)
        setNotice(t('telegram.bindSuccess'))
        setState('bound')
      }
    } catch (error) {
      if (isTelegramNotConfigured(error)) { setState('notConfigured'); return }
      setNotice(t('telegram.bindFailed'))
    } finally {
      setBusy(false)
    }
  }

  // tg-bind-v2 · confirm 失败按 TG 族 reason 映射文案（机读面 = `failure.code` / `failure.i18nKey`，
  // D1 补丁口径）；未命中四类 ⇒ 回既有 `bindFailed` 兜底。匹配用 includes ⇒ 兼容 `TG_CODE_*` / 裸 reason 两形。
  const tgConfirmFailKey = (error) => {
    const raw = String(error?.code || error?.i18nKey || '').toUpperCase()
    if (raw.includes('EXPIRED')) return 'telegram.codeExpired'
    if (raw.includes('CONSUMED')) return 'telegram.codeConsumed'
    if (raw.includes('NOT_FOUND')) return 'telegram.codeNotFound'
    if (raw.includes('TARGET_ACCOUNT_TAKEN')) return 'telegram.accountTaken'
    return null
  }

  // tg-bind-v2 · 扫码主路径确认：短码（8 位纯数字；trim 归一后提交，toUpperCase 对数字为恒等）⇒ `POST /api/telegram/bind/confirm`
  // （requireActor；成功 = `tg_linked:true` + `tg_linked_at` ⇒ 转已绑定态 + 可见反馈；响应**无 tg_user_id**，本组件不读不渲染）。
  const onConfirmShortCode = async () => {
    if (busy) return
    const code = shortCode.trim().toUpperCase()
    if (!code) return
    setBusy(true)
    setNotice('')
    try {
      const data = await confirmTelegramBind(code, sessionUser)
      if (data?.tg_linked) {
        setBoundAt(data?.tg_linked_at ?? null)
        setIssued(null)
        setShortCode('')
        setNotice(t('telegram.bindSuccess'))
        setState('bound')
      }
    } catch (error) {
      if (isTelegramNotConfigured(error)) { setState('notConfigured'); return }
      setNotice(t(tgConfirmFailKey(error) || 'telegram.bindFailed'))
    } finally {
      setBusy(false)
    }
  }

  // 态③ ⇒ 解绑（二次确认内联；成功回态②）。
  const onUnbind = async () => {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      await unbindTelegram(sessionUser)
      setBoundAt(null)
      setConfirming(false)
      setIssued(null)
      setState('unbound')
    } catch (error) {
      if (isTelegramNotConfigured(error)) { setState('notConfigured'); return }
      setNotice(String(error?.message || t('error')))
    } finally {
      setBusy(false)
    }
  }

  // tg-bind-v2 · 旧长码路径体（code 槽 + 步骤 + 回执确认）：bot_username 缺/空时整段原样直出（回退），
  // bot_username 在场时折叠进 `<details>` 作次入口 —— 钩子与文案键一字不改。
  const oldCodeBody = (
    <>
      <p className="sf-tag" data-sf-m="tg-bind-code">{issued?.code}</p>
      <p className="text-sm text-gray-600" data-sf-m="tg-bind-steps">
        {t('telegram.codeSteps', { bot: issued?.bot, code: issued?.code })}
      </p>
      <Button variant="proceed" size="sm" onClick={onConfirmBind} disabled={busy} data-sf-m="tg-bind-action">
        {t('confirm')}
      </Button>
    </>
  )

  const statusText = state === 'loading'
    ? t('loading')
    : (state === 'notConfigured' ? t('telegram.notConfigured') : (state === 'bound' ? t('telegram.bound') : t('telegram.notBound')))

  return (
    <div data-sf-m="tg-bind-card" data-sf-tg-state={state}>
      <Card variant="inactive">
        <CardHeader>
          <CardTitle className="text-2xl">{t('telegram.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">{t('telegram.desc')}</p>
          {/* 状态行：loading / 未配置降级 / 未绑定 / 已绑定（四态共用同一钩子，AC-4 采数点） */}
          <p className="text-sm text-gray-600" data-sf-m="tg-bind-status">{statusText}</p>

          {state === 'notConfigured' ? null : state === 'bound' ? (
            <>
              {boundAt ? (
                <p className="text-sm text-gray-500">{toDate(boundAt).toLocaleDateString()}</p>
              ) : null}
              {confirming ? (
                <div className="flex gap-2">
                  <Button variant="warning" size="sm" onClick={onUnbind} disabled={busy} data-sf-m="tg-unbind-action">
                    {t('telegram.unbind')}
                  </Button>
                  <Button variant="inactive" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                    {t('cancel')}
                  </Button>
                </div>
              ) : (
                <Button variant="inactive" size="sm" onClick={() => setConfirming(true)} disabled={busy} data-sf-m="tg-unbind-action">
                  {t('telegram.unbind')}
                </Button>
              )}
            </>
          ) : state === 'code' ? (
            issued?.bot ? (
              <>
                {/* tg-bind-v2 主路径：扫码面板（QR 内容 = t.me/<bot_username>，无 start 载荷）+ 新开链接 + 短码 confirm */}
                <div className="flex flex-col items-start gap-3" data-sf-m="tg-bind-qr">
                  <div className="rounded-md bg-white p-2">
                    <QRCode value={`https://t.me/${issued.bot}`} size={148} bgColor="#ffffff" fgColor="#111827" />
                  </div>
                  <a
                    className="text-sm font-medium text-blue-600 underline"
                    href={`https://t.me/${issued.bot}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-sf-m="tg-bind-open"
                  >
                    {t('telegram.qrOpen')}
                  </a>
                  <p className="text-sm text-gray-600">{t('telegram.qrHint')}</p>
                  <input
                    className="w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900"
                    value={shortCode}
                    onChange={(event) => setShortCode(event.target.value)}
                    placeholder={t('telegram.codeInputPlaceholder')}
                    inputMode="numeric"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    data-sf-m="tg-bind-code-input"
                  />
                  <Button variant="proceed" size="sm" onClick={onConfirmShortCode} disabled={busy} data-sf-m="tg-bind-confirm">
                    {t('telegram.confirmBind')}
                  </Button>
                </div>
                {/* 旧长码路径 = 次入口（折叠展示；同一次 bind/start 响应，钩子/文案一字不改） */}
                <details className="text-sm text-gray-600">
                  <summary className="cursor-pointer">{t('telegram.codeLabel')}</summary>
                  {oldCodeBody}
                </details>
              </>
            ) : (
              <>
                {/* bot_username 缺/空 ⇒ 扫码面板隐藏，回退旧长码路径（原渲染原样） */}
                <p className="text-sm text-gray-600">{t('telegram.codeLabel')}</p>
                {/* code 展示 = 既有等宽槽位 `.sf-tag`（不新造风格） */}
                {oldCodeBody}
              </>
            )
          ) : (
            <Button variant="proceed" size="sm" onClick={onBind} disabled={busy || state === 'loading'} data-sf-m="tg-bind-action">
              {t('telegram.bind')}
            </Button>
          )}

          {notice ? (
            <p className="text-sm text-gray-600" role="status" data-sf-m="tg-bind-notice">{notice}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 我的资产（Kevin 2026-10-20 需求①②；2026-10-21 需求② 扩为「币种卡片 + 铸造/分解」）
// ----------------------------------------------------------------------------
// 形态 = 标题 + **按币种的余额卡片区** + `BttcAssetPanel`（铸造 / 分解 / 缺额提示 + 电量摘要）。
//   · 卡片区读口 = 既有 `GET /api/user/balances`（`balances-api.fetchUserBalances`）⇒ 每种货币一张卡，
//     只渲染余额 > 0、顺序沿用后端（cid 升序、`$` 首位）；卡内 = 大号符号 + 千分位余额 + 币种 `name`。
//     金额格式化与归一**复用** `balances-api`（`toBalanceCards` → `formatBalanceAmount`），本页零自算。
//   · 取数失败 ⇒ 内联错误 + 【重试】（不白屏）；未登录 ⇒ `fetchUserBalances` 返回 `null` ⇒ 卡区不渲染，
//     由既有 `ProtectedRoute` 出登录引导。文案键全部复用（`messagesPage.loadFailed` / `uiError.retry`）。
//   · `BttcAssetPanel` **原样保留**在本页（铸造 / 分解仍可达）：读口沿用 `GET /api/batt` 的 `data.bttc`
//     子对象（零新 GET，组件自取数）；本 pane 不做任何本地换算。
//   · 钩子（§质检探针）：`profile-assets-view` / `assets-my-points`（+ `assets-my-points-amount`，
//     2026-10-21 自首页迁入的「我的积分」卡）/ `asset-points-section` / `asset-cards` / `asset-cards-grid` / `asset-card`
//     （+ `data-symbol` / `data-name`）/ `asset-card-symbol` / `asset-card-amount` / `asset-card-name`
//     / `asset-cards-error` / `asset-cards-retry`。
// ============================================================================
// 「我的积分」卡（2026-10-21 · Kevin 裁定：内容整体自首页迁入本 pane）
//   数据面 = **本 pane 已在取的同一读口** `GET /api/user/balances` 里 `$`（cid 1）那一行的余额
//  （零新请求、零新状态源）；金额格式化复用 `balances-api.formatBalanceAmount`（本页零自算）。
//   缺行 / 坏值 ⇒ `'0'`（与首页旧卡的初值口径一致，不显空 / 不显 NaN）。
//   视觉沿用首页旧卡（`Card variant="primary"` = 黄底黄边 / 圆角 / hover 副影上移），
//   宽度改为**随内容区整行**（不再 `max-w-md mx-auto` 居中窄条）。
// ============================================================================
const POINTS_CID = 1
const pointsAmountOf = (rows) => {
  const row = (Array.isArray(rows) ? rows : [])
    .find((item) => item && typeof item === 'object' && Number(item.cid) === POINTS_CID)
  return row ? formatBalanceAmount(row.balance) : '0'
}

const AssetsPane = () => {
  const { t } = useTranslation()
  const [balances, setBalances] = useState({ status: 'loading', cards: [], points: null })
  const [reloadSeq, setReloadSeq] = useState(0)

  useEffect(() => {
    let cancelled = false
    setBalances((prev) => ({ status: 'loading', cards: prev.cards, points: prev.points }))
    const load = async () => {
      try {
        const rows = await fetchUserBalances()
        if (cancelled) return
        // `null` = 未登录 / 旧后端 ⇒ 空卡区（不报错、不白屏）
        setBalances({ status: 'ok', cards: toBalanceCards(rows), points: pointsAmountOf(rows) })
      } catch (error) {
        if (cancelled) return
        console.warn('Failed to load asset balances:', error)
        setBalances({ status: 'error', cards: [], points: null })
      }
    }
    load()
    return () => { cancelled = true }
  }, [reloadSeq])

  const cards = balances.cards

  return (
    <div className="sf-prof-pane" data-sf-m="profile-assets-view">
      <h1 className="sf-prof-pane-title">{t('profileNav.assets')}</h1>

      {balances.status === 'error' && (
        <div className="sf-prof-asset-error" role="alert" data-sf-m="asset-cards-error">
          <span>{t('uiError.networkTitle')}</span>
          <button
            type="button"
            className="sf-prof-btn"
            data-sf-m="asset-cards-retry"
            onClick={() => setReloadSeq((seq) => seq + 1)}
          >
            {t('uiError.retry')}
          </button>
        </div>
      )}

      {/* 「我的积分」（首页旧卡整体迁入；货币卡区**上方**，值 = 同一读口的 `$`（cid 1）） */}
      {balances.points !== null && (
        <section className="sf-prof-asset-section" data-sf-m="asset-points-section">
          <Card variant="primary" className="sf-prof-points-card" data-sf-m="assets-my-points">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">{t('item.myPoints')}</div>
                  <div className="text-2xl font-bold text-yellow-600" data-sf-m="assets-my-points-amount">{balances.points}</div>
                </div>
                <div className="text-4xl">🪙</div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {cards.length > 0 && (
        <section className="sf-prof-asset-section" data-sf-m="asset-cards">
          <div className="sf-prof-asset-grid" data-sf-m="asset-cards-grid">
            {cards.map((card) => (
              <article
                key={card.key}
                className="sf-prof-asset-card"
                data-sf-m="asset-card"
                data-symbol={card.symbol}
                data-name={card.name}
              >
                <div className="sf-prof-asset-card-main">
                  <span className="sf-prof-asset-card-symbol" data-sf-m="asset-card-symbol">{card.symbol}</span>
                  <span className="sf-prof-asset-card-amount" data-sf-m="asset-card-amount">{card.amount}</span>
                </div>
                {card.name && (
                  <div className="sf-prof-asset-card-name" data-sf-m="asset-card-name">{card.name}</div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <BttcAssetPanel />
    </div>
  )
}

const ProfilePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, updateSession, user: sessionUser } = useAuth()
  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）+ 用户录入内容 `bio` 的当前语言值。
  //   ★ 编辑态口径：`bio`/`tempBio` 一律持**原文**（`user.bio`），只有**展示**走 `displayBio`
  //     —— 否则保存时会把译文当原文写回（`updateMyProfile({bio: tempBio})`）。
  const lang = getLanguageFromUrl(location.pathname)
  // Kevin 2026-10-14 需求②：视图由 pathname 派生（路由挂载与单测裸渲染同一口径）
  const view = profileViewOf(location.pathname)
  const [user, setUser] = useState(null)
  const [userAssets, setUserAssets] = useState(null)
  const [taskStats, setTaskStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    pendingRewards: 0,
    totalPoints: 0,
    claimedRewards: 0,
  })
  const [shardHoldings, setShardHoldings] = useState([])
  // 批 7-A：「流水」= 已注册读口 `GET /api/user/ledger`（DL25 keyset 分页）的真数据。
  //   `next` = `next_before_txid` 游标（`null` = 到底，不渲染「加载更多」）；真·零流水 ⇒ 空态。
  const [ledger, setLedger] = useState({ rows: [], next: null, message: '' })
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [tempBio, setTempBio] = useState('')

  // 加载用户信息和任务统计
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!isAuthenticated) {
        setUser(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const profile = await fetchCurrentUser(sessionUser)
        if (!profile) {
          setUser(null)
          return
        }

        const nextProfile = updateSession(profile)
        setUser(nextProfile)
        setBio(nextProfile.bio || '')
        setTempBio(nextProfile.bio || '')

        await Promise.all([
          loadUserAssets(nextProfile.uID),
          loadTaskStats(nextProfile.uID),
          loadShardHoldings(),
          loadLedger(null),
        ])
      } catch (error) {
        console.error('Error loading user info:', error)
        toast.error(t('profilePage.loadFailed', { message: error.message }))
      } finally {
        setLoading(false)
      }
    }

    loadUserInfo()
  }, [isAuthenticated, sessionUser?.uID])

  // 加载用户资产
  const loadUserAssets = async (uID) => {
    try {
      const asset = await fetchApiJson(`/api/user/asset/${uID}`)
      setUserAssets(asset)
    } catch (error) {
      console.warn('Failed to load user assets:', error)
      setUserAssets({
        points: 0,
        time_update: null,
      })
    }
  }

  // 四项确认 ④：`/api/shard` 已 sunset（恒空态 + 顶层 `deprecated:true`；§5.2「**禁止**新代码再调」）
  //   ⇒ **移除调用**、只保留空态容忍；迁移目标 `GET /api/user/points` **未注册**（现取 `grep` = 0 命中）⇒ 不迁、登记。
  //   （同页 `/api/prize-item` 的调用**保留**：实测该路径 = `listing_order` **买家轴**读面、**未 sunset**，报告 §2-④ 已登记。）
  const loadShardHoldings = async () => {
    setShardHoldings([])
  }

  // 批 7-A：「流水」读口接线（`GET /api/user/ledger`，**已注册**；DL25 keyset 分页）。
  //   `beforeTxid=null` ⇒ 首页；「加载更多」传上一页 `next_before_txid`。真·零流水时才显示空态。
  const loadLedger = async (beforeTxid) => {
    // 收口四 R-2（统一未登录口径）：与 `market/MarketPage.loadLedger` 对齐 ——
    //   未登录 ⇒ **不发请求**、直接本地登录提示（旧行为 = 发出去吃 401 再把服务端错误串当文案）。
    if (!isAuthenticated) {
      setLedger({ rows: [], next: null, message: t('pleaseLogin') })
      return
    }
    try {
      const { rows, nextBeforeTxid } = await fetchMyLedger({
        user: sessionUser,
        beforeTxid: beforeTxid || null,
        limit: LEDGER_PAGE_SIZE,
      })
      setLedger((prev) => ({
        rows: beforeTxid ? [...prev.rows, ...rows] : rows,
        next: nextBeforeTxid,
        message: '',
      }))
    } catch (error) {
      console.warn('Failed to load ledger:', error)
      setLedger((prev) => ({ ...prev, message: String(error?.message || t('error')) }))
    }
  }

  // 加载任务统计
  const loadTaskStats = async (uID) => {
    try {
      const headers = getAuthHeaders(sessionUser)
      const [taskProgressItems, prizeItems] = await Promise.all([
        fetchApiJson('/api/task-progress', { headers }),
        fetchApiJson('/api/prize-item', { headers }).catch(() => []),
      ])

      // ★S3b ②：`GET /api/task-progress` 的 `jID` 语义 = **`submission_id`**（S2 换轴）⇒ 同人**可多次提交**、
      //   同一任务可能回多条。本组读数按**任务**计（标签为「总任务数 / 已完成 / 进行中」）⇒ 先按 `tID`
      //   归并、取该任务**最新一条提交**（`jID` 升序覆盖 = 最大 `jID`），再逐「任务」计数，
      //   否则同一任务多次提交会被重复计入。
      const latestByTask = new Map()
      for (const taskProgress of taskProgressItems || []) {
        const key = String(taskProgress?.tID ?? '')
        const prev = latestByTask.get(key)
        if (!prev || Number(taskProgress?.jID || 0) > Number(prev?.jID || 0)) {
          latestByTask.set(key, taskProgress)
        }
      }

      const stats = {
        totalTasks: latestByTask.size,
        completedTasks: 0,
        pendingTasks: 0,
        pendingRewards: 0,
        totalPoints: 0,
        claimedRewards: (prizeItems || []).length,
      }

      for (const taskProgress of latestByTask.values()) {
        if (taskProgress.time_claimed) {
          stats.completedTasks++
          stats.totalPoints += taskProgress.points_claimed || 0
        } else if (taskProgress.time_checked) {
          stats.pendingRewards++
        } else {
          stats.pendingTasks++
        }
      }

      setTaskStats(stats)
    } catch (error) {
      console.warn('Failed to load task stats:', error)
      setTaskStats({
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        pendingRewards: 0,
        totalPoints: 0,
        claimedRewards: 0,
      })
    }
  }

  // 保存用户简介
  const saveBio = async () => {
    try {
      const nextBio = tempBio.trim()
      if (nextBio.length < 10) {
        toast.error(t('profilePage.bioTooShort'))
        return
      }

      const updatedUser = await updateMyProfile({ bio: nextBio }, sessionUser)
      const nextUser = updateSession(updatedUser)
      setUser(nextUser)
      setBio(nextUser.bio || nextBio)
      setTempBio(nextUser.bio || nextBio)
      setIsEditing(false)
      toast.success(t('profilePage.bioSaved'))
    } catch (error) {
      toast.error(t('profilePage.saveFailed', { message: error.message }))
    }
  }

  // 取消编辑
  const cancelEdit = () => {
    setTempBio(bio)
    setIsEditing(false)
  }

  // 如果正在加载，显示加载页面
  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message={t('common.loadingUser')} />
      </ResponsiveContainer>
    )
  }

  if (!user) {
    return (
      <ResponsiveContainer>
        <Card variant="inactive">
          <CardContent className="text-center py-12">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-4">{t('pleaseLogin')}</p>
            <Button variant="primary" onClick={() => navigate(buildLocalizedPath(lang, '/login'))}>
              {t('profilePage.goLogin')}
            </Button>
          </CardContent>
        </Card>
      </ResponsiveContainer>
    )
  }

  const navLink = (to, hook, label, active) => (
    <Link
      to={to}
      data-sf-m={hook}
      className={`sf-prof-link${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  )

  return (
    <ResponsiveContainer>
      <div className="sf-prof" data-sf-m="profile-view">
        {/* 左栏菜单（桌面档；≤767 变横向页签，见 profile.css） */}
        <nav className="sf-prof-nav" data-sf-m="profile-nav" aria-label={t('profileNav.title')}>
          {navLink(
            buildLocalizedPath(lang, '/profile/assets'),
            'profile-nav-assets',
            t('profileNav.assets'),
            view.kind === 'assets',
          )}
          <div className="sf-prof-nav-group" data-sf-m="profile-nav-trades">
            <span className="sf-prof-nav-title">{t('profileNav.title')}</span>
            {navLink(
              buildLocalizedPath(lang, '/profile/trades/published'),
              'profile-nav-published',
              t('profileNav.published'),
              view.kind === 'trades' && view.subTab === 'published',
            )}
            {navLink(
              buildLocalizedPath(lang, '/profile/trades/sold'),
              'profile-nav-sold',
              t('profileNav.sold'),
              view.kind === 'trades' && view.subTab === 'sold',
            )}
            {navLink(
              buildLocalizedPath(lang, '/profile/trades/bought'),
              'profile-nav-bought',
              t('profileNav.bought'),
              view.kind === 'trades' && view.subTab === 'bought',
            )}
          </div>
          {navLink(
            buildLocalizedPath(lang, '/profile/favorites'),
            'profile-nav-favorites',
            t('profileNav.favorites'),
            view.kind === 'favorites',
          )}
          {navLink(
            buildLocalizedPath(lang, '/profile/settings'),
            'profile-nav-settings',
            t('profileNav.settings'),
            view.kind === 'settings',
          )}
        </nav>

        {/* 右侧内容：四视图（我的交易 / 我的收藏 / 我的资产 / 账户设置） */}
        <div className="sf-prof-content" data-sf-m="profile-content">
          {view.kind === 'trades' && (
            <TradesPane subTab={view.subTab} user={sessionUser} isAuthenticated={isAuthenticated} lang={lang} />
          )}
          {view.kind === 'favorites' && (
            <FavoritesPane user={sessionUser} isAuthenticated={isAuthenticated} lang={lang} />
          )}

          {view.kind === 'assets' && <AssetsPane />}

          {view.kind === 'settings' && (
            <div data-sf-m="settings-view">
              {/* 用户头像区（pane 顶部）：64px 圆形 + 换图 / 恢复默认（Kevin 2026-10-22） */}
              <SlideUp delay={80}>
                <Card variant="primary">
                  <CardContent>
                    <ProfileAvatarEditor
                      user={user}
                      t={t}
                      onChanged={(next) => {
                        // 写口回执与 `GET /api/user` 同源（`buildUserPayload`）⇒ 直接刷会话 + 本页态
                        const merged = updateSession(next)
                        setUser(merged)
                      }}
                    />
                  </CardContent>
                </Card>
              </SlideUp>

              {/* 页面标题 */}
              <FadeIn>
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    {t('profilePage.title')}
                  </h1>
                  <p className="text-xl text-gray-600">
                    {t('profilePage.subtitle')}
                  </p>
                </div>
              </FadeIn>

              <RatingTimelinessPanel />

              {/* 用户基本信息 */}
              <SlideUp delay={200}>
                <Card variant="primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl">{t('profilePage.basicInfo')}</CardTitle>
                      {!isEditing ? (
                        <Button
                          variant="proceed"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          {t('common.edit')}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={saveBio}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            {t('common.save')}
                          </Button>
                          <Button
                            variant="inactive"
                            size="sm"
                            onClick={cancelEdit}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {t('cancel')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 用户头像和基本信息 */}
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {user.EVM ? user.EVM.slice(2, 4).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h2 className="text-xl font-semibold text-gray-900">
                            {user.EVM ? formatEvmAddress(user.EVM) : t('profilePage.unknownUser')}
                          </h2>
                          {user.is_admin && (
                            <Badge variant="warning" size="sm">{t('common.admin')}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {t('profilePage.registeredAt')}: {user.time_reg ? toDate(user.time_reg).toLocaleDateString() : t('common.unknown')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {t('profilePage.walletAddress')}: {user.EVM ? formatEvmAddress(user.EVM) : t('common.notSet')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 用户简介 */}
                    <div>
                      <h3 className="font-semibold text-lg mb-2">
                        {t('profilePage.bio')}
                        {/* 「翻译中」小标（`i18n_status ∈ {pending, partial}`；ready/缺省 ⇒ null） */}
                        <TranslatingBadge status={contentStatus(user)} />
                      </h3>
                      {isEditing ? (
                        <textarea
                          value={tempBio}
                          onChange={(e) => setTempBio(e.target.value)}
                          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-500 focus:outline-none resize-none"
                          rows={4}
                          placeholder={t('profilePage.bioPlaceholder')}
                        />
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg min-h-[100px]">
                          {/* TR-2：展示走当前语言（`bio_<lang>`；空串/缺字段 ⇒ 回落原文 `bio`） */}
                          {pickLocalized(user, 'bio', lang) || bio || t('profilePage.bioEmpty')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </SlideUp>

              {/* 用户资产 */}
              <SlideUp delay={400}>
                <Card variant="secondary">
                  <CardHeader>
                    <CardTitle className="text-2xl">{t('profilePage.myAssets')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveGrid sm={2} md={4} gap={4}>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600 mb-1">
                          {userAssets?.points || 0}
                        </div>
                        <div className="text-sm text-gray-600">{t('common.points')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {taskStats.pendingRewards}
                        </div>
                        <div className="text-sm text-gray-600">{t('common.pending')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                          {taskStats.claimedRewards}
                        </div>
                        <div className="text-sm text-gray-600">{t('profilePage.redeemedRewards')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600 mb-1">
                          {userAssets?.time_update ? toDate(userAssets.time_update).toLocaleDateString() : '—'}
                        </div>
                        <div className="text-sm text-gray-600">{t('profilePage.lastUpdate')}</div>
                      </div>
                    </ResponsiveGrid>
                  </CardContent>
                </Card>
              </SlideUp>

              {/* 账本读数（P4-B4c-ii-a · 「我的」）：余额 = 已注册读口 /api/user/asset/:uID；
                  流水 = **已注册读口** `GET /api/user/ledger`（批 7-A 登记；DL25 keyset 分页 / 响应回传 next_before_txid）
                  ⇒ 渲染真数据；**仅当真·零流水**时才显示空态。*/}
              <SlideUp delay={500}>
                <div className="sf-jobs" data-sf-m="jobs-profile">
                  <div className="sf-jobs-panel" data-sf-m="jobs-balance">
                    <h2 className="sf-jobs-title">{t('ledger.balance')}</h2>
                    <div className="sf-jobs-row">
                      <span className="sf-jobs-pay" data-sf-m="jobs-balance-amount">{userAssets?.points ?? 0}</span>
                      <span className="sf-jobs-pay-unit">$</span>
                    </div>
                    <p className="sf-jobs-meta">{t('ledger.balanceNote')}</p>
                  </div>
                  <div className="sf-jobs-panel" data-sf-m="jobs-flow">
                    <h2 className="sf-jobs-title">{t('ledger.flow')}</h2>
                    {ledger.rows.length === 0
                      ? <div className="sf-jobs-empty" data-sf-m="jobs-flow-empty">{ledger.message || t('ledger.flowEmpty')}</div>
                      : (
                        <div data-sf-m="jobs-flow-list">
                          {ledger.rows.map((entry) => (
                            <div className="sf-jobs-item" key={String(entry.txid)} data-sf-m="jobs-flow-item">
                              <div className="sf-jobs-item-title">{t(`ledger.kind.${entry.kind}`)}</div>
                              <div className="sf-jobs-meta">
                                {`${Number(entry.delta) > 0 ? '+' : ''}${entry.delta}`}
                                {' · '}
                                {entry.time_created ? toDate(entry.time_created).toLocaleDateString() : '—'}
                              </div>
                            </div>
                          ))}
                          {ledger.next != null && (
                            <button
                              type="button"
                              className="sf-jobs-btn"
                              data-sf-m="jobs-flow-more"
                              onClick={() => loadLedger(ledger.next)}
                            >
                              {t('ledger.flowMore')}
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </SlideUp>

              {/* 任务统计 */}
              <SlideUp delay={600}>
                <Card variant="success">
                  <CardHeader>
                    <CardTitle className="text-2xl">{t('profilePage.taskAchievements')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveGrid sm={2} md={4} gap={4}>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                          {taskStats.totalTasks}
                        </div>
                        <div className="text-sm text-gray-600">{t('profilePage.totalTasks')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {taskStats.completedTasks}
                        </div>
                        <div className="text-sm text-gray-600">{t('common.completed')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600 mb-1">
                          {taskStats.pendingTasks}
                        </div>
                        <div className="text-sm text-gray-600">{t('common.ongoing')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600 mb-1">
                          {taskStats.totalPoints}
                        </div>
                        <div className="text-sm text-gray-600">{t('profilePage.totalPoints')}</div>
                      </div>
                    </ResponsiveGrid>

                    {/* 成就徽章 */}
                    <div className="mt-6">
                      <h3 className="font-semibold text-lg mb-3">{t('profilePage.achievements')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {taskStats.completedTasks >= 1 && (
                          <Badge variant="success" className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {t('profilePage.badgeNovice')}
                          </Badge>
                        )}
                        {taskStats.completedTasks >= 5 && (
                          <Badge variant="primary" className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {t('profilePage.badgeExpert')}
                          </Badge>
                        )}
                        {taskStats.completedTasks >= 10 && (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {t('profilePage.badgeMaster')}
                          </Badge>
                        )}
                        {taskStats.totalPoints >= 1000 && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {t('profilePage.badgePointsPro')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SlideUp>

              {/* 碎片持仓 */}
              <SlideUp delay={800}>
                <Card variant="inactive">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl">{t('profilePage.shardHoldings')}</CardTitle>
                      <Link to={buildLocalizedPath(lang, '/exchange')} className="text-sm text-blue-600 hover:text-blue-800 underline">
                        {t('common.goTrade')}
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {shardHoldings.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">{t('profilePage.noHoldings')}</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {shardHoldings.map((h) => (
                          <div key={h.bID} className="flex items-center justify-between py-2">
                            <span className="font-medium text-gray-800">{h.symbol || h.bID}</span>
                            <span className="text-gray-600">{h.volume} {t('common.shardUnit')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </SlideUp>

              {/* v1.17 §20.2（T102）· 「Telegram 通知」卡（三态 + 降级）—— 只**新增卡片**、不动既有块；
                  置于页面末位 ⇒ 既有块零位移（归因式 AC-5 的「非目标页差异集 = 0」更易成立）。 */}
              <SlideUp delay={900}>
                <TelegramBindCard />
              </SlideUp>
            </div>
          )}
        </div>
      </div>
    </ResponsiveContainer>
  )
}

export default ProfilePage
