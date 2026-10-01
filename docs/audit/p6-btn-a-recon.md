# P6 · 变体 A 按钮改造：真值清单 + 映射表 + 令牌方案（只读 recon）

- 单号：**BTN-A-RECON**（Kong，只读）
- 范围：**只读取证 + 出方案**；本单**未改任何代码/样式**，未 `git add/commit/push`，未起停服务，未 `npm install`。
- 取值口径：**CSS 值为现读盘面**（`文件:行号`）；**未在浏览器里量测任何高度** ⇒ 所有 height 均为**推算**（给公式），凡未跑的命令一律 `NOT_MEASURED`。
- 仓库：`/Users/kevin/bistro/seafood`（前端 `frontend`，Vite + React + 自建 token 主题层）。

## §0 已拍板口径（不重新论证）+ 必须先解的 3 个命名/语义冲突

已拍板：**变体 A = 圆角扁平**（取消切角 `clip-path`）+ 主操作 = **黄底黑字** + 次操作 = **白底 + 1px 浅灰描边 + 深字**。
参考图**像素取样实测值**（用户提供，非本单量测）：背景 `#FFFFFF`；主填充 `#FFE60F` / 文字 `#202020`；次填充 `#FFFFFF` / 1px 描边 `#E0E0E0` / 文字 `#202020`；**无阴影**；圆角 = `round(高 × 0.17)`；水平内边距 = `高 × 0.45`。

⚠ 冲突 1 —— **"变体 A" 是同名异义**：`frontend/src/theme/tokens.js:3-5` 里「变体 A」指的是 `docs/design/style-preview.html` 的**日档「码头大牌」**（黑底黄字 + 切角/硬投影 + 品牌黄 `#FDE815`）。本单用户口中的「变体 A」是**圆角扁平**。落地时必须改称呼（如 `btn-a-flat`），否则会与 token 真源注释／既有 audit 全部撞车。

⚠ 冲突 2 —— **日档是整页黄底**：`tokens.js:30` / `theme-tokens.css:45` `--sf-page-bg: #FDE815`（夜档 `#0B0C0E`）。主操作填充 `#FFE60F` 与页面底色 `#FDE815` **亮度/色相几乎重合** ⇒ 日档页面上「黄底黑字」按钮会与背景糊在一起。**这是本方案最高危的点**，必须先定：日档主操作要么保留描边（`#202020`/`#E0E0E0` 二者之一，参考图未展示描边 ⇒ 推断），要么日档改用深色底。（本条仅供拍板，本单不动。）

⚠ 冲突 3 —— **token 溯源硬门**：`frontend/src/test/unit/theme-tokens.test.js:68-94` 要求**每个 token** 的 `PROV[key].d/.n` 都指向 `TOKEN_SOURCE_FILE = docs/design/style-preview.html` 的**某一行的原文片段**（归一化后 substring 命中）。`style-preview.html` 中只有 `#FDE815 / #030402 / #0B0C0E` 一系；在我本次读取的 `tokens.js`(1-458)、`theme-tokens.css`(1-263)、`styles.css:79-251` 全文里**未见** `#FFE60F / #E0E0E0 / #202020`。⇒ 直接把新色写进 `tokens.js`，`theme-tokens.test.js` 会**判负**。三条出路见 §3.3。

## §1 按钮真值清单（现读盘面）

### ① `.btn` 基类与 8 个变体（`frontend/src/styles.css`）

**基类 `.btn` = styles.css:79-118**（无 `background-color`、无 `border`、无 `font-size`）：

| 属性 | 现值 | 行号 |
|---|---|---|
| 布局 | `display:inline-flex; align-items:center; justify-content:center` | :80-82 |
| padding | `0.5rem 1rem`（= 8px 16px） | :83 |
| 圆角 | `border-radius: 0`（注释「移除圆角」） | :85 |
| **切角** | `--btn-cut-size: 10px` + `clip-path: polygon(...8 顶点...)`（含 `-webkit-` 双写） | :87-107 |
| 字重 | `font-weight: 500` | :108 |
| transition | background-color/filter/box-shadow/opacity/transform | :109 |
| **填充** | `background-image:` **三重渐变**（radial `--gem-light/--gem-base/--gem-dark` + 135° 白高光 + 45° 黑压角）——**实际填充是渐变，不是纯色** | :110-113 |
| **阴影** | `inset 0 1px 0 rgba(255,255,255,.65), inset 0 -2px 12px rgba(0,0,0,.12), 0 6px 18px rgba(0,0,0,.14)` | :114-117 |
| 伪元素 | `::before` 全幅 screen 混合高光 opacity .7（:120-128）；`::after` 流光扫条 + `:hover` 动画 `glintSweep .8s`（:130-143） | :120-143 |

