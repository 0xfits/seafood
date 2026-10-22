/**
 * 首页客户端排序纯函数单测（FEED-SORT-v2 · 2026-10-22）
 * ---------------------------------------------------------------------------
 * 判据（三臂 + 合并/归一）：
 *   ① `recommend` = `feed_score` 降序 → `time_created` 降序 → `bID` 降序（三键 tie-break 各验一次）；
 *   ② `new`       = `time_created` 降序 → `bID` 降序（**不看** `feed_score`）；
 *   ③ 缺 `feed_score`（旧缓存行）⇒ 按 **0** 处理，且排序**稳定**（同分行沿用输入次序）；
 *   ④ 数字字符串读数（后端契约）与毫秒/秒/ISO 时间戳皆归一；
 *   ⑤ `mergeFeedRows` 去重保留首见行；`normalizeFeedSort` 未知值回退 `recommend`。
 */
import { describe, expect, it } from 'vitest'

import {
  FEED_SORTS,
  feedOrderKeys,
  feedScoreOf,
  feedTimeOf,
  mergeFeedRows,
  normalizeFeedSort,
  sortFeedRows,
} from '../../home-feed-order'

const row = (bID, feed_score, time_created) => ({ bID, feed_score, time_created })
const ids = (rows) => rows.map((r) => r.bID)

describe('home-feed-order · 客户端排序（推荐 / 新发）', () => {
  it('① recommend：feed_score 降序；同分 ⇒ 时间降序；再同 ⇒ bID 降序', () => {
    const rows = [
      row(10, '0.412345', 500),   // 最高分
      row(11, '0.300000', 900),   // 同分组的较新者
      row(12, '0.300000', 700),   // 同分同时间 ⇒ bID 大者在前（12 > 11? 否）
      row(13, '0.100000', 100),
    ]
    const sorted = sortFeedRows(rows, 'recommend')
    // 0.412345 先；0.30 组：time 900 > 700 ⇒ 11 在 12 前
    expect(ids(sorted)).toEqual([10, 11, 12, 13])

    // 同一分数、同一时间 ⇒ bID 降序
    const tie = sortFeedRows([row(7, '0.5', 1000), row(9, '0.5', 1000), row(8, '0.5', 1000)], 'recommend')
    expect(ids(tie)).toEqual([9, 8, 7])

    // 不改入参（返回新数组）
    expect(ids(rows)).toEqual([10, 11, 12, 13])
    expect(sorted).not.toBe(rows)
  })

  it('② new：时间降序 → bID 降序，且**忽略** feed_score', () => {
    const rows = [
      row(4, '0.900000', 100),
      row(3, '0.700000', 400),
      row(2, '0.500000', 300),
      row(1, '0.200000', 200),
    ]
    expect(ids(sortFeedRows(rows, 'new'))).toEqual([3, 2, 1, 4])
    // 分数高低不改变 new 档顺序
    const highScoreOld = sortFeedRows([row(5, '0.990000', 10), row(6, '0.010000', 20)], 'new')
    expect(ids(highScoreOld)).toEqual([6, 5])
    // 同时间 ⇒ bID 降序
    expect(ids(sortFeedRows([row(2, '0.1', 50), row(5, '0.9', 50), row(3, '0.2', 50)], 'new'))).toEqual([5, 3, 2])
  })

  it('③ 缺 feed_score / 缺时间 ⇒ 按 0 处理（同 0 分列内仍按时间、bID 确定降序）', () => {
    const rows = [
      { bID: 101, name: '旧缓存行 A' },            // 无 feed_score / 无时间
      row(102, '0.250000', null),
      { bID: 103, feed_score: null, time_created: 0 }, // 显式 null ⇒ 0
      { bID: 104, feed_score: 'not-a-number' },        // 非数 ⇒ 0
    ]
    // 102 有分（0.25）⇒ 最前；其余三行同为「0 分 / 0 时间」⇒ 落到 bID 降序（确定、可重复）
    expect(ids(sortFeedRows(rows, 'recommend'))).toEqual([102, 104, 103, 101])
    // new 档不看分数：四行时间全 0 ⇒ bID 降序
    expect(ids(sortFeedRows(rows, 'new'))).toEqual([104, 103, 102, 101])

    // 有分行的分数 > 0 ⇒ 排在缺分行之前（缺分行按 0 沉底）
    const mixed = [{ bID: 1 }, row(2, '0.000001', 0), row(3, '0.5', 0)]
    expect(ids(sortFeedRows(mixed, 'recommend'))).toEqual([3, 2, 1])

    // 「稳定」= 三键全同（同 bID 的重复行）时保持输入次序
    const dup = [row(7, '0', 0), row(7, '0', 0)]
    expect(sortFeedRows(dup, 'recommend')[0]).toBe(dup[0])

    expect(feedScoreOf({})).toBe(0)
    expect(feedScoreOf({ feed_score: '' })).toBe(0)
    expect(feedScoreOf({ feed_score: '0.412345' })).toBeCloseTo(0.412345, 6)
  })

  it('④ 读数归一：数字字符串分数 / 秒·毫秒·ISO 时间戳', () => {
    expect(feedScoreOf({ feed_score: ' 0.75 ' })).toBe(0.75)
    expect(feedTimeOf({ time_created: 1760000000 })).toBe(1760000000000) // 秒 ⇒ 毫秒
    expect(feedTimeOf({ time_created: 1760000000000 })).toBe(1760000000000) // 已是毫秒
    expect(feedTimeOf({ time_created: '2026-10-22T00:00:00.000Z' })).toBe(Date.parse('2026-10-22T00:00:00.000Z'))
    expect(feedTimeOf({})).toBe(0)
    expect(feedTimeOf({ time_created: 'nope' })).toBe(0)
  })

  it('⑤ mergeFeedRows：去重保留首见行、保持到达序；feedOrderKeys 与 sortFeedRows 同源', () => {
    const first = [row(1, '0.1', 10), row(2, '0.2', 20)]
    const second = [row(2, '0.9', 999), row(3, '0.3', 30)]
    const merged = mergeFeedRows(first, second)
    expect(ids(merged)).toEqual([1, 2, 3])
    expect(merged[1]).toBe(first[1]) // 首见行不被后续页顶替

    const expected = feedOrderKeys([...merged], 'new')
    expect(expected).toEqual(['3', '2', '1'])
  })

  it('⑥ 排序闭集：两档标签键在闭集内，未知档归一为 recommend', () => {
    expect(FEED_SORTS.map((s) => s.key)).toEqual(['recommend', 'new'])
    expect(normalizeFeedSort('new')).toBe('new')
    for (const bad of ['hot', '', null, undefined, 'NEW', 0]) {
      expect(normalizeFeedSort(bad)).toBe('recommend')
    }
    // 未知档 ⇒ 按推荐序排（不抛错、不清列表）
    const rows = [row(1, '0.1', 1), row(2, '0.9', 2)]
    expect(ids(sortFeedRows(rows, 'unknown'))).toEqual([2, 1])
  })
})
