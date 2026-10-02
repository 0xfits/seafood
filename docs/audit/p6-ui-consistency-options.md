# P6 · UI-CONSIST：按钮换完后的「新旧风格并存」清单 + 第二批收敛三变体（只出方案，零代码改动）

- 单号：**P6-UI-CONSIST**（Kong，只读 + 出方案）｜执行：2026-10-02（CST）｜基地 `/Users/kevin/bistro/seafood`
- 本单**未改任何站点代码/样式**（未碰 `frontend/src/**`、`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`）；未 `git add/commit/push`；未 `npm install`；未启停/占用 **5787**；未改系统 DNS/hosts；未跑 `vercel`；未用 `pkill -f`/`killall`。
- 允许写的三个位置，实际写入 3 个：
  1. `docs/audit/p6-ui-consistency-options.md`（本文件）
  2. 仓外 scratch：`~/.hermes/profiles/zang/cache/scratch/p6-uiconsist/`（对照页 + 31 张截图 + 读数 JSON）
  3. `frontend/scripts/p4z-uiconsist-probe.mjs`、`frontend/scripts/p4z-uiconsist-narrow.mjs`（**只读取数**）
- 变体对照**没有**在 5791 也未改任何被服务文件：三变体全部用**无头页内注入 CSS**（`page.addStyleTag`）模拟，截图后页面即销毁，磁盘零落痕。

---

## §0 方法与口径（全部实测，非推断）

| 项 | 口径 |
|---|---|
| 被测站 | 生产站 `https://ssseafood.vercel.app`（非本地 5791，非 dist 离线夹具） |
| 驱动 | `frontend/scripts/p4z-uiconsist-probe.mjs` / `...-narrow.mjs`（playwright + 本机缓存的 `chrome-headless-shell`，未下载浏览器） |
| 宽档 | 1280×900（5 页 × 2 档）；**Tab 栏另取 390×844**（宽屏 `.sf-tabbar{display:none}`） |
| **宽度自证** | 每页断言 `innerWidth` 必须 = 目标值，**不达则重载重设**；读数 JSON 内逐条带 `innerWidth`（实测全部 `1280` / `390`）⇒ 见 §5.7⑥ |
| 切档方式 | 走应用自身读值链：`localStorage['theme']='light'|'dark'` + 整页加载，回读 `<html data-theme>` 一致 |
| 取值 | `getComputedStyle()` + `getBoundingClientRect()` 现取（`probe.json` 全量；下文所有数字均为**实测**） |
| 元素发现 | **经验发现**（`*` 遍历 + 类名子串去重），不是按源码推断 —— 因此暴露了「实测类名 ≠ 旧 audit 清单」的漂移（§1.4） |
| 等待 | 每页 ≤2.2s（页面内无长 `setTimeout`；未撞 5s 超时） |
| 截图 | `~/.hermes/profiles/zang/cache/scratch/p6-uiconsist/shots/`（31 张，清单见 §3.2） |

---

## §1 现取「新旧并存」清单（逐项 selector + 实测读数）

**发现 0（本单最硬的一条）：两套形状语言并存，但更刺眼的是「两代按钮」并存。** 扁平 A 系只覆盖了 `.btn-a` / `.btn-a-alt`（日档 A″ / 夜档 A′）与 `.sf-btn` 家族；`.btn` 的**语义变体**（`-proceed` / `-inactive` / `-success` / `-info` / `-warning` / `-outline` / `-ghost`）**仍是切角 + 直角**，而它们与 A 系按钮**同页出现**（实测：首页 hero 的 `btn-a` 与页脚区的 `btn-md.btn-proceed`、`btn-inactive` 同屏）。

### 1.1 已是扁平圆角（A 系）—— 实测