**尺寸档（styles.css:145-158）**：`.btn-sm` `padding:.375rem .75rem`(6/12) + `font-size:.875rem`(14) ｜ `.btn-md` `8/16` + `1rem`(16) ｜ `.btn-lg` `12/32` + `1.125rem`(18)。
**推算高度（非实测）**：高 = pad-top + pad-bottom + line-height。若行高 = 1.5×字号 ⇒ sm 33px / md 40px / lg 51px；若行高为 button 默认 `normal`(≈1.2) ⇒ sm ≈29px / md ≈35px / lg ≈47px。**本单未在浏览器量测 ⇒ `NOT_MEASURED`**（第二批开工前用 §4 AC1 的尺子先量一次）。

**8 个变体（逐条现取值）**：

| 变体 | 填充（background-color / background 等） | 文字 | 其他 | 行号 |
|---|---|---|---|---|
| `-inactive` | `var(--bg-muted)` = `#f3f4f6` 日（styles.css:31）/ `#374151` 夜（:63）；`--gem-*` = `#d1d5db/#9ca3af/#f3f4f6` | `var(--text-secondary)` `#4b5563`/`#d1d5db` | hover filter .98、focus `0 0 0 2px rgba(107,114,128,.30)` | :161-167 |
| `-primary` | `var(--secondary-color)` = `#FFCE00` 日（:14）/ `#ffda44` 夜（:53）；`--gem-*` = `--secondary-color/#d5b000/#ffe37a` | `var(--text-primary)` `#111827`/`#f9fafb` | focus `rgba(255,206,0,.35)` | :170-176 |
| `-proceed` | `var(--tone-blue)` `#3b82f6`（:19；夜档无覆盖 ⇒ 仍 `#3b82f6`） | `#fff`，**font-weight 600** | focus `rgba(59,130,246,.30)` | :179-186 |
| `-success` | `var(--tone-green)` `#10b981`（:20） | `#fff` | focus `rgba(16,185,129,.35)` | :189-195 |
| `-warning`（危险） | `var(--error-color)` `#ef4444`（:25）/ `#f87171` 夜（:57） | `#fff` | focus `rgba(239,68,68,.35)` | :198-204 |
| `-outline` | `background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96))`（覆盖 gem） | `var(--primary-color)` `#00529B`/`#0062b3` | `border: 1px solid rgba(0,82,155,.22)`；`box-shadow: inset 0 1px 0 rgba(255,255,255,.75), 0 4px 12px rgba(0,0,0,.08)` | :207-216 |
| `-ghost` | `rgba(255,255,255,.55)` | `var(--text-secondary)` | `box-shadow:none`、`border:1px solid transparent`、`:before/:after{display:none}`、hover 改 `rgba(15,23,42,.06)` | :219-231 |
| `-info` | `var(--primary-color)` `#00529B`/`#0062b3` | `#fff` | focus `rgba(0,82,155,.28)` | :234-240 |

**通用态**：`:disabled` `opacity:.6` + `cursor:not-allowed` + `filter:none`（:243-247）；`:hover` `transform: translateY(-1px)`（:249）；`:active` 覆盖式 `box-shadow: inset 0 2px 10px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.12)`（:251）。
**JS 侧映射**：`frontend/src/components/ui/Button.jsx:5-21` —— `variant` → `btn-* bg-* text-*`（Tailwind 兼容层实际值见 `styles/tailwind-compat.css:338-350`：`bg-yellow-500`=rgb(234,179,8)、`bg-blue-600`=rgb(37,99,235)、`bg-red-500`=rgb(239,68,68)…，**会覆盖 CSS 里的 `background-color`**，但**盖不住 `background-image`** ⇒ 现在按钮真色其实来自渐变）；`size` → `btn-sm/md/lg px-* py-* text-*`（**与 CSS 档同值**）。

### ② `.sf-btn` 家族（新 shell 一系）

- 基类 **`shell/shell.css:190-196`**：`background: var(--sf-btn-bg)`、`color: var(--sf-btn-fg)`、`border: 0`、`border-radius: var(--sf-btn-radius)`、`box-shadow: var(--sf-btn-shadow)`（**无 padding / 无 font-size / 无 min-height ⇒ 尺寸全靠页面级 micro 类**）。
- 生效值（**日/夜差异极大**）：`theme-tokens.css:55-58` 日档 `bg #030402 / fg #FDE815 / radius 11px / shadow 2px 2px 0 rgba(3,4,2,.35)`；`:166-169` 夜档 `bg #FDE815 / fg #0B0C0E / radius 2px / shadow none`。⇒ **只有夜档与用户拍板的「黄底黑字」一致；日档是黑底黄字**（见 §0 冲突 2）。
- 页面级 micro 类（只加尺寸，不动颜色）：
  - `pages/jobs/jobs.css:98-108` `.sf-jobs-btn` `padding:8px 12px; font-size:13px; min-height: var(--sf-j-ctl-h)`；`--sf-j-ctl-h: 34px` 定义在 `jobs.css:15`；`[disabled]{opacity:.6}`
  - `pages/market/market.css:172-182` `.sf-mkt-btn` `padding:8px 12px; font-size:13px; min-height: var(--sf-k-ctl-h)`（`--sf-k-ctl-h` 定义行号**本单未取** ⇒ `NOT_MEASURED`，同为 34px 量级待核）
  - `pages/listings/listings.css:180-190` `.sf-listings-btn` `padding:8px 12px; font-size:13px; min-height: var(--sf-l-ctl-h)`（同上，定义行号 `NOT_MEASURED`）
  - `pages/theme-preview.css:39-48` `.sf-preview-btn` `padding:9px 16px; font-size:13.5px; font-weight:800`；`.is-on` 用 `outline: 2px solid var(--sf-tab-active-fg)`
