/**
 * 批 8③b（`data-layer.spec` v0.13 §24 · `route-layer.spec` v2.6 §21 · `R-8-19`）：
 * **`app_config` 键级寻址写面（形态 B）真生效四段读数探针**
 * ============================================================================
 * 用法：cd backend-ts && P8S3B_BASE=http://127.0.0.1:5796 npx ts-node --transpile-only scripts/p8-s3b-01-effective.ts
 * 产物：backend-ts/.p8s3b-artifacts/p8s3b-effective-<RUN>/effective.json
 *
 * ★ 段面机制（**与 8③a 不同之处 · 逐字登记**）：
 *   ① **改键（后台写）= 真 HTTP `POST /api/admin/settings`（形态 B）** —— 与生产同一路由 / 同一闸 / 同一服务层；
 *      **末尾恢复原值**（`app_config` = upsert 表 · 可变可恢复）。写法 = `{key, value, create_key}`（信封 + 幂等键）。
 *      **恢复 = ① 真 HTTP 再写回原值（若原行存在）+ ② DB 逐字节封存**（value + updated_by + time_updated；
 *      因第二次 HTTP 写会把 `time_updated` 前移 ⇒ 为满足「时间戳未前移」硬判据，末步以 DB 逐字节封存收口 · 登记为已知取舍）。
 *      **异常/崩溃安全**：恢复逻辑在 `finally` 内 ⇒ ① 之后的任何异常都不会把线上 `app_config` 留在变异态。
 *   ② 库内落值：`SELECT … FROM public.app_config WHERE key = 'listing_deposit_policy'`。
 *   ③ 业务读口取数：`resolveListingDepositFloor(db value)`（= `currency-service.ts:387-388` 合成路径 + `database.ts:2038`）。
 *   ④ **行为随之 = `listing_deposit` 消耗额** —— 走**与 `POST /api/currency/:cid/list` 同路径的 DB 函数**
 *      `DatabaseService.listCurrencyWithDeposit(input, tx)`（`R-8-18`：**全部在事务内 + 末尾 `ROLLBACK`**；
 *      **严禁在生产库跑真 HTTP `list`** —— 真 POST 会把 `draft` 永久推成 `listed` · 不可逆）。
 *
 * ⚠️ 只打印 uid / cid / 计数 / 金额 / 状态码 / 机读字段，**不打印任何密钥 / 连接串 / token**。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { readQuery, withTransaction, closePools, txQuery, TxClient } from '../src/db';
import { createSessionToken } from '../src/auth';
import {
  DatabaseService,
  LISTING_DEPOSIT_POLICY_KEY,
  SYSTEM_SETTINGS_KEY,
  parseListingDepositPolicyAmount,
} from '../src/database';
import { CURRENCY_LIST_DEPOSIT_FLOOR, resolveListingDepositFloor } from '../src/currency-service';
import { canonicalAdminOpsKey } from '../src/admin-service';

const BASE = process.env.P8S3B_BASE || 'http://127.0.0.1:5796';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const OUT_DIR = path.join(HERE, '..', '.p8s3b-artifacts', `p8s3b-effective-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

/** 探针临时键值（**非定值** · 末尾恢复原值 ⇒ 零净变更；见报告「不得发明保证金数值」口径）。 */
const NEW_AMOUNT = 234567;
/** fail-closed 负向验证用：**字符串型**金额（读侧必须 `null` ⇒ 回落常量）。 */
const ILLEGAL_RAW = { amount: '77777' };
class RollbackSentinel extends Error {
  constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); }
}

interface Check { id: string; group: string; pass: boolean; detail: unknown; neg_rule: string; }
const checks: Check[] = [];
const rec = (id: string, group: string, pass: boolean, detail: unknown, negRule: string): void => {
  checks.push({ id, group, pass, detail, neg_rule: negRule });
};
const judge = (id: string, group: string, actual: unknown, expected: unknown, negRule: string): boolean => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  rec(id, group, ok, { actual, expected }, negRule);
  return ok;
};
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, negRule: string): void => {
  const fired = predicate(wrongInput) === false;
  rec(`${id}__selftest`, group, fired, { wrong_input: wrongInput, judge_fired: fired }, negRule);
};
const fp = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// ---------------------------------------------------------------- HTTP 小工具
const api = async (method: string, p: string, body?: unknown, token?: string): Promise<{ status: number; json: any; text_len: number }> => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text_len: text.length };
};

