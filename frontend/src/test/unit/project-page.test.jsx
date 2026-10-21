/**
 * 项目页 `/:slug`（Kevin 2026-10-21）· 步 1 骨架单测
 *
 * 覆盖面（步 1 = 项目头 / 详细介绍 / 操作区入口显隐；三入口表单与嵌套列表见步 2）：
 *   ① `projectHrefOf`：行有合法 slug ⇒ `/<slug>`；无 slug / 非字符串 / 非法 ⇒ null（历史行不変链接）；
 *   ② 保留段（`RESERVED_PROJECT_SEGMENTS` 二十一段）⇒ `<NotFoundPage />` 且**零读口请求**；
 *   ③ 读口 404（项目不存在）⇒ `<NotFoundPage />`；非 404 失败 ⇒ 错误面板 + 重试（不白屏）；
 *   ④ 操作区入口显隐三臂：owner / `manage_tasks` 管理员 / 普通用户（已结束项目对 owner 亦隐藏）；
 *   ⑤ slug 字段客户端校验（格式 / 保留字 / 空）—— `slugFieldErrorOf` 单一真源。
 *
 * 注：页面挂在 App.jsx 内层 `:slug`，语言前缀由 LangShell 承担；本文件直接用
 *     `<Route path=":slug">` 复现「内层相对段」语境（四语前缀由 lang-path 单测覆盖）。
 */
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const API = vi.hoisted(() => ({
  fetchProjectDetail: vi.fn(),
  fetchProjectCurrencies: vi.fn(),
  createProjectCampaign: vi.fn(),
  patchProjectCampaign: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  appendProjectSubtasks: vi.fn(),
}))
vi.mock('../../pages/project/project-api', () => ({
  fetchProjectDetail: API.fetchProjectDetail,
  fetchProjectCurrencies: API.fetchProjectCurrencies,
  createProjectCampaign: API.createProjectCampaign,
  patchProjectCampaign: API.patchProjectCampaign,
  createProjectCampaignTask: API.createProjectCampaignTask,
  appendProjectSubtasks: API.appendProjectSubtasks,
}))

// 管理员三键加载器替身（保留真实 `isWageProjectEditAdmin` 判定，只换取数面 ⇒ 三臂可独立摆位）。
const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import ProjectPage from '../../pages/project/ProjectPage'
import { RESERVED_PROJECT_SEGMENTS, projectHrefOf, slugFieldErrorOf } from '../../project-slug'

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

const rowOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: 7,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [],
  ...patch,
})

const notFound = (container) => container.querySelector('[data-sf-m="not-found-page"]')

