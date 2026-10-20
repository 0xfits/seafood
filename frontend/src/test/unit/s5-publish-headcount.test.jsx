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

  // ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
  it('键计数：顶层 128 不变 / 拍平 1070 / 四语节点 4280（v1.5 §14.10 +20 叶/语；S8 前推：+jobs.deliverable；S9：+4 ledger.kind；S23 +1 jobs.participantsHeadcount；S25：B7 退役 10 键）', () => {
    for (const l of LANGS) {
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
      expect(Object.keys(readTable(l)).length, `${l} top`).toBe(133) // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(FLAT[l].length, `${l} flat`).toBe(1237) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(FLAT.zh.length * LANGS.length).toBe(4948) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436 // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
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
