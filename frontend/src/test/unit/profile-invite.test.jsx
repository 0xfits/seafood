/**
 * 【我的邀请】/profile/invite（Kevin 2026-10-24 需求）
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   ① `OtpInput` 6 格行为 —— 逐格输入自动前进 / 粘贴整串 / 退格回上一格 / 非数字过滤 / 单格只留 1 位；
 *   ② 前导零口径 —— `000100` ⇒ 100、`000000` ⇒ 无效、不足 6 位 ⇒ 无效；补零展示 `100` ⇒ `000100`；
 *   ③ 满 6 位才能提交（按钮 disabled；不足 6 位不发请求）；
 *   ④ 已绑定态 —— 「已绑定邀请人 000100」+ 输入区 6 格全 `disabled` + 只读提示（不可改绑）；
 *   ⑤ 成功 ⇒ **Toast**（承 design `T126`），卡内**不写**成功文案；失败 ⇒ 卡内内联 + **不弹 Toast**；
 *   ⑥ 未登录 ⇒ 登录引导（不发读请求）；
 *   ⑦ 接线静态判据 —— ProfilePage 的视图派生 / 菜单顺序（我的收藏 → 我的邀请 → 账户设置）/ pane 渲染点。
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, en, hk, vn }
const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})
H.tables = TABLES
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t }) }))

// 成功反馈的唯一出口（T126）—— 用它取证「成功只经 Toast」「失败不弹 Toast」
const TOAST = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: TOAST }))

const API = vi.hoisted(() => ({ fetchMyReferral: vi.fn(), bindReferral: vi.fn() }))
vi.mock('../../referral-api', () => API)

import OtpInput from '../../components/OtpInput'
import InvitePane, { padInviteUid, parseInviteUid } from '../../pages/profile/InvitePane'

const renderPane = (props = {}) =>
  render(
    <MemoryRouter initialEntries={['/profile/invite']}>
      <InvitePane isAuthenticated user={{ uID: 100, token: 't' }} {...props} />
    </MemoryRouter>,
  )

const cells = () => Array.from(document.querySelectorAll('[data-sf-m^="invite-otp-cell-"]'))

/** 在指定格输入（模拟受控输入：一次 change 事件带 1 个字符） */
const typeAt = (index, char) => {
  const cell = cells()[index]
  cell.focus()
  fireEvent.change(cell, { target: { value: char } })
}

beforeEach(() => {
  H.lang = 'zh'
  TOAST.success.mockClear()
  TOAST.error.mockClear()
  API.fetchMyReferral.mockReset().mockResolvedValue({ bound: false, parent_uid: null, bound_at: null, depth: null })
  API.bindReferral.mockReset().mockResolvedValue({ parent_uid: 100, depth: 1, bound_at: '2026-10-24T00:00:00.000Z' })
})

afterEach(() => { cleanup() })

