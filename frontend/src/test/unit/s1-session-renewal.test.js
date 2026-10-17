import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_CHANGE_EVENT,
  fetchApiJson,
  getAuthToken,
  getStoredUser,
  jwtExpirySeconds,
  replaceAuthToken,
  saveAuthSession,
} from '../../auth'

// ============================================================================
// S1 续 · 滑动续期前端接线（2026-10-17 · 只动 `fetchApiJson` 成功分支）
//
// 后端契约（已上线）：鉴权成功 ∧ 距 `iat` ≥ 1h ∧ 未到绝对上限 ⇒ 响应头
// `X-Session-Token: <新 JWT>`（CORS 侧已 `exposedHeaders`）。
// 本文件锁定前端这一环：
//   ① 成功响应带头 ⇒ 存储里的 token 被换成新的（`access_token` / legacy 键同步、
//     `AUTH_CHANGE_EVENT` 恰好一次、返回值仍是 `payload.data`）；
//   ② 不带头 ⇒ 存储一字不动；
//   ③ 头为空串 / 全空白 / 非字符串 ⇒ 不写、不抛；
//   ④ 新 token `exp` **比现有更早** ⇒ 不覆盖（多标签并发竞态保护）；
//   ⑤ 401 响应即使（异常地）带头 ⇒ 除清会话外**不**做 token 替换，且该头**不被读取**；
//   ⑥ 附加：403 不读该头（只 401/成功两态才有语义）；现有 token 非 JWT ⇒ 新 token 优先写。
//
// 存储面：沿用 `s1-session-expiry.test.js` 的体例 —— `test/setup.js` 的 localStorage 是
// `vi.fn()` 壳，逐例装回真实行为，不依赖 jsdom 真存储。
// ============================================================================

const b64url = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

