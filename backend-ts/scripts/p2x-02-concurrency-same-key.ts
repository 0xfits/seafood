/**
 * p2x-02 · **真并发同键**（≥2 连接同时在飞；胜者一返回就提交）⇒ 恰一次落账 + 其余重放 + 不双扣
 * ============================================================================
 * 为什么另起一个脚本（而不是改 p2x-00 的用例 5）：
 *   p2x-00 的用例 5 是 `await Promise.all([call_A, call_B])` **之后**才提交 A ⇒ 胜者的事务在败者
 *   放弃之前**不可能**提交 ⇒ 败者只能等锁等到 R82 的 3s `lock_timeout`（LD025），**结构上不可能**
 *   走到重放分支（before/after 两相位读数逐字一致：LD025 @ ~3.2s）。那不是 0012 的缺陷，是那个探针
 *   里「先等两边都返回再提交胜者」的顺序造成的假红。本脚本复刻真实系统里的事务时序：
 *     ①两个连接**同时在飞**（同一载荷、同一键）；
 *     ②谁先返回谁是胜者 ⇒ **立刻提交它**（不等败者）；
 *     ③败者在等锁时被解锁 ⇒ 必须看到已提交的根行 ⇒ **200 重放**（这正是 0012 把重放闸放在
 *       C4 账户加锁**之后**换来的可观测收益：加锁之后的新语句 = 新快照 = 看得见对方已提交的根行）。
 *   ⇒ 本脚本的读数与 p2x-00 的用例 5 并列，作为「真并发同键」的权威读数。
 * 纪律：uid 960xxx（ns-alloc 每跑独占窗口，分区 960001-960900）/ symbol 前缀 `p2x` / 键前缀 `ops:p2x:`
 *   （`ops:p2x:zfix` 与 0012 自检的 960901-960902 保留段一律避开）；`moneyGuard` 前后哈希自证没碰
 *   cid=1 与平台账户 0/-1/-2/-3。夹具**提交**（并发用例必须让第二个连接看见根行）⇒ 残留仅限本 run 新命名空间。
 * 用法：`npx ts-node --transpile-only scripts/p2x-02-concurrency-same-key.ts [--assert]`
 * 退出码：0（无 reds 或未加 --assert）/ 1（加 --assert 且有 reds）/ 2 致命 / 3 前置不满足
 * 落盘：`.p2x-artifacts/p2x-02-concurrency-same-key-<RUN>.json` / `.txt`
 * ============================================================================
 */
import { mkPool, ensureUsers, ensureCurrency, tryFn, obs, beginTx, ledgerRowsFor, fnFingerprint,
  moneyGuard, raw, raw1, save, saveText, sleep, RUN, PHASE, type Qx, type FnRead } from './p2x-lib';
import { allocUidWindow, exitPrecondition } from './ns-alloc';

const ASSERT = process.argv.includes('--assert');
interface Check { case: string; name: string; ok: boolean; detail?: unknown; }
const checks: Check[] = [];
const judge = (c: string, name: string, ok: boolean, detail?: unknown): void => { checks.push({ case: c, name, ok, detail }); };

