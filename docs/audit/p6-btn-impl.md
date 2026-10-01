# P6-BTN-IMPL · 按钮新样式实施（日档 A″ / 夜档 A′）

- 单号：**Unit P6-BTN-IMPL**（Kong）｜日期：2026-10-01（CST）
- 真源：`docs/design/style-preview.html` 行 **938–982** `[BTN-SRC-REF]` 追加块（Jing 写；**本单现取磁盘最终值**，未转抄任何 brief 内色值）
- 状态：**已完成**（build / 单测 / 真浏览器两档对照全部自跑给读数）
- 写边界：仅动 `frontend/src/theme/*`、`frontend/src/styles.css`、`frontend/src/components/ui/Button.jsx`、`frontend/src/test/unit/**`、`frontend/scripts/p4z-btnimpl-rect.mjs`、本文件

## 0. 口径（逐字执行 Kevin 拍板 + Zang 补足裁定）

| 档 | 主按钮 | 次按钮 |
|---|---|---|
| 日档（浅色）= A″ | `#FFE60F` 底 + `#202020` 字 + 1px 深描边 | 白底 + 1px `#E0E0E0` + 深字 |
| 夜档（深色）= A′ | `#FFE60F` 底 + 深字、无描边 | 深底 + 浅描边 |

两档统一：扁平（无阴影）、圆角 = 高 × 比例、水平内边距 ≈ 高 × 比例。
Zang 补足裁定四条：① 日档描边色取**站点既有 ink**（现取盘面值 `#030402`）而非参考图 `#202020`；② 夜档次底色取**站点既有夜档面**（现取 `--sf-card-bg`/`--sf-panel-bg` = `#141619`）；③ ①② 均标【推断】；④ needle 不得单字符。

### 0.1 ⚠ 「现取」撞上真源复采修正（**需 Kevin 复核的一条口径冲突**）

同一波并行单（真源侧 `JING-BTN-SRC-FIX`）已复采样并**改写了 938–982 块**。本单按要求**现取最终值**，因此比例与落地 px 与拍板表（brief）**不一致**：

| 项 | 拍板表（brief 转抄） | 真源磁盘最终值（**本单采用**） | 真源留痕 |
|---|---|---|---|
| 圆角比 | 0.17 | **0.222**（复采 21.3px ÷ 高 96px） | 962 行 `--btn-ref-radius-ratio:0.222`；981 行注「原记 0.17 = 16px 有误」 |
| 水平内边距比 | 0.45 | **0.359**（复采 34.5px ÷ 高 96px） | 962 行；981 行注「原记 0.45 = 43px 有误」 |
| 高 34 落地 | 圆角 6px · 内边距 15px | **圆角 8px · 内边距 12px** | 976/977/981 行 |

⇒ 本单落地 **8px / 12px**（`STRUCT.radius-btna` / `STRUCT.padx-btna`）。
另：真源 958 行夜档主按钮已写为 `border-color:transparent`，与本单「1px 槽位常驻 + 无色」实现**逐值一致**（不再是工程权宜）。
**待 Kevin 复核**：拍板表数值是否随真源复采一并更正（本单按「现取真源」执行，未自行改口径）。

## 1. 差异键数（先数，硬要求 >90；未删任何键）

| 口径 | 改前 | 改后 |
|---|---|---|
| `TOKEN_KEYS` 键总数 | 107 | **113**（+6 按钮 token） |
| `day≠night` 差异键数 | 103 | **106**（**> 90** ✅） |
| `STRUCT` 常量数 | 32 | **37**（+5） |

- 计数口径：`Object.keys(THEME_TOKENS.day).filter(k => day[k] !== night[k]).length`，命令见 §6。
- 本单新增的 6 个按钮 token 中**有 3 个参与档间差集**：`btna-border`、`btnalt-bg`、`btnalt-fg`；其余 3 个两档同值。
- **未删除任何既有键**（键数只增不减）⇒ 差异键数从 103 升到 106，不存在「删键凑数」。

