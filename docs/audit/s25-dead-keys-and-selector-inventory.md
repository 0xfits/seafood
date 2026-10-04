# S25 · B7 死键退役（四语对称删除 10 键）+ B12 零消费选择器只读盘点 —— 报告

- **仓库**：`/Users/kevin/bistro/seafood`　**角色**：Kong（实现方）　**执行**：2026-10-04（CST）
- **本单 = 台账 B7（死键退役） + B12（零消费选择器只读盘点，只出方案）**
- **硬口径遵守**：只改 `frontend/src/**` 与 `frontend/scripts/**`（+ 新增 `docs/audit/` 本报告与产物）✓ · **未改** `backend-ts/**` · `docs/*.spec.md` · `docs/OPEN-ITEMS.md` · `docs/seafood.master-plan.md` ✓ · 禁 `pkill -f`/`killall`（未用）✓ · 未 `git add -A` / 未 commit / 未 push ✓ · 未 `npm install` ✓ · 未碰 `.env*` ✓ · 未启停 5787/5788、未起任何实例（未占 5792–5799）✓ · 原始输出**无 `.log`**（一律 `.txt`/`.json`/`.bak`）✓ · **未改 `frontend/src/styles.css`**（B12 要求；现取自证见 §3.0）✓

---

## §0 对锚与范围

