/**
 * p2qa2-03 · 头号行为用例 + 反向用例（自造夹具 · 自造命名空间 uid 961xxx / symbol p2qa2* / key ops:p2qa2:*）
 * ============================================================================
 * 用例（全部自造，不用交付方的 uid/键）：
 *  A. 头号：mint 500000 → hold 123456（托管恰花光前）→ 事件 E 把托管 123456 **恰花光**
 *     ⇒ 首写 200/新事件；同键同载荷同指纹重试 ⇒ 200 + idempotent_replay:true + **同 txid** + 零新增行 + 余额/冻结同首写
 *  A2. 反向①：同键**异指纹**（托管已花光）⇒ LD003 且零写入
 *  A3. 反向②：**全新键**冻结不足 ⇒ LD002；A4 反向③：全新键余额不足 ⇒ LD001；被拒后零残留
 *  A5. 第三次重放逐字等于第二次（重放自身幂等）
 *  B. 并发（提交式夹具，另见 p2qa2-04）
 * 全部 A* 在**回滚事务**内（零残留）。落盘 run-tagged。
 * 用法：P2QA2_RUN=<tag> npx ts-node --transpile-only --project tsconfig.scripts.probe.json .p2qa2-artifacts/p2qa2-03-behavior.ts
 */
import { mkPool, raw, raw1, save, obs, tryFnSp, ledgerRowsFor, acct, ensureUsers, ensureCurrency, inRollbackTx,
  moneyGuard, NET_RETRIES, pgErr, type Qx } from './p2qa2-lib';
import { allocNamespace, exitPrecondition } from '../scripts/ns-alloc';

const RUN = process.env.P2QA2_RUN ?? 'NONE';

interface Check { id: string; name: string; ok: boolean; detail?: unknown; }
const checks: Check[] = [];
const judge = (id: string, name: string, ok: boolean, detail?: unknown) => checks.push({ id, name, ok, detail });

