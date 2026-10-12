// ============================================================================
// 站内信 + Telegram 绑定 · API 接线层（A5 收口 · Kong 2026-10-12）
// 依据（唯一权威）：docs/route-layer.spec.md v2.31 §41（`/api/messages` 族 6 + `/api/telegram` 族 4）
//   形态/键集 = docs/design/design-system.spec.md v1.17 §20（T100–T103）
// 只调用**已注册**路径（真源 = backend-ts/src/index.ts 的 `app.<verb>(` 表）：
//   POST /api/messages/conversations                          开会话（自然幂等 · 无 create_key）
//   GET  /api/messages/conversations                          会话列表（keyset 游标 (time_updated, conversation_id)）
//   GET  /api/messages/conversations/:conversationId/messages 消息流（keyset 游标 before_msg_id，倒序）
//   POST /api/messages/conversations/:conversationId/messages 发消息（`cli:` 前端供键）
//   POST /api/messages/conversations/:conversationId/read     读水位（天然幂等 · 无键）
//   GET  /api/messages/unread-count                           未读总数（角标唯一真源）
//   POST /api/telegram/bind/start                             取绑定码（env 缺 ⇒ 503 TG_NOT_CONFIGURED）
//   POST /api/telegram/unbind                                 解绑（重复解绑 ⇒ 400 TG_NOT_LINKED）
//   GET  /api/telegram/bind/status                            绑定状态（**绝不回 tg_user_id**）
//
// ★ 幂等键逐面声明（§41.8 写死）：
//   ① `POST …/messages`（#4）⇒ **前端必供** `cli:<uuid-v4>`（fail-loud：缺键 ⇒ 400
//      LEDGER_IDEMPOTENCY_KEY_REQUIRED；同键同内容 ⇒ 200 重放返回既有 msg_id，不重复计数/通知）。
//   ② `POST /api/messages/conversations`（#1）⇒ **自然幂等、前端不得自造键**（服务端按
//      (listing_id, buyer_uid) 派生 `open:<…>`）—— §4.5 硬规则「服务端已确定性派生键的面 ⇒ 前端不得自造键」。
//   ③ #5 read / #6 unread-count / #9 bind-status = 纯读或天然幂等 ⇒ 无键。
//
// ★ 分页 = **keyset，禁 OFFSET**（DL25）：列表游标 = `next_cursor {before_time, before_id}`；
//   消息流游标 = `next_before_msg_id`。游标均在响应 `data` 内 ⇒ 既有 `fetchApiJson` 取数即可。
//   ⚠ 本层**不自造**任何游标字段名（逐字沿用后端回传键）。
//
// ★ 错误面：非 2xx / success!==true ⇒ `fetchApiJson` 抛 R107 链解出的**字符串**（`error.i18n_key`
//   形如 `msg.err.<CODE>` / `tg.err.<CODE>`，四语键已落 locale §20.8）；机读面附在
//   `error.code` / `error.details`（既有 D1 补丁），供页面判 429 / 503 降级。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from './auth'
import { createIdempotencyKeyTracker } from './idempotency'

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

/** 会话列表单页默认条数（服务端上限 50）。 */
export const CONVERSATION_PAGE_SIZE = 20
/** 消息流单页默认条数（服务端上限 100）。 */
export const MESSAGE_PAGE_SIZE = 50

// ---- 站内信（#1–#6 · 永不降级） ---------------------------------------------

/**
 * #1 开会话（**自然幂等**：同 (listing_id, buyer_uid) 重放 ⇒ created:false 返回既有 conversation_id）。
 * 前端**不传** create_key（§41.8 ②）。卖家本人开自己商品 ⇒ 400 MSG_SELF_CONVERSATION（服务端双闸）。
 */
export const openConversation = (listingId, user) =>
  postJson('/api/messages/conversations', { listing_id: listingId }, user)

/**
 * #2 会话列表（keyset：`before_time` + `before_id` 游标；`limit ≤ 50`，默认 20）。
 * @returns `{ rows: Array, next_cursor: {before_time,before_id}|null }`
 */
