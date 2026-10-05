# S33 · 台账 B12 阶段二 —— `admin.html` 约束解算 + 删第二批（+ card/badge 子集）—— 报告

- **仓库**：`/Users/kevin/bistro/seafood`　**角色**：Kong（实现方）　**执行**：2026-10-05（CST）　**runid**：`s33-20261005T004849Z`
- **上游**：Zang 派单（`docs/seafood.master-plan.md:1421` A 条）＝ 台账 B12 阶段二；阶段一（S30）已上线（`styles.css` `0/118`，删 39 条）。
- **交付**：① 改后 `frontend/src/styles.css`（唯一产品改动面）+ 步骤 1 现取产物；② 本报告；③ `frontend/.s33-artifacts/s33-20261005T004849Z/`；④ 新增只读/复核脚本 `frontend/scripts/s33-*.mjs`。
- **硬口径遵守**：只改 `frontend/src/styles.css` + `frontend/scripts/**`（新增）+ `docs/audit/`（新增）✓；**未改** `frontend/admin.html`、`frontend/src/**` 其它产品文件、`locales/**`、`backend-ts/**`、`migrations/**`、`docs/*.spec.md`、`docs/OPEN-ITEMS.md`、`docs/seafood.master-plan.md` ✓；**未 commit / 未 push** ✓；**未 `npm install`** ✓；**未碰 `.env*`** ✓；**未启停 5787/5788，未起任何本地实例（未占 5792–5799；浏览器量测走 `page.route`↦`dist`，零服务）** ✓；**禁 `pkill -f`/`killall`（未使用）** ✓；产物原始输出一律 `.txt`/`.json`（**无 `.log`**，现取 0 个）✓；**不确定的一律不删** ✓。

---

## §0 对锚与范围

```
$ git log --oneline -3
9cd77c3 docs: §5.352/v0.352 —— S32c 回执与核盘 …
5e8d06a fix(errors): S32c —— sendError 同族 16 处迁 R107 …
07c1767 docs: §5.351/v0.351 —— S32 交回码映射表 …

$ git branch --show-current → main
$ git status --porcelain（开工 08:48:15）→ 无任何 tracked 改动（仅既有未跟踪 backend-ts/.p*-artifacts/**、frontend/.s2*-artifacts/ 等历史产物）
```

**`styles.css` 三代 sha 链（现取）**：

| 态 | sha256 | 行数(`wc -l`) |
|---|---|---|
| S25 基线 | `14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959` | 1642 |
| 阶段一后（= 本单改前，已入库） | `e2b97ee05c5b7a04667f9bd66e5426214976a98e0013ec31e636bfb580421dc6` | 1523 |
| **阶段二后（本单产出）** | `0c6ee8c34190eb8442e27d1971be2dd2ea566c6dc40546079f1b1a79509afd13` | **1060** |

```
$ shasum -a 256 frontend/src/styles.css
0c6ee8c34190eb8442e27d1971be2dd2ea566c6dc40546079f1b1a79509afd13  frontend/src/styles.css
$ git diff --numstat -- frontend/src/styles.css
2	465	frontend/src/styles.css        ← ★ AC6：删除列(465) >> 新增列(2)
```
> 新增 2 行 = 两处**共享块局部摘除**后的选择器行（见 §2），非新增规则；无任何色板/布局新增。

**★ 台账口径纠偏（现取为准）**：派单写「阶段一剩余 **32** 条」，**现取实为 71 条**：
```
阶段一报告 §3 的三态 = 可删 71 / 保留-守卫 86 / 保留-有消费 82（= 删除后 239 分片）
阶段一报告 §5 的 zeroParts 278 → 239（−39）⇒ 删除前 可删 = 71 + 39 = 110；110 + 86 + 82 = 278 ✓
⇒ 报中印出的 71 条**已是删除后**清单（其中不含任何阶段一被删项；现取复核 `.card-hover`/`.notification`/`.price-tag` 在 styles.css 命中 = 0）
⇒ 派单「其余 32」= 71 − 39 的**重复扣减笔误**；真实剩余 = 71。
```
本单按「**以你现取为准**」执行：删「可删」**71 分片全部**（= 65 个 distinct 选择器）+ `card`/`badge` 可删子集。

**范围（读）**：`scripts/s30-selector-inventory.mjs`（阶段一盘点原件，未改）· `.s30-artifacts/s30-20261004T221953Z/05-deletion-manifest.json`（阶段一 revert 清单）· 改前 `styles.css` 已存为 `13-styles-before.css`。
**范围（写）**：`frontend/src/styles.css` + 新增 `scripts/s33-*.mjs`（8 个只读/复核脚本）+ 本报告 + `.s33-artifacts/**`。

