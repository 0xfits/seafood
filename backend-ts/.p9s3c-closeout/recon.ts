// P9③ 收口（Kong）· 只读 recon 探针（不写任何数据）— 放 .p9s3c-closeout/（不进 scripts/）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (sql: string) => (await pool.query(sql)).rows;
  const out: Record<string, unknown> = {};
  out.users_cols = await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position`);
  out.users_count = await q(`select count(*)::int n from public.users`);
  out.users_sample = await q(`select uid::text, is_admin from public.users order by uid limit 12`);
  out.currency_cols = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='currency' order by ordinal_position`);
  out.currency_sample = await q(`select cid::text, owner_uid::text, status from public.currency order by cid limit 6`);
  out.listing_sample = await q(`select listing_id::text, seller_uid::text, cid::text, price, status from public.listing order by listing_id limit 6`);
  out.listing_order_count = await q(`select count(*)::int n from public.listing_order`);
  out.listing_order_sample = await q(`select order_id::text, listing_id::text, buyer_uid::text, seller_uid::text, cid::text, status from public.listing_order order by order_id desc limit 6`);
  out.job_count = await q(`select count(*)::int n from public.job`);
  out.job_sample = await q(`select job_id::text, employer_uid::text, worker_uid::text, cid::text, status from public.job order by job_id limit 6`);
  out.job_submission_count = await q(`select count(*)::int n from public.job_submission`);
  out.job_submission_sample = await q(`select submission_id::text, job_id::text, worker_uid::text, review_status, reviewed_at from public.job_submission order by submission_id limit 6`);
  out.rating_count = await q(`select count(*)::int n from public.rating`);
  out.order_event_count = await q(`select count(*)::int n from public.listing_order_event`);
  out.app_config_rating_policy = await q(`select key from public.app_config where key in ('rating_policy','checkin_policy','batt_policy')`);
  out.job_submission_cols = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='job_submission' order by ordinal_position`);
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('RECON_FAIL', e?.message || e); process.exit(1); });
