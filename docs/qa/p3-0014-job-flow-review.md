# P3 招工柱 · 第二片 `0014_job_flow.sql` · 独立质检（Neng）

> **verdict：可用**（附 ①1 项口径**必须收窄** ②1 项**流程缺陷**登记 ③未验证清单 15 项）
> 角色：**Neng（质检）**。被检件：`backend-ts/migrations/0014_job_flow.sql`。**本单不复用 Kong 的夹具与读数**（见 §1）。
> 质检时现取：被检件 **sha256 `a33798336adc7053e4bcbf06cb652b1fb57dcbf49edea324c5977830f47a162d`** / **24484 B** / **437 行**（`wc -l`；`split('\n')` = 438，结尾单换行）/ mtime `2026-09-28T05:33:45.625Z`（**全程未变**，四处独立读数一致）。
> 上游权威件 `docs/data-layer.spec.md` **v0.5**（md5 **`ed8e2a1f19c86b39db880533ee1cbae8`**，现取一致）`DL54/55/56` + `DL46–48/DL76/DL79/DL99/DL151`；`docs/ledger.spec.md` v0.12 的 `R73/R107/R109`。
> ⚠️ Kong 报告 `docs/audit/p3-job-flow-0014.md` 声称口径源为 spec **v0.4**（现盘已是 v0.5）——**结论不受影响**（v0.5 只做编号重排传播，`0014` 行零改动），但报告需改注版本。
> **run 标签**：`20260928-0554`（契约/对抗/并发/判负/修复/补测）与 `20260928-0604`（终态复核）；**无一产物同名覆写**（`save()` 同名即抛）。
> **读数落盘（scratch，不在被检仓库）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3-0014-review/`（**7 个 JSON + 8 个日志 + 7 个探针源**：lib + `neng14-01…06`）。

---

## 0. verdict 与理由

**可用。** 逐项对拍 `DL54/55/56` **无一处偏差**：`job_application` 7 列 / `job_submission` 10 列逐列（含类型、`NOT NULL`、默认值、identity 生成式 `BY DEFAULT`）与 spec 逐字一致；`job_submission` **无 `time_updated`**；两表**无 `ledger_event_keys`**（`DL99`）；部分唯一索引 `indexdef` **逐字** = `DL55`；两表 6 个触发器 `tgenabled='O'`、**全库非 `O` 触发器 = 0**；`ledger_post_event` prosrc **45598 B / md5 `d94dd902697dfe60aba409d808c6d63a` 未变**。行为面：状态机正/负全集、列级不可变 4 列、`DL79` 禁 DELETE、`DL75③` 时间戳刷新**全部按 spec 生效**；并发同 `job_id` accept 与同 `create_key` INSERT 均**恰一条**；判负自证尺子**确实会响**（红 → 逐字节恢复 → 回绿）。迁移复跑 **14/14 `skipped`、exit 0**，`0001–0013`、`src/`、`frontend/` **零改动**。

**不判「需修」的理由**：未发现任何实现与 spec 的偏差，也未发现 fail-open（所有负例都被拒；`NULL` 目标值也被 `NOT NULL` 拒）。两处保留意见**都不是被检件缺陷**：
1. **★ Kong 的一条口径断言被我用反例撞穿**（§3.5）：`「CHECK 23514 只能由 INSERT 触达」`在**全称形式**下**不成立** —— 表 owner `DISABLE TRIGGER`（本 harness 实测**成功**）后，**UPDATE 立即触达 `23514`**。修正为**条件断言**：『守卫启用时，UPDATE 路径触达的是 `LD011` 而非 `23514`』。**属报告口径需收窄，不属迁移需改**。
2. `job_application.job_id` / `worker_uid` **无不可变守卫（实测可改）**：`DL54` 未要求（只要求 `create_key UNIQUE` 与 `UNIQUE(job_id,worker_uid)`）⇒ **符合 spec**，仅登记为观察项，**不越权加约束**。

---

## 1. 方法与自造夹具（新命名空间，未复用 Kong 任何夹具/读数）

- **自造探针**：`neng14-lib.ts` + 6 个脚本（全部在 scratch，**未写 `backend-ts/scripts/`**）；连接 = `@neondatabase/serverless` + `ws`（`NODE_PATH=<repo>/backend-ts/node_modules`），`DATABASE_URL_UNPOOLED` 直连（**连接串未回显**）；node `v18.19.0`。
  · `ts-node` 需覆盖编译选项（本机 tsconfig 为 `NodeNext` 且入口在仓库外）：`npx ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node"}'`。
