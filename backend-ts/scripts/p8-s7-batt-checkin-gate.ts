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
 *   （约束活体 21 / 4 表 + 4 触发器 + 具名索引 / `ledger_kind_ok` 活体 = 21 / 范围 CHECK / append-only 真行为 /
 *   4 新口真 HTTP 401⇄200）**在本门内逐条真读数入 `checks`** ⇒ `pending_apply[]` = **0**（不再有未验 leg）。
 *   DB 段 = 只读 + **事务内行为探针（末尾 ROLLBACK）**；HTTP 段打受控实例 `P8S7_BASE`（默认 `127.0.0.1:5797`）。
 *
 * 判据（每条**可判负**）：
 *   A  **注册点 85 逐 verb + 4 新口在场**：`get 36 / post 46 / put 0 / patch 1 / delete 2`（和 = 85）；
 *      4 路径逐条注册**恰 1 处**；负对照（缩进注入 ⇒ +1）
 *   B  **4 新口形态**：四口全闸 `requireActor`（零 admin 键）；取数 / 响应冻结键集逐条；幂等键 `biz:` 派生形；
 *      `target_day` 服务端校验；异常面 `sendInfraMapped` 四标签；负对照（注入 admin 闸 ⇒ 谓词转红）
 *   C  **双闸两处**：① `applyToJob` **前置拦**（`batt_account` ≥ 阈值，落 INSERT CTE `WHERE` 内 · fail-fast）；
 *      ② `acceptJobApplication` **权威扣费点**（同事务 `deduct` 扣 `taskCostBatt` + 二次判 `b.batt >= cost`）；
 *      两处各映射 `batt_below_threshold` ⇒ `stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD')`（借既有码）；负对照
 *   D  **`R-9-21` kind 闭集三处编码均含 21**：① `0028` `ledger_kind_enum` CHECK ② `0029` `ledger_kind_ok`
 *      ③ TS `LEDGER_KINDS`（三处同集）；**穷举扫面结论「无第四处」**（正则 + 命中分类逐桶）
 *   E  **幂等 / 日界 / 溢出 / 配置 fail-closed**：`biz:checkin:<uid>:<day>` / `biz:checkin:makeup:<uid>:<day>`；
 *      日界 = UTC（`now() AT TIME ZONE 'UTC'` / `utcDay`）；溢出 = 封顶丢弃（`LEAST` + `delta <> 0` 守卫）；
 *      配置 fail-closed（`resolveBattPolicy` / `resolveCheckinPolicy` 逐字段回落常量）；负对照
 *   F  **零新增错误码（仍恰 33）**：补签拒绝面只用既有闭集码（`LEDGER_AMOUNT_INVALID` /
 *      `LEDGER_INSUFFICIENT_BALANCE` / `LEDGER_CURRENCY_INVALID_TRANSITION`）；负对照
 *   G  **库面 leg 转真 checks（连库 + HTTP）**：活体 `ledger_kind_enum` = 21 / 4 表 + 约束 + 具名索引 /
 *      4 触发器 / `ledger_kind_ok` 活体 = 21 / `batt_account` 范围 CHECK / append-only 真行为（事务内 ROLLBACK）/
 *      4 新口真 HTTP（无 token 401 ⇄ 有 token 200）+ 公开面零回归；`pending_apply[]` = 0
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BATT_POLICY_DEFAULTS,
  CHECKIN_POLICY_DEFAULTS,
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
const FE_BATT_JS = readSrc('frontend/src/batt-checkin.js');
const FE_PANEL_JSX = readSrc('frontend/src/components/BattCheckinPanel.jsx');

// ---------------------------------------------------------------- 冻结常量
const REG_POINTS_FROZEN = 85;
const PER_VERB_FROZEN: Record<string, number> = { get: 36, post: 46, put: 0, patch: 1, delete: 2 };
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

