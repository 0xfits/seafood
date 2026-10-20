import React from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { refOf, statusKeyOf, timeWindowOf } from './campaign-util'

// ============================================================================
// 活动卡（`/campaign` 列表项 · **独立组件**）
// ----------------------------------------------------------------------------
// 硬口径（design §26.19.1 #73 / #75）：
//   · **不复用商品卡**（`sf-listings-card` / `sf-item*` 类名与组件一律不碰）—— 活动卡自成一套
//     `sf-campaign-*` 命名，避免样式与语义双向污染；
//   · 卡面五件：标题 / 简述首行 / 时间窗 / 状态徽标 / 包含任务数；`ended` 与 `active` 视觉可区分
//     （徽标文案 + `data-sf-state` + `is-ended` 修饰类，三处同时变，不靠颜色单打）；
//   · 整卡 = 一条链接（卡内零按钮、零输入 ⇒ 不存在嵌套交互元素），目标走唯一构造器
//     `buildLocalizedPath`（禁字面 `/campaign` 硬写，语言前缀由构造器承担）。
// ============================================================================

const firstLineOf = (text) => {
  const raw = String(text || '')
  const line = raw.split('\n')[0].trim()
  return line || ''
}

const CampaignCard = ({ campaign, lang, t }) => {
  const ref = refOf(campaign)
  const status = String(campaign?.status || '')
  const statusKey = statusKeyOf(status)
  const window = timeWindowOf(campaign, lang)
  const tasks = Array.isArray(campaign?.tasks) ? campaign.tasks.length : 0
  const desc = firstLineOf(campaign?.description)

  return (
    <Link
      className={`sf-campaign-card sf-card${status === 'ended' ? ' is-ended' : ''}`}
      data-sf-m="campaign-card"
      data-sf-ref={ref}
      data-sf-state={status || 'unknown'}
      to={buildLocalizedPath(lang, `/campaign/${encodeURIComponent(ref)}`)}
    >
      <header className="sf-campaign-card-head">
        <h2 className="sf-campaign-card-title" data-sf-m="campaign-card-title">{campaign?.title || ''}</h2>
        {statusKey ? (
          <span
            className={`sf-campaign-tag ${status === 'ended' ? 'is-ended' : 'is-active'}`}
            data-sf-m="campaign-card-status"
            data-sf-state={status}
          >{t(statusKey)}</span>
        ) : null}
      </header>

      {desc ? (
        <p className="sf-campaign-card-desc" data-sf-m="campaign-card-desc">{desc}</p>
      ) : null}

      <div className="sf-campaign-card-meta">
        {window ? (
          <span className="sf-campaign-card-time" data-sf-m="campaign-card-time">
            {t(window.key, window.values)}
          </span>
        ) : null}
        <span className="sf-campaign-card-count" data-sf-m="campaign-card-tasks">
          {t('campaign.taskCount', { n: tasks })}
        </span>
      </div>
    </Link>
  )
}

export default CampaignCard
