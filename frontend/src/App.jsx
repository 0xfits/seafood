import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { Toaster } from 'react-hot-toast'

// 页面组件
import Login from './pages/Login'
import Register from './pages/Register'
import HomePage from './pages/HomePage'
import RewardPage from './pages/RewardPage'
import TaskPage from './pages/TaskPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'

// 管理页面组件
import TasksManagement from './pages/admin/TasksManagement'
import RewardsManagement from './pages/admin/RewardsManagement'
import UsersManagement from './pages/admin/UsersManagement'
import PermissionsManagement from './pages/admin/PermissionsManagement'
import PointsManagement from './pages/admin/PointsManagement'
import SystemSettings from './pages/admin/SystemSettings'

// 布局组件
import Header from './components/Header'
import Footer from './components/Footer'
import AdminLayout from './components/layout/AdminLayout'
import { fetchAdminAccess, getStoredUser, hasAdminPermission } from './admin-utils'

// 模态框组件
import RegisterModal from './components/RegisterModal'
import LoginModal from './components/LoginModal'

// 语言路由包装器
const LanguageWrapper = ({ children }) => {
  const { lang } = useParams()
  const { i18n } = useTranslation()
  const location = useLocation()

  useEffect(() => {
    // 从URL路径更新语言
    if (lang && ['zh', 'en', 'hk', 'vn'].includes(lang)) {
      i18n.changeLanguage(lang)
    } else if (!lang) {
      i18n.changeLanguage('zh')
    }
  }, [lang, i18n])

  return <div className="min-h-screen flex flex-col">{children}</div>
}

// 受保护的路由组件
const ProtectedRoute = ({ children, adminOnly = false, requiredPermission = null }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [preferredPath, setPreferredPath] = useState('/')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const checkAccess = async () => {
      const user = getStoredUser()
      if (!user) {
        if (!cancelled) {
          setIsAuthenticated(false)
          setHasAccess(false)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setIsAuthenticated(true)
      }

      if (!adminOnly) {
        if (!cancelled) {
          setHasAccess(true)
          setLoading(false)
        }
        return
      }

      try {
        const access = await fetchAdminAccess(user)
        if (cancelled) return

        setPreferredPath(access.preferred_admin_path || '/')
        setHasAccess(access.can_access_admin && hasAdminPermission(access, requiredPermission))
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to verify admin access:', error)
          setHasAccess(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    checkAccess()
    return () => {
      cancelled = true
    }
  }, [adminOnly, requiredPermission])

  // 显示加载状态，避免权限检查期间的闪烁
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">正在验证权限...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute - 未认证，跳转到登录页')
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !hasAccess) {
    return <Navigate to={preferredPath !== '/' ? preferredPath : '/'} replace />
  }

  return children
}

function App() {
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    // 监听打开注册模态框事件
    const handleOpenRegisterModal = () => setShowRegisterModal(true)
    const handleOpenLoginModal = () => setShowLoginModal(true)

    window.addEventListener('openRegisterModal', handleOpenRegisterModal)
    window.addEventListener('openLoginModal', handleOpenLoginModal)

    return () => {
      window.removeEventListener('openRegisterModal', handleOpenRegisterModal)
      window.removeEventListener('openLoginModal', handleOpenLoginModal)
    }
  }, [])

  return (
    <div className="app-container gradient-bg">
      <Routes>
        {/* 登录页面 */}
        <Route path="/login" element={<Login />} />
        
        {/* 注册页面 */}
        <Route path="/register" element={<Register />} />
        
        {/* 管理页面路由 */}
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute adminOnly={true}>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<ProtectedRoute adminOnly={true}><DashboardPage /></ProtectedRoute>} />
          <Route path="tasks" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_tasks"><TasksManagement /></ProtectedRoute>} />
          <Route path="rewards" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_rewards"><RewardsManagement /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute adminOnly={true} requiredPermission="read_users"><UsersManagement /></ProtectedRoute>} />
          <Route path="permissions" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_permissions"><PermissionsManagement /></ProtectedRoute>} />
          <Route path="points" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_points"><PointsManagement /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><SystemSettings /></ProtectedRoute>} />
        </Route>
      
      {/* 带语言前缀的路由 */}
      <Route 
        path="/:lang?/*" 
        element={
          <LanguageWrapper>
            <Header />
            <main className="flex-grow">
              <Routes>
                {/* 首页 */}
                <Route index element={<HomePage />} />
                
                {/* 奖励页面 */}
                <Route path="reward" element={<RewardPage />} />
                
                {/* 任务页面 */}
                <Route path="task" element={<TaskPage />} />
                
                {/* 个人资料页面（需要登录） */}
                <Route 
                  path="profile" 
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  } 
                />
              </Routes>
            </main>
            <Footer />
          </LanguageWrapper>
        } 
      />
    </Routes>

    {/* 全局模态框 */}
    <RegisterModal 
      isOpen={showRegisterModal}
      onClose={() => setShowRegisterModal(false)}
      onSuccess={() => {
        setShowRegisterModal(false)
        // 登录成功后可以显示登录模态框
        setShowLoginModal(true)
      }}
    />
    
    <LoginModal 
      isOpen={showLoginModal}
      onClose={() => setShowLoginModal(false)}
      onSuccess={() => {
        setShowLoginModal(false)
        // 登录成功后可以刷新页面或跳转
        window.location.reload()
      }}
    />
  </div>
  )
}

export default App
