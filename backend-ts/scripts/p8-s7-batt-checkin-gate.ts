/**
 * 批 9 第 2 片（P9② · `route-layer.spec` v2.14 §28 · `data-layer.spec` v0.21 §31）：
 * **batt 电量 + 签到 / 补签** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s7-batt-checkin-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s7-artifacts/p8s7-<RUN>/gate.json
 *
 * ★ **静态段（A–F）零 DB / 零网络**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）。
 * ★ **库面 leg 转真 checks（G 段 · 连库 + HTTP）**：`0028`/`0029` **已 apply** ⇒ 其 DB 级效果
 *   （约束活体 21〔`0032` 未 apply〕/ 4 表 + 4 触发器 + 具名索引 / `ledger_kind_ok` 活体 / 范围 CHECK /
 *   append-only 真行为 / 4 新口真 HTTP 401⇄200）**在本门内逐条真读数入 `checks`** ⇒ `pending_apply[]` = **0**。
 *   DB 段 = 只读 + **事务内行为探针（末尾 ROLLBACK）**；HTTP 段打受控实例 `P8S7_BASE`（默认 `127.0.0.1:5797`）。
 *
 * 判据（每条**可判负**）：
 *   A  **注册点 89 逐 verb + 4 新口在场**：`get 38 / post 48 / put 0 / patch 1 / delete 2`（和 = 89）；
 *      4 路径逐条注册**恰 1 处**；负对照（缩进注入 ⇒ +1）
 *   B  **4 新口形态**：四口全闸 `requireActor`（零 admin 键）；取数 / 响应冻结键集逐条；幂等键 `biz:` 派生形；
 *      `target_day` 服务端校验；异常面 `sendInfraMapped` 四标签；负对照（注入 admin 闸 ⇒ 谓词转红）
 *   C  **双闸两处**：① `applyToJob` **前置拦**（`batt_account` ≥ 阈值，落 INSERT CTE `WHERE` 内 · fail-fast）；
 *      ② `acceptJobApplication` **权威扣费点**（同事务 `deduct` 扣 `taskCostBatt` + 二次判 `b.batt >= cost`）；
 *      两处各映射 `batt_below_threshold` ⇒ `stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD')`（借既有码）；负对照
 *   D  **kind 闭集编码（P9⑤ 后 = 24）**：现役三处（① `0038` `ledger_kind_enum` CHECK ② `0038` `ledger_kind_ok`
 *      ③ TS `LEDGER_KINDS`；= 24 同集）+ P9④ 历史两处（`0032` CHECK / 函数 = 23，已被 `0038` 取代）
 *      + P9② 历史两处（`0028` CHECK / `0029` 函数 = 21）；**穷举扫面结论「无未登记全闭集编码」**（正则 + 命中分类逐桶）
 *   E  **幂等 / 日界 / 溢出 / 配置 fail-closed**：`biz:checkin:<uid>:<day>` / `biz:checkin:makeup:<uid>:<day>`；
 *      日界 = UTC（`now() AT TIME ZONE 'UTC'` / `utcDay`）；溢出 = 封顶丢弃（`LEAST` + `delta <> 0` 守卫）；
 *      配置 fail-closed（`resolveBattPolicy` / `resolveCheckinPolicy` 逐字段回落常量）；负对照
 *   F  **零新增错误码（仍恰 33）**：补签拒绝面只用既有闭集码（`LEDGER_AMOUNT_INVALID` /
 *      `LEDGER_INSUFFICIENT_BALANCE` / `LEDGER_CURRENCY_INVALID_TRANSITION`）；负对照
 *   G  **库面 leg 转真 checks（连库 + HTTP）**：活体 `ledger_kind_enum`（`0038` 已 apply ⇒ 24）/
 *      4 表 + 约束 + 具名索引 / 4 触发器 / `ledger_kind_ok` 活体 / `batt_account` 范围 CHECK / append-only 真行为 /
 *      4 新口真 HTTP（无 token 401 ⇄ 有 token 200）+ 公开面零回归；`pending_apply[]` = 0
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BATT_POLICY_DEFAULTS,
  CHECKIN_POLICY_DEFAULTS,
  DatabaseService,
  resolveBattPolicy,
  resolveCheckinPolicy,
} from '../src/database';
import { LEDGER_KINDS } from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { createSessionToken } from '../src/auth';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s7-artifacts', `p8s7-${RUN}`);
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

// ---------------------------------------------------------------- 读源码
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const JOB_SERVICE_TS = readSrc('backend-ts/src/job-service.ts');
const LEDGER_TS = readSrc('backend-ts/src/ledger.ts');
const SQL_0028 = readSrc('backend-ts/migrations/0028_kind_close_set_21.sql');
const SQL_0029 = readSrc('backend-ts/migrations/0029_batt_checkin.sql');
const SQL_0032 = readSrc('backend-ts/migrations/0032_kind_close_set_23.sql');
const SQL_0038 = readSrc('backend-ts/migrations/0038_kind_close_set_24.sql');
const FE_BATT_JS = readSrc('frontend/src/batt-checkin.js');
const FE_PANEL_JSX = readSrc('frontend/src/components/BattCheckinPanel.jsx');

// ---------------------------------------------------------------- 冻结常量
// ★ S11 注册点前推（沿 R-8-22）：注册点 88 → 89（S6 新增 GET /api/job/:jobId/submissions +1；逐 commit 归因 692f622）。
const REG_POINTS_FROZEN = 89;
const PER_VERB_FROZEN: Record<string, number> = { get: 38, post: 48, put: 0, patch: 1, delete: 2 };
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number =>
  (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const countOf = (hay: string, re: RegExp): number => (hay.match(re) || []).length;

/** 从源码切「某注册点起、到下一个注册点止」的 handler 文本（沿 p8-s2 先例）。 */
const handlerBlock = (src: string, routeLiteral: string): string => {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes(routeLiteral));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    // 先收本路由自身的顶层收口 `});`：P9③ 在两路由之间插入了顶层 helper `sendOrderTransition`
    // ⇒ 旧「切到下一注册点」会把 helper 里的码（`AUTH_FORBIDDEN` / `LEDGER_REF_NOT_FOUND`）误并进本 handler，令 F2 假红。
    if (/^\}\);/.test(lines[i])) { end = i + 1; break; }
    if (/^\s*app\.(get|post|put|delete|patch)\(/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
};
const R_BATT = "app.get('/api/batt'";
const R_CHECKIN_GET = "app.get('/api/checkin'";
const R_CHECKIN_POST = "app.post('/api/checkin'";
const R_MAKEUP = "app.post('/api/checkin/makeup'";
const BLOCK_BATT = handlerBlock(INDEX_TS, R_BATT);
const BLOCK_CHECKIN_GET = handlerBlock(INDEX_TS, R_CHECKIN_GET);
const BLOCK_CHECKIN_POST = handlerBlock(INDEX_TS, R_CHECKIN_POST);
const BLOCK_MAKEUP = handlerBlock(INDEX_TS, R_MAKEUP);
const BLOCKS4 = [BLOCK_BATT, BLOCK_CHECKIN_GET, BLOCK_CHECKIN_POST, BLOCK_MAKEUP];

/** 从 handler 体内抽出 `sendSuccess(res, { … }, …)` 的键集（对象可单行 / 多行）。 */
const successKeys = (block: string): string[] => {
  const m = block.match(/sendSuccess\(\s*res,\s*\{([\s\S]*?)\}\s*[,)]/);
  if (!m) return [];
  return (m[1].match(/(?:^|[,{])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm) || [])
    .map((s) => s.replace(/^[\s,{]*/, '').replace(/\s*:$/, '')).sort();
};
const eqJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/**
 * 取 `sendSuccess(res, { … })` 对象体的**顶层**键集（排序）。
 * 既有 `successKeys` 是扁平正则 ⇒ 会把嵌套子对象（P9④ `bttc: { … }`）的内层键也误并进键集。
 * 本函数用**括号深度**切顶层逗号：嵌套子对象只贡献 1 个键（其名），内层键不计入。
 */
const topLevelSuccessKeys = (block: string): string[] => {
  const m = block.match(/sendSuccess\(\s*res,\s*\{([\s\S]*?)\}\s*[,)]/);
  if (!m) return [];
  const body = m[1]; // 非贪婪 ⇒ 到首个 `}` 前（嵌套子对象的收 `}`，故外层 `{` 未补齐）
  const parts: string[] = [];
  let depth = 0; let cur = ''; let inStr: string | null = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inStr) { cur += ch; if (ch === '\\') { cur += body[i + 1] ?? ''; i += 1; } else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; cur += ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => (p.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/) || [])[1]).filter(Boolean).sort();
};

// ============================================================================
// A · 注册点 89 逐 verb + 4 新口在场
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
    `注册点 = ${REG_POINTS_FROZEN}（P9② batt/签到 4 新口 +4〔76→80〕⇒ P9③ 评分/时效/订单 5 新口 +5〔80→85〕⇒ P9④ BTTC 铸造/分解 2 新口 +2〔85→87〕⇒ 8⑥ 审计台统一读口 +1〔87→88〕⇒ S6 新增 GET /api/job/:jobId/submissions +1〔88→89〕）`, countRoutes(INDEX_TS));
  t('A2', 'registration', eqJson(perVerb, PER_VERB_FROZEN),
    `逐 verb 逐字 = ${JSON.stringify(PER_VERB_FROZEN)}`, JSON.stringify(perVerb));
  t('A3', 'registration', Object.values(perVerb).reduce((a, b) => a + b, 0) === REG_POINTS_FROZEN,
    '逐 verb 计数之和 = 注册点总数', JSON.stringify(perVerb));
  const newRoutes = [R_BATT, R_CHECKIN_GET, R_CHECKIN_POST, R_MAKEUP];
  const present = newRoutes.map((r) => countOf(INDEX_TS, new RegExp(r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')));
  t('A4', 'registration', present.every((n) => n === 1),
    '4 新口逐条注册**恰 1 处**（`GET /api/batt` / `GET /api/checkin` / `POST /api/checkin` / `POST /api/checkin/makeup`）', JSON.stringify(present));
  const INJ = "  app.get('/api/p8s7-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  const injCount = countRoutes(INDEX_TS + INJ);
  t('A5', 'registration', injCount === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`, JSON.stringify({ injected: injCount }));
  selfTest('A1', 'registration', (v) => countRoutes(String(v)) === REG_POINTS_FROZEN, 'x', '把非 89 条路由的文本喂入「注册点 = 89」谓词 ⇒ 必须转红');
}

// ============================================================================
// B · 4 新口形态（闸 · 取数 · 响应键集 · 幂等键 · 审计标签）
// ============================================================================
{
  // ① 四口全闸 requireActor；零 admin 键新增（无 requireAdmin）
  const actorOk = BLOCKS4.every((b) => /requireActor\(req,\s*res\)/.test(b));
  const noAdmin = BLOCKS4.every((b) => !/requireAdmin\(/.test(b));
  t('B1', 'routeShape', actorOk && noAdmin,
    '★ 四口全闸 `requireActor(req, res)`（用户本人 · uid 取自 token）且**零** `requireAdmin(` ⇒ 零 admin 权限键新增',
    JSON.stringify({ actor_in_all: actorOk, requireAdmin_in_any: !noAdmin }));
  selfTest('B1', 'routeShape', (v) => /requireActor\(req,\s*res\)/.test(String(v)) && !/requireAdmin\(/.test(String(v)),
    "app.get('/api/batt', async (req, res) => { const actor = await requireAdmin(req, res, 'manage_settings'); if (!actor) return; });",
    '把「带 admin 闸」的 handler 喂入 ⇒ 谓词必须转红');

  // ② R1 GET /api/batt：顶层 7 键（P9④ 追加 `bttc` 子对象）+ getBatt + getBttcState
  t('B2', 'routeShape',
    eqJson(topLevelSuccessKeys(BLOCK_BATT), ['acceptThresholdBatt', 'batt', 'bttc', 'canAccept', 'capBatt', 'floorBatt', 'updated_at'])
    && /DatabaseService\.getBatt\(/.test(BLOCK_BATT)
    && /DatabaseService\.getBttcState\(/.test(BLOCK_BATT),
    'R1 `GET /api/batt`：`data` 顶层冻结 **7 键**（既有 6 键 batt/capBatt/floorBatt/acceptThresholdBatt/canAccept/updated_at **逐字不动** + P9④ 追加 `bttc` 子对象）+ 取数 `DatabaseService.getBatt(` + `DatabaseService.getBttcState(`',
    JSON.stringify({ keys: topLevelSuccessKeys(BLOCK_BATT), getBatt: /DatabaseService\.getBatt\(/.test(BLOCK_BATT), getBttcState: /DatabaseService\.getBttcState\(/.test(BLOCK_BATT) }));

  // ③ R2 GET /api/checkin：6 键 + getCheckinStatus
  t('B3', 'routeShape',
    eqJson(successKeys(BLOCK_CHECKIN_GET), ['canMakeup', 'checkedInToday', 'makeupCostUsd', 'streakCapDays', 'streakDay', 'updated_at'])
    && /DatabaseService\.getCheckinStatus\(/.test(BLOCK_CHECKIN_GET),
    'R2 `GET /api/checkin`：`data` 冻结 6 键（streakDay/streakCapDays/checkedInToday/canMakeup/makeupCostUsd/updated_at）+ 取数 `DatabaseService.getCheckinStatus(`',
    JSON.stringify({ keys: successKeys(BLOCK_CHECKIN_GET), getCheckinStatus: /DatabaseService\.getCheckinStatus\(/.test(BLOCK_CHECKIN_GET) }));

  // ④ A1 POST /api/checkin：4 键 + checkin + 幂等键
  t('B4', 'routeShape',
    eqJson(successKeys(BLOCK_CHECKIN_POST), ['batt', 'checkedIn', 'rewardBatt', 'streakDay'])
    && /DatabaseService\.checkin\(/.test(BLOCK_CHECKIN_POST)
    && /bizKeyOf\('checkin',\s*uid,\s*utcDay\(\)\)/.test(BLOCK_CHECKIN_POST),
    "A1 `POST /api/checkin`：`data` 冻结 4 键（checkedIn/streakDay/rewardBatt/batt）+ `DatabaseService.checkin(` + 幂等键 `bizKeyOf('checkin', uid, utcDay())`",
    JSON.stringify({ keys: successKeys(BLOCK_CHECKIN_POST), checkin: /DatabaseService\.checkin\(/.test(BLOCK_CHECKIN_POST), idem: /bizKeyOf\('checkin',\s*uid,\s*utcDay\(\)\)/.test(BLOCK_CHECKIN_POST) }));

  // ⑤ A2 POST /api/checkin/makeup：3 键 + checkinMakeup + 幂等键 + target_day 服务端校验
  t('B5', 'routeShape',
    eqJson(successKeys(BLOCK_MAKEUP), ['costUsd', 'restoredStreakDay', 'txid'])
    && /DatabaseService\.checkinMakeup\(/.test(BLOCK_MAKEUP)
    && /bizKeyOf\('checkin',\s*'makeup',\s*uid,\s*targetRaw\)/.test(BLOCK_MAKEUP),
    "A2 `POST /api/checkin/makeup`：`data` 冻结 3 键（restoredStreakDay/costUsd/txid）+ `DatabaseService.checkinMakeup(` + 幂等键 `bizKeyOf('checkin', 'makeup', uid, targetRaw)`",
    JSON.stringify({ keys: successKeys(BLOCK_MAKEUP), checkinMakeup: /DatabaseService\.checkinMakeup\(/.test(BLOCK_MAKEUP), idem: /bizKeyOf\('checkin',\s*'makeup',\s*uid,\s*targetRaw\)/.test(BLOCK_MAKEUP) }));
  t('B6', 'routeShape', /isBusinessDay\(targetRaw\)/.test(BLOCK_MAKEUP) && /req\.body\?\.target_day/.test(BLOCK_MAKEUP),
    '★ `target_day` 入幂等键 / 入 SQL 前经服务端 `isBusinessDay(targetRaw)` 校验（非法 ⇒ 400，不入库）',
    JSON.stringify({ isBusinessDay: /isBusinessDay\(targetRaw\)/.test(BLOCK_MAKEUP), readsBody: /req\.body\?\.target_day/.test(BLOCK_MAKEUP) }));

  // ⑥ 异常面：sendInfraMapped 四标签
  const labels = ['batt.get', 'checkin.get', 'checkin.post', 'checkin.makeup'];
  const labelOk = BLOCKS4.every((b, i) => b.includes(`sendInfraMapped(res, '${labels[i]}'`));
  t('B7', 'routeShape', labelOk, "四口基础设施异常 ⇒ 既有 §14 分类器 `sendInfraMapped`（标签 'batt.get'/'checkin.get'/'checkin.post'/'checkin.makeup'）",
    JSON.stringify(labels.map((l, i) => BLOCKS4[i].includes(`'${l}'`))));
  selfTest('B7', 'routeShape', (v) => String(v).includes("sendInfraMapped(res, 'checkin.makeup'"), "sendInfraMapped(res, 'wrong.label'", '把错标签喂入给 label 谓词 ⇒ 必须转红');
}

// ============================================================================
// C · 双闸两处（apply 前置拦 / accept 同事务扣 + 二次判）
// ============================================================================
const APPLY_START = DATABASE_TS.indexOf('static async applyToJob(');
const ACCEPT_START = DATABASE_TS.indexOf('static async acceptJobApplication(');
const AFTER_ACCEPT = DATABASE_TS.indexOf('static async listPendingVerification(');
const APPLY_REGION = APPLY_START >= 0 && ACCEPT_START > APPLY_START ? DATABASE_TS.slice(APPLY_START, ACCEPT_START) : '';
const ACCEPT_REGION = ACCEPT_START >= 0 && AFTER_ACCEPT > ACCEPT_START ? DATABASE_TS.slice(ACCEPT_START, AFTER_ACCEPT) : '';
{
  t('C0', 'doubleGate', APPLY_REGION.length > 0 && ACCEPT_REGION.length > 0,
    '双闸两处区域切分成功（`applyToJob` / `acceptJobApplication`）', JSON.stringify({ apply_bytes: APPLY_REGION.length, accept_bytes: ACCEPT_REGION.length }));

  // ① apply 前置拦：阈值闸落 INSERT CTE 的 WHERE（fail-fast 单写路径）；outcome 亦含 batt_below_threshold
  const applyPreGate = />= COALESCE\(\(SELECT CASE WHEN \(p\.value->>'acceptThresholdBatt'\)/.test(APPLY_REGION);
  const applyOutcome = /'batt_below_threshold'/.test(APPLY_REGION) && /'self_application'/.test(APPLY_REGION);
  const applyUnion = /\| 'batt_below_threshold'/.test(APPLY_REGION);
  t('C1', 'doubleGate', applyPreGate && applyOutcome && applyUnion,
    "★ 落点 A（`R-9-18`）`applyToJob` **前置拦**：`batt_account ≥ acceptThresholdBatt` 落 INSERT CTE `WHERE`（fail-fast）+ outcome CASE 产 `'batt_below_threshold'`",
    JSON.stringify({ pre_gate: applyPreGate, outcome_case: applyOutcome, union: applyUnion }));

  // ② accept 权威扣费：同事务 deduct 扣 taskCostBatt + 二次判 + batt_entry 逐笔
  const hasDeduct = /deduct AS \(/.test(ACCEPT_REGION);
  const hasDeductSet = /SET batt = b\.batt - \(SELECT cost FROM thr\)/.test(ACCEPT_REGION);
  const hasSecondJudgement = /b\.batt >= \(SELECT cost FROM thr\)/.test(ACCEPT_REGION);
  const hasThr = /thr AS \(/.test(ACCEPT_REGION) && /'taskCostBatt'/.test(ACCEPT_REGION);
  const hasGateUpd = /g\.worker_batt >= thr\.accept/.test(ACCEPT_REGION);
  const acceptanceOutcome = /g\.worker_batt < thr\.accept/.test(ACCEPT_REGION) && /'batt_below_threshold'/.test(ACCEPT_REGION);
  t('C2', 'doubleGate', hasThr && hasGateUpd && hasDeduct && hasDeductSet && hasSecondJudgement && acceptanceOutcome,
    "★ 落点 B（`R-9-18`）`acceptJobApplication` **同事务权威扣费**：`upd` 门控 `worker_batt ≥ thr.accept`；`deduct` 扣 `cost` 且**二次判** `b.batt ≥ cost`（不满足 ⇒ 无行 ⇒ 整体回滚 ⇒ 409）",
    JSON.stringify({ thr: hasThr, gate_upd: hasGateUpd, deduct: hasDeduct, deduct_set: hasDeductSet, second_judge: hasSecondJudgement, outcome: acceptanceOutcome }));

  // ③ 扣减落 batt_entry 逐笔（reason task_cost + 幂等键 biz:job:accept:cost:）
  const entryCost = /ins_entry AS \(/.test(ACCEPT_REGION) && /'task_cost'/.test(ACCEPT_REGION) && /'biz:job:accept:cost:'/.test(ACCEPT_REGION);
  t('C3', 'doubleGate', entryCost,
    "扣减落 `batt_entry` 逐笔凭证（`reason='task_cost'` · 幂等键 `biz:job:accept:cost:<uid>:<applicationId>`）",
    JSON.stringify({ ins_entry: /ins_entry AS \(/.test(ACCEPT_REGION), task_cost: /'task_cost'/.test(ACCEPT_REGION), idem: /'biz:job:accept:cost:'/.test(ACCEPT_REGION) }));

  // ④ accept 返回值新增 workerBattAfter（读回扣后电量）
  t('C4', 'doubleGate', /workerBattAfter\s*:/.test(ACCEPT_REGION) || /worker_batt_after/.test(ACCEPT_REGION),
    '落点 B 返回值新增 `workerBattAfter`（`worker_batt_after` = 扣后电量，供上层回读）', JSON.stringify({ workerBattAfter: /workerBattAfter/.test(DATABASE_TS), sql_col: /worker_batt_after/.test(ACCEPT_REGION) }));

  // ⑤ job-service 两处映射（借既有码 LEDGER_CURRENCY_INVALID_TRANSITION + 稳定 reason）
  // ★ S12 定格前推（沿 S2 · `R-9-99`）：服务层 `batt` 闸映射处数 2 → 3 —— 原 P9② 两处之外，S2 把闸从「报名」
  //   移到「提交」时在 `submitWork` **新增第三处**映射（现役唯一在链落点）；旧两处（`applyToJob`/`acceptApplication`）
  //   按 S2/S3 设计「函数保留不删（路由 410 退役）」⇒ 逐字现取三处：`submitWork:157`（现役）/ `applyToJob:208` / `acceptApplication:245`（后两处历史保留）。
  const mapCount = countOf(JOB_SERVICE_TS, /stateConflict\('batt',\s*'BATT_BELOW_ACCEPT_THRESHOLD'/g);
  t('C5', 'doubleGate', mapCount === 3,
    "三处 outcome ⇒ `stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD', …)`（`submitWork`〔现役 · S2 新增〕+ `applyToJob`/`acceptApplication`〔P9② 历史保留〕；**借既有「非法状态转移」族码** · 零新增码 · R107）",
    JSON.stringify({ stateConflict_batt: mapCount }));
  t('C6', 'doubleGate', /fail\(409,\s*'LEDGER_CURRENCY_INVALID_TRANSITION'/.test(JOB_SERVICE_TS) && LEDGER_ERROR_CODES.includes('LEDGER_CURRENCY_INVALID_TRANSITION' as never),
    '`stateConflict` 落码 = `LEDGER_CURRENCY_INVALID_TRANSITION`（∈ 闭集 33）', JSON.stringify({ in_closed_set: LEDGER_ERROR_CODES.includes('LEDGER_CURRENCY_INVALID_TRANSITION' as never) }));
  selfTest('C2', 'doubleGate',
    (v) => /deduct AS \(/.test(String(v)) && /b\.batt >= \(SELECT cost FROM thr\)/.test(String(v)),
    ACCEPT_REGION.replace(/b\.batt >= \(SELECT cost FROM thr\)/, 'true'),
    '把「二次判被写成恒真」的区域喂入 ⇒ 双闸谓词必须转红');
}

// ============================================================================
// D · kind 闭集编码（P9⑤ 后 = 24）：现役三处（0038 CHECK / 0038 函数 / TS）
//     + P9④ 历史两处（0032 CHECK / 0032 函数 = 23，P9④ 冻结 · 被 0038 取代 · 不可改）
//     + P9② 历史两处（0028 CHECK / 0029 函数 = 21，P9② 冻结 · 被 0032 取代 · 不可改）
// ============================================================================
const KINDS_FROM_TS: string[] = [...LEDGER_KINDS];
const NEW_KIND = 'checkin_makeup_fee';           // P9②（21 值上限锚）
const P94_KINDS = ['bttc_mint_fee', 'bttc_burn_fee'];
const P95_KINDS = ['invite_first_task_reward'];  // P9⑤（23 → 24）
const sortedEq = (a: string[], b: string[]): boolean => eqJson([...a].sort(), [...b].sort());
const kindListFrom = (re: RegExp, src: string): string[] => {
  const m = src.match(re);
  return (m ? (m[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
};
const CHECK_LIST_RE = /ADD CONSTRAINT ledger_kind_enum CHECK \(kind IN \(([\s\S]*?)\)\)/;
const FN_LIST_RE = /SELECT p_kind IN \(([^)]*)\)\s*AND \(NOT p_frozen_settle OR p_kind IN \(([^)]*)\)\)/;
// 历史两处（P9② · 0028 / 0029）
const KINDS_0028 = kindListFrom(CHECK_LIST_RE, SQL_0028);
const m29 = SQL_0029.match(FN_LIST_RE);
const KINDS_0029 = (m29 ? (m29[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0029_FROZEN = (m29 ? (m29[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
// P9④ 历史两处（0032）
const KINDS_0032_CHECK = kindListFrom(CHECK_LIST_RE, SQL_0032);
const m32 = SQL_0032.match(FN_LIST_RE);
const KINDS_0032_FN = (m32 ? (m32[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0032_FROZEN = (m32 ? (m32[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
// 现役两处（P9⑤ · 0038）
const KINDS_0038_CHECK = kindListFrom(CHECK_LIST_RE, SQL_0038);
const m38 = SQL_0038.match(FN_LIST_RE);
const KINDS_0038_FN = (m38 ? (m38[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0038_FROZEN = (m38 ? (m38[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));

/** 穷举扫面（沿 `R-9-21` 正则）：全仓根，排除 artifacts / node_modules / dist / .git。 */
const SCAN_RE = /ledger_kind_ok|ledger_kind_enum|LEDGER_KINDS|PLATFORM_KIND_WHITELIST|checkin_makeup_fee/;
const SCAN_ROOTS = ['backend-ts/src', 'backend-ts/migrations', 'backend-ts/scripts', 'frontend/src', 'docs'];
const SCAN_EXT = ['.ts', '.sql', '.js', '.jsx', '.mjs', '.md'];
/**
 * ★ 扫面根卫生（S21 · 台账 `B2` · 变体 Ⅰ —— Zang 终审采纳）：
 * 背景：`backend-ts/scripts/` 是探针/诊断件主落点（S20 §2.3 现取 296 件），而 `D6/D7/D8` 判据是
 * 「代码面含 `checkin_makeup_fee` 且 kind 数 ≥ 20 / 全闭集编码（≥21）的件 = **恰六处**」（全闭集
 * 穷举）⇒ `scripts/` 内任何含 ≥21 kind、或以字符串字面量出现 `checkin_makeup_fee` 的**探针/诊断件**
 * 都会被算进去 ⇒ **假红**（S15 事故 `p8-s5-00-recon*.ts` 的成因；且桶优先级 `kinds>=21 > isArtifact`
 * 令「文件名兜底」被架空）。
 * ★ 排除式 = **显式白名单式 · 逐条登记**（禁用宽泛字符串匹配一刀切：不得排除整个 `scripts/`、
 *   不得用 `*test*`）；命名式沿本仓既有探针命名惯例（S20 §2.3 现取 `*recon*` 7 · `*probe*` 35 · `*-00-*` 46）。
 */
const PROBE_NAME_PATTERNS: Array<{ id: string; re: RegExp; reason: string }> = [
  { id: 'recon',      re: /recon/i,      reason: '侦查件 `*recon*`（S20 §2.3 登记：7 件）' },
  { id: 'probe',      re: /probe/i,      reason: '探针件 `*probe*`（S20 §2.3 登记：35 件）' },
  { id: 'diagnostic', re: /diagnostic/i, reason: '诊断件 `*diagnostic*`（诊断专用件）' },
  { id: 'seq',        re: /-\d{2}-/,     reason: '前置编号式 `*-00-*`/`*-01-*`…（分步探针/诊断件；S20 现取 `-00-` 46 件）' },
];
/** ★ 排除式**只作用于 `backend-ts/scripts/` 这一个根**；其余四根（src / migrations / frontend/src / docs）检出面**一字不缩**。 */
const SCRIPTS_ROOT_ABS = path.resolve(REPO_ROOT, 'backend-ts/scripts');
const probePatternOf = (name: string): string | null => {
  for (const p of PROBE_NAME_PATTERNS) if (p.re.test(name)) return p.id;
  return null;
};
/** 命中探针命名式 ⇒ 返回命名式 id；仅当该路径位于 `backend-ts/scripts/` 根内才生效。 */
const probeExcludedBy = (abs: string): string | null => {
  const rel = path.relative(SCRIPTS_ROOT_ABS, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;  // 不在 scripts/ 根内 ⇒ 不排除
  return probePatternOf(path.basename(abs));
};
const walk = (dir: string, out: string[], excluded: Array<{ file: string; pattern: string }>): void => {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(ent.name) || ent.name.includes('artifacts')) continue;
      // ★ 探针产物目录（沿既有 `.p*-recon`/`.p*-arms` 先例）：目录名命中探针命名式 ⇒ 整目录排除。
      const dirHit = probeExcludedBy(p);
      if (dirHit) { excluded.push({ file: `${path.relative(REPO_ROOT, p)}/`, pattern: `dir:${dirHit}` }); continue; }
      walk(p, out, excluded);
    } else if (SCAN_EXT.includes(path.extname(ent.name))) {
      const hit = probeExcludedBy(p);
      if (hit) { excluded.push({ file: path.relative(REPO_ROOT, p), pattern: hit }); continue; }
      out.push(p);
    }
  }
};
const allScanFiles: string[] = [];
const excludedProbeFiles: Array<{ file: string; pattern: string }> = [];
for (const r of SCAN_ROOTS) walk(path.resolve(REPO_ROOT, r), allScanFiles, excludedProbeFiles);
// ★ fail-loud（不得静默）：N = 扫面根收集 / M = 排除探针 / K = 参与判据；**M=0 也照印**（防路径改动致排除静默失效）。
//   P9⑤ 后 K = docs+migrations+src+frontend/src 全量 + scripts 未命中探针命名式者。
const SCAN_HYGIENE = {
  scan_roots: SCAN_ROOTS,
  exclusion_scope: '仅 backend-ts/scripts/（其余四根检出面一字不缩）',
  collected_total: allScanFiles.length + excludedProbeFiles.length,   // N
  excluded_probe: excludedProbeFiles.length,                          // M
  participating: allScanFiles.length,                                 // K
  patterns: PROBE_NAME_PATTERNS.map((q) => ({
    id: q.id, regex: q.re.source, reason: q.reason,
    hits: excludedProbeFiles.filter((e) => e.pattern === q.id || e.pattern === `dir:${q.id}`).length,
  })),
  excluded_files: excludedProbeFiles.map((e) => e.file).sort(),
};
console.log(`SCAN_HYGIENE collected(N)=${SCAN_HYGIENE.collected_total} excluded_probe(M)=${SCAN_HYGIENE.excluded_probe} participating(K)=${SCAN_HYGIENE.participating} scope=${SCAN_HYGIENE.exclusion_scope}`);
/** 一个文件里「以字符串字面量出现」的 kind 去重集。 */
const kindsInText = (text: string): string[] =>
  KINDS_FROM_TS.filter((k) => new RegExp(`'${k}'|"${k}"`).test(text));
interface ScanHit { file: string; kinds: number; has_new_kind: boolean; bucket: string; }
const scanHits: ScanHit[] = [];
for (const abs of allScanFiles) {
  const text = fs.readFileSync(abs, 'utf8');
  if (!SCAN_RE.test(text)) continue;
  const rel = path.relative(REPO_ROOT, abs);
  const kinds = kindsInText(text);
  const hasNew = kinds.includes(NEW_KIND);
  const isDocs = rel.startsWith('docs/');
  const isArtifact = rel.includes('artifacts') || /\/p[0-9][a-z]+-/.test(rel);
  let bucket: string;
  if (isDocs) bucket = 'spec_text';
  else if (kinds.length >= 21) bucket = 'full_set_21';
  else if (rel.startsWith('backend-ts/migrations/') && kinds.length >= 18) bucket = 'historical_or_superseded';
  else if (isArtifact) bucket = 'probe_or_artifact';
  else if (hasNew) bucket = 'single_kind_usage';
  else bucket = 'readonly_call_or_subset';
  scanHits.push({ file: rel, kinds: kinds.length, has_new_kind: hasNew, bucket });
}
const FULL_SET_CODE = scanHits.filter((h) => h.bucket === 'full_set_21').map((h) => h.file).sort();
// ★ S12 扫面定格前推（沿 S9 · `2ad2d11`）：S9 新增 `frontend/src/test/unit/s9-ledger-kind-closure.test.js`
//   （内含 24 值镜像常量 `KINDS_MIRROR` + 现读 `LEDGER_KINDS` ⇒ 命中 `kinds ≥ 21`）⇒ 代码面全闭集编码 5 → 6，**具名登记该处**。
const FULL_SET_EXPECTED = [
  'backend-ts/migrations/0028_kind_close_set_21.sql',
  'backend-ts/migrations/0029_batt_checkin.sql',
  'backend-ts/migrations/0032_kind_close_set_23.sql',
  'backend-ts/migrations/0038_kind_close_set_24.sql',
  'backend-ts/src/ledger.ts',
  'frontend/src/test/unit/s9-ledger-kind-closure.test.js',
].sort();
const BUCKETS = ['full_set_21', 'spec_text', 'historical_or_superseded', 'single_kind_usage', 'probe_or_artifact', 'readonly_call_or_subset'];
const bucketCounts: Record<string, number> = Object.fromEntries(BUCKETS.map((b) => [b, scanHits.filter((h) => h.bucket === b).length]));
{
  // D1 TS LEDGER_KINDS = 24，末位三值 = P9④ 两值 + P9⑤ 一值
  t('D1', 'kindCloseSet',
    KINDS_FROM_TS.length === 24 && eqJson(KINDS_FROM_TS.slice(21), [...P94_KINDS, ...P95_KINDS]) && KINDS_FROM_TS.includes(NEW_KIND),
    `③ TS \`LEDGER_KINDS\` = 24 值（末位追加 \`${[...P94_KINDS, ...P95_KINDS].join('\`/\`')}\`，不改既有 21 次序；含 \`${NEW_KIND}\`）`,
    JSON.stringify({ n: KINDS_FROM_TS.length, tail: KINDS_FROM_TS.slice(21), has_new: KINDS_FROM_TS.includes(NEW_KIND) }));
  // D2 0038 CHECK = 24 且与 TS 同集（现役）
  t('D2', 'kindCloseSet',
    KINDS_0038_CHECK.length === 24 && [...P94_KINDS, ...P95_KINDS].every((k) => KINDS_0038_CHECK.includes(k)) && sortedEq(KINDS_0038_CHECK, KINDS_FROM_TS),
    `① \`0038\` \`ledger_kind_enum\` CHECK = 24 值且与 TS 同集（含 \`${[...P94_KINDS, ...P95_KINDS].join('\`/\`')}\`）`,
    JSON.stringify({ n: KINDS_0038_CHECK.length, same_set: sortedEq(KINDS_0038_CHECK, KINDS_FROM_TS) }));
  // D3 0038 ledger_kind_ok 第一支 = 24 且与 TS 同集（现役）
  t('D3', 'kindCloseSet',
    KINDS_0038_FN.length === 24 && [...P94_KINDS, ...P95_KINDS].every((k) => KINDS_0038_FN.includes(k)) && sortedEq(KINDS_0038_FN, KINDS_FROM_TS),
    `② \`0038\` \`ledger_kind_ok\` 第一支 = 24 值且与 TS 同集`,
    JSON.stringify({ n: KINDS_0038_FN.length, same_set: sortedEq(KINDS_0038_FN, KINDS_FROM_TS) }));
  // D4 现役三处同集（0038 CHECK == 0038 函数 == TS）
  t('D4', 'kindCloseSet', sortedEq(KINDS_0038_CHECK, KINDS_0038_FN) && sortedEq(KINDS_0038_CHECK, KINDS_FROM_TS),
    '现役三处编码**同集**（① `0038` CHECK ② `0038` 函数 ③ TS）',
    JSON.stringify({ check_eq_fn: sortedEq(KINDS_0038_CHECK, KINDS_0038_FN), check_eq_ts: sortedEq(KINDS_0038_CHECK, KINDS_FROM_TS) }));
  // D4b P9② 历史两处（0028/0029）仍 = 21 且 = TS 前 21（P9② 冻结快照，逐字未改）
  t('D4b', 'kindCloseSet',
    KINDS_0028.length === 21 && KINDS_0029.length === 21 && sortedEq(KINDS_0028, KINDS_0029)
      && sortedEq(KINDS_0028, KINDS_FROM_TS.slice(0, 21)),
    '历史两处（`0028` CHECK / `0029` 函数）= 21 且逐字 = TS 前 21（P9② 冻结快照，被 `0032` 取代、文件不可改）',
    JSON.stringify({ n28: KINDS_0028.length, n29: KINDS_0029.length, eq: sortedEq(KINDS_0028, KINDS_0029), eq_ts21: sortedEq(KINDS_0028, KINDS_FROM_TS.slice(0, 21)) }));
  // D4c P9④ 历史两处（0032）仍 = 23 且 = TS 前 23（P9④ 冻结快照，逐字未改，被 0038 取代）
  t('D4c', 'kindCloseSet',
    KINDS_0032_CHECK.length === 23 && KINDS_0032_FN.length === 23 && sortedEq(KINDS_0032_CHECK, KINDS_0032_FN)
      && sortedEq(KINDS_0032_CHECK, KINDS_FROM_TS.slice(0, 23)),
    'P9④ 历史两处（`0032` CHECK / 函数）= 23 且逐字 = TS 前 23（P9④ 冻结快照，被 `0038` 取代、文件不可改）',
    JSON.stringify({ n32c: KINDS_0032_CHECK.length, n32f: KINDS_0032_FN.length, eq: sortedEq(KINDS_0032_CHECK, KINDS_0032_FN), eq_ts23: sortedEq(KINDS_0032_CHECK, KINDS_FROM_TS.slice(0, 23)) }));
  // D5 冻结族第二支一字不动（0038 与 0032 同 = 4 值，不含任何新增值）
  t('D5', 'kindCloseSet',
    eqJson([...KINDS_0038_FROZEN].sort(), ['hold_forfeit', 'job_payout', 'purchase', 'trade'])
      && eqJson([...KINDS_0032_FROZEN].sort(), [...KINDS_0038_FROZEN].sort())
      && !KINDS_0038_FROZEN.includes(NEW_KIND) && [...P94_KINDS, ...P95_KINDS].every((k) => !KINDS_0038_FROZEN.includes(k)),
    '`ledger_kind_ok` 的第二支（`p_frozen_settle`）**一字不动** = 4 值且不含任何新增值（新 kind 不属冻结结算族）',
    JSON.stringify({ frozen: [...KINDS_0038_FROZEN].sort(), has_new: KINDS_0038_FROZEN.includes(NEW_KIND), has_newer: [...P94_KINDS, ...P95_KINDS].filter((k) => KINDS_0038_FROZEN.includes(k)) }));
  // D6 穷举扫面：全闭集编码（≥21 值）在代码面**恰六处**（现役 0038 + TS；历史 0032 / 0028 / 0029；★ S12 追加 S9 守卫件）
  t('D6', 'kindCloseSet', eqJson(FULL_SET_CODE, FULL_SET_EXPECTED),
    '★ **穷举扫面结论「无未登记全闭集编码」**：代码面全闭集编码（≥21 值）**恰六处** = `0028` CHECK / `0029` 函数 / `0032` / `0038` / `src/ledger.ts`（前四为历史→现役迁移，末为 TS 现役）+ `frontend/src/test/unit/s9-ledger-kind-closure.test.js`（★ S12 登记：S9 守卫镜件，内含 24 值 `KINDS_MIRROR`）',
    JSON.stringify({ found: FULL_SET_CODE, expected: FULL_SET_EXPECTED }));
  // D7 命中分类（正则 + 逐桶计数）
  const classified = FULL_SET_CODE.length === 6 && bucketCounts.full_set_21 === 6;
  t('D7', 'kindCloseSet', classified,
    `扫面正则 = ${SCAN_RE.source}；命中分类逐桶 = ${JSON.stringify(bucketCounts)}（full_set_21 恰 6 ⇒ 其余 = 派生子集 / 只读调用 / 历史被取代 / 规范文本 / 弃件）`,
    JSON.stringify({ regex: SCAN_RE.source, roots: SCAN_ROOTS, buckets: bucketCounts, hits: scanHits.length }));
  // D8 无未登记全闭集（等价判别）：代码面「含新 kind 且 kind 数 ≥ 20」的文件 == 恰六处
  const fourth = scanHits.filter((h) => !h.file.startsWith('docs/') && h.has_new_kind && h.kinds >= 20).map((h) => h.file).sort();
  t('D8', 'kindCloseSet', eqJson(fourth, FULL_SET_EXPECTED),
    '★ 「无未登记全闭集编码」等价判别：代码面**含 `checkin_makeup_fee` 且 kind 数 ≥ 20** 的文件 = 恰六处（含 S9 守卫件）',
    JSON.stringify({ files_with_new_kind_and_full_list: fourth }));
  selfTest('D6', 'kindCloseSet',
    (hits) => (Array.isArray(hits) ? hits.filter((h: { bucket: string }) => h.bucket === 'full_set_21').map((h: { file: string }) => h.file).sort() : []).length === 0,
    [{ file: 'backend-ts/src/fourth-place.ts', bucket: 'full_set_21' }],
    '把「凭空多出一个全闭集编码文件」喂入 ⇒ 谓词必须转红');
  selfTest('D4', 'kindCloseSet', (v) => sortedEq(v as string[], KINDS_0038_CHECK), [...KINDS_0038_CHECK, 'made_up_kind'],
    '把「多一值」的集喂入现役同集谓词 ⇒ 必须转红');
}

// ============================================================================
// E · 幂等键 / 日界 UTC / 溢出封顶丢弃 / 配置 fail-closed
// ============================================================================
const IDEM_GETCFG_START = DATABASE_TS.indexOf('static async getAppConfigValueByKey(');
const IDEM_GETCFG_END = DATABASE_TS.indexOf('static async getBatt(');
const GETCFG_REGION = IDEM_GETCFG_START >= 0 && IDEM_GETCFG_END > IDEM_GETCFG_START ? DATABASE_TS.slice(IDEM_GETCFG_START, IDEM_GETCFG_END) : '';
{
  // E1 幂等键形态
  t('E1', 'idempotency',
    /bizKeyOf\('checkin',\s*uid,\s*utcDay\(\)\)/.test(BLOCK_CHECKIN_POST)
    && /bizKeyOf\('checkin',\s*'makeup',\s*uid,\s*targetRaw\)/.test(BLOCK_MAKEUP)
    && /const bizKeyOf = \(\.\.\.parts[\s\S]*?`biz:\$\{/.test(INDEX_TS),
    "幂等键 = 服务端派生定案形 `biz:checkin:<uid>:<checkin_day>` / `biz:checkin:makeup:<uid>:<target_day>`（前缀 `biz:` · 逐段冒号 · 禁金额/时间戳入键 · `R49`/`R50`）",
    JSON.stringify({ checkin: /bizKeyOf\('checkin',\s*uid,\s*utcDay\(\)\)/.test(BLOCK_CHECKIN_POST), makeup: /bizKeyOf\('checkin',\s*'makeup',\s*uid,\s*targetRaw\)/.test(BLOCK_MAKEUP), prefix: /`biz:\$\{/.test(INDEX_TS) }));
  // E1b 前端同形（`biz:checkin:makeup:<uid>:<day>`）
  t('E1b', 'idempotency', /biz:checkin:makeup:\$\{uID\}:\$\{day\}/.test(FE_BATT_JS) && FE_PANEL_JSX.length > 0,
    '前端接线层同形幂等键 `biz:checkin:makeup:${uID}:${day}`（`batt-checkin.js`）',
    JSON.stringify({ fe_key: /biz:checkin:makeup:\$\{uID\}:\$\{day\}/.test(FE_BATT_JS) }));
  // E2 日界 = UTC
  const utcCount = countOf(DATABASE_TS, /now\(\) AT TIME ZONE 'UTC'/g);
  t('E2', 'dayBoundary', utcCount >= 6 && /toISOString\(\)\.slice\(0,\s*10\)/.test(INDEX_TS),
    "日界 = **UTC 自然日**（`R-9-15`）：读 / 写 SQL 一律 `now() AT TIME ZONE 'UTC'`；路由层 `utcDay` = `toISOString().slice(0,10)`",
    JSON.stringify({ utc_sql_occurrences: utcCount, utcDay_ts: /toISOString\(\)\.slice\(0,\s*10\)/.test(INDEX_TS) }));
  // E3 溢出 = 封顶丢弃
  t('E3', 'overflow', /LEAST\(\(SELECT batt FROM cur\) \+ \(SELECT r FROM reward\), \$\{capBatt\}\)/.test(DATABASE_TS) || /LEAST\([\s\S]{0,80}capBatt\)/.test(DATABASE_TS),
    "★ 签到溢出 = **封顶丢弃**（`R-9-17`）：`newbatt = LEAST(cur + reward, capBatt)`（超出部分不累计、不结转）",
    JSON.stringify({ least_cap: /LEAST\([\s\S]{0,80}capBatt\)/.test(DATABASE_TS) }));
  // E4 溢出丢弃的证据：仅在 `delta <> 0` 时落 batt_entry；DB 兜底 CHECK 0..100 + move_guard
  t('E4', 'overflow',
    /WHERE \(SELECT d FROM delta\) <> 0/.test(DATABASE_TS)
    && /CONSTRAINT batt_account_range\s+CHECK \(batt BETWEEN 0 AND 100\)/.test(SQL_0029)
    && /CONSTRAINT batt_entry_move_guard\s+CHECK \(delta <> 0\)/.test(SQL_0029),
    "封顶丢弃可证：`batt_entry` 仅在 `delta <> 0` 时落行（净增 0 ⇒ 无流水）；DB 兜底 `CHECK (batt BETWEEN 0 AND 100)` + `batt_entry_move_guard CHECK (delta <> 0)`（`0029`）",
    JSON.stringify({ delta_guard: /WHERE \(SELECT d FROM delta\) <> 0/.test(DATABASE_TS), range_ck: /batt_account_range/.test(SQL_0029), move_guard: /batt_entry_move_guard/.test(SQL_0029) }));
  // E5 配置 fail-closed：默认值逐字 + 逐字段回落
  const battDefaultsOk = eqJson(BATT_POLICY_DEFAULTS, { taskCostBatt: 9, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 9 });
  const checkinDefaultsOk = eqJson(CHECKIN_POLICY_DEFAULTS, { baseRewardBatt: 30, streakCapDays: 7, streakDay7RewardBatt: 60, makeupCostUsd: 100, makeupDailyLimit: 1 });
  t('E5a', 'configFailClosed', battDefaultsOk, '`BATT_POLICY_DEFAULTS` 逐字 = {taskCostBatt 9 / capBatt 100 / floorBatt 0 / acceptThresholdBatt 9}', JSON.stringify(BATT_POLICY_DEFAULTS));
  t('E5b', 'configFailClosed', checkinDefaultsOk, '`CHECKIN_POLICY_DEFAULTS` 逐字 = {baseRewardBatt 30 / streakCapDays 7 / streakDay7RewardBatt 60 / makeupCostUsd 100 / makeupDailyLimit 1}', JSON.stringify(CHECKIN_POLICY_DEFAULTS));
  const rb = resolveBattPolicy({ taskCostBatt: -1, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 9 });
  const rc = resolveCheckinPolicy('not-an-object');
  t('E5c', 'configFailClosed',
    rb.policy.taskCostBatt === BATT_POLICY_DEFAULTS.taskCostBatt && rb.source === 'config'
    && rc.source === 'constant' && eqJson(rc.policy, CHECKIN_POLICY_DEFAULTS),
    '★ 配置 fail-closed：非法字段（`taskCostBatt=-1`）⇒ **逐字段**回落常量；非 object ⇒ 全量常量（`source=constant`）',
    JSON.stringify({ bad_field_fell_back: rb.policy.taskCostBatt, bad_field_source: rb.source, non_object_source: rc.source }));
  selfTest('E5', 'configFailClosed', (v) => resolveBattPolicy(v).source === 'constant',
    { taskCostBatt: 9 }, '把合法 object 喂入「非 object ⇒ constant」谓词 ⇒ 必须转红');
  // E6 读 app_config 只读
  t('E6', 'configFailClosed',
    /SELECT value FROM public\.app_config WHERE key = \$1 LIMIT 1/.test(GETCFG_REGION)
    && !/\b(INSERT|UPDATE|DELETE)\b/i.test(GETCFG_REGION),
    '`getAppConfigValueByKey` = **纯 SELECT**（只读取数，零写路径；`app_config` 权威值只经既有唯一写口落地）',
    JSON.stringify({ select: /SELECT value FROM public\.app_config/.test(GETCFG_REGION), writes: /\b(INSERT|UPDATE|DELETE)\b/i.test(GETCFG_REGION), region_bytes: GETCFG_REGION.length }));
}

// ============================================================================
// F · 零新增错误码（仍恰 33）
// ============================================================================
{
  t('F1', 'closedSets', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（不动）', LEDGER_ERROR_CODES.length);
  const makeupCodes = (BLOCK_MAKEUP.match(/adminVerbError\(\d+,\s*'([A-Z_]+)'/g) || [])
    .map((s) => (s.match(/'([A-Z_]+)'/) || [])[1]);
  t('F2', 'closedSets', makeupCodes.length >= 3 && makeupCodes.every((c) => LEDGER_ERROR_CODES.includes(c as never)),
    '★ 补签三类拒绝**借既有闭集码**（`LEDGER_AMOUNT_INVALID` / `LEDGER_INSUFFICIENT_BALANCE` / `LEDGER_CURRENCY_INVALID_TRANSITION`）⇒ 零新增码',
    JSON.stringify({ codes: [...new Set(makeupCodes)] }));
  t('F3', 'closedSets', LEDGER_ERROR_CODES.includes('LEDGER_RESERVED_UID' as never),
    '`−1` 白名单守护仍用既有 `LEDGER_RESERVED_UID`（`0029 §G` 未新增码）', LEDGER_ERROR_CODES.includes('LEDGER_RESERVED_UID' as never));
  selfTest('F1', 'closedSets', (v) => (v as string[]).length === 33, [...LEDGER_ERROR_CODES, 'LEDGER_NEW_MADEUP_CODE'],
    '把 34 条闭集喂入 ⇒ 谓词必须转红');
}

// ============================================================================
// G · 库面 leg 转真 checks（连库 + HTTP · 事务内行为探针末尾 ROLLBACK · `pending_apply[]` = 0）
// ============================================================================
// ★ `0028`/`0029` 已 apply ⇒ 下列 DB 级效果**逐条真读数**入 `checks`（不再单列 pending）。
// ★ HTTP leg 打受控实例 `P8S7_BASE`（默认 `http://127.0.0.1:5797`）。
const pendingApply: Array<{ leg: string; reason: string }> = [];   // ★ 已 apply ⇒ 无未验 leg

const prevBusinessDay = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

(async () => {
  let dbConnections = 0;
  let httpCalls = 0;
  const tg = (id: string, pass: boolean, expect: unknown, actual: unknown): void =>
    checks.push({ id, group: 'dbLive', pass: Boolean(pass), expect: String(expect), actual: String(actual) });

  // ---------------- G1 · 活体 `ledger_kind_enum` = 24（`0038` 已 apply） ----------------
  const kindDef = (await readQuery<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`))[0];
  dbConnections += 1;
  const KINDS_DB = ((kindDef?.def ?? '').match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1));
  const liveIs24 = sortedEq(KINDS_DB, KINDS_FROM_TS);                    // `0038` 已 apply
  tg('G1', KINDS_DB.length === 24 && liveIs24 && KINDS_DB.includes(NEW_KIND) && P95_KINDS.every((k) => KINDS_DB.includes(k)),
    '★ 活体 `ledger_kind_enum` = 24 值 且与 TS 同集（`0038` 已 apply）· 含 `checkin_makeup_fee` / `invite_first_task_reward`',
    JSON.stringify({ n: KINDS_DB.length, has_new: KINDS_DB.includes(NEW_KIND), has_p95: P95_KINDS.filter((k) => KINDS_DB.includes(k)), mode: liveIs24 ? 'applied_24' : 'UNEXPECTED' }));

  // ---------------- G2 · 4 表 + 约束 + 3 具名索引（活体） ----------------
  const tabs = (await readQuery<{ t: string }>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public'
      AND table_name IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY table_name`)).map((r) => r.t);
  const cons = await readQuery<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid IN ('public.batt_account'::regclass,'public.batt_entry'::regclass,
                         'public.checkin_log'::regclass,'public.checkin_makeup_log'::regclass)`);
  const idx = (await readQuery<{ i: string }>(
    `SELECT indexname AS i FROM pg_indexes WHERE schemaname='public'
      AND indexname IN ('idx_batt_entry_uid_time','idx_checkin_log_uid_day','idx_checkin_makeup_log_uid_day')`)).map((r) => r.i);
  dbConnections += 3;
  const conText = cons.map((c) => c.def).join(' | ');
  const tabsOk = ['batt_account', 'batt_entry', 'checkin_log', 'checkin_makeup_log'].every((x) => tabs.includes(x));
  const rangeOk = cons.some((c) => c.conname === 'batt_account_range' && /batt >= 0/.test(c.def) && /batt <= 100/.test(c.def));
  const moveGuardOk = /delta <> 0/.test(conText);
  const uniqOk = /UNIQUE \(uid, checkin_day\)/.test(conText) && /UNIQUE \(idempotency_key\)/.test(conText) && /UNIQUE \(uid, makeup_day\)/.test(conText);
  tg('G2', tabsOk && rangeOk && moveGuardOk && uniqOk && idx.length === 3,
    '★ 活体：4 表 + `CHECK (batt BETWEEN 0 AND 100)` + `delta <> 0` + 三 UNIQUE + 3 具名索引',
    JSON.stringify({ tables: tabs, range_ck: rangeOk, move_guard: moveGuardOk, unique: uniqOk, indexes: idx }));

  // ---------------- G3 · 4 触发器（活体定义） ----------------
  const trg = await readQuery<{ n: string; def: string }>(
    `SELECT tgname AS n, pg_get_triggerdef(oid) AS def FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN ('trg_batt_account_touch_updated','trg_batt_entry_append_only',
        'trg_checkin_log_append_only','trg_checkin_makeup_log_append_only')`);
  dbConnections += 1;
  const trgNames = trg.map((r) => r.n).sort();
  const touchOk = (trg.find((r) => r.n === 'trg_batt_account_touch_updated')?.def ?? '').includes('BEFORE UPDATE');
  const aoOk = ['trg_batt_entry_append_only', 'trg_checkin_log_append_only', 'trg_checkin_makeup_log_append_only']
    .every((n) => /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/.test(trg.find((r) => r.n === n)?.def ?? ''));
  tg('G3', trgNames.length === 4 && touchOk && aoOk,
    '★ 活体 4 触发器：`batt_account` BEFORE UPDATE 刷时 + 三表 BEFORE UPDATE OR DELETE append-only',
    JSON.stringify({ triggers: trgNames, touch: touchOk, append_only: aoOk }));

  // ---------------- G4–G7 · 行为真读数（事务内 + 末尾 ROLLBACK） ----------------
  const SENT = 'P8S7_GATE_ROLLBACK';
  try {
    await withTransaction(async (tx: TxClient) => {
      const sp = async (name: string, fn: () => Promise<unknown>): Promise<string | null> => {
        await tx.query(`SAVEPOINT ${name}`);
        try { await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return null; }
        catch (e) { await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined); return String((e as { code?: unknown }).code ?? ''); }
      };
      const k = (await tx.query<{ good: boolean; bad: boolean }>(
        `SELECT ledger_kind_ok('checkin_makeup_fee', false) AS good, ledger_kind_ok('__p8s7_nope__', false) AS bad`)).rows[0];
      tg('G4', k?.good === true && k?.bad === false,
        '★ 活体 `ledger_kind_ok`：`checkin_makeup_fee` ⇒ true / 闭集外 ⇒ false',
        JSON.stringify({ good: k?.good, bad: k?.bad }));
      const rc = await sp('sp_range', () => tx.query(`INSERT INTO public.batt_account (uid, batt) VALUES (-777001, 101)`));
      tg('G5', rc === '23514', '★ 活体 `batt_account` 范围 CHECK：写 101 ⇒ 23514', JSON.stringify({ code: rc }));
      const freeUid = (await tx.query<{ u: string }>(
        `SELECT u.uid::text AS u FROM public.users u
          WHERE NOT EXISTS (SELECT 1 FROM public.checkin_log c WHERE c.uid = u.uid
                             AND c.checkin_day = (now() AT TIME ZONE 'UTC')::date)
          ORDER BY u.uid LIMIT 1`)).rows[0]?.u;
      const ao = await sp('sp_ao', async () => {
        await tx.query(`INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
                        VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date, 1, 30)`, [String(freeUid)]);
        await tx.query(`UPDATE public.checkin_log SET streak_day = 2 WHERE uid = $1::bigint`, [String(freeUid)]);
      });
      tg('G6', ao === 'P0001', '★ 活体 append-only 触发器：UPDATE `checkin_log` ⇒ P0001（原生 RAISE）', JSON.stringify({ code: ao }));
      const fnDef = (await tx.query<{ def: string }>(
        `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p WHERE p.proname='ledger_assert_platform_mutation' LIMIT 1`)).rows[0]?.def ?? '';
      tg('G7', fnDef.includes('checkin_makeup_fee'),
        '★ 活体 `ledger_assert_platform_mutation`：−1 credit 白名单含 `checkin_makeup_fee`（§G）',
        JSON.stringify({ has_new_kind: fnDef.includes('checkin_makeup_fee') }));
      throw new Error(SENT);
    });
  } catch (e) { if (String((e as Error)?.message) !== SENT) throw e; }
  dbConnections += 1;

  // ---------------- G8–G10 · 4 新口真 HTTP（401 ⇄ 200）+ 公开面零回归 ----------------
  const HTTP_BASE = process.env.P8S7_BASE || 'http://127.0.0.1:5797';
  // ★ S40b：`api()` 返回**完整响应体**（供 G9 断言「状态码 + 响应体形状」）；传输层失败 ⇒ `status: -1`（**绝不容忍**）。
  const api = async (method: string, p: string, token?: string, body?: unknown): Promise<{ status: number; success: boolean | null; body: Record<string, unknown> | null }> => {
    httpCalls += 1;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      const r = await fetch(`${HTTP_BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      let j: Record<string, unknown> | null = null;
      try { j = JSON.parse(text) as Record<string, unknown>; } catch { /* non-json */ }
      return { status: r.status, success: (j?.success ?? null) as boolean | null, body: j };
    } catch { return { status: -1, success: null, body: null }; } // fetch failed ⇒ -1（G9 据此判负）
  };
  let httpErr: string | null = null;
  const noTok: Record<string, number> = {};
  const withTok: Record<string, number> = {};
  let pub = -1;
  // ★★ S40b 门侧修为（Zang 裁定 #2）：`POST /api/checkin/makeup` 的响应是**数据依赖型**
  //    （actor 对 target_day 是否已补签 / 今日是否已有补签留痕），原判据「必 200」会随时间红/绿（假红源）。
  //    本门改为**先现取该 actor 的补签数据态（读库）**，再断言**由数据态推出的唯一期望分支**（状态码 + 响应体形状双断言）：
  //      · `today_row=false` + 未补签 ⇒ **200 + 成功形状**（restoredStreakDay/costUsd/txid 三键）〔分支 a〕；
  //      · `today_row=false` + 已补签/该日已签到 ⇒ **409 + LEDGER_CURRENCY_INVALID_TRANSITION
  //        + details.reason=CHECKIN_MAKEUP_TARGET_INVALID + details.field=checkin_makeup**〔分支 b〕；
  //      · `today_row=true`（今日已有留痕行 ⇒ 产品走 `ON CONFLICT(uid,makeup_day) DO NOTHING`）⇒
  //        同键 ⇒ 200 `idempotent_replay`〔replayed〕；异键 ⇒ 409 reason=`CHECKIN_MAKEUP_DAILY_LIMIT`〔daily_limit〕。
  //    硬约束：任一分支**均**断言状态码 + 响应体形状；`status:-1`（fetch failed）一律判负；无「接受任意码」路径。
  const makeupState = {
    actor_uid: -1, target: '', applied_target: false, checkin_target: false, today_row: false, key_row: false,
    balance: '0', cost_usd: 0, branch: '', expected_status: -1, expected: '',
  };
  let makeupResp: { status: number; success: boolean | null; body: Record<string, unknown> | null } = { status: -1, success: null, body: null };
  try {
    const actor = (await readQuery<{ uid: string }>(
      `SELECT u.uid::text AS uid FROM public.users u
        WHERE u.is_admin IS NOT TRUE AND NOT EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid=u.uid)
          AND COALESCE((SELECT a.balance FROM public.account a WHERE a.uid=u.uid AND a.cid=1),0) >= 100
        ORDER BY u.uid LIMIT 1`))[0]
      ?? (await readQuery<{ uid: string }>(`SELECT uid::text AS uid FROM public.users WHERE is_admin IS NOT TRUE ORDER BY uid LIMIT 1`))[0];
    dbConnections += 1;
    const uid = Number(actor?.uid ?? 1);
    const token = createSessionToken({ uID: uid, evm: '' });
    const target = prevBusinessDay();
    const idemKey = `biz:checkin:makeup:${uid}:${target}`;
    // 现取（读库）该 actor 对 target_day 的补签数据态
    const st = (await readQuery<{ applied_target: boolean; checkin_target: boolean; today_row: boolean; key_row: boolean; bal: string }>(
      `SELECT
         EXISTS (SELECT 1 FROM public.checkin_makeup_log m WHERE m.uid=$1::bigint AND m.result='applied' AND m.target_day=$2::date) AS applied_target,
         EXISTS (SELECT 1 FROM public.checkin_log c WHERE c.uid=$1::bigint AND c.checkin_day=$2::date) AS checkin_target,
         EXISTS (SELECT 1 FROM public.checkin_makeup_log m WHERE m.uid=$1::bigint AND m.makeup_day=(now() AT TIME ZONE 'UTC')::date) AS today_row,
         EXISTS (SELECT 1 FROM public.checkin_makeup_log m WHERE m.uid=$1::bigint AND m.idempotency_key=$3::text) AS key_row,
         COALESCE((SELECT a.balance FROM public.account a WHERE a.uid=$1::bigint AND a.cid=1),0)::text AS bal`,
      [String(uid), target, idemKey]))[0];
    dbConnections += 1;
    const { policy: ckPolicy } = resolveCheckinPolicy(await DatabaseService.getAppConfigValueByKey('checkin_policy'));
    const cost = Math.max(1, ckPolicy.makeupCostUsd);
    const bal = Number(st?.bal ?? 0);
    const targetInvalid = Boolean(st?.applied_target) || Boolean(st?.checkin_target);
    let branch: string; let expectedStatus: number; let expected: string;
    if (st?.today_row) {
      if (st?.key_row) { branch = 'b_replayed'; expectedStatus = 200; expected = 'replayed'; }
      else { branch = 'c_daily_limit'; expectedStatus = 409; expected = 'rejected_daily_limit'; }
    } else if (targetInvalid) { branch = 'b_target_invalid'; expectedStatus = 409; expected = 'rejected_target_invalid'; }
    else if (bal < cost) { branch = 'd_insufficient'; expectedStatus = 409; expected = 'rejected_insufficient_balance'; }
    else { branch = 'a_applied'; expectedStatus = 200; expected = 'applied'; }
    Object.assign(makeupState, {
      actor_uid: uid, target, applied_target: Boolean(st?.applied_target), checkin_target: Boolean(st?.checkin_target),
      today_row: Boolean(st?.today_row), key_row: Boolean(st?.key_row), balance: String(bal), cost_usd: cost,
      branch, expected_status: expectedStatus, expected,
    });
    const routes: Array<[string, string, string, unknown]> = [
      ['GET', '/api/batt', 'batt', undefined],
      ['GET', '/api/checkin', 'checkin.get', undefined],
      ['POST', '/api/checkin', 'checkin.post', {}],
    ];
    for (const [m, p] of routes) noTok[`${m} ${p}`] = (await api(m, p)).status;
    noTok['POST /api/checkin/makeup'] = (await api('POST', '/api/checkin/makeup', undefined, { target_day: target })).status;
    for (const [m, p, , b] of routes) withTok[`${m} ${p}`] = (await api(m, p, token, b)).status;
    makeupResp = await api('POST', '/api/checkin/makeup', token, { target_day: target });
    withTok['POST /api/checkin/makeup'] = makeupResp.status;
    pub = (await api('GET', '/api/role-names')).status;
  } catch (e) { httpErr = String((e as Error)?.message || e).slice(0, 120); }
  const routeKeys = ['GET /api/batt', 'GET /api/checkin', 'POST /api/checkin', 'POST /api/checkin/makeup'];
  tg('G8', httpErr === null && routeKeys.every((k) => noTok[k] === 401),
    '★ 4 新口无 token ⇒ 逐口 401（真 HTTP）', JSON.stringify({ no_token: noTok, err: httpErr }));

  // ---- G9 · makeup 真 HTTP：数据态感知分支 + 状态码/形状双断言（两分支皆断言） ----
  type Mk = { success?: boolean; message?: string; data?: Record<string, unknown>; idempotent_replay?: boolean; error?: { code?: string; message?: string; details?: Record<string, unknown> } };
  const judge200 = (r: { status: number; body: unknown }): boolean => {
    const b = r.body as Mk | null;
    const d = b?.data as Record<string, unknown> | undefined;
    return r.status === 200 && b?.success === true && d !== undefined
      && Object.keys(d).sort().join(',') === 'costUsd,restoredStreakDay,txid';
  };
  const judge409Target = (r: { status: number; body: unknown }): boolean => {
    const b = r.body as Mk | null;
    const det = (b?.error?.details ?? {}) as Record<string, unknown>;
    return r.status === 409 && b?.error?.code === 'LEDGER_CURRENCY_INVALID_TRANSITION'
      && det.field === 'checkin_makeup' && det.reason === 'CHECKIN_MAKEUP_TARGET_INVALID';
  };
  const judge409Daily = (r: { status: number; body: unknown }): boolean => {
    const b = r.body as Mk | null;
    const det = (b?.error?.details ?? {}) as Record<string, unknown>;
    return r.status === 409 && b?.error?.code === 'LEDGER_CURRENCY_INVALID_TRANSITION'
      && det.field === 'checkin_makeup' && det.reason === 'CHECKIN_MAKEUP_DAILY_LIMIT';
  };
  const judge409Insuff = (r: { status: number; body: unknown }): boolean => {
    const b = r.body as Mk | null;
    const det = (b?.error?.details ?? {}) as Record<string, unknown>;
    return r.status === 409 && b?.error?.code === 'LEDGER_INSUFFICIENT_BALANCE' && det.field === 'checkin_makeup';
  };
  const mkBody = makeupResp.body as Mk | null;
  let g9ShapeOk = false;
  if (makeupState.expected === 'applied') g9ShapeOk = judge200(makeupResp);
  else if (makeupState.expected === 'replayed') g9ShapeOk = judge200(makeupResp) && mkBody?.idempotent_replay === true;
  else if (makeupState.expected === 'rejected_target_invalid') g9ShapeOk = judge409Target(makeupResp);
  else if (makeupState.expected === 'rejected_daily_limit') g9ShapeOk = judge409Daily(makeupResp);
  else if (makeupState.expected === 'rejected_insufficient_balance') g9ShapeOk = judge409Insuff(makeupResp);
  // ★ 硬约束：传输层失败（status -1）一律判负；状态码须逐字 = 数据态推出的期望；形状须逐字匹配。
  const g9Pass = httpErr === null && makeupResp.status !== -1
    && makeupResp.status === makeupState.expected_status && g9ShapeOk;
  tg('G9', g9Pass,
    `★ makeup 真 HTTP · **数据态感知**：branch=${makeupState.branch || '?'}（expected=${makeupState.expected || '?'}）⇒ 期望 ${makeupState.expected_status} + 响应体形状（两分支皆断言状态码 + 形状；绝不容 fetch failed/-1）`,
    JSON.stringify({ state: makeupState, resp: { status: makeupResp.status, body: mkBody }, err: httpErr, shape_ok: g9ShapeOk }));
  // ---- G9 判负：四个形状谓词各喂「对/错状态/错形」三例 ⇒ 错例必须转红 ----
  const g9SelfOk =
    judge200({ status: 200, body: { success: true, data: { costUsd: 100, txid: '1', restoredStreakDay: 1 } } }) === true
    && judge200({ status: 409, body: { error: {} } }) === false
    && judge200({ status: 200, body: { success: true, data: { costUsd: 1 } } }) === false
    && judge409Target({ status: 409, body: { error: { code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { field: 'checkin_makeup', reason: 'CHECKIN_MAKEUP_TARGET_INVALID' } } } }) === true
    && judge409Target({ status: 200, body: {} }) === false
    && judge409Target({ status: 409, body: { error: { code: 'X', details: { field: 'checkin_makeup', reason: 'CHECKIN_MAKEUP_TARGET_INVALID' } } } }) === false
    && judge409Daily({ status: 409, body: { error: { code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { field: 'checkin_makeup', reason: 'CHECKIN_MAKEUP_DAILY_LIMIT' } } } }) === true
    && judge409Daily({ status: 409, body: { error: { code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { field: 'checkin_makeup', reason: 'CHECKIN_MAKEUP_TARGET_INVALID' } } } }) === false
    && judge409Insuff({ status: 409, body: { error: { code: 'LEDGER_INSUFFICIENT_BALANCE', details: { field: 'checkin_makeup' } } } }) === true
    && judge409Insuff({ status: 409, body: { error: { code: 'LEDGER_CURRENCY_INVALID_TRANSITION', details: { field: 'checkin_makeup' } } } }) === false;
  tg('G9__selftest', g9SelfOk,
    '★ G9 判负：四形状谓词各喂「对 / 错状态码 / 错形状」⇒ 错例一律转红',
    JSON.stringify({ fired: g9SelfOk }));
  tg('G10', pub === 200, '★ 公开面零回归：`GET /api/role-names` 无 token ⇒ 200', JSON.stringify({ status: pub }));

  // ---------------- 结论 ----------------
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S7-BATT-CHECKIN-GATE',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: false,
    db_connections: dbConnections,
    http_calls: httpCalls,
    note: 'A–F 静态段零 DB；G 段 = **库面 leg 转真 checks**（连库 + 事务内 ROLLBACK 行为探针 + 受控实例 5797 真 HTTP）。`pending_apply[]` = 0。',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    pending_apply: pendingApply,
    scan_root_hygiene: SCAN_HYGIENE,
    readings: {
      registration_points_total: countRoutes(INDEX_TS),
      registration_points_per_verb: PER_VERB_FROZEN,
      new_routes: [R_BATT + "',", R_CHECKIN_GET + "',", R_CHECKIN_POST + "',", R_MAKEUP + "',"],
      ledger_kinds_count: KINDS_FROM_TS.length,
      ledger_kinds_last: KINDS_FROM_TS[KINDS_FROM_TS.length - 1],
      kind_close_set_encodings: {
        sql_0028_check: KINDS_0028.length,
        sql_0029_ledger_kind_ok: KINDS_0029.length,
        sql_0029_frozen_settle_branch: KINDS_0029_FROZEN.length,
        sql_0032_check: KINDS_0032_CHECK.length,
        sql_0032_ledger_kind_ok: KINDS_0032_FN.length,
        sql_0032_frozen_settle_branch: KINDS_0032_FROZEN.length,
        sql_0038_check: KINDS_0038_CHECK.length,
        sql_0038_ledger_kind_ok: KINDS_0038_FN.length,
        sql_0038_frozen_settle_branch: KINDS_0038_FROZEN.length,
        ts_ledger_kinds: KINDS_FROM_TS.length,
      },
      live_db_kind_enum: KINDS_DB.length,
      live_db_tables: tabs,
      live_db_triggers: trgNames,
      db_connections: dbConnections,
      http_calls: httpCalls,
      http_401: noTok,
      http_200: withTok,
      makeup_state: makeupState,
      public_surface: { '/api/role-names': pub },
      batt_policy_defaults: BATT_POLICY_DEFAULTS,
      checkin_policy_defaults: CHECKIN_POLICY_DEFAULTS,
      error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
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
  console.error('P8S7_FATAL', String((e as Error)?.message || e).slice(0, 400));
  await closePools().catch(() => undefined);
  process.exit(2);
});