/** 造一枚三段式 JWT（签名段是假串 —— 前端只解 payload、不验签）。 */
const makeJwt = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fake-signature`

const NOW_SECONDS = () => Math.floor(Date.now() / 1000)

/**
 * 假响应：`headers.get` 是 **vi.fn**（可断言「该头有没有被读过」），键名大小写不敏感。
 * 不带 `headers` 参数时**不挂** `headers` 字段 —— 用来覆盖「响应对象无 headers」的旧 mock 形态。
 */
const makeResponse = (status, body, headers = undefined) => {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
  if (headers) {
    const lowered = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    )
    response.headers = { get: vi.fn((name) => lowered[String(name).toLowerCase()] ?? null) }
  }
  return response
}

const okBody = (data = { uID: 51 }) => ({ success: true, data })
const RENEWAL_HEADER = 'X-Session-Token'

describe('S1 续 · fetchApiJson 读取 X-Session-Token（滑动续期）', () => {
  let storage
  let changes

  const onChange = () => changes.push(1)

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

    changes = []
    window.addEventListener(AUTH_CHANGE_EVENT, onChange)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange)
    vi.restoreAllMocks()
  })

  it('① 成功响应带 X-Session-Token ⇒ 存储 token 换新（token / access_token / legacy 同步、事件恰好一次）', async () => {
    const oldToken = makeJwt({ sub: 'u51', iat: NOW_SECONDS(), exp: NOW_SECONDS() + 600 })
    saveAuthSession({ uID: 51, token: oldToken })
    changes.length = 0

    const renewedToken = makeJwt({ sub: 'u51', iat: NOW_SECONDS(), exp: NOW_SECONDS() + 84600 })
    const response = makeResponse(200, okBody({ uID: 51, nickname: 'kevin' }), {
      [RENEWAL_HEADER]: renewedToken,
    })
    global.fetch = vi.fn().mockResolvedValue(response)

    const data = await fetchApiJson('/api/user', { headers: { Authorization: `Bearer ${oldToken}` } })

    // 返回值语义不变：仍是 payload.data
    expect(data).toEqual({ uID: 51, nickname: 'kevin' })
    // 头被读过一次（接线确实发生，而不是「碰巧存储里就有新值」）
    expect(response.headers.get).toHaveBeenCalled()
    // 三处存储同步换新
    expect(JSON.parse(storage.user)).toMatchObject({
      uID: 51,
      token: renewedToken,
      access_token: renewedToken,
    })
    expect(storage.token).toBe(renewedToken)
    expect(getAuthToken()).toBe(renewedToken)
    expect(getStoredUser()).toMatchObject({ uID: 51, token: renewedToken })
    // 换上去的确实是「更晚过期」的那枚（续期语义核心）
    expect(jwtExpirySeconds(getAuthToken())).toBe(jwtExpirySeconds(renewedToken))
    expect(jwtExpirySeconds(getAuthToken())).toBeGreaterThan(jwtExpirySeconds(oldToken))
    // 只派发一次 AUTH_CHANGE_EVENT（多派发会让 AuthProvider 反复重读）
    expect(changes).toHaveLength(1)
  })

  it('② 成功响应不带头 ⇒ 存储一字不动、不派发事件', async () => {
    const oldToken = makeJwt({ sub: 'u52', exp: NOW_SECONDS() + 600 })
    saveAuthSession({ uID: 52, token: oldToken })
    const before = { ...storage }
    changes.length = 0

    const response = makeResponse(200, okBody({ uID: 52 }), {})
    global.fetch = vi.fn().mockResolvedValue(response)

    await fetchApiJson('/api/user')

    expect(response.headers.get(RENEWAL_HEADER)).toBeNull()
    expect(storage).toEqual(before)
    expect(getAuthToken()).toBe(oldToken)
    expect(changes).toHaveLength(0)
  })

  it('②b 响应对象连 headers 都没有（旧 mock 形态）⇒ 不抛、存储不变', async () => {
    const oldToken = makeJwt({ sub: 'u53', exp: NOW_SECONDS() + 600 })
    saveAuthSession({ uID: 53, token: oldToken })
    const before = { ...storage }
    changes.length = 0

    global.fetch = vi.fn().mockResolvedValue(makeResponse(200, okBody({ uID: 53 })))

    await expect(fetchApiJson('/api/user')).resolves.toEqual({ uID: 53 })
    expect(storage).toEqual(before)
    expect(changes).toHaveLength(0)
  })

  it('③ 头是空串 / 全空白 / 非字符串 ⇒ 不写、不抛', async () => {
    const oldToken = makeJwt({ sub: 'u54', exp: NOW_SECONDS() + 600 })
    saveAuthSession({ uID: 54, token: oldToken })
    const before = { ...storage }
    changes.length = 0

    const variants = ['', '   ', '\t\n ', 12345, true, {}]
    for (const value of variants) {
      global.fetch = vi.fn().mockResolvedValue(
        makeResponse(200, okBody({ uID: 54 }), { [RENEWAL_HEADER]: value }),
      )
      // 不抛
      await expect(fetchApiJson('/api/user')).resolves.toEqual({ uID: 54 })
      expect(storage).toEqual(before)
      expect(getAuthToken()).toBe(oldToken)
    }
    expect(changes).toHaveLength(0)
  })

  it('④ 新 token exp 比现有更早 ⇒ 不覆盖（多标签并发竞态保护）', async () => {
    const fresherToken = makeJwt({ sub: 'u55', exp: NOW_SECONDS() + 84600 })
    saveAuthSession({ uID: 55, token: fresherToken })
    const before = { ...storage }
    changes.length = 0

    // 另一个标签页先拿到的新票「更早过期」（真实成因：两发续期响应乱序返回）
    const stalerToken = makeJwt({ sub: 'u55', exp: NOW_SECONDS() + 3600 })
    expect(jwtExpirySeconds(stalerToken)).toBeLessThan(jwtExpirySeconds(fresherToken))

    global.fetch = vi.fn().mockResolvedValue(
      makeResponse(200, okBody({ uID: 55 }), { [RENEWAL_HEADER]: stalerToken }),
    )

    await fetchApiJson('/api/user')

    expect(storage).toEqual(before)
    expect(getAuthToken()).toBe(fresherToken)
    expect(changes).toHaveLength(0)
    // 直接调入口同样不覆盖（判据只有一处，不在 fetch 层重复实现）
    expect(replaceAuthToken(stalerToken)).toBeNull()
    expect(getAuthToken()).toBe(fresherToken)
  })

  it('④b exp 相同 ⇒ 不覆盖（幂等：不重复派发事件）', async () => {
    const token = makeJwt({ sub: 'u56', exp: NOW_SECONDS() + 600 })
    saveAuthSession({ uID: 56, token })
    const before = { ...storage }
    changes.length = 0

    global.fetch = vi.fn().mockResolvedValue(
      makeResponse(200, okBody({ uID: 56 }), { [RENEWAL_HEADER]: token }),
    )

    await fetchApiJson('/api/user')

    expect(storage).toEqual(before)
    expect(changes).toHaveLength(0)
  })

  it('④c 现有 token 解不出 exp（非 JWT 存量会话）⇒ 新 token 优先写入', async () => {
    saveAuthSession({ uID: 57, token: 'legacy-token' })
    expect(jwtExpirySeconds('legacy-token')).toBeNull()
    changes.length = 0

    const renewedToken = makeJwt({ sub: 'u57', exp: NOW_SECONDS() + 84600 })
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse(200, okBody({ uID: 57 }), { [RENEWAL_HEADER]: renewedToken }),
    )

    await fetchApiJson('/api/user')

    expect(getAuthToken()).toBe(renewedToken)
    expect(storage.token).toBe(renewedToken)
    expect(changes).toHaveLength(1)
  })

  it('⑤ 401（异常地带了该头）⇒ 会话照旧被清，但**不**做 token 替换，且该头不被读取', async () => {
    saveAuthSession({ uID: 58, token: makeJwt({ sub: 'u58', exp: NOW_SECONDS() + 600 }) })

    const renewedToken = makeJwt({ sub: 'u58', exp: NOW_SECONDS() + 84600 })
    const response = makeResponse(401, {
      success: false,
      error: { code: 'AUTH_UNAUTHORIZED', message: 'AUTH_UNAUTHORIZED', i18n_key: 'auth.err.AUTH_UNAUTHORIZED' },
    }, { [RENEWAL_HEADER]: renewedToken })
    global.fetch = vi.fn().mockResolvedValue(response)

    const error = await fetchApiJson('/api/user').catch((err) => err)

    // 既有 401 语义不变
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(401)
    expect(error.code).toBe('AUTH_UNAUTHORIZED')
    // 会话被清、绝无 token 被「续」回去
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(getAuthToken()).toBe('')
    // 失败分支根本不读这个头
    expect(response.headers.get).not.toHaveBeenCalled()
  })

  it('⑥ 403（带头）⇒ 不读该头、会话与 token 原封不动', async () => {
    const token = makeJwt({ sub: 'u59', exp: NOW_SECONDS() + 600 })
    saveAuthSession({ uID: 59, token })
    const before = { ...storage }
    changes.length = 0

    const response = makeResponse(403, {
      success: false,
      error: { code: 'AUTH_FORBIDDEN', message: 'AUTH_FORBIDDEN', i18n_key: 'auth.err.AUTH_FORBIDDEN' },
    }, { [RENEWAL_HEADER]: makeJwt({ sub: 'u59', exp: NOW_SECONDS() + 84600 }) })
    global.fetch = vi.fn().mockResolvedValue(response)

    const error = await fetchApiJson('/api/admin/me').catch((err) => err)

    expect(error.status).toBe(403)
    expect(response.headers.get).not.toHaveBeenCalled()
    expect(storage).toEqual(before)
    expect(changes).toHaveLength(0)
  })

  it('⑦ 未登录（无 user 快照）时响应带头 ⇒ 不凭空造会话', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse(200, { success: true, data: { ok: true } }, {
        [RENEWAL_HEADER]: makeJwt({ sub: 'u60', exp: NOW_SECONDS() + 84600 }),
      }),
    )

    await expect(fetchApiJson('/api/home')).resolves.toEqual({ ok: true })
    expect(storage).toEqual({})
    expect(getAuthToken()).toBe('')
    expect(changes).toHaveLength(0)
  })
})
