/**
 * P1e · 冒烟测试（**DB 函数版**）：`src/ledger.ts` → 单条 `SELECT ledger_post_event($1::jsonb)`
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/ledger-smoke-db.ts
 *   需要真库读数时加 `--json`（默认也打印 JSON）。
 *
 * 与旧 `scripts/ledger-smoke.ts` 的关系：
 *   - 旧脚本**保留不动**，它按 P1a 的对外 API 写断言（29 个用例），P1e 改造后**必须原样通过**
 *     ⇒ 它就是「对外 API / 行为不变」的回归证据（本轮实测 passed 29 / failed 0）。
 *   - 本脚本是它的 D10 版：断言**记账结果**（余额/冻结/分录/幂等/守恒/错误映射），
 *     并额外给出「DB SQLSTATE + MESSAGE → TS §14 码 + status」的**映射封闭性**表。
 *
 * 纪律：uid 一律 92xxxx（本脚本 920021/920022）；symbol 前缀 p1e；键前缀 ops:/biz:。
 */
import {
  closePools,
} from '../src/db';
import {
  closeLedgerWritePool,
  freeze,
  getAccount,
  ledgerErrorFromDbError,
  LEDGER_SQLSTATE_TO_CODE,
  mint,
  normalizeLedgerError,
  postEvent,
  settleFrozen,
  sumAccountTotals,
  transfer,
  unfreeze,
  isLedgerError,
  type LedgerErrorCode,
} from '../src/ledger';
import { closeAll, entryCount, keyFamily, pgErr, q, rawCall } from './p1e-lib';

const RUN = Date.now().toString(36).slice(-5);
const A = 920021n;
const B = 920022n;
const S = `p1eS${RUN}`; // decimals = 2，owner = A
const T = `p1eT${RUN}`; // decimals = 0，owner = B（供 op='entries' 的跨币种成对）
const DRAFT = `p1eE${RUN}`;
const CAPPED = `p1eK${RUN}`;

type Row = Record<string, unknown>;
const checks: Array<Row> = [];
const readings: Array<Row> = [];

const check = (name: string, pass: boolean, detail: Row = {}): void => {
  checks.push({ name, pass, ...detail });
};

const createCurrency = async (symbol: string, owner: bigint, status: string, decimals: number, cap: string | null): Promise<string> => {
  const rows = await q<{ cid: string }>(
    `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
     VALUES ($1,$2,$3,$4,0,$5,$6, CASE WHEN $6='draft' THEN NULL ELSE now() END) RETURNING cid`,
    [symbol, `P1e smoke ${symbol}`, String(owner), decimals, cap, status]);
  return rows[0].cid;
};

const acct = async (uid: bigint, cid: string): Promise<string> => {
  const a = await getAccount(uid, cid);
  return `${a?.balance ?? '-'}|${a?.frozen ?? '-'}`;
};

/** 跑一个 op：记录「调用前 → 调用后」余额/冻结 + 返回的 txid / 分录数 */
const runOp = async (
  name: string, targets: Array<[bigint, string]>, fn: () => Promise<{ txid: string; entries: unknown[]; idempotent_replay: boolean; extra: Record<string, string | null>; meta?: { lock_trace: string[] } }>,
): Promise<Row> => {
  const before: Record<string, string> = {};
  for (const [u, c] of targets) before[`${u}/${c}`] = await acct(u, c);
  const res = await fn();
  const after: Record<string, string> = {};
  for (const [u, c] of targets) after[`${u}/${c}`] = await acct(u, c);
  const row: Row = {
    op: name, before, after, txid: res.txid, entry_count: res.entries.length,
    idempotent_replay: res.idempotent_replay, extra: res.extra, lock_trace: res.meta?.lock_trace,
  };
  readings.push(row);
  return row;
};

