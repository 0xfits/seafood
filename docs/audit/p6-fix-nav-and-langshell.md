# P6 · FIX-NAV —— 语言前缀登录页空壳（F1）+ 卡片链接 `/undefined/listing/listing/<id>`（F2）

- 单元：FIX-NAV（Kong）
- 仓库：`/Users/kevin/bistro/seafood`（前端 `frontend`，Vite + React，四语 zh/hk/en/vn）
- 写盘范围：`frontend/src/**`、`frontend/src/test/unit/**`、`frontend/scripts/p4z-fixnav-*.mjs`、本文件
- 未触碰：`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`、`frontend/src/locales/*.json`（键集与文案零改动）
- 未执行：`git add/commit/push`、`npm install`、服务启停、`vercel`、`pkill/killall`

---

## 0. 复现环境与口径（先说清，避免「代码推断当实测」）

| 项 | 值 |
|---|---|
| 本地栈 | 前端 `http://localhost:5787` / 后端 `5788`（均在跑，本单未启停） |
| ★ 口径坑 | `vite` **只监听 IPv6 环回 `[::1]:5787`**（`lsof` 实测）。`http://127.0.0.1:5787` **拒连**（curl `000`）⇒ 浏览器一律走 `http://localhost:5787`。**不是服务未跑**。 |
| 浏览器 | 平台自带浏览器工具（真 Chromium，CDP）；每次导航后 `location.reload(true)` 硬刷新（§5.7⑥） |
| 读数口径 | `main` 字符数 = `document.querySelector('main').innerHTML.length`；`main` 元素即 `AppShell` 的 `#sf-route-container` |
| 未做 | 站上**未提交任何表单/登录/资金操作**（仅导航与点开卡片） |

---

## 1. 修前读数（真浏览器实测，非推断）

### F1 —— 语言前缀登录页 = 空壳

| 地址 | `<main>` 存在 | `main` 字符数 | Header/Footer | 文案 |
|---|---|---|---|---|
| `/login`（无前缀） | **否** | — | 否 | 有（渲染在 AppShell **之外**） |
| `/en/login` | 是 | **0** | 是 | 空 |
| `/hk/login` | 是 | **0** | 是 | 空 |
| `/vn/login` | 是 | **0** | 是 | 空 |
| `/en/register` | 是 | **0** | 是 | 空 |
| `/hk/register` | 是 | **0** | 是 | 空 |

⇒ 与事故读数一致：外壳在、`<main>` 0 字节。**根因（现已被修后读数证实）**：登录/注册路由声明在顶层 `App` 的 `<Routes>` 里、用**绝对路径** `/login`、`/register`；带语言前缀的 `/en/login` 不进该分支，落到 `/*` ⇒ `LangShell`，而 `LangShell` 内层 `<Routes>` 里**没有** `login`/`register` 段 ⇒ 内层无匹配 ⇒ `<main>` 空。

### F2 —— 列表页卡片链接

| 地址 | 卡片数 | 卡片实际 `href` | 发布链接 `href` | `undefined`/重复段命中数 |
|---|---|---|---|---|
| `/listing` | 22 | `/undefined/listing/listing/1`、`/2`、`/3`、`/4` … | `/undefined/listing/listing/new` | 22/22 |
| `/en/listing` | 22 | `/undefined/listing/listing/1`、`/2`、`/3` … | — | 22/22 |

⇒ 与事故读数逐字一致（前缀位 = 字符串 `undefined` + `listing` 段重复一次）。

**根因**：五个页面里的同族写法 `const entry = buildLangPath(location.pathname, undefined)` 把 `undefined` 当目标语言传给 `buildLangPath`（旧实现 `targetLang === 'zh' ? rest : \`/${targetLang}${rest}\`` ⇒ `/${undefined}/listing`），且该返回值的语义是「整条路径」却被当「语言前缀」拼接 ⇒ 前缀位 + 重复段。`lang` 档位（zh/en/hk/vn）**全中**，非某档特有。

---

## 2. 修根因（不是加特例）

### F1 —— 把登录/注册纳入 `LangShell` 路由管辖（结构修复）

