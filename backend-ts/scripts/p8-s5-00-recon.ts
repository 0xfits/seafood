/**
 * p8-s5 侦察（只读）：schema_migration / 四表触发器 / 状态分布 / 夹具候选。
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s5-00-recon.ts
 */
import '../src/env';
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  out.schema_info = await readQuery(`SELECT version, checksum, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version DESC LIMIT 6`);
  out.migrations = await readQuery(`SELECT count(*)::int AS n FROM public.schema_migration`);
  out.triggers = await readQuery(`
    SELECT c.relname AS table_name, t.tgname, t.tgenabled,
           t.tgtype::int AS tgtype, t.tgisinternal,
           p.proname AS fn
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE n.nspname='public' AND c.relname IN ('listing','listing_review_log','job','job_arbitration_log')
     ORDER BY c.relname, t.tgname`);
  out.listing_tables = await readQuery(`SELECT to_regclass('public.listing_review_log')::text AS listing_review_log, to_regclass('public.job_arbitration_log')::text AS job_arbitration_log`);
  out.listing_status = await readQuery(`SELECT status, count(*)::int AS n FROM public.listing GROUP BY status ORDER BY status`);
  out.job_status = await readQuery(`SELECT status, count(*)::int AS n FROM public.job GROUP BY status ORDER BY status`);
  out.listing_review_log_n = await readQuery(`SELECT count(*)::int AS n FROM public.listing_review_log`);
  out.job_arbitration_log_n = await readQuery(`SELECT count(*)::int AS n FROM public.job_arbitration_log`);
  out.admins = await readQuery(`SELECT uid, is_admin, evm FROM "users" WHERE is_admin = true ORDER BY uid LIMIT 10`);
  // 有 can_access_admin 但非 is_admin 的用户（权限表）
  out.perm_tables = await readQuery(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%permission%' ORDER BY table_name`);
  out.users_cols = await readQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
  // 候选：terminal 状态的 job（雇主非法/正常）
  out.terminal_jobs = await readQuery(`
    SELECT j.job_id, j.employer_uid, j.status, u.is_admin
      FROM public.job j JOIN "users" u ON u.uid=j.employer_uid
     WHERE j.status IN ('settled','cancelled','rejected')
     ORDER BY j.job_id DESC LIMIT 10`);
  // 候选：非终态 job 的雇主（用于 403 用户挑选）
  out.open_jobs = await readQuery(`
    SELECT j.job_id, j.employer_uid, j.status
      FROM public.job j WHERE j.status IN ('open','accepted','submitted','disputed')
     ORDER BY j.job_id DESC LIMIT 10`);
  // listed 币种
  out.currencies = await readQuery(`SELECT cid, symbol, status, deposit_cid FROM public.currency ORDER BY cid LIMIT 20`);
  // 余额最大的账户（cid + uid）
  out.top_accounts = await readQuery(`
    SELECT uid, cid, balance::text, frozen::text FROM public.account ORDER BY balance DESC LIMIT 12`);
  out.account_cols = await readQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='account' ORDER BY ordinal_position`);
  console.log(JSON.stringify(out, null, 1));
  await closePools();
  process.exit(0);
})().catch(async (e) => { console.error('RECON_CRASH', String((e as Error)?.stack || e).slice(0, 1500)); await closePools().catch(() => undefined); process.exit(2); });
