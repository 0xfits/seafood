/**
 * P8⑥ 审计台实现单 · 只读连通 / 现取锚探针（不入 scripts/ 扫面根）。
 * 只读：SELECT 计数 + 约束在场；零写。
 */
import { readQuery, closePools } from '../src/db';

type Row = Record<string, unknown>;
const g = async (s: string, p?: unknown[]) => (await readQuery<Row>(s, p))[0] ?? {};

(async () => {
  const out: Record<string, unknown> = { unit: 'P8S6-CONN-RO', generated_at: new Date().toISOString() };
  out.mig = await g(`SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`);
  out.base_tables = await g(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  out.triggers_noninternal = await g(`SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND NOT t.tgisinternal`);
  out.admin_permission = await g(`SELECT count(*)::int AS n FROM public.admin_permission`);
  out.admin_permission_keys = await readQuery<Row>(`SELECT permission_key FROM public.admin_permission ORDER BY permission_key`);
  out.super_admin_perms = await g(`SELECT count(*)::int AS n FROM public.admin_role_permission WHERE role_key='super_admin'`);
  out.ap_check_contype = await readQuery<Row>(`SELECT conname, contype FROM pg_constraint WHERE conrelid='public.admin_permission'::regclass AND contype<>'p'`);
  out.arp_rows = await g(`SELECT count(*)::int AS n FROM public.admin_role_permission`);
  out.audit_tables_exist = await readQuery<Row>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('admin_ops_audit_log','admin_refund_audit_log','ledger_entry','currency_review_log','currency_status_log','listing_review_log','job_arbitration_log','batt_entry','checkin_log','checkin_makeup_log','rating','listing_order_event','referral','commission_policy','app_config') ORDER BY table_name`);
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1000)); await closePools().catch(() => undefined); process.exit(2); });
