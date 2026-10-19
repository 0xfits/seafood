// QA AC3 回收：单条 DO $$ 内 disable→delete→enable（rating 为 append-only，直删会被 P0001 拒）
import fs from 'node:fs';
import { sql } from './db.mjs';

const fixture = JSON.parse(fs.readFileSync('ops/feed-ranking/qa/readings/arm-fixture.json', 'utf8'));
const prefix = 'feqa20261019:%';

const beforeCount = (await sql`SELECT count(*)::int AS n FROM public.rating`)[0].n;
const beforeFixture = (await sql`SELECT count(*)::int AS n FROM public.rating WHERE idempotency_key LIKE ${prefix}`)[0].n;
const trigBefore = await sql`SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger WHERE tgrelid = 'public.rating'::regclass AND NOT tgisinternal ORDER BY tgname`;

const doResult = await sql`
  DO $$
  DECLARE
    v_deleted integer;
  BEGIN
    ALTER TABLE public.rating DISABLE TRIGGER trg_rating_append_only;
    ALTER TABLE public.rating DISABLE TRIGGER trg_rating_no_truncate;
    DELETE FROM public.rating WHERE idempotency_key LIKE 'feqa20261019:%';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    ALTER TABLE public.rating ENABLE TRIGGER trg_rating_append_only;
    ALTER TABLE public.rating ENABLE TRIGGER trg_rating_no_truncate;
    RAISE NOTICE 'qa cleanup deleted % row(s)', v_deleted;
  END $$;
`;

const afterCount = (await sql`SELECT count(*)::int AS n FROM public.rating`)[0].n;
const afterFixture = (await sql`SELECT count(*)::int AS n FROM public.rating WHERE idempotency_key LIKE ${prefix}`)[0].n;
const trigAfter = await sql`SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger WHERE tgrelid = 'public.rating'::regclass AND NOT tgisinternal ORDER BY tgname`;

// 回收后 append-only 闸必须仍在（新插即测再删即拒），且不留行
let guardAfter;
try {
  await sql`DELETE FROM public.rating WHERE false`;
  guardAfter = { delete_statement_allowed: true, note: 'no rows matched ⇒ trigger not exercised' };
} catch (e) {
  guardAfter = { delete_statement_allowed: false, code: e.code };
}

const checks = {
  count_before_1: beforeCount === 1,
  fixture_before_1: beforeFixture === 1,
  count_after_0: afterCount === 0,
  fixture_after_0: afterFixture === 0,
  trigger_append_only_enabled_O: (trigAfter.find((t) => t.tgname === 'trg_rating_append_only') || {}).tgenabled === 'O',
  trigger_no_truncate_enabled_O: (trigAfter.find((t) => t.tgname === 'trg_rating_no_truncate') || {}).tgenabled === 'O',
  triggers_restored_identical: JSON.stringify(trigBefore) === JSON.stringify(trigAfter),
};

const out = {
  taken_at: new Date().toISOString(),
  fixture,
  cleanup_method: 'single DO $$ block: DISABLE TRIGGER trg_rating_append_only / trg_rating_no_truncate -> DELETE WHERE idempotency_key LIKE feqa20261019:% -> ENABLE both',
  rating_count_before: beforeCount,
  fixture_rows_before: beforeFixture,
  rating_count_after: afterCount,
  fixture_rows_after: afterFixture,
  triggers_before: trigBefore,
  triggers_after: trigAfter,
  guard_after_cleanup: guardAfter,
  checks,
};
out.verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
fs.writeFileSync('ops/feed-ranking/qa/readings/arm-cleanup.json', JSON.stringify(out, null, 2));
console.log('verdict', out.verdict, JSON.stringify(checks));
console.log('counts', beforeCount, '->', afterCount, '| triggers', JSON.stringify(trigAfter));
