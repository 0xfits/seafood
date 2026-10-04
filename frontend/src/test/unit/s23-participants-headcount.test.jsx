/**
 * S23 单测（Kong · 台账 B4）：`headcount` 进入任务读模型 + 展示「已参与 X / 共 N 人」
 * ============================================================================
 * 覆盖四件事：
 *   (a) 四语 `jobs.participantsHeadcount` 键**四语齐备且键集严格相等**、值逐字、含 `{{done}}`＋`{{limit}}`；
 *   (b) 计数基线前推：顶层 **119** / 拍平 **1050**（S23 +1 jobs.participantsHeadcount；S25 B7 退役 10 键）/ 四语节点 **4200**；
 *   (c) `JobDetailPage` 元信息行**同时**随 `participants_count`（done）与 `headcount`（limit）变；
 *   (d) ★ 内建负对照：把展示的 `limit` 钉成错值 ⇒ 「正确 limit 断言」**判假**（红）；钉回真值 ⇒ 判真（绿）。
 *
 * 口径：真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 s19-participants-truth-source 先例）；
 *   i18n 用**真 zh 词典** + `{{var}}` 插值，逐字断言。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

// i18n 替身：真 zh 词典 + `{{var}}` 插值（模块级稳定函数）
const H = vi.hoisted(() => {
  const state = { table: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    if (v === undefined) return key
    return opts ? String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : v
  }
  return state
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

import JobDetailPage from '../../pages/jobs/JobDetailPage'

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

/** stubbed `fetch`：任务详情返回指定 `participants_count` + `headcount`，其余读口给空。 */
const routed = ({ count, headcount }) => vi.fn(async (url) => {
  const u = String(url)
  if (u.includes('/api/task-progress')) return jsonResponse(200, { success: true, data: [] })
  if (u.includes('/submissions')) return jsonResponse(403, { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'f', details: { reason: 'NOT_ADMIN' } } })
  if (u.includes('/api/task/')) return jsonResponse(200, { success: true, data: { tID: 9, title: 'x', points: 5, participants_count: count, headcount } })
  return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'nf' } })
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/job/9']}>
    <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
  </MemoryRouter>,
)

const metaEl = () => document.querySelector('[data-sf-m="jobs-meta"]')

beforeEach(() => { H.table = zh })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// (a) 四语 `jobs.participantsHeadcount`：键集严格相等 + 值逐字 + 双占位符
// ============================================================================
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/
const readTable = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flat(readTable(l)))]))

const EXPECTED = {
  zh: '已参与 {{done}} / 共 {{limit}} 人',
  hk: '已參與 {{done}} / 共 {{limit}} 人',
  en: '{{done}} / {{limit}} participants',
  vn: '{{done}} / {{limit}} người tham gia',
}

describe('(a) 四语 jobs.participantsHeadcount（新键）', () => {
  it('四语值逐字 = 期望', () => {
    for (const l of LANGS) expect(TABLES[l]['jobs.participantsHeadcount'], l).toBe(EXPECTED[l])
  })

  it('四语值均含 {{done}} 与 {{limit}} 双占位符', () => {
    for (const l of LANGS) {
      expect(TABLES[l]['jobs.participantsHeadcount'], `${l} done`).toContain('{{done}}')
      expect(TABLES[l]['jobs.participantsHeadcount'], `${l} limit`).toContain('{{limit}}')
    }
  })

  it('en/vn 值零 CJK（hk 繁体 / zh 简体）', () => {
    for (const l of ['en', 'vn']) expect(CJK.test(TABLES[l]['jobs.participantsHeadcount']), l).toBe(false)
  })

  it('四语**键集严格相等**（只比键，缺一 / 多一 / 命名差异皆判负）', () => {
    const keySets = Object.fromEntries(LANGS.map((l) => [l, Object.keys(TABLES[l]).sort()]))
    for (const l of LANGS) {
      expect(keySets[l], `${l} vs zh 键集（排序后逐字相等）`).toEqual(keySets.zh)
    }
    expect(new Set(LANGS.map((l) => keySets[l].join('\u0001'))).size, '四语键集唯一').toBe(1)
  })
})

// ============================================================================
// (b) 计数基线前推（S23 +1 jobs.participantsHeadcount ⇒ 1059⇒1060 / 4236⇒4240；S25 B7 退役 10 键 ⇒ 1060⇒1050 / 4240⇒4200）
// ============================================================================
describe('(b) 计数基线前推', () => {
  it('顶层 119 不变 / 拍平 1050 / 四语节点 4200（S25 B7 退役 10 键）', () => {
    for (const l of LANGS) {
      expect(Object.keys(readTable(l)).length, `${l} top`).toBe(119)
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(flat(readTable(l)).length, `${l} flat`).toBe(1050)
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(flat(readTable('zh')).length * LANGS.length).toBe(4200)
  })
})

// ============================================================================
// (c) JobDetailPage 元信息行同时随 participants_count 与 headcount 变
// ============================================================================
describe('(c) JobDetailPage 展示「已参与 X / 共 N 人」', () => {
  it('participants_count=3 / headcount=50 ⇒ 「已参与 3 / 共 50 人」', async () => {
    vi.stubGlobal('fetch', routed({ count: 3, headcount: 50 }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(metaEl().textContent).toContain('已参与 3 / 共 50 人')
    expect(metaEl().textContent).toContain('#9')
  })

  it('headcount 缺省 ⇒ fail-closed 为 1（「共 1 人」）', async () => {
    vi.stubGlobal('fetch', routed({ count: 5, headcount: undefined }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(metaEl().textContent).toContain('已参与 5 / 共 1 人')
  })

  it('headcount 非法（0）⇒ fail-closed 为 1（不显示「共 0 人」）', async () => {
    vi.stubGlobal('fetch', routed({ count: 2, headcount: 0 }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(metaEl().textContent).toContain('已参与 2 / 共 1 人')
    expect(metaEl().textContent).not.toContain('共 0 人')
  })

  it('两维独立：改 done 不改 limit / 改 limit 不改 done', async () => {
    vi.stubGlobal('fetch', routed({ count: 7, headcount: 9 }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(metaEl().textContent).toContain('已参与 7 / 共 9 人')
    expect(metaEl().textContent).not.toContain('已参与 9 / 共 7 人')
  })
})

// ============================================================================
// ★ (d) 内建负对照：把展示的 limit 钉成错值 ⇒ 正确断言必红（自证谓词对 limit 敏感）
// ============================================================================
describe('★ (d) 负对照（limit 钉错值 ⇒ 断言必红）', () => {
  const TRUE_LIMIT = 50
  const WRONG_LIMIT = 1 // 等价于「join 时把 headcount 写错 / 拿掉映射后退化成默认 1」的错值
  const correctPredicate = (text) => String(text).includes(`已参与 3 / 共 ${TRUE_LIMIT} 人`)

  it('正确 limit（50）⇒ 谓词判真（绿）', async () => {
    vi.stubGlobal('fetch', routed({ count: 3, headcount: TRUE_LIMIT }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(correctPredicate(metaEl().textContent)).toBe(true)
  })

  it('错误 limit（1）⇒ 谓词判假（红）：展示确实随 headcount 变', async () => {
    vi.stubGlobal('fetch', routed({ count: 3, headcount: WRONG_LIMIT }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    const text = metaEl().textContent
    expect(text).toContain('已参与 3 / 共 1 人') // 展示随 headcount 变（钉到错值）
    expect(correctPredicate(text)).toBe(false) // 若在此渲染下断言「共 50 人」⇒ 必红
  })
})
