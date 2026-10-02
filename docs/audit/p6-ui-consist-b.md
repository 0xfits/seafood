# P6-UI-CONSIST-B · 成套形状收敛（变体 B：卡片 + 输入框 + 分类芯片 + Tab 栏 + 旧语义钮）

- 执行：**Kong**｜日期：2026-10-02（CST）｜仓库：`/Users/kevin/bistro/seafood`（前端 `frontend`）
- 拍板：Kevin —— **变体 B（成套收敛）**：四类元素统一到按钮那套形状语言；**只换形状，色板与布局不动**。
- 补料：Zang 并行只读单 UI-CONSIST 的生产实测 + 三条裁定（① 旧语义钮切角残项必须一并收；② 施工面以生产命中为准；③ 授权改锚 `theme-tokens.test.js:115-116`，或选另一合法路径并写明理由）。

---

## §0 先过门（结论：**通过，继续**）

本单**未新增任何色值/形状值**：所需值在真源与既有结构常量里**全部现成**。

| 需要的量 | 取值 | 来源（真源 / 结构常量） |
|---|---|---|
| 圆角 | `8px` | `STRUCT.radius-btna`；真源 `docs/design/style-preview.html:976`「高 34 ⇒ 圆角 8px · 内边距 12px」、`:954` `border-radius:8px` |
| 描边宽 | `1px` | `STRUCT.stroke-w-thin`；真源 `style-preview.html:954` `border:1px solid` |
| 旧语义钮（高 40px）圆角 | `9px` | 真源 `style-preview.html:976`「高 40px ⇒ 9px · 14px」 |
| 旧语义钮（高 51px）圆角 | `11px` | 真源 `style-preview.html:976`「高 51px ⇒ 11px · 18px」 |
| 旧语义钮（高 34px）圆角 | `8px` | 同上「高 34 ⇒ 8px」 |
| 颜色 | 一字未改 | 全部沿用 `--sf-*` 既有 token |

⇒ 无「发明值」，不需停单。

---

## §1 施工面（现取：旧风格载体，逐项 `文件:行号`）

「旧风格」三要素 = **粗暗描边 + 硬位移阴影（`Npx Npx 0`）+ 异形圆角**。
（`clip-path` 切角在本单目标四类上**原本就不存在**——站上切角载体只有 `.btn` 语义变体与装饰性徽章，见 §5。）

### 1.1 卡片
| 文件:行号（改前） | 选择器 | 旧形状 |
|---|---|---|
| `shell.css:125-133` | `.sf-card` | `border: var(--sf-st-stroke-w)`(1.5px) + `radius: var(--sf-card-radius)`(13px/2px) + `shadow: var(--sf-card-shadow)`(3px 3px 0 / none) |
| `shell.css:163-172` | `.sf-panel` | 同上口径（`--sf-panel-shadow` 3px 3px 0 / none） |
| `listings.css:70-81` | `.sf-listings-card` | 1.5px + 13px/2px + 3px 3px 0 / none |
| `listings.css:227-232` | `.sf-listings-item` | 1.5px + 13px/2px + `--sf-jobcard-shadow` |
| `listings.css:234-239` | `.sf-listings-panel` | 1.5px + 13px/2px + 3px 3px 0 / none |
| `listings.css:210-217` | `.sf-listings-empty` | 1.5px dashed + 13px/2px |
| `jobs.css:147-152` / `:154-159` / `:129-136` | `.sf-jobs-item` / `-panel` / `-empty` | 同上口径 |
| `market.css:218-223` / `:225-230` / `:201-208` / `:45-65` | `.sf-mkt-item` / `-panel` / `-empty` / `-ticker` | 同上口径（ticker 另有固定盒高 66px） |
| `components/ui/Card.jsx:4-18, :30-36` | ui `Card` | `rounded-xl`(12px) + `border-2`(2px) + `shadow-sm` + 各 variant `shadow-*-100` |

