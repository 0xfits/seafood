# S32 · `sendError` 同族（偏离 D）R107 码映射可行性 · 收口报告（`s32-senderror-r107-migration`）

> **角色**：Kong（实现方）｜**台账**：B5 下半 · `route-layer.spec` §15.5 **偏离 D**（`sendError` 同族**旧形状** `{success:false,message,error}`）
> **本单边界（逐字照派单）**：**先交「码映射可行性表」**（第一步 = 交付物）；**本单先不据此改代码**；第二步（迁移「可借码」那批）**在第一步交回后**才做 ⇒ **本单未迁移**（见 §2）。
> **语言**：中文｜**原始输出**：无 `.log` 后缀｜**未 `commit` / 未 `push`**

---

## §0 开工态与对锚

| 项 | 读数（逐字） |
|---|---|
| `git log --oneline -3` | `86e3a33 fix(errors): S31+B5 上半 …` ／ `bbefbd9 docs: §5.349/v0.349 …` ／ `6b19af4 docs: §5.348/v0.348 …` |
| `git rev-parse HEAD` | `86e3a332788f5e2ed9f75e20baa05b7de6383dd4` = **S31 已入库那笔** ✓ |
| `git status --porcelain`（tracked） | **空**（仅 `??` untracked 历史 artifact 目录）⇒ 工作树**干净** ✓ |
| 被检件 `backend-ts/src/index.ts` sha16（`git hash-object`） | `2295618d24d594f6466114d8fa501174a3be38c8` |
| 同上 vs `HEAD:backend-ts/src/index.ts` | **逐字相同**（同 sha）⇒ 开工 / 收尾均零改动 ✓ |
| 码闭集真源 | `backend-ts/src/ledger-errors.ts:31-73`（`LEDGER_ERROR_TABLE` **33**）+ `:90-93`（`AUTH_ERROR_MESSAGES` **2**） |

**现取口径（`sendError` 定义与计数）**：

- 定义 = `backend-ts/src/index.ts:152-156`：`res.status(statusCode).json({ success:false, message, error:message })` ⇒ **旧形状（非 R107）**。
- `grep -c 'sendError('  backend-ts/src/index.ts` = **50**（含注释）。
- 剔除 **25 行**注释行 ⇒ **实调用 = 25 处**（脚本判定，见 §3）。

> **★ 与册内「26 处」的差异（本单必报）**：册内 §15.5 D 行「26 处实调用」系 **历史快照**（时点 sha256 = `c4db3627…` / `9b90bed4…`；口径 = 转引 `docs/audit/p7-a-ledger-read-fix2.md §5`，其布局 = `1575` / `2060` 行）。**现取 = 25 处**，**差异恰 1 处**：册内第 18 行 `POST /api/admin/settings` 的 `error.message` 回显面（旧 `:1168`）**已在后续批次改走 `sendVerbError` / `adminVerbError`**（现 `:1792` 注释自陈「修前本 catch 硬编码 `sendError(res, 400, …)` 旧形状」，现 `:1793` = `return sendInfraMapped(...)`）⇒ **该面已非 `sendError` 同族**。⇒ 现取清单 = **25 处**（本报告一律用**现取行号 / 计数**）。

---

## §1 ★ 码映射可行性表（**逐处 · 25 处实调用** · 本单**主交付物**）

**判定总则（写死）**：
- ✅ **可借** = 存在**既有码**（33 闭集 或 `AUTH_*` 域，**均冻结、不得新增**），其**规范 status == 现 status**（R105 码↔status 冻结）**且**语义相符 **且**本仓**已有先例**（哪个已注册路由 / 哪次改动借过同一码）⇒ **可迁移**。
- ⚠️ **status 冲突** = 存在语义相符的既有码，但**其规范 status ≠ 现 status** ⇒ 借码**必改 status**，与派单「status 不变」硬口径冲突 ⇒ **本单不迁，交终审裁定**。
- ⚠️ **借通路** = 该面是 **IO catch**，本仓对同族面的**既定收口 = 借既有 §14 分类器通路**（非单码）⇒ 迁移后 status **由分类器决定**（非固定）⇒ 交终审。
- ❌ **无合适码** = 闭集 33 + `AUTH_*` 域内**无**语义相符的码（凭据面 / 非金额形状面 / 配置面）⇒ **保留 `sendError` + 逐条登记**（**严禁硬造码**）。

