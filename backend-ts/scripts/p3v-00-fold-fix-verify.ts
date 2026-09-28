/**
 * P3V-00 ·「非 PG 事件对象族分类缺口修复」独立质检探针（Neng / Unit G · QA-ERRORS-FOLD-FIX）
 * ============================================================================
 * 纯函数 · 零 DB / 零网络 I/O。被测对象 = `backend-ts/src/ledger-errors.ts` 的分类修复。
 * 不 import src/db.ts、不建连接池；唯一落盘是它自己的 run-tagged artifact（同名拒写）。
 * 夹具 / 探针 / 断言 / artifact 全部自建，与 Kong 的 `p3t-*` 独立；`.p3t-artifacts/**` 只作只读对照。
 *
 * 一份进程内同时加载 3 份实现副本并逐字段对拍：
 *   baseline = `git show HEAD^:backend-ts/src/ledger-errors.ts`（修复前，sha 721156cb…）
 *   fixed    = 工作树 `src/ledger-errors.ts`（修复后 = HEAD，sha 9bc127e4…）
 *   mutated  = fixed 删掉 `if (isEventObjectFamily(e)) return 'driver_connection_error';`（判负）
 * 注意：本会话开始时 HEAD=0367935（baseline 在 HEAD）；中途有并行单元把修复 **提交** 为 ade3376，
 * 故 baseline 改取 `HEAD^`（88783a2），实测 sha 与交接件所载 baseline 逐字节一致。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.resolve(__dirname, '..');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.join(ROOT, '.p3v-artifacts');

const IMPL_PATHS: Record<string, string> = {
  baseline: path.join(ART_DIR, '_impl', 'baseline-ledger-errors.ts'),
  fixed: path.join(ROOT, 'src', 'ledger-errors.ts'),
  mutated: path.join(ART_DIR, '_impl', 'mutated-ledger-errors.ts'),
};
const LABELS = Object.keys(IMPL_PATHS);

type Mod = Record<string, any>;
const load = (label: string) => {
  const p = IMPL_PATHS[label];
  if (!fs.existsSync(p)) return { label, path: p, sha256: null as string | null, mod: null as Mod | null, error: 'NOT_MEASURED: 副本不存在' };
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return { label, path: p, sha256, mod: require(p) as Mod, error: null as string | null };
  } catch (e) {
    return { label, path: p, sha256, mod: null as Mod | null, error: `require 失败: ${String((e as Error)?.message ?? e)}` };
  }
};
const impls: Record<string, ReturnType<typeof load>> = {};
for (const k of LABELS) impls[k] = load(k);

// ---------------------------------------------------------------- 观察器
const sortedDetails = (d: unknown): string => {
  if (d === null || typeof d !== 'object') return String(d);
  const o = d as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
};
interface Obs { classify: string | null | 'THREW'; code: string | null | 'THREW'; status: number | null | 'THREW'; details_json: string | null; details_keys: string[] | null; reason: string | null; threw: string | null }
const observe = (M: Mod, input: unknown): Obs => {
  try {
    const classify = M.classifyNonPgError(input) as string | null;
    const le = M.normalizeLedgerError(input) as { code: string; httpStatus: number; details: any };
    const d = le.details && typeof le.details === 'object' ? le.details : {};
    return {
      classify, code: le.code, status: le.httpStatus,
      details_json: sortedDetails(le.details), details_keys: Object.keys(d).sort(),
      reason: typeof d.reason === 'string' ? d.reason : null, threw: null,
    };
  } catch (e) {
    return { classify: 'THREW', code: 'THREW', status: 'THREW', details_json: null, details_keys: null, reason: null, threw: String((e as Error)?.message ?? e) };
  }
};
const NOT_MEASURED_OBS: Obs = { classify: 'THREW', code: 'THREW', status: 'THREW', details_json: null, details_keys: null, reason: null, threw: 'NOT_MEASURED: 该副本未加载' };

// ---------------------------------------------------------------- 真实 ws.ErrorEvent
const wsEventTargetPath = path.join(ROOT, 'node_modules', 'ws', 'lib', 'event-target.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wsET = require(wsEventTargetPath) as any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wsTop = require('ws') as any;
const WsErrorEvent = wsET.ErrorEvent as new (type: string, opts?: any) => any;
const wsSelfCheck = {
  ws_version: ((): string => { try { return (require(path.join(ROOT, 'node_modules', 'ws', 'package.json')) as any).version; } catch { return 'NOT_MEASURED'; } })(),
  require_ws_ErrorEvent_typeof: typeof wsTop.ErrorEvent,
  ws_pkg_exports_subpath_for_ErrorEvent: 'absent（package.json#exports 只导出 "." 与 "./package.json"）',
  wsET_export_keys: Object.keys(wsET),
  wsET_ErrorEvent_ctor_name: WsErrorEvent ? WsErrorEvent.name : 'NOT_MEASURED',
  ws_msg_on_prototype_not_own: ((): any => {
    const e = new WsErrorEvent('error', { message: 'x' });
    return { own_desc: Object.getOwnPropertyDescriptor(e, 'message') ?? null, proto_has_getter: typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'message')?.get === 'function', proto_has_setter: Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'message')?.set !== undefined, instanceof_globalThis_Event: e instanceof (globalThis as any).Event, ctor_name: e.constructor?.name };
  })(),
  event_target_file_used: wsEventTargetPath,
};

// ---------------------------------------------------------------- 夹具工厂
const SENSITIVE = 'password=s3cr3t-T0P-secret-9914';
const STACKY = 'at LedgerPost (/app/src/ledger.ts:12:9)';
const POISON = `${SENSITIVE} ${STACKY}`;

const makeDomErrorEventLike = (msg: string): any => {
  const G: any = (globalThis as any).Event;
  class DomErrorEventLike extends G { private _m: string; constructor(m: string) { super('error'); this._m = m; } get message(): string { return this._m; } }
  return new DomErrorEventLike(msg);
};
const makeWsErrorEvent = (msg: string, innerCode: string): any =>
  new WsErrorEvent('error', { message: msg, error: Object.assign(new Error(msg), { code: innerCode }) });
const ownGetterOnlyMessage = (msg: string): any => { const o: any = {}; Object.defineProperty(o, 'message', { get: () => msg, enumerable: true, configurable: true }); return o; };
const ownAccessorWithSetter = (msg: string): any => { let v = msg; const o: any = {}; Object.defineProperty(o, 'message', { get: () => v, set: (x) => { v = x; }, enumerable: true, configurable: true }); return o; };
const protoGetterOnly = (msg: string): any => Object.create(Object.defineProperty({}, 'message', { get: () => msg, enumerable: true }));
const classWithProtoDataMessage = (): any => { class ProtoDto { } Object.defineProperty(ProtoDto.prototype, 'message', { value: 'proto-data-msg', enumerable: true, writable: true, configurable: true }); return new ProtoDto(); };
const classErrorNoMessage = (): any => { class BareCustomError extends Error { } return new BareCustomError(); };
const throwingMessageGetter = (): any => { const o: any = {}; Object.defineProperty(o, 'message', { get: () => { throw new Error('getter blew up'); }, enumerable: true, configurable: true }); return o; };

interface Case { id: string; group: string; desc: string; make: () => unknown; makeFor?: (label: string) => unknown; expected_event_family?: boolean; note?: string }

const CASES: Case[] = [
  // ---- L1：事件对象族（真物 + ≥6 形态）
  { id: 'Y1_ws_true_ErrorEvent', group: 'L1_event_family', desc: '真实 ws.ErrorEvent（绝对路径；ctor.name=ErrorEvent；instanceof globalThis.Event=false）', make: () => makeWsErrorEvent(POISON, 'ECONNRESET'), expected_event_family: true },
  { id: 'Y2_dom_like_ErrorEvent', group: 'L1_event_family', desc: 'DOM 形 ErrorEvent（extends globalThis.Event + 原型 get message）', make: () => makeDomErrorEventLike(POISON), expected_event_family: true },
  { id: 'Y3_type_error_no_message', group: 'L1_event_family', desc: "{type:'error'}（无 message）", make: () => ({ type: 'error' }), expected_event_family: true },
  { id: 'Y4_frozen_event_object', group: 'L1_event_family', desc: "Object.freeze({type:'error',message})", make: () => Object.freeze({ type: 'error', message: POISON }), expected_event_family: true },
  { id: 'Y5_own_getter_only_message', group: 'L1_event_family', desc: '自有 getter-only message（无 setter、无 type）', make: () => ownGetterOnlyMessage(POISON), expected_event_family: true },
  { id: 'Y6_proto_getter_only_message', group: 'L1_event_family', desc: '仅原型 getter 提供 message（无 type）', make: () => protoGetterOnly(POISON), expected_event_family: true },
  { id: 'Y7_event_with_inner_code', group: 'L1_event_family', desc: "外层无 code、内层 e.error.code='ECONNRESET'", make: () => ({ type: 'error', message: POISON, error: { code: 'ECONNRESET', message: 'inner' } }), expected_event_family: true },
  { id: 'Y8_event_hits_pool_regex', group: 'L1_event_family', desc: '事件对象且 message 命中池超时正则', make: () => ({ type: 'error', message: 'timeout exceeded when trying to connect' }), expected_event_family: true },

  // ---- L1 反例
  { id: 'X1_ws_true_not_instanceof_globalEvent', group: 'L1_counterexample', desc: 'ws 真物 instanceof globalThis.Event === false ⇒ 仅 ① 必漏；必须仍被命中', make: () => makeWsErrorEvent('boom', 'ECONNRESET'), expected_event_family: true, note: 'KEEP_HIT' },
  { id: 'X2_globalEvent_non_error', group: 'L1_counterexample', desc: "new Event('message') —— 非错误事件；① 会命中（over-capture）", make: () => new ((globalThis as any).Event)('message'), expected_event_family: false },
  { id: 'X3_globalEvent_open', group: 'L1_counterexample', desc: "new Event('open') —— 非错误事件；① 会命中（over-capture）", make: () => new ((globalThis as any).Event)('open'), expected_event_family: false },

  // ---- L2：既有 13 类对照
  { id: 'C1_pg_22003_instance', group: 'L2_controls', desc: 'PG 22003（Error 实例 + code）', make: () => Object.assign(new Error('numeric_value_out_of_range'), { code: '22003' }) },
  { id: 'C2_pg_22003_bare', group: 'L2_controls', desc: 'PG 22003（裸对象）', make: () => ({ code: '22003', message: 'numeric_value_out_of_range' }) },
  { id: 'C3_pg_LD016', group: 'L2_controls', desc: 'DB 命名码 LD016', make: () => Object.assign(new Error('named'), { code: 'LD016' }) },
  { id: 'C4_ECONNRESET', group: 'L2_controls', desc: 'ECONNRESET', make: () => Object.assign(new Error('reset'), { code: 'ECONNRESET' }) },
  { id: 'C5_pool_timeout', group: 'L2_controls', desc: '池「拿连接」超时（Error 实例 + 数据 message）', make: () => new Error('timeout exceeded when trying to connect') },
  { id: 'C6_socket_hang_up', group: 'L2_controls', desc: "Error('socket hang up')", make: () => new Error('socket hang up') },
  { id: 'C7_08P01_excluded', group: 'L2_controls', desc: '08P01（排除项，500 类）', make: () => Object.assign(new Error('proto'), { code: '08P01' }) },
  { id: 'C8_23514_bal_guard', group: 'L2_controls', desc: '23514 + account_bal_guard', make: () => Object.assign(new Error('check'), { code: '23514', constraint: 'account_bal_guard' }) },
  { id: 'C9_23505_idem', group: 'L2_controls', desc: '23505 + ledger_idem_uniq', make: () => Object.assign(new Error('uniq'), { code: '23505', constraint: 'ledger_idem_uniq' }) },
  { id: 'C10_57014', group: 'L2_controls', desc: '57014 语句超时', make: () => Object.assign(new Error('stmt timeout'), { code: '57014' }) },
  { id: 'C11_53000', group: 'L2_controls', desc: '53000（53 类 infra）', make: () => Object.assign(new Error('insufficient'), { code: '53000' }) },
  { id: 'C12_named_LEDGER_TX_TIMEOUT', group: 'L2_controls', desc: '命名码直通 LEDGER_TX_TIMEOUT', make: () => Object.assign(new Error('named code'), { code: 'LEDGER_TX_TIMEOUT' }) },
  { id: 'C13_bare_object_no_name', group: 'L2_controls', desc: '无 name 裸对象（own 数据 message，无 code）', make: () => ({ message: 'opaque internal failure' }) },

  // ---- L5：误捕矩阵
  { id: 'P1_Object_create_proto_message', group: 'L5_false_positive', desc: "Object.create({message:'x'})", make: () => Object.create({ message: 'x' }) },
  { id: 'P2_plain_own_message', group: 'L5_false_positive', desc: "{message:'x'}（own 数据属性）", make: () => ({ message: 'x' }) },
  { id: 'P3_class_proto_data_message', group: 'L5_false_positive', desc: '类实例带原型 message（数据属性）', make: () => classWithProtoDataMessage() },
  { id: 'P4_business_type_error', group: 'L5_false_positive', desc: "业务信封 {type:'error', payload}", make: () => ({ type: 'error', payload: { a: 1 } }) },
  { id: 'P5_new_Error_no_args', group: 'L5_false_positive', desc: 'new Error()（无 own message；Error.prototype.message === "")', make: () => new Error() },
  { id: 'P6_new_Error_with_msg', group: 'L5_false_positive', desc: "new Error('boom')（own 数据 message）", make: () => new Error('boom') },
  { id: 'P7_new_TypeError_no_args', group: 'L5_false_positive', desc: 'new TypeError()（无 own message）', make: () => new TypeError() },
  { id: 'P8_empty_object', group: 'L5_false_positive', desc: '{}', make: () => ({}) },
  { id: 'P9_array', group: 'L5_false_positive', desc: '[]', make: () => [] },
  { id: 'P10_object_create_null', group: 'L5_false_positive', desc: 'Object.create(null)', make: () => Object.create(null) },
  { id: 'P11_LedgerError_instance', group: 'L5_false_positive', desc: '真实业务对象：LedgerError 实例（按各副本自建，避免跨模块 instanceof 假差异）', make: () => null, makeFor: (label) => new (impls[label].mod as Mod).LedgerError('LEDGER_AMOUNT_INVALID', { field: 'amount' }) },
  { id: 'P12_plain_dto', group: 'L5_false_positive', desc: '真实业务对象：普通 DTO', make: () => ({ id: 1, kind: 'transfer', amount: '5' }) },
  { id: 'P13_own_accessor_with_setter', group: 'L5_false_positive', desc: '自有 getter+setter 的 message（只读判据不该命中）', make: () => ownAccessorWithSetter('x') },
  { id: 'P14_custom_error_no_message', group: 'L5_false_positive', desc: 'class X extends Error {} 且 new X() 无 message', make: () => classErrorNoMessage() },
  { id: 'P15_pg_like_own_message', group: 'L5_false_positive', desc: 'pg 形对象（own 数据 message + code/constraint）', make: () => ({ code: '23514', constraint: 'account_bal_guard', message: 'check violation' }) },
  { id: 'P16_Buffer', group: 'L5_false_positive', desc: 'Buffer.from("x")', make: () => Buffer.from('x') },
  { id: 'P17_object_create_Error_prototype', group: 'L5_false_positive', desc: 'Object.create(Error.prototype)（继承空串 message）', make: () => Object.create(Error.prototype) },
  { id: 'P18_function_value', group: 'L5_false_positive', desc: '函数值（typeof function）', make: () => (() => undefined) },
  { id: 'P19_string_primitive', group: 'L5_false_positive', desc: "字符串原始值 'boom'", make: () => 'boom' },
  { id: 'P20_frozen_plain_message', group: 'L5_false_positive', desc: "Object.freeze({message:'x'})（own 数据）", make: () => Object.freeze({ message: 'x' }) },

  // ---- L5：漏捕 / 边界
  { id: 'M1_own_accessor_get_and_set', group: 'L5_miss', desc: '自有 getter+setter、无 type ⇒ 三条判据都不占（判据边界）', make: () => ownAccessorWithSetter('write EPIPE') },
  { id: 'M2_type_Error_capitalized', group: 'L5_miss', desc: "{type:'Error', message:'x'}（大小写不同 ⇒ ② 不命中）", make: () => ({ type: 'Error', message: 'boom' }) },
  { id: 'M3_throwing_message_getter', group: 'L5_miss', desc: 'message getter 抛异常 ⇒ 分类器整体抛（修前修后同）', make: () => throwingMessageGetter() },
  { id: 'M4_own_message_epipe', group: 'L5_miss', desc: "{message:'write EPIPE'}（own 数据、无 code、不命中正则）", make: () => ({ message: 'write EPIPE' }) },

  // ---- L3：R107 敏感文本
  { id: 'S1_ws_event_sensitive', group: 'L3_r107', desc: 'ws 真 ErrorEvent 带敏感 message + 栈帧文本', make: () => makeWsErrorEvent(POISON, 'ECONNRESET') },
  { id: 'S2_type_error_sensitive', group: 'L3_r107', desc: '事件对象带敏感 message + 栈帧文本', make: () => ({ type: 'error', message: POISON }) },
  { id: 'S3_own_message_sensitive', group: 'L3_r107', desc: 'own 数据 message 带敏感文本（走 500 兜底）', make: () => ({ message: POISON }) },
  { id: 'S4_Error_instance_sensitive', group: 'L3_r107', desc: 'Error 实例带敏感 message + 真栈', make: () => new Error(POISON) },
];

const inputOf = (c: Case, label: string): unknown => (c.makeFor ? c.makeFor(label) : c.make());
/** 读属性可能抛（getter 毒药用例）⇒ 一律安全读；§5.7④：异常先怀疑探针自身 */
const safeRead = <T>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const obsAll = (c: Case): Record<string, Obs> => {
  const out: Record<string, Obs> = {};
  for (const k of LABELS) out[k] = impls[k].mod ? observe(impls[k].mod as Mod, inputOf(c, k)) : NOT_MEASURED_OBS;
  return out;
};

