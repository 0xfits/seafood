/**
 * 项目表单纯逻辑单测（`pages/project/project-edit-form.js`）
 * ★ Kevin 2026-10-23：三框三分后的**键集边界**与**增量换算** —— 不挂 React，直接调函数。
 *
 * 判据：
 *   ① 三个载荷键集**三向互斥**、并集 = 全部可写字段，且**零 `status`**（状态由系统派生）；
 *   ② `editFormOf` 无 `status` 键、名额增量 `newSlots` 预填留空；
 *   ③ `slotsReadoutOf` = 增量读数与载荷换算的**同一真源**（已招 X + 新增 Y ⇒ 目标 X+Y；Y 空 ⇒ 目标 = 当前名额）；
 *   ④ `buildRecruitPayload`：Y>0 ⇒ 恰 `{headcount: X+Y}`；Y 空 ⇒ 零 `headcount` 键；
 *   ⑤ `buildWagePayload`：只带变化键（两币任一侧变 ⇒ 两键成对；清空 ⇒ 两键 null）；
 *   ⑥ `buildEditPayload`：只带项目面变化键，永远零 `status`。
 */
import { describe, expect, it } from 'vitest'

import {
  PROJECT_PAYLOAD_KEYS,
  RECRUIT_PAYLOAD_KEYS,
  WAGE_PAYLOAD_KEYS,
  buildEditPayload,
  buildRecruitPayload,
  buildWagePayload,
  editFormOf,
  slotsReadoutOf,
} from '../../pages/project/project-edit-form'

const ROW = {
  project_id: 11,
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 3,
  recruit_min_account_days: 7,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_cid: null,
  wage_currency_amount: null,
}

/** 表单初值（模拟 `useProjectFormState` 的起点）。 */
const formOf = (patch = {}) => ({ ...editFormOf(ROW), ...patch })

describe('① 三框载荷键集：三向互斥、并集 = 可写字段、零 status', () => {
  it('集合两两无交集，并集 = 9 个可写字段，且不含 status', () => {
    const all = [...PROJECT_PAYLOAD_KEYS, ...RECRUIT_PAYLOAD_KEYS, ...WAGE_PAYLOAD_KEYS]
    expect(new Set(all).size).toBe(all.length) // 互斥
    expect([...all].sort()).toEqual([
      'description',
      'headcount',
      'recruit_min_account_days',
      'slug',
      'title',
      'wage_batt_per_claim',
      'wage_cid',
      'wage_currency_amount',
      'wage_interval_hours',
    ])
    expect(all).not.toContain('status')
  })

  it('精确键集：项目面 3 / 招工面 2 / 工资面 4', () => {
    expect(PROJECT_PAYLOAD_KEYS).toEqual(['title', 'description', 'slug'])
    expect(RECRUIT_PAYLOAD_KEYS).toEqual(['headcount', 'recruit_min_account_days'])
    expect(WAGE_PAYLOAD_KEYS).toEqual([
      'wage_batt_per_claim', 'wage_interval_hours', 'wage_cid', 'wage_currency_amount',
    ])
  })
})

describe('② editFormOf：零 status、增量留空', () => {
  it('无 status 键；newSlots 恒为空串（增量不预填）；其余字段照行值', () => {
    const form = editFormOf(ROW)
    expect(form).not.toHaveProperty('status')
    expect(form).not.toHaveProperty('headcount')
    expect(form.newSlots).toBe('')
    expect(form.title).toBe('海鲜打包')
    expect(form.slug).toBe('sui')
    expect(form.minDays).toBe('7')
    expect(form.batt).toBe('30')
    expect(form.interval).toBe('4')
  })
})

