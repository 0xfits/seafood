/**
 * 8③ 现取探针（**只读**）：`app_config` 行集 / 候选出资账户 / `currency` 表形态 / 账本基线计数。
 * 只打印结构 / 计数 / 机读字段 —— **不打印任何密钥 / 连接串**。
 */
import '../src/env';
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  out.app_config_rows = await readQuery(
    `SELECT key, jsonb_typeof(value) AS vtype, value FROM public.app_config ORDER BY key`);
  out.account_cid1_top = await readQuery(
    `SELECT uid::text AS uid, balance::text AS balance, frozen::text AS frozen
       FROM public.account WHERE cid = 1 AND uid > 0 ORDER BY balance DESC LIMIT 8`);
  out.currency_n = await readQuery(`SELECT count(*)::int AS n, max(cid)::text AS max_cid FROM public.currency`);
  out.currency_sample = await readQuery(
    `SELECT cid::text AS cid, symbol, owner_uid::text AS owner_uid, status, deposit_cid::text AS deposit_cid
       FROM public.currency ORDER BY cid LIMIT 5`);
  out.ledger_entry_n = await readQuery(`SELECT count(*)::int AS n FROM public.ledger_entry`);
  out.currency_status_log_n = await readQuery(`SELECT count(*)::int AS n FROM public.currency_status_log`);
  out.sys_currency = await readQuery(
    `SELECT cid::text AS cid, symbol, owner_uid::text AS owner_uid, status FROM public.currency WHERE cid = 1`);
  out.accounts_cid1_n = await readQuery(
    `SELECT count(*)::int AS n FROM public.account WHERE cid = 1`);
  out.switch = await readQuery(`SELECT current_database() AS db, current_user AS usr`);
  console.log(JSON.stringify(out, null, 1));
  await closePools();
  process.exit(0);
})().catch(async (e) => { console.error('PROBE_FAIL', String(e).slice(0, 400)); await closePools().catch(() => undefined); process.exit(1); });
