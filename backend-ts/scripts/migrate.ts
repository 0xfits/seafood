/**
 * 版本化 migration 运行器（纯 SQL 文件 + 本脚本，无重型框架）
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/migrate.ts            # 应用未执行的 migration
 *   npx ts-node --transpile-only scripts/migrate.ts --status   # 只查看版本表
 *
 * 契约：
 *   - 版本表 public.schema_migration（由本脚本自举创建）
 *   - 每个文件 = 一个版本，文件名前缀数字即版本号：0001_ledger_core.sql
 *   - 单文件在**一个事务**内执行；失败整文件回滚，不写版本行
 *   - 可重入：已应用且 checksum 一致 ⇒ 跳过（输出 skipped）
 *   - 漂移检测：已应用但 checksum 变了 ⇒ 直接报错退出 3（不静默重放）
 */
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const txUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';

type MigrationFile = { version: string; name: string; file: string; sql: string; checksum: string };

const loadFiles = (): MigrationFile[] => {
  const entries = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return entries.map((name) => {
    const file = path.join(MIGRATIONS_DIR, name);
    const sql = fs.readFileSync(file, 'utf8');
    const version = (name.match(/^(\d+)/) || [, name])[1] as string;
    return {
      version,
      name,
      file,
      sql,
      checksum: crypto.createHash('sha256').update(sql, 'utf8').digest('hex'),
    };
  });
};

const BOOTSTRAP = `
  CREATE TABLE IF NOT EXISTS schema_migration (
    id          bigserial   PRIMARY KEY,
    version     text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    checksum    text        NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

(async () => {
  if (!txUrl) throw new Error('migration: 缺少 DATABASE_URL_UNPOOLED / DATABASE_URL');
  const files = loadFiles();
  const pool = new Pool({ connectionString: txUrl, max: 2 });
  const client = await pool.connect();
  let exitCode = 0;
  try {
    await client.query(BOOTSTRAP);
    const appliedRows = (await client.query('SELECT version, name, checksum, applied_at FROM schema_migration ORDER BY version')).rows;
    const applied = new Map<string, { name: string; checksum: string; applied_at: string }>(
      appliedRows.map((r: any) => [String(r.version), { name: r.name, checksum: r.checksum, applied_at: String(r.applied_at) }]),
    );

    if (process.argv.includes('--status')) {
      console.log(JSON.stringify({ schema_migration: appliedRows }, null, 2));
      return;
    }

    const report: Array<Record<string, unknown>> = [];
    for (const f of files) {
      const prev = applied.get(f.version);
      if (prev && prev.checksum === f.checksum) {
        report.push({ version: f.version, name: f.name, action: 'skipped', reason: 'already applied, checksum match', applied_at: prev.applied_at });
        continue;
      }
      if (prev && prev.checksum !== f.checksum) {
        report.push({ version: f.version, name: f.name, action: 'ABORT', reason: 'checksum drift: file changed after apply' });
        exitCode = 3;
        break;
      }

      const startedAt = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(f.sql);
        await client.query(
          'INSERT INTO schema_migration (version, name, checksum) VALUES ($1, $2, $3)',
          [f.version, f.name, f.checksum],
        );
        await client.query('COMMIT');
        report.push({ version: f.version, name: f.name, action: 'applied', checksum: f.checksum.slice(0, 12), ms: Date.now() - startedAt });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        const anyE = e as Record<string, unknown>;
        report.push({
          version: f.version,
          name: f.name,
          action: 'FAILED',
          message: String(anyE?.message || e).slice(0, 300),
          code: anyE?.code ?? null,
        });
        exitCode = 4;
        break;
      }
    }

    const tables = await client.query(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name
    `);
    const versions = await client.query('SELECT version, name, applied_at FROM schema_migration ORDER BY version');
    console.log(JSON.stringify({
      ok: exitCode === 0,
      applied_now: report,
      schema_version: versions.rows.length ? String(versions.rows[versions.rows.length - 1].version) : null,
      schema_migration_rows: versions.rows.map((r: any) => ({ version: r.version, name: r.name })),
      public_base_tables: tables.rows.map((r: any) => r.table_name),
      public_base_table_count: tables.rows.length,
    }, null, 2));
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
  process.exit(exitCode);
})().catch((e) => {
  console.error('migration fatal:', String((e as Error)?.message || e).slice(0, 300));
  process.exit(2);
});
