# 生产终验（上线后）· v1.19 §21 / route v2.34 §44 · 消息面板化（方案 1「就地叠加」）

- **被检面（部署对应 commit）**：`da705e2`（`origin/main = da705e2`、`git rev-list --left-right --count origin/main...HEAD` = **`0 0`** ⇒ 本地 = 线上、无未推提交）
  - 本单四笔：`bc57a3a`（规范冻结）→ `b776aee`（实现）→ `7150278`（Neng 独立质检 PASS-with-drift）→ `da705e2`（Jing 勘误补登 + `§5.413`/`v0.331` 收口）
- **验收方**：Neng（质检员）· 自写探针 / 自跑命令，**不采信任何自报读数**
- **判决**：**PASS**（同版证明逐字同版 · 四态零异常零白屏 · 桌面几何逐值与冻结表相符 · 交互五条全绿 · 哨兵零位移；**无新增 `spec_drift`**）
- **硬约束（逐条遵守）**：
  - 生产面**只读**：探针在网络层强制「非 `GET/HEAD/OPTIONS` 一律 `abort` 并记账」⇒ 结构上不可能写生产库；实测 **173 条对源请求 100% 为 `GET`、`blockedWrites = []`**（§5）。
  - **未登录态**：不登录、不注入 token、不点击任何登录态写动作（「聊一聊」未点）。
  - **未改** `frontend/**` / `docs/design/**` / `docs/route-layer.spec.md` / `backend-ts/**` 一字（`git status --porcelain` 全程只有 `?? ops/v119-msg-panel/prod/` 与本报告）。
  - **未 push**、**未 `git add -A`**（只 `git add docs/qa/v119-msg-panel-prod.md ops/v119-msg-panel/prod/`）。
  - **零后端面**：注册点 `105` 不变、生产 `schema_version` 仍 `0048` ⇒ **无 apply 前置**，本单无迁移动作。

---

## 0. ★ 同版证明（最硬的一条）

> 读数：`ops/v119-msg-panel/prod/readings/sha256-compare.txt` · `readings/sameversion.txt` · `readings/http-headers.txt` · 本地构建日志 `logs/local-build.log`

**本地 HEAD 现跑**：`cd frontend && npm run build; echo "exit=$?"` ⇒ **`exit=0`**、`vite v5.4.20`、`1819 modules transformed`、`✓ built in 1.88s`。

**线上绕缓存取**（本机 DNS 被劫持 ⇒ `--resolve 0xseafood.com:443:76.76.21.21`；先落盘 + 逐条核 `%{http_code}`/`%{size_download}`，再在文件上比对）：

| 产物 | 本地 `dist/assets/` | 线上（绕缓存逐个拉取） | `http_code` / bytes | `cmp` | sha256（两侧逐字） |
|---|---|---|---|--:|---|
| `index-*.js` | `index-C3dRJ_m4.js` | **`index-C3dRJ_m4.js`** | 200 / 485,465 | **IDENTICAL** | `f53c130d621343a56aef7f4f0fdf06e23b04fee7e992f0169f621ce098d30f9f` |
| `index-*.css` | `index-D4sieLPp.css` | **`index-D4sieLPp.css`** | 200 / 121,755 | **IDENTICAL** | `8a6b5d3596704c60008429cdd348ff852d52d9d4df34cf900b5b5299af72e257` |
| `vendor-AmHF8z37.js` | 同 | 同 | 200 / 9,105 | **IDENTICAL** | `495d48a8401d9d3cdecd460ac0003d7d0c9e173105fbad6081016995b14fa665` |
| `vendor-react-CZtNYldG.js` | 同 | 同 | 200 / 166,588 | **IDENTICAL** | `e16f933f6076fad6c8afc2a190691a2be82acedf5ba8bef79e1f3a62e386bd8c` |
| `vendor-router-Cm_Gdouh.js` | 同 | 同 | 200 / 12,635 | **IDENTICAL** | `fe78188d1c7661e9dec11fd22b924789174547a0ce3f21886497b03c750e5320` |
| `vendor-ui-C62xpTZb.js` | 同 | 同 | 200 / 39,479 | **IDENTICAL** | `fc97b458ecc48caf587762778be438cbc0efa8d4952097ae2665c4e2a4e86857` |
| `vendor-i18n-Dv2xmCnL.js` | 同 | 同 | 200 / 53,547 | **IDENTICAL** | `f4e3fe67d40ba5370a45f75c9f94e4138a0278ccfafde0fc7ba1f101fcec5082` |

