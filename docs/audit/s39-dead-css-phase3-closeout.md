# S39 · 台账 B17 阶段三（死 CSS 收尾）—— 报告

- **仓库**：`/Users/kevin/bistro/seafood`　**角色**：Kong（实现方）　**执行**：2026-10-05（CST）　**runid**：`s39-20261005T053352Z`
- **上游**：Zang 派单（`docs/seafood.master-plan.md` §5.359 / 台账 B17 阶段三）+ **Zang 两条定档**（守卫面 96 分片保留 / `admin.html` 保留）。输入 = `docs/audit/s30-dead-css-phase1.md` §3 · `docs/audit/s33-dead-css-phase2.md` §2/§5 · `frontend/.s33-artifacts/s33-20261005T004849Z/12-deletion-manifest-combined.json`（阶段一 43 + 阶段二 118）。
- **交付**：① 改后 `frontend/src/styles.css`（唯一产品改动面）；② 本报告；③ `frontend/.s39-artifacts/s39-20261005T053352Z/`；④ 新增只读/复核脚本 `frontend/scripts/s39-apply-deletions.mjs`（`--dry` 可预演）、`frontend/scripts/s39-guard-readings.mjs`（守卫面现取）。
- **硬口径遵守**：**只改** `frontend/src/styles.css` + 新增 `frontend/scripts/s39-*.mjs`（只读/复核）+ 本报告 + `.s39-artifacts/**` ✓；**未改** `frontend/admin.html`、`frontend/src/test/**`、`frontend/src/**` 其它产品文件、`backend-ts/**`（并发单 S38 面）、`migrations/**`、`docs/*.spec.md`、`docs/OPEN-ITEMS.md`、`docs/seafood.master-plan.md` ✓；**未 commit / 未 push** ✓；**未 `npm install`** ✓；**未碰 `.env*`** ✓；**未启停 5787/5788、未起任何本地服务（浏览器量测走 `page.route`↦`dist`，零服务）** ✓；**禁 `pkill -f` / `killall`（未使用）** ✓；产物原始输出**一律 `.txt`/`.json`（现取 `.log` = 0）** ✓；**不确定的一律不删** ✓。

---

## §0 对锚与范围

```
$ git log --oneline -3
99470f0 docs: §5.359/v0.359 —— ★我下 B17 两条定档（守卫面 96 分片保留 …；admin.html 保留 …）+ 派 S39 …
77f5b61 docs: §5.358/v0.358 —— S37 核盘 … + 派 S38 残差定性
a037737 fix(scripts): S37/B18 —— 夹具显式号段上移到序列不可达带 9e8 …

$ git branch --show-current → main
$ git status --porcelain（开工，tracked 面）→ 无任何 tracked 改动（仅既有未跟踪历史产物）
```

> **并发对锚（非本单）**：开工时 `HEAD=77f5b61`；随后前移至 `99470f0`（= Zang 的**派单提交**，只动 `docs/`，**未触碰 `styles.css`**）；`git show HEAD:frontend/src/styles.css` 现取仍 = `0c6ee8c3…`（= 本单改前基线）⇒ 本单 delta 干净。**并发单 S38** 只动 `backend-ts/scripts/**`，与本单 `frontend/**` 两面不相交；本单全程**未写 `backend-ts/**`**（收工现取 `git status` 里 backend-ts 项全为未跟踪历史产物）。

**`styles.css` 四代 sha 链（现取）**：

| 态 | sha256 | 行数(`wc -l`) |
|---|---|---|
| S25 基线 | `14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959` | 1642 |
| 阶段一后 | `e2b97ee05c5b7a04667f9bd66e5426214976a98e0013ec31e636bfb580421dc6` | 1523 |
| 阶段二后（= 本单改前） | `0c6ee8c34190eb8442e27d1971be2dd2ea566c6dc40546079f1b1a79509afd13` | 1060 |
| **阶段三后（本单产出）** | **`bfccb4e055a36f2fa6c31a9bd855ef9ab2519b58bc76ade5ecfeb3c4b6d647c4`** | **1050** |

