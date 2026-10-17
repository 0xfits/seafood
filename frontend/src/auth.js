const AUTH_STORAGE_KEY = 'user'
const LEGACY_TOKEN_KEY = 'token'

export const AUTH_CHANGE_EVENT = 'jinli:auth-change'

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const dispatchAuthChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
  }
}

/**
 * ★ 会话过期治理（S1 · 2026-10-17）· 会话确实失效时派发的**一次性**通知事件。
 * 消费点 = `components/SessionExpiredNotice.jsx`（转成 `sessionExpired` toast）；
 * 与 `AUTH_CHANGE_EVENT` 分工：后者管「存储变了 ⇒ 重读」，本事件管「请提示用户」。
 */
export const SESSION_EXPIRED_EVENT = 'jinli:session-expired'

/** `R107` 契约里 401 的**唯一**机读码 / i18n 键（后端 `auth.ts` + `index.ts` 恒为这一对）。 */
export const UNAUTHORIZED_STATUS = 401
export const UNAUTHORIZED_CODE = 'AUTH_UNAUTHORIZED'
export const UNAUTHORIZED_I18N_KEY = 'auth.err.AUTH_UNAUTHORIZED'

/**
 * 静默清存储（**不派发**任何事件）。
 * 为什么单列：`getStoredUser()` / `isAuthenticatedUser()` 会在 **React 渲染期**被调用，
 * 渲染期同步派发 `AUTH_CHANGE_EVENT` 会让 `AuthProvider` 的 `setUser` 在渲染中执行
 * （React 报「Cannot update a component while rendering」）⇒ 过期清理一律走静默版，
 * 只有显式动作（登出 / 401 治理）才走会派发事件的 `clearAuthSession()`。
 */
const purgeAuthStorage = () => {
  if (!canUseStorage()) return
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export const normalizeAuthUser = (user) => {
  if (!user || typeof user !== 'object') return null

  const normalized = { ...user }
  const token = normalized.token || normalized.access_token || ''

  if (token) {
    normalized.token = token
    normalized.access_token = token
  } else {
    delete normalized.token
    delete normalized.access_token
  }

  if (normalized.bio == null) {
    normalized.bio = ''
  }

  return normalized
}

/**
 * ★ 会话过期治理（S1）· 纯 JS base64 → 单字节 ASCII 文本（零环境依赖）。
 * 为什么不复用内置解码器（实测定式）：vitest + jsdom 环境下内置 `atob` **既错又慢** ——
 * 对合法 base64（如 `eyJleHAiOjF9`，解出 `{"exp":1}`）会抛 InvalidCharacterError，
 * 且单次调用实测 **39.35s**，足以把整批单测拖死；`Buffer` / `TextDecoder` 则非浏览器内建。
 * 故自带 6-bit 累加解码：遇到字母表外字符直接回 `''`（不抛）。
 */
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const decodeBase64Ascii = (s) => {
  let out = ''
  let buf = 0
  let bits = 0
  for (let i = 0; i < s.length; i += 1) {
    const idx = B64_ALPHABET.indexOf(s[i])
    if (idx < 0) return ''
    buf = (buf << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out += String.fromCharCode((buf >> bits) & 0xff)
    }
  }
  return out
}

/**
 * ★ 会话过期治理（S1）· JWT payload 段 → 文本。
 * 步骤（缺一即解不出）：① 百分号编码还原（若含 `%`）；② base64url 字母表还原
 * （`-`/`_` → `+`/`/`）；③ 剔除尾部 `=`（JWT 省略 / 可变尾部填充）；④ 纯 JS 解码。
 * 任何失败都回 `''`（不抛）—— 「解析不出」≠「token 无效」。
 */
const decodeJwtPayloadSegment = (token) => {
  if (typeof token !== 'string' || !token) return ''
  const parts = token.split('.')
  if (parts.length !== 3) return ''
  const segment = parts[1]
  if (!segment) return ''

  let normalized = segment
  if (normalized.includes('%')) {
    try {
      normalized = decodeURIComponent(normalized)
    } catch {
      return ''
    }
  }
  normalized = normalized.replace(/-/g, '+').replace(/_/g, '/')
  // 尾部补位一律剔除：解码器按 6-bit 累加，本就不需要 `=` 对齐。
  const stripped = normalized.replace(/=+$/, '')
  if (!stripped) return ''
  // 长度闸：`长度 % 4 === 1` 结构上不可能是合法 base64（补位也救不回来）。
  if (stripped.length % 4 === 1) return ''

  return decodeBase64Ascii(stripped)
}

/**
 * 从 JWT 取 `exp`（秒）。★ **不 `JSON.parse`、不做 UTF-8 还原**（payload 里有非 ASCII 时
 * `JSON.parse` 会因 mojibake 抛错，把合法 token 误判成「解析失败」）；直接在解出的文本上
 * 匹配 `"exp": <数字>`。取不到 / 非有限数 ⇒ `null`。
 */
export const jwtExpirySeconds = (token) => {
  const text = decodeJwtPayloadSegment(token)
  if (!text) return null
  const match = /"exp"\s*:\s*(\d+)/.exec(text)
  if (!match) return null
  const exp = Number(match[1])
  return Number.isFinite(exp) ? exp : null
}

/**
 * token 是否**已过期**。判据（AC3 硬口径）：
 *   · 解析失败 / 非 JWT / 无 `exp` / `exp` 非数字 ⇒ **false（视为有效）** —— 保持旧行为，绝不误踢；
 *   · `exp` 合法 ⇒ `exp * 1000 <= now` 即过期。
 */
export const isTokenExpired = (token, now = Date.now()) => {
  const exp = jwtExpirySeconds(token)
  if (exp === null) return false
  return exp * 1000 <= now
}

/**
 * 原始快照读取（**不做**过期判定）：`replaceAuthToken` 等「写入面」要用它。
 * 为什么单列：滑动续期场景下**旧 token 往往已过期**，若走 `getStoredUser()`（过期即清）就会
 * 先把自己清掉、拿不到 user 快照 ⇒ 续期永远写不进去。读原始快照、由调用方决定语义。
 */
const readRawStoredUser = () => {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return normalizeAuthUser(JSON.parse(raw))
  } catch (error) {
    console.error('Failed to parse stored auth session:', error)
    return null
  }
}

