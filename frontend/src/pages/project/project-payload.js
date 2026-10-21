// ============================================================================
// 项目页「三入口」写面载荷构造 + 校验（**纯函数**，零 React / 零 fetch）
// ----------------------------------------------------------------------------
// 真源 = `backend-ts/src/campaign-service.ts`（闭集逐字，不得自创键）：
//   POST  /api/campaign                { title, project_id, description, time_start, time_end }
//                                      **无 status、无奖励**（status 恒 draft，走 PATCH 上线）
//   PATCH /api/campaign/:campaignId    { title, description, time_start, time_end, status }
//   POST  /api/campaign/:cid/task      { title, description, time_start, time_end, sort,
//                                        reward_amount_primary, reward_cid_secondary?,
//                                        reward_amount_secondary?, subtasks[] }
//   PATCH /api/campaign/task/:taskId   同 task 键集 + status；subtasks[] **整组 upsert、永不 DELETE**
//   subtask（两处内联）               { type_code, title, content, payload, sort, required }
//
// 硬口径：
//   · 次币两键**成对才发**（同空同非空；cid ≠ 1 即不得拿 $ 当初币，CP-R2/CP-N8）；
//   · `prediction` 子任务 payload **恰四键** { option_a, option_b, prize_amount, deadline }（CP-P1）；
//     其余四类 payload 可为 `{}`（键族越界 ⇒ 后端 400，本层一律不发垃圾键）；
//   · 「发布子任务」= 先读现有 subtasks、再**整组追加**（本层只做形状与追加账目；读口在调用方）：
//     负控 = 送出组长度必须恰为「可重发旧行数 + 1」，且「可重发 + 显式跳过 = 旧行总数」——
//     任一行静默丢失即拒发（不拿「后端永不 DELETE」当免责）。
// ============================================================================

/** 子任务类型闭集（五类，逐字对齐 SUBTASK_TYPES seed）。 */
export const SUBTASK_TYPE_CODES = ['x_verify', 'onchain_snapshot', 'survey', 'prediction', 'quiz']

/** 非 prediction 四类的合法 payload 键族（CP-8）；本层只做「原样回送」白名单。 */
const PROOF_KEYS_BY_TYPE = {
  x_verify: ['screenshots', 'links'],
  onchain_snapshot: ['snapshot_addr'],
  survey: ['answers'],
  quiz: ['answers'],
}

const PREDICTION_KEYS = ['option_a', 'option_b', 'prize_amount', 'deadline']
/** prediction 结算回填键：服务端 settle 口独占写 ⇒ 旧行一旦带它就不能被整组重发（见下）。 */
const PREDICTION_CORRECT_KEY = 'correct_option'

const text = (value) => (value === null || value === undefined ? '' : String(value))
const trimmed = (value) => text(value).trim()

/** 正整数文本（后端 `asPositiveIntText` 同口径）；非法 ⇒ null。 */
export const positiveIntText = (value) => {
  const raw = trimmed(value)
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? raw : null
}

/** 非负整数（sort）；非法 ⇒ null。 */
export const nonNegInt = (value) => {
  const raw = trimmed(value)
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) && n <= 2 ** 31 - 1 ? n : null
}

/**
 * 时间入参归一：空 ⇒ null；可解析 ⇒ ISO 串；不可解析 ⇒ 'invalid'（调用方据此报错，不静默丢）。
 * 接受 `datetime-local` 的 `YYYY-MM-DDTHH:mm` / 完整 ISO / 毫秒数（探针夹具用）。
 */
export const toIsoOrNull = (value) => {
  if (value === null || value === undefined) return null
  const raw = trimmed(value)
  if (!raw) return null
  const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw)
  if (!Number.isFinite(ms)) return 'invalid'
  try {
    return new Date(ms).toISOString()
  } catch (error) {
    return 'invalid'
  }
}

/** 时间窗：两端都在 ⇒ end 必须晚于 start（后端 `windowOk` 同判）。 */
export const windowOk = (startIso, endIso) => {
  if (!startIso || !endIso) return true
  return Date.parse(endIso) > Date.parse(startIso)
}

/**
 * 【发布 campaign】载荷 —— 恰五键、顺序同后端闭集：`{title, project_id, description, time_start, time_end}`。
 * `projectId` = 当前项目主键（`view.project_id`，缺失回落雪花号）。
 */