**一句话结论**：线上 HTML 引用的 7 个产物名与本地 HEAD 重建**逐字同名**、且 7/7 **逐字节 `cmp` 相同**（sha256 逐字相符）⇒ **线上跑的就是 `da705e2` 这一版**。

**新版确已生效的旁证（非替代判据）**：生产 JS `index-C3dRJ_m4.js` 里 `messages-panel-close` / `sf-mp` / `messages-panel-list` 字面计数 = **1 / 1 / 1**，与本地同名产物**逐项相同**（旧产物 `index-DJNSZl46.js` 三者为 **0**）。

### 0.1 ★ 本单实测复现的两条「假读数」坑（**原样登记，不判缺陷**）

1. **首次取 `/` 吃到边缘缓存旧 HTML**：无 cache-busting 的首取返回 `src="/assets/index-DJNSZl46.js"` + `href="/assets/index-Bl6P2cg0.css"`（`http_code=200 size_download=7908`，内容完整、**不是空输入**），而该 JS 里面板字面计数 **= 0** ⇒ 该 HTML 属 `da705e2` **之前**的部署。**「产物名不同 ≠ 没上线」当场被证实**。绕缓存复取（`?cb=<rand>`）3/3 与本地逐字同名；**随后 plain `/` 复取也 3/3 翻新**（`readings/http-headers.txt` D 段）。
   - 归档件：`readings/prod-html-stale-first.html`（旧，引 `index-DJNSZl46.js`）· `readings/prod-html-fresh.html`（新，引 `index-C3dRJ_m4.js`）。
   - 附带瞬态伪影：跟随取旧 HTML 引的 `assets/index-Bl6P2cg0.css` ⇒ `http 200` 但 `size=7908` 且 sha256 **== `index.html` 本体**（该 CSS 已被 GC、被 SPA rewrite 顶成 HTML）。**新 HTML 的 CSS 取到的是真身**（121,755 B）。⇒ 若只看「200 就算通」会误判，**必须核字节/sha256**。
2. **`curl | grep -c` 的空输入陷阱**：本单**全程先落盘**、逐条核 `%{http_code}`/`%{size_download}` 后再在文件上比对；未出现任何「空输入 ⇒ 恒 0 ⇒ 读成不存在」的读数。

---

## 1. ★ 真浏览器探针（白屏 / 未捕获异常 · **curl + sha256 面看不见**）

> 探针 = `ops/v119-msg-panel/prod/probe-prod.mjs`（自写）· 读数 = `prod-probe.json` · 日志 = `prod-probe.log` · 窗口 2026-10-16 21:50:11–21:51:54 CST
> 环境：Playwright `1.58.2` + 本机 Chrome（headless）· 启动参 **`--host-resolver-rules="MAP 0xseafood.com 76.76.21.21"`** · 视口 `1440×900` · 禁动画（`reducedMotion:'reduce'` + 注入 `*{animation:none!important;transition:none!important}`）· 稳态采样（连续两拍 DOM 签名相同才取数）· **未登录态**（零凭据、零 `localStorage` 注入）。

### 1.1 钩子（文档创建前注入 `Page/context.addInitScript`）

`window.onerror` + `unhandledrejection` + `console.error` 三路钩子 ⇒ 页内 `window.__qaErrors`；Node 侧另挂 `page.on('pageerror')`。

### 1.2 ★ 尺子灵敏度自证（采信「零异常」之前必做）

