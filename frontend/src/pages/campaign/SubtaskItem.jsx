import React from 'react'
import { typeKeyOf } from './campaign-util'

// ============================================================================
// 子任务行（活动详情里的最小单元 · **两级结构的第二级**）
// ----------------------------------------------------------------------------
// 骨架件（本步）= 类型徽标 + 标题 + required 标记 + 长文内容：
//   · 类型徽标五类（`campaign.type.<type_code>`，未知类型回落后端 seed 的 `type_label` —— 永不直出
//     `x_verify` 这类英文 code，design §26.19.3 #74）；
//   · required / optional 必须有视觉区分（#71）：文案 + 修饰类双落；
//   · 提交 / 预测交互在下一步的同一文件内追加（本步刻意不渲染任何可写控件）。
// ============================================================================

const SubtaskItem = ({ subtask, t }) => {
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
    </li>
  )
}

export default SubtaskItem
