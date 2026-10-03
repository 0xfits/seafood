# S6 · 后端补两个口（逐条提交读口 + review 逐笔）— 交付与自证报告

- 单号：**S6-BACKEND-REVIEW-SUBMISSIONS**
- 角色：**Kong（实现）**
- 开工 HEAD：`9c13cec`（= `feat(task-model): S5① …+ S4e 补验 R-9-102 refund 真链路`）
- 真库：**`schema_version = 0041`**（`0042` 未 apply，本单未 apply；`/health` 现取自报）
- 受控实例：**`PORT=5796`**（`npx ts-node --transpile-only src/index.ts`，PID 87172；收尾已 `kill -TERM`）
- 改动面：**`backend-ts/src/index.ts`（+37/−1）· `backend-ts/src/database.ts`（+59/−0）**；探针 `.p9s11-recon/` + `.p9s11-arms/`；本报告。**未 commit / 未 push**。

---

## §0 结论速览

| # | 事项 | 结果 |
|---|---|---|
| 1 | `tsc --noEmit` | **0**（`npx tsc --noEmit -p tsconfig.json`，EXIT=0） |
| 2 | ① `GET /api/job/:jobId/submissions`（按 spec 冻结路径） | **已注册**；发布者本人 200、非本人无权限 **403**、无 token 401、任务不存在/非数字 404 |
| 3 | ② `POST /api/job/:jobId/review` 支持逐笔 | **已改**：body 收 `submission_id`（别名 `submissionId`）→ **转发 `submissionIdRaw` 给 `settleJob`**；不带 ⇒ 旧调用逐字走遗留分支（**零回归**） |
| 4 | 三臂真 HTTP | (a) 200 ✅ · (b) 拒 ✅ · (c) **转发已证**（真读数）；★ **但「逐笔发放生效」被 `0042` 未 apply 阻断**（详见 §6） |
| 5 | 判负 ≥2 | **≥3**（§5，含 brief 指定的「不传提交号 ⇒ 遗留分支」对照） |
| 6 | 同族扫面 | 生产面仅 2 处调 `settleJob`：`index.ts:2452`（**本单修**）+ `job-funds-service.ts:423`（已传提交号）；其余仅探针/脚本（§7） |
| 7 | 净写 | **0**（`ledger_entry` 364 全臂不变；Σbalance/Σfrozen 不变；job/submission 状态不变） |
| 8 | 收尾 | 5793–5799 **空读数**；5787(30475)/5788(65096) **未启停**；按精确 PID `kill -TERM`，未用 `pkill -f`/`killall` |

---

## §1 交付内容

### ① 新读口 `GET /api/job/:jobId/submissions`（`index.ts`）

- **路径 = spec 已冻结**（`docs/data-layer.spec.md:281`：「路由 `GET /api/job/:jobId/submissions`」）⇒ 逐字照用，**未另定形态**。
- **准入**：**复用既有 `requireJobOwnerOrAdmin`（不另写）** ⇒ 判定序：① 无 token ⇒ `401 AUTH_UNAUTHORIZED`；② `:jobId` 非数字 / job 不存在 ⇒ `404 LEDGER_REF_NOT_FOUND`（`ref_type=job`，`reason=job_not_found`）；③ 雇主本人 ⇒ 放行；④ 否则既有 admin 通道（`requireAdmin('review_tasks')`）；⑤ 皆不满足 ⇒ `403 AUTH_FORBIDDEN` + `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`（**零新增码 / 零新增 reason**）。
- **数据源**：新增只读方法 `DatabaseService.listJobSubmissions(jobId, skip, limit)`（`database.ts`）——`SELECT … FROM public.job_submission WHERE job_id = $1 ORDER BY submission_id DESC`，**只读、无副作用**。分页走既有 `getPagination`（`skip`/`limit`）。
- **响应形状**（`sendSuccess(res, items)` ⇒ `data` = 数组，逐条 9 键）：
  `submission_id · job_id · worker_uid · deliverable · review_status · reviewed_by · reviewed_at · review_memo · time_created`
  （时间列 = **epoch 秒**，与 `TaskProgressRecord` 同口径；未审 `reviewed_by=null`、`reviewed_at=0`）