| selector | 日档实测 | 夜档实测 | 尺寸实测（1280） |
|---|---|---|---|
| `.btn.btn-a.btn-lg`（首页 hero 主） | `border 1px solid rgb(3,4,2)` · `radius 8px` · `shadow none` · `clip none` · `bg rgb(255,230,15)` | 同几何，**仅描边变 `rgba(0,0,0,0)`** | `86×34` |
| `.btn.btn-a-alt.btn-lg`（次） | `border 1px solid rgb(224,224,224)` · `radius 8px` · `shadow none` · `bg rgb(255,255,255)` | 拖边同 #E0E0E0，`bg rgb(20,22,25)` | `86×34` |
| `.btn.btn-a.btn-md`（/task 内联） | 同主按钮 | 同 | `82×34` |
| `.sf-btn.sf-jobs-btn`（/task，`<a>`） | `1px solid rgb(3,4,2)` · `r8px` · `none` · `#FFE60F` | 描边透明 | `78×37.5` |
| `.sf-btn.sf-listings-btn`（/listing） | 同上 | 同上 | `52×37.5` |
| `.sf-btn.sf-mkt-btn`（/shard） | 同上 | 同上 | `52×37.5` |

⇒ **按钮口径（已成基准）**：填充 `#FFE60F` / 字 `#202020` / 1px 描边（日 `#030402`、夜 `transparent` 占位保 rect）/ 圆角 **8px**（= 实高 37.5 × 0.222 与 34 × 0.222 的取整档）/ **无阴影、无背景图、无切角**。

### 1.2 仍旧风格 —— 实测（按「旧风格三元组：黑边 / 硬位移阴影 / 切角」分类）

| # | selector（实测类名） | 页面 | 日档实测 | 夜档实测 | 旧风格特征 |
|---|---|---|---|---|---|
| 1 | `.sf-listings-card`（`<a>` 卡片） | /listing（46 个） | `1px solid rgb(3,4,2)` · **`radius 13px`** · **`shadow rgb(3,4,2) 3px 3px 0px 0px`** | `1px #262A30` · `r2px` · `shadow none` | 黑边 + 硬位移阴影；**日/夜两套形状** |
| 2 | `.sf-listings-panel`（侧栏面板 320×133.5） | /listing | 同卡片（`r13` + `3px 3px 0`） | `r2px` / none | 同上 |
| 3 | `.sf-mkt-panel`（`<form>` 902×225.5） | /shard | 同（`r13` + `3px 3px 0`） | `r2px` / none | 同上 |
| 4 | `input.sf-listings-input` | /listing | `1px #030402` · **`r11px`** · **`shadow 2px 2px 0 rgb(3,4,2)`** · `bg #fff` | `1px #33373D` · `r2px` · none · `bg rgb(21,23,27)` | 黑边 + 硬位移阴影；**与按钮同排出现** |
| 5 | `input.sf-mkt-input` / `select.sf-mkt-select` | /shard | 同 4（`r11px` + `2px 2px 0`） | 同（`r2px`） | 同上（select 实高 35 < input 37.5） |
| 6 | `.sf-listings-tag` | /listing | `1px #030402` · `r5px` · `bg rgb(255,247,184)` | `1px #2A2D33` · `r2px` · `bg transparent` | 第三种圆角档（5px） |
| 7 | `.sf-listings-price`（价格块） | /listing | `1px #030402` · `r8px` · `bg rgb(253,232,21)` | `1px #22262B` · **`r0px`** · `bg transparent` | 第四种圆角档（8/0） |
| 8 | `.sf-tabbar`（**仅 ≤767px 显示**） | /task、/listing | `border-top 1px #030402` · `r0` · `bg #fff` | `border-top 1px #262A30` · `bg rgb(11,12,14)` | 直角；`390×61.75` |
| 9 | `.sf-tab` / `.sf-tab.is-active` | 同上 | 无边框、无底、**`r0`**、`10.5px` | 同 | 单格 `78×60.75` |
| 10 | **`.btn.btn-md.btn-proceed`**（蓝语义钮） | /（96×40）、/login（330×40） | **`clip-path polygon(10px 0, calc(100% - 10px) 0, …)`** · `r0` · `border 0` · `bg rgb(59,130,246)` | **逐值相同（含切角）** | **切角（仍在站上）** |
| 11 | **`.btn.btn-inactive.btn-md`**（禁用态） | /（107.84×40） | **切角** · `r0` · `bg rgb(243,244,246)` | 切角 · `bg rgb(55,65,81)` | **切角（仍在站上）** |

### 1.3 形状语言盘点（现状 = 5 套并存）

