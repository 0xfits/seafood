/**
 * P6-I18N-LIT-B2 · 主线三页（任务 / 首页·闲置物品列表 / 我的）文案四语化 + 「翻译中」小标接线 + 内容本地化收口
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 走**真实** i18n 实例（`import '../../i18n'`）+ `i18n.changeLanguage`，**不 mock** `react-i18next`；
 *   ② 语言码另有来源：页面用 `getLanguageFromUrl(location.pathname)` ⇒ 路由须给语言前缀
 *      （`/en/task` 等），与 `changeLanguage` 两条都到位才是真「en 档」；
 *   ③ 数据面只 mock `../../auth` / `../../auth-context`（`TaskPage` 用全局 `fetch`，另 mock `global.fetch`）。
 *
 * ★ 2026-10-11 合并单：原「奖励页」`RewardPage` 已删（与列表页合并入首页）。原 `RewardPage（/en/reward）`
 *   一例**改为**`HomePage（/en）`一例（面板：发布入口 / 我的积分 / 分类筛选 / 卡片），例数不减。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import { pickLocalized } from '../../i18n-content'
import { TaskCard } from '../../components/task/TaskCard'
import { RewardCard } from '../../components/reward/RewardCard'

const state = vi.hoisted(() => ({ prizes: [], profile: null, taskRows: [] }))

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async (url) => {
    const u = String(url)
    // 首页先打聚合口 `/api/home`；本替身令其抛错 ⇒ 首页回落逐口读（与旧 ListingsPage 同一份 feed）
    if (u.includes('/api/home')) throw new Error('HOME_UNREGISTERED')
    if (u.includes('/api/prize/all')) return state.prizes
    if (u.includes('/api/user/asset/')) return { points: 300 }
    return []
  }),
  getAuthHeaders: vi.fn(() => ({})),
  fetchCurrentUser: vi.fn(async () => state.profile),
  updateMyProfile: vi.fn(async () => state.profile),
  clearAuthSession: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { uID: 1 },
    sessionUser: { uID: 1 },
    updateSession: (u) => u,
  }),
}))

import TaskPage from '../../pages/TaskPage'
import HomePage from '../../pages/HomePage'
import ProfilePage from '../../pages/ProfilePage'

const BADGE_SEL = '[data-sf-m="i18n-translating"]'
const badgeEl = () => document.querySelector(BADGE_SEL)

describe('P6-I18N-LIT-B2 · en 档渲染英文文案（Task / Home / Profile）', () => {
  beforeEach(async () => {
    state.taskRows = [{
      tID: 1, title: '任务原文', title_en: 'English task title',
      note: '中文备注', note_en: 'English note', is_open: true, i18n_status: 'pending',
    }]
    state.prizes = [{
      bID: 1, name: '奖励原文', name_en: 'English reward',
      description: '中文描述', description_en: 'English description',
      points: 100, stores_count: 5, claims_count: 0, i18n_status: 'pending',
    }]
    state.profile = {
      uID: 1, EVM: null, bio: '中文简介', bio_en: 'English bio',
      is_admin: false, time_reg: null, i18n_status: 'pending',
    }
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ success: true, data: state.taskRows }),
    }))
    localStorage.clear()
    await i18n.changeLanguage('en')
  })
  afterEach(() => { cleanup() })

  it('TaskPage（/en/task）：标题 / 副标题（悬赏口径） / 统计 / 分页 Tab / 卡片走英文，中文原文不出现', async () => {
    render(<MemoryRouter initialEntries={['/en/task']}><TaskPage /></MemoryRouter>)

    expect(await screen.findByText('Bounty Center')).toBeInTheDocument()
    expect(screen.getByText('Join bounties, earn points, unlock rewards')).toBeInTheDocument()
    expect(screen.getByText('Available (1)')).toBeInTheDocument()
    expect(screen.getByText('To claim (0)')).toBeInTheDocument()
    expect(screen.getByText('Pending Verification (0)')).toBeInTheDocument()
    // 卡片：`title_en` / `note_en` 经 `pickLocalized` 取值（旧三目链已删）
    expect(screen.getByText('English task title')).toBeInTheDocument()
    expect(screen.getByText('English note')).toBeInTheDocument()
    expect(screen.getByText('Join now')).toBeInTheDocument()
    // 「翻译中」小标：en 档 + `i18n_status:"pending"` ⇒ 渲染
    expect(badgeEl()).not.toBeNull()
    expect(screen.queryByText('悬赏中心')).toBeNull()
    expect(screen.queryByText('任务原文')).toBeNull()
  })

  it('HomePage（/en，= 唯一「闲置物品」列表）：发布入口 / 分类筛选 / 卡片走英文（「我的积分」已迁出 ⇒ 零命中）', async () => {
    render(<MemoryRouter initialEntries={['/en']}><HomePage /></MemoryRouter>)

    // 发布入口（原「查看奖励」→ `/item/new`；文案 = 闲置物品语义）
    expect(await screen.findByText('Publish item')).toBeInTheDocument()
    // ★ 2026-10-21 改锚（合法移除 ×1）：「我的积分」卡内容整体迁至 `/profile/assets`
    //   （钩子 `assets-my-points`，见 sf14-profile-views 的资产页断言）⇒ 首页必须**零命中**。
    expect(screen.queryByText('My points')).toBeNull()
    // 分类筛选（并入自 RewardPage；计数随数据面派生）
    expect(screen.getByText('All (1)')).toBeInTheDocument()
    expect(screen.getByText('Limited edition (0)')).toBeInTheDocument()
    expect(screen.getByText('High value (0)')).toBeInTheDocument()
    expect(screen.getByText('Redeemed (0)')).toBeInTheDocument()
    // ★ 2026-10-19 改锚（合法移除 ×2）：品牌行（上一版移除）与**描述行**（本版四行结构无槽位）都不再渲染，
    //   卡面英文文案只剩标题一处（卖家栏昵称 = 后端掩码派生，与本断言无关）。
    expect(screen.getAllByText('English reward').length).toBe(1)
    expect(screen.queryByText('English description')).toBeNull()
    expect(badgeEl()).not.toBeNull()
    expect(screen.queryByText('奖励原文')).toBeNull()
  })

  it('ProfilePage（/en/profile/settings · 2026-10-14 起账户内容归位 settings 视图）：标题 / 分区 / 成就走英文，bio 走 `bio_en`', async () => {
    render(<MemoryRouter initialEntries={['/en/profile/settings']}><ProfilePage /></MemoryRouter>)

    expect(await screen.findByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Manage your account and view achievements')).toBeInTheDocument()
    expect(screen.getByText('Basic info')).toBeInTheDocument()
    expect(screen.getByText('English bio')).toBeInTheDocument()
    // 2026-10-20：侧栏新增「我的资产」项（profileNav.assets）与 settings 的资产分区同名 ⇒ 改为「至少一处」
    //   （同名是刻意的产品口径：菜单项与分区标题都叫 My assets）。
    expect(screen.getAllByText('My assets').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Redeemed rewards')).toBeInTheDocument()
    expect(screen.getByText('Task achievements')).toBeInTheDocument()
    expect(screen.getByText('Total tasks')).toBeInTheDocument()
    expect(screen.getByText('Achievement badges')).toBeInTheDocument()
    expect(screen.getByText('Shard holdings')).toBeInTheDocument()
    expect(screen.getByText('No holdings')).toBeInTheDocument()
    expect(badgeEl()).not.toBeNull()
    expect(screen.queryByText('个人中心')).toBeNull()
    expect(screen.queryByText('中文简介')).toBeNull()
  })
})

describe('P6-I18N-LIT-B2 · 「翻译中」小标接线（TaskCard / RewardCard）', () => {
  afterEach(() => { cleanup() })

  it('en 档：`pending` / `partial` ⇒ 渲染；`ready` / 缺省 ⇒ 不渲染', async () => {
    await i18n.changeLanguage('en')
    const task = { title: 'T', status: 'active', statusText: 'S', i18n_status: 'pending' }

    render(<TaskCard task={task} onAction={() => {}} />)
    expect(badgeEl()).not.toBeNull()
    cleanup()

    render(<TaskCard task={{ ...task, i18n_status: 'ready' }} onAction={() => {}} />)
    expect(badgeEl()).toBeNull()
    cleanup()

    render(<RewardCard reward={{ title: 'R', status: 'available', statusText: 'S', points_required: 1, i18n_status: 'partial' }} />)
    expect(badgeEl()).not.toBeNull()
    cleanup()

    render(<RewardCard reward={{ title: 'R', status: 'available', statusText: 'S', points_required: 1 }} />)
    expect(badgeEl()).toBeNull()
  })

  it('zh 档（源语言）⇒ 不渲染小标（即便 `i18n_status:"pending"`）', async () => {
    await i18n.changeLanguage('zh')
    const task = { title: 'T', status: 'active', statusText: 'S', i18n_status: 'pending' }

    render(<TaskCard task={task} onAction={() => {}} />)
    expect(badgeEl()).toBeNull()
    cleanup()

    render(<RewardCard reward={{ title: 'R', status: 'available', statusText: 'S', points_required: 1, i18n_status: 'pending' }} />)
    expect(badgeEl()).toBeNull()
  })
})

describe('P6-I18N-LIT-B2 · 内容本地化收口（`pickLocalized`，`||` 语义）', () => {
  it('空串 ⇒ 回落原文（`??` 会穿透成空串 ⇒ 卡片空白）；缺字段 ⇒ 回落原文；zh 档 ⇒ 无后缀字段', () => {
    const row = { title: '中文', title_en: '', title_vn: 'Tiếng Việt' }

    expect(pickLocalized(row, 'title', 'en')).toBe('中文')
    expect(pickLocalized(row, 'title', 'hk')).toBe('中文')
    expect(pickLocalized(row, 'title', 'vn')).toBe('Tiếng Việt')
    expect(pickLocalized(row, 'title', 'zh')).toBe('中文')
    expect(pickLocalized(null, 'title', 'en')).toBeUndefined()
    expect(row.title_en ?? row.title).toBe('')
  })
})

describe('P6-I18N-LIT-B2 · 四语 locale 键集（本批存活键齐备 + 逐文件相等）', () => {
  const LANGS = ['zh', 'en', 'hk', 'vn']
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()
  // ★ 2026-10-11 合并单订正：原 23 个 `rewardPage.*` 键随 `RewardPage.jsx` 删除；
  //   合并页真用的 6 键改入 `item.*`（`item.myPoints` / 四档筛选 / 卡片动作）。
  const NEW_KEYS = [
    'common.loadingTasks',
    'common.loadingUser',
    'common.save',
    'common.edit',
    'common.unknown',
    'common.notSet',
    'common.admin',
    'common.points',
    'common.available',
    'common.pending',
    'common.completed',
    'common.underReview',
    'common.claimed',
    'common.claimable',
    'common.claimReward',
    'common.notEnoughPoints',
    'common.goTrade',
    'common.unavailable',
    'common.participantsUnit',
    'common.claimedUnit',
    'common.shardUnit',
    'taskPage.requestFailed',
    'taskPage.title',
    'taskPage.subtitle',
    'taskPage.continueTask',
    'taskPage.emptyAvailable',
    'taskPage.emptyAvailableHint',
    'taskPage.emptyPending',
    'taskPage.emptyPendingHint',
    'taskPage.emptyCompleted',
    'taskPage.emptyCompletedHint',
    'taskPage.emptyVerification',
    'taskPage.emptyVerificationHint',
    'item.myPoints',
    'item.filterAll',
    'item.filterLimited',
    'item.filterHighValue',
    'item.filterClaimed',
    'item.viewDetail',
    'profilePage.title',
    'profilePage.subtitle',
    'profilePage.loadFailed',
    'profilePage.bioTooShort',
    'profilePage.bioSaved',
    'profilePage.saveFailed',
    'profilePage.goLogin',
    'profilePage.basicInfo',
    'profilePage.unknownUser',
    'profilePage.walletAddress',
    'profilePage.registeredAt',
    'profilePage.bio',
    'profilePage.bioPlaceholder',
    'profilePage.bioEmpty',
    'profilePage.myAssets',
    'profilePage.redeemedRewards',
    'profilePage.lastUpdate',
    'profilePage.taskAchievements',
    'profilePage.totalTasks',
    'profilePage.totalPoints',
    'profilePage.achievements',
    'profilePage.badgeNovice',
    'profilePage.badgeExpert',
    'profilePage.badgeMaster',
    'profilePage.badgePointsPro',
    'profilePage.shardHoldings',
    'profilePage.noHoldings',
    'taskCard.weeks',
    'taskCard.days',
    'taskCard.endingSoon',
    'rewardCard.limited',
    'rewardCard.timeLimited',
    'rewardCard.insufficient',
    'rewardCard.claimNow',
    'claimRewardModal.lore',
    'activeTaskModal.noCredential',
    'activeTaskModal.badCredential',
    'activeTaskModal.submitFailed',
  ]

  // ★ F13 清理（Kong 2026-10-12）：本批存活键由 79 ⇒ 77 —— 删 2 个死键
  //   （`common.loadingRewards` / `claimRewardModal.loadProgressFailed`；均无非测试消费点）。
  it('存活 77 键四语齐备、非空串；四文件拍平键集逐文件相等', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    console.info('[B2] locale 键数读数', JSON.stringify(counts))
    console.info('[B2] 本批存活键数', NEW_KEYS.length)

    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    expect(counts.zh.top).toBe(counts.en.top)

    expect(NEW_KEYS.length).toBe(77) // F13：79⇒77（删 common.loadingRewards / claimRewardModal.loadProgressFailed）
    for (const key of NEW_KEYS) {
      expect(sets.zh).toContain(key)
      for (const lang of LANGS) {
        const value = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), tables[lang])
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
