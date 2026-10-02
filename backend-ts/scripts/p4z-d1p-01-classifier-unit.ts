/*
 * p4z-d1p-01-classifier-unit.ts — D1' 分类器单测（离线；不连库、不起服务、不写库）
 * ============================================================================
 * 用例：
 *   U0  400 分支不变：33 码的 `status` / `bucket` / `i18n_key` **逐条**与冻结快照相等（本文件内联快照）
 *   U1  400 分支不变：带码 SQLSTATE 映射逐条对拍（含 08P01 必须**留 500**、42P01 保持 500）
 *   U2  **code == null 的驱动/传输错 ⇒ 503 + 机读 reason**（现取实测形态：Pool-over-WS 的 ErrorEvent、
 *       `NeonDbError{code:null,message:'Error connecting to database: fetch failed'}`、
 *       `Server error (HTTP status 502)`、裸 `fetch failed`）
 *   U3  **判负（不得过宽）**：无传输信号的裸错误（`new TypeError('bug')`）仍 **500**（DL126 铁律）
 *   U4  **鉴权面判负**：`/api/auth/verify` 的落库面异常经分类器 ⇒ **503 而非 401**（含 unwrap 真因路径）
 *        + 静态面：verify handler 内 `sendError(res, 401` 仅出现在凭据面那一段（DB 调用之前）
 *   U5  注册点 = 67（`src/index.ts` 内 `app.<method>(` 语句数，与 `p4z-b6audit-01-e2e.ts` 同口径）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-d1p-01-classifier-unit.ts
 * 产物：.p4-artifacts/p6d1p-<ts>/classifier-unit.json；退出码取自脚本自身（不经管道）。
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  LEDGER_ERROR_TABLE,
  LEDGER_ERROR_BUCKETS,
  LEDGER_ERROR_CODES,
  LEDGER_BENIGN_CODES,
  httpStatusOf,
  normalizeLedgerError,
  classifyNonPgError,
  isNullCodeDriverTransportError,
  toErrorResponse,
  type LedgerErrorCode,
} from '../src/ledger-errors';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', `p6d1p-unit-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z')}`));
fs.mkdirSync(outDir, { recursive: true });

const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
const t = (id: string, ok: boolean, detail: string) => { checks.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };

// ---- 冻结快照（改前现取，逐条内联；本单**不得**改表 ⇒ 必须逐条相等）
// 依据：本文件行内快照 = 批 6 前的 `LEDGER_ERROR_TABLE` / `LEDGER_ERROR_BUCKETS`（33 码）
const SNAPSHOT_STATUS: Record<string, number | null> = {
  LEDGER_INSUFFICIENT_BALANCE: 409, LEDGER_INSUFFICIENT_FROZEN: 409, LEDGER_IDEMPOTENCY_REPLAY: 200,
  LEDGER_IDEMPOTENCY_CONFLICT: 409, LEDGER_IDEMPOTENCY_KEY_REQUIRED: 400, LEDGER_IDEMPOTENCY_KEY_INVALID: 400,
  LEDGER_CURRENCY_NOT_FOUND: 404, LEDGER_CURRENCY_NOT_LISTED: 409, LEDGER_CURRENCY_FROZEN: 423,
  LEDGER_CURRENCY_DELISTED: 409, LEDGER_CURRENCY_INVALID_TRANSITION: 409, LEDGER_CURRENCY_SYMBOL_TAKEN: 409,
  LEDGER_CURRENCY_MISMATCH: 400, LEDGER_SUPPLY_CAP_EXCEEDED: 409, LEDGER_UNAUTHORIZED_MINT: 403,
  LEDGER_HOLD_NOT_ALLOWED: 403, LEDGER_AMOUNT_INVALID: 400, LEDGER_AMOUNT_NOT_POSITIVE: 400,
  LEDGER_DECIMALS_OVERFLOW: 400, LEDGER_SELF_TRANSFER: 400, LEDGER_ACCOUNT_NOT_FOUND: 404,
  LEDGER_RESERVED_UID: 400, LEDGER_REF_NOT_FOUND: 404, LEDGER_UNKNOWN_KIND: 400,
  LEDGER_TRANSACTION_REQUIRED: 500, LEDGER_LOCK_TIMEOUT: 503, LEDGER_TX_TIMEOUT: 503,
  LEDGER_DEADLOCK_RETRY_EXHAUSTED: 503, LEDGER_NEGATIVE_BALANCE_GUARD: 500, LEDGER_APPEND_ONLY_VIOLATION: 500,
  LEDGER_ACCOUNT_GUARD_VIOLATION: 500, LEDGER_FEE_RATE_INVALID: 500, LEDGER_RECONCILE_MISMATCH: null,
};
const SNAPSHOT_BUCKET: Record<string, string> = {
  LEDGER_IDEMPOTENCY_KEY_REQUIRED: 'input', LEDGER_IDEMPOTENCY_KEY_INVALID: 'input', LEDGER_IDEMPOTENCY_REPLAY: 'input',
  LEDGER_CURRENCY_MISMATCH: 'input', LEDGER_UNAUTHORIZED_MINT: 'input', LEDGER_HOLD_NOT_ALLOWED: 'input',
  LEDGER_AMOUNT_INVALID: 'input', LEDGER_AMOUNT_NOT_POSITIVE: 'input', LEDGER_DECIMALS_OVERFLOW: 'input',
  LEDGER_SELF_TRANSFER: 'input', LEDGER_RESERVED_UID: 'input', LEDGER_UNKNOWN_KIND: 'input',
  LEDGER_INSUFFICIENT_BALANCE: 'integrity', LEDGER_INSUFFICIENT_FROZEN: 'integrity', LEDGER_IDEMPOTENCY_CONFLICT: 'integrity',
  LEDGER_CURRENCY_NOT_FOUND: 'integrity', LEDGER_CURRENCY_NOT_LISTED: 'integrity', LEDGER_CURRENCY_FROZEN: 'integrity',
  LEDGER_CURRENCY_DELISTED: 'integrity', LEDGER_CURRENCY_INVALID_TRANSITION: 'integrity', LEDGER_SUPPLY_CAP_EXCEEDED: 'integrity',
  LEDGER_ACCOUNT_NOT_FOUND: 'integrity', LEDGER_REF_NOT_FOUND: 'integrity', LEDGER_CURRENCY_SYMBOL_TAKEN: 'integrity',
  LEDGER_LOCK_TIMEOUT: 'retryable', LEDGER_TX_TIMEOUT: 'retryable', LEDGER_DEADLOCK_RETRY_EXHAUSTED: 'retryable',
  LEDGER_TRANSACTION_REQUIRED: 'defect', LEDGER_NEGATIVE_BALANCE_GUARD: 'defect', LEDGER_APPEND_ONLY_VIOLATION: 'defect',
  LEDGER_ACCOUNT_GUARD_VIOLATION: 'defect', LEDGER_FEE_RATE_INVALID: 'defect', LEDGER_RECONCILE_MISMATCH: 'defect',
};

// ---- U0：33 码状态/桶逐条不变
const keySet = Object.keys(LEDGER_ERROR_TABLE).sort();
t('U0a_codes_33', LEDGER_ERROR_CODES.length === 33 && keySet.length === 33, `codes=${LEDGER_ERROR_CODES.length}`);
t('U0b_benign_1', LEDGER_BENIGN_CODES.length === 1 && LEDGER_BENIGN_CODES[0] === 'LEDGER_IDEMPOTENCY_REPLAY', `benign=${LEDGER_BENIGN_CODES.join(',')}`);
const statusDiff = keySet.filter((c) => LEDGER_ERROR_TABLE[c as LedgerErrorCode].status !== SNAPSHOT_STATUS[c]);
t('U0c_status_unchanged', statusDiff.length === 0, `diff=${JSON.stringify(statusDiff)}`);
const bucketDiff = keySet.filter((c) => LEDGER_ERROR_BUCKETS[c as LedgerErrorCode] !== SNAPSHOT_BUCKET[c]);
t('U0d_bucket_unchanged', bucketDiff.length === 0, `diff=${JSON.stringify(bucketDiff)}`);
const snapKeysMissing = Object.keys(SNAPSHOT_STATUS).filter((c) => !keySet.includes(c));
t('U0e_snapshot_covers_all', snapKeysMissing.length === 0 && keySet.every((c) => SNAPSHOT_STATUS[c] !== undefined), `missing_in_snapshot=${JSON.stringify(snapKeysMissing)}`);
t('U0f_reconcile_null_to_500', httpStatusOf('LEDGER_RECONCILE_MISMATCH') === 500, `httpStatusOf(LD032)=${httpStatusOf('LEDGER_RECONCILE_MISMATCH')}`);
t('U0g_replay_benign_200', httpStatusOf('LEDGER_IDEMPOTENCY_REPLAY') === 200, `httpStatusOf(LD006)=${httpStatusOf('LEDGER_IDEMPOTENCY_REPLAY')}`);

// ---- U1：带码（400 分支）映射逐条不变
type Case = { name: string; input: Record<string, unknown>; code: string; status: number; reason?: string | null };
const codedCases: Case[] = [
  { name: '23514/account_bal_guard', input: { code: '23514', constraint: 'account_bal_guard' }, code: 'LEDGER_NEGATIVE_BALANCE_GUARD', status: 500 },
  { name: '23514/currency_supply_guard', input: { code: '23514', constraint: 'currency_supply_guard' }, code: 'LEDGER_SUPPLY_CAP_EXCEEDED', status: 409 },
  { name: '23514/ledger_kind_enum', input: { code: '23514', constraint: 'ledger_kind_enum' }, code: 'LEDGER_UNKNOWN_KIND', status: 400 },
  { name: '23514/other', input: { code: '23514', constraint: 'whatever' }, code: 'LEDGER_AMOUNT_INVALID', status: 400 },
  { name: '23505/ledger_idem_uniq', input: { code: '23505', constraint: 'ledger_idem_uniq' }, code: 'LEDGER_IDEMPOTENCY_CONFLICT', status: 409 },
  { name: '23503/fk', input: { code: '23503', constraint: 'account_uid_fkey' }, code: 'LEDGER_CURRENCY_NOT_FOUND', status: 404 },
  { name: '55P03', input: { code: '55P03' }, code: 'LEDGER_LOCK_TIMEOUT', status: 503 },
  { name: '57014', input: { code: '57014' }, code: 'LEDGER_TX_TIMEOUT', status: 503 },
  { name: '40001', input: { code: '40001' }, code: 'LEDGER_DEADLOCK_RETRY_EXHAUSTED', status: 503 },
  { name: '40P01', input: { code: '40P01' }, code: 'LEDGER_DEADLOCK_RETRY_EXHAUSTED', status: 503 },
  { name: '08P01_must_stay_500', input: { code: '08P01', message: 'unsupported startup parameter' }, code: 'LEDGER_TRANSACTION_REQUIRED', status: 500, reason: 'protocol_violation' },
  { name: '08006_infra_class', input: { code: '08006' }, code: 'LEDGER_TX_TIMEOUT', status: 503 },
  { name: '53300_infra_class', input: { code: '53300' }, code: 'LEDGER_TX_TIMEOUT', status: 503 },
  { name: '3D000_infra_class', input: { code: '3D000' }, code: 'LEDGER_TX_TIMEOUT', status: 503 },
  { name: '42P01_unchanged_500', input: { code: '42P01', message: 'relation "asset" does not exist' }, code: 'LEDGER_TRANSACTION_REQUIRED', status: 500, reason: 'unclassified_pg_error' },
  { name: 'P0001_append_only', input: { code: 'P0001', message: 'ledger_entry is append-only' }, code: 'LEDGER_APPEND_ONLY_VIOLATION', status: 500 },
  { name: 'named_LEDGER_TX_TIMEOUT', input: { code: 'LEDGER_TX_TIMEOUT' }, code: 'LEDGER_TX_TIMEOUT', status: 503 },
];
const codedOut: unknown[] = [];
for (const c of codedCases) {
  const n = normalizeLedgerError(c.input);
  const r = toErrorResponse(n);
  const reason = (r.error.details as { reason?: string }).reason ?? null;
  const pass = n.code === c.code && n.httpStatus === c.status && (c.reason === undefined || reason === c.reason);
  codedOut.push({ name: c.name, code: n.code, http_status: n.httpStatus, reason, expect: { code: c.code, status: c.status, reason: c.reason ?? null }, pass });
  t(`U1_${c.name}`, pass, `got ${n.code}/${n.httpStatus}/reason=${reason} expect ${c.code}/${c.status}/${c.reason ?? '-'}`);
}

// ---- U2：无码驱动/传输错 ⇒ 503（现取实测形态）
const wsEventEvent = (() => {
  // Pool-over-WS 实测形态：`ws` 的 ErrorEvent（own props 只有 stack；type/message 原型 getter；内层 .error 有码）
  const inner: Record<string, unknown> = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:443' };
  const ev = Object.create({ type: 'error' });
  Object.defineProperty(ev, 'message', { get: () => 'connect ECONNREFUSED 127.0.0.1:443', enumerable: true });
  (ev as Record<string, unknown>).error = inner;
  return ev;
})();
const nullCodeCases: Array<{ name: string; input: unknown; reason: string }> = [
  { name: 'neon_db_error_fetch_failed', input: { name: 'NeonDbError', code: null, message: 'Error connecting to database: fetch failed', sourceError: { name: 'TypeError', message: 'fetch failed', cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:443' } } }, reason: 'driver_connection_error' },
  { name: 'server_error_http_502', input: { name: 'NeonDbError', code: null, message: 'Server error (HTTP status 502): <html>bad gateway</html>' }, reason: 'driver_connection_error' },
  { name: 'bare_fetch_failed', input: new TypeError('fetch failed'), reason: 'driver_connection_error' },
  { name: 'wrapped_no_message_cause_code', input: Object.assign(new Error('Error connecting to database'), { code: null, sourceError: { code: 'ECONNRESET' } }), reason: 'driver_connection_error' },
  { name: 'pool_connection_timeout_unchanged', input: { code: null, message: 'timeout exceeded when trying to connect' }, reason: 'pool_connection_timeout' },
  { name: 'ws_error_event_family', input: wsEventEvent, reason: 'driver_connection_error' },
];
const nullCodeOut: unknown[] = [];
for (const c of nullCodeCases) {
  const n = normalizeLedgerError(c.input);
  const r = toErrorResponse(n);
  const reason = (r.error.details as { reason?: string }).reason ?? null;
  const cls = classifyNonPgError(c.input);
  const pass = n.httpStatus === 503 && n.code === 'LEDGER_TX_TIMEOUT' && reason === c.reason;
  nullCodeOut.push({ name: c.name, code: n.code, http_status: n.httpStatus, reason, classifier: cls, is_null_code_transport: isNullCodeDriverTransportError(c.input), expect: { status: 503, reason: c.reason }, pass, response_error: r.error });
  t(`U2_${c.name}`, pass, `got ${n.code}/${n.httpStatus}/reason=${reason} (classifier=${cls}) expect 503/${c.reason}`);
}

// ---- U3：判负 —— 不得过宽（无传输信号的裸错误仍 500）
const negCases: Array<{ name: string; input: unknown; status: number; code: string }> = [
  { name: 'bare_TypeError_defect_stays_500', input: new TypeError('bug'), status: 500, code: 'LEDGER_TRANSACTION_REQUIRED' },
  { name: 'bare_Error_defect_stays_500', input: new Error('boom'), status: 500, code: 'LEDGER_TRANSACTION_REQUIRED' },
  { name: 'plain_object_no_code_stays_500', input: { message: 'internal invariant broken' }, status: 500, code: 'LEDGER_TRANSACTION_REQUIRED' },
  { name: 'unknown_pg_sqlstate_stays_500', input: { code: '22012', message: 'division by zero' }, status: 500, code: 'LEDGER_TRANSACTION_REQUIRED' },
];
for (const c of negCases) {
  const n = normalizeLedgerError(c.input);
  const det = n.details as { reason?: string };
  const pass = n.httpStatus === c.status && n.code === c.code && isNullCodeDriverTransportError(c.input) === false;
  t(`U3_${c.name}`, pass, `got ${n.code}/${n.httpStatus} reason=${det.reason ?? '-'} expect ${c.code}/${c.status}`);
}

// ---- U4：鉴权面 —— 落库面异常 ⇒ 503 而非 401（+ 静态面边界）
const authShape = { name: 'NeonDbError', code: null, message: 'Error connecting to database: fetch failed', sourceError: { cause: { code: 'ECONNRESET' } } };
// 路由层 `unwrapInfraCause` 的等价下沉（index.ts:193）：沿 cause/sourceError/error 找第一个有码的后代
const unwrapLike = (e: unknown, depth = 0): unknown => {
  const o = e as Record<string, unknown>;
  if (o && typeof o.code === 'string' && o.code) return e;
  if (depth >= 3 || !o || typeof o !== 'object') return e;
  for (const k of ['cause', 'sourceError', 'error']) {
    const child = o[k];
    if (!child || typeof child !== 'object') continue;
    const r = unwrapLike(child, depth + 1);
    if ((r as { code?: string })?.code) return r;
  }
  return e;
};
const authNorm = normalizeLedgerError(unwrapLike(authShape));
const authNoUnwrap = normalizeLedgerError(authShape);
t('U4a_auth_infra_503_not_401', authNorm.httpStatus === 503 && authNorm.httpStatus !== 401, `verify 面（unwrap 真因）⇒ ${authNorm.code}/${authNorm.httpStatus}`);
t('U4b_auth_infra_503_no_unwrap', authNoUnwrap.httpStatus === 503 && authNoUnwrap.httpStatus !== 401, `verify 面（顶层 code=null 形态）⇒ ${authNoUnwrap.code}/${authNoUnwrap.httpStatus}`);
const idxSrc = fs.readFileSync(path.join(REPO, 'src', 'index.ts'), 'utf8');
const verifyStart = idxSrc.indexOf("app.post('/api/auth/verify'");
const verifyEnd = idxSrc.indexOf("app.post('/api/auth/login'");
const verifyBody = idxSrc.slice(verifyStart, verifyEnd);
// 计数只看**代码行**（注释里引用了修前的 `sendError(res, 401 …)` 原文，不得计入）
const verifyCodeOnly = verifyBody.split('\n').filter((l) => {
  const s = l.trim();
  return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*');
}).join('\n');
const fourOhOneCount = (verifyCodeOnly.match(/sendError\(res, 401/g) || []).length;
const dbCallAt = verifyBody.indexOf('findOrCreateUserByEvm');
const first401At = verifyCodeOnly.indexOf('sendError(res, 401');
const second401At = verifyCodeOnly.indexOf('sendError(res, 401', first401At + 1);
t('U4c_verify_has_classifier', verifyBody.includes('normalizeLedgerError(unwrapInfraCause(error))'), `verify handler 落库面走 §14 分类器`);
t('U4d_verify_no_trailing_catchall_401', fourOhOneCount === 1 && second401At === -1, `sendError(res,401) 计数=${fourOhOneCount}（须=1，且仅凭据面）`);
t('U4e_401_precedes_db_call', first401At > -1 && dbCallAt > -1 && first401At < dbCallAt, `401 段位置=${first401At} < DB 调用=${dbCallAt}`);
t('U4f_other_auth_entry_challenge_400', idxSrc.includes("sendError(res, 400, error instanceof Error ? error.message : 'Failed to create auth challenge')"), `challenge 面仍 400（不碰库 ⇒ 不变）`);

// ---- U5：注册点 67（同 p4z-b6audit-01-e2e.ts 口径）
const regs = (idxSrc.match(/^app\.(get|post|patch|delete|put)\(/gm) || []).length;
t('U5_registrations_67', regs === 67, `注册点=${regs}`);

const total = checks.length;
const passed = checks.filter((c) => c.ok).length;
const report = { run: path.basename(outDir), engine: 'p4z-d1p-01-classifier-unit', offline: true, db_connections: 0, api_calls: 0, total, passed, failed: total - passed, checks, coded_cases: codedOut, null_code_cases: nullCodeOut };
fs.writeFileSync(path.join(outDir, 'classifier-unit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`SUMMARY total=${total} passed=${passed} failed=${total - passed} artifact=${path.join(outDir, 'classifier-unit.json')}`);
if (total - passed > 0) process.exitCode = 1;