// ---------------------------------------------------------------- 跑
const caseRows = CASES.map((c) => {
  const inputFx = inputOf(c, 'fixed');
  const per = obsAll(c);
  const ownDesc = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return 'n/a';
    const d = Object.getOwnPropertyDescriptor(v as object, 'message');
    if (d === undefined) return 'none';
    if (d.get !== undefined) return d.set === undefined ? 'accessor(get,no-set)' : 'accessor(get,set)';
    return 'data';
  };
  const fx = inputFx as any;
  const inObj = inputFx !== null && typeof inputFx === 'object';
  const EVENT: any = (globalThis as any).Event;
  return {
    id: c.id, group: c.group, desc: c.desc, expected_event_family: c.expected_event_family ?? null, note: c.note ?? null,
    fixture_selfcheck: {
      constructor_name: inObj ? safeRead(() => fx.constructor?.name ?? 'NOT_MEASURED', 'THREW') : typeof inputFx,
      own_message_descriptor: ownDesc(inputFx),
      instanceof_globalThis_Event: inObj ? inputFx instanceof EVENT : false,
      typeof_message: inObj ? safeRead(() => typeof fx.message, 'THREW') : 'NOT_MEASURED',
      has_own_message: inObj ? Object.prototype.hasOwnProperty.call(inputFx, 'message') : false,
      type_value: inObj ? safeRead(() => fx.type ?? null, 'THREW') : null,
    },
    per_impl: per,
    independent_event_family_verdict: ((): boolean | 'THREW' => {
      try {
        if (!inObj) return false;
        if (typeof EVENT === 'function' && inputFx instanceof EVENT) return true;
        if (fx.type === 'error') return true;
        const d = Object.getOwnPropertyDescriptor(inputFx as object, 'message');
        if (d !== undefined && d.get !== undefined && d.set === undefined && typeof fx.message === 'string') return true;
        if (d === undefined && typeof fx.message === 'string') return true;
        return false;
      } catch (e) { return 'THREW'; }
    })(),
  };
});

