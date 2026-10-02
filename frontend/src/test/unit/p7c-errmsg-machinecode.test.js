/**
 * 批 7-C · F-1「错误文案面收口 · 护栏扩口径」· **判负单测**（真 i18n 实例 + 真 locale 查表）
 * ============================================================================
 * 立例动机（终审质检在 p7-B 面上采到，我裁定 = 本单 F-1）：
 *   退款拒收回执的 **HTTP 真体** =
 *     `{ error: { code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
 *                 message: 'LEDGER_CURRENCY_INVALID_TRANSITION',
 *                 i18n_key: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
 *                 details: { reason: 'order_not_refundable', … } } }`
 *   因 `ledger.err.*` 四语键缺失（已登记 P6/P7），`t(i18n_key)` 未命中 ⇒ 链落到 ② 服务端原文；
 *   而旧护栏**只认「点分裸键 token」**（`x.y.z`），**不认「全大写下划线机读码」**
 *   ⇒ 四语用户可见串 = 英文机读码 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`。
 *   本单把机读码纳入「不可作为用户文案」判据 ⇒ 命中即落 **③ 四语通用兜底**。
 *
 * 判据（每条都可判负；**四语逐语断言**，期望值直接读 `src/locales/<lang>.json` 真表，**不是 `key => key`**）：
 *   ① 谓词 `containsMachineCode` / `looksLikeMachineCode`：机读码形态 true / 正常文案 false（含 zh 句 + 小写词）；
 *   ② **F-1 真 409 体**（机读码 message + reason）⇒ 四语各自落**该语** `auth.err.REQUEST_FAILED` 真文案，
 *      且**不含机读码**、**不含 reason 后缀**、`not.toMatch(机读码形态)`；
 *   ③ 服务端**自拼** `机读码 (reason)` ⇒ 同样落四语兜底（不因 reason 已拼而漏网）；
 *   ④ **让位面**（`i18n_key` 命中）⇒ 即便 `message` 是机读码也用**真文案**（护栏不得把真命中打掉）；
 *   ⑤ **O-1 边界保留**：503 真体（zh 句子 + 小写 reason）⇒ 仍走 **② 服务端原文**（不得把 zh 句子当机读码）；
 *   ⑥ `ledger-api` 端到端：真 409 体 ⇒ 用户可见串 = 该语通用兜底，逐字等于 `apiErrorMessage` 产出；
 *   ⑦ **既有面回归锚**：未登记裸 `message`（`database is unreachable`）/ 410 英文句 ⇒ ② 服务端原文仍胜出。
 *
 * 手法：**不 mock `auth`、不 mock `react-i18next`** —— 走真 `apiErrorMessage` + 真 `i18n` 实例。
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import {
  apiErrorMessage,
  containsMachineCode,
  looksLikeMachineCode,
  MACHINE_CODE_RE,
  MACHINE_CODE_TOKEN_RE,
} from '../../auth'
import { fetchMyLedger } from '../../ledger-api'

const LANGS = ['zh', 'hk', 'en', 'vn']
const LOCALES = Object.fromEntries(LANGS.map((lang) => [
  lang,
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `src/locales/${lang}.json`), 'utf8')),
]))

/** 该语通用兜底真文案（`{{status}}` 代入）—— 期望值取自真 locale 表，非替身 */
const genericOf = (lang, status) => (
  LOCALES[lang].auth.err.REQUEST_FAILED.replace('{{status}}', String(status))
)

/** F-1 **真 409 体**（逐字：code / message / i18n_key / details.reason） */
const F1_409 = {
  success: false,
  error: {
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    message: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    i18n_key: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    details: { reason: 'order_not_refundable', order_id: 88123, http_status: 409 },
  },
}

