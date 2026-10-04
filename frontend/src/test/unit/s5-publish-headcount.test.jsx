/**
 * S5① · 发布任务表单「总人数」+ 押金提示（Kong）
 *
 * 口径（对齐后端已冻结模型）：
 *   · `POST /api/job` 服务层已收 `headcount`（缺省 `'1'`；`job-funds-service.ts:182-185`），
 *     托管额 = `reward × headcount`（金额由 DB 侧派生）；本单只接线 + 展示提示，不做托管计算。
 *   · 新增文案键必须**四语齐备**（zh/en/hk/vn；en/vn 不得含 CJK）。
 *   · 键计数：`jobs` 为既有顶层 ⇒ 顶层 119 不变 / 拍平 1041⇒1044 / 四语节点 4164⇒4176。
 *
 * ★ i18n 替身取**模块级稳定函数**（否则 effect 依赖每次变化 ⇒ 无限重渲染，同 listing-market 先例）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/
const readTable = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const FLAT = Object.fromEntries(LANGS.map((l) => [l, flat(readTable(l))]))
const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(FLAT[l])]))

const NEW_KEYS = ['jobs.headcount', 'jobs.headcountInvalid', 'jobs.depositHint']

// i18n 替身：模块级稳定；只对押金提示做最小插值（便于断言「赏金 × 人数」的算式结果）
const stableT = (key, opts) => (
  key === 'jobs.depositHint' && opts
    ? `deposit=${opts.deposit};reward=${opts.reward};headcount=${opts.headcount}`
    : key
)
const stableI18n = { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' }

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: stableT, i18n: stableI18n }) }))
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchApiJson: vi.fn(async () => [{}]),
    getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
  }
})
vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: false, can_access_admin: false, permissions: [] })),
  hasAdminPermission: vi.fn(() => false),
}))

import { fetchApiJson } from '../../auth'
import { useAuth } from '../../auth-context'
import PublishJobPage from '../../pages/jobs/PublishJobPage'
import { jobPublishFingerprint, publishJob } from '../../pages/jobs/job-api'

const callsTo = (pattern) => fetchApiJson.mock.calls.filter((c) => String(c[0]).includes(pattern))

const renderPage = (ui, p = '/task/new') => render(
  <MemoryRouter initialEntries={[p]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {ui}
  </MemoryRouter>
)

describe('S5① · 新增文案键四语齐备 + 键计数', () => {
  it('3 新键四语齐备、非空串；en/vn 零 CJK', () => {
    const problems = []
    for (const k of NEW_KEYS) {
      for (const l of LANGS) {
        const v = TABLES[l][k]
        if (typeof v !== 'string' || !v.trim()) { problems.push(`${l}.${k} 空/缺`); continue }
        if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l}.${k} 残留中文 ${v}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('键计数：顶层 119 不变 / 拍平 1050 / 四语节点 4200（S8 前推：+jobs.deliverable；S9：+4 ledger.kind；S23 +1 jobs.participantsHeadcount；S25：B7 退役 10 键）', () => {
    for (const l of LANGS) {
      expect(Object.keys(readTable(l)).length, `${l} top`).toBe(119)
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(FLAT[l].length, `${l} flat`).toBe(1050)
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(FLAT.zh.length * LANGS.length).toBe(4200)
  })

  it('depositHint 四语均含押金/人数算式占位（逐字锚）', () => {
    expect(TABLES.zh['jobs.depositHint']).toContain('{{reward}}')
    expect(TABLES.zh['jobs.depositHint']).toContain('{{headcount}}')
    expect(TABLES.zh['jobs.depositHint']).toContain('{{deposit}}')
    expect(TABLES.en['jobs.depositHint']).toContain('{{deposit}}')
  })
})

describe('S5① · job-api 接 headcount', () => {
  beforeEach(() => { vi.clearAllMocks(); fetchApiJson.mockImplementation(async () => [{}]) })

  it('publishJob → POST /api/job，body 带 headcount', async () => {
    await publishJob({ cid: 1, reward: '10', title: 't', description: 'd', headcount: '3', createKey: 'cli:x', user: null })
    const call = callsTo('/api/job')[0]
    const body = JSON.parse(call[1].body)
    expect(call[0]).toBe('/api/job')
    expect(body.headcount).toBe('3')
    expect(body.reward).toBe('10')
  })

  it('指纹含 headcount：人数变 ⇒ 指纹变（新实体）；人数同 ⇒ 指纹不变（重试复用键）', () => {
    const base = { cid: '1', reward: '10', title: 't', description: 'd', headcount: '3' }
    expect(jobPublishFingerprint({ ...base })).toBe(jobPublishFingerprint({ ...base }))
    expect(jobPublishFingerprint({ ...base, headcount: '4' })).not.toBe(jobPublishFingerprint(base))
  })
})

describe('S5① · 发布页表单：总人数必填 + 押金提示', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchApiJson.mockImplementation(async () => [{}])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
  })

  const headcountInput = (c) => c.querySelector('[data-sf-m="jobs-input-headcount"]')

  it('总人数输入默认 1，且为必填数字框（min=1 / step=1）', () => {
    const { container } = renderPage(<PublishJobPage />)
    const input = headcountInput(container)
    expect(input).toBeTruthy()
    expect(input.value).toBe('1')
    expect(input.getAttribute('type')).toBe('number')
    expect(input.getAttribute('min')).toBe('1')
  })

  it('押金提示 = 赏金 × 人数（填 10 与 3 ⇒ deposit=30）；空赏金 ⇒ 占位 —', () => {
    const { container } = renderPage(<PublishJobPage />)
    const hint = () => container.querySelector('[data-sf-m="jobs-deposit-hint"]').textContent
    // 初始：赏金空 ⇒ 不臆造 0
    expect(hint()).toContain('deposit=—')
    fireEvent.change(container.querySelector('[data-sf-m="jobs-input-reward"]'), { target: { value: '10' } })
    fireEvent.change(headcountInput(container), { target: { value: '3' } })
    expect(hint()).toContain('deposit=30')
  })

  it('人数 < 1（0）⇒ 提交被代码闸拦下：不发起 /api/job，状态= jobs.headcountInvalid', () => {
    const { container } = renderPage(<PublishJobPage />)
    fireEvent.change(container.querySelector('[data-sf-m="jobs-input-reward"]'), { target: { value: '10' } })
    fireEvent.change(headcountInput(container), { target: { value: '0' } })
    fireEvent.submit(container.querySelector('[data-sf-m="jobs-form"]'))
    expect(callsTo('/api/job').length).toBe(0)
    expect(container.querySelector('[data-sf-m="jobs-status"]').textContent).toContain('jobs.headcountInvalid')
  })

  it('人数合法 ⇒ 提交带 headcount 到 /api/job', async () => {
    const { container } = renderPage(<PublishJobPage />)
    fireEvent.change(container.querySelector('[data-sf-m="jobs-input-reward"]'), { target: { value: '10' } })
    fireEvent.change(headcountInput(container), { target: { value: '2' } })
    fireEvent.submit(container.querySelector('[data-sf-m="jobs-form"]'))
    await vi.waitFor(() => expect(callsTo('/api/job').length).toBe(1))
    const body = JSON.parse(callsTo('/api/job')[0][1].body)
    expect(body.headcount).toBe('2')
  })
})
