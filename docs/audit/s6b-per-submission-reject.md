# S6b · 逐笔 reject 腿（修严重错误）— 交付与自证报告

- 单号：**S6b-PER-SUBMISSION-REJECT**
- 角色：**Kong（实现）**
- 开工 HEAD：`692f622`（= `feat(task-model): S6 后端补口（… /review 支持提交号逐笔 …）`）
- 真库：**`schema_version = 0041`**（`0042` 未 apply，本单**未 apply**；`/health` 现取自报）
- 受控实例：**`PORT=5796`**（`npx ts-node --transpile-only src/index.ts`；收尾已按精确 PID `kill -TERM`）
- 改动面：**仅 `backend-ts/src/index.ts`（+43 / −4）**；探针 `.p9s12-recon/` + `.p9s12-arms/`；本报告。**未 commit / 未 push**。

---

## §0 结论速览

| # | 事项 | 结果 |
|---|---|---|
| 1 | `tsc --noEmit` | **0**（`npx tsc --noEmit -p tsconfig.json`，EXIT=0） |
| 2 | ① `/review` 分支化 | **已改**：**带提交号 + `approved:false` ⇒ `rejectJobSubmission`**（逐笔 · 零资金 · 该提交 `rejected` · job 保持 `open`）；带提交号 + `approved:true` ⇒ `settleJob`（S6 已接）；**不带提交号 ⇒ 现行为零回归**（`approved:false` 仍整单 `refundJob`） |
| 3 | ② 准入不变 | **复用 `requireJobOwnerOrAdmin`（未改）**；非发布者 ⇒ **403 AUTH_FORBIDDEN / NOT_ADMIN**（实测） |
| 4 | ③ 待审面同步 | `countPendingVerification` 与 `listPendingVerification` **同源同轴一致**：新提交进队列（1→2），逐笔判不合格后**离队**（2→1）；HTTP `/count` = 1 = DB 读数 |
| 5 | 三臂真 HTTP | (a) 逐笔 reject **200**（零资金 + `rejected` + job 仍 `open`）✅ · (b) 不带提交号 **409**（整单 `refundJob` 腿，零回归）✅ · (c) 非发布者 **403** ✅ |
| 6 | 判负 | **≥2（实测 5 项）**；含 brief 指定「去掉分支 ⇒ 带提交号判不合格变整单退」的承载对照（**200 vs 409**） |
| 7 | 同族扫面 | `refundJob(` 全仓 **6 处**：生产 **2 处**（`/review` 无提交号腿 = 本单改动处；`/cancel` = 取消语义，**非「判不合格」**）+ 脚本 **4 处**（越出面）⇒ **无其它「判不合格当整单退」的漏点** |
| 8 | 净写 | **资金面净写 0**（`ledger_entry` 364 不变 · Σbalance `2029986` 不变 · Σfrozen `10344` 不变 · job22 `open`/escrow `251` 不变）；★ 业务面新增 2 条提交行（210/211，均 `rejected`）= 逐笔臂的**目标写**（详见 §6） |
| 9 | 收尾 | 5793–5799 **空读数**；5787(30475)/5788(65096) **未启停**；按精确 PID `kill -TERM`，未用 `pkill -f`/`killall` |

---

## §1 修前事实（严重错误的机制）

**现取**（改前 `index.ts:2461`）：

```ts
const result = approved
  ? await settleJob({ jobIdRaw, submissionIdRaw, reviewerUid: actor.user.uID })
  : await refundJob({ jobIdRaw, toStatusRaw: 'rejected', reviewerUid: actor.user.uID });
```

⇒ `approved:false` **恒走 `refundJob`**（**整单退**：退未用完份额 + `job.status → 'rejected'`），**与是否带提交号无关**。
⇒ 前端（S7 并行面，现取 `frontend/src/pages/jobs/job-api.js:89`：`postJson('/api/job/${jobId}/review', { approved, submission_id })`）对**单条提交**判「不合格」时，会**误退整单的钱 + 把任务取消** ⇒ **严重错误**（与 `R-9-99`「判不合格 = 零资金 + 该提交转 `rejected` + 任务保持 `open`（本人可再提）」直接冲突）。

