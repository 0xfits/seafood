/**
 * p2qa-01 · Σ 守恒攻击面 + 政策写入守卫 + 归属错配（独立质检 Neng）
 * ---------------------------------------------------------------------------
 * 攻击 1：保平衡的 Σ 篡改（双分录总数仍 0、但池子少分 / 多分）⇒ 期望 LD032
 * 攻击 2：金额在两受益人之间互换（Σ 仍 == P）⇒ 能不能被拦？（如实作答）
 * 攻击 3：同一 uid 占两层（重复受益人，Σ 仍 == P）⇒ 能不能被拦？
 * 攻击 4：池子有入无出；只入不出；有出无入（全局不平衡）
 * 攻击 5：政策写入守卫（层数不符 / Σ>10000 / w1=0 / Σ=0 / 负权重 / 费率越界 / 重复 effective_from）
 * 攻击 6：运行档 W=0 分支是否可达（写入档拦住 ⇒ 需绕开守卫才可达）
 * 测试数据：uid 954xxx；symbol p1u*；辅助键 ops:p1u:*（业务事件键按 spec = biz:job:settle:<job_id>）
 */
import {
  mkPool, raw, raw1, save, sha256, inRollbackTx, ensureUsers, ensureCurrency, mintTo, holdFor,
  tryFn, trySql, RUN, type Qx, type Outcome, type Conn,
} from './p2qa-lib';
import {
  splitPool, planJobSettlement, getCommissionPolicy, guardCommissionPolicy, settleJobCommission,
  computeFee, COMMISSION_POOL_UID, PLATFORM_REVENUE_UID, type SettleJobInput, type Queryable,
} from '../src/commission';
import { LedgerError, normalizeLedgerError, httpStatusOf, isLedgerError } from '../src/ledger-errors';

const EMP = 954001;
const W2 = 954002, A2 = [954101, 954102];
const W3 = 954003, A3 = [954111, 954112, 954113];
const CID_DEC0_SYM = 'p1u0' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z');
// job_id 按 RUN 偏移 ⇒ 每次跑都是**全新事件**（否则第二次跑全落在幂等重放上，读数退化）
const JOBOFF = BigInt('0x' + sha256('joboff' + RUN).slice(0, 8)) % 1000000000n;
const JOB = (n: number): string => (954_000_000_000_000n + JOBOFF + BigInt(n)).toString();

const tsErr = (e: unknown): Record<string, unknown> => {
  if (isLedgerError(e)) return { ts_code: (e as LedgerError).code, http: (e as LedgerError).httpStatus,
    status_field: (e as LedgerError).status, details: (e as LedgerError).details };
  const n = normalizeLedgerError(e);
  return { ts_code: n.code, http: n.httpStatus, details: n.details };
};

