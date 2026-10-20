# /profile/assets 币种卡片 + Header 余额行可点（Kevin 2026-10-21 需求①②）

## 交付

| # | 需求 | 落点 |
|---|---|---|
| ① | 顶部菜单余额**每一行**可点 → `/profile/assets` | `frontend/src/components/Header.jsx`（`header-balance-row` = `<a>`，`to=buildPath('profile/assets')`） |
| ② | `/profile/assets` 每种货币一张卡 | `frontend/src/pages/ProfilePage.jsx`（`AssetsPane`）+ `frontend/src/pages/profile.css`（`.sf-prof-asset-*`） |
| — | 归一 / 千分位复用 | `frontend/src/balances-api.js` 新增 `toBalanceCards`（内部用 `isPositiveAmount` / `formatBalanceAmount`，零重复实现；`toBalanceRows` 一字未动） |

### ① Header 余额行
- 行元素 = `<Link>`（原生 `<a>`）：整行可点（`flex` + `min-h-6` + `py-1` ⇒ 实测 **32px** 行高）、`hover:bg-gray-100`
  （实测 `rgba(0,0,0,0)` → `rgb(243,244,246)`）、原生键盘可聚焦（`tabIndex=0`，无自造键处理）。
- 链接目标一律走既有 `buildPath('profile/assets')`（语言前缀由 `buildLangPath` 决定，zh 无前缀）；已在
  `/profile/assets` 时 href 同样在场（同页可跳）。
- 金额格式化与货币顺序**一字未改**（仍 `toBalanceRows` → `formatBalanceAmount`，后端 cid 升序、`$` 首位）。
- 容器改 `py-2`（原 `px-4 py-3`），左右内边距下移到行上 —— 否则 hover 底色无法铺满整行。

### ② 资产页币种卡片
- 读口 = 既有 `GET /api/user/balances`（`fetchUserBalances`）；只渲染余额 > 0、顺序沿用后端。
- 卡内 = 大号符号（18px/700）+ 千分位余额（24px/700，`tabular-nums`）+ 货币名（12px，后端 `name`，
  空则不渲染该行）。钩子：`asset-cards` / `asset-cards-grid` / `asset-card`（`data-symbol` / `data-name`）/
  `asset-card-symbol` / `asset-card-amount` / `asset-card-name`。
- 网格列数**纯 CSS**（禁 JS 宽度读数）：`repeat(auto-fill, minmax(184px,1fr))`，`≤767` 强制 `1fr`。
- **零新色值**：面/描边/文字全部既有 token（`--sf-panel-bg` / `--sf-panel-border` / `--sf-title-fg` /
  `--sf-meta-fg` / `--sf-down-fg` / `--sf-st-*`）；页面局部几何字面两档同值。
- `BttcAssetPanel`（铸造 / 分解）原样保留在卡片区**下方**，同页可达。
- 取数失败 ⇒ 内联 `role="alert"` + 【重试】（`uiError.networkTitle` / `uiError.retry`，**零新 i18n 键**）；
  未登录 ⇒ `fetchUserBalances` 返回 `null` ⇒ 卡区不渲染、不报错（登录引导仍由既有 `ProtectedRoute`）。

## 门套（本机现取）

| 项 | 读数 |
|---|---|
| 改前基线 | `npm run build` exit 0；`Test Files 69 passed / Tests 726 passed` |
| 改后 | `npm run build` exit 0（✓ built in 1.86s）；`Test Files 69 passed (69) / Tests 726 passed (726)`（**不减**） |
| 新探针 | `ops/profile-assets/probe-asset-cards.mjs` ⇒ **PASS 46/46**，`pageErrors 0 / consoleErrors 0 / resourceErrors 0` |
| 负控臂 | `PROBE_NEG=1` ⇒ **NEG_ARM_RED_AS_EXPECTED**（12 条转红：`allRowsAreAnchors` / `allRowsLinkToAssets` / `rowsKeyboardFocusable` / `hoverBackgroundChanges` / `navigatedToAssets` / `rowsStillAnchors` / 三处 `cardsMatchFixture`·`cardCountIs3`·`orderFollowsBackend`·`namesFromBackend`） |
| 存量探针 | `ops/profile-assets/probe-profile-assets.mjs` ⇒ **PASS 40/40**（`/wage` 与铸造/分解面未回归） |

读数：`ops/profile-assets/readings/probe-asset-cards.json`（正控）/ `probe-asset-cards-neg.json`（负控）/
`probe-profile-assets.json`（存量回归）。

## 探针判据与实测值

- ① Header：3 行（fixture `$4361` / `₿1` / `€100`）全部 `tag=a`、`href=/profile/assets`、
  行高 32px、宽 190px、`tabIndex=0`、`focus()` 命中、hover 底色变化；真点一行 ⇒ `pathname=/profile/assets`。
- ② 卡片：**3 张**，逐张 `$ / 4,361 / 平台积分`、`₿ / 1 / BTTC`、`€ / 100 / Euro`（符号、金额、名称逐项相等，
  顺序 = 后端顺序）；`GET /api/user/balances` 命中。
- ③ 铸造 / 分解：`bttc-asset` 面板在场，两按钮在场且 `disabled=false`。
- ④ 列数按 `getComputedStyle(grid).gridTemplateColumns` 真实轨道数：1536 ⇒ **6 轨（多列）**；390 ⇒ **1 轨（338px/卡）**；
  两档 `documentElement.scrollWidth - clientWidth = 0`，pane 内越界元素 0，390 档 pageError 0。
- ⑤ 失败/重试臂：`balances` 500 ⇒ `asset-cards-error` + `asset-cards-retry` 在场、卡片 0 张、页面不白屏
  （pane 与 `bttc-asset` 仍在）；恢复 200 点【重试】⇒ 3 张卡回来且错误消失。

## 已知口径（不作为本单缺陷）

- **Header 下拉展开态的 110px 横向溢出是存量 HoverMenu 定位缺陷**（`left-0` 锚在右缘触发器下），仓内既有
  探针已归因 ⇒ 本单零溢出判据取**未展开态**（实测 0），展开态只归档读数（`overflowExpandedAttributed`）。
- 未新增 i18n 键（错误/重试复用 `uiError.networkTitle` / `uiError.retry`）⇒ 全仓键计数断言零前推。
- 未改后端、未改 `docs/**`、未 push。
