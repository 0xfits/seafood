# 批 8⑤ · 合规审核（商品 / 招工）· 终审质检报告（Neng）

> 被检面：钉 **`3a36ba597b560b54b093f6f1da31b90be626163a`**（本地未推）。**不采信交付方 / 派单方转引，逐条现取重取**。
> 夹具 / 探针 = 本单自写（**不复用 Kong 的**；仅「反向判负」臂内为验证交付方自述的负对照结论而运行了交付方的门 / DB 探针，见 §3.4）。一切库面写 = **事务内 + 哨兵 `ROLLBACK`**（`listing_review_log` / `job_arbitration_log` 均 append-only ⇒ 真写不可恢复）。HTTP 面只打**鉴权面 + 终态 job 的早退面**（净写前后对拍 = 0）。
> 受控实例只用 **5796 / 5797**；收尾精确 PID `kill -TERM` + `lsof` 空。
> 语言：中文 · 结构化 · 逐条给命令与读数。**本报告完成后无占位**（末自证：对「连续两个下划线」模式计数 = 0）。

## §0 元信息（现取）

| 项 | 读数 | 来源 |
|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | — |
| 被检提交（钉） | `3a36ba597b560b54b093f6f1da31b90be626163a` | `git log -1`（首取，逐字） |
| 主仓 HEAD（开工首取） | `3a36ba597b560b54b093f6f1da31b90be626163a` | `git rev-parse HEAD`（09:05） |
| 主仓 HEAD（中途） | `0bbedd3f217cafdff5f1c6b2ea7cb1574c51e211` | 09:07 现取 —— **漂移登记**：`0bbedd3` = Zang 的「派终审质检」docs 提交（主题含「我识别报告一处误述（两迁移写成未 apply）交质检核」）；`git merge-base --is-ancestor 3a36ba5 HEAD` = **YES（被检面仍是祖先）** |
| 固定副本（worktree） | `…/scratch/qa8s5` @ `3a36ba5`（软链 front/back `node_modules` + `backend-ts/.env.local`；**已回收**） | `git worktree add --detach` → `worktree remove --force` |
| 质检刻（首取 / 尾取） | `2026-10-03T09:07:17+0800` / `2026-10-03T09:14:06+0800` | `date '+%Y-%m-%dT%H:%M:%S%z'` |
| 主仓 `git status`（首 / 尾） | **48 行**（47 既有 + 1 本报告骨架）/ **49 行**（47 既有 + 2 本单新增） | `git status --porcelain` |
| 副本逐文件 blob | **全部 tracked blob == `git rev-parse 3a36ba5:<path>`** | `git -C <wt> diff --quiet 3a36ba5 -- .` ⇒ `TRACKED_CLEAN`；8 关键文件逐条 `git hash-object` 对拍全 `OK` |

- **主仓零写入自证**：`backend-ts/src/compliance-review-service.ts` / `database.ts` / `index.ts` 三文件 `main blob == pin blob == worktree blob`（逐字）；变异只在**仓外副本**内且已复原（§3.4）。
- **本单新增路径恰 2 条**：`backend-ts/.p8s5qa-artifacts/`（产物）· `docs/qa/p8-s5-compliance-review-qa.md`（本报告）。其余 47 条为开工前既有（他人 / 历史产物：`.p4-artifacts/**`、`.p8s1..p8s4-artifacts/**`、`p8-s5-00-recon*.ts`），**逐条未碰、未提交、未回滚**。
- **硬口径自检**：未改被检代码 / 报告 / 规范；未 `git add/commit/push`；未 `npm install`；未碰 / 打印 `.env*`（仅以 `sed` 掩码列键名）；未 `pkill -f` / `killall`；未启停 5787/5788；未 apply 任何迁移（写面全事务内 + `ROLLBACK`）。

---

## §1 四表触发器现取（前提：台账表真写不可删改）

自写只读探针 `qa8s5-00-catalog.ts`（产物 `backend-ts/.p8s5qa-artifacts/qa8s5-00-catalog-20261003T010748Z.json`）现取 `pg_trigger`：

| 表 | 启用触发器（非 internal，`tgenabled=O`） |
|---|---|
| `public.listing` | `trg_listing_create_key_guard` · `trg_listing_no_delete` · `trg_listing_status_guard` · `trg_listing_stock_guard` · `trg_listing_touch_time_updated`（**5**） |
| `public.listing_review_log` | **`trg_listing_review_log_append_only`**（`BEFORE UPDATE OR DELETE` 无条件 `RAISE`；守门函数 `listing_review_log_append_only()`）——**1** |
| `public.job` | `trg_job_core_immutable_guard` · `trg_job_ledger_ref_guard` · `trg_job_no_delete` · `trg_job_status_guard` · `trg_job_touch_time_updated`（**5**） |
| `public.job_arbitration_log` | **`trg_job_arbitration_log_append_only`**（守门函数 `job_arbitration_log_append_only()`）——**1** |

