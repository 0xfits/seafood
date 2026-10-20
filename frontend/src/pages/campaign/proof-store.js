// ============================================================================
// 活动子任务的**本机回执**（`/campaign/:ref` 的降级状态载体）
// ----------------------------------------------------------------------------
// 真源 = 服务端读口（登录态下 `GET /api/campaign/:ref` 每个 subtask 带 `my_proof`：
//   `null` 或 `{payload, time_created}`）⇒ 页面**一律以服务端字段为准**。
// 本模块只在**服务端未带该字段**（旧读口 / 未登录）时兜底：提交成功后写一条本机回执，
// 重进页面据它显示「已提交 / 已投票」。
//
// 口径与边界（如实登记，别拿它当服务端事实）：
//   · 键空间按用户隔离（`sf:campaign:proofs:<uid>`）⇒ 换号不串台；未登录不写（未登录也提交不了）。
//   · 回执只是**显示用缓存**：真正的闸在服务端（一人一提交 / 一人一票 / 截止后拒收），
//     重复提交由服务端 409 兜底 ⇒ 本模块不做任何「能不能提交」的判定。
//   · 存储形状与服务端 `my_proof` 同构：`{payload, time_created}`（这样两路读数在页面侧同形）；
//     旧形状（直接存 payload 对象）读取时就地归一，不清库不迁移。
//   · 跨设备 / 清缓存不同步 —— 已知边界，要真同步得靠服务端读口（已落地 `my_proof`）。
// ============================================================================

const storageKey = (uid) => `sf:campaign:proofs:${uid == null || uid === '' ? 'guest' : String(uid)}`

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const safeParse = (raw) => {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return isObject(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

/** 单条回执归一成服务端同构 `{payload, time_created}`；非对象 ⇒ `null`。 */
const normalizeReceipt = (value) => {
  if (!isObject(value)) return null
  if (isObject(value.payload)) {
    return {
      payload: value.payload,
      time_created: typeof value.time_created === 'string' ? value.time_created : null,
    }
  }
  // 旧形状（step 1 之前的裸 payload）⇒ 就地归一，避免历史回执读成「已提交但无内容」。
  return { payload: value, time_created: null }
}

/** 当前用户在本机的全部回执：`{ [subtaskId]: {payload, time_created} }`。读不到 ⇒ 空表。 */
export const readProofs = (uid) => {
  try {
    const all = safeParse(window.localStorage.getItem(storageKey(uid)))
    const out = {}
    for (const [key, value] of Object.entries(all)) {
      const receipt = normalizeReceipt(value)
      if (receipt) out[key] = receipt
    }
    return out
  } catch (error) {
    return {}
  }
}

/** 单条回执（无 ⇒ `null`）。 */
export const readProof = (uid, subtaskId) => {
  const all = readProofs(uid)
  const key = String(subtaskId ?? '')
  return key && all[key] ? all[key] : null
}

/** 写一条回执（覆盖同键 —— 通用四类的重提本就是覆盖语义；prediction 由服务端拒绝二次投票）。 */
export const writeProof = (uid, subtaskId, payload) => {
  const key = String(subtaskId ?? '')
  if (!key || !isObject(payload)) return
  try {
    const all = readProofs(uid)
    all[key] = {
      payload,
      time_created: new Date().toISOString(),
    }
    window.localStorage.setItem(storageKey(uid), JSON.stringify(all))
  } catch (error) {
    // 存储不可用（隐私模式 / 配额满）⇒ 只影响「刷新后仍显示已提交」，不影响本次提交本身。
  }
}