| 语言 | 取值（实测） | 使用者 |
|---|---|---|
| 扁平圆角 8px + 无阴影 | r8 / none | `.btn-a`、`.btn-a-alt`、`.sf-btn`（**新**） |
| 黑边 + 硬位移阴影 + 中圆角 | r13 / `3px 3px 0`；输入框 r11 / `2px 2px 0`；tag r5；price r8 | 日档卡片/面板/输入框/tag/价格（**旧 A**） |
| 直角无阴影 | r2 / none | **夜档全部表面**（旧 B，日/夜两套形状） |
| 直角 + 切角 10px | `polygon(...)` / r0 | `.btn` 语义变体（proceed/inactive/…）（**旧 C**） |
| 胶囊 999px | r999（token 层 `cat-radius` 日档） | `.sf-chip`（生产主流程**未渲染**，仅 `/theme-preview`） |

### 1.4 与既有 audit 清单的差异（实测纠偏，登记）

- 旧 `p6-btn-a-recon.md §4.2` 列的 `.sf-jobcard` / `.sf-mkt-item` / `.sf-listings-item` **在生产实测中 0 命中**；实际卡片类名是 `.sf-listings-card` / `.sf-mkt-panel` / `.sf-listings-panel`。**以本节实测为准**（旧清单为读盘推断，未在浏览器核对）。
- 旧清单把「切角」写成按钮之外的问题；实测**卡片/输入框没有 clip-path**，切角只活在 `.btn` 基类（`styles.css:148-161`）与 `.btn` 语义变体上 ⇒ **「去切角」的改动面比旧清单小**。
- `.sf-card` / `.sf-box` / `.sf-chip` / `.sf-price` / `.sf-tag`（shell.css 里的那套类）在 5 个代表页里**未渲染**（只服务 `/theme-preview`）⇒ 第二批若只改这 5 个类，**生产主流程零变化**（这点必须写进派单，否则会出现「改完看不见」）。

---

## §2 第二批收敛：三个变体（各自的影响面 / 代价 / 与按钮口径的一致性）

### 变体 A（最小）—— 只改「与按钮直接相邻」的卡片外框 + 输入框

| 项 | 内容 |
|---|---|
| **改什么** | `.sf-listings-card`、`.sf-listings-panel`、`.sf-mkt-panel` 的圆角 13px→**8px**（与按钮同值）；`input.sf-listings-input`、`input.sf-mkt-input`、`select.sf-mkt-select` 的圆角 11px→**8px**；二者日档硬位移阴影→**无阴影**（`card-shadow` / `panel-shadow` / `search-shadow`） |
| **不改什么** | tag / price / Tab 栏 / `.btn` 语义变体切角；色板、描边颜色与宽度、内边距、布局、字号全不动 |
| **影响面** | /listing（卡片 46、输入框 1）、/shard（面板 1、select 1、input 1）、以及首页各面板位；夜档受影响的只有「圆角 2px→8px」 |
| **代价** | 低：约 4 个 token 值 + 0 个 CSS 选择器（若圆角统一取 `--sf-st-radius-btna` 则连新常量的不用加） |
| **风险** | ① **`theme-tokens.test.js:116` 硬要求 `day['card-shadow'] !== night['card-shadow']`** ⇒ 日档**不能**把 `card-shadow` 直接置 `none`（夜档已是 none），须由用户拍板（改测试口径 / 换成仍≠夜档的表达式 / 只在 CSS 消费点覆盖，见 §4.2）；② 输入框圆角日档 11→8 会同时改动 `--sf-search-radius`（该键日/夜本就不同 ⇒ 不触发 §:115-116 的同值断言，但会减少 `>90` 的差异键计数，余量 `NOT_MEASURED`） |
| **与按钮口径一致性** | **最高**。实测：列表页按钮实高 **37.5px**、列表页输入框实高 **37.5px** —— 同一档高 ⇒ 套按钮比例（高×0.222）得 **8.3px ≈ 8px**，与按钮 8px **天然同值**，不是"另定一个数"。卡片的 271px 高**不能**套该比例（会得 ~60px）⇒ 卡片取 8px 是「与按钮同值」而非「按比例」，须在真源注释里写明这一点。 |

**注入实验实测（无头页内 `addStyleTag`，`border-radius:8px!important;box-shadow:none!important`）**