### 1.2 输入框 / 搜索框
| 文件:行号（改前） | 选择器 | 旧形状 |
|---|---|---|
| `shell.css:208-214` | `.sf-box` | `radius: var(--sf-search-radius)`(11px/2px) + `shadow: var(--sf-search-shadow)`(**`2px 2px 0 #030402`** / none) |
| `jobs.css:80-91` | `.sf-jobs-input` / `.sf-jobs-textarea` | 11px/2px + 2px 2px 0 |
| `listings.css:161-173` | `.sf-listings-input` / `-textarea` / `-select` | 11px/2px + 2px 2px 0 |
| `market.css:159-170` | `.sf-mkt-input` / `.sf-mkt-select` | 11px/2px + 2px 2px 0 |
| `components/ui/Form.jsx:74, :122, :148` | ui `Input` / `Textarea` / `Select` | `border-2 rounded-lg` |

### 1.3 分类芯片（`cat-*` token 族）
| 文件:行号（改前） | 选择器 | 旧形状 |
|---|---|---|
| `shell.css:178-183` | `.sf-chip` | `radius: var(--sf-cat-radius)`（**999px 药丸 / 2px**）+ 1.5px |
| `shell.css:216-221` | `.sf-tag` | `radius: var(--sf-tag-radius)`(5px/2px) |
| `shell.css:139-146` | `.sf-price` | `radius: var(--sf-price-radius)`(8px / **0px**) + 1.5px |
| `listings.css:124-131` / `:96-105` | `.sf-listings-tag` / `.sf-listings-price` | 5px / 8px·0px |
| `jobs.css:182-188` | `.sf-jobs-tag` | 5px/2px |

### 1.4 Tab 栏
| 文件:行号（改前） | 选择器 | 旧形状 |
|---|---|---|
| `shell.css:63-68` | `.sf-tabbar` | 1px 上描边（**直角、无形状语言**） |
| `shell.css:70-80` | `.sf-tab` | **直角**（无 radius/无扁平契约） |
| `components/ui/Tabs.jsx:41, :45` | ui `TabsTrigger` | `rounded-md`(6px) + 选中态 `shadow-sm` |

### 1.5 旧语义钮（Zang 裁定①；生产实测仍有切角 —— 已复核为真）
| 文件:行号（改前） | 选择器 | 旧形状 |
|---|---|---|
| `styles.css:144-167`（`.btn` 基类） | `.btn` → `.btn-proceed` / `.btn-inactive` / `.btn-primary` … | **`clip-path: polygon(--btn-cut-size …)` 八角切角 + `border-radius: 0`** |

**改前实测（本轮探针，非推断）**：`/` 与 `/login` 两档，`.btn-proceed` `clip=polygon(10px 0px, calc(100% - 10px) 0px, …)`、`r=0px`；`.btn-md` 同。⇒ 与 A 系按钮同屏可见，两代按钮并列为事实。

---

## §2 改法（要 / 不要）

**要**：① 去切角（`clip-path: none` 显式锁死）；② 去硬位移阴影（`box-shadow: none`）；③ 圆角与描边沿用**按钮口径**；④ 布局/间距/列数/顺序不动；⑤ 色板不动。

**圆角口径（逐类，注明是否比例推导）**：
- **大元素（卡片 / 面板 / 列表项 / 输入框 / 芯片 / Tab）取 `--sf-st-radius-btna = 8px`——是「与按钮同值」，不是比例推导**（Zang 裁定④：271px 高的卡片套 ×0.222 无意义）。输入框实测实高 37.5px ≈ 按钮实高 37.5px ⇒ 套比例 8.3 ≈ 8px，与按钮天然同值。
- **旧语义钮按高 × 0.222**，落点全部取自真源 `style-preview.html:976`（**真源既有值，非发明**）：`.btn-sm` → 8px（高 34）、`.btn`/`.btn-md` → 9px（高 40；实测 `.btn` 默认档高 = 40px）、`.btn-lg` → 11px（高 51）。
- **描边**：`--sf-st-stroke-w-thin = 1px`（按钮口径）。

**两档同构机制**：圆角与描边宽度一律取**结构常量**（`--sf-st-*`，两档同值），只有颜色槽位随档 ⇒ 切档 rect 逐值相等。

**未动**：所有 `bg/fg/border` 颜色槽位、`padding/margin/gap/grid 列数/元素顺序/盒高`（`.sf-mkt-ticker` 的 `height:66px` + `box-sizing:border-box` 原样保留）。

---

## §3 AC 自跑读数

