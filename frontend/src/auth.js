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

const extractApiErrorMessage = (payload, status) => {
  const error = payload?.error
  if (error && typeof error === 'object') {
    const reason = error.details && typeof error.details === 'object' ? error.details.reason : undefined
    const base = error.message || error.code || ''
    if (base) return reason ? `${base} (${reason})` : base
  }
  if (typeof error === 'string' && error) return error
  if (payload?.message) return payload.message
  return `请求失败 (${status})`
}

// `i18n_key`（`R107` 契约键）→ 四语文案。**动态导入**：只在错误路径求值，
// 不把 `i18n.js` 拖进 `auth.js` 的静态依赖图（既有单测对 `react-i18next` 做 mock，静态导入会连带崩）。
const resolveI18nMessage = async (apiError, fallback) => {
  const i18nKey = apiError && typeof apiError === 'object' ? apiError.i18n_key : undefined
  if (!i18nKey) return fallback
  try {
    const { default: i18n } = await import('./i18n')
    if (i18n?.exists?.(i18nKey)) {
      const translated = i18n.t(i18nKey)
      if (translated && translated !== i18nKey) return translated
    }
    return fallback
  } catch {
    // i18n 不可用 ⇒ 保底回落到服务端 `message`（绝不回落到 `[object Object]`）
    return fallback
  }
}

/** 错误文案总入口（可单测）：`R107` 对象面 / 旧字符串面 / 裸状态码三态均能给出**字符串**。 */
export const apiErrorMessage = async (payload, status) => (
  resolveI18nMessage(payload?.error, extractApiErrorMessage(payload, status))
)

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

export const fetchCurrentUser = async (user = undefined) => {
  const token = getAuthToken(user)
  if (!token) {
    throw new Error('未找到登录凭证')
  }

  return fetchApiJson('/api/user', {
    headers: getAuthHeaders(user),
  })
}

export const updateMyProfile = async (payload, user = undefined) => {
  const token = getAuthToken(user)
  if (!token) {
    throw new Error('未找到登录凭证')
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
