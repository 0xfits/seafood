# P6-MISC-FIX · 六项已登记小修收口（Kong）

> 骨架先落盘、各节读数逐段回填（§5.7 ②）；下列读数均为**本单自跑**。

## 0. 口径与作用域

- 退出码 = 命令**自身**退出码（`cmd > log 2>&1; echo $?`，不经管道，§5.7 ①）；日志落 `$TMPDIR` scratch。
- 读数标注来源：**实测**（真浏览器 / 真跑命令）/ **现取**（当场从源码·迁移·运行中服务读出）/ 代码推断（本单 0 处）。
- 写集（硬边界内）：`frontend/src/pages/listings/ListingsPage.jsx`、`frontend/src/pages/TaskPage.jsx`、`frontend/src/pages/AuthPage.jsx`、`frontend/src/pages/HomePage.jsx`、`frontend/src/pages/ProfilePage.jsx`、`frontend/src/pages/RewardPage.jsx`、`frontend/src/pages/jobs/{JobDetailPage,JobReviewPage}.jsx`、`frontend/src/components/{Header,LoginModal,layout/AdminLayout}.jsx`、`frontend/src/components/ui/{Advanced,Performance}.jsx`、`frontend/src/assets/placeholder.js`（新）、`frontend/src/locales/{zh,hk,en,vn}.json`、`frontend/src/test/unit/**`、`frontend/scripts/p4z-miscfix-links.mjs`（新）、本文件。
- **未动**：`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`、既有 audit 件（只读）。禁 git add/commit/push、禁 `npm install`、禁启停服务、禁 `pkill`/`killall` —— 全程未用。浏览器只用 `localhost`（vite 只绑 IPv6 `[::1]`）。

## 1. ① 状态枚举四语标签 + 未知兜底（`ListingsPage`）

**现取真实取值域（不得靠猜）**
- DB 侧：`backend-ts/migrations/0015_listing.sql:137` —— `CONSTRAINT listing_status_enum CHECK (status IN ('draft','listed','delisted','frozen'))`，默认 `draft`（:124）；状态机白名单唯一真源 `public.listing_status_transition_ok`（:83）。
- 读侧（实测，运行栈）：`GET http://localhost:5787/api/prize/all?limit=200` ⇒ 22 行，**行内 `status` 键不存在**（distinct 取值集合 = {缺失}）。
  ⇒ 现网渲染实际走的是 `??` 回退支；但 `String(row.status ?? …)` 的**原样枚举渲染路径确实存在**（一旦读侧补上该列即直接进用户面）。

**修前**：`<span className="sf-listings-tag">{String(row.status ?? t('listings.listed'))}</span>`（原值直给）。
**修后**：已知取值 ⇒ `t('listings.statusLabel.<enum>')`；**未知取值 ⇒ `t('listings.statusLabel.unknown')`（不空白、不原始枚举）**；缺省/空串 ⇒ 维持既有口径；原值保留在 `title` + `data-sf-status`。
**新增键（四语同步，5 键 × 4 文件）**：

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `listings.statusLabel.draft` | 草稿 | 草稿 | Draft | Bản nháp |
| `listings.statusLabel.listed` | 已上架 | 已上架 | On sale | Đang bán |
| `listings.statusLabel.delisted` | 已下架 | 已下架 | Removed | Đã gỡ bán |
| `listings.statusLabel.frozen` | 已冻结 | 已凍結 | Suspended | Đã tạm khóa |
| `listings.statusLabel.unknown` | 其他状态 | 其他狀態 | Unknown | Không rõ |

> **偏差（逐条备案）**：任务书写 `listings.status.*`，但 `listings.status` 已是既有**字符串键**（"状态"，`ListingsPage` 之外在用）⇒ 同层再加对象会冲突 ⇒ 改挂 `listings.statusLabel.*`（语义相同、零冲突）。

## 2. ② 乙族硬编码绝对站内链接（语言前缀丢失）

**尺子**：本单新增 `frontend/scripts/p4z-miscfix-links.mjs`（只读）。口径 = **去注释后**代码里的 `to="/…"` / `navigate('/…'` 字面量；`/api/…`、协议相对、注释行不计。

