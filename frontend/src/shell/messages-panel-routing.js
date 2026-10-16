import { stripLangPrefix } from '../utils'

// ============================================================================
// 消息面板化 · 打开判据 + 就地叠加参数（design-system.spec v1.19 §21.2 `T105` /
// route-layer.spec v2.34 §44.3 · Kevin 2026-10-16 逐字「方案 1 · 就地叠加」）
// ----------------------------------------------------------------------------
// `T105` 判据（**唯一开面板谓词** · 单一真源，`stripLangPrefix` 之上）：
//   开面板 ⟺ stripLangPrefix(pathname) === '/messages' ∨ msg === '1' ∨ c 非空
//   （`c` 非空 = **会话直链子句**，保入口③「聊一聊」与「原地形态」自洽；
//    口径外延项 · 姊妹册 route v2.34 §44.3(1) 逐字同款）
// ★ 严禁任何宽度类判定（`shell/**` 的 JS 硬断言**按明文全文扫描、注释同禁** —— 明文词表见
//   `theme-shell-isomorphism.test.jsx:207-215`）⇒ 本文件只做**路由串 + 查询串**匹配，零视口读数。
// 形态（承 Kevin ①–⑥）：
//   · 打开 = 给**当前路由**加 `?msg=1`（可带 `&c=<conversation_id>`）—— `pathname` 逐字不变、只变 `search`
//     （宿主组件不重挂、滚动位置保留）；
//   · 关闭 = 移除 `msg` / `c`（`replace` 保当前页）+ 面板内左上「×」；浏览器后退键天然关面板；
//   · `/messages` 直链落点 = 首页 + 面板（同一面板，底 = 首页）。
// ============================================================================

/** 读取查询串（非法 / 缺省 ⇒ 空参数集，绝不抛错）。 */
export const panelSearchParams = (search) => new URLSearchParams(String(search || ''))

/** `T105` 唯一判据（纯函数）：入参 = `{ pathname, search }`（react-router `useLocation()` 形状）。 */
export const isMessagesPanelOpen = (location) => {
  const pathname = (location && location.pathname) || '/'
  if (stripLangPrefix(pathname) === '/messages') return true
  const params = panelSearchParams(location && location.search)
  if (params.get('msg') === '1') return true
  return Boolean(params.get('c'))
}

/**
 * 就地叠加：**当前路径** + 原查询串（剔除 `msg` / `c`）+ `msg=1`（可选 `&c=<id>`）。
 * `pathname` 逐字保留 ⇒ 不换页（宿主页面不重挂）。
 */
export const withPanelParams = (location, conversationId = null) => {
  const pathname = (location && location.pathname) || '/'
  const params = panelSearchParams(location && location.search)
  params.delete('msg')
  params.delete('c')
  params.set('msg', '1')
  const id = conversationId == null ? '' : String(conversationId)
  if (id) params.set('c', id)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

/** 关闭面板（移除 `msg` / `c`，保留其余参数）⇒ 当前页新 URL（调用侧用 `replace`）。 */
export const withoutPanelParams = (location) => {
  const pathname = (location && location.pathname) || '/'
  const params = panelSearchParams(location && location.search)
  params.delete('msg')
  params.delete('c')
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

/**
 * 「×」关闭落点（`T105` 关闭 + 本单口径外延）。
 * ★ 口径外延：`/messages` 直链态下 `pathname` 仍命中 `T105` ⇒ 仅移除参数会**死锁**（面板关不掉）
 *   ⇒ 该态下回 `homePath`（= `buildLocalizedPath(lang, '/')`，回首页）。
 */
export const panelCloseTarget = (location, homePath = '/') => {
  const pathname = (location && location.pathname) || '/'
  if (stripLangPrefix(pathname) === '/messages') return homePath
  return withoutPanelParams(location)
}
