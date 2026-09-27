/**
 * p2qa2-04 · 真并发（自写探针 · ≥2 独立连接 · **胜者不等败者即可提交**）
 * ============================================================================
 * 设计要点（与 p2x-00 用例 5 的关键差别）：**胜者一 resolve 就立刻 COMMIT**，
 * 绝不用 `await Promise.all([...])` 之后再提交 —— 后者会让「持锁的胜者等被锁的败者」，
 * 双方互等 ⇒ 败者在 3s lock_timeout 上拿到 LD025（那是探针自己的排序缺陷，不是被测对象的缺陷）。
 *
 * 用例
 *   5A 同键同载荷双连接齐发：恰一个落账、另一个 200 重放、同 txid、不双扣、键下恒 2 行
 *   5B 分阶段竞态：A 持锁未提交 ⇒ B 同键重试（阻塞）⇒ A 提交 ⇒ B 必须拿到 200 重放 + A 的 txid
 * 提交式夹具（真落账，残留在本 run 独占命名空间）；cid=1 / 平台账户 0/-1/-2/-3 前后哈希自证未动。
 */
import { mkPool, raw, raw1, save, obs, tryFn, ledgerRowsFor, acct, ensureUsers, ensureCurrency, beginTx,
  moneyGuard, pgErr, sleep, NET_RETRIES, type Qx, type Tx } from './p2qa2-lib';
import { allocNamespace, exitPrecondition } from '../scripts/ns-alloc';

const RUN = process.env.P2QA2_RUN ?? 'NONE';
interface Check { id: string; name: string; ok: boolean; detail?: unknown; }
const checks: Check[] = [];
const judge = (id: string, name: string, ok: boolean, detail?: unknown) => checks.push({ id, name, ok, detail });

