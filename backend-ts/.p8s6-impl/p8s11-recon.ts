/**
 * .p8s6-impl/p8s11-recon.ts — 8⑥ 续跑 · 只读侦察（不连写面）
 * 目的：确认 0039 已 apply 后的活体读数 + 找一位持 `manage_audit` 的管理员 uid（供 p8-s11 HTTP 腿）。
 */
import { readQuery, closePools } from '../src/db';
import { AUDIT_TABLES, AUDIT_TABLE_NAMES, parseAuditRequest, buildAuditSql } from '../src/audit-console';
import { DatabaseService } from '../src/database';

(async () => {
  const out: Record<string, unknown> = {};
  const sm = await readQuery<{ n: string; mx: string | null }>(
    `SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`);
  out.schema_migration = sm[0];
  const ap = await readQuery<{ n: string; has: boolean }>(
    `SELECT count(*)::int AS n, bool_or(permission_key='manage_audit') AS has FROM public.admin_permission`);
  out.admin_permission = ap[0];
  const sa = await readQuery<{ n: string; has: boolean }>(
    `SELECT count(*)::int AS n, bool_or(permission_key='manage_audit') AS has
       FROM public.admin_role_permission WHERE role_key='super_admin'`);
  out.super_admin = sa[0];
  const bt = await readQuery<{ n: string }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  out.base_tables = bt[0];
  // 找持 manage_audit 的 uid
  const holders = await readQuery<{ uid: string; role_key: string }>(
    `SELECT ur.uid::text AS uid, ur.role_key
       FROM public.admin_user_role ur
       JOIN public.admin_role_permission rp ON rp.role_key = ur.role_key
      WHERE rp.permission_key = 'manage_audit' ORDER BY ur.uid LIMIT 5`);
  out.manage_audit_holders = holders;
  const allAdmin = await readQuery<{ uid: string; role_key: string }>(
    `SELECT uid::text AS uid, role_key FROM public.admin_user_role ORDER BY uid LIMIT 10`);
  out.admin_user_role = allAdmin;
  out.whitelist = { n: AUDIT_TABLE_NAMES.length, names: AUDIT_TABLE_NAMES };
  // 逐表真读（默认页）
  const tableReads: Record<string, unknown> = {};
  for (const name of AUDIT_TABLE_NAMES) {
    const parsed = parseAuditRequest(name, {});
    if (!parsed.ok) { tableReads[name] = { ok: false }; continue; }
    const { text, params } = buildAuditSql(parsed.plan);
    try {
      const rows = await DatabaseService.readAuditPage(text, params);
      tableReads[name] = { ok: true, rows: rows.length };
    } catch (e) { tableReads[name] = { ok: false, err: String((e as Error).message).slice(0, 120) }; }
  }
  out.table_reads = tableReads;
  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch(async (e) => { console.error('FATAL', String((e as Error).stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
