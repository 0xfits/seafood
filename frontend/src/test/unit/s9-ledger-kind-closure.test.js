/**
 * ★S9「族 vs 后端关闭集」守卫（Kong · 本单新增）
 *
 * 背景（独立质检 finding，已复核成立）：`ProfilePage.jsx:416` 与
 *   `MarketPage.jsx:405` 用 `t('ledger.kind.' + entry.kind)` 渲染流水类型。
 *   `LEDGER_KINDS`（`ledger.ts`）是**封闭可枚举集**（后端常量 + DB CHECK 双源），
 *   而四语 `ledger.kind` 曾仅 20 键 ⇒ 4 类流水渲染**裸键名**（用户可见）。
 *
 * 口径（本测试 = 可判负断言）：
 *   ① 关闭集**两源对账**（`LEDGER_KINDS` 现取 vs `0038` 的 `ledger_kind_enum` CHECK 编码）
 *      ⇒ 两源必须逐值相等；
 *   ② 四语 `ledger.kind` 键集 **== 后端关闭集**（缺一 / 多一皆判负）；
 *   ③ 四语键值非空；en / vn **零 CJK**（hk 繁体、zh 简体）；
 *   ④ 计数前推：顶层 119 / 拍平 1060 / 四语节点 4240（S23 +1 jobs.participantsHeadcount）；
 *   ⑤ **注入自证**：从合成 locale 删掉一个键 ⇒ 检测器必红（给红点），随即可逆。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../..')            // = frontend/src
const REPO = path.resolve(HERE, '../../../..')     // = 仓库根（seafood/）
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

// ---------- 关闭集源 A：后端 TS 常量 `LEDGER_KINDS` 现取 ----------
const LEDGER_TS = fs.readFileSync(path.join(REPO, 'backend-ts/src/ledger.ts'), 'utf8')
const arrayMatch = LEDGER_TS.match(/export const LEDGER_KINDS = \[([\s\S]*?)\] as const;/)
const TS_KINDS = arrayMatch ? [...arrayMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : []

// 镜像常量（冻结口径 · 防止「解析失效却静默通过」）：与后端 LEDGER_KINDS 逐值对齐。
const KINDS_MIRROR = [
  'mint', 'burn', 'transfer', 'hold', 'hold_release', 'hold_forfeit',
  'job_escrow', 'job_escrow_refund', 'job_payout', 'job_fee', 'commission',
  'purchase', 'sale', 'purchase_refund',
  'trade', 'trade_fee',
  'listing_fee', 'listing_deposit',
  'currency_create_fee', 'reversal',
  'checkin_makeup_fee',
  'bttc_mint_fee', 'bttc_burn_fee',
  'invite_first_task_reward',
]

// ---------- 关闭集源 B：DB CHECK `ledger_kind_enum`（0038 冻结编码） ----------
const SQL_0038 = fs.readFileSync(path.join(REPO, 'backend-ts/migrations/0038_kind_close_set_24.sql'), 'utf8')
const checkMatch = SQL_0038.match(/ADD CONSTRAINT ledger_kind_enum CHECK \(kind IN \(([\s\S]*?)\)\);/)
const DB_KINDS = checkMatch ? [...checkMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : []

// ---------- locale ----------
const readLocale = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const KIND = Object.fromEntries(LANGS.map((l) => [l, readLocale(l).ledger.kind]))

/** 缺键检测器（可判负核心）：返回 locale.kind 相对关闭集的缺口 */
const kindDiff = (localeKind, closedSet = TS_KINDS) => {
  const have = new Set(Object.keys(localeKind || {}))
  const missing = closedSet.filter((k) => !have.has(k))
  const extra = [...have].filter((k) => !closedSet.includes(k))
  return { missing, extra }
}

