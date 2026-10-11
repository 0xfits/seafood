import { Home, Store, PlusCircle, MessageCircle, User } from 'lucide-react'
import { SUPPORTED_LANGS, stripLangPrefix } from '../utils'

// 导航项**单一真源**：底栏（H5）五项；全部来自既有路由实现（frontend/src/App.jsx 的 LangShell 内层 <Routes>）
// 与 docs/route-layer.spec.md v2.27 §37 的前端消费面对应关系，非自造页面名。
//   home     → frontend/src/App.jsx  `<Route index element={<HomePage />} />`（无前缀 / 或 /zh|/en|/hk|/vn）
//   shard    → frontend/src/App.jsx  `path="exchange"`（ShardPage = 积分交易所，消费 /api/order*、/api/shard*）
//              · 页面路径 2026-10-03 由 `/shard` 改名单为 `/exchange`；`key`/`labelKey` 保持 `'shard'`（文案键不变）
//              · 旧 `/shard` 由 App.jsx 的 `LegacyExchangeRedirect`（一条 `<Navigate>`）兼容重定向到同语言前缀下
//   sell     → frontend/src/App.jsx  `path="listing/new"`（PublishListingPage = 发布页，复用既有）
//   messages → frontend/src/App.jsx  `path="messages"`（MessagesPage）· **本轮新登记路由 `/messages`**（占位页 · X/推特接驳位预留）
//   profile  → frontend/src/App.jsx  `path="profile"`（受保护；与 Header 同一条登录可见规则）
// labelKey 全部取自四语 locale 既有键（zh/en/hk/vn 各同集）。
// ★ 第 5 项（底栏⑤）文案口径 —— [留痕] 2026-10-11 · Kevin 同意「全站统一」：
//   前一版（Zang 裁定⑧）曾另立新键 `me` 只服务底栏⑤、`profile` 值保持「个人资料」；**本单按 Kevin 口径废除该做法**：
//   `profile` 键值改为 **我的 / Me / 我的 / Tôi**（全站统一），`labelKey` **回 `'profile'`**
//   （`key` / `path` / `requiresAuth` 仍 `profile`，逐字不动）；**`me` 键已删**（避免两键同义）。
//   ⇒ `Header.jsx:284` 桌面下拉 / `:460` 移动面板 同键同值，一并显示「我的」；`r9-84-profile-entry.test.jsx` 锚已同步改锚。
export const SHELL_NAV_ITEMS = [
  { key: 'home', path: '', route: 'index', labelKey: 'home', icon: Home },
  { key: 'shard', path: 'exchange', route: 'exchange', labelKey: 'shard', icon: Store },
  { key: 'sell', path: 'listing/new', route: 'listing/new', labelKey: 'sell', icon: PlusCircle },
  { key: 'messages', path: 'messages', route: 'messages', labelKey: 'messages', icon: MessageCircle },
  { key: 'profile', path: 'profile', route: 'profile', labelKey: 'profile', icon: User, requiresAuth: true },
]

export const SHELL_NAV_KEYS = SHELL_NAV_ITEMS.map((item) => item.key)

// 底栏（BottomTabBar）取本文件可见性规则（底栏五项；home 由底栏显式项承担）。
export const visibleNavItems = (isAuthenticated) =>
  SHELL_NAV_ITEMS.filter((item) => !item.requiresAuth || isAuthenticated)

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
