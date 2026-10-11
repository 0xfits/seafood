import React from 'react'
import { useTranslation } from 'react-i18next'

// 消息页（**占位** · design-system.spec v1.5 §14 · T80 + route-layer.spec v2.27 §37）
// · 本轮为**占位页**：不做任何后端请求；沿用本仓既有页面骨架类（.sf-layout / .sf-layout-main / .sf-panel-title），不另造风格。
// · ★ X（推特）私信接驳位（预留）：后续在此接入 X 私信 —— 拉取会话列表 + 未读计数；见下方 data-sf-m="messages-x-placeholder" 区块（本轮仅占位，无逻辑）。
const MessagesPage = () => {
  const { t } = useTranslation()

  return (
    <div className="sf-layout" data-sf-m="messages-page">
      <div className="sf-layout-main">
        <h1 className="sf-panel-title">{t('messagesPage.title')}</h1>
        <p>{t('messagesPage.empty')}</p>

        {/* ★ X（推特）私信接驳位（预留）：后续在此拉取会话 + 未读，本轮为占位块（无请求、无状态）。 */}
        <div data-sf-m="messages-x-placeholder">
          <p className="sf-panel-title">{t('messagesPage.xPlaceholder')}</p>
          <p>{t('messagesPage.xNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default MessagesPage
