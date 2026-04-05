const ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'

export const isAdminUser = (user) => {
  const evm = user?.EVM?.toLowerCase()
  return Boolean(
    user?.is_admin === true ||
    user?.role === 'admin' ||
    (evm && evm === ADMIN_ADDRESS)
  )
}

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('Failed to parse stored user:', error)
    return null
  }
}

export const getAuthToken = (user) => user?.token || user?.access_token || localStorage.getItem('token') || ''

export const getAuthHeaders = (user) => {
  const token = getAuthToken(user)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const fetchApiJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `请求失败 (${response.status})`)
  }

  return data.data
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