- **隐私面**：响应含 `deliverable` 正文 ⇒ 置 `Cache-Control: private, no-store`（沿 R-9-86 同向）。
- ★ **返回形状 / 字段名 spec 未冻结 ⇒ 待 Jing 回写**（见 §2）。

### ② `POST /api/job/:jobId/review` 支持逐笔（`index.ts`）

- **改动**：body 增可选提交号 —— 取 `req.body?.submission_id ?? req.body?.submissionId`，**原样转发**给 `settleJob({ jobIdRaw, submissionIdRaw, reviewerUid })`（approve 腿）。S4a 已在服务层备好 `submissionIdRaw`（键/指纹含提交号、`review_status='approved'` 与资金同一语句）。
- **零回归**：不带提交号 ⇒ `submissionIdRaw = undefined` ⇒ 服务层落**遗留单笔分支**（键 `biz:job:settle:<jobId>`），与改前逐字同义。样例面（`settleJob` 签名处）现取复核无歧义。
- **准入不变**：仍是 `requireJobOwnerOrAdmin`（发布者本人 ∨ `review_tasks` admin）。
- ★ **最小变体 + 待 Jing 回写**（见 §2）。
- ★ **逐笔 reject 不接线（越出本单面，登记交 Zang）**：`approved === false` 恒走 `refundJob` 整单退（旧语义），**不因带提交号而改为按提交判不合格**。理由：本单面只授权「转发 `submissionIdRaw` 给 `settleJob`」；「按提交判不合格」的现成实现 = `verifyJobSubmission` 的 reject 腿（`/api/tasklist/:jID/verify`，admin-only）⇒ 是否把它接到发布者面**属新裁定**。**风险提示**：S7 前端若对单条提交发 `{approved:false, submission_id}`，当前会落**整单退**（非按笔驳）——请 Zang 裁决是否补 reject 逐笔腿。

---

## §2 spec 现取（形态冻结判定）

| 口 | spec 现取事实 | 判定 |
|---|---|---|
| `GET /api/job/:jobId/submissions` | `data-layer.spec.md:281` **只冻结路径**（「拆两条：`job_application`（报名）与 `job_submission`（提交/审核）；路由 `GET /api/job/:jobId/applications`、`GET /api/job/:jobId/submissions`」）。**返回形状/字段名未冻结**（全仓 grep：该路径仅出现在 spec 的该行，无形状条文）。 | 路径照用；**形状取最小列集** ⇒ **待 Jing 回写 spec**。 |
| `POST /api/job/:jobId/review` | 已冻结面 = **路径 + body `{approved}` + 成功键集 15 键**（`route-layer.spec` 现取：`p4-b4a-route-registration.md:33`「`body.approved`；admin + `review_tasks`」；`§1.11 Q7`「A5 新路径键集 = `jobEventView`（15 键）」；`data-layer.spec.md:594` 幂等键行）。**「提交号字段名」未冻结**。 | **未冻结 ⇒ 取最小变体 `{approved, submission_id}`（别名 `submissionId`）** ⇒ **待 Jing 回写 spec**。 |

> ★ 登记：本单**未自造**路径（`/submissions` = spec 版本）、**未自造**错误码 / reason（零新增）、**未改**任何 `*.spec.md`。两个「待回写」项均为**形态补齐**（字段名 / 响应形状），非语义新增。

---

## §3 准入惯例现取（403 vs 404）

