import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { buildLangPath, getLanguageFromUrl } from '../utils'

// 联系邮箱为品牌常量：仅标签走 t()，邮箱本体保持字面量（P6-I18N-LIT-B1）
const CONTACT_EMAIL = 'contact@jinli.club'

// 合作品牌（P6-I18N-LIT-B1）：品牌中文 slogan 不译 => 四语同值（语言不变式）；
// 随机选中项在模块加载时固定，避免每次渲染换文案。
const CAT_SLOGAN_KEYS = ['footer.catSlogan1', 'footer.catSlogan2', 'footer.catSlogan3']
const randomCatSloganKey = CAT_SLOGAN_KEYS[Math.floor(Math.random() * CAT_SLOGAN_KEYS.length)]

// 合作品牌数据
const partnerBrands = [
  {
    name: 'CAT',
    url: 'https://catcat.meme',
    image: '/images/partners/CAT_banner.png',
    descriptionKey: randomCatSloganKey
  },
  {
    name: 'CloudPlan',
    url: 'https://www.yunduojihua.com',
    image: '/images/partners/CloudPlan_banner.png',
    descriptionKey: 'footer.cloudSlogan'
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
                title={t(brand.descriptionKey)}
                className="group block rounded-lg overflow-hidden relative"
              >
                <div className="bg-bg-primary border border-border-color border-l-[5px] border-l-border hover:border-l-[#b6beca] transition-colors duration-300 image-area group-hover:shadow-md">
                  <img
                    src={brand.image}
                    alt={t(brand.descriptionKey) || brand.name}
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
              className={`sf-tap-inline text-sm ${getCurrentLang() === lang.code ? 'text-primary font-medium' : 'text-text-secondary hover:text-text-primary'}`}
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
            {t('footer.websiteLanguages')}
          </p>
        </div>
        
        {/* 联系信息 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-text-secondary">
            {t('footer.contact', { email: CONTACT_EMAIL })}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
