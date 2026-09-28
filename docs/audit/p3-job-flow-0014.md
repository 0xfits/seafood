# P3 招工柱 · 第二片 `0014_job_flow.sql` 交付报告

> 状态：**已交付 · 已应用 · 已验收（self-check + 6 用例 + 5 判负自证全绿）**。
> 角色：Kong（实现）。上游：`docs/data-layer.spec.md` **v0.4** §6.2 / `DL46`–`DL56` / `DL7` / `DL48` / `DL99` / `DL151`。
> 迁移入口（现取）：`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts`。
> 本报告所有数值来自落盘读数（`backend-ts/.p3f-artifacts/`），非记忆。

## 0. 交付物清单（全部完成）

| 交付物 | 状态 | 证据 |
|---|---|---|
| `backend-ts/migrations/0014_job_flow.sql`（437 行） | DONE | sha256 `a33798…a162d`（= `schema_migration` 第 14 行 checksum） |
| 应用 ⇒ `0014` applied | DONE | `schema_version=0014`、`schema_migration` 14 行、`public` 基表 **9 → 11** |
| 幂等复跑 ⇒ 14/14 `skipped`、exit 0 | DONE | 复跑两次均 `skipped=14 / applied=0 / ABORT=0` |
| `backend-ts/scripts/p3f-*.ts`（探针 4 个 + lib） | DONE | `p3f-lib.ts` / `p3f-00-fingerprint.ts` / `p3f-01-cases.ts` / `p3f-02-concurrency-and-negative.ts` |
| `backend-ts/.p3f-artifacts/**`（run-tagged，禁同名覆写） | DONE | 7 个产物，两个 run 标签（见 §3） |
| 类级断言复跑（`p3s1b-01`）+ `tsc --noEmit` | DONE | `hits_total=0` / `assertion.pass=true`；`TSC_EXIT=0`（0 行输出） |
| 行为用例 ①–⑥ | DONE | `p3f-20260928055200-cases.json` 6/6 pass、残差 0 |
| 判负自证（拿掉部分唯一索引 ⇒ ② 必红 ⇒ 恢复回绿） | DONE | `p3f-…-concurrency-and-negative.json` 5/5 pass；红 `dt=168ms` / 绿 `dt=1679·2060ms` |

## 1. 设计口径（对照 spec 落点）

- **逐列照 `DL54` / `DL56`**，不增删列、不自创列名：`job_application` **7 列**、`job_submission` **10 列**（§2 逐列表）。
- **`DL99`（无分录动作）**：`apply` / `accept` / `submit` 属无分录动作 ⇒ 两表**不建 `ledger_event_keys` 列**、**不建编排函数**；幂等靠 `create_key`（`DL75①`）+ 业务侧唯一键。带分录的 `publish`/`refund`/`settle` 仍在 `0013` 的 `public.job_post_event`。
  · 自检块**显式断言**「两表不得含 `ledger_event_keys`」⇒ `DL99` 可判负（`0014_job_flow.sql:327-334`）。
- **`DL56` 的列差异照抄**：`job_submission` **无 `time_updated`**（故无 touch 触发器）；`review_memo text DEFAULT ''`、`reviewed_by/reviewed_at` 可空。
- **`DL55`**：状态白名单唯一真源 = 纯函数 `public.job_application_status_transition_ok(from,to)`（`:63`）；**部分唯一索引** `uniq_job_application_accepted`（`:102`）。
- **`DL76`**：两表均为**可变表** ⇒ 用状态机/列级不可变守卫，**不加**全表 append-only 触发器。
- **`DL79`** 禁 DELETE、**`DL75③`** `time_updated` 触发器刷新、**`DL78`** uid 列 FK `public.users(uid)`、**`DL151`** 全量 `public.`。
- 触发状态机/不可变违反 ⇒ 借码 `LEDGER_CURRENCY_INVALID_TRANSITION`（`LD011`，integrity ⇒ 409），沿用 `0013` 已验收惯例；张力已在 `DL148` 台账（与 `0013` 同源）。

## 2. 逐项落点（`0014_job_flow.sql` 行号）

