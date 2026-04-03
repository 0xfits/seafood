import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { Toaster } from 'react-hot-toast'

// 页面组件
import Login from './pages/Login'
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
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 检查认证状态（从localStorage获取用户信息）
    const user = localStorage.getItem('user')
    console.log('ProtectedRoute - 用户数据:', user)
    
    if (user) {
      setIsAuthenticated(true)
      // 检查用户是否为管理员
      try {
        const userData = JSON.parse(user)
        console.log('ProtectedRoute - 解析后用户数据:', userData)
        
        // 管理员权限检查：1. is_admin字段 2. role字段 3. 指定EVM地址白名单
        const adminAddresses = [
          '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'.toLowerCase()
        ]
        const userAddress = userData.EVM?.toLowerCase()
        console.log('ProtectedRoute - 用户地址:', userAddress)
        console.log('ProtectedRoute - 管理员地址列表:', adminAddresses)
        
        const isAdminByAddress = userAddress && adminAddresses.includes(userAddress)
        console.log('ProtectedRoute - 地址检查结果:', isAdminByAddress)
        
        const isAdminUser = userData.is_admin === true || 
                           userData.role === 'admin' || 
                           isAdminByAddress
        
        console.log('ProtectedRoute - 最终管理员判断:', isAdminUser)
        console.log('ProtectedRoute - is_admin字段:', userData.is_admin)
        console.log('ProtectedRoute - role字段:', userData.role)
        
        setIsAdmin(isAdminUser)
      } catch (error) {
        console.warn('Failed to parse user data:', error)
        setIsAdmin(false)
      }
    } else {
      console.log('ProtectedRoute - 未找到用户数据')
    }
    
    // 确保loading状态被设置
    setTimeout(() => {
      setLoading(false)
    }, 100)
  }, [])

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

  if (adminOnly && !isAdmin) {
    console.log('ProtectedRoute - 权限不足，跳转到首页')
    return <Navigate to="/" replace />
  }

  console.log('ProtectedRoute - 权限验证通过，渲染子组件')
  return children
}

function App() {
  return (
    <div className="app-container gradient-bg">
      <Routes>
        {/* 登录页面 */}
        <Route path="/login" element={<Login />} />
        
        {/* 管理页面路由 */}
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute adminOnly={true}>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksManagement />} />
          <Route path="rewards" element={<RewardsManagement />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="permissions" element={<PermissionsManagement />} />
          <Route path="points" element={<PointsManagement />} />
          <Route path="settings" element={<SystemSettings />} />
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
    </div>
  )
}

export default App