(async () => {
  const p = mkPool(6);
  const ns = await allocUidWindow(p, {
    count: 4, tagPrefix: 'p2x', partitions: [[960001, 960900]], stride: 4, seed: `${RUN}:c5t`,
    purpose: '真并发用例必须提交夹具（让第二个连接看得见根行）⇒ 账本 append-only、夹具不可复位，每跑必须独占新窗口',
  });
  if (!ns.ok) {
    const f = save('p2x-02-concurrency-same-key-FATAL', { run: RUN, phase: PHASE, fatal: ns.fatal });
    console.error(`[p2x-02] 命名空间分配失败，已落盘 ${f}`);
    exitPrecondition(ns.fatal);
  }
  const [E, W, X1, X2] = ns.uids;
  const UB = ns.uid_base;
  const SYM = `p2xq${UB}`;                    // 本 run 独占（p2x 前缀）
  const KP = `ops:p2x:${UB}:`;
  const K1 = `${KP}conc`;
  const JR = String(UB + 3);                  // job ref_id（本 run 独占）
  const out: Record<string, unknown> = {
    script: 'scripts/p2x-02-concurrency-same-key.ts', phase: PHASE, run: RUN,
    question: '两个连接**同时在飞**的同键请求：胜者一返回就提交 ⇒ 败者解锁后拿到 200 重放还是 LD002/LD025？',
    namespace: { uid_base: UB, uids: ns.uids, uid_source: ns.source, partition: ns.partition,
      symbol: SYM, key_prefix: KP, job_ref: JR, occupied_recheck: ns.occupied_recheck },
    fn_fingerprint: await fnFingerprint(p),
  };
  console.error(`[p2x-02 phase=${PHASE} run=${RUN}] namespace uid_base=${UB} symbol=${SYM}`);

  out.money_before = await moneyGuard(p, []);
  const cid = await ensureCurrency(p, SYM, E, 6);
  await ensureUsers(p, [E, W, X1, X2]);
  // ---- 夹具（提交）：铸币 1000000 + 托管 90000（与 p2x-00 用例 5 同形状）
  const fx = await beginTx(p);
  const m = await tryFn(fx.q, { op: 'mint', uid: E, cid, amount_units: '1000000', kind: 'mint', idempotency_key: `${KP}mint` });
  const h = await tryFn(fx.q, { op: 'hold', uid: E, cid, amount_units: '90000', kind: 'hold', ref_type: 'job', ref_id: JR,
    request_fingerprint: `fp-hold`, idempotency_key: `${KP}hold` });
  const cFx = await fx.commit();
  out.fixture = { mint: obs(m), hold: obs(h), hold_ok: h.ok, commit_error: cFx,
    note: '提交式夹具：并发用例必须让第二个连接看得见根行' };
  const acct = async (ex: Qx): Promise<{ b: string | null; f: string | null }> =>
    (await raw1<{ b: string; f: string }>(ex, `SELECT balance::text AS b, frozen::text AS f FROM account WHERE uid = $1 AND cid = $2`, [E, cid]))
    ?? { b: null, f: null };
  const a0 = await acct(p);
  out.account_after_fixture = a0;

  // ---- 同一载荷：净额事件（2 条分录；不含 job_fee ⇒ 可提交，避开 0011 的佣金守恒 DEFERRED 判负）
  const payload = {
    op: 'entries', idempotency_key: K1, ref_type: 'job', ref_id: JR, request_fingerprint: 'fp-conc',
    entries: [
      { uid: E, cid, kind: 'job_payout', delta: '0', frozen_delta: '-90000' },
      { uid: W, cid, kind: 'job_payout', delta: '90000', frozen_delta: '0' },
    ],
  };

  // ================================================================ 真并发：两连接同时在飞
  const A = await beginTx(p); const B = await beginTx(p);
  const t0 = Date.now();
  let firstSide: 'A' | 'B' | null = null;
  const mk = (side: 'A' | 'B', tx: { q: Qx }) => tryFn(tx.q, payload).then((r) => {
    if (firstSide === null) firstSide = side;
    return { side, r, at_ms: Date.now() - t0 };
  });
  // 两个调用**都先发出去**（同时在飞），再等第一个返回 —— 不是「同进程串行」
  const pA = mk('A', A); const pB = mk('B', B);
  const first = await Promise.race([pA, pB]);
  const winnerSide = firstSide as unknown as 'A' | 'B';
  const winnerCommit = await (winnerSide === 'A' ? A.commit() : B.commit());   // 胜者一返回就提交（不等败者）
  // 关键取证点：胜者已提交、败者仍在等锁 ⇒ 此刻键下**必须已经是 2 行**；败者重放后仍须是 2 行（零写入）
  const rowsMid = await ledgerRowsFor(p, K1);
  const [ra, rb] = await Promise.all([pA, pB]);
  const loserCommit = await (winnerSide === 'A' ? B.commit() : A.commit());
  const a1 = await acct(p);
  const bySide = { A: ra, B: rb } as Record<'A' | 'B', { side: 'A' | 'B'; r: FnRead; at_ms: number }>;
  const win = bySide[winnerSide]; const lose = bySide[winnerSide === 'A' ? 'B' : 'A'];
  const rows = await ledgerRowsFor(p, K1);
  out.concurrency = {
    both_in_flight: true, winner_side: winnerSide,
    first_returned_at_ms: first.at_ms, winner: { ...obs(win.r), side: win.side, at_ms: win.at_ms },
    loser: { ...obs(lose.r), side: lose.side, at_ms: lose.at_ms },
    winner_commit_error: winnerCommit, loser_commit_error: loserCommit,
    landed_count: [ra, rb].filter((x) => x.r.ok && !x.r.replay).length,
    replay_count: [ra, rb].filter((x) => x.r.ok && x.r.replay).length,
    error_count: [ra, rb].filter((x) => !x.r.ok).length,
    rows_for_key_mid: rowsMid, rows_for_key: rows, account_after: a1, expected_balance: String(1000000 - 90000),
    note: '胜者 = 先返回者；它一返回就 COMMIT（不等败者）⇒ 败者等锁结束后必须看见根行',
  };
  out.money_after = await moneyGuard(p, [cid]);
  out.money_guard_cid_created_by_this_run = cid;

  // ================================================================ 判据
  const w = obs(win.r); const l = obs(lose.r);
  judge('5', '两个连接**同时在飞**（不是同进程串行）：两次调用都先发出再等结果', true, { a_at_ms: ra.at_ms, b_at_ms: rb.at_ms });
  judge('5', '胜者真落账（ok + idempotent_replay=false + 有 txid）', w.ok === true && w.idempotent_replay === false && !!w.txid, w);
  judge('5', '败者 200 重放（ok + idempotent_replay=true）', l.ok === true && l.idempotent_replay === true, l);
  judge('5', '败者确实等过锁（败者耗时 > 胜者耗时 ⇒ 竞态真的发生）', Number(lose.at_ms) > Number(win.at_ms), { winner_ms: win.at_ms, loser_ms: lose.at_ms });
  judge('5', '重放 txid == 落账 txid', !!l.txid && l.txid === w.txid, { winner: w.txid, loser: l.txid });
  judge('5', '重放 entries/accounts 与首写**逐字相同**（sha256 对撞）', l.entries_sha256 === w.entries_sha256 && l.accounts_sha256 === w.accounts_sha256,
    { w: { e: w.entries_sha256, a: w.accounts_sha256 }, l: { e: l.entries_sha256, a: l.accounts_sha256 } });
  judge('5', '不双扣：键下分录恒 2 条', rows === 2, rows);
  judge('5', '不双扣：余额/冻结恰扣一次（balance = 1000000−90000，frozen = 0）',
    a1.b === String(1000000 - 90000) && a1.f === '0', a1);
  judge('5', '胜者提交成功（无 DEFERRED 约束在 COMMIT 判负）', winnerCommit === null, winnerCommit);
  judge('5', '败者（纯重放、零写入）提交也成功', loserCommit === null, loserCommit);
  judge('5', '重放方零写入：胜者提交后键下已 2 行，败者重放后仍是 2 行（extra_rows_added = 0）',
    rowsMid === 2 && rows === 2, { rows_mid_before_loser_replay: rowsMid, rows_after_loser_replay: rows, extra_rows_added: rows - rowsMid });
  const mb = out.money_before as any; const ma = out.money_after as any;
  judge('0', 'cid = 1 账户哈希前后一致（绝未触碰 $ 账户）', JSON.stringify(mb.cid1) === JSON.stringify(ma.cid1), { before: mb.cid1, after: ma.cid1 });
  judge('0', '平台账户 0/-1/-2/-3（排除本 run 新建 cid）哈希前后一致', JSON.stringify(mb.platform_other_cids) === JSON.stringify(ma.platform_other_cids),
    { before: mb.platform_other_cids, after: ma.platform_other_cids });

  const reds = checks.filter((c) => !c.ok);
  const final = { ...out, checks, reds: reds.map((c) => `${c.case} :: ${c.name}`), ok: reds.length === 0,
    verdict: reds.length === 0 ? '真并发同键：恰一次落账 + 败者 200 重放 + 不双扣' : '真并发同键读数被判红',
    test_data_created: { committed: true, symbol: SYM, cid, uids: ns.uids, keys: [K1, `${KP}mint`, `${KP}hold`], job_ref: JR,
      note: '本脚本夹具一律提交（并发用例的第二个连接必须看得见根行）；账本 append-only ⇒ 不可复位' } };
  const f = save('p2x-02-concurrency-same-key', final);
  const t = saveText('p2x-02-concurrency-same-key', JSON.stringify({ run: RUN, phase: PHASE, fn_fingerprint: out.fn_fingerprint,
    concurrency: out.concurrency, reds: final.reds,
    checks: checks.map((c) => `${c.ok ? 'GREEN' : 'RED  '} [${c.case}] ${c.name}`) }, null, 1));
  console.log(JSON.stringify({ file: f, txt: t, run: RUN, phase: PHASE, ok: final.ok,
    fn: out.fn_fingerprint, concurrency: out.concurrency, reds: final.reds }, null, 1));
  await Promise.race([p.end().catch(() => undefined), sleep(4000)]);
  process.exit(ASSERT && reds.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
