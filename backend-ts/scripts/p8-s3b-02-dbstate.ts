/**
 * 批 8③b 收口 · **只读**库面现状探针（触发器清单 + `app_config` 逐字节现状）。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s3b-02-dbstate.ts
 * 产物：stdout JSON（可用 > 重定向；**不打印**任何密钥 / 连接串 / token）。
 *
 * 目的（专供 8③b 收口「复原生产库基线」前置取证）：
 *   · 现取 `public.app_config` 上**每枚**触发器的 时机（BEFORE/AFTER/INSTEAD OF）
 *     + 事件（INSERT / UPDATE / DELETE / TRUNCATE）+ 函数名 + 是否 ENABLE；
 *   · 现取 `app_config` 全部行逐字节值（key / value_text / updated_by / time_updated / time_created）；
 *   · 现取该表 CHECK / 唯一约束清单。
 */
import '../src/env';
import { readQuery, withTransaction, txQuery, closePools } from '../src/db';
import { LISTING_DEPOSIT_POLICY_KEY, SYSTEM_SETTINGS_KEY } from '../src/database';

(async () => {
  const out: Record<string, unknown> = { unit: 'P8-S3B-DBSTATE', generated_at: new Date().toISOString() };

  out.triggers = await readQuery<Record<string, string>>(
    `SELECT t.tgname,
            CASE WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE'
                 WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
                 ELSE 'AFTER' END AS timing,
            CASE WHEN (t.tgtype & 4) <> 0 THEN 'INSERT' END AS ev_insert,
            CASE WHEN (t.tgtype & 16) <> 0 THEN 'UPDATE' END AS ev_update,
            CASE WHEN (t.tgtype & 8) <> 0 THEN 'DELETE' END AS ev_delete,
            CASE WHEN (t.tgtype & 32) <> 0 THEN 'TRUNCATE' END AS ev_truncate,
            (t.tgtype & 1) <> 0 AS for_each_row,
            p.proname,
            t.tgenabled
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public' AND c.relname = 'app_config' AND NOT t.tgisinternal
      ORDER BY t.tgname`);

  out.triggers_bootstrap = await readQuery<Record<string, string>>(
    `SELECT tgname, tgenabled, p.proname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public' AND c.relname = 'app_config' AND t.tgisinternal
      ORDER BY t.tgname`);

  out.columns = await readQuery<Record<string, string>>(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_config'
      ORDER BY ordinal_position`);

  out.constraints = await readQuery<Record<string, string>>(
    `SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'app_config'
      ORDER BY con.conname`);

  out.app_config_rows = await readQuery<Record<string, string>>(
    `SELECT key, value::text AS value_text, updated_by::text AS updated_by,
            time_updated::text AS time_updated
       FROM public.app_config ORDER BY key`);

  out.app_config_agg = await readQuery<Record<string, string>>(
    `SELECT count(*)::int::text AS n, max(time_updated)::text AS max_updated
       FROM public.app_config`);

  out.keys_present = {
    system_settings: (out.app_config_rows as Array<{ key: string }>).some((r) => r.key === SYSTEM_SETTINGS_KEY),
    listing_deposit_policy: (out.app_config_rows as Array<{ key: string }>).some((r) => r.key === LISTING_DEPOSIT_POLICY_KEY),
  };

  console.log(JSON.stringify(out, null, 1));
  await closePools();
  process.exit(0);
})().catch(async (e) => {
  console.error('PROBE_CRASHED', String((e as Error)?.stack || e).slice(0, 2000));
  await closePools().catch(() => undefined);
  process.exit(2);
});