主动抛一条未捕获 `Error` + 一条未处理 rejection + 一条 `console.error`：

| 探针 | 结果 |
|---|---|
| `window.__qaErrors` 存在（`hookAlive`） | **true**（4/4 态均 true） |
| `caught_onerror` | **true**（`Uncaught Error: QA_SELFTEST_UNCAUGHT`） |
| `caught_rejection` | **true**（`QA_SELFTEST_REJECTION`） |
| `caught_consoleError` | **true**（`QA_SELFTEST_CONSOLE_ERROR`） |

⇒ 钩子**确实能接住未捕获异常** ⇒ 下面的「零异常」不是「钩子瞎了」的假绿。自证后**已清空并重新导航复原**（`pageErrors` 全程恰 2 条 = 自证的那两条，见 §1.4）。

### 1.3 四态（`/` `/exchange` `/item/1` `/messages`）

| 态 | `pathname` | `#root.innerHTML` 长度 | `#root` 子节点 | 元素数 | 面板 | `onerror` | `unhandledrejection` | `console.error` | 白屏 |
|---|---|--:|--:|--:|--:|--:|--:|--:|:-:|
| `/` | `/` | **34,626** | 2 | 399 | 无 | **0** | **0** | **0** | 否 |
| `/exchange` | `/exchange` | **16,615** | 2 | 206 | 无 | **0** | **0** | **0** | 否 |
| `/item/1` | `/item/1` | **14,403** | 2 | 158 | 无 | **0** | **0** | **0** | 否 |
| `/messages` | `/messages` | **35,421** | 2 | 411 | **挂** | **0** | **0** | **0** | 否 |

⇒ **四态 `#root` 皆非空（14,403–35,421 字符）+ 三路钩子全 0** ⇒ 无白屏、零未捕获异常。`gotoErrors` 4/4 = `[]`（无导航失败）。

### 1.4 全轮异常总账（**逐条归因**）

| 来源 | 读数 | 归因 |
|---|---|---|
| `pageErrors`（Node 侧 `pageerror`） | `["QA_SELFTEST_UNCAUGHT","QA_SELFTEST_REJECTION"]` | **100% = 探针 §1.2 主动自证注入**，非站点异常 |
| `consoleErrorsNodeSide` | `["QA_SELFTEST_CONSOLE_ERROR"]` | 同上 |
| 四态页内三路钩子 | 全 `0` | 站点侧零异常 |
| 交互态（悬浮菜单点击后 / 移动档） | `onerror: []`、`rejection: []` | 站点侧零异常 |

---

## 2. 生产几何（**1440 档 · 只读**）+ 与本地质检读数对照

> 读数 = `prod-probe.json → geometry1440`（`/messages` 直链态与 `/exchange?msg=1` 叠加态两处独立采）

