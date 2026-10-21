/**
 * P6-MISC-FIX 单测（本单新增）—— 六项小修的**回归契约**
 *  ① `ListingsPage` 状态标签：四语标签 + **未知取值兜底**（不得渲染原始枚举、不得空白）+ 原值留 `title`/`data-sf-status`
 *  ② 乙族硬编码绝对站内链接：源码不变量 —— 唯一构造器 `buildLocalizedPath` 之外的残留必须**逐条落在登记待办**集合
 *  ⑥ `DatePicker.formatDate`：按当前语言映射 Intl 区域（zh→zh-CN/hk→zh-HK/en→en-US/vn→vi-VN）；
 *     **判负用例**：非法/缺失语言 ⇒ 不抛异常且等于默认 `zh-CN`
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, hk, en, vn }

// t / i18n 必须**模块级稳定**（页面用 useCallback(..., [t])：每次新闭包 ⇒ 无限重渲染 ⇒ OOM）
const H = vi.hoisted(() => {
  const state = { lang: 'zh', hasI18n: true, tables: {}, feed: [] }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: H.t, i18n: H.hasI18n ? H.i18n : undefined }),
}))
vi.mock('../../auth-context', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, isProfileComplete: false, updateSession: vi.fn() }),
}))
// 2026-10-11 合并单：唯一列表 = 首页（取 `/api/prize/all`）。聚合口 `/api/home` 抛错 ⇒ 首页回落逐口读。
vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async (url) => {
    const u = String(url)
    if (u.startsWith('/api/home')) throw new Error('HOME_UNREGISTERED')
    if (u.includes('/api/prize/all')) return H.feed
    if (u.includes('/api/prize-item')) return []
    if (u.includes('/api/user/asset/')) return { points: 0 }
    return []
  }),
  getAuthHeaders: vi.fn(() => ({})),
}))
vi.mock('../../pages/item/item-api', () => ({
  fetchListingFeed: vi.fn(async () => H.feed),
  fetchMyListingOrders: vi.fn(async () => []),
  refundListingOrder: vi.fn(),
  fetchListingDetail: vi.fn(async () => null),
  buyListing: vi.fn(),
  createListingBuyTracker: () => ({ keyFor: () => 'cli:x', reset: () => {} }),
  listingBuyFingerprint: () => 'fp',
}))
vi.mock('../../components/Header', () => ({ default: () => null }))
vi.mock('../../components/Footer', () => ({ default: () => null }))

import HomePage from '../../pages/HomePage'
import { DatePicker } from '../../components/ui/Advanced'
import { buildLocalizedPath } from '../../utils'

const inRouter = (node, entry = '/') => render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>)

beforeEach(() => {
  H.tables = { zh, hk, en, vn }
  H.lang = 'zh'; H.hasI18n = true; H.i18n.resolvedLanguage = 'zh'; H.i18n.language = 'zh'
})
afterEach(() => cleanup())

describe('① 首页闲置列表面：状态徽章已移除（Kevin 2026-10-19 卡片改版）——状态文案/原始枚举均不得进用户面', () => {
  // ★ 2026-10-19 改锚（合法移除）：原断言「四语状态文案渲染在卡上」的唯一消费点 = RewardCard 卡头状态徽章
  //   （`<Badge>{reward.statusText}</Badge>`），该徽章随卡片改版整块移除 ⇒ 正向断言反向化：
  //   状态文案（可兑换/库存不足等）**不再出现**在首页任何位置；「原始枚举不得进用户面」负向口径原样保留。
  const feedReady = async (container) => {
    await waitFor(() => expect(container.querySelector('[data-sf-m="feed-grid"]')).not.toBeNull())
    await waitFor(() => expect(container.querySelector('[data-sf-m="reward-card"]')).not.toBeNull())
  }

  it('四语状态文案（可兑换/库存不足）不再渲染（原状态徽章消费点已删）', async () => {
    for (const lang of ['zh', 'hk', 'en', 'vn']) {
      H.lang = lang; H.i18n.resolvedLanguage = lang; H.i18n.language = lang
      H.feed = [
        { bID: 5, name: 'x', points: 3, stores_count: 2 },   // 旧口径 => 可兑换
        { bID: 6, name: 'x', points: 3, stores_count: 0 },   // 旧口径 => 库存不足
      ]
      const { container } = inRouter(<HomePage />)
      await feedReady(container)
      expect(container.textContent).not.toContain(TABLES[lang].common.redeemable)
      expect(container.textContent).not.toContain(TABLES[lang].common.outOfStock)
      cleanup()
    }
  })

  it('判负：原始状态枚举（available/locked/claimed）不得进用户面', async () => {
    H.lang = 'en'; H.i18n.resolvedLanguage = 'en'; H.i18n.language = 'en'
    H.feed = [
      { bID: 5, name: 'x', points: 3, stores_count: 2 },
      { bID: 6, name: 'x', points: 3, stores_count: 0 },
    ]
    const { container } = inRouter(<HomePage />)
    await feedReady(container)
    // 注：'available'/'claimed' 会与合法英文文案（`homePage.noTasks`）撞车 ⇒ 不入禁用集（原注保留）
    for (const raw of ['locked', 'outOfStock', 'redeemable', 'sunset-value']) {
      expect(container.textContent).not.toContain(raw)
    }
  })

  it('缺失 stores_count => 不渲染状态文案、不泄漏原始枚举（原「库存不足兜底」正向断言随徽章移除改锚）', async () => {
    H.lang = 'zh'; H.i18n.resolvedLanguage = 'zh'; H.i18n.language = 'zh'
    H.feed = [{ bID: 8, name: 'x', points: 3 }]
    const { container } = inRouter(<HomePage />)
    await feedReady(container)
    expect(container.textContent).not.toContain(TABLES.zh.common.outOfStock)
    expect(container.textContent).not.toContain('locked')
  })

  it('四语 statusLabel 键集相等（en/vn 不得残留中文）', () => {
    const keys = Object.keys(zh.item.statusLabel).sort()
    for (const lang of ['hk', 'en', 'vn']) {
      expect(Object.keys(TABLES[lang].item.statusLabel).sort()).toEqual(keys)
    }
    expect(/\p{Script=Han}/u.test(JSON.stringify(en.item.statusLabel))).toBe(false)
    expect(/\p{Script=Han}/u.test(JSON.stringify(vn.item.statusLabel))).toBe(false)
  })
})


describe('② 链接构造器回归：源码残留必须逐条已登记', () => {
  const REGISTERED = new Set([
    'pages/DashboardPage.jsx|navigate|/login',
    'pages/DashboardPage.jsx|to=|/',
    'pages/admin/PointsManagement.jsx|navigate|/login',
    'pages/admin/PermissionsManagement.jsx|navigate|/login',
    'pages/admin/UsersManagement.jsx|navigate|/login',
    'pages/admin/SystemSettings.jsx|navigate|/login',
  ])
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, out)
      else if (/\.(js|jsx)$/.test(e.name)) out.push(p)
    }
    return out
  }
  it('src 下 to="/…" / navigate("/…" 的残留 ⊆ 登记待办', () => {
    const src = path.join(process.cwd(), 'src')
    const hits = []
    for (const abs of walk(path.join(src, 'pages')).concat(walk(path.join(src, 'components')))) {
      const rel = path.relative(src, abs)
      const text = fs.readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
      for (const [kind, re] of [['to=', /\bto=("|')(\/[^"']*)\1/g], ['navigate', /\bnavigate\(\s*("|')(\/[^"']*)\1/g]]) {
        let m
        while ((m = re.exec(text))) {
          if (m[2].startsWith('/api/')) continue
          hits.push(`${rel}|${kind}|${m[2]}`)
        }
      }
    }
    expect(hits).toEqual([])                    // 上批 10 处已全部改走唯一构造器 ⇒ 硬编码残留 = 0
    // 有效性闸下移到构造器侧：构造器使用点不得为 0（取代旧的「残留非 0」闸，非放宽）
    const ctor = walk(path.join(src, 'pages')).concat(walk(path.join(src, 'components')))
      .reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/buildLocalizedPath\(/g) || []).length, 0)
    expect(ctor).toBeGreaterThanOrEqual(10)
  })
  it('判负：构造器对四语/非法语言输出符合契约', () => {
    expect(buildLocalizedPath('en', '/task')).toBe('/en/task')
    expect(buildLocalizedPath('hk', '/shard')).toBe('/hk/shard')
    expect(buildLocalizedPath('vn', '/task')).toBe('/vn/task')
    expect(buildLocalizedPath('zh', '/profile')).toBe('/profile')
    for (const bad of [undefined, null, '', 'xx', 'ZH', 0]) {
      expect(String(buildLocalizedPath(bad, '/login'))).not.toContain('undefined')
    }
  })
})

describe('⑥ DatePicker.formatDate 按语言格式化（含判负）', () => {
  const VALUE = '2026-10-01'
  const renderDate = () => { inRouter(<DatePicker value={VALUE} onChange={() => {}} />); return document.body.textContent }

  it('四语映射到各自 Intl 区域（zh-CN/zh-HK/en-US/vi-VN）', () => {
    const map = { zh: 'zh-CN', hk: 'zh-HK', en: 'en-US', vn: 'vi-VN' }
    const seen = {}
    for (const [lang, loc] of Object.entries(map)) {
      H.lang = lang; H.i18n.resolvedLanguage = lang; H.i18n.language = lang
      const text = renderDate()
      const expected = new Date(VALUE).toLocaleDateString(loc)
      expect(text).toContain(expected)
      seen[lang] = expected
      cleanup()
    }
    expect(seen.en).not.toBe(seen.zh)   // 判负：不同语言产出不同格式化结果
  })

  it('判负：非法/缺失语言不抛异常，且回落到默认 zh-CN、i18n 缺失亦不抛', () => {
    const zhText = new Date(VALUE).toLocaleDateString('zh-CN')
    for (const bad of [undefined, null, '', 'xx', 'ZH', 0, 'zh-Hans']) {
      H.lang = bad; H.i18n.resolvedLanguage = bad; H.i18n.language = bad
      const text = renderDate()
      expect(text).toContain(zhText)
      cleanup()
    }
    H.hasI18n = false
    expect(() => renderDate()).not.toThrow()
    expect(renderDate()).toContain(zhText)
  })
})
