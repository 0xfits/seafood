import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MessageCircle, Star } from 'lucide-react'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { withPanelParams } from '../../shell/messages-panel-routing'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
// 媒体单前端阶段 A：详情面板真图优先（media_urls[0]），无媒体 ⇒ 机械鱼占位（T94 勘误：真图填原几何盒）。
import { PLACEHOLDER_IMAGE } from '../../assets/placeholder'
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
// 详情：`GET /api/prize/:bID`（**已注册**）= `listing` 行（`bID` = `listing_id`）；miss ⇒ 404（R107）。
// 购买：`POST /api/listing/:listingId/buy`（**已注册**）。
//   ★ **金额与对手方一律服务端取数**：payload 只有 `create_key` + `quantity`
//     —— 页面**没有**任何 price/seller 输入参与请求；客户端传 `price`/`seller_uid`/`buyer_uid` 也被忽略。
//   ★ 幂等键 = **前端供键**（fail-loud：缺 `cli:` 键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）。
// 后端面一字不动：`/api/prize/…` 与 `/api/listing…` 路径名保持不变。
//
// ============================================================================
// ★ 详情页改版（design §26.15 / route §49.14 / data §40.10 · 2026-10-20）· 只换壳，购买业务逻辑零改动
//   H5（≤767）行序冻结（判负 #43/#44）：
//     ① 卖家信息行（头像 + 掩码地址 `seller.nickname`（服务端单源掩码）+ 信用胶囊 `sellerCredit.*`）
//     ② 价格行（橙红 #FF4D00 大价 + 核心标签）
//     ③ 次要标签行（`item_type` 派生**收敛两枚**：PhysicalFreeShip⇒包邮黄 / DigitalAutoDeliver⇒自动发货绿；
//        其余值 / NULL ⇒ 彻底不渲染，判负 #48）+ 行尾 `x人想要`（`wants`）+ `x人浏览`（`views`）
//     ④ desc 全文（`white-space: pre-wrap` 保留换行；首行即派生标题、中等字重，**不另设标题行**）
//     ⑤ 图片区（`media_urls` 画廊；无图 ⇒ 机械鱼占位）
//     ⑥ 底部固定操作栏四件：【留言】【收藏（五角星）】靠左 ‖【立即购买（黑字灰底胶囊）】【聊一聊（图标+黑字黄底）】
//        靠右（判负 #42/#47）；≤767 `position: fixed` + `env(safe-area-inset-bottom)`（判负 #41）。
//   Web（≥768）闲鱼式两栏（判负 #45）：顶部卖家通栏 + 左 = 缩略图列 + 主图（白色圆箭头轮播，无多图隐藏）
//     + 右 = 价格行（行右端想要·浏览计数）→ 派生标题（粗体）→ 次要标签 → 核心成色标签 → desc → 操作区
//     （拼接胶囊：聊一聊黄 ｜ 立即购买黑 + 独立收藏胶囊）。两档差异**只走 CSS 767/768 断点**
//     （禁 JS 宽度读数 —— `theme-shell-isomorphism` 全文扫描）。
//   核心标签（判负 #49/#50）：`condition` 四值（`BrandNewSealed/LikeNew/MinorWear/HeavyWear`）⇒ 成色中文签；
//     `condition` 为 null / 闭集外 ⇒ 【平台结算】+ 状态类标签兜底，**不空置**、不渲染四值外文案。
//   无承载不渲染（判负 #46）：`seller` / `wants` / `views` / `condition` / `item_type` 缺键 ⇒ 对应节点不渲染。
//   行为接线（全部既有口，零新写口）：留言/聊一聊 ⇒ 会话五口（`openConversation`，未登录 ⇒ 既有登录引导；
//     卖家本人 ⇒ 聊一聊整格不渲染）；收藏 ⇒ `trades-api` toggle（已收藏实心黄星）；
//     立即购买 ⇒ 既有 `onBuy`（表单 submit、quantity/create_key 逻辑一字未动；未登录 ⇒ 按钮禁用 + `pleaseLogin` 提示）。
// ============================================================================
// 成色四值 → i18n 键（route §49.14.3：响应键 `condition`，值原样下发不翻译；文案 = 平台侧 i18n）。
const ITEM_CONDITION_KEYS = {
  BrandNewSealed: 'itemCondition.brandNewSealed',
  LikeNew: 'itemCondition.likeNew',
  MinorWear: 'itemCondition.minorWear',
  HeavyWear: 'itemCondition.heavyWear',
}

