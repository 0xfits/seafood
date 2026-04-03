import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import RewardPage from './pages/RewardPage'
import TaskPage from './pages/TaskPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import Login from './components/Login'

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

  useEffect(() => {
    // 检查认证状态（从localStorage获取用户信息）
    const user = localStorage.getItem('user')
    if (user) {
      setIsAuthenticated(true)
      // 检查用户是否为管理员
      try {
        const userData = JSON.parse(user)
        // 管理员权限检查：1. is_admin字段 2. role字段 3. 指定EVM地址白名单
        const adminAddresses = [
          '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'.toLowerCase()
        ]
        const userAddress = userData.EVM?.toLowerCase()
        const isAdminByAddress = userAddress && adminAddresses.includes(userAddress)
        
        const isAdminUser = userData.is_admin === true || 
                           userData.role === 'admin' || 
                           isAdminByAddress
        
        setIsAdmin(isAdminUser)
      } catch (error) {
        console.warn('Failed to parse user data:', error)
        setIsAdmin(false)
      }
    }
  }, [])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  return (
    <div className="app-container gradient-bg">
      <Routes>
        {/* 登录页面 */}
        <Route path="/login" element={<Login />} />
        
        {/* 后台管理页面（管理员专用） */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute adminOnly={true}>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
      
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