export const fetchConversations = (user, { beforeTime = null, beforeId = null, limit = CONVERSATION_PAGE_SIZE, listingId = null } = {}) => {
  const query = new URLSearchParams()
  query.set('limit', String(limit))
  if (beforeTime != null) query.set('before_time', String(beforeTime))
  if (beforeId != null) query.set('before_id', String(beforeId))
  if (listingId != null) query.set('listing_id', String(listingId))
  return getJson(`/api/messages/conversations?${query.toString()}`, user)
}

/**
 * #3 消息流（keyset：`before_msg_id` 游标；`limit ≤ 100`，默认 50）。
 * @returns `{ conversation: {conversation_id,listing_id,listing_title,role,counterpart_uid}, rows, next_before_msg_id }`
 */
export const fetchConversationMessages = (conversationId, user, { beforeMsgId = null, limit = MESSAGE_PAGE_SIZE } = {}) => {
  const query = new URLSearchParams()
  query.set('limit', String(limit))
  if (beforeMsgId != null) query.set('before_msg_id', String(beforeMsgId))
  return getJson(`/api/messages/conversations/${conversationId}/messages?${query.toString()}`, user)
}

/** #4 发消息（**`cli:` 前端供键**，见文件头 ①）。@returns `{ msg_id, time_created, conversation_id }` */
export const sendConversationMessage = (conversationId, { body, createKey, user }) =>
  postJson(`/api/messages/conversations/${conversationId}/messages`, { body, create_key: createKey }, user)

/** #5 读水位（天然幂等：水位单调）。@returns `{ last_read_msg_id }` */
export const markConversationRead = (conversationId, user) =>
  postJson(`/api/messages/conversations/${conversationId}/read`, {}, user)

/** #6 未读总数（角标唯一真源）。@returns `{ unread_total }` */
export const fetchUnreadCount = (user) => getJson('/api/messages/unread-count', user)

// ---- Telegram 绑定面（#7–#9 · env 缺 ⇒ 503 TG_NOT_CONFIGURED 降级，非 500） ----

/** #7 取绑定码。@returns `{ code, expires_in, bot_username }`；env 缺 ⇒ 抛 503 `TG_NOT_CONFIGURED`。 */
export const startTelegramBind = (user) => postJson('/api/telegram/bind/start', {}, user)

/** #8 解绑。@returns `{ tg_linked: false }`；未绑定 ⇒ 400 `TG_NOT_LINKED`。 */
export const unbindTelegram = (user) => postJson('/api/telegram/unbind', {}, user)

/** #9 绑定状态。@returns `{ tg_linked: boolean, tg_linked_at: string|null }`（**响应无 tg_user_id**）。 */
export const fetchTelegramBindStatus = (user) => getJson('/api/telegram/bind/status', user)

/** 绑定面降级判据（§41.9）：503 + `TG_NOT_CONFIGURED` = env 缺，**非** 500。 */
export const isTelegramNotConfigured = (error) =>
  Number(error?.status) === 503 || error?.code === 'TG_NOT_CONFIGURED' || error?.i18nKey === 'tg.err.TG_NOT_CONFIGURED'

/** 频次闸判据（§41.2 #4 · 429 MSG_RATE_LIMITED）。 */
export const isMessageRateLimited = (error) =>
  error?.code === 'MSG_RATE_LIMITED' || Number(error?.status) === 429

// ---- 幂等键 tracker（发消息面唯一需要前端供键的面） ---------------------------
export const createMessageSendTracker = () => createIdempotencyKeyTracker('cli')

/** 发消息指纹（目标会话 + 正文化）：同一次点击重试 ⇒ 同键；改内容 ⇒ 新键（新实体）。 */
export const messageSendFingerprint = ({ conversationId, body }) =>
  [conversationId, String(body ?? '').trim()].map((v) => String(v ?? '')).join('\u0001')
