import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// 领工资成功模态框（Kevin 2026-10-23 需求A）
// ----------------------------------------------------------------------------
// 为什么要单独一个框：领工资成功**不再是一条卡内文案**（`wage-card-notice` 的 ok 态从卡里
// 彻底退场），而是一次结算结果的独立播报 —— 到账电量 / 次币额 + 连续领取次数与额外 $ 奖励。
//
// 口径（体例对齐 `pages/project/ProjectModalShell.jsx` 的框壳，去掉表单与保存语义）：
//   · 挂载 = 打开、卸载 = 关闭（无 `open` 开关态可漂移）；关闭三路 = ✕ / 背板 / Esc，**零请求**；
//   · 背景滚动锁定：挂载锁 body.style.overflow、卸载还原宿主原值（不覆盖宿主既有 inline 值）；
//   · portal 到 body：脱离 `sf-layout-main` 的层叠上下文，遮罩盖住右侧悬浮菜单（`.sf-fm` = 6；
//     本框 60，与项目页模态框同层）；
//   · 只读框：无输入、无提交，唯一动作 = 关闭 ⇒ 不引表单、不引校验；
//   · 文案全部来自 i18n 既有键（`success` / `confirm` / `wage.claimed*` / `wage.streakReward`），
//     本单**零新增键**（键集与四语计数不动）。
// ============================================================================

/** 关闭按钮的无障碍名 = 与可见按钮同一文案（`confirm`）。 */
const WageClaimModal = ({ kind = 'wage-claim', title, text, streak, closeLabel, onClose }) => {
  // 关闭回调走 ref：Esc 监听只在挂载时注册一次（onClose 换引用不重挂监听）。
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // ① 背景滚动锁定（挂载锁、卸载还原原值）
  useEffect(() => {
    const body = document.body
    const prev = body.style.overflow
    body.style.overflow = 'hidden'
    body.dataset.sfModalLock = '1'
    return () => {
      body.style.overflow = prev
      delete body.dataset.sfModalLock
    }
  }, [])

  // ② Esc 关闭（零请求）
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event?.key !== 'Escape') return
      event.stopPropagation()
      closeRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const requestClose = () => closeRef.current?.()

  /** 背板点击 = 关闭：只认背板自身（面板内点击冒泡到此一律忽略）。 */
  const onBackdropDown = (event) => {
    if (event.target !== event.currentTarget) return
    requestClose()
  }

  const node = (
    <div className="sf-wage-modal" data-sf-m={kind}>
      <div
        className="sf-wage-modal-backdrop"
        data-sf-m={`${kind}-backdrop`}
        onMouseDown={onBackdropDown}
        aria-hidden="true"
      />
      <div
        className="sf-wage-modal-panel"
        data-sf-m={`${kind}-panel`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`sf-${kind}-title`}
        aria-describedby={`sf-${kind}-text`}
      >
        <div className="sf-wage-modal-head">
          <h2 className="sf-wage-modal-title" id={`sf-${kind}-title`} data-sf-m={`${kind}-title`}>
            {title}
          </h2>
          <button
            type="button"
            className="sf-wage-modal-close"
            data-sf-m={`${kind}-x`}
            aria-label={closeLabel}
            onClick={requestClose}
          >✕</button>
        </div>

        <p className="sf-wage-modal-text" id={`sf-${kind}-text`} data-sf-m={`${kind}-text`}>{text}</p>
        {streak ? (
          <p className="sf-wage-modal-streak" data-sf-m={`${kind}-streak`}>{streak}</p>
        ) : null}

        <div className="sf-wage-modal-actions">
          <button
            type="button"
            className="sf-wage-btn is-primary"
            data-sf-m={`${kind}-close`}
            onClick={requestClose}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? node : createPortal(node, document.body)
}

export default WageClaimModal
