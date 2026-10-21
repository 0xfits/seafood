/**
 * D1 补丁单 · `fetchApiJson` 抛错携带**机读面**（R-9-83 体验闭环接通）
 * ============================================================================
 * 缺陷（本单现取坐实）：`auth.js` 的 `fetchApiJson` 抛 `new Error(message)` 时**丢掉**了
 * `payload.error` 的机读面（`details` / `code` / `i18n_key`）；而页面闭环判据取
 * `error?.details?.reason`（如 `BATT_BELOW_ACCEPT_THRESHOLD`）⇒ 恒 `undefined` ⇒ 提示**永不渲染**。
 *
 * ★ 2026-10-21（Kevin 裁定 · job 体系弃用）：原 ③④ 的联测载体 `JobDetailPage` **随页删除** ⇒
 *   本文件只留 ①②（`fetchApiJson` 机读面本身）；机读面口径与 `auth.js` 实现一字未改。
 *
 * 本文件四组判据（逐条可判负）：
 *   ① 单测：`409` + `R107` 体 ⇒ `err.details.reason` / `err.code` / `err.i18nKey` **逐字**；
 *      `err.message` 与**改前**（真 `apiErrorMessage` + 真 zh 词典）**逐字相同**，且机读码 / `reason`
 *      / 裸 i18n 键**绝不出现在 message**（护栏）。
 *   ② 负对照：响应**无 `details`** ⇒ `err.details === undefined`（不制造空面）；旧面（无 `error` 对象）
 *      ⇒ 三面皆 `undefined`，`message` 仍取服务端原文。
 *   （原 ③④ 联测＝真 `fetchApiJson` + 真 `JobDetailPage` render 的闭环面；载体页已随 job 体系删除。）
 *
 * 硬口径：本单只改 `auth.js` + 新增本测试文件；`message` 取值与既有链路逐字不变。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import '../../i18n' // 真 i18n 实例（jsdom 路径 `/` ⇒ lng = zh）
import zh from '../../locales/zh.json'
import {
  apiErrorMessage,
  containsBareI18nKey,
  containsMachineCode,
  fetchApiJson,
} from '../../auth'

// 本文件只测 `fetchApiJson` 机读面：`auth.js` / `fetchApiJson` / `fetch` 全部**保持真身**。
const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

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
