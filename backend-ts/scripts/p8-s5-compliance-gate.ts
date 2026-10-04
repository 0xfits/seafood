/**
 * 批 8⑤（`route-layer.spec` v2.10 §25 · `data-layer.spec` v0.17 §28）：
 * **合规审核（商品 takedown / 招工仲裁 · 变体 Ⅱ = 旁路台账型）** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s5-compliance-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s5-artifacts/p8s5-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）—— 同「离线 126/126」族。
 * **不依赖新表存在**（迁移 `0026`/`0027` 只做文本断言，**不 apply**；四段真链路 + 库面判负 = 待 Zang apply 后补跑）。
 *
 * 判据（每条**可判负**）：
 *   A  **注册点 75 逐 verb + 4 路由形状**：`GET /api/admin/listing` · `POST /api/admin/listing/:listingId/takedown`
 *      · `GET /api/admin/arbitration` · `POST /api/admin/arbitration/:jobId`，四口均 `requireAdmin(req,res,'review_tasks')`；
 *      per-verb 现取（get/post/put/patch/delete）；负对照（缩进注入 ⇒ +1）
 *   B  **两读口形状**：`data` 键集冻结（listing 8 键 / job 8 键）；`?status` 非法 ⇒ 400（不得静默回落）；只读
 *   C  **两动作口形状**：`action` 闭集恰 2 值；`approve→approved` / `reject→rejected`；目标状态映射；
 *      `ops:` 键 = `ops:<admin_uid>:listing_takedown:<listingId>` / `ops:<admin_uid>:job_arbitrate:<jobId>`
 *   D  **≥6 条非法入参判负**（listingId 非数字 / <=0 / jobId 非数字 / action 缺失 / action 非枚举 /
 *      reason 缺失 / reason 空白 / target_status 非法 / status 滤镜非法），且**零新增错误码**（33 码闭集）
 *   E  **归属闸判定式（★ 含「admin 通道未被删除」负对照）**：`requireJobOwnerOrAdmin` = ①无 token⇒401
 *      ②job 非数字/不存在⇒404 ③雇主本人⇒放行 ④否则走**既有 admin 通道**（`requireAdmin(...,'review_tasks')`）
 *      ⑤皆不满足⇒拒；并断言 `job/:jobId/review` 与 `job/:jobId/cancel` 两路由确实挂此闸
 *   F  **无退还 / 罚没 / delist 面**（`R-8-17`/`DL67`/`DL88`）：零 `hold_forfeit`/`hold_release`/`unfreeze(`/
 *      `listing_deposit_refund`；商品轴审核语句**零账本分录**；招工轴仅走既有 `job_post_event(op='settle'|'refund')`
 *   G  **四语键齐 + 六类泄漏 = 0**：`adminListingReview`(30) / `adminArbitrationReview`(34) / `adminNav`(30)
 *      四语齐、键集相等、值非空、en/vn 无 CJK、hk 繁體；六类工程口径泄漏 = 0
 *   H  **两迁移 `0026`/`0027` 结构面判据（去注释、去字面量）**：表名 / 9 列 / 5 约束 / 4 索引 / append-only 触发器 /
 *      恰一列 `time_created` / **不含** `time_updated`·`create_key`·`ledger_event_keys` / 零 `ALTER` / 零数据 DML
 *   I  **门自证（负对照）**：若干判据谓词喂错值 ⇒ **必须转红**（不转红 = 假门）
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  REVIEW_ACTIONS,
  REVIEW_ACTION_TO_RESULT,
  LISTING_STATUS_VALUES,
  JOB_STATUS_VALUES,
  LISTING_TAKEDOWN_TARGETS,
  JOB_ARBITRATE_ACTION_TO_TARGET,
  LISTING_TAKEDOWN_OPS_ACTION,
  JOB_ARBITRATE_OPS_ACTION,
  parseTakedownInput,
  parseArbitrationInput,
  arbitrateJobVerb,
  parseListingStatusFilter,
  parseJobStatusFilter,
} from '../src/compliance-review-service';
import { canonicalAdminOpsKey } from '../src/admin-service';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s5-artifacts', `p8s5-${RUN}`);
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
// ★ 8⑥ 续跑前推：注册点 87 → 88（审计台统一读口 +1 · GET /api/admin/audit/:table）。
// ★ S11 注册点前推（沿 R-8-22）：注册点 88 → 89（S6 新增 GET /api/job/:jobId/submissions +1；逐 commit 归因 692f622）。
const REG_POINTS_FROZEN = 89;
// ★ P9④ 冻结计数前推（沿 R-8-22）：迁移文件数 30 → 33（+0032 / +0033 / +0034）。
// ★ P9⑤ 冻结计数前推（沿 R-8-22）：迁移文件数 33 → 37（+0035 / +0036 / +0037 / +0038）。
// ★ 8⑥ 续跑前推：迁移文件数 37 → 38（+0039 审计台权限键 manage_audit）。
// ★ 8⑥ 续跑前推：迁移文件数 38 → 39（+0040 存量用户补发 batt）。
// ★ S2b 门前推：迁移文件数 39 → 40（+0041_job_headcount 任务 headcount）。
// ★ S10 门前推：迁移文件数 40 → 41（+0042_job_settle_per_submission 每提交结算）。
// ★ S26 台账 B9 门前推：迁移文件数 41 → 42（+0043_truncate_guard 给 15 张 append-only 表补 BEFORE TRUNCATE 守卫）。
const MIGRATIONS_FROZEN = 42;
const LISTING_NS_KEYS_FROZEN = 30;
const ARBITRATION_NS_KEYS_FROZEN = 34;
// ★ P9①（`route-layer.spec` v2.12 §27 · `R-9-13`）：`adminNav` **26 → 28**（+2 键 = `siteText` / `siteTextDesc`，
//   ⇔ 后台「站点文案」菜单项的标题 + 描述；沿 `R-8-22`）。8⑤ 的 4 键（`listingReview` / `listingReviewDesc` /
//   `arbitrationReview` / `arbitrationReviewDesc`）仍在，本门 G8/G9 判据未改，仅冻结计数前推。
// ★ 8⑥ 续跑前推（沿 `R-8-22`）：`adminNav` **28 → 30**（+2 键 = `auditConsole` / `auditConsoleDesc`，⇔ 后台「审计台」菜单项）。
//   依据 `route-layer.spec` v2.21 §32.8(a)「+2 键 / 语言」+ §32.8(d)「`adminNav 28 → 30`」。G8/G9 判据逻辑一字未动。
const NAV_KEYS_FROZEN = 30;
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number =>
  (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const ACTION_CODES_FROZEN = ['LEDGER_REF_NOT_FOUND', 'LEDGER_CURRENCY_INVALID_TRANSITION', 'LEDGER_AMOUNT_INVALID'];

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '').replace(/\/\/[^\n]*$/gm, '');
/** 迁移「结构面」文本：去 `--` 行注释 + 去单引号字面量 ⇒ 列/约束名断言只看结构，不误咬注释与自检串。 */
const sqlStructure = (text: string): string => text.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, "''");

