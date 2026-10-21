// ============================================================================
// 招工线 · **残留读/写面**（P4-B4c-ii-a / Kong；2026-10-21 Kevin 裁定后收口）
// ----------------------------------------------------------------------------
// ★ 2026-10-21（Kevin 裁定 · job 体系弃用）：`POST /api/job`（发布 + 托管）、`GET /api/task/:tID`
//   （悬赏详情）、`POST /api/task-progress/:identifier/submit`（提交交付物）、`GET /api/task/all`
//   （悬赏列表）、`GET /api/task-progress`（我的提交）、`GET /api/user/asset/:uID`、`GET /api/currencies`
//   （发布页币种选项）与项目准入/建项目一组接线**随页面一并删除**（前端零调用；后端同批下架）。
//   本层只留 **审核线**两条（`/task/review` 页面仍在用）：
//     GET  /api/job/:jobId/submissions         该任务逐条提交（准入 = 发布者本人 ∨ `review_tasks`）
//     GET  /api/tasklist/pending-verification  待审核队列
//     POST /api/job/:jobId/review              审核（approve ⇒ settle；approved:false ⇒ 该提交 rejected）
// 幂等键：审核面 = **服务端派生**（`biz:job:settle:<job_id>:<submission_id>`；缺提交号退化为
//   `biz:job:settle:<job_id>`）⇒ 前端不传键（§4.5 v0.6「异标识 ⇒ 落新行」，自造键 = 重试变第二行）。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from '../../auth'

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

/** 待审核队列（`GET /api/tasklist/pending-verification`）。 */
export const fetchPendingVerification = (user) => getJson('/api/tasklist/pending-verification', user)

/**
 * ★S7 该任务逐条提交读口（`GET /api/job/:jobId/submissions`，S6 入库）。
 * 准入 = **发布者本人 ∨ 持 `review_tasks`** ⇒ 非本人且无权限 **403 AUTH_FORBIDDEN**；
 * 无 token 401；任务不存在 / 非数字 **404**。`data` = 逐条 9 键
 * （`submission_id/job_id/worker_uid/deliverable/review_status/reviewed_by/reviewed_at/review_memo/time_created`）。
 */
export const listJobSubmissions = (jobId, user) => getJson(`/api/job/${jobId}/submissions`, user)

/**
 * J5/J6 审核（`POST /api/job/:jobId/review`）。`jobId` = **job_id**；S6 起该口收可选 `submission_id`
 * （body = `{ approved, submission_id }`）⇒ `approved:true` = 发一份赏金；`approved:false` = 零资金、
 * 该提交转 `rejected`、任务保持 `open`。新代码一律逐笔带提交号（S13 修正：缺省走遗留单笔分支，
 * 在 0042 新模型下必 409 `LEDGER_CURRENCY_INVALID_TRANSITION`）。提交号作**第 4 参**（保持调用点签名）。
 */
export const reviewSubmission = (jobId, approved, user, submissionId) =>
  postJson(`/api/job/${jobId}/review`, { approved, submission_id: submissionId }, user)
