/**
 * P3-P-01 · 只读迁移**后**指纹探针：6 张新表逐列 / 约束 / 索引 indexdef / 触发器 tgenabled + 账本指纹。
 * 只读：不执行任何写语句。读法：npx ts-node --transpile-only scripts/p3p-01-post.ts
 */
import { mkPool, raw, raw1, save, sha256File, MIGRATION_FILE, OUT_DIR, RUN, foreignRows } from './p3p-lib';

const TABLES = ['app_config', 'admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role', 'currency_status_log'];

const main = async () => {
  const p = mkPool();
  try {
    const registry = await raw<{ version: string; name: string; checksum: string; applied_at: string }>(
      p, 'SELECT version, name, checksum, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version',
    );
    const tables = await raw<{ table_name: string }>(
      p, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
    );
    const views = await raw<{ table_name: string }>(p, `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`);

    const perTable: Record<string, unknown> = {};
    for (const t of TABLES) {
      const columns = await raw(
        p, `SELECT ordinal_position AS ord, column_name AS name, data_type AS type, is_nullable AS nullable, column_default AS def
              FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
      const constraints = await raw(
        p, `SELECT k.conname AS name, k.contype AS type, pg_get_constraintdef(k.oid) AS def
              FROM pg_constraint k WHERE k.conrelid = ('public.'||$1)::regclass ORDER BY k.conname`, [t]);
      const indexes = await raw(
        p, `SELECT indexname AS name, indexdef AS def FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`, [t]);
      const triggers = await raw(
        p, `SELECT t.tgname AS name, t.tgenabled AS enabled, t.tgtype AS tgtype
              FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid = ('public.'||$1)::regclass ORDER BY t.tgname`, [t]);
      perTable[t] = { columns, constraints, indexes, triggers };
    }

    const funcs = await raw<{ proname: string; args: string; bytes: number; md5: string }>(
      p, `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN
             ('ledger_post_event','job_post_event','listing_post_event','market_post_event',
              'platform_config_key_immutable','platform_config_touch_updated','currency_status_log_append_only')
           ORDER BY p.proname`, []);

    const fkTotals = await raw<{ confrelid: string; n: string }>(
      p, `SELECT k.confrelid::regclass::text AS confrelid, count(*)::text AS n
            FROM pg_constraint k
           WHERE k.contype='f' AND k.conrelid IN ('public.app_config'::regclass,'public.admin_role'::regclass,
                 'public.admin_permission'::regclass,'public.admin_role_permission'::regclass,
                 'public.admin_user_role'::regclass,'public.currency_status_log'::regclass)
           GROUP BY 1 ORDER BY 1`, []);

    const out = {
      schema_version: registry.length ? registry[registry.length - 1].version : null,
      schema_migration_rows: registry.length,
      schema_migration_row17: registry.find((r) => r.version === '0017') ?? null,
      public_base_tables: tables.map((r) => r.table_name),
      public_base_table_count: tables.length,
      public_views: views.map((r) => r.table_name),
      per_table: perTable,
      functions: funcs,
      fk_totals_from_new_tables: fkTotals,
      foreign_rows: await foreignRows(p),
      migration_0017_sha256: sha256File(MIGRATION_FILE),
    };
    const file = save('post-fingerprint', out);
    console.log(JSON.stringify({ artifact: file, ...out }, null, 2));
  } finally {
    await p.end().catch(() => undefined);
  }
};

main().catch((e) => { console.error('p3p-01 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
