// QA 独立 API 探针：确定性 / 顺序 vs oracle / 键集 / 分页语义
import fs from 'node:fs';

const BASE = process.env.SF_API || 'http://localhost:5788';
const tag = process.argv[2] || 'baseline';
const oracleFile = process.argv[3] || 'ops/feed-ranking/qa/readings/oracle-baseline.json';
const oracle = JSON.parse(fs.readFileSync(oracleFile, 'utf8')).rows.map((r) => r.id);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  const t0 = Date.now();
  const res = await fetch(BASE + path);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { path, status: res.status, ms: Date.now() - t0, json, bytes: Buffer.byteLength(text) };
}

const home1 = await get('/api/home');
await sleep(1100);
const home2 = await get('/api/home');
const all60a = await get('/api/prize/all?limit=60');
await sleep(1100);
const all60b = await get('/api/prize/all?limit=60');
const p1 = await get('/api/prize/all?skip=0&limit=8');
const p2 = await get('/api/prize/all?skip=8&limit=8');
const one = await get('/api/prize/all?skip=0&limit=1');

const ids = (r) => (r.json?.data?.prizes || r.json?.data || []).map((x) => Number(x.bID));
const h1 = ids(home1), h2 = ids(home2), a1 = ids(all60a), a2 = ids(all60b);
const i1 = ids(p1), i2 = ids(p2), i1one = ids(one);

const rows = all60a.json?.data || all60a.json?.data?.prizes || [];
const keySets = rows.map((r) => Object.keys(r).sort());
const keyCounts = [...new Set(keySets.map((k) => k.length))];
const anyScoreKey = keySets.some((k) => k.includes('score'));
const refKeys = keySets[0] || [];

const firstOfAll = a1[0];
const overlap = i1.filter((x) => i2.includes(x));
const union = [...new Set([...i1, ...i2])];
const dupWithinPage = i1.length !== new Set(i1).size || i2.length !== new Set(i2).size;

const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);

const result = {
  taken_at: new Date().toISOString(),
  base: BASE,
  oracle_file: oracleFile,
  oracle_count: oracle.length,
  http: {
    home1: { status: home1.status, ms: home1.ms, bytes: home1.bytes, n: h1.length },
    home2: { status: home2.status, ms: home2.ms, bytes: home2.bytes, n: h2.length },
    all60a: { status: all60a.status, ms: all60a.ms, bytes: all60a.bytes, n: a1.length },
    all60b: { status: all60b.status, ms: all60b.ms, bytes: all60b.bytes, n: a2.length },
    page1: { status: p1.status, n: i1.length },
    page2: { status: p2.status, n: i2.length },
    one: { status: one.status, n: i1one.length },
  },
  home_first: { id: h1[0], title: (home1.json?.data?.prizes || [])[0]?.name },
  home_ids: h1,
  home_ids_2: h2,
  all60_ids: a1,
  all60_ids_2: a2,
  oracle_ids: oracle,
  checks: {
    home_first_is_newest_listing_76: h1[0] === 76,
    home_deterministic_two_calls: eq(h1, h2),
    all60_deterministic_two_calls: eq(a1, a2),
    home_matches_oracle_exactly: eq(h1, oracle.slice(0, h1.length)),
    all60_matches_oracle_exactly: eq(a1, oracle),
    home_equals_first8_of_all60: eq(h1, a1.slice(0, 8)) && h1.length === 8,
    all60_first_is_newest: firstOfAll === 76,
    all60_count_equals_oracle_count: a1.length === oracle.length,
    score_not_in_response_rows: !anyScoreKey,
    row_key_count: keyCounts,
    row_key_count_is_45: keyCounts.length === 1 && keyCounts[0] === 45,
    row_keys: refKeys,
    pagination_disjoint: overlap.length === 0,
    pagination_union_16: union.length === 16,
    pagination_no_dup_within_page: !dupWithinPage,
    limit1_equals_full_order_head: i1one.length === 1 && i1one[0] === oracle[0],
  },
  pagination: {
    skip0_limit8: i1,
    skip8_limit8: i2,
    overlap,
    union_count: union.length,
    limit1: i1one,
  },
};

const allPass = [
  'home_first_is_newest_listing_76',
  'home_deterministic_two_calls',
  'all60_deterministic_two_calls',
  'home_matches_oracle_exactly',
  'all60_matches_oracle_exactly',
  'home_equals_first8_of_all60',
  'all60_first_is_newest',
  'all60_count_equals_oracle_count',
  'score_not_in_response_rows',
  'row_key_count_is_45',
  'pagination_disjoint',
  'pagination_union_16',
  'pagination_no_dup_within_page',
  'limit1_equals_full_order_head',
].every((k) => result.checks[k] === true);
result.verdict = allPass ? 'PASS' : 'FAIL';

const out = `ops/feed-ranking/qa/readings/api-${tag}.json`;
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log('->', out, result.verdict);
console.log('home ids', h1.join(','));
console.log('all60 ids', a1.join(','));
console.log('oracle   ', oracle.join(','));
console.log('checks', JSON.stringify(result.checks, null, 1));
