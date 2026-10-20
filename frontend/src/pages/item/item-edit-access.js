// ============================================================================
// 商品「管理员代编」能力判定（前端唯一真源 · 后端口径 0059）
// ----------------------------------------------------------------------------
// 授权口径（与后端 `listing-service.isListingEditAdminAccess` 同式 ·
//   route §49.15 / design §26.16）：
//     can_access_admin ∧ (is_admin ∨ permissions ∋ 'manage_rewards')
//   ⇒ 该 actor 可**编辑他人**商品（读口 `GET /api/listing/:id/edit` 200、写口 PATCH 放行）。
//
// 判据来源 = `GET /api/user` 载荷的**加性** `admin` 子对象
//   `{ can_access_admin, is_admin, permissions }`（`backend-ts/src/index.ts: buildUserPayload`）。
//   ★ 刻意**不用** `admin-utils.fetchAdminAccess`（走 `/api/admin/me`）——那也是同义的第三套判据，
//     而本能力与商品读/写口共用同一份「三键」载荷 ⇒ 用同一口径可避免两套权限面分叉。
//
// 为什么需要补一次 `/api/user`：
//   登录链路 `POST /api/auth/verify` 的载荷**不含** `admin` 三键（只在 `/api/user` 里）⇒
//   刚登录时 `user.admin` 通常是 undefined，必须按需补一次。取回后按 uID 缓存在模块内
//   ⇒ 同一页面生命周期内**零重复请求**；换号（uID 变）即重取。
//
// 失败面（fail-safe，绝不猜补）：取不到 / 形状不对 ⇒ 返回 `null` ⇒ 调用方**不显示**编辑入口、
//   不显示「管理员编辑」提示条。宁可少显示入口（本人/管理员仍可从「我的发布」进入），
//   也不把普通用户误判成管理员。
// ============================================================================
import { fetchCurrentUser } from '../../auth'

/** 三键 ⇒ 布尔（形状不合法一律按 false；`permissions` 非数组 ⇒ 视为空）。 */
export const isListingEditAdmin = (admin) => {
  if (!admin || typeof admin !== 'object') return false
  if (admin.can_access_admin !== true) return false
  if (admin.is_admin === true) return true
  const permissions = Array.isArray(admin.permissions) ? admin.permissions : []
  return permissions.includes('manage_rewards')
}

/** 模块内缓存（按 uID；`value === null` 表示「已确认无管理员能力」，不是「未取过」）。 */
let cache = { uid: null, value: null }
let inflight = { uid: null, promise: null }

const normalizeAdmin = (admin) => ({
  can_access_admin: admin?.can_access_admin === true,
  is_admin: admin?.is_admin === true,
  permissions: Array.isArray(admin?.permissions) ? admin.permissions.map((p) => String(p)) : [],
})

/**
 * 取当前登录用户的「三键」（按 uID 缓存）。
 * @returns {Promise<{can_access_admin:boolean,is_admin:boolean,permissions:string[]}|null>}
 *   `null` = 未登录 / 取数失败（调用方据此不做管理员特判）。
 */
export const loadListingEditAdmin = async (user) => {
  const rawUid = user?.uID ?? user?.uid ?? null
  if (rawUid === null || rawUid === undefined || rawUid === '') return null
  const uid = String(rawUid)

  // ① 存储里的会话已带 `admin`（例如本页之前已补取过并合并）⇒ 直接用，零请求。
  if (user?.admin && typeof user.admin === 'object') {
    const flags = normalizeAdmin(user.admin)
    cache = { uid, value: flags }
    return flags
  }

  // ② 命中缓存 ⇒ 零请求。
  if (cache.uid === uid) return cache.value

  // ③ 同号并发挂载 ⇒ 共用同一条请求（避免每次挂载各发一条）。
  if (inflight.uid === uid && inflight.promise) return inflight.promise

  const promise = fetchCurrentUser(user)
    .then((payload) => {
      const flags = normalizeAdmin(payload?.admin)
      cache = { uid, value: flags }
      return flags
    })
    .catch(() => null)
    .finally(() => {
      if (inflight.uid === uid) inflight = { uid: null, promise: null }
    })

  inflight = { uid, promise }
  return promise
}

/** 测试 / 登出后复位（模块级缓存不得跨账号泄漏）。 */
export const resetListingEditAdminCache = () => {
  cache = { uid: null, value: null }
  inflight = { uid: null, promise: null }
}