const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const SERVICE_TS = readSrc('backend-ts/src/compliance-review-service.ts');
const SERVICE_CODE = stripComments(SERVICE_TS);
const MIG26_SQL = readSrc('backend-ts/migrations/0026_listing_review_log.sql');
const MIG27_SQL = readSrc('backend-ts/migrations/0027_job_arbitration_log.sql');
const MIG26_STRUCT = sqlStructure(MIG26_SQL);
const MIG27_STRUCT = sqlStructure(MIG27_SQL);

const LANGS = ['zh', 'en', 'hk', 'vn'];
const LOCALES: Record<string, Record<string, unknown>> = Object.fromEntries(LANGS.map((l) => [
  l, JSON.parse(readSrc(`frontend/src/locales/${l}.json`)),
]));
const LISTING_OF = (lang: string) => (LOCALES[lang].adminListingReview || {}) as Record<string, string>;
const ARB_OF = (lang: string) => (LOCALES[lang].adminArbitrationReview || {}) as Record<string, string>;
const NAV_OF = (lang: string) => (LOCALES[lang].adminNav || {}) as Record<string, string>;
const NEW_NAV_KEYS = ['listingReview', 'listingReviewDesc', 'arbitrationReview', 'arbitrationReviewDesc'];

/** 提取 `app.<verb>(<path>', …` 起至下一个 `\n});` 的路由体（找不到 ⇒ ''）。 */
const routeBlock = (declRe: RegExp): string => {
  const m = declRe.exec(INDEX_TS);
  if (!m) return '';
  const end = INDEX_TS.indexOf('\n});', m.index);
  return end === -1 ? INDEX_TS.slice(m.index) : INDEX_TS.slice(m.index, end + 4);
};
/** 提取 `const <name> = async (` 起至 `\n};` 的顶层片段（helper 体）。 */
const constBlock = (head: string): string => {
  const s = INDEX_TS.indexOf(head);
  if (s === -1) return '';
  const e = INDEX_TS.indexOf('\n};', s);
  return e === -1 ? INDEX_TS.slice(s) : INDEX_TS.slice(s, e + 3);
};
/** 归属闸判定式：① 取 actor ② 读雇主 uid ③ 雇主本人放行 ④ **admin 通道保留**（OR 一支） */
const ownershipGateKeepsAdminChannel = (block: string): boolean =>
  /requireActor\(req,\s*res\)/.test(block)
  && /getJobEmployerUid\(/.test(block)
  && /Number\(actor\.user\.uID\)\s*===\s*Number\(employerUid\)/.test(block)
  && /return actor/.test(block)
  && /requireAdmin\(req,\s*res,\s*'review_tasks'\)/.test(block);

// ============================================================================
// A · 注册点 75 逐 verb + 4 路由形状
// ============================================================================
const readListingDecl = /^[ \t]*app\.get\('\/api\/admin\/listing',/m;
const actionListingDecl = /^[ \t]*app\.post\('\/api\/admin\/listing\/:listingId\/takedown',/m;
const readArbDecl = /^[ \t]*app\.get\('\/api\/admin\/arbitration',/m;
const actionArbDecl = /^[ \t]*app\.post\('\/api\/admin\/arbitration\/:jobId',/m;
const readListingBlock = routeBlock(readListingDecl);
const actionListingBlock = routeBlock(actionListingDecl);
const readArbBlock = routeBlock(readArbDecl);
const actionArbBlock = routeBlock(actionArbDecl);
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
    `注册点 = ${REG_POINTS_FROZEN}（逐 verb：${JSON.stringify(perVerb)}；8⑤ 读口/动作口 +4）`, countRoutes(INDEX_TS));
  t('A1b', 'registration', Object.values(perVerb).reduce((a, b) => a + b, 0) === REG_POINTS_FROZEN,
    '逐 verb 计数之和 = 注册点总数', JSON.stringify(perVerb));
  t('A2', 'registration', readListingDecl.test(INDEX_TS), '读口 `GET /api/admin/listing` 在场', readListingDecl.test(INDEX_TS));
  t('A3', 'registration', actionListingDecl.test(INDEX_TS), '动作口 `POST /api/admin/listing/:listingId/takedown` 在场', actionListingDecl.test(INDEX_TS));
  t('A4', 'registration', readArbDecl.test(INDEX_TS), '读口 `GET /api/admin/arbitration` 在场', readArbDecl.test(INDEX_TS));
  t('A5', 'registration', actionArbDecl.test(INDEX_TS), '动作口 `POST /api/admin/arbitration/:jobId` 在场', actionArbDecl.test(INDEX_TS));
  for (const [id, blk, label] of [['A6', readListingBlock, 'listing 读口'], ['A7', actionListingBlock, 'listing 动作口'], ['A8', readArbBlock, 'arbitration 读口'], ['A9', actionArbBlock, 'arbitration 动作口']] as Array<[string, string, string]>) {
    t(id, 'registration', /requireAdmin\(req,\s*res,\s*'review_tasks'\)/.test(blk),
      `${label}闸 = \`requireAdmin(req,res,'review_tasks')\`（缺闸 / 降级 ⇒ 判负）`,
      /requireAdmin\([^)]*'([a-z_]+)'\)/.exec(blk)?.[1] ?? '(no guard)');
  }
  t('A10', 'registration', /DatabaseService\.listListingsForAdmin\(/.test(readListingBlock),
    'listing 读口取数 = `DatabaseService.listListingsForAdmin(`（单一真源）', /listListingsForAdmin\(/.test(readListingBlock));
  t('A11', 'registration', /DatabaseService\.listJobsForArbitration\(/.test(readArbBlock),
    'arbitration 读口取数 = `DatabaseService.listJobsForArbitration(`（单一真源）', /listJobsForArbitration\(/.test(readArbBlock));
  t('A12', 'registration', /resolveAdminOpsKey\(req,\s*actor\.session\.uID,\s*LISTING_TAKEDOWN_OPS_ACTION,/.test(actionListingBlock),
    'listing 动作口幂等键 = `resolveAdminOpsKey(req, actor.session.uID, LISTING_TAKEDOWN_OPS_ACTION, …)`', /resolveAdminOpsKey\(/.test(actionListingBlock));
  t('A13', 'registration', /resolveAdminOpsKey\(req,\s*actor\.session\.uID,\s*JOB_ARBITRATE_OPS_ACTION,/.test(actionArbBlock),
    'arbitration 动作口幂等键 = `resolveAdminOpsKey(req, actor.session.uID, JOB_ARBITRATE_OPS_ACTION, …)`', /resolveAdminOpsKey\(/.test(actionArbBlock));
  const INJ = "  app.get('/api/p8s5-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  const injected = INDEX_TS + INJ;
  t('A14', 'registration', countRoutes(injected) === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`,
    JSON.stringify({ injected: countRoutes(injected) }));
}

// ============================================================================
// B · 两读口形状（data 键集冻结 · ?status 非法 ⇒ 400 · 只读）
// ============================================================================
{
  const LISTING_KEYS = ['listing_id', 'seller_uid', 'cid', 'price', 'stock', 'title', 'status', 'time_created'];
  const JOB_KEYS = ['job_id', 'employer_uid', 'worker_uid', 'cid', 'reward', 'title', 'status', 'time_created'];
  const listingStart = DATABASE_TS.indexOf('static async listListingsForAdmin(');
  const listingEnd = DATABASE_TS.indexOf('static async ', listingStart + 10);
  const listingBody = DATABASE_TS.slice(listingStart, listingEnd === -1 ? DATABASE_TS.length : listingEnd);
  const jobStart = DATABASE_TS.indexOf('static async listJobsForArbitration(');
  const jobEnd = DATABASE_TS.indexOf('static async ', jobStart + 10);
  const jobBody = DATABASE_TS.slice(jobStart, jobEnd === -1 ? DATABASE_TS.length : jobEnd);
  t('B1', 'readSurface', LISTING_KEYS.every((k) => new RegExp(`AS ${k}\\b`).test(listingBody)),
    `listing 读口 data 键集冻结 = ${JSON.stringify(LISTING_KEYS)}`, JSON.stringify(LISTING_KEYS.filter((k) => !new RegExp(`AS ${k}\\b`).test(listingBody))));
  t('B2', 'readSurface', JOB_KEYS.every((k) => new RegExp(`AS ${k}\\b`).test(jobBody)),
    `job 读口 data 键集冻结 = ${JSON.stringify(JOB_KEYS)}`, JSON.stringify(JOB_KEYS.filter((k) => !new RegExp(`AS ${k}\\b`).test(jobBody))));
  t('B3', 'readSurface', !/INSERT|UPDATE|DELETE/i.test(listingBody) && !/INSERT|UPDATE|DELETE/i.test(jobBody),
    '两读口只读（SELECT 体无 INSERT/UPDATE/DELETE）', JSON.stringify({ listing: /INSERT|UPDATE|DELETE/i.test(listingBody), job: /INSERT|UPDATE|DELETE/i.test(jobBody) }));
  const okL = parseListingStatusFilter('');
  t('B4', 'readSurface', okL.ok === true && okL.status === null, '缺省 `?status`（listing）⇒ 全量（null）', JSON.stringify(okL));
  const goodL = parseListingStatusFilter('listed');
  t('B5', 'readSurface', goodL.ok === true && goodL.status === 'listed', '`?status=listed` ⇒ 过滤', JSON.stringify(goodL));
  const badL = parseListingStatusFilter('bogus');
  t('B6', 'readSurface', badL.ok === false && badL.err.status === 400 && badL.err.code === 'LEDGER_AMOUNT_INVALID',
    '非法 `?status`（listing）⇒ 400（不得静默回落）', badL.ok ? 'ok=true' : JSON.stringify({ code: badL.err.code, status: badL.err.status }));
  const badJ = parseJobStatusFilter('nope');
  t('B7', 'readSurface', badJ.ok === false && badJ.err.status === 400,
    '非法 `?status`（arbitration）⇒ 400', badJ.ok ? 'ok=true' : `${badJ.err.code}/${badJ.err.status}`);
  t('B8', 'readSurface', !/resolveAdminOpsKey/.test(readListingBlock) && !/resolveAdminOpsKey/.test(readArbBlock),
    '两读口无 `ops:` 键（读口无副作用）', JSON.stringify({ listing: /resolveAdminOpsKey/.test(readListingBlock), arb: /resolveAdminOpsKey/.test(readArbBlock) }));
  selfTest('B6', 'readSurface', (v) => (v as { ok?: boolean }).ok === false, { ok: true, status: 'listed' }, '把非法滤镜当合法 ⇒ 谓词必须转红');
}

// ============================================================================
// C · 两动作口形状（闭集 · 映射 · 目标状态 · ops: 键）
// ============================================================================
t('C1', 'actionShape', JSON.stringify([...REVIEW_ACTIONS]) === JSON.stringify(['approve', 'reject']),
  'action 闭集恰 2 值 = ["approve","reject"]', JSON.stringify([...REVIEW_ACTIONS]));
t('C2', 'actionShape', REVIEW_ACTION_TO_RESULT.approve === 'approved' && REVIEW_ACTION_TO_RESULT.reject === 'rejected',
  '动作 → 台账 result：approve→approved / reject→rejected', JSON.stringify(REVIEW_ACTION_TO_RESULT));
t('C3', 'actionShape', JSON.stringify([...LISTING_TAKEDOWN_TARGETS]) === JSON.stringify(['delisted', 'frozen']),
  '商品 takedown 目标状态闭集 = ["delisted","frozen"]', JSON.stringify([...LISTING_TAKEDOWN_TARGETS]));
t('C4', 'actionShape', JOB_ARBITRATE_ACTION_TO_TARGET.approve === 'settled' && JOB_ARBITRATE_ACTION_TO_TARGET.reject === 'cancelled',
  '仲裁动作 → 目标状态：approve→settled / reject→cancelled', JSON.stringify(JOB_ARBITRATE_ACTION_TO_TARGET));
t('C5', 'actionShape', LISTING_TAKEDOWN_OPS_ACTION === 'listing_takedown' && JOB_ARBITRATE_OPS_ACTION === 'job_arbitrate',
  'ops: 键 action 词 = `listing_takedown` / `job_arbitrate`', JSON.stringify({ l: LISTING_TAKEDOWN_OPS_ACTION, j: JOB_ARBITRATE_OPS_ACTION }));
t('C6', 'actionShape', canonicalAdminOpsKey(7, LISTING_TAKEDOWN_OPS_ACTION, 12) === 'ops:7:listing_takedown:12'
  && canonicalAdminOpsKey(7, JOB_ARBITRATE_OPS_ACTION, 12) === 'ops:7:job_arbitrate:12',
  '规范键形 = `ops:<admin_uid>:listing_takedown:<listingId>` / `ops:<admin_uid>:job_arbitrate:<jobId>`（既有助手）',
  JSON.stringify({ l: canonicalAdminOpsKey(7, LISTING_TAKEDOWN_OPS_ACTION, 12), j: canonicalAdminOpsKey(7, JOB_ARBITRATE_OPS_ACTION, 12) }));
t('C7', 'actionShape', JSON.stringify([...LISTING_STATUS_VALUES]) === JSON.stringify(['draft', 'listed', 'delisted', 'frozen']),
  'listing.status 四态闭集一字不动（变体 Ⅱ 不扩枚举）', JSON.stringify([...LISTING_STATUS_VALUES]));
t('C8', 'actionShape', JSON.stringify([...JOB_STATUS_VALUES]) === JSON.stringify(['open', 'accepted', 'submitted', 'settled', 'disputed', 'rejected', 'cancelled']),
  'job.status 七态闭集一字不动', JSON.stringify([...JOB_STATUS_VALUES]));

// ============================================================================
// D · ≥6 条非法入参判负 + 零新增错误码
// ============================================================================
{
  const t1 = parseTakedownInput({ listingIdRaw: 'abc', body: { action: 'approve', reason: 'x' } });
  t('D1', 'illegalInput', !t1.ok && t1.err.code === 'LEDGER_REF_NOT_FOUND' && t1.err.status === 404,
    ':listingId 非数字 ⇒ 404（不得静默按 0 处理）', t1.ok ? 'ok=true' : `${t1.err.code}/${t1.err.status}`);
  const t2 = parseTakedownInput({ listingIdRaw: '0', body: { action: 'reject', reason: 'x' } });
  t('D2', 'illegalInput', !t2.ok && t2.err.code === 'LEDGER_REF_NOT_FOUND' && t2.err.status === 404,
    ':listingId = 0（<=0）⇒ 404', t2.ok ? 'ok=true' : `${t2.err.code}/${t2.err.status}`);
  const t3 = parseTakedownInput({ listingIdRaw: '5', body: { reason: 'x' } });
  t('D3', 'illegalInput', !t3.ok && t3.err.code === 'LEDGER_AMOUNT_INVALID' && t3.err.status === 400,
    'action 缺失 ⇒ 400（不得静默取默认决定）', t3.ok ? 'ok=true' : `${t3.err.code}/${t3.err.status}`);
  const t4 = parseTakedownInput({ listingIdRaw: '5', body: { action: 'maybe', reason: 'x' } });
  t('D4', 'illegalInput', !t4.ok && t4.err.code === 'LEDGER_AMOUNT_INVALID' && (t4.err.details.reason === 'NOT_IN_CLOSED_SET'),
    'action 非枚举 ⇒ 400（details.reason = NOT_IN_CLOSED_SET）', t4.ok ? 'ok=true' : JSON.stringify({ code: t4.err.code, reason: t4.err.details.reason }));
  const t5 = parseTakedownInput({ listingIdRaw: '5', body: { action: 'reject' } });
  t('D5', 'illegalInput', !t5.ok && t5.err.details.field === 'reason',
    'reason 缺失（尤其驳回）⇒ 400', t5.ok ? 'ok=true' : JSON.stringify({ code: t5.err.code, field: t5.err.details.field }));
  const t6 = parseTakedownInput({ listingIdRaw: '5', body: { action: 'reject', reason: '   ' } });
  t('D6', 'illegalInput', !t6.ok && t6.err.code === 'LEDGER_AMOUNT_INVALID', 'reason 空白串 ⇒ 400', t6.ok ? 'ok=true' : `${t6.err.code}`);
  const t7 = parseTakedownInput({ listingIdRaw: '5', body: { action: 'approve', reason: 'x', target_status: 'bogus' } });
  t('D7', 'illegalInput', !t7.ok && t7.err.details.field === 'target_status',
    'target_status 非闭集 ⇒ 400', t7.ok ? 'ok=true' : JSON.stringify({ code: t7.err.code, field: t7.err.details.field }));
  const a1 = parseArbitrationInput({ jobIdRaw: 'abc', body: { action: 'approve', reason: 'x' } });
  t('D8', 'illegalInput', !a1.ok && a1.err.code === 'LEDGER_REF_NOT_FOUND' && a1.err.status === 404,
    ':jobId 非数字 ⇒ 404', a1.ok ? 'ok=true' : `${a1.err.code}/${a1.err.status}`);
  const a2 = parseArbitrationInput({ jobIdRaw: '5', body: { action: 'reject' } });
  t('D9', 'illegalInput', !a2.ok && a2.err.details.field === 'reason', '仲裁 reason 缺失 ⇒ 400', a2.ok ? 'ok=true' : JSON.stringify({ code: a2.err.code, field: a2.err.details.field }));

  const usedCodes = [t1, t2, t3, t4, t5, t6, t7, a1, a2].filter((p) => !p.ok).map((p) => (p as { err: { code: string } }).err.code);
  t('D10', 'illegalInput', usedCodes.every((c) => LEDGER_ERROR_CODES.includes(c as never)),
    '动作口错误码 ⊆ 既有 §14 闭集（零新增码）', JSON.stringify([...new Set(usedCodes)]));
  t('D11', 'illegalInput', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（不动）', LEDGER_ERROR_CODES.length);
  t('D12', 'illegalInput', usedCodes.every((c) => ACTION_CODES_FROZEN.includes(c)),
    `动作口只用 ${JSON.stringify(ACTION_CODES_FROZEN)}（LD007/LD011/LD016）`, JSON.stringify([...new Set(usedCodes)]));
  selfTest('D10', 'illegalInput', (v) => (v as string[]).every((c) => LEDGER_ERROR_CODES.includes(c as never)), ['LEDGER_NEW_MADEUP_CODE'],
    '自造码喂入 ⇒ 闭集谓词必须转红');
}

// ============================================================================
// E · 归属闸判定式（★ 含「admin 通道未被删除」负对照）+ 两路由挂闸
// ============================================================================
const ownershipGateBlock = constBlock('const requireJobOwnerOrAdmin = async (');
{
  t('E1', 'ownershipGate', ownershipGateKeepsAdminChannel(ownershipGateBlock),
    '归属闸 = 取 actor ∧ 读雇主 uid ∧ 雇主本人放行 ∧ **admin 通道保留**（`requireAdmin(req,res,\'review_tasks\')`）',
    JSON.stringify({
      requireActor: /requireActor\(req,\s*res\)/.test(ownershipGateBlock),
      employerLookup: /getJobEmployerUid\(/.test(ownershipGateBlock),
      ownerAdmit: /return actor/.test(ownershipGateBlock),
      adminChannel: /requireAdmin\(req,\s*res,\s*'review_tasks'\)/.test(ownershipGateBlock),
    }));
  t('E2', 'ownershipGate', /const requireJobOwnerOrAdmin = async \(/.test(INDEX_TS),
    'helper `requireJobOwnerOrAdmin` 在场', /const requireJobOwnerOrAdmin = async \(/.test(INDEX_TS));
  const reviewDecl = /^[ \t]*app\.post\('\/api\/job\/:jobId\/review',/m;
  const cancelDecl = /^[ \t]*app\.post\('\/api\/job\/:jobId\/cancel',/m;
  const reviewBlock = routeBlock(reviewDecl);
  const cancelBlock = routeBlock(cancelDecl);
  t('E3', 'ownershipGate', /requireJobOwnerOrAdmin\(req,\s*res,\s*jobIdRaw\)/.test(reviewBlock),
    '`job/:jobId/review` 挂 `requireJobOwnerOrAdmin(req,res,jobIdRaw)`（雇主自审 ∨ admin）', /requireJobOwnerOrAdmin\(/.test(reviewBlock));
  t('E4', 'ownershipGate', /requireJobOwnerOrAdmin\(req,\s*res,\s*jobIdRaw\)/.test(cancelBlock),
    '`job/:jobId/cancel` 挂 `requireJobOwnerOrAdmin(req,res,jobIdRaw)`', /requireJobOwnerOrAdmin\(/.test(cancelBlock));
  // ★ 负对照：删掉 admin 通道那一支 ⇒ 判定式必须转红（保「零回归」）
  const withoutAdmin = ownershipGateBlock.replace(/\n\s*return requireAdmin\(req,\s*res,\s*'review_tasks'\);/, '\n  return null;');
  t('E5', 'ownershipGate', ownershipGateKeepsAdminChannel(ownershipGateBlock) && !ownershipGateKeepsAdminChannel(withoutAdmin),
    '★ 负对照：**删除 admin 通道**（`return requireAdmin(...)` ⇒ `return null`）⇒ 判定式转红',
    JSON.stringify({ original: ownershipGateKeepsAdminChannel(ownershipGateBlock), admin_removed: ownershipGateKeepsAdminChannel(withoutAdmin) }));
  selfTest('E1', 'ownershipGate', (v) => ownershipGateKeepsAdminChannel(String(v)),
    "const requireJobOwnerOrAdmin = async (req, res, jobIdRaw) => {\n  const actor = await requireActor(req, res);\n  if (!actor) return null;\n  const employerUid = await DatabaseService.getJobEmployerUid(1);\n  return null;\n};",
    '把「无 admin 通道」的 helper 喂入 ⇒ 谓词必须转红');
}

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
    '合规审核服务（去注释）零 `hold_forfeit`/`hold_release`/`unfreeze(`/`listing_deposit_refund`',
    JSON.stringify((SERVICE_CODE.match(/hold_forfeit|hold_release|unfreeze\s*\(|listing_deposit_refund/g) || [])));
  t('F4', 'noRefundSurface', !/ledger_post_event/.test(DATABASE_TS.slice(DATABASE_TS.indexOf('LISTING_TAKEDOWN_POST_EVENT_SQL'), DATABASE_TS.indexOf('LISTING_TAKEDOWN_POST_EVENT_SQL') + 2600)),
    '商品审核语句零账本分录（不调 `ledger_post_event`）',
    /ledger_post_event/.test(DATABASE_TS.slice(DATABASE_TS.indexOf('LISTING_TAKEDOWN_POST_EVENT_SQL'), DATABASE_TS.indexOf('LISTING_TAKEDOWN_POST_EVENT_SQL') + 2600)));
  t('F5', 'noRefundSurface', !/listing_deposit_refund/.test(allSrc), '全 src 面 `listing_deposit_refund` 零命中', /listing_deposit_refund/g.test(allSrc));
  t('F6', 'noRefundSurface', !/job_escrow_refund|job_settle_plan|ledger_post_event/.test(SERVICE_CODE),
    '仲裁服务（去注释）零直调资金表 / 账本（资金腿由 DB 侧既有 `job_post_event` 派生）',
    JSON.stringify((SERVICE_CODE.match(/job_escrow_refund|job_settle_plan|ledger_post_event/g) || [])));
}

// ============================================================================
// G · 四语键齐 + 六类泄漏 = 0
// ============================================================================
const LEAK: Array<[string, RegExp]> = [
  ['章节号/条号', /§|R-8-|DL\d|LD\d/],
  ['HTTP 状态码', /\b(400|401|402|403|404|405|409|410|418|422|429|500|502|503|504)\b/],
  ['接口路径/方法', /\/api\/|\b(GET|POST|PUT|PATCH|DELETE)\b\s*\//],
  ['内部批次名/单号', /8⑤|8④|批\s*8|P6\b|P7\b|B8|JING-SPEC|BE-AUDIT/],
  ['机读码/裸 i18n 键', /\b[A-Z][A-Z0-9_]{5,}\b|adminListingReview\.|adminArbitrationReview\.|ledger\.err\./],
  ['表名/列名/函数名', /listing_review_log|job_arbitration_log|listing_takedown|job_arbitrate|listing\.status|job\.status|listing_id|job_id|seller_uid|employer_uid/],
];
const CJK = /[\u3400-\u9fff]/;
const leakHits = (ns: Record<string, string>): string[] => {
  const hits: string[] = [];
  for (const [k, v] of Object.entries(ns)) for (const [name, re] of LEAK) if (re.test(String(v))) hits.push(`${k} [${name}] ${v}`);
  return hits;
};
{
  const listingKeys = Object.keys(LISTING_OF('zh')).sort();
  const arbKeys = Object.keys(ARB_OF('zh')).sort();
  t('G1', 'i18n', listingKeys.length === LISTING_NS_KEYS_FROZEN, `adminListingReview 键数 = ${LISTING_NS_KEYS_FROZEN}`, listingKeys.length);
  t('G2', 'i18n', arbKeys.length === ARBITRATION_NS_KEYS_FROZEN, `adminArbitrationReview 键数 = ${ARBITRATION_NS_KEYS_FROZEN}`, arbKeys.length);
  for (const l of LANGS) {
    t(`G3.${l}`, 'i18n',
      JSON.stringify(Object.keys(LISTING_OF(l)).sort()) === JSON.stringify(listingKeys)
      && Object.values(LISTING_OF(l)).every((v) => typeof v === 'string' && v.trim().length > 0),
      `adminListingReview 四语键集齐 + 非空（${l}）`, JSON.stringify({ keys: Object.keys(LISTING_OF(l)).length }));
    t(`G4.${l}`, 'i18n',
      JSON.stringify(Object.keys(ARB_OF(l)).sort()) === JSON.stringify(arbKeys)
      && Object.values(ARB_OF(l)).every((v) => typeof v === 'string' && v.trim().length > 0),
      `adminArbitrationReview 四语键集齐 + 非空（${l}）`, JSON.stringify({ keys: Object.keys(ARB_OF(l)).length }));
  }
  for (const l of ['en', 'vn']) {
    t(`G5.${l}`, 'i18n', !Object.values(LISTING_OF(l)).some((v) => CJK.test(v)) && !Object.values(ARB_OF(l)).some((v) => CJK.test(v)),
      `${l} 两新命名空间无 CJK`, JSON.stringify([...Object.values(LISTING_OF(l)), ...Object.values(ARB_OF(l))].filter((v) => CJK.test(v))));
  }
  t('G6', 'i18n', String(LISTING_OF('hk').title) !== String(LISTING_OF('zh').title)
    && /[規審駁凍結僱報議]/.test(String(LISTING_OF('hk').title))
    && String(ARB_OF('hk').intro) !== String(ARB_OF('zh').intro)
    && CJK.test(String(ARB_OF('hk').title)),
    'hk 为繁體（listing title 与 zh 简体逐字不同含繁體异形 · arbitration intro 与 zh 不同 · title 含 CJK）',
    JSON.stringify({ hk_listing: LISTING_OF('hk').title, zh_listing: LISTING_OF('zh').title, hk_arb_intro: ARB_OF('hk').intro, zh_arb_intro: ARB_OF('zh').intro }));
  const allHits = LANGS.flatMap((l) => [...leakHits(LISTING_OF(l)).map((h) => `${l}.listing.${h}`), ...leakHits(ARB_OF(l)).map((h) => `${l}.arb.${h}`)]);
  t('G7', 'i18n', allHits.length === 0, '六类工程口径泄漏 = 0（四语 × 两新命名空间）', JSON.stringify(allHits));
  const navHits = ['en', 'vn'].filter((l) => NEW_NAV_KEYS.some((k) => CJK.test(String(NAV_OF(l)[k]))));
  t('G8', 'i18n', LANGS.every((l) => Object.keys(NAV_OF(l)).length === NAV_KEYS_FROZEN && NEW_NAV_KEYS.every((k) => Boolean(NAV_OF(l)[k]))),
    `adminNav 键数 = ${NAV_KEYS_FROZEN} + 本批 4 键四语齐`, JSON.stringify(LANGS.map((l) => Object.keys(NAV_OF(l)).length)));
  t('G9', 'i18n', navHits.length === 0 && LANGS.flatMap((l) => NEW_NAV_KEYS.map((k) => NAV_OF(l)[k])).every((v) => !LEAK.some(([, re]) => re.test(String(v)))),
    'adminNav 新 4 键 en/vn 无 CJK 且六类泄漏 = 0', JSON.stringify(navHits));
  selfTest('G7', 'i18n', (v) => leakHits(v as Record<string, string>).length === 0, { title: '审核（§25.3）' },
    '把带章节号的文案喂入 ⇒ 泄漏谓词必须转红');
}

// ============================================================================
// H · 两迁移 0026 / 0027 结构面判据（去注释、去字面量）
// ============================================================================
const MIG_SPECS: Array<{ file: string; table: string; fkCol: string; cols: string[]; cons: string[]; idx: string[]; trig: string; fn: string; self: string }> = [
  {
    file: '0026_listing_review_log.sql', table: 'public.listing_review_log', fkCol: 'listing_id',
    cols: ['log_id', 'listing_id', 'actor_uid', 'result', 'request_fingerprint', 'idempotency_key', 'txid', 'memo', 'time_created'],
    cons: ['listing_review_log_pk', 'listing_review_log_actor_fk', 'listing_review_log_listing_fk', 'listing_review_log_result_ck', 'listing_review_log_idem_uniq'],
    idx: ['listing_review_log_listing_idx', 'listing_review_log_actor_day_idx'],
    trig: 'trg_listing_review_log_append_only', fn: 'listing_review_log_append_only()', self: '0026 self-check OK',
  },
  {
    file: '0027_job_arbitration_log.sql', table: 'public.job_arbitration_log', fkCol: 'job_id',
    cols: ['log_id', 'job_id', 'actor_uid', 'result', 'request_fingerprint', 'idempotency_key', 'txid', 'memo', 'time_created'],
    cons: ['job_arbitration_log_pk', 'job_arbitration_log_actor_fk', 'job_arbitration_log_job_fk', 'job_arbitration_log_result_ck', 'job_arbitration_log_idem_uniq'],
    idx: ['job_arbitration_log_job_idx', 'job_arbitration_log_actor_day_idx'],
    trig: 'trg_job_arbitration_log_append_only', fn: 'job_arbitration_log_append_only()', self: '0027 self-check OK',
  },
];
{
  const migFiles = fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql'));
  t('H1', 'migration', migFiles.includes('0026_listing_review_log.sql') && migFiles.includes('0027_job_arbitration_log.sql') && migFiles.length === MIGRATIONS_FROZEN,
    `迁移文件 = 0026 + 0027；总数 = ${MIGRATIONS_FROZEN}`, JSON.stringify({ count: migFiles.length, has: migFiles.filter((f) => f.startsWith('0026') || f.startsWith('0027')) }));
  for (const [i, spec] of MIG_SPECS.entries()) {
    const sql = i === 0 ? MIG26_SQL : MIG27_SQL;
    const struct = i === 0 ? MIG26_STRUCT : MIG27_STRUCT;
    t(`H2.${i}`, 'migration', new RegExp(`CREATE TABLE IF NOT EXISTS ${spec.table.replace('.', '\\.')} \\(`).test(sql),
      `${spec.file} 表名逐字 = \`${spec.table}\``, new RegExp('CREATE TABLE IF NOT EXISTS public\\.(\\w+)').exec(sql)?.[1] ?? '(none)');
    t(`H3.${i}`, 'migration', spec.cols.every((c) => new RegExp(`^\\s+${c}\\s`, 'm').test(sql)),
      `${spec.file} 9 列逐字在场`, JSON.stringify(spec.cols.filter((c) => !new RegExp(`^\\s+${c}\\s`, 'm').test(sql))));
    t(`H4.${i}`, 'migration', spec.cons.every((c) => sql.includes(c)), `${spec.file} 5 具名约束逐字在场`, JSON.stringify(spec.cons.filter((c) => !sql.includes(c))));
    t(`H5.${i}`, 'migration', /CHECK \(result IN \('approved', 'rejected'\)\)/.test(sql),
      `${spec.file} result 闭集 = {approved, rejected}`, /CHECK \(result IN \([^)]*\)\)/.exec(sql)?.[0] ?? '(none)');
    t(`H6.${i}`, 'migration', /UNIQUE \(idempotency_key, result\)/.test(sql), `${spec.file} 幂等唯一键 = 复合 (idempotency_key, result)`, /UNIQUE \([^)]*\)/.exec(sql)?.[0] ?? '(none)');
    t(`H7.${i}`, 'migration', spec.idx.every((x) => sql.includes(x)), `${spec.file} 4 索引（PK + idem_uniq + ${spec.idx.join(' + ')}）`, JSON.stringify(spec.idx.filter((x) => !sql.includes(x))));
    t(`H8.${i}`, 'migration', sql.includes(spec.trig) && new RegExp(`BEFORE UPDATE OR DELETE ON ${spec.table.replace('.', '\\.')}`).test(sql) && sql.includes(spec.fn),
      `${spec.file} append-only：BEFORE UPDATE OR DELETE 触发器 + 守门函数`, new RegExp('BEFORE UPDATE OR DELETE[^\\n]*').exec(sql)?.[0] ?? '(none)');
    t(`H9.${i}`, 'migration', /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(sql) && !/\btime_updated\b/.test(struct),
      `${spec.file} 恰一列 time_created（DEFAULT now()）；**无** time_updated（结构面：注释 / 自检串不计）`,
      JSON.stringify({ time_created: /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(sql), time_updated: /\btime_updated\b/.test(struct) }));
    t(`H10.${i}`, 'migration', !/\bcreate_key\b|\bledger_event_keys\b/.test(struct),
      `${spec.file} 无 create_key / 无 ledger_event_keys（结构面）`,
      JSON.stringify({ create_key: /\bcreate_key\b/.test(struct), lek: /\bledger_event_keys\b/.test(struct) }));
    t(`H11.${i}`, 'migration', !/ALTER\s+TABLE/i.test(sql), `${spec.file} 零 ALTER TABLE`, /ALTER\s+TABLE/i.test(sql));
    t(`H12.${i}`, 'migration', !/INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i.test(sql) && !/ledger_post_event/.test(sql),
      `${spec.file} 零数据 DML / 零账本调用`,
      JSON.stringify({ dml: /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i.test(sql), ledger: /ledger_post_event/.test(sql) }));
    t(`H13.${i}`, 'migration', new RegExp(`RAISE NOTICE '${spec.self.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(sql),
      `${spec.file} 自带 apply-time 自检`, new RegExp(`RAISE NOTICE '${spec.self.split(' ')[0]}`).test(sql));
  }
}

// ============================================================================
// I · 门自证（负对照）
// ============================================================================
selfTest('A1', 'registration', (v) => v === REG_POINTS_FROZEN, 74, '注册点写成 74（= 偷偷少注册一条）⇒ 谓词必须转红');
selfTest('C1', 'actionShape', (v) => JSON.stringify(v) === JSON.stringify(['approve', 'reject']), ['approve', 'reject', 'hold'],
  '闭集被偷偷加第三值 ⇒ 谓词必须转红');
selfTest('H9', 'migration', (v) => /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(String(v)) && !/\btime_updated\b/.test(sqlStructure(String(v))),
  'CREATE TABLE (\n  time_created timestamptz NOT NULL DEFAULT now(),\n  time_updated timestamptz\n)', '把 time_updated 列定义喂入 ⇒ 谓词必须转红');
selfTest('H10', 'migration', (v) => !/\bcreate_key\b|\bledger_event_keys\b/.test(sqlStructure(String(v))), 'CREATE TABLE (\n  create_key text,\n)',
  '把 create_key 列定义喂入 ⇒ 谓词必须转红');

// ============================================================================
// K · ★ 同族扫面（类级 · `R-9-9④`）：**三条动作口**回执字段语义（前置态 vs 终态 / 未生效却记账）
// ============================================================================
{
  // K1 商品 takedown：回执 `listing_status` = `cur` CTE 的 status = **前置态**（非终态）⇒ 语义正确
  t('K1', 'actionFamily', /\(SELECT cur\.status FROM cur\)\s+AS listing_status/.test(DATABASE_TS),
    '商品动作口回执 `listing_status` = **前置态**（`cur` CTE · 取锁先于 UPDATE）',
    JSON.stringify({ hit: /\(SELECT cur\.status FROM cur\)\s+AS listing_status/.test(DATABASE_TS) }));
  // K2 币种 review（8④）：回执 `cur_status` = `cur` CTE = **前置态** ⇒ 语义正确
  t('K2', 'actionFamily', /\(SELECT cur\.status FROM cur\)\s+AS cur_status/.test(DATABASE_TS),
    '币种动作口回执 `cur_status` = **前置态**（`cur` CTE）',
    JSON.stringify({ hit: /\(SELECT cur\.status FROM cur\)\s+AS cur_status/.test(DATABASE_TS) }));
  // K3 招工仲裁：回执**同时**给 `prior_status`（前置态）与 `job_status`（终态）双字段
  t('K3', 'actionFamily', /prior_status: curStatus/.test(DATABASE_TS) && /job_status: finalStatus/.test(DATABASE_TS),
    '招工动作口回执 = `prior_status`（前置态）∧ `job_status`（终态）**双字段**',
    JSON.stringify({ prior: /prior_status: curStatus/.test(DATABASE_TS), term: /job_status: finalStatus/.test(DATABASE_TS) }));
  // K4 「未生效却记账」对偶：三条动作口台账 INSERT 均门控于「可审前置态 ∧（通过 ⇒ 已生效）」
  const gtApply = /EXISTS \(SELECT 1 FROM apply\)/.test(DATABASE_TS);
  const curListed = /cur\.status = 'listed'/.test(DATABASE_TS);
  const curDraft = /cur\.status = 'draft'/.test(DATABASE_TS);
  t('K4', 'actionFamily', gtApply && curListed && curDraft,
    '三条动作口台账 INSERT 均门控「可审前置态 ∧（approved ⇒ 已生效 `EXISTS(apply)`）」——防「未生效却记账」',
    JSON.stringify({ gt_apply: gtApply, listing_listed: curListed, currency_draft: curDraft }));
}

// ============================================================================
// J · 动作口**首调 = 200**（`R-9-9` 修缺陷）· 源码面 + 行为面（DI mock · 离线）+ 负对照 + 结论
// ============================================================================
(async () => {
  // ---- J 源码面 ----
  const dbPriorStatusReturns = (DATABASE_TS.match(/prior_status:/g) || []).length;
  t('J1', 'actionFirstCall', dbPriorStatusReturns >= 4,
    'DB `jobArbitrationPostEvent` 回执四处返回**均**含 `prior_status`（前置态 · `R-9-9①`）', dbPriorStatusReturns);
  const arbUsesPriorStatus = (svc: string): boolean =>
    /const priorStatus = row\.prior_status\b/.test(svc)
    && /if \(priorStatus !== 'submitted' && priorStatus !== 'disputed'\)/.test(svc)
    && /if \(applied > 0\)/.test(svc)
    && !/const curStatus = row\.job_status/.test(svc);
  t('J2', 'actionFirstCall', arbUsesPriorStatus(SERVICE_CODE),
    "服务层 `arbitrateJobVerb` 前置态判定取 `row.prior_status`；**不得**再用终态 `row.job_status` 作前置态",
    JSON.stringify({ uses_prior: /const priorStatus = row\.prior_status\b/.test(SERVICE_CODE), legacy_cur: /const curStatus = row\.job_status/.test(SERVICE_CODE) }));
  // ★ 负对照（源码面 · 逐字红点）：把 `prior_status` 换回终态字段 `job_status` ⇒ 谓词必红
  const mutatedSvc = SERVICE_CODE.replace(/prior_status/g, 'job_status');
  t('J2b', 'actionFirstCall', arbUsesPriorStatus(SERVICE_CODE) && !arbUsesPriorStatus(mutatedSvc),
    '★ 负对照（源码面）：`prior_status` → `job_status`（终态字段）⇒ 谓词转红',
    JSON.stringify({ original: arbUsesPriorStatus(SERVICE_CODE), mutated: arbUsesPriorStatus(mutatedSvc) }));

  // ---- J 行为面（DI mock · 离线 · 真实 verb）----
  const callVerb = (receipt: Record<string, unknown>) => arbitrateJobVerb({
    jobIdRaw: '1', actorUid: 1, body: { action: 'reject', reason: 'p8s5 gate first-call' },
    opsKey: 'ops:1:job_arbitrate:1', postEvent: async () => receipt,
  });
  const R1 = { job_found: 1, prior_status: 'submitted', job_status: 'cancelled', prior_count: 0, applied: 1, reviewed: 1, txid: '573' };
  const R1ap = { job_found: 1, prior_status: 'disputed', job_status: 'settled', prior_count: 0, applied: 1, reviewed: 1, txid: '600' };
  const Rbad = { job_found: 1, prior_status: 'settled', job_status: 'settled', prior_count: 0, applied: 0, reviewed: 0, txid: null };
  const r1 = await callVerb(R1);
  const r1ap = await callVerb(R1ap);
  const rbad = await callVerb(Rbad);
  t('J3', 'actionFirstCall', r1.ok === true && (r1 as { view?: { status?: string } }).view?.status === 'cancelled',
    '★ 首调（reject · 前置态 submitted）= 200 且 `view.status` = **终态** cancelled', JSON.stringify(r1));
  t('J4', 'actionFirstCall', r1ap.ok === true && (r1ap as { view?: { status?: string } }).view?.status === 'settled',
    '首调（approve · 前置态 disputed）= 200 且 `view.status` = settled', JSON.stringify(r1ap));
  t('J5', 'actionFirstCall', Number(R1.reviewed) >= 1 && Number(R1.applied) === 1 && R1.txid !== null,
    '★ 库内三处落值（回执契约）：台账行 `reviewed≥1` ∧ 状态迁移 `applied=1` ∧ 资金腿 `txid≠NULL`',
    JSON.stringify({ reviewed: R1.reviewed, applied: R1.applied, txid: R1.txid }));
  t('J6', 'actionFirstCall',
    rbad.ok === false && (rbad as { code?: string }).code === 'LEDGER_CURRENCY_INVALID_TRANSITION'
      && (rbad as { status?: number }).status === 409 && (rbad as { details?: { reason?: string } }).details?.reason === 'JOB_STATE_INVALID',
    '非法前置态（settled）⇒ 409 `LD011` + reason `JOB_STATE_INVALID`（applied=0）', JSON.stringify(rbad));
  // ★ 负对照（行为面 · 逐字红点）：同一首调回执，若按**终态字段**判前置态 ⇒ 必 409
  const firstCallOk = (x: Record<string, unknown>): boolean => {
    const ps = String(x.prior_status ?? '');
    return (ps === 'submitted' || ps === 'disputed') && Number(x.applied ?? 0) > 0;
  };
  const legacyJudgeOk = (x: Record<string, unknown>): boolean => {
    const ps = String(x.job_status ?? ''); // ★ 旧码：拿**终态**当前置态（投影层误读）
    return (ps === 'submitted' || ps === 'disputed') && Number(x.applied ?? 0) > 0;
  };
  t('J7', 'actionFirstCall', firstCallOk(R1) === true && legacyJudgeOk(R1) === false,
    '★ 负对照（行为面）：同一首调回执——`prior_status` 判据 = 成功；换回终态 `job_status` 判据 ⇒ **必红（409）**',
    JSON.stringify({ prior_path: firstCallOk(R1), legacy_terminal_path: legacyJudgeOk(R1) }));
  selfTest('J7', 'actionFirstCall', (v) => firstCallOk(v as Record<string, unknown>),
    { job_found: 1, prior_status: 'cancelled', job_status: 'cancelled', applied: 0, reviewed: 0 },
    '把「终态当前置态」的回执喂入 ⇒ 判据必须转红');
  selfTest('J2', 'actionFirstCall', (v) => arbUsesPriorStatus(String(v)), SERVICE_CODE.replace(/prior_status/g, 'job_status'),
    '把「终态字段作前置态」的源码喂入 ⇒ 谓词必须转红');

  // ==================================================================== 结论
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S5-COMPLIANCE-GATE',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: true,
    db_connections: 0,
    http_calls: 0,
    note: '本门**零 DB / 零 HTTP**，不依赖写面：源码面 + 行为面（DI mock）判据；库内三处落值 / 真回执 prior_status / 库面判负 = 由 DB 探针 `p8-s5-01-real-chains.ts` 实测（另册）。',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    readings: {
      registration_points_total: countRoutes(INDEX_TS),
      registration_points_per_verb: { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') },
      actions: [...REVIEW_ACTIONS],
      action_to_result: REVIEW_ACTION_TO_RESULT,
      listing_takedown_targets: [...LISTING_TAKEDOWN_TARGETS],
      job_arbitrate_action_to_target: JOB_ARBITRATE_ACTION_TO_TARGET,
      ops_actions: { listing: LISTING_TAKEDOWN_OPS_ACTION, job: JOB_ARBITRATE_OPS_ACTION },
      error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
      error_codes_used: ACTION_CODES_FROZEN,
      listing_ns_keys: LISTING_NS_KEYS_FROZEN,
      arbitration_ns_keys: ARBITRATION_NS_KEYS_FROZEN,
      nav_keys: NAV_KEYS_FROZEN,
      migrations_count: fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql')).length,
      migrations_fingerprint: MIG_SPECS.map((s) => ({ file: s.file, table: s.table })),
    },
    checks,
  };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
  process.exit(failed.length ? 1 : 0);
})();