| 判据 | 生产实测（anon · 1440×900） | 本地质检读数（`docs/qa/v119-msg-panel-qa.md` §2.1） | 冻结值（design v1.19 §21.3） | 结论 |
|---|--:|--:|--:|---|
| 面板宽 `w` | **600** | 600 | `min(600, 100vw−424)` ⇒ 600 | **相符** |
| 面板右偏移 `100vw−right` | **104** | 104 | `104px` | **相符** |
| 左栏宽 | **240** | 240 | `min(240px, 45%)` ⇒ 240 | **相符** |
| 右栏宽 | **360** | 360 | 余量 ⇒ 360 | **相符** |
| 左 + 右 | **600**（自洽） | 600 | `240 + 360 = 600` | **相符** |
| 面板 ↔ `.sf-fm` 间隙 | **16** | 16 | **恒 16** | **相符** |
| 与 `.sf-fm` 相交面积 | **0** | 0 | **硬判据 = 0** | **相符** |
| `scrollWidth − clientWidth` | **0**（`1440 − 1440`） | 0 | 零横向溢出 | **相符**（旁证，见下） |
| 正文右缘 vs 面板左缘（`panel.left − content.right`） | **0**（脚碰脚） | 0 | 正文右缘 ≤ 面板左缘 | **相符** |
| 让位量（反算） | `.sf-route-container` 右缘 = **736** ⇒ 让位 **704** | `shell padding-right: 704px` | `calc(面板宽 + 104)` ⇒ 704 | **相符**（本单为反算式，非直取 computed padding——如实标注口径） |
| 面板高 | **900**（= 视口全高，`position:fixed` `top:0/bottom:0`） | 900 | 视口全高 | **相符** |
| 面板内 `[data-sf-region]` 计数 | **0** | 0 | **面板零 region** | **相符** |
| 全文档 `[data-sf-region]` 集合 | **`['shell','topnav','content','footer','tabbar']`** | 同五元组 | 五 region 恒等 | **相符** |
| 面板子树元素数 | 10（未登录态 · 空壳） | 31（夹具登录态 · 3 会话行） | — | 差异**归因于夹具态**（见 §7.1） |
| 面板标题 / 关闭键 `aria-label` | `消息` / **`关闭消息`** | `消息` / `关闭消息` | 四语齐 | **相符** |
| `.sf-shell` 类 | `sf-shell sf-shell--msg-open` | 同 | — | **相符** |

- **注（`scrollWidth−clientWidth` 判据）**：承本地质检 §3 已裁定「面板为 `position:fixed` ⇒ 不参与 `scrollWidth`，该读数恒 0、对本次改动**不敏感**、属环境性旁证，承重判据 = 面板宽/右偏移/间隙 16/相交 0/正文右缘」。生产面同样只作**旁证**登记，**不当作承重绿**。

### 2.1 ≤390 档（面板全屏 + 单栏）

| 档 / 态 | 视口 | 面板 `w × h` | 全屏？ | 左栏 `display` | 右栏 `display` | 横向溢出 | 关闭键 |
|---|---|--:|:-:|---|---|--:|---|
| `390×844` · 列表态（`/messages?msg=1`） | 390×844 | **390 × 844** | **是** | **flex** | **none** | 0 | **44 × 44** |
| `390×844` · 会话态（`/messages?msg=1&c=1`） | 390×844 | **390 × 844** | **是** | **none** | **flex** | 0 | **44 × 44** |

⇒ **全屏（`100vw × 100vh`、`x=0 y=0`）+ 单栏两态可切 + 零溢出 + 关闭键触控目标 44×44** ⇒ 与本地质检 §2.2 的 `390` 档读数**逐值相符**。
（`messages-send-btn` = `null`：未登录态无会话可发 ⇒ 发送键不渲染，见 §7.1。）

---

## 3. 交互与四入口（**只读**）

> 读数 = `prod-probe.json → interactions`

| # | 判据 | 生产实测 | 结论 |
|--:|---|---|---|
| 1 | 悬浮菜单「消息」入口在场且可见 | `[data-sf-fm="messages"]` ⇒ `A`、`href = /messages`（**一字未改**）、`visible = true` | **PASS** |
| 2 | 点击后 **`pathname` 逐字不变** | `/exchange` → `/exchange`（`pathnameIdentical = true`） | **PASS** |
| 3 | 点击后 **`search` 变 `?msg=1`** | `''` → **`?msg=1`**（`searchBecameMsg1 = true`、`onlySearchChanged = true`） | **PASS** |
| 4 | 面板打开 | `panelPresentAfter = true` | **PASS** |
| 5 | **宿主节点不重挂** | `hostSameRef = true` · `hostChildSameRef = true` · `hostGrandChildSameRef = true`（三层同引用） | **PASS** |
| 6 | `scrollY` 前后相同 | `48 → 48` | **PASS** |
| 7 | history 语义 | 开 = `9 → 10`（**push**） | **PASS** |
| 8 | 点击那一刻零异常 | `onerror: []`、`rejection: []` | **PASS** |
| 9 | **浏览器后退能关** | `goBack` ⇒ `/exchange`、`search=''`、`panelClosed = true` | **PASS** |
| 10 | 面「×」能关（`replace`，history 不长） | 关后 `/exchange`、`search=''`、`panelClosed=true`、`10 → 10`（**未增长**） | **PASS** |
| 11 | **`/messages` 直链态「×」⇒ 回首页** | 载入 `/messages`（`search=''`）⇒ 点「×」后 `pathname = /`、`search=''`、`panelClosed = true`、`backToHome = true` | **PASS**（= 本地质检 `spec_drift` #2 的生产面复现；该条已由 `da705e2` 勘误补登 **收口**） |
| 12 | 点击全程零 `clickError` / 零 `closeError` | 两处皆 `null` | **PASS** |

