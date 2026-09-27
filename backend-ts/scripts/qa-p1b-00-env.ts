/**
 * P1a 并发质检 · 00 环境与基线探针
 * ---------------------------------------------------------------------------
 * 质检方（Neng）自写；**不**调用、**不**引用实现方 scripts/ledger-smoke.ts。
 * 运行：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-00-env.ts
 * 只读为主；不写任何业务表。
 */
import { readQuery, withTransaction, txQuery, closePools } from '../src/db';
import { sumAccountTotals, findAccountDrift, SYSTEM_CURRENCY_CID } from '../src/ledger';

const out: Record<string, unknown> = {};
const j = (v: unknown) => JSON.stringify(v);

const timeIt = async (label: string, n: number, fn: () => Promise<unknown>) => {
  const t0 = Date.now();
  for (let i = 0; i < n; i += 1) await fn();
  const ms = Date.now() - t0;
  out[label] = { n, total_ms: ms, avg_ms: Number((ms / n).toFixed(2)) };
};

(async () => {
  // ---------------------------------------------------------------- 运行时
  out.runtime = {
    node: process.version,
    tx_pool_max_env: process.env.SEAFOOD_TX_POOL_MAX ?? '(unset -> 默认 4)',
    read_pool_max_env: process.env.SEAFOOD_READ_POOL_MAX ?? '(unset -> 默认 4)',
  };

  // ---------------------------------------------------------------- 服务端参数（直连）
  const settings = await withTransaction(async (tx) =>
    txQuery<Record<string, string>>(tx, `SELECT name, setting, unit FROM pg_settings
        WHERE name IN ('server_version','max_connections','deadlock_timeout',
                       'statement_timeout','lock_timeout','default_transaction_isolation')`));
  out.server_settings = settings;

  out.pg_time_and_dl = (await withTransaction(async (tx) =>
    txQuery<Record<string, unknown>>(tx, `SELECT now() AS now,
        (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()) AS deadlocks_total,
        (SELECT xact_commit FROM pg_stat_database WHERE datname = current_database()) AS xact_commit`)))[0];

  // ---------------------------------------------------------------- 表 / 行数
  out.tables = await readQuery(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  out.row_counts = await withTransaction(async (tx) =>
    txQuery(tx, `SELECT 'currency' t, count(*) n FROM currency
      UNION ALL SELECT 'account', count(*) FROM account
      UNION ALL SELECT 'ledger_entry', count(*) FROM ledger_entry
      UNION ALL SELECT 'ledger_owner', count(*) FROM ledger_owner
      UNION ALL SELECT 'user', count(*) FROM "user"
      UNION ALL SELECT 'schema_migration', count(*) FROM schema_migration
      ORDER BY 1`));

  // ---------------------------------------------------------------- 守卫触发器是否启用（取证）
  out.triggers = await withTransaction(async (tx) =>
    txQuery(tx, `SELECT c.relname AS tbl, t.tgname, t.tgenabled
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal AND c.relname IN ('account','ledger_entry','currency')
       ORDER BY 1,2`));

  // ---------------------------------------------------------------- 关键约束
  out.constraints = await withTransaction(async (tx) =>
    txQuery(tx, `SELECT conname, pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conrelid IN ('account'::regclass,'ledger_entry'::regclass,'currency'::regclass)
       ORDER BY conrelid::text, conname`));

  // ---------------------------------------------------------------- 延迟基线
  await timeIt('latency_readQuery_select1', 30, () => readQuery('SELECT 1'));
  await timeIt('latency_withTransaction_begin_commit', 10, () =>
    withTransaction(async (tx) => txQuery(tx, 'SELECT 1')));
  await timeIt('latency_tx_forupdate_read', 10, () =>
    withTransaction(async (tx) =>
      txQuery(tx, 'SELECT balance FROM account WHERE uid = 0 AND cid = $1 FOR UPDATE',
        [SYSTEM_CURRENCY_CID.toString()])));

  // ---------------------------------------------------------------- 基线读数
  out.sum_account_totals_before = await sumAccountTotals();
  out.drift_before = await findAccountDrift();
  out.currencies = await readQuery(
    `SELECT cid, symbol, owner_uid, decimals, total_supply, supply_cap, status FROM currency ORDER BY cid`);
  out.accounts_over_900000 = await readQuery(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid >= 900000 ORDER BY uid, cid`);
  out.platform_accounts = await readQuery(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid <= 0 ORDER BY uid, cid`);
  out.qa1b_entries = await readQuery(
    `SELECT count(*) AS n FROM ledger_entry WHERE idempotency_key LIKE 'qa1b:%'`);

  console.log(j(out));
  await closePools();
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closePools().catch(() => undefined);
  process.exit(1);
});