- **推算高度**：`8+8+13×line-height`；行高 1.2 ⇒ 31.6px **被 min-height 34px 抬到 34px** ⇒ **`min-height` 决定实际高 ≈34px**（推算，未量测）。

### ③ chip / 分类 / 筛选

- `shell/shell.css:178-188` `.sf-chip` → `background: var(--sf-cat-bg)`、`border: 1.5px solid var(--sf-cat-border)`、`border-radius: var(--sf-cat-radius)`、`color: var(--sf-cat-fg)`；`.is-on` → `--sf-cat-on-bg/-fg`。
- token 现值：`tokens.js:57-62` 日档 `bg #fff / border #030402 / fg #0A0A0A / radius 999px / on-bg #030402 / on-fg #FDE815`；`:167-172` 夜档 `bg #15171B / border #2A2D33 / fg #C4C9D0 / radius 2px / on-bg #FDE815 / on-fg #0B0C0E`。
- 尺寸覆盖：`pages/theme-preview.css:62-65` `.sf-preview-chips .sf-chip{font-size:12.5px; padding:6px 13px}`。
- **用法（全仓 grep 结果）**：仅 `pages/ThemePreviewPage.jsx:106`（语言 chip，`is-on` 跟随当前语言）与 `:119`（分类 chip 示例）。⇒ **海鲜市场主流程目前没有可交互的分类筛选 chip**（招工/上市/市场页内无 `.sf-chip`），本单把它登记为「存在但未在主流程渲染」，不纳入本批改造面。

### ④ 底部 Tab（导航，非按钮）

- `shell/shell.css:63-68` `.sf-tabbar`（宽屏 `display:none`；≤767px 变 `grid` 5 列 + `sticky bottom`，:113-120）。
- `:70-80` `.sf-tab` `padding: var(--sf-st-tab-pad)` = `8px 0 12px`、`font-size: var(--sf-st-tab-font-size)` = `10.5px`、`color: var(--sf-tab-fg)`；`:82-85` `.is-active` 改 `--sf-tab-active-fg` + `font-weight:700`；`:87-90` `.sf-tab-ic` 22×22。
- **推算高度** ≈ 8 + 12 + 22 + gap 3 + 10.5×1.2 ≈ **57.6px**（未量测）。DOM 见 `shell/BottomTabBar.jsx:31`；元素是 `<a>`/Link，**不是 button** ⇒ 本批不动，列 §4 邻接项。

### ⑤ 表单提交与「危险操作」按钮 —— 页面级清单（`data-sf-m` 为稳定钩子）

| 页面文件 | 行号 | `data-sf-m` | 语义 |
|---|---|---|---|
| `pages/jobs/JobReviewPage.jsx` | :112 | `jobs-refresh` | 刷新（次） |
| 〃 | :138 | `jobs-approve` | 通过（主） |
| 〃 | :141 | `jobs-reject` | **危险（拒绝）** |
| `pages/jobs/PublishJobPage.jsx` | :106 | `jobs-primary` | **表单提交** |
| `pages/jobs/JobDetailPage.jsx` | :139 | `jobs-apply` | 主操作（报名） |
| 〃 | :182 | `jobs-submit` | **表单提交** |
| 〃 | :209 | `jobs-accept` | 主操作（接单） |
| 〃 | :237 | （无钩子） | 列表项选中 |
| `pages/TaskPage.jsx` | :238/:239 | `jobs-nav-publish` / `jobs-nav-review` | **`<Link className="sf-btn sf-jobs-btn">`**（a 上挂按钮类，改样式会同时影响 a 的 `text-decoration`/对齐） |
| `pages/listings/ListingsPage.jsx` | :98 | `listing-refresh` | 刷新（次） |
| 〃 | :159 | `listing-refund-btn` | **危险（退款）** |
| `pages/listings/ListingDetailPage.jsx` | :81/:119 | `listing-detail-refresh` / `listing-buy-btn` | 次 / **交易主操作** |
| `pages/listings/PublishListingPage.jsx` | :92/:123 | `listing-goto-feed` / `listing-primary` | 次 / **表单提交** |
| `pages/market/MarketPage.jsx` | :181/:247 | `mkt-refresh` / `mkt-primary` | 次 / **表单提交**（`disabled={act.phase==='loading'||!isAuthenticated}`） |
| 〃 | :302 / :323 | （列表内动作按钮，`sf-btn sf-mkt-btn`） | 待细分 |
| `pages/ThemePreviewPage.jsx` | :98/:99 | `toggle-day` / `toggle-night` | 主题切换（`.sf-preview-btn`） |
| `components/ClaimRewardModal.jsx` | :81 | — | 旧代 `.btn.btn-inactive`（取消） |
| `components/ActiveTaskModal.jsx` | :140 / :148 | — | 旧代 `.btn.btn-inactive` / `.btn.btn-proceed` |

