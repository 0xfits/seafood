# S22 · 装饰性切角与 legacy 硬位移阴影收尾（A4）—— 补落单报告

- **仓库**：`/Users/kevin/bistro/seafood`　**角色**：Kong（实现方）　**执行**：2026-10-04（CST）
- **单号**：S22（**纯补落单**）。代码已入库 `88341b8`（本次**逐字未动**）；本单**只新增**报告 `docs/audit/s22-decor-cleanup.md` 与 run-tagged 产物目录 `frontend/.s22-artifacts/s22-20261004T124258Z/`。
- **口径真源**：台账 `docs/OPEN-ITEMS.md` A4（**在 `88341b8` 时为 §A 行 15**；S24 收口后移至 §D 行 43「已闭环」）· 册 `docs/seafood.master-plan.md` §5.339（行 1448 A4 行）/ §5.340（行 1419–1422 S22 回执与裁盘）。
- **硬口径遵守**：未改 `frontend/src/styles.css` / 未改测试 / 未改 `backend-ts/**` / 未改 `docs/*.spec.md` / `docs/seafood.master-plan.md` / `docs/OPEN-ITEMS.md`（**只新增报告与产物**）✓ · 未 `commit` / 未 `push` ✓ · 未 `npm install` ✓ · 未碰 `.env*` ✓ · 未启停 `5787/5788`、未起任何实例（未占 `5792–5799`）✓ · 禁 `pkill -f` / `killall`（未使用）✓ · 产物原始输出**一律 `.txt`（无 `.log`）** ✓。
- **并发自曝**：会话开工时 `git status --porcelain`（tracked）干净；仅大量历史未跟踪 `backend-ts/.p*-artifacts/**` 等（他方历史产物，本单未碰）。本单未触碰任何已入库文件。

---

## §0 对锚与范围

```
$ git log --oneline -3
51a5d6c docs: S24 —— A1/A2/A3 三项定值落册（data-layer v0.30→v0.31 …）+ 补建 ledger.spec v0.13 快照 … + 报告
b0b244a feat(jobs): S23 —— B4「已参与 X / 共 N 人」…
88341b8 refactor(ui): S22 装饰性切角与 legacy 硬位移阴影收尾（…）+ 测试（含判负）

$ git rev-parse HEAD → 51a5d6ca29ffd72486a34a8421771f1d10715822   （= 派单给定锚 51a5d6c ✓）
$ git status --porcelain（开工）→ 无 tracked 改动（仅 backend-ts/.p*-artifacts/** 等未跟踪历史产物）
```

**对锚结论**：开工 `HEAD = 51a5d6c` ✓；工作树 tracked 干净 ✓。

**本单范围（读）**：`88341b8` 的代码面 = `frontend/src/styles.css`（`25/49`）+ 新增 `frontend/src/test/unit/s22-decor-cleanup.test.js`（`92/0`）。本单**只做观测与取证**，不改这两件。

**sha256 现取对锚**（详见 `09-parent-vs-new-counts.txt`）：

| 对象 | sha256 |
|---|---|
| 改前 `88341b8^:frontend/src/styles.css`（含装饰切角） | `c89a699e4f5c1cf6dad3776c2408f70db9a8625b5211083dceb322ee3d30a9c6` |
| 改后 `88341b8:frontend/src/styles.css` | `14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959` |
| HEAD `51a5d6c` 工作区 `frontend/src/styles.css`（现取） | `14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959`（**与改后逐字节同**） |
| `s22-decor-cleanup.test.js`（现取） | `d529b679cf31c66be74dfd61902268a3711ad439a3e83ef38c8e6304f518a191` |

> 派单给定「改前 `c89a699e…` ⇒ 改后 `14feca1e…`」与我现取**逐字一致**。

---

## §1 全量现取四分类清单

现取命令脚本：`frontend/.s22-artifacts/<runid>/01-counts-polygon-url-rings.txt`（`grep`）、`02-shadow-layers.txt`（`node 02-shadow-parse.mjs`，纯文本解析，规则与测试同源）、`09-parent-vs-new-counts.txt`（`88341b8^` vs `88341b8` vs `HEAD` 三态对照）。**口径**：所有计数贴 `styles.css` 文本（不加载浏览器），先剥注释。

