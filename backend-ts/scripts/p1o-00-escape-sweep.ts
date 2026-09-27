/**
 * P1O-00 · 「逃逸扫描」取证脚本 —— 入口点 × 输入形状（**修前 / 修后同一脚本、同一组用例**）
 * ============================================================================
 * 依据（权威口径）：`docs/ledger.spec.md` §14.3 **v0.6 增补块 (A)**（Zang 裁定 + 规范要求）
 *   ③ **超 `bigint`（`> 9223372036854775807` 或 `< -9223372036854775808`）⇒ `400`
 *      `LEDGER_AMOUNT_INVALID` + `details.reason = OUT_OF_BIGINT_RANGE`**（与写路径同族，
 *      **不新增错误码**）；`cid <= 0` 与负数仍 ⇒ `404`（v0.5 枚举块 ③ 不变）。
 *   ④ b. 矩阵 = **入口点 × 输入形状**，三条**硬判据**：`raw_sqlstate_escapes = 0` /
 *      `unmapped = 0` / `missing_status = 0`。
 *   ④ c. 输出必须 **run-tagged、永不得写固定文件名**（固定名会被后一轮静默覆盖 ⇒ 读数不可回溯）。
 *
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase before|after [--assert]
 * 落盘：`backend-ts/.p1f-artifacts/p1o-00-escape-sweep-<phase>-<RUN>.json`
 *   —— **只新增**：文件名一律带 `<phase>` + run tag，绝不覆盖任何既有读数文件。
 *
 * ---------------------------------------------------------------- 本脚本不做 / 不碰
 *   · 不写账本行：写路径的每一格都被构造成**参数校验失败**或**业务拒绝**
 *     （无余额 / 非 owner / 币种或账户不存在），`ledger_entry` 前后行数自证（`rows_touched`）。
 *   · **绝不触碰 `cid = 1` 与平台账户**（`0` / `-1` / `-2` / `-3` 的**真实**账户）：测试币一律
 *     走 `p1p` 前缀自建单位；`ensurePlatformAccounts` 的「形状合法」格**明确跳过**（见 A2 组）。
 *   · 不改任何产品代码 / 迁移 / 质检资产（本脚本只读 + 调公开 API）。
 *   · 测试数据分区：uid **948xxx** / symbol 前缀 **`p1p`** / 幂等键前缀 **`ops:p1p:*`**。
 *
 * ---------------------------------------------------------------- 入口点清单（事一.1 的「表」，本脚本按此矩阵逐格跑）
 *  TS 侧**接收外部 `cid` / `uid` / 金额**的导出入口点（`backend-ts/src/ledger.ts`）：
 *
 *  【读路径】
 *   E-R1 `getCurrency(cid, tx?)`                闸：`toCid → toAmount`（碰 PG 前）
 *   E-R2 `getAccount(uid, cid, tx?)`            闸：`toUid` + `toCid`
 *   E-R3 `listEntriesByAccount(uid, cid, beforeTxid, limit, tx?)`
 *                                               闸：`toUid` + `toCid` + `toAmount(beforeTxid)`（`limit` 另见 X 组）
 *   E-R4 `getCurrencyBySymbol(symbol, tx?)`     **对照组**：入参是**文本**列谓词，无数字转型 ⇒ 无 22003 面
 *   E-R5 `findEntriesByIdempotencyKey(key, tx?)` 闸：`normalizeIdempotencyKey`（键族，非 cid/uid/金额）
 *   E-R6 `findAccountDrift()` / `sumAccountTotals()` / `getSystemCurrency()`：**无外部入参**（不扫描，登记为对照）
 *  【写路径】（全部经 `postEvent` → 一条 `SELECT ledger_post_event($1::jsonb)`）
 *   E-W1 `transfer(input)`        `fromUid` / `toUid` / `cid` / `amount`
 *   E-W2 `mint(input)`            `uid` / `cid` / `amount`
 *   E-W3 `freeze(input)`          `uid` / `cid` / `amount`（+ `businessFrozenCap`）
 *   E-W4 `unfreeze(input)`        `uid` / `cid` / `amount`
 *   E-W5 `settleFrozen(input)`    `fromUid` / `toUid` / `cid` / `amount`
 *   E-W6 `postEvent(payload)`     `fromUid` / `toUid` / `cid` / `amount`（其余导出动作的公共底层）
 *   E-W7 `getOrCreateAccount(uid, cid, tx?)`    账户自建（会写 `account` 0/0 行；不写账本行）
 *   E-W8 `ensurePlatformAccounts(cid, tx?)`     **只扫形状非法格**（形状合法格会建平台账户 ⇒ 按纪律跳过）
 *   E-W9 `lockAccounts(tx, targets)`            **只扫形状非法格**（R79 唯一加锁入口；合法格会开户）
 *   E-W10 `parseUserAmount(v, decimals, field, cid?)`（用户输入金额原语，导出）
 *   E-W11 `assertUserUid(uid, field?)` / `toAmount(v, field)`（形状闸原语，导出）
 *
 *  每条形状闸都会在**任何 PG 往返之前**执行（`toAmount` 是唯一共用实现 ⇒ 按类收敛）。
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, ensureCurrency, entryCount } from './p1f-lib';
import { withTransaction } from '../src/db';
import {
  getCurrency, getCurrencyBySymbol, getAccount, getOrCreateAccount, ensurePlatformAccounts,
  listEntriesByAccount, findEntriesByIdempotencyKey,
  transfer, mint, freeze, unfreeze, settleFrozen, postEvent,
  toAmount, assertUserUid, parseUserAmount, lockAccounts, closeLedgerWritePool,
  LEDGER_SQLSTATE_TO_CODE,
} from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import type { Amount } from '../src/ledger';

// ============================================================================
// 0. 运行参数 / 测试数据分区
// ============================================================================

const phaseArg = ((): string => {
  const i = process.argv.indexOf('--phase');
  const v = i >= 0 ? process.argv[i + 1] : '';
  return v === 'before' || v === 'after' ? v : 'unspecified';
})();
const assertMode = process.argv.includes('--assert');

const RUN = Date.now().toString(36).toUpperCase();
const SYM = `P1P${RUN}`.slice(0, 12);
const K = (s: string): string => `ops:p1p:${RUN}:${s}`;

/** uid 分区 948xxx（本组专用） */
const U1 = '948001';
const U2 = '948002';

