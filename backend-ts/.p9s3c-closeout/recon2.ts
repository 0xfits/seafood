// P9③ 收口 recon2（只读）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (sql: string) => (await pool.query(sql)).rows;
  const out: Record<string, unknown> = {};
  out.users_constraints = await q(`select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid='public.users'::regclass order by conname`);
  out.job_settled_approved = await q(`select j.job_id::text, j.employer_uid::text emp, s.worker_uid::text wk, j.status, s.review_status, (s.reviewed_at is not null) has_rev from public.job j join public.job_submission s on s.job_id=j.job_id where s.review_status='approved' and j.status='settled' limit 10`);
  out.clean_employers = await q(`select u.uid::text from public.users u where u.is_admin is not true and not exists (select 1 from public.job j join public.job_submission s on s.job_id=j.job_id where j.employer_uid=u.uid and s.review_status='approved' and j.status='settled') order by u.uid limit 6`);
  out.clean_workers = await q(`select u.uid::text from public.users u where u.is_admin is not true and not exists (select 1 from public.job j join public.job_submission s on s.job_id=j.job_id where s.worker_uid=u.uid and s.review_status='approved' and j.status='settled') order by u.uid limit 6`);
  out.listing_order_count = await q(`select count(*)::int n from public.listing_order`);
  out.listing_order_sample = await q(`select order_id::text, listing_id::text, buyer_uid::text, seller_uid::text, cid::text, status from public.listing_order order by order_id desc limit 5`);
  out.jobs_settled = await q(`select job_id::text, employer_uid::text, worker_uid::text, status from public.job where status='settled' order by job_id limit 10`);
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('RECON_FAIL', e?.message || e); process.exit(1); });