describe('项目页 `/:slug` · 步 1 骨架', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH.isAuthenticated = true
    AUTH.user = { uID: 7 }
    API.fetchProjectCurrencies.mockResolvedValue([])
    API.fetchProjectDetail.mockResolvedValue(rowOf())
    ADMIN.loadListingEditAdmin.mockResolvedValue(null)
  })

  afterEach(cleanup)

  // ---------------------------------------------------------------- ① 链接构造
  describe('① projectHrefOf（卡链接 / 入口链接的单一真源）', () => {
    it('行有合法 slug ⇒ `/<slug>`（交 buildLocalizedPath 补语言前缀）', () => {
      expect(projectHrefOf({ slug: 'sui' })).toBe('/sui')
      expect(projectHrefOf({ slug: '  arbitrum ' })).toBe('/arbitrum')
      expect(projectHrefOf({ slug: 'a1-b2' })).toBe('/a1-b2')
    })

    it('无 slug / 非字符串 / 空串 / 格式非法 ⇒ null（历史行保持原渲染，不链不存在页）', () => {
      expect(projectHrefOf({})).toBeNull()
      expect(projectHrefOf({ slug: null })).toBeNull()
      expect(projectHrefOf({ slug: '' })).toBeNull()
      expect(projectHrefOf({ slug: '   ' })).toBeNull()
      expect(projectHrefOf({ slug: 123 })).toBeNull()
      expect(projectHrefOf(null)).toBeNull()
      expect(projectHrefOf({ slug: 'Sui' })).toBeNull()
      expect(projectHrefOf({ slug: 'a'.repeat(33) })).toBeNull()
    })
  })

  // ---------------------------------------------------------------- ② 保留段
  describe('② 保留段 ⇒ 提示页、零请求', () => {
    it('冻结清单 = 二十一段（派单逐字）', () => {
      expect(RESERVED_PROJECT_SEGMENTS).toHaveLength(21)
    })

    it('二十一段逐一落 `<NotFoundPage />`，且零读口请求', async () => {
      for (const seg of RESERVED_PROJECT_SEGMENTS) {
        const { container, unmount } = renderAt(`/${seg}`)
        expect(notFound(container), `seg=${seg}`).not.toBeNull()
        expect(container.querySelector('[data-sf-m="project-page"]'), `seg=${seg}`).toBeNull()
        unmount()
      }
      // 保留段在页面自身判别（不靠路由排名）⇒ 一次项目读口都不发
      expect(API.fetchProjectDetail).not.toHaveBeenCalled()
      expect(ADMIN.loadListingEditAdmin).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------- ③ 读口
  describe('③ 读口：404 ⇒ 提示页；其它失败 ⇒ 错误面板', () => {
    it('读口 404 ⇒ `<NotFoundPage />`（ref 原样透传 slug）', async () => {
      API.fetchProjectDetail.mockRejectedValueOnce(Object.assign(new Error('project_not_found'), { status: 404 }))
      const { container } = renderAt('/ghost-project')
      await waitFor(() => expect(notFound(container)).not.toBeNull())
      expect(API.fetchProjectDetail).toHaveBeenCalledTimes(1)
      expect(API.fetchProjectDetail.mock.calls[0][0]).toBe('ghost-project')
    })

    it('读口 5xx / 网络失败 ⇒ 错误面板可重试（不白屏、不误判为不存在）', async () => {
      API.fetchProjectDetail.mockRejectedValueOnce(new Error('boom'))
      const { container } = renderAt('/sui')
      await waitFor(() => expect(container.querySelector('[data-sf-m="project-error"]')).not.toBeNull())
      expect(notFound(container)).toBeNull()
      expect(container.querySelector('[data-sf-m="project-retry"]')).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------- ④ 入口显隐
  describe('④ 操作区入口显隐（owner ∨ manage_tasks 管理员，且项目未 ended）', () => {
    it('owner 臂：本人项目（recruiting）⇒ 顶部只【发布活动】，任务 / 子任务入口下沉到卡头', async () => {
      API.fetchProjectDetail.mockResolvedValue(rowOf({
        owner_uid: 7,
        campaigns: [{
          campaign_id: 501,
          title: '秋季招募',
          status: 'active',
          tasks: [{ task_id: 555, title: '转发推文', status: 'active', sort: 1, subtasks: [] }],
        }],
      }))
      const { container } = renderAt('/sui')
      await waitFor(() => expect(container.querySelector('[data-sf-m="project-manage"]')).not.toBeNull())
      expect(container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull()
      // 入口下沉（Kevin 2026-10-21）：顶部操作区不再渲染【发布任务】/【发布子任务】
      expect(container.querySelector('[data-sf-m="project-entry-task"]')).toBeNull()
      expect(container.querySelector('[data-sf-m="project-entry-subtask"]')).toBeNull()
      // 下沉版：活动卡头一枚【发布任务】、任务卡头一枚【发布子任务】
      const campaignHead = container.querySelector('[data-sf-m="project-campaign"] > .sf-project-campaign-head')
      expect(campaignHead.querySelector('[data-sf-m="project-campaign-entry-task"]')).not.toBeNull()
      const taskHead = container.querySelector('[data-sf-m="project-task"] > .sf-project-task-head')
      expect(taskHead.querySelector('[data-sf-m="project-task-entry-subtask"]')).not.toBeNull()
    })

    it('管理员臂：非 owner 但 manage_tasks ⇒ 三个入口可见', async () => {
      API.fetchProjectDetail.mockResolvedValue(rowOf({ owner_uid: 99 }))
      ADMIN.loadListingEditAdmin.mockResolvedValue({
        can_access_admin: true, is_admin: false, permissions: ['manage_tasks'],
      })
      const { container } = renderAt('/sui')
      await waitFor(() => expect(container.querySelector('[data-sf-m="project-manage"]')).not.toBeNull())
      expect(container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull()
    })

    it('普通用户臂：非 owner 且无管理员能力 ⇒ 操作区整块不渲染', async () => {
      API.fetchProjectDetail.mockResolvedValue(rowOf({ owner_uid: 99 }))
      ADMIN.loadListingEditAdmin.mockResolvedValue(null)
      const { container } = renderAt('/sui')
      await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
      expect(container.querySelector('[data-sf-m="project-manage"]')).toBeNull()
      expect(container.querySelector('[data-sf-m="project-entry-campaign"]')).toBeNull()
      expect(container.querySelector('[data-sf-m="project-entry-task"]')).toBeNull()
      expect(container.querySelector('[data-sf-m="project-entry-subtask"]')).toBeNull()
    })

    it('客态（未登录）：无 /api/user 取数、无入口', async () => {
      AUTH.isAuthenticated = false
      AUTH.user = null
      API.fetchProjectDetail.mockResolvedValue(rowOf({ owner_uid: 7 }))
      const { container } = renderAt('/sui')
      await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
      expect(container.querySelector('[data-sf-m="project-manage"]')).toBeNull()
      expect(ADMIN.loadListingEditAdmin).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------- ⑤ 表单校验
  describe('⑤ slug 字段客户端校验（slugFieldErrorOf 单一真源）', () => {
    it('合法 slug / 空值 ⇒ null（空 ≠ 格式错，由调用方按场景判）', () => {
      expect(slugFieldErrorOf('sui')).toBeNull()
      expect(slugFieldErrorOf('a1-b2')).toBeNull()
      expect(slugFieldErrorOf('a'.repeat(32))).toBeNull()
      expect(slugFieldErrorOf('')).toBeNull()
      expect(slugFieldErrorOf('   ')).toBeNull()
      expect(slugFieldErrorOf(null)).toBeNull()
      expect(slugFieldErrorOf(undefined)).toBeNull()
    })

    it('格式非法 ⇒ format（大写 / 下划线 / 空格 / 超长 / 点号）', () => {
      expect(slugFieldErrorOf('Sui')).toBe('format')
      expect(slugFieldErrorOf('a_b')).toBe('format')
      expect(slugFieldErrorOf('a b')).toBe('format')
      expect(slugFieldErrorOf('a.b')).toBe('format')
      expect(slugFieldErrorOf('a'.repeat(33))).toBe('format')
    })

    it('保留字 ⇒ reserved（优先于格式判定；清单二十一段全命中）', () => {
      for (const seg of RESERVED_PROJECT_SEGMENTS) {
        expect(slugFieldErrorOf(seg), `seg=${seg}`).toBe('reserved')
      }
    })
  })
})
