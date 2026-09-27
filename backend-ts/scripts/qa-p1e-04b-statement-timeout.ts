/**
 * QA-P1E-04b · 真实 statement_timeout（57014）构造 + 投影取证（Neng）
 * ============================================================================
 * 用法：QAE_CID=<cid> cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-04b-statement-timeout.ts
 *
 * 为什么需要这个构造：函数内 `lock_timeout=3000 < statement_timeout=10000`，
 * 单次锁等待**永远**先到 3s ⇒ 57014 不可能由「一次长锁等待」触发。
 * `lock_timeout` 是**逐次获取**生效的：让函数 C4 依次等 6 个账户行、释放时刻错开
 * （2.6 / 5.0 / 7.4 / 9.8 / 12.2 / 22.0 s，**共用同一发令时刻**），
 * 则累计等待 > 10s 而无单次等待 > 3s ⇒ 触发 statement_timeout。
 *
 * ⚠️ 方法学修正（上一版假阴性）：持锁者各自握手耗时不同 ⇒ 以「各自锁住后睡 T」定序会漂移。
 *    本版改为**栅栏**：6 个持锁者全部锁住后统一起跑，函数与持锁者共用同一 t0。
 * 同时回答：57014 到底被函数投影成 LD026，还是**原样冒出去**（它发生在 C4，在 EXCEPTION 块之外）。
 * 纪律：uid 933xxx；symbol 前缀 qae；键前缀 ops:qae:*。
 */
import { closePools } from '../src/db';
import { ledgerErrorFromDbError, normalizeLedgerError } from '../src/ledger';
import { attempt, entriesFor, mkPool, raw } from './qa-p1e-lib';
import { Pool } from '@neondatabase/serverless';

const RUN = Date.now().toString(36).slice(-5);
const CID = String(process.env.QAE_CID ?? '');
const U = [933001n, 933002n, 933011n, 933012n, 933013n, 933014n];   // 锁序 = 升序

const sleep = (m: number) => new Promise((r) => setTimeout(r, m));