| 读数 | 值 | 来源 |
|---|---|---|
| 修前（`git archive HEAD frontend/src` 快照，同一把尺子） | **29 处 / 15 文件**（扫描 75 文件） | 实测 |
| 本轮**本次改** | **19 处 / 9 文件**：TaskPage×2、jobs/JobDetailPage×2、jobs/JobReviewPage×2、RewardPage×1、ProfilePage×2、HomePage×5、Header×2、LoginModal×2、AdminLayout×1 | 实测 |
| **登记待办（只录不改）** | **10 处 / 6 文件** | 实测 |

> 登记的 18 文件与本单现取的 15 文件不一致（**以本单现取为准**并如实列名：15 = 9 改 + 6 待办）。

**登记待办逐条（理由）**：`components/ActiveTaskModal.jsx` `navigate('/login')`×3、`pages/DashboardPage.jsx` `navigate('/login')`×1 + `to="/"`×1 —— 弹窗/页面**无 `useLocation` 上下文**，改动牵入四语导航回归；`pages/admin/{Points,Permissions×2,Users,SystemSettings}Management.jsx` `navigate('/login')`×5 —— **admin 守卫链为 zh 单语**，改动须连权限链回归。⇒ 均另单收口，本单不改（原登记理由不变，未放宽）。
**修后扫描**：`node scripts/p4z-miscfix-links.mjs` ⇒ 残留 **10**，**未登记残留 0**，总判 **PASS**（退出码 **0**）。

## 3. ③ `AuthPage.FALLBACK_PATHS` 语言感知

**修前**：`{ login: '/', register: '/profile' }`（固定无前缀 ⇒ 登录成功落中文档）。**修后**：按语言白名单 `{ zh: '/', en: '/en', hk: '/hk', vn: '/vn' }` / `register` 同理 `…/profile`，经 `fallbackPathFor(mode, lang)` 取；`lang` = `getLanguageFromUrl(location.pathname)`，useMemo 依赖补 `lang`；非法/缺失语言 ⇒ 回落 zh（与 `buildLocalizedPath` 同口径）。

## 4. ④ 390 档 `en/task` 横向溢出 7px

**修前（实测，真浏览器 390×844，`Emulation.setDeviceMetricsOverride`）**：

| 档 | `documentElement.scrollWidth` | `clientWidth` | 溢出 |
|---|---|---|---|
| zh `/task` | 390 | 390 | 0 |
| hk `/hk/task` | 390 | 390 | 0 |
| **en `/en/task`** | **397** | **390** | **+7px** |
| vn `/vn/task` | 390 | 390 | 0 |

- **复现性（实测，非单次）**：3s 内 6 次采样 = `390,390,397,397,397,397` —— 溢出在**异步内容落地后**才出现（前两次采样未溢出 ⇒ 单看一次易判“无此问题”）。
- **真因（实测，溢出瞬间抓帧）**：Tab 条 `TabsList className="grid w-full grid-cols-4"` 的**固定 4 列轨道**被最长的不换行英文标签撑破 —— `BUTTON`（`Pending Verification (0)`）`scrollWidth 119 / clientWidth 83`；其外层 `.space-y-8` 实测 371 > 内容盒 338 ⇒ 文档级溢出。zh/hk/vn 标签更短故不触发（与“仅 en”一致）。
- **修后**：窄屏 2 列 / sm 起 4 列（`grid-cols-2 sm:grid-cols-4`）。修后四档**全部 390 / 390 ⇒ 溢出 0**；`/en/task` 四个 tab 仍在（`Available (20) / To claim (0) / Completed (0) / Pending Verification (0)`）。
- 诚实边界：修在**页面级**（未动共享 `components/ui/Tabs.jsx`）⇒ 其它页面若再出现超长标签仍可能复发，共享组件加固另单。

## 5. ⑤ 首页 `placeholder.jpg`

**真因（现取 + 实测）**：**文件缺失**，非大小写/拼接错 —— 仓库内 `find . -iname '*placeholder*'`（去 node_modules）= **空**；`frontend/public/` 只有 `brand/`、`images/partners/`。
- 实测本地栈：`GET http://localhost:5787/placeholder.jpg` ⇒ **200 + `Content-Type: text/html` + `<html`（4816B）**（vite SPA 回落，图片请求拿到 HTML ⇒ `<img>` 解码失败）；prod 无回落 ⇒ 404（与登记“×8/档”同因：首页 8 张卡片共用同一 URL）。
**修后**：占位图**内联 data-URI**（新 `frontend/src/assets/placeholder.js`，`HomePage.jsx:70`、`components/ui/Performance.jsx:66` 改引）。
> **AC 口径偏差（逐条备案）**：我方不写 `frontend/public/**`（越硬边界）⇒ 不改“文件不存在的路径问题”而是**取消该请求**。故不存在“该资源 200”这一读数，代之以更强的两项实测：**四档首页本地 4xx 请求 = 0**；**8/8 内联占位图 `naturalWidth > 0`（解码成功）**；`RE /placeholder/i` 命中的资源只剩模块自身 `/src/assets/placeholder.js`（`initiatorType=script`, 200）。