**用 `<Button>`（`.btn` 族）的页面（第二批收敛面）**：`HomePage.jsx:225,230,244,276`、`ProfilePage.jsx:192,223,233,241`、`AuthPage.jsx:142`、`RewardPage.jsx:207,252`、`DashboardPage.jsx:294,409,430,472,483,542`、`components/{reward/RewardCard.jsx:144, task/TaskCard.jsx:127, auth/WalletAuthPanel.jsx:175,186, layout/AdminLayout.jsx:137,182}`、admin：`SystemSettings.jsx:144`、`UsersManagement.jsx:210,288,298`、`PermissionsManagement.jsx:212,216,273,282,354,357`、`TasksManagement.jsx:119,148,241`、`ShardsManagement.jsx:119`、`RewardsManagement.jsx:209,248,437`、`PointsManagement.jsx:236,303,313,390,397`。
**纯原生 `<button>`（不带 `.btn`/`.sf-btn`，Tailwind 类或图标钮，本批**不**纳入，仅登记）**：`components/Header.jsx` 15 处（:181,192,199,206,213,223,236,266,276,283,296,332,341,360,370,380,390,405,420）、`components/LoginModal.jsx:54,73`、`components/ui/{MicroInteractions,Form,Advanced,ErrorHandling,Tabs,Toast,Performance,Modal}.jsx`、`ClaimRewardModal.jsx:52`（`✕`）。

## §2 映射表（现有 → 变体 A）

**换算口径（全部按用户给定实测比例，高度用 §1 推算值；`round()` = 四舍五入到整像素）**

| 目标 | 高（推算） | 圆角 = round(h×0.17) | 水平内边距 = round(h×0.45) | 现值对照 |
|---|---|---|---|---|
| `.btn-sm` | 33px | round(5.61) = **6px** | round(14.85) = **15px**（现 12px） | 取换算值（15 > 12，可读性更好，且不再依赖 Tailwind `px-3` 覆盖） |
| `.btn-md` | 40px | round(6.8) = **7px** | round(18.0) = **18px**（现 16px） | 取换算值 |
| `.btn-lg` | 51px | round(8.67) = **9px** | round(22.95) = **23px**（现 32px） | 换算值 23px 与现 32px 差 9px ⇒ 取换算值（更贴合参考图比例），如用户觉得太窄则回退 32px 并在报告注明 |
| `.sf-jobs-btn` / `.sf-mkt-btn` / `.sf-listings-btn` | **34px**（`min-height` 决定，见 §1②） | round(5.78) = **6px** | round(15.3) = **15px**（现 12px） | 取换算值 |
| `.sf-preview-btn` | 34.2px | round(5.81) = **6px** | round(15.39) = **15px**（现 16px） | 取换算值 |
| `.sf-tab*`（**本批不动**，仅登记） | ≈57.6px | round(9.79) = 10px | round(25.9) = 26px | 导航元素，不入本批 |

**逐变体映射**