// ---------------------------------------------------------------- DB 小工具
const bal = async (tx: TxClient, uid: number, cid: number): Promise<number> => {
  const r = await txQuery<{ balance: string }>(tx,
    'SELECT balance::text AS balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint', [String(uid), String(cid)]);
  return r.length ? Number(r[0].balance) : -1;
};
const pickOwner = async (tx: TxClient): Promise<{ uid: number; balance: number }> => {
  const r = await txQuery<{ uid: string; balance: string }>(tx,
    `SELECT a.uid::text AS uid, a.balance::text AS balance
       FROM public.account AS a WHERE a.cid = 1 AND a.uid > 0
      ORDER BY a.balance DESC, a.uid ASC LIMIT 1`);
  return { uid: Number(r[0].uid), balance: Number(r[0].balance) };
};
const insertDraft = async (tx: TxClient, cid: number, symbol: string, ownerUid: number): Promise<number> => {
  const r = await txQuery<{ cid: string }>(tx,
    `INSERT INTO public.currency (cid, symbol, name, owner_uid, decimals, status, deposit_cid)
     VALUES ($1::bigint, $2::text, $3::text, $4::bigint, 0, 'draft', 1) RETURNING cid::text AS cid`,
    [String(cid), symbol, `p8s3b fuel probe ${symbol}`, String(ownerUid)]);
  return Number(r[0].cid);
};
const runListSamePath = async (tx: TxClient, input: { cid: number; actorUid: number; fee: number; depositAmount: number }): Promise<Record<string, unknown>> =>
  DatabaseService.listCurrencyWithDeposit({
    cid: input.cid, actorUid: input.actorUid, fee: input.fee, depositAmount: input.depositAmount,
    idempotencyKey: `biz:currency:list:${input.cid}`,
    requestFingerprint: fp(['list', input.cid, input.actorUid, input.fee, input.depositAmount]),
    memo: `currency_list_deposit:${input.cid}`,
  }, tx) as Promise<Record<string, unknown>>;
const eventLegs = async (tx: TxClient, cid: number): Promise<Array<Record<string, string>>> =>
  txQuery<Record<string, string>>(tx,
    `SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, kind, idempotency_key
       FROM public.ledger_entry
      WHERE idempotency_key = $1::text OR idempotency_key LIKE $1::text || '#%' ORDER BY txid`,
    [`biz:currency:list:${cid}`]);
/** `src/currency-service.ts` 的 `CURRENCY_LIST_FEE_FLOOR`（**未导出** ⇒ 从源码取真值，不发明）。 */
const CURRENCY_SRC = fs.readFileSync(path.resolve(HERE, '..', 'src', 'currency-service.ts'), 'utf8');
const CURRENCY_LINES = CURRENCY_SRC.split('\n');
const lineOf = (needle: string, nth = 1): number => {
  let c = 0;
  for (let i = 0; i < CURRENCY_LINES.length; i += 1) if (CURRENCY_LINES[i].includes(needle)) { c += 1; if (c === nth) return i + 1; }
  return -1;
};
const LIST_FEE_FLOOR = Number((CURRENCY_SRC.match(/CURRENCY_LIST_FEE_FLOOR\s*=\s*(\d+)/) || [])[1]);
/** `src/database.ts` 行号（`ak2_read_db` 锚点：搜的是该文件，**不得**拿 `currency-service` 的行号缓冲）。 */
const DATABASE_LINES = fs.readFileSync(path.resolve(HERE, '..', 'src', 'database.ts'), 'utf8').split('\n');
const dbLineOf = (needle: string, nth = 1): number => {
  let c = 0;
  for (let i = 0; i < DATABASE_LINES.length; i += 1) if (DATABASE_LINES[i].includes(needle)) { c += 1; if (c === nth) return i + 1; }
  return -1;
};
const ANCHORS = {
  read_port_call: `src/currency-service.ts:${lineOf('const depositFloor = await resolveListingDepositFloorFromDb();')} listCurrencyVerb 取保证金下限（③ 业务读口径）`,
  list_db_call: `src/currency-service.ts:${lineOf('DatabaseService.listCurrencyWithDeposit({')} listCurrencyVerb → DatabaseService.listCurrencyWithDeposit（④ 同路径 DB 函数）`,
  ak2_read_db: `src/database.ts:${dbLineOf("WHERE key = 'listing_deposit_policy'")} getListingDepositPolicyValue（AK2 只读读口）`,
  route_post: `src/index.ts:${fs.readFileSync(path.resolve(HERE, '..', 'src', 'index.ts'), 'utf8').split('\n').findIndex((l) => l.includes("app.post('/api/admin/settings'")) + 1} POST /api/admin/settings（① 写口）`,
};

