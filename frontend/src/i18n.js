import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { getLanguageFromUrl } from './utils'

// 多语言资源文件
import zhTranslations from './locales/zh.json'
import enTranslations from './locales/en.json'
import hkTranslations from './locales/hk.json'
import vnTranslations from './locales/vn.json'

// 初始化i18n
const initI18n = () => {
  // 从URL路径获取语言代码（复用路由同一套白名单，含 zh）
  const getLanguageFromPath = () => getLanguageFromUrl(window.location.pathname)

  i18n
    .use(initReactI18next)
    .init({
      resources: {
        zh: {
          translation: zhTranslations
        },
        en: {
          translation: enTranslations
        },
        hk: {
          translation: hkTranslations
        },
        vn: {
          translation: vnTranslations
        }
      },
      lng: getLanguageFromPath(),
      fallbackLng: 'zh',
      interpolation: {
        escapeValue: false
      },
      react: {
        useSuspense: false
      }
    })

  return i18n
}

export default initI18n()