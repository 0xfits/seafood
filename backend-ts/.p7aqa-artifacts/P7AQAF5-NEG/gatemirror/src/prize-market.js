export const PRICE_FLOOR_ELIGIBLE_DURATION_SECONDS = 30 * 24 * 60 * 60

const toTimeMs = (value) => {
  if (!value && value !== 0) return 0
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0
    return value > 1e12 ? value : value * 1000
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export const getPrizeDurationSeconds = (timeStart, timeEnd) => {
  const startMs = toTimeMs(timeStart)
  const endMs = toTimeMs(timeEnd)
  if (!startMs || !endMs || endMs <= startMs) return 0
  return Math.floor((endMs - startMs) / 1000)
}

export const isPrizePriceFloorEligible = (timeStart, timeEnd) => (
  getPrizeDurationSeconds(timeStart, timeEnd) > PRICE_FLOOR_ELIGIBLE_DURATION_SECONDS
)

export const getMinimumShardPrice = (marketFloorPoints) => (
  Math.max(0, Math.ceil(Math.max(0, Number(marketFloorPoints) || 0) / 1000))
)
