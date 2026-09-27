/**
 * p2qa-02 · 取整 / 残数分配 / 破平局 / 重归一化 / 巨值 / decimals（独立质检 Neng）
 * 手法：① 用**自己写的参考实现**（第二轮算法）对拍 splitPool（不采信被测实现的 order 字段）
 *       ② 网格性质测试（Σx == P、0 <= D < M、+1 个数 == D、顺序是置换）
 *       ③ 平局用「构造多个同余数」的用例钉死「更深层优先」
 *       ④ 真事件：短链 / M=1 / fee=1 / fee=0 / decimals 0 vs 6
 */
import { mkPool, raw, raw1, save, ensureUsers, ensureCurrency, mintTo, holdFor, trySql, RUN, type Qx } from './p2qa-lib';
import { splitPool, computeFee, computeNet, mulDivHalfUp, planJobSettlement, type SettleJobInput, type Queryable } from '../src/commission';
import { LedgerError, isLedgerError } from '../src/ledger-errors';

const tsErr = (e: unknown): Record<string, unknown> =>
  isLedgerError(e) ? { ts_code: (e as LedgerError).code, http: (e as LedgerError).httpStatus, details: (e as LedgerError).details }
    : { ts_code: 'NON_LEDGER', message: String(e) };

/** 参考实现（独立于 src/commission.ts 的写法） */
const refSplit = (P: bigint, w: bigint[]): { x: bigint[]; D: bigint; order: number[]; W: bigint } => {
  const W = w.reduce((a, b) => a + b, 0n);
  if (W === 0n) throw new Error('W=0');
  const q = w.map((wi) => (P * wi) / W);
  const r = w.map((wi) => (P * wi) % W);
  const D = P - q.reduce((a, b) => a + b, 0n);
  const order = w.map((_, i) => i).sort((a, b) => (r[b] > r[a] ? 1 : r[b] < r[a] ? -1 : b - a));
  const x = [...q];
  for (let k = 0; k < Number(D); k++) x[order[k]] += 1n;
  return { x, D, order, W };
};

