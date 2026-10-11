# v1.5 §14 · 悬浮菜单收尾单（裁定⑧⑨）证据读数

> 落单：**Kong（实现）· 收尾单**（承接上轮「实现了 v1.5 §14 但撞迭代上限、未提交」，代码已在盘）。
> 本单只做**三个 delta + 归因重跑 + 证据入库 + 提交**，未重做已完成部分。
> 口径真源：`docs/design/design-system.spec.md` §14（现行版 v1.7 · Zang 裁定⑦⑧⑨）、`docs/route-layer.spec.md` v2.27 §37。
> 采数器/脚本落在 scratch（不随提交入库）：`v15-probe.mjs`（T85 相交 + 多档读出）、`v15-narrow.mjs`（容器内边距/溢出）、
> `v15-attrib.mjs`（归因式快照对照）、`cmp.mjs`（紧凑差异统计）。base URL：现版 `http://localhost:5787`（工作树 vite dev，未启停）、
> 父版 `http://localhost:5811`（HEAD `2c4b90a` 的 `git worktree` + 独立 vite，`node_modules` 软链、**未 npm install**）。

---

## 0 · 门套两读数 + 一项 N/A

| 门 | 命令 | 读数 | 判定 |
|---|---|---|---|
| 单测 | `cd frontend && npm run test:unit` | `Test Files 50 passed (50)` · `Tests 479 passed (479)` · 0 failed · EXIT=0 | **PASS**（基线 478；本单 +1 例 ⇒ 479 ≥ 478） |
| 构建 | `cd frontend && npm run build` | `✓ built in 1.72s` · EXIT=0（管道外捕获；`dist/assets/index-DmbE9dkE.js 424.04 kB`） | **PASS** |
| 前端 `tsc` | —— | `frontend/tsconfig*.json` 不存在（`ls` 空） | **N/A**（如实标注，未跑） |

`grep -c '@media' frontend/src/shell/shell.css` = **1**（唯一块 = L179 `@media (max-width: 767px)`；本单未新增块）。

---

## 1 · delta① 底栏⑤文案（Zang 裁定⑧）

改动（`frontend/src/locales/{zh,en,hk,vn}.json` + `frontend/src/shell/nav.js`）：

| 项 | 改前 | 改后 |
|---|---|---|
| 新键 `me` | ——（无） | zh `我的` · en `Me` · hk `我的` · vn `Tôi` |
| `nav.js` 第五项 | `labelKey: 'profile'` | `labelKey: 'me'` |
| 第五项 `key` / `path` / `requiresAuth` | `profile` / `profile` / `true` | **逐字不动** |
| `profile` 键值（四语） | `个人资料` / `Profile` / `個人資料` / `Hồ sơ` | **逐字不动**（实测：`TABLES.zh.profile === '个人资料'` 等四语断言绿） |
| `Header.jsx:284` 桌面下拉 / `:460` 移动面板 | 消费 `t('profile')` | **一字未动** |
| `r9-84-profile-entry.test.jsx`（锚「个人资料」`toContain(zh.profile)`） | —— | **一字未动**（本单未打开该文件） |

**计数前推**（新增 1 个顶层键/语 ⇒ 四语同补）：**顶层 `128 ⇒ 129` · 拍平 `1070 ⇒ 1071` · 四语节点 `4280 ⇒ 4284`**（与 spec §14.10「实取 129/1071/4284」逐字一致）。
落点 = 12 个既有测试文件的计数期望（逐处加「计数期望前推（delta①）」登记注释）：
`s8-locale-key-coverage.test.js` · `s9-ledger-kind-closure.test.js` · `i18n-batch-b4a/b4b/b5.test.jsx` · `i18n-violation-closeout.test.jsx` ·
`r9-93-points-symbol.test.jsx` · `r9-96-dashj-copy.test.jsx` · `s19-participants-truth-source.test.jsx` · `s23-participants-headcount.test.jsx` ·
`s5-publish-headcount.test.jsx` · `s7-submissions-panel.test.jsx`。另 `v15-nav-floatmenu.test.jsx` 第五格 label 期望 `profile ⇒ me`，并**新增 1 例**断言「key 仍 profile / labelKey 改 me / `me` 四语取值 / `profile` 四语值未变」。

