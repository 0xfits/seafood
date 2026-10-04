# S16 · 待审队列读口准入放宽（admin ∨ 已登录；非 admin 只看「自己任务」的 pending 提交）

**单号**：S16（补记 · 后端已入库 `9bd1df0`）
**角色**：Kong
**基线上游**：S16 开工基线 = 本仓 `9bd1df0` 的父提交；改后已入库 `9bd1df0`
**口径**：**只改后端**（`backend-ts/src/{index.ts,database.ts}`）；**不 commit / push**（入库由主会话完成，逐字见 `git show 9bd1df0`）。
**★ 本报告为 S16 补写**（S16 入库时未落报告）；读数逐字取自入库探针产物 `backend-ts/.p9s16-arms/`、`backend-ts/.p9s16-recon/`。

---

## 1. 缺陷 / 缺口（可用性）

| # | 落点（改前） | 事实 |
|---|---|---|
| ① | `GET /api/tasklist/pending-verification` + `/count` | 准入 = `requireAdmin(review_tasks)` ⇒ 普通发布者 `403 AUTH_FORBIDDEN` |
| ② | 后果 | 普通发布者**看不到**别人提交到自己任务的待审交付物 ⇒ 无法在 `/task/review` 自助审核（只能等管理员） |
| ③ | 归属信息现取 | 提交行 `job_submission` 无发布者列 ⇒ 发布者轴只能经 `job.employer_uid` 关联（新模型无 `job_application` 申请轴） |

**修法（S16）**：读口准入放宽为「**admin（持 `review_tasks`）∨ 已登录**」；非 admin 只返回**其作为发布者（`job.employer_uid = 他`）的任务上的 `pending` 提交**；admin ⇒ 全局（既有行为零回归）；未登录 ⇒ **401**（不是 403）。过滤谓词 **list / count 两处同源**。

---

## 2. 改动逐处（逐字溯 `git show 9bd1df0`）

### 2.1 `backend-ts/src/index.ts`

| 处 | 行（改后现取） | 改动 |
|---|---|---|
| 新助手 `resolveReviewQueueScope(req,res)` | `:366`（定义）/ `:1975`（count 调用）/ `:1992`（list 调用） | `requireActor(req,res)`（未登录 ⇒ 既有 **401**，返回 null **不落 403**）；admin 判定与 `requireAdmin(req,res,'review_tasks')` **放行条件逐字同源** = `adminAccess.can_access_admin ∧ (is_admin ∨ permissions∋review_tasks)`；`employerFilterUid = isReviewAdmin ? null : actor.user.uID` |
| `GET /api/tasklist/pending-verification/count` | `:1972` | `requireAdmin` → `resolveReviewQueueScope`；`countPendingVerification(scope.employerFilterUid)` |
| `GET /api/tasklist/pending-verification` | `:1989` | `requireAdmin` → `resolveReviewQueueScope`；`listPendingVerification(skip, limit, scope.employerFilterUid)` |

> ★ **未改**：`POST /api/tasklist/:jID/verify` 仍 `requireAdmin(review_tasks)`（admin-only 零回归）；发布者的**判定动作**仍走 `POST /api/job/:jobId/review`（归属闸 `requireJobOwnerOrAdmin`，早已支持雇主）。

### 2.2 `backend-ts/src/database.ts`（★ 发布者过滤谓词**唯一真源**）

| 处 | 改动 |
|---|---|
| `PENDING_VERIFICATION_FROM_SQL`（`:4008` 现取） | 抽出的共享 `FROM … JOIN users u … LEFT JOIN job j ON j.job_id = s.job_id WHERE …`（`LEFT JOIN` 非 inner：`$1 IS NULL`（admin）路径不因 join 丢行 ⇒ 与改前逐行同结果；孤儿提交在发布者路径自然排除） |
| `PENDING_VERIFICATION_SCOPE_SQL` | `'AND ($1::bigint IS NULL OR j.employer_uid = $1::bigint)'` —— 谓词占位符**固定 `$1`**，list/count **共用** |
| `listPendingVerification(skip=0, limit=50, employerUid=null)` | 手编 `$1..$3`（`$1`=employerUid、`$2`=limit、`$3`=skip）；`FROM`/`SCOPE` 两段引共享常量 |
| `countPendingVerification(employerUid=null)` | 同上引两段共享常量（`[$1]`=employerUid） |

> **同源判据**：两查询均以共享常量 `PENDING_VERIFICATION_FROM_SQL` + `PENDING_VERIFICATION_SCOPE_SQL` 拼装，谓词占位符恒 `$1` ⇒ **一处定义、两处消费**（`grep` 现取 = 各 1 引）。

---

## 3. 三臂读数（真 HTTP · 受控实例 **5796** · 真库 `schema_version=0042`）

探针：`backend-ts/.p9s16-arms/arms.ts`（产物 `arms-out.json`）；探针前置 = 后端已起于 `127.0.0.1:5796`。
基线（无 fixture）：全局可见 pending = `[]`。造 3 条 fixture（`worker=12` 非 admin）：

| fixture | 提交号 | 落在 job（雇主） | 发布者 3 应否可见 |
|---|---|---|---|
| FX-OWN | **242** | job 22（雇主 **3** 非 admin） | **应见** |
| FX-OTHER | **243** | job 23（雇主 **11** 非 admin） | 不应见（别人的） |
| FX-ADMINJOB | **244** | job 24（雇主 **1** admin） | 不应见（管理员 job） |

