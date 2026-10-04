// ============================================================================
// 招工线 + 我的 · API 接线层（P4-B4c-ii-a / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v0.9 §4.2（J1–J6）/ §4.4-14 / §4.5 / §3.3（R107）
// 只调用**已注册**路径（真源 = backend-ts/src/index.ts 的 `app.<verb>(` 表，现取 65 行）：
//   GET  /api/task/all                       招工列表（§1 #9【保留·改接】task→job）
//   GET  /api/task/:tID                      招工详情（miss ⇒ 404 R107，§3.1）
//   GET  /api/task-progress                  我的提交（worker 轴；★`jID` = `submission_id`）—— **同一任务可多条**
//   GET  /api/job/:jobId/submissions         该任务逐条提交（★S6 入库；准入 = 发布者本人 ∨ `review_tasks`）
//   GET  /api/tasklist/pending-verification  待审核队列（admin · review_tasks）
//   GET  /api/user/asset/:uID                余额读数（5 键）
//   POST /api/job                            发布招工 + 托管（J1）
//   POST /api/task-progress/:identifier/submit  提交交付物（J4 · 既有面）—— ★`identifier` = 目标 **`job_id`**
//   POST /api/job/:jobId/submit              提交交付物（J4 · 别名面，`:jobId` 语义 = identifier = **`job_id`**）
//   POST /api/job/:jobId/review              审核（J5 approve ⇒ settle / approved:false ⇒ refund）
//
// ★ S3b（S2 契约同步 · 前端侧）：`POST /api/job/:jobId/apply`（J2 报名）与 `POST /api/job/:jobId/accept`
//   （J3 选定）两**写面已下架**（后端恒 `410` + `details.reason` = `APPLY_RETIRED` / `ACCEPT_RETIRED`）
//   ⇒ 本层**删除** `applyToJob` / `acceptApplication` 两接线函数，前端**零调用**（与 `shard/redeem` 同先例）。
//   连带口径：提交**无报名前置**（任何已登录 actor 可提交，同人可多次）；`batt` 闸由「报名」移到「提交」。
// ★ 幂等键**逐面声明**（后端零改动；行号 = 现取真源，逐面依据见报告 §幂等键逐面声明）：
//   ① 发布招工 POST /api/job            ⇒ **前端提供** `cli:` 键 —— 服务端 fail-loud（缺键 ⇒ 400
//        `LEDGER_IDEMPOTENCY_KEY_REQUIRED`；`backend-ts/src/job-funds-service.ts:84`
//        `resolveJobCreateKeyRequired`）⇒ 本层用 tracker 保证「同一次用户操作重试 ⇒ 同一个键」
//   ② 申请 POST /api/job/:jobId/apply   ⇒ ★**已下架**（恒 `410` + `details.reason='APPLY_RETIRED'`）⇒ 本层**零接线**（无键面）
//   ③ 接受 POST /api/job/:jobId/accept  ⇒ ★**已下架**（恒 `410` + `details.reason='ACCEPT_RETIRED'`）⇒ 本层**零接线**（无键面）
//   ④ 提交 POST /api/task-progress/:identifier/submit ⇒ **服务端派生**（`backend-ts/src/job-service.ts:133`）⇒ 不传键
//   ⑤ 审核 POST /api/job/:jobId/review  ⇒ **服务端派生**事件根键 `biz:job:settle:<job_id>:<submission_id>`
//        （`backend-ts/src/job-funds-service.ts:232`；缺提交号退化为 `biz:job:settle:<job_id>`）⇒ 不传键
//   ⑥ 我的余额 / 流水 = **纯读面** ⇒ 无键
// 依据 §4.5 v0.6 追加块「契约 1/2」：**异标识 ⇒ 落新行** ⇒ 前端在服务端已派生键的面自造键 = 重试变第二行。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { createIdempotencyKeyTracker } from '../../idempotency'

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

// ---- 读面（全部已注册） ------------------------------------------------------
export const fetchJobList = (user) => getJson('/api/task/all', user)
export const fetchJobDetail = (tID, user) => getJson(`/api/task/${tID}`, user)
export const fetchMyApplications = (user) => getJson('/api/task-progress', user)
export const fetchPendingVerification = (user) => getJson('/api/tasklist/pending-verification', user)
/** 余额读数（§2.1：`/api/user/asset/:uID` = `normalizeAsset` 5 键 `index_id/uID/points/lucks/time_update`） */
export const fetchUserAsset = (uID, user) => getJson(`/api/user/asset/${uID}`, user)

