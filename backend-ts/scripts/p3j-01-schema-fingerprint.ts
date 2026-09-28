/**
 * P3-J · 探针 01：schema 指纹（迁移前/后）+ `schema_migration` 全表转出 + /health 的 `schema_version` 真源
 *
 * 用法：npx ts-node --transpile-only scripts/p3j-01-schema-fingerprint.ts
 * 只读：仅 SELECT + 读文件系统（src/db.ts 的取版本实现），无任何 DDL/DML。
 *
 * 「迁移前」指纹的真值来自迁移执行器自己的产物（`migrate-apply.json` / `migrate-rerun-skipped.json`）：
 *   本探针**不重跑历史**、也不猜；它把盘上既有 run-tagged 产物里的 `public_base_tables` 读出来当「前」，
 *   再从库里现读当「后」。两次读数都带回各自的 run tag 与文件路径，便于对拍。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, save, OUT_DIR, REPO, RUN } from './p3j-lib';

(async () => {
  const pool = mkPool(1);
  try {
    // ---------------------------------------------------------------- 后（现读）
    const baseTables = await raw<{ table_name: string }>(pool,
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
    const jobCols = await raw(pool,
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='job' ORDER BY ordinal_position`);
    const jobConstraints = await raw(pool,
      `SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname='public' AND t.relname='job' ORDER BY c.conname`);
    const jobIndexes = await raw(pool,
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='job' ORDER BY indexname`);
    const jobTriggers = await raw(pool,
      `SELECT tg.tgname, tg.tgenabled, pg_get_triggerdef(tg.oid) AS definition
         FROM pg_trigger tg
         JOIN pg_class t ON t.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname='public' AND t.relname='job' AND NOT tg.tgisinternal
        ORDER BY tg.tgname`);
    const jobIndexCountTotal = await raw1<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM pg_indexes WHERE schemaname='public' AND tablename='job'`);
    const fnSignatures = await raw(pool,
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result,
              p.provolatile, octet_length(p.prosrc)::text AS src_bytes
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname IN ('job_post_event','job_settle_plan','job_status_transition_ok',
              'job_status_guard','job_ledger_ref_guard','job_core_immutable_guard','job_touch_time_updated','job_no_delete')
        ORDER BY p.proname`);
    const migRows = await raw(pool,
      `SELECT version, name, checksum, applied_at::text AS applied_at
         FROM public.schema_migration ORDER BY version`);
    const maxVersion = await raw1<{ v: string | null }>(pool,
      `SELECT max(version) AS v FROM public.schema_migration`);
    const versionRowCount = await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.schema_migration`);
    const migrationFile = path.join(REPO, 'migrations', '0013_job_core.sql');
    const migrationBytes = fs.readFileSync(migrationFile, 'utf8');

    // ---------------------------------------------------------------- /health 的真源（§4 #5 修正点）
    const dbTsPath = path.join(REPO, 'src', 'db.ts');
    const dbTs = fs.readFileSync(dbTsPath, 'utf8');
    const fnBody = dbTs.slice(dbTs.indexOf('export const getSchemaVersion'), dbTs.indexOf('export const healthCheck'));
    const hardcoded = /schema_version\s*:\s*['"]/.test(dbTs) || /return\s+['"]00\d\d['"]/.test(fnBody);
    const readsDbAtRuntime = /SELECT\s+version\s+FROM\s+schema_migration|max\(version\)|schema_migration/i.test(fnBody);

    // ---------------------------------------------------------------- 迁移前（读盘上既有 run-tagged 产物）
    const arts = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter((f) => /migrate-(apply|rerun).*\.json$/.test(f)) : [];
    const preEvidence = arts.map((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')) as Record<string, unknown>;
      const applied = (d.applied_now as Array<Record<string, unknown>>) ?? [];
      return {
        file: path.join(OUT_DIR, f),
        run_tag_in_name: f,
        ok: d.ok, schema_version_written: d.schema_version,
        public_base_tables: d.public_base_tables, public_base_table_count: d.public_base_table_count,
        has_job_table: (((d.public_base_tables as string[]) ?? []).includes('job')),
        v0013_action: (applied.find((x) => x.version === '0013') ?? {}).action ?? null,
      };
    });

    const out = {
      probe: 'P3J-01-SCHEMA-FINGERPRINT',
      ok: true,
      // ---- 后（现读）
      after: {
        public_base_tables: baseTables.map((r) => r.table_name),
        public_base_table_count: baseTables.length,
        public_job_columns: jobCols,
        public_job_column_count: jobCols.length,
        public_job_constraints: jobConstraints,
        public_job_indexes: jobIndexes,
        public_job_index_count: Number(jobIndexCountTotal?.n ?? -1),
        public_job_triggers: jobTriggers,
        job_functions: fnSignatures,
        schema_migration: migRows,
        schema_migration_row_count: Number(versionRowCount?.n ?? -1),
        max_version_nowread: maxVersion?.v ?? null,
      },
      // ---- 前（迁移执行器产物，不由本探针重跑）
      before: { source: 'migrate.ts 的 run-tagged 产物（盘上现读）', evidence: preEvidence },
      // ---- /health 的 schema_version 真源
      health_schema_version: {
        health_field: 'schema_version',
        expectation: '0013',
        measured_max_version: maxVersion?.v ?? null,
        equals_0013: (maxVersion?.v ?? null) === '0013',
        implementation_file: path.relative(REPO, dbTsPath),
        implementation_body: fnBody.trim(),
        is_hardcoded_constant: hardcoded,
        reads_db_at_runtime: readsDbAtRuntime,
        verdict: hardcoded ? 'HARDCODED_NEEDS_FIX' : 'runtime-read, no hardcoded constant (src/ untouched by this unit)',
        http_probe: 'NOT_MEASURED（本单禁起常驻 server ⇒ 未打 HTTP /health；真源 = max(version) 与取版本实现体）',
      },
      artifact_0013: {
        file: path.relative(REPO, migrationFile),
        sha256: await import('crypto').then((c) => c.createHash('sha256').update(migrationBytes).digest('hex')),
        bytes: Buffer.byteLength(migrationBytes),
        lines: migrationBytes.split('\n').length,
      },
      run_tag: RUN,
    };
    console.log(JSON.stringify({ artifact: save('schema-fingerprint', out), ...out }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})().catch((e) => { console.error('p3j-01 fatal:', (e as Error)?.message || e); process.exit(2); });