## 6. ⑥ `formatDate` 按语言（`components/ui/Advanced.jsx`）

**修前**：`new Date(date).toLocaleDateString('zh-CN')`（硬编码）。**修后**：`DATE_LOCALE_BY_LANG = { zh:'zh-CN', hk:'zh-HK', en:'en-US', vn:'vi-VN' }`，取 `i18n.resolvedLanguage || i18n.language` → 小写、取 `-` 前主标签 → 命中即用，**未命中/非法/缺失 ⇒ 默认回落 `zh-CN`**（`String(...)` 包一层 ⇒ `undefined/null/''/0/'xx'` 均不抛）。
**判负用例**（`src/test/unit/p6-miscfix.test.jsx`）：四语逐条对拍 `new Date(v).toLocaleDateString(<mapped>)` 且 `en ≠ zh`（不同语言产不同结果）；非法/缺失语言（`undefined,null,'','xx','ZH',0,'zh-Hans'`）⇒ 不抛且等于 zh-CN；`i18n` 整个缺失亦不抛。

## 7. 交验读数（AC 逐项，全部自跑）

| AC | 命令 | 退出码 | 读数 |
|---|---|---|---|
| ① 构建 | `npm run build` | **0** | `✓ built in 1.65s`（仅既有 chunk 体积告警） |
| ② 单测 | `npm run test:unit` | **0** | **197 passed / 22 files**（基线 189/21 ⇒ **+8**，全绿；0 failed） |
| ③ 四语 locale | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | **总判 PASS**；四文件拍平键 **683** 单值（678 + 授权新增 5） |
| ④ 全量面断言 | `node scripts/p4z-i18nviol-global.mjs` | **0** | **总判 PASS**；locale 裸命中 **0**（作用域 683×4 = **2732** 节点）、源面裸命中 **0**；四语键集单值 {683}；en/vn 残留中文 0 |
| ⑤ ② 专用 | `node scripts/p4z-miscfix-links.mjs` | **0** | 修前 29 ⇒ 修后 **10**（全部已登记），未登记残留 **0**，总判 PASS |
| ⑤ 真浏览器 | 390×844 四档 `/task` + 四档首页 | — | 溢出 **0/0/0/0**（en 修前 397）；首页本地 4xx **0**；内联占位图解码 **8/8** |

**② 新增用例（`src/test/unit/p6-miscfix.test.jsx`，8 例）**：① 四语标签各语言渲染且四语两两可区分；未知取值 ⇒ 本地化兜底 + 原文留 `title`/`data-sf-status`（判负：不得为原始枚举/空白）；缺省 ⇒ 既有口径且无 `data-sf-status`；四语 `statusLabel` 键集相等且 en/vn 零 CJK。② 源码不变量：`to="/…"`/`navigate('/…'` 残留 ⊆ 登记待办（含“作用域不得命中 0 条”有效性闸）+ 构造器四语/非法语言契约对拍。⑥ `formatDate` 四语映射 + 判负（非法/缺失不抛、回落 zh-CN）。

> **既有测试基线更新（逐条备案）**：授权新增 5 键 ⇒ 拍平键 678⇒683、locale 面节点 2712⇒2732。三处写死基线的既有用例同步更新（`i18n-batch-b4a/b4b/b5.test.jsx`、`i18n-violation-closeout.test.jsx`），**只改被授权的计数，未放宽任何断言口径**。

## 8. 残留 / 未完成

1. 乙族 `ActiveTaskModal.jsx`(3)、`DashboardPage.jsx`(2)、admin 4 页(5) = **10 处** —— 理由见 §2，`REGISTERED_TODO` 内逐条登记（扫描器以此作 FAIL 闸）。
2. `components/ui/Tabs.jsx` 共享组件未加固（见 §4 诚实边界）。
3. 若团队更想要“真文件”占位而非内联：需在 `frontend/public/` 落 `placeholder.svg`（**越本单写边界**，未做）。