| 参照 | 现取事实 | 含义 |
|---|---|---|
| **同族读口** `GET /api/task-progress/:jID`（`index.ts:885`） | 注释逐字：「已登录但**非提交者** ⇒ **404**（与 miss 分支同形，不泄漏存在性；★ 不用 403）」 | 这是「**读他人私有资源**」的读口惯例 = **404** |
| **「雇主 ∨ 权限」归属闸** `requireJobOwnerOrAdmin`（`index.ts:2289`） | 拒绝形态 = **既有 `403 AUTH_FORBIDDEN` + `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`**（`R-8-25①` · `route-layer.spec` §25.6） | 这是**同一准入规则**（雇主∨`review_tasks`）的**已冻结形态** = **403** |

- **本单选择 = 403**：① brief 明令「**复用既有准入助手（`requireJobOwnerOrAdmin`）而非另写**」⇒ 助手输出即 403；② 该助手正是本口所需「雇主∨权限」规则的唯一既有实现，其 403 形态已冻结（零新增码/reason）；③ 与 `:jID` 的 404 属**不同规则**（那个是「仅提交者」，本口是「雇主∨admin」），且 **job 是公开对象**（列表可见）⇒ 存在性非秘密。
- ★ **登记待 Zang 复核**：若 Zang 要本读口与 `:jID` 一致改**404**（不泄漏「提交是否存在」），本单可一行切换（改为落 `sendRefNotFound`），但会**偏离** `requireJobOwnerOrAdmin` 的既有 403 形态。**现取实测 = 403（见 §4 R_nonowner）。**

---

## §4 三臂真 HTTP 读数（受控实例 5796 · 真库 0041）

原始输出：`.p9s11-arms/arms-out.json` · `.p9s11-arms/arms2-out.json`（探针：`.p9s11-arms/arms.ts` · `arms2.ts`）。

### 臂 (a) 发布者本人读自己的提交列表 ⇒ 200 + 逐条字段齐 ✅

```
POST/GET /api/job/22/submissions   token=uid3(雇主)   ⇒ 200
data = [ { submission_id:97, job_id:22, worker_uid:1,
           deliverable:"p9s9-s3 submit arm (S3 route layer)",
           review_status:"pending", reviewed_by:null, reviewed_at:0,
           review_memo:"", time_created:1791037353 } ]   （字段齐 9/9）
```
- 另臂：持 `review_tasks`（uid 970213）读 ⇒ **200**（admin 通道保留 ✅）。

### 臂 (b) 非发布者（已登录）读 ⇒ 按本仓惯例拒 ✅

```
GET /api/job/22/submissions   token=uid5(已登录·非雇主·非admin) ⇒ 403
error = { code:"AUTH_FORBIDDEN", i18n_key:"auth.err.AUTH_FORBIDDEN",
          details:{ reason:"NOT_ADMIN" } }
```
- 无 token ⇒ **401**（`AUTH_UNAUTHORIZED`）；任务不存在（`/api/job/99999999/submissions`）⇒ **404**（`ref_type=job`,`reason=job_not_found`）；非数字 jobId（`abc`）⇒ **404**（同形）。

### 臂 (c) 发布者本人带提交号调 `/review` ⇒ 逐笔

> ★ **转发已真证；「逐笔发放生效」被 `0042` 未 apply 阻断（见 §6）。** 两读数如下：

**(c-1) 转发承重证据（路由确实把提交号传到了服务层）**：
```
POST /api/job/22/review  token=uid3  body={approved:true, submission_id:"abc"}  ⇒ 404
error.details = { ref_type:"job_submission", ref_id:"abc", field:"submission_id",
                  reason:"submission_not_found", job_id:"22" }
```
- 该 404 只能来自 `settleJob` 的**提交号校验**（`job-funds-service.ts:251-253`：非数字 ⇒ `ref404('job_submission', …)`）⇒ **证明路由转发了 `submissionIdRaw`**（若不转发，`settleJob` 走遗留分支 ⇒ 见 (c-2) 是 409 而非此 404）。**对照读数见 §5 判负①。**

