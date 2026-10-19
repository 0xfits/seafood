/**
 * P6-I18N-LIT-B5 · 组件库 + 开发预览页收尾批（B5：88 条）+ 三项收口验收
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 走**真实** i18n 实例（`import '../../i18n'`）+ `i18n.changeLanguage('en')`，**不 mock** `react-i18next`；
 *   ② 数据面只 mock `../../admin-utils`（权限 / 取数口）；组件树其余全真；
 *   ③ 反证 = 简体原文在 en 档渲染期不得出现（逐条 `queryByText` 断言）；
 *   ④ **必做① 可判负**：`SystemSettings` 的待保存值（`defaults.siteDescription`）在 zh 档与 en 档
 *      必须**相同且为空串**。本用例让 mock 的 `/api/admin/settings` **不含** `siteDescription`，
 *      ⇒ 取值只能来自 `defaults`：旧实现 `siteDescription: t('adminSettings.siteDescription')`
 *      会让 zh 档 = 「去中心化社区奖励平台」、en 档 = 英译文（两档不同）⇒ 该用例必然判负；
 *   ⑤ **必做②**（D7 最后一项）：`pages/HomePage.jsx` 旧三目链收口到 `pickLocalized`，
 *      `p6-tr2-i18n-locales.mjs` 的 LEGACY 名单清零（脚本退出码即断言）；
 *   ⑥ AC④ = 直接 exec 本批类级断言脚本（脚本内禁 `pkill`/服务/网络）。
 *   ★ 已知测试替身约束：jsdom **无 `IntersectionObserver`** ⇒ `LazyImage` / `InfiniteScroll`
 *     不渲染断言，改走「locale 取值 + 源码面」断言（同 B4b 对 `Tabs` 的处理）。
 */
import React from 'react'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, permissions: [], can_access_admin: true })),
  fetchApiJson: vi.fn(async (url) => {
    const u = String(url)
    // ★ 必做① 可判负：**故意不返回 `siteDescription`** ⇒ `{ ...defaults, ...data }` 的取值
    //   完全来自 `defaults`（旧实现会落「当前界面语言文案」⇒ zh/en 两档不同）
    if (u.includes('/api/admin/settings')) return { maintenance: false }
    return {}
  }),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer b5' })),
  getStoredUser: vi.fn(() => ({ uID: 1, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: vi.fn(() => true),
}))

import { SearchBox, DatePicker, FilterPanel, Pagination } from '../../components/ui/Advanced'
import DashJ from '../../components/ui/DashJ'
import { DataTable, Progress } from '../../components/ui/DataDisplay'
import { ErrorFallback, NotFoundPage } from '../../components/ui/ErrorHandling'
import { LoadingPage } from '../../components/ui/Loading'
import { ThrottledButton } from '../../components/ui/Performance'
import ThemePreviewPage from '../../pages/ThemePreviewPage'
import SystemSettings from '../../pages/admin/SystemSettings'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT = path.resolve(SRC, '..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const readTable = (lang) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
const wrap = (node, entry = '/') => render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>)

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('zh')
})