/** bigint 边界（与 DB `ledger_int_amount` 的 numeric 查界同值） */
const BIGINT_MAX = '9223372036854775807';
const BIGINT_MIN = '-9223372036854775808';
const OVER_BIGINT_FAR = '99999999999999999999999';      // 23 位：远超 bigint
const BIGINT_MAX_PLUS_1 = '9223372036854775808';        // 刚好越界（19 位）
const BIGINT_TYPE_OVER = BigInt('9'.repeat(25));        // JS bigint 本身无界 ⇒ 必须同闸

// ============================================================================
// 1. 输入形状（11 种必测形状 + 边界补强）
// ============================================================================

type ShapeKind = 'valid' | 'invalid' | 'absent' | 'boundary' | 'control';
interface Shape { name: string; value: unknown; kind: ShapeKind }

/** cid / uid / before_txid 等**标识符/整数**字段的形状集 */
const ID_SHAPES = (valid: unknown): Shape[] => ([
  { name: 'valid', value: valid, kind: 'valid' },
  { name: 'not_decimal_integer', value: 'abc', kind: 'invalid' },
  { name: 'empty_string', value: '', kind: 'invalid' },
  { name: 'non_string_object', value: { n: 1 }, kind: 'invalid' },
  { name: 'non_string_boolean', value: true, kind: 'invalid' },
  { name: 'undefined', value: undefined, kind: 'absent' },
  { name: 'zero', value: '0', kind: 'boundary' },
  { name: 'negative', value: '-5', kind: 'boundary' },
  { name: 'bigint_min', value: BIGINT_MIN, kind: 'boundary' },
  { name: 'bigint_max', value: BIGINT_MAX, kind: 'boundary' },
  { name: 'bigint_max_plus_1', value: BIGINT_MAX_PLUS_1, kind: 'invalid' },
  { name: 'over_bigint_far', value: OVER_BIGINT_FAR, kind: 'invalid' },
  { name: 'bigint_type_over', value: BIGINT_TYPE_OVER, kind: 'invalid' },
  { name: 'scientific_1e5', value: '1e5', kind: 'invalid' },
  { name: 'padded_spaces', value: ` ${String(valid)} `, kind: 'valid' },
  { name: 'number_zero', value: 0, kind: 'boundary' },
  { name: 'number_unsafe', value: 1e23, kind: 'invalid' },
]);

/** 金额字段的形状集（R72④ 单笔上限 1e15 远低于 bigint ⇒ 超界形状必在「换算前/换算中」被拦） */
const AMOUNT_SHAPES = (): Shape[] => ([
  { name: 'valid', value: '1', kind: 'valid' },
  { name: 'not_decimal_integer', value: 'abc', kind: 'invalid' },
  { name: 'empty_string', value: '', kind: 'invalid' },
  { name: 'non_string_object', value: { n: 1 }, kind: 'invalid' },
  { name: 'non_string_boolean', value: true, kind: 'invalid' },
  { name: 'undefined', value: undefined, kind: 'absent' },
  { name: 'zero', value: '0', kind: 'boundary' },
  { name: 'negative', value: '-1', kind: 'boundary' },
  { name: 'bigint_max', value: BIGINT_MAX, kind: 'boundary' },
  { name: 'bigint_max_plus_1', value: BIGINT_MAX_PLUS_1, kind: 'invalid' },
  { name: 'over_bigint_far', value: OVER_BIGINT_FAR, kind: 'invalid' },
  { name: 'bigint_type_over', value: BIGINT_TYPE_OVER, kind: 'invalid' },
  { name: 'scientific_1e5', value: '1e5', kind: 'invalid' },
  { name: 'padded_spaces', value: ' 1 ', kind: 'valid' },
  { name: 'number_unsafe', value: 1e23, kind: 'invalid' },
]);

/** 文本字段（symbol）的形状集：**对照组** —— 无数字转型，不属 22003 面 */
const TEXT_SHAPES = (valid: string): Shape[] => ([
  { name: 'valid', value: valid, kind: 'valid' },
  { name: 'not_decimal_integer', value: 'abc', kind: 'control' },
  { name: 'empty_string', value: '', kind: 'control' },
  { name: 'non_string_object', value: { n: 1 }, kind: 'control' },
  { name: 'non_string_boolean', value: true, kind: 'control' },
  { name: 'undefined', value: undefined, kind: 'control' },
  { name: 'five9s', value: '99999', kind: 'control' },
  { name: 'over_bigint_far', value: OVER_BIGINT_FAR, kind: 'control' },
  { name: 'scientific_1e5', value: '1e5', kind: 'control' },
  { name: 'padded_spaces', value: ` ${valid} `, kind: 'control' },
]);

