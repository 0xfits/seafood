// ============================================================================
// BTTC 代币 铸造 / 分解 · API 接线层（P9④ / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v2.18 §30.7（`R-9-41` 定案 2 动作口）
//   + docs/data-layer.spec.md v0.25 §33（钳制 / 双写 / 配对不变式）。
//   · 读口 = **并入既有用户资产读口 `GET /api/batt`**（`batt-checkin.fetchBatt` 的 `data.bttc` 子对象）⇒ **零新 GET**
//   · `POST /api/bttc/mint` —— 铸造动作口（batt `−mintBattCost` → `$ −mintFeeUsd` 入平台 → BTTC `+1`）
//   · `POST /api/bttc/burn` —— 分解动作口（BTTC 真 burn → `$ −burnFeeUsd` → batt `+burnBattGain` 封顶丢弃）
//
// 口径（沿 `batt-checkin.js`）：
//   · 无 token ⇒ 抛本地化的 `auth.err.NO_CREDENTIAL`（不打请求）。
//   · 非 2xx / `success!==true` ⇒ `apiErrorMessage`（`error.i18n_key` → 四语兜底）。
//   · 幂等键 = **`cli:<UUID>`（调用方供键 · `R-9-41`）** ⇒ 复用 `idempotency.newIdempotencyKey('cli')`；
//     ★ **禁** `biz:bttc:mint:<uid>` 形态（无天然判别子）。
//   · 本层零本地数值计算（承 `R-8-5`）：代价 / 收益 / 钳制由服务端决定，客户端永不决定金额 / 电量。
// ============================================================================
import { apiErrorMessage, getAuthHeaders, getAuthToken, noCredentialError } from './auth'
import { newIdempotencyKey } from './idempotency'

const jsonOrNull = async (response) => response.json().catch(() => null)

const postBttc = async (path, user) => {
  const token = getAuthToken(user)
  if (!token) throw await noCredentialError()
  const response = await fetch(path, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify({ create_key: newIdempotencyKey('cli') }),
  })
  const payload = await jsonOrNull(response)
  if (!response.ok || !payload?.success) throw new Error(await apiErrorMessage(payload, response.status))
  return payload.data
}

/** `POST /api/bttc/mint`：铸造（幂等键 = `cli:<UUID>`，**本次调用新生成**）。 */
export const postBttcMint = ({ user } = {}) => postBttc('/api/bttc/mint', user)

/** `POST /api/bttc/burn`：分解（幂等键 = `cli:<UUID>`，**本次调用新生成**）。 */
export const postBttcBurn = ({ user } = {}) => postBttc('/api/bttc/burn', user)