/**
 * ★S7 该任务逐条提交读口（`GET /api/job/:jobId/submissions`，**已注册** `backend-ts/src/index.ts:2483`；S6 入库）。
 * 准入 = **发布者本人 ∨ 持 `review_tasks`**（复用既有 `requireJobOwnerOrAdmin` 归属闸）⇒ 非本人且无权限 **403 AUTH_FORBIDDEN**；
 * 无 token 401；任务不存在 / 非数字 **404**。`data` = 逐条 **9 键**
 * （`submission_id/job_id/worker_uid/deliverable/review_status/reviewed_by/reviewed_at/review_memo/time_created`）。
 * ★ 本口即前端「是否发布者」的唯一判据（任务详情 `/api/task/:tID` 的 `TaskRecord` **不含**发布者 uid ⇒ 本地无从判定）。
 */
export const listJobSubmissions = (jobId, user) => getJson(`/api/job/${jobId}/submissions`, user)

// ---- 写面 -------------------------------------------------------------------
/**
 * J1 发布招工 + 托管。`reward` = **A 类供给侧自主出价**（§4.8.1：客户端可传、原样透传、路由层零计算）。
 * `headcount` = **总人数**（R-9-97：≥1 整数；缺省交服务层 `'1'`，`job-funds-service.ts:183`）
 *   ⇒ 托管总额 = `reward × headcount`（金额**由 DB 侧派生**，前端只展示提示、不做托管计算）。
 * `createKey` = 前端提供的 `cli:` 键（见文件头 ①）。
 */
export const publishJob = ({ cid, reward, title, description, headcount, createKey, user }) =>
  postJson('/api/job', { cid, reward, title, description, headcount, create_key: createKey }, user)

/**
 * J4 提交交付物（既有已注册面）。★ S3b：`identifier` = 目标 **`job_id`**（S2 起语义换轴；**不再是**申请编号）。
 * 键 = 服务端派生（见文件头 ④）⇒ 不传；同实体异内容 ⇒ 服务端 `409 LEDGER_IDEMPOTENCY_CONFLICT`
 * （§2.4 S10 的条件触发面：需「同实体 + 改内容」时才要补 `create_key`）。
 * 口径：**无报名前置**、同人可多次提交（每次落一条 `job_submission`）。
 */
export const submitDeliverable = (identifier, deliverable, user) =>
  postJson(`/api/task-progress/${identifier}/submit`, { info_input: deliverable }, user)

/**
 * J5/J6 审核（§4.2 A5；`POST /api/job/:jobId/review`，**已注册** `backend-ts/src/index.ts:2457`）。`jobId` = **job_id**。
 * ★S7 逐笔：S6 起该口收可选 **`submission_id`**（现取 `:2464` = `req.body?.submission_id ?? req.body?.submissionId`：
 *   body 形态 = `{ approved, submission_id }`）⇒ `approved:true` = 发一份赏金；`approved:false` = 零资金、该提交转 `rejected`、任务保持 `open`。
 *   ★（S6b 并行单正修 `approved:false` 分支，现状会错成「整单退款」⇒ 前端**只接线、不改后端**。）
 *   `submissionId` 缺省（无提交号）⇒ 服务层落遗留单笔分支 ⇒ 在 **0042 新模型**下必失败
 *   （`409 LEDGER_CURRENCY_INVALID_TRANSITION`）⇒ **新代码一律逐笔带上提交号**（S13 修正）。
 *   ★ 为保持既有调用点签名兼容，提交号作**第 4 参**（`JobReviewPage` / `JobDetailPage` 现均传）。
 * 幂等键 = 服务端派生（见文件头 ⑤）⇒ 不传键。
 */
export const reviewSubmission = (jobId, approved, user, submissionId) =>
  postJson(`/api/job/${jobId}/review`, { approved, submission_id: submissionId }, user)

// ---- 幂等键 tracker（发布招工面唯一需要前端供键的面） -------------------------
/**
 * 键形与服务端同形：`cli:<uuid-v4>`（`frontend/src/idempotency.js:28`）。
 * 用法：`tracker.keyFor(fingerprint)` —— 指纹不变（同一次操作重试）⇒ **同一个键**（服务端 `200` replay）；
 * 指纹变化（用户改了表单）⇒ 新键（= 新实体，符合 §4.5 契约 2）；**成功后 `reset()`**。
 */
export const createJobPublishTracker = () => createIdempotencyKeyTracker('cli')

/** 表单内容指纹（决定「是否同一次操作」）：不含随机量，保证重试同指纹。
 *  ★ S5①：`headcount` 入指纹 —— 人数变了即「新实体」（服务端托管额随之变，改后就地重试不得复用旧键）。 */
export const jobPublishFingerprint = ({ cid, reward, title, description, headcount }) =>
  [cid, reward, title, description, headcount].map((v) => String(v ?? '').trim()).join('\u0001')
