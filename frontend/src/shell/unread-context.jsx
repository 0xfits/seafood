import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth-context'
import { fetchUnreadCount } from '../messages-api'

// ============================================================================
// 未读角标共享态（design-system.spec v1.17 §20.6 · T103）
// ----------------------------------------------------------------------------
// 判据（写死）：底栏第 4 格（messages）与桌面悬浮菜单「消息」项 **同源消费 = 两挂点同值**；
//   唯一真源 = `GET /api/messages/unread-count` 的 `unread_total`。
// 取数时点（**仅此三处，无轮询 / 无 WebSocket / 无定时器**）：
//   ① 外壳挂载（登录态）—— 本文件的 mount effect；
//   ② 发送成功后 —— 由 `MessagesPage` 调 `refresh()`；
//   ③ 进入 `/messages` 后（读水位回执）—— 由 `MessagesPage` 调 `refresh()`。
// 无 provider 时（组件被单测单独渲染 / 非外壳上下文）⇒ 返回零值 + 空刷新，**零请求**。
// ============================================================================
const NOOP = () => {}
const ZERO_STATE = { total: 0, refresh: NOOP }

const UnreadContext = createContext(null)

/** 角标文案上限（§20.2 T103：`>99` ⇒ `99+`）。 */
export const UNREAD_BADGE_CAP = 99

/** 角标显示值（`0` ⇒ `''` 表示不渲染；`>99` ⇒ `99+`）。纯函数、可单测。 */
export const unreadBadgeText = (total) => {
  const value = Number(total)
  if (!Number.isFinite(value) || value <= 0) return ''
  return value > UNREAD_BADGE_CAP ? '99+' : String(Math.floor(value))
}

export const UnreadProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [total, setTotal] = useState(0)

  // 登录面取数（未登录 ⇒ **零请求**，直接归零；AC-3 反事实判据）。
  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setTotal(0)
      return 0
    }
    try {
      const data = await fetchUnreadCount(user)
      const value = Number(data?.unread_total)
      const next = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
      setTotal(next)
      return next
    } catch (error) {
      // 无轮询口径：失败**保持现值**（不回滚、不重试、不弹错）—— 角标是纯展示面。
      return null
    }
  }, [isAuthenticated, user])

  // 取数时点 ①：外壳挂载（登录态）。
  useEffect(() => { refresh() }, [refresh])

  const value = useMemo(() => ({ total, refresh }), [total, refresh])
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
}

/** 消费共享未读态；无 provider ⇒ 安全零值（不抛错、不启动请求）。 */
export const useUnreadCount = () => useContext(UnreadContext) || ZERO_STATE
