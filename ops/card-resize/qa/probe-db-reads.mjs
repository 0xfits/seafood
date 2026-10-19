// card-resize QA · 只读 DB 探针（dev + 生产自证）——零写
// 用法: node ops/card-resize/qa/probe-db-reads.mjs
// 产出: ops/card-resize/qa/readings/db-dev.json, db-prod.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/kevin/bistro/seafood';
const req = createRequire(path.join(ROOT, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');
const dotenv = req('dotenv');

// 显式从 env 文件 parse 串、不吃 process.env（防 source 污染）
const devParsed = dotenv.parse(fs.readFileSync(path.join(ROOT, 'backend-ts/.env.local'), 'utf8'));
const devUrl = devParsed.DATABASE_URL_UNPOOLED || devParsed.POSTGRES_URL_NON_POOLING || devParsed.DATABASE_URL;
const prodParsed = dotenv.parse(fs.readFileSync('/Users/kevin/.config/seafood/prod-db.env', 'utf8'));
const prodUrl = prodParsed.DATABASE_URL_UNPOOLED || prodParsed.POSTGRES_URL_NON_POOLING || prodParsed.DATABASE_URL;

const READS = {
  project_id: `SELECT current_setting('neon.project_id', true) AS v`,
  schema_top: `SELECT version::text AS v FROM public.schema_migration ORDER BY version DESC LIMIT 1`,
  schema_rows: `SELECT count(*)::int AS v FROM public.schema_migration`,
  avatar_url_col: `SELECT count(*)::int AS v FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='avatar_url'`,
  rating_count: `SELECT count(*)::int AS v FROM public.rating`,
  rating_trigger: `SELECT tgenabled AS v FROM pg_trigger WHERE tgname='trg_rating_append_only' AND tgrelid='public.rating'::regclass`,
  rating_qa_rows: `SELECT count(*)::int AS v FROM public.rating WHERE idempotency_key LIKE 'qa:card-resize%'`,
};

const DEV_EXTRA = {
  listings: `SELECT listing_id::text AS id, seller_uid::text AS seller, status FROM public.listing ORDER BY listing_id DESC LIMIT 40`,
  users_sample: `SELECT uid::text AS v FROM public.users ORDER BY uid DESC LIMIT 5`,
};

async function readDb(url, name, extra = {}) {
  const sql = neon(url);
  const out = {};
  for (const [k, q] of Object.entries(READS)) {
    const rows = await sql(q);
    out[k] = rows[0] ? rows[0].v : null;
  }
  for (const [k, q] of Object.entries(extra)) {
    out[k] = await sql(q);
  }
  fs.writeFileSync(path.join(ROOT, `ops/card-resize/qa/readings/db-${name}.json`), JSON.stringify(out, null, 2));
  console.log(`[${name}] project=${out.project_id} schema_top=${out.schema_top} rating_count=${out.rating_count} trigger=${out.rating_trigger}`);
  return out;
}

const [dev, prod] = await Promise.all([
  readDb(devUrl, 'dev', DEV_EXTRA),
  readDb(prodUrl, 'prod'),
]);

// 摘要（不打印完整 listing 行，只打 seller 分布）
const sellers = {};
for (const r of dev.listings || []) sellers[r.seller] = (sellers[r.seller] || 0) + 1;
console.log('DEV seller_uid 分布:', JSON.stringify(sellers));
console.log('PROD project 期望 sweet-pond-28934105, 实取:', prod.project_id);