export const getStoredUser = () => {
  const normalized = readRawStoredUser()
  if (!normalized) return null
  // ★ S1：存储里是**已过期** token ⇒ 静默清存储并当游客（否则「菜单仍显示登录」）。
  if (isTokenExpired(getAuthToken(normalized))) {
    purgeAuthStorage()
    return null
  }
  return normalized
}

export const getAuthToken = (user = undefined) => {
  const currentUser = user ?? getStoredUser()
  if (currentUser?.token) return currentUser.token
  if (currentUser?.access_token) return currentUser.access_token
  if (!canUseStorage()) return ''
  return localStorage.getItem(LEGACY_TOKEN_KEY) || ''
}

export const getAuthHeaders = (user = undefined) => {
  const token = getAuthToken(user)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * ★ S1：判据 =「有 token ∧ **本地未过期**」。
 * 读到已过期 token ⇒ 静默清存储并回 `false`（AC3）。解析失败 / 无 `exp` / 非 JWT ⇒ 仍为 `true`（保持旧行为）。
 * 注：这里用静默清理（不派发事件）——本函数会在 `AuthProvider` 渲染体里被调用（见 auth.js 顶部 `purgeAuthStorage` 注释）。
 */
export const isAuthenticatedUser = (user = undefined) => {
  const token = getAuthToken(user)
  if (!token) return false
  if (!isTokenExpired(token)) return true
  purgeAuthStorage()
  return false
}

export const hasCompletedProfile = (user = undefined) => {
  const currentUser = user ?? getStoredUser()
  return Boolean((currentUser?.bio || '').trim())
}

export const saveAuthSession = (user) => {
  if (!canUseStorage()) return normalizeAuthUser(user)

  const normalized = normalizeAuthUser(user)
  if (!normalized) return null

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized))

  const token = getAuthToken(normalized)
  if (token) {
    localStorage.setItem(LEGACY_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }

  dispatchAuthChange()
  return normalized
}

export const mergeAuthSession = (patch) => {
  const current = getStoredUser() || {}
  return saveAuthSession({ ...current, ...(patch || {}) })
}

/**
 * ★ 单一具名导出 ·「把新 token 写回存储」的**唯一入口**（滑动续期也只走这里）。
 *
 * 签名：`replaceAuthToken(newToken: string) => user | null`
 *   · `newToken` 空 / 非字符串 / 全空白 ⇒ **不动存储**，返回 `null`；
 *   · 存储里没有 user 快照（未登录 / 已被清）⇒ **不动存储**，返回 `null`（绝不凭空造一个会话）；
 *   · **竞态保护**（多标签 / 并发续期）：`新 exp <= 现有 exp` ⇒ **不覆盖**、返回 `null`
 *     —— 否则晚到的「更早过期」响应会把晚到但更晚过期的 token 压回旧值；
 *     任一侧 `exp` 解不出（非 JWT / 无 `exp`）⇒ **新 token 优先写入**（后端只在验签通过后下发）；
 *   · 否则 ⇒ 读现有快照 → 同写 `token` / `access_token` 两键 → 同步 `LEGACY_TOKEN_KEY`
 *     → 派发 `AUTH_CHANGE_EVENT`（Header / 菜单立刻吃到新 token）→ 返回最新 user 快照。
 *
 * ★ 为什么用**原始快照**读（`readRawStoredUser` 而非 `getStoredUser`）：滑动续期时旧 token 往往
 *   已过期，而 `getStoredUser()` 会把过期会话清掉 ⇒ 续期永远拿不到快照、写不进去。
 *   本函数只负责「写」，**过期判据不在这里**（判据仍在 `isTokenExpired` / `getStoredUser`）。
 *
 * ★ 调用方 = `fetchApiJson` 的成功分支（响应头 `X-Session-Token`）。续期**只调这一个函数**，
 *   不得再自拼 `localStorage.setItem` / `saveAuthSession`（否则又出现第二套写入路径）。
 */