// L1
const L1_GREEN = (o: Obs) => (o.classify === 'driver_connection_error' || o.classify === 'pool_connection_timeout') && o.code === 'LEDGER_TX_TIMEOUT' && o.status === 503;
const L1_ROWS = caseRows.filter((r) => r.group === 'L1_event_family');
const L1 = L1_ROWS.map((r) => ({ id: r.id, desc: r.desc, classify: r.per_impl.fixed.classify, code: r.per_impl.fixed.code, status: r.per_impl.fixed.status, green: L1_GREEN(r.per_impl.fixed), baseline: `${r.per_impl.baseline.classify}/${r.per_impl.baseline.code}/${r.per_impl.baseline.status}` }));
const red = (label: string) => L1_ROWS.filter((r) => !L1_GREEN(r.per_impl[label])).map((r) => r.id);

// L2
const keyOf = (o: Obs) => JSON.stringify({ classify: o.classify, code: o.code, status: o.status, details: o.details_json });
const L2 = caseRows.filter((r) => r.group === 'L2_controls').map((r) => ({ id: r.id, desc: r.desc, baseline: keyOf(r.per_impl.baseline), fixed: keyOf(r.per_impl.fixed), byte_identical: keyOf(r.per_impl.baseline) === keyOf(r.per_impl.fixed) }));
const control_mismatches = L2.filter((r) => !r.byte_identical).map((r) => r.id);

