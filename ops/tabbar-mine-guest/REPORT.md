# REPORT · 底栏【我的】未登录不渲染修复 —— 底栏恒 5 格（含未登录）

- 日期：2026-10-19 · 缺陷单：Kevin「http://localhost:5800/_preview 登出的状态下 tabbar 缺失按钮【我的】」
- 范围：`frontend/src/shell/nav.js` + `frontend/src/shell/BottomTabBar.jsx` + 3 个测试文件改锚；**不动 Header、不动 docs/**、**不 push**。

## 修法（= 派单口径，底栏恒 5 格；与设计真源 T80 及消息格先例「未登录 ⇒ 渲染、点击走登录引导」一致）

1. `frontend/src/shell/nav.js`：**删除 `visibleNavItems` 导出**（原 `filter(item => !item.requiresAuth || isAuthenticated)`）；**删除 profile 项的 `requiresAuth: true` 字段**；留痕注释更新（底栏恒 5 格依据 = Kevin 2026-10-19 缺陷单；`/profile` 保护由 App.jsx 既有 `ProtectedRoute` 承担，与 messages 同口径，零新增鉴权逻辑）。`SHELL_NAV_ITEMS` / `SHELL_NAV_KEYS` / `navPathInLang` / `isNavItemActive` 原样。
2. `frontend/src/shell/BottomTabBar.jsx`：`const items = SHELL_NAV_ITEMS`；import 去 `visibleNavItems`；文件头注释改「底栏恒 5 格（含未登录；/profile 保护由路由层 ProtectedRoute 承担）」。随之失效的死消费 `const { isAuthenticated } = useAuth()` + `auth-context` import 一并摘除（本组件不再读登录态；messages 就地叠加 / 未读角标 / is-detail 逻辑一字未动）。
3. 生产码残留核验：`grep -rn 'visibleNavItems\|requiresAuth' frontend/src frontend/scripts` 改后仅剩 4 处**注释留痕**（nav.js 两处、两个测试文件的改锚说明注释），零代码引用（见 `nav.diff`）。

## 门套读数（`gates.log`）

| 门 | 改前基线 | 改后 | 判 |
|---|---|---|---|
| `npm run build` | — | `✓ built in 1.92s`，exit 0 | ✅ |
| `npm run test:unit` | **59 files / 568 tests / 0 failed**（改前现取，落 `gates.log` 首段） | **59 files / 568 tests / 0 failed**，exit 0 | ✅ 持平基线（只增不减口径满足；本单零新增用例、零删用例） |

- lint：仓内无 ESLint 配置（恒 exit 2，存量口径，非本批红点）；前端无 tsconfig（tsc = N/A）。

## 浏览器探针（`probe-guest.json`，脚本 `probe-tabbar.mjs`；playwright + 本机 Chrome，零真登录/零真发布/零库写）

入口 = `http://localhost:5800/item/new`（Kevin 报障同源，5800 H5 预览反代）：

| 臂 | 读数 | 判 |
|---|---|---|
| A 游客 390×844 | `[data-sf-region="tabbar"] a[data-sf-nav]` 恰 **5**：`['home','shard','sell','messages','profile']`；label 第 5 格 = **「我的」**（href `/profile`）；点「我的」→ URL `…/item/new` → `…/login`，落**钱包签名登录引导**（「连接钱包继续探索 使用现有钱包签名即可登录…」）；零 pageerror | ✅ |
| B 假会话 390×844 | 5 格不变（`profile` href `/profile`）；会话识别证据 = topnav 渲染钱包尾号 `0xqa00...00qa`、`localStorage['user']` 保持；零 pageerror（/api/** 拦截回 503 防假 token 触发 401 清会话污染读数） | ✅ |
| C 桌面 1440×900 | `.sf-tabbar` computed `display: none`（断点隐藏不变）；DOM 恒在 5 tabs | ✅ |

verdict = `all_pass: true`（7/7 判据）。

## 断言影响清单（3 个测试文件，属**合法前移**而非放宽）

| 文件:行（改前） | 改前断言 | 改后 | 为何合法 |
|---|---|---|---|
| `theme-shell-isomorphism.test.jsx:25` | import 含 `visibleNavItems` | 去 `visibleNavItems` | 导出已删，跟随真源 |
| `theme-shell-isomorphism.test.jsx:89` | 游客 tab 键集 = `visibleNavItems(false)`（4 键） | = `SHELL_NAV_ITEMS.map(i=>i.key)`（5 键） | 期望锚从「过滤函数」前移到「单一真源常量」；被测行为按 Kevin 裁定翻转 |
| `theme-shell-isomorphism.test.jsx:98` | 登录 href = `visibleNavItems(true).map(navPathInLang)` | = `SHELL_NAV_ITEMS.map(navPathInLang)` | 同上；href 集合逐字不变（登录态本就 5 项） |
| `theme-shell-isomorphism.test.jsx:107-109` | 「未登录不含 profile / 登录后含 profile」两断言（游客 4 / 登录 5） | 合并为「key 集恒 5 = home/shard/sell/messages/profile」+ 用例名与注释改写 | 两态断言整体作废是本次裁定本体；改后用例仍保留登录态渲染断言（:113），游客态 5 格由 :89 用例（beforeEach 默认 isAuthenticated:false）承责 |
| `route-exchange-rename.test.jsx:44` | import 含 `visibleNavItems` | 去 `visibleNavItems` | 同上 |
| `route-exchange-rename.test.jsx:103-104` | 游客 4 / 登录 5 两断言 | 合并为 `SHELL_NAV_ITEMS` key 集恒 5（附改锚注释） | 同上；该用例主断言（isNavItemActive）一字未动 |
| `v15-nav-floatmenu.test.jsx:92` | `expect(fifth.requiresAuth).toBe(true)` | `expect(fifth.key).toBe('profile')`（附注释） | `requiresAuth` 字段已废；同用例 :89 本就断言 `fifth.key==='profile'`，替换为同键复认，语义不降 |

- 未动：`r9-84-profile-entry.test.jsx`（Header「未登录不渲染用户区」另一面，照旧）；四语键集（零新增/删除文案键 ⇒ 无计数前推）；`docs/**` 零改动。
- 并发核：开工 `git log -3` = `a7f0dbc…`，收尾同轮复核工作树仅含本单 5 文件 + `ops/tabbar-mine-guest/`。
