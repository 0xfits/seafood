/**
 * p2qa-04 · 幂等 / 并发 / 政策版本化（独立质检 Neng）
 * ① 同键同内容 8 并发 ⇒ 恰一组分录、其余 replay（不得双发）
 * ② 同键不同内容 ⇒ 409（不得静默改账）
 * ③ 同键 + 政策改版后重算 ⇒ 按 CR87 应走**重放**（不追溯、不双发、不 409）
 * ④ 同内容不同键 ⇒ 两个独立事件（设计如此，登记）
 * ⑤ 政策版本选择（effective_from 单调）/ 排期生效不影响当前事件 / 回填被拒
 * 测试数据：uid 954xxx；symbol p1u*；辅助键 ops:p1u:*
 */
import {
  mkPool, raw, raw1, save, sha256, inRollbackTx, ensureUsers, ensureCurrency, mintTo, holdFor,
  trySql, tryFn, RUN, type Qx,
} from './p2qa-lib';
import {
  settleJobCommission, planJobSettlement, readEventFacts, getCommissionPolicy, insertCommissionPolicy,
  jobSettleKey, type SettleJobInput, type Queryable,
} from '../src/commission';
import { LedgerError, isLedgerError } from '../src/ledger-errors';

const EMP = 954001;
const W2 = 954002;              // 已有链：954002 -> 954101 -> 954102
const W3 = 954003;              // 954003 -> 954111 -> 954112 -> 954113
const tsErr = (e: unknown): Record<string, unknown> =>
  isLedgerError(e) ? { ts_code: (e as LedgerError).code, http: (e as LedgerError).httpStatus, details: (e as LedgerError).details }
    : { ts_code: 'NON_LEDGER', message: String(e) };