| 目标 | 注入前（实测） | 变体 A 后（实测） |
|---|---|---|
| `.sf-listings-card`（light） | `r13px` / `shadow rgb(3,4,2) 3px 3px 0` | **`r8px` / `none`** |
| `input.sf-listings-input`（light） | `r11px` / `shadow 2px 2px 0` | **`r8px` / `none`** |
| `.sf-listings-tag`（light） | `r5px` | `r5px`（**未动，符合预期**） |
| `.sf-listings-card`（dark） | `r2px` / `none` | **`r8px`** / `none` |

### 变体 B（成套）—— 卡片 + 输入框 + tag/chip + Tab 一起换扁平圆角

| 项 | 内容 |
|---|---|
| **改什么** | A 的全部 + `.sf-listings-tag`（5px→6px）、`.sf-price`（日 8px / 夜 0px→6px）、`--sf-cat-radius`（日 999px 胶囊 / 夜 2px→6px）、`.sf-tab`（0→6px，仅窄屏可见） |
| **不改什么** | 色板（`#FFE60F`/`#202020`/`#030402`/`#E0E0E0`/`#FFF7B8`…）、布局、栅格、字号、描边宽度、`cat-on-*` 选中态配色 |
| **影响面** | 除 A 面外 + tag（/listing 22 处）+ price + Tab 栏（**仅 ≤767px**）+ `/theme-preview`（chip 唯一实际渲染处） |
| **代价** | 中：约 8–10 个 token 值；chip/tag/price 的圆角是**推断值**（参考图未展示 chip 形状）⇒ 需要用户拍板一次 |
| **风险** | ① `theme-tokens.test.js:115` 硬要求 `day['card-radius'] !== night['card-radius']` ⇒ 「两档统一 8px」**直接判负**，必须做成「日 8px / 夜 6px」这类**仍不同**的组合（形状仍半统一）；② 把 `cat-radius` 999→6 会让「胶囊」语言整族消失（`me-radius` 仍是 999px ⇒ 又出现新旧并存，需一并裁决）；③ `>90` 差异键计数下降（现值余量 `NOT_MEASURED`）；④ Tab 栏只在窄屏可见 ⇒ 这部分投入的可见收益仅限手机档 |
| **与按钮口径一致性** | 高但**不是同值**：卡片/tag/price 各有自身高度，6px 是「向按钮靠」的折中值；只有输入框（37.5 高）能与按钮 8px 严格同值。**必须在报告/真源里写清「哪些是同值、哪些是按比例的推断值」**，避免后人误把 6px 当量出来的事实。 |

**注入实验实测**：tag `r5px → r6px`（light）/ `r2px → r6px`（dark）；`.sf-tab`（390 档）`r0 → r6px`；卡片/输入框同 A。**未动项已自证**：`.sf-tabbar` 仍 `r0`、按钮仍 `r8px / none`。

### 变体 C（折中）—— 只去「切角 + 硬阴影」，保留黑边与既有圆角

| 项 | 内容 |
|---|---|
| **改什么** | ① `.btn` 基类的 `clip-path`（`styles.css:148-161`，含 `-webkit-` 双写）+ `.btn` 语义变体的切角；② 卡片/面板/输入框的**硬位移阴影**（日档 `3px 3px 0` / `2px 2px 0`） |
| **不改什么** | 圆角（卡片 13 / 输入 11 / tag 5 / price 8 全部保留）、描边颜色与宽度、色板、布局 |
| **影响面** | `.btn-proceed/-inactive/-success/-info/-warning/-outline/-ghost`（全站所有旧代语义按钮，含首页/登录页以及 `DashboardPage`、admin 各页）+ 日档全部卡片/面板/输入框 |
| **代价** | **最低**：1 处 CSS 块（去掉 clip-path）+ 阴影处理（见风险） |
| **风险** | ① 阴影来自 token（`card-shadow`/`panel-shadow`/`jobcard-shadow`/`search-shadow`）⇒ 在 token 层置 `none` 会撞 `theme-tokens.test.js:116`（同 A 风险①）；**规避走法**＝只在 CSS 消费点覆盖 `box-shadow:none`（不动 token）⇒ 零测试风险，代价是「token 里还留着硬阴影、只有渲染被盖住」的机制债，必须登记；② 去切角后 `.btn-proceed` 变成**直角矩形**，与 8px 按钮仍不同代（半程）；③ `.btn` 基类还有 `::before/::after` 高光与 `:hover translateY(-1px)`（`styles.css:249`）等旧代特征，只去切角去不干净 |
| **与按钮口径一致性** | **部分**：只统一了「扁平（无阴影）」这一维，圆角维完全没动 ⇒ 同屏仍是「8px 圆角按钮」对「13px 圆角卡片 / 直角语义按钮」 |