```
$ git log --oneline -3
49ecc35 docs: §5.341/v0.341 —— S22 补落单回执（报告 7 节 / 产物 15 件 / 代码零改动核过）+ 口径差登记（「16 处」= 声明块 vs「18 层」= 层数，两数均真）⇒ 本批全部收口
7e59ace docs: §5.340/v0.340 —— S22∥S23∥S24 三单回执与核盘（亲跑 tsc/vitest/build/四脚本/只读探针）…
51a5d6c docs: S24 —— A1/A2/A3 三项定值落册 …

$ git status --porcelain（开工）→ 仅大量 `??` 未跟踪历史产物（`backend-ts/.p*-artifacts/**`、`frontend/.s22-artifacts/`），**无 tracked 改动**
```

**对锚结论**：开工 `HEAD = 49ecc35` ✓（= 派单给定锚）；开工工作树 tracked 干净 ✓。

**本单改动面（tracked）**：`frontend/src/locales/{zh,hk,en,vn}.json`（各 `10 −`）+ 13 个测试文件（计数/键面）+ 新增 `frontend/scripts/s25-selector-inventory.mjs`。**新增未跟踪**：`frontend/.s25-artifacts/<runid>/`、本报告。

> **★ 并发自曝**：会话进行中（21:08）另一会话（注释自述「**S26 台账 B9**」）改写了 `backend-ts/scripts/p8-s{3,3b,4,5}-*-gate.ts`（把 `MIGRATIONS_FROZEN 41→42` 等）；**非本单所为**，本单**未触碰** `backend-ts/**`。详见 §6.3。

**产物目录**：`frontend/.s25-artifacts/s25-20261004T210725Z/`（runid 见 `frontend/.s25-artifacts/.last-runid`）。
`00-baseline-vitest.txt` · `01-vitest-post*.txt` · `02-build.txt` · `03-<四脚本>.txt` · `04-negctl-{red,green}.txt` · `b12-zero-consumption.{txt,json}`。

---

## §1 B7 逐键处置表（键 → 四语值 → 引用读数 → 处置）

**退役 10 键**（`jobs` 命名空间下，四语对称删除）。**四语值**取自 `HEAD:frontend/src/locales/*.json`（删前原值）：

| # | 键（`jobs.`） | zh | hk | en | vn | 产品面引用 | 测试面引用（删前） | 处置 |
|---|---|---|---|---|---|---|---|---|
| 1 | `apply` | 申请报名 | 申請報名 | Apply | Ứng tuyển | **0** | `r9-90:148`（值依赖 `zh.jobs.apply`）、`r9-90:304`（KEPT 清单） | 删键；`:148` 值依赖断言移除+留痕；`:304` 移出清单 |
| 2 | `applyOk` | 报名成功 | 報名成功 | Application sent | Đã gửi đơn | **0** | `r9-90:304` | 删键；移出 KEPT 清单 |
| 3 | `accept` | 接受申请 | 接受申請 | Accept application | Nhận đơn | **0** | `r9-90:304` | 删键；移出 KEPT 清单 |
| 4 | `acceptNote` | 接受申请需填写申请编号；申请列表暂未开放，请手动填写。只有雇主可以接受申请。 | 接受申請需填寫申請編號；申請列表暫未開放，請手動填寫。只有僱主可以接受申請。 | Enter the application id to accept it; the applicant list is not open yet, so type the id in manually. Only the employer can accept an application. | Cần nhập mã đơn ứng tuyển để chấp nhận; danh sách ứng viên chưa mở nên hãy nhập tay. Chỉ chủ việc mới chấp nhận được đơn. | **0** | `i18n-violation-closeout:45`（改写集）、`:105`（保真锚「只有雇主」，**值依赖**）、`r9-90:304` | 删键；`:45` 移出改写集；`:105` **移除+留痕（非削弱，派单明令）** |
| 5 | `acceptOk` | 已选定打工人 | 已選定打工人 | Worker selected | Đã chọn người làm | **0** | `r9-90:304` | 删键；移出 KEPT 清单 |
| 6 | `applicationId` | 申请编号 | 申請編號 | Application id | Mã đơn | **0** | `r9-90:305` | 删键；移出 KEPT 清单 |
| 7 | `submitNeedApply` | 请先报名参与该任务，再提交交付物。 | 請先報名參與呢個任務，之後先可以提交交付物。 | Apply to this job first; you can submit a deliverable once you have applied. | Hãy ứng tuyển việc này trước; sau khi ứng tuyển mới có thể nộp sản phẩm. | **0** | `r9-90:305` | 删键；移出 KEPT 清单 |
| 8 | `applyPrompt` | 请先参与该任务 | 請先參與呢個任務 | Apply to this job first | Hãy ứng tuyển việc này trước | **0** | `r9-90:304` | 删键；移出 KEPT 清单 |
| 9 | `applyWaiting` | 已报名，等雇主选定后即可提交 | 已報名，等僱主選定後即可提交 | Applied; you can submit once the employer selects you | Đã ứng tuyển; bạn có thể nộp bài sau khi chủ việc chọn bạn | **0** | `r9-90:304` | 删键；移出 KEPT 清单 |
| 10 | `pick` | 选为提交对象 | 選為提交對象 | Use for submission | Chọn để nộp bài | **0** | `r9-90:305` | 删键；移出 KEPT 清单 |

- **产品面（非 `locales/`、非 `src/test/`）引用读数 = 0**（`grep -rn "jobs\.\(apply\|…\|pick\)" src --include=*.js[x]` 排除 `src/locales/` 与 `src/test/` ⇒ 空）。
- **背景**：J2 报名（`POST /api/job/:jobId/apply`）/ J3 选定（`POST /api/job/:jobId/accept`）两写面已下架（恒 `410 APPLY_RETIRED`/`ACCEPT_RETIRED`），换轴后这些键已成死文案。
- **删除印证**：10 键在 `jobs` 内连续/近邻（zh 行 93 `pick`；105–110 `apply…applicationId`；115 `submitNeedApply`；119–120 `applyPrompt/applyWaiting`），四语行号一致。
- **★ 同义陷阱（已避）**：zh 行 **1147** 另有 `"apply": "查询"`（en `Search`/vn `Tìm kiếm`），属 **`auditConsole` 命名空间**（`AuditConsolePage.jsx` 用 `t('auditConsole.apply')`），**非 `jobs.apply`** ⇒ **未删**（现取核过：四语 `auditConsole.apply` 均在，见 §4 AC1）。

### 逐条断言处置（出处）

| 文件:行（删前） | 断言 | 处置 |
|---|---|---|
| `i18n-violation-closeout.test.jsx:45` | `REWRITTEN` 数组含 `'jobs.acceptNote'` | **移出**（留痕注释）；改写集 33⇒32；③ 的 `>=120` 门仍满足（32×4=128） |
| `i18n-violation-closeout.test.jsx:105` | `expect(flatTables.zh['jobs.acceptNote']).toContain('只有雇主')` | **移除**（派单明令）+ 注释「守护对象已退役，非削弱」；同族保真锚（`listings.refundNote`/`market.mineNote`/`claimRetiredNotice`）**仍在**且断言存活 |
| `r9-90:144–149` | `expect(header.textContent).not.toContain(zh.jobs.apply)` | **★值依赖型断言**：语义依赖 `jobs.apply` 的**值**（「申请报名」）⇒ 键退役后守卫失去可锚对象 ⇒ **移除+留痕**；见 §1.1 |
| `r9-90:301–321`（⑥） | `KEPT_KEYS` 列出 10 键 + `it.each` 断言「四语齐备且非空」 | 10 键**移出 KEPT 清单**，改由新增 `RETIRED_KEYS` 断言「**四语均不存在**」；`myApps/myAppsEmpty` 保留于 KEPT 清单按原口径断言；见 §1.2 |
| 13 个计数文件 | `1060`/`4240` 期望 | **等量下移** `1050`/`4200` + 原因注释 + 留痕（逐条见 §2.2） |

#### §1.1 ★值依赖型断言（回报 Zang，单列）
`r9-90:148` 的 `not.toContain(zh.jobs.apply)` **依赖键的值而非存在性** ⇒ 键删后 `zh.jobs.apply === undefined`，`str.includes(undefined)` 恒 `false` ⇒ `.not.toContain(...)` 变**空断言**（静默削弱）。**未自行二选一**：按本单派单对 `acceptNote:105` 的**同款明令**（「移除该行 + 注释留痕（守护对象已退役，非削弱）」）与硬口径 #6（「若某断言真的失去守护对象 ⇒ 可移除但必须写理由注释并在报告里单列」）⇒ **移除该行 + 四行留痕注释**。**若 Zang 欲保留反面护栏**，备选 = 硬编旧值 `'申请报名'`（需新裁决，本单未采用）。**该键的产品零引用已由 §4 AC3 独立佐证**，故反面护栏实为冗余。

#### §1.2 r9-90 ⑥ 键面改造（留痕）
原 ⑥「已不再被引用的存量键仍在（四语齐备，值未改）」前提被 B7 部分推翻。**改造为**「⑥ 死键退役后的键面」：
- `RETIRED_KEYS`（10 键）⇒ `it.each` 断言 `Object.prototype.hasOwnProperty.call(table.jobs, k) === false`（**四语均不存在**）；
- `KEPT_KEYS`（仅 `myApps`/`myAppsEmpty`）⇒ 保留原「四语齐备且非空」断言；
- 末例断言四语 `jobs` 键数**对称相等**且 `> 0`（只删不增）。

---

## §2 计数前后

### §2.1 基线读数（现取自证）
```
$ node -e "…flatten…"    # 现取（顶层键 / 拍平叶子 / 四语节点）
删前：顶层 119 / 拍平 1060 / 四语节点 4240   （四语逐语 flat 均 = 1060）
删后：顶层 119 / 拍平 1050 / 四语节点 4200   （四语逐语 flat 均 = 1050）
```
- 顶层 119 **不变**（删的是 `jobs` 内子键，未删顶层命名空间）。
- 拍平 **1060 ⇒ 1050**（Δ = −10/语 = 退役 10 键）；四语节点 **4240 ⇒ 4200**（= 1050 × 4）。
- **等量下移**：删 10 键 ⇔ 期望 −10，**一一对应、无凑绿**。

### §2.2 计数期望逐条出处（全部「等量下移 + 原因注释 + 留痕」）
| # | 文件 | 行（改后） | 改动 |
|---|---|---|---|
| 1 | `s7-submissions-panel.test.jsx` | 18 / 295 / 296 / 299 / 301 | 注释与 describe/it 名 `1060/4240`→`1050/4200`；`toBe(1060)`→`toBe(1050)`；`toBe(4240)`→`toBe(4200)` |
| 2 | `s5-publish-headcount.test.jsx` | 81 / 84 / 86 | it 名 + `FLAT[l]` `toBe(1060→1050)` + `zh×4` `toBe(4240→4200)` |
| 3 | `i18n-batch-b4a.test.jsx` | 145 | `counts.zh` `{top:119,flat:1060}`→`{top:119,flat:1050}` |
| 4 | `i18n-batch-b4b.test.jsx` | 256 / 321 | `counts.zh` `flat 1050`；`out` 含 `zh: top=119 flat=1050`（脚本 `p6-tr2` 动态打印） |
| 5 | `i18n-batch-b5.test.jsx` | 215 / 256 | `out` 含 `zh: top=119 flat=1050`；`counts.zh` `flat 1050` |
| 6 | `r9-96-dashj-copy.test.jsx` | 119 / 126 / 130 | describe 名；`f` `toBe(1060→1050)`；`nodes` `toBe(4240→4200)` |
| 7 | `r9-93-points-symbol.test.jsx` | 185 / 192 | it 名；`flat(TABLES[lang])` `toBe(1060→1050)` |
| 8 | `s19-participants-truth-source.test.jsx` | 5 / 101 / 104 / 106 | 头注；it 名；`flat` `toBe(1060→1050)`；`zh×4` `toBe(4240→4200)` |
| 9 | `s8-locale-key-coverage.test.js` | 181 / 184 / 186 | it 名；`flat` `toBe(1060→1050)`；`zh×4` `toBe(4240→4200)` |
| 10 | `s9-ledger-kind-closure.test.js` | 14 / 121 / 124 / 126 | 头注；describe/it 名；`flatten` `toBe(1060→1050)`；`zh×4` `toBe(4240→4200)` |
| 11 | `s23-participants-headcount.test.jsx` | 6 / 111 / 114 / 117 / 119 | 头注；分节注；it 名；`flat` `toBe(1060→1050)`；`zh×4` `toBe(4240→4200)` |
| 12 | `i18n-violation-closeout.test.jsx` | 82 / 127 | `out` 含 `作用域命中节点数 = 4240→4200`；`counts` `toBe(1060→1050)` |

> 每处均加注「S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）」，便于下轮溯源。
> **脚本侧**：`p6-tr2-i18n-locales.mjs` / `p4z-i18nviol-global.mjs` **动态计算并打印**读数（非硬编）⇒ 现取自动得 `{1050}` / `节点=4200`，无需改脚本。

---

## §3 B12 零消费选择器（只读盘点 + 两变体；**不改 `styles.css`**）

### §3.0 只读自证（`styles.css` 未改）
```
$ shasum -a 256 frontend/src/styles.css          → 14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959
$ git show HEAD:frontend/src/styles.css | shasum  → 14feca1ea147434f26a056a679809b3366f46f321d9df53eb0e3f0a7d20f3959
identical = YES
```

### §3.1 盘点脚本与口径（`frontend/scripts/s25-selector-inventory.mjs`，纯只读）
```
$ node scripts/s25-selector-inventory.mjs --out frontend/.s25-artifacts/<runid>      # 人读 txt
$ node scripts/s25-selector-inventory.mjs --json --out frontend/.s25-artifacts/<runid>  # 机读 json
```
**对拍口径（写死，逐条列名处理误报）**：
- **选择器解析**：剥注释（保换行对齐行号）→ 花括号配对扫描取每条规则 prelude；`@media/@supports/@container/@layer` 内的**同名选择器**另记 `ctx`（不改判据）；`@keyframes` 内 `0%/from/to` **跳过**（非选择器）。
- **class 消费 = 整词精确匹配（区分前缀类）**：JSX/HTML 串按空白/标点切词；`.card` **不**由 `sf-card` 命中，`.sf-card` **不**由 `.sf-card-body` 命中。
- **CSS 变量**（`--x` / `var(--x)`）**不**参与 class/id 判定。
- **`!important`** 只影响声明不影响选择器消费 ⇒ 不参与。
- **动态拼接类名**（`` `sf-x-${v}` `` / `clsx(a && 'x')` 变量）**无法静态枚举** ⇒ 若某 class 与任一「模板串静态前缀」互为前缀延长 ⇒ 单列**「不确定」**。
- **消费面**：`code` = `src/**`（**排除 `src/test/`** 与 `styles.css` 自身）；`html` = `index.html`/`admin.html`/`public/*.html`（**非 JSX 面**）；`url(#id)`（内联 SVG）单列。
- **消费来源仅取「类名上下文」**（防把 design-token 键/普通文案误当类名）：`className=`/`class=`/`id=` 属性 · `cn()/clsx()/classnames()/cx()` 调用 · `classList.add|remove|toggle|contains` · `querySelector(All)('.x')` · `getElementById()` · `*Class/*Variant/*Size/*Theme/*Style = {…}` 映射表（如 `Button.jsx` 的 `variantClass`/`sizeClass`）。

### §3.2 现取读数（`b12-zero-consumption.txt`）
```
规则前导 = 387；选择器分片 = 381；distinct class = 149；distinct id = 13
消费面：code 文件 = 91（排除 src/test 与 styles.css）；html = 2；code 整词 = 1361；html 整词 = 131；url(#id) = 10
★ 零 JSX 消费选择器分片 = 278（distinct 名 = 131；distinct 规则块 = 242）
三分类·按分片：真残留=182 ; 不确定(动态拼接)=14 ; 活跃·非JSX面(HTML)=32 ; 混合(HTML+真残留)=28 ; 混合(HTML+不确定)=22
三分类·按名  ：真残留=227 ; 不确定(动态拼接)=36 ; 活跃·非JSX面(HTML)=82
形态标注：伪元素(::before/::after 等)分片 = 19 ; id 形态(#id)分片 = 25 ; @media 内分片 = 4
```

### §3.3 三分类（逐类读数）
| 分类 | 按分片 | 按名 | 代表（现取） | 说明 |
|---|---|---|---|---|
| **真残留** | 182 | 227 | `.card.tone-*`、`.btn-primary`、`.badge-*`、`.tag-status*`、`.pagination*`、`.tooltip`、`.notification*`、`.timeline*`、`.avatar`、`.skeleton`、`.progress-*`、`.modal-title/-actions`、`.swedish-title`、`.badge-dot*`、`#chest*`+`.cls-*`(嵌入式 SVG 造型，62 分片) | 类名已换/概念消失 ⇒ 死 CSS |
| **活跃·非 JSX 面（HTML）** | 32 | 82 | `.card`、`.card:hover`、`.card::before/::after`、`.card h3`、`.badge` 等 | 命中来自 **`admin.html`**（自带内联 `<style>`，**不引** `styles.css`）⇒ **名义活跃、实为巧合**，见 §3.4 |
| **活跃·非 JSX 面（内联 SVG url(#id)）** | 0* | 0* | `#clip-path(-N)` 系列被 `url(#…)` 引用 ⇒ **不计入零消费**（已属消费面） | `url(#id)` 引用数 = 10（distinct id） |
| **不确定（动态拼接）** | 14 | 36 | `page-content`、`card-hover`、`button-group`、`card-primary/-success/-proceed/-inactive/-warning`、`claimed-time`、`timeline`、`price-tag`、`card-split/-top/-bottom`、`card--badge-space` | 与模板串静态前缀互为延长 ⇒ 无法静态判定 |

\* 0 是因为本脚本把 `url(#id)` 直接算作「消费」；如 Zang 需「单列但不并吞」，可加 `--strict-svg` 开关（方案项，本单未实现）。

**族级分布（top，供删改定界）**：`card`(78)、`cls`(62)、`badge`(27)、`tag`(19)、`chest`(15)、`table`(6)、`pagination`(5)、`btn`(4)、`notification`(4)、`timeline`(4)、`junit`(4)、`modal`(3)、`tooltip`(3)、`point/points`(各3)…

### §3.4 ★误报排除的现取证据（假零交叉核）
**方法**：对 131 个「零消费名」逐一做源面（`src/**` 排除 test）**原始子串**搜索（正则边界 `[^\w-]`）。**仅 3 命中**，逐条核：
| 名 | 命中处 | 判定 |
|---|---|---|
| `table` | `<table …>` JSX 元素标签（非 `className`） | **真死**（`.table` 类无 `className` 消费） |
| `tag` | `const tag = …`（JS 局部变量） | **真死**（`.tag` 类无消费） |
| `chest` | `RewardPage.jsx:164` 注释里 `/api/chest/:bID/open` | **真死**（`.chest/#chest*` 仅 styles.css 自述） |

另核 **已知在用类绝不误列**（现取全 `false` = 未列入零消费）：`sf-card`、`sf-i18n-badge`、`modal-header`、`btn`、`btn-a`、`btn-a-alt`、`btn-sm/md/lg`、`btn-success/outline`、`header`。
另核 **已知死族全列入**（全 `true`）：`badge-gift`、`card-hover`、`notification`、`badge-dot`、`price-tag`、`gem-pulse`、`section_gift`、`swedish-title`、`avatar`。
> 与 S22 `08-dead-css.txt` 独立口径**交叉一致**；`admin.html` **不引** `styles.css`（S22 §1 已证），故「HTML 活跃」桶实为**巧合命中**，**不计**为真活跃。

### §3.5 两变体（**不选**，交 Zang 终审）
**变体 Ⅰ —— 直接删除零消费选择器**
- 改动面：`styles.css` 内 **242 个规则块 / 278 个选择器分片**（不连续；建议按族分批：`card`/`cls`/`badge`/`tag`/`chest` 五族占 201 分片）。**须保留** `url(#…)` 指向的 SVG def、`:focus` 焦点环（可达性面）、`.btn`/`.btn-*` 在用族。
- 代价：① 部分「不确定」若实为动态拼接则**会掉样式**（须先消歧，见下）；② 删后若将来**复活旧标记**（如 jinli 组件回流）会少样式 ⇒ 需从 git 历史回捞。
- 回退路径：`git revert`/`git checkout <rev> -- frontend/src/styles.css`（逐字节回滚）；或保留 `styles.css.bak`（本单**未**建，按需）。

**变体 Ⅱ —— 保留但集中加一段带注释的「遗留区」标死**
- 改动面：仅在 `styles.css` 末尾**新增**一段注释头（`/* === LEGACY / ZERO-CONSUMPTION === 台账 B12 盘点… 见 docs/audit/s25… §3 */`）+ 可选把零消费族归拢（归拢会移动行号 ⇒ 更扰）。
- 代价：① 零删除 ⇒ 体积/渲染无收益，仅**语义标注**；② 清单**会漂移**（新代码一用即过期）⇒ 需以脚本 `scripts/s25-selector-inventory.mjs` **复跑**为真源。
- 回退路径：删那段注释即回退（零代码语义变更）。

**消歧前置（两变体共同）**：对 36 个「不确定」名（§3.3）先做**动态拼接消歧**——现取仅 `card-hover`/`timeline`/`price-tag`/`card-primary…` 等 15 名命中外，其余多为「静态命名但名字未出现在类名上下文」。建议 Ⅰ 变体**只删真残留 + 已消歧的确定项**，`不确定` 留待人工核。

---

## §4 判负自证 + 硬门读数

### §4.1 AC1 四语键集严格相等 + 10 键均不存在（现取）
```
$ node -e "…canonical flatten…"
top(zh) = 119
flat    : zh=1050 hk=1050 en=1050 vn=1050
四语键集严格相等 = true
四语节点合计 = 4200
jobs.<10键> 四语均不存在 = true
auditConsole.apply 仍在四语 = true      （同义陷阱避让自证）
未退役存量键 myApps/myAppsEmpty 仍在四语 = true
```

### §4.2 AC3 产品面引用 = 0（现取）
```
$ grep -rn "jobs\.\(apply\|applyOk\|accept\|acceptNote\|acceptOk\|applicationId\|submitNeedApply\|applyPrompt\|applyWaiting\|pick\)" \
    frontend/src --include=*.js --include=*.jsx | grep -v src/locales/ | grep -v src/test/
