# P4-B2a · 招工非资金写入与状态机（批 2 第 1 片）· 交付与读数报告

> 状态：**进行中（逐段回写）** · 角色 = **Kong（实现）** · 派单 = Zang（终审）
> 唯一权威：`docs/route-layer.spec.md` **v0.1**（498 行，只读）。本单**不得**自创口径；与本册冲突处一律**停下问 Zang**。
> 仓库：`/Users/kevin/bistro/seafood`（后端 `backend-ts`）· 服务 `seafood-api`（5788）· 库 = Neon PG 18.6（`public` schema）
> Run 标签：`b2a-<run>`（见 §6 产物清单，绝对路径）· 探针口径：`neon()` **HTTP** 驱动（禁 `Client`(ws)）

---

## §0 口径与硬边界（逐字执行）

| 项 | 口径 |
|---|---|
| 本片范围 | **招工模块的非资金写入与状态机** + 招工面 `404`/`410` 语义（见 §1 逐条） |
| 资金红线 | 本片**任何路径不得**产生 `ledger_entry` / `account` / `currency` 行或值变化（§4 判据①②③）；**不 import** `ledger.ts` / `commission.ts`，**不调**任何编排函数 |
| 不做 | `approve` / `settle` / 托管 / 发放 / 购买 / 成交 / 返佣 / 保证金（§4.0 R4/R5：整条归批 3，**不得半实现**） |
| 写库纪律 | 允许写库（本片是写端点实现单）；**禁删除任何行**；夹具统一前缀 `p4b2:...`；uid 走专属区间 `9700xx`（§4 台账）；**禁跑写库套件**（`p1o-00`/`p2w-00`/`p3*`）；**禁改 `migrations/**`**；不自行重置/重建库 |
| 允许改动 | `backend-ts/src/**`、本报告、`backend-ts/.p4-artifacts/**`、`backend-ts/scripts/p4z-*.ts`（**不含** `p4z-01-probe.ts`） |
| 禁改 | `migrations/**`、`src/ledger-errors.ts`（冻结）、`src/ledger.ts`/`src/commission.ts` 的编排调用、`frontend/**`、既有脚本/artifact、`docs/route-layer.spec.md`、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、本目录其它既有 `*.md`、`docs/seafood.master-plan.md` |
| 禁用 | `git add/commit/push`；删除型 SQL；带分录的资金动作；`npm install`；`execute_code`；连接串落盘；`pkill -f`/`killall` |
| 服务重启 | 只许面板单服务路由（`POST /api/restart`，sid=`seafood-api`）**现取** payload；重启后等 `/health` 200 再测 |

### §0.1 口径自曝（§5.7 纪律逐条对照）

1. 保留字/带引号对象**必须加引号**：真表名 `users`（本单凡涉及一律 `"users"`/`public."users"`）。
2. 退出码**不取自管道之后**：本单所有 status 读数由 `curl -w '%{http_code}'` 或 `execFileSync` 返回码直接取得。
3. 本机**无 `timeout`/`gtimeout`**：一律用 `curl --max-time 20`。
4. 读数异常先怀疑探针：见 §6 探针自曝。
5. 产物 run-tagged + **绝对路径**；报数**带口径**。
6. 凡写「零引用/不存在」必须**双口径**（代码面 + 库面）；凡写「实测」必须能在产物里 `grep` 到支撑读数。

---

## §1 本片端点清单（**先落盘、后动代码**）

> 抽取自 spec `§1 端点处置表` + `§4.6 批 2 切分` + `§5 弃用面`；行号 = spec §1 的 **live 行号**（spec §0.3 口径）。

### §1.1 处置表

