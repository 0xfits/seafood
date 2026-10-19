# BATCH-1019-3 · 首页分页（82e465e）+ 6 列/容器 1536（10ef6b1）独立质检

> 范围：本轮只检 `82e465e`（分页 + 只列 listed）与 `10ef6b1`（6 列 + 容器 1536）。
> `0fe454a`（综合排序 v1）沿用上一轮 6/6 PASS 作基线，本单不重做。
> 纪律：零产品代码改动、零文档改动、零写库、未 commit、未 push。全部读数在 `readings/`（本目录内），
> `verdict.json` 的每项判定由 `aggregate-verdict.py` 从读数算出（非手抄）。
> 环境：真 vite dev `localhost:5787`（`/api` 反代 → `5788`）+ 真 dev 后端 `5788` + Chrome headless；
> dev 库 `neon.project_id = quiet-math-65207667`，`listing` 26 行（draft 15 / delisted 2 / listed 9）。

## 结论

**6/6 AC PASS**（`verdict.json` summary = PASS 6 / FAIL 0 / NOT_MEASURED 0）。

| AC | 判定 | 关键读数 |
|---|---|---|
| AC1 分页真生效 | PASS | 真后端 390/1440 首屏 **9** 卡 = min(36, listed 9)、零重复 bID、到底 `feed-end`；夹具 A 卡数 **36→72→80**、skip **0→36→72**、distinct 80、无 loading 残留；夹具 B（第 1↔2 页重叠 2 行）**36→70→80**（82 交付 → 80 distinct，去重真生效）；失败臂停住且重试复用 skip=36 |
| AC2 只列 listed | PASS | `/api/prize/all` bID 集合 **逐项等于** DB `status='listed'`（`[76,71,24,23,19,18,15,14,13]`，missing/extra 皆 ∅），draft/delisted 泄漏 **0**；`/api/home.prizes` 9 条全 listed；draft 详情 `/api/prize/1`、`/api/prize/22` 仍 **200 / 46 键可读**（`getBrandById` 未被误伤） |
| AC3 6 列断点 | PASS | computed `gridTemplateColumns` 轨道数 390=**2** / 1024=**4** / 1280=**6** / 1440=**6** / 1536=**6** / 1920=**6**；日/夜逐档相等；网格 = `sf-grid sf-feed`，商品网格不再用 `ResponsiveGrid`（HomePage 零 `innerWidth`/`matchMedia` 读数） |
| AC4 容器 1536 | PASS | 1920 档容器实宽 **1536**、`left=192` ⇒ 居中；12 行 `scrollWidth−clientWidth = 0`；`--sf-st-shell-max-w` computed 全档 **1536px**；PROV 回读 `style-preview.html:1180` 命中 `max-width:1536px` |
| AC5 门套 | PASS | build exit 0（`✓ built in 1.81s`）；`test:unit` **61 文件 / 583 例**全过；backend `tsc --noEmit` **exit 0 / 零诊断**；`p7b-03` **37/37**、`AC10-2` pass、regs=**110**；`theme-tokens`+`theme-shell-isomorphism` **2 文件 33 例**绿；`shell.css` `@media` 仍只 1 块且为 767 |
| AC6 回归 | PASS | `/api/home` 键集未变（`claimed_prize_ids/is_authenticated/prizes/tasks/user_points`）；`/api/prize/:id` 行键 **46**；`/api/currencies` **2** 行；`/api/media/999` **404**；`/`、`/item/1`、`/task` 三页 `#root` 非空、零 pageerror、零 console error、零横向溢出 |

## 逐条读数与判据

### AC1 · 分页（真后端两档 + 三套夹具 + 失败臂）

`readings/probe-paging.json`、`readings/probe-paging-retry.json`

| 臂 | 视口 | 首屏卡 | 卡数演进 | skip 序列 | 终态 |
|---|---|---|---|---|---|
| real | 390×844 | 9 | 9 | 0（+StrictMode 重发） | distinct 9、`feed-end` 在场、无 `feed-loading` |
| real | 1440×900 | 9 | 9 | 0（同上） | 同上 |
| paged-a | 390 / 1440 | 36 | **36→72→80** | **0→36→72** | distinct 80、重复 0、`feed-end`、无 loading |
| paged-b | 390 / 1440 | 36 | **36→70→80** | 0→36→72 | distinct 80（82 交付 − 2 重复） |
| slow-600ms | 1440 | 36 | 36→72→80 | 0→36→72 | `feed-loading` 命中 8 次采样（文案「加载中...」）、落地后**零残留** |
| retry-once | 1440 | 36 | 36→(失败停)→72→80 | 0→36→**36(重试)**→72 | 失败即停、`feed-retry` 在场、2.5s 内无自动重试、点击后复用 skip=36、终态 80 + `feed-end` |

