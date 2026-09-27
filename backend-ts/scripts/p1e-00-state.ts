/**
 * P1e · 真库状态读数（跑任何写入前后取样用）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1e-00-state.ts
 */
import { closePools, readQuery } from '../src/db';

(async () => {
  const one = async (sql: string) => (await readQuery<Record<string, unknown>>(sql))[0] ?? null;
  const many = async (sql: string) => readQuery<Record<string, unknown>>(sql);

  const out: Record<string, unknown> = {};
  out.counts = await one(`SELECT
      (SELECT count(*) FROM ledger_entry)  AS ledger_entry,
      (SELECT count(*) FROM account)       AS account,
      (SELECT count(*) FROM currency)      AS currency,
      (SELECT count(*) FROM ledger_owner)  AS ledger_owner,
      (SELECT count(*) FROM schema_migration) AS schema_migration`);
  out.schema_version = await one('SELECT version, name, applied_at FROM schema_migration ORDER BY version DESC LIMIT 1');
  out.schema_migration_all = await many('SELECT version, name, left(checksum, 12) AS checksum12 FROM schema_migration ORDER BY version');
  out.currency_rows = await many(
    'SELECT cid, symbol, owner_uid, decimals, total_supply, supply_cap, status FROM currency ORDER BY cid');
  out.platform_accounts = await many(
    'SELECT uid, cid, balance, frozen FROM account WHERE uid <= 0 ORDER BY uid, cid');
  out.by_cid = await many(
    `SELECT cid,
            count(*)                       AS accounts,
            SUM(balance)                   AS sum_balance,
            SUM(frozen)                    AS sum_frozen,
            SUM(balance + frozen)          AS sum_net
       FROM account GROUP BY cid ORDER BY cid`);
  out.test_accounts = await many(
    'SELECT uid, cid, balance, frozen FROM account WHERE uid >= 900000 ORDER BY uid, cid');
  out.ledger_by_cid = await many(
    `SELECT cid, count(*) AS entries, SUM(delta) AS sum_delta, SUM(frozen_delta) AS sum_frozen_delta,
            SUM(delta + frozen_delta) AS sum_net
       FROM ledger_entry GROUP BY cid ORDER BY cid`);
  out.fn_exists = await many(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, l.lanname
       FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
      WHERE p.proname = 'ledger_post_event'`);
  console.log(JSON.stringify(out, null, 2));
  await closePools();
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closePools().catch(() => undefined);
  process.exit(1);
});
