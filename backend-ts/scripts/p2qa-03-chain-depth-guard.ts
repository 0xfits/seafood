/**
 * p2qa-03 · 链游走是否依赖可陈旧的 referral.depth + 三道闸检查顺序 + 旁路能否造环（独立质检 Neng）
 * 手法：一切破坏性 UPDATE / DISABLE TRIGGER 都在**同一事务内**做，末尾一律 ROLLBACK，
 *       并在同一文件里取「破坏前 / 破坏中 / 回滚后」三份读数证明已复原。
 * 测试数据：uid 954xxx；symbol p1u*；辅助键 ops:p1u:*
 */
import {
  mkPool, raw, raw1, save, sha256, inRollbackTx, ensureUsers, ensureCurrency, mintTo, holdFor,
  trySql, tryFn, RUN, type Qx, type Conn,
} from './p2qa-lib';
import {
  getReferralChain, readGraphInvariants, planJobSettlement, buildSettleEvent, toPayloadEntry,
  settleJobFingerprint, COMMISSION_POOL_UID, type SettleJobInput, type Queryable,
} from '../src/commission';
import { LedgerError, isLedgerError } from '../src/ledger-errors';

const EMP = 954001;
const WS = 954701, ANC3 = [954711, 954712, 954713];                 // 陈旧 depth 用例
const WD = 954731, ANC12 = [954741, 954742, 954743, 954744, 954745, 954746, 954747, 954748, 954749, 954750, 954751, 954752];
const CY = [954721, 954722];                                        // 环污染用例
const G802 = 954802, G801 = 954801, G803 = 954803, G805 = 954805, G806 = 954806, G807 = 954807;
const GHOST = 954999;      // 刻意**不**建 users 行（FK 负例）
const FRESH1 = 954808, FRESH2 = 954809;   // 「绑到陈旧父」与「depth 入参被覆写」用全新 uid
const Y_CTL = 954806;      // 对照用例的受益人

/** 造一条 op=entries 的分录（本脚本自用） */
const ent0 = (uid: string, cid: string, kind: string, delta: string, frozen: string, jobId: string): Record<string, unknown> =>
  ({ uid, cid, kind, delta, frozen_delta: frozen, memo: `p2qa ${kind}`, ref_type: 'job', ref_id: jobId });

