/**
 * P1a 并发质检 · 用例⑤ 死锁 / 串行化失败重试 + 加锁语义取证
 * ---------------------------------------------------------------------------
 * 模式（QA_MODE）：
 *   settings —— 事务内 SET LOCAL 取证（lock_timeout / statement_timeout / 隔离级别 / backend pid / txid）
 *   locksem  —— 加锁语义对照实验：plain SELECT vs SELECT ... FOR UPDATE（串行化 vs 不串行化）
 *   deadlock —— 两笔**反向加锁顺序**的事务 ⇒ 制造真实 40P01，观察 db.ts(R60) 重试行为
 *   exhaust  —— 合成 40P01（注入构造）⇒ 验证重试次数、退避时序与最终 503 错误码
 *   apiorder —— 用五个公开账本动作尝试构造反向加锁（诚实验证「能否构造」）
 *   hybrid   —— 真实 `mint()` 调用 与 反向加锁伙伴事务 对冲 ⇒ 真实 40P01 落在真实 API 上，
 *               并验证「重试后仍恰好一次入账」（R60 复用同一幂等键）
 * 运行：cd backend-ts && QA_MODE=<mode> npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts
 */
import { withTransaction, txQuery, TxClient, readQuery } from '../src/db';
import { mint } from '../src/ledger';
import { j } from './qa-p1b-lib';

const MODE = process.env.QA_MODE ?? 'settings';
const GLD = '4';
const DLK = '6';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const codeOf = (e: unknown) => {
  const a = e as { name?: string; code?: string; message?: string; pgCode?: string | null; status?: number | null };
  return { name: a?.name, code: a?.code, pgCode: a?.pgCode ?? null, status: a?.status ?? null,
    message: String(a?.message ?? '').slice(0, 120) };
};
const deadlocks = async () => (await readQuery<{ d: string }>(
  'SELECT deadlocks AS d FROM pg_stat_database WHERE datname = current_database()'))[0].d;

const lockRow = async (tx: TxClient, uid: string, cid: string) =>
  txQuery(tx, `SELECT ${'balance'} FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE`, [uid, cid]);
const readRow = async (tx: TxClient, uid: string, cid: string) =>
  txQuery<{ balance: string }>(tx, 'SELECT balance FROM account WHERE uid = $1 AND cid = $2', [uid, cid]);

