import { Home, Store, PlusCircle, MessageCircle, User } from 'lucide-react'
import { SUPPORTED_LANGS, stripLangPrefix } from '../utils'

// 导航项**单一真源**：底栏（H5）五项；全部来自既有路由实现（frontend/src/App.jsx 的 LangShell 内层 <Routes>）
// 与 docs/route-layer.spec.md v2.27 §37 的前端消费面对应关系，非自造页面名。
//   home     → frontend/src/App.jsx  `<Route index element={<HomePage />} />`（无前缀 / 或 /zh|/en|/hk|/vn）
//   shard    → frontend/src/App.jsx  `path="exchange"`（ShardPage = 积分交易所，消费 /api/order*、/api/shard*）
//              · 页面路径 2026-10-03 由 `/shard` 改名单为 `/exchange`；`key`/`labelKey` 保持 `'shard'`（文案键不变）
//              · 旧 `/shard` 由 App.jsx 的 `LegacyExchangeRedirect`（一条 `<Navigate>`）兼容重定向到同语言前缀下
//   sell     → frontend/src/App.jsx  `path="item/new"`（PublishItemPage = 发布页；2026-10-11 合并单：原 `listing/new` 改名）
//   messages → frontend/src/App.jsx  `path="messages"`（MessagesPage）· **本轮新登记路由 `/messages`**（占位页 · X/推特接驳位预留）
//   profile  → frontend/src/App.jsx  `path="profile"`（登录保护由 App.jsx ProtectedRoute 承担；底栏恒染，含未登录）
// labelKey 全部取自四语 locale 既有键（zh/en/hk/vn 各同集）。
// ★ 第 5 项（底栏⑤）文案口径 —— [留痕] 2026-10-11 · Kevin 同意「全站统一」：
//   前一版（Zang 裁定⑧）曾另立新键 `me` 只服务底栏⑤、`profile` 值保持「个人资料」；**本单按 Kevin 口径废除该做法**：
//   `profile` 键值改为 **我的 / Me / 我的 / Tôi**（全站统一），`labelKey` **回 `'profile'`**
//   （`key` / `path` 仍 `profile`，逐字不动；当时的 `requiresAuth` 字段已随 2026-10-19 单删除，见下方留痕）；**`me` 键已删**（避免两键同义）。
//   ⇒ `Header.jsx:284` 桌面下拉 / `:460` 移动面板 同键同值，一并显示「我的」；`r9-84-profile-entry.test.jsx` 锚已同步改锚。
export const SHELL_NAV_ITEMS = [
  { key: 'home', path: '', route: 'index', labelKey: 'home', icon: Home },
  { key: 'shard', path: 'exchange', route: 'exchange', labelKey: 'shard', icon: Store },
  { key: 'sell', path: 'item/new', route: 'item/new', labelKey: 'sell', icon: PlusCircle },
  { key: 'messages', path: 'messages', route: 'messages', labelKey: 'messages', icon: MessageCircle },
  { key: 'profile', path: 'profile', route: 'profile', labelKey: 'profile', icon: User },
]

export const SHELL_NAV_KEYS = SHELL_NAV_ITEMS.map((item) => item.key)

// ★ 底栏恒 5 格（含未登录）—— [留痕] 2026-10-19 · Kevin 缺陷单「/_preview 未登录底栏缺【我的】」：
//   前版曾有 `requiresAuth: true` 字段 + `visibleNavItems(isAuthenticated)` 过滤 ⇒ 未登录底栏只剩 4 格；
//   **两者已一并删除**：底栏对全部 5 项恒染（设计真源 T80「底栏恒 5 格」；与消息格先例同口径 ——
//   未登录 ⇒ 渲染、点击走登录引导）。`/profile` 的登录保护由 App.jsx 既有 `ProtectedRoute` 承担
//   （与 messages 直链同口径），**零新增鉴权逻辑**；Header（桌面下拉 / 移动面板）不消费本文件过滤，不受影响。

// 语言段剥离复用 utils 单一真源，避免自造前缀逻辑。
export const navPathInLang = (item, lang) => {
  const rest = item.path ? `/${item.path}` : '/'
  if (SUPPORTED_LANGS.includes(lang) && lang !== 'zh') return `/${lang}${rest}`
  return rest
}

export const isNavItemActive = (pathname, item) => {
  const rest = stripLangPrefix(pathname || '/')
  if (!item.path) return rest === '' || rest === '/'
  return rest === `/${item.path}` || rest.startsWith(`/${item.path}/`)
}
