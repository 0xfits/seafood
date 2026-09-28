/**
 * P3T-00 · 「非 PG 事件对象族」分类缺口 —— **修前 / 修后同一探针**
 * ============================================================================
 * 单（Unit E / P3-ERRORS-FOLD-FIX · Kong）自建验证探针。**纯函数 · 零 DB / 零网络 I/O**
 *   —— 本脚本不 import `src/db.ts`、不建连接池、不碰任何真实数据；唯一的写落盘是它**自己的**
 *      run-tagged artifact（`.p3t-artifacts/`，同名拒写，见 `writeArtifact`）。
 *
 * ---------------------------------------------------------------- 被测对象（真实缺陷）
 * `ws` 的连接建立期故障以 **事件对象**（`ErrorEvent`）形态冒到 `classifyNonPgError`：
 *   `message` 是**原型上的 getter**（非 own 属性）⇒ `pgMessage()` 读到 `''` / 或读到内容但
 *   `code` 为空 ⇒ 判据覆盖不足 ⇒ `unclassified_non_pg_error` ⇒ 不在 `TRANSIENT_NON_PG_REASONS`
 *   ⇒ 跳过 503 通路 ⇒ 落到 `LEDGER_TRANSACTION_REQUIRED`（**LD024 / 500**）。
 *   违 `DL126`（500 类码只允许由不变式被破坏触发且必须告警）——把基础设施故障记成实现缺陷。
 *
 * ---------------------------------------------------------------- 用法（§5.7 硬口径 ⑥：run-tagged）
 *   cd backend-ts && NODE_PATH=$PWD/node_modules \
 *     npx ts-node --transpile-only scripts/p3t-00-fold-fix-verify.ts --phase before|after
 * 落盘（**只新增**，同名拒写）：
 *   `.p3t-artifacts/p3t-00-fold-fix-verify-<phase>-<RUN>.json`
 *   `.p3t-artifacts/p3t-00-stdout-<phase>-<RUN>.txt`
 *
 * ---------------------------------------------------------------- 判据（红 / 绿）
 *   事件对象族（E*）：RED  = `code=LEDGER_TRANSACTION_REQUIRED` 且 `status=500`（修前应全中）
 *                     GREEN = `httpStatus=503` 且 `details.reason ∈ 既有 503 非 PG 原因集`
 *   对照（C*）：**逐字段冻结**在 `CONTROL_FROZEN`（修前实测值）—— 两个 phase 都必须逐字节相同。
 *   泄漏（R107）：**任何** case 的对外 `details`（排序后 JSON）不得含原始 `message` 文本 / `stack`。
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LE: any = require('../src/ledger-errors');

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.resolve(__dirname, '..', '.p3t-artifacts');

const argOf = (flag: string, fallback = ''): string => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const PHASE = argOf('--phase');
if (PHASE !== 'before' && PHASE !== 'after') {
  console.error(`[p3t-00] 用法：--phase before|after（收到 "${PHASE}"）`);
  process.exit(2);
}

// ---------------------------------------------------------------- 既有 503 非 PG 原因集（逐字取自 src）
const TRANSIENT_NON_PG_REASONS: string[] = ['pool_connection_timeout', 'driver_connection_error'];

// ---------------------------------------------------------------- 输入构造（事件对象族）
class DomErrorEventLike {
  type = 'error';
  readonly error: unknown;
  constructor(error: unknown) { this.error = error; }
  // ⚠️ 原型 getter、**无 setter** ⇒ 实例上**没有 own `message`**（`Object.assign` 到它会抛
  //    `Cannot set property message of #<...>`，正是驱动 `_connectionCallback` 崩的同型形态）
  get message(): string { return this.error instanceof Error ? this.error.message : ''; }
}

const protoGetterOnly = Object.create({
  get message(): string { return 'connection closed before message completed'; },
});

const ownGetterOnly: Record<string, unknown> = {};
Object.defineProperty(ownGetterOnly, 'message', {
  get: () => 'socket hang up (own getter-only)', enumerable: true, configurable: false,
});

const E_MESSAGE = 'connection reset by peer while opening ws'; // 用于 R107 泄漏检测的醒目文本

/**
 * 真实 `ws` 的 `ErrorEvent`（驱动 `_handleErrorEvent` 收到的正是它）——
 * **`extends Event` + 原型上的 `get message()`（无 setter）**，即 RCA 里
 * `Cannot set property message of #<ErrorEvent>` 的同族对象。
 * ⚠️ **取不到就返回 `undefined`**（该例记 `NOT_MEASURED`）——**绝不用仿体冒充真物**（§5.7⑦）。
 */
