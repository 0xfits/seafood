/**
 * R3-P2b 探针 00：schema 侦察（只读）
 * 用途：写 0007/0008 前确认 users / ledger_entry / currency / account 的真实形状 +
 *       CR80 相容性对拍（是否存在「有 job_fee 入 -2 而无 commission」的历史/回归事件）
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';

(async () => {
  const pool = new Pool({ connectionString: URL, max: 2 });
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p as never[])).rows;
  const out: Record<string, unknown> = {};

  out.users_cols = await q(`SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`);
  out.users_constraints = await q(`SELECT conname, contype, pg_get_constraintdef(oid) def
      FROM pg_constraint WHERE conrelid='public.users'::regclass ORDER BY conname`);
  out.ledger_entry_cols = await q(`SELECT column_name, data_type, is_generated, generation_expression
      FROM information_schema.columns WHERE table_name='ledger_entry' ORDER BY ordinal_position`);
  out.ledger_entry_triggers = await q(`SELECT tgname, tgenabled, pg_get_triggerdef(oid) def
      FROM pg_trigger WHERE tgrelid='public.ledger_entry'::regclass AND NOT tgisinternal ORDER BY tgname`);
  out.currency_cols = await q(`SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name='currency' ORDER BY ordinal_position`);
  out.account_cols = await q(`SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='account' ORDER BY ordinal_position`);

  // ---- CR80 相容性对拍：按 event_root_key 聚合，找「入 -2 的 job_fee > 0 但没有 commission 行」的键族
  out.compat_jobfee_without_commission = await q(`
    SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) AS k,
           count(*) AS rows_n,
           count(*) FILTER (WHERE kind='commission') AS commission_rows,
           COALESCE(sum(delta) FILTER (WHERE uid=-2 AND kind='job_fee'),0) AS minus2_jobfee_in,
           COALESCE(-sum(delta) FILTER (WHERE uid=-2 AND kind='commission'),0) AS minus2_commission_out
      FROM ledger_entry GROUP BY 1
     HAVING COALESCE(sum(delta) FILTER (WHERE uid=-2 AND kind='job_fee'),0) <> 0
        AND count(*) FILTER (WHERE kind='commission') = 0
     ORDER BY 1 LIMIT 50`);
  out.compat_commission_events = await q(`
    SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) AS k,
           count(*) AS rows_n,
           count(*) FILTER (WHERE kind='commission') AS commission_rows,
           COALESCE(sum(delta) FILTER (WHERE uid=-2 AND kind='job_fee'),0) AS minus2_jobfee_in,
           COALESCE(-sum(delta) FILTER (WHERE uid=-2 AND kind='commission'),0) AS minus2_commission_out
      FROM ledger_entry GROUP BY 1 HAVING count(*) FILTER (WHERE kind='commission') > 0
     ORDER BY 1 LIMIT 50`);
  out.compat_jobfee_any = await q(`
    SELECT kind, uid, count(*) n, COALESCE(sum(delta),0) d FROM ledger_entry
     WHERE kind='job_fee' GROUP BY 1,2 ORDER BY 1,2`);
  out.ledger_entry_total = await q(`SELECT count(*) n FROM ledger_entry`);
  out.uid_buckets = await q(`SELECT uid, count(*) n FROM ledger_entry GROUP BY 1 ORDER BY 1`);
  out.currency_rows = await q(`SELECT cid, symbol, decimals, status FROM currency ORDER BY cid LIMIT 40`);
  out.users_count = await q(`SELECT count(*) n, min(uid) mn, max(uid) mx FROM users`);
  out.pg_version = await q(`SELECT version() v`);
  out.classifier_ld032 = await q(`SELECT ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH') AS state,
      ledger_error_for_sqlstate(ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH')) AS bucket_json`);

  console.log(JSON.stringify(out, null, 2));
  await pool.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
