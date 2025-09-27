import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Popover, Transition } from '@headlessui/react'
import { Menu, X, Globe, User, LogOut, LogIn, ChevronDown } from 'lucide-react'

const Header = () => {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 检查用户登录状态
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      setIsLoggedIn(true)
      setCurrentUser(JSON.parse(user))
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

  return (
    <header className="bg-bg-primary border-b border-border-color sticky top-0 z-50 shadow-md backdrop-blur-sm bg-opacity-95">
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
            
            {/* 语言切换 */}
            <Popover className="relative">
              <Popover.Button className="flex items-center space-x-1 nav-link">
                <Globe size={18} />
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
                    <span className="inline-block w-4 h-3 mr-2 align-middle">
                      <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                        <rect width="32" height="20" fill="#DE2910"/>
                        <path fill="#FFDE00" d="M16 0l1.6 6.3L26 9.5l-5 4.8L21.4 20 16 16.8 10.6 20 9 14.3 4 9.5 14.4 6.3z"/>
                      </svg>
                    </span>
                    {t('chinese')}
                  </button>
                  <button
                    onClick={() => changeLanguage('en')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'en' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <span className="inline-block w-4 h-3 mr-2 align-middle">
                      <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                        <rect width="32" height="20" fill="#3C3B6E"/>
                        <path d="M0 0h32v20H0z" fill="#3C3B6E"/>
                        <path d="M0 0l16 10L0 20z" fill="#B22234"/>
                        <path d="M32 0L16 10 32 20z" fill="#B22234"/>
                        <path d="M0 10h32" stroke="#FFFFFF" stroke-width="6"/>
                        <path d="M16 0v20" stroke="#FFFFFF" stroke-width="6"/>
                      </svg>
                    </span>
                    {t('english')}
                  </button>
                  <button
                    onClick={() => changeLanguage('hk')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'hk' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <span className="inline-block w-4 h-3 mr-2 align-middle">
                      <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                        <rect width="32" height="20" fill="#DE2910"/>
                        <path fill="#FFDE00" d="M16 0l1.6 6.3L26 9.5l-5 4.8L21.4 20 16 16.8 10.6 20 9 14.3 4 9.5 14.4 6.3z"/>
                        <path d="M20 13c0-1.1-0.9-2-2-2s-2 0.9-2 2s0.9 2 2 2s2-0.9 2-2z" fill="#FFFFFF"/>
                      </svg>
                    </span>
                    {t('cantonese')}
                  </button>
                  <button
                    onClick={() => changeLanguage('vn')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-bg-muted ${getCurrentLang() === 'vn' ? 'bg-bg-muted font-medium' : ''}`}
                  >
                    <span className="inline-block w-4 h-3 mr-2 align-middle">
                      <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                        <rect width="32" height="20" fill="#DE2910"/>
                        <path fill="#FFDE00" d="M16 5l1.6 6.3L26 9.5l-5 4.8L21.4 20 16 16.8 10.6 20 9 14.3 4 9.5 14.4 6.3z"/>
                      </svg>
                    </span>
                    {t('vietnamese')}
                  </button>
                </Popover.Panel>
              </Transition>
            </Popover>
            
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
              <button onClick={handleLogin} className="nav-link btn-primary">
                <LogIn size={18} className="mr-1" />
                {t('login')}
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
          
          {/* 移动端语言切换 */}
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
                  <span className="inline-block w-4 h-3 mr-2">
                    <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="20" fill="#DE2910"/>
                      <path fill="#FFDE00" d="M16 0l1.6 6.3L26 9.5l-5 4.8L21.4 20 16 16.8 10.6 20 9 14.3 4 9.5 14.4 6.3z"/>
                    </svg>
                  </span>
                  {t('chinese')}
                </button>
                <button
                  onClick={() => {
                    changeLanguage('en')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'en' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <span className="inline-block w-4 h-3 mr-2">
                    <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="20" fill="#3C3B6E"/>
                      <path d="M0 0h32v20H0z" fill="#3C3B6E"/>
                      <path d="M0 0l16 10L0 20z" fill="#B22234"/>
                      <path d="M32 0L16 10 32 20z" fill="#B22234"/>
                      <path d="M0 10h32" stroke="#FFFFFF" stroke-width="6"/>
                      <path d="M16 0v20" stroke="#FFFFFF" stroke-width="6"/>
                    </svg>
                  </span>
                  {t('english')}
                </button>
                <button
                  onClick={() => {
                    changeLanguage('hk')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'hk' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <span className="inline-block w-4 h-3 mr-2">
                    <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="20" fill="#DE2910"/>
                      <path fill="#FFDE00" d="M16 0l1.6 6.3L26 9.5l-5 4.8L21.4 20 16 16.8 10.6 20 9 14.3 4 9.5 14.4 6.3z"/>
                      <path d="M20 13c0-1.1-0.9-2-2-2s-2 0.9-2 2s0.9 2 2 2s2-0.9 2-2z" fill="#FFFFFF"/>
                    </svg>
                  </span>
                  {t('cantonese')}
                </button>
                <button
                  onClick={() => {
                    changeLanguage('vn')
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 rounded-md text-sm flex items-center ${getCurrentLang() === 'vn' ? 'bg-bg-muted font-medium' : 'text-text-secondary'}`}
                >
                  <span className="inline-block w-4 h-3 mr-2">
                    <svg viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="20" fill="#DE2910"/>
                      <path fill="#FFDE00" d="M16 5l1.6 6.3L26 9.5l-5 4.8L21.4 20 16 16.8 10.6 20 9 14.3 4 9.5 14.4 6.3z"/>
                    </svg>
                  </span>
                  {t('vietnamese')}
                </button>
            </div>
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