/**
 * 8③ 现取探针（**只读** · 扩 `p8-s3-00`）：`account` 全 cid 余额分布 / `-1` 余额 / `currency` 形态 /
 * 账本基线计数 / `app_config` 键集。只打印结构 / 计数 / 机读字段 —— **不打印任何密钥 / 连接串**。
 */
import '../src/env';
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  out.app_config_keys = await readQuery(
    `SELECT key, jsonb_typeof(value) AS vtype FROM public.app_config ORDER BY key`);
  out.acct_by_cid = await readQuery(
    `SELECT cid::text AS cid, count(*)::int AS n, max(balance)::text AS max_bal
       FROM public.account GROUP BY cid ORDER BY cid`);
  out.top_any_uid_pos = await readQuery(
    `SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
       FROM public.account WHERE uid > 0 ORDER BY balance DESC LIMIT 10`);
  out.platform_accounts = await readQuery(
    `SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
       FROM public.account WHERE uid <= 0 ORDER BY uid, cid LIMIT 40`);
  out.counts = await readQuery(
    `SELECT (SELECT count(*)::int FROM public.currency) AS currency_n,
            (SELECT max(cid)::text FROM public.currency) AS max_cid,
            (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry_n,
            (SELECT count(*)::int FROM public.account) AS account_n,
            (SELECT count(*)::int FROM public.app_config) AS app_config_n,
            (SELECT max(txid)::text FROM public.ledger_entry) AS max_txid,
            (SELECT count(*)::int FROM public.currency_status_log) AS status_log_n`);
  console.log(JSON.stringify(out, null, 1));
  await closePools();
  process.exit(0);
})().catch(async (e) => { console.error('PROBE_FAIL', String(e).slice(0, 400)); await closePools().catch(() => undefined); process.exit(1); });
