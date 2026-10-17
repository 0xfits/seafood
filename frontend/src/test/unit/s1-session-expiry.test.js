import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_CHANGE_EVENT,
  SESSION_EXPIRED_EVENT,
  expireAuthSession,
  fetchApiJson,
  getAuthToken,
  getStoredUser,
  isAuthenticatedUser,
  isProtectedRouteActive,
  isTokenExpired,
  isUnauthorizedError,
  isUnauthorizedResponse,
  jwtExpirySeconds,
  markProtectedRouteActive,
  replaceAuthToken,
  saveAuthSession,
} from '../../auth'

// ============================================================================
// S1 · 会话过期治理（2026-10-17）· 单测
//
// 锁定六条行为（对应派单 AC6）：
//   ① `401 + AUTH_UNAUTHORIZED` ⇒ 会话被清（存储两键都空）；
//   ② `503` ⇒ 不清；③ `403` ⇒ 不清（含「403 却带 AUTH_UNAUTHORIZED 机读码」的强形态）；
//   ④ `exp` 已过 ⇒ `isAuthenticatedUser=false` 且存储被清；
//   ⑤ `exp` 未过 / 无 `exp` / 非 JWT / 解析坏 ⇒ **true**（绝不因解析问题误踢用户）；
//   ⑥ 并发多个 401 只提示一次（`SESSION_EXPIRED_EVENT` 计数 = 1）。
//
// 存储面：`test/setup.js` 把 `localStorage` 换成了 `vi.fn()` 壳 ⇒ 本文件按既有体例
// （`test/unit/auth.test.js`）逐例装回真实行为，不依赖 jsdom 真存储。
// ============================================================================

const b64url = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

