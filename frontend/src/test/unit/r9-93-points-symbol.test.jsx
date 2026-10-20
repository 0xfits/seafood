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

  // ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
  it('键计数 = top 128 / flat 1070（v1.5 §14.10 +20 叶/语 ⇒ 1050⇒1070；S23 +1 jobs.participantsHeadcount；件一值-only 不变；件二 +2 jobs 键 ⇒ 1039⇒1041；S5① +3 jobs 键 ⇒ 1044；S7 +10 jobs 键 ⇒ 1054；S8 +1 jobs 键 ⇒ 1055；S9 +4 ledger.kind 键 ⇒ 1059；S25 B7 退役 10 键 ⇒ 1050）', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
      v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]
    ))
    for (const lang of LANGS) {
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
      expect(Object.keys(TABLES[lang]).length, `${lang} top`).toBe(131) // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64]
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(flat(TABLES[lang]).length, `${lang} flat`).toBe(1137) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64]
    }
  })

  it('DashJ.jsx 保留：default 导出在场，头注释已更新（无产品引用 / 用途变更 → 上市的积分）', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/ui/DashJ.jsx'), 'utf8')
    expect(src).toContain('export default DashJ')
    expect(src).toContain('无产品引用')
    expect(src).toContain('上市的积分')
  })
})
