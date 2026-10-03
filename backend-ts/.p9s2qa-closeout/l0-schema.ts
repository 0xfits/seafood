/**
 * P9② QA 收尾单 · L0 现取（活体四表/约束/索引/触发器 · kind 闭集 21 · 白名单）— 只读
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2qa-closeout/l0-schema.ts
 */
import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const out: Record<string, unknown> = {};
  const q = async (t: string, p?: unknown[]) => readQuery<Record<string, unknown>>(t, p);

  out.tables_cols = await q(`SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS cols
    FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log')
    GROUP BY table_name ORDER BY table_name`);
  out.constraints = await q(`SELECT conrelid::regclass::text AS tbl, conname, contype, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid IN ('public.batt_account'::regclass,'public.batt_entry'::regclass,
      'public.checkin_log'::regclass,'public.checkin_makeup_log'::regclass)
    AND contype IN ('c','u','p','f') ORDER BY tbl, contype, conname`);
  out.indexes = await q(`SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public'
    AND tablename IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY 1,2`);
  out.triggers = await q(`SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND c.relname IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY 1,2`);
  const kd = (await q(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum' AND contype='c'`))[0]?.def as string;
  const vals = (kd.match(/'([a-z_]+)'::text/g) || []).map((s) => s.replace(/'([a-z_]+)'.*/, '$1'));
  out.kind_enum = { def: kd, n: vals.length, has_new: vals.includes('checkin_makeup_fee'), last: vals[vals.length - 1] };
  out.kind_ok = await q(`SELECT position('checkin_makeup_fee' in prosrc) > 0 AS has_new, length(prosrc)::int AS src_len
    FROM pg_proc WHERE proname='ledger_kind_ok' AND pronargs=2`);
  out.plat = await q(`SELECT position('checkin_makeup_fee' in prosrc) > 0 AS has_new FROM pg_proc WHERE proname='ledger_assert_platform_mutation'`);
  out.regclass = await q(`SELECT to_regclass('public.batt_account')::text a, to_regclass('public.batt_entry')::text b,
    to_regclass('public.checkin_log')::text c, to_regclass('public.checkin_makeup_log')::text d`);
  out.schema = await q(`SELECT max(version) AS maxv, count(*)::int AS rows FROM public.schema_migration`);
  out.base_tables = await q(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);

  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch((e) => { console.error('L0_FAIL', String((e as Error)?.message || e).slice(0, 300)); process.exit(1); });
