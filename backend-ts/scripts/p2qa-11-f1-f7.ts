/**
 * p2qa-11 · 修复轮复检（Neng）：F1（链断言落账前拒结）+ F7①（chain_truncated）+ F7②（replay plan 由账导出）
 * ============================================================================
 * 夹具窗口（本轮全新，绝不复用旧 RUN）：uid 9585xx / symbol 前缀 p1x / 幂等键 ops:p1x:* / 业务键 biz:job:settle:<job>
 * 破坏性动作（DISABLE TRIGGER / 直插环）**全部在事务内且末尾 ROLLBACK**；F7② 需要真账读数 ⇒ 一次提交（本分区）。
 */
import {
  mkPool, raw, raw1, save, sha256, inRollbackTx, ensureUsers, ensureCurrency, mintTo, holdFor,
  trySql, tryFn, RUN, errInfo, type Qx, type Conn,
} from './p2qa-lib';
import {
  getCommissionPolicy, planJobSettlement, settleJobCommission, buildSettleEvent, getReferralChain,
  assertReferralChainInvariants, readEventFacts, readLedgerEventRows, jobSettleKey, splitPool,
  COMMISSION_POOL_UID, PLATFORM_REVENUE_UID, type SettleJobInput, type Queryable, type ReferralChain,
} from '../src/commission';
import { LedgerError, isLedgerError, httpStatusOf } from '../src/ledger-errors';

const OFF = BigInt('0x' + sha256('joboff-p2qa11-' + RUN).slice(0, 10)) % 1000000000n;
const JOB = (n: number): string => (958_300_000_000_000n + OFF + BigInt(n)).toString();

const tsErr = (e: unknown): Record<string, unknown> => {
  if (isLedgerError(e)) {
    const le = e as LedgerError;
    return { ts_code: le.code, http: le.httpStatus, status_field: le.status,
      details: le.details, httpStatusOf_code: httpStatusOf(le.code) };
  }
  return { ts_code: 'NON_LEDGER', err: errInfo(e) };
};