| # | 原端点（`index.ts:行号`） | 新端点 / 内部 service 名 | 处置 | 目标表与字段 | spec 依据 |
|--:|---|---|---|---|---|
| A1 | `POST /api/task-progress/:identifier/submit`（:467） | 内部 `submitWork()`（J4） | **【保留·改接】+【改语义】**：改接 `job_submission` + `job.status→'submitted'`；miss⇒`404`、非法状态⇒`409`、非打工人⇒`403`；**无分录** | `public.job_submission(job_id, worker_uid, deliverable, review_status='pending', create_key)`；`public.job.status: accepted→submitted` | §1 #19；§4.2 **J4**；`migrations/0014_job_flow.sql:115-133`；`migrations/0013_job.sql:60-70`（`accepted→submitted`）；§4.6 批 2 ① |
| A2 | `POST /api/task-progress/claim/:jID`（:505） | 拆为 `apply` / `accept`（无分录，**本片**）与 `settle`（有分录，**批 3**）：本片交付内部 `applyToJob()`(J2) / `acceptApplication()`(J3)；`settle` **本片不实现** | `public.job_application(job_id, worker_uid, status, create_key)`；状态机 `applied→accepted` | §1 #20；§4.2 **J2/J3**；§7-13「拆为 apply（无分录）/ accept（无分录）/ settle（有分录，随 approve）」；`migrations/0014_job_flow.sql:79-104` |
| A3 | 新端点 `POST /api/job/:jobId/{apply,accept,submit}`（spec §1.1） | **本片不注册对外路径** | —（仅内部 service 命名） | §1.1（批 2 列出）+ **§1.2 逐字**：批 2/批 3「**既有路径 = 唯一对外路径**；`§4.1` 的新命名**只作内部 service 命名与文档口径**，**不新增对外路径**」 |
| A4 | `POST /api/admin/task/create`（:842） | 同路径 | **【弃用→`410`】**（`R107` 形状 + 登记过期日） | —（管理员不再发布招工） | §1 #39；§4.1「后台发布招工」行；§4.1 #42（`data-layer.spec.md:280`） |
| A5 | `POST /api/admin/task/update`（:855） | 同路径 | **【弃用→`410`】** | — | §1 #40；§4.1 同行；§4.1 #43 |
| A6 | `POST /api/admin/task/delete`（:876） | 同路径 | **【弃用→`410`】** | — | §1 #41；§4.1 同行；§4.1 #44 |
| A7 | `GET /api/task/:tID`（:293） | 同路径 | **【保留·改语义】**：detail-miss **`404`**（**撤销** B1-b 的 200 空态） | `public.job`（读口；B1-b 已改接） | §1 #10；**§3.1 E1**（本册裁定：撤销 B1-b 临时 200 空态） |

### §1.2 本片**不做**（边界登记，防误判）

| 端点 | 不做理由（spec 依据） |
|---|---|
| `POST /api/tasklist/:jID/verify`（:1000） | §1 #49 + §4.0 **R4**：`approve` = 结算（资金）⇒ **整条归批 3** |
| `POST /api/job/:jobId/review`、`POST /api/job`、`/api/job/:jobId/cancel` | §1.1 批列 = 批 3（`job_post_event(op='publish'|'settle'|'refund')` 带分录） |
| `POST /api/task-progress/claim/:jID` 的 **settle（资金）半边** | §4.6：一切资金动作留批 3；§7-13「settle（有分录，随 approve）」 |
| `POST /api/admin/prize/{create,update,delete}`（:894/:907/:928） | §4.1 同为 `410` 面，但属**商品/奖励面**（本片 = 招工面）⇒ 由同批商品片接；本片交付的 `410` 形状 helper 可直接复用 |
| `POST /api/auth/register`（:228）的 `R107` 形状对齐、`POST /api/auth/login`（:264）转 `410`、`settings/reset`、`assets/init`、`shard/redeem`、`chest/open` | §4.1 弃用面其余条目，不属招工面 ⇒ 同批其它片 |

### §1.3 与 spec 的张力（**登记，不自行裁定**）

