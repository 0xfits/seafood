/**
 * P9⑤ 实现第一步 · 只读基线探针（探针不入 scripts/ 扫面根）。
 * 目的：现取 commission_policy 约束指纹 / 活体行 / 断言函数源 / 触发器 / kind / schema_version，
 *       为三迁移自检的「逐字对拍」提供真库锚点。**只读**（仅 SELECT / 目录查询）。
 */
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  try {
    out.schema_version = await readQuery<{ v: string | null }>(
      'SELECT (SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1) AS v');
    out.migration_rows = await readQuery<{ n: number; v: string | null }>(
      'SELECT count(*)::int AS n, max(version) AS v FROM public.schema_migration');

    out.fee_rate_constraint = await readQuery(
      `SELECT conname, contype, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid='public.commission_policy'::regclass
        ORDER BY conname`);

    out.policy_rows = await readQuery(
      `SELECT policy_id::text, fee_rate_bp, levels, weights_bp::text AS weights_bp,
              effective_from::text, created_by::text
         FROM public.commission_policy ORDER BY effective_from`);

    out.policy_count = await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.commission_policy');

    out.conservation_fn = await readQuery<{ def: string; src: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def, p.prosrc AS src
         FROM pg_proc p WHERE p.proname='ledger_assert_commission_conservation' LIMIT 1`);

    out.post_event_src = await readQuery<{ src: string; sig: string }>(
      `SELECT p.prosrc AS src, pg_get_function_identity_arguments(p.oid) AS sig
         FROM pg_proc p WHERE p.proname='ledger_post_event'`);

    out.conservation_trigger = await readQuery(
      `SELECT tgname, tgtype, tgenabled, pg_get_triggerdef(oid) AS def
         FROM pg_trigger WHERE tgrelid='public.ledger_entry'::regclass AND NOT tgisinternal
          AND tgname LIKE '%commission%' ORDER BY tgname`);

    out.ledger_kind_enum = await readQuery<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`);

    out.regclass = await readQuery(
      `SELECT to_regclass('public.commission_policy')::text AS cp,
              to_regclass('public.referral')::text AS rf,
              to_regclass('public.ledger_entry')::text AS le`);

    out.ledger_entry_cols = await readQuery(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ledger_entry'
          AND column_name IN ('event_root_key','idempotency_key','delta','uid','kind')`);
  } catch (e) {
    out.ERROR = (e as Error).message;
  }
  console.log(JSON.stringify(out, null, 2));
  await closePools().catch(() => {});
})();
