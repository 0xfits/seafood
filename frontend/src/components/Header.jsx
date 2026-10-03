import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, LogIn, UserPlus, ChevronDown, Moon, Sun } from 'lucide-react'
import cnFlag from '../images/cn.svg'
import usFlag from '../images/us.svg'
import hkFlag from '../images/hk.svg'
import vnFlag from '../images/vn.svg'
import HoverMenu from './ui/HoverMenu'
import DashJ from './ui/DashJ'
import { fetchAdminAccess } from '../admin-utils'
import { useAuth } from '../auth-context'
import {buildLocalizedPath, buildLangPath, getLanguageFromUrl} from '../utils'

const Header = () => {
  const { t } = useTranslation()
  const { user: currentUser, isAuthenticated, logout } = useAuth()
  const [userPoints, setUserPoints] = useState(0)
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
          setUserPoints(0)
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

      await loadUserPoints(currentUser)
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [currentUser])

  // 获取用户积分
  const loadUserPoints = async (userData = currentUser) => {
    try {
      if (userData?.uID) {
        const response = await fetch(`/api/user/asset/${userData.uID}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setUserPoints(data.data.points || 0)
            return
          }
        }
      }
      setUserPoints(0)
    } catch (error) {
      console.warn('Failed to load user points:', error)
      setUserPoints(0)
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
    setUserPoints(0)
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
  // R-9-84/R-9-85：「我的」入口不在左侧 nav（R-9-84 移出后并入右上角单一菜单按钮，见下方
  // buildPath('profile') 下拉项）；路由与 ProtectedRoute 一字不动；
  // 左侧 nav 仅存 奖励/任务/碎片（+ 管理后台 仅管理员）。
  const menuItems = [
    { path: 'reward', label: t('reward') },
    { path: 'task', label: t('task') },
    { path: 'shard', label: t('shard') },
    ...(isAuthenticated && isAdmin ? [{ path: adminPath, label: t('admin_panel'), absolute: true }] : [])
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
            <Link to={buildPath('')} className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
              {t('siteBrand')}
            </Link>
          </div>
          
          {/* 统一的导航区域 - 将所有菜单项组合在一起 */}
          <div className="hidden md:flex items-center space-x-4">
            {/* 桌面导航 */}
            <nav className="flex space-x-1 mr-4">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={buildPath(item.path)}
                  className={`nav-link ${location.pathname.includes(item.path) ? 'active' : ''} ${
                    item.path.startsWith('/dashboard') ? 'bg-purple-600 text-white hover:bg-purple-700 px-3 py-2 rounded-md font-medium' : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            
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
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
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
                {/* 用户积分显示 */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {t('common.communityPoints')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-900 dark:text-white font-medium">
                        {userPoints.toLocaleString()}
                      </span>
                      <DashJ size="lg" />
                    </div>
                  </div>
                </div>
                
                {/* R-9-85：恢复「个人资料」项（触发器已不再是直达链接 ⇒ 需一条菜单项进个人资料页） */}
                <Link
                  to={buildPath('profile')}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${location.pathname.includes('profile') ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''}`}
                  data-sf-m="header-profile"
                >
                  {t('profile')}
                </Link>
                {/* R-9-83：直达电量 + 签到区（锚点 `#batt-checkin`），提升签到入口可发现性。
                    标签复用既有文案键（签到 + 电量），不新增顶层导航项、不新增 i18n 键。 */}
                <Link
                  to={`${buildPath('profile')}#batt-checkin`}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  data-sf-m="header-batt-checkin"
                >
                  {t('checkinPanel.checkinButton')} · {t('battCard.title')}
                </Link>
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
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors text-sm font-medium"
                >
                  <UserPlus size={18} />
                  <span>{t('register')}</span>
                </button>
                <button 
                  onClick={handleLogin} 
                  className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors text-sm font-medium"
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
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
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
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={buildPath(item.path)}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  item.path === 'dashboard' 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : location.pathname.includes(item.path) 
                      ? 'bg-gray-100 dark:bg-gray-700' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => {
                    handleRegister()
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-center px-3 py-2 my-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  {t('register')}
                </button>
                <button
                  onClick={() => {
                    handleLogin()
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-center px-3 py-2 my-2 rounded-md text-base font-medium bg-yellow-600 text-white hover:bg-yellow-700"
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
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'zh' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={cnFlag} alt={t('chinese')} className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('chinese')}
                </button>
              <button
                  onClick={() => {
                    changeLanguage('en')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'en' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={usFlag} alt="English" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('english')}
                </button>
              <button
                  onClick={() => {
                    changeLanguage('hk')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'hk' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={hkFlag} alt={t('cantonese')} className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('cantonese')}
                </button>
              <button
                  onClick={() => {
                    changeLanguage('vn')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'vn' ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <img src={vnFlag} alt="Tiếng Việt" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('vietnamese')}
                </button>
            </div>
          </div>
          
          {/* 移动端深夜模式切换 */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                toggleTheme()
                setMobileMenuOpen(false)
              }}
              className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isDark ? <Moon size={18} className="mr-2" /> : <Sun size={18} className="mr-2" />}
              {t('darkMode')}
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
              <Link
                to={`${buildPath('profile')}#batt-checkin`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                data-sf-m="header-batt-checkin-mobile"
              >
                {t('checkinPanel.checkinButton')} · {t('battCard.title')}
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