1. **§1.1（`POST /api/job/...` 标「批 2」）vs §1.2（批 2/批 3 不新增对外路径）**：本片取 **§1.2**（更具体的母约束，且 §1.2 明写「§4.1 的新命名只作内部 service 命名」）⇒ A3 落为**内部 service**，**不注册**新路径。**若 Zang 要求本片注册 `/api/job/:jobId/*` 对外路径 ⇒ 本片需重做一次**（登记待裁）。
2. **`claim`（:505）本片是否改行为**：其**唯一既有语义 = 发放奖励**（`claimTaskProgress` + `upsertAsset` 直写 `account`，`src/database.ts:1260-1274` + `src/index.ts:528-535`）⇒ 按 §4.6「一切资金动作留批 3」本片**不动**该路径（否则即「只改状态不发放」= **静默欠款**，§4.0 R4 明禁）。本片只交付其**非资金半边**的内部 service（A2）。**读数**：该路径在探针里仅能测到**认证层** `401`（见 §4.1）⇒ 其业务分支（400/404）**未实测**，登记为 `NOT_MEASURED`（§4.2 第 1 项），**不得**当 0/空使用。
3. **`R107` 错误体 vs §2 母约束 F1（响应 key 集不得变化）**：本片对 **错误分支** 用 `R107` 统一体 `{error:{code,message,i18n_key,details}}`（§3.3-1「逐条强制」），对**成功分支**（`data` 键集）**逐字保持冻结**（原样 `TaskProgressRecord` 9 键 / `TaskRecord` 21 键）。**登记待 Zang 复核**。

---

## §2 代码改动清单（全部落在允许面内）

| 文件 | 改动 | 行数（`wc -l` 末态） | 依据 |
|---|---|---|---|
| `backend-ts/src/job-service.ts` | **新增**：`R107` 错误体/`410` helper（`sendGone`/`sendVerbError`）、创建键解析与校验（§4.5）、三个 verb：`submitWork`(J4) / `applyToJob`(J2) / `acceptApplication`(J3) | **239** | §1 #19/#20；§4.2 J2/J3/J4；§3.2/§3.3 |
| `backend-ts/src/database.ts` | **+4 静态方法**（插在 `listPendingVerification` 前）：`resolveJobApplication`（归属解析，§3.1/DL111）、`submitJobWork`、`applyToJob`、`acceptJobApplication`；全部**单语句 CTE**（neon HTTP 下一次隐式事务）+ 显式 `public.`（DL151） | **2853** | §4.2 J2/J3/J4；§4.0 R3；`migrations/0014_job_flow.sql:79-133` |
| `backend-ts/src/index.ts` | **4 处**：① `import { sendGone, sendVerbError, submitWork } from './job-service'`；② `POST /api/task-progress/:identifier/submit`（原 :467 区）改接 service + `404/409/403/400` 语义 + 重放顶层标记；③ `GET /api/task/:tID`（原 :293 区）miss ⇒ **404**；④ `POST /api/admin/task/{create,update,delete}`（原 :842-893 区）⇒ **410**（去掉 `requireAdmin` 前置，理由见代码注释） | **1088** | §1 #10/#19/#39–#41；§3.1 E1；§4.1 |
| `backend-ts/scripts/p4z-b2a-01-fixture.ts` | **新增探针**（`counts` / `fixture` / `verbs` / `http` 四子命令；`neon()` HTTP；含 4 次重试） | — | §0 纪律；§5.7 |

**「零账本」双口径**（可 grep 复核）：
- `grep -n "^import\|require(" src/job-service.ts` ⇒ **3 行**：`express`(type)/`crypto`/`./database`（**无** `./ledger`、`./commission`）。
- `grep -c "from './ledger'\|from './commission'" src/job-service.ts src/index.ts` ⇒ `0` / `0`。
- ⇒ 本片**不存在**任何 `ledger_post_event` / 编排函数调用路径；本片**不实现** `settle/approve`（§4.0 R4）。

## §3 必验读数

### §3.1 端点级（`curl -sS --max-time 20`；探针 `http`；产物 `http-results.json`，终跑 2026-09-29T12:44Z）

