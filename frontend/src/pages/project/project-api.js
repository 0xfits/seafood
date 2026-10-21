// ============================================================================
// 项目页（`/:slug`）· API 接线层（读口 + 三入口写口）
// ----------------------------------------------------------------------------
// 体例逐条仿 `pages/wage/wage-api.js` / `pages/campaign/campaign-api.js`：
// 只调**已冻结契约**的路径，鉴权沿用 `getAuthHeaders` / `fetchApiJson`（全站唯一出口）。
//
// 契约（真源 = backend-ts/src/campaign-service.ts，逐字）：
//   GET   /api/project/:ref            ⇒ 项目详情（:ref 三形态 = snowflake / 数字 id / slug，
//                                         原样透传；miss ⇒ 404 project_not_found）
//                                         返回项目行 + **嵌套** `campaigns[]`（→ tasks[] → subtasks[]）
//   POST  /api/campaign                ⇒ 建 campaign（manage_tasks 管理员 ∨ **project owner**）；
//                                         body 恰 `{title, project_id, description, time_start, time_end}`
//                                         （**无 status、无奖励**；status 恒 draft）
//   PATCH /api/campaign/:cid           ⇒ 改 campaign（闭集五键 + status）——【立即上线】只送 status
//   POST  /api/campaign/:cid/task      ⇒ 建 task（同上权限面；可内联 subtasks[]）
//   PATCH /api/campaign/task/:taskId   ⇒ 改 task；`subtasks[]` **整组 upsert、永不 DELETE**
//
// 写面载荷**不在此层拼**：一律由 `project-payload.js` 的纯构造器产出（键集与后端闭集对拍在单测里）。
// ============================================================================

import { fetchApiJson, getAuthHeaders } from '../../auth'

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const patchJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

const enc = (ref) => encodeURIComponent(String(ref))

/**
 * 项目详情（公开读口；`ref` 原样透传 —— snowflake / 数字 id / slug 三形态由服务端判）。
 * 防御性归一：兼容顶层行与 `{ project: {...} }` 包裹两种返回面（嵌套键仍以 `campaigns` 为准）。
 */
export const fetchProjectDetail = (ref, user) =>
  getJson(`/api/project/${enc(ref)}`, user).then((payload) => {
    const view = payload && typeof payload === 'object' && Array.isArray(payload.campaigns)
      ? payload
      : (payload?.project && typeof payload.project === 'object' ? payload.project : payload)
    return view && typeof view === 'object' ? view : null
  })

/** 公开币种表（次币符号 / 次币下拉共用；与 wage/campaign 线各自包装同一路径，不跨线 import）。 */
export const fetchProjectCurrencies = (user) => getJson('/api/currencies', user)

/**
 * 改项目（route R7 `PATCH /api/project/:projectId`；闸 = `requireAdmin('manage_tasks')` ∨ project owner，
 * ended 由服务端封板）。body 只带**变化字段**（键闭集 = title / description / slug / headcount /
 * recruit_min_account_days / wage_batt_per_claim / wage_cid + wage_currency_amount（成对）/
 * wage_interval_hours / status；owner_uid / project_id / snowflake_id 禁改）。
 * 409/400 的 `details.reason` 由调用方（`ProjectEditModal`）映射成框内内联提示。
 */
export const patchProject = (ref, body, user) => patchJson(`/api/project/${enc(ref)}`, body, user)

/** 建 campaign（R4 口扩 project owner）。`project_id` = 项目主键（归属键）。 */
export const createProjectCampaign = (body, user) => postJson('/api/campaign', body, user)

/** 上线（可选第二步）：PATCH 闭集只送 `{status:'active'}`；**该口服务端仅管理员** ⇒ 失败不改判已建草稿。 */
export const patchProjectCampaign = (campaignRef, body, user) =>
  patchJson(`/api/campaign/${enc(campaignRef)}`, body, user)

/** 建 task（R6；可内联 subtasks[] 整组创建）。 */
export const createProjectCampaignTask = (campaignRef, body, user) =>
  postJson(`/api/campaign/${enc(campaignRef)}/task`, body, user)

/**
 * 「发布子任务」= PATCH task 的 group upsert 语义（R7）：`subtasks[]` **整组**送出
 * （现有可重发行 + 新增一行；不带 subtask_id 的那条 = 插入，带 id 的 = 同值更新）。
 * 组账目（旧行 +1 的负控）在 `project-payload.buildSubtaskAppendGroup` 内断言，本层只发不算。
 */
export const appendProjectSubtasks = (taskRef, group, user) =>
  patchJson(`/api/campaign/task/${enc(taskRef)}`, { subtasks: group }, user)
