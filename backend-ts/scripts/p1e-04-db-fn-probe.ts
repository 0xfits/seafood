/**
 * P1e · **直接调 DB 函数**的探针（不经 TS 服务层）—— D10 连带约束 ④
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1e-04-db-fn-probe.ts
 *
 * 证明：`ledger_post_event(jsonb)` 可被**裸 SQL** 直接调用、断言、判负。
 *   A. 五个 op 各跑一次（mint / transfer / hold / hold_release / settle）+ op=entries（4 条）
 *   B. 幂等：同键两次 ⇒ 只生效一次，第二次 replay=true（键族流水条数不变）
 *   C. R79 加锁全序：meta.lock_trace 原始读数（currency 先于 account / account 按 uid 升序）
 *   D. 判负（绕开 TS）：25 例非法载荷 / 授权 / 余额 / 不变式，全部必须被拒且机读
 *   E. §11 判据 1 / 判据 8（正式形状 + 键族形状）复核，应为 0 行
 *
 * 全部读数为真实库读数；脚本可重复运行（每轮建自己的币，symbol 带 run 后缀）。
 * 纪律：uid 一律 92xxxx；symbol 前缀 p1e；键一律 ops:p1e:*。
 */
import {
  closeAll, accountOf, entryCount, judgement1, judgement8, judgement8ByKey, judgement8Exempt,
  keyFamily, pgErr, q, rawCall, totals,
} from './p1e-lib';

const RUN = Date.now().toString(36).slice(-5);
const OWNER = 920011n;   // p1eR owner / buyer
const PEER = 920012n;    // seller / peer
const OWNER_B = 920013n; // p1eB owner
const R = `p1eR${RUN}`;
const B = `p1eB${RUN}`;
const DRAFT = `p1eD${RUN}`;
const FROZENC = `p1eF${RUN}`;
const DELISTED = `p1eX${RUN}`;
const CAP = `p1eC${RUN}`;

const results: Array<Record<string, unknown>> = [];
const failures: string[] = [];

const rec = (name: string, data: Record<string, unknown>, pass: boolean): void => {
  results.push({ name, ...data, pass });
  if (!pass) failures.push(name);
};

type Brief = Record<string, unknown>;

/** 跑一次直调：成功记结果，失败记原始 PG 错误（SQLSTATE + MESSAGE + DETAIL） */
const attempt = async (payload: Record<string, unknown>): Promise<Brief> => {
  try {
    const r = await rawCall(payload);
    return {
      ok: r.ok, replay: r.idempotent_replay, txid: r.txid,
      entries: (r.entries ?? []).map((e) => ({
        txid: e.txid, uid: e.uid, cid: e.cid, delta: e.delta, frozen_delta: e.frozen_delta,
        balance_after: e.balance_after, frozen_after: e.frozen_after, kind: e.kind, key: e.idempotency_key,
      })),
      accounts: r.accounts, extra: r.extra, lock_trace: r.meta?.lock_trace,
    };
  } catch (e) {
    return { error: pgErr(e) };
  }
};

const errCode = (b: Brief): string => String((b.error as { code?: string } | undefined)?.code ?? 'NO_ERROR');
const errMsg = (b: Brief): string => String((b.error as { message?: string } | undefined)?.message ?? 'NO_ERROR');

const ensureCurrency = async (symbol: string, owner: bigint, status: string, cap: string | null): Promise<string> => {
  const rows = await q<{ cid: string }>(
    `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, CASE WHEN $6 = 'draft' THEN NULL ELSE now() END) RETURNING cid`,
    [symbol, `P1e raw ${symbol}`, String(owner), symbol.startsWith('p1eR') ? 2 : 0, cap, status]);
  return rows[0].cid;
};

const bal = async (uid: bigint, cid: string): Promise<{ balance: string; frozen: string }> => {
  const a = await accountOf(uid, cid);
  return { balance: a?.balance ?? '0', frozen: a?.frozen ?? '0' };
};

/** 前后差值（Δbalance / Δfrozen）读数 */
const delta = async (
  uids: Array<[bigint, string]>, fn: () => Promise<Brief>,
): Promise<{ before: Record<string, string>; after: Record<string, string>; result: Brief }> => {
  const key = async (u: bigint, c: string) => `${u}/${c}`;
  const before: Record<string, string> = {};
  for (const [u, c] of uids) { const b = await bal(u, c); before[await key(u, c)] = `${b.balance}|${b.frozen}`; }
  const result = await fn();
  const after: Record<string, string> = {};
  for (const [u, c] of uids) { const a = await bal(u, c); after[await key(u, c)] = `${a.balance}|${a.frozen}`; }
  return { before, after, result };
};