const loadRealWsErrorEvent = (): unknown => {
  for (const p of [
    'ws/lib/event-target',
    path.join(__dirname, '..', 'node_modules', 'ws', 'lib', 'event-target.js'),
  ]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m: any = require(p);
      const EE = m?.ErrorEvent ?? m?.WebSocket?.ErrorEvent ?? m?.default?.ErrorEvent ?? null;
      if (typeof EE === 'function') {
        try {
          return new EE('error', { message: E_MESSAGE, error: new Error(E_MESSAGE) });
        } catch {
          return new EE('error', { message: E_MESSAGE });
        }
      }
    } catch {
      /* 换下一个候选路径 */
    }
  }
  return undefined;
};

const eventCases: Array<{ id: string; desc: string; input: unknown }> = [
  {
    id: 'E1_dom_errorevent_fake',
    desc: 'DOM 形 ErrorEvent 仿体：type=error + 原型 getter-only message + 无 name/code',
    input: new DomErrorEventLike(new Error(E_MESSAGE)),
  },
  {
    id: 'E2_proto_getter_only_no_type',
    desc: '无 type、仅原型 getter-only message 的对象（隔离判据「非 own message」）',
    input: protoGetterOnly,
  },
  {
    id: 'E3_ws_ErrorEvent_real',
    desc: 'ws 真实 ErrorEvent（`ws/lib/event-target`：`extends Event` + 原型 getter-only message、无 setter）',
    input: loadRealWsErrorEvent(),
  },
  {
    id: 'E4_type_error_only',
    desc: '`{type:"error"}`：事件对象族判据 e.type==="error"（连 message 都没有）',
    input: { type: 'error' },
  },
  {
    id: 'E5_frozen_event_object',
    desc: '**缓 Frozen** 对象：Object.freeze({type:"error", message:"…"})（判据不得依赖写对象）',
    input: Object.freeze({ type: 'error', message: E_MESSAGE }),
  },
  {
    id: 'E6_own_getter_only_message',
    desc: '自有 getter-only（无 setter）message 访问器属性 + 无 type/name/code',
    input: ownGetterOnly,
  },
  {
    id: 'E7_event_with_inner_driver_code',
    desc: '事件对象**内层**才是驱动错误（e.error.code=ECONNRESET）：外层无 code',
    input: (() => {
      const inner = Object.assign(new Error(E_MESSAGE), { code: 'ECONNRESET' });
      return new DomErrorEventLike(inner);
    })(),
  },
  {
    id: 'E8_errorevent_message_matches_pool_re',
    desc: '事件对象族**且** message 命中池超时正则（判据优先级取证：两 reason 同为 503）',
    input: new DomErrorEventLike(new Error('timeout exceeded when trying to connect')),
  },
];

// ---------------------------------------------------------------- 输入构造（对照：PG / 既有可识别形态）
const ctor = (proto: object, props: Record<string, unknown>): unknown => Object.assign(Object.create(proto), props);
const errObj = (message: string, props: Record<string, unknown> = {}): Error =>
  Object.assign(new Error(message), props) as Error;