⇒ 两台账表 **append-only**（`BEFORE UPDATE OR DELETE` 无条件 `RAISE`）；`listing` / `job` 均带 `status_guard` 状态白名单触发器。**故本单一切库面写均「事务内 + 末尾 `ROLLBACK`」**（§3、§5）。

---

## §2 L1 硬门独立复跑（退出码**管道外**捕获）

> 命令一律在**固定副本**内跑；退出码由脚本捕获到摘要（非管道之后）。原始输出落 `backend-ts/.p8s5qa-artifacts/20261003T010730Z_L1_*.out`。

| 门 | 读数 | 退出码 |
|---|---|---|
| `npx tsc --noEmit`（backend-ts） | 0 行诊断 | **0** |
| 离线套件 `scripts/p4z-tr1a-01-offline-tests.ts` | **126 / 126 passed** | **0** |
| `scripts/p8-s1-app-config-gate.ts` | **24 / 24 passed** | **0** |
| `scripts/p8-s2-fee-rebate-gate.ts` | **41 / 41 passed** | **0** |
| `scripts/p8-s3-deposit-gate.ts` | **45 / 45 passed** | **0** |
| `scripts/p8-s3b-address-gate.ts` | **38 / 38 passed** | **0** |
| `scripts/p8-s4-currency-review-gate.ts` | **79 / 79 passed** | **0** |
| **`scripts/p8-s5-compliance-gate.ts`** | **117 / 117 passed**（`failed=0`） | **0** |
| `npm run build`（frontend，vite） | `✓ built in 1.67s`（`index-BHGnZPGW.js` 368.42 kB） | **0** |
| `npm run test:unit`（frontend，vitest） | **31 files / 276 passed** | **0** |
| 七门（`frontend/scripts/*.mjs`） | **七门全 `0`**（见下） | **0** |

**七门逐门**：`p4z-i18nviol-global` `0` · `p6-tr2-i18n-locales` `0` · `p4z-miscfix-links` `0` · `p4z-feperf-safelist` `0` · `p7a-03-errmessage-gate` `0` · `p7b-errfallback-gate` `0` · `p7c-errmsg-machinecode-gate` `0`（**`链路体制 = 真链`** 现场命中，非退化）。

**注册点逐 verb（本单 `p8-s5` 门现取，`gate.json.readings`）** = **75**：`get 31 / post 41 / put 0 / patch 1 / delete 2`（15 组分组计数和 = 117 与门 `total` 一致）。

⇒ **L1 = 全绿（tsc 0 · 离线 126/126 · s1 24 · s2 41 · s3 45 · s3b 38 · s4 79 · s5 117/117 · build 0 · test:unit 31·276 · 七门 0·p7c 真链 · 注册点 75）**，与交付报告 §8 逐条相符。

---

## §3 L2 ★★ 缺陷修复 `DEFECT-ARB-VERB-POST-STATE`（`R-9-9`）双证 + 反向判负

### §3.1 现取：`database.ts` `jobArbitrationPostEvent` **四处返回均带 `prior_status`**

`src/database.ts`（被检面现取，函数体 `:2544–2627`）：

| 返回点（行号） | 场景 | 现取逐字 |
|---|---|---|
| **:2562** | job 不存在 | `{ job_id, job_found: 0, job_status: null, prior_status: null, … }` |
| **:2575** | 幂等重放 | `{ …, job_status: curStatus, prior_status: curStatus, prior_count: prior, … }` |
| **:2580** | 非可仲裁前置态 | `{ …, job_status: curStatus, prior_status: curStatus, prior_count: 0, … }` |
| **:2622** | 成功 | `{ …, job_status: finalStatus, prior_status: curStatus, prior_count: 0, applied, reviewed, txid }` |

⇒ **四处返回均含 `prior_status`**（`prior_status: curStatus` = 同一事务内 `SELECT … FOR UPDATE`（`:2554–2564`）读得的**前置态**；门 `J1` 判据 `grep /prior_status:/ ≥ 4`）。第 4 处同时给**终态** `job_status: finalStatus`（来自既有 `job_post_event` 回执 `:2603`）。

### §3.2 现取：服务层**只用** `prior_status` 判前置态；`row.job_status` **仅用于输出**

`src/compliance-review-service.ts`（`arbitrateJobVerb`）：

