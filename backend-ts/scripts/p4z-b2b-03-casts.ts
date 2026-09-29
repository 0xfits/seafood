// p4z-b2b-03-casts.ts — P4-B2b 补丁：给 P1 写路径的**可空参数**加显式类型转换
// 根因（实测）：`updateListingRow` 的 `$3 IS NOT NULL` / `$3 IS DISTINCT FROM cur.stock` 上下文
// **无法为参数定型** ⇒ `NeonDbError: could not determine data type of parameter $3`（探针 verbs 首次实测）。
// 口径：只加 `::int/::bigint/::text/::text[]`，**不改**语义、不改 SQL 结构；每条替换断言命中数，不符即中止。
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const root = path.join(__dirname, '..');
const outDir = process.argv[2] || path.join(root, '.p4-artifacts', 'b2b-unknown');
const file = path.join(root, 'src', 'database.ts');
const src = fs.readFileSync(file, 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const PAIRS: Array<[string, string, number]> = [
  ['WHERE c.cid = ${cid}', 'WHERE c.cid = ${cid}::bigint', 1],
  ['WHERE create_key = ${input.createKey}', 'WHERE create_key = ${input.createKey}::text', 1],
  [
    "SELECT ${input.sellerUid}, ${input.cid}, ${input.price}, ${input.stock}, ${input.title}, ${input.description}, ${input.mediaUrls}::text[], 'draft', ${input.createKey}",
    "SELECT ${input.sellerUid}::bigint, ${input.cid}::bigint, ${input.price}::bigint, ${input.stock}::int, ${input.title}::text, ${input.description}::text, ${input.mediaUrls}::text[], 'draft', ${input.createKey}::text",
    1,
  ],
  ['WHEN cur.seller_uid <> ${input.actorUid} THEN', 'WHEN cur.seller_uid <> ${input.actorUid}::bigint THEN', 1],
  [
    'WHEN ${input.stock} IS NOT NULL AND ${input.stock} IS DISTINCT FROM cur.stock',
    'WHEN ${input.stock}::int IS NOT NULL AND ${input.stock}::int IS DISTINCT FROM cur.stock',
    1,
  ],
  ['COALESCE(${input.price}, l.price)', 'COALESCE(${input.price}::bigint, l.price)', 1],
  ['COALESCE(${input.stock}, l.stock)', 'COALESCE(${input.stock}::int, l.stock)', 1],
  ['COALESCE(${input.title}, l.title)', 'COALESCE(${input.title}::text, l.title)', 1],
  ['COALESCE(${input.description}, l.description)', 'COALESCE(${input.description}::text, l.description)', 1],
  ['WHERE listing_id = ${input.listingId}', 'WHERE listing_id = ${input.listingId}::bigint', 1],
  ['WHERE l.listing_id = ${input.listingId}', 'WHERE l.listing_id = ${input.listingId}::bigint', 1],
  ['WHEN cur.seller_uid <> ${actorUid} THEN', 'WHEN cur.seller_uid <> ${actorUid}::bigint THEN', 1],
  ['public.listing_status_transition_ok(cur.status, ${toStatus})', 'public.listing_status_transition_ok(cur.status, ${toStatus}::text)', 1],
  ['SET status = ${toStatus}', 'SET status = ${toStatus}::text', 1],
  ['WHERE listing_id = ${listingId}', 'WHERE listing_id = ${listingId}::bigint', 1],
  ['WHERE l.listing_id = ${listingId}', 'WHERE l.listing_id = ${listingId}::bigint', 1],
];

const log: Array<Record<string, unknown>> = [];
let out = src;
for (const [find, repl, expect] of PAIRS) {
  const hits = out.split(find).length - 1;
  if (hits !== expect) throw new Error(`命中数 ${hits} ≠ ${expect}：${find}`);
  out = out.split(find).join(repl);
  log.push({ find, hits, ok: true });
}
const remaining = (out.match(/IS NOT NULL AND/g) || []).length;
fs.writeFileSync(file, out);
fs.writeFileSync(path.join(outDir, 'casts-log.json'), JSON.stringify({
  generated_at: new Date().toISOString(), file: 'src/database.ts', before_sha: sha(src), after_sha: sha(out), replacements: log, stock_guard_occurrences: remaining,
}, null, 2));
console.log('CASTS_OK ' + JSON.stringify({ before_sha: sha(src), after_sha: sha(out), n: log.length, bytes: out.length }));