// 次要标签收敛两枚（design §26.15.2 ③）：仅这两值渲染标签；`DigitalManualDeliver` / `PhysicalBuyerShip` / NULL ⇒ 不渲染。
const ITEM_SECONDARY_TAGS = {
  PhysicalFreeShip: { cls: 'sf-item-ship-tag', key: 'item.freeShipping' },
  DigitalAutoDeliver: { cls: 'sf-item-auto-tag', key: 'itemType.autoDeliver' },
}

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
  // 详情页改版 ⑤：媒体画廊当前选中下标（轮播/缩略图共用；换商品即复位，越界钳制兜底）。
  const [mediaIndex, setMediaIndex] = useState(0)
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

  // 画廊下标随商品复位（旧下标对下一件商品无意义；渲染侧另有越界钳制双保险）
  useEffect(() => { setMediaIndex(0) }, [id])

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

  // 「聊一聊」/「留言」：未登录 ⇒ 既有登录引导（转 `/login` + `state.from`，不新造弹层）；
  //   登录 ⇒ `POST /api/messages/conversations`（自然幂等：同 (listing_id, buyer_uid) 重放回既有 id）
  //   ⇒ 成功后 **就地叠加**打开该会话：**当前商品页**加 `?msg=1&c=<conversation_id>`
  //     （`pathname` 逐字不变 ⇒ 不换页、详情页原地左压，面板由外壳按 `T105` 判据挂载）。
  //   ★ 两钮同走 listing 会话口（design §26.15.3：本站无独立留言板载体，差异 = 入口形态）。
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
      navigate(withPanelParams(location, String(view?.conversation_id ?? '')))
    } catch (error) {
      setChat({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // 「收藏」：登录 = 收藏/已收藏 toggle（幂等：重复收藏/取消同效）；
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
  // 参会判定：卖家本人 ⇒ 「聊一聊」整格不渲染（`seller.uid` vs 当前用户 `uID`）。
  //   `String(...)` 归一（后端 id 经 `pg` 可能回字符串 ⇒ 裸 `===` 会静默失效）；缺 `seller` 读口
  //   （旧行 / mock 面）⇒ 无法判定为本人 ⇒ 视为「非卖家」（读口扩展是纯增键、向后兼容）。
  const sellerUid = row?.seller?.uid ?? null
  const myUid = user?.uID ?? user?.uid ?? null
  const isSellerSelf = isAuthenticated && myUid != null && sellerUid != null
    && String(myUid) === String(sellerUid)
  const title = pickLocalized(row, 'title', lang) || pickLocalized(row, 'name', lang) || t('item.detail')
  const description = pickLocalized(row, 'description', lang) || ''
  // ④ desc 全文（存储不截）：首行 = 派生标题（中等字重、不另设标题行），其余行原样保留换行。
  const descNl = description.indexOf('\n')
  const descFirst = descNl >= 0 ? description.slice(0, descNl) : description
  const descRest = descNl >= 0 ? description.slice(descNl + 1) : ''
  // ⑤ 媒体画廊（media_urls ≤4 张）；无图 ⇒ 机械鱼占位（既有口径）。越界下标钳制到末张。
  const media = Array.isArray(row.media_urls) ? row.media_urls.filter(Boolean) : []
  const mediaIdx = media.length ? Math.min(mediaIndex, media.length - 1) : 0
  const currentImage = media[mediaIdx] || PLACEHOLDER_IMAGE
  // ② 核心标签：`condition` 四值 ⇒ 成色签；null / 闭集外 ⇒ 【平台结算】+ 状态签兜底（#49/#50）。
  const conditionKey = ITEM_CONDITION_KEYS[row.condition] || null
  // ③ 次要标签：仅收敛两枚在值（#48：其余值 / NULL 彻底不渲染）。
  const secondaryTag = ITEM_SECONDARY_TAGS[row.item_type] || null
  // 「想要 / 浏览」读数（#46：响应缺键 ⇒ 槽不渲染，不造假数据；bigint 可能以字符串回流 ⇒ 一律 String）。
  const hasWants = row.wants != null
  const hasViews = row.views != null
  const wantsText = hasWants ? t('rewardCard.wants', { n: String(row.wants) }) : ''
  const viewsText = hasViews ? t('item.views', { n: String(row.views) }) : ''
  // ① 卖家行（#46：响应无 `seller` ⇒ 整行不渲染）。昵称 = 服务端 `maskWalletAddress` 单源掩码。
  const seller = row.seller || null

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
          {/* 页内顶栏 · 返回箭头（T96：固定回首页；a11y 名复用 item.list；触控复用 .sf-tap-sq）—— Web 两栏改版后保留 */}
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
            <form className="sf-item-detail-body" onSubmit={onBuy} data-sf-m="item-buy-form">
              {/* ① 卖家信息行（H5 行① / Web 顶部通栏；响应无 `seller` ⇒ 整行不渲染，#46） */}
              {seller ? (
                <div className="sf-item-seller" data-sf-m="item-detail-seller-row">
                  <span className="sf-item-seller-avatar" aria-hidden="true">
                    {seller.avatar
                      ? <img className="sf-item-seller-avatar-img" src={seller.avatar} alt="" />
                      : (seller.nickname ? String(seller.nickname).slice(0, 1) : '·')}
                  </span>
                  <span className="sf-item-seller-name">{seller.nickname || ''}</span>
                  <span className="sf-item-seller-credit" data-sf-m="item-detail-seller-credit">
                    {t(`sellerCredit.${seller.credit || 'new'}`)}
                  </span>
                </div>
              ) : null}

              <div className="sf-item-cols" data-sf-m="item-detail-web-cols">
                {/* ⑤ 媒体区（H5 第 ⑤ 行 / Web 左栏）：主图 + 画廊缩略条 + 白色圆箭头（无多图不渲染） */}
                <div className="sf-item-media" data-sf-m="item-detail-gallery">
                  {media.length > 0 ? (
                    <div className="sf-item-media-thumbs" data-sf-m="item-detail-media-thumbs">
                      {media.map((url, i) => (
                        <button
                          key={`${i}-${url}`}
                          type="button"
                          className="sf-item-media-thumb"
                          data-sf-m="item-detail-media-thumb"
                          data-sf-active={i === mediaIdx ? '1' : '0'}
                          aria-label={`${i + 1}`}
                          onClick={() => setMediaIndex(i)}
                        >
                          <img src={url} alt="" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="sf-item-media-main">
                    {media.length > 1 ? (
                      <>
                        <button
                          type="button"
                          className="sf-item-media-nav sf-item-media-nav-prev"
                          data-sf-m="item-detail-media-prev"
                          aria-label="‹"
                          onClick={() => setMediaIndex((mediaIdx - 1 + media.length) % media.length)}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="sf-item-media-nav sf-item-media-nav-next"
                          data-sf-m="item-detail-media-next"
                          aria-label="›"
                          onClick={() => setMediaIndex((mediaIdx + 1) % media.length)}
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                    <img
                      className="sf-item-media-img"
                      data-sf-m="item-detail-thumb"
                      src={currentImage}
                      alt={title}
                    />
                  </div>
                </div>

                {/* 右栏（Web）/ ②③④ 行序（H5，flex order 落 CSS）：价格 → 次要 → 核心 → desc → 操作区 */}
                <div className="sf-item-side" data-sf-m="item-detail-web-side">
                  {/* ② 价格行：橙红大价（$ 小号同色）+ Web 行右端想要·浏览计数 */}
                  <div className="sf-item-price-row" data-sf-m="item-detail-price-row">
                    <div className="sf-item-price sf-item-price-l">
                      <span className="sf-item-price-cur">$</span>
                      <span className="sf-item-price-num">{String(row.price ?? row.points ?? '-')}</span>
                      <span className="sf-item-price-unit">{t('item.priceUnit')}</span>
                    </div>
                    {hasWants || hasViews ? (
                      <div className="sf-item-counts sf-item-counts-desk" data-sf-m="item-detail-counts" data-sf-slot="price">
                        {hasWants ? <span data-sf-m="item-detail-wants">{wantsText}</span> : null}
                        {hasViews ? <span data-sf-m="item-detail-views">{viewsText}</span> : null}
                      </div>
                    ) : null}
                  </div>

                  {/* 派生标题（Web 粗体行 + 翻译中小标；H5 不另设标题行 ⇒ ≤767 隐藏） */}
                  <h1 className="sf-item-title sf-item-title-l sf-item-web-title">
                    {String(title)}
                    <TranslatingBadge status={contentStatus(row)} />
                  </h1>

                  {/* ③ 次要标签行（收敛两枚）+ 行尾 `x人想要`/`x人浏览`（H5 槽位） */}
                  <div className="sf-item-tags-row" data-sf-m="item-detail-tags-secondary">
                    {secondaryTag ? (
                      <span className={secondaryTag.cls} data-sf-m="item-detail-secondary-tag">{t(secondaryTag.key)}</span>
                    ) : null}
                    {hasWants || hasViews ? (
                      <span className="sf-item-counts sf-item-counts-mob" data-sf-m="item-detail-counts" data-sf-slot="tags">
                        {hasWants ? <span data-sf-m="item-detail-wants">{wantsText}</span> : null}
                        {hasViews ? <span data-sf-m="item-detail-views">{viewsText}</span> : null}
                      </span>
                    ) : null}
                  </div>

                  {/* 核心标签（成色卖点签 / NULL ⇒ 平台结算 + 状态签兜底，不空置 #50） */}
                  <div className="sf-item-core-tags" data-sf-m="item-detail-tag-core">
                    {conditionKey ? (
                      <span className="sf-item-core-tag" data-sf-m="item-detail-condition-tag">{t(conditionKey)}</span>
                    ) : (
                      <>
                        <span className="sf-item-core-tag" data-sf-m="item-detail-settle-tag">{t('item.platformSettled')}</span>
                        <span className="sf-item-core-tag" data-sf-m="item-detail-status-tag">{statusText}</span>
                      </>
                    )}
                  </div>

                  {/* ④ desc 全文（pre-wrap 保留换行；首行 = 派生标题中等字重） */}
                  <p className="sf-item-desc" data-sf-m="item-detail-desc">
                    <span className="sf-item-desc-first">{descFirst}</span>
                    {descRest ? `\n${descRest}` : ''}
                  </p>

                  {/* 物品编号 + 状态（既有 `.sf-item-note`：`item.listingId` + 四语状态签，原始枚举不进用户面） */}
                  <p
                    className="sf-item-note"
                    data-sf-status={statusRaw || undefined}
                    title={statusRaw || undefined}
                  >{`${t('item.listingId')} #${String(row.listing_id ?? row.bID ?? id ?? '-')} · ${statusText}`}</p>

                  {/* 库存 + 数量（既有购买表单面：`onBuy` / quantity / create_key 逻辑零改动） */}
                  <p className="sf-item-meta">{t('item.stock')}{` ${String(row.stock ?? '-')}`}</p>
                  <label className="sf-item-field sf-item-qty-field">
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

                  {/* 平台告知 meta 组（v1.15 R-A/R-F 既有四键：明细 / 结算 / 幂等告知 / 退款库存） */}
                  <div className="sf-item-meta-group">
                    <h2 className="sf-item-title">{t('item.line')}</h2>
                    <p className="sf-item-meta">{t('item.priceServerNote')}</p>
                    <p className="sf-item-meta">{t('item.buyNote')}</p>
                    <p className="sf-item-meta">{t('item.refundStockNote')}</p>
                  </div>

                  {/* ⑥ 底部操作栏（H5 ≤767 = fixed 四件栏；Web = 右栏操作区）：
                      左组【留言】【收藏】靠左 ‖ 右组【立即购买】【聊一聊】靠右（判负 #42/#47）。
                      DOM 顺序 = 立即购买 → 聊一聊；Web 拼接序（聊一聊 ｜ 立即购买）由 ≥768 CSS order 翻转。
                      既有钩子全保留：item-actionbar / item-chat-btn / item-buy-btn / fav-toggle；
                      `data-sf-fav` 与 `aria-pressed` 同源（收藏态可读）；已收藏 = 实心黄星。 */}
                  <div className="sf-item-actionbar" data-sf-m="item-actionbar">
                    <div className="sf-item-actionbar-row">
                      <div className="sf-item-bar-left">
                        <button
                          className="sf-btn sf-item-btn sf-item-bar-msg"
                          type="button"
                          data-sf-m="item-detail-msg-btn"
                          onClick={onChat}
                          disabled={chat.phase === 'loading'}
                        >
                          <span className="sf-item-cta-label">{t('item.message')}</span>
                        </button>
                        <button
                          className="sf-btn sf-item-btn sf-item-bar-fav"
                          type="button"
                          data-sf-m="fav-toggle"
                          data-sf-fav={fav.favored ? '1' : '0'}
                          aria-pressed={fav.favored}
                          onClick={onToggleFav}
                          disabled={fav.phase === 'loading'}
                        >
                          <Star size={18} aria-hidden="true" {...(fav.favored ? { fill: 'currentColor' } : {})} />
                          <span className="sf-item-cta-label">{fav.favored ? t('item.favorited') : t('item.favorite')}</span>
                        </button>
                      </div>
                      <div className="sf-item-bar-right">
                        <div className="sf-item-cta-group">
                          <button
                            className="sf-btn sf-item-btn sf-item-cta-group-seg sf-item-cta-buy"
                            type="submit"
                            data-sf-m="item-buy-btn"
                            disabled={buy.phase === 'loading' || !isAuthenticated}
                          >
                            <span className="sf-item-cta-label">{t('item.buy')}</span>
                          </button>
                          {!isSellerSelf ? (
                            <button
                              className="sf-btn sf-item-btn sf-item-cta-group-seg sf-item-cta-chat"
                              type="button"
                              data-sf-m="item-chat-btn"
                              data-sf-phase={chat.phase}
                              onClick={onChat}
                              disabled={chat.phase === 'loading'}
                            >
                              <MessageCircle size={18} aria-hidden="true" />
                              <span className="sf-item-cta-label">{t('item.chat')}</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
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
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ItemDetailPage
