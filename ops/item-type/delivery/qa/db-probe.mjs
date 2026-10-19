// QA 基线 / 回收对拍探针 · 数字商品拆分批次（0054 四值）
// 只读：dev 库计数面 + 全量 listing.item_type 分布；零写。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = '/Users/kevin/bistro/seafood';
const OUT = process.env.OUT_FILE || path.join(REPO, 'ops/item-type/delivery/qa/readings/db-baseline.json');
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');

const envText = fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);

const projectId = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid;
const branch = (await sql`SELECT current_setting('neon.branch_id', true) AS b`)[0].b;
const schemaTop = (await sql`SELECT version, name, applied_at FROM public.schema_migration ORDER BY version DESC LIMIT 3`);
const schemaCount = (await sql`SELECT count(*)::int AS n FROM public.schema_migration`)[0].n;

const TABLES = ['listing', 'listing_order', 'conversation', 'message', 'ledger_entry', 'listing_favorite', 'listing_review_log', 'content_translation', 'media'];
const counts = {};
for (const t of TABLES) counts[t] = (await sql(`SELECT count(*)::int AS n FROM public.${t}`))[0].n;

const dist = await sql`SELECT COALESCE(item_type, '<NULL>') AS v, count(*)::int AS n FROM public.listing GROUP BY 1 ORDER BY 1`;
const rows = await sql`SELECT listing_id, status, item_type, left(title, 40) AS title FROM public.listing ORDER BY listing_id`;

const constraints = await sql`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE conrelid = 'public.listing'::regclass AND conname LIKE '%item_type%'`;

const out = {
  at: new Date().toISOString(),
  project_id: projectId, branch_id: branch,
  schema_top: schemaTop, schema_migration_rows: schemaCount,
  table_counts: counts,
  listing_total: counts.listing,
  item_type_distribution: dist,
  item_type_constraints: constraints,
  non_null_item_type_rows: rows.filter((r) => r.item_type !== null).length,
  rows,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ at: out.at, project_id: projectId, schema_top: schemaTop[0], listing_total: out.listing_total, counts, distribution: dist, non_null: out.non_null_item_type_rows, constraint: constraints }, null, 2));