- **夹具命名空间**：`create_key` 前缀 **`cli:neng14-`**；uid 窗口 **`990201`–`990204`**（4 个，**显式 uid 插入成功** ⇒ 未落回 identity）。**未触碰** Kong 的 `cli:p3f-` 行与 `9901xx` 行。
- **所有 SQL 显式限定 `public.`**（`DL151`）；只读查询 + 自建行；**未 `DROP TABLE`/`TRUNCATE`**；**未 `pkill -f`/`killall`**；**未 `git add`/commit/push**；**未改任何迁移/源码/文档（本文件除外）**。
- 唯一的两处**临时 DDL** 均在**判负自证**与**补测**中、且**全部还原并经终态核对**（§5）。

---

## 2. 逐项判定表（项 → 期望 → 实测 → 判定）

| # | 项 | 期望 | 实测（run `20260928-0554` / `0604`） | 判定 |
|---|---|---|---|---|
| 1 | 迁移链现状 | `0014` 已应用、14 行、11 基表 | `schema_version_hint=0014`、`schema_migration` **14** 行、`public` 基表 **11**（含 `job_application`/`job_submission`） | ✅ |
| 2 | `job_application` 列数 | 7（`DL54`） | **7** | ✅ |
| 3 | `job_application` 逐列 | `application_id PK`/`job_id`/`worker_uid`/`status`/`create_key`/`time_created`/`time_updated` | `application_id bigint NOT NULL identity(BY DEFAULT)`；`job_id bigint NOT NULL`；`worker_uid bigint NOT NULL`；`status text NOT NULL DEFAULT 'applied'::text`；`create_key text NOT NULL`；`time_created timestamptz NOT NULL DEFAULT now()`；`time_updated timestamptz NOT NULL DEFAULT now()` | ✅ |
| 4 | `job_submission` 列数 | 10（`DL56`） | **10** | ✅ |
| 5 | `job_submission` 逐列 | `submission_id`/`job_id`/`worker_uid`/`deliverable`/`review_status`/`reviewed_by`/`reviewed_at`/`review_memo`/`create_key`/`time_created` | 顺序与类型逐列一致；`deliverable text NOT NULL`；`review_status text NOT NULL DEFAULT 'pending'::text`；`reviewed_by bigint **NULL 允许**`；`reviewed_at timestamptz **NULL 允许**`；`review_memo text NOT NULL DEFAULT ''::text`；`create_key text NOT NULL`；`time_created timestamptz NOT NULL DEFAULT now()` | ✅ |
| 6 | **`job_submission` 无 `time_updated`** | 0 列 | `information_schema` 命中 **0** | ✅ |
| 7 | **两表无 `ledger_event_keys`**（`DL99`） | 0 列 | 全 `public` 仅 **`job`** 一表带该列（`0013` 产物）；两表命中 **[]** | ✅ |
| 8 | 约束清单 | PK / `create_key` UNIQUE / `UNIQUE(job_id,worker_uid)` / status CHECK / 2 FK（+ submission 3 FK） | `job_application`：`p`×1、`u`×2（`(create_key)`、`(job_id,worker_uid)`）、`c`×1（`status = ANY(ARRAY['applied','withdrawn','rejected','accepted'])`）、`f`×2（`→ job(job_id)`、`→ users(uid)`）；`job_submission`：`p`×1、`u`×1、`c`×1（`pending/approved/rejected`）、`f`×3（`job`/`worker`/`reviewed_by`） | ✅ |
| 9 | 部分唯一索引 `indexdef` **逐字** | `UNIQUE (job_id) WHERE status='accepted'` | `CREATE UNIQUE INDEX uniq_job_application_accepted ON public.job_application USING btree (job_id) WHERE (status = 'accepted'::text)` —— **逐字符等于** spec 形状（唯一 + `WHERE` + `accepted`） | ✅ |
| 10 | 触发器启用态 | 4 + 2 全 `O` | `job_application`：`create_key_guard/status_guard/touch_time_updated/no_delete` 全 `O`；`job_submission`：`immutable_guard/no_delete` 全 `O` | ✅ |
| 11 | **全库非 `O` 触发器 = 0** | 0 | `all_db_non_O` = **0**（`GROUP BY tgenabled` 仅 `O` = 18 条，全部 user 触发器） | ✅ |
| 12 | `ledger_post_event` 冻结面 | 45598 B / `d94dd902…` | **45598 B / md5 `d94dd902697dfe60aba409d808c6d63a`**（4 次独立读数一致） | ✅ |
| 13 | `DL151` 全量 `public.` | 无裸表名 | 迁移全文扫 8 个表名 ⇒ **44 处命中全部落在注释 / `details.field` 单引号字面量 / `information_schema` 字符串里**，**SQL 级零裸引用**（`REFERENCES public.job`、`FROM information_schema.columns`、`FROM pg_trigger` 等全限定）；6 个守卫函数 `pg_get_functiondef` 同样只在与 `details` 有关的字符串里命中 | ✅ |
| 14 | 状态机正全集 | `applied→{accepted,rejected,withdrawn}` 全通 | 3/3 成功，终态 = `accepted` / `rejected` / `withdrawn` | ✅ |
| 15 | 状态机负全集 | 其余全拒 | `applied→applied`（**放行为 no-op，未报错**，见注①）、`applied→bogus`/`'ACCEPTED'`/`''`/`"'accepted'"`、`accepted→{applied,rejected,withdrawn}`、`rejected→{applied,accepted}`、`withdrawn→accepted` ⇒ **全部 `LD011` + `reason=JOB_APPLICATION_STATE_INVALID`，行状态不变** | ✅ |
| 16 | `status` 目标为 `NULL` | 拒 | **`23502`（`NOT NULL`）而非 `LD011`** —— 守卫的 `transition_ok('applied',NULL)` 返回 `NULL` ⇒ `IF NOT NULL` 不触发，随后 `NOT NULL` 约束兜住 ⇒ **仍被拒**（fail-safe），但**不是白名单路径** | ⚠️ 已拒（口径注：`NULL` 走 `23502`） |
| 17 | `review_status` 白名单正/负 | `pending→{approved,rejected}` 通，其余拒 | 正 2/2 通；`pending→pending`（**no-op 放行**）、`→bogus`、`→''` ⇒ `LD011` + `job_review_status_invalid`；`→NULL` ⇒ **`23502`**；**INSERT `bogus` ⇒ `23514` / `job_submission_review_status_enum`** | ✅ |
| 18 | 结论落定后**四列各自**再改 | 全拒 | 终态 `approved` 下：改 `review_status` ⇒ `LD011`/`job_review_status_invalid`；改 `reviewed_by`、`reviewed_at`、`review_memo` ⇒ **各自 `LD011`/`job_review_immutable`**；同值写入（`review_memo=''`）放行 | ✅ |
| 19 | `reviewed_by`/`reviewed_at`/`review_memo` **各自一次写定** | 二次改拒 | `reviewed_by`、`reviewed_at`、`review_memo` 首写均成功；二次改 ⇒ **各自 `LD011`/`job_review_col_once_only`** | ✅ |
| 20 | `job_submission` 四列不可变 | `deliverable`/`job_id`/`worker_uid`/`create_key` 全拒 | **逐个改 ⇒ 4/4 `LD011`/`job_submission_core_immutable`**（`details.field=job_submission.immutable`） | ✅ |
| 21 | `job_application.create_key` 不可变 | 拒 | 改 ⇒ `LD011`/`job_application_create_key_immutable`；触发器在位 | ✅ |
| 22 | `job_application.job_id`/`worker_uid` 可变？ | spec 未要求 | **实测可改（未被拒）** —— `DL54` 未要求不可变 ⇒ **符合 spec**，登记为观察项 | ⚪ 非偏差 |
| 23 | `DL79` 禁 DELETE（两表） | 拒且行仍在 | `DELETE` ⇒ 各 `LD011` + `job_application_delete_forbidden` / `job_submission_delete_forbidden`；**行仍在**（状态未变） | ✅ |
| 24 | `DL75③` `time_updated` 刷新 | 不接受的客户端时间 | UPDATE 后 `time_updated` 由 `06:03:23.548` → `06:03:24.104`（**已刷新**）；客户端传 `'2000-01-01'` ⇒ 被覆盖为 `06:03:24.747`；`time_created` 未变 | ✅ |
| 25 | 边界：不存在 `job_id` | FK 拒 | `23503` / `job_application_job_fk` | ✅ |
| 26 | 边界：自雇（`worker_uid=employer_uid`） | spec 未禁 ⇒ 允许 | **成功**（与 Kong 同读数，本片独立复现） | ✅ |
| 27 | 边界：`create_key` 异内容同键 | 拒 | `23505` / `job_application_create_key_uniq` | ✅ |
| 28 | 边界：`reviewed_by` 指向不存在用户 | FK 拒 | `23503` / `job_submission_reviewed_by_fk` | ✅ |
| 29 | 边界：`create_key` **两表之间**同名复用 | 允许（各自独立唯一） | **成功**（跨表互不影响） | ✅ |
| 30 | 边界：同 `(job_id,worker_uid)` 二次报名 | 拒 | `23505` / `job_application_job_worker_uniq` | ✅ |
| 31 | 幂等：同 `create_key` 重放 | DB 层 `23505` | `job_application` ⇒ `23505`/`job_application_create_key_uniq`；`job_submission` ⇒ `23505`/`job_submission_create_key_uniq`（「200 重放」属路由层，**未据此判负**） | ✅ |
| 32 | 并发：同 `job_id` 两连接 accept | 恰一条 | 自竞争（两连接同时 autocommit）：**1 条 `23505`/`uniq_job_application_accepted` + 1 条成功**，`accepted_count=1`，`dt_ms=176` | ✅ |
| 33 | 并发：同 `create_key` 两连接 INSERT | 恰一条 | **1 条成功 + 1 条 `23505`/`job_application_create_key_uniq`**，`rows_with_key=1` | ✅ |
| 34 | 并发：**不同** `job_id` 对照 | 不互相阻塞 | 对端持 `job1` 未提交 accepted 时，别连接 accept **不同** job **未被阻塞**（`blocked=false`，`dt_ms=876`，两 job 各 1 条 accepted） | ✅ |
| 35 | 迁移幂等复跑 | 14/14 `skipped`、exit 0 | `ok=true`、`applied_now=14`、**`skipped=14` / `applied=0`**、**`EXIT=0`**（**退出码直接取自 `npx` 进程，未过管道**），`public_base_table_count=11` | ✅ |
| 36 | 冻结面零改动 | `0001–0013`/`src/`/`frontend/` 无改动 | `git diff --stat` 空、`git status --porcelain --untracked-files=no` 空；`0014` 工作区 sha256 = `HEAD:…0014_job_flow.sql` blob sha256 = `a33798…a162d` | ✅ |
| 37 | 迁移链校验和 | 逐行一致 | 14 行 DB checksum vs 14 个磁盘文件 sha256：**`checksum_mismatches=[]`**（含 `0013` `720c89e4…`）；**`name_mismatches=['0013']`**（DB 记 `0013_job_core.sql`，磁盘为 `0013_job.sql`）⇒ 登记，**非 `0014` 本片问题** | ⚠️ 只登记 |