```
$ shasum -a 256 frontend/src/styles.css
bfccb4e055a36f2fa6c31a9bd855ef9ab2519b58bc76ade5ecfeb3c4b6d647c4  frontend/src/styles.css
$ git diff --numstat -- frontend/src/styles.css
0	10	frontend/src/styles.css        ← 0 新增 / 10 删除（AC6：删除 >> 新增；色板与布局未动）
$ git status --porcelain | grep -v '^??'  →  M frontend/src/styles.css（仅此一项）
```

**范围（读）**：`scripts/s33-selector-inventory.mjs`（阶段二盘点原件，未改）· `scripts/s33-*.mjs`（浏览器臂/独立复核/负控辅助，未改）· `s33-20261005T004849Z/12-deletion-manifest-combined.json`。
**范围（写）**：`frontend/src/styles.css` + 新增 `scripts/s39-apply-deletions.mjs` · `scripts/s39-guard-readings.mjs` + 本报告 + `.s39-artifacts/**`。

---

## §1 两条定档的执行与登记

### 1.1 定档 ①：守卫面（96 分片）= 保留 —— **已执行，逐条复核为「前后 IDENTICAL」**

**理由（Zang）**：守卫面是 `frontend/src/test/unit/s22-decor-cleanup.test.js` 名下的**常驻不变式**（`url(#clip-path)` 20 / 焦点环 8 / 零偏移环 19）；删它 = 先拆不变式。

**执行**：本单**未删任何守卫面分片**、**未改 `s22-decor-cleanup.test.js`**（逐字未动，现取 `git status` 无该文件）。

**现取复核（`--check-deleted` 脚本同源的三态盘点 + 独立守卫读数）**：

| 读数 | 改前（`10-inventory-pre.json`） | 改后（`20-inventory-post.json`） | 判定 |
|---|---|---|---|
| `保留-守卫` 分片数 | **96** | **96** | 不变 ✓ |
| 守卫分片**集合**（逐条 selector） | — | — | **IDENTICAL** ✓（`16-guard-face-diff.txt`） |
| `保留-有消费` 分片数 / 集合 | 3 / {`#section_gift .card p.text-text-secondary`, `[dark] .card .text-text-secondary`, `[dark] .card .text-text-muted`} | 3 / 同上 | 不变 ✓ |
| `url(#clip-path…)` | **20** | **20** | 不变 ✓ |
| 焦点环规则 `:focus{box-shadow:0 0 0 Npx}` | **8** | **8** | 不变 ✓ |
| 零偏移环 `0 0 0 Npx` | **19** | **19** | 不变 ✓ |
| pinned 三选择器（`.badge-gift::before` / `#section_gift .point-badge` / `.badge::after`）在场且含 `-webkit-clip-path:none;clip-path:none` | 3/3 在场，均含 ✓ | 3/3 在场，均含 ✓ | 不变 ✓ |
| `clip-path: polygon(…)` 装饰性切角 | 0 | 0 | 不变 ✓ |
| `@keyframes` 数 | 11（含 `pulseGem`） | **10**（`pulseGem` 仍在；−1 = 孤儿 `glintSweep`，见 §3） | 见 §3 |

> 守卫面 **含 `@keyframes pulseGem`**（零偏移环计数含其 `0 0 0 10px`）——本单**未触碰**；被删的 `glintSweep` **不在**守卫面（其 body 无 `0 0 0 Npx`、无 `url(#clip-path…)`、非 pinned、非 `#chest` 块）⇒ 删它**不动**守卫读数（上表 19 前后同值即证）。

### 1.2 定档 ②：`frontend/admin.html` = 保留 —— **已执行，未删未改，归因登记**

**理由（Zang）**：未被服务 + 产品链零引用，但删它只会**作废历史证据链里的路径引用**（阶段一/二报告与盘点脚本的 `htmlFiles` 硬编码均引其名）。

**现取事实（`15-independent-consumption.txt`）**：

```
$ grep -c 'styles\.css' frontend/admin.html
0                       ← 它不引 styles.css（其 card/badge 由自身内联 <style> 定义）
$ grep -rn 'admin\.html' src index.html vite.config.js vite.config.ts public package.json
（空）                  ← 产品链零引用
$ grep -rn 'admin\.html' scripts/*.mjs
scripts/s25-selector-inventory.mjs:20,157 · scripts/s30-selector-inventory.mjs:37,116 · …
（17 处，全部在「盘点脚本自身硬编码」内 —— 即 Zang 所指的「历史证据链路径引用」）
$ ls frontend/dist/*.html
frontend/dist/index.html   ← 构建产物不含 admin.html ⇒ 未被服务
```

