import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const out: Record<string, unknown> = {};
  const q = async (t: string, p?: unknown[]) => readQuery<Record<string, unknown>>(t, p);
  out.schema = await q(`SELECT max(version) AS maxv, count(*)::int AS rows FROM public.schema_migration`);
  out.app_config_cols = await q(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='app_config' ORDER BY ordinal_position`);
  out.app_config_pk = await q(`SELECT c.conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conrelid='public.app_config'::regclass AND c.contype IN ('p','u')`);
  out.app_config_keys = await q(`SELECT key FROM public.app_config ORDER BY 1`);
  out.batt_rows = await q(`SELECT count(*)::int AS n FROM public.batt_account`);
  out.checkin_rows = await q(`SELECT count(*)::int AS n FROM public.checkin_log`);
  out.users_min = await q(`SELECT uid::text FROM public.users WHERE uid IN (2,4,6) ORDER BY uid`);
  out.tables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY 1`);
  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch((e) => { console.error('SMOKE_FAIL', String((e as Error)?.message || e).slice(0,300)); process.exit(1); });
