/**
 * P3-S1b · 探针 00：catalog 指纹快照（表/索引/列/约束/函数 + 全表行数 + 计数）
 * 用法：npx ts-node --transpile-only scripts/p3s1b-00-catalog-state.ts <label>
 * 只读：全部为 SELECT（无任何 DDL/DML）。
 *
 * 目的：给「请求路径不再有 schema 变更语句」提供一条比 xact_commit 更硬的运行时读数 ——
 *       下列 DDL 段任一条真的跑过，指纹必变：
 *         CREATE/ALTER/DROP TABLE  → pg_class / pg_attribute / pg_constraint
 *         RENAME TO                → pg_class.relname
 *         CREATE/ALTER/DROP INDEX  → pg_class(relkind='i') / pg_index
 *         CREATE [OR REPLACE] FUNCTION → pg_proc(proname, prosrc md5)
 *         TRUNCATE                 → 全表行数
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';

const EXPECTED = ['account', 'commission_policy', 'currency', 'ledger_entry',
  'ledger_owner', 'referral', 'schema_migration', 'users'];

(async () => {
  const pool = new Pool({ connectionString: URL, max: 1, connectionTimeoutMillis: 30_000 });
  const q = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, p as never[])).rows as R[];

  const label = process.argv[2] || 'run';
  const out: Record<string, unknown> = {
    probe: 'P3S1B-00-CATALOG-STATE',
    label,
    ts: new Date().toISOString(),
    db: (await q<{ d: string; v: string }>(
      `SELECT current_database() AS d, version() AS v`))[0],
  };

  out.tables = (await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`))
    .map((r) => r.table_name);
  out.table_count = (out.tables as string[]).length;
  out.expected_tables = EXPECTED;
  out.table_set_matches_expected =
    JSON.stringify(out.tables) === JSON.stringify([...EXPECTED].sort());

  out.indexes = (await q<{ indexname: string; tablename: string }>(
    `SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`))
    .map((r) => `${r.tablename}.${r.indexname}`);
  out.index_count = (out.indexes as string[]).length;

  // 全表行数（TRUNCATE / 写入都会暴露）
  const counts: Record<string, number> = {};
  for (const t of out.tables as string[]) {
    counts[t] = Number((await q<{ n: string }>(`SELECT count(*)::text AS n FROM "${t}"`))[0].n);
  }
  out.table_row_counts = counts;
  out.users_rows = counts.users ?? null;

  out.schema_migration_rows = Number(
    (await q<{ n: string }>(`SELECT count(*)::text AS n FROM schema_migration`))[0].n);
  out.schema_version = (await q<{ version: string }>(
    `SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1`))[0]?.version ?? null;

  // 事务计数（含只读事务 ⇒ 非 DDL 专属，仅登记）
  const stat = (await q<{ datname: string; xact_commit: string; xact_rollback: string }>(
    `SELECT datname, xact_commit::text, xact_rollback::text FROM pg_stat_database
      WHERE datname = current_database()`))[0];
  out.pg_stat_database = {
    datname: stat?.datname ?? null,
    xact_commit: stat ? Number(stat.xact_commit) : null,
    xact_rollback: stat ? Number(stat.xact_rollback) : null,
  };

  // catalog 指纹：任一 DDL 段命中即变化
  const cls = await q(`SELECT oid::text, relname, relkind, relnatts::text FROM pg_class
                        WHERE relnamespace = 'public'::regnamespace ORDER BY oid`);
  const att = await q(`SELECT attrelid::text, attname, attnum::text, atttypid::text, attnotnull::text
                        FROM pg_attribute WHERE attrelid IN
                        (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)
                        ORDER BY attrelid, attnum`);
  const idx = await q(`SELECT indexrelid::text, indrelid::text, indisunique::text, indisprimary::text
                        FROM pg_index WHERE indrelid IN
                        (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)
                        ORDER BY indexrelid`);
  const con = await q(`SELECT oid::text, conname, contype, conrelid::text FROM pg_constraint
                        WHERE connamespace = 'public'::regnamespace ORDER BY oid`);
  const proc = await q(`SELECT oid::text, proname, prokind, md5(coalesce(prosrc,'')) AS src_md5
                        FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid`);

  out.catalog_counts = {
    pg_class: cls.length, pg_attribute: att.length, pg_index: idx.length,
    pg_constraint: con.length, pg_proc_public: proc.length,
  };
  const blob = JSON.stringify({ tables: out.tables, indexes: out.indexes, counts, cls, att, idx, con, proc });
  out.catalog_fingerprint_sha256 = crypto.createHash('sha256').update(blob).digest('hex');
  out.db_error = null;

  const dir = path.resolve(__dirname, '..', '.p3s1-artifacts');
  const fs = await import('fs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `p3s1b-catalog-${label}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
})().catch(async (e) => {
  console.log(JSON.stringify({ probe: 'P3S1B-00-CATALOG-STATE', fatal: String((e as Error)?.message ?? e) }, null, 2));
  process.exit(2);
});