---

## §2 交付内容（`index.ts` · 唯一改动文件）

**分支化后的 `POST /api/job/:jobId/review`**（`index.ts:2457`）：

| body | `approved` | 走向 | 语义 |
|---|---|---|---|
| 带提交号 | `true` | `settleJob({submissionIdRaw})`（S6 已接） | 逐笔发放（结论位 + 资金同语句 · R4 原子） |
| **带提交号** | **`false`** | **`DatabaseService.rejectJobSubmission`**（S4a 已入库 · **未另写**） | **逐笔判不合格**：零资金 · 该提交 `review_status='rejected'` · **job 保持 `open`** |
| 不带提交号 | `true` | `settleJob({jobIdRaw, reviewerUid})`（遗留单笔） | **现行为不变（零回归）** |
| 不带提交号 | `false` | `refundJob({toStatusRaw:'rejected'})` | 整单退（旧语义）**不变（零回归）** |

- **提交号字段**：canonical `submission_id`，兼容别名 `submissionId`（沿用 S6 约定；三者全缺 ⇒ 遗留分支）。
- **`rejectJobSubmission` 入参/返回形状（现取后直用，未另写）**：`{ submissionId: number; reviewedBy: number; reviewMemo: string }` ⇒ 返回**落定的 `submission_id`**（未命中 / 非 `pending` ⇒ `0`）。实现 = 单条 `UPDATE … WHERE submission_id=$1 AND review_status='pending' RETURNING submission_id`（`database.ts:3450`）。
- **准入不变**：仍 `requireJobOwnerOrAdmin`（**未改一行**）⇒ 发布者本人 ∨ `review_tasks` admin。
- **错误面**（`sendVerbError` · R107 形状 · 零新增码 / 零新增 reason）：
  - 非数字 / 空提交号 ⇒ `404 LEDGER_REF_NOT_FOUND`（`ref_type=job_submission`, `reason=submission_not_found`，与 `settleJob` 的提交号校验**同形**）；
  - 提交**不属于本 job** ⇒ 同 404（**归属校核**，见下）；
  - 提交已非 `pending`（重复判定）⇒ `409 LEDGER_CURRENCY_INVALID_TRANSITION`（`field=job_submission.review_status`, `reason=job_review_status_invalid`）。
- **成功面**：返回 `getTaskProgress(submissionId)`（**9 键 `TaskProgressRecord`**）——与既有 admin 驳回面 `index.ts:2006` 同源同形（`jID`=`submission_id`）。
- ★ **越出 brief 的一处薄改（登记待 Zang 复核）**：新增**归属校核** `resolveReviewTarget(submissionId).jobId === :jobId`（一次只读）——防「**以 job A 的雇主权驳回 job B 的提交**」跨 job 越权。实测 `NEG_crossjob_subid`（job22 雇主送 job15 的 sub12）⇒ **404**（非越权落地）。若 Zang 认为属越出面，可一行摘除（不影响本单三臂）。

---

## §3 三臂真 HTTP 读数（受控实例 5796 · 真库 0041）

原始输出：`.p9s12-arms/arms-out.json`（探针 `.p9s12-arms/arms.ts`）。夹具 = **job22**（`open` · employer `uid3` · headcount 1 · escrow `251` · reward 1）。

### 夹具（保护 S6 口径）
以 **uid5（非 admin 打工人）** 向 job22 提交两份新交付物（`POST /api/job/22/submit`）⇒ 新提交 **210 / 211**（`pending`）。
★ **submission 97（S6 夹具）自始至终 `pending` 未被触碰**（跨臂核对见 §5）。

