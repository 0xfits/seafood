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

export const fetchApiJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    const message = payload?.message || payload?.error || `请求失败 (${response.status})`
    throw new Error(message)
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