**(c-2) 真库 `0041` 上的实发放 = 被阻断（真读数）**：
```
POST /api/job/22/review  owner=3  {approved:true, submission_id:97}  ⇒ 409
POST /api/job/22/review  owner=3  {approved:true}                    ⇒ 409   （遗留对照）
   error.code = LEDGER_CURRENCY_INVALID_TRANSITION
POST /api/job/15/review  owner=3  {approved:true, submission_id:12}  ⇒ 409
POST /api/job/4/review   owner=970101  {approved:true}               ⇒ 409 LEDGER_INSUFFICIENT_FROZEN
POST /api/job/4/review   owner=970101  {approved:true, submission_id:4} ⇒ 409 LEDGER_INSUFFICIENT_FROZEN
```
- **`ledger_entry` 364 → 364**、Σbalance `2029986` 不变、Σfrozen `10344` 不变、job/submission 状态不变 ⇒ **净写 0**。**根因见 §6。**

---

## §5 判负（≥2，含 brief 指定对照）

### 判负①（brief 指定 · 承重）「`/review` 不传提交号 ⇒ 走遗留分支」对照
| 调用 | 读数 | 说明 |
|---|---|---|
| `{approved:true, submission_id:"abc"}`（带提交号） | **404 `job_submission`/`submission_not_found`** | 服务层**收到**提交号并校验 ⇒ 转发生效 |
| `{approved:true}`（不带） | **409 `LEDGER_CURRENCY_INVALID_TRANSITION`** | 服务层**未收**提交号 ⇒ 落遗留分支 |
- **承重**：若路由**不转发** `submissionIdRaw`，第一行会退化为第二行（409）⇒ 判据必红。**实测两读数不同 = 转发改动承重。**

### 判负②（承重）读口准入闸
| 调用 | 读数 |
|---|---|
| uid3（雇主本人）读 job22 | **200** |
| uid5（已登录·非雇主·非 admin）读 job22 | **403 `AUTH_FORBIDDEN`/`NOT_ADMIN`** |
- **承重**：若摘除 `requireJobOwnerOrAdmin`（改直通），第二行会 200 ⇒ 判据必红。

### 判负③（承重 · 对 `0042` 依赖的证伪）带/不带提交号在 0041 上同形
- `job4` 带提交号与不带提交号 ⇒ **同一 `LEDGER_INSUFFICIENT_FROZEN`**；`job22` 带/不带 ⇒ **同一 `LEDGER_CURRENCY_INVALID_TRANSITION`**。
- **含义**：`0041` 的 `job_post_event` **不含提交轴** ⇒ 同一 job 的「带提交号」请求**不会**派生含提交号的事件根键 ⇒ **逐笔不生效**（这正是 §6 的阻断机制的判负侧坐实）；`0042` apply 后此两读数应**分化**（键含提交号、按提交者发放）。

---

## §6 ★ 阻断发现（最关键 · 交 Zang）

**「逐笔发放生效」在真库 `0041` 上无法观测**——与本单代码无关，是**迁移 `0042` 未 apply** 的结构性结果。两处真读数 + 机制：

1. **`open → settled` 边非法**（新模型任务多为 `open`）：`0013` 的 `job_status_transition_ok` 仅允许 `{accepted,submitted,disputed}→settled`；`open→settled` 由 **`0042` 才新增**。现取 `SELECT job_status_transition_ok('open','settled')` ⇒ **`false`** ⇒ `job22`（open）settle ⇒ **409**。
2. **发放锚点缺失**：`0041` 的 settle 分支用 **`job.worker_uid`** 作发放锚点（`job_settle_plan(..., v_job.worker_uid, ...)`），而新模型（`R-9-99` 起）任务的 **`worker_uid` 恒为 `NULL`**（现取：job 14/15/22 皆 `NULL`）⇒ `job_settle_plan` 触发 `p_worker IS NULL ⇒ not_job_worker` ⇒ **409**。**逐笔的「按该提交者发放」正由 `0042` 引入**（读 `payload->>'submission_id'`）。
3. **现取函数体自证**：真库 `pg_get_functiondef('public.job_post_event')` **不含 `submission_id`**（`has_submission_id=false`）、settle 键形仍 `biz:job:settle:<job_id>`（**无提交号**）。
4. 唯一 settle-可行态（旧模型 `job4`：`submitted` 且 `worker_uid` 已设）⇒ 却因**未托管**（`escrow_txid IS NULL`）⇒ `LEDGER_INSUFFICIENT_FROZEN`。**故 `0041` 上无任何 job 可被 settle。**

