/**
 * p2x-00 · **幂等重放 vs 余额/冻结闸的相对顺序**（0012 修复单的验收矩阵）
 * ============================================================================
 * 唯一问题：同键第二次调用时，账本是**先做余额/冻结闸、还是先做幂等短路**？
 *   R52①（权威口径）：同键同指纹 ⇒ 200 + `{idempotent_replay:true, txid, …既有结果}`，
 *   **不再写任何分录、不重复扣款**。托管被前一笔花光后重试**也**必须拿到这个 200 ——
 *   否则调用方无法区分「已成功」与「余额不足」。
 *   spec §7.1（第 454 行）：函数内顺序 = 信封校验 → **幂等占位** → 全序加锁 → 分录 → 余额/冻结更新。
 *   ⇒ 「幂等占位」在「余额/冻结更新」**之前**。修前的实现（0005）恰好相反（C5 余额闸在 C7 重放之前）。
 *
 * 同一份脚本、两次运行（`P2X_PHASE=before|after`）⇒ 修前/修后 run-tagged 读数：
 *   before = 库里还是 0005 版函数（未应用 0012）；after = 已应用 0012。
 *   `--assert` 只按**修后契约**判红（before 相位不加 `--assert`，其 reds 就是缺陷本身的读数）。
 *
 * 验收矩阵（与派单逐条对应）
 *   1  头部用例：托管已花光 → 同键同载荷再发 ⇒ 200 + idempotent_replay:true + txid/分录/账户与首写逐字相同
 *   2  仍有足额 frozen 时重放 ⇒ 行为不变（200 重放）；且**结果形状与用例 1 的闸路径逐字相同**
 *   3  同键 + 不同指纹（托管已花光）⇒ 409 LEDGER_IDEMPOTENCY_CONFLICT（不再是 LD002）
 *   4  全新事件 + 余额/冻结不足 ⇒ 仍 LD002 / LD001（闸没被拆掉；R63 仍成立）
 *   5  **真并发同键**（≥2 连接，非串行）⇒ 恰一个落账、其余重放、不双扣
 *   5b 分阶段竞态：A 持锁未提交，B 同键重试（阻塞）⇒ A 提交后 B 必须拿到 200 重放
 *   6  事件未落账 / 键不存在 ⇒ 行为不变（不误报重放；同一载荷换新键仍落新账）
 *
 * 纪律
 *   · uid **960xxx**（`ns-alloc` 每跑独占新窗口，分区 960001-960900，避开 0012 自检保留的 960901-960902）；
 *     symbol 前缀 `p2x`；幂等键前缀 `ops:p2x:`。绝不触碰 cid = 1 与平台账户 0/-1/-2/-3 的既有余额
 *     （`moneyGuard` 前后哈希自证）。
 *   · 用例 1/2/3/4/6 全部在**回滚事务**内（零残留）；用例 5/5b 需要**真提交**才能让第二个连接看见根行
 *     ⇒ 残留仅限本 run 独占的新命名空间（明细进 `test_data_created`）。
 * 用法：`P2X_PHASE=before npx ts-node --transpile-only scripts/p2x-00-idempotency-replay-order.ts`
 * 退出码：0（无 reds 或未加 --assert）/ 1（有 reds 且加 --assert）/ 2 致命 / 3 前置不满足
 * 落盘：`.p2x-artifacts/p2x-00-replay-order-<RUN>.json`（run-tagged）
 * ============================================================================
 */
import { mkPool, ensureUsers, ensureCurrency, tryFn, tryFnSp, obs, inRollbackTx, beginTx, ledgerRowsFor,
  fnFingerprint, moneyGuard, raw1, raw, save, saveText, sha256, sleep, RUN, PHASE, type Qx, type FnRead } from './p2x-lib';
import { allocUidWindow, exitPrecondition } from './ns-alloc';

const ASSERT = process.argv.includes('--assert');

