/**
 * 8⑥（`route-layer.spec` v2.21 §32 · `data-layer.spec` v0.28 §35）· **审计台**统一读口
 *   类级门 —— 14 面白名单闭集 + 逐表五类过滤映射 + keyset 分页 + `manage_audit` 鉴权 +
 *   零新增码 + 只读纪律 + 原因码常量集（`R-9-76`）+ 库面/HTTP 活体。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s11-audit-console-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。产物：backend-ts/.p8s11-artifacts/p8s11-<RUN>/gate.json
 *
 * ★ A–J 静态面 **零 DB / 零网络**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）。
 * ★ K 库面 leg 转真 checks（连库 + HTTP · `0041` 已 apply）：
 *   · 结构面活体只读（`schema_migration` 40·0041 / `admin_permission` 12 含 `manage_audit` /
 *     `super_admin` 12 / 基表 34 / 14 面 append-only 触发器在场）；
 *   · 14 面逐表只读真取数（`DatabaseService.readAuditPage` 走生产同一取数口）；
 *   · keyset 分页（`ledger_entry` 两页无重叠）+ 过滤正读（非假过滤）；
 *   · 受控实例真 HTTP（`P8S11_BASE` 默认 `127.0.0.1:5797`）：`401` / `200` / `400`（非白名单 /
 *     不适用参数 / `limit` 越界）。
 *   库面写一律**事务内 + 末尾 `ROLLBACK`**；HTTP 段打受控实例。`pending_apply[]` = **0**。
 *
 * 判据（每条可判负 + 自证负对照）：
 *   A  白名单闭集 **14 面逐字逐序**（排除 `app_config` · `R-9-77`）；负对照（喂 15 面 ⇒ 转红）
 *   B  逐表五类过滤映射 **14 行**（`actor`/`target`/`action`/时间窗/关联 id · 无列显式「无」）+ 面数计数
 *   C  非白名单 ⇒ **`400` + `details.reason = AUDIT_TABLE_NOT_FOUND`**（`R-9-74` · 原 404 作废）
 *   D  不适用参数 ⇒ **`400` + `details.supportedFilters`**（`R-9-78` 变体 B · 非静默忽略）
 *   E  keyset 形态（`ORDER BY <timeColumn> DESC, <pk> DESC` + 双键游标 + `limit+1`）
 *   F  `limit` **默认 50 / 上限 100**（`>100` / `<1` / 非整数 ⇒ `400`）
 *   G  逐表排序键（13 面 `time_created`；★ `referral` ⇒ `bound_at`）
 *   H  零新增码（借 `LEDGER_AMOUNT_INVALID` ∈ 闭集 **33**）+ 原因码常量集 **7 值**（非错误码）
 *   I  鉴权 `manage_audit` + 路由在场 + 只读（handler 零写）+ 注册点 88
 *   J  迁移 `0039` 纯 DML（零 DDL）+ `audit-console.ts` 零写 SQL
 *   K  库面 / HTTP 活体（连库 + 事务内 ROLLBACK + 受控实例）；`pending_apply[]` = 0
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  AUDIT_TABLES,
  AUDIT_TABLE_NAMES,
  AUDIT_FILTER_PARAMS,
  AUDIT_LIMIT_DEFAULT,
  AUDIT_LIMIT_MAX,
  supportedFiltersOf,
  parseAuditRequest,
  buildAuditSql,
  buildAuditView,
} from '../src/audit-console';
import type { AuditColumnMap } from '../src/audit-console';
import { POINTS_ADJUST_REASONS, isPointsAdjustReason } from '../src/points-adjust-reasons';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import { readQuery, closePools } from '../src/db';
import { createSessionToken } from '../src/auth';
import { DatabaseService } from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s11-artifacts', `p8s11-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, expect: string): void => {
  const fired = predicate(wrongInput) === false;
  checks.push({ id: `${id}__selftest`, group: `${group}SelfTest`, pass: fired, expect,
    actual: JSON.stringify({ wrong_input: wrongInput, judge_fired: fired }) });
};

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const AUDIT_CONSOLE_TS = readSrc('backend-ts/src/audit-console.ts');
const REASONS_TS = readSrc('backend-ts/src/points-adjust-reasons.ts');
const ADMIN_UTILS = readSrc('frontend/src/admin-utils.js');
const MIG_0039 = readSrc('backend-ts/migrations/0039_admin_audit_console.sql');
/** 去 `--` 行注释后的迁移**代码面**（判「零 DDL」须剔除注释里被引用的关键字）。 */
const MIG_0039_CODE = MIG_0039.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number => (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const countOf = (hay: string, re: RegExp): number => (hay.match(re) || []).length;
const eqJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** 提取 `app.<verb>(<path>` 起至 `\n});` 的路由体。 */
const routeBlock = (declRe: RegExp): string => {
  const m = declRe.exec(INDEX_TS);
  if (!m) return '';
  const end = INDEX_TS.indexOf('\n});', m.index);
  return end === -1 ? INDEX_TS.slice(m.index) : INDEX_TS.slice(m.index, end + 4);
};
const AUDIT_ROUTE_DECL = /^[ \t]*app\.get\('\/api\/admin\/audit\/:table',/m;
const AUDIT_ROUTE_BLOCK = routeBlock(AUDIT_ROUTE_DECL);

// 8⑥ 冻结计数前推（沿 R-8-22）：注册点 87 → 88（审计台统一读口 +1 · get）。
const REG_POINTS_FROZEN = 88;
const PER_VERB_FROZEN: Record<string, number> = { get: 37, post: 48, put: 0, patch: 1, delete: 2 };

// ---------------------------------------------------------------------------
// ★ 权威（§32.2 逐字 14 面 · 排除 `app_config`）+ §32.3 五类过滤逐表明细
// ---------------------------------------------------------------------------
const FACE_ORDER = [
  'admin_ops_audit_log', 'admin_refund_audit_log', 'ledger_entry', 'currency_review_log',
  'currency_status_log', 'listing_review_log', 'job_arbitration_log', 'batt_entry',
  'checkin_log', 'checkin_makeup_log', 'rating', 'listing_order_event', 'referral',
  'commission_policy',
];
const FROZEN_MAP: Record<string, AuditColumnMap> = {
  admin_ops_audit_log: { actor: ['actor_uid'], target: ['target_uid'], action: ['action', 'op', 'result'], timeColumn: 'time_created', refId: ['cid'], pk: 'log_id' },
  admin_refund_audit_log: { actor: ['actor_uid'], target: ['seller_uid', 'buyer_uid'], action: null, timeColumn: 'time_created', refId: ['order_id'], pk: 'log_id' },
  ledger_entry: { actor: null, target: null, action: null, timeColumn: 'time_created', refId: ['ref_id'], pk: 'txid' },
  currency_review_log: { actor: ['actor_uid'], target: ['cid'], action: null, timeColumn: 'time_created', refId: ['cid'], pk: 'log_id' },
  currency_status_log: { actor: ['actor_uid'], target: ['cid'], action: ['from_status', 'to_status'], timeColumn: 'time_created', refId: ['cid'], pk: 'log_id' },
  listing_review_log: { actor: ['actor_uid'], target: ['listing_id'], action: null, timeColumn: 'time_created', refId: ['listing_id'], pk: 'log_id' },
  job_arbitration_log: { actor: ['actor_uid'], target: ['job_id'], action: null, timeColumn: 'time_created', refId: ['job_id'], pk: 'log_id' },
  batt_entry: { actor: null, target: null, action: null, timeColumn: 'time_created', refId: ['ref_id'], pk: 'txid' },
  checkin_log: { actor: null, target: null, action: null, timeColumn: 'time_created', refId: null, pk: 'log_id' },
  checkin_makeup_log: { actor: null, target: null, action: null, timeColumn: 'time_created', refId: ['cid'], pk: 'log_id' },
  rating: { actor: ['rater_uid'], target: ['ratee_uid', 'target_id'], action: ['direction'], timeColumn: 'time_created', refId: ['target_id'], pk: 'rating_id' },
  listing_order_event: { actor: ['actor_uid'], target: ['order_id'], action: ['event_type', 'from_status', 'to_status'], timeColumn: 'time_created', refId: ['ref_id', 'order_id'], pk: 'event_id' },
  referral: { actor: null, target: ['child_uid', 'parent_uid'], action: null, timeColumn: 'bound_at', refId: null, pk: 'child_uid' },
  commission_policy: { actor: ['created_by'], target: null, action: null, timeColumn: 'time_created', refId: null, pk: 'policy_id' },
};

// ============================================================================
// A · 白名单闭集 14 面逐字逐序（排除 `app_config`）
// ============================================================================
{
  t('A1', 'whitelist', AUDIT_TABLE_NAMES.length === 14, '白名单面数 = 14（`R-9-77` 排除 `app_config`）', AUDIT_TABLE_NAMES.length);
  t('A2', 'whitelist', eqJson(AUDIT_TABLE_NAMES, FACE_ORDER),
    `白名单逐字逐序 = ${JSON.stringify(FACE_ORDER)}`, JSON.stringify(AUDIT_TABLE_NAMES));
  t('A3', 'whitelist', !AUDIT_TABLE_NAMES.includes('app_config') && !('app_config' in AUDIT_TABLES),
    '★ `app_config` **不在**白名单（裁出检索台 · `R-9-77`）', JSON.stringify({ inList: AUDIT_TABLE_NAMES.includes('app_config'), inMap: 'app_config' in AUDIT_TABLES }));
  const all14Present = FACE_ORDER.every((f) => f in AUDIT_TABLES);
  t('A4', 'whitelist', all14Present, '14 面**全部在场**（无缺项）', all14Present);
  selfTest('A2', 'whitelist', (v) => eqJson((v as { names: string[] }).names, FACE_ORDER),
    { names: [...FACE_ORDER, 'app_config'] }, '把「15 面（含 app_config）」喂入「14 面逐字」谓词 ⇒ 必须转红');
}

// ============================================================================
// B · 逐表五类过滤映射（14 行 · `actor`/`target`/`action`/时间窗/关联 id）· 无列显式「无」
// ============================================================================
{
  t('B1', 'perTableMap', eqJson(Object.keys(AUDIT_TABLES), FACE_ORDER),
    '映射表键序 = 14 面逐字逐序', JSON.stringify(Object.keys(AUDIT_TABLES)));
  const diffs: string[] = [];
  for (const f of FACE_ORDER) {
    if (!eqJson(AUDIT_TABLES[f], FROZEN_MAP[f])) diffs.push(f);
  }
  t('B2', 'perTableMap', diffs.length === 0,
    '14 行逐表映射（`actor`/`target`/`action`/`timeColumn`/`refId`/`pk`）逐字对齐 §32.3', JSON.stringify({ diffs }));
  const actorNull = FACE_ORDER.filter((f) => AUDIT_TABLES[f].actor === null).length;
  const targetNull = FACE_ORDER.filter((f) => AUDIT_TABLES[f].target === null).length;
  const actionNull = FACE_ORDER.filter((f) => AUDIT_TABLES[f].action === null).length;
  const refNull = FACE_ORDER.filter((f) => AUDIT_TABLES[f].refId === null).length;
  const timeCreated = FACE_ORDER.filter((f) => AUDIT_TABLES[f].timeColumn === 'time_created').length;
  const boundAt = FACE_ORDER.filter((f) => AUDIT_TABLES[f].timeColumn === 'bound_at').length;
  t('B3', 'perTableMap', actorNull === 5 && targetNull === 5 && actionNull === 10 && refNull === 3 && timeCreated === 13 && boundAt === 1,
    '面数计数（14 面）：actor 无 = 5 / target 无 = 5 / action 无 = 10 / refId 无 = 3 / 时间列 `time_created` = 13 ∧ `bound_at` = 1',
    JSON.stringify({ actorNull, targetNull, actionNull, refNull, timeCreated, boundAt }));
  // 「无」必须显式 `null`（不得留空 / 占位）
  const explicitNone = FACE_ORDER.every((f) => {
    const m = AUDIT_TABLES[f];
    return (m.actor === null || Array.isArray(m.actor)) && (m.target === null || Array.isArray(m.target)) && (m.action === null || Array.isArray(m.action)) && (m.refId === null || Array.isArray(m.refId));
  });
  t('B4', 'perTableMap', explicitNone, '每面「无列」= **显式 `null`**（不得留空 / 占位）', explicitNone);
  // 支持维度（`supportedFiltersOf`）逐表：from/to 恒在
  const badSupport = FACE_ORDER.filter((f) => {
    const s = supportedFiltersOf(AUDIT_TABLES[f]);
    return !s.includes('from') || !s.includes('to');
  });
  t('B5', 'perTableMap', badSupport.length === 0, '每面支持维度**恒含** `from`/`to`（时间窗统一参数名）', JSON.stringify({ badSupport }));
  selfTest('B3', 'perTableMap', (v) => (v as { actorNull: number }).actorNull === 5, { actorNull: 4 }, '把「actor 无 = 4」（漏一面）喂入面数谓词 ⇒ 必须转红');
}

// ============================================================================
// C · 非白名单 ⇒ 400 + `details.reason = AUDIT_TABLE_NOT_FOUND`
// ============================================================================
{
  const negs = ['made_up_table', 'app_config', 'ledger_entries', 'ADMIN_OPS_AUDIT_LOG', ''];
  const reads = negs.map((name) => {
    const r = parseAuditRequest(name, {});
    return { name, ok: r.ok, status: r.ok ? null : r.err.status, code: r.ok ? null : r.err.code, reason: r.ok ? null : (r.err.details as { reason?: string }).reason };
  });
  const all400 = reads.every((x) => x.ok === false && x.status === 400 && x.reason === 'AUDIT_TABLE_NOT_FOUND');
  t('C1', 'tableWhitelist400', all400,
    '非白名单（含 `app_config` / 大小写不符 / 空）⇒ 一律 `400` + `details.reason = AUDIT_TABLE_NOT_FOUND`（`R-9-74` · 原候选 404 作废）',
    JSON.stringify(reads));
  const shapeOk = reads.every((x) => x.code === 'LEDGER_AMOUNT_INVALID');
  t('C2', 'tableWhitelist400', shapeOk, '借码 = 既有 `LEDGER_AMOUNT_INVALID`（R107 单形状 · 零新增码）', JSON.stringify(reads.map((x) => x.code)));
  const r = parseAuditRequest('made_up_table', {});
  const shape = !r.ok ? { keys: Object.keys(r.err).sort(), hasDetails: typeof r.err.details === 'object' } : null;
  t('C3', 'tableWhitelist400', !r.ok && r.err.ok === false && typeof r.err.message === 'string' && typeof r.err.details === 'object',
    '失败对象形状 = `{ ok:false, status, code, message, details }`（`sendVerbError` 出口 · `R107`）', JSON.stringify(shape));
  t('C4', 'tableWhitelist400', !JSON.stringify(reads).match(/SELECT|FROM|public\.|pg_|constraint|password|DATABASE_URL/i),
    '`details` **零敏感上下文**（无 SQL / 裸表列名 / 约束名 / 连接串）', JSON.stringify(reads).slice(0, 160));
  selfTest('C1', 'tableWhitelist400', (v) => (v as { reason: string }).reason === 'AUDIT_TABLE_NOT_FOUND', { reason: 'PARAM_NOT_APPLICABLE' },
    '把「reason = PARAM_NOT_APPLICABLE」喂入「AUDIT_TABLE_NOT_FOUND」谓词 ⇒ 必须转红');
}

// ============================================================================
// D · 不适用参数 ⇒ 400 + `details.supportedFilters`（`R-9-78` 变体 B · 非静默忽略）
// ============================================================================
{
  // ledger_entry 无 actor 列 ⇒ actor 不适用
  const r1 = parseAuditRequest('ledger_entry', { actor: '1' });
  const d1 = r1.ok ? null : (r1.err.details as { reason?: string; supportedFilters?: string[] });
  t('D1', 'paramApplicability', r1.ok === false && r1.err.status === 400 && d1?.reason === 'PARAM_NOT_APPLICABLE' && eqJson(d1?.supportedFilters, ['from', 'to', 'refId']),
    '`ledger_entry?actor=1`（该表无 actor 列）⇒ `400 PARAM_NOT_APPLICABLE` + `supportedFilters = [from,to,refId]`',
    JSON.stringify({ reason: d1?.reason, supported: d1?.supportedFilters }));
  // checkin_log 无 refId 列 ⇒ refId 不适用
  const r2 = parseAuditRequest('checkin_log', { refId: '1' });
  const d2 = r2.ok ? null : (r2.err.details as { reason?: string; supportedFilters?: string[] });
  t('D2', 'paramApplicability', r2.ok === false && r2.err.status === 400 && d2?.reason === 'PARAM_NOT_APPLICABLE' && eqJson(d2?.supportedFilters, ['from', 'to']),
    '`checkin_log?refId=1`（该表无关联 id 列）⇒ `400 PARAM_NOT_APPLICABLE` + `supportedFilters = [from,to]`',
    JSON.stringify({ reason: d2?.reason, supported: d2?.supportedFilters }));
  t('D3', 'paramApplicability', eqJson(supportedFiltersOf(AUDIT_TABLES.rating), ['actor', 'target', 'action', 'from', 'to', 'refId']),
    '`rating` 全六维支持（actor/target/action/from/to/refId）', JSON.stringify(supportedFiltersOf(AUDIT_TABLES.rating)));
  // 正对照：适用参数 ⇒ 放行（防「一律 400」假绿）
  const okActor = parseAuditRequest('rating', { actor: '1' });
  const okRef = parseAuditRequest('ledger_entry', { refId: '1' });
  t('D4', 'paramApplicability', okActor.ok === true && okRef.ok === true,
    '正对照：**适用**参数放行（`rating?actor` / `ledger_entry?refId` ⇒ `ok=true`）', JSON.stringify({ rating_actor: okActor.ok, ledger_ref: okRef.ok }));
  // ★ 关键空格：不适用参数必须**显式拒绝**（非静默返回全表）
  const silentWouldLeak = parseAuditRequest('ledger_entry', { actor: '1' });
  t('D5', 'paramApplicability', !(silentWouldLeak.ok === true),
    '★ 不适用参数**绝不静默返回全表**（`ledger_entry?actor=1` 必须 `ok=false` · 否则 = 假绿陷阱 · `R-9-78`）',
    JSON.stringify({ ok: silentWouldLeak.ok }));
  selfTest('D1', 'paramApplicability', (v) => Array.isArray((v as { supportedFilters?: unknown }).supportedFilters) && (v as { supportedFilters: unknown[] }).supportedFilters.length > 0,
    { reason: 'PARAM_NOT_APPLICABLE', supportedFilters: [] }, '把「supportedFilters = []」喂入「非空能力面」谓词 ⇒ 必须转红（去能力面闸会被抓）');
}

// ============================================================================
// E · keyset 形态（`ORDER BY <timeColumn> DESC, <pk> DESC` + 双键游标 + `limit+1`）
// ============================================================================
const planOf = (table: string, query: Record<string, unknown> = {}) => {
  const r = parseAuditRequest(table, query);
  if (!r.ok) throw new Error(`plan failed: ${table} ${JSON.stringify(query)} ${JSON.stringify(r.err.details)}`);
  return r.plan;
};
{
  const ops = planOf('admin_ops_audit_log');
  const sqlOps = buildAuditSql(ops);
  t('E1', 'keysetShape', /ORDER BY time_created DESC, log_id DESC LIMIT \$\d+::int/.test(sqlOps.text),
    '默认排序 = `ORDER BY time_created DESC, log_id DESC`（13 面 `time_created`）', sqlOps.text.slice(sqlOps.text.indexOf('ORDER BY')));
  t('E2', 'keysetShape', sqlOps.params[sqlOps.params.length - 1] === AUDIT_LIMIT_DEFAULT + 1,
    '`LIMIT = limit + 1`（判定下一页 · keyset 拉一探）', JSON.stringify({ last: sqlOps.params[sqlOps.params.length - 1] }));
  const withCursor = buildAuditSql(planOf('admin_ops_audit_log', { cursor: Buffer.from(JSON.stringify({ t: '2026-01-01T00:00:00.000Z', pk: '5' }), 'utf8').toString('base64url') }));
  t('E3', 'keysetShape', /\(time_created, log_id\) < \(\$\d+::timestamptz, \$\d+::bigint\)/.test(withCursor.text),
    '游标子句 = **keyset 双键** `(time_created, log_id) < (:t, :pk)`（不透明 base64url 游标）', withCursor.text.slice(withCursor.text.indexOf('WHERE')));
  t('E4', 'keysetShape', /^SELECT \* FROM public\.admin_ops_audit_log/.test(sqlOps.text) && !/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b/i.test(sqlOps.text),
    '★ 生成语句**只读**：`SELECT * FROM public.<白名单表>` · 零写动词（§32.10）', sqlOps.text.slice(0, 60));
  const badCursor = parseAuditRequest('admin_ops_audit_log', { cursor: 'not-a-cursor' });
  t('E5', 'keysetShape', badCursor.ok === false && badCursor.err.status === 400 && (badCursor.err.details as { reason?: string }).reason === 'CURSOR_INVALID',
    '非法游标 ⇒ `400 CURSOR_INVALID`（游标不透明化）', JSON.stringify(badCursor.ok ? {} : badCursor.err.details));
  selfTest('E1', 'keysetShape', (v) => /ORDER BY time_created DESC, log_id DESC/.test(String(v)), 'SELECT * FROM t ORDER BY time_created ASC', '把 `ASC` 排序喂入「`DESC` keyset」谓词 ⇒ 必须转红');
}

// ============================================================================
// F · limit 默认 50 / 上限 100
// ============================================================================
{
  t('F1', 'limit', AUDIT_LIMIT_DEFAULT === 50 && AUDIT_LIMIT_MAX === 100, '常量 = 默认 50 / 上限 100（`R-9-79`）', JSON.stringify({ def: AUDIT_LIMIT_DEFAULT, max: AUDIT_LIMIT_MAX }));
  t('F2', 'limit', planOf('ledger_entry').limit === 50, '缺省 `limit` ⇒ **50**', planOf('ledger_entry').limit);
  t('F3', 'limit', planOf('ledger_entry', { limit: '100' }).limit === 100, '`limit=100`（上限）⇒ 放行', planOf('ledger_entry', { limit: '100' }).limit);
  const over = parseAuditRequest('ledger_entry', { limit: '101' });
  const zero = parseAuditRequest('ledger_entry', { limit: '0' });
  const nan = parseAuditRequest('ledger_entry', { limit: 'abc' });
  const bad = [over, zero, nan].map((r) => ({ ok: r.ok, status: r.ok ? null : r.err.status, reason: r.ok ? null : (r.err.details as { reason?: string }).reason }));
  t('F4', 'limit', bad.every((x) => x.ok === false && x.status === 400 && x.reason === 'LIMIT_OUT_OF_RANGE'),
    '`limit > 100` / `limit < 1` / 非整数 ⇒ `400 LIMIT_OUT_OF_RANGE`', JSON.stringify(bad));
  selfTest('F2', 'limit', (v) => (v as { limit: number }).limit === 50, { limit: 51 }, '把 `limit=51` 喂入「默认 50」谓词 ⇒ 必须转红');
}

// ============================================================================
// G · 逐表排序键（13 面 time_created；★ referral ⇒ bound_at）
// ============================================================================
{
  const perTable: Record<string, string> = {};
  for (const f of FACE_ORDER) {
    const sql = buildAuditSql(planOf(f)).text;
    const m = sql.match(/ORDER BY ([a-z_]+) DESC, ([a-z_]+) DESC/);
    perTable[f] = m ? `${m[1]},${m[2]}` : '(none)';
  }
  const expRef = 'bound_at,child_uid';
  t('G1', 'sortKey', perTable.referral === expRef, '★ 唯一无 `time_created` 面 `referral` ⇒ 排序键 `(bound_at DESC, child_uid DESC)`', perTable.referral);
  const nonRef = FACE_ORDER.filter((f) => f !== 'referral');
  t('G2', 'sortKey', nonRef.every((f) => perTable[f].startsWith('time_created,')),
    '其余 **13 面** 主排序键 = `time_created`', JSON.stringify(nonRef.filter((f) => !perTable[f].startsWith('time_created,'))));
  t('G3', 'sortKey', FACE_ORDER.every((f) => AUDIT_TABLES[f].pk.length > 0),
    '逐表副键 `<pk> DESC` 逐表非空（log_id / txid / rating_id / event_id / child_uid / policy_id）', JSON.stringify(Object.fromEntries(FACE_ORDER.map((f) => [f, AUDIT_TABLES[f].pk]))));
  selfTest('G1', 'sortKey', (v) => String(v) === expRef, 'time_created,bound_at', '把 `referral` 排序键写成 `time_created` 喂入谓词 ⇒ 必须转红');
}

// ============================================================================
// H · 零新增码（借 LEDGER_AMOUNT_INVALID ∈ 33）+ 原因码常量集 7 值（非错误码）
// ============================================================================
{
  t('H1', 'closedSets', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（**不动**）', LEDGER_ERROR_CODES.length);
  const borrowOk = (LEDGER_ERROR_CODES as readonly string[]).includes('LEDGER_AMOUNT_INVALID');
  const reasons = ['made_up_table', 'app_config'].map((x) => { const r = parseAuditRequest(x, {}); return r.ok ? null : r.err.code; });
  t('H2', 'closedSets', borrowOk && reasons.every((c) => c === 'LEDGER_AMOUNT_INVALID'),
    '★ 一切读口 `400` 借既有 `LEDGER_AMOUNT_INVALID`（∈ 33 闭集 ⇒ **零新增码**）', JSON.stringify({ inClosedSet: borrowOk, borrowed: reasons }));
  t('H3', 'reasonCodes', POINTS_ADJUST_REASONS.length === 7,
    '原因码常量集 = 恰 **7 值**（`R-9-76` C3③ · 语义域 **非错误码**）', POINTS_ADJUST_REASONS.length);
  const expected7 = ['MANUAL_CORRECTION', 'CUSTOMER_COMPENSATION', 'PROMOTION_BONUS', 'PENALTY_DEDUCTION', 'BUG_COMPENSATION', 'MIGRATION_ADJUSTMENT', 'OTHER'];
  t('H4', 'reasonCodes', eqJson([...POINTS_ADJUST_REASONS].sort(), [...expected7].sort()), `原因码 7 值逐字 = ${JSON.stringify(expected7)}`, JSON.stringify(POINTS_ADJUST_REASONS));
  t('H5', 'reasonCodes', isPointsAdjustReason('MANUAL_CORRECTION') === true && isPointsAdjustReason('bogus') === false && isPointsAdjustReason('') === false && isPointsAdjustReason(null) === false,
    '`isPointsAdjustReason` 判据：合法码 true / 集合外 / 空 / null ⇒ false（大小写敏感）', JSON.stringify({ ok: isPointsAdjustReason('MANUAL_CORRECTION'), bogus: isPointsAdjustReason('bogus'), empty: isPointsAdjustReason('') }));
  // 原因码 ≠ 错误码：7 值均不在 33 闭集内（防误把原因码当错误码新增）
  const noOverlap = POINTS_ADJUST_REASONS.every((r) => !(LEDGER_ERROR_CODES as readonly string[]).includes(r));
  t('H6', 'reasonCodes', noOverlap, '原因码 7 值**均不在**错误码闭集内（防以原因码冒充新错误码）', noOverlap);
  selfTest('H1', 'closedSets', (v) => (v as string[]).length === 33, [...LEDGER_ERROR_CODES, 'LEDGER_MADEUP_CODE'], '把 34 条闭集喂入 ⇒ 必须转红');
  selfTest('H3', 'reasonCodes', (v) => (v as string[]).length === 7, [...expected7, 'EXTRA'], '把 8 值原因码集喂入 ⇒ 必须转红');
}

// ============================================================================
// I · 鉴权 `manage_audit` + 路由在场 + 只读 + 注册点 88
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('I1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN, `注册点 = ${REG_POINTS_FROZEN}（8⑥ 审计台统一读口 +1〔87→88〕）`, countRoutes(INDEX_TS));
  t('I2', 'registration', eqJson(perVerb, PER_VERB_FROZEN), `逐 verb 逐字 = ${JSON.stringify(PER_VERB_FROZEN)}`, JSON.stringify(perVerb));
  t('I3', 'registration', countOf(INDEX_TS, /^[ \t]*app\.get\('\/api\/admin\/audit\/:table',/gm) === 1,
    '读口 `GET /api/admin/audit/:table` 注册**恰 1 处**（变体 Ⅰ · `R-9-74`）', countOf(INDEX_TS, /\/api\/admin\/audit\/:table/g));
  const INJ = "  app.get('/api/p8s11-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  t('I4', 'registration', countRoutes(INDEX_TS + INJ) === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`, JSON.stringify({ injected: countRoutes(INDEX_TS + INJ) }));
  t('I5', 'auth', /requireAdmin\(req,\s*res,\s*'manage_audit'\)/.test(AUDIT_ROUTE_BLOCK),
    "闸 = `requireAdmin(req, res, 'manage_audit')`（`R-9-75` 新增键 · 闭集 11→12）", JSON.stringify((AUDIT_ROUTE_BLOCK.match(/requireAdmin\([^)]*\)/) || ['(none)'])[0]));
  t('I6', 'auth', /parseAuditRequest\(/.test(AUDIT_ROUTE_BLOCK) && /buildAuditSql\(/.test(AUDIT_ROUTE_BLOCK) && /readAuditPage\(/.test(AUDIT_ROUTE_BLOCK) && /sendVerbError\(/.test(AUDIT_ROUTE_BLOCK),
    'handler 接线 = `parseAuditRequest` → `buildAuditSql` → `DatabaseService.readAuditPage` → `sendSuccess` / `sendVerbError`',
    JSON.stringify({ parse: /parseAuditRequest\(/.test(AUDIT_ROUTE_BLOCK), sql: /buildAuditSql\(/.test(AUDIT_ROUTE_BLOCK), read: /readAuditPage\(/.test(AUDIT_ROUTE_BLOCK), err: /sendVerbError\(/.test(AUDIT_ROUTE_BLOCK) }));
  t('I7', 'readonly', !/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/.test(AUDIT_ROUTE_BLOCK),
    '★ handler **只读**：零写动词（不动任何 append-only 面 · §32.10）', JSON.stringify((AUDIT_ROUTE_BLOCK.match(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/gi) || [])) );
  t('I8', 'readonly', /static async readAuditPage\(/.test(DATABASE_TS) && /runSql/.test(DATABASE_TS.slice(DATABASE_TS.indexOf('readAuditPage'), DATABASE_TS.indexOf('readAuditPage') + 600)),
    '取数口 = `DatabaseService.readAuditPage(text, params)`（唯一取数口 · 不自拼 SQL）', JSON.stringify({ has: /static async readAuditPage\(/.test(DATABASE_TS) }));
  const authClosed = /const ALL_ADMIN_PERMISSIONS = \[[\s\S]*?'manage_audit'[\s\S]*?\] as const;/.test(DATABASE_TS)
    && /permissions:\s*\[[\s\S]*?'manage_audit'[\s\S]*?\]/.test(ADMIN_UTILS);
  t('I9', 'auth', authClosed, '权限键 `manage_audit` 三处编码同集（后端 `ALL_ADMIN_PERMISSIONS` ∧ 前端 `admin-utils.js` 兜底）', authClosed);
  selfTest('I1', 'registration', (v) => countRoutes(String(v)) === REG_POINTS_FROZEN, 'x', '把非 88 条路由的文本喂入「注册点 = 88」谓词 ⇒ 必须转红');
}

// ============================================================================
// J · 迁移 0039 纯 DML（零 DDL）+ audit-console.ts 零写 SQL
// ============================================================================
{
  const ddl = MIG_0039_CODE.match(/\b(CREATE|ALTER|DROP|TRUNCATE)\b/gi) || [];
  t('J1', 'mig0039', ddl.length === 0, '★ `0039` = **纯 DML 种子**（代码面零 `CREATE`/`ALTER`/`DROP`/`TRUNCATE`）', JSON.stringify(ddl));
  t('J2', 'mig0039', /INSERT INTO public\.admin_permission \(permission_key, name\) VALUES\s*\n\s*\('manage_audit', '审计台查看'\)\s*\nON CONFLICT \(permission_key\) DO NOTHING;/.test(MIG_0039)
    && /INSERT INTO public\.admin_role_permission \(role_key, permission_key\) VALUES\s*\n\s*\('super_admin', 'manage_audit'\)\s*\nON CONFLICT \(role_key, permission_key\) DO NOTHING;/.test(MIG_0039),
    '`0039` 两处种子：`admin_permission +1`（`manage_audit`）∧ `admin_role_permission`（`super_admin` × `manage_audit`）（`ON CONFLICT DO NOTHING` 幂等）',
    JSON.stringify({ ap: /admin_permission \(permission_key, name\)/.test(MIG_0039), rp: /admin_role_permission \(role_key, permission_key\)/.test(MIG_0039) }));
  t('J3', 'mig0039', !/^[ \t]*BEGIN[ \t]*;/m.test(MIG_0039_CODE) && !/^[ \t]*COMMIT[ \t]*;/m.test(MIG_0039_CODE),
    '`0039` 代码面**无事务控制语句** `BEGIN;`/`COMMIT;`（`DO $$ … BEGIN … END $$;` 的 PL/pgSQL 块体非事务 · 迁移器单事务包裹）',
    JSON.stringify({ stmtBegin: /^[ \t]*BEGIN[ \t]*;/m.test(MIG_0039_CODE), stmtCommit: /^[ \t]*COMMIT[ \t]*;/m.test(MIG_0039_CODE), hasDoBlock: /DO \$\$/.test(MIG_0039_CODE) }));
  t('J4', 'readonly', !/\b(INSERT|UPDATE|DELETE)\s+(INTO\s+)?public\./.test(AUDIT_CONSOLE_TS),
    '★ `audit-console.ts` 零写 SQL（无 `INSERT/UPDATE/DELETE public.*`）', JSON.stringify((AUDIT_CONSOLE_TS.match(/\b(INSERT|UPDATE|DELETE)\s+(INTO\s+)?public\./gi) || [])));
  t('J5', 'readonly', /export const AUDIT_TABLES: Readonly<Record<string, AuditColumnMap>>/.test(AUDIT_CONSOLE_TS)
    && /const audit400 = .*\n?\s*adminVerbError\(400, 'LEDGER_AMOUNT_INVALID'/.test(AUDIT_CONSOLE_TS),
    '白名单 = **结构化常量表** `AUDIT_TABLES`（禁拼 SQL 字符串）+ 失配统一借既有码', JSON.stringify({ struct: /AUDIT_TABLES: Readonly/.test(AUDIT_CONSOLE_TS) }));
  selfTest('J1', 'mig0039', (v) => !/\b(CREATE|ALTER|DROP|TRUNCATE)\b/i.test(String(v)), 'CREATE TABLE x();', '把含 `CREATE TABLE` 的迁移文本喂入「零 DDL」谓词 ⇒ 必须转红');
}

// ============================================================================
// I' · 前端页面接线（14 面切换 + 五类过滤 + keyset 分页 + 路由 `manage_audit` + adminNav）
// ============================================================================
const LANGS = ['zh', 'en', 'hk', 'vn'];
const LOCALES: Record<string, Record<string, unknown>> = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readSrc(`frontend/src/locales/${l}.json`))]),
);
const PAGE = readSrc('frontend/src/pages/admin/AuditConsolePage.jsx');
/** 去 `/** *\/` 与 `//` 注释后的页面代码面（W6 只读判据须剔除注释里被引用的词）。 */
const PAGE_CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const APP_JSX = readSrc('frontend/src/App.jsx');
const ADMIN_LAYOUT = readSrc('frontend/src/components/layout/AdminLayout.jsx');
{
  t('W1', 'pageWire', /export default AuditConsolePage/.test(PAGE) && /\/api\/admin\/audit\//.test(PAGE) && /data-audit-table=/.test(PAGE),
    '页面存在 + 调读口 `/api/admin/audit/<table>` + 机读标识 `data-audit-table`（§32.8 例外）',
    JSON.stringify({ exp: /export default AuditConsolePage/.test(PAGE), api: /\/api\/admin\/audit\//.test(PAGE) }));
  const pageIds = (PAGE.match(/\{ id: '([a-z_]+)', filters:/g) || []).map((s) => s.replace(/\{ id: '|', filters:/g, ''));
  t('W2', 'pageWire', eqJson(pageIds, FACE_ORDER), '页面表清单 = 14 面逐字逐序（与后端白名单同源）', JSON.stringify(pageIds));
  // 逐表过滤维度对拍（页面 ↔ 后端 `supportedFiltersOf`）——防两处漂移
  const drift: string[] = [];
  for (const f of FACE_ORDER) {
    const m = PAGE.match(new RegExp(`\\{ id: '${f}', filters: \\[([^\\]]*)\\]`));
    const pageFilters = m ? (m[1].match(/'([A-Za-z]+)'/g) || []).map((s) => s.replace(/'/g, '')) : [];
    if (!eqJson(pageFilters, supportedFiltersOf(AUDIT_TABLES[f]))) drift.push(f);
  }
  t('W3', 'pageWire', drift.length === 0, '★ 页面逐表过滤维度 == 后端 `supportedFiltersOf`（逐表相等 · 防漂移）', JSON.stringify({ drift }));
  t('W4', 'pageWire', /path="audit-console"/.test(APP_JSX) && /<ProtectedRoute adminOnly=\{true\} requiredPermission="manage_audit"><AuditConsolePage \/>/.test(APP_JSX),
    '路由 = `dashboard/audit-console`（`ProtectedRoute` 闸 = `manage_audit` · 值随 `R-9-75`）', JSON.stringify({ route: /path="audit-console"/.test(APP_JSX) }));
  t('W5', 'pageWire', /t\('adminNav\.auditConsole'\)/.test(ADMIN_LAYOUT) && /t\('adminNav\.auditConsoleDesc'\)/.test(ADMIN_LAYOUT) && /path: '\/dashboard\/audit-console'/.test(ADMIN_LAYOUT) && /requiredPermission: 'manage_audit'/.test(ADMIN_LAYOUT),
    '`adminNav` 增项 `auditConsole` + `auditConsoleDesc`（path `/dashboard/audit-console` · 权限 `manage_audit`）',
    JSON.stringify({ title: /adminNav\.auditConsole'/.test(ADMIN_LAYOUT), perm: /requiredPermission: 'manage_audit'/.test(ADMIN_LAYOUT) }));
  t('W6', 'pageWire', !/method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]DELETE['"]|导出|export\s+const|download/i.test(PAGE_CODE),
    '★ 页面**只读**：无写按钮 / 无导出按钮（§32.9 X1/X2）', JSON.stringify((PAGE.match(/method:\s*['"](POST|PUT|DELETE)['"]|导出|download/gi) || [])));
  selfTest('W2', 'pageWire', (v) => eqJson(v, FACE_ORDER), [...FACE_ORDER, 'app_config'], '把「15 面（含 app_config）」喂入页面表清单谓词 ⇒ 必须转红');
}

// ============================================================================
// I'' · 四语 `auditConsole` 命名空间 + `adminNav.auditConsole*` + 六类泄漏 0
// ============================================================================
{
  const nsKeys = (l: string): string[] => Object.keys((LOCALES[l].auditConsole || {}) as Record<string, unknown>).sort();
  const all33 = LANGS.every((l) => nsKeys(l).length === 33);
  const sameSet = LANGS.every((l) => eqJson(nsKeys(l), nsKeys('zh')));
  t('L1', 'i18n', all33 && sameSet, '`auditConsole` 命名空间四语齐备 · 各 **33 键** · 键集逐语相等', JSON.stringify(Object.fromEntries(LANGS.map((l) => [l, nsKeys(l).length]))));
  const navOk = LANGS.every((l) => typeof (LOCALES[l].adminNav as Record<string, unknown>).auditConsole === 'string' && typeof (LOCALES[l].adminNav as Record<string, unknown>).auditConsoleDesc === 'string');
  t('L2', 'i18n', navOk, '`adminNav.auditConsole` + `adminNav.auditConsoleDesc` 四语齐备（+2 键 / 语）', JSON.stringify(LANGS.map((l) => Object.keys(LOCALES[l].adminNav as object).length)));
  const CJK = /[\u3400-\u9fff]/;
  const cjkHits: string[] = [];
  for (const l of ['en', 'vn']) {
    const ns = LOCALES[l].auditConsole as Record<string, string>;
    for (const [k, v] of Object.entries(ns)) if (CJK.test(v)) cjkHits.push(`${l}.auditConsole.${k}`);
    for (const k of ['auditConsole', 'auditConsoleDesc']) if (CJK.test(String((LOCALES[l].adminNav as Record<string, string>)[k]))) cjkHits.push(`${l}.adminNav.${k}`);
  }
  t('L3', 'i18n', cjkHits.length === 0, '★ `en`/`vn` 新增键**零 CJK 表意文字**（直译）', JSON.stringify(cjkHits));
  // ★ 六类禁漏：§32.8(c) ①章节号 ②HTTP 状态码 ③接口路径/方法 ④内部批次名/单号 ⑤机读码/裸 i18n 键 ⑥表名/列名/函数名
  const COLS = ['time_created', 'time_updated', 'bound_at', 'actor_uid', 'target_uid', 'rater_uid', 'ratee_uid', 'created_by', 'updated_by', 'log_id', 'txid', 'rating_id', 'event_id', 'child_uid', 'parent_uid', 'policy_id', 'ref_id', 'order_id', 'listing_id', 'job_id', 'cid'];
  const LEAK: Array<[string, RegExp]> = [
    ['①章节号', /§/],
    ['②HTTP 状态码', /\b(400|401|402|403|404|405|409|410|418|422|429|500|502|503|504)\b/],
    ['③接口路径/方法', /\/api\/|\b(GET|POST|PUT|PATCH|DELETE)\s+\//],
    ['④内部批次名/单号', /R-9-\d|PZ-\d|批\s*8|8[①-⑥]/],
    ['⑤机读码/裸键', /\b[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*\b|\b[A-Z][A-Z0-9_]{3,}\b/],
    ['⑥表/列/函数名', new RegExp(`\\b(${FACE_ORDER.join('|')}|${COLS.join('|')})\\b`)],
  ];
  const scanLeak = (v: string): string[] => LEAK.filter(([, re]) => re.test(v)).map(([n]) => n);
  const newValues: Array<{ k: string; l: string; v: string }> = [];
  for (const l of LANGS) {
    for (const [k, v] of Object.entries(LOCALES[l].auditConsole as Record<string, string>)) newValues.push({ k: `auditConsole.${k}`, l, v });
    for (const k of ['auditConsole', 'auditConsoleDesc']) newValues.push({ k: `adminNav.${k}`, l, v: String((LOCALES[l].adminNav as Record<string, string>)[k]) });
  }
  const leakHits = newValues.filter((x) => scanLeak(x.v).length > 0).map((x) => `${x.l}.${x.k} [${scanLeak(x.v).join(',')}] ${x.v}`);
  t('L4', 'i18nLeak', leakHits.length === 0, '★ 六类禁漏：新增用户可见文案（`auditConsole*` + `adminNav.auditConsole*`）逐值扫描 = **0 命中**', JSON.stringify(leakHits.slice(0, 8)));
  t('L5', 'i18nLeak', newValues.every((x) => x.v.trim().length > 0), '新增键四语值均非空串', JSON.stringify(newValues.filter((x) => !x.v.trim()).map((x) => `${x.l}.${x.k}`)));
  const scopeN = newValues.length;
  t('L6', 'i18nLeak', scopeN === (33 + 2) * 4, '扫描作用域节点数 = (33 + 2) × 4 = 140（作用域非异常小 ⇒ 断言有效）', scopeN);
  // 负对照：注入「§32.3」/「ledger_entry」/「GET /api/x」/「400」⇒ 扫描必须转红
  const injected = ['审计（§32.3）', 'ledger_entry', 'GET /api/admin/audit', '错误 400', 'auditConsole.pageTitle', 'MANAGE_AUDIT'];
  const injectedHits = injected.map((s) => scanLeak(s).length);
  t('L7', 'i18nLeak', injectedHits.every((n) => n > 0),
    '★ 负对照：注入六类样本（§章节号 / 表名 / 接口路径 / 状态码 / 裸键 / 机读码）⇒ 扫描**逐条转红**（不转红 = 假门）',
    JSON.stringify({ injected: injected.map((s, i) => [s, injectedHits[i]]) }));
  selfTest('L4', 'i18nLeak', (v) => scanLeak(String(v)).length === 0, '审计 §32.3 ledger_entry', '把「§32.3 + ledger_entry」喂入六类扫描谓词 ⇒ 必须转红');
  selfTest('L7', 'i18nLeak', (v) => scanLeak(String(v)).length > 0, '审计台查看', '把「干净文案」喂入「必命中」谓词 ⇒ 必须不命中（判据方向自证）');
}

// ============================================================================
// K · 库面 leg 转真 checks（连库 + HTTP · 事务内 ROLLBACK · pending_apply[] = 0）
// ============================================================================
const pendingApply: Array<{ leg: string; reason: string }> = [];
const strOf = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

(async () => {
  let dbConnections = 0;
  let httpCalls = 0;
  const kg = (id: string, pass: boolean, expect: unknown, actual: unknown): void =>
    checks.push({ id, group: 'dbLive', pass: Boolean(pass), expect: String(expect), actual: String(actual) });
  const live: Record<string, unknown> = {};

  try {
    // ---------------- K1–K4 · 结构面活体（只读） ----------------
    const sm = (await readQuery<{ n: string; mx: string | null }>(
      `SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`))[0];
    dbConnections += 1;
    kg('K1', Number(sm.n) === 40 && String(sm.mx) === '0041',
      '★ `schema_migration` = **40 行** · `max(version)` = **0041**（`0041` 已 apply）', JSON.stringify(sm));
    const ap = (await readQuery<{ n: string; has: boolean }>(
      `SELECT count(*)::int AS n, bool_or(permission_key='manage_audit') AS has FROM public.admin_permission`))[0];
    kg('K2', Number(ap.n) === 12 && ap.has === true,
      '★ 活体 `admin_permission` = **12 行** · 含 `manage_audit`（闭集 11→12 · `R-9-75`）', JSON.stringify(ap));
    const sa = (await readQuery<{ n: string; has: boolean }>(
      `SELECT count(*)::int AS n, bool_or(permission_key='manage_audit') AS has FROM public.admin_role_permission WHERE role_key='super_admin'`))[0];
    kg('K3', Number(sa.n) === 12 && sa.has === true,
      '★ 活体 `super_admin` 权限 = **12** · 含 `manage_audit`（新增键默认同给）', JSON.stringify(sa));
    const bt = (await readQuery<{ n: string }>(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`))[0];
    kg('K4', Number(bt.n) === 34, '★ 基表仍 **34**（`0039` 零 DDL · 零新对象）', JSON.stringify(bt));

    // K5 · 14 面 append-only 触发器在场（只读目录）
    const ao = await readQuery<{ n: string }>(
      `SELECT count(DISTINCT c.relname)::int AS n
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_trigger tg ON tg.tgrelid = c.oid AND NOT tg.tgisinternal
        WHERE n.nspname = 'public' AND c.relname = ANY($1)
          AND (tg.tgtype & 27) = 27 AND tg.tgenabled = 'O'`, [FACE_ORDER]);
    kg('K5', Number(ao[0].n) === 14, '★ 14 面 **append-only** 触发器（`tgtype&27=27` · `tgenabled=O`）逐面在场（§32.10 兜底）', JSON.stringify(ao[0]));

    // ---------------- K6 · 14 面逐表只读真取数（生产同一取数口） ----------------
    const tableReads: Record<string, unknown> = {};
    let allOk = true;
    for (const f of FACE_ORDER) {
      const p = planOf(f);
      const { text, params } = buildAuditSql(p);
      try {
        const rows = await DatabaseService.readAuditPage(text, params);
        const view = buildAuditView(p, rows) as { rows: unknown[]; nextCursor: string | null };
        if (!Array.isArray(view.rows)) allOk = false;
        tableReads[f] = { ok: true, raw: rows.length, page: view.rows.length, has_next: view.nextCursor !== null };
      } catch (e) { allOk = false; tableReads[f] = { ok: false, err: strOf((e as Error).message).slice(0, 120) }; }
    }
    dbConnections += 1;
    live.table_reads = tableReads;
    kg('K6', allOk, '★ 14 面逐表只读真取数（默认 `limit=50`）14/14 `ok`（零执行异常）', JSON.stringify(tableReads));

    // ---------------- K7 · keyset 分页（ledger_entry 两页无重叠 + 降序） ----------------
    const p1 = planOf('ledger_entry', { limit: '5' });
    const r1 = await DatabaseService.readAuditPage(buildAuditSql(p1).text, buildAuditSql(p1).params);
    const v1 = buildAuditView(p1, r1) as { rows: Array<Record<string, unknown>>; nextCursor: string | null };
    const txids1 = v1.rows.map((r) => Number(r.txid));
    let txids2: number[] = [];
    if (v1.nextCursor) {
      const p2 = planOf('ledger_entry', { limit: '5', cursor: v1.nextCursor });
      const r2 = await DatabaseService.readAuditPage(buildAuditSql(p2).text, buildAuditSql(p2).params);
      txids2 = (buildAuditView(p2, r2) as { rows: Array<Record<string, unknown>> }).rows.map((r) => Number(r.txid));
    }
    dbConnections += 1;
    const overlap = txids1.filter((x) => txids2.includes(x));
    const desc = txids1.every((v, i) => i === 0 || txids1[i - 1] > v);
    live.pagination = { page1: txids1, page2: txids2, overlap, desc };
    kg('K7', txids1.length === 5 && txids2.length === 5 && overlap.length === 0 && desc,
      '★ keyset 分页：第 1 页 5 行 / 第 2 页 5 行 · **零重叠** · 降序', JSON.stringify(live.pagination));

    // ---------------- K8 · 过滤正读（非假过滤） ----------------
    const pOps = planOf('admin_ops_audit_log', { action: 'points_adjust' });
    const rOps = await DatabaseService.readAuditPage(buildAuditSql(pOps).text, buildAuditSql(pOps).params);
    const opsRows = buildAuditView(pOps, rOps) as { rows: unknown[] };
    const pNone = planOf('admin_ops_audit_log', { action: '__none__' });
    const rNone = await DatabaseService.readAuditPage(buildAuditSql(pNone).text, buildAuditSql(pNone).params);
    const noneRows = buildAuditView(pNone, rNone) as { rows: unknown[] };
    dbConnections += 1;
    live.filter_positive = { points_adjust: opsRows.rows.length, none: noneRows.rows.length };
    kg('K8', opsRows.rows.length === 5 && noneRows.rows.length === 0,
      '★ 过滤正读：`action=points_adjust` ⇒ **5 行**（历史 5 行 · 非假过滤）；`action=__none__` ⇒ **0 行**', JSON.stringify(live.filter_positive));

    // ---------------- K9 · 原因码切换点在场（历史 5 行自由文本不回填） ----------------
    const opsMemo = await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.admin_ops_audit_log`);
    dbConnections += 1;
    const wired = /isPointsAdjustReason\(/.test(INDEX_TS) && /REASON_CODE_NOT_IN_ENUM/.test(INDEX_TS);
    kg('K9', Number(opsMemo[0].n) === 5 && wired,
      '★ 原因码切换点接线（`index.ts` 调 `isPointsAdjustReason` · reason `REASON_CODE_NOT_IN_ENUM`）+ `admin_ops_audit_log` 历史 **5 行**（不回填 · `R-9-76`；含 2026-10-03 一次真实运营发放 `points_adjust`）',
      JSON.stringify({ rows: opsMemo[0].n, wired }));

    // ---------------- K10 · 受控实例真 HTTP ----------------
    const HTTP_BASE = process.env.P8S11_BASE || 'http://127.0.0.1:5797';
    // 取活体持 `manage_audit` 的管理员 uid（token 须指向**已提交**用户）
    const holder = await readQuery<{ uid: string }>(
      `SELECT ur.uid::text AS uid FROM public.admin_user_role ur
         JOIN public.admin_role_permission rp ON rp.role_key = ur.role_key
        WHERE rp.permission_key = 'manage_audit' ORDER BY ur.uid LIMIT 1`);
    dbConnections += 1;
    const ownerUid = holder[0] ? Number(holder[0].uid) : 0;
    const token = ownerUid ? createSessionToken({ uID: ownerUid, evm: '' }) : '';
    let httpErr: string | null = null;
    const status = async (url: string, withTok: boolean): Promise<{ s: number; body: Record<string, unknown> }> => {
      const res = await fetch(url, withTok ? { headers: { authorization: `Bearer ${token}` } } : undefined);
      httpCalls += 1;
      let body: Record<string, unknown> = {};
      try { body = (await res.json()) as Record<string, unknown>; } catch { /* noop */ }
      return { s: res.status, body };
    };
    let noTok = -1; let okPage = -1; let cfg = -1; let cfgReason = ''; let inapp = -1; let inappSup: unknown = null; let over = -1; let nope = -1;
    try {
      noTok = (await status(`${HTTP_BASE}/api/admin/audit/ledger_entry`, false)).s;
      const ok = await status(`${HTTP_BASE}/api/admin/audit/ledger_entry?limit=2`, true); okPage = ok.s;
      const c = await status(`${HTTP_BASE}/api/admin/audit/app_config`, true); cfg = c.s;
      cfgReason = strOf(((c.body as { error?: { details?: { reason?: string } } }).error?.details?.reason));
      const ia = await status(`${HTTP_BASE}/api/admin/audit/ledger_entry?actor=1`, true); inapp = ia.s;
      inappSup = (ia.body as { error?: { details?: { supportedFilters?: unknown } } }).error?.details?.supportedFilters ?? null;
      over = (await status(`${HTTP_BASE}/api/admin/audit/ledger_entry?limit=101`, true)).s;
      nope = (await status(`${HTTP_BASE}/api/admin/audit/made_up_table`, true)).s;
    } catch (e) { httpErr = strOf((e as Error).message || e).slice(0, 120); }
    live.http = { no_tok: noTok, ok_page: okPage, app_config: cfg, cfg_reason: cfgReason, inapplicable: inapp, supported: inappSup, over: over, nope: nope, err: httpErr };
    kg('K10', httpErr === null && noTok === 401 && okPage === 200 && cfg === 400 && cfgReason === 'AUDIT_TABLE_NOT_FOUND' && inapp === 400 && Array.isArray(inappSup) && over === 400 && nope === 400,
      '★ 受控实例真 HTTP：无 token ⇒ **401**；持 `manage_audit` ⇒ `200`；`app_config` ⇒ `400 AUDIT_TABLE_NOT_FOUND`；不适用参数 ⇒ `400`（+ supportedFilters）；`limit=101` ⇒ `400`；非白名单 ⇒ `400`',
      JSON.stringify(live.http));

    live.db_connections = dbConnections;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    kg('K-FATAL', false, '库面 leg 无异常', JSON.stringify({ code: strOf(err.code), message: strOf(err.message).slice(0, 200) }));
  }

  // ---------------- 结论 ----------------
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S11-AUDIT-CONSOLE-GATE',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: false,
    db_connections: dbConnections,
    http_calls: httpCalls,
    note: 'A–J 静态面零 DB / 零 HTTP；K 库面 leg **连库 + 受控实例**（只读 + 目录断言 · `pending_apply[]` = 0）。',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    pending_apply: pendingApply,
    readings: {
      registration_points_total: countRoutes(INDEX_TS),
      registration_points_per_verb: PER_VERB_FROZEN,
      whitelist_faces: AUDIT_TABLE_NAMES.length,
      whitelist: AUDIT_TABLE_NAMES,
      limit_default: AUDIT_LIMIT_DEFAULT,
      limit_max: AUDIT_LIMIT_MAX,
      error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
      reason_codes_count: POINTS_ADJUST_REASONS.length,
      reason_codes: POINTS_ADJUST_REASONS,
      live: live as unknown,
    },
    checks,
  };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} pending_apply=${pendingApply.length} db=${dbConnections} http=${httpCalls} artifact=${path.join(OUT_DIR, 'gate.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('P8S11_FATAL', String((e as Error)?.stack || e).slice(0, 800));
  await closePools().catch(() => undefined);
  process.exit(2);
});