/** 幂等键形状集（E-R5 专用；键族有独立闸） */
const KEY_SHAPES = (): Shape[] => ([
  { name: 'valid', value: 'ops:p1p:<run>:probe', kind: 'valid' },
  { name: 'empty_string', value: '', kind: 'invalid' },
  { name: 'undefined', value: undefined, kind: 'absent' },
  { name: 'non_string_number', value: 12345, kind: 'invalid' },
  { name: 'no_prefix', value: 'noprefix-1', kind: 'invalid' },
  { name: 'reserved_separator', value: 'ops:p1p:<run>:probe#2', kind: 'invalid' },
  { name: 'control_char', value: 'ops:p1p:<run>:probe\u0001', kind: 'invalid' },
]);

// ============================================================================
// 2. 逐格读数 + 分类（三条硬判据的原始出处）
// ============================================================================

type FieldKind = 'cid' | 'uid' | 'amount' | 'before_txid' | 'key' | 'symbol' | 'limit';

interface CellResult {
  entry: string;
  path: 'read' | 'write' | 'primitive';
  field: FieldKind;
  input_shape: string;
  input_value: unknown;
  input_type: string;
  thrown: boolean;
  outcome: 'no_throw' | 'thrown';
  code: string | null;
  status: number | null;
  mapped: boolean;
  in_closed_set: boolean;
  raw_sqlstate: boolean;
  ld_sqlstate_leaked: boolean;
  reason: string | null;
  details_field: string | null;
  details: unknown;
  message: string | null;
  returned: string | null;
  expected: string;
  verdict: 'ok' | 'mismatch' | 'observed';
  elapsed_ms: number;
}

const results: CellResult[] = [];

const closedSet = new Set<string>(LEDGER_ERROR_CODES as string[]);

const safeInput = (v: unknown): unknown => {
  if (v === undefined) return '<undefined>';
  if (typeof v === 'bigint') return `${v.toString().slice(0, 40)}n`;
  if (v === null) return null;
  if (typeof v === 'object') return `[object ${JSON.stringify(v).slice(0, 40)}]`;
  return v as string | number | boolean;
};

/** 单格期望（用于「这一类被关死」的可机读判定，见 verdict） */
interface Expect { mode: 'must_400' | 'must_no_shape_reject' | 'must_not_escape' | 'control'; code?: string; reasons?: string[]; note: string }

const SHAPE_INVALID_NAMES = new Set([
  'not_decimal_integer', 'empty_string', 'non_string_object', 'non_string_boolean', 'undefined',
  'scientific_1e5', 'bigint_max_plus_1', 'over_bigint_far', 'bigint_type_over', 'number_unsafe',
]);

const expectationOf = (entry: string, field: FieldKind, sh: Shape): Expect => {
  if (sh.kind === 'control' || field === 'symbol') {
    return { mode: 'control', note: '对照组：文本列谓词 / 无数字转型 ⇒ 不属 22003 逃逸面' };
  }
  if (field === 'key') {
    return sh.kind === 'valid'
      ? { mode: 'must_not_escape', note: '键族：合法键 ⇒ 不许原样逃出' }
      : { mode: 'must_400', code: 'LEDGER_IDEMPOTENCY_KEY*', note: '键族非法 ⇒ 400 键类码（KEY_REQUIRED / KEY_INVALID）' };
  }
  if (field === 'limit') {
    return { mode: 'must_not_escape', note: 'limit（非 cid/uid/金额；附带组）⇒ 不许原样逃出' };
  }
  if (field === 'before_txid' && sh.name === 'undefined') {
    // JS 默认参数语义：`beforeTxid = null` ⇒ 传 undefined 即「取默认值」，不是形状非法
    return { mode: 'must_not_escape', note: 'beforeTxid 传 undefined = 取默认值 null（分页首屏）' };
  }
  if (sh.name === 'over_bigint_far' || sh.name === 'bigint_max_plus_1' || sh.name === 'bigint_type_over') {
    // 超 bigint ⇒ 400 LEDGER_AMOUNT_INVALID；标识符字段由 TS 闸判 ⇒ reason 必为 OUT_OF_BIGINT_RANGE；
    // 金额字符串由 DB 按 decimals 换算决定 ⇒ 允许 OVER_MAX_SINGLE_AMOUNT（同码同 status，reason 名有残差）
    return field === 'amount'
      ? { mode: 'must_400', code: 'LEDGER_AMOUNT_INVALID', reasons: ['OUT_OF_BIGINT_RANGE', 'OVER_MAX_SINGLE_AMOUNT'], note: '超 bigint（金额：换算闸；DB 侧 19 位以上先归 OVER_MAX_SINGLE_AMOUNT）' }
      : { mode: 'must_400', code: 'LEDGER_AMOUNT_INVALID', reasons: ['OUT_OF_BIGINT_RANGE'], note: '超 bigint（标识符：TS 形状闸 ⇒ OUT_OF_BIGINT_RANGE）' };
  }
  if (SHAPE_INVALID_NAMES.has(sh.name)) {
    return field === 'amount'
      ? { mode: 'must_400', code: 'LEDGER_AMOUNT_INVALID', note: '形状非法（金额）⇒ 400 LEDGER_AMOUNT_INVALID' }
      : { mode: 'must_400', code: 'LEDGER_AMOUNT_INVALID', reasons: ['NOT_DECIMAL_INTEGER', 'NOT_STRING', 'MISSING', 'NOT_INTEGER_OR_UNSAFE'], note: '形状非法（标识符）⇒ 400 LEDGER_AMOUNT_INVALID + reason 四值集' };
  }
  if (sh.name === 'zero' || sh.name === 'negative' || sh.name === 'number_zero') {
    return { mode: 'must_not_escape', note: field === 'cid' ? 'cid <= 0 / 负数 ⇒ 404（或纯读不抛）' : '边界值 ⇒ 只要求不逃逸' };
  }
  return { mode: 'must_no_shape_reject', note: '形状合法（含前后空格）⇒ **不得**被判为形状非法（防过度拒绝）' };
};

