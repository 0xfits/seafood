import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// 页面组件
import HomePage from './pages/HomePage'
import TaskPage from './pages/TaskPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import ShardPage from './pages/ShardPage'
import AuthPage from './pages/AuthPage'
import ThemePreviewPage from './pages/ThemePreviewPage'
import MessagesPage from './pages/MessagesPage'
// 领工资（Kevin 2026-10-20 · 需求②）：右侧悬浮菜单首位入口的落点页。
// 消费 /api/project/all（招募中/已截止项目 + my_role）、/api/project/<id>/apply、/api/project/<id>/claim；
// 未登录不跳转，页内给登录提示（登录引导的既有口径不变）。
// ★ 2026-10-20 后续指令：电量卡 + 签到区（原 /activities 独立页）已并入本页顶部 ⇒ 旧 `activities`
//   路由与 `pages/ActivitiesPage.jsx` 硬删（无 301，旧链接落下方 catch-all 提示页）。
import WagePage from './pages/wage/WagePage'
// 活动体系（design §26.19 · route §49.18 R1/R2）：`/campaign` 列表 + `/campaign/:ref` 两级详情。
// 消费 /api/campaign/all、/api/campaign/<ref>、/api/campaign/subtask/<id>/proof（均为已冻结契约）；
// 未登录可浏览，提交动作在页内提示登录（不跳转、不白页）。
import CampaignListPage from './pages/campaign/CampaignListPage'
import CampaignDetailPage from './pages/campaign/CampaignDetailPage'
// campaign 任务页（Kevin 2026-10-21 需求①）：`/task/:taskId` = **任务自己的页面**（URI = task id）。
// 读口 `GET /api/campaign/task/:taskId`（公开；draft 对匿名/非 owner ⇒ 404）。
// ★ 同日裁定：job（悬赏）体系弃用 ⇒ 悬赏详情 `/bounty/:jobId` 与其发布面 `/task/new` **整块下线**。
import CampaignTaskPage from './pages/campaign/CampaignTaskPage'

// 项目页（Kevin 2026-10-21）：`/:slug` = 项目规范地址（如 `/sui`）。
// 读口 = `GET /api/project/:ref`（三形态：snowflake / 数字 id / slug，原样透传）；
// 保留段（wage/task/… 二十一段）在页面自身判别 ⇒ 不渲染项目页、落 catch-all 提示页。
import ProjectPage from './pages/project/ProjectPage'

// 招工线残留面：`/task/review` = 待审核队列（读 `GET /api/tasklist/pending-verification` +
// 写 `POST /api/job/:jobId/review`，两口径不变）。
// ★ 2026-10-21（Kevin 裁定 · job 体系弃用）：发布页 `PublishJobPage`（`/task/new`）与详情页
//   `JobDetailPage`（`/bounty/:jobId`）**文件与路由一并删除**（后端 `POST /api/job`、`GET /api/task/:tID`、
//   `POST /api/task-progress/:id/submit` 同批下架）。
import JobReviewPage from './pages/jobs/JobReviewPage'
// 闲置物品线（**2026-10-11 合并单**：路由家族 `listing*` → `item*`；`RewardPage` 与列表页合并入首页）：
//   `item/new`（发布，原 `listing/new`）· `item/:itemId`（详情，原 `listing/:listingId`）
//   · `item`（**同路由 `?id=` 兼容**：无 `/item/:itemId` 段时按 query 的 `id` 渲染详情；两者都无 id ⇒ 重定向首页 `/`）。
// 后端面一字不动（`/api/prize/…` 与 `/api/listing…` 路径名保持不变）。
import PublishItemPage from './pages/item/PublishItemPage'
import ItemDetailPage from './pages/item/ItemDetailPage'

// catch-all 提示页（★ v1.12 §16.1 · T91 · Kevin 2026-10-11 裁定③）：内层 `<Routes>` 末位。
import NotFoundPage from './pages/NotFoundPage'