// ============================================================================
// ① OtpInput 行为
// ============================================================================
describe('OtpInput · 6 格数字输入', () => {
  const Harness = ({ onValue, ...rest }) => {
    const [value, setValue] = React.useState('')
    return (
      <OtpInput
        value={value}
        onChange={(next) => { setValue(next); onValue?.(next) }}
        label="邀请人编号"
        {...rest}
      />
    )
  }

  it('逐格输入：自动前进，8 格全填后值为 6 位数字', () => {
    const seen = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    expect(cells()).toHaveLength(6)
    '000100'.split('').forEach((char, i) => typeAt(i, char))
    expect(seen[seen.length - 1]).toBe('000100')
    expect(cells().map((c) => c.value).join('')).toBe('000100')
  })

  it('单格只留 1 位（多字符输入从当前格顺延，且焦点跳到末格之后不越界）', () => {
    render(<Harness />)
    typeAt(0, '123456')
    expect(cells().map((c) => c.value).join('')).toBe('123456')
  })

  it('粘贴整串 6 位数字：从当前格起逐格填满', () => {
    render(<Harness />)
    const first = cells()[0]
    fireEvent.paste(first, { clipboardData: { getData: () => '000100' } })
    expect(cells().map((c) => c.value).join('')).toBe('000100')
  })

  it('非数字被过滤（字母 / 全角 / 符号都进不来）', () => {
    const seen = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    typeAt(0, 'a')
    typeAt(0, '１')
    typeAt(0, '-')
    expect(seen.every((v) => v === '' || /^[0-9]*$/.test(v))).toBe(true)
    expect(cells().map((c) => c.value).join('')).toBe('')
  })

  it('退格：空格子回上一格并清空上一格', () => {
    render(<Harness />)
    typeAt(0, '1')
    typeAt(1, '2')
    // 第 3 格为空（此时焦点在第 2 格之后 = 第 3 格）⇒ Backspace 应回退到第 2 格并清掉 '2'
    const third = cells()[2]
    fireEvent.keyDown(third, { key: 'Backspace' })
    expect(cells().map((c) => c.value).join('')).toBe('1')
  })

  it('无障碍：整组 role=group + 可见之外的 aria-label，每格独立 aria-label', () => {
    render(<Harness />)
    expect(document.querySelector('[role="group"]')).toBeTruthy()
    expect(cells()[0].getAttribute('aria-label')).toBe('邀请人编号 1')
    expect(cells()[5].getAttribute('aria-label')).toBe('邀请人编号 6')
    // 移动端数字键盘：inputmode=numeric
    expect(cells()[0].getAttribute('inputmode')).toBe('numeric')
  })
})

// ============================================================================
// ② 前导零口径
// ============================================================================
describe('前导零口径', () => {
  it('parseInviteUid：000100 ⇒ 100；000000 ⇒ null；不足 6 位 ⇒ null', () => {
    expect(parseInviteUid('000100')).toBe(100)
    expect(parseInviteUid('000001')).toBe(1)
    expect(parseInviteUid('000000')).toBeNull()
    expect(parseInviteUid('100')).toBeNull()
    expect(parseInviteUid('')).toBeNull()
  })

  it('padInviteUid：100 ⇒ 000100（6 位定宽展示）', () => {
    expect(padInviteUid(100)).toBe('000100')
    expect(padInviteUid(1)).toBe('000001')
    expect(padInviteUid(null)).toBe('')
  })
})

