# Neng 质检报告 · v1.21「顶栏实黄」（§23 · `T114`–`T119` · AC-1–AC-10）

> ★ **本文件由 Zang 按 Neng 交接内容回填**（Neng 于迭代上限前完成**全部探针与读数**，未及回填正文；骨架由 Neng 先落盘）。**所有判定与读数均来自 Neng 自写自跑的探针**，逐条可复核，证据索引见 §8。
> **总判：AC-1 – AC-10 全 PASS；缺陷 0 条；两向灵敏度自证成立。**

## 0. 元信息

| 项 | 值 |
|---|---|
| 被检面 | 第二笔「顶栏实黄」：`frontend/src/styles.css` / `frontend/src/components/Header.jsx` / `frontend/src/components/ui/HoverMenu.css`（落笔后 = commit `c412c7e`）|
| 被检 revision | 源码 = `ad52533` + 上述改动（今 = `c412c7e`）；父版基线 = **`4b388d0`**（`git worktree add --detach`）|
| 被检树 | 自跑 `npm run build` 的 `frontend/dist` 静态产物（`context.route` 映射到磁盘，**零 dev server / 零后端 / 零库写**）+ 源码只读核 |
| 规范真源 | `docs/design/design-system.spec.md` **§23（v1.21）**：`T114`–`T119` + 对比度表 14 行 + AC-1–AC-10 + `N52`/`N53` |
| 质检方 | Neng（质检员）· 自写自跑探针 · **不采信实现方读数**（`kong-*` / `jing-*` 只作旁证）|
| 纪律 | 只读被测代码；不 `npm install`；不 commit / push / `git add -A`；不启停服务；参考图 sha256 收尾复核（Zang 已逐字复核：`c7a0aa9f…fa0` / `be25f542…491` = 与开局相同）|

## 1. 主判定总表（AC-1 … AC-10）

| AC | 判据（摘要） | 判定 | 关键读数 | 读数件 |
|---|---|---|---|---|
| AC-1 日档顶栏像素 | 390/1440/1600 `#header` = `rgb(253,232,21)` + alpha 1 + `backdropFilter:none` + 边框 `rgb(3,4,2)`；**合成像素回读** | **PASS** | computed 三档全中；**合成像素直方图众数均 `253,232,21,255`（占 88.7–94.5%）**；页头下方带众数 `rgb(225,225,225)` ≠ 顶栏色（直方图能分区） | `qa/neng-v121-pixels.json` |
| AC-2 夜档冻结 | 三档 `rgb(31,41,55)` + `1px solid rgb(55,65,81)` + `blur(4px)` + rect 不变；**逐元素 attrDiff=0**；**反向臂** | **PASS** | 合成像素亦 = `rgb(31,41,55)`；**反向臂（去日档限定）⇒ computed 且合成像素均变 `rgb(11,12,14)`**，移除后回 `rgb(31,41,55)` ⇒ 日档限定**承重**、尺子有分辨力。逐元素 computed-style diff = 0 / rect diff = 0；差异仅 3 个元素 class 字面互换（夜间同色，属 `T119②` 实现） | `qa/neng-v121-pixels.json` |
| AC-3 前景硬门 | 逐行复算（logo / `.nav-link` base·hover·active / 注册·登录 base·hover / 汉堡·主题钮）；夜档维持 | **PASS** | 真 hover（`page.hover()`，`matches(':hover')=true`）：logo **15.773**（大字阈 3）、`.nav-link` **6.021 → 15.773**、注册/登录 6.021 → 15.773、主题钮 6.021 → 15.773、`.active`（`/task`）`rgb(10,10,10)` on `rgb(243,244,246)`、汉堡 6.021 → 16.119。**父版对照 = 修复证据**：logo **2.899 ✗**、`.nav-link:hover` **3.144 ✗**、注册/登录 hover **2.899 ✗**、主题钮 hover **3.144 ✗**。夜档 7 处 `rgba(255,255,255,.92)` on `rgb(31,41,55)` = **12.628**，与父版逐值相同（未退化） | `qa/neng-v121-hover-contrast.json` / `-b.json` |
| AC-4 不透明不穿透 | alpha=1 + 滚动复读 + `elementFromPoint` 命中 `#header` 子树 | **PASS** | 滚动后复读 alpha 1 / backdrop none；`elementFromPoint` 3/3 命中 `#header` 子树。（另：顶栏 `sticky` **声明不生效**，`rect.y=-400 @scrollY 400` —— **父版同形**，本笔未改，已在册登记） | `qa/neng-v121-pixels.json` |
| AC-5 归因式不动面 | 父版 vs 现版逐元素差异集 ⊆ 允许变更集；日夜两档反事实回退 ⇒ 空 | **PASS** | 20 格（6 路由 × 日/夜 × 390/1440/1600 + 375/320，含 `/item/1`、`/messages`）**rect diff 合计 = 0**；**反事实臂（日/夜分别回退 CSS + 3 个 class 字面复原）两档差异集均为空**。噪声基线：归一化 sha 相同、raw sha 不同（噪声源具名 = `frontend/src/components/Footer.jsx:12` 模块加载期 `Math.random()`）| `qa/neng-v121-geometry.json` / `neng-v121-attrib.json` |
| AC-6 结构不变式 | `shell.css` 1 断点 / 0 `data-theme`；五 region；`TOKEN_KEYS`/`STRUCT`；token 文件零 diff；`.nav-link[href]` 集 | **PASS** | `shell.css` `@media`=1 / `data-theme`=0 / **sha256 与父版逐字相同**；五 region = `shell/topnav/content/footer/tabbar`；`.nav-link[href]` = `/exchange,/profile,/task`；`tokens.js` / `theme-tokens.css` / `ThemeProvider.jsx` 零 diff | `qa/neng-v121-static.json` |
| AC-7 门套 | build exit 0；`test:unit` ≥ 54 files / 520 tests | **PASS** | `✓ built in 1.89s` EXIT=0（产物 `index-_MHXbVv1.js` / `index-UdAFWx1k.css`）；`Test Files 54 passed (54)` / `Tests 520 passed (520)` EXIT=0 | `qa/neng-v121-build.log` / `qa/neng-v121-testunit.log` |
| AC-8 灵敏度两向自证 | 负控臂 + 复原臂 | **PASS** | 负控 `#FFFFFF` ⇒ computed 与合成像素均 `rgb(255,255,255)`；复原 ⇒ 回 `rgb(253,232,21)` | `qa/neng-v121-pixels.json` |
| AC-9 零几何 | 日/夜 × 390/1440/1600（+375/320）`#header`/`.sf-region-top`/`.sf-route-container` rect 父版逐值相同 | **PASS** | 20 格 rect **父版逐值相同**（1600 档 routeContainer `[80,65,1440,…]` 一致）| `qa/neng-v121-geometry.json` |
| AC-10 移动档 | 390/375/320 顶栏实黄 + 汉堡面板展开态 | **PASS** | 390/375/320 顶栏实黄 alpha=1；汉堡面板展开态 `#header` rect `(0,0,390,500)` 底色不变；面板自带底 `rgba(255,255,255,0.95)` | `qa/neng-v121-pixels.json` |

