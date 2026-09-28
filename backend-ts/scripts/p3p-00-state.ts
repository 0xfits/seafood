/**
 * P3-P-00 · 只读基线探针（迁移**前**）：库态指纹 + 对象存在性 + 账本指纹 + `public` 基表清点。
 * 只读：本脚本**不执行任何写语句**。
 * 读法：npx ts-node --transpile-only scripts/p3p-00-state.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, save, sha256File, OUT_DIR, RUN, MIGRATION_FILE, REPO } from './p3p-lib';

const main = async () => {
  const p = mkPool();
  try {
    const registry = await raw<{ version: string; name: string; checksum: string; applied_at: string }>(
      p, 'SELECT version, name, checksum, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version',
    );
    const schemaVersion = registry.length ? registry[registry.length - 1].version : null;

    const tables = await raw<{ table_name: string }>(
      p, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
    );
    const views = await raw<{ table_name: string }>(
      p, `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`,
    );

    // 对象存在性（spec §6.6 的 6 张新表 + referral 先例）
    const exist: Record<string, boolean> = {};
    for (const t of ['app_config', 'admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role',
                     'currency_status_log', 'referral', 'commission_policy']) {
      const r = await raw1<{ ok: boolean }>(p, `SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${t}`]);
      exist[t] = !!r?.ok;
    }

    // 账本指纹（DL142：不得改 ledger_post_event）
    const lpe = await raw1<{ bytes: number; md5: string; prosrc: string }>(
      p, `SELECT octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5, p.prosrc
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ledger_post_event'`,
    );
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const lpePath = path.join(OUT_DIR, `p3p-${RUN}-ledger_post_event.prosrc.sql`);
    if (lpe?.prosrc && !fs.existsSync(lpePath)) fs.writeFileSync(lpePath, lpe.prosrc);

    // 编排函数指纹（DL142：job/listing/market 三函数不得改）
    const orch = await raw<{ proname: string; bytes: number; md5: string }>(
      p, `SELECT p.proname, octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN ('job_post_event','listing_post_event','market_post_event')
           ORDER BY p.proname`,
    );

    // append-only 先例的 tgenabled（全 'O'）
    const trig = await raw<{ tgname: string; tgenabled: string; tgrelid: string }>(
      p, `SELECT t.tgname, t.tgenabled, t.tgrelid::regclass::text AS tgrelid
            FROM pg_trigger t WHERE NOT t.tgisinternal
             AND t.tgname IN ('trg_referral_append_only','trg_commission_policy_append_only','trg_ledger_entry_append_only')
           ORDER BY t.tgname`,
    );

    // users 逐列（DL72：is_admin 已存在 ⇒ 不自建）
    const usersCols = await raw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      p, `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
           WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`,
    );

    const migration = fs.existsSync(MIGRATION_FILE)
      ? { exists: true, sha256: sha256File(MIGRATION_FILE), bytes: fs.statSync(MIGRATION_FILE).size }
      : { exists: false };

    const out = {
      repo: REPO,
      schema_version: schemaVersion,
      schema_migration_rows: registry.length,
      schema_migration_versions: registry.map((r) => r.version),
      public_base_tables: tables.map((r) => r.table_name),
      public_base_table_count: tables.length,
      public_views: views.map((r) => r.table_name),
      object_exists: exist,
      ledger_post_event: { bytes: lpe?.bytes ?? null, md5: lpe?.md5 ?? null },
      orchestration_functions: orch,
      append_only_precedent_triggers: trig,
      users_columns: usersCols,
      migration_0017_file: migration,
    };
    const file = save('state-pre', out);
    console.log(JSON.stringify({ artifact: file, ...out }, null, 2));
  } finally {
    await p.end().catch(() => undefined);
  }
};

main().catch((e) => { console.error('p3p-00 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
