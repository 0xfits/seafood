/**
 * QA-P1E-02 · 幂等**派生键碰撞**攻击（Neng 高危项 ①）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-02-idem-collision.ts
 *
 * 攻击面：函数把「事件第 i 条分录」的幂等键派生为
 *     i = 0 ⇒ <key>；i >= 1 ⇒ <key> || '#' || (i+1)
 * 键形状校验只要求 `^(biz|cm|cli|ops):`，**不禁止** `#`。于是：
 *   调用方 A 用 key = "ops:qae:coll:a" 落一笔 transfer ⇒ 流水键 = a, a#2
 *   调用方 B 用 key = "ops:qae:coll:a#2" 落一笔**完全无关**的 transfer ⇒ B 的首分录键 = a#2
 * 方向 ①（B 撞 A 的派生键）：B 的 INSERT ON CONFLICT DO NOTHING 命中 A 的 a#2 ⇒
 *   函数认为「重放」⇒ 走 C7 重放分支 ⇒ 键族查询匹配到 A 的 a#2 ⇒ 返回 ok=true,
 *   idempotent_replay=true, txid = A 的 a#2。指纹校验读 `WHERE idempotency_key = v_key`
 *   = A 的 a#2 行，其 request_fingerprint 为 NULL（派生键不带指纹）⇒ **校验被短路**。
 *   ⇒ B 的业务事件被**静默丢弃**却报成功。
 * 方向 ②（A 撞已有派生键）：先有 key="a#2" 的单条事件，再用 key="a" 落两分录事件 ⇒
 *   第二条分录 INSERT（无 ON CONFLICT）撞唯一约束 ⇒ LD003 409。⇒ B 的合法事件被误判冲突。
 *
 * 本探针两个方向都真跑，逐条给出原始读数。
 */
import { attempt, ensureCurrency, entriesFor, mkPool, raw } from './qa-p1e-lib';

const RUN = Date.now().toString(36).slice(-5);
const SYM = `qaeI${RUN}`;
const A = 932001n;
const B = 932002n;
const C = 932003n;

(async () => {
  const out: Record<string, unknown> = { run: RUN, symbol: SYM };
  const p = mkPool(4);
  const cid = await ensureCurrency(p, SYM, A, 0, 'listed', null);
  out.cid = cid;
  await attempt(p, { op: 'mint', uid: String(A), cid, amount_units: '10000', idempotency_key: `ops:qae:${RUN}:coll:seed` });

  const bal = async (u: bigint) => (await raw(p,
    'SELECT balance, frozen, version FROM account WHERE uid = $1 AND cid = $2', [String(u), cid]))[0];

  // ======================================================= 方向 ①：B 用 A 的派生键
  const keyA = `ops:qae:${RUN}:coll:a`;
  const keyB = `${keyA}#2`;                 // 正是 A 第二分录的派生键

  const balA0 = await bal(A); const balB0 = await bal(B);
  const rA = await attempt(p, {
    op: 'transfer', from_uid: String(A), to_uid: String(B), cid, amount_units: '100',
    idempotency_key: keyA, memo: 'A 的事件',
  });
  const rB = await attempt(p, {
    op: 'transfer', from_uid: String(A), to_uid: String(C), cid, amount_units: '777',
    idempotency_key: keyB, memo: 'B 的事件（完全无关）',
  });
  const balA1 = await bal(A); const balB1 = await bal(B); const balC1 = await bal(C);

  out.direction1 = {
    what: 'B 的 key = A 的派生键（A#2）',
    keyA, keyB,
    A_result: { ok: rA.ok, txid: rA.txid, entries: rA.entries?.map((e) => ({ txid: e.txid, uid: e.uid, delta: e.delta, key: e.idempotency_key })) },
    B_result: { ok: rB.ok, replay: rB.replay, txid: rB.txid, error: rB.error,
      entries: rB.entries?.map((e) => ({ txid: e.txid, uid: e.uid, delta: e.delta, key: e.idempotency_key })) },
    balances: {
      A_before: balA0, A_after: balA1,
      B_before: balB0, B_after: balB1,
      C_before: null, C_after: balC1,
    },
    ledger_rows_for_keyB: await entriesFor(p, keyB),
    ledger_rows_for_keyA: await entriesFor(p, keyA),
    B_event_written: (await entriesFor(p, keyB)).some((r) => (r as Record<string, string>).uid === String(C)),
    verdict: {
      B_reported_success: rB.ok === true,
      B_reported_replay: rB.replay === true,
      B_money_moved: (balC1?.balance ?? '0') !== '0',
      // 若 B 报成功但 B 的业务事件（A→C 777）根本没落账 ⇒ 静默丢弃
      silently_dropped_distinct_event: rB.ok === true && rB.replay === true && (balC1?.balance ?? '0') === '0',
    },
  };

  // ======================================================= 方向 ②：A 撞已有派生键
  const keyP = `ops:qae:${RUN}:coll:p`;
  const keyQ = `ops:qae:${RUN}:coll:p#2`;
  const rP = await attempt(p, {
    op: 'transfer', from_uid: String(A), to_uid: String(B), cid, amount_units: '50',
    idempotency_key: keyQ, memo: 'P：单分录键 = Q#2',
  });
  const balA2 = await bal(A); const balB2 = await bal(B);
  const rQ = await attempt(p, {
    op: 'transfer', from_uid: String(A), to_uid: String(B), cid, amount_units: '50',
    idempotency_key: keyP, memo: 'Q：两分录事件，派生键撞 P',
  });
  const balA3 = await bal(A); const balB3 = await bal(B);

  out.direction2 = {
    what: '先落 key="p#2" 的单条事件，再用 key="p" 落两分录事件（派生键 p#2 撞车）',
    keyP, keyQ,
    P_result: { ok: rP.ok, txid: rP.txid, error: rP.error },
    Q_result: { ok: rQ.ok, txid: rQ.txid, replay: rQ.replay, error: rQ.error },
    balances: { A_before: balA2, A_after: balA3, B_before: balB2, B_after: balB3 },
    ledger_rows_for_keyP: await entriesFor(p, keyP),
    verdict: {
      Q_rejected_with: rQ.error?.code ?? null,
      Q_error_message: rQ.error?.message ?? null,
      Q_error_detail: rQ.error?.detail ?? null,
      Q_is_bogus_conflict: !rQ.ok && rQ.error?.code === 'LD003',
    },
  };

  // ======================================================= 对照：正常形态（无碰撞）
  const keyN1 = `ops:qae:${RUN}:coll:n1`;
  const keyN2 = `ops:qae:${RUN}:coll:n2#2`;   // 与 n1 无关的键
  await attempt(p, { op: 'transfer', from_uid: String(A), to_uid: String(B), cid, amount_units: '7', idempotency_key: keyN1 });
  const rN2 = await attempt(p, { op: 'transfer', from_uid: String(A), to_uid: String(B), cid, amount_units: '7', idempotency_key: keyN2 });
  out.control = { keyN1, keyN2, N2_result: { ok: rN2.ok, replay: rN2.replay, txid: rN2.txid, error: rN2.error } };

  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
