/**
 * ★S7 悬赏家评判列表接线 单测（Kong · 本单新增）
 *
 * 接口（S6 已入库，现取核实；本单不自造）：
 *   · 读口 `GET /api/job/:jobId/submissions`（`backend-ts/src/index.ts:2483`）⇒ `data` = 逐条 9 键；
 *   · 判定口 `POST /api/job/:jobId/review`（`:2451`）body = `{ approved, submission_id }`。
 *   准入（两口同族）= 「发布者本人 ∨ 持 `review_tasks`」⇒ 非本人且无权限 **403 AUTH_FORBIDDEN**。
 *
 * 本文件八组断言（对应本单要求 ①–④ + 自证 ③/④）：
 *   ① 接线层：`listJobSubmissions` = GET 该路径；`reviewSubmission` = POST 且 body 含 `submission_id`
 *      （3 参旧调用 ⇒ body **不含** `submission_id` ⇒ 服务层遗留分支，零回归）。
 *   ② 页面：读口 200（过归属闸）⇒ 渲染「提交列表」，逐条 提交人 + 交付物 + 状态（三态**查表**四语）。
 *   ③ 仅 `pending` 条给「合格」/「不合格」两按钮；`approved`/`rejected` 条无按钮。
 *   ④ 点「合格」⇒ `POST /api/job/<id>/review` body `{approved:true, submission_id}`；成功后刷新列表。
 *   ⑤ 读口 **403（非发布者）⇒ 整块不渲染**（仅发布者可见；判定复用既有归属闸，不另写）。
 *   ⑥ 判定失败：`details.reason` 命中既有映射 ⇒ 复用既有 reason→文案（`battCard.insufficient`）——不另建。
 *   ⑦ 新增 10 键四语齐备、非空、en/vn 零 CJK。
 *   ⑧ 键计数：顶层 119 不变 / 拍平 1059 / 四语节点 4236（S8 前推：+1 jobs.deliverable；S9 前推：+4 ledger.kind 键/语）。
 *
 * 口径：真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 `d1-error-machineface` 联测先例）；
 *   i18n 用**真 zh 词典**逐字断言（`react-i18next` 替身取模块级稳定函数，避免无限重渲染）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// ★ 不 mock `job-api` / `auth`：真接线层 + 真 `fetchApiJson`（stubbed `fetch`）——联测承重。
import { listJobSubmissions, reviewSubmission } from '../../pages/jobs/job-api'
import JobDetailPage from '../../pages/jobs/JobDetailPage'

const ROW_PENDING = { submission_id: 97, job_id: 9, worker_uid: 1, deliverable: 'work A', review_status: 'pending', reviewed_by: null, reviewed_at: 0, review_memo: '', time_created: 1791037353 }
const ROW_APPROVED = { ...ROW_PENDING, submission_id: 96, worker_uid: 2, deliverable: 'work B', review_status: 'approved' }
const ROW_REJECTED = { ...ROW_PENDING, submission_id: 95, worker_uid: 3, deliverable: 'work C', review_status: 'rejected' }

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const FORBIDDEN = {
  success: false,
  error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden', i18n_key: 'auth.err.AUTH_FORBIDDEN', details: { reason: 'NOT_ADMIN' } },
}

/** stubbed `fetch` 路由：提交读口 / 逐笔判定 / 我的提交 / 任务详情。 */
const routed = ({ rows = [ROW_PENDING], forbidden = false, review = { status: 200, body: { success: true, data: {} } } } = {}) =>
  vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/submissions')) {
      return forbidden ? jsonResponse(403, FORBIDDEN) : jsonResponse(200, { success: true, data: rows })
    }
    if (u.endsWith('/review')) return jsonResponse(review.status, review.body)
    if (u.includes('/api/task-progress')) return jsonResponse(200, { success: true, data: [] })
    if (u.includes('/api/task/')) return jsonResponse(200, { success: true, data: { tID: 9, title: 'x', points: 5, participants_count: 0 } })
    return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'nf' } })
  })

const renderPage = () => render(
  <MemoryRouter initialEntries={['/job/9']}>
    <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
  </MemoryRouter>,
)

const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)
const qa = (m) => [...document.querySelectorAll(`[data-sf-m="${m}"]`)]
const callsTo = (part) => fetch.mock.calls.filter((c) => String(c[0]).includes(part))