**登记**：`admin.html` **未删、未改**（本单硬口径亦禁改）。**归因**：删它零产品收益、却作废 s25/s30 报告与脚本里的路径引用（且仓外运维书签/脚本依赖不可证）⇒ 按 Zang 定档**保留**，建议另开独立台账条目处理（阶段二 §1.3 已同向登记）。
**副作用核查**：本单删除发生在 `frontend/src/styles.css`；`admin.html` **不引**该文件 ⇒ **零影响**（其 `class="badge get"` 语义由自身内联样式满足）。

---

## §2 可删现取与删除逐条 + revert

### 2.1 现取复核（`frontend/scripts/s33-selector-inventory.mjs`，阶段二裁定视图）

```
$ node scripts/s33-selector-inventory.mjs
  [S30 选择器盘点·升级版] 作用域 = src/styles.css（只读）
    规则前导=225 选择器分片=203 distinct class=66 distinct id=11
    消费面：code=91 html=1 code整词=1361 html整词=2 url(#id)=10
    ★ 零 JSX 消费分片=100（distinct 名=49）
    三态：保留-守卫=96 ; 保留-有消费=3 ; 可删=1

    ── 可删（四类面全证零；逐条）──
    L1022 [data-theme="dark"] .badge::after
```

⇒ **「只剩 1 条、且就是 `[dark] .badge::after`」成立**（派单条件满足，**无需停下报回**）。

### 2.2 删除条件逐条（**四类消费面全证零**）

被删选择器 `[data-theme="dark"] .badge::after` 的**类名 token = `badge`**（`data-theme` 为属性名，非类/ID）。逐面现取：

| 消费面 | 探针 / 命令 | 读数 |
|---|---|---|
| ① JSX/code token 面 | `s33-selector-inventory` `codeTokens` + 独立复核 `s33-independent-consumption-check.mjs badge glintSweep` → `consumedHits=0 · ALL_ZERO` + 人工 `grep -rnoE '(className\|class\|id)\s*=\s*["\x27`][^"\x27`]*\bbadge\b…' src --include=*.jsx --include=*.js \| grep -v ^src/test/` | **0** |
| ② HTML 面 | `grep -coE '(class\|id)=["\x27][^"\x27]*\bbadge\b' index.html`（`admin.html` 按 Zang §1.2 定档不计入服务面 + 它不引 styles.css） | **0** |
| ③ SVG `url(#…)` 面 | `grep -o 'url(#badge[^)]*)' src/styles.css \| wc -l`（`svgUrlRefs` = 10 个 `clip-path*`，无 `badge`） | **0** |
| ④ 动态拼接面 | `grep -rnoE '(className\|class)\s*=\s*["\x27`][^"\x27`]*\$\{[^}]*\}[^"\x27`]*["\x27`]' src --include=*.jsx \| grep -i badge`（`DISAMBIG` 裁定 + `isDyn('badge')=false`） | **0** |

**静态双证（`--check-deleted`）**：

```
$ node scripts/s33-selector-inventory.mjs --json --check-deleted .s39-artifacts/<runid>/12-check-manifest.json
checkDeleted: checked=2  PASS=true  stillInCss=0  consumedNonZero=0
totals: codeTokens=1361  htmlTokens=2  svgUrlRefs=10          ← 与 S25/S30/S33 基线逐值相同
```

**风险登记（如实）**：该条是 pinned `.badge::after`（守卫面，**保留**）的**夜间覆盖**规则（只改 `background`，不含 clip-path）。删它 ⇒ 夜间下「已无 `.badge` 元素」的该伪元素背景不再被覆盖 —— 因 JSX/HTML/SVG 四面对 `badge` **全零消费**（无 `.badge` 元素存在），**视觉影响 = 0**，并以判据① 浏览器 10 臂独立证之（§4）。阶段二曾「宁可少删」保留它；本单按 Zang 派单**条件成立即删**。

### 2.3 删除逐条（`选择器 : 原行号`；原行号 = 改前 `0c6ee8c3` 的行号）