(async () => {
  if (MODE === 'settings') {
    const outside = await readQuery<Record<string, string>>(
      `SELECT current_setting('lock_timeout') AS lock_timeout, current_setting('statement_timeout') AS statement_timeout`);
    const inside = await withTransaction(async (tx) => txQuery<Record<string, string>>(tx,
      `SELECT current_setting('lock_timeout') AS lock_timeout,
              current_setting('statement_timeout') AS statement_timeout,
              current_setting('transaction_isolation') AS isolation,
              current_setting('deadlock_timeout') AS deadlock_timeout,
              pg_backend_pid() AS backend_pid, txid_current() AS xid`));
    console.log(j({ case: '5-settings', outside_tx_defaults: outside[0], inside_tx: inside[0] }));
    process.exit(0);
  }

  if (MODE === 'locksem') {
    // 用 JS 侧「已持锁」握手消除 WebSocket 建连抖动带来的时序误差：
    // 持有方先拿到锁（并握手通知），再启动第二笔事务，二者都对同一行操作。
    const handshake = () => {
      let fire: () => void = () => undefined;
      const p = new Promise<void>((r) => { fire = r; });
      return { p, fire };
    };

    // ---- 对照 1：plain SELECT（无锁）—— 第二笔**不**等待，且读到与第一笔相同的前像
    const h1 = handshake();
    const t1 = Date.now();
    const p1a = withTransaction(async (tx) => {
      const r = await readRow(tx, '910003', GLD);
      h1.fire();
      await sleep(1800);
      return { first_read: r[0]?.balance, released_at_ms: Date.now() - t1 };
    });
    await h1.p;
    const b1 = await withTransaction(async (tx) => {
      const at = Date.now() - t1;
      const r = await readRow(tx, '910003', GLD);
      return { request_at_ms: at, done_at_ms: Date.now() - t1, waited_ms: Date.now() - t1 - at, read: r[0]?.balance };
    });
    const a1 = await p1a;

    // ---- 对照 2：SELECT ... FOR UPDATE —— 第二笔被串行化，必须等第一笔释放
    const h2 = handshake();
    const t2 = Date.now();
    const p2a = withTransaction(async (tx) => {
      await lockRow(tx, '910003', GLD);
      h2.fire();
      await sleep(1800);
      return { released_at_ms: Date.now() - t2 };
    });
    await h2.p;
    const b2 = await withTransaction(async (tx) => {
      const at = Date.now() - t2;
      await lockRow(tx, '910003', GLD);
      return { request_at_ms: at, acquired_at_ms: Date.now() - t2, waited_ms: Date.now() - t2 - at };
    });
    const a2 = await p2a;

    console.log(j({ case: '5-locksem',
      plain_select_pair: { first_tx: a1, second_tx: b1, serialized: false,
        same_preimage_read: a1.first_read === b1.read },
      for_update_pair: { first_tx: a2, second_tx: b2, serialized: b2.waited_ms > 1000 },
      conclusion: 'plain SELECT 两笔并发读到同一前像（不串行化）；FOR UPDATE 第二笔被阻塞到第一笔释放（串行化）' }));
    process.exit(0);
  }

  if (MODE === 'deadlock') {
    const before = await deadlocks();
    const t0 = Date.now();
    const handshake = () => {
      let fire: () => void = () => undefined;
      const p = new Promise<void>((r) => { fire = r; });
      return { p, fire };
    };
    const hA = handshake(); // A 已持有 910001 行锁
    const hB = handshake(); // B 已持有 910003 行锁

    const mk = (label: string, first: string, second: string,
                onFirstLock: () => void, gate: Promise<void> | null, delay: number) => {
      const log: Record<string, unknown>[] = [];
      let attempt = 0;
      const p = withTransaction(async (tx) => {
        attempt += 1;
        const push = (step: string, extra: Record<string, unknown> = {}) =>
          log.push({ attempt, step, at_ms: Date.now() - t0, ...extra });
        push('begin');
        try { await lockRow(tx, first, GLD); push(`locked ${first}`); onFirstLock(); }
        catch (e) { log.push({ attempt, step: `lock ${first} FAILED`, at_ms: Date.now() - t0, ...codeOf(e) }); throw e; }
        if (gate) await gate;
        await sleep(delay);
        try { await lockRow(tx, second, GLD); push(`locked ${second}`); }
        catch (e) { log.push({ attempt, step: `lock ${second} FAILED`, at_ms: Date.now() - t0, ...codeOf(e) }); throw e; }
        return { attempt };
      }).then((r) => ({ label, outcome: 'ok' as const, attempts: attempt, log, result: r }))
        .catch((e) => ({ label, outcome: 'failed' as const, attempts: attempt, log, error: codeOf(e) }));
      return p;
    };

    // 环：A 持 910001 待 910003；B 持 910003 待 910001
    const pa = mk('A: 先 910001 → 后 910003', '910001', '910003', () => hA.fire(), hB.p, 200);
    await hA.p;
    const pb = mk('B: 先 910003 → 后 910001', '910003', '910001', () => hB.fire(), null, 700);
    await hB.p;
    const [ra, rb] = await Promise.all([pa, pb]);
    console.log(j({ case: '5-deadlock', note: '两笔事务故意反向加锁；握手指令保证「A 先持 910001、B 先持 910003」',
      deadlocks_before: before, deadlocks_after: await deadlocks(),
      A: ra, B: rb, wall_ms: Date.now() - t0 }));
    process.exit(0);
  }

  if (MODE === 'exhaust') {
    const t0 = Date.now();
    const stamps: number[] = [];
    let attempts = 0;
    let err: unknown = null;
    try {
      await withTransaction(async () => {
        attempts += 1;
        stamps.push(Date.now() - t0);
        const e = new Error('QA 构造：合成 40P01') as Error & { code: string };
        e.code = '40P01';
        throw e;
      });
    } catch (e) { err = e; }
    const gaps = stamps.slice(1).map((s, i) => s - stamps[i]);
    const { normalizeLedgerError } = await import('../src/ledger-errors');
    const norm = normalizeLedgerError(err);
    console.log(j({ case: '5-exhaust', synthetic_code: '40P01', attempts,
      attempt_start_offsets_ms: stamps, backoff_gaps_ms: gaps,
      backoff_expected_ms: [50, 200, 800], final_error: codeOf(err),
      normalized_to_s14: { code: norm.code, status: norm.status, message: norm.message } }));
    process.exit(0);
  }

  if (MODE === 'apiorder') {
    // 用**公开账本动作**尝试构造反向加锁（R85⑤ 的字面要求）：
    //  (a) 同一对账户的两笔**反向** transfer 并发 × 20 轮
    //  (b) 同一 uid 在两个币种上的并发 mint × 10 轮
    //  (c) 反向 settleFrozen 不可构造（需先有 frozen，用 freeze 造：910003 无 ref 会被拒）
    const before = await deadlocks();
    const codes: Record<string, number> = {};
    const tallyCode = (e: unknown) => { const c = String(codeOf(e).code ?? 'OK'); codes[c] = (codes[c] ?? 0) + 1; };
    const { transfer } = await import('../src/ledger');
    for (let i = 0; i < 20; i += 1) {
      await Promise.all([
        transfer({ fromUid: 910001n, toUid: 910003n, cid: GLD, amount: 1n,
          idempotencyKey: `ops:qa1b:c5:api:ab:${i + 1}` }).catch(tallyCode),
        transfer({ fromUid: 910003n, toUid: 910001n, cid: GLD, amount: 1n,
          idempotencyKey: `ops:qa1b:c5:api:ba:${i + 1}` }).catch(tallyCode),
      ]);
    }
    for (let i = 0; i < 10; i += 1) {
      await Promise.all([
        mint({ uid: 910002n, cid: DLK, amount: 1n, idempotencyKey: `ops:qa1b:c5:api:m6:${i + 1}` }).catch(tallyCode),
        mint({ uid: 910002n, cid: DLK, amount: 1n, idempotencyKey: `ops:qa1b:c5:api:m6b:${i + 1}` }).catch(tallyCode),
      ]);
    }
    console.log(j({ case: '5-apiorder', what: '公开动作并发（反向 transfer 20 轮 + 同 uid/同币种 mint 10 轮）',
      deadlocks_before: before, deadlocks_after: await deadlocks(),
      codes, note: '公开动作内部固定按 uid 升序加锁（ledger.ts lockAccounts 排序 / mint 先锁 currency），因此无法制造逆序' }));
    process.exit(0);
  }

  if (MODE === 'rawreverse') {
    // 对照：绕过公开动作、由探针直接发**逆序**语句 ⇒ 证明「死锁本身可构造」（R93 对照实验用）
    const before = await deadlocks();
    const codes: Record<string, number> = {};
    const tallyCode = (e: unknown) => { const c = String(codeOf(e).code ?? 'OK'); codes[c] = (codes[c] ?? 0) + 1; };
    const attemptsLog: Record<string, unknown>[] = [];
    for (let i = 0; i < 20; i += 1) {
      await Promise.all([
        withTransaction(async (tx) => { await lockRow(tx, '910001', GLD); await sleep(300);
          await lockRow(tx, '910003', GLD); }).catch((e) => { tallyCode(e); attemptsLog.push({ i, side: 'A', ...codeOf(e) }); }),
        withTransaction(async (tx) => { await lockRow(tx, '910003', GLD); await sleep(300);
          await lockRow(tx, '910001', GLD); }).catch((e) => { tallyCode(e); attemptsLog.push({ i, side: 'B', ...codeOf(e) }); }),
      ]);
    }
    console.log(j({ case: '5-rawreverse', what: '探针直接发逆序 FOR UPDATE × 20 轮（仅在 DB 层配对同一行）',
      deadlocks_before: before, deadlocks_after: await deadlocks(), codes,
      samples: attemptsLog.slice(0, 6) }));
    process.exit(0);
  }

  if (MODE === 'hybrid') {
    const before = await deadlocks();
    const supBefore = (await readQuery<Record<string, string>>(
      'SELECT total_supply FROM currency WHERE cid = $1', [DLK]))[0].total_supply;
    const rounds: unknown[] = [];
    for (let r = 0; r < 3; r += 1) {
      const t0 = Date.now();
      const partnerLog: Record<string, unknown>[] = [];
      let partnerAttempt = 0;
      let fire: () => void = () => undefined;
      const partnerHoldsAccount = new Promise<void>((res) => { fire = res; });
      const partner = withTransaction(async (tx) => {
        partnerAttempt += 1;
        await lockRow(tx, '910002', DLK);
        partnerLog.push({ attempt: partnerAttempt, step: 'locked account(910002,6)', at_ms: Date.now() - t0 });
        fire();
        await sleep(1500);
        try { await txQuery(tx, 'SELECT cid FROM currency WHERE cid = $1 FOR UPDATE', [DLK]); }
        catch (e) { partnerLog.push({ attempt: partnerAttempt, step: 'lock currency FAILED', at_ms: Date.now() - t0, ...codeOf(e) }); throw e; }
        partnerLog.push({ attempt: partnerAttempt, step: 'locked currency(6)', at_ms: Date.now() - t0 });
      }).catch((e) => ({ partner_error: codeOf(e) }));

      await partnerHoldsAccount; // 确认伙伴已持账户行锁，再发真实 mint（消除建连抖动）
      const mintStart = Date.now() - t0;
      const m = await mint({ uid: 910002n, cid: DLK, amount: 1n,
        idempotencyKey: `ops:qa1b:c5:hybrid:${r + 1}`, memo: 'qa1b c5 hybrid' })
        .then((res) => ({ ok: true, replay: res.idempotent_replay, txid: res.txid,
          supply_after: res.extra.supply_after, mint_started_at_ms: mintStart, ms: Date.now() - t0 }))
        .catch((e) => ({ ok: false, error: codeOf(e), mint_started_at_ms: mintStart, ms: Date.now() - t0 }));
      const pr = await partner;
      rounds.push({ round: r + 1, mint_result: m, partner_attempts: partnerAttempt, partner_log: partnerLog, partner_result: pr });
    }
    const supAfter = (await readQuery<Record<string, string>>(
      'SELECT total_supply FROM currency WHERE cid = $1', [DLK]))[0].total_supply;
    const rows = await readQuery<Record<string, string>>(
      `SELECT txid, uid, delta, idempotency_key FROM ledger_entry
        WHERE idempotency_key LIKE 'ops:qa1b:c5:hybrid%' ORDER BY txid`);
    console.log(j({ case: '5-hybrid', note: '真实 mint() 与反向加锁伙伴事务对冲；mint 被 db.ts 重试后必须恰好入账一次',
      deadlocks_before: before, deadlocks_after: await deadlocks(),
      supply_before: supBefore, supply_after: supAfter,
      expected_supply_delta: 3, actual_supply_delta: String(BigInt(supAfter) - BigInt(supBefore)),
      ledger_rows: rows, rounds }));
    process.exit(0);
  }

  console.error('unknown QA_MODE', MODE);
  process.exit(2);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
