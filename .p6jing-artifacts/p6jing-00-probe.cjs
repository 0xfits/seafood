/**
 * p6jing-00-probe.cjs — route-layer.spec v1.5 只读取证（Jing）
 * 口径：只 SELECT / 只读目录（pg_catalog / information_schema）；零 DDL、零 DML、零写。
 * 产物：<outDir>/p6jing-00-probe.<run>.json（run-tagged）
 * 用法：cd backend-ts && node ../.p6jing-artifacts/p6jing-00-probe.cjs <outDirAbs> <runTag>
 */
const fs = require('fs');
const path = require('path');
const { neon } = require('/Users/kevin/bistro/seafood/backend-ts/node_modules/@neondatabase/serverless');
const dotenv = require('/Users/kevin/bistro/seafood/backend-ts/node_modules/dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
const run = process.argv[3] || 'norun';
if (!process.argv[2]) throw new Error('usage: <outDirAbs> <runTag>');
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);

(async () => {
  const out = { run, probe: 'p6jing-00-probe', mode: 'read-only' };

  // ① 迁移版本真值（0022 / 0023 是否 apply）
  out.schema_migration = await sql`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name='schema_migration'`;
  try {
    out.schema_migration_rows = await sql`
      SELECT * FROM public.schema_migration ORDER BY version DESC LIMIT 4`;
  } catch (e) { out.schema_migration_rows_err = String(e.message || e); }

  // ② 权限四表在场 + 行数 + 键集
  for (const t of ['admin_permission', 'admin_role', 'admin_role_permission', 'admin_user_role', 'admin_ops_audit_log']) {
    out['regclass_' + t] = await sql`SELECT to_regclass(${'public.' + t})::text AS r`;
  }
  out.admin_permission_keys = await sql`
    SELECT permission_key FROM public.admin_permission ORDER BY permission_key`;
  out.admin_permission_count = await sql`SELECT count(*)::int AS n FROM public.admin_permission`;
  out.admin_role_rows = await sql`SELECT role_key FROM public.admin_role ORDER BY role_key`;
  out.admin_role_permission_count = await sql`
    SELECT role_key, count(*)::int AS n FROM public.admin_role_permission GROUP BY role_key`;
  out.admin_user_role_rows = await sql`
    SELECT r.uid::text AS uid, r.role_key, u.is_admin FROM public.admin_user_role r
      JOIN public.users u ON u.uid = r.uid ORDER BY r.uid LIMIT 10`;

  // ③ admin_ops_audit_log 结构（变体 A 复用代价的取证：CHECK 闭集）
  out.audit_cols = await sql`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='admin_ops_audit_log' ORDER BY ordinal_position`;
  out.audit_constraints = await sql`
    SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = to_regclass('public.admin_ops_audit_log') ORDER BY conname`;
  out.audit_indexes = await sql`
    SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname='public' AND tablename='admin_ops_audit_log' ORDER BY indexname`;
  out.audit_triggers = await sql`
    SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='admin_ops_audit_log' AND NOT t.tgisinternal`;
  out.audit_rows = await sql`
    SELECT result, count(*)::int AS n FROM public.admin_ops_audit_log GROUP BY result ORDER BY result`;

  // ④ 编排函数在场 + 关键机体（只读 pg_get_functiondef）
  out.fn_admin_points = await sql`
    SELECT p.oid::int AS oid, pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS ret, p.provolatile,
           length(pg_get_functiondef(p.oid)) AS def_len
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='admin_points_adjust_post_event'`;
  out.fn_has_raise_admin = await sql`
    SELECT position('RAISE' IN pg_get_functiondef(p.oid)) AS has_raise_pos
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='admin_points_adjust_post_event'`;
  out.fn_listing = await sql`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS ret, length(pg_get_functiondef(p.oid)) AS def_len
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('listing_post_event','job_post_event','market_post_event','ledger_post_event')
     ORDER BY p.proname`;
  out.fn_ops_events = await sql`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname LIKE '%\\_post\\_event' ORDER BY p.proname`;

  // ⑤ listing_order 真值（P4 退款面：状态分布 / 关联 listing / 卖家）
  out.listing_order_status = await sql`
    SELECT status, count(*)::int AS n FROM public.listing_order GROUP BY status ORDER BY status`;
  out.listing_order_cols = await sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='listing_order' ORDER BY ordinal_position`;
  out.listing_order_rows = await sql`
    SELECT order_id::text AS order_id, listing_id::text AS listing_id, seller_uid::text AS seller_uid,
           buyer_uid::text AS buyer_uid, status, (pay_txid IS NULL) AS pay_txid_null,
           (refund_txid IS NULL) AS refund_txid_null, price::text AS price, quantity::text AS quantity,
           create_key
      FROM public.listing_order ORDER BY order_id DESC LIMIT 20`;

  // ⑥ 账本真值（退款腿是否已实测过；事件根键是否已被消费）
  out.kind_counts = await sql`
    SELECT kind, count(*)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY n DESC`;
  out.ledger_entry_cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ledger_entry' ORDER BY ordinal_position`;
  out.refund_rows = await sql`
    SELECT * FROM public.ledger_entry WHERE kind='purchase_refund' ORDER BY 1 LIMIT 20`;
  out.biz_refund_keys = await sql`
    SELECT event_root_key, count(*)::int AS n FROM public.ledger_entry
     WHERE event_root_key LIKE 'biz:listing:refund:%' GROUP BY event_root_key ORDER BY event_root_key`;
  out.account_cid1 = await sql`
    SELECT count(*)::int AS n, COALESCE(sum(balance),0)::text AS sb, COALESCE(sum(frozen),0)::text AS sf
      FROM public.account WHERE cid=1`;
  out.ledger_totals = await sql`
    SELECT count(*)::int AS n FROM public.ledger_entry`;

  // ⑦ users 真值（admin 面：谁能进闸）
  out.users_admin = await sql`
    SELECT count(*)::int AS n_total,
           sum(CASE WHEN is_admin THEN 1 ELSE 0 END)::int AS n_is_admin
      FROM public.users`;
  out.users_cols = await sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`;

  // ⑧ 基础结构计数（结构面未位移的反断言基线）
  out.base_tables = await sql`
    SELECT count(*)::int AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`;
  out.triggers = await sql`
    SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND NOT t.tgisinternal`;
  out.ledger_tables = await sql`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name LIKE 'ledger%' ORDER BY table_name`;

  const p = path.join(outDir, 'p6jing-00-probe.' + run + '.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  console.log('WROTE ' + p);
})().catch((e) => { console.error('PROBE_FAILED: ' + (e && e.message ? e.message : e)); process.exit(1); });
