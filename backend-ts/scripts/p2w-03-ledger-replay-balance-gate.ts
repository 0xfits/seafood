/**
 * p2w-03 · **账本「幂等重放」与「余额闸」的相对顺序**（只读语义探针，零残留）
 * ============================================================================
 * 起因：把 `p2w-00` 改可重跑时，§C（F7② 重放）第二跑出现
 *   `LD002 LEDGER_INSUFFICIENT_FROZEN {cid, uid, required:'99000', available:'0'}`
 *   —— 但该调用本应是**幂等重放**（同键、同业务输入，只是政策版本不同 ⇒ 组装出的金额不同）。
 *   库上读数显示：第一笔结算已把托管（frozen）花光 ⇒ 第二次调用在**没有任何 frozen** 的情况下被拒。
 *
 * 本探针要回答的唯一问题：**同键第二次调用时，账本是先做余额闸、还是先做幂等短路？**
 *   判据 A：同键 + 同载荷 + **frozen 已被第一笔花光** ⇒ 若报 `LD002` ⇒ **余额闸在前**；
 *            若返回 `idempotent_replay=true` ⇒ 幂等短路在前。
 *   判据 B：同键 + 同载荷 + **仍有足够 frozen** ⇒ 必须返回 `idempotent_replay=true`（重放语义本身正常）。
 *            两判据合起来把「顺序」与「重放功能」分离，避免把「余额闸在前」误读成「重放坏了」。
 *
 * 为什么这是**产品语义**而不是探针问题：这意味着
 *   · 重放请求**自身仍需「可垫付」**（金额须 ≤ 当前 frozen）——即使它一条分录都不会落；
 *   · 于是「政策改版后重放」在**托管已被前一笔花光**的场景下拿不到重放结果，而是拿到 LD002
 *     ⇒ 调用方若把「同键重发」设计成**无条件安全**的重试，就会在这条路径上看到 409 而不是幂等读；
 *   · 探针侧的对策：F7② 用例必须让雇主**留够**两次调用各自金额所需的 frozen（见 p2w-00 §C 的双倍托管）。
 *
 * 纪律：全部读写在**回滚事务**内（末尾一律 ROLLBACK）⇒ 零残留；uid 走 `ns-alloc` 分配（只读）；
 *       symbol 前缀 `p1y` / 幂等键前缀 `ops:p1y:`；绝不触碰 `cid = 1` 与平台账户余额。
 * 用法：`npx ts-node --transpile-only scripts/p2w-03-ledger-replay-balance-gate.ts [--assert]`
 * 退出码：0 全绿 / 1 判红（`--assert`）/ 2 致命 / 3 前置不满足
 * 落盘：`.p2w-artifacts/p2w-03-replay-vs-balance-<RUN>.json`（run-tagged）
 * ============================================================================
 */
import { mkPool, raw, raw1, save, saveText, tryFn, callFn, inRollbackTx, ensureUsers, ensureCurrency, RUN, type Qx } from './p2w-lib';
import { allocUidWindow, exitPrecondition } from './ns-alloc';

const ASSERT = process.argv.includes('--assert');
const reds: string[] = [];
const judge = (name: string, ok: boolean, extra?: unknown) => { if (!ok) reds.push(extra === undefined ? name : `${name} :: ${JSON.stringify(extra)}`); };

