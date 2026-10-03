/**
 * D1 · 文案错配修复 · **判负单测**（真 `apiErrorMessage` + 真 i18n 实例 + 真 locale 查表）
 * ============================================================================
 * 缺陷（生产 · uid 970213 · batt 低于承接门槛）：
 *   招工「参与/报名」(`J2`) 与「雇主选定」(`J3`) 两处 `stateConflict('batt',
 *   'BATT_BELOW_ACCEPT_THRESHOLD', …)`（`backend-ts/src/job-service.ts:197` / `:231`）
 *   ⇒ `R107` 体（`ledgerErrorBody` 经 `sendVerbError` 出口，逐字同形）：
 *     { error: { code:'LEDGER_CURRENCY_INVALID_TRANSITION',
 *                message:'Business state transition rejected',
 *                i18n_key:'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
 *                details:{ field:'batt', reason:'BATT_BELOW_ACCEPT_THRESHOLD', job_id|application_id } } }
 *   修复前：链上 ① 命中通用 `i18n_key` ⇒ 用户看到「当前状态不允许此变更。」（**真实原因不可见**）。
 *   修复后：`error.details.reason` 精确映射**优先级最高** ⇒ 命中 `battCard.insufficient`
 *          （四语「电量低于承接门槛…」）。
 *
 * 判据（逐条可判负；四语逐语，期望值取真 locale 表，不是 `key => key`）：
 *   ① 表 / 纯函数：`REASON_I18N_KEYS` 含首条映射；`i18nKeyForErrorReason` 命中 / 未命中 / 非字符串 / 无 details；
 *   ② 两处落点（apply `:197` / accept `:231`）**同一 reason / 同一文案**，四语逐语 = 该语 `battCard.insufficient`；
 *   ③ 修复前/后读数（同输入）：前 = 通用键真文案，后 = 电量真文案，且不同、前不含真实原因；
 *   ④ 未命中 reason ⇒ 行为**逐字不变**（既有 `stateConflict` reason 面仍走服务端原文）；
 *   ⑤ 护栏不破：产出**不含裸 i18n 键 / 不含机读码 token / 不含 `[object Object]`**；
 *   ⑥ 端到端：真 `fetchApiJson`（`auth.js:308`）抛出的 message = 该语电量文案。
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import {
  apiErrorMessage,
  containsBareI18nKey,
  containsMachineCode,
  fetchApiJson,
  i18nKeyForErrorReason,
  REASON_I18N_KEYS,
} from '../../auth'

const LANGS = ['zh', 'hk', 'en', 'vn']
const LOCALES = Object.fromEntries(LANGS.map((lang) => [
  lang,
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `src/locales/${lang}.json`), 'utf8')),
]))

// ★ 两处落点的 `R107` 真体（`job-service.ts:197` 报名 / `:231` 雇主选定）—— 逐字同 reason、同 i18n_key，
//   仅 extra id 键不同（`job_id` vs `application_id`）。
const BATT_BODY = (extra) => ({
  error: {
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    message: 'Business state transition rejected',
    i18n_key: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    details: { field: 'batt', reason: 'BATT_BELOW_ACCEPT_THRESHOLD', ...extra },
  },
})
const APPLY_409 = BATT_BODY({ job_id: '1041' })            // :197
const ACCEPT_409 = BATT_BODY({ application_id: '9007' })   // :231

describe('D1 · 电量不足文案（`BATT_BELOW_ACCEPT_THRESHOLD` ⇒ `battCard.insufficient`）', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    await i18n.changeLanguage('zh')
  })

  it('① 显式常量表 + 纯函数：命中 / 未命中 / 非字符串 / 无 details', () => {
    expect(REASON_I18N_KEYS).toEqual({ BATT_BELOW_ACCEPT_THRESHOLD: 'battCard.insufficient' })

    // 命中
    expect(i18nKeyForErrorReason(APPLY_409.error)).toBe('battCard.insufficient')
    expect(i18nKeyForErrorReason(ACCEPT_409.error)).toBe('battCard.insufficient')
    expect(i18nKeyForErrorReason({ details: { reason: 'BATT_BELOW_ACCEPT_THRESHOLD' } })).toBe('battCard.insufficient')

    // 未命中 / 非法形态 ⇒ undefined（调用方保持原链路）
    for (const bad of [
      { details: { reason: 'NOT_IN_TABLE' } },
      { details: { reason: 'LISTING_STATE_INVALID' } },   // 既有 reason，不得被本表截胡
      { details: { reason: 42 } },
      { details: {} },
      { details: 'x' },
      {},
      undefined,
      null,
      'BATT_BELOW_ACCEPT_THRESHOLD',                       // error 为字符串面
    ]) {
      expect(i18nKeyForErrorReason(bad), `${JSON.stringify(bad)} 不得命中`).toBeUndefined()
    }
  })

  it('② 两处落点（报名 / 雇主选定）四语逐语 = 该语 `battCard.insufficient`（真表查表）', async () => {
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const truth = LOCALES[lang].battCard.insufficient
      expect(typeof truth, `[${lang}] battCard.insufficient 须为真文案`).toBe('string')
      expect(truth.length).toBeGreaterThan(0)
      expect(truth).not.toBe('battCard.insufficient')

      for (const [label, body] of [['apply(:197)', APPLY_409], ['accept(:231)', ACCEPT_409]]) {
        const message = await apiErrorMessage(body, 409)
        expect(message, `[${lang}] ${label}`).toBe(truth)
        // 与**应用内**同一查表逐字一致（真 i18n 实例）
        expect(message).toBe(i18n.t('battCard.insufficient'))
        // 不再被通用「非法状态转移」文案顶替
        expect(message).not.toBe(LOCALES[lang].ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION)
      }
      // 两处落点产出**逐字相同**
      expect(await apiErrorMessage(APPLY_409, 409)).toBe(await apiErrorMessage(ACCEPT_409, 409))
    }
  })

  it('③ 修复前/后读数（同输入）：前 = 通用键真文案；后 = 电量真文案；二者不同且前不含真实原因', async () => {
    const readouts = []
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const before = i18n.t('ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION') // 旧链 ① 命中通用 i18n_key
      const after = await apiErrorMessage(APPLY_409, 409)                    // 新链 reason 优先
      const batt = LOCALES[lang].battCard.insufficient

      expect(after).toBe(batt)
      expect(before).toBe(LOCALES[lang].ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION)
      expect(after).not.toBe(before)
      expect(before).not.toContain('电量')   // zh 面：旧文案不含真实原因（仅通用转移语）
      readouts.push({ lang, before, after })
    }
    // 取证：打印四语修复前/后渲染文案（供报告逐条读数）
    // eslint-disable-next-line no-console
    console.log('[D1 读数]', JSON.stringify(readouts, null, 0))
  })

  it('④ 未命中 reason ⇒ 行为逐字不变（既有 stateConflict reason 面仍走服务端原文）', async () => {
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      for (const reason of ['LISTING_STATE_INVALID', 'JOB_STATE_INVALID', 'JOB_APPLICATION_STATE_INVALID', 'CURRENCY_STATE_INVALID']) {
        const body = {
          error: {
            code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
            message: 'Business state transition rejected',
            details: { reason },
          },
        }
        expect(await apiErrorMessage(body, 409), `[${lang}] ${reason} 不得被本表改动`).toBe('Business state transition rejected')
      }
      // 无 details.reason 的旧面（含 i18n_key 命中）也不变
      const noReason = { error: { code: 'LEDGER_REF_NOT_FOUND', message: 'endpoint deprecated: /api/auth/register', i18n_key: 'ledger.err.LEDGER_LEGACY_UNREGISTERED_ANCHOR', details: { ref_type: 'endpoint' } } }
      expect(await apiErrorMessage(noReason, 410)).toBe('endpoint deprecated: /api/auth/register')
    }
  })

  it('⑤ 护栏不破：产出不含裸 i18n 键 / 机读码 token / `[object Object]`', async () => {
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      for (const body of [APPLY_409, ACCEPT_409]) {
        const message = await apiErrorMessage(body, 409)
        expect(containsBareI18nKey(message), `[${lang}] 不得出现裸 i18n 键`).toBe(false)
        expect(containsMachineCode(message), `[${lang}] 不得出现机读码 token`).toBe(false)
        expect(message).not.toContain('BATT_BELOW_ACCEPT_THRESHOLD')
        expect(message).not.toContain('battCard.insufficient')
        expect(message).not.toContain('ledger.err.')
        expect(message).not.toContain('[object Object]')
      }
    }
  })

  it('⑥ 端到端：真 `fetchApiJson`（`auth.js:308`）抛出的 message = 该语电量文案', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => APPLY_409 })))
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      const err = await fetchApiJson('/api/job/1041/apply', { method: 'POST' }).catch((e) => e)
      expect(err).toBeInstanceOf(Error)
      expect(err.message, `[${lang}]`).toBe(LOCALES[lang].battCard.insufficient)
      expect(err.message).toBe(await apiErrorMessage(APPLY_409, 409))
      expect(containsBareI18nKey(err.message)).toBe(false)
      expect(containsMachineCode(err.message)).toBe(false)
    }
  })
})