const controlCases: Array<{ id: string; desc: string; input: unknown }> = [
  { id: 'C1_pg_22003_error_instance', desc: 'PG 22003（Error 实例 + code）', input: errObj('numeric_value_out_of_range', { code: '22003' }) },
  { id: 'C2_pg_22003_plain_object', desc: 'PG 22003（**裸对象**形态，驱动实际返回值形态）', input: { code: '22003', message: 'numeric_value_out_of_range' } },
  { id: 'C3_db_named_code_LD016', desc: 'DB 侧命名码 LD016（5 位大写数字串，形似 SQLSTATE）', input: { code: 'LD016', message: 'insufficient balance' } },
  { id: 'C4_econnreset', desc: '驱动瞬时码 ECONNRESET', input: errObj('read ECONNRESET', { code: 'ECONNRESET' }) },
  { id: 'C5_pool_connection_timeout', desc: '池「拿连接」超时（驱动原文）', input: new Error('timeout exceeded when trying to connect') },
  { id: 'C6_socket_hang_up', desc: '普通 Error("socket hang up")', input: new Error('socket hang up') },
  { id: 'C7_08p01_protocol_violation', desc: '08P01（**排除项**：我方连接配置缺陷 ⇒ 500 类 + protocol_violation）', input: errObj('unsupported startup parameter', { code: '08P01' }) },
  { id: 'C8_23514_account_bal_guard', desc: '23514 + 约束 account_bal_guard ⇒ 500 类不变式', input: errObj('check violation', { code: '23514', constraint: 'account_bal_guard' }) },
  { id: 'C9_23505_idem_uniq', desc: '23505 + 约束 ledger_idem_uniq（409 映射）', input: errObj('duplicate key', { code: '23505', constraint: 'ledger_idem_uniq' }) },
  { id: 'C10_57014_statement_timeout', desc: '57014 语句超时（switch 优先于 infra 类别）', input: errObj('canceling statement due to statement timeout', { code: '57014' }) },
  { id: 'C11_infra_class_53', desc: '53 类 infra（53000 ⇒ insufficient_resources 503）', input: errObj('insufficient resources', { code: '53000' }) },
  { id: 'C12_ledger_named_code_tx_timeout', desc: '账本命名码 LEDGER_TX_TIMEOUT（前置分支直通）', input: { code: 'LEDGER_TX_TIMEOUT', message: 'tx timeout' } },
  { id: 'C13_ctor_Object_error_shape', desc: '无 name 的裸对象（constructor=Object）— errName 兼容性对照', input: ctor(Object.prototype, { message: 'weird' }) },
];

// ---------------------------------------------------------------- 修前实测（红/绿判定基线与对照冻结值）
const CONTROL_FROZEN: Record<string, { code: string; httpStatus: number; details: Record<string, unknown> }> = {
  C1_pg_22003_error_instance: { code: 'LEDGER_TRANSACTION_REQUIRED', httpStatus: 500, details: { cause: '22003', reason: 'unclassified_pg_error', error_name: 'Error', pg_code: '22003' } },
  C2_pg_22003_plain_object: { code: 'LEDGER_TRANSACTION_REQUIRED', httpStatus: 500, details: { cause: '22003', reason: 'unclassified_pg_error', error_name: 'Error', pg_code: '22003' } },
  C3_db_named_code_LD016: { code: 'LEDGER_TRANSACTION_REQUIRED', httpStatus: 500, details: { cause: 'LD016', reason: 'unclassified_pg_error', error_name: 'Error', pg_code: 'LD016' } },
  C4_econnreset: { code: 'LEDGER_TX_TIMEOUT', httpStatus: 503, details: { reason: 'driver_connection_error', error_code: 'ECONNRESET' } },
  C5_pool_connection_timeout: { code: 'LEDGER_TX_TIMEOUT', httpStatus: 503, details: { reason: 'pool_connection_timeout', source: 'connection_pool' } },
  C6_socket_hang_up: { code: 'LEDGER_TX_TIMEOUT', httpStatus: 503, details: { reason: 'driver_connection_error', error_code: 'none' } },
  C7_08p01_protocol_violation: { code: 'LEDGER_TRANSACTION_REQUIRED', httpStatus: 500, details: { cause: '08P01', reason: 'protocol_violation', error_name: 'ProtocolViolation', pg_code: '08P01' } },
  C8_23514_account_bal_guard: { code: 'LEDGER_NEGATIVE_BALANCE_GUARD', httpStatus: 500, details: { constraint: 'account_bal_guard' } },
  C9_23505_idem_uniq: { code: 'LEDGER_IDEMPOTENCY_CONFLICT', httpStatus: 409, details: { constraint: 'ledger_idem_uniq' } },
  C10_57014_statement_timeout: { code: 'LEDGER_TX_TIMEOUT', httpStatus: 503, details: {} },
  C11_infra_class_53: { code: 'LEDGER_TX_TIMEOUT', httpStatus: 503, details: { reason: 'insufficient_resources', pg_code: '53000', retryable: true, source: 'pg_infra_class' } },
  C12_ledger_named_code_tx_timeout: { code: 'LEDGER_TX_TIMEOUT', httpStatus: 503, details: {} },
  C13_ctor_Object_error_shape: { code: 'LEDGER_TRANSACTION_REQUIRED', httpStatus: 500, details: { cause: 'non_pg_error', reason: 'unclassified_non_pg_error', error_name: 'Error', error_code: 'none' } },
};

