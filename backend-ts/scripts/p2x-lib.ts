/**
 * p2x 自用探针库（Kong · 0012「重放前置闸」修复单）—— 与 p1xx/p2d/p2qa/p2w 家族**完全隔离**。
 * 测试数据分区：uid **960xxx** / symbol 前缀 **p2x** / 幂等键前缀 **ops:p2x:**（绝不触碰 cid = 1
 * 与平台账户 0/-1/-2/-3 的既有余额）。
 * 说明：本库**不复制** `ns-alloc.ts` 的命名空间分配扫描逻辑 —— 一律 `import` 它（它自称唯一实现）。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

export const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
/** run tag（落盘名一律带它；固定名会被复跑静默覆盖） */
export const RUN = process.env.P2X_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
/** before = 修前（0005 版函数）/ after = 修后（0012 版函数）；同一份脚本产出两份读数 */
export const PHASE = process.env.P2X_PHASE || 'unset';
export const OUT_DIR = path.resolve(__dirname, '..', '.p2x-artifacts');
export const REPO_BACKEND = path.resolve(__dirname, '..');

export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export interface Qx { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; }

export const raw = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await ex.query(sql, params)).rows as R[];
export const raw1 = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(ex, sql, params))[0] ?? null;

export const sha256 = (v: unknown): string =>
  crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
export const md5 = (v: string): string => crypto.createHash('md5').update(v).digest('hex');

export const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, phase: PHASE, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
export const saveText = (name: string, text: string): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.txt`);
  fs.writeFileSync(file, text);
  return file;
};

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface PgErr { sqlstate: string | null; message: string; detail: string | null; reason: string | null; raw_detail: unknown; }
export const pgErr = (e: unknown): PgErr => {
  const a = e as Record<string, unknown>;
  let reason: string | null = null; let parsed: unknown = null;
  try { parsed = JSON.parse(String(a?.detail ?? '')); reason = ((parsed as Record<string, unknown>)?.reason as string) ?? null; } catch { /* noop */ }
  return { sqlstate: (a?.code as string) ?? null, message: String(a?.message ?? e).slice(0, 300),
    detail: (a?.detail as string) ?? null, reason, raw_detail: parsed };
};

export const inRollbackTx = async <T>(p: Pool, fn: (c: Qx) => Promise<T>):
Promise<{ result: T | null; error: unknown | null; rolled_back: boolean; ms: number }> => {
  const t0 = Date.now();
  const c = await p.connect();
  let result: T | null = null; let error: unknown | null = null;
  try {
    await c.query('BEGIN');
    result = await fn(c as unknown as Qx);
  } catch (e) { error = e; }
  finally {
    try { await c.query('ROLLBACK'); } catch { /* noop */ }
    c.release();
  }
  return { result, error, rolled_back: true, ms: Date.now() - t0 };
};

/** 手工事务（并发用例必须自己控制「何时提交」，不能交给 inRollbackTx 的自动 BEGIN/ROLLBACK） */
export interface Tx { q: Qx; commit: () => Promise<PgErr | null>; rollback: () => Promise<void>; released: boolean; }
export const beginTx = async (p: Pool): Promise<Tx> => {
  const c = await p.connect();
  await c.query('BEGIN');
  const tx: Tx = {
    q: c as unknown as Qx,
    released: false,
    // 提交失败（例：DEFERRED 约束在 COMMIT 判负）⇒ 不抛异常，返回可机读错误；连接一律释放
    commit: async () => {
      try { await c.query('COMMIT'); tx.released = true; return null; }
      catch (e) { try { await c.query('ROLLBACK'); } catch { /* noop */ } c.release(); tx.released = true; return pgErr(e); }
    },
    rollback: async () => { try { await c.query('ROLLBACK'); } catch { /* noop */ } if (!tx.released) { c.release(); tx.released = true; } },
  };
  return tx;
};

export const ensureUsers = async (ex: Qx, uids: Array<number | string>): Promise<void> => {
  await ex.query(`INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                    FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [uids.map(String)]);
};

export const ensureCurrency = async (ex: Qx, symbol: string, ownerUid: string, decimals: number): Promise<string> => {
  const found = await raw1<{ cid: string }>(ex, `SELECT cid::text AS cid FROM currency WHERE symbol = $1 LIMIT 1`, [symbol]);
  if (found) return String(found.cid);
  const r = await raw1<{ cid: string }>(ex, `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
    VALUES ($1, $2, $3, $4, 0, 'listed', now()) RETURNING cid::text AS cid`, [symbol, `P2X ${symbol}`, ownerUid, decimals]);
  return String((r as { cid: string }).cid);
};