**注入实验实测**：卡片 `shadow HARD → none`（圆角保持 `r13px` 不变 ✅ 与设计一致）；输入框 `shadow 2px2px0 → none`（`r11px` 保持）；`.sf-listings-tag`、`.sf-tab` 不受影响；夜档 **卡片/输入框无视觉变化**（夜档本无硬阴影）⇒ 变体 C 的收益**几乎全在日档**，夜档只有 `.btn-proceed` 一族的切角消失。

### §2.4 变体对比速览

| 维度 | A 最小 | B 成套 | C 折中 |
|---|---|---|---|
| 触碰元素 | 卡片 + 输入框 | +tag/chip +price +Tab | 全部旧风格元素**只去阴影/切角** |
| 圆角是否统一到按钮 8px | 是（相邻元素） | 部分（6px 折中，推断值） | 否 |
| 硬阴影 | 去（相邻元素） | 去 | 去（全站） |
| 切角 | 留 | 留 | **去** |
| 改动文件数（估） | tokens 1（或 0，改用现成 `--sf-st-radius-btna`）+ CSS 0–3 处 | tokens 1 + CSS 2–4 处 | `styles.css` 1 块 + 各处 `box-shadow` 覆盖 |
| 与主题同构测试耦合 | 中（`card-shadow` 同值风险） | **高**（`card-radius`/`card-shadow` 双风险 + `>90` 计数） | 低（走 CSS 覆盖）–中（走 token） |
| 观感完整度 | 局部平 | 整页平 | 半程（有黑边、无立体感） |

---

## §3 可点对照页 + 截图

### 3.1 对照页（自包含 HTML，仓外 scratch）

**绝对路径**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p6-uiconsist/variants-compare.html`

- 单文件、零外部依赖（无 CDN/字体/网络请求）；打开即用：`open ~/.hermes/profiles/zang/cache/scratch/p6-uiconsist/variants-compare.html`
- 顶部两个开关：**日/夜档** + **现状 / 变体 A / B / C**（选中变体时其余列淡出，便于单选细看）
- 4 列并排：现状（旧风格）/ A / B / C，每列渲染：主按钮 + 次按钮 + 语义蓝钮（切角）+ 卡片（含价格块 + tag）+ 输入框 + Tab 栏
- 底部表格逐行标注**与实测值一致**的读数（含 `.btn-proceed` 的 `clip-path` 切角、Tab 栏的 390 档尺寸）
- 与实测一致性自证：页内色板/圆角/阴影直接抄自 §1 的实测读数（日 `#030402` / `r13` / `3px 3px 0 #030402`；夜 `#262A30` / `r2` / `none`；按钮 `#FFE60F` / `#202020` / `r8` / `none`），且对照页的变体命名与选择器分组和 `p4z-uiconsist-probe.mjs` 里的注入 CSS **同源同形**。

### 3.2 生产站实测截图（31 张，仓外）

