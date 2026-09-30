// p4z-errfid-01-mech.ts — ERRCODE-AUDIT **机制取证**（只读取数；无 DDL/DML；不发写请求）
// ============================================================================
// 目的：证明（或推翻）「`ledger_raise` 的自定义 SQLSTATE 经 `@neondatabase/serverless@0.6.1`
//       的 HTTP 驱动（`neon()`）后 `error.code` 是否丢失」。
// 口径（㊳ · §5.7）：
//   · 一律走 HTTP 驱动的 `neon()`（**不**用 `Client`(ws)）；0.6.1 无 `.query` ⇒ 自适应；
//   · 只跑 **`SELECT`**：`ledger_raise()` 是 `RETURNS void` 的纯抛出出口（抛即语句回滚，**零副作用**），
//     `ledger_sqlstate_of()` 是 IMMUTABLE 映射函数；对照组为 `1/0` / 不存在的表 / 不存在的列；
//   · 每条错误都做**双路取证**：① 驱动层原始形态（`constructor.name` / `Object.keys` / `code` /
//     `message` / `detail` / `constraint`）；② 项目自己的分类器给出的**对外 HTTP 状态**
//     （复刻 `ledger.ts` 的 `runLedgerFn` 错误路径：`ledgerErrorFromDbError(e) ?? normalizeLedgerError(e)`）。
// 用法：
//   node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-errfid-01-mech.ts <outDirAbs>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'errfid-probe'));
fs.mkdirSync(outDir, { recursive: true });

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless');
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));

const run = async (q: string, params: unknown[] = []): Promise<unknown[]> => {
  const anySql = sqlRaw as unknown as {
    (t: string, p?: unknown[]): Promise<unknown[]>;
    query?: (t: string, p?: unknown[]) => Promise<unknown[]>;
    unsafe?: (t: string, p?: unknown[]) => Promise<unknown[]>;
  };
  if (typeof anySql.query === 'function') return (await anySql.query(q, params)) as unknown[];
  if (typeof anySql.unsafe === 'function' && params.length) return (await anySql.unsafe(q, params)) as unknown[];
  return (await anySql(q, params)) as unknown[];
};

// 项目分类器（纯函数模块；`ledger.ts` 可能带 DB 侧副作用 ⇒ 动态 require + 失败降级）
let ledgerErrorFromDbError: ((e: unknown, k?: string) => unknown) | null = null;
let ledgerImportError: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../src/ledger');
  ledgerErrorFromDbError = mod.ledgerErrorFromDbError as (e: unknown, k?: string) => unknown;
} catch (e) { ledgerImportError = (e as Error)?.message ?? String(e); }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const le = require('../src/ledger-errors');
const normalizeLedgerError = le.normalizeLedgerError as (e: unknown) => { code: string; httpStatus: number; message: string; details: Record<string, unknown> };
const infraSqlstateReason = le.infraSqlstateReason as (c: string) => string | null;
const classifyNonPgError = le.classifyNonPgError as (e: unknown) => string | null;

const describeErr = (e: unknown) => {
  const err = e as Record<string, unknown> & { name?: string; message?: string; constructor?: { name?: string } };
  const own: string[] = [];
  try { own.push(...Object.getOwnPropertyNames(e as object)); } catch { own.push('<THREW>'); }
  const g = (k: string) => { try { const v = (e as Record<string, unknown>)[k]; return v === undefined ? '<undefined>' : v; } catch { return '<THREW>'; } };
  return {
    ctor: (err?.constructor?.name ?? '<none>'),
    name: g('name'), code: g('code'), message: g('message'), detail: g('detail'),
    constraint: g('constraint'), severity: g('severity'), sourceError: g('sourceError') === '<undefined>' ? '<undefined>' : '<present>',
    own_props: own,
    keys: (() => { try { return Object.keys(e as object); } catch { return ['<THREW>']; } })(),
  };
};

const outward = (e: unknown) => {
  let viaLedger: ReturnType<typeof normalizeLedgerError> | null = null;
  if (ledgerErrorFromDbError) {
    try { viaLedger = ledgerErrorFromDbError(e) as ReturnType<typeof normalizeLedgerError> | null; } catch (x) { viaLedger = null; }
  }
  const norm = normalizeLedgerError(e);
  const picked = viaLedger ?? norm;
  return {
    via_ledgerErrorFromDbError: viaLedger ? { code: viaLedger.code, httpStatus: viaLedger.httpStatus } : null,
    normalizeLedgerError: { code: norm.code, httpStatus: norm.httpStatus, message: norm.message, details: norm.details },
    outward_code: picked.code,
    outward_http_status: picked.httpStatus,
  };
};

