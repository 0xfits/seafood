/**
 * p2qa-12 · 修复轮复检（Neng）：F3（IMMEDIATE 不假报 / 真 Σ 不符仍报 LD032）+ F6（两路同码）+ F2（父 depth 守卫）
 * ============================================================================
 * 全部在**事务内**执行、末尾 ROLLBACK（零残留）。夹具窗口本轮全新：uid 9586xx / symbol p1x4* / 键 ops:p1x:*
 * 每个会失败的 SQL 都包在 SAVEPOINT 里（否则一次报错整事务 aborted ⇒ 后续全是假读数）。
 */
import {
  mkPool, raw, raw1, save, sha256, inRollbackTx, ensureUsers, mintTo, holdFor, trySql, tryFn,
  RUN, errInfo, type Qx, type Conn,
} from './p2qa-lib';
import {
  planJobSettlement, buildSettleEvent, getCommissionPolicy, toPayloadEntry,
  COMMISSION_POOL_UID, type SettleJobInput, type Queryable,
} from '../src/commission';

const OFF = BigInt('0x' + sha256('joboff-p2qa12-' + RUN).slice(0, 10)) % 1000000000n;
const JOB = (n: number): string => (958_400_000_000_000n + OFF + BigInt(n)).toString();
const CONS = 'trg_ledger_entry_commission_conservation';

const ent = (uid: string, cid: string, kind: string, delta: string, frozen: string, refType: string,
  refId: string, memo: string): Record<string, unknown> =>
  ({ uid, cid, kind, delta, frozen_delta: frozen, memo, ref_type: refType, ref_id: refId });