## 2. 取值（现取自 938–982 行；PROV 逐键可回读）

| token | 日档 | 夜档 | 口径 | PROV（d / n） |
|---|---|---|---|---|
| `btna-bg` | `#FFE60F` | `#FFE60F` | 【实测】 | L954 `background:#FFE60F;color:#202020` / L958 同 |
| `btna-fg` | `#202020` | `#202020` | 【实测】 | L954 `color:#202020;border:1px solid` / L958 `color:#202020;border-color:transparent` |
| `btna-border` | `#030402` | `transparent` | 日档【推断】站点 ink（Zang①）；夜档【实测】`border-color:transparent` | L954 `border:1px solid #202020` / L958 `border-color:transparent`（mustNot `border:1px solid`） |
| `btnalt-bg` | `#FFFFFF` | `#141619` | 日档【实测】；夜档【推断】站点夜档面（Zang②） | L956 `background:#FFFFFF;color:#202020` / L292 `background:#141619` |
| `btnalt-fg` | `#202020` | `#FFFFFF` | 【实测】 | L956 `color:#202020` / L960 `color:#FFFFFF` |
| `btnalt-border` | `#E0E0E0` | `#E0E0E0` | 【实测】 | L956 / L960 `border:1px solid #E0E0E0` |

结构常量（两档同值，进 `STRUCT`）：`h-btna=34px`、`radius-btna=8px`、`padx-btna=12px`、`ratio-radius-btna=0.222`、`ratio-padx-btna=0.359`（PROV：L962 比例 / L954·L958 radius·padding / L976 `34 ⇒ 8px`）。

**token 白名单合规**（`theme-tokens.test.js:106-108` 值形态白名单）：组合值 `1px solid #E0E0E0` 与裸小数 0.17/0.222 **均未进主题 token** ⇒ 已拆成「**颜色 token（`btna-border`/`btnalt-border`）+ STRUCT 宽度/尺寸常量（`--sf-st-stroke-w-thin`=1px、`radius-btna`、`padx-btna`、比例常量）**」。

**命名避歧义**：`tokens.js:3-5` 的「变体 A」已被占用 ⇒ 按钮用 `btna-*`（主）/ `btnalt-*`（次），结构常量 `*-btna`，CSS 类 `.btn-a` / `.btn-a-alt`。

## 3. 改动清单（全部改动点）

| 文件 | 改动 |
|---|---|
| `frontend/src/theme/tokens.js` | +6 主题 token（DAY/NIGHT 键序一致）、+6 PROV、+5 STRUCT、+5 STRUCT_PROV |
| `frontend/src/theme/theme-tokens.css` | 生成物**按仓内既有生成方式**重生成（`backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`，运行输出 `struct=37 day=113 night=113`，`GEN_EXIT=0`）⇒ `--sf-st-h-btna:34px` `--sf-st-radius-btna:8px` `--sf-st-padx-btna:12px` `--sf-st-ratio-radius-btna:0.222` `--sf-st-ratio-padx-btna:0.359`；日/夜各 +6 token |
| `frontend/src/styles.css` | ① `.btn` 删三重 `background-image` 渐变 + 晶莹 `box-shadow`（改 `none`）；② 删 `.btn::before`（白雾）/`.btn::after`（扫光）与 `.btn:hover::after` 的 `glintSweep`；③ `.btn-outline` 渐变填充改实色、去阴影；④ `.btn:active` 去内凹阴影；⑤ **新增 `.btn.btn-a` / `.btn.btn-a-alt` 整套（含 size 字号档、悬停/按下/禁用/焦点态）** |
| `frontend/src/components/ui/Button.jsx` | `primary → 'btn-a'`、`secondary → 'btn-a-alt'`；9 个变体的 Tailwind **盖色类（`bg-*`/`text-white`/`text-gray-600`/`border-blue-600`）全删**；兜底 `?? variantClass.primary`；`sizeClass` 不变 |
| `frontend/src/test/unit/p6-btn-impl.test.js` | **新增 13 例**（见 §6） |
| `frontend/scripts/p4z-btnimpl-rect.mjs` | **新增**真浏览器两档对照脚本（Playwright；截图 + 切档 rect 逐值相等 + 口径读数；`P6_BTN_CHROME` 可指定浏览器） |
| `docs/audit/p6-btn-impl.md` | 本报告 |

