/**
 * R-9-82 / R-9-83 单测（本单新增）
 *   ① `BattMeter` 逐点态断言：batt = 0 / 5 / 25 / 65 / 100 / null(无账户)
 *      —— 满点数 / 半点下标 / 空点数逐个实测；数字与 `aria-label` 逐字。
 *   ② 「低电量」呼吸光：`canAccept === false` ⇒ 全部已点亮点带 `sf-batt-dot--glow`；
 *      `canAccept === true` ⇒ 无该类名。
 *   ③ 签到可发现性：`BattCheckinPanel` 锚点 `#batt-checkin` 存在；`Header` 头像菜单新增直达项；
 *      `JobDetailPage` 仅在 `error.details.reason === 'BATT_BELOW_ACCEPT_THRESHOLD'` 时给可点击提示
 *      （★S3b：`batt` 闸落点已由「报名」移到「提交」⇒ 该闭环改挂**提交面**）。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, hk, en, vn }

const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    if (v === undefined) return key
    let out = v
    if (opts && typeof out === 'string') {
      for (const k of Object.keys(opts)) out = out.split(`{{${k}}}`).join(String(opts[k]))
    }
    return out
  }
  return state
})

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

vi.mock('../../batt-checkin', () => ({
  fetchBatt: vi.fn(),
  fetchCheckinStatus: vi.fn(async () => ({ streakDay: 3, checkedInToday: false, canMakeup: false })),
  postCheckin: vi.fn(),
  postMakeup: vi.fn(),
  utcDay: () => '2026-10-03',
}))
vi.mock('../../bttc-api', () => ({ postBttcMint: vi.fn(), postBttcBurn: vi.fn() }))
vi.mock('../../admin-utils', () => ({ fetchAdminAccess: vi.fn(async () => ({ can_access_admin: false, preferred_admin_path: '/dashboard' })) }))
vi.mock('../../pages/jobs/job-api', () => ({
  fetchJobDetail: vi.fn(),
  fetchMyApplications: vi.fn(async () => []),
  submitDeliverable: vi.fn(),
}))

import { fetchBatt } from '../../batt-checkin'
import { fetchJobDetail, submitDeliverable } from '../../pages/jobs/job-api'
import BattMeter from '../../components/BattMeter'
import BattCheckinPanel from '../../components/BattCheckinPanel'
import Header from '../../components/Header'
import JobDetailPage from '../../pages/jobs/JobDetailPage'

const dots = (kind) => [...document.querySelectorAll(`[data-sf-m="batt-dot"][data-dot="${kind}"]`)]
const allDots = () => [...document.querySelectorAll('[data-sf-m="batt-dot"]')]
const halfIndexes = () => dots('half').map((el) => Number(el.getAttribute('data-idx')))
const glowDots = () => [...document.querySelectorAll('.sf-batt-dot--glow')]

const renderMeter = (batt, canAccept) => render(
  <MemoryRouter><BattMeter batt={batt} canAccept={canAccept} /></MemoryRouter>,
)

beforeEach(() => {
  H.tables = { zh, hk, en, vn }
  H.lang = 'zh'
  H.i18n.resolvedLanguage = 'zh'
  H.i18n.language = 'zh'
})
afterEach(() => cleanup())

// ============================================================================
// ① 逐点态 + 数字 + aria-label
// ============================================================================
describe('① BattMeter 逐点态（10 点 × 10%；full=floor(batt/10)、rem>=5 ⇒ 第 full+1 点半电）', () => {
  const CASES = [
    { batt: 0, full: 0, half: [], empty: 10, value: '0' },
    { batt: 5, full: 0, half: [1], empty: 9, value: '5' },
    { batt: 25, full: 2, half: [3], empty: 7, value: '25' },
    { batt: 65, full: 6, half: [7], empty: 3, value: '65' }, // ★ Kevin 实例口径：6 满 + 1 半 + 3 空
    { batt: 100, full: 10, half: [], empty: 0, value: '100' },
  ]

  it.each(CASES)('batt=$batt ⇒ $full 满 / $half 半 / $empty 空', ({ batt, full, half, empty, value }) => {
    renderMeter(batt, true)
    expect(allDots().length).toBe(10)
    expect(dots('full').length).toBe(full)
    expect(halfIndexes()).toEqual(half)
    expect(dots('empty').length).toBe(empty)
    expect(full + half.length + empty).toBe(10)
    expect(document.querySelector('[data-sf-m="batt-value"]').textContent).toBe(`${value}%`)
  })

  it('batt=null（无账户）⇒ 10 点全空 + 数字 0，且绝不出现 NaN/undefined', () => {
    renderMeter(null, null)
    expect(dots('full').length).toBe(0)
    expect(dots('half').length).toBe(0)
    expect(dots('empty').length).toBe(10)
    const readout = document.querySelector('[data-sf-m="batt-meter"]')
    expect(readout.textContent).not.toMatch(/NaN|undefined/)
    expect(document.querySelector('[data-sf-m="batt-value"]').textContent).toBe('0%')
  })

  it('aria-label 逐字 = battCard.title + 数值 + battCard.unit（并带 role=img）', () => {
    for (const { batt, value } of CASES) {
      cleanup()
      renderMeter(batt, true)
      const el = document.querySelector('[data-sf-m="batt-meter"]')
      expect(el.getAttribute('role')).toBe('img')
      expect(el.getAttribute('aria-label')).toBe(`${zh.battCard.title} ${value}${zh.battCard.unit}`)
    }
    cleanup()
    renderMeter(null, null)
    const el = document.querySelector('[data-sf-m="batt-meter"]')
    expect(el.getAttribute('aria-label')).toBe(`${zh.battCard.title} 0${zh.battCard.unit}`)
  })
})

// ============================================================================
// ② 低电量呼吸光（状态修饰）
// ============================================================================
describe('② 低电量 = canAccept===false ⇒ 全部已点亮点加呼吸光；true ⇒ 无', () => {
  it('canAccept=false（65）⇒ 6 满 + 1 半 = 7 个已点亮点全带 `sf-batt-dot--glow`', () => {
    renderMeter(65, false)
    expect(glowDots().length).toBe(7)
    for (const el of glowDots()) expect(el.getAttribute('data-glow')).toBe('1')
    expect(document.querySelector('[data-sf-m="batt-meter"]').getAttribute('data-batt-low')).toBe('1')
  })

  it('canAccept=true（65）⇒ 无任何呼吸光类名', () => {
    renderMeter(65, true)
    expect(glowDots().length).toBe(0)
    expect(document.querySelector('[data-sf-m="batt-meter"]').getAttribute('data-batt-low')).toBe('0')
  })

  it('canAccept=false 但 batt=0（无已点亮点）⇒ 无呼吸光', () => {
    renderMeter(0, false)
    expect(glowDots().length).toBe(0)
  })
})

// ============================================================================
// ③ 签到可发现性（R-9-83）
// ============================================================================
describe('③ R-9-83 签到入口可发现性', () => {
  it('BattCheckinPanel：电量卡带锚点 id=batt-checkin，且内嵌 BattMeter（65 ⇒ 6/1/3）', async () => {
    fetchBatt.mockResolvedValue({ batt: 65, canAccept: false, bttc: null })
    render(<MemoryRouter><BattCheckinPanel /></MemoryRouter>)
    await waitFor(() => expect(dots('full').length).toBe(6))
    expect(document.getElementById('batt-checkin')).not.toBeNull()
    expect(dots('half').map((el) => el.getAttribute('data-idx'))).toEqual(['7'])
    expect(dots('empty').length).toBe(3)
  })

  it('BattCheckinPanel：无账户（fetchBatt ⇒ null）⇒ 10 点全空 + 数字 0，不崩', async () => {
    fetchBatt.mockResolvedValue(null)
    render(<MemoryRouter><BattCheckinPanel /></MemoryRouter>)
    await waitFor(() => expect(allDots().length).toBe(10))
    expect(dots('empty').length).toBe(10)
    expect(document.querySelector('[data-sf-m="batt-meter"]').textContent).not.toMatch(/NaN|undefined/)
  })

  it('Header 头像菜单：桌面下拉**不再**有「签到 · 电量」直达项（2026-10-20 已删，签到/电量并入 `/wage`）', () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
    render(<MemoryRouter initialEntries={['/']}><Header /></MemoryRouter>)
    const trigger = document.querySelector('[data-sf-m="header-user-menu"]')
    expect(trigger).toBeTruthy()
    act(() => { fireEvent.mouseEnter(trigger.parentElement) })
    act(() => { vi.advanceTimersByTime(200) })
    const menu = trigger.parentElement.querySelector('div.absolute')
    expect(menu).not.toBeNull()
    // 反向断言：桌面用户下拉里既无钩子也无该文案（文案键仍在四语表里，只是不再渲染）
    expect(menu.querySelector('[data-sf-m="header-batt-checkin"]')).toBeNull()
    expect(menu.textContent).not.toContain(zh.checkinPanel.checkinButton)
    expect(menu.textContent).not.toContain(zh.battCard.title)
    // 其余菜单项不受影响
    expect(menu.querySelector('[data-sf-m="header-profile"]')).not.toBeNull()
    expect(menu.querySelector('[data-sf-m="header-logout"]')).not.toBeNull()
    // 手机汉堡面板同项亦已删（2026-10-20）⇒ 两侧均无 batt-checkin 入口
    act(() => { fireEvent.click(document.querySelector('[data-sf-m="header-mobile-menu"]')) })
    const mPanel = document.querySelector('[data-sf-m="header-user-menu-mobile"]')
    expect(mPanel).not.toBeNull()
    expect(mPanel.querySelector('[data-sf-m="header-batt-checkin-mobile"]')).toBeNull()
    expect(document.querySelectorAll('[data-sf-m^="header-batt-checkin"]').length).toBe(0)
    expect(mPanel.textContent).not.toContain(zh.checkinPanel.checkinButton)
    expect(mPanel.textContent).not.toContain(zh.battCard.title)
    vi.useRealTimers()
  })

  it('JobDetailPage：★S3b 提交被拒 reason = 电量门槛 ⇒ 给可点击提示直达 `#batt-checkin`', async () => {
    fetchJobDetail.mockResolvedValue({ tID: 9, title: 'x', points: 5, participants_count: 0 })
    const err = Object.assign(new Error(zh.battCard.insufficient), { details: { reason: 'BATT_BELOW_ACCEPT_THRESHOLD' } })
    submitDeliverable.mockRejectedValue(err)
    render(
      <MemoryRouter initialEntries={['/job/9']}>
        <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-submit-form"]')).not.toBeNull())
    act(() => { fireEvent.submit(document.querySelector('[data-sf-m="jobs-submit-form"]')) })
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-batt-hint"]')).not.toBeNull())
    const hint = document.querySelector('[data-sf-m="jobs-batt-hint"]')
    expect(hint.getAttribute('href')).toBe('/wage#batt-checkin')
    expect(hint.tagName).toBe('A')
  })

  it('JobDetailPage：提交被拒但拿不到 reason ⇒ 不显示该提示（不臆测）', async () => {
    fetchJobDetail.mockResolvedValue({ tID: 9, title: 'x', points: 5, participants_count: 0 })
    submitDeliverable.mockRejectedValue(new Error('generic failure'))
    render(
      <MemoryRouter initialEntries={['/job/9']}>
        <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-submit-form"]')).not.toBeNull())
    act(() => { fireEvent.submit(document.querySelector('[data-sf-m="jobs-submit-form"]')) })
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-submit-status"]').textContent).toContain('generic failure'))
    expect(document.querySelector('[data-sf-m="jobs-batt-hint"]')).toBeNull()
  })
})

// ============================================================================
// ④ 铸造缺额提示（`data-sf-m="bttc-mint-shortfall"`）：canMint=false 时量化「还差 X 电量 / 差 Y $」
//   纯展示：只用 policy + batt + usdBalance 做减法；不改铸造载荷、不改按钮 `disabled` 语义。
// ============================================================================
const BTTC_BASE = {
  symbol: 'BTTC',
  name: 'battcoin',
  decimals: 0,
  status: 'listed',
  totalSupply: '10',
  balance: '2',
  canBurn: false,
  policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100 },
  source: 'config',
}
const shortfallBox = () => document.querySelector('[data-sf-m="bttc-mint-shortfall"]')
const mintButton = () => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === zh.bttcPanel.mintButton)

describe('④ 铸造缺额提示（量化「还差 X 电量 / 差 Y $」· 纯展示）', () => {
  it('仅缺电量：batt 40 / mintBattCost 100 / $ 充足 ⇒ 「还差 60 电量」且无 $ 缺额；按钮仍不可点', async () => {
    fetchBatt.mockResolvedValue({
      batt: 40, canAccept: false,
      bttc: { ...BTTC_BASE, usdBalance: '5', canMint: false },
    })
    render(<MemoryRouter><BattCheckinPanel /></MemoryRouter>)
    await waitFor(() => expect(shortfallBox()).not.toBeNull())
    expect(document.querySelector('[data-sf-m="bttc-mint-shortfall-batt"]').textContent).toBe('还差 60 电量')
    expect(document.querySelector('[data-sf-m="bttc-mint-shortfall-usd"]')).toBeNull()
    expect(shortfallBox().textContent).not.toContain('$')
    expect(mintButton().disabled).toBe(true)
  })

  it('仅缺 $：batt 100 / usdBalance 0 / mintFeeUsd 1 ⇒ 「还差 $1」且无电量缺额；按钮仍不可点', async () => {
    fetchBatt.mockResolvedValue({
      batt: 100, canAccept: true,
      bttc: { ...BTTC_BASE, usdBalance: '0', canMint: false },
    })
    render(<MemoryRouter><BattCheckinPanel /></MemoryRouter>)
    await waitFor(() => expect(shortfallBox()).not.toBeNull())
    expect(document.querySelector('[data-sf-m="bttc-mint-shortfall-usd"]').textContent).toBe('还差 $1')
    expect(document.querySelector('[data-sf-m="bttc-mint-shortfall-batt"]')).toBeNull()
    expect(mintButton().disabled).toBe(true)
  })

  it('两项都不缺（canMint=true）⇒ 不渲染 bttc-mint-shortfall，按钮可点', async () => {
    fetchBatt.mockResolvedValue({
      batt: 150, canAccept: true,
      bttc: { ...BTTC_BASE, usdBalance: '3', canMint: true },
    })
    render(<MemoryRouter><BattCheckinPanel /></MemoryRouter>)
    await waitFor(() => expect(mintButton()).toBeTruthy())
    expect(shortfallBox()).toBeNull()
    expect(mintButton().disabled).toBe(false)
  })
})