| # | 文件:行 | 路由（注册行 · 方法 路径） | status | message（逐字） | 可借码判定 + **先例出处** | 结论 |
|--:|---|---|--:|---|---|---|
| 1 | `index.ts:454` | `:453` · POST `/api/auth/register` | 410 | `'Registration has moved to wallet sign-in plus profile completion'` | **无合适码**：`AUTH_*` 域只有 401/403 两码，**无 410**；借 `LEDGER_REF_NOT_FOUND`（410 先例 `:2405/:2427`）会把「已迁移到钱包登录」的弃用面标成「引用对象不存在」⇒ i18n 文案不符 | ❌ **保留 + 登记** |
| 2 | `index.ts:462` | `:457` · POST `/api/auth/challenge` | 400 | `error instanceof Error ? error.message : 'Failed to create auth challenge'` | **无合适码**：非金额形状面（`evm_address` 格式）⇒ 闭集内无通用 400 码（`LEDGER_AMOUNT_INVALID` 语义 = 金额格式） | ❌ **保留 + 登记**（另：**回显 `error.message`** 违规，登记） |
| 3 | `index.ts:484` | `:466` · POST `/api/auth/verify`（凭据段 catch） | 401 | `error instanceof Error ? error.message : 'Failed to verify auth challenge'` | ✅ **可借 `AUTH_UNAUTHORIZED`**（401）｜**先例** = 同文件 `sendAuthError`（`:292-300`，经 `:312` `requireActor` 无条件 401 凭据失败）+ `ledger-errors.ts:91` 句 + `errorMessageOf:109-110` | ✅ **可迁移**（顺带消除 `error.message` 回显） |
| 4 | `index.ts:567` | `:563` · GET `/api/task/:tID` | 400 | `'Invalid tID'` | ⚠️ **status 冲突**：语义相符码 = `LEDGER_REF_NOT_FOUND`，但**其规范 status = 404**（先例 `sendRefNotFound:2302-2305` + §3.1 C1 口径「非数字或缺失 id ⇒ **404**」）；借码 ⇒ 400→404 | ⚠️ **交终审**（保留） |
| 5 | `index.ts:596` | `:592` · GET `/api/prize/:bID` | 400 | `'Invalid bID'` | ⚠️ **status 冲突**（同 #4） | ⚠️ **交终审**（保留） |
| 6 | `index.ts:601` | `:592` · GET `/api/prize/:bID` | 404 | `'Prize not found'` | ✅ **可借 `LEDGER_REF_NOT_FOUND`**（404）｜**先例** = `sendRefNotFound:2301-2305`（`ref_type ∈ {job,endpoint,listing,job_submission}` 均已借用；§3.1 三类 404）｜details `{ref_type:'prize', ref_id, reason}` | ✅ **可迁移** |
| 7 | `index.ts:635` | `:629` · POST `/api/user/profile` | 400 | `'bio is required'` | **无合适码**：缺失字段（非金额）⇒ 闭集无通用 400 码 | ❌ **保留 + 登记** |
| 8 | `index.ts:641` | `:629` · POST `/api/user/profile` | 404 | `'User not found'` | ✅ **可借 `LEDGER_REF_NOT_FOUND`**（404）｜**先例** = `sendRefNotFound:2301-2305`｜details `{ref_type:'user', ref_id, reason:'user_not_found'}` | ✅ **可迁移** |
| 9 | `index.ts:661` | `:657` · GET `/api/user/asset/:uID` | 400 | `'Invalid user ID'` | ⚠️ **status 冲突**（同 #4） | ⚠️ **交终审**（保留） |
| 10 | `index.ts:926` | `:912` · GET `/api/task-progress/:jID` | 400 | `'Invalid jID'` | ⚠️ **status 冲突**（同 #4） | ⚠️ **交终审**（保留） |
| 11 | `index.ts:935` | `:912` · GET `/api/task-progress/:jID` | 404 | `'Task progress not found'` | ✅ **可借 `LEDGER_REF_NOT_FOUND`**（404）｜**先例** = `sendRefNotFound:2301-2305`｜details `{ref_type:'task_progress', …}` | ✅ **可迁移** |
| 12 | `index.ts:961` | `:952` · POST `/api/task-progress/:identifier/submit` | 400 | `'Invalid task or task progress id'` | ⚠️ **status 冲突**（同 #4） | ⚠️ **交终审**（保留） |
| 13 | `index.ts:965` | `:952` · POST `/api/task-progress/:identifier/submit` | 400 | `'info_input is required'` | **无合适码**：缺失字段（非金额） | ❌ **保留 + 登记** |
| 14 | `index.ts:1032` | `:1021` · GET `/api/shard`（IO catch） | 500 | `'Failed to load shard holdings'` | ⚠️ **借通路**：本仓 IO catch 既定收口 = **借既有 §14 分类器** `sendInfraMapped`（`index.ts:2347-2351`；**先例 30+ 处**：`:545/:559/:588/:610/:625/:653/:671/:805/:876/:892/:908/:943/:991/:1075/:1178/:1196/:1218/:1275/:1294/:1315/:1363/:1793/:1820/:3025`）⇒ 迁移后 code/status **由分类器定**（defect ⇒ 500 `LEDGER_TRANSACTION_REQUIRED`；infra ⇒ 503 `LEDGER_TX_TIMEOUT`），**非固定 500** | ⚠️ **交终审**（保留；本处其实是 D1' 同族漏网面） |
| 15 | `index.ts:1047` | `:1036` · GET `/api/shard/transfer`（IO catch） | 500 | `'Failed to load shard transfers'` | ⚠️ **借通路**（同 #14） | ⚠️ **交终审**（保留） |
| 16 | `index.ts:1168` | `:1165` · GET `/api/market/:bID/orderbook` | 400 | `'Invalid bID'` | ⚠️ **status 冲突**（同 #4） | ⚠️ **交终审**（保留） |
| 17 | `index.ts:1185` | `:1182` · GET `/api/market/:bID/trades` | 400 | `'Invalid bID'` | ⚠️ **status 冲突**（同 #4） | ⚠️ **交终审**（保留） |
| 18 | `index.ts:1850` | `:1824` · POST `/api/admin/permissions/save` | 400 | `error instanceof Error ? error.message : 'Failed to save permission group'` | **无合适码**：非金额形状面（权限组字段）⇒ 闭集无通用 400 码 | ❌ **保留 + 登记**（另：回显 `error.message` 违规） |
| 19 | `index.ts:1872` | `:1854` · POST `/api/admin/permissions/delete` | 400 | `error instanceof Error ? error.message : 'Failed to delete permission group'` | **无合适码**（同 #18） | ❌ **保留 + 登记**（回显违规） |
| 20 | `index.ts:1894` | `:1876` · POST `/api/admin/user/update` | 400 | `error instanceof Error ? error.message : 'Failed to update user'` | **无合适码**（同 #18） | ❌ **保留 + 登记**（回显违规） |
| **21** | **`index.ts:2116`** | **`:2106` · POST `/api/admin/points/adjust`** | **400** | **`'参数不完整'`**（硬编码中文） | ✅ **可借 `LEDGER_AMOUNT_INVALID`**（400）｜**先例 = 同路由**：`:2124`（`REASON_CODE_NOT_IN_ENUM`）/ `:2145`（`NOT_A_POSITIVE_INTEGER`）/ `:2153`（`OVER_MAX_SINGLE_AMOUNT`）均 `ledgerErrorBody('LEDGER_AMOUNT_INVALID','Request shape is invalid',{field,reason})`；`:2121` 注释逐字「零新增错误码 ⇒ 借既有码 `LEDGER_AMOUNT_INVALID`（#17）+ R107 形状」；`reason` 词表冻结见 `route-layer.spec:4052`（§5.16：`{NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}`） | ✅ **可迁移**（★ §15.1① 点名项：**同端点 400 类形状必须唯一**；details 需按 `field ∈ {uID,amount,reason}` 三分派 — **交终审**） |
| 22 | `index.ts:2452` | `:2443` · POST `/api/job/:jobId/submit` | 400 | `'info_input is required'` | **无合适码**：缺失字段（非金额） | ❌ **保留 + 登记** |
| 23 | `index.ts:2975` | `:2972` · POST `/api/translate/backfill` | 503 | `'CRON_SECRET not configured'` | **无合适码**：配置缺失面；`LEDGER_TX_TIMEOUT`（503）语义 = 「系统繁忙」（不符），`LEDGER_FEE_RATE_INVALID`（500）status 不符 | ❌ **保留 + 登记** |
| 24 | `index.ts:2981` | `:2972` · POST `/api/translate/backfill` | 401 | `'Unauthorized'` | ✅ **可借 `AUTH_UNAUTHORIZED`**（401）｜**先例** = `sendAuthError:292-300` + `ledger-errors.ts:91`（CRON secret 校验失败 = 鉴权失败，语义一致） | ✅ **可迁移** |
| 25 | `index.ts:3030` | （`app.use` 兜底 · **非注册路由**） | 404 | `'Not found'` | ✅ **可借 `LEDGER_REF_NOT_FOUND`**（404）｜**先例** = `sendRefNotFound:2301-2305`（`ref_type='endpoint'` 已用于 410 弃用面 `:2409/:2431`）｜details `{ref_type:'endpoint', ref_id:req.path, reason:'route_not_found'}` | ✅ **可迁移** |

