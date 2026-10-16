import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, X } from 'lucide-react'
import { useAuth } from '../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'
import { useUnreadCount } from './unread-context'
import {
  isMessagesPanelOpen,
  panelCloseTarget,
  withPanelParams,
} from './messages-panel-routing'
import {
  createMessageSendTracker,
  fetchConversationMessages,
  fetchConversations,
  isMessageRateLimited,
  markConversationRead,
  messageSendFingerprint,
  sendConversationMessage,
} from '../messages-api'
// ★ 页面侧样式**复用**（`N44`：「页面 CSS 可以复用、外壳约束一条都不能碰」）；
//   面板专属几何 / 让位 / ≤767 全屏落**新文件** `shell/messages-panel.css`（`shell.css` 一字不动）。
import '../pages/messages.css'
import './messages-panel.css'

// ============================================================================
// 消息面板（design-system.spec v1.19 §21 · `T104`–`T108` · Kevin 2026-10-16 逐字「方案 1 · 就地叠加」）
// ----------------------------------------------------------------------------
// 形态（写死）：
//   · **不做独立页面** ⇒ 内嵌面板：打开时当前页**原地左压**（`.sf-shell--msg-open` 的
//     `padding-right` = `--sf-mp-let`）、页面整体右侧让位呈现本面板（宽 `--sf-mp-w`）；
//   · 面板内两栏：左 = 联系人列表（`messages-panel-list`）· 右 = 对话窗口（`messages-panel-thread`）；
//   · 面板外部的右侧**仍是既有 `.sf-fm`**（不遮挡、零几何改动 ⇒ 相交 = 0、间隙恒 16px）；
//   · `≤767` = 面板全屏 + 单栏两态（联系人 ⇄ 对话；`?c=` 定位 / `messages-back` 返回列表），让位量 = 0。
// 钩子（§21.5 · **保留原名优先**）：`messages-page` **改名** ⇒ `messages-panel`（本文件根容器）；
//   其余 16 条 `messages-*` 钩子**逐字保留**；新增 `messages-panel-list` / `messages-panel-thread` /
//   `messages-panel-close`（面板左上「×」）。★ **只用 `data-sf-m`** —— 不得新增任何 `data-sf-region`。
// 判据：**单一真源** = `shell/messages-panel-routing.js` 的 `isMessagesPanelOpen`（`T105`，路由串匹配）；
//   本组件与 `shell/AppShell.jsx` 共用同一份 ⇒ 零判据分叉。★ 零视口宽度判定。
// 关面板：左上「×」⇒ 移除 `msg` / `c`（`replace` 保当前页）；`/messages` 直链态 ⇒ 回首页（口径外延）。
// 取数：与既有真页**逐字同口径**（列表 keyset / 消息流 keyset / 读水位 / 发送幂等键 / 未读三时点，无轮询）。
// 主题面：**不按主题条件渲染**（日 / 夜 DOM 形状逐项相等）。
// ============================================================================
const PREVIEW_MAX = 50
const UNREAD_CAP = 99

/** `last_body_preview` 防御式截断（≤50 字符，含省略号；服务端已截断，前端只兜底）。 */
const previewOf = (value) => {
  const text = String(value == null ? '' : value)
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text
}

/** 角标显示值（`0` ⇒ `''` = 不渲染；`>99` ⇒ `99+`，§20.2 T103）。 */
const badgeTextOf = (count) => {
  const value = Number(count)
  if (!Number.isFinite(value) || value <= 0) return ''
  return value > UNREAD_CAP ? '99+' : String(Math.floor(value))
}