## 2. 冻结面（§23.4 清单 B + §23.6）

| # | 断言 | 判定 | 读数 |
|---|---|---|---|
| B1–B4 | `theme-tokens.test.js` 键集/键序/黑名单/PROV/生成物 | **PASS（未破）** | `qa/neng-v121-static.json`（token 文件零 diff ⇒ 零改锚）|
| B5–B6 | 底栏五项 DOM / 四语键集相同 | **PASS（未破）** | 同上 |
| B7 | i18n 计数（顶层 128 / 拍平 1104 / 四语节点 4416）| **PASS** | 同上（零新键）|
| B8 | 本仓无测试锚定 `#header` 外观类 | **PASS** | 同上（真改锚 = 0 条）|
| 冻结面 | `pages/item/**` / `pages/theme-preview*` / 后端 / `docs/**` 零改动 | **PASS** | `git diff --numstat` 逐件：上述目录 `(empty)` |

## 3. 专项判定（两处）

| 项 | 判定 | 依据 |
|---|---|---|
| 主题钮 `className="nav-link"`（`Header.jsx:253`）| **册面描述差 · 非产品缺陷** | 册 §23.3 第 8 行把它归入「汉堡族（自带 `hover:bg-gray-100`）」；实测其 hover 走 `.nav-link:hover` 系，**父版 2.54–3.144 ✗** ⇒ 本笔的 `#header .nav-link:hover` 覆盖**把它一并修好**（15.773）。建议册面就地注 |
| 移动面板「登录」胶囊 | **既有缺陷 · 非本笔引入** | 白字 on 合成 `rgb(205,144,16)` = **2.766**（未合成路径 2.938）✗；**父版 = 2.766 同形**（注册 4.742 vs 父 4.730）⇒ 与册 §23.7 第 6 项挂账一致 |

## 4. 缺陷 / 观察 / 建议（三分类）

- **缺陷：0 条。**
- **观察**：① 夜档「热门任务 / 精选奖励」等小标题 = 深灰字压深底、几乎不可见 —— **父版同形、非本笔引入**（属「夜档另议」族）；② 顶栏 `sticky` 声明不生效（父版同形）；③ 移动面板「登录」胶囊 2.766 ✗（父版同形）。
- **建议**：① 册面 §23.3 第 8 行就地注（主题钮归 `.nav-link` 族）；② 上述三条观察并入「夜档另议 / 既有缺陷」另立单。

