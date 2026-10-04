# S30 · 台账 B12 阶段一 —— 零消费选择器「消歧 + HTML/SVG 核对 + 删第一批」—— 报告

- **仓库**：`/Users/kevin/bistro/seafood`　**角色**：Kong（实现方）　**执行**：2026-10-04（CST）
- **上游裁定**：Zang 终审「取变体 Ⅰ（删除）但**分期执行**」；本单 = 第一阶段（消歧 + 核对 + 删第一批 ≤40 条）。
- **输入**：`frontend/scripts/s25-selector-inventory.mjs`（S25 只读盘点）· `frontend/.s25-artifacts/s25-20261004T210725Z/*` · `docs/audit/s25-dead-keys-and-selector-inventory.md §3`。
- **硬口径遵守**：只改 `frontend/src/styles.css` + `frontend/scripts/**` + 新增 `docs/audit/s30-dead-css-phase1.md` + 新增 `frontend/.s30-artifacts/**`；**未改** `frontend/src/**` 其它产品文件 / `frontend/src/locales/**` / `backend-ts/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md` ✓ · **未 commit / 未 push** ✓ · **未 `npm install`** ✓ · **未碰 `.env*`** ✓ · **未启停 5787/5788、未起任何实例（未占 5792–5799；浏览器量测走 `page.route`↦`dist`，零服务）** ✓ · **禁 `pkill -f` / `killall`（未使用）** ✓ · 产物原始输出**一律 `.txt`/`.json`（无 `.log`）** ✓。

---

## §0 对锚与范围

```
$ git log --oneline -3
7ed025f chore(gates): S27 0043 apply 后收口 … + S28 退役 10 键升为不变式 … + 台账 B9 闭环与 B13 登记
2feded4 docs: §5.344/v0.344 —— 我 apply 0043 …
6d2ca98 docs: §5.343/v0.343 —— S25/S26 回执与核盘 …

$ git branch --show-current → main
$ git status --porcelain（开工）→ 无任何 tracked 改动（仅既有未跟踪 backend-ts/.p*-artifacts/** 等历史产物）
```

> **对锚漂移（并发，见 §8-1）**：开工时 `HEAD=7ed025f`；收工前 `HEAD` 已前移为 `ef4ac17`（他方仅改 `docs/` 的派单提交，**未触碰 `styles.css`**）。现取 `git show HEAD:frontend/src/styles.css` sha256 **仍 = `14feca1e…`**（= 本单改前基线）⇒ 本单 delta 依旧干净、`git diff --numstat` 仍为 `0/118`。


**`styles.css` 三态对锚（本单唯一产品改动面）**：

| 态 | sha256 | 行数 |
|---|---|---|
| 改前（= HEAD `7ed025f` = S25 基线）| `14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959` | 1642 |
| 改后（本单产出）| `e2b97ee05c5b7a04667f9bd66e5426214976a98e0013ec31e636bfb580421dc6` | 1524 |

```
$ shasum -a 256 frontend/src/styles.css
e2b97ee05c5b7a04667f9bd66e5426214976a98e0013ec31e636bfb580421dc6
$ git diff --numstat -- frontend/src/styles.css
0	118	frontend/src/styles.css          ← 0 新增 / 118 删除（AC6：删除 >> 新增；色板与布局未动）
```

**范围（读）**：`frontend/scripts/s30-selector-inventory.mjs`（**盘点脚本升级版**，见下）· `frontend/scripts/s30-dyn-probe.mjs`（消歧诊断）· `.s30-artifacts/<runid>/*`。
**范围（写）**：`frontend/src/styles.css`（删第一批）+ 新增盘点脚本/报告/产物。

**盘点脚本升级**（不改 s25 以保 S25 基线可复现；新增 `scripts/s30-selector-inventory.mjs` = s25 超集）：
1. **消歧裁定表** `DISAMBIG`（写死判据 + 出处）——把 s25 的「不确定(动态拼接)」逐名裁定 `ZERO/CONSUMED/UNRESOLVED`；
2. **守卫感知** —— 逐规则标注是否落 S22 守卫面（`url(#clip-path…)` 计数 20 / 零偏移环 19 / 焦点环 8 / pinned 选择器 / `#chest` 块）；
3. **三态判定** —— 可删 / 保留-有消费 / 保留-守卫 / 保留-不确定；
4. **`--check-deleted <manifest>`** —— 逐条核「该选择器已从 `styles.css` 消失」且「全仓消费数仍 = 0」，任一不满足 exit 1。