（空）
```

### §4.3 判负自证（B7）——「任一键加回 zh ⇒ 计数断言必红；复原回绿」
```
zh.json sha BEFORE mutation = 0835f5a78c8fe3bc938813a4d6027f4b29f796e9db984af579874fa1dd6727d8
变异：把 jobs.apply="申请报名" 临时加回 zh.json（sha = 46b3727d…）
  判负（期望 RED）：npx vitest run s8-locale-key-coverage + r9-90 + i18n-violation
    ⇒ Test Files 3 failed (3) / Tests 5 failed | 37 passed (42) / EXIT=1
       红点之一：`AssertionError: zh flat: expected 1051 to be 1050`
复原：cp 备份回 zh.json ⇒ sha RESTORED = 0835f5a7…（与 BEFORE 逐字节同，零残留）
  回绿（期望 PASS）：Test Files 3 passed (3) / Tests 42 passed (42) / EXIT=0
```
⇒ 检查器**对键回归敏感**（+1 键即红）、方向正确；**主仓零残留**（sha 前后一致）。

### §4.4 AC4 硬门（退出码**管道外**取）
| 门 | 命令 | 读数 |
|---|---|---|
| 单测（全量） | `npx vitest run` | **4 files / 7 tests failed | 50 files / 480 tests passed（54/487）· EXIT=1** —— 与**基线逐条相同**（见 §4.5）|
| 构建 | `npm run build` | `✓ built in 1.60s` · **EXIT=0** |
| 四脚本·`p6-tr2-i18n-locales` | `node scripts/p6-tr2-i18n-locales.mjs` | `[TR-2] 键集相等：PASS（{1050}）` · `总判：PASS` · **EXIT=0** |
| 四脚本·`p4z-i18nviol-global` | `node scripts/p4z-i18nviol-global.mjs` | `作用域命中节点数 = 4200（键 1050 × 语 4）` · `locale 裸命中 0 + 源面裸命中 0` · `总判：PASS` · **EXIT=0** |
| 四脚本·`p4z-feperf-safelist` | `node scripts/p4z-feperf-safelist.mjs` | `VERDICT=PASS` · **EXIT=0** |
| 四脚本·`p4z-miscfix-links` | `node scripts/p4z-miscfix-links.mjs` | `总判：PASS（残留全部已登记）` · **EXIT=0** |

### §4.5 基线 vs 改后失败集（逐条相同）
```
基线 00-baseline-vitest.txt          改后 01-vitest-post-failset.txt
FAIL src/test/accessibility/Accessibility.test.jsx      ← 同
FAIL src/test/e2e/basic.spec.js                          ← 同
FAIL src/test/components/Card.test.jsx（6 例）           ← 同
FAIL src/test/performance/VirtualList.test.jsx（1 例）   ← 同
Test Files  4 failed | 50 passed (54)                    ← 同
      Tests  7 failed | 480 passed (487)                 ← 同
