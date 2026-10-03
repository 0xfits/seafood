/**
 * D1 补丁单 · `fetchApiJson` 抛错携带**机读面**（R-9-83 体验闭环接通）
 * ============================================================================
 * 缺陷（本单现取坐实）：`auth.js` 的 `fetchApiJson` 抛 `new Error(message)` 时**丢掉**了
 * `payload.error` 的机读面（`details` / `code` / `i18n_key`）；而 `JobDetailPage` 的闭环判据是
 * `error?.details?.reason === 'BATT_BELOW_ACCEPT_THRESHOLD'`（`pages/jobs/JobDetailPage.jsx:92`）
 * ⇒ 恒 `undefined` ⇒ 「被拒 ⇒ 一键去签到」提示**永不渲染**。
 *
 * 本文件四组判据（逐条可判负）：
 *   ① 单测：`409` + `R107` 体 ⇒ `err.details.reason` / `err.code` / `err.i18nKey` **逐字**；
 *      `err.message` 与**改前**（真 `apiErrorMessage` + 真 zh 词典）**逐字相同**，且机读码 / `reason`
 *      / 裸 i18n 键**绝不出现在 message**（护栏）。
 *   ② 负对照：响应**无 `details`** ⇒ `err.details === undefined`（不制造空面）；旧面（无 `error` 对象）
 *      ⇒ 三面皆 `undefined`，`message` 仍取服务端原文。
 *   ③ 联测（关键）：**真** `fetchApiJson`（经**真** `job-api`）+ 真 `JobDetailPage` render ⇒ `409/BATT`
 *      体下**确实渲染出可点击提示** `<a href="/profile#batt-checkin">`，文案 = 真 zh 词典。
 *   ④ 联测负对照：被拒但 `reason ≠ 电量门槛` ⇒ **不渲染**该提示（证明其非恒真）。
 *
 * 硬口径：本单只改 `auth.js` + 新增本测试文件；`message` 取值与既有链路逐字不变。
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '../../i18n' // 真 i18n 实例（jsdom 路径 `/` ⇒ lng = zh）
import zh from '../../locales/zh.json'
import {
  apiErrorMessage,
  containsBareI18nKey,
  containsMachineCode,
  fetchApiJson,
} from '../../auth'

// 真 `JobDetailPage` 依赖 `useAuth`；本单**只**替换「已登录」上下文 ——
// `job-api` / `auth.js` / `fetchApiJson` / `fetch` 路由全部**保持真身**（联测关键）。
const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

import JobDetailPage from '../../pages/jobs/JobDetailPage'

// ★ 真体：后端 `job-service.ts` 两处 `stateConflict('batt','BATT_BELOW_ACCEPT_THRESHOLD',…)`
//   经 `sendVerbError` 的 `R107` 出口（逐字同形）。
const R107_BATT = {
  success: false,
  error: {
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    message: 'Business state transition rejected',
    i18n_key: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    details: { field: 'batt', reason: 'BATT_BELOW_ACCEPT_THRESHOLD', job_id: '24' },
  },
}

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

describe('D1 补丁 · `fetchApiJson` 把 `payload.error` 机读面附到 Error（message 逐字不变）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① 409 + R107：`err.details.reason` / `err.code` / `err.i18nKey` 逐字；`err.message` 与改前逐字相同', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(409, R107_BATT)))
    const err = await fetchApiJson('/api/job/24/apply', { method: 'POST' }).catch((e) => e)

    expect(err).toBeInstanceOf(Error)

    // 机读面逐字附上（闭环判据 `details.reason` 就是这一面）
    expect(err.details).toEqual({ field: 'batt', reason: 'BATT_BELOW_ACCEPT_THRESHOLD', job_id: '24' })
    expect(err.details.reason).toBe('BATT_BELOW_ACCEPT_THRESHOLD')
    expect(err.details.field).toBe('batt')
    expect(err.details.job_id).toBe('24')
    expect(err.code).toBe('LEDGER_CURRENCY_INVALID_TRANSITION')
    expect(err.i18nKey).toBe('ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION')

    // `message` 与**改前**逐字相同 = 未改的 `apiErrorMessage(...)` 文案 = 真 zh 词典值
    const before = await apiErrorMessage(R107_BATT, 409)
    expect(err.message).toBe(before)
    expect(err.message).toBe(zh.battCard.insufficient)
    expect(err.message).toBe('电量低于承接门槛，暂时无法承接任务')

    // 护栏：机读码 / reason / 裸 i18n 键**绝不**进 message
    expect(err.message).not.toContain('BATT_BELOW_ACCEPT_THRESHOLD')
    expect(err.message).not.toContain('LEDGER_CURRENCY_INVALID_TRANSITION')
    expect(err.message).not.toContain('ledger.err.')
    expect(containsMachineCode(err.message), 'message 不得含机读码 token').toBe(false)
    expect(containsBareI18nKey(err.message), 'message 不得含裸 i18n 键').toBe(false)
  })

  it('② 无 `details` ⇒ `err.details === undefined`（负对照）；旧面（无 `error` 对象）⇒ 三面皆 undefined', async () => {
    const noDetails = { success: false, error: { code: 'SOME_CODE', message: 'boom', i18n_key: 'some.key' } }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(409, noDetails)))
    const err = await fetchApiJson('/x', {}).catch((e) => e)
    expect(err.details).toBeUndefined()
    // 「只做加法」不误伤：仍附有效的 code / i18n_key
    expect(err.code).toBe('SOME_CODE')
    expect(err.i18nKey).toBe('some.key')

    const legacy = { success: false, message: '系统繁忙，请稍后重试' }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, legacy)))
    const err2 = await fetchApiJson('/x', {}).catch((e) => e)
    expect(err2.details).toBeUndefined()
    expect(err2.code).toBeUndefined()
    expect(err2.i18nKey).toBeUndefined()
    expect(err2.message).toBe('系统繁忙，请稍后重试') // 服务端原文链路不受影响

    const bare = { success: false }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(503, bare)))
    const err3 = await fetchApiJson('/x', {}).catch((e) => e)
    expect(err3.details).toBeUndefined()
    expect(err3.code).toBeUndefined()
    expect(err3.i18nKey).toBeUndefined()
  })
})

describe('D1 补丁 · 联测：真 `fetchApiJson` 抛错形态 ⇒ JobDetailPage 真渲染可点击提示', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ★S3b：提交口 = `POST /api/task-progress/:identifier/submit`（:identifier = job_id），
  //   故**先判 `/submit`** 再落到列表读口 `/api/task-progress`（否则提交亦被回成列表 200 ⇒ 闭环不触发）。
  //   J2 报名面（`/api/job/:id/apply`）已下架、产品零调用 —— 旧 `applyBody` 分支随之删除。
  const routedFetch = (submitBody) => vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/submit')) return jsonResponse(409, submitBody)
    if (u.includes('/api/task-progress')) return jsonResponse(200, { success: true, data: [] })
    if (u.includes('/api/task/')) return jsonResponse(200, { success: true, data: { tID: 9, title: 'x', points: 5, participants_count: 0 } })
    return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
  })

  const renderPage = () => render(
    <MemoryRouter initialEntries={['/job/9']}>
      <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
    </MemoryRouter>,
  )

  it('③ 被拒 reason = 电量门槛 ⇒ 渲染 `<a href="/profile#batt-checkin">`（文案 = 真 zh 词典）', async () => {
    vi.stubGlobal('fetch', routedFetch(R107_BATT))
    renderPage()

    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-submit-form"]')).not.toBeNull())
    await act(async () => {
      fireEvent.submit(document.querySelector('[data-sf-m="jobs-submit-form"]'))
    })

    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-batt-hint"]')).not.toBeNull())
    const hint = document.querySelector('[data-sf-m="jobs-batt-hint"]')
    expect(hint.tagName).toBe('A')
    expect(hint.getAttribute('href')).toBe('/profile#batt-checkin')
    expect(hint.textContent).toContain(zh.battCard.insufficient)
    expect(hint.textContent).toContain(zh.checkinPanel.checkinButton)

    // 同一次被拒：状态文案 = 真电量文案（非机读码）
    const status = document.querySelector('[data-sf-m="jobs-submit-status"]')
    expect(status.textContent).toContain(zh.battCard.insufficient)
    expect(status.textContent).not.toContain('LEDGER_CURRENCY_INVALID_TRANSITION')
    expect(status.textContent).not.toContain('BATT_BELOW_ACCEPT_THRESHOLD')
  })

  it('④ 负对照：被拒但 reason ≠ 电量门槛 ⇒ 不渲染该提示', async () => {
    const other = {
      success: false,
      error: { ...R107_BATT.error, details: { field: 'listing', reason: 'LISTING_STATE_INVALID' } },
    }
    vi.stubGlobal('fetch', routedFetch(other))
    renderPage()

    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-submit-form"]')).not.toBeNull())
    await act(async () => {
      fireEvent.submit(document.querySelector('[data-sf-m="jobs-submit-form"]'))
    })

    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-submit-status"]').textContent)
      .toContain(zh.ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION))
    // 非电量门槛：通用 i18n_key 文案（非机读码），且**不**渲染闭环提示
    expect(document.querySelector('[data-sf-m="jobs-submit-status"]').textContent)
      .not.toContain('LEDGER_CURRENCY_INVALID_TRANSITION')
    expect(document.querySelector('[data-sf-m="jobs-batt-hint"]')).toBeNull()
  })
})