(async () => {
  if (!CID) throw new Error('QAE_CID 必填');
  const out: Record<string, unknown> = { run: RUN, cid: CID, uids: U.map(String) };
  const admin = mkPool(4);
  const fn = mkPool(1);
  await fn.query('SELECT 1');

  // 备料：三对分录的减方（U0/U2/U4）都要有余额
  await attempt(fn, { op: 'transfer', from_uid: String(U[0]), to_uid: String(U[2]), cid: CID, amount_units: '100',
    idempotency_key: `ops:qae:${RUN}:st:fund2` });
  await attempt(fn, { op: 'transfer', from_uid: String(U[0]), to_uid: String(U[4]), cid: CID, amount_units: '100',
    idempotency_key: `ops:qae:${RUN}:st:fund4` });

  const chain = (key: string) => ({
    op: 'entries', idempotency_key: key, memo: 'qae statement_timeout chain',
    entries: [
      { uid: String(U[0]), cid: CID, delta: '-10', kind: 'transfer' },
      { uid: String(U[1]), cid: CID, delta: '10', kind: 'transfer' },
      { uid: String(U[2]), cid: CID, delta: '-10', kind: 'transfer' },
      { uid: String(U[3]), cid: CID, delta: '10', kind: 'transfer' },
      { uid: String(U[4]), cid: CID, delta: '-10', kind: 'transfer' },
      { uid: String(U[5]), cid: CID, delta: '10', kind: 'transfer' },
    ],
  });

  const seedKey = `ops:qae:${RUN}:st:seed`;
  const rSeed = await attempt(fn, chain(seedKey));
  out.seed = { ok: rSeed.ok, txid: rSeed.txid, entries: rSeed.entries?.length, error: rSeed.error ?? null };
  const snap = async () => raw(admin, `
    SELECT uid, cid, balance, frozen FROM account WHERE cid = $1 AND uid = ANY($2::bigint[]) ORDER BY uid`,
  [CID, U.map(String)]);
  out.accounts_before = await snap();

  // ---- 栅栏：6 个持锁者全部锁住后统一起跑
  const holds = [
    { uid: U[0], t: 2.6 }, { uid: U[1], t: 5.0 }, { uid: U[2], t: 7.4 },
    { uid: U[3], t: 9.8 }, { uid: U[4], t: 12.2 }, { uid: U[5], t: 22.0 },
  ];
  const pools: Pool[] = holds.map(() => mkPool(1));
  let releaseGate: () => void = () => undefined;
  const gate = new Promise<void>((res) => { releaseGate = res; });
  let locked = 0;
  let allLockedRes: () => void = () => undefined;
  const allLocked = new Promise<void>((res) => { allLockedRes = res; });
  const pids: string[] = [];

  const holders = holds.map(async (h, i) => {
    const p = pools[i];
    await p.query('SELECT 1');
    const pid = (await raw<{ pid: string }>(p, 'SELECT pg_backend_pid()::text AS pid'))[0].pid;
    pids.push(pid);
    await p.query('BEGIN');
    await p.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [String(h.uid), CID]);
    locked += 1;
    if (locked === holds.length) allLockedRes();
    await gate;
    const t0 = Date.now();
    await p.query('SELECT pg_sleep($1)', [h.t]);
    await p.query('COMMIT').catch(() => undefined);
    return { uid: String(h.uid), scheduled_s: h.t, held_ms: Date.now() - t0 };
  });

  await allLocked;
  out.all_holders_locked = true;
  const tStart = Date.now();
  releaseGate();                       // 函数与持锁者共用同一 t0
  const key = `ops:qae:${RUN}:st:main`;
  const r = await attempt(fn, chain(key));
  const dt = Date.now() - tStart;

  const info = r.error ?? null;
  let tsCode: string | null = null; let tsStatus: number | null = null; let tsDetails: unknown = null;
  if (info) {
    const synthetic = Object.assign(new Error(info.message), {
      code: info.code, detail: info.detail, constraint: info.constraint,
    });
    const mapped = ledgerErrorFromDbError(synthetic) ?? normalizeLedgerError(synthetic);
    const m = mapped as unknown as { code: string; status?: number | null; details?: unknown };
    tsCode = m.code; tsStatus = m.status ?? null; tsDetails = m.details ?? null;
  }
  out.statement_timeout = {
    key, elapsed_ms: dt,
    db_sqlstate: info?.code ?? null, db_message: info?.message ?? null, db_detail: info?.detail ?? null,
    ts_code: tsCode, ts_status: tsStatus, ts_details: tsDetails,
    sqlstate_in_LD_closed_set: !!info?.code && /^LD\d{3}$/.test(info.code),
    rows_written: (await entriesFor(admin, key)).length,
    achieved_57014: info?.code === '57014',
  };
  out.accounts_after_timeout = await snap();
  out.balances_unchanged_by_timeout = JSON.stringify(out.accounts_before) === JSON.stringify(out.accounts_after_timeout);

  const holderLog = await Promise.all(holders);
  out.holders = holderLog;
  out.holder_pids = pids;

  // 重试同键（无争抢）⇒ 必须且只生效一次
  const r2 = await attempt(fn, chain(key));
  const rows2 = await entriesFor(admin, key);
  out.retry = { ok: r2.ok, replay: r2.replay, txid: r2.txid, rows_for_key: rows2.length, error: r2.error ?? null };
  out.accounts_after_retry = await snap();
  out.cid_net = await raw(admin, `SELECT SUM(delta + frozen_delta)::text AS net FROM ledger_entry WHERE cid = $1`, [CID]);
  out.negatives = (await raw(admin, `SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0`))[0].n;

  console.log(JSON.stringify(out, null, 1));
  await sleep(100);
  await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
  await fn.end().catch(() => undefined);
  await admin.end().catch(() => undefined);
  await closePools().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
