/**
 * P3-F · 探针 00：catalog 指纹（迁移前/后通用；表不存在时该段 = null，不占位）
 * 用法：npx ts-node --transpile-only scripts/p3f-00-fingerprint.ts <label>
 *   <label> 读数标签（pre / post），写进产物名与 JSON。
 * 只读：不写库、无 DDL/DML。
 */
import { mkPool, raw, raw1, save, RUN } from './p3f-lib';

(async () => {
  const label = process.argv[2] || 'run';
  const p = mkPool(1);
  try {
    const tables = await raw(p, `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);

    const cols = async (t: string) => raw(p, `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    const cons = async (t: string) => raw(p, `SELECT c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
       WHERE c.conrelid = to_regclass('public.'||$1) ORDER BY c.conname`, [t]);
    const idx = async (t: string) => raw(p, `SELECT i.indexname, i.indexdef FROM pg_indexes i
       WHERE i.schemaname='public' AND i.tablename=$1 ORDER BY i.indexname`, [t]);
    const trg = async (t: string) => raw(p, `SELECT t.tgname, t.tgenabled, p.proname
       FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE NOT t.tgisinternal AND t.tgrelid = to_regclass('public.'||$1) ORDER BY t.tgname`, [t]);
    const funcs = await raw(p, `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND (p.proname LIKE 'job_application%' OR p.proname LIKE 'job_submission%')
       ORDER BY p.proname`);

    const smRows = await raw(p, `SELECT version, name, checksum, applied_at::text AS applied_at
       FROM public.schema_migration ORDER BY version`);
    const last = smRows.length ? smRows[smRows.length - 1] : null;

    const out = {
      probe: 'P3F-00-FINGERPRINT', label, run_tag: RUN,
      public_base_table_count: tables.length,
      public_base_tables: tables.map((t) => t.table_name),
      schema_version: last ? String((last as { version: string }).version) : null,
      schema_migration_row_count: smRows.length,
      schema_migration_last_row: last,
      functions: funcs,
      job_application: {
        exists: (await raw1(p, `SELECT to_regclass('public.job_application') AS x`))?.x ? true : false,
        columns: await cols('job_application'),
        constraints: await cons('job_application'),
        indexes: await idx('job_application'),
        triggers: await trg('job_application'),
      },
      job_submission: {
        exists: (await raw1(p, `SELECT to_regclass('public.job_submission') AS x`))?.x ? true : false,
        columns: await cols('job_submission'),
        constraints: await cons('job_submission'),
        indexes: await idx('job_submission'),
        triggers: await trg('job_submission'),
      },
    };
    const file = save(`fingerprint-${label}`, out);
    console.log(JSON.stringify({
      artifact: file, label,
      public_base_table_count: out.public_base_table_count,
      public_base_tables: out.public_base_tables,
      schema_version: out.schema_version, schema_migration_row_count: out.schema_migration_row_count,
      job_application_exists: out.job_application.exists,
      job_app_cols: out.job_application.columns.length,
      job_app_indexes: out.job_application.indexes.map((i) => i.indexname),
      job_app_triggers: out.job_application.triggers.map((t) => `${t.tgname}:${t.tgenabled}`),
      job_submission_exists: out.job_submission.exists,
      job_sub_cols: out.job_submission.columns.length,
      job_sub_indexes: out.job_submission.indexes.map((i) => i.indexname),
      job_sub_triggers: out.job_submission.triggers.map((t) => `${t.tgname}:${t.tgenabled}`),
      functions: out.functions.map((f) => `${f.proname}(${f.args})`),
    }, null, 2));
  } finally {
    await p.end().catch(() => undefined);
  }
})().catch((e) => { console.error('p3f-00 fatal:', (e as Error)?.message || e); process.exit(2); });
