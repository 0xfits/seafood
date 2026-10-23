/**
 * prediction 固定 Yes/No + quiz 四选项（含正确项与奖励）· 发布侧与参与侧（2026-10-22）
 *
 * 覆盖（对齐派单验证项）：
 *   ① 发布表单 · prediction：**只有展示用的 Yes/No**（无自填选项输入框）+ 奖池 + 截止；
 *   ② 发布表单 · quiz：4 个选项输入 + 正确项**多选**（1–4）+ 奖励（$）；
 *   ③ 客户端校验零请求：空选项 / 全不选正确项 / 奖励 ≤0 ⇒ 只报错、不发 PATCH；
 *   ④ 发布载荷：quiz = `{options:{a,b,c,d}, correct:[...]}` + 顶层 `reward_amount`；
 *   ⑤ 参与侧 · prediction：两枚按钮文案 = Yes/No（`data-sf-choice` = yes/no）、票形 `{choice}`；
 *   ⑥ 参与侧 · quiz：四选项多选 + 提交；载荷 `{answers:{picks:[...]}}`；
 *   ⑦ 参与侧 · quiz 判分：**只认服务端** `quiz_correct`/`reward_paid` ⇒ 答对显奖励 / 答错不显；
 *      服务端无判定 ⇒ 不渲染结果块（公开读口无 `correct`，前端不得本地推算）；
 *   ⑧ i18n：本次新增 12 键四语齐备（en/vn 零 CJK）。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, en, hk, vn }
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

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

const PROOF_API = vi.hoisted(() => ({ submitSubtaskProof: vi.fn(), uploadProofImage: vi.fn() }))
vi.mock('../../pages/campaign/campaign-api', () => PROOF_API)

const PROJECT_API = vi.hoisted(() => ({
  fetchProjectDetail: vi.fn(),
  fetchProjectCurrencies: vi.fn(),
  rechargeProjectVault: vi.fn(),
  createProjectCampaign: vi.fn(),
  patchProjectCampaign: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  appendProjectSubtasks: vi.fn(),
}))
vi.mock('../../pages/project/project-api', () => PROJECT_API)

import ProjectForms from '../../pages/project/ProjectForms'
import SubtaskItem from '../../pages/campaign/SubtaskItem'

const t = makeT(TABLES.zh)
const HOUR = 3600 * 1000
const FUTURE = new Date(Date.now() + 2 * HOUR).toISOString()

// ---------------------------------------------------------------- 夹具
const detailView = () => ({
  project_id: 11,
  slug: 'sui',
  campaigns: [
    {
      campaign_id: 501,
      title: '秋季招募',
      tasks: [
        {
          task_id: 555,
          title: '转发推文',
          subtasks: [
            { subtask_id: 901, type_code: 'x_verify', title: '旧行', content: null, payload: { links: ['https://x.com/a'] }, sort: 1, required: true },
          ],
        },
      ],
    },
  ],
})

const renderPublishForm = () => render(
  <MemoryRouter>
    <ProjectForms
      panel="subtask"
      slug="sui"
      currencies={[]}
      t={t}
      onClose={vi.fn()}
      onDone={vi.fn()}
      campaignLock={{ campaign_id: 501, title: '秋季招募' }}
      taskLock={{ task_id: 555, title: '转发推文' }}
    />
  </MemoryRouter>,
)

const pickType = (container, code) => fireEvent.change(container.querySelector('[data-sf-field="type"]'), { target: { value: code } })
const fill = (container, field, value) => fireEvent.change(container.querySelector(`[data-sf-field="${field}"]`), { target: { value } })
const submitForm = (container) => fireEvent.submit(container.querySelector('[data-sf-m="project-form-subtask"]'))

/** 发布表单填一条合法 quiz 行（调用方再覆写个别字段）。 */
const fillQuiz = (container, { reward = '8' } = {}) => {
  fill(container, 'title', '海鲜常识')
  fill(container, 'quiz-a', '虾')
  fill(container, 'quiz-b', '鱼')
  fill(container, 'quiz-c', '蟹')
  fill(container, 'quiz-d', '贝')
  fireEvent.click(container.querySelector('[data-sf-field="quiz-correct-b"]'))
  if (reward !== null) fill(container, 'quiz-reward', reward)
}

const subtaskOf = (patch = {}) => ({
  subtask_id: 5011,
  task_id: 301,
  type_code: 'prediction',
  type_label: '预测',
  title: '今晚谁先卖完？',
  content: '按 22:00 结算',
  payload: { prize_amount: '120', deadline: FUTURE },
  required: true,
  prediction_state: 'open',
  ...patch,
})

