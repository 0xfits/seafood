// ============================================================================
// 商品线 · API 接线层（P4-B4c-ii-b / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v0.9 §4.2 P1/P2/P4 · §4.5 · §4.7.3 B8 · §3.3（R107）
// 只调用**已注册**路径（真源 = backend-ts/src/index.ts 的 `app.<verb>(` 表，行号 = 本片现取）：
//   GET    /api/prize/all                      :382  商品列表（读侧已换源 `listing`：`bID←listing_id`/`points←price`/
//                                                       `name←title`，`database.ts:1008 listBrands`；公开面）
//   GET    /api/prize/:bID                     :433  商品详情（`:bID` = `listing_id`；`database.ts:2372 getPrizeById`）
//   GET    /api/prize-item                     :546  我的商品订单（`listing_order`，`buyer_uid=me AND status='paid'`；
//                                                       `database.ts:1066 listPrizeItemsByUser`；返回 `gID`=order_id）
//   POST   /api/listing                        :1492 商品上架（直 DML · 无分录；`listing-service.ts:164 createListing`）
//   PATCH  /api/listing/:listingId             :1545 状态迁移（`draft→listed` 才能被购买；`listing-service.ts:286`）
//   POST   /api/listing/:listingId/buy         :1569 购买（`listing-funds-service.ts:191 buyListing`）
//   POST   /api/listing-orders/:orderId/refund :1590 退款（`listing-funds-service.ts:261 refundListingOrder`）
//
// ★ 金额一律**服务端取数**（派单硬口径 #1 / §4.7.3 B8）：本层**不读、不算、不传** `price`/`seller_uid`/`buyer_uid`。
//   购买 payload = **只有** `create_key` + `quantity`（`listing-funds-service.ts:210,214` 逐字：服务层只读这两个键）；
//   客户端传 `price`/`seller_uid`/`buyer_uid` 会被**忽略**（实测读数见报告 §HTTP-B8）。
//   上架的 `price` 是**另一口径** —— A 类「供给侧自主出价」（§4.8.1：客户端出价、路由层零计算）⇒ 允许前端填。
//
// ★ 幂等键**逐面声明**（后端零改动；行号 = 本片现取）：
//   ① `POST /api/listing`                ⇒ **前端供键** `cli:<uuid-v4>`（tracker：同一次操作重试 ⇒ 同一个键）；
//        服务端**缺键则派生** `cli:p4b2c:listing:<parts>:<digest>`（`listing-service.ts:75-81`）⇒ 兜底存在、
//        **不是 fail-loud**（与派单预期「缺键 ⇒ 400」不同 ⇒ 已按实测登记，见报告 §2-③）。
//   ② `PATCH /api/listing/:listingId`    ⇒ **无键面**（业务状态机 + `listing_status_transition_ok` 白名单）。
//   ③ `POST /api/listing/:listingId/buy` ⇒ **前端必供**（fail-loud：缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`，
//        `listing-funds-service.ts:111-114`）。
//   ④ `POST /api/listing-orders/:orderId/refund` ⇒ **服务端派生**事件根键 `biz:listing:refund:<order_id>`
//        （`migrations/0015_listing.sql:667`）⇒ 前端**不传键**（自造键 = 新标识 = 重试变第二次退款）。
//   ⑤ 三个读面（列表 / 详情 / 我的订单）= **纯读面** ⇒ 无键。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { createIdempotencyKeyTracker } from '../../idempotency'

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const patchJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

// ---- 读面（全部已注册） ------------------------------------------------------
/** 商品列表（公开面；读侧已换源 `listing`）。返回行键沿用旧形状：`bID`=listing_id、`name`=title、`points`=price。 */
export const fetchListingFeed = (user, limit = 60) => getJson(`/api/prize/all?limit=${limit}`, user)

/** 商品详情。`listingId` = `listing_id`（= 列表行的 `bID`）。miss ⇒ 404（R107）。 */
export const fetchListingDetail = (listingId, user) => getJson(`/api/prize/${listingId}`, user)