(async () => {
  const p = mkPool(4);
  try {
    const ns = await allocNamespace(p, {
      tagPrefix: 'p2qa2', seed: RUN, uidCount: 10, uidPartitions: [[961001, 961999]], uidStride: 10,
      symbolPrefix: 'p2qa2', keyPrefix: 'ops:p2qa2', jobDigits: 9,
      purpose: '0012 独立质检：账本 append-only + symbol 唯一 + 键唯一 ⇒ 每跑必须独占全新命名空间',
    });
    if (!ns.ok) { save('p2qa2-03-behavior-FATAL', { fatal: ns.fatal }); console.error(JSON.stringify(ns.fatal)); exitPrecondition(ns.fatal); }
    const [E1, W1] = ns.uids;
    const SYM = ns.symbol;
    const K = (s: string) => `${ns.key_prefix}${s}`;
    const JP = ns.job_tag;

    const moneyBefore = await moneyGuard(p, []);

    const res = await inRollbackTx(p, async (tx: Qx) => {
      await ensureUsers(tx, [E1, W1]);
      const cid = await ensureCurrency(tx, SYM, E1, 6);
      const t0 = Date.now();

      // 夹具：mint 500000 → hold 123456（冻结）→ 事件把托管恰花光
      const mint = await tryFnSp(tx, { op: 'mint', uid: E1, cid, amount_units: '500000', kind: 'mint', idempotency_key: K('mint') });
      const hold = await tryFnSp(tx, { op: 'hold', uid: E1, cid, amount_units: '123456', kind: 'hold',
        ref_type: 'job', ref_id: JP, request_fingerprint: 'qa-hold-fp', idempotency_key: K('hold') });
      const fx = await acct(tx, E1, cid);

      const PAYLOAD = { op: 'entries', idempotency_key: K('evt'), request_fingerprint: 'qa-evt-fp-1',
        ref_type: 'job', ref_id: JP,
        entries: [
          { uid: E1, cid, kind: 'job_payout', delta: '0', frozen_delta: '-123456' },
          { uid: W1, cid, kind: 'job_payout', delta: '123456', frozen_delta: '0' },
        ] };

      const r1 = await tryFnSp(tx, PAYLOAD);
      const o1 = obs(r1);
      const acctAfterFirst = await acct(tx, E1, cid);
      const rowsAfterFirst = await ledgerRowsFor(tx, K('evt'));

      const r2 = await tryFnSp(tx, PAYLOAD);
      const o2 = obs(r2);
      const acctAfterReplay = await acct(tx, E1, cid);
      const rowsAfterReplay = await ledgerRowsFor(tx, K('evt'));

      const r3 = await tryFnSp(tx, PAYLOAD);
      const o3 = obs(r3);
      const rowsAfterThird = await ledgerRowsFor(tx, K('evt'));

      // 反向①：同键异指纹
      const CONFLICT = { ...PAYLOAD, request_fingerprint: 'qa-evt-fp-2' };
      const rc = await tryFnSp(tx, CONFLICT);
      const oc = obs(rc);
      const rowsAfterConflict = await ledgerRowsFor(tx, K('evt'));
      const acctAfterConflict = await acct(tx, E1, cid);

      // 反向②：全新键 + 冻结不足（托管已花光）
      const NEWFROZ = { op: 'entries', idempotency_key: K('new-frozen'), request_fingerprint: 'qa-new-fz',
        ref_type: 'job', ref_id: JP,
        entries: [
          { uid: E1, cid, kind: 'job_payout', delta: '0', frozen_delta: '-1' },
          { uid: W1, cid, kind: 'job_payout', delta: '1', frozen_delta: '0' },
        ] };
      const rf = await tryFnSp(tx, NEWFROZ);
      const of = obs(rf);
      const rowsNewFrozen = await ledgerRowsFor(tx, K('new-frozen'));
      const acctAfterFrozenReject = await acct(tx, E1, cid);

      // 反向③：全新键 + 余额不足
      const NEWBAL = { op: 'entries', idempotency_key: K('new-balance'), request_fingerprint: 'qa-new-bal',
        ref_type: 'job', ref_id: JP,
        entries: [
          { uid: E1, cid, kind: 'job_payout', delta: '-99999999', frozen_delta: '0' },
          { uid: W1, cid, kind: 'job_payout', delta: '99999999', frozen_delta: '0' },
        ] };
      const rb = await tryFnSp(tx, NEWBAL);
      const ob = obs(rb);
      const rowsNewBal = await ledgerRowsFor(tx, K('new-balance'));
      const acctAfterBalReject = await acct(tx, E1, cid);

      // 反向④：异指纹拒绝后再同键同指纹 ⇒ 仍是重放（状态未被污染）
      const r4 = await tryFnSp(tx, PAYLOAD);
      const o4 = obs(r4);

      // 错误对象形态（证明 reason 从 e.detail 读得到）
      const errShapes = { conflict: rc.error, frozen: rf.error, balance: rb.error };

      return { cid, ms: Date.now() - t0, mint: obs(mint), hold: obs(hold), fixture_acct: fx,
        first: o1, replay: o2, replay_third: o3,
        acct_after_first: acctAfterFirst, acct_after_replay: acctAfterReplay,
        rows: { after_first: rowsAfterFirst, after_replay: rowsAfterReplay, after_third: rowsAfterThird },
        conflict: oc, rows_after_conflict: rowsAfterConflict, acct_after_conflict: acctAfterConflict,
        new_frozen_reject: of, rows_new_frozen: rowsNewFrozen, acct_after_frozen_reject: acctAfterFrozenReject,
        new_balance_reject: ob, rows_new_balance: rowsNewBal, acct_after_balance_reject: acctAfterBalReject,
        replay_after_conflict: o4,
        err_shapes: errShapes,
        payload: PAYLOAD };
    }, 20_000);

    const moneyAfter = await moneyGuard(p, []);

    if (res.error || !res.result) {
      const f = save('p2qa2-03-behavior-FATAL', { run: RUN, ns, tx_error: String(res.error), e: pgErr(res.error) });
      console.error(`事务失败，已落盘 ${f}`); console.error(res.error);
      process.exit(2);
    }
    const R = res.result;

    // ------------------------------------------------------------------ 判定
    judge('A0', '夹具成立：mint 落账 + hold 冻结 123456（balance 376544 / frozen 123456）',
      R.mint.ok && R.hold.ok && R.fixture_acct.balance === '376544' && R.fixture_acct.frozen === '123456', R.fixture_acct);
    judge('A1', '首写 = 新事件（ok && !idempotent_replay）+ 2 分录', R.first.ok === true && R.first.idempotent_replay === false && R.first.entries_n === 2, R.first);
    judge('A2', '首写把托管**恰花光**（frozen 0，balance 376544）',
      R.acct_after_first.frozen === '0' && R.acct_after_first.balance === '376544', R.acct_after_first);
    judge('A3', '托管花光后同键同载荷同指纹重试 ⇒ ok=true + idempotent_replay=true（R52① 的 200 语义）',
      R.replay.ok === true && R.replay.idempotent_replay === true, { sqlstate: R.replay.sqlstate, reason: R.replay.reason, msg: R.replay.err_message, raw_keys: R.replay.result_keys });
    judge('A4', '重放 **txid 与首写逐字相同**', R.replay.txid !== null && R.replay.txid === R.first.txid, { first: R.first.txid, replay: R.replay.txid });
    judge('A5', '重放 **零新增**：键下分录行数首写/重放/三跑恒为 2',
      R.rows.after_first === 2 && R.rows.after_replay === 2 && R.rows.after_third === 2, R.rows);
    judge('A6', '重放 entries / accounts 与首写**逐字相同**（entries_sha256 / accounts_sha256）',
      R.replay.entries_sha256 === R.first.entries_sha256 && R.replay.accounts_sha256 === R.first.accounts_sha256,
      { e1: R.first.entries_sha256, e2: R.replay.entries_sha256, a1: R.first.accounts_sha256, a2: R.replay.accounts_sha256 });
    judge('A7', '重放后余额/冻结与首写后**一致**（不双扣）',
      JSON.stringify(R.acct_after_replay) === JSON.stringify(R.acct_after_first), { first: R.acct_after_first, replay: R.acct_after_replay });
    judge('A8', '第三次重放逐字等于第二次（重放自身幂等）', R.replay_third.raw_json === R.replay.raw_json, { same: R.replay_third.raw_json === R.replay.raw_json });
    judge('A9', 'extra 读数（首写 vs 重放；本条只登记事实，判据见 9a）',
      true, { first_extra: R.first.extra, replay_extra: R.replay.extra, first_extra_keys: Object.keys(R.first.extra ?? {}), replay_extra_keys: Object.keys(R.replay.extra ?? {}) });

    // 反向
    judge('B1', '同键**异指纹** ⇒ 报错且 sqlstate = LD003（R52②）', R.conflict.ok === false && R.conflict.sqlstate === 'LD003',
      { sqlstate: R.conflict.sqlstate, reason: R.conflict.reason, msg: R.conflict.err_message });
    judge('B2', '异指纹冲突**零写入**：键下仍 2 行 + 账户未变',
      R.rows_after_conflict === 2 && JSON.stringify(R.acct_after_conflict) === JSON.stringify(R.acct_after_first),
      { rows: R.rows_after_conflict, acct: R.acct_after_conflict });
    judge('B3', '冲突后同键同指纹仍是重放（状态未被污染）', R.replay_after_conflict.ok === true && R.replay_after_conflict.idempotent_replay === true, R.replay_after_conflict);
    judge('B4', '**全新键** + 冻结不足 ⇒ 仍 LD002（闸未拆掉；R63 仍成立）',
      R.new_frozen_reject.ok === false && R.new_frozen_reject.sqlstate === 'LD002',
      { sqlstate: R.new_frozen_reject.sqlstate, reason: R.new_frozen_reject.reason, msg: R.new_frozen_reject.err_message });
    judge('B5', '**全新键** + 余额不足 ⇒ 仍 LD001', R.new_balance_reject.ok === false && R.new_balance_reject.sqlstate === 'LD001',
      { sqlstate: R.new_balance_reject.sqlstate, reason: R.new_balance_reject.reason, msg: R.new_balance_reject.err_message });
    judge('B6', '被拒的新事件**零残留**：两新键下均 0 行 + 账户未变',
      R.rows_new_frozen === 0 && R.rows_new_balance === 0
      && JSON.stringify(R.acct_after_frozen_reject) === JSON.stringify(R.acct_after_first)
      && JSON.stringify(R.acct_after_balance_reject) === JSON.stringify(R.acct_after_first),
      { rows_frozen: R.rows_new_frozen, rows_balance: R.rows_new_balance, a_fz: R.acct_after_frozen_reject, a_bal: R.acct_after_balance_reject });
    judge('B7', '错误对象可机读：e.detail 里能取到 reason（三码各一）',
      !!(R.err_shapes.conflict?.detail || R.err_shapes.conflict?.reason)
      && !!(R.err_shapes.frozen?.detail || R.err_shapes.frozen?.reason)
      && !!(R.err_shapes.balance?.detail || R.err_shapes.balance?.reason),
      R.err_shapes);

    const moneySame = JSON.stringify(moneyBefore.cid1) === JSON.stringify(moneyAfter.cid1)
      && JSON.stringify(moneyBefore.platform_other_cids) === JSON.stringify(moneyAfter.platform_other_cids);
    judge('M0', 'cid=1 与平台账户 0/-1/-2/-3 余额/冻结哈希前后一致（未碰别人钱）', moneySame, { before: moneyBefore, after: moneyAfter });

    const reds = checks.filter((c) => !c.ok);
    const out = { run: RUN, ns, money_before: moneyBefore, money_after: moneyAfter, checks, reds: reds.map((r) => r.id),
      net_retries: NET_RETRIES, tx_ms: R.ms, tx_rolled_back: res.rolled_back,
      residual_note: 'A* 全部在已回滚事务内 ⇒ users/currency/ledger_entry 零残留',
      headline_readings: { first: R.first, replay: R.replay, replay_third: R.replay_third, conflict: R.conflict,
        new_frozen_reject: R.new_frozen_reject, new_balance_reject: R.new_balance_reject } };
    const f = save('p2qa2-03-behavior', out);
    console.log(JSON.stringify({ file: f, ns, reds: out.reds, checks: checks.map((c) => `${c.ok ? 'GREEN' : 'RED  '} [${c.id}] ${c.name}`),
      first_txid: R.first.txid, replay_txid: R.replay.txid, rows: R.rows, money_same: moneySame, net_retries: NET_RETRIES }, null, 1));
    process.exit(reds.length ? 1 : 0);
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
