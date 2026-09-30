// ============================================================================
// src 侧无对应物：本文件是**前端**的幂等键助手（P4-B4b-i · 兼容性同步）
// ----------------------------------------------------------------------------
// 依据（唯一权威）：docs/route-layer.spec.md v0.9
//   · §4.5 幂等键总表 +「规则」段：键前缀**只允许** `biz:` `cm:` `cli:` `ops:`；
//     键**不得**含 `#`（内部派生分隔符）与控制字符；校验序固定
//     `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`。
//   · §2.4 **S1**（`ops:` 强校验的 4 个后台写口）/ **S10**（2a 写口）/ **§9.B B11**（`POST /api/order`）。
//   · §4.5 v0.6 追加块「契约 2」：**同标识 + 同内容 ⇒ `200` replay**；**异标识 ⇒ 新实体**
//     ⇒ 因此「**同一次用户操作的重试必须复用同一个键**」，否则一次重试会变成两个实体。
//   · §4.5 加注（`ops:` 落地形态 = **请求侧强校验、不落库**）：后台键是**形状契约**（fail-loud），
//     不是重放机制 ⇒ 取**确定性**（同一操作 ⇒ 同一键）即可；服务端**只校验前缀**，
//     不比对规范化值（真源 = `backend-ts/src/admin-service.ts:59-85`）——本助手按 §4.5 的
//     `ops:<admin_uid>:<action>:<key>` 形态产出**同形**键（可与服务端 `canonical_key` 对拍）。
// ============================================================================

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/** §4.5 规则段：去掉 `#`（内部派生分隔符）与控制字符 ⇒ 键形状合法；空值回落 `na`。 */
export const sanitizeIdempotencyPart = (value) => (
  String(value ?? '')
    .replace(/#/g, '-')
    .replace(CONTROL_CHARS, '')
    .trim() || 'na'
)

/** 创建类写口的键 = `cli:<uuid-v4>`（§4.5：招工发布 / 商品上架 / 交易所挂单同族） */
export const newIdempotencyKey = (prefix = 'cli') => {
  const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
  return `${sanitizeIdempotencyPart(prefix)}:${uuid}`
}

/** 后台写口的键 = `ops:<admin_uid>:<action>:<business_id>`（§4.5 DL36 形态；`ops:` 前缀是硬闸） */
export const adminOpsKey = (actorUid, action, businessId) => [
  'ops',
  sanitizeIdempotencyPart(actorUid),
  sanitizeIdempotencyPart(action),
  sanitizeIdempotencyPart(businessId),
].join(':')

/**
 * 「同一次用户操作重试 ⇒ 同一个键」的载体。
 *
 * 用法：`tracker.keyFor(<该次操作的内容指纹>)` —— 指纹相同 ⇒ 复用键（重试 = replay）；
 * 指纹变化（用户改了表单/换了目标实体）⇒ **新键**（= 新实体，符合 §4.5 契约 2「异标识 ⇒ 落新行」）；
 * 操作**成功后**调 `reset()` ⇒ 下一次点击 = 新实体。
 */
export const createIdempotencyKeyTracker = (prefix = 'cli') => {
  let fingerprint = null
  let key = null

  return {
    keyFor(nextFingerprint) {
      if (!key || fingerprint !== nextFingerprint) {
        fingerprint = nextFingerprint
        key = newIdempotencyKey(prefix)
      }
      return key
    },
    current() {
      return key
    },
    reset() {
      fingerprint = null
      key = null
    },
  }
}