**汇总计数**：✅ 可迁移 = **7 处**（#3 / #6 / #8 / #11 / #21 / #24 / #25）｜⚠️ 借通路 = **2 处**（#14 / #15）｜⚠️ status 冲突 = **7 处**（#4 / #5 / #9 / #10 / #12 / #16 / #17）｜❌ 无合适码 = **9 处**（#1 / #2 / #7 / #13 / #18 / #19 / #20 / #22 / #23）｜合计 **25** ✓

**★ 三条硬结论（交终审）**：
1. **严禁新增码**下，「可借码」批 = **7 处**（不是 26 处全部）——其余 18 处**均无 status-相容的既有码**。
2. **7 处 `status 冲突`** 的根因 = 本仓**两套 id 口径并存**：旧 `sendError(res,400,'Invalid <id>')` vs §3.1 C1 冻结口径「非数字 / 缺失 id ⇒ **404** `LEDGER_REF_NOT_FOUND`」。**统一到 404 会改 status**（违「status 不变」）⇒ **请终审裁定**是「保 400 现状」还是「按 §3.1 C1 前推为 404」。
3. **2 处 shard IO catch**（#14 / #15）是 **D1' 同族漏网面**（其他 30+ 处同族 catch 已走 `sendInfraMapped`）⇒ 正确动作是**借分类器通路**而非借单码；**其 status 会随分类器变**（500→503 for infra）⇒ 亦**请终审**。

