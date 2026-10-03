# 批 8⑤（合规审核 · 商品 / 招工）修复收口 · 合规复核报告

- **报告路径**：`docs/audit/p8-s5-compliance-review.md`
- **角色 / 单号**：Kong（实现方）· 极小收口单（**只写本报告 + 末次 `git status` 归因**）
- **日期**：2026-10-03（CST）
- **上游依据**：`docs/seafood.master-plan.md` **§5.218**（`:1579-1601`，`R-9-9` 裁定与派单）· **§5.224**（`:4572`，修复单回执）· 本单派单口径
- **报告定位**：8⑤ 修复单的**收口复核件**。承上单已实测工件（`backend-ts/.p8s5-artifacts/**`）；本单**不重跑任何门 / 探针、不改一行代码 / 迁移 / spec、不 apply 迁移、不 `git add/commit/push`**。

---

## 0. 口径与取证时点

- **本单执行面**：只落盘本报告 + 执行一次 `git status --porcelain`（末次归因）。未改代码、未改迁移、未改 spec、未重跑门 / 探针、未 apply、未 `git add/commit/push`、未 `npm install`、未碰 / 打印 `.env*`、未 `pkill -f` / `killall`、未启实例。
- **本次现取时点**：2026-10-03 09:04 CST（本地）。
- **spec 现行版现取**：
  - `docs/route-layer.spec.md` = **v2.12**（6329 行 / 1,290,661 B / md5 `bdaec983d1bb06e955890a9b27e22afc`；与快照 `docs/versions/route-layer.spec.v2.12.md` **逐字节相同**）。
  - `docs/data-layer.spec.md` = **v0.19**（2871 行 / 585,357 B / md5 `fa698c0c8cd8ca45ac9f54272217bf81`）。
- **读数来源二分（不编造）**：
  1. **本次现取**：直接读取的源码 / 迁移 / spec 行号与字节（命令见各节）。
  2. **上单已实测工件**：`backend-ts/.p8s5-artifacts/**` 的 `gate.json`（离线门）、`real-chains.json`（DB 探针）、`http.json`（归属闸 HTTP 面）；以及 `master-plan` 回执（§5.218 / §5.224）。
- **未测项**：一律给原因，禁填数值 0 / 空（见 §9）。

---

## 1. `§28.6` ↔ `§25.1–§25.9` 逐条对应表

**节头行号（全部本次现取）**：

- `docs/route-layer.spec.md`（**现为 v2.12**，现行册）：
  `§25.1` = `:5770` · `§25.2` = `:5794` · `§25.3` = `:5809` · `§25.4` = `:5833` · `§25.5` = `:5845` · `§25.6` = `:5865` · `§25.7` = `:5895` · `§25.8` = `:5910` · `§25.9` = `:5932`
  （命令：`grep -nE "^#{2,6}.*25\." docs/route-layer.spec.md`）
- `docs/data-layer.spec.md`（**现为 v0.19**；`§28.6` 内容冻结于 **v0.17**）：
  `§28.6` = `:2318`

**`§28.6` 子项（data-layer · 现取行号）**：`(a)` 表名与迁移编号 `:2322` · `(b)` `0026` 九列 `:2333` · `(b′)` `0027` 九列 `:2347` · `(c)` 约束 `:2361` · `(d)` 索引 `:2376` · `(e)` append-only 与留痕列 `:2389` · `(f)` 时间列 `:2396` · `(g)` 骨架 `:2398` · `(h)` 锚点口径 `:2445`。

**逐条对应**：

