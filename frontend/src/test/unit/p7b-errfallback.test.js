/**
 * 批 7-B · C-1「`ledger.err.*` 回退护栏」· **判负单测**（真 i18n 实例 + 真 locale 查表）
 * ============================================================================
 * 立例动机（质检终轮在 p7-A 面上采到，裁定 = 本单 C-1）：
 *   后端账本错误对外回 `i18n_key = ledger.err.<CODE>`（`R107` 契约），而四语 locale **没有**
 *   `ledger.err.*` 族键（`docs/data-layer.spec.md` §11.3.1 登记「需新增键」）⇒ i18next 对未命中键
 *   **原样回键名本身** ⇒ 直接 `t(key)` 的路径会把**裸键**当文案输出给用户。
 *
 * 判据（每条都可判负；**四语逐语断言**，期望值直接读 `src/locales/<lang>.json` 真表，**不是 `key => key`**）：
 *   ① 谓词 `looksLikeBareI18nKey`：裸键形态 true / 正常文案 false（含非字符串面）；
 *   ② **裸键面**（键名本身就是链上唯一文案）⇒ 四语各自落**该语** `auth.err.REQUEST_FAILED` 真文案，
 *      且 `not.toMatch(裸键形态)`、`not.toContain('ledger.err.')`；
 *   ③ **无服务端文案面**（只给 `i18n_key`）⇒ 四语各自落**该语**通用兜底；
 *   ④ **原文直通面**（`message` 即裸键、无 code / 无 i18n_key）⇒ 不得外泄裸键 ⇒ 该语通用兜底；
 *   ⑤ **让位面**（真键命中）⇒ 用真文案（回归锚：护栏不得把真命中打掉）；
 *   ⑥ **既有面回归锚**（`auth.test.js` S6 语义）：未本地化键 + 真人可读服务端 `message`
 *      ⇒ **保留服务端文案**（护栏不得把它降级成通用兜底）；
 *   ⑦ `ledger-api` 端到端：`ledger.err.*` 401/422 面向用户的串非裸键 & 逐字等于 `apiErrorMessage` 产出。
 *
 * 手法：**不 mock `auth`、不 mock `react-i18next`** —— 走真 `apiErrorMessage` + 真 `i18n` 实例。
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import {
  apiErrorMessage,
  BARE_I18N_KEY_RE,
  containsBareI18nKey,
  looksLikeBareI18nKey,
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

const ledgerErrPayload = (over = {}) => ({
  error: {
    code: 'LEDGER_AMOUNT_INVALID',
    i18n_key: 'ledger.err.LEDGER_AMOUNT_INVALID',
    details: { reason: 'NOT_DECIMAL_STRING' },
    ...over,
  },
})

describe('批 7-B · C-1 `ledger.err.*` 回退护栏（未命中 ⇒ 四语通用兜底，绝不外泄裸键）', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    await i18n.changeLanguage('zh')
  })

  it('① 谓词 `looksLikeBareI18nKey`：只认「整串即点分标识符」，正常文案一律不误伤', () => {
    expect(BARE_I18N_KEY_RE).toBeInstanceOf(RegExp)
    for (const v of [
      'ledger.err.LEDGER_AMOUNT_INVALID',
      'auth.err.AUTH_UNAUTHORIZED',
      'ledger.err.LEDGER_RECONCILE_MISMATCH',
      'a.b',
      'a.b.c.d',
    ]) {
      expect(looksLikeBareI18nKey(v), `${v} 应判为裸键`).toBe(true)
    }
    for (const v of [
      '请求失败 (500)',
      'Request failed (400)',
      'Ledger statement timed out (STATEMENT_TIMEOUT)',
      'endpoint deprecated: /api/auth/register',
      'v1.2',
      'deprecated endpoint',
      '',
      'no-dots-here',
    ]) {
      expect(looksLikeBareI18nKey(v), `${v} 不得判为裸键`).toBe(false)
    }
    for (const v of [undefined, null, 42, {}, ['a.b']]) {
      expect(looksLikeBareI18nKey(v), `${JSON.stringify(v)} 非字符串应 false`).toBe(false)
    }

    // 「**出现**裸键 token」判据（整串判据覆盖不到的拼接面 —— 本单自测采到：
    //  服务端把键放进 `message` 且带 `details.reason` ⇒ `'ledger.err.X (NOT_DECIMAL_STRING)'`）
    expect(containsBareI18nKey('ledger.err.LEDGER_AMOUNT_INVALID (NOT_DECIMAL_STRING)')).toBe(true)
    expect(containsBareI18nKey('Error: auth.err.AUTH_UNAUTHORIZED')).toBe(true)
    expect(containsBareI18nKey('ledger.err.LEDGER_AMOUNT_INVALID')).toBe(true)
    for (const v of [
      '请求失败 (500)',
      'Ledger statement timed out (STATEMENT_TIMEOUT)',
      'endpoint deprecated: /api/auth/register',
      'v1.2',
      '',
    ]) {
      expect(containsBareI18nKey(v), `${v} 不得命中断言`).toBe(false)
    }
    for (const v of [undefined, null, 42, {}]) {
      expect(containsBareI18nKey(v)).toBe(false)
    }
  })

  it('② 裸键面：链上文案即键名（含 `message` 与 `details.reason` 拼出的 `键 (REASON)`）⇒ **四语逐语**落该语通用兜底', async () => {
    const status = 422
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      // 该语兜底键确实是**真文案**（真表查表自证，不是 key => key）
      expect(LOCALES[lang].auth.err.REQUEST_FAILED).toContain('{{status}}')

      const payload = ledgerErrPayload({ message: 'ledger.err.LEDGER_AMOUNT_INVALID' })
      const message = await apiErrorMessage(payload, status)

      expect(message, `[${lang}] 必须落该语通用兜底`).toBe(genericOf(lang, status))
      expect(looksLikeBareI18nKey(message), `[${lang}] 产出不得是裸键`).toBe(false)
      expect(containsBareI18nKey(message), `[${lang}] 产出不得**出现**裸键 token`).toBe(false)
      expect(message).not.toMatch(BARE_I18N_KEY_RE)
      expect(message).not.toContain('ledger.err.')
      expect(message).not.toContain('NOT_DECIMAL_STRING')
      expect(message).not.toContain('[object Object]')
      // 同链自证：逐字等于入口产出
      expect(message).toBe(await apiErrorMessage(payload, status))
    }
  })

  it('③ 无服务端文案面（只给 `i18n_key`，连 `code` 都没有）⇒ **四语逐语**落该语通用兜底（不落英文 ASCII）', async () => {
    const status = 400
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const message = await apiErrorMessage(
        { error: { i18n_key: 'ledger.err.LEDGER_AMOUNT_INVALID' } },
        status,
      )

      expect(message, `[${lang}] 必须落该语通用兜底`).toBe(genericOf(lang, status))
      // 与**应用内**同一查表逐字一致（真 `i18n` 实例，非替身）
      expect(message).toBe(i18n.t('auth.err.REQUEST_FAILED', { status }))
      expect(looksLikeBareI18nKey(message)).toBe(false)
      expect(containsBareI18nKey(message)).toBe(false)
    }
  })

  it('④ 服务端码面：只给机读 `code`（无 `message`，无裸键）⇒ **四语逐语**落该语通用兜底，不把码原文丢给用户', async () => {
    const status = 409
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      // 键未命中 + 无 `message` ⇒ 旧行为会把 `error.code` 当文案（p7-A R-1 已裁定的缺陷类）
      const message = await apiErrorMessage(
        { error: { code: 'LEDGER_AMOUNT_INVALID', i18n_key: 'ledger.err.LEDGER_AMOUNT_INVALID' } },
        status,
      )

      expect(message, `[${lang}] 必须落该语通用兜底`).toBe(genericOf(lang, status))
      expect(message).not.toContain('LEDGER_AMOUNT_INVALID')
      expect(containsBareI18nKey(message)).toBe(false)
    }
  })

  it('⑤ 原文直通面：`message` 即裸键（无 code / 无 i18n_key）⇒ 不得外泄裸键 ⇒ 该语通用兜底', async () => {
    const status = 500
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const message = await apiErrorMessage(
        { success: false, message: 'ledger.err.LEDGER_AMOUNT_INVALID' },
        status,
      )

      expect(message, `[${lang}]`).toBe(genericOf(lang, status))
      expect(looksLikeBareI18nKey(message)).toBe(false)
      expect(message).not.toContain('ledger.err.')
    }
  })

  it('⑥ 让位面：真键命中 ⇒ 用**真文案**（四语逐语；护栏不得把真命中打掉）', async () => {
    const payload = ledgerErrPayload({
      code: 'AUTH_UNAUTHORIZED',
      i18n_key: 'auth.err.AUTH_UNAUTHORIZED',
      message: 'AUTH_UNAUTHORIZED',
    })
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const truth = LOCALES[lang].auth.err.AUTH_UNAUTHORIZED
      expect(typeof truth).toBe('string')
      expect(truth.length).toBeGreaterThan(0)

      const message = await apiErrorMessage(payload, 401)
      expect(message, `[${lang}] 命中即用真文案`).toBe(truth)
      expect(message).not.toContain('AUTH_UNAUTHORIZED')
      expect(message).not.toMatch(BARE_I18N_KEY_RE)
    }
  })

  it('⑦ 既有面回归锚（`auth.test.js` S6 语义）：未本地化键 + 真人可读服务端 message ⇒ **保留原文**', async () => {
    const payload = {
      error: {
        code: 'LEDGER_REF_NOT_FOUND',
        message: 'endpoint deprecated: /api/auth/register',
        i18n_key: 'ledger.err.LEDGER_REF_NOT_FOUND',
        details: { ref_type: 'endpoint', ref_id: '/api/auth/register', http_status: 410 },
      },
    }
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const message = await apiErrorMessage(payload, 410)
      // 键未命中（`ledger.err.*` 四语均无）⇒ 服务端**真人可读**文案必须胜出（不得降级为通用兜底）
      expect(i18n.exists('ledger.err.LEDGER_REF_NOT_FOUND')).toBe(false)
      expect(message).toBe('endpoint deprecated: /api/auth/register')
      expect(message).not.toMatch(BARE_I18N_KEY_RE)
    }
  })

  it('⑧ `ledger-api` 端到端：`ledger.err.*` 401 面 ⇒ 用户可见串非裸键，且逐字等于 `apiErrorMessage` 产出', async () => {
    const status = 401
    const payload = { error: { code: 'LEDGER_AMOUNT_INVALID', i18n_key: 'ledger.err.LEDGER_AMOUNT_INVALID' } }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status,
      json: async () => payload,
    })))

    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const err = await fetchMyLedger({ user: { uID: 970001, token: 'real-token-shape' } }).catch((e) => e)

      expect(err).toBeInstanceOf(Error)
      expect(err.message, `[${lang}]`).toBe(genericOf(lang, status))
      expect(err.message).not.toMatch(BARE_I18N_KEY_RE)
      expect(err.message).not.toContain('ledger.err.')
      expect(err.message).toBe(await apiErrorMessage(payload, status))
    }
  })
})