const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${p}${k}.`) : [`${p}${k}`]
))

// ============================================================================
describe('S9① 关闭集两源对账（TS LEDGER_KINDS == DB CHECK ledger_kind_enum）', () => {
  it('LEDGER_KINDS 现取非空且 == 镜像常量（解析未失效）', () => {
    expect(arrayMatch, 'ledger.ts 中未取到 LEDGER_KINDS 数组').not.toBeNull()
    expect(TS_KINDS).toEqual(KINDS_MIRROR)
    expect(TS_KINDS.length).toBe(24)
  })

  it('DB CHECK（0038）非空且逐值 == TS LEDGER_KINDS（两源同集）', () => {
    expect(checkMatch, '0038 中未取到 ledger_kind_enum CHECK').not.toBeNull()
    expect(DB_KINDS.length).toBe(24)
    expect(DB_KINDS).toEqual(TS_KINDS)
  })
})

describe('S9② 四语 ledger.kind 键集 == 后端关闭集（可判负）', () => {
  it('四语皆无缺键、无多余键（缺口差集 = 0）', () => {
    const problems = []
    for (const l of LANGS) {
      const { missing, extra } = kindDiff(KIND[l])
      if (missing.length) problems.push(`${l} 缺 [${missing.join(',')}]`)
      if (extra.length) problems.push(`${l} 多 [${extra.join(',')}]`)
    }
    expect(problems).toEqual([])
    for (const l of LANGS) expect(Object.keys(KIND[l]).length, `${l} 键数`).toBe(24)
  })

  it('四语键值非空；en/vn 零 CJK（hk 繁体 / zh 简体）', () => {
    const problems = []
    for (const l of LANGS) {
      for (const k of TS_KINDS) {
        const v = KIND[l][k]
        if (typeof v !== 'string' || !v.trim()) { problems.push(`${l}.${k} 空/缺`); continue }
        if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l}.${k} 残留中文 ${v}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('四语新增键逐字（本单补齐的 4 键）', () => {
    expect(KIND.zh.checkin_makeup_fee).toBe('补签费')
    expect(KIND.zh.bttc_mint_fee).toBe('铸币费')
    expect(KIND.zh.bttc_burn_fee).toBe('销币费')
    expect(KIND.zh.invite_first_task_reward).toBe('邀请首任务奖励')
    expect(KIND.en.checkin_makeup_fee).toBe('Makeup check-in fee')
    expect(KIND.en.bttc_mint_fee).toBe('BTTC mint fee')
    expect(KIND.en.bttc_burn_fee).toBe('BTTC burn fee')
    expect(KIND.en.invite_first_task_reward).toBe('Invite first-task reward')
    expect(KIND.hk.invite_first_task_reward).toBe('邀請首任務獎勵')
    expect(KIND.vn.invite_first_task_reward).toBe('Thưởng nhiệm vụ đầu tiên do mời')
  })
})

describe('S9③ 计数前推（S9 +4 键/语 ⇒ 拍平 1055→1059 / 节点 4220→4236）', () => {
  it('顶层 119 不变 / 拍平 1060 / 四语节点 4240（S23 +1 jobs.participantsHeadcount）', () => {
    for (const l of LANGS) {
      expect(Object.keys(readLocale(l)).length, `${l} top`).toBe(119)
      expect(flatten(readLocale(l)).length, `${l} flat`).toBe(1060)
    }
    expect(flatten(readLocale('zh')).length * LANGS.length).toBe(4240)
  })
})

// ============================================================================
describe('S9④ 检测器自证（注入缺键 ⇒ 必红；随即可逆）', () => {
  it('从合成 locale.kind 删掉 invite_first_task_reward ⇒ kindDiff 命中（红点）', () => {
    const sintetic = { ...KIND.zh }
    delete sintetic.invite_first_task_reward
    const { missing } = kindDiff(sintetic)
    expect(missing).toEqual(['invite_first_task_reward'])
  })

  it('删任意一键皆必红（逐键遍历，非单点）', () => {
    for (const k of TS_KINDS) {
      const sintetic = { ...KIND.en }
      delete sintetic[k]
      expect(kindDiff(sintetic).missing, `删 ${k}`).toEqual([k])
    }
  })

  it('完整键集 ⇒ 无命中（判定可逆）', () => {
    expect(kindDiff(KIND.zh)).toEqual({ missing: [], extra: [] })
  })

  it('多余键（如未知兜底键）⇒ 亦判负（严格相等，非「只查缺」）', () => {
    const sintetic = { ...KIND.zh, __unknown__: 'x' }
    expect(kindDiff(sintetic).extra).toEqual(['__unknown__'])
  })
})