| # | 原行号 | 选择器 / 块 | kind | 删字节 |
|---|---|---|---|---|
| 1 | 1022 | `[data-theme="dark"] .badge::after { background: var(--bg-secondary); }` | rule | 74 |
| 2 | 526 | `@keyframes glintSweep { … }`（孤儿，见 §3） | keyframes | 178 |

**合计**：删 **2 个块**、**252 字节**、**10 行**；文件 **1060 → 1050** 行；`git diff --numstat` = **`0/10`**（新增长 0 行 ⇒ 无「整文件重排」式伪装）。

**apply 方式（可复现）**：
```
$ node scripts/s39-apply-deletions.mjs .s39-artifacts/<runid>/12-deletion-manifest-phase3.json --dry   # 预演
$ node scripts/s39-apply-deletions.mjs .s39-artifacts/<runid>/12-deletion-manifest-phase3.json         # 落盘
```
脚本对每个块断言「exact-substring 命中次数 = 1」（命中 ≠1 即 ABORT、不写盘），并校验 `baseStylesSha256` 与盘上一致 ⇒ **不误删、不静默失效**。

### 2.4 阶段三 revert 清单（**新文件，未覆盖阶段一/二件**）

- `12-deletion-manifest-phase3.json`：含**逐条精确文本块**（`block` 字段，逐字节可逆）+ 原行号 + 删字节 + 理由。
- `12-deletion-manifest-combined3.json`：**新件** = 阶段一（43）+ 阶段二（118）+ 阶段三（2）**联合 revert 清单**；`chain` = `14feca1e…`（S25 基线）→ `e2b97ee0…`（阶段一）→ `0c6ee8c3…`（阶段二）→ **`bfccb4e0…`（阶段三）**。阶段一/二原件的文件名与内容**均未触碰**（`05-deletion-manifest.json` / `12-deletion-manifest-phase2.json` / `12-deletion-manifest-combined.json` 逐字未动）。

**revert 三法（任选）**：
1. **整文件回退（推荐，逐字节）**：
   ```
   git checkout HEAD -- frontend/src/styles.css        # 回 0c6ee8c3（= 阶段二态 / HEAD 态）
   # 或：cp frontend/.s39-artifacts/s39-20261005T053352Z/13-styles-before.css frontend/src/styles.css
   ```
2. **按清单精确恢复**：以 `12-deletion-manifest-phase3.json` 的 `items[].block` 为核对单，插回原行号处（1→L1022、2→L526）。
3. **联合回退**：以 `12-deletion-manifest-combined3.json` 逐代回退到 `14feca1e`（S25 基线）。
   本单**未 commit**（无 sha）。

---

## §3 孤儿 `@keyframes glintSweep` 判定 —— **零引用 ⇒ 删**

**引用面探针（全仓 `.css/.js/.jsx/.html`，排除 `node_modules`/`dist`/`.git`/`.s*-artifacts`）**：
```
$ grep -rn 'glintSweep' --include=*.css --include=*.js --include=*.jsx --include=*.html --include=*.ts --include=*.tsx . \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=.s33-artifacts
./src/styles.css:163:   … ::after 的 glintSweep 扫光同属光泽，一并删除。 */   ← 注释（非引用）
./src/styles.css:526:@keyframes glintSweep {                                ← 定义本体
./src/test/unit/p6-btn-impl.test.js:197:  expect(stylesCss).not.toMatch(/glintSweep \.8s/)   ← 负向断言（非引用）
```
- **`animation` / `animation-name` 引用 = 0**：`grep -n 'Sweep' src/styles.css` 仅 L163/L526（注释 + 定义）；全仓无 `animation: … glintSweep …`、无 `animation-name: glintSweep`。
- **来源**：P6-BTN-IMPL 删 `.btn::after`（悬停扫光）后遗留的孤儿关键帧（阶段二 §5 已登记为「既有孤儿，非本批连带」）。

**判定**：**零 `animation` 引用 ⇒ 删**。已删（§2.3 #2）。

