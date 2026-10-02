import { describe, expect, it } from 'vitest'

import {
  PRICE_FLOOR_ELIGIBLE_DURATION_SECONDS,
  getMinimumShardPrice,
  getPrizeDurationSeconds,
  isPrizePriceFloorEligible,
} from '../../prize-market'

describe('prize-market helpers', () => {
  it('computes prize duration from datetime values', () => {
    expect(
      getPrizeDurationSeconds('2026-04-01T00:00', '2026-04-03T12:00'),
    ).toBe(60 * 60 * 60)
  })

  it('flags price floor eligibility only for prizes longer than 30 days', () => {
    expect(
      isPrizePriceFloorEligible('2026-04-01T00:00', '2026-05-02T00:00'),
    ).toBe(true)

    expect(
      isPrizePriceFloorEligible('2026-04-01T00:00', '2026-05-01T00:00'),
    ).toBe(false)

    expect(PRICE_FLOOR_ELIGIBLE_DURATION_SECONDS).toBe(30 * 24 * 60 * 60)
  })

  it('rounds minimum shard price up from the configured floor points', () => {
    expect(getMinimumShardPrice(0)).toBe(0)
    expect(getMinimumShardPrice(1000)).toBe(1)
    expect(getMinimumShardPrice(1001)).toBe(2)
  })
})