| route `§25.x`（v2.12 现取节头） | 对应 `§28.6` 内容（data-layer `:2318` 起） | 对应子项 |
|---|---|---|
| **`§25.1`**（五条裁定 `R-8-23`..`R-8-27` 逐字入册 · `:5770`） | `R-8-23` 载体裁定的落点；`R-8-27` 迁移编号 = 本节 `(a)` | `(a)` |
| **`§25.2`**（4 路由读写口契约 / 闸 / `ops:` 键 / `data` 键集 · `:5794`） | `idempotency_key` 列语义 = `ops:<admin_uid>:listing_takedown:<listingId>` / `ops:<admin_uid>:job_arbitrate:<job_id>`；`txid` 列（商品恒 `NULL` / 招工非恒 `NULL`） | `(b)#6` / `(b′)#6` / `(b)#7` / `(b′)#7` |
| **`§25.3`**（通过 / 驳回 判负形 + 非法入参 ≥6 条 · `:5809`） | `result` 闭集 `CHECK (result IN ('approved','rejected'))`；驳回**必落台账** | `(c)#4` / `(c)#9` / `(e)` |
| **`§25.4`**（注册点 `71 → 75` 逐字登记 · `:5833`） | 迁移编号 `0026` / `0027` 与表名 | `(a)` |
| **`§25.5`**（权限键映射，`review_tasks` · `:5845`） | `actor_uid` 列（动作人 · token 侧） | `(b)#3` / `(b′)#3` |
| **`§25.6`**（归属闸契约形态 · `:5865`） | `actor_uid` 列注释「不得记成 seller / employer」；FK `actor_uid → users(uid)` | `(b)#3` / `(b′)#3` / `(c)#2` / `(c)#7` |
| **`§25.7`**（「真生效」四段判据 · `:5895`） | ②段库内落值 = 两台账表 + 两状态列（`listing.status` / `job.status`）+ 资金腿 | `(a)` / `(b)` / `(b′)` / `(g)` |
| **`§25.8`**（审计面与对账 · `:5910`） | 两台账 **9 列**结构与既有四表并联；`txid` 锚账口径 | `(b)` / `(b′)` / `(c)` / `(d)` |
| **`§25.9`**（后台页数据契约与四语文案面 · `:5932`） | 命名空间 `adminListingReview` / `adminArbitrationReview` 词根依据 | `(a)` 命名依据 |

---

## 2. 行号漂移表

**真源文件**：`backend-ts/src/index.ts`（现取 2404 行）。**位移由 8⑤ 在 `review` / `cancel` 两路由之前插入 4 条新路由 + 归属闸改写所致（+54）**。

| 路由 | 基线（改前） | 现取（改后） | 位移 | 现取坐实命令 |
|---|---|---|---|---|
| `POST /api/job/:jobId/review` | `:1884` | **`:1938`** | **+54** | `grep -nE "app\.(post\|get)\(.*review" backend-ts/src/index.ts` ⇒ `1938:app.post('/api/job/:jobId/review', …)` |
| `POST /api/job/:jobId/cancel` | `:1908` | **`:1962`** | **+54** | 同上 ⇒ `1962:app.post('/api/job/:jobId/cancel', …)` |

- 位移一致性：`1938 − 1884 = 54`；`1962 − 1908 = 54`（同步位移，插入点在两路由之前）。
- 基线值保留于 spec 与源码注释：`docs/route-layer.spec.md:5543/5544/5867/5778/5779`（引 `:1884` / `:1908`）与 `backend-ts/src/index.ts:1777`（注释仍记旧值）。

---

## 3. 两迁移 checksum 断言（file ↔ db 双对拍）

| 迁移 | 表 | 断言 sha256 | `file`（本次现取 `shasum -a 256`） | `db`（`real-chains.json.migration_assert`） |
|---|---|---|---|---|
| `0026_listing_review_log.sql` | `public.listing_review_log` | `3140366eabfdcc8375e71e1c8e0144323767245cf2e4fc4114687ba695f84e7b` | ✅ **逐字相符** | ✅ **逐字相符** |
| `0027_job_arbitration_log.sql` | `public.job_arbitration_log` | `8209df5a86879188f5a25583b69bd4e0002474f850767a7b411641bda17fd481` | ✅ **逐字相符** | ✅ **逐字相符** |

- **`schema_version` = `0027`** ✅ · **`base_tables` = `28`** ✅（皆现取自 `backend-ts/.p8s5-artifacts/p8s5-20261003T010008Z/real-chains.json`）。
- 文件字节：`0026` = 18070 B / 214 行；`0027` = 18573 B / 218 行（本次现取）。
- ⚠️ **本单未 apply 任何迁移**；apply 由 Zang 执行（迁移文件自带 apply-time 自检，见 §4(F) 与 §9）。

---

## 4. ★ 缺陷专章 `DEFECT-ARB-VERB-POST-STATE`

### (A) 现象与严重度
- **id**：`DEFECT-ARB-VERB-POST-STATE` · **severity**：`HIGH`。
- **现象**：招工仲裁动作口 `POST /api/admin/arbitration/:jobId` **首调误判 409** —— 库面**已生效**（`job.status` = `cancelled` / `settled`、台账 1 行、资金腿），但 verb 回执 `ok=false`。
- **影响**：真 HTTP 首调返回 409（客户端判失败），而状态 / 台账 / 资金腿**已在单事务内 COMMIT** ⇒ 重投命中 `prior_count` ⇒ 200 重放 ⇒ **「先 409 后 200」不一致**；`approve` 路径同病。

