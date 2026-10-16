import React from 'react'
import { useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import BottomTabBar from './BottomTabBar'
import FloatingMenu from './FloatingMenu'
import MessagesPanel from './MessagesPanel'
import { isMessagesPanelOpen } from './messages-panel-routing'
// T103 未读角标共享态（v1.17 §20.6）：外壳层提供，底栏与桌面悬浮菜单同源消费。
// Provider 只提供上下文、**不产生任何 DOM 节点**（日/夜 · 横竖屏同构的前提之一）。
import { UnreadProvider } from './unread-context'
import './shell.css'

// 应用外壳（shell）：顶部导航 → 路由容器 → 页脚 → 底部 tab。
// 元素顺序恒定、两种屏型与两个主题都渲染**同一套 DOM**；
// 屏型差异只由 shell.css 的断点（栅格/导航形态）承担，主题差异只由 token 值承担。
// 四语切换入口 = 顶栏 Header 内既有开关（复用 4b-i 的 buildLangPath/SUPPORTED_LANGS 机制，不另造一套）。
// ★ v1.19 §21（消息面板化 · 方案 1「就地叠加」/ `T104`–`T108`）：消息**不做独立页面** ⇒ 面板挂载点 = **此处单源**
//   （判据 = `T105` 单一真源 `isMessagesPanelOpen`，路由串匹配；与面板组件共用同一份 ⇒ 零判据分叉）；
//   未打开态 ⇒ **条件挂载**（DOM 与改前逐字相同、零回归面）；打开态 ⇒ 修饰类 `sf-shell--msg-open`
//   （让位规则落 `shell/messages-panel.css`，`shell.css` 一字不动）。
const AppShell = ({ children }) => {
  const location = useLocation()
  const panelOpen = isMessagesPanelOpen(location)

  return (
    <UnreadProvider>
      <div
        className={`sf-shell${panelOpen ? ' sf-shell--msg-open' : ''}`}
        data-sf-shell="app"
        data-sf-region="shell"
      >
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
        <FloatingMenu />
        {panelOpen ? <MessagesPanel /> : null}
      </div>
    </UnreadProvider>
  )
}

export default AppShell