const quizSubtask = (patch = {}) => subtaskOf({
  type_code: 'quiz',
  type_label: '答题',
  title: '海鲜常识',
  reward_amount: '9',
  prediction_state: null,
  payload: { options: { a: '虾', b: '鱼', c: '蟹', d: '贝' } },
  ...patch,
})

const renderItem = (row) => render(
  <MemoryRouter>
    <ul>
      <SubtaskItem subtask={row} t={t} lang="zh" user={AUTH.user} isAuthenticated={AUTH.isAuthenticated} onRefresh={PROOF_API.refresh} />
    </ul>
  </MemoryRouter>,
)

beforeEach(() => {
  PROOF_API.submitSubtaskProof.mockReset()
  PROOF_API.uploadProofImage.mockReset()
  PROOF_API.refresh = vi.fn()
  PROJECT_API.fetchProjectDetail.mockReset()
  PROJECT_API.appendProjectSubtasks.mockReset()
  PROJECT_API.fetchProjectDetail.mockResolvedValue(detailView())
  PROJECT_API.appendProjectSubtasks.mockResolvedValue({ task_id: 555 })
  AUTH.isAuthenticated = true
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// ============================================================================
describe('① 发布表单 · prediction = 固定 Yes/No（不可编辑）', () => {
  it('选 prediction ⇒ 只渲染展示型 Yes/No + 奖池 + 截止，**零自填选项输入框**', () => {
    const { container } = renderPublishForm()
    pickType(container, 'prediction')

    const choices = container.querySelector('[data-sf-m="project-prediction-choices"]')
    expect(choices).not.toBeNull()
    const texts = [...choices.querySelectorAll('[data-sf-choice]')].map((el) => el.textContent)
    expect(texts).toEqual([zh.campaign.predictionYes, zh.campaign.predictionNo])
    // 只展示：无 input / textarea 可编辑元素
    expect(choices.querySelector('input')).toBeNull()
    expect(choices.querySelector('textarea')).toBeNull()

    // 旧的两个自填选项输入框已删除
    expect(container.querySelector('[data-sf-field="optionA"]')).toBeNull()
    expect(container.querySelector('[data-sf-field="optionB"]')).toBeNull()
    // 奖池 + 截止仍在
    expect(container.querySelector('[data-sf-field="prize"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-field="deadline"]')).not.toBeNull()
    // 其他类型专属字段不串台
    expect(container.querySelector('[data-sf-m="project-quiz-fields"]')).toBeNull()
  })

  it('prediction 提交载荷只含奖池与截止 ⇒ 旧四键不再出现', async () => {
    const { container } = renderPublishForm()
    pickType(container, 'prediction')
    fill(container, 'title', '猜冠军')
    fill(container, 'prize', '120')
    fill(container, 'deadline', '2026-12-01T12:00')
    submitForm(container)

    await waitFor(() => expect(PROJECT_API.appendProjectSubtasks).toHaveBeenCalledTimes(1))
    const group = PROJECT_API.appendProjectSubtasks.mock.calls[0][1]
    const created = group[group.length - 1]
    expect(created.type_code).toBe('prediction')
    expect(created.payload).toEqual({ prize_amount: '120', deadline: new Date('2026-12-01T12:00').toISOString() })
    expect(Object.keys(created.payload)).toEqual(['prize_amount', 'deadline'])
    expect(created).not.toHaveProperty('reward_amount')
  })
})

// ============================================================================
describe('② 发布表单 · quiz 四选项 + 正确项多选 + 奖励', () => {
  it('选 quiz ⇒ 4 个选项输入 + 4 个正确项多选 + 奖励输入；其他专属字段不串台', () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    for (const key of ['a', 'b', 'c', 'd']) {
      expect(container.querySelector(`[data-sf-field="quiz-${key}"]`)).not.toBeNull()
    }
    const boxes = [...container.querySelectorAll('[data-sf-m="project-quiz-correct"] input[type="checkbox"]')]
    expect(boxes).toHaveLength(4)
    expect(container.querySelector('[data-sf-field="quiz-reward"]')).not.toBeNull()
    // prediction 专属不渲染
    expect(container.querySelector('[data-sf-m="project-prediction-choices"]')).toBeNull()
    expect(container.querySelector('[data-sf-field="prize"]')).toBeNull()
  })

  it('正确项多选可同时勾选多个（1–4 个）', () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    const a = container.querySelector('[data-sf-field="quiz-correct-a"]')
    const c = container.querySelector('[data-sf-field="quiz-correct-c"]')
    fireEvent.click(a)
    fireEvent.click(c)
    expect(container.querySelector('[data-sf-field="quiz-correct-a"]').checked).toBe(true)
    expect(container.querySelector('[data-sf-field="quiz-correct-c"]').checked).toBe(true)
    // 再点一次 = 取消
    fireEvent.click(container.querySelector('[data-sf-field="quiz-correct-c"]'))
    expect(container.querySelector('[data-sf-field="quiz-correct-c"]').checked).toBe(false)
  })

  it('合法提交 ⇒ 载荷 {options:{a,b,c,d}, correct:[...]} + reward_amount，旧行原样回送', async () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    fillQuiz(container)
    submitForm(container)

    await waitFor(() => expect(PROJECT_API.appendProjectSubtasks).toHaveBeenCalledTimes(1))
    const [taskId, group] = PROJECT_API.appendProjectSubtasks.mock.calls[0]
    expect(taskId).toBe('555')
    expect(group).toHaveLength(2) // 旧 1 + 新 1
    expect(group[0].subtask_id).toBe('901')
    expect(group[1]).toEqual({
      type_code: 'quiz',
      title: '海鲜常识',
      content: null,
      payload: { options: { a: '虾', b: '鱼', c: '蟹', d: '贝' }, correct: ['b'] },
      sort: 0,
      required: true,
      reward_amount: '8',
    })
  })
})

