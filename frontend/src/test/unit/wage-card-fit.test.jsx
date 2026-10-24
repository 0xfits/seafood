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

describe('/wage 右上当前项目卡 · 仍自适应', () => {
  it('.sf-wage-current-card 仍 height:auto，且权重压过 .sf-wage-card 的固定高', () => {
    expect(CURRENT_CARD).toContain('height: auto;')
    // 权重：(0,2,0) > (0,1,0) ⇒ 不靠书写顺序取胜
    expect(WAGE_CSS).toContain('.sf-wage-current .sf-wage-current-card {')
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