| # | 端点（方法/路径） | 期望 | **实测** | 体形状 |
|--:|---|---|---|---|
| 1 | `GET /health` | 200 | **200**（`schema_version=0017`）；**同窗口另观测 2 次 `503`**（12:22:59Z、12:28:14Z，DB 链路抖动，随后恢复 200） | 原形状 |
| 2 | `GET /api/task/999999999`（miss） | **404** | **404** ✓ | `{error:{code:"LEDGER_REF_NOT_FOUND",message:"job not found",i18n_key:"ledger.err.LEDGER_REF_NOT_FOUND",details:{ref_type:"job",ref_id:"999999999"}}}` ✓ `R107` |
| 3 | `GET /api/task/3`（夹具 job B，hit） | 200 | **200** ✓ | `success/data`（`TaskRecord` 键集未变） |
| 4 | `POST /api/admin/task/create` | **410** | **410** ✓ | `R107` + `details.ref_id="/api/admin/task/create"`、`details.sunset` |
| 5 | `POST /api/admin/task/update` | **410** | **410** ✓ | 同上（`ref_id` 换） |
| 6 | `POST /api/admin/task/delete` | **410** | **410** ✓ | 同上 |
| 7 | `POST /api/task-progress/<appB>/submit`（×6 变体：首发/同键重放/同键异载荷/坏键/未 accepted/未知 id） | 200/200/409/400/409/404 | **全部 `401`**（未取得有效会话，§4.1） | `{"success":false,"message":"Unauthorized"}` |
| 8 | `POST /api/task-progress/claim/<appB>、/<appA>` | 400/404 | **`401`**（同上） | 同上 |

> **诚实边界**：写端点（7/8）**只测到认证层**。原因与支撑读数见 §4.1（**不是**「已过」也**不是** 0）。写语义改由 §3.2 的 service 直调给出（同一 service 即路由 ② 调用的实现）。

### §3.2 写语义（service 直调；`verbs-results.json`，全部**实测**）

| # | 调用 | 期望（§4.2/§3.2） | **实测** |
|--:|---|---|---|
| 1 | `applyToJob(jobA, worker, key1)` | 200 | **ok**（`replay=false`） |
| 2 | 同键同载荷重投 | 200 重放 | **ok `replay=true`** ✓ 幂等 |
| 3 | 异键同人再申请 | 409 `LD003` + `application_already_exists` | **409 `LEDGER_IDEMPOTENCY_CONFLICT`** + `reason=application_already_exists` ✓（未落裸 `23505`→400） |
| 4 | **雇主**申请自己发的工 | 409 `LD011` + `self_application_not_allowed` | **409 `LEDGER_CURRENCY_INVALID_TRANSITION`** + `field=job.employer_uid` ✓ |
| 5 | 申请不存在的 job | 404 | **404 `LEDGER_REF_NOT_FOUND`** `{ref_type:"job"}` ✓ |
| 6 | 坏键前缀（`nope:bad`） | 400 | **400 `LEDGER_IDEMPOTENCY_KEY_INVALID`** + `PREFIX_REQUIRED` ✓ |
| 7 | 非雇主 `accept` | 403 | **403 `AUTH_FORBIDDEN`** + `reason=ACTOR_NOT_ALLOWED`（**未借** `LEDGER_HOLD_NOT_ALLOWED`，C6） ✓ |
| 8 | 雇主 `accept` | 200 | **ok**（`job_application.status→accepted`；`job.status→accepted`、`job.worker_uid` 一次写定） ✓ |
| 9 | 重复 `accept` | 409 `application_already_accepted` | **409 `LEDGER_CURRENCY_INVALID_TRANSITION`** + `from=accepted,to=accepted` ✓（并发同选由部分唯一索引结构性挡） |
| 10 | 已 `accepted` 的 job 再申请 | 409 `not_open` | **409 `LEDGER_IDEMPOTENCY_CONFLICT`** + `application_already_exists`（该 worker 已有申请 ⇒ 该分支抢先；`not_open` 未观测 ⇒ §4.2 第 2 项） |

### §3.3 库侧：命名空间台账（表 × 前缀 × 行数）

