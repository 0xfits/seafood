import React from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { avatarToneOf } from '../../home-campaign'

// ============================================================================
// 首页「热门任务」卡（campaign 体系 · **独立组件**）
// ----------------------------------------------------------------------------
// 硬口径（Kevin 2026-10-21 派单）：
//   · 与活动卡（CampaignCard）同族但**类名自成一套 `sf-home-camp-*`**，不混用
//     `sf-campaign-*` / `sf-item*`（避免样式与语义双向污染，同 CampaignCard 立卡先例）；
//   · 卡内自上而下：项目行（圆形 avatar + 项目名 + 活动名小字）→ 任务标题（两行截断）→
//     状态徽标（进行中/已截止）→ 参与进度（已参与 X / 共 Y）→ 奖励（$ 金额 + 次币符号）；
//   · 状态文案**零新 i18n 键**：active ⇒ `common.ongoing`、ended ⇒ `wage.statusClosed`
//     （其余状态 ⇒ 整行不渲染徽标，不渲染残行）；
//   · 进度：读口带 `joined_target` ⇒ `jobs.participantsHeadcount`（已参与 X / 共 Y）；
//     缺席 ⇒ `jobs.participants`（只显已参与）；
//   · 奖励：主奖励恒 `$` + 金额；次币符号借公开币种表映射（symbols 由页面线传入），
//     表失败 / 无该 cid ⇒ 次币行整行不渲染（同 CampaignDetailPage 体例）；
//   · 可点性（Kevin 2026-10-21 需求②）：**桌面首页卡 ⇒ 该任务自己的页面 `/task/<task_id>`**
//     （唯一构造器 `buildLocalizedPath`；`data-sf-task` 已带任务号，探针据它点卡验落点）。
//     历史行为（整卡 → `/campaign/:id`）改为兜底：仅当行**没有 task_id** 时才回落到活动页
//     —— 卡片永远可点，绝不因缺号变成不可点的残卡；
//     ★ 零 mock：本组件只渲染读口真行（脏行缺 task_id 与 campaign_id ⇒ 渲染 div 兜底，
//     仅展示不可点，不造假数据）。
// ============================================================================

const HomeCampaignCard = ({ card, lang, t, symbols }) => {
  const status = String(card.status || '')
  const isActive = status === 'active'
  const isEnded = status === 'ended'
  const hasTarget = card.joinedTarget !== null && card.joinedTarget !== undefined && card.joinedTarget !== ''
  const target = hasTarget ? Number(card.joinedTarget) : null
  const secondarySymbol = card.rewardSecondaryCid != null && card.rewardSecondaryCid !== ''
    ? (symbols?.[String(card.rewardSecondaryCid)] || '')
    : ''
  const showSecondary = card.rewardSecondaryAmount != null
    && card.rewardSecondaryAmount !== ''
    && Boolean(secondarySymbol)
  const initial = card.projectTitle ? card.projectTitle.slice(0, 1).toUpperCase() : '?'
  const tone = avatarToneOf(card.projectTitle)

  const body = (
    <>
      <div className="sf-home-camp-project">
        <span
          className="sf-home-camp-avatar"
          data-sf-m="home-camp-avatar"
          data-sf-tone={String(tone)}
          aria-hidden="true"
        >
          {card.projectAvatarUrl
            ? <img className="sf-home-camp-avatar-img" src={card.projectAvatarUrl} alt="" loading="lazy" />
            : <span className="sf-home-camp-avatar-initial">{initial}</span>}
        </span>
        <span className="sf-home-camp-project-names">
          <span className="sf-home-camp-project-name" data-sf-m="home-camp-project">
            {card.projectTitle || '—'}
          </span>
          {card.campaignTitle ? (
            <span className="sf-home-camp-campaign-name" data-sf-m="home-camp-campaign">
              {card.campaignTitle}
            </span>
          ) : null}
        </span>
      </div>

      <h3 className="sf-home-camp-title" data-sf-m="home-camp-title">{card.title || ''}</h3>

      <div className="sf-home-camp-meta">
        {(isActive || isEnded) ? (
          <span
            className={`sf-home-camp-tag ${isActive ? 'is-active' : 'is-ended'}`}
            data-sf-m="home-camp-status"
            data-sf-state={status}
          >
            {isActive ? t('common.ongoing') : t('wage.statusClosed')}
          </span>
        ) : null}
        <span className="sf-home-camp-joined" data-sf-m="home-camp-joined">
          {hasTarget
            ? t('jobs.participantsHeadcount', { done: card.joinedCount, limit: target })
            : t('jobs.participants', { count: card.joinedCount })}
        </span>
      </div>

      <div className="sf-home-camp-reward" data-sf-m="home-camp-reward">
        <span className="sf-home-camp-reward-primary" data-sf-amount={card.rewardPrimary ?? ''}>
          <span className="sf-home-camp-reward-cur">$</span>
          {card.rewardPrimary ?? '0'}
        </span>
        {showSecondary ? (
          <span className="sf-home-camp-reward-secondary" data-sf-m="home-camp-reward-secondary">
            {t('campaign.rewardSecondary', { amount: card.rewardSecondaryAmount, symbol: secondarySymbol })}
          </span>
        ) : null}
      </div>
    </>
  )

  const hasTaskId = card.taskId !== null && card.taskId !== undefined && card.taskId !== ''
  const hasCampaignId = card.campaignId !== null && card.campaignId !== undefined && card.campaignId !== ''

  if (!hasTaskId && !hasCampaignId) {
    return (
      <div
        className="sf-home-camp-card"
        data-sf-m="home-camp-card"
        data-sf-camp-main={card.isMain ? '1' : '0'}
      >
        {body}
      </div>
    )
  }

  // 主目标 = 任务页（Kevin 需求②）；缺 task_id 的历史行回落活动页（兜底，不留不可点卡）。
  const cardHref = hasTaskId
    ? `/task/${encodeURIComponent(String(card.taskId))}`
    : `/campaign/${encodeURIComponent(String(card.campaignId))}`

  return (
    <Link
      className="sf-home-camp-card"
      data-sf-m="home-camp-card"
      data-sf-camp-main={card.isMain ? '1' : '0'}
      data-sf-task={String(card.taskId ?? '')}
      to={buildLocalizedPath(lang, cardHref)}
    >
      {body}
    </Link>
  )
}

export default HomeCampaignCard