- **:309** 前置态取值 = `const priorStatus = row.prior_status … : String(row.prior_status);`
- **:311** `const finalStatus = row.job_status … : String(row.job_status);` —— 注释 `:310` 逐字：**「终态字段 `job_status` **仅**用于成功回执输出 … **不参与**前置态判定。」**
- **:326** 前置态判定 = `if (priorStatus !== 'submitted' && priorStatus !== 'disputed') { return jobStateConflict({ … from: priorStatus }); }`
- **:331** 成功 = `if (applied > 0) return { ok: true, replay: false, view: { …, status: finalStatus, … } }`（输出用终态）
- **:338–341** `applied=0 且 priorStatus ∈ 允许集` ⇒ 映射既有 409（`reviewed<1` 细分 `LEDGER_ROW_NOT_WRITTEN`）

⇒ 全文只有 `:309` 读 `row.prior_status`、`:311` 读 `row.job_status`；**判定路径 (`:326/:338/:341`) 全部用 `priorStatus`，`row.job_status` 只剩 `:311`（供输出）**。与「投影层误读」旧缺陷（`:307` 取 `curStatus = row.job_status`）已根治。

### §3.3 自写探针：首调 = 200 + 库内三处落值 + `prior_status` ≠ `job_status`；非法前置态 = 409 + 零增

自写探针 `scripts/qa8s5-01-l2-firstcall.ts`（自造 fixture，tag=`qa8s5`；事务内 + 哨兵 `ROLLBACK`）。产物 `qa8s5-01-l2-20261003T010852Z.json`，**残渣 = 0**（`baseline == after`：`listing_review_log 0 / job_arbitration_log 0 / ledger_entry 355 / job_max 24 / ledger_max_txid 366`）。

**首调（DB 原始回执 + 服务层 verb）**：

```
s1_raw_receipt = {job_id:"49", job_found:1, job_status:"cancelled", prior_status:"submitted",
                  prior_count:0, applied:1, reviewed:1, txid:"643"}
s1_db_landed   = {log_rows:1, job_status:"cancelled", legs:2}   # 台账 1 行 + 状态 submitted→cancelled + job_escrow_refund×2
                腿：txid 643 uid6 delta 90 frozen 0（key biz:job:refund:49）+ txid 644 uid6 delta 0 frozen -90（…#2）
s2_verb_reply  = {ok:true, replay:false, view:{job_id:"50", status:"cancelled", result:"rejected", txid:"647"}}
s2_db_landed   = {log_rows:1, job_status:"cancelled", legs:2}
```

⇒ **★ `prior_status='submitted'` 与 `job_status='cancelled'` 两字段逐字不同**（前置态 ≠ 终态）；`applied=1 ∧ reviewed=1 ∧ txid≠NULL`；库内**三处落值齐**（台账 1 行 + 状态迁移 + 资金腿）。服务层 verb **首调 = 200（`ok:true`）**。

**非法前置态（对已终态再仲裁）**：

```
s3_illegal_reply = {ok:false, code:"LEDGER_CURRENCY_INVALID_TRANSITION", status:409,
                    details:{field:"job.status", reason:"JOB_STATE_INVALID", required_from:"submitted|disputed", from:"settled", action:"approve"}}
s3_db   = {after_first:{log_rows:1, status:"settled"}, after_illegal:{log_rows:1, status:"settled"}}
```

⇒ **409 `LD011` + reason `JOB_STATE_INVALID`**，且库内三处**零增**（台账 1⇒1 / 状态 settled⇒settled / 无新腿）——「未生效即不落台账」成立。

### §3.4 反向判负（仓外副本）：`prior_status` → 终态字段 ⇒ 门必红 + 库面探针必红；复原回绿；主仓零写入

仓外副本 `…/scratch/qa8s5-neg`（`rsync` 复刻工作树 + 软链 node_modules / .env.local），**单点变异**：`compliance-review-service.ts:309` 的 `row.prior_status` → `row.job_status`（复原旧缺陷语义）。

| 面 | 变异态读数 | 期望 | 复原态 |
|---|---|---|---|
| **离线门** `p8-s5-compliance-gate.ts` | **117 → 113**，红点 = **`J2` · `J2b` · `J3` · `J4`**（逐字） | 门必红 | **117/117**（退出码 `0`） |
| **DB 探针** `p8-s5-01-real-chains.ts`（交付方） | **69 → 66**，红点 = **`B1.action_ok` · `B5.success_implies_log` · `C1.first_call_200`**（逐字）；`defects=[DEFECT-ARB-VERB-POST-STATE]` | 库面探针必红 | — |
| **本单自写探针**（我自己的读数） | `s2_verb_reply = {ok:false, code:LEDGER_CURRENCY_INVALID_TRANSITION, status:409}`（首调被误判 409）；`s1` 仍给 `prior_status=submitted`（DB 侧未改） | 我的探针亦必红 | `ok:true` |

