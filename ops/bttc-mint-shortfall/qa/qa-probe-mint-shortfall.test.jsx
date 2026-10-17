/**
 * Neng 独立质检探针 · BTTC 铸造缺额提示（commit eebe883）
 *  ── 只读实现，不 import 实现方测试（不复用 r9-batt-meter.test.jsx 的任何夹具/断言）。
 *  ── 用**真 i18next 实例 + 真 locale JSON**（不用替身 t），断言真插值后的渲染文本。
 *  AC2 三态数值 / AC3 边界 / AC4 四语真插值 / AC8 反向灵敏度。
 */
import React from 'react'
import fs from 'node:fs'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../../frontend/src/locales/zh.json'
import hk from '../../../frontend/src/locales/hk.json'
import en from '../../../frontend/src/locales/en.json'
import vn from '../../../frontend/src/locales/vn.json'

const TABLES = { zh, hk, en, vn }

// —— 依赖替身（仅数据源，不替身 i18n） ——
const FIX = vi.hoisted(() => ({ batt: null, checkin: { streakDay: 3, checkedInToday: true, canMakeup: false } }))
vi.mock('../../../frontend/src/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { uID: 7 } }),
}))
vi.mock('../../../frontend/src/batt-checkin', () => ({
  fetchBatt: vi.fn(async () => FIX.batt),
  fetchCheckinStatus: vi.fn(async () => FIX.checkin),
  postCheckin: vi.fn(),
  postMakeup: vi.fn(),
  utcDay: () => '2026-10-03',
}))
vi.mock('../../../frontend/src/bttc-api', () => ({ postBttcMint: vi.fn(), postBttcBurn: vi.fn() }))

import BattCheckinPanel from '../../../frontend/src/components/BattCheckinPanel.jsx'

let i18n = null
const buildI18n = async (lng) => {
  const inst = i18next.createInstance()
  await inst.init({
    resources: Object.fromEntries(Object.entries(TABLES).map(([k, v]) => [k, { translation: v }])),
    lng,
    fallbackLng: 'zh',
    interpolation: { escapeValue: false },
    initImmediate: false,
    react: { useSuspense: false },
  })
  return inst
}

const POLICY = { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 }
const bttcBase = (over = {}) => ({
  symbol: 'BTTC', name: 'battcoin', decimals: 0, status: 'listed',
  totalSupply: '10', balance: '2', canMint: false, canBurn: false,
  policy: { ...POLICY }, source: 'config', ...over,
})

const box = () => document.querySelector('[data-sf-m="bttc-mint-shortfall"]')
const battNode = () => document.querySelector('[data-sf-m="bttc-mint-shortfall-batt"]')
const usdNode = () => document.querySelector('[data-sf-m="bttc-mint-shortfall-usd"]')
const mintBtn = () => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === TABLES.zh.bttcPanel.mintButton)

// 观测读数落盘（供 AC 复核，不只给「passed」）
const READINGS = []
const rec = (id, data) => READINGS.push({ id, ...data })
afterAll(() => {
  fs.writeFileSync(
    '/Users/kevin/bistro/seafood/ops/bttc-mint-shortfall/qa/AC2-AC4-AC8-observed.json',
    JSON.stringify({ probe: 'qa-probe-mint-shortfall', cases: READINGS }, null, 2),
  )
})

const mount = async (fixture, lng = 'zh') => {
  FIX.batt = fixture
  i18n = await buildI18n(lng)
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter><BattCheckinPanel /></MemoryRouter>
    </I18nextProvider>,
  )
  // 等读口落地（bttc 卡渲染出来即视为已取数）
  await waitFor(() => expect(document.querySelector('[data-sf-m="bttc-asset"]')).not.toBeNull())
  await new Promise((r) => setTimeout(r, 30))
  // ★ 观测读数落盘（Zang 补齐：在 DOM 仍挂载时采集；断言仍以用例内 expect 为准）
  try {
    const b = battNode()
    const u = usdNode()
    const boxEl = box()
    const btn = mintBtn()
    READINGS.push({
      test: (typeof expect.getState === 'function' && expect.getState().currentTestName) || null,
      lang: lng,
      box_present: !!boxEl,
      batt_text: b ? b.textContent : null,
      usd_text: u ? u.textContent : null,
      mint_btn_present: !!btn,
      mint_btn_disabled: btn ? btn.disabled : null,
    })
  } catch (error) {
    READINGS.push({ lang: lng, error: String(error) })
  }
}

// ★ Zang 补齐（2026-10-17）：原 afterEach 只 cleanup、rec() 从未被调用 ⇒ observed 读数落盘为空
//   （Neng 回执已声明该欠账）。采集点改到 `mount()` 末尾 —— setup.js 的全局 afterEach(cleanup)
//   先于本文件钩子执行 ⇒ 在 afterEach 里采到的是已清空的 DOM（实测 14/14 全 None）。
afterEach(() => { cleanup(); FIX.batt = null })

