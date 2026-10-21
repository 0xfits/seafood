// ============================================================================
// 领工资（/wage）· API 接线层
// ----------------------------------------------------------------------------
// 体例逐条仿 `trades-api.js` / `pages/item/item-api.js`：只调**已冻结契约**的路径，
// 鉴权沿用 `getAuthHeaders` / `fetchApiJson`（全站唯一出口，401 治理与续期都在那里）。
//
// 契约（后端并行单实现中，形状冻结如下；未就绪期间前端以单测/探针替身推进）：
//   GET  /api/project/all            ⇒ 数组，行含 project_id、snowflake_id、title、description、
//                                        headcount、hired_count、wage_batt_per_claim、wage_cid、
//                                        wage_currency_amount、wage_interval_hours、status、
//                                        my_role（'none' | 'hired'）
//   POST /api/project/<id>/apply      ⇒ 加入正在招工的项目（同时只能在一个项目打工）
//   POST /api/project/<id>/claim      ⇒ 领工资（间隔未到 / 未录用 ⇒ 400，reason 在 details）
//   GET  /api/currencies             ⇒ 公开只读币种表（cid/symbol/name），仅用于把 wage_cid 显示成符号
//
// 写面幂等性由服务端的领取间隔与「一个人只在一个项目」约束天然保证，前端不自造 create_key。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from '../../auth'

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

/** 招工项目列表（招募中 / 已截止都在内；`my_role` 指示本人是否已入职该项目）。 */
export const fetchWageProjects = (user) => getJson('/api/project/all', user)

/** 公开币种表（未登录也可取）⇒ 把 `wage_cid` 映射成 `$` / `BTTC` 这类符号。 */
export const fetchWageCurrencies = () => getJson('/api/currencies')

/** 加入项目（幂等：已在职同一项目 ⇒ 服务端按已加入处理）。 */
export const applyToWageProject = (projectId, user) =>
  postJson(`/api/project/${encodeURIComponent(String(projectId))}/apply`, {}, user)

/** 领工资（服务端按 `wage_interval_hours` 判间隔；未到点 / 未录用 ⇒ 400 + details.reason）。 */
export const claimWage = (projectId, user) =>
  postJson(`/api/project/${encodeURIComponent(String(projectId))}/claim`, {}, user)

// ★ Kevin 2026-10-21②：本页不再有写口。项目编辑（`PATCH /api/project/:projectId`，route R7，
//   闸 = `requireAdmin('manage_tasks')` ∨ project owner）随【编辑】一起搬到项目页 —— 写口真源 =
//   `pages/project/project-api.js` 的 `patchProject`（本文件原 `patchWageProject` 已删，零引用）。
