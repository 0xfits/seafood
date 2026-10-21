// ============================================================================
// 项目页（`/:slug`）· API 接线层
// ----------------------------------------------------------------------------
// 体例逐条仿 `pages/wage/wage-api.js` / `pages/campaign/campaign-api.js`：
// 只调**已冻结契约**的路径，鉴权沿用 `getAuthHeaders` / `fetchApiJson`（全站唯一出口）。
//
// 契约（后端 0068 并行单实现中，形状冻结如下；未就绪期间前端以单测/探针替身推进）：
//   GET  /api/project/:ref            ⇒ 项目详情（**:ref 三形态** = snowflake / 数字 id / slug，
//                                        取值形态由服务端判；miss ⇒ 404 `project_not_found`）。
//                                        返回项目行（title/description/status/headcount/
//                                        hired_count/owner_uid/slug/工资两笔/间隔）+
//                                        **嵌套** `campaigns[]`（活动 → tasks[] → subtasks[]，
//                                        行键与 `/api/campaign/:ref` 的 CampaignView 同族）。
//   POST /api/campaign                ⇒ 建 campaign（manage_tasks 管理员 ∨ **project owner**，
//                                        项目未 ended）；body 携带 `project_id` 归属。
//   POST /api/campaign/:cid/task      ⇒ 建 task（同上权限；归属链经 campaign 校验）；
//                                        可内联 `subtasks[]`（R6 语义）。
//   PATCH /api/campaign/task/:taskId  ⇒ 改 task；`subtasks[]` **整组 upsert、永不 DELETE**
//                                        （不带 id ⇒ 插入 —— 「发布子任务」走这条）。
//
// 写面载荷键名以本层注释为对拍基准（并行后端单对齐点）：
//   campaign  = { project_id, title, description, time_start, time_end, status,
//                 reward_amount_primary, reward_cid_secondary?, reward_amount_secondary? }
//   task      = { title, description, time_start, time_end,
//                 reward_amount_primary, reward_cid_secondary?, reward_amount_secondary?,
//                 subtasks?: SubtaskInput[] }
//   subtask   = { type_code, title, content, payload, sort, required }
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

/**
 * 项目详情（公开读口；`ref` 原样透传 —— snowflake / 数字 id / slug 三形态由服务端判）。
 * 防御性归一：兼容顶层行与 `{ project: {...} }` 包裹两种返回面（嵌套键仍以 `campaigns` 为准）。
 */
export const fetchProjectDetail = (ref, user) =>
  getJson(`/api/project/${encodeURIComponent(String(ref))}`, user).then((payload) => {
    const view = payload && typeof payload === 'object' && Array.isArray(payload.campaigns)
      ? payload
      : (payload?.project && typeof payload.project === 'object' ? payload.project : payload)
    return view && typeof view === 'object' ? view : null
  })

/** 公开币种表（次币符号映射用；与 wage/campaign 线各自包装同一路径，不跨线 import）。 */
export const fetchProjectCurrencies = (user) => getJson('/api/currencies', user)

/**
 * 建 campaign（R4 口扩 project owner）。`project_id` = 项目主键（归属键，后端 0068 对齐点）；
 * 次币两键**成对才发**（同 wage/task 两币口径：同空同非空）。
 */
export const createProjectCampaign = (body, user) => postJson('/api/campaign', body, user)

/** 建 task（R6；可内联 subtasks[] 整组创建）。 */
export const createProjectCampaignTask = (campaignRef, body, user) =>
  postJson(`/api/campaign/${encodeURIComponent(String(campaignRef))}/task`, body, user)

/**
 * 「发布子任务」= PATCH task 的 group upsert 语义（R7）：`subtasks[]` 不带 id ⇒ 插入；
 * **永不 DELETE** —— 本面只送新增的一条，绝不动既有子任务。
 */
export const addProjectSubtask = (taskRef, subtaskInput, user) =>
  patchJson(`/api/campaign/task/${encodeURIComponent(String(taskRef))}`, { subtasks: [subtaskInput] }, user)