---

## §2 迁移（第二步）执行情况

> **本单未迁移**（**0 行** `backend-ts/**` 代码改动；`git status --porcelain` tracked = 空）。**依据** = 派单「**本单先不据此改代码，先把表交回**」+「第二步（在第一步交回后、若迭代预算允许才做）」⇒ **本单只交表**（与派单末条「完整交回一张表比交回半迁移更有价值」一致）。

**前端消费面预取（供迁移批裁决；**未改 `frontend/**`**，仅读）**：R107 形状**无顶层 `success` 键**，故迁移前须确认消费方对「无 `success`」与「`error` 变对象」的容忍度。现取读数：

| 消费面 | 现取读数（`grep`） | 判定 |
|---|---|---|
| 顶层 `success` 布尔 | `frontend/src/auth.js:351` / `ledger-api.js:48` / `bttc-api.js:30` / `batt-checkin.js:31,41,56,72` / `rating-timeliness.js:24` 均 `if (!response.ok \|\| !payload?.success) throw …` | **兼容**：`!undefined === true` ⇒ R107（无 `success`）**仍被判为错误**（方向一致） |
| `payload.error` 变对象 | `auth.js:109` `payload?.error && typeof payload.error === 'object' ? payload.error.code : undefined`；`auth.js:206-207`（`extractApiErrorMessage` 取 `payload?.error`）；`auth.js:330` | **兼容**：前端**已按对象/字符串双形态**处理 `error`（旧形状 `error` = string；R107 `error` = `{code,message,i18n_key,details}`）⇒ 迁移**不改前端**即可消费 |
| 文案链（§16.1 四跳） | `auth.js:264-279`（`t(i18n_key)` → 服务端原文 → 兜底 → ASCII） | 迁移后 `i18n_key` 命中 ①`t(i18n_key)` ⇒ **本地化真源生效**（`ledger.err.<CODE>` / `auth.err.<CODE>` 四语键已在） |

⇒ **7 处「可迁移」批对前端无破坏性依赖**（消费方已双形态；`success` 缺失方向一致）。**最终 frontend 逐处 `grep` 复取留待迁移批**（本单未改前端，故不预判）。

---

## §3 类级断言（读数）

探针：`backend-ts/scripts/s32-00-senderror-inventory.ts`（离线 · 零 DB · 零 HTTP）｜首跑产物 `.s32-artifacts/s32-20261005T001054Z/s32-00-senderror-inventory.json`

| 断言 | 口径 | 现取读数（`before` 基线） | 迁移后值 |
|---|---|---|---|
| **① `sendError` 实调用数**（剔注释） | `grep -c` = 50 − 注释行 25 | **25**（`real_calls=25`） | **NOT_MEASURED**（本单未迁移；若迁 7 处 ⇒ 预期 **18**） |
| **② 新增码** | `LEDGER_*` == 33 **且** `AUTH_*` == 2 | **0 新增**（`ledger=33 auth=2`） | **0**（本单未迁 ⇒ 不动） |
| **③ `message` 命中机读码** | 逐处 `sendError` message 字面量 ∉ 全大写下划线码 | **0**（`hits=0`） | **0**（若按表迁移，message 一律英文句 ⇒ 仍 0） |
| C4 注册点 | `grep -cE '^app\.(get\|post\|…)\('` | **89**（`registration_points=89`） | 89（本单不动路由） |
| C5 计数完整性 | 命中行 = 实调用 + 注释行 = 50 | **25 + 25 = 50** ✓ | — |

**探针 `SUMMARY total=5 passed=5 failed=0`（EXIT=0）** ✓

---

## §4 全量门对照（**11 门 + `p7b-03`**）

**口径**：本单 **零代码改动** ⇒ 前 / 后 = **同一态**（`src/index.ts` sha 恒 `2295618d…`）。**带实例 HTTP 腿**目标实例（`P8S7_BASE`=5797 / `P8S10_BASE`=5796，见脚本头注）**本机未运行**（`lsof` 仅 5787 / 5788 在场，属**他单**，**本单未启停**）⇒ HTTP 腿预期为**环境性 `fetch failed`**。
**运行器**：`backend-ts/.s32-artifacts/run_gates.sh`（复刻 S31 口径；`npx ts-node --transpile-only`）｜产物 `.s32-artifacts/<runid>/before/`。

