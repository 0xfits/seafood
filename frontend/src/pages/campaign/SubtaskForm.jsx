import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { submitSubtaskProof, uploadProofImage } from './campaign-api'
import { formatDateTime, predictionMetaOf, predictionOutcomeOf } from './campaign-util'
import { readProof, writeProof } from './proof-store'

// ============================================================================
// 子任务的**可写面**：prediction 双选（锁定 / 结算展示）＋ 其余四类提交面板
// ----------------------------------------------------------------------------
// 状态真源（硬口径）：登录态下服务端 `GET /api/campaign/:ref` 的每个 subtask 带
//   `my_proof`（`null` | `{payload, time_created}`）与 prediction 结算后的
//   `my_outcome`（`null` | `{choice, won, payout}`，`payout` 服务端算）
//   ⇒ **有该字段就以服务端为准**（`null` 也当真：本机回执不得覆盖服务端事实）。
// 本机回执（`proof-store.js`）只在读口未带字段时降级兜底（旧读口 / 未登录），
//   提交成功后两路同时置位，随后 `onRefresh()` 拉详情拿服务端字段（步 3）。
//
// 提交闸（前端只做提示与形态校验，判定权全在服务端）：
//   · prediction = 一人一票：首票即锁；`409 prediction_vote_locked` ⇒ 也锁并提示已投；
//     `409 prediction_deadline_passed / prediction_already_settled` ⇒ 锁 + 截止文案；
//   · 通用四类 = 提交即通过、重提覆盖（服务端 200），故面板不隐藏、用回执预填；
//   · 未登录 ⇒ 任何写动作零请求，只给登录提示（`campaign.submit.needLogin`）。
// ============================================================================

const MAX_SHOTS = 4
const MAX_IMAGE_BYTES = 1 * 1024 * 1024
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

const hasOwn = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key)
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** 读口 `my_proof` / 本机回执 → 统一 `{payload, time_created}`（缺 `payload` 对象 ⇒ `null`）。 */
const normalizeProof = (value) => {
  if (!isObject(value)) return null
  if (isObject(value.payload)) {
    return { payload: value.payload, time_created: typeof value.time_created === 'string' ? value.time_created : null }
  }
  return null
}

const choiceTextOf = (options, choice) => {
  const found = options.find((option) => option.choice === choice)
  return found ? found.text : ''
}

const readFileBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const raw = String(reader.result || '')
    const comma = raw.indexOf(',')
    resolve(comma >= 0 ? raw.slice(comma + 1) : raw)
  }
  reader.onerror = () => reject(new Error('read_failed'))
  reader.readAsDataURL(file)
})

/** 链上地址形态提示（**只做提示，不做最终判定**）：EVM 40 位 / 0x 交易哈希 64 位 / Solana base58。 */
const addrShapeOf = (value) => {
  const addr = String(value || '').trim()
  if (!addr) return null
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) return 'ok'
  if (/^0x[0-9a-fA-F]{64}$/.test(addr)) return 'ok'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return 'ok'
  return 'unknown'
}

const Notice = ({ notice, t, lang, m, showLogin }) => {
  if (!notice?.key) return null
  const kind = notice.kind === 'ok' ? 'ok' : 'err'
  return (
    <p
      className={`sf-campaign-notice is-${kind}`}
      data-sf-m={m}
      data-sf-kind={kind}
      role={kind === 'ok' ? 'status' : 'alert'}
    >
      {t(notice.key, notice.values)}
      {showLogin ? (
        <>
          {' '}
          <Link className="sf-campaign-login-link" data-sf-m="campaign-login-cta" to={buildLocalizedPath(lang, '/login')}>
            {t('campaign.loginCta')}
          </Link>
        </>
      ) : null}
    </p>
  )
}

