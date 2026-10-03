import { fetchApiJson, getAuthHeaders, getAuthToken, getStoredUser } from './auth'

const ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'

export { fetchApiJson, getAuthHeaders, getAuthToken, getStoredUser }

export const isAdminUser = (user) => {
  const evm = user?.EVM?.toLowerCase()
  return Boolean(
    user?.is_admin === true ||
    user?.role === 'admin' ||
    (evm && evm === ADMIN_ADDRESS)
  )
}

export const fetchAdminAccess = async (currentUser = getStoredUser()) => {
  if (!currentUser) {
    return {
      is_admin: false,
      permissions: [],
      can_access_admin: false,
      preferred_admin_path: '/',
    }
  }

  try {
    const data = await fetchApiJson('/api/admin/me', {
      headers: getAuthHeaders(currentUser),
    })
    return {
      is_admin: Boolean(data?.is_admin),
      permissions: data?.permissions || [],
      can_access_admin: Boolean(data?.can_access_admin),
      preferred_admin_path: data?.preferred_admin_path || '/',
    }
  } catch (error) {
    if (isAdminUser(currentUser)) {
      return {
        is_admin: true,
        permissions: [
          'dashboard_access',
          'manage_tasks',
          'publish_tasks',
          'manage_rewards',
          'publish_prizes',
          'read_users',
          'manage_users',
          'manage_points',
          'manage_permissions',
          'manage_settings',
          'review_tasks',
          'manage_audit',
        ],
        can_access_admin: true,
        preferred_admin_path: '/dashboard',
      }
    }
    return {
      is_admin: false,
      permissions: [],
      can_access_admin: false,
      preferred_admin_path: '/',
    }
  }
}

export const hasAdminPermission = (access, permission) => {
  if (!access) return false
  if (access.is_admin) return true
  if (!permission) return Boolean(access.can_access_admin)
  if (Array.isArray(permission)) {
    return permission.some((item) => (access.permissions || []).includes(item))
  }
  return (access.permissions || []).includes(permission)
}

const loadUserAsset = async (uID, headers) => {
  try {
    return await fetchApiJson(`/api/user/asset/${uID}`, { headers })
  } catch (error) {
    console.warn(`Failed to load asset for user ${uID}:`, error)
    return null
  }
}

export const loadAdminUsersWithAssets = async (currentUser = getStoredUser()) => {
  const headers = getAuthHeaders(currentUser)
  const [statsData, usersData] = await Promise.all([
    fetchApiJson('/api/user/stats', { headers }),
    fetchApiJson('/api/user/all', { headers }),
  ])

  const assetEntries = await Promise.all(
    (usersData || []).map(async (user) => [user.uID, await loadUserAsset(user.uID, headers)])
  )

  const assetMap = new Map(assetEntries)
  const users = (usersData || []).map((user) => {
    const asset = assetMap.get(user.uID)
    return {
      ...user,
      points: asset?.points || 0,
      asset_updated_at: asset?.time_update || null,
      has_asset: Boolean(asset),
    }
  })

  const totalPoints = typeof statsData?.total_points === 'number'
    ? statsData.total_points
    : users.reduce((sum, user) => sum + (user.points || 0), 0)

  return {
    users,
    stats: {
      userCount: typeof statsData?.user_count === 'number' ? statsData.user_count : users.length,
      adminCount: typeof statsData?.admin_count === 'number' ? statsData.admin_count : users.filter((user) => user.is_admin).length,
      assetCount: typeof statsData?.asset_count === 'number' ? statsData.asset_count : users.filter((user) => user.has_asset).length,
      totalPoints,
      avgPoints: users.length > 0 ? Math.round(totalPoints / users.length) : 0,
      zeroPoints: users.filter((user) => !user.points).length,
    },
  }
}