- 红点**逐字**：离线门 4 红 = `J2`（源码面「取 `row.prior_status`」谓词破）/ `J2b`（门自证负对照破）/ `J3`·`J4`（DI 行为面首调转 409）；DB 探针 3 红 = `B1.action_ok`/`B5.success_implies_log`/`C1.first_call_200`。
- **主仓零写入**：三被检源码文件 `main blob == pin blob == worktree blob`（逐字对拍）；变异只在仓外副本且已复原。
- 说明：`B1/B5/C1` 是**交付方 DB 探针**的判据 id（派单口径点名核对）。为核对其「负对照」自述结论，本单在该变异副本内**运行了交付方的门 / DB 探针**（此为验证交付方自述，不是复用其夹具产出本单的主读数——本单主读数一律取自 §3.3 自写探针）。

⇒ **L2 = 双证通过**：修复四件（回执补 `prior_status` / 判定顺序钉死 / 未生效不落台账 / 同族扫面）在现取源码与自写探针下均成立；反向判负证明门与探针**真能抓**此缺陷（非假门）。

---

## §4 L3 ★ 同族扫面（类级）独立复核 —— 逐条自判「前置态 vs 终态」

本单**自己现取**三条动作口的回执字段语义（不采信任何现成「无缺陷」结论）：

| 动作口 | 回执状态字段 | 定义式（现取行号） | 自判 |
|---|---|---|---|
| **`listing-takedown`**（商品） | `listing_status` | `database.ts:409` `(SELECT cur.status FROM cur) AS listing_status`；`cur` CTE `:372–377` 为 `SELECT … FOR UPDATE`，**先于** `apply` 的 `UPDATE`（`:386–394`）| **前置态** ✅ 语义正确 |
| **`currency-review`**（8④） | `cur_status` | `database.ts:342` `(SELECT cur.status FROM cur) AS cur_status`；`cur` CTE `:299–304` `FOR UPDATE`，**先于** `apply`（`:312–322`）| **前置态** ✅ 语义正确 |
| **`job-arbitration`**（招工） | `prior_status`（前置）**∧** `job_status`（终态） | `database.ts:2622` `prior_status: curStatus`（`FOR UPDATE` 读）**∧** `job_status: finalStatus`（`job_post_event` 回执）| **双字段**：`prior_status` = 前置态 / `job_status` = 终态；服务层已**只用** `prior_status` 判前置 —— **已修** ✅ |

- 机理自证（为何 `cur.status` 是前置态）：PostgreSQL 中 `WITH … SELECT … FOR UPDATE` 的读 CTE 取**语句起始快照**，同语句内的 `UPDATE`（数据修改 CTE）对其不可见 ⇒ 回执里的 `cur.status` 恒为**动作前**状态。故两旧动作口用其做前置判定是**正确**的；唯招工口旧代码错用**终态** `job_status` ⇒ 即 `DEFECT-ARB-VERB-POST-STATE`。
- **对偶（防「未生效却记账」）自判**：三口台账 `INSERT` 均门控「可审前置态 ∧（approved ⇒ 已生效）」——`listing` 读口 `:401 (SELECT cur.status FROM cur)='listed'` + `:403 ($3<>'approved' OR EXISTS(apply))`；`currency` 同型（`:334/:336`）；招工 `:2579` 早退在 `INSERT`（`:2609`）之前。

⇒ **同族只此一条（`job-arbitration`）曾有缺陷，已修**；另两条语义自判正确。与交付报告 §7 结论**一致（本单独立判定得出，非采信）**。

---

## §5 L4 四段真链路独立重取（自写探针 + 自造 fixture；**连跑两次**）

自写探针 `scripts/qa8s5-02-chains.ts`（自造 fixture，tag=`qa8s5`；走服务层 verb + tx 绑定 DB 函数；事务内 + 哨兵 `ROLLBACK`）。产物 `qa8s5-02-chains-20261003T011039Z.json` / `…011058Z.json`。**两次运行 `residue_zero = true`**（`baseline == after`：`listing_review_log 0 / job_arbitration_log 0 / ledger_entry 355 / listing_max 24 / job_max 24`）；两次夹具 id 各异（listing 43/44、job 61/64）。

### 5.1 商品轴（`POST /api/admin/listing/:listingId/takedown` · 闸 `requireAdmin(…,'review_tasks')`）

