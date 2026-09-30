// P4-B4b-i · 必验④探针：幂等键语义（§4.5 三款契约）——**真实执行**，非推断
// 覆盖：
//   ① 键前缀形状（`cli:` / `ops:`）与「不含 `#`、不含控制字符」（§4.5 规则段）
//   ② `ops:` 键与服务端 `canonicalAdminOpsKey` **同形**（`ops:<uid>:<action>:<bid>`）
//   ③ **同一次用户操作重试 ⇒ 同一个键**；内容变化 / reset ⇒ 新键（§4.5 v0.6「契约 2」）
import { adminOpsKey, newIdempotencyKey, createIdempotencyKeyTracker } from '/Users/kevin/bistro/seafood/frontend/src/idempotency.js'

const candidateShape = (k) => ({
  key: k,
  has_allowed_prefix: ['biz:', 'cm:', 'cli:', 'ops:'].some((p) => k.startsWith(p)),
  has_reserved_separator: k.includes('#'),
  has_control_char: /[\u0000-\u001f\u007f]/.test(k),
  length_ok: k.length <= 200,
})

const tracker = createIdempotencyKeyTracker('cli')
const fpA = JSON.stringify({ bID: 3, side: 'buy', price: 7, volume: 2 })
const first = tracker.keyFor(fpA)
const retry = tracker.keyFor(fpA)
const changed = tracker.keyFor(JSON.stringify({ bID: 3, side: 'buy', price: 9, volume: 2 }))
tracker.reset()
const afterReset = tracker.keyFor(fpA)

console.log(JSON.stringify({
  new_key_sample: candidateShape(newIdempotencyKey('cli')),
  ops_key_sample: candidateShape(adminOpsKey(7, 'setting', 'system_settings')),
  ops_key_matches_canonical_shape: adminOpsKey(7, 'setting', 'system_settings') === 'ops:7:setting:system_settings',
  sanitize_reserved_separator: adminOpsKey(1, 'permission_save', 'a#b'),
  retry_same_key: first === retry,
  changed_content_new_key: changed !== first,
  reset_gives_new_key: afterReset !== first,
}, null, 2))
