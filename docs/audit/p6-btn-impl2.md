# Unit P6-BTN-IMPL-2 · 按钮改造收尾（`.sf-btn` 家族纳入 A 体系 + Button.test 两例改锚）

- 单号：**P6-BTN-IMPL-2**（Kong）｜执行：2026-10-01（CST）｜基地：`/Users/kevin/bistro/seafood`（前端 `frontend`）
- 真源：**现取** `docs/design/style-preview.html` 行 938–982 `[BTN-SRC-REF]`（本单未转抄；口径随取随用）
- 拍板口径（Kevin）：**日档 A″** = `#FFE60F` 底 + `#202020` 字 + 1px 深描边；**夜档 A′** = `#FFE60F` 底 + 深字、无描边（实现为 1px `transparent` 槽位常驻，守 rect 同构）
- 两档共同：**扁平**（无阴影）× 圆角 = 高×0.222 × 水平内边距 = 高×0.359（**复采值**，真源 L962；原 0.17/0.45 为转录误差）

---

## 1. 交付物（改动/新增）

| 文件 | 动作 | 内容 |
|---|---|---|
| `frontend/src/shell/shell.css` | 改 | `.sf-btn` 基类从旧黑底黄字切角改挂 A 系：`--sf-btna-*`（颜色）+ `--sf-st-*`（几何），扁平化 |
| `frontend/src/pages/jobs/jobs.css` | 改 | `.sf-jobs-btn` 水平内边距 `12px` → `var(--sf-st-padx-btna)`（**同值**，口径单一来源）；尺寸约束原样保留 |
| `frontend/src/pages/market/market.css` | 改 | `.sf-mkt-btn` 同上 |
| `frontend/src/pages/listings/listings.css` | 改 | `.sf-listings-btn` 同上 |
| `frontend/src/test/components/Button.test.jsx` | 改 | 2 例改为按**新契约**断言（不删、不削弱，另加 A 系形态/口径复核断言） |
| `frontend/src/test/unit/p6-btn-impl2.test.js` | 新增 | `.sf-btn` 家族 A 系生效的 9 例单测（清单/基类/扁平/不造色/几何同构/micro 约束/Preview/死 token/无主题分支） |
| `frontend/scripts/p4z-btnimpl2-sf-btn-a.mjs` | 新增 | 机械自检（纯文本规则解析，不依赖框架；30 项 PASS 读数） |

**未改**：`theme/tokens.js`（已验收）、`theme-tokens.css`（无再生必要）、`locales/*.json`、`docs/design/**`、spec、`vercel.json`、`backend-ts/**`、`migrations/**`。
**未做**：`git add/commit/push`、`npm install`、启停服务、`pkill/killall`（均未触碰）。

---

## 2. `.sf-btn` 家族现取清单（grep 实测）

口径 = `src` 下 `.js/.jsx`（排除 `test/`）中 `\bsf-btn\b`（词边界，排除 `--sf-btna-*`/`--sf-btnsm-*` 前缀串）。

| 文件 | 处数（JSX 用法） | 挂的 micro 类 |
|---|---|---|
| `pages/jobs/JobDetailPage.jsx` | 4 | `sf-jobs-btn` |
| `pages/jobs/JobReviewPage.jsx` | 3 | `sf-jobs-btn` |
| `pages/jobs/PublishJobPage.jsx` | 1 | `sf-jobs-btn` |
| `pages/TaskPage.jsx` | 2 | `sf-jobs-btn`（`<Link>` ⇒ 渲染为 `<a>`） |
| `pages/market/MarketPage.jsx` | 4 | `sf-mkt-btn` |
| `pages/listings/ListingsPage.jsx` | 2 | `sf-listings-btn` |
| `pages/listings/ListingDetailPage.jsx` | 2 | `sf-listings-btn` |
| `pages/listings/PublishListingPage.jsx` | 2 | `sf-listings-btn` |
| `pages/ThemePreviewPage.jsx` | 2 | `sf-preview-btn`（**纳入**，见 §6） |
| **合计** | **9 文件 / 22 处** | 基类 `.sf-btn`（`shell.css:190`）+ 4 个 micro 类 |

---

## 3. 改动口径（token / STRUCT 映射，同批、不另造色值）