- `frontend/src/App.jsx`
  - **删**：顶层 `<Route path="/login" …>` / `<Route path="/register" …>`（绝对路径专属）
  - **增**：`LangShell` 内层相对段 `<Route path="login" …>` / `<Route path="register" …>`
  - 语言前缀一律由外层壳承担，内层只写相对段——与 `reward`/`task`/`listing`/`profile` 等**同一处置**，**不为某一档语言加特例路由**。
  - 无前缀 `/login`、`/register` 经 `/*` 兜底壳**照旧可达**（`canonicalLangPath` 不为其加前缀，无重定向回环）。
  - 同族：`ProtectedRoute` 未登录跳转由 `<Navigate to="/login">` ⇒ `buildLocalizedPath(getLanguageFromUrl(location.pathname), '/login')`（`/en/profile` 不再掉回中文档）。

### F2 —— 修 URL 构造点 + 同族全量排查

- `frontend/src/utils.js`（**唯一真源**，新增/加固）
  - 新增 `langPathPrefix(lang)`：`zh ⇒ ''`、白名单语言 ⇒ `'/en'`，非法/缺失 ⇒ 按 zh（**绝不产 `undefined`**）
  - 新增 `buildLocalizedPath(lang, path)`：站内链接的**唯一构造器**；契约见 §4 判负用例
  - 加固 `buildLangPath(pathname, targetLang)`：目标语言非法/缺失 ⇒ 按 zh 处置（合法语言行为**逐条不变**，见 `lang-path.test.js` 全表对拍）
- 页面接线（5 处，见 §3 逐点清单）：`const root = (p) => buildLocalizedPath(lang, p)`，`lang = getLanguageFromUrl(location.pathname)` 与 TR-2 本地化取值**同一个** `lang`。

---

## 3. 同族链接构造点逐点判定（口径：`grep -rnE '(to="/|to=\{'/|navigate\('/)' src --include=*.jsx | grep -v /test/`）

### 甲族 —— `buildLangPath(<path>, undefined)`（本单指名族，**本次改 5/5**）

| # | 位置 | 产出的坏链接 | 判定 |
|---|---|---|---|
| 1 | `pages/listings/ListingsPage.jsx:86` | 卡片 `/undefined/listing/listing/<id>` ×22 + 发布链接（**事故点**） | 本次改 |
| 2 | `pages/listings/ListingDetailPage.jsx:60` | 返回列表链接 | 本次改 |
| 3 | `pages/listings/PublishListingPage.jsx:72` | 返回列表 + 「我的订单」`navigate` | 本次改 |
| 4 | `pages/market/MarketPage.jsx:161` | 行情页两条商品线链接 | 本次改 |
| 5 | `pages/jobs/PublishJobPage.jsx:62` | `entry` 为**死变量**（页面两条链接另行硬编码 `/task`、`/task/review`）⇒ 一并收口到 `root()` | 本次改 |

修后静态命中数 = **0**（口径：去注释后逐文件正则；`scripts/p4z-fixnav-langlinks.mjs` ① 与单测 ④ 双钉）。

### 乙族 —— 硬编码绝对站内链接（**语言前缀丢失**，非 `undefined`，仍可达但回落中文档）

**本次一并改（F1 波及面，7 处）**：
- `pages/AuthPage.jsx` ×4：`navigate('/register')`、`<Navigate to="/register">`、登录/注册互跳 `<Link to="/login|/register">`（`/en/login ⇄ /en/register` 不再跨语）
- `App.jsx` ×1：`ProtectedRoute` 的 `<Navigate to="/login">`
- `pages/jobs/PublishJobPage.jsx` ×2：`/task`、`/task/review`
- （`MarketPage` 2 处已计入甲族）

**登记待办：余 29 处 / 18 文件**（本单「只录不改」——均为「语言回落中文档」而非 URL 破损，且改动面牵动四语导航/登录回落链，须各自回归）：

| 文件 | 行 | 形态 |
|---|---|---|
| `components/Header.jsx` | 101, 112 | `navigate('/')`、`navigate('/register')`（Header 已有 `buildPath` 机制，改动需连四语导航一起回归） |
| `components/LoginModal.jsx` | 27, 39 | `navigate('/register')` |
| `components/ActiveTaskModal.jsx` | 34, 44, 65 | `navigate('/login')` |
| `components/layout/AdminLayout.jsx` | 118 | `navigate('/login')` |
| `pages/HomePage.jsx` | 164, 184, 212, 226, 258 | `navigate('/login'|'/reward')`、`<Link to="/reward"|"/task">` |
| `pages/RewardPage.jsx` | 139 | `navigate('/login')` |
| `pages/ProfilePage.jsx` | 192, 437 | `navigate('/login')`、`<Link to="/shard">` |
| `pages/DashboardPage.jsx` | 211, 296 | `navigate('/login')`、`<Link to="/">` |
| `pages/TaskPage.jsx` | 226, 227 | `<Link to="/task/new"|"/task/review">` |
| `pages/jobs/JobDetailPage.jsx` | 109, 110 | `<Link to="/task"|"/task/new">` |
| `pages/jobs/JobReviewPage.jsx` | 110, 111 | `<Link to="/task"|"/task/new">` |
| `pages/admin/PointsManagement.jsx` | 110 | `navigate('/login')` |
| `pages/admin/PermissionsManagement.jsx` | 115, 174 | `navigate('/login')` |
| `pages/admin/UsersManagement.jsx` | 91 | `navigate('/login')` |
| `pages/admin/SystemSettings.jsx` | 84 | `navigate('/login')` |