⇒ **S6 代码正确且转发承重（§4/§5 已证）；逐笔发放的端到端真读数依赖 `0042` apply（`R-9-98/101/102` 的 DB 函数体）。** S4a 已在 `0042` 函数体内证其真链路（26/26 全绿，见 master-plan §5.320）。

**复现命令（`0042` apply 后由 Zang 复测）**：
```
cd backend-ts && PORT=5796 npx ts-node --transpile-only src/index.ts &
# 取一个 open 且 headcount≥1、有 pending 提交的 job（雇主本人 token）：
curl -s -X POST http://127.0.0.1:5796/api/job/<JOB>/review \
     -H "authorization: Bearer <雇主token>" -H 'content-type: application/json' \
     -d '{"approved":true,"submission_id":<SUB>}' | jq
# 期望：200；ledger_idempotency_key = biz:job:settle:<JOB>:<SUB>；该提交者 +一份 reward；该提交 review_status=approved
# 判负：第二次以另一 <SUB'> 调 ⇒ 不得判重放（键含提交号）
```

---

## §7 同族扫面（全仓 grep：以 `jobId` 调 `settleJob`/`reviewJobSubmission` 而未传提交号？）

`grep -rn "settleJob("`（排除 node_modules/.git）：

| # | 位置 | 传提交号？ | 判定 |
|---|---|---|---|
| 1 | **`backend-ts/src/index.ts:2452`**（`/api/job/:jobId/review`） | 改前 **✗** | **本单修**：增 `submissionIdRaw` 转发（不带 ⇒ 遗留分支，零回归） |
| 2 | `backend-ts/src/job-funds-service.ts:423`（`verifyJobSubmission` → `/api/tasklist/:jID/verify`） | **✓**（`submissionIdRaw: target.submissionId`） | 已正确，**无需改**（admin-only 通道保留） |
| 3 | `backend-ts/scripts/p4z-b3c-02-e2e.ts:251` | ✗（`{jobIdRaw:'99999999'}` 负例探针） | 探针，越出面 ⇒ 登记不动 |
| 4 | `.p9s5-impl/`·`.p9s5q/`·`.p9s10-s4a/` 等历史探针 | 视臂而异 | 探针/脚本，**越出本单面** ⇒ 登记交 Zang |

`grep -rn "reviewJobSubmission("`：仅 `job-funds-service.ts:342`（`dispatchJobEvent` 内，逐笔时 payload 已带 `submission_id`）+ `database.ts:3367`（定义）+ `dist/`（构建产物）。**无遗漏的未传提交号的生产调用点。**

`refundJob` 同族（`index.ts` review reject 腿 / cancel 腿）= **整体退语义**，按设计不含提交号 ⇒ 非缺口（逐笔 reject 另登记，见 §1②）。

---

## §8 硬口径与收尾

