/**
 * ★S13 修 `/task/review` 判「合格」报 409 单测（Kong · 本单新增）
 *
 * 缺陷（Kevin 亲报）：`JobReviewPage.decide` 调 `reviewSubmission(jobId, approved, user)` **只传 3 参**
 *   ⇒ body 仅 `{approved}`、缺 `submission_id` ⇒ 后端落**遗留单笔分支**
 *   （`backend-ts/src/index.ts:2464` / `job-funds-service.ts:234`）⇒ 在 **0042 新模型**下必失败
 *   （`409 LEDGER_CURRENCY_INVALID_TRANSITION`）⇒ 前端文案「当前状态不允许此变更」。
 *
 * 修法：`decide` 取 `jobId = String(item.tID ?? '')`（URL）与 `submissionId = item.jID`（body），
 *   调 `reviewSubmission(jobId, approved, user, submissionId)`。
 *   `database.ts:4013-4014` 现取：`tID` = `job_id`、`jID` = `submission_id`（两值都在）。
 *
 * 本文件断言（对应本单要求 ④）：
 *   ① 点「合格」⇒ `POST /api/job/<tID>/review` body **必含** `submission_id = jID`（URL 用任务号）。
 *   ② 点「不合格」⇒ 同上带 `submission_id`（`approved:false`）。
 *   ③ **逐行各自提交号**：同 job 两条 pending（jID=235/236）⇒ 各按其行发 `submission_id`（不串）。
 *   ④ **负对照锚**：`reviewSubmission(...)` 少传第 4 参 ⇒ body **不含** `submission_id`
 *      （= 本单 409 的根因机制；页面测试① 即「传了第 4 参」的判定 ⇒ 去掉 ⇒ ① 必红）。
 *
 * 口径：真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 `s7-submissions-panel` 先例）；
 *   i18n 用**真 zh 词典**（`react-i18next` 替身取模块级稳定函数，避免无限重渲染）。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

// i18n 替身：真 zh 词典 + `{{var}}` 插值（模块级稳定函数）
const H = vi.hoisted(() => {
  const state = { table: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    if (v === undefined) return key
    return opts ? String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : v
  }
  return state
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, token: 't' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 审核入口需 `review_tasks` 能力 ⇒ 桩为有权（唯一真源仍是后端 requireAdmin）。
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, can_access_admin: true, permissions: ['review_tasks'] })),
  hasAdminPermission: vi.fn(() => true),
}))

// ★ 不 mock `job-api` / `auth`：真接线层 + 真 `fetchApiJson`（stubbed `fetch`）——联测承重。
import { reviewSubmission } from '../../pages/jobs/job-api'
import JobReviewPage from '../../pages/jobs/JobReviewPage'

const ROW_A = { jID: 235, tID: 2, uID: 1, info_input: 'work A', time_created: 1791037353 }
const ROW_B = { jID: 236, tID: 2, uID: 2, info_input: 'work B', time_created: 1791037354 }

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const routed = (rows = [ROW_A]) => vi.fn(async (url) => {
  const u = String(url)
  if (u.endsWith('/review')) return jsonResponse(200, { success: true, data: {} })
  if (u.includes('/api/tasklist/pending-verification')) return jsonResponse(200, { success: true, data: rows })
  return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'nf' } })
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/task/review']}>
    <JobReviewPage />
  </MemoryRouter>,
)
const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)
const qa = (m) => [...document.querySelectorAll(`[data-sf-m="${m}"]`)]
const reviewCall = () => fetch.mock.calls.find((c) => String(c[0]).endsWith('/review'))
const bodyOf = () => JSON.parse(reviewCall()[1].body)

beforeEach(() => { H.table = zh })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// ① 点「合格」⇒ URL = 任务号 tID、body 必含 submission_id = 提交号 jID
// ============================================================================
describe('① 判「合格」逐笔调用（URL=job_id / body 带 submission_id=submission_id）', () => {
  it('点「合格」⇒ POST /api/job/2/review body {approved:true, submission_id:235}', async () => {
    vi.stubGlobal('fetch', routed([ROW_A]))
    renderPage()
    await waitFor(() => expect(q('jobs-approve')).not.toBeNull())
    await act(async () => { fireEvent.click(q('jobs-approve')) })

    const call = reviewCall()
    expect(call).toBeTruthy()
    expect(call[0]).toBe('/api/job/2/review')            // URL = tID（任务号）
    expect(call[1].method).toBe('POST')
    expect(bodyOf()).toEqual({ approved: true, submission_id: 235 })
    expect('submission_id' in bodyOf()).toBe(true)       // ★ 必含键（409 根因判定）
  })

  it('点「不合格」⇒ body {approved:false, submission_id:235}（逐笔零资金）', async () => {
    vi.stubGlobal('fetch', routed([ROW_A]))
    renderPage()
    await waitFor(() => expect(q('jobs-reject')).not.toBeNull())
    await act(async () => { fireEvent.click(q('jobs-reject')) })
    expect(bodyOf()).toEqual({ approved: false, submission_id: 235 })
  })
})

// ============================================================================
// ② 逐行各自提交号（同 job 两条 ⇒ 不串）
// ============================================================================
describe('② 同 job 两条 pending ⇒ 各按其行的 jID 发 submission_id', () => {
  it('点第 1 行 ⇒ submission_id=235；点第 2 行 ⇒ submission_id=236', async () => {
    vi.stubGlobal('fetch', routed([ROW_A, ROW_B]))
    renderPage()
    await waitFor(() => expect(qa('jobs-approve').length).toBe(2))

    await act(async () => { fireEvent.click(qa('jobs-approve')[0]) })
    expect(bodyOf()).toEqual({ approved: true, submission_id: 235 })

    await act(async () => { fireEvent.click(qa('jobs-approve')[1]) })
    // 取**最后一次** /review 调用（第 2 行）
    const calls = fetch.mock.calls.filter((c) => String(c[0]).endsWith('/review'))
    expect(JSON.parse(calls[calls.length - 1][1].body)).toEqual({ approved: true, submission_id: 236 })
  })
})

// ============================================================================
// ③ 负对照锚：少传第 4 参 ⇒ body 不含 submission_id（409 根因机制）
// ============================================================================
describe('③ 负对照：接线层缺第 4 参 ⇒ body 无 submission_id（页面① 的判定即由此必红）', () => {
  it('reviewSubmission(2, true, null)（3 参）⇒ body {approved:true}，无 submission_id', async () => {
    vi.stubGlobal('fetch', routed())
    await reviewSubmission(2, true, null)
    const body = JSON.parse(reviewCall()[1].body)
    expect(body).toEqual({ approved: true })
    expect('submission_id' in body).toBe(false)
  })

  it('reviewSubmission(2, true, null, 235)（4 参）⇒ body {approved:true, submission_id:235}', async () => {
    vi.stubGlobal('fetch', routed())
    await reviewSubmission(2, true, null, 235)
    expect(JSON.parse(reviewCall()[1].body)).toEqual({ approved: true, submission_id: 235 })
  })
})
