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
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../utils'
import { contentStatus, pickLocalized } from '../i18n-content'
import TranslatingBadge from '../components/i18n/TranslatingBadge'
// P9②：电量卡 + 签到区（Kevin 2026-10-14 需求③：已迁出至独立页 /activities —— 本文件不再渲染）。
import RatingTimelinessPanel from '../components/RatingTimelinessPanel'
// 招工线 / 我的 共用的 token + 栅格层（P4-B4c-ii-a）：与 TaskPage 招工线族同一份样式表
import './jobs/jobs.css'
// Kevin 2026-10-14 需求②：桌面侧栏布局样式（页面局部 --sf-l-*，零新主题 token）
import './profile.css'
// D7 变更（2026-10-14）：MyOrdersPanel 渲染点自首页迁入「我买到的」子页（组件复用；发货/收货/退款可达）
import MyOrdersPanel, { SellerOrderActions } from './item/MyOrdersPanel'
// sf14 需求④：交易/收藏取数层（契约冻结；后端并行单实现中）
import { addFavorite, fetchFavorites, fetchMyListings, fetchSoldOrders, removeFavorite } from '../trades-api'
import { fetchApiJson, fetchCurrentUser, getAuthHeaders, updateMyProfile } from '../auth'
import { useAuth } from '../auth-context'
import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../ledger-api'
// v1.17 §20.2（T102）· Telegram 通知绑定面（`/api/telegram` 族 3 条读/写口；env 缺 ⇒ 503 TG_NOT_CONFIGURED 降级）。
import {
  fetchTelegramBindStatus,
  isTelegramNotConfigured,
  startTelegramBind,
  unbindTelegram,
} from '../messages-api'

const toDate = (value) => new Date(typeof value === 'number' ? value * 1000 : value)

// ============================================================================
// Kevin 2026-10-14 需求②：/profile 桌面档重构 = 「左侧菜单 + 右侧内容」
// ----------------------------------------------------------------------------
// 视图派生（单一真源 = `profileViewOf`，按 pathname 尾段解析）：
//   · /profile(/:lang 前缀)                 ⇒ 我的交易-我买到的（落地口径；生产路由先重定向到 trades/bought）
//   · /profile/trades/published|sold|bought ⇒ 我的交易三子页（非法值按 bought 处理）
//   · /profile/favorites                    ⇒ 我的收藏
//   · /profile/settings                     ⇒ 账户设置
// 左栏菜单（桌面 ≥768 固定宽，手机 ≤767 横向页签，见 profile.css）：我的交易（三子项）/ 我的收藏 / 账户设置。
// 既有内容归位（派单方裁定）：账户设置 = 基本信息卡（bio 编辑往返）+ 用户资产卡 + 账本读数
//   + 任务统计与成就徽章 + 碎片持仓 + Telegram 通知卡 + 评分/时效面板；电量卡 + 签到 = /activities 独立页。
// 钩子（§质检探针）：profile-nav（侧栏根）/ profile-nav-trades / profile-nav-{published,sold,bought,favorites,settings}
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

// 我发布的：GET /api/listing/mine ⇒ 行(listing_id/title/price/cid/status/stock/media_urls/time_created)
const PublishedList = ({ user, isAuthenticated, lang }) => {
  const { t } = useTranslation()
  const [state, setState] = useState({ phase: 'idle', rows: [], message: '' })

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
        state.rows.map((row) => (
          <Link
            key={String(row.listing_id ?? row.bID)}
            className="sf-prof-row"
            data-sf-m="trades-published-item"
            to={buildLocalizedPath(lang, `/item/${String(row.listing_id ?? row.bID)}`)}
          >
            <span className="sf-prof-row-title">{String(row.title ?? '-')}</span>
            <span className="sf-prof-row-meta">
              {`$${String(row.price ?? '-')}`}
              {' · '}
              {`${t('item.stock')} ${String(row.stock ?? '-')}`}
              {' · '}
              {listingStatusLabel(t, row.status)}
            </span>
          </Link>
        ))
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
              to={buildLocalizedPath(lang, `/item/${String(row.listing_id ?? row.bID)}`)}
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
// ★ 零新主题 token / 零新结构常量 / 零新 i18n 键：文案全部取 §20.8 已冻结键 + 全站既有
//   `confirm` / `cancel` / `loading` / `error`。
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
            <>
              <p className="text-sm text-gray-600">{t('telegram.codeLabel')}</p>
              {/* code 展示 = 既有等宽槽位 `.sf-tag`（不新造风格） */}
              <p className="sf-tag" data-sf-m="tg-bind-code">{issued?.code}</p>
              <p className="text-sm text-gray-600" data-sf-m="tg-bind-steps">
                {t('telegram.codeSteps', { bot: issued?.bot, code: issued?.code })}
              </p>
              <Button variant="proceed" size="sm" onClick={onConfirmBind} disabled={busy} data-sf-m="tg-bind-action">
                {t('confirm')}
              </Button>
            </>
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

        {/* 右侧内容：三视图（我的交易 / 我的收藏 / 账户设置） */}
        <div className="sf-prof-content" data-sf-m="profile-content">
          {view.kind === 'trades' && (
            <TradesPane subTab={view.subTab} user={sessionUser} isAuthenticated={isAuthenticated} lang={lang} />
          )}
          {view.kind === 'favorites' && (
            <FavoritesPane user={sessionUser} isAuthenticated={isAuthenticated} lang={lang} />
          )}

          {view.kind === 'settings' && (
            <div data-sf-m="settings-view">
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
