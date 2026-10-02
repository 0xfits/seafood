/**
 * p7b-04 · 收口轮**只读**基线取证（现取，非转引）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p7b-04-recon2.ts
 * 读数：.p7b-artifacts/p7b-04-recon2-<RUN>.json（run-tagged）
 * 纪律：**只 SELECT**（零 DDL / 零 DML / 零事务写）。
 */
import { mkPool, raw, raw1, save } from './p7b-lib';

(async () => {
  const p = mkPool(2);
  const out: Record<string, unknown> = { script: 'scripts/p7b-04-recon2.ts' };
  try {
    out.schema_migration_tail = await raw(p, `SELECT version, name, checksum,
        to_char(applied_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS applied_at
      FROM public.schema_migration ORDER BY id DESC LIMIT 3`);

    out.audit_table_present = (await raw1<{ t: string }>(p, `SELECT to_regclass('public.admin_refund_audit_log')::text AS t`))?.t ?? null;
    out.refund_fn_present = (await raw1<{ t: string }>(p, `SELECT to_regprocedure('public.listing_refund_post_event(jsonb)')::text AS t`))?.t ?? null;
    out.post_event_functions = await raw(p, `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE '%_post_event' ORDER BY 1`);
    out.triggers = (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`))?.n;

    out.audit_rows = await raw(p, `SELECT log_id, actor_uid::text, order_id::text, result, txid::text, idempotency_key
      FROM public.admin_refund_audit_log ORDER BY log_id`);

    // ★ AC-11(i) 源码级：既有资金函数体内 FOR UPDATE 存在
    out.for_update = await raw1(p, `SELECT
        (position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) > 0) AS has_for_update,
        position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) AS pos,
        (position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0) AS has_for_update_regproc,
        position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) AS pos_regproc`);

    out.listing_order = await raw(p, `SELECT o.order_id, o.listing_id, o.seller_uid, o.buyer_uid, o.cid,
        o.price::text AS price, o.quantity, o.status, (o.pay_txid IS NOT NULL) AS has_pay_txid,
        (o.refund_txid IS NOT NULL) AS has_refund_txid
      FROM public.listing_order o ORDER BY o.order_id`);

    out.listing = await raw(p, `SELECT listing_id, seller_uid, cid, price::text AS price, stock, status
      FROM public.listing ORDER BY listing_id LIMIT 30`);

    out.ledger_entry = await raw1(p, `SELECT
        (SELECT count(*)::text FROM public.ledger_entry) AS rows,
        (SELECT count(*)::text FROM public.ledger_entry WHERE kind='purchase_refund') AS purchase_refund,
        (SELECT count(*)::text FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:refund:%') AS refund_rootkey_rows`);

    out.account_cid1 = await raw1(p, `SELECT
        (SELECT count(*)::text FROM public.account WHERE cid=1) AS rows,
        (SELECT COALESCE(sum(balance),0)::text FROM public.account WHERE cid=1) AS sum_balance,
        (SELECT COALESCE(sum(frozen),0)::text FROM public.account WHERE cid=1) AS sum_frozen`);

    out.users = await raw1(p, `SELECT (SELECT count(*)::text FROM public."users") AS rows,
        (SELECT count(*)::text FROM public."users" WHERE is_admin) AS is_admin_true`);

    out.users_admin = await raw(p, `SELECT uid, is_admin, bio FROM public."users" WHERE is_admin ORDER BY uid`);

    out.admin_role_tables = await raw1(p, `SELECT
        to_regclass('public.admin_user_role')::text AS user_role,
        to_regclass('public.admin_role')::text AS role,
        to_regclass('public.admin_role_permission')::text AS role_perm`);

    out.admin_role_cols = await raw(p, `SELECT table_name, column_name, data_type
      FROM information_schema.columns WHERE table_schema='public'
        AND table_name IN ('admin_user_role','admin_role','admin_role_permission')
      ORDER BY table_name, ordinal_position`);

    out.role_rows = await raw(p, `SELECT * FROM public.admin_user_role LIMIT 50`).catch(() => []);

    out.admin_role_rows = await raw(p, `SELECT * FROM public.admin_role ORDER BY 1 LIMIT 50`).catch(() => []);

    out.admin_role_perm_rows = await raw(p, `SELECT * FROM public.admin_role_permission ORDER BY 1, 2 LIMIT 80`).catch(() => []);
  } finally {
    await p.end().catch(() => undefined);
  }
  const f = save('p7b-04-recon2', out);
  console.log(JSON.stringify({ saved: f, out }, null, 1));
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
