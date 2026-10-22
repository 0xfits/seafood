import React, { useState } from 'react'
import { useAuth } from '../../auth-context'
import { slugFieldErrorOf } from '../../project-slug'
import { patchProject } from './project-api'
import {
  buildEditPayload,
  errsOfPatchFailure,
  slugSubmitErrorOf,
  validateEditForm,
} from './project-edit-form'
import ProjectModalShell, { FieldError, useProjectFormState } from './ProjectModalShell'

// ============================================================================
// 项目编辑模态框（Kevin 2026-10-21② 搬迁 + 2026-10-22③ **拆出招工面**）
// ----------------------------------------------------------------------------
// 口径（拆框后）：
//   · 入口在项目页操作区【编辑项目】（可见性由父组件判：已登录 ∧ 未 ended ∧ (owner ∨ manage_tasks)）；
//     本组件只在该入口被点后挂载 ⇒ 挂载 = 打开、卸载 = 关闭。
//   · **字段只剩项目面**：标题 / 说明 / 项目地址 slug（实时格式+保留字）/ 状态 recruiting⇄working。
//     招工面 6 键（人数 / 注册天数 / 每次工资 / 间隔 / 次币 cid + 金额）已移入 `ProjectRecruitModal`
//     —— 两框互不嵌套、各自提交（Kevin 2026-10-22③）。
//   · 载荷**只带变化字段**（`project-edit-form.buildEditPayload`，键集 = `PROJECT_PAYLOAD_KEYS`）；
//     无变化 ⇒ 零请求直接关闭；成功 ⇒ `onSaved({kind:'ok', text, slug})` —— `slug` = **地址改过时的新值**
//     （父组件据此 `navigate` 到新地址，否则旧地址会落 404）；409/400 ⇒ `EDIT_REASON_MAP` 框内字段级内联。
//   · 外壳（背板 / ✕ / Esc / 滚动锁 / 几何）与【招工】共用 `ProjectModalShell`（单一实现）。
// ============================================================================

/** 项目写面标识：只认数字主键 `project_id`（缺失才回落 `snowflake_id`，与 /wage 同式）。 */
const projectKeyOf = (row) => String(row?.project_id ?? row?.snowflake_id ?? '')

const ProjectEditModal = ({ view, t, onClose, onSaved }) => {
  const { user } = useAuth()
  const { form, errs, setErrs, setField } = useProjectFormState(view)
  const [busy, setBusy] = useState(false)
  const projectRef = projectKeyOf(view)

  const requestClose = () => {
    if (busy) return
    onClose?.()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    // slug 前置校验：格式 / 保留字 / 清空已设地址 ⇒ 框内内联，不空发请求
    const slugErr = slugSubmitErrorOf(view, form, t)
    if (slugErr) {
      setErrs({ slug: slugErr })
      return
    }
    const nextErrs = validateEditForm(form, t)
    if (Object.keys(nextErrs).length > 0) {
      setErrs(nextErrs)
      return
    }
    const body = buildEditPayload(view, form)
    if (Object.keys(body).length === 0) {
      // 无变化 ⇒ 零请求关闭（「只带变化字段」口径下没有可发的键）
      requestClose()
      return
    }
    setBusy(true)
    setErrs({})
    try {
      await patchProject(projectRef, body, user)
      onSaved?.({
        kind: 'ok',
        text: t('wage.editSaved'),
        // 地址改过 ⇒ 新 slug 交父组件跳转（未改 ⇒ null，父组件只静默重拉）
        slug: typeof body.slug === 'string' && body.slug ? body.slug : null,
      })
    } catch (error) {
      setErrs(errsOfPatchFailure(error, t))
    } finally {
      setBusy(false)
    }
  }

  const slugLive = slugFieldErrorOf(form.slug)
  const statusOptions = form.status === 'working' ? ['working', 'recruiting'] : ['recruiting', 'working']

  return (
    <ProjectModalShell
      kind="project-edit"
      projectRef={projectRef}
      title={t('wage.editTitle')}
      busy={busy}
      labels={{ save: t('common.save'), saving: t('wage.saving'), cancel: t('wage.cancel') }}
      onClose={requestClose}
      onSubmit={submit}
    >
      <label className="sf-project-field">
        <span className="sf-project-field-label">{t('bountyProject.title')}</span>
        <input
          className="sf-project-input"
          data-sf-edit="title"
          maxLength={200}
          value={form.title}
          onChange={(event) => setField('title', event.target.value)}
        />
        <FieldError field="title" text={errs.title} />
      </label>

      <label className="sf-project-field">
        <span className="sf-project-field-label">{t('bountyProject.description')}</span>
        <textarea
          className="sf-project-input"
          data-sf-edit="description"
          rows={3}
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
        />
        <FieldError field="description" text={errs.description} />
      </label>

      {/* 项目地址（slug）：用户可填的项目地址名（页面规范形 `/<slug>`）；实时校验格式与保留字
          （单一真源 `src/project-slug.js`），冲突由后端 400 `SLUG_TAKEN` 框内内联提示。
          保存成功且地址变化 ⇒ 父组件 `navigate('/'+新slug, {replace:true})`（旧地址不留 404）。 */}
      <label className="sf-project-field">
        <span className="sf-project-field-label">{t('project.slugLabel')}</span>
        <input
          className="sf-project-input"
          data-sf-edit="slug"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          value={form.slug}
          onChange={(event) => setField('slug', event.target.value)}
        />
        {errs.slug ? (
          <FieldError field="slug" text={errs.slug} />
        ) : slugLive ? (
          <span className="sf-project-edit-err" data-sf-edit-err="slug" role="alert">
            {t(slugLive === 'reserved' ? 'project.errSlugReserved' : 'project.errSlugFormat')}
          </span>
        ) : null}
        <span className="sf-project-edit-hint" data-sf-edit-hint="slug">{t('project.slugHint')}</span>
      </label>

      <label className="sf-project-field">
        <span className="sf-project-field-label">{t('wage.fieldStatus')}</span>
        <select
          className="sf-project-input"
          data-sf-edit="status"
          value={form.status}
          onChange={(event) => setField('status', event.target.value)}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{t(s === 'working' ? 'common.ongoing' : 'wage.statusRecruiting')}</option>
          ))}
        </select>
        <FieldError field="status" text={errs.status} />
      </label>

      {errs.general ? (
        <p className="sf-project-edit-err" data-sf-edit-err="general" role="alert">{errs.general}</p>
      ) : null}
    </ProjectModalShell>
  )
}

export default ProjectEditModal
