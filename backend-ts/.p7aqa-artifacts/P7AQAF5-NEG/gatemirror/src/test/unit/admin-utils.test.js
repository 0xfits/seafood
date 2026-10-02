import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(),
  getAuthToken: vi.fn(),
  getStoredUser: vi.fn(),
}))

import { fetchApiJson, getAuthHeaders } from '../../auth'
import { fetchAdminAccess, hasAdminPermission } from '../../admin-utils'

describe('admin-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts any matching permission from an allowed permission array', () => {
    expect(
      hasAdminPermission(
        { is_admin: false, permissions: ['publish_prizes'], can_access_admin: true },
        ['manage_rewards', 'publish_prizes'],
      ),
    ).toBe(true)

    expect(
      hasAdminPermission(
        { is_admin: false, permissions: ['review_tasks'], can_access_admin: true },
        ['manage_rewards', 'publish_prizes'],
      ),
    ).toBe(false)
  })

  it('returns published capabilities when admin fallback is used', async () => {
    const currentUser = {
      EVM: '0x59f9f640d15ebb053c94a816232cf8ce91b209b0',
    }

    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer fallback-token' })
    fetchApiJson.mockRejectedValue(new Error('network down'))

    const access = await fetchAdminAccess(currentUser)

    expect(fetchApiJson).toHaveBeenCalledWith('/api/admin/me', {
      headers: { Authorization: 'Bearer fallback-token' },
    })
    expect(access.is_admin).toBe(true)
    expect(access.permissions).toEqual(
      expect.arrayContaining(['publish_tasks', 'publish_prizes', 'manage_tasks', 'manage_rewards']),
    )
    expect(access.preferred_admin_path).toBe('/dashboard')
  })

  it('returns the API-provided access payload when available', async () => {
    const currentUser = {
      uID: 12,
      EVM: '0x1234567890123456789012345678901234567890',
    }

    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer api-token' })
    fetchApiJson.mockResolvedValue({
      is_admin: false,
      permissions: ['publish_tasks'],
      can_access_admin: true,
      preferred_admin_path: '/dashboard/tasks',
    })

    await expect(fetchAdminAccess(currentUser)).resolves.toEqual({
      is_admin: false,
      permissions: ['publish_tasks'],
      can_access_admin: true,
      preferred_admin_path: '/dashboard/tasks',
    })
  })
})