**与既有测试的关系（现取复核，未破测试）**：
- `p6-btn-impl.test.js:197` 是 `not.toMatch(/glintSweep \.8s/)`（断言「扫光动画用法不存在」）——**不是引用**；删除关键帧定义后该断言**仍绿**（定义处文本为 `@keyframes glintSweep {`，不含 `glintSweep .8s`）。
- `s22-decor-cleanup.test.js` 只钉 `@keyframes pulseGem` 的零偏移环（`0 0 0 10px`）与 `url(#clip-path…)`；`glintSweep` body 无 `0 0 0 Npx` ⇒ 删除后零偏移环**仍 = 19**（§4 现取）。
- 全仓测试**无任何** `keyframes` 计数断言（`grep -rn 'keyframes' src/test/` → 空）⇒ 无键帧数不变式被破。

**残留登记**：`src/styles.css:163` 的**注释**仍提及 `glintSweep`（历史沿革说明），本单**按「不扩大」口径未删注释**（与阶段一 §8-5 / 阶段二 §5 同口径）；零运行期影响。

---

## §4 三件判据读数

### 判据 ①：受影响元素 = 0（静态 + 真浏览器）

**(1a) 静态 —— `--check-deleted`（§2.2）**：`checked=2 PASS=true stillInCss=0 consumedNonZero=0`；四类消费面逐面 **= 0**（§2.2 表）。
**(1a′) 独立复核（与盘点脚本不共用代码）**：`node scripts/s33-independent-consumption-check.mjs badge glintSweep` → `{"files":91,"distinctCtxTokens":1355,"checkedNames":2,"consumedHits":0,"verdict":"ALL_ZERO"} exit 0`。
**(1b) 真浏览器 10 臂（5 路由 × {日,夜} × 1280；对外部 CDN abort；不起服务）**：
```
$ node scripts/s33-browser-measure.mjs 12-check-manifest.json 30-browser-measure.json
arms=10  deletedNames=1  deletedSelectors=1  armsWithHits=0  all_zero=true
pageErrors=0  selErrors=0
blocked_origins=[cdnjs.cloudflare.com, fonts.googleapis.com, cdn.jsdelivr.net, raw.githubusercontent.com]
```
- 手段同阶段一/二：**无 dev server** —— `page.route('http://sf.local/**')` ↦ `frontend/dist`；`chromium.launch({executablePath: Google Chrome})`（浏览器 154.0.8037.93）；5 路由 = `/ /login /task /listing /shard`，每路由 × {`light`,`dark`}（改 `<html data-theme>`）。
- **逐臂三形态 + 整页 DOM 全扫**：`.<名>` · `.<名> *` · `* > .<名>` + `querySelectorAll(完整选择器)` + **整页 DOM class/id 全量扫描 ∩ 被删名集**。读数：**10/10 臂全 0**（`arms` 数组逐臂 `nameHits/comboHits/selHits/domClassHits/domIdHits` 全空，`allZero=true`），**选择器语法错误 = 0**。

### 判据 ②：`npm run build` exit 0 + 产物 CSS 里被删独立选择器命中 = 0

```
$ npm run build   → exit 0（✓ built in 1.72s）；dist/assets/index-DtbU2dHh.css
$ grep -o 'data-theme=dark\] \.badge:after' "$DISTCSS" | wc -l   → 0
$ grep -o '@keyframes glintSweep'            "$DISTCSS" | wc -l   → 0
$ grep -o '\.badge:after'                    "$DISTCSS" | wc -l   → 1     ← pinned 守卫规则（保留），非被删项
   残留上下文：…box-shadow:0 0 0 1px #3b82f666!important}.badge:after{content:"";background:var(--bg-primary)…
$ node scripts/s33-distcss-diff.mjs 27-dist-before.css 28-dist-after.css
{"selectorsBefore":966,"selectorsAfter":964,"removed":["20%","[data-theme=dark] .badge:after"],"added":[],"PASS":true}
```
- **`added = 0`** ⇒ 产物未新增任何选择器。
- `removed` 逐条可归因：`[data-theme=dark] .badge:after` = §2.3 #1；`"20%"` = §2.3 #2 被删 `glintSweep` 的**关键帧步选择器**（全仓仅该关键帧含 `20%` 步）⇒ **无一条无主**。
- ⇒ **被删的独立选择器/关键帧在产物 CSS 命中 = 0**；唯一同名残留 `.badge:after` 是**保留的守卫规则**（pinned）。

### 判据 ③：`npx vitest run` 失败集与基线**逐条相同** + `s22` **仍 9/9** + 四脚本全 PASS