describe('③ slotsReadoutOf：增量读数 = 载荷换算同一真源', () => {
  it('已招 3 + 新增 2 ⇒ 目标 5', () => {
    expect(slotsReadoutOf(ROW, '2')).toEqual({ hired: 3, current: 3, add: 2, target: 5 })
  })

  it('新增留空 ⇒ add=null、目标 = 当前名额（名额不变）', () => {
    expect(slotsReadoutOf(ROW, '')).toEqual({ hired: 3, current: 3, add: null, target: 3 })
    expect(slotsReadoutOf(ROW, '   ')).toEqual({ hired: 3, current: 3, add: null, target: 3 })
  })

  it('非法文本（0 / 2.5 / abc / -1）⇒ 按未填处理（校验层另行报错）', () => {
    for (const bad of ['0', '2.5', 'abc', '-1']) {
      expect(slotsReadoutOf(ROW, bad).add).toBeNull()
    }
  })

  it('已招数缺省（读口无 hired_count）⇒ 按 0 起算', () => {
    expect(slotsReadoutOf({ headcount: 3 }, '2')).toEqual({ hired: 0, current: 3, add: 2, target: 2 })
  })
})

describe('④ buildRecruitPayload：增量换算 / 留空不写', () => {
  it('已招 3 + 新增 2 ⇒ 恰 {headcount: 5}', () => {
    expect(buildRecruitPayload(ROW, formOf({ newSlots: '2' }))).toEqual({ headcount: 5 })
  })

  it('新增留空 ⇒ 零 headcount 键（无变化 ⇒ 空载荷）', () => {
    const body = buildRecruitPayload(ROW, formOf())
    expect(body).toEqual({})
    expect(body).not.toHaveProperty('headcount')
  })

  it('新增 + 天数同改 ⇒ 两键（headcount 为绝对目标）', () => {
    expect(buildRecruitPayload(ROW, formOf({ newSlots: '1', minDays: '30' })))
      .toEqual({ headcount: 4, recruit_min_account_days: 30 })
  })

  it('零工资键外泄（key 集互斥）', () => {
    const body = buildRecruitPayload(ROW, formOf({ newSlots: '2', batt: '99' }))
    expect(body).toEqual({ headcount: 5 })
  })
})

describe('⑤ buildWagePayload：只带变化键、两币成对', () => {
  it('无变化 ⇒ 空载荷（含 newSlots 留空）', () => {
    expect(buildWagePayload(ROW, formOf())).toEqual({})
  })

  it('改 batt ⇒ 恰 {wage_batt_per_claim}', () => {
    expect(buildWagePayload(ROW, formOf({ batt: '35' }))).toEqual({ wage_batt_per_claim: '35' })
  })

  it('选次币 + 金额 0 ⇒ 两键成对（0 合法，= 不发次币）', () => {
    expect(buildWagePayload(ROW, formOf({ cid: '4', amount: '0' })))
      .toEqual({ wage_cid: 4, wage_currency_amount: '0' })
  })

  it('清空次币 ⇒ 两键都 null（后端「同现同缺」整包校验）', () => {
    const row = { ...ROW, wage_cid: 4, wage_currency_amount: '50' }
    expect(buildWagePayload(row, { ...editFormOf(row), cid: '', amount: '' }))
      .toEqual({ wage_cid: null, wage_currency_amount: null })
  })

  it('只改间隔 ⇒ 恰 {wage_interval_hours}；零 headcount / 天数键', () => {
    const body = buildWagePayload(ROW, formOf({ interval: '8' }))
    expect(body).toEqual({ wage_interval_hours: 8 })
    expect(body).not.toHaveProperty('headcount')
    expect(body).not.toHaveProperty('recruit_min_account_days')
  })
})

describe('⑥ buildEditPayload：零 status 键（状态由系统派生）', () => {
  it('改标题 ⇒ 恰 {title}，永不带 status', () => {
    const body = buildEditPayload(ROW, formOf({ title: '新标题' }))
    expect(body).toEqual({ title: '新标题' })
    expect(body).not.toHaveProperty('status')
  })

  it('表单里即便被塞 status（旧调用方残留）也不会进载荷', () => {
    const body = buildEditPayload(ROW, formOf({ title: '新标题', status: 'working' }))
    expect(body).toEqual({ title: '新标题' })
  })
})
