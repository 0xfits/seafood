import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// 页面组件
import HomePage from './pages/HomePage'
import RewardPage from './pages/RewardPage'
import TaskPage from './pages/TaskPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import ShardPage from './pages/ShardPage'
import AuthPage from './pages/AuthPage'
import ThemePreviewPage from './pages/ThemePreviewPage'

// 招工线（P4-B4c-ii-a）：页面挂在既有 `task` 路由族下（任务中心 = 招工列表，见 §1 #9【保留·改接】）。
// 路由名全部由**已注册 API 路径**派生（/api/job[/*]、/api/task-progress/*），不自造新域名。
import PublishJobPage from './pages/jobs/PublishJobPage'
import JobDetailPage from './pages/jobs/JobDetailPage'
import JobReviewPage from './pages/jobs/JobReviewPage'
import ListingsPage from './pages/listings/ListingsPage'
import PublishListingPage from './pages/listings/PublishListingPage'
import ListingDetailPage from './pages/listings/ListingDetailPage'

// 管理页面组件
import TasksManagement from './pages/admin/TasksManagement'
import RewardsManagement from './pages/admin/RewardsManagement'
import ShardsManagement from './pages/admin/ShardsManagement'
import UsersManagement from './pages/admin/UsersManagement'
import PermissionsManagement from './pages/admin/PermissionsManagement'
import PointsManagement from './pages/admin/PointsManagement'
import SystemSettings from './pages/admin/SystemSettings'

// 布局组件
import AppShell from './shell/AppShell'
import AdminLayout from './components/layout/AdminLayout'
import { fetchAdminAccess, hasAdminPermission } from './admin-utils'
import { useAuth } from './auth-context'
import { buildLocalizedPath, canonicalLangPath, getLanguageFromUrl, SUPPORTED_LANGS } from './utils'

// 模态框组件
import LoginModal from './components/LoginModal'

// 语言路由壳（唯一真源）：显式语言路由（/en|/hk|/vn|/zh/*）与无前缀兜底路由（/*，中文口径）共用这一个壳。
// 不用 `/:lang?/*` 可选段——那会把 /reward、/task 这类普通首段吃成 lang，内层只剩 index ⇒ 中文子页渲染成首页。
const LangShell = () => {
  const { i18n } = useTranslation()
  const location = useLocation()
  // 语言判定统一走 utils 单一真源：首段是白名单语言则取之，否则视为默认语 zh（无前缀口径）
  const lang = getLanguageFromUrl(location.pathname)

  useEffect(() => {
    i18n.changeLanguage(lang)
  }, [lang, i18n])

  // 语言前缀/重复斜杠规范化：/hk/vn、/zh、/en/en、/vn//reward 这类历史链接或手输地址先自愈到规范路径，
  // 否则内层路由无匹配会渲染成空白页（无语言前缀的 /dashboard*、/login、/register 不在首位语言表内，不会被加前缀）
  const canonicalPath = canonicalLangPath(location.pathname)

  if (canonicalPath !== location.pathname) {
    return <Navigate to={`${canonicalPath}${location.search}${location.hash}`} replace />
  }

  return (
    <AppShell>
      {/* 内层路由用相对路径，语言前缀由外层壳负责，不复制多份 */}
      <Routes>
        {/* 首页 */}
        <Route index element={<HomePage />} />

        {/* 奖励页面 */}
        <Route path="reward" element={<RewardPage />} />

        {/* 任务页面（= 招工列表；消费 /api/task/all、/api/task-progress） */}
        <Route path="task" element={<TaskPage />} />

        {/* 招工线（P4-B4c-ii-a · 真源 = docs/route-layer.spec.md v0.9 §4.2 J1–J6）
            task/new    ⇒ POST /api/job（发布招工 + 托管；幂等键**前端提供** cli:）
            task/review ⇒ GET /api/tasklist/pending-verification + POST /api/job/:jobId/review（键服务端派生）
            task/:jobId ⇒ GET /api/task/:tID + POST /api/job/:jobId/{apply,accept} + /api/task-progress/:id/submit
            静态段优先于动态段（react-router v6 排名），故 /task/new|/task/review 不会被 :jobId 吃掉 */}
        <Route path="task/new" element={<PublishJobPage />} />
        <Route path="task/review" element={<JobReviewPage />} />
        <Route path="listing" element={<ListingsPage />} />
        <Route path="listing/new" element={<PublishListingPage />} />
        <Route path="listing/:listingId" element={<ListingDetailPage />} />
        <Route path="task/:jobId" element={<JobDetailPage />} />

        {/* 碎片市场 */}
        <Route path="shard" element={<ShardPage />} />

        {/* 主题/骨架可交互预览件（地基单 4c-i；四语前缀下同样可达） */}
        <Route path="theme-preview" element={<ThemePreviewPage />} />

        {/* 登录 / 注册（F1 修复：纳入 LangShell 内层管辖，与其它页面同一处置）
            旧实现在顶层 App 路由里写死 `/login`、`/register` ⇒ 只有无前缀直链可达；
            /en/login・/hk/login・/vn/login 落到 `/*` 壳的内层无匹配 ⇒ <main> 0 字节空壳。
            语言前缀一律由外层 LangShell 承担，内层只写相对段，不为某一档语言加特例路由。 */}
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />

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
    </AppShell>
  )
}

// 浏览器标签标题（document.title）的唯一运行时写入点：
// 单一真源是 locale 文件里的 siteTitle；依赖 i18n.language 而非挂载点，才能同时覆盖
// 「首次加载」与两条语言切换路径（Header 的 navigate 改 URL → LangShell 切语言，以及直接 changeLanguage）。
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
  const { t } = useTranslation()

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
        <div className="text-lg text-gray-600">{t('common.verifyingPermission')}</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // F1 同族：受保护路由的登录跳转必须保留当前语言前缀，否则 /en/profile ⇒ /login（语言回落中文档）
    return <Navigate to={buildLocalizedPath(getLanguageFromUrl(location.pathname), '/login')} replace state={{ from: location }} />
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
        {/* 登录/注册路由已下沉到 LangShell 内层（F1）；此处不再重复声明绝对路径路由 */}
        

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
      
      {/* 显式语言壳路由：/en/*、/hk/*、/vn/*、/zh/*（顺序即 SUPPORTED_LANGS；zh 也保留显式壳，配合自愈层把 /zh → /） */}
      {SUPPORTED_LANGS.map((lang) => (
        <Route key={lang} path={`/${lang}/*`} element={<LangShell />} />
      ))}

      {/* 无前缀兜底壳（中文口径：/、/reward、/task、/shard…）：登录/注册/管理页在上方更精确匹配，不会被捕获 */}
      <Route path="/*" element={<LangShell />} />
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