| 段 | 读数（两次运行逐字一致） |
|---|---|
| **① 后台审** | `approve` ⇒ 回执 `{ok:true, view:{listing_id:"43", status:"delisted", result:"approved"}}` |
| **② 库内落值** | `listing_review_log` **恰 1 行**（`result=approved` · `txid=null` · `actor_uid=1` · `idempotency_key=ops:1:listing_takedown:43`）；`listing.status` = **`delisted`** |
| **③ 业务读口** | 同 `listListingsForAdmin` 体（`database.ts:2445`）取回 `status='delisted'` |
| **④ 行为随之（两读数）** | **改动前** = `{outcome:'accepted', purchasable:true, txid:'689'}` ⇄ **改动后** = `{outcome:'rejected', purchasable:false, code:'LEDGER_CURRENCY_INVALID_TRANSITION', reason:'listing_not_listed', httpStatus:409, raw_sqlstate:'LD011'}` ⇒ **商品不可购买**（两读数不同 ✅） |
| 回滚 | 哨兵 `ROLLBACK` ⇒ 残渣 0 |

### 5.2 招工轴（`POST /api/admin/arbitration/:jobId` · 闸 `requireAdmin(…,'review_tasks')`；含资金腿 + `txid` 对账）

| 段 | 读数 |
|---|---|
| **① 后台审** | `reject` ⇒ 回执 `{ok:true, view:{job_id:"61", status:"cancelled", result:"rejected", txid:"697"}}` |
| **② 库内落值** | `job_arbitration_log` **恰 1 行**（`result=rejected` · **`txid="697"`（非恒 NULL）** · `actor_uid=1` · key `ops:1:job_arbitrate:61`）；`job.status` = **`cancelled`**；**资金腿 `job_escrow_refund` × 2**（`txid=697` uid6 delta 100 frozen 0 · key `biz:job:refund:61` ＋ `txid=698` uid6 delta 0 frozen −100 · key `…#2`） |
| **台账 `txid` 对账** | `log_txid=697 ∈ 腿 txid 集 {697,698}` ✅；`ledger_entry` 在 `txid=697` 可见 1 行（`kind=job_escrow_refund` · uid6 · delta 100 · frozen 0） |
| **③ 业务读口** | 同 `listJobsForArbitration` 体（`database.ts:2489`）取回 `status='cancelled'` |
| **④ 行为随之（两读数）** | **控制**：`open` 态招工 `acceptable=true`；**同一被仲裁招工**：改动前 `{job_status:'submitted', acceptable:false, legs:0}` ⇄ 改动后 `{job_status:'cancelled', acceptable:false, legs:2}` |

- **诚实登记（行为量口径）**：招工轴的「可否承接」= `job.status='open'`；被仲裁的 job 变动前已是 `submitted`（本就不可承接）⇒ 该布尔**两读数同为 false**（`submitted` 与 `cancelled` 皆非 `open`）。故本轴「行为随之」的**判别量实为资金腿（0 ⇒ 2）+ 状态迁移（submitted ⇒ cancelled）+ 控制 open=true**，而非 `acceptable` 布尔本身。交付报告 §5.2 同呈此形态（其两读数亦含 `acceptable:false` 恒定 + `legs 0→2`）；本单据实登记该口径，不将其误读为「行为未随之」。
- 回滚：哨兵 `ROLLBACK` ⇒ 残渣 0。

⇒ **L4 = 四段齐（①动作 ②库内落值 ③业务读口 ④行为随之）+ 两读数 + 连跑两次残渣 0**。

---

## §6 L5 归属闸 4 例独立复取（两读数）

自写 HTTP 探针 `scripts/qa8s5-04-ownership-http.ts`（内部自签 token；抓手 = 终态 `settled` 的 job `20`，`employer_uid=11`，只打鉴权面 + 早退面）。两实例：**改动后 = 5796**（工作树 `3a36ba5`，闸 `requireJobOwnerOrAdmin`）· **改动前 = 5797**（`…/scratch/qa8s5-before` @ `3d712d6` = 被检提交父提交，两路由**直挂 `requireAdmin(req,res,'review_tasks')`** —— 现取 `git show 3d712d6:backend-ts/src/index.ts` 的 `review`/`cancel` 逐字确认）。产物 `qa8s5-04-ownership-20261003T011252Z.json`。

