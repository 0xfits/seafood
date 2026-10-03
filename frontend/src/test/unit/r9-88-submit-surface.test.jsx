/**
 * R-9-88 单测（本单新增）· 招工详情「提交交付物」面
 *
 * 四组断言（逐条对应本单要求 ①–③）：
 *   ① 提交目标**只能**由「我的报名」条目带出 ⇒ 提交表单内**不存在** application_id 可编辑手输框
 *      （旧 `data-sf-m="jobs-input-identifier"` 机读位已删）；当前目标仅以**只读**文本呈现。
 *   ② 无本人申请（`fetchMyApplications ⇒ []`）⇒ **不渲染**提交表单/提交按钮，改给「先参与该任务」提示。
 *   ③ 提交捕错分支：`error.details.reason === 'ACTOR_NOT_ALLOWED'` ⇒ 显示**精确文案**
 *      （`jobs.submitNotApplicant`），且**不等于**通用 `auth.err.AUTH_FORBIDDEN`；
 *      非该 reason（拿不到 / 其它值）⇒ 保持原链路（通用文案）**逐字不变**。
 *
 * 口径：i18n 用真四语表（zh）逐字断言；`useAuth` / `job-api` 按既有单测口径 mock。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const H = vi.hoisted(() => {
  const state = { lang: 'zh', table: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    return v === undefined ? key : v
  }
  return state
})

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

vi.mock('../../pages/jobs/job-api', () => ({
  fetchJobDetail: vi.fn(),
  fetchMyApplications: vi.fn(),
  applyToJob: vi.fn(),
  acceptApplication: vi.fn(),
  submitDeliverable: vi.fn(),
}))

import { fetchJobDetail, fetchMyApplications, submitDeliverable } from '../../pages/jobs/job-api'
import JobDetailPage from '../../pages/jobs/JobDetailPage'

const JOB = { tID: 9, title: 'x', points: 5, participants_count: 0 }

const renderPage = () => render(
  <MemoryRouter initialEntries={['/job/9']}>
    <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
  </MemoryRouter>,
)

const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)

beforeEach(() => {
  H.table = zh
  H.lang = 'zh'
  fetchJobDetail.mockReset().mockResolvedValue(JOB)
  fetchMyApplications.mockReset()
  submitDeliverable.mockReset()
})
afterEach(() => cleanup())

// ============================================================================
// ① 提交目标 = 只读（无 application_id 手输框）
// ============================================================================
describe('① 提交面：application_id 只能由「我的报名」带出（无手输框）', () => {
  it('有本人申请 ⇒ 渲染提交表单，但**不存在**可编辑的 application_id 输入框；目标只读展示 #24', async () => {
    fetchMyApplications.mockResolvedValue([{ jID: 24, tID: 9 }])
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())

    // 旧手输框（机读位 jobs-input-identifier）已删
    expect(q('jobs-input-identifier')).toBeNull()
    // 提交表单内**无**任何 `inputMode=numeric`（旧 application_id 手输框属性）
    const form = q('jobs-submit-form')
    expect(form.querySelector('input[inputmode="numeric"]')).toBeNull()

    // 当前目标 = 只读文本（非 INPUT），逐字含 `#24` 与「申请编号」标签
    const target = q('jobs-submit-target')
    expect(target).not.toBeNull()
    expect(target.tagName).not.toBe('INPUT')
    expect(target.textContent).toContain('#24')
    expect(target.textContent).toContain(zh.jobs.applicationId)

    // 交付物输入框仍在（这是提交面唯一可编辑项）
    const deliverable = q('jobs-input-deliverable')
    expect(deliverable).not.toBeNull()
    expect(deliverable.tagName).toBe('INPUT')
  })
})

// ============================================================================
// ② 无本人申请 ⇒ 不给提交表单，改给「先参与」提示
// ============================================================================
describe('② 无本人申请 ⇒ 不渲染提交表单，给「先参与该任务」提示', () => {
  it('fetchMyApplications ⇒ [] ⇒ 无提交表单/提交按钮，出现 jobs-submit-need-apply（逐字 = jobs.submitNeedApply）', async () => {
    fetchMyApplications.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(q('jobs-submit-need-apply')).not.toBeNull())

    expect(q('jobs-submit-form')).toBeNull()
    expect(q('jobs-submit')).toBeNull()
    expect(q('jobs-input-identifier')).toBeNull()
    expect(q('jobs-input-deliverable')).toBeNull()

    const hint = q('jobs-submit-need-apply')
    expect(hint.textContent).toContain(zh.jobs.submitNeedApply)
  })
})

// ============================================================================
// ③ 提交捕错分支：ACTOR_NOT_ALLOWED ⇒ 精确文案；其它 ⇒ 原链路
// ============================================================================
describe('③ 提交捕错分支：按 error.details.reason 分流', () => {
  const doSubmit = async (rejection) => {
    fetchMyApplications.mockResolvedValue([{ jID: 24, tID: 9 }])
    submitDeliverable.mockRejectedValue(rejection)
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())
    act(() => { fireEvent.submit(q('jobs-submit-form')) })
    // 先经 loading 态（`jobs.submitting`）⇒ 等它落定到终态（error 文案）再断言
    await waitFor(() => expect(q('jobs-submit-status').textContent).not.toBe(zh.jobs.submitting))
  }

  it('reason === ACTOR_NOT_ALLOWED ⇒ 精确文案 jobs.submitNotApplicant（不是通用「无权执行该操作」）', async () => {
    const err = Object.assign(new Error(zh.auth.err.AUTH_FORBIDDEN), { details: { reason: 'ACTOR_NOT_ALLOWED' } })
    await doSubmit(err)
    const status = q('jobs-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitNotApplicant)
    expect(status.textContent).not.toBe(zh.auth.err.AUTH_FORBIDDEN)
  })

  it('非该 reason（其它 reason 值）⇒ 保持原链路：通用文案逐字不变', async () => {
    const err = Object.assign(new Error('generic failure'), { details: { reason: 'SOME_OTHER_REASON' } })
    await doSubmit(err)
    const status = q('jobs-submit-status')
    expect(status.textContent).toContain('generic failure')
    expect(status.textContent).not.toBe(zh.jobs.submitNotApplicant)
  })

  it('拿不到 reason（无 details）⇒ 保持原链路：通用文案逐字不变', async () => {
    await doSubmit(new Error('network down'))
    const status = q('jobs-submit-status')
    expect(status.textContent).toContain('network down')
    expect(status.textContent).not.toBe(zh.jobs.submitNotApplicant)
  })
})
