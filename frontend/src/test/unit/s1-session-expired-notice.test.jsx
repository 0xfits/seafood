import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

// 组件面只做「说一句」：把 `SESSION_EXPIRED_EVENT` 转成一条 `sessionExpired` toast。
// 两个依赖都 mock 掉 ⇒ 断言落在「调没调、调了什么」上，不牵扯 Toaster 的 DOM 与 i18n 初始化。
vi.mock('react-hot-toast', () => {
  const error = vi.fn()
  return { default: { error, success: vi.fn() }, error, success: vi.fn() }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'zh' } }),
}))

import toast from 'react-hot-toast'
import SessionExpiredNotice from '../../components/SessionExpiredNotice'
import { SESSION_EXPIRED_EVENT, markProtectedRouteActive } from '../../auth'

const fireExpired = () => {
  act(() => {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  })
}

describe('S1 · SessionExpiredNotice（AC2：清会话后的提示与跳转）', () => {
  beforeEach(() => {
    toast.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('非受保护路由 ⇒ 弹一次性 toast，文案键 = 既有顶层 `sessionExpired`（零新增 locale 键）', () => {
    const { unmount } = render(<SessionExpiredNotice />)

    fireExpired()

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('sessionExpired', { id: 'sf-session-expired' })

    unmount()
  })

  it('受保护路由 ⇒ **不**弹 toast（登录引导交既有 ProtectedRoute，避免双提示）', () => {
    const releaseRoute = markProtectedRouteActive()
    const { unmount } = render(<SessionExpiredNotice />)

    fireExpired()

    expect(toast.error).not.toHaveBeenCalled()

    unmount()
    releaseRoute()
  })

  it('卸载后事件不再触发 toast（不残留监听器）', () => {
    const { unmount } = render(<SessionExpiredNotice />)
    unmount()

    fireExpired()

    expect(toast.error).not.toHaveBeenCalled()
  })

  it('渲染 null：零 DOM 节点（外壳同构断言的前提）', () => {
    const { container } = render(<SessionExpiredNotice />)
    expect(container.innerHTML).toBe('')
  })
})