| 门 | 本单 `before`（现取） | 参照：S31b `after`（`86e3a33` 前一笔） | 对照 | 红点分流 |
|---|---|---|---|---|
| `p8-s1-app-config` | **24/24** EXIT 0 | 24/24 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s2-fee-rebate` | **44/44** EXIT 0 | 44/44 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s3-deposit` | **45/45** EXIT 0 | 45/45 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s3b-address` | **38/38** EXIT 0 | 38/38 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s4-currency-review` | **79/79** EXIT 0 | 79/79 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s5-compliance` | **117/117** EXIT 0 | 117/117 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s6-site-text` | **64/64** EXIT 0 | 64/64 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s7-batt-checkin` | **56/59** EXIT 1（`db=7 http=1`） | 56/59 EXIT 1（`db=7 http=1`） | 逐字一致 ✓ | **3 红 = 环境性 HTTP 腿**（`fetch failed`；实例 5797 未运行）——**非真回归** |
| `p8-s8-rating-timeliness` | **89/92** EXIT 1（`db=13 http=1`） | 89/92 EXIT 1（`db=13 http=1`） | 逐字一致 ✓ | **3 红 = 环境性 HTTP 腿**（`fetch failed`）——**非真回归** |
| `p8-s9-bttc` | **100/100** EXIT 0（`db=10`） | 100/100 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s10-invite-reward` | **48/49** EXIT 1（`db=3`） | 48/49 EXIT 1（`db=3`） | 逐字一致 ✓ | **1 红 = 环境性 HTTP 腿**（`fetch failed`；实例 5796 未运行）——**非真回归** |
| `p8-s11-audit-console` | **86/87** EXIT 1（`db=6`） | 86/87 EXIT 1（`db=6`） | 逐字一致 ✓ | **1 红 = 环境性 HTTP 腿**（`fetch failed`）——**非真回归** |
| `p7b-03-offline-gates` | **37/37** EXIT 0（`red=[]`） | 37/37 EXIT 0 | 逐字一致 ✓ | —（含 `AC10-1` 码闭集 33 ✓ · `AC10-2` 注册点 89 ✓） |
| **合计** | **11 门 + `p7b-03` 全跑**；红 = **8 条 HTTP 腿**（s7×3 / s8×3 / s10×1 / s11×1） | 同左（8 条环境性 HTTP 腿） | **11/11 门逐字不变、零连带** ✓ | **8 红全为环境性 http 腿（`fetch failed`）· 真回归 = 0** |

> **`before` = `after` 的依据**：本单 `backend-ts/**` 代码改动 = **0 行**（`git hash-object src/index.ts` 开工/收尾同为 `2295618d…`）⇒ 门面**同一态**，无需重跑「after」（重跑亦逐字同读数）。**未启用受控实例**（他单 5787/5788 未触碰）⇒ 8 条 http 腿按 S31b 同口径**环境性红**。

---

## §5 判负（红 → 绿）

**判据** = 类级断言 ③（`sendError` message 命中机读码 == 0）。**变异只施加在仓内副本**（不碰 `src/index.ts`）：

