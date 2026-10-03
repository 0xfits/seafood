/**
 * 批 8④（`route-layer.spec` v2.8 §23 · `data-layer.spec` v0.15 §26）：
 * **自建单位审核闸（变体 Ⅱ = 旁路台账型）** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s4-currency-review-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s4-artifacts/p8s4-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）—— 同「离线 126/126」族。
 * **不依赖新表存在**（迁移 `0025` 只做文本断言，**不 apply**；四段真链路 = 待 Zang apply 后补跑）。
 *
 * 判据（每条**可判负**）：
 *   A  **注册点 71 + 两路由形状**：`GET /api/admin/currency` + `POST /api/admin/currency/:cid/review`，
 *      两条均 `requireAdmin(req,res,'review_tasks')`；负对照（缩进注入 ⇒ +1）
 *   B  **读口形状**：`data` 键集冻结（9 键）；`?status` 非法 ⇒ 400（不得静默回落）；只读
 *   C  **动作口形状**：`action` 闭集恰 2 值；`approve→approved` / `reject→rejected`；
 *      `ops:` 键 = `ops:<admin_uid>:currency_review:<cid>`（既有助手）
 *   D  **≥6 条非法入参判负**（cid 非数字 / cid<=0 / action 缺失 / action 非枚举 / reason 缺失 /
 *      reason 空白 / status 滤镜非法），且**零新增错误码**（33 码闭集）
 *   E  **驳回必须落台账（结构面）**：台账 insert 覆盖 rejected；驳回不写 `currency_status_log`；
 *      `actor_uid` = admin；`ON CONFLICT (idempotency_key, result)`
 *   F  **无退还 / 罚没 / delist 面**（`R-8-17`/`DL67`/`DL88`）：零 `hold_forfeit`/`hold_release`/
 *      `unfreeze(`/`listing_deposit_refund`；审核语句**零账本分录**；注册点仍 71
 *   G  **四语键齐 + 六类泄漏 = 0**：`adminCurrencyReview`（+ `adminNav` 2 键）四语齐、en/vn 无 CJK、
 *      hk 繁體；用户可见文案零章节号 / HTTP 码 / 接口路径 / 内部批次名 / 机读码裸键 / 表列函数名
 *   H  **迁移 `0025` 内容契约（§26.7）**：表名 / 8 列 / 5 约束 / 4 索引 / append-only / `time_created`；
 *      **不含** `time_updated`/`create_key`/`ledger_event_keys`；零 `ALTER`；零数据 DML
 *   I  **门自证（负对照）**：若干判据谓词喂错值 ⇒ **必须转红**（不转红 = 假门）
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CURRENCY_REVIEW_ACTIONS,
  CURRENCY_REVIEW_ACTION_TO_RESULT,
  CURRENCY_REVIEW_OPS_ACTION,
  CURRENCY_STATUS_VALUES,
  parseReviewInput,
  parseStatusFilter,
} from '../src/currency-review-service';
import { canonicalAdminOpsKey } from '../src/admin-service';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s4-artifacts', `p8s4-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, expect: string): void => {
  const fired = predicate(wrongInput) === false;
  checks.push({ id: `${id}__selftest`, group: `${group}SelfTest`, pass: fired, expect, actual: JSON.stringify({ wrong_input: wrongInput, judge_fired: fired }) });
};

// ---------------------------------------------------------------- 冻结常量
// ★ P9④ 冻结计数前推（沿 R-8-22）：注册点 85 → 87（BTTC 铸造/分解 2 新口 +2）。
const REG_POINTS_FROZEN = 87;
// ★ P9④ 冻结计数前推（沿 R-8-22）：迁移文件数 30 → 33（+0032 / +0033 / +0034）。
const MIGRATIONS_FROZEN = 33;
const REVIEW_NS_KEYS_FROZEN = 28;
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const ACTION_CODES_FROZEN = ['LEDGER_CURRENCY_NOT_FOUND', 'LEDGER_CURRENCY_INVALID_TRANSITION', 'LEDGER_AMOUNT_INVALID'];

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '').replace(/\/\/[^\n]*$/gm, '');

const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const SERVICE_TS = readSrc('backend-ts/src/currency-review-service.ts');
const SERVICE_CODE = stripComments(SERVICE_TS);
const MIGRATION_SQL = readSrc('backend-ts/migrations/0025_currency_review_log.sql');

/** `CURRENCY_REVIEW_POST_EVENT_SQL` 的语句体（`const … = \`` 起至闭合反引号）—— E4 只在审核语句内判，不咬上市语句。 */
const REVIEW_SQL = ((): string => {
  const s = DATABASE_TS.indexOf('const CURRENCY_REVIEW_POST_EVENT_SQL = `');
  if (s === -1) return '';
  const e = DATABASE_TS.indexOf('`;', s);
  return e === -1 ? DATABASE_TS.slice(s) : DATABASE_TS.slice(s, e);
})();