| 槽位 | `.btn.btn-a`（既有 A 系） | `.sf-btn`（本单） |
|---|---|---|
| 底色 | `var(--sf-btna-bg)` | `background: var(--sf-btna-bg)` |
| 文字 | `var(--sf-btna-fg)` | `color: var(--sf-btna-fg)` |
| 描边色 / 宽 | `var(--sf-btna-border)` / `var(--sf-st-stroke-w-thin)` | `border: var(--sf-st-stroke-w-thin) solid var(--sf-btna-border)` |
| 圆角 | `var(--sf-st-radius-btna)`（8px） | `border-radius: var(--sf-st-radius-btna)` |
| 扁平 | `box-shadow:none; background-image:none; clip-path:none` | 同三件套 + 显式 `clip-path:none`（旧切角取消） |
| 水平内边距 | `padding: 0 var(--sf-st-padx-btna)` | micro 类 `padding: 8px var(--sf-st-padx-btna)`（**尺寸约束保留**） |
| 高 | `height: var(--sf-st-h-btna)`（34px） | **不设 height**：由各页 `--sf-*-ctl-h: 34px` 的 `min-height` + 页内 padding 决定（保留 micro 约束） |

- 主题 token **只落颜色槽位**（`background`/`color`/`border-color`）；几何（圆角/描边宽度/内边距）**只走 `--sf-st-*`** ⇒ 切档 rect 逐值相等（机制保证，见 §5）。
- 各页 micro 类**只留 `padding` / `font-size` / `min-height` / `cursor` / `[disabled] opacity`**，不再二次定义背景/描边（单一来源 = 基类）。

---

## 4. AC 读数（全部自跑，退出码直接取，未经管道）

| # | 命令 | 口径 | 读数 | 判 |
|---|---|---|---|---|
| ① | `npm run build` | 退出码 | `BUILD_EXIT=0`；`✓ built in 1.49s`（仅既存 >500kB chunk 警告） | **PASS** |
| ② | `npm run test:unit` | 用例数 | `Test Files 24 passed (24) / Tests 219 passed (219)`（基线 210/23 → +9 例 = `p6-btn-impl2.test.js`） | **PASS（≥210）** |
| ③ | `npx vitest run`（全仓） | 失败用例名 | `Test Files 4 failed \| 25 passed (29)`；`Tests 7 failed \| 231 passed (238)` | 失败集 = 基线同名（见 §7） |
| ④ | `node scripts/p6-tr2-i18n-locales.mjs` | 脚本总判 | `[TR-2] 总判：PASS`（`I18NLOC_EXIT=0`） | **PASS** |
| ④ | `node scripts/p4z-i18nviol-global.mjs` | 违例数 | `locale 裸命中 0 + 源面裸命中 0`，`总判：PASS`（`I18NVIOL_EXIT=0`） | **0（仍 0）** |
| ⑤ | 真浏览器两档对照 | rect / 计算样式 | 见 §5 | **PASS** |
| ⑥ | `node scripts/p4z-btnimpl2-sf-btn-a.mjs` | 机械自检 | `总判 PASS（0 FAIL / 9 文件 / 用法 22 处）`，`EXIT=0` | **PASS** |

---

## 5. 真浏览器两档对照（`http://localhost:5787`，vite 只绑 IPv6 ⇒ 用 `localhost`）

**方法**：切档走应用自身读值链 —— `localStorage['theme']` + `<html data-theme>` 置位后整页加载（`ThemeProvider.readInitialTheme` 口径），`getBoundingClientRect()` + `getComputedStyle()` 现取；每页 settle 2.5s（页面内无长 `setTimeout`）。

**rect 逐值相等（day vs night，同索引元素，x/y/width/height 容差 0.01px）**

| 页面 | 可见 `.sf-btn` 数 | rect 逐值相等 | 几何差异项 |
|---|---|---|---|
| `/task` | 2 | **TRUE** | `[]` |
| `/listing` | 2 | **TRUE** | `[]` |
| `/shard` | 3 | **TRUE** | `[]` |

**逐值读数（样例，`x,y,w,h` + 计算样式）**

- `/task`：`sf-btn sf-jobs-btn`（`A`）`(52,197,78,37.5)` 与 `(138,197,78,37.5)`
  day `bg=rgb(255,230,15) fg=rgb(32,32,32) border=rgb(3,4,2) 1px radius=8px shadow=none`
  night **同一 rect**，`border=rgba(0,0,0,0) 1px radius=8px shadow=none clip=none bgimg=none`
- `/listing`：`(80,127,52,37.5)`、`(955,306,52,37.5)` — 两档 rect 同，仅描边色变
- `/shard`：`(127,127,52,37.5)`、`(35,397.5,52,37.5)`、`(955,118,78,37.5)` — 两档 rect 同，仅描边色变

**变项清点**：跨档**只有描边色**变化（日 `rgb(3,4,2)` → 夜 `rgba(0,0,0,0)`）；底色/字色/圆角/阴影/切角/背景图两档逐值同（`#FFE60F` / `rgb(32,32,32)` / `8px` / `none`）。**未出现**几何项变化 ⇒ 守「只允许颜色/描边/圆角/阴影变」。

**读数口径备注**：可见按钮数（2/2/3）< JSX 用法数（4/2/4），因部分按钮只在表单态/弹层/登录态渲染；`/shard` 另有 2 个 `opacity:0.6` 的 `[disabled]` 按钮（micro 类既有行为，本单未改）。