beforeEach(() => { H.table = zh })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// ① 接线层：URL + body 形态（与 S6 逐字一致）
// ============================================================================
describe('① 接线层 URL/body（S6 契约）', () => {
  it('listJobSubmissions(9) ⇒ GET /api/job/9/submissions（无 body）', async () => {
    vi.stubGlobal('fetch', routed({ rows: [] }))
    await listJobSubmissions(9, null)
    const call = callsTo('/submissions')[0]
    expect(call[0]).toBe('/api/job/9/submissions')
    expect(call[1].body).toBeUndefined()
  })

  it('reviewSubmission(9, true, user, 97) ⇒ POST /api/job/9/review，body = {approved, submission_id}', async () => {
    vi.stubGlobal('fetch', routed())
    await reviewSubmission(9, true, null, 97)
    const call = fetch.mock.calls.find((c) => String(c[0]).endsWith('/review'))
    expect(call[0]).toBe('/api/job/9/review')
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body)).toEqual({ approved: true, submission_id: 97 })
  })

  it('★零回归：3 参旧调用（JobReviewPage）⇒ body 不含 submission_id（服务层落遗留分支）', async () => {
    vi.stubGlobal('fetch', routed())
    await reviewSubmission(9, false, null)
    const call = fetch.mock.calls.find((c) => String(c[0]).endsWith('/review'))
    const body = JSON.parse(call[1].body)
    expect(body).toEqual({ approved: false })
    expect('submission_id' in body).toBe(false)
  })
})

// ============================================================================
// ② 页面：过归属闸（读口 200）⇒ 渲染提交列表，逐条 提交人 + 交付物 + 状态（查表四语）
// ============================================================================
describe('② 发布者视角提交列表（读口 200 ⇒ 渲染）', () => {
  it('逐条展示：提交人(#worker) + 交付物 + 状态（pending/approved/rejected 四语真文案）', async () => {
    vi.stubGlobal('fetch', routed({ rows: [ROW_PENDING, ROW_APPROVED, ROW_REJECTED] }))
    renderPage()
    await waitFor(() => expect(q('jobs-submissions')).not.toBeNull())

    expect(q('jobs-submissions').textContent).toContain(zh.jobs.submissions)
    expect(qa('jobs-submission-item').length).toBe(3)

    const titles = qa('jobs-submission-title').map((e) => e.textContent)
    expect(titles[0]).toContain('#97')
    expect(titles[0]).toContain('#1')       // 提交人（worker_uid 用户标识展示）
    expect(titles[1]).toContain('#96')
    expect(titles[1]).toContain('#2')

    expect(qa('jobs-submission-deliverable').map((e) => e.textContent)).toEqual(['work A', 'work B', 'work C'])

    const stats = qa('jobs-submission-status').map((e) => e.textContent)
    expect(stats).toEqual([zh.jobs.subStatusPending, zh.jobs.subStatusApproved, zh.jobs.subStatusRejected])
    // 不得原样渲染 review_status 枚举值
    for (const v of stats) expect(['pending', 'approved', 'rejected']).not.toContain(v)
  })

  it('空列表 ⇒ 空态（submissionsEmpty），不崩', async () => {
    vi.stubGlobal('fetch', routed({ rows: [] }))
    renderPage()
    await waitFor(() => expect(q('jobs-submissions-empty')).not.toBeNull())
    expect(q('jobs-submissions-empty').textContent).toBe(zh.jobs.submissionsEmpty)
  })
})

// ============================================================================
// ③ 仅 pending 条给两按钮
// ============================================================================
describe('③ 仅 pending 条给「合格」/「不合格」', () => {
  it('3 条（pending/approved/rejected）⇒ 合格/不合格按钮各恰 1 个', async () => {
    vi.stubGlobal('fetch', routed({ rows: [ROW_PENDING, ROW_APPROVED, ROW_REJECTED] }))
    renderPage()
    await waitFor(() => expect(q('jobs-submissions')).not.toBeNull())
    expect(qa('jobs-submission-qualify').length).toBe(1)
    expect(qa('jobs-submission-disqualify').length).toBe(1)
    expect(q('jobs-submission-qualify').textContent).toBe(zh.jobs.markQualified)
    expect(q('jobs-submission-disqualify').textContent).toBe(zh.jobs.markUnqualified)
  })
})

// ============================================================================
// ④ 判定调用后刷新列表
// ============================================================================
describe('④ 判定 ⇒ POST 逐笔 + 刷新列表', () => {
  it('点「合格」⇒ body {approved:true, submission_id:97}；随后重读提交列表', async () => {
    vi.stubGlobal('fetch', routed({ rows: [ROW_PENDING] }))
    renderPage()
    await waitFor(() => expect(q('jobs-submission-qualify')).not.toBeNull())
    const before = callsTo('/submissions').length

    await act(async () => { fireEvent.click(q('jobs-submission-qualify')) })

    const reviewCall = fetch.mock.calls.find((c) => String(c[0]).endsWith('/review'))
    expect(reviewCall).toBeTruthy()
    expect(JSON.parse(reviewCall[1].body)).toEqual({ approved: true, submission_id: 97 })
    await waitFor(() => expect(callsTo('/submissions').length).toBeGreaterThan(before))
  })

  it('点「不合格」⇒ body {approved:false, submission_id:97}（零资金、该提交转 rejected；后端 S6/S6b 口径）', async () => {
    vi.stubGlobal('fetch', routed({ rows: [ROW_PENDING] }))
    renderPage()
    await waitFor(() => expect(q('jobs-submission-disqualify')).not.toBeNull())
    await act(async () => { fireEvent.click(q('jobs-submission-disqualify')) })
    const reviewCall = fetch.mock.calls.find((c) => String(c[0]).endsWith('/review'))
    expect(JSON.parse(reviewCall[1].body)).toEqual({ approved: false, submission_id: 97 })
  })
})