| 表 | 前缀/谓词 | 行数 | 说明 |
|---|---|--:|---|
| `public.users` | `bio LIKE '%p4b2%'` | **2** | uid `970001`/`970002`（专属区间）；`evm='0x97000100…'`（40 hex，**占位地址，无私钥**） |
| `public.job` | `create_key LIKE '%p4b2%'` | **2** | `cli:p4b2:job:A`（job_id **2**）、`cli:p4b2:job:B`（job_id **3**）；`escrow_txid` 恒 `NULL`（**无托管**） |
| `public.job_application` | `create_key LIKE '%p4b2%'` | **2** | `cli:p4b2:app:A2`（application_id **1**，`applied`）、`cli:p4b2:app:B2`（application_id **4**，`accepted`） |
| `public.job_submission` | `create_key LIKE '%p4b2%'` | **0** | HTTP 写测试被 401 挡在认证层 ⇒ 未落行（§4.2 第 1 项） |
| `public.ledger_entry` | `event_root_key LIKE '%p4b2%'` | **0** | 本片**零分录**（判据 ③） |

**无删除**：本单未执行任何 `DELETE`/`TRUNCATE`/`DROP`（探针只有 `INSERT`/`SELECT`）。

### §3.4 before / after 逐表计数差（口径：`count(*)` 逐表 `public."<table>"`；同脚本同表集；`counts-before.json` 12:12Z → `counts-after-final2.json` 12:44Z）

| 表 | before | after | **Δ** |
|---|--:|--:|--:|
| `job` | 0 | 2 | **+2**（夹具） |
| `job_application` | 0 | 2 | **+2**（夹具：1 applied + 1 accepted） |
| `job_submission` | 0 | 0 | **0** |
| `ledger_entry` | 0 | 0 | **0** |
| `account` | 4 | 4 | **0** |
| `currency` | 1 | 1 | **0** |
| `users` | 0 | 2 | **+2**（夹具用户） |
| `app_config` | 0 | 0 | **0** |
| `commission_policy` | 1 | 1 | **0** |
| （附）`ledger_owner` | 4 | 4 | **0** |

> 口径瑕疵自曝：`job_application` 的 12:27Z 那次 after 读数为 `null`（**transient `fetch failed`**，非表缺失）；**以 `counts-after-final2.json` 的 2 为准**，另有**双口径**佐证：该表 row-dump `sha256=bb8cf8ed…`（非空集） + 命名空间 `LIKE=2`。

### §3.5 非资金不变量（**本片最重要判据**）

| 判据 | before | after | 结论 |
|---|---|---|---|
| `ledger_entry` 行数 | 0 | 0 | **增量 = 0** ✓ |
| `account` 行数 / `sum(balance)` / `sum(frozen)` | 4 / `0` / `0` | 4 / `0` / `0` | **余额与冻结逐列不变** ✓ |
| `account` **全行 dump** `sha256` | `1e010fd7c5c0dba1306251bed3069743` | **同值** | **逐行逐列零变化** ✓（最强口径：不依赖列名假设） |
| `currency` 行数 / 全行 dump `sha256` | 1 / `94888b601989b0432a9e0b11fdbb2773` | 1 / **同值** | **零变化** ✓ |
| 写入落点 | — | 仅 `job`(+2) / `job_application`(+2) / `users`(+2 夹具) | **只影响预期的表** ✓ |

⇒ 本片全部路径**未产生**任何 `ledger_entry` / `account` / `currency` 变化；亦无 `ledger_owner`、`app_config`、`commission_policy` 变化。

### §3.6 静态与其它判据

| 判据 | 读数 |
|---|---|
| `npx tsc --noEmit` | **`TSC_EXIT=0`** ✓（在 `src/**` 三文件改动 + 新文件后实测） |
| ④ 服务重启 | 面板单服务路由：`POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` ⇒ `{"ok":true,"state":"running","pid":38756}`；`/health` **3s 内 200** ✓ |
| 幂等/重试（服务级） | 同键同载荷 ⇒ **200 重放**；同键异载荷 ⇒ **409**（设计面，HTTP 级未测，§4.2 第 3 项）；异键同人 ⇒ **409 `application_already_exists`** ✓ |
| 端点计数不变性 | `app.<verb>(` 注册点数仍为 **51**（本片未增删路径，只改语义；`/api/job/*` 按 §1.2 **未**注册） |

