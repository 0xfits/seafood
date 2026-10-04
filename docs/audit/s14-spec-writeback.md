# S14 本批规范回写报告 —— S0 冻结口径 → 实现形态登记（4 册纯追加）

- **单**：S14 本批规范回写（S0「应然」冻结 → 按实现后实际形态回写 + 差异清单）
- **执行**：Jing（规范角色）· 2026-10-04（CST）
- **基线**：`6ce91bc`（开工 `git log --oneline -1` 现取，与派单一致）
- **范围**：**只写** `docs/route-layer.spec.md` · `docs/data-layer.spec.md` · `docs/ledger.spec.md` · `docs/commission.spec.md` + 4 份改后快照 `docs/versions/*` + 本报告
- **硬口径**：不 commit / 不 push ✓ · 未起服务 / 未占端口 ✓ · 禁 `pkill -f` / `killall` ✓ · 未 `npm install` ✓ · **未碰** `backend-ts/**` · `frontend/**` · `docs/seafood.master-plan.md` · 未碰 / 未打印 `.env*`（连库仅由脚本 `dotenv` 自加载，未复制 / 未回显）✓

---

## ① 逐条现取核验（**6 项 · 真源锚点逐条给出**）

> 全部读数 = 2026-10-04 现取；代码锚点 = `backend-ts/src/{index.ts,database.ts,job-service.ts}`；库锚点 = 只读探针（`schema_migration` / `information_schema` / `pg_indexes` / `pg_constraint`）。

| # | 派单口径 | 现取读数 | 判定 |
|--:|---|---|---|
| 1 | `POST /api/job/:jobId/review`：canonical `submission_id` + 别名 `submissionId`；三者全缺 ⇒ 降级「遗留单笔」 | `index.ts:2493` `const submissionIdRaw = req.body?.submission_id ?? req.body?.submissionId;` + `:2494-2495` `hasSubmission = submissionIdRaw !== undefined && !== null && String(...).trim() !== ''` | **属实** |
| 2 | `GET /api/job/:jobId/submissions` 逐条 9 键 | `database.ts:2653` `listJobSubmissions` SELECT = `submission_id / job_id / worker_uid / deliverable / review_status / reviewed_by / reviewed_at / review_memo / time_created`（恰 9）；类型 `JobSubmissionRecord` = `:1214`（9 字段）；路由 `index.ts:2551` | **属实** |
| 3 | 非发布者且无权限 ⇒ `403` + `reason` 既有闭集；任务不存在 ⇒ `404` | `requireJobOwnerOrAdmin`（`index.ts:2318`）→ `sendRefNotFound`（`:2300`, 404）；`requireAdmin('review_tasks')`（`:335`）⇒ `reason = NOT_ADMIN`（非 admin）/ `PERMISSION_NOT_GRANTED`（admin 缺键）；闭集 `AUTH_REASONS` = `index.ts:290` = `ACTOR_NOT_ALLOWED` / `NOT_ADMIN` / `PERMISSION_NOT_GRANTED` | **属实**（本批入口落 `NOT_ADMIN`） |
| 4 | `job_application` 停写：服务层 verb 保留 + `@deprecated`；路由 `/apply` `/accept` ⇒ `410` | `job-service.ts:183`（`applyToJob` · 定义 `:186`）/ `:223`（`acceptApplication` · 定义 `:226`）标 `@deprecated`；`database.ts:3321`（`resolveJobApplication`）标 `@deprecated`；路由 `index.ts:2402`（/apply）/ `:2424`（/accept）⇒ `410`，`details.reason` = `APPLY_RETIRED` / `ACCEPT_RETIRED` | **属实**（见差异 #4：派单写 `acceptApplication`，DB 侧写方法实为 `acceptJobApplication`） |
| 5 | `GET /api/job/:jobId/applications` 裁「不实现」⇒ 退役 | `src/index.ts` 现取 **0 命中**（无该路由） | **属实**（本批规范明写退役，见差异 #5） |
| 6 | 迁移 `0041` / `0042`；真库 `schema_migration` = **42 行 / max `0042`** | 文件在盘：`0041_job_headcount.sql` / `0042_job_settle_per_submission.sql` ✓；★ 真库现取 = **41 行 / `max(version) = '0042'` / `min = '0001'`**（**非 42 行**） | **迁移属实；「42 行」不符** ⇒ 见 §② 差异 #6 |

---

## ② 「冻结口径 → 实现形态」差异清单（**只登记 · 不评断**）

> 分类：**一致** / **措辞需对齐** / **实现有额外约定** / **待裁（登记）**。四处逐册正文同载（route §34.10 / data §36.6 / ledger §19.19.F / commission §20.6）。

| # | 冻结口径（S0） | 实现形态（现取） | 分类 |
|--:|---|---|---|
| 1 | route §34.5 逐笔判定；**未冻结 body / 提交号字段名** | body `{approved, submission_id}`（别名 `submissionId`）；三者全缺 ⇒ 遗留单笔分支 | **实现有额外约定** |
| 2 | route §34.4 / data §36.2 读口 identifier ⇒ `submission_id`；**未冻结返回形状** | `/submissions` 逐条 9 键（只读；`job_id` 不存在 ⇒ 空数组） | **实现有额外约定** |
| 3 | 既有归属闸（v2.10 §25.6）「雇主 ∨ 持 `review_tasks`」+ 403 闭集 | 403 `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`；任务不存在 404；零新增码 / reason | **一致** |
| 4 | route §34.3 停写 + §34.7 `/apply` `/accept` `410` | 服务层两 verb 保留 + `@deprecated` + DB 层 `resolveJobApplication` 标 `@deprecated`；路由 410（零表访问） | **一致**；实现有额外约定（`@deprecated` 落点：DB 侧写方法未标注） |
| 5 | 无（S0 未列）；data §3 旧映射含 `/applications` | 不实现（0 命中）⇒ 随「报名」一并退役；与已实现 `/submissions` 成对 | **实现有额外约定 / 明写退役** |
| 6 | route §34.1/§34.6 + data §36.1 迁移**内容契约**；**未冻结文件名** | 实际迁移 = `0041` / `0042`；真库 `schema_migration` = **41 行 / max `0042`**（`0001..0042` 去无文件的 `0018` = 41） | **措辞需对齐**（文件名 / 内容已定稿）；★ 与派单「42 行」不符 |
| 7 | ledger §19.19 A/C 托管 = `reward × headcount`；退款 = `reward × (headcount − 已发放份数)` | `0042` `job_post_event` publish/refund 两支逐字兑现；余额不足 ⇒ 既有 `LEDGER_INSUFFICIENT_BALANCE`（零新增码） | **一致** |
| 8 | ledger §19.19 D#4 / commission §20.4 #2 结算键须含提交标识（待裁） | settle 键 = `biz:job:settle:<job_id>:<submission_id>`；refund 键 `biz:job:refund:<job_id>` 不变；遗留单笔仍 `biz:job:settle:<job_id>` | **实现有额外约定**（键派生定稿） |
| 9 | route §34.5 / ledger §19.19 B `job.status` 枚举不动 | `0042` `job_status_transition_ok` 仅放宽 `open → settled` 一条边；枚举值域一字不动 | **一致** |
| 10 | data §36.3 同一 `(job_id, worker_uid)` 可多行（**不得**保留「一人一单一条」唯一约束） | `job_submission` 索引现取 = `pk(submission_id)` + `uniq(create_key)` + 3 非唯一 ⇒ 无 `(job_id, worker_uid)` 唯一约束 | **一致** |
| 11 | data §36.4 #1/#2 `DL54`/`DL55`（契约作废 / 守卫去留）**待裁** | 只登记实际形态（表停写、历史行保留）；契约 / 守卫去留 **仍待裁**，本节不调和 | **待裁（登记）** |

**★ 与旧条文冲突（逐条列出 · 交裁）**：差异 #11 一处 = `data-layer.spec` §36.4 #1/#2（`DL54`/`DL55` 契约作废 / 守卫去留）仍为**待裁**；本批**只登记实现形态、不调和**。其余各项 = 一致 / 措辞需对齐 / 实现额外约定，**无与旧条文实质冲突**。

**★ 派单口径勘误（1 处）**：派单「真库 `schema_migration` = 42 行」**不符**，实为 **41 行 / max `0042`**（真源 = 只读探针；佐证 = `docs/audit/s10-frozen-push.md` 同口径「迁移**文件**数 = 41 行」+ 现行门 `p8-s10-invite-reward-gate.ts:330` / `p8-s11-audit-console-gate.ts:470` 断言 `41 行 · 0042`）。

---

## ③ 落位（4 册纯追加 + 版本 +1 + 快照）

| 册 | 版本 | 新增子节 | 追加前 md5 | 追加后 md5 | numstat（增 / 删） | 快照 |
|---|---|---|---|---|---|---|
| route-layer.spec.md | v2.23 → **v2.24** | **§34.10 实现形态登记**（含 §34.10.1 真库读数） | `8f145d48d649668f01390210dc0c69db` | `227aabc4a2b82c128fea7252249ea024` | `21 / 0` | `docs/versions/route-layer.spec.v2.24.md` |
| data-layer.spec.md | v0.29 → **v0.30** | **§36.6 实现形态登记**（含 §36.6.1/§36.6.2） | `9f012185a7886484820b41fd6950477b` | `d0938897c123bbfe2232bc75f8ed967b` | `21 / 0` | `docs/versions/data-layer.spec.v0.30.md` |
| ledger.spec.md | v0.16 → **v0.17** | **§19.19.F 实现形态登记**（含 F.1 真库读数） | `cafef7962a6a8748eeb7cf038326f933` | `d945d6dd9853bd018e3be4da21f49204` | `15 / 0` | `docs/versions/ledger.spec.v0.17.md` |
| commission.spec.md | v0.6 → **v0.7** | **§20.6 实现形态登记**（含 §20.6.1 真库读数） | `9e8df4625b1d98c3590f63d19db22096` | `8cc8e82d4ca084d92baa1e4b3ff5e272` | `15 / 0` | `docs/versions/commission.spec.v0.7.md` |

- **纯追加自证**：`git diff --numstat` **删除列 = 0**（4 册合计 `72 insertions(+), 0 deletions(-)`）。
- **追加位置**：route = 末行 `---` **之前**（该册唯一含尾 `---` 者）；data / ledger / commission = 文件**末行之后**（三者无尾 `---`）。版本头 = 各册体例（route 在 v2.23 状态块之后追加 v2.24 状态块；data / ledger / commission 在标题下首条状态行之前插入新版状态行）。
- **快照自证**：`cmp <册> <快照>` **逐一 exit 0**（逐字节相等）。

---

## ④ 三件套读数（原始输出）

- `git diff --numstat -- docs/*.spec.md` ⇒ `15 0`（commission）/ `21 0`（data）/ `15 0`（ledger）/ `21 0`（route）。
- `cmp`（4 组）⇒ 全部 `exit 0`。
- 追加前副本 = 暂存区外目录（`s14-precopy/`），`cmp` 与改前主体逐一相等（未入仓）。

## ⑤ 未测项（诚实边界 · 禁填 0 / 空）

- 本册一切库面读数来自**只读探针**；**未连写库、未启停服务、未跑迁移、未改 `backend-ts/**` 与 `frontend/**`、未改任何 append-only 面、未触 `ledger_post_event` 函数体**。
- 逐笔发放 / 逐步驳回的**端到端资金真读数**不在本单面（属实现单；本单只登记实现**形态**，不重跑资金链路）。
- 未 `npm install`；未跑任何套件。