- 副本：`.s32-artifacts/s32-20261005T001054Z/negctl/index.NEG.ts`（`cp` 自 `src/index.ts`，改 **1 处**：`:2116` `'参数不完整'` → `'LEDGER_AMOUNT_INVALID'`，**旧病形态：把码塞进 message**）。
- **NEG（必红）**：`S32_TARGET=…/index.NEG.ts` ⇒ `C3 pass=false hits=1 [{"line":2116,"token":"LEDGER_AMOUNT_INVALID"}]`，**EXIT=1** ✓
- **GREEN（复原回绿）**：`S32_TARGET=src/index.ts` ⇒ `C3 pass=true hits=0` ✓（`src/index.ts` sha 恒 `2295618d…`，**从未被变异**）
- **内存自判负** `--selftest` ⇒ `NEG1`(码入 message)=红 · `NEG2`(闭集 34)=红 · `GREEN`(英文句)=绿 ⇒ `SELFTEST PASS`（EXIT=0）

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因（逐字） |
|---|---|---|
| 第二步迁移（7 处「可迁移」批的代码改动 / 前后 JSON 逐字对照） | **未做** | 派单「**本单先不据此改代码，先把表交回**」⇒ **本单只交表** |
| 迁移后类级断言 ①②③ | `NOT_MEASURED` | 本单未迁移 ⇒ 无「迁移后」态；仅给 `before` 基线（§3） |
| 7 处「status 冲突」/ 2 处「借通路」的 status 前推 | **未裁定** | 与「status 不变」硬口径冲突 ⇒ **交终审**（§1 硬结论 2/3） |
| 前端消费面**逐处** `grep`（迁移批要求） | **未做** | 属第二步（迁移批）；本单只给**类级**预取读取（§2） |
| 带实例 HTTP 腿（s7/s8/s10/s11 中依赖 5796/5797 的腿） | 环境性未覆盖 | 受控实例未运行（他单 5787/5788 未触碰）⇒ `fetch failed`，**非真回归**（见 §4） |
| DB 侧 / 库面行为 | `NOT_MEASURED` | 本单零代码改动、零库面变更 ⇒ 不重跑库面探针 |

---

## §7 自曝

1. **★ 计数勘误（不冒从派单）**：派单引「26 处实调用」⇒ **现取 = 25 处**。差异 = 册内第 18 行 `POST /api/admin/settings` 回显面**已迁走**（现 `:1793` = `sendInfraMapped`）；**册内「50 行命中 ⇒ 剔 24 注释行 = 26」的注释行现取 = 25**（`grep -c` 仍 50）。⇒ 本报告一律用**现取行号 / 计数**（`git hash-object src/index.ts` = `2295618d…` 对锚）。
2. **探针路由归属的一处已知偏差**：`:3030`（`app.use` 兜底 404）**非注册路由**，探针的「最近注册路由」回填为 `POST /api/translate/backfill`（`:2972`）⇒ 表中 #25 已**人工订正**为「`app.use` 兜底 · 非注册路由」；探针类级断言 C1–C5 **不依赖**该归属，故不改探针。
3. **未跑 `p7b-03` 之外的套件**：本单按「11 门 + `p7b-03`」口径跑全量门；**前端套件 / Playwright e2e / `tsc -p tsconfig.scripts.json`** 未跑（本单不改前端、不增脚本面 ⇒ 依硬门口径非本单面）。
4. **判负副本复用真仓 `node_modules`**：为免复制依赖，副本仅 `src/index.ts` 被 `cp`+变异；**主工作区被检件零污染**（`git hash-object` 开工/收尾同为 `2295618d…`、`git status` tracked 空）。
5. **未触碰**：`frontend/**` / `migrations/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`；**无 `npm install`** / **未碰 `.env*`** / **未用 `pkill -f`·`killall`** / **未 `commit`·`push`** / **未启停 5787·5788**。

---

### 附：本单产物路径（原始输出**无 `.log` 后缀**）

- **交付报告**：`docs/audit/s32-senderror-r107-migration.md`（本件）
- **产物目录**：`backend-ts/.s32-artifacts/s32-20261005T001054Z/`
  - 探针：`s32-00-senderror-inventory.json`（基线）/ `-neg.json` / `-green.json`
  - 判负副本：`negctl/index.NEG.ts`
  - 全量门：`before/<gate>.txt` + `before/_summary.txt`
  - 运行器：`../run_gates.sh` · `../CURRENT_RUNID`
- **探针脚本**：`backend-ts/scripts/s32-00-senderror-inventory.ts`