### 分类总表（三态对照）

| # | 分类 | `88341b8^`（改前） | `88341b8`（改后） | `HEAD 51a5d6c`（现取） | 本单处置 |
|---|---|---|---|---|---|
| ① | **装饰性 `clip-path: polygon(...)`** | **4**（3 选择器） | **0** | **0** | ✅ 本单射程（已清） |
| ② | `clip-path: url(#clip-path…)`（SVG 内部图形定义） | **20** | **20** | **20** | **禁动** —— 逐数不变 ✓ |
| ③ | 焦点环 `:focus { box-shadow: 0 0 0 Npx … }`（可达性面） | **8** | **8** | **8** | **禁动** —— 逐数不变 ✓ |
| ④ | 非 `inset` 且 x/y≠0 的 box-shadow **位移影层** | **18**（16 声明处） | **0** | **0** | ✅ 本单射程（已清） |
| — | `inset` 内高光层（硬高光族，随位移层一并去） | **12** | **0** | **0** | ✅ 本单射程（已清） |
| — | box-shadow **声明块**总数 | **38** | **38** | **38** | （一一原位替换，块数不变） |
| — | box-shadow **层**总数 | **67** | **38** | **38** | （`-29`：`-18` 位移 · `-12` inset · `-6` 零偏移非环 · `+7` none 占位；分账见 §6.4） |
| — | 零偏移环 `0 0 0 Npx` 命中 | **19** | **19** | **19** | 保留，逐数不变 ✓ |
| — | `clip-path: none` 命中 | **4** | **10** | **10** | （+6：三处去切角成对写法） |

**① 装饰性切角 4 处明细**（`clip-path: polygon(...)`，跨 3 选择器）：

| 选择器（新行） | 改前 polygon 命中 | 现取 |
|---|---|---|
| `.badge-gift::before`（行 653） | 2（`-webkit-` + 标准，双写） | 0 |
| `#section_gift .point-badge`（行 1037） | 1 | 0 |
| `.badge::after`（行 1568） | 1 | 0 |
| **合计** | **4** | **0** |

**② SVG 内部 `url(#clip-path…)` 20 处**：两段嵌入式 SVG（`cls-7 … cls-16` × 2），逐数 `88341b8^ = 88341b8 = HEAD = 20`，**本单未碰**（测试例②即钉此数）。

**③ 焦点环 8 规则 / 零偏移环 19 命中**：`:focus { box-shadow: 0 0 0 2px … }` 类规则 **8** 条（`.btn-*` 系）；零偏移环出现 **19** 次（= 焦点环 8 + 描边环 9 + `.badge-dot` 1 + `.gem-pulse` 1）—— **本单未碰，逐数不变**。

**④ 其它逐条判 —— 18 位移影层（16 声明处）改前逐层明细**：

```
0 8px 16px rgba(0,0,0,0.1)          0 10px 32px rgba(0,0,0,0.14)     0 3px 10px rgba(0,0,0,0.08)
0 14px 40px rgba(0,0,0,0.18)        0 6px 16px rgba(0,0,0,0.10)      0 4px 6px rgba(0,0,0,0.1)
0 8px 24px rgba(0,0,0,0.08)!imp     0 10px 26px rgba(0,0,0,0.10)     0 8px 24px rgba(0,0,0,0.08)!imp
0 10px 30px rgba(0,0,0,0.55) ×5     0 14px 36px rgba(0,0,0,0.65) ×4
```
（`19` 处零偏移 `0 0 0 Npx` 环**不在**位移层口径内，未计入、未删。）

**其它逐条判（非本单射程，如实登记）**：
- `-webkit-clip-path: none` / `clip-path: none` 的**成对写法**：`#section_gift .point-badge` 改前仅有标准 `clip-path: polygon(...)`（无 `-webkit-`）⇒ 去切角时**补出**成对两行（`-webkit-clip-path: none; clip-path: none;`），故 `clip-path: none` 命中由 4 ⇒ 10。属**写法归一**，非新增切角。
- `box-shadow: none` 类占位/清空声明：属既有形态，**非**本单判据。

### ★ 零消费死 CSS 族（本单改动所在选择器，现取消费数 = 0）

