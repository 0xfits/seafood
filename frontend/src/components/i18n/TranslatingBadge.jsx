import React from 'react'
import { useTranslation } from 'react-i18next'

import { isTranslating } from '../../i18n-content'

// ============================================================================
// TR-2 · 用户内容「翻译中」小标（小尺寸 / 非阻挡）
//   · 条件：`i18n_status === 'pending' | 'partial'`；`ready` 或**字段缺省** ⇒ 渲染 `null`（不显示）。
//   · 文案走 i18n（键 `i18n.translating`，四语齐）；样式 `.sf-i18n-badge`（styles.css）——
//     `pointer-events:none` ⇒ **不阻挡**卡片点击（商品卡片本身是 `<Link>`）。
//   · 纯展示、无副作用；不读写任何密钥。
// ============================================================================
const TranslatingBadge = ({ status, className = '' }) => {
  const { t } = useTranslation()

  if (!isTranslating(status)) return null

  return (
    <span
      className={`sf-i18n-badge${className ? ` ${className}` : ''}`}
      data-sf-m="i18n-translating"
      data-i18n-status={status}
      role="status"
      title={t('i18n.translating')}
    >
      {t('i18n.translating')}
    </span>
  )
}

export default TranslatingBadge