---

## 2 · delta② 1440 重叠修正 · 桌面档右侧 gutter（Zang 裁定⑨）

**落点**（硬约束：不新增 `shell.css` 的 `@media`）：`frontend/src/styles.css` **末**追加：

```css
@media (min-width: 1024px) {
  .sf-route-container { padding-right: 140px; }
}
```

gutter 宽 `140px` = 菜单 `right:16` + 宽 `108` + 余量 `16`；断点取 `min-width:1024px`（仓内先例 `styles/tailwind-compat.css:754/781`）。

### 2.1 三档 × 三页 · T85「菜单 rect ∩ 正文 = 0」

判据口径（**不降级**）：`.sf-fm` 的 `getBoundingClientRect()` 与 `[data-sf-region="content"]` 子树**全部可见元素**逐个求相交面积，取 `max`（比 spec 只点名的卡片类更严）。

| 档 | 容器 `padding-right` | 正文内层右缘 | 菜单 rect | 父版正文内层右缘 | 改后 **相交面积** | 父版相交面积 | `scrollWidth == clientWidth` |
|---|---|---|---|---|---|---|---|
| 1440 | 20 → **140px** | 1420 → **1300** | `[1316, 1424]` | 1420 | **0**（9 组全 0） | 49920 | 1440 == 1440 ✓ |
| 1600 | 20 → **140px** | 1500 → **1380** | `[1476, 1584]` | 1500 | **0**（9 组全 0） | 11520 | 1600 == 1600 ✓ |
| 1920 | 20 → **140px** | 1660 → **1540** | `[1796, 1904]` | 1660 | **0**（9 组全 0） | 0 | 1920 == 1920 ✓ |

（「9 组」= 3 档 × 3 页 `/` · `/exchange` · `/messages`；命中元素数 `hits = 0`。）正文右缘与菜单左缘间隔 = 1440 档 `16px` / 1600 档 `96px` / 1920 档 `256px`，均 ≥16px（与 spec §14.0 裁定⑨「1440 档正文右缘 ≤1300、菜单左缘 1316」逐字一致）。

### 2.2 ≤767 零影响（硬约束）

| 档 | 容器 `padding-right`（现版 / 父版） | 正文内层右缘（现版 / 父版） | `.sf-fm` computed `display` | 溢出 |
|---|---|---|---|---|
| 390 | `10px` / `10px` | `380` / `380` | `none` | `scrollW 390 == clientW 390` |
| 375 | `10px` / `10px` | `365` / `365` | `none` | `scrollW 375 == clientW 375` |
| 320 | `10px` / `10px` | `310` / `310` | `none` | `scrollW 320 == clientW 320` |

⇒ 手机档**几何逐值相同**（gutter 规则不落入 `min-width:1024`）、零溢出、`.sf-fm` 恒 `display:none`。

---

## 3 · delta③ 归因式判据重跑（禁动画 + 父版 worktree 对照）

### 3.1 采数口径（对治上轮「动画未落定」）

* 父版实例：`git worktree add --detach <scratch>/wt-parent 2c4b90a` + `ln -s frontend/node_modules` + 独立 vite **:5811**（避开 5173/5174/5793–5799，且不动在跑的 5787）+ 独立 `cacheDir`；**未 npm install**。用完按**精确 PID 76416 `kill`**（已确认 `DEAD`、`5811 free`）并 `git worktree remove --force`（`git worktree list` 只剩主仓）。
* **禁动画**：`reducedMotion: 'reduce'` + 每次采样前注入 `*,*::before,*::after{animation:none!important;transition:none!important;…}`，再等 **3 帧 rAF** + 250ms 稳定窗 + 2.2s 数据窗。
* **只采可见元素**（`el.getClientRects().length > 0`）⇒ `display:none` 子树（1440 的 `.sf-tabbar`）不参与几何判据。
* 键 = `tag + 全 class + 同名序号`（**结构键，不含坐标**）；比对的属性 = `x/y/w/h/right/fs/display`。
* 页 = `/` · `/exchange`（父版无 `/messages` 路由 ⇒ 不入对照）；档 = 1440 / 1600 / 1920。

