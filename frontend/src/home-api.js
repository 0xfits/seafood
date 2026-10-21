// ============================================================================
// 首页「热门任务」读口接线层（campaign 体系 · 2026-10-21 派单）
// ----------------------------------------------------------------------------
// 体例逐条仿 `balances-api.js` / `pages/campaign/campaign-api.js`：只调契约路径，
// 鉴权沿用 `getAuthHeaders` / `fetchApiJson`（全站唯一出口，401 治理与续期都在那里）。
//
// 契约（后端并行单；**未提交前探针/单测以 mock 自给**，行键以后端落地为准）：
//   GET /api/home/campaign-tasks（公开）⇒ data: rows[]
//   row = { task_id, campaign_id, title, status, joined_count,
//           reward_amount_primary, reward_amount_secondary?, reward_cid_secondary?,
//           campaign_title, project_title, project_slug?, project_avatar_url? }
//   · `campaign_id` 是点击路由 `/campaign/:campaignId` 的必要段（比派单字段清单多出的一项，
//     少它首页卡无处可链 —— 已在后端并行单口径中注明）；
//   · `joined_target`（可选加性）：在场 ⇒ 进度「已参与 X / 共 Y」；缺席 ⇒ 只显「已参与 X」。
// ============================================================================

import { fetchApiJson, getAuthHeaders } from './auth'

export const HOME_CAMPAIGN_TASKS_ENDPOINT = '/api/home/campaign-tasks'

/** 首页热门任务（campaign 体系；公开读口，登录态只影响 401 治理不影响行集）。 */
export const fetchHomeCampaignTasks = (user) =>
  fetchApiJson(HOME_CAMPAIGN_TASKS_ENDPOINT, { headers: getAuthHeaders(user) })

/**
 * 公开币种表（`GET /api/currencies` ⇒ `[{cid, symbol, name}]`）—— 只用于把次币
 * `reward_cid_secondary` 显示成符号。各页面线**各自包装**同一个公开读口（同
 * campaign-api 体例，不跨页 import 别人的 api 模块）；失败由调用方降级（次币行整行不渲染）。
 */
export const fetchHomeCurrencies = (user) =>
  fetchApiJson('/api/currencies', { headers: getAuthHeaders(user) })
