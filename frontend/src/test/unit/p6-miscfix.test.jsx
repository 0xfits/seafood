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
  const state = { lang: 'zh', hasI18n: true, tables: {} }
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
vi.mock('../../pages/listings/listing-api', () => ({
  fetchListingFeed: vi.fn(async () => [
    { bID: 5, name: 'x', points: 3, status: 'draft' },
    { bID: 6, name: 'x', points: 3, status: 'delisted' },
    { bID: 7, name: 'x', points: 3, status: 'sunset-value' },   // 未知取值（不得原样渲染）
    { bID: 8, name: 'x', points: 3 },                           // 缺失 status（既有口径 = 已上架）
  ]),
  fetchMyListingOrders: vi.fn(async () => []),
  refundListingOrder: vi.fn(),
}))
vi.mock('../../components/Header', () => ({ default: () => null }))
vi.mock('../../components/Footer', () => ({ default: () => null }))

import ListingsPage from '../../pages/listings/ListingsPage'
import { DatePicker } from '../../components/ui/Advanced'
import { buildLocalizedPath } from '../../utils'

const inRouter = (node) => render(<MemoryRouter initialEntries={['/listing']}>{node}</MemoryRouter>)
const tags = () => [...document.querySelectorAll('[data-sf-m="listing-grid"] .sf-listings-tag')]

beforeEach(() => {
  H.tables = { zh, hk, en, vn }
  H.lang = 'zh'; H.hasI18n = true; H.i18n.resolvedLanguage = 'zh'; H.i18n.language = 'zh'
})
afterEach(() => cleanup())

describe('① ListingsPage 状态标签：四语标签 + 未知取值兜底', () => {
  it('四语各自渲染本地化标签（判负：四语取值互不相同）', async () => {
    const seen = {}
    for (const lang of ['zh', 'hk', 'en', 'vn']) {
      H.lang = lang; H.i18n.resolvedLanguage = lang; H.i18n.language = lang
      inRouter(<ListingsPage />)
      await screen.findByText(TABLES[lang].listings.list)
      await waitFor(() => expect(tags().length).toBe(4))   // feed 是异步的：等卡片落 DOM
      const got = tags().map((el) => el.textContent)
      expect(got).toContain(TABLES[lang].listings.statusLabel.draft)
      expect(got).toContain(TABLES[lang].listings.statusLabel.delisted)
      seen[lang] = got.join('|')
      cleanup()
    }
    expect(new Set(Object.values(seen)).size).toBe(4)   // 四语两两可区分
  })

  it('未知取值 ⇒ 本地化兜底（不渲染原始枚举、不空白），原值留在 title/data-sf-status', async () => {
    H.lang = 'en'; H.i18n.resolvedLanguage = 'en'; H.i18n.language = 'en'
    inRouter(<ListingsPage />)
    await screen.findByText(TABLES.en.listings.list)
    await waitFor(() => expect(tags().length).toBe(4))
    const all = tags().map((el) => el.textContent)
    expect(all).not.toContain('sunset-value')                       // 判负 1：原始枚举不得进用户面
    expect(all).not.toContain('')                                   // 判负 2：不得空白
    expect(all).toContain(TABLES.en.listings.statusLabel.unknown)   // 兜底 = 本地化「未知」
    const unknown = tags().find((el) => el.textContent === TABLES.en.listings.statusLabel.unknown)
    expect(unknown.getAttribute('data-sf-status')).toBe('sunset-value')
    expect(unknown.getAttribute('title')).toBe('sunset-value')
  })

  it('缺失 status ⇒ 维持既有口径（listings.statusLabel.listed），不留 data-sf-status', async () => {
    H.lang = 'zh'; H.i18n.resolvedLanguage = 'zh'; H.i18n.language = 'zh'
    inRouter(<ListingsPage />)
    await screen.findByText(TABLES.zh.listings.list)
    await waitFor(() => expect(tags().length).toBe(4))
    const listed = tags().filter((el) => el.textContent === TABLES.zh.listings.statusLabel.listed)
    expect(listed.length).toBeGreaterThan(0)
    expect(listed[0].getAttribute('data-sf-status')).toBeNull()
  })

  it('四语 statusLabel 键集相等（en/vn 不得残留中文）', () => {
    const keys = Object.keys(zh.listings.statusLabel).sort()
    for (const lang of ['hk', 'en', 'vn']) {
      expect(Object.keys(TABLES[lang].listings.statusLabel).sort()).toEqual(keys)
    }
    expect(/\p{Script=Han}/u.test(JSON.stringify(en.listings.statusLabel))).toBe(false)
    expect(/\p{Script=Han}/u.test(JSON.stringify(vn.listings.statusLabel))).toBe(false)
  })
})

describe('② 链接构造器回归：源码残留必须逐条已登记', () => {
  const REGISTERED = new Set([
    'components/ActiveTaskModal.jsx|navigate|/login',
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
    expect(hits.length).toBeGreaterThan(0)      // 断言有效：作用域不得命中 0 条
    expect(hits.filter((h) => !REGISTERED.has(h))).toEqual([])
  })
  it('判负：构造器对四语/非法语言输出符合契约', () => {
    expect(buildLocalizedPath('en', '/task')).toBe('/en/task')
    expect(buildLocalizedPath('hk', '/shard')).toBe('/hk/shard')
    expect(buildLocalizedPath('vn', '/reward')).toBe('/vn/reward')
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
