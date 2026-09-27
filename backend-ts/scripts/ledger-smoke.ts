/**
 * P1a 最小自测 · 账本服务层（真实库读数）
 * ============================================================================
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/ledger-smoke.ts
 * 退出码：0 = 全部断言通过；1 = 存在失败断言（明细见输出里的 checks）
 *
 * 覆盖（对应 brief 的四条必跑验收）：
 *   ① 五个高层动作各跑一次，逐个给「调用前 / 调用后」余额与冻结读数
 *   ② 幂等实测：同一 idempotencyKey 调两次 ⇒ 流水条数只 +1，第二次 idempotent_replay = true
 *   ③ 余额不足实测：报错码 + 前后行数不变（不留半成品）
 *   ④ 最小总额守恒：一串串行转账后 Σ(balance + frozen) 与初始相等
 *   附：DB 层兜底探针（负余额 CHECK / account 守卫 trigger / append-only trigger）
 *       + mint 的授权、供给上限、decimals 校验（R23/R24/R72）
 *
 * 测试数据：uid 900001..900003（真实用户区，勿与生产 uid 冲突）；
 *           每次运行新建 1 个自建单位（symbol = smk<run>），账本 append-only ⇒ 数据只增不删。
 */
import { closePools, readQuery, txQuery, withTransaction } from '../src/db';
import {
  LedgerError,
  LedgerOpResult,
  assertBalanced,
  findAccountDrift,
  freeze,
  getAccount,
  getCurrency,
  getSystemCurrency,
  listEntriesByAccount,
  mint,
  settleFrozen,
  sumAccountTotals,
  toErrorResponse,
  transfer,
  unfreeze,
} from '../src/ledger';

const CID = '1';
const A = '900001';
const B = '900002';
const C = '900003';
const RUN = Date.now().toString(36).slice(-7);

interface Check { name: string; pass: boolean; detail: string }
const checks: Check[] = [];
const steps: Array<Record<string, unknown>> = [];

const check = (name: string, pass: boolean, detail: string | number | boolean): void => {
  checks.push({ name, pass, detail: String(detail) });
};

const key = (suffix: string): string => `ops:smoke:${RUN}:${suffix}`;

const bal = async (uid: string, cid = CID): Promise<{ balance: string; frozen: string } | null> => {
  const a = await getAccount(uid, cid);
  return a ? { balance: a.balance, frozen: a.frozen } : null;
};

const snapshot = async (uids: string[], cid = CID): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  for (const u of uids) out[u] = await bal(u, cid);
  return out;
};

const brief = (r: LedgerOpResult): Record<string, unknown> => ({
  txid: r.txid,
  idempotent_replay: r.idempotent_replay,
  idempotency_key: r.idempotency_key,
  entries: r.entries.map((e) => ({
    txid: e.txid, uid: e.uid, kind: e.kind, delta: e.delta, frozen_delta: e.frozen_delta,
    balance_after: e.balance_after, frozen_after: e.frozen_after, key: e.idempotency_key, ref: `${e.ref_type}:${e.ref_id}`,
  })),
  accounts: r.accounts,
  extra: r.extra,
});

/** 前后读数的相对变化（脚本可重复跑：断言只看 delta，不看绝对值） */
const deltaOf = (
  before: Record<string, unknown>, after: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(after ?? {})) {
    const b = before?.[k] as { balance: string; frozen: string } | null;
    const a = after?.[k] as { balance: string; frozen: string } | null;
    out[k] = a === null ? null : {
      balance: a.balance,
      frozen: a.frozen,
      d_balance: b ? String(BigInt(a.balance) - BigInt(b.balance)) : a.balance,
      d_frozen: b ? String(BigInt(a.frozen) - BigInt(b.frozen)) : a.frozen,
    };
  }
  return out;
};

/** 记录一次「动作前后」读数 */
const runStep = async (
  name: string, uids: string[], fn: () => Promise<LedgerOpResult>, cid = CID,
): Promise<{ result: LedgerOpResult; delta: Record<string, unknown> }> => {
  const before = await snapshot(uids, cid);
  const r = await fn();
  const after = await snapshot(uids, cid);
  const delta = deltaOf(before, after);
  steps.push({ step: name, before, after, delta, result: brief(r) });
  return { result: r, delta };
};