### 3.2 噪声基线（同一版本连跑两次须逐字节相同）

现版连跑两轮（`cur1` / `cur2`）：归一化（去 `tag` 字段）JSON **sha256 逐字节相同** =
`16207da62e4d1d81735f7e1ddd3c7b1ed14759b4948528ac160a835ef4973f20`；
紧凑对照 `onlyParent=0 / onlyCurrent=0 / attrDiff=0`（6 行对全 0）⇒ **采数确定性成立，差异非噪声**。

### 3.3 三集合（现版 `cur2` vs 父版 `2c4b90a`，6 行对）

| 行 | 现版元素 | 父版元素 | **仅父版有** | **仅现版有** | 公共键属性差 | 桶A(T79) | 桶B(`.sf-fm`) | 桶C(gutter) | **桶D(未归类)** |
|---|---|---|---|---|---|---|---|---|---|
| 1440 `/` | 558 | 529 | **0** | **29** | 401 | 0 | 29 | 396 | **5** |
| 1440 `/exchange` | 154 | 125 | **0** | **29** | 82 | 0 | 29 | 77 | **5** |
| 1600 `/` | 558 | 529 | **0** | **29** | 401 | 0 | 29 | 396 | **5** |
| 1600 `/exchange` | 154 | 125 | **0** | **29** | 82 | 0 | 29 | 77 | **5** |
| 1920 `/` | 558 | 529 | **0** | **29** | 401 | 0 | 29 | 396 | **5** |
| 1920 `/exchange` | 154 | 125 | **0** | **29** | 82 | 0 | 29 | 77 | **5** |

* **仅父版有 = 0**（6/6）⇒ 无任何元素被删除。
* **仅现版有 = 29**（6/6）⇒ 全部 = `.sf-fm` 子树（`nav.sf-fm` ×1 + `.sf-fm-item` ×5 + `.sf-fm-div` ×4 + 每项 icon `svg.sf-fm-ic` 及其子 `path/circle/rect` + `.sf-fm-label` ×5）。
* 归类桶（口径）：**A** = 字号提升元素；**B** = `.sf-fm` 子树；**C** = gutter 引起的容器/内容宽度变化面（C1：`inContent` 且 x/w/right/y/h 变化；C2：非 content 且**纯垂移**（y/h）——内容高度回流的必然下游）；**D** = 其余。
* **桶A = 0**：`T79` 字号提升在父版 `2c4b90a` 已存在（`4306527`/`ebca3ab`）⇒ 两版同值，无字号差。

### 3.4 桶D 非空 ⇒ **立缺陷（不解释掉）**

桶D 每行恰 **5 个元素**，逐行明细一致（坐标随档平移，形态相同）：

| 元素键 | 变化 |
|---|---|
| `a.nav-link#3` | `w: [52, 80]`（现版 52 / 父版 80） |
| `a.nav-link#1` / `a.nav-link#2` | `x` 左移 28（右对齐簇随之位移） |
| `nav.flex.space-x-1.mr-4#1` | `x: [822→794]`, `w: [220, 248]` |
| `div.hidden.md:flex.items-center.space-x-4#1` | `x: [822→794]`, `w: [522, 550]` |

根因（现取）：`a.nav-link#3` = **桌面左 nav 第 3 项**，文案键 `shard`；locale 值 `shard` 由 `碎片市场`(80px) 改 `市场`(52px) ⇒ 该项宽 −28px ⇒ 右对齐簇整体位移。
该值变更 = **spec §14 T80 已冻结合同的一部分**（「底栏第二项 = 『市场』→`/exchange`，key `shard`」+ §14.10 B「值变更 2 键 = `shard` + `home`」，Zang/Kevin 定档），**非本单新引入、非回归**。

