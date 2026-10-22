/**
 * /wage 项目卡卡头头像（Kevin 2026-10-22）
 *
 * 覆盖面：
 *   ① 有 `avatar_url` ⇒ 圆形头像内渲染 `<img src>`（`alt=""` 装饰图，零首字兜底）；
 *   ② 无 `avatar_url`（null / 空串 / 非串）⇒ 项目名首字 + `data-sf-tone` 档位，零 `<img>`；
 *   ③ 首字颜色由名字决定且**稳定**：`data-sf-tone` === `avatarToneOf(title)`，
 *      同一名字重挂载仍同档；不同名字可落在不同档（hash 真起作用）；
 *   ④ 共用唯一实现：本页取到的 `avatarToneOf` 与 `home-campaign.js` 导出的是**同一个函数**
 *      （不是复制实现），且项目页 `ProjectAvatar` 的首字也走同一份 `avatarInitialOf`；
 *   ⑤ 样式零新色值：`wage.css` 头像规则只用 `var(--sf-thumb-N)` / 既有 token、40px 圆形；
 *   ⑥ 卡内其余结构零变化：状态徽标 / 工资行 / 动作按钮仍在（头像只加在卡头左侧）。
 *
 * 注：真实浏览器几何（40px 圆形读数 / 390·1536 零溢出 / 页头不折行）由
 *     `ops/wage/front/probe-wage.mjs` 的 avatar 臂覆盖（jsdom 不套用 media query / 不算布局）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: makeT(zh), i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' } }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

import WagePage from '../../pages/wage/WagePage'
import { avatarInitialOf, avatarToneOf } from '../../avatar-tone'
import { avatarToneOf as avatarToneOfFromHomeCampaign } from '../../home-campaign'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WAGE_CSS = fs.readFileSync(path.join(SRC, 'pages/wage/wage.css'), 'utf8')
const PROJECT_AVATAR_SRC = fs.readFileSync(path.join(SRC, 'pages/project/ProjectAvatar.jsx'), 'utf8')
const WAGE_PAGE_SRC = fs.readFileSync(path.join(SRC, 'pages/wage/WagePage.jsx'), 'utf8')

const ROW_WITH_AVATAR = {
  project_id: 21,
  snowflake_id: '70021',
  title: '海鲜打包',
  description: '每天打包 20 单',
  headcount: 3,
  hired_count: 2,
  wage_batt_per_claim: 30,
  wage_cid: 1,
  wage_currency_amount: 0,
  wage_interval_hours: 4,
  status: 'recruiting',
  my_role: 'none',
  avatar_url: '/api/media/4321',
}

const rowNoAvatar = (patch = {}) => ({
  project_id: 22,
  snowflake_id: '70022',
  title: '冷库分拣',
  description: '早班分拣冻品',
  headcount: 4,
  hired_count: 1,
  wage_batt_per_claim: 25,
  wage_cid: 1,
  wage_currency_amount: 0,
  wage_interval_hours: 6,
  status: 'recruiting',
  my_role: 'none',
  avatar_url: null,
  ...patch,
})

const okBody = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })

const installFetch = (rows) => {
  const fn = vi.fn(async (url) => {
    const target = String(url)
    if (target.startsWith('/api/project/all')) return okBody(rows)
    if (target.startsWith('/api/currencies')) return okBody([{ cid: 1, symbol: '$' }])
    if (target.startsWith('/api/user')) return okBody({ uID: 7 })
    return okBody([])
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const mount = () => render(
  <MemoryRouter initialEntries={['/wage']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <WagePage />
  </MemoryRouter>
)

const avatarOf = (root, id) => root.querySelector(
  `[data-sf-m="wage-card"][data-sf-project="${id}"] [data-sf-m="wage-card-avatar"]`
)

beforeEach(() => {
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/wage 卡头头像 · 两形态', () => {
  it('有 avatar_url ⇒ <img src> 铺满圆形头像，零首字兜底（alt="" 装饰图）', async () => {
    installFetch([ROW_WITH_AVATAR, rowNoAvatar()])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(2))

    const avatar = avatarOf(container, '21')
    expect(avatar).not.toBeNull()
    expect(avatar.getAttribute('data-sf-avatar')).toBe('img')
    const img = avatar.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/api/media/4321')
    expect(img.getAttribute('alt')).toBe('')
    expect(img.className).toBe('sf-wage-card-avatar-img')
    // 有图 ⇒ 不渲染首字兜底、不挂兜底色档
    expect(avatar.querySelector('.sf-wage-card-avatar-initial')).toBeNull()
    expect(avatar.getAttribute('data-sf-tone')).toBeNull()
  })

  it('无 avatar_url（null / 空串 / 非串）⇒ 项目名首字兜底 + data-sf-tone，零 <img>', async () => {
    installFetch([
      rowNoAvatar({ project_id: 22, title: '冷库分拣', avatar_url: null }),
      rowNoAvatar({ project_id: 23, title: '文案校对', avatar_url: '' }),
      rowNoAvatar({ project_id: 24, title: '客服值守', avatar_url: undefined }),
      rowNoAvatar({ project_id: 25, title: '', avatar_url: '   ' }),
    ])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(4))

    const expectInitial = (id, title, initial) => {
      const avatar = avatarOf(container, id)
      expect(avatar.getAttribute('data-sf-avatar')).toBe('initial')
      expect(avatar.querySelector('img')).toBeNull()
      const span = avatar.querySelector('.sf-wage-card-avatar-initial')
      expect(span).not.toBeNull()
      expect(span.textContent).toBe(initial)
      expect(Number(avatar.getAttribute('data-sf-tone'))).toBe(avatarToneOf(title))
    }
    expectInitial('22', '冷库分拣', '冷')
    expectInitial('23', '文案校对', '文')
    expectInitial('24', '客服值守', '客')
    // 空名 ⇒ 占位符 '?'（档位恒 1）
    expectInitial('25', '', '?')
    expect(avatarOf(container, '25').getAttribute('data-sf-tone')).toBe('1')
  })

  it('头像在卡头左组首位（在标题之前），且与标题同一行容器内', async () => {
    installFetch([rowNoAvatar()])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))

    const avatar = avatarOf(container, '22')
    const title = container.querySelector('[data-sf-m="wage-card-title"]')
    const headMain = avatar.parentElement
    expect(headMain.className).toBe('sf-wage-card-head-main')
    expect(headMain).toBe(title.parentElement)
    expect(headMain.firstElementChild).toBe(avatar)
    expect(avatar.nextElementSibling).toBe(title)
  })
})

describe('/wage 卡头头像 · 首字颜色由名字决定且稳定', () => {
  it('同一名字 ⇒ 同一档位（重挂载/多次调用都稳定），档位落在 1..10', async () => {
    installFetch([rowNoAvatar({ title: '夜间补货' })])
    const first = mount()
    await waitFor(() => expect(first.container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const tone1 = avatarOf(first.container, '22').getAttribute('data-sf-tone')
    cleanup()

    installFetch([rowNoAvatar({ title: '夜间补货' })])
    const second = mount()
    await waitFor(() => expect(second.container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const tone2 = avatarOf(second.container, '22').getAttribute('data-sf-tone')

    expect(tone2).toBe(tone1)
    expect(Number(tone1)).toBeGreaterThanOrEqual(1)
    expect(Number(tone1)).toBeLessThanOrEqual(10)
    // 纯函数层同样稳定（连续调用恒同值）
    expect(avatarToneOf('夜间补货')).toBe(avatarToneOf('夜间补货'))
    expect(avatarToneOf('夜间补货')).toBe(Number(tone1))
  })

  it('不同名字可落在不同档（hash 真生效，不是恒色）', () => {
    const tones = new Set(['项目一', '项目二', '项目三', '项目四', '项目五'].map((n) => avatarToneOf(n)))
    expect(tones.size).toBeGreaterThan(1)
    // 档位集合恒在 1..10；空名/非串 ⇒ 1
    for (const tone of tones) {
      expect(tone).toBeGreaterThanOrEqual(1)
      expect(tone).toBeLessThanOrEqual(10)
    }
    expect(avatarToneOf('')).toBe(1)
    expect(avatarToneOf(null)).toBe(1)
    expect(avatarToneOf(undefined)).toBe(1)
  })

  it('首字取首个码点（代理对不被截半个字符）', () => {
    expect(avatarInitialOf('海鲜打包')).toBe('海')
    expect(avatarInitialOf('  spaced ')).toBe('s')
    expect(avatarInitialOf('')).toBe('?')
    expect(avatarInitialOf('🦐虾市')).toBe('🦐')
  })
})

describe('/wage 卡头头像 · 共用唯一实现 + 零新色值', () => {
  it('avatarToneOf 与首页热门任务卡取的是同一个函数（抽共用，不复制）', () => {
    expect(avatarToneOfFromHomeCampaign).toBe(avatarToneOf)
    // 本页/项目页都从 `src/avatar-tone.js` 取，不各自内联 hash
    expect(WAGE_PAGE_SRC).toContain("from '../../avatar-tone'")
    expect(PROJECT_AVATAR_SRC).toContain("from '../../avatar-tone'")
    // 本页不得再自带一份码点和实现（唯一真源只在 avatar-tone.js）
    expect(WAGE_PAGE_SRC).not.toContain('charCodeAt')
    expect(PROJECT_AVATAR_SRC).not.toContain('charCodeAt')
  })

  it('wage.css 头像规则：40px 圆形、零新色值（只用 --sf-thumb-N / 既有 token）', () => {
    const block = WAGE_CSS.slice(
      WAGE_CSS.indexOf('.sf-wage-card-avatar {'),
      WAGE_CSS.indexOf('.sf-wage-joined-badge {'),
    )
    expect(block).toContain('width: 40px;')
    expect(block).toContain('height: 40px;')
    expect(block).toContain('border-radius: 50%;')
    expect(block).toContain('object-fit: cover')
    // 十档全部取既有 token（`--sf-thumb-1 … --sf-thumb-10`）
    for (let n = 1; n <= 10; n += 1) expect(block).toContain(`var(--sf-thumb-${n})`)
    // 零硬编码色值（#hex / rgb() / hsl() 一律不出现）
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(block).not.toMatch(/\brgba?\(/)
    expect(block).not.toMatch(/\bhsla?\(/)
  })

  it('标题可收缩不折行：min-width:0 + ellipsis；卡内其余结构零变化', async () => {
    const titleBlock = WAGE_CSS.slice(WAGE_CSS.indexOf('.sf-wage-card-title {'), WAGE_CSS.indexOf('.sf-wage-status {'))
    expect(titleBlock).toContain('min-width: 0;')
    expect(titleBlock).toContain('text-overflow: ellipsis;')
    const headMainBlock = WAGE_CSS.slice(
      WAGE_CSS.indexOf('.sf-wage-card-head-main {'),
      WAGE_CSS.indexOf('.sf-wage-card-avatar {'),
    )
    expect(headMainBlock).toContain('flex-wrap: nowrap;')

    installFetch([ROW_WITH_AVATAR, rowNoAvatar()])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(2))
    // 状态徽标 / 工资行 / 动作按钮 / 已招 X/Y 全在（头像只加在卡头左侧）
    for (const id of ['21', '22']) {
      const card = container.querySelector(`[data-sf-m="wage-card"][data-sf-project="${id}"]`)
      expect(card.querySelector('[data-sf-m="wage-card-status"]')).not.toBeNull()
      expect(card.querySelector('[data-sf-m="wage-card-wage"]')).not.toBeNull()
      expect(card.querySelector('[data-sf-m="wage-card-headcount"]')).not.toBeNull()
      expect(card.querySelector('[data-sf-m="wage-card-action"]')).not.toBeNull()
      expect(card.querySelector('[data-sf-m="wage-card-title"]').textContent).toBe(
        id === '21' ? '海鲜打包' : '冷库分拣'
      )
    }
  })
})