现取脚本 `08-dead-css.txt`（扫 `frontend/src/**` 全部 `.js/.jsx/.ts/.tsx`，**排除 `src/test/`**，共 91 件；排除 `styles.css` 自身）：

| 选择器（本单改动所在 / 顺带现取） | 现取命令（见 `08-dead-css.txt`） | JSX/JS 消费数 |
|---|---|---|
| `.badge-gift::before`（切角①） | `count("badge-gift")` | **0** |
| `#section_gift .point-badge`（切角②，父 id `section_gift`） | `count("point-badge")` / `count("section_gift")` | **0** / **0** |
| `.badge::after`（切角③，裸类名 `.badge`） | `className/class` 含裸词 `badge` | **0** |
| `.notification`（位移影层） | `count("notification")` | **0** |
| `.card-hover`（位移影层） | `count("card-hover")` | **0** |
| `.gem-pulse`（旧影层） | `count("gem-pulse")` | **0** |
| `.price-tag`（旧影层） | `count("price-tag")` | **0** |
| `.badge-dot`（零偏移环，未删） | `count("badge-dot")` | **0** |

**另核 `.card` / `[data-theme="dark"] .card` 族（阴影改动主体）**：
- `className/class` 含**裸词** `card` 的 JSX = **0**（现取命中 `sf-card` / `sf-card-body` / `sf-card-title` / `sf-listings-card` 共 5 处，**均为 `sf-` 前缀独立类，非裸 `.card`**）。
- `section[id^="section_"]` 全局现取：JSX 中 **`section_` 出现 = 0** ⇒ `#section_gift` 及其 `.card` 后代规则**整体死 CSS**。
- 静态 HTML：`index.html` 无 `<link href=…styles.css>`（其 `styles.css` 字样仅注释，app CSS 由 Vite 构建期注入）；`admin.html` **不引** `frontend/src/styles.css`，自带内联 `<style>`（其 `class="card"` 17 处由自身内联 `.card` 定义）。

**★ 结论（如实交代）**：本单改动所在的选择器在**构建后的 React 应用**内**消费数 = 0** ⇒ **本次 A4 的可见效果 = 0**。价值 = **清理**（去 jinli 移植遗留死形态）+ **防将来复活时形态不一致**（真源里不再有「切角/硬位移」两种历史写法）。此结论与册 §5.340 行 1432 我（Zang 核盘）的独立判定**一致**；台账 `B12` 已连带登记「先做零消费选择器盘点，再决定删/留，不阻塞」。

---

## §2 改动逐处（file:line + 改前→改后）

**文件**：`frontend/src/styles.css`（`git show --numstat 88341b8` = `25 / 49`）。下表行号为**当前 `HEAD` 工作区**行号（= `88341b8` 行号）；改前值取自 `88341b8^`。

### 2.1 装饰性切角（3 处选择器 / 4 处 polygon ⇒ 成对 `none`）

| # | 选择器（行） | 改前 | 改后 |
|---|---|---|---|
| A | `.badge-gift::before`（653；声明 660–661） | `-webkit-clip-path: polygon(100% 0, 0 0, 100% 100%);` + `clip-path: polygon(100% 0, 0 0, 100% 100%);` | `-webkit-clip-path: none;` + `clip-path: none;` |
| B | `#section_gift .point-badge`（1037；声明 1043–1045） | `clip-path: polygon(100% 0, 0 0, 100% 100%);`（**单写**） | `-webkit-clip-path: none;` + `clip-path: none;`（**补成对**） |
| C | `.badge::after`（1568；声明 1573–1576） | `clip-path: polygon(0 0, 100% 100%, 0 100%);`（**单写**） | `-webkit-clip-path: none;` + `clip-path: none;`（**补成对**） |

### 2.2 legacy 硬位移/内高光影层（16 声明处 ⇒ 原位替换；保留零偏移描边环）

