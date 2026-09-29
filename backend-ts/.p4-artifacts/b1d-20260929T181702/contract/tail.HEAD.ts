// ---- P4-B1-d fixture tail (appended for the key-contract fixture; NOT part of HEAD a8e958b) ----
// normalizeOrderBookRow below is a verbatim copy of the inline mapping at
// HEAD database.ts:2593-2597 (`return rows.map((row) => ({ side: ..., price: ..., volume: ... }))`),
// because HEAD did not expose it as a module-level function. See B1-d self-disclosure #2.
export const normalizeOrderBookRow = (row: RawRow): MarketOrderBookRow => ({
  side: row.side === 'sell' ? 'sell' : 'buy',
  price: toNumberValue(row.price),
  volume: toNumberValue(row.volume),
});
export { normalizeMarketOrder, normalizeMarketTrade };
