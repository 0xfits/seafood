import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// 页面组件
import HomePage from './pages/HomePage'
import RewardPage from './pages/RewardPage'
import TaskPage from './pages/TaskPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import ShardPage from './pages/ShardPage'
import AuthPage from './pages/AuthPage'

// 管理页面组件
import TasksManagement from './pages/admin/TasksManagement'
import RewardsManagement from './pages/admin/RewardsManagement'
import ShardsManagement from './pages/admin/ShardsManagement'
import UsersManagement from './pages/admin/UsersManagement'
import PermissionsManagement from './pages/admin/PermissionsManagement'
import PointsManagement from './pages/admin/PointsManagement'
import SystemSettings from './pages/admin/SystemSettings'

// 布局组件
import Header from './components/Header'
import Footer from './components/Footer'
import AdminLayout from './components/layout/AdminLayout'
import { fetchAdminAccess, hasAdminPermission } from './admin-utils'
import { useAuth } from './auth-context'
import { canonicalLangPath, SUPPORTED_LANGS } from './utils'

// 模态框组件
import LoginModal from './components/LoginModal'

// 语言路由包装器
const LanguageWrapper = ({ children }) => {
  const { lang } = useParams()
  const { i18n } = useTranslation()
  const location = useLocation()

  useEffect(() => {
    // 从URL路径更新语言
    if (lang && SUPPORTED_LANGS.includes(lang)) {
      i18n.changeLanguage(lang)
    } else if (!lang) {
      i18n.changeLanguage('zh')
    }
  }, [lang, i18n])

  // 语言前缀规范化：/hk/vn、/zh、/en/en 这类历史链接或手输地址先自愈到规范路径，
  // 否则内层路由无匹配会渲染成空白页（无语言前缀的 /dashboard*、/login、/register 不在首位语言表内，不会被加前缀）
  const canonicalPath = canonicalLangPath(location.pathname)

  if (canonicalPath !== location.pathname) {
    return <Navigate to={`${canonicalPath}${location.search}${location.hash}`} replace />
  }

  return <div className="min-h-screen flex flex-col">{children}</div>
}

// 浏览器标签标题（document.title）的唯一运行时写入点：
// 单一真源是 locale 文件里的 siteTitle；依赖 i18n.language 而非挂载点，才能同时覆盖
// 「首次加载」与两条语言切换路径（Header 的 navigate 改 URL → LanguageWrapper 切语言，以及直接 changeLanguage）。
const HTML_LANG_BY_KEY = { zh: 'zh-CN', hk: 'zh-HK', vn: 'vi', en: 'en' }

const DocumentTitle = () => {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language

  useEffect(() => {
    document.title = t('siteTitle')
    // 顺带把 <html lang> 同步为当前语言（index.html 里写死的 zh-CN 只是启动前回退值）
    document.documentElement.setAttribute('lang', HTML_LANG_BY_KEY[lang] || 'zh-CN')
  }, [t, lang])

  return null
}

// 受保护的路由组件
const ProtectedRoute = ({ children, adminOnly = false, requiredPermission = null }) => {
  const { isAuthenticated, user } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [preferredPath, setPreferredPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    const checkAccess = async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setHasAccess(false)
          setLoading(false)
        }
        return
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
  }, [adminOnly, isAuthenticated, requiredPermission, user?.uID])

  // 显示加载状态，避免权限检查期间的闪烁
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">正在验证权限...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (adminOnly && !hasAccess) {
    return <Navigate to={preferredPath !== '/' ? preferredPath : '/'} replace />
  }

  return children
}

function App() {
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    const handleOpenLoginModal = () => setShowLoginModal(true)

    window.addEventListener('openLoginModal', handleOpenLoginModal)

    return () => {
      window.removeEventListener('openLoginModal', handleOpenLoginModal)
    }
  }, [])

  return (
    <div className="app-container gradient-bg">
      <DocumentTitle />
      <Routes>
        {/* 登录页面 */}
        <Route path="/login" element={<AuthPage mode="login" />} />
        
        {/* 注册页面 */}
        <Route path="/register" element={<AuthPage mode="register" />} />
        
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
          <Route path="tasks" element={<ProtectedRoute adminOnly={true} requiredPermission={['manage_tasks', 'publish_tasks']}><TasksManagement /></ProtectedRoute>} />
          <Route path="rewards" element={<ProtectedRoute adminOnly={true} requiredPermission={['manage_rewards', 'publish_prizes']}><RewardsManagement /></ProtectedRoute>} />
          <Route path="shards" element={<ProtectedRoute adminOnly={true} requiredPermission={['manage_rewards', 'publish_prizes']}><ShardsManagement /></ProtectedRoute>} />
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

                {/* 碎片市场 */}
                <Route path="shard" element={<ShardPage />} />

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

    <LoginModal 
      isOpen={showLoginModal}
      onClose={() => setShowLoginModal(false)}
      onSuccess={() => {
        setShowLoginModal(false)
      }}
    />
  </div>
  )
}

export default App
