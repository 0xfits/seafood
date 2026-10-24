import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  Users,
  Gift,
  BarChart3,
  Settings,
  Shield,
} from 'lucide-react'

import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn, SlideUp } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'
import { buildLocalizedPath, formatEvmAddress, getLanguageFromUrl } from '../utils'
import { fetchAdminAccess, fetchApiJson, getAuthToken, hasAdminPermission, isAdminUser } from '../admin-utils'
import { useAuth } from '../auth-context'

// 审核面板整块下线（Kevin 2026-10-24 裁定）：本页原「Task Progress 审批」面板消费审核队列两个
//   读口（tasklist pending 队列 + 其 /count）与单条提交的动作口（verify 子路径），而这两口已于
//   `43ea14a`（2026-10-21，job 领域下线）随 21 条路由从 backend-ts 删除
//   ⇒ 生产实测 404（`LEDGER_REF_NOT_FOUND` / `ref_type=endpoint`），面板长期只显示「加载失败」。
//   故连同读口 / 写口 / 面板 UI / 队列相关 state 一并拆除：前端不留死面板。
//   现役审核面 = `/dashboard/exchange/currency-review`（币种审核，动作口挂在 `:cid` 下的 review 子路径）。
//   词典键 `dashPage.*` 审核相关项保留不删（四语键集 flat 1451×4 锚点，删键会改读数）。

const EMPTY_DASHBOARD_STATS = {
  totalUsers: 0,
  adminUsers: 0,
  totalPoints: 0,
  totalRewards: 0,
}

const DashboardPage = () => {
  const { user: currentUser, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [access, setAccess] = useState({
    is_admin: false,
    permissions: [],
    can_access_admin: false,
  })
  const [dashboardStats, setDashboardStats] = useState(EMPTY_DASHBOARD_STATS)

  const managementLinks = [
    {
      title: t('adminNav.users'),
      description: t('dashPage.linkUsersDesc'),
      to: '/dashboard/users',
      icon: Users,
      variant: 'proceed',
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

  const loadDashboardData = async (user) => {
    const token = getAuthToken(user)
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

    // job 下线（2026-10-21）：旧 `GET /api/task/all`（悬赏全表）已随后端删除 ⇒ 本页不再取。
    //   「任务总数」卡随之删除：现任务 = campaign task，唯一公开读口 `/api/home/campaign-tasks`
    //   只给 `LIMIT 20` 的 active 热门行 ⇒ 拿不到真·总数（照旧渲染只会把 20 说成「总数」，是假读数）。
    //   管理侧要看真实任务无独立列表页（2026-10-24 起「任务管理」页已下线；公开 `/campaign` 与首页仍在消费读口）。
    //   （词典键 `dashPage.statTasks` / `dashPage.errTaskStats` 保留：四语键集计数锚点，删键会改 flat 读数）
    const results = await Promise.allSettled([
      fetchApiJson('/api/user/stats', { headers: authHeaders }),
      fetchApiJson('/api/prize/all'),
    ])

    const [userStats, rewards] = results

    const errors = []
    if (userStats.status === 'rejected') errors.push(t('dashPage.errUserStats'))
    if (rewards.status === 'rejected') errors.push(t('dashPage.errRewardStats'))

    if (errors.length > 0) {
      toast.error(t('dashPage.partialLoadFailed', { list: errors.join(t('common.listSeparator')) }))
    }

    setDashboardStats({
      totalUsers: userStats.status === 'fulfilled' ? userStats.value.user_count || 0 : 0,
      adminUsers: userStats.status === 'fulfilled' ? userStats.value.admin_count || 0 : 0,
      totalPoints: userStats.status === 'fulfilled' ? userStats.value.total_points || 0 : 0,
      totalRewards: rewards.status === 'fulfilled' ? (rewards.value || []).length : 0,
    })
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
          await loadDashboardData(currentUser)
        } else {
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

  // 角色徽标 = 角色名（管理员 / 审核员 / 员工），只读权限三键，与已下线的审核队列无关 ⇒ 保留。
  const dashboardRoleLabel = access.is_admin ? t('dashPage.roleAdmin') : hasAdminPermission(access, 'review_tasks') ? t('dashPage.roleReviewer') : t('dashPage.roleStaff')
  const visibleManagementLinks = managementLinks.filter((item) => {
    if (item.to === '/dashboard/users') return hasAdminPermission(access, 'read_users')
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

            <Card variant="secondary" className="text-center">
              <CardContent className="py-6">
                <Gift className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {dashboardStats.totalRewards}
                </div>
                <div className="text-sm text-gray-600">{t('dashPage.statRewards')}</div>
              </CardContent>
            </Card>
          </ResponsiveGrid>
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
