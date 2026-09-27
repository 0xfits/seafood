/**
 * P1a 并发质检 · 01 测试数据建置 + 单事务延迟基线
 * ---------------------------------------------------------------------------
 * 质检方（Neng）自写；不引用实现方 ledger-smoke.ts。
 * 运行：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-01-setup.ts
 *
 * 纪律：uid 一律 91xxxx（≥900000）；自建币 symbol 前缀 qa1b；幂等键一律 ops:qa1b:*
 *       不碰 uid < 900000 的任何账户（平台账户只读）。
 * 本脚本**写入真实数据**（append-only 表删不掉），产出即测试数据清单的一部分。
 */
import { withTransaction, txQuery, readQuery, closePools } from '../src/db';
import { mint, transfer } from '../src/ledger';

const OWNER_A = 910001n; // qa1bGLD owner（唯一可铸）
const OWNER_B = 910002n; // qa1bCAP / qa1bDLK owner

const ensureCurrency = async (symbol: string, name: string, owner: bigint, cap: string | null): Promise<string> => {
  const found = await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', [symbol]);
  if (found.length) return found[0].cid;
  const rows = await withTransaction(async (tx) =>
    txQuery<{ cid: string }>(
      tx,
      `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
       VALUES ($1, $2, $3, 0, 0, $4, 'listed', now()) RETURNING cid`,
      [symbol, name, owner.toString(), cap],
    ));
  return rows[0].cid;
};

const ms = async (fn: () => Promise<unknown>): Promise<number> => {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
};

(async () => {
  const out: Record<string, unknown> = {};

  const cidGld = await ensureCurrency('qa1bGLD', 'QA1b 测试金', OWNER_A, null);
  const cidCap = await ensureCurrency('qa1bCAP', 'QA1b 上限币', OWNER_B, '1');
  const cidDlk = await ensureCurrency('qa1bDLK', 'QA1b 死锁币', OWNER_B, '1000');
  out.currencies = { cidGld, cidCap, cidDlk };

  // 种子：铸 1,000,000 给 OWNER_A（同键重放 ⇒ 重复运行不会双铸）
  const t0 = Date.now();
  const m = await mint({
    uid: OWNER_A, cid: cidGld, amount: 1000000n,
    idempotencyKey: 'ops:qa1b:seed:mint:gld', memo: 'qa1b seed',
  });
  out.seed_mint_gld = { idempotent_replay: m.idempotent_replay, txid: m.txid, ms: Date.now() - t0,
    supply_after: m.extra.supply_after };

  // 种子：qa1bDLK 铸 1 给 OWNER_B（同时把 (910002, cidDlk) 账户建出来，供死锁用例）
  const m2 = await mint({
    uid: OWNER_B, cid: cidDlk, amount: 1n,
    idempotencyKey: 'ops:qa1b:seed:mint:dlk', memo: 'qa1b dLK seed',
  });
  out.seed_mint_dlk = { idempotent_replay: m2.idempotent_replay, txid: m2.txid, supply_after: m2.extra.supply_after };

  // ---------------------------------------------------------------- 单事务延迟基线（无争抢）
  const lat: Record<string, unknown> = {};
  lat.transfer_uncontended_ms = [];
  for (let i = 1; i <= 3; i += 1) {
    const t = await ms(() => transfer({
      fromUid: OWNER_A, toUid: 910003n, cid: cidGld, amount: 1n,
      idempotencyKey: `ops:qa1b:lat:transfer:${i}`, memo: 'qa1b lat',
    }));
    (lat.transfer_uncontended_ms as number[]).push(t);
  }
  lat.mint_uncontended_ms = [];
  for (let i = 1; i <= 3; i += 1) {
    const t = await ms(() => mint({
      uid: OWNER_A, cid: cidGld, amount: 1n,
      idempotencyKey: `ops:qa1b:lat:mint:${i}`, memo: 'qa1b lat',
    }));
    (lat.mint_uncontended_ms as number[]).push(t);
  }
  lat.tx_begin_commit_ms = [];
  for (let i = 0; i < 3; i += 1) {
    lat.tx_begin_commit_ms.push(await ms(() => withTransaction(async (tx) => txQuery(tx, 'SELECT 1'))));
  }
  out.latency = lat;

  // ---------------------------------------------------------------- 当前账户快照
  out.accounts = await readQuery(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid >= 900000 ORDER BY uid, cid`);
  out.currency_rows = await readQuery(
    `SELECT cid, symbol, owner_uid, total_supply, supply_cap, status FROM currency WHERE symbol LIKE 'qa1b%' ORDER BY cid`);

  console.log(JSON.stringify(out));
  await closePools();
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closePools().catch(() => undefined);
  process.exit(1);
});
