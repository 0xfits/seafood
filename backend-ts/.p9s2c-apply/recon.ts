// P9② 库面收口单 · 只读 recon（不写任何数据）
import '../src/env';
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  const q = async (t: string, p?: unknown[]) => readQuery<Record<string, unknown>>(t, p);

  out.schema = await q(`SELECT max(version) AS max_version, count(*)::int AS rows FROM public.schema_migration`);
  out.base_tables = await q(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  out.new_tables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY 1`);
  out.kind_enum = await q(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`);
  out.kind_ok = await q(`SELECT position('checkin_makeup_fee' in prosrc)>0 AS has_new, length(prosrc)::int AS src_len FROM pg_proc WHERE proname='ledger_kind_ok' AND pronargs=2`);
  out.plat = await q(`SELECT position('checkin_makeup_fee' in prosrc)>0 AS has_new FROM pg_proc WHERE proname='ledger_assert_platform_mutation'`);
  out.triggers = await q(`SELECT event_object_table AS tbl, trigger_name FROM information_schema.triggers WHERE trigger_schema='public' AND event_object_table IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY 1,2`);
  out.app_config_keys = await q(`SELECT key FROM public.app_config ORDER BY 1`);
  out.counts = await q(`SELECT (SELECT count(*)::int FROM public.batt_account) AS batt_account, (SELECT count(*)::int FROM public.batt_entry) AS batt_entry, (SELECT count(*)::int FROM public.checkin_log) AS checkin_log, (SELECT count(*)::int FROM public.checkin_makeup_log) AS makeup_log`);
  out.streak_ck = await q(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.checkin_log'::regclass AND conname='checkin_log_streak_rng'`);
  out.day = await q(`SELECT (now() AT TIME ZONE 'UTC')::date::text AS utc_day, now()::date::text AS dbtz_day, current_setting('TimeZone') AS tz, now() AT TIME ZONE 'UTC' AS utc_now`);
  out.cid1_supply = await q(`SELECT total_supply::text AS total_supply FROM public.currency WHERE cid=1`);
  out.funded = await q(`SELECT a.uid::text AS uid, a.balance::text AS bal FROM public.account a WHERE a.cid=1 AND a.balance >= 100 AND a.uid > 0 ORDER BY a.uid LIMIT 8`);
  out.poor = await q(`SELECT a.uid::text AS uid, a.balance::text AS bal FROM public.account a WHERE a.cid=1 AND a.balance < 100 AND a.uid > 0 ORDER BY a.uid LIMIT 5`);
  out.open_jobs = await q(`SELECT j.job_id::text AS job_id, j.employer_uid::text AS employer_uid, j.status FROM public.job j WHERE j.status='open' ORDER BY j.job_id LIMIT 5`);
  out.users_n = await q(`SELECT count(*)::int AS n FROM public.users WHERE uid > 0`);
  out.mk_cids = await q(`SELECT count(*)::int AS n FROM public.currency WHERE cid=1`);

  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch((e) => { console.error('RECON_FAIL', String((e as Error)?.message || e).slice(0, 300)); process.exit(1); });
