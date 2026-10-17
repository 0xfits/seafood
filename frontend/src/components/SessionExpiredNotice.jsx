import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { SESSION_EXPIRED_EVENT, isProtectedRouteActive } from '../auth'

// ============================================================================
// 会话过期提示（S1 · 2026-10-17）
//
// 职责 = `auth.js` 的 `expireAuthSession()` 派发 `SESSION_EXPIRED_EVENT` 后，把「会话已失效」
// 这件事**对用户可见**。本组件**不**判 401、**不**清会话（那些都在 `fetchApiJson` 单点做完了），
// 只做「说一句」这一件事 —— 判据与写口保持单一真源。
//
// 两条硬口径：
//   · **受保护路由不弹**：`ProtectedRoute` 自身会出登录引导（`Navigate` 到 `/login`），
//     再叠一条 toast 就是双提示；判据 = `isProtectedRouteActive()`（由 ProtectedRoute 登记的
//     挂载计数，**不另造受保护路径清单**，避免与 `App.jsx` 的路由真源分叉）。
//   · **文案键复用既有顶层 `sessionExpired`**（四语齐备）⇒ 本单**零新增 locale 键**。
//     `id` 固定 ⇒ 即便事件因任何原因连发两次，react-hot-toast 也是替换同一条而非叠两条。
//
// 渲染 `null`：不加任何 DOM 节点（外壳同构断言的前提之一）。
// ============================================================================

const TOAST_ID = 'sf-session-expired'

const SessionExpiredNotice = () => {
  const { t } = useTranslation()

  useEffect(() => {
    const handleExpired = () => {
      if (isProtectedRouteActive()) return
      toast.error(t('sessionExpired'), { id: TOAST_ID })
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
  }, [t])

  return null
}

export default SessionExpiredNotice
