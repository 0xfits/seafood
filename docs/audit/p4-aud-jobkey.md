# P4 · AUD-JOBKEY · 批 2a `create_key` 派生兜底的「静默重放」审计

- **Unit**：AUD-JOBKEY（Kong，**只取证不裁决**）
- **仓**：`/Users/kevin/bistro/seafood`（后端 `backend-ts`，服务 `seafood-api` @ 5788）
- **HEAD**：`8f2974c`
- **run tag**：`audjk-20260929T182652Z`
- **产物**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/audjk-20260929T182652Z/`
  （`results.json`（主读数）/ `before-counts.json` / `after-counts.json` / `fixture-ledger.json`）
- **探针**：`/Users/kevin/bistro/seafood/backend-ts/scripts/p4z-audjk-01-probe.ts`
- **声明：本单未改任何代码。** 零 `src/**`、零 `migrations/**`、零 `frontend/**`、零 spec 修改；零 `git add/commit/push`；零 `npm install`；无删除型 SQL、未删任何行、未改 kind/白名单、未重启服务。

---

## §0 待判问题（一句话）

批 2a 的非资金写（`src/job-service.ts` 的 J2 `applyToJob` / J4 `submitWork`）在**缺 `create_key` 时派生生键**；须判定该派生是否会让**两个不同实体**拿到同一把键 ⇒ 第二个实体被当成**重放**（不落新行）而**静默丢失**。

## §0.1 结论摘要（取证，非裁决）

| 判据 | 读数 | 结论 |
|---|---|---|
| 不同实体 + **完全相同内容** ⇒ 是否不落新行并回 replay | T1/T2 各落 1 行（`sub` 6→7→8）；A1/A2 各落 1 行（`app` 9→10→11） | **碰撞不成立** |
| 同键重放是否只发生在**同一实体** | T3（同 app 同 worker 同内容）⇒ 200 `idempotent_replay:true`，`sub` 0 增量 | 是（设计内幂等） |
| 同实体 + **异内容** 是否静默重放 | T4 ⇒ **409** `LEDGER_IDEMPOTENCY_CONFLICT / REPLAY_FINGERPRINT_MISMATCH`，0 增量 | **非静默**（响亮拒绝） |
| 派生键是否含内容字段 | 派生公式只用 `fallbackParts`；两笔不同实体的键**不同**且可回读 | 仅含自然标识 |

**结构性原因（代码取证 §1）**：2a 两处派生输入都是 `[动词, 实体自然标识…]`（`job_id`/`application_id` + `worker_uid`），**不含内容** ⇒ 派生键是自然标识的单射 ⇒ **不同实体不可能同键**。

---

## §1 源码取证：派生兜底的输入字段

### §1.1 派生函数本体（2a 唯一派生点）

`backend-ts/src/job-service.ts:83-112`

```ts
83| const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);
85| /**
86|  * 解析创建键：调用方给 `create_key` / `Idempotency-Key` 时按 §4.5 校验；
87|  * 未给时派生**确定性**键 `cli:p4b2a:<verb>:<...>:<digest>`（同一请求重试 ⇒ 同键 ⇒ 200 重放）。
88|  * 派生键不构成「账本幂等键」（DL99/R3：无分录的写靠业务侧 create_key）——登记为批 2 过渡（见报告 §6 自曝）。
89|  */
90| export const resolveJobCreateKey = (raw, fallbackParts) => {
94|   const provided = raw === undefined || raw === null ? '' : String(raw).trim();
96|   if (!provided) {
97|     return { ok: true, key: `cli:p4b2a:${fallbackParts.join(':')}:${digest(fallbackParts.join('|'))}`, derived: true };
98|   }
99|   if (provided.length > 200) return { ok: false, details: { field: 'create_key', reason: 'TOO_LONG' } };
102|  if (!KEY_PREFIXES.some((prefix) => provided.startsWith(prefix))) { ... 'PREFIX_REQUIRED' }
105|  if (provided.includes('#')) { ... 'RESERVED_SEPARATOR' }
108|  if (CONTROL_CHARS.test(provided)) { ... 'CONTROL_CHARACTER' }
111|   return { ok: true, key: provided, derived: false };
112| };
```

**派生键公式**：`cli:p4b2a:` + `fallbackParts.join(':')` + `:` + `sha256(fallbackParts.join('|'))[:16]`
⇒ 键**完全由 `fallbackParts` 决定**（`digest` 是同一输入的哈希）⇒ **键与 `fallbackParts` 一一对应**：同 parts ⇒ 同键；不同 parts ⇒ 不同键。

### §1.2 两个调用点传的 `fallbackParts`（= 派生输入）

| 写口 | 文件:行号 | `fallbackParts` | 是否含实体自然标识 | 是否含内容 |
|---|---|---|---|---|
| J4 `submitWork` | `src/job-service.ts:133` | `['submit', params.identifier, params.workerUid]` | **是**：`identifier` = `job_application.application_id`（路由 `jID`；`src/database.ts:1144` `a.application_id AS "jID"`）+ `worker_uid` | **否**（`deliverable` 不在 parts 内） |
| J2 `applyToJob` | `src/job-service.ts:180` | `['apply', params.jobId, params.workerUid]` | **是**：`(job_id, worker_uid)` = `job_application` 的自然唯一键（`migrations/0014_job_flow.sql:91`） | **无内容字段** |

原文片段（可直接 grep）：

```ts
// src/job-service.ts:133（J4）
const resolvedKey = resolveJobCreateKey(params.createKeyRaw, ['submit', params.identifier, params.workerUid]);
// src/job-service.ts:180（J2）
const resolvedKey = resolveJobCreateKey(params.createKeyRaw, ['apply', params.jobId, params.workerUid]);
```

⇒ **代码推断（非实测）**：派生键 = **自然标识的函数**，与内容无关。**同一调用方对两个不同实体传完全相同内容 ⇒ 派生键不同**（因为标识不同）；**同键成立 ⇔ parts 相同 ⇔ 同一实体**。

### §1.3 落行 / 重放的 SQL 判据

- J4：`src/database.ts:1787-1804` —— `INSERT ... ON CONFLICT (create_key) DO NOTHING`（`:1792`）；`cur` 的 `replay` 分支要求 `s.create_key = ${createKey} AND s.job_id = t.job_id AND s.worker_uid = t.worker_uid`（`:1800-1802`）。
- J2：`src/database.ts:1843-1867` —— `ON CONFLICT DO NOTHING`（`:1849`，无冲突列 ⇒ 覆盖 `create_key` 与 `(job_id,worker_uid)` 两个唯一约束）；`already_applied` 分支要求 `a.create_key <> ${createKey}`（`:1866`）。
- **表约束（实测回读，`results.json.assert.uniq`）**：`job_create_key_uniq UNIQUE(create_key)`、`job_application_create_key_uniq UNIQUE(create_key)`、`job_application_job_worker_uniq UNIQUE(job_id, worker_uid)`、`job_submission_create_key_uniq UNIQUE(create_key)`。
  ⇒ **`job_submission` 没有 `(job_id, worker_uid)` 唯一约束**（只有 `create_key`）：`migrations/0014_job_flow.sql:115-133`。
  ⇒ `job`/`job_application`/`job_submission` 的触发器**全是 BEFORE UPDATE / BEFORE DELETE，无 INSERT 触发器**（实测回读，`results.json.assert.insert_triggers`）。

### §1.4 对照：批 3b（资金）为何 fail-loud

`src/job-funds-service.ts:78-89`（J1 `publishJob`）：`create_key` 缺失 ⇒ **400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED`，不派生**（调用点 `:170-172` 注释「缺失 ⇒ fail-loud，**不派生**」）。
**差异的根源（代码取证）**：`job` 表除 `create_key` 外**没有承载「同内容两实体」的自然键**（`job_id` 是 IDENTITY，先有键才有行）⇒ 内容派生键会把两份「同标题同内容、不同雇主」的招工折成一份（真碰撞）。而 2a 的两处写口**行标识已确定**（`job_id` / `application_id` 已存在），故可把标识放进派生输入 ⇒ 不碰撞。