判据与自证：
- **「有下一页」不是靠类名判的**：卡数取自 `[data-sf-m="feed-grid"] [data-sf-m="reward-card"]` 实际 DOM 数，重复 bID 取自卡片 `href` 的 `/item/<id>`；`distinct == cards` 逐臂成立。
- **去重不是空判**：paged-b 的 82 条交付行只渲染 80 张卡（少 2），与夹具设计的 2 行重叠逐位对应 ⇒ 去重逻辑真在跑，不是「夹具恰好无重复」。
- **加载态不是空判**：slow 臂把每页延迟到 600ms 后，`feed-loading` 在 8 次采样中现身、终态清零 ⇒ 「无残留」是对「曾出现」的否定，而不是恒 false 的无效读数。
- **失败即停口径成立**：500 后 `feed-error`+`feed-retry` 同时在场、卡数停在 36；等 2.5s 后 skip=36 的请求计数仍为 **1**（无自动重试），点重试后变 2 且成功 ⇒ 「复用同一 skip」逐字成立。

### AC2 · 只列 listed（含详情不误伤）

`readings/api-db.json`

- DB（`current_setting('neon.project_id') = quiet-math-65207667` 自证）：26 行，`{draft:15, delisted:2, listed:9}`；listed = `[13,14,15,18,19,23,24,71,76]`。
- `/api/prize/all?skip=0&limit=36`：9 行，bID = `[76,71,24,23,19,18,15,14,13]`；`set_equals_listed = true`（双向逐项），`draft_or_delisted_leaked = []`。
- 分页语义：`skip=36` 返回 **0** 行 ⇒ 「某页 <36 即终止」在真网络下也成立（dev 只有 9 行 listed）。
- `/api/home?task_limit=6&prize_limit=20`：`prizes` 9 条，全为 listed（`prizes_all_listed = true`）；`tasks` 6 条。
- 详情未被误伤：`/api/prize/1`（draft）、`/api/prize/22`（draft）均 `success=true`、**46 键**；`/api/prize/76`（listed）同样 46 键 ⇒ 过滤只落在 `listBrands`。

### AC3 · 6 列断点

`readings/probe-layout.json`（12 行 = 6 宽度 × 日/夜）

| 宽度 | 期望 | 日档 | 夜档 | 单卡宽 | 容器宽 |
|---|---|---|---|---|---|
| 390 | 2 | 2 | 2 | 164.5 | 390 |
| 1024 | 4 | 4 | 4 | 218 | 1024 |
| 1280（边界） | 6 | 6 | 6 | 182.66 | 1280 |
| 1440 | 6 | 6 | 6 | 209.33 | 1440 |
| 1536 | 6 | 6 | 6 | 225.33 | 1536 |
| 1920 | 6 | 6 | 6 | 225.33 | **1536** |

列数一律由 `getComputedStyle(grid).gridTemplateColumns` 的轨道数数出（不读类名）；网格类 = `sf-grid sf-feed`；`HomePage.jsx` 内 `innerWidth`/`matchMedia` 仅出现在注释（说明「不读」），商品网格已离开 `ResponsiveGrid`。12 行零 pageerror / 零 console error。

### AC4 · 容器 1536

- 1920 档：容器 `max-width` 生效实宽 **1536.00**，`left = 192` = `(1920−1536)/2` ⇒ 居中。
- 溢出：12 行 `documentElement.scrollWidth − clientWidth = 0`。
- token：`--sf-st-shell-max-w` computed = **1536px**（全档）；`theme-tokens.css` 真值 `1536px`；`tokens.js` STRUCT `1536px`。
- PROV 回读（`readings/prov-readback.json`）：`style-preview.html:1180` 含 `max-width:1536px`；`feed-cols` 日档 `:115`、夜档 `:1182` 均含 `repeat(4,minmax(0,1fr))`，四条指针全部命中。
- 产物侧：`frontend/dist/assets/index-bzxNYmoV.css` 实测含 `@media (min-width:1280px){.sf-feed{grid-template-columns:repeat(6,minmax(0,1fr))}}` 与 `--sf-st-shell-max-w:1536px` ⇒ 规则真进了打包产物，不只是 dev 生效。

