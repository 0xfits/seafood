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
// 失败口径：与 `fetchApiJson` 一致 —— 非 2xx 或 `success!==true` ⇒ 抛 `Error(字符串)`（R107 链已在链上解析为串）。
// ============================================================================
import { getAuthHeaders } from './auth'

/** 单页默认条数（本层声明；上限与「非法值回落」由服务端决定，前端不假设）。 */
export const LEDGER_PAGE_SIZE = 20

/**
 * 「我的流水」读口。
 * @returns `{ rows: Array, nextBeforeTxid: number|null }`（`nextBeforeTxid` = 下一页游标，`null` 表示到底）
 */
export const fetchMyLedger = async ({ user, kind = null, cid = null, beforeTxid = null, limit = LEDGER_PAGE_SIZE } = {}) => {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (kind) params.set('kind', kind)
  if (cid) params.set('cid', String(cid))
  if (beforeTxid) params.set('before_txid', String(beforeTxid))

  const response = await fetch(`/api/user/ledger?${params.toString()}`, { headers: getAuthHeaders(user) })
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(String(payload?.error?.message || payload?.message || `HTTP ${response.status}`))
  }

  const rows = Array.isArray(payload.data) ? payload.data : []
  const nextBeforeTxid = typeof payload.next_before_txid === 'number' ? payload.next_before_txid : null
  return { rows, nextBeforeTxid }
}