---

## §2 实测：不同实体 + 完全相同内容（前缀 `aud-jk:`）

**run**：`audjk-20260929T182652Z`；**API**：`http://127.0.0.1:5788`；**鉴权**：真 token（Bearer）。
**密钥口径（§5.7⑩）**：两候选各铸一枚实测 —— ① `.env.local` 的 `SECRET_KEY`（len=64）⇒ `GET /api/user` **200**（胜）；② `auth.ts` 公开常量（len=20）⇒ **401**。⇒ 服务端生效密钥 = `.env.local` 的 `SECRET_KEY`（note：`src/index.ts:4` `import './env'` 已修加载顺序）。token_fp = `b1b07a3b0b0c`（本体不落盘）。

### §2.1 夹具（`fixture-ledger.json`）

| 夹具 | 值 |
|---|---|
| worker | `uid=1`（库内既有用户） |
| employers | `2`、`3`（两雇主） |
| jobs（**同标题同内容** `aud-jk:identical-title` / `aud-jk:identical-description`） | `12 open`(E=2) / `13 open`(E=3) / `14 accepted`(E=2) / `15 accepted`(E=3) |
| applications | `10`=(job 14, uid 1, accepted) / `11`=(job 15, uid 1, accepted) |
| 内容 | `D1 = aud-jk:deliverable:identical`（两笔**完全相同**）；`D2 = aud-jk:deliverable:different`（判负对照） |

