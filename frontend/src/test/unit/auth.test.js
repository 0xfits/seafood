import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiErrorMessage,
  clearAuthSession,
  fetchApiJson,
  getAuthHeaders,
  getAuthToken,
  getStoredUser,
  hasCompletedProfile,
  i18nKeyForServerMessage,
  mergeAuthSession,
  saveAuthSession,
  SERVER_MESSAGE_I18N_KEYS,
} from '../../auth'
import i18n from '../../i18n'

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

    // ★ 批 7-D **期望订正**（原断言 = `.rejects.toThrow('endpoint deprecated: /api/auth/register')`）：
    //   `ledger.err.LEDGER_REF_NOT_FOUND` 四语键补齐后 ⇒ 链上 ① `t(i18n_key)` **命中** ⇒
    //   用户看到的是**本地化文案**（`resolveI18nMessage` 的「护栏让位」语义），不再是服务端英文原文。
    await expect(fetchApiJson('/api/auth/register'))
      .rejects.toThrow('关联单据不存在。')
  })

  it('S6 回归锚（订正后）：**未登记** `i18n_key` + 真人可读 message ⇒ 保留服务端原文（② 通路不回归）', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({
        error: {
          code: 'LEDGER_REF_NOT_FOUND',
          message: 'endpoint deprecated: /api/auth/register',
          i18n_key: 'ledger.err.LEDGER_LEGACY_UNREGISTERED_ANCHOR',
          details: { ref_type: 'endpoint', ref_id: '/api/auth/register', http_status: 410 },
        },
      }),
    })

    await expect(fetchApiJson('/api/auth/register'))
      .rejects.toThrow('endpoint deprecated: /api/auth/register')
  })

  // ---- P4-B4c-ii-c ①（§9.B **B14** / §7-48）：两条登录 401 文案的**四语**覆盖 ---------------
  // 真源 = `backend-ts/src/auth.ts:223` / `:227`；出口 = `backend-ts/src/index.ts:379` `sendError(401, message)`
  // ⇒ 形状 `{ success:false, message, error:<同一字符串> }`（**无 code、无 i18n_key**）⇒ 只能按**原文**映射。
  it('B14 ①：`Invalid wallet signature`（sendError 形状）⇒ 映射为四语文案，绝不把英文原文丢给用户', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ success: false, message: 'Invalid wallet signature', error: 'Invalid wallet signature' }),
    })

    const error = await fetchApiJson('/api/auth/verify').catch((err) => err)

    expect(SERVER_MESSAGE_I18N_KEYS['Invalid wallet signature']).toBe('auth.err.INVALID_WALLET_SIGNATURE')
    expect(i18nKeyForServerMessage('Invalid wallet signature')).toBe('auth.err.INVALID_WALLET_SIGNATURE')
    expect(error.message).not.toBe('Invalid wallet signature')
    expect(error.message).toBe(i18n.t('auth.err.INVALID_WALLET_SIGNATURE'))
    expect(error.message.trim().length).toBeGreaterThan(0)
    expect(error.message).not.toContain('[object Object]')
  })

  it('B14 ②：`Signature does not match the claimed address`（对象面 message）⇒ 第二条映射', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'AUTH_UNAUTHORIZED', message: 'Signature does not match the claimed address' } }),
    })

    const error = await fetchApiJson('/api/auth/verify').catch((err) => err)

    expect(i18nKeyForServerMessage('Signature does not match the claimed address')).toBe('auth.err.SIGNATURE_ADDRESS_MISMATCH')
    expect(error.message).not.toBe('Signature does not match the claimed address')
    expect(error.message).toBe(i18n.t('auth.err.SIGNATURE_ADDRESS_MISMATCH'))
    expect(error.message).not.toContain('[object Object]')
  })

  it('B14 ③：未登记的未知错误 ⇒ 保留服务端文案（映射不到不得空白）', async () => {
    const message = await apiErrorMessage({ success: false, message: 'database is unreachable' }, 503)

    expect(i18nKeyForServerMessage('database is unreachable')).toBeUndefined()
    expect(i18nKeyForServerMessage(undefined)).toBeUndefined()
    expect(message).toBe('database is unreachable')
  })

  it('B14 ④：连文案都没有的错误体 ⇒ 通用兜底 `请求失败 (status)`（不得空白 / 不得 [object Object]）', async () => {
    const message = await apiErrorMessage(null, 500)

    expect(message).toBe('请求失败 (500)')
    expect(message.trim().length).toBeGreaterThan(0)
    expect(message).not.toContain('[object Object]')
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
