// ============================================================================
// 账本流水 · API 接线层（批 7-A / Kong）
// 依据（唯一权威）：docs/data-layer.spec.md DL25（【已冻结】）/ docs/ledger.spec.md R95
//   · `GET /api/user/ledger`（**已注册**；真源 = backend-ts/src/index.ts）。
//   · 分页 = **keyset**：入参 `before_txid` 游标；响应**回传** `next_before_txid`
//     （`null` = 到底）。**禁 OFFSET**（大偏移退化 + 翻页期间新流水会重复/漏项）。
//   · §5.1「碎片读口 ②」：`GET /api/shard/transfer` 的语义由本读口 `?kind=transfer` 取代。
//
// ★ 为什么本层不用既有 `fetchApiJson`：它只回 `payload.data`，会**丢掉**顶层
//   `next_before_txid`（游标不在 `data` 里）。故本层直接读原始响应，取 `data` + 顶层游标。
//   ⇒ **登记（收口四 R-1）**：`fetchApiJson` / `ledger-api` **两套取数入口并存**，
//     待人位待 P6/P7 统一时合并；本层只对齐**错误面与登录面**，不改共用件 `fetchApiJson`。
//
// 失败口径（收口四 R-1 修，对齐 `fetchApiJson` 逐字同链）：
//   非 2xx 或 `success!==true` ⇒ `await apiErrorMessage(payload, response.status)`
//   （链路 = `error.i18n_key` → i18n 四语 → 服务端原文映射 → `auth.err.REQUEST_FAILED` 兜底）。
//   ⚠ 旧写法 `String(payload?.error?.message || payload?.message || 'HTTP ' + status)` 会把
//     `AUTH_UNAUTHORIZED` 这类**服务端码原文**直丢给用户 ⇒ 与全站口径不一致（本地质检发现一）。
// 登录前置（收口四 R-1 修，与 `fetchCurrentUser` / `updateMyProfile` 同构）：
//   无 token ⇒ 抛本地化的 `auth.err.NO_CREDENTIAL`（「未找到登录凭证」），**不打请求**
//   （旧行为 = 发出去吃一个 401，再把 `AUTH_UNAUTHORIZED` 显示给用户）。
// ============================================================================
import { apiErrorMessage, getAuthHeaders, getAuthToken, noCredentialError } from './auth'

/** 单页默认条数（本层声明；上限与「非法值回落」由服务端决定，前端不假设）。 */
export const LEDGER_PAGE_SIZE = 20

/**
 * 「我的流水」读口。
 * @returns `{ rows: Array, nextBeforeTxid: number|null }`（`nextBeforeTxid` = 下一页游标，`null` 表示到底）
 */
export const fetchMyLedger = async ({ user, kind = null, cid = null, beforeTxid = null, limit = LEDGER_PAGE_SIZE } = {}) => {
  // 与 `fetchCurrentUser`（auth.js）同构：无凭证 ⇒ 本地化报错、零请求。
  const token = getAuthToken(user)
  if (!token) {
    throw await noCredentialError()
  }

  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (kind) params.set('kind', kind)
  if (cid) params.set('cid', String(cid))
  if (beforeTxid) params.set('before_txid', String(beforeTxid))

  const response = await fetch(`/api/user/ledger?${params.toString()}`, { headers: getAuthHeaders(user) })
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(await apiErrorMessage(payload, response.status))
  }

  const rows = Array.isArray(payload.data) ? payload.data : []
  const nextBeforeTxid = typeof payload.next_before_txid === 'number' ? payload.next_before_txid : null
  return { rows, nextBeforeTxid }
}