### §2.2 逐笔读数（源：`results.json.requests` / `.apply_service_layer` / `.db_truth`）

| id | 调用 | 实体关系 | 内容 | status | `idempotent_replay` | 落新行？ | 库内计数 after（job/app/sub） |
|---|---|---|---|---|---|---|---|
| T0 | `POST /api/job/12/apply` | — | — | **404** `Not found` | — | 否（delta 全 0） | 12/9/6 |
| T1 | `POST /api/task-progress/10/submit`（**无** `create_key`） | app **10** | D1 | **200** | `null` | **是**（`sub +1`） | 12/9/7 |
| T2 | `POST /api/task-progress/11/submit`（**无** `create_key`） | app **11**（**不同实体**） | **D1（完全相同）** | **200** | `null` | **是**（`sub +1`） | 12/9/**8** |
| T3 | 重放 T1（同 app 10 同 worker） | **同一实体** | D1 | **200** | **`true`** | 否（`sub +0`） | 12/9/8 |
| T4 | `POST /api/task-progress/10/submit`（无键） | 同一实体 | **D2（异内容）** | **409** `LEDGER_IDEMPOTENCY_CONFLICT` / `reason=REPLAY_FINGERPRINT_MISMATCH` | — | 否 | 12/9/8 |
| A1 | 服务层 `applyToJob(job 12)`（无键） | job **12** | — | 200 `ok:true` | `false` | **是**（`app +1`） | — |
| A2 | 服务层 `applyToJob(job 13)`（无键） | job **13**（**不同实体**） | — | 200 `ok:true` | `false` | **是**（`app +1`） | 12/**11**/8 |
| A3 | 重放 A1 | **同一实体** | — | 200 `ok:true` | **`true`** | 否（`app +0`） | 12/11/8 |

**库内回读的派生键真值（`results.json.db_truth`）— 决定性证据**：

```
job_submission  (submission_id=11, job_id=14, worker_uid=1, deliverable=aud-jk:deliverable:identical)
                create_key = cli:p4b2a:submit:10:1:ea7b65ad17e2fdc1
job_submission  (submission_id=12, job_id=15, worker_uid=1, deliverable=aud-jk:deliverable:identical)
                create_key = cli:p4b2a:submit:11:1:c8ec5abb119e9fe5      ← 与上键不同（parts=11≠10）
job_application (application_id=10, job_id=14, worker_uid=1, status=accepted)
                create_key = cli:p4b2a:apply:12:1:02d10f10b9dc5da4
job_application (application_id=11, job_id=15, worker_uid=1, status=accepted)
                create_key = cli:p4b2a:apply:13:1:c3a6715c5d024a07      ← 与上键不同（parts=13≠12）
```

