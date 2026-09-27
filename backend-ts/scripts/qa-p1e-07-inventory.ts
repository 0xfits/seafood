/**
 * QA-P1E-07 · 只读测试数据清单 + 终态核对（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-07-inventory.ts
 *
 * 全部只读。产出：本单新增的测试币 / 账户 / 流水（uid / symbol / 行数 / 幂等键前缀），
 * 以及与基线的差量核对（entry_count 基线 341）。
 * 纪律：不写任何行；不碰 cid=1 与平台账户。
 */
import { entryCount, judgementRows, mkPool, raw, deadlocks } from './qa-p1e-lib';

const FN = 'ledger_post_event';

(async () => {
  const out: Record<string, unknown> = {};
  const p = mkPool(3);

  out.entry_count_total = await entryCount(p);
  out.baseline_entry_count = '341 (QA-P1E-00 开工读数)';
  out.deadlocks_cumulative = await deadlocks(p);

  out.by_key_prefix = await raw(p, `
    SELECT CASE
             WHEN idempotency_key LIKE 'ops:qae:%' THEN 'ops:qae:* (Neng 本单)'
             WHEN idempotency_key LIKE 'ops:p1e:%' THEN 'ops:p1e:* (Kong 实现方 P1e)'
             WHEN idempotency_key LIKE 'ops:qa1b:%' THEN 'ops:qa1b:* (P1b 质检)'
             ELSE 'other/前序' END AS prefix,
           count(*)::text AS rows_, count(DISTINCT split_part(idempotency_key,'#',1))::text AS events,
           min(txid)::text AS min_txid, max(txid)::text AS max_txid
      FROM ledger_entry GROUP BY 1 ORDER BY 1`);

  out.my_entries_by_case = await raw(p, `
    SELECT split_part(idempotency_key,'#',1) AS base_key_,
           count(*)::text AS rows_
      FROM ledger_entry
     WHERE idempotency_key LIKE 'ops:qae:%'
     GROUP BY 1 ORDER BY 1`);

  out.my_accounts = await raw(p, `
    SELECT uid, cid, balance, frozen, version FROM account WHERE uid >= 930000 ORDER BY uid, cid`);

  out.my_currencies = await raw(p, `
    SELECT cid, symbol, owner_uid, decimals, total_supply, supply_cap, status
      FROM currency WHERE symbol LIKE 'qae%' ORDER BY cid`);

  out.p1e_currencies_untouched = await raw(p, `
    SELECT cid, symbol, owner_uid, total_supply, supply_cap, status
      FROM currency WHERE symbol LIKE 'p1e%' ORDER BY cid`);

  out.cid1_and_platform = await raw(p, `
    SELECT uid, cid, balance, frozen, version FROM account
     WHERE cid = 1 AND uid IN (0, -1, -2, -3) ORDER BY uid`);
  out.cid1_currency = await raw(p, `SELECT cid, symbol, total_supply, supply_cap, status FROM currency WHERE cid = 1`);
  out.cid1_entry_count = (await raw(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE cid = 1`))[0].n;

  const j = await judgementRows(p);
  out.section11 = {
    j1_drift_rows: j.j1_drift.length,
    j8_ref_rows: j.j8_ref.length,
    j8_key_rows: j.j8_key.length,
    negative_balances: j.negatives[0].n,
    supply_over_cap: j.supply_over.length,
    supply_mismatch: j.supply_mismatch,
  };
  out.totals_by_cid_for_my_accounts = await raw(p, `
    SELECT cid, SUM(balance)::text AS sum_balance, SUM(frozen)::text AS sum_frozen,
           SUM(balance + frozen)::text AS net
      FROM account WHERE uid >= 930000 GROUP BY cid ORDER BY cid`);
  out.function_listed = (await raw(p, `
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname = $1`, [FN]))[0]?.proname ?? null;

  // 死锁/锁超时用例的终态：公开 API 那轮（真死锁 + TS 重试）必须仍是「一个事件 = 2 条流水」
  out.deadlock_case_keys = await raw(p, `
    SELECT split_part(idempotency_key,'#',1) AS base_key_, count(*)::text AS rows_,
           string_agg(DISTINCT uid::text, ',') AS uids, string_agg(DISTINCT delta::text, ',') AS deltas
      FROM ledger_entry
     WHERE idempotency_key LIKE '%lock:deadlock%' OR idempotency_key LIKE '%lock:timeout%'
     GROUP BY 1 ORDER BY 1`);
  out.api_deadlock_family_rows = (await raw(p, `
    SELECT count(*)::text AS n FROM ledger_entry
     WHERE idempotency_key = 'ops:qae:eeo48:lock:deadlock:api'
        OR left(idempotency_key, length('ops:qae:eeo48:lock:deadlock:api') + 1) = 'ops:qae:eeo48:lock:deadlock:api' || '#'`))[0].n;

  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
