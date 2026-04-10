import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { formatEvmAddress } from '../utils'
import { fetchAdminAccess, fetchApiJson, getAuthToken, hasAdminPermission, isAdminUser } from '../admin-utils'
import { useAuth } from '../auth-context'

const formatTimestamp = (value) => {
  if (!value) return '未知'
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString()
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
      title: '任务管理',
      description: '查看任务列表、维护任务状态和任务配置。',
      to: '/dashboard/tasks',
      icon: Trophy,
      variant: 'primary',
    },
    {
      title: '奖品管理',
      description: '维护奖品、有效期、库存与流通状态。',
      to: '/dashboard/rewards',
      icon: Gift,
      variant: 'secondary',
    },
    {
      title: '用户管理',
      description: '查看用户信息、权限状态和搜索结果。',
      to: '/dashboard/users',
      icon: Users,
      variant: 'proceed',
    },
    {
      title: '权限管理',
      description: '维护管理权限分组和审核角色。',
      to: '/dashboard/permissions',
      icon: Shield,
      variant: 'success',
    },
    {
      title: '积分管理',
      description: '查看积分分布并执行积分调整。',
      to: '/dashboard/points',
      icon: BarChart3,
      variant: 'warning',
    },
    {
      title: '系统设置',
      description: '维护站点、注册和积分规则设置。',
      to: '/dashboard/settings',
      icon: Settings,
      variant: 'outline',
    },
  ]

  const loadDashboardData = async (user, accessInfo) => {
    const token = getAuthToken(user)
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    const canReviewTasks = hasAdminPermission(accessInfo, 'review_tasks')

    const results = await Promise.allSettled([
      fetchApiJson('/api/user/stats', { headers: authHeaders }),
      fetchApiJson('/api/task/all'),
      fetchApiJson('/api/prize/all'),
      ...(canReviewTasks ? [fetchApiJson('/api/tasklist/pending-verification/count', { headers: authHeaders })] : []),
      ...(canReviewTasks ? [fetchApiJson('/api/tasklist/pending-verification?limit=50', { headers: authHeaders })] : []),
    ])

    const [userStats, tasks, rewards, pendingCount, pendingList] = results

    const errors = []
    if (userStats.status === 'rejected') errors.push('用户统计')
    if (tasks.status === 'rejected') errors.push('任务统计')
    if (rewards.status === 'rejected') errors.push('奖励统计')
    if (canReviewTasks && pendingCount?.status === 'rejected') errors.push('待审核数量')
    if (canReviewTasks && pendingList?.status === 'rejected') errors.push('待审核列表')

    if (errors.length > 0) {
      toast.error(`部分数据加载失败：${errors.join('、')}`)
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
          toast.error(`加载管理面板失败: ${error.message}`)
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
      toast.error('登录状态已失效，请重新登录')
      navigate('/login')
      return
    }

    setProcessingTaskId(jID)
    try {
      const confirmed = window.confirm(
        approved ? '确认通过这条提交并标记为已审核？' : '确认退回这条提交并要求用户重新提交？'
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

      toast.success(approved ? '任务已通过审核' : '任务已退回，等待用户重新提交')
      await loadDashboardData(currentUser, access)
    } catch (error) {
      console.error('Error verifying journey:', error)
      toast.error(`操作失败: ${error.message}`)
    } finally {
      setProcessingTaskId(null)
    }
  }

  const refreshDashboard = async () => {
    if (!currentUser) return
    setRefreshing(true)
    try {
      await loadDashboardData(currentUser, access)
      toast.success('管理总览已刷新')
    } catch (error) {
      console.error('Error refreshing dashboard:', error)
      toast.error(`刷新失败: ${error.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  const normalizedQuery = reviewQuery.trim().toLowerCase()
  const canReviewTasks = hasAdminPermission(access, 'review_tasks')
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
        <LoadingPage message="正在加载管理总览..." />
      </ResponsiveContainer>
    )
  }

  if (!isAdmin) {
    return (
      <ResponsiveContainer>
        <Card variant="warning">
          <CardContent className="text-center py-12">
            <Shield className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">权限不足</h2>
            <p className="text-gray-600 mb-6">只有管理员才能访问管理面板。</p>
            <Button as={Link} to="/" variant="primary">
              返回首页
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
              <h1 className="text-4xl font-bold text-gray-900 mb-2">管理总览</h1>
              <p className="text-lg text-gray-600">
                优先处理待审核事项，再进入各个管理模块。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="warning" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                管理员
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
                <div className="text-sm text-gray-600">总用户数</div>
              </CardContent>
            </Card>

            <Card variant="secondary" className="text-center">
              <CardContent className="py-6">
                <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.adminUsers}
                </div>
                <div className="text-sm text-gray-600">管理员数量</div>
              </CardContent>
            </Card>

            <Card variant="success" className="text-center">
              <CardContent className="py-6">
                <BarChart3 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalPoints.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">累计积分</div>
              </CardContent>
            </Card>

            <Card variant="primary" className="text-center">
              <CardContent className="py-6">
                <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalTasks}
                </div>
                <div className="text-sm text-gray-600">任务类型</div>
              </CardContent>
            </Card>

            <Card variant="secondary" className="text-center">
              <CardContent className="py-6">
                <Gift className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalRewards}
                </div>
                <div className="text-sm text-gray-600">奖品数量</div>
              </CardContent>
            </Card>

            <Card variant="warning" className="text-center">
              <CardContent className="py-6">
                <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.pendingVerifications}
                </div>
                <div className="text-sm text-gray-600">待审核提交</div>
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
                  待处理事项
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={reviewQuery}
                      onChange={(e) => setReviewQuery(e.target.value)}
                      placeholder="搜索任务、地址或提交内容..."
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <Button variant="outline" onClick={refreshDashboard} disabled={refreshing}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {refreshing ? '刷新中...' : '刷新'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!canReviewTasks ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-900 font-medium mb-1">当前账号没有审核权限</p>
                  <p className="text-sm text-gray-600">如需处理提交审核，请让管理员把你加入具备 `review_tasks` 的权限组。</p>
                </div>
              ) : (
                <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="text-sm text-gray-600">
                  当前显示 {visiblePendingTasks.length} 条，匹配 {filteredPendingTasks.length} 条，待审核总数 {dashboardStats.pendingVerifications}。
                </div>
                {filteredPendingTasks.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPending((prev) => !prev)}
                  >
                    {showAllPending ? '收起列表' : '查看全部'}
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
                                    {task.task?.title || `任务 #${task.tID}`}
                                  </h3>
                                  <Badge variant="warning" size="sm">
                                    {(task.task?.points || 0).toLocaleString()} 积分
                                  </Badge>
                                </div>

                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>提交用户:</strong> {formatEvmAddress(task.user?.EVM)}
                                </div>

                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>提交内容:</strong> {task.info_input || '无'}
                                </div>

                                <div className="text-xs text-gray-500">
                                  提交时间: {formatTimestamp(task.time_submitted || task.time_created)}
                                </div>
                              </div>

                              <div className="flex gap-2 md:ml-4">
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleVerifyTask(task.jID || task.tlistID, true)}
                                  disabled={processingTaskId === (task.jID || task.tlistID)}
                                  aria-label="通过审核"
                                  title="通过审核"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  通过
                                </Button>
                                <Button
                                  variant="warning"
                                  size="sm"
                                  onClick={() => handleVerifyTask(task.jID || task.tlistID, false)}
                                  disabled={processingTaskId === (task.jID || task.tlistID)}
                                  aria-label="退回重提"
                                  title="退回重提"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  退回
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
                    {dashboardStats.pendingVerifications > 0 ? '当前筛选条件下没有结果' : '当前没有待审核提交'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {dashboardStats.pendingVerifications > 0 ? '换一个关键词试试，或点击刷新重新获取最新数据。' : '审核队列为空，管理入口可直接用于日常维护。'}
                  </p>
                </div>
              )}
                </>
              )}
            </CardContent>
          </Card>
        </SlideUp>

        <SlideUp delay={450}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                管理入口
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
                              进入{item.title}
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
