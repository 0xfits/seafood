/**
 * p7b-00-recon · §7-32 管理员退款发起 —— **只读**基线取证（本单现取，非转引）
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p7b-00-recon.ts
 * 读数：`.p7b-artifacts/p7b-00-recon-<RUN>.json`（run-tagged）
 * 纪律：**只 SELECT**（零 DDL / 零 DML / 零事务写），不读 .env 内容（只用 dotenv 载 URL）。
 */
import { mkPool, raw, raw1, save } from './p7b-lib';

(async () => {
  const p = mkPool(2);
  const out: Record<string, unknown> = { script: 'scripts/p7b-00-recon.ts' };
  try {
    out.schema_migration_ops = await raw(p, `SELECT version, name, checksum,
        to_char(applied_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS applied_at
      FROM public.schema_migration ORDER BY id DESC LIMIT 4`);

    out.admin_permission_keys = (await raw<{ permission_key: string }>(p,
      `SELECT permission_key FROM public.admin_permission ORDER BY permission_key`)).map((r) => r.permission_key);

    out.admin_ops_audit_log = await raw1(p, `SELECT
        (SELECT count(*)::text FROM public.admin_ops_audit_log) AS rows,
        (SELECT count(*)::text FROM public.admin_ops_audit_log WHERE result = 'applied') AS applied,
        (SELECT count(*)::text FROM public.admin_ops_audit_log WHERE result <> 'applied') AS rejected,
        (SELECT count(*)::text FROM pg_indexes WHERE schemaname='public' AND tablename='admin_ops_audit_log') AS indexes`);

    out.audit_tables_present = (await raw<{ t: string }>(p,
      `SELECT to_regclass('public.admin_refund_audit_log')::text AS t`))[0]?.t ?? null;
    out.post_event_functions = (await raw<{ proname: string }>(p,
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname LIKE '%_post_event' ORDER BY 1`)).map((r) => r.proname);

    out.listing_order = await raw(p, `SELECT o.order_id, o.listing_id, o.seller_uid, o.buyer_uid, o.cid,
        o.price::text AS price, o.quantity, o.status,
        (o.pay_txid IS NOT NULL) AS has_pay_txid, (o.refund_txid IS NOT NULL) AS has_refund_txid
      FROM public.listing_order o ORDER BY o.order_id`);

    out.ledger_entry = await raw1(p, `SELECT
        (SELECT count(*)::text FROM public.ledger_entry) AS rows,
        (SELECT count(*)::text FROM public.ledger_entry WHERE kind='purchase_refund') AS purchase_refund,
        (SELECT count(*)::text FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:refund:%') AS refund_rootkey_rows`);

    out.ledger_kind_census = await raw(p, `SELECT kind, count(*)::text AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`);

    out.account_cid1 = await raw1(p, `SELECT
        (SELECT count(*)::text FROM public.account WHERE cid=1) AS rows,
        (SELECT COALESCE(sum(balance),0)::text FROM public.account WHERE cid=1) AS sum_balance,
        (SELECT COALESCE(sum(frozen),0)::text FROM public.account WHERE cid=1) AS sum_frozen`);

    out.structure = await raw1(p, `SELECT
        (SELECT count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS base_tables,
        (SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND NOT t.tgisinternal) AS triggers`);

    out.users = await raw1(p, `SELECT (SELECT count(*)::text FROM public."users") AS rows,
        (SELECT count(*)::text FROM public."users" WHERE is_admin) AS is_admin_true`);

    // ★ 硬约束 4 的「必测项」预置：`listing_post_event` 的退款状态机闸（LD011）到底带不带 DETAIL.reason？
    //   这里**不做**写操作，只取函数定义里那两处状态位拒绝的原文，作为 T-2 白名单的现取锚。
    out.listing_post_event_ld011_reasons = await raw(p, `SELECT
        (position('order_not_refundable' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) > 0) AS has_order_not_refundable,
        (position('order_pay_missing' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) > 0) AS has_order_pay_missing,
        (position('''LD011''' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) > 0) AS has_ld011_literal,
        (position('LEDGER_CURRENCY_INVALID_TRANSITION' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) > 0) AS has_ld011_name`);

    out.ledger_raise_detail_source = await raw1(p, `SELECT
        (position('PG_EXCEPTION_DETAIL' IN pg_get_functiondef('public.ledger_post_event(jsonb)'::regprocedure)) > 0) AS lpe_reads_pg_exception_detail,
        (position('DETAIL' IN pg_get_functiondef('public.ledger_raise(text,jsonb)'::regprocedure)) > 0) AS ledger_raise_sets_detail`);
  } finally {
    await p.end().catch(() => undefined);
  }
  const f = save('p7b-00-recon', out);
  console.log(JSON.stringify({ saved: f, out }, null, 1));
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
