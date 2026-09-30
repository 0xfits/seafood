import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAuthSession,
  fetchApiJson,
  getAuthHeaders,
  getAuthToken,
  getStoredUser,
  hasCompletedProfile,
  mergeAuthSession,
  saveAuthSession,
} from '../../auth'

describe('auth helpers', () => {
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

  it('normalizes and stores wallet auth sessions', () => {
    const session = saveAuthSession({
      uID: 7,
      EVM: '0x1234567890123456789012345678901234567890',
      access_token: 'jwt-token',
      bio: 'wallet profile ready',
    })

    expect(session.token).toBe('jwt-token')
    expect(getAuthToken()).toBe('jwt-token')
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer jwt-token' })
    expect(getStoredUser()).toMatchObject({
      uID: 7,
      access_token: 'jwt-token',
      token: 'jwt-token',
      bio: 'wallet profile ready',
    })
    expect(hasCompletedProfile()).toBe(true)
  })

  it('merges profile updates without dropping the auth token', () => {
    saveAuthSession({
      uID: 11,
      EVM: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      token: 'session-token',
      bio: '',
    })

    const merged = mergeAuthSession({ bio: 'new bio content' })

    expect(merged.token).toBe('session-token')
    expect(merged.bio).toBe('new bio content')
    expect(getStoredUser().bio).toBe('new bio content')
  })

  it('throws the server message when API responses are unsuccessful (legacy `sendError` shape)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({ success: false, message: 'deprecated endpoint' }),
    })

    await expect(fetchApiJson('/api/auth/register')).rejects.toThrow('deprecated endpoint')
  })

  // P4-B4b-i · §2.4 **S2**（`R107` 的 401/403 形状）+ §9.B **B2**：新面一律 `R107`
  // `{ error: { code, message, i18n_key, details } }`（**顶层无 `message` / 无 `success`**）⇒
  // 旧写法 `payload?.message || payload?.error` 会把 `error`（对象）当消息 ⇒ `[object Object]`。
  it('reads the R107 error object and never degrades to `[object Object]` (401)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'AUTH_UNAUTHORIZED',
          message: 'Authentication is required',
          i18n_key: 'auth.err.AUTH_UNAUTHORIZED',
          details: { reason: 'NO_TOKEN' },
        },
      }),
    })

    const error = await fetchApiJson('/api/user').catch((err) => err)

    expect(error).toBeInstanceOf(Error)
    expect(typeof error.message).toBe('string')
    expect(error.message.length).toBeGreaterThan(0)
    expect(error.message).not.toContain('[object Object]')
  })

  it('surfaces the R107 `details.reason` and the message for the deprecated 410 face (S6)', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({
        error: {
          code: 'LEDGER_REF_NOT_FOUND',
          message: 'endpoint deprecated: /api/auth/register',
          i18n_key: 'ledger.err.LEDGER_REF_NOT_FOUND',
          details: {
            ref_type: 'endpoint',
            ref_id: '/api/auth/register',
            http_status: 410,
            sunset: '批 4 删路径',
          },
        },
      }),
    })

    await expect(fetchApiJson('/api/auth/register'))
      .rejects.toThrow('endpoint deprecated: /api/auth/register')
  })

  it('clears stored auth session data', () => {
    saveAuthSession({
      uID: 3,
      EVM: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      token: 'clear-me',
    })

    clearAuthSession()

    expect(getStoredUser()).toBeNull()
    expect(getAuthToken()).toBe('')
  })
})
