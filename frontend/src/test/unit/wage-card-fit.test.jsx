/**
 * /wage 网格项目卡 **固定 180px** + 描述 **2 行**（Kevin 2026-10-24）
 *
 * 覆盖面（口径锚，不含几何实测）：
 *   ① 页内几何常量 `--sf-wage-card-h` = **180px**、两档同值（单一声明，不进主题层）；
 *   ② 卡高吃该常量，腾空间的手段 = 内距 9/12、gap 5、标题 15px、描述 12px/1.4（信息块一个不少）；
 *   ③ 描述 = **2 行**截断（`-webkit-line-clamp:2` + `overflow:hidden` + 固定 2 行高占位），
 *      且 `flex: 0 1 auto` —— 卡高固定后唯一允许被压缩的块（出现内联提示行时吸收，卡根不溢出）；
 *   ④ 移动档（≤767）描述降为 **1 行**，但按钮触控目标 **≥44** 一个字都不许降（T77）；
 *   ⑤ 右上当前项目卡**仍自适应**：`.sf-wage-current .sf-wage-current-card { height: auto; }`
 *      仍在，且选择器权重（0,2,0）高于 `.sf-wage-card`（0,1,0）；
 *   ⑥ 卡内信息块齐全（头像 / 标题 / 状态 / 描述 / 名额+进度条 / 工资行 / 操作钮），
 *      描述 DOM 文本仍全量（截断只是视觉）。
 *
 * 注：真实渲染几何（每卡恰 180px / 逐卡 scrollHeight ≤ clientHeight / 描述实测行数 / 44px 触控）
 *     由 `ops/wage/front/probe-wage.mjs` 的 equalHeight·geometry 臂在真浏览器里取证
 *     （jsdom 不套 media query、不算布局）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
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

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WAGE_CSS = fs.readFileSync(path.join(SRC, 'pages/wage/wage.css'), 'utf8')
// 去注释后的 CSS（头部注释里就写着「无 [data-theme] 选择器」⇒ 只对真规则断言）
const WAGE_RULES = WAGE_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

// 按选择器切块（CSS 文本口径断言；jsdom 不套 media query，只能读源码）
const block = (start, end) => {
  const from = WAGE_CSS.indexOf(start)
  expect(from).toBeGreaterThan(-1)
  const to = WAGE_CSS.indexOf(end, from)
  expect(to).toBeGreaterThan(from)
  return WAGE_CSS.slice(from, to)
}

const PAGE_VARS = block('.sf-wage-page {', '.sf-wage-head {')
const CARD = block('.sf-wage-card {', '.sf-wage-card-head {')
const DESC = block('.sf-wage-card-desc {', '.sf-wage-card-meta {')
const CURRENT_CARD = block('.sf-wage-current .sf-wage-current-card {', '.sf-wage-current.is-empty {')
const MOBILE = WAGE_CSS.slice(WAGE_CSS.indexOf('@media (max-width: 767px)'))

const ROW_OPEN = {
  project_id: 21,
  snowflake_id: '70021',
  title: '海鲜打包',
  description: '每天打包 20 单 · 冷库 4℃ 作业 · 有师傅带 · 结算当日到账（这段文案比两行长得多，视觉应截到 2 行）',
  headcount: 3,
  hired_count: 2,
  wage_batt_per_claim: 30,
  wage_cid: 1,
  wage_currency_amount: 0,
  wage_interval_hours: 4,
  status: 'recruiting',
  my_role: 'none',
  avatar_url: null,
}

// 在职（右上当前项目卡）：有【领工资】⇒ 操作区在场
const ROW_HIRED = {
  ...ROW_OPEN,
  project_id: 22,
  snowflake_id: '70022',
  title: '冷库分拣',
  description: '早班分拣冻品 · 4℃ 冷库 · 计件结算（这段也超过一行，用于验证有操作区时 desc 压 1 行）',
  status: 'recruiting',
  my_role: 'hired',
  my_hired_at: '2026-10-18T02:00:00.000Z',
}

// 已截止且非在职 ⇒ 三支分支都不命中 ⇒ 操作区**整块不渲染**（本单主旨）
const ROW_CLOSED = {
  ...ROW_OPEN,
  project_id: 23,
  snowflake_id: '70023',
  title: '旧仓搬迁',
  description: '已截止的搬迁项目 · 名额已满 · 不再招募（无操作区时 desc 应回 2 行并吃掉腾出来的空间）',
  status: 'closed',
  my_role: 'none',
}

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

beforeEach(() => {
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/wage 网格卡 180px · 页内常数', () => {
  it('--sf-wage-card-h = 180px（288 已退场），两档同值、只声明一次', () => {
    expect(PAGE_VARS).toContain('--sf-wage-card-h: 180px;')
    expect(PAGE_VARS).not.toContain('288px')
    // 全文件只此一处声明（零按断点/按主题分支的第二份值）
    expect(WAGE_CSS.match(/--sf-wage-card-h\s*:/g)).toHaveLength(1)
    // 本页零主题分支（颜色才跟主题走，几何两档同值）
    expect(WAGE_RULES).not.toContain('[data-theme')
    expect(WAGE_RULES).not.toContain('matchMedia')
  })

  it('卡高吃该常量；腾空间靠内距 8/12 + gap 4（不加新 token）', () => {
    expect(CARD).toContain('height: var(--sf-wage-card-h);')
    expect(CARD).toContain('padding: 8px 12px;')
    expect(CARD).toContain('gap: 4px;')
    expect(CARD).toContain('box-sizing: border-box;')
    // 零硬编码色值（本块只管几何）
    expect(CARD).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('/wage 网格卡 · 描述行数', () => {
  it('桌面档：描述恰 2 行截断（clamp 2 + 固定 2 行高 + overflow hidden）', () => {
    expect(DESC).toContain('-webkit-line-clamp: 2;')
    expect(DESC).toContain('overflow: hidden;')
    expect(DESC).toContain('height: calc(2 * 1.4em);')
    expect(DESC).toContain('font-size: 12px;')
    expect(DESC).toContain('line-height: 1.4;')
    expect(DESC).not.toContain('-webkit-line-clamp: 3;')
  })

  it('固定高卡里描述是唯一可压块（flex: 0 1 auto + min-height: 0 ⇒ 卡根不溢出）', () => {
    expect(DESC).toContain('flex: 0 1 auto;')
    expect(DESC).toContain('min-height: 0;')
    // 头 / 名额工资 / 操作区一律不许被压（44px 触控与卡头 40 头像不许缩）
    expect(block('.sf-wage-card-head {', '.sf-wage-card-head-main {')).toContain('flex: none;')
    expect(block('.sf-wage-card-meta {', '.sf-wage-pay {')).toContain('flex: none;')
    expect(block('.sf-wage-card-actions {', '.sf-wage-in-service {')).toContain('flex: none;')
  })

  it('移动档（≤767）：描述降为 1 行，但按钮触控目标仍 44（T77 不破）', () => {
    const mobileDesc = MOBILE.slice(MOBILE.indexOf('.sf-wage-card-desc {'), MOBILE.indexOf('.sf-wage-modal {'))
    expect(mobileDesc).toContain('-webkit-line-clamp: 1;')
    expect(mobileDesc).toContain('height: calc(1 * 1.4em);')
    expect(MOBILE).toContain('min-height: 44px;')
    // 44 这条不许被本单的任何规则下调（无 40 / 36 / 32 之类的按钮高）
    const btnBlock = MOBILE.slice(MOBILE.indexOf('.sf-wage-btn {'), MOBILE.indexOf('.sf-wage-card-desc {'))
    expect(btnBlock).toContain('min-height: 44px;')
  })
})

describe('/wage 右上当前项目卡 · 与左电量卡等高（标题容器已删）', () => {
  it('页内再无 .sf-wage-current-title：JSX 零节点 / CSS 零规则；语义由 aria-label 承载', async () => {
    const jsx = fs.readFileSync(path.join(SRC, 'pages/wage/WagePage.jsx'), 'utf8')
    expect(jsx).not.toContain('sf-wage-current-title')
    expect(WAGE_CSS).not.toContain('sf-wage-current-title')
    installFetch([ROW_HIRED, ROW_OPEN])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(2))
    expect(container.querySelector('.sf-wage-current-title')).toBeNull()
    const cur = container.querySelector('[data-sf-m="wage-current"]')
    expect(cur).not.toBeNull()
    expect(cur.getAttribute('aria-label')).toBe(zh.wage.currentTitle)
  })

  it('灰态占位卡同样靠 aria-label 承载「当前项目」语义（不再有标题行）', async () => {
    installFetch([ROW_OPEN])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const empty = container.querySelector('[data-sf-m="wage-current-empty"]')
    expect(empty).not.toBeNull()
    expect(empty.getAttribute('aria-label')).toBe(zh.wage.currentTitle)
    expect(empty.querySelector('.sf-wage-current-title')).toBeNull()
  })

  it('.sf-wage-top 改 stretch；右列与卡 height:100%（不再 auto、也不回落到网格卡的 180）', () => {
    const TOP = block('.sf-wage-top {', '.sf-wage-current {')
    expect(TOP).toContain('align-items: stretch;')
    expect(TOP).not.toContain('align-items: start;')
    // 右列自身吃 100%（列内不再有标题行，卡直接对齐列顶）
    expect(block('.sf-wage-current {', '.sf-wage-current.is-empty {')).toContain('height: 100%;')
    // 卡跟随左列（0,2,0 压过 .sf-wage-card 的固定高），且 auto 已退场
    expect(CURRENT_CARD).toContain('height: 100%;')
    expect(CURRENT_CARD).not.toContain('height: auto;')
    // 180px 常量与网格卡吃法一个字不动
    expect(PAGE_VARS).toContain('--sf-wage-card-h: 180px;')
    expect(CARD).toContain('height: var(--sf-wage-card-h);')
  })
})

// ---------------------------------------------------------------------------
// /wage 网格卡 · 操作区**按需渲染**（Kevin 2026-10-24）
//   三态：有 actions（在职可领 / 招募中可加入）⇒ 容器在场、desc 压 1 行；
//        无 actions（已截止 / 已在别处打工）⇒ 容器**整个不存在**、desc 回 2 行；
//        有 notice ⇒ desc 整块不渲染（提示优先，让位规则不回退）。
//   行数判据：把 wage.css 注入 jsdom，读 `getComputedStyle(desc).webkitLineClamp`（真级联，
//   含 `:has` 判定）+ `card.matches(':has(.sf-wage-card-actions)')` 双重取证；
//   真实像素行数（getBoundingClientRect / scrollHeight）由 ops/wage/front/probe-wage.mjs 取证。
// ---------------------------------------------------------------------------
const CSS_STYLE_ID = 'sf-wage-css-for-clamp'

describe('/wage 网格卡 · 操作区按需渲染', () => {
  const injectWageCss = () => {
    if (document.getElementById(CSS_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = CSS_STYLE_ID
    style.textContent = WAGE_CSS
    document.head.appendChild(style)
  }
  const descOf = (card) => card.querySelector('[data-sf-m="wage-card-desc"]')
  const clampOf = (card) => getComputedStyle(descOf(card)).webkitLineClamp

  beforeEach(injectWageCss)
  afterEach(() => {
    const style = document.getElementById(CSS_STYLE_ID)
    if (style) style.remove()
  })

  it('CSS 口径：desc 默认 2 行，有 actions 才压 1 行（clamp 与固定行高同步）；提示让位仍在；移动档不倒退', () => {
    const hasRule = block('.sf-wage-card:has(.sf-wage-card-actions) .sf-wage-card-desc {', '.sf-wage-pay {')
    expect(DESC).toContain('-webkit-line-clamp: 2;')
    expect(DESC).toContain('height: calc(2 * 1.4em);')
    expect(hasRule).toContain('-webkit-line-clamp: 1;')
    // 只 clamp 不改 height ⇒ 视觉少一行、空间仍占着；两者必须同步
    expect(hasRule).toContain('height: calc(1 * 1.4em);')
    // 提示行让位（display:none）与本案共存
    expect(WAGE_CSS).toContain('.sf-wage-card:has([data-sf-m="wage-card-notice"]) .sf-wage-card-desc {')
    const mobileDesc = MOBILE.slice(MOBILE.indexOf('.sf-wage-card-desc {'), MOBILE.indexOf('.sf-wage-modal {'))
    expect(mobileDesc).toContain('-webkit-line-clamp: 1;')
    expect(mobileDesc).toContain('height: calc(1 * 1.4em);')
  })

  it('有 actions（招募中可加入）：容器在场、取到 1 行（:has 命中）', async () => {
    installFetch([ROW_OPEN])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const card = container.querySelector('[data-sf-m="wage-card"]')
    expect(card.querySelector('.sf-wage-card-actions')).not.toBeNull()
    expect(card.querySelector('[data-sf-m="wage-card-action"]').getAttribute('data-sf-action')).toBe('join')
    expect(card.matches(':has(.sf-wage-card-actions)')).toBe(true)
    expect(clampOf(card)).toBe('1')
  })

  it('有 actions（在职可领）：容器在场、取到 1 行，领工资/在职钩子全保留', async () => {
    installFetch([ROW_HIRED])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const card = container.querySelector('[data-sf-m="wage-current"] [data-sf-m="wage-card"]')
    expect(card.querySelector('.sf-wage-card-actions')).not.toBeNull()
    expect(card.querySelector('[data-sf-m="wage-card-in-service"]')).not.toBeNull()
    expect(card.querySelector('[data-sf-m="wage-current-claim"]').getAttribute('data-sf-action')).toBe('claim')
    expect(card.matches(':has(.sf-wage-card-actions)')).toBe(true)
    expect(clampOf(card)).toBe('1')
  })

  it('无 actions（已截止且非在职）：整块不渲染（不是空壳）、取到 2 行', async () => {
    installFetch([ROW_CLOSED])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const card = container.querySelector('[data-sf-m="wage-card"]')
    expect(card.querySelector('.sf-wage-card-actions')).toBeNull()
    expect(card.querySelector('[data-sf-m="wage-card-action"]')).toBeNull()
    expect(card.matches(':has(.sf-wage-card-actions)')).toBe(false)
    expect(clampOf(card)).toBe('2')
    // 卡内子块：头 / 描述 / 名额工资（操作区整块缺席，不留空 div）
    expect(card.children.length).toBe(3)
    expect(descOf(card).textContent).toBe(ROW_CLOSED.description)
  })

  it('无 actions（已在别处打工的他项目卡）：无空壳、取到 2 行；当前项目卡仍有 actions 且 1 行', async () => {
    installFetch([ROW_HIRED, ROW_OPEN])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(2))
    const other = container.querySelector(`[data-sf-m="wage-card"][data-sf-project="${ROW_OPEN.project_id}"]`)
    expect(other).not.toBeNull()
    expect(other.querySelector('.sf-wage-card-actions')).toBeNull()
    expect(other.querySelector('[data-sf-m="wage-card-action"]')).toBeNull()
    expect(clampOf(other)).toBe('2')
    const cur = container.querySelector('[data-sf-m="wage-current"] [data-sf-m="wage-card"]')
    expect(cur.querySelector('.sf-wage-card-actions')).not.toBeNull()
    expect(clampOf(cur)).toBe('1')
  })

  it('有 notice：提示行优先，描述整块不渲染（:has 让位不因本条回退）', async () => {
    AUTH.isAuthenticated = false
    installFetch([ROW_OPEN])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const card = container.querySelector('[data-sf-m="wage-card"]')
    fireEvent.click(card.querySelector('[data-sf-action="join"]'))
    await waitFor(() => expect(card.querySelector('[data-sf-m="wage-card-notice"]')).not.toBeNull())
    // 描述节点仍在 DOM（文本不丢），但级联后 display:none ⇒ 视觉不占位
    expect(descOf(card)).not.toBeNull()
    expect(getComputedStyle(descOf(card)).display).toBe('none')
  })
})

describe('/wage 网格卡 · 信息块一个不少', () => {
  it('头像 / 标题 / 状态 / 描述 / 名额+进度条 / 工资行 / 操作钮 全在，描述 DOM 文本仍全量', async () => {
    installFetch([ROW_OPEN])
    const { container } = mount()
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card"]')).toHaveLength(1))
    const card = container.querySelector('[data-sf-m="wage-card"][data-sf-project="21"]')
    for (const hook of [
      'wage-card-avatar',
      'wage-card-title',
      'wage-card-status',
      'wage-card-desc',
      'wage-card-headcount',
      'wage-card-headcount-bar',
      'wage-card-wage',
    ]) {
      expect(card.querySelector(`[data-sf-m="${hook}"]`)).not.toBeNull()
    }
    // 招募中 + 未在职 ⇒ 操作区有【加入】
    expect(card.querySelector('[data-sf-m="wage-card-action"]')).not.toBeNull()
    // 描述截断是纯视觉：DOM 文本不得被 JS 截短 / 追加省略号
    const desc = card.querySelector('[data-sf-m="wage-card-desc"]')
    expect(desc.textContent).toBe(ROW_OPEN.description)
    expect(desc.textContent).not.toContain('…')
  })
})