---

## §1 消歧「不确定（动态拼接）」

**口径澄清（重要）**：s25 的 `nameBucketCounts['不确定(动态拼接)'] = 36` 与 §3.3 的「82（HTML 面）」是**按分片出现次数**（occurrence-weighted）——例如 `card` 在 72 个分片里各记 1 次 ⇒ 记 82；**distinct 名**其实只有：动态 **16** 个（含 `card`）/ HTML **2** 个（`card`,`badge`）。本节按 **distinct 名逐名**裁定；分片级则由报告 §3 三态清单承载。

```
$ node scripts/s30-dyn-probe.mjs button-group card card--badge-space card-bottom card-hover \
    card-inactive card-primary card-proceed card-split card-success card-top card-warning \
    claimed-time page-content price-tag timeline
```

**裁定 = 全部 ZERO（确零）**——s25 的「不确定」是**朴素前缀匹配的假阳性**：片段来自 `data-sf-m={...}` 模板 / i18n 键 / JS 变量，**并非 `className` 拼接**。逐名：

| # | 名 | s25 触发片段（出处）| 运行时能否生成该名？ | 裁定 |
|---|---|---|---|---|
| 1 | `button-group` | `button` ← `<button type=…>`/`type="button"`（ErrorHandling.jsx:195 / ThemePreviewPage.jsx:119-121）| 否：片段是元素标签/属性词，非类名拼接；全仓 0 处字面 `button-group` | **ZERO** |
| 2 | `card` | `cardTitle` ← `ThemePreviewPage.jsx:149` | 名义上另由 `admin.html class="card"` 命中（HTML 面）⇒ 归「有消费（HTML）」 | **CONSUMED(HTML)** |
| 3 | `card--badge-space` | `card-` ← `ThemePreviewPage.jsx:149 data-sf-m={\`card-${i+1}\`}` | 否：`card-`+数字 ⇒ 只产 `card-1…card-8`（**data 属性**，非 class）；0 处字面 | **ZERO** |
| 4 | `card-bottom` | 同上 | 否；0 处字面 | **ZERO** |
| 5 | `card-hover` | 同上 | 否；0 处字面 | **ZERO** |
| 6 | `card-inactive` | 同上 | 否；0 处字面 | **ZERO** |
| 7 | `card-primary` | 同上 | 否；0 处字面（仅在 `.card.card-primary` 复合选择器出现，非拼接生成）| **ZERO** |
| 8 | `card-proceed` | 同上 | 否；0 处字面 | **ZERO** |
| 9 | `card-split` | 同上 | 否；0 处字面 | **ZERO** |
| 10 | `card-success` | 同上 | 否；0 处字面 | **ZERO** |
| 11 | `card-top` | 同上 | 否；0 处字面 | **ZERO** |
| 12 | `card-warning` | 同上 | 否；0 处字面 | **ZERO** |
| 13 | `claimed-time` | `cla` ← `JobReviewPage.jsx:114`（`className` 切词伪影）| 否：片段非前缀生成器；0 处字面 | **ZERO** |
| 14 | `page-content` | `page` ← `BottomTabBar.jsx:27`（nav item）| 否；0 处字面 | **ZERO** |
| 15 | `price-tag` | `price` ← `MarketPage.jsx:230/311/379`（`sf-mkt-price`/`row.price`）| 否；0 处字面 | **ZERO** |
| 16 | `timeline` | `timeliness` ← i18n 键 `timelinessPanel.*`（RatingTimelinessPanel.jsx:104-113）| 否；0 处**类名**字面（命中皆 `timeliness*`）| **ZERO** |

**逐名字面核（现取，全 = 0）**：
```
$ for n in button-group page-content price-tag claimed-time card-hover card-split card-top \
    card-bottom card-primary card-success card-proceed card-inactive card-warning card--badge-space; \
    do grep -rn "$n" src/ --include=*.jsx --include=*.js | grep -v src/test/ | wc -l; done
→ 全部 0（`timeline` = 17，但逐条皆为 `timeliness`/`/api/timeliness`，非类名 `timeline`）
$ grep -rnoE "…card-[A-Za-z-]*…" src/  → 唯一 `card-` 拼接 = ThemePreviewPage.jsx:149 `card-${i + 1}`（其余 `card-bg` 等为 theme/tokens.js 设计 token **键名**，非类名）
```

