// QA AC3 判负臂：插 1 条 rating（卖家 970101 · 5.0 星），并验 append-only 闸真拦直删
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql, dbIdentity } from './db.mjs';

const idem = `feqa20261019:${randomUUID()}`;
const RATEE = 970101;   // 该卖家 12 件商品（dev 现取）
const RATER = 1;        // 既有 users 行（≠ ratee）
const TARGET = 12;      // ratee 自己的 listing

const ident = await dbIdentity();
const before = (await sql`SELECT count(*)::int AS n FROM public.rating`)[0].n;

const ins = await sql`
  INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars, idempotency_key, request_fingerprint, memo)
  VALUES (${RATER}, ${RATEE}, 'listing', ${TARGET}, 'customer_to_vendor', 5.0, ${idem}, ${'feqa:' + TARGET}, 'FEED-RANK-v1 QA 判负臂夹具（质检自建，用后回收）')
  RETURNING rating_id, rater_uid, ratee_uid, target_type, target_id, direction, stars::text, idempotency_key, time_created
`;
const after = (await sql`SELECT count(*)::int AS n FROM public.rating`)[0].n;

// append-only 闸自证：直接 DELETE 必须被拒（P0001）
let directDelete;
try {
  await sql`DELETE FROM public.rating WHERE rating_id = ${ins[0].rating_id}`;
  directDelete = { blocked: false, note: 'UNEXPECTED: direct delete succeeded' };
} catch (e) {
  directDelete = { blocked: true, code: e.code || null, message: String(e.message || e).slice(0, 200) };
}
const afterBlockedTry = (await sql`SELECT count(*)::int AS n FROM public.rating`)[0].n;

const out = {
  taken_at: new Date().toISOString(),
  db: ident,
  idempotency_key: idem,
  ratee_uid: RATEE,
  rater_uid: RATER,
  target: { type: 'listing', id: TARGET },
  stars: 5.0,
  rating_count_before: before,
  rating_count_after_insert: after,
  inserted_row: { ...ins[0], time_created: new Date(ins[0].time_created).toISOString() },
  direct_delete_attempt: directDelete,
  rating_count_after_blocked_delete: afterBlockedTry,
};
fs.writeFileSync('ops/feed-ranking/qa/readings/arm-insert.json', JSON.stringify(out, null, 2));

// 夹具绑定写死，供 cleanup 用（cleanup 只删 idempotency_key 前缀为本单标记的行）
fs.writeFileSync('ops/feed-ranking/qa/readings/arm-fixture.json', JSON.stringify({ idempotency_key: idem, rating_id: Number(ins[0].rating_id) }, null, 2));

console.log(JSON.stringify(out, null, 1));
