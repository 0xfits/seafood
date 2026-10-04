/**
 * R-9-93 单测（本单新增）· 平台积分单位 `dashJ` → `$`（与后端 `currency.cid=1.symbol` 同源）
 *
 * 断言 ①–④（逐条对应本单要求）：
 *   ① 源面：4 个产品文件共 **6 处产品使用点**（父单列出的 6 个行号）均已由 `<DashJ … />` 改为 `$`
 *      （`>$<` 计数对齐），且 4 文件不再出现 `DashJ`。
 *      另 2 处 DashJ 引用 = 组件自身 `DashJ.jsx` + `ui/index.js` barrel 导出 ⇒ 按要求**保留**（合计 8 处引用）。
 *   ② 产品面零引用：`components/**` + `pages/**` + `shell/**` 内除 `DashJ.jsx` 与 `ui/index.js` 外无 `DashJ`。
 *   ③ 渲染面：TaskCard / RewardCard / HomePage / Header 渲染含 `$`，且**不再含**旧 DashJ 符号
 *      （旧符号 title = `uiCommon.dashJPoints`）。
 *   ④ 文案键 `common.communityPoints` 四语值齐改；键计数（件一值-only 不变 / 件二 +2 jobs 键 ⇒ flat 1041；S5① +3 jobs 键 ⇒ 1044）。
 *
 * 口径：i18n 走真四语表（zh）逐字断言；`auth` / `auth-context` / `admin-utils` / `job-api` 按既有单测口径 mock。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, fireEvent, act, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

/** 产品使用点（父单逐字）：4 文件 / 6 处 `<DashJ … />` → `$` */
const USAGE_FILES = {
  'components/Header.jsx': 1,
  'components/task/TaskCard.jsx': 1,
  'components/reward/RewardCard.jsx': 1,
  'pages/HomePage.jsx': 3,
}
const ALLOWED_DASHJ = new Set(['components/ui/DashJ.jsx', 'components/ui/index.js']) // 组件自身 + barrel 导出

const TABLES = { zh, en, hk, vn }
const OLD_DASHJ_TITLE = 'dashJ 社区积分' // zh.uiCommon.dashJPoints —— 旧 DashJ 符号的 title

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

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ can_access_admin: false, preferred_admin_path: '/dashboard' })),
}))
vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async () => []),
  getAuthHeaders: vi.fn(() => ({})),
  clearAuthSession: vi.fn(),
}))
vi.mock('../../pages/jobs/job-api', () => ({ applyToJob: vi.fn(), submitDeliverable: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

import Header from '../../components/Header'
import { TaskCard } from '../../components/task/TaskCard'
import { RewardCard } from '../../components/reward/RewardCard'
import HomePage from '../../pages/HomePage'

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p)
  }
  return out
}

const oldSymbolAbsent = (root) => {
  expect(root.querySelector(`[title="${OLD_DASHJ_TITLE}"]`), '旧 DashJ 符号不应渲染').toBeNull()
}

