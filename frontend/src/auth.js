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

const extractApiErrorMessage = (payload) => {
  const error = payload?.error
  if (error && typeof error === 'object') {
    const reason = error.details && typeof error.details === 'object' ? error.details.reason : undefined
    const base = error.message || error.code || ''
    if (base) return reason ? `${base} (${reason})` : base
  }
  if (typeof error === 'string' && error) return error
  if (payload?.message) return payload.message
  // 无任何服务端文案 ⇒ `undefined` 交由 `apiErrorMessage` 走 `auth.err.REQUEST_FAILED` 四语兜底
  return undefined
}

// `i18n_key`（`R107` 契约键）或**原文映射键**（B14 两键）→ 四语文案。**动态导入**：只在错误路径求值，
// 不把 `i18n.js` 拖进 `auth.js` 的静态依赖图（既有单测对 `react-i18next` 做 mock，静态导入会连带崩）。
const resolveI18nMessage = async (i18nKey, fallback, vars = undefined) => {
  if (!i18nKey) return fallback
  try {
    const { default: i18n } = await import('./i18n')
    if (i18n?.exists?.(i18nKey)) {
      const translated = i18n.t(i18nKey, vars)
      if (translated && translated !== i18nKey) return translated
    }
    return fallback
  } catch {
    // i18n 不可用 ⇒ 保底回落到服务端 `message`（绝不回落到 `[object Object]`、绝不空白）
    return fallback
  }
}

/**
 * 错误文案总入口（可单测）：`R107` 对象面 / 旧字符串面 / 裸状态码三态均能给出**字符串**。
 * 优先级 = ① `error.i18n_key`（`R107` 契约键）② **服务端原文映射表**（B14）③ `extractApiErrorMessage` 兜底
 * （未登记错误 ⇒ 原样服务端文案；连文案都没有 ⇒ `auth.err.REQUEST_FAILED` 四语兜底，
 * i18n 不可用时为 ASCII 的 `Request failed (status)`）。
 */
export const apiErrorMessage = async (payload, status) => {
  const error = payload?.error
  const rawMessage = typeof error === 'string' && error
    ? error
    : (error && typeof error === 'object' ? (error.message || error.code) : payload?.message)
  const direct = extractApiErrorMessage(payload)
  const mappedKey = (error && typeof error === 'object' ? error.i18n_key : undefined)
    || i18nKeyForServerMessage(rawMessage)
    || (direct ? undefined : FALLBACK_I18N_KEYS.REQUEST_FAILED)
  return resolveI18nMessage(mappedKey, direct || `Request failed (${status})`, { status })
}

export const fetchApiJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(await apiErrorMessage(payload, response.status))
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

/** `未找到登录凭证`（四语键 `auth.err.NO_CREDENTIAL`）；i18n 不可用时回落到 ASCII 串（绝不空白）。 */
const noCredentialError = async () => new Error(
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
