// ============================================================================
// batt 电量 + 签到 / 补签 · API 接线层（P9② / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v2.14 §28.2（`R-9-19` 定案 4 口）
//   + docs/data-layer.spec.md v0.21 §31（值域 / 日界 / 溢出 / 补签规则）。
//   · `GET  /api/batt`           —— 电量读口（闸 `requireActor`；用户本人）
//   · `GET  /api/checkin`        —— 签到读口
//   · `POST /api/checkin`        —— 签到动作口（幂等键 = `biz:checkin:<uid>:<checkin_day>`）
//   · `POST /api/checkin/makeup` —— 补签动作口（`body: { target_day }` · 有资金腿）
//
// 口径（沿 `ledger-api.js`）：
//   · 无 token ⇒ 抛本地化的 `auth.err.NO_CREDENTIAL`（不打请求）。
//   · 非 2xx / `success!==true` ⇒ `apiErrorMessage`（`error.i18n_key` → 四语兜底）。
//
// ★ 值域口径：`batt`（0–100）以 `%` 展示（需求 §4.1.1）；数值真实性与封顶 / 丢弃由服务端决定，
//   本层**不**做任何本地数值计算（承 `R-8-5`：客户端永不决定金额 / 电量）。
// ============================================================================
import { apiErrorMessage, getAuthHeaders, getAuthToken, noCredentialError } from './auth'

const jsonOrNull = async (response) => response.json().catch(() => null)

/** UTC 自然日（`R-9-15`）`YYYY-MM-DD` —— 与后端 `utcDay` 同口径（`offsetDays` 取昨日等）。 */
export const utcDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)

/** `GET /api/batt`：`{ batt, capBatt, floorBatt, acceptThresholdBatt, canAccept, updated_at }`。 */
export const fetchBatt = async ({ user } = {}) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  const response = await fetch('/api/batt', { headers: getAuthHeaders(user) })
  const payload = await jsonOrNull(response)
  if (!response.ok || !payload?.success) throw new Error(await apiErrorMessage(payload, response.status))
  return payload.data
}

/** `GET /api/checkin`：`{ streakDay, streakCapDays, checkedInToday, canMakeup, makeupCostUsd, updated_at }`。 */
export const fetchCheckinStatus = async ({ user } = {}) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  const response = await fetch('/api/checkin', { headers: getAuthHeaders(user) })
  const payload = await jsonOrNull(response)
  if (!response.ok || !payload?.success) throw new Error(await apiErrorMessage(payload, response.status))
  return payload.data
}

/** `POST /api/checkin`：签到（幂等键 = 服务端派生定案形 `biz:checkin:<uid>:<checkin_day>`）。 */
export const postCheckin = async ({ user, checkinDay = utcDay() } = {}) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  const uID = user?.uID ?? user?.uid ?? ''
  const response = await fetch('/api/checkin', {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify({ create_key: `biz:checkin:${uID}:${checkinDay}` }),
  })
  const payload = await jsonOrNull(response)
  if (!response.ok || !payload?.success) throw new Error(await apiErrorMessage(payload, response.status))
  return payload.data
}

/** `POST /api/checkin/makeup`：补签（`target_day` = 被补那一天 · 消费 `$` 走服务端取数）。 */
export const postMakeup = async ({ user, targetDay } = {}) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  const uID = user?.uID ?? user?.uid ?? ''
  const day = targetDay || utcDay(-1)
  const response = await fetch('/api/checkin/makeup', {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_day: day, create_key: `biz:checkin:makeup:${uID}:${day}` }),
  })
  const payload = await jsonOrNull(response)
  if (!response.ok || !payload?.success) throw new Error(await apiErrorMessage(payload, response.status))
  return payload.data
}