describe('AC2 三态数值（独立渲染断言）', () => {
  it('① batt 40 / cost 100 / $ 充足 ⇒ 「还差 60 电量」且无 $ 缺额节点', async () => {
    await mount({ batt: 40, canAccept: false, bttc: bttcBase({ usdBalance: '5' }) })
    expect(battNode()?.textContent).toBe('还差 60 电量')
    expect(usdNode()).toBeNull()
    expect(box().textContent).not.toContain('$')
    expect(mintBtn().disabled).toBe(true)
  })

  it('② batt 100 / usdBalance "0" / fee 1 ⇒ 「还差 $1」且无电量缺额节点', async () => {
    await mount({ batt: 100, canAccept: true, bttc: bttcBase({ usdBalance: '0' }) })
    expect(usdNode()?.textContent).toBe('还差 $1')
    expect(battNode()).toBeNull()
    expect(mintBtn().disabled).toBe(true)
  })

  it('③ canMint=true ⇒ 零 bttc-mint-shortfall 节点、铸造按钮 enabled', async () => {
    await mount({ batt: 150, canAccept: true, bttc: bttcBase({ usdBalance: '3', canMint: true }) })
    expect(box()).toBeNull()
    expect(mintBtn()).not.toBeNull()
    expect(mintBtn().disabled).toBe(false)
  })
})

describe('AC3 边界', () => {
  it('status=null（代币不可用）⇒ 按钮与缺额均不渲染', async () => {
    await mount({ batt: 10, canAccept: true, bttc: bttcBase({ status: null, usdBalance: '0' }) })
    expect(box()).toBeNull()
    expect(mintBtn()).toBeUndefined()
    expect(document.querySelector('[data-sf-m="bttc-mint-shortfall-usd"]')).toBeNull()
  })

  it('batt 缺失/null ⇒ 按 0 计显示差 100（不崩溃）', async () => {
    await mount({ batt: null, canAccept: false, bttc: bttcBase({ usdBalance: '5' }) })
    expect(battNode()?.textContent).toBe('还差 100 电量')
    expect(usdNode()).toBeNull()
  })

  it('batt 键整体缺失（无 batt 字段）⇒ 同样按 0 计差 100', async () => {
    await mount({ canAccept: false, bttc: bttcBase({ usdBalance: '5' }) })
    expect(battNode()?.textContent).toBe('还差 100 电量')
  })
})

describe('AC4 四语真插值（不得出现字面 {{n}} / {n}）', () => {
  const cases = [['zh', '还差 $1'], ['hk', '還差 $1'], ['en', '$1 more needed'], ['vn', 'Còn thiếu $1']]
  for (const [lng, expected] of cases) {
    it(`${lng} 渲染 = 「${expected}」（真数字）`, async () => {
      await mount({ batt: 100, canAccept: true, bttc: bttcBase({ usdBalance: '0' }) }, lng)
      const txt = usdNode()?.textContent
      expect(txt).toBe(expected)
      expect(txt).not.toMatch(/[{}]/)
      expect(txt).toContain('1')
    })
  }
  it('四语电量缺额同样是真数字', async () => {
    const exp = [['zh', '还差 60 电量'], ['hk', '還差 60 電量'], ['en', '60 more battery needed'], ['vn', 'Còn thiếu 60 pin']]
    for (const [lng, expected] of exp) {
      cleanup()
      await mount({ batt: 40, canAccept: false, bttc: bttcBase({ usdBalance: '5' }) }, lng)
      expect(battNode()?.textContent).toBe(expected)
      expect(battNode()?.textContent).not.toMatch(/[{}]/)
    }
  })
})

describe('AC8 反向灵敏度（必做）', () => {
  it('夹具把 canMint 强制为 true（其余数值仍不足）⇒ 缺额节点必消失', async () => {
    await mount({ batt: 0, canAccept: false, bttc: bttcBase({ usdBalance: '0', canMint: true }) })
    expect(box()).toBeNull()
    expect(mintBtn().disabled).toBe(false)
  })

  it('把 usdBalance 从夹具移除 ⇒ 按 $0 兜底、显示「还差 $1」，不白屏不崩溃', async () => {
    await mount({ batt: 100, canAccept: true, bttc: bttcBase({ /* 无 usdBalance */ }) })
    expect(document.querySelector('[data-sf-m="bttc-asset"]')).not.toBeNull()
    expect(usdNode()?.textContent).toBe('还差 $1')
    expect(battNode()).toBeNull()
  })

  it('usdBalance 为坏值（非数字）⇒ 不崩溃（BigInt 兜底 null ⇒ 不显 $ 缺额）', async () => {
    await mount({ batt: 100, canAccept: true, bttc: bttcBase({ usdBalance: 'abc' }) })
    expect(document.querySelector('[data-sf-m="bttc-asset"]')).not.toBeNull()
    expect(usdNode()).toBeNull()
  })
})