/**
 * ★ 0059 · **编辑页统一预填读口**（`GET /api/listing/:listingId/edit` · route §49.15）。
 *
 * 授权 = 本人 **或** 管理员（`can_access_admin ∧ (is_admin ∨ permissions∋manage_rewards)`）——
 *   两臂返回**同一形状**（与 `GET /api/listing/mine` 行同族 **11 键**：`listing_id / title(派生) /
 *   price / cid / status / stock / media_urls / time_created / description / item_type / condition`）
 *   ⇒ 编辑页只有**一套**预填逻辑，不再按「我发布的」列表匹配（旧路径对管理员编辑他人商品结构性不可用：
 *   他人的行不会出现在 `listing/mine` 里）。
 *
 * 失败面（全部由调用方按 `error.status` 分流，本层只透传）：
 *   · `403` ⇒ 无权限（`AUTH_FORBIDDEN` + `details.reason = ACTOR_NOT_ALLOWED`，与写口同形）；
 *   · `404` ⇒ 商品不存在（`LEDGER_REF_NOT_FOUND`）；判序 = **先 404 后 403**（不给存在性探针）；
 *   · `401` ⇒ `fetchApiJson` 的既有全局治理（清会话），本层不另写。
 * 纯读面（零写 / 零台账 / 零译文），无幂等键。
 */
export const fetchListingEdit = (listingId, user) => getJson(`/api/listing/${listingId}/edit`, user)

/** 我的商品订单（**买家轴**：`listing_order.buyer_uid = me`；行键 `gID`=order_id、`bID`=listing_id）。 */
export const fetchMyListingOrders = (user) => getJson('/api/prize-item', user)

/**
 * 币种列表（**公开只读** · `GET /api/currencies`）。**无鉴权闸**（未登录也返回 200）⇒ 发布页
 * 首屏即可渲染选项，不必等登录态。返回 = 行数组，行键集冻结 = **恰三键** `cid` / `symbol` / `name`
 * （只含 `status='listed'`，按 `cid` 升序；后台字段不外泄）。**读面无键面**（无幂等键）。
 */
export const fetchCurrencies = (user) => getJson('/api/currencies', user)

// ---- 写面 -------------------------------------------------------------------
/**
 * P1 商品上架（直 DML · 无分录）。`price` = A 类**供给侧自主出价**（§4.8.1 ⇒ 客户端可填、原样透传，路由层零计算）。
 * `createKey` = 前端提供的 `cli:` 键（服务端缺键会派生，见文件头 ①）。
 *   `itemType` = 商品分类（迁移 0054 四值闭集 · 承 0053 · 可选）：`DigitalAutoDeliver` /
 *   `DigitalManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`（裸 `Digital` 已退役）；
 *   **原样逐字**发 `item_type`（未分类 ⇒ `null`）；**不发**第二分类字段。
 *   `''` 属非法（后端 400 `LEDGER_AMOUNT_INVALID` + `reason=NOT_IN_CLOSED_SET`）⇒ 调用方须先过前端必选闸。
 *   `itemCondition` = 商品成色（迁移 0057 四值闭集 · 可选）：`BrandNewSealed` / `LikeNew` /
 *   `MinorWear` / `HeavyWear`；**仅实物两分类**允许非空（数字 / 未分类带值 ⇒ 400
 *   `ITEM_CONDITION_NOT_APPLICABLE`）⇒ 调用方只在实物分支带上值，其余传 `null`（**字段缺省**）。
 */
export const publishListing = ({ cid, price, stock, description, mediaUrls, itemType = null, itemCondition = null, allowMultiBuy = false, createKey, user }) => {
  const body = {
    cid,
    price,
    stock,
    // ★ `title` 自 2026-10-20 起**不上送**（route §49.13.2：非空 `title` ⇒ 400 `NOT_SUPPORTED`；
    //   标题 = `description` 首行派生）。`description` 为**必填正文**（缺省/空白 ⇒ 400 `REQUIRED`）。
    description,
    media_urls: mediaUrls,
  }
  // 分类只在**有值**时进载荷：未分类 ⇒ 字段缺省（服务端落 NULL，route §49.11 ② `字段缺省 ⇒ NULL`）。
  if (itemType) body.item_type = itemType
  // 成色同体例：只在**有值**（= 实物分支且已选）时进载荷；数字 / 未分类 ⇒ 字段缺省（落 NULL）。
  if (itemCondition) body.item_condition = itemCondition
  // ★ design §26.18 / route §49.17：多件购买授权（`listing.allow_multi_buy`，布尔）。
  //   **仅 `true` 时上送** ⇒ 未授权 / 库存 ≤1（开关不渲染）⇒ 字段缺省，服务端按 DEFAULT false 落库。
  //   （显式 `false` 亦合法，但缺省更少歧义：不与「调用方到底传没传」纠缠。）
  if (allowMultiBuy === true) body.allow_multi_buy = true
  body.create_key = createKey
  return postJson('/api/listing', body, user)
}