| 现有 | 现填充 / 现文字 / 现描边 / 现圆角 / 现阴影 | → 目标（变体 A） | 依据 |
|---|---|---|---|
| `.btn` **基类** | 渐变三重 / 继承 / 无 / 0 / 三层含外投影 | **删** `clip-path`+`--btn-cut-size`（styles.css:87-107）、`background-image`（:110-113）、`box-shadow`（:114-117）、`::before`/`::after`+`glintSweep`（:120-143）、`:hover translateY(-1px)`（:249）、`:active` inset 阴影（:251）；加 `border-radius:<档>`、`border:0`、`background-color:<语义填充>` | 参考图**实测**（圆角扁平 + 无阴影） |
| `-primary`（主操作） | `#FFCE00` 日/`#ffda44` 夜 + 深字 `#111827`/`#f9fafb` + gem 渐变 + 外投影 | 填充 **`#FFE60F`**、文字 **`#202020`**、描边 **无**、圆角 7px（md 档）、无阴影 | **参考图实测** ✅（注意 ≠ 现品牌黄 `#FFCE00`/`#FDE815`，是**换色**） |
| `-outline`（次操作） | `linear-gradient(白)` / `#00529B` 蓝字 / `1px rgba(0,82,155,.22)` 蓝描边 / 硬阴影 | 填充 **`#FFFFFF`**、文字 **`#202020`**、描边 **`1px #E0E0E0`**、圆角 7px、无阴影 | **参考图实测** ✅（代价：丢蓝色语义，见下注） |
| `-ghost` | `rgba(255,255,255,.55)` / `#4b5563` / `transparent` / 无阴影 | 两种落法，需拍板：**(a)** 与 `-outline` 合并为「次操作」同一形态；**(b)** 保留无描边幽灵 = 填充 `#FFFFFF`、描边 `transparent`、文字 `#202020` | **(b) 为推断**（参考图只有「白底+灰描边」一种次形态） |
| `-inactive`（禁用） | `#f3f4f6` 日/`#374151` 夜 + `#9ca3af` gem | 次操作同形（`#FFFFFF` + `1px #E0E0E0` + `#202020`）+ **保留** `:disabled opacity .6`（styles.css:243-247 不动） | **推断**（参考图未展示禁用态）；夜档若用白底会与夜底 `#141619` 强反差 ⇒ 建议夜档 inactive 改用 `--sf-search-bg`(`#15171B`)+`--sf-search-border`(`#33373D`) 并**明确标注为非参考图实测** |
| `-proceed` | `#3b82f6` / `#fff` / 无 / 硬阴影 | **推断**：沿用现有语义色 `#3b82f6`，白字保留，**仅去切角/渐变/阴影** + 统一圆角与内边距 | 参考图**无蓝色** ⇒ 推断 |
| `-success` | `#10b981` / `#fff` | **推断**：同上，保留 `#10b981` + 白字，扁平化 | 推断 |
| `-info` | `#00529B`/`#0062b3` / `#fff` | **推断**：同上 | 推断 |
| `-warning`（危险） | `#ef4444` 日/`#f87171` 夜 / `#fff` | **推断**：保留红色语义 + 白字，扁平化（**不得**套用主操作黄） | 参考图**无危险色** ⇒ 推断 |
| `.sf-btn`（日档） | `#030402` 底 / `#FDE815` 字 / radius 11px / `2px 2px 0 rgba(3,4,2,.35)` | 填充 `#FFE60F`、文字 `#202020`、radius 6px、`box-shadow: none` ⇒ **日档由「黑底黄字」翻转为「黄底黑字」** | 参考图实测；⚠ 与 §0 冲突 2（日档整页黄底）叠加后**必须在日档加描边**否则不可辨 —— 待拍板 |
| `.sf-btn`（夜档） | `#FDE815` 底 / `#0B0C0E` 字 / radius 2px / none | 填充 `#FFE60F`、文字 `#202020`、radius 6px、none | 参考图实测（夜档差在色值 `#FDE815→#FFE60F`、`#0B0C0E→#202020`、`2px→6px`） |
| `.sf-chip`（登记，不在本批） | 日 白底/1.5px `#030402`/999px；夜 `#15171B`/`#2A2D33`/2px | 若同批统一：日 → `#FFFFFF` + `1px #E0E0E0` + `#202020`；圆角参考图未展示 ⇒ **推断**保留 999px（胶囊）或统一 6px | 推断 |

**两条待拍板注**：
1. **蓝色会丢**：`-outline` 由「白底蓝字蓝边」变「白底深字灰边」后，全站唯一的「强调蓝」会只剩 `-info`/`-proceed`/Header 链接。若想保留「次操作 = 蓝描边」，则 `#00529B`/`#E0E0E0` 二选一与参考图冲突 ⇒ 需用户裁决。
2. **语义色白字 vs 参考图深字**：参考图所有文字都是 `#202020`。若 `-proceed/-success/-warning` 也改深字，则底色需相应变浅（否则对比度不足）；本方案选择**保留白字**并标为推断，最小化对现有对比度基线（`design-system.spec.md` §T19 有 4.5:1 硬约束）的冲击。

## §3 令牌（token）方案（日/夜同构）

### §3.0 现有生成链（现取）

`frontend/src/theme/tokens.js`（**唯一真源**，:1-26 声明「不含发明值」）→ 生成器 `backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`（路径取自 `theme-tokens.css:3` 头注释）→ 生成物 `frontend/src/theme/theme-tokens.css`（:1「勿手改」）→ `styles.css:7` `@import './theme/theme-tokens.css'`（全站可用）。
校验三件套：`theme-tokens.test.js:58-66`（日/夜键集合与**键顺序**完全相同）、`:68-94`（逐键 `PROV` 回读真源行）、`:96-109`（键名/取值白名单）、`:111-117`（**day≠night 的键 > 90**）、`:131-143`（STRUCT 逐条 `STRUCT_PROV` 回读）、`theme-shell-isomorphism.test.jsx:238-259`（主题块只能声明 `--sf-*` 且键必须在 `TOKEN_KEYS` 内）。

**两条硬约束（决定方案形状）**：
1. `theme-tokens.test.js:96-109` 值形态白名单 = `#hex | rgb(a)() | transparent | none | inherit | currentColor | Npx | linear-gradient(...) | "Npx Npx ..."` ⇒ **`1px solid #E0E0E0` 这种组合值不能进 token**：描边必须拆成「颜色 token（`#E0E0E0`）+ 宽度走结构常量 `--sf-st-stroke-w-thin`（=1px，`tokens.js:368`）」。
2. `theme-tokens.test.js:68-94` 与 `:131-143` ⇒ **每个新键（无论进主题层还是 STRUCT）都必须给出 `docs/design/style-preview.html` 的行号 + 原文片段**。参考图 3 个新色（`#FFE60F`/`#E0E0E0`/`#202020`）在该文件里不存在（本单读盘口径：`tokens.js` 全 458 行、`theme-tokens.css` 全 263 行、`styles.css:79-251` 均未见这 3 个值）⇒ 见 §3.3。

