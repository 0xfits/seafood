/* P4-B2a-HTTP probe (§5.7① 带引号对象断言；只读 HTTP neon) */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DATABASE_URL');
const sql = neon(url);

const outDir = process.argv[2] || '.p4-artifacts/probe';
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const result: Record<string, unknown> = {};

  // ① 带引号真表名断言：current_user 不被 FROM user 混淆
  result.assert_users_table = await sql`
    SELECT to_regclass('public.users') AS users_regclass,
           (SELECT column_name FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users' AND column_name='uid' LIMIT 1) AS has_uid,
           (SELECT column_name FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users' AND column_name='uID' LIMIT 1) AS has_bad_uID,
           (SELECT column_name FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users' AND column_name='evm' LIMIT 1) AS has_evm,
           (SELECT column_name FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users' AND column_name='EVM' LIMIT 1) AS has_bad_EVM
  `;

  result.columns = {};
  for (const t of ['users', 'job', 'job_application', 'job_submission', 'account', 'ledger_entry', 'currency', 'listing']) {
    const rows = await sql`
      SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
       WHERE table_schema='public' AND table_name=${t}
       ORDER BY ordinal_position`;
    (result.columns as Record<string, unknown>)[t] = rows;
  }

  // ② 全 public 表行数（单条 union）
  result.row_counts = await sql`
    SELECT relname AS table_name, n_live_tup AS live_tup
      FROM pg_stat_user_tables
     ORDER BY relname`;

  // ③ 夹具真值
  result.fixtures = {
    users: await sql`SELECT uid, evm, bio, is_admin, time_reg, time_login_last FROM public."users" WHERE uid IN (970001, 970002) ORDER BY uid`,
    job: await sql`SELECT job_id, status, employer_uid, worker_uid FROM public.job ORDER BY job_id`,
    job_application: await sql`SELECT application_id, job_id, worker_uid, status, create_key FROM public.job_application ORDER BY application_id`,
    job_submission: await sql`SELECT submission_id, job_id, worker_uid, review_status, create_key, left(deliverable,60) AS deliverable_head FROM public.job_submission ORDER BY submission_id`,
    account_nonfund: await sql`SELECT COUNT(1)::int AS rows, COALESCE(SUM(balance),0)::bigint AS sum_balance FROM public.account`,
    ledger_entry_count: await sql`SELECT COUNT(1)::int AS rows FROM public.ledger_entry`,
  };

  // ④ 幂等键唯一约束（route spec 依赖 ON CONFLICT (create_key)）
  result.indexes = await sql`
    SELECT tablename, indexname, indexdef
      FROM pg_indexes
     WHERE schemaname='public'
       AND tablename IN ('job_application','job_submission','users')
     ORDER BY tablename, indexname`;

  fs.writeFileSync(`${outDir}/probe.json`, JSON.stringify(result, null, 2));
  console.log('WROTE', `${outDir}/probe.json`);
  console.log('assert_users_table =', JSON.stringify(result.assert_users_table));
  console.log('users cols =', JSON.stringify((result.columns as any).users));
}

main().catch((e) => { console.error('PROBE_FAIL', e); process.exit(1); });