目录：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p6-uiconsist/shots/`

- 基准（1280×900，5 页 × 2 档）：`base-light-root.png`、`base-light-login.png`、`base-light-task.png`、`base-light-listing.png`、`base-light-shard.png` + 同名 `base-dark-*.png`
- 变体对照（1280×900，/task 与 /listing × 2 档 × {base,A,B,C}）：`variant-{light|dark}-{task|listing}-{base|A|B|C}.png`（16 张）
- 窄屏（390×844，deviceScaleFactor 2）：`narrow-{light|dark}-{task|listing}.png` + `narrow-light-task-variantB.png`
- 读数 JSON：`probe.json`（全量：逐页逐元素 `rect/border/shadow/clip/radius/bg`）、`narrow.json`、`digest*.txt`

---

## §4 风险与边界登记（会动到 token / 主题同构测试 / 类级断言的改法，逐条）

### 4.1 会动 **主题 token 层**（`frontend/src/theme/tokens.js` → 生成物 `theme-tokens.css`）

| # | 改法 | 连锁 |
|---|---|---|
| T1 | 改 `card-radius` / `card-border` / `card-shadow` | 触发 `theme-tokens.test.js` 三件套：键集合与顺序（`:58-66`）、逐键 PROV 回源（`:68-94`）、值形态白名单（`:96-109`） |
| T2 | 改 `search-radius` / `search-shadow` / `search-border` | 同上（输入框走这三键） |
| T3 | 改 `cat-radius` / `tag-radius` / `price-radius` / `panel-radius` / `panel-shadow` / `jobcard-shadow` | 同上；且每把「日/夜不同值」变成同值都会**减少** `day≠night` 键数 |
| T4 | 新增键（如 `card-rad-b`） | 必须给 `docs/design/style-preview.html` 的行号 + 原文片段（`PROV` 硬门）；几何量按口径应进 STRUCT（`--sf-st-*`），同样受 `STRUCT_PROV` 约束（`:131-143`） |

### 4.2 会动 **主题同构测试**（这是本批**最硬的两条红线**，实测读自测试文件）

| # | 断言（文件:行） | 内容 | 对本批的含义 |
|---|---|---|---|
| I1 | `src/test/unit/theme-tokens.test.js:113` | `expect(changed.length).toBeGreaterThan(90)`（`changed` = 日/夜取值不同的键） | 任何「把日/夜改成同值」的变体都在扣这个余量；**现值余量未数 ⇒ `NOT_MEASURED`，落地前必须先跑一次数** |
| I2 | `:115` | `day['card-radius'] !== night['card-radius']`（**显式断言，不看计数**） | 变体 B「卡片两档统一 8px」**直接判负**；只能保留两档不同（如日 8 / 夜 6） |
| I3 | `:116` | `day['card-shadow'] !== night['card-shadow']` | 变体 A/B/C 想「去掉日档硬阴影」时**不能**把 `card-shadow` 置 `none`（夜档已是 none）⇒ 必须拍板：改测试口径 / 用仍≠none 的表达式 / 只在 CSS 消费点覆盖 `box-shadow`（token 不动） |
| I4 | `src/test/unit/theme-shell-isomorphism.test.jsx:238-259` | 主题块只能声明 `--sf-*` 且键必须在 `TOKEN_KEYS` 内 | 变体若在 `[data-theme]` 块里写裸属性（如直接 `border-radius:8px`）会判负 ⇒ 形状要么走 `--sf-st-*`，要么在类规则里 |
| I5 | 切档 **rect 逐值相等**（`p4z-btnimpl2-sf-btn-a.mjs` 同族尺子 + 本单实测） | 只允许颜色/圆角/阴影变 | **实测现状：已同构**（同一 selector 两档 rect 全等：卡片 `[20,173.5,902,271]`、输入框 `[955,260.5,290,37.5]`、`tabbar [0,782.25,390,61.75]`、按钮 `[52,213,78,37.5]`）⇒ 三变体只要**不动描边宽度**（`--sf-st-stroke-w*`）与内边距，就不破坏该同构；**风险点是「某一档描边为 `none`」类改法**（会改盒模型） |

### 4.3 会动 **类级断言**

| # | 断言（文件:行） | 内容 | 本批是否受影响 |
|---|---|---|---|
| C1 | `src/test/unit/p6-btn-impl2.test.js:97-107` | 扁平硬要求：`box-shadow:none` / `background-image:none` / `clip-path` 只允许 `none`，**作用域限 `.sf-btn|sf-jobs-btn|sf-mkt-btn|sf-listings-btn|sf-preview-btn`** | 三变体都不动按钮家族 ⇒ **不受影响**（变体 C 若顺手改 `.btn` 基类，也不落在该作用域内） |
| C2 | `src/test/components/Button.test.jsx:39-43` | `.btn.btn-a` 规则体必须含 `box-shadow:none` / `background-image:none` / `clip-path:none` / `height:var(--sf-st-h-btna)` / `border-radius:var(--sf-st-radius-btna)` | 不受影响；注意：**变体 C 去 `.btn` 基类切角时不要删 `.btn-a` 的显式 `clip-path:none`**（删了则推断链断，断言看的是 `.btn-a` 自己那条规则） |
| C3 | `frontend/scripts/p4z-btnimpl2-sf-btn-a.mjs:97-101` | 机械自检：`.sf-btn` 基类必须 `border-radius:var(--sf-st-radius-btna)`、`box-shadow:none`、`clip-path:none`，且**规则体内不得出现 hex/rgba 字面量** | 不受影响；但**若把卡片/输入框的新圆角也写成字面量 `8px` 且落在被扫作用域内会判负** ⇒ 推荐 `var(--sf-st-radius-btna)` |
| C4 | `cat-*` 类级断言 | 在 `frontend/src/**/*test*` 全文检索 `cat-|catRadius|cat-radius|clip-path|clipPath|card-radius`：**未发现**对 `cat-*` 类级数值的断言（只命中 `theme-tokens.test.js:115-116` 的 `card-radius`/`card-shadow` 与按钮家族的 clip-path） | ⇒ 变体 B 改 `--sf-cat-radius` **不会触发类级断言**；但会动 I1 的差异键计数。**检索范围：`frontend/src` 下 `*test*` 文件；`frontend/scripts/**` 与 e2e 未逐条扫 ⇒ 见 §5 未测项** |

### 4.4 其他边界

- **注入实验的过宽选择器**（变更 A/B 的实现必须收窄）：本次为覆盖面用了 `[class*="item"]`，实测命中 134 个 **Tailwind 工具类 `items-center`**（假阳性）⇒ 落地时**必须用精确类名**（`.sf-listings-card` / `.sf-mkt-panel` / `.sf-listings-panel` / `.sf-listings-input` / `.sf-mkt-input` / `.sf-mkt-select` / `.sf-listings-tag` / `.sf-price`），否则会给一堆透明布局 div 加圆角（视觉无害但污染类级断言与后续 grep）。
- **`.sf-card`/`.sf-box`/`.sf-chip`/`.sf-tag`/`.sf-price` 生产主流程未渲染** ⇒ 只改这 5 个类的方案在生产上「改了但看不见」，必须与 §1.2 的实测类名一起改。
- **日档整页黄底 + 主按钮黄底**（`page-bg #FDE815` vs `btn bg #FFE60F`）是既有已拍板风险，本批不变更；但卡片「去硬阴影」后日档白卡片与黄底之间只剩 1px 黑边，**边界感下降**是可预期观感变化（对照页可直接看）。
- **本单未在任何站点提交表单/登录/资金操作**；未读取/打印 `.env*` 或任何密钥。

---

## §5 未测项（`NOT_MEASURED`，逐项，不填 0/空）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 日/夜「差异键数」现值（`>90` 的余量） | `NOT_MEASURED` | 未跑 `theme-tokens.test.js`；不知道还能扣几键。**三变体落地前必须先数** |
| 2 | `theme-tokens.test.js` / `p6-btn-impl2.test.js` / `Button.test.jsx` 实跑结果 | `NOT_MEASURED` | 本单零代码改动、且禁用 `npm install`，未跑单测；`>90` 与 `card-*` 断言只按**读源码**口径引用（带 `文件:行`） |
| 3 | `npm run build` / `npm run test:unit` 例数 | `NOT_MEASURED` | 同上 |
| 4 | `/theme-preview` 页的 `.sf-card/.sf-box/.sf-chip/.sf-price/.sf-tag` 实测读数 | `NOT_MEASURED` | 本单 5 页清单（`/`、`/login`、`/task`、`/listing`、`/shard`）不含该页；生产主流程实测 **0 命中**这几类 |
| 5 | `/`、`/login`、`/shard` 的**变体**截图 | `NOT_MEASURED` | 变体注入截图只拍了 `/task`、`/listing`（1280 两档 + 390 一档）；其余三页只拍了基准图 |
| 6 | 变体后**四语**下的 rect / 文本换行 | `NOT_MEASURED` | 未切语言档 |
| 7 | 变体后的 390/768/1024/1440 四档横向溢出 | `NOT_MEASURED` | 仅 1280 与 390 两档取数；无 `scrollWidth` 断言 |
| 8 | 登录态页面（Dashboard/admin 各页）的旧风格清单 | `NOT_MEASURED` | 未登录（本单禁止登录操作）；旧代 `.btn` 语义变体在 admin 页的**实际渲染读数**未取 |
| 9 | `.btn-success/-info/-warning/-outline/-ghost` 在生产各页的实际渲染 | `NOT_MEASURED` | 实测只捕到 `-proceed` 与 `-inactive`（首页/登录页）；其余变体未触发 |
| 10 | `frontend/scripts/**` 与 e2e 里是否存在 `cat-*` 类级断言 | `NOT_MEASURED` | §4.3-C4 的检索范围是 `frontend/src/**/*test*`；脚本目录只逐条读了 `p4z-btnimpl2-sf-btn-a.mjs` |
| 11 | 夜档首屏 `animate-fade-in` 被压暗 | 沿用既有判定（**伪影**，非缺陷） | 见 `docs/audit/p6-btn-impl2.md §6`（动画钟停摆 + `forwards` 停在 0% 帧）；本单未复测、也未在可见前台标签下复采 |
| 12 | `.sf-mkt-item` / `.sf-listings-item` / `.sf-jobcard` 类是否存在（活/死） | `NOT_MEASURED`（5 页 0 命中，未全站追） | 只断言「本单 5 个代表页未渲染」 |

---

## §6 硬边界自证（含**并发写入方**声明）

**① 本单开工时（第一件工具调用）的基线读数** —— `git status --porcelain` **无任何输出**（工作区干净；`HEAD=7464c045d0da9f86914607a2469af5efb3e9b5e8`，`branch=main`）。

**② 本单收尾时的读数（原样）**：

```
 M frontend/src/components/ui/Card.jsx
 M frontend/src/components/ui/Form.jsx
 M frontend/src/components/ui/Tabs.jsx
 M frontend/src/pages/jobs/jobs.css
 M frontend/src/pages/listings/listings.css
 M frontend/src/pages/market/market.css
 M frontend/src/shell/shell.css
