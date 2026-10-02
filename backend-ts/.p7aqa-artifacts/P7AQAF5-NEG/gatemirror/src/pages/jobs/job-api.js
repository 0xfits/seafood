// ============================================================================
// 招工线 + 我的 · API 接线层（P4-B4c-ii-a / Kong）
// 依据（唯一权威）：docs/route-layer.spec.md v0.9 §4.2（J1–J6）/ §4.4-14 / §4.5 / §3.3（R107）
// 只调用**已注册**路径（真源 = backend-ts/src/index.ts 的 `app.<verb>(` 表，现取 65 行）：
//   GET  /api/task/all                       招工列表（§1 #9【保留·改接】task→job）
//   GET  /api/task/:tID                      招工详情（miss ⇒ 404 R107，§3.1）
//   GET  /api/task-progress                  我的报名（worker 轴；jID = application_id）
//   GET  /api/tasklist/pending-verification  待审核队列（admin · review_tasks）
//   GET  /api/user/asset/:uID                余额读数（5 键）
//   POST /api/job                            发布招工 + 托管（J1）
//   POST /api/job/:jobId/apply               申请报名（J2）
//   POST /api/job/:jobId/accept              雇主选定（J3）
//   POST /api/task-progress/:identifier/submit  提交交付物（J4 · 既有面）
//   POST /api/job/:jobId/submit              提交交付物（J4 · 别名面，`:jobId` 语义 = identifier）
//   POST /api/job/:jobId/review              审核（J5 approve ⇒ settle / approved:false ⇒ refund）
//
// ★ 幂等键**逐面声明**（后端零改动；行号 = 现取真源，逐面依据见报告 §幂等键逐面声明）：
//   ① 发布招工 POST /api/job            ⇒ **前端提供** `cli:` 键 —— 服务端 fail-loud（缺键 ⇒ 400
//        `LEDGER_IDEMPOTENCY_KEY_REQUIRED`；`backend-ts/src/job-funds-service.ts:84`
//        `resolveJobCreateKeyRequired`）⇒ 本层用 tracker 保证「同一次用户操作重试 ⇒ 同一个键」
//   ② 申请 POST /api/job/:jobId/apply   ⇒ **服务端派生**（`backend-ts/src/job-service.ts:180`）⇒ 前端**不传键**
//   ③ 接受 POST /api/job/:jobId/accept  ⇒ **无键面**（业务状态机 + 部分唯一索引 `uniq_job_application_accepted`）
//   ④ 提交 POST /api/task-progress/:identifier/submit ⇒ **服务端派生**（`backend-ts/src/job-service.ts:133`）⇒ 不传键
//   ⑤ 审核 POST /api/job/:jobId/review  ⇒ **服务端派生**事件根键 `biz:job:settle:<job_id>`
//        （`backend-ts/migrations/0013_job.sql:592`）⇒ 不传键
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

// ---- 写面 -------------------------------------------------------------------
/**
 * J1 发布招工 + 托管。`reward` = **A 类供给侧自主出价**（§4.8.1：客户端可传、原样透传、路由层零计算）。
 * `createKey` = 前端提供的 `cli:` 键（见文件头 ①）。
 */
export const publishJob = ({ cid, reward, title, description, createKey, user }) =>
  postJson('/api/job', { cid, reward, title, description, create_key: createKey }, user)

/** J2 申请报名。键 = 服务端派生（见文件头 ②）⇒ 刻意不传 `create_key`。 */
export const applyToJob = (jobId, user) => postJson(`/api/job/${jobId}/apply`, {}, user)

/** J3 雇主选定打工人。无键面（见文件头 ③）。 */
export const acceptApplication = (jobId, applicationId, user) =>
  postJson(`/api/job/${jobId}/accept`, { application_id: applicationId }, user)

/**
 * J4 提交交付物（既有已注册面）。`identifier` = `application_id`（§4.4-16 路由入口语义）。
 * 键 = 服务端派生（见文件头 ④）⇒ 不传；同实体异内容 ⇒ 服务端 `409 LEDGER_IDEMPOTENCY_CONFLICT`
 * （§2.4 S10 的条件触发面：需「同实体 + 改内容」时才要补 `create_key`）。
 */
export const submitDeliverable = (identifier, deliverable, user) =>
  postJson(`/api/task-progress/${identifier}/submit`, { info_input: deliverable }, user)

/** J5/J6 审核。`jobId` = **job_id**（A5 面入参；approve ⇒ settle、approved:false ⇒ refund）。键 = 服务端派生（见文件头 ⑤）。 */
export const reviewSubmission = (jobId, approved, user) =>
  postJson(`/api/job/${jobId}/review`, { approved }, user)

// ---- 幂等键 tracker（发布招工面唯一需要前端供键的面） -------------------------
/**
 * 键形与服务端同形：`cli:<uuid-v4>`（`frontend/src/idempotency.js:28`）。
 * 用法：`tracker.keyFor(fingerprint)` —— 指纹不变（同一次操作重试）⇒ **同一个键**（服务端 `200` replay）；
 * 指纹变化（用户改了表单）⇒ 新键（= 新实体，符合 §4.5 契约 2）；**成功后 `reset()`**。
 */
export const createJobPublishTracker = () => createIdempotencyKeyTracker('cli')

/** 表单内容指纹（决定「是否同一次操作」）：不含随机量，保证重试同指纹。 */
export const jobPublishFingerprint = ({ cid, reward, title, description }) =>
  [cid, reward, title, description].map((v) => String(v ?? '').trim()).join('\u0001')