| # | 选择器（新行） | 改前 box-shadow | 改后 box-shadow |
|---|---|---|---|
| 1 | `.card-hover:hover`（404） | `0 8px 16px rgba(0,0,0,0.1)` | `none` |
| 2 | `.card`（金属分区，432） | `0 10px 32px … , 0 3px 10px … , inset 0 1px 0 … , inset 0 -1px 0 …` | `none` |
| 3 | `.card:hover`（438） | `0 14px 40px … , 0 6px 16px … , inset 0 1px 0 … , inset 0 -1px 0 …` | `none` |
| 4 | `.notification`（820） | `0 4px 6px rgba(0,0,0,0.1)` | `none` |
| 5 | `.card`（浅色重写，949） | `0 8px 24px rgba(0,0,0,0.08) !important` | `none !important` |
| 6 | `.card:hover`（959） | `0 10px 26px rgba(0,0,0,0.10)` | `none` |
| 7 | `.card.card-success, .card.card-proceed`（971） | `0 8px 24px rgba(0,0,0,0.08) !important` | `none !important` |
| 8 | `[data-theme="dark"] .card`（1097） | `inset 0 1px 0 … , 0 10px 30px … , 0 0 0 1px rgba(148,163,184,0.18)` | `0 0 0 1px rgba(148,163,184,0.18) !important`（**留零偏移描边环**） |
| 9 | `[data-theme="dark"] .card:hover`（1103） | `0 14px 36px … , 0 0 0 1px rgba(148,163,184,0.22)` | `0 0 0 1px rgba(148,163,184,0.22) !important` |
| 10 | `[data-theme="dark"] .card`（单行，1107） | `inset 0 1px 0 … , 0 10px 30px … , 0 0 0 1px rgba(56,189,248,0.18)` | `0 0 0 1px rgba(56,189,248,0.18) !important` |
| 11 | `[data-theme="dark"] .card.tone-gold`（1484） | `inset 0 1px 0 … , 0 10px 30px … , 0 0 0 1px rgba(245,197,24,0.34) , 0 0 28px …` | `0 0 0 1px rgba(245,197,24,0.34) !important` |
| 12 | `[data-theme="dark"] .card.tone-gold:hover`（1488） | `inset … , 0 14px 36px … , 0 0 0 1px rgba(245,197,24,0.42) , 0 0 32px …` | `0 0 0 1px rgba(245,197,24,0.42) !important` |
| 13 | `[data-theme="dark"] .card.tone-green`（1495） | `inset … , 0 10px 30px … , 0 0 0 1px rgba(16,185,129,0.32) , 0 0 28px …` | `0 0 0 1px rgba(16,185,129,0.32) !important` |
| 14 | `[data-theme="dark"] .card.tone-green:hover`（1499） | `inset … , 0 14px 36px … , 0 0 0 1px rgba(16,185,129,0.40) , 0 0 32px …` | `0 0 0 1px rgba(16,185,129,0.40) !important` |
| 15 | `[data-theme="dark"] .card.tone-blue`（1506） | `inset … , 0 10px 30px … , 0 0 0 1px rgba(59,130,246,0.32) , 0 0 28px …` | `0 0 0 1px rgba(59,130,246,0.32) !important` |
| 16 | `[data-theme="dark"] .card.tone-blue:hover`（1510） | `inset … , 0 14px 36px … , 0 0 0 1px rgba(59,130,246,0.40) , 0 0 32px …` | `0 0 0 1px rgba(59,130,246,0.40) !important` |

**色板/圆角/布局一字未动**：`88341b8` diff 仅触及 `clip-path` 与 `box-shadow` 两类声明 + 注释；`var(--sf-st-radius-btna)` / `var(--sf-st-stroke-w-thin)` 引用仍在（测试例）。

---

## §3 硬门读数（run-tagged · `frontend/.s22-artifacts/s22-20261004T124258Z/`）

> **runid = `s22-20261004T124258Z`**（UTC；目录禁同名覆写）。原始 stdout 一律 `.txt`（`gitignore` 含 `*.log` ⇒ 已**全程回避 `.log`**）。