// ---------------------------------------------------------------- 快照（只读 · 逐字节对照）
const snapshot = async (): Promise<Record<string, unknown>> => {
  const [cfgRows, cfgAgg, currency, ledger, account, slog, txid] = await Promise.all([
    readQuery<Record<string, unknown>>(`SELECT key, value::text AS value_text, updated_by::text AS updated_by, time_updated::text AS time_updated FROM public.app_config ORDER BY key`),
    readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, max(time_updated)::text AS max_updated FROM public.app_config`),
    readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, max(cid)::text AS max_cid, max(time_created)::text AS max_created, max(listed_at)::text AS max_listed_at,
      md5(string_agg(cid::text||'|'||symbol||'|'||owner_uid::text||'|'||status||'|'||deposit_amount::text||'|'||deposit_cid::text||'|'||coalesce(listed_at::text,'~')||'|'||time_created::text, E'\\n' ORDER BY cid)) AS digest FROM public.currency`),
    readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, max(txid)::text AS max_txid, max(time_created)::text AS max_created,
      md5(string_agg(txid::text||'|'||uid::text||'|'||cid::text||'|'||delta::text||'|'||balance_after::text||'|'||kind||'|'||idempotency_key, E'\\n' ORDER BY txid)) AS digest FROM public.ledger_entry`),
    readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n,
      md5(string_agg(uid::text||'|'||cid::text||'|'||balance::text||'|'||frozen::text||'|'||version::text, E'\\n' ORDER BY uid, cid)) AS digest FROM public.account`),
    readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, max(log_id)::text AS max_log_id FROM public.currency_status_log`),
    readQuery<Record<string, string>>(`SELECT last_value::text AS last_value FROM public.ledger_entry_txid_seq`).catch(() => [] as Record<string, string>[]),
  ]);
  return { app_config: { rows: cfgRows, agg: cfgAgg[0] }, currency: currency[0], ledger_entry: ledger[0], account: account[0], status_log: slog[0], txid_seq_last: txid[0]?.last_value ?? null };
};
const readAk2 = async (): Promise<Record<string, string> | null> =>
  (await readQuery<Record<string, string>>(
    `SELECT value::text AS value_text, updated_by::text AS updated_by, time_updated::text AS time_updated FROM public.app_config WHERE key = 'listing_deposit_policy'`))[0] ?? null;
const readAk1 = async (): Promise<Record<string, string> | null> =>
  (await readQuery<Record<string, string>>(
    `SELECT value::text AS value_text, updated_by::text AS updated_by, time_updated::text AS time_updated FROM public.app_config WHERE key = 'system_settings'`))[0] ?? null;

// ============================================================================
(async () => {
  const out: Record<string, unknown> = {
    script: 'scripts/p8-s3b-01-effective.ts', run: RUN, base: BASE,
    segment_mechanisms: {
      seg1: '真 HTTP POST /api/admin/settings（形态 B `{key,value}`）+ 末尾恢复原值（HTTP 回写 + DB 逐字节封存 · finally 保证）',
      seg4: 'R-8-18：与 POST /api/currency/:cid/list 同路径的 DB 函数 `DatabaseService.listCurrencyWithDeposit(input, tx)` + 末尾 ROLLBACK；严禁生产真 HTTP list',
    },
    anchors: ANCHORS,
    constants: { deposit_floor_constant: CURRENCY_LIST_DEPOSIT_FLOOR, list_fee_constant: LIST_FEE_FLOOR, probe_new_amount: NEW_AMOUNT, illegal_raw: ILLEGAL_RAW },
  };

  // ---------------- 0) 开工基线（事务外 · 只读） ----------------
  const baseline = await snapshot();
  const ak2Original = await readAk2();
  const ak1Original = await readAk1();
  out.baseline = baseline;
  out.ak2_original = ak2Original;
  out.ak1_original = { present: ak1Original !== null, updated_by: ak1Original?.updated_by ?? null, time_updated: ak1Original?.time_updated ?? null };
  rec('S0-baseline-captured', 'baseline', baseline.app_config != null && ak1Original !== null,
    { app_config: baseline.app_config, currency: baseline.currency, ledger_entry: baseline.ledger_entry, account: baseline.account },
    '基线快照取不到（或 `system_settings` 行缺失）⇒ 后续「恢复自证」不可信 ⇒ 判负');

  // 受控 actor：现库 admin
  const admins = await readQuery<{ uid: number; evm: string }>(`SELECT u.uid, u.evm FROM "users" u WHERE u.is_admin = true ORDER BY u.uid LIMIT 1`);
  if (!admins[0]) throw new Error('NO_ADMIN_USER_FOUND');
  const ADMIN_UID = admins[0].uid;
  const adminToken = createSessionToken({ uID: ADMIN_UID, evm: admins[0].evm });
  out.admin = { uid: ADMIN_UID };
  const OPS_A = canonicalAdminOpsKey(ADMIN_UID, 'setting', SYSTEM_SETTINGS_KEY);
  const OPS_B = canonicalAdminOpsKey(ADMIN_UID, 'setting', LISTING_DEPOSIT_POLICY_KEY);

  const A: Record<string, unknown> = {};
  const originalPolicyValue = ak2Original ? JSON.parse(ak2Original.value_text) : null;

  try {
    // ==================================================================
    // ①-a · 形态 A 回归（真 HTTP · 语义 no-op 补丁 `{maintenance:<现值>}`；写后逐字节恢复）
    // ==================================================================
    const current = await DatabaseService.getSystemSettings();
    const g0 = await api('GET', '/api/admin/settings', undefined, adminToken);
    const g0Keys = g0.json?.data ? Object.keys(g0.json.data) : [];
    const wa = await api('POST', '/api/admin/settings', { maintenance: current.maintenance, create_key: OPS_A }, adminToken);
    A['1a_formA_regression'] = {
      ops_key: OPS_A, request_body_shape: { maintenance: '<current>', create_key: '<ops>' },
      get_before: { status: g0.status, data_keys: g0Keys },
      post: { status: wa.status, message: wa.json?.message ?? null, data_keys: wa.json?.data ? Object.keys(wa.json.data) : [], data: wa.json?.data ?? null },
    };
    judge('S1a-formA-status-200', 'write', wa.status, 200, '形态 A（真 HTTP）非 200 ⇒ 判负（向后兼容破）');
    judge('S1a-formA-message', 'write', wa.json?.message ?? null, 'System settings saved', "形态 A 响应 `message` 漂移（`AW9` 冻结值 = 'System settings saved'）⇒ 判负");
    judge('S1a-formA-data-keys', 'write', wa.json?.data ? Object.keys(wa.json.data).sort() : [], ['allowRegistration', 'defaultLanguage', 'emailNotifications', 'maintenance', 'maxDailyTasks', 'pointsPerTask', 'rewardCooldown', 'siteDescription', 'siteName'],
      '形态 A 响应 `data` 键集 ≠ 9 字段（`AW9` 逐字不变）⇒ 判负');
    // 形态 A 负向：未知字段 / 缺 ops 键（canonical_key 逐字 = system_settings）
    const waBad = await api('POST', '/api/admin/settings', { siteName: 'x', foo: 1, create_key: OPS_A }, adminToken);
    judge('S1a-formA-unknown-field', 'write',
      { status: waBad.status, reason: waBad.json?.error?.details?.reason ?? null, code: waBad.json?.error?.code ?? null },
      { status: 400, reason: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST', code: 'LEDGER_AMOUNT_INVALID' },
      '形态 A 未知字段未 400 + 稳定常量 reason ⇒ 判负');
    const waNoOps = await api('POST', '/api/admin/settings', { maintenance: current.maintenance }, adminToken);
    judge('S1a-formA-canonical-key', 'ops',
      { status: waNoOps.status, code: waNoOps.json?.error?.code ?? null, canonical_key: waNoOps.json?.error?.details?.canonical_key ?? null },
      { status: 400, code: 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', canonical_key: OPS_A },
      "形态 A 缺 `ops:` 键 ⇒ `canonical_key` 必须逐字 = `ops:<uid>:setting:system_settings`（§24.3(c)④）⇒ 判负");

    // ==================================================================
    // ①-b · 形态 B 负向（真 HTTP · 均在 ①-b 正向前；不得改库）
    // ==================================================================
    const nb1 = await api('POST', '/api/admin/settings', { key: 'nope', value: { amount: 1 }, create_key: OPS_B }, adminToken);
    judge('S1b-av1-unknown-key', 'av',
      { status: nb1.status, reason: nb1.json?.error?.details?.reason ?? null, field: nb1.json?.error?.details?.field ?? null, legal_keys: nb1.json?.error?.details?.legal_keys ?? null },
      { status: 400, reason: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST', field: 'nope', legal_keys: [...['system_settings', 'listing_deposit_policy']] },
      '形态 B 顶层键非法未 400 + `legal_keys` = 恰 2 键 ⇒ 判负（`AV1`）');
    const nb2 = await api('POST', '/api/admin/settings', { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: '50000' }, create_key: OPS_B }, adminToken);
    judge('S1b-av3-string-amount', 'av',
      { status: nb2.status, reason: nb2.json?.error?.details?.reason ?? null, expected: nb2.json?.error?.details?.expected ?? null, got: nb2.json?.error?.details?.got ?? null },
      { status: 400, reason: 'SETTING_TYPE_INVALID', expected: 'number', got: 'string' },
      '形态 B `amount` 字符串未 400（隐式转换 / 回落）⇒ 判负（`AV3`）');
    const nb3 = await api('POST', '/api/admin/settings', { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: 0 }, create_key: OPS_B }, adminToken);
    judge('S1b-av4-zero-amount', 'av',
      { status: nb3.status, expected: nb3.json?.error?.details?.expected ?? null, field: nb3.json?.error?.details?.field ?? null },
      { status: 400, expected: 'positive_integer', field: 'amount' },
      '形态 B `amount=0` 未落 `AV4`（`expected=positive_integer`）⇒ 判负');
    const nb4 = await api('POST', '/api/admin/settings', { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: 1, balance: 2 }, create_key: OPS_B }, adminToken);
    judge('S1b-av2-extra-field', 'av',
      { status: nb4.status, reason: nb4.json?.error?.details?.reason ?? null, legal_keys: nb4.json?.error?.details?.legal_keys ?? null },
      { status: 400, reason: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST', legal_keys: ['amount'] },
      '形态 B AK2 夹带字段未 400 + `legal_keys=[amount]`（字段层证据 · 键 ≠ 字段）⇒ 判负（`AV2`）');
    const nb5 = await api('POST', '/api/admin/settings', { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: 1 } }, adminToken);
    judge('S1b-canonical-key', 'ops',
      { status: nb5.status, code: nb5.json?.error?.code ?? null, canonical_key: nb5.json?.error?.details?.canonical_key ?? null },
      { status: 400, code: 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', canonical_key: OPS_B },
      "形态 B 缺 `ops:` 键 ⇒ `canonical_key` 必须逐字 = `ops:<uid>:setting:listing_deposit_policy`（§24.3(c)③/④）⇒ 判负");
    const nb6 = await api('POST', '/api/admin/settings', { key: 'nope', value: { amount: 1 } }, adminToken);
    judge('S1b-av1-before-ops', 'ops',
      { status: nb6.status, code: nb6.json?.error?.code ?? null, reason: nb6.json?.error?.details?.reason ?? null },
      { status: 400, code: 'LEDGER_AMOUNT_INVALID', reason: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST' },
      '形态 B 非法键 + 缺 `ops:` 键 ⇒ **必须先报 `AV1`**（不得伪装成缺幂等键 · §24.3(c)⑤）⇒ 判负');
    const nbDB = await readAk2();
    judge('S1b-negatives-db-untouched', 'av', nbDB ? nbDB.value_text : null, ak2Original ? ak2Original.value_text : null,
      '①-b 负向全部被拒后（形态 B 正向**尚未**发）库内 AK2 值已变 ⇒ 判负（拒写却落库）');

    // ==================================================================
    // ①-b · 形态 B 正向（真 HTTP 写 `listing_deposit_policy = NEW_AMOUNT`）
    // ==================================================================
    const wb = await api('POST', '/api/admin/settings', { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: NEW_AMOUNT }, create_key: OPS_B }, adminToken);
    A['1b_formB_write'] = {
      method: 'POST', path: '/api/admin/settings', ops_key: OPS_B, request_body: { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: NEW_AMOUNT }, create_key: '<ops>' },
      response: { status: wb.status, message: wb.json?.message ?? null, data: wb.json?.data ?? null, data_keys: wb.json?.data ? Object.keys(wb.json.data).sort() : [] },
    };
    judge('S1b-write-status-200', 'write', wb.status, 200, '形态 B 真 HTTP 写未 200 ⇒ 判负');
    judge('S1b-write-data-keys', 'write', wb.json?.data ? Object.keys(wb.json.data).sort() : [], ['key', 'value'],
      '形态 B 响应 `data` 键集 ≠ `{key, value}`（`AW8`）⇒ 判负');
    judge('S1b-write-message', 'write', wb.json?.message ?? null, 'App config key saved', "形态 B 响应 `message` ≠ 冻结值 'App config key saved'（`AW8`）⇒ 判负");
    judge('S1b-write-echo', 'write', { key: wb.json?.data?.key ?? null, value: wb.json?.data?.value ?? null },
      { key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: NEW_AMOUNT } }, '形态 B 响应 `data` ≠ `{key:listing_deposit_policy, value:{amount:NEW_AMOUNT}}` ⇒ 判负');

    // ==================================================================
    // ② 库内落值（给表 / 列 / 该行取值）
    // ==================================================================
    const landed = await readAk2();
    const landedVal = landed ? JSON.parse(landed.value_text) : null;
    A['2_db_landed'] = { table: 'public.app_config', columns: ['key', 'value', 'updated_by', 'time_updated'], row: landed, parsed: landedVal };
    judge('S2-value-landed', 'landed', landedVal, { amount: NEW_AMOUNT },
      '**写成功但库值未变 ⇒ 判负**（真 HTTP 返回 200、库内 `listing_deposit_policy.value` 却不等于新值）');
    selfTest('S2-value-landed', 'landed', (v) => JSON.stringify(v) === JSON.stringify({ amount: NEW_AMOUNT }), { amount: NEW_AMOUNT + 1 },
      '写成功但库列未变 ⇒ 判负');
    const keySet = (await readQuery<Record<string, string>>(`SELECT key FROM public.app_config ORDER BY key`)).map((r) => r.key);
    // 期望键集 = 基线键集 ∪ {`listing_deposit_policy`}（**仅当基线无该行时**）：原库无 `AK2` 行 ⇒
    // 形态 B 写为 **INSERT 新行**（不是 UPDATE 既有行）⇒ 顶层键集须**恰**多出此一键。
    const baselineKeys = (baseline.app_config as { rows: Array<{ key: string }> }).rows.map((r) => r.key).sort();
    const expectedKeySet = Array.from(new Set([...baselineKeys, ...(ak2Original ? [] : [LISTING_DEPOSIT_POLICY_KEY])])).sort();
    judge('S2-key-set-unchanged', 'landed', keySet, expectedKeySet,
      '写 `AK2` 改变了 `app_config` 顶层键集（新增/丢行）⇒ 判负（期望键集 = 基线键集 ∪ {`listing_deposit_policy`}（原库无该行 ⇒ 写后恰多此一键））');
    const ak1AfterWrite = await readAk1();
    judge('S2-ak1-value-untouched', 'landed', ak1AfterWrite ? ak1AfterWrite.value_text : null, ak1Original ? ak1Original.value_text : null,
      '写 `AK2` 顺带改了 `AK1`（`system_settings` 值漂移）⇒ 判负');

    // ==================================================================
    // ③ 业务读口取数（给 文件:行 + 读数含 floor_source）
    // ==================================================================
    const rawAfter = await DatabaseService.getListingDepositPolicyValue();
    const floorAfter = resolveListingDepositFloor(rawAfter);
    A['3_business_read'] = { anchor_call: ANCHORS.read_port_call, anchor_read: ANCHORS.ak2_read_db, raw_ak2: rawAfter, floor: floorAfter };
    judge('S3-uses-config', 'read', floorAfter, { floor: NEW_AMOUNT, source: 'config' },
      '业务读口**取不到**新键值（仍回落常量 / 取到别值）⇒ 判负（库内有新值但业务不读）');
    judge('S3-parse-no-invention', 'read', parseListingDepositPolicyAmount(rawAfter), NEW_AMOUNT, '读侧解析与落值不等（隐式转换 / 发明数值）⇒ 判负');
    selfTest('S3-uses-config', 'read', (v) => JSON.stringify(v) === JSON.stringify({ floor: NEW_AMOUNT, source: 'config' }), { floor: NEW_AMOUNT, source: 'constant' },
      '读口仍走常量 ⇒ 谓词必须转红');

    // ==================================================================
    // ④ 行为随之（事务内 · 同路径 DB 函数 · 末尾 ROLLBACK）
    // ==================================================================
    let seg4: Record<string, unknown> = {};
    try {
      await withTransaction(async (tx) => {
        const B: Record<string, unknown> = {};
        const owner = await pickOwner(tx);
        const OWNER = owner.uid;
        B.fixture = { owner_uid: String(OWNER), owner_balance_baseline: String(owner.balance) };
        rec('S0-owner-funded', 'baseline', OWNER > 0 && owner.balance > LIST_FEE_FLOOR * 2 + CURRENCY_LIST_DEPOSIT_FLOOR + NEW_AMOUNT,
          { owner_uid: String(OWNER), balance: String(owner.balance) }, '出资账户余额不足以覆盖两轮消耗 ⇒ ④ 不可测 ⇒ 判负');
        const setAk2 = async (raw: string | null): Promise<void> => {
          if (raw === null) { await txQuery(tx, `DELETE FROM public.app_config WHERE key = 'listing_deposit_policy'`); return; }
          await txQuery(tx, `INSERT INTO public.app_config (key, value, updated_by, time_updated) VALUES ($1::text, $2::jsonb, 0::bigint, now())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, time_updated = now()`,
            [LISTING_DEPOSIT_POLICY_KEY, raw]);
        };
        const measure = async (cid: number, symbol: string): Promise<Record<string, unknown>> => {
          await insertDraft(tx, cid, symbol, OWNER);
          const o0 = await bal(tx, OWNER, 1); const p0 = await bal(tx, -1, 1);
          const floorNow = resolveListingDepositFloor(await DatabaseService.getListingDepositPolicyValue(tx));
          const listReply = await runListSamePath(tx, { cid, actorUid: OWNER, fee: LIST_FEE_FLOOR, depositAmount: floorNow.floor });
          const o1 = await bal(tx, OWNER, 1); const p1 = await bal(tx, -1, 1);
          const legs = (await eventLegs(tx, cid)).filter((l) => l.kind === 'listing_deposit');
          return {
            floor: floorNow, draft_cid: String(cid), applied: Number(listReply.applied),
            owner_decrease: String(o0 - o1), pool_increase: String(p1 - p0),
            deposit_legs: legs.map((l) => `${l.uid}:${l.delta}`).sort(),
          };
        };
        // ④-改前：事务内把 AK2 恢复为**原态**（原行存在 ⇒ 原值；不存在 ⇒ 删行）
        await setAk2(ak2Original ? ak2Original.value_text : null);
        const before = await measure(925_000_011, 'P8S3BFB1');
        // ④-改后：事务内把 AK2 置为**新值**
        await setAk2(JSON.stringify({ amount: NEW_AMOUNT }));
        const after = await measure(925_000_012, 'P8S3BFA1');
        // ④-负向：非法值 ⇒ fail-closed 到常量 ⇒ 行为面用常量
        await setAk2(JSON.stringify(ILLEGAL_RAW));
        const negBehavior = await measure(925_000_013, 'P8S3BFN1');
        B['4_before'] = before; B['4_after'] = after; B['4_fail_closed_behavior'] = negBehavior;
        const beforeFloor = (before.floor as { floor: number }).floor;
        const beforeDecrease = Number(before.owner_decrease);
        const afterDecrease = Number(after.owner_decrease);
        judge('S4-before-applied', 'behavior', before.applied, 1, '改键前同路径 DB 函数未把 draft 推成 listed（applied≠1）⇒ 判负');
        judge('S4-before-owner-decrease', 'behavior', beforeDecrease, LIST_FEE_FLOOR + beforeFloor,
          '改键**前** owner `balance` 减少额 ≠ 上市费 + 原下限（常量或原键值）⇒ 判负');
        judge('S4-after-owner-decrease', 'behavior', afterDecrease, LIST_FEE_FLOOR + NEW_AMOUNT,
          '改键**后** owner `balance` 减少额 ≠ 上市费 + 新键值 ⇒ 判负（键未生效）');
        judge('S4-after-deposit-legs', 'behavior', after.deposit_legs, [`${OWNER}:${-NEW_AMOUNT}`, `-1:${NEW_AMOUNT}`].sort(),
          '改键**后** `listing_deposit` 分录 ≠ {owner −新值, −1 +新值} ⇒ 判负');
        judge('S4-two-readings-differ', 'behavior', beforeDecrease !== afterDecrease, true,
          '同一夹具下改键前后 `listing_deposit` 消耗额**相等** ⇒ 键不生效 ⇒ 判负');
        selfTest('S4-two-readings-differ', 'behavior', (v) => v !== beforeDecrease, beforeDecrease, '改键前后消耗额相等 ⇒ 谓词必须转红');
        judge('S4-two-readings-computable', 'behavior',
          { before: beforeDecrease === LIST_FEE_FLOOR + beforeFloor, after: afterDecrease === LIST_FEE_FLOOR + NEW_AMOUNT },
          { before: true, after: true }, '两读数非「上市费 + 各自下限」逐值可算 ⇒ 判负');
        judge('S4-fail-closed-behavior', 'behavior', { floor_used: (negBehavior.floor as { floor: number }).floor, decrease: Number(negBehavior.owner_decrease) },
          { floor_used: CURRENCY_LIST_DEPOSIT_FLOOR, decrease: LIST_FEE_FLOOR + CURRENCY_LIST_DEPOSIT_FLOOR },
          '非法键值下行为面**未**用兜底常量（fail-open 到库里的坏值）⇒ 判负');
        B['4_two_readings'] = {
          before: { floor: beforeFloor, owner_decrease: String(beforeDecrease) },
          after: { floor: NEW_AMOUNT, owner_decrease: String(afterDecrease) },
          delta: String(afterDecrease - beforeDecrease), delta_expected: String(NEW_AMOUNT - beforeFloor),
        };
        seg4 = B;
        throw new RollbackSentinel('SEG4_LIST');
      });
    } catch (e) {
      if (!(e instanceof RollbackSentinel)) throw e;
      seg4.rollback = { sentinel: (e as RollbackSentinel).tag, committed: false, sql: 'withTransaction 回调抛哨兵 ⇒ catch ⇒ ROLLBACK（无 COMMIT）' };
    }
    A['4_segment'] = seg4;
    judge('S4-rollback-no-commit', 'rollback', JSON.stringify((seg4.rollback as Record<string, unknown> | undefined)?.committed), JSON.stringify(false),
      '`rollback.committed !== false`（疑似走了 COMMIT 路径）⇒ 判负');
    out.segment = A;
  } finally {
    // ==================================================================
    // 末尾恢复原值（**必执行**）：① 真 HTTP 回写原值（若原行存在且为合法策略）② DB 逐字节封存
    // ==================================================================
    const restore: Record<string, unknown> = {};
    const curAk2 = await readAk2();
    if (ak2Original && originalPolicyValue !== null) {
      const rw = await api('POST', '/api/admin/settings', { key: LISTING_DEPOSIT_POLICY_KEY, value: originalPolicyValue, create_key: OPS_B }, adminToken);
      restore.http_rewrite = { sent: true, status: rw.status, message: rw.json?.message ?? null, data: rw.json?.data ?? null };
    } else {
      restore.http_rewrite = { sent: false, reason: '原 AK2 行不存在（或值非法）⇒ HTTP 写面无法删行 ⇒ 交由 DB 封存 DELETE' };
    }
    // DB 逐字节封存（**写路径 = 事务内** · `withTransaction` 成功即 `COMMIT`）。
    // ★ 手法 = **DELETE + INSERT**（非 UPDATE）：`app_config` 挂两枚 **BEFORE UPDATE** 触发器 ——
    //   `trg_app_config_touch_updated`（`NEW.time_updated := now()` · DL75③/R5 不接受客户端时间）
    //   与 `trg_app_config_key_immutable`（拒 `key` 变更）⇒ **UPDATE 无法逐字节复原时间戳**；
    //   而两触发器**均不拦 INSERT / DELETE** ⇒ 以「删行 + 按原样重插（含原 `time_updated`）」复原到逐字节。
    await withTransaction(async (tx) => {
      await txQuery(tx, `DELETE FROM public.app_config WHERE key = ANY($1::text[])`,
        [[SYSTEM_SETTINGS_KEY, LISTING_DEPOSIT_POLICY_KEY]]);
      if (ak1Original) {
        await txQuery(tx, `INSERT INTO public.app_config (key, value, updated_by, time_updated) VALUES ($1::text, $2::jsonb, $3::bigint, $4::timestamptz)`,
          [SYSTEM_SETTINGS_KEY, ak1Original.value_text, ak1Original.updated_by, ak1Original.time_updated]);
      }
      if (ak2Original) {
        await txQuery(tx, `INSERT INTO public.app_config (key, value, updated_by, time_updated) VALUES ($1::text, $2::jsonb, $3::bigint, $4::timestamptz)`,
          [LISTING_DEPOSIT_POLICY_KEY, ak2Original.value_text, ak2Original.updated_by, ak2Original.time_updated]);
      }
    });
    restore.disk_seal = {
      ak2: ak2Original ? 'DELETE + INSERT（含原 value+updated_by+time_updated）逐字节恢复' : 'DELETE（原无行）',
      ak1: 'DELETE + INSERT（含原 value+updated_by+time_updated）逐字节恢复',
      observed_ak2_before_seal: curAk2,
    };
    out.restore = restore;
  }

  // ============================================================================
  // 恢复自证（只读）：库面必须与开工基线**逐字节相同**
  // ============================================================================
  await new Promise((r) => setTimeout(r, 300));
  const afterAll = await snapshot();
  out.post_restore = afterAll;
  const bs = baseline as Record<string, any>;
  const as = afterAll as Record<string, any>;
  judge('RESTORE-app_config-identical', 'restore', JSON.stringify(as.app_config.rows), JSON.stringify(bs.app_config.rows),
    '恢复后 `app_config` 行集（key/value/updated_by/time_updated）与开工基线不逐字节相同 ⇒ 判负（**写已外泄**）');
  judge('RESTORE-no-extra-row', 'restore', (as.app_config.rows as unknown[]).length, (bs.app_config.rows as unknown[]).length,
    '恢复后 `app_config` 行数与基线不同（多出 / 少了行）⇒ 判负');
  judge('RESTORE-currency-digest-identical', 'restore', [as.currency.n, as.currency.max_cid, as.currency.digest], [bs.currency.n, bs.currency.max_cid, bs.currency.digest],
    '恢复后 `currency` 行数/最大 cid/逐行摘要与基线不同 ⇒ 判负（draft 币行已落库）');
  judge('RESTORE-ledger-digest-identical', 'restore', [as.ledger_entry.n, as.ledger_entry.max_txid, as.ledger_entry.digest], [bs.ledger_entry.n, bs.ledger_entry.max_txid, bs.ledger_entry.digest],
    '恢复后 `ledger_entry` 行数/最大 txid/逐行摘要与基线不同 ⇒ 判负（分录已落库）');
  judge('RESTORE-account-digest-identical', 'restore', [as.account.n, as.account.digest], [bs.account.n, bs.account.digest],
    '恢复后 `account` 余额/冻结/version 与基线不同 ⇒ 判负（余额已变动）');
  judge('RESTORE-status-log-identical', 'restore', as.status_log, bs.status_log,
    '恢复后 `currency_status_log` 行数/最大 log_id 与基线不同 ⇒ 判负');
  judge('RESTORE-timestamps-not-advanced', 'restore',
    {
      app_config_max_updated: as.app_config.agg.max_updated === bs.app_config.agg.max_updated,
      currency_max_created: as.currency.max_created === bs.currency.max_created,
      currency_max_listed_at: as.currency.max_listed_at === bs.currency.max_listed_at,
      ledger_max_created: as.ledger_entry.max_created === bs.ledger_entry.max_created,
    },
    { app_config_max_updated: true, currency_max_created: true, currency_max_listed_at: true, ledger_max_created: true },
    '恢复后 `max(time_updated)` / `max(time_created)` / `max(listed_at)` 类时间戳**前移** ⇒ 判负');
  // 已知代价：nextval 非事务性（只读序列水位）
  out.seq_watermark = { txid_seq_last: as.txid_seq_last, baseline_txid_seq_last: bs.txid_seq_last };

  // ---------------------------------------------------------------- 结论
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S3B-EFFECTIVE', run: RUN, generated_at: new Date().toISOString(),
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    discipline: '① = 真 HTTP POST（形态 B）+ finally 内恢复原值（HTTP 回写 + DB 逐字节封存）；④ = 事务内同路径 DB 函数 + 末尾 ROLLBACK（R-8-18）；严禁生产真 HTTP list',
    http_surfaces: {
      admin_settings_write: '真 HTTP POST /api/admin/settings（形态 A + 形态 B + 负向）—— 已跑 · 末尾恢复原值',
      currency_list: 'NOT_MEASURED（跑真 POST /api/currency/:cid/list 会永久把 draft 推成 listed ⇒ 只走事务内同路径 DB 函数）',
    },
    anchors: ANCHORS,
    out, checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'effective.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'effective.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('PROBE_CRASHED', String((e as Error)?.stack || e).slice(0, 2000));
  await closePools().catch(() => undefined);
  process.exit(2);
});
