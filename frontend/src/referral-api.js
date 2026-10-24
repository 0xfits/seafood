// ============================================================================
// 我的邀请 · API 接线层（Kevin 2026-10-24 需求 · `/profile/invite`）
// ----------------------------------------------------------------------------
//   GET  /api/referral/me    ⇒ { bound, parent_uid, bound_at, depth }
//   POST /api/referral/bind  ⇒ body { inviter_uid: number }；一次性、不可改绑
// 体例仿 `trades-api.js`：鉴权沿用 `getAuthHeaders` / `fetchApiJson`（401 治理已在后者单点收口）。
// **不传 `create_key`**：一人一次由 `referral.child_uid` 主键 + 库侧 0011 ③ 结构性保证
//   （同键重放与「同父重放」不可区分，自造键只会把 409 语义搅浑）⇒ 自然幂等面，前端零键。
// `depth` 是**只读回执**（由 DB 触发器算），前端不计算、不提交（CR16）。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from './auth'

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

/** 我的绑定态（未绑 ⇒ `bound:false` + 三个 null）。 */
export const fetchMyReferral = (user) =>
  fetchApiJson('/api/referral/me', { headers: getAuthHeaders(user) })

/** 绑定邀请人（一次性）。`inviterUid` 必须是正整数（`000100` ⇒ `100` 的补零解析在 UI 层完成）。 */
export const bindReferral = (inviterUid, user) =>
  postJson('/api/referral/bind', { inviter_uid: Number(inviterUid) }, user)