**结论**：**无一名判不准** ⇒ 「保留-不确定」= **0 条**（禁删名单空）。原 16 名全部归「确零」（`card` 归 HTML 面消费）。s25 的「不确定」桶清空。

---

## §2 HTML / SVG 面核对（逐面）

**面清单**：`frontend/index.html` · `frontend/**/*.html`（实有 `index.html` + `admin.html`；`public/` 下无 `.html`）· `frontend/public/**` 静态件 · `styles.css` 内嵌 `url(#…)` · `@keyframes` 引用。

```
$ find frontend -name '*.html' -not -path '*/node_modules/*'
frontend/index.html
frontend/admin.html
frontend/dist/index.html            ← dist 产物，非源面（不计）
$ ls frontend/public → 只有 brand/（png,svg）、images/partners/（png）—— 无 .html
```

| 面 | 事实（现取）| 判定 |
|---|---|---|
| `index.html` | **纯 SPA 壳**：`<body>` 仅 `<div id="root">`+`<script src="/src/main.jsx">`；**无任何 class 消费**（仅 `id="root"`/`id="fa-css"`，均非 styles.css 选择器）；`L23` 有注释 `<!-- Montserrat for badge-gift text -->`（**注释，非 class**）| 对零消费清单**零命中** |
| `admin.html` | 自带内联 `<style>`，**不引 `styles.css`**（S22 §1 已证）。其 `class="card"` / `class="badge get"` 使 token `card`/`badge` 落入 htmlTokens | `card`/`badge` = **命中** |
| `styles.css` 内嵌 `url(#…)` | 10 个 distinct id：`clip-path`…`clip-path-10`（**图形定义引用**，非选择器名；S22 守卫 ② 钉 `url(#clip-path…)` 计数 20）| 与零消费**选择器名**无交集 ⇒ 不构成「选择器命中」 |
| `@keyframes` 引用（`animation:`）| 本批**未涉及**关键帧删除；`@keyframes pulseGem`（被 S22 守卫 ⑥ 钉）**保留** | 无 |

**HTML 面「命中名」逐名（distinct = 2）**：
```
$ node -e "…从 s25 JSON 取 html=true 的 distinct 名…"  → {card, badge}
```
- `card`：命中 `admin.html`（`class="card"`、`class="card sidebar"`、`class="card hero"`、`class="card sub-sidebar"` 等）；
- `badge`：命中 `admin.html`（`class="badge get"`）。
- **处置（遵 Zang 硬口径「命中者一律不得删」）**：二者**一律保留**（其全部选择器分片 + 一切含 `card`/`badge` 的复合选择器，如 `.card.tone-*`、`.badge.badge-*`、`.card::before`、`#section_gift .card` …）。
- 旁注（如实登记）：`admin.html` 实**不引** `styles.css`（S22 §1 已证），故此命中属**巧合**；但本单口径为**保守**（宁可少删），故按命中保留，不计入删除集。

**核对结论**：HTML/SVG 面命中名 = `{card, badge}` ⇒ **全部保留**；零消费清单中**无**其它名命中 HTML/SVG 面。

---

## §3 三态清单（本轮 = 删除后；机器可读全量见 `.s30-artifacts/<runid>/06-s30-inventory.json`）

```
$ node scripts/s30-selector-inventory.mjs --json --check-deleted <manifest>
stateCounts = { 可删: 71, 保留-守卫: 86, 保留-有消费: 82 }   （zero 分片合计 = 239）
保留-不确定 = 0（§1 已清）
```

