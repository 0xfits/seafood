/**
 * P1a 并发质检 · 用例③ 并发扣款不产生负余额（R80 / §10.2）
 * ---------------------------------------------------------------------------
 * 模式（QA_MODE）：
 *   literal —— 字面口径：源账户余额 50，N=100 并发各扣 1（R85③ 的同构放大）
 *   rounds  —— 语义口径：M 个「余额恰好 1」的独立账户，每个账户 2 笔并发各扣 1
 *              ⇒ 期望每账户恰好 1 成功 + 1 笔 LEDGER_INSUFFICIENT_BALANCE(409)，余额归 0 且 >= 0
 * 运行：cd backend-ts && QA_MODE=literal QA_N=100 SEAFOOD_TX_POOL_MAX=32 \
 *         npx ts-node --transpile-only scripts/qa-p1b-04-negative.ts
 *       cd backend-ts && QA_MODE=rounds QA_ROUNDS=5 SEAFOOD_TX_POOL_MAX=8 \
 *         npx ts-node --transpile-only scripts/qa-p1b-04-negative.ts
 *
 * 断言：
 *   A. 并发后 min(balance) >= 0 且 min(frozen) >= 0（全库）
 *   B. 并发后漂移 = 0（balance == Σdelta 且 frozen == Σfrozen_delta），实现方与质检方两套 SQL 同时为 0
 *   C. 成功笔数 × 1 == 源账户被扣总额（没有「守恒但多扣/少扣」）
 *   D. 失败错误码必须是业务码 LEDGER_INSUFFICIENT_BALANCE 或明确的超时/过载码，且**绝不**出现负余额
 */
import { readQuery } from '../src/db';
import { transfer } from '../src/ledger';
import { j, startSampler, summarizeSamples, readings, errorCodeOf, tally } from './qa-p1b-lib';

const MODE = process.env.QA_MODE ?? 'literal';
const N = Number(process.env.QA_N ?? 100);
const ROUNDS = Number(process.env.QA_ROUNDS ?? 5);
const SRC_FUND = 910001n;