```
⇒ **零新增失败、零减少通过**（失败集与基线**逐条相同**）；本单 13 个受影响测试文件**全绿**（`13 passed (13) / 143 passed (143)`）。

---

## §5 未做与 NOT_MEASURED

| 项 | 状态 | 理由 |
|---|---|---|
| B12 变体 Ⅰ/Ⅱ **实施** | **未做（设计如此）** | 本项**只盘点、只出方案**，交 Zang 终审；且**不得改 styles.css** |
| 浏览器 A/B（B7） | `NOT_MEASURED` | 键为死文案、产品面零引用 ⇒ **构造性不可见**；A/B 无信息量 |
| 浏览器 A/B（B12） | `NOT_MEASURED` | 本项零代码改动（styles.css 未改）⇒ 无面可测 |
| `tsc --noEmit` | 未跑 | 本单**不改 TS/JS 逻辑**（仅 JSON 键与测试期望）；`tsc` 不在派单 AC 四项硬门内。**风险自评：极低**（新增脚本为 `.mjs`，测试改动为字面量） |
| 5792–5799 自起实例 | 未起 | 无网络/服务面改动 |
| 动态拼接类名的**逐条消歧**（36 名） | `NOT_MEASURED` | 静态不可枚举；已单列「不确定」并给消歧前置建议（§3.5） |
| `url(#id)` **stricter** 单列模式 | 未实现 | 方案项（脚本 `--strict-svg`），按需 Zang 指派 |

---

## §6 自曝

1. **`auditConsole.apply` 同义陷阱**：`jobs.apply`（删）与 `auditConsole.apply`（保留，`AuditConsolePage.jsx` 在用）同名不同命名空间；若按裸名 `"apply"` 批量删会误伤后者。本单**按 JSON 路径删除**并现取核过四语 `auditConsole.apply` 仍在 ⇒ **零误伤**。
2. **B12 分类器**为**启发式**（整词匹配 + 类名上下文窗口 200 字符 + 映射表扫描）：会**漏**「值经多层变量/远端下发拼装」的类名（已归「不确定」）；`admin.html` 的 `class=` 命中被判「非 JSX 面活跃」，但 **`admin.html` 并不引 `styles.css`**（S22 已证）⇒ 该 32 分片实为**巧合命中**，删/留时**应按真残留对待**。已在 §3.4 明示。
3. **★ 并发改写（非本单）**：会话进行中 21:08，另一会话（自述「S26 台账 B9」）改写 `backend-ts/scripts/p8-s{3,3b,4,5}-*-gate.ts`（`MIGRATIONS_FROZEN 41→42` 等）。**本单未触碰 `backend-ts/**`**；开工 `git status` tracked 干净，故这些 `M` **必非本单**。请 Zang 核 S26 时勿记入 S25。
4. **`s19` 断言改名**：`s19:101` 原 it 名「键名/键数不变」在 B7 后已名不副实 ⇒ 改为「键计数」（语义不变，仍钉基线前推）。**非删断言**。
5. **脚本 tokenizer 首版有 bug**（`$` 未作切分符 ⇒ `${…}` 未断开 ⇒ `sf-i18n-badge` 被误列零消费）；已修并**重跑交叉核**（§3.4）⇒ 现取假零 = 3（全属 JS 变量/元素标签/注释，非类名）。
6. **`.cls-*` 族（62 分片）**：属 `styles.css` 内**嵌入式 SVG 的 `<style>` 内容**（`#chest { .cls-1{…} … }`，行 1132–1360），其宿主 SVG 标记**现取不存在于 JSX/HTML** ⇒ 本脚本归「真残留」；如 Zang 认为该 SVG 仍有可能复活，宜人工降级为「不确定」。
7. **未 commit / 未 push / 未 `git add -A`**（遵硬口径）；改动仅落在工作树，由 Zang 终审后处置。

---

*报告路径：`docs/audit/s25-dead-keys-and-selector-inventory.md`；产物：`frontend/.s25-artifacts/s25-20261004T210725Z/`；脚本：`frontend/scripts/s25-selector-inventory.mjs`。*