const ent = (uid: string, cid: string, kind: string, delta: string, frozen: string, refType: string,
  refId: string, memo: string): Record<string, unknown> =>
  ({ uid, cid, kind, delta, frozen_delta: frozen, memo, ref_type: refType, ref_id: refId });

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '12';
  const p = mkPool(12);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = { script: 'scripts/p2qa-01-sigma-conservation.ts', run: RUN };
  const before = await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`);

  // ---------------------------------------------------------------- 0 夹具
  const uids = [EMP, W2, W3, ...A2, ...A3, 954004];
  await ensureUsers(p, uids);
  const cid = await ensureCurrency(p, CID_DEC0_SYM, String(EMP), 0);
  const mk = await mintTo(p, String(EMP), cid, '5000000', `ops:p1u:mint-${RUN}`);
  const hd = await holdFor(p, String(EMP), cid, '100000', JOB(900), `ops:p1u:hold-${RUN}`);
  const bind = (c: number, pa: number) =>
    trySql(p, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(c), String(pa)]);
  const binds: Array<Record<string, unknown>> = [];
  for (const [c, pa] of [[A3[1], A3[2]], [A3[0], A3[1]], [W3, A3[0]], [A2[0], A2[1]], [W2, A2[0]]]) {
    const r = await bind(c as number, pa as number);
    binds.push({ edge: `${c}->${pa}`, ok: r.ok, err: r.error ?? null, j: r.rows[0] ?? null });
  }
  const pol = await getCommissionPolicy(new Date(), q);
  out.setup = { cid, symbol: CID_DEC0_SYM, mint: { ok: mk.ok, err: mk.error ?? null },
    hold: { ok: hd.ok, err: hd.error ?? null }, binds, effective_policy_now:
    { policy_id: pol.policy_id, fee_rate_bp: pol.fee_rate_bp, levels: pol.levels, weights: pol.weights_bp } };
  out.o_chain = await trySql(p, `WITH RECURSIVE up AS (
      SELECT parent_uid AS p, 1 AS l FROM referral WHERE child_uid = $1
      UNION ALL SELECT r.parent_uid, up.l+1 FROM referral r JOIN up ON r.child_uid = up.p WHERE up.l < 10)
    SELECT p::text AS uid, l::text AS level FROM up ORDER BY l`, [String(W3)]);

  // ---------------------------------------------------------------- 1 Σ 守恒攻击
  const baseEntries = (fee: number, jobId: string) => [
    ent(String(EMP), cid, 'job_fee', '0', (-fee).toString(), 'job', jobId, 'QA 手续费'),
    ent(COMMISSION_POOL_UID, cid, 'job_fee', fee.toString(), '0', 'job', jobId, 'QA 手续费入池'),
  ];
  const pay = (uid: string, x: number, jobId: string, l: number) =>
    [ent(COMMISSION_POOL_UID, cid, 'commission', (-x).toString(), '0', 'commission_payout', jobId, `QA 出池 L=${l}`),
      ent(uid, cid, 'commission', x.toString(), '0', 'commission_payout', jobId, `QA 第 ${l} 层`)];

  const tamper = async (tag: string, entries: Array<Record<string, unknown>>, jobId: string) => {
    const payload = { op: 'entries', idempotency_key: `ops:p1u:${tag}-${RUN}`, request_fingerprint: sha256(tag + RUN),
      ref_type: 'job', ref_id: jobId, memo: `p2qa tamper ${tag}`,
      entries: entries.map((e) => ({ ...e, memo: String(e.memo) + ` [${tag}]` })) };
    return { tag, job_id: jobId, payload, outcome: await tryFn(p, payload) };
  };
  const cases: Array<Record<string, unknown>> = [];

  // 1.1 保平衡的 Σ 篡改：池子少分 100（入 1000 / 出 900）⇒ 必须 LD032
  cases.push(await tamper('sigma-short-100', [
    ...baseEntries(1000, JOB(1)),
    ent(COMMISSION_POOL_UID, cid, 'commission', '-900', '0', 'commission_payout', JOB(1), 'QA 出池 L=1'),
    ent(String(A2[0]), cid, 'commission', '900', '0', 'commission_payout', JOB(1), 'QA 第 1 层'),
  ], JOB(1)));

  // 1.2 池子有入无出（入 1000 / 无 commission）⇒ 必须 LD032
  cases.push(await tamper('pool-in-no-out', baseEntries(1000, JOB(2)), JOB(2)));

  // 1.3 有出无入（只给受益人加钱，无 -2 出池方）⇒ 全局不平衡（另一道闸）
  cases.push(await tamper('credit-without-payer', [
    ...baseEntries(1000, JOB(3)),
    ent(String(A2[0]), cid, 'commission', '1000', '0', 'commission_payout', JOB(3), 'QA 第 1 层（无出池方）'),
  ], JOB(3)));

  // 1.4 金额在两层之间**互换**（Σ 仍 == P；L1 拿 L2 的份、L2 拿 L1 的份）
  //     政策 = 当前生效（fee=100 / levels=10 / w=默认），链深 2 ⇒ P=1000、W=5000、正解 x={600,400}
  const planSwap = await planJobSettlement({ jobId: JOB(4), employerUid: String(EMP), workerUid: String(W2),
    cid, gross: '100000', ex: q } as SettleJobInput);
  const tamperSwap = await tamper('attribution-swapped', [
      ...baseEntries(1000, JOB(4)),
      ent(COMMISSION_POOL_UID, cid, 'commission', '-400', '0', 'commission_payout', JOB(4), 'QA 出池 L=1'),
      ent(String(A2[0]), cid, 'commission', '400', '0', 'commission_payout', JOB(4), 'QA 第 1 层'),
      ent(COMMISSION_POOL_UID, cid, 'commission', '-600', '0', 'commission_payout', JOB(4), 'QA 出池 L=2'),
      ent(String(A2[1]), cid, 'commission', '600', '0', 'commission_payout', JOB(4), 'QA 第 2 层'),
    ], JOB(4));
  cases.push({ ...tamperSwap, note: 'L1/L2 金额互换，Σ 不变',
    layer_possible_x: planSwap.layers.map((l) => `${l.beneficiary_uid}:${l.x}`), pool: planSwap.pool });

  // 1.5 同一 uid 占两层（重复受益人；Σ 仍 == P）
  const planDup = await planJobSettlement({ jobId: JOB(5), employerUid: String(EMP), workerUid: String(W3),
    cid, gross: '100000', ex: q } as SettleJobInput);
  const tamperDup = await tamper('duplicate-beneficiary', [
      ...baseEntries(1000, JOB(5)),
      ent(COMMISSION_POOL_UID, cid, 'commission', '-461', '0', 'commission_payout', JOB(5), 'QA 出池 L=1'),
      ent(String(A3[0]), cid, 'commission', '461', '0', 'commission_payout', JOB(5), 'QA 第 1 层'),
      ent(COMMISSION_POOL_UID, cid, 'commission', '-308', '0', 'commission_payout', JOB(5), 'QA 出池 L=2'),
      ent(String(A3[0]), cid, 'commission', '308', '0', 'commission_payout', JOB(5), 'QA 第 2 层（同一 uid 第二层）'),
      ent(COMMISSION_POOL_UID, cid, 'commission', '-231', '0', 'commission_payout', JOB(5), 'QA 出池 L=3'),
      ent(String(A3[1]), cid, 'commission', '231', '0', 'commission_payout', JOB(5), 'QA 第 3 层'),
    ], JOB(5));
  cases.push({ ...tamperDup, note: '同一 uid 吃两层，Σ 不变',
    layer_possible_x: planDup.layers.map((l) => `${l.beneficiary_uid}:${l.x}`), pool: planDup.pool });

  out.attack_sigma = cases.map((c) => ({
    tag: c.tag, note: c.note ?? null, job_id: c.job_id, pool: c.pool ?? null, layer_possible_x: c.layer_possible_x ?? null,
    key: (c.payload as { idempotency_key: string }).idempotency_key,
    ok: (c.outcome as Outcome).ok, entry_count: (c.outcome as Outcome).entries?.length ?? null,
    error: (c.outcome as Outcome).error ?? null,
  }));

  // 对「被接受」的那两条取事件读数（证明 Σ 绿但归属错）
  const factsOf = async (rootKey: string) => {
    const r = await trySql<{ uid: string; kind: string; delta: string; n: string }>(p, `
      SELECT uid::text AS uid, kind, delta::text AS delta FROM ledger_entry
       WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1 ORDER BY txid`, [rootKey]);
    return r.rows;
  };
  out.accepted_attribution_evidence = {
    swapped_rows: await factsOf(`ops:p1u:attribution-swapped-${RUN}`),
    duplicate_rows: await factsOf(`ops:p1u:duplicate-beneficiary-${RUN}`),
  };

  // ---------------------------------------------------------------- 2 边界（真事件：fee 极小 / fee = 0 / 短链）
  let tagSeq = 0;
  const settle = async (tag: string, worker: number, gross: string, at?: string, cidOverride?: string) => {
    const jobId = JOB(20 + (tagSeq += 1));
    const hold = await holdFor(p, String(EMP), cidOverride ?? cid, gross, jobId, `ops:p1u:hold-${tag}-${RUN}`);
    try {
      const o = await settleJobCommission({ jobId, employerUid: String(EMP), workerUid: String(worker),
        cid: cidOverride ?? cid, gross, ex: q, at: at ?? null } as SettleJobInput);
      return { tag, job_id: jobId, hold: { ok: hold.ok, err: hold.error ?? null }, ok: o.result.ok,
        replay: o.business.replay, key: o.plan.idempotency_key,
        plan: { fee: o.plan.fee, net: o.plan.net, pool: o.plan.pool, M: o.plan.M, N: o.plan.N, W: o.plan.W,
          chain_depth: o.plan.chain_depth, weights: o.plan.weights_bp,
          x: o.plan.layers.map((l) => l.x), uids: o.plan.layers.map((l) => l.beneficiary_uid),
          split: o.plan.split && { D: o.plan.split.D, plus_one_levels: o.plan.split.plus_one_levels } },
        entry_count: o.event.entries.length, derived_keys: o.event.derived_keys,
        assertions: o.event.assertions, fingerprint: o.payload.request_fingerprint,
        facts: await (async () => (await trySql(p, `
          SELECT COALESCE(sum(CASE WHEN uid=-2 AND kind='job_fee' THEN delta ELSE 0 END),0)::text AS pool_in,
                 COALESCE(-sum(CASE WHEN uid=-2 AND kind='commission' THEN delta ELSE 0 END),0)::text AS comm_out,
                 COALESCE(sum(CASE WHEN uid=-2 THEN delta ELSE 0 END),0)::text AS minus2_net,
                 COALESCE(sum(CASE WHEN uid=-1 THEN delta ELSE 0 END),0)::text AS minus1_net,
                 COALESCE(sum(delta+frozen_delta),0)::text AS ev_net_sum,
                 count(*)::text AS rows_total
            FROM ledger_entry WHERE event_root_key = $1`, [o.plan.idempotency_key])).rows[0])() };
    } catch (e) { return { tag, job_id: jobId, throw: tsErr(e) }; }
  };
  out.boundaries = {
    fee_one_unit: await settle('b28', W3, '50'),       // fee = 1（P=1 ⇒ 残数分配）
    fee_zero: await settle('b29', W3, '30'),           // fee = 0（零额）
    short_chain_m3: await settle('b30', W3, '1000000'), // P=10000、M=3 ⇒ 逐值 {4615,3077,2308}
    chain_m2: await settle('b31', W2, '100000'),
  };
  out.static = {
    fee_of_50_at_100bp: computeFee('50', 100).toString(),
    fee_of_30_at_100bp: computeFee('30', 100).toString(),
    split_p1_m2_2500: splitPool('1', ['2500', '2500']),
    split_p0: splitPool('0', ['3000', '2000']),
    split_w0_branch: (() => { try { splitPool('1000', ['0', '0']); return 'NO_THROW'; } catch (e) { return tsErr(e); } })(),
    split_m0_with_pool: (() => { try { splitPool('1000', []); return 'NO_THROW'; } catch (e) { return tsErr(e); } })(),
    split_m0_zero_pool: splitPool('0', []),
  };

  // ---------------------------------------------------------------- 3 政策写入守卫（全部在回滚事务内 ⇒ 零残留）
  const policyCases = [
    { tag: 'levels_mismatch', fee: 100, levels: 3, weights: [3000, 2000], at: null },
    { tag: 'sum_over_10000', fee: 100, levels: 2, weights: [6000, 5000], at: null },
    { tag: 'w1_zero', fee: 100, levels: 2, weights: [0, 3000], at: null },
    { tag: 'sum_zero', fee: 100, levels: 2, weights: [0, 0], at: null },
    { tag: 'negative_weight', fee: 100, levels: 2, weights: [-100, 3000], at: null },
    { tag: 'fee_rate_99', fee: 99, levels: 2, weights: [2500, 2500], at: null },
    { tag: 'fee_rate_501', fee: 501, levels: 2, weights: [2500, 2500], at: null },
    { tag: 'levels_11', fee: 100, levels: 11, weights: [900, 900, 900, 900, 900, 900, 900, 900, 900, 900, 900], at: null },
    { tag: 'sum_9899_ok', fee: 100, levels: 2, weights: [4900, 4999], at: null },
    { tag: 'levels_0', fee: 100, levels: 0, weights: [], at: null },
    { tag: 'sum_9999_ok', fee: 100, levels: 2, weights: [4999, 5000], at: null },
    { tag: 'dup_effective_from', fee: 100, levels: 2, weights: [2500, 2500], at: '1970-01-01T00:00:00Z' },
    { tag: 'created_by_positive_user', fee: 100, levels: 2, weights: [2500, 2500], at: null, createdBy: '954001' },
    { tag: 'created_by_minus4', fee: 100, levels: 2, weights: [2500, 2500], at: null, createdBy: '-4' },
  ];
  const polOut: Array<Record<string, unknown>> = [];
  for (const c of policyCases) {
    // 每个子用例**各用一个回滚事务**：否则前一条语句报错会把事务打挂，后续结果全部变成「事务已中止」
    const rawTx = await inRollbackTx(p, async (cl: Conn) => {
      const ins = await trySql(cl as Qx, `
        INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
        VALUES ($1::integer, $2::smallint, $3::smallint[], COALESCE($4::timestamptz, now()), $5::bigint)
        RETURNING policy_id::text`,
      [c.fee, c.levels, `{${c.weights.join(',')}}`, c.at, c.createdBy ?? '0']);
      return ins.ok ? { ok: true, policy_id: ins.rows[0]?.policy_id } : { ok: false, error: ins.error };
    });
    let tsGuard: Record<string, unknown> | string;
    try { guardCommissionPolicy({ fee_rate_bp: c.fee, levels: c.levels, weights_bp: c.weights }, 'write');
      tsGuard = 'NO_THROW'; } catch (e) { tsGuard = tsErr(e); }
    const tsTx = await inRollbackTx(p, async (cl: Conn) => {
      try {
        const pol = await (await import('../src/commission')).insertCommissionPolicy(
          { fee_rate_bp: c.fee, levels: c.levels, weights_bp: c.weights,
            effective_from: c.at, created_by: c.createdBy ?? '0' }, cl as unknown as Queryable);
        return { inserted: true, policy_id: pol.policy_id };
      } catch (e) { return { inserted: false, err: tsErr(e) }; }
    });
    polOut.push({ tag: c.tag, fee: c.fee, levels: c.levels, weights: c.weights, at: c.at,
      createdBy: c.createdBy ?? '0', db_insert: rawTx.result, db_tx_error: rawTx.error ? String(rawTx.error) : null,
      ts_guard: tsGuard, ts_insert: tsTx.result, ts_tx_error: tsTx.error ? String(tsTx.error) : null,
      rolled_back: rawTx.rolled_back && tsTx.rolled_back });
  }
  out.policy_write_guards = polOut;

  // ---------------------------------------------------------------- 4 运行档 W=0 可达性（绕开写入守卫才可达）
  out.runtime_w0_reachability = await inRollbackTx(p, async (cl) => {
    const ex = cl as Qx;
    const dis = await trySql(ex, `ALTER TABLE commission_policy DISABLE TRIGGER trg_commission_policy_weights_guard`);
    const ins = await trySql(ex, `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
      VALUES (100, 2, '{0,3000}', now() + interval '2 hours', 0) RETURNING policy_id::text`);
    let readBack: Record<string, unknown> | string = 'n/a';
    try {
      const bad = await getCommissionPolicy(new Date(Date.now() + 4 * 3600 * 1000), ex as unknown as Queryable);
      readBack = { returned_weights: bad.weights_bp, policy_id: bad.policy_id };
    } catch (e) { readBack = tsErr(e); }
    const planCall = await (async () => {
      try {
        const pl = await planJobSettlement({ jobId: JOB(40), employerUid: String(EMP), workerUid: String(W2),
          cid, gross: '100000', at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), ex: ex as unknown as Queryable } as SettleJobInput);
        return { threw: false, layers: pl.layers.map((l) => l.x) };
      } catch (e) { return { threw: true, err: tsErr(e) }; }
    })();
    return { disable_trigger: dis.ok, insert_bad_policy: ins.ok ? { ok: true, policy_id: ins.rows[0]?.policy_id } : ins.error,
      read_path: readBack, plan_path: planCall, rolled_back_note: '本事务末尾一律 ROLLBACK' };
  });

  // ---------------------------------------------------------------- 5 收尾：无残留核对
  const after = await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`);
  out.no_residue = { ledger_entry_before: before, ledger_entry_after: after,
    delta: String(BigInt((after as { n: string }).n) - BigInt((before as { n: string }).n)),
    note: 'Δ 只应等于本轮**被接受**的测试事件条数；被拒的 tamper 事件必须 0 残留',
    tamper_keys_root_rows: await raw(p, `SELECT idempotency_key, count(*)::text AS n FROM ledger_entry
       WHERE idempotency_key LIKE 'ops:p1u:%' GROUP BY 1 ORDER BY 1`) };

  const f = save('p2qa-01-sigma-conservation', out);
  console.log(JSON.stringify({ saved: f,
    attack_sigma: (out.attack_sigma as Array<Record<string, unknown>>).map((a) => ({ tag: a.tag,
      ok: a.ok, err: (a.error as Record<string, unknown> | null)?.sqlstate ?? null,
      reason: (a.error as Record<string, unknown> | null)?.reason ?? null })),
    boundaries: Object.fromEntries(Object.entries(out.boundaries as Record<string, Record<string, unknown>>)
      .map(([k, v]) => [k, { plan_x: (v.plan as { x?: string[] } | undefined)?.x ?? null,
        plan_W: (v.plan as { W?: string } | undefined)?.W ?? null, throw: v.throw ?? null,
        rows: (v.facts as { rows_total?: string } | undefined)?.rows_total ?? null }])),
    policy_guards: (out.policy_write_guards as Array<Record<string, unknown>>).map((c) => ({ tag: c.tag,
      db: c.db_insert, ts_guard: (c.ts_guard as Record<string, unknown> | string) === 'NO_THROW' ? 'NO_THROW'
        : ((c.ts_guard as Record<string, unknown>)?.ts_code ?? c.ts_guard),
      ts_insert: typeof c.ts_insert === 'string' ? c.ts_insert : (c.ts_insert as Record<string, unknown>)?.ts_code })),
    runtime_w0: out.runtime_w0_reachability,
    no_residue: out.no_residue }, null, 2));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