### §3.1 建议新增的 token（**日/夜同值**，因为参考图只有一套色；键集仍必须两档都出现）

| 键名（`--sf-` 前缀自动加） | 日档值 | 夜档值 | 用途 | 依据 |
|---|---|---|---|---|
| `btn-a-bg` | `#FFE60F` | `#FFE60F` | 主操作填充 | 参考图**实测** |
| `btn-a-fg` | `#202020` | `#202020` | 主操作文字 | 参考图**实测** |
| `btn-a2-bg` | `#FFFFFF` | `#FFFFFF` | 次操作填充 | 参考图**实测** |
| `btn-a2-fg` | `#202020` | `#202020` | 次操作文字 | 参考图**实测** |
| `btn-a2-border` | `#E0E0E0` | `#E0E0E0` | 次操作**描边色**（宽度用 `--sf-st-stroke-w-thin`） | 参考图**实测** |

⚠ 键名合法性：这 5 个键**不含**禁词分段（`theme-tokens.test.js:98-102` 的禁词集含 pad/size/height/width/gap/font…，不含 `a/a2/bg/fg/border`）✅；取值都在白名单 ✅。

### §3.2 建议修改的现有键（含**未新增键时的最小改动版**）

| 键名 | 日档 现值 → 目标 | 夜档 现值 → 目标 | 备注 |
|---|---|---|---|
| `btn-bg`（`tokens.js:40` / `:150`） | `#030402` → `#FFE60F` | `#FDE815` → `#FFE60F` | 两档由「有差」变「同值」 |
| `btn-fg`（:41 / :151） | `#FDE815` → `#202020` | `#0B0C0E` → `#202020` | 同上 |
| `btn-radius`（:42 / :152） | `11px` → `6px` | `2px` → `6px` | 6px 对应 h=34 档（`.sf-*-btn`）；`.btn-md` 需 7px ⇒ **两者不能共用同一 token** |
| `btn-shadow`（:43 / :153） | `2px 2px 0 rgba(3,4,2,.35)` → `none` | `none` → `none` | 参考图无阴影 |
| `btnsm-bg`（:98 / :208） | `#FDE815` → `#FFE60F` | `#FDE815` → `#FFE60F` | 小按钮（现值两档已同色） |
| `btnsm-fg`（:99 / :209） | `#030402` → `#202020` | `#0B0C0E` → `#202020` | |
| `btnsm-radius`（:100 / :210） | `9px` → `6px` | `2px` → `6px` | |
| （可选）`cat-bg/cat-border/cat-fg/cat-radius`（:57-60 / :167-170） | `#fff/#030402/#0A0A0A/999px` → `#FFFFFF/#E0E0E0/#202020/6px`(推断) | `#15171B/#2A2D33/#C4C9D0/2px` → 同上 | chip 属第二批，圆角为**推断** |

**必须同步核算**：`theme-tokens.test.js:111-117` 要求 `day≠night` 的键数 **> 90**。上表把 `btn-bg/fg/radius` 三键从「有差」改为「同值」⇒ 差异键数会减少 3（现基线差异键数 **本单未数 ⇒ NOT_MEASURED**，落地前先跑该断言确认仍 >90）。

### §3.3 三条出路（token 溯源阻塞，**需用户拍板**）

- **(a) 扩展真源（推荐，但需另立单）**：新增 `docs/design/btn-a-reference.md`（记录 4 色 + 圆角/内边距取样比例 + 取样方法），并把 `PROV`/`STRUCT_PROV` 结构扩成「可指向多真源」，同步改 `theme-tokens.test.js:20-27,68-94`。**改动落在测试与真源定义上 ⇒ 超出「只动按钮样式」范围，应由用户开一张独立单。**
- **(b) 不进主题层**：变体 A 的形状与 4 色写在 `styles.css` 新增块（`.btn-a` / `.btn-a2`），日/夜天然同值同构，零特例；代价 = 与 `tokens.js:11-14`「颜色必须进主题层」的口径冲突，需要在 `EXCLUDED_FROM_THEME`（tokens.js:436-447）登记说明（该表每行被要求含 `style-preview.html:N` 字样，见 `theme-tokens.test.js:150`）。
- **(c) 只改值 + 同步改 PROV 指向**：与 (a) 同一阻塞，仅改动面小。

### §3.4 生成/维护动作（现取）

1. 改 `tokens.js` 的 DAY/NIGHT 值与键 → 2. 跑生成器 `node backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`（**该文件今天在盘且可运行 = NOT_MEASURED，本单未跑**）→ 3. 覆盖 `theme-tokens.css` → 4. `styles.css:7` 的 `@import` 自动生效（**无需改 import**）。
5. `EXCLUDED_FROM_THEME`（tokens.js:436-447）：本批「圆角/内边距两档同值」**不需要新增条目**；若改为「圆角按档给不同值」，则必须登记，并与 `theme-tokens.test.js:145-152`（≥8 条、每条含 `style-preview.html:N`）及「几何不进主题层」口径冲突（`tokens.js:11-14`）。
6. **不得手改 `theme-tokens.css`**：`theme-tokens.test.js:160+` 逐键比对 JS↔CSS 生成物。
7. 几何量（圆角/内边距）按 `tokens.js:11-14` 的口径应进 **STRUCT**（`tokens.js:365-398`，生成 `--sf-st-*`）：建议增 `btn-radius-sm/md/lg` = 6/7/9px、`btn-pad-x-sm/md/lg` = 15/18/23px（两档同值）。⚠ 同样受 §3.3 的 `STRUCT_PROV` 溯源阻塞。