**判定项计数：37 项（其中 ✅ 32 / ⚠️ 3 / ⚪ 1 / 未计入者为下方「未验证」）。**

**注①**：`applied→applied` 与 `pending→pending` 被**放行**（`IS DISTINCT FROM` 短路 ⇒ 无转移，无状态变化）——与 spec「其余转移 ⇒ 拒绝」不冲突（**无转移 ≠ 非法转移**），Kong 的实现与自检块同口径（自检只禁 `applied→applied` 的**白名单函数**返回 true，未禁「同值写入」）。

---

## 3. 对抗性用例 · 头号读数

### 3.1 状态机（`job_application`）
| 形状 | 头号读数 |
|---|---|
| `applied→accepted/rejected/withdrawn` | 全成功，`final_status` = 目标值 |
| `accepted→applied`（终态后再迁移） | `LD011` / `reason=JOB_APPLICATION_STATE_INVALID` / `final=accepted`（**未位移**） |
| `accepted→rejected`、`accepted→withdrawn` | 同上（全 `LD011`） |
| `rejected→applied`、`rejected→accepted` | `LD011`，`final=rejected` |
| `withdrawn→accepted` | `LD011`，`final=withdrawn` |
| `applied→bogus` / `'ACCEPTED'` / `''` / `"'accepted'"` | 4/4 `LD011`（**大小写与空白变体未漏过**） |
| `applied→NULL` | **`23502`**（`NOT NULL`）⇒ 仍拒 |
| INSERT `status='bogus'` | **`23514` / `job_application_status_enum`** |

### 3.2 审核结论（`job_submission`）
- 正：`pending→approved`、`pending→rejected` 通；`pending→pending` no-op 通。
- 负：`→bogus`、`→''` ⇒ `LD011`/`job_review_status_invalid`；`→NULL` ⇒ `23502`。
- **终态四列**：`review_status` ⇒ `LD011`/`job_review_status_invalid`；`reviewed_by` / `reviewed_at` / `review_memo` ⇒ **各自** `LD011`/`job_review_immutable`（**四列各试一遍，无漏**）。
- **一次写定**：三列首写成功、二次改 ⇒ `LD011`/`job_review_col_once_only`（**三列各试一遍**）。
- 列级不可变：`deliverable`/`job_id`/`worker_uid`/`create_key` **逐个**改 ⇒ 4/4 `LD011`/`job_submission_core_immutable`。

### 3.3 并发（**三种形状，均不同于 Kong 的单一「阻塞到 57014」形态**）
| 形状 | 读数 |
|---|---|
| 同 `job_id` **自竞争**（两连接同时 autocommit accept） | `23505`/`uniq_job_application_accepted` ×1 + 成功 ×1，**`accepted_count=1`**（`dt_ms=176`） |
| **不同** `job_id` 对照（对端持未提交 accepted） | 别连接**未被阻塞**（`blocked=false`，`dt_ms=876`），两 job 各 1 条 accepted ⇒ 争用是**索引项级**，非全局 |
| 同 `create_key` 并发 INSERT | 成功 ×1 + `23505`/`job_application_create_key_uniq` ×1，`rows_with_key=1` |
| 持锁形状（对端持未提交 accepted，本连接 accept 同 job 另一行） | **未复现 `57014`**：实测对端事务约 **15.2 s** 后消失（该连接事务被回滚）、本连接**随后成功**；`SET statement_timeout=1200ms` 在本 harness **未绑定住该语句**（连接生命周期）⇒ **该形状未独立验证**（见未验证 U1），**结论不依赖它** |

### 3.4 边界
不存在 `job_id` ⇒ `23503`；自雇 ⇒ **允许**（spec 未禁）；`create_key` 异内容 ⇒ `23505`；`reviewed_by` 不存在 ⇒ `23503`；`create_key` 跨表复用 ⇒ **允许**；重复报名 ⇒ `23505`；同 `create_key` 重放 ⇒ `23505`（DB 层）。

### 3.5 ★ 独立复现 / 推翻 Kong 的口径断言
> Kong 原话（`docs/audit/p3-job-flow-0014.md` §4 推论）：「UPDATE 路径上白名单 CHECK 被 `BEFORE UPDATE` 守卫**抢先**（`LD011`）⇒ `CHECK 23514` **只能由 INSERT 触达**」。

| 路径 | 头号读数 | 结论 |
|---|---|---|
| **INSERT**（`job_application.status='bogus'`） | `23514` / `constraint=job_application_status_enum` | **复现** |
| **INSERT**（`job_submission.review_status='bogus'`） | `23514` / `constraint=job_submission_review_status_enum` | **复现** |
| **UPDATE**（守卫启用，两表各一） | `LD011` / `constraint=null` / `reason=JOB_APPLICATION_STATE_INVALID`、`job_review_status_invalid` | **复现**「守卫抢先」 |
| **UPDATE**（表 owner `ALTER TABLE … DISABLE TRIGGER trg_job_application_status_guard` **成功**） | **`23514` / `constraint=job_application_status_enum`** | **★推翻全称断言**：UPDATE **可以**触达 `23514` |
| `SET session_replication_role='replica'` | `42501 permission denied to set parameter` | 该旁路在本角色下**不可用**（记录） |

⇒ **判定**：断言在「**无 owner 旁路**（守卫启用）」前提下**成立**；作为**无条件全称断言不成立**（反例已当场撞响，且该 `DISABLE` 是由**表 owner**（非超管）即可执行）。**Kong 的 F4/§6.1 已承认 `DISABLE TRIGGER USER` 是旁路**，故此处只需**把断言改写为条件句**（属于报告口径，不属迁移缺陷）。测试后已 `ENABLE TRIGGER`，终态 6 触发器**全 `O`**、全库非 `O` = **0**（`trigger_state_after` 读数）。

---

## 4. 判负自证（尺子必须会响）· 两种改法

### 4.1 改法一（本片主尺子）：**拿掉部分唯一索引** ⇒ 必红 ⇒ 逐字节恢复 ⇒ 回绿
| 阶段 | 读数 |
|---|---|
| **基线** | `indexdef` = `CREATE UNIQUE INDEX uniq_job_application_accepted ON public.job_application USING btree (job_id) WHERE (status = 'accepted'::text)` |
| **F1 绿**（索引在位） | 同 job 自竞争：1×`23505` + 1 成功，**`accepted_count=1`** |
| **F2 红**（`DROP INDEX public.uniq_job_application_accepted`） | `indexdef` ⇒ **`null`**；同 job 两连接 accept **双成功** ⇒ **`accepted_count=2`**（job 125，两行均 `accepted`）⇒ **尺子变红（缺陷可复现）** |
| **F3 回绿** | 按**迁移原文**重建索引 ⇒ `indexdef` 与基线**逐字符相等**；同 job 自竞争 ⇒ 1×`23505` + 1 成功，**`accepted_count=1`** |
| **F4 主工作区文件未被碰** | sha256 `a33798336adc7053e4bcbf06cb652b1fb57dcbf49edea324c5977830f47a162d` / 24484 B / mtime `2026-09-28T05:33:45.625Z` —— **4 处独立读数全等**（S0、修复件、finalize、终态） |
| **F5 库终态** | `indexdef` 逐字符 = 基线；`jobs_with_multiple_accepted = []`（**全库无任一 job 有 2 条 accepted**）；全库非 `O` 触发器 = 0；`ledger_post_event` 未变 |

### 4.2 改法二 A：**把部分唯一索引改成非部分 `UNIQUE (job_id)`** ⇒ **不会红——它根本建不起来**
- 读数：`ALTER TABLE public.job_application ADD CONSTRAINT neng14_alt_job_uniq UNIQUE (job_id)` ⇒ **`23505` / `could not create unique index "neng14_alt_job_uniq"` / `Key (job_id)=(115) is duplicated.`**
- 原因（同一次读数的快照）：库内 `job_application` 有多个 job **天然带多条报名**（`111`→2、`112`→3、`113`→3、`114`→2、`115`→2 …）——这正是 `DL54` 的语义（一人一单可多条，`UNIQUE(job_id,worker_uid)` 而非 `UNIQUE(job_id)`）。
- ⇒ **非部分 `UNIQUE (job_id)` 与 `DL54` 语义不相容**：它会把「同一 job 多个打工人报名」一并禁掉，**不是本片的可行改法**；「并发下会不会变红」在此改法上**前置条件不可满足**（**未实测**，见 U3）。**不拿别处的红充数**。
- 收尾：`DROP CONSTRAINT IF EXISTS neng14_alt_job_uniq` 已执行；终态 `leftover_tmp_objects.constraint = []`。

### 4.3 改法二 B：**撤掉结构索引，改「应用层检查触发器」** ⇒ **本形状未变红（如实说明，未证成）**
- 做法：`DROP INDEX` ⇒ 新建 `BEFORE INSERT OR UPDATE` 触发器（体内 `EXISTS (… job_id 相同且 status='accepted' 且 id 不同)`）⇒ 同 job 并发 accept。
- 读数：**1 条被拒（`P0001`，我的临时检查抛出）+ 1 条成功**，**`accepted_count=1`** ⇒ **未变红**。
- 如实说明：该改法在**机制上**存在「检查 ↔ 提交」的 TOCTOU 窗口（并发事务互不可见未提交的 `accepted`），**但本次 autocommit 形状没撞上**（第一条已提交后第二条才检查）；要撞响需**持锁形状**，而该形状在本 harness 上不可用（见 U1）⇒ **本项 NOT_MEASURED**，**不据此断言应用层检查「一定不行」**。
- ⚠️ **产物更正声明**：`neng14-20260928-0554-finalize.json` 的 `R7b_conclusion` 字段是我**先写下的预判文案**（「并发双成功」），与同文件 `R7b_appcheck_concurrent_race.outcomes` 的**实测读数相反**。**以 outcomes 读数为准**（1 拒 1 成）；该 artifact 按「禁同名覆写」纪律**保留原样**，特此更正。
- 收尾：临时触发器 + 函数 **已删除**（终态 `leftover_tmp_objects.trigger=[]`、`.fn=[]`），索引按原文重建并逐字符核对。

---

## 5. 事故与库侧副作用登记（**不清理，如实登记**）

### 5.1 ⚠️ 事故（流程缺陷，必须登记）：判负自证的**恢复步骤**被自己的红态夹具挡住
- 经过：F2 红态在 job 125 留下**两条 `accepted`** ⇒ 随后 `CREATE UNIQUE INDEX …` **失败**（`23505 could not create unique index "uniq_job_application_accepted"` / `Key (job_id)=(125) is duplicated`），脚本内安全网同样失败 ⇒ **部分唯一索引曾短暂缺失**。
- 时长与影响：从 `05:59:xx`（DROP）到 `06:00:05`（`neng14-…-repair-restore.json` 落盘，索引恢复）**约 ≤2 分钟**；期间**本库其他会话可能观察到该索引缺失**（若有人此刻做并发 accept 会双成功）——**如实登记**。
- 修复（`neng14-03-repair-restore.ts`，只动**本人夹具**）：先核验重复行 `key` 全部以 `cli:neng14-` 开头（`step1b_foreign_rows_present = []`，否则**立停上报**）⇒ `DISABLE TRIGGER trg_job_application_status_guard` ⇒ 把重复 `accepted` 退回 `applied` ⇒ **立刻** `ENABLE TRIGGER` ⇒ 按**迁移原文** `CREATE UNIQUE INDEX IF NOT EXISTS …` ⇒ 核对。
- 修复后核对：`indexdef` 与基线**逐字符相等**；6 触发器全 `O`；**全库非 `O` 触发器 = 0**；`ledger_post_event` **45598 B / `d94dd902697dfe60aba409d808c6d63a`**（未变）；`0014` 文件 sha256/字节/mtime **未变**。
- **教训（建议入规范）**：**「判负自证」的恢复步骤必须自带「红态修复」**（先解除本人夹具造成的约束冲突，再重建被撤对象），否则尺子会把自己的恢复路径锁死。本条是我方流程缺陷，**不归因于被检件**。

### 5.2 本人夹具残差（**未清理**，全部 `cli:neng14-` / uid `9902xx`）
| 对象 | 数量 | 明细（run `…0604` 终态） |
|---|---|---|
| `public.users` | **4** | uid `990201`–`990204`（显式 uid，非 identity） |
| `public.job` | **20** | job_id `112`–`130`（`create_key LIKE 'cli:neng14-%'`） |
| `public.job_application` | **30** | `accepted` 10 / `applied` 15 / `rejected` 2 / `withdrawn` 3 |
| `public.job_submission` | **10** | `approved` 2 / `pending` 7 / `rejected` 1 |
| 非本人存量（未动） | — | `job_application` 全表 **32**（⇒ 2 条为 Kong `p3f` 残差）；`job_submission` 全表 10（全为本人）；`job` 全表 110；`users` 全表 437；`ledger_entry` 全表 2365（**本片零写入**） |
| 不变量 | — | `jobs_with_multiple_accepted = []`（**全库无违反 DL55 的行**） |

### 5.3 临时 DDL（全部已还原，终态已核）
| 对象 | 用途 | 终态 |
|---|---|---|
| `public.job_application` 的 `trg_job_application_status_guard` `DISABLE`（2 次） | §3.5 反例；§5.1 修复 | **`tgenabled='O'`**（`trigger_state_after` / `step6_triggers` 双读数） |
| `public.uniq_job_application_accepted` `DROP`（2 次：F2、改法 B） | 判负自证 | **已按迁移原文重建，`indexdef` 逐字符 = 基线** |
| 约束 `neng14_alt_job_uniq` | 改法二 A | 未建成 ⇒ `DROP CONSTRAINT IF EXISTS` 已跑；`leftover_tmp_objects.constraint=[]` |
| 函数 `neng14_tmp_app_check()` + 触发器 `neng14_tmp_app_check` | 改法二 B | **已 DROP**；`leftover_tmp_objects` 三项全 `[]` |

---

## 6. 未验证清单（枚举到边界；未实测一律记 `NOT_MEASURED`，**不以 0 / 空数组占位**）

| # | 未验证项 | 边界说明（为什么没测 / 测到哪停） |
|---|---|---|
| U1 | **持锁形状**下同 job 并发 accept 的 `57014`（statement timeout）读数 | 本 harness 上 `SET statement_timeout` 未绑住语句，且对端事务约 15.2 s 后消失 ⇒ **未出现 `57014`**。Kong 的该形态读数**我未独立复现**；本片结论改用自竞争形状（U 之外的读数）支撑。**NOT_MEASURED** |
| U2 | 改法二 B（应用层检查触发器）在并发下是否**变红** | 实测 1 拒 + 1 成（未变红）；TOCTOU 窗口存在但**未撞上** ⇒ 无法断言「一定红/一定不红」。**NOT_MEASURED** |
| U3 | 改法二 A（非部分 `UNIQUE(job_id)`）在并发下是否变红 | 约束**建不起来**（`23505` 重复 key）⇒ 前置条件不可满足。**NOT_MEASURED** |
| U4 | `TRUNCATE` 旁路（不触发行触发器） | 硬边界禁 `TRUNCATE` 既有表 ⇒ **未实测**（spec 与 Kong 报告均已声明该旁路存在）|
| U5 | `DISABLE TRIGGER USER` 对**其余**守卫（`create_key` 不可变 / `no_delete` / `touch_time_updated` / submission 的 `immutable_guard`）的旁路 | 本片只对 `status_guard` 走了 `DISABLE` 反例（§3.5），其余 5 个触发器**未逐项**做旁路实测。**NOT_MEASURED** |
| U6 | `session_replication_role='replica'` 旁路 | 本角色 **`42501` 权限被拒** ⇒ 无法在该角色下实测 replica 模式。**NOT_MEASURED** |
| U7 | `reviewed_by` 指向**存在但非雇主**的用户 | DB 层无「审核方 = 雇主」校验（`DL56` 未要求）⇒ **未作为缺陷判负**；路由层语义**未验证** |
| U8 | 同 `(job_id, worker_uid)` **多次提交**的业务语义 | 两表无 `UNIQUE(job_id,worker_uid)`（`DL56` 未要求）⇒ 只由 `create_key` 幂等区隔；业务语义**未验证** |
| U9 | `time_updated` 在**同事务多次 UPDATE** 下的刷新次数 / 单调性 | 只测「一次 UPDATE 后已刷新且覆盖客户端传值」；多次与时钟回拨边界**未测**。**NOT_MEASURED** |
| U10 | 路由层「同键重放 ⇒ 200」 | 属 `src/**`（本片硬边界不改）；本片只证 DB 层 `23505` |
| U11 | 高隔离级别下的并发行为 | 全部读数均在**默认 `READ COMMITTED`**；`REPEATABLE READ` / `SERIALIZABLE` 下部分唯一索引与守卫行为**未测** |
| U12 | 规模面：部分唯一索引在**数万–百万行**下的写入/维护开销 | 本片数据量（≤32 行）无代表性；**未做压测**。**NOT_MEASURED** |
| U13 | 并发 DELETE+UPDATE、并发 DDL（`REINDEX` / `VACUUM FULL`）与守卫的交互 | 未测（且 DDL 被本片硬边界排除）。**NOT_MEASURED** |
| U14 | `status` / `review_status` 的**字符变体全集**（前后空格、Unicode 同形字等） | 只测了大小写、空串、带引号 4 变体（全拒）；**未穷举** ⇒ 完整性未证。**NOT_MEASURED** |
| U15 | 迁移链 `0013` 行名与磁盘文件名不一致（DB `0013_job_core.sql` vs 文件 `0013_job.sql`） | checksum **一致**（无 drift、`migrate.ts` 14/14 `skipped`）；**未判负**（不属 `0014` 本片），仅登记待 Zang 裁定是否需要改名对齐 |

---

## 7. 给 Kong 报告的两条**必须**修正（均不阻塞 verdict）

1. **§4 推论必须加条件**：`「CHECK 23514 只能由 INSERT 触达」` ⇒ 改为 `「守卫启用（无 owner 旁路）时，INSERT 触达 23514，UPDATE 触达 LD011」`；反例 = 表 owner `DISABLE TRIGGER` 后 UPDATE 即 `23514`（本片读数）。**举反例在此：`ALTER TABLE … DISABLE TRIGGER trg_job_application_status_guard` 成功且 UPDATE 返回 `23514/job_application_status_enum`。**
2. **§0/§1 版本引用**：上游 spec 现盘为 **v0.5**（md5 `ed8e2a1f19c86b39db880533ee1cbae8`），报告写的是 v0.4；`0014` 相关内容 v0.5 零改动，**仅需改注**。
3. （建议，非必须）**补充登记**：`job_application.job_id` / `worker_uid` **无不可变守卫**（spec 未要求）；两个 `NULL` 目标值走 `23502` 而非 `LD011`；以及**判负自证的恢复步骤需自带红态修复**（§5.1）。

---

### 附：run-tagged 读数索引（scratch，**不在被检仓库**）
`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3-0014-review/`
- `neng14-20260928-0554-contract-and-attack.json`（契约对拍 + 状态机/不可变/边界/★断言 + 残差）+ `log-01-contract.txt`
- `neng14-20260928-0554-concurrency-falsify-FATAL.json`（并发 R1–R5 部分读数：**F2 红证在此**）+ `log-02-concurrency.txt`
- `neng14-20260928-0554-repair-restore.json`（事故修复：重复 key 清单 + 索引重建 + 终态核对）+ `log-03-repair.txt`
- `neng14-20260928-0554-finalize.json`（回绿 R6 / **改法 A** / **改法 B** / 终态）+ `log-04-finalize.txt`
- `neng14-20260928-0554-guards-delete-touch.json`（`DL79` 禁 DELETE + `DL75③` 刷新）+ `log-07-guards.txt`
- `neng14-20260928-0554-final-state.json` / `neng14-20260928-0604-final-state.json`（迁移链逐行校验和 + 库终态 + 残差）+ `log-06-state.txt` / `log-08-state2.txt`
- `log-05-migrate.txt`（迁移复跑：14/14 `skipped`、exit 0）
- 探针源：`neng14-lib.ts`、`neng14-01…neng14-06*.ts`
