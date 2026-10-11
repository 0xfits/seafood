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

/** 我的商品订单（**买家轴**：`listing_order.buyer_uid = me`；行键 `gID`=order_id、`bID`=listing_id）。 */
export const fetchMyListingOrders = (user) => getJson('/api/prize-item', user)

// ---- 写面 -------------------------------------------------------------------
/**
 * P1 商品上架（直 DML · 无分录）。`price` = A 类**供给侧自主出价**（§4.8.1 ⇒ 客户端可填、原样透传，路由层零计算）。
 * `createKey` = 前端提供的 `cli:` 键（服务端缺键会派生，见文件头 ①）。
 */
export const publishListing = ({ cid, price, stock, title, description, mediaUrls, createKey, user }) =>
  postJson('/api/listing', {
    cid,
    price,
    stock,
    title,
    description,
    media_urls: mediaUrls,
    create_key: createKey,
  }, user)

/** P1 状态迁移（`draft→listed` / `listed→delisted`）。入参别名取 `to_status`（§4.2 P1 口径）。无键面。 */
export const setListingStatus = (listingId, toStatus, user) =>
  patchJson(`/api/listing/${listingId}`, { to_status: toStatus }, user)

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

/** 上架表单指纹（决定「是否同一次操作」）：不含随机量 ⇒ 重试同指纹 ⇒ 同键。 */
export const listingPublishFingerprint = ({ cid, price, stock, title, description }) =>
  [cid, price, stock, title, description].map((v) => String(v ?? '').trim()).join('\u0001')

/** 购买操作指纹（目标商品 + 数量）：同一次点击重试 ⇒ 同键。 */
export const listingBuyFingerprint = ({ listingId, quantity }) =>
  [listingId, quantity].map((v) => String(v ?? '').trim()).join('\u0001')