interface Check { case: string; name: string; ok: boolean; detail?: unknown; }
const checks: Check[] = [];
const judge = (c: string, name: string, ok: boolean, detail?: unknown) => { checks.push({ case: c, name, ok, detail }); };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const p = mkPool(6);
  // ---------------------------------------------------------------- 命名空间（每跑独占；import ns-alloc，不自造扫描）
  const win = await allocUidWindow(p, {
    count: 14, tagPrefix: 'p2x', partitions: [[960001, 960900]], stride: 14, seed: RUN,
    purpose: '本探针需要一段全新 uid 做 6 组夹具（users 行/账户/分录一旦提交不可复位；账本 append-only）',
  });
  if (!win.ok) {
    const f = save('p2x-00-replay-order-FATAL', { run: RUN, phase: PHASE, fatal: win.fatal });
    console.error(`[p2x-00] 命名空间分配失败，已落盘 ${f}`);
    exitPrecondition(win.fatal);
  }
  const [E1, W1, E2, W2, E3, W3, E4, W4, E5, W5, X1, X2, X3, X4] = win.uids;
  const UID_BASE = win.uid_base;
  const SYM_R = `p2xr${UID_BASE}`;                    // 回滚用例（零残留）
  const SYM_C = `p2xc${UID_BASE}`;                    // 用例 5（并发，提交）
  const SYM_D = `p2xd${UID_BASE}`;                    // 用例 5b（分阶段竞态，提交）
  const KP = `ops:p2x:${UID_BASE}:`;                  // 幂等键前缀（本 run 独占）
  const K = (s: string) => `${KP}${s}`;
  const JR = String(UID_BASE + 1);                    // job ref_id（本 run 独占）
  const JC = String(UID_BASE + 2);
  const JD = String(UID_BASE + 3);

  // ---------------------------------------------------------------- 事件载荷（与 p2w-03 同形状：净额 + 平台手续费）
  const evt = (key: string, emp: string, wk: string, cid: string, net: string, fee: string, refId: string, fp?: string) => ({
    op: 'entries', idempotency_key: key, ref_type: 'job', ref_id: refId,
    ...(fp === undefined ? {} : { request_fingerprint: fp }),
    entries: [
      { uid: emp, cid, kind: 'job_payout', delta: '0', frozen_delta: `-${net}` },
      { uid: wk, cid, kind: 'job_payout', delta: net, frozen_delta: '0' },
      { uid: emp, cid, kind: 'job_fee', delta: '0', frozen_delta: `-${fee}` },
      { uid: '-2', cid, kind: 'job_fee', delta: fee, frozen_delta: '0' },
    ],
  });
  /** 净额事件（2 条分录，**不触 -2 佣金池**）：提交式用例必须用它 ——
   *  0011 的 `ledger_assert_commission_conservation` 在 **COMMIT** 会判「job_fee 入池而无 commission 出」
   *  （LD032）⇒ 4 条含手续费的事件只能在**回滚事务**里用。 */
  const evtNet = (key: string, emp: string, wk: string, cid: string, net: string, refId: string, fp: string) => ({
    op: 'entries', idempotency_key: key, ref_type: 'job', ref_id: refId, request_fingerprint: fp,
    entries: [
      { uid: emp, cid, kind: 'job_payout', delta: '0', frozen_delta: `-${net}` },
      { uid: wk, cid, kind: 'job_payout', delta: net, frozen_delta: '0' },
    ],
  });
  const fixture = async (ex: Qx, emp: string, cid: string, mint: string, hold: string, refId: string, tag: string, inTx: boolean) => {
    const c = inTx ? tryFnSp : tryFn;   // 事务内必须用 SAVEPOINT 版（失败后事务不能被 abort）
    const m = await c(ex, { op: 'mint', uid: emp, cid, amount_units: mint, kind: 'mint', idempotency_key: K(`${tag}:mint`) });
    const h = await c(ex, { op: 'hold', uid: emp, cid, amount_units: hold, kind: 'hold', ref_type: 'job', ref_id: refId,
      request_fingerprint: `fp-hold-${tag}`, idempotency_key: K(`${tag}:hold`) });
    return { mint_ok: m.ok, hold_ok: h.ok,
      mint_err: m.error ? { sqlstate: m.error.sqlstate, message: m.error.message } : null,
      hold_err: h.error ? { sqlstate: h.error.sqlstate, message: h.error.message } : null };
  };
  const acct = async (ex: Qx, uid: string, cid: string) =>
    (await raw1<{ b: string; f: string }>(ex, `SELECT balance::text AS b, frozen::text AS f FROM account WHERE uid = $1 AND cid = $2`, [uid, cid]))
    ?? { b: null, f: null } as unknown as { b: string; f: string };

  const out: Record<string, unknown> = {
    script: 'scripts/p2x-00-idempotency-replay-order.ts', phase: PHASE, run: RUN,
    question: '同键第二次调用：账本先做余额/冻结闸，还是先做幂等短路（R52①）？',
    namespace: { uid_base: UID_BASE, uids: win.uids, uid_source: win.uid_source, partition: win.partition,
      symbol_rollback: SYM_R, symbol_concurrent: SYM_C, symbol_staged: SYM_D, key_prefix: KP,
      job_refs: [JR, JC, JD], occupied_recheck: win.occupied_recheck },
    fn_fingerprint: await fnFingerprint(p),
  };

  // 「没碰别人钱」的前置快照（排除本 run 待建的两个 cid）
  const preCids = await raw<{ cid: string }>(p, `SELECT cid::text AS cid FROM currency WHERE symbol = ANY($1::text[])`, [[SYM_C, SYM_D]]);
  out.money_before = await moneyGuard(p, preCids.map((r) => String(r.cid)));

  const cases: Record<string, unknown> = {};
  const notes: string[] = [];

  // ================================================================ 提交式夹具（用例 5 / 5b 用；本 run 独占命名空间）
  await ensureUsers(p, [E4, W4, E5, W5]);
  const cidC = await ensureCurrency(p, SYM_C, E4, 6);
  const cidD = await ensureCurrency(p, SYM_D, E5, 6);
  const fx5 = await fixture(p, E4, cidC, '1000000', '90000', JC, 'c5', false);
  const fx5b = await fixture(p, E5, cidD, '1000000', '90000', JD, 'c5b', false);
  out.committed_fixtures = { cidC, cidD, fx5, fx5b, note: '提交式（用例 5/5b 必须让第二个连接看得见根行）' };

  // ================================================================ 用例 1（头部）：托管花光后同键同载荷重发
  const K1 = K('c1'); const P1 = evt(K1, E1, W1, '', '89000', '1000', JR, 'fp-c1');
  console.error(`[p2x-00 phase=${PHASE} run=${RUN}] namespace uid_base=${UID_BASE} symbols=${SYM_R}/${SYM_C}/${SYM_D}`);
  console.error('[p2x-00] case 1 (headline) …');
  const c1 = await inRollbackTx(p, async (tx) => {
    await ensureUsers(tx, [E1, W1]);
    const cid = await ensureCurrency(tx, SYM_R, E1, 6);
    const fx = await fixture(tx, E1, cid, '1000000', '90000', JR, 'c1', true);
    const first = await tryFnSp(tx, { ...P1, entries: P1.entries.map((e) => ({ ...e, cid })) });
    const a1 = await acct(tx, E1, cid);
    const second = await tryFnSp(tx, { ...P1, entries: P1.entries.map((e) => ({ ...e, cid })) });
    const third = await tryFnSp(tx, { ...P1, entries: P1.entries.map((e) => ({ ...e, cid })) });
    return { cid, fixture: fx, frozen_after_first: a1.f, balance_after_first: a1.b,
      first: obs(first), second: obs(second), third: obs(third), rows_for_key: await ledgerRowsFor(tx, K1) };
  });
  const C1 = (c1.result ?? { tx_error: String(c1.error) }) as any;
  cases['1_headline_replay_after_escrow_spent'] = C1;

  // ================================================================ 用例 2：仍有足额 frozen 时重放（对照）
  const K2 = K('c2'); const P2 = evt(K2, E2, W2, '', '89000', '1000', JR, 'fp-c2');
  console.error('[p2x-00] case 2 …');
  const c2 = await inRollbackTx(p, async (tx) => {
    await ensureUsers(tx, [E2, W2]);
    const cid = await ensureCurrency(tx, SYM_R, E2, 6);
    const fx = await fixture(tx, E2, cid, '1000000', '180000', JR, 'c2', true);
    const first = await tryFnSp(tx, { ...P2, entries: P2.entries.map((e) => ({ ...e, cid })) });
    const a1 = await acct(tx, E2, cid);
    const second = await tryFnSp(tx, { ...P2, entries: P2.entries.map((e) => ({ ...e, cid })) });
    return { cid, fixture: fx, frozen_after_first: a1.f, first: obs(first), second: obs(second),
      rows_for_key: await ledgerRowsFor(tx, K2) };
  });
  const C2 = (c2.result ?? { tx_error: String(c2.error) }) as any;
  cases['2_replay_with_escrow_left'] = C2;

  // ================================================================ 用例 3：同键 + 不同指纹（托管已花光）
  const K3 = K('c3'); const P3 = evt(K3, E3, W3, '', '89000', '1000', JR, 'fp-c3');
  console.error('[p2x-00] case 3 …');
  const c3 = await inRollbackTx(p, async (tx) => {
    await ensureUsers(tx, [E3, W3]);
    const cid = await ensureCurrency(tx, SYM_R, E3, 6);
    const fx = await fixture(tx, E3, cid, '1000000', '90000', JR, 'c3', true);
    const withCid = (fp: string) => ({ ...P3, request_fingerprint: fp, entries: P3.entries.map((e) => ({ ...e, cid })) });
    const first = await tryFnSp(tx, withCid('fp-c3'));
    const a1 = await acct(tx, E3, cid);
    const diff = await tryFnSp(tx, withCid('fp-c3-CHANGED-BUSINESS-FIELD'));
    const rowsAfter = await ledgerRowsFor(tx, K3);
    const stillAlive = await tryFnSp(tx, withCid('fp-c3'));   // 冲突后同键同指纹仍必须是重放（未被污染）
    return { cid, fixture: fx, frozen_after_first: a1.f, first: obs(first), conflict_call: obs(diff),
      rows_for_key_after_conflict: rowsAfter, replay_after_conflict_call: obs(stillAlive) };
  });
  const C3 = (c3.result ?? { tx_error: String(c3.error) }) as any;
  cases['3_same_key_different_fingerprint'] = C3;

  // ================================================================ 用例 4：全新键 + 余额/冻结不足（闸未被拆掉）
  console.error('[p2x-00] case 4 …');
  const c4 = await inRollbackTx(p, async (tx) => {
    await ensureUsers(tx, [E3, W3, X1, X2]);
    const cid = await ensureCurrency(tx, SYM_R, E3, 6);
    const frozen = await tryFnSp(tx, { op: 'entries', idempotency_key: K('c4:frozen'), request_fingerprint: 'fp-c4a',
      ref_type: 'job', ref_id: JR,
      entries: [
        { uid: E3, cid, kind: 'job_payout', delta: '0', frozen_delta: '-1' },
        { uid: W3, cid, kind: 'job_payout', delta: '1', frozen_delta: '0' },
      ] });
    const balance = await tryFnSp(tx, { op: 'entries', idempotency_key: K('c4:balance'), request_fingerprint: 'fp-c4b',
      ref_type: 'job', ref_id: JR,
      entries: [
        { uid: X1, cid, kind: 'job_payout', delta: '-1', frozen_delta: '0' },
        { uid: X2, cid, kind: 'job_payout', delta: '1', frozen_delta: '0' },
      ] });
    const rowsA = await ledgerRowsFor(tx, K('c4:frozen'));
    const rowsB = await ledgerRowsFor(tx, K('c4:balance'));
    return { cid, new_event_frozen_insufficient: obs(frozen), new_event_balance_insufficient: obs(balance),
      rows_left_by_rejected_frozen_event: rowsA, rows_left_by_rejected_balance_event: rowsB };
  });
  const C4 = (c4.result ?? { tx_error: String(c4.error) }) as any;
  cases['4_brand_new_event_still_gated'] = C4;

  // ================================================================ 用例 5：真并发同键（≥2 连接）
  const K5 = K('c5'); const P5 = evtNet(K5, E4, W4, cidC, '90000', JC, 'fp-c5');
  console.error('[p2x-00] case 5 …');
  const A5 = await beginTx(p); const B5 = await beginTx(p);
  const [rA5, rB5] = await Promise.all([tryFn(A5.q, P5), tryFn(B5.q, P5)]);
  const cA5 = await A5.commit(); const cB5 = await B5.commit();
  const a5 = await acct(p, E4, cidC);
  const C5 = { concurrent: true, conn_a: obs(rA5), conn_b: obs(rB5),
    landed_count: [rA5, rB5].filter((r) => r.ok && !r.replay).length,
    replay_count: [rA5, rB5].filter((r) => r.ok && r.replay).length,
    error_count: [rA5, rB5].filter((r) => !r.ok).length,
    rows_for_key: await ledgerRowsFor(p, K5),
    commit_errors: { conn_a: cA5, conn_b: cB5 },
    emp_balance_after: a5.b, emp_frozen_after: a5.f,
    expected_balance: String(1000000 - 90000) };
  cases['5_true_concurrency_same_key'] = C5;

  // ================================================================ 用例 5b：分阶段竞态（A 持锁未提交 ⇒ B 阻塞 ⇒ A 提交）
  const K6 = K('c5b'); const P6 = evtNet(K6, E5, W5, cidD, '90000', JD, 'fp-c5b');
  console.error('[p2x-00] case 5b …');
  const A6 = await beginTx(p); const B6 = await beginTx(p);
  const rA6 = await tryFn(A6.q, P6);                       // 已落账、**未提交** ⇒ 持有账户行锁
  const t0 = Date.now();
  const pB6 = tryFn(B6.q, P6);                             // 同键重试：应在 C4 的 FOR UPDATE 上阻塞
  await sleep(700);
  const cA6 = await A6.commit();                           // A 提交 ⇒ B 应看得见根行
  const rB6 = await pB6; const b_ms = Date.now() - t0;
  await B6.rollback();                                     // 重放路径零写入 ⇒ 回滚无损（被拒时也已 abort）
  const acc6 = await acct(p, E5, cidD);
  const C5b = { staged_race: true, first_call_committed_after: obs(rA6),
    blocked_retry: { ...obs(rB6), blocked_ms: b_ms },
    retry_txid_equals_first: obs(rB6).txid === obs(rA6).txid,
    rows_for_key: await ledgerRowsFor(p, K6), commit_error_conn_a: cA6,
    emp_balance_after: acc6.b, emp_frozen_after: acc6.f, expected_balance: String(1000000 - 90000) };
  cases['5b_staged_race_retry_while_inflight'] = C5b;

  // ================================================================ 用例 6：事件未落账 / 键不存在 ⇒ 行为不变
  console.error('[p2x-00] case 6 …');
  const c6 = await inRollbackTx(p, async (tx) => {
    await ensureUsers(tx, [X3, X4]);
    const cid = await ensureCurrency(tx, SYM_R, E1, 6);
    const m = await tryFnSp(tx, { op: 'mint', uid: E1, cid, amount_units: '1000', kind: 'mint', idempotency_key: K('c6:mint') });
    const e = (key: string) => ({ op: 'entries', idempotency_key: key, request_fingerprint: 'fp-c6', ref_type: 'job', ref_id: JR,
      entries: [
        { uid: E1, cid, kind: 'job_payout', delta: '-10', frozen_delta: '0' },
        { uid: X4, cid, kind: 'job_payout', delta: '10', frozen_delta: '0' },
      ] });
    const firstNewKey = await tryFnSp(tx, e(K('c6:newkey')));
    const secondNewKeySamePayload = await tryFnSp(tx, e(K('c6:newkey-2')));
    const replayAgainFirstKey = await tryFnSp(tx, e(K('c6:newkey')));
    return { cid, mint_ok: m.ok,
      first_new_key: obs(firstNewKey), same_payload_new_key: obs(secondNewKeySamePayload),
      replay_first_key_again: obs(replayAgainFirstKey),
      rows_first_key: await ledgerRowsFor(tx, K('c6:newkey')),
      rows_second_key: await ledgerRowsFor(tx, K('c6:newkey-2')) };
  });
  const C6 = (c6.result ?? { tx_error: String(c6.error) }) as any;
  cases['6_no_such_event_behaviour_unchanged'] = C6;

  // ================================================================ 判据（**修后契约**；before 相位的 reds 即缺陷读数）
  const R = (o: any) => o ?? {};
  const c1f = R(C1.first), c1s = R(C1.second), c1t = R(C1.third);
  judge('1', '首写必须真落（否则本用例空跑）', c1f.ok === true && c1f.idempotent_replay === false, c1f);
  judge('1', '首写后托管恰花光（冻结 = 0）', C1.frozen_after_first === '0', C1.frozen_after_first);
  judge('1', '托管花光后同键同载荷再发 ⇒ 200 + idempotent_replay:true（R52①）', c1s.ok === true && c1s.idempotent_replay === true, c1s);
  judge('1', '重放 txid 与首写逐字相同', c1s.txid !== null && c1s.txid === c1f.txid, { first: c1f.txid, second: c1s.txid });
  judge('1', '重放 entries 与首写逐字相同（entries_sha256）', c1s.entries_sha256 === c1f.entries_sha256, { first: c1f.entries_sha256, second: c1s.entries_sha256 });
  judge('1', '重放 accounts 与首写逐字相同（accounts_sha256）', c1s.accounts_sha256 === c1f.accounts_sha256, { first: c1f.accounts_sha256, second: c1s.accounts_sha256 });
  judge('1', '重放零写入：键下分录数恒 4', C1.rows_for_key === 4, C1.rows_for_key);
  judge('1', '重放幂等：第三次调用逐字等于第二次', c1t.raw_json === c1s.raw_json, { third: c1t.raw_json, second: c1s.raw_json });

  const c2f = R(C2.first), c2s = R(C2.second);
  judge('2', '首写真落 + 托管仍有余量（对照条件成立）', c2f.ok === true && C2.frozen_after_first === '90000', C2.frozen_after_first);
  judge('2', '仍留足额 frozen 时同键重发 ⇒ 200 重放（行为不变）', c2s.ok === true && c2s.idempotent_replay === true, c2s);
  judge('2', '重放零写入：键下分录数恒 4', C2.rows_for_key === 4, C2.rows_for_key);
  judge('2', '重放结果形状与用例 1 的闸路径**逐字相同**（result_keys / extra / txid 语义）',
    eq(c2s.result_keys, c1s.result_keys) && eq(c2s.extra, c1s.extra), { case2: { k: c2s.result_keys, e: c2s.extra }, case1: { k: c1s.result_keys, e: c1s.extra } });

  const c3f = R(C3.first), c3c = R(C3.conflict_call), c3r = R(C3.replay_after_conflict_call);
  judge('3', '首写真落 + 托管恰花光', c3f.ok === true && C3.frozen_after_first === '0', C3.frozen_after_first);
  judge('3', '同键异指纹 ⇒ 409 LD003 LEDGER_IDEMPOTENCY_CONFLICT（R52②，而非 LD002）', c3c.ok === false && c3c.sqlstate === 'LD003', c3c);
  judge('3', '冲突调用零写入：键下分录数仍 4', C3.rows_for_key_after_conflict === 4, C3.rows_for_key_after_conflict);
  judge('3', '冲突后同键同指纹仍是 200 重放（指纹闸未污染状态）', c3r.ok === true && c3r.idempotent_replay === true, c3r);

  const c4a = R(C4.new_event_frozen_insufficient), c4b = R(C4.new_event_balance_insufficient);
  judge('4', '全新键 + 冻结不足 ⇒ 仍 LD002（余额/冻结闸未被拆掉；R63 仍成立）', c4a.ok === false && c4a.sqlstate === 'LD002', c4a);
  judge('4', '全新键 + 余额不足 ⇒ 仍 LD001', c4b.ok === false && c4b.sqlstate === 'LD001', c4b);
  judge('4', '被拒的新事件零残留（键下 0 条分录）', C4.rows_left_by_rejected_frozen_event === 0 && C4.rows_left_by_rejected_balance_event === 0,
    { frozen: C4.rows_left_by_rejected_frozen_event, balance: C4.rows_left_by_rejected_balance_event });

  const o5a = R(C5.conn_a), o5b = R(C5.conn_b);
  judge('5', '真并发同键 ⇒ 恰一个落账（landed_count = 1）', C5.landed_count === 1, { a: o5a, b: o5b });
  judge('5', '另一个必须 200 重放（replay_count = 1，error_count = 0）', C5.replay_count === 1 && C5.error_count === 0, { a: o5a, b: o5b });
  judge('5', '重放方 txid == 落账方 txid', (o5a.idempotent_replay ? o5a.txid : o5b.txid) === (o5a.idempotent_replay ? o5b.txid : o5a.txid), { a: o5a.txid, b: o5b.txid });
  judge('5', '两次提交都成功（无 DEFERRED 约束在 COMMIT 判负）', R(C5.commit_errors?.conn_a ?? null) === null && R(C5.commit_errors?.conn_b ?? null) === null, C5.commit_errors);
  judge('5', '不双扣：键下分录恒 2 条（净额 + 入账）', C5.rows_for_key === 2, C5.rows_for_key);
  judge('5', '不双扣：余额/冻结恰扣一次（balance = 首铸 − 净额 − 手续费，frozen = 0）',
    C5.emp_balance_after === C5.expected_balance && C5.emp_frozen_after === '0', { balance: C5.emp_balance_after, frozen: C5.emp_frozen_after });

  const a6 = R(C5b.first_call_committed_after), b6 = R(C5b.blocked_retry);
  judge('5b', 'A 首写落账（提交）', a6.ok === true && a6.idempotent_replay === false, a6);
  judge('5b', 'B 确实阻塞过（blocked_ms > 300 ⇒ 竞态真的发生）', Number(b6.blocked_ms ?? 0) > 300, b6.blocked_ms);
  judge('5b', 'A 提交后 B 同键重试 ⇒ 200 重放（不是 LD002）', b6.ok === true && b6.idempotent_replay === true, b6);
  judge('5b', 'B 重放 txid == A 首写 txid', b6.txid !== null && b6.txid === a6.txid, { a: a6.txid, b: b6.txid });
  judge('5b', 'A 的提交成功（无 DEFERRED 约束在 COMMIT 判负）', C5b.commit_error_conn_a === null, C5b.commit_error_conn_a);
  judge('5b', '不双扣：键下分录恒 2 条 + 余额/冻结恰扣一次',
    C5b.rows_for_key === 2 && C5b.emp_balance_after === C5b.expected_balance && C5b.emp_frozen_after === '0',
    { rows: C5b.rows_for_key, balance: C5b.emp_balance_after, frozen: C5b.emp_frozen_after });

  const c6a = R(C6.first_new_key), c6b = R(C6.same_payload_new_key), c6c = R(C6.replay_first_key_again);
  judge('6', '键不存在（新键）⇒ 正常落账、idempotent_replay=false（闸不误报重放）', c6a.ok === true && c6a.idempotent_replay === false, c6a);
  judge('6', '同一载荷换新键 ⇒ 仍落新账（闸不误伤新事件）', c6b.ok === true && c6b.idempotent_replay === false && c6b.txid !== c6a.txid, c6b);
  judge('6', '再次用首个新键 ⇒ 200 重放且 txid 与首写相同', c6c.ok === true && c6c.idempotent_replay === true && c6c.txid === c6a.txid, c6c);
  judge('6', '两个新键各自 2 条分录', C6.rows_first_key === 2 && C6.rows_second_key === 2, { a: C6.rows_first_key, b: C6.rows_second_key });

  // ================================================================ 「没碰别人的钱」+ 残留量化
  const cidsThisRun = [cidC, cidD];
  out.money_after = await moneyGuard(p, cidsThisRun);
  const mb = out.money_before as any; const ma = out.money_after as any;
  judge('0', 'cid = 1 账户余额哈希前后一致（绝未触碰 $ 账户）', eq(mb.cid1, ma.cid1), { before: mb.cid1, after: ma.cid1 });
  judge('0', '平台账户 0/-1/-2/-3（排除本 run 新建 cid）余额哈希前后一致', eq(mb.platform_other_cids, ma.platform_other_cids),
    { before: mb.platform_other_cids, after: ma.platform_other_cids });

  const reds = checks.filter((c) => !c.ok);
  const redCases = [...new Set(reds.map((c) => c.case))].sort();
  const final = {
    ...out,
    cases,
    checks,
    reds: reds.map((c) => `${c.case} :: ${c.name}`),
    red_cases: redCases,
    ok: reds.length === 0,
    notes,
    verdict: reds.length === 0
      ? '按修后契约全绿：R52① 的重放在余额/冻结闸之前短路（含并发与竞态路径）'
      : `契约被判红：${redCases.join(',')} —— before 相位时这正是被修复的缺陷（幂等判定被余额闸挡住）`,
    test_data_created: {
      note: '用例 1/2/3/4/6 在回滚事务内（零残留）；用例 5/5b 提交（真并发/竞态必须让第二个连接看见根行）',
      committed_currency_symbols: [SYM_C, SYM_D], committed_cids: [cidC, cidD],
      committed_uids: [E4, W4, E5, W5], committed_keys: [K5, K6, K('c5:mint'), K('c5:hold'), K('c5b:mint'), K('c5b:hold')],
      job_refs: [JC, JD],
    },
  };
  const f = save('p2x-00-replay-order', final);
  const t = saveText('p2x-00-replay-order', JSON.stringify({ run: RUN, phase: PHASE, fn_fingerprint: out.fn_fingerprint,
    red_cases: redCases, checks: checks.map((c) => `${c.ok ? 'GREEN' : 'RED  '} [${c.case}] ${c.name}`) }, null, 1));
  console.log(JSON.stringify({ file: f, txt: t, run: RUN, phase: PHASE, ok: final.ok, red_cases: redCases,
    fn: out.fn_fingerprint,
    headline: { first: R(C1.first), second: R(C1.second) },
    case3_conflict: R(C3.conflict_call),
    case5: { landed: C5.landed_count, replay: C5.replay_count, errors: C5.error_count, rows: C5.rows_for_key },
    case5b: { blocked_ms: R(C5b.blocked_retry).blocked_ms, retry: R(C5b.blocked_retry) },
    reds: final.reds }, null, 1));
  // p.end() 只在「所有连接都已归还」时才 resolve ⇒ 加一个上界，避免连接泄漏把调用挂死
  await Promise.race([p.end().catch(() => undefined), sleep(4000)]);
  process.exit(ASSERT && reds.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