---

## §1 `card`/`badge` 约束现取与判定（★ 本批成败关键）

### 1.1 三大事实（现取；产物 `10-admin-html-facts.txt`）

**① 位置**：`frontend/admin.html`（仓内唯一；全仓仅 `index.html` + `admin.html` 两个 HTML）
```
$ find frontend -name 'admin.html' -not -path '*/node_modules/*'
frontend/admin.html
```

**② 是否被服务/被引用 —— 既未被服务、也零引用**
```
$ grep -rn 'admin\.html' frontend/src frontend/index.html frontend/vite.config.* frontend/public frontend/scripts frontend/package.json
frontend/scripts/s30-selector-inventory.mjs:37,116        ← 盘点脚本自身硬编码（把 admin.html 列进 htmlFiles）
frontend/scripts/s25-selector-inventory.mjs:20,157        ← 同上（S25 原件）
⇒ 产品链（src/ · index.html · vite.config.* · public/ · deploy.sh · package.json）**零引用**

$ grep -n 'rollupOptions' frontend/vite.config.js
17:    rollupOptions:          ← 只配 output.manualChunks，**无 input** ⇒ 单一默认入口 index.html
$ ls frontend/dist/*.html
frontend/dist/index.html      ← 构建产物**不含** admin.html ⇒ **未被服务**
$ grep -c 'styles\.css' frontend/admin.html
0                             ← 它**不引** frontend/src/styles.css
```

**③ 其 `class=` 用法逐条**（静态属性 + JS 动态赋值；全文 `10-admin-html-facts.txt`）
- 静态 `class=` distinct：`nav` · `nav-inner` · `brand` · `container` · `layout` · `sidebar` · `item` · `item active` · `muted` · `section` · `section active` · `sub-layout` · `sub-sidebar` · `sub-list` · `content-pane` · **`card`** · **`card sidebar`** · **`card hero`** · **`card sub-sidebar`** · `card-inner` · `title` · `subtitle` · `row` · `grid` · `hero` · `footer` · **`badge get`** · `secondary` · `rail-btn` · `json` · `endpoint` · `path` 等。
- 其中**命中 styles.css 选择器名**的仅两个 token：**`card`**（`class="card"` / `"card sidebar"` / `"card hero"` / `"card sub-sidebar"`）与 **`badge`**（`class="badge get"`，静态 5 处）。
- JS 动态赋值：`:793 card.className = 'card'`、`:811 badge.className = 'badge get'` —— 同样来自本文件自身 `<script>`。
- **关键**：该文件 `:7–114` 是一整段**内联 `<style>`**，自带 `.card` / `.card-inner` / `.badge` / `.badge.get` 等规则 —— admin.html 的 `card`/`badge` **由它自己的内联样式定义**，与 `frontend/src/styles.css` 无任何关系。

### 1.2 判定

> **`admin.html` 未被服务、且产品链零引用、且不引 `styles.css`（其 `card`/`badge` 由自身内联样式定义）⇒ 对 `frontend/src/styles.css` 的选择器消费面 = 0 ⇒ `card`/`badge` 不构成约束。**

阶段一「命中者一律不得删」的保守口径，在本单按派单**显式重裁**为：**命中来源若不属本 CSS 的服务面，即不构成约束**。故 `card`/`badge` 的**可删子集**（四类面全证零 且 非守卫面）纳入本批（逐条证据见 §3① 与 `12-evidence-AC1.json`）。

### 1.3 该文件是否该删、归谁（登记；本单**不删**）

- **事实**：`frontend/admin.html`（83,197 B，1597 行）是自包含的旧管理面板（内联样式 + 内联脚本），不参与 Vite 构建（无 `input`）、不入 `dist/`、无任何引用；其调用的接口形状**已漂移**（旁证：`docs/audit/p5-missing-tables-triage.md:39` 记其 `GET /api/auth/verify?token=` 与后端只注册 `POST` 不符；`:728/730` 还重复列了同一 `/api/prize/all`）。
- **建议**：**可退役**（删文件或迁 `docs/` 归档）。
- **归属**：**不属本单**（本单硬口径禁改 `admin.html`）；建议开独立台账条目，**归前端（后续单）**；删除前需确认无仓外运维书签/脚本依赖（仓内现取零依赖，仓外不可知）。
- **风险提示**：若保留，盘点脚本（s25/s30）会**继续把它算作 HTML 消费面**，令 `card`/`badge` 名义上「有消费」。本单处理办法：**不动脚本原件**，另立 `s33-selector-inventory.mjs`（唯一差异 = 摘除 admin.html）作「裁定后视图」，两视图并列登记（§3①）。

