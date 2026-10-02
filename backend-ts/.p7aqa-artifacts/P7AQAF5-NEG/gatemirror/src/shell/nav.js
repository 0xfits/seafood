import { Briefcase, Gift, Home, Store, User } from 'lucide-react'
import { SUPPORTED_LANGS, stripLangPrefix } from '../utils'

// 导航项**单一真源**：全部来自既有路由实现（frontend/src/App.jsx 的 LangShell 内层 <Routes>）
// 与 docs/route-layer.spec.md v0.9 的前端消费面对应关系，非自造页面名。
//   index   → frontend/src/App.jsx  `<Route index element={<HomePage />} />`（无前缀 / 或 /zh|/en|/hk|/vn）
//   reward  → frontend/src/App.jsx  `path="reward"`（RewardPage，消费 /api/prize/*）
//   task    → frontend/src/App.jsx  `path="task"`（TaskPage，消费 /api/task*）
//   shard   → frontend/src/App.jsx  `path="shard"`（ShardPage = 积分交易所，消费 /api/order*、/api/shard*）
//   profile → frontend/src/App.jsx  `path="profile"`（受保护；与 Header 同一条登录可见规则）
// labelKey 全部取自四语 locale 既有键（zh/en/hk/vn 各 69 键同集）。
export const SHELL_NAV_ITEMS = [
  { key: 'home', path: '', route: 'index', labelKey: 'home', icon: Home },
  { key: 'reward', path: 'reward', route: 'reward', labelKey: 'reward', icon: Gift },
  { key: 'task', path: 'task', route: 'task', labelKey: 'task', icon: Briefcase },
  { key: 'shard', path: 'shard', route: 'shard', labelKey: 'shard', icon: Store },
  { key: 'profile', path: 'profile', route: 'profile', labelKey: 'profile', icon: User, requiresAuth: true },
]

export const SHELL_NAV_KEYS = SHELL_NAV_ITEMS.map((item) => item.key)

// 顶栏（Header）与底栏（BottomTabBar）共用同一份可见性规则 ⇒ 同一套组件、同一元素顺序。
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
