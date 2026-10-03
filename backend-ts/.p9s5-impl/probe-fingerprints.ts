/**
 * P9⑤ 实现第一步 · 指纹探针（只读）：取 ledger_post_event / conservation 的 prosrc md5、
 * 触发器定义、约束定义。供 0037 自检「prosrc 逐字未动对拍」硬编码基线。
 */
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  try {
    out.post_event = await readQuery(
      `SELECT p.oid::bigint::text AS oid, pg_get_function_identity_arguments(p.oid) AS sig,
              md5(p.prosrc) AS src_md5, length(p.prosrc)::int AS src_len,
              p.prokind, p.prorettype::regtype::text AS ret
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_post_event'
        ORDER BY pg_get_function_identity_arguments(p.oid)`);
    out.conservation = await readQuery(
      `SELECT p.oid::bigint::text AS oid, md5(p.prosrc) AS src_md5, length(p.prosrc)::int AS src_len
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_assert_commission_conservation'`);
    out.trigger = await readQuery(
      `SELECT tgname, tgenabled, tgdeferrable, tginitdeferred, tgconstraint::text,
              pg_get_triggerdef(oid) AS def
         FROM pg_trigger WHERE tgrelid='public.ledger_entry'::regclass AND NOT tgisinternal
          AND tgname='trg_ledger_entry_commission_conservation'`);
    out.constraint = await readQuery(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid='public.commission_policy'::regclass
          AND conname='commission_policy_fee_rate_rng'`);
    out.ledger_raise = await readQuery(
      `SELECT p.oid::bigint::text AS oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_raise'`);
  } catch (e) {
    out.ERROR = (e as Error).message;
  }
  console.log(JSON.stringify(out, null, 2));
  await closePools().catch(() => {});
})();