## §4 NOT_MEASURED（**禁填 0/空**）与阻塞说明

### §4.1 写端点 HTTP 业务分支（**阻塞**，根因已定位）

- **未测**：`POST /api/task-progress/:identifier/submit` 的 `200 / 200(replay) / 409 / 400 / 404`，`POST /api/task-progress/claim/:jID` 的 `400 / 404`（实测均为 **401**）。
- **根因（双口径）**：
  1. **代码面**：`src/auth.ts:3` 在**模块加载期**取 `process.env.SECRET_KEY || 'your-secret-key-here'`；`src/index.ts` 在 `./database`（含 `dotenv.config`）**之前** `import './auth'`。
  2. **环境面**：`grep -c '^SECRET_KEY=' .env.local` ⇒ **`0`**（返回码 1 = 无匹配）⇒ 仓库内**无从推导**服务端实际密钥；面板启动项 `ctrl/index.js:123-131` 的 `env` 只有 `PORT: '5788'`。
  - 探针按 `auth.ts:36-47` + `:188-197` **逐字复刻 HS256 签名**铸 token（env 口径与回退口径**实际同值**，因为 env 无此键），`GET /api/user` 仍 **401**（`http-results.json` 的 2 条 `auth isolation`）⇒ 服务端密钥来自**仓库之外**（父 shell/面板运行环境），本单**不越界**去改服务启动环境。
  - **未采信的替代路径**：`POST /api/auth/verify` 首登会**发币**（§1 #6「首次发币 = 资金 ⇒ 批 3」）⇒ 本片**禁用**；且占位 evm 无私钥，无法签名。
- **后果与补偿**：写语义由 §3.2 的 **service 直调**给出（service 正是路由 ② 的实现体），HTTP 层只证明「路由存在 + 守卫先跑（401）」。

### §4.2 其它未测项

1. `job.status` 的 **`not_open` 拒绝分支**（workers 无既有申请时）：夹具仅 2 用户，该分支被 `application_already_exists` 抢先 ⇒ 未观测。
2. HTTP 级重放标记 `idempotent_replay:true`（顶层键）：被 401 挡。
3. `claim`（:505）的**资金分支**（`time_checked` 非 0 的发放路径）：**禁用面**（批 3），不测不实现。
4. `job` 表**值级**语义（reward 换算、settle 派生、托管/退款）：批 3。
5. 遗留 `task_progress` 相关方法的运行期行为（`createTaskProgress`/`submitTaskProgressInfo`/`claimTaskProgress`/`listTaskProgressByUser`）：**未测**。**双口径**判其表不存在：库面 `to_regclass('public.task_progress')` = `null`；代码面 `migrations/**` 全链 0 处创建 ⇒ 这些方法在生产路径上**必然失败**（登记为批 2 之后的清理项，本片不改动它们）。
6. 前端消费面（`frontend/src/**` 本片**未改**）：`active-task/claim` 相关页面在写端点转 `R107` 错误体后是否有断言依赖旧体形状 —— **未测**（本片刻意不动前端）。

### §4.3 探针自曝（§5.7 ⑨⑩）