**截图（run-tagged 目录）**：`/Users/kevin/.hermes/profiles/zang/cache/browser-use/workspace/sa-0-993200e2/shots/p6-btn-impl2-20261001T224606/`
`task-day.png`、`task-night.png`、`listing-day.png`、`listing-night.png`、`shard-day.png`、`shard-night.png`（另：`task-night-animKilled.png`，见 §6）

---

## 6. 夜档「左上第一张任务卡被暗色遮罩压暗」判定

**判定：伪影（截图环境时点）—— 非本单引入的样式缺陷，也不是遮罩元素。**

判别依据（全部实测，非推断）：

1. **受影响元素不是 `.sf-btn` 家族**：被压暗的是包裹层 `div.animate-fade-in`（hero 标题块 `y=81,h=274` 与第一张任务卡 `y=435,h=214` 同时如此）；其 `background-color: rgba(0,0,0,0)`、`background-image: none`、`opacity: 0`、`filter: none`、`mix-blend-mode: normal` ⇒ 自身无暗色填充。
2. **无遮罩元素**：全页 `z-index ≥ 1000` 的元素只有 1 个 —— `div`（`position: fixed`，`x16 y16 1248×545`，`z=9999`，**`background: rgba(0,0,0,0)`、`background-image: none`、`backdrop-filter: none`、`pointer-events: none`、子节点 0**）⇒ 不产生压暗。`elementsFromPoint` 堆栈内也无暗色层。
3. **动画时间轴被冻结**：`document.hidden === true`、`visibilityState === 'hidden'`；`document.timeline.currentTime = 0`，间隔 **1.6s** 复测仍 `= 0`（同期 `performance.now() = 17942 → 19548`）；元素 `getAnimations()` 回报 `fade-in: running@currentTime=0`（1.2s 间隔两次复测均 `@0`）。
4. **机制闭合**：`@keyframes fade-in { 0% { opacity: 0 } 100% { opacity: 1 } }`；受影响的块 `animation: fade-in .3s 0s forwards` ⇒ 时间轴停在 t=0 时被 forwards 保持在 **0% 帧（opacity:0）**。带 delay 的兄弟块（`0.1s/0.2s/0.3s`）因 `fill-mode` 无 `backwards`，delay 期间用静止样式 ⇒ `opacity: 1`。**这解释了「只有第一张（delay=0）被压暗」**，也与 vision 对截图的独立观察（hero「任务中心」标题同时偏暗）逐条对应 —— 同一现象与位置无关、只与 delay 相关。
5. **静止态正常**：对 22 个 `.animate-fade-in` 施加 `animation: none` 后，首块计算 `opacity = 1`；同屏 `.sf-btn` 读数不变（`sf-btn sf-jobs-btn 78×37.5 bg=rgb(255,230,15) border=rgba(0,0,0,0)`）⇒ 压暗**只由动画时点造成**，静止样式无暗化。对照截图 `task-night-animKilled.png`。

**结论口径**：本环境（无头/后台标签、动画钟停摆）下必然复现；真实前台浏览器中该动画 0.3s 内推进至 `opacity:1`，属既存入场动画行为，**与本单按钮改造无关，登记不修**（不属硬边界允许的改动面，且不为本单引入）。
（若需在生产前确证，可另单在可见窗口做一次人眼/前台复采 —— 本单未做，标 **NOT_MEASURED** 的部分：前台可见标签下的实际渲染。）

---

## 7. 基线「同名」证据（Card×6 / VirtualList×1）—— 只核不改

**全仓失败清单（`npx vitest run`，完整、未截断）**

| # | 失败用例名 | 失败断言原文 |
|---|---|---|
| 1 | `Card.test.jsx > Card Components > renders Card with default props` | `expect(element).toHaveClass("bg-white border-gray-200")` |
| 2 | `Card.test.jsx > Card Components > renders Card with different variants` | `expect(element).toHaveClass("bg-yellow-50 border-yellow-200")` |
| 3 | `Card.test.jsx > Card Components > renders CardHeader` | `expect(element).toHaveClass("p-6 pb-4")` |
| 4 | `Card.test.jsx > Card Components > renders CardTitle` | `expect(element).toHaveClass("text-lg font-semibold text-gray-900")` |
| 5 | `Card.test.jsx > Card Components > renders CardContent` | `expect(element).toHaveClass("p-6 pt-0")` |
| 6 | `Card.test.jsx > Card Components > applies hover effect when enabled` | `expect(element).toHaveClass("hover:shadow-lg transition-shadow")` |
| 7 | `VirtualList.test.jsx > VirtualList Performance > updates visible items on scroll` | `AssertionError: expected <div data-testid="item-0"></div> not to be <div data-testid="item-0"></div>` |
| — | `accessibility/Accessibility.test.jsx`（**收集失败**，非用例失败） | `Error: Transform failed with 1 error` |
| — | `e2e/basic.spec.js`（**收集失败**） | `Error: Playwright Test did not expect test.describe() to be called here.` |