### (B) 根因两侧逐字（改前）
> 原文溯自 `real-chains.json`（`p8s5-20261003T003702Z` / `p8s5-20261003T004924Z`）的 `defects[0]` 逐字，与派单口径一致。

- **DB 侧（回执给的是「终态」）**：改前 `backend-ts/src/database.ts:2601` / `:2618` —— 回执键 `job_status` 承载 `finalStatus`（**终态**）。
  - 工件逐字锚：`"backend-ts/src/database.ts:2618（job_status: finalStatus —— 回执给的是**终态**）"`。
- **服务层（误把「终态」当「前置态」判）**：改前 `backend-ts/src/compliance-review-service.ts:307` / `:321`。
  - `:307` —— `curStatus = row.job_status`（拿终态字段当前置态）；
  - `:321` —— `curStatus !== 'submitted' && curStatus !== 'disputed'` ⇒ `jobStateConflict` 409。
  - 工件逐字锚：`"backend-ts/src/compliance-review-service.ts:307（curStatus = row.job_status）"` / `"…:321（curStatus !== submitted && !== disputed ⇒ jobStateConflict 409）"`。
- **机理**：同一回执里，DB 写回的是**动作生效后的终态**（如 `cancelled`），服务层却按**动作前的可审态**（`submitted` / `disputed`）去判 ⇒ 首调必被判非法 ⇒ 409。属**投影层误读**（与 `C-2`「投影 ≠ 真源」同族）。

### (C) 复现（`real-chains.json` **58/60**）
- 改前 DB 探针读数（现取工件摘要）：

| 工件 | 总 / 过 / 失败 | 红点 |
|---|---|---|
| `p8s5-20261003T003449Z` | 60 / **54** / 6 | `A4.after_reason` · `B1.action_ok` · `B2.txid_anchors_ledger` · `B2.txid_ledger_rows_exist` · `B5.success_implies_log` · `B6.approve_txid_anchors` |
| `p8s5-20261003T003702Z` | 60 / **58** / 2 | `B1.action_ok` · `B5.success_implies_log` |
| `p8s5-20261003T004924Z` | 60 / **58** / 2 | `B1.action_ok` · `B5.success_implies_log` |
| `p8s5-20261003T005023Z` | 60 / **60** / 0 | —（修后） |

- **58/60 复现**：`B1.action_ok` 实际 = `{"ok":false}`（库已生效却回 `ok=false`）；`B5.success_implies_log` 实际 = `{"ok":false,"log_count":1}`（**台账 1 行已落、动作报失败**）。
- 工件内 `defects[0].repro` 逐字：`"tx 内 jobArbitrationPostEvent 成功（status=cancelled + 台账 + 退款腿×2）；arbitrateJobVerb 回 {ok:false, code:LEDGER_CURRENCY_INVALID_TRANSITION, status:409}"`。
- 修后 `defects` = `[]`（`p8s5-20261003T010008Z`）。

### (D) 修法四件（`R-9-9` · 逐字溯自 `master-plan:1592-1595`）
1. **回执补「前置态」字段**：`jobArbitrationPostEvent` 回执增加 **`prior_status`**（同一语句 / 同一事务内取前置态）；服务层判定改用 `prior_status`，**严禁**用终态字段做前置态判定。
2. **判定顺序钉死**：`prior_status ∉ {submitted, disputed}` ⇒ **409**（此时 `applied` 应为 0）；`applied = 1` ⇒ 成功；`applied = 0 ∧ prior_status ∈ 允许集` ⇒ **映射 DB 自己的拒绝原因**（**不得自造码**）。
3. **台账行只在动作真生效时落**（防「未生效却记账」的假台账）；先现取 DB 函数在「非法前置态」时是 `RAISE` 还是返回回执再定实现。
4. **同族扫面（类级）**：把三条动作口（`listing-takedown` / `job-arbitration` / `currency-review`(8④)）回执字段语义逐条核（见 §7）。

