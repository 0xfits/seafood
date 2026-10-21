import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, LogIn, UserPlus, ChevronDown, Moon, Sun, Gift, Store, ShieldCheck } from 'lucide-react'
import cnFlag from '../images/cn.svg'
import usFlag from '../images/us.svg'
import hkFlag from '../images/hk.svg'
import vnFlag from '../images/vn.svg'
// 订单入口图标（Kevin 2026-10-14 需求①；资产由派单方落盘，fill=currentColor，path 数据一字不改）
import orderIcon from '../images/order.svg'
import HoverMenu from './ui/HoverMenu'
import { fetchAdminAccess } from '../admin-utils'
import { fetchUserBalances, formatBalanceAmount, toBalanceRows } from '../balances-api'
import { useAuth } from '../auth-context'
import {buildLocalizedPath, buildLangPath, getLanguageFromUrl} from '../utils'

// T86（v1.5 重算 · 取代 v1.1 T76 排除集）：移动汉堡面板 = 顶栏项集 − **底栏目标集**。
// 本版底栏目标集 = `/`、`/exchange`、`/listing/new`、`/messages`、`/profile`（design-system.spec v1.5 §14.4）
// ⇒ 汉堡**排除 `exchange`**、**恢复 `reward`/`task`**（二者已不在底栏，去重理由消失；不恢复 ⇒ 移动端丢两入口 = 功能回归）。
// 仅用于**移动面板渲染时的局部过滤**；下方 `menuItems`（单一真源）与桌面 `<nav>` 一字不动。
const MOBILE_PANEL_EXCLUDED_PATHS = ['exchange']