// ---------------------------------------------------------------- prediction
const PredictionPanel = ({ subtask, t, lang, user, isAuthenticated, proof, onSaved, onRefresh }) => {
  const meta = predictionMetaOf(subtask)
  const outcome = predictionOutcomeOf(subtask, proof)
  const proofChoice = proof?.payload?.choice === 'a' || proof?.payload?.choice === 'b' ? proof.payload.choice : null
  const myChoice = outcome?.choice || proofChoice
  const settled = meta.state === 'settled'
  const closed = meta.state === 'deadline_reached'
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [notice, setNotice] = useState(null)

  if (!meta.options.length) return null

  const lockedFinal = settled || closed || Boolean(proof) || locked
  const deadlineText = formatDateTime(meta.deadline, lang)

  const pick = (choice) => {
    if (lockedFinal || busy) return
    if (!isAuthenticated) {
      setNotice({ kind: 'err', key: 'campaign.submit.needLogin' })
      return
    }
    setPicked(choice)
    setNotice(null)
  }

  const vote = async () => {
    if (!isAuthenticated) {
      setNotice({ kind: 'err', key: 'campaign.submit.needLogin' })
      return
    }
    if (!picked) {
      setNotice({ kind: 'err', key: 'campaign.prediction.pickOne' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const view = await submitSubtaskProof(subtask?.subtask_id, { choice: picked }, user)
      const payload = { choice: picked }
      writeProof(user?.uID ?? user?.uid, subtask?.subtask_id, payload)
      onSaved?.({ payload, time_created: typeof view?.time_created === 'string' ? view.time_created : null })
      setLocked(true)
      setNotice({ kind: 'ok', key: 'campaign.prediction.voteLocked' })
      onRefresh?.()
    } catch (error) {
      const code = String(error?.code || '')
      if (code === 'prediction_vote_locked') {
        setLocked(true)
        setNotice({ kind: 'err', key: 'campaign.prediction.voteLocked' })
        onRefresh?.()
      } else if (code === 'prediction_deadline_passed') {
        setLocked(true)
        setNotice({ kind: 'err', key: 'campaign.prediction.awaitSettle' })
        onRefresh?.()
      } else if (code === 'prediction_already_settled') {
        setLocked(true)
        setNotice({ kind: 'err', key: 'campaign.prediction.awaitSettle' })
        onRefresh?.()
      } else {
        setNotice({ kind: 'err', key: 'campaign.prediction.failed' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="sf-campaign-prediction"
      data-sf-m="campaign-prediction"
      data-sf-state={meta.state}
      data-sf-locked={lockedFinal ? '1' : '0'}
    >
      {deadlineText ? (
        <div className="sf-campaign-prediction-deadline" data-sf-m="campaign-prediction-deadline">
          {t('campaign.prediction.deadline', { time: deadlineText })}
        </div>
      ) : null}

      <div className="sf-campaign-votes" data-sf-m="campaign-votes">
        {meta.options.map((option) => {
          const isPicked = myChoice === option.choice || picked === option.choice
          const isCorrect = settled && meta.correct === option.choice
          const isWrong = settled && meta.correct !== option.choice
          return (
            <button
              type="button"
              key={option.choice}
              className={`sf-campaign-vote${isPicked ? ' is-picked' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
              data-sf-m="campaign-vote"
              data-sf-choice={option.choice}
              data-sf-picked={isPicked ? '1' : '0'}
              data-sf-correct={isCorrect ? '1' : '0'}
              aria-pressed={isPicked}
              disabled={lockedFinal || busy}
              onClick={() => pick(option.choice)}
            >
              <span className="sf-campaign-vote-key">
                {option.choice === 'a' ? 'A' : 'B'}
                {isCorrect ? ` · ${t('campaign.prediction.correct')}` : ''}
              </span>
              <span className="sf-campaign-vote-text">{option.text}</span>
            </button>
          )
        })}
      </div>

      {!lockedFinal ? (
        <div className="sf-campaign-panel-actions">
          <button
            type="button"
            className="sf-campaign-btn is-primary"
            data-sf-m="campaign-prediction-submit"
            disabled={busy}
            onClick={vote}
          >
            {busy ? t('campaign.submit.sending') : t('campaign.prediction.cta')}
          </button>
        </div>
      ) : null}

      {settled ? (
        outcome && outcome.won !== null ? (
          <div
            className={`sf-campaign-prediction-result ${outcome.won ? 'is-win' : 'is-lose'}`}
            data-sf-m="campaign-prediction-result"
            data-sf-won={outcome.won ? '1' : '0'}
            data-sf-payout={outcome.payout ?? ''}
          >
            <span>{t(outcome.won ? 'campaign.prediction.win' : 'campaign.prediction.lose')}</span>
            {outcome.payout ? (
              <span data-sf-m="campaign-prediction-payout">
                {t('campaign.prediction.payout', { amount: outcome.payout })}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="sf-campaign-prediction-result is-pending" data-sf-m="campaign-prediction-result">
            {t('campaign.prediction.settlePending')}
          </div>
        )
      ) : myChoice ? (
        <div className="sf-campaign-prediction-result is-pending" data-sf-m="campaign-prediction-result" data-sf-won="">
          <span>{t('campaign.prediction.voteLocked')}</span>
          <span>{t('campaign.prediction.voted', { option: choiceTextOf(meta.options, myChoice) })}</span>
          {closed ? <span>{t('campaign.prediction.awaitSettle')}</span> : null}
        </div>
      ) : closed ? (
        <div className="sf-campaign-prediction-result is-pending" data-sf-m="campaign-prediction-result">
          {t('campaign.prediction.awaitSettle')}
        </div>
      ) : null}

      {meta.prize ? (
        <div className="sf-campaign-prediction-pool" data-sf-m="campaign-prediction-pool">
          {t('campaign.prediction.prizePool', { amount: meta.prize })}
        </div>
      ) : null}

      <Notice notice={notice} t={t} lang={lang} m="campaign-prediction-notice" showLogin={!isAuthenticated} />
    </div>
  )
}

// ---------------------------------------------------------------- 其余四类
/** 问卷题目：`payload.questions[]`（串或 `{key,label,options}`）；单题形态 `question` + `options`。 */
const questionsOf = (subtask) => {
  const payload = isObject(subtask?.payload) ? subtask.payload : {}
  const raw = Array.isArray(payload.questions) ? payload.questions : null
  if (raw && raw.length) {
    return raw.map((item, index) => {
      if (typeof item === 'string') return { key: `q${index + 1}`, label: item, options: [] }
      if (!isObject(item)) return { key: `q${index + 1}`, label: '', options: [] }
      const options = Array.isArray(item.options)
        ? item.options.filter((option) => typeof option === 'string' && option.trim()).map((option) => option.trim())
        : []
      return {
        key: typeof item.key === 'string' && item.key.trim() ? item.key.trim() : `q${index + 1}`,
        label: typeof item.label === 'string' ? item.label : (typeof item.title === 'string' ? item.title : ''),
        options,
      }
    })
  }
  if (typeof payload.question === 'string' && payload.question.trim()) {
    const options = Array.isArray(payload.options)
      ? payload.options.filter((option) => typeof option === 'string' && option.trim()).map((option) => option.trim())
      : []
    return [{ key: 'q1', label: payload.question.trim(), options }]
  }
  return []
}

const ProofPanel = ({ subtask, t, lang, user, isAuthenticated, proof, onSaved, onRefresh }) => {
  const type = String(subtask?.type_code || '')
  const prev = isObject(proof?.payload) ? proof.payload : {}
  const questions = useMemo(() => (type === 'survey' ? questionsOf(subtask) : []), [subtask, type])
  const [link, setLink] = useState(() => (Array.isArray(prev.links) && typeof prev.links[0] === 'string' ? prev.links[0] : ''))
  const [addr, setAddr] = useState(() => (typeof prev.snapshot_addr === 'string' ? prev.snapshot_addr : ''))
  const [text, setText] = useState(() => {
    const answers = isObject(prev.answers) ? prev.answers : {}
    const first = Object.values(answers).find((value) => typeof value === 'string')
    return typeof first === 'string' ? first : ''
  })
  const [answers, setAnswers] = useState(() => (isObject(prev.answers) ? { ...prev.answers } : {}))
  const [shots, setShots] = useState(() => (Array.isArray(prev.screenshots) ? prev.screenshots.filter((u) => typeof u === 'string').slice(0, MAX_SHOTS) : []))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState(null)

  const submittedText = proof?.time_created ? formatDateTime(proof.time_created, lang) : null

  const buildPayload = () => {
    if (type === 'x_verify') {
      const links = [link.trim()]
      return shots.length ? { links, screenshots: shots } : { links }
    }
    if (type === 'onchain_snapshot') return { snapshot_addr: addr.trim() }
    if (questions.length) {
      const out = {}
      for (const question of questions) out[question.key] = String(answers[question.key] ?? '').trim()
      return { answers: out }
    }
    return { answers: { q1: text.trim() } }
  }

  const validate = () => {
    if (type === 'x_verify') {
      const value = link.trim()
      if (!value) return 'campaign.submit.needLink'
      if (!/^https?:\/\/\S+$/i.test(value)) return 'campaign.submit.linkInvalid'
      return null
    }
    if (type === 'onchain_snapshot') {
      const value = addr.trim()
      if (!value) return 'campaign.submit.needAddr'
      if (value.length > 200) return 'campaign.submit.snapshotInvalid'
      return null
    }
    if (questions.length) {
      for (const question of questions) {
        if (!String(answers[question.key] ?? '').trim()) {
          return question.options.length ? 'campaign.submit.chooseOption' : 'campaign.submit.needAnswer'
        }
      }
      return null
    }
    return text.trim() ? null : 'campaign.submit.needAnswer'
  }

  const pickFiles = async (event) => {
    const input = event?.target
    const files = Array.from(input?.files || [])
    if (input) input.value = ''
    if (!files.length || uploading) return
    if (!isAuthenticated) {
      setNotice({ kind: 'err', key: 'campaign.submit.needLogin' })
      return
    }
    const room = MAX_SHOTS - shots.length
    if (room <= 0) {
      setNotice({ kind: 'err', key: 'campaign.submit.imageMax', values: { n: MAX_SHOTS } })
      return
    }
    setUploading(true)
    setNotice(null)
    const added = []
    try {
      for (const file of files.slice(0, room)) {
        if (!file || file.size > MAX_IMAGE_BYTES) {
          const error = new Error('image_too_large')
          error.i18nKey = 'campaign.submit.imageTooLarge'
          throw error
        }
        const dataBase64 = await readFileBase64(file)
        const contentType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
        const result = await uploadProofImage(user, { content_type: contentType, data_base64: dataBase64 })
        if (typeof result?.url !== 'string' || !result.url) {
          const error = new Error('upload_failed')
          error.i18nKey = 'campaign.submit.uploadFailed'
          throw error
        }
        added.push(result.url)
      }
      setShots((prevShots) => [...prevShots, ...added].slice(0, MAX_SHOTS))
    } catch (error) {
      // 「失败即取消」：已上传的保留在列表里（不丢用户已完成的部分），其余不再继续，提交也不放行。
      if (added.length) setShots((prevShots) => [...prevShots, ...added].slice(0, MAX_SHOTS))
      setNotice({ kind: 'err', key: error?.i18nKey || 'campaign.submit.uploadFailed' })
    } finally {
      setUploading(false)
    }
  }

  const removeShot = (url) => {
    setShots((prevShots) => prevShots.filter((item) => item !== url))
  }

  const submit = async () => {
    if (!isAuthenticated) {
      setNotice({ kind: 'err', key: 'campaign.submit.needLogin' })
      return
    }
    if (uploading) {
      setNotice({ kind: 'err', key: 'campaign.submit.uploadFailed' })
      return
    }
    const bad = validate()
    if (bad) {
      setNotice({ kind: 'err', key: bad })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const payload = buildPayload()
      const view = await submitSubtaskProof(subtask?.subtask_id, payload, user)
      writeProof(user?.uID ?? user?.uid, subtask?.subtask_id, payload)
      onSaved?.({ payload, time_created: typeof view?.time_created === 'string' ? view.time_created : null })
      setNotice({ kind: 'ok', key: 'campaign.submit.ok' })
      onRefresh?.()
    } catch (error) {
      setNotice({ kind: 'err', key: 'campaign.submit.failed' })
    } finally {
      setBusy(false)
    }
  }

  const addrShape = type === 'onchain_snapshot' ? addrShapeOf(addr) : null

  return (
    <div className="sf-campaign-panel" data-sf-m="campaign-proof-panel" data-sf-type={type}>
      {proof ? (
        <p className="sf-campaign-notice is-ok" data-sf-m="campaign-proof-submitted">
          {t('campaign.submitted')}
          {submittedText ? ` · ${submittedText}` : ''}
        </p>
      ) : null}

      {type === 'x_verify' ? (
        <>
          <label className="sf-campaign-field">
            <span className="sf-campaign-field-label">{t('campaign.submit.links')}</span>
            <input
              className="sf-campaign-input"
              data-sf-m="campaign-proof-link"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder={t('campaign.submit.linkPlaceholder')}
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
          </label>

          <div className="sf-campaign-field">
            <span className="sf-campaign-field-label">
              {t('campaign.submit.screenshots')}
              <span className="sf-campaign-field-hint"> {shots.length}/{MAX_SHOTS}</span>
            </span>
            <input
              className="sf-campaign-file"
              data-sf-m="campaign-proof-file"
              type="file"
              accept={IMAGE_TYPES}
              multiple
              disabled={uploading || shots.length >= MAX_SHOTS}
              onChange={pickFiles}
            />
            {shots.length ? (
              <div className="sf-campaign-thumbs" data-sf-m="campaign-proof-shots">
                {shots.map((url) => (
                  <span className="sf-campaign-thumb-box" key={url}>
                    <img className="sf-campaign-thumb" src={url} alt="" data-sf-m="campaign-proof-shot" />
                    <button
                      type="button"
                      className="sf-campaign-thumb-del"
                      data-sf-m="campaign-proof-shot-remove"
                      onClick={() => removeShot(url)}
                    >{t('campaign.submit.removeImage')}</button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {type === 'onchain_snapshot' ? (
        <label className="sf-campaign-field">
          <span className="sf-campaign-field-label">{t('campaign.submit.snapshotAddr')}</span>
          <input
            className="sf-campaign-input"
            data-sf-m="campaign-proof-addr"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('campaign.submit.snapshotPlaceholder')}
            value={addr}
            onChange={(event) => setAddr(event.target.value)}
          />
          {addr.trim() ? (
            <span
              className={`sf-campaign-field-hint${addrShape === 'ok' ? ' is-ok' : ' is-err'}`}
              data-sf-m="campaign-proof-addr-hint"
              data-sf-shape={addrShape}
            >
              {addrShape === 'ok' ? t('campaign.submit.snapshotValid') : t('campaign.submit.snapshotInvalid')}
            </span>
          ) : (
            <span className="sf-campaign-field-hint" data-sf-m="campaign-proof-addr-hint" data-sf-shape="empty">
              {t('campaign.submit.snapshotHint')}
            </span>
          )}
        </label>
      ) : null}

      {type === 'survey' && questions.length ? (
        <div className="sf-campaign-questions" data-sf-m="campaign-proof-questions">
          {questions.map((question) => (
            <div className="sf-campaign-field" key={question.key} data-sf-m="campaign-proof-question" data-sf-q={question.key}>
              <span className="sf-campaign-field-label">{question.label || question.key}</span>
              {question.options.length ? (
                <div className="sf-campaign-choices">
                  {question.options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={`sf-campaign-choice${answers[question.key] === option ? ' is-picked' : ''}`}
                      data-sf-m="campaign-proof-choice"
                      aria-pressed={answers[question.key] === option}
                      onClick={() => setAnswers((prevAnswers) => ({ ...prevAnswers, [question.key]: option }))}
                    >{option}</button>
                  ))}
                </div>
              ) : (
                <textarea
                  className="sf-campaign-textarea"
                  data-sf-m="campaign-proof-question-text"
                  placeholder={t('campaign.submit.textPlaceholder')}
                  value={String(answers[question.key] ?? '')}
                  onChange={(event) => setAnswers((prevAnswers) => ({ ...prevAnswers, [question.key]: event.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {type === 'survey' && !questions.length ? (
        <label className="sf-campaign-field">
          <span className="sf-campaign-field-label">{t('campaign.submit.text')}</span>
          <textarea
            className="sf-campaign-textarea"
            data-sf-m="campaign-proof-text"
            placeholder={t('campaign.submit.textPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      ) : null}

      {type === 'quiz' ? (
        <label className="sf-campaign-field">
          <span className="sf-campaign-field-label">{t('campaign.submit.text')}</span>
          <input
            className="sf-campaign-input"
            data-sf-m="campaign-proof-answer"
            type="text"
            autoComplete="off"
            placeholder={t('campaign.submit.textPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      ) : null}

      <div className="sf-campaign-panel-actions">
        <button
          type="button"
          className="sf-campaign-btn is-primary"
          data-sf-m="campaign-proof-submit"
          disabled={busy || uploading}
          onClick={submit}
        >
          {busy || uploading ? t('campaign.submit.sending') : t('campaign.submit.cta')}
        </button>
      </div>

      <Notice notice={notice} t={t} lang={lang} m="campaign-proof-notice" showLogin={!isAuthenticated} />
    </div>
  )
}

// ---------------------------------------------------------------- 壳
const SubtaskForm = ({ subtask, t, lang, user, isAuthenticated, onRefresh }) => {
  const [saved, setSaved] = useState(null)
  const serverHasProof = hasOwn(subtask, 'my_proof')
  const proof = serverHasProof ? normalizeProof(subtask.my_proof) : (saved || readProof(user?.uID ?? user?.uid, subtask?.subtask_id))

  if (!subtask?.subtask_id) return null

  const shared = {
    subtask,
    t,
    lang,
    user,
    isAuthenticated,
    proof,
    onSaved: setSaved,
    onRefresh,
  }

  return String(subtask.type_code) === 'prediction'
    ? <PredictionPanel {...shared} />
    : <ProofPanel {...shared} />
}

export default SubtaskForm