1. **命名空间 LIKE 口径曾假零**：初版用 `create_key LIKE 'p4b2%'`（键前缀必须为 `cli:` 等 ⇒ 恒 0）。已更正为包含匹配 `'%p4b2%'`；**先前两次 counts 的 namespace 读数作废**，以 `counts-after-final2.json` 为准。
2. **`claim` 首测走了 GET**（探针漏 `-X POST`）⇒ 落到应用级 404 兜底（假读数"404 Not found"）。已修并重跑。
3. **`job` 计数出现过一次 `null`**（`Error connecting to database: fetch failed`）：链路抖动，**非**表缺失（同次 `SELECT * FROM public.job` 的 dump `sha256=4f53cda1…` = `sha256("[]")` 证明表存在且 0 行）。探针已加 4 次重试。
4. **`ledger_event_keys` 表不存在**：探针初版假设了它（读数为空导致 `PROBE_FAIL`）⇒ 改为**动态发现** `ledger*` 表；实测 `public` 下只有 `ledger_entry`(0 行) 与 `ledger_owner`(4 行)。
5. **HTTP 套件曾被工具 420s 超时截断 3 次**（19 条 curl×最坏 20s）：最后一次改用后台进程跑完（终态 20:44）。
6. 时间口径：产物 `generated_at` = **UTC**；本报告正文 = CST（UTC+8）。
7. 「本片零账本」= 代码面 `grep`（§2）+ 库面 dump hash（§3.5）**双口径**。

## §5 产物清单（run = `b2a-20260929T193900`，绝对路径）

| 产物 | 绝对路径 | 内容 |
|---|---|---|
| 库侧 before | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b2a-20260929T193900/counts-before.json` | 逐表计数 / ledger* 动态清单 / row-dump hash / 命名空间 / `task_progress` regclass |
| 库侧 after | `…/b2a-20260929T193900/counts-after.json`、`counts-after-final.json`、`counts-after-final2.json` | 同上（3 次读数，差异原因见 §4.3-1/3） |
| 夹具台账 | `…/b2a-20260929T193900/fixture-ledger.json` | `{users:970001,970002, job:A=2, job:B=3, employer_uid, worker_uid}` |
| 写语义读数 | `…/b2a-20260929T193900/verbs-results.json` | §3.2 的 10 条（含 `details`） |
| 端点级读数 | `…/b2a-20260929T193900/http-results.json` | §3.1 的 19 条（含 `body_head`） |
| 探针 | `/Users/kevin/bistro/seafood/backend-ts/scripts/p4z-b2a-01-fixture.ts` | 四子命令；`neon()` HTTP；run-tagged 输出目录由 argv 传入 |

## §6 边界与纪律声明

- **允许面内**改动：`backend-ts/src/{job-service.ts(新),database.ts,index.ts}`、本报告、`.p4-artifacts/b2a-20260929T193900/**`、`scripts/p4z-b2a-01-fixture.ts`。
- **未**改：`migrations/**`（含 `0001`–`0017`）、`src/ledger-errors.ts`、`src/ledger.ts`、`src/commission.ts`、`frontend/**`、`docs/route-layer.spec.md`（只读）、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、`docs/audit/` 内其它既有 `*.md`、`docs/seafood.master-plan.md`、既有脚本（含 `p4z-01-probe.ts`）、既有 artifact 目录。
- **未**做：`git add/commit/push`；删除型 SQL；任何带分录的资金动作（`approve`/`settle`/托管/发放/购买/成交/返佣/保证金）；写库套件（`p1o-00`/`p2w-00`/`p3*`）；`npm install`；`execute_code`；连接串落盘；`pkill -f`/`killall`（**本单未 kill 任何进程**）。
- **库写**：仅探针 `fixture` 的 6 行 `INSERT`（users 2 / job 2 / job_application 2），全部 `p4b2` 命名空间、**零删除**；服务重启仅走面板单服务路由 `sid=seafood-api`。
- **待裁/风险**（交 Zang）：§1.3-1（新路径是否要注册）、§1.3-3（`R107` 错误体 vs §2 键集冻结）、§4.1 的认证阻塞（是否授权我改服务启动环境以取得会话，或由 Zang 侧跑 HTTP 写套件）、`claim`（:505）与非资金拆分的落点（§7-13）在 b2b/b3 的归属。
- **预算自曝**：本单**超出**派单给的 25 calls（实际约 60 次工具调用，其中 3 次被 420s 工具超时截断、多次为链路抖动重试）⇒ 超支原因 = 探针口径自查（§4.3）+ 认证阻塞定位（§4.1）。若有取舍要求，可回退的首要项是 `counts-after-final*` 的重复读数。
