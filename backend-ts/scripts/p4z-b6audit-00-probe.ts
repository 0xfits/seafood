/**
 * P6-B6-AUDIT · 只读取证 / 账本零位移快照（Kong）
 * 只读：不 DDL / 不 DML / 不 nextval；单连接 Client（非 Pool）。
 * 用法: npx ts-node --transpile-only scripts/p4z-b6audit-00-probe.ts [tag]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const TAG = process.argv[2] || 'probe';
const redact = (s: string) => String(s).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');

(async () => {
  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  if (!URL) { console.log(JSON.stringify({ ok: false, fatal: 'no DATABASE_URL_UNPOOLED' })); process.exit(2); }
  const c = new Client({ connectionString: URL });
  const out: any = { tag: TAG, at: new Date().toISOString(), url: '[REDACTED]' };
  const q = async (name: string, sql: string) => {
    try { const r: any = await c.query(sql); out[name] = r && r.rows !== undefined ? r.rows : { note: 'no rows prop', raw: String(r) }; }
    catch (e: any) { out[name] = { error: redact(String(e && e.message ? e.message : e)) }; }
  };
  await c.connect();
  try {
    await q('catalog', `SELECT
        (SELECT count(*) FROM pg_class cc JOIN pg_namespace n ON n.oid=cc.relnamespace WHERE n.nspname='public' AND cc.relkind='r')::int AS base_tables,
        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f')::int AS functions,
        (SELECT count(*) FROM pg_trigger t JOIN pg_class cc ON cc.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cc.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal)::int AS non_internal_triggers,
        (SELECT count(*) FROM pg_class cc JOIN pg_namespace n ON n.oid=cc.relnamespace WHERE n.nspname='public' AND cc.relkind='S')::int AS sequences,
        (SELECT count(*) FROM pg_class cc JOIN pg_namespace n ON n.oid=cc.relnamespace WHERE n.nspname='public' AND cc.relkind='i')::int AS indexes`);
    await q('base_tables', `SELECT table_name FROM information_schema."tables" WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`);
    await q('csl_cols', `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='currency_status_log' ORDER BY ordinal_position`);
    await q('csl_constraints', `SELECT conname, contype FROM pg_constraint WHERE conrelid='public.currency_status_log'::regclass ORDER BY conname`);
    await q('csl_indexes', `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='currency_status_log' ORDER BY 1`);
    await q('schema_migration_count', `SELECT count(*)::int AS n FROM public."schema_migration"`);
    await q('ledger_entry_count', `SELECT count(*)::text AS n FROM public.ledger_entry`);
    await q('ledger_event_count', `SELECT count(*)::text AS n FROM public.ledger_event`);
    await q('sigma_cid1', `SELECT coalesce(sum(balance),0)::text AS bal, coalesce(sum(frozen),0)::text AS frozen FROM public.account WHERE cid=1`);
    await q('account_count', `SELECT count(*)::int AS n FROM public.account`);
    await q('audit_like_tables', `SELECT table_name FROM information_schema."tables" WHERE table_schema='public' AND (table_name LIKE '%audit%' OR table_name LIKE '%ops%') ORDER BY 1`);
    await q('new_obj_exists', `SELECT to_regprocedure('public.admin_points_adjust_post_event(jsonb)')::text AS fn, to_regclass('public.admin_ops_audit_log')::text AS tbl`);
    // 路由注册点（源码级，静态）
    const idx = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
    out.route_registrations = (idx.match(/^app\.(get|post|patch|delete|put)\(/gm) || []).length;
  } catch (e: any) {
    out.fatal = redact(String(e && e.message ? e.message : e));
  } finally {
    await c.end().catch(() => undefined);
  }
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const dir = path.join(__dirname, '..', '.p4-artifacts', `p6b6audit-${TAG}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'probe.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
})();