// L3
const L3 = caseRows.filter((r) => r.group === 'L3_r107').map((r) => {
  const dj = r.per_impl.fixed.details_json ?? '';
  let diag: any;
  let diagMessage: any = 'NOT_MEASURED';
  try {
    const M = impls.fixed.mod as Mod;
    if (!M || typeof M.ledgerErrorDiagnostics !== 'function') throw new Error('ledgerErrorDiagnostics 不存在');
    const d = M.ledgerErrorDiagnostics(inputOf(CASES.find((c) => c.id === r.id)!, 'fixed'));
    diag = { constructor_name: d.constructor_name, message: d.message, stack_head_len: Array.isArray(d.stack_head) ? d.stack_head.length : null, cause_chain_len: d.cause_chain.length, event_object_family: d.event_object_family, reason: d.reason, non_pg_class: d.non_pg_class };
    diagMessage = d.message;
  } catch (e) { diag = `NOT_MEASURED/THREW: ${String((e as Error)?.message ?? e)}`; }
  return {
    id: r.id, desc: r.desc, details_json: dj,
    details_has_sensitive: dj.includes('s3cr3t-T0P'),
    details_has_stack_frame_text: /\.ts:\d+/.test(dj) || /at \w+ \(/.test(dj),
    details_has_own_message_key: (r.per_impl.fixed.details_keys ?? []).includes('message'),
    details_has_own_stack_key: (r.per_impl.fixed.details_keys ?? []).includes('stack'),
    server_side_diagnostics: diag,
    server_side_message_contains_sensitive: typeof diagMessage === 'string' ? diagMessage.includes('s3cr3t-T0P') : 'NOT_MEASURED',
  };
});
const r107_detail_leaks = L3.filter((r) => r.details_has_sensitive || r.details_has_stack_frame_text || r.details_has_own_message_key || r.details_has_own_stack_key).map((r) => r.id);
const diagnostics_retrievable = L3.filter((r) => r.server_side_message_contains_sensitive === true).map((r) => r.id);

// L4
const tableFp = (M: Mod) => crypto.createHash('sha256').update(JSON.stringify({ table: M.LEDGER_ERROR_TABLE, buckets: M.LEDGER_ERROR_BUCKETS, codes: M.LEDGER_ERROR_CODES, defect: M.DEFECT_ERROR_CODES, benign: M.LEDGER_BENIGN_CODES })).digest('hex');
const L4 = {
  closed_set_size_baseline: impls.baseline.mod ? Object.keys((impls.baseline.mod as Mod).LEDGER_ERROR_TABLE).length : 'NOT_MEASURED',
  closed_set_size_fixed: impls.fixed.mod ? Object.keys((impls.fixed.mod as Mod).LEDGER_ERROR_TABLE).length : 'NOT_MEASURED',
  table_fingerprint_baseline: impls.baseline.mod ? tableFp(impls.baseline.mod as Mod) : 'NOT_MEASURED',
  table_fingerprint_fixed: impls.fixed.mod ? tableFp(impls.fixed.mod as Mod) : 'NOT_MEASURED',
  status_diffs_baseline_vs_fixed: caseRows.filter((r) => r.per_impl.baseline.status !== r.per_impl.fixed.status || r.per_impl.baseline.code !== r.per_impl.fixed.code)
    .map((r) => ({ id: r.id, group: r.group, desc: r.desc, baseline: `${r.per_impl.baseline.code}/${r.per_impl.baseline.status}/${r.per_impl.baseline.classify}`, fixed: `${r.per_impl.fixed.code}/${r.per_impl.fixed.status}/${r.per_impl.fixed.classify}`, intended_event_family: r.expected_event_family === true })),
};

// L5
const L5_GROUPS = ['L5_false_positive', 'L5_miss', 'L1_counterexample'];
const L5 = caseRows.filter((r) => L5_GROUPS.includes(r.group)).map((r) => {
  const b = r.per_impl.baseline, f = r.per_impl.fixed;
  return {
    id: r.id, group: r.group, desc: r.desc, own_message_descriptor: r.fixture_selfcheck.own_message_descriptor,
    captured_as_event_family: r.independent_event_family_verdict,
    captured_by_impl_fixed: f.classify === 'driver_connection_error',
    classify_baseline: b.classify, classify_fixed: f.classify,
    baseline: `${b.code}/${b.status}`, fixed: `${f.code}/${f.status}`,
    became_503_from_500: b.status !== f.status && f.status === 503 && b.status === 500,
    status_changed: b.status !== f.status || b.code !== f.code,
  };
});
const L5_false_positives = L5.filter((r) => r.captured_as_event_family).map((r) => r.id);
const L5_not_captured = L5.filter((r) => !r.captured_as_event_family).map((r) => r.id);
const L5_status_change_500_to_503 = L5.filter((r) => r.became_503_from_500).map((r) => ({ id: r.id, group: r.group, desc: r.desc, from: r.baseline, to: r.fixed }));

// L6
const L6 = {
  impl_sha256: Object.fromEntries(LABELS.map((k) => [k, impls[k].sha256])),
  impl_load_error: Object.fromEntries(LABELS.map((k) => [k, impls[k].error])),
  expected_worktree_sha256: '9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d',
  expected_baseline_sha256: '721156cbf296b19c7c4a480264f88b49878d99104b8f87453bafce564745df8b',
  RED_set_fixed: red('fixed'), RED_set_baseline: red('baseline'), RED_set_mutated: red('mutated'),
  verdicts: { fixed_green: red('fixed').length === 0, baseline_red: red('baseline').length > 0, mutated_red: red('mutated').length > 0 },
};

const out = {
  probe: 'P3V-00 · 事件对象族分类修复独立质检探针（纯函数 · 零 DB/网络 I/O）',
  author: 'Neng (Unit G / QA-ERRORS-FOLD-FIX)', run: RUN, node: process.version,
  impls: Object.fromEntries(LABELS.map((k) => [k, { path: IMPL_PATHS[k], sha256: impls[k].sha256, load_error: impls[k].error }])),
  ws_selfcheck: wsSelfCheck,
  L1_event_family: L1, L1_counterexamples: caseRows.filter((r) => r.group === 'L1_counterexample'),
  L2_controls: L2, L2_control_mismatches: control_mismatches,
  L3_r107: L3, L3_r107_detail_leaks: r107_detail_leaks, L3_diagnostics_retrievable_ids: diagnostics_retrievable,
  L4, L5_matrix: L5, L5_false_positive_ids: L5_false_positives, L5_not_captured_ids: L5_not_captured, L5_status_change_500_to_503,
  L6_mutation: L6, all_cases: caseRows,
};
fs.mkdirSync(ART_DIR, { recursive: true });
const file = path.join(ART_DIR, `p3v-00-fold-fix-verify-${RUN}.json`);
if (fs.existsSync(file)) { console.error(`[p3v-00] 同名拒写：${file}`); process.exit(3); }
fs.writeFileSync(file, JSON.stringify(out, null, 1));

const p = (s: string) => console.log(s);
p(`RUN=${RUN}`);
p(`IMPL sha256 ${JSON.stringify(L6.impl_sha256)}`);
p(`WS selfcheck: require('ws').ErrorEvent=${wsSelfCheck.require_ws_ErrorEvent_typeof} | wsET keys=${JSON.stringify(wsSelfCheck.wsET_export_keys)} | ErrorEvent.name=${wsSelfCheck.wsET_ErrorEvent_ctor_name} | msg_carry=${JSON.stringify(wsSelfCheck.ws_msg_on_prototype_not_own)}`);
p(`L1 RED_set fixed=${JSON.stringify(L6.RED_set_fixed)} baseline=${JSON.stringify(L6.RED_set_baseline)} mutated=${JSON.stringify(L6.RED_set_mutated)}`);
p(`L1 rows: ${L1.map((r) => `${r.id}:${r.classify}/${r.code}/${r.status}${r.green ? '' : '<<RED'}`).join(' | ')}`);
p(`L1 counterexamples: ${JSON.stringify(caseRows.filter((r) => r.group === 'L1_counterexample').map((r) => ({ id: r.id, instanceofGlobEvent: r.fixture_selfcheck.instanceof_globalThis_Event, fixed: `${r.per_impl.fixed.code}/${r.per_impl.fixed.status}`, baseline: `${r.per_impl.baseline.code}/${r.per_impl.baseline.status}` })))}`);
p(`L2 control_mismatches=${JSON.stringify(control_mismatches)} (n=${L2.length})`);
p(`L3 r107_detail_leaks=${JSON.stringify(r107_detail_leaks)} diagnostics_retrievable=${JSON.stringify(diagnostics_retrievable)}`);
for (const r of L3) p(`   L3 ${r.id} details=${r.details_json} server_msg_has_secret=${r.server_side_message_contains_sensitive} diag=${JSON.stringify(r.server_side_diagnostics)}`);
p(`L4 closed_set baseline=${L4.closed_set_size_baseline} fixed=${L4.closed_set_size_fixed} tableFpSame=${L4.table_fingerprint_baseline === L4.table_fingerprint_fixed}`);
p(`L4 status_diffs=${JSON.stringify(L4.status_diffs_baseline_vs_fixed)}`);
p(`L5 captured_as_event_family=${JSON.stringify(L5_false_positives)}`);
p(`L5 not_captured=${JSON.stringify(L5_not_captured)}`);
p(`L5 500->503=${JSON.stringify(L5_status_change_500_to_503)}`);
p(`L6 verdicts=${JSON.stringify(L6.verdicts)}`);
p(`[p3v-00] 已落盘：${file}`);