// ---------------------------------------------------------------- 取证原语
const sortedJson = (o: unknown): string => {
  if (o === null || typeof o !== 'object') return JSON.stringify(o);
  const keys = Object.keys(o as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify((o as Record<string, unknown>)[k])}`).join(',')}}`;
};
const ownMsgDesc = (e: unknown): string => {
  if (e === null || typeof e !== 'object') return 'n/a';
  const d = Object.getOwnPropertyDescriptor(e, 'message');
  if (!d) return 'absent';
  return `${d.get ? 'getter' : 'data'}${d.set ? '+setter' : ''}`;
};
const protoMsgDesc = (e: unknown): string => {
  const p = e === null || e === undefined ? null : Object.getPrototypeOf(e);
  if (!p) return 'n/a';
  const d = Object.getOwnPropertyDescriptor(p, 'message');
  return d ? (d.get ? 'getter' : 'data') : 'absent';
};
const ctorName = (e: unknown): string => String((e as { constructor?: { name?: string } })?.constructor?.name ?? 'n/a');
const isEventFamily = (e: unknown): boolean => {
  if (e === null || typeof e !== 'object') return false;
  const g: any = globalThis as any;
  if (typeof g.Event === 'function' && e instanceof g.Event) return true;
  if ((e as { type?: unknown }).type === 'error') return true;
  const d = Object.getOwnPropertyDescriptor(e, 'message');
  if (d && d.get && !d.set && typeof (e as { message?: unknown }).message === 'string') return true;
  if (!d && typeof (e as { message?: unknown }).message === 'string') return true;
  return false;
};

interface Row { [k: string]: unknown }
const RAW_LEAK_TEXT = E_MESSAGE;