export const buildCampaignPayload = (draft, projectId) => {
  const title = trimmed(draft?.title)
  if (!title || title.length > 200) return { ok: false, error: 'title' }
  const pid = positiveIntText(projectId)
  if (!pid) return { ok: false, error: 'project' }
  const description = text(draft?.description)
  if (description.length > 20000) return { ok: false, error: 'description' }
  const start = toIsoOrNull(draft?.timeStart)
  const end = toIsoOrNull(draft?.timeEnd)
  if (start === 'invalid' || end === 'invalid') return { ok: false, error: 'time' }
  if (!windowOk(start, end)) return { ok: false, error: 'time' }
  return {
    ok: true,
    payload: {
      title,
      project_id: pid,
      description,
      time_start: start,
      time_end: end,
    },
  }
}

/** 【上线】载荷 —— 后端 PATCH 闭集里只取 status（其余键缺省 ⇒ 库内现值不动）。 */
export const buildLaunchPayload = () => ({ status: 'active' })

/** prediction payload（恰四键）；缺项 / 越界 ⇒ null。 */
const predictionPayloadOf = (row) => {
  const optionA = trimmed(row?.optionA)
  const optionB = trimmed(row?.optionB)
  if (!optionA || !optionB) return null
  const prize = positiveIntText(row?.prize)
  if (!prize) return null
  const deadline = toIsoOrNull(row?.deadline)
  if (!deadline || deadline === 'invalid') return null
  return { option_a: optionA, option_b: optionB, prize_amount: prize, deadline }
}

/**
 * 子任务输入（行编辑器 → 后端 `SubtaskInput`）：恰六键
 * `{type_code, title, content, payload, sort, required}`（顺序同后端 legal 清单）。
 * 空行（type/title/content 全空）⇒ `{ok:true, skip:true}`，由调用方过滤（不送空壳）。
 */
export const buildSubtaskInput = (row) => {
  const typeCode = trimmed(row?.typeCode)
  const title = trimmed(row?.title)
  const content = text(row?.content)
  const blank = !title && !content.trim()
  if (blank) return { ok: true, skip: true }
  if (!SUBTASK_TYPE_CODES.includes(typeCode)) return { ok: false, error: 'type' }
  if (!title || title.length > 200) return { ok: false, error: 'title' }
  if (content.length > 20000) return { ok: false, error: 'content' }
  const sort = nonNegInt(row?.sort)
  if (sort === null) return { ok: false, error: 'sort' }
  let payload = {}
  if (typeCode === 'prediction') {
    payload = predictionPayloadOf(row)
    if (!payload) return { ok: false, error: 'prediction' }
  }
  return {
    ok: true,
    input: {
      type_code: typeCode,
      title,
      content: content ? content : null,
      payload,
      sort,
      required: row?.required === true,
    },
  }
}

/**
 * 读口旧行 → 可重发 `SubtaskInput`（**整组追加**用）。返回 null ⇒ 该行**不可重发**（显式跳过）：
 *   · 无数字主键（无法定位 ⇒ 重发会变成插入，等于重复旧行）；
 *   · 类型不在五类闭集 / 标题非法 / sort 非法；
 *   · payload 含键族之外的键（重发会把这些键**抹掉** ⇒ 宁可整行不动）；
 *   · prediction 已结算（payload 带 `correct_option`，settle 口独占写、PATCH 会拒收该键）。
 * 注：后端「永不 DELETE」⇒ 跳过的行**保持库内原值**，这里只是不发它，不是丢数据。
 */
export const toExistingSubtaskInput = (row) => {
  const ref = positiveIntText(row?.subtask_id)
  if (!ref) return null
  const typeCode = trimmed(row?.type_code)
  if (!SUBTASK_TYPE_CODES.includes(typeCode)) return null
  const title = trimmed(row?.title)
  if (!title || title.length > 200) return null
  const content = text(row?.content)
  if (content.length > 20000) return null
  const sort = nonNegInt(row?.sort ?? 0)
  if (sort === null) return null
  const raw = row?.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {}

  let payload = {}
  if (typeCode === 'prediction') {
    if (Object.prototype.hasOwnProperty.call(raw, PREDICTION_CORRECT_KEY)) return null
    const keys = Object.keys(raw)
    if (keys.length !== PREDICTION_KEYS.length || keys.some((k) => !PREDICTION_KEYS.includes(k))) return null
    payload = predictionPayloadOf({
      optionA: raw.option_a,
      optionB: raw.option_b,
      prize: raw.prize_amount,
      deadline: raw.deadline,
    })
    if (!payload) return null
  } else {
    const allowed = PROOF_KEYS_BY_TYPE[typeCode]
    if (Object.keys(raw).some((k) => !allowed.includes(k))) return null
    for (const key of Object.keys(raw)) {
      const value = raw[key]
      if (Array.isArray(value)) {
        if (!value.every((v) => typeof v === 'string' && v.trim())) return null
      } else if (key === 'answers') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      } else if (typeof value !== 'string' || !value.trim() || value.length > 200) {
        return null
      }
      payload[key] = value
    }
  }

  return {
    subtask_id: ref,
    type_code: typeCode,
    title,
    content: content ? content : null,
    payload,
    sort,
    required: row?.required === true,
  }
}

