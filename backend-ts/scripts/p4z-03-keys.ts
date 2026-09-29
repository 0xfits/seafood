// p4z-03-keys.ts — P4-B1-a key-contract fixture. Zero-dependency, in-memory, NO DB writes, no DB reads.
// Feeds identical synthetic rows to the PRE-change mappers (HEAD snapshot) and the POST-change mappers
// (working tree copy) and asserts the returned KEY SETS are identical per case (values may differ).
// Usage: ts-node --transpile-only scripts/p4z-03-keys.ts <outJson> <preDir> <postDir>
import * as fs from 'fs';
import * as path from 'path';

const [, , outPath, preDir, postDir] = process.argv;

/* eslint-disable @typescript-eslint/no-var-requires */
const HEAD = require(path.resolve(preDir, 'database.HEAD.ts'));
const NEW = require(path.resolve(postDir, 'database.NEW.ts'));

const keys = (v: unknown) => Object.keys(v as Record<string, unknown>).sort();

type Case = { name: string; fn: (m: { normalizeAsset: any; normalizeTask: any; normalizeBrand: any }) => Record<string, unknown> };

const accountRow = {
  uid: 1, cid: 1, balance: 0, frozen: 0, version: 0,
  time_created: '2026-01-01T00:00:00Z', time_updated: '2026-01-02T00:00:00Z',
};
const legacyAssetRow = { index_id: 3, uID: 9, points: 120, lucks: 4, time_updated: '2026-01-03T00:00:00Z' };
const taskRow = {
  tID: 1, title: 't', note: 'n', refcode: 'r', link0: 'a', linkA: 'b', linkB: 'c', points: 10, type: 1,
  time_start: 0, time_end: 0, time_created: 0, time_updated: 0, is_open: true, participants_count: 2,
};
const brandRow = {
  bID: 5, symbol: 'S', name: 'N', description: 'D', image_url: 'i', url_image: 'i2', points: 3,
  market_floor_points: 1, gift_limit: 2, total_quantity: 4, free_shard_ratio: 5,
  time_start: 0, time_end: 0, time_created: 0, time_updated: 0, time_actived: 0,
};
const brandCounts = { stores_count: 1, claims_count: 2, activated_count: 1, current_shard_supply: 7, free_shards_distributed: 0 };

const CASES: Case[] = [
  { name: 'asset:empty_row', fn: (m) => m.normalizeAsset({}) },
  { name: 'asset:legacy_asset_row', fn: (m) => m.normalizeAsset(legacyAssetRow) },
  { name: 'asset:account_row', fn: (m) => m.normalizeAsset(accountRow) },
  { name: 'asset:no_keys_at_all', fn: (m) => m.normalizeAsset({ noise: 1 }) },
  { name: 'user:empty_row', fn: (m) => m.normalizeUser({}) },
  { name: 'task:empty_row', fn: (m) => m.normalizeTask({}, 0) },
  { name: 'task:full_row', fn: (m) => m.normalizeTask(taskRow, 2) },
  { name: 'brand:empty_row', fn: (m) => m.normalizeBrand({}) },
  { name: 'brand:full_row+counts', fn: (m) => m.normalizeBrand(brandRow, brandCounts) },
  { name: 'brand:full_row_no_counts', fn: (m) => m.normalizeBrand(brandRow) },
];

let allEqual = true;
const results = CASES.map((c) => {
  const oldKeys = keys(c.fn(HEAD));
  const newKeys = keys(c.fn(NEW));
  const equal = JSON.stringify(oldKeys) === JSON.stringify(newKeys);
  if (!equal) allEqual = false;
  return {
    case: c.name,
    equal,
    old_keys: oldKeys,
    new_keys: newKeys,
    only_old: oldKeys.filter((k) => !newKeys.includes(k)),
    only_new: newKeys.filter((k) => !oldKeys.includes(k)),
  };
});

const out = {
  generated_at: new Date().toISOString(),
  caliber: 'zero-dependency in-memory fixture; mappers imported from HEAD snapshot vs working-tree snapshot; NO DB access (mappers are pure); keys compared, values not',
  pre_source: path.resolve(preDir, 'database.HEAD.ts'),
  post_source: path.resolve(postDir, 'database.NEW.ts'),
  all_key_sets_equal: allEqual,
  cases: results,
};
if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}
console.log(JSON.stringify({ all_key_sets_equal: allEqual, cases: results.map((r) => `${r.case}:${r.equal ? 'EQ' : 'DIFF'}`) }));
process.exit(allEqual ? 0 : 1);