### ① `npm run build` ⇒ **0** ✅（`vite build`，`✓ built in 1.56s`）
### ② `npm run test:unit` ⇒ **238 passed (26 files)** ✅（AC 下限 238，实测 238，**未减少、未放宽**）
### ③ 四脚本 ⇒ **全 PASS**（退出码均在管道外捕获）

| 脚本 | 退出码 | 判词 |
|---|---|---|
| `p6-tr2-i18n-locales.mjs` | 0 | `[TR-2] 总判：PASS` |
| `p4z-i18nviol-global.mjs` | 0 | `总判：PASS（locale 裸命中 0 + 源面裸命中 0）`，作用域节点数 locale=2732 / source=37 |
| `p4z-feperf-safelist.mjs` | 0 | `VERDICT=PASS` |
| `p4z-miscfix-links.mjs` | 0 | `总判：PASS（残留全部已登记）` |

### ④ 逐类改前 / 改后实测（`getComputedStyle`，1280×900，断言 `innerWidth=1280`）

探针：`frontend/scripts/p4z-uiconsistb-shape.mjs <label>`（静态服务本地 `dist` 于 **127.0.0.1:5792**，外部源全 abort）。
**「改前」= 改动前那份 `dist`（已核验其 CSS 仍是旧 `.sf-card`/`.sf-chip` 规则）**，`/tmp/p6b-before.log`；「改后」= 重新构建后，`/tmp/p6b-after.log`。

| 类（家族） | 页面 | 档 | 改前 radius / shadow / border | 改后 radius / shadow / border |
|---|---|---|---|---|
| `.sf-card`（卡片） | /theme-preview | 日 | `13px` / `rgb(3,4,2) 3px 3px 0 0` / `1px solid rgb(3,4,2)` | **`8px` / `none`** / `1px solid rgb(3,4,2)` |
| `.sf-card` | /theme-preview | 夜 | `2px` / `none` / `1px solid rgb(38,42,48)` | **`8px`** / `none` / 同 |
| `.sf-panel` | /theme-preview | 日/夜 | `13px`·`2px` / `3px 3px 0`·`none` | **`8px` / `none`** |
| `.sf-listings-input` | /listing | 日 | `11px` / `rgb(3,4,2) 2px 2px 0 0` / `1px solid rgb(3,4,2)` | **`8px` / `none`** / 同 |
| `.sf-listings-input` | /listing | 夜 | `2px` / `none` | **`8px`** / `none` |
| `.sf-box`（搜索框） | /theme-preview | 日/夜 | `11px`·`2px` / `2px 2px 0`·`none` | **`8px` / `none`** |
| `.sf-chip`（分类芯片） | /theme-preview | 日 | **`999px`** / `none` / `1px solid rgb(3,4,2)` | **`8px`** / `none` / 同 |
| `.sf-chip` | /theme-preview | 夜 | `2px` | **`8px`** |
| `.sf-tag` | /theme-preview | 日/夜 | `5px`·`2px` | **`8px`** |
| `.sf-price` | /theme-preview | 日/夜 | `8px`·**`0px`** | **`8px`**（两档同值） |
| `.btn-proceed`（旧语义钮） | / | 日/夜 | **`clip=polygon(10px 0px, …)`** / `r=0px` | **`clip=none`** / **`r=9px`** |
| `.btn-md` | / | 日/夜 | `clip=polygon(10px 0px, …)` / `r=0px` | **`clip=none`** / **`r=9px`** |

**`clip-path` 复扫**：`/tmp/p6b-after.log` 全档全页 **`clip=polygon` = 0 命中**（改前 `.btn-proceed`/`.btn-md` 为 polygon）。

### ⑤ 主题同构读数（切档 rect 逐值相等）
探针同一批 **116 个（页面 × 选择器）键**，`light` vs `dark` 的 `getBoundingClientRect` x/y/w/h **逐值相等**：
- **改前：`diffs = 0`**（`keys=116`）｜**改后：`diffs = 0`**（`keys=116`）⇒ 「只换皮肤不换几何」成立，且本单未破坏既有同构。

