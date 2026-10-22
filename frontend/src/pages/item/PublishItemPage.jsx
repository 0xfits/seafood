import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
// ★ route §49.16：发布成功后跳详情的目标 = `item_code`（缺失回落数字 id）。
import { itemLinkId } from '../../item-link'
import { fetchMyListings } from '../../trades-api'
import {
  createListingPublishTracker,
  fetchCurrencies,
  fetchListingEdit,
  listingPublishFingerprint,
  publishListing,
  setListingStatus,
  updateListingFields,
  uploadMedia,
} from './item-api'
import { isListingEditAdmin, loadListingEditAdmin } from './item-edit-access'
// 压缩实现 = 共享模块单一真源（项目头像 `pages/project/ProjectAvatar` 用同一份，禁在本页复制）
import { compressImage } from '../../image-compress'
import './item.css'

// ============================================================================
// 闲置物品线 · 上架（原 `pages/listings/PublishListingPage.jsx`；2026-10-11 合并单改名单为 `item`）
// 路由（LangShell 内层相对段）：`item/new`（**原 `listing/new`**）。
// 接线：`POST /api/listing`（**已注册** backend-ts/src/index.ts:1492）= 直 DML · 无分录；
//       随后 `PATCH /api/listing/:listingId`（:1545）把状态 `draft → listed`（**只有 listed 才可被购买**）。
// 幂等键：`create_key` 由**前端提供**（`cli:<uuid-v4>`；tracker 保证同一次操作重试 ⇒ 同键）。
// 金额口径：`price` = **A 类供给侧自主出价**（§4.8.1：客户端出价、路由层零计算）⇒ 允许前端填、原样透传。
// 失败态：走 R107 链（`error.message` 已是字符串）⇒ 页面不会出现 `[object Object]`。
// 后端面一字不动（`/api/listing*` 路径名不变）。
//
// 币种字段（Kevin 2026-10-19）：`item-input-cid`（手填编号）⇒ `item-select-cid`（下拉选择）。
//   选项来源 = `GET /api/currencies`（**公开只读**；只列 `status='listed'`，行键 cid/symbol/name）
//   ⇒ 自建币种单位是产品既有能力，**前端不得硬编码币种清单**。
//   显示文本 = `${symbol}${name ? ' · ' + name : ''}`（**不显示编号**）；默认 `'1'`（平台 $，与旧默认一致）。
//   加载失败 / 空列表 ⇒ **回退仅 $（cid 1）一项**，表单照常可提交（不白屏、不禁用提交、零新增文案键）。
// ============================================================================
const DEFAULT_CID = '1'

/** 回退选项（接口失败 / 空列表时唯一可用项）：平台 `$`，`cid = 1`，无 name。 */
const FALLBACK_CURRENCIES = [{ cid: 1, symbol: '$', name: '' }]

/** 币种选项显示文本：`symbol · name`；**不显示编号**（`cid` 只作 value）。 */
const currencyLabel = (row) => {
  const symbol = String(row?.symbol ?? '')
  const name = typeof row?.name === 'string' ? row.name : ''
  return `${symbol}${name ? ` · ${name}` : ''}`
}

// ---- 商品图片（可选 · 媒体单前端阶段 B） --------------------------------------
// 口径：最多 4 张；仅 image/*；客户端压缩（canvas 长边 ≤1280，WebP q0.82，不支持 WebP ⇒ JPEG q0.85）
//   **压缩实现 = `src/image-compress.js`（共享单一真源，项目头像共用同一份）**；
//   **先逐张上传**，任一失败 ⇒ 取消发布（绝不产生半截商品）。
// 体积硬顶与「质量档 → 边长档」逐级降级、全档位仍超 ⇒ 该张拒收（`item.imageTooLarge`）——
//   口径与实现都留在共享模块，本页只消费 `compressImage` 的返回值（`null` = 该张超限）。
const MAX_IMAGES = 4


// ---- 商品分类（迁移 0054 四值闭集 · Kevin 2026-10-20「发布页级联 2 + 2 + 2」） -----
// 级联三控件（二级按一级分支**互斥渲染**、各自必选）：
//   一级「商品分类」2 选 1：数字商品 / 实物商品（恒渲染）
//   二级（数字分支）「发货方式」2 选 1：自动发货 / 手动发货
//   二级（实物分支）「运费」2 选 1：包邮 / 不包邮
// **载荷唯一字段** = `item_type`（后端闭集四值 PascalCase，route §49.11 ② / data §40.8.1）：
//   digital  + auto        ⇒ `DigitalAutoDeliver`
//   digital  + manual      ⇒ `DigitalManualDeliver`
//   physical + free        ⇒ `PhysicalFreeShip`
//   physical + buyer       ⇒ `PhysicalBuyerShip`
// ★ **绝不发裸 `Digital`**（0054 起裸值退役 = 闭集外 ⇒ 后端 400）。
// 联动（design §26.12.8 · 判负 #19）：切换一级 ⇒ **二级值一律清空**（两个二级值都清，防 stale 进载荷）；
//   数字分支**不渲染**运费控件、实物分支**不渲染**交付控件（不是 display:none）。
//   一级未选 / 二级未选 ⇒ **阻止提交**（零网络调用，不发 `''`，后端把空串判 400）。
//   提示复用既有键（`uiError.badRequest`）+ 组高亮 + `aria-invalid` —— **零新文案键**。
//   i18n 本单 +2 键（`itemType.autoDeliver` / `itemType.manualDeliver`）⇒ top 130 / flat 1122 / nodes 4488。
const TYPE_OPTIONS = [
  { value: 'digital', labelKey: 'itemType.digital' },
  { value: 'physical', labelKey: 'itemType.physical' },
]
/** 数字分支的二级控件（交付方式）。 */
const DELIVER_OPTIONS = [
  { value: 'auto', labelKey: 'itemType.autoDeliver' },
  { value: 'manual', labelKey: 'itemType.manualDeliver' },
]
/** 实物分支的二级控件（运费承担方）。 */
const SHIP_OPTIONS = [
  { value: 'free', labelKey: 'itemType.freeShip' },
  { value: 'buyer', labelKey: 'itemType.buyerShip' },
]