const cell = async (
  entry: string, pathKind: 'read' | 'write' | 'primitive', field: FieldKind, sh: Shape, fn: () => Promise<unknown>,
): Promise<void> => {
  const t0 = Date.now();
  let thrown = false;
  let err: unknown = null;
  let ret: unknown = undefined;
  try {
    ret = await fn();
  } catch (e) {
    thrown = true;
    err = e;
  }
  const a = (err ?? {}) as Record<string, unknown>;
  const code = thrown ? String(a.code ?? '') : null;
  const status = thrown && typeof a.status === 'number' ? (a.status as number) : null;
  const inClosedSet = thrown && code !== null && closedSet.has(code);
  const ldLeaked = thrown && code !== null && Object.prototype.hasOwnProperty.call(LEDGER_SQLSTATE_TO_CODE, code);
  const rawSqlstate = thrown && code !== null && !inClosedSet && !ldLeaked && /^[0-9A-Z]{5}$/.test(code);
  const details = thrown && a.details && typeof a.details === 'object' ? (a.details as Record<string, unknown>) : null;
  const reason = details && typeof details.reason === 'string' ? details.reason : null;
  const detailsField = details && typeof details.field === 'string' ? details.field : null;

  const exp = expectationOf(entry, field, sh);
  let verdict: CellResult['verdict'] = 'observed';
  if (exp.mode === 'must_400') {
    const codeOk = thrown && exp.code !== undefined
      ? (exp.code.endsWith('*') ? String(code).startsWith(exp.code.slice(0, -1)) : code === exp.code)
      : true;
    const statusOk = thrown && status === 400;
    const reasonOk = !exp.reasons || (reason !== null && exp.reasons.includes(reason));
    verdict = codeOk && statusOk && reasonOk ? 'ok' : 'mismatch';
  } else if (exp.mode === 'must_no_shape_reject') {
    const shapeRejectReasons = ['NOT_DECIMAL_INTEGER', 'NOT_STRING', 'MISSING', 'OUT_OF_BIGINT_RANGE'];
    const overReject = thrown && code === 'LEDGER_AMOUNT_INVALID' && status === 400
      && (reason === null || shapeRejectReasons.includes(reason));
    verdict = overReject ? 'mismatch' : 'ok';
  } else if (exp.mode === 'must_not_escape') {
    verdict = thrown && (!inClosedSet || status === null) ? 'mismatch' : 'ok';
  } else {
    verdict = rawSqlstate || !inClosedSet && thrown ? 'mismatch' : 'ok';
  }

  let returned: string | null = null;
  if (!thrown) {
    const r = ret as Record<string, unknown> | unknown[] | null;
    if (Array.isArray(r)) returned = `array(${r.length})`;
    else if (r === null || r === undefined) returned = String(r);
    else if (typeof r === 'object') returned = `object(${Object.keys(r as Record<string, unknown>).slice(0, 4).join(',')})`;
    else returned = String(r).slice(0, 40);
  }

  results.push({
    entry, path: pathKind, field, input_shape: sh.name, input_value: safeInput(sh.value),
    input_type: sh.value === undefined ? 'undefined' : typeof sh.value,
    thrown, outcome: thrown ? 'thrown' : 'no_throw',
    code, status, mapped: inClosedSet, in_closed_set: inClosedSet, raw_sqlstate: rawSqlstate,
    ld_sqlstate_leaked: ldLeaked,
    reason, details_field: detailsField, details,
    message: thrown ? String(a.message ?? '').slice(0, 200) : null,
    returned, expected: `${exp.mode}${exp.code ? '/' + exp.code : ''}${exp.reasons ? '/' + exp.reasons.join('|') : ''}`,
    verdict, elapsed_ms: Date.now() - t0,
  });
};

// ============================================================================
// 3. 主流程
// ============================================================================