// ============================================================================
describe('③ quiz 客户端校验：拦截即零请求', () => {
  const expectZero = (container, key) => {
    const notice = container.querySelector('[data-sf-m="project-form-notice"]')
    expect(notice).not.toBeNull()
    expect(notice.textContent).toBe(t(key))
    expect(PROJECT_API.appendProjectSubtasks).not.toHaveBeenCalled()
    expect(PROJECT_API.fetchProjectDetail).not.toHaveBeenCalled()
  }

  it('空选项 ⇒ quizInvalid、零请求', () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    fillQuiz(container)
    fill(container, 'quiz-d', '   ')
    submitForm(container)
    expectZero(container, 'project.quizInvalid')
  })

  it('全不选正确项 ⇒ quizInvalid、零请求', () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    fillQuiz(container)
    fireEvent.click(container.querySelector('[data-sf-field="quiz-correct-b"]')) // 取消唯一勾选
    submitForm(container)
    expectZero(container, 'project.quizInvalid')
  })

  it('奖励 0 ⇒ rewardInvalid、零请求', () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    fillQuiz(container, { reward: '0' })
    submitForm(container)
    expectZero(container, 'project.rewardInvalid')
  })

  it('奖励留空 ⇒ rewardInvalid、零请求', () => {
    const { container } = renderPublishForm()
    pickType(container, 'quiz')
    fillQuiz(container, { reward: null })
    submitForm(container)
    expectZero(container, 'project.rewardInvalid')
  })
})