**另一条登记待办**：`pages/AuthPage.jsx` 的 `FALLBACK_PATHS = { login: '/', register: '/profile' }` —— **登录成功后**的回落目标仍为无前缀（登录后落中文档）。属「登录后路由」族，不在本单 F1（渲染空壳）波及面内，单列待办。

---

## 4. 交验读数（AC 逐项，全部自跑）

| AC | 命令 | 退出码 | 读数 |
|---|---|---|---|
| ① 构建 | `npm run build` | **0** | `✓ built in 1.33s`；`dist/assets/index-*.js 555.44 kB`（仅既有 chunk 体积告警） |
| ② 单测 | `npm run test:unit` | **0** | **184 passed / 20 files**（基线 172 ⇒ +12 新增用例，全绿） |
| ③ 四语 locale | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | 键集相等 **PASS**（四文件 flat=678 一致）、`i18n.translating` 四语齐备 4/4、静态守卫 PASS、**总判 PASS**；键集**未改** |
| ④ 新增探针 | `node scripts/p4z-fixnav-langlinks.mjs` | **0** | 总判 **PASS（6/6）**：甲族命中 0、顶层绝对 login/register 计数 0、内层相对路由齐备、契约 10 例全对（含 2 条判负） |

> 退出码均为命令**自身**退出码（`cmd > log 2>&1; echo $?`，不经管道）；`test:unit` 与 `build` 日志落 `$TMPDIR` scratch。

### ② 新增用例（`frontend/src/test/unit/fix-nav-langshell.test.jsx`，12 例）

1. **语言前缀登录路由渲染登录内容**：`/login`、`/en/login`、`/hk/login`、`/vn/login` 均渲染 `login auth page` **且** `main` 非空；注册四档同理；另加源码结构断言（顶层不得再有 `<Route path="/login"`）。
2. **卡片链接构造器契约**：`buildLocalizedPath` 四档前缀 + 无重复段；**判负用例**：`lang ∈ {undefined, null, '', 'xx', 'ZH', 0}` ⇒ 输出**不得含 `undefined`**、且等于 zh 口径；`buildLangPath('/listing', undefined)` 兜底判负。
3. **真渲染页面**：`ListingsPage` 在 `/listing`、`/en/listing`、`/hk/listing`、`/vn/listing` 下卡片 `href` = `/listing/5`、`/en/listing/5`、`/hk/listing/5`、`/vn/listing/5`；发布链接正确。
4. **静态不变量**：全 `src` 不得再出现 `buildLangPath(<path>, undefined)`（甲族清零）。
5. 同族点覆盖：F1 波及面的 `AuthPage`/`ProtectedRoute` 经 ① 的四档渲染间接钉住；乙族余量**逐点登记**于 §3。

---

## 5. 真浏览器修后复验（硬刷新，四档）

### ① 登录页渲染登录内容（`<main>` 字符数）

| 地址 | `main` 字符数 | 文案分档（首段实测） | Header/Footer |
|---|---|---|---|
| `/login` | **4631** | `JINLI CLUB 连接钱包继续探索 使用现有钱包签名即可登录…` | 是/是 |
| `/en/login` | **5147** | `JINLI CLUB Connect your wallet to continue exploring Sign with your ex…` | 是/是 |
| `/hk/login` | **4638** | `JINLI CLUB 連接錢包繼續探索 使用現有錢包簽名即可登入…` | 是/是 |
| `/vn/login` | **5071** | `JINLI CLUB Kết nối ví để tiếp tục khám phá Ký bằng ví hiện có để đăng…` | 是/是 |
| `/en/register` | 5123 | `JINLI CLUB Finish first-time binding and complete your profile Verify…` | 是/是 |
| `/vn/register` | 5074 | `JINLI CLUB Hoàn tất liên kết lần đầu và bổ sung hồ sơ Xác minh…` | 是/是 |

