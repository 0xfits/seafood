/**
 * P1F-02 · F2【中高】C0–C5 无兜底 ⇒ 调用方可构造 500 —— 畸形 payload 闭集自检
 * ============================================================================
 * ① 逐例：直调 `ledger_post_event`，取**原始 SQLSTATE + TS 映射码 + status**
 * ② 闭集判据（本脚本的硬断言，修后必须为 0）：
 *      unmapped_escape  = 原始 SQLSTATE 不是 LD0xx（⇒ 从函数里逃出的裸 PG 错误）
 *      status_500       = TS 侧最终 status=500（调用方可触发 ⇒ 触发 R108 告警 = 假缺陷）
 *      not_in_closed_set= TS 映射码不在 §14.1 登记表内
 * ③ 静态闭集自证：migration 里 `ledger_raise('<CODE>'` / `v_code := '<CODE>'` 的**全部**
 *      码都必须落在 §14.1 登记表内；`ledger_error_for_sqlstate` 的全定义域抽样也必须只
 *      返回登记码，且 bucket↔status 一致（input⇒400 / retryable|infra⇒503 / defect⇒500）。
 * ④ 三条「类型闸缺口」的裁定必须可机读：cid / uid / memo 传 JSON number 或嵌套对象 ⇒ 400
 *      （收紧）；uid 前后空格 ⇒ 允许（与 TS btrim 同形）。
 *
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1f-02-f2-malformed.ts [--assert]
 * 测试数据分区：uid 942xxx / symbol 前缀 p1h / 键前缀 ops:p1h:*（920/931/941 已被占）
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, ensureCurrency, attempt, jstr } from './p1f-lib';
import { LEDGER_ERROR_CODES, LEDGER_ERROR_TABLE, normalizeLedgerError } from '../src/ledger-errors';
import { ledgerErrorFromDbError } from '../src/ledger';

const RUN = Date.now().toString(36).toUpperCase();
const SYM = `P1H${RUN}`.slice(0, 12);
const U1 = '942001', U2 = '942002';
const NINETEEN_9 = '9999999999999999999';
const assertMode = process.argv.includes('--assert');

const main = async () => {
  const p = mkPool(3);
  const CID = await ensureCurrency(p, SYM, 942001n, 2, 'listed', '100000000000');
  await attempt(p, { op: 'mint', idempotency_key: `ops:p1h:${RUN}:seed`, uid: U1, cid: CID, amount_units: '1000000' });
  await attempt(p, { op: 'transfer', idempotency_key: `ops:p1h:${RUN}:seed2`, from_uid: U1, to_uid: U2, cid: CID, amount_units: '500000' });

  const K = (s: string) => `ops:p1h:${RUN}:mal:${s}`;
  const base = { op: 'transfer', from_uid: U1, to_uid: U2, cid: CID, amount_units: '1' };

  type Case = [string, unknown, string];
  const cases: Case[] = [
    ['M01_amount_units_19x9', { ...base, idempotency_key: K('m01'), amount_units: NINETEEN_9 }, '19 位但超 bigint ⇒ 修前 22003/500'],
    ['M02_from_uid_19x9', { ...base, idempotency_key: K('m02'), from_uid: NINETEEN_9 }, '同上（身份字段）'],
    ['M03_ref_id_19x9', { ...base, idempotency_key: K('m03'), ref_type: 'job', ref_id: NINETEEN_9 }, '同上（ref）'],
    ['M04_entry_delta_19x9', { op: 'entries', idempotency_key: K('m04'), entries: [{ uid: U1, cid: CID, delta: NINETEEN_9, kind: 'mint' }] }, 'entries 分支'],
    ['M05_cap_19x9', { op: 'hold', idempotency_key: K('m05'), uid: U1, cid: CID, amount_units: '1', ref_type: 'job', ref_id: '1', business_frozen_cap: NINETEEN_9 }, '上界字段'],
    ['M06_sum_overflow', { op: 'entries', idempotency_key: K('m06'), entries: [
      { uid: U1, cid: CID, delta: '9223372036854775807', kind: 'mint' },
      { uid: U2, cid: CID, delta: '1', kind: 'mint' }] }, 'Σdelta 溢出（单条都在界内）'],
    ['M07_platform_maybe', { op: 'mint', idempotency_key: K('m07'), uid: U1, cid: CID, amount_units: '1', platform: 'maybe' }, '::boolean 非法 ⇒ 修前 22P02/500'],
    ['M08_amount_units_nonnum', { ...base, idempotency_key: K('m08'), amount_units: 'abc' }, '形态非法'],
    ['M09_amount_units_decimal', { ...base, idempotency_key: K('m09'), amount_units: '1.5' }, '小数'],
    ['M10_amount_units_negative', { ...base, idempotency_key: K('m10'), amount_units: '-1' }, '负数'],
    ['M11_mint_uid_neg1', { op: 'mint', idempotency_key: K('m11'), uid: '-1', cid: CID, amount_units: '1' }, '平台账户'],
    ['M12_from_uid_neg1', { ...base, idempotency_key: K('m12'), from_uid: '-1' }, '平台账户'],
    ['M13_to_uid_neg1', { ...base, idempotency_key: K('m13'), to_uid: '-1' }, '平台账户'],
    ['M14_cid_zero', { ...base, idempotency_key: K('m14'), cid: '0' }, '非法 cid'],
    ['M15_cid_abc', { ...base, idempotency_key: K('m15'), cid: 'abc' }, '非法 cid'],
    ['M16_cid_json_number', { ...base, idempotency_key: K('m16'), cid: Number(CID) }, '【裁定】JSON number ⇒ 收紧 400'],
    ['M17_ref_type_bogus', { ...base, idempotency_key: K('m17'), ref_type: 'bogus', ref_id: '1' }, '白名单'],
    ['M18_ref_type_no_ref_id', { ...base, idempotency_key: K('m18'), ref_type: 'job' }, '成对性'],
    ['M19_ref_id_no_ref_type', { ...base, idempotency_key: K('m19'), ref_id: '1' }, '成对性'],
    ['M20_memo_object', { ...base, idempotency_key: K('m20'), memo: { a: { b: { c: 1 } } } }, '【裁定】嵌套对象 ⇒ 收紧 400'],
    ['M21_memo_array', { ...base, idempotency_key: K('m21'), memo: [1, 2, 3] }, '【裁定】数组 ⇒ 收紧 400'],
    ['M22_entries_object', { op: 'entries', idempotency_key: K('m22'), entries: { uid: U1 } }, '形状'],
    ['M23_entries_33', { op: 'entries', idempotency_key: K('m23'), entries: Array.from({ length: 33 }, (_, i) => ({ uid: U1, cid: CID, delta: i % 2 ? '1' : '-1', kind: 'transfer' })) }, 'R64 上限'],
    ['M24_entries_17_accounts', { op: 'entries', idempotency_key: K('m24'), entries: Array.from({ length: 17 }, (_, i) => ({ uid: String(942100 + i), cid: CID, delta: i % 2 ? '1' : '-1', kind: 'transfer' })) }, 'R64 账户上限'],
    ['M25_entry_delta_json_number', { op: 'entries', idempotency_key: K('m25'), entries: [
      { uid: U1, cid: CID, delta: -1, kind: 'transfer' }, { uid: U2, cid: CID, delta: 1, kind: 'transfer' }] }, '金额列必须字符串'],
    ['M26_entry_both_zero', { op: 'entries', idempotency_key: K('m26'), entries: [{ uid: U1, cid: CID, delta: '0', frozen_delta: '0', kind: 'transfer' }] }, 'ledger_move_guard 前置'],
    ['M27_settle_kind_bogus', { op: 'settle', kind: 'bogus', idempotency_key: K('m27'), from_uid: U2, to_uid: U1, cid: CID, amount_units: '1', ref_type: 'job', ref_id: '1' }, 'kind 白名单'],
    ['M28_reversal_guard', { op: 'entries', idempotency_key: K('m28'), entries: [{ uid: U1, cid: CID, delta: '-1', kind: 'reversal' }, { uid: U2, cid: CID, delta: '1', kind: 'transfer' }] }, 'R20 冲正守卫'],
    ['M29_op_unknown', { op: 'nope', idempotency_key: K('m29') }, 'op 白名单'],
    ['M30_payload_array', ['not-an-object'], 'payload 形状'],
    ['M31_amount_over_cap', { ...base, idempotency_key: K('m31'), amount: '1000000000000001' }, '【P1i】amount 超 R66/R71 单笔上限 ⇒ 400（修前 amount 被 amount_units 静默忽略）'],
    ['M31b_amount_only_over_cap', { op: 'transfer', idempotency_key: K('m31b'), from_uid: U1, to_uid: U2, cid: CID, amount: '1000000000000001' }, '【P1i 对照】只给 amount ⇒ 400 OVER_MAX_SINGLE_AMOUNT'],
    ['M32_from_uid_spaces', { ...base, idempotency_key: K('m32'), from_uid: ` ${U1} ` }, '【裁定】btrim 后照收 ⇒ **允许**'],
    ['M33_key_missing', { op: 'transfer', from_uid: U1, to_uid: U2, cid: CID, amount_units: '1' }, 'R49'],
    ['M34_key_json_number', { ...base, idempotency_key: 12345 }, '键形状'],
    ['M35_key_empty', { ...base, idempotency_key: '' }, '键形状'],
    ['M36_key_no_prefix', { ...base, idempotency_key: 'noprefix-1' }, 'R49 前缀'],
    ['M37_key_with_hash', { ...base, idempotency_key: `${K('m37')}#2` }, '【F1 修复】派生键分隔符 ⇒ 400'],
    ['M38_key_too_long', { ...base, idempotency_key: `ops:p1f:${'x'.repeat(300)}` }, 'R52 长度'],
    ['M39_amount_units_20_digits', { ...base, idempotency_key: K('m39'), amount_units: `1${NINETEEN_9}` }, '20 位'],
    ['M40_uid_json_number', { ...base, idempotency_key: K('m40'), from_uid: Number(U1) }, '【裁定】JSON number ⇒ 收紧 400'],
    ['M41_entry_uid_json_number', { op: 'entries', idempotency_key: K('m41'), entries: [
      { uid: Number(U1), cid: CID, delta: '-1', kind: 'transfer' }, { uid: U2, cid: CID, delta: '1', kind: 'transfer' }] }, '【裁定】JSON number ⇒ 收紧 400'],
    ['M42_platform_json_number', { op: 'mint', idempotency_key: K('m42'), uid: U1, cid: CID, amount_units: '1', platform: 1 }, '【裁定】JSON number ⇒ 收紧 400'],
    ['M43_amount_exponent', { ...base, idempotency_key: K('m43'), amount: '1e5' }, '【P1i】指数形式字符串 ⇒ 400（修前 amount 被静默忽略）'],
    ['M43b_amount_only_exponent', { op: 'transfer', idempotency_key: K('m43b'), from_uid: U1, to_uid: U2, cid: CID, amount: '1e5' }, '【P1i 对照】只给 amount ⇒ 400 EXPONENT_NOT_ALLOWED'],
    ['M44_currency_op_bogus', { op: 'entries', idempotency_key: K('m44'), currency_op: 'bogus', entries: [
      { uid: U1, cid: CID, delta: '-1', kind: 'transfer' }, { uid: U2, cid: CID, delta: '1', kind: 'transfer' }] }, '状态矩阵'],
    ['M45_hold_no_ref', { op: 'hold', idempotency_key: K('m45'), uid: U1, cid: CID, amount_units: '1' }, 'R37'],
    ['M46_cap_abc', { op: 'hold', idempotency_key: K('m46'), uid: U1, cid: CID, amount_units: '1', ref_type: 'job', ref_id: '1', business_frozen_cap: 'abc' }, '形态'],
    ['M47_self_transfer', { ...base, idempotency_key: K('m47'), to_uid: U1 }, 'R19'],
    ['M48_cid_missing_currency', { ...base, idempotency_key: K('m48'), cid: '9007199254740991' }, '币种不存在'],
    ['M49_entry_cid_mismatch', { op: 'entries', idempotency_key: K('m49'), entries: [
      { uid: U1, cid: CID, delta: '-1', kind: 'transfer' }, { uid: U1, cid: CID, delta: '2', kind: 'transfer' }] }, '配对不变式'],
    ['M50_key_control_char', { ...base, idempotency_key: `ops:p1f:${RUN}:mal:m50\u0001` }, '【F1】控制字符 ⇒ 400'],
  ];

  const callRaw = async (payload: unknown): Promise<{ ok: boolean; e?: unknown; r?: unknown }> => {
    try {
      const rows = await raw<{ r: unknown }>(p, 'SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
      return { ok: true, r: rows?.[0]?.r };
    } catch (e) { return { ok: false, e }; }
  };

  const results: Record<string, unknown> = {};
  let unmappedEscape = 0, status500 = 0, notInClosedSet = 0;
  const rows: string[] = [];
  for (const [id, payload, note] of cases) {
    const res = await callRaw(payload);
    if (res.ok) {
      results[id] = { note, sqlstate: null, ts_code: null, status: null, outcome: 'accepted_200' };
      rows.push(`${id.padEnd(32)} ✓ok       ${note}`);
      continue;
    }
    const e = res.e;
    const mapped = ledgerErrorFromDbError(e) ?? normalizeLedgerError(e);
    const sqlstate = String((e as { code?: unknown })?.code ?? '');
    const inSet = (LEDGER_ERROR_CODES as string[]).includes(mapped.code);
    const isLd = sqlstate.startsWith('LD');
    const is500 = mapped.status === 500;
    if (!isLd) unmappedEscape += 1;
    if (is500) status500 += 1;
    if (!inSet) notInClosedSet += 1;
    results[id] = {
      note, sqlstate, sqlstate_escaped_raw: !isLd, db_message: String((e as { message?: unknown })?.message ?? ''),
      db_detail: String((e as { detail?: unknown })?.detail ?? '') || null,
      ts_code: mapped.code, status: mapped.status, in_closed_set: inSet,
      details: mapped.details ?? null,
    };
    rows.push(`${id.padEnd(32)} ${isLd ? ' ' : '!'}${sqlstate} → ${mapped.code}/${mapped.status}  ${note}`);
  }
  rows.forEach((r) => console.log(r));

  // ---------------------------------------------------------------- 静态闭集自证
  const migDir = path.resolve(__dirname, '..', 'migrations');
  const raised = new Map<string, string[]>();
  for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
    const found = [
      ...sql.matchAll(/ledger_raise\(\s*'([A-Z_]+)'/g),
      ...sql.matchAll(/v_code\s*:=\s*'([A-Z_]+)'/g),
    ].map((m) => m[1]);
    for (const c of found) raised.set(c, [...(raised.get(c) ?? []), f]);
  }
  const unregisteredRaised = [...raised.entries()].filter(([c]) => !(LEDGER_ERROR_CODES as string[]).includes(c));

  // 分类器全定义域抽样（修前函数不存在 ⇒ missing）
  const states = ['22003', '22P02', '22001', '22007', '22P01', '21000', '23505', '23514', '23503', '23502', '23P01',
    '40001', '40P01', '55P03', '57014', '53300', '53200', '53100', '53000', '57P01', '57P02', '57P03', '58030', '08P01',
    '08000', '08006', 'XX000', 'XX001', '25006', '25P03', '3D000', '42P01', '42703', 'P0001', 'P0002', '0A000',
    '40P02', '55006', '22012', '54000'];
  let classifier: Record<string, unknown> | null = null;
  let classifierMissing = false;
  try {
    const rs = await raw<{ s: string; j: Record<string, string> }>(p,
      `SELECT s AS s, ledger_error_for_sqlstate(s, 'account_bal_guard') AS j FROM unnest($1::text[]) AS s`,
      [states]);
    classifier = Object.fromEntries(rs.map((r) => [r.s, r.j]));
  } catch (e) {
    classifierMissing = true;
    classifier = { __error__: String((e as { message?: unknown })?.message ?? e) };
  }
  const clfBad: string[] = [];
  const clfBad500: string[] = [];
  if (!classifierMissing && classifier) {
    for (const [s, v] of Object.entries(classifier)) {
      const j = v as { code?: string; bucket?: string; retryable?: boolean };
      const status = (LEDGER_ERROR_TABLE as Record<string, { status: number }>)[j.code as string]?.status;
      // P1j（纪律修正）：bucket ↔ §14.1 状态类的对应关系按 0005 §C 抬头**冻结**：
      //   input ⇒ 400 类 / integrity ⇒ 400|404|409 / retryable|infra ⇒ 503 / defect ⇒ 500
      //   （原公式把 integrity 一律钉成 400，与 §14.1 冻结的 404/409 冲突 ⇒ 探针自身过严，非产品缺陷）
      const bucketOk = j.bucket === 'input' ? status === 400
        : j.bucket === 'integrity' ? status === 400 || status === 404 || status === 409
        : (j.bucket === 'retryable' || j.bucket === 'infra') ? status === 503
        : j.bucket === 'defect' ? status === 500 : false;
      if (!status || !bucketOk) clfBad.push(`${s}→${j.code}/${j.bucket}/${status}`);
      // 新增判据（可机读封闭性）：「500 类码只可能来自 bucket='defect'」
      if (j.bucket !== 'defect' && status === 500) clfBad500.push(`${s}→${j.code}/${j.bucket}/${status}`);
    }
  }

  const summary = {
    cases_total: cases.length,
    unmapped_escape: unmappedEscape,
    status_500: status500,
    not_in_closed_set: notInClosedSet,
    accepted_200_cases: Object.entries(results).filter(([, v]) => (v as { outcome?: string }).outcome === 'accepted_200').map(([k]) => k),
    unregistered_raised_codes: unregisteredRaised.map(([c, f]) => `${c} (${[...new Set(f)].join(',')})`),
    classifier_missing: classifierMissing,
    classifier_bucket_status_violations: clfBad,
    classifier_500_outside_defect_bucket: clfBad500,
    classifier_sample: classifier,
  };

  const verdicts = {
    no_unmapped_escape: unmappedEscape === 0,
    no_status_500_from_caller_input: status500 === 0,
    everything_in_closed_set: notInClosedSet === 0,
    no_unregistered_raise_codes: unregisteredRaised.length === 0,
    classifier_present: !classifierMissing,
    classifier_bucket_status_consistent: clfBad.length === 0,
    no_500_class_outside_defect_bucket: clfBad500.length === 0,
    cid_json_number_tightened: ((results.M16_cid_json_number as { status?: number }).status ?? 0) === 400,
    memo_object_tightened: ((results.M20_memo_object as { status?: number }).status ?? 0) === 400,
    uid_json_number_tightened: ((results.M40_uid_json_number as { status?: number }).status ?? 0) === 400,
    uid_spaces_allowed: (results.M32_from_uid_spaces as { outcome?: string }).outcome === 'accepted_200',
    hash_key_rejected_400: ((results.M37_key_with_hash as { status?: number }).status ?? 0) === 400,
    control_char_key_rejected_400: ((results.M50_key_control_char as { status?: number }).status ?? 0) === 400,
    platform_maybe_400: ((results.M07_platform_maybe as { status?: number }).status ?? 0) === 400,
    sum_overflow_400: ((results.M06_sum_overflow as { status?: number }).status ?? 0) === 400,
    // --- P1i 新发现 M31 / M43（两个金额字段同时出现时 amount 曾被静默忽略）
    amount_over_cap_rejected_400: ((results.M31_amount_over_cap as { status?: number }).status ?? 0) === 400,
    amount_over_cap_amount_only_400: ((results.M31b_amount_only_over_cap as { status?: number }).status ?? 0) === 400,
    amount_exponent_rejected_400: ((results.M43_amount_exponent as { status?: number }).status ?? 0) === 400,
    amount_exponent_amount_only_400: ((results.M43b_amount_only_exponent as { status?: number }).status ?? 0) === 400,
    // --- 三条「静默接受的类型闸缺口」按裁定收紧（F2④）
    memo_array_tightened: ((results.M21_memo_array as { status?: number }).status ?? 0) === 400,
    entry_uid_json_number_tightened: ((results.M41_entry_uid_json_number as { status?: number }).status ?? 0) === 400,
    platform_json_number_tightened: ((results.M42_platform_json_number as { status?: number }).status ?? 0) === 400,
    // --- 唯一豁免：uid 前后空格（btrim 后照收）
    only_allowed_case_is_uid_spaces: (() => {
      const allowed = summary.accepted_200_cases;
      return allowed.length === 1 && allowed[0] === 'M32_from_uid_spaces';
    })(),
  };
  const failures = Object.entries(verdicts).filter(([, v]) => !v).map(([k]) => k);

  console.log('\n' + JSON.stringify({
    probe: 'P1F-02', run: RUN, symbol: SYM, cid: CID, summary, verdicts, failures,
    pass: failures.length === 0, results,
  }, null, 2));

  await p.end();
  if (assertMode && failures.length) process.exit(1);
  if (assertMode && (unmappedEscape || status500 || notInClosedSet)) process.exit(1);
};
main().catch((e) => { console.error('PROBE FATAL', e); process.exit(2); });