/** 迁移「结构面」文本：去 `--` 行注释 + 去单引号字面量 ⇒ 列/约束名断言只看结构，不误咬注释与自检串。 */
const sqlStructure = (text: string): string => text.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, "''");
const MIGRATION_STRUCT = sqlStructure(MIGRATION_SQL);

/** 审核语句的 `apply` CTE 是否被 `AND $3::text = 'approved'` 门控（= E4 判据）。 */
const reviewApplyGated = (sql: string): boolean =>
  /apply AS \(\s*UPDATE public\.currency AS c\s*SET status = 'listed',[\s\S]*?AND \$3::text = 'approved'/.test(sql);

/** `LIST_CURRENCY_WITH_DEPOSIT_SQL` 的语句体（`const … = \`` 起至闭合反引号）—— J 组只在上市语句内判。 */
const LIST_SQL = ((): string => {
  const s = DATABASE_TS.indexOf('const LIST_CURRENCY_WITH_DEPOSIT_SQL = `');
  if (s === -1) return '';
  const e = DATABASE_TS.indexOf('`;', s);
  return e === -1 ? DATABASE_TS.slice(s) : DATABASE_TS.slice(s, e);
})();

/**
 * 上市语句的 `apply` CTE 是否被 **8④ C2 审核闸** fail-closed 门控
 * （P9④ `R-9-39` 变体 Ⅱ：`AND ( EXISTS (SELECT 1 FROM public.currency_review_log … r.result = 'approved')
 *   OR c.is_platform_coin = true )` —— 既有审核闸**逐字仍在**，仅被包为 `AND ( EXISTS(…) OR 平台标记 )`）。
 * 谓词锚定「`apply` CTE 内」⇒ 只判 `draft→listed` 转移处的闸，不咬同期它处文本。
 */
const listApplyGated = (sql: string): boolean =>
  /apply AS \(\s*UPDATE public\.currency AS c[\s\S]*?AND \(\s*EXISTS \(\s*SELECT 1 FROM public\.currency_review_log[\s\S]*?r\.result = 'approved'[\s\S]*?\)\s*OR\s+c\.is_platform_coin = true\s*\)/.test(sql);

const LANGS = ['zh', 'en', 'hk', 'vn'];
const LOCALES: Record<string, Record<string, unknown>> = Object.fromEntries(LANGS.map((l) => [
  l, JSON.parse(readSrc(`frontend/src/locales/${l}.json`)),
]));
const NS_OF = (lang: string) => (LOCALES[lang].adminCurrencyReview || {}) as Record<string, string>;
const NAV_OF = (lang: string) => (LOCALES[lang].adminNav || {}) as Record<string, string>;

/** 提取 `app.<verb>(<path>', …` 起至下一个 `\n});` 的路由体（负号: 找不到 ⇒ ''）。 */
const routeBlock = (declRe: RegExp): string => {
  const m = declRe.exec(INDEX_TS);
  if (!m) return '';
  const end = INDEX_TS.indexOf('\n});', m.index);
  return end === -1 ? INDEX_TS.slice(m.index) : INDEX_TS.slice(m.index, end + 4);
};

// ============================================================================
// A · 注册点 71 + 两路由形状
// ============================================================================
const readRouteDecl = /^[ \t]*app\.get\('\/api\/admin\/currency',/m;
const actionRouteDecl = /^[ \t]*app\.post\('\/api\/admin\/currency\/:cid\/review',/m;
const readBlock = routeBlock(readRouteDecl);
const actionBlock = routeBlock(actionRouteDecl);
t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
  `注册点 = ${REG_POINTS_FROZEN}（读口 +1 · 动作口 +1；R-8-20 计数容忍前置空白）`, countRoutes(INDEX_TS));
t('A2', 'registration', readRouteDecl.test(INDEX_TS), '读口 `GET /api/admin/currency` 在场', readRouteDecl.test(INDEX_TS));
t('A3', 'registration', actionRouteDecl.test(INDEX_TS), '动作口 `POST /api/admin/currency/:cid/review` 在场', actionRouteDecl.test(INDEX_TS));
t('A4', 'registration', /requireAdmin\(req,\s*res,\s*'review_tasks'\)/.test(readBlock),
  '读口闸 = `requireAdmin(req,res,\'review_tasks\')`（缺闸 / 降级 ⇒ 判负）', /requireAdmin\([^)]*'([a-z_]+)'\)/.exec(readBlock)?.[1] ?? '(no guard)');
t('A5', 'registration', /requireAdmin\(req,\s*res,\s*'review_tasks'\)/.test(actionBlock),
  '动作口闸 = `requireAdmin(req,res,\'review_tasks\')`', /requireAdmin\([^)]*'([a-z_]+)'\)/.exec(actionBlock)?.[1] ?? '(no guard)');
t('A6', 'registration', /DatabaseService\.listCurrenciesForAdmin\(/.test(readBlock),
  '读口取数 = `DatabaseService.listCurrenciesForAdmin(`（单一真源，不自写第二套）', /listCurrenciesForAdmin\(/.test(readBlock));
t('A7', 'registration', resolvedOpsCall(),
  '动作口幂等键 = `resolveAdminOpsKey(req, actor.session.uID, CURRENCY_REVIEW_OPS_ACTION, …)`', /resolveAdminOpsKey\(/.test(actionBlock));
function resolvedOpsCall(): boolean {
  return /resolveAdminOpsKey\(req,\s*actor\.session\.uID,\s*CURRENCY_REVIEW_OPS_ACTION,/.test(actionBlock);
}
{
  const INJ = "  app.get('/api/p8s4-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  const injected = INDEX_TS + INJ;
  t('A8', 'registration', countRoutes(injected) === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`,
    JSON.stringify({ injected: countRoutes(injected) }));
}

// ============================================================================
// B · 读口形状（data 键集冻结 · ?status 非法 ⇒ 400 · 只读）
// ============================================================================
{
  const FROZEN_KEYS = ['cid', 'symbol', 'name', 'status', 'owner_uid', 'time_created', 'listed_at', 'deposit_amount', 'deposit_cid'];
  const sqlStart = DATABASE_TS.indexOf('static async listCurrenciesForAdmin(');
  const sqlEnd = DATABASE_TS.indexOf('static async ', sqlStart + 10);
  const body = DATABASE_TS.slice(sqlStart, sqlEnd === -1 ? DATABASE_TS.length : sqlEnd);
  t('B1', 'readSurface', FROZEN_KEYS.every((k) => new RegExp(`AS ${k}\\b`).test(body)),
    `读口 data 键集冻结 = ${JSON.stringify(FROZEN_KEYS)}`, JSON.stringify(FROZEN_KEYS.filter((k) => !new RegExp(`AS ${k}\\b`).test(body))));
  t('B2', 'readSurface', !/INSERT|UPDATE|DELETE/i.test(body),
    '读口只读（SELECT 体无 INSERT/UPDATE/DELETE）', /INSERT|UPDATE|DELETE/i.test(body));
  const ok = parseStatusFilter('');
  t('B3', 'readSurface', ok.ok === true && ok.status === null, '缺省 `?status` ⇒ 全量（null）', JSON.stringify(ok));
  const good = parseStatusFilter('draft');
  t('B4', 'readSurface', good.ok === true && good.status === 'draft', '`?status=draft` ⇒ 过滤', JSON.stringify(good));
  const bad = parseStatusFilter('bogus');
  t('B5', 'readSurface', bad.ok === false && bad.err.code === 'LEDGER_AMOUNT_INVALID' && bad.err.status === 400,
    '非法 `?status` ⇒ 400（不得静默回落）', bad.ok ? 'ok=true' : JSON.stringify({ code: bad.err.code, status: bad.err.status }));
  t('B6', 'readSurface', !/resolveAdminOpsKey/.test(readBlock),
    '读口无 `ops:` 键（读口无副作用）', /resolveAdminOpsKey/.test(readBlock));
  selfTest('B5', 'readSurface', (v) => (v as { ok?: boolean }).ok === false, { ok: true, status: 'draft' }, '把非法滤镜当合法 ⇒ 谓词必须转红');
}

// ============================================================================
// C · 动作口形状（闭集 · 映射 · ops: 键）
// ============================================================================
t('C1', 'actionShape', JSON.stringify([...CURRENCY_REVIEW_ACTIONS]) === JSON.stringify(['approve', 'reject']),
  'action 闭集恰 2 值 = ["approve","reject"]', JSON.stringify([...CURRENCY_REVIEW_ACTIONS]));
t('C2', 'actionShape', CURRENCY_REVIEW_ACTION_TO_RESULT.approve === 'approved' && CURRENCY_REVIEW_ACTION_TO_RESULT.reject === 'rejected',
  '动作 → 台账 result：approve→approved / reject→rejected', JSON.stringify(CURRENCY_REVIEW_ACTION_TO_RESULT));
t('C3', 'actionShape', CURRENCY_REVIEW_OPS_ACTION === 'currency_review', 'ops: 键 action 词 = `currency_review`', CURRENCY_REVIEW_OPS_ACTION);
t('C4', 'actionShape', canonicalAdminOpsKey(7, CURRENCY_REVIEW_OPS_ACTION, 12) === 'ops:7:currency_review:12',
  '规范键形 = `ops:<admin_uid>:currency_review:<cid>`（既有助手）', canonicalAdminOpsKey(7, CURRENCY_REVIEW_OPS_ACTION, 12));
t('C5', 'actionShape', JSON.stringify([...CURRENCY_STATUS_VALUES]) === JSON.stringify(['draft', 'listed', 'frozen', 'delisted']),
  'currency.status 四态闭集一字不动（变体 Ⅱ 不扩枚举）', JSON.stringify([...CURRENCY_STATUS_VALUES]));
t('C6', 'actionShape', /body\.action/.test(SERVICE_CODE) && /body\.reason/.test(SERVICE_CODE),
  '动作口读 `body.action` / `body.reason`（字段名 = 派单给定）', JSON.stringify({ action: /body\.action/.test(SERVICE_CODE), reason: /body\.reason/.test(SERVICE_CODE) }));

// ============================================================================
// D · ≥6 条非法入参判负 + 零新增错误码
// ============================================================================
const reviewed = (p: { ok: boolean; err?: { code: string; status: number; details: Record<string, unknown> } }) => p;
{
  const cidA = parseReviewInput({ cidRaw: 'abc', actorUid: 7, body: { action: 'approve', reason: 'x' }, opsKey: 'ops:7:currency_review:abc' });
  t('D1', 'illegalInput', !cidA.ok && cidA.err.code === 'LEDGER_CURRENCY_NOT_FOUND' && cidA.err.status === 404,
    ':cid 非数字 ⇒ 404 `LD007`（不得静默按 0 处理）', reviewed(cidA).ok ? 'ok=true' : `${cidA.err.code}/${cidA.err.status}`);
  const cidB = parseReviewInput({ cidRaw: '0', actorUid: 7, body: { action: 'reject', reason: 'x' }, opsKey: 'ops:7:currency_review:0' });
  t('D2', 'illegalInput', !cidB.ok && cidB.err.code === 'LEDGER_CURRENCY_NOT_FOUND' && cidB.err.status === 404,
    ':cid = 0（cid<=0）⇒ 404 `LD007`', cidB.ok ? 'ok=true' : `${cidB.err.code}/${cidB.err.status}`);
  const actMiss = parseReviewInput({ cidRaw: '5', actorUid: 7, body: { reason: 'x' }, opsKey: 'ops:7:currency_review:5' });
  t('D3', 'illegalInput', !actMiss.ok && actMiss.err.code === 'LEDGER_AMOUNT_INVALID' && actMiss.err.status === 400,
    'action 缺失 ⇒ 400（不得静默取默认决定）', actMiss.ok ? 'ok=true' : `${actMiss.err.code}/${actMiss.err.status}`);
  const actBad = parseReviewInput({ cidRaw: '5', actorUid: 7, body: { action: 'maybe', reason: 'x' }, opsKey: 'ops:7:currency_review:5' });
  t('D4', 'illegalInput', !actBad.ok && actBad.err.code === 'LEDGER_AMOUNT_INVALID' && (actBad.err.details.reason === 'NOT_IN_CLOSED_SET'),
    'action 非枚举 ⇒ 400（details.reason = NOT_IN_CLOSED_SET）', actBad.ok ? 'ok=true' : JSON.stringify({ code: actBad.err.code, reason: actBad.err.details.reason }));
  const rMiss = parseReviewInput({ cidRaw: '5', actorUid: 7, body: { action: 'reject' }, opsKey: 'ops:7:currency_review:5' });
  t('D5', 'illegalInput', !rMiss.ok && rMiss.err.code === 'LEDGER_AMOUNT_INVALID' && rMiss.err.details.field === 'reason',
    'reason 缺失（尤其驳回）⇒ 400（不得被静默放行）', rMiss.ok ? 'ok=true' : JSON.stringify({ code: rMiss.err.code, field: rMiss.err.details.field }));
  const rEmpty = parseReviewInput({ cidRaw: '5', actorUid: 7, body: { action: 'reject', reason: '   ' }, opsKey: 'ops:7:currency_review:5' });
  t('D6', 'illegalInput', !rEmpty.ok && rEmpty.err.code === 'LEDGER_AMOUNT_INVALID',
    'reason 空白串 ⇒ 400', rEmpty.ok ? 'ok=true' : `${rEmpty.err.code}`);
  const sBad = parseStatusFilter('nope');
  t('D7', 'illegalInput', sBad.ok === false && sBad.err.status === 400, 'status 滤镜非法 ⇒ 400', sBad.ok ? 'ok=true' : `${sBad.err.code}/${sBad.err.status}`);

  const usedCodes = [cidA, cidB, actMiss, actBad, rMiss, rEmpty].filter((p) => !p.ok).map((p) => (p as { err: { code: string } }).err.code);
  t('D8', 'illegalInput', usedCodes.every((c) => LEDGER_ERROR_CODES.includes(c as never)),
    '动作口错误码 ⊆ 既有 §14 闭集（零新增码）', JSON.stringify(usedCodes));
  t('D9', 'illegalInput', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（不动）', LEDGER_ERROR_CODES.length);
  t('D10', 'illegalInput', usedCodes.every((c) => ACTION_CODES_FROZEN.includes(c)),
    `动作口只用 ${JSON.stringify(ACTION_CODES_FROZEN)}（LD007/LD011/LD016）`, JSON.stringify([...new Set(usedCodes)]));
  selfTest('D8', 'illegalInput', (v) => (v as string[]).every((c) => LEDGER_ERROR_CODES.includes(c as never)), ['LEDGER_NEW_MADEUP_CODE'],
    '自造码喂入 ⇒ 闭集谓词必须转红');
}

// ============================================================================
// E · 驳回必须落台账（结构面）
// ============================================================================
t('E1', 'rejectLedger', /INSERT INTO public\.currency_review_log/.test(DATABASE_TS),
  '审核语句含 `INSERT INTO public.currency_review_log`（台账落行）', /INSERT INTO public\.currency_review_log/.test(DATABASE_TS));
t('E2', 'rejectLedger', /\$3::text <> 'approved' OR EXISTS \(SELECT 1 FROM apply\)/.test(DATABASE_TS),
  '台账 insert 覆盖 rejected（`$3 <> \'approved\' OR EXISTS(apply)` ⇒ 驳回也落行）', /\$3::text <> 'approved'[^\n]*/.exec(DATABASE_TS)?.[0] ?? '(no clause)');
t('E3', 'rejectLedger', /ON CONFLICT \(idempotency_key, result\) DO NOTHING/.test(DATABASE_TS),
  '台账幂等 = `ON CONFLICT (idempotency_key, result) DO NOTHING`（同键同 result 不放大）', /ON CONFLICT \(idempotency_key, result\) DO NOTHING/.test(DATABASE_TS));
t('E4', 'rejectLedger', reviewApplyGated(REVIEW_SQL),
  'approve 才走 `draft→listed`（`apply` CTE 内 `AND $3::text = \'approved\'` 门控；驳回不改 status）', reviewApplyGated(REVIEW_SQL));
t('E5', 'rejectLedger', /SELECT \$1::bigint, 'draft', 'listed', \$2::bigint/.test(DATABASE_TS),
  '`currency_status_log` 落行 = `FROM apply` 门控（驳回时 apply 不产行 ⇒ 不写状态日志）', /INSERT INTO public\.currency_status_log[\s\S]{0,140}/.exec(DATABASE_TS)?.[0]?.replace(/\n\s*/g, ' ') ?? '(none)');
t('E6', 'rejectLedger', /actor_uid, result, request_fingerprint, idempotency_key, memo\)/.test(DATABASE_TS) && /SELECT \$1::bigint, \$2::bigint, \$3::text/.test(DATABASE_TS),
  '台账 `actor_uid` = `$2`（= admin uid；不得记成 owner）', /SELECT \$1::bigint, \$2::bigint, \$3::text/.test(DATABASE_TS));
t('E7', 'rejectLedger', /return \{ ok: true, replay: false, view: \{ cid: String\(parsed\.cid\), status, result: parsed\.result \} \}/.test(SERVICE_CODE.replace(/\s+/g, ' ')) || /result: parsed\.result/.test(SERVICE_CODE),
  '驳回成功面回 `result = rejected`（服务层不静默成功）', /result: parsed\.result/.test(SERVICE_CODE));
t('E8', 'rejectLedger', /poster\(\{[\s\S]{0,200}result: parsed\.result/.test(SERVICE_CODE.replace(/\s+/g, ' ')),
  '驳回也调 DB 台账写口（`poster({… result: parsed.result …})`）', /result: parsed\.result/.test(SERVICE_CODE));
selfTest('E1', 'rejectLedger', (v) => /INSERT INTO public\.currency_review_log/.test(String(v)), 'SELECT 1', '台账 insert 谓词喂无 insert 文本 ⇒ 必须转红');
selfTest('E4', 'rejectLedger', (v) => reviewApplyGated(String(v)),
  "apply AS (\n  UPDATE public.currency AS c\n  SET status = 'listed',\n  listed_at = now()\n  WHERE c.cid = $1::bigint\n    AND c.status = 'draft'\n),", '把「无 `= \'approved\'` 门控」的 apply CTE 喂入 ⇒ 谓词必须转红');

// ============================================================================
// F · 无退还 / 罚没 / delist 面
// ============================================================================
{
  const SRC_DIR = path.resolve(REPO_ROOT, 'backend-ts', 'src');
  const walkTs = (dir: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkTs(p, out); else if (e.name.endsWith('.ts')) out.push(p);
    }
    return out;
  };
  const allSrc = walkTs(SRC_DIR).map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
  t('F1', 'noRefundSurface', countRoutes(INDEX_TS) === REG_POINTS_FROZEN, `注册点仍 = ${REG_POINTS_FROZEN}（零退还/罚没/delist 路由）`, countRoutes(INDEX_TS));
  t('F2', 'noRefundSurface', !/^[ \t]*app\.(get|post|put|delete|patch)\([^)]*delist/mi.test(INDEX_TS), '无 delist 一族路由', /delist/mi.test(INDEX_TS));
  t('F3', 'noRefundSurface', !/(hold_forfeit|hold_release|unfreeze\s*\(|listing_deposit_refund)/.test(SERVICE_CODE),
    '审核服务（去注释）零 `hold_forfeit`/`hold_release`/`unfreeze(`/`listing_deposit_refund`', JSON.stringify((SERVICE_CODE.match(/hold_forfeit|hold_release|unfreeze\s*\(|listing_deposit_refund/g) || [])));
  t('F4', 'noRefundSurface', !/ledger_post_event/.test(DATABASE_TS.slice(DATABASE_TS.indexOf('CURRENCY_REVIEW_POST_EVENT_SQL'), DATABASE_TS.indexOf('CURRENCY_REVIEW_POST_EVENT_SQL') + 2600)),
    '审核语句零账本分录（不调 `ledger_post_event`）', /ledger_post_event/.test(DATABASE_TS.slice(DATABASE_TS.indexOf('CURRENCY_REVIEW_POST_EVENT_SQL'), DATABASE_TS.indexOf('CURRENCY_REVIEW_POST_EVENT_SQL') + 2600)));
  t('F5', 'noRefundSurface', !/listing_deposit_refund/.test(allSrc), '全 src 面 `listing_deposit_refund` 零命中', /listing_deposit_refund/g.test(allSrc));
}

// ============================================================================
// G · 四语键齐 + 六类泄漏 = 0
// ============================================================================
const LEAK: Array<[string, RegExp]> = [
  ['章节号/条号', /§|R-8-|DL\d|LD\d/],
  ['HTTP 状态码', /\b(400|401|402|403|404|405|409|410|418|422|429|500|502|503|504)\b/],
  ['接口路径/方法', /\/api\/|\b(GET|POST|PUT|PATCH|DELETE)\b\s*\//],
  ['内部批次名/单号', /8④|批\s*8|P6\b|P7\b|B8|JING-SPEC|BE-AUDIT/],
  ['机读码/裸 i18n 键', /\b[A-Z][A-Z0-9_]{5,}\b|adminCurrencyReview\.|ledger\.err\./],
  ['表名/列名/函数名', /currency_review_log|currency_status_log|assertCurrency|assertTransition|\bcurrency\b/i],
];
const CJK = /[\u3400-\u9fff]/;
const leakHits = (ns: Record<string, string>): string[] => {
  const hits: string[] = [];
  for (const [k, v] of Object.entries(ns)) for (const [name, re] of LEAK) if (re.test(String(v))) hits.push(`${k} [${name}] ${v}`);
  return hits;
};
{
  const nsKeys = Object.keys(NS_OF('zh')).sort();
  t('G1', 'i18n', nsKeys.length === REVIEW_NS_KEYS_FROZEN, `adminCurrencyReview 键数 = ${REVIEW_NS_KEYS_FROZEN}`, nsKeys.length);
  for (const l of LANGS) {
    t(`G2.${l}`, 'i18n',
      JSON.stringify(Object.keys(NS_OF(l)).sort()) === JSON.stringify(nsKeys) && Object.values(NS_OF(l)).every((v) => typeof v === 'string' && v.trim().length > 0),
      `四语键集齐 + 非空（${l}）`, JSON.stringify({ keys: Object.keys(NS_OF(l)).length }));
  }
  for (const l of ['en', 'vn']) t(`G3.${l}`, 'i18n', !Object.values(NS_OF(l)).some((v) => CJK.test(v)), `${l} 无 CJK`, JSON.stringify(Object.values(NS_OF(l)).filter((v) => CJK.test(v))));
  t('G4', 'i18n', /[繁體審核駁凍結單位]/.test(String(NAV_OF('hk').currencyReview) + String(NS_OF('hk').title)), 'hk 为繁體（抽查 審核/單位 异形）', String(NS_OF('hk').title));
  const allHits = LANGS.flatMap((l) => leakHits(NS_OF(l)).map((h) => `${l}.${h}`));
  t('G5', 'i18n', allHits.length === 0, '六类工程口径泄漏 = 0（四语 × adminCurrencyReview）', JSON.stringify(allHits));
  const navHits = ['en', 'vn'].filter((l) => CJK.test(String(NAV_OF(l).currencyReview)) || CJK.test(String(NAV_OF(l).currencyReviewDesc)));
  t('G6', 'i18n', navHits.length === 0 && LANGS.every((l) => Boolean(NAV_OF(l).currencyReview) && Boolean(NAV_OF(l).currencyReviewDesc)),
    'adminNav 2 键四语齐 + en/vn 无 CJK', JSON.stringify(navHits));
  selfTest('G5', 'i18n', (v) => leakHits(v as Record<string, string>).length === 0, { title: '审核（§23.3）' },
    '把带章节号的文案喂入 ⇒ 泄漏谓词必须转红');
}

// ============================================================================
// H · 迁移 0025 内容契约（§26.7）
// ============================================================================
{
  const migFiles = fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql'));
  t('H1', 'migration', migFiles.includes('0025_currency_review_log.sql') && migFiles.length === MIGRATIONS_FROZEN,
    `迁移文件 = 0025_currency_review_log.sql；总数 = ${MIGRATIONS_FROZEN}`, JSON.stringify({ count: migFiles.length, has: migFiles.includes('0025_currency_review_log.sql') }));
  t('H2', 'migration', /CREATE TABLE IF NOT EXISTS public\.currency_review_log \(/.test(MIGRATION_SQL),
    '表名逐字 = `public.currency_review_log`', /CREATE TABLE IF NOT EXISTS public\.(\w+)/.exec(MIGRATION_SQL)?.[1] ?? '(none)');
  const COLS = ['log_id', 'cid', 'actor_uid', 'result', 'request_fingerprint', 'idempotency_key', 'memo', 'time_created'];
  t('H3', 'migration', COLS.every((c) => new RegExp(`^\\s+${c}\\s`, 'm').test(MIGRATION_SQL)),
    '8 列逐字在场', JSON.stringify(COLS.filter((c) => !new RegExp(`^\\s+${c}\\s`, 'm').test(MIGRATION_SQL))));
  const CONS = ['currency_review_log_pk', 'currency_review_log_actor_fk', 'currency_review_log_cid_fk', 'currency_review_log_result_ck', 'currency_review_log_idem_uniq'];
  t('H4', 'migration', CONS.every((c) => MIGRATION_SQL.includes(c)), '5 具名约束逐字在场', JSON.stringify(CONS.filter((c) => !MIGRATION_SQL.includes(c))));
  t('H5', 'migration', /CHECK \(result IN \('pending', 'approved', 'rejected'\)\)/.test(MIGRATION_SQL),
    'result 闭集 = {pending, approved, rejected}（R-8-21 值域）', /CHECK \(result IN \([^)]*\)\)/.exec(MIGRATION_SQL)?.[0] ?? '(none)');
  t('H6', 'migration', /UNIQUE \(idempotency_key, result\)/.test(MIGRATION_SQL), '幂等唯一键 = 复合 `(idempotency_key, result)`', /UNIQUE \([^)]*\)/.exec(MIGRATION_SQL)?.[0] ?? '(none)');
  t('H7', 'migration', /currency_review_log_cid_idx/.test(MIGRATION_SQL) && /currency_review_log_actor_day_idx/.test(MIGRATION_SQL),
    '4 索引（PK + idem_uniq 自带 + 2 具名）', JSON.stringify(['currency_review_log_cid_idx', 'currency_review_log_actor_day_idx'].filter((i) => !MIGRATION_SQL.includes(i))));
  t('H8', 'migration', /trg_currency_review_log_append_only/.test(MIGRATION_SQL) && /BEFORE UPDATE OR DELETE ON public\.currency_review_log/.test(MIGRATION_SQL) && /currency_review_log_append_only\(\)/.test(MIGRATION_SQL),
    'append-only：`BEFORE UPDATE OR DELETE` 触发器 + 守门函数', /BEFORE UPDATE OR DELETE[^\n]*/.exec(MIGRATION_SQL)?.[0] ?? '(none)');
  t('H9', 'migration', /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(MIGRATION_SQL) && !/\btime_updated\b/.test(MIGRATION_STRUCT),
    '恰一列 `time_created`（DEFAULT now()）；**无** `time_updated`（结构面：注释 / 自检串不计）', JSON.stringify({ time_created: /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(MIGRATION_SQL), time_updated: /\btime_updated\b/.test(MIGRATION_STRUCT) }));
  t('H10', 'migration', !/\bcreate_key\b|\bledger_event_keys\b/.test(MIGRATION_STRUCT), '无 `create_key` / 无 `ledger_event_keys`（结构面：注释 / 自检串不计）', JSON.stringify({ create_key: /\bcreate_key\b/.test(MIGRATION_STRUCT), lek: /\bledger_event_keys\b/.test(MIGRATION_STRUCT) }));
  t('H11', 'migration', !/ALTER\s+TABLE/i.test(MIGRATION_SQL), '零 `ALTER TABLE`（不改既有表 · DL7 同向）', /ALTER\s+TABLE/i.test(MIGRATION_SQL));
  t('H12', 'migration', !/INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i.test(MIGRATION_SQL) && !/ledger_post_event/.test(MIGRATION_SQL),
    '零数据 DML / 零账本调用（纯 DDL + append-only + 自检）', JSON.stringify({ dml: /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i.test(MIGRATION_SQL), ledger: /ledger_post_event/.test(MIGRATION_SQL) }));
  t('H13', 'migration', /DO \$\$[\s\S]*RAISE NOTICE '0025 self-check OK/.test(MIGRATION_SQL), '自带 apply-time 自检（失败整迁移回滚 · DL48）', /RAISE NOTICE '0025 self-check OK/.test(MIGRATION_SQL));
}

// ============================================================================
// I · 门自证（负对照）
// ============================================================================
selfTest('A1', 'registration', (v) => v === REG_POINTS_FROZEN, 74, '注册点写成 74（= 偷偷少注册一条）⇒ 谓词必须转红');
selfTest('C1', 'actionShape', (v) => JSON.stringify(v) === JSON.stringify(['approve', 'reject']), ['approve', 'reject', 'hold'],
  '闭集被偷偷加第三值 ⇒ 谓词必须转红');
selfTest('H9', 'migration', (v) => /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(String(v)) && !/\btime_updated\b/.test(sqlStructure(String(v))),
  'CREATE TABLE (\n  time_created timestamptz NOT NULL DEFAULT now(),\n  time_updated timestamptz\n)', '把 time_updated 列定义喂入 ⇒ 谓词必须转红');

// ============================================================================
// J · C2 审核闸（批 8④ 补漏 · 上市路径 fail-closed）—— 无已通过台账行 ⇒ 不得 draft→listed
// ============================================================================
{
  t('J1', 'listGate', listApplyGated(LIST_SQL),
    "上市语句 `apply` CTE 被 8④ 审核闸门控（`AND ( EXISTS (SELECT 1 FROM public.currency_review_log … result = 'approved') OR c.is_platform_coin = true )` · P9④ 变体 Ⅱ 仅把既有闸包进 OR；缺闸 ⇒ 未审 draft 可自助上市 ⇒ 判负）",
    listApplyGated(LIST_SQL));
  t('J2', 'listGate', /r\.result = 'approved'/.test(LIST_SQL),
    '闸谓词为稳定常量 `result = \'approved\'`（非插值；台账 `result` 闭集值域给定）',
    /r\.result = 'approved'/.test(LIST_SQL));
  t('J3', 'listGate', /AND \(\s*EXISTS \(\s*SELECT 1 FROM public\.currency_review_log/.test(LIST_SQL) && /OR c\.is_platform_coin = true\s*\)/.test(LIST_SQL) && !/NOT EXISTS \(\s*SELECT 1 FROM public\.currency_review_log/.test(LIST_SQL),
    'fail-closed 形（**存在**已通过行才放行 · `AND ( EXISTS (…) OR c.is_platform_coin = true )` 变体 Ⅱ 豁免谓词；`NOT EXISTS` 反形 ⇒ 判负）',
    JSON.stringify({ exists: /AND \(\s*EXISTS \(\s*SELECT 1 FROM public\.currency_review_log/.test(LIST_SQL), platformOr: /OR c\.is_platform_coin = true\s*\)/.test(LIST_SQL), notExists: /NOT EXISTS \(\s*SELECT 1 FROM public\.currency_review_log/.test(LIST_SQL) }));
  t('J4', 'listGate', /r\.cid = \$1::bigint/.test(LIST_SQL),
    '闸按 `cid = $1`（同一单位）关联台账行（不跨单位、不自造实体 id）',
    /r\.cid = \$1::bigint/.test(LIST_SQL));
  selfTest('J1', 'listGate', (v) => listApplyGated(String(v)),
    "apply AS (\n  UPDATE public.currency AS c\n  SET status = 'listed',\n  listed_at = now(),\n  deposit_amount = $3::bigint,\n  time_updated = now()\n  WHERE c.cid = $1::bigint\n    AND c.status = 'draft'\n    AND (SELECT cur.owner_uid FROM cur) = $4::bigint\n),",
    '把「无审核闸」的 apply CTE 喂入 ⇒ 谓词必须转红');
}

// ==================================================================== 结论
const failed = checks.filter((c) => !c.pass);
const report = {
  unit: 'P8-S4-CURRENCY-REVIEW-GATE',
  generated_at: new Date().toISOString(),
  run: RUN,
  offline: true,
  db_connections: 0,
  http_calls: 0,
  note: '本门**零 DB / 零 HTTP**，不依赖新表存在；四段真链路 + 库面判负 = 待 Zang apply `0025` 后补跑（NOT_MEASURED）。',
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  readings: {
    registration_points: countRoutes(INDEX_TS),
    actions: [...CURRENCY_REVIEW_ACTIONS],
    action_to_result: CURRENCY_REVIEW_ACTION_TO_RESULT,
    ops_action: CURRENCY_REVIEW_OPS_ACTION,
    currency_status_values: [...CURRENCY_STATUS_VALUES],
    error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
    error_codes_used: ACTION_CODES_FROZEN,
    review_ns_keys: REVIEW_NS_KEYS_FROZEN,
    migrations_count: fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql')).length,
  },
  checks,
};
const text = JSON.stringify(report, null, 1);
fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
console.log(text);
console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
process.exit(failed.length ? 1 : 0);