（修前四档 `main` 均 0 ⇒ 空壳已消；语言档位文案各自正确，不是同一串。）

### ② 卡片 `href` 正确形态（`bad` = 含 `undefined` 或重复 `/listing/listing/` 的卡片数）

| 地址 | 卡片数 | 前 3 个 `href` | 发布链接 | `bad` |
|---|---|---|---|---|
| `/listing` | 22 | `/listing/1`、`/listing/2`、`/listing/3` | `/listing/new` | **0** |
| `/en/listing` | 22 | `/en/listing/1`、`/en/listing/2`、`/en/listing/3` | `/en/listing/new` | **0** |
| `/hk/listing` | 22 | `/hk/listing/1`、`/hk/listing/2`、`/hk/listing/3` | `/hk/listing/new` | **0** |
| `/vn/listing` | 22 | `/vn/listing/1`、`/vn/listing/2`、`/vn/listing/3` | `/vn/listing/new` | **0** |

### ③ 真实点击 → 详情页（四档各一次；仅点开，**未提交任何表单**）

| 起点 | 点击的 `href` | 点后 URL | 详情页命中 | 详情页首行（分档） | 返回链接 |
|---|---|---|---|---|---|
| `/listing` | `/listing/1` | `/listing/1` | 是（`data-sf-m="listing-detail-layout"`） | `…商品编号 #1 · - 商品列表 刷新` | `/listing` |
| `/en/listing` | `/en/listing/1` | `/en/listing/1` | 是 | `…Listing #1 · - Listings Refresh` | `/en/listing` |
| `/hk/listing` | `/hk/listing/1` | `/hk/listing/1` | 是 | `…商品編號 #1 · - 商品列表 重新整理` | `/hk/listing` |
| `/vn/listing` | `/vn/listing/1` | `/vn/listing/1` | 是 | `…Mã hàng hoá #1 · - Danh sách hàng hoá Tải lại` | `/vn/listing` |

⇒ 核心交易链路（列表 → 详情）四档恢复；商品可点开。

---

## 6. 改动文件清单

| 文件 | 改动 |
|---|---|
| `frontend/src/utils.js` | 新增 `langPathPrefix`、`buildLocalizedPath`；加固 `buildLangPath`（非法目标语言不产 `undefined`） |
| `frontend/src/App.jsx` | 登录/注册路由下沉 `LangShell` 内层；删顶层绝对路径版；`ProtectedRoute` 登录跳转带语言前缀 |
| `frontend/src/pages/listings/ListingsPage.jsx` | 甲族 #1：卡片/发布链接改 `buildLocalizedPath` |
| `frontend/src/pages/listings/ListingDetailPage.jsx` | 甲族 #2 |
| `frontend/src/pages/listings/PublishListingPage.jsx` | 甲族 #3 |
| `frontend/src/pages/market/MarketPage.jsx` | 甲族 #4 |
| `frontend/src/pages/jobs/PublishJobPage.jsx` | 甲族 #5（含同页 2 条硬编码链接） |
| `frontend/src/pages/AuthPage.jsx` | 登录/注册互跳 + 重定向目标带语言前缀（4 处） |
| `frontend/src/test/unit/fix-nav-langshell.test.jsx` | **新增** 12 例（含判负用例） |
| `frontend/scripts/p4z-fixnav-langlinks.mjs` | **新增** 只读探针（甲族清零 / 路由归属 / 契约对拍） |
| `docs/audit/p6-fix-nav-and-langshell.md` | **本文件** |

## 7. 遗留（本单登记，不在本单改）

1. **乙族 29 处硬编码绝对站内链接**（§3 逐点表）：语言前缀丢失（回落中文档），非 URL 破损 ⇒ 各自单点收口。
2. **`AuthPage.FALLBACK_PATHS`**（`/`、`/profile`）：登录成功后的回落目标仍无前缀。
3. **Header 的「Login」是 `<button>`（开 `LoginModal`），非跳转链接**：F1 修前「仅直链可达」由它放大；现四档直链均可达，按钮行为属产品设计，本单未动。
4. `npm run build` 既有 chunk 体积告警（555 kB > 500 kB）：存量，与本单无关。