**页面级按钮样式 = 无改动点**（grep `\.btn` 命中的页面级/外壳 CSS：`listings.css`/`jobs.css`/`market.css`/`shell.css` **全部 0 命中**）⇒ 全站 `.btn` 系样式只有 `styles.css` 一处真源；`shell.css` 的 `.sf-btn`（另一套壳内按钮）**未改**（不在本单写边界，登记为后续）。

### 3.1 `.btn` 系：为什么「新增一套」而不是「替换本体」

- **决策依据**：旧 `.btn` 被 9 个变体 + 多处页面直接以类名使用（`btn-proceed` 等），本体一旦换成 A 系会连带改掉这些语义态的填充/尺寸，超出本单口径；而 A 系需要**圆角 + 定高 34px + 无切角**，与 `.btn` 本体的切角 `clip-path`、尺寸自适应天然冲突。
- 因此：**A 系新增为独立选择器 `.btn.btn-a*`（复合类，specificity 0,2,0）**，既能压过 `.btn-sm/md/lg` 与 Tailwind `px-*/py-*`（实测 `padding=12px`、`height=34px` 生效，见 §5），又**不修改旧变体的可用性**：旧变体类名、各自 `background-color` 单点声明、切角几何全部保留。
- **A 系内部显式取消切角**：`clip-path:none`（圆角与切角不可共存）；旧变体仍保留 `clip-path` 切角。
- **扁平化**（硬要求，**对旧变体也生效**）：三重渐变、晶莹阴影、`::before` 白雾、`::after` 扫光、`.btn-outline` 渐变填充、`:active` 内凹阴影一并删除 —— 这些都属于「扁平（无阴影）」口径与「填充单点真源」要求；`::before` 若不删会在实色上再叠一层白雾，与口径直接冲突。
- **影响面**：① 旧 7 个语义变体的填充改由 `styles.css` 的 `background-color` 单点决定（原先 Tailwind 盖色类与之双源竞争，删除后单一真源，颜色值可能与旧观感有细微差别 —— 这是拍板要求的去重）；② 光泽/扫光消失（扁平化）；③ `primary`/`secondary` 两态在**全站**改用 A″/A′（HomePage hero、WalletAuthPanel 等），字号档位只改字号、盒高恒 34px（定尺）。

## 4. 真浏览器两档对照（`http://localhost:5787`，用 `localhost` 不用 `127.0.0.1`）

- 脚本：`node scripts/p4z-btnimpl-rect.mjs http://localhost:5787 <shotDir>`，`RECT_EXIT=0`
- 切档方式：真实点击 `/theme-preview` 的日/夜开关（走应用自身 `applyTheme` ⇒ 写 `<html data-theme>` + localStorage），再回 `/`（HomePage hero 的 `Button variant="primary"/"secondary"`）量测。

| 读数项 | 主按钮 `.btn-a` 日档 | 主按钮 夜档 | 次按钮 `.btn-a-alt` 日档 | 次按钮 夜档 |
|---|---|---|---|---|
| `rect`（x/y/w/h） | 546 / 221 / 86 / 34 | **546 / 221 / 86 / 34** | 648 / 221 / 86 / 34 | **648 / 221 / 86 / 34** |
| `backgroundColor` | `rgb(255,230,15)` = `#FFE60F` | `#FFE60F` | `rgb(255,255,255)` = `#FFFFFF` | `rgb(20,22,25)` = `#141619` |
| `color` | `rgb(32,32,32)` = `#202020` | `#202020` | `#202020` | `rgb(255,255,255)` = `#FFFFFF` |
| `borderTopColor` | `rgb(3,4,2)` = `#030402` | `rgba(0,0,0,0)`（transparent） | `rgb(224,224,224)` = `#E0E0E0` | `#E0E0E0` |
| `borderTopWidth`/`Style` | `1px` / `solid` | `1px` / `solid` | `1px` / `solid` | `1px` / `solid` |
| `borderRadius` / `padding` / `height` | `8px` / `12px` / `34px` | 同左 | 同左 | 同左 |
| `boxShadow` / `backgroundImage` / `clipPath` | `none` / `none` / `none` | 同左 | 同左 | 同左 |