(async () => {
  const p = mkPool(4);
  const win = await allocUidWindow(p, { count: 4, tagPrefix: 'p2w', partitions: [[959001, 959949]], stride: 4, seed: RUN,
    purpose: '本探针需要一个未被占用的 uid 段做雇主/打工人夹具（users 行一旦插入不可复用）' });
  if (!win.ok) {
    const f = save('p2w-03-replay-vs-balance-FATAL', { run: RUN, fatal: win.fatal });
    console.error(`[p2w-03] 命名空间分配失败，已落盘 ${f}`);
    exitPrecondition(win.fatal);
  }
  const [EMP, WK] = win.uids;
  const SYM = `p1y${win.uid_base}`;                       // 前缀 p1y ✓（含 uid_base 保证本 run 唯一）
  const KEY = (s: string) => `ops:p1y:${win.uid_base}:${s}`;
  const JOB = `${win.uid_base}`;                          // job 号段 = 本 run 的 uid 基准（全局唯一性由窗口保证）

  await ensureUsers(p, [EMP, WK]);
  const cid = await ensureCurrency(p, SYM, EMP, 8);        // owner = 演员 ⇒ mint 走 owner 自铸授权
  const K = `biz:job:settle:${JOB}`;

  /** 一次「结算形状」的事件载荷：雇主 frozen −net、打工人 +net、雇主 frozen −fee、池 +fee */
  const payload = (net: string, fee: string) => ({
    op: 'entries', idempotency_key: K, ref_type: 'job', ref_id: JOB,
    request_fingerprint: 'p2w03-replay-vs-balance',
    entries: [
      { uid: EMP, cid, kind: 'job_payout', delta: '0', frozen_delta: `-${net}` },
      { uid: WK, cid, kind: 'job_payout', delta: net, frozen_delta: '0' },
      { uid: EMP, cid, kind: 'job_fee', delta: '0', frozen_delta: `-${fee}` },
      { uid: '-2', cid, kind: 'job_fee', delta: fee, frozen_delta: '0' },
    ],
  });

  const res: Record<string, unknown> = {};
  // ---- 判据 A：托管被第一笔花光后，同键再发（expect: LD002 ⇒ 余额闸在幂等短路**之前**）
  const A = await inRollbackTx(p, async (tx: Qx) => {
    const m = await tryFn(tx, { op: 'mint', uid: EMP, cid, amount_units: '1000000', kind: 'mint', idempotency_key: KEY('mintA') });
    const h = await tryFn(tx, { op: 'hold', uid: EMP, cid, amount_units: '100000', kind: 'hold', ref_type: 'job', ref_id: JOB, idempotency_key: KEY('holdA') });
    const first = await tryFn(tx, payload('99000', '1000'));
    const frozenAfterFirst = await raw1<{ f: string }>(tx, `SELECT frozen::text AS f FROM account WHERE uid = $1 AND cid = $2`, [EMP, cid]);
    const second = await tryFn(tx, payload('99000', '1000'));
    return { mint_ok: m.ok, hold_ok: h.ok, first: { ok: first.ok, replay: first.replay, err: first.error },
      frozen_after_first: frozenAfterFirst?.f ?? null,
      second: { ok: second.ok, replay: second.replay, err: second.error } };
  });
  res['A_second_call_after_escrow_spent'] = A.result ?? { tx_error: String(A.error) };
  // ---- 判据 B：留够两次调用各自金额的 frozen ⇒ 同键再发必须返回 idempotent_replay
  const B = await inRollbackTx(p, async (tx: Qx) => {
    const m = await tryFn(tx, { op: 'mint', uid: EMP, cid, amount_units: '1000000', kind: 'mint', idempotency_key: KEY('mintB') });
    const h = await tryFn(tx, { op: 'hold', uid: EMP, cid, amount_units: '200000', kind: 'hold', ref_type: 'job', ref_id: JOB, idempotency_key: KEY('holdB') });
    const first = await tryFn(tx, payload('99000', '1000'));
    const frozenAfterFirst = await raw1<{ f: string }>(tx, `SELECT frozen::text AS f FROM account WHERE uid = $1 AND cid = $2`, [EMP, cid]);
    const second = await tryFn(tx, payload('99000', '1000'));
    const rows = await raw1<{ n: string }>(tx, `SELECT count(*)::text AS n FROM ledger_entry
      WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1`, [K]);
    return { mint_ok: m.ok, hold_ok: h.ok, first: { ok: first.ok, replay: first.replay, err: first.error },
      frozen_after_first: frozenAfterFirst?.f ?? null,
      second: { ok: second.ok, replay: second.replay, err: second.error }, ledger_rows_for_key: rows?.n ?? null };
  });
  res['B_second_call_with_escrow_left'] = B.result ?? { tx_error: String(B.error) };

  const out = { run: RUN, script: 'scripts/p2w-03-ledger-replay-balance-gate.ts',
    key: K, cid, symbol: SYM, emp: EMP, worker: WK, partition_used: win.partition, uid_base: win.uid_base,
    question: '同键第二次调用：账本先做余额闸还是先做幂等短路？',
    readings: res,
    note: '两个判据都在**回滚事务**内（零残留）；A/B 唯一差别是 hold 的 frozen 是否够第二次调用所需' };
  const Ares = res['A_second_call_after_escrow_spent'] as Record<string, unknown>;
  const Bres = res['B_second_call_with_escrow_left'] as Record<string, unknown>;
  const A2 = (Ares?.second ?? {}) as Record<string, unknown>;
  const B2 = (Bres?.second ?? {}) as Record<string, unknown>;
  const A2err = (A2.err ?? null) as Record<string, unknown> | null;
  // 语义登记判据（断言「账本的相对顺序」，不是断言「没问题」）：
  judge('A：托管花光后同键再发 ⇒ LD002/INSUFFICIENT_FROZEN（⇒ 余额闸在幂等短路之前）',
    A2.ok === false && A2err?.sqlstate === 'LD002', A2);
  judge('B：仍留有足够 frozen ⇒ 同键再发返回 idempotent_replay=true（重放功能本身正常）',
    B2.ok === true && B2.replay === true, B2);
  judge('B：重放不新增分录（键下分录数 = 首写的 4 条）', String(Bres?.ledger_rows_for_key) === '4', Bres?.ledger_rows_for_key);
  judge('A 的第一笔必须真落（否则本判据空跑）', ((Ares?.first ?? {}) as Record<string, unknown>).ok === true, Ares?.first);
  judge('B 的第一笔必须真落（否则本判据空跑）', ((Bres?.first ?? {}) as Record<string, unknown>).ok === true, Bres?.first);

  const finalOut = { ...out, reds, ok: reds.length === 0 };
  const file = save('p2w-03-replay-vs-balance', finalOut);
  const txt = saveText('p2w-03-replay-vs-balance', JSON.stringify(finalOut, null, 1));
  console.log(JSON.stringify({ file, txt, run: RUN, ok: reds.length === 0, reds,
    A: { second: A2, frozen_after_first: Ares?.frozen_after_first },
    B: { second: B2, frozen_after_first: Bres?.frozen_after_first, ledger_rows_for_key: Bres?.ledger_rows_for_key } }, null, 1));
  await p.end();
  process.exit(ASSERT && reds.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
