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
//     **子任务区（可选，仅 `showSubtasks` 时；见下）** → 状态徽标（进行中/已截止）→
//     参与进度（已参与 X / 共 Y）→ 奖励（$ 金额 + 次币符号）；
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
//   ★ 零 mock：本组件只渲染读口真行（脏行缺 task_id 与 campaign_id ⇒ 渲染 div 兜底，
//     仅展示不可点，不造假数据）。
// ----------------------------------------------------------------------------
// 子任务区（Kevin 2026-10-22 · `/task` 列表卡列出 subtask 标题）：
//   · 开关 = **props.showSubtasks**（页面显式传）⇒ 首页「热门任务」版块不传此旗标，
//     即便读口行带了 `subtasks` 也**维持原卡面**（零回归）；只有 `/task` 列表开；
//   · 每条 = 类型徽标（五类 `campaign.type.*` 中文名，复用既有键）+ 标题单行截断（ellipsis）+
//     必做小标（复用既有 `campaign.requiredTag`，仅 required 行出）；最多 2 条，
//     超出补「+N 项子任务」（唯一新键 `taskPage.moreSubtasks`）；
//   · 无子任务 / 缺键 ⇒ 整块不渲染（**不占位**，卡高与改动前一致）；
//   · 等高：卡体 flex column + 子任务块 `min-height:0`，同一行卡由容器 stretch（grid/flex）
//     拉到等高，长标题靠 ellipsis 收口，不撑破卡宽。
// ============================================================================

/** 子任务行上限（超出 ⇒ 一行「+N 项子任务」提示，不再多渲染行） */
const SUBTASK_VISIBLE_MAX = 2

/** 五类子任务 type_code 白名单（= 后端 `SUBTASK_TYPES`）：只有列出的才出徽标，
 *  未列出的码**不出徽标**（绝不把机器码泄到卡面）；文案取 `campaign.type.<code>`（四语已有）。 */
const SUBTASK_TYPE_CODES = ['x_verify', 'onchain_snapshot', 'survey', 'prediction', 'quiz']

const HomeCampaignCard = ({ card, lang, t, symbols, showSubtasks = false }) => {
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

  // ── 子任务区（Kevin 2026-10-22：`/task` 列表卡在标题下列出 subtask 标题）────────────
  //   ① 只在页面显式传 `showSubtasks` 且行内确有子任务时才出现 ⇒ 首页热门任务卡**维持原样**；
  //   ② 最多 `SUBTASK_VISIBLE_MAX` 条，超出补一行「+N 项子任务」；无子任务 ⇒ 整块不渲染（不占位）。
  const subtaskRows = showSubtasks && Array.isArray(card.subtasks) ? card.subtasks : []
  const subtaskVisible = subtaskRows.slice(0, SUBTASK_VISIBLE_MAX)
  const subtaskRest = subtaskRows.length - subtaskVisible.length
  const subtaskBlock = subtaskVisible.length > 0 ? (
    <ul
      className="sf-home-camp-subtasks"
      data-sf-m="home-camp-subtasks"
      data-sf-count={String(subtaskRows.length)}
    >
      {subtaskVisible.map((subtask) => (
        <li className="sf-home-camp-subtask" data-sf-m="home-camp-subtask" key={String(subtask.subtaskId)}>
          {SUBTASK_TYPE_CODES.includes(subtask.typeCode) ? (
            <span
              className="sf-home-camp-subtask-type"
              data-sf-m="home-camp-subtask-type"
              data-sf-type={subtask.typeCode}
            >
              {t(`campaign.type.${subtask.typeCode}`)}
            </span>
          ) : null}
          <span className="sf-home-camp-subtask-title" data-sf-m="home-camp-subtask-title" title={subtask.title || ''}>
            {subtask.title || ''}
          </span>
          {subtask.required ? (
            <span className="sf-home-camp-subtask-required" data-sf-m="home-camp-subtask-required">
              {t('campaign.requiredTag')}
            </span>
          ) : null}
        </li>
      ))}
      {subtaskRest > 0 ? (
        <li className="sf-home-camp-subtask-more" data-sf-m="home-camp-subtask-more" data-sf-rest={String(subtaskRest)}>
          {t('taskPage.moreSubtasks', { n: subtaskRest })}
        </li>
      ) : null}
    </ul>
  ) : null

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

      {subtaskBlock}

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
