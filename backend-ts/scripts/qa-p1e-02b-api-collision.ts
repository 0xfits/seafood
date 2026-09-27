/**
 * QA-P1E-02b · 派生键碰撞的**对外 API 可达性**证明（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-02b-api-collision.ts
 *
 * QA-P1E-02 已在**裸 SQL 直调**层证明派生键碰撞。本探针回答一个更狠的问题：
 * 该缺陷能否经 `src/ledger.ts` 的**公开 API**（transfer）复现？
 * （若 TS 侧 `normalizeIdempotencyKey` 或指纹策略能挡住，则只是「直调面」缺陷；挡不住则是交付级缺陷。）
 * 纪律：uid 934xxx；symbol 前缀 qae；键前缀 ops:qae:*。
 */
import { closePools, readQuery } from '../src/db';
import { closeLedgerWritePool, getAccount, mint, transfer } from '../src/ledger';
import { withPool, raw } from './qa-p1e-lib';

const RUN = Date.now().toString(36).slice(-5);
const SYM = `qaeA${RUN}`;
const OWNER = 934001n;
const PEER = 934002n;
const THIRD = 934003n;

const brief = (e: unknown) => {
  const a = e as Record<string, unknown>;
  return { code: a?.code, status: a?.status, message: a?.message, details: a?.details };
};

(async () => {
  const out: Record<string, unknown> = { run: RUN, symbol: SYM };
  await withPool(2, async (p) => {
    const cid = await raw<{ cid: string }>(p, `
      INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
      VALUES ($1, $2, $3, 0, 0, NULL, 'listed', now()) RETURNING cid`,
    [SYM, `QAE ${SYM}`, String(OWNER)]);
    out.cid = cid[0].cid;
    const c = cid[0].cid;

    await mint({ uid: OWNER, cid: c, amount: 5000n, idempotencyKey: `ops:qae:${RUN}:api:seed` });

    const keyA = `ops:qae:${RUN}:api:a`;
    const keyB = `${keyA}#2`;   // = A 事件第 2 条分录的派生键

    const tA = await transfer({ fromUid: OWNER, toUid: PEER, cid: c, amount: 100n, idempotencyKey: keyA, memo: 'A 的业务事件' });
    out.A = {
      ok: tA.ok, replay: tA.idempotent_replay, txid: tA.txid, key: tA.idempotency_key,
      entries: tA.entries.map((e) => ({ txid: e.txid, uid: e.uid, delta: e.delta, key: e.idempotency_key })),
      accounts: tA.accounts,
    };
    const balBefore = { owner: await getAccount(OWNER, c), peer: await getAccount(PEER, c) };

    // B：完全无关的业务事件（OWNER → THIRD，777），键 = A 的派生键
    let tB: Record<string, unknown>;
    try {
      const r = await transfer({ fromUid: OWNER, toUid: THIRD, cid: c, amount: 777n, idempotencyKey: keyB, memo: 'B 的业务事件（无关）' });
      tB = {
        ok: r.ok, replay: r.idempotent_replay, txid: r.txid, key: r.idempotency_key,
        entries: r.entries.map((e) => ({ txid: e.txid, uid: e.uid, delta: e.delta, key: e.idempotency_key })),
        accounts: r.accounts, threw: false,
      };
    } catch (e) {
      tB = { threw: true, ...brief(e) };
    }
    const balAfter = { owner: await getAccount(OWNER, c), peer: await getAccount(PEER, c), third: await getAccount(THIRD, c) };

    out.B = tB;
    out.balances = { before: balBefore, after: balAfter };
    out.ledger_rows = await raw(p, `
      SELECT txid, uid, delta, idempotency_key FROM ledger_entry
       WHERE split_part(idempotency_key,'#',1) = $1 ORDER BY txid`, [`ops:qae:${RUN}:api:a`]);
    out.verdict = {
      B_acknowledged_ok: tB.ok === true,
      B_acknowledged_as_replay: tB.replay === true,
      B_money_moved: (balAfter.third?.balance ?? '0') !== '0',
      B_event_rows_in_ledger: (await raw(p, `
        SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key = $1 AND uid = $2`, [keyB, String(THIRD)]))[0].n,
      // 最狠的一条：调用方收到「成功（重放）」，但自己的业务事件未落账
      silently_dropped_and_reported_success:
        tB.ok === true && tB.replay === true && (balAfter.third?.balance ?? '0') === '0',
      RETURNED_TXID_BELONGS_TO_A: tB.txid === (out.A as Record<string, unknown>).txid ? 'no' : `yes: B 拿到的是 A 的第 2 条分录 txid ${String(tB.txid)}`,
    };

    // 方向②：先占 <key>#2，再落 <key>（两分录事件）⇒ 误判冲突
    const keyP = `ops:qae:${RUN}:api:p`;
    const keyQ = `${keyP}#2`;
    let tP: Record<string, unknown>; let tQ: Record<string, unknown>;
    try {
      const r = await transfer({ fromUid: OWNER, toUid: PEER, cid: c, amount: 50n, idempotencyKey: keyQ });
      tP = { ok: r.ok, replay: r.idempotent_replay, txid: r.txid };
    } catch (e) { tP = { threw: true, ...brief(e) }; }
    try {
      const r = await transfer({ fromUid: OWNER, toUid: PEER, cid: c, amount: 50n, idempotencyKey: keyP });
      tQ = { ok: r.ok, replay: r.idempotent_replay, txid: r.txid };
    } catch (e) { tQ = { threw: true, ...brief(e) }; }
    out.direction2 = { keyP, keyQ, P: tP, Q: tQ };
  });

  console.log(JSON.stringify(out, null, 1));
  await closeLedgerWritePool().catch(() => undefined);
  await closePools().catch(() => undefined);
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closeLedgerWritePool().catch(() => undefined);
  await closePools().catch(() => undefined);
  process.exit(1);
});