> **D3 立案（请 Zang 裁定）**：归因式判据的「**允许变更集**」（本单指令 = `T79 字号 ∪ .sf-fm 子树 ∪ gutter 宽度变化面`）**未覆盖**「§14 已批准 locale **值变更**引起的桌面文案/宽度变化面」。本单**不自行扩集**，按「归不进三类 ⇒ 立缺陷」逐字执行 ⇒ **立案 D3**，请裁定：① 补入「§14 已批准文案/值变更面」为第 4 类；或 ② 指定把 `shard`/`home` 的值变更改为**新增键**承接（同裁定⑧对 `profile` 的做法），以让桌面左 nav 不受底栏文案连带。

> **裁定⑩（已闭环）**：采 ① ⇒ 登记为**归因第④类具名因果面**，并经**回退实验**证桶D 100% 归因、无残差。见 **§7**。

### 3.5 同轮发现的第二处 T85 缺口（立案）

裁定⑨把 gutter 断点定为 `min-width:1024px`（AC 只要求 1440/1600/1920 三档）。**实测中间档仍相交**：

| 档 | `.sf-fm` rect | 正文内层右缘（现版） | 相交面积（`/`） |
|---|---|---|---|
| 768 | `[644, 752]` | 748 | **49920** |
| 900 | `[776, 884]` | 880 | **49920** |
| 1023 | `[899, 1007]` | 1003 | **49920** |

（`768 ≤ 宽 ≤ 1023` = **桌面布局**（外壳断点 767）而 gutter 未生效 ⇒ 菜单压在正文上。）

> **D4 立案（请 Zang 裁定）**：裁定⑨的 AC 未覆盖 `768–1023` 中间档；该档 `T85`「相交 = 0」**不成立**。一行可改（`@media (min-width:768px)`），但**超出本单授权**（裁定逐字指定 1024）⇒ 本单不改、只立案。若认定为真机/平板必过面，请追单。

> **裁定⑩（已修）**：`frontend/src/styles.css` 末块 `min-width: 1024px` → **`min-width: 768px`**（对齐 `.sf-fm` 显示阈值）；六档 × 三页重跑相交 = 0、零溢出。见 **§6**。

---

## 4 · 改锚清单（本单全部非新增文件改动）

* 计数前推（12 文件）：`s8-locale-key-coverage.test.js` · `s9-ledger-kind-closure.test.js` · `i18n-batch-b4a/b4b/b5.test.jsx` · `i18n-violation-closeout.test.jsx` · `r9-93-points-symbol.test.jsx` · `r9-96-dashj-copy.test.jsx` · `s19-participants-truth-source.test.jsx` · `s23-participants-headcount.test.jsx` · `s5-publish-headcount.test.jsx` · `s7-submissions-panel.test.jsx`（`128→129` / `1070→1071` / `4280→4284`）。
* `v15-nav-floatmenu.test.jsx`：第五格 label 期望 `TABLES[lang].profile → TABLES[lang].me`；新增 delta① 断言例 1 条。
* **一字未动**（硬约束）：`r9-84-profile-entry.test.jsx` · `Header.jsx:284`/`:460` · `profile` 四语键值 · `shell.css`（仍唯一 767 块）。

## 5 · NOT_MEASURED

* **真机（iOS/Android）读数**：承 `N26`/`N23`，本轮仍 `NOT_MEASURED`（需 LAN 入口 `5800` 真机；本单未动服务）。
* **`768–1023` 中间档**：D4 **已修**（裁定⑩，`min-width:768px`）⇒ 六档 × 三页重跑相交 = 0、零溢出（见 §6.2）；该面**无残留未测**。
* **父版对照页 `/messages`**：父版无该路由 ⇒ `NOT_MEASURED`（不入对照）。
* **父版对照的窄档（≤767）归因**：本单只对窄档做「gutter 零影响」逐值读数（§2.2）；未做 ≤767 全量归因（父版底栏项集/图标与现版不同，结构差非本单变更面）。

---

## 6 · 修补单（Zang 裁定⑩）· D4 修复 —— 桌面 gutter 起点 1024px → 768px

