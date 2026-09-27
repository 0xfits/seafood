/**
 * R3-P2b 汇总读数（只读）：测试数据分区清点 + schema_migration 对照 + 相容性复核
 */
import * as dotenv from 'dotenv'; import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';
(async () => {
  const p = new Pool({ connectionString: URL, max: 1 });
  const q = async (s: string) => (await p.query(s)).rows;
  const out: Record<string, unknown> = {};
  out.p1q_currencies = await q(`SELECT cid::text, symbol, owner_uid::text, decimals, status FROM currency WHERE symbol LIKE 'p1q%'`);
  out.p1q_ledger_rows = await q(`SELECT idempotency_key, count(*)::text n FROM ledger_entry WHERE event_root_key IS NOT NULL AND event_root_key LIKE 'ops:p1q:%' GROUP BY 1 ORDER BY 1`);
  out.p1q_rows_total = await q(`SELECT count(*)::text n FROM ledger_entry WHERE cid IN (SELECT cid FROM currency WHERE symbol LIKE 'p1q%')`);
  out.referral_rows = await q(`SELECT child_uid::text, parent_uid::text, depth::text, bound_at::text FROM referral ORDER BY child_uid`);
  out.policy_rows = await q(`SELECT policy_id::text, fee_rate_bp, levels, weights_bp::text, created_by::text FROM commission_policy`);
  out.ledger_total = await q(`SELECT count(*)::text n FROM ledger_entry`);
  out.compat_after = await q(`SELECT count(*)::text n FROM (SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) k FROM ledger_entry GROUP BY 1
      HAVING COALESCE(sum(delta) FILTER (WHERE uid=-2 AND kind='job_fee'),0) <> 0 AND count(*) FILTER (WHERE kind='commission') = 0
         AND COALESCE(event_root_key, split_part(idempotency_key,'#',1)) NOT LIKE 'ops:p1q:%') s`);
  out.schema_migration = await q(`SELECT version, name, left(checksum,12) AS checksum12, applied_at::text FROM schema_migration ORDER BY version`);
  out.trigger_count = await q(`SELECT c.relname, count(*)::text n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE NOT t.tgisinternal AND c.relname IN ('referral','commission_policy','ledger_entry') GROUP BY 1 ORDER BY 1`);
  console.log(JSON.stringify(out, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