- **`rect_identical: true`，`failures: []`** —— 同一批元素 `getBoundingClientRect()` 的 x/y/width/height **逐值相等**；`borderRadius/padding/borderWidth/height/boxShadow/backgroundImage` 亦全等。
- `varying_on_theme_switch`：主按钮 = 仅 `borderTopColor`；次按钮 = `backgroundColor` + `color`（描边色不变）⇒ **只允许的颜色/描边差，零几何差**。
- 截图路径（脚本默认落 `$TMPDIR`，本机实跑用 scratch 目录）：
  - 日档：`/Users/kevin/.hermes/profiles/zang/cache/scratch/shots/p6-btn-impl-light.png`
  - 夜档：`/Users/kevin/.hermes/profiles/zang/cache/scratch/shots/p6-btn-impl-dark.png`

## 5. AC 读数（全部自跑）

| # | 项 | 口径 | 读数 | 结论 |
|---|---|---|---|---|
| ① | `npm run build` | vite build 退出码 | `BUILD_EXIT=0`（`✓ built in 1.50s`） | ✅ 0 |
| ② | `npm run test:unit` | vitest run src/test/unit 退出码 + 通过数 | `UNIT_EXIT=0`；`Test Files 23 passed (23)`；**`Tests 210 passed (210)`**（基线 197 + 本单新增 13） | ✅ ≥197 且全绿 |
| ③ | `node scripts/p6-tr2-i18n-locales.mjs` | 脚本总判 | `TR2_EXIT=0`；`[TR-2] 总判：PASS`（`新接文件守卫=PASS`） | ✅ PASS，**未动 locale** |
| ④ | `node scripts/p4z-i18nviol-global.mjs` | locale 裸命中 + 源面裸命中 | `VIOL_EXIT=0`；`总判：PASS（locale 裸命中 0 + 源面裸命中 0）` | ✅ 0 |
| ⑤ | 差异键数 | `day≠night` 键数 | **106**（键总数 113；改前 103/107） | ✅ > 90，未删键 |
| ⑥ | 真浏览器两档对照 | rect 逐值相等 + 口径读数 | `RECT_EXIT=0`；`rect_identical: true`；读数与截图见 §4 | ✅ |

**必测子项**：主题同构测试（`theme-shell-isomorphism.test.jsx`）与 token 测试（`theme-tokens.test.js`）**均绿**（23/23 文件通过即含这两者）。
**新增用例（`p6-btn-impl.test.js`，13 例全绿）**：
1. ① 口径值：日/夜两档主/次按钮 6 个 token 逐值符合口径（含「日档描边 = 站点 ink ≠ 参考图 `#202020`」「夜档主按钮 = transparent 无描边」「夜档次底色 = 站点夜档面」）；
2. ② 切档 rect 相等（机制保证）：A 系规则 `var()` 引用白名单（几何只走 `--sf-st-*`、主题 token 只落颜色槽位）+ 几何全部由 STRUCT 常量驱动 + 按钮差集只含颜色型槽位 + 扁平化硬要求（三重渐变/伪元素/盖色类已删）+ 差异键数 >90；
3. ③ 判负用例：**needle 单字符**、**行号越界** 必须被判负（各 2 条失败；并对 6 个新 token 断言 needle ≥2 字符、行号落在 938–982）。

## 6. 复现命令

