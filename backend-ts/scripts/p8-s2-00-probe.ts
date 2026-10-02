/**
 * 8② 现取探针（只读）：commission_policy 现行行 / 列类型 / CHECK / 最近 job 与 ledger。
 * 只打印结构 / 计数 / 机读字段，不打印任何密钥 / 连接串。
 */
import '../src/env';
import { readQuery } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  out.policy_cols = await readQuery(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns WHERE table_name='commission_policy' ORDER BY ordinal_position`);
  out.policy_rows = await readQuery(
    `SELECT policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS weights_bp,
            effective_from::text AS effective_from, created_by::text AS created_by,
            time_created::text AS time_created
       FROM commission_policy ORDER BY effective_from DESC`);
  out.policy_count = await readQuery(`SELECT count(*)::int AS n FROM commission_policy`);
  out.current = await readQuery(
    `SELECT policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS weights_bp,
            effective_from::text AS effective_from
       FROM commission_policy WHERE effective_from <= now() ORDER BY effective_from DESC LIMIT 1`);
  out.constraints = await readQuery(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'commission_policy'::regclass ORDER BY conname`);
  out.triggers = await readQuery(
    `SELECT tgname FROM pg_trigger WHERE tgrelid='commission_policy'::regclass AND NOT tgisinternal`);
  out.jobs_recent = await readQuery(
    `SELECT job_id::text AS job_id, status, gross_amount::text AS gross, created_at::text AS created_at
       FROM job WHERE status IN ('settled','completed') ORDER BY created_at DESC LIMIT 5`).catch((e) => `ERR:${String(e).slice(0,120)}`);
  out.ledger_roots = await readQuery(
    `SELECT event_root_key, count(*)::int AS n FROM ledger_entry
      WHERE event_root_key LIKE 'biz:job:settle:%' GROUP BY event_root_key ORDER BY max(created_at) DESC LIMIT 5`).catch((e) => `ERR:${String(e).slice(0,120)}`);
  out.switch = await readQuery(`SELECT current_database() AS db, current_user AS usr`).catch((e) => `ERR:${String(e).slice(0,120)}`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error('PROBE_FAIL', String(e).slice(0, 300)); process.exit(1); });
