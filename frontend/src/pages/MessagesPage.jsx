import React from 'react'
import HomePage from './HomePage'

// ============================================================================
// `/messages` **直链落点**（design-system.spec v1.19 §21 · `T107` / route-layer.spec v2.34 §44.2）
// ----------------------------------------------------------------------------
// 语义变更（Kevin 2026-10-16 逐字「方案 1 · 就地叠加」）：
//   **真页 ⇒ 直链落点 = 首页 + 面板**（同一面板；底 = 首页）—— 用途 = Telegram 通知链接 / 旧链。
// 本文件**不再自渲染消息界面**：面板由外壳按 `T105` 判据**条件挂载**（`shell/AppShell.jsx`，单源）
//   ⇒ 「就地叠加」（`?msg=1`）与「直链」（`/messages`）两个打开态**共用同一份实现、零判据分叉**。
// 冻结面（一字未改 · 零改锚）：文件名 / `import MessagesPage from './pages/MessagesPage'` /
//   `<Route path="messages" element={<MessagesPage />} />`（`v15-nav-floatmenu.test.jsx:235` / `:236` 现取断言）。
// 三态 / keyset / 空态 / 触控 / 字号逐字保留 ⇒ 全部承接到面板（`shell/MessagesPanel.jsx`，只换宿主）。
// ============================================================================
const MessagesPage = () => <HomePage />

export default MessagesPage
