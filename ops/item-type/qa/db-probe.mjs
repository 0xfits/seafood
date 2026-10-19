// 只读库面探针（QA · item-type）——零写。用法：node db-probe.mjs [tag]
// 口径：显式解析 backend-ts/.env.local 后自建 neon() 连接（不吃 process.env，避免会话里 source 过的生产串污染）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = '/Users/kevin/bistro/seafood';
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');

const envFile = path.join(REPO, 'backend-ts/.env.local');
const envText = fs.readFileSync(envFile, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
const sql = neon(url);

const tag = process.argv[2] || 'snapshot';

const projectId = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid;
const schema = (await sql`SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1`)[0].version;
const migrationRows = (await sql`SELECT count(*)::int AS n FROM public.schema_migration`)[0].n;
const listingCount = (await sql`SELECT count(*)::int AS n FROM public.listing`)[0].n;
const byType = await sql`
  SELECT COALESCE(item_type, '<<NULL>>') AS item_type, count(*)::int AS n
    FROM public.listing GROUP BY 1 ORDER BY 1`;
const listings = await sql`
  SELECT listing_id, seller_uid, title, status, item_type, time_created
    FROM public.listing ORDER BY listing_id DESC LIMIT 8`;
const refCounts = {};
for (const t of ['listing_order', 'conversation', 'message', 'ledger_entry', 'listing_favorite', 'media']) {
  const r = await sql(`SELECT count(*)::int AS n FROM public.${t}`);
  refCounts[t] = r[0].n;
}
const colCount = (await sql`
  SELECT count(*)::int AS n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='listing'`)[0].n;

console.log(JSON.stringify({
  tag,
  at: new Date().toISOString(),
  project_id: projectId,
  schema_version: schema,
  schema_migration_rows: migrationRows,
  listing_columns: colCount,
  listing_count: listingCount,
  listing_by_item_type: byType,
  recent_listings: listings,
  table_counts: refCounts,
}, null, 2));