const main = async (): Promise<void> => {
  const admin = mkPool(3);
  const out: Record<string, unknown> = {
    probe: 'P1O-00 · 逃逸扫描（入口点 × 输入形状）', phase: phaseArg, run: RUN,
    started_at: new Date().toISOString(), symbol: SYM,
    note: '修前 / 修后同一脚本、同一组用例；硬判据 raw_sqlstate_escapes=0 / unmapped=0 / missing_status=0',
    spec_ref: 'docs/ledger.spec.md §14.3 v0.6 增补块 (A) ③④（口径）/ §19.10.D（reason 名对齐）',
    entrypoints: [
      { id: 'E-R1', fn: 'getCurrency(cid, tx?)', path: 'read', fields: ['cid'], gate: 'toCid→toAmount（碰 PG 前）' },
      { id: 'E-R2', fn: 'getAccount(uid, cid, tx?)', path: 'read', fields: ['uid', 'cid'], gate: 'toUid+toCid' },
      { id: 'E-R3', fn: 'listEntriesByAccount(uid, cid, beforeTxid, limit, tx?)', path: 'read', fields: ['uid', 'cid', 'before_txid'], gate: 'toUid+toCid+toAmount(before_txid)', note: 'limit 属附带组（X 组）' },
      { id: 'E-R4', fn: 'getCurrencyBySymbol(symbol, tx?)', path: 'read', fields: ['symbol'], gate: '无（文本列谓词，对照组）' },
      { id: 'E-R5', fn: 'findEntriesByIdempotencyKey(key, tx?)', path: 'read', fields: ['key'], gate: 'normalizeIdempotencyKey' },
      { id: 'E-R6', fn: 'findAccountDrift() / sumAccountTotals() / getSystemCurrency()', path: 'read', fields: [], gate: '无外部入参（登记为对照，不扫描）' },
      { id: 'E-W1', fn: 'transfer({fromUid,toUid,cid,amount,idempotencyKey})', path: 'write', fields: ['cid', 'uid', 'amount'], gate: 'assertUserUid+toCid+toAmount→postEvent' },
      { id: 'E-W2', fn: 'mint({uid,cid,amount,idempotencyKey,platform})', path: 'write', fields: ['cid', 'uid', 'amount'], gate: 'toUid+toCid+toAmount→postEvent' },
      { id: 'E-W3', fn: 'freeze({uid,cid,amount,refType,refId,idempotencyKey})', path: 'write', fields: ['cid', 'uid', 'amount'], gate: 'assertUserUid+toCid+toAmount→postEvent' },
      { id: 'E-W4', fn: 'unfreeze({uid,cid,amount,refType,refId,idempotencyKey})', path: 'write', fields: ['cid', 'uid', 'amount'], gate: '同 freeze' },
      { id: 'E-W5', fn: 'settleFrozen({fromUid,toUid,cid,amount,kind,idempotencyKey})', path: 'write', fields: ['cid', 'uid', 'amount'], gate: 'toCid+assertUserUid+toAmount' },
      { id: 'E-W6', fn: 'postEvent(payload)', path: 'write', fields: ['cid', 'uid', 'amount'], gate: 'normalizeIdempotencyKey+toUid+toCid+toAmount（写路径公共底层）' },
      { id: 'E-W7', fn: 'getOrCreateAccount(uid, cid, tx?)', path: 'write', fields: ['cid', 'uid'], gate: 'toUid+toCid（合法格会建 account 0/0 行，不写账本行）' },
      { id: 'E-W8', fn: 'ensurePlatformAccounts(cid, tx?)', path: 'write', fields: ['cid'], gate: 'toCid', note: '**只扫形状非法格**：形状合法格会为平台 uid 建账户 ⇒ 按数据纪律跳过' },
      { id: 'E-W9', fn: 'lockAccounts(tx, targets)', path: 'write', fields: ['cid'], gate: 'toUid+toCid', note: '**只扫形状非法格**（合法格会开户）' },
      { id: 'E-W10', fn: 'parseUserAmount(v, decimals, field, cid?)', path: 'primitive', fields: ['amount'], gate: '自身（R72）' },
      { id: 'E-W11', fn: 'assertUserUid(uid, field?) / toAmount(v, field)', path: 'primitive', fields: ['uid', 'cid'], gate: '自身（唯一共用形状闸）' },
    ],
  };

  const env: Record<string, unknown> = {
    head_note: 'HEAD / schema 读数由报告承载；本脚本只取 schema_migration 行以自证环境',
    schema_migration: await raw(admin, 'SELECT version, name FROM schema_migration ORDER BY version'),
    ledger_entry_rows_before: await entryCount(admin),
  };

  // ---------------------------------------------------------------- 测试币（p1p 前缀；绝不触碰 cid=1）
  const CID = await ensureCurrency(admin, SYM, 948001n, 2, 'listed', '100000000000');
  env.test_currency = { symbol: SYM, cid: CID, owner_uid: U1, decimals: 2, status: 'listed' };

  // ============================================================ G 组：形状闸原语（无 PG 往返）
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W11_toAmount', 'primitive', 'cid', sh, async () => toAmount(sh.value as Amount, 'cid'));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-W11_toAmount', 'primitive', 'uid', sh, async () => toAmount(sh.value as Amount, 'uid'));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-W11_assertUserUid', 'primitive', 'uid', sh, async () => assertUserUid(sh.value as Amount));
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W10_parseUserAmount', 'primitive', 'amount', sh, async () => parseUserAmount(sh.value as Amount, 2, 'amount', CID));
  }

  // ============================================================ R 组：读路径
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-R1_getCurrency', 'read', 'cid', sh, async () => getCurrency(sh.value as Amount));
  }
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-R2_getAccount', 'read', 'cid', sh, async () => getAccount(U1, sh.value as Amount));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-R2_getAccount', 'read', 'uid', sh, async () => getAccount(sh.value as Amount, CID));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-R3_listEntries', 'read', 'uid', sh, async () => listEntriesByAccount(sh.value as Amount, CID, null, 5));
  }
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-R3_listEntries', 'read', 'cid', sh, async () => listEntriesByAccount(U1, sh.value as Amount, null, 5));
  }
  for (const sh of ID_SHAPES(1)) {
    await cell('E-R3_listEntries', 'read', 'before_txid', sh, async () => listEntriesByAccount(U1, CID, sh.value as Amount, 5));
  }
  for (const sh of TEXT_SHAPES(SYM)) {
    await cell('E-R4_getCurrencyBySymbol', 'read', 'symbol', sh, async () => getCurrencyBySymbol(sh.value as string));
  }
  for (const sh of KEY_SHAPES()) {
    const v = typeof sh.value === 'string' ? sh.value.replace('<run>', RUN) : sh.value;
    await cell('E-R5_findEntriesByIdempotencyKey', 'read', 'key', sh, async () => findEntriesByIdempotencyKey(v as string));
  }

  // ============================================================ W 组：写路径（每格都构造为「不落账本行」）
  // E-W1 transfer：fromUid 无余额 ⇒ 业务拒绝（409），不写行
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W1_transfer', 'write', 'cid', sh, async () => transfer({
      fromUid: U1, toUid: U2, cid: sh.value as Amount, amount: '1', idempotencyKey: K(`w1:cid:${sh.name}`),
    }));
  }
  for (const [f, args] of [['uid', 'fromUid'], ['uid', 'toUid']] as Array<[FieldKind, 'fromUid' | 'toUid']>) {
    for (const sh of ID_SHAPES(f === 'uid' && args === 'toUid' ? U2 : U1)) {
      await cell('E-W1_transfer', 'write', f, sh, async () => transfer({
        fromUid: args === 'fromUid' ? (sh.value as Amount) : U1,
        toUid: args === 'toUid' ? (sh.value as Amount) : U2,
        cid: CID, amount: '1', idempotencyKey: K(`w1:${args}:${sh.name}`),
      }));
    }
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W1_transfer', 'write', 'amount', sh, async () => transfer({
      fromUid: U1, toUid: U2, cid: CID, amount: sh.value as Amount, idempotencyKey: K(`w1:amt:${sh.name}`),
    }));
  }

  // E-W2 mint：uid 取 U2（**非 owner**）⇒ 403 业务拒绝，不写行
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W2_mint', 'write', 'cid', sh, async () => mint({
      uid: U2, cid: sh.value as Amount, amount: '1', idempotencyKey: K(`w2:cid:${sh.name}`),
    }));
  }
  for (const sh of ID_SHAPES(U2)) {
    await cell('E-W2_mint', 'write', 'uid', sh, async () => mint({
      uid: sh.value as Amount, cid: CID, amount: '1', idempotencyKey: K(`w2:uid:${sh.name}`),
    }));
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W2_mint', 'write', 'amount', sh, async () => mint({
      uid: U2, cid: CID, amount: sh.value as Amount, idempotencyKey: K(`w2:amt:${sh.name}`),
    }));
  }

  // E-W3 freeze / E-W4 unfreeze：无余额/无冻结 ⇒ 409 业务拒绝，不写行
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W3_freeze', 'write', 'cid', sh, async () => freeze({
      uid: U1, cid: sh.value as Amount, amount: '1', refType: 'job', refId: '1', idempotencyKey: K(`w3:cid:${sh.name}`),
    }));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-W3_freeze', 'write', 'uid', sh, async () => freeze({
      uid: sh.value as Amount, cid: CID, amount: '1', refType: 'job', refId: '1', idempotencyKey: K(`w3:uid:${sh.name}`),
    }));
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W3_freeze', 'write', 'amount', sh, async () => freeze({
      uid: U1, cid: CID, amount: sh.value as Amount, refType: 'job', refId: '1', idempotencyKey: K(`w3:amt:${sh.name}`),
    }));
  }
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W4_unfreeze', 'write', 'cid', sh, async () => unfreeze({
      uid: U1, cid: sh.value as Amount, amount: '1', refType: 'job', refId: '1', idempotencyKey: K(`w4:cid:${sh.name}`),
    }));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-W4_unfreeze', 'write', 'uid', sh, async () => unfreeze({
      uid: sh.value as Amount, cid: CID, amount: '1', refType: 'job', refId: '1', idempotencyKey: K(`w4:uid:${sh.name}`),
    }));
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W4_unfreeze', 'write', 'amount', sh, async () => unfreeze({
      uid: U1, cid: CID, amount: sh.value as Amount, refType: 'job', refId: '1', idempotencyKey: K(`w4:amt:${sh.name}`),
    }));
  }

  // E-W5 settleFrozen：无冻结 ⇒ 409 业务拒绝，不写行
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W5_settleFrozen', 'write', 'cid', sh, async () => settleFrozen({
      fromUid: U1, toUid: U2, cid: sh.value as Amount, amount: '1', kind: 'job_payout',
      refType: 'job', refId: '1', idempotencyKey: K(`w5:cid:${sh.name}`),
    }));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-W5_settleFrozen', 'write', 'uid', sh, async () => settleFrozen({
      fromUid: sh.value as Amount, toUid: U2, cid: CID, amount: '1', kind: 'job_payout',
      refType: 'job', refId: '1', idempotencyKey: K(`w5:from:${sh.name}`),
    }));
  }
  for (const sh of ID_SHAPES(U2)) {
    await cell('E-W5_settleFrozen', 'write', 'uid', sh, async () => settleFrozen({
      fromUid: U1, toUid: sh.value as Amount, cid: CID, amount: '1', kind: 'job_payout',
      refType: 'job', refId: '1', idempotencyKey: K(`w5:to:${sh.name}`),
    }));
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W5_settleFrozen', 'write', 'amount', sh, async () => settleFrozen({
      fromUid: U1, toUid: U2, cid: CID, amount: sh.value as Amount, kind: 'job_payout',
      refType: 'job', refId: '1', idempotencyKey: K(`w5:amt:${sh.name}`),
    }));
  }

  // E-W6 postEvent（写路径公共底层，op=transfer）
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W6_postEvent', 'write', 'cid', sh, async () => postEvent({
      op: 'transfer', fromUid: U1, toUid: U2, cid: sh.value as Amount, amount: '1', idempotencyKey: K(`w6:cid:${sh.name}`),
    }));
  }
  for (const [f, args] of [['uid', 'fromUid'], ['uid', 'toUid']] as Array<[FieldKind, 'fromUid' | 'toUid']>) {
    for (const sh of ID_SHAPES(args === 'toUid' ? U2 : U1)) {
      await cell('E-W6_postEvent', 'write', f, sh, async () => postEvent({
        op: 'transfer',
        fromUid: args === 'fromUid' ? (sh.value as Amount) : U1,
        toUid: args === 'toUid' ? (sh.value as Amount) : U2,
        cid: CID, amount: '1', idempotencyKey: K(`w6:${args}:${sh.name}`),
      }));
    }
  }
  for (const sh of AMOUNT_SHAPES()) {
    await cell('E-W6_postEvent', 'write', 'amount', sh, async () => postEvent({
      op: 'transfer', fromUid: U1, toUid: U2, cid: CID, amount: sh.value as Amount, idempotencyKey: K(`w6:amt:${sh.name}`),
    }));
  }

  // E-W7 getOrCreateAccount（会建 account 0/0 行；不写账本行）
  for (const sh of ID_SHAPES(CID)) {
    await cell('E-W7_getOrCreateAccount', 'write', 'cid', sh, async () => getOrCreateAccount(U1, sh.value as Amount));
  }
  for (const sh of ID_SHAPES(U1)) {
    await cell('E-W7_getOrCreateAccount', 'write', 'uid', sh, async () => getOrCreateAccount(sh.value as Amount, CID));
  }

  // E-W8 ensurePlatformAccounts：**只扫形状非法格**（形状合法格会为平台 uid 建账户 ⇒ 数据纪律跳过）
  const platformSkip: Shape[] = [];
  for (const sh of ID_SHAPES(CID)) {
    if (sh.kind === 'valid' || sh.kind === 'boundary') {
      platformSkip.push(sh);
      results.push({
        entry: 'E-W8_ensurePlatformAccounts', path: 'write', field: 'cid', input_shape: sh.name,
        input_value: safeInput(sh.value), input_type: typeof sh.value, thrown: false, outcome: 'no_throw',
        code: null, status: null, mapped: false, in_closed_set: false, raw_sqlstate: false, ld_sqlstate_leaked: false,
        reason: null, details_field: null, details: null, message: null, returned: 'SKIPPED',
        expected: 'skipped_by_data_discipline', verdict: 'observed', elapsed_ms: 0,
      });
      continue;
    }
    await cell('E-W8_ensurePlatformAccounts', 'write', 'cid', sh, async () => ensurePlatformAccounts(sh.value as Amount));
  }

  // E-W9 lockAccounts：**只扫形状非法格**（合法格会开户；闸在碰 PG 前）
  for (const sh of ID_SHAPES(CID)) {
    if (sh.kind === 'valid' || sh.kind === 'boundary') {
      results.push({
        entry: 'E-W9_lockAccounts', path: 'write', field: 'cid', input_shape: sh.name,
        input_value: safeInput(sh.value), input_type: typeof sh.value, thrown: false, outcome: 'no_throw',
        code: null, status: null, mapped: false, in_closed_set: false, raw_sqlstate: false, ld_sqlstate_leaked: false,
        reason: null, details_field: null, details: null, message: null, returned: 'SKIPPED',
        expected: 'skipped_by_data_discipline', verdict: 'observed', elapsed_ms: 0,
      });
      continue;
    }
    await cell('E-W9_lockAccounts', 'write', 'cid', sh, async () => withTransaction(async (tx) =>
      lockAccounts(tx, [{ uid: U1, cid: sh.value as Amount }])));
  }

  // ============================================================ X 组：附带（非 cid/uid/金额，但同为「调用方可构造的入参」）
  for (const sh of [
    { name: 'nan', value: Number.NaN, kind: 'invalid' as ShapeKind },
    { name: 'negative', value: -1, kind: 'invalid' as ShapeKind },
    { name: 'zero', value: 0, kind: 'boundary' as ShapeKind },
    { name: 'huge', value: 1e9, kind: 'boundary' as ShapeKind },
    { name: 'string_abc', value: 'abc', kind: 'invalid' as ShapeKind },
    { name: 'undefined', value: undefined, kind: 'absent' as ShapeKind },
  ]) {
    await cell('E-R3_limit', 'read', 'limit', sh, async () =>
      listEntriesByAccount(U1, CID, null, sh.value as number));
  }

  // ============================================================ DB 侧对拍（形状闸原语的两侧读数）
  const dbProbe = async (label: string, sql: string, params: unknown[]): Promise<Record<string, unknown>> => {
    try {
      const rows = await raw(admin, sql, params as never[]);
      return { label, sql, ok: true, rows };
    } catch (e) {
      const a = e as Record<string, unknown>;
      return {
        label, sql, ok: false, sqlstate: String(a.code ?? ''), message: String(a.message ?? '').slice(0, 160),
        detail: typeof a.detail === 'string' ? a.detail : null,
      };
    }
  };
  const dbSide = {
    note: 'DB 侧同口径（`ledger_int_amount` / `ledger_cid_arg`）：形状非法 ⇒ LD016/400；cid<=0 ⇒ LD007/404',
    int_amount_bigint_max: await dbProbe('ledger_int_amount(BIGINT_MAX)', 'SELECT ledger_int_amount($1,\'cid\') AS c', [BIGINT_MAX]),
    int_amount_bigint_max_plus_1: await dbProbe('ledger_int_amount(BIGINT_MAX+1)', 'SELECT ledger_int_amount($1,\'cid\') AS c', [BIGINT_MAX_PLUS_1]),
    int_amount_over_bigint_far: await dbProbe('ledger_int_amount(23 位)', 'SELECT ledger_int_amount($1,\'cid\') AS c', [OVER_BIGINT_FAR]),
    cid_arg_over_bigint_far: await dbProbe('ledger_cid_arg(23 位)', 'SELECT ledger_cid_arg($1) AS c', [OVER_BIGINT_FAR]),
    cid_arg_zero: await dbProbe("ledger_cid_arg('0')", 'SELECT ledger_cid_arg($1) AS c', ['0']),
    cid_arg_abc: await dbProbe("ledger_cid_arg('abc')", 'SELECT ledger_cid_arg($1) AS c', ['abc']),
  };

  // ============================================================ 汇总 / 判据
  const thrown = results.filter((r) => r.thrown);
  const rawEscapes = results.filter((r) => r.raw_sqlstate);
  const ldLeaked = results.filter((r) => r.ld_sqlstate_leaked);
  const unmapped = results.filter((r) => r.thrown && !r.in_closed_set);
  const missingStatus = results.filter((r) => r.thrown && r.in_closed_set && r.status === null && r.code !== 'LEDGER_RECONCILE_MISMATCH');
  const unexpected500 = results.filter((r) => r.status === 500);
  const mismatches = results.filter((r) => r.verdict === 'mismatch');
  const skipped = results.filter((r) => r.returned === 'SKIPPED');

  const aggregates = {
    cells_total: results.length,
    cells_executed: results.length - skipped.length,
    cells_skipped: skipped.length,
    cells_thrown: thrown.length,
    cells_no_throw: results.length - thrown.length,
    /** 硬判据 ①：抛出的 code 是**未映射的裸 PG SQLSTATE**（5 位、非 LD0xx） */
    raw_sqlstate_escapes: rawEscapes.length,
    /** 硬判据 ②：抛出但 code ∉ §14.1 的 33 码关闭集（= 未归类） */
    unmapped: unmapped.length,
    /** 硬判据 ③：抛出且 code ∈ 关闭集但 `status === null`（状态类缺失） */
    missing_status: missingStatus.length,
    /** 附：DB 自定义 LD0xx 未经 TS 映射直接逃到调用方 */
    ld_sqlstate_leaked: ldLeaked.length,
    /** 附：调用方入参可构造的 500（R108 的「500 = 代码缺陷」语义被污染） */
    unexpected_500: unexpected500.length,
    /** 附：与逐格期望不符的格数（形状闸过弱 / 过强） */
    expectation_mismatches: mismatches.length,
    /** 附：形状合法格被误判为形状非法的格数（防御过度拒绝） */
    valid_shape_false_reject: results.filter((r) => r.expected.endsWith('must_no_shape_reject') && r.verdict === 'mismatch').length,
  };

  const verdicts = {
    raw_sqlstate_escapes_zero: aggregates.raw_sqlstate_escapes === 0,
    unmapped_zero: aggregates.unmapped === 0,
    missing_status_zero: aggregates.missing_status === 0,
    ld_sqlstate_no_leak: aggregates.ld_sqlstate_leaked === 0,
    no_unexpected_500_from_caller_input: aggregates.unexpected_500 === 0,
    all_cells_match_expectation: aggregates.expectation_mismatches === 0,
  };
  const failures = Object.entries(verdicts).filter(([, v]) => !v).map(([k]) => k);

  out.env = env;
  out.aggregates = aggregates;
  out.verdicts = verdicts;
  out.failures = failures;
  out.escape_cells = [...rawEscapes, ...ldLeaked, ...unmapped, ...missingStatus]
    .map((r) => ({ entry: r.entry, field: r.field, shape: r.input_shape, input: r.input_value, code: r.code, status: r.status, message: r.message }))
    .filter((v, i, arr) => arr.findIndex((x) => JSON.stringify(x) === JSON.stringify(v)) === i);
  out.mismatch_cells = mismatches.map((r) => ({
    entry: r.entry, field: r.field, shape: r.input_shape, input: r.input_value,
    thrown: r.thrown, code: r.code, status: r.status, reason: r.reason, expected: r.expected, note: r.message,
  }));
  out.cells = results;
  out.db_side = dbSide;
  const rowsBefore = String(env.ledger_entry_rows_before);
  const rowsAfter = await entryCount(admin);
  out.rows_touched = {
    ledger_entry_before: rowsBefore,
    ledger_entry_after: rowsAfter,
    wrote_no_ledger_rows: rowsBefore === rowsAfter,
  };
  out.finished_at = new Date().toISOString();

  const dir = path.resolve(__dirname, '..', '.p1f-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `p1o-00-escape-sweep-${phaseArg}-${RUN}.json`);
  if (fs.existsSync(file)) throw new Error(`REFUSE_TO_OVERWRITE ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));

  // ---------------------------------------------------------------- stdout（人读摘要）
  console.log(`WROTE ${file}`);
  console.log(JSON.stringify({
    phase: phaseArg, run: RUN, symbol: SYM, cid: CID,
    aggregates, verdicts, failures,
    escape_cells: out.escape_cells,
    mismatch_cells: out.mismatch_cells,
    rows_touched: out.rows_touched,
  }, null, 1));
  const byEntry = new Map<string, { total: number; thrown: number; codes: Record<string, number> }>();
  for (const r of results) {
    const e = byEntry.get(r.entry) ?? { total: 0, thrown: 0, codes: {} };
    e.total += 1;
    if (r.thrown) {
      e.thrown += 1;
      const k = `${r.code ?? 'null'}/${r.status ?? 'null'}`;
      e.codes[k] = (e.codes[k] ?? 0) + 1;
    }
    byEntry.set(r.entry, e);
  }
  console.log('--- 每入口点读数分布（code/status × 计数）---');
  for (const [k, v] of [...byEntry.entries()].sort()) {
    console.log(`${k.padEnd(34)} cells=${String(v.total).padStart(3)} thrown=${String(v.thrown).padStart(3)}  ${JSON.stringify(v.codes)}`);
  }

  await admin.end().catch(() => undefined);
  if (assertMode && failures.length) process.exit(1);
};

process.on('unhandledRejection', (r) => { console.error('UNHANDLED_REJECTION(ignored):', String(r).slice(0, 200)); });

main()
  .then(async () => { await closeLedgerWritePool().catch(() => undefined); process.exit(0); })
  .catch(async (e) => {
    console.error('P1O-00 FAILED:', (e as Error)?.stack ?? e);
    await closeLedgerWritePool().catch(() => undefined);
    process.exit(2);
  });