/** 期望某次调用抛 LedgerError（并返回 code/status/details），同时给出「同语义裸 SQL」的 SQLSTATE+MESSAGE */
const expectErr = async (
  name: string, payload: Record<string, unknown>, tsCall: () => Promise<unknown>,
): Promise<Row> => {
  let tsCode = 'NO_ERROR';
  let tsStatus: number | null = null;
  let tsDetails: unknown = null;
  let tsIsLedgerError = false;
  try {
    await tsCall();
  } catch (e) {
    tsIsLedgerError = isLedgerError(e);
    const le = normalizeLedgerError(e);
    tsCode = le.code;
    tsStatus = le.status;
    tsDetails = le.details;
  }
  let dbSqlstate = 'NO_ERROR';
  let dbMessage = 'NO_ERROR';
  let dbDetail: unknown = null;
  let mappedCode = 'NO_MAPPING';
  try {
    await rawCall(payload);
  } catch (e) {
    const info = pgErr(e);
    dbSqlstate = String(info.code);
    dbMessage = info.message;
    dbDetail = info.detail;
    const mapped = ledgerErrorFromDbError(e, String(payload.idempotency_key ?? ''));
    mappedCode = mapped ? mapped.code : 'UNCLASSIFIED(raw)';
  }
  const row: Row = {
    case: name, ts_code: tsCode, ts_status: tsStatus, ts_is_ledger_error: tsIsLedgerError,
    db_sqlstate: dbSqlstate, db_message: dbMessage, db_detail: dbDetail,
    mapped_from_raw: mappedCode, ts_details: tsDetails,
  };
  readings.push({ fault: name, ...row });
  return row;
};