### 臂 (a) 发布者本人 + 提交号 + `approved:false` ⇒ **逐笔判不合格** ✅
```
POST /api/job/22/review   token=uid3(雇主)   body={"approved":false,"submission_id":210}
⇒ 200  {"success":true,"message":"Job submission rejected",
        "data":{"jID":210,"tID":22,"uID":5,"info_input":"p9s12 arm-a fresh deliverable …",
                "time_checked":1791071151, …}}   （9 键 · 与 admin 驳回面同形）
```
对拍（臂前后）：
```
ledger_entry 364 → 364   Σbalance 2029986 → 2029986   Σfrozen 10344 → 10344   （★ 零资金位移）
submission 210: pending → rejected （reviewed_by=3 · memo="job reject:22:210"）
job22: open → open        （★ 任务保持 open · 本人可再提）
pending_count 2 → 1       （210 进队 → 离队）
```
- **别名臂**：`{"approved":false,"submissionId":211}` ⇒ **200** · 211 → `rejected`（canonical / 别名等价）。

### 臂 (b) 发布者本人 + `approved:false`（**不带提交号**）⇒ **仍整单退**（零回归）✅
```
POST /api/job/22/review   token=uid3   body={"approved":false}
⇒ 409  LEDGER_CURRENCY_INVALID_TRANSITION
```
- **资金读数（真库 0041）**：`refundJob({toStatusRaw:'rejected'})` 恒先撞 `job_status_transition_ok('open','rejected')=false` ⇒ `409`（含 `job.status` 腿）。**job22 状态 / 资金全无变化**（s3 对拍 = s2）。
- ★ **补充资金腿读数（事务内 ROLLBACK · 零持久写）**：`.p9s12-arms/fund-leg.ts` 直调 `refundJob`：
  - `refund(22,'rejected')` ⇒ 409 `{field:job.status, from:open, to:rejected, reason:JOB_STATE_INVALID}`；
  - `refund(4,'rejected')` / `refund(15,'rejected')`（`submitted` 边合法 · 但未托管）⇒ 409 `{field:job.escrow_txid, reason:job_escrow_missing, status:submitted}`；
  - 三条 `ledger_entry 364 → 364`（ROLLBACK 后零持久写）。
  ⇒ **坐实无提交号分支仍真调 `refundJob`（整单资金腿）**；0041 上无 job 可被 refund（与 S6 §6 同因：`open→rejected` 非法 / 未托管）⇒ 读数 = 资金腿错误，**零资金**。

### 臂 (c) 非发布者（已登录 · 非 admin）+ 提交号 ⇒ **拒** ✅
```
POST /api/job/22/review   token=uid6(非雇主·非admin)   body={"approved":false,"submission_id":97}
⇒ 403  AUTH_FORBIDDEN   details={"reason":"NOT_ADMIN"}
```
submission 97 **仍 `pending`**（准入在写路径之前拦截 ⇒ 零副作用）。

---

## §4 判负（≥2 · 实测 5 项）

| # | 判负 | 读数 | 若改坏 ⇒ 必红 |
|---|---|---|---|
| ① **（brief 指定 · 承载）** 去分支 ⇒ 带提交号的判不合格变整单退 | **Arm(a)=200（该提交 `rejected`）** vs **Arm(b)=409（整单 `refundJob` 腿）** | 若摘除 `hasSubmission && !approved` 分支 ⇒ Arm(a) 塌回 Arm(b) 的 **409**，且 210 **停留 `pending`** ⇒ 两读数不再分离 ⇒ **必红** |
| ② 准入闸 | uid3(雇主) ⇒ 200（Arm a）；uid6(非雇主·非admin) ⇒ **403 NOT_ADMIN**（Arm c） | 若摘除 `requireJobOwnerOrAdmin` ⇒ Arm(c) 变 200/409 ⇒ **必红** |
| ③ 提交号转发 / 形状校验 | `{approved:false, submission_id:'abc'}` ⇒ **404 job_submission/submission_not_found** | 若不转发 / 不校验 ⇒ 变整单腿 409 ⇒ **必红** |
| ④ 一次写定（guard） | 已 `rejected` 重判 ⇒ **409 job_review_status_invalid{from:rejected}** | 若允许重复写 ⇒ 空操作或双写 ⇒ **必红** |
| ⑤ 归属校核（本单薄改） | job22 雇主送 job15 的 sub12 ⇒ **404**（非越权落 job15） | 若去掉校核 ⇒ sub12 会被判 `rejected` ⇒ **必红** |