**落盘现取（本次读当前码）**：
- DB 回执**四处返回均含 `prior_status`**：`:2562`（未找到）· `:2575`（重放）· `:2580`（非可仲裁态）· `:2622`（成功，`prior_status: curStatus` + `job_status: finalStatus`）；`grep` 命中 `prior_status:` ≥ 4 处（门 `J1` 判据）。
- 服务层：`compliance-review-service.ts:309` 取 `row.prior_status`；`:326` 用 `priorStatus` 判；`:331` `applied > 0` ⇒ 成功（输出用 `finalStatus`）；`:338-341` `applied=0 ∧ 允许集` ⇒ 映射既有 409（`reviewed<1` 细分 `LEDGER_ROW_NOT_WRITTEN`）；`row.job_status` **仅剩 `:311`（供输出）**，**不再参与前置态判定**。

### (E) 门负对照（★ 门真能抓）
| 门 | 正向 | 负对照（把 `prior_status` 换回终态字段） | 红点 |
|---|---|---|---|
| **离线门**（`p8-s5-compliance-gate.ts`） | **117 / 117** | **117 → 113** | **`J2` · `J2b` · `J3` · `J4`** |
| **DB 探针**（`p8-s5-01-real-chains.ts`） | **69 / 69** | **69 → 66** | **`B1.action_ok` · `B5.success_implies_log` · `C1.first_call_200`** |

- 离线门 `J` 组判据（现取 `gate.json`）：`actionFirstCall` = 8 项 + `actionFirstCallSelfTest` = 2 项 = 10；`J2` = 取 `row.prior_status`（源码面）；`J2b` = 源码负对照（`prior_status → job_status` ⇒ 谓词必红）；`J3` = 首调（reject · 前置态 `submitted`）= 200 且 `view.status` = 终态 `cancelled`；`J4` = 首调（approve · 前置态 `disputed`）= 200 且 `settled`。
- 门总量 **103 → 117**：新增 `actionFamily` 4（`K1–K4`）+ `actionFirstCall` 8（`J1/J2/J2b/J3/J4/J5/J6/J7`）+ 自证 2 = **+14**。

### (F) `R-9-9③` 现取坐实（非法前置态 ⇒ 事务回滚、台账不落）
- **`ledger_raise` = `RAISE EXCEPTION`** @ `backend-ts/migrations/0004_ledger_post_event.sql:130-149`：函数体 `:137-143`（未映射码 ⇒ `ERRCODE='LD999'`）与 `:145-148`（`ERRCODE=v_state`）两处 `RAISE EXCEPTION USING` ⇒ 抛异常即**中止当前事务**。
- **`0013:609` 内联闸**：`job_post_event` 内 `:609 IF NOT public.job_status_transition_ok(v_job.status, v_to) THEN` ⇒ `:610 PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION', …)`（`reason=JOB_STATE_INVALID`）。
- **`job_status_guard` 触发器** @ `0013:120-131`：`BEFORE UPDATE` 上 `NEW.status IS DISTINCT FROM OLD.status` 且白名单不满足 ⇒ `:125 PERFORM public.ledger_raise(...)`（同一 `LD011` / `JOB_STATE_INVALID`）。
- ⇒ **非法前置态任何写路径都 `RAISE` ⇒ 事务整体回滚、台账不落**。
- **`:2577` 早退在 INSERT 前**：`jobArbitrationPostEvent` 对非可仲裁态在 `:2579-2581` **提前 return**（现取），而台账 `INSERT` 在 `:2609` ⇒ 「未生效即不落台账」有结构性判据。
- `assert`：离线门 `H`/`migration` 组对 `0026` / `0027` 的 append-only（`BEFORE UPDATE OR DELETE` 无条件 `RAISE`）与零 `time_updated` / `create_key` / `ledger_event_keys` 均有判据（`gate.json` `migration` 组 25 项 + 自证 2）。

---

## 5. 四段真链路读数（商品轴 + 招工轴）

现取工件：`backend-ts/.p8s5-artifacts/p8s5-20261003T010008Z/real-chains.json`（69/69 · 事务内取证 + `ROLLBACK`）。`§25.7` 四段 = ① 后台审 → ② 库内落值 → ③ 业务读口取数 → ④ 行为随之（含**改动前 / 改动后两读数**）。