| 产物文件 | 命令 | 读数 |
|---|---|---|
| `01-counts-polygon-url-rings.txt` | `grep` 三态计数 | polygon = **0**（`grep -c` 退出码 1，即零命中）；`url(#clip-path` = **20**；零偏移环 = **19**；`:focus` 行 = 10；`:focus … 0 0 0` 环 = **8**；`clip-path: none` = 10 |
| `02-shadow-layers.txt`（+ `02-shadow-parse.mjs`） | `node 02-shadow-parse.mjs` | 位移层 = **0**；inset 层 = **0**；层总 = 38；零环 19 / 焦点环 8 / `url(#clip-path)` 20 / polygon 0 |
| `03-vitest-full.txt` | `cd frontend && npx vitest run` | `Test Files 4 failed | 50 passed (54)` · `Tests 7 failed | 480 passed (487)` · **EXIT=1** |
| `04-vitest-baseline-outofrepo.txt`（+ 基线副本说明见下） | 仓外副本 `npx vitest run` | `Test Files 4 failed | 49 passed (53)` · `Tests 7 failed | 471 passed (478)` · **EXIT=1** |
| `05-build.txt` | `cd frontend && npm run build` | `✓ built in 1.63s` · **EXIT=0** |
| `06-four-scripts.txt` | `node scripts/{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.mjs` | 四者**全 `PASS` / EXIT=0**（i18n 键集取值集合 `{1060}`；viol 节点 locale=4240/source=48；safelist `VERDICT=PASS`） |
| `07-negative-control.txt` | 仓外副本内变异/复原 | 见 §4 |
| `08-dead-css.txt`（+ `s22-deadcss-final.py`） | 死 CSS 消费数扫描 | 8 选择器消费数**全 0**；裸 `.card`/`.badge` JSX = 0 |
| `09-parent-vs-new-counts.txt`（+ `09-*.mjs` / `10-disp-count.mjs`） | 三态对照 + sha256 | 见 §1「分类总表」；改前 poly=4/disp=18/inset=12 ⇒ 改后 0/0/0 |
| `README.txt` | 本目录索引 | — |

### 3.1 全量 vitest（改后，主仓）

```
$ cd frontend && npx vitest run
 Test Files  4 failed | 50 passed (54)
      Tests  7 failed | 480 passed (487)
```
失败 7 例（**均为与本单无关的既有红**）：`Card.test.jsx`×6（缺 `bg-white border-gray-200` 等类名）+ `VirtualList.test.jsx`×1；2 个**加载错误**文件 `accessibility/Accessibility.test.jsx`（JSX 语法错 `:202`）+ `e2e/basic.spec.js`（Playwright 误当 vitest）。**新增 `s22-decor-cleanup.test.js` 9 例全绿**（`03-vitest-full.txt` 行 838：`✓ … (9 tests)`）。

### 3.2 基线（**仓外副本**，主仓零污染）

做法（**未 `git stash`**）：`rsync -a --exclude node_modules --exclude dist --exclude .git --exclude '.*-artifacts'` 复制整仓到 `…/cache/scratch/s22-baseline-repo/`，`frontend/node_modules` 与 `frontend/dist` 以**符号链接**接回，然后：① 移出 `frontend/src/test/unit/s22-decor-cleanup.test.js`；② `git show 88341b8^:frontend/src/styles.css > …/frontend/src/styles.css`（现取 sha `c89a699e…` = 改前）。**主仓任何文件未改**（见 §6）。

```
$ cd …/s22-baseline-repo/frontend && npx vitest run
 Test Files  4 failed | 49 passed (53)
      Tests  7 failed | 471 passed (478)
```
**主仓 vs 基线差 = 恰 `+1 文件 / +9 测试`（`s22-decor-cleanup.test.js`），失败集逐条相同**（同 7 例 + 同 2 加载错文件）⇒ **S22 零新增失败**。

> ★ 首版基线副本因**未含仓根 `docs/` / `backend-ts/`** 导致若干测试（`theme-tokens` / `p6-btn-impl` / `s9-ledger-kind-closure` / `theme-shell-isomorphism`）因 `REPO_ROOT/…/style-preview.html`、`backend-ts/src/ledger.ts` 缺失而**环境性红**；**非** S22 所致。已在仓根级副本重跑消除（登记见 §6）。

### 3.3 四脚本（退出码**管道外**取）

```
p6-tr2-i18n-locales.mjs    → EXIT=0  总判：PASS（四文件拍平键数取值集合 = {1060}）
p4z-i18nviol-global.mjs    → EXIT=0  总判：PASS（locale 裸命中 0 + 源面裸命中 0；节点 locale=4240 / source=48）
p4z-feperf-safelist.mjs    → EXIT=0  VERDICT=PASS
p4z-miscfix-links.mjs      → EXIT=0  总判：PASS（残留全部已登记）
```

### 3.4 未做真实浏览器 A/B（见 §5）