export const callFn = async (ex: Qx, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await ex.query('SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  const v = (r.rows[0] as { r: unknown })?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
};

let spSeq = 0;
/**
 * 事务内**预期可能失败**的调用：先 SAVEPOINT，失败即 `ROLLBACK TO SAVEPOINT`。
 * 为什么必须这么写：PG 里一条语句报错就会把整条事务置为 aborted（后续语句一律 25P02），
 * 而本探针的判据恰恰要求「同一条事务里先撞 LD002 再继续读别的读数」。
 */
export const tryFnSp = async (ex: Qx, payload: unknown): Promise<FnRead> => {
  const sp = `p2x_sp_${++spSeq}`;
  await ex.query(`SAVEPOINT ${sp}`);
  const r = await tryFn(ex, payload);
  try {
    await ex.query(r.error ? `ROLLBACK TO SAVEPOINT ${sp}` : `RELEASE SAVEPOINT ${sp}`);
  } catch { /* noop */ }
  return r;
};

export interface FnRead {
  ok: boolean; replay: boolean; rows: number;
  error: PgErr | null; raw: Record<string, unknown> | null; ms: number;
}
export const tryFn = async (ex: Qx, payload: unknown): Promise<FnRead> => {
  const t0 = Date.now();
  try {
    const r = await callFn(ex, payload);
    return { ok: r?.ok === true, replay: r?.idempotent_replay === true,
      rows: ((r?.entries as unknown[]) ?? []).length, error: null, raw: r, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, replay: false, rows: 0, error: pgErr(e), raw: null, ms: Date.now() - t0 };
  }
};

/** 一条调用的**可对比读数**（含逐字 JSON 与 entries/accounts 摘要哈希） */
export const obs = (r: FnRead): Record<string, unknown> => ({
  ok: r.ok, idempotent_replay: r.replay, entries_n: r.rows, ms: r.ms,
  sqlstate: r.error?.sqlstate ?? null, reason: r.error?.reason ?? null, err_message: r.error?.message ?? null,
  txid: (r.raw?.txid as string) ?? null,
  result_keys: r.raw ? Object.keys(r.raw).sort() : null,
  entries_sha256: r.raw?.entries ? sha256(r.raw.entries) : null,
  accounts_sha256: r.raw?.accounts ? sha256(r.raw.accounts) : null,
  extra: r.raw?.extra ?? null,
  raw_json: r.raw ? JSON.stringify(r.raw) : null,
});

export const ledgerRowsFor = async (ex: Qx, key: string): Promise<number> =>
  Number((await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM ledger_entry
     WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1`, [key]))?.n ?? '-1');

/** 库内函数指纹（prosrc 摘要 + 三个位置读数 ⇒ 直接证明「闸 vs 余额闸」的相对顺序） */
export const fnFingerprint = async (ex: Qx): Promise<Record<string, unknown>> => {
  const r = await raw1<{ prosrc: string }>(ex, `SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='ledger_post_event' AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`);
  const src = r?.prosrc ?? '';
  const pos = (needle: string) => src.indexOf(needle);
  const ver = await raw1<{ v: string }>(ex, `SELECT version AS v FROM schema_migration ORDER BY version DESC LIMIT 1`);
  const idx = await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM pg_indexes
     WHERE schemaname='public' AND tablename='ledger_entry' AND indexname='idx_ledger_event_root_key'`);
  const gate = pos('0012-REPLAY-PRE-GATE-BEGIN');
  const lock = pos('account:for-update');
  const c5 = pos('C5 推演 + 前置判定');
  const r80 = pos('R80：库内先判');
  const onconf = pos('ON CONFLICT (idempotency_key) DO NOTHING');
  return {
    schema_version: ver?.v ?? null,
    prosrc_len: src.length, prosrc_md5: md5(src),
    pre_gate_present: gate >= 0,
    pos_pre_gate: gate, pos_c4_account_lock: lock, pos_c5_balance_section: c5, pos_r80_balance_gate: r80,
    pos_on_conflict_probe: onconf,
    order_ok_gate_after_lock_before_balance: gate >= 0 && gate > lock && gate < r80 && gate < c5,
    on_conflict_still_after_gate: onconf > gate,
    idx_ledger_event_root_key_rows: Number(idx?.n ?? '0'),
    on_conflict_probe_present: onconf >= 0,
  };
};

/** 「没碰别人钱」的证据：cid=1 与平台账户（排除本 run 新建的 cid）的余额快照哈希 */
export const moneyGuard = async (ex: Qx, excludeCids: string[]): Promise<Record<string, unknown>> => {
  const cid1 = await raw1<{ h: string; n: string; b: string }>(ex, `
    SELECT md5(COALESCE(string_agg(uid::text||':'||balance::text||':'||frozen::text, ',' ORDER BY uid), '')) AS h,
           count(*)::text AS n, COALESCE(sum(balance)::text,'0') AS b
      FROM account WHERE cid = 1`);
  const plat = await raw1<{ h: string; n: string; b: string }>(ex, `
    SELECT md5(COALESCE(string_agg(uid::text||':'||cid::text||':'||balance::text||':'||frozen::text, ',' ORDER BY uid, cid), '')) AS h,
           count(*)::text AS n, COALESCE(sum(balance)::text,'0') AS b
      FROM account WHERE uid IN (0,-1,-2,-3) AND NOT (cid = ANY($1::bigint[]))`, [excludeCids.length ? excludeCids : ['0']]);
  const led = await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM ledger_entry`);
  return { cid1: { hash: cid1?.h ?? null, rows: cid1?.n ?? null, balance_sum: cid1?.b ?? null },
    platform_other_cids: { hash: plat?.h ?? null, rows: plat?.n ?? null, balance_sum: plat?.b ?? null },
    ledger_entry_rows: Number(led?.n ?? '0') };
};

export { Pool };
