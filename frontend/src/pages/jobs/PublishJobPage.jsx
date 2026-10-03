import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { fetchAdminAccess, hasAdminPermission } from '../../admin-utils'
import { createJobPublishTracker, jobPublishFingerprint, publishJob } from './job-api'
import './jobs.css'

// 招工线 · 发布招工（§4.2 J1 · POST /api/job = **已注册**：backend-ts/src/index.ts:1314）
// 幂等键：**前端提供** `cli:` 键（服务端 fail-loud，缺键 ⇒ 400 LEDGER_IDEMPOTENCY_KEY_REQUIRED，
//   真源 backend-ts/src/job-funds-service.ts:84）。同一次操作重试 ⇒ tracker 复用同一个键。
// 金额口径：`reward` = A 类「供给侧自主出价」（§4.8.1）⇒ 客户端可传、原样透传（路由层零计算）。
// 币种：`cid` 手填（平台 $ = 1）—— **币种读口未注册**（已注册表内无 GET /api/currency*）⇒ 不作为读面依赖，登记见报告。
const PublishJobPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [form, setForm] = useState({ cid: '1', reward: '', headcount: '1', title: '', description: '' })
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const tracker = useMemo(() => createJobPublishTracker(), [])
  // 四项确认 ①：审核面 = 管理员面。权限**唯一真源** = 后端 `requireAdmin(review_tasks)`（非 admin ⇒ 403），
  //   前端不得展示入口 ⇒ 取 `/api/admin/me` 的能力集判定；能力集未回 / 无 `review_tasks` ⇒ 入口不渲染。
  const [access, setAccess] = useState(null)

  useEffect(() => {
    let alive = true
    fetchAdminAccess(user)
      .then((next) => { if (alive) setAccess(next) })
      .catch(() => { if (alive) setAccess(null) })
    return () => { alive = false }
  }, [user])

  const canReview = hasAdminPermission(access, 'review_tasks')

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  // S5①：押金提示 = 赏金 × 人数（与服务端托管额同口径：`job-funds-service.ts:181` = `reward × headcount`）。
  //   两入参任一非「数值 / 整数」⇒ 显示占位 `—`（不臆造数值；提交前另有代码闸拦非法人数）。
  const deposit = useMemo(() => {
    // 空串不得当 0（`Number('') === 0`）—— 未填即未知 ⇒ 占位 `—`
    if (String(form.reward).trim() === '' || String(form.headcount).trim() === '') return '—'
    const rewardNum = Number(form.reward)
    const headcountNum = Number(form.headcount)
    if (!Number.isFinite(rewardNum) || rewardNum < 0) return '—'
    if (!Number.isInteger(headcountNum) || headcountNum < 1) return '—'
    return String(rewardNum * headcountNum)
  }, [form.reward, form.headcount])

  const onSubmit = async (event) => {
    event.preventDefault()
    if (state.phase === 'loading') return
    // S5①：总人数 = 必填、≥1 整数（HTML `min`/`step` 只是浏览器闸，这里再给一道可测的代码闸）
    const headcountNum = Number(form.headcount)
    if (!Number.isInteger(headcountNum) || headcountNum < 1) {
      setState({ phase: 'error', message: t('jobs.headcountInvalid') })
      return
    }
    const fingerprint = jobPublishFingerprint(form)
    // 同一次用户操作（指纹不变）⇒ 同一个键；成功后 reset() ⇒ 下一次点击 = 新实体
    const createKey = tracker.keyFor(fingerprint)
    setState({ phase: 'loading', message: t('jobs.submitting') })
    try {
      const data = await publishJob({
        cid: Number(form.cid),
        reward: String(form.reward).trim(),
        headcount: String(form.headcount).trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        createKey,
        user,
      })
      tracker.reset()
      setState({ phase: 'ok', message: `${t('jobs.publishOk')} · #${data?.job_id ?? '-'}` })
    } catch (error) {
      // R107 链（auth.js apiErrorMessage）已把错误体解析成**字符串**；这里保证永不出现 [object Object]
      setState({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // F2 修复：站内链接 = 当前语言前缀 + 站内路径（唯一构造器 utils.buildLocalizedPath）
  const lang = getLanguageFromUrl(location.pathname)
  const root = (p) => buildLocalizedPath(lang, p)

  if (!isAuthenticated) {
    return (
      <div className="sf-jobs" data-sf-m="jobs-hero">
        <div className="sf-jobs-empty">{t('pleaseLogin')}</div>
      </div>
    )
  }

  return (
    <div className="sf-layout" data-sf-m="jobs-layout">
      <div className="sf-layout-main">
        <div className="sf-jobs" data-sf-m="jobs-form-wrap">
          <div className="sf-jobs-head" data-sf-m="jobs-hero">
            <h1 className="sf-jobs-title">{t('jobs.publish')}</h1>
            <p className="sf-jobs-note">{t('jobs.cidNote')}</p>
            <div className="sf-jobs-actions">
              <Link className="sf-jobs-link" to={root('/task')}>{t('jobs.list')}</Link>
              {/* 审核入口按权限隐藏（四项确认 ①）：非 admin 不渲染（后端 403 只是兜底，不是首屏反馈） */}
              {canReview && <Link className="sf-jobs-link" to={root('/task/review')} data-sf-m="jobs-review-link">{t('jobs.review')}</Link>}
            </div>
          </div>

          <form className="sf-jobs-panel" onSubmit={onSubmit} data-sf-m="jobs-form">
            <div className="sf-jobs-form">
              <label className="sf-jobs-field">
                <span className="sf-jobs-label">{t('jobs.title')}</span>
                <input className="sf-jobs-input" data-sf-m="jobs-input-title" value={form.title} onChange={setField('title')} required />
              </label>
              <label className="sf-jobs-field">
                <span className="sf-jobs-label">{t('jobs.reward')}</span>
                <input className="sf-jobs-input" data-sf-m="jobs-input-reward" value={form.reward} onChange={setField('reward')} inputMode="numeric" required />
              </label>
              <label className="sf-jobs-field">
                <span className="sf-jobs-label">{t('jobs.headcount')}</span>
                <input className="sf-jobs-input" data-sf-m="jobs-input-headcount" value={form.headcount} onChange={setField('headcount')} type="number" inputMode="numeric" min="1" step="1" required />
              </label>
              <label className="sf-jobs-field">
                <span className="sf-jobs-label">{t('jobs.cid')}</span>
                <input className="sf-jobs-input" data-sf-m="jobs-input-cid" value={form.cid} onChange={setField('cid')} inputMode="numeric" required />
              </label>
              <label className="sf-jobs-field sf-jobs-field-wide">
                <span className="sf-jobs-label">{t('jobs.description')}</span>
                <textarea className="sf-jobs-textarea" data-sf-m="jobs-input-note" value={form.description} onChange={setField('description')} rows={3} />
              </label>
              {/* S5①：押金提示 = 赏金 × 人数（就地展示在金额/人数之后；沿用既有 meta 文案样式，不重设视觉） */}
              <p className="sf-jobs-meta sf-jobs-field-wide" data-sf-m="jobs-deposit-hint">
                {t('jobs.depositHint', { deposit, reward: form.reward || '—', headcount: form.headcount || '—' })}
              </p>
            </div>
            <div className="sf-jobs-row">
              <button className="sf-btn sf-jobs-btn" type="submit" data-sf-m="jobs-primary" disabled={state.phase === 'loading'}>
                {state.phase === 'loading' ? t('jobs.submitting') : t('jobs.publish')}
              </button>
              <span
                className={`sf-jobs-status${state.phase === 'error' ? ' sf-jobs-err' : ''}${state.phase === 'ok' ? ' sf-jobs-ok' : ''}`}
                data-sf-m="jobs-status"
                role="status"
                data-sf-phase={state.phase}
              >
                {state.message}
              </span>
            </div>
          </form>
        </div>
      </div>
      <div className="sf-layout-side">
        <div className="sf-jobs-panel" data-sf-m="jobs-side">
          <h2 className="sf-jobs-title">{t('jobs.line')}</h2>
          <p className="sf-jobs-meta">{t('jobs.publishNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default PublishJobPage
