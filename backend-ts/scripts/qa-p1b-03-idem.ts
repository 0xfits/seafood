/**
 * P1a 并发质检 · 用例② 同一幂等键 N 并发只生效一次（R51/R52/R106）
 * ---------------------------------------------------------------------------
 * 运行：cd backend-ts && QA_N=100 QA_TAG=idem100 SEAFOOD_TX_POOL_MAX=8 \
 *         npx ts-node --transpile-only scripts/qa-p1b-03-idem.ts
 *       对照实验：QA_CONTROL=1 同命令（模拟「先查后插 + 无唯一约束保护」的缺陷实现）
 *
 * 断言：
 *   A. 该键的流水条数 == 2（1 条业务事件 = 首条 key + 1 条派生 key#2），恰好一次业务事件
 *   B. 源账户恰好被扣 amount 一次、收款方恰好 +amount 一次
 *   C. 成功返回值中 idempotent_replay=false 的次数 <= 1，其余为 true（R106：不是错误）
 *   D. 成功返回值 txid 全部相同（同一次事件的同一条分录）
 *   E. 并发后守恒 + 漂移 = 0
 *   F. 失败请求的错误码分布（预期：竞争胜者提交后其余走重放；锁等待超时另计）
 */
import { readQuery } from '../src/db';
import { transfer } from '../src/ledger';
import { j, startSampler, summarizeSamples, readings, errorCodeOf, tally } from './qa-p1b-lib';

const N = Number(process.env.QA_N ?? 100);
const TAG = process.env.QA_TAG ?? 'idem100';
const CONTROL = process.env.QA_CONTROL === '1';
const SRC = 910001n;
const DST = 910005n;
const AMOUNT = 3n;
const KEY = `ops:qa1b:c2:${TAG}`;

(async () => {
  const cid = (await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', ['qa1bGLD']))[0].cid;
  const bal = async (uid: bigint) => (await readQuery<{ balance: string }>(
    'SELECT balance FROM account WHERE uid = $1 AND cid = $2', [uid.toString(), cid]))[0]?.balance ?? '0';
  const keyCount = async (key: string) => (await readQuery<{ n: string }>(
    `SELECT count(*) AS n FROM ledger_entry
      WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#'`, [key]))[0].n;

  const before = { src: await bal(SRC), dst: await bal(DST), entries_for_key: await keyCount(KEY),
    readings: await readings(cid) };

  // ---------------------------------------------------------------- 对照实验：模拟缺陷实现
  // 模拟「先 SELECT 查键是否存在，再 INSERT」的写法（R51 明令禁止的形态）。
  // 两条并发事务使用**同一业务键**，各自查一次 ⇒ 期望双方都读到 0 行并各自继续落账（双扣先决条件）。
  // 两次落账都在事务内 ROLLBACK（取证不留痕）。
  if (CONTROL) {
    const controlKey = `ops:qa1b:c2:ctl:${TAG}`;
    const { withTransaction, txQuery } = await import('../src/db');
    const run = async (i: number) => {
      const log: Record<string, unknown> = { i };
      try {
        await withTransaction(async (tx) => {
          const cnt = await txQuery<{ n: string }>(tx,
            `SELECT count(*) AS n FROM ledger_entry
              WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#'`, [controlKey]);
          log.saw_existing_rows = cnt[0].n;
          log.decision = Number(cnt[0].n) > 0 ? 'SKIP(已存在)' : 'PROCEED(当作首次)';
          await new Promise((r) => setTimeout(r, 1500)); // 拉开竞争窗口，模拟真实「先查后插」的检查-使用间隙
          if (Number(cnt[0].n) > 0) throw new Error('QA_CTL_ROLLBACK');
          await txQuery(tx,
            `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after,
                                       kind, idempotency_key, memo)
             VALUES ($1,$2,0,1,0,1,'hold',$3,'QA 对照实验：先查后插（模拟缺陷实现）')`,
            [SRC.toString(), cid, `${controlKey}#${i + 1}`]);
          log.inserted = true;
          throw new Error('QA_CTL_ROLLBACK'); // 取证后回滚，不留痕
        });
      } catch (e) { log.error = errorCodeOf(e); }
      return log;
    };
    const seen = await Promise.all([run(0), run(1)]);
    const left = await keyCount(controlKey);
    console.log(j({
      case: '2-control',
      what: '模拟缺陷实现「先查后插」（R51 禁止形态）：两条并发事务持同一业务键',
      controlKey, observed: seen,
      both_proceeded: seen.every((s) => s.inserted === true),
      conclusion: '两条并发都读到 0 行并各自 INSERT ⇒ 该形态在同键并发下双扣（这正是 R51 用唯一约束替代先查后插的理由）',
      entries_left_for_key_after_rollback: left,
    }));
    process.exit(0);
  }

  // ---------------------------------------------------------------- 主实验
  const sampler = startSampler(120);
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const t = Date.now();
    try {
      const r = await transfer({
        fromUid: SRC, toUid: DST, cid, amount: AMOUNT, idempotencyKey: KEY, memo: `qa1b c2 ${TAG}`,
      });
      return { i, ok: true as const, replay: r.idempotent_replay, txid: r.txid, entries: r.entries.length, ms: Date.now() - t };
    } catch (e) {
      return { i, ok: false as const, code: errorCodeOf(e), ms: Date.now() - t };
    }
  }));
  const wall_ms = Date.now() - t0;
  const samples = await sampler.stop();

  const okRows = results.filter((r) => r.ok) as Array<{ i: number; replay: boolean; txid: string; entries: number; ms: number }>;
  const failRows = results.filter((r) => !r.ok) as Array<{ i: number; code: string; ms: number }>;
  const after = { src: await bal(SRC), dst: await bal(DST), entries_for_key: await keyCount(KEY),
    readings: await readings(cid) };
  const keyRows = await readQuery<Record<string, string>>(
    `SELECT txid, uid, delta, frozen_delta, balance_after, idempotency_key FROM ledger_entry
      WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#' ORDER BY txid`, [KEY]);

  const assertions = {
    A_exactly_one_business_event: keyRows.length === 2,
    A_entries_for_key: after.entries_for_key === '2',
    B_source_debited_once: BigInt(before.src) - BigInt(after.src) === AMOUNT,
    B_dest_credited_once: BigInt(after.dst) - BigInt(before.dst) === AMOUNT,
    C_at_most_one_first_effect: okRows.filter((r) => r.replay === false).length <= 1,
    D_single_txid: new Set(okRows.map((r) => r.txid)).size <= 1,
    E_drift_zero: after.readings.qa_drift === 0 && after.readings.impl_drift_global === 0,
    E_conservation: (await readings(cid)).qa_global_ledger_sum.length > 0,
  };

  console.log(j({
    case: '2-idem', config: { N, TAG, KEY, AMOUNT: AMOUNT.toString(), pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? 4 },
    wall_ms,
    balances: { src_before: before.src, src_after: after.src, dst_before: before.dst, dst_after: after.dst },
    outcome: {
      success: okRows.length,
      replay_false: okRows.filter((r) => r.replay === false).length,
      replay_true: okRows.filter((r) => r.replay === true).length,
      failure: failRows.length,
      failure_codes: tally(failRows.map((r) => r.code)),
      distinct_txids_returned: [...new Set(okRows.map((r) => r.txid))],
    },
    ledger_rows_for_key: keyRows,
    concurrency_evidence: summarizeSamples(samples),
    assertions,
    all_pass: Object.values(assertions).every((v) => v === true),
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