```
$ npx vitest run   （改前基线）→ exit 1 | Test Files 4 failed | 50 passed (54) | Tests 7 failed | 471 passed (478)
$ npx vitest run   （改后）    → exit 1 | Test Files 4 failed | 50 passed (54) | Tests 7 failed | 471 passed (478)
$ diff <(基线失败集) <(改后失败集) → IDENTICAL ✓   （9 行 FAIL 逐条同：Accessibility.test.jsx[file]、basic.spec.js[file]、
     Card.test.jsx ×6、VirtualList.test.jsx ×1）
$ npx vitest run src/test/unit/s22-decor-cleanup.test.js → exit 0 | Test Files 1 passed (1) | Tests 9 passed (9)
$ node scripts/p4z-feperf-safelist.mjs  → VERDICT=PASS   exit 0
$ node scripts/p4z-i18nviol-global.mjs  → 总判：PASS（locale 裸命中 0 + 源面裸命中 0）   exit 0
$ node scripts/p4z-miscfix-links.mjs    → 总判：PASS（残留全部已登记）   exit 0
$ node scripts/p6-tr2-i18n-locales.mjs  → 总判：PASS   exit 0
```
**S22 守卫面现取（改前 / 改后并排）**：`url(#clip-path…)` 20/20 · 焦点环 8/8 · 零偏移环 19/19 · pinned 三选择器 3/3 均在且含 `-webkit-clip-path:none;clip-path:none` · `polygon()` 0/0 ⇒ **前后不变**（§1.1 表 + `11-guard-pre.json` / `22-guard-post.json`）。

---

## §5 判负（必做）—— 红 → 绿

**方法（仓外副本）**：`rsync -a --exclude node_modules --exclude dist --exclude '.s*-artifacts' frontend/ → …/scratch/s39-negctl/frontend/`；副本内 `styles.css` 恢复为**改前 `0c6ee8c3`**（使被删选择器仍在）；注入 `src/negctl-probe.jsx`：`<div className="badge">negctl</div>`（`badge` = 本单被删名）。

| 阶段 | 三态（副本） | 被删选择器判定 |
|---|---|---|
| (a) 基线（未注入） | 守卫 **96** / 有消费 3 / 可删 **1** | `[data-theme="dark"] .badge::after` **在「可删」** |
| (b) 注入 `className="badge"` | 守卫 **95** / 有消费 3 / 可删 **0** | 该选择器**从零消费清单消失（= 判为有消费）**；pinned `.badge::after` 同步退出零消费清单（96→95） |
| (c) 复原（移走探针） | 守卫 **96** / 有消费 3 / 可删 **1** | 与 (a) **逐字节 IDENTICAL** ⇒ **回绿** |

```
$ diff /tmp/s39-nc-a.json /tmp/s39-nc-c.json   → （空）IDENTICAL ✓
```
⇒ **红 → 绿**：证明盘点脚本确实按「类名上下文消费」判定，**非恒绿**。证据：`34-negctl.txt`。

---

## §6 未做与 NOT_MEASURED

- **NOT_MEASURED = 空**。判据① 的**浏览器项已实测**（10 臂 + 三形态 + 整页 DOM 全扫，全 0），非 NOT_MEASURED；判据② 产物命中、判据③ 失败集比对、判负均**实测**。
- **守卫面 96 分片未删未改**（定档①，§1.1 现取前后 IDENTICAL）；`s22-decor-cleanup.test.js` **逐字未动**。
- **`admin.html` 未删未改**（定档②，§1.2 登记保留 + 归因）。
- **本单只删 2 个块**（1 条可删选择器 + 1 个孤儿关键帧）；三态里剩余的 **96 守卫 + 3 有消费** 属「与 S22 守卫单一同处理」或「另一类名实消费」，**不在本单范围**，未动。
- **注释未清理**：`src/styles.css:163`（提及 `glintSweep`）等历史说明注释保留（不扩大口径）；零运行期影响。
- **未改任何测试**；**未起任何本地服务**（未占 5792–5799）；**未 commit / 未 push**。

---

## §7 自曝