const cidOf = async (symbol: string) =>
  (await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', [symbol]))[0].cid;

const seed = async (src: bigint, dst: bigint, cid: string, amount: bigint, tag: string) =>
  transfer({ fromUid: src, toUid: dst, cid, amount, idempotencyKey: `ops:qa1b:seed:t3:${tag}`, memo: 'qa1b c3 seed' });

(async () => {
  const cid = await cidOf('qa1bGLD');
  const bal = async (uid: bigint) => (await readQuery<{ balance: string }>(
    'SELECT balance FROM account WHERE uid = $1 AND cid = $2', [uid.toString(), cid]))[0]?.balance ?? '0';

  if (MODE === 'literal') {
    const SRC = 910010n;
    const DST = 910011n;
    const seedRes = await seed(SRC_FUND, SRC, cid, 50n, 'literal');
    const before = { src: await bal(SRC), readings: await readings(cid) };

    const sampler = startSampler(120);
    const t0 = Date.now();
    const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
      const t = Date.now();
      try {
        const r = await transfer({ fromUid: SRC, toUid: DST, cid, amount: 1n,
          idempotencyKey: `ops:qa1b:c3:literal:${i + 1}`, memo: 'qa1b c3' });
        return { i, ok: true as const, replay: r.idempotent_replay, ms: Date.now() - t };
      } catch (e) { return { i, ok: false as const, code: errorCodeOf(e), ms: Date.now() - t }; }
    }));
    const wall_ms = Date.now() - t0;
    const samples = await sampler.stop();

    const okRows = results.filter((r) => r.ok) as Array<{ i: number; ms: number }>;
    const failRows = results.filter((r) => !r.ok) as Array<{ i: number; code: string; ms: number }>;
    const after = { src: await bal(SRC), dst: await bal(DST), readings: await readings(cid) };

    const assertions = {
      A_min_non_negative: Number(after.readings.qa_min[0].min_balance) >= 0
        && Number(after.readings.qa_min[0].min_frozen) >= 0,
      A_source_never_negative: Number(after.src) >= 0,
      A_success_le_seeded_balance: BigInt(okRows.length) <= 50n,
      B_drift_zero: after.readings.qa_drift === 0 && after.readings.impl_drift_global === 0,
      C_success_matches_debit: (BigInt(before.src) - BigInt(after.src)) === BigInt(okRows.length),
      D_failure_codes_all_known: failRows.every((r) => /LEDGER_|Error:/.test(r.code)),
    };

    console.log(j({
      case: '3-negative-literal',
      config: { MODE, N, cid, SRC: SRC.toString(), DST: DST.toString(), seeded: 50,
        pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? 4, seed_replay: seedRes.idempotent_replay },
      wall_ms,
      balances: { src_before: before.src, src_after: after.src, dst_after: after.dst },
      outcome: { success: okRows.length, failure: failRows.length, failure_codes: tally(failRows.map((r) => r.code)) },
      concurrency_evidence: summarizeSamples(samples),
      assertions,
      all_pass: Object.values(assertions).every((v) => v === true),
      global_ledger_sum_after: after.readings.qa_global_ledger_sum,
    }));
    process.exit(0);
  }

  // ----------------------------------------------------------------- rounds 模式
  const rounds: unknown[] = [];
  const order = await (async () => {
    const rows: Array<{ uid: string; balance?: string }> = [];
    for (let r = 0; r < ROUNDS; r += 1) {
      const src = BigInt(910020 + r);
      const dst = BigInt(910030 + r);
      const s = await seed(SRC_FUND, src, cid, 1n, `round${r + 1}`);
      rows.push({ uid: src.toString(), balance: s.accounts.find((a) => a.uid === src.toString())?.balance ?? '?' });
    }
    return rows;
  })();

  for (let r = 0; r < ROUNDS; r += 1) {
    const SRC = BigInt(910020 + r);
    const DST = BigInt(910030 + r);
    const before = await bal(SRC);
    const sampler = startSampler(150);
    const results = await Promise.all([0, 1].map(async (k) => {
      try {
        const res = await transfer({ fromUid: SRC, toUid: DST, cid, amount: 1n,
          idempotencyKey: `ops:qa1b:c3:r${r + 1}:${k + 1}`, memo: 'qa1b c3 round' });
        return { k, ok: true as const, replay: res.idempotent_replay };
      } catch (e) { return { k, ok: false as const, code: errorCodeOf(e) }; }
    }));
    const samples = await sampler.stop();
    const after = await bal(SRC);
    rounds.push({
      round: r + 1, src: SRC.toString(), before, after,
      results,
      success: results.filter((x) => x.ok).length,
      failure_codes: tally(results.filter((x) => !x.ok).map((x) => (x as { code: string }).code)),
      min_balance_ok: Number(after) >= 0,
      concurrent_tx_observed: summarizeSamples(samples).max_simultaneous_tx,
    });
  }

  const final = await readings(cid);
  const assertions = {
    A_all_rounds_non_negative: rounds.every((r) => (r as { min_balance_ok: boolean }).min_balance_ok),
    B_exactly_one_success_per_round: rounds.every((r) => (r as { success: number }).success === 1),
    B_one_insufficient_per_round: rounds.every((r) =>
      ((r as { failure_codes: Record<string, number> }).failure_codes.LEDGER_INSUFFICIENT_BALANCE ?? 0) === 1),
    C_min_non_negative_global: Number(final.qa_min[0].min_balance) >= 0,
    D_drift_zero: final.qa_drift === 0 && final.impl_drift_global === 0,
  };

  console.log(j({ case: '3-negative-rounds', config: { MODE, ROUNDS, cid, pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? 4 },
    seeded_accounts: order, rounds, assertions, all_pass: Object.values(assertions).every((v) => v === true),
    global_ledger_sum_after: final.qa_global_ledger_sum }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
