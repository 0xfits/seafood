/** P9④ 质检 · 现取侦察（只读）· 角色 Neng。 */
import { readQuery, closePools } from '../src/db';
import * as fs from 'fs';

async function main(): Promise<void> {
  const out: Record<string, unknown> = {};
  out.schema_version = await readQuery<{ v: string | null }>(
    'SELECT (SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1) AS v');
  out.schema_rows = await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.schema_migration');
  out.base_tables = await readQuery<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  out.bttc_row = await readQuery(
    `SELECT cid::text, symbol, name, owner_uid::text, decimals, status, total_supply::text, is_platform_coin, supply_cap::text
       FROM public.currency WHERE symbol='BTTC'`);
  out.currency_total = await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.currency');
  out.currency_true_flag = await readQuery<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.currency WHERE is_platform_coin`);
  out.kind_enum = await readQuery<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`);
  out.batt_account = await readQuery<{ uid: string; batt: number }>(
    'SELECT uid::text, batt FROM public.batt_account ORDER BY uid');
  out.usd_accounts = await readQuery<{ uid: string; cid: string; balance: string }>(
    "SELECT uid::text, cid::text, balance::text FROM public.account WHERE cid=1 ORDER BY uid LIMIT 20");
  out.bttc_accounts = await readQuery<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.account WHERE cid=(SELECT cid FROM public.currency WHERE symbol='BTTC')");
  out.app_config_keys = await readQuery<{ key: string }>('SELECT key FROM public.app_config ORDER BY key');
  out.review_log_rows = await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.currency_review_log');
  out.currency_rows = await readQuery(
    'SELECT cid::text, symbol, status, owner_uid::text, is_platform_coin, deposit_amount::text FROM public.currency ORDER BY cid LIMIT 20');
  console.log(JSON.stringify(out, null, 2));
  await closePools();
}
main().catch((e) => { console.error('ERR', (e as Error).message); process.exit(1); });