/**
 * 【发布子任务】整组追加账目（**负控在此**）：
 *   `group = 可重发旧行 + 新行`，且断言
 *     ① `group.length === resent + 1`（恰好多一条，绝不多送/少送）；
 *     ② `resent + skipped === existing.length`（旧行逐条有归属：重发或显式跳过，不许静默消失）。
 * 任一不成立 ⇒ `{ok:false,error:'assert'}`，调用方**不得**发 PATCH。
 */
export const buildSubtaskAppendGroup = (existingRows, newInput) => {
  if (!newInput || typeof newInput !== 'object') return { ok: false, error: 'subtask' }
  const existing = Array.isArray(existingRows) ? existingRows : []
  const resent = []
  const skipped = []
  for (const row of existing) {
    const mapped = toExistingSubtaskInput(row)
    if (mapped) resent.push(mapped)
    else skipped.push(text(row?.subtask_id))
  }
  const group = [...resent, newInput]
  if (group.length !== resent.length + 1) return { ok: false, error: 'assert' }
  if (resent.length + skipped.length !== existing.length) return { ok: false, error: 'assert' }
  return { ok: true, group, resent: resent.length, skipped }
}

/**
 * 【发布任务】载荷：恰 `title, description, time_start, time_end, sort, reward_amount_primary`
 * ＋（次币成对时）`reward_cid_secondary, reward_amount_secondary` ＋ `subtasks[]`。
 * 次币「同空同非空」；cid = 1（$）⇒ 拒发；奖励主键必须是正整数 $。
 */
export const buildTaskPayload = (draft) => {
  const title = trimmed(draft?.title)
  if (!title || title.length > 200) return { ok: false, error: 'title' }
  const description = text(draft?.description)
  if (description.length > 20000) return { ok: false, error: 'description' }
  const start = toIsoOrNull(draft?.timeStart)
  const end = toIsoOrNull(draft?.timeEnd)
  if (start === 'invalid' || end === 'invalid') return { ok: false, error: 'time' }
  if (!windowOk(start, end)) return { ok: false, error: 'time' }
  const sort = nonNegInt(draft?.sort ?? 0)
  if (sort === null) return { ok: false, error: 'sort' }
  const primary = positiveIntText(draft?.rewardPrimary)
  if (!primary) return { ok: false, error: 'reward' }

  const cidRaw = trimmed(draft?.rewardCid)
  const amountRaw = trimmed(draft?.rewardAmount)
  const hasPair = Boolean(cidRaw) || Boolean(amountRaw)
  if (hasPair) {
    if (!cidRaw || !amountRaw) return { ok: false, error: 'rewardPair' }
    const cid = positiveIntText(cidRaw)
    const amount = positiveIntText(amountRaw)
    if (!cid || cid === '1' || !amount) return { ok: false, error: 'rewardPair' }
  }

  const subtasks = []
  for (const row of Array.isArray(draft?.subtasks) ? draft.subtasks : []) {
    const built = buildSubtaskInput(row)
    if (!built.ok) return { ok: false, error: built.error }
    if (built.skip) continue
    subtasks.push(built.input)
  }

  const payload = {
    title,
    description,
    time_start: start,
    time_end: end,
    sort,
    reward_amount_primary: primary,
  }
  if (hasPair) {
    payload.reward_cid_secondary = trimmed(draft?.rewardCid)
    payload.reward_amount_secondary = trimmed(draft?.rewardAmount)
  }
  payload.subtasks = subtasks
  return { ok: true, payload }
}

/** 载荷键集（单测逐键对拍用；顺序即后端闭集顺序）。 */
export const CAMPAIGN_KEYS = ['title', 'project_id', 'description', 'time_start', 'time_end']
export const TASK_REQUIRED_KEYS = ['title', 'description', 'time_start', 'time_end', 'sort', 'reward_amount_primary', 'subtasks']
export const SUBTASK_KEYS = ['type_code', 'title', 'content', 'payload', 'sort', 'required']