describe('P6-I18N-LIT-B5 · en 档渲染英文（组件库 + 开发预览页）', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('Advanced（en 档）：搜索/日期占位、筛选面板、分页 全走英文（`prev`/`next` 为既有键）', () => {
    wrap(
      <>
        <SearchBox value="" onChange={() => {}} />
        <DatePicker onChange={() => {}} />
        <FilterPanel filters={[]} activeFilters={{}} onFilterChange={() => {}} onClearAll={() => {}} />
        <Pagination currentPage={2} totalPages={5} onPageChange={() => {}} />
      </>,
    )

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    expect(screen.getByText('Select date')).toBeInTheDocument()
    expect(screen.getByText('Filter')).toBeInTheDocument()
    // 折叠态不渲染两个动作按钮 ⇒ 先展开
    fireEvent.click(screen.getByText('Filter'))
    expect(screen.getByText('Clear filters')).toBeInTheDocument()
    expect(screen.getByText('Apply filters')).toBeInTheDocument()
    // (a) 已有键未用一档：`prev` / `next`
    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
    // 反证：简体原文不出现
    expect(screen.queryByText('筛选')).toBeNull()
    expect(screen.queryByText('清除筛选')).toBeNull()
    expect(screen.queryByText('上一页')).toBeNull()
    expect(screen.queryByText('下一页')).toBeNull()
    expect(screen.queryByText('搜索...')).toBeNull()
  })

  it('DataDisplay（en 档）：空态走既有键 `noData`；进度标签走新键 `uiCommon.progress`', () => {
    wrap(<><DataTable data={[]} columns={[]} /><Progress value={40} /></>)

    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.queryByText('暂无数据')).toBeNull()
    expect(screen.queryByText('进度')).toBeNull()
  })

  it('DashJ（en 档）：title 走 `uiCommon.dashJPoints` 键（R-9-96 后 en = Points）', () => {
    wrap(<DashJ />)

    expect(screen.getByTitle('Points')).toBeInTheDocument()
    expect(screen.queryByTitle('积分')).toBeNull()
  })

  it('ErrorHandling（en 档）：错误回退页与 404 页全走英文', () => {
    wrap(<><ErrorFallback error={new Error('boom')} /><NotFoundPage onGoHome={() => {}} /></>)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/The app ran into an unexpected error\./)).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    expect(screen.getAllByText('Back to home')).toHaveLength(2)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(screen.queryByText('出现了一些问题')).toBeNull()
    expect(screen.queryByText('页面未找到')).toBeNull()
    expect(screen.queryByText('重试')).toBeNull()
  })

  it('Loading（en 档）：默认文案改走既有键 `loading`（不再硬编码）', () => {
    wrap(<LoadingPage />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('加载中...')).toBeNull()
  })

  it('Performance（en 档）：节流提示走英文；无限滚动/懒加载改走源码面断言', () => {
    wrap(<ThrottledButton onClick={() => {}}>go</ThrottledButton>)
    fireEvent.click(screen.getByText('go'))

    expect(screen.getByText('Please wait...')).toBeInTheDocument()

    // ④ 源码面（jsdom 无 IntersectionObserver ⇒ 不渲染断言，同 B4b 对 `Tabs` 的处理）
    const src = fs.readFileSync(path.join(SRC, 'components/ui/Performance.jsx'), 'utf8')
    for (const key of ['uiCommon.noMoreData', 'uiCommon.loadFailed', 'uiCommon.pleaseWait',
      'uiCommon.renderTime', 'uiCommon.memoryUsage', "t('loading')"]) {
      expect(src, `Performance.jsx 缺 ${key}`).toContain(key)
    }
  })

  it('ThemePreviewPage（en 档）：语言 chip 走 locale；正文 = 演示数据（language 不变式）', () => {
    wrap(<ThemePreviewPage />, '/en/theme-preview')

    // 真实 UI 面：语言 chip 走既有 locale 键
    expect(screen.getByText('English')).toBeInTheDocument()
    // 演示数据面：值不变（四语下逐字相同）——见下一条用例
    expect(screen.getByText('日档 · 码头大牌')).toBeInTheDocument()
    expect(screen.getByText('同值?')).toBeInTheDocument()
  })

  it('ThemePreviewPage：演示数据为 language 不变式（en 档与 zh 档逐字相同）', async () => {
    const demoChips = () => {
      cleanup()
      const { container } = wrap(<ThemePreviewPage />, '/theme-preview')
      return Array.from(container.querySelectorAll('.sf-preview-chips .sf-chip')).map((el) => el.textContent)
    }

    await i18n.changeLanguage('en')
    const en = demoChips()
    await i18n.changeLanguage('zh')
    const zh = demoChips()

    expect(en).toEqual(zh)
    expect(en).toEqual(['招工', '商品', '积分交易所', '终身返佣', '全部'])
  })
})

describe('P6-I18N-LIT-B5 · 必做① `SystemSettings` 待保存值与界面语言无关（可判负）', () => {
  const siteDescriptionOf = async (lang) => {
    await i18n.changeLanguage(lang)
    cleanup()
    wrap(<SystemSettings />)
    const box = await screen.findByRole('textbox')
    return box.value
  }

  it('zh 档与 en 档的 `defaults.siteDescription`（待保存值）必须相同且为空串', async () => {
    const zh = await siteDescriptionOf('zh')
    const en = await siteDescriptionOf('en')

    expect(en).toBe(zh)
    expect(zh).toBe('')
  })

  it('`t(...)` 只能当 placeholder：源码里不得再出现 `siteDescription: t(`', () => {
    const src = fs.readFileSync(path.join(SRC, 'pages/admin/SystemSettings.jsx'), 'utf8')

    expect(src).not.toContain('siteDescription: t(')
    expect(src).toContain('const defaults = { ...DEFAULT_SETTINGS }')
    expect(src).toContain("placeholder={t('adminSettings.siteDescription')}")
  })
})

