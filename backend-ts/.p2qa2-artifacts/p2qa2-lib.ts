/**
 * p2qa2 自用探针库（Neng · 0012 独立质检）
 * ============================================================================
 * 与实现方脚本（p1xx/p2d/p2x）**完全隔离**：自包含（只依赖 @neondatabase/serverless + ws），
 * 唯一外部 import 是仓库既有的 `scripts/ns-alloc`（硬约束要求复用，不得手写扫描）。
 * 命名空间：uid **961xxx** / symbol 前缀 **p2qa2** / 幂等键前缀 **ops:p2qa2:**。
 * 绝不触碰 cid = 1 与平台账户 0/-1/-2/-3 的既有余额（moneyGuard 前后哈希自证）。
 * 落盘一律 run-tagged（`<name>-<RUN>.json`），**永不**用固定文件名。
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
export const POOLED_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
export const RUN = process.env.P2QA2_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
export const OUT_DIR = path.resolve(__dirname);
export const BACKEND = path.resolve(__dirname, '..');
export const REPO = path.resolve(__dirname, '..', '..');
export const PHASE = process.env.P2QA2_PHASE || 'after';

export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export interface Qx { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; }

/** 瞬时 TLS 抖动重试（`Client network socket disconnected before secure TLS connection was established`） */
export const NET_RETRIES = { n: 0, last: null as string | null };
export const retryNet = async <T>(fn: () => Promise<T>, attempts = 6, label = ''): Promise<T> => {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      const m = String((e as Error)?.message ?? e);
      const transient = /socket disconnected|ECONNRESET|ETIMEDOUT|Connection terminated|terminating connection|TLS/i.test(m);
      if (!transient || i === attempts - 1) throw e;
      NET_RETRIES.n++; NET_RETRIES.last = `${label}: ${m.slice(0, 120)}`;
      await sleep(400 * (i + 1));
    }
  }
  throw lastErr as Error;
};

export const raw = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R[]> =>
  retryNet(async () => (await ex.query(sql, params)).rows as R[], 6, sql.slice(0, 60));
export const raw1 = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(ex, sql, params))[0] ?? null;

export const sha256 = (v: unknown): string =>
  crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