### AC5 · 门套

| 门 | 读数 | 证据 |
|---|---|---|
| `frontend build` | exit 0，`✓ built in 1.81s` | `readings/build.log` |
| `test:unit` | 61 文件 / 583 例，0 failed | `readings/test-unit.log` |
| `backend-ts tsc --noEmit` | exit 0，零诊断（日志仅 1 行 `TSC_EXIT=0`） | `readings/tsc-noemit.log` |
| `p7b-03` | 37/37 passed、failed 0、`red: []`；`AC10-2`（regs=110）pass | `readings/p7b-03.log`、`readings/p7b-03-offline-gates.json` |
| regs 现取 | 110 = get 49 / post 57 / put 0 / delete 3 / patch 1 | 脚本现算（`aggregate-verdict.py`） |
| theme 双门 | `theme-tokens` + `theme-shell-isomorphism` 2 文件 / 33 例，exit 0 | `readings/gates-theme.log` |
| `shell.css` 断点块 | `@media` 恰 1 个且为 `(max-width: 767px)` | 脚本现取 |

### AC6 · 回归

- `/api/home` 载荷键集 = `claimed_prize_ids / is_authenticated / prizes / tasks / user_points`（与派单期望逐字相同，`key_set_unchanged = true`）。
- `/api/prize/76` 行键 **46**（与上一轮口径一致；`/api/prize/all` 行键 45 为列表口径，属既有差异，非本单引入）。
- `/api/currencies` 2 行（`$` cid=1、BTTC cid=399）。
- `/api/media/999` → **404**。
- `/`（root 48474 字符）、`/item/1`（14537）、`/task`（109022）三页零 pageerror、零 console error、`scrollWidth−clientWidth = 0`。

## 三栏

**① 与实现方自报的差异**
- 分页多页行为无法用真后端复现（dev listed=9），实现方报告中的「真浏览器四臂 PASS」用的是同一套拦截夹具，本检复现并补齐了它的算术：第 2 页含 2 行重复时卡数应为 **70** 而非 72；本检用两套夹具分别给出 36→72→80（重叠在 2↔3 页边界）与 36→70→80（重叠在 1↔2 页边界），两种口径都登记在 `verdict.json.ruler_notes`。
- 其余读数（门套、列数、容器宽、只列 listed）与自报一致，无口径更正。

**② 未证项**
- 无 `NOT_MEASURED`。夜档「feed-cols 3→4」在结构上是**单值 token**（`theme-tokens.css` 只有一个 `:root` 块、无 per-theme 结构值），故「日夜一致」以六宽度逐档相等取证，而非比对两档不同取值。

**③ 环境噪声 / 已知披露**
- 真网络下第 2 页只能为空（listed=9 < 36），分页多页行为**只能**以 `context.route` 夹具取证 —— 已在探针头注释与 verdict 中披露。
- `React.StrictMode` 使首屏 `skip=0` 双发，首条 `net::ERR_ABORTED`；所有臂原始请求序列均为 `[0,0,...]`，去重后 `[0,...]`，不影响卡数/游标/终止判据。
- dev 库为多会话共用；本检**零写库**（只读 SELECT + HTTP GET）。

## 产物清单

- `verdict.json` —— 6 条 AC 的判定 + 逐项 check 布尔 + 尺子备注（由 `aggregate-verdict.py` 从读数算出）
- `REPORT.md` —— 本文件
- `probe-batch-1019-3.mjs` —— 分页三臂（real / paged-a / paged-b）+ 布局 12 行 + 三路由
- `probe-paging-retry.mjs` —— loading 瞬态臂 + 失败/重试臂
- `read-api-db.mjs` —— API ↔ DB 集合对拍、home 键集、详情键数、currencies、media
- `aggregate-verdict.py` —— 读数 → verdict 聚合（含 regs 现取、shell.css 断点块现取）
- `readings/`：`probe-paging.json`、`probe-paging-retry.json`、`probe-layout.json`、`probe-routes.json`、`api-db.json`、`prov-readback.json`、`p7b-03-offline-gates.json`、`build.log`、`test-unit.log`、`tsc-noemit.log`、`p7b-03.log`、`gates-theme.log`
