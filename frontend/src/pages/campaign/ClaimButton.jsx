import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { claimCampaignAll, claimSubtaskReward, claimTaskReward } from './campaign-api'
import { isBattInsufficient, isNothingToClaim } from './campaign-util'

// ============================================================================
// 【领取】按钮（三处同一个组件：子任务行 / 任务完成奖 / 活动一键领取）
// ----------------------------------------------------------------------------
// 契约（后端并行单冻结，加性）：
//   · 子任务行  `POST /api/campaign/subtask/<id>/claim` ⇒ `{amount,cid,batt_after}`
//   · 任务完成奖 `POST /api/campaign/task/<taskId>/claim` ⇒ `{amount,secondary_*,batt_after}`
//   · 活动一键  `POST /api/campaign/<campaignId>/claim` ⇒ `{claimed[],total_primary,batt_after}`
//     ★ **一次点击共扣 1 电量** ⇒ 活动级只发一个请求，绝不按 item 循环（循环 = 多次扣电量）。
//
// 硬口径：
//   · **匿名零按钮**：未登录整枚不渲染（不是 disabled）—— 领取是纯写动作，公开读面不给假入口；
//   · 「有没有得领」由页面按读口 `pending_rewards` 决定（本组件不做二次判据），组件只管点击结果；
//   · 结果出口：**成功 ⇒ `toast.success`（资金余额变动类统一口径，Kevin 2026-10-24 裁定）**，
//     组件内**不再**渲染内联成功节点；**失败仍内联**，按机读码分三支
//     `batt_insufficient` / `nothing_to_claim` / 其他（失败不得改 Toast）；
//     ▲ 原文为「结果一律**内联**（不弹 toast）：成功显示到账金额」——已被 2026-10-24 裁定推翻（仅成功一支）。
//   · 成功后由 `onClaimed` 让页面**重拉详情**（待领取行以读口为准，本组件不自造乐观态）；
//     失败里 `nothing_to_claim` 同样触发复读（把已失效的按钮收掉）。
// ============================================================================

const CLAIMERS = {
  subtask: claimSubtaskReward,
  task: claimTaskReward,
  campaign: claimCampaignAll,
}

const LABEL_KEYS = {
  subtask: 'campaign.claim.cta',
  task: 'campaign.claim.cta',
  campaign: 'campaign.claim.all',
}

const ClaimButton = ({
  variant = 'subtask',
  refId,
  t,
  user,
  isAuthenticated,
  onClaimed,
  m = 'campaign-claim',
  className = 'sf-campaign-btn is-primary',
}) => {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // {kind:'ok'|'err', key, values}

  // 匿名：整枚不存在（零按钮、零请求）
  if (!isAuthenticated) return null
  if (refId === null || refId === undefined || String(refId).trim() === '') return null

  const claim = CLAIMERS[variant] || claimSubtaskReward
  const labelKey = LABEL_KEYS[variant] || LABEL_KEYS.subtask

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await claim(String(refId).trim(), user)
      if (variant === 'campaign') {
        const claimed = Array.isArray(result?.claimed) ? result.claimed : []
        toast.success(
          t('campaign.claim.allOk', { n: claimed.length, amount: result?.total_primary ?? 0 }),
          { duration: 5000 }
        )
      } else {
        toast.success(t('campaign.claim.ok', { amount: result?.amount ?? 0 }), { duration: 5000 })
      }
      // ★ 2026-10-24：成功改 Toast（挂在 `main.jsx` 顶层，跨路由/卸载存活）⇒ 原先
      //   「先让用户看见内联金额、再延时 900ms 重拉」的理由已不存在，直接复读。
      onClaimed?.(result)
    } catch (error) {
      if (isBattInsufficient(error)) {
        setNotice({ kind: 'err', key: 'campaign.claim.battInsufficient' })
      } else if (isNothingToClaim(error)) {
        setNotice({ kind: 'err', key: 'campaign.claim.nothingToClaim' })
        await new Promise((r) => setTimeout(r, 900))
        onClaimed?.(null)
      } else {
        setNotice({ kind: 'err', key: 'campaign.claim.failed' })
      }
    } finally {
      setBusy(false)
    }
  }

  const kind = notice?.kind === 'ok' ? 'ok' : 'err'

  return (
    <span className="sf-campaign-claim" data-sf-m={`${m}-wrap`} data-sf-claim={variant}>
      <button
        type="button"
        className={className}
        data-sf-m={m}
        data-sf-action="claim"
        data-sf-claim={variant}
        data-sf-ref={String(refId)}
        disabled={busy}
        onClick={onClick}
      >
        {busy ? t('campaign.claim.claiming') : t(labelKey)}
      </button>
      {notice?.key ? (
        <span
          className={`sf-campaign-claim-notice is-${kind}`}
          data-sf-m={`${m}-notice`}
          data-sf-kind={kind}
          role={kind === 'ok' ? 'status' : 'alert'}
        >
          {t(notice.key, notice.values)}
        </span>
      ) : null}
    </span>
  )
}

export default ClaimButton
