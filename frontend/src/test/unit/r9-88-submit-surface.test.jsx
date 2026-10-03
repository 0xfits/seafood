/**
 * R-9-88 单测（本单新增）· 招工详情「提交交付物」面 —— ★S3b 契约同步后更新
 *
 * 四组断言（逐条对应本单要求 ①–③）：
 *   ① 提交目标只读：提交区内可编辑控件**恰 1 个** = 交付物；目标读数 = **任务号（`job_id`）**，非手输框。
 *      旧 J2/J3 的 `jobs-apply` / `jobs-accept{,-panel}` 面板**已随接口下架删除**（本处断言其不在）。
 *   ② 无本人提交（`fetchMyApplications ⇒ []`）⇒ ★**仍渲染**提交表单（S2：无报名前置）。
 *      旧「先参与该任务」提示（`jobs-submit-need-apply`）已删。
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

// 通用结构面「可编辑控件」判定：input/textarea/select 中，排除 hidden / disabled / readonly。
// 与**钩子名**、**inputmode** 等属性无关 —— 任何真实的可编辑手输框（无论叫什么名字、带不带属性）都会被计入。
const editableControls = (root) => Array.from(root.querySelectorAll('input, textarea, select')).filter((el) => {
  if (el.tagName === 'INPUT' && el.type === 'hidden') return false
  if (el.disabled) return false
  if (el.readOnly) return false
  return true
})

beforeEach(() => {
  H.table = zh
  H.lang = 'zh'
  fetchJobDetail.mockReset().mockResolvedValue(JOB)
  fetchMyApplications.mockReset()
  submitDeliverable.mockReset()
})
afterEach(() => cleanup())

// ============================================================================
// ① 提交面：目标 = 目标 job_id（只读，通用结构面断言）
//
// ★ 收紧（保留 R-9-88 口径）：不用「钩子名 + inputmode」双限定（那会假绿 —— 一个**真实**的
//   手输框只要改用**新钩子名**且不带 inputmode 就能蒙混过关）。改为**通用结构面**口径：
//   提交表单内**可编辑控件计数**（input/textarea/select 减 hidden/disabled/readonly）恰 1 个，
//   且提交目标是**只读文本**（非 INPUT/TEXTAREA/SELECT）。
// ============================================================================
describe('① 提交面：目标 = 目标 job_id（只读，通用结构面断言）', () => {
  it('已登录 + 任务 open ⇒ 提交表单内**可编辑控件恰 1 个**（= 交付物），提交目标 = 只读 `#9` #9', async () => {
    fetchMyApplications.mockResolvedValue([{ jID: 24, tID: 9 }])
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())

    const form = q('jobs-submit-form')

    // 通用结构面：提交区内**可编辑控件恰 1 个**（通用计数，不依赖钩子名 / 属性）
    const controls = editableControls(form)
    expect(controls).toHaveLength(1)

    // 且该唯一可编辑控件 = 交付物输入框（提交面交付物）
    const deliverable = q('jobs-input-deliverable')
    expect(deliverable).not.toBeNull()
    expect(deliverable.tagName).toBe('INPUT')
    expect(controls[0]).toBe(deliverable)

    // ★S3b：提交目标 = **任务号（job_id）** —— 只读文本（**非** INPUT/TEXTAREA/SELECT），**逐字全等** `#9`
    const target = q('jobs-submit-target')
    expect(target).not.toBeNull()
    expect(['INPUT', 'TEXTAREA', 'SELECT']).not.toContain(target.tagName)
    expect(target.textContent).toBe(`#${JOB.tID}`)
  })

  it('★J2/J3 两面板已删：apply / accept 相关机读钩子全不在（前端零调用）', async () => {
    fetchMyApplications.mockResolvedValue([{ jID: 24, tID: 9 }])
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())

    for (const m of [
      'jobs-apply', 'jobs-apply-status',
      'jobs-accept-panel', 'jobs-accept', 'jobs-accept-status', 'jobs-input-accept',
      'jobs-submit-need-apply',
    ]) {
      expect(q(m), `${m} 应不存在`).toBeNull()
    }
  })
})

// ============================================================================
// ② 无本人提交 ⇒ **仍**渲染提交表单（S2：无报名前置）
// ============================================================================
describe('② 无本人提交 ⇒ 仍渲染提交表单（无报名前置）', () => {
  it('fetchMyApplications ⇒ [] ⇒ 提交表单/按钮仍在；旧「先参与」提示已删', async () => {
    fetchMyApplications.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())

    expect(q('jobs-submit')).not.toBeNull()
    expect(q('jobs-input-deliverable')).not.toBeNull()
    expect(q('jobs-submit-need-apply')).toBeNull()
  })
})

// ============================================================================
// ④ ★S3b：提交调用 `submitDeliverable(jobId)`（identifier = 目标 job_id）
// ============================================================================
describe('④ 提交 identifier = 路由任务号 jobId（非任何申请编号）', () => {
  it('提交 ⇒ submitDeliverable("9")（= 路由 /job/:jobId 的 jobId）', async () => {
    fetchMyApplications.mockResolvedValue([{ jID: 24, tID: 9 }])
    submitDeliverable.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())

    fireEvent.change(q('jobs-input-deliverable'), { target: { value: 'x' } })
    act(() => { fireEvent.submit(q('jobs-submit-form')) })
    await waitFor(() => expect(submitDeliverable).toHaveBeenCalledTimes(1))
    expect(String(submitDeliverable.mock.calls[0][0])).toBe('9')
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

  // R-9-94（同族补齐）：提交被拒的另两条 `stateConflict` reason ⇒ 亦给精确文案
  it('reason === JOB_APPLICATION_STATE_INVALID ⇒ 精确文案 jobs.submitNotSelected（未被雇主选定），非通用「当前状态不允许此变更。」', async () => {
    const err = Object.assign(new Error('Business state transition rejected'), {
      details: { reason: 'JOB_APPLICATION_STATE_INVALID' },
    })
    await doSubmit(err)
    const status = q('jobs-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitNotSelected)
    expect(status.textContent).not.toBe(zh.ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION)
  })

  it('reason === JOB_STATE_INVALID ⇒ 精确文案 jobs.submitJobStateInvalid（任务态不允许提交交付物）', async () => {
    const err = Object.assign(new Error('Business state transition rejected'), {
      details: { reason: 'JOB_STATE_INVALID' },
    })
    await doSubmit(err)
    const status = q('jobs-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitJobStateInvalid)
    expect(status.textContent).not.toBe(zh.ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION)
  })

  it('非该 reason（其它 reason 值）⇒ 保持原链路：通用文案逐字不变', async () => {
    const err = Object.assign(new Error('generic failure'), { details: { reason: 'SOME_OTHER_REASON' } })
    await doSubmit(err)
    const status = q('jobs-submit-status')
    // ★ 收紧（与 r9-90 对齐）：通用文案 = 产品 `String(error?.message || t('error'))` ⇒ **逐字全等**
    expect(status.textContent).toBe(String(err.message || zh.error))
    expect(status.textContent).not.toBe(zh.jobs.submitNotApplicant)
  })

  it('拿不到 reason（无 details）⇒ 保持原链路：通用文案逐字不变', async () => {
    const err = new Error('network down')
    await doSubmit(err)
    const status = q('jobs-submit-status')
    // ★ 收紧（与 r9-90 对齐）：通用文案 = 产品 `String(error?.message || t('error'))` ⇒ **逐字全等**
    expect(status.textContent).toBe(String(err.message || zh.error))
    expect(status.textContent).not.toBe(zh.jobs.submitNotApplicant)
  })
})
