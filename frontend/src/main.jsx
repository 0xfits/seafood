import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// 引入本地样式（用于生产构建打包）
import './styles.css'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './auth-context'
import { ThemeProvider } from './theme/ThemeProvider'

// 初始化主题（尽量在 React 渲染之前执行，减少闪烁）
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
} else if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light')
}

// 设置 HTML 的语言属性，便于按语言使用合适字体与排版
(() => {
  const pathParts = window.location.pathname.split('/')
  const lang = (pathParts.length > 1 && ['en','hk','vn'].includes(pathParts[1])) ? pathParts[1] : 'zh'
  const map = { zh: 'zh-CN', hk: 'zh-HK', vn: 'vi', en: 'en' }
  document.documentElement.setAttribute('lang', map[lang] || 'zh-CN')
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          {/* 主题 Provider 只提供上下文、不产生任何 DOM 节点（日/夜同构的前提之一） */}
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  </React.StrictMode>,
)

// 说明：CSS 通过 ES Module 方式引入，开发环境由 Vite HMR 管理，生产环境由文件指纹避免缓存，无需额外时间戳。