| 例 | actor | **改动前（5797 · 旧码 `requireAdmin`）** | **改动后（5796 · 工作树）** | 判据 |
|---|---|---|---|---|
| 1 | admin `uid=1` | `review_approve 200` / `review_reject 409` / `cancel 409` | 同（`200 / 409 / 409`） | `passthrough`（非 401/403）✅ 两轮 |
| 2 | **雇主本人 `uid=11`** | **`403 AUTH_FORBIDDEN` / `reason=NOT_ADMIN` ×3（拦）** | **`200 / 409 / 409`（**通**）** | ★ **「雇主自审」D5 兑现的逐字证据**（拦 ⇄ 通） |
| 3 | 非雇主非 admin `uid=3` | `403` / `NOT_ADMIN` ×3（拦） | 同（拦） | 两轮同判 ✅ |
| 4 | 非雇主 admin 缺 `review_tasks` `uid=910004`（role `qa7b_admin` 仅 `manage_points`） | `403` / `PERMISSION_NOT_GRANTED` ×3（拦） | 同（拦） | 两轮同判 ✅ |
| 附 | 无 token | `401 AUTH_UNAUTHORIZED` | 同 | 先于任何写 ✅ |
| **净写闸** | 前后对拍 | `ledger_entry 355 · account_rows 39 · Σbalance 2020097 · job20/23 settled · 两台账 0` | 同（逐字） | **`net_write_zero = true`** ✅ |

- 三负向臂各有其码、互不顶替：**无 token ⇒ 401** / **非该角色 ⇒ 403 `NOT_ADMIN`** / **角色齐但缺 `review_tasks` ⇒ 403 `PERMISSION_NOT_GRANTED`**（现取 `index.ts:329–348` `requireAdmin` 三支一致）。
- ⇒ **L5 = 4 例两读数齐**，与交付报告 §6 逐条相符（含「雇主拦 ⇄ 通」与「净写 355→355」）。

---

## §7 L6 库面复核（只读）

自写只读探针 `qa8s5-00-catalog.ts` 现取：

**两迁移 checksum（DB 值 == 文件 sha256，逐字）**：

| 迁移 | 文件 `shasum -a 256` | `schema_migration.checksum` | 判定 |
|---|---|---|---|
| `0026_listing_review_log.sql` | `3140366eabfdcc8375e71e1c8e0144323767245cf2e4fc4114687ba695f84e7b` | `3140366eabfdcc8375e71e1c8e0144323767245cf2e4fc4114687ba695f84e7b` | **逐字相符** ✅ |
| `0027_job_arbitration_log.sql` | `8209df5a86879188f5a25583b69bd4e0002474f850767a7b411641bda17fd481` | `8209df5a86879188f5a25583b69bd4e0002474f850767a7b411641bda17fd481` | **逐字相符** ✅ |

- **`schema_version = 0027`** ✅（`schema_migration` 末行 = `0027`）；`applied_at` 现取 `0026 = 2026-10-03T00:29:15.853Z` · `0027 = 2026-10-03T00:29:16.856Z`。
- **两台账表结构（现取 `information_schema` / `pg_constraint` / `pg_indexes`）**：各 **9 列** 逐字顺序 `log_id, [listing_id|job_id], actor_uid, result, request_fingerprint, idempotency_key, txid, memo, time_created`；具名约束 **`_pk`(PK) ×1 · `_actor_fk`(FK users(uid)) ×1 · `_[listing|job]_fk`(FK) ×1 · `_result_ck` `CHECK (result = ANY (ARRAY['approved','rejected']))` ×1 · `_idem_uniq` `UNIQUE (idempotency_key, result)` ×1**；索引 **4 个**（`_pk` + `_idem_uniq` + `_[listing|job]_idx` + `_actor_day_idx`）；append-only 触发器（§1）。
- **探针残渣 = 0**：`listing_review_log = 0` · `job_arbitration_log = 0` · `max(log_id) = null`（两表）；`ledger_entry = 355`（与 §5/§6 基线一致，未位移）。

⇒ **L6 = 全中**。

---

## §8 L7 报告核（`docs/audit/p8-s5-compliance-review.md`）+ ★ 登记（只核不改）

**规格核对**：报告 = **290 行 / 27,602 B / 占位「连续两下划线」计数 = 0** ✅（现取 `wc -lc` + `grep -c`）。

**★ 锤锚点核对（现取行号 vs 报告自述）**——报告 §1 的 route `§25.x` 节头行号全部**现取相符**：

```
现取：§25.1=:5770  §25.2=:5794  §25.3=:5809  §25.4=:5833  §25.5=:5845
      §25.6=:5865  §25.7=:5895  §25.8=:5910  §25.9=:5932   （route-layer.spec.md v2.12）
data-layer.spec.md §28.6 = :2318
```
报告 §1 逐字一致（9 个节头全中）。另：`route-layer.spec.md` = 6329 行 / 1,290,661 B（报告 §0 自述 v2.12 6329 行 / 1,290,661 B ✅）；`data-layer.spec.md` = 2871 行 / 585,357 B ✅；报告 §2 行号漂移 `review :1884→:1938` / `cancel :1908→:1962`（+54）**现取相符**（工作树 `index.ts` = `:1938/:1962`；`3d712d6` = `:1884/:1908`）。

