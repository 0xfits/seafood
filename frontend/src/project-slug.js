// ============================================================================
// 项目地址 slug（Kevin 2026-10-21）· 常量 + 纯函数校验（两处表单 + 卡链接共用）
// ----------------------------------------------------------------------------
// 契约（后端 0068 并行单）：`project.slug` = 用户可填的项目地址名，小写字母数字连字符
// 1–32 字符、唯一；保留字拒绝 ⇒ 400 `SLUG_INVALID / SLUG_TAKEN`（借码体例）。
// 页面规范形 = `/<slug>`（如 `/sui`）；seed 10 项目 slug = ethereum / solana / arbitrum /
// base / optimism / polygon / sui / aptos / starknet / zksync。
//
// 本模块只做**客户端前置校验**与链接构造，判定权仍在服务端：
//   · `slugFieldErrorOf` ⇒ null | 'format' | 'reserved'（表单实时校验的单一真源）；
//   · `projectHrefOf` ⇒ 行有 slug ⇒ `/​<slug>`；历史行无 slug ⇒ null（调用方保持原样不変链接）。
// ============================================================================

/** 格式谓词（逐字对齐契约：小写字母 / 数字 / 连字符，长度 1–32）。 */
export const PROJECT_SLUG_RE = /^[a-z0-9-]{1,32}$/

/**
 * 保留段清单（**与 App.jsx 现取同表**，后端 `PROJECT_SLUG_RESERVED` 逐字一致）：
 *   A · 路由面静态一级段（`App.jsx` 现取，含 `/dashboard/*` 子路由一级段）——
 *       arbitration-review / audit-console / campaign / currency-review / dashboard / exchange /
 *       fee-rate / item / listing-review / login / messages / permissions / points / profile /
 *       register / rewards / settings / shard / shards / site-text / task / tasks / theme-preview /
 *       users / wage / weight-matrix（`${lang}` 与 `:slug` 是动态段，不在此列）；
 *   B · 未注册但语义保留（复数/别名/历史与预留面，防静默不可达）——
 *       admin / api / assets / campaigns / items / jobs / market / order / orders / project / projects。
 * 命中 ⇒ `/:slug` 项目页**不渲染**，落 catch-all 404 提示页（不发请求）。
 * 判据：一级段若已有显式路由（静态段排名优先于 `:slug`），该 slug 的项目页**永远打不开** ⇒ 必须保留。
 * 对齐门：`ops/project/p68-00-slug-campaign-gate.ts` A10（前后端两表 + App.jsx 现取三方对拍）。
 */
export const RESERVED_PROJECT_SEGMENTS = [
  'admin', 'api', 'arbitration-review', 'assets', 'audit-console',
  'campaign', 'campaigns', 'currency-review', 'dashboard', 'exchange',
  'fee-rate', 'item', 'items', 'jobs', 'listing-review',
  'login', 'market', 'messages', 'order', 'orders',
  'permissions', 'points', 'profile', 'project', 'projects',
  'register', 'rewards', 'settings', 'shard', 'shards',
  'site-text', 'task', 'tasks', 'theme-preview', 'users',
  'wage', 'weight-matrix',
]

const RESERVED_SET = new Set(RESERVED_PROJECT_SEGMENTS)

/** 是否保留段（App.jsx / ProjectPage 双处判别的单一真源）。 */
export const isReservedProjectSlug = (slug) => RESERVED_SET.has(String(slug || '').trim())

/**
 * 表单实时校验（编辑表单 + 建项目表单共用）：
 *   · 空 ⇒ null（「未填」不算格式错；清空是否允许由调用方按场景判）；
 *   · 保留字 ⇒ 'reserved'；格式非法 ⇒ 'format'。
 */
export const slugFieldErrorOf = (raw) => {
  const slug = String(raw ?? '').trim()
  if (!slug) return null
  if (RESERVED_SET.has(slug)) return 'reserved'
  if (!PROJECT_SLUG_RE.test(slug)) return 'format'
  return null
}

/**
 * 行 → 站内项目页路径（`/<slug>`，交 `buildLocalizedPath` 补语言前缀）。
 * slug 缺失 / 非字符串（历史行）⇒ null ⇒ 调用方保持原渲染（不変链接）。
 */
export const projectHrefOf = (row) => {
  const slug = row?.slug
  if (typeof slug !== 'string') return null
  const trimmed = slug.trim()
  if (!trimmed || !PROJECT_SLUG_RE.test(trimmed)) return null
  return `/${trimmed}`
}
