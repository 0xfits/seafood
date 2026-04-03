import React, { useState } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Trophy, 
  Gift, 
  Users, 
  Shield, 
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react'
import { Button } from '../ui'

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const menuItems = [
    {
      title: '仪表板',
      icon: LayoutDashboard,
      path: '/admin/dashboard',
      description: '系统概览和统计'
    },
    {
      title: '任务管理',
      icon: Trophy,
      path: '/admin/tasks',
      description: '创建和管理任务'
    },
    {
      title: '奖励管理', 
      icon: Gift,
      path: '/admin/rewards',
      description: '创建和管理奖励'
    },
    {
      title: '用户管理',
      icon: Users,
      path: '/admin/users',
      description: '管理用户账户'
    },
    {
      title: '权限管理',
      icon: Shield,
      path: '/admin/permissions',
      description: '管理用户权限'
    },
    {
      title: '积分管理',
      icon: BarChart3,
      path: '/admin/points',
      description: '调整用户积分'
    },
    {
      title: '系统设置',
      icon: Settings,
      path: '/admin/settings',
      description: '系统配置'
    }
  ]

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = '/login'
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
                  <h1 className="text-lg font-bold text-gray-900">管理面板</h1>
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
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.title}</div>
                    {!sidebarOpen && (
                      <div className="text-xs text-gray-500 absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {item.description}
                      </div>
                    )}
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
            {sidebarOpen && <span className="ml-2">退出登录</span>}
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
                {menuItems.find(item => isActive(item.path))?.title || '管理面板'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {menuItems.find(item => isActive(item.path))?.description || '系统管理'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">管理员</div>
                <div className="text-xs text-gray-500">在线</div>
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