export const md5 = (v: string): string => crypto.createHash('md5').update(v).digest('hex');
export const sha256File = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** 落 run-tagged 读数（绝不覆盖已存在文件；同名即加 -<k>） */
export const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  let k = 1;
  while (fs.existsSync(file)) file = path.join(OUT_DIR, `${name}-${RUN}-${k++}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, phase: PHASE, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- PG 错误
export interface PgErr { name: string; message: string; sqlstate: string | null; code: string | null; detail: string | null; reason: string | null; hint: string | null; own: string[]; }
export const pgErr = (e: unknown): PgErr => {
  const anyE = e as Record<string, unknown>;
  const own = Object.getOwnPropertyNames(e ?? {});
  const detail = anyE?.detail == null ? null : String(anyE.detail);
  // 本库纪律：读 PG 错误的 reason 在 e.detail（先倒出 own property names）
  let reason: string | null = null;
  if (detail) {
    try { const j = JSON.parse(detail); reason = j?.reason ?? j?.code ?? null; } catch { reason = null; }
  }
  const m = String(anyE?.message ?? e);
  const mm = /reason["'\s:=]+([A-Z0-9_]+)/.exec(m);
  if (!reason && mm) reason = mm[1];
  return {
    name: String(anyE?.name ?? 'Error'), message: m.slice(0, 800),
    sqlstate: (anyE?.code as string) ?? null, code: (anyE?.code as string) ?? null,
    detail, reason, hint: anyE?.hint == null ? null : String(anyE.hint), own,
  };
};

// ---------------------------------------------------------------- 账本调用
export const callFn = async (ex: Qx, payload: unknown, timeoutMs?: number): Promise<Record<string, unknown>> => {
  if (timeoutMs) await ex.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
  const r = await ex.query('SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  const v = (r.rows[0] as { r: unknown })?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
};

export interface FnRead { ok: boolean; replay: boolean; rows: number; error: PgErr | null; raw: Record<string, unknown> | null; ms: number; }
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

let spSeq = 0;
export const tryFnSp = async (ex: Qx, payload: unknown): Promise<FnRead> => {
  const sp = `p2qa2_sp_${++spSeq}`;
  await ex.query(`SAVEPOINT ${sp}`);
  const r = await tryFn(ex, payload);
  try { await ex.query(r.error ? `ROLLBACK TO SAVEPOINT ${sp}` : `RELEASE SAVEPOINT ${sp}`); } catch { /* noop */ }
  return r;
};

/** 一条调用的可对比读数（逐字 JSON + entries/accounts 摘要哈希 + extra） */
export const obs = (r: FnRead): Record<string, unknown> => ({
  ok: r.ok, idempotent_replay: r.replay, entries_n: r.rows, ms: r.ms,
  sqlstate: r.error?.sqlstate ?? null, reason: r.error?.reason ?? null, err_message: r.error?.message ?? null,
  txid: (r.raw?.txid as string) ?? null,
  result_keys: r.raw ? Object.keys(r.raw).sort() : null,
  entries_sha256: r.raw?.entries ? sha256(r.raw.entries) : null,
  accounts_sha256: r.raw?.accounts ? sha256(r.raw.accounts) : null,
  extra: r.raw?.extra ?? null,
  extra_n_keys: r.raw?.extra && typeof r.raw.extra === 'object' ? Object.keys(r.raw.extra as object).length : null,
  raw_json: r.raw ? JSON.stringify(r.raw) : null,
});

export const inRollbackTx = async <T>(p: Pool, fn: (c: Qx) => Promise<T>, timeoutMs?: number):
Promise<{ result: T | null; error: unknown | null; rolled_back: boolean; ms: number }> => {
  const t0 = Date.now();
  const c = await p.connect();
  let result: T | null = null; let error: unknown | null = null;
  try {
    await c.query('BEGIN');
    if (timeoutMs) await c.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    result = await fn(c as unknown as Qx);
  } catch (e) { error = e; }
  finally {
    try { await c.query('ROLLBACK'); } catch { /* noop */ }
    c.release();
  }
  return { result, error, rolled_back: true, ms: Date.now() - t0 };
};

export interface Tx { q: Qx; commit: () => Promise<PgErr | null>; rollback: () => Promise<void>; released: boolean; }
export const beginTx = async (p: Pool, timeoutMs?: number): Promise<Tx> => {
  const c = await p.connect();
  await c.query('BEGIN');
  if (timeoutMs) await c.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
  const tx: Tx = {
    q: c as unknown as Qx, released: false,
    commit: async () => {
      try { await c.query('COMMIT'); tx.released = true; return null; }
      catch (e) { try { await c.query('ROLLBACK'); } catch { /* noop */ } c.release(); tx.released = true; return pgErr(e); }
    },
    rollback: async () => { try { await c.query('ROLLBACK'); } catch { /* noop */ } if (!tx.released) { c.release(); tx.released = true; } },
  };
  return tx;
};

// ---------------------------------------------------------------- 夹具
export const ensureUsers = async (ex: Qx, uids: Array<number | string>): Promise<void> => {
  await ex.query(`INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                    FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [uids.map(String)]);
};

export const ensureCurrency = async (ex: Qx, symbol: string, ownerUid: string, decimals: number): Promise<string> => {
  const found = await raw1<{ cid: string }>(ex, `SELECT cid::text AS cid FROM currency WHERE symbol = $1 LIMIT 1`, [symbol]);
  if (found) return String(found.cid);
  const r = await raw1<{ cid: string }>(ex, `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
    VALUES ($1, $2, $3, $4, 0, 'listed', now()) RETURNING cid::text AS cid`, [symbol, `P2QA2 ${symbol}`, ownerUid, decimals]);
  return String((r as { cid: string }).cid);
};