**① 可删（四类面全证零；逐条「选择器:行号」）—— 71 条**：
```
L107 .swedish-title            L198/L202/L203 .btn-primary[/(:hover)]
L389 .page-content             L401 .tasks-grid  L401 .rewards-grid
L408 .button-group             L498 .claimed-time
L503 .avatar                   L516 .form-group  L520 .form-group label
L527 .modal-backdrop           L552 .modal-title  L560 .modal-actions
L568 .progress-bar             L575 .progress-fill  L582 .skeleton
L623 .badge__icon              L632 .tooltip  L637 .tooltip .tooltip-text  L655 .tooltip:hover .tooltip-text
L661 .pagination  L669 .pagination-item  L676 .pagination-item:hover:not(.pagination-item-disabled)
L680 .pagination-item-active   L685 .pagination-item-disabled
L691 .table  L696 .table th  L696 .table td  L702 .table th  L707 .table tr:hover  L807 .table(@media)
L712 .tags-input  L721 .tag  L730 .tag-remove
L748 .timeline  L753 .timeline::before  L763 .timeline-item  L768 .timeline-item::before
L781 .calendar-container  L788 .calendar-container .fc
L794 .page-content(@media)  L798 .tasks-grid/@media  L798 .rewards-grid/@media
L925 section[id^="section_"] > h2.swedish-title   L1024 [data-theme=dark] … > h2.swedish-title
L966 .card-split  L967 .card-top  L968 .card-bottom
L969 .tag-price-primary  L970 .tag-price-proceed  L971 .tag-price-success  L972 .tag-price-warning  L973 .tag-price-inactive
L974 .points-price  L975 .points-price .points-major  L976 .points-price .points-minor
L977 .junit  L978 .junit .j  L979 .junit .j::after
L980 [dark] .tag-price-primary  L981 [dark] .tag-price-proceed  L982 [dark] .tag-price-success  L983 [dark] .tag-price-warning  L984 [dark] .tag-price-inactive
L985 [dark] .junit .j
L1319 #open-chest  L1331 #reset-chest  L1500 .celebrate-burst  L1501 .burst-circle
```
> 本单**只删其中 39 条**（§4）；其余 32 条为**留待后续批次**（本单 ≤40 上限）。

**② 保留-有消费（82 分片）**：
- JSX 面在用（`codeTokens`）：`.btn*`（`btn`/`btn-a`/`btn-sm…`）、`.sf-i18n-badge`、`sf-card` 等——**非零消费，未列**；
- HTML 面命中（本清单内）：`card`(72 分片) / `badge`(10 分片) —— 其选择器及一切含 `card`/`badge` 的复合规则；
- SVG `url(#…)`：0 个选择器名命中。

**③ 保留-守卫（86 分片；S22 不变式，禁碰）**：
- `[svg-url]` / `[in-chest]`：`#chest`、`.cls-1…cls-26`（两段嵌入 SVG，钉 `url(#clip-path…)`=20）⇒ **整块保留**；
- `[zero-ring]`：`.btn-*:focus`(8)、`[dark] .card`/`.card.tone-*`(描边环 9)、`.badge-dot`(1)、`@keyframes pulseGem`(1)；
- `[pinned-sel]`：`.badge-gift::before`、`#section_gift .point-badge`、`.badge::after`（S22 测试 ①-2 要求三者**存在**且含 `-webkit-clip-path:none;clip-path:none`）。

---

## §4 本批删除逐条 + revert 清单

**批次构成（39 条选择器 + 4 条随删孤儿注释）**：按族 —— `.notification` 族(4) · `.tag-status` 族(7) · `.badge-gift` 族(8，**保留 pinned `::before`**) · `.badge__*`(4) · `.badge-primary/-success/-warning/-danger`(4) · `.badge-dot--*`(3) · `.card-hover`(2) · `.price-tag`(2) · `.gem-pulse`(2) · `#section_gift` 后代(2) · `.card--badge-space`(1)。

**逐条（`选择器:原行号`，原行号 = 改前 `styles.css` 行号）**：
```
1  .card-hover                              :398
2  .card-hover:hover                        :402
3  .badge-dot--gold                         :463
4  .badge-dot--green                        :464
5  .badge-dot--blue                         :465
6  .tag-status                              :508
7  .tag-status__text                        :509
8  .tag-status-inactive .tag-status__text   :514
9  .tag-status-primary .tag-status__text    :515
10 .tag-status-proceed .tag-status__text    :516
11 .tag-status-success .tag-status__text    :517
12 .tag-status-warning .tag-status__text    :518
13 .badge-primary                           :624
14 .badge-success                           :629
15 .badge-warning                           :634
16 .badge-danger                            :639
17 .badge-gift                              :644
18 .badge-gift span                         :665
19 .badge-gift::after                       :679
20 .badge-gift-inactive                     :687
21 .badge-gift-primary                      :688
22 .badge-gift-proceed                      :689
23 .badge-gift-success                      :690
24 .badge-gift-warning                      :691
25 .notification                            :814
26 .notification-success                    :825
27 .notification-error                      :830
28 .notification-warning                    :835
29 #section_gift .point-badge__text         :1057
30 [data-theme="dark"] #section_gift .point-badge  :1063
31 .price-tag                               :1069
32 [data-theme="dark"] .price-tag           :1084
33 .badge__star                             :1551
34 .badge__text                             :1558
35 .badge__main                             :1559
36 .badge__sub                              :1560
37 .card--badge-space                       :1607
38 .gem-pulse                               :1615
39 .gem-pulse::after                        :1616
随删孤儿注释（仅注释）：:513 `/* tag-status 颜色变体… */` · :813 `/* 通知样式 */` · :1062 `/* 深夜模式下的三角徽章… */` · :1606 `/* 为包含徽章的卡片预留右上角空间… */`
```