---

## §5 待审面同步（③）

`listPendingVerification` / `countPendingVerification`（`database.ts:4009/4057`，S4a 已换**提交轴**）在同一次臂内的一致读数：

| 时点 | `countPendingVerification`（DB） | `listPendingVerification` 的 `jID` 列表 | HTTP `/pending-verification/count` |
|---|---|---|---|
| s0（基线） | 1 | `[5]` | — |
| s1（uid5 提交 210 后） | **2** | `[210, 5]` | — |
| s2（逐笔判不合格 210 后） | **1** | `[5]` | — |
| 终态 | 1 | `[5]` | **1**（token=970213） |

- **一致**：新 `pending` 提交**入队**（1→2），逐笔判不合格后**离队**（2→1）；两读口同源同轴，HTTP 与 DB 同值。
- ★ 说明：submission 97（worker uid1 = `is_admin`）**结构性不进队列**（两读口均 `COALESCE(u.is_admin,false)=false`）⇒ 故用**非 admin** 的 uid5 造夹具才可观测入/离队。

---

## §6 净写口径（④）

- **资金面（本腿「零资金」核心）净写 = 0**：`ledger_entry` **364 → 364**；`Σbalance 2029986` 不变；`Σfrozen 10344` 不变；job22 `status=open` / `escrow_txid=251` / `ledger_event_keys` 不变。
- **业务面（逐笔臂的目标写，非「净写」反例）**：`job_submission` 新增 **2 行**（210/211，均 `pending→rejected`，`reviewed_by=3`）。★ 这是 **brief 臂 (a) 的验收要求本身**（「该提交 `review_status='rejected'`」）；且表有 `job_submission_no_delete` 触发器（`0014_job_flow.sql:295`）⇒ **不可回删**（结构上不可能对业务面做到字面 0 写）。**S6 夹具 submission 97 未被触碰**（仍 `pending`）⇒ 不破坏 S6 的 `0042` 复测前提。
- 基线与终态对拍（`.p9s12-recon/final.ts`）：`schema_version=0041` · `ledger_entry=364` · `Σbal=2029986` · `Σfrozen=10344` · job22 `open`/`251`。

---

## §7 同族扫面（全仓 `refundJob(` 调用点 + 判定）

`grep -rn "refundJob(" backend-ts/src backend-ts/scripts frontend/src`：

| # | 位置 | `to_status` | 判定 |
|---|---|---|---|
| 1 | **`backend-ts/src/index.ts:2502`**（`/review` **不带提交号**腿） | `rejected` | **整单退语义 · 设计如此**（无提交号 = 整单判定）⇒ **无需改**（本单只把「**带提交号**」腿分流到 `rejectJobSubmission`；不带提交号腿**逐字保留**） |
| 2 | `backend-ts/src/index.ts:2548`（`POST /api/job/:jobId/cancel`） | `cancelled` | **取消语义**（非「判不合格」）⇒ **无需改** |
| 3–6 | `backend-ts/scripts/p4z-b3c-02-e2e.ts:242/248/249/250` | `cancelled`/`bogus` | **探针脚本**（旧 e2e 负例）⇒ **越出本单面，登记不动** |

- 另核：**「判不合格」的另两处落点**均已正确 —— `job-funds-service.ts:394`（`verifyJobSubmission` reject 腿 ⇒ `rejectJobSubmission`，admin 通道）与 `job-funds-service.ts:423`（settle）**本就按提交逐笔**；`compliance-review-service.ts` 的 `refund` 属**平台仲裁**（支持打工人 ⇒ 整单退，**语义不同**，非漏点）。
- **结论**：除本单修改的 1 处外，**无其它「把单条判不合格当整单退款」的生产漏点**；登记项 = 脚本 #3–6（越出面）。