// 管理页面组件
import TasksManagement from './pages/admin/TasksManagement'
import RewardsManagement from './pages/admin/RewardsManagement'
import ShardsManagement from './pages/admin/ShardsManagement'
import UsersManagement from './pages/admin/UsersManagement'
import PermissionsManagement from './pages/admin/PermissionsManagement'
import PointsManagement from './pages/admin/PointsManagement'
import SystemSettings from './pages/admin/SystemSettings'
import FeeRatePage from './pages/admin/FeeRatePage'
import ReferralWeightMatrixPage from './pages/admin/ReferralWeightMatrixPage'
import CurrencyReviewPage from './pages/admin/CurrencyReviewPage'
import ListingReviewPage from './pages/admin/ListingReviewPage'
import ArbitrationReviewPage from './pages/admin/ArbitrationReviewPage'
import SiteTextPage from './pages/admin/SiteTextPage'
import AuditConsolePage from './pages/admin/AuditConsolePage'

// 布局组件
import AppShell from './shell/AppShell'
import AdminLayout from './components/layout/AdminLayout'
import { fetchAdminAccess, hasAdminPermission } from './admin-utils'
import { applySiteTextOverlay, composeDocumentTitle, fetchSiteTextOverlay } from './site-text-overlay'
import { useAuth } from './auth-context'
// S1：受保护路由登记位（过期提示据此判「该不该弹 toast」；不另造路径清单）
import { markProtectedRouteActive } from './auth'
import { buildLocalizedPath, canonicalLangPath, getLanguageFromUrl, SUPPORTED_LANGS } from './utils'

// 模态框组件
import LoginModal from './components/LoginModal'
// S1 会话过期提示（渲染 null；挂在 Router 内，读 `sessionExpired` 文案并弹一次性 toast）
import SessionExpiredNotice from './components/SessionExpiredNotice'