**共享/连带处置说明（逐处）**：
- **无一处为「逗号组共享块」** —— 39 条全为单选择器规则 ⇒ 整块删，未发生「只删选择器保留整块」或「拆分」。
- **`@keyframes` 连带删 = 0**：本批各规则所引 `animation` 中，`@keyframes pulseGem`（`.gem-pulse::after` 引用）**被 S22 守卫 ⑥ 钉**（零偏移环计数含其 `0 0 0 10px`）⇒ **保留**；`.notification` 引用的 `slideIn` 本就**无对应关键帧**（悬空）；余无可连带关键帧。
- **`.badge-gift` 族** 删 8 条、**留** `.badge-gift::before`（pinned，`:653`）。副作用：该 pinned 规则引用的 `--badge-grad-start/end`（原由已删的 `.badge-gift-*` 定义）变未定义 ⇒ 仅该**死元素**（无 `.badge-gift`）的渐变失效，无视觉影响；**未触碰 pinned 规则本体**（护 S22 测试 ①-2）。

**revert 方式（任选其一）**：
1. **整文件回退（推荐，逐字节）**：
   ```
   git checkout HEAD -- frontend/src/styles.css        # 回 14feca1e（= S25/HEAD 态）
   # 或：cp <本单升级前的备份> frontend/src/styles.css
   ```
2. **按清单精确恢复**：以本报告 §4 的 39 条 `选择器:原行号` 为核对单，逐条从 `git show HEAD:frontend/src/styles.css` 取回规则块，插回原行号处；或
3. **本单 sha 级**：本单**未 commit**（无 sha）；如后续入库为 commit `<sha>`，则 `git revert <sha>`（或在 `git checkout <sha>^ -- frontend/src/styles.css`）。

**删除明细（机读）**：`.s30-artifacts/<runid>/05-deletion-manifest.json`（含 `sha256_before/after`、逐条原行号 + 删除字节数）；复现脚本 `.s30-artifacts/<runid>/apply-deletions.mjs`。

---

## §5 三件判据读数

### 判据 ①：受影响元素 = 0

**(1a) 静态双证**：
```
$ node scripts/s30-selector-inventory.mjs --check-deleted .s30-artifacts/<runid>/05-deletion-manifest.json
checkDeleted: checked=39  PASS=true  stillInCss=0  consumedNonZero=0
totals(全仓消费数)：codeTokens=1361  htmlTokens=131  svgUrlRefs=10        ← 与 s25 基线逐值相同
$ node scripts/s25-selector-inventory.mjs --json --out <runid>      # 原始脚本重跑
zeroConsumptionParts：278 → 239（−39，恰为本批删除分片数）
distinctZeroNames  ：131 → 102（−29）
bucketCounts：真残留 182→148（−34）; 不确定 14→9（−5）; HTML 32→32; 混合 28/22 不变
```
⇒ **删除集 100% 从「可删清单」消失（stillInCss=0）**，且**全仓四类面消费数仍逐值不变**（仍 = 0 命中）。

**(1b) 浏览器判据（可用；5 路由 × {日,夜} × 1280）**：
```
$ node .s30-artifacts/<runid>/browser-measure.mjs .s30-artifacts/<runid>/04-browser-measure.json
arms=10  deletedNames=33  all_zero=true  pageErrors=0
blocked_origins=[cdnjs.cloudflare.com, fonts.googleapis.com, cdn.jsdelivr.net, raw.githubusercontent.com]   ← 外部 CDN 一律 abort
```
- 手段（复用本仓先例 `scripts/p4z-b4cii-geometry.mjs`）：**无 dev server** —— `page.route('http://sf.local/**')` ↦ `frontend/dist` 磁盘文件；`chromium.launch({executablePath: Google Chrome})`。
- 5 路由 = `/ /login /task /listing /shard`；每路由 × {`light`,`dark`}（改 `<html data-theme>`）= 10 臂；对 33 个 distinct 被删类名逐一 `document.querySelectorAll('.<名>').length`。
- 读数：**10/10 臂全部 0**（`nonZero=[]`），`PASS=true`。