**入口清单（生产面）**：本单按派单范围验 **② 悬浮菜单「消息」**（真点击）与 **④ `/messages` 直链**（含「×」回首页）；**① 底栏第 4 格**在生产 `1440` 档属既有 `display:none`（≥768 口径，非本单引入）⇒ 生产面未复点；**③ 详情页「聊一聊」**在登录态会 `POST /api/messages/conversations` ⇒ 遵「零写」纪律**未点**（其入口在场 + `href` 未改 + 落点命中 `T105` 已由本地质检逐字取证）。
> 结构上仍安全：探针在网络层对所有非 `GET` 请求 `abort` 并记账（§5），即便误触也不会写生产库。

---

## 4. 哨兵（数据层无回归）

> 落盘件 = `ops/v119-msg-panel/prod/readings/health.json` · `task_all.json` · `prize_all.json` · `sentinel-curl.log` · `sentinel-counts.txt`（`curl --resolve 0xseafood.com:443:76.76.21.21`，逐条核 `http_code`）

| 哨兵 | 改前基线 | **生产实测** | `http_code` / bytes | 结论 |
|---|---|--:|---|:-:|
| `/api/health` `schema_version` | `0048` | **`0048`** | 200 / 204 | **零位移** ✓（`ok=true`；`db_version = PostgreSQL 18.6`） |
| `/api/task/all` 行数 | **3** | **3**（`data` 数组 3 元素、`success=true`） | 200 / 1,284 | **零位移** ✓ |
| `/api/prize/all` 行数 | **4** | **4**（`data` 数组 4 元素、`success=true`） | 200 / 4,835 | **零位移** ✓（真路由 `/api/prize/all`，未打其它形式） |

- **本单零后端面** ⇒ 无迁移、无注册点变更（`105` 不变）；资产接口真路由 `/api/user/asset/:uID` 本单**无需读数**（未采）。
- `prize/all` 的 **4** 属仓内**既有漂移实例**（Kevin 指定测试商品；册记 `0→1→4`）⇒ **只登记、不当回归**。

---

## 5. 只读面（探针侧强制）

> 读数 = `prod-probe.json → readOnly`

- 对 `0xseafood.com` 的请求总数 **173**，**`nonGetRequests = []`（零非 `GET`）**，**`blockedWrites = []`（零被拦写动作）**。
- 路径清单（全 `GET`）：`/`(3) · 7 个 `/assets/*` 各 13 · `/images/partners/*.png` 各 13 · `/api/role-names` 13 · `/api/home` 9 · `/brand/favicon.svg` 18 · `/brand/favicon-32.png` 1 · `/exchange` 4 · `/messages` 5 · `/item/1` 1 · `/api/prize/1` 2。
- ⇒ **生产库零写**（不是「靠应用自律」而是**网络层强制**），未登录态亦未触发任何 401 后重试写。

---

## 6. 与本地质检（`7150278` · `docs/qa/v119-msg-panel-qa.md`）的对照