// 语言路由壳（唯一真源）：显式语言路由（/en|/hk|/vn|/zh/<path>）与无前缀兜底路由（/<path>，中文口径）共用这一个壳。
// 不用 `/:lang?/<path>` 可选段——那会把 /reward、/task 这类普通首段吃成 lang，内层只剩 index ⇒ 中文子页渲染成首页。
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

        {/* 任务列表（Kevin 2026-10-21 裁定：job 体系弃用）：
            `/task` = **campaign 任务列表**（读 `GET /api/home/campaign-tasks`，卡 → `/task/<taskId>`）。
            ★ 发布口 `/task/new` 与其页面文件已删除 ⇒ 该 URL 不再有发布页（落 `task/:taskId` 的
              campaign 任务页判非数字号 ⇒ 404 提示页，见 CampaignTaskPage 的数字号闸）；
            `/task/review` 保留（待审核队列）。 */}
        <Route path="task" element={<TaskPage />} />

        {/* 招工线残留面（P4-B4c-ii-a · route §4.2 J5）：review ⇒ GET /api/tasklist/pending-verification
            + POST /api/job/:jobId/review（键服务端派生）。
            ★ 2026-10-21 路由重切（Kevin 需求①）：`/task/<id>` 归 **campaign 任务页**
              （`GET /api/campaign/task/:taskId`）；
            ★ 同日 Kevin 裁定 job 弃用：`/bounty/:jobId`（悬赏详情）与 `/task/new`（发布）**两条都已移除**。
            静态段优先于动态段（react-router v6 排名）⇒ `/task/review` 不会被 `:taskId` 吃掉；
            段数不同 ⇒ `task`（列表，1 段）与 `task/:taskId`（2 段）不互吞。 */}
        <Route path="task/review" element={<JobReviewPage />} />
        {/* 闲置物品线（**2026-10-11 合并单**·路由家族 `listing*` → `item*`；旧 `/reward`、`/listing*` **硬删、不 301**）：
            item/new   ⇒ 发布（原 `listing/new`）；item/:itemId ⇒ 详情（原 `listing/:listingId`）；
            item（无段）⇒ **同路由 `?id=` 兼容**（按 query 的 `id` 渲染详情；两者都无 id ⇒ 组件内 `<Navigate to="/">`）。
            静态段 `item/new` 优先于动态段 `item/:itemId`（react-router v6 排名），故不会被 `:itemId` 吃掉。
            ★ Kevin 追加裁定（2026-10-11）：**不再注册「无 id 的 /item 列表路由」** —— 唯一列表 = 首页（HomePage 已取同一份
              feed `/api/prize/all`），`/item`（无 id）重定向首页（「一句话可改」）。 */}
        <Route path="item/new" element={<PublishItemPage />} />
        {/* ★ 编辑页（`docs/route-layer.spec.md` §49.12.3 · design §26.13）：复用发布页表单（`mode="edit"`），
            路由 = `item/:itemId/edit`。静态段 `item/new` 仍优先；`item/:itemId` 与 `item/:itemId/edit` 段数不同 ⇒ 不冲突。
            语言前缀同现有写法（内层相对段，前缀由外层 LangShell 承担）。 */}
        <Route path="item/:itemId/edit" element={<PublishItemPage mode="edit" />} />
        <Route path="item/:itemId" element={<ItemDetailPage />} />
        <Route path="item" element={<ItemDetailPage />} />

        {/* campaign 任务页（Kevin 2026-10-21 需求①）：URI = task id ⇒ `/task/<taskId>`。
            读口 `GET /api/campaign/task/:taskId`（公开；30s 缓存；draft 对匿名/非 owner ⇒ 404）；
            页面自身按 404 落提示页、未登录不拦截阅读（公开页、零写口）；非数字号（如已下线的
            `new`）在页内直接判 404 ⇒ 不发请求。
            与静态段 `task/review` 段值不同 ⇒ 后者排名优先，互不吞。 */}
        <Route path="task/:taskId" element={<CampaignTaskPage />} />

        {/* ★ 2026-10-21（Kevin 裁定 · job 体系弃用）：悬赏详情 `/bounty/:jobId` 路由与
            `pages/jobs/JobDetailPage.jsx` **一并删除** ⇒ 旧书签落内层 catch-all 提示页（无重定向）。 */}

        {/* 积分交易所（原「碎片市场」）：页面路径 2026-10-03 由 /shard 改名单为 /exchange；
            组件名与文件 ShardPage 不变，/api/shard* 与 t('shard') 文案键均不动 */}
        <Route path="exchange" element={<ShardPage />} />

        {/* 旧页面路径 /shard 兼容重定向：保留语言前缀，落到同档语言下的 exchange 页
            （zh 无前缀 ⇒ /exchange；/en|/hk|/vn/shard ⇒ /en|/hk|/vn/exchange）⇒ 旧链接不破损 */}
        <Route path="shard" element={<LegacyExchangeRedirect />} />

        {/* 消息页（**占位** · design-system.spec v1.5 §14 · T80 + route-layer.spec v2.27 §37）
            本轮新增页面路由 = 恰 1 条 `/messages`（LangShell 内层相对段）；X（推特）私信接驳位预留；
            **不得**增 `/nearby`（已由 Kevin 当日变更取代）。 */}
        <Route path="messages" element={<MessagesPage />} />

        {/* 领工资（Kevin 2026-10-20 需求②）：内层相对段 ⇒ 四语前缀同现有写法（/en/wage 等）。
            入口 = 右侧悬浮菜单第二位；页面自身不包 ProtectedRoute（未登录 ⇒ 页内登录提示）。 */}
        <Route path="wage" element={<WagePage />} />

        {/* 活动体系（design §26.19）：`campaign` 列表 → `campaign/:ref` 两级详情。
            段数不同 ⇒ 静态 `campaign` 与动态 `campaign/:ref` 不冲突；`ref` 原样透传给读口。
            公开可浏览（不包 ProtectedRoute），提交动作在页内提示登录。 */}
        <Route path="campaign" element={<CampaignListPage />} />
        <Route path="campaign/:ref" element={<CampaignDetailPage />} />

        {/* 主题/骨架可交互预览件（地基单 4c-i；四语前缀下同样可达） */}
        <Route path="theme-preview" element={<ThemePreviewPage />} />

        {/* 登录 / 注册（F1 修复：纳入 LangShell 内层管辖，与其它页面同一处置）
            旧实现在顶层 App 路由里写死 `/login`、`/register` ⇒ 只有无前缀直链可达；
            /en/login・/hk/login・/vn/login 落到 `/*` 壳的内层无匹配 ⇒ <main> 0 字节空壳。
            语言前缀一律由外层 LangShell 承担，内层只写相对段，不为某一档语言加特例路由。 */}
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />

        {/* 个人资料族（需要登录 · Kevin 2026-10-14 桌面侧栏重构）：
            /profile 落地 = 重定向到 我的交易-我买到的（index ⇒ profile/trades/bought）；
            三个子路径共用同一个 ProfilePage（左菜单 + 右内容，视图由 pathname 派生，见 ProfilePage 头注）。
            ★ 原 `activities` 顶层段已删（2026-10-20）：电量卡 + 签到区并入 `/wage` 顶部，
              旧 `/activities` 及其四语前缀档 ⇒ 落到末位 catch-all 提示页（同 /reward 一族处置）。 */}
        <Route path="profile" element={<ProfileIndexRedirect />} />
        <Route
          path="profile/trades/:subTab"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/favorites"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        {/* 我的资产（Kevin 2026-10-20 需求①②：BTTC 资产块自 /wage#batt-checkin 迁入；同 ProtectedRoute 族） */}
        <Route
          path="profile/assets"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/settings"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* 项目页（Kevin 2026-10-21）：`:slug` = 项目规范地址（页面规范形 `/<slug>`，如 `/sui`）。
            **内层末位、catch-all 之前**：静态段（wage / task / campaign / item / profile / exchange /
            shard / messages / theme-preview / login / register …）按 react-router v6 排名天然优先于 `:slug`；
            其余与显式路由同名的一级段（tasks / campaigns / items / projects / admin / api / settings /
            assets / market / order / orders / jobs / dashboard / users / points / rewards / permissions /
            fee-rate / weight-matrix / site-text / audit-console / 三个 review 页 …）由 ProjectPage 依
            `RESERVED_PROJECT_SEGMENTS`（37 段，后端 `PROJECT_SLUG_RESERVED` 同表）判别 ⇒
            渲染 catch-all 同款提示页（不发请求）。slug 无效 / 项目不存在（读口 404）同落提示页。 */}
        <Route path=":slug" element={<ProjectPage />} />

        {/* ★ catch-all 提示页（v1.12 §16.1 · T91 · Kevin 2026-10-11 裁定③）—— **内层 `<Routes>` 的末位**：
            旧路径（`/reward`、`/listing`、`/listing/new`、`/listing/:listingId` 及其四语前缀档）不匹配任何
            内层精确 / 动态段 ⇒ 命中此条 ⇒ 渲染「页面不存在」提示页（含「返回首页」入口），**不再是空白 main**。
            **非重定向 · 仍不是 301**（Kevin 裁定③ 未变）：本条无 `<Navigate>`，同 URL 呈现提示页。
            **外层 LangShell 的兜底壳机制（语言前缀壳 / 无前缀兜底壳 = 挂载点）一字不动**。
            末位 = 让既有 index / 精确段 / 动态段按 react-router v6 排名优先命中。 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}

// /profile 落地重定向（Kevin 2026-10-14：index ⇒ profile/trades/bought，即「我的交易-我买到的」）。
// 与 LegacyExchangeRedirect 同一体例：不走相对路由（避开 v7_relativeSplatPath 旗标的生产/测试分歧），
// 直接按当前 pathname 判定语言前缀重建绝对目标；query/hash 原样保留。
const ProfileIndexRedirect = () => {
  const location = useLocation()
  const target = buildLocalizedPath(getLanguageFromUrl(location.pathname), '/profile/trades/bought')

  return <Navigate to={`${target}${location.search}${location.hash}`} replace />
}

// 旧页面路径 /shard → /exchange 的兼容重定向（本单新增）。
// 不走相对路由（`to="../exchange"`）——相对 `..` 的解析受 `v7_relativeSplatPath` 未来旗标影响，
// 而生产 `<BrowserRouter>` 未开该旗标、测试却开了 ⇒ 相对写法会在两处产生不同结果。
// 这里直接用当前 pathname 判定语言前缀，行为与旗标无关：zh 无前缀 ⇒ /exchange；/en|/hk|/vn/shard ⇒ /<lang>/exchange。
// 旧链接的 query/hash 一并保留。
const LegacyExchangeRedirect = () => {
  const location = useLocation()
  const target = buildLocalizedPath(getLanguageFromUrl(location.pathname), '/exchange')

  return <Navigate to={`${target}${location.search}${location.hash}`} replace />
}

// 浏览器标签标题（document.title）的唯一运行时写入点：
// 单一真源是 locale 文件里的 siteTitle；依赖 i18n.language 而非挂载点，才能同时覆盖
// 「首次加载」与两条语言切换路径（Header 的 navigate 改 URL → LangShell 切语言，以及直接 changeLanguage）。
const HTML_LANG_BY_KEY = { zh: 'zh-CN', hk: 'zh-HK', vn: 'vi', en: 'en' }

const DocumentTitle = () => {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language
  // P9①（`route-layer.spec` v2.12 §27.2）：覆盖层合并后触发一次重渲染（覆盖值 > locale）。
  const [overlayTick, setOverlayTick] = useState(0)

  // 应用初始化 + 语言切换时取覆盖层并合并（覆盖值优先；**不本地持久缓存**）；失败 ⇒ 回落 locale 基值。
  useEffect(() => {
    let cancelled = false
    fetchSiteTextOverlay().then((overlay) => {
      if (cancelled || !overlay) return
      if (applySiteTextOverlay(i18n, overlay) > 0) setOverlayTick((n) => n + 1)
    })
    return () => { cancelled = true }
  }, [i18n, lang])

  useEffect(() => {
    // 品牌名｜标语：`siteTitle` 拆键后**仅品牌名**（`R-9-13`-3）；覆盖层改后此处即取新值（§26.11(c)）。
    document.title = composeDocumentTitle(t('siteTitle'), t('siteSlogan'))
    // 顺带把 <html lang> 同步为当前语言（index.html 里写死的 zh-CN 只是启动前回退值）
    document.documentElement.setAttribute('lang', HTML_LANG_BY_KEY[lang] || 'zh-CN')
  }, [t, lang, overlayTick])

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

  // ★ S1（AC2）：登记「当前处于受保护路由」—— 过期提示据此**不**叠 toast（登录引导由本组件给）。
  //   独立 effect：只做登记/注销，不参与下面的权限检查（清理函数互不干扰）。
  useEffect(() => markProtectedRouteActive(), [])

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
      {/* S1：会话过期提示的**唯一挂载点**（渲染 null、零 DOM；`login` 路由之外全站可用） */}
      <SessionExpiredNotice />
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
          {/* 8②（spec §19.5(d)）：费率页 / 权重矩阵页，闸 = manage_settings（与读写两口同键） */}
          <Route path="fee-rate" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><FeeRatePage /></ProtectedRoute>} />
          <Route path="weight-matrix" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><ReferralWeightMatrixPage /></ProtectedRoute>} />
          {/* 8④（spec §23.6/§23.7）：自建单位审核页，闸 = review_tasks */}
          <Route path="currency-review" element={<ProtectedRoute adminOnly={true} requiredPermission="review_tasks"><CurrencyReviewPage /></ProtectedRoute>} />
          {/* 8⑤（spec §25.2/§25.7）：商品合规审核页 / 招工仲裁页，闸 = review_tasks */}
          <Route path="listing-review" element={<ProtectedRoute adminOnly={true} requiredPermission="review_tasks"><ListingReviewPage /></ProtectedRoute>} />
          <Route path="arbitration-review" element={<ProtectedRoute adminOnly={true} requiredPermission="review_tasks"><ArbitrationReviewPage /></ProtectedRoute>} />
          {/* P9①（spec §27.2/§26.6）：站点文案页（角色文案 + 站点标语 + 数值项），闸 = manage_settings */}
          <Route path="site-text" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><SiteTextPage /></ProtectedRoute>} />
          <Route path="audit-console" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_audit"><AuditConsolePage /></ProtectedRoute>} />
        </Route>
      
      {/* 显式语言壳路由：/en/*、/hk/*、/vn/*、/zh/*（顺序即 SUPPORTED_LANGS；zh 也保留显式壳，配合自愈层把 /zh → /） */}
      {SUPPORTED_LANGS.map((lang) => (
        <Route key={lang} path={`/${lang}/*`} element={<LangShell />} />
      ))}

      {/* 无前缀兜底壳（中文口径：/、/reward、/task、/exchange…）：登录/注册/管理页在上方更精确匹配，不会被捕获 */}
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
