import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Trophy,
  Gift,
  Users,
  Shield,
  BarChart3,
  Settings,
  Layers,
  Menu,
  X,
  LogOut
} from 'lucide-react'
import { Button } from '../ui'
import { fetchAdminAccess, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { clearAuthSession } from '../../auth'

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [access, setAccess] = useState({
    is_admin: false,
    permissions: [],
    can_access_admin: true,
  })

  const menuItems = [
    {
      title: t('adminNav.dashboard'),
      icon: LayoutDashboard,
      path: '/dashboard',
      description: t('adminNav.dashboardDesc'),
    },
    {
      title: t('adminNav.tasks'),
      icon: Trophy,
      path: '/dashboard/tasks',
      description: t('adminNav.tasksDesc'),
      requiredPermission: ['manage_tasks', 'publish_tasks'],
    },
    {
      title: t('adminNav.rewards'),
      icon: Gift,
      path: '/dashboard/rewards',
      description: t('adminNav.rewardsDesc'),
      requiredPermission: ['manage_rewards', 'publish_prizes'],
    },
    {
      title: t('adminNav.shards'),
      icon: Layers,
      path: '/dashboard/shards',
      description: t('adminNav.shardsDesc'),
      requiredPermission: ['manage_rewards', 'publish_prizes'],
    },
    {
      title: t('adminNav.users'),
      icon: Users,
      path: '/dashboard/users',
      description: t('adminNav.usersDesc'),
      requiredPermission: 'read_users',
    },
    {
      title: t('adminNav.permissions'),
      icon: Shield,
      path: '/dashboard/permissions',
      description: t('adminNav.permissionsDesc'),
      requiredPermission: 'manage_permissions',
    },
    {
      title: t('adminNav.points'),
      icon: BarChart3,
      path: '/dashboard/points',
      description: t('adminNav.pointsDesc'),
      requiredPermission: 'manage_points',
    },
    {
      title: t('adminNav.settings'),
      icon: Settings,
      path: '/dashboard/settings',
      description: t('adminNav.settingsDesc'),
      requiredPermission: 'manage_settings',
    }
  ]

  useEffect(() => {
    let cancelled = false
    const loadAccess = async () => {
      const currentUser = getStoredUser()
      if (!currentUser) return
      const nextAccess = await fetchAdminAccess(currentUser)
      if (!cancelled) {
        setAccess(nextAccess)
      }
    }

    loadAccess()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => hasAdminPermission(access, item.requiredPermission)),
    [access, t]
  )

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const handleLogout = () => {
    clearAuthSession()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        {/* 侧边栏头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-3 ${!sidebarOpen && 'justify-center'}`}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{t('adminLayout.panelTitle')}</h1>
                  <p className="text-xs text-gray-500">Jinli Admin</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title={!sidebarOpen ? item.title : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.title}</div>
                  </div>
                ) : (
                  <div className="text-xs absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {item.title}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* 侧边栏底部 */}
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full justify-start ${!sidebarOpen && 'px-2'}`}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">{t('adminLayout.logout')}</span>}
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {visibleMenuItems.find(item => isActive(item.path))?.title || t('adminLayout.panelTitle')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {visibleMenuItems.find(item => isActive(item.path))?.description || t('adminLayout.systemAdmin')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{t('adminLayout.adminRole')}</div>
                <div className="text-xs text-gray-500">{t('adminLayout.online')}</div>
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </header>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