describe('P6-I18N-LIT-B5 · 必做② `HomePage` 收口 + LEGACY 清零 + AC③④ 脚本读数', () => {
  it('HomePage 源码：无 `_en ?? base` 三目链，改经 `pickLocalized`（`i18n-content`，`||` 语义）', () => {
    const src = fs.readFileSync(path.join(SRC, 'pages/HomePage.jsx'), 'utf8')

    expect(src.match(/_(en|hk|vn)\s*\?\?/g)).toBeNull()
    expect(src).toContain("from '../i18n-content'")
    expect(src).toContain("pickLocalized(task, 'title', lang)")
    expect(src).toContain("pickLocalized(task, 'note', lang)")
    expect(src).toContain("pickLocalized(prize, 'name', lang)")
    expect(src).toContain("pickLocalized(prize, 'description', lang)")
  })

  it('AC③ 四语键集 + LEGACY = 0 页（scripts/p6-tr2-i18n-locales.mjs）退出码 = 0', () => {
    const out = execFileSync(process.execPath, ['scripts/p6-tr2-i18n-locales.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })

    expect(out).toContain('[TR-2] 键集相等：PASS')
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    // S25 计数期望订正（台账 B7 死键退役）：四语对称删 10 键 ⇒ 拍平 1060⇒1050（本读数为脚本 p6-tr2 动态打印，非硬编）。
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
    expect(out).toContain('zh: top=129 flat=1115') // **期望订正（S9）** 1059；**S25 再订正** 1059⇒1050（B7 退役 10 键）；**sf14 前推（2026-10-14 单）**：top 125⇒128 / flat 1078⇒1095；**sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变）
    expect(out).toContain('存量登记（只核不改）：仍在旧三目链 + `??` 上的页面数 = 0 页')
    expect(out).toContain('[TR-2] 总判：PASS')

    const script = fs.readFileSync(path.join(ROOT, 'scripts/p6-tr2-i18n-locales.mjs'), 'utf8')
    expect(script).toContain('const LEGACY = []')
  })

  it('AC④ 类级断言（scripts/p4z-i18nb5-cjk.mjs）退出码 = 0：写集 CJK 0 / 工程口径 0', () => {
    const out = execFileSync(process.execPath, ['scripts/p4z-i18nb5-cjk.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })

    expect(out).toContain('[B5-CJK] 总判：PASS')
    expect(out).toContain('CJK 字面量命中 = 0')
    expect(out).toContain('工程口径(用户可见文案面)命中 = 0')
    expect(out).toContain('locale CJK(en,vn)=0')
  })
})

describe('P6-I18N-LIT-B5 · 四语 locale 键集（本批新增 uiCommon 12 / uiError 23）', () => {
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()
  const NEW_NS = { uiCommon: 12, uiError: 23 }

    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
  // ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
  it('四文件拍平键集逐文件相等（v1.5 Δ+20 ⇒ top=128 / flat=1070）；新键四语齐备、非空、en/vn 零 CJK', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = readTable(lang)
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    console.info('[B5] locale 键数读数', JSON.stringify(counts))

    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    // S25 计数期望订正（台账 B7 死键退役）：四语对称删 10 键 ⇒ 拍平 1060⇒1050（等量下移 = −10/语）。
    expect(counts.zh).toEqual({ top: 129, flat: 1115 }) // **期望订正（S9）** 1059；**S25 再订正** 1059⇒1050（B7 退役 10 键）；**sf14 前推（2026-10-14 单）**：top 125⇒128 / flat 1078⇒1095；**sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436 // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变）

    const CJK = /[\u4E00-\u9FFF]/
    for (const [ns, size] of Object.entries(NEW_NS)) {
      for (const lang of LANGS) {
        expect(Object.keys(tables[lang][ns]).length, `${lang}.${ns}`).toBe(size)
        for (const [k, v] of Object.entries(tables[lang][ns])) {
          expect(typeof v, `${lang}.${ns}.${k}`).toBe('string')
          expect(v.trim().length, `${lang}.${ns}.${k}`).toBeGreaterThan(0)
          if (lang === 'en' || lang === 'vn') expect(CJK.test(v), `${lang}.${ns}.${k} = ${v}`).toBe(false)
        }
      }
    }
    // hk 必须是繁体（不得照抄简体原文）
    expect(tables.hk.uiCommon.clearFilters).toBe('清除篩選')
    expect(tables.hk.uiError.problemTitle).toBe('出現咗啲問題')
    // 四语互异（真翻译，不是照抄同一串）
    for (const [ns, k] of [['uiCommon', 'filter'], ['uiError', 'notFoundTitle']]) {
      expect(new Set(LANGS.map((l) => tables[l][ns][k])).size, `${ns}.${k}`).toBe(4)
    }
  })
})
