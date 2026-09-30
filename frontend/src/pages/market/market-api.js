// ============================================================================
// 交易所线 · API 接线层（P4-B4c-ii-b / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v0.9 §4.2 M1/M2 · §4.5 · §9.B B11/B12 · §3.3（R107）
// 只调用**已注册**路径（真源 = backend-ts/src/index.ts，行号 = 本片现取）：
//   GET    /api/order                    :729  我的挂单（`owner_uid=actor`；`database.ts:3285 listOrdersByUser`）
//   POST   /api/order                    :751  挂单（`market_post_event(op='order')` ⇒ `hold` ×2；
//                                                `market-service.ts:751 placeMarketOrder`）
//   DELETE /api/order                    :782  全体撤单（**入参一律走 query、不得读 body**；返回体保留 `cancelled` 键）
//   DELETE /api/order/:oID               :805  单笔撤单（仅 `owner_uid` 可撤，否则 403；手续费**不退**）
//   GET    /api/market/:base_cid/orderbook :829 订单簿（`SUM(amount-amount_filled)`，按 `base_cid` 聚合）
//   GET    /api/market/:base_cid/trades    :844 成交流水（`market_trade` + 对手方 uid 合成；**只读**）
//
// ★ 入参口径（逐字）：
//   · `POST /api/order` 必需 = `side`（`buy`/`sell`）+ `base_cid`（别名 `baseCid`/`bID`）+ `create_key`;
//     可选 = `quote_cid`（**服务端恒 1**，非 1 ⇒ `400 LEDGER_AMOUNT_INVALID/QUOTE_CID_MUST_BE_ONE`）+ `price` + `amount`（别名 `volume`/`quantity`）；
//     `owner_uid`/`ownerUid`/`uID` 传了也**被丢弃**（`market-service.ts:284,310` ⇒ 回包 `client_owner_uid_ignored`）——本层刻意不传。
//   · `DELETE /api/order`（全撤）= **query only**（`market-service.ts` 只读 `req.query`）⇒ 本层不发 body。
//
// ★ 幂等键**逐面声明**：
//   ① `POST /api/order`        ⇒ **前端必供**（fail-loud：缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`，
//        `market-service.ts:154`；§9.B **B11**）⇒ tracker 保证「同一次操作重试 ⇒ 同一个键」。
//   ② `DELETE /api/order/:oID` ⇒ **服务端派生**事件根键 `biz:market:cancel:<order_id>`（`0016_market.sql:625`）⇒ 不传键。
//   ③ `DELETE /api/order`（全撤）⇒ 逐单派生同一族键 ⇒ 不传键。
//   ④ 三个读面（我的挂单 / 订单簿 / 成交流水）= **纯读面** ⇒ 无键。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { createIdempotencyKeyTracker } from '../../idempotency'

/** 平台计价币：`quote_cid` **服务端恒 1**（§4.2 M1；客户端传别的值 ⇒ 400）。本层作为常量声明并单测钉死。 */
export const QUOTE_CID = 1

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const deleteJson = (url, user) => fetchApiJson(url, { method: 'DELETE', headers: getAuthHeaders(user) })

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

// ---- 读面（全部已注册） ------------------------------------------------------
/** 我的挂单（需 token）。 */
export const fetchMyOrders = (user) => getJson('/api/order', user)

/**
 * 订单簿（公开面）。**路径参数 = `base_cid`**（`database.ts:3475 listOrderBook` 的 `WHERE base_cid = $1`）。
 * ⇒ `/api/market/1/orderbook`（base=平台币）与「`quote_cid` 恒 1 且 base≠quote」互斥 ⇒ 该路径**恒空态**
 *   （实测读数见报告 §HTTP）；UI 一律用**真实 base_cid**（挂单表单里那个币种）读。
 */
export const fetchOrderBook = (baseCid, user) => getJson(`/api/market/${baseCid}/orderbook`, user)

/** 成交流水（公开面，只读）。`limit` 走既有 `getPagination`。 */
export const fetchMarketTrades = (baseCid, user, limit = 50) =>
  getJson(`/api/market/${baseCid}/trades?limit=${limit}`, user)

// ---- 写面 -------------------------------------------------------------------
/**
 * M1 挂单。`side` ∈ {buy, sell}；买单冻结 `amount × price` 的 `$`（cid=1），卖单冻结 base 币 `amount`。
 * `createKey` = 前端提供的 `cli:` 键（fail-loud，见文件头 ①）。**刻意不传** `owner_uid`（服务端取 token actor）。
 */
export const placeOrder = ({ side, baseCid, price, amount, createKey, user }) =>
  postJson('/api/order', {
    side,
    base_cid: baseCid,
    quote_cid: QUOTE_CID,
    price,
    amount,
    create_key: createKey,
  }, user)

/** M2 单笔撤单。键 = 服务端派生（文件头 ②）⇒ 无 body。 */
export const cancelOrder = (orderId, user) => deleteJson(`/api/order/${orderId}`, user)

/** M2 全体撤单。**入参一律走 query**（§1 #27 逐字）⇒ 本层**不发 body**（§9.B B12）。 */
export const cancelAllOrders = (user) => deleteJson('/api/order', user)

// ---- 幂等键 tracker（挂单面唯一需要前端供键的面） ----------------------------
export const createOrderPlaceTracker = () => createIdempotencyKeyTracker('cli')

/** 挂单表单指纹（side/base/price/amount）：同一次操作重试 ⇒ 同键；改内容 ⇒ 新键（新实体）。 */
export const orderPlaceFingerprint = ({ side, baseCid, price, amount }) =>
  [side, baseCid, price, amount].map((v) => String(v ?? '').trim()).join('\u0001')
