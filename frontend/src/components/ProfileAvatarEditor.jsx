import React, { useRef, useState } from 'react'
import { Camera, Check, RotateCcw, X } from 'lucide-react'
import { compressImage } from '../image-compress'
import { avatarInitialOf, avatarToneOf } from '../avatar-tone'
import { updateMyProfile } from '../auth'
import { uploadMedia } from '../pages/item/item-api'
import { errPartsOf } from '../pages/project/project-error'

// ============================================================================
// 用户头像编辑器（Kevin 2026-10-22：`/profile/settings` 要有改头像的入口）
// ----------------------------------------------------------------------------
// 落点：账户设置 pane **顶部**（`ProfilePage` 的 `settings-view` 首块）。
// 形态（与项目页头像 `pages/project/ProjectAvatar` 同一视觉语言）：
//   · 64px 圆形头像 —— 有 `user.avatar_url` ⇒ `<img>`（`object-fit:cover`）；
//     无（null / 空串 / 非串）⇒ 地址首字 + `--sf-thumb-N` 彩底（**零新色值**：
//     档位/首字取共享纯函数 `src/avatar-tone.js`，与首页热门任务卡 / /wage 卡头同源）；
//   · 右下角 28px 圆形相机钮（真 `<button>`、`aria-label` 可读、≥24px 触控下限）
//     ⇒ 触发隐藏 `<input type=file accept=image/*>`；
//   · 已有头像时给【恢复默认】行内二次确认（提示 + 确认/取消），确认才写 `null`。
//
// 上传流水线（复用既有三段，禁另起炉灶）：
//   选图 ⇒ `compressImage`（`src/image-compress.js`，与发布页 / 项目头像**同一份**实现）
//   ⇒ `POST /api/media`（`uploadMedia`，与项目头像同一个媒体口）
//   ⇒ `POST /api/user/profile { avatar_url: '/api/media/<id>' }`（**只带头像键**；后端
//   `bio` 缺席 ⇒ 简介不动、零译文入队）。
//   成功后 `onChanged(payload)`（父层 `updateSession` 刷会话 ⇒ 全站头像即时更新），
//   **无成功弹窗**（沿项目头像的静默刷新体例）。
//
// 失败可见性（复用 `pages/project/project-error` 的机读三件体例）：
//   · 压缩后全档位仍 >1MiB（`compressImage` 返 `null`）⇒ `project.avatarTooLarge`，**零上传零写**；
//   · 解码/编码异常、媒体口无 id ⇒ `project.avatarUploadFail`，零写；
//   · 上传口 / 写口带 `code` / `details.reason` / HTTP 状态（本单新增 `AVATAR_URL_INVALID`）
//     ⇒ 文案拼「失败：<reason|code>（HTTP n）」，**行内**渲染，并带
//     `data-sf-err-code` / `data-sf-err-reason` / `data-sf-err-status` 取证字段。
//
// i18n：文案**全部复用**既有 `project.avatar*` 五键（四语文案本就是通用口径，例如
//   `avatarChange` = 「更换头像」/「Change avatar」）—— 刻意**不新增键**：本单零 i18n
//   键集变更 ⇒ 不牵动四语拍平计数断言（详见交付报告「i18n 键集零变更」）。
// ============================================================================