const ent = (uid: string, cid: string, kind: string, delta: string, frozen: string, refType: string,
  refId: string, memo: string): Record<string, unknown> =>
  ({ uid, cid, kind, delta, frozen_delta: frozen, memo, ref_type: refType, ref_id: refId });

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '10';
  const p = mkPool(10);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = { script: 'scripts/p2qa-11-f1-f7.ts', run: RUN };

  const platPre = await trySql<Record<string, string>>(p, `SELECT uid::text,cid::text,balance::text,frozen::text
    FROM account WHERE cid = 1 AND uid IN (-3,-2,-1,0) ORDER BY uid`);

  // ==========================================================================
  // F1 · 链断言落账前拒结
  // ==========================================================================
  const X = 958501, Y = 958502, EMP1 = 958503;
  const cid1sym = 'p1x1' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z');
  const f1: Record<string, unknown> = { uids: { X, Y, EMP: EMP1 } };

  const f1run = await inRollbackTx(p, async (c: Conn) => {
    const r: Record<string, unknown> = {};
    await ensureUsers(c as unknown as Qx, [X, Y, EMP1]);
    const cr = await c.query(`INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
      VALUES ($1,$2,$3,0,0,'listed',now()) RETURNING cid::text AS cid`, [cid1sym, `p2qa ${cid1sym}`, String(EMP1)]);
    const cid = String((cr.rows[0] as { cid: string }).cid);
    r.cid = cid;
    // 雇主备足（控制组要用真 ledger_post_event 证明「DB 本身会放行」）
    await mintTo(c as unknown as Qx, String(EMP1), cid, '50000', `ops:p1x:mint1-${RUN}`);
    await holdFor(c as unknown as Qx, String(EMP1), cid, '10000', JOB(1), `ops:p1x:hold1-${RUN}`);

    // ---- 事务内破坏：DISABLE 环守 + 直插 2-环（末尾整事务 ROLLBACK）
    await c.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    // 注：DISABLE trg_referral_cycle_guard 会**同时**关掉该 BEFORE INSERT 触发器里的 depth 计算
    //     ⇒ 直插必须自带**通过 CK `referral_depth_rng` 的 depth**（质检 as-found 同法）。
    await c.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$1,1)`,
      [String(X), String(Y)]);
    r.cycle_rows = (await c.query(`SELECT child_uid::text,parent_uid::text,depth::text FROM referral
      WHERE child_uid IN ($1,$2) ORDER BY child_uid`, [String(X), String(Y)])).rows;
    r.triggers_during = (await c.query(`SELECT tgname, tgenabled FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid
      WHERE cl.relname='referral' AND NOT t.tgisinternal ORDER BY tgname`)).rows;

    // 链读数（证明图真的坏了：重复节点 + 含打工人本人）
    const chain = await getReferralChain(X, 10, c as unknown as Queryable);
    r.chain_nodes = chain.nodes;
    r.chain_assertions = chain.assertions;
    r.chain_truncated = chain.truncated;
    r.duplicate_uids = chain.nodes.map((n) => n.beneficiary_uid).filter((u, i, a) => a.indexOf(u) !== i);
    r.worker_self_on_chain = chain.nodes.some((n) => n.beneficiary_uid === String(X));

    const before = (await c.query(`SELECT count(*)::text AS n FROM ledger_entry`)).rows[0] as { n: string };

    // ---- (a) 真结算入口调用（应落账前拒结）
    await c.query('SAVEPOINT sp_f1');
    let outcome: Record<string, unknown>;
    try {
      const res = await settleJobCommission({ jobId: JOB(1), employerUid: String(EMP1), workerUid: String(X),
        cid, gross: '10000', ex: c as unknown as Queryable, memo: `p2qa F1 ${RUN}` } as SettleJobInput);
      outcome = { threw: false, business: res.business, plan_fee: res.plan.fee, plan_source: res.plan.plan_source };
    } catch (e) {
      outcome = { threw: true, err: tsErr(e) };
    }
    r.settle_entry_call = outcome;
    await c.query('ROLLBACK TO SAVEPOINT sp_f1');

    const after = (await c.query(`SELECT count(*)::text AS n FROM ledger_entry`)).rows[0] as { n: string };
    const keyRows = (await c.query(`SELECT count(*)::text AS n FROM ledger_entry
      WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1`, [jobSettleKey(JOB(1))])).rows[0] as { n: string };
    const evRows = (await c.query(`SELECT count(*)::text AS n FROM ledger_entry WHERE ref_id = $1::bigint`, [JOB(1)])).rows[0] as { n: string };
    r.no_ledger_write = { ledger_entry_before: before.n, ledger_entry_after: after.n,
      rows_for_settle_key: keyRows.n, rows_for_job_ref_id_incl_hold: evRows.n,
      // 判据只用「全表行数不变」+「该结算事件键零行」；`ref_id = job` 会命中 hold 分录 ⇒ 不作为判据
      unchanged: before.n === after.n && keyRows.n === '0' };

    // ---- (b) 判负对照：证明「DB 自己会放行这份重复受益人的载荷」（= 应用层闸是承重的）
    const pol = await getCommissionPolicy(null, c as unknown as Queryable);
    const fee = 100n;                       // gross 10000 * 100bp
    const net = 9900n;
    const split = splitPool(fee, pol.weights_bp);
    const dupEntries: Array<Record<string, unknown>> = [
      ent(String(EMP1), cid, 'job_fee', '0', (-fee).toString(), 'job', JOB(2), 'ctrl fee'),
      ent(COMMISSION_POOL_UID, cid, 'job_fee', fee.toString(), '0', 'job', JOB(2), 'ctrl fee->pool'),
      ent(String(EMP1), cid, 'job_payout', '0', (-net).toString(), 'job', JOB(2), 'ctrl payout'),
      ent(String(X), cid, 'job_payout', net.toString(), '0', 'job', JOB(2), 'ctrl worker'),
    ];
    for (let i = 0; i < split.x.length; i++) {
      const u = chain.nodes[i]?.beneficiary_uid ?? String(Y);
      dupEntries.push(ent(COMMISSION_POOL_UID, cid, 'commission', (-split.x[i]).toString(), '0',
        'commission_payout', JOB(2), `ctrl 出池 L=${i + 1}`));
      dupEntries.push(ent(u, cid, 'commission', split.x[i].toString(), '0',
        'commission_payout', JOB(2), `ctrl 第 ${i + 1} 层`));
    }
    const ctrlPayload = { op: 'entries', idempotency_key: `ops:p1x:ctrl-dup-${RUN}`,
      request_fingerprint: sha256('ctrl-dup' + RUN), ref_type: 'job', ref_id: JOB(2),
      memo: 'F1 判负对照：重复受益人但 Σ x == P', entries: dupEntries };
    await c.query('SAVEPOINT sp_ctrl');
    const ctrl = await tryFn(c as unknown as Qx, ctrlPayload);
    await c.query('ROLLBACK TO SAVEPOINT sp_ctrl');
    r.db_control_duplicate_beneficiary_accepted = {
      posted_ok: ctrl.ok, error: ctrl.error ?? null,
      duplicate_beneficiary_uids: dupEntries.filter((e) => e.kind === 'commission'
        && BigInt(String(e.delta)) > 0n).map((e) => e.uid),
      note: 'Σ x == P（总量守恒）⇒ DB 侧 Σ 断言放行；重复 uid 占多层 ⇒ 归属错。这是 F1 的「静默错付」证据。',
    };

    // ---- (c) within_cap === false 不硬拒（纯函数判据；真链游走上不可能出现 false，故显式构造）
    const syntheticBad: ReferralChain = {
      nodes: [{ beneficiary_uid: '958501', level: 1 }], chain_depth: 1, truncated: false,
      assertions: { contiguous_levels: true, within_cap: false, all_user_uids: true, no_duplicate_uid: true } };
    const syntheticBad2: ReferralChain = {
      nodes: [{ beneficiary_uid: '958501', level: 1 }], chain_depth: 1, truncated: true,
      assertions: { contiguous_levels: true, within_cap: false, all_user_uids: true, no_duplicate_uid: false } };
    let withinCapThrew: Record<string, unknown>;
    let onlyWithinCapThrew = false;
    try { assertReferralChainInvariants(syntheticBad); withinCapThrew = { threw: false }; }
    catch (e) { onlyWithinCapThrew = true; withinCapThrew = { threw: true, err: tsErr(e) }; }
    let withinCapPlusDup: Record<string, unknown>;
    try { assertReferralChainInvariants(syntheticBad2); withinCapPlusDup = { threw: false }; }
    catch (e) { withinCapPlusDup = { threw: true, err: tsErr(e) }; }
    r.within_cap_not_hard_rejected = {
      only_within_cap_false: { threw: onlyWithinCapThrew, detail: withinCapThrew },
      within_cap_false_plus_duplicate: withinCapPlusDup,
      note: 'within_cap=false 单独 ⇒ 不抛（设计内）；within_cap=false + no_duplicate_uid=false ⇒ 抛（不放过真缺陷）',
    };
    r.within_cap_reachable_via_real_walk = false;   // CTE 硬闸 level<=cap ⇒ nodes.length<=cap 恒真
    return r;
  });
  f1.result = f1run.result;
  f1.tx_error = f1run.error ? errInfo(f1run.error) : null;
  f1.rolled_back = f1run.rolled_back;
  out.F1 = f1;

  // ==========================================================================
  // F7① · chain_truncated：12 级真链 + cap=10 与「恰好 10 级」对拍
  // ==========================================================================
  const W1 = 958511, ANC12 = Array.from({ length: 12 }, (_, i) => 958512 + i);  // 12 级祖先
  const W2 = 958524, ANC10 = Array.from({ length: 10 }, (_, i) => 958525 + i);  // 恰好 10 级祖先
  const cid3sym = 'p1x3' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z');
  const f7 = await inRollbackTx(p, async (c: Conn) => {
    const r: Record<string, unknown> = {};
    await ensureUsers(c as unknown as Qx, [W1, W2, ...ANC12, ...ANC10]);
    const cr = await c.query(`INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
      VALUES ($1,$2,$3,0,0,'listed',now()) RETURNING cid::text AS cid`, [cid3sym, `p2qa ${cid3sym}`, String(W1)]);
    const cid = String((cr.rows[0] as { cid: string }).cid);
    r.cid = cid;
    const binds: Array<Record<string, unknown>> = [];
    const bind = async (child: number, parent: number) => {
      const x = await trySql(c as unknown as Qx, 'SELECT referral_bind($1::bigint,$2::bigint) AS j',
        [String(child), String(parent)]);
      binds.push({ edge: `${child}->${parent}`, ok: x.ok, err: x.error ?? null });
    };
    // 12 级：W1→ANC12[0]→…→ANC12[11]  （先绑父再绑子）
    for (let i = ANC12.length - 1; i >= 0; i--) await bind(i === 0 ? W1 : ANC12[i - 1], ANC12[i]);
    // 恰好 10 级：W2→ANC10[0]→…→ANC10[9]
    for (let i = ANC10.length - 1; i >= 0; i--) await bind(i === 0 ? W2 : ANC10[i - 1], ANC10[i]);
    r.binds = binds;
    r.binds_failed = binds.filter((b) => b.ok !== true);

    const chainOf = async (u: number, cap: number) => {
      const ch = await getReferralChain(u, cap, c as unknown as Queryable);
      return { nodes_len: ch.nodes.length, chain_depth: ch.chain_depth, truncated: ch.truncated,
        last_node: ch.nodes[ch.nodes.length - 1]?.beneficiary_uid ?? null,
        assertions: ch.assertions,
        tail_uids: ch.nodes.slice(-3).map((n) => `${n.level}:${n.beneficiary_uid}`) };
    };
    r.w1_12deep_cap10 = await chainOf(W1, 10);     // 期望 truncated=true（被截断）
    r.w2_10deep_cap10 = await chainOf(W2, 10);     // 期望 truncated=false（恰好 cap）
    r.w1_12deep_cap12 = await chainOf(W1, 12);     // 期望 truncated=false（恰好整链）
    r.w2_10deep_cap11 = await chainOf(W2, 11);     // 期望 truncated=false（链短于 cap）
    r.w1_12deep_cap3 = await chainOf(W1, 3);       // 对照：cap 3 也必 truncated=true

    // plan 级：policy(now) levels=10 ⇒ 12 级链的 plan.chain_truncated=true；10 级链 =false
    const pol = await getCommissionPolicy(null, c as unknown as Queryable);
    r.policy_now = { policy_id: pol.policy_id, levels: pol.levels, fee_rate_bp: pol.fee_rate_bp };
    const pl1 = await planJobSettlement({ jobId: JOB(11), employerUid: String(W1), workerUid: String(W1),
      cid, gross: '10000000', ex: c as unknown as Queryable } as SettleJobInput);
    const pl2 = await planJobSettlement({ jobId: JOB(12), employerUid: String(W2), workerUid: String(W2),
      cid, gross: '10000000', ex: c as unknown as Queryable } as SettleJobInput);
    r.plan_w1_chain_truncated = pl1.chain_truncated;
    r.plan_w1_chain_depth = pl1.chain_depth;
    r.plan_w1_M = pl1.M;
    r.plan_w2_chain_truncated = pl2.chain_truncated;
    r.plan_w2_chain_depth = pl2.chain_depth;
    r.plan_w2_M = pl2.M;
    r.verdict = {
      truncated_true_when_12deep_cap10: r.w1_12deep_cap10 && (r.w1_12deep_cap10 as Record<string, unknown>).truncated === true,
      truncated_false_when_exactly_10deep: r.w2_10deep_cap10 && (r.w2_10deep_cap10 as Record<string, unknown>).truncated === false,
      chain_depth_identical_both_cases:
        (r.w1_12deep_cap10 as Record<string, unknown>).chain_depth === 10
        && (r.w2_10deep_cap10 as Record<string, unknown>).chain_depth === 10,
    };
    return r;
  });
  out.F7_truncation = { ...(f7.result ?? {}), tx_error: f7.error ? errInfo(f7.error) : null, rolled_back: f7.rolled_back };

  // ==========================================================================
  // F7② · replay 的 plan 由账上事件导出（真提交一次；本分区 9585xx / p1x2）
  // ==========================================================================
  // F7② 是唯一**提交**的用例（真账读数）⇒ 其 uid 必须**每 RUN 全新**（append-only 库 ⇒ 夹具不可复位）
  // `P2QA_ONLY=f1` ⇒ 跳过本节（复核 F1 时不再向账本落新事件）
  const SKIP_F7B = process.env.P2QA_ONLY === 'f1';
  if (!SKIP_F7B) {
  const F7B_BASE = 958000 + Number(BigInt('0x' + sha256('f7b' + RUN).slice(0, 6)) % 700n);
  const EMP2 = F7B_BASE, WRK = F7B_BASE + 1, A1 = F7B_BASE + 2, A2 = F7B_BASE + 3;
  const cid2sym = 'p1x2' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z');
  await ensureUsers(p, [EMP2, WRK, A1, A2]);
  const cid2 = await ensureCurrency(p, cid2sym, String(EMP2), 0);
  const mk2 = await mintTo(p, String(EMP2), cid2, '5000000', `ops:p1x:mint2-${RUN}`);
  const hd2 = await holdFor(p, String(EMP2), cid2, '2000000', JOB(20), `ops:p1x:hold2-${RUN}`);
  const bindsF7b: Array<Record<string, unknown>> = [];
  for (const [ch, pa] of [[A1, A2], [WRK, A1]]) {
    const r = await trySql(p, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(ch), String(pa)]);
    bindsF7b.push({ edge: `${ch}->${pa}`, ok: r.ok, err: r.error ?? null });
  }

  // 选一个「与 now 生效政策不同费率」且**在其生效窗口内**的备用时刻 T_alt
  const cand = await raw(p, `
    WITH p AS (SELECT policy_id, effective_from, fee_rate_bp, levels,
                      lead(effective_from) OVER (ORDER BY effective_from) AS nxt
                 FROM commission_policy)
    SELECT policy_id::text, fee_rate_bp::text, levels::text, effective_from::text,
           (effective_from + interval '1 second')::text AS t_alt
      FROM p WHERE (nxt IS NULL OR effective_from + interval '1 second' < nxt)
     ORDER BY effective_from DESC`);
  const nowPol = await getCommissionPolicy(null, q);
  const alt = (cand as Array<Record<string, string>>)
    .find((r) => r.fee_rate_bp !== String(nowPol.fee_rate_bp) && r.levels !== '0');
  const T_ALT = alt ? alt.t_alt : null;

  const f7b: Record<string, unknown> = { cid: cid2, uids: { EMP2, WRK, A1, A2 }, binds: bindsF7b,
    mint: { ok: mk2.ok, err: mk2.error ?? null }, hold: { ok: hd2.ok, err: hd2.error ?? null },
    policy_at_now: { policy_id: nowPol.policy_id, fee_rate_bp: nowPol.fee_rate_bp, levels: nowPol.levels },
    policy_alt_candidate: alt, T_ALT, gross: '1000000' };

  const callSettle = async (tag: string, at: string | null) => {
    const key = jobSettleKey(JOB(20));
    const t0 = Date.now();
    try {
      const res = await settleJobCommission({ jobId: JOB(20), employerUid: String(EMP2), workerUid: String(WRK),
        cid: cid2, gross: '1000000', at, ex: q, memo: `p2qa F7② ${tag}` } as SettleJobInput);
      const facts = await readEventFacts(key, String(EMP2), String(WRK), q);
      return {
        ok: true, tag, at, elapsed_ms: Date.now() - t0,
        replay: res.business.replay, plan_source: res.plan.plan_source,
        plan_policy_id: res.plan.policy.policy_id, plan_policy_reported: res.plan.policy_reported,
        plan_fee: res.plan.fee, plan_net: res.plan.net, plan_gross: res.plan.gross, plan_pool: res.plan.pool,
        plan_chain_depth: res.plan.chain_depth, plan_M: res.plan.M, plan_N: res.plan.N,
        plan_layers: res.plan.layers.map((l) => ({ level: l.level, uid: l.beneficiary_uid, x: l.x })),
        event_assertions: res.event.assertions, result: res.result,
        ledger_facts: { commission_rows: facts.commission_rows, pool_in: facts.pool_in,
          commission_out: facts.commission_out, worker_got: facts.worker_got,
          employer_frozen_out: facts.employer_frozen_out, ev_net_sum: facts.ev_net_sum,
          commission_uid_delta: facts.commission_uid_delta },
        plan_fee_eq_ledger_commission_out: res.plan.fee === facts.commission_out,
      };
    } catch (e) { return { ok: false, tag, at, elapsed_ms: Date.now() - t0, err: tsErr(e) }; }
  };

  f7b.call1_committed = await callSettle('first', T_ALT);
  // 真账复读（另一会话/另一连接）：账上金额
  const ledgerRows = await readLedgerEventRows(jobSettleKey(JOB(20)), q);
  f7b.ledger_rows_after_call1 = ledgerRows.map((r) => `${r.uid}:${r.kind}:${r.delta}`);
  const countAfter1 = (await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`))?.n;
  f7b.ledger_entry_total_after_call1 = countAfter1;

  f7b.call2_replay_under_now_policy = await callSettle('replay-diff-at', null);
  const countAfter2 = (await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`))?.n;
  f7b.ledger_entry_total_after_call2 = countAfter2;
  f7b.rows_not_doubled = countAfter1 === countAfter2;

  f7b.call3_replay_identical_at = await callSettle('replay-same-at', T_ALT);
  const c1 = f7b.call1_committed as Record<string, unknown>;
  const c2 = f7b.call2_replay_under_now_policy as Record<string, unknown>;
  const c3 = f7b.call3_replay_identical_at as Record<string, unknown>;
  f7b.verdict = {
    call2_is_replay: c2.replay === true,
    call2_plan_source_replayed: c2.plan_source === 'replayed_from_ledger',
    call2_policy_reported_false: c2.plan_policy_reported === false,
    call2_policy_id_placeholder: c2.plan_policy_id === 'ledger_replay',
    call2_fee_equals_ledger: c2.plan_fee === c1.plan_fee && c2.plan_fee_eq_ledger_commission_out === true,
    call2_fee_differs_from_now_policy_recompute: alt ? c2.plan_fee !== String(BigInt('1000000') * BigInt(nowPol.fee_rate_bp) / 10000n) : null,
    now_policy_recompute_fee: (BigInt('1000000') * BigInt(nowPol.fee_rate_bp) / 10000n).toString(),
    call1_plan_source_computed: c1.plan_source === 'computed',
    call3_replay_identical_ok: c3.ok === true && c3.plan_source === 'replayed_from_ledger',
    no_false_replay_inconsistent: c1.ok === true && c2.ok === true && c3.ok === true,
    call2_layers_match_ledger_credits: JSON.stringify(c2.plan_layers) !== '' &&
      (c2.plan_layers as Array<Record<string, string>>).map((l) => `${l.uid}:${l.x}`).join(',') ===
      ledgerRows.filter((r) => r.kind === 'commission' && BigInt(r.uid) > 0n).map((r) => `${r.uid}:${r.delta}`).join(','),
    rows_not_doubled: f7b.rows_not_doubled,
  };
  out.F7_replay = f7b;
  }  // end if (!SKIP_F7B)

  // ---------------------------------------------------------------- 收尾：平台只读 + 分区残留
  const platPost = await trySql<Record<string, string>>(p, `SELECT uid::text,cid::text,balance::text,frozen::text
    FROM account WHERE cid = 1 AND uid IN (-3,-2,-1,0) ORDER BY uid`);
  out.platform_cid1_unchanged = JSON.stringify(platPre.rows) === JSON.stringify(platPost.rows);
  out.residue = {
    referral_mine_958: (await raw(p, `SELECT child_uid::text,parent_uid::text,depth::text FROM referral
      WHERE child_uid BETWEEN 958000 AND 958999 OR parent_uid BETWEEN 958000 AND 958999 ORDER BY child_uid`)),
    users_mine_958: (await raw1(p, `SELECT count(*)::text AS n FROM users WHERE uid BETWEEN 958000 AND 958999`))?.n,
    cycles_global: (await raw1(p, `WITH RECURSIVE up AS (
        SELECT child_uid AS s, parent_uid AS cur, 1 AS d FROM referral
        UNION ALL SELECT u.s, r.parent_uid, u.d+1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
      SELECT count(*)::text AS n FROM up WHERE cur = s`))?.n,
    my_triggers: (await raw(p, `SELECT t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relname='referral' AND NOT t.tgisinternal ORDER BY t.tgname`)),
  };

  const f = save('p2qa-11-f1-f7', out);
  console.log(JSON.stringify({ saved: f,
    F1: { settle_call: (f1run.result as Record<string, unknown>)?.settle_entry_call,
      no_ledger_write: (f1run.result as Record<string, unknown>)?.no_ledger_write,
      db_control: (f1run.result as Record<string, unknown>)?.db_control_duplicate_beneficiary_accepted,
      chain_assertions: (f1run.result as Record<string, unknown>)?.chain_assertions,
      within_cap: (f1run.result as Record<string, unknown>)?.within_cap_not_hard_rejected },
    F7_trunc: f7.result?.verdict,
    F7_trunc_detail: { w1_cap10: f7.result?.w1_12deep_cap10, w2_cap10: f7.result?.w2_10deep_cap10,
      w1_cap12: f7.result?.w1_12deep_cap12, plan1: f7.result?.plan_w1_chain_truncated, plan2: f7.result?.plan_w2_chain_truncated },
    F7_replay_verdict: (out.F7_replay as Record<string, unknown> | undefined)?.verdict ?? 'SKIPPED(P2QA_ONLY=f1)',
    call2: out.F7_replay ? {
      fee: ((out.F7_replay as Record<string, unknown>).call2_replay_under_now_policy as Record<string, unknown>).plan_fee,
      source: ((out.F7_replay as Record<string, unknown>).call2_replay_under_now_policy as Record<string, unknown>).plan_source,
      layers: ((out.F7_replay as Record<string, unknown>).call2_replay_under_now_policy as Record<string, unknown>).plan_layers,
      err: ((out.F7_replay as Record<string, unknown>).call2_replay_under_now_policy as Record<string, unknown>).err ?? null,
    } : null,
    call1: out.F7_replay ? {
      fee: ((out.F7_replay as Record<string, unknown>).call1_committed as Record<string, unknown>).plan_fee,
      source: ((out.F7_replay as Record<string, unknown>).call1_committed as Record<string, unknown>).plan_source,
    } : null,
    platform_cid1_unchanged: out.platform_cid1_unchanged,
    residue_referral_958: (out.residue as Record<string, unknown>).referral_mine_958,
    cycles_global: (out.residue as Record<string, unknown>).cycles_global,
  }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', errInfo(e)); process.exit(1); });
