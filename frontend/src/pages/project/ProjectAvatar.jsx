import React, { useRef, useState } from 'react'
import { Camera, Check, RotateCcw, X } from 'lucide-react'
import { compressImage } from '../../image-compress'
import { avatarInitialOf } from '../../avatar-tone'
import { errPartsOf, writeFailNotice } from './project-error'
import { patchProject, uploadProjectAvatar } from './project-api'

// ============================================================================
// 项目头像（Kevin 2026-10-22 · 项目页头部头像 + 换/恢复默认入口）
// ----------------------------------------------------------------------------
// 形态：头部头行左侧 48px 圆形头像 —— 有 `avatar_url` ⇒ `<img>`；无 ⇒ 项目名首字彩底。
//   本人 `owner_uid` ∨ `manage_tasks` 管理员 ⇒ 右下角 28px 圆形相机钮（`aria-label` =
//   `project.avatarChange`，点击开文件选择 `accept=image/*`）；已有头像时头像下方给
//   【恢复默认】（行内二次确认：提示 + 确认/取消，确认才发 PATCH）。
//   **普通用户看到的是同一枚头像，零入口零 input**（DOM 里也不留隐藏控件）；`ended` 项目
//   owner / 管理员**仍可改**（头像是展示属性，不受写面封板约束）。
//
// 上传流水线（复用既有三段，禁另起炉灶）：
//   选图 ⇒ `compressImage`（`src/image-compress.js`，与发布页**同一份**实现：长边 ≤1280、
//   WebP q0.82 起档逐级降阶、编码后 ≤1MiB）⇒ `POST /api/media`（`uploadProjectAvatar`，
//   即 `pages/item/item-api.uploadMedia`）⇒ `PATCH /api/project/:projectId {avatar_url}`
//   取值恰 `/api/media/<media id>` ⇒ 成功后 `onChanged()` 静默重拉（头像即时更新，无成功弹窗）。
//
// 失败可见性（沿用本页既有口径）：
//   · 压缩后全档位仍 >1MiB（`compressImage` 返 `null`）⇒ `project.avatarTooLarge`，**零上传零 PATCH**；
//   · 解码/编码异常、媒体口无 id ⇒ `project.avatarUploadFail`，零 PATCH；
//   · 上传口 / 写口带 `code` / `details.reason` / HTTP 状态 ⇒ `writeFailNotice` 拼「失败：<因由>（HTTP n）」
//     **行内内联**（409 / 400 都落这里），头像与页面状态不改判。
// ============================================================================