const D10 = [3000, 2000, 1500, 1000, 800, 600, 500, 300, 200, 100];

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '12';
  const p = mkPool(12);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = { script: 'scripts/p2qa-02-rounding-renorm.ts', run: RUN };

  // ============================ A 网格性质测试 ============================
  const weightSets: Record<string, number[]> = {
    d10: D10,
    tie2: [2500, 2500],
    tie3: [1000, 1000, 1000],
    tie10: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
    skew: [9000, 100, 100, 100, 100, 100, 100, 100, 100, 300],
    ones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    big_rem: [9999, 1],
  };
  const Ps: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '17', '49', '50', '99', '100', '101',
    '997', '1000', '10000', '10001', '999999', '123456789'];
  const grid: Array<Record<string, unknown>> = [];
  let gridBad = 0;
  for (const [wn, ws] of Object.entries(weightSets)) {
    for (let M = 1; M <= ws.length; M++) {
      const w = ws.slice(0, M).map((x) => BigInt(x));
      for (const Ps_ of Ps) {
        const P = BigInt(Ps_);
        const got = splitPool(Ps_, w.map(String));
        const exp = refSplit(P, w);
        const xg = got.x.map(BigInt);
        const sumOk = xg.reduce((a, b) => a + b, 0n) === P;
        const refOk = JSON.stringify(got.x) === JSON.stringify(exp.x.map(String));
        const dOk = got.D === exp.D.toString();
        const dRange = P === 0n ? got.D === '0' : (BigInt(got.D) >= 0n && BigInt(got.D) < BigInt(M));
        const onesOk = got.plus_one_levels.length === Number(got.D);
        const nonneg = xg.every((v) => v >= 0n);
        const permOk = JSON.stringify([...got.order].sort((a, b) => a - b)) === JSON.stringify(ws.slice(0, M).map((_, i) => i));
        if (!(sumOk && refOk && dOk && dRange && onesOk && nonneg && permOk)) {
          gridBad++;
          grid.push({ wn, M, P: Ps_, sumOk, refOk, dRange, onesOk, nonneg, permOk,
            got_x: got.x, ref_x: exp.x.map(String), D: got.D, ref_D: exp.D.toString() });
        }
      }
    }
  }
  out.grid = { cases: Object.keys(weightSets).length * 10 * Ps.length, bad: gridBad, bad_detail: grid.slice(0, 20) };

  // ============================ B 平局（多个同余数）============================
  const tieCases = [
    { name: '例5 P=1 M=2 w={2500,2500}', P: '1', w: ['2500', '2500'] },
    { name: 'P=1 M=3 w={1000,1000,1000}', P: '1', w: ['1000', '1000', '1000'] },
    { name: 'P=2 M=3 w={1000,1000,1000}（两个 +1 都该给更深）', P: '2', w: ['1000', '1000', '1000'] },
    { name: 'P=1 M=10 w=全 1000', P: '1', w: Array(10).fill('1000') },
    { name: 'P=5 M=5 w={2000,2000,2000,2000,2000}（D=5 全平局）', P: '5', w: Array(5).fill('2000') },
    { name: 'P=7 M=4 w={1000,1000,1000,1000}', P: '7', w: Array(4).fill('1000') },
    { name: 'P=1 M=2 w={3000,2000}（无平局 ⇒ 最大余数者得）', P: '1', w: ['3000', '2000'] },
    { name: 'P=1 M=10 w=默认（无平局）', P: '1', w: D10.map(String) },
    { name: 'P=100 M=3 w={3000,2000,1500} 全余 0?', P: '100', w: ['3000', '2000', '1500'] },
  ];
  out.ties = tieCases.map((c) => {
    const got = splitPool(c.P, c.w);
    const exp = refSplit(BigInt(c.P), c.w.map(BigInt));
    const maxR = Math.max(...got.r.map(Number));
    const tiedAtMax = got.r.map((r, i) => (Number(r) === maxR ? i + 1 : 0)).filter((x) => x > 0);
    return { name: c.name, P: c.P, w: c.w, x: got.x, D: got.D, addl: got.plus_one_levels, order: got.order,
      r: got.r, tied_levels_at_max_remainder: tiedAtMax,
      matches_reference: JSON.stringify(got.x) === JSON.stringify(exp.x.map(String)),
      sum_equals_P: got.x.reduce((a, b) => a + BigInt(b), 0n).toString() === c.P };
  });

  // ============================ C fee 取整边界（half-up）============================
  const feeCases = ['1', '49', '50', '51', '99', '100', '101', '149', '150', '199', '200',
    '9_223_372_036_854_775_807'.replace(/_/g, ''), '18446744073709551615', '92233720368547758079999'];
  out.fee_rounding = feeCases.map((g) => {
    let r: Record<string, unknown>;
    try {
      const fee100 = computeFee(g, 100), fee500 = computeFee(g, 500);
      r = { gross: g, fee_100bp: fee100.toString(), fee_500bp: fee500.toString(),
        net_100: computeNet(g, fee100).toString(),
        net_plus_fee_eq_gross: (computeNet(g, fee100) + fee100).toString() === g };
    } catch (e) { r = { gross: g, throw: tsErr(e) }; }
    return r;
  });
  out.muldiv_den_zero = (() => { try { mulDivHalfUp(1n, 1n, 0n); return 'NO_THROW'; } catch (e) { return tsErr(e); } })();

  // ============================ D 巨值：接近 bigint 上限 ============================
  const MAXI = 9223372036854775807n;
  const hugeOut: Array<Record<string, unknown>> = [];
  for (const P of [String(MAXI), String(MAXI - 1n), '1000000000000000000']) {
    for (const ws of [D10, [2500, 2500], Array(10).fill(1000)]) {
      const got = splitPool(P, ws.map(String));
      const ref = refSplit(BigInt(P), ws.map(BigInt));
      hugeOut.push({ P, M: ws.length, sum_equals_P: got.sum_x === P,
        matches_reference: JSON.stringify(got.x) === JSON.stringify(ref.x.map(String)),
        first: got.x[0], last: got.x[got.x.length - 1], D: got.D, W: got.W });
    }
  }
  out.huge = { cases: hugeOut, db_max_single_amount: await raw1(p, `SELECT ledger_max_single_amount()::text AS m`) };
  out.huge_fee_reject = await trySql(p, `SELECT (($1::numeric) ) AS x`, ['1e40']);

  // ============================ E 真事件（短链 / M=1 / 小数位）============================
  const EMP = 954001;
  const CHAINS: Record<string, { worker: number; anc: number[] }> = {
    m1: { worker: 954601, anc: [954611] },
    m4: { worker: 954602, anc: [954621, 954622, 954623, 954624] },
    m5: { worker: 954603, anc: [954631, 954632, 954633, 954634, 954635] },
    dec6: { worker: 954604, anc: [954641, 954642] },
  };
  const allU = [EMP, ...Object.values(CHAINS).flatMap((c) => [c.worker, ...c.anc])];
  await ensureUsers(p, allU);
  const cid0 = await ensureCurrency(p, 'p1u0' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), String(EMP), 0);
  const cid6 = await ensureCurrency(p, 'p1u6' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), String(EMP), 6);
  await mintTo(p, String(EMP), cid0, '9000000', `ops:p1u:mint0-${RUN}`);
  await mintTo(p, String(EMP), cid6, '9000000', `ops:p1u:mint6-${RUN}`);
  const bind = (c: number, pa: number) => trySql(p, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(c), String(pa)]);
  const binds: Array<Record<string, unknown>> = [];
  for (const [name, c] of Object.entries(CHAINS)) {
    for (let i = c.anc.length - 1; i >= 0; i--) {
      const child = i === 0 ? c.worker : c.anc[i - 1];
      const r = await bind(child, c.anc[i]);
      binds.push({ name, edge: `${child}->${c.anc[i]}`, ok: r.ok, err: r.error ?? null });
    }
  }
  out.binds = binds;
  out.binds_failed = binds.filter((b) => b.ok !== true);

  const settleOn = async (tag: string, worker: number, gross: string, cid: string, jobN: number) => {
    const jobId = (954_500_000_000_000n + BigInt(jobN)).toString();
    const hold = await holdFor(p, String(EMP), cid, gross, jobId, `ops:p1u:hold-${tag}-${RUN}`);
    try {
      plan: {
        const plan = await planJobSettlement({ jobId, employerUid: String(EMP), workerUid: String(worker), cid, gross, ex: q } as SettleJobInput);
        return { tag, job_id: jobId, cid, hold_ok: hold.ok, hold_err: hold.error ?? null,
          fee: plan.fee, net: plan.net, pool: plan.pool, M: plan.M, N: plan.N, W: plan.W, chain_depth: plan.chain_depth,
          weights: plan.weights_bp, x: plan.layers.map((l) => l.x), uids: plan.layers.map((l) => l.beneficiary_uid),
          split: plan.split && { D: plan.split.D, order: plan.split.order, plus: plan.split.plus_one_levels,
            r: plan.split.r, sum_x: plan.split.sum_x }, zero: plan.zero_amount, no_referrer: plan.no_referrer };
      }
    } catch (e) { return { tag, job_id: jobId, cid, throw: tsErr(e) }; }
  };
  out.real_cases = {
    m1_chain: await settleOn('m1', CHAINS.m1.worker, '1000000', cid0, 1),
    m4_chain: await settleOn('m4', CHAINS.m4.worker, '1000000', cid0, 2),
    m5_chain: await settleOn('m5', CHAINS.m5.worker, '1000000', cid0, 3),
    m5_small_gross_50: await settleOn('m5g50', CHAINS.m5.worker, '50', cid0, 4),
    m5_gross_lt_levels: await settleOn('m5g5', CHAINS.m5.worker, '5', cid0, 5),
    dec6_m2: await settleOn('dec6', CHAINS.dec6.worker, '1000000', cid6, 6),
    dec0_m2_same: await settleOn('dec0', CHAINS.dec6.worker, '1000000', cid0, 7),
  };

  // 真落账（只落 2 条：m1 与 dec6）证明「计划 == 实落」
  const commitOne = async (tag: string, worker: number, gross: string, cid: string, jobN: number) => {
    const jobId = (954_600_000_000_000n + BigInt(jobN)).toString();
    await holdFor(p, String(EMP), cid, gross, jobId, `ops:p1u:holdc-${tag}-${RUN}`);
    const { settleJobCommission } = await import('../src/commission');
    try {
      const o = await settleJobCommission({ jobId, employerUid: String(EMP), workerUid: String(worker), cid, gross, ex: q } as SettleJobInput);
      const f = await trySql(p, `
        SELECT COALESCE(sum(CASE WHEN uid=-2 AND kind='job_fee' THEN delta ELSE 0 END),0)::text AS pool_in,
               COALESCE(-sum(CASE WHEN uid=-2 AND kind='commission' THEN delta ELSE 0 END),0)::text AS comm_out,
               COALESCE(sum(CASE WHEN uid=-2 THEN delta ELSE 0 END),0)::text AS minus2_net,
               COALESCE(sum(delta+frozen_delta),0)::text AS ev_net_sum,
               count(*)::text AS rows_total
          FROM ledger_entry WHERE event_root_key = $1`, [o.plan.idempotency_key]);
      return { tag, job_id: jobId, ok: o.result.ok, key: o.plan.idempotency_key,
        plan_x: o.plan.layers.map((l) => l.x), plan_W: o.plan.W, C0: o.plan.cid,
        facts: f.rows[0], expected_entry_count: o.business.expected_entry_count };
    } catch (e) { return { tag, job_id: jobId, throw: tsErr(e) }; }
  };
  out.committed = {
    m1_pool_one_level: await commitOne('m1', CHAINS.m1.worker, '1000000', cid0, 1),
    dec6_two_levels: await commitOne('dec6', CHAINS.dec6.worker, '1000000', cid6, 2),
    m5_fee_one_unit: await commitOne('m5p1', CHAINS.m5.worker, '50', cid0, 3),
  };

  const f = save('p2qa-02-rounding-renorm', out);
  console.log(JSON.stringify({ saved: f, grid: { cases: (out.grid as { cases: number }).cases, bad: gridBad },
    ties: (out.ties as Array<Record<string, unknown>>).map((t) => ({ name: t.name, x: t.x, D: t.D,
      addl: t.addl, ref: t.matches_reference, sum: t.sum_equals_P, tied: t.tied_levels_at_max_remainder })),
    fee_rounding: out.fee_rounding, huge_bad: hugeOut.filter((h) => !h.sum_equals_P || !h.matches_reference),
    db_max_single_amount: (out.huge as { db_max_single_amount: unknown }).db_max_single_amount,
    real: Object.fromEntries(Object.entries(out.real_cases as Record<string, Record<string, unknown>>)
      .map(([k, v]) => [k, { fee: v.fee, M: v.M, N: v.N, W: v.W, x: v.x, throw: v.throw ?? null }])),
    committed: out.committed }, null, 2));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