const Header = () => {
  const { t } = useTranslation()
  const { user: currentUser, isAuthenticated, logout } = useAuth()
  const [balanceRows, setBalanceRows] = useState([])
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPath, setAdminPath] = useState('/dashboard')

  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light'
    setIsDark(theme === 'dark')
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {
      if (!currentUser) {
        if (!cancelled) {
          setIsAdmin(false)
          setAdminPath('/dashboard')
          setBalanceRows([])
        }
        return
      }

      try {
        const access = await fetchAdminAccess(currentUser)
        if (!cancelled) {
          setIsAdmin(access.can_access_admin)
          setAdminPath(access.preferred_admin_path || '/dashboard')
        }
      } catch (error) {
        if (!cancelled) {
          setIsAdmin(false)
          setAdminPath('/dashboard')
        }
      }

      await loadBalances(currentUser)
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [currentUser])

  // 余额区（2026-10-20 · Kevin）：**多币种分行**，只显示有余额的币种。
  // 读口优先级：`/api/user/balances`（登录）⇒ 失败 / 未登录 / 非数组 ⇒ 回落既有
  // `/api/user/asset/:uID` 的 `$` 单行（不得白屏）。金额一律由字符串格式化，不经 Number 累加。
  const loadBalances = async (userData = currentUser) => {
    try {
      const rows = await fetchUserBalances()
      if (Array.isArray(rows)) {
        setBalanceRows(toBalanceRows(rows))
        return
      }
    } catch (error) {
      console.warn('Failed to load user balances:', error)
    }

    // 降级：既有资产读口 ⇒ 单行 `$`
    try {
      if (userData?.uID) {
        const response = await fetch(`/api/user/asset/${userData.uID}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setBalanceRows([
              { key: 'fallback:usd', symbol: '$', amount: formatBalanceAmount(data.data.points || 0) },
            ])
            return
          }
        }
      }
      setBalanceRows([])
    } catch (error) {
      console.warn('Failed to load user points:', error)
      setBalanceRows([])
    }
  }

  // 获取当前语言
  const getCurrentLang = () => getLanguageFromUrl(location.pathname)

  // 切换语言：先剥离已有（可能重复的）语言前缀，再按目标语言重建
  const changeLanguage = (lang) => {
    navigate(`${buildLangPath(location.pathname, lang)}${location.search}${location.hash}`)
  }

  // 处理登出
  const handleLogout = () => {
    logout()
    setIsAdmin(false)
    setAdminPath('/dashboard')
    setBalanceRows([])
    navigate(buildLocalizedPath(getCurrentLang(), '/'))
  }

  // 处理登录
  const handleLogin = () => {
    // 打开登录模态框而不是跳转页面
    window.dispatchEvent(new CustomEvent('openLoginModal'))
  }

  // 处理注册
  const handleRegister = () => {
    navigate(buildLocalizedPath(getCurrentLang(), '/register'))
  }

  // 菜单项
  // R-9-84/R-9-85：「我的」入口不在左侧 nav（R-9-84 移出后并入右上角单一菜单按钮）；
  // 左侧 nav 仅存 任务/市场（+ 管理后台 仅管理员）。
  // ★ 2026-10-11 合并单：**删「社区奖励」项**（`reward` ⇒ 原 `/reward` 页已随 `RewardPage` 删除硬删）
  //   ⇒ 桌面左 nav = [社区任务, 市场]；移动面板 = 同一 `menuItems` − `exchange` = [社区任务]。
  // 菜单项（Kevin 2026-10-21 需求②：三项均带图标 = 底栏同款尺寸 16px）
  //   · 悬赏 = `Gift`（底栏无此格；与「市场 Store」同族线性图标）
  //   · 市场 = `Store`（与底栏 shard 同款，保持一致）
  //   · 管理面板 = `ShieldCheck`；★ 本单删「管理面板紫底特殊样式」⇒ 与其它项同渲染、
  //     零条件类名（原 `startsWith('/dashboard') ? bg-purple-600 …` 已移除）。
  const menuItems = [
    { path: 'task', label: t('task'), icon: Gift },
    { path: 'exchange', label: t('shard'), icon: Store },
    ...(isAuthenticated && isAdmin ? [{ path: adminPath, label: t('admin_panel'), icon: ShieldCheck, absolute: true }] : [])
  ]

  // 构建带语言前缀的路径（前缀逻辑统一走 utils，避免自造前缀/尾斜杠）
  const buildPath = (path) => {
    // dashboard 路径不需要语言前缀
    if (path === 'dashboard' || path.startsWith('/dashboard')) {
      return path.startsWith('/dashboard') ? path : '/dashboard'
    }

    return buildLangPath(`/${path}`, getCurrentLang())
  }

  // 钱包地址缩写（R-9-85：合并后右上角**唯一**菜单按钮的文案 = 地址缩写，沿用既有派生）
  // 数据派生沿用既有形态（0x + 6 位 + `...` + 4 位），非文案 ⇒ 零 i18n 新增键。
  const walletShort = currentUser?.EVM
    ? `${currentUser.EVM.slice(0, 6)}...${currentUser.EVM.slice(-4)}`
    : ''

  // 语言对应国旗映射
  const flagByLang = {
    zh: cnFlag,
    en: usFlag,
    hk: hkFlag,
    vn: vnFlag,
  }

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  return (
    <>
      <header id="header" className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-md backdrop-blur-sm bg-opacity-95">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to={buildPath('')} className="sf-tap-inline sf-topbar-brand text-xl font-bold">
              {t('siteBrand')}
            </Link>
          </div>
          
          {/* 统一的导航区域 - 将所有菜单项组合在一起 */}
          <div className="hidden md:flex items-center space-x-4">
            {/* 桌面导航 */}
            <nav className="flex space-x-1 mr-4">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={buildPath(item.path)}
                    className={`nav-link inline-flex items-center gap-1.5 ${location.pathname.includes(item.path) ? 'active' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            
            {/* Kevin 2026-10-14 需求①：右上角「订单」按钮（图标 + 文案），指向 /profile（落地即我的交易）。
                未登录同样可点 ⇒ 由既有 ProtectedRoute 出登录引导；复用既有头部控件类 nav-link（不动桌面按钮几何）。 */}
            <Link
              to={buildPath('profile')}
              className="nav-link"
              data-sf-m="header-orders"
              aria-label={t('header.orders')}
              title={t('header.orders')}
            >
              <img src={orderIcon} alt="" className="inline-block w-4 h-4" aria-hidden="true" />
              <span>{t('header.orders')}</span>
            </Link>

            {/* 语言切换（使用本地 SVG 国旗图标） */}
            <HoverMenu
              trigger={
                <button className="flex items-center space-x-1 nav-link">
                  <img
                    src={flagByLang[getCurrentLang()]}
                    alt={t('language')}
                    className="inline-block w-5 h-3 rounded-sm shadow-sm"
                  />
                  <span>{t('language')}</span>
                  <ChevronDown size={16} />
                </button>
              }
            >
              <button
                onClick={() => changeLanguage('zh')}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getCurrentLang() === 'zh' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''}`}
              >
                <img src={cnFlag} alt={t('chinese')} className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                {t('chinese')}
              </button>
              <button
                onClick={() => changeLanguage('en')}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getCurrentLang() === 'en' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''}`}
              >
                <img src={usFlag} alt="English" className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                {t('english')}
              </button>
              <button
                onClick={() => changeLanguage('hk')}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getCurrentLang() === 'hk' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''}`}
              >
                <img src={hkFlag} alt={t('cantonese')} className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                {t('cantonese')}
              </button>
              <button
                onClick={() => changeLanguage('vn')}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${getCurrentLang() === 'vn' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''}`}
              >
                <img src={vnFlag} alt="Tiếng Việt" className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                {t('vietnamese')}
              </button>
            </HoverMenu>

            {/* 深夜模式（Dark Mode）切换按钮 - 图标方式 */}
            <button
              onClick={toggleTheme}
              className="nav-link"
              aria-label={t('darkMode')}
              title={t('darkMode')}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* R-9-85：右上角合并为唯一菜单按钮 —— 原 R-9-84 那个独立直入 /profile 的 Link 已删除
                （⇒ 右上角仅存此一个控件）。按钮 = User 图标 + 钱包地址缩写（既有派生）+ ChevronDown；
                仍用既有 HoverMenu（它就是「菜单按钮」：点开 / 悬停展开）。 */}
            {isAuthenticated ? (
              <HoverMenu
                trigger={
                  <button
                    className="flex items-center space-x-1 nav-link"
                    data-sf-m="header-user-menu"
                    aria-label={walletShort}
                    title={walletShort}
                  >
                    <User size={18} />
                    <span className="truncate max-w-[120px]">{walletShort}</span>
                    <ChevronDown size={16} />
                  </button>
                }
              >
                {/* 余额区（2026-10-20 · Kevin）：**每种币种一行** `$12,234` / `€21,345`，
                    只渲染余额 > 0 的币种（后端已按 cid 升序、`$` 在首位）；不再有「积分」文案。
                    排版：左对齐、行高 24px、等宽数字（tabular-nums）、14px；符号与数字同色、符号加粗。
                    无行可渲染（尚未取到 / 全部为 0）⇒ 整块不渲染（不留空框）。
                    2026-10-21 · Kevin 需求①：**每一行本身是链接** ⇒ 点击进「我的资产」（`/profile/assets`，
                    带语言前缀，走 `buildPath`）。整行可点（行高 ≥24px + hover 底色）、`<a>` 原生键盘可聚焦；
                    金额格式化与货币顺序一字不改（仍来自 `toBalanceRows`）。 */}
                {balanceRows.length > 0 && (
                  <div
                    className="py-2 border-b border-gray-200 dark:border-gray-700"
                    data-sf-m="header-balances"
                  >
                    <ul className="m-0 list-none p-0 text-left">
                      {balanceRows.map((row) => (
                        <li key={row.key} className="m-0 p-0">
                          <Link
                            to={buildPath('profile/assets')}
                            data-sf-m="header-balance-row"
                            data-symbol={row.symbol}
                            aria-label={`${row.symbol}${row.amount} · ${t('profileNav.assets')}`}
                            className="flex items-center min-h-6 px-4 py-1 text-left text-sm leading-6 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            <span className="font-bold">{row.symbol}</span>{row.amount}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* R-9-85：恢复「个人资料」项（触发器已不再是直达链接 ⇒ 需一条菜单项进个人资料页） */}
                <Link
                  to={buildPath('profile')}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${location.pathname.includes('profile') ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''}`}
                  data-sf-m="header-profile"
                >
                  {t('profile')}
                </Link>
                {/* 2026-10-20 · Kevin：桌面下拉的「签到 · 电量」直达项已删（签到/电量并入 `/wage` 页内，
                    下拉里不再需要）；手机汉堡面板的同项亦于同日删掉 ⇒ 两侧均无 batt-checkin 入口，
                    统一从 `/wage` 页内进。 */}
                <button
                  onClick={handleLogout}
                  data-sf-m="header-logout"
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <LogOut size={16} className="mr-2" />
                  {t('logout')}
                </button>
              </HoverMenu>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleRegister} 
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 sf-topbar-hover-brand-fg transition-colors text-sm font-medium"
                >
                  <UserPlus size={18} />
                  <span>{t('register')}</span>
                </button>
                <button 
                  onClick={handleLogin} 
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 sf-topbar-hover-brand-fg transition-colors text-sm font-medium"
                >
                  <LogIn size={18} />
                  <span>{t('login')}</span>
                </button>
              </div>
            )}
          </div>
          
          {/* 移动端菜单按钮 */}
          <div className="md:hidden flex items-center">
            {/* R-9-85：移动端合并为单一入口（原 R-9-84 新增的独立「我的」Link 已删除）——
                唯一入口 = 既有汉堡按钮；点开后于面板内呈现与桌面同款各项（见下方「移动端用户菜单」）。 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-sf-m="header-mobile-menu"
              className="sf-tap-sq p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* 移动端菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {menuItems.filter((item) => !MOBILE_PANEL_EXCLUDED_PATHS.includes(item.path)).map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={buildPath(item.path)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname.includes(item.path)
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            {/* Kevin 2026-10-14 需求①：移动面板「订单」入口（登录态内外都可见；未登录进 profile 由 ProtectedRoute 出登录引导） */}
            <Link
              to={buildPath('profile')}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
              data-sf-m="header-orders-mobile"
            >
              <img src={orderIcon} alt="" className="inline-block w-4 h-4" aria-hidden="true" />
              {t('header.orders')}
            </Link>
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => {
                    handleRegister()
                    setMobileMenuOpen(false)
                  }}
                  className="sf-tap block w-full text-center px-3 py-2 my-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  {t('register')}
                </button>
                <button
                  onClick={() => {
                    handleLogin()
                    setMobileMenuOpen(false)
                  }}
                  className="sf-tap block w-full text-center px-3 py-2 my-2 rounded-md text-base font-medium bg-yellow-600 text-white hover:bg-yellow-700"
                >
                  {t('login')}
                </button>
              </>
            )}
          </div>
          
          {/* 移动端语言切换（使用本地 SVG 国旗图标） */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('language')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                  onClick={() => {
                    changeLanguage('zh')
                    setMobileMenuOpen(false)
                  }}
                  className={`sf-tap px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'zh' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={cnFlag} alt={t('chinese')} className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('chinese')}
                </button>
              <button
                  onClick={() => {
                    changeLanguage('en')
                    setMobileMenuOpen(false)
                  }}
                  className={`sf-tap px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'en' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={usFlag} alt="English" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('english')}
                </button>
              <button
                  onClick={() => {
                    changeLanguage('hk')
                    setMobileMenuOpen(false)
                  }}
                  className={`sf-tap px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'hk' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={hkFlag} alt={t('cantonese')} className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('cantonese')}
                </button>
              <button
                  onClick={() => {
                    changeLanguage('vn')
                    setMobileMenuOpen(false)
                  }}
                  className={`sf-tap px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'vn' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={vnFlag} alt="Tiếng Việt" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('vietnamese')}
                </button>
            </div>
          </div>
          
          {/* 移动端主题切换 —— **[2026-10-11 · Kevin 口径] 删文案、只图标**（与桌面档 `Header.jsx:236` 同款）。
              Kevin 实测：原状两态都渲染 `t('darkMode')`（「深夜模式」）⇒ 已是夜档时文案语义错。
              现状：不再渲染任何可见文字；可访问名 = `aria-label`（既有键 `darkMode`，与桌面档同名同源），
              当前态由 `aria-pressed={isDark}` 承担（仓内既有写法：见 RatingTimelinessPanel）。同附 `title` 悬停提示。
              R-9-85 不破：本项位于汉堡面板内，**未新增顶栏控件**（顶栏右上仍恰一个 = 用户菜单按钮）。 */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                toggleTheme()
                setMobileMenuOpen(false)
              }}
              className="sf-tap flex items-center w-full px-3 py-2 rounded-md text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('darkMode')}
              aria-pressed={isDark}
              title={t('darkMode')}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* 移动端用户菜单（R-9-85：合并后唯一入口 = 上方汉堡；面板内 = 与桌面同款各项） */}
          {isAuthenticated && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700" data-sf-m="header-user-menu-mobile">
              <Link
                to={buildPath('profile')}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                data-sf-m="header-profile-mobile"
              >
                <User size={18} className="mr-2" />
                {t('profile')}
              </Link>
              <button
                onClick={() => {
                  handleLogout()
                  setMobileMenuOpen(false)
                }}
                data-sf-m="header-logout-mobile"
                className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogOut size={18} className="mr-2" />
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  </>
  )
}

export default Header