/** 捕获期望的错误 */
const expectError = async (fn: () => Promise<unknown>): Promise<{ code: string; status: number | null; message: string; response: unknown; raw: string }> => {
  try {
    await fn();
    throw new Error('EXPECTED_ERROR_NOT_THROWN');
  } catch (e) {
    if (e instanceof Error && e.message === 'EXPECTED_ERROR_NOT_THROWN') throw e;
    if (e instanceof LedgerError) {
      return { code: e.code, status: e.status, message: e.message, response: toErrorResponse(e), raw: e.message };
    }
    const err = e as { code?: unknown; message?: unknown; constraint?: unknown };
    return {
      code: String(err?.code ?? 'UNKNOWN'),
      status: null,
      message: String(err?.message ?? ''),
      response: null,
      raw: String(err?.constraint ?? ''),
    };
  }
};

const countKeys = async (keys: string[]): Promise<string> => {
  const r = await readQuery<{ c: string }>(
    'SELECT count(*)::int AS c FROM ledger_entry WHERE idempotency_key = ANY($1::text[])',
    [keys],
  );
  return String(r[0]?.c ?? '0');
};

const main = async (): Promise<number> => {
  // ---------------------------------------------------------------- 0. 币种读接口
  const sys = await getSystemCurrency();
  check('R2 系统币 cid=1 / symbol=$ / owner_uid=0', sys?.cid === '1' && sys?.symbol === '$' && sys?.owner_uid === '0',
    JSON.stringify({ cid: sys?.cid, symbol: sys?.symbol, owner_uid: sys?.owner_uid, status: sys?.status, supply_cap: sys?.supply_cap, decimals: sys?.decimals }));
  steps.push({ step: 'getSystemCurrency()', result: sys });

  // ---------------------------------------------------------------- 1. mint
  const mintKey = key('mint');
  const mintStep = await runStep(`mint 1000 $ → uid ${A}（platform=true）`, [A], () => mint({
    uid: A, cid: CID, amount: '1000', idempotencyKey: mintKey, platform: true,
    refType: 'system', refId: 1, memo: 'smoke mint',
  }));
  const mintRes = mintStep.result;
  check('mint 落 1 条分录且可用余额 +1000',
    mintRes.entries.length === 1 && mintRes.entries[0].delta === '1000'
    && String((mintStep.delta[A] as Record<string, string>).d_balance) === '1000',
    `entries=${mintRes.entries.map((e) => `${e.kind} d=${e.delta}`).join('|')} delta=${JSON.stringify(mintStep.delta[A])}`);
  const sysAfterMint = await getSystemCurrency();
  check('R9 total_supply 与分录同事务双写（+1000）',
    BigInt(sysAfterMint?.total_supply ?? '0') - BigInt(sys?.total_supply ?? '0') === 1000n
    && sysAfterMint?.total_supply === mintRes.extra.supply_after,
    `total_supply ${sys?.total_supply}→${sysAfterMint?.total_supply}（extra ${mintRes.extra.supply_before}→${mintRes.extra.supply_after}）`);

  // 给 C 一笔启动资金（后续「幂等」用例由 C 发起转账）
  await runStep(`mint 200 $ → uid ${C}（幂等用例的发起方需要余额）`, [C], () => mint({
    uid: C, cid: CID, amount: '200', idempotencyKey: key('mint-c'), platform: true, refType: 'system', refId: 9,
  }));

  // ---------------------------------------------------------------- 2. transfer
  const tfKey = key('transfer');
  const tfStep = await runStep(`transfer 300 $ : ${A} → ${B}`, [A, B], () => transfer({
    fromUid: A, toUid: B, cid: CID, amount: '300', idempotencyKey: tfKey, refType: 'system', refId: 2,
  }));
  const tfRes = tfStep.result;
  check('transfer 写 2 条分录（减方/增方各一）且净额 0', tfRes.entries.length === 2
    && tfRes.entries[0].delta === '-300' && tfRes.entries[1].delta === '300',
    tfRes.entries.map((e) => `uid=${e.uid} d=${e.delta}`).join(' | '));

  // ---------------------------------------------------------------- 3. freeze
  const fzKey = key('freeze');
  const fzStep = await runStep(`freeze 100 $ : uid ${A}（ref=market_order:900001）`, [A], () => freeze({
    uid: A, cid: CID, amount: '100', idempotencyKey: fzKey, refType: 'market_order', refId: 900001, memo: 'smoke hold',
  }));
  const fzRes = fzStep.result;
  check('hold = 同账户 2 条分录（−可用 / +冻结）', fzRes.entries.length === 2
    && fzRes.entries[0].delta === '-100' && fzRes.entries[1].frozen_delta === '100',
    fzRes.entries.map((e) => `d=${e.delta} f=${e.frozen_delta} => ${e.balance_after}/${e.frozen_after}`).join(' | '));
  const holdAssertion = assertBalanced([
    { delta: '-100', frozenDelta: '0', kind: 'hold' },
    { delta: '0', frozenDelta: '100', kind: 'hold' },
  ]);
  check('R41 配对不变式（hold 形态：Σdelta=−n、Σfrozen=+n、Σ净值=0）',
    holdAssertion.net_sum === '0' && holdAssertion.delta_sum === '-100' && holdAssertion.frozen_delta_sum === '100',
    JSON.stringify(holdAssertion));

  // ---------------------------------------------------------------- 4. unfreeze
  const uzKey = key('unfreeze');
  const uzStep = await runStep(`unfreeze 40 $ : uid ${A}`, [A], () => unfreeze({
    uid: A, cid: CID, amount: '40', idempotencyKey: uzKey, refType: 'market_order', refId: 900001, memo: 'smoke release',
  }));
  const uzRes = uzStep.result;
  check('hold_release = 2 条分录（−冻结 / +可用）', uzRes.entries.length === 2
    && uzRes.entries[0].frozen_delta === '-40' && uzRes.entries[1].delta === '40',
    uzRes.entries.map((e) => `d=${e.delta} f=${e.frozen_delta} => ${e.balance_after}/${e.frozen_after}`).join(' | '));

  // ---------------------------------------------------------------- 5. settleFrozen
  const stKey = key('settle');
  const stStep = await runStep(`settleFrozen 60 $ : ${A}(冻结) → ${B}(可用)，kind=job_payout`, [A, B], () => settleFrozen({
    fromUid: A, toUid: B, cid: CID, amount: '60', kind: 'job_payout', idempotencyKey: stKey,
    refType: 'job', refId: 900001, memo: 'smoke settle',
  }));
  const stRes = stStep.result;
  check('settleFrozen 减方只动 frozen、不动 balance（R15 双字段的存在理由）',
    stRes.entries[0].delta === '0' && stRes.entries[0].frozen_delta === '-60' && stRes.entries[1].delta === '60',
    stRes.entries.map((e) => `uid=${e.uid} d=${e.delta} f=${e.frozen_delta}`).join(' | '));

  // ---------------------------------------------------------------- 6. 幂等
  const idemKey = key('idem');
  const idemProps = {
    fromUid: C, toUid: A, cid: CID, amount: '25', idempotencyKey: idemKey,
    refType: 'system' as const, refId: 3, requestFingerprint: 'fp-25',
  };
  const idemCountBefore = await countKeys([idemKey, `${idemKey}#2`]);
  const first = await transfer(idemProps);
  const idemCountAfter1 = await countKeys([idemKey, `${idemKey}#2`]);
  const second = await transfer(idemProps);
  const idemCountAfter2 = await countKeys([idemKey, `${idemKey}#2`]);
  const balCA = await snapshot([A, C]);
  check('幂等：同键两次 ⇒ 流水只 +1（第二次不再写）', idemCountAfter1 === idemCountAfter2 && idemCountAfter1 !== idemCountBefore,
    `rows=[${idemKey}, #2] before=${idemCountBefore} after1st=${idemCountAfter1} after2nd=${idemCountAfter2}`);
  check('幂等：第二次返回 idempotent_replay=true 且 txid 与首次相同',
    first.idempotent_replay === false && second.idempotent_replay === true && first.txid === second.txid,
    `1st={txid:${first.txid},replay:${first.idempotent_replay}} 2nd={txid:${second.txid},replay:${second.idempotent_replay}}`);
  steps.push({
    step: '幂等：同一 key 调两次', idem_count_before: idemCountBefore, idem_count_after_1st: idemCountAfter1,
    idem_count_after_2nd: idemCountAfter2, balances: balCA, first: brief(first), second: brief(second),
  });
  const conflict = await expectError(() => transfer({ ...idemProps, requestFingerprint: 'fp-99' }));
  check('R52②：同键不同指纹 ⇒ 409 LEDGER_IDEMPOTENCY_CONFLICT', conflict.code === 'LEDGER_IDEMPOTENCY_CONFLICT' && conflict.status === 409,
    JSON.stringify(conflict));
  const nullFp = await transfer({
    fromUid: C, toUid: A, cid: CID, amount: '99', idempotencyKey: idemKey, refType: 'system', refId: 3,
  });
  check('R53：未带指纹 ⇒ 「同键即重放」（即便金额不同也不 409）',
    nullFp.idempotent_replay === true && nullFp.txid === first.txid, `replay=${nullFp.idempotent_replay} txid=${nullFp.txid}`);
  const badKey = await expectError(() => transfer({ fromUid: C, toUid: A, cid: CID, amount: '1', idempotencyKey: 'noprefix-1' }));
  const missingKey = await expectError(() => transfer({ fromUid: C, toUid: A, cid: CID, amount: '1', idempotencyKey: '' }));
  check('R49 前缀强制 / R52③ 缺键', badKey.code === 'LEDGER_IDEMPOTENCY_KEY_INVALID' && missingKey.code === 'LEDGER_IDEMPOTENCY_KEY_REQUIRED',
    `${badKey.code} / ${missingKey.code}`);

  // ---------------------------------------------------------------- 7. 余额不足
  const insuffKey = key('insufficient');
  const rowsBeforeInsuff = await countKeys([insuffKey, `${insuffKey}#2`]);
  const beforeInsuff = await snapshot([A, B]);
  const insuff = await expectError(() => transfer({
    fromUid: A, toUid: B, cid: CID, amount: '1000000000000000', idempotencyKey: insuffKey, refType: 'system', refId: 4,
  }));
  const rowsAfterInsuff = await countKeys([insuffKey, `${insuffKey}#2`]);
  const afterInsuff = await snapshot([A, B]);
  check('余额不足 ⇒ 409 LEDGER_INSUFFICIENT_BALANCE', insuff.code === 'LEDGER_INSUFFICIENT_BALANCE' && insuff.status === 409, JSON.stringify(insuff));
  check('余额不足 ⇒ 流水 0 条、双方余额不变（无半成品）',
    rowsBeforeInsuff === rowsAfterInsuff && rowsAfterInsuff === '0'
    && JSON.stringify(beforeInsuff) === JSON.stringify(afterInsuff),
    `rows=${rowsBeforeInsuff}→${rowsAfterInsuff} balances=${JSON.stringify(beforeInsuff)}→${JSON.stringify(afterInsuff)}`);
  steps.push({
    step: '余额不足（A → B 1e15 $）', rows_before: rowsBeforeInsuff, rows_after: rowsAfterInsuff,
    balances_before: beforeInsuff, balances_after: afterInsuff, error: insuff,
  });

  // ---------------------------------------------------------------- 8. 总额守恒（串行转账）
  const totalsBefore = await sumAccountTotals();
  const seq: Array<Record<string, string>> = [];
  const plan: Array<[string, string, string]> = [[A, B, '10'], [B, C, '20'], [C, A, '30'], [A, C, '5'], [C, B, '7'],
    [B, A, '11'], [A, B, '13'], [B, C, '17'], [C, A, '19'], [A, B, '23']];
  for (let i = 0; i < plan.length; i += 1) {
    const [f, t, amt] = plan[i];
    const r = await transfer({ fromUid: f, toUid: t, cid: CID, amount: amt, idempotencyKey: key(`seq${i}`), refType: 'system', refId: 100 + i });
    seq.push({ step: `${f}→${t} ${amt}$`, txid: r.txid });
  }
  const totalsAfter = await sumAccountTotals();
  const beforeNet = totalsBefore.map((r) => Number(r.total_net)).reduce((a, b) => a + b, 0);
  const afterNet = totalsAfter.map((r) => Number(r.total_net)).reduce((a, b) => a + b, 0);
  check('总额守恒：10 笔串行转账后 Σ(balance+frozen) 不变', beforeNet === afterNet,
    `before=${JSON.stringify(totalsBefore)} after=${JSON.stringify(totalsAfter)}`);
  const drift = await findAccountDrift();
  check('§11 判据1 账户级守恒（balance=Σdelta / frozen=Σfrozen_delta）无差异行', drift.length === 0, JSON.stringify(drift));
  steps.push({ step: '总额守恒（10 笔串行转账）', transfers: seq, totals_before: totalsBefore, totals_after: totalsAfter, drift });

  // ---------------------------------------------------------------- 9. DB 层兜底探针
  const negativeInsert = await expectError(() => withTransaction(async (tx) => {
    await txQuery(tx, `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id, idempotency_key)
      VALUES ($1, $2, -1, 0, -1, 0, 'transfer', 'system', 1, $3)`, [A, CID, key('guard-neg')]);
  }));
  const negRowCount = await countKeys([key('guard-neg')]);
  check('DB 兜底①：负 balance_after 被 ledger_after_guard 拒（23514）',
    negativeInsert.code === '23514' && negRowCount === '0', `${negativeInsert.raw || negativeInsert.code} rows=${negRowCount}`);

  const beforeOrphan = await bal(A);
  const orphanUpdate = await expectError(() => withTransaction(async (tx) => {
    await txQuery(tx, 'UPDATE account SET balance = balance + 1 WHERE uid = $1 AND cid = $2', [A, CID]);
  }));
  const afterOrphan = await bal(A);
  check('DB 兜底②：无分录的 account 变更被 trg_account_guard 拒（P0001）',
    orphanUpdate.code === 'P0001' && JSON.stringify(beforeOrphan) === JSON.stringify(afterOrphan),
    `${orphanUpdate.code}: ${orphanUpdate.message.slice(0, 120)}`);

  const appendOnly = await expectError(() => withTransaction(async (tx) => {
    await txQuery(tx, 'UPDATE ledger_entry SET memo = $2 WHERE idempotency_key = $1', [mintKey, 'tampered']);
  }));
  check('DB 兜底③：UPDATE 流水被 append-only trigger 拒（P0001）',
    appendOnly.code === 'P0001' && /append-only/i.test(appendOnly.message), appendOnly.message.slice(0, 120));

  // ---------------------------------------------------------------- 10. mint 授权 / 上限 / decimals
  const symbol = `smk${RUN}`;
  const created = await withTransaction((tx) => txQuery<{ cid: string }>(
    tx,
    `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, deposit_amount, deposit_cid)
     VALUES ($1, $2, $3, 2, 0, 50000, 'draft', 0, 1) RETURNING cid`,
    [symbol, '烟测自建单位', A],
  ));
  const unitCid = String(created[0].cid);
  const unit = await getCurrency(unitCid);

  const ownerMintStep = await runStep(`mint 400.00 ${symbol}（owner=${A} 自铸）`, [A], () => mint({
    uid: A, cid: unitCid, amount: '400.00', idempotencyKey: key('unit-mint'), refType: 'currency', refId: unitCid,
  }), unitCid);
  const ownerMint = ownerMintStep.result;
  check('R72③ decimals=2 的 "400.00" 解析为 40000 最小单位', ownerMint.entries[0].delta === '40000',
    `delta=${ownerMint.entries[0].delta}`);

  const overCap = await expectError(() => mint({
    uid: A, cid: unitCid, amount: '200.00', idempotencyKey: key('unit-over'), refType: 'currency', refId: unitCid,
  }));
  check('R24 超 supply_cap ⇒ 409 LEDGER_SUPPLY_CAP_EXCEEDED',
    overCap.code === 'LEDGER_SUPPLY_CAP_EXCEEDED' && overCap.status === 409, JSON.stringify(overCap));

  const unauthorized = await expectError(() => mint({
    uid: B, cid: unitCid, amount: '1.00', idempotencyKey: key('unit-unauthed'), refType: 'currency', refId: unitCid,
  }));
  check('R23 自建单位非 owner 铸币 ⇒ 403 LEDGER_UNAUTHORIZED_MINT',
    unauthorized.code === 'LEDGER_UNAUTHORIZED_MINT' && unauthorized.status === 403, JSON.stringify(unauthorized));

  const sysUnauthorized = await expectError(() => mint({ uid: A, cid: CID, amount: '1', idempotencyKey: key('sys-unauthed') }));
  check('R23 $ 非平台路径铸币 ⇒ 403 LEDGER_UNAUTHORIZED_MINT', sysUnauthorized.code === 'LEDGER_UNAUTHORIZED_MINT',
    JSON.stringify(sysUnauthorized));

  const decimalsOverflow = await expectError(() => mint({
    uid: A, cid: unitCid, amount: '0.005', idempotencyKey: key('unit-decimals'), refType: 'currency', refId: unitCid,
  }));
  check('R72③ 小数位超币种 decimals ⇒ 400 LEDGER_DECIMALS_OVERFLOW',
    decimalsOverflow.code === 'LEDGER_DECIMALS_OVERFLOW' && decimalsOverflow.status === 400, JSON.stringify(decimalsOverflow));

  const reserved = await expectError(() => transfer({ fromUid: A, toUid: '-1', cid: CID, amount: '1', idempotencyKey: key('reserved') }));
  check('R100 向平台保留 uid 转账 ⇒ 400 LEDGER_RESERVED_UID', reserved.code === 'LEDGER_RESERVED_UID' && reserved.status === 400,
    JSON.stringify(reserved));
  const selfTransfer = await expectError(() => transfer({ fromUid: A, toUid: A, cid: CID, amount: '1', idempotencyKey: key('self') }));
  check('转给自己 ⇒ 400 LEDGER_SELF_TRANSFER', selfTransfer.code === 'LEDGER_SELF_TRANSFER', JSON.stringify(selfTransfer));
  const badKind = await expectError(() => settleFrozen({
    fromUid: A, toUid: B, cid: CID, amount: '1', kind: 'commission' as never, idempotencyKey: key('bad-kind'), refType: 'job', refId: 1,
  }));
  check('R33 非白名单 kind 结算冻结 ⇒ LEDGER_UNKNOWN_KIND', badKind.code === 'LEDGER_UNKNOWN_KIND', JSON.stringify(badKind));

  steps.push({ step: '自建单位 mint 授权/上限/decimals', currency: unit, owner_mint: brief(ownerMint),
    over_cap: overCap, unauthorized, decimals_overflow: decimalsOverflow, reserved, self_transfer: selfTransfer, bad_kind: badKind });

  // ---------------------------------------------------------------- 11. 账单读接口
  const page = await listEntriesByAccount(A, CID, null, 5);
  check('R95 账单 keyset 分页可读', page.length > 0 && page.every((e) => e.uid === A),
    page.map((e) => `${e.txid}:${e.kind}:${e.delta}/${e.frozen_delta}`).join(' | '));
  steps.push({ step: '账单调页（uid A 近 5 条）', page: page.map((e) => ({ txid: e.txid, kind: e.kind, delta: e.delta, frozen_delta: e.frozen_delta })) });

  const failed = checks.filter((c) => !c.pass);
  console.log(JSON.stringify({
    run: RUN, uid_a: A, uid_b: B, uid_c: C, cid: CID, unit_cid: unitCid,
    passed: checks.length - failed.length, failed: failed.length,
    checks, steps,
  }, null, 2));
  return failed.length === 0 ? 0 : 1;
};

main()
  .then(async (code) => { await closePools(); process.exit(code); })
  .catch(async (e) => {
    console.log(JSON.stringify({ run: RUN, fatal: String((e as Error)?.message ?? e), checks, steps }, null, 2));
    await closePools();
    process.exit(2);
  });