### 判据 ②：`npm run build` exit 0 + 产物 CSS 命中 = 0

```
$ npm run build   → exit 0（transforming 1797 modules；✓ built）
$ DISTCSS=$(ls -t dist/assets/*.css|head -1); grep -o '<名>' "$DISTCSS" | wc -l
card-hover=0  price-tag=0  badge-dot--gold=0  badge__star/text/main/sub=0  badge-danger=0
notification=0  notification-*=0  gem-pulse=0  tag-status=0  card--badge-space=0  point-badge__text=0
残留非零（**均系保留选择器的子串**，非被删选择器）：
  badge-gift=1   ← pinned .badge-gift::before（保留）
  badge-primary=1 badge-success=1 badge-warning=1  ← 保留的 .badge.badge-primary/success/warning 复合规则
```
⇒ 被删的**独立选择器**在产物 CSS 中命中 **= 0**；仅剩「被保留复合规则里的同名词根」如预期。

### 判据 ③：`npx vitest run` 失败集与基线逐条相同
```
$ # 干净基线（临时 git checkout 回改前；跑后即回改后）
$ git checkout -- frontend/src/styles.css  &&  npx vitest run   → 7 failed | 471 passed (478) | 4 files
$ cp 改后 styles.css 回位  &&  npx vitest run                    → 7 failed | 471 passed (478) | 4 files
```
**失败集逐条相同（现取，两跑并排）**：
```
FAIL src/test/accessibility/Accessibility.test.jsx [file]
FAIL src/test/e2e/basic.spec.js [file]
FAIL src/test/components/Card.test.jsx > renders Card with default props
FAIL src/test/components/Card.test.jsx > renders Card with different variants
FAIL src/test/components/Card.test.jsx > renders CardHeader
FAIL src/test/components/Card.test.jsx > renders CardTitle
FAIL src/test/components/Card.test.jsx > renders CardContent
FAIL src/test/components/Card.test.jsx > applies hover effect when enabled
FAIL src/test/performance/VirtualList.test.jsx > updates visible items on scroll
Test Files 4 failed | 50 passed (54)   Tests 7 failed | 471 passed (478)
```
（与 `docs/audit/s25-…md §4.5` 的基线失败集**同名/同数**；总数 478 与 S25 记录的 487 之差**与本单无关**、且改前改后**逐值一致**——见 §8 自曝。）

### 四脚本全 PASS（退出码管道外取）
```
$ node scripts/p4z-feperf-safelist.mjs   → VERDICT=PASS   exit 0
$ node scripts/p4z-i18nviol-global.mjs   → 总判：PASS（locale 裸命中 0 + 源面裸命中 0）   exit 0
$ node scripts/p4z-miscfix-links.mjs     → 总判：PASS（残留全部已登记）   exit 0
$ node scripts/p6-tr2-i18n-locales.mjs   → 总判：PASS   exit 0
```

---

## §6 判负（必做）

**方法（仓外副本）**：`mktemp -d` + `rsync` 复制 `frontend/`（排除 `node_modules`/`dist`/`.s*-artifacts`）到 `/private/tmp/s30-negctl.<X>/frontend`；副本内 `styles.css` 恢复为 **HEAD 原始 `14feca1e`**（使被删选择器仍在）；注入 `src/negctl-probe.jsx`：`<div className="card-hover">negctl</div>`。

```
(a) 基线（未注入）：   .card-hover#可删 | .card-hover:hover#可删
(b) 注入后：           两版脚本均报 card-hover 分片「已从零消费清单消失」（= 判为有消费 ⇒ 检测器不盲）
                       · s30-selector-inventory.mjs：card-hover 残余 shards = （空）
                       · s25-selector-inventory.mjs（原版）：同上 ⇒ 两版一致
(c) 复原（移走探针）： .card-hover#可删 | .card-hover:hover#可删   ⇒ 回绿
```
⇒ **红 → 绿**，证明盘点脚本确实按「类名上下文消费」判定，非恒绿。证据：`.s30-artifacts/<runid>/08-negctl.txt`。

