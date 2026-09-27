/**
 * P1F-01 · F1【高】幂等派生键碰撞 —— 修复前/修复后同一脚本对比（DB 直调）
 * ============================================================================
 * 复现质检报告 F1 的两个方向（qs 资产不可改；本脚本自建）：
 *   方向①（B 用 A 的派生键）：
 *     A 以 `...:api:a`            落一笔 transfer（2 条分录：`a` / `a#2`）
 *     B 以 `...:api:a#2`          落一笔**完全无关**的 A→C 转账
 *     ⇒ 修前：B 得到 {ok:true, idempotent_replay:true, txid=<A 第 2 条分录的 txid>}
 *             C 余额 0、A 未被多扣 ⇒ **B 的业务事件被静默丢弃却报成功**
 *     ⇒ 修后：B 被 400 `LEDGER_IDEMPOTENCY_KEY_INVALID`(RESERVED_SEPARATOR) 拒收
 *   方向②（A 撞已有派生键）：
 *     先以 `...:p#2` 落单条事件，再以 `...:p` 落两分录事件
 *     ⇒ 修前：第二条分录 INSERT 撞唯一约束 ⇒ LD003 / 409（无关事件被误判冲突）
 *     ⇒ 修后：`#` 键在 C0 被拒（400），正常键事件成功
 *   对照（不得因修复而退回）：
 *     同键重放 ⇒ ok/replay=true/同一 txid/2 条分录；同键异指纹 ⇒ 409 LD003
 *   结构取证：每个事件的全部分录 event_root_key 恒等于其根键（归属列不变量）
 *   包裹性（P1i 收紧）：**7 种 op 形状**的 '#' 键全部 400 LD005/RESERVED_SEPARATOR ——
 *     含第 7 种「payload 级键合法、`#` 藏在 `entries[].idempotency_key`」（修前被静默忽略 ⇒ ok:true）。
 *
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1f-01-f1-collision.ts [--assert]
 *   --assert：断言「修复后」的全部期望成立（修前跑必然红，用于修前基线取证）
 * 测试数据分区：uid 942xxx / symbol 前缀 p1h / 键前缀 ops:p1h:*（920/931/941 已被占）
 */
import {
  mkPool, raw, attempt, ensureCurrency, accountOf, entriesFor,
  rowsExactlyKeyed, hasRootKeyColumn, jstr,
} from './p1f-lib';

const RUN = Date.now().toString(36).toUpperCase();
const SYM = `P1H${RUN}`.slice(0, 12);
const U1 = 942001n, U2 = 942002n, U3 = 942003n;
const K = (s: string) => `ops:p1h:${RUN}:coll:${s}`;
const assertMode = process.argv.includes('--assert');

let CID = '';
const verdicts: Record<string, boolean> = {};
const readings: Record<string, unknown> = {};

