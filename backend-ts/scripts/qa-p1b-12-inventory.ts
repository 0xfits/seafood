/**
 * P1a 并发质检 · 12 测试数据清单 + 收尾基线复核（只读）
 * 运行：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-12-inventory.ts
 */
import { readQuery } from '../src/db';
import { sumAccountTotals, findAccountDrift } from '../src/ledger';
import { j, qaDrift, qaMinBalance } from './qa-p1b-lib';

(async () => {
  const currencies = await readQuery<Record<string, string>>(
    `SELECT cid, symbol, owner_uid, total_supply, supply_cap, status FROM currency
      WHERE symbol LIKE 'qa1b%' ORDER BY cid`);
  const accounts = await readQuery<Record<string, string>>(
    `SELECT uid, cid, balance, frozen, version FROM account WHERE uid >= 910000 ORDER BY uid, cid`);
  const entryStats = await readQuery<Record<string, string>>(
    `SELECT kind, count(*) AS n, SUM(delta) AS sum_delta, SUM(frozen_delta) AS sum_frozen
       FROM ledger_entry WHERE idempotency_key LIKE 'ops:qa1b:%' GROUP BY kind ORDER BY kind`);
  const entryTotal = (await readQuery<{ n: string; mx: string; mn: string }>(
    `SELECT count(*) AS n, min(txid) AS mn, max(txid) AS mx FROM ledger_entry
      WHERE idempotency_key LIKE 'ops:qa1b:%'`))[0];
  const keyPrefixes = await readQuery<Record<string, string>>(
    `SELECT regexp_replace(idempotency_key, ':[0-9]+$', ':#') AS pattern, count(*) AS n
       FROM ledger_entry WHERE idempotency_key LIKE 'ops:qa1b:%' GROUP BY 1 ORDER BY 2 DESC`);
  const allEntries = (await readQuery<{ n: string; mn: string; mx: string }>(
    'SELECT count(*) AS n, min(txid) AS mn, max(txid) AS mx FROM ledger_entry'))[0];
  const foreignCurrencyEntries = await readQuery<Record<string, string>>(
    `SELECT cid, count(*) AS n FROM ledger_entry WHERE cid NOT IN
       (SELECT cid FROM currency WHERE symbol LIKE 'qa1b%') GROUP BY cid ORDER BY cid`);
  const nonQaAccounts = await readQuery<Record<string, string>>(
    `SELECT uid, cid, balance FROM account WHERE uid < 900000 OR (uid >= 900000 AND uid < 910000)
      ORDER BY uid, cid`);
  const qaEntryKeys = await readQuery<Record<string, string>>(
    `SELECT idempotency_key, count(*) AS n FROM ledger_entry WHERE idempotency_key LIKE 'ops:qa1b:%'
      GROUP BY 1 ORDER BY 1 LIMIT 400`);

  console.log(j({
    case: '12-inventory',
    qa1b_currencies: currencies,
    qa_accounts_created: accounts,
    qa_account_count: accounts.length,
    qa_entry_total_by_kind: entryStats,
    qa_entry_total: entryTotal,
    qa_key_patterns: keyPrefixes,
    all_entries: allEntries,
    entries_by_cid_for_non_qa_currencies: foreignCurrencyEntries,
    pre_existing_accounts_untouched: nonQaAccounts,
    final_baseline: {
      sum_account_totals: await sumAccountTotals(),
      drift_impl: (await findAccountDrift()).length,
      drift_qa: (await qaDrift()).length,
      min: await qaMinBalance(),
    },
    qa_entry_keys: qaEntryKeys,
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