| 对象 | 行号 | 说明 |
|---|---|---|
| `job_application_status_transition_ok(from,to)` | `:63` | `applied→{accepted,rejected,withdrawn}`；其余 false（终态无出边） |
| `CREATE TABLE public.job_application` | `:79` | 7 列；PK / `create_key` UNIQUE / `UNIQUE(job_id,worker_uid)` / status CHECK / FK job + user |
| `uniq_job_application_accepted`（部分唯一） | `:102` | `UNIQUE (job_id) WHERE status='accepted'` |
| `idx_job_application_worker` | `:108` | 唯一键 `(job_id,worker_uid)` 已覆盖 job_id 前缀 ⇒ 只补 worker 轴读口 |
| `CREATE TABLE public.job_submission` | `:115` | 10 列；PK / `create_key` UNIQUE / review_status CHECK / 3 个 FK |
| `idx_job_submission_job/_worker/_review` | `:139` `:141` `:143` | job 读口 / worker 读口 / 待审核读口（§3.2 #51 雇主视角 `review_status='pending'`） |
| `job_application_status_guard()` | `:152` | 白名单；违反 ⇒ `LD011` + `reason=JOB_APPLICATION_STATE_INVALID` |
| `job_application_create_key_guard()` | `:170` | `create_key` 永不可改 |
| `job_application_touch_time_updated()` | `:185` | `DL75③` |
| `job_application_no_delete()` | `:196` | `DL79` |
| `job_submission_immutable_guard()` | `:212` | deliverable/job_id/worker_uid/create_key 永不可改；review_status 只允许 `pending→{approved,rejected}`；结论落定后 review_* 冻结；三列各自一次写定 |
| `job_submission_no_delete()` | `:259` | `DL79` |
| 6 个 `trg_*`（4 app + 2 sub） | `:270`–`:297` | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`（幂等） |
| apply-time 自检 `DO $$` | `:304`–`:437` | 结构 + `DL99` 禁列 + 部分唯一索引 indexdef + 触发器启用态 + 函数体内无 DDL + 白名单正/负全集 |

## 3. 必给读数（run-tagged 落盘 `.p3f-artifacts/`）

> run 标签：**`20260928053411`**（迁移前/后指纹）、**`20260928055200`**（final 指纹 + 用例 + 判负 + 类级断言）。**7 个产物，无一同名覆写**（`save()` 同名即抛，实测触发过一次并改用新标签）。

### 3.1 迁移前/后指纹（`public` 基表 9 → 11）

| 项 | pre（`…053411-fingerprint-pre.json`） | post / final（`…053411-fingerprint-post.json`、`…055200-fingerprint-final.json`） |
|---|---|---|
| `public_base_table_count` | **9** | **11** |
| 表清单新增 | — | `job_application`、`job_submission` |
| `schema_version` | `0013` | `0014` |
| `schema_migration` 行数 | 13 | 14 |
| `job_application` | 不存在 | 7 列 / 5 索引 / 4 触发器 |
| `job_submission` | 不存在 | 10 列 / 5 索引 / 2 触发器 |

`schema_migration` 第 14 行：`{version:"0014", name:"0014_job_flow.sql", checksum:"a33798336adc7053e4bcbf06cb652b1fb57dcbf49edea324c5977830f47a162d", applied_at:"2026-09-28 05:34:21.434834+00"}` ⇒ **checksum = sha256(sql 内容)**（文件实测 sha256 逐字符相等）。

### 3.2 逐列（列名 / 类型 / notnull / 默认）

**`job_application`（7 列）**

| 列 | 类型 | notnull | 默认 |
|---|---|---|---|
| `application_id` | bigint | NOT NULL | identity |
| `job_id` | bigint | NOT NULL | — |
| `worker_uid` | bigint | NOT NULL | — |
| `status` | text | NOT NULL | `'applied'::text` |
| `create_key` | text | NOT NULL | — |
| `time_created` | timestamptz | NOT NULL | `now()` |
| `time_updated` | timestamptz | NOT NULL | `now()` |

**`job_submission`（10 列）**

| 列 | 类型 | notnull | 默认 |
|---|---|---|---|
| `submission_id` | bigint | NOT NULL | identity |
| `job_id` | bigint | NOT NULL | — |
| `worker_uid` | bigint | NOT NULL | — |
| `deliverable` | text | NOT NULL | — |
| `review_status` | text | NOT NULL | `'pending'::text` |
| `reviewed_by` | bigint | **NULL 允许** | — |
| `reviewed_at` | timestamptz | **NULL 允许** | — |
| `review_memo` | text | NOT NULL | `''::text` |
| `create_key` | text | NOT NULL | — |
| `time_created` | timestamptz | NOT NULL | `now()` |

（**无** `ledger_event_keys`、`job_submission` **无** `time_updated` ⇒ 逐列照 `DL54`/`DL56` + `DL99`。）

### 3.3 约束清单（摘）

- `job_application`：`job_application_pk`(p)、`job_application_create_key_uniq`(u)、`job_application_job_worker_uniq`(u `(job_id,worker_uid)`)、`job_application_status_enum`(c `status IN (…)`)、`job_application_job_fk`(f → `job`)、`job_application_worker_fk`(f → `users`)。
- `job_submission`：`job_submission_pk`(p)、`job_submission_create_key_uniq`(u)、`job_submission_review_status_enum`(c `review_status IN ('pending','approved','rejected')`)、`job_submission_job_fk`/`_worker_fk`/`_reviewed_by_fk`(f → `job`/`users`/`users`)。

### 3.4 索引清单（含部分唯一索引 `indexdef`）

- `job_application`：`job_application_pk`、`job_application_create_key_uniq`、`job_application_job_worker_uniq`、`idx_job_application_worker`、
  **`uniq_job_application_accepted`** ⇒ `CREATE UNIQUE INDEX uniq_job_application_accepted ON public.job_application USING btree (job_id) WHERE (status = 'accepted'::text)`。
- `job_submission`：`job_submission_pk`、`job_submission_create_key_uniq`、`idx_job_submission_job`、`idx_job_submission_worker`、`idx_job_submission_review`。

### 3.5 触发器 `tgenabled`（全 `O`）

- `job_application`（4）：`trg_job_application_create_key_guard:O`、`trg_job_application_status_guard:O`、`trg_job_application_touch_time_updated:O`、`trg_job_application_no_delete:O`。
- `job_submission`（2）：`trg_job_submission_immutable_guard:O`、`trg_job_submission_no_delete:O`。

### 3.6 幂等复跑

`migrate.ts` 复跑 **两次**：`skipped=14 / applied=0 / ABORT=0`，**exit 0**，`schema_version=0014`、`public_base_table_count=11`。

### 3.7 类级断言 + 类型检查

- `npx ts-node --transpile-only scripts/p3s1b-01-class-assert-runtime-ddl.ts … p3f-20260928055200` ⇒ **exit 0**，`assertion.pass=true`，请求路径 `files=8 / hits_total=0 / should_be_zero=0`，请求路径源指纹 `fc1045a0f39979ae8ac4f64b3dadf685d0cc3bb7848d48a037b978805f3ab8c3`。产物：`.p3f-artifacts/p3f-20260928055200-classassert.json`。
  · 注：该脚本默认落 `.p3s1-artifacts/`（**越本单硬边界**）⇒ 已用显式 outFile 改落 `.p3f-artifacts/`，并**删除**首次误落的单个文件（仅此一个，其余 `.p3s1-artifacts/` 既有件未动）。
- `npx tsc --noEmit` ⇒ **exit 0**，输出 0 行。

## 4. 行为用例 ①–⑥（`p3f-20260928055200-cases.json`，**6/6 pass**，exit 0）

> 全部在**单事务**内，末尾 `ROLLBACK` ⇒ 夹具残差实测 **0**。判据 `constraint`/`reason`/`sqlstate` 逐条落盘。

| # | 用例 | 头号读数 |
|---|---|---|
| ① | 同一 `(job_id,worker_uid)` 二次报名 | `23505` / `constraint=job_application_job_worker_uniq` |
| ② | 同一 job 第二条 `accepted`（顺序形状） | `23505` / `constraint=uniq_job_application_accepted`，`accepted_count=1` |
| ③ | `status` 白名单正/负**全集** | 正 3/3 通（accepted/rejected/withdrawn）；负 6/6 拒（全 `LD011` + `reason=JOB_APPLICATION_STATE_INVALID`）；另 **INSERT 异值** `bogus` ⇒ `23514` / `job_application_status_enum` |
| ④ | `job_submission` 白名单 + 重复提交 + 不可变 | INSERT `bogus` ⇒ `23514`/`_review_status_enum`；`deliverable` 改 ⇒ `LD011`/`job_submission_core_immutable`；结论翻转 ⇒ `LD011`/`job_review_status_invalid`；改 `reviewed_by` ⇒ `LD011`/`job_review_immutable`；同 `create_key` 重复提交 ⇒ `23505`/`job_submission_create_key_uniq`；末态 `review_status=approved` 稳定 |
| ⑤ | `create_key` 幂等（同键重放不双写） | 重放 ⇒ `23505` / `job_application_create_key_uniq`；`rows_with_key=1` |
| ⑥ | 边界 | 不存在 `job_id` ⇒ `23503`（FK）；**自雇（worker=employer）DB 层允许**（spec 无 DB 级禁止，本片不越权加约束）；`create_key` 异内容 ⇒ `23505` |

**推论（③/④ 的实测教训，已入产物 `note`）**：UPDATE 路径上「白名单 CHECK」被 `BEFORE UPDATE` 守卫**抢先**（`LD011`），故 `CHECK`（`23514`）**只能由 INSERT 触达**——本片两种路径都测到了。

## 5. 判负自证 · 尺子必须会响（`p3f-20260928055200-concurrency-and-negative.json`，**5/5 pass**，exit 0）

**尺子用例（ruler）**＝两条**独立连接**同时把同一 job 的两条 `applied` 报名置 `accepted`：conn1 先持未提交的 `accepted`（占住唯一索引项），conn2 对第二条执行同操作，`statement_timeout=1500ms`。

| 阶段 | conn2 结果 | 读数 |
|---|---|---|
| **F1 绿**（部分唯一索引在位） | 被索引互斥**阻塞** ⇒ `57014`（statement timeout） | `dt_ms=1679` |
| **F2 红**（`DROP INDEX` 复现「未建该索引」态） | **立即成功**（两行 `accepted` 并存 = 缺陷） | `dt_ms=168`，`conn2.ok=true`；scratch 改写件 `0014_job_flow.NO_PARTIAL_UNIQUE_INDEX.sql`（sha256 `40a78d34…62790`，较原文 `-53 B`） |
| **F3 回绿**（按迁移原文逐字节重建索引） | 再次被阻塞 ⇒ `57014` | `dt_ms=2060`；`indexdef` 与 drop 前**逐字符相等** |
| **F4** | 主工作区文件未被碰 | sha256 `a33798…a162d`、24484 B、mtime `2026-09-28T05:33:45.625Z` **前后全等** |
| **F5** | 库终态索引在位且与原文一致 | `indexdef` 一致 |

⇒ **尺子确实会响**：拿掉部分唯一索引的那一瞬间，②的并发用例由绿转红（`dt` 1679ms → 168ms），恢复后回绿。

## 6. 诚实边界与未做项

1. **护栏非绝对不可变**（与 `0013` 同口径）：`TRUNCATE` 不触发行触发器；超管 `ALTER TABLE … DISABLE TRIGGER USER` 可旁路「列级不可变 / 禁 DELETE / 最多一条 accepted」。本片**正是**用 `DROP INDEX` 把部分唯一索引的尺子撞响 ⇒ 结构性保证对**超级用户 DDL** 不设防，表述为**护栏**，非「数学上排除」。
2. **自雇（`worker_uid = employer_uid`）在 DB 层允许**：spec `DL54`/`DL55` 未定义 DB 级禁止，本片**不越权**加约束；如需禁止应在路由/应用层或新裁定后补迁移。
3. **200 重放语义不在本片**：`DL54` 的「重复申请 ⇒ 同键重放或 409」中，**DB 层**只给 `23505`；「重放当成功（200）」属路由层（`src/` 本单不改）。
4. **`job_submission` 的审核方身份（`reviewed_by` = 雇主）不在 DB 层校验**：无 `reviewed_by = job.employer_uid` 的结构约束（spec 未要求，且需读 `job` 行）；由路由层保证。
5. **`apply/accept/submit` 无编排函数**（`DL99`）⇒ 本片**不建** `job_post_event` 之外的任何编排；两表**无 `ledger_event_keys`**，故**不参与** `DL100`「键的落盘自证」判据。
6. **测试残差（本片夹具，已最小化）**：
   - 用例 ①–⑥ 全事务 `ROLLBACK` ⇒ 残差 **0**（实测 `residual=0`）。
   - 判负自证需两连接可见夹具 ⇒ **committed** 残差：`1` 个 `job` 行 + `2` 个 `job_application`（均 `applied`）+ 3 个测试 `users`；无一 `accepted`、无一 `job_submission` 落库。
   - 既有 9 张基表的**数据**未动（`0014` 只增表/索引/触发器）。
7. **越界纠正留痕**：类级断言脚本首次误落 `.p3s1-artifacts/`（越「只许写」硬边界），已改用显式 outFile 落 `.p3f-artifacts/` 并删除该单个误落件；`.p3s1-artifacts/` 其余既有件**未动**。
8. **改动的文件（仅本单授权集）**：`backend-ts/migrations/0014_job_flow.sql`、`backend-ts/scripts/p3f-lib.ts`、`scripts/p3f-00-fingerprint.ts`、`scripts/p3f-01-cases.ts`、`scripts/p3f-02-concurrency-and-negative.ts`、`backend-ts/.p3f-artifacts/**`（7）、`docs/audit/p3-job-flow-0014.md`。`0001`–`0013`、`src/**`、`frontend/**`、`docs/*.spec.md`、`docs/qa/**`、`docs/versions/**`、`docs/seafood.master-plan.md` 均**未碰**。
9. **未做（本单范围外）**：路由/服务层接口（`src/**`）、`0015`–`0018`、judge-facing 前端。