本单**未重跑**浏览器 A/B。理由（非偷懒）：本单改动所在选择器**消费数 = 0**（§1 死 CSS 族 + 裸 `.card` JSX=0）⇒ 任何 A/B 的可见像素差**恒为 0**，A/B 无信息量。登记 `NOT_MEASURED`（原因为「零消费 ⇒ 构造性不可见」），**不**伪造 A/B 读数。

---

## §4 判负自证

**做法**：仓外副本 `…/cache/scratch/s22-negctl/`（仓根级 rsync 副本 + `node_modules`/`dist` 符号链接；`styles.css` 现取 sha = `14feca1e…`，测试与主仓同）内，**用文本编辑**把 `.badge-gift::before` 的 `clip-path: none;` 改回 `clip-path: polygon(100% 0, 0 0, 100% 100%);`（`-webkit-clip-path: none;` 保留），跑该测试文件 → **必红**；再写回 `none` → **回绿**。全程**主仓未动**。原始 stdout：`07-negative-control.txt`。

| 步 | 操作 | 现取读数 |
|---|---|---|
| 1 基线 | 未变异（`14feca1e…`） | `Test Files 1 passed (1)` · `Tests 9 passed (9)` · **EXIT=0** |
| 2 变异 | `.badge-gift::before` 去切角改回 polygon（变异后 sha = `39d0102b1ffb18c7ad108eff1cd14fc7f32e1e089dcc4206c0d9a5246b5250b8`） | `Test Files 1 failed (1)` · **`Tests 3 failed | 6 passed (9)`** · EXIT=1 —— 红例：①polygon 命中=0（红）、①成对 `none` 写法（红）、判负自证例（红） |
| 3 复原 | 写回 `clip-path: none;`（sha 回 `14feca1e…`） | `Test Files 1 passed (1)` · `Tests 9 passed (9)` · **EXIT=0** |

**判负结论**：**变异 ⇒ 必红（3 例）**，**复原 ⇒ 回绿**。检查器对形态回退敏感、方向正确。

---

## §5 未做与 `NOT_MEASURED`（逐项给原因）

| # | 项 | 状态 | 原因 |
|---|---|---|---|
| 1 | 真实浏览器 A/B（改前 vs 改后可见差） | **`NOT_MEASURED`** | 改动所在选择器**消费数 = 0**（§1）⇒ 可见像素差**构造性为 0**；A/B 无信息量。且本单硬口径未起实例（不占 5792–5799）。 |
| 2 | 受影响元素渲染外观 / `getComputedStyle` 逐元素快照 | **`NOT_MEASURED`** | 同上：无消费方 ⇒ 无元素可测；`.card`/`.notification`/`.badge` 等在构建物中**不渲染**。 |
| 3 | 生产线上 CSS 与本地改后逐字对照 | **未做** | 本单为纯补落单，不重跑上线核验；线上终验已由册 §5.340 行 1430（我核盘）承担（`index-6gT3vEur.js` sha256 `1c7f921d…` = 本地）。 |
| 4 | 后端 `tsc` / 后端测试 | **N/A 未做** | 本单零后端改动（`88341b8` 只动前端两件）。 |
| 5 | 四门受控实例真 HTTP 腿（`p8-s7/s8/s10/s11`） | **未做** | 与本单前端 CSS 面**零交集**；且硬口径未起实例。台账 §C 已登记「须起 5792–5799 实例」。 |
| 6 | `1.5px→1px` 描边像素级差 / hover·focus·active 态 | **`NOT_MEASURED`** | 承 §5.154 遗留项；本单不涉描边宽改动（`88341b8` 未改 `*stroke-w*` 数值）。 |
| 7 | 死 CSS 的**处置**（删/留） | **未做（登记）** | 台账 `B12`：要求「先做零消费选择器盘点，再决定删/留」；本单**只盘点、不处置**（改死 CSS 亦非本单射程）。 |
| 8 | 被改选择器的**动态类名**构造（模板串拼接）穷尽核 | **已尽力** | 现取 `className` 上下文 + 裸词正则；`sf-*` 前缀误命中已排除。若存在**运行时不可静态枚举**的拼接，属残余不确定（登记）。 |

---

## §6 自曝

