// 顶部菜单余额区（Header 用户下拉）多币种读口与格式化
//
// 契约（后端并行单）：`GET /api/user/balances`（登录）⇒
//   `data: [{ cid, symbol, name, balance(string) }]` —— 已按 cid 升序、仅 balance>0、`$` 在首位。
// 本模块只做三件事：取数（失败 ⇒ 抛错，由调用方降级）、归一（只留有余额的行）、
// 金额千分位格式化（字符串进、字符串出，超大整数走 BigInt，避免 Number 精度丢失）。
// 零新 i18n 键：余额行只渲染「符号 + 金额」，不再有「积分」文案。

import { fetchApiJson, getAuthHeaders } from './auth'

export const BALANCES_ENDPOINT = '/api/user/balances'

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/
const NON_ZERO_DECIMAL_RE = /[1-9]/

/** 金额是否 > 0（字符串 / 数字都接受；坏值按 0 处理 ⇒ 该行不显示） */
export const isPositiveAmount = (value) => {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '')
  if (!DECIMAL_RE.test(raw)) return false
  return NON_ZERO_DECIMAL_RE.test(raw) && !raw.startsWith('-')
}

/**
 * 金额千分位格式化（`$12,234` 里的数字部分）。
 * - 入参是后端 `numeric` 回来的**字符串** ⇒ 不能直接 `toLocaleString()`（字符串上它不做分组）；
 * - 整数位 > 15 位时走 BigInt 逐位分组，避免 `Number` 精度丢失；
 * - 小数部分原样保留、且整数位照常分组（`1234.5` ⇒ `1,234.5`）；
 * - 坏值 / 空值 ⇒ `'0'`（不抛错、不显示 NaN）。
 */
export const formatBalanceAmount = (value) => {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '')
  if (!raw) return '0'
  if (!DECIMAL_RE.test(raw)) {
    const num = Number(raw)
    if (!Number.isFinite(num)) return '0'
    return formatBalanceAmount(String(Math.trunc(num)))
  }

  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw
  const [intPart, fracPart] = unsigned.split('.')

  const groupedInt = intPart.length > 15
    ? BigInt(intPart).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : Number(intPart).toLocaleString('en-US')

  const hasFraction = Boolean(fracPart) && NON_ZERO_DECIMAL_RE.test(fracPart)
  const body = hasFraction ? `${groupedInt}.${fracPart}` : groupedInt
  return negative && NON_ZERO_DECIMAL_RE.test(body) ? `-${body}` : body
}

/**
 * 归一后端行 ⇒ 渲染行 `{ key, symbol, amount }`。
 * 只保留「有 symbol ∧ 余额 > 0」的行（余额 0 / 坏行不渲染）；顺序沿用后端（cid 升序）。
 */
export const toBalanceRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === 'object'
      && typeof row.symbol === 'string' && row.symbol.trim()
      && isPositiveAmount(row.balance))
    .map((row) => ({
      key: `${row.cid ?? ''}:${row.symbol.trim()}`,
      symbol: row.symbol.trim(),
      amount: formatBalanceAmount(row.balance),
    }))

/**
 * 归一后端行 ⇒ **资产卡数据** `{ key, symbol, amount, name }`（`/profile/assets` 币种卡用）。
 * 过滤与格式化与 `toBalanceRows` 同一套口径（`isPositiveAmount` + `formatBalanceAmount`，
 * 余额 0 / 坏行不渲染、顺序沿用后端），额外保留后端 `name`（如 `BTTC` / `平台积分`）供卡片小字。
 */
export const toBalanceCards = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === 'object'
      && typeof row.symbol === 'string' && row.symbol.trim()
      && isPositiveAmount(row.balance))
    .map((row) => ({
      key: `${row.cid ?? ''}:${row.symbol.trim()}`,
      symbol: row.symbol.trim(),
      amount: formatBalanceAmount(row.balance),
      name: typeof row.name === 'string' ? row.name.trim() : '',
    }))

/**
 * 取多币种余额。未登录（无凭据）⇒ 返回 `null`；接口失败 ⇒ **抛错**（调用方据此走单行降级）。
 * 返回非数组（旧后端 404 拿到 `data: null` 一类）⇒ `null`。
 */
export const fetchUserBalances = async () => {
  const headers = getAuthHeaders()
  if (!headers || !headers.Authorization) return null
  const data = await fetchApiJson(BALANCES_ENDPOINT, { headers })
  return Array.isArray(data) ? data : null
}