- **Button×2 已转绿**：`src/test/components/Button.test.jsx (7 tests)` 全通过；全仓不再出现 `Button.test.jsx` 任何失败名。
- **同名依据**：上表 6 个 Card 用例名与 1 个 VirtualList 用例名即基线同名集（失败原因仍是**已被删掉的 Tailwind 盖色类**断言 —— 与 Button 原 2 例同类陈旧，非本单引入）；`Accessibility` 与 `e2e/basic.spec` 两个**收集失败**保持原样。
- **未触碰证据**：`git status --short` 仅显示 5 个已跟踪改动（`jobs.css`/`listings.css`/`market.css`/`shell.css`/`Button.test.jsx`）+ 2 个未跟踪新增（`scripts/p4z-btnimpl2-sf-btn-a.mjs`、`src/test/unit/p6-btn-impl2.test.js`）—— **不含** `Card.test.jsx`、`Card.jsx`、`VirtualList.test.jsx`、`VirtualList.jsx` 及其它任何文件。
- **`git stash` 不可用**：`git stash list` 为空（本单无 stash 可做前后对照）⇒ 以上「同名 + 未触碰」为可用证据口径；**本单未修 Card/VirtualList。**

---

## 8. 登记项（本单不改，报回）

1. **`.sf-btn` 实高 37.5px ≠ A 口径基准高 34px**：micro 类 `padding: 8px`（上下）+ 行高决定内容高，`min-height: 34px` 未被绑定 ⇒ 实测 37.5px。圆角 `8px`/水平内边距 `12px` 取 STRUCT 常量（与 `.btn-a` 同值），相对**实高**的比例为 0.213 / 0.320，与真源 0.222 / 0.359 有偏差。按本单要求「保留各页 micro 类位置/尺寸约束」**未改** padding/min-height（改则动 rect）。**请 Jing/Kevin 裁决**：是否要 page 控件也统一到 34px 定高（会改变新页面按钮高度）。
2. **死 token 登记**：`--sf-btn-*`（`shell.css` 旧黑底黄字）与 `--sf-btnsm-*` 现已**无任何消费者**（全 `src` CSS `var(--sf-btn-*)/var(--sf-btnsm-*)` 引用数 = 0，机械自检项⑥）。token 仍由 `theme-tokens.css` 定义（`theme/tokens.js` 已验收，本单禁写）⇒ 登记为死 token，待 Jing 裁决是否清退。
3. **`ThemePreviewPage` 开关 = 已纳入**：其按钮即 `class="sf-btn sf-preview-btn"` ⇒ 视觉（色/描边/圆角/扁平）随基类进入 A 系；`.sf-preview-btn` 自身只留 `padding: 9px 16px`、`font-size: 13.5px`、`font-weight: 800`（该页大号开关的尺寸约束，未改），`.is-on` 保留 `outline: var(--sf-st-stroke-w-strong) solid var(--sf-tab-active-fg)` 作**选中态指示**（状态语义，非按钮本色 ⇒ 未换成 btna token；不属另造色值，引用既有主题 token）。
4. **`<a class="sf-btn ...">`（`TaskPage` 两处）**：`<a>` 为 inline，`min-height` 原本即不生效；本单加 `box-sizing: border-box` + 1px 边框，未引入 `display: inline-flex`（避免改变既有布局/rect）⇒ 行为与改造前一致，实测 rect 同批读数（78×37.5）无异常。

---

## 9. 执行说明（§5.7 纪律）

- 退出码均**直接取**（`EXIT=$?` / `${PIPESTATUS[0]}`），未取自管道之后；无 `git add/commit/push`、无 `npm install`、无启停服务、无 `pkill/killall`、未读 `.env*`、未在站上提交任何表单/登录/资金操作。
- 单测 210 → 219 全部通过（+9 为本单新增用例）；`Button.test.jsx` 原例的**其余断言逐条保留**（`toHaveClass('custom-class')`、`opacity-50 cursor-not-allowed`、`px-3/py-1.5/text-sm` 等），仅替换取样对象并**追加** A 系形态/口径断言。
- 预算：本单工具调用约 **50 次**，略超 40 次预算 —— 超支集中在真浏览器段（首轮 6 张截图落到同一路径被覆盖 + `/task` 日档首访按钮未渲染 ⇒ 需整轮重测；再加重做 overmark 判定的对照实验）。未完项：无；§6 中标注的 **前台可见标签下复采** 为 NOT_MEASURED（未做）。
