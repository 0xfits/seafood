import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'
import { useUnreadCount } from '../shell/unread-context'
import {
  createMessageSendTracker,
  fetchConversationMessages,
  fetchConversations,
  isMessageRateLimited,
  markConversationRead,
  messageSendFingerprint,
  sendConversationMessage,
} from '../messages-api'
import './messages.css'

// ============================================================================
// `/messages` **真页**（design-system.spec v1.17 §20.2 T101 + §20.4）
// ----------------------------------------------------------------------------
// 三态（写死）：
//   · 列表态 —— keyset 会话列表（对端掩码标识 + 商品标题 + `last_body_preview` ≤50 字符 +
//     每行未读角标 + 「加载更多」）；
//   · 详情态 —— 消息流（keyset 按 `msg_id` 倒序）+ 顶部返回列表（`messages-back`）+ 商品上下文行（`aboutItem`）；
//   · 空态 —— 列表空 = 既有键 `messagesPage.empty`；详情空 = 新键 `messagesPage.detailEmpty`。
// 输入区 = textarea + 发送按钮（空 body 禁发；发送键 = `cli:` 前端供键，见 `messages-api`）。
// ★ 占位区块**已删除**（T101 显式项 + 教训 N43）：钩子 `messages-x-placeholder` 与键
//   `messagesPage.xPlaceholder` / `xNote`（四语同删）整块移除 —— 预留槽位激活必须同步回收占位遗物。
// ★ 未读角标取数时点（§20.6）之 ②发送成功后 / ③进入详情后（读水位回执），均由本页触发；**无轮询**。
// ★ 路由面零改动（`/messages` 已登记；会话定位用 query `?c=<conversation_id>`，路由路径不变）。
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

const MessagesPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const { refresh: refreshUnread } = useUnreadCount()
  const lang = getLanguageFromUrl(location.pathname)
  const myUid = user?.uID ?? user?.uid ?? null
  const activeId = new URLSearchParams(location.search).get('c') || ''

  const [list, setList] = useState({ phase: 'idle', rows: [], next: null, message: '' })
  const [thread, setThread] = useState({ phase: 'idle', conversation: null, rows: [], before: null, message: '' })
  const [draft, setDraft] = useState('')
  const [send, setSend] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createMessageSendTracker(), [])

  const listPath = buildLocalizedPath(lang, '/messages')

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

  // 挂载 / 切换会话：列表态取列表；详情态取消息流 + #5 读水位 + 刷新未读（取数时点 ③）。**无轮询**。
  useEffect(() => {
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
  }, [isAuthenticated, activeId, user, loadList, loadThread, refreshUnread])

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

  // 未登录 ⇒ 登录引导（既有键，零新造弹层）
  if (!isAuthenticated) {
    return (
      <div className="sf-layout sf-msg-page" data-sf-m="messages-page">
        <div className="sf-layout-main">
          <h1 className="sf-panel-title">{t('messagesPage.title')}</h1>
          <p className="sf-msg-status">{t('pleaseLogin')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-layout sf-msg-page" data-sf-m="messages-page">
      <div className="sf-layout-main">
        <div className="sf-msg">
          {activeId ? (
            <>
              {/* 返回列表（AC-2：`messages-back` 可见可点、≤767 ≥44×44） */}
              <Link className="sf-msg-back sf-tap" to={listPath} data-sf-m="messages-back">
                <ChevronLeft size={18} aria-hidden="true" />
                {t('messagesPage.backToList')}
              </Link>

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
            <>
              <h1 className="sf-panel-title">{t('messagesPage.title')}</h1>
              {list.phase === 'ok' && list.rows.length === 0 ? (
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
                        to={`${listPath}?c=${encodeURIComponent(String(row?.conversation_id))}`}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessagesPage
