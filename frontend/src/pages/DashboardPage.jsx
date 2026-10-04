import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  Users,
  Trophy,
  Gift,
  Clock,
  BarChart3,
  Settings,
  Eye,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
} from 'lucide-react'

import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../utils'
import { fetchAdminAccess, fetchApiJson, getAuthToken, hasAdminPermission, isAdminUser } from '../admin-utils'
import { useAuth } from '../auth-context'

const formatTimestamp = (value, t) => {
  if (!value) return t('dashPage.unknown')
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? t('dashPage.unknown') : date.toLocaleString()
}

const EMPTY_DASHBOARD_STATS = {
  totalUsers: 0,
  adminUsers: 0,
  totalPoints: 0,
  totalTasks: 0,
  totalRewards: 0,
  pendingVerifications: 0,
}

const resolvePendingVerificationCount = (canReviewTasks, pendingCount, pendingList) => {
  if (!canReviewTasks) return 0
  if (pendingCount?.status === 'fulfilled' && typeof pendingCount.value?.count === 'number') {
    return pendingCount.value.count
  }
  if (pendingList?.status === 'fulfilled' && Array.isArray(pendingList.value)) {
    return pendingList.value.length
  }
  return 0
}

const DashboardPage = () => {
  const navigate = useNavigate()
  const { user: currentUser, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const [pendingVerificationTasks, setPendingVerificationTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingTaskId, setProcessingTaskId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [access, setAccess] = useState({
    is_admin: false,
    permissions: [],
    can_access_admin: false,
  })
  const [reviewQuery, setReviewQuery] = useState('')
  const [showAllPending, setShowAllPending] = useState(false)
  const [dashboardStats, setDashboardStats] = useState(EMPTY_DASHBOARD_STATS)

  const managementLinks = [
    {
      title: t('adminNav.tasks'),
      description: t('dashPage.linkTasksDesc'),
      to: '/dashboard/tasks',
      icon: Trophy,
      variant: 'primary',
    },
    {
      title: t('adminNav.rewards'),
      description: t('dashPage.linkRewardsDesc'),
      to: '/dashboard/rewards',
      icon: Gift,
      variant: 'secondary',
    },
    {
      title: t('adminNav.users'),
      description: t('dashPage.linkUsersDesc'),
      to: '/dashboard/users',
      icon: Users,
      variant: 'proceed',
    },
    {
      title: t('adminNav.permissions'),
      description: t('dashPage.linkPermissionsDesc'),
      to: '/dashboard/permissions',
      icon: Shield,
      variant: 'success',
    },
    {
      title: t('adminNav.points'),
      description: t('dashPage.linkPointsDesc'),
      to: '/dashboard/points',
      icon: BarChart3,
      variant: 'warning',
    },
    {
      title: t('adminNav.settings'),
      description: t('dashPage.linkSettingsDesc'),
      to: '/dashboard/settings',
      icon: Settings,
      variant: 'outline',
    },
  ]

  const loadDashboardData = async (user, accessInfo) => {
    const token = getAuthToken(user)
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    // ★ S18：队列读口门改「**已登录即可见**」（与 `/task/review` 同口径）；内容过滤唯一真源 = 后端。
    const canReviewTasks = isAuthenticated

    const results = await Promise.allSettled([
      fetchApiJson('/api/user/stats', { headers: authHeaders }),
      fetchApiJson('/api/task/all'),
      fetchApiJson('/api/prize/all'),
      ...(canReviewTasks ? [fetchApiJson('/api/tasklist/pending-verification/count', { headers: authHeaders })] : []),
      ...(canReviewTasks ? [fetchApiJson('/api/tasklist/pending-verification?limit=50', { headers: authHeaders })] : []),
    ])

    const [userStats, tasks, rewards, pendingCount, pendingList] = results

    const errors = []
    if (userStats.status === 'rejected') errors.push(t('dashPage.errUserStats'))
    if (tasks.status === 'rejected') errors.push(t('dashPage.errTaskStats'))
    if (rewards.status === 'rejected') errors.push(t('dashPage.errRewardStats'))
    if (canReviewTasks && pendingCount?.status === 'rejected') errors.push(t('dashPage.errPendingCount'))
    if (canReviewTasks && pendingList?.status === 'rejected') errors.push(t('dashPage.errPendingList'))

    if (errors.length > 0) {
      toast.error(t('dashPage.partialLoadFailed', { list: errors.join(t('common.listSeparator')) }))
    }

    setDashboardStats({
      totalUsers: userStats.status === 'fulfilled' ? userStats.value.user_count || 0 : 0,
      adminUsers: userStats.status === 'fulfilled' ? userStats.value.admin_count || 0 : 0,
      totalPoints: userStats.status === 'fulfilled' ? userStats.value.total_points || 0 : 0,
      totalTasks: tasks.status === 'fulfilled' ? (tasks.value || []).length : 0,
      totalRewards: rewards.status === 'fulfilled' ? (rewards.value || []).length : 0,
      pendingVerifications: resolvePendingVerificationCount(canReviewTasks, pendingCount, pendingList),
    })

    setPendingVerificationTasks(canReviewTasks && pendingList?.status === 'fulfilled' ? pendingList.value || [] : [])
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!isAuthenticated || !currentUser) {
        setIsAdmin(false)
        setAccess({
          is_admin: false,
          permissions: [],
          can_access_admin: false,
        })
        setPendingVerificationTasks([])
        setDashboardStats(EMPTY_DASHBOARD_STATS)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const accessInfo = await fetchAdminAccess(currentUser)
        const admin = accessInfo.can_access_admin || isAdminUser(currentUser)

        if (cancelled) return

        setIsAdmin(admin)
        setAccess(accessInfo)

        if (admin) {
          await loadDashboardData(currentUser, accessInfo)
        } else {
          setPendingVerificationTasks([])
          setDashboardStats(EMPTY_DASHBOARD_STATS)
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
        if (!cancelled) {
          toast.error(t('dashPage.loadFailed', { message: error.message }))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [currentUser, isAuthenticated])

  const handleVerifyTask = async (jID, approved) => {
    const token = getAuthToken(currentUser)
    if (!token) {
      toast.error(t('adminCommon.sessionExpired'))
      navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'))
      return
    }

    setProcessingTaskId(jID)
    try {
      const confirmed = window.confirm(
        approved ? t('dashPage.confirmApprove') : t('dashPage.confirmReject')
      )
      if (!confirmed) {
        setProcessingTaskId(null)
        return
      }

      await fetchApiJson(`/api/tasklist/${jID}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      })

      toast.success(approved ? t('dashPage.verifyApproved') : t('dashPage.verifyRejected'))
      await loadDashboardData(currentUser, access)
    } catch (error) {
      console.error('Error verifying task progress:', error)
      toast.error(t('dashPage.actionFailed', { message: error.message }))
    } finally {
      setProcessingTaskId(null)
    }
  }

  const refreshDashboard = async () => {
    if (!currentUser) return
    setRefreshing(true)
    try {
      await loadDashboardData(currentUser, access)
      toast.success(t('dashPage.refreshSuccess'))
    } catch (error) {
      console.error('Error refreshing dashboard:', error)
      toast.error(t('dashPage.refreshFailed', { message: error.message }))
    } finally {
      setRefreshing(false)
    }
  }

  const normalizedQuery = reviewQuery.trim().toLowerCase()
  // ★ S18：队列面板门 = 登录态（与 `/task/review` 同口径）；角色徽标仍按既有权限口径（语义不变）。
  const dashboardRoleLabel = access.is_admin ? t('dashPage.roleAdmin') : hasAdminPermission(access, 'review_tasks') ? t('dashPage.roleReviewer') : t('dashPage.roleStaff')
  const filteredPendingTasks = pendingVerificationTasks.filter((task) => {
    if (!normalizedQuery) return true
    return (
      task.task?.title?.toLowerCase().includes(normalizedQuery) ||
      task.user?.EVM?.toLowerCase().includes(normalizedQuery) ||
      task.info_input?.toLowerCase().includes(normalizedQuery)
    )
  })
  const visiblePendingTasks = showAllPending ? filteredPendingTasks : filteredPendingTasks.slice(0, 6)
  const visibleManagementLinks = managementLinks.filter((item) => {
    if (item.to === '/dashboard/rewards') return hasAdminPermission(access, ['manage_rewards', 'publish_prizes'])
    if (item.to === '/dashboard/tasks') return hasAdminPermission(access, ['manage_tasks', 'publish_tasks'])
    if (item.to === '/dashboard/users') return hasAdminPermission(access, 'read_users')
    if (item.to === '/dashboard/permissions') return hasAdminPermission(access, 'manage_permissions')
    if (item.to === '/dashboard/points') return hasAdminPermission(access, 'manage_points')
    if (item.to === '/dashboard/settings') return hasAdminPermission(access, 'manage_settings')
    return true
  })

  if (loading) {
    return (
      <ResponsiveContainer>
        <LoadingPage message={t('dashPage.loadingOverview')} />
      </ResponsiveContainer>
    )
  }

  if (!isAdmin) {
    return (
      <ResponsiveContainer>
        <Card variant="warning">
          <CardContent className="text-center py-12">
            <Shield className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('dashPage.noPermission')}</h2>
            <p className="text-gray-600 mb-6">{t('dashPage.noPermissionBody')}</p>
            <Button as={Link} to={buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/')} variant="primary">
              {t('dashPage.backHome')}
            </Button>
          </CardContent>
        </Card>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        <FadeIn>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('dashPage.title')}</h1>
              <p className="text-lg text-gray-600">
                {t('dashPage.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="warning" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {dashboardRoleLabel}
              </Badge>
              <span className="text-sm text-gray-600">
                {formatEvmAddress(currentUser?.EVM)}
              </span>
            </div>
          </div>
        </FadeIn>

        <SlideUp delay={150}>
          <ResponsiveGrid sm={2} md={3} gap={4}>
            <Card variant="primary" className="text-center">
              <CardContent className="py-6">
                <Users className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalUsers}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statUsers')}</div>
              </CardContent>
            </Card>

            <Card variant="secondary" className="text-center">
              <CardContent className="py-6">
                <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.adminUsers}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statAdmins')}</div>
              </CardContent>
            </Card>

            <Card variant="success" className="text-center">
              <CardContent className="py-6">
                <BarChart3 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalPoints.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statPoints')}</div>
              </CardContent>
            </Card>

            <Card variant="primary" className="text-center">
              <CardContent className="py-6">
                <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalTasks}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statTasks')}</div>
              </CardContent>
            </Card>

            <Card variant="secondary" className="text-center">
              <CardContent className="py-6">
                <Gift className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalRewards}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statRewards')}</div>
              </CardContent>
            </Card>

            <Card variant="warning" className="text-center">
              <CardContent className="py-6">
                <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.pendingVerifications}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statPending')}</div>
              </CardContent>
            </Card>
          </ResponsiveGrid>
        </SlideUp>

        <SlideUp delay={300}>
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {t('dashPage.pendingTitle')}
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={reviewQuery}
                      onChange={(e) => setReviewQuery(e.target.value)}
                      placeholder={t('dashPage.searchPlaceholder')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <Button variant="outline" onClick={refreshDashboard} disabled={refreshing}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* ★ S18：队列门 = 登录态。原「无审核权限」空态分支在现门面下已不可达 ⇒ 删除（本仓禁死代码）。 */}
              <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="text-sm text-gray-600">
                  {t('dashPage.queueSummary', { visible: visiblePendingTasks.length, matched: filteredPendingTasks.length, total: dashboardStats.pendingVerifications })}
                </div>
                {filteredPendingTasks.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPending((prev) => !prev)}
                  >
                    {showAllPending ? t('dashPage.collapse') : t('dashPage.viewAll')}
                  </Button>
                )}
              </div>

              {filteredPendingTasks.length > 0 ? (
                <StaggerContainer>
                  <div className="space-y-4">
                    {visiblePendingTasks.map((task, index) => (
                      <FadeIn key={task.jID || task.tlistID} delay={index * 75}>
                        <Card variant="inactive" className="border-l-4 border-l-orange-500">
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-gray-900">
                                    {task.task?.title || t('dashPage.taskFallback', { id: task.tID })}
                                  </h3>
                                  <Badge variant="warning" size="sm">
                                    {t('adminCommon.pointsValue', { value: (task.task?.points || 0).toLocaleString() })}
                                  </Badge>
                                </div>

                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>{t('dashPage.submittedBy')}</strong> {formatEvmAddress(task.user?.EVM)}
                                </div>

                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>{t('dashPage.submittedContent')}</strong> {task.info_input || t('dashPage.none')}
                                </div>

                                <div className="text-xs text-gray-500">
                                  {t('dashPage.submittedAt')} {formatTimestamp(task.time_submitted || task.time_created, t)}
                                </div>
                              </div>

                              <div className="flex gap-2 md:ml-4">
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleVerifyTask(task.jID || task.tlistID, true)}
                                  disabled={processingTaskId === (task.jID || task.tlistID)}
                                  aria-label={t('dashPage.approveLabel')}
                                  title={t('dashPage.approveLabel')}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {t('dashPage.approve')}
                                </Button>
                                <Button
                                  variant="warning"
                                  size="sm"
                                  onClick={() => handleVerifyTask(task.jID || task.tlistID, false)}
                                  disabled={processingTaskId === (task.jID || task.tlistID)}
                                  aria-label={t('dashPage.rejectLabel')}
                                  title={t('dashPage.rejectLabel')}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t('dashPage.reject')}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </FadeIn>
                    ))}
                  </div>
                </StaggerContainer>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-900 font-medium mb-1">
                    {dashboardStats.pendingVerifications > 0 ? t('dashPage.noResults') : t('dashPage.noPending')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {dashboardStats.pendingVerifications > 0 ? t('dashPage.noResultsHint') : t('dashPage.noPendingHint')}
                  </p>
                </div>
              )}
                </>
            </CardContent>
          </Card>
        </SlideUp>

        <SlideUp delay={450}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {t('dashPage.linksTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid sm={1} md={2} gap={4}>
                {visibleManagementLinks.map((item) => {
                  const Icon = item.icon

                  return (
                    <Card key={item.to} variant="inactive" className="border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-5 h-5 text-gray-700" />
                              <h3 className="font-semibold text-gray-900">{item.title}</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                            <Button as={Link} to={item.to} variant={item.variant}>
                              {t('dashPage.enterLink', { title: item.title })}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </SlideUp>
      </div>
    </ResponsiveContainer>
  )
}

export default DashboardPage