type Case = { id: string; sql: string; expect_sqlstate: string; note: string };
const CASES: Case[] = [
  { id: 'LD021', sql: `SELECT public.ledger_raise('LEDGER_RESERVED_UID','{}'::jsonb)`, expect_sqlstate: 'LD021', note: '立案案由：保留 uid' },
  { id: 'LD001', sql: `SELECT public.ledger_raise('LEDGER_INSUFFICIENT_BALANCE','{}'::jsonb)`, expect_sqlstate: 'LD001', note: '余额不足' },
  { id: 'LD002', sql: `SELECT public.ledger_raise('LEDGER_INSUFFICIENT_FROZEN','{}'::jsonb)`, expect_sqlstate: 'LD002', note: 'hold 配对 / 冻结不足' },
  { id: 'LD003', sql: `SELECT public.ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT','{}'::jsonb)`, expect_sqlstate: 'LD003', note: '幂等冲突' },
  { id: 'LD017', sql: `SELECT public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE','{}'::jsonb)`, expect_sqlstate: 'LD017', note: '金额非法（非正）' },
  { id: 'LD022', sql: `SELECT public.ledger_raise('LEDGER_REF_NOT_FOUND','{}'::jsonb)`, expect_sqlstate: 'LD022', note: '引用不存在' },
  { id: 'LD023', sql: `SELECT public.ledger_raise('LEDGER_UNKNOWN_KIND','{}'::jsonb)`, expect_sqlstate: 'LD023', note: '未知 kind' },
  { id: 'LD007', sql: `SELECT public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND','{}'::jsonb)`, expect_sqlstate: 'LD007', note: '币种不存在（404）' },
  { id: 'LD027', sql: `SELECT public.ledger_raise('LEDGER_DEADLOCK_RETRY_EXHAUSTED','{}'::jsonb)`, expect_sqlstate: 'LD027', note: '死锁重试耗尽（503）' },
  { id: 'CTRL_22012', sql: `SELECT 1/0`, expect_sqlstate: '22012', note: '对照组：标准 SQLSTATE 除零' },
  { id: 'CTRL_42P01', sql: `SELECT * FROM public.__p4z_no_such_table__`, expect_sqlstate: '42P01', note: '对照组：标准 SQLSTATE 表不存在' },
  { id: 'CTRL_42703', sql: `SELECT __p4z_no_such_col__ FROM public.ledger_entry LIMIT 1`, expect_sqlstate: '42703', note: '对照组：标准 SQLSTATE 列不存在' },
];

(async () => {
  const out: Record<string, unknown> = { run_tag: path.basename(outDir), started_at: new Date().toISOString(), driver_version: null, ledger_import_error: ledgerImportError, sqlstate_map: null, cases: [] as unknown[] };
  try {
    out.driver_version = JSON.parse(fs.readFileSync(path.join(REPO, 'node_modules/@neondatabase/serverless/package.json'), 'utf8')).version;
  } catch { out.driver_version = '<unreadable>'; }

  // 0) DB 侧映射真源：码名 → 自定义 SQLSTATE（只读 IMMUTABLE 函数）
  try {
    const rows = await run(`SELECT public.ledger_sqlstate_of('LEDGER_RESERVED_UID') AS a,
                                   public.ledger_sqlstate_of('LEDGER_INSUFFICIENT_BALANCE') AS b,
                                   public.ledger_sqlstate_of('LEDGER_UNKNOWN_KIND') AS c`) as Record<string, unknown>[];
    out.sqlstate_map = rows?.[0] ?? null;
  } catch (e) { out.sqlstate_map = { error: String((e as Error)?.message ?? e) }; }

  for (const c of CASES) {
    const rec: Record<string, unknown> = { id: c.id, note: c.note, expect_sqlstate: c.expect_sqlstate, sql: c.sql };
    try {
      const rows = await run(c.sql);
      rec.outcome = 'NO_ERROR';
      rec.rows = rows;
    } catch (e) {
      rec.outcome = 'THREW';
      rec.raw = describeErr(e);
      const code = String((e as { code?: unknown })?.code ?? '');
      rec.raw_code_value = code;
      rec.raw_code_is_expected_sqlstate = code === c.expect_sqlstate;
      rec.driver_http_status_leak = /^Server error \(HTTP status (\d+)\)/.test(String((e as { message?: unknown })?.message ?? ''))
        ? (String((e as { message?: unknown })?.message ?? '').match(/HTTP status (\d+)/) as RegExpMatchArray)[1]
        : null;
      rec.metrics = { is_sqlstate_shape: /^[0-9A-Z]{5}$/.test(code) };
      try { rec.infra_reason = infraSqlstateReason(code); } catch { rec.infra_reason = '<THREW>'; }
      try { rec.non_pg_class = classifyNonPgError(e); } catch { rec.non_pg_class = '<THREW>'; }
      rec.chain = outward(e);
    }
    (out.cases as unknown[]).push(rec);
  }
  out.finished_at = new Date().toISOString();
  const p = path.join(outDir, 'mech-cases.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  // 终端摘要（逐案一行，便于 grep 读数）
  for (const r of out.cases as Record<string, unknown>[]) {
    const raw = (r.raw ?? {}) as Record<string, unknown>;
    const ch = (r.chain ?? {}) as Record<string, unknown>;
    console.log([r.id, r.outcome, `code=${JSON.stringify(raw.code)}`, `msg=${JSON.stringify(String(raw.message ?? '').slice(0, 60))}`,
      `outward=${ch.outward_code}/${ch.outward_http_status}`, `non_pg=${JSON.stringify(r.non_pg_class)}`].join(' | '));
  }
  console.log('ARTIFACT', p);
})().catch((e) => { console.error('FATAL', (e as Error)?.stack ?? e); process.exit(1); });
