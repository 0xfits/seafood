import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import BottomTabBar from './BottomTabBar'
import './shell.css'

// 应用外壳（shell）：顶部导航 → 路由容器 → 页脚 → 底部 tab。
// 元素顺序恒定、两种屏型与两个主题都渲染**同一套 DOM**；
// 屏型差异只由 shell.css 的断点（栅格/导航形态）承担，主题差异只由 token 值承担。
// 四语切换入口 = 顶栏 Header 内既有开关（复用 4b-i 的 buildLangPath/SUPPORTED_LANGS 机制，不另造一套）。
const AppShell = ({ children }) => (
  <div className="sf-shell" data-sf-shell="app" data-sf-region="shell">
    <div className="sf-region sf-region-top" data-sf-region="topnav">
      <Header />
    </div>
    <main id="sf-route-container" className="sf-route-container" data-sf-region="content">
      {children}
    </main>
    <div className="sf-region sf-region-foot" data-sf-region="footer">
      <Footer />
    </div>
    <BottomTabBar />
  </div>
)

export default AppShell
