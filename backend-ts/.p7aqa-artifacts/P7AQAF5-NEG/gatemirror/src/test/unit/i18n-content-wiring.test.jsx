/**
 * TR-2 · 前端四语接线 + 「翻译中」小标（本单新增单测）
 *
 * 口径：本文件钉的是**跨片交接面契约**（不是实现细节）——
 *   ① 取值形态 `obj['<key>_<lang>'] || obj[key]`：对**空串**与**缺字段**都安全
 *      （`??` 会被空串穿透 ⇒ 本单**禁 `??`** 取多语列）；
 *   ② `zh` 档 = 无后缀字段（译文**不得**进中文档）；
 *   ③ 小标：`i18n_status ∈ {pending, partial}` ⇒ 可见；`ready` / **字段缺省** ⇒ 不可见；
 *   ④ 契约允许「未翻译时 `*_<lang>` **等于原文**（不为空串）」⇒ 该形态必须渲染**原文**且小标可见，
 *      不得渲染成空白；
 *   ⑤ 四语 locale 文件键集逐文件相同（本单新增 `i18n.translating`）。
 *
 * ★ 探针自曝（同 `listing-market.test.jsx` 的既有坑）：`t` 取**模块级稳定函数**——
 *   页面里 `useCallback(..., [t])` + 内部 setState ⇒ 若 mock 每次返回新闭包，effect 依赖每次变化
 *   ⇒ **无限重渲染**。真机 i18next 的 `t` 稳定，故这是**测试替身的约束**，不是产品代码缺陷。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const BADGE = 'TR2-翻译中小标'
const stableT = (key) => (key === 'i18n.translating' ? BADGE : key)
// TR-FIX：当前语言可切换（zh 档不渲染小标）——`vi.hoisted` 使 mock 工厂与用例共享同一可变对象
const state = vi.hoisted(() => ({ feedRows: [], lang: 'en' }))
const stableI18n = {
  changeLanguage: vi.fn(),
  get resolvedLanguage() { return state.lang },
  get language() { return state.lang },
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT, i18n: stableI18n }),
}))

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async (url) => (String(url).includes('/api/prize/all') ? state.feedRows : [])),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: false, user: null })),
}))

import ListingsPage from '../../pages/listings/ListingsPage'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import {
  contentStatus,
  isTranslating,
  localizeFields,
  needsTranslatingBadge,
  pickLocalized,
} from '../../i18n-content'

const renderListings = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <ListingsPage />
  </MemoryRouter>,
)

describe('TR-2 · 多语读取（pickLocalized / localizeFields）', () => {
  it('对**空串**与**缺字段**都安全：空串 ⇒ 回落原文；缺字段 ⇒ undefined（不前向零宽）', () => {
    const row = { title: '中文', title_en: 'English', title_vn: '' }

    expect(pickLocalized(row, 'title', 'en')).toBe('English')
    // ★ 契约：`*_<lang>` 未翻译时 = 原文；若后端误给空串，也必须回落原文（`??` 会穿透 ⇒ 这正是禁它的原因）
    expect(pickLocalized(row, 'title', 'vn')).toBe('中文')
    // 缺字段：既无 `title_hk` 也无……
    expect(pickLocalized(row, 'title', 'hk')).toBe('中文')
    expect(pickLocalized(row, 'missing', 'en')).toBeUndefined()
    expect(pickLocalized(null, 'title', 'en')).toBeUndefined()
    // `??` 反例：空串会穿透 ⇒ 断言我们的取值不落到空串
    expect(row.title_vn ?? row.title).toBe('')
    expect(pickLocalized(row, 'title', 'vn')).not.toBe('')
  })

  it('zh 档 = 无后缀字段（译文不进中文档）；非白名单语言码归一到 zh', () => {
    const row = { title: '中文', title_en: 'English' }

    expect(pickLocalized(row, 'title', 'zh')).toBe('中文')
    expect(pickLocalized(row, 'title', 'fr')).toBe('中文')
    expect(localizeFields(row, ['title'], 'zh')).toBe(row) // zh ⇒ 原行直返（零行为变化）
  })

  it('localizeFields：返回新对象（不改原行）、缺键不新增、`_<lang>` 与原文双缺时保持 undefined', () => {
    const row = { title: '中文', title_en: 'English', note: '备注' }
    const next = localizeFields(row, ['title', 'note', 'description'], 'en')

    expect(next.title).toBe('English')
    expect(next.note).toBe('备注') // `note_en` 缺 ⇒ 回落原文
    expect(Object.prototype.hasOwnProperty.call(next, 'description')).toBe(false)
    expect(row.title).toBe('中文') // 原行未被就地改写
  })
})

describe('TR-2 · 「翻译中」小标判据 + 组件', () => {
  it('判据：pending/partial ⇒ true；ready/缺省/未知值 ⇒ false', () => {
    expect(contentStatus({ i18n_status: 'pending' })).toBe('pending')
    expect(contentStatus({})).toBeNull()
    expect(contentStatus(null)).toBeNull()
    expect(isTranslating('pending')).toBe(true)
    expect(isTranslating('partial')).toBe(true)
    expect(isTranslating('ready')).toBe(false)
    expect(isTranslating(null)).toBe(false)
    expect(needsTranslatingBadge({ i18n_status: 'ready' })).toBe(false)
    expect(needsTranslatingBadge({ i18n_status: 'partial' })).toBe(true)
  })

  it('组件：ready / 缺省 ⇒ 渲染 null（不可见）；pending / partial ⇒ 可见且文案走 i18n 键', () => {
    const { container: ready } = render(<TranslatingBadge status="ready" />)
    expect(ready.textContent).toBe('')

    const { container: absent } = render(<TranslatingBadge />)
    expect(absent.textContent).toBe('')

    const { container: pending } = render(<TranslatingBadge status="pending" />)
    expect(pending.textContent).toContain(BADGE)
    expect(pending.querySelector('[data-sf-m="i18n-translating"]')).not.toBeNull()
    expect(pending.querySelector('[data-i18n-status="pending"]')).not.toBeNull()

    const { container: partial } = render(<TranslatingBadge status="partial" />)
    expect(partial.textContent).toContain(BADGE)
  })
})

// TR-FIX：小标仅在**非 zh 档**渲染（zh = 源语言，原文即本档，提示无意义）
describe('TR-FIX · 「翻译中」小标仅非 zh 档渲染', () => {
  beforeEach(() => { state.lang = 'en' })

  it('zh 档 + `i18n_status:"partial"` ⇒ 无小标（源语言档）', () => {
    state.lang = 'zh'
    const { container } = render(<TranslatingBadge status="partial" />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('[data-sf-m="i18n-translating"]')).toBeNull()
  })

  it('en 档 + `pending` ⇒ 有小标', () => {
    state.lang = 'en'
    const { container } = render(<TranslatingBadge status="pending" />)
    expect(container.textContent).toContain(BADGE)
    expect(container.querySelector('[data-sf-m="i18n-translating"]')).not.toBeNull()
  })

  it('en 档 + `ready` ⇒ 无小标', () => {
    state.lang = 'en'
    const { container } = render(<TranslatingBadge status="ready" />)
    expect(container.textContent).toBe('')
  })
})

describe('TR-2 · 页面接线（商品列表页，`/en/` 档）', () => {
  beforeEach(() => {
    state.feedRows = []
    state.lang = 'en'
  })

  it('en 档 + `i18n_status:"ready"`：渲染 `name_en`（English），**不**渲染中文原文，小标不可见', async () => {
    state.feedRows = [{ bID: 11, name: '中文', name_en: 'English', i18n_status: 'ready' }]
    renderListings('/en/listing')

    expect(await screen.findByText('English')).toBeInTheDocument()
    expect(screen.queryByText('中文')).toBeNull()
    expect(screen.queryByText(BADGE)).toBeNull()
  })

  it('en 档 + `pending` 且 `name_en` **等于原文** ⇒ 渲染原文**且**小标可见（不得空白）', async () => {
    state.feedRows = [{ bID: 12, name: '中文', name_en: '中文', i18n_status: 'pending' }]
    renderListings('/en/listing')

    expect(await screen.findByText('中文')).toBeInTheDocument()
    expect(screen.getByText(BADGE)).toBeInTheDocument()
    expect(document.querySelector('[data-sf-m="i18n-translating"]')).not.toBeNull()
  })

  it('`i18n_status` **缺省**（旧载荷）⇒ 回落原文且**不显示**小标', async () => {
    state.feedRows = [{ bID: 13, name: '中文', name_en: 'English' }]
    renderListings('/en/listing')

    expect(await screen.findByText('English')).toBeInTheDocument()
    expect(screen.queryByText(BADGE)).toBeNull()
  })

  it('zh 档（无语言前缀）⇒ 只认无后缀字段：译文不进中文档、无小标', async () => {
    state.lang = 'zh'
    state.feedRows = [{ bID: 14, name: '中文', name_en: 'English', i18n_status: 'partial' }]
    renderListings('/listing')

    expect(await screen.findByText('中文')).toBeInTheDocument()
    expect(screen.queryByText('English')).toBeNull()
    // TR-FIX：`zh` = 源语言 ⇒ 原文即本档，「翻译中」小标不显示
    expect(document.querySelectorAll('[data-sf-m="i18n-translating"]').length).toBe(0)
  })
})

describe('TR-2 · 四语 locale 键集 + 新键', () => {
  const LANGS = ['zh', 'en', 'hk', 'vn']
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const tableOf = (lang) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()

  it('四语文件键数相等（读数落盘见 stdout），`i18n.translating` 四语齐备且非空、非英文照抄', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = tableOf(lang)
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    // 读数（口径：顶层键数 + 拍平后键路径数）
    console.info('[TR-2] locale 键数读数', JSON.stringify(counts))

    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    expect(counts.zh.top).toBe(counts.en.top)

    const values = LANGS.map((lang) => tables[lang].i18n.translating)
    for (const value of values) {
      expect(typeof value).toBe('string')
      expect(value.trim().length).toBeGreaterThan(0)
    }
    expect(new Set(values).size).toBe(4) // 四语各自独立，不是同一串
    expect(sets.zh).toContain('i18n.translating')
  })
})

describe('TR-2 · 静态不变量：新接页面不得用 `??` 取多语列（空串会穿透）', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  // P6-I18N-LIT-B2：TaskPage / RewardPage 已单点收口（旧三目链 `_en ?? base` ⇒ 共用 `pickLocalized`）
  // P6-I18N-LIT-B5（D7 最后一项）：pages/HomePage.jsx 也收口 ⇒ 存量**清零**，首页并入 WIRED（断言更强）。
  const LEGACY = []
  const WIRED = [
    'pages/listings/ListingsPage.jsx',
    'pages/listings/ListingDetailPage.jsx',
    'pages/jobs/JobDetailPage.jsx',
    'pages/jobs/JobReviewPage.jsx',
    'pages/market/MarketPage.jsx',
    'pages/ProfilePage.jsx',
    'pages/TaskPage.jsx',
    'pages/RewardPage.jsx',
    'pages/HomePage.jsx',
  ]

  it('新接文件（含 B2 收口的 TaskPage / RewardPage）里没有 `_en/_hk/_vn` + `??` 组合（取值一律 `||`，经 i18n-content）', () => {
    for (const rel of WIRED) {
      const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
      expect(text.match(/_(en|hk|vn)\s*\?\?/g)).toBeNull()
      expect(text).toContain('i18n-content')
    }
    for (const rel of LEGACY) {
      // 存量登记（本单「只核不改」）：三目链里用的是 `??`，且**不**经 `i18n-content`（下单单点收口）
      const text = fs.readFileSync(path.join(SRC, 'pages', rel), 'utf8')
      expect(text).not.toContain('i18n-content')
      expect(text.match(/_(en|hk|vn)\s*\?\?/g)).not.toBeNull()
    }
  })
})
