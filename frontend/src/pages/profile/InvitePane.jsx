import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui'
import OtpInput from '../../components/OtpInput'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { bindReferral, fetchMyReferral } from '../../referral-api'

// ============================================================================
// 【我的邀请】pane（`/profile/invite` · Kevin 2026-10-24 需求）
// ----------------------------------------------------------------------------
// 位置：左栏菜单「我的收藏」之后、「账户设置」之前（见 ProfilePage 的 navLink 序列）。
// 形态：**苹果验证码式 6 格数字输入**（`components/OtpInput`）——
//   · 前导零口径：**6 位定宽**，`000100` = uid `100`（去前导零后按整数解析）；
//     **全 0 / 解析后 < 1 ⇒ 无效**（不请求后端，卡内内联提示）。
//   · 已绑定态：显示「已绑定邀请人 **000100**」（按 6 位补零展示）+ 输入区 `disabled`
//     + 只读提示；**不可改绑**（库面 `referral.child_uid` 是主键，一次性）。
//   · 成功 ⇒ **Toast**（承 design `T126` 口径：一次性变更的成功反馈走 Toast，时长 5000ms）；
//   · 失败 ⇒ **卡内内联**（`invite-error`，`role="alert"`；不弹 Toast、不白屏）。
// 钩子（探针）：invite-pane / invite-login / invite-otp（+ `-cell-<i>`）/ invite-submit /
//   invite-bound-uid / invite-error。
// i18n：新增键 = `profileNav.invite` + `invite.{desc,label,bound,boundHint,submit,ok,err}`
//   （共 8 个，四语齐步；其余全部复用现役键 `pleaseLogin` / `profilePage.goLogin` / `common.loading`）。
// ============================================================================

/** 6 位补零展示（`100` ⇒ `000100`；后端回执恒为正整数）。 */
export const padInviteUid = (uid) => {
  const n = Number(uid)
  if (!Number.isFinite(n) || n < 1) return ''
  return String(Math.trunc(n)).padStart(6, '0')
}

/**
 * 6 格数字串 ⇒ uid 整数。**前导零口径的唯一实现**：
 *   `'000100'` ⇒ `100`；`'000000'` ⇒ `null`（全 0 无效）；长度不足 6 / 非数字 ⇒ `null`。
 * 为什么定宽 6：格子数是 6 ⇒ 「看到几位就必须填满几位」，不做「0001 = 1」这类隐式放宽
 *   （两位输入必然含糊：是 uid 1 还是 uid 10 的前两位？）。
 */
export const parseInviteUid = (digits) => {
  const raw = String(digits ?? '').replace(/[^0-9]/g, '')
  if (raw.length !== 6) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

const InvitePane = ({ isAuthenticated, user }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const lang = getLanguageFromUrl(location?.pathname ?? '')

  const [state, setState] = useState({ phase: 'idle', bound: false, parentUid: null, error: '' })
  const [digits, setDigits] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ phase: 'anonymous', bound: false, parentUid: null, error: '' })
      return
    }
    setState((prev) => ({ ...prev, phase: 'loading', error: '' }))
    try {
      const data = await fetchMyReferral(user)
      const raw = data?.parent_uid
      const parent = raw === null || raw === undefined ? null : Number(raw)
      setState({
        phase: 'ok',
        bound: data?.bound === true,
        parentUid: Number.isFinite(parent) ? parent : null,
        error: '',
      })
    } catch (error) {
      setState({ phase: 'error', bound: false, parentUid: null, error: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { load() }, [load])

  const parsed = parseInviteUid(digits)
  const canSubmit = parsed !== null && !submitting && state.phase === 'ok' && !state.bound

  const onSubmit = async (event) => {
    event?.preventDefault?.()
    if (parsed === null) {
      // 满 6 位才能提交：不足 ⇒ 卡内内联，**不发请求**
      setState((prev) => ({ ...prev, error: t('invite.err') }))
      return
    }
    if (!canSubmit) return

    setSubmitting(true)
    setState((prev) => ({ ...prev, error: '' }))
    try {
      await bindReferral(parsed, user)
      // 承 design `T126`：一次性变更的成功反馈**只经 Toast 一条出口**（卡内不写成功文案）
      toast.success(t('invite.ok'), { duration: 5000 })
      setDigits('')
      await load()
    } catch {
      // 失败 ⇒ 卡内内联（不弹 Toast）。三类服务端拒绝（已绑 / 编号不存在 / 自指）统一一句可读文案；
      // 机读 reason 只进 `data-sf-reason`（探针取证用），**不进可见文案**（既有护栏：机读码不当文案）。
      setState((prev) => ({ ...prev, error: t('invite.err') }))
    } finally {
      setSubmitting(false)
    }
  }

  if (state.phase === 'anonymous') {
    return (
      <div className="sf-prof-pane" data-sf-m="invite-pane">
        <h1 className="sf-prof-pane-title">{t('profileNav.invite')}</h1>
        <div className="sf-prof-empty" data-sf-m="invite-login">
          <p className="sf-invite-login-text">{t('pleaseLogin')}</p>
          <Button variant="primary" onClick={() => navigate(buildLocalizedPath(lang, '/login'))}>
            {t('profilePage.goLogin')}
          </Button>
        </div>
      </div>
    )
  }

  if (state.phase === 'loading' || state.phase === 'idle') {
    return (
      <div className="sf-prof-pane" data-sf-m="invite-pane">
        <h1 className="sf-prof-pane-title">{t('profileNav.invite')}</h1>
        <div className="sf-prof-empty" data-sf-m="invite-loading" data-sf-phase="loading">
          {t('common.loadingUser')}
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="sf-prof-pane" data-sf-m="invite-pane">
        <h1 className="sf-prof-pane-title">{t('profileNav.invite')}</h1>
        <div className="sf-prof-empty" data-sf-m="invite-load-error" data-sf-phase="error">
          {state.error || t('error')}
        </div>
      </div>
    )
  }

  return (
    <div className="sf-prof-pane" data-sf-m="invite-pane">
      <h1 className="sf-prof-pane-title">{t('profileNav.invite')}</h1>

      <div className="sf-invite-card">
        {state.bound ? (
          <div className="sf-invite-bound" data-sf-m="invite-bound">
            <p className="sf-invite-bound-line">
              {t('invite.bound')}
              {' '}
              <strong className="sf-invite-bound-uid" data-sf-m="invite-bound-uid">
                {padInviteUid(state.parentUid)}
              </strong>
            </p>
            <OtpInput
              value={padInviteUid(state.parentUid)}
              onChange={() => {}}
              disabled
              label={t('invite.label')}
              hookPrefix="invite-otp"
              ariaDescribedBy="sf-invite-bound-hint"
            />
            <p className="sf-invite-hint" id="sf-invite-bound-hint">{t('invite.boundHint')}</p>
          </div>
        ) : (
          <form className="sf-invite-form" onSubmit={onSubmit} noValidate>
            <p className="sf-invite-desc" id="sf-invite-desc">{t('invite.desc')}</p>
            <span className="sf-invite-label" id="sf-invite-label">{t('invite.label')}</span>
            <OtpInput
              value={digits}
              onChange={(next) => {
                setDigits(next)
                setState((prev) => (prev.error ? { ...prev, error: '' } : prev))
              }}
              label={t('invite.label')}
              hookPrefix="invite-otp"
              ariaDescribedBy="sf-invite-desc"
            />
            <Button
              type="submit"
              variant="primary"
              data-sf-m="invite-submit"
              disabled={!canSubmit}
            >
              {t('invite.submit')}
            </Button>
          </form>
        )}

        {state.error && (
          <p className="sf-invite-error" data-sf-m="invite-error" role="alert">{state.error}</p>
        )}
      </div>
    </div>
  )
}

export default InvitePane
