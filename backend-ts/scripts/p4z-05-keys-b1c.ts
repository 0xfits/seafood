// p4z-05-keys-b1c.ts — P4-B1-c 字段 key 契约（零依赖内存夹具，不写库、零 DB 访问）。
// 把同一组合成行分别喂给改动前 mapper（git show HEAD 快照 contract/database.HEAD.ts）
// 与改动后 mapper（工作树快照 contract/database.NEW.ts），只比输出 key 集（不比值）。
// Run: node_modules/.bin/ts-node --transpile-only scripts/p4z-05-keys-b1c.ts
import { normalizeBrand as brandHEAD, normalizePrizeItem as itemHEAD } from '../.p4-artifacts/b1c-20260929T151415/contract/database.HEAD';
import { normalizeBrand as brandNEW, normalizePrizeItem as itemNEW } from '../.p4-artifacts/b1c-20260929T151415/contract/database.NEW';

type Row = Record<string, unknown>;
type BrandCounts = {
  stores_count?: number;
  claims_count?: number;
  activated_count?: number;
  current_shard_supply?: number;
  free_shards_distributed?: number;
};

const oldPrizeRow: Row = {
  bID: '7',
  symbol: 'BRAND7',
  name: 'Old Prize',
  description: 'old desc',
  url_image: 'https://img.example/7.png',
  points: '500',
  market_floor_points: '1000',
  gift_limit: '20',
  total_quantity: '20',
  free_shard_ratio: '10',
  time_start: '2026-01-01T00:00:00Z',
  time_end: '2026-12-31T00:00:00Z',
  time_created: '2026-01-01T00:00:00Z',
  time_updated: '2026-01-02T00:00:00Z',
  time_actived: '',
};

const fullCounts: BrandCounts = {
  stores_count: 3,
  claims_count: 5,
  activated_count: 2,
  current_shard_supply: 1000,
  free_shards_distributed: 200,
};

const zeroCounts: BrandCounts = {
  stores_count: 0,
  claims_count: 0,
  activated_count: 0,
  current_shard_supply: 0,
  free_shards_distributed: 0,
};

const newListingRow: Row = {
  listing_id: 7,
  seller_uid: 2,
  cid: 1,
  price: 500,
  stock: 10,
  title: 'Listing T',
  description: 'listing desc',
  media_urls: [],
  status: 'listed',
  create_key: 'k7',
  ledger_event_keys: [],
  time_created: '2026-01-01T00:00:00Z',
  time_updated: '2026-01-02T00:00:00Z',
};

const oldPrizeItemRow: Row = {
  gID: '1',
  bID: '7',
  uID: '3',
  time_created: '2026-01-01T00:00:00Z',
  time_claimed: '',
  time_actived: '',
};

const newAliasedOrderRow: Row = {
  gID: 11,
  bID: 7,
  uID: 3,
  time_created: '2026-01-01T00:00:00Z',
  time_claimed: null,
  time_actived: null,
};

const rawListingOrderRow: Row = {
  order_id: 11,
  listing_id: 7,
  buyer_uid: 3,
  seller_uid: 2,
  cid: 1,
  price: 500,
  quantity: 1,
  status: 'paid',
  create_key: 'o11',
  pay_txid: 91,
  refund_txid: null,
  ledger_event_keys: [],
  time_created: '2026-01-01T00:00:00Z',
  time_updated: '2026-01-01T00:00:00Z',
};

const brandCases: Array<{ name: string; row: Row; counts?: BrandCounts }> = [
  { name: 'brand:empty_row', row: {} },
  { name: 'brand:old_prize_row_full+counts', row: oldPrizeRow, counts: fullCounts },
  { name: 'brand:old_prize_row_no_counts', row: oldPrizeRow },
  { name: 'brand:new_listing_row+zero_counts', row: newListingRow, counts: zeroCounts },
];

const itemCases: Array<{ name: string; row: Row }> = [
  { name: 'prize_item:empty_row', row: {} },
  { name: 'prize_item:old_prize_item_row', row: oldPrizeItemRow },
  { name: 'prize_item:new_listing_order_aliased_row', row: newAliasedOrderRow },
  { name: 'prize_item:raw_listing_order_row', row: rawListingOrderRow },
];

const keysOf = (o: Record<string, unknown>) => Object.keys(o).sort();

const results: Array<Record<string, unknown>> = [];
let allEqual = true;

for (const c of brandCases) {
  const pre = keysOf(brandHEAD(c.row, c.counts) as Record<string, unknown>);
  const post = keysOf(brandNEW(c.row, c.counts) as Record<string, unknown>);
  const equal = JSON.stringify(pre) === JSON.stringify(post);
  if (!equal) allEqual = false;
  results.push({ case: c.name, equal, keys_pre: pre, keys_post: post });
}

for (const c of itemCases) {
  const pre = keysOf(itemHEAD(c.row) as Record<string, unknown>);
  const post = keysOf(itemNEW(c.row) as Record<string, unknown>);
  const equal = JSON.stringify(pre) === JSON.stringify(post);
  if (!equal) allEqual = false;
  results.push({ case: c.name, equal, keys_pre: pre, keys_post: post });
}

const out = {
  generated_at: new Date().toISOString(),
  caliber: 'in-memory fixtures; ZERO DB access / ZERO writes; key-SET comparison only (values may differ by design)',
  mappers: ['normalizeBrand (listBrands/getBrandById)', 'normalizePrizeItem (listPrizeItemsByUser)'],
  all_key_sets_equal: allEqual,
  total: results.length,
  equal_count: results.filter((r) => r.equal).length,
  results,
};

console.log(JSON.stringify(out, null, 2));
if (!allEqual) {
  process.exit(1);
}