export const ledgerRowsFor = async (ex: Qx, key: string): Promise<number> =>
  Number((await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM ledger_entry
     WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1`, [key]))?.n ?? '-1');

export const acct = async (ex: Qx, uid: string, cid: string): Promise<Record<string, unknown>> =>
  (await raw1<Record<string, unknown>>(ex, `SELECT uid::text, cid::text, balance::text, frozen::text FROM account
      WHERE uid = $1::bigint AND cid = $2::bigint`, [uid, cid])) ?? { uid, cid, balance: null, frozen: null };

// ---------------------------------------------------------------- 库内指纹
export interface FnRead2 { src: string; prosrc_len: number; prosrc_md5: string; schema_version: string | null;
  pos_pre_gate: number; pos_c4_account_lock: number; pos_c5_balance_section: number; pos_r80_balance_gate: number;
  pos_on_conflict_probe: number; gate_body: string | null; gate_body_stripped: string | null; gate_body_write_tokens: string[];
  all_gate_markers: Array<{ marker: string; pos: number }>; }

export const FN_SRC_SQL = `SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='ledger_post_event' AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`;

export const fnSrc = async (ex: Qx): Promise<string> => (await raw1<{ prosrc: string }>(ex, FN_SRC_SQL))?.prosrc ?? '';

/** 剥掉 SQL 注释（行注释 + 块注释，含嵌套）——闸体只读性断言必须在这一份上做 */
export const stripSqlComments = (s: string): string => {
  let out = ''; let i = 0;
  while (i < s.length) {
    if (s[i] === '-' && s[i + 1] === '-') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (s[i] === '/' && s[i + 1] === '*') {
      let depth = 1; i += 2;
      while (i < s.length && depth > 0) {
        if (s[i] === '/' && s[i + 1] === '*') { depth++; i += 2; continue; }
        if (s[i] === '*' && s[i + 1] === '/') { depth--; i += 2; continue; }
        i++;
      }
      continue;
    }
    if (s[i] === "'") { // 字符串字面量原样保留
      out += s[i++];
      while (i < s.length) { out += s[i]; if (s[i] === "'") { if (s[i + 1] === "'") { out += s[++i]; i++; continue; } i++; break; } i++; }
      continue;
    }
    out += s[i++];
  }
  return out;
};

export const posOf = (src: string, needle: string): number => src.indexOf(needle);

export const extractBetween = (src: string, beginMarker: string, endMarker: string): string | null => {
  const a = src.indexOf(beginMarker); if (a < 0) return null;
  const b = src.indexOf(endMarker, a + beginMarker.length); if (b < 0) return null;
  return src.slice(a + beginMarker.length, b);
};

export const WRITE_TOKENS = ['insert', 'update', 'delete', 'for update', 'for share', 'lock table', 'set constraints', 'truncate', 'merge', 'copy'];
export const scanWriteTokens = (stripped: string): string[] =>
  WRITE_TOKENS.filter((t) => new RegExp(`(^|[^a-z_])${t.replace(' ', '\\s+')}([^a-z_]|$)`, 'i').test(stripped));

export const fnFingerprint = async (ex: Qx): Promise<FnRead2> => {
  const src = await fnSrc(ex);
  const ver = await raw1<{ v: string }>(ex, `SELECT version AS v FROM schema_migration ORDER BY version DESC LIMIT 1`);
  const gate = extractBetween(src, '0012-REPLAY-PRE-GATE-BEGIN', '0012-REPLAY-PRE-GATE-END');
  const stripped = gate == null ? null : stripSqlComments(gate);
  const marks = ['0012-REPLAY-PRE-GATE-BEGIN', '0012-REPLAY-PRE-GATE-END', '0012-REPLAY-PRE-GATE'];
  return {
    src, prosrc_len: src.length, prosrc_md5: md5(src), schema_version: ver?.v ?? null,
    pos_pre_gate: posOf(src, '0012-REPLAY-PRE-GATE-BEGIN'),
    pos_c4_account_lock: posOf(src, 'account:for-update'),
    pos_c5_balance_section: posOf(src, 'C5 推演 + 前置判定'),
    pos_r80_balance_gate: posOf(src, 'R80：库内先判'),
    pos_on_conflict_probe: posOf(src, 'ON CONFLICT (idempotency_key) DO NOTHING'),
    gate_body: gate, gate_body_stripped: stripped,
    gate_body_write_tokens: stripped == null ? [] : scanWriteTokens(stripped),
    all_gate_markers: marks.map((m) => ({ marker: m, pos: posOf(src, m) })),
  };
};

export const moneyGuard = async (ex: Qx, excludeCids: string[] = []): Promise<Record<string, unknown>> => {
  const cid1 = await raw1<{ h: string; n: string; b: string; f: string }>(ex, `
    SELECT md5(COALESCE(string_agg(uid::text||':'||balance::text||':'||frozen::text, ',' ORDER BY uid), '')) AS h,
           count(*)::text AS n, COALESCE(sum(balance)::text,'0') AS b, COALESCE(sum(frozen)::text,'0') AS f
      FROM account WHERE cid = 1`);
  const plat = await raw1<{ h: string; n: string; b: string; f: string }>(ex, `
    SELECT md5(COALESCE(string_agg(uid::text||':'||cid::text||':'||balance::text||':'||frozen::text, ',' ORDER BY uid, cid), '')) AS h,
           count(*)::text AS n, COALESCE(sum(balance)::text,'0') AS b, COALESCE(sum(frozen)::text,'0') AS f
      FROM account WHERE uid IN (0,-1,-2,-3) AND NOT (cid = ANY($1::bigint[]))`,
  [excludeCids.length ? excludeCids : ['0']]);
  const led = await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM ledger_entry`);
  return {
    cid1: { hash: cid1?.h ?? null, rows: cid1?.n ?? null, balance_sum: cid1?.b ?? null, frozen_sum: cid1?.f ?? null },
    platform_other_cids: { hash: plat?.h ?? null, rows: plat?.n ?? null, balance_sum: plat?.b ?? null, frozen_sum: plat?.f ?? null },
    ledger_entry_rows: Number(led?.n ?? '0'),
  };
};

export { Pool };
