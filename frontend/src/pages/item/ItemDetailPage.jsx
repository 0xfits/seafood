import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import { buyListing, createListingBuyTracker, fetchListingDetail, listingBuyFingerprint } from './item-api'
// v1.17 §20.2 T100：「聊一聊」第 3 格 = 站内信 `POST /api/messages/conversations`（自然幂等、前端不供键）。
import { openConversation } from '../../messages-api'
// sf14 需求⑦（Kevin 2026-10-14 解冻第 2 格「收藏」）：收藏/已收藏 toggle（trades-api 幂等写口）。
import { addFavorite, fetchFavorites, removeFavorite } from '../../trades-api'
import toast from 'react-hot-toast'
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
//
// ============================================================================
// ★ v1.15 §19（T94–T99）· 变体 A「闲鱼结构 × 本站主题」· 渲染面收窄为白名单
//   渲染面（只这些）：① 价格行（大号价格 + 单位小字）② 大标题 ③ 详情面板（渐变占位图 +
//     描述 + 库存 + 数量输入）④ 底部固定操作栏（仅「立即购买」一个 CTA）⑤ 页内顶栏返回箭头
//     ⑥ 既有 `.sf-item-note`（物品编号 + 状态 —— 有数据承载，须保留）。
//   一律不渲染：卖家行 / 属性两列 / 集市横幅 / 划线原价 / 比市场价 / 包邮 / 想要·浏览计数 /
//     留言 / 收藏 / 聊一聊（前三者 = Kevin 裁定④ 另单；其余无数据源）。
//   ★ 不预埋空槽位 DOM（承 §15「不造无人消费的空路径」）。
//   ★ R-A（Zang 终审）：`item.line` / `item.priceServerNote` / `item.refundStockNote` 三个既有键
//     **保留**，由独立侧栏列折进详情面板作 meta 组（小标题 + 两行说明）⇒ 详情页上 `.sf-layout-side`
//     消失、`.sf-layout` 退化为单列；零数据依赖的既有可见内容不删。
//   ★ R-F（Zang 终审）：`item.buyNote`（「购买金额以平台结算为准；重复点击不会重复扣款」）同口径
//     **保留渲染**，并入同一 meta 组（与 `item.priceServerNote` **非冗余** —— 它多携带「重复点击
//     不会重复扣款」的幂等告知，对支付 CTA 是对用户的有效告知）。**只改渲染、locale 四语键一字不动**。
//   ★ 返回目标语义（T96 裁死）：固定回首页 root('/')，**否决 history.back()**（深链 / 刷新 / 新标签
//     三种入口下导航栈无站内上一页 ⇒ 行为不一致）。a11y 名复用既有键 `item.list`（+0 新键）。
//   ★ 结构常量（T98）：本单零新主题 token；字号 / 高度等几何量一律落 item.css 的页面局部 --sf-l-*。
// ============================================================================
// ★ v1.17 §20.2（`T100`）· 底部固定操作栏**第 3 格「聊一聊」激活**（N = 0 → 1）
//   第 1 格「留言」/ 第 2 格「收藏」**仍不渲染、不预埋 DOM**（N43：不造无人消费的占位槽）。
//   渲染条件（Zang 裁定② 2026-10-12 **就地取代 §20.3 末行的「未登录不渲染」口径**）：
//     · 登录 ∧ 非卖家本人 ⇒ 渲染；点击 ⇒ `POST /api/messages/conversations`（自然幂等）后进会话详情
//       （`/messages?c=<conversation_id>`；**路由路径不变**，见 §20.4）。
//     · 卖家本人 ⇒ **整格不渲染**（参会判定 = `F19` 的 `row.seller.uid` vs `user.uID`；
//       服务端 `MSG_SELF_CONVERSATION` 双闸仍在）。
//     · 未登录 ⇒ **渲染且不 disabled**，点击走**既有登录引导**（本仓既有受保护项口径 = 转
//       `/login` 并带 `state.from`，同 `pages/ProfilePage.jsx` 的 `goLogin` / `AuthPage` 的
//       `redirectTarget`；**不新造弹层**）—— 与「立即购买」未登录也有 `pleaseLogin` 提示同向。
//   ★ 参会判定用 `String(...)` 归一：同 `messages-api` 的 id 口径（后端 id 经 `pg` 可能回字符串）。
//   ★ 复用既有 `.sf-btn` 家族 + `.sf-item-cta`（`--sf-st-radius-pill` 胶囊 / R-B）：零新颜色、零新 token；
//     `p6-btn-impl2` 的家族清单本就含本文件、`totalUses` 为**下限断言** ⇒ +1 处不红。
// ============================================================================
const ItemDetailPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { itemId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [detail, setDetail] = useState({ phase: 'loading', row: null, message: '' })
  const [quantity, setQuantity] = useState('1')
  const [buy, setBuy] = useState({ phase: 'idle', message: '' })
  // T100：第 3 格「聊一聊」的本地态（开会话请求的加载 / 失败；成功即离开本页，无需 ok 态）。
  const [chat, setChat] = useState({ phase: 'idle', message: '' })
  // sf14 需求⑦：第 2 格「收藏」本地态（favored 初值 = 收藏列表成员判定；取数失败 ⇒ 静默按未收藏）。
  const [fav, setFav] = useState({ phase: 'idle', favored: false })
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

  // sf14 需求⑦：收藏态初始化 —— 登录 ∧ 详情在 ⇒ 读一次收藏列表判成员（失败静默，不阻塞详情面）。
  useEffect(() => {
    if (!isAuthenticated || !id || detail.phase !== 'ok') return undefined
    let alive = true
    fetchFavorites(user)
      .then((rows) => {
        if (!alive) return
        const list = Array.isArray(rows) ? rows : []
        setFav((prev) => ({
          ...prev,
          favored: list.some((row) => String(row?.listing_id ?? row?.bID) === String(id)),
        }))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [isAuthenticated, id, detail.phase, user])

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

  // T100 第 3 格「聊一聊」：未登录 ⇒ 既有登录引导（转 `/login` + `state.from`，不新造弹层）；
  //   登录 ⇒ `POST /api/messages/conversations`（自然幂等：同 (listing_id, buyer_uid) 重放回既有 id）
  //   ⇒ 成功后进会话详情（`/messages?c=<conversation_id>`，路由路径不变）。
  const onChat = async (event) => {
    event.preventDefault()
    if (chat.phase === 'loading') return
    if (!isAuthenticated) {
      navigate(buildLocalizedPath(lang, '/login'), {
        state: { from: { pathname: location.pathname, search: location.search } },
      })
      return
    }
    setChat({ phase: 'loading', message: '' })
    try {
      const view = await openConversation(id, user)
      setChat({ phase: 'idle', message: '' })
      navigate(`${root('/messages')}?c=${encodeURIComponent(String(view?.conversation_id ?? ''))}`)
    } catch (error) {
      setChat({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // sf14 需求⑦ 第 2 格「收藏」：登录 = 收藏/已收藏 toggle（幂等：重复收藏/取消同效）；
  //   未登录 = 既有登录引导（同 onChat 体例，不新造弹层）；收藏成功 = toast + 状态翻转（可见反馈）。
  const onToggleFav = async () => {
    if (fav.phase === 'loading') return
    if (!isAuthenticated) {
      navigate(buildLocalizedPath(lang, '/login'), {
        state: { from: { pathname: location.pathname, search: location.search } },
      })
      return
    }
    setFav((prev) => ({ ...prev, phase: 'loading' }))
    try {
      if (fav.favored) {
        await removeFavorite(id, user)
        setFav({ phase: 'idle', favored: false })
      } else {
        await addFavorite(id, user)
        setFav({ phase: 'idle', favored: true })
        toast.success(t('item.favoriteOk'))
      }
    } catch (error) {
      setFav((prev) => ({ ...prev, phase: 'idle' }))
      toast.error(t('item.favoriteFail'))
    }
  }

  const row = detail.row || {}
  // T100 参会判定：卖家本人 ⇒ 第 3 格整格不渲染（`F19` 读口的 `seller.uid` vs 当前用户 `uID`）。
  //   `String(...)` 归一（后端 id 经 `pg` 可能回字符串 ⇒ 裸 `===` 会静默失效）；缺 `seller` 读口
  //   （旧行 / mock 面）⇒ 无法判定为本人 ⇒ 视为「非卖家」（读口扩展是纯增键、向后兼容）。
  const sellerUid = row?.seller?.uid ?? null
  const myUid = user?.uID ?? user?.uid ?? null
  const isSellerSelf = isAuthenticated && myUid != null && sellerUid != null
    && String(myUid) === String(sellerUid)
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
        <div className="sf-item sf-item-detail">
          {/* 页内顶栏 · 返回箭头（T96：固定回首页；a11y 名复用 item.list；触控复用 .sf-tap-sq） */}
          <div className="sf-item-topbar">
            <Link className="sf-item-back sf-tap-sq" to={root('/')} data-sf-m="item-back" aria-label={t('item.list')}>
              <ChevronLeft size={22} aria-hidden="true" />
            </Link>
          </div>

          {detail.phase !== 'ok' ? (
            <div className="sf-item-empty" data-sf-m="item-detail-empty" data-sf-phase={detail.phase}>
              {detail.message || t('noData')}
            </div>
          ) : (
            <>
              {/* 价格行 → 大标题 → `.sf-item-note`（副行）：层级照参考图，颜色/字号走本站 token 与页面局部常量 */}
              <div className="sf-item-head" data-sf-m="item-detail-hero">
                <div className="sf-item-price sf-item-price-l">
                  <span className="sf-item-price-cur">$</span>
                  <span className="sf-item-price-num">{String(row.price ?? row.points ?? '-')}</span>
                  <span className="sf-item-price-unit">{t('item.priceUnit')}</span>
                </div>
                <h1 className="sf-item-title sf-item-title-l">
                  {String(title)}
                  {/* 「翻译中」小标（ready/缺省 ⇒ null） */}
                  <TranslatingBadge status={contentStatus(row)} />
                </h1>
                <p
                  className="sf-item-note"
                  data-sf-status={statusRaw || undefined}
                  title={statusRaw || undefined}
                >{`${t('item.listingId')} #${String(row.listing_id ?? row.bID ?? id ?? '-')} · ${statusText}`}</p>
              </div>

              <form onSubmit={onBuy} data-sf-m="item-buy-form">
                {/* 详情面板：渐变占位图 + 描述 + 库存 + meta 组（R-A）+ 数量输入 */}
                <div className="sf-item-panel" data-sf-m="item-detail">
                  <div className="sf-item-thumb" data-sf-m="item-detail-thumb" />
                  <p className="sf-item-meta">{String(description)}</p>
                  <p className="sf-item-meta">{t('item.stock')}{` ${String(row.stock ?? '-')}`}</p>
                  <div className="sf-item-meta-group">
                    <h2 className="sf-item-title">{t('item.line')}</h2>
                    <p className="sf-item-meta">{t('item.priceServerNote')}</p>
                    <p className="sf-item-meta">{t('item.buyNote')}</p>
                    <p className="sf-item-meta">{t('item.refundStockNote')}</p>
                  </div>
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

                {/* 底部操作栏：既有 CTA +（v1.17 T100）第 3 格「聊一聊」+（sf14 需求⑦）第 2 格「收藏」解冻。
                    第 1 格「留言」仍不渲染、不预埋 DOM（N43 余项；收藏格经 Kevin 2026-10-14 解冻）。 */}
                <div className="sf-item-actionbar" data-sf-m="item-actionbar">
                  <button className="sf-btn sf-item-btn sf-item-cta" type="submit" data-sf-m="item-buy-btn" disabled={buy.phase === 'loading' || !isAuthenticated}>
                    {t('item.buy')}
                  </button>
                  {/* 收藏/已收藏 toggle：登录态调 trades-api 幂等写口；未登录点击走既有登录引导 */}
                  <button
                    className="sf-btn sf-item-btn sf-item-cta"
                    type="button"
                    data-sf-m="fav-toggle"
                    data-sf-fav={fav.favored ? '1' : '0'}
                    onClick={onToggleFav}
                    disabled={fav.phase === 'loading'}
                  >
                    {fav.favored ? t('item.favorited') : t('item.favorite')}
                  </button>
                  {!isSellerSelf ? (
                    <button
                      className="sf-btn sf-item-btn sf-item-cta"
                      type="button"
                      data-sf-m="item-chat-btn"
                      data-sf-phase={chat.phase}
                      onClick={onChat}
                      disabled={chat.phase === 'loading'}
                    >
                      {t('item.chat')}
                    </button>
                  ) : null}
                  <span
                    className={`sf-item-status${buy.phase === 'error' ? ' sf-item-err' : ''}${buy.phase === 'ok' ? ' sf-item-ok' : ''}`}
                    data-sf-m="item-buy-status"
                    data-sf-phase={buy.phase}
                    role="status"
                  >
                    {buy.message || (isAuthenticated ? '' : t('pleaseLogin'))}
                  </span>
                  {chat.message ? (
                    <span className="sf-item-status sf-item-err" data-sf-m="item-chat-status" role="status">{chat.message}</span>
                  ) : null}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ItemDetailPage
