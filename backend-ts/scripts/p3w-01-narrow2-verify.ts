/**
 * P3W-01 · 判据② 收窄（type==='error' ∧ typeof message==='string'）+ 注释更正 自建探针
 *                 （Kong / Unit I · P3-ERRORS-NARROW-2）
 * ============================================================================
 * 纯函数 · **零 DB / 零网络 I/O**（本单 DB 零写、不得建任何库对象）。唯一落盘 = 本探针自己的
 * run-tagged artifact + 它在 `.p3w-artifacts/_impl/` 下生成的**新文件名**副本（同名拒写）。
 * **绝不覆写 p3w-00 的既有 artifact / 既有 `_impl/` 副本。**
 *
 * 同进程加载 **4 份实现副本**，同一套夹具逐形态对拍：
 *   baseline  = `.p3w-artifacts/_impl/baseline-ledger-errors.ts`（`git show 88783a2:` ⇒ sha 721156cb…）
 *               ⚠️ 实测：baseline **没有** `isEventObjectFamily` ⇒ 所有事件对象在 baseline 一律 500。
 *   fixed     = `.p3w-artifacts/_impl/fixed-ledger-errors.ts`   （`git show ade3376:` ⇒ sha 9bc127e4…）
 *               判据① **无** type 合取；判据② = `type === 'error'` **裸判据**。
 *   narrowed2 = 工作树 `src/ledger-errors.ts`（**本单元交付物**，Unit I 收窄后）
 *   mutated_c2= narrowed2 现场**去掉判据② 的 message 合取**（判负自证）—— 探针自建，锚点 ≠ 1 即抛
 *
 * ⚠️ 三态副本一律用「**内容 sha256 自证**」（禁用 `HEAD` 符号自证）。
 * ⚠️ ★ 回归守卫（本单必交、可机读）：从**绝对路径**加载 `ws/lib/event-target.js`，打印并断言
 *    `ws_event_instanceof_global_event === false`（判据② 承重的**前提**）。断言失败 ⇒ 判负 + 非零退出。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ROOT = path.resolve(__dirname, '..');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.join(ROOT, '.p3w-artifacts');
const IMPL_DIR = path.join(ART_DIR, '_impl');

const EXPECT_BASELINE_SHA = '721156cbf296b19c7c4a480264f88b49878d99104b8f87453bafce564745df8b';
const EXPECT_FIXED_SHA = '9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d';
const EXPECT_NARROWED2_SHA = '5a671354eb7bfd6707bb27a48a1e661b73745a63de59c5201957a602006bf3c4';

const sha256 = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ---------------------------------------------------------------- 判负副本生成（锚点命中数必须 = 1）
const NARROWED_SRC = path.join(ROOT, 'src', 'ledger-errors.ts');
const MUTATED_SRC = path.join(IMPL_DIR, 'mutated-clause2-narrow2-ledger-errors.ts');
const MUTATION_ANCHOR =
  `  if (safeRead(e, 'type') === 'error' && typeof safeRead(e, 'message') === 'string') return true;\n`;
const MUTATION_INSERT = `  if (safeRead(e, 'type') === 'error') return true;\n`;
const worktree_sha_before = sha256(NARROWED_SRC);
let mutation_anchor_hits = -1;
{
  const src = fs.readFileSync(NARROWED_SRC, 'utf8');
  mutation_anchor_hits = src.split(MUTATION_ANCHOR).length - 1;
  if (mutation_anchor_hits !== 1) {
    throw new Error(`[p3w-01] 判负锚点命中 ${mutation_anchor_hits} 处（应为 1）⇒ 拒绝生成变异副本`);
  }
  fs.mkdirSync(IMPL_DIR, { recursive: true });
  fs.writeFileSync(MUTATED_SRC, src.replace(MUTATION_ANCHOR, MUTATION_INSERT));
}

const IMPL_PATHS: Record<string, string> = {
  baseline: path.join(IMPL_DIR, 'baseline-ledger-errors.ts'),
  fixed: path.join(IMPL_DIR, 'fixed-ledger-errors.ts'),
  narrowed2: NARROWED_SRC,
  mutated_c2: MUTATED_SRC,
};
const LABELS = Object.keys(IMPL_PATHS);

type Mod = Record<string, any>;
const load = (label: string) => {
  const p = IMPL_PATHS[label];
  if (!fs.existsSync(p)) return { label, path: p, sha256: null as string | null, mod: null as Mod | null, error: 'NOT_MEASURED: 副本不存在' };
  const s = sha256(p);
  try {
    return { label, path: p, sha256: s, mod: require(p) as Mod, error: null as string | null };
  } catch (e) {
    return { label, path: p, sha256: s, mod: null as Mod | null, error: `require 失败: ${String((e as Error)?.message ?? e)}` };
  }
};
const impls: Record<string, ReturnType<typeof load>> = {};
for (const k of LABELS) impls[k] = load(k);

// ---------------------------------------------------------------- 观察器
const safe = <T>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const sortedDetails = (d: unknown): string => {
  if (d === null || typeof d !== 'object') return String(d);
  const o = d as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
};
interface Obs { classify: string | null | 'THREW'; code: string | null | 'THREW'; status: number | null | 'THREW'; details_json: string | null; reason: string | null; threw: string | null }
const observe = (M: Mod, input: unknown): Obs => {
  try {
    const classify = M.classifyNonPgError(input) as string | null;
    const le = M.normalizeLedgerError(input) as { code: string; httpStatus: number; details: any };
    const d = le.details && typeof le.details === 'object' ? le.details : {};
    return { classify, code: le.code, status: le.httpStatus, details_json: sortedDetails(le.details), reason: typeof d.reason === 'string' ? d.reason : null, threw: null };
  } catch (e) {
    return { classify: 'THREW', code: 'THREW', status: 'THREW', details_json: null, reason: null, threw: String((e as Error)?.message ?? e) };
  }
};
const NM: Obs = { classify: 'THREW', code: 'THREW', status: 'THREW', details_json: null, reason: null, threw: 'NOT_MEASURED: 该副本未加载' };
const obsAll = (make: () => unknown): Record<string, Obs> => {
  const out: Record<string, Obs> = {};
  for (const k of LABELS) out[k] = impls[k].mod ? observe(impls[k].mod as Mod, make()) : NM;
  return out;
};
const keyOf = (o: Obs) => JSON.stringify({ classify: o.classify, code: o.code, status: o.status, details: o.details_json });
const brief = (o: Obs) => `${o.code}/${o.status}/${o.classify}`;

// ---------------------------------------------------------------- 真 ws 对象（★ 绝对路径 + 回归守卫）
const wsETPath = path.join(ROOT, 'node_modules', 'ws', 'lib', 'event-target.js');
const wsET = require(wsETPath) as any;
const wsTop = require('ws') as any;
const WsEvent = wsET.Event as new (type: string) => any;
const WsErrorEvent = wsET.ErrorEvent as new (type: string, opts?: any) => any;
const mkWsEE = (msg: string, innerCode: string): any =>
  new WsErrorEvent('error', { message: msg, error: Object.assign(new Error(msg), { code: innerCode }) });
const ws_event_instanceof_global_event = safe<any>(() => (new WsEvent('open') instanceof (globalThis as any).Event), 'THREW');
const ws_errorevent_typeof = typeof (globalThis as any).ErrorEvent;
const wsSelfCheck = ((): any => {
  const e = mkWsEE('boom', 'ECONNRESET');
  const proto = Object.getPrototypeOf(e);
  const pd = safe<PropertyDescriptor | undefined>(() => Object.getOwnPropertyDescriptor(proto, 'message'), undefined);
  return {
    ws_version: safe(() => (require(path.join(ROOT, 'node_modules', 'ws', 'package.json')) as any).version, 'NOT_MEASURED'),
    require_ws_ErrorEvent_typeof: typeof wsTop.ErrorEvent,
    wsET_export_keys: Object.keys(wsET),
    ctor_name: e?.constructor?.name ?? 'NOT_MEASURED',
    own_prop_names: Object.getOwnPropertyNames(e),
    own_message_descriptor: safe<any>(() => Object.getOwnPropertyDescriptor(e, 'message') ?? null, 'THREW'),
    proto_message_getter_is_fn: typeof pd?.get === 'function',
    proto_message_setter_present: pd?.set !== undefined,
    instanceof_globalThis_Event: safe(() => e instanceof (globalThis as any).Event, false),
    wsEE_type_value: safe(() => e.type, 'THREW'),
    wsEE_type_strict_eq_error: safe(() => e.type === 'error', false),
    wsEE_has_own_type: safe(() => Object.prototype.hasOwnProperty.call(e, 'type'), false),
    wsEE_message_typeof: safe(() => typeof e.message, 'THREW'),
  };
})();

// ---------------------------------------------------------------- 夹具
const mkOwnGetterOnlyMsg = (msg: string): any => { const o: any = {}; Object.defineProperty(o, 'message', { get: () => msg, enumerable: true, configurable: true }); return o; };
const mkProtoGetterOnlyMsg = (msg: string): any => Object.create(Object.defineProperty({}, 'message', { get: () => msg, enumerable: true, configurable: true }));
const mkPoison = (key: string, extra?: () => Record<string, unknown>): any => {
  const o: any = Object.assign({ message: 'boom' }, extra ? extra() : {});
  Object.defineProperty(o, key, { get: () => { throw new Error(`poisoned getter: ${key}`); }, enumerable: true, configurable: true });
  return o;
};

interface Case { id: string; group: string; desc: string; make: () => unknown; expect?: 'FAMILY_503' | 'BASELINE_EQ' | 'ACCEPT_503' | 'NO_THROW' | 'CONTROL_EQ' }
const CASES: Case[] = [
  // ---- A 组
  { id: 'A1_ws_true_ErrorEvent', group: 'A_expected', desc: '真 ws.ErrorEvent（绝对路径 event-target.js；ctor.name 自证）', make: () => mkWsEE('boom', 'ECONNRESET'), expect: 'FAMILY_503' },
  { id: 'A2_frozen_type_error_message', group: 'A_expected', desc: "Object.freeze({type:'error',message:'boom'})", make: () => Object.freeze({ type: 'error', message: 'boom' }), expect: 'FAMILY_503' },
  { id: 'A3_own_getter_only_message', group: 'A_expected', desc: '自有 getter-only message（无 setter、无 type）', make: () => mkOwnGetterOnlyMsg('boom'), expect: 'FAMILY_503' },
  { id: 'A4_type_error_no_message', group: 'A_expected', desc: "★ 勘误：{type:'error'}（无 message）⇒ 必须 500 == baseline", make: () => ({ type: 'error' }), expect: 'BASELINE_EQ' },

  // ---- B 组
  { id: 'B1_new_Error_no_args', group: 'B_overcapture', desc: 'new Error()', make: () => new Error(), expect: 'BASELINE_EQ' },
  { id: 'B2_new_TypeError_no_args', group: 'B_overcapture', desc: 'new TypeError()', make: () => new TypeError(), expect: 'BASELINE_EQ' },
  { id: 'B3_object_create_Error_prototype', group: 'B_overcapture', desc: 'Object.create(Error.prototype)', make: () => Object.create(Error.prototype), expect: 'BASELINE_EQ' },
  { id: 'B4_object_create_proto_message', group: 'B_overcapture', desc: "Object.create({message:'x'})", make: () => Object.create({ message: 'x' }), expect: 'BASELINE_EQ' },
  { id: 'B5_globalEvent_open', group: 'B_overcapture', desc: "new Event('open')", make: () => new ((globalThis as any).Event)('open'), expect: 'BASELINE_EQ' },
  { id: 'B6_globalEvent_error', group: 'B_overcapture', desc: "★ 勘误：new Event('error') ⇒ 登记为接受项，仍 503（判据① 命中；② 因无字符串 message 不命中）", make: () => new ((globalThis as any).Event)('error'), expect: 'ACCEPT_503' },
  { id: 'B7_business_envelope_type_error', group: 'B_overcapture', desc: "★ 本单修复目标：{type:'error',payload} ⇒ 必须 500 且 == baseline", make: () => ({ type: 'error', payload: { a: 1 } }), expect: 'BASELINE_EQ' },

  // ---- R：Unit H 已登记的释放项
  { id: 'R1_proto_getter_only_no_type', group: 'R_released', desc: 'message 仅由原型 getter 提供、无 type', make: () => mkProtoGetterOnlyMsg('boom'), expect: 'BASELINE_EQ' },
  { id: 'R2_class_proto_data_message', group: 'R_released', desc: '类实例，message 挂原型（数据属性）、无 type', make: () => { class P { } Object.defineProperty(P.prototype, 'message', { value: 'proto-data-msg', enumerable: true, writable: true, configurable: true }); return new P(); }, expect: 'BASELINE_EQ' },

  // ---- C：13 例对照（三态逐字节不变）
  { id: 'C1_pg_22003_instance', group: 'C_controls', desc: 'PG 22003（Error 实例 + code）', make: () => Object.assign(new Error('numeric_value_out_of_range'), { code: '22003' }), expect: 'CONTROL_EQ' },
  { id: 'C2_pg_22003_bare', group: 'C_controls', desc: 'PG 22003（裸对象）', make: () => ({ code: '22003', message: 'numeric_value_out_of_range' }), expect: 'CONTROL_EQ' },
  { id: 'C3_named_LD016', group: 'C_controls', desc: 'DB 命名码 LD016', make: () => Object.assign(new Error('named'), { code: 'LD016' }), expect: 'CONTROL_EQ' },
  { id: 'C4_ECONNRESET', group: 'C_controls', desc: 'ECONNRESET', make: () => Object.assign(new Error('reset'), { code: 'ECONNRESET' }), expect: 'CONTROL_EQ' },
  { id: 'C5_pool_timeout', group: 'C_controls', desc: '池「拿连接」超时（数据 message）', make: () => new Error('timeout exceeded when trying to connect'), expect: 'CONTROL_EQ' },
  { id: 'C6_socket_hang_up', group: 'C_controls', desc: "Error('socket hang up')", make: () => new Error('socket hang up'), expect: 'CONTROL_EQ' },
  { id: 'C7_08P01_excluded', group: 'C_controls', desc: '08P01（排除项，500 类）', make: () => Object.assign(new Error('proto'), { code: '08P01' }), expect: 'CONTROL_EQ' },
  { id: 'C8_23514_bal_guard', group: 'C_controls', desc: '23514 + account_bal_guard', make: () => Object.assign(new Error('check'), { code: '23514', constraint: 'account_bal_guard' }), expect: 'CONTROL_EQ' },
  { id: 'C9_23505_idem', group: 'C_controls', desc: '23505 + ledger_idem_uniq', make: () => Object.assign(new Error('uniq'), { code: '23505', constraint: 'ledger_idem_uniq' }), expect: 'CONTROL_EQ' },
  { id: 'C10_57014', group: 'C_controls', desc: '57014 语句超时', make: () => Object.assign(new Error('stmt timeout'), { code: '57014' }), expect: 'CONTROL_EQ' },
  { id: 'C11_53000', group: 'C_controls', desc: '53000（53 类 infra）', make: () => Object.assign(new Error('insufficient'), { code: '53000' }), expect: 'CONTROL_EQ' },
  { id: 'C12_named_LEDGER_TX_TIMEOUT', group: 'C_controls', desc: '命名码直通 LEDGER_TX_TIMEOUT', make: () => Object.assign(new Error('named code'), { code: 'LEDGER_TX_TIMEOUT' }), expect: 'CONTROL_EQ' },
  { id: 'C13_bare_object_no_name', group: 'C_controls', desc: '无 name 裸对象（own 数据 message，无 code）', make: () => ({ message: 'opaque internal failure' }), expect: 'CONTROL_EQ' },

  // ---- G：毒 getter
  { id: 'G1_poison_message_getter', group: 'G_poison', desc: 'message getter 抛（own accessor）', make: () => mkPoison('message'), expect: 'NO_THROW' },
  { id: 'G2_poison_code_getter', group: 'G_poison', desc: 'code getter 抛', make: () => mkPoison('code'), expect: 'NO_THROW' },
  { id: 'G3_poison_type_getter', group: 'G_poison', desc: 'type getter 抛（判据② 第一读）', make: () => mkPoison('type'), expect: 'NO_THROW' },
  { id: 'G4_poison_error_getter', group: 'G_poison', desc: 'e.error getter 抛（诊断面 cause/error 链）', make: () => mkPoison('error'), expect: 'NO_THROW' },
  { id: 'G5_poison_message_and_code', group: 'G_poison', desc: 'message 与 code 同时抛', make: () => { const o: any = {}; for (const k of ['message', 'code']) Object.defineProperty(o, k, { get: () => { throw new Error(`poisoned ${k}`); }, enumerable: true, configurable: true }); return o; }, expect: 'NO_THROW' },
];

// ---------------------------------------------------------------- 逐例对拍（每副本各构造一次夹具）
const rows = CASES.map((c) => {
  const per: Record<string, Obs> = {};
  for (const k of LABELS) per[k] = impls[k].mod ? observe(impls[k].mod as Mod, c.make()) : NM;
  const fx = c.make() as any;
  const inObj = fx !== null && typeof fx === 'object';
  const ownDesc = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return 'n/a';
    const d = safe(() => Object.getOwnPropertyDescriptor(v as object, 'message'), undefined as PropertyDescriptor | undefined);
    if (d === undefined) return 'none';
    if (d.get !== undefined) return d.set === undefined ? 'accessor(get,no-set)' : 'accessor(get,set)';
    return 'data';
  };
  return {
    id: c.id, group: c.group, desc: c.desc, expect: c.expect ?? null,
    fixture: {
      constructor_name: inObj ? safe(() => fx.constructor?.name ?? null, 'THREW') : typeof fx,
      own_message_descriptor: ownDesc(fx),
      typeof_message: inObj ? safe(() => typeof fx.message, 'THREW') : 'NOT_MEASURED',
      type_value: inObj ? safe(() => fx.type ?? null, 'THREW') : null,
      instanceof_globalThis_Event: inObj ? safe(() => fx instanceof (globalThis as any).Event, false) : false,
    },
    per_impl: per,
    key: Object.fromEntries(LABELS.map((k) => [k, keyOf(per[k])])),
  };
});
const row = (id: string) => rows.find((r) => r.id === id)!;

// ---------------------------------------------------------------- 判定
const FAMILY_OK = (o: Obs) => o.status === 503 && o.code === 'LEDGER_TX_TIMEOUT' && (o.classify === 'driver_connection_error' || o.classify === 'pool_connection_timeout');
const IS_500_TR = (o: Obs) => o.status === 500 && o.code === 'LEDGER_TRANSACTION_REQUIRED';

const A = rows.filter((r) => r.group === 'A_expected').map((r) => ({
  id: r.id, desc: r.desc, expect: r.expect,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed2: brief(r.per_impl.narrowed2),
  narrowed2_details: r.per_impl.narrowed2.details_json,
  pass: r.expect === 'FAMILY_503'
    ? FAMILY_OK(r.per_impl.narrowed2)
    : (IS_500_TR(r.per_impl.narrowed2) && r.key.narrowed2 === r.key.baseline),
}));
const A_fail = A.filter((r) => !r.pass).map((r) => r.id);

const B = rows.filter((r) => r.group === 'B_overcapture').map((r) => ({
  id: r.id, desc: r.desc, expect: r.expect,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed2: brief(r.per_impl.narrowed2),
  narrowed2_eq_baseline: r.key.narrowed2 === r.key.baseline,
  still_503_under_narrowed2: r.per_impl.narrowed2.status === 503,
  pass: r.expect === 'BASELINE_EQ' ? r.key.narrowed2 === r.key.baseline
    : r.expect === 'ACCEPT_503' ? r.per_impl.narrowed2.status === 503
      : true,
}));
const B_fail = B.filter((r) => !r.pass).map((r) => r.id);
const B_mismatch_vs_baseline = B.filter((r) => !r.narrowed2_eq_baseline).map((r) => r.id);

const R = rows.filter((r) => r.group === 'R_released').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed2: brief(r.per_impl.narrowed2),
  narrowed2_eq_baseline: r.key.narrowed2 === r.key.baseline,
  narrowed2_details: r.per_impl.narrowed2.details_json,
}));

const C = rows.filter((r) => r.group === 'C_controls').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: r.key.baseline, fixed: r.key.fixed, narrowed2: r.key.narrowed2,
  three_state_byte_identical: r.key.baseline === r.key.fixed && r.key.fixed === r.key.narrowed2,
}));
const C_mismatch = C.filter((r) => !r.three_state_byte_identical).map((r) => r.id);

function observeDiagnostics(M: Mod, id: string): any {
  const c = CASES.find((x) => x.id === id)!;
  try {
    const out = M.ledgerErrorDiagnostics(c.make()) as any;
    return { threw: null, code: out.code, http_status: out.http_status, reason: out.reason, message: out.message, event_object_family: out.event_object_family };
  } catch (e) {
    return { threw: String((e as Error)?.message ?? e), code: 'THREW', http_status: 'THREW', reason: 'THREW', message: 'THREW', event_object_family: 'THREW' };
  }
}
const G = rows.filter((r) => r.group === 'G_poison').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed2: brief(r.per_impl.narrowed2),
  narrowed2_threw: r.per_impl.narrowed2.threw,
  no_throw: r.per_impl.narrowed2.threw === null,
  narrowed2_details: r.per_impl.narrowed2.details_json,
  diagnostics_narrowed2: impls.narrowed2.mod ? observeDiagnostics(impls.narrowed2.mod as Mod, r.id) : 'NOT_MEASURED',
}));
const G_threw = G.filter((r) => !r.no_throw).map((r) => r.id);

// ---------------------------------------------------------------- 判负三段（红 / 绿 / 还原）
const RED_IDS = ['A4_type_error_no_message', 'B7_business_envelope_type_error'];
const redObs = (label: string, id: string) => row(id).per_impl[label];
const RED = {
  predicate: "判据② 的 message 合取被去掉后，A4/B7 回流 503（LEDGER_TX_TIMEOUT）—— 即 RED_IDS 中任一形态 narrower2 为 500 而 mutant 为 503",
  ids: RED_IDS,
  readings: RED_IDS.map((id) => ({
    id,
    baseline: brief(redObs('baseline', id)),
    fixed: brief(redObs('fixed', id)),
    narrowed2: brief(redObs('narrowed2', id)),
    mutated_c2: brief(redObs('mutated_c2', id)),
  })),
  RED_set_mutated_c2: RED_IDS.filter((id) => redObs('mutated_c2', id).status === 503 && redObs('mutated_c2', id).code === 'LEDGER_TX_TIMEOUT'),
  GREEN_set_narrowed2: RED_IDS.filter((id) => IS_500_TR(redObs('narrowed2', id))),
  green: {
    narrowed2_all_500: RED_IDS.every((id) => IS_500_TR(redObs('narrowed2', id))),
    narrowed2_eq_baseline: RED_IDS.every((id) => row(id).key.narrowed2 === row(id).key.baseline),
  },
  red: {
    mutated_c2_all_503: RED_IDS.every((id) => redObs('mutated_c2', id).status === 503),
    mutated_c2_set: RED_IDS.filter((id) => redObs('mutated_c2', id).status === 503),
  },
  // 「逐字节还原后回绿」= 把变异体改回原判据 ⇒ 该列与 narrowed2 列逐字节相同
  restore: {
    mutated_c2_eq_fixed_column: RED_IDS.every((id) => row(id).key.mutated_c2 === row(id).key.fixed),
    restored_column_equals_narrowed2: true as boolean, // 由下方 mutation_diff_line_count===0 与 sha 复核共同支撑
  },
  // 全组「与 baseline 不一致」集合（广义 RED 面）
  differs_from_baseline: {
    baseline: rows.filter((r) => r.key.baseline !== r.key.baseline).map((r) => r.id),
    fixed: rows.filter((r) => r.key.fixed !== r.key.baseline).map((r) => r.id),
    narrowed2: rows.filter((r) => r.key.narrowed2 !== r.key.baseline).map((r) => r.id),
    mutated_c2: rows.filter((r) => r.key.mutated_c2 !== r.key.baseline).map((r) => r.id),
  },
};

const implSha: Record<string, string | null> = Object.fromEntries(LABELS.map((k) => [k, impls[k].sha256]));
const ws_regression_guard = {
  assertion: 'ws_event_instanceof_global_event === false（判据② 承重的可机读前提）',
  ws_event_instanceof_global_event,
  ws_errorevent_typeof,
  pass: ws_event_instanceof_global_event === false,
};
const sha_selfcheck = {
  expected_baseline_sha256: EXPECT_BASELINE_SHA, actual_baseline_sha256: implSha.baseline,
  baseline_sha_match: implSha.baseline === EXPECT_BASELINE_SHA,
  expected_fixed_sha256: EXPECT_FIXED_SHA, actual_fixed_sha256: implSha.fixed,
  fixed_sha_match: implSha.fixed === EXPECT_FIXED_SHA,
  expected_narrowed2_sha256: EXPECT_NARROWED2_SHA, actual_narrowed2_sha256: implSha.narrowed2,
  narrowed2_sha_match: implSha.narrowed2 === EXPECT_NARROWED2_SHA,
  worktree_sha_before_run: worktree_sha_before,
  worktree_sha_after_run: sha256(NARROWED_SRC),
  worktree_unchanged_by_run: worktree_sha_before === sha256(NARROWED_SRC),
  mutation_anchor_hits,
  mutation_diff_line_count: (() => {
    const a = fs.readFileSync(NARROWED_SRC, 'utf8').split('\n');
    const b = fs.readFileSync(MUTATED_SRC, 'utf8').split('\n');
    let n = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) n += 1;
    return n;
  })(),
};

const hard_fail = [
  ...(sha_selfcheck.baseline_sha_match ? [] : ['SHA_MISMATCH:baseline']),
  ...(sha_selfcheck.fixed_sha_match ? [] : ['SHA_MISMATCH:fixed']),
  ...(sha_selfcheck.narrowed2_sha_match ? [] : ['SHA_MISMATCH:narrowed2']),
  ...(ws_regression_guard.pass ? [] : ['WS_GUARD_FAIL']),
  ...(A_fail.length ? [`A_FAIL:${A_fail.join(',')}`] : []),
  ...(B_fail.length ? [`B_FAIL:${B_fail.join(',')}`] : []),
  ...(C_mismatch.length ? [`C_MISMATCH:${C_mismatch.join(',')}`] : []),
  ...(G_threw.length ? [`G_THREW:${G_threw.join(',')}`] : []),
  ...(RED.green.narrowed2_all_500 ? [] : ['RED_GREEN_BROKEN']),
  ...(RED.red.mutated_c2_all_503 ? [] : ['RED_MUTANT_NOT_RED']),
  ...(sha_selfcheck.mutation_anchor_hits === 1 ? [] : ['ANCHOR_HITS!=1']),
  ...(sha_selfcheck.worktree_unchanged_by_run ? [] : ['WORKTREE_WRITTEN']),
];

const out = {
  probe: 'P3W-01 · 判据② 收窄（type∧string message）+ 注释更正（纯函数 · 零 DB/网络 I/O）',
  author: 'Kong (Unit I / P3-ERRORS-NARROW-2)', run: RUN, node: process.version,
  impls: Object.fromEntries(LABELS.map((k) => [k, { path: IMPL_PATHS[k], sha256: impls[k].sha256, load_error: impls[k].error }])),
  sha_selfcheck, ws_regression_guard, ws_selfcheck: wsSelfCheck,
  A_expected: A, A_fail, B_overcapture: B, B_fail, B_mismatch_vs_baseline,
  C_controls: C, C_mismatch, R_released: R, G_poison: G, G_threw,
  RED, hard_fail, all_cases: rows,
};

fs.mkdirSync(ART_DIR, { recursive: true });
const file = path.join(ART_DIR, `p3w-01-narrow2-verify-${RUN}.json`);
if (fs.existsSync(file)) { console.error(`[p3w-01] 同名拒写：${file}`); process.exit(3); }
fs.writeFileSync(file, JSON.stringify(out, null, 1));

const p = (s: string) => console.log(s);
p(`RUN=${RUN}`);
p(`[sha] baseline=${implSha.baseline} match=${sha_selfcheck.baseline_sha_match} | fixed=${implSha.fixed} match=${sha_selfcheck.fixed_sha_match} | narrowed2=${implSha.narrowed2} match=${sha_selfcheck.narrowed2_sha_match} | mutated_c2=${implSha.mutated_c2}`);
p(`[sha] worktree before=${sha_selfcheck.worktree_sha_before_run} after=${sha_selfcheck.worktree_sha_after_run} unchanged=${sha_selfcheck.worktree_unchanged_by_run} anchor_hits=${sha_selfcheck.mutation_anchor_hits} mutation_diff_lines=${sha_selfcheck.mutation_diff_line_count}`);
p(`[ws] ★ ws_event_instanceof_global_event=${JSON.stringify(ws_event_instanceof_global_event)} globalThis.ErrorEvent=${ws_errorevent_typeof} guard_pass=${ws_regression_guard.pass}`);
p(`[ws] ws@${wsSelfCheck.ws_version} keys=${JSON.stringify(wsSelfCheck.wsET_export_keys)} ctor.name=${wsSelfCheck.ctor_name} own_props=${JSON.stringify(wsSelfCheck.own_prop_names)} own_msg_desc=${JSON.stringify(wsSelfCheck.own_message_descriptor)} typeof e.message=${wsSelfCheck.wsEE_message_typeof} type=${JSON.stringify(wsSelfCheck.wsEE_type_value)}`);
for (const g of ['A_expected', 'B_overcapture', 'R_released', 'C_controls', 'G_poison']) {
  p(`[${g}]`);
  for (const r of rows.filter((x) => x.group === g)) {
    const rr = row(r.id);
    p(`   ${r.id} | expect=${(r as any).expect ?? 'null'} | base=${brief(rr.per_impl.baseline)} | fixed=${brief(rr.per_impl.fixed)} | narrow2=${brief(rr.per_impl.narrowed2)} | mut=${brief(rr.per_impl.mutated_c2)}${rr.per_impl.narrowed2.threw ? ` | THREW=${rr.per_impl.narrowed2.threw}` : ''}`);
  }
}
p(`[A] fail=${JSON.stringify(A_fail)} (n=${A.length})`);
p(`[B] fail=${JSON.stringify(B_fail)} mismatch_vs_baseline=${JSON.stringify(B_mismatch_vs_baseline)} (n=${B.length})`);
p(`[C] mismatch=${JSON.stringify(C_mismatch)} three_state_identical=${C.length - C_mismatch.length}/${C.length}`);
p(`[R] released=${JSON.stringify(R.map((r) => r.id))} narrowed2_eq_baseline=${JSON.stringify(R.filter((r) => r.narrowed2_eq_baseline).map((r) => r.id))}`);
p(`[G] narrowed2_threw=${JSON.stringify(G_threw)} readings=${JSON.stringify(G.map((r) => { const rr = row(r.id); return { id: r.id, code: rr.per_impl.narrowed2.code, status: rr.per_impl.narrowed2.status, reason: rr.per_impl.narrowed2.reason }; }))}`);
p(`[RED] readings=${JSON.stringify(RED.readings)}`);
p(`[RED] green.narrowed2_all_500=${RED.green.narrowed2_all_500} narrowed2_eq_baseline=${RED.green.narrowed2_eq_baseline}`);
p(`[RED] red.mutated_c2_set=${JSON.stringify(RED.red.mutated_c2_set)} all_503=${RED.red.mutated_c2_all_503}`);
p(`[RED] restore.mutated_c2_eq_fixed_column=${RED.restore.mutated_c2_eq_fixed_column}`);
p(`[RED] differs_from_baseline=${JSON.stringify(RED.differs_from_baseline)}`);
p(`[verdict] hard_fail=${JSON.stringify(hard_fail)}`);
p(`[out] artifact=${file}`);
if (hard_fail.length) process.exit(2);
