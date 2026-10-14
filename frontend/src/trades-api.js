// ============================================================================
// 交易线（我的交易/收藏）· API 接线层（sf14 · Kevin 2026-10-14 需求④）
// 依据：派单冻结契约（后端并行单实现中，形状冻结如下；未就绪期间前端以单测替身推进）：
//   GET    /api/listing/mine             ⇒ 数组，行含 listing_id、title、price、cid、status、stock、media_urls、time_created
//   GET    /api/listing-orders/sold      ⇒ 数组，行形状与 GET /api/prize-item 同族（gID/bID）且含 status
//   GET    /api/favorites                ⇒ 数组，行含 listing_id、title、price、cid、status、media_urls、time_created（收藏时间）
//   POST   /api/favorites                ⇒ body 提供数字 listing_id；幂等
//   DELETE /api/favorites/:listingId     ⇒ 幂等删除
// 体例逐条仿 `pages/item/item-api.js`：只调**已注册/契约冻结**路径；鉴权沿用 `getAuthHeaders`/`fetchApiJson`。
// 读面 = 纯读无键；两个写面（收藏加/删）= 自然幂等（同 listing_id 重放同效）⇒ 前端**不造** create_key。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from './auth'

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const deleteJson = (url, user) =>
  fetchApiJson(url, {
    method: 'DELETE',
    headers: getAuthHeaders(user),
  })

// ---- 读面 -------------------------------------------------------------------
/** 我发布的（`listing.seller_uid = me`）。行：listing_id/title/price/cid/status/stock/media_urls/time_created。 */
export const fetchMyListings = (user) => getJson('/api/listing/mine', user)

/** 我卖出的（`listing_order.seller_uid = me`）。行形状 = prize-item 同族（gID=order_id、bID=listing_id）+ status。 */
export const fetchSoldOrders = (user) => getJson('/api/listing-orders/sold', user)

/** 我的收藏。行：listing_id/title/price/cid/status/media_urls/time_created（收藏时间）。 */
export const fetchFavorites = (user) => getJson('/api/favorites', user)

// ---- 写面（自然幂等，不传 create_key） ----------------------------------------
/** 收藏（幂等）：body 只含数字 `listing_id`（契约冻结；重复收藏同效）。 */
export const addFavorite = (listingId, user) =>
  postJson('/api/favorites', { listing_id: Number(listingId) }, user)

/** 取消收藏（幂等删除）。 */
export const removeFavorite = (listingId, user) => deleteJson(`/api/favorites/${listingId}`, user)