---

## §8 硬口径与收尾

- ✅ `tsc --noEmit` = **0**（EXIT=0）。
- ✅ 改动面**仅** `backend-ts/src/index.ts`（+43 / −4）；**未碰** `job-funds-service.ts` / `job-service.ts` / `commission.ts` / `migrations/**` / `frontend/**`（S7 并行面：`JobDetailPage.jsx`/`job-api.js`/`locales/*.json` 的 `M` 是 **S7 的既有改动**，**非本单**）/ `scripts/*.ts` / `docs/*.spec.md`。
- ✅ **未 commit / 未 push**。
- ✅ 探针在 `backend-ts/.p9s12-recon/` + `backend-ts/.p9s12-arms/`（**未放 `scripts/`**）；原始输出 `.json`（**无 `.log` 后缀**）。
- ✅ 连库只从主仓 `.env.local`（经 `src/env`）；**未复制 / 未回显**连接串 / 密钥 / token。
- ✅ **未 apply `0042`**（真库仍 `0041`）；**未 `npm install`**。
- ✅ 收尾：`lsof -nP -iTCP:5796 -sTCP:LISTEN` ⇒ **空读数**（`kill -TERM 96916` + npx 外壳 `96536`，未用 `pkill -f`/`killall`）；`5793-5799` 全空；**5787(30475)/5788(65096) 未启停**。
- ★ **「`--strictPort`」说明**：该标志属**前端 vite**（`frontend/vite.config.js`）；后端为 Express（`app.listen(PORT)`）**无该标志** ⇒ 受控实例按本仓后端既有惯例 `PORT=5796 npx ts-node --transpile-only src/index.ts` 起，端口独占以 `lsof` 保证（5796 起前 = 空、收后 = 空）。

---

## §9 未测项 / 登记（交 Zang）

| # | 项 | 说明 |
|---|---|---|
| 1 | 「逐笔判不合格」的**端到端资金反证** | 本腿**零资金** ⇒ 无需 `0042` 即可全绿（已完成）；逐笔**发放**（`approved:true` + 提交号）的端到端真发放仍依赖 `0042`（S6 §6 既有结论，不在本单面）。 |
| 2 | `/review` 逐笔 reject 的**成功面键集** | 取 `TaskProgressRecord`（9 键，与 admin 驳回面同形）；**spec 未冻结**「逐笔 reject 成功键集」（Q7 冻结的 15 键 = **approve** 面）⇒ **待 Jing 回写**。 |
| 3 | **归属校核**（`resolveReviewTarget.jobId === :jobId`） | 本单**越出 brief 的薄增**（防跨 job 越权）⇒ **待 Zang 复核**（一行可摘；不影响三臂）。 |
| 4 | 同族扫面登记项 | `scripts/p4z-b3c-02-e2e.ts` 的 4 处 `refundJob(`（旧 e2e 负例）⇒ **越出面，未动**。 |

---

## §10 改动清单（工作树）

| 文件 | 变更 | 说明 |
|---|---|---|
| `backend-ts/src/index.ts` | `+43 / −4` | `/review` 分支化：带提交号 + `approved:false` ⇒ `rejectJobSubmission`（逐笔 · 零资金 · 该提交 `rejected` · job 保持 `open`）；带提交号 + `approved:true` ⇒ `settleJob`；不带提交号 ⇒ 现行为零回归；+ 归属校核 + 注释登记 |
| `backend-ts/.p9s12-recon/` | 新增（untracked） | `recon.ts`·`recon2.ts`·`recon3.ts`·`recon4.ts`·`final.ts`（只读侦察） |
| `backend-ts/.p9s12-arms/` | 新增（untracked） | `arms.ts`+`arms-out.json`（三臂/判负）· `fund-leg.ts`+`fund-leg-out.json`（资金腿事务探针）· `server.out` |
| `docs/audit/s6b-per-submission-reject.md` | 新增 | 本报告 |
