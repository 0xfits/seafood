import React from 'react'
import { useTranslation } from 'react-i18next'

import { isTranslating, normalizeLang } from '../../i18n-content'

// ============================================================================
// TR-2 · 用户内容「翻译中」小标（小尺寸 / 非阻挡）
//   · 条件：当前语言 **非 `zh`**（源语言档）**且** `i18n_status === 'pending' | 'partial'`；
//     `zh` 档 / `ready` / **字段缺省** / 未知语言码 ⇒ 渲染 `null`（不显示）。
//   · 文案走 i18n（键 `i18n.translating`，四语齐）；样式 `.sf-i18n-badge`（styles.css）——
//     `pointer-events:none` ⇒ **不阻挡**卡片点击（商品卡片本身是 `<Link>`）。
//   · 纯展示、无副作用；不读写任何密钥。
// ============================================================================
const TranslatingBadge = ({ status, className = '' }) => {
  const { t, i18n } = useTranslation()

  // TR-FIX：`zh` = 源语言（原文即本档）⇒ 不显示「翻译中」小标（提示无意义）。
  //   仅非 zh 档（en/hk/vn）才可能渲染；未知/缺省语言码由 `normalizeLang` 归一到 `zh`（同样不显示）。
  const lang = normalizeLang(i18n && (i18n.resolvedLanguage || i18n.language))
  if (lang === 'zh') return null
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