- **T4 的 409 body 内 `ref_id` = `cli:p4b2a:submit:10:1:ea7b65ad17e2fdc1`**，与 T1 落行键**逐字相同** ⇒ 实测证实「派生键不含内容」（否则异内容的 D2 会算出另一把键，就不会 409）。
- 派生键命名空间：`job_submission.create_key LIKE 'cli:p4b2a:%'` 0 → **2**；`job_application` 同口径 0 → **2**（`before`/`after` 计数文件）。
- **无分录**：全 8 笔的 `ledger_entry` 增量恒 0；`account` 行数/`sum(balance)=1995998`/`sum(frozen)=4002` before=after（`before-counts.json` vs `after-counts.json`）。

### §2.3 判据结论

- **判据「第二次不落新行且回 replay」⇒ 未成立**（T2/A2 都**落了新行**、且 `idempotent_replay` 均非 `true`）。
- **静默重放仅出现在「同一实体 + 同内容」**（T3/A3）= 教科书式幂等重试，**不是**「不同实体被吞」。
- **同一实体 + 异内容 = 409（响亮拒绝）**，非静默（T4）。
- ⇒ **批 2a 的派生兜底不会把「同内容不同实体」键碰撞成静默重放**；2a 与 3b 的口径差异**在语义上可解释**（3b 的 J1 无自然键可用，2a 两处都有）。

### §2.4 分情形表（含 `NOT_MEASURED`）

| 实体关系 | 内容 | 结果 | 依据 |
|---|---|---|---|
| 不同 application（不同 job/雇主） | 完全相同 | **两条都落**，键不同 | **实测** T1/T2 + `db_truth` |
| 不同 job（同雇主、同内容），J2 apply | — | **两条都落**，键不同 | **实测（服务层）** A1/A2 + `db_truth` |
| 同一 application + 同一 worker | 相同 | 200 replay，不落行 | **实测** T3 |
| 同一 application + 同一 worker | 不同 | 409，不落行 | **实测** T4 |
| **不同 worker** 对**同一 job** | 相同 | `NOT_MEASURED` | 未造该夹具（`uniq_job_application_accepted` 限制每 job 仅一条 accepted app，需另建 job；**代码推断**：`worker_uid` 在 parts 内 ⇒ 键必不同，未实测） |
| 跨 job 的 J4 submit（无 HTTP 路由） | — | `NOT_MEASURED` | 见 §2.5 |

### §2.5 路由面实测（影响修法）

- **T0 实测**：`POST /api/job/12/apply` ⇒ **404 `Not found`** ⇒ **J2 `applyToJob` 当前无 HTTP 路由**（`src/index.ts:24` 只从 `job-service` 引了 `sendGone, sendVerbError, submitWork`；全仓 `app.post` 清单内无 `apply`）。
  ⇒ §2.2 的 A1-A3 **只能走服务层**（用 `src/job-service.ts` 真 `resolveJobCreateKey(undefined, ['apply', jid, uid])` 派生 + 真 `applyToJob`，再回读 DB 落行键）——**已标为服务层路径，不冒充 HTTP 实测**。
- **批 2a 现取唯一 HTTP 写口 = J4 `POST /api/task-progress/:identifier/submit`**（`src/index.ts:581-621`，`createKeyRaw` 取自 `body.create_key ?? req.get('idempotency-key')`，`:587`）。
- J1 发布路由亦不存在（`src/job-funds-service.ts:145` 自述「**前端零调用**（§1.2:165）⇒ 路由随批 4」）。

---

## §3 实测 / 取证：前端是否传 `create_key`

**方法**：只读 `frontend/**` 静态 grep（**静态取证，非运行时抓包**）。

| 检索 | 口径 | 命中 |
|---|---|---|
| `create_key\|createKey\|[Ii]dempoten` 于 `frontend/**` | ripgrep，全量 | **0**（`total_count: 0`） |
| `'/api/...'` 调用清单 于 `frontend/src/**` | 全量列点 | 见下 |

**发起 2a 写口的调用体（唯一一处）**：

```
/Users/kevin/bistro/seafood/frontend/src/components/ActiveTaskModal.jsx:50
  const response = await fetch(`/api/task-progress/${task.jID || task.tID}/submit`, {
:52     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
:56     body: JSON.stringify({
:57       info_input: infoInput.trim()
:58     })
  })
```

⇒ 请求体**只有 `info_input`，没有 `create_key`/`idempotency` 字段**，也没有 `Idempotency-Key` 头（`create_key ?? req.get('idempotency-key')` 的后一路在 2a 写口上**无前端调用者**）。

**其他事实**：

- `frontend/src/**` 对 **`/api/job`** 的调用：**0 命中**（与 `src/job-funds-service.ts:145` 的「前端零调用」自述一致）⇒ J1/J2 无前端调用者。
- 前端**对 2a 面只调用 submit 这一个写口**（其他 POST 属别的批：`/api/order`（批 2b）、`/api/admin/*`（批 2c，`ops:` 键）、`/api/shard/*`、`/api/chest/*`、`/api/tasklist/:jID/verify`（批 3c））。
- **邻接观察（本单范围外，`NOT_MEASURED`）**：`frontend/src/pages/DashboardPage.jsx:223` 调 `POST /api/tasklist/${jID}/verify` 同样**不带**任何键；该属批 3c 资金面，本单未测。

⇒ **对修法的直接含义**：2a 的 **J4 submit 是前端唯一在用的写口，且前端从不传键**。因此「缺键 ⇒ 400」的 fail-loud **一定会弄断冻结前端**（`ActiveTaskModal` 只弹通用 `提交任务失败` 提示，见 `:75-77`）；要 fail-loud 就必须同单改前端。J2 apply 无前端调用者 ⇒ 对它 fail-loud **零前端影响**。

---

## §4 修法选项（**不自选**，交 Zang 裁定）

> 三个选项互斥可选；每项给「改哪个文件哪行 / 对前端影响 / 对幂等语义影响 / 判负设计」。

### 选项 A — 服务层 fail-loud（对齐 3b）+ 同步补前端键

- **改点**：`backend-ts/src/job-service.ts:96-98`（把「缺 `provided` ⇒ 派生」改为 `{ ok:false, details:{ field:'create_key', reason:'KEY_REQUIRED' } }`；路由层 `:114-115` `keyError` 已映射 400 `LEDGER_IDEMPOTENCY_KEY_INVALID`，**不改 kind/白名单**）；配套 `frontend/src/components/ActiveTaskModal.jsx:56-58` 在 body 增 `create_key`（例：`cli:<uID>:<jID>:<uuid4>`）。
- **对前端影响**：**必改冻结前端**（新增 1 个 body 字段 + uuid 生成）。不同单改 ⇒ `POST /api/task-progress/:id/submit` **100% 400**，招工提交功能整体失效。
- **对幂等语义影响**：与 3b 完全统一；**幂等责任从「服务端自动」转为「客户端负责」**——同一次提交的**重试必须复用同一键**才 replay；客户端换键 ⇒ 变成新提交（`(app,worker)` 唯一约束下 apply 会 409 `already_applied`，submit 会落**第二行**）。
- **判负设计**：① 无键 submit ⇒ 400 且零落行（before/after 计数相同）；② 同键同内容 ⇒ 200 `idempotent_replay:true`；③ 同键异内容 ⇒ 409 `REPLAY_FINGERPRINT_MISMATCH`；④ 前端 e2e 提交成功后 `job_submission` +1。

### 选项 B — 保持派生（零代码改动），把过渡口径升为**显式契约**

- **改点**：不改码；在 spec 侧写明两件事实：① 2a 派生键 = `f(自然标识)`，**不构成账本幂等键**（DL99/R3）；② **同一 `(application, worker)` 的第二次「异内容」提交 = 409 预期**（若产品要「改稿/多次提交」，需另立键维度）。
- **对前端影响**：**零**（前端现状即兼容）。
- **对幂等语义影响**：不变（自动幂等保留，无键重试仍 replay）。
- **判负设计**：本次 §2.2 的 T1/T2（不同实体同内容 ⇒ 两行）与 A1/A2（不同 job ⇒ 两条）即现成判负用例，可固化为回归；另加「同 `(app,worker)` 异内容 ⇒ 409 + 零行」。

### 选项 C — 双轨：**路由层**必填、**服务层**保留派生

