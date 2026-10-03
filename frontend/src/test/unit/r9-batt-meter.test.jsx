/**
 * R-9-82 / R-9-83 单测（本单新增）
 *   ① `BattMeter` 逐点态断言：batt = 0 / 5 / 25 / 65 / 100 / null(无账户)
 *      —— 满点数 / 半点下标 / 空点数逐个实测；数字与 `aria-label` 逐字。
 *   ② 「低电量」呼吸光：`canAccept === false` ⇒ 全部已点亮点带 `sf-batt-dot--glow`；
 *      `canAccept === true` ⇒ 无该类名。
 *   ③ 签到可发现性：`BattCheckinPanel` 锚点 `#batt-checkin` 存在；`Header` 头像菜单新增直达项；
 *      `JobDetailPage` 仅在 `error.details.reason === 'BATT_BELOW_ACCEPT_THRESHOLD'` 时给可点击提示。
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
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
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
  applyToJob: vi.fn(),
  acceptApplication: vi.fn(),
  submitDeliverable: vi.fn(),
}))

import { fetchBatt } from '../../batt-checkin'
import { fetchJobDetail, applyToJob } from '../../pages/jobs/job-api'
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

  it('Header 头像菜单：「个人资料」之下有直达 `/profile#batt-checkin` 的新项（复用既有文案键）', () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
    render(<MemoryRouter initialEntries={['/']}><Header /></MemoryRouter>)
    const trigger = document.querySelector('[data-sf-m="header-user-menu"]')
    expect(trigger).toBeTruthy()
    act(() => { fireEvent.mouseEnter(trigger.parentElement) })
    act(() => { vi.advanceTimersByTime(200) })
    const link = document.querySelector('[data-sf-m="header-batt-checkin"]')
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/profile#batt-checkin')
    expect(link.textContent).toContain(zh.checkinPanel.checkinButton)
    expect(link.textContent).toContain(zh.battCard.title)
    vi.useRealTimers()
  })

  it('JobDetailPage：被拒 reason = 电量门槛 ⇒ 给可点击提示直达 `#batt-checkin`', async () => {
    fetchJobDetail.mockResolvedValue({ tID: 9, title: 'x', points: 5, participants_count: 0 })
    const err = Object.assign(new Error(zh.battCard.insufficient), { details: { reason: 'BATT_BELOW_ACCEPT_THRESHOLD' } })
    applyToJob.mockRejectedValue(err)
    render(
      <MemoryRouter initialEntries={['/job/9']}>
        <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-apply"]')).not.toBeNull())
    act(() => { fireEvent.click(document.querySelector('[data-sf-m="jobs-apply"]')) })
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-batt-hint"]')).not.toBeNull())
    const hint = document.querySelector('[data-sf-m="jobs-batt-hint"]')
    expect(hint.getAttribute('href')).toBe('/profile#batt-checkin')
    expect(hint.tagName).toBe('A')
  })

  it('JobDetailPage：被拒但拿不到 reason ⇒ 不显示该提示（不臆测）', async () => {
    fetchJobDetail.mockResolvedValue({ tID: 9, title: 'x', points: 5, participants_count: 0 })
    applyToJob.mockRejectedValue(new Error('generic failure'))
    render(
      <MemoryRouter initialEntries={['/job/9']}>
        <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-apply"]')).not.toBeNull())
    act(() => { fireEvent.click(document.querySelector('[data-sf-m="jobs-apply"]')) })
    await waitFor(() => expect(document.querySelector('[data-sf-m="jobs-apply-status"]').textContent).toContain('generic failure'))
    expect(document.querySelector('[data-sf-m="jobs-batt-hint"]')).toBeNull()
  })
})
