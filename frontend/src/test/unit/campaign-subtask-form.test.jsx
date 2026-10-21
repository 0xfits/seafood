/**
 * 活动子任务可写面单测（步 2 · 2026-10-20）
 *
 * 覆盖：
 *   ① prediction 开放态：双选项可点、未选就提交 ⇒ `pickOne` 提示、零请求；
 *   ② 投票成功 ⇒ 立即锁定（本机回执 + 服务端字段两路）、按钮 disabled、提示已投票；
 *   ③ 服务端 `my_proof` 优先 ⇒ 直接锁定并显示所投选项；
 *   ④ 服务端 `409 prediction_vote_locked` ⇒ 锁定 + 提示 + 触发复读；
 *   ⑤ 结算态：正确项高亮（is-correct）、错误项置灰（is-wrong）、`my_outcome` 的 won/payout 展示；
 *   ⑥ 截止态：两选项 disabled + 截止文案；
 *   ⑦ 其余四类面板渲染（X 验证 / 链上快照 / 问卷（选项+文本）/ 答题）与提交载荷形状；
 *   ⑧ 链上地址形态提示（无效 / 有效）；
 *   ⑨ 未登录 ⇒ 点击投票只提示登录、零请求；
 *   ⑩ 四语齐备：步 2 新增的 13 个键在 zh/hk/en/vn 全有且非空（en/vn 零 CJK）。
 *
 * 注：真实浏览器几何（390/1536 零溢出）与真实契约联调由 `ops/campaign/front/` 探针覆盖。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'
import { predictionMetaOf, predictionOptionsOf, predictionOutcomeOf } from '../../pages/campaign/campaign-util'

const TABLES = { zh, en, hk, vn }
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

// 最小 i18next 替身：点分取键 + `{{var}}` 插值（键缺失回键名）。
const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => makeT(TABLES.zh)(key, vars),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 77 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const API = vi.hoisted(() => ({ submitSubtaskProof: vi.fn(), uploadProofImage: vi.fn() }))
vi.mock('../../pages/campaign/campaign-api', () => API)

import SubtaskItem from '../../pages/campaign/SubtaskItem'

const t = makeT(TABLES.zh)
const HOUR = 3600 * 1000

const subtask = (patch = {}) => ({
  subtask_id: 5011,
  task_id: 301,
  type_code: 'prediction',
  type_label: '预测',
  title: '谁会赢',
  content: '本场海鲜擂台赛',
  payload: { option_a: '甲队', option_b: '乙队', prize_amount: '100', deadline: new Date(Date.now() + 2 * HOUR).toISOString() },
  required: true,
  prediction_state: 'open',
  ...patch,
})

const renderItem = (row) => render(
  <MemoryRouter>
    <ul>
      <SubtaskItem subtask={row} t={t} lang="zh" user={AUTH.user} isAuthenticated={AUTH.isAuthenticated} onRefresh={API.refresh} />
    </ul>
  </MemoryRouter>,
)

beforeEach(() => {
  API.submitSubtaskProof.mockReset()
  API.uploadProofImage.mockReset()
  API.refresh = vi.fn()
  AUTH.isAuthenticated = true
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// ============================================================================
describe('campaign-util · prediction 派生（纯函数）', () => {
  it('选项恒为 Yes/No 两枚（与 payload 无关）；旧四键行的 option_a/b 只作副行原文', () => {
    const fixed = predictionOptionsOf(subtask())
    expect(fixed.map((o) => o.choice)).toEqual(['yes', 'no'])
    expect(fixed.map((o) => o.labelKey)).toEqual(['campaign.predictionYes', 'campaign.predictionNo'])
    // 旧四键行：原文只落 legacyText（不再参与选择集）
    expect(fixed.map((o) => o.legacyText)).toEqual(['甲队', '乙队'])
    // 新两键行（无选项文案）⇒ 仍两枚，legacyText 皆空
    const fresh = predictionOptionsOf(subtask({ payload: { prize_amount: '100', deadline: new Date(Date.now() + 2 * HOUR).toISOString() } }))
    expect(fresh.map((o) => o.legacyText)).toEqual(['', ''])
    expect(fresh).toHaveLength(2)
  })

  it('三态：服务端字段优先；缺字段时按 correct_option / deadline 派生', () => {
    expect(predictionMetaOf(subtask({ prediction_state: 'deadline_reached' })).state).toBe('deadline_reached')
    expect(predictionMetaOf(subtask({ prediction_state: undefined, payload: { ...subtask().payload, correct_option: 'a' } })).state).toBe('settled')
    const past = new Date(Date.now() - HOUR).toISOString()
    expect(predictionMetaOf(subtask({ prediction_state: undefined, payload: { ...subtask().payload, deadline: past } })).state).toBe('deadline_reached')
  })

  it('个人结果：my_outcome 优先（payout 服务端给）；无该字段时只做 won 降级、payout 留空', () => {
    const settled = subtask({ payload: { ...subtask().payload, correct_option: 'b' } })
    expect(predictionOutcomeOf(settled, { payload: { choice: 'b' } })).toEqual({
      choice: 'no', won: true, payout: null, source: 'local',
    })
    expect(predictionOutcomeOf({ ...settled, my_outcome: { choice: 'b', won: true, payout: '50' } }, { payload: { choice: 'b' } })).toEqual({
      choice: 'no', won: true, payout: '50', source: 'server',
    })
    // 新票形态 yes/no 直通
    expect(predictionOutcomeOf({ ...settled, my_outcome: { choice: 'no', won: true, payout: '50' } }, { payload: { choice: 'no' } }).choice).toBe('no')
    expect(predictionOutcomeOf(settled, null)).toBeNull()
  })
})

// ============================================================================
describe('prediction 面板', () => {
  it('开放态：双选项可点、无锁定；未选就提交 ⇒ pickOne 提示、零请求', async () => {
    const { container } = renderItem(subtask())
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes).toHaveLength(2)
    expect(votes.every((node) => !node.disabled)).toBe(true)
    expect(container.querySelector('[data-sf-m="campaign-prediction"]').getAttribute('data-sf-locked')).toBe('0')

    fireEvent.click(container.querySelector('[data-sf-m="campaign-prediction-submit"]'))
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-prediction-notice"]').textContent).toContain(zh.campaign.prediction.pickOne)
    })
    expect(API.submitSubtaskProof).not.toHaveBeenCalled()
  })

  it('投票成功 ⇒ 立即锁定、提示已投、触发复读', async () => {
    API.submitSubtaskProof.mockResolvedValue({ proof_id: '9', payload: { choice: 'a' }, time_created: '2026-10-20T10:00:00.000Z' })
    const { container } = renderItem(subtask())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-vote"][data-sf-choice="yes"]'))
    fireEvent.click(container.querySelector('[data-sf-m="campaign-prediction-submit"]'))

    await waitFor(() => expect(API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(API.submitSubtaskProof.mock.calls[0][0]).toBe(5011)
    expect(API.submitSubtaskProof.mock.calls[0][1]).toEqual({ choice: 'yes' })

    await waitFor(() => {
      const panel = container.querySelector('[data-sf-m="campaign-prediction"]')
      expect(panel.getAttribute('data-sf-locked')).toBe('1')
    })
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes.every((node) => node.disabled)).toBe(true)
    expect(votes[0].getAttribute('data-sf-picked')).toBe('1')
    expect(container.querySelector('[data-sf-m="campaign-prediction-result"]').textContent).toContain(zh.campaign.prediction.voteLocked)
    expect(container.querySelector('[data-sf-m="campaign-prediction-submit"]')).toBeNull()
    expect(API.refresh).toHaveBeenCalled()
  })

  it('服务端 my_proof 优先 ⇒ 直接锁定并显示所投选项', () => {
    const { container } = renderItem(subtask({
      my_proof: { payload: { choice: 'b' }, time_created: '2026-10-20T09:00:00.000Z' },
    }))
    expect(container.querySelector('[data-sf-m="campaign-prediction"]').getAttribute('data-sf-locked')).toBe('1')
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes[1].getAttribute('data-sf-picked')).toBe('1')
    expect(votes.every((node) => node.disabled)).toBe(true)
    expect(container.querySelector('[data-sf-m="campaign-prediction-result"]').textContent)
      .toContain(t('campaign.prediction.voted', { option: zh.campaign.predictionNo }))
  })

  it('服务端 409 prediction_vote_locked ⇒ 锁定 + 提示 + 复读', async () => {
    const error = new Error('locked')
    error.code = 'prediction_vote_locked'
    API.submitSubtaskProof.mockRejectedValue(error)
    const { container } = renderItem(subtask())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-vote"][data-sf-choice="no"]'))
    fireEvent.click(container.querySelector('[data-sf-m="campaign-prediction-submit"]'))

    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-prediction"]').getAttribute('data-sf-locked')).toBe('1')
    })
    expect(container.querySelector('[data-sf-m="campaign-prediction-notice"]').textContent).toContain(zh.campaign.prediction.voteLocked)
    expect(API.refresh).toHaveBeenCalled()
  })

  it('结算态：正确项高亮、错误项置灰、展示 won + payout', () => {
    const { container } = renderItem(subtask({
      prediction_state: 'settled',
      payload: { ...subtask().payload, correct_option: 'a' },
      my_proof: { payload: { choice: 'a' }, time_created: '2026-10-20T09:00:00.000Z' },
      my_outcome: { choice: 'a', won: true, payout: '37' },
    }))
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes[0].className).toContain('is-correct')
    expect(votes[0].getAttribute('data-sf-correct')).toBe('1')
    expect(votes[1].className).toContain('is-wrong')
    expect(votes.every((node) => node.disabled)).toBe(true)

    const result = container.querySelector('[data-sf-m="campaign-prediction-result"]')
    expect(result.getAttribute('data-sf-won')).toBe('1')
    expect(result.getAttribute('data-sf-payout')).toBe('37')
    expect(result.textContent).toContain(zh.campaign.prediction.win)
    expect(container.querySelector('[data-sf-m="campaign-prediction-payout"]').textContent).toContain('37')
  })

  it('截止态（未投）：双选项 disabled + 等待开奖文案', () => {
    const { container } = renderItem(subtask({ prediction_state: 'deadline_reached' }))
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes.every((node) => node.disabled)).toBe(true)
    expect(container.querySelector('[data-sf-m="campaign-prediction-result"]').textContent).toContain(zh.campaign.prediction.awaitSettle)
    expect(container.querySelector('[data-sf-m="campaign-prediction-submit"]')).toBeNull()
  })

  it('未登录：点击选项只给登录提示（零请求）', async () => {
    AUTH.isAuthenticated = false
    const { container } = renderItem(subtask())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-vote"][data-sf-choice="yes"]'))
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-prediction-notice"]').textContent).toContain(zh.campaign.submit.needLogin)
    })
    expect(container.querySelector('[data-sf-m="campaign-login-cta"]')).not.toBeNull()
    expect(API.submitSubtaskProof).not.toHaveBeenCalled()
  })
})

// ============================================================================
describe('其余四类提交面板', () => {
  it('X 验证：链接输入 + 可选截图，提交载荷 = {links:[url]}', async () => {
    API.submitSubtaskProof.mockResolvedValue({ payload: {}, time_created: '2026-10-20T10:00:00.000Z' })
    const { container } = renderItem(subtask({ type_code: 'x_verify', title: '转发 X', payload: {} }))
    expect(container.querySelector('[data-sf-m="campaign-proof-link"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-m="campaign-proof-file"]')).not.toBeNull()

    // 空链接 ⇒ needLink 提示、零请求
    fireEvent.click(container.querySelector('[data-sf-m="campaign-proof-submit"]'))
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-proof-notice"]').textContent).toContain(zh.campaign.submit.needLink)
    })
    expect(API.submitSubtaskProof).not.toHaveBeenCalled()

    fireEvent.change(container.querySelector('[data-sf-m="campaign-proof-link"]'), { target: { value: 'https://x.com/seafood/status/1' } })
    fireEvent.click(container.querySelector('[data-sf-m="campaign-proof-submit"]'))
    await waitFor(() => expect(API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(API.submitSubtaskProof.mock.calls[0][1]).toEqual({ links: ['https://x.com/seafood/status/1'] })
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-proof-submitted"]').textContent).toContain(zh.campaign.submitted)
    })
  })

  it('链上快照：地址形态提示（无效 / 有效）+ 提交 {snapshot_addr}', async () => {
    API.submitSubtaskProof.mockResolvedValue({ payload: {}, time_created: '2026-10-20T10:00:00.000Z' })
    const { container } = renderItem(subtask({ type_code: 'onchain_snapshot', title: '快照持仓', payload: {} }))
    const input = container.querySelector('[data-sf-m="campaign-proof-addr"]')
    fireEvent.change(input, { target: { value: 'not-an-address!' } })
    expect(container.querySelector('[data-sf-m="campaign-proof-addr-hint"]').textContent).toContain(zh.campaign.submit.snapshotInvalid)

    const addr = '0x1234567890abcdef1234567890abcdef12345678'
    fireEvent.change(input, { target: { value: addr } })
    expect(container.querySelector('[data-sf-m="campaign-proof-addr-hint"]').getAttribute('data-sf-shape')).toBe('ok')
    expect(container.querySelector('[data-sf-m="campaign-proof-addr-hint"]').textContent).toContain(zh.campaign.submit.snapshotValid)

    fireEvent.click(container.querySelector('[data-sf-m="campaign-proof-submit"]'))
    await waitFor(() => expect(API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(API.submitSubtaskProof.mock.calls[0][1]).toEqual({ snapshot_addr: addr })
  })

  it('问卷（选项 + 文本题）：逐题渲染并提交 answers 对象', async () => {
    API.submitSubtaskProof.mockResolvedValue({ payload: {}, time_created: '2026-10-20T10:00:00.000Z' })
    const { container } = renderItem(subtask({
      type_code: 'survey',
      title: '口味问卷',
      payload: {
        questions: [
          { key: 'taste', label: '喜欢哪种口味', options: ['原味', '辣味'] },
          { key: 'why', label: '为什么' },
        ],
      },
    }))
    expect(container.querySelectorAll('[data-sf-m="campaign-proof-question"]')).toHaveLength(2)
    const choices = [...container.querySelectorAll('[data-sf-m="campaign-proof-choice"]')]
    expect(choices).toHaveLength(2)
    fireEvent.click(choices[1])
    expect(choices[1].getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(container.querySelector('[data-sf-m="campaign-proof-question-text"]'), { target: { value: '因为够鲜' } })
    fireEvent.click(container.querySelector('[data-sf-m="campaign-proof-submit"]'))
    await waitFor(() => expect(API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(API.submitSubtaskProof.mock.calls[0][1]).toEqual({ answers: { taste: '辣味', why: '因为够鲜' } })
  })

  it('答题（文本）：单输入 + 提交 {answers:{q1}}', async () => {
    API.submitSubtaskProof.mockResolvedValue({ payload: {}, time_created: '2026-10-20T10:00:00.000Z' })
    const { container } = renderItem(subtask({ type_code: 'quiz', title: '知识题', payload: {} }))
    fireEvent.change(container.querySelector('[data-sf-m="campaign-proof-answer"]'), { target: { value: '42' } })
    fireEvent.click(container.querySelector('[data-sf-m="campaign-proof-submit"]'))
    await waitFor(() => expect(API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(API.submitSubtaskProof.mock.calls[0][1]).toEqual({ answers: { q1: '42' } })
  })

  it('未登录：提交只给登录提示、零请求', async () => {
    AUTH.isAuthenticated = false
    const { container } = renderItem(subtask({ type_code: 'quiz', title: '知识题', payload: {} }))
    fireEvent.change(container.querySelector('[data-sf-m="campaign-proof-answer"]'), { target: { value: '42' } })
    fireEvent.click(container.querySelector('[data-sf-m="campaign-proof-submit"]'))
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-proof-notice"]').textContent).toContain(zh.campaign.submit.needLogin)
    })
    expect(API.submitSubtaskProof).not.toHaveBeenCalled()
  })
})

// ============================================================================
describe('步 2 i18n 新增键四语齐备', () => {
  const NEW_KEYS = [
    'campaign.prediction.cta', 'campaign.prediction.pickOne', 'campaign.prediction.payout',
    'campaign.submit.removeImage', 'campaign.submit.imageMax', 'campaign.submit.snapshotHint',
    'campaign.submit.snapshotInvalid', 'campaign.submit.snapshotValid', 'campaign.submit.needLink',
    'campaign.submit.linkInvalid', 'campaign.submit.needAddr', 'campaign.submit.needAnswer',
    'campaign.submit.chooseOption',
  ]

  it('13 键在四语均为非空字符串；en/vn 零 CJK', () => {
    const problems = []
    for (const lang of LANGS) {
      for (const key of NEW_KEYS) {
        const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), TABLES[lang])
        if (typeof value !== 'string' || !value.trim()) problems.push(`${lang} 缺 ${key}`)
        else if ((lang === 'en' || lang === 'vn') && CJK.test(value)) problems.push(`${lang} 残留中文 ${key}=${value}`)
      }
    }
    expect(problems).toEqual([])
  })
})