(async () => {
  const p = mkPool(6);
  try {
    const ns = await allocNamespace(p, {
      tagPrefix: 'p2qa2', seed: RUN + ':conc', uidCount: 8, uidPartitions: [[961001, 961999]], uidStride: 8,
      symbolPrefix: 'p2qa2', keyPrefix: 'ops:p2qa2:cc', jobDigits: 9,
      purpose: '0012 独立质检·真并发：需真提交 ⇒ 必须独占全新命名空间（append-only 不可复位）',
    });
    if (!ns.ok) { save('p2qa2-04-concurrency-FATAL', { fatal: ns.fatal }); console.error(JSON.stringify(ns.fatal)); exitPrecondition(ns.fatal); }
    const [E5, W5] = ns.uids;
    const K = (s: string) => `${ns.key_prefix}${s}`;
    const JP = ns.job_tag;

    const moneyBefore = await moneyGuard(p, []);

    // ---------------- 提交式夹具：mint 1000000 → hold 200000 → hold 300000
    let cid = '';
    {
      const t = await beginTx(p, 20_000);
      await ensureUsers(t.q, [E5, W5]);
      cid = await ensureCurrency(t.q, ns.symbol, E5, 6);
      const m = await tryFn(t.q, { op: 'mint', uid: E5, cid, amount_units: '1000000', kind: 'mint', idempotency_key: K('c:mint') });
      const h1 = await tryFn(t.q, { op: 'hold', uid: E5, cid, amount_units: '200000', kind: 'hold',
        ref_type: 'job', ref_id: JP, request_fingerprint: 'qa-c-hold-200k', idempotency_key: K('c:hold200') });
      const h2 = await tryFn(t.q, { op: 'hold', uid: E5, cid, amount_units: '300000', kind: 'hold',
        ref_type: 'job', ref_id: JP, request_fingerprint: 'qa-c-hold-300k', idempotency_key: K('c:hold300') });
      const cErr = await t.commit();
      if (!m.ok || !h1.ok || !h2.ok || cErr) {
        const f = save('p2qa2-04-concurrency-FATAL', { ns, mint: obs(m), h1: obs(h1), h2: obs(h2), commit: cErr });
        console.error(`夹具提交失败 ${f}`); process.exit(2);
      }
    }
    const fxAcct = await acct(p, E5, cid);
    judge('F0', '提交式夹具成立：balance 500000 / frozen 500000', fxAcct.balance === '500000' && fxAcct.frozen === '500000', fxAcct);

    // ---------------- 5A 同键齐发（胜者立刻提交）
    const P5A = { op: 'entries', idempotency_key: K('c:5a'), request_fingerprint: 'qa-c-5a',
      ref_type: 'job', ref_id: JP,
      entries: [
        { uid: E5, cid, kind: 'job_payout', delta: '0', frozen_delta: '-200000' },
        { uid: W5, cid, kind: 'job_payout', delta: '200000', frozen_delta: '0' },
      ] };
    const A = await beginTx(p, 25_000);
    const B = await beginTx(p, 25_000);
    const t0 = Date.now();
    const pA = tryFn(A.q, P5A).then((r) => ({ who: 'A', r }));
    const pB = tryFn(B.q, P5A).then((r) => ({ who: 'B', r }));
    const first = await Promise.race([pA, pB]);
    const winnerCommitMs = Date.now() - t0;
    const cW = first.who === 'A' ? await A.commit() : await B.commit();     // **胜者不等败者**
    const second = first.who === 'A' ? await pB : await pA;
    const cL = first.who === 'A' ? await B.commit() : await A.commit();
    const raceMs = Date.now() - t0;
    const C5A = { winner: first.who,
      winner_result: obs(first.r), loser_result: obs(second.r),
      winner_commit_error: cW, loser_commit_error: cL,
      winner_commit_ms: winnerCommitMs, total_race_ms: raceMs,
      rows_for_key: await ledgerRowsFor(p, K('c:5a')) };
    const acct5A = await acct(p, E5, cid);
    const acct5AW = await acct(p, W5, cid);
    judge('5A1', '齐发同键 ⇒ 恰一个落账（landed = 1）',
      [first.r, second.r].filter((r) => r.ok && !r.replay).length === 1, { landed: [first.r, second.r].filter((r) => r.ok && !r.replay).length, winner: first.who });
    judge('5A2', '另一个必须 200 重放（replay = 1、error = 0）',
      [first.r, second.r].filter((r) => r.ok && r.replay).length === 1 && [first.r, second.r].filter((r) => !r.ok).length === 0,
      { replay: [first.r, second.r].filter((r) => r.ok && r.replay).length, errs: [first.r, second.r].filter((r) => !r.ok).map((r) => obs(r)) });
    judge('5A3', '重放方 txid == 落账方 txid', obs(first.r).txid !== null && obs(first.r).txid === obs(second.r).txid,
      { first: obs(first.r), second: obs(second.r) });
    judge('5A4', '**胜者不等败者即提交成功**（胜者 commit 无错，且发生在竞态总时长之内）',
      cW === null && winnerCommitMs <= raceMs, { winner_commit_error: cW, winner_commit_ms: winnerCommitMs, total_race_ms: raceMs });
    judge('5A5', '不双扣：键下分录恒 2 行（零新增）', C5A.rows_for_key === 2, C5A);
    judge('5A6', '不双扣：E5 balance 500000 / frozen 300000（恰扣一次 200000）、W5 balance 200000',
      acct5A.balance === '500000' && acct5A.frozen === '300000' && acct5AW.balance === '200000',
      { E5: acct5A, W5: acct5AW });

    // ---------------- 5B 分阶段竞态（A 持锁未提交 ⇒ B 阻塞 ⇒ A 提交）
    const P5B = { op: 'entries', idempotency_key: K('c:5b'), request_fingerprint: 'qa-c-5b',
      ref_type: 'job', ref_id: JP,
      entries: [
        { uid: E5, cid, kind: 'job_payout', delta: '0', frozen_delta: '-300000' },
        { uid: W5, cid, kind: 'job_payout', delta: '300000', frozen_delta: '0' },
      ] };
    const A2 = await beginTx(p, 25_000);
    const B2 = await beginTx(p, 25_000);
    const rA2 = await tryFn(A2.q, P5B);                 // 已落账、**未提交** ⇒ 持账户行锁
    const tb = Date.now();
    const pB2 = tryFn(B2.q, P5B);                       // 同键重试：应在 C4 的 FOR UPDATE 上阻塞
    await sleep(700);
    const cA2 = await A2.commit();                      // A 提交 ⇒ B 应看得见根行
    const rB2 = await pB2; const blockedMs = Date.now() - tb;
    const cB2 = await B2.commit();
    const C5B = { staged: true, first: obs(rA2), retry: { ...obs(rB2), blocked_ms: blockedMs },
      first_commit_error: cA2, retry_commit_error: cB2,
      rows_for_key: await ledgerRowsFor(p, K('c:5b')) };
    const acct5B = await acct(p, E5, cid);
    const acct5BW = await acct(p, W5, cid);
    judge('5B1', 'A 首写落账（提交）', rA2.ok === true && rA2.replay === false && cA2 === null, { first: obs(rA2), commit: cA2 });
    judge('5B2', 'B 确实在锁上阻塞过（blocked_ms > 300 ⇒ 竞态真的发生）', blockedMs > 300, { blocked_ms: blockedMs });
    judge('5B3', 'A 提交后 B 同键重试 ⇒ 200 重放（不是 LD002/LD025）',
      rB2.ok === true && rB2.replay === true, { retry: obs(rB2) });
    judge('5B4', 'B 重放 txid == A 首写 txid', obs(rB2).txid !== null && obs(rB2).txid === obs(rA2).txid, { a: obs(rA2).txid, b: obs(rB2).txid });
    judge('5B5', '不双扣：键下 2 行 + E5 balance 500000 / frozen 0、W5 balance 500000',
      C5B.rows_for_key === 2 && acct5B.balance === '500000' && acct5B.frozen === '0' && acct5BW.balance === '500000',
      { rows: C5B.rows_for_key, E5: acct5B, W5: acct5BW });

    // ---------------- 总分录数符合预期
    const key5A = await ledgerRowsFor(p, K('c:5a'));
    const key5B = await ledgerRowsFor(p, K('c:5b'));
    const fxKeys = { mint: await ledgerRowsFor(p, K('c:mint')), hold200: await ledgerRowsFor(p, K('c:hold200')), hold300: await ledgerRowsFor(p, K('c:hold300')) };
    judge('T0', '全部键下分录数符合预期：5a=2 / 5b=2 / mint=1 / hold200=2 / hold300=2',
      key5A === 2 && key5B === 2 && fxKeys.mint === 1 && fxKeys.hold200 === 2 && fxKeys.hold300 === 2,
      { key5a: key5A, key5b: key5B, ...fxKeys });

    const moneyAfter = await moneyGuard(p, [cid]);
    const moneySame = JSON.stringify(moneyBefore.cid1) === JSON.stringify(moneyAfter.cid1)
      && JSON.stringify(moneyBefore.platform_other_cids) === JSON.stringify(moneyAfter.platform_other_cids);
    judge('M0', 'cid=1 与平台账户（排除本 run 新 cid）余额/冻结哈希前后一致', moneySame, { before: moneyBefore, after: moneyAfter });

    const reds = checks.filter((c) => !c.ok);
    const out = { run: RUN, ns, cid, money_before: moneyBefore, money_after: moneyAfter, checks, reds: reds.map((r) => r.id),
      case_5a: C5A, case_5b: C5B, net_retries: NET_RETRIES,
      test_data_created: { uid_window: ns.uids, symbol: ns.symbol, cid, keys: [K('c:mint'), K('c:hold200'), K('c:hold300'), K('c:5a'), K('c:5b')],
        note: '真提交 ⇒ 永久残留（账本 append-only）；仅限本 run 独占命名空间' } };
    const f = save('p2qa2-04-concurrency', out);
    console.log(JSON.stringify({ file: f, ns, reds: out.reds, checks: checks.map((c) => `${c.ok ? 'GREEN' : 'RED  '} [${c.id}] ${c.name}`),
      case_5a: { winner: C5A.winner, winner_result: C5A.winner_result, loser_result: C5A.loser_result, winner_commit_ms: C5A.winner_commit_ms },
      case_5b: { blocked_ms: C5B.retry.blocked_ms, txid_a: obs(rA2).txid, txid_b: obs(rB2).txid },
      money_same: moneySame, net_retries: NET_RETRIES }, null, 1));
    process.exit(reds.length ? 1 : 0);
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