/**
 * 商品图片上传（`POST /api/media` · 媒体单前端阶段 B）。`payload = { content_type, data_base64 }`。
 * **登录闸**：未登录 ⇒ 401（服务端 `requireActor`）；`content_type` 三值闭集、魔数 fail-loud、单张 ≤2MiB；
 * 同图去重 ⇒ 返回**既有** `media_id`（`{ url, media_id, sha256, size_bytes, deduplicated }`）。
 * 本层只透传 ⇒ 压缩/尺寸归调用方（发布页 canvas 长边 ≤1280）。
 */
export const uploadMedia = (user, payload) => postJson('/api/media', payload, user)

/** P1 状态迁移（`draft→listed` / `listed→delisted`）。入参别名取 `to_status`（§4.2 P1 口径）。无键面。 */
export const setListingStatus = (listingId, toStatus, user) =>
  patchJson(`/api/listing/${listingId}`, { to_status: toStatus }, user)

/**
 * P1-b′ **字段编辑**（`PATCH /api/listing/:listingId` 的字段支 · route §49.12.2 / §49.13.3）。
 * `fields` 只允许 `description` / `price` / `stock` / `media_urls` / `item_type` / `item_condition` /
 * `allow_multi_buy` 七键（**零 `title`**；`item_condition` = 迁移 0057 第 6 可改字段；
 * `allow_multi_buy` = 迁移 0061 第 7 可改字段，布尔，**仅在真实变化时进 PATCH**）；
 * **禁与 `to_status` 混传**（后端 400 `BOTH_MODES`）⇒ 本层刻意不提供合并入口，两个函数各管一支。
 * 返回行 = `GET /api/listing/mine` 同族（10 键）⇒ 调用方可行内整行替换。
 */
export const updateListingFields = (listingId, fields, user) =>
  patchJson(`/api/listing/${listingId}`, fields, user)

/**
 * P2 购买（付款即交付）。**金额与对手方服务端取数**：payload 只含 `create_key` + `quantity`
 * （`listing-funds-service.ts:210,214` 逐字只读这两键）⇒ 本层**结构上不可能**传价/传对手方。
 */
export const buyListing = (listingId, { quantity = 1, createKey, user }) =>
  postJson(`/api/listing/${listingId}/buy`, { quantity, create_key: createKey }, user)

/** P4 退款（**actor = 仅卖方**）。键 = 服务端派生（见文件头 ④）⇒ 刻意不传 `create_key`。 */
export const refundListingOrder = (orderId, user) =>
  postJson(`/api/listing-orders/${orderId}/refund`, {}, user)

/** P9③ A2 发货（**actor = 卖方本人**）。键 = 服务端派生 `biz:listing:ship:<order_id>` ⇒ 不传 `create_key`。 */
export const shipListingOrder = (orderId, user) =>
  postJson(`/api/listing-orders/${orderId}/ship`, {}, user)

/** P9③ A3 收货（**actor = 买方本人**）。键 = 服务端派生 `biz:listing:receive:<order_id>` ⇒ 不传 `create_key`。 */
export const receiveListingOrder = (orderId, user) =>
  postJson(`/api/listing-orders/${orderId}/receive`, {}, user)

// ---- 幂等键 tracker（两个需要前端供键的面） ----------------------------------
export const createListingPublishTracker = () => createIdempotencyKeyTracker('cli')
export const createListingBuyTracker = () => createIdempotencyKeyTracker('cli')

/** 上架表单指纹（决定「是否同一次操作」）：不含随机量 ⇒ 重试同指纹 ⇒ 同键。
 *  ★ 4 项（route §49.13.5：**去 `title`**）—— 派生 title 不得回填指纹（会随描述漂移）。 */
export const listingPublishFingerprint = ({ cid, price, stock, description }) =>
  [cid, price, stock, description].map((v) => String(v ?? '').trim()).join('\u0001')

/** 购买操作指纹（目标商品 + 数量）：同一次点击重试 ⇒ 同键。 */
export const listingBuyFingerprint = ({ listingId, quantity }) =>
  [listingId, quantity].map((v) => String(v ?? '').trim()).join('\u0001')