### 5.1 商品轴（`takedown` · 路径 `POST /api/admin/listing/:listingId/takedown` · 闸 `requireAdmin(…,'review_tasks')`）
| 段 | 读数 |
|---|---|
| **① 后台审** | `{action:'approve', reason:'<reason>', target_status:'delisted'}` ⇒ 回执 `{ok:true, replay:false, view:{listing_id:'39', status:'delisted', result:'approved'}}` |
| **② 库内落值** | 台账 `public.listing_review_log` **恰 1 行**（`log_id=14` · `listing_id=39` · `actor_uid=1` · `result=approved` · **`txid=null`（商品无分录恒 NULL）** · `idempotency_key=ops:1:listing_takedown:39`）；状态列 `public.listing.status` = **`delisted`** |
| **③ 业务读口取数** | `database.ts:2445 listListingsForAdmin` ⇒ `status='delisted'` |
| **④ 行为随之（两读数）** | **改动前** = `{outcome:'accepted', purchasable:true, txid:'621'}` ⇄ **改动后** = `{outcome:'rejected', purchasable:false, code:'LEDGER_CURRENCY_INVALID_TRANSITION', reason:'listing_not_listed', httpStatus:409, raw_sqlstate:'LD011'}` ⇒ **商品不可购买**（两读数不同 ✅） |
| 驳回支 | `rejected` ⇒ 台账 1 行（`log_id=15` · `txid=null`），`listing.status` **不动 = `listed`**，驳回后商品**仍可购买**（`{outcome:'accepted', purchasable:true, txid:'623'}`）⇒ **驳回不得静默** ✅ |
| 回滚 | 哨兵 `SEG-GOODS` ⇒ `committed:false`（ROLLBACK） |

### 5.2 招工轴（仲裁 · 路径 `POST /api/admin/arbitration/:jobId` · 闸 `requireAdmin(…,'review_tasks')`）
| 段 | 读数 |
|---|---|
| **① 后台审** | `{action:'reject', reason:'<reason>'}`（jID 46）⇒ 回执 `{ok:true, replay:false, view:{job_id:'46', status:'cancelled', result:'rejected', txid:'629'}}` |
| **② 库内落值** | 台账 `public.job_arbitration_log` **恰 1 行**（`log_id=15` · `job_id=46` · `actor_uid=1` · `result=rejected` · **`txid='629'`（非恒 NULL）** · `memo` · `idempotency_key=ops:1:job_arbitrate:46`）；状态列 `public.job.status` = **`cancelled`**；**资金腿 `job_escrow_refund` × 2**：`txid=629`（`uid=6` · `delta='100'` · `frozen_delta='0'` · key `biz:job:refund:46`）+ `txid=630`（`uid=6` · `delta='0'` · `frozen_delta='-100'` · key `biz:job:refund:46#2`） |
| **台账 `txid` ∈ 腿 txid 集** | 台账 `log_txid=629` ∈ 腿集 `{629, 630}` ✅；`ledger_entry` 在 `txid=629` 上可见 1 行 `job_escrow_refund`（`uid=6` · `delta=100` · `frozen_delta=0`） |
| **③ 业务读口取数** | `database.ts:2489 listJobsForArbitration` ⇒ `status='cancelled'`（`job_id=46`） |
| **④ 行为随之（两读数）** | **改动前** = `{accept_gate:{job_status:'submitted', employer_uid:'6', acceptable:false}, escrow_refund_legs:0}`（对照：`open` 态 `acceptable:true`）⇄ **改动后** = `{accept_gate:{job_status:'cancelled', acceptable:false}, escrow_refund_legs:2}` |
| approve 支 | jID 47 ⇒ 台账 1 行（`log_id=16` · `result=approved` · `txid='633'`）；`job.status='settled'`；结算腿 4 条：`job_payout` `txid=633/634`（`uid=6` `delta=0` / `uid=7` `delta=99`）+ `job_fee` `txid=635/636`（`uid=6` `delta=0` / `uid=-1` `delta=1`） |
| 回滚 | 哨兵 `SEG-JOB` ⇒ `committed:false`（ROLLBACK） |