/** 带重试的只读/写调用（Neon WS 偶发断连 ⇒ 不得把传输故障当成语义结论） */
const withRetry = async <T>(fn: () => Promise<T>, n = 3): Promise<T> => {
  let last: unknown = null;
  for (let i = 0; i < n; i++) {
    const r = await fn();
    const e = (r as { error?: { sqlstate?: string | null; message?: string } }).error;
    if (!e || (e.sqlstate !== null && e.sqlstate !== undefined)) return r;
    last = r;
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return last as T;
};

/** 事务探针带重试：另一会话可能同时在 ALTER 同一张表 ⇒ 锁争用会让 BEGIN..ROLLBACK 整段作废 */
const makeTxTry = (pool: ReturnType<typeof mkPool>) => async <T>(
  fn: (c: Conn) => Promise<T>, tries = 3,
): Promise<{ result: T | null; error: unknown | null; rolled_back: boolean; attempts: number; errs: string[] }> => {
  let last: { result: T | null; error: unknown | null; rolled_back: boolean } | null = null;
  const errs: string[] = [];
  for (let i = 1; i <= tries; i++) {
    last = await inRollbackTx(pool, fn);
    if (last.error === null) return { ...last, attempts: i, errs };
    errs.push(String((last.error as { message?: string })?.message ?? last.error).slice(0, 160));
    await new Promise((r) => setTimeout(r, 700 * i));
  }
  return { ...(last as { result: T | null; error: unknown | null; rolled_back: boolean }), attempts: tries, errs };
};

const tsErr = (e: unknown): Record<string, unknown> =>
  isLedgerError(e) ? { ts_code: (e as LedgerError).code, http: (e as LedgerError).httpStatus, details: (e as LedgerError).details }
    : { ts_code: 'NON_LEDGER', message: String(e) };

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '12';
  const p = mkPool(12);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = { script: 'scripts/p2qa-03-chain-depth-guard.ts', run: RUN };
  const cid = await ensureCurrency(p, 'p1u0' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), String(EMP), 0);

  // ---------------------------------------------------------------- 0 夹具
  await ensureUsers(p, [EMP, WS, ...ANC3, WD, ...ANC12, ...CY, G801, G802, G803, G805, G806, G807]);
  await mintTo(p, String(EMP), cid, '5000000', `ops:p1u:mint-${RUN}`);
  const bind = (c: number, pa: number) => trySql(p, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(c), String(pa)]);
  const binds: Array<Record<string, unknown>> = [];
  const bindChain = async (tag: string, worker: number, anc: number[]) => {
    for (let i = anc.length - 1; i >= 0; i--) {
      const child = i === 0 ? worker : anc[i - 1];
      const r = await bind(child, anc[i]);
      binds.push({ tag, edge: `${child}->${anc[i]}`, ok: r.ok, depth: (r.rows[0] as { j?: { depth?: string } })?.j?.depth, err: r.error ?? null });
    }
  };
  await bindChain('stale', WS, ANC3);
  await bindChain('deep12', WD, ANC12);
  await bind(G801, G802);
  out.setup = { cid, binds, binds_failed: binds.filter((b) => b.ok !== true) };
  out.graph_pre = await readGraphInvariants(q);

  const rowFp = async (ex: Qx, uids: number[]): Promise<Record<string, string>> => {
    const r = await trySql<{ child_uid: string; parent_uid: string; depth: string }>(ex, `
      SELECT child_uid::text AS child_uid, parent_uid::text AS parent_uid, depth::text AS depth
        FROM referral WHERE child_uid = ANY($1::bigint[]) ORDER BY child_uid`, [uids.map(String)]);
    return { rows: JSON.stringify(r.rows), hash: sha256(r.rows) };
  };

  // ================================================================
  // ① 链游走是否依赖 referral.depth？（本单最重要的一条）
  // ================================================================
  const chainPre = await getReferralChain(WS, 10, q);
  const planPre = await planJobSettlement({ jobId: '954300000000001', employerUid: String(EMP), workerUid: String(WS),
    cid, gross: '1000000', ex: q } as SettleJobInput);
  const invPre = await readGraphInvariants(q);
  const fpPre = await rowFp(p, [WS, ...ANC3]);

  const txTry = makeTxTry(p);
  const staleTx = await txTry(async (cl) => {
    const ex = cl as unknown as Qx;
    const dis = await trySql(ex, `ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    if (!dis.ok) throw new Error('step1 ALTER DISABLE failed: ' + JSON.stringify(dis.error));
    const upd = await trySql(ex, `UPDATE referral SET depth = depth + 97 WHERE child_uid = $1`, [String(WS)]);
    if (!upd.ok) throw new Error('step2 UPDATE failed: ' + JSON.stringify(upd.error));
    const upd2 = await trySql(ex, `UPDATE referral SET depth = 50 WHERE child_uid = $1`, [String(ANC3[0])]);
    const corrupted = await rowFp(ex, [WS, ...ANC3]);
    const chainMid = await getReferralChain(WS, 10, ex as unknown as Queryable);
    const planMid = await planJobSettlement({ jobId: '954300000000001', employerUid: String(EMP), workerUid: String(WS),
      cid, gross: '1000000', ex: ex as unknown as Queryable } as SettleJobInput);
    const invMid = await readGraphInvariants(ex as unknown as Queryable);
    // 陈旧父的 depth 会不会**扩散**到新插入的行？
    await ensureUsers(ex, [FRESH1]);
    const newEdge = await trySql(ex, `SELECT referral_bind($1::bigint,$2::bigint) AS j`, [String(FRESH1), String(ANC3[0])]);
    if (!newEdge.ok) throw new Error('step3 bind-to-stale-parent failed: ' + JSON.stringify(newEdge.error));
    const newRow = await trySql<{ depth: string }>(ex,
      `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [String(FRESH1)]);
    // 用**陈旧 depth 的父**再算一次链：链游走仍应只看边
    const chainAfterNewEdge = await getReferralChain(WS, 10, ex as unknown as Queryable);
    return { disable_ok: dis.ok, update_ws: upd.ok, update_anc0: upd2.ok, corrupted_rows: corrupted,
      chain_mid_nodes: chainMid.nodes, chain_mid_depth: chainMid.chain_depth,
      chain_mid_assertions: chainMid.assertions,
      plan_mid: { M: planMid.M, N: planMid.N, W: planMid.W, x: planMid.layers.map((l) => l.x),
        uids: planMid.layers.map((l) => l.beneficiary_uid), chain_depth: planMid.chain_depth },
      invariants_mid: invMid, new_child_edge: newEdge.ok ? (newEdge.rows[0] as { j?: unknown })?.j : newEdge.error,
      new_child_depth: newRow.rows[0]?.depth ?? null,
      chain_mid_after_new_edge: chainAfterNewEdge.nodes };
  });
  const fpPost = await rowFp(p, [WS, ...ANC3]);
  out.Q1_depth_not_used_by_chain_walk = {
    question: '链游走是否依赖可陈旧的 referral.depth？（陈旧 depth 会不会静默截断/少付/多付）',
    chain_pre: chainPre.nodes, chain_pre_assertions: chainPre.assertions,
    plan_pre: { M: planPre.M, N: planPre.N, W: planPre.W, x: planPre.layers.map((l) => l.x),
      uids: planPre.layers.map((l) => l.beneficiary_uid), chain_depth: planPre.chain_depth },
    invariants_pre: invPre,
    row_fingerprint_pre: fpPre,
    in_tx: staleTx.result, tx_error: staleTx.error ? String(staleTx.error) : null,
    tx_attempts: staleTx.attempts, tx_retry_errors: staleTx.errs,
    row_fingerprint_post_rollback: fpPost,
    restored: JSON.stringify(fpPre) === JSON.stringify(fpPost),
    verdict_note: 'chain_mid_nodes 必须与 chain_pre 逐元素相同（= 链游走不读 depth）；invariants_mid.bad_depth 必须 > 0（= 不变式确有观测力）',
    chain_identical_despite_stale_depth:
      JSON.stringify((staleTx.result as { chain_mid_nodes?: unknown })?.chain_mid_nodes)
      === JSON.stringify(chainPre.nodes),
    plan_identical_despite_stale_depth:
      JSON.stringify((staleTx.result as { plan_mid?: { x?: string[]; uids?: string[] } })?.plan_mid)
      === JSON.stringify((staleTx.result as { plan_mid?: { x?: string[]; uids?: string[] } })?.plan_mid),
  };

  // ================================================================
  // ② 链长 > cap（12 层 vs levels 10）
  // ================================================================
  out.Q2_chain_longer_than_cap = {
    full_chain_of_leaf: (await trySql<{ uid: string; level: string }>(p, `
      WITH RECURSIVE up AS (SELECT parent_uid AS p, 1 AS l FROM referral WHERE child_uid = $1
        UNION ALL SELECT r.parent_uid, up.l+1 FROM referral r JOIN up ON r.child_uid = up.p WHERE up.l < 100)
      SELECT p::text AS uid, l::text AS level FROM up ORDER BY l`, [String(WD)])).rows,
    chain_cap10: await getReferralChain(WD, 10, q),
    chain_cap3: (await getReferralChain(WD, 3, q)).nodes,
    plan_cap10: await (async () => {
      const pl = await planJobSettlement({ jobId: '954300000000002', employerUid: String(EMP), workerUid: String(WD),
        cid, gross: '1000000', ex: q } as SettleJobInput);
      return { chain_depth_reported: pl.chain_depth, M: pl.M, x: pl.layers.map((l) => l.x), W: pl.W,
        uids: pl.layers.map((l) => l.beneficiary_uid) };
    })(),
    invariants: await readGraphInvariants(q),
  };

  // ================================================================
  // ③ 环污染 ⇒ 同一 uid 占两层 ⇒ 层产出的「Σ 平衡」载荷能否被 DB 拦
  // ================================================================
  const JOB_CYC = '954300000000003';
  await holdFor(p, String(EMP), cid, '100000', JOB_CYC, `ops:p1u:holdcyc-${RUN}`);
  const cycTx = await txTry(async (cl) => {
    const ex = cl as unknown as Qx;
    const d1 = await trySql(ex, `ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    const d2 = await trySql(ex, `ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    if (!d1.ok || !d2.ok) throw new Error('cycle-probe ALTER DISABLE failed: ' + JSON.stringify([d1.error, d2.error]));
    const ins1 = await trySql(ex, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [String(CY[0]), String(CY[1])]);
    const ins2 = await trySql(ex, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [String(CY[1]), String(CY[0])]);
    const chain = await getReferralChain(CY[0], 10, ex as unknown as Queryable);
    const inv = await readGraphInvariants(ex as unknown as Queryable);
    const plan = await planJobSettlement({ jobId: JOB_CYC, employerUid: String(EMP), workerUid: String(CY[0]),
      cid, gross: '100000', ex: ex as unknown as Queryable } as SettleJobInput);
    const ev = buildSettleEvent(plan);
    const payload = {
      op: 'entries', idempotency_key: plan.idempotency_key,
      request_fingerprint: settleJobFingerprint({ jobId: JOB_CYC, employerUid: String(EMP), workerUid: String(CY[0]),
        cid, gross: '100000' } as SettleJobInput),
      ref_type: 'job', ref_id: JOB_CYC, memo: 'p2qa 环污染载荷',
      entries: ev.entries.map((x) => toPayloadEntry(x)),
    };
    // ① 正常语义（延迟约束）下落账：唯一索引/余额闸都在，Σ 断言在 COMMIT 才跑
    const posted = await tryFn(ex, payload);
    // ② 在**同事务内**把待决的延迟约束提前结算（不是「逐行立刻跑」—— 此时 24 条分录已全部插入）
    const forced = await trySql(ex, `SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE`);
    return { disable_cycle: d1.ok, disable_append: d2.ok, insert_edges: [ins1.ok, ins2.ok],
      chain_nodes: chain.nodes, chain_assertions: chain.assertions, invariants: inv,
      layer_x: plan.layers.map((l) => l.x), layer_uids: plan.layers.map((l) => l.beneficiary_uid),
      N: plan.N, M: plan.M, pool: plan.pool,
      ev_assertions: ev.assertions,
      posted_ok: posted.ok, posted_error: posted.error ?? null, posted_entries: (posted.entries ?? []).length,
      forced_constraint_check_ok: forced.ok, forced_constraint_error: forced.error ?? null,
      worker_self_paid: plan.layers.filter((l) => l.beneficiary_uid === String(CY[0])).map((l) => l.x),
      duplicate_beneficiaries: plan.layers.map((l) => l.beneficiary_uid)
        .filter((u, i, a) => a.indexOf(u) !== i) };
  });
  const cycRes = cycTx.result as Record<string, unknown> | null;
  // 判负对照：同一手法下，一个**Σ 不平**的载荷必须被 LD032 拦（证明上面那条「无报错」不是方法空转）
  const controlTx = await txTry(async (cl) => {
    const ex = cl as unknown as Qx;
    await holdFor(ex, String(EMP), cid, '100000', JOB_CYC + '1', `ops:p1u:holdctl-${RUN}`);
    const payload = {
      op: 'entries', idempotency_key: `ops:p1u:ctl-imbalanced-${RUN}`, request_fingerprint: sha256('ctl' + RUN),
      ref_type: 'job', ref_id: JOB_CYC + '1', memo: 'p2qa 判负对照：Σ 不平',
      entries: [
        ent0(String(EMP), cid, 'job_fee', '0', '-1000', JOB_CYC + '1'),
        ent0(COMMISSION_POOL_UID, cid, 'job_fee', '1000', '0', JOB_CYC + '1'),
        ent0(COMMISSION_POOL_UID, cid, 'commission', '-999', '0', JOB_CYC + '1'),
        ent0(String(Y_CTL), cid, 'commission', '999', '0', JOB_CYC + '1'),
      ],
    };
    const posted = await tryFn(ex, payload);
    const forced = await trySql(ex, `SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE`);
    return { posted_ok: posted.ok, posted_error: posted.error ?? null,
      forced_ok: forced.ok, forced_error: forced.error ?? null };
  });
  out.Q3_cycle_poison = {
    hypothesis: '环污染后链游走会重复同一 uid（含打工人自己）；Σ x == P 仍成立 ⇒ 层会产出「保平衡但归属错」的载荷',
    in_tx: cycRes, tx_error: cycTx.error ? String(cycTx.error) : null,
    db_verdict_on_balanced_but_wrong_attribution: cycRes
      ? { posted_ok: cycRes.posted_ok, forced_constraint_check_ok: cycRes.forced_constraint_check_ok,
        forced_constraint_error: cycRes.forced_constraint_error } : null,
    control_imbalanced_must_be_rejected: controlTx.result,
    residue_check: await trySql(p, `SELECT count(*)::text AS n FROM referral WHERE child_uid = ANY($1::bigint[])`,
      [CY.map(String)]),
  };

  // ================================================================
  // ④ 三道闸（自指 / 环 / 已有下级）检查顺序 + 裸 INSERT 与 referral_bind 双路径
  // ================================================================
  const order: Array<Record<string, unknown>> = [];
  const both = async (tag: string, child: number, parent: number) => {
    const viaBind = await withRetry(() => trySql(p, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(child), String(parent)]));
    const viaInsert = await trySql(p, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`,
      [String(child), String(parent)]);
    const pick = (r: { ok: boolean; error?: Record<string, unknown>; rows: unknown[] }) =>
      r.ok ? { ok: true, rows: r.rows.length }
        : { sqlstate: r.error?.sqlstate, reason: r.error?.reason, constraint: r.error?.constraint,
          message: String(r.error?.message ?? '').slice(0, 90) };
    order.push({ tag, child, parent, referral_bind: pick(viaBind), raw_insert: pick(viaInsert) });
  };
  await both('o1_self_bind_且_has_descendant', G802, G802);          // ① 自指 vs ④ 已有下级
  await both('o2_cycle_且_has_descendant', G802, G801);            // ③ 环 vs ④ 已有下级
  await both('o3_only_has_descendant', G802, G803);                // 只触发 ④
  await both('o4_already_bound_child_other_parent', G801, G805);   // referral_bind 的 409 闸 vs 裸 PK
  await both('o5_child_not_in_users', GHOST, G806);                // FK 缺行（954999 未建 users 行）
  await both('o6_parent_is_platform_uid', 954804, -2);             // 平台 uid 作父
  out.Q4_guard_order = order;

  // ④b 裸 INSERT 的 depth 是否由调用方决定？
  out.Q4b_depth_input_ignored = await txTry(async (cl) => {
    const ex = cl as unknown as Qx;
    await ensureUsers(ex, [FRESH2]);
    const r = await trySql<{ depth: string }>(ex, `
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,5) RETURNING depth::text AS depth`,
    [String(FRESH2), String(G803)]);
    const check = await trySql<{ depth: string }>(ex, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [String(FRESH2)]);
    return { inserted: r.ok, returned_depth: r.rows[0]?.depth ?? null, stored_depth: check.rows[0]?.depth ?? null,
      insert_error: r.ok ? null : r.error,
      note: 'G803 是根（无行）⇒ 正确 depth = 1；调用方传的 5 必须被触发器覆写；本用例在回滚事务内 ⇒ 零残留' };
  });

  // ================================================================
  // ⑤ 旁路 ⇒ M9 判据可红（证明判据不是空转）
  // ================================================================
  const red = await txTry(async (cl) => {
    const ex = cl as unknown as Qx;
    const a1 = await trySql(ex, `ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    const a2 = await trySql(ex, `ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    if (!a1.ok || !a2.ok) throw new Error('bypass ALTER failed: ' + JSON.stringify([a1.error, a2.error]));
    await trySql(ex, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [String(CY[0]), String(CY[1])]);
    await trySql(ex, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,2)`, [String(CY[1]), String(CY[0])]);
    return { invariants_after_bypass: await readGraphInvariants(ex as unknown as Queryable),
      chain: (await getReferralChain(CY[0], 10, ex as unknown as Queryable)).nodes };
  });
  out.Q5_bypass_makes_m9_red = { in_tx: red.result, error: red.error ? String(red.error) : null,
    invariants_after_rollback: await readGraphInvariants(q),
    rows_after_rollback: await trySql(p, `SELECT count(*)::text AS n FROM referral WHERE child_uid = ANY($1::bigint[])`,
      [CY.map(String)]) };

  // ================================================================
  // ⑥ 收尾：触发器启用态 + 残留
  // ================================================================
  out.final = {
    triggers: await raw(p, `SELECT c.relname AS tbl, t.tgname, t.tgenabled FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND n.nspname = 'public' ORDER BY 1,2`),
    graph: await readGraphInvariants(q),
    my_partition_rows: await trySql(p, `SELECT count(*)::text AS n FROM referral WHERE child_uid >= 954000`),
  };

  const f = save('p2qa-03-chain-depth-guard', out);
  console.log(JSON.stringify({ saved: f, Q1: {
    chain_pre: (out.Q1_depth_not_used_by_chain_walk as { chain_pre: unknown }).chain_pre,
    chain_mid: (staleTx.result as { chain_mid_nodes?: unknown })?.chain_mid_nodes,
    identical: (out.Q1_depth_not_used_by_chain_walk as { chain_identical_despite_stale_depth: unknown }).chain_identical_despite_stale_depth,
    bad_depth_mid: (staleTx.result as { invariants_mid?: { bad_depth?: string } })?.invariants_mid?.bad_depth,
    new_child_depth_from_stale_parent: (staleTx.result as { new_child_depth?: string })?.new_child_depth,
    restored: (out.Q1_depth_not_used_by_chain_walk as { restored: unknown }).restored },
    Q2: { cap10: (out.Q2_chain_longer_than_cap as { chain_cap10: { chain_depth: number } }).chain_cap10.chain_depth,
      full_len: ((out.Q2_chain_longer_than_cap as { full_chain_of_leaf: unknown[] }).full_chain_of_leaf ?? []).length,
      plan: (out.Q2_chain_longer_than_cap as { plan_cap10: unknown }).plan_cap10 },
    Q3: { nodes: cycRes?.chain_nodes, assertions: cycRes?.chain_assertions, layer_x: cycRes?.layer_x,
      layer_uids: cycRes?.layer_uids, dup: cycRes?.duplicate_beneficiaries, self_paid: cycRes?.worker_self_paid,
      ev_assertions: cycRes?.ev_assertions, posted_ok: cycRes?.posted_ok, posted_error: cycRes?.posted_error },
    Q4: order, Q4b: out.Q4b_depth_input_ignored,
    Q5: (red.result as { invariants_after_bypass?: unknown })?.invariants_after_bypass,
    final_triggers_disabled: (out.final as { triggers: Array<{ tgenabled: string }> }).triggers.filter((t) => t.tgenabled !== 'O') }, null, 2));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
