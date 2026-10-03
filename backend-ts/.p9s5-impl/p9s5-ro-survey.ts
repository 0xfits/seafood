/**
 * P9⑤ 收尾单 A · 只读侦察探针（不做任何写；仅 SELECT / 目录查询）。
 * 目的：现取 0038 相关活体面（kind 闭集 / 两函数指纹 / 表行数 / 样本 fixture），
 * 为「0038 真跑自证」与「两新方法事务内真跑」提供 before 基线。
 * 入 .p9s5-impl/（不入 scripts/ 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, closePools } from '../src/db';

const OUT = path.resolve(__dirname, '..', '.p9s5-impl');
fs.mkdirSync(OUT, { recursive: true });
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

const q = <T = Record<string, unknown>>(s: string, p?: unknown[]) => readQuery<T>(s, p);

(async () => {
  const out: Record<string, unknown> = {};
  try {
    out.schema_version = (await q<{ v: string | null }>(
      'SELECT (SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1) AS v'))[0]?.v;
    out.schema_migration = (await q(
      'SELECT count(*)::int AS n, min(version) AS vmin, max(version) AS vmax FROM schema_migration'))[0];

    out.ledger_kind_enum = (await q<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`))[0]?.def;

    out.fn_ledger_kind_ok = (await q(
      `SELECT md5(p.prosrc) AS md5, length(p.prosrc)::int AS len, p.prosecdef AS secdef
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_kind_ok'`))[0];
    out.fn_assert_platform = (await q(
      `SELECT md5(p.prosrc) AS md5, length(p.prosrc)::int AS len
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_assert_platform_mutation'`))[0];

    out.ledger_kind_ok_behaviors = (await q(
      `SELECT ledger_kind_ok('invite_first_task_reward') AS new_kind,
              ledger_kind_ok('bttc_burn_fee') AS old_last,
              ledger_kind_ok('made_up_kind') AS bogus,
              ledger_kind_ok('invite_first_task_reward', true) AS new_under_frozen`))[0];

    out.counts = (await q(
      `SELECT
         (SELECT count(*)::int FROM public.users) AS users,
         (SELECT count(*)::int FROM public.referral) AS referral,
         (SELECT count(*)::int FROM public.job) AS job,
         (SELECT count(*)::int FROM public.batt_account) AS batt_account,
         (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
         (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
         (SELECT count(*)::int FROM public.account WHERE uid=-1) AS acct_minus1,
         (SELECT count(*)::int FROM public.currency) AS currency,
         (SELECT count(*)::int FROM public.app_config) AS app_config`))[0];

    out.app_config_keys = await q<{ key: string }>('SELECT key FROM public.app_config ORDER BY key');
    out.currency_rows = await q('SELECT cid::text, symbol, decimals, status FROM public.currency ORDER BY cid LIMIT 12');
    out.acct_minus1 = await q(
      `SELECT uid::text, cid::text, balance::text, frozen::text FROM public.account WHERE uid=-1 ORDER BY cid LIMIT 8`);
    out.sample_jobs = await q(
      `SELECT job_id::text, employer_uid::text, worker_uid::text, cid::text, reward::text, status
         FROM public.job ORDER BY job_id DESC LIMIT 5`);
    out.sample_referral = await q(
      `SELECT child_uid::text, parent_uid::text, depth::int, bound_at::text
         FROM public.referral ORDER BY child_uid DESC LIMIT 5`);
    out.max_uid = (await q<{ m: string }>('SELECT COALESCE(max(uid),0)::text AS m FROM public.users'))[0]?.m;

    // batt_account / batt_entry / referral 列形状（构造 fixture 用）
    out.batt_acct_cols = await q(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='batt_account' ORDER BY ordinal_position`);
    out.referral_cols = await q(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='referral' ORDER BY ordinal_position`);
    out.ledger_entry_cols = await q(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ledger_entry' ORDER BY ordinal_position`);
    out.platform_assert_src = (await q<{ s: string }>(
      `SELECT p.prosrc AS s FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_assert_platform_mutation'`))[0]?.s;
  } catch (e) {
    out.ERROR = String((e as Error)?.stack || e).slice(0, 800);
  }
  fs.writeFileSync(path.join(OUT, `p9s5-survey-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