/** 媒体口返回 ⇒ `/api/media/<id>`（优先 `media_id`；旧面只有 `url` 时从 url 里取 id）。 */
const avatarUrlOf = (payload) => {
  const id = payload?.media_id ?? payload?.mediaId ?? payload?.id
  if (id !== null && id !== undefined && String(id).trim()) return `/api/media/${String(id).trim()}`
  const hit = String(payload?.url || '').match(/\/api\/media\/([^/?#]+)/)
  return hit ? `/api/media/${hit[1]}` : ''
}

const ProjectAvatar = ({ view, canEdit, user, t, onChanged }) => {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text, code?, reason?, status? }
  const [confirming, setConfirming] = useState(false) // 【恢复默认】行内二次确认
  const inputRef = useRef(null)

  const raw = typeof view?.avatar_url === 'string' ? view.avatar_url.trim() : ''
  const title = String(view?.title || '')
  const initial = avatarInitialOf(title)
  // PATCH 目标：项目主键优先（读口三形态都收，主键最不含糊）
  const projectRef = view?.project_id ?? view?.snowflake_id ?? view?.slug ?? ''

  const patchAvatar = (avatarUrl) => patchProject(projectRef, { avatar_url: avatarUrl }, user)

  const failNotice = (error, i18nKey) => {
    const { code } = errPartsOf(error)
    const { status } = errPartsOf(error)
    // 无 code 且无 HTTP 状态 = 本地失败（解码 / 媒体口无 id）⇒ 用本页头像口文案，不硬编假事实
    if (!code && status === null) return { kind: 'err', text: t(i18nKey) }
    return { kind: 'err', ...writeFailNotice(error, t) }
  }

  /** 选图 ⇒ 压缩 ⇒ 上传 ⇒ PATCH ⇒ 静默重拉。任一步失败都**不改判**头像，只内联提示。 */
  const onPick = async (event) => {
    const input = event.target
    const file = (input?.files || [])[0]
    if (input) input.value = '' // 允许再次选择同一文件
    if (!file || busy) return
    if (!String(file.type || '').startsWith('image/')) return
    setBusy(true)
    setNotice(null)
    setConfirming(false)
    try {
      const compressed = await compressImage(file)
      if (!compressed) {
        setNotice({ kind: 'err', text: t('project.avatarTooLarge') }) // 零上传
        return
      }
      let uploaded = null
      try {
        uploaded = await uploadProjectAvatar(user, {
          content_type: compressed.contentType,
          data_base64: compressed.dataBase64,
        })
      } catch (error) {
        setNotice(failNotice(error, 'project.avatarUploadFail'))
        return
      }
      const next = avatarUrlOf(uploaded)
      if (!next) {
        setNotice({ kind: 'err', text: t('project.avatarUploadFail') }) // 无 id ⇒ 零 PATCH
        return
      }
      try {
        await patchAvatar(next)
      } catch (error) {
        setNotice(failNotice(error, 'project.avatarUploadFail'))
        return
      }
      onChanged?.() // 静默重拉：头像即时更新
    } catch (error) {
      // 读文件 / 解码 / canvas 异常 ⇒ 上传口未被调用（零上传）
      setNotice({ kind: 'err', text: t('project.avatarUploadFail') })
    } finally {
      setBusy(false)
    }
  }

  /** 恢复默认：行内确认后才 `PATCH {avatar_url: null}`。 */
  const resetAvatar = async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      await patchAvatar(null)
      setConfirming(false)
      onChanged?.()
    } catch (error) {
      setNotice(failNotice(error, 'project.avatarUploadFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sf-project-avatar-block" data-sf-m="project-avatar">
      <div className="sf-project-avatar">
        {raw ? (
          <img className="sf-project-avatar-img" data-sf-m="project-avatar-img" src={raw} alt="" />
        ) : (
          <span className="sf-project-avatar-initial" data-sf-m="project-avatar-initial" aria-hidden="true">
            {initial}
          </span>
        )}
        {canEdit ? (
          <button
            type="button"
            className="sf-project-avatar-change"
            data-sf-m="project-avatar-change"
            aria-label={t('project.avatarChange')}
            title={t('project.avatarChange')}
            disabled={busy}
            data-sf-busy={busy ? '1' : '0'}
            onClick={() => inputRef.current?.click()}
          >
            <Camera size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {canEdit ? (
        <>
          <input
            ref={inputRef}
            className="sf-project-avatar-input"
            type="file"
            accept="image/*"
            data-sf-m="project-avatar-input"
            onChange={onPick}
          />
          {raw && !confirming ? (
            <button
              type="button"
              className="sf-project-avatar-reset"
              data-sf-m="project-avatar-reset"
              aria-label={t('project.avatarReset')}
              disabled={busy}
              onClick={() => { setNotice(null); setConfirming(true) }}
            >
              <RotateCcw size={12} aria-hidden="true" />
              <span>{t('project.avatarReset')}</span>
            </button>
          ) : null}
          {raw && confirming ? (
            <div className="sf-project-avatar-confirm" data-sf-m="project-avatar-reset-confirm" role="group">
              <span className="sf-project-avatar-confirm-text">{t('project.avatarResetConfirm')}</span>
              <button
                type="button"
                className="sf-project-avatar-confirm-btn is-ok"
                data-sf-m="project-avatar-reset-ok"
                disabled={busy}
                onClick={resetAvatar}
              >
                <Check size={12} aria-hidden="true" />
                <span>{t('project.avatarReset')}</span>
              </button>
              <button
                type="button"
                className="sf-project-avatar-confirm-btn"
                data-sf-m="project-avatar-reset-cancel"
                onClick={() => setConfirming(false)}
              >
                <X size={12} aria-hidden="true" />
                <span>{t('project.cancel')}</span>
              </button>
            </div>
          ) : null}
          {notice?.text ? (
            <p
              className={`sf-project-avatar-notice is-${notice.kind}`}
              data-sf-m="project-avatar-notice"
              data-sf-kind={notice.kind}
              data-sf-err-code={notice.code || undefined}
              data-sf-err-reason={notice.reason || undefined}
              data-sf-err-status={notice.status ?? undefined}
              role="alert"
            >
              {notice.text}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default ProjectAvatar
