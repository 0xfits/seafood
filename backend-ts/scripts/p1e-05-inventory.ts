/**
 * P1e · 测试数据清单（**只读**）：本轮（及 P1e 系列探针）在真库留下的全部行
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1e-05-inventory.ts
 *
 * 纪律：uid 一律 92xxxx（≥ 900000）；symbol 前缀 p1e；键前缀 ops:p1e / biz:p1e。
 * 本脚本**不写库**，只列出便于后续一次性清理的对象与条数。
 * 清理口径（不在本脚本内执行）：
 *   DELETE FROM ledger_entry WHERE uid >= 900000 OR cid IN (SELECT cid FROM currency WHERE symbol LIKE 'p1e%');
 *   DELETE FROM account      WHERE uid >= 900000;
 *   DELETE FROM currency     WHERE symbol LIKE 'p1e%';
 *   DELETE FROM ledger_owner WHERE uid >= 900000;
 * 注意：`user` 表必须写成 `"user"`（裸 user 会被解析成 current_user 并静默返回 1 行）。
 */
import { closeAll, judgement1, judgement8, judgement8ByKey, judgement8Exempt, q } from './p1e-lib';

(async () => {
  const out: Record<string, unknown> = {};

  out.totals = (await q<Record<string, string>>(
    `SELECT (SELECT count(*) FROM ledger_entry) AS ledger_entry,
            (SELECT count(*) FROM account) AS account,
            (SELECT count(*) FROM currency) AS currency,
            (SELECT count(*) FROM ledger_owner) AS ledger_owner,
            (SELECT count(*) FROM "user") AS user_rows`))[0];

  out.currencies = await q<Record<string, string>>(
    `SELECT cid, symbol, owner_uid, decimals, total_supply, supply_cap, status
       FROM currency WHERE symbol LIKE 'p1e%' ORDER BY cid`);

  out.accounts_92xxxx = await q<Record<string, string>>(
    `SELECT uid, cid, balance, frozen, version FROM account WHERE uid >= 900000 ORDER BY uid, cid`);

  out.entries_by_base_key = await q<Record<string, string>>(
    `SELECT split_part(idempotency_key, '#', 1) AS base_key,
            count(*)::text AS entries,
            min(txid)::text AS first_txid, max(txid)::text AS last_txid
       FROM ledger_entry
      WHERE idempotency_key LIKE 'ops:p1e%' OR idempotency_key LIKE 'biz:p1e%'
      GROUP BY 1 ORDER BY 1`);

  out.entries_92xxxx = (await q<Record<string, string>>(
    `SELECT count(*)::text AS n FROM ledger_entry WHERE uid >= 900000`))[0];

  out.platform_accounts_untouched = await q<Record<string, string>>(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid IN (-3, -2, -1, 0) ORDER BY uid, cid`);

  // §11 对账判据复核（跑完全部用例后仍须为 0 行）
  out.judgement1_rows = await judgement1();
  out.judgement8_rows = await judgement8();
  out.judgement8_by_key_rows = await judgement8ByKey();
  out.judgement8_exempt_face = await judgement8Exempt();

  console.log(JSON.stringify(out, null, 2));
  await closeAll();
})().catch(async (e) => {
  console.error('INVENTORY FAILED:', (e as Error)?.stack ?? e);
  await closeAll().catch(() => undefined);
  process.exitCode = 2;
});