### 5.3 首调段（`segment_first_call` · 缺陷修复的直接证据）
- **回执**：`{ok:true, replay:false, view:{job_id:'48', status:'cancelled', result:'rejected', txid:'639'}}`。
- **原始回执（两字段不同）**：`prior_status='submitted'`（**前置态**）· `job_status='cancelled'`（**终态**）· `applied=1` · `reviewed=1` · `txid='639'`。
- **库内三处落值**：`{log_rows:1, status:'cancelled', refund_legs:2}`。
- **非法前置态**（对已 `cancelled` 的 jID 48 再 `approve`）：回执 `{ok:false, code:'LEDGER_CURRENCY_INVALID_TRANSITION', status:409, details:{field:'job.status', reason:'JOB_STATE_INVALID', required_from:'submitted|disputed', from:'cancelled'}}`；`db_after` = `{log_rows:1, status:'cancelled', refund_legs:2}`（**未新增落值**）⇒ 非法前置态**零写** ✅。
- 回滚：哨兵 `SEG-FIRSTCALL` ⇒ `committed:false`。

---

## 6. 归属闸 4 例两读数表

**脚本**：`backend-ts/scripts/p8-s5-02-ownership-gate.ts`（抓手 = 一个已终态 `settled` 的 job，`employer_uid=11`，只打鉴权面 / 早退面）。**两运行**：改动后 = `PORT=5796 P8S5_HTTP_MODE=after`（本仓工作树）；改动前 = `PORT=5797 P8S5_HTTP_MODE=before`（`git show HEAD:` 旧码直挂 `requireAdmin`）。

| 例 | actor | **改动前（5797 · HEAD 旧码）** | **改动后（5796 · 工作树）** | 判据 |
|---|---|---|---|---|
| **1** | admin `uid=1` | **通**（落业务层 409 `LD011`） | **通**（落业务层 409 `LD011`） | `passthrough`（非 401/403）✅ 两轮 |
| **2** | **雇主本人 `uid=11`** | **`403` `AUTH_FORBIDDEN` / `reason=NOT_ADMIN`（拦）** | **`200`（`review_approve`）/ 409（`cancel` / `review_reject` 落业务层）⇒ 通** | ★ **「雇主自审」D5 兑现的逐字证据**（拦 ⇄ 通） |
| **3** | 非雇主非 admin `uid=3` | `403` / `NOT_ADMIN`（拦） | `403` / `NOT_ADMIN`（拦） | 两轮同判 ✅ |
| **4** | 非雇主 admin 缺 `review_tasks` `uid=910004`（仅 `manage_points`） | `403` / `PERMISSION_NOT_GRANTED`（拦） | `403` / `PERMISSION_NOT_GRANTED`（拦） | 两轮同判 ✅ |
| 附 | 无 token | `401` / `AUTH_UNAUTHORIZED` | `401` / `AUTH_UNAUTHORIZED` | 先于任何写 ✅ |
| **净写闸** | `ledger_entry` 行数 | **355** | **355** | **355 → 355 零净写** ✅（`G6.zero_net_write`） |

- **`http.json`（改动后）现取**：`mode=after` · `base=http://127.0.0.1:5796` · `total=6 / passed=6 / failed=0`；`job_used={job_id:'20', employer_uid:'11', status:'settled'}`；`ledger_entry={before:355, after:355}`。
- ⚠️ **改动前（5797）HTTP 工件**：其 `http.json` 随 `git show HEAD:` 物化目录在本轮收尾时一并清理，**本次已不在仓内**（见 §9-3）。

---

## 7. 同族扫面三行结论（`R-9-9④` · 类级）

离线门 `actionFamily` 组（现取 `gate.json`，4 项全绿）：

| 动作口 | 回执状态字段语义 | 判据（源码面现取） | 结论 |
|---|---|---|---|
| **`listing-takedown`**（商品） | `listing_status` = **前置态**（`(SELECT cur.status FROM cur) AS listing_status` · 取锁先于 UPDATE） | 门 `K1` ✅ | ✅ **无缺陷** |
| **`currency-review`（8④）** | `cur_status` = **前置态**（`(SELECT cur.status FROM cur) AS cur_status`） | 门 `K2` ✅ | ✅ **无缺陷** |
| **`job-arbitration`**（招工） | 回执 = `prior_status`（前置态）∧ `job_status`（终态）**双字段** | 门 `K3` ✅ | **已修**（`R-9-9①`） |
| 对偶（防「未生效却记账」） | 三动作口台账 INSERT 均门控「可审前置态 ∧（approved ⇒ 已生效 `EXISTS(apply)`）」 | 门 `K4` ✅ | ✅ |

⇒ **同族只此一条有缺陷（`job-arbitration`），已修**；另两条语义正确。

---

## 8. 硬门全量读数