## 5. 归因

本笔可视化差异 **100% 归因**于批准变更集（`styles.css` 顶层 `#header` 日档底色/边框/背滤规则 + `HoverMenu.css` 的 `#header .nav-link:hover/.active` + `Header.jsx` 三处类名替换）：
- **反事实臂**：日/夜**分别**回退 CSS 并复原 3 个 class 字面 ⇒ 差异集 **两档均为空**（`cf empty = true`，rect/style/attrs/text 全 0）。
- **零几何**：20 格 rect 父版逐值相同。
- **夜档未动**：computed-style diff = 0、合成像素不变。

## 6. 诚实清单（`NOT_MEASURED` / `ENV_LIMITED` · 原样保留 · 禁填 0/空）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 截图腿「≥2 张**商品**卡」 | **弱证据 / `NOT_MEASURED`** | 程序化计数用了错选择器（真实类 = `.sf-reward-card`，且位于 y≈691 以下）⇒ 该格不成立。`vision_analyze` 已确认 390 日档为**未滚动、顶栏实黄、2 张卡可见**；Zang 另用**真数据 dev 站**补拍 `shots/final-*.png`（1600/390 × 日/夜，含页头 + 卡片区）|
| 2 | 报告正文 | **由 Zang 按交接落盘** | 读数全部落盘、可复核（本文件）|
| 3 | 参考图 sha256 | Neng 侧**未与期望值逐字比对** | Zang 已逐字复核一致 |
| 4 | 取数路径变更留痕 | 记录 | ① 裸 CDP `Page.captureScreenshot` 本机报 `Invalid parameters` ⇒ 改 **Playwright `page.screenshot` + canvas 回读**（仍是合成像素）；② `leg2b` 先误用 `:has-text`（Playwright 定位器伪类，浏览器选择器不认）⇒ 改 ElementHandle 路径；③ `leg3` 分类器曾把 `outlineColor`（随 `color` 联动）误判 not-attributable ⇒ 修正规则并**保留 `unexpectedRaw=12`**（原判据过严）。**以上均非把 FAIL 改 PASS。** |
| 5 | 真机观感 | `NOT_MEASURED` | 全 headless 设备档 |
| 6 | `lint` | 未跑 | 仓内无 eslint 配置（存量口径）|
| 7 | 前端 `tsc` | `N/A` | 无 tsconfig |
| 8 | 后端 `p8-*` | 未跑 | 本笔零后端改动 |

## 7. 截图

`shots/neng-v121-390-日档.png` · `neng-v121-390-夜档.png` · `neng-v121-1600-日档.png` · `neng-v121-1600-夜档.png` · `neng-v121-hover-navlink-日档-1600.png`（sha256 见 `qa/neng-v121-shots-sha256.txt`）。
补充（Zang 真数据）：`shots/final-1600-日档-顶部.png` · `final-1600-日档-卡片.png` · `final-1600-夜档-顶部.png` · `final-1600-夜档-卡片.png` · `final-390-日档-顶部.png` · `final-390-夜档-顶部.png`。

## 8. 证据索引（AC → 读数文件）

| AC | 读数件 |
|---|---|
| AC-1 / AC-2 / AC-4 / AC-8 / AC-10 | `qa/neng-v121-pixels.json`（+`-stdout.txt`）|
| AC-3 | `qa/neng-v121-hover-contrast.json` · `neng-v121-hover-contrast-b.json`（+`-stdout.txt`）|
| AC-5 | `qa/neng-v121-attrib.json` · `neng-v121-attrib-summary.json` |
| AC-6 | `qa/neng-v121-static.json` |
| AC-7 | `qa/neng-v121-build.log` · `neng-v121-testunit.log`（★ `.log` 被 `.gitignore` 命中 ⇒ 入库需 `git add -f`）|
| AC-9 | `qa/neng-v121-geometry.json` |
| 探针（可复跑）| `qa/neng-v121-probe-pixels.mjs` · `-probe-hover.mjs` · `-probe-hover-b.mjs` · `-probe-geometry.mjs` · `-probe-shots.mjs` · `neng-v121-static.mjs` · `neng-v121-postprocess.mjs` |

## 9. 现场清理

- 父版 worktree `/…/scratch/neng-v121/parent` ⇒ **已由 Zang `git worktree remove --force` + `prune`**；`git worktree list` 现仅主仓 `c412c7e [main]`。
- 前端源码零改动（`git status --porcelain` 仅 `ops/**` 未跟踪件）。
- 参考图 sha256 与开局**逐字相同**。