| 面 | 本地质检 | 生产终验 | 一致性 |
|---|---|---|---|
| 同版证明 | 本地产物名 `index-C3dRJ_m4.js`（当时基准） | 线上 7/7 产物**逐字同名 + 逐字节同哈希** | ✅ **闭合**（`f53c130d…`） |
| 桌面四档几何 | `600/104/240/360/16/0/0` | `1440` 档 **逐值相同** | ✅ |
| `1440` 「×」/后退 / 宿主同引用 | 绿 | **绿**（同 3 层同引用 + `replace` 不长 history） | ✅ |
| `/messages` 直链「×」→ 首页 | `pathname /messages → /` | **同型复现** | ✅（drift #2 已收口） |
| ≤390 全屏 + 单栏 + 触控 44 | 绿 | **绿**（390/844 两态） | ✅ |
| 零未捕获异常 | 13 态 `pageErrors=[]` | 4 态 + 交互态 **全 0**（自证钩子灵敏） | ✅ |
| 五 region 恒等 / 面板零 region | 绿 | **绿** | ✅ |
| 未登录态面板内容 | **未采**（夹具恒为登录态） | 本单**新采**：见 §7.1 | 登记 |

---

## 7. 登记项（**非缺陷**）与未测项（**原样保留 · 禁填 0/空**）

### 7.1 未登录态的面板内容面（**本单新采到的面** · 如实记录）

生产未登录态、`1440` 档 `/messages` 实测：

- 面板**照常挂载**：`title = 消息`、`[data-sf-m="messages-panel-list"]`（`flex`）+ `[data-sf-m="messages-panel-thread"]`（`flex`）两栏在场，几何 `240 + 360 = 600` **照常成立**（§2）。
- **左栏内容为空**：`conversation-item` 计数 **0**、`messages-list-empty` 文案 = **`null`**、`messages-detail-empty` 文案 = **`null`**、**未渲染任何登录引导钩子**（`[data-sf-m*="login"/"auth"/"sign"]` 命中 **`[]`**）。
- 面板子树元素数 **10**（登录态夹具版为 31）、`messages-send-btn` **不渲染**。
- ⇒ **结论**：未登录态下左栏**为空白**（既非登录引导、也非空态文案）；**属未登录态口径、登记不判缺陷**。本地质检未覆盖该态（其探针夹具恒为登录态，`unread_total=250` / 3 会话行）⇒ **两读数不矛盾，是覆盖面差异**。
- 建议（**交裁定，本单不擅自改**）：§21.12 未核实清单可追加一行「未登录态面板内容面 = 左栏空白、无引导文案」，供后续决定是否补登录引导。

### 7.2 未测 / 环境性（**原样保留**）

| # | 项 | 状态 |
|--:|---|---|
| 1 | `/hk` `/vn` 两语档**几何** | **`NOT_MEASURED`**（本地质检亦未采；本单未补） |
| 2 | 生产 `768 / 1024 / 1199` 中间档几何 | **`NOT_MEASURED`**（派单只要求 `1440` 档 + `≤390` 档；中间档已由本地质检四档覆盖） |
| 3 | 修饰键 / 中键（新标签）行为 | 生产面**未采**（本地质检已证 `defaultPrevented` 两态相反；`popup` 读数当时记 `ENV_LIMITED`） |
| 4 | 入口① 底栏第 4 格在生产的真点击 | 生产 `1440` 档既有 `display:none`（≥768 口径）⇒ 未复点 |
| 5 | 入口③ 详情页「聊一聊」在生产 | 登录态会 `POST` ⇒ 遵「零写」**未点**（本地质检已取证） |
| 6 | 首取 plain `/` 的边缘缓存旧 HTML | 环境性**假读数**，已归因并原样归档（§0.1）；**未改写为 PASS 反面** |
| 7 | 旧 HTML 引的 `index-Bl6P2cg0.css` 返 200-即-HTML | 瞬态边缘缓存伪影，已登记（§0.1） |

---

## 8. 回滚预案（**写进报告 · 本单未执行**）