const MessagesPanel = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { refresh: refreshUnread } = useUnreadCount()
  const lang = getLanguageFromUrl(location.pathname)
  const myUid = user?.uID ?? user?.uid ?? null
  const activeId = new URLSearchParams(location.search).get('c') || ''
  // T105 单一真源（与 `shell/AppShell.jsx` 同一份判据）⇒ 未打开态一律不渲染、零取数。
  const open = isMessagesPanelOpen(location)

  const [list, setList] = useState({ phase: 'idle', rows: [], next: null, message: '' })
  const [thread, setThread] = useState({ phase: 'idle', conversation: null, rows: [], before: null, message: '' })
  const [draft, setDraft] = useState('')
  const [send, setSend] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createMessageSendTracker(), [])

  // 面板内导航一律 = **就地叠加**（当前路径 + `?msg=1`；带 `c` ⇒ 直接打开该会话）。
  const listPath = withPanelParams(location)
  const close = useCallback(() => {
    navigate(panelCloseTarget(location, buildLocalizedPath(lang, '/')), { replace: true })
  }, [location, lang, navigate])

  // #2 会话列表（keyset：`before_time` + `before_id`；「加载更多」传上一页 `next_cursor`）。
  const loadList = useCallback(async (cursor) => {
    setList((prev) => ({ ...prev, phase: cursor ? prev.phase : 'loading', message: '' }))
    try {
      const data = await fetchConversations(user, {
        beforeTime: cursor?.before_time ?? null,
        beforeId: cursor?.before_id ?? null,
      })
      const rows = Array.isArray(data?.rows) ? data.rows : []
      setList((prev) => ({
        phase: 'ok',
        rows: cursor ? [...prev.rows, ...rows] : rows,
        next: data?.next_cursor || null,
        message: '',
      }))
    } catch (error) {
      setList((prev) => ({ ...prev, phase: 'error', message: String(error?.message || t('messagesPage.loadFailed')) }))
    }
  }, [user, t])

  // #3 消息流（keyset：`before_msg_id`）。
  const loadThread = useCallback(async (conversationId, beforeMsgId) => {
    setThread((prev) => (beforeMsgId ? prev : { ...prev, phase: 'loading', message: '' }))
    try {
      const data = await fetchConversationMessages(conversationId, user, { beforeMsgId: beforeMsgId ?? null })
      const rows = Array.isArray(data?.rows) ? data.rows : []
      setThread((prev) => ({
        phase: 'ok',
        conversation: data?.conversation || prev.conversation,
        rows: beforeMsgId ? [...prev.rows, ...rows] : rows,
        before: data?.next_before_msg_id ?? null,
        message: '',
      }))
      return true
    } catch (error) {
      setThread((prev) => ({ ...prev, phase: 'error', message: String(error?.message || t('messagesPage.loadFailed')) }))
      return false
    }
  }, [user, t])

  // 打开 / 切换会话：列表态取列表；详情态取消息流 + #5 读水位 + 刷新未读（取数时点 ③）。**无轮询**。
  // ★ 面板未打开 ⇒ **零请求**（条件挂载 + 本判据双保险）。
  useEffect(() => {
    if (!open) return undefined
    if (!isAuthenticated) {
      setList({ phase: 'idle', rows: [], next: null, message: '' })
      setThread({ phase: 'idle', conversation: null, rows: [], before: null, message: '' })
      return undefined
    }
    let alive = true
    const run = async () => {
      if (activeId) {
        const ok = await loadThread(activeId, null)
        if (!alive) return
        // #5 读水位（天然幂等）：失败也**不阻塞**消息面；随后刷新角标（时点 ③）。
        try {
          if (ok) await markConversationRead(activeId, user)
        } catch (error) {
          // 读水位失败 = 角标暂不清零；不报错、不回滚
        }
        if (alive) await refreshUnread()
      } else {
        await loadList(null)
      }
    }
    run()
    return () => { alive = false }
  }, [open, isAuthenticated, activeId, user, loadList, loadThread, refreshUnread])

  const onSend = async () => {
    const body = draft.trim()
    if (!body || !activeId || send.phase === 'loading') return
    const createKey = tracker.keyFor(messageSendFingerprint({ conversationId: activeId, body }))
    setSend({ phase: 'loading', message: '' })
    try {
      await sendConversationMessage(activeId, { body, createKey, user })
      tracker.reset()
      setDraft('')
      setSend({ phase: 'idle', message: '' })
      await loadThread(activeId, null)
      await refreshUnread() // 取数时点 ②：发送成功后
    } catch (error) {
      // 429 语义直出（§20.4）：`MSG_RATE_LIMITED` ⇒ 专用文案；其余 ⇒ 通用发送失败态。
      const message = isMessageRateLimited(error)
        ? t('messagesPage.rateLimited')
        : String(error?.message || t('messagesPage.sendFailed'))
      setSend({ phase: 'error', message })
    }
  }

  // 未打开（`T105` = 假）⇒ 不渲染（外壳亦条件挂载 ⇒ 未打开态 DOM 与现盘逐字相同）。
  if (!open) return null

  return (
    <section className="sf-mp sf-msg-page" data-sf-m="messages-panel" aria-label={t('messagesPage.title')}>
      {/* 面板头：左上「×」（关闭键 · §21.5 新增 `messages-panel-close`）+ 面板标题（复用既有键） */}
      <div className="sf-mp-head">
        <button
          type="button"
          className="sf-mp-close"
          data-sf-m="messages-panel-close"
          onClick={close}
          aria-label={t('messagesPage.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 className="sf-panel-title">{t('messagesPage.title')}</h2>
      </div>

      <div className={`sf-mp-body${activeId ? ' sf-mp-body--thread' : ''}`}>
        {/* 左栏 = 各联系人选择 */}
        <div className="sf-mp-list" data-sf-m="messages-panel-list">
          {!isAuthenticated ? (
            <p className="sf-msg-status">{t('pleaseLogin')}</p>
          ) : list.phase === 'ok' && list.rows.length === 0 ? (
            <p className="sf-msg-status" data-sf-m="messages-list-empty">{t('messagesPage.empty')}</p>
          ) : list.phase !== 'ok' ? (
            <p className="sf-msg-status sf-msg-err" data-sf-m="messages-list-status" data-sf-phase={list.phase}>
              {list.message || t('noData')}
            </p>
          ) : (
            <div className="sf-msg-list" data-sf-m="messages-list">
              {list.rows.map((row) => {
                const badge = badgeTextOf(row?.unread_count)
                return (
                  <Link
                    key={String(row?.conversation_id)}
                    className="sf-msg-conv"
                    data-sf-m="messages-conversation-item"
                    to={withPanelParams(location, row?.conversation_id)}
                  >
                    <span className="sf-msg-conv-top">
                      <span className="sf-msg-conv-peer">{`#${String(row?.counterpart_uid ?? '-')}`}</span>
                      {badge ? (
                        <span
                          className="sf-msg-conv-unread"
                          data-sf-m="messages-conversation-unread"
                          aria-label={t('messagesPage.unreadA11y', { count: Number(row?.unread_count) })}
                        >{badge}</span>
                      ) : null}
                    </span>
                    <span className="sf-msg-conv-title">{String(row?.listing_title ?? '')}</span>
                    <span className="sf-msg-conv-preview">{previewOf(row?.last_body_preview)}</span>
                  </Link>
                )
              })}
              {list.next != null && (
                <button
                  type="button"
                  className="sf-msg-more"
                  data-sf-m="messages-load-more"
                  onClick={() => loadList(list.next)}
                >
                  {t('messagesPage.loadMore')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 右栏 = 对话窗口 */}
        <div className="sf-mp-thread" data-sf-m="messages-panel-thread">
          {!isAuthenticated ? null : (
            <>
              {/* 返回列表（`≤767` 单栏返回联系人；`≥768` 左栏常显 ⇒ 仍渲染、由面板 CSS 隐藏） */}
              <Link className="sf-msg-back sf-tap" to={listPath} data-sf-m="messages-back">
                <ChevronLeft size={18} aria-hidden="true" />
                {t('messagesPage.backToList')}
              </Link>

              {activeId ? (
                <>
                  {/* 商品上下文行（aboutItem） */}
                  <p className="sf-msg-about" data-sf-m="messages-about">
                    {t('messagesPage.aboutItem', { title: String(thread.conversation?.listing_title || '-') })}
                  </p>

                  {thread.phase !== 'ok' ? (
                    <p className="sf-msg-status sf-msg-err" data-sf-m="messages-thread-status" data-sf-phase={thread.phase}>
                      {thread.message || t('noData')}
                    </p>
                  ) : thread.rows.length === 0 ? (
                    <p className="sf-msg-status" data-sf-m="messages-detail-empty">{t('messagesPage.detailEmpty')}</p>
                  ) : (
                    <div className="sf-msg-thread" data-sf-m="messages-thread">
                      {thread.rows.map((row) => {
                        const mine = String(row?.from_uid) === String(myUid)
                        return (
                          <div
                            key={String(row?.msg_id)}
                            className={`sf-msg-bubble ${mine ? 'sf-msg-mine' : 'sf-msg-theirs'}`}
                            data-sf-m={mine ? 'messages-msg-mine' : 'messages-msg-theirs'}
                          >
                            {String(row?.body ?? '')}
                          </div>
                        )
                      })}
                      {thread.before != null && (
                        <button
                          type="button"
                          className="sf-msg-more"
                          data-sf-m="messages-load-more"
                          onClick={() => loadThread(activeId, thread.before)}
                        >
                          {t('messagesPage.loadMore')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 输入区：textarea + 发送（空 body 禁发） */}
                  <div className="sf-msg-inputrow" data-sf-m="messages-input-row">
                    <textarea
                      className="sf-msg-input"
                      data-sf-m="messages-input"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={t('messagesPage.inputPlaceholder')}
                    />
                    <button
                      type="button"
                      className="sf-msg-send"
                      data-sf-m="messages-send-btn"
                      onClick={onSend}
                      disabled={!draft.trim() || send.phase === 'loading'}
                    >
                      {t('messagesPage.send')}
                    </button>
                  </div>
                  {send.message && (
                    <p className="sf-msg-status sf-msg-err" data-sf-m="messages-send-status" role="status">{send.message}</p>
                  )}
                </>
              ) : (
                /* 未选会话 ⇒ 右栏空态（`messages-detail-empty` 钩子 + 既有键 `messagesPage.detailEmpty`） */
                <p className="sf-msg-status" data-sf-m="messages-detail-empty">{t('messagesPage.detailEmpty')}</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default MessagesPanel