```bash
cd frontend
node ../backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs   # 重生成 theme-tokens.css
node --input-type=module -e "import {THEME_TOKENS,STRUCT} from './src/theme/tokens.js';const d=Object.keys(THEME_TOKENS.day);console.log(d.filter(k=>THEME_TOKENS.day[k]!==THEME_TOKENS.night[k]).length)"
npm run build ; npm run test:unit
node scripts/p6-tr2-i18n-locales.mjs ; node scripts/p4z-i18nviol-global.mjs
node scripts/p4z-btnimpl-rect.mjs http://localhost:5787 /tmp/p6-btn-shots      # 真浏览器两档对照
```

## 7. 未完成 / 移交 / 风险（含「非实测」标注）

1. **`src/test/components/Button.test.jsx` 2 例失败（本单改动直接导致，未修）**：断言 `toHaveClass('bg-yellow-500','text-white')` 与 `bg-blue-500` 等 —— 正是本单按要求删除的 Tailwind 盖色类。该文件在**本单写边界之外**（`frontend/src/test/unit/**` 才可写）⇒ 移交：由持对应边界的单同步这两处断言（`px-3/py-1.5/text-sm`、`px-8/py-3/text-lg` 两例**仍通过**，因 `sizeClass` 未动）。
   - 读数：`npm run test:components` ⇒ `COMP_EXIT=1`，`Tests 8 failed | 6 passed (14)`。
2. **`src/test/components/Card.test.jsx` 6 例失败**：断言 `bg-white border-gray-200` / `p-6` / `hover:shadow-lg` 等 **Card 组件**类名，与本单改动文件（按钮 token/CSS/Button.jsx）无关。**改前基线未实测**（NOT_MEASURED）⇒ 判定「既有失败」为**代码推断**，非实测结论。
3. **拍板表 0.17/0.45 vs 真源 0.222/0.359 冲突**（见 §0.1）：本单按「现取真源」落地 8px/12px ⇒ **需 Kevin 复核口径表述**（若口径须以拍板表为准，则需真源侧再修正一行比例并回填 6 个 token + 全站按钮尺寸）。
4. **全站外观收敛（扁平化）**：旧 7 个语义变体（proceed/success/warning/inactive/outline/ghost/info）的渐变、光泽、扫光、`:active` 内凹阴影被删除，填充改由 `styles.css` 单点 `background-color` 决定；`primary`/`secondary` 已切到 A″/A′。若下游希望保留旧观感，需另单（本单为拍板要求的扁平化）。
5. **`shell.css` 的 `.sf-btn`（壳内按钮，含 `/theme-preview` 的日/夜开关与语言 chip 面）未改**：该文件不在本单写边界 ⇒ A 系未覆盖它，登记为后续单。
6. **Playwright 浏览器 revision 不匹配**：仓内 `playwright` 包要求 `chromium_headless_shell-1208`，本机缓存为 `-1228` ⇒ 脚本内置自动挑选缓存中最高版本 `chrome-headless-shell`（`P6_BTN_CHROME` 可覆盖），**未执行 `npm install` / `npx playwright install`**（写边界禁用 `npm install`）。
7. **安全/纪律**：未执行 `git add/commit/push`；未 `npm install`；未启停服务；未读写任何 `.env*`；未在站上提交表单/登录/资金操作；未用 `pkill`/`killall`。

### §5.7 自检

- ① 所有退出码均直接取自命令本身（`CMD; echo EXIT=$?`），未取管道之后的值。
- ② 先落骸架（本文件）后逐段回填；读数均来自本轮真实执行。
- ③ 每处报数均带口径（键数/命中数/退出码/rect 值的口径与来源）。
- ④ 未实测项标 `NOT_MEASURED`（如 Card 测试改前基线、参考文献截图本机路径），未以 0/空代替。
- ⑤ 代码推断（如「Card 失败为既有失败」）已显式标注为**推断**，未写成实测。
- ⑥ 页面内未使用长 `setTimeout`（浏览器量测走独立 Playwright 进程，非浏览器工具 5s 超时路径）。