**唯一代码改动**：`frontend/src/styles.css` 末块 `@media (min-width: 1024px)` → **`@media (min-width: 768px)`**（1 行 + 上方注释同步）；
`.sf-route-container { padding-right: 140px }` 逐字未动。**未在 `shell.css` 新增 `@media`**（`grep -c '@media' frontend/src/shell/shell.css` = **1**，仍唯 `L179 (max-width:767px)`）。

**对齐依据**：`.sf-fm` 可见性 = 桌面档（shell.css 唯一 `(max-width:767px)` 块内 `display:none`）⇒ 菜单显示区间 = **`min-width:768px`**，恰为 767 块的补集；gutter 起点改用同一阈值 ⇒ 菜单与 gutter 同区间生效，无空档。

### 6.1 修前复现（`pre-d4`，确认 D4 为真）

| 档 | `.sf-fm` rect | 正文内层右缘 | 相交面积（`/`） | 命中元素数（`/` · `/listing` · `/exchange`） |
|---|---|---|---|---|
| 768 | `[644, 752]` | 748 | **49920** | 12 · 12 · 8 |
| 1023 | `[899, 1007]` | 1003 | **49920** | 12 · 12 · 8 |
| 1024 | `[900, 1008]` | 880 | **0** | 0 · 0 · 0 |

（`<=767` 隐藏块与 `<=1023` gutter 未生效之间 = 768–1023 空档，实测相交 49920 px²，与 §3.5 立案逐值一致。）

### 6.2 修后六档 × 三页 · T85「相交 = 0」+ 零横向溢出（`post-d4`）

判据口径同 §2.1：`.sf-fm` rect 与 `[data-sf-region="content"]` **子树全部可见元素**逐个求相交取 `max`；`scrollWidth == clientWidth` 取 `documentElement`。

| 档 | `/` interMax · hits | `/listing` interMax · hits | `/exchange` interMax · hits | scrollW==clientW（三页） | 正文内层右缘 |
|---|---|---|---|---|---|
| **768** | **0** · 0 | **0** · 0 | **0** · 0 | 768 == 768 ✓ | 628 |
| **1024** | **0** · 0 | **0** · 0 | **0** · 0 | 1024 == 1024 ✓ | 880 |
| **1280** | **0** · 0 | **0** · 0 | **0** · 0 | 1280 == 1280 ✓ | 1120 |
| **1440** | **0** · 0 | **0** · 0 | **0** · 0 | 1440 == 1440 ✓ | 1300 |
| **1600** | **0** · 0 | **0** · 0 | **0** · 0 | 1600 == 1600 ✓ | 1380 |
| **1920** | **0** · 0 | **0** · 0 | **0** · 0 | 1920 == 1920 ✓ | 1540 |

⇒ **18/18 行相交面积 = 0、命中 0、零横向溢出**（768/1024 中间档已并入，无空档）。

### 6.3 768 档细读（内容预算 = 768 − 140 gutter = 628；未见压破）

| 页 | 容器 padL/padR | 内容区实宽 | 内层右缘 | 内层最右元素 right | 越界元素数 |
|---|---|---|---|---|---|
| `/` · `/listing` · `/exchange` | `20 / 140` | **608**（=768−20−140） | 628 | 628（≤628） | **0** |

⇒ 内容区最宽子元素恰充满 608px 可用宽、右缘 628 = 容器内容右缘，**无元素越出内容框、无横向溢出**（三页一致）。
菜单左缘 644 − 正文右缘 628 = **16px 间隙**（≥ 16 硬下限）。

### 6.4 ≤767 零影响（`post-d4` 重跑，与 §2.2 逐值相同）

| 档 | 容器 `padding-right` | 正文内层右缘 | `.sf-fm` computed `display` | 溢出 |
|---|---|---|---|---|
| 390 | `10px` | 380 | `none` | 390 == 390 ✓ |
| 375 | `10px` | 365 | `none` | 375 == 375 ✓ |
| 320 | `10px` | 310 | `none` | 320 == 320 ✓ |

⇒ 手机档几何**逐值未变**（gutter 规则不落入 ≤767）、零溢出、`.sf-fm` 恒 `display:none`。

### 6.5 门套（本单重跑）