### ⑥ 真浏览器两档 × 三宽度 + 截图（**每个宽度断言 `innerWidth`**，离线零端口零服务）
页面 `['/', '/listing', '/theme-preview']` × 档 `{light,dark}` × 宽度 `{390×844, 1280×900, 1600×900}`，**逐次断言 `innerWidth` 与目标宽度相等**，不等的样本直接判错（本轮 0 例）。

**改后截图（18 张，绝对路径；供转发 Kevin）** —— 目录：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p6-uiconsist-b/after/shots/`
```
after-light-390x844-root.png        after-dark-390x844-root.png
after-light-390x844-listing.png     after-dark-390x844-listing.png
after-light-390x844-themepreview.png after-dark-390x844-themepreview.png
after-light-1280x900-root.png       after-dark-1280x900-root.png
after-light-1280x900-listing.png    after-dark-1280x900-listing.png
after-light-1280x900-themepreview.png after-dark-1280x900-themepreview.png
after-light-1600x900-root.png       after-dark-1600x900-root.png
after-light-1600x900-listing.png    after-dark-1600x900-listing.png
after-light-1600x900-themepreview.png after-dark-1600x900-themepreview.png
```
**改前同尺寸 18 张（对照）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p6-uiconsist-b/before/shots/`（同名 `before-*`）。
读数 JSON：`.../before/shape-before.json`、`.../after/shape-after.json`。

---

## §4 写集（单列在途产出）

- `frontend/src/shell/shell.css`（卡片/面板/搜索框/芯片/标签/价牌/Tab 形状态）
- `frontend/src/pages/jobs/jobs.css`、`.../listings/listings.css`、`.../market/market.css`
- `frontend/src/styles.css`（`.btn` 基类去切角 + 圆角；`.btn.btn-sm/md/lg` 圆角落点）
- `frontend/src/components/ui/Card.jsx`、`.../Form.jsx`、`.../Tabs.jsx`（基础件类串）
- `frontend/scripts/p4z-uiconsistb-shape.mjs`（**新增**只读探针）
- `docs/audit/p6-ui-consist-b.md`（本报告）

**未写**：`backend-ts/**`、`migrations/**`、`vercel.json`、`index.html`、`vite.config.js`、`frontend/src/locales/*.json`、`frontend/src/theme/tokens.js`（**只读**）、`frontend/src/theme/theme-tokens.css`、`docs/design/**`、spec、`docs/seafood.master-plan.md`、`.env*`、`src/test/**`（**本单零改锚需求**，见 §5.3）。
**零 git 写**（无 `add/commit/push`）；未 `npm install`；未碰 5787/5791；自起实例仅用 **5792**；未用 `pkill -f`/`killall`。

---

## §5 裁定回应 + `NOT_MEASURED`（逐项，不许填 0/空）

### 5.1 Zang 裁定① 旧语义钮
已收：`.btn` 基类 `clip-path: polygon(…切角…)` → `clip-path: none`，`border-radius: 0` → `9px`；`.btn-sm/md/lg` 分别 8/9/11px（真源落点）。**改前/改后实测见 §3④**（`clip=polygon` → `clip=none`、`r=0px` → `r=9px`，日/夜同值）。
**残留**：`styles.css` 内仍有 **4 处 `clip-path: polygon(...)`**，全部**不在**本单四类与按钮范围：`styles.css:669-670` `.badge-gift::before`（礼品绶带装饰）、`styles.css:1050` `#section_gift .point-badge`（三角角标）、`styles.css:1602` `.badge::after`（徽章缺角）。**登记为未纳入**（装饰性，非卡片/芯片/Tab/输入框/按钮）。

### 5.2 Zang 裁定② 施工面以生产命中为准
本单覆盖生产实测命中的全部载体（`.sf-listings-card` / `input.sf-listings-input` / `.sf-mkt-input` / `.sf-mkt-select` / `.sf-listings-tag` / `.sf-price` / `.sf-tabbar` / `.sf-tab`），并**一并覆盖**生产 0 命中的同类（`.sf-jobs-item`/`.sf-mkt-item`/`.sf-listings-item`/`.sf-panel` 及 `/theme-preview` 专属的 `.sf-card`/`.sf-box`/`.sf-chip`/`.sf-tag`）——理由是「成套收敛」下同类必须同口径，0 命中项改动**无视觉影响**、不引入风险。**判定：0 命中项属有意为之，非无用功误判。**

