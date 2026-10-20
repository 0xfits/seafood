import React from 'react'
import SubtaskForm from './SubtaskForm'
import { typeKeyOf } from './campaign-util'

// ============================================================================
// 子任务行（活动详情里的最小单元 · **两级结构的第二级**）
// ----------------------------------------------------------------------------
// 结构 = 头行（类型徽标 + 标题 + required/optional）→ 长文内容 → **可写面板**：
//   · 类型徽标五类（`campaign.type.<type_code>`，未知类型回落后端 seed 的 `type_label` —— 永不直出
//     `x_verify` 这类英文 code，design §26.19.3 #74）；
//   · required / optional 必须有视觉区分（#71）：文案 + 修饰类双落；
//   · 可写面全在 `SubtaskForm`（prediction 双选/锁定/结算 + 其余四类提交面板），本文件只管摆放，
//     读不到 `payload` 选项的 prediction 由面板自身整块不渲染（不渲染半个预测）。
// ============================================================================

const SubtaskItem = ({ subtask, t, lang, user, isAuthenticated, onRefresh }) => {
  const typeKey = typeKeyOf(subtask?.type_code)
  const badge = typeKey ? t(typeKey) : (subtask?.type_label || '')
  const required = subtask?.required === true

  return (
    <li
      className="sf-campaign-subtask"
      data-sf-m="campaign-subtask"
      data-sf-subtask={String(subtask?.subtask_id ?? '')}
      data-sf-type={String(subtask?.type_code ?? '')}
    >
      <div className="sf-campaign-subtask-head">
        {badge ? (
          <span className="sf-campaign-badge" data-sf-m="campaign-subtask-type">{badge}</span>
        ) : null}
        <span className="sf-campaign-subtask-title" data-sf-m="campaign-subtask-title">{subtask?.title || ''}</span>
        <span
          className={`sf-campaign-req ${required ? 'is-required' : 'is-optional'}`}
          data-sf-m="campaign-subtask-required"
          data-sf-required={required ? '1' : '0'}
        >{t(required ? 'campaign.requiredTag' : 'campaign.optionalTag')}</span>
      </div>

      {subtask?.content ? (
        <p className="sf-campaign-subtask-content" data-sf-m="campaign-subtask-content">{subtask.content}</p>
      ) : null}

      <SubtaskForm
        subtask={subtask}
        t={t}
        lang={lang}
        user={user}
        isAuthenticated={isAuthenticated}
        onRefresh={onRefresh}
      />
    </li>
  )
}

export default SubtaskItem
