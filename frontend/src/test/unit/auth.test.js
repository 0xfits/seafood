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

  it('throws the server message when API responses are unsuccessful', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({ success: false, message: 'deprecated endpoint' }),
    })

    await expect(fetchApiJson('/api/auth/register')).rejects.toThrow('deprecated endpoint')
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