---

## §2 本批删除逐条 + revert 清单

**批次构成（现取）**：
- **A｜阶段一「可删」剩余 71 分片**（= 65 个 distinct 选择器）—— 四类消费面全证零（§3①）。
- **B｜`card`/`badge` 可删子集 68 分片**（admin.html-only 消费 79 分片中，剔除守卫面 10 + 保守保留 1）。
- **C｜连带 `@keyframes` 3 个**：`badge-slide-in`（仅 `.badge` 引用）· `loading`（仅 `.skeleton`）· `burst`（仅 `.burst-circle`）—— apply 脚本**断言**「引用点全部落在被删规则内」方允许删除（已通过）。
- **合计**：删除区域 **118 个**（113 整规则/组 + 2 共享块局部摘除 + 3 关键帧），删 **14,737 字节**，文件 **1523 → 1060 行**。

**只服务被删规则而一并摘除的伪元素规则**：`.card::before` · `.card::after` · `.card.tone-*::before`×6 · `.card.card-*::before`×6 · `[dark] .card::before` · `.timeline::before` · `.timeline-item::before` · `.junit .j::after`。

**共享块（只摘选择器、不删整块）—— 2 处**（= `git diff` 新增 2 行的来源）：
1. `:107` `h1, h2, h3, h4, h5, h6, .swedish-title` → 摘 `.swedish-title`，**保留 h1–h6**。
2. `:1012` `[dark] .card p, [dark] .card li, [dark] .card .text-text-secondary` → 摘前两项，**保留 `[dark] .card .text-text-secondary`**（`text-text-secondary` 为 JSX 实消费 ⇒ 非零消费）。

**★ 刻意保留（不删）**：
- **S22 守卫面（禁碰）**：`[dark] .card`(×2) / `[dark] .card:hover` / `[dark] .card.tone-{gold,green,blue}` 及 `:hover`（描边环 9）· `.badge-dot`(1) · `@keyframes pulseGem`(1) · 焦点环 8 · `url(#clip-path…)` 20 · `.cls-*`/`#chest*` 整块 · pinned 的 `.badge-gift::before` / `#section_gift .point-badge` / `.badge::after`。
- `[dark] .badge::after`（**保守保留**）：**非**守卫标记项，但它是 pinned `.badge::after` 的夜间覆盖规则（改它即改 pinned 元素的夜间渲染）⇒ 按「宁可少删」保留；在 `s33` 裁定视图里如实登记为「本批唯一剩余『可删』」（§3①）。
- `.btn-primary:focus`（焦点环，守卫）保留 ⇒ 出现「`.btn-primary` 基座已删、`:focus` 环仍在」的同族半态，**登记**（§6-4）。
- `#section_gift .card p.text-text-secondary` / `[dark] .card .text-text-secondary` / `[dark] .card .text-text-muted`：因 `text-text-secondary`/`text-text-muted` 为 JSX 实消费名 ⇒ 整条**不删**（登记 §6-5）。

### 2.1 逐条（`选择器 : 原行号`；原行号 = 改前 `e2b97ee0` 的行号）

