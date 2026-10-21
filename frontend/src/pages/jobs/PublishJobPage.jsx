import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { RECRUIT_MIN_DAYS_DEFAULT, RECRUIT_MIN_DAYS_OPTIONS } from '../../recruit-min-days'
import { slugFieldErrorOf } from '../../project-slug'
import {
  createJobPublishTracker,
  createProject,
  createProjectPublishTracker,
  fetchCurrencies,
  fetchProjectList,
  hasOwnedProject,
  jobPublishFingerprint,
  projectCreateFingerprint,
  publishJob,
} from './job-api'
import './jobs.css'

// 悬赏线 · 发布悬赏（§4.2 J1 · POST /api/job = **已注册**：backend-ts/src/index.ts:1314）
// 幂等键：**前端提供** `cli:` 键（服务端 fail-loud，缺键 ⇒ 400 LEDGER_IDEMPOTENCY_KEY_REQUIRED，
//   真源 backend-ts/src/job-funds-service.ts:84）。同一次操作重试 ⇒ tracker 复用同一个键。
// 金额口径：`reward` = A 类「供给侧自主出价」（§4.8.1）⇒ 客户端可传、原样透传（路由层零计算）。
// 币种：下拉选择（读口 `GET /api/currencies`，公开只读，仅 `status='listed'`）；旧手填 `jobs-input-cid` 已下线。
//   显示文本 = `${symbol}${name ? ' · ' + name : ''}`（**不显示编号**）；默认 `'1'`（平台 $，与旧默认一致）。
//   加载失败 / 空列表 ⇒ **回退仅 $（cid 1）一项**，表单照常可提交（不白屏、不禁用提交、零新增文案键）。
// 注册天数条件（Kevin 2026-10-21）：手填 number 改**四选一 select**（1/7/30/365，常量真源
//   `src/recruit-min-days.js` 两处表单共用），默认「一天」；后端 `recruit_min_account_days` int ≥0 不变。
const DEFAULT_CID = '1'

/**
 * ★ Kevin 2026-10-21 需求②：发布悬赏**先要在管项目**（悬赏酬金由项目方托管）。
 * 判据（公开读口 `GET /api/project/all`，行含 `owner_uid`）：
 *   · 有 ⇒ 行 `owner_uid === 当前 uid ∧ status !== 'ended'` ⇒ **正常渲染发布表单**（行为不变）；
 *   · 无 ⇒ **不渲染发布表单**，改渲染阻断面板（`jobs-project-gate`）：一句「发布悬赏需要先拥有一个项目」
 *     ＋【新建项目】入口（点开即**内嵌**表单：标题 / 说明 / 招工人数 / 注册天数条件 / batt 工资每次 /
 *     领取间隔 1–100 小时 / 可选次币 cid + 金额）⇒ `POST /api/project` 成功后**重跑判定**、
 *     直接落到发布悬赏表单。
 * 双保险：后端即将加硬闸（无项目发布 ⇒ 403 `reason=project_required`）⇒ 发布口收到该错误时
 *   也**转入阻断面板**并顺手展开建项目表单（`error.details.reason` 由 `fetchApiJson` 附在 Error 上）。
 * 读取失败（网络 / 5xx）⇒ **fail-open**：按「有项目」渲染表单，真正的闸交给服务端 403 兜底
 *   —— 不因为一次读口抖动就把所有人挡在门外。
 */
const FALLBACK_CURRENCIES = [{ cid: 1, symbol: '$', name: '' }]
const INTERVAL_MIN = 1
const INTERVAL_MAX = 100

/** 币种选项显示文本：`symbol · name`；**不显示编号**（`cid` 只作 value）。 */
const currencyLabel = (row) => {
  const symbol = String(row?.symbol ?? '')
  const name = typeof row?.name === 'string' ? row.name : ''
  return `${symbol}${name ? ` · ${name}` : ''}`
}

const PublishJobPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [form, setForm] = useState({ cid: DEFAULT_CID, reward: '', headcount: '1', title: '', description: '' })
  const [state, setState] = useState({ phase: 'idle', message: '' })
  const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES)
  const tracker = useMemo(() => createJobPublishTracker(), [])

  // ---- 项目准入（需求②） -----------------------------------------------------
  // phase：`checking` 判定中 / `ok` 有在管项目（= 渲染发布表单）/ `blocked` 无在管项目（= 阻断面板）
  const [gate, setGate] = useState({ phase: 'checking' })
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectState, setProjectState] = useState({ phase: 'idle', message: '' })
  const [projectForm, setProjectForm] = useState({
    title: '', description: '', headcount: '1',
    // 项目地址 slug（Kevin 2026-10-21）：用户可填的项目地址名（页面规范形 `/<slug>`，如 sui）
    slug: '',
    // 注册天数条件 = 四选一 select，默认「一天」（1）——原 number 手填可 0，改枚举后最小即 1 天
    minDays: String(RECRUIT_MIN_DAYS_DEFAULT),
    battPerClaim: '', intervalHours: '24', cid: '', currencyAmount: '',
  })
  const projectTracker = useMemo(() => createProjectPublishTracker(), [])
  const uidKey = String(user?.uID ?? user?.uid ?? '')
  // 项目地址实时校验（Kevin 2026-10-21）：格式 / 保留字（单一真源 `src/project-slug.js`）；
  // 留空 = 不填（不上送 slug 键），后端 400 `SLUG_TAKEN` 仍走错误文案内联。
  const projectSlugKind = slugFieldErrorOf(projectForm.slug)
  const projectSlugErr = projectSlugKind
    ? t(projectSlugKind === 'reserved' ? 'project.errSlugReserved' : 'project.errSlugFormat')
    : ''

  const checkGate = useCallback(async () => {
    if (!isAuthenticated || !uidKey) return
    setGate({ phase: 'checking' })
    try {
      const rows = await fetchProjectList(user)
      const owned = hasOwnedProject(rows, uidKey)
      setGate({ phase: owned ? 'ok' : 'blocked' })
    } catch (error) {
      // 读口失败 ⇒ fail-open（不因一次抖动挡住发布）；服务端 403 project_required 仍是最终闸
      console.warn('Failed to resolve project gate:', error)
      setGate({ phase: 'ok' })
    }
  }, [isAuthenticated, uidKey, user])

  useEffect(() => { checkGate() }, [checkGate])

  // 币种选项：挂载时取一次（公开读口 ⇒ 无 token 也返回）。任一路失败都**回退 $**、绝不拦提交。
  useEffect(() => {
    let cancelled = false
    fetchCurrencies(user)
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows)
          ? rows.filter((row) => row && row.cid !== undefined && row.cid !== null && String(row.cid) !== '')
          : []
        if (!list.length) {
          setCurrencies(FALLBACK_CURRENCIES)
          return
        }
        setCurrencies(list)
        // 默认值不在返回列表里 ⇒ 选第一项（否则 select 会停在空值、提交 `Number('')` = 0）。
        setForm((prev) => (
          list.some((row) => String(row.cid) === String(prev.cid))
            ? prev
            : { ...prev, cid: String(list[0].cid) }
        ))
      })
      .catch(() => {
        if (!cancelled) setCurrencies(FALLBACK_CURRENCIES)
      })
    return () => { cancelled = true }
    // 刻意只跑一次（挂载时）：选项来源是公开只读面，不随登录态变化而重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // ★ S18（本单）：审核入口改「**已登录即可见**」，与 `/task/review`（S17a）同口径。
  //   S16 后端已把待审队列读口准入放宽为「admin（持 `review_tasks`）∨ 已登录」（非 admin 只返回其
  //   `job.employer_uid` 命中的 pending 提交；过滤唯一真源 = 后端 `resolveReviewQueueScope`）⇒
  //   前端入口**不得**再按 `review_tasks` 隐藏（改前真源 = 取 `/api/admin/me` 能力集判定）。
  //   ★ 不另写过滤；未登录 ⇒ 下方 `!isAuthenticated` 早返回（渲染 `pleaseLogin`、不渲染入口）。
  const canReview = isAuthenticated

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const setProjectField = (key) => (event) => setProjectForm((prev) => ({ ...prev, [key]: event.target.value }))

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
      // ★ 需求②双保险：后端硬闸（无在管项目 ⇒ 403 `reason=project_required`）⇒ 转阻断面板 + 展开建项目表单。
      //   判据只认机读 `details.reason`（`fetchApiJson` 已把它附在 Error 上），不解析文案。
      if (String(error?.details?.reason ?? '') === 'project_required') {
        setState({ phase: 'idle', message: '' })
        setGate({ phase: 'blocked' })
        setShowProjectForm(true)
        return
      }
      // R107 链（auth.js apiErrorMessage）已把错误体解析成**字符串**；这里保证永不出现 [object Object]
      setState({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  // 建项目（内嵌表单）：服务端字段名见 `job-api.js` 注释；成功后**重跑准入判定** ⇒ 直接落发布表单。
  const onSubmitProject = async (event) => {
    event.preventDefault()
    if (projectState.phase === 'loading') return
    const headcountNum = Number(projectForm.headcount)
    if (!Number.isInteger(headcountNum) || headcountNum < 1) {
      setProjectState({ phase: 'error', message: t('jobs.headcountInvalid') })
      return
    }
    const intervalNum = Number(projectForm.intervalHours)
    if (!Number.isInteger(intervalNum) || intervalNum < INTERVAL_MIN || intervalNum > INTERVAL_MAX) {
      setProjectState({ phase: 'error', message: t('bountyProject.intervalInvalid') })
      return
    }
    // 项目地址（slug，Kevin 2026-10-21）：格式 / 保留字客户端先拦（留空 = 不填、不上送该键）
    const slugKind = slugFieldErrorOf(projectForm.slug)
    if (slugKind) {
      setProjectState({
        phase: 'error',
        message: t(slugKind === 'reserved' ? 'project.errSlugReserved' : 'project.errSlugFormat'),
      })
      return
    }
    const createKey = projectTracker.keyFor(projectCreateFingerprint(projectForm))
    setProjectState({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await createProject({ ...projectForm, createKey, user })
      projectTracker.reset()
      setProjectState({ phase: 'ok', message: t('bountyProject.createOk') })
      setShowProjectForm(false)
      await checkGate()
    } catch (error) {
      // 409（余额不足建费）/ 400（字段非法）⇒ 内联提示，表单保持可编辑、不清空
      setProjectState({ phase: 'error', message: String(error?.message || t('error')) })
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

  // ---- 内嵌「新建项目」表单（阻断面板内展开；可填可提、错误内联） --------------
  const projectFormNode = (
    <form className="sf-jobs-panel" onSubmit={onSubmitProject} data-sf-m="jobs-project-form">
      <div className="sf-jobs-form">
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('bountyProject.title')}</span>
          <input className="sf-jobs-input" data-sf-m="jobs-project-input-title" value={projectForm.title} onChange={setProjectField('title')} required />
        </label>
        {/* 项目地址（slug，Kevin 2026-10-21）：用户可填的项目地址名（页面规范形 `/<slug>`）；
            实时校验格式与保留字（单一真源 `src/project-slug.js`）；冲突由后端 400 SLUG_TAKEN 内联。 */}
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('project.slugLabel')}</span>
          <input
            className="sf-jobs-input"
            data-sf-m="jobs-project-input-slug"
            value={projectForm.slug}
            onChange={setProjectField('slug')}
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            placeholder="sui"
          />
          {projectSlugErr ? (
            <span className="sf-jobs-status sf-jobs-err" data-sf-m="jobs-project-slug-err" role="alert">{projectSlugErr}</span>
          ) : null}
        </label>
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('bountyProject.headcount')}</span>
          <input className="sf-jobs-input" data-sf-m="jobs-project-input-headcount" value={projectForm.headcount} onChange={setProjectField('headcount')} type="number" inputMode="numeric" min="1" step="1" required />
        </label>
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('bountyProject.minDays')}</span>
          {/* ★ Kevin 2026-10-21：注册天数条件改四选一 select（value = 天数 1/7/30/365，常量真源
              `src/recruit-min-days.js`）；旧 number 手填（min=0）已下线，默认「一天」。 */}
          <select
            className="sf-jobs-input"
            data-sf-m="jobs-project-select-min-days"
            value={projectForm.minDays}
            onChange={setProjectField('minDays')}
          >
            {RECRUIT_MIN_DAYS_OPTIONS.map((opt) => (
              <option key={opt.days} value={String(opt.days)}>{t(`bountyProject.${opt.key}`)}</option>
            ))}
          </select>
        </label>
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('bountyProject.battPerClaim')}</span>
          <input className="sf-jobs-input" data-sf-m="jobs-project-input-batt" value={projectForm.battPerClaim} onChange={setProjectField('battPerClaim')} inputMode="decimal" required />
        </label>
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('bountyProject.intervalHours')}</span>
          <input className="sf-jobs-input" data-sf-m="jobs-project-input-interval" value={projectForm.intervalHours} onChange={setProjectField('intervalHours')} type="number" inputMode="numeric" min={INTERVAL_MIN} max={INTERVAL_MAX} step="1" required />
        </label>
        <label className="sf-jobs-field">
          <span className="sf-jobs-label">{t('bountyProject.currency')}</span>
          <select className="sf-jobs-input" data-sf-m="jobs-project-select-cid" value={projectForm.cid} onChange={setProjectField('cid')}>
            <option value="">{t('bountyProject.noCurrency')}</option>
            {currencies.map((row) => (
              <option key={String(row.cid)} value={String(row.cid)}>{currencyLabel(row)}</option>
            ))}
          </select>
        </label>
        {projectForm.cid !== '' && (
          <label className="sf-jobs-field">
            <span className="sf-jobs-label">{t('bountyProject.currencyAmount')}</span>
            <input className="sf-jobs-input" data-sf-m="jobs-project-input-amount" value={projectForm.currencyAmount} onChange={setProjectField('currencyAmount')} inputMode="decimal" required />
          </label>
        )}
        <label className="sf-jobs-field sf-jobs-field-wide">
          <span className="sf-jobs-label">{t('bountyProject.description')}</span>
          <textarea className="sf-jobs-textarea" data-sf-m="jobs-project-input-description" value={projectForm.description} onChange={setProjectField('description')} rows={3} />
        </label>
      </div>
      <div className="sf-jobs-row">
        <button className="sf-btn sf-jobs-btn" type="submit" data-sf-m="jobs-project-submit" disabled={projectState.phase === 'loading'}>
          {projectState.phase === 'loading' ? t('jobs.submitting') : t('bountyProject.createProject')}
        </button>
        <button className="sf-btn sf-jobs-btn" type="button" data-sf-m="jobs-project-cancel" onClick={() => setShowProjectForm(false)}>
          {t('cancel')}
        </button>
        <span
          className={`sf-jobs-status${projectState.phase === 'error' ? ' sf-jobs-err' : ''}${projectState.phase === 'ok' ? ' sf-jobs-ok' : ''}`}
          data-sf-m="jobs-project-status"
          role="status"
          data-sf-phase={projectState.phase}
        >
          {projectState.message}
        </span>
      </div>
    </form>
  )

  return (
    <div className="sf-layout" data-sf-m="jobs-layout">
      <div className="sf-layout-main">
        <div className="sf-jobs" data-sf-m="jobs-form-wrap">
          <div className="sf-jobs-head" data-sf-m="jobs-hero">
            <h1 className="sf-jobs-title">{t('jobs.publish')}</h1>
            <p className="sf-jobs-note">{t('jobs.cidNote')}</p>
            <div className="sf-jobs-actions">
              <Link className="sf-jobs-link" to={root('/task')}>{t('jobs.list')}</Link>
              {/* ★ S18：审核入口 = 已登录即可见（与 `/task/review` 同口径）；未登录 ⇒ 上方早返回、此处不渲染 */}
              {canReview && <Link className="sf-jobs-link" to={root('/task/review')} data-sf-m="jobs-review-link">{t('jobs.review')}</Link>}
            </div>
          </div>

          {/* 准入判定中：既不出表单也不出阻断面板（避免误填/误拦） */}
          {gate.phase === 'checking' && (
            <div className="sf-jobs-panel" data-sf-m="jobs-project-checking">
              <p className="sf-jobs-meta">{t('common.loadingTasks')}</p>
            </div>
          )}

          {/* 无在管项目 ⇒ 阻断面板（不渲染发布表单）＋【新建项目】内嵌表单 */}
          {gate.phase === 'blocked' && (
            <div className="sf-jobs-panel" data-sf-m="jobs-project-gate">
              <p className="sf-jobs-item-title" data-sf-m="jobs-project-gate-text">{t('bountyProject.needProject')}</p>
              <p className="sf-jobs-meta">{t('bountyProject.needProjectHint')}</p>
              <div className="sf-jobs-row">
                <button
                  className="sf-btn sf-jobs-btn"
                  type="button"
                  data-sf-m="jobs-project-open"
                  aria-expanded={showProjectForm}
                  onClick={() => setShowProjectForm((prev) => !prev)}
                >
                  {t('bountyProject.createProject')}
                </button>
                {!showProjectForm && projectState.phase === 'ok' && (
                  <span className="sf-jobs-status sf-jobs-ok" data-sf-m="jobs-project-status" role="status" data-sf-phase={projectState.phase}>{projectState.message}</span>
                )}
              </div>
              {showProjectForm && projectFormNode}
            </div>
          )}

          {/* 有在管项目 ⇒ 正常发布表单（行为不变） */}
          {gate.phase === 'ok' && (
            <>
              {projectState.phase === 'ok' && (
                <p className="sf-jobs-meta sf-jobs-ok" data-sf-m="jobs-project-created">{projectState.message}</p>
              )}
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
                    <select className="sf-jobs-input" data-sf-m="jobs-select-cid" value={form.cid} onChange={setField('cid')} required>
                      {currencies.map((row) => (
                        <option key={String(row.cid)} value={String(row.cid)}>{currencyLabel(row)}</option>
                      ))}
                    </select>
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
            </>
          )}
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