## §4 可判负 AC + 「扁平化后与周边不协调」清单

### §4.1 验收判据（逐条可判负）

| # | 判据 | 判负条件 |
|---|---|---|
| AC1 | **切档几何恒等**：同一批元素在 `[data-theme="light"]` 与 `[data-theme="dark"]` 下 `getBoundingClientRect()` 的 **x/y/width/height 逐值相等**，差异只允许出现在 `border-radius` / `box-shadow` / 颜色上 | 任一值差 1px 即判负。尺子可直接复用既有 `frontend/scripts/p4z-b4cii-geometry.mjs`（Page.route 映射 `frontend/dist`、外部 CDN abort、含 1px 刻意错位灵敏度对照 + 同档两次可重复对照）；选择器须**扩到全部按钮钩子**：`[data-sf-m="jobs-primary"]`、`jobs-refresh/approve/reject/apply/submit/accept`、`listing-primary/refresh/detail-refresh/buy-btn/refund-btn/goto-feed`、`mkt-primary/mkt-refresh`、`toggle-day/toggle-night`（现清单见 §1⑤） |
| AC2 | **单测全绿不削**：`cd frontend && npm run test:unit` ⇒ **EXIT=0**，`Tests 126 passed (126)`（口径出处：`docs/audit/p6-trfix.md:52`、`docs/audit/p6-tr1c-fix2.md:23`，均为「Test Files 13 / Tests 126」），其中主题 3 件（`theme-tokens.test.js` 14 例、`theme-shell-isomorphism.test.jsx` 16 例、`Button.test.jsx` 7 例）必须全绿 | 例数减少或出现 fail 判负；**退出码必须取自 `npm run test:unit` 命令本身，不得取自管道之后** |
| AC3 | **四语不受影响**：`src/locales/{zh,en,hk,vn}.json` 键集合与顺序同构（`theme-shell-isomorphism.test.jsx:261-271` 已在管）；四语下同一按钮的 rect 仍逐值相等（AC1 尺子加语言维度）；**按钮内文本不得换行**（`white-space: nowrap`），且文案长度变化不引起横向溢出 | 任一语言下 rect 与其他语言不等、或文本折行、或 `scrollWidth > clientWidth` 判负 |
| AC4 | **构建通过**：`cd frontend && npm run build` 退出 **0**（退出码取命令本身） | 非 0 判负 |
| AC5 | **无横向溢出**：`document.documentElement.scrollWidth <= clientWidth` 在 390 / 768 / 1024 / 1440 四档成立 | 任一档溢出判负 |
| AC6 | **形状语言干净（可 grep 断言）**：`.btn` 家族内不得再出现 `clip-path`、`background-image`（按钮选择器内）、`box-shadow`（除 focus 环）；`.btn`/`.sf-btn` 不得出现 `translateY` hover 位移 | 命中即判负 |
| AC7 | **颜色白名单**：变体 A 相关按钮的 `background-color`/`color`/`border-color` 计算值**必须落在 4 色集合内**（`#FFFFFF/#FFE60F/#E0E0E0/#202020`）+ 明确的语义色例外表（proceed/success/info/warning 的保留色） | 出现表外颜色判负 |
| AC8（**推断 AC**） | **危险操作不得用主操作黄**：`data-sf-m="jobs-reject"` / `listing-refund-btn` 对应元素计算填充 ≠ `#FFE60F` | 参考图未展示危险态 ⇒ 本条为**推断判据**，非实测 |

### §4.2 「扁平化后与周边不协调」清单（**仅供拍板，本批只动按钮**）