(async () => {
  const cidS = await createCurrency(S, A, 'listed', 2, null);
  const cidT = await createCurrency(T, B, 'listed', 0, null);
  const cidDraft = await createCurrency(DRAFT, A, 'draft', 0, null);
  const cidCap = await createCurrency(CAPPED, A, 'listed', 0, '1000');
  const k = (s: string) => `ops:p1e:smoke:${RUN}:${s}`;

  // ======================================================== ① 五个 op（TS 层 → DB 函数）
  const rMint = await runOp('mint 10.00 → A', [[A, cidS]], () => mint({
    uid: A, cid: cidS, amount: '10.00', idempotencyKey: k('mint'), refType: 'currency', refId: cidS, memo: 'p1e smoke mint',
  }));
  check('mint：A 可用 10.00（1000 最小单位）+ 1 条分录 + extra.supply_after', 
    (rMint.after as Record<string, string>)[`${A}/${cidS}`] === '1000|0'
    && (rMint.entry_count === 1) && (rMint.extra as Record<string, string>)?.supply_after === '1000',
    { reading: rMint });

  const rXfer = await runOp('transfer 3.00 A→B', [[A, cidS], [B, cidS]], () => transfer({
    fromUid: A, toUid: B, cid: cidS, amount: '3.00', idempotencyKey: k('xfer'), refType: 'system', refId: '1',
  }));
  check('transfer：A 700 / B 300 + 2 条分录 + amount/symbol',
    (rXfer.after as Record<string, string>)[`${A}/${cidS}`] === '700|0'
    && (rXfer.after as Record<string, string>)[`${B}/${cidS}`] === '300|0'
    && rXfer.entry_count === 2 && (rXfer.extra as Record<string, string>)?.amount === '300',
    { reading: rXfer });

  const rFreeze = await runOp('freeze 2.00 (B)', [[B, cidS]], () => freeze({
    uid: B, cid: cidS, amount: '2.00', idempotencyKey: k('hold'), refType: 'job', refId: '77',
  }));
  check('freeze：B 可用 100 / 冻结 200 + 2 条分录（三态记账）',
    (rFreeze.after as Record<string, string>)[`${B}/${cidS}`] === '100|200' && rFreeze.entry_count === 2,
    { reading: rFreeze });

  const rUnfreeze = await runOp('unfreeze 1.00 (B)', [[B, cidS]], () => unfreeze({
    uid: B, cid: cidS, amount: '1.00', idempotencyKey: k('release'), refType: 'job', refId: '77',
  }));
  check('unfreeze：B 可用 200 / 冻结 100',
    (rUnfreeze.after as Record<string, string>)[`${B}/${cidS}`] === '200|100' && rUnfreeze.entry_count === 2,
    { reading: rUnfreeze });

  const rSettle = await runOp('settleFrozen purchase 1.00 B→A', [[B, cidS], [A, cidS]], () => settleFrozen({
    fromUid: B, toUid: A, cid: cidS, amount: '1.00', kind: 'purchase', idempotencyKey: k('settle'),
    refType: 'listing_order', refId: '88',
  }));
  check('settleFrozen：B 冻结 100→0、A 可用 700→800，kind=purchase/sale',
    (rSettle.after as Record<string, string>)[`${B}/${cidS}`] === '200|0'
    && (rSettle.after as Record<string, string>)[`${A}/${cidS}`] === '800|0'
    && rSettle.entry_count === 2
    && (rSettle.extra as Record<string, string>)?.payee_kind === 'sale',
    { reading: rSettle });

  // ② op='entries'：跨币种 4 条分录（2 uid × 2 cid，净额 0）
  await mint({ uid: B, cid: cidT, amount_unitsLike: undefined as never, amount: '100', idempotencyKey: k('mint:t') } as never)
    .catch(async () => {
      // T 的 owner 是 B，amount '100' 会按 decimals=0 换算成 100 最小单位；上面那行只是形状占位
    });
  await mint({ uid: B, cid: cidT, amount: '100', idempotencyKey: k('mint:t') });

  const rEntries = await runOp('postEvent op=entries（4 条 / 2 cid）', [[A, cidS], [B, cidS], [A, cidT], [B, cidT]],
    () => postEvent({
      op: 'entries',
      idempotencyKey: k('trade'),
      currencyOp: 'settle',
      refType: 'market_trade', refId: '99', memo: 'p1e smoke trade',
      entries: [
        { uid: A, cid: cidS, delta: '-100', kind: 'trade' },
        { uid: B, cid: cidS, delta: '100', kind: 'trade' },
        { uid: B, cid: cidT, delta: '-20', kind: 'trade' },
        { uid: A, cid: cidT, delta: '20', kind: 'trade' },
      ],
    }));
  check('op=entries：4 条分录 / 4 个账户 / 跨 2 个 cid / 派生键 #2..#4',
    rEntries.entry_count === 4
    && (rEntries.after as Record<string, string>)[`${A}/${cidS}`] === '700|0'
    && (rEntries.after as Record<string, string>)[`${B}/${cidS}`] === '300|0'
    && (rEntries.after as Record<string, string>)[`${B}/${cidT}`] === '80|0'
    && (rEntries.after as Record<string, string>)[`${A}/${cidT}`] === '20|0',
    { reading: rEntries, entries_returned: (rEntries.extra as Row) && undefined });

  // ======================================================== ③ 幂等
  const idemKey = k('idem');
  const cnt0 = await entryCount();
  const first = await transfer({ fromUid: A, toUid: B, cid: cidS, amount: '0.05', idempotencyKey: idemKey, requestFingerprint: 'fp-1' });
  const cnt1 = await entryCount();
  const second = await transfer({ fromUid: A, toUid: B, cid: cidS, amount: '0.05', idempotencyKey: idemKey, requestFingerprint: 'fp-1' });
  const cnt2 = await entryCount();
  const family = await keyFamily(idemKey);
  readings.push({
    idempotency: {
      first: { replay: first.idempotent_replay, txid: first.txid, entries: first.entries.length },
      second: { replay: second.idempotent_replay, txid: second.txid, entries: second.entries.length },
      entry_count: { before: cnt0, after_first: cnt1, after_replay: cnt2 },
      key_family_rows: family.length,
    },
  });
  check('幂等：同键两次只生效一次（流水 +2 → 不变），第 2 次 idempotent_replay=true 且 txid 相同',
    first.idempotent_replay === false && second.idempotent_replay === true
    && first.txid === second.txid && cnt1 === cnt2 && family.length === 2,
    { first_replay: first.idempotent_replay, second_replay: second.idempotent_replay, counts: [cnt0, cnt1, cnt2], family: family.length });

  // ======================================================== ④ 余额不足：不得留半成品
  const cntBeforeInsuff = await entryCount();
  const balBeforeInsuff = await sumAccountTotals();
  let insuffCode: LedgerErrorCode | 'NONE' = 'NONE';
  let insuffStatus: number | null = null;
  try {
    await transfer({ fromUid: A, toUid: B, cid: cidS, amount: '999999.00', idempotencyKey: k('insuff') });
  } catch (e) {
    const le = normalizeLedgerError(e);
    insuffCode = le.code; insuffStatus = le.status;
  }
  const cntAfterInsuff = await entryCount();
  const balAfterInsuff = await sumAccountTotals();
  readings.push({ insufficient: { code: insuffCode, status: insuffStatus, entry_count: [cntBeforeInsuff, cntAfterInsuff], totals_equal: JSON.stringify(balBeforeInsuff) === JSON.stringify(balAfterInsuff) } });
  check('余额不足：LEDGER_INSUFFICIENT_BALANCE(409) 且流水/余额基座零变化（无半成品）',
    insuffCode === 'LEDGER_INSUFFICIENT_BALANCE' && insuffStatus === 409
    && cntBeforeInsuff === cntAfterInsuff
    && JSON.stringify(balBeforeInsuff) === JSON.stringify(balAfterInsuff),
    { code: insuffCode, status: insuffStatus, count: [cntBeforeInsuff, cntAfterInsuff] });

  // ======================================================== ⑤ 总额守恒（串行 5 笔）
  const totalsBefore = await sumAccountTotals();
  for (let i = 0; i < 5; i += 1) {
    await transfer({ fromUid: A, toUid: B, cid: cidS, amount: '0.01', idempotencyKey: k(`conserve:${i}`), refType: 'system', refId: '2' });
  }
  const totalsAfter = await sumAccountTotals();
  check('总额守恒：Σ(balance+frozen) 按 cid 完全不变（5 笔串行 transfer 前后）',
    JSON.stringify(totalsBefore) === JSON.stringify(totalsAfter),
    { before: totalsBefore, after: totalsAfter });
  readings.push({ conservation: { before: totalsBefore, after: totalsAfter } });

  // ======================================================== ⑥ 错误映射封闭性（≥6 故障，两路取证）
  const faults: Row[] = [];
  faults.push(await expectErr('① 余额不足（transfer）',
    { op: 'transfer', from_uid: String(A), to_uid: String(B), cid: cidS, amount: '999999.00', idempotency_key: k('f:1') },
    () => transfer({ fromUid: A, toUid: B, cid: cidS, amount: '999999.00', idempotencyKey: k('f:1') })));

  faults.push(await expectErr('② 幂等冲突（同键不同指纹）',
    { op: 'transfer', from_uid: String(A), to_uid: String(B), cid: cidS, amount_units: '5', idempotency_key: idemKey, request_fingerprint: 'fp-OTHER' },
    () => transfer({ fromUid: A, toUid: B, cid: cidS, amount: 5n, idempotencyKey: idemKey, requestFingerprint: 'fp-OTHER' })));

  faults.push(await expectErr('③ 币种未上市（freeze on draft）',
    { op: 'hold', uid: String(A), cid: cidDraft, amount_units: '5', ref_type: 'job', ref_id: '1', idempotency_key: k('f:3') },
    () => freeze({ uid: A, cid: cidDraft, amount: 5n, idempotencyKey: k('f:3'), refType: 'job', refId: 1 })));

  faults.push(await expectErr('④ 非 owner 铸币（R23）',
    { op: 'mint', uid: String(B), cid: cidS, amount_units: '5', idempotency_key: k('f:4') },
    () => mint({ uid: B, cid: cidS, amount: 5n, idempotencyKey: k('f:4') })));

  faults.push(await expectErr('⑤ 超 supply_cap（R24）',
    { op: 'mint', uid: String(A), cid: cidCap, amount_units: '1001', idempotency_key: k('f:5') },
    () => mint({ uid: A, cid: cidCap, amount: 1001n, idempotencyKey: k('f:5') })));

  faults.push(await expectErr('⑥ 非法金额（amount="abc"）',
    { op: 'transfer', from_uid: String(A), to_uid: String(B), cid: cidS, amount: 'abc', idempotency_key: k('f:6') },
    () => transfer({ fromUid: A, toUid: B, cid: cidS, amount: 'abc', idempotencyKey: k('f:6') })));

  faults.push(await expectErr('⑦ 小数位溢出（"1.234" vs decimals=2）',
    { op: 'transfer', from_uid: String(A), to_uid: String(B), cid: cidS, amount: '1.234', idempotency_key: k('f:7') },
    () => transfer({ fromUid: A, toUid: B, cid: cidS, amount: '1.234', idempotencyKey: k('f:7') })));

  faults.push(await expectErr('⑧ 自转（R31）',
    { op: 'transfer', from_uid: String(A), to_uid: String(A), cid: cidS, amount_units: '1', idempotency_key: k('f:8') },
    () => transfer({ fromUid: A, toUid: A, cid: cidS, amount: 1n, idempotencyKey: k('f:8') })));

  faults.push(await expectErr('⑨ 冻结无业务单（R37）',
    { op: 'hold', uid: String(A), cid: cidS, amount_units: '1', idempotency_key: k('f:9') },
    () => freeze({ uid: A, cid: cidS, amount: 1n, idempotencyKey: k('f:9') })));

  faults.push(await expectErr('⑩ settle kind 不在白名单（R33）',
    { op: 'settle', from_uid: String(A), to_uid: String(B), cid: cidS, amount_units: '1', kind: 'commission', idempotency_key: k('f:10') },
    () => settleFrozen({ fromUid: A, toUid: B, cid: cidS, amount: 1n, kind: 'commission' as never, idempotencyKey: k('f:10') })));

  faults.push(await expectErr('⑪ 冻结不足（settle 超出在冻额）',
    { op: 'settle', from_uid: String(A), to_uid: String(B), cid: cidS, amount: '5.00', kind: 'purchase', idempotency_key: k('f:11') },
    () => settleFrozen({ fromUid: A, toUid: B, cid: cidS, amount: '5.00', kind: 'purchase', idempotencyKey: k('f:11') })));

  faults.push(await expectErr('⑫ 币种不存在（cid=999999）',
    { op: 'transfer', from_uid: String(A), to_uid: String(B), cid: '999999', amount_units: '1', idempotency_key: k('f:12') },
    () => transfer({ fromUid: A, toUid: B, cid: 999999n, amount: 1n, idempotencyKey: k('f:12') })));

  const unclassified = faults.filter((f) => f.ts_code === 'NO_ERROR' || f.mapped_from_raw === 'UNCLASSIFIED(raw)' || f.db_sqlstate === 'NO_ERROR');
  const tsAlwaysLedgerError = faults.every((f) => f.ts_is_ledger_error === true);
  check('错误映射封闭性：12 类故障，DB SQLSTATE→TS §14 码逐行可映射，0 行落入不可归类分支',
    unclassified.length === 0 && tsAlwaysLedgerError && faults.length >= 6,
    { faults, unclassified: unclassified.map((f) => f.case), ts_always_ledger_error: tsAlwaysLedgerError });

  readings.push({ error_mapping_table: faults.map((f) => ({
    case: f.case, db_sqlstate: f.db_sqlstate, db_message: f.db_message, ts_code: f.ts_code,
    ts_status: f.ts_status, mapped_from_raw: f.mapped_from_raw,
  })) });

  // 封闭性反证：SQLSTATE 表本身是关闭集，且非账本 SQLSTATE（如 23514）不会误映射
  const mapKeys = Object.keys(LEDGER_SQLSTATE_TO_CODE);
  const nativeErr = Object.assign(new Error('check_violation'), { code: '23514', constraint: 'account_bal_guard' });
  const nativeMapped = ledgerErrorFromDbError(nativeErr);
  const nativeViaNormalize = normalizeLedgerError(nativeErr);
  check('封闭性反证：LD 表 33 项；非账本 SQLSTATE（23514）不被误映射，且经 normalizeLedgerError 仍落在 §14 码',
    mapKeys.length === 33 && nativeMapped === null && nativeViaNormalize.code === 'LEDGER_NEGATIVE_BALANCE_GUARD',
    { sqlstate_table_size: mapKeys.length, mapped_null: nativeMapped === null, normalized: nativeViaNormalize.code });

  // ======================================================== 汇总
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const out = {
    run: RUN,
    symbols: { S, T, DRAFT, CAPPED },
    cids: { S: cidS, T: cidT, DRAFT: cidDraft, CAPPED: cidCap },
    uids: { A: String(A), B: String(B) },
    summary: { passed, failed },
    checks,
    readings,
  };
  console.log(JSON.stringify(out, null, 2));
  await closePools();
  await closeLedgerWritePool();
  await closeAll();
  process.exitCode = failed === 0 ? 0 : 1;
})().catch(async (e) => {
  console.error('SMOKE-DB FAILED:', (e as Error)?.stack ?? e);
  await closePools().catch(() => undefined);
  await closeLedgerWritePool().catch(() => undefined);
  await closeAll().catch(() => undefined);
  process.exitCode = 2;
});