- ✅ `tsc --noEmit` = **0**（EXIT=0）。
- ✅ 改动面仅 `index.ts`（+37/−1）· `database.ts`（+59/−0）；**未碰** `job-funds-service.ts`/`job-service.ts`/`commission.ts`/`migrations/**`/`frontend/**`/`scripts/*.ts`/`docs/*.spec.md`（`git status --porcelain` 对本清单 = **空**）。
- ✅ **未 commit / 未 push**。
- ✅ 探针在 `backend-ts/.p9s11-recon/` · `backend-ts/.p9s11-arms/`（**未放 `scripts/`**）；原始输出 `.json`（**无 `.log` 后缀**）。
- ✅ 连库只从主仓 `.env.local`（经 `src/env`）；**未复制 / 未回显**连接串 / 密钥 / token（探针只打印机读字段）。
- ✅ **未 apply `0042`**（真库仍 `0041`）；**未 `npm install`**。
- ✅ 收尾：`lsof -nP -iTCP:5796 -sTCP:LISTEN` ⇒ **空读数**（`kill -TERM 87172`，未用 `pkill -f`/`killall`）；`5793-5799` 全空；**5787(30475)/5788(65096) 未启停**。
- ✅ 净写 **0**（`ledger_entry` 364 · Σbalance · Σfrozen · job/submission 状态全臂前后一致）。
- ★ **「`--strictPort`」说明**：该标志属**前端 vite** 配置（`frontend/vite.config.js:39`）；后端为 Express（`app.listen(PORT)`，`index.ts:91/2928`）**无该标志**。本单受控实例按本仓后端既有惯例 `PORT=5796 npx ts-node --transpile-only src/index.ts` 起，端口独占校验以 `lsof` 保证。

---

## §9 未测项（写原因）

| # | 未测项 | 原因 |
|---|---|---|
| 1 | 臂 (c) **「逐笔发放生效」的端到端真发放**（键含提交号、按提交者发放） | **`0042` 未 apply ⇒ 真库 `job_post_event` 无提交轴 + `open→settled` 非法 + 新模型 `worker_uid` NULL**（§6）。本单不得 apply `0042`（硬口径⑤）⇒ 无法在真库观测。**转发已真证**（§4 c-1 / §5 判负①）；`0042` apply 后按 §6 复现命令复测。 |
| 2 | 逐笔 **reject**（带提交号按提交判不合格） | **越出本单面**（brief 只授权转发 `submissionIdRaw` 给 `settleJob`）⇒ 登记交 Zang（§1②）。现成实现 = `verifyJobSubmission` reject 腿（admin-only）。 |
| 3 | 同 job **多提交**下「不同提交号不再互判重放」 | 真库无（job 14/15/22 各仅 1 条提交）多提交夹具；且该行为由 `0042` 提供（未 apply）⇒ 与 #1 同因。 |
| 4 | `submission_id` 别名 `submissionId` 的前端实际字段名 | S7 前端未接线；本单取 canonical `submission_id` + 别名兼容 ⇒ **待 Jing 回写 spec 定名**。 |
| 5 | 读口准入 `403`（复用助手）与 `:jID` 读口 `404` 惯例的最终口径 | 二惯例并存（§3）⇒ 本单按「复用 `requireJobOwnerOrAdmin`」取 **403**；**待 Zang 复核**是否统一为 404（一行可切）。 |

---

## §10 改动清单（工作树）

| 文件 | 变更 | 说明 |
|---|---|---|
| `backend-ts/src/index.ts` | `+37 / −1` | ① 新注册 `GET /api/job/:jobId/submissions`（复用 `requireJobOwnerOrAdmin` + `listJobSubmissions` + `private,no-store`）；② `/review` 增收 `submission_id`(别名 `submissionId`) 并转发 `submissionIdRaw`；③ 注释块登记两处「待 Jing 回写」+ 逐笔 reject 缺口 |
| `backend-ts/src/database.ts` | `+59 / −0` | ① 新 `interface JobSubmissionRecord`（9 键）；② 新只读 `DatabaseService.listJobSubmissions(jobId, skip, limit, ex?)` |
| `backend-ts/.p9s11-recon/` | 新增（untracked） | `recon.ts`·`recon2.ts`·`recon3.ts`·`recon4.ts`（只读侦察） |
| `backend-ts/.p9s11-arms/` | 新增（untracked） | `arms.ts`·`arms2.ts` + `arms-out.json`·`arms2-out.json`（原始读数） |
| `docs/audit/s6-backend-review-submissions.md` | 新增 | 本报告 |