| 处 | 现值（文件:行号） | 不协调点 |
|---|---|---|
| 卡片硬投影 | `--sf-card-shadow: 3px 3px 0 #030402`（`tokens.js:66` / `theme-tokens.css:81`） | 按钮去阴影后，卡片成为全站唯一「硬投影 3D 语言」 |
| 招工卡/市场项 | `--sf-jobcard-shadow: 3px 3px 0 rgba(3,4,2,.4)`（`tokens.js:89` / `:104`），实际用于 `.sf-mkt-item`（market.css:221）、`.sf-listings-item`（listings.css:230）、jobs.css:149 | 同上，且紧贴按钮出现 |
| 面板 | `--sf-panel-shadow: 3px 3px 0 #030402`（`tokens.js:105` / `:120`） | 同上 |
| 搜索/输入框 | `--sf-search-shadow: 2px 2px 0 #030402`（`tokens.js:39`），被 `.sf-jobs-input/.sf-jobs-textarea`（jobs.css:85）、`.sf-mkt-input/.sf-mkt-select`（market.css:164）、`.sf-listings-input`（listings.css:167）消费 | 与「无阴影按钮」同排 ⇒ 按钮看起来比输入框「更平」 |
| 分类 chip | `--sf-cat-radius: 999px` 日（`tokens.js:60`） | 与按钮 6-7px 圆角 = 两套形状语言（胶囊 vs 圆角矩形） |
| 输入框圆角 | `--sf-search-radius: 11px` 日 / `2px` 夜（`tokens.js:38` / `:148`） | 与按钮 6/7px 不一致；日档 11px 的输入框配 6px 按钮会显「不同代」 |
| 日档页底黄 | `--sf-page-bg: #FDE815`（`tokens.js:30` / `theme-tokens.css:45`） | **与主操作 `#FFE60F` 极近 ⇒ 日档按钮几乎不可辨**（§0 冲突 2，最高危） |
| 底部 tab | `.sf-tab` font-size 10.5px + 22px 图标（`tokens.js:393-394`）+ 无形状（shell.css:70-90） | 同屏出现，导航与按钮不同语言（**本批不动**，仅登记） |
| ThemePreviewPage 选中态 | `.sf-preview-btn.is-on{outline:2px solid …}`（theme-preview.css:46-48） | 扁平化后 `outline` 常驻表达「选中」与新语言冲突 ⇒ 建议改 `:focus-visible` 环 |
| 旧头/旧组件原生按钮 | `Header.jsx` 15 处 + `LoginModal.jsx:54,73` + `ui/{MicroInteractions,Form,Advanced,ErrorHandling,Tabs,Toast,Performance,Modal}.jsx` | 不带 `.btn` ⇒ 扁平化后同页出现「新扁平」与「Tailwind 默认」两代按钮 |
| 旧模态按钮 | `ClaimRewardModal.jsx:81`、`ActiveTaskModal.jsx:140,148`（`.btn.btn-*`） | 与 `.sf-btn` 家族同页 ⇒ 必须同批改，否则同一屏两套按钮 |
| Tailwind 兼容层的覆盖 | `tailwind-compat.css:340-350`（`bg-blue-600/bg-yellow-500/bg-red-500` …）+ `Button.jsx:6-14` | `variant` 类里的 `bg-*` 会覆盖 `background-color`，**但盖不住 `background-image`** ⇒ 扁平化时必须同时删掉 `Button.jsx:6-14` 的 `bg-*`/`text-*`（否则色值漂移） |

## §5 未测项（NOT_MEASURED）与证据口径

**本单未跑任何命令产生产品证据**（除只读读盘/检索），以下一律 `NOT_MEASURED`，不得当作实测填数：

| 项 | 状态 | 说明 |
|---|---|---|
| 按钮**实际高度**（`.btn-sm/md/lg`、`.sf-*-btn`、`.sf-preview-btn`、`.sf-tab`） | `NOT_MEASURED` | 只给「pad + pad + line-height」推算与两种行高假设（§1①②、§2 换算表）；需用 `p4z-b4cii-geometry.mjs` 系尺子在浏览器里量 |
| `npm run test:unit` 实跑（126 例 / 13 文件） | `NOT_MEASURED`（引用既有 audit 口径） | 口径出处 `docs/audit/p6-trfix.md:52`、`p6-tr1c-fix2.md:23`；本单全仓 grep 到 `it(`/`test(` **159 处 / 18 文件**（其中 `test/e2e/basic.spec.js` 11 处为 Playwright，不计入单测）——**两种口径不同源，未互相校验** |
| `npm run build` | `NOT_MEASURED` | 本单不构建 |
| 日/夜「有差异键数」现值（`theme-tokens.test.js:111-117` 的 >90） | `NOT_MEASURED` | §3.2 会减少 3 个差异键，落地前须先数 |
| `theme-tokens.css` 生成器是否仍在盘/可运行 | `NOT_MEASURED` | 只从 `theme-tokens.css:3` 读到路径字符串 |
| market.css / listings.css 的 `--sf-k-ctl-h` / `--sf-l-ctl-h` 定义行号 | `NOT_MEASURED` | 只确证被 `min-height` 引用（market.css:168,175、listings.css:171,183），未取定义行 |
| 参考图色值本体（`#FFE60F/#E0E0E0/#202020/#FFFFFF`、比例 0.17/0.45） | 用户提供的**取样实测**，本单**未复取样** | 报告内一律标注「参考图实测（用户提供）」，不得写成本单实测 |

**硬边界遵守**：本单只写 `docs/audit/p6-btn-a-recon.md` 一个文件；未改 `frontend/src/**`、`backend-ts/**`、`migrations/**`、`vercel.json`、任何 spec、`docs/seafood.master-plan.md`、`.env*`、既有 audit 件；未执行 `git add/commit/push`、`npm install`、任何服务启停、`vercel`、`pkill`/`killall`；未读取/打印任何密钥或 `.env*` 值。
