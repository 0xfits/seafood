// p4z-08-keys-b1d.ts — READ-ONLY in-memory key-contract fixture (zero DB access, zero writes).
// Usage: ts-node --transpile-only scripts/p4z-08-keys-b1d.ts <outJson>
//
// Feeds IDENTICAL synthetic rows to the PRE mappers (contract/database.HEAD.ts =
// `git show HEAD:backend-ts/src/database.ts` + appended fixture tail) and the POST mappers
// (contract/database.NEW.ts = worktree src/database.ts + appended export line), then compares
// KEY SETS only (values may differ). Mappers under test:
//   normalizeMarketOrder      -> serves listOrdersByUser
//   normalizeMarketTrade      -> serves listTradesByBrand
//   normalizeOrderBookRow     -> extracted from listOrderBook (POST); verbatim copy of the HEAD
//                                inline mapping for the PRE side (see tail.HEAD.ts comment)
import * as fs from 'fs';
import * as HEAD from '../.p4-artifacts/b1d-20260929T181702/contract/database.HEAD';
import * as NEW from '../.p4-artifacts/b1d-20260929T181702/contract/database.NEW';

const outPath = process.argv[2];
if (!outPath) { console.error('USAGE: <outJson>'); process.exit(2); }

type Row = Record<string, unknown>;
type Mapper = (row: Row, brand?: unknown) => Record<string, unknown>;

const keys = (o: unknown) => Object.keys(o as Record<string, unknown>).sort();
const eq = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

const orderRows: Record<string, Row> = {
  empty_row: {},
  old_market_order_row: {
    oID: 11, bID: 7, uID: 3, side: 'sell', price: 5,
    volume_total: 10, volume_filled: 4, status: 'partial',
    time_created: '2026-01-01T00:00:00Z', time_updated: '2026-01-02T00:00:00Z',
    symbol: 'ABC', brand_name: 'abc',
  },
  // shape produced by POST SQL `SELECT o.*` over the new market_order columns
  new_market_order_row: {
    order_id: 11, owner_uid: 3, side: 'sell', base_cid: 7, quote_cid: 1, price: 5,
    amount: 10, amount_filled: 4, status: 'partial', create_key: 'k',
    ledger_event_keys: [], time_created: '2026-01-01T00:00:00Z', time_updated: '2026-01-02T00:00:00Z',
  },
};

const tradeRows: Record<string, Row> = {
  empty_row: {},
  old_market_trade_row: {
    trID: 21, bID: 7, buy_oID: 11, sell_oID: 12, buyer_uID: 3, seller_uID: 4,
    price: 5, volume: 2, time_created: '2026-01-03T00:00:00Z', brand_symbol: 'ABC',
  },
  // shape produced by POST SQL: `t.*` (new columns) + LEFT JOIN aliases buyer_uID/seller_uID
  new_market_trade_row: {
    trade_id: 21, base_cid: 7, quote_cid: 1, price: 5, amount: 2,
    buy_order_id: 11, sell_order_id: 12, taker_uid: 3, fee: 0,
    time_created: '2026-01-03T00:00:00Z', buyer_uID: 3, seller_uID: 4,
  },
};

const bookRows: Record<string, Row> = {
  empty_row: {},
  old_sql_row: { side: 'sell', price: 5, volume: 6 },
  new_sql_row: { side: 'buy', price: 3, volume: 2 },
};

const cases: Array<Record<string, unknown>> = [];
const run = (name: string, pre: Mapper, post: Mapper, row: Row) => {
  const preKeys = keys(pre(row, null));
  const postKeys = keys(post(row, null));
  cases.push({ name, pre_keys: preKeys, post_keys: postKeys, key_set_equal: eq(preKeys, postKeys) });
};

for (const [label, row] of Object.entries(orderRows)) {
  run(`market_order:${label}`, HEAD.normalizeMarketOrder as Mapper, NEW.normalizeMarketOrder as Mapper, row);
}
for (const [label, row] of Object.entries(tradeRows)) {
  run(`market_trade:${label}`, HEAD.normalizeMarketTrade as Mapper, NEW.normalizeMarketTrade as Mapper, row);
}
for (const [label, row] of Object.entries(bookRows)) {
  run(`order_book:${label}`, HEAD.normalizeOrderBookRow as Mapper, NEW.normalizeOrderBookRow as Mapper, row);
}

const allEqual = cases.every((c) => c.key_set_equal === true);
const out = {
  generated_at: new Date().toISOString(),
  caliber: 'in-memory fixture; zero DB access; compares KEY SETS only (not values)',
  pre_source: 'contract/database.HEAD.ts = git show HEAD:backend-ts/src/database.ts + tail.HEAD.ts',
  post_source: 'contract/database.NEW.ts = worktree src/database.ts + tail.NEW.ts',
  case_count: cases.length,
  equal_count: cases.filter((c) => c.key_set_equal === true).length,
  all_key_sets_equal: allEqual,
  cases,
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`CASES=${cases.length} EQUAL=${out.equal_count} ALL_EQUAL=${allEqual}`);
for (const c of cases) {
  console.log(`${(c.key_set_equal as boolean) ? 'EQ' : 'NE'} ${c.name as string} pre=[${(c.pre_keys as string[]).join(',')}]`);
}
process.exit(allEqual ? 0 : 1);
