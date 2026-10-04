/**
 * ★S17a 前端放开 `/task/review` 的门（Kong · 本单新增）
 *
 * 背景：S16 后端（`backend-ts/src/index.ts` `resolveReviewQueueScope`）已把待审队列读口准入放宽为
 *   「**admin（持 `review_tasks`）∨ 已登录**」——非 admin 只返回其 `job.employer_uid` 命中的
 *   pending 提交（过滤谓词 list/count **两处同源**）；未登录 ⇒ 401。
 *   ★ 但改前前端门 = `hasAdminPermission(access, 'review_tasks')` ⇒ 普通发布者仍渲染
 *     `jobs-review-denied`、**根本不发起队列读** ⇒ 后端放宽对普通用户**无效**。
 *
 * 本单修法：`JobReviewPage` 的 `canReview` 改为「**已登录即可**」（唯一真源 = 后端）；
 *   未登录 ⇒ 仍渲染登录提示、**不发起队列读**；★ **前端不另写「只看自己的」过滤**（避免两处各一套）。
 *
 * 本文件断言（对应本单自证 ③ 的「组件级」口径）：
 *   ① 已登录 + **无** `review_tasks`（普通发布者）⇒ **不**渲染 `jobs-review-denied`、且**发起**队列读 1 次；
 *      请求路径**不带**任何发布者/雇主参数（前端零过滤，过滤唯一真源在后端）。
 *   ② 未登录 ⇒ 渲染登录提示（`pleaseLogin`）、**不**发起任何 `/api/tasklist/pending-verification` 读。
 *   ③ 已登录路径**不**依赖 `/api/admin/me` 能力集（门 = 登录态，不是 admin；旧 `jobs-review-gate` 加载态消失）。
 *
 * 口径：真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 `s13-review-page-submission-id` 先例）；
 *   i18n 用**真 zh 词典**（`react-i18next` 替身取模块级稳定函数，避免无限重渲染）。
 */
import React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
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

// 可变登录态：各臂改 AUTH 字段即可切换「普通发布者 / 未登录」。
const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, token: 't' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// ★ 不 mock `job-api` / `auth`：真接线层 + 真 `fetchApiJson`（stubbed `fetch`）——联测承重。
import JobReviewPage from '../../pages/jobs/JobReviewPage'

const ROW_OWN = { jID: 242, tID: 22, uID: 9, info_input: 'my own job submission', time_created: 1791037353 }

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const routed = (rows = [ROW_OWN]) => vi.fn(async (url) => {
  const u = String(url)
  if (u.includes('/api/tasklist/pending-verification')) return jsonResponse(200, { success: true, data: rows })
  // ★ 若页面误发 `/api/admin/me`（旧口径）⇒ 落到这里，便于断言「不再依赖 admin 能力集」
  if (u.includes('/api/admin/me')) return jsonResponse(200, { success: true, data: { is_admin: false, permissions: [], can_access_admin: false } })
  return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'nf' } })
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/task/review']}>
    <JobReviewPage />
  </MemoryRouter>,
)
const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)
const pendingCalls = () => fetch.mock.calls.filter((c) => String(c[0]).includes('/api/tasklist/pending-verification'))
const adminMeCalls = () => fetch.mock.calls.filter((c) => String(c[0]).includes('/api/admin/me'))

beforeEach(() => {
  H.table = zh
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, token: 't' }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// ① 已登录普通发布者（无 review_tasks）⇒ 门放开：不再 denied、发起队列读
// ============================================================================
describe('① 已登录普通发布者 ⇒ 队列页放开（不再渲染 denied / 发起读）', () => {
  it('不渲染 jobs-review-denied；队列读 **1 次**；请求路径**不带**发布者/雇主参数（前端零过滤）', async () => {
    vi.stubGlobal('fetch', routed([ROW_OWN]))
    renderPage()

    await waitFor(() => expect(pendingCalls().length).toBe(1))
    // 不再收敛为无权限空态
    expect(q('jobs-review-denied')).toBeNull()
    // 队列项已渲染（读到数据即进队列面）
    await waitFor(() => expect(q('jobs-approve')).not.toBeNull())
    // ★ 过滤唯一真源在后端：前端请求路径**不带** uid/employer 等参数
    expect(String(pendingCalls()[0][0])).toBe('/api/tasklist/pending-verification')
  })

  it('★ 门 = 登录态（非 admin）：已登录路径**不**请求 `/api/admin/me` 能力集', async () => {
    vi.stubGlobal('fetch', routed([ROW_OWN]))
    renderPage()
    await waitFor(() => expect(pendingCalls().length).toBe(1))
    expect(adminMeCalls().length).toBe(0)
    // 旧加载态节点（能力集闸）已不存在
    expect(q('jobs-review-gate')).toBeNull()
  })
})

// ============================================================================
// ② 未登录 ⇒ 登录提示、且**不发起任何队列读**
// ============================================================================
describe('② 未登录 ⇒ 登录提示（不发队列读）', () => {
  it('渲染 pleaseLogin；`/api/tasklist/pending-verification` 零请求', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    vi.stubGlobal('fetch', routed([ROW_OWN]))
    renderPage()

    await waitFor(() => expect(q('jobs-hero')).not.toBeNull())
    expect(document.body.textContent).toContain(zh.pleaseLogin)
    expect(pendingCalls().length).toBe(0)
    expect(q('jobs-queue')).toBeNull()
  })
})