describe('批 7-C · F-1 全大写下划线机读码 ⇒ 四语通用兜底（错误文案护栏扩口径）', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    await i18n.changeLanguage('zh')
  })

  it('① 谓词 `containsMachineCode` / `looksLikeMachineCode`：机读码 true / 反例（zh 句 + 小写词 + 非字符串）false', () => {
    // 正则导出面（判据逐字可审）
    expect(MACHINE_CODE_RE).toBeInstanceOf(RegExp)
    expect(MACHINE_CODE_TOKEN_RE).toBeInstanceOf(RegExp)

    // 正例：整 token 均 `[A-Z0-9_]`、含下划线、长度 ≥ 4
    for (const v of [
      'LEDGER_CURRENCY_INVALID_TRANSITION',
      'AUTH_UNAUTHORIZED',
      'STATEMENT_TIMEOUT',
      'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)',
    ]) {
      expect(containsMachineCode(v), `${v} 应命中机读码 token`).toBe(true)
    }
    // 整串即码（用于 `message` 本体判定）
    for (const v of ['LEDGER_CURRENCY_INVALID_TRANSITION', 'AUTH_UNAUTHORIZED', 'STATEMENT_TIMEOUT']) {
      expect(looksLikeMachineCode(v), `${v} 应判为整串机读码`).toBe(true)
    }
    expect(looksLikeMachineCode('LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)')).toBe(false)

    // 反例（**必须仍被接受为服务端原文**）：zh 句 / 普通英文句 / 含小写词 / 无下划线短串
    for (const v of [
      '系统繁忙，请稍后重试 (too_many_connections)',
      'Request failed (400)',
      'database is unreachable',
      'v1.2',
      'endpoint deprecated: /api/auth/register',
      'Invalid wallet signature',
      'too_many_connections',
      '请求失败 (500)',
      'no-dots-here',
      '',
    ]) {
      expect(containsMachineCode(v), `${v} 不得判为机读码`).toBe(false)
      expect(looksLikeMachineCode(v), `${v} 整串亦不得判为机读码`).toBe(false)
    }
    for (const v of [undefined, null, 42, {}, ['A_B']]) {
      expect(containsMachineCode(v), `${JSON.stringify(v)} 非字符串应 false`).toBe(false)
      expect(looksLikeMachineCode(v), `${JSON.stringify(v)} 非字符串应 false`).toBe(false)
    }
  })

  it('② **F-1 真 409 体** ⇒ 四语逐语 = 该语 `ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION` 真文案（① 让位），不含机读码 / reason 后缀', async () => {
    const status = 409
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      // ★ 批 7-D：键已本地化 ⇒ 真表查表自证（真文案，不是 key => key）
      const truth = LOCALES[lang].ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION
      expect(typeof truth).toBe('string')
      expect(truth.length).toBeGreaterThan(0)

      const message = await apiErrorMessage(F1_409, status)

      expect(message, `[${lang}] ① 命中即用该语真文案（让位）`).toBe(truth)
      // 与**应用内**同一查表逐字一致（真 `i18n` 实例，非替身）
      expect(message).toBe(i18n.t('ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION'))
      // 机读码 / reason 后缀 / 裸键 / [object Object] 一律不得外泄
      expect(containsMachineCode(message), `[${lang}] 产出不得含机读码 token`).toBe(false)
      expect(message).not.toContain('LEDGER_CURRENCY_INVALID_TRANSITION')
      expect(message).not.toContain('order_not_refundable')
      expect(message).not.toContain('ledger.err.')
      expect(message).not.toContain('[object Object]')
      // 同链自证：逐字等于入口产出
      expect(message).toBe(await apiErrorMessage(F1_409, status))
    }
  })

  it('③ 服务端**自拼** `机读码 (reason)`（message 已含拼接、**无 i18n_key**）⇒ 落四语兜底，不因 reason 已拼而漏网', async () => {
    const status = 409
    const payload = {
      error: {
        code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
        message: 'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)',
        details: { reason: 'order_not_refundable' },
      },
    }
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const message = await apiErrorMessage(payload, status)
      expect(message, `[${lang}]`).toBe(genericOf(lang, status))
      expect(containsMachineCode(message)).toBe(false)
      expect(message).not.toContain('order_not_refundable')
    }
  })

  it('④ 让位面（回归锚）：`i18n_key` 命中 ⇒ 即便 `message` 是机读码也用**真文案**', async () => {
    const payload = {
      error: {
        code: 'AUTH_UNAUTHORIZED',
        message: 'AUTH_UNAUTHORIZED',
        i18n_key: 'auth.err.AUTH_UNAUTHORIZED',
        details: { reason: 'NO_TOKEN' },
      },
    }
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const truth = LOCALES[lang].auth.err.AUTH_UNAUTHORIZED
      expect(typeof truth).toBe('string')
      expect(truth.length).toBeGreaterThan(0)

      const message = await apiErrorMessage(payload, 401)
      expect(message, `[${lang}] 命中即用真文案`).toBe(truth)
      expect(message).not.toContain('AUTH_UNAUTHORIZED')
      expect(containsMachineCode(message)).toBe(false)
    }
  })

  it('⑤ **O-1 边界保留**：无 `i18n_key` 的 503 真体（zh 句子 + 小写 reason）⇒ 仍走 ② 服务端原文 + 后缀保留；带已本地化键者 ⇒ ① 让位', async () => {
    const status = 503
    // ⑤-A ② 通路（无键 / 未登记键）：小写真人 reason ⇒ **后缀保留**（O-1 边界）
    const noKey = {
      error: {
        code: 'LEDGER_TX_TIMEOUT',
        message: '系统繁忙，请稍后重试',
        details: { reason: 'too_many_connections', error_code: 'ECONNREFUSED' },
      },
    }
    // ⑤-B 真体带**已本地化** `i18n_key` ⇒ ① 命中 ⇒ 该语真文案（让位；不再是单语 zh 外溢）
    const withKey = {
      error: {
        code: 'LEDGER_TX_TIMEOUT',
        message: '系统繁忙，请稍后重试',
        i18n_key: 'ledger.err.LEDGER_TX_TIMEOUT',
        details: { reason: 'too_many_connections', error_code: 'ECONNREFUSED' },
      },
    }
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const message = await apiErrorMessage(noKey, status)
      // ② 服务端原文优先（O-1 已裁定为**已知边界**：单语 zh 会外溢到 hk/en/vn）
      expect(message, `[${lang}] 必须保留服务端原文`).toBe('系统繁忙，请稍后重试 (too_many_connections)')
      expect(message).toContain('系统繁忙，请稍后重试')
      expect(message).toContain('(too_many_connections)')
      // 反证：**不得**降级为四语通用兜底（否则就是把 zh 句子当机读码）
      expect(message, `[${lang}] 不得落通用兜底`).not.toBe(genericOf(lang, status))
      expect(message).toBe(await apiErrorMessage(noKey, status))

      // ★ 批 7-D：真体带已本地化键 ⇒ ① 让位（该语真文案）
      const letThrough = await apiErrorMessage(withKey, status)
      expect(letThrough, `[${lang}] 键命中 ⇒ 该语真文案`).toBe(LOCALES[lang].ledger.err.LEDGER_TX_TIMEOUT)
    }
  })

  it('⑥ `ledger-api` 端到端：真 409 体 ⇒ 用户可见串 = 该语 `ledger.err.*` 真文案（① 让位），非机读码', async () => {
    const status = 409
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status,
      json: async () => F1_409,
    })))

    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const err = await fetchMyLedger({ user: { uID: 970001, token: 'real-token-shape' } }).catch((e) => e)

      expect(err).toBeInstanceOf(Error)
      expect(err.message, `[${lang}]`).toBe(LOCALES[lang].ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION)
      expect(containsMachineCode(err.message)).toBe(false)
      expect(err.message).not.toContain('LEDGER_CURRENCY_INVALID_TRANSITION')
      expect(err.message).not.toContain('order_not_refundable')
      expect(err.message).toBe(await apiErrorMessage(F1_409, status))
    }
  })

  it('⑦ 既有面回归锚：未登记裸 `message` / 410 英文句 ⇒ ② 服务端原文仍胜出（本单未误伤真人可读文案）', async () => {
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      expect(await apiErrorMessage({ success: false, message: 'database is unreachable' }, 503))
        .toBe('database is unreachable')

      const s6 = {
        error: {
          code: 'LEDGER_REF_NOT_FOUND',
          message: 'endpoint deprecated: /api/auth/register',
          i18n_key: 'ledger.err.LEDGER_LEGACY_UNREGISTERED_ANCHOR',
          details: { ref_type: 'endpoint', ref_id: '/api/auth/register', http_status: 410 },
        },
      }
      expect(await apiErrorMessage(s6, 410)).toBe('endpoint deprecated: /api/auth/register')
    }
  })

  it('⑧ ★ 批 7-D（R1′）类级：`stateConflict()` 四种 reason / `STATEMENT_TIMEOUT` 等机读 reason ⇒ 用户可见串零机读码；O-1 小写 reason 后缀保留', async () => {
    // 出处逐字：stateConflict() = `listing-service.ts:55` / `job-service.ts:122` /
    //   `job-funds-service.ts:61` / `currency-service.ts:59`（message='Business state transition rejected'）
    const R1P = [
      { reason: 'LISTING_STATE_INVALID', status: 409 },
      { reason: 'JOB_STATE_INVALID', status: 409 },
      { reason: 'JOB_APPLICATION_STATE_INVALID', status: 409 },
      { reason: 'CURRENCY_STATE_INVALID', status: 409 },
      { reason: 'STATEMENT_TIMEOUT', status: 503 },
    ]
    const TOKEN_G = new RegExp(MACHINE_CODE_TOKEN_RE.source, 'g')
    let occurrences = 0
    for (const v of R1P) {
      const payload = {
        error: {
          code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
          message: 'Business state transition rejected',
          details: { reason: v.reason },
        },
      }
      for (const lang of LANGS) {
        await i18n.changeLanguage(lang)
        const message = await apiErrorMessage(payload, v.status)
        occurrences += (message.match(TOKEN_G) || []).length
        // 判据：① 无机读码 token ② 不含 `(REASON)` 后缀 ③ 逐字 = 服务端真人可读原文（② 通路）
        expect(containsMachineCode(message), `[${lang}] ${v.reason} 不得外泄机读码`).toBe(false)
        expect(message, `[${lang}] ${v.reason} 不得附加后缀`).not.toContain(v.reason)
        expect(message, `[${lang}] ${v.reason}`).toBe('Business state transition rejected')
      }
    }
    expect(occurrences, '用户可见串中机读码出现次数').toBe(0)

    // 503 `LEDGER_LOCK_TIMEOUT` 真体（带已本地化键 + 大写机读 reason）⇒ ① 让位、无后缀
    const lock = {
      error: {
        code: 'LEDGER_LOCK_TIMEOUT',
        message: 'Ledger statement timed out',
        i18n_key: 'ledger.err.LEDGER_LOCK_TIMEOUT',
        details: { reason: 'STATEMENT_TIMEOUT' },
      },
    }
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const message = await apiErrorMessage(lock, 503)
      expect(message, `[${lang}] ① 让位`).toBe(LOCALES[lang].ledger.err.LEDGER_LOCK_TIMEOUT)
      expect(message).not.toContain('STATEMENT_TIMEOUT')
      expect(containsMachineCode(message)).toBe(false)
    }

    // ★ O-1 边界不回归：小写真人 reason ⇒ **后缀必须保留**
    await i18n.changeLanguage('zh')
    const o1 = { error: { message: '系统繁忙，请稍后重试', details: { reason: 'too_many_connections' } } }
    expect(await apiErrorMessage(o1, 503)).toBe('系统繁忙，请稍后重试 (too_many_connections)')
  })
})
