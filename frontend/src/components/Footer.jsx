import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { buildLangPath, getLanguageFromUrl } from '../utils'

// CAT 品牌描述文案（随机选择）
const catDescriptions = [
  '猫猫大使团｜不止一份报酬，更加一份经验。',
  '猫猫大使团｜你的声音，值得被品牌听见。',
  '你的代言，从猫猫大使团开始。'
]

// 获取随机描述
const getRandomCatDescription = () => {
  const randomIndex = Math.floor(Math.random() * catDescriptions.length)
  return catDescriptions[randomIndex]
}

// 合作品牌数据
const partnerBrands = [
  {
    name: 'CAT',
    url: 'https://catcat.meme',
    image: '/images/partners/CAT_banner.png',
    description: getRandomCatDescription()
  },
  {
    name: 'CloudPlan',
    url: 'https://www.yunduojihua.com',
    image: '/images/partners/CloudPlan_banner.png',
    description: '云朵计划｜播种童年梦想，浇灌美和希望。'
  }
]

const Footer = () => {
  const { t } = useTranslation()
  const location = useLocation()

  // 获取当前语言
  const getCurrentLang = () => getLanguageFromUrl(location.pathname)

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
        {/* 合作品牌 */}
        <div className="mb-8">
          <h3 className="text-center text-lg font-semibold text-text-primary mb-6"></h3>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {partnerBrands.map((brand) => (
              <a
                key={brand.name}
                href={brand.url}
                target="_blank"
                rel="noopener noreferrer"
                title={brand.description}
                className="group block rounded-lg overflow-hidden relative"
              >
                <div className="bg-bg-primary border border-border-color border-l-[5px] border-l-border hover:border-l-[#b6beca] transition-colors duration-300 image-area group-hover:shadow-md">
                  <img
                    src={brand.image}
                    alt={brand.description || brand.name}
                    width="160"
                    height="50"
                    className="h-[50px] w-auto object-contain"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>

        
        
        {/* 语言链接 */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {languages.map((lang) => (
            <Link
              key={lang.code}
              to={`${buildLangPath(location.pathname, lang.code)}${location.search}${location.hash}`}
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