// ---- 商品成色（迁移 0057 四值闭集 · route §49.14.3 / data §40.8.2） ------------
// 载荷唯一字段 = `item_condition`（PascalCase 四值，**仅实物两分类允许非空**）：
//   BrandNewSealed / LikeNew / MinorWear / HeavyWear
// ★ 控件**仅实物分支**渲染（数字商品 / 未分类带值 ⇒ 后端 400 `ITEM_CONDITION_NOT_APPLICABLE`）
//   ⇒ 切走实物时值一律清空（stale 不得进载荷），数字分支下 `item_condition` 字段缺省。
// ★ 发布模式**实物下必选**（闸在 `onSubmit` 最前，零网络调用）；编辑模式**不强制补选**
//   （存量实物行可能 `item_condition = NULL`，强制会连带锁死改价/改描述）。
//   文案复用既有 `itemCondition.*` 四语键（本单**零新增 i18n 键**）。
const CONDITION_OPTIONS = [
  { value: 'BrandNewSealed', hook: 'brandNewSealed', labelKey: 'itemCondition.brandNewSealed' },
  { value: 'LikeNew', hook: 'likeNew', labelKey: 'itemCondition.likeNew' },
  { value: 'MinorWear', hook: 'minorWear', labelKey: 'itemCondition.minorWear' },
  { value: 'HeavyWear', hook: 'heavyWear', labelKey: 'itemCondition.heavyWear' },
]

// ---- 多件购买授权（design §26.18 / route §49.17 / data §40.13 · 迁移 0061） ------
// 载荷唯一字段 = `allow_multi_buy`（**真布尔**，默认 `false`）：
//   · 开关**仅 `Number(stock) > 1` 时渲染**（★ 禁字符串比较：`'10' > '9'` 为 false）；
//     `stock ≤ 1` / 空 / 非法 ⇒ 整块不渲染 + state 强制 `false` + 载荷不带该键。
//   · 默认**关**（库存填 >1 不自动勾选 = 不替卖家做决定）。
//   · **单向自动关**：库存改 ≤1 ⇒ `false`；改回 ≥2 **不自动恢复**（回涨恢复 = 替卖家决定，
//     且与后端 `W5`（PATCH 未传 ∧ stock ≤1 ⇒ 归一 false）的库值分叉）。
//   · 编辑页预填 = 读口行键 `allow_multi_buy === true`；行内 `true ∧ stock = 1`（正常终态：买到只剩 1 件）
//     ⇒ 不渲染 + state `false` ⇒ 保存**不带**该键（不把 `true` 又抄回去）。
// 文案三键（四语同补）：`item.multiBuyLabel` / `item.buyQtyTitle` / `item.buyQtyHint`（后两键详情页消费）。
/** 库存输入 ⇒ 是否满足「多件购买」可见性（**数值比较**；空 / 小数 / 非数字均不满足）。 */
const stockAllowsMultiBuy = (raw) => {
  const text = String(raw ?? '').trim()
  if (!/^\d+$/.test(text)) return false
  return Number(text) > 1
}

/** 成色四值闭集（`/api/listing/mine` 行键 `condition` 预填时的合法性判定）。 */
const ITEM_CONDITIONS = CONDITION_OPTIONS.map((option) => option.value)

/**
 * 级联 + 成色 ⇒ 待上送成色：**仅实物两分类**允许非空（数字 / 未分类 ⇒ `null`）。
 * 闭集外 / 缺值 ⇒ `null`（不猜补）。
 */
const toItemCondition = (type, condition) => {
  if (type !== 'physical') return null
  return ITEM_CONDITIONS.includes(String(condition ?? '')) ? String(condition) : null
}

/** 级联选择 ⇒ 单字段 `item_type`（四值闭集；任一级未选 / 二级缺项 ⇒ `null`，由提交闸拦截）。 */
const toItemType = (type, deliver, ship) => {
  if (type === 'digital') {
    if (deliver === 'auto') return 'DigitalAutoDeliver'
    if (deliver === 'manual') return 'DigitalManualDeliver'
    return null
  }
  if (type === 'physical') {
    if (ship === 'free') return 'PhysicalFreeShip'
    if (ship === 'buyer') return 'PhysicalBuyerShip'
    return null
  }
  return null
}

/**
 * `item_type` 四值 ⇒ 级联三控件（**反推**，编辑页预填用；与 `toItemType` 互为逆）。
 * ★ `NULL` / 闭集外 / 缺键 ⇒ 三控件**全空 = 未选**，**不猜补**（存量未分类就是未分类，猜错无痕）。
 */
const fromItemType = (raw) => {
  switch (String(raw ?? '')) {
    case 'DigitalAutoDeliver': return { type: 'digital', deliver: 'auto', ship: '' }
    case 'DigitalManualDeliver': return { type: 'digital', deliver: 'manual', ship: '' }
    case 'PhysicalFreeShip': return { type: 'physical', deliver: '', ship: 'free' }
    case 'PhysicalBuyerShip': return { type: 'physical', deliver: '', ship: 'buyer' }
    default: return { type: '', deliver: '', ship: '' }
  }
}

/** 数值字段「是否变化」：两侧都按去空白字符串比对（预填即库内原值的字符串形 ⇒ 未改必相等）。 */
const sameText = (a, b) => String(a ?? '').trim() === String(b ?? '').trim()

const PublishItemPage = ({ mode = 'publish' }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { itemId } = useParams()
  const { isAuthenticated, user } = useAuth()
  // ==========================================================================
  // 两种模式（`docs/route-layer.spec.md` §49.12.3 · design §26.13 / §26.16）：
  //   `publish`（`/item/new`）= 本组件原形态，一字未改；
  //   `edit`（`/item/:itemId/edit`）= 同一表单**预填**，取数走**编辑读口**
  //     `GET /api/listing/:listingId/edit`（0059；本人 **或** 管理员 200，同一 11 键行），
  //     保存走**字段模式** `PATCH /api/listing/:listingId`（`updateListingFields`，**禁与 `to_status` 混传**）。
  // 三条编辑口径：
  //   ① `cid` **只读**（后端字段模式不收 `cid` ⇒ 可改字段 6 个：description/price/stock/media_urls/item_type/item_condition）；
  //   ② 草稿（`status='draft'`）**库存输入禁用**（DL60：`stock` 变更仅 `listed` 可改否则 409
  //      `listing_stock_change_requires_listed`）＋ 提示 `item.draftStockLocked`；
  //   ③ `item_type` **反推级联**（四值 → 一级 + 二级；`NULL` ⇒ 三控件全空 = 未选，**不猜补**）。
  // `title` 已退役（2026-10-20）：编辑页同样**只有一个描述多行框**，标题 = 描述首行派生。
  // ==========================================================================
  const isEdit = mode === 'edit'
  // ★ title 退役（Kevin 2026-10-20 · route §49.13 / design §26.14）：表单**没有**标题字段，
  //   唯一正文字段 = `description`（多行，必填）；标题 = **首行派生**（服务端 `split_part` 出 `title` 键）。
  const [form, setForm] = useState({ cid: DEFAULT_CID, price: '', stock: '1', description: '' })
  // 商品分类级联三控件（'' = 未选；initial 空 ⇒ 必选未选不可提交）
  const [itemTypeSel, setItemTypeSel] = useState('')
  const [deliverSel, setDeliverSel] = useState('')
  const [shipSel, setShipSel] = useState('')
  // 商品成色（仅实物分支渲染；'' = 未选。发布模式实物下必选，编辑模式可空 —— 存量行可能为 NULL）
  const [conditionSel, setConditionSel] = useState('')
  // 多件购买授权（**卖方显式**开关；默认关）。可见性 = 库存数值 > 1（见 `stockAllowsMultiBuy`）；
  // 不可见时 state 恒 false（降量 ⇒ 单向自动关；此后回涨不自动恢复）。
  const [multiBuy, setMultiBuy] = useState(false)
  const [miss, setMiss] = useState({ type: false, deliver: false, ship: false, condition: false })
  const [images, setImages] = useState([])
  const [imageNotice, setImageNotice] = useState('')
  // 编辑模式：库内**既有图片**（`/api/media/<id>` 绝对路径），与本地新选图分开存
  //   ⇒ 保存时 `media_urls = [...既有, ...新上传]`，与库内原值逐项比对决定是否上送。
  const [existingMedia, setExistingMedia] = useState([])
  // 编辑模式：本行**原始快照**（用于「只传变化字段」与 `cid`/状态派生）；发布模式恒 `null`。
  const [source, setSource] = useState(null)
  const [loadState, setLoadState] = useState({ phase: isEdit ? 'loading' : 'ready', message: '' })
  // ★ 0059 · 「管理员编辑」态：编辑页 200 而该行**不是我发布的** ⇒ 管理员代编他人商品 ⇒ 页头提示条。
  //   判定 = `canEditAny`（`/api/user` 三键）∧ 该 id 不在 `GET /api/listing/mine` 里
  //   （读口不下发 `seller_uid`，故归属只能用「我的发布」成员判定；**仅此用途**，
  //     预填一律走 `GET /api/listing/:id/edit`）。
  const [adminEdit, setAdminEdit] = useState(false)
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES)
  const tracker = useMemo(() => createListingPublishTracker(), [])
  const fileInputRef = useRef(null)

  /** 草稿 ⇒ 库存锁定（DL60）。发布模式恒 `false`。 */
  const stockLocked = isEdit && String(source?.status ?? '') === 'draft'

  // 多件购买授权：**仅库存数值 > 1 时**渲染开关；不可见 ⇒ 生效值恒 `false`（载荷不带该键）。
  const multiBuyVisible = stockAllowsMultiBuy(form.stock)
  const multiBuyEffective = multiBuyVisible && multiBuy

  /** 只读币种显示文本：`symbol · name`（与下拉同源）；列表里没有 ⇒ 原样显示 cid（已退市币种不猜补）。 */
  const cidLabel = useMemo(() => {
    const hit = currencies.find((row) => String(row.cid) === String(form.cid))
    return hit ? currencyLabel(hit) : String(form.cid ?? '')
  }, [currencies, form.cid])

  // 币种选项：挂载时取一次（公开读口 ⇒ 无 token 也返回）。任一路失败都**回退 $**、绝不拦提交。
  useEffect(() => {
    let cancelled = false
    fetchCurrencies(user)
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows)
          ? rows.filter((row) => row && row.cid !== undefined && row.cid !== null && String(row.cid) !== '')
          : []
        if (!list.length) {
          setCurrencies(FALLBACK_CURRENCIES)
          return
        }
        setCurrencies(list)
        // 默认值不在返回列表里 ⇒ 选第一项（否则 select 会停在空值、提交 `Number('')` = 0）。
        // ★ 编辑模式**不做这项归一**：`cid` 来自库内行、且只读展示（后端字段模式不收 cid）
        //   ⇒ 已退市币种也必须原样显示，不能被「取第一项」改写。
        if (isEdit) return
        setForm((prev) => (
          list.some((row) => String(row.cid) === String(prev.cid))
            ? prev
            : { ...prev, cid: String(list[0].cid) }
        ))
      })
      .catch(() => {
        if (!cancelled) setCurrencies(FALLBACK_CURRENCIES)
      })
    return () => { cancelled = true }
    // 刻意只跑一次（挂载时）：选项来源是公开只读面，不随登录态变化而重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑模式：挂载时取**编辑读口** `GET /api/listing/:id/edit`（0059 · route §49.15）⇒ 逐字段预填。
  //   ★ 为什么换口：旧实现按 `GET /api/listing/mine` 匹配 ⇒ 管理员编辑**他人**商品时该行永不在
  //     「我发布的」里 ⇒ 只能报错（结构性不可用）。新读口两臂（本人 / 管理员）返回**同一 11 键行**。
  //   ★ 预填五项 = `description` / `price` / `stock` / `media_urls` / `item_type` 级联（+ `condition`，
  //     `cid` 只读展示）；**不做任何「猜补」**：`item_type = NULL` ⇒ 三控件全空。
  //   ★ 失败面按状态码分流（**不白屏、不留空表单可提交**）：
  //       403 ⇒ `uiError.forbidden`（无权限；普通用户直访他人 id 即此态）
  //       404 ⇒ `uiError.notFound`（商品不存在）
  //       其它 ⇒ 服务端文案 / `error` 键
  useEffect(() => {
    if (!isEdit) return undefined
    if (!isAuthenticated || !itemId) return undefined
    let cancelled = false
    setLoadState({ phase: 'loading', message: '' })
    setAdminEdit(false)
    setMultiBuy(false) // 换商品 ⇒ 授权开关回到默认关（旧行授权不得串行）
    fetchListingEdit(itemId, user)
      .then((row) => {
        if (cancelled) return
        // 读口恒回单行对象；形状不对（空 / 非对象）⇒ 按失败处理（绝不空表单可提交）
        if (!row || typeof row !== 'object') {
          setLoadState({ phase: 'error', message: t('uiError.notFound') })
          return
        }
        const cascade = fromItemType(row.item_type)
        setForm({
          cid: String(row.cid ?? ''),
          price: String(row.price ?? ''),
          stock: String(row.stock ?? ''),
          description: String(row.description ?? ''),
        })
        setItemTypeSel(cascade.type)
        setDeliverSel(cascade.deliver)
        setShipSel(cascade.ship)
        // 成色预填：行键 `condition`（P57 加性键，值 = 四值闭集字面量或 null）。
        //   ★ 闭集外 / 缺键 ⇒ ''（未选），**不猜补**；实物行的 NULL 也保持未选（编辑不强制补选）。
        const rawCondition = String(row.condition ?? '')
        setConditionSel(ITEM_CONDITIONS.includes(rawCondition) ? rawCondition : '')
        // 多件购买授权预填（读口 14 键之 `allow_multi_buy`，真布尔）：**仅 true 且库存 > 1 时勾上**；
        //   行内 `true ∧ stock = 1`（正常终态）= 开关不渲染 ⇒ state 保持 false ⇒ 保存不带该键。
        setMultiBuy(row.allow_multi_buy === true && stockAllowsMultiBuy(row.stock))
        setExistingMedia(Array.isArray(row.media_urls) ? row.media_urls.map((u) => String(u)) : [])
        setSource({ ...row, item_type: row.item_type ?? null, condition: row.condition ?? null })
        setMiss({ type: false, deliver: false, ship: false, condition: false })
        setLoadState({ phase: 'ready', message: '' })

        // ★ 0059 · 管理员代编提示条（**不阻塞预填**、失败静默）：读口 200 且我具备代编能力 ⇒
        //   再判「这行是不是我的」——读口不下发 `seller_uid`，故用「我的发布」成员判定；
        //   取不到「我的发布」⇒ **不显示**提示条（宁可少提示，也不把本人编辑误标成管理员编辑）。
        return loadListingEditAdmin(user)
          .then((flags) => {
            if (cancelled || !isListingEditAdmin(flags)) return null
            return fetchMyListings(user)
              .then((mine) => {
                if (cancelled || !Array.isArray(mine)) return
                const isMine = mine.some((item) => String(item?.listing_id ?? item?.bID ?? '') === String(itemId))
                setAdminEdit(!isMine)
              })
              .catch(() => {})
          })
          .catch(() => {})
      })
      .catch((error) => {
        if (cancelled) return
        const status = error?.status
        let message
        if (status === 403) message = t('uiError.forbidden')
        else if (status === 404) message = t('uiError.notFound')
        else message = String(error?.message || t('error'))
        setLoadState({ phase: 'error', message })
      })
    return () => { cancelled = true }
    // `user` 只以 `uID` 参与（对象每次渲染可能换引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, itemId, isAuthenticated, user?.uID, t])

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  /** 库存输入（专治「单向自动关」）：库存落到 ≤1 / 空 / 非法 ⇒ 多件购买授权**立即清零**；
   *  ★ 回涨到 ≥2 **不自动恢复**（不是双向联动）。 */
  const setStock = (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, stock: value }))
    if (!stockAllowsMultiBuy(value)) setMultiBuy(false)
  }

  /** 多件购买开关：只存**布尔**（不可见时恒 false，不因点击变 true）。 */
  const toggleMultiBuy = (event) => setMultiBuy(multiBuyVisible ? event.target.checked : false)

  /** 一级「商品分类」：切换即**清空三个二级值**（分支切换 ⇒ stale 值不得进载荷）。
   *  ★ 成色同批清空：数字 / 未分类带 `item_condition` 会被后端判 400 `ITEM_CONDITION_NOT_APPLICABLE`。 */
  const pickItemType = (value) => () => {
    setItemTypeSel(value)
    setDeliverSel('')
    setShipSel('')
    setConditionSel('')
    setMiss({ type: false, deliver: false, ship: false, condition: false })
  }

  /** 二级（数字分支）「发货方式」：仅 `digital` 时渲染。 */
  const pickDeliver = (value) => () => {
    setDeliverSel(value)
    setMiss((prev) => ({ ...prev, deliver: false }))
  }

  /** 二级（实物分支）「运费」：仅 `physical` 时渲染。 */
  const pickShipping = (value) => () => {
    setShipSel(value)
    setMiss((prev) => ({ ...prev, ship: false }))
  }

  /** 成色四选一（**仅实物分支**渲染）：选中即清缺选高亮。 */
  const pickCondition = (value) => () => {
    setConditionSel(value)
    setMiss((prev) => ({ ...prev, condition: false }))
  }

  /** 选图：仅 image/*；超出 4 张忽略多余；逐张本地压缩后入列（失败的单张丢弃，不拦其余）。
   *  压缩后仍 >1MiB 的（`compressImage` 返 null）⇒ **拒收该张**：提示 `item.imageTooLarge`，
   *  该张不入列表（其余已选图片照常保留/入列）。 */
  const onPickImages = async (event) => {
    const input = event.target
    const picked = Array.from(input.files || []).filter((file) => file && String(file.type || '').startsWith('image/'))
    input.value = '' // 允许再次选择同一文件
    const room = MAX_IMAGES - images.length - existingMedia.length
    if (room <= 0 || !picked.length) return
    const accepted = picked.slice(0, room)
    const settled = await Promise.allSettled(accepted.map(compressImage))
    const next = settled.filter((row) => row.status === 'fulfilled' && row.value).map((row) => row.value)
    const tooLarge = settled.filter((row) => row.status === 'fulfilled' && !row.value).length
    setImageNotice(tooLarge > 0 ? t('item.imageTooLarge') : '')
    if (next.length) setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES))
  }

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index))

  /** 编辑模式：移除一张**库内既有**图片（保存时 `media_urls` 会随之变短 ⇒ 进变化字段）。 */
  const removeExistingImage = (index) => setExistingMedia((prev) => prev.filter((_, i) => i !== index))

  /**
   * 编辑保存（**字段模式** `PATCH /api/listing/:listingId` · route §49.12.3 / §49.13.3）：
   *   · **只传变化字段**（未变不上送 ⇒ 不改库存、不重置翻译）；
   *   · `title` / `cid` **永不出现**（`title` 已退役、`cid` 后端字段模式不收）；
   *   · **草稿不上送 `stock`**（DL60）；库存输入此时也是 `disabled`；
   *   · 图片：既有 URL 保留在前，新选图逐张上传后追加（任一张失败 ⇒ 整次取消，不提交半截）。
   * 成功 ⇒ toast `item.editOk` + 回「我发布的」；失败 ⇒ 服务端码映射（409 草稿改库存 / 400 校验）。
   */
  const saveEdit = async (event) => {
    event.preventDefault()
    if (state.phase === 'loading' || loadState.phase !== 'ready' || !source) return

    const priceText = String(form.price).trim()
    const stockText = String(form.stock).trim()
    const description = String(form.description)
    // ⓪ 本地闸（**零网络调用**）：描述必填 / 价格整数 ≥1 / 库存整数 ≥0 / 分类二级「半选」拦截。
    //   ★ 分类**未选不清空**：编辑模式允许「原本未分类 ⇒ 本次不动」，不强制补选（不猜补）；
    //     但一级已选而二级未选 = 半成品 ⇒ 拦（后端把二级缺项映射成 `null` 会静默丢分类）。
    const deliverMiss = itemTypeSel === 'digital' && !deliverSel
    const shipMiss = itemTypeSel === 'physical' && !shipSel
    if (
      !description.trim()
      || !/^\d+$/.test(priceText) || Number(priceText) < 1
      || (!stockLocked && (!/^\d+$/.test(stockText) || Number(stockText) < 0))
      || deliverMiss || shipMiss
    ) {
      setMiss({ type: false, deliver: deliverMiss, ship: shipMiss, condition: false })
      setState({ phase: 'error', message: t('uiError.badRequest') })
      return
    }
    setMiss({ type: false, deliver: false, ship: false, condition: false })
    setState({ phase: 'loading', message: t('jobs.submitting') })

    // ① 新选图逐张上传（既有图已在库内 ⇒ 不重传）；任一张失败 ⇒ 整次取消。
    const uploaded = []
    try {
      for (const image of images) {
        const result = await uploadMedia(user, { content_type: image.contentType, data_base64: image.dataBase64 })
        const url = result?.url
        if (typeof url !== 'string' || !url) throw new Error(String(t('error')))
        uploaded.push(url)
      }
    } catch (error) {
      setState({ phase: 'error', message: `${t('item.imageUploadFail')}: ${String(error?.message || t('error'))}` })
      return
    }

    // ② 只传变化字段（逐字段比对库内原值）
    const nextMedia = [...existingMedia, ...uploaded]
    const prevMedia = Array.isArray(source.media_urls) ? source.media_urls.map((u) => String(u)) : []
    const nextType = toItemType(itemTypeSel, deliverSel, shipSel)
    const nextCondition = toItemCondition(itemTypeSel, conditionSel)
    const patch = {}
    if (description !== String(source.description ?? '')) patch.description = description
    if (!sameText(priceText, source.price)) patch.price = Number(priceText)
    if (!stockLocked && !sameText(stockText, source.stock)) patch.stock = Number(stockText)
    if (JSON.stringify(nextMedia) !== JSON.stringify(prevMedia)) patch.media_urls = nextMedia
    if (nextType !== (source.item_type ?? null)) patch.item_type = nextType
    // 成色（第 6 可改字段）：只在**实变**时上送；数字 / 未分类 ⇒ `null`（显式置 NULL 亦是合法终态）。
    if (nextCondition !== (source.condition ?? null)) patch.item_condition = nextCondition
    // 多件购买授权（第 7 可改字段 · route §49.17）：**只在真实变化时**进 PATCH。
    //   基线也取「库值的**生效**形」（`true ∧ stock = 1` 视为生效 false）—— 该行是「买到只剩 1 件」的
    //   正常终态，开关不渲染、保存**不带该键**（不把库里的 true 抄回去，也不写一条无意义的 false）。
    const sourceMultiBuy = source.allow_multi_buy === true && stockAllowsMultiBuy(source.stock)
    if (multiBuyEffective !== sourceMultiBuy) patch.allow_multi_buy = multiBuyEffective

    // ③ 无变化 ⇒ 不往返（不打扰、也不产生空 patch 的 400 `NO_EDITABLE_FIELD`）
    if (!Object.keys(patch).length) {
      toast.success(t('item.editOk'))
      navigate(root('/profile/trades/published'))
      return
    }

    try {
      const updated = await updateListingFields(itemId, patch, user)
      // 行形状 = `/api/listing/mine` 同族（10 键）⇒ 就地刷新快照（后续再改仍按「只传变化」判断）
      setSource((prev) => ({ ...(prev || {}), ...(updated && typeof updated === 'object' ? updated : patch) }))
      toast.success(t('item.editOk'))
      navigate(root('/profile/trades/published'))
    } catch (error) {
      const code = error?.code
      const status = error?.status
      let message
      if (code === 'listing_stock_change_requires_listed') message = t('item.draftStockLocked')
      else if (status === 400) message = t('uiError.badRequest')
      else message = String(error?.message || t('error'))
      setState({ phase: 'error', message })
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    // ★ 编辑模式 ⇒ 走**字段模式** PATCH（`updateListingFields`，禁与 `to_status` 混传）；
    //   发布链（`POST /api/listing` + `draft→listed`）在本分支之外，一字未改。
    if (isEdit) {
      await saveEdit(event)
      return
    }
    if (state.phase === 'loading') return

    // ⓪ 商品分类级联闸（一级必选 + 分支二级必选 + **实物分支成色必选**）——**先于**图片上传与任何网络调用：
    //    未选 ⇒ 阻止提交（不发 `item_type: ''` / `item_condition: ''`，后端把空串判 400）；提示复用既有键 + 组高亮。
    const nextMiss = {
      type: !itemTypeSel,
      deliver: itemTypeSel === 'digital' && !deliverSel,
      ship: itemTypeSel === 'physical' && !shipSel,
      condition: itemTypeSel === 'physical' && !conditionSel,
    }
    if (nextMiss.type || nextMiss.deliver || nextMiss.ship || nextMiss.condition) {
      setMiss(nextMiss)
      setState({ phase: 'error', message: t('uiError.badRequest') })
      return
    }
    setMiss({ type: false, deliver: false, ship: false, condition: false })

    // ⓪b 描述必填（route §49.13.2：缺省 / `''` / 全空白 ⇒ 后端 400 `listing.description REQUIRED`）
    //     ⇒ 前端先拦（零网络调用）；提示复用既有键，不新增文案。
    if (!String(form.description).trim()) {
      setState({ phase: 'error', message: t('uiError.badRequest') })
      return
    }
    setState({ phase: 'loading', message: t('jobs.submitting') })

    // ① 先逐张上传（顺序）：任一张失败 ⇒ **取消发布**（不调 publishListing，绝不产生半截商品）。
    const mediaUrls = []
    try {
      for (const image of images) {
        const uploaded = await uploadMedia(user, { content_type: image.contentType, data_base64: image.dataBase64 })
        const url = uploaded?.url
        if (typeof url !== 'string' || !url) throw new Error(String(t('error')))
        mediaUrls.push(url)
      }
    } catch (error) {
      tracker.reset() // 本次操作作废 ⇒ 重试重新取键
      setState({ phase: 'error', message: `${t('item.imageUploadFail')}: ${String(error?.message || t('error'))}` })
      return
    }

    const createKey = tracker.keyFor(listingPublishFingerprint(form))
    try {
      const created = await publishListing({
        cid: Number(form.cid),
        price: String(form.price).trim(),
        stock: String(form.stock).trim(),
        // ★ 不上送 `title`（route §49.13.2：非空 title ⇒ 400 NOT_SUPPORTED）；
        //   首行由服务端从描述派生 ⇒ 前端只需一个正文字段。
        description: String(form.description).trim(),
        mediaUrls,
        // 单字段四值（`DigitalAutoDeliver` / `DigitalManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`）——
        // **不发** `shipping` / `free_ship` 之类第二字段（后端不认，route §49.11 ②）；
        // **绝不发裸 `Digital`**（0054 起已退役 = 闭集外 ⇒ 400）。
        itemType: toItemType(itemTypeSel, deliverSel, shipSel),
        // 成色（迁移 0057 四值闭集）：**仅实物两分类**带值；数字 / 未分类 ⇒ `null`（字段缺省）。
        itemCondition: toItemCondition(itemTypeSel, conditionSel),
        // 多件购买授权（迁移 0061 · design §26.18）：**仅授权为真时上送**（此时 `stock > 1` 必成立，
        //   因为开关只在 `stock > 1` 渲染；未授权 ⇒ 字段缺省 ⇒ 服务端落 DEFAULT false）。
        allowMultiBuy: multiBuyEffective,
        createKey,
        user,
      })
      tracker.reset()
      const listingId = created?.listing_id ?? created?.bID ?? null
      // ★ route §49.16：跳转目标用**规范形** `/item/<itemCode>`（响应带 `item_code` 时）；
      //   缺该键（旧后端 / 测试替身）⇒ 回落数字 id。`setListingStatus` 仍走数字 `listing_id`。
      const linkId = itemLinkId(created) || (listingId == null ? null : String(listingId))
      // 上架 = 创建（draft）→ 迁移到 listed；两步都成功后商品才可购买
      let listed = false
      if (listingId) {
        try {
          await setListingStatus(listingId, 'listed', user)
          listed = true
        } catch (error) {
          setState({ phase: 'error', message: `${t('item.listedFail')}: ${String(error?.message || t('error'))}` })
          return
        }
      }
      setState({
        phase: 'ok',
        message: `${t('item.publishOk')} · #${listingId ?? '-'}${listed ? ` · ${t('item.listed')}` : ''}`,
      })
      // ★ 上架**成功且已 listed** ⇒ 自动跳该商品详情页（本单：目标由 `/listing/<id>` 改为 `/item/<id>`）。
      //   口径：① 目标 = 仓内唯一构造器 `root('/item/' + listingId)`（**带当前语言前缀**，四语一致）；
      //        ② **跳转前**先弹 `react-hot-toast`（`main.jsx` 顶层已挂 `<Toaster/>` ⇒ 跨路由存活）；
      //        ③ **失败与无 id 一律不跳**：`listingId` 缺失 ⇒ 保持 ok 态原地停留，**绝不拼 `/item/null`**。
      //           即时跳转（不引延时器）⇒ 无「未清理定时器」面，单测确定性也更高。
      if (listingId && listed) {
        toast.success(`${t('item.publishOk')} · #${listingId}`)
        navigate(root(`/item/${linkId}`))
      }
    } catch (error) {
      setState({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // F2 修复：站内链接 = 当前语言前缀 + 站内路径（唯一构造器 utils.buildLocalizedPath）
  const lang = getLanguageFromUrl(location.pathname)
  const root = (p) => buildLocalizedPath(lang, p)

  if (!isAuthenticated) {
    return (
      <div className="sf-item" data-sf-m="item-hero-empty">
        <div className="sf-item-empty">{t('pleaseLogin')}</div>
      </div>
    )
  }

  return (
    <div className="sf-layout" data-sf-m="item-layout">
      <div className="sf-layout-main">
        <div className="sf-item">
          <div className="sf-item-head" data-sf-m="item-hero">
            {/* ★ 0059 · 管理员编辑他人商品 ⇒ 页头提示条（读口 200 + 非本人行；本人编辑恒不渲染） */}
            {isEdit && adminEdit ? (
              <p className="sf-item-admin-note" data-sf-m="item-admin-note" role="status">
                {t('item.adminEditing')}
              </p>
            ) : null}
            <h1 className="sf-item-title">{isEdit ? t('item.editTitle') : t('item.publish')}</h1>
            <p className="sf-item-note">{t('item.priceRoleNote')}</p>
            <div className="sf-item-actions">
              <Link className="sf-item-link" to={root('/')}>{t('item.list')}</Link>
              <button className="sf-btn sf-item-btn" type="button" onClick={() => navigate(root('/'))} data-sf-m="item-goto-feed">
                {t('item.myOrders')}
              </button>
            </div>
          </div>

          {/* 编辑模式取数门：行未就绪（loading / 失败 / 行不在自己的挂单里）⇒ **不渲染表单**，
              绝不让空表单被提交（空 patch 打到后端 = 400 `NO_EDITABLE_FIELD`）。 */}
          {isEdit && loadState.phase === 'loading' ? (
            <div className="sf-item-empty" data-sf-m="item-edit-loading">{t('jobs.submitting')}</div>
          ) : null}
          {isEdit && loadState.phase === 'error' ? (
            <div className="sf-item-empty" data-sf-m="item-edit-load-error" role="alert">
              <span>{loadState.message}</span>
              {/* ★ 失败态不白屏：给回「商品列表」的出口（复用既有键 `item.list`，零新增文案） */}
              <Link className="sf-item-link" to={root('/')}>{t('item.list')}</Link>
            </div>
          ) : null}
          {(!isEdit || loadState.phase === 'ready') && (
          <form className="sf-item-panel" onSubmit={onSubmit} data-sf-m="item-form">
            <div className="sf-item-form">
              {/* 唯一正文字段（design §26.14）：单描述多行框；**无**标题输入框（`item-input-title` DOM 0 命中）。
                  框下**常驻**提示「第一行将作为标题」（不是 placeholder）；标题=首行派生，卡面/列表再按 48 显示宽单位截断。 */}
              <label className="sf-item-field sf-item-field-wide">
                <span className="sf-item-label">{t('item.description')}</span>
                <textarea
                  className="sf-item-textarea"
                  data-sf-m="item-input-note"
                  value={form.description}
                  onChange={setField('description')}
                  rows={3}
                  required
                  aria-describedby="item-desc-hint"
                />
                <p className="sf-item-hint" id="item-desc-hint" data-sf-m="item-desc-hint">{t('item.descFirstLineHint')}</p>
              </label>
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.price')}</span>
                <input className="sf-item-input" data-sf-m="item-input-price" value={form.price} onChange={setField('price')} inputMode="numeric" required />
              </label>
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.stock')}</span>
                <input
                  className="sf-item-input"
                  data-sf-m="item-input-stock"
                  value={form.stock}
                  onChange={setStock}
                  inputMode="numeric"
                  required
                  disabled={stockLocked}
                />
                {/* ★ 草稿库存锁（DL60）：`stock` 仅 `listed` 可改 ⇒ 草稿下输入禁用 + 常驻提示。 */}
                {stockLocked ? (
                  <p className="sf-item-hint" data-sf-m="item-stock-locked">{t('item.draftStockLocked')}</p>
                ) : null}
              </label>
              {/* ★ 多件购买授权（design §26.18 · route §49.17）：**仅 `stock > 1` 时渲染**
                  （不可见 = 整块不渲染，非 display:none；state 同时被强制 false）。
                  形态 = 原生 `checkbox` + `<label>`（不新造 switch 组件）；触控 ≥44 / 字号 ≥12 落 CSS。
                  默认**关**；库存降回 ≤1 ⇒ 单向自动关，回涨不自动恢复。 */}
              {multiBuyVisible ? (
                <div className="sf-item-field sf-item-field-wide sf-item-multibuy" data-sf-m="item-multi-buy">
                  <label className="sf-item-check" data-sf-m="item-input-multi-buy">
                    <input
                      className="sf-item-check-box"
                      type="checkbox"
                      checked={multiBuyEffective}
                      onChange={toggleMultiBuy}
                      data-sf-m="item-input-multi-buy-box"
                    />
                    <span className="sf-item-check-text">{t('item.multiBuyLabel')}</span>
                  </label>
                </div>
              ) : null}
              {/* 币种：发布 = 下拉（可改）；编辑 = **只读展示**（后端字段模式不收 `cid` ⇒ 不可改，
                  已退市币种也原样显示 `cid` 数字，不猜补）。 */}
              {isEdit ? (
                <label className="sf-item-field">
                  <span className="sf-item-label">{t('item.cid')}</span>
                  <input
                    className="sf-item-input"
                    data-sf-m="item-cid-readonly"
                    value={cidLabel}
                    readOnly
                    aria-readonly="true"
                  />
                </label>
              ) : (
              <label className="sf-item-field">
                <span className="sf-item-label">{t('item.cid')}</span>
                <select className="sf-item-input" data-sf-m="item-select-cid" value={form.cid} onChange={setField('cid')} required>
                  {currencies.map((row) => (
                    <option key={String(row.cid)} value={String(row.cid)}>{currencyLabel(row)}</option>
                  ))}
                </select>
              </label>
              )}
              {/* 商品分类（Kevin 2026-10-20「2 + 2 两控件」）· 控件 A = 2 选 1（必选）
                  钩子：组容器 `item-select-type`（design §26.12.4 承 `item-select-cid` 体例）+
                  每个选项 `item-input-type-digital` / `item-input-type-physical`。
                  未选 ⇒ 提交闸拦截（下方 `onSubmit` ⓪）+ 本组 `aria-invalid` + 选项行高亮。 */}
              <div
                className={`sf-item-field sf-item-field-wide sf-item-choice${miss.type ? ' sf-item-choice-miss' : ''}`}
                data-sf-m="item-select-type"
                data-sf-miss={miss.type ? '1' : undefined}
                role="radiogroup"
                aria-required="true"
                aria-invalid={miss.type ? 'true' : undefined}
              >
                {TYPE_OPTIONS.map((option) => (
                  <label className="sf-item-choice-opt" key={option.value}>
                    <input
                      className="sf-item-choice-input"
                      type="radio"
                      name="item_type"
                      value={option.value}
                      data-sf-m={`item-input-type-${option.value}`}
                      checked={itemTypeSel === option.value}
                      onChange={pickItemType(option.value)}
                    />
                    <span className="sf-item-choice-text">{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>

              {/* 二级（数字分支）「发货方式」2 选 1（**条件必选**）：**仅** 分类 = 数字商品时渲染。
                  实物分支 ⇒ 整个控件不渲染（不是 display:none）且值已被清空 ⇒ 不参与载荷。
                  钩子：组容器 `item-select-deliver` + 选项 `item-input-deliver-auto` / `item-input-deliver-manual`。 */}
              {itemTypeSel === 'digital' ? (
                <div
                  className={`sf-item-field sf-item-field-wide sf-item-choice${miss.deliver ? ' sf-item-choice-miss' : ''}`}
                  data-sf-m="item-select-deliver"
                  data-sf-miss={miss.deliver ? '1' : undefined}
                  role="radiogroup"
                  aria-required="true"
                  aria-invalid={miss.deliver ? 'true' : undefined}
                >
                  {DELIVER_OPTIONS.map((option) => (
                    <label className="sf-item-choice-opt" key={option.value}>
                      <input
                        className="sf-item-choice-input"
                        type="radio"
                        name="item_deliver"
                        value={option.value}
                        data-sf-m={`item-input-deliver-${option.value}`}
                        checked={deliverSel === option.value}
                        onChange={pickDeliver(option.value)}
                      />
                      <span className="sf-item-choice-text">{t(option.labelKey)}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {/* 二级（实物分支）「运费」2 选 1（**条件必选**）：**仅** 分类 = 实物商品时渲染。
                  数字分支 ⇒ 整个控件不渲染（不是 display:none）且值已被清空 ⇒ 不参与载荷。
                  钩子：组容器 `item-select-ship` + 选项 `item-input-ship-free` / `item-input-ship-buyer`。 */}
              {itemTypeSel === 'physical' ? (
                <div
                  className={`sf-item-field sf-item-field-wide sf-item-choice${miss.ship ? ' sf-item-choice-miss' : ''}`}
                  data-sf-m="item-select-ship"
                  data-sf-miss={miss.ship ? '1' : undefined}
                  role="radiogroup"
                  aria-required="true"
                  aria-invalid={miss.ship ? 'true' : undefined}
                >
                  {SHIP_OPTIONS.map((option) => (
                    <label className="sf-item-choice-opt" key={option.value}>
                      <input
                        className="sf-item-choice-input"
                        type="radio"
                        name="item_shipping"
                        value={option.value}
                        data-sf-m={`item-input-ship-${option.value}`}
                        checked={shipSel === option.value}
                        onChange={pickShipping(option.value)}
                      />
                      <span className="sf-item-choice-text">{t(option.labelKey)}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {/* 成色四选一（**条件必选**）：**仅** 分类 = 实物商品时渲染（迁移 0057 四值闭集）。
                  数字 / 未分类 ⇒ 整个控件不渲染（不是 display:none）且值已被清空 ⇒ 不参与载荷
                  （后端：数字两分类带值 ⇒ 400 `ITEM_CONDITION_NOT_APPLICABLE`）。
                  钩子：组容器 `item-select-condition` + 选项
                  `item-input-condition-brandNewSealed` / `-likeNew` / `-minorWear` / `-heavyWear`。 */}
              {itemTypeSel === 'physical' ? (
                <div
                  className={`sf-item-field sf-item-field-wide sf-item-choice${miss.condition ? ' sf-item-choice-miss' : ''}`}
                  data-sf-m="item-select-condition"
                  data-sf-miss={miss.condition ? '1' : undefined}
                  role="radiogroup"
                  aria-required="true"
                  aria-invalid={miss.condition ? 'true' : undefined}
                >
                  {CONDITION_OPTIONS.map((option) => (
                    <label className="sf-item-choice-opt" key={option.value}>
                      <input
                        className="sf-item-choice-input"
                        type="radio"
                        name="item_condition"
                        value={option.value}
                        data-sf-m={`item-input-condition-${option.hook}`}
                        checked={conditionSel === option.value}
                        onChange={pickCondition(option.value)}
                      />
                      <span className="sf-item-choice-text">{t(option.labelKey)}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="sf-item-field sf-item-field-wide" data-sf-m="item-images">
                <span className="sf-item-label">{t('item.imagesLabel')}</span>
                <input
                  ref={fileInputRef}
                  className="sf-item-file"
                  type="file"
                  accept="image/*"
                  multiple
                  data-sf-m="item-image-input"
                  onChange={onPickImages}
                />
                <div className="sf-item-image-row">
                  <button
                    className="sf-btn sf-item-btn"
                    type="button"
                    data-sf-m="item-image-add"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length + existingMedia.length >= MAX_IMAGES}
                  >
                    +
                  </button>
                  {/* 编辑模式：库内**既有**图（URL 直出，不重传）；移除 ⇒ 保存时进 `media_urls` 变化字段 */}
                  {existingMedia.map((url, index) => (
                    <div className="sf-item-image-thumb" data-sf-m={`item-image-existing-${index}`} key={`existing:${url}`}>
                      <img src={url} alt="" />
                      <button
                        className="sf-item-image-remove"
                        type="button"
                        data-sf-m={`item-image-existing-remove-${index}`}
                        onClick={() => removeExistingImage(index)}
                      >
                        {t('item.imageRemove')}
                      </button>
                    </div>
                  ))}
                  {images.map((image, index) => (
                    <div className="sf-item-image-thumb" data-sf-m={`item-image-thumb-${index}`} key={`${index}:${image.contentType}:${image.preview.length}`}>
                      <img src={image.preview} alt="" />
                      <button
                        className="sf-item-image-remove"
                        type="button"
                        data-sf-m={`item-image-remove-${index}`}
                        onClick={() => removeImage(index)}
                      >
                        {t('item.imageRemove')}
                      </button>
                    </div>
                  ))}
                </div>
                {imageNotice ? (
                  <p className="sf-item-meta sf-item-err" data-sf-m="item-image-notice" role="alert">{imageNotice}</p>
                ) : null}
              </div>
            </div>
            {isEdit ? null : <p className="sf-item-meta">{t('item.cidNote')}</p>}
            <div className="sf-item-row">
              <button className="sf-btn sf-item-btn" type="submit" data-sf-m="item-primary" disabled={state.phase === 'loading'}>
                {state.phase === 'loading' ? t('jobs.submitting') : (isEdit ? t('item.editOk') : t('item.publish'))}
              </button>
              <span
                className={`sf-item-status${state.phase === 'error' ? ' sf-item-err' : ''}${state.phase === 'ok' ? ' sf-item-ok' : ''}`}
                data-sf-m="item-status"
                data-sf-phase={state.phase}
                role="status"
              >
                {state.message}
              </span>
            </div>
          </form>
          )}
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-item-panel" data-sf-m="item-side">
          <h2 className="sf-item-title">{t('item.line')}</h2>
          <p className="sf-item-meta">{t('item.publishNote')}</p>
          <p className="sf-item-meta">{t('item.stockNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default PublishItemPage