| 门 | 命令 | 读数 | 判定 |
|---|---|---|---|
| 单测 | `cd frontend && npm run test:unit` | `Test Files 50 passed (50)` · `Tests 479 passed (479)` · 0 failed · **EXIT=0** | **PASS**（≥479） |
| 构建 | `cd frontend && npm run build` | `✓ built in 1.97s` · **EXIT=0**（管道外捕获） | **PASS** |

---

## 7 · D3 归类为归因第④类（具名因果面）+ 算术闭合 + 回退实验

**第④类定义（新增，纳入归因判据的「允许变更集」）**：
> **§14 已批准 locale 值变更（§14.10 B 的 `shard`：`碎片市场`→`市场`）引起的桌面文案/宽度变化面。**

（前 3 类：A = T79 字号提升面；B = `.sf-fm` 子树；C = gutter 引起的容器/内容宽度变化面。）

### 7.1 算术闭合（逐值，浏览器实测）

| 量 | 实测 |
|---|---|
| `a.nav-link` computed `font` | `14px` / `weight 500` / `letter-spacing: normal` |
| CJK 单字 advance | `市` = 14.00px · `场` = 14.00px |
| 文本宽 `市场`（2 字） | 28.00px |
| 文本宽 `碎片市场`（4 字，旧值） | 56.00px |
| 盒宽 = 文本 + 内边距 | padL 12 + padR 12 = **24（定值）** ⇒ `28+24=52` ✓ / `56+24=80` ✓ |

⇒ **Δ = (4−2) 字 × 14px/字 = 28px**，盒宽 **80 → 52**。方向（字少⇒窄）与量级（28px）与实测 `a.nav-link#3 w:[80, 52]` **逐值一致**。
旁证：同 nav 另两项 `社区奖励` / `社区任务` 均 4 字 = `56+24 = 80`，与 `a.nav-link#1/#2` 实测宽 80 一致。

### 7.2 回退实验（第④类**纳入回退集**，机制可行）

* 机制：测量期用 `page.evaluate` 把 `a.nav-link`（`textContent === '市场'`）**DOM 文本回写旧值 `碎片市场`**，等 2 帧 rAF + 150ms 稳定窗后再采快照 ⇒ `snap-cur-d4-rb`（对照 = `snap-cur-d4` 未回退）。
* 父版 = HEAD `2c4b90a` 快照（`snap-parent.json`，`git show 2c4b90a:frontend/src/locales/zh.json` ⇒ `shard = 碎片市场`，已核）。

| 差异集（现版 vs 父版 `2c4b90a`，6 行对） | onlyParent | onlyCurrent | attrDiff | 桶A | 桶B | 桶C | **桶D** |
|---|---|---|---|---|---|---|---|
| `parent` vs `cur-d4`（**未回退**） | 0 | 29 | 401 / 82 | 0 | 29 | 396 / 77 | **5 / 行（6/6）** |
| `parent` vs `cur-d4-rb`（**回退 `shard` 旧值**） | 0 | 29 | **396 / 77** | 0 | 29 | 396 / 77 | **0（6/6）** |

* 桶D 明细（未回退）= `a.nav-link#3` `w:[80,52]` + `a.nav-link#1/#2` `x` 左移 28（右对齐簇随之位移）+ `nav.flex.space-x-1.mr-4#1` 与 `div.hidden.md:flex.items-center.space-x-4#1` `x/w`（簇总宽回流的必然下游）。
* 回退后 **attrDiff 恰 −5**（`401→396` / `82→77`），桶D **归零** ⇒ **桶D 100% 归因于 §14 已批准 `shard` 值变更**，无残差 ⇒ 第④类成立、**非缺陷**（原 §3.4 立案撤销）。

### 7.3 备注（§14.10 B 另一值变更 `home`）

§14.10 B 的值变更 2 键 = `shard` + `home`（`首页`→`海鲜市场`）。实测桌面左 nav 的 `a.nav-link` **三项 = `社区奖励` / `社区任务` / `市场`**（`home` 文案不经该面）⇒ `home` 值变更在本 nav 面**零几何差**；回退**仅** `shard` 即令桶D→0，反证 `home` 非本面残差来源。