const mkPayload = (key: string, job: string, entries: Array<Record<string, unknown>>) => ({
  op: 'entries', idempotency_key: key, request_fingerprint: sha256(key + RUN), ref_type: 'job',
  ref_id: job, memo: `p2qa12 ${key}`, entries,
});

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '10';
  const p = mkPool(10);
  const out: Record<string, unknown> = { script: 'scripts/p2qa-12-f3-f6-f2.ts', run: RUN };
  const platPre = await trySql<Record<string, string>>(p, `SELECT uid::text,cid::text,balance::text,frozen::text
    FROM account WHERE cid = 1 AND uid IN (-3,-2,-1,0) ORDER BY uid`);
  const trigPre = await trySql<Record<string, string>>(p, `SELECT t.tgname,t.tgenabled FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace
    ORDER BY t.tgname`);

  // ==========================================================================
  // F3 · 延迟 Σ 断言：强制 IMMEDIATE 不再假报；真 Σ 不符仍必须 LD032
  // ==========================================================================
  const E = 958601, W = 958602, A1 = 958603, A2 = 958604;
  const sym4 = 'p1x4' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z');
  const f3 = await inRollbackTx(p, async (c: Conn) => {
    const r: Record<string, unknown> = {};
    const cq = c as unknown as Qx;
    await ensureUsers(cq, [E, W, A1, A2]);
    const cr = await c.query(`INSERT INTO currency (symbol,name,owner_uid,decimals,total_supply,status,listed_at)
      VALUES ($1,$2,$3,0,0,'listed',now()) RETURNING cid::text AS cid`, [sym4, `p2qa ${sym4}`, String(E)]);
    const cid = String((cr.rows[0] as { cid: string }).cid);
    r.cid = cid;
    r.binds = [];
    for (const [ch, pa] of [[A1, A2], [W, A1]]) {
      const x = await trySql(cq, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(ch), String(pa)]);
      (r.binds as unknown[]).push({ edge: `${ch}->${pa}`, ok: x.ok, err: x.error ?? null });
    }
    r.mint = { ok: (await mintTo(cq, String(E), cid, '1000000', `ops:p1x:mint4-${RUN}`)).ok };
    r.hold = { ok: (await holdFor(cq, String(E), cid, '500000', JOB(30), `ops:p1x:hold4-${RUN}`)).ok };

    // ---- F3-a：强制 IMMEDIATE **先于**落账 ⇒ 合法（Σ 平衡）事件必须**不**假报 LD032
    const pol = await getCommissionPolicy(null, c as unknown as Queryable);
    const plan = await planJobSettlement({ jobId: JOB(31), employerUid: String(E), workerUid: String(W),
      cid, gross: '10000', ex: c as unknown as Queryable } as SettleJobInput);
    const ev = buildSettleEvent(plan);
    const goodPayload = { op: 'entries', idempotency_key: plan.idempotency_key,
      request_fingerprint: sha256('good' + RUN), ref_type: 'job', ref_id: plan.job_id,
      memo: `p2qa12 f3a ${RUN}`, entries: ev.entries.map((x) => toPayloadEntry(x)) };
    r.plan_good = { fee: plan.fee, net: plan.net, M: plan.M, layers: plan.layers.map((l) => `${l.beneficiary_uid}:${l.x}`),
      assertions: ev.assertions };

    await c.query('SAVEPOINT sp_f3a');
    await c.query(`SET CONSTRAINTS ${CONS} IMMEDIATE`);     // = as-found 的「提前结算」窗口
    const f3a = await tryFn(cq, goodPayload);
    await c.query('ROLLBACK TO SAVEPOINT sp_f3a');
    await c.query(`SET CONSTRAINTS ${CONS} DEFERRED`);
    r.f3a_immediate_before_post_balanced = {
      posted_ok: f3a.ok, error: f3a.error ?? null,
      as_found_old_reading: 'LD032 COMMISSION_SPLIT_SUM_MISMATCH（pool_in=1000 / commission_out=0 / commission_rows=0）',
      verdict_no_false_alarm: f3a.ok === true && !f3a.error };

    // ---- F3-b：真 Σ 不符（总量形态：有入无出）在**事件闭合**后仍必须 LD032
    await c.query('SAVEPOINT sp_f3b');
    const totalShape = await tryFn(cq, mkPayload(`ops:p1x:f3b-total-${RUN}`, JOB(32), [
      ent(String(E), cid, 'job_fee', '0', '-1000', 'job', JOB(32), 'f3b 有入无出'),
      ent(COMMISSION_POOL_UID, cid, 'job_fee', '1000', '0', 'job', JOB(32), 'f3b 入池'),
    ]));
    let f3bForce: Record<string, unknown>;
    try { await c.query(`SET CONSTRAINTS ${CONS} IMMEDIATE`); f3bForce = { forced_check_error: null }; }
    catch (e) { f3bForce = { forced_check_error: errInfo(e) }; }
    await c.query('ROLLBACK TO SAVEPOINT sp_f3b');
    await c.query(`SET CONSTRAINTS ${CONS} DEFERRED`);
    r.f3b_total_shape_pool_in_no_out = { posted_ok: totalShape.ok, posted_err: totalShape.error ?? null, ...f3bForce,
      verdict_still_reports: String((f3bForce.forced_check_error as Record<string, unknown>)?.sqlstate ?? '') === 'LD032' };

    // ---- F3-c：真 Σ 不符（保平衡形态：整事件 Σ(delta+frozen)=0 但佣金少分 100）
    await c.query('SAVEPOINT sp_f3c');
    const balShape = await tryFn(cq, mkPayload(`ops:p1x:f3c-balanced-${RUN}`, JOB(33), [
      ent(String(E), cid, 'job_fee', '0', '-1000', 'job', JOB(33), 'f3c 手续费'),
      ent(COMMISSION_POOL_UID, cid, 'job_fee', '1000', '0', 'job', JOB(33), 'f3c 入池'),
      ent(COMMISSION_POOL_UID, cid, 'commission', '-900', '0', 'commission_payout', JOB(33), 'f3c 出池 L=1'),
      ent(String(A1), cid, 'commission', '900', '0', 'commission_payout', JOB(33), 'f3c 第 1 层'),
    ]));
    let f3cForce: Record<string, unknown>;
    try { await c.query(`SET CONSTRAINTS ${CONS} IMMEDIATE`); f3cForce = { forced_check_error: null }; }
    catch (e) { f3cForce = { forced_check_error: errInfo(e) }; }
    await c.query('ROLLBACK TO SAVEPOINT sp_f3c');
    await c.query(`SET CONSTRAINTS ${CONS} DEFERRED`);
    const f3cErr = f3cForce.forced_check_error as Record<string, unknown> | null;
    r.f3c_balanced_shape_short_split = { posted_ok: balShape.ok, posted_err: balShape.error ?? null, ...f3cForce,
      verdict_still_reports: String(f3cErr?.sqlstate ?? '') === 'LD032',
      reason_is_split_sum_mismatch: String(f3ErrReason(f3cErr)) === 'COMMISSION_SPLIT_SUM_MISMATCH' };
    r.policy_now = { policy_id: pol.policy_id, fee_rate_bp: pol.fee_rate_bp, levels: pol.levels };
    return r;
  });
  out.F3 = { ...(f3.result ?? {}), tx_error: f3.error ? errInfo(f3.error) : null, rolled_back: f3.rolled_back };
  out.F3_verdict = {
    immediate_no_false_alarm: (f3.result as Record<string, unknown>)?.f3a_immediate_before_post_balanced,
    total_shape_still_LD032: (f3.result as Record<string, unknown>)?.f3b_total_shape_pool_in_no_out,
    balanced_shape_still_LD032: (f3.result as Record<string, unknown>)?.f3c_balanced_shape_short_split,
  };

  // ==========================================================================
  // F6 · already-bound 两路同码同 reason
  // ==========================================================================
  const C6 = 958611, P6 = 958612, O6 = 958613, C6b = 958614, P6b = 958615;
  const f6 = await inRollbackTx(p, async (c: Conn) => {
    const r: Record<string, unknown> = {};
    const cq = c as unknown as Qx;
    await ensureUsers(cq, [C6, P6, O6, C6b, P6b]);
    // 先合法绑定 C6→P6
    const first = await trySql(cq, `INSERT INTO referral (child_uid,parent_uid,depth) VALUES ($1,$2,0)
      RETURNING depth::text AS d`, [String(C6), String(P6)]);
    r.first_bind = { ok: first.ok, stored_depth: first.rows[0]?.d ?? null, err: first.error ?? null };

    // 路 1：裸 INSERT 重绑（as-found：23505 / referral_pk，无机读 reason）
    await c.query('SAVEPOINT sp_f6');
    const rawIns = await trySql(cq, `INSERT INTO referral (child_uid,parent_uid,depth) VALUES ($1,$2,0)
      RETURNING depth::text AS d`, [String(C6), String(O6)]);
    await c.query('ROLLBACK TO SAVEPOINT sp_f6');

    // 路 2：referral_bind 重绑
    await c.query('SAVEPOINT sp_f6b');
    const fnBind = await trySql(cq, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(C6), String(O6)]);
    await c.query('ROLLBACK TO SAVEPOINT sp_f6b');

    r.raw_insert_rebind = rawIns.ok ? { ok: true, depth: rawIns.rows[0]?.d } : { ok: false, err: rawIns.error };
    r.referral_bind_rebind = fnBind.ok ? { ok: true } : { ok: false, err: fnBind.error };
    const a = rawIns.error ?? {}; const b = fnBind.error ?? {};
    r.same_code_and_reason = { raw_sqlstate: a.sqlstate ?? null, fn_sqlstate: b.sqlstate ?? null,
      raw_reason: a.reason ?? null, fn_reason: b.reason ?? null,
      same_code: (a.sqlstate ?? null) !== null && a.sqlstate === b.sqlstate,
      same_reason: (a.reason ?? null) !== null && a.reason === b.reason,
      as_found_old: 'LD003/REFERRAL_ALREADY_BOUND（bind） vs 23505/ referral_pk、reason=null（裸 INSERT）' };

    // 反向对照：全新 child 两侧都应放行（证明闸不是「恒拒」）
    const ok1 = await trySql(cq, `INSERT INTO referral (child_uid,parent_uid,depth) VALUES ($1,$2,0)
      RETURNING depth::text AS d`, [String(C6b), String(P6b)]);
    r.fresh_child_raw_insert_allowed = { ok: ok1.ok, depth: ok1.rows[0]?.d ?? null, err: ok1.error ?? null };
    return r;
  });
  out.F6 = { ...(f6.result ?? {}), tx_error: f6.error ? errInfo(f6.error) : null, rolled_back: f6.rolled_back };

  // ==========================================================================
  // F2 · 父 depth 与真实跳数不符 ⇒ 绑定被拒
  // ==========================================================================
  const G2 = 958621, P2 = 958622, C2 = 958623;
  const f2 = await inRollbackTx(p, async (c: Conn) => {
    const r: Record<string, unknown> = {};
    const cq = c as unknown as Qx;
    await ensureUsers(cq, [G2, P2, C2]);
    // 合法：P2→G2（G2 无上行 ⇒ P2 真实跳数 1、存储 depth 1）
    const b1 = await trySql(cq, `INSERT INTO referral (child_uid,parent_uid,depth) VALUES ($1,$2,0)
      RETURNING depth::text AS d`, [String(P2), String(G2)]);
    r.parent_p2 = { ok: b1.ok, stored_depth: b1.rows[0]?.d ?? null };
    r.true_depth_of_p2 = (await c.query(`SELECT COALESCE(max(d),0)::text AS d FROM (
      WITH RECURSIVE up AS (SELECT parent_uid AS cur, 1 AS d FROM referral WHERE child_uid = $1
        UNION ALL SELECT r.parent_uid, up.d+1 FROM referral r JOIN up ON r.child_uid = up.cur WHERE up.d < 100)
      SELECT d FROM up) t`, [String(P2)])).rows[0] as { d: string };

    // 事务内破坏：DISABLE append-only + 把 P2 的 depth 改陈旧（末尾 ROLLBACK）
    await c.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await c.query(`UPDATE referral SET depth = 50 WHERE child_uid = $1`, [String(P2)]);
    await c.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only`);
    r.corrupted = (await c.query(`SELECT depth::text AS d FROM referral WHERE child_uid = $1`, [String(P2)])).rows[0];

    // 绑定新子 ⇒ 必须 LD016 + REFERRAL_PARENT_DEPTH_INCONSISTENT
    await c.query('SAVEPOINT sp_f2');
    const bad = await trySql(cq, `INSERT INTO referral (child_uid,parent_uid,depth) VALUES ($1,$2,0)
      RETURNING depth::text AS d`, [String(C2), String(P2)]);
    await c.query('ROLLBACK TO SAVEPOINT sp_f2');
    r.bind_to_stale_parent = bad.ok ? { ok: true, depth: bad.rows[0]?.d } : { ok: false, err: bad.error };
    r.rejected_as_expected = bad.ok === false && (bad.error?.sqlstate ?? '') === 'LD016'
      && (bad.error?.reason ?? '') === 'REFERRAL_PARENT_DEPTH_INCONSISTENT';
    r.child_row_not_written = (await c.query(`SELECT count(*)::text AS n FROM referral WHERE child_uid = $1`,
      [String(C2)])).rows[0];

    // 正向对照：把 P2 的 depth 复原为真实值 ⇒ 必须放行且新子 depth = 2
    await c.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await c.query(`UPDATE referral SET depth = 1 WHERE child_uid = $1`, [String(P2)]);
    await c.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only`);
    const good = await trySql(cq, `INSERT INTO referral (child_uid,parent_uid,depth) VALUES ($1,$2,0)
      RETURNING depth::text AS d`, [String(C2), String(P2)]);
    r.positive_control_after_restore = { ok: good.ok, stored_depth: good.rows[0]?.d ?? null, err: good.error ?? null };

    // 子事务内不变式：cycles = 0、bad_depth = 0（探针不得自证其罪）
    r.invariants_in_tx = (await c.query(`WITH RECURSIVE up AS (
        SELECT child_uid AS s, parent_uid AS cur, 1 AS d FROM referral
        UNION ALL SELECT u.s, r.parent_uid, u.d+1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
      SELECT (SELECT count(*)::text FROM up WHERE cur = s) AS cycles`)).rows[0];
    return r;
  });
  out.F2 = { ...(f2.result ?? {}), tx_error: f2.error ? errInfo(f2.error) : null, rolled_back: f2.rolled_back };

  // ---------------------------------------------------------------- 收尾
  const platPost = await trySql<Record<string, string>>(p, `SELECT uid::text,cid::text,balance::text,frozen::text
    FROM account WHERE cid = 1 AND uid IN (-3,-2,-1,0) ORDER BY uid`);
  const trigPost = await trySql<Record<string, string>>(p, `SELECT t.tgname,t.tgenabled FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace
    ORDER BY t.tgname`);
  out.platform_cid1_unchanged = JSON.stringify(platPre.rows) === JSON.stringify(platPost.rows);
  out.triggers_identical_pre_post = JSON.stringify(trigPre.rows) === JSON.stringify(trigPost.rows);
  out.triggers_disabled_now = (trigPost.rows as Array<Record<string, string>>).filter((r) => r.tgenabled !== 'O');
  out.residue = {
    referral_mine_958_6xx: await raw1(p, `SELECT count(*)::text AS n FROM referral
      WHERE child_uid BETWEEN 958600 AND 958699 OR parent_uid BETWEEN 958600 AND 958699`),
    users_mine_958_6xx: await raw1(p, `SELECT count(*)::text AS n FROM users WHERE uid BETWEEN 958600 AND 958699`),
    currency_p1x4: await raw1(p, `SELECT count(*)::text AS n FROM currency WHERE symbol LIKE 'p1x4%'`),
    ledger_rows_ref_job4: await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE ref_id BETWEEN
      958400000000000 AND 958499999999999`),
  };
  out.error_codes_closed_set_check = {
    note: '本轮修复**未新增错误码**：TS 侧 33 码（见 p2qa-10 的 error_codes）；DB 侧借码投影见 p2qa-10 的 db_borrow_map',
  };

  const f = save('p2qa-12-f3-f6-f2', out);
  console.log(JSON.stringify({ saved: f, F3_verdict: out.F3_verdict,
    F3_plan_good: (f3.result as Record<string, unknown>)?.plan_good,
    F6: f6.result, F2: f2.result,
    platform_cid1_unchanged: out.platform_cid1_unchanged,
    triggers_identical_pre_post: out.triggers_identical_pre_post,
    triggers_disabled_now: out.triggers_disabled_now, residue: out.residue }, null, 1));
  await p.end();

  function f3ErrReason(e: Record<string, unknown> | null): unknown {
    const d = (e?.detail_parsed as Record<string, unknown> | null | undefined);
    return d?.reason ?? e?.reason ?? null;
  }
})().catch((e) => { console.error('FATAL', errInfo(e)); process.exit(1); });
