/**
 * P3-L · 探针 env-info（只读）：夹具命名空间基座 + cid=1 供需守恒的「总量」来源定位。
 * 用法：P3L_RUN=<tag> npx ts-node --transpile-only scripts/p3l-env-info.ts
 */
import { mkPool, raw, raw1, save } from './p3l-lib';

(async () => {
  const pool = mkPool(1);
  try {
    const usersAgg = await raw1(pool,
      `SELECT count(*)::text AS n, min(uid)::text AS min_uid, max(uid)::text AS max_uid FROM public.users`);
    const window9903 = await raw(pool,
      `SELECT uid::text AS uid, evm, time_reg::text AS time_reg FROM public.users
        WHERE uid BETWEEN 990300 AND 990399 ORDER BY uid`);
    const windowCount = await raw1(pool,
      `SELECT count(*)::text AS n FROM public.users WHERE uid BETWEEN 990300 AND 990399`);
    const supplyCols = await raw(pool,
      `SELECT c.relname AS table_name, a.attname AS column_name,
              format_type(a.atttypid, a.atttypmod) AS type
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
          AND (a.attname ILIKE '%supply%' OR a.attname ILIKE '%total%' OR a.attname ILIKE '%issued%')
        ORDER BY c.relname, a.attname`);
    const cid1 = await raw1(pool, `SELECT * FROM public.currency WHERE cid = 1`);
    const accSum = await raw1(pool,
      `SELECT count(*)::text AS n, COALESCE(sum(balance),0)::text AS sum_balance,
              COALESCE(sum(frozen),0)::text AS sum_frozen FROM public.account WHERE cid = 1`);
    const fnSig = await raw(pool,
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND (p.proname ILIKE '%supply%' OR p.proname ILIKE '%conserv%')
        ORDER BY p.proname`);
    const file = save('env-info', {
      users_agg: usersAgg, uid_window_9903_count: windowCount, uid_window_9903_rows: window9903,
      supply_like_columns: supplyCols, currency_cid1: cid1, account_cid1_sum: accSum,
      supply_like_functions: fnSig,
    });
    console.log(JSON.stringify({ ok: true, file, users_agg: usersAgg,
      window9903_count: windowCount?.n, window9903_rows: window9903.map((r) => r.uid),
      supply_like_columns: supplyCols, currency_cid1: cid1, account_cid1_sum: accSum,
      supply_like_functions: fnSig }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
