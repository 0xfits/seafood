import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

const Footer = () => {
  const { t } = useTranslation()
  const location = useLocation()

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 构建带语言前缀的路径
  const buildPath = (path, lang) => {
    if (lang === 'zh') {
      return path === '' ? '/' : `/${path}`
    }
    return `/${lang}/${path}`
  }

  // 语言列表
  const languages = [
    { code: 'zh', label: t('chinese') },
    { code: 'en', label: t('english') },
    { code: 'hk', label: t('cantonese') },
    { code: 'vn', label: t('vietnamese') }
  ]

  return (
    <footer className="bg-bg-secondary border-t border-border-color">
      <div className="container mx-auto px-4 py-8">
        {/* 语言链接 */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {languages.map((lang) => (
            <Link
              key={lang.code}
              to={buildPath('', lang.code)}
              className={`text-sm ${getCurrentLang() === lang.code ? 'text-primary font-medium' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {lang.label}
            </Link>
          ))}
        </div>
        
        {/* 版权信息 */}
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            {t('copyright')}
          </p>
          <p className="text-xs text-text-muted mt-2">
            {getCurrentLang() === 'zh' && '本网站支持简体中文、英文、粤语和越南语。'} 
            {getCurrentLang() === 'en' && 'This website supports Simplified Chinese, English, Cantonese and Vietnamese.'} 
            {getCurrentLang() === 'hk' && '本網站支持簡體中文、英文、粵語和越南語。'} 
            {getCurrentLang() === 'vn' && 'Trang web này hỗ trợ tiếng Trung giản thế, tiếng Anh, tiếng Quảng Đông và tiếng Việt.'}
          </p>
        </div>
        
        {/* 联系信息 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-text-secondary">
            {getCurrentLang() === 'zh' && '联系我们：contact@jinli.club'} 
            {getCurrentLang() === 'en' && 'Contact us: contact@jinli.club'} 
            {getCurrentLang() === 'hk' && '聯繫我們：contact@jinli.club'} 
            {getCurrentLang() === 'vn' && 'Liên hệ với chúng tôi: contact@jinli.club'}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer