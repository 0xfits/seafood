# job-project-gate · 发布悬赏需拥有在管项目（后端闸）

规则（Kevin 2026-10-21）：`POST /api/job`（`publishJob`）的前提 = 用户必须**拥有且正在管理**至少一个
项目（`project.owner_uid = 本人 ∧ status <> 'ended'`）；0 行 ⇒ 拒绝。

## 结论

| 项 | 读数 |
|---|---|
| 闸位 | `publishJob` **最前**（早于 create_key 形状 / employer 闸 / `jobPostEvent`） |
| 错误体例 | `403 AUTH_FORBIDDEN` + `details.reason='project_required'`（借既有 AUTH_* 码域，`i18n_key=auth.err.AUTH_FORBIDDEN`） |
| 零新增 | 零新路由（regs **128** = get 55 / post 66 / patch 4 / delete 3 / put 0）· 零新错误码（33 码闭集不动）· 零新 kind（24）· 零新文案键 |
| 新增读口 | `hasManagedProject(uid, ex?)`（`project-service.ts`，**纯 SELECT**） |
| 门 | `ops/job/project-gate.ts` **18/18**（含负控） |
| 门套 | `tsc --noEmit` exit 0 · `p7b-03` **37/37**（`AC10-2` regs=128 不动） |

## 门臂（读 `readings/job-project-gate-*.json`）

- **A1–A9**（静态）：注册点 / 单一 `POST /api/job` / 闸在最前（位置读数 gate 677 < create_key 1503 < post_event 2903）/
  错误体例字面 / 读口纯 SELECT（零写关键字）/ 错误码闭集 / kind 闭集 / 闸真源只在服务层 / `ex` 贯通。
- **S1** 读口四态：无项目 `false` · recruiting `true` · working `true` · **ended `false`** · 他人项目 `true`。
- **S2 臂①** 无项目用户发布 ⇒ **403 `project_required`** 且**零写库**（job 45→45 / 托管 74→74 / ledger 514→514 / 余额与 frozen 不变）。
- **S3 臂②** 有 recruiting 项目 ⇒ **200** 与改前一致（job 45→46 · 托管 +2 腿 · 余额 −100 · frozen +100 · `created=true`）。
- **S4 臂③** 项目 `ended` ⇒ 403 `project_required`（零写库）。
- **S5 臂④** 他人项目不算：本人在他人项目**在职**（`project_worker` hired 1 行）但零自有项目 ⇒ 仍 403。
- **S6** 正控：`working` 项目所有者 200；他人（自有 recruiting 项目）200。
- **S7** 正控：同 `create_key` 重投 ⇒ 200 `idempotent_replay`、同 job_id、行数不变（闸不破幂等语义）。
- **N1 负控（判据可红）**：把闸谓词中和成 `false &&`（恰 1 处替换、`typescript.transpileModule` + `Module._compile` **纯内存、零落盘**）⇒
  无项目用户**发布成功 200 + `created=true` + job +1** ⇒ 臂① 的判据对闸敏感。
- **Z1** 零残留：提交面无本门夹具（job / project / users 各 0 行）。

## 实现

- `backend-ts/src/project-service.ts`：新增**只读** `hasManagedProject(uid, ex?)`
  （`SELECT 1 FROM public.project WHERE owner_uid = $1::bigint AND status <> 'ended' LIMIT 1`；
  `ex` 注入供门在回滚事务内跑真路径）。
- `backend-ts/src/job-funds-service.ts`：`publishJob` 加 `ex?: TxClient`（与 project 域 verb 同族），
  闸置于 `actorGate` 之后、`employer_uid` / `create_key` / 托管之前；`jobPostEvent(payload, ex)`。

## 已知边界（不在本单范围）

- **前端**（`frontend/src/pages/jobs/job-api.js` 仍直接 `postJson('/api/job', …)`）：无项目用户现在会收到
  403；「新建项目」入口与错误文案属**前端另单**。本单未改 `frontend/**`、未改 `docs/**`。
- 历史直调脚本（`backend-ts/scripts/p4z-b3c-02-e2e.ts` / `p4z-b3c-03-chain.ts` / `p4z-b4a-01-http-e2e.ts` 等
  legacy 探针）的发布臂现在需要夹具先有项目，否则得 403 —— 属**预期行为变更**，不在门套口径内。
- dev 库实测：schema `0066`，`project` 10 行（全非 ended），cid 1 = `$`（listed）。