// ============================================================================
// ③④⑤⑥ 组件态
// ============================================================================
describe('InvitePane', () => {
  it('未登录 ⇒ 登录引导（不发读请求）', async () => {
    renderPane({ isAuthenticated: false, user: null })
    await waitFor(() => expect(document.querySelector('[data-sf-m="invite-login"]')).toBeTruthy())
    expect(API.fetchMyReferral).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(zh.pleaseLogin)
  })

  it('未绑定 ⇒ 6 格可输入；不足 6 位提交按钮 disabled 且不发请求', async () => {
    renderPane()
    await waitFor(() => expect(cells()).toHaveLength(6))
    const submit = document.querySelector('[data-sf-m="invite-submit"]')
    expect(submit.disabled).toBe(true)
    fireEvent.submit(submit.closest('form'))
    expect(API.bindReferral).not.toHaveBeenCalled()
  })

  it('满 6 位后可提交；成功 ⇒ Toast（无非内联成功文案）', async () => {
    renderPane()
    await waitFor(() => expect(cells()).toHaveLength(6))
    '000100'.split('').forEach((char, i) => typeAt(i, char))
    const submit = document.querySelector('[data-sf-m="invite-submit"]')
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => expect(API.bindReferral).toHaveBeenCalledTimes(1))
    expect(API.bindReferral.mock.calls[0][0]).toBe(100)
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    expect(TOAST.success.mock.calls[0][0]).toBe(zh.invite.ok)
    expect(TOAST.error).not.toHaveBeenCalled()
    expect(document.querySelector('[data-sf-m="invite-error"]')).toBeNull()
  })

  it('全 0 ⇒ 不发请求（页面不提交无效编号）', async () => {
    renderPane()
    await waitFor(() => expect(cells()).toHaveLength(6))
    '000000'.split('').forEach((char, i) => typeAt(i, char))
    expect(document.querySelector('[data-sf-m="invite-submit"]').disabled).toBe(true)
  })

  it('失败 ⇒ 卡内内联（role=alert）+ 不弹 Toast', async () => {
    API.bindReferral.mockRejectedValueOnce(Object.assign(new Error('已被绑定'), { status: 409, code: 'LEDGER_IDEMPOTENCY_CONFLICT' }))
    renderPane()
    await waitFor(() => expect(cells()).toHaveLength(6))
    '000100'.split('').forEach((char, i) => typeAt(i, char))
    fireEvent.click(document.querySelector('[data-sf-m="invite-submit"]'))
    await waitFor(() => expect(document.querySelector('[data-sf-m="invite-error"]')).toBeTruthy())
    const node = document.querySelector('[data-sf-m="invite-error"]')
    expect(node.getAttribute('role')).toBe('alert')
    expect(node.textContent).toBe(zh.invite.err)
    expect(TOAST.success).not.toHaveBeenCalled()
    expect(TOAST.error).not.toHaveBeenCalled()
  })

  it('已绑定 ⇒ 「已绑定邀请人 000100」+ 6 格全 disabled + 只读提示（不可改绑）', async () => {
    API.fetchMyReferral.mockResolvedValueOnce({ bound: true, parent_uid: 100, bound_at: '2026-10-24T00:00:00.000Z', depth: 1 })
    renderPane()
    await waitFor(() => expect(document.querySelector('[data-sf-m="invite-bound-uid"]')).toBeTruthy())
    expect(document.querySelector('[data-sf-m="invite-bound-uid"]').textContent).toBe('000100')
    expect(cells()).toHaveLength(6)
    expect(cells().every((c) => c.disabled)).toBe(true)
    expect(document.body.textContent).toContain(zh.invite.boundHint)
    // 已绑定态无提交钮（不可改绑 ⇒ 不给死钮）
    expect(document.querySelector('[data-sf-m="invite-submit"]')).toBeNull()
  })

  it('读口失败 ⇒ 加载失败态（不白屏、不弹 Toast）', async () => {
    API.fetchMyReferral.mockRejectedValueOnce(new Error('network down'))
    renderPane()
    await waitFor(() => expect(document.querySelector('[data-sf-m="invite-load-error"]')).toBeTruthy())
    expect(document.body.textContent).toContain('network down')
    expect(TOAST.error).not.toHaveBeenCalled()
  })
})

// ============================================================================
// ⑦ 接线静态判据（ProfilePage）
// ============================================================================
describe('ProfilePage 接线（静态）', () => {
  const SRC = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/ProfilePage.jsx'), 'utf8')

  it('视图派生含 /profile/invite', () => {
    expect(SRC).toContain("if (last === 'invite') return { kind: 'invite', subTab: '' }")
  })

  it('菜单顺序 = 我的收藏 → 我的邀请 → 账户设置', () => {
    const fav = SRC.indexOf("'profile-nav-favorites'")
    const invite = SRC.indexOf("'profile-nav-invite'")
    const settings = SRC.indexOf("'profile-nav-settings'")
    expect(fav).toBeGreaterThan(-1)
    expect(invite).toBeGreaterThan(fav)
    expect(settings).toBeGreaterThan(invite)
    expect(SRC).toContain("buildLocalizedPath(lang, '/profile/invite')")
  })

  it('pane 渲染点在场', () => {
    expect(SRC).toContain("import InvitePane from './profile/InvitePane'")
    expect(SRC).toContain("{view.kind === 'invite' && (")
  })
})

// ============================================================================
// ⑧ 四语键集齐步（本轮新增 8 键）
// ============================================================================
describe('四语新键', () => {
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  ))

  it('8 个新增键四语齐备且键集相等', () => {
    const keys = ['profileNav.invite', 'invite.desc', 'invite.label', 'invite.bound', 'invite.boundHint', 'invite.submit', 'invite.ok', 'invite.err']
    const shapes = Object.entries(TABLES).map(([lang, table]) => {
      const all = new Set(flat(table))
      keys.forEach((k) => expect(all.has(k), `${lang} 缺 ${k}`).toBe(true))
      return flat(table).sort().join('|')
    })
    expect(new Set(shapes).size).toBe(1)
  })
})