export const replaceAuthToken = (newToken) => {
  const token = typeof newToken === 'string' ? newToken.trim() : ''
  if (!token) return null

  const current = readRawStoredUser()
  if (!current) return null

  // ★ 竞态保护：只用「更晚过期」的 token 覆盖现有值。任一侧解不出 `exp` ⇒ 以新 token 优先
  //   （后端只在验签通过后才下发续期票；而旧值可能是非 JWT 形态的存量会话）。
  const currentExp = jwtExpirySeconds(current.token || current.access_token || '')
  const nextExp = jwtExpirySeconds(token)
  if (currentExp !== null && nextExp !== null && nextExp <= currentExp) return null

  const next = normalizeAuthUser({ ...current, token, access_token: token })
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
  localStorage.setItem(LEGACY_TOKEN_KEY, token)
  dispatchAuthChange()
  return next
}

export const clearAuthSession = () => {
  if (!canUseStorage()) return

  purgeAuthStorage()
  dispatchAuthChange()
}

// ---------------------------------------------------------------------------
// ★ 会话过期治理（S1 · 2026-10-17）：**全局 401 判定 + 一次性清会话 + 一次性提示**
//
// 立此单的缺陷（Zang 诊断已核实）：无续期机制（`refreshUser` 零消费点）、前端登录态判据不看
// `exp`、`fetchApiJson` 只抛文案 Error ⇒ 除个别页面外**没有任何**全局 401 治理 ⇒ token 过期后
// 读口吃 401 只弹一句文案，菜单仍显示登录（用户反馈的核心矛盾）。
//
// 硬口径（AC4）：**只有 401 + `AUTH_UNAUTHORIZED` 才清会话**。403（权限不足）/ 503（后端暂时
// 不可用）**绝不清**——把用户误踢下线比不踢更糟。
// ---------------------------------------------------------------------------

/** 该响应是否是「会话失效」形态：`status === 401` ∧ `R107` 的 `error.code === AUTH_UNAUTHORIZED`。 */
export const isUnauthorizedResponse = (payload, status) => (
  status === UNAUTHORIZED_STATUS
  && Boolean(payload?.error)
  && typeof payload.error === 'object'
  && payload.error.code === UNAUTHORIZED_CODE
)

/**
 * 可复用 401 判定（**唯一真源**，取代各组件自造的一份）。
 * 入参 = `fetchApiJson` 抛出的 Error（机读面 `code` / `i18nKey` / `status` 都已附上）。
 * 与旧局部实现（`ActiveTaskModal.jsx` 的 `isUnauthorized`）**行为等价的超集**：
 *   · `code` 或 `i18nKey` 命中 ⇒ `true`（旧实现的全部判据，逐字保留）；
 *   · 额外把 403 / 503 显式排除（AC4：即便错误体里带了 401 的字样也不得据此清会话）。
 */
export const isUnauthorizedError = (error) => {
  if (!error || typeof error !== 'object') return false
  const status = error.status
  if (status === 403 || status === 503) return false
  return error.code === UNAUTHORIZED_CODE || error.i18nKey === UNAUTHORIZED_I18N_KEY
}

/**
 * 清会话 + 一次性通知（AC1 / AC2 的写口）。
 * ★「并发多请求同时 401 只提示一次」的机制：`hadSession` 在清理**之前**取 ⇒ 第一个 401 把
 *   `user` / `token` 两个键都清掉，后续并发响应再进来 `getAuthToken()` 已为空 ⇒ `hadSession=false`
 *   ⇒ 不重复通知。零定时器、零全局 flag ⇒ 不存在「节流窗口过后又弹一次」的尾巴。
 * 返回值 = 是否真的清掉了一个会话（供调用方 / 单测断言）。
 */
export const expireAuthSession = () => {
  const hadSession = Boolean(getAuthToken())
  clearAuthSession()
  if (hadSession && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return hadSession
}

/**
 * 受保护路由登记位（AC2）：`ProtectedRoute` 挂载时 +1、卸载时 -1。
 * 用途 = 让「过期提示」知道**当前是否处于受保护路由**：
 *   · 是 ⇒ 不弹 toast（既有 `ProtectedRoute` 自己会出登录引导，别双提示）；
 *   · 否 ⇒ 弹一次性 toast（`sessionExpired` 键）。
 * ★ 不另造「受保护路径清单」——那会与 `App.jsx` 的路由真源分叉（第二套判据）。
 */
let protectedRouteDepth = 0

export const markProtectedRouteActive = () => {
  protectedRouteDepth += 1
  return () => {
    protectedRouteDepth = Math.max(0, protectedRouteDepth - 1)
  }
}

export const isProtectedRouteActive = () => protectedRouteDepth > 0

/**
 * P4-B4b-i · §2.4 **S2**（`R107` 的 401/403 形状）+ §3.3-1 / §3.4：
 * `R107` 统一错误体 = `{ error: { code, message, i18n_key, details } }`（**顶层无 `message`、无 `success`**）。
 * 旧写法 `payload?.message || payload?.error` 在 `R107` 下把 `payload.error`（**对象**）当消息
 * ⇒ 文案退化成 `[object Object]`（§2.4 S2 的触发原因）。
 * 新口径：**对象面**取 `error.message`（回退 `error.code`），`details.reason` 附在括号里（机读面）；
 * 再按 `error.i18n_key`（`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN` = §2.4 **S3** 的两把键）做四语解析。
 */
export const errorCodeOf = (payload) => (
  payload?.error && typeof payload.error === 'object' ? payload.error.code : undefined
)

/**
 * P4-B4c-ii-c · §9.B **B14** / §7-48 —— 两条**登录验签失败**文案的四语覆盖。
 * 真源 = `backend-ts/src/auth.ts:223`（`Invalid wallet signature`）/ `:227`（`Signature does not match the claimed address`）；
 * 出口 = `sendError(res, 401, error.message)`（`backend-ts/src/index.ts:376-380`）⇒ 形状 = `{ success:false, message, error:<同一字符串> }`，
 * **无 `code` / 无 `i18n_key`** ⇒ 前端只能按**服务端原文**映射到四语键（`auth.err.*`），**绝不把英文原文直接丢给用户**。
 * ⚠ 键名 = 按服务端原文归一的**前端映射键**，**不是服务端 code**（§3.6：服务端零新码 / 零新 reason / 零新 kind）。
 */
export const SERVER_MESSAGE_I18N_KEYS = Object.freeze({
  'Invalid wallet signature': 'auth.err.INVALID_WALLET_SIGNATURE',
  'Signature does not match the claimed address': 'auth.err.SIGNATURE_ADDRESS_MISMATCH',
})

/** 服务端原文 → 四语键；未登记 ⇒ `undefined`（调用方**必须**保留兜底文案，不得因映射不到而空白）。 */
export const i18nKeyForServerMessage = (message) => (
  typeof message === 'string' ? SERVER_MESSAGE_I18N_KEYS[message.trim()] : undefined
)

/**
 * ★ D1（文案错配修复）· 按 `error.details.reason` 的**精确映射表**（**优先级最高**）。
 *
 * 立表动机（生产缺陷 · uid 970213 · batt 低于门槛）：招工「参与/报名」（`J2`）与「雇主选定」（`J3`）
 * 在电量不足时，后端 `stateConflict(...)`（`backend-ts/src/job-service.ts:121`）产出的 `R107` 错误体 =
 *   `{ error: { code:'LEDGER_CURRENCY_INVALID_TRANSITION',
 *               message:'Business state transition rejected',
 *               i18n_key:'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
 *               details:{ field:'batt', reason:'BATT_BELOW_ACCEPT_THRESHOLD', … } } }`
 * ⇒ 旧链按通用 `i18n_key` 命中「当前状态不允许此变更。」，把**真实原因（电量低于门槛）对用户不可见**。
 *
 * 口径（本单硬约束）：
 *   · `reason` 命中 ⇒ **优先用本表 i18n 键**（比通用 `i18n_key` 更精确 ⇒ 必须覆盖它）；
 *   · `reason` 未命中（不在本表 / 非字符串 / 无 `details`）⇒ `undefined` ⇒ **后续链路与既有行为逐字不变**；
 *   · 键值**必为四语已存在的既有键**（本单**零新增 locale 键**）—— 目前仅 `battCard.insufficient`
 *     （四语全有：zh「电量低于承接门槛，暂时无法承接任务」/ en / hk / vn）。
 *
 * 扩展方式 = **在此表加一行** `REASON: 'i18nKey'`（**不得**改成巨型 `if` 链；`reason` 是服务端
 * **机读常量**（大写蛇形）⇒ 查表用**精确相等**，不做模式匹配）。
 */
export const REASON_I18N_KEYS = Object.freeze({
  // 电量 < 承接门槛：`job-service.ts:197`（申请报名 / J2）· `:231`（雇主选定 / J3，权威扣费点）
  // —— 两处 `stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD', …)` **逐字同 reason** ⇒ 同一文案。
  BATT_BELOW_ACCEPT_THRESHOLD: 'battCard.insufficient',
})

/**
 * `error.details.reason` → i18n 键；未登记 ⇒ `undefined`（调用方**保持原链路**，不因映射不到而改行为）。
 * 入参 = `R107` 的 `error` 对象面；非对象 / 无 `details.reason` / `reason` 非字符串 ⇒ `undefined`。
 */
export const i18nKeyForErrorReason = (error) => {
  const reason = (error && typeof error === 'object'
    && error.details && typeof error.details === 'object')
    ? error.details.reason
    : undefined
  return typeof reason === 'string' ? REASON_I18N_KEYS[reason] : undefined
}

/**
 * P6-I18N-LIT-B3 · `auth.js` 内两条**通用兜底**文案的键（此前是硬编码中文串）。
 * `REQUEST_FAILED` = 错误体连文案都没有时的 `请求失败 ({{status}})`；
 * `NO_CREDENTIAL` = 本地无 token 时抛出的 `未找到登录凭证`。
 * 取值在 `locales/*.json` 的 `auth.err.*`（四语）；本文件**不再含中文兜底串**，
 * i18n 不可用时回落到 ASCII 串（绝不空白、绝不 `[object Object]`）。
 */
export const FALLBACK_I18N_KEYS = Object.freeze({
  REQUEST_FAILED: 'auth.err.REQUEST_FAILED',
  NO_CREDENTIAL: 'auth.err.NO_CREDENTIAL',
})

/**
 * ★ 批 7-C · F-1「错误文案面收口」· **全大写下划线机读码**判据（可单测的纯函数）。
 * 形态（一个**独立 token**；边界集与裸键 token 判据 `BARE_I18N_KEY_TOKEN_RE` **逐字同一集**）：
 *   ① 整 token 均为 `[A-Z0-9_]` —— 天然排除小写字母与非 ASCII；
 *   ② 至少 1 个下划线；
 *   ③ 长度 ≥ 4。
 * 正例 = `LEDGER_CURRENCY_INVALID_TRANSITION` / `AUTH_UNAUTHORIZED` / `STATEMENT_TIMEOUT`；
 * 反例（**必须仍被接受为服务端原文**）= `系统繁忙，请稍后重试 (too_many_connections)`（zh 句子；token 含小写）、
 *   `Request failed (400)`（`400` 无下划线且长度 < 4）、普通英文句子（`database is unreachable`）、含小写字母的词。
 * 为什么需要它（F-1 实测）：退款拒收回执真体 `error.message = 'LEDGER_CURRENCY_INVALID_TRANSITION'`
 *   —— **不是文案、是机读码**；旧护栏只认「点分裸键 token」（`x.y.z`）⇒ 该形态漏网，
 *   四语用户可见串退化成英文机读码 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`。
 * 残余风险（登记于报告 §6）：纯数字下划线串（如 `2024_01_02`）同样命中；本仓服务端 `message` 面无此形态。
 */
export const MACHINE_CODE_RE = /^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/
export const MACHINE_CODE_TOKEN_RE = /(?:^|[\s()[\]{}"'`,;:/\\|])(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}(?=$|[\s()[\]{}"'`,;:/\\|])/

/** 整串即「全大写下划线机读码」；非字符串 / 空串 ⇒ `false`。 */
export const looksLikeMachineCode = (value) => (
  typeof value === 'string' && MACHINE_CODE_RE.test(value)
)

/** 用户可见串中是否**出现**「全大写下划线机读码」token（整串即码亦为 true）。 */
export const containsMachineCode = (value) => (
  typeof value === 'string' && MACHINE_CODE_TOKEN_RE.test(value)
)

const extractApiErrorMessage = (payload) => {
  const error = payload?.error
  if (error && typeof error === 'object') {
    const reason = error.details && typeof error.details === 'object' ? error.details.reason : undefined
    // ★ 批 7-B（C-1）：**不再**把 `error.code` 当「服务端文案」—— `code`（`LEDGER_AMOUNT_INVALID`
    //   这类**机读码**）不是文案；把它直丢给用户正是 p7-A R-1 已裁定的「服务端码原文」缺陷类。
    //   只有真 `message` 才算原文 ⇒ 无 `message` 时交 ③/④ 四语通用兜底（键面命中则用真文案）。
    const base = error.message || ''
    // ★ 批 7-C（F-1）：服务端 `message` 本身**含「全大写下划线机读码」token** ⇒ 它不是文案
    //   ⇒ 视为**不可用原文** ⇒ 下沉到 ③ 四语通用兜底；`details.reason` 仍留在机读面（`details` 内），
    //   不随文案外泄。服务端 `message` 本体不改（登记为「错误文案面收口」工作项）。
    if (base && !containsMachineCode(base)) {
      // ★ 批 7-D（R1′ · reason 口径订正）：`details.reason` 施**同一判据**（复用 `containsMachineCode`，
      //   禁另写一套正则）—— 命中「全大写下划线机读码」⇒ **不附加 `(reason)` 后缀**。
      //   为什么：`stateConflict()`（`listing-service.ts:55` / `job-service.ts:122` /
      //   `job-funds-service.ts:61` / `currency-service.ts:59`）的 `message='Business state transition
      //   rejected'` + `reason='LISTING_STATE_INVALID'` 会把**机读码外显**成
      //   `Business state transition rejected (LISTING_STATE_INVALID)`。
      //   未命中（真人串如 `too_many_connections`）⇒ **仍保留后缀**（O-1 边界不回归）。
      const suffix = reason && !containsMachineCode(reason) ? ` (${reason})` : ''
      return `${base}${suffix}`
    }
    return undefined
  }
  if (typeof error === 'string' && error && !containsMachineCode(error)) return error
  if (payload?.message && !containsMachineCode(payload.message)) return payload.message
  // 无任何服务端文案（或原文为机读码）⇒ `undefined` 交由 `apiErrorMessage` 走 `auth.err.REQUEST_FAILED` 四语兜底
  return undefined
}

/**
 * ★ 批 7-B · C-1「回退护栏」· **裸 i18n 键形态**判据（可单测的纯函数）。
 * 形态 = `a.b` / `a.b.c`（每段都是标识符；**必须至少一个点**）。
 * 为什么需要它：`R107` 契约里后端账本错误对外回 `i18n_key = ledger.err.<CODE>`
 * （命名法见 `backend-ts/src/ledger-errors.ts` 的 `` `ledger.err.${code}` ``），
 * 而四语 locale **没有** `ledger.err.*` 族键（`docs/data-layer.spec.md` §11.3.1 早已登记「需新增键」）
 * ⇒ i18next 对**未命中**键**原样回键名本身**（本仓实测：`i18n.t('ledger.err.LEDGER_AMOUNT_INVALID')`
 * === `'ledger.err.LEDGER_AMOUNT_INVALID'`）⇒ 任何路径把它当文案输出，用户看到的就是**裸键**。
 * 判据只认「整串即点分标识符」⇒ 正常文案（`请求失败 (500)` / `v1.2` / `Ledger timed out (STATEMENT_TIMEOUT)`）
 * **不匹配**（`v1.2` 的段首是数字、`…(…)` 与中文均不在字母表内）。
 */
export const BARE_I18N_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/

/** 裸 i18n 键形态判定（**整串**即点分标识符）；非字符串 / 空串 ⇒ `false`。 */
export const looksLikeBareI18nKey = (value) => (
  typeof value === 'string' && BARE_I18N_KEY_RE.test(value)
)

/**
 * ★「**文案里出现**裸键 token」判据（比整串判据更强 —— 本单自测发现：服务端把键放进 `message`
 * 且带 `details.reason` 时，`direct` 会被拼成 `'ledger.err.X (NOT_DECIMAL_STRING)'`，
 * **整串判据判不出，裸键却照样出现在用户文案里**）。
 * 边界 = 串首/串尾/空白/括号/引号/逗号/分号/冒号/斜杠 —— 即「一个独立的点分标识符 token」；
 * 正常文案（`请求失败 (500)` / `Ledger statement timed out (STATEMENT_TIMEOUT)` / `v1.2`）**不匹配**。
 * 残余风险（已知，登记于报告 §6）：形如 `See docs.v2` 的英文文案会被误判 —— 本仓服务端文案面无此形态。
 */
export const BARE_I18N_KEY_TOKEN_RE = /(?:^|[\s()[\]{}"'`,;:/\\|])[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+(?=$|[\s()[\]{}"'`,;:/\\|])/

/** 用户可见文案中是否**出现**裸键 token（整串即键亦为 true）。 */
export const containsBareI18nKey = (value) => (
  typeof value === 'string' && BARE_I18N_KEY_TOKEN_RE.test(value)
)

/**
 * 「可用文案」判据：非空字符串 ∧ 不等于所查的键名 ∧ **不含裸键 token**。
 * ⇒ 它是护栏的**唯一准入闸**：`i18n.t()` 的产出与 `fallback` 都要先过它。
 */
const isUsableText = (value, key) => (
  typeof value === 'string'
  && value.length > 0
  && value !== key
  && !containsBareI18nKey(value)
)

/**
 * ★ 批 7-B · C-1「回退护栏」（真源 = 本函数）：错误文案链的**最后一道闸**，**绝不输出裸键**。
 * 候选次序（每条都过 `isUsableText`）：
 *   ① `t(i18nKey)` —— `R107` 的 `i18n_key` / 原文映射键**命中即用真文案**
 *      （⇒ 将来四语补上 `ledger.err.*` 后，本护栏**自动让位**，无需改这里）；
 *   ② `fallback` —— 服务端原文（`R107` 的 `message` 是**中文文案**、属真人可读文本；
 *      本仓既有用例 `auth.test.js` S6（410 弃用面）**逐字依赖**此面 ⇒ 次序上必须先于 ③，
 *      否则 S6 会从「保留服务端文案」退化成通用兜底 = 既有验收面回归）；
 *   ③ **四语通用兜底** `auth.err.REQUEST_FAILED` —— ①② 都不可用时（键未命中且无原文 /
 *      原文本身即裸键 **或即「全大写下划线机读码」**，**这正是 `ledger.err.*` 今天会走的路径**）；
 *   ④ ASCII 兜底 `Request failed` —— 连 i18n 都不可用时（绝不空白、绝不 `[object Object]`）。
 * 动态导入：只在错误路径求值，不把 `i18n.js` 拖进 `auth.js` 的静态依赖图（既有单测对
 * `react-i18next` 做 mock，静态导入会连带崩）。
 */
const resolveI18nMessage = async (i18nKey, fallback, vars = undefined) => {
  let i18n = null
  try {
    i18n = (await import('./i18n')).default
  } catch {
    i18n = null
  }

  const fromI18n = (key) => {
    if (!key || typeof i18n?.t !== 'function') return undefined
    const value = i18n.t(key, vars)
    return isUsableText(value, key) ? value : undefined
  }

  // ① 真键命中
  const hit = i18nKey ? fromI18n(i18nKey) : undefined
  if (hit) return hit

  // ② 服务端原文（nullish 合并，非 ||：空串等非法值继续下沉到 ③/④）
  if (isUsableText(fallback, i18nKey)) return fallback

  // ③ 四语通用兜底（未命中 ⇒ i18next 已回键名本身，绝不外泄）⇒ ④ ASCII 兜底
  return fromI18n(FALLBACK_I18N_KEYS.REQUEST_FAILED)
    ?? (vars?.status != null ? `Request failed (${vars.status})` : 'Request failed')
}

/**
 * 错误文案总入口（可单测）：`R107` 对象面 / 旧字符串面 / 裸状态码三态均能给出**字符串**。
 * 优先级 = ① `error.i18n_key`（`R107` 契约键）② **服务端原文映射表**（B14）③ `extractApiErrorMessage`
 * 兜底（未登记错误 ⇒ 原样服务端文案；连文案都没有 ⇒ `auth.err.REQUEST_FAILED` 四语兜底，
 * i18n 不可用时为 ASCII 的 `Request failed (status)`）。
 * ★ 批 7-B（C-1）：**不再**把 ASCII `Request failed (status)` 塞进 `fallback` —— 那会让「键未命中且无
 * 服务端原文」落到英文 ASCII 而非四语通用兜底；现在终局兜底统一由 `resolveI18nMessage` 的 ③/④ 承担，
 * 且 ③/④ 之前每一跳都过「非裸键」闸（⇒ `ledger.err.*` 这类**未本地化**键**绝不外泄键名本身**）。
 */
export const apiErrorMessage = async (payload, status) => {
  const error = payload?.error
  const rawMessage = typeof error === 'string' && error
    ? error
    : (error && typeof error === 'object' ? (error.message || error.code) : payload?.message)
  const direct = extractApiErrorMessage(payload)
  // ★ D1：`error.details.reason` 的精确映射**优先级最高** —— reason 命中 ⇒ 用该 reason 对应的 i18n 键
  //   （必须**覆盖**通用 `error.i18n_key`：电量不足须显示「电量低于承接门槛…」，
  //    而不是 `ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION` 的「当前状态不允许此变更。」）；
  //   reason 未命中 ⇒ `undefined` ⇒ 下三跳与既有行为**逐字不变**（零回归）。
  const reasonKey = i18nKeyForErrorReason(error)
  const mappedKey = reasonKey
    || (error && typeof error === 'object' ? error.i18n_key : undefined)
    || i18nKeyForServerMessage(rawMessage)
    || (direct ? undefined : FALLBACK_I18N_KEYS.REQUEST_FAILED)
  return resolveI18nMessage(mappedKey, direct, { status })
}

export const fetchApiJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    const failure = new Error(await apiErrorMessage(payload, response.status))
    // ★ D1 补丁（R-9-83 闭环接通）· **只做加法**：把 `payload.error` 的**机读面**附到抛出的
    //   Error 实例上。`JobDetailPage` 的闭环判据 `error?.details?.reason === 'BATT_BELOW_ACCEPT_THRESHOLD'`
    //   （`pages/jobs/JobDetailPage.jsx:92`）此前恒 `undefined` ⇒ 被拒提示**永不渲染**。
    //   护栏：① `failure.message` 取值与既有链路**逐字不变**（仍 = `apiErrorMessage(...)` 文案）；
    //         ② 机读码 / `reason` **绝不拼进 `message`**（否则外泄机读码 ⇒ 违既有护栏）；
    //         ③ 字段缺失 / 非对象 ⇒ **不附**（不制造空面）。
    const machine = payload?.error
    if (machine && typeof machine === 'object') {
      if (machine.details && typeof machine.details === 'object') failure.details = machine.details
      if (typeof machine.code === 'string' && machine.code) failure.code = machine.code
      if (typeof machine.i18n_key === 'string' && machine.i18n_key) failure.i18nKey = machine.i18n_key
    }
    // ★ S1（AC1 / AC4）· **全局 401 治理的唯一落点**：所有经本函数的请求都在这里过一道。
    //   `status` 只做加法（旧字段集不变）；清会话**只认** `401 + AUTH_UNAUTHORIZED`
    //   （403 权限不足 / 503 后端暂时不可用 ⇒ 不动会话，见 `isUnauthorizedResponse`）。
    failure.status = response.status
    if (isUnauthorizedResponse(payload, response.status)) {
      // 清会话 ⇒ 派发 AUTH_CHANGE_EVENT ⇒ `AuthProvider` 重读存储 ⇒ Header / 菜单回落游客态；
      // 会话确实存在过时再派发一次 `SESSION_EXPIRED_EVENT`（并发 401 只一次，见 `expireAuthSession`）。
      expireAuthSession()
    }
    throw failure
  }

  // ★ 滑动续期接线（S1 续 · 2026-10-17）：后端在「鉴权成功 ∧ 距 `iat` ≥ 1h ∧ 未到绝对上限」时，
  //   会在**任何**鉴权成功的响应上带 `X-Session-Token`（CORS 侧已 `exposedHeaders`）。
  //   读取点**只放这里**（成功分支：`response.ok ∧ payload.success`）——
  //   401 / 403 / 503 分支**不读**该头（那三条路径的语义是清会话或不动会话，与续期无关）。
  //   行为护栏：① 头缺失 / 非字符串 / 全空白 ⇒ 不写、不抛（`headers` 缺失也安全）；
  //             ② 「更早过期不覆盖」的竞态保护在 `replaceAuthToken` 内部（多标签并发共用一处判据）；
  //             ③ 续期属**加法**：任何异常都不得改变本次成功响应的返回值 / 抛错形态。
  try {
    const renewed = response.headers?.get?.('x-session-token')
    if (typeof renewed === 'string' && renewed.trim()) {
      replaceAuthToken(renewed)
    }
  } catch (error) {
    console.warn('Failed to apply renewed session token:', error)
  }

  return payload.data
}

export const requestAuthChallenge = async (evmAddress) => (
  fetchApiJson('/api/auth/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ evm_address: evmAddress }),
  })
)

export const verifyAuthChallenge = async ({ evmAddress, challengeToken, signature }) => (
  fetchApiJson('/api/auth/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      evm_address: evmAddress,
      challenge_token: challengeToken,
      signature,
    }),
  })
)

/**
 * `未找到登录凭证`（四语键 `auth.err.NO_CREDENTIAL`）；i18n 不可用时回落到 ASCII 串（绝不空白）。
 * 批 7-A 收口四（R-1）：本 helper 由模块私有**提升为具名导出**（零行为改动、零新增分支），
 *   供 `ledger-api.fetchMyLedger` 的「无 token 前置」与 `fetchCurrentUser` / `updateMyProfile` **逐字同源**
 *   —— 否则 `ledger-api` 只能自造一份四语解析（= 第二套兜底文案，正是本单要消灭的不一致）。
 */
export const noCredentialError = async () => new Error(
  await resolveI18nMessage(FALLBACK_I18N_KEYS.NO_CREDENTIAL, 'No login credential found'),
)

export const fetchCurrentUser = async (user = undefined) => {
  const token = getAuthToken(user)
  if (!token) {
    throw await noCredentialError()
  }

  return fetchApiJson('/api/user', {
    headers: getAuthHeaders(user),
  })
}

export const updateMyProfile = async (payload, user = undefined) => {
  const token = getAuthToken(user)
  if (!token) {
    throw await noCredentialError()
  }

  return fetchApiJson('/api/user/profile', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  })
}