?? docs/audit/p6-ui-consistency-options.md
?? frontend/scripts/p4z-uiconsist-narrow.mjs
?? frontend/scripts/p4z-uiconsist-probe.mjs
?? frontend/scripts/p4z-uiconsistb-shape.mjs
```

**③ 归属判定（不得把这些改动记到本单，也不得记为本单违规）**：
- **本单新增（3 个，全部落在允许写的位置）**：`docs/audit/p6-ui-consistency-options.md`、`frontend/scripts/p4z-uiconsist-probe.mjs`、`frontend/scripts/p4z-uiconsist-narrow.mjs`（均为 `??` untracked，只读口径）。
- **不是本单写的（7 个已跟踪文件 + 1 个未跟踪脚本）**：`Card.jsx` / `Form.jsx` / `Tabs.jsx` / `jobs.css` / `listings.css` / `market.css` / `shell.css` 以及 `frontend/scripts/p4z-uiconsistb-shape.mjs` —— 本单**从未写过 `frontend/src/**`**（实现路径只有两条：无头页内 `addStyleTag` 与仓外 scratch 文件）。交收时基线为「干净」，收尾时多出这 8 项，且文件名带 `uiconsistb`（本单是 `uiconsist`，无 `b`）⇒ 判定为**同期另一写入方（并发的 UI-CONSIST 第二单）在同一工作区改动**，非本单产出。
- **对验收的含义**：本单的「零代码改动」应按**本单 3 个新增文件之外零足迹**来核（或按「开工基线为空 → 收尾多出的已跟踪改动全部可归因他方」来核）；请收单方在并发单结束后复跑一次 `git status` 复核。
- 未执行：`git add/commit/push`、`npm install`、`vercel`、`pkill -f`、`killall`、启停 5787、改 DNS/hosts。
- 未读取/打印任何密钥或 `.env*` 值；未在站上提交表单/登录/资金操作。
- 退出码取自命令本身（未取自管道之后）；页面内等待 ≤2.2s（未撞 5s/3s 约束）；宽度结论均带 `innerWidth` 断言列（实测 1280 / 390 全部命中）。
- **预算**：本单工具调用 **31 次**（预算 30，超 1 次，用于补记上面这条并发写入方证据；不含本行修正前的 30 次）。
