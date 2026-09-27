/**
 * P1a 并发质检 · 用例① 同一账户 N 并发转账后总额守恒（热账户口径）
 * ---------------------------------------------------------------------------
 * 运行：
 *   cd backend-ts && QA_N=100 QA_TAG=hot100a SEAFOOD_TX_POOL_MAX=8 \
 *     npx ts-node --transpile-only scripts/qa-p1b-02-conserve-hot.ts
 *
 * 断言（全部为质检方自写读数）：
 *   A. Σ(balance+frozen) 按 cid 在并发前后逐字相等（守恒）
 *   B. 全库漂移 = 0：既用实现方 findAccountDrift()，也用质检方自写 SQL（两条独立实现互相印证）
 *   C. 每个 (uid,cid)：balance == Σdelta 且 frozen == Σfrozen_delta
 *   D. min(balance) >= 0 / min(frozen) >= 0
 *   E. 成功笔数 × 1 == 源账户被扣总额（防止「守恒但没动账」的假绿）
 *   F. 并发真实性：pg_stat_activity 采样（同时活跃事务 / 锁等待峰值 / 不同 pid 数）
 */
import { readQuery } from '../src/db';
import { transfer } from '../src/ledger';
import { j, startSampler, summarizeSamples, readings, errorCodeOf, tally } from './qa-p1b-lib';

const N = Number(process.env.QA_N ?? 100);
const TAG = process.env.QA_TAG ?? 'hot100a';
const SRC = 910001n;
const RECEIVERS = [910003n, 910004n];

(async () => {
  const cidRows = await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', ['qa1bGLD']);
  const cid = cidRows[0].cid;

  const snap = async () => readQuery<Record<string, string>>(
    `SELECT uid, cid, balance, frozen, version FROM account WHERE cid = $1 AND uid IN ($2,$3,$4) ORDER BY uid`,
    [cid, SRC.toString(), RECEIVERS[0].toString(), RECEIVERS[1].toString()]);

  const deadlocks = async () => (await readQuery<{ d: string }>(
    'SELECT deadlocks AS d FROM pg_stat_database WHERE datname = current_database()'))[0].d;

  const before = { readings: await readings(cid), accounts: await snap(), deadlocks: await deadlocks() };

  const sampler = startSampler(120);
  const t0 = Date.now();

  const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const t = Date.now();
    try {
      const r = await transfer({
        fromUid: SRC, toUid: RECEIVERS[i % RECEIVERS.length], cid, amount: 1n,
        idempotencyKey: `ops:qa1b:c1:${TAG}:${i + 1}`, memo: `qa1b c1 ${TAG}`,
      });
      return { i, ok: true as const, replay: r.idempotent_replay, ms: Date.now() - t };
    } catch (e) {
      return { i, ok: false as const, code: errorCodeOf(e), ms: Date.now() - t };
    }
  }));
  const wall_ms = Date.now() - t0;
  const samples = await sampler.stop();

  const after = { readings: await readings(cid), accounts: await snap(), deadlocks: await deadlocks() };

  const okRows = results.filter((r) => r.ok) as Array<{ i: number; replay: boolean; ms: number }>;
  const failRows = results.filter((r) => !r.ok) as Array<{ i: number; code: string; ms: number }>;
  const msList = results.map((r) => r.ms).sort((a, b) => a - b);

  const tot = (rs: Awaited<ReturnType<typeof readings>>, k: 'before' | 'after') =>
    rs.sum_account_totals.find((r) => r.cid === cid) ?? {};
  const beforeTot = tot(before.readings, 'before');
  const afterTot = tot(after.readings, 'after');
  const srcBefore = BigInt(before.accounts.find((a) => a.uid === SRC.toString())?.balance ?? '0');
  const srcAfter = BigInt(after.accounts.find((a) => a.uid === SRC.toString())?.balance ?? '0');

  // 归约
  const distinctReplay = new Set(okRows.map((r) => r.replay));
  const eventEntries = await readQuery<{ uid: string; delta: string; idempotency_key: string }>(
    `SELECT uid, delta, idempotency_key FROM ledger_entry
      WHERE idempotency_key LIKE 'ops:qa1b:c1:' || $1 || '%' ORDER BY txid`, [TAG]);

  const assertions = {
    A_conservation_total_net_equal: beforeTot.total_net === afterTot.total_net,
    B_drift_impl_zero: after.readings.impl_drift_global === 0,
    B_drift_qa_zero: after.readings.qa_drift === 0,
    C_drift_qa_cid_zero: after.readings.qa_drift_cid === 0,
    C_per_account_invariant_ok: after.readings.qa_drift === 0,
    D_min_non_negative: Number(after.readings.qa_min[0].min_balance) >= 0
      && Number(after.readings.qa_min[0].min_frozen) >= 0,
    E_success_amount_matches_source_debit: BigInt(okRows.length) === (srcBefore - srcAfter),
    F_no_new_deadlocks: before.deadlocks === after.deadlocks,
  };
  const metric_net = { before: beforeTot.total_net, after: afterTot.total_net };

  console.log(j({
    case: '1-hot',
    config: { N, TAG, cid, SRC: SRC.toString(), receivers: RECEIVERS.map(String), pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? 4 },
    wall_ms,
    latency_ms: { min: msList[0], p50: msList[Math.floor(msList.length / 2)], max: msList[msList.length - 1] },
    outcome: {
      success: okRows.length,
      idempotent_replay_values: [...distinctReplay],
      failure: failRows.length,
      failure_codes: tally(failRows.map((r) => r.code)),
    },
    ledger_entries_written_for_run: eventEntries.length,
    entries_by_uid: tally(eventEntries.map((e) => e.uid)),
    accounts_before: before.accounts, accounts_after: after.accounts,
    deadlocks: { before: before.deadlocks, after: after.deadlocks },
    concurrency_evidence: summarizeSamples(samples),
    assertions,
    metric_net,
    all_pass: Object.values(assertions).every((v) => v === true),
    global_ledger_sum_after: after.readings.qa_global_ledger_sum,
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
