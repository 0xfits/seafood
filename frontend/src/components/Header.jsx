import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Popover, Transition } from '@headlessui/react'
import { Menu, X, User, LogOut, LogIn, ChevronDown, Moon, Sun } from 'lucide-react'
import cnFlag from '../images/cn.svg'
import usFlag from '../images/us.svg'
import hkFlag from '../images/hk.svg'
import vnFlag from '../images/vn.svg'

const Header = () => {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // 检查用户登录状态
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setIsLoggedIn(true)
      setCurrentUser(JSON.parse(user))
    }
    // 初始化主题
    const savedTheme = localStorage.getItem('theme')
    const current = savedTheme || (document.documentElement.getAttribute('data-theme') || 'light')
    if (current === 'dark') {
      setIsDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      setIsDark(false)
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [])

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 切换语言
  const changeLanguage = (lang) => {
    const currentPath = location.pathname
    let newPath = ''
    
    if (currentPath.startsWith('/' + getCurrentLang() + '/')) {
      newPath = currentPath.replace('/' + getCurrentLang() + '/', '/' + lang + '/')
    } else if (currentPath === '/') {
      newPath = lang === 'zh' ? '/' : '/' + lang
    } else {
      newPath = lang === 'zh' ? currentPath : '/' + lang + currentPath
    }
    
    navigate(newPath)
  }

  // 处理登出
  const handleLogout = () => {
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setCurrentUser(null)
    navigate('/')
  }

  // 处理登录
  const handleLogin = () => {
    navigate('/login')
  }

  // 菜单项
  const menuItems = [
    { path: 'reward', label: t('reward') },
    { path: 'task', label: t('task') },
    ...(isLoggedIn ? [{ path: 'profile', label: t('profile') }] : [])
  ]

  // 构建带语言前缀的路径
  const buildPath = (path) => {
    const currentLang = getCurrentLang()
    if (currentLang === 'zh') {
      return path === '' ? '/' : `/${path}`
    }
    return `/${currentLang}/${path}`
  }

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
    <header id="header" className="bg-bg-primary border-b border-border-color sticky top-0 z-50 shadow-md backdrop-blur-sm bg-opacity-95">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to={buildPath('')} className="text-xl font-bold text-primary">
              {t('siteTitle')}
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
                  className={`nav-link ${location.pathname.includes(item.path) ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            
            {/* 语言切换（使用本地 SVG 国旗图标） */}
            <Popover className="relative">
              <Popover.Button className="flex items-center space-x-1 nav-link">
                <img
                  src={flagByLang[getCurrentLang()]}
                  alt={t('language')}
                  className="inline-block w-5 h-3 rounded-sm shadow-sm"
                />
                <span>{t('language')}</span>
                <ChevronDown size={16} />
              </Popover.Button>
              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Popover.Panel className="absolute right-0 mt-2 w-48 bg-bg-primary rounded-lg shadow-lg border border-border-color py-1">
                  <button
                    onClick={() => changeLanguage('zh')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'zh' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <img src={cnFlag} alt="中文" className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                    {t('chinese')}
                  </button>
                  <button
                    onClick={() => changeLanguage('en')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'en' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <img src={usFlag} alt="English" className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                    {t('english')}
                  </button>
                  <button
                    onClick={() => changeLanguage('hk')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'hk' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <img src={hkFlag} alt="粵語" className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                    {t('cantonese')}
                  </button>
                  <button
                    onClick={() => changeLanguage('vn')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'vn' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <img src={vnFlag} alt="Tiếng Việt" className="inline-block w-5 h-3 mr-2 align-middle rounded-sm shadow-sm" />
                    {t('vietnamese')}
                  </button>
                </Popover.Panel>
              </Transition>
            </Popover>

            {/* 深夜模式（Dark Mode）切换按钮 - 图标方式 */}
            <button
              onClick={toggleTheme}
              className="nav-link"
              aria-label={t('darkMode')}
              title={t('darkMode')}
            >
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            
            {/* 用户菜单 */}
            {isLoggedIn ? (
              <Popover className="relative">
                <Popover.Button className="flex items-center space-x-1 nav-link">
                  <User size={18} />
                  <span className="truncate max-w-[120px]">
                    {currentUser?.EVM ? `${currentUser.EVM.slice(0, 6)}...${currentUser.EVM.slice(-4)}` : ''}
                  </span>
                  <ChevronDown size={16} />
                </Popover.Button>
                <Transition
                  as={React.Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Popover.Panel className="absolute right-0 mt-2 w-48 bg-bg-primary rounded-lg shadow-lg border border-border-color py-1">
                    <Link
                      to={buildPath('profile')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted"
                    >
                      {t('profile')}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-error hover:bg-bg-muted"
                    >
                      <LogOut size={16} className="mr-2" />
                      {t('logout')}
                    </button>
                  </Popover.Panel>
                </Transition>
              </Popover>
            ) : (
              <button 
                onClick={handleLogin} 
                className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors text-sm font-medium"
              >
                <LogIn size={18} />
                <span>{t('login')}</span>
              </button>
            )}
          </div>
          
          {/* 移动端菜单按钮 */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-muted focus:outline-none"
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
        <div className="md:hidden bg-bg-primary border-t border-border-color">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={buildPath(item.path)}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname.includes(item.path) ? 'bg-bg-muted' : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary'}`}
              >
                {item.label}
              </Link>
            ))}
            {!isLoggedIn && (
              <button
                onClick={() => {
                  handleLogin()
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-center px-3 py-2 my-2 rounded-md text-base font-medium bg-primary text-white hover:bg-primary/90"
              >
                {t('login')}
              </button>
            )}
          </div>
          
          {/* 移动端语言切换（使用本地 SVG 国旗图标） */}
          <div className="px-4 py-3 border-t border-border-color">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">{t('language')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                  onClick={() => {
                    changeLanguage('zh')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'zh' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <img src={cnFlag} alt="中文" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('chinese')}
                </button>
                <button
                  onClick={() => {
                    changeLanguage('en')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'en' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <img src={usFlag} alt="English" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('english')}
                </button>
                <button
                  onClick={() => {
                    changeLanguage('hk')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'hk' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <img src={hkFlag} alt="粵語" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('cantonese')}
                </button>
                <button
                  onClick={() => {
                    changeLanguage('vn')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'vn' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <img src={vnFlag} alt="Tiếng Việt" className="inline-block w-5 h-3 mr-2 rounded-sm shadow-sm" />
                  {t('vietnamese')}
                </button>
            </div>
          </div>
          
          {/* 移动端深夜模式切换 */}
          <div className="px-4 py-3 border-t border-border-color">
            <button
              onClick={() => {
                toggleTheme()
                setMobileMenuOpen(false)
              }}
              className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium hover:bg-bg-muted"
            >
              {isDark ? <Moon size={18} className="mr-2" /> : <Sun size={18} className="mr-2" />}
              {t('darkMode')}
            </button>
          </div>

          {/* 移动端用户菜单 */}
          {isLoggedIn && (
            <div className="px-4 py-3 border-t border-border-color">
              <button
                onClick={() => {
                  handleLogout()
                  setMobileMenuOpen(false)
                }}
                className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium text-error hover:bg-bg-muted"
              >
                <LogOut size={18} className="mr-2" />
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

export default Header