// ============================================================================
describe('④ 参与侧 · prediction = Yes/No 两按钮', () => {
  it('两枚按钮文案 = Yes/No、data-sf-choice = yes/no；投票载荷 {choice:"yes"}', async () => {
    PROOF_API.submitSubtaskProof.mockResolvedValue({ payload: { choice: 'yes' }, time_created: '2026-10-22T10:00:00.000Z' })
    const { container } = renderItem(subtaskOf())
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes).toHaveLength(2)
    expect(votes.map((node) => node.getAttribute('data-sf-choice'))).toEqual(['yes', 'no'])
    expect(votes.map((node) => node.querySelector('.sf-campaign-vote-key').textContent.trim()))
      .toEqual([zh.campaign.predictionYes, zh.campaign.predictionNo])

    fireEvent.click(votes[0])
    fireEvent.click(container.querySelector('[data-sf-m="campaign-prediction-submit"]'))
    await waitFor(() => expect(PROOF_API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(PROOF_API.submitSubtaskProof.mock.calls[0][1]).toEqual({ choice: 'yes' })
  })

  it('服务端 my_proof 的旧值 a/b 归一：choice:"b" ⇒ 选中「否」', () => {
    const { container } = renderItem(subtaskOf({
      my_proof: { payload: { choice: 'b' }, time_created: '2026-10-22T09:00:00.000Z' },
    }))
    const votes = [...container.querySelectorAll('[data-sf-m="campaign-vote"]')]
    expect(votes[1].getAttribute('data-sf-picked')).toBe('1')
    expect(votes[0].getAttribute('data-sf-picked')).toBe('0')
  })
})

// ============================================================================
describe('⑤ 参与侧 · quiz 四选项多选 + 提交', () => {
  it('未选就提交 ⇒ pickAtLeastOne、零请求', async () => {
    const { container } = renderItem(quizSubtask())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-quiz-submit"]'))
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="campaign-quiz-notice"]').textContent)
        .toContain(zh.campaign.quiz.pickAtLeastOne)
    })
    expect(PROOF_API.submitSubtaskProof).not.toHaveBeenCalled()
  })

  it('多选两项 ⇒ 载荷 {answers:{picks:[...]}}；答对回 quiz_correct/reward_paid ⇒ 显奖励', async () => {
    PROOF_API.submitSubtaskProof.mockResolvedValue({ quiz_correct: true, reward_paid: '9', time_created: '2026-10-22T10:00:00.000Z' })
    const { container } = renderItem(quizSubtask())

    const options = [...container.querySelectorAll('[data-sf-m="campaign-quiz-option"]')]
    expect(options).toHaveLength(4)
    expect(options.map((node) => node.getAttribute('data-sf-pick'))).toEqual(['a', 'b', 'c', 'd'])

    fireEvent.click(options[1])
    fireEvent.click(options[3])
    expect(options[1].getAttribute('aria-pressed')).toBe('true')
    expect(options[3].getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(container.querySelector('[data-sf-m="campaign-quiz-submit"]'))
    await waitFor(() => expect(PROOF_API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    expect(PROOF_API.submitSubtaskProof.mock.calls[0][1]).toEqual({ answers: { picks: ['b', 'd'] } })

    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-quiz-result"]')).not.toBeNull())
    const result = container.querySelector('[data-sf-m="campaign-quiz-result"]')
    expect(result.getAttribute('data-sf-correct')).toBe('1')
    expect(result.getAttribute('data-sf-reward')).toBe('9')
    expect(result.textContent).toContain(zh.campaign.quiz.right)
    expect(container.querySelector('[data-sf-m="campaign-quiz-paid"]').textContent)
      .toContain(t('campaign.prediction.payout', { amount: '9' }))
  })

  it('答错（quiz_correct:false）⇒ 显答错、**不显发货金额**（reward_amount 在场也不显）', async () => {
    PROOF_API.submitSubtaskProof.mockResolvedValue({ quiz_correct: false, time_created: '2026-10-22T10:00:00.000Z' })
    const { container } = renderItem(quizSubtask())
    fireEvent.click(container.querySelector('[data-sf-pick="a"]'))
    fireEvent.click(container.querySelector('[data-sf-m="campaign-quiz-submit"]'))

    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-quiz-result"]')).not.toBeNull())
    const result = container.querySelector('[data-sf-m="campaign-quiz-result"]')
    expect(result.getAttribute('data-sf-correct')).toBe('0')
    expect(result.textContent).toContain(zh.campaign.quiz.wrong)
    expect(container.querySelector('[data-sf-m="campaign-quiz-paid"]')).toBeNull()
  })

  it('服务端无判定 ⇒ 不渲染结果块（公开读口无 correct，前端不本地推算）', async () => {
    PROOF_API.submitSubtaskProof.mockResolvedValue({ proof_id: '11', time_created: '2026-10-22T10:00:00.000Z' })
    const { container } = renderItem(quizSubtask())
    fireEvent.click(container.querySelector('[data-sf-pick="a"]'))
    fireEvent.click(container.querySelector('[data-sf-m="campaign-quiz-submit"]'))

    await waitFor(() => expect(PROOF_API.submitSubtaskProof).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-proof-submitted"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="campaign-quiz-result"]')).toBeNull()
    expect(container.textContent).not.toContain(zh.campaign.quiz.right)
    expect(container.textContent).not.toContain(zh.campaign.quiz.wrong)
  })
})

// ============================================================================
describe('⑥ 本次新增 12 键四语齐备', () => {
  const NEW_KEYS = [
    'campaign.predictionYes', 'campaign.predictionNo',
    'campaign.quiz.picks', 'campaign.quiz.pickAtLeastOne', 'campaign.quiz.right',
    'campaign.quiz.wrong', 'campaign.quiz.reward',
    'project.fQuizOptions', 'project.fQuizOption', 'project.fQuizCorrect',
    'project.fQuizReward', 'project.quizInvalid',
  ]

  it('12 键在四语均为非空字符串；en/vn 零 CJK', () => {
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
