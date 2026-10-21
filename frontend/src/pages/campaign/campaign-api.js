// ============================================================================
// 活动 / 子任务（`/campaign` · `/campaign/:ref`）· 接线层
// ----------------------------------------------------------------------------
// 体例逐条仿 `pages/wage/wage-api.js` / `pages/item/item-api.js`：只调**已冻结契约**的路径，
// 鉴权沿用 `getAuthHeaders` / `fetchApiJson`（全站唯一出口，401 治理与续期都在那里）。
//
// 契约（`docs/route-layer.spec.md` §49.18 R1/R2/R3，后端已落地）：
//   GET  /api/campaign/all              ⇒ CampaignView[]（仅 active 活动；嵌套 active 任务 → 全量子任务）
//   GET  /api/campaign/<ref>            ⇒ CampaignView（`ref` = 数字主键或雪花号；miss ⇒ 404）
//   POST /api/campaign/subtask/<id>/proof
//        · 通用四类 body = `{screenshots?: string[], links?: string[], snapshot_addr?: string, answers?: object}`
//          （重提覆盖，200）
//        · prediction 类 body = `{choice: 'a'|'b'}`（一人一票；已有票 ⇒ 409）
//
// CampaignView 行键（后端 `normalizeSubtaskRow` / `normalizeTaskRow` / `normalizeCampaignRow` 逐字）：
//   campaign = { campaign_id, snowflake_id, title, description, status, time_start, time_end, tasks[] }
//   task     = { task_id, snowflake_id, campaign_id, title, description, status, time_start, time_end,
//                sort, reward_amount_primary, reward_cid_secondary, reward_amount_secondary, subtasks[] }
//   subtask  = { subtask_id, snowflake_id, task_id, type_code, type_label, title, content, payload,
//                sort, required, prediction_state, time_created, time_updated }
//
// ★ 读口**不含**「我的提交」：详情行没有 per-viewer 的 proof 字段（`subtask_proof` 只能写、无公开读口）
//   ⇒ 页面侧「已提交 / 已投票」状态以本机回执（`proof-store.js`）为准，提交成功后即时置位。
//   这是本单的已知边界（跨设备不同步），已在交付报告里点名，未用自算或猜测补齐。
// ============================================================================
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { uploadMedia } from '../item/item-api'

const getJson = (url, user) => fetchApiJson(url, { headers: getAuthHeaders(user) })

const postJson = (url, body, user) =>
  fetchApiJson(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })

/** 活动列表（公开；仅 `active` 状态，行内已嵌套任务与子任务）。 */
export const fetchCampaignList = (user) => getJson('/api/campaign/all', user)

/** 活动详情（公开；`ref` = 数字主键或雪花号，原样透传 —— 取值形态由服务端判）。 */
export const fetchCampaignDetail = (ref, user) =>
  getJson(`/api/campaign/${encodeURIComponent(String(ref))}`, user)

/**
 * 任务详情（公开读口 `GET /api/campaign/task/:taskId`，30s 缓存）。
 * 行 = `{task_id,title,description,status,time_start,time_end,reward_*,joined_count,
 *        campaign{id,title,status},project{id,title,slug,avatar_url,status},subtasks[]}`。
 * 可见性由服务端判：`draft` 对匿名 / 非 owner 一律 `404`（owner / admin 可见）⇒ 页面据 404 落提示页。
 */
export const fetchCampaignTask = (taskId, user) =>
  getJson(`/api/campaign/task/${encodeURIComponent(String(taskId))}`, user)

/**
 * 提交子任务凭证。
 * · 通用四类：载荷闭集四键，`required` 的「至少一键」由服务端判（前端只做非空提示）；
 * · prediction：`{choice:'a'|'b'}`，一人一票（重复提交 ⇒ 409）。
 */
export const submitSubtaskProof = (subtaskId, payload, user) =>
  postJson(`/api/campaign/subtask/${encodeURIComponent(String(subtaskId))}/proof`, payload, user)

/** 截图上传 = 复用既有媒体口（`POST /api/media`，仅 jpeg/png/webp、≤1MiB）。 */
export const uploadProofImage = uploadMedia

/**
 * 公开币种表（`GET /api/currencies` ⇒ `[{cid, symbol, name}]`，仅上市中）。
 * 只用于把任务完成奖里的次币 `reward_cid_secondary` 显示成符号 —— 各页面线**各自包装**同一个
 * 公开读口（同 wage-api 体例），不跨页 import 别人的 api 模块。
 */
export const fetchCampaignCurrencies = (user) => getJson('/api/currencies', user)

