/**
 * P3W-00 ·「事件对象族判据收窄 + 分类路径守卫」自建探针（Kong / Unit H · P3-ERRORS-NARROW）
 * ============================================================================
 * 纯函数 · **零 DB / 零网络 I/O**（本单 DB 零写、不得建任何库对象）。唯一落盘 = 本探针自己的
 * run-tagged artifact + 它在 `.p3w-artifacts/_impl/` 下生成的副本（同名拒写）。
 *
 * 同进程加载 **4 份实现副本**，同一套夹具逐形态对拍：
 *   baseline = `.p3w-artifacts/_impl/baseline-ledger-errors.ts`（`git show 88783a2:` ⇒ sha 721156cb…）
 *   fixed    = `.p3w-artifacts/_impl/fixed-ledger-errors.ts`   （`git show HEAD:`     ⇒ sha 9bc127e4…）
 *   narrowed = 工作树 `src/ledger-errors.ts`（本单元交付物）
 *   mutated  = narrowed 现场复原被删的第二子句（判负自证）—— 探针**自建**，锚点找不到即抛
 * ⚠️ baseline 用「**内容 sha**」自证（Unit G §11.1 因用 `HEAD` 符号自证作废过一整次 run）；
 *    本单若发现与本文件顶部常量不符 ⇒ 直接判 FAIL 并在 stdout 打印实测 sha。
 * ⚠️ `new Event('error')` 与 `{type:'error',payload}` 按**裁决**仍在 503（判据②不变）——
 *    与 AC 文本 B 组清单冲突，已在本 run 的 `b_group_conflict_registration` 里显式登记，不隐藏。
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

const sha256 = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ---------------------------------------------------------------- 判负副本生成
const NARROWED_SRC = path.join(ROOT, 'src', 'ledger-errors.ts');
const MUTATED_SRC = path.join(IMPL_DIR, 'mutated-clause3b-ledger-errors.ts');
const MUTATION_ANCHOR = `  if (desc !== undefined && desc.get !== undefined && desc.set === undefined && typeof safeRead(e, 'message') === 'string') return true;\n  return false;`;
const MUTATION_INSERT = `  if (desc === undefined && typeof safeRead(e, 'message') === 'string') return true;\n  return false;`;
const worktree_sha_before = sha256(NARROWED_SRC);
{
  const src = fs.readFileSync(NARROWED_SRC, 'utf8');
  const n = src.split(MUTATION_ANCHOR).length - 1;
  if (n !== 1) throw new Error(`[p3w-00] 判负锚点命中 ${n} 处（应为 1）⇒ 拒绝生成变异副本`);
  fs.mkdirSync(IMPL_DIR, { recursive: true });
  fs.writeFileSync(MUTATED_SRC, src.replace(MUTATION_ANCHOR, MUTATION_INSERT));
}

const IMPL_PATHS: Record<string, string> = {
  baseline: path.join(IMPL_DIR, 'baseline-ledger-errors.ts'),
  fixed: path.join(IMPL_DIR, 'fixed-ledger-errors.ts'),
  narrowed: NARROWED_SRC,
  mutated_clause3b: MUTATED_SRC,
};
const LABELS = Object.keys(IMPL_PATHS);
const EXPECTED_SHA: Record<string, string> = { baseline: EXPECT_BASELINE_SHA, fixed: EXPECT_FIXED_SHA };

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
const NM: Obs = { classify: 'THREW', code: 'THREW', status: 'THREW', details_json: null, details_keys: null, reason: null, threw: 'NOT_MEASURED: 该副本未加载' };
const obsAll = (make: (label: string) => unknown): Record<string, Obs> => {
  const out: Record<string, Obs> = {};
  for (const k of LABELS) out[k] = impls[k].mod ? observe(impls[k].mod as Mod, make(k)) : NM;
  return out;
};
const keyOf = (o: Obs) => JSON.stringify({ classify: o.classify, code: o.code, status: o.status, details: o.details_json });
const brief = (o: Obs) => `${o.code}/${o.status}/${o.classify}`;

// ---------------------------------------------------------------- 真 ws.ErrorEvent（绝对路径）
const wsETPath = path.join(ROOT, 'node_modules', 'ws', 'lib', 'event-target.js');
const wsET = require(wsETPath) as any;
const wsTop = require('ws') as any;
const WsErrorEvent = wsET.ErrorEvent as new (type: string, opts?: any) => any;
const mkWsEE = (msg: string, innerCode: string): any =>
  new WsErrorEvent('error', { message: msg, error: Object.assign(new Error(msg), { code: innerCode }) });
const wsSelfCheck = ((): any => {
  const e = mkWsEE('boom', 'ECONNRESET');
  const proto = Object.getPrototypeOf(e);
  const pd = safe(() => Object.getOwnPropertyDescriptor(proto, 'message'), undefined as PropertyDescriptor | undefined);
  return {
    ws_version: safe(() => (require(path.join(ROOT, 'node_modules', 'ws', 'package.json')) as any).version, 'NOT_MEASURED'),
    require_ws_ErrorEvent_typeof: typeof wsTop.ErrorEvent,
    wsET_export_keys: Object.keys(wsET),
    ctor_name: e?.constructor?.name ?? 'NOT_MEASURED',
    own_message_descriptor: safe(() => Object.getOwnPropertyDescriptor(e, 'message') ?? null, 'THREW'),
    proto_message_getter_is_fn: typeof pd?.get === 'function',
    proto_message_setter_present: pd?.set !== undefined,
    instanceof_globalThis_Event: safe(() => e instanceof (globalThis as any).Event, false),
    // ★ 本单「已释放形态为何可接受」的**实测**支撑：真物恒带标准判别位
    wsEE_type_value: safe(() => e.type, 'THREW'),
    wsEE_type_strict_eq_error: safe(() => e.type === 'error', false),
    wsEE_has_own_type: safe(() => Object.prototype.hasOwnProperty.call(e, 'type'), false),
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

interface Case { id: string; group: string; desc: string; make: (label: string) => unknown; expect?: 'FAMILY_503' | 'BASELINE_EQ' | 'CONTROL_EQ' | 'NO_THROW' }
const CASES: Case[] = [
  // ---- A 组：预期内（== fixed，事件对象族 ⇒ 503/LEDGER_TX_TIMEOUT）
  { id: 'A1_ws_true_ErrorEvent', group: 'A_expected', desc: '真 ws.ErrorEvent（node_modules/ws/lib/event-target.js 绝对路径；ctor.name 自证）', make: () => mkWsEE('boom', 'ECONNRESET'), expect: 'FAMILY_503' },
  { id: 'A2_frozen_type_error_message', group: 'A_expected', desc: "Object.freeze({type:'error',message})", make: () => Object.freeze({ type: 'error', message: 'boom' }), expect: 'FAMILY_503' },
  { id: 'A3_own_getter_only_message', group: 'A_expected', desc: '自有 getter-only message（无 setter、无 type）', make: () => mkOwnGetterOnlyMsg('boom'), expect: 'FAMILY_503' },
  { id: 'A4_type_error_no_message', group: 'A_expected', desc: "{type:'error'}（无 message）", make: () => ({ type: 'error' }), expect: 'FAMILY_503' },

  // ---- B 组：预期外过捕面（必须回到 baseline）
  { id: 'B1_new_Error_no_args', group: 'B_overcapture', desc: 'new Error()', make: () => new Error(), expect: 'BASELINE_EQ' },
  { id: 'B2_new_TypeError_no_args', group: 'B_overcapture', desc: 'new TypeError()', make: () => new TypeError(), expect: 'BASELINE_EQ' },
  { id: 'B3_object_create_Error_prototype', group: 'B_overcapture', desc: 'Object.create(Error.prototype)', make: () => Object.create(Error.prototype), expect: 'BASELINE_EQ' },
  { id: 'B4_object_create_proto_message', group: 'B_overcapture', desc: "Object.create({message:'x'})", make: () => Object.create({ message: 'x' }), expect: 'BASELINE_EQ' },
  { id: 'B5_globalEvent_open', group: 'B_overcapture', desc: "new Event('open')（判据① 加 type 后释放）", make: () => new ((globalThis as any).Event)('open'), expect: 'BASELINE_EQ' },
  { id: 'B6_globalEvent_error', group: 'B_overcapture', desc: "new Event('error')（⚠️ 判据② 命中 ⇒ 按裁决仍 503，见冲突登记）", make: () => new ((globalThis as any).Event)('error') },
  { id: 'B7_business_envelope_type_error', group: 'B_overcapture', desc: "{type:'error',payload}（⚠️ 接受残余 ⇒ 仍 503，见冲突登记）", make: () => ({ type: 'error', payload: { a: 1 } }) },

  // ---- R：显式登记的「已释放」形态（窄化后回 500）
  { id: 'R1_proto_getter_only_no_type', group: 'R_released', desc: 'message 仅由**原型 getter** 提供、且**无 type**（窄化后释放）', make: () => mkProtoGetterOnlyMsg('boom') },
  { id: 'R2_class_proto_data_message', group: 'R_released', desc: '类实例，message 挂在原型上（数据属性）、无 type（窄化后释放）', make: () => { class P { } Object.defineProperty(P.prototype, 'message', { value: 'proto-data-msg', enumerable: true, writable: true, configurable: true }); return new P(); } },

  // ---- C 组：既有 13 例对照（三态逐字节不变）
  { id: 'C1_pg_22003_instance', group: 'C_controls', desc: 'PG 22003（Error 实例 + code）', make: () => Object.assign(new Error('numeric_value_out_of_range'), { code: '22003' }), expect: 'CONTROL_EQ' },
  { id: 'C2_pg_22003_bare', group: 'C_controls', desc: 'PG 22003（裸对象）', make: () => ({ code: '22003', message: 'numeric_value_out_of_range' }), expect: 'CONTROL_EQ' },
  { id: 'C3_named_LD016', group: 'C_controls', desc: 'DB 命名码 LD016', make: () => Object.assign(new Error('named'), { code: 'LD016' }), expect: 'CONTROL_EQ' },
  { id: 'C4_ECONNRESET', group: 'C_controls', desc: 'ECONNRESET', make: () => Object.assign(new Error('reset'), { code: 'ECONNRESET' }), expect: 'CONTROL_EQ' },
  { id: 'C5_pool_timeout', group: 'C_controls', desc: '池「拿连接」超时（Error 实例 + 数据 message）', make: () => new Error('timeout exceeded when trying to connect'), expect: 'CONTROL_EQ' },
  { id: 'C6_socket_hang_up', group: 'C_controls', desc: "Error('socket hang up')", make: () => new Error('socket hang up'), expect: 'CONTROL_EQ' },
  { id: 'C7_08P01_excluded', group: 'C_controls', desc: '08P01（排除项，500 类）', make: () => Object.assign(new Error('proto'), { code: '08P01' }), expect: 'CONTROL_EQ' },
  { id: 'C8_23514_bal_guard', group: 'C_controls', desc: '23514 + account_bal_guard', make: () => Object.assign(new Error('check'), { code: '23514', constraint: 'account_bal_guard' }), expect: 'CONTROL_EQ' },
  { id: 'C9_23505_idem', group: 'C_controls', desc: '23505 + ledger_idem_uniq', make: () => Object.assign(new Error('uniq'), { code: '23505', constraint: 'ledger_idem_uniq' }), expect: 'CONTROL_EQ' },
  { id: 'C10_57014', group: 'C_controls', desc: '57014 语句超时', make: () => Object.assign(new Error('stmt timeout'), { code: '57014' }), expect: 'CONTROL_EQ' },
  { id: 'C11_53000', group: 'C_controls', desc: '53000（53 类 infra）', make: () => Object.assign(new Error('insufficient'), { code: '53000' }), expect: 'CONTROL_EQ' },
  { id: 'C12_named_LEDGER_TX_TIMEOUT', group: 'C_controls', desc: '命名码直通 LEDGER_TX_TIMEOUT', make: () => Object.assign(new Error('named code'), { code: 'LEDGER_TX_TIMEOUT' }), expect: 'CONTROL_EQ' },
  { id: 'C13_bare_object_no_name', group: 'C_controls', desc: '无 name 裸对象（own 数据 message，无 code）', make: () => ({ message: 'opaque internal failure' }), expect: 'CONTROL_EQ' },

  // ---- G 组：毒 getter（守卫 AC：均不抛、读数确定）
  { id: 'G1_poison_message_getter', group: 'G_poison', desc: 'message getter 抛（own accessor，get 抛）', make: () => mkPoison('message'), expect: 'NO_THROW' },
  { id: 'G2_poison_code_getter', group: 'G_poison', desc: 'code getter 抛', make: () => mkPoison('code'), expect: 'NO_THROW' },
  { id: 'G3_poison_type_getter', group: 'G_poison', desc: 'type getter 抛', make: () => mkPoison('type'), expect: 'NO_THROW' },
  { id: 'G4_poison_error_getter', group: 'G_poison', desc: 'e.error getter 抛（诊断面 cause/error 链守卫）', make: () => mkPoison('error'), expect: 'NO_THROW' },
  { id: 'G5_poison_message_and_code', group: 'G_poison', desc: 'message 与 code 同时抛', make: () => { const o: any = {}; for (const k of ['message', 'code']) Object.defineProperty(o, k, { get: () => { throw new Error(`poisoned ${k}`); }, enumerable: true, configurable: true }); return o; }, expect: 'NO_THROW' },
];

// ---------------------------------------------------------------- 逐例对拍
const rows = CASES.map((c) => {
  const per = obsAll(c.make);
  const fx = c.make('narrowed') as any;
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
const GROUPS = ['A_expected', 'B_overcapture', 'R_released', 'C_controls', 'G_poison'];
const FAMILY_OK = (o: Obs) => o.status === 503 && o.code === 'LEDGER_TX_TIMEOUT' && (o.classify === 'driver_connection_error' || o.classify === 'pool_connection_timeout');

const A = rows.filter((r) => r.group === 'A_expected').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed: brief(r.per_impl.narrowed),
  narrowed_is_503_tx_timeout: FAMILY_OK(r.per_impl.narrowed),
  narrowed_eq_fixed: r.key.narrowed === r.key.fixed,
  narrowed_details: r.per_impl.narrowed.details_json,
}));
const A_fail = A.filter((r) => !r.narrowed_is_503_tx_timeout).map((r) => r.id);

const B = rows.filter((r) => r.group === 'B_overcapture').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed: brief(r.per_impl.narrowed),
  narrowed_eq_baseline: r.key.narrowed === r.key.baseline,
  released_from_503: r.per_impl.fixed.status === 503 && r.per_impl.narrowed.status !== 503,
  still_503_under_narrowed: r.per_impl.narrowed.status === 503,
}));
const B_mismatch = B.filter((r) => !r.narrowed_eq_baseline).map((r) => r.id);

const R = rows.filter((r) => r.group === 'R_released').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed: brief(r.per_impl.narrowed),
  narrowed_eq_baseline: r.key.narrowed === r.key.baseline,
  narrowed_details: r.per_impl.narrowed.details_json,
}));

const C = rows.filter((r) => r.group === 'C_controls').map((r) => ({
  id: r.id, desc: r.desc,
  baseline: r.key.baseline, fixed: r.key.fixed, narrowed: r.key.narrowed,
  three_state_byte_identical: r.key.baseline === r.key.fixed && r.key.fixed === r.key.narrowed,
}));
const C_mismatch = C.filter((r) => !r.three_state_byte_identical).map((r) => r.id);

const G = rows.filter((r) => r.group === 'G_poison').map((r) => {
  const d = (label: string): any => {
    const M = impls[label].mod as Mod;
    if (!M || typeof M.ledgerErrorDiagnostics !== 'function') return 'NOT_MEASURED';
    return observeDiagnostics(M, r.id);
  };
  return {
    id: r.id, desc: r.desc,
    baseline: brief(r.per_impl.baseline), fixed: brief(r.per_impl.fixed), narrowed: brief(r.per_impl.narrowed),
    narrowed_threw: r.per_impl.narrowed.threw,
    narrowed_no_throw: r.per_impl.narrowed.threw === null,
    narrowed_details: r.per_impl.narrowed.details_json,
    diagnostics_narrowed: d('narrowed'),
  };
});
const G_threw = G.filter((r) => !r.narrowed_no_throw).map((r) => r.id);

// 诊断面（毒 getter 下也必须不抛）
function observeDiagnostics(M: Mod, id: string): any {
  const c = CASES.find((x) => x.id === id)!;
  try {
    const out = M.ledgerErrorDiagnostics(c.make('narrowed')) as any;
    return { threw: null, code: out.code, http_status: out.http_status, message: out.message, event_object_family: out.event_object_family, cause_chain_len: Array.isArray(out.cause_chain) ? out.cause_chain.length : null };
  } catch (e) {
    return { threw: String((e as Error)?.message ?? e), code: 'THREW', http_status: 'THREW', message: 'THREW', event_object_family: 'THREW', cause_chain_len: 'THREW' };
  }
}

// ---------------------------------------------------------------- 判负：RED = B 组出现「回流 503」（相对 baseline 有变化）
const RED_ALL = rows.filter((r) => r.group === 'B_overcapture' || r.group === 'R_released');
const redSet = (label: string) => RED_ALL.filter((r) => r.key[label] !== r.key.baseline).map((r) => r.id);
const RED = {
  predicate: 'B/R 组任一形态的 code/status/details 与 baseline 不一致（即过捕回流）',
  RED_set_baseline: redSet('baseline'),
  RED_set_fixed: redSet('fixed'),
  RED_set_narrowed: redSet('narrowed'),
  RED_set_mutated_clause3b: redSet('mutated_clause3b'),
  RED_set_full_revert_equals_fixed_column: redSet('fixed'),
  verdicts: {
    baseline_green: redSet('baseline').length === 0,
    fixed_red: redSet('fixed').length > 0,
    narrowed_green: redSet('narrowed').length === 0,
    mutated_clause3b_red: redSet('mutated_clause3b').length > 0,
  },
};

const implSha: Record<string, string | null> = Object.fromEntries(LABELS.map((k) => [k, impls[k].sha256]));
const sha_selfcheck = {
  expected_baseline_sha256: EXPECT_BASELINE_SHA,
  actual_baseline_sha256: implSha.baseline,
  baseline_sha_match: implSha.baseline === EXPECT_BASELINE_SHA,
  expected_fixed_sha256: EXPECT_FIXED_SHA,
  actual_fixed_sha256: implSha.fixed,
  fixed_sha_match: implSha.fixed === EXPECT_FIXED_SHA,
  narrowed_worktree_sha256: implSha.narrowed,
  worktree_sha_before_run: worktree_sha_before,
  worktree_sha_after_run: sha256(NARROWED_SRC),
  worktree_unchanged_by_run: worktree_sha_before === sha256(NARROWED_SRC),
  mutation_diff_line_count: (() => {
    const a = fs.readFileSync(NARROWED_SRC, 'utf8').split('\n');
    const b = fs.readFileSync(MUTATED_SRC, 'utf8').split('\n');
    let n = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) n += 1;
    return n;
  })(),
  head_symbol: ((): string => { try { return require('child_process').execSync('git rev-parse HEAD', { cwd: path.resolve(ROOT, '..') }).toString().trim(); } catch { return 'NOT_MEASURED'; } })(),
};

const TSC_EXIT_FILE = path.join(ART_DIR, `p3w-tsc-${RUN}.log`);
const out = {
  probe: 'P3W-00 · 事件对象族判据收窄 + 分类路径守卫探针（纯函数 · 零 DB/网络 I/O）',
  author: 'Kong (Unit H / P3-ERRORS-NARROW)', run: RUN, node: process.version,
  impls: Object.fromEntries(LABELS.map((k) => [k, { path: IMPL_PATHS[k], sha256: impls[k].sha256, load_error: impls[k].error }])),
  sha_selfcheck, ws_selfcheck: wsSelfCheck,
  A_expected: A, A_fail: A_fail,
  B_overcapture: B, B_mismatch: B_mismatch,
  C_controls: C, C_mismatch: C_mismatch,
  R_released: R,
  G_poison: G, G_threw: G_threw,
  RED,
  b_group_conflict_registration: {
    conflict: 'AC 文本列 B1–B7「必须 == baseline(500)」，与【裁决】「判据②（type===\'error\'）不变」+【接受残余】（{type:\'error\',payload} 仍 503）冲突。',
    resolution_executed: '按【裁决】逐字执行（判据② 不动）⇒ B6 `new Event(\'error\')` 与 B7 `{type:\'error\',payload}` 仍 503；B1–B5 回到 baseline。',
    ids_remaining_503: B.filter((r) => r.still_503_under_narrowed).map((r) => r.id),
    reason: "两者都带标准事件判别位 type==='error'（B6 同时满足判据①∧②），按裁决属事件对象族而非过捕。",
  },
  released_registration: {
    ids: R.map((r) => r.id),
    claim: '窄化后此二形态回到 500（== baseline）；可接受性实证：真 ws.ErrorEvent 恒带 type===\'error\'',
    evidence_wsEE_type_value: wsSelfCheck.wsEE_type_value,
    evidence_wsEE_type_strict_eq_error: wsSelfCheck.wsEE_type_strict_eq_error,
    evidence_wsEE_has_own_type: wsSelfCheck.wsEE_has_own_type,
  },
  all_cases: rows,
};

fs.mkdirSync(ART_DIR, { recursive: true });
const file = path.join(ART_DIR, `p3w-00-fold-narrow-verify-${RUN}.json`);
if (fs.existsSync(file)) { console.error(`[p3w-00] 同名拒写：${file}`); process.exit(3); }
fs.writeFileSync(file, JSON.stringify(out, null, 1));

const p = (s: string) => console.log(s);
p(`RUN=${RUN}`);
p(`[sha] baseline=${implSha.baseline} match=${sha_selfcheck.baseline_sha_match} | fixed=${implSha.fixed} match=${sha_selfcheck.fixed_sha_match} | narrowed=${implSha.narrowed} | mutated=${implSha.mutated_clause3b} | HEAD=${sha_selfcheck.head_symbol}`);
p(`[sha] worktree before=${sha_selfcheck.worktree_sha_before_run} after=${sha_selfcheck.worktree_sha_after_run} unchanged=${sha_selfcheck.worktree_unchanged_by_run} mutation_diff_lines=${sha_selfcheck.mutation_diff_line_count}`);
p(`[ws] require('ws').ErrorEvent=${wsSelfCheck.require_ws_ErrorEvent_typeof} | wsET keys=${JSON.stringify(wsSelfCheck.wsET_export_keys)} | ctor.name=${wsSelfCheck.ctor_name} | own_msg_desc=${JSON.stringify(wsSelfCheck.own_message_descriptor)} | instanceof globalThis.Event=${wsSelfCheck.instanceof_globalThis_Event}`);
p(`[ws] ★ wsEE.type=${JSON.stringify(wsSelfCheck.wsEE_type_value)} type==='error'? ${wsSelfCheck.wsEE_type_strict_eq_error} has_own_type=${wsSelfCheck.wsEE_has_own_type} | proto getter fn=${wsSelfCheck.proto_message_getter_is_fn} setter present=${wsSelfCheck.proto_message_setter_present}`);
for (const g of GROUPS) {
  p(`[${g}]`);
  for (const r of rows.filter((x) => x.group === g)) {
    p(`   ${r.id} | base=${brief(r.per_impl.baseline)} | fixed=${brief(r.per_impl.fixed)} | narrow=${brief(r.per_impl.narrowed)}${r.per_impl.narrowed.threw ? ` | THREW=${r.per_impl.narrowed.threw}` : ''}`);
  }
}
p(`[A] fail=${JSON.stringify(A_fail)} (n=${A.length})`);
p(`[B] mismatch_vs_baseline=${JSON.stringify(B_mismatch)} remaining503=${JSON.stringify(out.b_group_conflict_registration.ids_remaining_503)} (n=${B.length})`);
p(`[C] mismatch=${JSON.stringify(C_mismatch)} (n=${C.length}) three_state_identical=${C.length - C_mismatch.length}/${C.length}`);
p(`[R] released=${JSON.stringify(R.map((r) => r.id))} narrowed_eq_baseline=${JSON.stringify(R.filter((r) => r.narrowed_eq_baseline).map((r) => r.id))}`);
p(`[G] narrowed_threw=${JSON.stringify(G_threw)} readings=${JSON.stringify(G.map((r) => ({ id: r.id, narrow: brief(row(r.id).per_impl.narrowed), details: row(r.id).per_impl.narrowed.details_json })))}`);
p(`[G] diagnostics under poison=${JSON.stringify(G.map((r) => ({ id: r.id, diag: r.diagnostics_narrowed })))}`);
p(`[RED] baseline=${JSON.stringify(RED.RED_set_baseline)}`);
p(`[RED] fixed=${JSON.stringify(RED.RED_set_fixed)}`);
p(`[RED] narrowed=${JSON.stringify(RED.RED_set_narrowed)}`);
p(`[RED] mutated_clause3b=${JSON.stringify(RED.RED_set_mutated_clause3b)}`);
p(`[RED] verdicts=${JSON.stringify(RED.verdicts)}`);
p(`[out] artifact=${file} tsc_log_expected=${TSC_EXIT_FILE}`);
