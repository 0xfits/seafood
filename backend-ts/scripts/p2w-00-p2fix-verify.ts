/**
 * p2w-00 · P2 独立质检（不通过）修复单的**验收探针** —— 六项缺陷的判据 + 判负对照，run-tagged 落盘。
 * ==========================================================================
 * 被测对象：`src/commission.ts`（F1 / F7① / F7②）+ `migrations/0011`（F3 / F6 / F2）。
 * 数据分区：uid **956xxx** / symbol 前缀 **p1w** / 幂等键前缀 **ops:p1w:**（绝不触碰 cid = 1
 *           与平台账户 0/-1/-2/-3 的既有余额；破坏性探针一律跑在**回滚事务**里）。
 * 用法：`npx ts-node --transpile-only scripts/p2w-00-p2fix-verify.ts [--assert]`
 *       `--assert` ⇒ 有红项则退出码 1（回归用）；读数落 `.p2w-artifacts/p2w-00-<RUN>.json`。
 * 判据（逐条对应质检单）：
 *   §A F1  坏链（2-环污染）⇒ `planJobSettlement`/`settleJobCommission` **落账前**响亮拒绝：
 *           500 类（`LEDGER_RECONCILE_MISMATCH` / `httpStatus=500`）+ reason
 *           `COMMISSION_CHAIN_ASSERTION_VIOLATED` + `failed_assertions` 含 `no_duplicate_uid`；
 *           **判负对照**：绕过 TS 闸、按同一份污染链手工组装载荷 ⇒ DB 侧 Σ 触发器 `ok=true` 放行
 *           （证明「DB 只保总量不保归属」，故 TS 闸是唯一防线）；**正向对照**：健康链照常出计划并落账。
 *   §B F7① `chain_truncated` 区分「恰好 cap」与「≥ cap」（同 `chain_depth` 下取值不同）；
 *           旧字段 `chain_depth` 语义未动。
 *   §C F7② 幂等重放返回的 `plan` 由**账上事件**导出（与账上读数逐字段相等），`plan_source` 可分辨；
 *           同键按**新政策**重算的金额与返回的 `plan` **不同**（证明未用当前政策重算）。
 *   §D F3  ①`SET CONSTRAINTS ALL IMMEDIATE` 前置 ⇒ 真事件不再假报 LD032；②真 Σ 不符（丢一对佣金 /
 *           只入不出两形态）在默认 DEFERRED 下**仍**落 LD032 + `COMMISSION_SPLIT_SUM_MISMATCH`；
 *           ③默认路径与「先落账再强制结算」行为不变；④登记边界：强制 IMMEDIATE 期间不判负（修法代价）。
 *   §E F6  「child 已绑」由裸 `INSERT` 与 `referral_bind` 两条路径 ⇒ **同码同 reason**（LD003）；
 *           判负对照：关掉守卫 ⇒ 裸 INSERT 退回 `23505`/`referral_pk`（= 修前形态）。
 *   §F F2  父存储 `depth` 陈旧 ⇒ 绑定被拒（LD016 + `REFERRAL_PARENT_DEPTH_INCONSISTENT`）；
 *           父 depth 一致 ⇒ 放行；判负对照：关掉守卫 ⇒ 新孩子继承陈旧 depth（50 ⇒ 51 = 修前形态）。
 *   §G 尾  全局图不变式 / 触发器启用态 / cid=1 平台账户未被触碰 / 残留登记。
 */
import {
  COMMISSION_REASON, LedgerError, planJobSettlement, settleJobCommission, getReferralChain,
  readEventFacts, readLedgerSettlement, readLedgerEventRows, readGraphInvariants,
  buildSettleEvent, splitPool, toPayloadEntry, settleJobFingerprint, getCommissionPolicy,
  type SettlementPlan, type SettleJobInput, type CommissionPolicy,
} from '../src/commission';
import {
  mkPool, raw, raw1, save, pgErr, tryFn, callFn, trySql, inRollbackTx, ensureUsers, ensureCurrency,
  mintTo, holdFor, triggerEnablement, sha256, RUN, type Qx, type PgErr,
} from './p2w-lib';