**抽 5 条对拍（本单独立读数 ⇄ 报告自述）**：

| # | 报告条目 | 报告自述 | 本单独立读数 | 判 |
|---|---|---|---|---|
| 1 | §3 | `schema_version=0027` · `base_tables=28` | `schema_version_max=0027` · `base_tables=28`（`real-chains.json` 现取） | ✅ |
| 2 | §4(E) | 门负对照 `117→113`（红 `J2/J2b/J3/J4`）· DB 探针 `69→66`（红 `B1/B5/C1`） | 逐字复现（§3.4） | ✅ |
| 3 | §5.1/§5.2 | 商品轴 `txid` 恒 NULL；招工轴 `job_escrow_refund ×2` + `txid` 锚账 | 自写探针逐字复现（§5） | ✅ |
| 4 | §6 | 例2 雇主 `uid=11`：改动前 `403 NOT_ADMIN` ⇄ 改动后 `200`；净写 `355→355` | 逐字复现（§6） | ✅ |
| 5 | §8 | `p8-s5 117/117` · 注册点 `75`（`get31/post41/put0/patch1/delete2`）· `test:unit 276` | 逐字复现（§2） | ✅ |

**★ 登记 1（只核不改）：报告末节「两迁移 未 apply」与事实不符。**

- 现取事实：`schema_version = 0027`；`schema_migration` 含 `0026`（`applied_at 00:29:15`）与 `0027`（`00:29:16`）两行，**两迁移已 apply**（文件仅「尚未入库」= 未 commit，非未 apply）。
- 报告误述位置（现取行号）：§3 注 `:76`「本单未 apply 任何迁移」；§9-2 未测项表 `:235` 未测项①；§10 桶B `:271–272`「**未 apply**」；§10 归因口径说明 `:286`「（含两迁移**未 apply**）」。
- 定性：**文本瑕疵（描述失真），非代码 / 库面缺陷**；代码面无影响（迁移内容 checksum 与库逐字相符，§7）。Zang 已在 `0bbedd3` 主题中自识别该误述并交核（本单独立复核确认）。**本单只登记、不改被检报告。**

**★ 登记 2（只核不改）：§4(B) 锚点 `database.ts:2601` 的出处可证伪性。**

- 报告 §4(B) 正文写改前 `database.ts:2601` / `:2618`（成对返回锚）；§9-4 自注「`:2601`/`:2618` 为其成对返回锚」，并注「改前 = 本单同批早段工作树态（**非 git HEAD**）；该态未被 snapshot」。
- 现取核对：报告所引工件 `real-chains.json.defects[0].anchors`（现取 `p8s5-20261003T003702Z`）**只含 `database.ts:2618`** 与 `compliance-review-service.ts:307/:321` 三条，**不含 `:2601`** ⇒ 报告正文的 `:2601` **不被其自引工件锚支持**。且被检仓 `database.ts` 的 8⑤ 改动**只在 `3a36ba5` 一个提交**内（`git log -- database.ts` 现取，`3a36ba5` 之上无更早同批态）⇒ **该「改前」态不在任何 git rev**，**无法从 git 逐字复现 `:2601` 原文**。
- **本单探针的可证伪性读数（逐字）**：本单**能**复现该缺陷的**根因类**（服务层以终态字段当前置态）——在仓外副本对 `:309` 做单点变异（`row.prior_status` → `row.job_status`），即得门 `117→113`（`J2/J2b/J3/J4`）、DB 探针 `69→66`（`B1/B5/C1`）、自写探针首调 `{ok:false, status:409}`（§3.4）。但本单**不能**逐字复现「`:2601` 处的 `job_status: finalStatus`」这一**具体行号文本**——该态未被 snapshot、不在 git、亦不在被引工件的 anchors 里。
- 定性：**该 `:2601` 出处为「不可独立核实的具体行号」（git 不可证、工件未列）**；根因类可证伪且已证伪复现。**登记，不改被检报告。**

---

## §9 L8 未测项 + verdict