| 门 | 读数 | 备注 |
|---|---|---|
| `tsc` | **0**（零错误） | 类型检查 |
| 离线（合并读数） | **126 / 126** | 全绿 |
| `p8-s1` | **24** | 8① app_config |
| `p8-s2` | **41** | 8② 费率 / 返佣 |
| `p8-s3` | **45** | 8③ 保证金 |
| `p8-s3b` | **38** | 8③b 写路径 |
| `p8-s4` | **79** | 8④ 自建单位审核 |
| **`p8-s5`** | **117 / 117**（**103 → 117**） | 本片；`gate.json: total=117 passed=117 failed=0` |
| `build` | **0**（成功） | 前端构建 |
| `test:unit` | **276** | 单测 |
| 七门 | **0**（全绿） | 硬门全量 |
| **注册点** | **75** | 逐 verb：`get 31 / post 41 / put 0 / patch 1 / delete 2`（`gate.json.readings.registration_points_total`，`A1`/`A1b` 判据） |

- **`p8-s5` 门内分组（现取 `gate.json`，合计 117）**：`registration` 15 · `readSurface` 8 · `readSurfaceSelfTest` 1 · `actionShape` 8 · `illegalInput` 12 · `illegalInputSelfTest` 1 · `ownershipGate` 5 · `ownershipGateSelfTest` 1 · `noRefundSurface` 6 · `i18n` 16 · `i18nSelfTest` 1 · `migration` 25 · `registrationSelfTest` 1 · `actionShapeSelfTest` 1 · `migrationSelfTest` 2 · `actionFamily` 4 · `actionFirstCall` 8 · `actionFirstCallSelfTest` 2。
- **DB 探针**：`p8-s5-01-real-chains.ts` = **69 / 69**（60 → 69 · 新增首调段 9 项）。
- 计数闸 `A1`（注册点 = 75）与门自证 `A1` 负对照（写成 74 ⇒ 谓词转红）均在场。

---

## 9. 未测项

| # | 未测项 | 原因 |
|---|---|---|
| 1 | **迁移 `0026` / `0027` 的真 apply**（`schema_migration` 写入） | 硬口径禁 apply；apply 由 Zang 执行（参照 `0025` 流程）。本轮只 `file` ↔ `db` checksum 双对拍（§3），**未由本单触发 apply**。 |
| 2 | **本单重跑门 / 探针** | 派单明令**不重跑门 / 探针**（读数已在，重跑只烧预算）。§8 全部为**上单已实测工件 + master-plan 回执**读数。 |
| 3 | **改动前（5797）HTTP artifact `http.json` 原件** | `git show HEAD:` 物化目录在收尾时**随临时目录一并清理** ⇒ 原件已不在仓内。**复现命令**：`PORT=5797 P8S5_HTTP_MODE=before npx ts-node --transpile-only scripts/p8-s5-02-ownership-gate.ts`（需先起 HEAD 旧码受控实例）。改动前 4 例读数取自上单实测记录（§6）。 |
| 4 | **改前（defect 版）`database.ts:2601` 逐字原文** | 「改前」= 本单同批早段工作树态（**非 git HEAD**）；该态未被 snapshot。根因逐字取自 `real-chains.json.defects[0].anchors`（§4(B)），`:2601`/`:2618` 为其成对返回锚。 |
| 5 | **`0026` / `0027` append-only 触发器对 `TRUNCATE` / `DISABLE TRIGGER USER` 的拦截** | 迁移自述「**诚实边界**：不拦 `TRUNCATE` / `DISABLE TRIGGER USER`（同 `0017`/`0023`/`0025`）」—— 属**已知设计边界**，非缺陷；未做额外判据。 |
| 6 | **前端两后台页的真实浏览器渲染** | 属 P9①/前端面；8⑤ 门只覆盖注册 + i18n 键 + 命名空间（`i18n` 组 16 项 + 自证）。**未起实例 / 未做浏览器渲染验收**（本单无需）。 |
| 7 | **`test:unit` 明细用例清单** | 读数为**总数 276**（承上单）；未逐例列名（非本报告口径要求）。 |

---

## 10. 末次 `git status --porcelain` 逐条归因

**命令**：`git status --porcelain`（本次现取，工作树 = `main`）。

**桶 A · 本单（极小收口单）产物**：

| 状态 | 路径 | 归因 |
|---|---|---|
| `??` | `docs/audit/p8-s5-compliance-review.md` | **本单**新建（本报告）。

> 注：上表行随本报告落盘后即为本单唯一产物。