beforeEach(() => {
  H.lang = 'zh'
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('① 源面：6 处产品使用点由 `<DashJ … />` → `$`（且 4 文件不再出现 DashJ）', () => {
  it('逐文件 `>$<` 计数对齐，且不含 DashJ', () => {
    for (const [rel, n] of Object.entries(USAGE_FILES)) {
      const src = fs.readFileSync(path.join(SRC, rel), 'utf8')
      expect(src, `${rel} 不得再引用 DashJ`).not.toContain('DashJ')
      const dollars = src.match(/>\$<\/span>/g) || []
      expect(dollars.length, `${rel} 应有 ${n} 处 $ 符号`).toBe(n)
    }
  })
})

describe('② 产品面 DashJ 零引用（仅组件自身 + barrel 导出保留）', () => {
  it('components/** + pages/** + shell/** 除允许集外无 DashJ', () => {
    const files = ['components', 'pages', 'shell']
      .flatMap((d) => (fs.existsSync(path.join(SRC, d)) ? walk(path.join(SRC, d)) : []))
    const hits = files
      .map((f) => path.relative(SRC, f))
      .filter((rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').includes('DashJ'))
    const productHits = hits.filter((rel) => !ALLOWED_DASHJ.has(rel))
    expect(productHits, `产品面不应引用 DashJ：${productHits.join(', ')}`).toEqual([])
    // 允许集仍在场（组件 + barrel 导出保留）
    expect(hits).toContain('components/ui/DashJ.jsx')
    expect(hits).toContain('components/ui/index.js')
  })
})

describe('③ 渲染面：含 `$` 且不再含旧 DashJ 符号', () => {
  it('Header：用户菜单积分块含 `$`，无旧符号', () => {
    vi.useFakeTimers()
    const { container } = render(<MemoryRouter initialEntries={['/']}><Header /></MemoryRouter>)
    const trigger = document.querySelector('[data-sf-m="header-user-menu"]')
    expect(trigger).not.toBeNull()
    act(() => { fireEvent.mouseEnter(trigger.parentElement) })
    act(() => { vi.advanceTimersByTime(200) })
    const menu = trigger.parentElement.querySelector('div.absolute')
    expect(menu).not.toBeNull()
    expect(menu.textContent).toContain(zh.common.communityPoints)
    expect(menu.textContent).toContain('$')
    oldSymbolAbsent(menu)
    oldSymbolAbsent(container)
    vi.useRealTimers()
  })

  it('TaskCard：积分块含 `$`，无旧符号', () => {
    const { container } = render(
      <MemoryRouter>
        <TaskCard task={{ tID: 1, title: 'T', points: 88, status: 'active', statusText: 'ongoing' }} />
      </MemoryRouter>,
    )
    expect(container.textContent).toContain('$')
    oldSymbolAbsent(container)
  })

  it('RewardCard：所需积分块含 `$`，无旧符号', () => {
    const { container } = render(
      <MemoryRouter>
        <RewardCard reward={{ bID: 1, title: 'R', points_required: 66 }} />
      </MemoryRouter>,
    )
    expect(container.textContent).toContain('$')
    oldSymbolAbsent(container)
  })

  it('HomePage：hero/热任务/精选三处均含 `$`，无旧符号', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>)
    await screen.findByRole('heading', { name: zh.homePage.welcome })
    expect(container.textContent).toContain(zh.homePage.heroLead)
    expect(container.textContent).toContain(zh.homePage.hotTasksLead)
    expect(container.textContent).toContain(zh.homePage.featuredLead)
    expect(container.textContent).toContain('$')
    oldSymbolAbsent(container)
  })
})

describe('④ 文案键 `common.communityPoints` 四语新值 + 键计数', () => {
  it('四语值齐改（en/vn 无 CJK）', () => {
    expect(zh.common.communityPoints).toBe('积分')
    expect(hk.common.communityPoints).toBe('積分')
    expect(en.common.communityPoints).toBe('Points')
    expect(vn.common.communityPoints).toBe('Điểm')
    expect(CJK.test(en.common.communityPoints)).toBe(false)
    expect(CJK.test(vn.common.communityPoints)).toBe(false)
  })

  it('键计数 = top 119 / flat 1059（件一值-only 不变；件二 +2 jobs 键 ⇒ 1039⇒1041；S5① +3 jobs 键 ⇒ 1044；S7 +10 jobs 键 ⇒ 1054；S8 +1 jobs 键 ⇒ 1055；S9 +4 ledger.kind 键 ⇒ 1059）', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
      v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]
    ))
    for (const lang of LANGS) {
      expect(Object.keys(TABLES[lang]).length, `${lang} top`).toBe(119)
      // **期望订正（S9 ledger.kind 缺键补齐）**：S8 ⇒ 1055；S9 +4 ledger.kind 键/语 ⇒ 拍平 1055⇒1059（前订正 S7：1044⇒1054）
      expect(flat(TABLES[lang]).length, `${lang} flat`).toBe(1059)
    }
  })

  it('DashJ.jsx 保留：default 导出在场，头注释已更新（无产品引用 / 用途变更 → 上市的积分）', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/ui/DashJ.jsx'), 'utf8')
    expect(src).toContain('export default DashJ')
    expect(src).toContain('无产品引用')
    expect(src).toContain('上市的积分')
  })
})