/** 造一枚「三段式」JWT（签名段是假串 —— 前端只解 payload，不验签）。 */
const makeJwt = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fake-signature`

const NOW_SECONDS = () => Math.floor(Date.now() / 1000)

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const unauthorizedBody = {
  success: false,
  error: {
    code: 'AUTH_UNAUTHORIZED',
    message: 'AUTH_UNAUTHORIZED',
    i18n_key: 'auth.err.AUTH_UNAUTHORIZED',
  },
}

describe('S1 · 全局 401 治理（fetchApiJson 单点）', () => {
  let storage

  beforeEach(() => {
    storage = {}

    localStorage.getItem.mockImplementation((key) => storage[key] ?? null)
    localStorage.setItem.mockImplementation((key, value) => {
      storage[key] = value
    })
    localStorage.removeItem.mockImplementation((key) => {
      delete storage[key]
    })
    localStorage.clear.mockImplementation(() => {
      storage = {}
    })

    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① 401 + AUTH_UNAUTHORIZED ⇒ 会话被清（user / token 两键都空）+ 机读面透出 status', async () => {
    saveAuthSession({ uID: 21, token: makeJwt({ sub: 'u21', exp: NOW_SECONDS() + 600 }) })
    expect(getAuthToken()).toBeTruthy()

    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, unauthorizedBody))

    const error = await fetchApiJson('/api/user').catch((err) => err)

    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(401)
    expect(error.code).toBe('AUTH_UNAUTHORIZED')
    // 会话确实被清：两个存储键都不见了
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(getAuthToken()).toBe('')
    expect(getStoredUser()).toBeNull()
    expect(isAuthenticatedUser()).toBe(false)
  })

  it('② 503（后端暂时不可用）⇒ 绝不清会话', async () => {
    saveAuthSession({ uID: 22, token: makeJwt({ sub: 'u22', exp: NOW_SECONDS() + 600 }) })

    global.fetch = vi.fn().mockResolvedValue(jsonResponse(503, {
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: '数据库暂时不可用', i18n_key: 'common.err.SERVICE_UNAVAILABLE' },
    }))

    const error = await fetchApiJson('/api/user').catch((err) => err)

    expect(error.status).toBe(503)
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(isUnauthorizedError(error)).toBe(false)
    // 会话原封不动
    expect(getStoredUser()).toMatchObject({ uID: 22 })
    expect(getAuthToken()).toBeTruthy()
  })

  it('③ 403（权限不足）⇒ 绝不清会话', async () => {
    saveAuthSession({ uID: 23, token: makeJwt({ sub: 'u23', exp: NOW_SECONDS() + 600 }) })

    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, {
      success: false,
      error: { code: 'AUTH_FORBIDDEN', message: 'AUTH_FORBIDDEN', i18n_key: 'auth.err.AUTH_FORBIDDEN' },
    }))

    const error = await fetchApiJson('/api/admin/me').catch((err) => err)

    expect(error.status).toBe(403)
    expect(isUnauthorizedError(error)).toBe(false)
    expect(getStoredUser()).toMatchObject({ uID: 23 })
    expect(getAuthToken()).toBeTruthy()
  })

  it('③b 403 却带 `AUTH_UNAUTHORIZED` 机读码 ⇒ 仍不清（清会话只认 401 状态码）', async () => {
    saveAuthSession({ uID: 24, token: makeJwt({ sub: 'u24', exp: NOW_SECONDS() + 600 }) })

    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, unauthorizedBody))

    const error = await fetchApiJson('/api/admin/me').catch((err) => err)

    expect(error.status).toBe(403)
    expect(isUnauthorizedError(error)).toBe(false)
    expect(getAuthToken()).toBeTruthy()
    expect(getStoredUser()).toMatchObject({ uID: 24 })
  })

  it('⑥ 并发两个 401 ⇒ 只清一次会话、只提示一次（SESSION_EXPIRED_EVENT 计数 = 1）', async () => {
    saveAuthSession({ uID: 25, token: makeJwt({ sub: 'u25', exp: NOW_SECONDS() + 600 }) })

    const notices = []
    const onExpired = () => notices.push(Date.now())
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)

    global.fetch = vi.fn().mockImplementation(async () => jsonResponse(401, unauthorizedBody))

    // 同一 tick 内两个请求同时吃 401（真实场景：页面并发读口）
    await Promise.all([
      fetchApiJson('/api/user').catch((err) => err),
      fetchApiJson('/api/user/asset/25').catch((err) => err),
      fetchApiJson('/api/batt').catch((err) => err),
    ])

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)

    expect(notices).toHaveLength(1)
    expect(getAuthToken()).toBe('')
  })

  it('无会话时吃 401 ⇒ 清会话不报错、且**不**发过期提示（游客态不吃这条 toast）', async () => {
    const notices = []
    const onExpired = () => notices.push(1)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)

    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, unauthorizedBody))
    await fetchApiJson('/api/user').catch((err) => err)

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)

    expect(notices).toHaveLength(0)
  })

  it('401 但机读码不是 AUTH_UNAUTHORIZED ⇒ 不清会话（判据只认那一对）', async () => {
    saveAuthSession({ uID: 26, token: makeJwt({ sub: 'u26', exp: NOW_SECONDS() + 600 }) })

    const payload = {
      success: false,
      error: { code: 'AUTH_CHALLENGE_EXPIRED', message: 'challenge expired', i18n_key: 'auth.err.AUTH_CHALLENGE_EXPIRED' },
    }
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, payload))

    await fetchApiJson('/api/auth/verify').catch((err) => err)

    expect(isUnauthorizedResponse(payload, 401)).toBe(false)
    expect(getAuthToken()).toBeTruthy()
    expect(getStoredUser()).toMatchObject({ uID: 26 })
  })
})

describe('S1 · exp 本地预判（AC3）', () => {
  let storage

  beforeEach(() => {
    storage = {}
    localStorage.getItem.mockImplementation((key) => storage[key] ?? null)
    localStorage.setItem.mockImplementation((key, value) => {
      storage[key] = value
    })
    localStorage.removeItem.mockImplementation((key) => {
      delete storage[key]
    })
    localStorage.clear.mockImplementation(() => {
      storage = {}
    })
  })

  it('④ exp 已过 ⇒ isAuthenticated=false，且存储被清（user / token 都空）', () => {
    saveAuthSession({ uID: 31, token: makeJwt({ sub: 'u31', exp: NOW_SECONDS() - 60 }) })

    expect(isAuthenticatedUser()).toBe(false)
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(getStoredUser()).toBeNull()
  })

  it('④b 过期 token 直接写进存储（未经 saveAuthSession）⇒ getStoredUser 也当游客并清存储', () => {
    storage.user = JSON.stringify({ uID: 32, token: makeJwt({ sub: 'u32', exp: NOW_SECONDS() - 1 }) })
    storage.token = JSON.parse(storage.user).token

    expect(getStoredUser()).toBeNull()
    expect(storage.user).toBeUndefined()
    expect(storage.token).toBeUndefined()
  })

  it('⑤ exp 未过 ⇒ true（且不清存储）', () => {
    saveAuthSession({ uID: 33, token: makeJwt({ sub: 'u33', exp: NOW_SECONDS() + 3600 }) })

    expect(isAuthenticatedUser()).toBe(true)
    expect(isTokenExpired(makeJwt({ exp: NOW_SECONDS() + 3600 }))).toBe(false)
    expect(getStoredUser()).toMatchObject({ uID: 33 })
  })

  it('⑤b 无 exp / 非 JWT 形态 / payload 坏 ⇒ 一律视为有效（绝不误踢）', () => {
    // 无 exp
    saveAuthSession({ uID: 34, token: makeJwt({ sub: 'u34' }) })
    expect(isAuthenticatedUser()).toBe(true)
    expect(isTokenExpired(makeJwt({ sub: 'u34' }))).toBe(false)

    // 非 JWT（既有单测里普遍用的 'jwt-token' 形态）
    saveAuthSession({ uID: 35, token: 'jwt-token' })
    expect(isAuthenticatedUser()).toBe(true)
    expect(isTokenExpired('jwt-token')).toBe(false)

    // 三段但 payload 不是 base64/JSON
    expect(isTokenExpired('aaa.!!!.ccc')).toBe(false)
    expect(jwtExpirySeconds('aaa.!!!.ccc')).toBeNull()
    expect(jwtExpirySeconds('')).toBeNull()
    expect(jwtExpirySeconds(undefined)).toBeNull()
    expect(jwtExpirySeconds('only.two')).toBeNull()
  })

  it('base64url 变体（`-` / `_` / 百分号编码的补位）都能解出 exp', () => {
    // payload 里带 `?`/`~` ⇒ 标准 base64 必出 `+` 或 `/` ⇒ base64url 形态就是 `-` / `_`
    const trickyPayload = { sub: 'u36', exp: NOW_SECONDS() + 600, note: '??~~' }
    const trickySegment = b64url(trickyPayload)
    const standardBase64 = Buffer.from(JSON.stringify(trickyPayload), 'utf8').toString('base64')
    expect(/[+/]/.test(standardBase64)).toBe(true)
    expect(/[-_]/.test(trickySegment)).toBe(true)
    expect(jwtExpirySeconds(`h.${trickySegment}.s`)).toBe(trickyPayload.exp)

    // 百分号编码形态（补位 `=` 被 URL-encode 成 `%3D`）
    const plainBase64 = Buffer.from('{"exp":4102444800}', 'utf8').toString('base64')
    const withPadding = plainBase64.endsWith('=') ? plainBase64 : `${plainBase64}==`
    const encodedSegment = withPadding.replace(/=/g, '%3D')
    expect(encodedSegment).toContain('%3D')
    expect(jwtExpirySeconds(`h.${encodedSegment}.s`)).toBe(4102444800)
  })

  it('expireAuthSession 返回「是否真清掉了会话」（并发一次性提示的机制自证）', () => {
    saveAuthSession({ uID: 37, token: makeJwt({ sub: 'u37', exp: NOW_SECONDS() + 600 }) })
    expect(expireAuthSession()).toBe(true)
    expect(expireAuthSession()).toBe(false)
  })
})

describe('S1 · replaceAuthToken（写入新 token 的单一入口 · 本轮只暴露不接线）', () => {
  let storage

  beforeEach(() => {
    storage = {}
    localStorage.getItem.mockImplementation((key) => storage[key] ?? null)
    localStorage.setItem.mockImplementation((key, value) => {
      storage[key] = value
    })
    localStorage.removeItem.mockImplementation((key) => {
      delete storage[key]
    })
    localStorage.clear.mockImplementation(() => {
      storage = {}
    })
  })

  it('写入 token / access_token 两键 + 同步 legacy 键 + 派发 AUTH_CHANGE_EVENT', () => {
    saveAuthSession({ uID: 41, token: makeJwt({ sub: 'u41', exp: NOW_SECONDS() + 60 }) })

    const changes = []
    const onChange = () => changes.push(1)
    window.addEventListener(AUTH_CHANGE_EVENT, onChange)

    const nextToken = makeJwt({ sub: 'u41', exp: NOW_SECONDS() + 7200 })
    const saved = replaceAuthToken(nextToken)

    window.removeEventListener(AUTH_CHANGE_EVENT, onChange)

    expect(saved).toMatchObject({ uID: 41, token: nextToken, access_token: nextToken })
    expect(changes).toHaveLength(1)
    expect(JSON.parse(storage.user)).toMatchObject({ uID: 41, token: nextToken, access_token: nextToken })
    expect(storage.token).toBe(nextToken)
    expect(getAuthToken()).toBe(nextToken)
  })

  it('旧 token 已过期 ⇒ 仍能写进去（滑动续期场景；读原始快照而非 getStoredUser）', () => {
    const expiredToken = makeJwt({ sub: 'u42', exp: NOW_SECONDS() - 30 })
    storage.user = JSON.stringify({ uID: 42, token: expiredToken, access_token: expiredToken })
    storage.token = expiredToken

    const nextToken = makeJwt({ sub: 'u42', exp: NOW_SECONDS() + 1800 })
    expect(replaceAuthToken(nextToken)).toMatchObject({ uID: 42, token: nextToken })
    expect(isAuthenticatedUser()).toBe(true)
  })

  it('无 user 快照 / newToken 为空或非字符串 ⇒ 不动存储、返回 null', () => {
    expect(replaceAuthToken('any-token')).toBeNull()
    expect(storage).toEqual({})

    saveAuthSession({ uID: 43, token: 'jwt-token' })
    const before = { ...storage }

    expect(replaceAuthToken('')).toBeNull()
    expect(replaceAuthToken('   ')).toBeNull()
    expect(replaceAuthToken(null)).toBeNull()
    expect(replaceAuthToken(undefined)).toBeNull()
    expect(replaceAuthToken(12345)).toBeNull()

    expect(storage).toEqual(before)
    expect(getAuthToken()).toBe('jwt-token')
  })
})

describe('S1 · 受保护路由登记位（AC2 判据来源）', () => {
  it('挂载 +1 / 注销 -1，计数不会变负', () => {
    expect(isProtectedRouteActive()).toBe(false)

    const releaseRoute = markProtectedRouteActive()
    expect(isProtectedRouteActive()).toBe(true)

    releaseRoute()
    expect(isProtectedRouteActive()).toBe(false)

    // 多注销一次不得把计数拖成负数（否则后续判定会恒 false）
    releaseRoute()
    expect(isProtectedRouteActive()).toBe(false)
  })
})