const q = (p: ReturnType<typeof mkPool>) => p as unknown as Queryable;

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '12';
  const p = mkPool(14);
  const out: Record<string, unknown> = { script: 'scripts/p2qa-04-idempotency-policy.ts', run: RUN };
  await ensureUsers(p, [EMP, W2, W3]);
  const cid = await ensureCurrency(p, 'p1u4' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), String(EMP), 0);
  await mintTo(p, String(EMP), cid, '50000000', `ops:p1u:mint4-${RUN}`);
  out.setup = { cid };

  // 按 RUN 偏移 job_id ⇒ 每次跑都是全新事件（否则复跑会落在幂等重放 / 冲突上）
  const OFF4 = BigInt('0x' + sha256('joboff4' + RUN).slice(0, 8)) % 1000000000n;
  const JOB = (n: number): string => (954_800_000_000_000n + OFF4 + BigInt(n)).toString();
  const mkInput = (jobId: string, worker: number, gross: string, at?: string | null): SettleJobInput =>
    ({ jobId, employerUid: String(EMP), workerUid: String(worker), cid, gross, ex: q(p), at: at ?? null });

  const eventRowsHash = async (key: string): Promise<{ hash: string; rows: number }> => {
    const r = await trySql<Record<string, string>>(p, `
      SELECT txid::text, uid::text, kind, delta::text, frozen_delta::text, idempotency_key
        FROM ledger_entry WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1 ORDER BY txid`, [key]);
    return { hash: sha256(r.rows), rows: r.rows.length };
  };

  // ---------------------------------------------------------------- ① 8 并发同键同内容
  const jA = JOB(1);
  await holdFor(p, String(EMP), cid, '200000', jA, `ops:p1u:holdA-${RUN}`);
  const iA = mkInput(jA, W2, '100000');
  const planA = await planJobSettlement(iA);
  const resA = await Promise.allSettled(Array.from({ length: 8 }, () => settleJobCommission(iA)));
  const sumA = resA.map((s) => (s.status === 'fulfilled'
    ? { ok: s.value.result.ok, replay: s.value.business.replay, entries: s.value.business.expected_entry_count }
    : { ok: false, err: tsErr(s.reason) }));
  const factA = await readEventFacts(jobSettleKey(jA), String(EMP), String(W2), q(p));
  out.Q1_concurrent_same_key = {
    concurrency: 8, responses: sumA, ok_count: sumA.filter((x) => x.ok).length,
    replay_count: sumA.filter((x) => x.replay).length,
    root_rows: factA.root_rows, rows_total: factA.rows_total, commission_rows: factA.commission_rows,
    minus2_net: factA.minus2_net, minus1_net: factA.minus1_net, worker_got: factA.worker_got,
    ev_net_sum: factA.ev_net_sum, distinct_beneficiaries: factA.distinct_beneficiaries,
    expected_entry_count: planA.layers.filter((l) => l.x !== '0').length * 2 + 4,
    rows_not_doubled: BigInt(factA.rows_total) === BigInt(planA.layers.filter((l) => l.x !== '0').length * 2 + 4),
    worker_paid_once: factA.worker_got === '99000',   // gross 100000 − fee 1000 = 99000（读到一次）
    event_rows_hash: await eventRowsHash(jobSettleKey(jA)),
  };

  // ---------------------------------------------------------------- ② 同键不同内容 ⇒ 409
  const beforeHashA = await eventRowsHash(jobSettleKey(jA));
  const q2cases: Array<Record<string, unknown>> = [];
  // ②a 只改 gross（降到 50000 ⇒ 新的载荷本身是**合法**的：冻结够）⇒ 指纹不同 ⇒ 必须 409 IDEMPOTENCY_CONFLICT
  try {
    const r = await settleJobCommission(mkInput(jA, W2, '50000'));
    q2cases.push({ tag: 'gross_lower_50000', returned_ok: r.result.ok, replay: r.business.replay });
  } catch (e) { q2cases.push({ tag: 'gross_lower_50000', threw: tsErr(e) }); }
  // ②b 只改 worker（换成 W3，链更长）⇒ 指纹不同 ⇒ 必须 409
  try {
    const r = await settleJobCommission(mkInput(jA, W3, '100000'));
    q2cases.push({ tag: 'worker_changed', returned_ok: r.result.ok, replay: r.business.replay });
  } catch (e) { q2cases.push({ tag: 'worker_changed', threw: tsErr(e) }); }
  // ②c 同键 + 金额**变大**且冻结不够 ⇒ 观察报的是哪一类 409（顺序取证：余额闸 vs 幂等闸）
  try {
    const r = await settleJobCommission(mkInput(jA, W2, '1000000'));
    q2cases.push({ tag: 'gross_higher_unfunded', returned_ok: r.result.ok, replay: r.business.replay });
  } catch (e) { q2cases.push({ tag: 'gross_higher_unfunded', threw: tsErr(e) }); }
  // ②d 原样重放（同键同内容）⇒ 必须 replay
  try {
    const r = await settleJobCommission(mkInput(jA, W2, '100000'));
    q2cases.push({ tag: 'identical_replay', returned_ok: r.result.ok, replay: r.business.replay });
  } catch (e) { q2cases.push({ tag: 'identical_replay', threw: tsErr(e) }); }
  const afterHashA = await eventRowsHash(jobSettleKey(jA));
  out.Q2_same_key_diff_content = {
    cases: q2cases, rows_hash_before: beforeHashA, rows_hash_after: afterHashA,
    rows_unchanged: beforeHashA.hash === afterHashA.hash,
    note: '同一 job_id ⇒ 同一幂等键；只改 business 字段 ⇒ 指纹不同（不该重放）；账上必须原封不动',
  };

  // ---------------------------------------------------------------- ③ 同键 + 政策改版后重算 ⇒ 重放（CR87）
  const jB = JOB(2);
  await holdFor(p, String(EMP), cid, '2000000', jB, `ops:p1u:holdB-${RUN}`);
  const atOld = '2026-09-27T10:25:43Z';   // 政策 20：fee=500 / levels=9
  const atNew = '2026-09-27T10:40:09Z';   // 政策 33：fee=100 / levels=2
  const polOld = await getCommissionPolicy(atOld, q(p));
  const polNew = await getCommissionPolicy(atNew, q(p));
  const planOld = await planJobSettlement(mkInput(jB, W3, '1000000', atOld));
  const planNew = await planJobSettlement(mkInput(jB, W3, '1000000', atNew));
  let c1: Record<string, unknown>; let c2: Record<string, unknown>;
  try {
    const r1 = await settleJobCommission(mkInput(jB, W3, '1000000', atOld));
    c1 = { ok: r1.result.ok, replay: r1.business.replay, fee: r1.plan.fee, x: r1.plan.layers.map((l) => l.x),
      policy_id: r1.plan.policy.policy_id, fingerprint: r1.payload.request_fingerprint };
  } catch (e) { c1 = { threw: tsErr(e) }; }
  const hashBefore2 = await eventRowsHash(jobSettleKey(jB));
  try {
    const r2 = await settleJobCommission(mkInput(jB, W3, '1000000', atNew));
    c2 = { ok: r2.result.ok, replay: r2.business.replay, fee_planned: r2.plan.fee,
      x_planned: r2.plan.layers.map((l) => l.x), policy_id_planned: r2.plan.policy.policy_id,
      fingerprint: r2.payload.request_fingerprint };
  } catch (e) { c2 = { threw: tsErr(e) }; }
  const hashAfter2 = await eventRowsHash(jobSettleKey(jB));
  const factB = await readEventFacts(jobSettleKey(jB), String(EMP), String(W3), q(p));
  out.Q3_same_key_policy_revision = {
    policy_old: { policy_id: polOld.policy_id, fee_rate_bp: polOld.fee_rate_bp, levels: polOld.levels, w: polOld.weights_bp },
    policy_new: { policy_id: polNew.policy_id, fee_rate_bp: polNew.fee_rate_bp, levels: polNew.levels, w: polNew.weights_bp },
    plan_old: { fee: planOld.fee, M: planOld.M, x: planOld.layers.map((l) => l.x) },
    plan_new_if_recomputed: { fee: planNew.fee, M: planNew.M, x: planNew.layers.map((l) => l.x) },
    first_call: c1, second_call: c2, rows_hash_before_second: hashBefore2, rows_hash_after_second: hashAfter2,
    rows_unchanged: hashBefore2.hash === hashAfter2.hash,
    facts: { rows_total: factB.rows_total, root_rows: factB.root_rows, minus2_net: factB.minus2_net,
      ev_net_sum: factB.ev_net_sum, commission_rows: factB.commission_rows },
    same_fingerprint: (c1.fingerprint as string) === (c2.fingerprint as string),
    verdict_note: 'CR87：第二次应 replay=true 且账上金额仍是第一版（不追溯、不双发、不 409）',
  };

  // ---------------------------------------------------------------- ④ 同内容不同键
  const jC1 = JOB(3), jC2 = JOB(4);
  await holdFor(p, String(EMP), cid, '200000', jC1, `ops:p1u:holdC1-${RUN}`);
  await holdFor(p, String(EMP), cid, '200000', jC2, `ops:p1u:holdC2-${RUN}`);
  let q4: Record<string, unknown>;
  try {
    const rC1 = await settleJobCommission(mkInput(jC1, W2, '100000'));
    const rC2 = await settleJobCommission(mkInput(jC2, W2, '100000'));
    q4 = { key1: rC1.plan.idempotency_key, key2: rC2.plan.idempotency_key,
      both_ok: rC1.result.ok && rC2.result.ok, replay1: rC1.business.replay, replay2: rC2.business.replay,
      note: '幂等键由 job_id 派生 ⇒ 两个 job 是两个事件（设计如此，不是双发缺陷）' };
  } catch (e) { q4 = { threw: tsErr(e) }; }
  out.Q4_same_content_diff_key = q4;

  // ---------------------------------------------------------------- ⑤ 政策版本化
  const ats = ['1969-12-31T00:00:00Z', '1970-01-01T00:00:01Z', '2026-09-27T10:25:40Z', '2026-09-27T10:25:43Z',
    '2026-09-27T10:40:09Z', '2026-09-27T10:56:44Z', '2030-01-01T00:00:00Z'];
  const pick: Array<Record<string, unknown>> = [];
  for (const at of ats) {
    try {
      const pol = await getCommissionPolicy(at, q(p));
      pick.push({ at, policy_id: pol.policy_id, fee: pol.fee_rate_bp, levels: pol.levels, eff: pol.effective_from });
    } catch (e) { pick.push({ at, threw: tsErr(e) }); }
  }
  out.Q5_policy_selection = {
    picks: pick,
    now_policy: await getCommissionPolicy(null, q(p)),
    /** 排期生效（未来）+ 回填（过去）在**回滚事务**内的行为 */
    insert_cases: await (async () => {
      const cases = [
        { tag: 'future_scheduled', at: new Date(Date.now() + 6 * 3600 * 1000).toISOString() },
        { tag: 'backdated_1970', at: '1970-01-01T00:00:00Z' },
        { tag: 'backdated_2026', at: '2026-01-01T00:00:00Z' },
        { tag: 'equal_to_existing', at: '2026-09-27T10:56:46.580869Z' },
        { tag: 'null_now', at: null },
      ];
      const res: Array<Record<string, unknown>> = [];
      for (const c of cases) {
        const r = await inRollbackTx(p, async (cl) => {
          const ex = cl as unknown as Qx;
          try {
            const pol = await insertCommissionPolicy({ fee_rate_bp: 200, levels: 2, weights_bp: [5000, 5000],
              effective_from: c.at, created_by: '0' }, ex as unknown as Queryable);
            return { inserted: true, policy_id: pol.policy_id, effective_from: pol.effective_from,
              visible_now: (await getCommissionPolicy(null, ex as unknown as Queryable)).policy_id };
          } catch (e) { return { inserted: false, err: tsErr(e) }; }
        });
        res.push({ ...c, ...(r.result as object ?? {}), rolled_back: r.rolled_back });
      }
      return res;
    })(),
    policies_count_unchanged: (await raw1(p, `SELECT count(*)::text AS n FROM commission_policy`)),
  };

  // ---------------------------------------------------------------- ⑥ 事件级不变量汇总
  const inv = await trySql(p, `
    WITH ev AS (SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) AS k,
                       SUM(delta+frozen_delta) AS net, bool_or(kind IN ('mint','burn')) AS mb
                  FROM ledger_entry GROUP BY 1)
    SELECT count(*)::text AS nonzero_events FROM ev WHERE net <> 0 AND NOT mb`);
  out.Q6_global = {
    nonzero_event_net: inv.rows[0],
    minus2_negative: await raw1(p, `SELECT count(*)::text AS n FROM account WHERE uid = -2 AND (balance < 0 OR frozen < 0)`),
  };

  const f = save('p2qa-04-idempotency-policy', out);
  console.log(JSON.stringify({ saved: f, Q1: out.Q1_concurrent_same_key, Q2: out.Q2_same_key_diff_content,
    Q3: { plan_old: (out.Q3_same_key_policy_revision as { plan_old: unknown }).plan_old,
      plan_new_if_recomputed: (out.Q3_same_key_policy_revision as { plan_new_if_recomputed: unknown }).plan_new_if_recomputed,
      first_call: (out.Q3_same_key_policy_revision as { first_call: unknown }).first_call,
      second_call: (out.Q3_same_key_policy_revision as { second_call: unknown }).second_call,
      rows_unchanged: (out.Q3_same_key_policy_revision as { rows_unchanged: unknown }).rows_unchanged,
      same_fingerprint: (out.Q3_same_key_policy_revision as { same_fingerprint: unknown }).same_fingerprint },
    Q4: out.Q4_same_content_diff_key,
    Q5_picks: (out.Q5_policy_selection as { picks: unknown }).picks,
    Q5_insert_cases: (out.Q5_policy_selection as { insert_cases: unknown }).insert_cases,
    Q6: out.Q6_global }, null, 2));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