| 原行号 | 选择器 | kind | 删字节 |
|---|---|---|---|
| 107 | `.swedish-title` | selector | 39 |
| 198 | `.btn-primary` | rule | 91 |
| 202 | `.btn-primary` | rule | 96 |
| 203 | `.btn-primary:hover` | rule | 49 |
| 389 | `.page-content` | rule | 105 |
| 401 | `.tasks-grid, .rewards-grid` | rule | 127 |
| 408 | `.button-group` | rule | 70 |
| 415 | `.card` | rule | 574 |
| 429 | `.card:hover` | rule | 97 |
| 435 | `.card.tone-gold` | rule | 63 |
| 436 | `.card.tone-green` | rule | 64 |
| 437 | `.card.tone-blue` | rule | 63 |
| 440 | `.card.card-primary` | rule | 75 |
| 441 | `.card.card-success` | rule | 76 |
| 442 | `.card.card-proceed` | rule | 75 |
| 444 | `.card.card-inactive` | rule | 79 |
| 445 | `.card.card-warning` | rule | 77 |
| 448 | `.card.card-primary:hover` | rule | 68 |
| 449 | `.card.card-success:hover` | rule | 68 |
| 450 | `.card.card-proceed:hover` | rule | 68 |
| 451 | `.card.card-inactive:hover` | rule | 69 |
| 452 | `.card.card-warning:hover` | rule | 68 |
| 458 | `.card::before` | rule | 418 |
| 472 | `.card::after` | rule | 382 |
| 492 | `.card h3` | rule | 110 |
| 498 | `.claimed-time` | rule | 68 |
| 499 | `.card:hover .claimed-time` | rule | 42 |
| 503 | `.avatar` | rule | 220 |
| 516 | `.form-group` | rule | 39 |
| 520 | `.form-group label` | rule | 85 |
| 527 | `.modal-backdrop` | rule | 215 |
| 552 | `.modal-title` | rule | 112 |
| 560 | `.modal-actions` | rule | 98 |
| 568 | `.progress-bar` | rule | 112 |
| 575 | `.progress-fill` | rule | 108 |
| 582 | `.skeleton` | rule | 185 |
| 588 | `@keyframes loading` | keyframes | 114 |
| 598 | `.badge` | rule | 127 |
| 623 | `.badge__icon` | rule | 115 |
| 632 | `.tooltip` | rule | 60 |
| 637 | `.tooltip .tooltip-text` | rule | 368 |
| 655 | `.tooltip:hover .tooltip-text` | rule | 70 |
| 661 | `.pagination` | rule | 118 |
| 669 | `.pagination-item` | rule | 126 |
| 676 | `.pagination-item:hover:not(.pagination-item-disabled)` | rule | 95 |
| 680 | `.pagination-item-active` | rule | 86 |
| 685 | `.pagination-item-disabled` | rule | 69 |
| 691 | `.table` | rule | 55 |
| 696 | `.table th, .table td` | rule | 113 |
| 702 | `.table th` | rule | 66 |
| 707 | `.table tr:hover` | rule | 57 |
| 712 | `.tags-input` | rule | 149 |
| 721 | `.tag` | rule | 165 |
| 730 | `.tag-remove` | rule | 206 |
| 748 | `.timeline` | rule | 58 |
| 753 | `.timeline::before` | rule | 148 |
| 763 | `.timeline-item` | rule | 66 |
| 768 | `.timeline-item::before` | rule | 232 |
| 781 | `.calendar-container` | rule | 113 |
| 788 | `.calendar-container .fc` | rule | 43 |
| 794 | `.page-content` | rule | 41 |
| 798 | `.tasks-grid, .rewards-grid` | rule | 67 |
| 807 | `.table` | rule | 57 |
| 814 | `.card` | rule | 35 |
| 815 | `.card h3` | rule | 79 |
| 816 | `.card.tone-gold:hover` | rule | 65 |
| 817 | `.card.tone-green:hover` | rule | 66 |
| 818 | `.card.tone-blue:hover` | rule | 65 |
| 853 | `.card` | rule | 194 |
| 859 | `.card::before, .card::after` | rule | 79 |
| 864 | `.card:hover` | rule | 147 |
| 871 | `.card.tone-gold, .card.tone-green, .card.tone-blue, .card.card-primary, .card.card-success, .card.card-proceed` | rule | 240 |
| 882 | `.card.tone-gold::before, .card.tone-green::before, .card.tone-blue::before, .card.card-primary::before, .card.card-success::before, .card.card-proceed::before` | rule | 191 |
| 892 | `.card.tone-gold h3, .card.card-primary h3` | rule | 115 |
| 893 | `.card.tone-green h3, .card.card-success h3` | rule | 116 |
| 894 | `.card.tone-blue h3, .card.card-proceed h3` | rule | 115 |
| 897 | `.card.card-inactive h3` | rule | 97 |
| 898 | `.card.card-warning h3` | rule | 94 |
| 925 | `section[id^="section_"] > h2.swedish-title` | rule | 151 |
| 934 | `section[id^="section_"] .card p, section[id^="section_"] .card li` | rule | 88 |
| 943 | `#section_gift .card` | rule | 62 |
| 966 | `.card-split` | rule | 70 |
| 967 | `.card-top` | rule | 79 |
| 968 | `.card-bottom` | rule | 83 |
| 969 | `.tag-price-primary` | rule | 169 |
| 970 | `.tag-price-proceed` | rule | 173 |
| 971 | `.tag-price-success` | rule | 173 |
| 972 | `.tag-price-warning` | rule | 169 |
| 973 | `.tag-price-inactive` | rule | 178 |
| 974 | `.points-price` | rule | 76 |
| 975 | `.points-price .points-major` | rule | 86 |
| 976 | `.points-price .points-minor` | rule | 88 |
| 977 | `.junit` | rule | 69 |
| 978 | `.junit .j` | rule | 73 |
| 979 | `.junit .j::after` | rule | 150 |
| 980 | `[data-theme="dark"] .tag-price-primary` | rule | 193 |
| 981 | `[data-theme="dark"] .tag-price-proceed` | rule | 193 |
| 982 | `[data-theme="dark"] .tag-price-success` | rule | 189 |
| 983 | `[data-theme="dark"] .tag-price-warning` | rule | 197 |
| 984 | `[data-theme="dark"] .tag-price-inactive` | rule | 198 |
| 985 | `[data-theme="dark"] .junit .j` | rule | 65 |
| 1005 | `[data-theme="dark"] .card h1, [data-theme="dark"] .card h2, [data-theme="dark"] .card h3, [data-theme="dark"] .card h4, [data-theme="dark"] .card h5, [data-theme="dark"] .card h6` | rule | 214 |
| 1012 | `[data-theme="dark"] .card p, [data-theme="dark"] .card li` | selector | 106 |
| 1024 | `[data-theme="dark"] section[id^="section_"] > h2.swedish-title` | rule | 98 |
| 1319 | `#open-chest` | rule | 206 |
| 1331 | `#reset-chest` | rule | 90 |
| 1409 | `[data-theme="dark"] .card::before` | rule | 294 |
| 1422 | `.badge` | rule | 544 |
| 1442 | `.badge:hover` | rule | 57 |
| 1448 | `@keyframes badge-slide-in` | keyframes | 133 |
| 1471 | `.badge.badge-primary` | rule | 89 |
| 1475 | `.badge.badge-proceed` | rule | 89 |
| 1479 | `.badge.badge-success` | rule | 89 |
| 1483 | `.badge.badge-warning` | rule | 89 |
| 1487 | `.badge.badge-inactive` | rule | 105 |
| 1500 | `.celebrate-burst` | rule | 128 |
| 1501 | `.burst-circle` | rule | 243 |
| 1502 | `@keyframes burst` | keyframes | 154 |