const runCase = (c: { id: string; desc: string; input: unknown }, family: 'event_object' | 'control'): Row => {
  const e = c.input;
  // §5.7⑦：真实构造器取不到时**大声记 NOT_MEASURED**，不得用仿体冒充、不得计入红/绿
  if (e === undefined) {
    return { id: c.id, family, desc: c.desc, verdict: 'NOT_MEASURED', is_red: false, r107_detail_leaks: [], read_out: 'NOT_MEASURED：运行时未提供该真实构造器' };
  }
  const norm = LE.normalizeLedgerError(e);
  const classification = LE.classifyNonPgError(e);
  const details = (norm?.details ?? {}) as Record<string, unknown>;
  const detailsJson = sortedJson(details);
  const leak: string[] = [];
  if (Object.prototype.hasOwnProperty.call(details, 'message')) leak.push('details.message');
  if (Object.prototype.hasOwnProperty.call(details, 'stack')) leak.push('details.stack');
  if (detailsJson.includes(RAW_LEAK_TEXT)) leak.push('details 含原始 message 文本');
  if (/\.ts:\d+|at \w+ \(/.test(detailsJson)) leak.push('details 含栈帧文本');

  const row: Row = {
    id: c.id, family, desc: c.desc,
    input_ctor_name: ctorName(e),
    input_own_message: ownMsgDesc(e),
    input_proto_message: protoMsgDesc(e),
    input_has_type_error: (e as { type?: unknown })?.type === 'error',
    input_has_own_code: Object.prototype.hasOwnProperty.call(Object(e), 'code'),
    event_family_by_probe_criteria: isEventFamily(e),
    classify_non_pg: classification,
    code: norm.code, status: norm.status, httpStatus: norm.httpStatus,
    details, details_sorted_json: detailsJson,
    is_defect_code: (LE.DEFECT_ERROR_CODES ?? []).includes(norm.code),
    r107_detail_leaks: leak,
  };

  if (family === 'event_object') {
    const red = norm.code === 'LEDGER_TRANSACTION_REQUIRED' && norm.httpStatus === 500;
    const green = norm.httpStatus === 503 && TRANSIENT_NON_PG_REASONS.includes(String(details.reason));
    row.expect_before = 'LEDGER_TRANSACTION_REQUIRED/500（红）';
    row.expect_after = '503 + reason ∈ {pool_connection_timeout,driver_connection_error}';
    row.verdict = PHASE === 'before'
      ? (red ? 'red_as_expected' : 'UNEXPECTED_not_red')
      : (green ? 'green_ok' : 'STILL_RED');
    row.is_red = red;
  } else {
    const f = CONTROL_FROZEN[c.id];
    const same = norm.code === f.code && norm.httpStatus === f.httpStatus && detailsJson === sortedJson(f.details);
    row.frozen_code = f.code; row.frozen_httpStatus = f.httpStatus; row.frozen_details_sorted_json = sortedJson(f.details);
    row.verdict = same ? 'identical_to_frozen' : 'CONTROL_DRIFT';
    row.is_red = false;
  }
  return row;
};

const rows: Row[] = [
  ...eventCases.map((c) => runCase(c, 'event_object')),
  ...controlCases.map((c) => runCase(c, 'control')),
];

// ---------------------------------------------------------------- 服务端诊断面取证（②：原始信息只进服务端）
const diagAvailable = typeof LE.ledgerErrorDiagnostics === 'function';
const diag: Row[] = rows
  .filter((r) => (r.family === 'event_object' || r.id === 'C1_pg_22003_error_instance') && r.verdict !== 'NOT_MEASURED')
  .map((r) => {
    const c = [...eventCases, ...controlCases].find((x) => x.id === r.id) as { input: unknown };
    if (!diagAvailable) {
      return { id: r.id, available: false, read_out: 'NOT_MEASURED（ledgerErrorDiagnostics 不存在 ⇒ 修前无服务端诊断面）' };
    }
    const d = LE.ledgerErrorDiagnostics(c.input);
    return {
      id: r.id, available: true,
      constructor_name: d.constructor_name, message: d.message, error_name: d.error_name,
      cause_chain: d.cause_chain, stack_head: d.stack_head, event_object_family: d.event_object_family,
      reason: d.reason,
    };
  });

// ---------------------------------------------------------------- 汇总
const redRows = rows.filter((r) => r.is_red);
const controlDrift = rows.filter((r) => r.verdict === 'CONTROL_DRIFT');
const leakRows = rows.filter((r) => (r.r107_detail_leaks as string[]).length > 0);
const greenFail = rows.filter((r) => r.family === 'event_object' && r.verdict === 'STILL_RED');

const summary: Row = {
  phase: PHASE, run: RUN,
  event_object_cases: eventCases.length, control_cases: controlCases.length,
  RED_set: redRows.map((r) => ({ id: r.id, code: r.code, httpStatus: r.httpStatus, reason: (r.details as Record<string, unknown>).reason ?? null })),
  RED_count: redRows.length,
  green_503_ok: rows.filter((r) => r.verdict === 'green_ok').length,
  still_red_after_fix: greenFail.map((r) => r.id),
  control_mismatches: controlDrift.map((r) => r.id),
  r107_any_detail_leak: leakRows.map((r) => ({ id: r.id, leaks: r.r107_detail_leaks })),
  server_side_diagnostics_available: diagAvailable,
  closed_set_size: (LE.LEDGER_ERROR_CODES ?? []).length,
  verdicts: {
    before_phase_red_nonempty: PHASE === 'before' ? redRows.length > 0 : `n/a(phase=${PHASE})`,
    after_phase_red_empty: PHASE === 'after' ? redRows.length === 0 : `n/a(phase=${PHASE})`,
    controls_byte_identical: controlDrift.length === 0,
    r107_no_raw_leak_in_details: leakRows.length === 0,
    d126_no_event_family_500: rows.filter((r) => r.family === 'event_object' && r.httpStatus === 500).length === 0,
  },
};

const out = { probe: 'P3T-00 · 非 PG 事件对象族分类缺口', phase: PHASE, run: RUN, ...{ cases: rows, diagnostics_face: diag, summary } };

// ---------------------------------------------------------------- 落盘（run-tagged · 同名拒写）
const writeArtifact = (file: string, body: string): string => {
  if (fs.existsSync(file)) {
    console.error(`[p3t-00] 拒绝写入已存在的读数文件（同名拒写）：${file}`);
    process.exit(3);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return file;
};

const jsonFile = path.join(ART_DIR, `p3t-00-fold-fix-verify-${PHASE}-${RUN}.json`);
const txtFile = path.join(ART_DIR, `p3t-00-stdout-${PHASE}-${RUN}.txt`);

const fmtRow = (r: Row): string =>
  `  ${String(r.id).padEnd(38)} | ${String(r.code).padEnd(30)} http=${String(r.httpStatus).padEnd(4)} ` +
  `reason=${String((r.details as Record<string, unknown> | undefined)?.reason ?? '-').padEnd(24)} class=${String(r.classify_non_pg ?? '-').padEnd(26)} ${String(r.verdict)}`;
const table = [
  `RUN=${RUN}  PHASE=${PHASE}`,
  `event_object_cases=${eventCases.length}  control_cases=${controlCases.length}`,
  '',
  '--- 事件对象族（E*） ---',
  ...rows.filter((r) => r.family === 'event_object').map(fmtRow),
  '',
  '--- 对照（C*：逐字段冻结 / 必须逐字节相同） ---',
  ...rows.filter((r) => r.family === 'control').map(fmtRow),
  '',
  '--- 服务端诊断面（②：原始 message/栈/constructor.name/cause 链只进服务端） ---',
  ...diag.map((d) => `  ${String(d.id).padEnd(38)} | ctor=${String(d.constructor_name ?? '-')} msg=${JSON.stringify(d.message ?? null)} stack_head=${Array.isArray(d.stack_head) ? d.stack_head.length + ' frames' : String(d.stack_head ?? null)}`),
  '',
  `RED_set(${summary.RED_count}) = ${JSON.stringify((summary.RED_set as Array<{ id: string }>).map((x) => x.id))}`,
  `control_mismatches = ${JSON.stringify(summary.control_mismatches)}`,
  `r107_detail_leaks = ${JSON.stringify(summary.r107_any_detail_leak)}`,
  `verdicts = ${JSON.stringify(summary.verdicts, null, 1)}`,
  `json=${jsonFile}`,
].join('\n');

writeArtifact(txtFile, table + '\n');
writeArtifact(jsonFile, JSON.stringify(out, null, 1));

console.log(table);
console.log(`[p3t-00] 已落盘：${jsonFile}`);
console.log(`[p3t-00] 已落盘：${txtFile}`);
