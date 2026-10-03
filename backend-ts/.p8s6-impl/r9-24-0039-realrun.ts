/**
 * P8⑥ 审计台实现单 · ① `0039_admin_audit_console.sql` 的 `R-9-24` 真跑自证（不 apply）。
 * 单事务内 `BEGIN; <0039 全文>; ROLLBACK;`（**禁 COMMIT**）+ 四项读数：
 *   ① 无错执行；② 回滚后新对象不在（admin_permission 回 11 · manage_audit 不在）；
 *   ③ `schema_migration` 无新行（37 行 / max 0038）；④ 目标对象逐字复原（键集 md5 / 计数 / 基表 34）。
 * 行为面（事务内 0039 生效态）：admin_permission = 12 ∧ manage_audit 在场 ∧ 旧 11 值在 ∧ super_admin = 12。
 * 写库一律事务内 + 末尾 ROLLBACK。入 .p8s6-impl/（不入 scripts/ 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, '..', '.p8s6-impl');
fs.mkdirSync(OUT, { recursive: true });
const SENT = 'P8S6_0039_ROLLBACK';

type Row = Record<string, unknown>;
const g = async (q: <T>(s: string, p?: unknown[]) => Promise<T[]>, s: string, p?: unknown[]) =>
  (await q<Row>(s, p))[0] ?? {};

const snap = async (q: <T>(s: string, p?: unknown[]) => Promise<T[]>) => {
  const ap = await g(q, `SELECT count(*)::int AS n,
     coalesce(string_agg(permission_key, ',' ORDER BY permission_key),'') AS keys,
     md5(coalesce(string_agg(permission_key, ',' ORDER BY permission_key),'')) AS keys_md5
     FROM public.admin_permission`);
  const hasMa = await g(q, `SELECT count(*)::int AS n FROM public.admin_permission WHERE permission_key='manage_audit'`);
  const sa = await g(q, `SELECT count(*)::int AS n FROM public.admin_role_permission WHERE role_key='super_admin'`);
  const saMa = await g(q, `SELECT count(*)::int AS n FROM public.admin_role_permission WHERE role_key='super_admin' AND permission_key='manage_audit'`);
  const mig = await g(q, `SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`);
  const struct = await g(q, `SELECT
     (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS base_tables,
     (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND NOT t.tgisinternal) AS triggers,
     (SELECT count(*)::int FROM pg_constraint WHERE conrelid='public.admin_permission'::regclass AND contype IN ('c','e')) AS ap_checks`);
  return {
    ap_n: Number(ap.n ?? -1), ap_keys: String(ap.keys ?? ''), ap_keys_md5: String(ap.keys_md5 ?? ''),
    has_manage_audit: Number(hasMa.n ?? -1),
    super_admin_n: Number(sa.n ?? -1), super_admin_has_manage_audit: Number(saMa.n ?? -1),
    mig_rows: Number(mig.n ?? -1), mig_max: (mig.v ?? null) as string | null,
    base_tables: Number(struct.base_tables ?? -1), triggers: Number(struct.triggers ?? -1),
    ap_checks: Number(struct.ap_checks ?? -1),
  };
};

(async () => {
  const readQ = <T>(s: string, p?: unknown[]) => readQuery<T>(s, p);
  const sql = fs.readFileSync(path.resolve(ROOT, 'migrations/0039_admin_audit_console.sql'), 'utf8');
  const out: Record<string, unknown> = {
    unit: 'P8S6-0039-R9-24-REALRUN', generated_at: new Date().toISOString(), run: RUN,
    file: 'migrations/0039_admin_audit_console.sql', bytes: Buffer.byteLength(sql, 'utf8'), lines: sql.split('\n').length,
    note: '单事务 BEGIN;<0039 全文>;ROLLBACK（禁 COMMIT）；不 apply。',
  };

  const before = await snap(readQ);
  let execErr: string | null = null;
  const inTx: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx: TxClient) => {
      const q = <T>(s: string, p?: unknown[]) => tx.query<T>(s, p).then((r) => r.rows);
      await tx.query(sql);              // 整文件在单事务内真跑（含文件内 DO 自检）
      const post = await snap(q as never);
      inTx.post_ap_n = post.ap_n;
      inTx.post_ap_keys = post.ap_keys;
      inTx.post_has_manage_audit = post.has_manage_audit;
      inTx.post_super_admin_n = post.super_admin_n;
      inTx.post_super_admin_has_manage_audit = post.super_admin_has_manage_audit;
      inTx.post_mig_rows = post.mig_rows;
      inTx.post_mig_max = post.mig_max;
      inTx.post_base_tables = post.base_tables;
      inTx.post_triggers = post.triggers;

      // 行为面（事务内 0039 已生效）：旧 11 值逐字在场（bad_old = 0）
      inTx.behavior_missing_old = (await g(q, `SELECT count(*)::int AS n FROM (VALUES
        ('dashboard_access'),('manage_permissions'),('manage_points'),('manage_rewards'),
        ('manage_settings'),('manage_tasks'),('manage_users'),('publish_prizes'),
        ('publish_tasks'),('read_users'),('review_tasks')
      ) AS x(k) WHERE NOT EXISTS (SELECT 1 FROM public.admin_permission p WHERE p.permission_key=x.k)`)).n;
      inTx.behavior_new_present = (await g(q, `SELECT count(*)::int AS n FROM public.admin_permission WHERE permission_key='manage_audit'`)).n;

      throw new Error(SENT);
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 220)}` : msg.slice(0, 240);
  }
  const after = await snap(readQ);

  out.reads = {
    '1_no_error': execErr === null,
    exec_err: execErr,
    '2_new_object_absent_after_rollback':
      after.ap_n === 11 && after.has_manage_audit === 0 && after.super_admin_n === 11 && after.super_admin_has_manage_audit === 0,
    '3_schema_migration_no_new_row': after.mig_rows === before.mig_rows && after.mig_max === before.mig_max,
    mig_rows_before: before.mig_rows, mig_rows_after: after.mig_rows,
    mig_max_before: before.mig_max, mig_max_after: after.mig_max,
    '4_target_object_restored':
      after.ap_n === before.ap_n && after.ap_keys === before.ap_keys && after.ap_keys_md5 === before.ap_keys_md5
      && after.super_admin_n === before.super_admin_n && after.base_tables === before.base_tables
      && after.triggers === before.triggers && after.ap_checks === before.ap_checks,
    new_relations_added: after.base_tables - before.base_tables,
  };
  out.before = before;
  out.after = after;
  out.in_tx = inTx;

  fs.writeFileSync(path.join(OUT, `r9-24-0039-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  const r = out.reads as Record<string, unknown>;
  process.exit(r['1_no_error'] && r['2_new_object_absent_after_rollback'] && r['3_schema_migration_no_new_row'] && r['4_target_object_restored'] ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
