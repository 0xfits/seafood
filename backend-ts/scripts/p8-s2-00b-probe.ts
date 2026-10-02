/** 8② 现取探针 2（只读）：referral 链 / job 列 / ledger_entry 列 / job_settle_plan 可调用性。 */
import '../src/env';
import { readQuery } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  out.referral_sample = await readQuery(
    `SELECT child_uid::text AS child_uid, parent_uid::text AS parent_uid FROM referral ORDER BY child_uid LIMIT 12`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  out.referral_count = await readQuery(`SELECT count(*)::int AS n FROM referral`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  out.chain_len = await readQuery(
    `WITH RECURSIVE up AS (
       SELECT r.child_uid AS start, r.parent_uid AS cur, 1 AS lvl FROM referral r
       UNION ALL SELECT up.start, r.parent_uid, up.lvl+1 FROM referral r JOIN up ON r.child_uid=up.cur WHERE up.lvl<10)
     SELECT start::text AS worker, max(lvl)::int AS depth FROM up GROUP BY start ORDER BY depth DESC LIMIT 8`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  out.job_cols = await readQuery(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='job' ORDER BY ordinal_position`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  out.ledger_cols = await readQuery(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ledger_entry' ORDER BY ordinal_position`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  out.jobs = await readQuery(`SELECT * FROM job ORDER BY job_id DESC LIMIT 6`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  out.ledger_settle = await readQuery(
    `SELECT event_root_key, kind, uid::text AS uid, delta::text AS delta, frozen_delta::text AS fd
       FROM ledger_entry WHERE kind IN ('job_fee','commission','job_payout') ORDER BY entry_id DESC LIMIT 12`).catch((e) => `ERR:${String(e).slice(0,150)}`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error('PROBE_FAIL', String(e).slice(0, 300)); process.exit(1); });
