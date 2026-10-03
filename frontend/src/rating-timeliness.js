// ============================================================================
// 评分 / 时效 / 订单状态机（发货·收货）· API 接线层（P9③ / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v2.16 §29.12（`R-9-33` 定案 5 口）
//   + docs/data-layer.spec.md v0.23 §32（四要素 / 四周期 / 默认值 / 事件时点）。
//   · `GET  /api/rating/summary`                 —— 评分汇总读口（四角色星级 · 4 周期 · 无数据默认 3.0）
//   · `GET  /api/timeliness`                     —— 时效读口（四时长 + 四比率 · 暂无数据 / 默认 100%）
//   · `POST /api/rating`                         —— 提交评分（四要素服务端取数；幂等键服务端派生）
//   · `POST /api/listing-orders/:orderId/ship`   —— 发货（卖方本人；幂等键服务端派生）
//   · `POST /api/listing-orders/:orderId/receive`—— 收货（买方本人；幂等键服务端派生）
//
// 口径（沿 `batt-checkin.js`）：
//   · 无 token ⇒ 抛本地化的 `auth.err.NO_CREDENTIAL`（不打请求）。
//   · 非 2xx / `success!==true` ⇒ `apiErrorMessage`（`error.i18n_key` → 四语兜底）。
//
// ★ 本层零本地数值计算（承 `R-8-5`）：星级 / 时长 / 比率真实性由服务端决定；
//   幂等键一律**服务端派生**（`biz:rating:` / `biz:listing:ship:` / `biz:listing:receive:`）⇒ 本层不传键。
// ============================================================================
import { apiErrorMessage, getAuthHeaders, getAuthToken, noCredentialError } from './auth'

const jsonOrNull = async (response) => response.json().catch(() => null)

const readData = async (response) => {
  const payload = await jsonOrNull(response)
  if (!response.ok || !payload?.success) throw new Error(await apiErrorMessage(payload, response.status))
  return payload.data
}

const getJson = async (url, user) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  return readData(await fetch(url, { headers: getAuthHeaders(user) }))
}

const postJson = async (url, body, user) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  return readData(await fetch(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  }))
}

/**
 * `GET /api/rating/summary?period=<30|90|360|1000>`：四角色星级 + 四周期 + 默认星级。
 * 返回 `{ period, stars:{poster,worker,vendor,customer}, periods, defaultStars, source }`。
 */
export const fetchRatingSummary = ({ user, period } = {}) =>
  getJson(`/api/rating/summary${period ? `?period=${encodeURIComponent(period)}` : ''}`, user)

/** `GET /api/timeliness[?job_id=..&listing_id=..]`：四时长 + 四比率。 */
export const fetchTimeliness = ({ user, jobId, listingId } = {}) => {
  const q = []
  if (jobId) q.push(`job_id=${encodeURIComponent(jobId)}`)
  if (listingId) q.push(`listing_id=${encodeURIComponent(listingId)}`)
  return getJson(`/api/timeliness${q.length ? `?${q.join('&')}` : ''}`, user)
}

/** `POST /api/rating`：提交评分（`targetType`/`targetId`/`direction`/`stars`；键服务端派生）。 */
export const postRating = ({ user, targetType, targetId, direction, stars } = {}) =>
  postJson('/api/rating', { targetType, targetId, direction, stars }, user)

/** `POST /api/listing-orders/:orderId/ship`：发货（actor = 卖方本人）。 */
export const postShip = ({ user, orderId } = {}) =>
  postJson(`/api/listing-orders/${encodeURIComponent(orderId)}/ship`, {}, user)

/** `POST /api/listing-orders/:orderId/receive`：收货（actor = 买方本人）。 */
export const postReceive = ({ user, orderId } = {}) =>
  postJson(`/api/listing-orders/${encodeURIComponent(orderId)}/receive`, {}, user)
