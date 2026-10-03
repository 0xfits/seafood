/**
 * P9⑤（`route-layer.spec` v2.20 §31 · `data-layer.spec` v0.28 §34 · `commission.spec` v0.5 §19 ·
 * `ledger.spec` §5.1 / R40 / R101 / R103）：**邀请奖励改版**（注册 `+30 batt` / 首任务 `10$` 双方）
 * 类级门 —— 计算面（6 层权重 / 距离加权 / 层内均分 / Σ 守恒 / Worker 剔除 / 上限截断留痕 /
 * `M=0` 兜底）+ 两腿接线 + 库面/HTTP 活体。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s10-invite-reward-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。产物：backend-ts/.p8s10-artifacts/p8s10-<RUN>/gate.json
 *
 * ★ A–H 静态面 **零 DB / 零网络**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）。
 * ★ K 库面 leg 转真 checks（连库 + HTTP · `0035`–`0038` 已 apply）：
 *   · 结构面活体只读（kind 24 / `schema_migration` 37·0038）；
 *   · 注册腿 `DatabaseService.grantSignupInviteBatt(uid, tx)` 事务内真跑；
 *   · 首任务腿 `DatabaseService.settleInviteFirstTaskReward({jobIdRaw}, tx)` 事务内真跑（`R-9-68` ex 注入）；
 *   · 结算计划 `planJobSettlement(input, ex)` 只读真跑（`M=6` 全 6 层 / `M=0` ⇒ `fee_credit_uid=-1`）；
 *   · 白名单外 `−1` debit 必红（`R-9-67` 判负口径取 `code = LEDGER_RESERVED_UID`）。
 *   库面写一律**事务内 + 末尾 `ROLLBACK`**；HTTP 段打受控实例 `P8S10_BASE`（默认 `127.0.0.1:5796`）。
 *   `pending_apply[]` = **0**。
 *
 * 判据（每条可判负 + 自证负对照）：
 *   A  注册点 **87** 逐 verb（`get 36 / post 48 / put 0 / patch 1 / delete 2`）+ 两腿路由在场；负对照（缩进注入 ⇒ 88）
 *   B  6 层权重向量 `[U1,U2,U3,D1,D2,D3]`（`layer_span = 6` · 方向 / 层距 / 权值逐位）
 *   C  距离加权（越近越高）· 层内均分（第二级最大余数法 + 层内 tie-break `(r DESC, uid ASC)`）· `Σ x == pool` 构造性守恒
 *   D  Worker **结构性剔除**（名单不含 Worker）+ 名单含 Worker ⇒ 落账前硬拒（500 `LEDGER_RECONCILE_MISMATCH` / `COMMISSION_CHAIN_ASSERTION_VIOLATED`）
 *   E  上限截断留痕（`capLayer 64` / `capTotal 384`；构造 >64 / >384 ⇒ 截断痕迹在场）
 *   F  `M=0` 兜底 ⇒ `fee_credit_uid = −1`（`R-9-52`）；`M=0 ∧ P>0` ⇒ 构造非法必抛
 *   G  §6.2 两腿（注册 `+30 batt` / 首任务 `10$` 双方）+ 接线点 + `ledger.ts` 三处编码
 *   H  零新增错误码（仍恰 33）+ 幂等键形态 + 指纹
 *   K  库面 / HTTP 活体（连库 + 事务内 ROLLBACK + 受控实例）；`pending_apply[]` = 0
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildCommissionRoster,
  splitPoolTwoLevel,
  assertReferralChainInvariants,
  planJobSettlement,
  computeFee,
  COMMISSION_CAP_LAYER_DEFAULT,
  COMMISSION_CAP_TOTAL_DEFAULT,
  COMMISSION_REASON,
  PLATFORM_REVENUE_UID,
  COMMISSION_POOL_UID,
} from '../src/commission';
import { LEDGER_KINDS } from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { createSessionToken } from '../src/auth';
import {
  DatabaseService,
  INVITE_REWARD_POLICY_DEFAULTS,
  INVITE_FIRST_TASK_KEY_PREFIX,
  INVITE_SIGNUP_KEY_PREFIX,
} from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s10-artifacts', `p8s10-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, expect: string): void => {
  const fired = predicate(wrongInput) === false;
  checks.push({ id: `${id}__selftest`, group: `${group}SelfTest`, pass: fired, expect,
    actual: JSON.stringify({ wrong_input: String(wrongInput).length > 140 ? `${String(wrongInput).slice(0, 140)}…` : wrongInput, judge_fired: fired }) });
};

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const COMMISSION_TS = readSrc('backend-ts/src/commission.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const LEDGER_TS = readSrc('backend-ts/src/ledger.ts');
const JOB_FUNDS_TS = readSrc('backend-ts/src/job-funds-service.ts');
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number => (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const countOf = (hay: string, re: RegExp): number => (hay.match(re) || []).length;
const B = (v: number | string): bigint => BigInt(v);

const REG_POINTS_FROZEN = 87;
const PER_VERB_FROZEN: Record<string, number> = { get: 36, post: 48, put: 0, patch: 1, delete: 2 };
const W6 = [2600, 1700, 700, 2600, 1700, 700];   // 对称 `[U1,U2,U3,D1,D2,D3]`（Σ = 10000）
const WORKER = '1000';
const NEW_KIND = 'invite_first_task_reward';

// ============================================================================
// A · 注册点 87 逐 verb + 两腿路由在场
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN, `注册点 = ${REG_POINTS_FROZEN}`, countRoutes(INDEX_TS));
  t('A2', 'registration', JSON.stringify(perVerb) === JSON.stringify(PER_VERB_FROZEN),
    `逐 verb 逐字 = ${JSON.stringify(PER_VERB_FROZEN)}`, JSON.stringify(perVerb));
  t('A3', 'registration', Object.values(perVerb).reduce((a, b) => a + b, 0) === REG_POINTS_FROZEN, '逐 verb 计数之和 = 注册点总数', Object.values(perVerb).reduce((a, b) => a + b, 0));
  const authVerify = countOf(INDEX_TS, /app\.post\('\/api\/auth\/verify'/g);
  const jobReview = countOf(INDEX_TS, /app\.post\('\/api\/job\/:jobId\/review'/g);
  t('A4', 'registration', authVerify === 1 && jobReview === 1,
    '两腿路由各**恰 1 处**：注册腿 `POST /api/auth/verify` + 结算/首任务触发口 `POST /api/job/:jobId/review`',
    JSON.stringify({ auth_verify: authVerify, job_review: jobReview }));
  const INJ = "  app.get('/api/p8s10-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  t('A5', 'registration', countRoutes(INDEX_TS + INJ) === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`, JSON.stringify({ injected: countRoutes(INDEX_TS + INJ) }));
  selfTest('A1', 'registration', (v) => countRoutes(String(v)) === REG_POINTS_FROZEN, 'x', '把非 87 条路由的文本喂入「注册点 = 87」谓词 ⇒ 必须转红');
}

// ============================================================================
// 静态夹具：合成上 3 ∪ 下 3 链（纯函数面）
// ============================================================================
type Cand = { uid: string; bound_at: string | null };
const mkUp = (uids: string[]) => ({
  nodes: uids.map((u, i) => ({ beneficiary_uid: u, level: i + 1 })),
  chain_depth: uids.length, truncated: false,
  assertions: { contiguous_levels: true, within_cap: true, all_user_uids: true, no_duplicate_uid: true },
});
const mkDown = (nodes: Array<{ uid: string; level: number }>) => ({
  nodes: nodes.map((n) => ({ descendant_uid: n.uid, level: n.level, bound_at: null })),
  down_depth: nodes.reduce((m, n) => Math.max(m, n.level), 0), truncated: false,
  assertions: { contiguous_levels: true, within_cap: true, all_user_uids: true, no_duplicate_uid: true },
});
const upChain = mkUp(['5001', '5002', '5003']);
const downChain = mkDown([{ uid: '6001', level: 1 }, { uid: '6002', level: 2 }, { uid: '6003', level: 3 }]);
const policy6 = { levels: 6, weights_bp: W6 };
const layerLabel = (d: string, dist: number): string => (d === 'up' ? `U${dist}` : `D${dist}`);
const roster = buildCommissionRoster(WORKER, upChain, downChain, policy6);
const poolLayers = roster.layers.filter((l) => l.beneficiaries.length > 0)
  .map((l) => ({ layer: l.layer, direction: l.direction, distance: l.distance, weight_bp: l.weight_bp, beneficiaries: l.beneficiaries }));
const alloc = splitPoolTwoLevel(B(10000), poolLayers);
const xOf = (label: string): string | null => {
  const e = alloc.entries.find((e) => layerLabel(e.direction, e.distance) === label);
  return e ? e.x : null;
};

// ============================================================================
// B · 6 层权重向量 [U1,U2,U3,D1,D2,D3]
// ============================================================================
{
  t('B1', 'sixLayerVector', roster.layer_span === 6 && roster.M === 6,
    '`layer_span = 6`（`min(6, levels, weights 长度)`）· `M = 6`（六个存在层）',
    JSON.stringify({ layer_span: roster.layer_span, M: roster.M }));
  const labels = roster.layers.map((l) => layerLabel(l.direction, l.distance));
  t('B2', 'sixLayerVector', JSON.stringify(labels) === JSON.stringify(['U1', 'U2', 'U3', 'D1', 'D2', 'D3']),
    '每层方向 / 层距逐位 = `[U1,U2,U3,D1,D2,D3]`（`L=1..3` 上行 / `L=4..6` 下行）', JSON.stringify(labels));
  const weights = roster.layers.map((l) => l.weight_bp);
  t('B3', 'sixLayerVector', JSON.stringify(weights) === JSON.stringify(W6),
    `每层权重向量逐字 = ${JSON.stringify(W6)}`, JSON.stringify(weights));
  const sym = roster.layers[0].weight_bp === roster.layers[3].weight_bp && roster.layers[1].weight_bp === roster.layers[4].weight_bp && roster.layers[2].weight_bp === roster.layers[5].weight_bp;
  t('B4', 'sixLayerVector', sym, '向量对称：`weight(U_d) == weight(D_d)`（`d = 1..3`）',
    JSON.stringify({ U: weights.slice(0, 3), D: weights.slice(3) }));
  selfTest('B1', 'sixLayerVector', (v) => (v as { M: number }).M === 6, { M: 5, layer_span: 5 }, '把 `M=5` 喂入「6 层」谓词 ⇒ 必须转红');
}

// ============================================================================
// C · 距离加权 + 层内均分 + Σ 守恒
// ============================================================================
{
  t('C1', 'distanceWeight', xOf('U1') === '2600' && xOf('U2') === '1700' && xOf('U3') === '700',
    '距离加权：单受益人层 `x == weight`（`U1 2600 / U2 1700 / U3 700`）',
    JSON.stringify({ U1: xOf('U1'), U2: xOf('U2'), U3: xOf('U3') }));
  const monoTone = B(xOf('U1')) > B(xOf('U2')) && B(xOf('U2')) > B(xOf('U3')) && B(xOf('D1')) > B(xOf('D2')) && B(xOf('D2')) > B(xOf('D3'));
  t('C2', 'distanceWeight', monoTone, '★ 越近越高：`x(U1) > x(U2) > x(U3)` ∧ `x(D1) > x(D2) > x(D3)`（近者优先）',
    JSON.stringify({ up: [xOf('U1'), xOf('U2'), xOf('U3')], down: [xOf('D1'), xOf('D2'), xOf('D3')] }));
  t('C3', 'distanceWeight', xOf('U1') === xOf('D1') && xOf('U2') === xOf('D2') && xOf('U3') === xOf('D3'),
    '对称：`x(U_d) == x(D_d)`（同层距等权）', JSON.stringify({ U: [xOf('U1'), xOf('U2'), xOf('U3')], D: [xOf('D1'), xOf('D2'), xOf('D3')] }));
  const sumEntries = alloc.entries.reduce((a, e) => a + B(e.x), 0n);
  t('C4', 'conservation', alloc.sum_x === '10000' && sumEntries === 10000n && alloc.sum_ok === true,
    '★ `Σ x == pool` **构造性守恒**（`Σ entries == 10000` ⇒ `sum_ok`）',
    JSON.stringify({ pool: alloc.pool, sum_x: alloc.sum_x, sum_entries: sumEntries.toString(), sum_ok: alloc.sum_ok }));
  // 层内均分（第二级最大余数法 + tie-break (r DESC, uid ASC) ⇒ 等权退化为 uid ASC）
  const single = splitPoolTwoLevel(B(100), [{ layer: 1, direction: 'up', distance: 1, weight_bp: 100, beneficiaries: [{ uid: '300' }, { uid: '100' }, { uid: '200' }] }]);
  const tieOk = single.entries.length === 3 && single.entries[0].uid === '100' && single.entries[0].x === '34' && single.entries[1].x === '33' && single.entries[2].x === '33';
  t('C5', 'intraLayer', tieOk,
    '★ 层内均分：`xL=100 / n=3 ⇒ base=33 · plus=1` ⇒ `+1` 落 **uid ASC 最小者**（`r` 等 ⇒ tie-break 退化 `uid ASC`）：`100→34 / 200→33 / 300→33`',
    JSON.stringify(single.entries.map((e) => ({ uid: e.uid, x: e.x }))));
  t('C6', 'intraLayer', single.sum_x === '100' && single.entries.reduce((a, e) => a + B(e.x), 0n) === 100n,
    '层内均分后仍 `Σ x == xL`（第二级最大余数法守恒）', JSON.stringify({ sum_x: single.sum_x }));
  selfTest('C4', 'conservation', (v) => (v as { sum_ok: boolean; sum_x: string }).sum_ok === true && (v as { sum_x: string }).sum_x === '10000',
    { sum_ok: true, sum_x: '9999' }, '把「少 1 分」的分配喂入守恒谓词 ⇒ 必须转红（去层内均分/丢余数会被抓）');
  selfTest('C5', 'intraLayer', (entries) => {
    const a = entries as Array<{ uid: string; x: string }>;
    return a.length === 3 && a[0].uid === '100' && a[0].x === '34';
  }, [{ uid: '300', x: '34' }, { uid: '200', x: '33' }, { uid: '100', x: '33' }],
    '把「最大 uid 拿 +1」的层内结果喂入 tie-break 谓词 ⇒ 必须转红');
}

// ============================================================================
// D · Worker 结构性剔除（名单不含 Worker + 含则硬拒）
// ============================================================================
{
  const downSelf = mkDown([{ uid: WORKER, level: 1 }, { uid: '6001', level: 1 }]);
  const rosterSelf = buildCommissionRoster(WORKER, upChain, downSelf, policy6);
  const inRoster = rosterSelf.uids.includes(WORKER) || rosterSelf.layers.some((l) => l.beneficiaries.some((b) => b.uid === WORKER));
  t('D1', 'workerRemoval', !inRoster,
    '★ Worker **结构性剔除**：种子注入 `worker=1000` 于下行候选 ⇒ 名单（`uids` / 每层 `beneficiaries`）**不含 Worker**',
    JSON.stringify({ uids: rosterSelf.uids.slice(0, 6), has_worker: inRoster }));
  let code: string | null = null; let reason: string | null = null;
  try {
    assertReferralChainInvariants(upChain, { worker_uid: WORKER, roster_uids: [WORKER, '5001'], down_chain: downChain });
  } catch (e) {
    const err = e as { code?: string; details?: { reason?: string } };
    code = String(err.code ?? ''); reason = err.details?.reason ?? null;
  }
  t('D2', 'workerRemoval', code === 'LEDGER_RECONCILE_MISMATCH' && reason === COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED,
    '★ 名单含 Worker ⇒ 落账前**硬拒**：`code = LEDGER_RECONCILE_MISMATCH`（500 defect）· `reason = COMMISSION_CHAIN_ASSERTION_VIOLATED` · `failed = worker_in_roster`',
    JSON.stringify({ code, reason }));
  let positiveThrew = false;
  try { assertReferralChainInvariants(upChain, { worker_uid: WORKER, roster_uids: ['5001', '5002'], down_chain: downChain }); } catch { positiveThrew = true; }
  t('D3', 'workerRemoval', !positiveThrew, '正对照：名单**不含** Worker（仅真实受益人）⇒ 断言放行（不误红）', JSON.stringify({ positive_threw: positiveThrew }));
  selfTest('D1', 'workerRemoval', (v) => (v as { uids: string[] }).uids.includes(WORKER) === false, { uids: [WORKER, '5001'] },
    '把「名单仍含 Worker」（去 Worker 剔除）喂入「不含 Worker」谓词 ⇒ 必须转红');
}

// ============================================================================
// E · 上限截断留痕（capLayer 64 / capTotal 384）
// ============================================================================
{
  t('E1', 'capTruncation', COMMISSION_CAP_LAYER_DEFAULT === 64 && COMMISSION_CAP_TOTAL_DEFAULT === 384,
    '默认上限常量 = `capLayer 64` / `capTotal 384`（`R-9-55`）',
    JSON.stringify({ cap_layer: COMMISSION_CAP_LAYER_DEFAULT, cap_total: COMMISSION_CAP_TOTAL_DEFAULT }));
  const d70 = mkDown(Array.from({ length: 70 }, (_, i) => ({ uid: `d${String(i + 1).padStart(4, '0')}`, level: 1 })));
  const rCapLayer = buildCommissionRoster(WORKER, upChain, d70, policy6, { capLayer: 64, capTotal: 384 });
  const trL = rCapLayer.truncation;
  t('E2', 'capTruncation', trL.truncated && trL.dropped_by_layer['4'] === 6 && trL.dropped_total === 6 && rCapLayer.layers.find((l) => l.layer === 4)!.beneficiaries.length === 64,
    '★ 层内上限：下行 `D1` 70 候选 ⇒ 截 64 / **丢弃 6 留痕**（`dropped_by_layer["4"]=6`）',
    JSON.stringify({ truncation: trL, d1_kept: rCapLayer.layers.find((l) => l.layer === 4)!.beneficiaries.length }));
  const d400 = mkDown(Array.from({ length: 400 }, (_, i) => ({ uid: `d${String(i + 1).padStart(4, '0')}`, level: 1 })));
  const rCapTotal = buildCommissionRoster(WORKER, upChain, d400, policy6, { capLayer: 3000, capTotal: 384 });
  const trT = rCapTotal.truncation;
  t('E3', 'capTruncation', trT.cap_total === 384 && trT.truncated && rCapTotal.uids.length === 384 && trT.dropped_total === 19,
    '★ 总名单上限：403 候选（3 上行 + 400 下行）⇒ 截 384 / **丢弃 19 留痕**（`cap_total = 384`）',
    JSON.stringify({ truncation: trT, uids: rCapTotal.uids.length }));
  t('E4', 'capTruncation', trL.truncated && trT.truncated && Object.keys(trL.dropped_by_layer).length > 0 && Object.keys(trT.dropped_by_layer).length > 0,
    '★ 截断**必留痕**：`truncated=true` ∧ `dropped_by_layer` 非空（常态 `truncated=false`）',
    JSON.stringify({ layer_trace: trL.dropped_by_layer, total_trace: trT.dropped_by_layer }));
  selfTest('E4', 'capTruncation', (v) => (v as { truncated: boolean }).truncated === true, { truncated: false, dropped_total: 0 },
    '把「无截断痕迹」（去上限截断）喂入「必留痕」谓词 ⇒ 必须转红');
}

// ============================================================================
// F · M=0 兜底 ⇒ fee_credit_uid = −1
// ============================================================================
{
  const empty = splitPoolTwoLevel(B(0), []);
  t('F1', 'm0Fallback', empty.M === 0 && empty.sum_ok === true && empty.entries.length === 0,
    '`M=0`（无合格受益人）且 `P=0` ⇒ 空分配、`sum_ok = true`',
    JSON.stringify({ M: empty.M, sum_x: empty.sum_x, entries: empty.entries.length }));
  let code: string | null = null; let reason: string | null = null;
  try { splitPoolTwoLevel(B(100), []); } catch (e) { const err = e as { code?: string; details?: { reason?: string } }; code = String(err.code ?? ''); reason = err.details?.reason ?? null; }
  t('F2', 'm0Fallback', code === 'LEDGER_ACCOUNT_GUARD_VIOLATION' && reason === COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH,
    '`M=0 ∧ P>0` ⇒ **构造非法必抛**（调用方必须把手续费入 `-1`，`R-9-52`）',
    JSON.stringify({ code, reason }));
  const srcOk = /fee_credit_uid:\s*noReferrer\s*\?\s*PLATFORM_REVENUE_UID\s*:\s*COMMISSION_POOL_UID/.test(COMMISSION_TS);
  t('F3', 'm0Fallback', srcOk && PLATFORM_REVENUE_UID === '-1' && COMMISSION_POOL_UID === '-2',
    '★ `M=0`（`noReferrer`）⇒ `fee_credit_uid = PLATFORM_REVENUE_UID = "-1"`（兜底非抽成）；否则 `-2`（池）',
    JSON.stringify({ src: srcOk, revenue_uid: PLATFORM_REVENUE_UID, pool_uid: COMMISSION_POOL_UID }));
  selfTest('F1', 'm0Fallback', (v) => (v as { fee_credit_uid: string }).fee_credit_uid === '-1', { fee_credit_uid: '-2' },
    '把「M=0 ⇒ 池 `-2`」（去 `M=0` 赋 −1）喂入「`fee_credit_uid=-1`」谓词 ⇒ 必须转红');
}

// ============================================================================
// G · §6.2 两腿 + 接线点 + ledger.ts 三处编码
// ============================================================================
{
  const defsOk = INVITE_REWARD_POLICY_DEFAULTS.signupBatt === 30 && INVITE_REWARD_POLICY_DEFAULTS.firstTaskUsd === 10 && INVITE_REWARD_POLICY_DEFAULTS.rewardLevels === 6;
  t('G1', 'twoLegs', defsOk, '`INVITE_REWARD_POLICY_DEFAULTS = { signupBatt 30 / firstTaskUsd 10 / rewardLevels 6 }`（§6.2①②）',
    JSON.stringify(INVITE_REWARD_POLICY_DEFAULTS));
  const battLeg = /grantSignupInviteBatt/.test(DATABASE_TS) && DATABASE_TS.includes('invite_signup') && /batt_entry/.test(DATABASE_TS) && INVITE_SIGNUP_KEY_PREFIX === 'biz:invite:signup:';
  t('G2', 'twoLegs', battLeg, '注册腿 = batt 面（`batt_account` upsert + `batt_entry` · `reason=invite_signup` · **零 kind**）· 键前缀 `biz:invite:signup:`',
    JSON.stringify({ key: INVITE_SIGNUP_KEY_PREFIX, has_reason: DATABASE_TS.includes('invite_signup') }));
  const ftLeg = DATABASE_TS.includes("kind: 'invite_first_task_reward'") && /postEvent\(/.test(DATABASE_TS) && INVITE_FIRST_TASK_KEY_PREFIX === 'biz:invite:firsttask:';
  t('G3', 'twoLegs', ftLeg, '首任务腿 = **唯一写入面 `postEvent`**（`kind = invite_first_task_reward`）· 键前缀 `biz:invite:firsttask:<worker_uid>`',
    JSON.stringify({ key: INVITE_FIRST_TASK_KEY_PREFIX, has_kind: DATABASE_TS.includes("kind: 'invite_first_task_reward'") }));
  const threeEncodings = LEDGER_KINDS.includes(NEW_KIND as never) && LEDGER_TS.includes("invite_first_task_reward") && countOf(DATABASE_TS, /invite_first_task_reward/g) >= 1;
  t('G4', 'twoLegs', threeEncodings, '三处编码同集：TS `LEDGER_KINDS` ⊇ `invite_first_task_reward` · DB（`0038`）· 业务调用面',
    JSON.stringify({ in_ts: LEDGER_KINDS.includes(NEW_KIND as never) }));
  const wired = /findOrCreateUserByEvm/.test(DATABASE_TS) && /grantSignupInviteBatt\(/.test(DATABASE_TS)
    && /settleFirstTaskRewardBestEffort/.test(JOB_FUNDS_TS) && /payload\.op\s*!==\s*'settle'/.test(JOB_FUNDS_TS) && /\.catch\(/.test(JOB_FUNDS_TS);
  t('G5', 'twoLegs', wired,
    '★ 接线点：注册腿 `findOrCreateUserByEvm` → `grantSignupInviteBatt`（失败不阻断）；首任务腿 `job-funds-service` 结算后 `settleFirstTaskRewardBestEffort`（仅 `op === "settle"` · `.catch` 不阻断）',
    JSON.stringify({ reg: /grantSignupInviteBatt\(/.test(DATABASE_TS), ft: /settleFirstTaskRewardBestEffort/.test(JOB_FUNDS_TS) }));
}

// ============================================================================
// H · 零新增错误码（仍恰 33）+ 幂等键形态 + 指纹
// ============================================================================
{
  t('H1', 'closedSets', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（**不动**）', LEDGER_ERROR_CODES.length);
  t('H2', 'idempotency', INVITE_SIGNUP_KEY_PREFIX === 'biz:invite:signup:' && INVITE_FIRST_TASK_KEY_PREFIX === 'biz:invite:firsttask:',
    '幂等键前缀 = `biz:invite:signup:<uid>` / `biz:invite:firsttask:<worker_uid>`（服务端派生 · 只由不可变 uid 派生）',
    JSON.stringify({ signup: INVITE_SIGNUP_KEY_PREFIX, firsttask: INVITE_FIRST_TASK_KEY_PREFIX }));
  t('H3', 'idempotency', /fingerprintOf\(\['invite\.first_task'/.test(DATABASE_TS),
    "首任务腿 `request_fingerprint = sha256('invite.first_task|job|worker|parent|perLeg')`（同业务事实 ⇒ 同指纹 ⇒ 重放不退化 409）",
    JSON.stringify({ has_fp: /fingerprintOf\(\['invite\.first_task'/.test(DATABASE_TS) }));
  selfTest('H1', 'closedSets', (v) => (v as string[]).length === 33, [...LEDGER_ERROR_CODES, 'LEDGER_MADEUP_CODE'], '把 34 条闭集喂入 ⇒ 必须转红');
}

// ============================================================================
// K · 库面 leg 转真 checks（连库 + HTTP · 事务内行为探针末尾 ROLLBACK · pending_apply[] = 0）
// ============================================================================
const pendingApply: Array<{ leg: string; reason: string }> = [];
const strOf = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

(async () => {
  let dbConnections = 0;
  let httpCalls = 0;
  const kg = (id: string, pass: boolean, expect: unknown, actual: unknown): void =>
    checks.push({ id, group: 'dbLive', pass: Boolean(pass), expect: String(expect), actual: String(actual) });
  const live: Record<string, unknown> = {};
  const SENT = 'P8S10_LIVE_ROLLBACK';
  const evmOf = (uid: number): string => `0x${uid.toString(16).padStart(40, '0')}`;

  try {
    // ---------------- K1/K2 · 结构面活体（只读） ----------------
    const kindDef = (await readQuery<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`))[0]?.def ?? '';
    dbConnections += 1;
    const KINDS_DB = (kindDef.match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1));
    live.live_kind_enum = { n: KINDS_DB.length, has_new: KINDS_DB.includes(NEW_KIND) };
    kg('K1', KINDS_DB.length === 24 && KINDS_DB.includes(NEW_KIND) && KINDS_DB.length === LEDGER_KINDS.length,
      '★ 活体 `ledger_kind_enum` = 24 值（`0038` 已 apply）· 含 `invite_first_task_reward` · 与 TS 同集',
      JSON.stringify(live.live_kind_enum));
    const sm = (await readQuery<{ n: string; mx: string | null }>(`SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`))[0];
    dbConnections += 1;
    kg('K2', Number(sm.n) === 37 && String(sm.mx) === '0038',
      '★ `schema_migration` = **37 行** · `max(version)` = **0038**（`0035`→…→`0038` 已 apply）', JSON.stringify(sm));

    // ---------------- K3–K7 · 行为真读数（事务内 + 末尾 ROLLBACK） ----------------
    const sp = async <T>(tx: TxClient, name: string, fn: () => Promise<T>): Promise<{ ok: boolean; v?: T; sqlstate?: string; message?: string; reason?: string | null }> => {
      await tx.query(`SAVEPOINT ${name}`);
      try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return { ok: true, v }; }
      catch (e) {
        await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
        const err = e as { code?: string; message?: string; detail?: string; details?: { reason?: string } };
        let reason: string | null = err.details?.reason ?? null;
        if (reason === null && err.detail) { try { reason = (JSON.parse(String(err.detail)) as { reason?: string }).reason ?? null; } catch { /* noop */ } }
        return { ok: false, sqlstate: strOf(err.code), message: strOf(err.message).slice(0, 120), reason };
      }
    };
    const inTx: Record<string, unknown> = {};
    try {
      await withTransaction(async (tx: TxClient) => {
        const q = <T>(s: string, p?: unknown[]): Promise<T[]> => tx.query<T>(s, p).then((r) => r.rows);
        // fixtures：users（FK 目标）+ 上 3 ∪ 下 3 referral 图 + 无邀请关系用户
        const users = [9600001, 9600002, 9600003, 9600004, 9600011, 9600012, 9600013, 9600014, 9600015];
        for (const uid of users) {
          await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last) VALUES ($1, $2, '', false, now(), now())`, [uid, evmOf(uid)]);
        }
        // `referral_bind(p_child_uid, p_parent_uid)`（签名 `(child, parent)`）。
        // ★ 绑定顺序须**自上而下 / 由根向外**：DB 协议 `BIND_PARENT_BEFORE_DESCENDANTS` —— child 已有后代时
        //   不得再绑其父（会追溯失效其后代 depth）⇒ 上行先绑 U3（最上祖先）再 U2/U1；下行由 Worker 向外 D1/D2/D3。
        await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600003, 9600004]); // U3：child 9600003 ← parent 9600004
        await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600002, 9600003]); // U2
        await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600001, 9600002]); // U1：child 9600001 ← parent 9600002
        await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600011, 9600001]); // D1：child 9600011 ← parent 9600001
        await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600012, 9600011]); // D2
        await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600013, 9600012]); // D3
        inTx.fixtures_ok = true;

        // ---- K3 注册腿真跑（方法级 · ex 注入）：建行 +30 / 重放零新增 ----
        const grant = async (uid: number) => {
          const r = await DatabaseService.grantSignupInviteBatt(uid, tx);
          const entry = await q<Record<string, unknown>>(`SELECT delta::text, batt_after::text, reason, idempotency_key FROM public.batt_entry WHERE uid=$1 ORDER BY txid`, [uid]);
          return { outcome: r.outcome, batt: r.batt, granted: r.grantedBatt, source: r.source, entry_rows: entry.length, entry };
        };
        const gNew = await grant(9600014);
        const gReplay = await grant(9600014);
        inTx.reg_new = gNew; inTx.reg_replay = gReplay;
        kg('K3', gNew.outcome === 'granted' && gNew.granted === 30 && gNew.entry_rows === 1 && gReplay.outcome === 'replayed' && gReplay.granted === 0 && gReplay.entry_rows === 1,
          '★ 注册腿真跑：新户 ⇒ `granted` `+30 batt`（1 行 `batt_entry`）；同键重放 ⇒ `replayed` **零新增**',
          JSON.stringify({ new: { outcome: gNew.outcome, granted: gNew.granted }, replay: { outcome: gReplay.outcome, granted: gReplay.granted, rows: gReplay.entry_rows } }));

        // ---- K4 首任务腿真跑（方法级 · ex 注入）：-1 出 20$ / 本人 + 上级各 10$ / 重放零新增 ----
        await tx.query(`INSERT INTO public.job (employer_uid, worker_uid, cid, reward, create_key) VALUES ($1, $2, 1, 100000, $3)`,
          [9600004, 9600001, `p8s10:job:${RUN}`]);
        const jobId = String((await q<{ j: string }>(`SELECT job_id::text AS j FROM public.job WHERE create_key=$1`, [`p8s10:job:${RUN}`]))[0].j);
        const rowsOf = async (key: string) => q<Record<string, unknown>>(`SELECT uid::text AS uid, delta::text AS delta FROM public.ledger_entry WHERE split_part(idempotency_key,'#',1)=$1 ORDER BY txid`, [key]);
        const before = await rowsOf(`biz:invite:firsttask:9600001`);
        const s1 = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: jobId }, tx);
        const after1 = await rowsOf(`biz:invite:firsttask:9600001`);
        const s2 = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: jobId }, tx);
        const after2 = await rowsOf(`biz:invite:firsttask:9600001`);
        inTx.ft_method = { s1, rows: after1.map((r) => ({ uid: r.uid, delta: r.delta })) };
        const legs = after1.map((r) => `${r.uid}:${r.delta}`).sort();
        kg('K4', s1.outcome === 'posted' && s1.recipientUids.length === 2 && s1.perLegUsd === 10 && s1.totalUsdFromPlatform === '20'
          && legs.join(',') === '-1:-20,9600001:10,9600002:10' && s2.outcome === 'replayed' && after2.length === after1.length && before.length === 0,
          '★ 首任务腿真跑（方法级 · `ex` 注入）：`posted` · `-1 −20` / 本人 `9600001 +10` / 直接上级 `9600002 +10` · 同键重放 `replayed` **零新增**',
          JSON.stringify({ outcome: s1.outcome, recipients: s1.recipientUids, legs: legs.join(',') , replay: s2.outcome, rows: `${before.length}→${after1.length}→${after2.length}` }));

        // ---- K5 白名单外 −1 debit 必红（R-9-67 判负口径取 code = LEDGER_RESERVED_UID） ----
        const negOut = await sp(tx, 'sp_m1_debit_jobfee', () =>
          tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'debit')`).then((r) => r.rows[0]));
        const posOut = await sp(tx, 'sp_m1_debit_invite', () =>
          tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint, 'invite_first_task_reward', 'debit')`).then((r) => r.rows[0]));
        inTx.whitelist = { neg: negOut, pos: posOut };
        kg('K5', negOut.ok === false && negOut.sqlstate === 'LD021' && negOut.message === 'LEDGER_RESERVED_UID' && negOut.reason === 'PLATFORM_DEBIT_FORBIDDEN' && posOut.ok === true,
          '★ 白名单外 `−1` debit **必红**（`code = LEDGER_RESERVED_UID`〔LD021〕· `reason = PLATFORM_DEBIT_FORBIDDEN` · `R-9-67` 判负口径）；白名单内 `invite_first_task_reward` **放行**',
          JSON.stringify({ neg: { sqlstate: negOut.sqlstate, code: negOut.message, reason: negOut.reason }, pos_ok: posOut.ok }));

        // ---- K6 结算计划真跑（只读 · M=6 全 6 层）：Σ x == fee · 距离加权 · fee_credit_uid = -2 ----
        const plan = await planJobSettlement({ jobId: '9700001', employerUid: 9600004, workerUid: 9600001, cid: 1, gross: 100000, ex: tx });
        const planSum = plan.layers.reduce((a, l) => a + BigInt(l.x), 0n);
        const upU1 = plan.layers.find((l) => l.direction === 'up' && l.distance === 1)!.x;
        const upU2 = plan.layers.find((l) => l.direction === 'up' && l.distance === 2)!.x;
        const upU3 = plan.layers.find((l) => l.direction === 'up' && l.distance === 3)!.x;
        inTx.plan_m6 = { M: plan.M, fee: plan.fee, sum: planSum.toString(), fee_credit_uid: plan.fee_credit_uid, up: [upU1, upU2, upU3] };
        kg('K6', plan.M === 6 && plan.fee === computeFee(100000, 1000).toString() && planSum === BigInt(plan.fee) && plan.fee_credit_uid === '-2'
          && BigInt(upU1) > BigInt(upU2) && BigInt(upU2) > BigInt(upU3),
          '★ 结算计划真跑（只读）：`M=6` · `fee=10000`（policy 34 `fee_rate_bp=1000`）· `Σ layers x == fee` · 距离加权 `U1>U2>U3` · `fee_credit_uid = -2`',
          JSON.stringify(inTx.plan_m6));

        // ---- K7 M=0 兜底真跑（无邀请关系 ⇒ fee_credit_uid = −1） ----
        const plan0 = await planJobSettlement({ jobId: '9700002', employerUid: 9600014, workerUid: 9600015, cid: 1, gross: 100000, ex: tx });
        inTx.plan_m0 = { M: plan0.M, fee_credit_uid: plan0.fee_credit_uid, no_referrer: plan0.no_referrer, layers: plan0.layers.length };
        kg('K7', plan0.M === 0 && plan0.no_referrer === true && plan0.fee_credit_uid === '-1' && plan0.layers.length === 0,
          '★ `M=0` 兜底真跑：无合格受益人 ⇒ `no_referrer=true` · `fee_credit_uid = "-1"`（平台收入兜底非抽成 · `R-9-52`）',
          JSON.stringify(inTx.plan_m0));

        throw new Error(SENT);
      });
    } catch (e) { if (String((e as Error)?.message) !== SENT) throw e; }
    dbConnections += 1;

    // ---------------- K8 · 受控实例真 HTTP（公开面 + 鉴权面） ----------------
    const HTTP_BASE = process.env.P8S10_BASE || 'http://127.0.0.1:5796';
    let httpErr: string | null = null;
    let pub = -1; let noTokBatt = -1;
    try {
      pub = (await fetch(`${HTTP_BASE}/api/role-names`)).status; httpCalls += 1;
      noTokBatt = (await fetch(`${HTTP_BASE}/api/batt`)).status; httpCalls += 1;
    } catch (e) { httpErr = String((e as Error)?.message || e).slice(0, 120); }
    // ★ 受控实例 HTTP 腿的 token 必须指向**活体已提交**用户：`requireActor` 会按 token 的 uid 查库解析
    //   （事务内夹具 uid 未提交 ⇒ 解析失败 ⇒ 401）；取活体既有用户（与 `p8-s8` 同锚 `uid=11`）。
    const token = createSessionToken({ uID: 11, evm: '' });
    let tokBatt = -1;
    try { tokBatt = (await fetch(`${HTTP_BASE}/api/batt`, { headers: { authorization: `Bearer ${token}` } })).status; httpCalls += 1; } catch (e) { httpErr = httpErr ?? String((e as Error)?.message || e).slice(0, 120); }
    inTx.http = { pub, no_tok_batt: noTokBatt, tok_batt: tokBatt, err: httpErr };
    kg('K8', httpErr === null && pub === 200 && noTokBatt === 401 && tokBatt === 200,
      '★ 受控实例真 HTTP：公开面 `GET /api/role-names` ⇒ 200；`GET /api/batt` 无 token ⇒ 401 ⇄ 有 token ⇒ 200',
      JSON.stringify(inTx.http));

    live.db_connections = dbConnections;
    live.in_tx = inTx;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    kg('K-FATAL', false, '库面 leg 无异常', JSON.stringify({ code: strOf(err.code), message: strOf(err.message).slice(0, 200) }));
  }

  // ---------------- 结论 ----------------
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S10-INVITE-REWARD-GATE',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: false,
    db_connections: dbConnections,
    http_calls: httpCalls,
    note: 'A–H 静态面零 DB / 零 HTTP；K 库面 leg **连库 + 受控实例**（事务内 + 末尾 ROLLBACK · `pending_apply[]` = 0）。',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    pending_apply: pendingApply,
    readings: {
      registration_points_total: countRoutes(INDEX_TS),
      registration_points_per_verb: PER_VERB_FROZEN,
      weight_vector: W6,
      alloc_entries: alloc.entries.length,
      alloc_sum_x: alloc.sum_x,
      cap_layer_default: COMMISSION_CAP_LAYER_DEFAULT,
      cap_total_default: COMMISSION_CAP_TOTAL_DEFAULT,
      ledger_kinds_count: LEDGER_KINDS.length,
      has_new_kind: LEDGER_KINDS.includes(NEW_KIND as never),
      invite_reward_defaults: INVITE_REWARD_POLICY_DEFAULTS,
      error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
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
  console.error('P8S10_FATAL', String((e as Error)?.stack || e).slice(0, 800));
  await closePools().catch(() => undefined);
  process.exit(2);
});