> **revert 三法（任选）**：
> 1. **整文件回退（推荐，逐字节）**：`git checkout HEAD -- frontend/src/styles.css`（回 `e2b97ee0`，= 阶段一态）；或 `cp frontend/.s33-artifacts/s33-20261005T004849Z/13-styles-before.css frontend/src/styles.css`。
> 2. **按清单精确恢复**：以本表 `选择器:原行号` 为核对单，从 `git show HEAD:frontend/src/styles.css` 取回规则块插回原处。
> 3. **联合回退**：`12-deletion-manifest-combined.json`（= 阶段一 43 项 + 阶段二 118 项，**新文件，未覆盖** `05-deletion-manifest.json`）逐代回退到 `14feca1e`（S25 基线）。
> 本单**未 commit**（无 sha）；复现脚本 = `scripts/s33-apply-deletions.mjs`（`--dry` 可无副作用预演）。

---

## §3 三件判据读数

### 判据 ①：受影响元素 = 0（静态 + 真浏览器，含复合形态）

**(1a) 静态 —— `--check-deleted`（逐选择器 142 项）**
```
$ node scripts/s33-selector-inventory.mjs --json --check-deleted .s33-artifacts/s33-20261005T004849Z/12-check-manifest.json
checkDeleted: checked=142  PASS=true  stillInCss=0  consumedNonZero=0
totals: codeTokens=1361  htmlTokens=2  svgUrlRefs=10
⇒ 142/142 全 PASS；无一条仍留在 styles.css；无一条被任何消费面命中。
```
**(1a') 独立复核（与盘点脚本不共用代码）**：`scripts/s33-independent-consumption-check.mjs` 自建 className/id 上下文扫描 → 63 个被删名 **`consumedHits = 0` · `ALL_ZERO`**（`15-independent-consumption.txt`）。

**(1a'') 三态前后（两视图并列，均自洽）**

| 视图 | 改前 可删/守卫/有消费（Σ） | 改后 可删/守卫/有消费（Σ） |
|---|---|---|
| `s30` 原件（含 admin.html，阶段一口径） | 71 / 86 / 82（**239**） | **0** / 86 / 14（**100**） |
| `s33` 变体（排除 admin.html，本单裁定） | 140 / 96 / 3（**239**） | **1** / 96 / 3（**100**） |

- 两视图 Σ 均 239 → 100（−139 分片 = 本批删除选择器数）；**守卫数不降**（s30 86→86；s33 96→96，其中 10 条正是被保留的 card/badge 守卫）。
- s33 视图改后唯一「可删」= `[dark] .badge::after`（刻意保留，§2）。

**(1b) 真浏览器 10 臂（5 路由 × {日,夜} × 1280）**
```
$ node scripts/s33-browser-measure.mjs .s33-artifacts/s33-20261005T004849Z/12-check-manifest.json .s33-artifacts/s33-20261005T004849Z/30-browser-measure.json
arms=10  deletedNames=63  deletedSelectors=120  armsWithHits=0  all_zero=true
pageErrors=0  selErrors=0
blocked_origins=[cdnjs.cloudflare.com, fonts.googleapis.com, cdn.jsdelivr.net, raw.githubusercontent.com]   ← 外部 CDN 一律 abort
```
- 手段同阶段一：**无 dev server** —— `page.route('http://sf.local/**')` ↦ `frontend/dist`；`chromium.launch({executablePath: Google Chrome})`；5 路由 = `/ /login /task /listing /shard`；每路由 × {`light`,`dark`}（改 `<html data-theme>`）。
- **★ 本单额外（防复合选择器盲区）**：逐臂对每个被删名执行 **3 种形态** `.<名>` · `.<名> *`（后代）· `* > .<名>`（子代）；对 **120 个被删完整选择器**逐一 `querySelectorAll(sel)`；再叠 **整页 DOM class/id 全量扫描 ∩ 被删名集**（最强形态：任何元素只要带被删 class/id 即报）。
- 读数：**10/10 臂全 0**（`armsWithHits=0`），四类探针**全空**，`selector 语法错误 = 0`。

### 判据 ②：`npm run build` exit 0 + 产物 CSS 被删（独立）选择器命中 = 0

```
$ npm run build → exit 0（✓ built in 1.75s）; dist/assets/index-BodEg26n.css
$ node scripts/s33-distcss-diff.mjs <before.css> <after.css>      # before = 用改前 css 重建的产物
selectorsBefore=1085  selectorsAfter=966  removed=119  added=0(PASS)
$ node scripts/s33-distcss-check.mjs 12-check-manifest.json        # 逐被删选择器在 after 产物选择器集里查
checkedSelectors=139  rawHits=0  PASS=true
allowedSameNameDifferentSource=[{sel:'.table', bodies:['display:table'],
  why:'Tailwind 工具类 display:table（非 styles.css 规则；before/after 产物均在）'}]
```
- **`added = 0`**：产物未新增任何选择器。
- **同名不同源已现证**：`.table` 在 after 产物**只剩** `display:table`（Tailwind 工具类；候选 `table` 来自 `src/pages/ThemePreviewPage.jsx` 的 `<table>`/`tableTitle`/`const table`）；**before 产物同一条也在**，且 before 还多出 `border-collapse:collapse;width:100%` 与 `display:block;overflow-x:auto` 两条 = 本单删掉的 styles.css 规则；**改后 `src/styles.css` 含子串 `table` = 0 处**（`grep -c table src/styles.css → 0`）⇒ 该命中**不可归属**于本单被删规则。
- 结论：**本单被删的独立选择器在产物 CSS 命中 = 0**（唯一同名残留已证异源，两版产物一致）。

### 判据 ③：`npx vitest run` 失败集与基线逐条相同 + 四脚本全 PASS

```
$ cp 13-styles-before.css src/styles.css && npx vitest run → exit 1 | Test Files 4 failed | 50 passed (54) | Tests 7 failed | 471 passed (478)
FAIL src/test/accessibility/Accessibility.test.jsx [file]
FAIL src/test/e2e/basic.spec.js [file]
FAIL src/test/components/Card.test.jsx > renders Card with default props
FAIL src/test/components/Card.test.jsx > renders Card with different variants
FAIL src/test/components/Card.test.jsx > renders CardHeader
FAIL src/test/components/Card.test.jsx > renders CardTitle
FAIL src/test/components/Card.test.jsx > renders CardContent
FAIL src/test/components/Card.test.jsx > applies hover effect when enabled
FAIL src/test/performance/VirtualList.test.jsx > updates visible items on scroll
$ cp 13-styles-after.css src/styles.css && npx vitest run  → exit 1 | 逐行与基线**完全相同**
$ diff <(基线失败集) <(改后失败集) → IDENTICAL ✓
```
（与 `docs/audit/s25-…md §4.5`、S30 §5 基线失败集**同名/同数**：7 failed / 471 passed / 478。）
```
$ npx vitest run src/test/unit/s22-decor-cleanup.test.js → exit 0 | Test Files 1 passed | Tests 9 passed (9)   ← S22 守卫 9/9 全绿
$ node scripts/p4z-feperf-safelist.mjs  → VERDICT=PASS   exit 0
$ node scripts/p4z-i18nviol-global.mjs  → 总判：PASS（locale 裸命中 0 + 源面裸命中 0）   exit 0
$ node scripts/p4z-miscfix-links.mjs    → 总判：PASS（残留全部已登记）   exit 0
$ node scripts/p6-tr2-i18n-locales.mjs  → 总判：PASS   exit 0
```

**S22 守卫面现取（改后）**：`url(#clip-path…) = 20` · `0 0 0 Npx = 19` · 焦点环规则 = 8 · pinned 三选择器均在且含 `-webkit-clip-path:none;clip-path:none`（S22 测试 9/9 独立复核通过）。

---

## §4 判负（必做）

**方法（仓外副本）**：`rsync` 复制 `frontend/`（排除 `node_modules`/`dist`/`.s*-artifacts`）到 `…/scratch/s33-negctl-s33-20261005T004849Z/frontend`；副本内 `styles.css` 恢复为**改前 `e2b97ee0`**（使被删选择器仍在）；注入 `src/negctl-probe.jsx`：`<div className="card timeline">negctl</div>`（`card` = B 族代表，`timeline` = A 族代表）。

| 阶段 | s33 变体（排除 admin.html）三态 | 探针名判定 |
|---|---|---|
| (a) 基线（未注入） | 可删 **140** / 守卫 96 / 有消费 3 | `.card`·`.timeline`·`.card-split`·`.claimed-time`·`.card.card-primary` **全 = 可删** |
| (b) 注入后 | 可删 **78**（−62）/ 守卫 87 / 有消费 **45**（+42） | `.card`·`.timeline` **从零消费清单消失**（= 判为有消费）；`.card.card-primary` → 保留-有消费；`.card-split`·`.claimed-time` 仍可删 |
| (c) 复原（移走探针） | 可删 **140** / 守卫 96 / 有消费 3 | 与 (a) **逐字节相同** ⇒ **回绿** |

```
s30 原件同测：可删 71 →（注入）69 →（复原）71；保留-有消费 82 → 55 → 82
```
⇒ **红 → 绿**，两版脚本一致证明：判定确实按「类名上下文消费」走，**非恒绿**。证据：`.s33-artifacts/s33-20261005T004849Z/34-negctl.txt`。

---

## §5 未做与 NOT_MEASURED

- **NOT_MEASURED = 空**。判据①浏览器项**已实测**（10 臂 + 复合形态 + DOM 全扫，全 0），非 NOT_MEASURED。
- **未删的「真残留」**（`s33` 视图改后 100 分片中的守卫 96 + 可删 1）：
  - `96 守卫`：`#chest`/`.cls-*`（`url(#clip-path…)`=20）· `.badge-dot` · `[dark] .card`/`.card.tone-*` 描边环 9 · `@keyframes pulseGem` · 焦点环 8 · pinned 三选择器 —— 均属 S22 不变式面，**须与守卫测试同批处理**，本单**不动**。
  - `1 可删` = `[dark] .badge::after`：**刻意保留**（§2）。
- **未删的 `@keyframes`**：`glintSweep`（`:842`）—— **既有孤儿**（P6-BTN-IMPL 删 `.btn::after` 后遗留），**非本批连带**，未扩面。
- **孤儿注释未清理**：本批只删选择器 / 连带伪元素规则 / 连带关键帧，未删任何注释（与阶段一 §8-5 同口径）。示例：`:397 /* 卡片悬停效果增强 */`（阶段一已遗）、`:414`、`:434`、`:1421`。零运行期影响。
- **`admin.html` 未删、未改**（§1.3 已登记归属与建议）。
- **未改任何守卫测试**（`src/test/unit/s22-decor-cleanup.test.js` 逐字未动）。
- **未起任何本地服务**（5792–5799 未占）。

---

## §6 自曝

1. **口径纠偏（重大）**：派单/台账记「阶段一剩余 32 条」，**现取实为 71 条**（§0 双式自洽 + 逐条复核）。本单按「以你现取为准」删 **71 分片**。若 Zang 认定应只删 32，则 `12-deletion-manifest-phase2.json` 的 A 部分可按行号子集回退；B 部分（`card`/`badge`）与纠偏无关，可独立保留。
2. **本批规模远大于派单预估**：实际删 **139 分片 / 118 删除区 / 14,737 字节 / 463 行**（派单估 32 条）。驱动力 = 口径纠偏（+39）+ `card`/`badge` 子集（+68）。**风险面因此显著扩大**，特此显式登记（虽全部有四类面零消费证据 + 浏览器 10 臂复合探针 + 产物差集 + 判负四重佐证）。
3. **`card`/`badge` 判定依赖「admin.html 不构成约束」**：证据链 = 位置 / 零引用 / 不入 dist / 不引 styles.css / 自带内联样式定义同名类（§1）。**超出仓内可证范围的一点**：无法证明仓外（运维书签、外部脚本）不以文件系统方式直接打开 `frontend/admin.html`。若存在，该文件以**其自带内联样式**呈现（与 styles.css 无关）⇒ 本批删除**仍不影响它**。
4. **S22 守卫面「张力」登记**：`.btn-primary` 基座（`:198`/`:202`/`:203`）已删，但 `.btn-primary:focus`（`:204`，焦点环守卫）**保留** ⇒ 同族半态；`.card` 基座全删，但 `[dark] .card` 等 9 条描边环**保留**。这是「守卫面禁碰」与「零消费清理」的直接张力，**如实登记**，后续须随 S22 守卫单一并处理。
5. **遗留 `.card` 后代选择器**：`#section_gift .card p.text-text-secondary` / `[dark] .card .text-text-secondary` / `[dark] .card .text-text-muted` 因另一类名实消费而**保留**（现取 3 条）。
6. **产物 `.table` 同名命中**：已现证异源（Tailwind `display:table`，before/after 均在；改后 styles.css 含 `table` 子串 0 处），**不计为「被删选择器命中」**。这是判据② 唯一需「同名不同源」裁决的点。
7. **共享块只摘选择器**：2 处（`:107`、`:1012`），故 `--numstat` 新增列 = **2**（非 0）；AC6「删除 >> 新增」成立（465 vs 2）。
8. **并发他方改动（非本单）**：收工时 `git status --porcelain` 现 `M backend-ts/scripts/p3v-00-fold-fix-verify.ts`（mtime `08:54:37`）。**本单未触碰 `backend-ts/**`**（全程仅涉 `frontend/**` 与 `docs/audit/`）⇒ 系**他方并发**（开工时该文件干净），**本单不认领、未回退**。`HEAD` 未前移（仍 `9cd77c3`）。
9. **`styles.css` 行尾/编码**：原为 LF；删除脚本按字节区间精确切除，未改行尾/编码；无「整文件重排」式伪装。
10. **本单不 commit**：所有改动静置工作树（`frontend/src/styles.css` + 新增脚本/报告/产物），未 `commit`/`push`。
11. **产物命名**：原始输出无 `.log` 后缀（`find .s33-artifacts -name '*.log' | wc -l → 0`）。

---

### 附 A：本单新增脚本（均只读/复核，不改产品）
`scripts/s33-html-scope.mjs`（HTML 面按文件拆解）· `s33-independent-consumption-check.mjs`（独立消费复核）· `s33-apply-deletions.mjs`（删除执行，`--dry` 可预演）· `s33-selector-inventory.mjs`（= s30 唯一差异版：摘除 admin.html）· `s33-distcss-check.mjs` · `s33-distcss-diff.mjs` · `s33-browser-measure.mjs` · `s33-negctl.mjs`（判负辅助）。**s25/s30 原件逐字未动。**

### 附 B：`.s33-artifacts/s33-20261005T004849Z/` 产物
`10-admin-html-facts.txt` · `10-s30-inventory.txt`/`.json` · `11-html-scope.txt`/`.json` · `12-deletion-manifest-phase2.json` · `12-check-manifest.json` · `12-deletion-manifest-combined.json` · `12-evidence-AC1.json` · `13-styles-before.css`/`13-styles-after.css` · `15-independent-consumption.txt` · `20-s30-inventory-post.txt` · `21-s33-inventory-post.json` · `22-check-deleted-post.json` · `23-build.txt` · `24-*.txt`（四脚本）· `25-distcss-check.json` · `26-build-before.txt` · `27-dist-before.css` · `28-dist-after.css` · `29-distcss-diff.json` · `30-browser-measure.json` · `31-vitest-baseline.txt` · `32-vitest-after.txt` · `33-s22-test.txt` · `34-negctl.txt`