const ASSERT_MODE = process.argv.includes('--assert');
const reds: string[] = [];
const reads: Record<string, unknown> = {};
const judge = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) reds.push(extra === undefined ? name : `${name} :: ${JSON.stringify(extra)}`);
};
const rec = (k: string, v: unknown) => { reads[k] = v; };
const range = (start: number, n: number) => Array.from({ length: n }, (_, i) => String(start + i));
const errInfo = (e: unknown): Record<string, unknown> => {
  if (e instanceof LedgerError) {
    return { kind: 'LedgerError', code: e.code, httpStatus: e.httpStatus, status: e.status,
      reason: (e.details?.reason as string) ?? null, details: e.details };
  }
  return { kind: 'other', message: String((e as Error)?.message ?? e) };
};
const planRead = (p: SettlementPlan) => ({
  job_id: p.job_id, fee: p.fee, net: p.net, gross: p.gross, pool: p.pool,
  chain_depth: p.chain_depth, chain_truncated: p.chain_truncated, plan_source: p.plan_source,
  policy_reported: p.policy_reported, policy_id: p.policy.policy_id, fee_rate_bp: p.policy.fee_rate_bp,
  M: p.M, N: p.N, layers: p.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`),
  fee_credit_uid: p.fee_credit_uid, no_referrer: p.no_referrer, zero_amount: p.zero_amount,
});

// ---------------------------------------------------------------- 分区标识
const RUNTAG = String((Math.abs(parseInt(sha256(RUN).slice(0, 8), 16)) % 900000) + 100000);
const SYM = `p1w${RUNTAG}`;                       // symbol 前缀 p1w ✓
const JOB = (k: number) => `${RUNTAG}${k}`;       // 每次运行唯一（避免跑第二遍退化成重放）
const KEY = (what: string, k: string) => `ops:p1w:${RUNTAG}:${what}:${k}`;
const EMP = '956001';
const W_SHORT = '956002', W_DEEP = '956003', W_EV3 = '956006', W_F7B1 = '956008', W_EXACT10 = '956009';
const ANC3 = ['956101'];
const ANC12 = range(956111, 12);
const ANC3C = ['956141', '956142', '956143'];
const ANC2 = ['956161', '956162'];
const ANC10 = range(956171, 10);
const POISON = ['956701', '956702'];
const PROBE2 = range(956711, 9);
const GROSS_STD = '100000';   // levels=10 ⇒ fee=1000 ⇒ 20 条 commission + 4 = 24 条分录

(async () => {
  const p = mkPool(4);
  const cid = await ensureCurrency(p, SYM, '0', 8);
  await ensureUsers(p, [EMP, W_SHORT, W_DEEP, W_EV3, W_F7B1, W_EXACT10, ...ANC3, ...ANC12, ...ANC3C, ...ANC2, ...ANC10, ...POISON, ...PROBE2]);
  rec('env', { run: RUN, cid, symbol: SYM, jobtag: RUNTAG, gross_std: GROSS_STD });

  const platformSnapshot = () => raw<Record<string, unknown>>(p, `
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen, version::text AS version
      FROM account WHERE uid IN (-1,-2,-3) AND cid = 1 ORDER BY uid`);
  const cid1Before = await platformSnapshot();
  rec('cid1_platform_accounts_before', cid1Before);
  rec('schema_version', (await raw1<{ v: string }>(p, `SELECT max(version) AS v FROM schema_migration`))?.v ?? null);
  rec('trigger_enablement_before', await triggerEnablement(p));
  rec('graph_invariants_before', await readGraphInvariants(p));

  // ---------------------------------------------------------------- 夹具（幂等；父先子后）
  const bindIfMissing = async (ex: Qx, child: string, parent: string): Promise<string> => {
    const n = await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM referral WHERE child_uid = $1`, [child]);
    if (Number(n?.n ?? '0') > 0) return 'exists';
    const r = await trySql(ex, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1, $2, 0)`, [child, parent]);
    return r.ok ? 'bound' : `err:${r.error?.sqlstate ?? '?'}/${r.error?.reason ?? '-'}`;
  };
  const bindChain = async (ex: Qx, worker: string, anc: string[]) => {
    const out: string[] = [];
    for (let i = anc.length - 1; i >= 0; i--) out.push(await bindIfMissing(ex, i === 0 ? worker : anc[i - 1], anc[i]));
    return out;
  };
  rec('chain_setup', {
    W_SHORT: await bindChain(p, W_SHORT, ANC3),
    W_DEEP: await bindChain(p, W_DEEP, ANC12),
    W_EV3: await bindChain(p, W_EV3, ANC3C),
    W_F7B1: await bindChain(p, W_F7B1, ANC2),
    W_EXACT10: await bindChain(p, W_EXACT10, ANC10),
  });

  // 已提交夹具资金：只给两个**会真落账**的 job 冻结（其余探针在回滚事务里自筹）
  rec('fixture_mint', (await mintTo(p, EMP, cid, '1000000', KEY('mint', 'committed'))).ok);
  rec('fixture_hold_ctrl', (await holdFor(p, EMP, cid, GROSS_STD, JOB(1), KEY('hold', JOB(1)))).ok);
  rec('fixture_hold_replay', (await holdFor(p, EMP, cid, GROSS_STD, JOB(2), KEY('hold', JOB(2)))).ok);

  // 回滚事务内自筹（mint + hold），使破坏性探针**零残留**
  const selfFund = async (tx: Qx, gross: string, jobId: string) => {
    const m = await mintTo(tx, EMP, cid, '1000000', KEY('mint', `tx${jobId}`));
    const h = await holdFor(tx, EMP, cid, gross, jobId, KEY('hold', jobId));
    return { mint_ok: m.ok, hold_ok: h.ok, hold_err: h.error?.reason ?? null };
  };
  const settlePayload = (plan: SettlementPlan, input: SettleJobInput) => {
    const ev = buildSettleEvent(plan, input.memo);
    return {
      op: 'entries', idempotency_key: plan.idempotency_key,
      request_fingerprint: input.requestFingerprint ?? settleJobFingerprint(input),
      ref_type: 'job', ref_id: plan.job_id,
      memo: input.memo ?? `招工验收结算 job=${plan.job_id}`,
      entries: ev.entries.map((x) => toPayloadEntry(x)),
    } as Record<string, unknown>;
  };
  const dropEntries = (payload: Record<string, unknown>, keep: (e: Record<string, unknown>, i: number, n: number) => boolean) => {
    const es = payload.entries as Array<Record<string, unknown>>;
    return { ...payload, entries: es.filter((e, i) => keep(e, i, es.length)) };
  };

  // ================================================================ §A F1
  const planTry = async (input: SettleJobInput) => {
    try { return { ok: true as const, plan: await planJobSettlement(input) }; }
    catch (e) { return { ok: false as const, err: errInfo(e) }; }
  };
  const A = await inRollbackTx(p, async (tx) => {
    const out: Record<string, unknown> = { fund: await selfFund(tx, GROSS_STD, JOB(3)) };
    // 管理员旁路造 2-环：关掉守卫 + append-only，直插 X→Y、Y→X（= 质检/Neng 的复现手法）
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await tx.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$1,1)`, [POISON[0], POISON[1]]);
    await tx.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only`);
    await tx.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_cycle_guard`);
    const pol = await getCommissionPolicy(null, tx);
    const chain = await getReferralChain(POISON[0], pol.levels, tx);
    out.chain_depth = chain.chain_depth;
    out.chain_truncated = chain.truncated;
    out.assertions = chain.assertions;
    out.chain_nodes = chain.nodes.map((n) => `${n.level}:${n.beneficiary_uid}`);
    out.chain_contains_worker = chain.nodes.some((n) => n.beneficiary_uid === POISON[0]);
    out.chain_has_duplicates = new Set(chain.nodes.map((n) => n.beneficiary_uid)).size !== chain.nodes.length;
    // ① TS 闸：计划/服务两个入口都必须拒
    out.plan_result = await planTry({ jobId: JOB(3), employerUid: EMP, workerUid: POISON[0], cid, gross: GROSS_STD, ex: tx });
    try {
      const r = await settleJobCommission({ jobId: JOB(3), employerUid: EMP, workerUid: POISON[0], cid, gross: GROSS_STD, ex: tx });
      out.settle_result = { ok: true, replay: r.business.replay, plan_source: r.business.plan_source };
    } catch (e) { out.settle_result = { ok: false, err: errInfo(e) }; }
    out.ledger_rows_for_key = (await raw1<{ n: string }>(tx, `SELECT count(*)::text AS n FROM ledger_entry WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1`, [jobSettleKey(JOB(3))]))?.n;
    // ② 判负对照：绕过 TS 闸，按**同一份污染链**手工组装载荷（= 修前 planJobSettlement 会产出的形态）
    const M = Math.min(pol.levels, chain.chain_depth);
    const weights = pol.weights_bp.slice(0, M).map((w) => BigInt(w));
    const split = splitPool(BigInt(GROSS_STD) === 0n ? 0n : (BigInt(GROSS_STD) * BigInt(pol.fee_rate_bp) + 5000n) / 10000n, weights);
    const fee = (BigInt(GROSS_STD) * BigInt(pol.fee_rate_bp) + 5000n) / 10000n;
    const net = BigInt(GROSS_STD) - fee;
    const fakePlan: SettlementPlan = {
      job_id: JOB(3), idempotency_key: jobSettleKey(JOB(3)), employer_uid: EMP, worker_uid: POISON[0], cid,
      gross: GROSS_STD, fee: fee.toString(), net: net.toString(), pool: fee.toString(),
      policy: pol, chain_depth: chain.chain_depth, chain_truncated: chain.truncated,
      plan_source: 'computed', policy_reported: true, M, N: M, weights_bp: pol.weights_bp.slice(0, M).map(String),
      W: split.W, split, fee_credit_uid: COMMISSION_POOL_UID, zero_amount: false, no_referrer: false,
      layers: chain.nodes.slice(0, M).map((n, i) => ({ level: n.level, beneficiary_uid: n.beneficiary_uid,
        weight_bp: String(weights[i]), q: split.q[i], r: split.r[i], x: split.x[i] })),
    };
    const fakePayload = settlePayload(fakePlan, { jobId: JOB(3), employerUid: EMP, workerUid: POISON[0], cid, gross: GROSS_STD });
    const posted = await tryFn(tx, fakePayload);
    out.bypass_post = { ok: posted.ok, rows: posted.rows, err: posted.error?.reason ?? null };
    const firstRow = (fakePayload.entries as Array<Record<string, unknown>>)[0];
    out.bypass_entries = (fakePayload.entries as Array<Record<string, unknown>>).length;
    out.bypass_worker_credit = (fakePayload.entries as Array<Record<string, unknown>>)
      .filter((e) => String(e.uid) === POISON[0] && e.kind === 'commission').reduce((a, e) => a + BigInt(String(e.delta)), 0n).toString();
    out.bypass_self_paid_levels = (fakePayload.entries as Array<Record<string, unknown>>)
      .filter((e) => String(e.uid) === POISON[0] && e.kind === 'commission').length;
    out.bypass_first_entry_kind = firstRow?.kind ?? null;
    return out;
  });
  rec('A_f1_poisoned_chain', A.result);
  judge('A0 回滚事务内自筹成功（mint+hold）', (A.result?.fund as Record<string, unknown>)?.hold_ok === true, A.result?.fund);
  const Achain = A.result?.chain_nodes as string[] | undefined;
  judge('A1 污染链：节点重复（no_duplicate_uid=false）', (A.result?.assertions as Record<string, unknown>)?.no_duplicate_uid === false, A.result?.assertions);
  judge('A2 污染链：含打工人本人', A.result?.chain_contains_worker === true, Achain?.slice(0, 6));
  const Aplan = A.result?.plan_result as Record<string, unknown> | undefined;
  judge('A3 planJobSettlement 对坏链拒绝', Aplan?.ok === false, Aplan);
  const Aerr = Aplan?.err as Record<string, unknown> | undefined;
  judge('A4 拒绝码 = LEDGER_RECONCILE_MISMATCH', Aerr?.code === 'LEDGER_RECONCILE_MISMATCH', Aerr?.code);
  judge('A5 拒绝为 500 类（httpStatus=500）', Aerr?.httpStatus === 500, Aerr?.httpStatus);
  judge('A6 reason = COMMISSION_CHAIN_ASSERTION_VIOLATED', Aerr?.reason === COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED, Aerr?.reason);
  judge('A7 details 列出失败断言（含 no_duplicate_uid）',
    String((Aerr?.details as Record<string, unknown>)?.failed_assertions ?? '').includes('no_duplicate_uid'),
    (Aerr?.details as Record<string, unknown>)?.failed_assertions);
  const Asettle = A.result?.settle_result as Record<string, unknown> | undefined;
  judge('A8 settleJobCommission 亦拒绝（落账前）', Asettle?.ok === false, Asettle);
  judge('A9 坏链未落任何账', A.result?.ledger_rows_for_key === '0', A.result?.ledger_rows_for_key);
  judge('A10 判负对照：绕开 TS 闸 ⇒ DB Σ 触发器放行（ok=true）', (A.result?.bypass_post as Record<string, unknown>)?.ok === true, A.result?.bypass_post);
  judge('A11 判负对照：打工人本人被错付（多行佣金入己）',
    BigInt(String(A.result?.bypass_worker_credit ?? '0')) > 0n, A.result?.bypass_worker_credit);

  // 正向对照：健康链照常出计划并落账
  const ctrlInput: SettleJobInput = { jobId: JOB(1), employerUid: EMP, workerUid: W_SHORT, cid, gross: GROSS_STD };
  const ctrlPlan = await planJobSettlement(ctrlInput);
  rec('A_ctrl_plan', planRead(ctrlPlan));
  const ctrlOut = await settleJobCommission(ctrlInput);
  rec('A_ctrl_settle', { ok: ctrlOut.result.ok, replay: ctrlOut.business.replay, plan_source: ctrlOut.business.plan_source,
    entries: ctrlOut.business.expected_entry_count, commission_rows: ctrlOut.business.expected_commission_rows,
    fee: ctrlOut.plan.fee, chain_truncated: ctrlOut.plan.chain_truncated });
  judge('A12 正向对照：健康链出计划（断言全 true）', ctrlPlan.M === 1 && ctrlPlan.layers.length === 1, planRead(ctrlPlan));
  judge('A13 正向对照：健康链落账 ok 且 plan_source=computed', ctrlOut.result.ok === true && ctrlOut.business.plan_source === 'computed', reads.A_ctrl_settle);

  // ================================================================ §B F7①
  const capCases: Record<string, unknown> = {};
  for (const [name, uid, cap] of [['short_cap1_exact', W_SHORT, 1], ['ev3_cap3_exact', W_EV3, 3],
    ['ev3_cap2_truncated', W_EV3, 2], ['deep_cap10_truncated', W_DEEP, 10], ['deep_cap12_exact', W_DEEP, 12]] as Array<[string, string, number]>) {
    const c = await getReferralChain(uid, cap, p);
    capCases[name] = { cap, chain_depth: c.chain_depth, truncated: c.truncated, levels: c.nodes.map((n) => n.level) };
  }
  rec('B_chain_cap_cases', capCases);
  judge('B1 恰好 cap ⇒ truncated=false', (capCases.short_cap1_exact as Record<string, unknown>).truncated === false
    && (capCases.ev3_cap3_exact as Record<string, unknown>).truncated === false
    && (capCases.deep_cap12_exact as Record<string, unknown>).truncated === false, capCases);
  judge('B2 ≥ cap ⇒ truncated=true（同 chain_depth 下可分辨）',
    (capCases.ev3_cap2_truncated as Record<string, unknown>).truncated === true
    && (capCases.deep_cap10_truncated as Record<string, unknown>).truncated === true
    && (capCases.ev3_cap2_truncated as Record<string, unknown>).chain_depth === 2, capCases);
  const planExact = await planJobSettlement({ jobId: JOB(4), employerUid: EMP, workerUid: W_EXACT10, cid, gross: GROSS_STD });
  const planDeep = await planJobSettlement({ jobId: JOB(5), employerUid: EMP, workerUid: W_DEEP, cid, gross: GROSS_STD });
  rec('B_plan_level', { exact10: planRead(planExact), deep12: planRead(planDeep) });
  judge('B3 计划层：chain_depth 同为 10 但 chain_truncated 不同',
    planExact.chain_depth === 10 && planDeep.chain_depth === 10
    && planExact.chain_truncated === false && planDeep.chain_truncated === true, reads.B_plan_level);
  judge('B4 旧字段 chain_depth 语义未动（= 返回节点数）', planExact.chain_depth === planExact.layers.length, planRead(planExact));

  // ================================================================ §C F7②
  const pols = await raw<{ id: string; bp: string; lv: string; ef: string }>(p, `
    SELECT policy_id::text AS id, fee_rate_bp::text AS bp, levels::text AS lv, effective_from::text AS ef
      FROM commission_policy ORDER BY effective_from`);
  const oldPol = [...pols].sort((a, b) => Number(b.bp) - Number(a.bp) || (a.ef < b.ef ? -1 : 1))[0];
  const nowPol = pols[pols.length - 1];
  rec('C_policies', { all: pols, picked_old: oldPol, picked_now: nowPol });
  judge('C0 选到两版不同政策（否则本项空跑）', oldPol && nowPol && oldPol.bp !== nowPol.bp, { oldPol, nowPol });
  const replayInputOld: SettleJobInput = { jobId: JOB(2), employerUid: EMP, workerUid: W_F7B1, cid, gross: GROSS_STD, at: oldPol?.ef };
  const replayInputNow: SettleJobInput = { jobId: JOB(2), employerUid: EMP, workerUid: W_F7B1, cid, gross: GROSS_STD, at: nowPol?.ef };
  const first = await settleJobCommission(replayInputOld);
  const firstPlan = planRead(first.plan);
  const recomputedNow = await planJobSettlement(replayInputNow);
  const replayed = await settleJobCommission(replayInputNow);
  const ledgerFacts = await readEventFacts(jobSettleKey(JOB(2)), EMP, W_F7B1, p);
  const ledgerSettle = await readLedgerSettlement(jobSettleKey(JOB(2)), EMP, W_F7B1, p);
  const ledgerRows = await readLedgerEventRows(jobSettleKey(JOB(2)), p);
  rec('C_first_write', { plan: firstPlan, replay: first.business.replay, plan_source: first.business.plan_source,
    assertions: first.event.assertions, policy_fee_rate_bp: first.plan.policy.fee_rate_bp });
  rec('C_recompute_with_current_policy', { fee: recomputedNow.fee, layers: planRead(recomputedNow).layers, policy_fee_rate_bp: recomputedNow.policy.fee_rate_bp });
  rec('C_replay', { plan: planRead(replayed.plan), replay: replayed.business.replay, plan_source: replayed.business.plan_source,
    event_entries: replayed.business.expected_entry_count, event_assertions: replayed.event.assertions });
  rec('C_ledger_truth', { facts: { rows_total: ledgerFacts.rows_total, pool_in: ledgerFacts.pool_in, commission_rows: ledgerFacts.commission_rows, worker_got: ledgerFacts.worker_got },
    settlement: { fee: ledgerSettle.fee, net: ledgerSettle.net, gross: ledgerSettle.gross, layers: ledgerSettle.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}:${l.level_source}`) },
    rows: ledgerRows.length });
  judge('C1 首写：plan_source=computed', first.business.plan_source === 'computed' && first.business.replay === false, reads.C_first_write);
  judge('C2 重放：plan_source=replayed_from_ledger + replay=true',
    replayed.business.plan_source === 'replayed_from_ledger' && replayed.business.replay === true, reads.C_replay);
  judge('C3 重放：plan.fee == 账上 pool_in（不是重算值）',
    replayed.plan.fee === ledgerFacts.pool_in && replayed.plan.fee === ledgerSettle.fee, { plan_fee: replayed.plan.fee, ledger_pool_in: ledgerFacts.pool_in });
  judge('C4 重放：plan.net == 账上 worker_got', replayed.plan.net === ledgerFacts.worker_got, { net: replayed.plan.net, worker_got: ledgerFacts.worker_got });
  judge('C5 重放：layers 逐字段 == 账上 commission 行',
    JSON.stringify(replayed.plan.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`))
      === JSON.stringify(ledgerSettle.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`)),
    { plan_layers: planRead(replayed.plan).layers, ledger_layers: ledgerSettle.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`) });
  judge('C6 重放：policy 显式标不可信（policy_reported=false + 占位符）',
    replayed.plan.policy_reported === false && replayed.plan.policy.policy_id === 'ledger_replay', planRead(replayed.plan));
  judge('C7 重算（当前政策）与重放返回的金额不同 ⇒ 证明未用当前政策重算',
    recomputedNow.fee !== replayed.plan.fee, { recomputed_fee: recomputedNow.fee, returned_fee: replayed.plan.fee });
  judge('C8 重放：event 读数与账上一致（entry_count == 账上行数）',
    replayed.business.expected_entry_count === ledgerRows.length
    && replayed.event.assertions.sum_commission_credit === ledgerSettle.commission_credit_sum,
    { entries: replayed.business.expected_entry_count, ledger_rows: ledgerRows.length });
  const repost = await callFn(p, replayed.payload);
  rec('C_repost_same_payload', { ok: repost.ok, replay: repost.idempotent_replay });
  judge('C9 用返回的 payload 再发 ⇒ 仍是重放（不退化成 409）',
    repost.ok === true && repost.idempotent_replay === true, reads.C_repost_same_payload);

  // ================================================================ §D F3
  const D: Record<string, unknown> = {};
  const f3Setup = async (tx: Qx, jobId: string) => {
    const fund = await selfFund(tx, GROSS_STD, jobId);
    const plan = await planJobSettlement({ jobId, employerUid: EMP, workerUid: W_EXACT10, cid, gross: GROSS_STD, ex: tx });
    return { fund, plan, payload: settlePayload(plan, { jobId, employerUid: EMP, workerUid: W_EXACT10, cid, gross: GROSS_STD }) };
  };
  // ① IMMEDIATE 前置（= F3 的假报场景）
  const d1 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(3));
    await tx.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const r = await tryFn(tx, s.payload);
    return { entries: (s.payload.entries as unknown[]).length, commission_rows: s.plan.layers.length * 2, posted: r };
  });
  D.d1_immediate_before_post = { entries: d1.result?.entries, commission_rows: d1.result?.commission_rows,
    ok: d1.result?.posted.ok, rows: d1.result?.posted.rows, err: d1.result?.posted.error };
  // ③ 默认 DEFERRED：同一载荷必须照常成功
  const d2 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(4));
    const r = await tryFn(tx, s.payload);
    return { entries: (s.payload.entries as unknown[]).length, posted: r };
  });
  D.d2_deferred_default = { entries: d2.result?.entries, ok: d2.result?.posted.ok, err: d2.result?.posted.error };
  // ②a 真 Σ 不符：丢最后一对佣金（Σ-中性，事件级平衡闸不响）⇒ 必须 LD032
  const d3 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(5));
    await tx.query(`SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED`);
    const t = dropEntries(s.payload, (_e, i, n) => i < n - 2);
    const r = await tryFn(tx, t);
    return { entries: (t.entries as unknown[]).length, posted: r };
  });
  D.d3_tamper_drop_pair = { entries: d3.result?.entries, ok: d3.result?.posted.ok, err: d3.result?.posted.error };
  // ②b 只入不出：commission_rows=0 且 pool_in>0（Σ-中性；窄签名修法会**静默放过**的形态）⇒ 必须 LD032
  const d4 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(6));
    await tx.query(`SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED`);
    const t = dropEntries(s.payload, (_e, i) => i < 4);
    const r = await tryFn(tx, t);
    return { entries: (t.entries as unknown[]).length, posted: r };
  });
  D.d4_pool_in_no_out = { entries: d4.result?.entries, ok: d4.result?.posted.ok, err: d4.result?.posted.error };
  // ③ 先落账、后强制结算（p2qa-03 形态）：合法事件不得报，非法事件必须报
  const d5 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(7));
    const okPost = await tryFn(tx, s.payload);
    const afterImmediate = await trySql(tx, `SET CONSTRAINTS ALL IMMEDIATE`);
    const s2 = await f3Setup(tx, JOB(8));
    const bad = dropEntries(s2.payload, (_e, i) => i < 4);
    const badPost = await tryFn(tx, bad);
    const afterImmediate2 = await trySql(tx, `SET CONSTRAINTS ALL IMMEDIATE`);
    return { okPost_ok: okPost.ok, after_immediate: { ok: afterImmediate.ok, err: afterImmediate.error },
      badPost: { ok: badPost.ok, err: badPost.error }, after_immediate2: { ok: afterImmediate2.ok, err: afterImmediate2.error } };
  });
  D.d5_post_then_immediate = d5.result;
  // ④ 边界登记（**不判**，如实登记）：强制 IMMEDIATE 期间，Σ 断言不再判负（本修法的设计代价）
  const d6 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(9));
    await tx.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const t = dropEntries(s.payload, (_e, i) => i < 4);
    const r = await tryFn(tx, t);
    return { entries: (t.entries as unknown[]).length, ok: r.ok, err: r.error?.reason ?? null };
  });
  D.d6_boundary_immediate_tamper = d6.result;
  rec('D_f3', D);
  judge('D1 IMMEDIATE 前置：真事件不再假报（ok=true）', d1.result?.posted.ok === true,
    { ok: d1.result?.posted.ok, err: d1.result?.posted.error });
  judge('D2 该事件确为 24 条分录 / 20 条 commission（与 F3 复现同形）',
    d1.result?.entries === 24 && d1.result?.commission_rows === 20, { entries: d1.result?.entries, commission_rows: d1.result?.commission_rows });
  judge('D3 默认 DEFERRED：照常成功', d2.result?.posted.ok === true, d2.result?.posted.error);
  judge('D4 丢一对佣金（Σ-中性）⇒ 仍报 LD032 + COMMISSION_SPLIT_SUM_MISMATCH',
    d3.result?.posted.ok === false && d3.result?.posted.error?.sqlstate === 'LD032'
    && d3.result?.posted.error?.reason === COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH, d3.result?.posted.error);
  judge('D5 只入不出（commission_rows=0 且 pool_in>0）⇒ 仍报 LD032',
    d4.result?.posted.ok === false && d4.result?.posted.error?.sqlstate === 'LD032'
    && d4.result?.posted.error?.reason === COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH, d4.result?.posted.error);
  judge('D6 先落账后强制结算：合法事件不报', d5.result?.okPost_ok === true && d5.result?.after_immediate.ok === true, d5.result);
  judge('D7 先落账后强制结算：非法事件仍报 LD032',
    d5.result?.badPost.ok === false && d5.result?.after_immediate2.ok === false
    && String(d5.result?.after_immediate2.err?.sqlstate) === 'LD032', { badPost: d5.result?.badPost.error, after: d5.result?.after_immediate2 });

  // ================================================================ §E F6
  const E = await inRollbackTx(p, async (tx) => {
    const [child, parentB, parentC] = PROBE2;
    const firstBind = await trySql(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentB]);
    const rawRebind = await trySql(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentC]);
    const fnRebind = await trySql(tx, `SELECT referral_bind($1::bigint, $2::bigint)`, [child, parentC]);
    return { first_bind: { ok: firstBind.ok, err: firstBind.error },
      raw_rebind: { ok: rawRebind.ok, err: rawRebind.error },
      fn_rebind: { ok: fnRebind.ok, err: fnRebind.error } };
  });
  rec('E_f6_two_paths', E.result);
  const eRaw = E.result?.raw_rebind as Record<string, unknown> | undefined;
  const eFn = E.result?.fn_rebind as Record<string, unknown> | undefined;
  const eRawErr = eRaw?.err as PgErr | null | undefined;
  const eFnErr = eFn?.err as PgErr | null | undefined;
  judge('E1 裸 INSERT 重绑被拒为 LD003 + REFERRAL_ALREADY_BOUND',
    eRawErr?.sqlstate === 'LD003' && eRawErr?.reason === 'REFERRAL_ALREADY_BOUND', eRawErr);
  judge('E2 referral_bind 重绑被拒为 LD003 + REFERRAL_ALREADY_BOUND',
    eFnErr?.sqlstate === 'LD003' && eFnErr?.reason === 'REFERRAL_ALREADY_BOUND', eFnErr);
  judge('E3 两条路径**同码同 reason**', eRawErr?.sqlstate === eFnErr?.sqlstate && eRawErr?.reason === eFnErr?.reason,
    { raw: eRawErr, fn: eFnErr });
  // 判负对照：关掉守卫 ⇒ 退回修前形态（23505 / referral_pk）
  const Ectrl = await inRollbackTx(p, async (tx) => {
    const [child, parentB, parentC] = PROBE2;
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    await tx.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentB]);
    const r = await trySql(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentC]);
    return { ok: r.ok, err: r.error };
  });
  rec('E_f6_pre_fix_control', Ectrl.result);
  judge('E4 判负对照：无守卫时裸 INSERT 退回 23505/referral_pk（= 修前形态）',
    (Ectrl.result?.err as PgErr | undefined)?.sqlstate === '23505'
    && (Ectrl.result?.err as PgErr | undefined)?.constraint === 'referral_pk', Ectrl.result);

  // ================================================================ §F F2
  const F = await inRollbackTx(p, async (tx) => {
    const [stale, child, root] = PROBE2.slice(3, 6);
    const setup = await trySql(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [stale, root]);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await tx.query(`UPDATE referral SET depth = 50 WHERE child_uid = $1`, [stale]);
    await tx.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only`);
    const toStale = await trySql(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, stale]);
    const toRoot = await trySql(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, root]);
    const depthNow = await raw1<{ depth: string }>(tx, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [child]);
    return { setup: { ok: setup.ok, err: setup.error }, bind_to_stale: { ok: toStale.ok, err: toStale.error },
      bind_to_consistent: { ok: toRoot.ok, err: toRoot.error }, depth_after: depthNow?.depth ?? null };
  });
  rec('F_f2_stale_parent', F.result);
  const fErr = (F.result?.bind_to_stale as Record<string, unknown> | undefined)?.err as PgErr | null | undefined;
  judge('F1 绑到陈旧 depth 的父 ⇒ 拒（LD016 + REFERRAL_PARENT_DEPTH_INCONSISTENT）',
    fErr?.sqlstate === 'LD016' && fErr?.reason === 'REFERRAL_PARENT_DEPTH_INCONSISTENT', fErr);
  judge('F2 正向对照：父 depth 一致 ⇒ 放行且 depth 正确 = 1',
    (F.result?.bind_to_consistent as Record<string, unknown> | undefined)?.ok === true && F.result?.depth_after === '1', F.result);
  // 判负对照：关掉守卫 ⇒ 陈旧 depth 被继承（50 ⇒ 51）
  const Fctrl = await inRollbackTx(p, async (tx) => {
    const [stale, child, root] = PROBE2.slice(3, 6);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    await tx.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [stale, root]);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await tx.query(`UPDATE referral SET depth = 50 WHERE child_uid = $1`, [stale]);
    await tx.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, stale]);
    const d = await raw1<{ depth: string }>(tx, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [child]);
    return { inherited_depth: d?.depth ?? null };
  });
  rec('F_f2_pre_fix_control', Fctrl.result);
  judge('F3 判负对照：无守卫时陈旧 depth 被继承（50 ⇒ 51 = 修前形态）', Fctrl.result?.inherited_depth === '51', Fctrl.result);

  // ================================================================ §G 尾
  const cid1After = await platformSnapshot();
  rec('cid1_platform_accounts_after', cid1After);
  rec('trigger_enablement_after', await triggerEnablement(p));
  rec('graph_invariants_after', await readGraphInvariants(p));
  rec('residue', {
    committed_referral_956xxx: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM referral WHERE child_uid BETWEEN 956000 AND 956999 OR parent_uid BETWEEN 956000 AND 956999`))?.n,
    committed_ledger_rows_my_jobs: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE ref_type = 'job' AND split_part(idempotency_key, ':', 4) LIKE ANY (ARRAY['9%'])`))?.n,
    committed_ledger_rows_my_keys: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE 'ops:p1w:%'`))?.n,
    probe_currency_rows: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM currency WHERE symbol LIKE 'p1w%'`))?.n,
    poison_uids_in_graph: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM referral WHERE child_uid IN (956701,956702) OR parent_uid IN (956701,956702)`))?.n,
  });
  judge('G1 cid=1 平台账户（-1/-2/-3）未被触碰',
    JSON.stringify(cid1Before) === JSON.stringify(cid1After), { before: cid1Before, after: cid1After });
  const te = reads.trigger_enablement_after as { anomalies: unknown[] } | undefined;
  judge('G2 全部触发器启用（无异常）', Array.isArray(te?.anomalies) && te?.anomalies.length === 0, te?.anomalies);
  const gi = reads.graph_invariants_after as { cycles: string; bad_depth: string } | undefined;
  judge('G3 全局图不变式：cycles=0 且 bad_depth=0', gi?.cycles === '0' && gi?.bad_depth === '0', gi);
  judge('G4 残留：回滚探针的毒环未留下（952701/952702 无行）', reads.residue && (reads.residue as Record<string, unknown>).poison_uids_in_graph === '0', reads.residue);

  const out = { run: RUN, reds, reads };
  const file = save('p2w-00-verify', out);
  console.log(JSON.stringify({ file, reds_count: reds.length, reds,
    key_readings: { A: reads.A_f1_poisoned_chain ? {
      assertions: (reads.A_f1_poisoned_chain as Record<string, unknown>).assertions,
      plan_err: ((reads.A_f1_poisoned_chain as Record<string, unknown>).plan_result as Record<string, unknown>)?.err,
      bypass_post: (reads.A_f1_poisoned_chain as Record<string, unknown>).bypass_post,
      bypass_worker_credit: (reads.A_f1_poisoned_chain as Record<string, unknown>).bypass_worker_credit } : null,
      D: reads.D_f3, E: reads.E_f6_two_paths, F: reads.F_f2_stale_parent,
      C: { replay: reads.C_replay, recompute: reads.C_recompute_with_current_policy } } }, null, 1));
  await p.end();
  process.exit(ASSERT_MODE && reds.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
