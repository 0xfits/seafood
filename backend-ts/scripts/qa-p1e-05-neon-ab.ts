/**
 * QA-P1E-05 · 驱动延迟 A/B：pool（ws 池） vs neon（SQL-over-HTTP）（Neng）
 * ============================================================================
 * 用法：
 *   SEAFOOD_LEDGER_WRITE_DRIVER=pool QAE_TAG=pool \
 *     cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-05-neon-ab.ts
 *   SEAFOOD_LEDGER_WRITE_DRIVER=neon QAE_TAG=neon npx ts-node --transpile-only scripts/qa-p1e-05-neon-ab.ts
 *
 * 同一脚本、同一币种、同一账号，只换传输层；每档 5 次 transfer + 2 次 mint 取中位数。
 * （实现方列的未验证面 ③：所有读数都在 pool 档取得。）
 * 纪律：uid 936xxx；symbol 前缀 qae；键前缀 ops:qae:*。
 */
import { closePools } from '../src/db';
import { closeLedgerWritePool, getAccount, mint, transfer } from '../src/ledger';
import { accountOf, ensureCurrency, mkPool, median, withPool, raw } from './qa-p1e-lib';

const RUN = Date.now().toString(36).slice(-5);
const TAG = String(process.env.QAE_TAG ?? 'x');
const SYM = 'qaeNAB';                     // 两档共用同一币（先跑的那次建）
const OWNER = 936001n;
const PEER = 936002n;

const brief = (e: unknown) => {
  const a = e as Record<string, unknown>;
  return { code: a?.code, status: a?.status, message: a?.message, details: a?.details };
};

(async () => {
  const out: Record<string, unknown> = { run: RUN, tag: TAG, driver: process.env.SEAFOOD_LEDGER_WRITE_DRIVER ?? '(unset->pool)' };

  // 建币（幂等：已存在则复用）
  const cid = await withPool(1, async (p) => {
    const found = await raw<{ cid: string }>(p, 'SELECT cid FROM currency WHERE symbol = $1', [SYM]);
    if (found.length) return found[0].cid;
    const rows = await raw<{ cid: string }>(p, `
      INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
      VALUES ($1, $2, $3, 0, 0, NULL, 'listed', now()) RETURNING cid`, [SYM, `QAE ${SYM}`, String(OWNER)]);
    return rows[0].cid;
  });
  out.cid = cid;

  const seed = await mint({ uid: OWNER, cid, amount: 100000n, idempotencyKey: `ops:qae:${SYM}:seed` });
  out.seed = { ok: seed.ok, replay: seed.idempotent_replay, txid: seed.txid };

  // 预热（首次查询成本不计入读数）
  await transfer({ fromUid: OWNER, toUid: PEER, cid, amount: 1n, idempotencyKey: `ops:qae:${SYM}:${TAG}:warm` });

  const tMs: number[] = []; const tSample: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= 5; i += 1) {
    const t0 = Date.now();
    try {
      const r = await transfer({ fromUid: OWNER, toUid: PEER, cid, amount: 1n, idempotencyKey: `ops:qae:${SYM}:${TAG}:t${i}`, memo: 'qae ab' });
      const dt = Date.now() - t0; tMs.push(dt);
      tSample.push({ i, ms: dt, txid: r.txid, entries: r.entries.length, replay: r.idempotent_replay, meta: r.meta?.op });
    } catch (e) { tSample.push({ i, failed: true, ...brief(e) }); }
  }
  out.transfer_ms = tMs; out.transfer_median_ms = tMs.length ? median(tMs) : null; out.transfer_samples = tSample;

  const mM: number[] = [];
  for (let i = 1; i <= 2; i += 1) {
    const t0 = Date.now();
    try { await mint({ uid: OWNER, cid, amount: 1n, idempotencyKey: `ops:qae:${SYM}:${TAG}:m${i}` }); mM.push(Date.now() - t0); }
    catch (e) { mM.push(-1); out[`mint_${i}_error`] = brief(e); }
  }
  out.mint_ms = mM; out.mint_median_ms = mM.filter((x) => x >= 0).length ? median(mM.filter((x) => x >= 0)) : null;

  out.accounts = { owner: await getAccount(OWNER, cid), peer: await getAccount(PEER, cid) };

  // 误差映射对照：neon（HTTP）驱动不搬运 DETAIL —— 触发一个账本命名错误看 details 形状
  const errProbe: Record<string, unknown> = {};
  try {
    await transfer({ fromUid: OWNER, toUid: OWNER, cid, amount: 1n, idempotencyKey: `ops:qae:${SYM}:${TAG}:selferr` });
    errProbe.unexpected_ok = true;
  } catch (e) { errProbe.self_transfer = brief(e); }
  try {
    await transfer({ fromUid: OWNER, toUid: PEER, cid: '999999', amount: 1n, idempotencyKey: `ops:qae:${SYM}:${TAG}:cid` });
    errProbe.unexpected_ok2 = true;
  } catch (e) { errProbe.bad_cid = brief(e); }
  out.error_mapping = errProbe;

  console.log(JSON.stringify(out, null, 1));
  await closeLedgerWritePool().catch(() => undefined);
  await closePools().catch(() => undefined);
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closeLedgerWritePool().catch(() => undefined);
  await closePools().catch(() => undefined);
  process.exit(1);
});