- **改点**：`backend-ts/src/index.ts:587`（J4 路由）把 `createKeyRaw` 由 `?? undefined` 改为「缺失即 400 `LEDGER_IDEMPOTENCY_KEY_INVALID`」；`src/job-service.ts:96-98` 的派生**保留**（供批 4 路由 / 内部调用复用）。同理批 4 落地 J2 路由时按同口径。
- **对前端影响**：**同选项 A**（submit 是前端唯一在用写口 ⇒ 仍须补前端键）；区别是**爆炸半径限定在 HTTP 面**——`job-service` 单测与内部/服务层调用（如 A1-A3 这类）不受影响。
- **对幂等语义影响**：HTTP 面 fail-loud（客户端必须给键）；服务层面维持自动幂等 ⇒ **同一系统内两副幂等契约**（需在 spec 明示这是过渡态）。
- **判负设计**：① 路由级：无键 submit ⇒ 400、零落行；② 服务层级：派生读数（T1/T2/A1/A2）保持通过、不同实体不同键；③ 回归：`frontend` 补键后 e2e 通过。

---

## §5 探针自曝（§5.7⑥/⑨、禁用项、口径）

1. **计数口径** = `count(*)::int` 逐表 + 夹具域（`job_id` / `create_key LIKE '%aud-jk%'` / `deliverable ILIKE '%aud-jk%'`）逐项；`before`/`after` 由**同一脚本、同一表集**产出（`before-counts.json` / `after-counts.json`）。报数均为**原始整数**，未做估算。
2. **「实测」的可 grep 支撑**：一切 HTTP status / `idempotent_replay` / 派生键真值均可从 `results.json`（`requests[*].status`、`requests[*].idempotent_replay`、`requests[*].delta.*`、`db_truth.*`、`apply_service_layer[*].derived_key`）grep 到；未实测项一律标 `NOT_MEASURED`（**未填 0/空**）。
3. **服务层 vs HTTP 的区分（§5.7⑨）**：A1-A3 是**服务层**路径（J2 无 HTTP 路由，T0 实测 404 为证），**已在文中逐处标注**，未冒充 HTTP 实测；T1-T4 才是 HTTP 真 token 实测。
4. **密钥口径（§5.7⑩）**：两候选实测（env 200 / 公开常量 401），结论取自**响应体 status**；本仓无 access log ⇒ 以「响应 + 落行计数」双证，未引入 access log 断言。
5. **未测/未造**：① 「不同 worker 对同一 job」未造夹具（`NOT_MEASURED`）；② 前端「不传键」为**静态 grep 取证**，非运行时抓包（未跑 `npm run dev`/浏览器）；③ 批 3c `/api/tasklist/:jID/verify` 前端同样无键，属本单范围外（`NOT_MEASURED`）。
6. **写库范围**：仅命名夹具 INSERT（`job.create_key`/`job_application.create_key` = `cli:aud-jk:*` 4 行 job + 4 行 app），**无 DELETE、无 UPDATE 业务行、未删任何既有行**；未触碰资金端点；`ledger_entry` 增量 0、`account` 不动（读数见 §2.2）。
7. **产物卫生**：`leak_check = { bearer_header_occurrences: 0, secret_value_occurrences: 0 }` —— 产物内**不含** token 本体（只 `token_fp`）与密钥本体。
8. **探针卫生**：不跑 `pkill -f`/`killall`、未重启服务、未改 migrations、未 `npm install`、未用 `git add/commit/push`、未用 `execute_code`；`terminal` 每次 ≤3 命令、无 heredoc。
9. **未改任何代码声明**：见文首「声明」；本报告与探针为该单**唯一**新增物。

---

## §6 交付物清单（绝对路径）

- 报告：`/Users/kevin/bistro/seafood/docs/audit/p4-aud-jobkey.md`
- 探针：`/Users/kevin/bistro/seafood/backend-ts/scripts/p4z-audjk-01-probe.ts`
- 产物：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/audjk-20260929T182652Z/`
  - `results.json`（主读数：assert / before / key_probe / fixture / apply_service_layer / db_truth / after / requests / leak_check）
  - `before-counts.json`、`after-counts.json`
  - `fixture-ledger.json`

> 口径附注（§5.7⑨）：探针 **stdout 未落盘**（运行未重定向）；一切读数以 `results.json` 为唯一机读真值，本文所引 status/键/counts **逐字取自该文件**。同脚本可重放（夹具按 `create_key` 复用），但重放会刷新 `before` 基线 ⇒ 本单结论以 run `audjk-20260929T182652Z` 的该次快照为准。