// ============================================================================
// ⑤ 仅发布者可见：读口 403 ⇒ 整块不渲染
// ============================================================================
describe('⑤ 非发布者（读口 403）⇒ 提交列表整块不渲染', () => {
  it('403 AUTH_FORBIDDEN ⇒ 无 jobs-submissions 区块（不把 403 当首屏反馈）', async () => {
    vi.stubGlobal('fetch', routed({ forbidden: true }))
    renderPage()
    await waitFor(() => expect(q('jobs-submit-form')).not.toBeNull())
    await waitFor(() => expect(callsTo('/submissions').length).toBeGreaterThan(0))
    await act(async () => { await Promise.resolve() })
    expect(q('jobs-submissions')).toBeNull()
    expect(q('jobs-submission-item')).toBeNull()
  })
})

// ============================================================================
// ⑥ 判定失败：复用既有 reason→文案映射（不另建）
// ============================================================================
describe('⑥ 判定失败按既有惯例', () => {
  it('reason = BATT_BELOW_ACCEPT_THRESHOLD ⇒ 复用既有映射（battCard.insufficient），非机读码', async () => {
    const body = {
      success: false,
      error: {
        code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
        message: 'Business state transition rejected',
        i18n_key: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
        details: { field: 'batt', reason: 'BATT_BELOW_ACCEPT_THRESHOLD' },
      },
    }
    vi.stubGlobal('fetch', routed({ rows: [ROW_PENDING], review: { status: 409, body } }))
    renderPage()
    await waitFor(() => expect(q('jobs-submission-qualify')).not.toBeNull())
    await act(async () => { fireEvent.click(q('jobs-submission-qualify')) })
    // 先经 loading 态（jobs.submitting）⇒ 等落定终态
    await waitFor(() => expect(q('jobs-submission-action-status').textContent).not.toBe(zh.jobs.submitting))
    expect(q('jobs-submission-action-status').textContent).toBe(zh.battCard.insufficient)
    expect(q('jobs-submission-action-status').textContent).not.toContain('BATT_BELOW_ACCEPT_THRESHOLD')
  })
})

// ============================================================================
// ⑦⑧ 文案键：四语齐备 + 计数（值-只改 = 0；新增 = 10）
// ============================================================================
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/
const readTable = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))

const NEW_KEYS = [
  'jobs.submissions',
  'jobs.submissionsEmpty',
  'jobs.submissionItemTitle',
  'jobs.subStatusPending',
  'jobs.subStatusApproved',
  'jobs.subStatusRejected',
  'jobs.markQualified',
  'jobs.markUnqualified',
  'jobs.reviewQualifiedOk',
  'jobs.reviewUnqualifiedOk',
]

describe('⑦ 新增 10 键四语齐备（逐字）', () => {
  const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flat(readTable(l)))]))

  it('四语齐备、非空串；en/vn 零 CJK', () => {
    const problems = []
    for (const k of NEW_KEYS) {
      for (const l of LANGS) {
        const v = TABLES[l][k]
        if (typeof v !== 'string' || !v.trim()) { problems.push(`${l}.${k} 空/缺`); continue }
        if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l}.${k} 残留中文 ${v}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('状态三键四语互异（真翻译，非照抄）', () => {
    for (const k of ['jobs.subStatusPending', 'jobs.subStatusApproved', 'jobs.subStatusRejected']) {
      const vals = LANGS.map((l) => TABLES[l][k])
      expect(new Set(vals).size, k).toBe(4)
    }
  })

  it('submissionItemTitle 四语均带 {{submission}} + {{worker}} 占位（逐字锚）', () => {
    for (const l of LANGS) {
      expect(TABLES[l]['jobs.submissionItemTitle']).toContain('{{submission}}')
      expect(TABLES[l]['jobs.submissionItemTitle']).toContain('{{worker}}')
    }
  })
})

describe('⑧ 键计数（S8 前推：S7 新增 10 + S8 新增 1；S9：+4 ledger.kind = 拍平 1059）', () => {
  it('顶层 119 不变 / 拍平 1059 / 四语节点 4236（S9 前推：+4 ledger.kind 键）', () => {
    for (const l of LANGS) {
      expect(Object.keys(readTable(l)).length, `${l} top`).toBe(119)
      expect(flat(readTable(l)).length, `${l} flat`).toBe(1059)
    }
    expect(flat(readTable('zh')).length * LANGS.length).toBe(4236)
  })
})
