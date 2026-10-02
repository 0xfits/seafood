/**
 * 批 7-A 收口四（R-4②）· **`ledger-api` 错误/未登录面：文案必须过 `apiErrorMessage` 链**（判负单测）
 * ============================================================================
 * 立例动机（本地质检在 `09362ad` 采到，见 `docs/audit/p7-a-ledger-read-fix.md` §1 R-1）：
 *   `frontend/src/ledger-api.js` 的错误分支曾写成
 *     `throw new Error(String(payload?.error?.message || payload?.message || 'HTTP ' + status))`
 *   ⇒ 绕过全站唯一出口 `auth.js` `apiErrorMessage` ⇒ 401/503 时用户看到的是**服务端码原文**
 *     （如 `AUTH_UNAUTHORIZED`）而非四语文案。
 *
 * 判据（每条都可判负）：
 *   ① 401 + `R107`（`AUTH_UNAUTHORIZED` + `i18n_key`）⇒ message = `auth.err.AUTH_UNAUTHORIZED` 的**zh 真文案**，
 *      **不得**含 `AUTH_UNAUTHORIZED`；
 *   ② 401 旧字符串面（`{success:false, message, error:<同一串>}`，B14 形状）⇒ 走**原文映射键**，不得原样吐英文原文；
 *   ③ 503 + `R107`（有 `details.reason`）⇒ message = **同链产出**（逐字等于 `await apiErrorMessage(payload, 503)`）；
 *   ④ 无 token ⇒ 抛**本地化**「未找到登录凭证」（`auth.err.NO_CREDENTIAL`）且**零请求**（与 `fetchCurrentUser` 同构）；
 *   ⑤ 连响应体都没有（`json()` 抛）⇒ `auth.err.REQUEST_FAILED` 四语兜底，**不得**退回 `HTTP 500` 这种裸状态串。
 *
 * 手法：**不 mock `auth`、不 mock `react-i18next`** —— 走真 `apiErrorMessage` + 真 `i18n` 实例
 *   （期望值直接读 `src/locales/zh.json` 真表，非 `key => key` 替身）；`fetch` 用 `vi.stubGlobal` 注入。
 *   与既有 `ledger-flow-behavior.test.jsx` / `auth.test.js`（B14 段）同风格。
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import { apiErrorMessage } from '../../auth'
import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../../ledger-api'

/** 真值源：zh locale（仅用于断言期望值，不参与替身） */
const ZH = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/locales/zh.json'), 'utf8'))

const USER = { uID: 970001, token: 'real-token-shape' }
const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

describe('批 7-A 收口四 · `ledger-api` 错误文案必须过 `apiErrorMessage`（四语文案，非服务端原文）', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① 401 + R107（`AUTH_UNAUTHORIZED` + `i18n_key`）⇒ 抛 zh 四语文案，**不是** `AUTH_UNAUTHORIZED` 原文', async () => {
    const payload = {
      error: {
        code: 'AUTH_UNAUTHORIZED',
        message: 'AUTH_UNAUTHORIZED',
        i18n_key: 'auth.err.AUTH_UNAUTHORIZED',
        details: { reason: 'NO_TOKEN' },
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(401, payload)))

    const err = await fetchMyLedger({ user: USER }).catch((e) => e)

    expect(err).toBeInstanceOf(Error)
    // 真 locale 查表：与 `zh.json` 逐字相等（缺键 ⇒ i18n 回键名 ⇒ 本断言会红）
    expect(ZH.auth.err.AUTH_UNAUTHORIZED).toBe('登录凭证无效或已过期，请重新登录。')
    expect(err.message).toBe(ZH.auth.err.AUTH_UNAUTHORIZED)
    expect(err.message).toBe(i18n.t('auth.err.AUTH_UNAUTHORIZED'))
    // 旧写法（绕过链）= `AUTH_UNAUTHORIZED` 原文 ⇒ 本条必红
    expect(err.message).not.toContain('AUTH_UNAUTHORIZED')
    expect(err.message).not.toContain('[object Object]')
    // 同链自证：逐字等于 `apiErrorMessage` 的产出（同一 payload / 同一 status）
    expect(err.message).toBe(await apiErrorMessage(payload, 401))
  })

  it('② 401 旧字符串面（B14 形状，无 `i18n_key`）⇒ 走原文映射键，不得把英文原文丢给用户', async () => {
    const payload = { success: false, message: 'Invalid wallet signature', error: 'Invalid wallet signature' }
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(401, payload)))

    const err = await fetchMyLedger({ user: USER }).catch((e) => e)

    expect(err.message).toBe(ZH.auth.err.INVALID_WALLET_SIGNATURE)
    expect(err.message).not.toBe('Invalid wallet signature')
    expect(err.message).toBe(await apiErrorMessage(payload, 401))
  })

  it('③ 503 + R107（带**大写机读** `details.reason`）⇒ 走 ② 服务端原文 + **不含机读 reason 后缀**（R1′ 订正）', async () => {
    const payload = {
      error: {
        code: 'LEDGER_TX_TIMEOUT',
        message: 'Ledger statement timed out',
        details: { reason: 'STATEMENT_TIMEOUT' },
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(503, payload)))

    const err = await fetchMyLedger({ user: USER }).catch((e) => e)

    expect(err.message).not.toBe('LEDGER_TX_TIMEOUT')
    // ★ 批 7-D（R1′ · reason 口径订正）**期望订正**：
    //   原断言 = `expect(err.message).toContain('(STATEMENT_TIMEOUT)')`（旧口径：② 路径把 reason 拼进括号）；
    //   新断言 = **不含** —— `details.reason = 'STATEMENT_TIMEOUT'` 是「全大写下划线机读码」⇒
    //   与 `message` 同判据（复用 `containsMachineCode`）⇒ **不附加后缀**。
    //   真人可读 reason（如 `too_many_connections`）仍保留后缀（见 `p7c` 单测 ⑤/⑧）。
    expect(err.message).toContain('Ledger statement timed out')
    expect(err.message).not.toContain('(STATEMENT_TIMEOUT)')
    expect(err.message).not.toContain('STATEMENT_TIMEOUT')
    expect(err.message).toBe(await apiErrorMessage(payload, 503))
    expect(err.message).not.toContain('[object Object]')
  })

  it('④ 无 token ⇒ 本地化「未找到登录凭证」（与 `fetchCurrentUser` 同构）+ **零请求**', async () => {
    const fetchSpy = vi.fn(async () => jsonRes(200, { success: true, data: [], next_before_txid: null }))
    vi.stubGlobal('fetch', fetchSpy)

    const err = await fetchMyLedger({ user: { uID: 970002 } }).catch((e) => e) // user 无 token / 无 access_token

    expect(err.message).toBe(ZH.auth.err.NO_CREDENTIAL)
    expect(err.message).toBe('未找到登录凭证')
    expect(fetchSpy).not.toHaveBeenCalled() // 前置判在 fetch 之前 ⇒ 未登录不打请求
  })

  it('⑤ 响应体不可解析（`json()` 抛）⇒ `auth.err.REQUEST_FAILED` 四语兜底，不得退回裸 `HTTP 500`', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    })))

    const err = await fetchMyLedger({ user: USER }).catch((e) => e)

    expect(err.message).toBe(ZH.auth.err.REQUEST_FAILED.replace('{{status}}', '500'))
    expect(err.message).toBe(await apiErrorMessage(null, 500))
    expect(err.message).not.toBe('HTTP 500') // 旧写法 = `HTTP 500` ⇒ 本条必红
  })

  it('⑥ 正常回包（200 + `success`）⇒ 返回 `{rows, nextBeforeTxid}`（回归锚：本次改动未动成功路径）', async () => {
    const rows = [{ txid: 270, uid: 970001, cid: 1, delta: '5', kind: 'transfer', time_created: 1750000270 }]
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(200, { success: true, message: 'OK', data: rows, next_before_txid: 247 })))

    const out = await fetchMyLedger({ user: USER, kind: 'transfer', limit: LEDGER_PAGE_SIZE })

    expect(out.rows).toEqual(rows)
    expect(out.nextBeforeTxid).toBe(247)
    const called = String(global.fetch.mock.calls[0][0])
    expect(called).toContain('/api/user/ledger?')
    expect(called).toContain('kind=transfer')
    expect(called).toContain(`limit=${LEDGER_PAGE_SIZE}`)
  })
})