| # | 未测项 | 原因（禁填 0 / 空） |
|---|---|---|
| 1 | 迁移 `0026`/`0027` 的**真 apply**（`schema_migration` 写入）由本单触发 | 硬口径**禁 apply**；两迁移**已由 Zang apply**（现取 `applied_at 00:29:15/16`，§7）。本单只做只读核对 + checksum 双对拍。 |
| 2 | `0026`/`0027` append-only 触发器对 `TRUNCATE` / `DISABLE TRIGGER USER` 的拦截 | 迁移自述已声明为**诚实边界**（不拦，同 `0017`/`0023`/`0025`）；本单未造该面判据（造它需破坏性 DDL，超出质检面）。 |
| 3 | 前端两后台页的真实浏览器渲染（`ListingReviewPage` / `ArbitrationReviewPage`） | 属前端面；8⑤ 门只覆盖注册 + i18n 键 + 命名空间（i18n 组 16 项）。本单未起前端实例 / 未做浏览器渲染（本单无需）。 |
| 4 | `test:unit` 的逐例清单 | 只取总数 **31 files / 276 passed**（现跑）；未逐例列名（非本报告口径要求）。 |
| 5 | 「改前」`database.ts:2601` 的逐字原文 | 不在任何 git rev、未被 snapshot、不在被引工件 anchors（§8 登记 2）。根因类已由自写变异复现（§3.4），但具体行号文本不可独立核实。 |
| 6 | 交付方 §5 真链路所用的**具体夹具 id / txid**（listing 39 / job 46-48 / txid 629+） | 其读数系**事务内 + `ROLLBACK`** 的瞬态夹具（现取库内 `listing_max=24 / job_max=24 / 两台账=0`，与瞬态一致）；本单不能重放其具体 id。本单已用**自造夹具**独立重取同结构读数（§5），二者结构一致。 |
| 7 | 改动前（5797）HTTP 产物原件 | 交付报告自注销毁（§6 注 / §9-3）；本单**自建** `qa8s5-before` 副本（`3d712d6`）重跑两读数（§6），未依赖其原件。 |

**verdict：PASS（建议入库）。**
- L1 硬门全绿（tsc 0 · 离线 126/126 · s1 24 · s2 41 · s3 45 · s3b 38 · s4 79 · **s5 117/117** · build 0 · test:unit 31·276 · 七门 0·p7c 真链 · 注册点 75）。
- L2 缺陷修复**双证 + 反向判负**（自写探针首调 200 + 三处落值 + `prior_status≠job_status`；非法前置态 409 + 零增；变异态门 `117→113`·DB 探针 `69→66`·自写探针 409，复原回绿；主仓零写入）。
- L3 三条动作口语义**自判**：两条前置态正确、招工口已修。
- L4 四段真链路（两轴）自写探针 **连跑两次残渣 0**。
- L5 归属闸 4 例**两读数** + 净写 0。
- L6 库面 checksum 双对拍 + 结构 + 触发器 + 残渣 0。
- L7 报告规格 / 锚点对拍 5/5 中；登记 **2 项文本瑕疵**（「未 apply」误述、`database.ts:2601` 出处不可独立核实）—— **均为登记项，非代码 / 库面缺陷，不构成阻塞**。
- **无阻塞项。**

---

## §10 收尾

- **受控实例**：`5796`（工作树 `3a36ba5`）· `5797`（`3d712d6`）已按**精确 PID**（现取 `lsof -t` = `9016`/`9017`）`kill -TERM`；收尾 `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**。**未启停 5787/5788**、未用 `pkill -f`/`killall`。
- **副本回收**：`git worktree remove --force …/qa8s5` ✓ · `…/qa8s5-before` ✓ · 仓外变异副本 `…/qa8s5-neg` `rm -rf` ✓（回收前已查脏并登记：`qa8s5` 15 项 untracked = 本单探针 5 + 本单运行产物目录 + `node_modules` 软链；均属本单、已归因）。
- **产物（`backend-ts/.p8s5qa-artifacts/`，run-tagged `.json`/`.out`，无 `.log`）**：`qa8s5-00-catalog-*.json` · `qa8s5-01-l2-*.json` · `qa8s5-02-chains-*（2）` · `qa8s5-03-fixtures.json` · `qa8s5-04-ownership-*.json` · `20261003T010730Z_L1_*.out` · `20261003T010923Z_L2NEG_gate.out` · `…010924Z_L2NEG_dbprobe.out` · `…010924Z_L2NEG_myprobe.out`。
- **首尾 `git status`**：首 48 行 / 尾 49 行；本单新增恰 2 条（`.p8s5qa-artifacts/`、`docs/qa/p8-s5-compliance-review-qa.md`），其余 47 条为开工前既有（他人 / 历史产物），逐条未碰、未提交、未回滚。
- **本报告自证**：对「连续两个下划线」模式计数 = **0**（交付方源码里带该模式的「自证」判据 id 属**被检源码**，非本报告；本报告正文连一个该模式都没有）。

*—— 报告完（L0–L8 全跑；结论 PASS；2 项文本瑕疵已登记，交实现方微修单合批处理，本单只核不改）。*