const main = async () => {
  const p = mkPool(3);
  const pre = {
    entry_count: String((await raw<{ n: string }>(p, 'SELECT count(*)::text AS n FROM ledger_entry'))[0].n),
    root_column: await hasRootKeyColumn(p),
  };

  CID = await ensureCurrency(p, SYM, U1, 2, 'listed', '100000000000');
  // 播种：owner(U1) 自铸 3,000,000 单位 ⇒ 再分发 1,000,000 给 U2 / U3
  const mintSeed = await attempt(p, {
    op: 'mint', idempotency_key: K('seed:mint'), uid: String(U1), cid: CID, amount_units: '3000000',
  });
  if (!mintSeed.ok) throw new Error(`seed mint failed: ${jstr(mintSeed.error)}`);
  for (const u of [U2, U3]) {
    const r = await attempt(p, {
      op: 'transfer', idempotency_key: K(`seed:xfer:${u}`), from_uid: String(U1), to_uid: String(u),
      cid: CID, amount_units: '1000000',
    });
    if (!r.ok) throw new Error(`seed transfer failed: ${jstr(r.error)}`);
  }
  const bal = async (u: bigint) => (await accountOf(p, u, CID))!.balance;

  // ===================== 方向①：B 用 A 的派生键 =====================
  const keyA = K('a');
  const keyB = `${keyA}#2`;
  const A = await attempt(p, {
    op: 'transfer', idempotency_key: keyA, from_uid: String(U1), to_uid: String(U2),
    cid: CID, amount_units: '1000', memo: 'A event', request_fingerprint: 'fp-A-1',
  });
  const aRows = await entriesFor(p, keyA);
  const aSecondTxid = aRows[1]?.txid ?? null;
  const b0 = { u1: await bal(U1), u2: await bal(U2), u3: await bal(U3) };
  const entriesBefore = await raw<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE uid = $1`, [String(U3)]);
  const B = await attempt(p, {
    op: 'transfer', idempotency_key: keyB, from_uid: String(U1), to_uid: String(U3),
    cid: CID, amount_units: '777', memo: 'B event (unrelated)',
  });
  const b1 = { u1: await bal(U1), u2: await bal(U2), u3: await bal(U3) };
  const entriesAfter = await raw<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE uid = $1`, [String(U3)]);
  const bRowsExactly = await rowsExactlyKeyed(p, keyB);
  const aRowsAfterB = await entriesFor(p, keyA);

  readings.direction1 = {
    A: { ok: A.ok, replay: A.replay, txid: A.txid, entries: A.entries?.length ?? 0 },
    A_rows: aRows.map((r) => ({ txid: r.txid, key: r.idempotency_key, uid: r.uid, delta: r.delta, root: r.event_root_key ?? null })),
    B_payload_key: keyB,
    B: {
      ok: B.ok, replay: B.replay, txid: B.txid,
      error_code: B.error?.code ?? null, error_msg: B.error?.message ?? null,
      error_detail: B.error?.detail ?? null,
    },
    balances: { before: b0, after: b1 },
    u3_entries_before: entriesBefore[0].n, u3_entries_after: entriesAfter[0].n,
    rows_exactly_keyed_B: bRowsExactly.length,
    A_rows_after_B: aRowsAfterB.length,
    B_txid_is_A_second_entry_txid: B.ok && B.txid === aSecondTxid,
    B_silently_dropped_and_reported_success: B.ok === true && B.replay === true && b1.u3 === b0.u3,
    B_rejected_400: !B.ok && (B.error?.code === 'LD005'),
  };

  // ===================== 方向②：先 p#2，再 p =====================
  const keyP = K('p');
  const P2 = await attempt(p, {
    op: 'mint', idempotency_key: `${keyP}#2`, uid: String(U1), cid: CID, amount_units: '7',
  });
  const P = await attempt(p, {
    op: 'transfer', idempotency_key: keyP, from_uid: String(U1), to_uid: String(U2),
    cid: CID, amount_units: '50', memo: 'legit two-entry event',
  });
  readings.direction2 = {
    prefixed_event: { ok: P2.ok, error_code: P2.error?.code ?? null, error_msg: P2.error?.message ?? null },
    legit_event: {
      ok: P.ok, replay: P.replay, txid: P.txid, entries: P.entries?.length ?? 0,
      error_code: P.error?.code ?? null, error_msg: P.error?.message ?? null,
      error_detail: P.error?.detail ?? null,
    },
    legit_event_bogus_conflict_409: !P.ok && P.error?.code === 'LD003',
    legit_event_success: P.ok === true && P.entries?.length === 2,
  };

  // ===================== 对照：同键重放 / 同键异指纹 =====================
  // P1i 修正探针自身的一处时点错误：重放「不双扣」的参照必须取**紧邻重放之前**的余额，
  // 而不是 direction① 结束时（direction② 的合法事件现在会成功 +50，拿旧快照比会假红）。
  const u2BeforeReplays = await bal(U2);
  const A2 = await attempt(p, {
    op: 'transfer', idempotency_key: keyA, from_uid: String(U1), to_uid: String(U2),
    cid: CID, amount_units: '1000', memo: 'A event', request_fingerprint: 'fp-A-1',
  });
  const A3 = await attempt(p, {
    op: 'transfer', idempotency_key: keyA, from_uid: String(U1), to_uid: String(U2),
    cid: CID, amount_units: '1000', memo: 'A event',
    request_fingerprint: 'fp-different-from-first',
  });
  const u2AfterReplays = await bal(U2);
  readings.control = {
    replay_same_key: {
      ok: A2.ok, replay: A2.replay, txid: A2.txid, entries: A2.entries?.length ?? 0,
      same_txid_as_first: A2.txid === A.txid,
      error_code: A2.error?.code ?? null,
    },
    same_key_diff_fingerprint: {
      ok: A3.ok, error_code: A3.error?.code ?? null, error_msg: A3.error?.message ?? null,
    },
    u2_balance_before_replays: u2BeforeReplays,
    u2_balance_after_replays: u2AfterReplays,
    u2_balance_after_direction1: b1.u2,
  };

  // ===================== 包裹性：全部 op 形状的 '#' 键都必须被拒 =====================
  const hashPayloads: Array<[string, Record<string, unknown>]> = [
    ['mint', { op: 'mint', idempotency_key: K('h:mint') + '#2', uid: String(U1), cid: CID, amount_units: '1' }],
    ['transfer', { op: 'transfer', idempotency_key: K('h:transfer') + '#2', from_uid: String(U1), to_uid: String(U2), cid: CID, amount_units: '1' }],
    ['hold', { op: 'hold', idempotency_key: K('h:hold') + '#2', uid: String(U1), cid: CID, amount_units: '1', ref_type: 'job', ref_id: '1' }],
    ['hold_release', { op: 'hold_release', idempotency_key: K('h:rel') + '#2', uid: String(U1), cid: CID, amount_units: '1', ref_type: 'job', ref_id: '1' }],
    ['settle', { op: 'settle', kind: 'purchase', idempotency_key: K('h:settle') + '#2', from_uid: String(U2), to_uid: String(U1), cid: CID, amount_units: '1', ref_type: 'job', ref_id: '1' }],
    ['entries', { op: 'entries', idempotency_key: K('h:entries') + '#2', entries: [
      { uid: String(U1), cid: CID, delta: '-1', kind: 'transfer' },
      { uid: String(U2), cid: CID, delta: '1', kind: 'transfer' },
    ] }],
    // P1i：第 7 种形状 —— payload 级键合法、`#` 藏在 `entries[].idempotency_key` 里。
    // 修前该字段被函数**静默忽略**（⇒ ok:true）；P1i 起键字符集规则作用于**每一个**
    // idempotency_key 位置 ⇒ 本条也必须 400 LD005/RESERVED_SEPARATOR。
    ['entries(entry-level #)', { op: 'entries', idempotency_key: K('h:entries2'), entries: [
      { uid: String(U1), cid: CID, delta: '-1', kind: 'transfer' },
      { uid: String(U2), cid: CID, delta: '1', kind: 'transfer', idempotency_key: `${K('h:inner')}#2` },
    ] }],
  ];
  const hashRej: Record<string, unknown> = {};
  for (const [name, pl] of hashPayloads) {
    const r = await attempt(p, pl);
    hashRej[name] = {
      ok: r.ok, code: r.error?.code ?? null, message: r.error?.message ?? null, detail: r.error?.detail ?? null,
    };
  }
  readings.hash_key_rejection = hashRej;
  // 全部 7 种形状都必须被 400 拒（LD005 + RESERVED_SEPARATOR）
  const hashAllRejected = Object.values(hashRej).every((v) => {
    const vv = v as { ok: boolean; code: string | null; detail: string | null };
    return vv.ok === false && vv.code === 'LD005' && (vv.detail ?? '').includes('RESERVED_SEPARATOR');
  });
  readings.hash_key_rejection_all_400 = hashAllRejected;
  readings.hash_key_rejection_ok_shapes = Object.entries(hashRej)
    .filter(([, v]) => (v as { ok: boolean }).ok === true).map(([k]) => k);

  // ===================== 结构取证：归属列不变量（修前列不存在 ⇒ 读数为 null） =====================
  const rootCol = await hasRootKeyColumn(p);
  const maybe = async (sql: string): Promise<string | null> =>
    rootCol ? String((await raw<{ c: string }>(p, sql))[0].c) : null;
  const post = {
    root_column: rootCol,
    constraint: rootCol
      ? (await raw<{ c: string }>(p, `SELECT count(*)::text AS c FROM pg_constraint WHERE conname = 'ledger_event_root_guard'`))[0].c
      : null,
    null_root_rows: await maybe(`SELECT count(*)::text AS c FROM ledger_entry WHERE event_root_key IS NULL`),
    wrong_root_rows: await maybe(`SELECT count(*)::text AS c FROM ledger_entry WHERE event_root_key IS NOT NULL AND event_root_key <> split_part(idempotency_key, '#'::text, 1)`),
    entry_count: String((await raw<{ n: string }>(p, 'SELECT count(*)::text AS n FROM ledger_entry'))[0].n),
  };
  const newRows = await entriesFor(p, keyA);
  readings.structure = {
    ...post,
    A_rows_all_attributed: newRows.length > 0 && newRows.every((r) => r.event_root_key === keyA),
    A_rows: newRows.map((r) => ({ txid: r.txid, key: r.idempotency_key, root: r.event_root_key ?? null })),
  };

  // ============ 残留（legacy 脏数据）：历史 `#` 派生行 与 新建事件的派生键撞车 ============
  // 用 raw SQL 模拟「0005 之前由旧协议写入的派生化行」（事件根键列 NULL，账号 0/0 起手后按
  // 最新快照抬到 1，以保持 §11 判据 1 与 account_guard 不变式成立）。
  const keyL = K('legacy');
  const U4 = 941009n;
  await raw(p, `INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, $2, 0, 0)`, [String(U4), CID]);
  await raw(p, `INSERT INTO ledger_entry
      (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key, memo)
      VALUES ($1, $2, 1, 0, 1, 0, 'mint', $3, 'legacy simulation (pre-0005 derived row)')`,
    [String(U4), CID, `${keyL}#2`]);
  await raw(p, `UPDATE account SET balance = 1 WHERE uid = $1 AND cid = $2`, [String(U4), CID]);
  const L = await attempt(p, {
    op: 'transfer', idempotency_key: keyL, from_uid: String(U1), to_uid: String(U2),
    cid: CID, amount_units: '3', memo: 'event whose derived key collides with legacy row',
  });
  readings.legacy_collision = {
    legit_event: {
      ok: L.ok, entries: L.entries?.length ?? 0,
      error_code: L.error?.code ?? null, error_msg: L.error?.message ?? null,
      error_detail: L.error?.detail ?? null,
    },
    root_row_written: (await rowsExactlyKeyed(p, keyL)).length,
    legacy_row_still_present: (await rowsExactlyKeyed(p, `${keyL}#2`)).length,
    bogus_409_LD003: !L.ok && L.error?.code === 'LD003',
    loud_defect_LD024: !L.ok && L.error?.code === 'LD024'
      && (L.error?.detail ?? '').includes('derived_key_collision'),
    no_partial_event: (await rowsExactlyKeyed(p, keyL)).length === 0,
  };

  // ===================== verdicts（「修复后」期望） =====================
  verdicts.B_key_rejected_400 = (readings.direction1 as any).B_rejected_400 === true;
  verdicts.B_not_silently_dropped = !(readings.direction1 as any).B_silently_dropped_and_reported_success;
  verdicts.direction1_A_intact = A.ok === true && aRowsAfterB.length === 2;
  verdicts.direction2_hash_key_rejected = !P2.ok && P2.error?.code === 'LD005';
  verdicts.direction2_legit_event_ok = P.ok === true && (P.entries?.length ?? 0) === 2;
  verdicts.replay_same_key_ok = A2.ok === true && A2.replay === true && A2.txid === A.txid && (A2.entries?.length ?? 0) === 2;
  verdicts.replay_diff_fp_409 = !A3.ok && A3.error?.code === 'LD003';
  verdicts.no_double_debit_on_replay = (readings.control as any).u2_balance_after_replays
    === (readings.control as any).u2_balance_before_replays;
  verdicts.all_op_shapes_reject_hash = hashAllRejected;
  verdicts.root_column_present = post.root_column === true;
  verdicts.guard_constraint_present = post.constraint === '1';
  verdicts.attribution_all_consistent = post.wrong_root_rows === '0';
  verdicts.A_rows_attributed_to_root = (readings.structure as any).A_rows_all_attributed === true;
  verdicts.legacy_collision_is_loud_not_bogus_409 =
    (readings.legacy_collision as any).loud_defect_LD024 === true
    && (readings.legacy_collision as any).bogus_409_LD003 === false
    && (readings.legacy_collision as any).no_partial_event === true;

  const failures = Object.entries(verdicts).filter(([, v]) => !v).map(([k]) => k);
  console.log(JSON.stringify({
    probe: 'P1F-01', run: RUN, symbol: SYM, cid: CID,
    pre, readings, verdicts, failures, pass: failures.length === 0,
  }, null, 2));
  await p.end();
  if (assertMode && failures.length) process.exit(1);
};

main().catch((e) => { console.error('PROBE FATAL', e); process.exit(2); });