/** 媒体口返回 ⇒ `/api/media/<id>`（优先 `media_id`；旧面只有 `url` 时从 url 里取 id）。 */
const avatarUrlOf = (payload) => {
  const id = payload?.media_id ?? payload?.mediaId ?? payload?.id
  if (id !== null && id !== undefined && String(id).trim()) return `/api/media/${String(id).trim()}`
  const hit = String(payload?.url || '').match(/\/api\/media\/([^/?#]+)/)
  return hit ? `/api/media/${hit[1]}` : ''
}

/** 用户展示名：站内无昵称 ⇒ 用 EVM（`0x` 之后为首字来源；无地址 ⇒ 空串 ⇒ '?'）。 */
const addressOf = (user) => String(user?.EVM || user?.evm || '').trim()

const ProfileAvatarEditor = ({ user, t, onChanged }) => {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { kind:'err', text, code?, reason?, status? }
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef(null)

  const address = addressOf(user)
  const raw = typeof user?.avatar_url === 'string' ? user.avatar_url.trim() : ''
  // 首字 = 地址（去 `0x`）首个码点：每位用户不同；档位 = 地址逐字符码点和（跨端稳定）
  const initial = avatarInitialOf(address.replace(/^0x/i, ''))
  const tone = raw ? 0 : avatarToneOf(address)

  const noticeOf = (error, fallbackKey) => {
    const { code, reason, status } = errPartsOf(error)
    const detail = reason || code || ''
    // 无错误体（网络断 / 无 code 且无 reason / 无 HTTP 状态）⇒ 本地口径文案，不硬编假事实；
    // 有错误体 ⇒ 文案仍走本地化兜底句，机读三件单列一行（`AVATAR_URL_INVALID · HTTP 400`）——
    // 与 `pages/project/project-error.writeFailNotice` 同体例：机读码比假翻译更有用，且能被探针对拍。
    if (!detail || status === null) return { kind: 'err', text: t(fallbackKey), code, reason, status }
    return {
      kind: 'err',
      text: t(fallbackKey),
      detail: `${detail} · HTTP ${status}`,
      code,
      reason,
      status,
    }
  }

  /** 选图 ⇒ 压缩 ⇒ 上传 ⇒ 写口 ⇒ 父层刷会话。任一步失败都**不改判**头像，只内联提示。 */
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
        uploaded = await uploadMedia(user, {
          content_type: compressed.contentType,
          data_base64: compressed.dataBase64,
        })
      } catch (error) {
        setNotice(noticeOf(error, 'project.avatarUploadFail'))
        return
      }
      const next = avatarUrlOf(uploaded)
      if (!next) {
        setNotice({ kind: 'err', text: t('project.avatarUploadFail') }) // 无 id ⇒ 零写
        return
      }
      let payload = null
      try {
        // 只带头像键：后端 `bio` 缺席 ⇒ 简介不动（也不入译文队列）
        payload = await updateMyProfile({ avatar_url: next }, user)
      } catch (error) {
        setNotice(noticeOf(error, 'project.avatarUploadFail'))
        return
      }
      onChanged?.(payload) // 静默刷新用户上下文
    } catch (error) {
      // 读文件 / 解码 / canvas 异常 ⇒ 媒体口未被调用（零上传）
      setNotice({ kind: 'err', text: t('project.avatarUploadFail') })
    } finally {
      setBusy(false)
    }
  }

  /** 恢复默认：行内确认后才 `POST {avatar_url: null}`（唯一清空入口）。 */
  const resetAvatar = async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const payload = await updateMyProfile({ avatar_url: null }, user)
      setConfirming(false)
      onChanged?.(payload)
    } catch (error) {
      setNotice(noticeOf(error, 'project.avatarUploadFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sf-prof-avatar-block" data-sf-m="profile-avatar-block">
      <div
        className="sf-prof-avatar"
        data-sf-m="profile-avatar"
        data-sf-avatar={raw ? 'img' : 'initial'}
        data-sf-tone={raw ? undefined : String(tone)}
      >
        {raw ? (
          <img className="sf-prof-avatar-img" data-sf-m="profile-avatar-img" src={raw} alt="" />
        ) : (
          <span className="sf-prof-avatar-initial" data-sf-m="profile-avatar-initial" aria-hidden="true">
            {initial}
          </span>
        )}
        <button
          type="button"
          className="sf-prof-avatar-change"
          data-sf-m="profile-avatar-change"
          aria-label={t('project.avatarChange')}
          title={t('project.avatarChange')}
          disabled={busy}
          data-sf-busy={busy ? '1' : '0'}
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="sf-prof-avatar-side">
        <input
          ref={inputRef}
          className="sf-prof-avatar-input"
          type="file"
          accept="image/*"
          data-sf-m="profile-avatar-input"
          onChange={onPick}
        />
        <p className="sf-prof-avatar-addr" data-sf-m="profile-avatar-addr">{address}</p>
        {raw && !confirming ? (
          <button
            type="button"
            className="sf-prof-avatar-reset"
            data-sf-m="profile-avatar-reset"
            aria-label={t('project.avatarReset')}
            disabled={busy}
            onClick={() => { setNotice(null); setConfirming(true) }}
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>{t('project.avatarReset')}</span>
          </button>
        ) : null}
        {raw && confirming ? (
          <div className="sf-prof-avatar-confirm" data-sf-m="profile-avatar-reset-confirm" role="group">
            <span className="sf-prof-avatar-confirm-text">{t('project.avatarResetConfirm')}</span>
            <button
              type="button"
              className="sf-prof-avatar-confirm-btn is-ok"
              data-sf-m="profile-avatar-reset-ok"
              disabled={busy}
              onClick={resetAvatar}
            >
              <Check size={12} aria-hidden="true" />
              <span>{t('project.avatarReset')}</span>
            </button>
            <button
              type="button"
              className="sf-prof-avatar-confirm-btn"
              data-sf-m="profile-avatar-reset-cancel"
              onClick={() => setConfirming(false)}
            >
              <X size={12} aria-hidden="true" />
              <span>{t('cancel')}</span>
            </button>
          </div>
        ) : null}
        {notice?.text ? (
          <p
            className={`sf-prof-avatar-notice is-${notice.kind}`}
            data-sf-m="profile-avatar-notice"
            data-sf-kind={notice.kind}
            data-sf-err-code={notice.code || undefined}
            data-sf-err-reason={notice.reason || undefined}
            data-sf-err-status={notice.status ?? undefined}
            role="alert"
          >
            <span>{notice.text}</span>
            {notice.detail ? (
              <span className="sf-prof-avatar-notice-detail" data-sf-m="profile-avatar-notice-detail">
                {notice.detail}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default ProfileAvatarEditor