(async () => {
  const out: Record<string, unknown> = { run: RUN, symbols: { R, B, DRAFT, FROZENC, DELISTED, CAP } };
  const cidR = await ensureCurrency(R, OWNER, 'listed', null);
  const cidB = await ensureCurrency(B, OWNER_B, 'listed', null);
  const cidDraft = await ensureCurrency(DRAFT, OWNER, 'draft', null);
  const cidFrozen = await ensureCurrency(FROZENC, OWNER, 'frozen', null);
  const cidDelisted = await ensureCurrency(DELISTED, OWNER, 'delisted', null);
  const cidCap = await ensureCurrency(CAP, OWNER, 'listed', '1000');
  out.cids = { R: cidR, B: cidB, DRAFT: cidDraft, FROZEN: cidFrozen, DELISTED: cidDelisted, CAP: cidCap };

  const k = (s: string) => `ops:p1e:db:${RUN}:${s}`;

  // ============================================================ A. 五个 op（裸 SQL）
  // A1 金额换算：decimals=2 ⇒ '1.50' → 150 最小单位
  const a1 = await delta([[OWNER, cidR]], () => attempt({
    op: 'mint', uid: String(OWNER), cid: cidR, amount: '1.50', idempotency_key: k('mint:r'),
    memo: 'p1e raw mint', ref_type: 'currency', ref_id: cidR,
  }));
  rec('A1 mint（amount="1.50" → 150）', a1,
    errCode(a1.result) === 'NO_ERROR'
    && a1.after[`${OWNER}/${cidR}`] === '150|0'
    && (a1.result.extra as Record<string, string>)?.supply_after === '150'
    && (a1.result.lock_trace as string[])?.[0] === `currency:${cidR}`);

  // A1b 追加流动性（供后续 op 与 entries 用；100.00 → 10000）
  await attempt({ op: 'mint', uid: String(OWNER), cid: cidR, amount: '100.00', idempotency_key: k('mint:r2') });
  await attempt({ op: 'mint', uid: String(OWNER_B), cid: cidB, amount_units: '100', idempotency_key: k('mint:b') });

  // A2 transfer 0.50 → peer
  const a2 = await delta([[OWNER, cidR], [PEER, cidR]], () => attempt({
    op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '0.50',
    idempotency_key: k('xfer:1'), memo: 'p1e raw transfer', ref_type: 'system', ref_id: '1',
  }));
  rec('A2 transfer（-50/+50，2 条分录）', a2,
    errCode(a2.result) === 'NO_ERROR'
    && (a2.result.entries as unknown[])?.length === 2
    && a2.after[`${OWNER}/${cidR}`] === '10100|0' && a2.after[`${PEER}/${cidR}`] === '50|0');

  // A3 hold 1.00（可用 → 冻结）
  const a3 = await delta([[OWNER, cidR]], () => attempt({
    op: 'hold', uid: String(OWNER), cid: cidR, amount: '1.00', idempotency_key: k('hold:1'),
    memo: 'p1e raw hold', ref_type: 'job', ref_id: '11',
  }));
  rec('A3 hold（balance-100 / frozen+100，2 条分录）', a3,
    errCode(a3.result) === 'NO_ERROR'
    && (a3.result.entries as unknown[])?.length === 2
    && a3.after[`${OWNER}/${cidR}`] === '10000|100');

  // A4 settle purchase 1.00（冻结直接支付给对方）
  const a4 = await delta([[OWNER, cidR], [PEER, cidR]], () => attempt({
    op: 'settle', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '1.00',
    kind: 'purchase', idempotency_key: k('settle:1'), memo: 'p1e raw settle', ref_type: 'listing_order', ref_id: '21',
  }));
  rec('A4 settle purchase（frozen-100 / peer+100，kind=purchase+sale）', a4,
    errCode(a4.result) === 'NO_ERROR'
    && (a4.result.entries as Array<Record<string, string>>)?.map((e) => e.kind).sort().join(',') === 'purchase,sale'
    && a4.after[`${OWNER}/${cidR}`] === '10000|0' && a4.after[`${PEER}/${cidR}`] === '150|0');

  // A5 hold + hold_release（冻结 → 可用）
  await attempt({ op: 'hold', uid: String(PEER), cid: cidR, amount: '0.20', idempotency_key: k('hold:2'), ref_type: 'market_order', ref_id: '31' });
  const a5 = await delta([[PEER, cidR]], () => attempt({
    op: 'hold_release', uid: String(PEER), cid: cidR, amount: '0.20', idempotency_key: k('release:1'),
    ref_type: 'market_order', ref_id: '31',
  }));
  rec('A5 hold_release（frozen-20 / balance+20）', a5,
    errCode(a5.result) === 'NO_ERROR'
    && a5.after[`${PEER}/${cidR}`] === '150|0'
    && (a5.result.entries as Array<Record<string, string>>)?.some((e) => e.frozen_delta === '-20'));

  // A6 op=entries：交易所成交形状 4 条分录（2 uid × 2 cid，净额 0）；B 币先给 PEER 5 个
  await attempt({ op: 'transfer', from_uid: String(OWNER_B), to_uid: String(PEER), cid: cidB, amount_units: '5', idempotency_key: k('xfer:b') });
  const a6 = await delta([[OWNER, cidR], [PEER, cidR], [OWNER, cidB], [PEER, cidB]], () => attempt({
    op: 'entries', idempotency_key: k('trade:1'), currency_op: 'settle', memo: 'p1e raw trade',
    ref_type: 'market_trade', ref_id: '41',
    entries: [
      { uid: String(OWNER), cid: cidR, delta: '-1000', kind: 'trade' },
      { uid: String(PEER), cid: cidR, delta: '1000', kind: 'trade' },
      { uid: String(PEER), cid: cidB, delta: '-5', kind: 'trade' },
      { uid: String(OWNER), cid: cidB, delta: '5', kind: 'trade' },
    ],
  }));
  const a6keys = (a6.result.entries as Array<Record<string, string>>)?.map((e) => e.key) ?? [];
  rec('A6 op=entries（4 条 / 2 cid / 派生键 #2..#4）', a6,
    errCode(a6.result) === 'NO_ERROR'
    && a6keys.length === 4
    && a6keys.join('|') === [k('trade:1'), `${k('trade:1')}#2`, `${k('trade:1')}#3`, `${k('trade:1')}#4`].join('|')
    && a6.after[`${OWNER}/${cidR}`] === '9000|0' && a6.after[`${PEER}/${cidR}`] === '1150|0'
    && a6.after[`${PEER}/${cidB}`] === '0|0' && a6.after[`${OWNER}/${cidB}`] === '5|0');

  out.accounts_after_ops = {
    [`${OWNER}/${cidR}`]: await accountOf(OWNER, cidR),
    [`${PEER}/${cidR}`]: await accountOf(PEER, cidR),
    [`${OWNER}/${cidB}`]: await accountOf(OWNER, cidB),
    [`${PEER}/${cidB}`]: await accountOf(PEER, cidB),
    [`${OWNER_B}/${cidB}`]: await accountOf(OWNER_B, cidB),
  };

  // ============================================================ B. 幂等（DB 层）
  const idemKey = k('idem:transfer');
  const idemPayload = {
    op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount_units: '7',
    idempotency_key: idemKey, request_fingerprint: 'fp-same',
  };
  const cntBefore = await entryCount();
  const first = await attempt(idemPayload);
  const cntAfter1 = await entryCount();
  const second = await attempt(idemPayload);
  const cntAfter2 = await entryCount();
  const family = await keyFamily(idemKey);
  const conflict = await attempt({ ...idemPayload, request_fingerprint: 'fp-different' });
  rec('B 幂等（同键两次只生效一次 + 幂等冲突）', {
    first: { replay: first.replay, txid: first.txid, entries: (first.entries as unknown[])?.length, error: first.error ?? null },
    second: { replay: second.replay, txid: second.txid, entries: (second.entries as unknown[])?.length, error: second.error ?? null },
    counts: { before: cntBefore, after_first: cntAfter1, after_replay: cntAfter2 },
    key_family_rows: family.length,
    fingerprint_conflict: { code: errCode(conflict), message: errMsg(conflict), detail: (conflict.error as Record<string, unknown>)?.detail },
  }, first.replay === false && second.replay === true && cntAfter1 === cntAfter2
     && family.length === 2 && second.txid === first.txid && errCode(conflict) === 'LD003');

  // ============================================================ C. R79 加锁全序取证
  const traceMint = await attempt({ op: 'mint', uid: String(OWNER), cid: cidR, amount_units: '1', idempotency_key: k('trace:mint') });
  const traceXfer = await attempt({
    op: 'transfer', from_uid: String(PEER), to_uid: String(OWNER), cid: cidR, amount_units: '1',
    idempotency_key: k('trace:xfer'),
  });
  rec('C R79 加锁全序（currency 先于 account；account 按 uid 升序，与传入顺序无关）', {
    mint_lock_trace: traceMint.lock_trace,
    transfer_lock_trace_payload_order_is_peer_then_owner: traceXfer.lock_trace,
  }, (traceMint.lock_trace as string[])?.[0] === `currency:${cidR}`
     && (traceMint.lock_trace as string[])?.[1] === `account:${OWNER}:${cidR}`
     && (traceXfer.lock_trace as string[])?.[0] === `account:${OWNER}:${cidR}`
     && (traceXfer.lock_trace as string[])?.[1] === `account:${PEER}:${cidR}`);

  // ============================================================ D. 判负（绕开 TS）
  const f: Record<string, Brief | Record<string, unknown>> = {};

  f.unknown_op = await attempt({ op: 'nope', idempotency_key: k('f:op') });
  f.key_missing = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount_units: '1' });
  f.key_prefix_invalid = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount_units: '1', idempotency_key: 'nope:1' });
  f.amount_not_decimal = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: 'abc', idempotency_key: k('f:a1') });
  f.amount_zero = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '0', idempotency_key: k('f:a2') });
  f.amount_negative = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '-1', idempotency_key: k('f:a6') });
  f.decimals_overflow = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '1.234', idempotency_key: k('f:a3') });
  f.amount_json_number = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: 1, idempotency_key: k('f:a4') });
  f.amount_over_max = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount_units: '99999999999999999', idempotency_key: k('f:a5') });
  const cntB = await entryCount();
  f.insufficient_balance = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '999999.00', idempotency_key: k('f:bal') });
  const cntA = await entryCount();
  f.insufficient_frozen = await attempt({ op: 'settle', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount: '5.00', kind: 'purchase', idempotency_key: k('f:frz') });
  f.hold_on_draft_not_listed = await attempt({ op: 'hold', uid: String(OWNER), cid: cidDraft, amount_units: '1', ref_type: 'job', ref_id: '1', idempotency_key: k('f:draft') });
  f.mint_on_frozen_currency = await attempt({ op: 'mint', uid: String(OWNER), cid: cidFrozen, amount_units: '1', idempotency_key: k('f:frozen') });
  f.hold_on_delisted = await attempt({ op: 'hold', uid: String(OWNER), cid: cidDelisted, amount_units: '1', ref_type: 'job', ref_id: '1', idempotency_key: k('f:delisted') });
  f.unauthorized_mint = await attempt({ op: 'mint', uid: String(PEER), cid: cidR, amount_units: '1', idempotency_key: k('f:mint') });
  f.supply_cap_exceeded = await attempt({ op: 'mint', uid: String(OWNER), cid: cidCap, amount_units: '1001', idempotency_key: k('f:cap') });
  f.dollar_mint_without_platform = await attempt({ op: 'mint', uid: String(OWNER), cid: '1', amount_units: '1', idempotency_key: k('f:dollar') });
  f.self_transfer = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(OWNER), cid: cidR, amount_units: '1', idempotency_key: k('f:self') });
  f.platform_debit_forbidden = await attempt({ op: 'transfer', from_uid: '-1', to_uid: String(PEER), cid: cidR, amount_units: '1', idempotency_key: k('f:plat') });
  f.platform_credit_forbidden = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: '-2', cid: cidR, amount_units: '1', idempotency_key: k('f:plat2') });
  f.entries_unbalanced = await attempt({
    op: 'entries', idempotency_key: k('f:unbal'),
    entries: [{ uid: String(OWNER), cid: cidR, delta: '100', kind: 'trade' }],
  });
  f.entries_both_zero = await attempt({
    op: 'entries', idempotency_key: k('f:zero'),
    entries: [{ uid: String(OWNER), cid: cidR, delta: '0', frozen_delta: '0', kind: 'trade' }],
  });
  f.entries_unknown_kind = await attempt({
    op: 'entries', idempotency_key: k('f:kind'),
    entries: [{ uid: String(OWNER), cid: cidR, delta: '5', kind: 'made_up_kind' }],
  });
  f.entries_hold_pair_broken = await attempt({
    op: 'entries', idempotency_key: k('f:holdpair'),
    entries: [{ uid: String(OWNER), cid: cidR, delta: '-5', kind: 'hold' }],
  });
  f.bad_uid = await attempt({ op: 'transfer', from_uid: 'abc', to_uid: String(PEER), cid: cidR, amount_units: '1', idempotency_key: k('f:uid') });
  f.bad_cid = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: '999999', amount_units: '1', idempotency_key: k('f:cid') });
  f.ref_pair_mismatch = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount_units: '1', ref_type: 'job', idempotency_key: k('f:ref') });
  f.ref_type_not_in_whitelist = await attempt({ op: 'transfer', from_uid: String(OWNER), to_uid: String(PEER), cid: cidR, amount_units: '1', ref_type: 'bogus', ref_id: '1', idempotency_key: k('f:ref2') });
  f.hold_without_business_ref = await attempt({ op: 'hold', uid: String(OWNER), cid: cidR, amount_units: '1', idempotency_key: k('f:hold') });
  f.reversal_guard = await attempt({
    op: 'entries', idempotency_key: k('f:rev'),
    entries: [{ uid: String(OWNER), cid: cidR, delta: '5', kind: 'reversal' }],
  });
  f.too_many_entries = await attempt({
    op: 'entries', idempotency_key: k('f:many'),
    entries: Array.from({ length: 33 }, (_, i) => ({ uid: String(OWNER), cid: cidR, delta: i % 2 === 0 ? '1' : '-1', kind: 'trade' })),
  });
  // §19.1 例外：-3 允许以 transfer 出账 ⇒ 过白名单后在余额处被拦（不是白名单拒绝）
  f.forfeit_pool_transfer_allowed_then_balance = await attempt({
    op: 'transfer', from_uid: '-3', to_uid: String(PEER), cid: cidR, amount_units: '1', idempotency_key: k('f:plat3'),
  });

  const codes = Object.fromEntries(
    Object.entries(f).map(([name, v]) => [name, v && (v as Brief).error ? errCode(v as Brief) : 'NO_ERROR']),
  );
  const expected: Record<string, string> = {
    unknown_op: 'LD016', key_missing: 'LD004', key_prefix_invalid: 'LD005',
    amount_not_decimal: 'LD016', amount_zero: 'LD017', amount_negative: 'LD017',
    decimals_overflow: 'LD018', amount_json_number: 'LD016', amount_over_max: 'LD016',
    insufficient_balance: 'LD001', insufficient_frozen: 'LD002',
    hold_on_draft_not_listed: 'LD008', mint_on_frozen_currency: 'LD009', hold_on_delisted: 'LD010',
    unauthorized_mint: 'LD014', supply_cap_exceeded: 'LD013', dollar_mint_without_platform: 'LD014',
    self_transfer: 'LD019', platform_debit_forbidden: 'LD021', platform_credit_forbidden: 'LD021',
    entries_unbalanced: 'LD016', entries_both_zero: 'LD016', entries_unknown_kind: 'LD023',
    entries_hold_pair_broken: 'LD016', bad_uid: 'LD016', bad_cid: 'LD007',
    ref_pair_mismatch: 'LD016', ref_type_not_in_whitelist: 'LD016',
    hold_without_business_ref: 'LD015', reversal_guard: 'LD016', too_many_entries: 'LD016',
    forfeit_pool_transfer_allowed_then_balance: 'LD001',
  };
  const mismatches = Object.entries(expected).filter(([n, c]) => codes[n] !== c);
  rec('D 判负（30 例，全部被拒且 SQLSTATE 与预期一致）', {
    cases: Object.keys(f).length,
    codes,
    mismatches,
    entry_count_before_insufficient: cntB,
    entry_count_after_insufficient: cntA,
  }, mismatches.length === 0 && cntA === cntB);

  out.falsify = Object.fromEntries(Object.entries(f).map(([name, v]) => {
    const b = v as Brief;
    const e = b.error as Record<string, unknown> | undefined;
    return [name, e ? { sqlstate: e.code, message: e.message, detail: e.detail } : { result: b }];
  }));

  // ============================================================ E. §11 判据 1 / 8
  const j1 = await judgement1();
  const j8 = await judgement8();
  const j8k = await judgement8ByKey();
  const j8e = await judgement8Exempt();
  out.judgement1_rows = j1;
  out.judgement8_rows = j8;
  out.judgement8_by_key_rows = j8k;
  out.judgement8_exempt_face = j8e;
  out.totals_900xxx = await totals();
  out.entry_count_total = await entryCount();
  rec('E 判据 1（0 行）', { rows: j1.length }, j1.length === 0);
  rec('E 判据 8 正式形状（0 行）', { rows: j8.length }, j8.length === 0);
  rec('E 判据 8 键族形状（0 行）', { rows: j8k.length }, j8k.length === 0);

  out.results = results;
  out.failures = failures;
  console.log(JSON.stringify(out, null, 2));
  await closeAll();
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closeAll().catch(() => undefined);
  process.exit(1);
});