- **首选**：`git revert da705e2..b776aee`（回滚 4 笔中的 3 笔实现/质检/收口，保留规范冻结）或整批回退 `git reset --hard fd34ca0` + push（**push = 重新部署前一代产物**）。
- **零数据面拉扯**：本单**无迁移**（生产 `schema_version` 仍 `0048`、注册点 `105` 不变）⇒ 回滚**不涉及任何 DB apply / 数据修复**。
- ⚠ **不依赖 Vercel CLI**：本机 CLI 账号 / scope 会被并行会话改掉（`vercel ls` 可能报 `Could not retrieve Project Settings`）⇒ CLI 侧回滚点/别名不可当既定前提；**`git revert` + push 是首选且自足**。
- 回滚后复核：`curl --resolve … /api/health`（`schema_version` 应仍 `0048`）+ 绕缓存取 `/` 取产物名（应回到 `index-DJNSZl46.js` / `index-Bl6P2cg0.css`）+ 真浏览器四态零白屏。

---

## 9. 读数清单（`ops/v119-msg-panel/prod/` · 随本提交入库）

见 `ops/v119-msg-panel/prod/readings/manifest.txt`（逐件字节 + sha256）。要点件：

| 文件 | 说明 |
|---|---|
| `prod-probe.mjs` | 自写生产探针（含只读闸 + error 钩子 + 尺子自证） |
| `prod-probe.json` | 探针全量读数（四态 / 1440 几何 / 交互 / 390 / 只读面 / 尺子灵敏度） |
| `prod-probe.log` | 探针运行日志（`exit=0`、`blockedWrites=[]`） |
| `readings/sha256-compare.txt` | 同版证明（线上 7 产物 vs 本地 dist：sha256 + `cmp`） |
| `readings/sameversion.txt` | 产物名对照（本地 / 线上绕缓存 / 线上 plain 复取） |
| `readings/http-headers.txt` | `http_code`/`size_download`/响应头（含旧 HTML 假读数归档说明） |
| `readings/prod-html-stale-first.html` · `readings/prod-html-fresh.html` | 旧 / 新 HTML 落盘真身 |
| `readings/health.json` · `task_all.json` · `prize_all.json` · `sentinel-curl.log` · `sentinel-counts.txt` | 哨兵 curl 落盘件 + 行数 |
| `logs/local-build.log` | 本地 `npm run build; echo exit=$?` 全量日志（`exit=0`） |

**复跑配方**：
```sh
# 本地重建 + 产物 sha256
cd frontend && npm run build; echo "exit=$?"
cd dist && shasum -a 256 assets/index-*.js assets/index-*.css
# 线上绕缓存取（先落盘再比对；严禁 | grep -c 直接判）
curl -sS -H 'Cache-Control: no-cache' --resolve 0xseafood.com:443:76.76.21.21 \
  -o /tmp/prod.html -w 'http=%{http_code} size=%{size_download}\n' "https://0xseafood.com/?cb=$RANDOM"
# 真浏览器探针（只读闸内置）
node ops/v119-msg-panel/prod/probe-prod.mjs ops/v119-msg-panel/prod
```

---

## 10. 纪律自检

- **生产面只读**：探针网络层 `abort` 一切非 `GET/HEAD/OPTIONS` ⇒ `blockedWrites=[]`、`nonGetRequests=[]`（§5）；未登录、未点任何写动作；**未在生产库造任何数据**。
- **零源码改动**：`git status --porcelain` 全程只有 `?? ops/v119-msg-panel/prod/` 与本报告；**未改 `frontend/**` / `docs/design/**` / `docs/route-layer.spec.md` / `backend-ts/**` 一字**。
- **零 push**：本阶段只出报告与读数；`origin/main..HEAD` 交回时需要由 Zang 决定是否收口（本单 commit **未 push**）。
- **提交切分**：只 `git add docs/qa/v119-msg-panel-prod.md ops/v119-msg-panel/prod/`（**未 `git add -A`**）。
- **环境性读数原样保留**：§0.1 / §7.2 全部原样登记，**未手改成 PASS**。