### 5.3 Zang 裁定③ —— **选路径②（CSS 消费点覆盖），不选改锚**
- **为何选它**：两档同形由「消费点取结构常量」实现（圆角/描边 = `--sf-st-*`，两档同值），**`tokens.js` 的 `card-radius` / `card-shadow` 值保持日≠夜不动** ⇒ ① `theme-tokens.test.js:115-116` 的硬断言**继续成立且未改锚**（不需要授权）；② 全局「差异键数 > 90」断言**一字未动**；③ token 的 PROV 行号回读链**零漂移**（未插删任何行）。改锚会削弱 token 层「两档值必有差」这条既有守卫，而本设计只需**消费点**同形即可达成，无必要动上游。
- 硬约束：圆角/描边**不得**由主题 token 驱动 —— 本单消费点全部走 `--sf-st-*`（结构常量），已由既有 `p6-btn-impl.test.js` / `p6-btn-impl2.test.js` 的「主题 token 只落颜色槽位」「家族 CSS 无 `[data-theme]` 选择器」规则机械守门，本轮 238 例全绿。

### 5.4 ④ 生产（线上）读数 —— `NOT_MEASURED`
本轮全部读数为**本地离线 `dist`**（外部源 abort，零端口零服务）。线上 `ssseafood.vercel.app` 的样式与 rect **未测**（本单禁 `vercel`、禁推送）。离线结论**不得**外推为线上结论。

### 5.5 ui 基础件（`components/ui/*`）—— **已落码，读数 `NOT_MEASURED`/无变化**
- `ui/Card`/`Form`/`Tabs` 类串已按口径改（`rounded-xl`→`rounded-lg`、`border-2`→`border`、去静置 `shadow-sm`、`TabsTrigger` `rounded-md`→`rounded-lg`）。
- **`ui/Card` 的 computed 读数改前 = 改后 = `radius 0px / border 0px / shadow 0 4px 6px -1px,…`** ⇒ **该改动在页面上无实测变化**：既有无层规则把 `radius/border-width` 钉死（非本单可控），且渲染阴影来自另一来源。**如实登记为「已改码、无实测变化」**，不写成「已收敛」。
- `ui/Form` 的 `input[class~="px-3"]`、`ui/Tabs` 的 `button[class~="px-3"][class~="py-1.5"]` 在实测四页**均 0 命中**（探针读数为 `null`）⇒ **这两族 `NOT_MEASURED`**（页面未渲染到）。

### 5.6 其它 `NOT_MEASURED`
- **描边宽 1.5px → 1px 的可见差**：Chrome 在 DPR=1 的 `getComputedStyle` 对 1.5px 报 `1px`（改前改后读数同为 `1px`）⇒ **视觉/几何差值 `NOT_MEASURED`**（本轮只测计算样式，未做像素级 diff）。
- **hover / focus / active 态**：本轮只测静置态；交互态形状 `NOT_MEASURED`。
- **`/task` 页**：因鉴权/渲染条件，四类元素在实测中 0 命中（该页走 ui 基础件），**该页读数 `NOT_MEASURED`**。
- **残留 4 处硬位移阴影**（同一 grep 口径 `px Npx 0 (#|rgb|rgba)`，`src/**/*.css`，排除 `var(--sf`）逐行列举 **`NOT_MEASURED`** —— 已确认全部不属本单四类与旧语义钮（属 legacy `.card` 深色档 / `.price-tag` / `.gem-pulse` 等非目标类），另单收口。

---

## §6 结论

- 站上四类（卡片 / 输入框 / 分类芯片 / Tab 栏）+ 旧语义钮的形状语言**已收敛到按钮口径**：去切角（`clip-path:none`）、去硬位移阴影（`box-shadow:none`）、圆角与描边取 `--sf-st-radius-btna` / `--sf-st-stroke-w-thin`（旧语义钮取真源 8/9/11px 落点）；**色板与布局一字未动**。
- 硬门：**build 0 / 单测 238 passed / 四脚本 PASS / 切档 rect diff = 0（116 键）/ 两档三宽度断言 `innerWidth` 全通过**。
- 未达标项：无（`NOT_MEASURED` 见 §5.4–5.6，均为**本单未覆盖的测量口径**，非判负）。