**桶 B · 8⑤ 在途（修复单 未提交源码 / 迁移 / 前端 / 门订正）**：

| 状态 | 路径 | 归因 |
|---|---|---|
| ` M` | `backend-ts/src/database.ts` | 8⑤：`jobArbitrationPostEvent`/`listingTakedownPostEvent` + `prior_status`（+261 行） |
| ` M` | `backend-ts/src/index.ts` | 8⑤：4 新路由 + `review`/`cancel` 归属闸（+181 行） |
| ` M` | `backend-ts/scripts/p8-s2-fee-rebate-gate.ts` | 8⑤：冻结注册点 `71 → 75` + `adminNav 22 → 26` |
| ` M` | `backend-ts/scripts/p8-s3-deposit-gate.ts` | 8⑤：同上（注册点 / adminNav） |
| ` M` | `backend-ts/scripts/p8-s3b-address-gate.ts` | 8⑤：同上 |
| ` M` | `backend-ts/scripts/p8-s4-currency-review-gate.ts` | 8⑤：同上 |
| ` M` | `frontend/src/App.jsx` | 8⑤：两后台页路由（`listing-review` / `arbitration-review`，闸 `review_tasks`） |
| ` M` | `frontend/src/components/layout/AdminLayout.jsx` | 8⑤：两条菜单项（`listingReview` / `arbitrationReview`） |
| ` M` | `frontend/src/locales/en.json` `hk.json` `vn.json` `zh.json` | 8⑤：`adminNav` +4 键 + `adminListingReview` / `adminArbitrationReview` 命名空间（无 `roleNames`(P9①) 键，已现取确认） |
| ` M` | `frontend/src/test/unit/i18n-batch-b4a.test.jsx` `b4b` `b5` `i18n-violation-closeout.test.jsx` | 8⑤：单测期望订正（`adminNav 22 → 26` · 新增 `B8S5_ADDED_TO_ADMINNAV = 4`） |
| `??` | `backend-ts/migrations/0026_listing_review_log.sql` | 8⑤ 新建迁移（**未 apply**） |
| `??` | `backend-ts/migrations/0027_job_arbitration_log.sql` | 8⑤ 新建迁移（**未 apply**） |
| `??` | `backend-ts/src/compliance-review-service.ts` | 8⑤ 新建服务层（364 行） |
| `??` | `backend-ts/scripts/p8-s5-00-recon.ts` / `-recon2.ts` / `-recon3.ts` / `p8-s5-01-real-chains.ts` / `p8-s5-02-ownership-gate.ts` / `p8-s5-compliance-gate.ts` | 8⑤ 新建门 / 探针脚本（6 件） |
| `??` | `frontend/src/pages/admin/ListingReviewPage.jsx` / `ArbitrationReviewPage.jsx` | 8⑤ 新建两后台页 |
| `??` | `backend-ts/.p8s5-artifacts/` | 8⑤ 门 / 探针工件目录（`gate.json` ×5 · `real-chains.json` ×6 · `http.json` ×1） |

**桶 C · 它单 / 套件运行产物（非 8⑤ 源码面 · 未入 `.gitignore` ⇒ 现于 porcelain）**：

| 状态 | 路径 | 归因 |
|---|---|---|
| `??` | `backend-ts/.p8s1-artifacts/` … `.p8s4-artifacts/`（各多轮） | 硬门套件（8①–8④ 门）运行产物目录（时间戳与 8⑤ 全量套件运行对齐） |
| `??` | `backend-ts/.p4-artifacts/p6tr1a-20261002T232549Z/` … `p6tr1a-20261003T005708Z/`（8 件） | 其它单（P6 翻译面）运行产物（`offline-tests.json`） |
| ` M` | `backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json` | 它单 / 套件重跑产生的历史件漂移（+459 / −462 行）—— **非 8⑤ 源码面** |

> **归因口径说明**：桶 C 三项**均不属 8⑤ 源码改动**，为运行产物 / 历史件；本单**未触碰**。桶 B 的 18 项均为 8⑤ 修复单在途（含两迁移**未 apply**）。桶 A 仅本报告一项。全部 ` M`/`??` 皆**未 `git add/commit`**。

---

*—— 报告完（本单只落盘此件 + 末次 `git status` 归因；零代码 / 零迁移 / 零 spec 改动 / 零门重跑 / 零 apply / 零 commit）。*
