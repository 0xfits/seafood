import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { editFormOf } from './project-edit-form'

// ============================================================================
// 项目模态框壳（【编辑项目】/【招工】共用 · Kevin 2026-10-22③ 拆框）
// ----------------------------------------------------------------------------
// 为什么有这一层：拆出【招工】后是**两个**模态框，但「挂载即打开 / 背板·✕·Esc 三路零请求关闭 /
// 背景滚动锁定 / 面板几何 / 字段错误行 / 保存·取消按钮」这套外壳只该有**一份**实现 ——
// 否则两框的关闭语义（尤其「点背板不误触写口」）会各自漂移。
//
// 口径：
//   · `kind` = 框标识（`project-edit` / `project-recruit`）⇒ 私有件名 = `${kind}-panel|form|save|
//     cancel|close|title|backdrop`；框根 `data-sf-m={kind}` 且带 `data-sf-project`（写面主键）。
//   · 挂载 = 打开、卸载 = 关闭（无 `open` 开关态可漂移）；关闭三路**零请求**，只调 `onClose`。
//   · 提交在途（`busy`）时忽略 Esc / 背板 / ✕ / 取消，避免关框与响应竞争。
//   · 背景滚动锁定：挂载锁、卸载还原 body 原值（不覆盖宿主页面既有 inline 值）。
//   · 两框**互不嵌套**：各自 portal 到 body、各自 `<form onSubmit>`、各自提交自己的键集。
//   · 几何：390 全宽（面板左右 12px）、1536 居中且面板宽 ≤640；`z-index` 高于右侧悬浮菜单
//     （`.sf-fm` 6 ⇒ 本框 60）；两档均不得横向溢出（面板 `max-width:100%` + 输入 `width:100%`）。
// ============================================================================

/** 字段级错误行（两框共用；`data-sf-edit-err={field}` 供单测 / 探针取证）。 */
export const FieldError = ({ field, text }) => (
  text ? <span className="sf-project-edit-err" data-sf-edit-err={field} role="alert">{text}</span> : null
)

/**
 * 表单状态 hook（两框共用）：初值 = `editFormOf(view)`（同一份），`setField` 清字段级错误，
 * 次币两键联动（选「无」⇒ 金额一并清空，后端两键同空同非空）。
 */
export const useProjectFormState = (view) => {
  const [form, setForm] = useState(() => editFormOf(view))
  const [errs, setErrs] = useState({})

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'cid' && String(value) === '') next.amount = ''
      return next
    })
    const errField = field === 'cid' || field === 'amount' ? 'currency' : field
    setErrs((prev) => {
      if (!prev[errField]) return prev
      const next = { ...prev }
      delete next[errField]
      return next
    })
  }

  return { form, errs, setErrs, setField }
}

const ProjectModalShell = ({ kind, projectRef, title, busy, labels, onClose, onSubmit, children }) => {
  // 关闭回调走 ref：Esc 监听只在挂载时注册一次（onClose 换引用不重挂监听）。
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy

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

  // ② Esc 关闭（零请求）；提交在途时忽略
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event?.key !== 'Escape') return
      event.stopPropagation()
      if (busyRef.current) return
      closeRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const requestClose = () => {
    if (busy) return
    onClose?.()
  }

  /** 背板点击 = 关闭：只认背板自身（面板内点击冒泡到此一律忽略）。 */
  const onBackdropDown = (event) => {
    if (event.target !== event.currentTarget) return
    requestClose()
  }

  const node = (
    <div className="sf-project-modal" data-sf-m={kind} data-sf-project={projectRef}>
      {/* 背板：遮罩 + 关闭面（点背板 = 关闭，零请求） */}
      <div
        className="sf-project-modal-backdrop"
        data-sf-m={`${kind}-backdrop`}
        onMouseDown={onBackdropDown}
        aria-hidden="true"
      />
      <div
        className="sf-project-modal-panel"
        data-sf-m={`${kind}-panel`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`sf-${kind}-title`}
      >
        <div className="sf-project-modal-head">
          <h2 className="sf-project-modal-title" id={`sf-${kind}-title`} data-sf-m={`${kind}-title`}>
            {title}
          </h2>
          <button
            type="button"
            className="sf-project-modal-close"
            data-sf-m={`${kind}-close`}
            aria-label={labels.cancel}
            onClick={requestClose}
          >✕</button>
        </div>

        <form className="sf-project-form" data-sf-m={`${kind}-form`} noValidate onSubmit={onSubmit}>
          {children}
          <div className="sf-project-actions">
            <button type="submit" className="sf-project-btn is-primary" data-sf-m={`${kind}-save`} disabled={busy}>
              {busy ? labels.saving : labels.save}
            </button>
            <button type="button" className="sf-project-btn" data-sf-m={`${kind}-cancel`} onClick={requestClose} disabled={busy}>
              {labels.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  // 挂在 body 上：脱离页面容器（含 `sf-layout-main` 的滚动/层叠上下文），保证遮罩盖住悬浮菜单。
  return typeof document === 'undefined' ? node : createPortal(node, document.body)
}

export default ProjectModalShell
