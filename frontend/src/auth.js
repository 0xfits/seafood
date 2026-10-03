const AUTH_STORAGE_KEY = 'user'
const LEGACY_TOKEN_KEY = 'token'

export const AUTH_CHANGE_EVENT = 'jinli:auth-change'

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const dispatchAuthChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
  }
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

export const getStoredUser = () => {
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

export const isAuthenticatedUser = (user = undefined) => Boolean(getAuthToken(user))

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

export const clearAuthSession = () => {
  if (!canUseStorage()) return

  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  dispatchAuthChange()
}

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
    throw failure
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
