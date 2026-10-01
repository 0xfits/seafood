/**
 * P6-i18n 取证探针（只读）：核对「三语列是否真存在于库」+ 内容表清单 + schema_migration 现状。
 * 用法：npx ts-node --transpile-only scripts/p4z-p6i18n-00-schema.ts
 * 安全：仅 SELECT；不读 .env.local 的值（dotenv 内部加载，不打印）。
 */
import { readQuery, closePools } from '../src/db';

const main = async () => {
  const out: Record<string, unknown> = {};

  out.trilingual_cols = await readQuery(`
    SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name ~ '(_en|_hk|_vn)$' OR column_name ~ '^(en|hk|vn)$')
    ORDER BY table_name, column_name
  `);

  out.listing_cols = await readQuery(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('job','listing')
    ORDER BY table_name, ordinal_position
  `);

  out.legacy_tables_exist = await readQuery(`
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
      AND c.relname IN ('task','prize','prize_item','asset','task_progress','shard','shard_transfer','brand','users')
    ORDER BY t
  `);

  out.public_tables = await readQuery(`
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY t
  `);

  out.migrations = await readQuery(
    `SELECT version, name FROM schema_migration ORDER BY version`,
  );

  out.job_counts = await readQuery(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE title <> '')::int AS title_nonempty FROM job`,
  );
  out.listing_counts = await readQuery(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE title <> '')::int AS title_nonempty FROM listing`,
  );

  console.log(JSON.stringify(out, null, 1));
  await closePools();
};

main().catch(async (e) => {
  console.error('PROBE_FAILED', (e as Error).message);
  try { await closePools(); } catch { /* noop */ }
  process.exit(1);
});