1. **★ 两处「字面命中背宝缺口/角标形状」的选择器经 Zang 裁定保留在射程内 —— 逐字留痕**：
   - 该两处 = `.badge::after`（改前 `clip-path: polygon(0 0, 100% 100%, 0 100%)`，注释自述「贴近卡片背景以产生"缺角"视觉」）与 `.badge-gift::before`（三角角标带切角）。
   - **依据（逐字）**：册 §5.339 行 1448 A4 行 ——「**不保留** ⇒ 把装饰性切角与 legacy 硬位移阴影**统一到已收敛的形状语言**；前端单（只 `styles.css`）：**禁碰** `clip-path: url(#…)`（SVG 内部）与 `:focus` 焦点环」；台账 `OPEN-ITEMS` A4（`88341b8` 时行 15 / S24 后 §D 行 43）；**Kevin 2026-10-04 定档「不保留」**（§5.339 行 1440 原话：「A4：**不保留**，我认为 UI 目前可视的部分非常好」）。**Zang 裁盘**（§5.340 行 1422）：「我裁：保留在射程内（台账 A4 与 §5.339 已逐字列其为装饰性且 Kevin 定档「不保留」；且均零消费死 CSS）」。
   - **可回退路径**：整体 `git revert 88341b8`；或单文件回退 `git checkout 88341b8^ -- frontend/src/styles.css`（两者均恢复 4 处 polygon 切角与 18 位移层 + 12 inset 层）。
2. **★ 零消费死 CSS 发现（价值口径）**：本单改动所在 8 类选择器 JSX 消费数**全 0**（§1）；⇒ **本次 A4 可见效果 = 0**，价值 = **清理** + **防将来复活时形态不一致**。**不**声称「收敛了用户可见形状」。
3. **commit message「16 处非 inset 位移影层」与我现取口径差（并列两数）**：
   - commit 称 **16 处**；我现取 = **16 个 box-shadow 声明处**（块）对应 **18 个位移影层**（多层块内 2 层者：`.card` 金属、`.card:hover` 金属 各含 2 条位移层）。
   - 两数**均真**，仅**口径不同**（「处/块」vs「层」）。以现取为准：**16 块 / 18 层**；另 **12 个 inset 层**随块一并去除。
4. **box-shadow 层数分账（现取脚本 `10-disp-count.mjs` / `09-parent-vs-new-counts.txt`）**：层总 `67 → 38`（`-29`）。逐类现取：**位移层 `18→0`**（`-18`）· **inset 层 `12→0`**（`-12`）· 零偏移**非环**层（`0 0 28px`/`0 0 32px` 彩色外发光等）`9→3`（`-6`）· `none` 占位层 `9→16`（`+7`）；**零偏移环 `0 0 0 Npx` `19→19`（不变 ✓）**。校验：`-18 -12 -6 +7 = -29` ✓（`67-29=38` ✓）。→ commit message「**16 处**非 inset 位移影层」= **16 个 box-shadow 声明块**（块数 `38=38` 一一原位替换），对应现取 **18 个位移层**；**两数均真、口径不同**（处/块 vs 层），**并列给出，不抹平**。→ 登记为**口径提示**，非缺陷。
5. **基线副本两次迭代（环境性红）**：首次仓外副本仅含 `frontend/`，致 4 个依赖仓根文件的测试**环境性红**；第二次改为**仓根级**副本 + `dist` 符号链接后，基线失败集与主仓**逐条相同**。已如实记录于 §3.2；**不**把首版红计作 S22 缺陷。
6. **未发现已入库代码真缺陷**：`88341b8` 的 `styles.css` 与测试**逐处复核无异常**，无 §硬口径⑤ 触发项（若发现即停报，本单未触发）。**本单未改任何已入库文件**。
7. **主仓零污染**：全部变异/回退/基线跑均在 `/Users/kevin/.hermes/profiles/zang/cache/scratch/` 下的仓外副本进行；`git status --porcelain`（收工）仅出现**本单新增** `docs/audit/s22-decor-cleanup.md` 与 `frontend/.s22-artifacts/s22-20261004T124258Z/`（+ 他方历史未跟踪产物）。
8. **未 `commit` / 未 `push`**；`npm install` 未跑；`.env*` 未碰；未启停 `5787/5788`、未起任何实例。