1. **并发对锚（非本单）**：开工 `HEAD=77f5b61` → 随后为 `99470f0`（Zang 派单提交，只动 `docs/`，**未触碰 `styles.css`**）⇒ 本单基线 `0c6ee8c3` 不受影响。**并发单 S38**（只动 `backend-ts/scripts/**`）：本单全程**未写 `backend-ts/**`**，收工 `git status` 里 backend-ts 项全为未跟踪历史产物；本单**不认领、未回退**他方改动。
2. **删除面比阶段二窄得多（2 块 / 252 字节）**：阶段二删 118 块（14,737 字节）；本单只剩 1 条可删 + 1 个孤儿键帧，**符合派单预期**（阶段三是收尾）。**未强行交作业**：两件删除均先证条件（唯一可删 + 四类面全零 / animation 零引用）再删。
3. **`[dark] .badge::after` 的风险面如实登记**：它是**守卫面 pinned `.badge::after` 的夜间覆盖**。删它属「非守卫分片」但**语义上贴着守卫元素**；本单依据 = Zang 派单条件成立即删 + 四类面全零 + 浏览器 10 臂全 0（无 `.badge` 元素存在 ⇒ 视觉 0）。**若 Zang 认为「贴守卫即可不删」**，revert 只需插回 `12-deletion-manifest-phase3.json` 的 items[0].block 至 L1022（单块，零连带）。
4. **产物 CSS diff 的 `"20%"` 项**：非无主项，系被删 `glintSweep` 的**关键帧步选择器**（全仓仅该键帧含 `20%` 步）；已逐条归因，`added=0`。
5. **`glintSweep` 的「提及 ≠ 引用」**：`p6-btn-impl.test.js:197` 的 `not.toMatch(/glintSweep \.8s/)` 是**负向断言**（钉「扫光用法已不存在」），不是 animation 引用；删键帧定义后该断言仍绿（§3）。这是本单唯一需要「同名不同义」裁决的点。
6. **`s30` 原件含 `admin.html`、`s33` 变体排除之**：本单沿用**阶段二裁定视图（`s33-selector-inventory.mjs`）**（与派单口径一致）；两视图差异只影响 `card`/`badge` 的 HTML 面归属，本单被删项在两视图下**均为「可删」**（`badge` 非 `card`/`badge` 复合，且已按定档②不计 admin.html）—— **未改任何盘点脚本原件**。
7. **产物命名**：原始输出无 `.log` 后缀（`find .s39-artifacts -name '*.log' | wc -l` → **0**）。
8. **`styles.css` 行尾/编码**：原为 LF；删除脚本按**精确整块**切除（非正则/非整文件重排），未改行尾/编码；`git diff --numstat` = `0/10`。
9. **本单不 commit**：所有改动静置工作树（`frontend/src/styles.css` + 新增 2 脚本 + 本报告 + `.s39-artifacts/**`），未 `commit`/`push`。

---

### 附 A：本单新增脚本（均只读/复核，不改产品）
`scripts/s39-apply-deletions.mjs`（精确整块删除，`--dry` 预演，断言命中=1 且校验基线 sha）· `scripts/s39-guard-readings.mjs`（S22 守卫面现取读数）。**s25/s30/s33 脚本原件逐字未动。**

### 附 B：`.s39-artifacts/s39-20261005T053352Z/` 产物
`00-git-anchor.txt` · `01-styles-before.sha256` · `10-inventory-pre.json`/`.txt` · `11-guard-pre.json` · `12-apply-dry.json`/`12-apply-real.json` · `12-check-manifest.json` · `12-deletion-manifest-phase3.json` · `12-deletion-manifest-combined3.json` · `13-styles-before.css`/`13-styles-after.css` · `14-post-greps.txt` · `15-independent-consumption.txt` · `16-guard-face-diff.txt` · `20-inventory-post.json`/`.txt` · `21-check-deleted-post.json` · `22-guard-post.json` · `23-build.txt` · `24-p4z-feperf-safelist.txt`/`24-p4z-i18nviol-global.txt`/`24-p4z-miscfix-links.txt`/`24-p6-tr2-i18n-locales.txt` · `25-distcss-check.txt` · `26-build-before.txt` · `27-dist-before.css` · `28-dist-after.css` · `29-distcss-diff.json` · `30-browser-measure.json`/`30-browser-measure-stdout.txt` · `31-vitest-baseline.txt`/`31-vitest-baseline-failset.txt` · `32-vitest-after.txt`/`32-vitest-after-failset.txt` · `33-s22-test.txt` · `34-negctl.txt`
