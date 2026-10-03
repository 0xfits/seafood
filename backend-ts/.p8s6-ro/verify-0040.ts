// 只读复验：0040 补发（基线 / 后态通用）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  const out: Record<string, unknown> = {};

  out.schema = await q(`select count(*)::int as rows, max(version) as max_version from public.schema_migration`);
  out.schema_0040 = await q(`select version, name, left(checksum,12) as ck, applied_at::text from public.schema_migration where version='0040'`);
  out.mig_versions_tail = await q(`select version from public.schema_migration order by version desc limit 4`);

  out.batt_account_count = await q(`select count(*)::int as n from public.batt_account`);
  out.batt_entry_count = await q(`select count(*)::int as n from public.batt_entry`);
  out.batt_entry_by_reason = await q(`select reason, count(*)::int as n, sum(delta)::int as sum_delta from public.batt_entry group by reason order by reason`);
  out.batt_backfill = await q(`select count(*)::int as n, count(distinct uid)::int as uniq_uid, min(delta)::int as min_d, max(delta)::int as max_d, count(distinct batt_after)::int as distinct_after
                               from public.batt_entry where idempotency_key like 'biz:backfill:invite-signup:%'`);
  out.dup_keys = await q(`select count(*)::int as dup_keys from (select idempotency_key from public.batt_entry group by idempotency_key having count(*)>1) x`);

  // ★ Kevin 的账号
  out.kevin = await q(`select a.uid, a.batt, a.time_updated::text from public.batt_account a join public.users u on u.uid=a.uid where u.evm ilike '%09b0'`);
  out.kevin_entries = await q(`select e.txid, e.delta, e.batt_after, e.reason, e.idempotency_key, e.memo from public.batt_entry e join public.users u on u.uid=e.uid where u.evm ilike '%09b0' order by e.txid`);
  out.kevin_uid_batt_raw = await q(`select uid, batt from public.batt_account where uid = (select uid from public.users where evm ilike '%09b0')`);

  // 目标集合剩余
  out.remaining_target = await q(`select count(*)::int as n from public.users u
        where not exists (select 1 from public.batt_account a where a.uid=u.uid)
          and not exists (select 1 from public.batt_entry e where e.uid=u.uid and e.reason='invite_signup')`);
  out.users_total = await q(`select count(*)::int as n from public.users`);
  out.batt_range_check = await q(`select count(*)::int as out_of_range from public.batt_account where batt < 0 or batt > 100`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
