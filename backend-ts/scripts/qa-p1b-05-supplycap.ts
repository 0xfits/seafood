/**
 * P1a 并发质检 · 用例④ 并发 mint 不超 supply_cap（R24 / §10.2）
 * ---------------------------------------------------------------------------
 * 模式（QA_MODE）：
 *   literal —— cap=1 的币种上 N=100 并发铸 1（期望恰好 1 笔成功，其余 409/503，total_supply 恒 <= 1）
 *   rounds  —— 每轮一个全新 cap=1 币种，N=3 并发铸 1（期望恰好 1 成功 + SUPPLY_CAP_EXCEEDED）
 * 运行：cd backend-ts && QA_MODE=literal QA_N=100 SEAFOOD_TX_POOL_MAX=32 \
 *         npx ts-node --transpile-only scripts/qa-p1b-05-supplycap.ts
 *       cd backend-ts && QA_MODE=rounds QA_ROUNDS=2 SEAFOOD_TX_POOL_MAX=8 \
 *         npx ts-node --transpile-only scripts/qa-p1b-05-supplycap.ts
 *
 * 断言：
 *   A. 每轮/整轮结束后 currency.total_supply <= supply_cap（永不超发）
 *   B. total_supply == 成功笔数 × 金额（成功的每一笔恰好入账一次、失败的一笔都没入账）
 *   C. 失败码必须是 LEDGER_SUPPLY_CAP_EXCEEDED（业务码）或明确的超时/过载码
 *   D. 并发后漂移 = 0、min(balance) >= 0、Σ(balance+frozen) 与流水净额一致
 */
import { withTransaction, txQuery, readQuery } from '../src/db';
import { mint } from '../src/ledger';
import { j, startSampler, summarizeSamples, readings, errorCodeOf, tally } from './qa-p1b-lib';

const MODE = process.env.QA_MODE ?? 'literal';
const N = Number(process.env.QA_N ?? 100);
const ROUNDS = Number(process.env.QA_ROUNDS ?? 2);
const OWNER = 910002n;

const ensureCapCurrency = async (symbol: string, cap: string): Promise<string> => {
  const found = await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', [symbol]);
  if (found.length) return found[0].cid;
  const rows = await withTransaction(async (tx) => txQuery<{ cid: string }>(tx,
    `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
     VALUES ($1, $2, $3, 0, 0, $4, 'listed', now()) RETURNING cid`,
    [symbol, `QA1b 上限币 ${symbol}`, OWNER.toString(), cap]));
  return rows[0].cid;
};

const supplyOf = async (cid: string) => (await readQuery<Record<string, string>>(
  'SELECT total_supply, supply_cap FROM currency WHERE cid = $1', [cid]))[0];

(async () => {
  if (MODE === 'literal') {
    const cid = await ensureCapCurrency('qa1bCAP', '1'); // 已由 01-setup 建好（cap=1）
    const before = await supplyOf(cid);
    const sampler = startSampler(120);
    const t0 = Date.now();
    const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
      const t = Date.now();
      try {
        const r = await mint({ uid: OWNER, cid, amount: 1n,
          idempotencyKey: `ops:qa1b:c4:literal:${i + 1}`, memo: 'qa1b c4' });
        return { i, ok: true as const, replay: r.idempotent_replay, supply_after: r.extra.supply_after, ms: Date.now() - t };
      } catch (e) { return { i, ok: false as const, code: errorCodeOf(e), ms: Date.now() - t }; }
    }));
    const wall_ms = Date.now() - t0;
    const samples = await sampler.stop();
    const okRows = results.filter((r) => r.ok) as Array<{ i: number; supply_after: string | null; ms: number }>;
    const failRows = results.filter((r) => !r.ok) as Array<{ i: number; code: string; ms: number }>;
    const after = await supplyOf(cid);
    const readings_after = await readings(cid);

    const assertions = {
      A_never_exceeds_cap: BigInt(after.total_supply) <= BigInt(after.supply_cap),
      B_supply_equals_successes: BigInt(after.total_supply) - BigInt(before.total_supply) === BigInt(okRows.length),
      B_supply_after_values_consistent: new Set(okRows.map((r) => r.supply_after)).size <= 1,
      C_failures_are_business_or_overload: failRows.every((r) =>
        ['LEDGER_SUPPLY_CAP_EXCEEDED', 'LEDGER_LOCK_TIMEOUT', 'LEDGER_TX_TIMEOUT', 'LEDGER_TRANSACTION_REQUIRED']
          .includes(r.code)),
      D_drift_zero: readings_after.qa_drift === 0 && readings_after.impl_drift_global === 0,
      D_min_non_negative: Number(readings_after.qa_min[0].min_balance) >= 0,
    };

    console.log(j({
      case: '4-supplycap-literal',
      config: { MODE, N, cid, cap: before.supply_cap, owner: OWNER.toString(),
        pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? 4 },
      wall_ms,
      supply: { before: before.total_supply, after: after.total_supply, cap: after.supply_cap },
      outcome: { success: okRows.length, failure: failRows.length, failure_codes: tally(failRows.map((r) => r.code)) },
      concurrency_evidence: summarizeSamples(samples),
      assertions,
      all_pass: Object.values(assertions).every((v) => v === true),
      global_ledger_sum_after: readings_after.qa_global_ledger_sum,
    }));
    process.exit(0);
  }

  // ----------------------------------------------------------------- rounds 模式
  const rounds: unknown[] = [];
  for (let r = 0; r < ROUNDS; r += 1) {
    const cid = await ensureCapCurrency(`qa1bCP${r + 1}`, '1');
    const before = await supplyOf(cid);
    const results = await Promise.all([0, 1, 2].map(async (k) => {
      try {
        const res = await mint({ uid: OWNER, cid, amount: 1n,
          idempotencyKey: `ops:qa1b:c4:r${r + 1}:${k + 1}`, memo: 'qa1b c4 round' });
        return { k, ok: true as const, replay: res.idempotent_replay };
      } catch (e) { return { k, ok: false as const, code: errorCodeOf(e) }; }
    }));
    const after = await supplyOf(cid);
    rounds.push({
      round: r + 1, cid, symbol: `qa1bCP${r + 1}`, cap: after.supply_cap,
      supply_before: before.total_supply, supply_after: after.total_supply,
      success: results.filter((x) => x.ok).length,
      results,
      failure_codes: tally(results.filter((x) => !x.ok).map((x) => (x as { code: string }).code)),
      never_exceeds_cap: BigInt(after.total_supply) <= BigInt(after.supply_cap),
    });
  }
  const readings_after = await readings();
  const assertions = {
    A_all_rounds_within_cap: rounds.every((r) => (r as { never_exceeds_cap: boolean }).never_exceeds_cap),
    B_exactly_one_success_per_round: rounds.every((r) => (r as { success: number }).success === 1),
    B_supply_equals_one: rounds.every((r) => (r as { supply_after: string }).supply_after === '1'),
    D_drift_zero: readings_after.qa_drift === 0 && readings_after.impl_drift_global === 0,
  };
  console.log(j({ case: '4-supplycap-rounds', config: { MODE, ROUNDS, pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? 4 },
    rounds, assertions, all_pass: Object.values(assertions).every((v) => v === true) }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