// ============================================================================
// A · 注册点 80 逐 verb + 4 新口在场
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
    `注册点 = ${REG_POINTS_FROZEN}（P9② batt/签到 4 新口 +4〔76→80〕⇒ P9③ 评分/时效/订单 5 新口 +5〔80→85〕）`, countRoutes(INDEX_TS));
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
  selfTest('A1', 'registration', (v) => countRoutes(String(v)) === REG_POINTS_FROZEN, 'x', '把非 85 条路由的文本喂入「注册点 = 85」谓词 ⇒ 必须转红');
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

  // ② R1 GET /api/batt：6 键 + getBatt
  t('B2', 'routeShape',
    eqJson(successKeys(BLOCK_BATT), ['acceptThresholdBatt', 'batt', 'canAccept', 'capBatt', 'floorBatt', 'updated_at'])
    && /DatabaseService\.getBatt\(/.test(BLOCK_BATT),
    'R1 `GET /api/batt`：`data` 冻结 6 键（batt/capBatt/floorBatt/acceptThresholdBatt/canAccept/updated_at）+ 取数 `DatabaseService.getBatt(`',
    JSON.stringify({ keys: successKeys(BLOCK_BATT), getBatt: /DatabaseService\.getBatt\(/.test(BLOCK_BATT) }));

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
  const mapCount = countOf(JOB_SERVICE_TS, /stateConflict\('batt',\s*'BATT_BELOW_ACCEPT_THRESHOLD'/g);
  t('C5', 'doubleGate', mapCount === 2,
    "两处 outcome ⇒ `stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD', …)`（**借既有「非法状态转移」族码** · 零新增码 · R107）",
    JSON.stringify({ stateConflict_batt: mapCount }));
  t('C6', 'doubleGate', /fail\(409,\s*'LEDGER_CURRENCY_INVALID_TRANSITION'/.test(JOB_SERVICE_TS) && LEDGER_ERROR_CODES.includes('LEDGER_CURRENCY_INVALID_TRANSITION' as never),
    '`stateConflict` 落码 = `LEDGER_CURRENCY_INVALID_TRANSITION`（∈ 闭集 33）', JSON.stringify({ in_closed_set: LEDGER_ERROR_CODES.includes('LEDGER_CURRENCY_INVALID_TRANSITION' as never) }));
  selfTest('C2', 'doubleGate',
    (v) => /deduct AS \(/.test(String(v)) && /b\.batt >= \(SELECT cost FROM thr\)/.test(String(v)),
    ACCEPT_REGION.replace(/b\.batt >= \(SELECT cost FROM thr\)/, 'true'),
    '把「二次判被写成恒真」的区域喂入 ⇒ 双闸谓词必须转红');
}

// ============================================================================
// D · R-9-21 kind 闭集三处编码均含 21 + 穷举扫面「无第四处」
// ============================================================================
const KINDS_FROM_TS: string[] = [...LEDGER_KINDS];
const NEW_KIND = 'checkin_makeup_fee';
const sortedEq = (a: string[], b: string[]): boolean => eqJson([...a].sort(), [...b].sort());
// ① 0028 CHECK 值集
const m28 = SQL_0028.match(/ADD CONSTRAINT ledger_kind_enum CHECK \(kind IN \(([\s\S]*?)\)\)/);
const KINDS_0028 = (m28 ? (m28[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
// ② 0029 ledger_kind_ok 值集（第一支）+ 冻结族第二支
const m29 = SQL_0029.match(/SELECT p_kind IN \(([^)]*)\)\s*AND \(NOT p_frozen_settle OR p_kind IN \(([^)]*)\)\)/);
const KINDS_0029 = (m29 ? (m29[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0029_FROZEN = (m29 ? (m29[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));

/** 穷举扫面（沿 `R-9-21` 正则）：全仓根，排除 artifacts / node_modules / dist / .git。 */
const SCAN_RE = /ledger_kind_ok|ledger_kind_enum|LEDGER_KINDS|PLATFORM_KIND_WHITELIST|checkin_makeup_fee/;
const SCAN_ROOTS = ['backend-ts/src', 'backend-ts/migrations', 'backend-ts/scripts', 'frontend/src', 'docs'];
const SCAN_EXT = ['.ts', '.sql', '.js', '.jsx', '.mjs', '.md'];
const walk = (dir: string, out: string[]): void => {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(ent.name) || ent.name.includes('artifacts')) continue;
      walk(p, out);
    } else if (SCAN_EXT.includes(path.extname(ent.name))) {
      out.push(p);
    }
  }
};
const allScanFiles: string[] = [];
for (const r of SCAN_ROOTS) walk(path.resolve(REPO_ROOT, r), allScanFiles);
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
const FULL_SET_EXPECTED = [
  'backend-ts/migrations/0028_kind_close_set_21.sql',
  'backend-ts/migrations/0029_batt_checkin.sql',
  'backend-ts/src/ledger.ts',
].sort();
const BUCKETS = ['full_set_21', 'spec_text', 'historical_or_superseded', 'single_kind_usage', 'probe_or_artifact', 'readonly_call_or_subset'];
const bucketCounts: Record<string, number> = Object.fromEntries(BUCKETS.map((b) => [b, scanHits.filter((h) => h.bucket === b).length]));
{
  // D1 TS LEDGER_KINDS
  t('D1', 'kindCloseSet', KINDS_FROM_TS.length === 21 && KINDS_FROM_TS[KINDS_FROM_TS.length - 1] === NEW_KIND && KINDS_FROM_TS.includes(NEW_KIND),
    `③ TS \`LEDGER_KINDS\` = 21 值（末位追加 \`${NEW_KIND}\`，不改既有 20 次序）`, JSON.stringify({ n: KINDS_FROM_TS.length, last: KINDS_FROM_TS[KINDS_FROM_TS.length - 1] }));
  // D2 0028 CHECK
  t('D2', 'kindCloseSet', KINDS_0028.length === 21 && KINDS_0028.includes(NEW_KIND) && sortedEq(KINDS_0028, KINDS_FROM_TS),
    `① \`0028\` \`ledger_kind_enum\` CHECK = 21 值且含 \`${NEW_KIND}\`（与 TS 同集）`, JSON.stringify({ n: KINDS_0028.length, has_new: KINDS_0028.includes(NEW_KIND), same_set: sortedEq(KINDS_0028, KINDS_FROM_TS) }));
  // D3 0029 ledger_kind_ok 第一支
  t('D3', 'kindCloseSet', KINDS_0029.length === 21 && KINDS_0029.includes(NEW_KIND) && sortedEq(KINDS_0029, KINDS_FROM_TS),
    `② \`0029\` \`ledger_kind_ok\` 第一支 = 21 值且含 \`${NEW_KIND}\`（与 TS 同集）`, JSON.stringify({ n: KINDS_0029.length, has_new: KINDS_0029.includes(NEW_KIND), same_set: sortedEq(KINDS_0029, KINDS_FROM_TS) }));
  // D4 三处同集
  t('D4', 'kindCloseSet', sortedEq(KINDS_0028, KINDS_0029) && sortedEq(KINDS_0028, KINDS_FROM_TS),
    '三处编码**同集**（① CHECK ② 函数 ③ TS）', JSON.stringify({ check_eq_fn: sortedEq(KINDS_0028, KINDS_0029), check_eq_ts: sortedEq(KINDS_0028, KINDS_FROM_TS) }));
  // D5 冻结族第二支一字不动
  t('D5', 'kindCloseSet', eqJson([...KINDS_0029_FROZEN].sort(), ['hold_forfeit', 'job_payout', 'purchase', 'trade']) && !KINDS_0029_FROZEN.includes(NEW_KIND),
    "`ledger_kind_ok` 的第二支（`p_frozen_settle`）**一字不动** = 4 值且**不含** `checkin_makeup_fee`（该 kind 不属冻结结算族）",
    JSON.stringify({ frozen: [...KINDS_0029_FROZEN].sort(), has_new: KINDS_0029_FROZEN.includes(NEW_KIND) }));
  // D6 穷举扫面：全闭集编码（≥21 值）在代码面**恰三处**
  t('D6', 'kindCloseSet', eqJson(FULL_SET_CODE, FULL_SET_EXPECTED),
    '★ **穷举扫面结论「无第四处」**：代码面（非 docs）全闭集编码（≥21 值）**恰三处** = 0028 CHECK / 0029 函数 / `src/ledger.ts`',
    JSON.stringify({ found: FULL_SET_CODE, expected: FULL_SET_EXPECTED }));
  // D7 命中分类（正则 + 逐桶计数）
  const classified = FULL_SET_CODE.length === 3 && bucketCounts.full_set_21 === 3;
  t('D7', 'kindCloseSet', classified,
    `扫面正则 = ${SCAN_RE.source}；命中分类逐桶 = ${JSON.stringify(bucketCounts)}（full_set_21 恰 3 ⇒ 其余 = 派生子集 / 只读调用 / 历史被取代 / 规范文本 / 弃件）`,
    JSON.stringify({ regex: SCAN_RE.source, roots: SCAN_ROOTS, buckets: bucketCounts, hits: scanHits.length }));
  // D8 无第四处（等价判别）：代码面「含新 kind 且 kind 数 ≥ 20」的文件 == 恰三处
  const fourth = scanHits.filter((h) => !h.file.startsWith('docs/') && h.has_new_kind && h.kinds >= 20).map((h) => h.file).sort();
  t('D8', 'kindCloseSet', eqJson(fourth, FULL_SET_EXPECTED),
    '★ 「无第四处」等价判别：代码面**含 `checkin_makeup_fee` 且 kind 数 ≥ 20** 的文件 = 恰三处（其余含新 kind 者皆为单值使用，如 `src/database.ts`）',
    JSON.stringify({ files_with_new_kind_and_full_list: fourth }));
  selfTest('D6', 'kindCloseSet',
    (hits) => (Array.isArray(hits) ? hits.filter((h: { bucket: string }) => h.bucket === 'full_set_21').map((h: { file: string }) => h.file).sort() : []).length === 0,
    [{ file: 'backend-ts/src/fourth-place.ts', bucket: 'full_set_21' }],
    '把「凭空多出一个全闭集编码文件」喂入 ⇒ 谓词必须转红');
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

  // ---------------- G1 · 活体 0028 `ledger_kind_enum` = 21 ----------------
  const kindDef = (await readQuery<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`))[0];
  dbConnections += 1;
  const KINDS_DB = ((kindDef?.def ?? '').match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1));
  tg('G1', KINDS_DB.length === 21 && KINDS_DB.includes(NEW_KIND) && sortedEq(KINDS_DB, KINDS_FROM_TS),
    '★ 活体 `0028 ledger_kind_enum` = 21 值（含 `checkin_makeup_fee` · 与 TS 同集）',
    JSON.stringify({ n: KINDS_DB.length, has_new: KINDS_DB.includes(NEW_KIND) }));

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
  const api = async (method: string, p: string, token?: string, body?: unknown) => {
    httpCalls += 1;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`${HTTP_BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let j: Record<string, unknown> | null = null;
    try { j = (await r.json()) as Record<string, unknown>; } catch { /* non-json */ }
    return { status: r.status, success: j?.success ?? null };
  };
  let httpErr: string | null = null;
  const noTok: Record<string, number> = {};
  const withTok: Record<string, number> = {};
  let pub = -1;
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
    const routes: Array<[string, string, string, unknown]> = [
      ['GET', '/api/batt', 'batt', undefined],
      ['GET', '/api/checkin', 'checkin.get', undefined],
      ['POST', '/api/checkin', 'checkin.post', {}],
      ['POST', '/api/checkin/makeup', 'checkin.makeup', { target_day: prevBusinessDay() }],
    ];
    for (const [m, p] of routes) noTok[`${m} ${p}`] = (await api(m, p)).status;
    for (const [m, p, , b] of routes) withTok[`${m} ${p}`] = (await api(m, p, token, b)).status;
    pub = (await api('GET', '/api/role-names')).status;
  } catch (e) { httpErr = String((e as Error)?.message || e).slice(0, 120); }
  const routeKeys = ['GET /api/batt', 'GET /api/checkin', 'POST /api/checkin', 'POST /api/checkin/makeup'];
  tg('G8', httpErr === null && routeKeys.every((k) => noTok[k] === 401),
    '★ 4 新口无 token ⇒ 逐口 401（真 HTTP）', JSON.stringify({ no_token: noTok, err: httpErr }));
  tg('G9', httpErr === null && routeKeys.every((k) => withTok[k] === 200),
    '★ 4 新口有 token ⇒ 逐口 200（真 HTTP）', JSON.stringify({ with_token: withTok, err: httpErr }));
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
        ts_ledger_kinds: KINDS_FROM_TS.length,
      },
      live_db_kind_enum: KINDS_DB.length,
      live_db_tables: tabs,
      live_db_triggers: trgNames,
      db_connections: dbConnections,
      http_calls: httpCalls,
      http_401: noTok,
      http_200: withTok,
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