| 臂 | 请求（token = `createSessionToken`） | 读数 |
|---|---|---|
| **(a) 普通发布者 uid 3** | `GET …/pending-verification` + `/count`，Bearer(3) | **200** `success:true`；`item_ids=[242]`、`job_ids=[22]`、`count_field=1`（== 列表长度）；item 键 **11 个**（`jID/tID/uID/info_input/time_created/time_submitted/time_checked/time_claimed/points_claimed/task/user`） |
| **(b) admin uid 1** | 同上，Bearer(1) | **200**；`item_ids=[242,243,244]` **== 改前全局口径逐 id 相同（零回归）**；`count_field=3` |
| **(c) 未登录** | 两口无 token | **401 `AUTH_UNAUTHORIZED`**（list/count 双口） |

**判负 3 条**（全绿）：

| 判负 | 判据 | 读数 |
|---|---|---|
| ① **泄漏** | 发布者集须**严格真子集**于全局；去掉过滤 ⇒ 读到他人提交 ⇒ 必红 | 发布者 `[242]` ⊊ 全局 `[242,243,244]`；隐藏 = `[243,244]`（FX-OTHER/FX-ADMINJOB） |
| ② **跨发布者隔离** | uid 11 只见**自己** job23 | 200；`ids=[243]`、`jobs=[23]`；**不含** 242/244 |
| ③ **未登录** | 必须 **401**（非 200 / **非 403**） | 401 |

**净写 0**（读口归因 · 请求窗口 vs 无请求对照窗口；3 轮）：`req_sum = {d_le:0, d_jobs:0, d_subs:0}`；`ctrl_sum = {…同 0}` ⇒ 本读口**零写**。

---

## 4. fixture 登记（终态 + 复原）

| 批次（`create_key` 前缀） | 提交号 | 终态 |
|---|---|---|
| `p9s16-1791078082215` | **239 / 240 / 241**（job 22/23/24） | `rejected`（`reviewed_by=1`）|
| `p9s16-1791078180860` | **242 / 243 / 244**（job 22/23/24） | `rejected`（`reviewed_by=1`）|

- 清理语句：`UPDATE job_submission SET review_status='rejected', reviewed_by=1, reviewed_at=now() WHERE create_key LIKE 'p9s16-%'`（`job_submission` 不可物理删 = DL56 守卫 ⇒ **合法终态 = `rejected`**）。
- **可见 pending 复原为 `[]`**（= 造 fixture 前基线；`arms-out.json.pending_visible_after_cleanup = []`）。
- 现取复核（S17a 开工时只读查询）：`submission_id ∈ [239..244]` **六条全部 `rejected`**；`visible_pending_now = []`。

---

## 5. 同族扫面（保持 **admin-only** 的平台级面 · 逐条登记 · **本单未动**）

全仓 `requireAdmin(` 现取 = **24 命中**（含注释/助手定义 2 处）。**平台级 admin-only 面**按权限键登记（行号现取 `backend-ts/src/index.ts`）：

| 权限键 | 面（路由 · 行） | 本单处置 |
|---|---|---|
| `manage_settings` | `GET/POST /api/admin/settings`（`:1664/:1693`）、`POST /api/admin/settings/reset`（`:1799`）、`:2717/:2753`（后台配置面） | **保持 admin-only · 未动** |
| `manage_permissions` | `GET /api/admin/permissions`（`:1803`）、`POST …/save`（`:1822`）、`POST …/delete`（`:1852`） | 同上 |
| `manage_users` | `POST /api/admin/user/update`（`:1874`） | 同上 |
| （bare `requireAdmin`） | `GET /api/user/all`（`:1938`）、`GET /api/user/stats`（`:1956`）、`POST /api/admin/points/adjust`（`:2104`） | 同上 |
| `review_tasks`（**审核动作 / 合规面**） | `POST /api/tasklist/:jID/verify`（`:2007`，**admin-only 审核动作面**）、`requireJobOwnerOrAdmin` 兜底（`:2341`）、合规审核面 `:2775/:2795/:2835/:2855/:2885/:2906`（listing/currency/arbitration takedown 族） | 同上（**读口已放宽，动作面仍 admin-only**） |
| `manage_audit` | 审计台（`:2942`） | 同上 |

**前端同族面**（未动）：

| 文件:行 | 面 | 说明 |
|---|---|---|
| `frontend/src/pages/jobs/PublishJobPage.jsx:34,102-103` | 发布页「审核入口」链接（`data-sf-m="jobs-review-link"`） | 仍按 `hasAdminPermission(review_tasks)` 隐藏 ⇒ 普通发布者**看不到入口链接**（登记为 S17a 后的**可发现性缺口**，非正确性缺陷；S17a 未改） |
| `frontend/src/pages/DashboardPage.jsx:120,259` | `/dashboard` 待审计数 / 队列面板 | 仍按 `review_tasks` 门（`/dashboard` 本身即 admin 面）⇒ 保持 |
| `frontend/src/pages/jobs/JobReviewPage.jsx:51`（改前） | `/task/review` 队列页整页门 | **S16 未随之放开** ⇒ 后端放宽对普通用户**无效** ⇒ 由 **S17a** 收口（见 `s17a-review-page-gate-open.md`） |

---

## 6. 边界与纪律

- ✅ 只改后端 2 文件；探针在 `backend-ts/.p9s16-arms/`、`.p9s16-recon/`（**非** `scripts/`）。
- ✅ 不 commit / push（入库 `9bd1df0` 由主会话完成）；不 `npm install`；未启停 5787/5788；未占 5796 以外端口。
- ✅ 连库只从主仓 `.env.local` 加载，未复制/回显连接串、密钥、令牌。
- ✅ 未使用 `pkill -f` / `killall`；受控实例按精确 PID 收尾。