---

## §7 未做与 NOT_MEASURED

- **NOT_MEASURED = 空**。判据 ①-浏览器项**已实测**（10 臂全 0，非 NOT_MEASURED）。
- **本单只删第 1 批 39 条**；「可删」清单尚余 **32 条**（§3①未加粗者，如 `.swedish-title`、`.btn-primary`(旧)、`.table*`、`.pagination*`、`.tag-price-*`、`.points-price`、`.junit`、`.tooltip*`、`.calendar-container`、`#open-chest`/`#reset-chest`、`.celebrate-burst`/`.burst-circle`、`.timeline*` 等）**留待后续批次**。
- **`card`/`badge` 族（78+10 分片）未删**：因 HTML 面命中（Zang 口径「命中者一律不得删」）；且 `card`/`badge` 亦牵动 S22 守卫（描边环 9）⇒ 后续若删须同步重估 S22 不变式。
- **`.cls-*`(52 分片) / `#chest*` / `.badge-dot` / `.gem-pulse` 关键帧 / `.btn-*:focus` 未删**：虽属「真残留」，但落 S22 守卫面（`url(#clip-path…)`=20 / 零偏移环=19 / 焦点环=8 / pinned 三选择器）——**后续批次需与 S22 守卫单一同改**（本单不动守卫）。
- **未改任何守卫测试**（`src/test/unit/s22-decor-cleanup.test.js` 逐字未动）。
- **未起任何本地服务**（5792–5799 未占）；浏览器量测走 `page.route`↦`dist`。

---

## §8 自曝

1. **并发他方改动（非本单）**：开工时 `git status --porcelain` 仅未跟踪产物；收工前现见 `M backend-ts/scripts/p8-s8-rating-timeliness-gate.ts`（mtime `2026-10-04T22:26:08`，**晚于**本单 `styles.css` 改动 `22:21:36`）。**本单未触碰 `backend-ts/**`**（全程命令仅涉 `frontend/**` 与 `docs/audit/`）⇒ 该 tracked 改动系**他方并发**，本单不认领、未回退。**同源并发**：`HEAD` 亦于本单执行期间由 `7ed025f` 前移至 `ef4ac17`（他方仅改 `docs/`），**未触碰 `styles.css`**（现取 `git show HEAD:frontend/src/styles.css` = `14feca1e…`，与本单基线同）⇒ 本单 delta 不受影响。
2. **「82 名 / 36 名」口径**：Zang 派单与 S25 §3.3 的 82/36 系**分片出现次数**；**distinct 名**为 2（`card`,`badge`）/16。本单按 distinct 逐名裁定，并已在 §1 显式澄清，避免误读。
3. **HTML 命中系巧合**：`admin.html` 实不引 `styles.css`（S22 已证）；`card`/`badge` 的「活跃」为名义巧合。本单**仍按 Zang 保守口径保留**（宁可少删）——若 Zang 改判「巧合不计」，则该族可进后续批次（但须同步重估 S22 守卫）。
4. **`.gem-pulse` 关键帧未连带删**：`.gem-pulse::after` 已删，但其 `@keyframes pulseGem` 因守卫 ⑥ 钉数而**保留**（该 KF 含 `0 0 0 10px` 计入零偏移环 19）⇒ 留下一个「无选择器引用但被测试钉住」的关键帧。**这是守卫与本单口径的真实张力**，特此登记（后续批次随 S22 守卫一并处理）。
5. **孤儿注释**：另删 4 条只服务被删规则的说明注释（§4）；`/* 卡片悬停效果增强 */` 等个别注释在本单范围内**未清理**（无功能影响，未扩面）。
6. **基线总数漂移**：`vitest` 总数 `487`（S25 记录）↔ `478`（本单现取）；**与本单改动无关**（改前/改后两次现取**逐值相同** = 478），且失败集逐条相同。差异来源未深究（疑环境/收集漂移），如实登记。
7. **`styles.css` 行尾**：原文件行尾为 LF；删除脚本按字节区间精确切除，未改行尾/编码；`git diff --numstat` = `0/118`（无伪装性「整文件重排」）。
8. **本单不 commit**：所有改动静置工作树（`frontend/src/styles.css` + 新增脚本/报告/产物），未 `commit`/`push`。
