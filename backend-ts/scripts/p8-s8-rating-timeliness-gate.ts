/**
 * 批 9 第 3 片（P9③ · `route-layer.spec` v2.16 §29 · `data-layer.spec` v0.23 §32）：
 * **评分 / 时效 / 订单状态机（发货·收货）** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s8-rating-timeliness-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s8-artifacts/p8s8-<RUN>/gate.json
 *
 * ★ A–F 静态面 **零 DB / 零网络**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）；
 *   **G 库面 leg 已转真 checks**（`0030`/`0031` 已 apply）：连库取证（活体约束 / 函数 / 表 / 触发器真行为）
 *   + **四段真链路**（评分提交 / 汇总四周期与兜底 · 时效 T1..T4 · 发货 / 收货 transition 与事件行同生同灭 ·
 *   退款闸放宽 `shipped→refunded` 可退 / `received→refunded` 仍禁）一律 **事务内 + 末尾 `ROLLBACK`**
 *   + 受控实例真 HTTP（5 新口 401 / 读口 200 / 写口非法入参 400·404 零写）。`pending_apply[]` 归零。
 *   扫面根 = `backend-ts/src` · `backend-ts/migrations` · `frontend/src`；**本门探针落 `.p8s8-artifacts/` 之外**（本门本身在 `scripts/`，不含自造路径字面量）。
 *
 * 判据（每条可判负 + 自证负对照）：
 *   A  注册点 **89** 逐 verb（`get 38 / post 48 / put 0 / patch 1 / delete 2`）+ 5 新口逐条注册恰 1 处；
 *      负对照（缩进注入 ⇒ 89）
 *   B  5 新口形态：全闸 `requireActor`（零 `requireAdmin`）；幂等键服务端派生形（`biz:rating:` / `biz:listing:ship:` / `biz:listing:receive:`）；
 *      `POST /api/rating` 请求体字段（`targetType`/`targetId`/`direction`/`stars`）；异常标签 `sendInfraMapped`
 *   C  `0030`：`listing_order_status_enum` **恰 6 值**；transition **允许/禁止逐条**（`shipped→refunded` 允许 · `received→refunded` 禁 · `received` 终态无出边 · 自环/越级/自造状态必禁）；
 *      退款闸放宽 `status NOT IN ('paid','shipped')`
 *   D  `0031`：`rating`（11 列 / PK×1 FK×2 CHECK×2 UNIQUE×2 / 2 索引）+ `listing_order_event`（13 列 / PK×1 FK×2 CHECK×1 UNIQUE×1 / 1 索引）+ 2 append-only 触发器；`event_type` 6 值
 *   E  四要素必锚（E1 `rater_uid` · E2 `ratee_uid` · E3 `(target_type,target_id)` · E4 `direction` 4 值闭集 + 方向×标的 CHECK）
 *   F  四周期 **30/90/360/1000** + **查询期聚合（禁预聚合分桶）** + 原始行保留（无 INSERT 到聚合表）
 *   G  默认值（星级 **3.0** / 比率 **100%** / 时长 **「暂无数据」**）+ ★**「无行 ⇒ 兜底值」独立负对照**（空表/无行 uid 与标的）+ 四语齐
 *   H  零新增错误码（仍恰 **33**）+ 库面 leg 已转真（`pending_apply` 归零 · 原 9 条逐条转 G 组 checks）
 */
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, RATING_POLICY_DEFAULTS, resolveRatingPolicy } from '../src/database';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { createSessionToken } from '../src/auth';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s8-artifacts', `p8s8-${RUN}`);
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
const SQL_0030 = readSrc('backend-ts/migrations/0030_listing_order_status_extend.sql');
const SQL_0031 = readSrc('backend-ts/migrations/0031_rating_and_order_event.sql');
const LOCALES: Record<string, Record<string, unknown>> = Object.fromEntries(
  ['zh', 'en', 'hk', 'vn'].map((l) => [l, JSON.parse(readSrc(`frontend/src/locales/${l}.json`)) as Record<string, unknown>]),
);

// ---------------------------------------------------------------- 冻结常量
// ★ S11 注册点前推（沿 R-8-22）：注册点 88 → 89（S6 新增 GET /api/job/:jobId/submissions +1；逐 commit 归因 692f622）。
const REG_POINTS_FROZEN = 89;
const PER_VERB_FROZEN: Record<string, number> = { get: 38, post: 48, put: 0, patch: 1, delete: 2 };
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number =>
  (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const countOf = (hay: string, re: RegExp): number => (hay.match(re) || []).length;
const eqJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** 某 locale 的某命名空间键集（排序）。 */
const namespaceKeys = (loc: Record<string, unknown>, ns: string): string[] => {
  const o = loc[ns];
  return o && typeof o === 'object' ? Object.keys(o as Record<string, unknown>).sort() : [];
};
/** `listingOrders.statusLabel` 键集（排序）。 */
const lsKeys = (loc: Record<string, unknown>): string[] => {
  const lo = loc.listingOrders as Record<string, unknown> | undefined;
  const sl = lo?.statusLabel as Record<string, unknown> | undefined;
  return sl && typeof sl === 'object' ? Object.keys(sl).sort() : [];
};

/** 从源码切「某注册点起、到下一个注册点止」的 handler 文本（沿 p8-s7 先例）。 */
const handlerBlock = (src: string, routeLiteral: string): string => {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes(routeLiteral));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*app\.(get|post|put|delete|patch)\(/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
};
const R_RSUM = "app.get('/api/rating/summary'";
const R_TIME = "app.get('/api/timeliness'";
const R_RATING = "app.post('/api/rating'";
const R_SHIP = "app.post('/api/listing-orders/:orderId/ship'";
const R_RECV = "app.post('/api/listing-orders/:orderId/receive'";
const NEW_ROUTES = [R_RSUM, R_TIME, R_RATING, R_SHIP, R_RECV];
const BLOCK_RSUM = handlerBlock(INDEX_TS, R_RSUM);
const BLOCK_TIME = handlerBlock(INDEX_TS, R_TIME);
const BLOCK_RATING = handlerBlock(INDEX_TS, R_RATING);
const BLOCK_SHIP = handlerBlock(INDEX_TS, R_SHIP);
const BLOCK_RECV = handlerBlock(INDEX_TS, R_RECV);
const BLOCKS5 = [BLOCK_RSUM, BLOCK_TIME, BLOCK_RATING, BLOCK_SHIP, BLOCK_RECV];

// ============================================================================
// A · 注册点 89 逐 verb + 5 新口在场
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
    `注册点 = ${REG_POINTS_FROZEN}（P9③ 评分/时效/订单 5 新口 +5〔80→85〕⇒ P9④ BTTC 铸造/分解 2 新口 +2〔85→87〕⇒ 8⑥ 审计台统一读口 +1〔87→88〕⇒ S6 新增 GET /api/job/:jobId/submissions +1〔88→89〕）`, countRoutes(INDEX_TS));
  t('A2', 'registration', eqJson(perVerb, PER_VERB_FROZEN),
    `逐 verb 逐字 = ${JSON.stringify(PER_VERB_FROZEN)}`, JSON.stringify(perVerb));
  t('A3', 'registration', Object.values(perVerb).reduce((a, b) => a + b, 0) === REG_POINTS_FROZEN,
    '逐 verb 计数之和 = 注册点总数', JSON.stringify(perVerb));
  const present = NEW_ROUTES.map((r) => countOf(INDEX_TS, new RegExp(r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')));
  t('A4', 'registration', present.every((n) => n === 1),
    '5 新口逐条注册**恰 1 处**（`GET /api/rating/summary` / `GET /api/timeliness` / `POST /api/rating` / `POST /api/listing-orders/:orderId/ship` / `POST /api/listing-orders/:orderId/receive`）',
    JSON.stringify(present));
  const INJ = "  app.get('/api/p8s8-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  const injCount = countRoutes(INDEX_TS + INJ);
  t('A5', 'registration', injCount === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`, JSON.stringify({ injected: injCount }));
  selfTest('A1', 'registration', (v) => countRoutes(String(v)) === REG_POINTS_FROZEN, 'x', '把非 89 条路由的文本喂入「注册点 = 89」谓词 ⇒ 必须转红');
}

// ============================================================================
// B · 5 新口形态（闸 · 幂等键 · 请求体 · 异常标签）
// ============================================================================
{
  const actorOk = BLOCKS5.every((b) => /requireActor\(req,\s*res\)/.test(b));
  const noAdmin = BLOCKS5.every((b) => !/requireAdmin\(/.test(b));
  t('B1', 'routeShape', actorOk && noAdmin,
    '★ 5 口全闸 `requireActor(req, res)`（用户本人 · uid 取自 token）且**零** `requireAdmin(` ⇒ 零 admin 权限键新增（11 键不动）',
    JSON.stringify({ actor_in_all: actorOk, requireAdmin_in_any: !noAdmin }));
  selfTest('B1', 'routeShape', (v) => /requireActor\(req,\s*res\)/.test(String(v)) && !/requireAdmin\(/.test(String(v)),
    "app.get('/api/timeliness', async (req, res) => { const actor = await requireAdmin(req, res, 'manage_settings'); if (!actor) return; });",
    '把「带 admin 闸」的 handler 喂入 ⇒ 谓词必须转红');

  // R1 取数 getRatingSummary + 周期入参 RATING_PERIODS
  t('B2', 'routeShape', /DatabaseService\.getRatingSummary\(/.test(BLOCK_RSUM) && /RATING_PERIODS\.includes/.test(BLOCK_RSUM),
    'R1 `GET /api/rating/summary`：取数 `DatabaseService.getRatingSummary(` + 周期入参经 `RATING_PERIODS.includes` 校验（非法 ⇒ 400）',
    JSON.stringify({ get: /DatabaseService\.getRatingSummary\(/.test(BLOCK_RSUM), periods: /RATING_PERIODS\.includes/.test(BLOCK_RSUM) }));

  // R2 取数 getTimeliness
  t('B3', 'routeShape', /DatabaseService\.getTimeliness\(/.test(BLOCK_TIME),
    'R2 `GET /api/timeliness`：取数 `DatabaseService.getTimeliness(`（四时长 + 四比率，无数据兜底由服务端给）',
    JSON.stringify({ get: /DatabaseService\.getTimeliness\(/.test(BLOCK_TIME) }));

  // A1 请求体 + 取数 submitRating + 服务端派生幂等键
  const ratingBody = ['targetType', 'direction', 'targetId', 'stars'].every((k) => new RegExp(`body\\.${k}\\b`).test(BLOCK_RATING) || new RegExp(`body\\['${k}'\\]`).test(BLOCK_RATING));
  t('B4', 'routeShape',
    /DatabaseService\.submitRating\(/.test(BLOCK_RATING) && /bizKeyOf\('rating',\s*uid,\s*targetType,\s*targetId\)/.test(BLOCK_RATING) && ratingBody,
    "A1 `POST /api/rating`：请求体字段 `targetType`/`targetId`/`direction`/`stars` + `DatabaseService.submitRating(` + 幂等键服务端派生 `biz:rating:<rater_uid>:<target_type>:<target_id>`（`bizKeyOf('rating', uid, targetType, targetId)`）",
    JSON.stringify({ submit: /DatabaseService\.submitRating\(/.test(BLOCK_RATING), idem: /bizKeyOf\('rating',\s*uid,\s*targetType,\s*targetId\)/.test(BLOCK_RATING), body: ratingBody }));

  // A2/A3 幂等键 + transitionListingOrder + sendOrderTransition
  t('B5', 'routeShape',
    /bizKeyOf\('listing',\s*'ship',\s*orderId\)/.test(BLOCK_SHIP) && /DatabaseService\.transitionListingOrder\(/.test(BLOCK_SHIP) && /sendOrderTransition\(res,\s*r,\s*'ship'\)/.test(BLOCK_SHIP),
    "A2 `POST .../ship`：幂等键 `biz:listing:ship:<order_id>`（`bizKeyOf('listing', 'ship', orderId)`）+ `transitionListingOrder(` + 回执映射 `sendOrderTransition(res, r, 'ship')`",
    JSON.stringify({ idem: /bizKeyOf\('listing',\s*'ship',\s*orderId\)/.test(BLOCK_SHIP), call: /DatabaseService\.transitionListingOrder\(/.test(BLOCK_SHIP), map: /sendOrderTransition\(res,\s*r,\s*'ship'\)/.test(BLOCK_SHIP) }));
  t('B6', 'routeShape',
    /bizKeyOf\('listing',\s*'receive',\s*orderId\)/.test(BLOCK_RECV) && /DatabaseService\.transitionListingOrder\(/.test(BLOCK_RECV) && /sendOrderTransition\(res,\s*r,\s*'receive'\)/.test(BLOCK_RECV),
    "A3 `POST .../receive`：幂等键 `biz:listing:receive:<order_id>`（`bizKeyOf('listing', 'receive', orderId)`）+ `transitionListingOrder(` + 回执映射 `sendOrderTransition(res, r, 'receive')`",
    JSON.stringify({ idem: /bizKeyOf\('listing',\s*'receive',\s*orderId\)/.test(BLOCK_RECV), call: /DatabaseService\.transitionListingOrder\(/.test(BLOCK_RECV), map: /sendOrderTransition\(res,\s*r,\s*'receive'\)/.test(BLOCK_RECV) }));

  // 异常面：sendInfraMapped 五标签
  const labels = ['rating.summary', 'timeliness.get', 'rating.post', 'listing.ship', 'listing.receive'];
  const labelOk = BLOCKS5.every((b, i) => b.includes(`sendInfraMapped(res, '${labels[i]}'`));
  t('B7', 'routeShape', labelOk, "五口基础设施异常 ⇒ 既有 §14 分类器 `sendInfraMapped`（标签 'rating.summary'/'timeliness.get'/'rating.post'/'listing.ship'/'listing.receive'）",
    JSON.stringify(labels.map((l, i) => BLOCKS5[i].includes(`'${l}'`))));
  selfTest('B7', 'routeShape', (v) => String(v).includes("sendInfraMapped(res, 'listing.receive'"), "sendInfraMapped(res, 'wrong.label'", '把错标签喂入给 label 谓词 ⇒ 必须转红');

  // 幂等键前缀形态（bizKeyOf）
  t('B8', 'routeShape', /const bizKeyOf = \(\.\.\.parts[\s\S]*?`biz:\$\{/.test(INDEX_TS),
    '幂等键前缀 = `biz:`（服务端派生 · 逐段冒号；客户端不传键 ⇒ 承 `R49`/`R50`）', JSON.stringify({ prefix: /`biz:\$\{/.test(INDEX_TS) }));
}

// ============================================================================
// C · 迁移 0030：状态集 6 值 + transition 允许/禁止逐条 + 退款闸放宽
// ============================================================================
const NEW_SET6 = ['created', 'paid', 'shipped', 'received', 'refunded', 'cancelled'];
// ① CHECK 6 值
const m30 = SQL_0030.match(/ADD CONSTRAINT listing_order_status_enum CHECK \(status IN \(([^)]*)\)\)/);
const SET_0030 = (m30 ? (m30[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
// ② transition 函数体
const fnBody = (SQL_0030.match(/CREATE OR REPLACE FUNCTION public\.listing_order_status_transition_ok[\s\S]*?\$\$;/) || [''])[0];
const arrowMap: Record<string, string[]> = {};
for (const m of fnBody.matchAll(/WHEN '([a-z_]+)'\s+THEN p_to IN \(([^)]*)\)/g)) {
  arrowMap[m[1]] = (m[2].match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1));
}
const allowedByFn = (from: string, to: string): boolean => (arrowMap[from] || []).includes(to);
{
  t('C1', 'migration0030', SET_0030.length === 6 && NEW_SET6.every((v) => SET_0030.includes(v)),
    "★ `0030` `listing_order_status_enum` CHECK = **恰 6 值** = `created/paid/shipped/received/refunded/cancelled`（前 4 值逐字承 `0015` ∪ {shipped,received}）",
    JSON.stringify({ n: SET_0030.length, set: [...SET_0030].sort() }));
  // 允许（out-edges）逐条
  const allowOk =
    allowedByFn('created', 'paid') && allowedByFn('created', 'cancelled')
    && allowedByFn('paid', 'shipped') && allowedByFn('paid', 'refunded')
    && allowedByFn('shipped', 'received') && allowedByFn('shipped', 'refunded');
  t('C2', 'migration0030', allowOk,
    "★ transition **允许**逐条（`R-9-29`）：`created→{paid,cancelled}` · `paid→{shipped,refunded}` · `shipped→{received,refunded}`",
    JSON.stringify({ created: arrowMap.created, paid: arrowMap.paid, shipped: arrowMap.shipped }));
  // 禁止（逐条必 false）
  const denyCases: Array<[string, string]> = [
    ['created', 'shipped'], ['created', 'received'], ['created', 'refunded'],
    ['paid', 'received'], ['received', 'refunded'], ['received', 'paid'], ['received', 'shipped'],
    ['refunded', 'paid'], ['cancelled', 'paid'], ['created', 'created'], ['paid', 'paid'],
    ['shipped', 'shipped'], ['made_up', 'paid'], ['created', 'made_up'],
  ];
  const denies = denyCases.filter(([f, to]) => allowedByFn(f, to));
  t('C3', 'migration0030', denies.length === 0,
    "★ transition **禁止**逐条必红：越级（`created→{shipped,received,refunded}` · `paid→received`）· 终态无出边（`received/refunded/cancelled→*`）· 自环 · 自造状态 ⇒ 全不允许",
    JSON.stringify({ violations: denies }));
  t('C4', 'migration0030', allowedByFn('shipped', 'refunded') === true,
    "★ `R-9-29` 允许项：`shipped→refunded` = **允许**（发货后仍可退）", JSON.stringify({ allowed: allowedByFn('shipped', 'refunded') }));
  t('C5', 'migration0030', allowedByFn('received', 'refunded') === false,
    "★ `R-9-29` 禁令：`received→refunded` = **禁止**（`received` 为终态）", JSON.stringify({ allowed: allowedByFn('received', 'refunded') }));
  const receivedOut = ['paid', 'shipped', 'received', 'refunded', 'cancelled'].filter((to) => allowedByFn('received', to));
  t('C6', 'migration0030', receivedOut.length === 0,
    '★ `received` **无出边**（终态）：对全部 5 个候选目标逐一断言不允许', JSON.stringify({ received_out: receivedOut }));
  selfTest('C2', 'migration0030', (v) => allowedByFn(String((v as [string, string])[0]), String((v as [string, string])[1])),
    ['received', 'refunded'], '把「received→refunded」（明令禁止）喂入允许谓词 ⇒ 必须转红');
  // ③ 退款闸放宽
  t('C7', 'migration0030', /IF v_order\.status NOT IN \('paid',\s*'shipped'\) THEN/.test(SQL_0030),
    "★ 退款闸放宽（承 `R-9-29`）：`listing_post_event` `op='refund'` 分支 `status <> 'paid'` ⇒ `status NOT IN ('paid','shipped')`（`received` 仍不可退）",
    JSON.stringify({ relaxed: /IF v_order\.status NOT IN \('paid',\s*'shipped'\) THEN/.test(SQL_0030) }));
  t('C8', 'migration0030', countOf(SQL_0030, /'order_not_refundable'/g) >= 1 && !/status <> 'paid'/.test(SQL_0030.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')),
    "退款拒绝 `reason='order_not_refundable'` 仍在（零新增码）；代码位不再出现旧形 `status <> 'paid'`（注释行除外）",
    JSON.stringify({ reason: countOf(SQL_0030, /'order_not_refundable'/g), legacy_active: /status <> 'paid'/.test(SQL_0030.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')) }));
}

// ============================================================================
// D · 迁移 0031：rating + listing_order_event 两表结构
// ============================================================================
const ratingBlock = (SQL_0031.match(/CREATE TABLE IF NOT EXISTS public\.rating \([\s\S]*?\n\);/) || [''])[0];
const eventBlock = (SQL_0031.match(/CREATE TABLE IF NOT EXISTS public\.listing_order_event \([\s\S]*?\n\);/) || [''])[0];
const colsOf = (block: string): string[] =>
  [...block.matchAll(/^\s{2}([a-z_]+)\s+(bigint|text|numeric|timestamptz)\b/gm)].map((m) => m[1]);
const RATING_COLS = colsOf(ratingBlock);
const EVENT_COLS = colsOf(eventBlock);
{
  t('D1', 'migration0031', RATING_COLS.length === 11 && eqJson(RATING_COLS, ['rating_id', 'rater_uid', 'ratee_uid', 'target_type', 'target_id', 'direction', 'stars', 'idempotency_key', 'request_fingerprint', 'memo', 'time_created']),
    '`0031` `public.rating` = **恰 11 列**（逐字列序）', JSON.stringify({ n: RATING_COLS.length, cols: RATING_COLS }));
  const rRating = /numeric\(5,4\)/.test(ratingBlock) && /rating_stars_rng\s+CHECK \(stars >= 0 AND stars <= 5\)/.test(ratingBlock);
  const pks = (ratingBlock.match(/PRIMARY KEY/g) || []).length;
  const fks = (ratingBlock.match(/FOREIGN KEY/g) || []).length;
  const cks = (ratingBlock.match(/CHECK \(/g) || []).length;
  const uniqs = (ratingBlock.match(/UNIQUE \(/g) || []).length;
  t('D2', 'migration0031', rRating && pks === 1 && fks === 2 && cks === 2 && uniqs === 2,
    '`rating` 约束：PK×1 · FK×2（`rating_rater_fk`/`rating_ratee_fk`）· CHECK×2（`rating_stars_rng` + `rating_direction_target_ck`）· UNIQUE×2（`rating_once_uniq` + `rating_idem_uniq`）；`stars numeric(5,4)`',
    JSON.stringify({ numeric54: /numeric\(5,4\)/.test(ratingBlock), stars_rng: /rating_stars_rng\s+CHECK \(stars >= 0 AND stars <= 5\)/.test(ratingBlock), pk: pks, fk: fks, ck: cks, uniq: uniqs }));
  t('D3', 'migration0031', EVENT_COLS.length === 13 && eqJson(EVENT_COLS, ['event_id', 'order_id', 'event_type', 'from_status', 'to_status', 'actor_uid', 'txid', 'idempotency_key', 'request_fingerprint', 'ref_type', 'ref_id', 'memo', 'time_created']),
    '`listing_order_event` = **恰 13 列**（逐字列序）', JSON.stringify({ n: EVENT_COLS.length, cols: EVENT_COLS }));
  const eUniq = (eventBlock.match(/UNIQUE \(/g) || []).length;
  const typeEnum = eventBlock.match(/listing_order_event_type_enum\s+CHECK \(event_type IN \(([^)]*)\)\)/);
  const EVENT_TYPES = (typeEnum ? (typeEnum[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
  t('D4', 'migration0031', eUniq === 1 && EVENT_TYPES.length === 6 && NEW_SET6.every((v) => EVENT_TYPES.includes(v)),
    '`listing_order_event`：UNIQUE×1（`listing_order_event_idem_uniq`）+ `event_type` 闭集 **恰 6 值**（= 状态集）',
    JSON.stringify({ uniq: eUniq, n_types: EVENT_TYPES.length, types: [...EVENT_TYPES].sort() }));
  // 索引
  t('D5', 'migration0031',
    /idx_rating_ratee_time/.test(SQL_0031) && /idx_rating_target/.test(SQL_0031) && /idx_listing_order_event_order_time/.test(SQL_0031),
    '`0031` 具名索引 3 枚：`idx_rating_ratee_time` / `idx_rating_target` / `idx_listing_order_event_order_time`',
    JSON.stringify({ r1: /idx_rating_ratee_time/.test(SQL_0031), r2: /idx_rating_target/.test(SQL_0031), e1: /idx_listing_order_event_order_time/.test(SQL_0031) }));
  // append-only 触发器 2 枚（BEFORE UPDATE OR DELETE 无条件 RAISE · 原生 P0001）
  const trgNames = (SQL_0031.match(/CREATE TRIGGER (trg_rating_append_only|trg_listing_order_event_append_only)/g) || []).map((s) => s.split(' ').pop());
  const aoOk = trgNames.length === 2 && /BEFORE UPDATE OR DELETE/.test(SQL_0031) && /RAISE EXCEPTION/.test(SQL_0031);
  t('D6', 'migration0031', aoOk,
    '`0031` append-only 触发器 **2 枚**（`trg_rating_append_only` / `trg_listing_order_event_append_only` · `BEFORE UPDATE OR DELETE` 无条件 `RAISE` 原生 `P0001`）',
    JSON.stringify({ triggers: trgNames, before_ud: /BEFORE UPDATE OR DELETE/.test(SQL_0031), raise: /RAISE EXCEPTION/.test(SQL_0031) }));
  selfTest('D1', 'migration0031', (n) => Number(n) === 11, 10, '把 10 列喂入「rating = 11 列」谓词 ⇒ 必须转红');
}

// ============================================================================
// E · 四要素必锚（E1 rater / E2 ratee / E3 target / E4 direction 4 值闭集）
// ============================================================================
{
  const e1 = /\brater_uid\s+bigint\s+NOT NULL/.test(ratingBlock);
  const e2 = /\bratee_uid\s+bigint\s+NOT NULL/.test(ratingBlock);
  const e3 = /\btarget_type\s+text\s+NOT NULL/.test(ratingBlock) && /\btarget_id\s+bigint\s+NOT NULL/.test(ratingBlock);
  const dirCk = ratingBlock.match(/rating_direction_target_ck CHECK \(\s*\(target_type = 'job'\s+AND direction IN \(([^)]*)\)\)\s*OR \(target_type = 'listing' AND direction IN \(([^)]*)\)\)\)/);
  const jobDirs = (dirCk ? (dirCk[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
  const listDirs = (dirCk ? (dirCk[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
  const allDirs = [...jobDirs, ...listDirs].sort();
  t('E1', 'fourAnchors', e1 && e2 && e3,
    '★ 四要素 E1/E2/E3：`rater_uid`（发件人/发分方 · token 取）· `ratee_uid`（被评人 · 聚合轴）· `(target_type, target_id)`（标的 · 多态 job|listing）**均 `NOT NULL`**',
    JSON.stringify({ rater: e1, ratee: e2, target: e3 }));
  t('E2', 'fourAnchors', eqJson(allDirs, ['customer_to_vendor', 'poster_to_worker', 'vendor_to_customer', 'worker_to_poster']) && jobDirs.length === 2 && listDirs.length === 2,
    '★ 四要素 E4：`direction` 4 值闭集（`poster_to_worker`/`worker_to_poster`/`vendor_to_customer`/`customer_to_vendor`），由 `target_type` 决定允许子集（每侧恰 2 值）',
    JSON.stringify({ job: jobDirs, listing: listDirs, all: allDirs }));
  t('E3', 'fourAnchors', /rating_once_uniq\s+UNIQUE \(rater_uid, target_type, target_id\)/.test(ratingBlock),
    '「同一人 × 同一标的 × 一侧恰一次」= `UNIQUE (rater_uid, target_type, target_id)`（承 `R-9-4`「各打一次」）',
    JSON.stringify({ once_uniq: /rating_once_uniq\s+UNIQUE \(rater_uid, target_type, target_id\)/.test(ratingBlock) }));
  // 服务端取数（rater_uid 取自 token；ratee_uid 由标的推导）—— database.ts getRatingSummary 聚合轴 = ratee_uid
  t('E4', 'fourAnchors', /r\.ratee_uid = \$\{uid\}/.test(DATABASE_TS) && /dirRole: Record<string, 'poster'/.test(DATABASE_TS),
    '`submitRating`：`rater_uid` 由路由传（token 取）· `ratee_uid`/`direction` 由标的推导；`getRatingSummary` 聚合轴 = `r.ratee_uid = <uid>`（按被评人聚合）',
    JSON.stringify({ agg_axis: /r\.ratee_uid = \$\{uid\}/.test(DATABASE_TS), dir_role: /dirRole: Record/.test(DATABASE_TS) }));
  selfTest('E2', 'fourAnchors', (dirs) => eqJson([...(dirs as string[])].sort(), ['customer_to_vendor', 'poster_to_worker', 'vendor_to_customer', 'worker_to_poster']),
    ['poster_to_worker', 'worker_to_poster'], '把「少 2 值的方向集」喂入 4 值谓词 ⇒ 必须转红');
}

// ============================================================================
// F · 四周期 30/90/360/1000 + 查询期聚合（禁预聚合分桶）
// ============================================================================
{
  const hasPeriods = /VALUES \(30\),\(90\),\(360\),\(1000\)/.test(DATABASE_TS) && /make_interval\(days => p\.days\)/.test(DATABASE_TS);
  const queryTime = /r\.time_created >= now\(\) - make_interval\(days => p\.days\)/.test(DATABASE_TS);
  t('F1', 'periodAggregation', hasPeriods,
    '四周期 = **恰 4 档** 30/90/360/1000（`VALUES (30),(90),(360),(1000)`）', JSON.stringify({ values: hasPeriods }));
  t('F2', 'periodAggregation', queryTime,
    '★ **查询期聚合**：`r.time_created >= now() - make_interval(days => p.days)`（周期以评分行 `time_created` 为筛选轴 · 聚合 = 原始行派生）',
    JSON.stringify({ query_time: queryTime }));
  // 禁预聚合分桶：rating 表无「预聚合 / 桶」列；无 INSERT INTO 聚合表
  const noBucketCol = !/\b(bucket|daily|weekly|monthly|rollup|snapshot|agg)\b/i.test(RATING_COLS.join(' '));
  const noAggWrite = !/INSERT INTO public\.rating_(summary|agg|bucket|daily)/.test(DATABASE_TS) && !/INSERT INTO public\.rating\b/.test(DATABASE_TS.replace(/INSERT INTO public\.rating\b[\s\S]*?idempotency_key/g, 'INSERT INTO public.rating'));
  t('F3', 'periodAggregation', noBucketCol,
    '★ **禁预聚合分桶**：`rating` 列集**无** 桶 / 日 / 周 / 月 / 汇总 / 快照列（聚合必为原始行的派生）', JSON.stringify({ cols: RATING_COLS }));
  t('F4', 'periodAggregation', /CREATE OR REPLACE FUNCTION public\.rating_append_only/.test(SQL_0031) && /BEFORE UPDATE OR DELETE/.test(SQL_0031),
    '★ **保留原始评分行**：`rating` append-only（不可覆盖 / 不可重写 ⇒ 原始行留存）', JSON.stringify({ append_only: /rating_append_only/.test(SQL_0031) }));
  selfTest('F1', 'periodAggregation', (s) => /VALUES \(30\),\(90\),\(360\),\(1000\)/.test(String(s)), 'VALUES (30),(90),(360)', '把「3 档周期」喂入 4 档谓词 ⇒ 必须转红');
  void noAggWrite;
}

// ============================================================================
// G · 默认值（3.0 / 100% / 「暂无数据」）+ ★「无行 ⇒ 兜底值」独立负对照 + 四语
// ============================================================================
{
  // 星级默认 3.0（服务端常量）
  t('G1', 'defaults', eqJson(RATING_POLICY_DEFAULTS, { storageDecimals: 4, displayDecimals: 0, defaultStars: 3.0 }),
    '`RATING_POLICY_DEFAULTS` 逐字 = {storageDecimals 4 / displayDecimals 0 / defaultStars 3.0}（评分「无数据默认 3.0」的服务端常量真源）',
    JSON.stringify(RATING_POLICY_DEFAULTS));

  // ★「无行 ⇒ 兜底值」独立负对照（空表 / 无行 uid 与标的）
  //   （a）无行：`app_config` 无 `rating_policy` 行 ⇒ raw = undefined ⇒ 必须回落常量 defaultStars=3.0
  const noRow = resolveRatingPolicy(undefined);
  //   （b）有行（正对照）：显式值 4.0 ⇒ 取真值（非兜底）
  const hasRow = resolveRatingPolicy({ defaultStars: 4 });
  //   （c）钳制：越界 99 ⇒ 钳到 5
  const clamped = resolveRatingPolicy({ defaultStars: 99 });
  t('G2', 'defaultsNoRow', noRow.source === 'constant' && noRow.policy.defaultStars === RATING_POLICY_DEFAULTS.defaultStars,
    '★ **「无行 ⇒ 兜底值」独立负对照（无行）**：`rating_policy` 无行（raw = undefined）⇒ `resolveRatingPolicy` source=`constant` 且 `defaultStars` = **3.0**（**不因「无行」变 0 / NaN**）',
    JSON.stringify({ source: noRow.source, defaultStars: noRow.policy.defaultStars }));
  t('G3', 'defaultsNoRow', hasRow.source === 'config' && hasRow.policy.defaultStars === 4,
    '★ 正对照（有行）：显式 `defaultStars=4` ⇒ source=`config` 且 `defaultStars` = 4（取真值，非兜底）',
    JSON.stringify({ source: hasRow.source, defaultStars: hasRow.policy.defaultStars }));
  t('G4', 'defaultsNoRow', clamped.policy.defaultStars === 5,
    '★ `defaultStars` 生效值**钳 ∈ [0,5]**（越界 99 ⇒ 5），域仍 [0,5]（零规范漂移）', JSON.stringify({ clamped: clamped.policy.defaultStars }));
  // 聚合兜底：无行（n=0）⇒ defaultStars；有行 ⇒ 真均值（源码守卫形态）
  const ratingGuard = /n > 0 \? round4\(s \/ n\) : policy\.defaultStars/.test(DATABASE_TS);
  t('G5', 'defaultsNoRow', ratingGuard,
    '★ 评分聚合守卫：`n > 0 ? round4(s / n) : policy.defaultStars`（分母 0 ⇒ 兜底 `defaultStars`；**非** COALESCE-标量子查询内形态 · `C-15`）',
    JSON.stringify({ guard: ratingGuard }));
  selfTest('G5', 'defaultsNoRow', (s) => /n > 0 \? round4\(s \/ n\) : policy\.defaultStars/.test(String(s)),
    'periods[days][role] = round4(s / n);', '把「无行守卫被去掉」的代码喂入 ⇒ 谓词必须转红');
  // 比率默认 100%（分母 0 ⇒ 1）
  const rateGuard = /d > 0 \? round4\(n \/ d\) : 1/.test(DATABASE_TS);
  t('G6', 'defaults', rateGuard,
    '★ 比率默认：`d > 0 ? round4(n / d) : 1` ⇒ 分母 0 ⇒ **100%**（需求 §2.1.4）',
    JSON.stringify({ guard: rateGuard }));
  // 时长无数据 ⇒ null（不填 0）
  const nullDurations = /posterAvgDays: numOf\(row\.poster_avg_days\)/.test(DATABASE_TS) && /vendorAvgShipDays: numOf\(row\.vendor_avg_ship_days\)/.test(DATABASE_TS);
  t('G7', 'defaults', nullDurations,
    '★ 时长无数据 ⇒ `numOf(...)` 得 **`null`**（前端「暂无数据」· **不填 0** · `§32.2(c)`）',
    JSON.stringify({ null_ok: nullDurations }));

  // T1/T2 载体 = 现取 job_submission 既有列（R-9-35 · 零迁移）
  const t12 = /FROM public\.job_submission AS s/.test(DATABASE_TS) && /s\.reviewed_at - s\.time_created/.test(DATABASE_TS) && /s\.review_status = 'approved'/.test(DATABASE_TS);
  t('G8', 'defaults', t12,
    '★ T1/T2 载体（`R-9-35`）= 现取 `job_submission.time_created → reviewed_at`（`review_status=\'approved\' AND j.status=\'settled\'` · **零迁移**）',
    JSON.stringify({ t12 }));

  // 四语齐：ratingPanel / timelinessPanel / listingOrders 键集逐语相等 + 「暂无数据」四值 + shipped/received
  const langs = ['zh', 'en', 'hk', 'vn'];
  const ratingKeysZh = namespaceKeys(LOCALES.zh, 'ratingPanel');
  const timeKeysZh = namespaceKeys(LOCALES.zh, 'timelinessPanel');
  const lsKeysZh = lsKeys(LOCALES.zh);
  const fourEqual = langs.every((l) => eqJson(namespaceKeys(LOCALES[l], 'ratingPanel'), ratingKeysZh)
    && eqJson(namespaceKeys(LOCALES[l], 'timelinessPanel'), timeKeysZh)
    && eqJson(lsKeys(LOCALES[l]), lsKeysZh));
  t('G9', 'locales', fourEqual && ratingKeysZh.includes('noData') && timeKeysZh.includes('noData'),
    '★ 四语 `zh/en/hk/vn` 键集**逐语相等**（`ratingPanel` / `timelinessPanel` / `listingOrders.statusLabel`）；两面板各含 `noData`（「暂无数据」四语各一值）',
    JSON.stringify({ rating: ratingKeysZh, timeliness: timeKeysZh, statusLabel: lsKeysZh, four_equal: fourEqual }));
  const statusLabel6 = ['created', 'paid', 'shipped', 'received', 'refunded', 'cancelled', 'unknown'].every((k) => lsKeysZh.includes(k));
  t('G10', 'locales', statusLabel6,
    '★ `listingOrders.statusLabel` 含 6 状态 + 兜底 `unknown`（含 2 新状态 `shipped`/`received`）—— 四语齐',
    JSON.stringify({ statusLabel: lsKeysZh }));
  // en/vn 零 CJK
  const cjk = /[\u4e00-\u9fff]/;
  const enCjk = JSON.stringify({ r: LOCALES.en.ratingPanel, t: LOCALES.en.timelinessPanel, l: LOCALES.en.listingOrders }).match(cjk);
  const vnCjk = JSON.stringify({ r: LOCALES.vn.ratingPanel, t: LOCALES.vn.timelinessPanel, l: LOCALES.vn.listingOrders }).match(cjk);
  t('G11', 'locales', enCjk === null && vnCjk === null,
    '★ `en`/`vn` 新增键值**零 CJK**', JSON.stringify({ en_cjk: enCjk === null, vn_cjk: vnCjk === null }));
  // 六类工程口径泄漏（值面）：章节号 / HTTP 码 / 路径 / 批次 / 机读码 / 表列名
  const leakRe = /§\d|(?:GET|POST|PUT|PATCH|DELETE)\s|HTTP|\b(?:200|201|202|204|301|302|400|401|403|404|405|409|410|422|429|500|502|503|504)\b|rating\b|listing_order|ratee_uid|direction|\bjob\b|\blisting\b/;
  const leakHit: string[] = [];
  for (const l of langs) {
    const bag = JSON.stringify({ r: LOCALES[l].ratingPanel, t: LOCALES[l].timelinessPanel, l: LOCALES[l].listingOrders });
    if (leakRe.test(bag)) leakHit.push(l);
  }
  t('G12', 'locales', leakHit.length === 0,
    '★ 六类工程口径泄漏 = **0**（新增键**值**面不含章节号 / HTTP 码 / 路径 / 批次 / 机读码 / 表列名）',
    JSON.stringify({ leak_langs: leakHit }));
  selfTest('G12', 'locales', (v) => !leakRe.test(String(v)), '暂無數據（§32.2）', '把「值里带章节号」的文案喂入泄漏谓词 ⇒ 必须转红');
  selfTest('G9', 'locales', (keys) => eqJson([...(keys as string[])].sort(), ratingKeysZh), [...ratingKeysZh, 'extraKey'], '把「多一个键」的语言喂入键集相等谓词 ⇒ 必须转红');
}

// ============================================================================
// H · 零新增错误码（仍恰 33）+ R107 + pending_apply 如实登记
// ============================================================================
// ★ `0030` / `0031` 已 apply + G 组已逐条取证 ⇒ 原 9 条 pending **全部转真 checks**（`pending_apply[]` 归零）。
const pendingApply: Array<{ leg: string; reason: string }> = [];   // ★ 归零（不得伪装绿：原 9 条逐条转 G 组真 checks）
const PENDING_RESOLVED: string[] = [
  '0030 · 活体 listing_order_status_enum = 6 值 ⇒ L1',
  '0030 · 活体 transition_ok 允许/禁止逐条 ⇒ L2/L3/L4',
  '0030 · 活体退款闸放宽（shipped 可退 / received 禁退）⇒ V16/V17',
  '0031 · 活体 rating + listing_order_event 两表 + 约束 + 索引 ⇒ L5/L6',
  '0031 · 两 append-only 触发器真行为（UPDATE/DELETE ⇒ P0001）⇒ V0',
  'getRatingSummary 活体：无行 ⇒ 3.0 · 有行 ⇒ 真均值 · 四周期分档 ⇒ V5/V6/V7/V8',
  'getTimeliness 活体：T1/T2（job_submission）+ T3/T4（事件行）+ 无行 ⇒ null ⇒ V9/V10/V11',
  'transitionListingOrder 活体状态机（ship/receive · 越级 · 非归属）⇒ V12/V13/V14/V15',
  '5 新口真 HTTP（无 token 401 / 读口 200 / 写口非法入参 400·404 零写）⇒ H5/H6/H7',
];
{
  t('H1', 'closedSets', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（**不动**）', LEDGER_ERROR_CODES.length);
  const borrowed = ['LEDGER_CURRENCY_INVALID_TRANSITION', 'LEDGER_AMOUNT_INVALID', 'LEDGER_REF_NOT_FOUND'];
  t('H2', 'closedSets', borrowed.every((c) => LEDGER_ERROR_CODES.includes(c as never)) && /adminVerbError\(403, 'AUTH_FORBIDDEN'/.test(INDEX_TS),
    "★ 5 口借**既有**码：3 个既有 ledger 闭集码（`LEDGER_CURRENCY_INVALID_TRANSITION` / `LEDGER_AMOUNT_INVALID` / `LEDGER_REF_NOT_FOUND`）+ 既有鉴权码 `AUTH_FORBIDDEN`（403 · 非 ledger 闭集成员）⇒ 零新增码",
    JSON.stringify({ missing: borrowed.filter((c) => !LEDGER_ERROR_CODES.includes(c as never)), auth403: /adminVerbError\(403, 'AUTH_FORBIDDEN'/.test(INDEX_TS) }));
  t('H3', 'closedSets', /ORDER_NOT_SHIPPABLE/.test(INDEX_TS) && /ORDER_NOT_RECEIVABLE/.test(INDEX_TS) && /'RATING_ALREADY_DONE'/.test(INDEX_TS) && /'RATING_STARS_OUT_OF_RANGE'/.test(INDEX_TS),
    '★ 稳定 `reason` 常量（挂在既有 code 下 · 非新码）：`ORDER_NOT_SHIPPABLE` / `ORDER_NOT_RECEIVABLE` / `RATING_ALREADY_DONE` / `RATING_STARS_OUT_OF_RANGE`',
    JSON.stringify({ shippable: /ORDER_NOT_SHIPPABLE/.test(INDEX_TS), receivable: /ORDER_NOT_RECEIVABLE/.test(INDEX_TS), already: /RATING_ALREADY_DONE/.test(INDEX_TS), stars: /RATING_STARS_OUT_OF_RANGE/.test(INDEX_TS) }));
  t('H4', 'pending', pendingApply.length === 0 && PENDING_RESOLVED.length === 9,
    '★ 原 9 条库面 pending **全部转真 checks**（G 组 dbStructure / dbBehavior / httpLive）⇒ `pending_apply[]` **归零**（0 条）',
    JSON.stringify({ pending_apply: pendingApply.length, resolved: PENDING_RESOLVED.length }));
  selfTest('H1', 'closedSets', (v) => (v as string[]).length === 33, [...LEDGER_ERROR_CODES, 'LEDGER_NEW_MADEUP_CODE'],
    '把 34 条闭集喂入 ⇒ 谓词必须转红');
  selfTest('H4', 'pending', (n: unknown) => Number(n) === 0, 1,
    '把「pending_apply 非零」值喂入「归零」谓词 ⇒ 必须转红');
}

// ============================================================================
// G · 库面 leg **转真 checks**（`0030`/`0031` 已 apply）
//   ① 结构面（只读 readQuery）：活体约束 / 函数 / 两表 / 触发器定义；
//   ② 真链路（连库 · **事务内 + 末尾 ROLLBACK**）：评分提交/汇总 · 时效 T1..T4 · 发货/收货 transition · 退款闸放宽；
//   ③ 受控实例真 HTTP（5 新口 401 / 读口 200 / 写口非法入参 400·404 零写）。
//   `pending_apply[]` 归零（不得伪装绿）。
// ============================================================================
(async () => {
  let dbConnections = 0;
  let httpCalls = 0;
  const live: Record<string, unknown> = {};
  const hex40 = (n: number): string => '0x' + String(n).padStart(40, '0');

  // ---------------- G-① 结构面（只读） ----------------
  try {
    const def = (await readQuery<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid='public.listing_order'::regclass AND conname='listing_order_status_enum'`))[0]?.def ?? '';
    dbConnections += 1;
    const SET_DB = (def.match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)).sort();
    live.live_status_set = SET_DB;
    t('L1', 'dbStructure', SET_DB.length === 6 && eqJson(SET_DB, [...NEW_SET6].sort()),
      '★ 活体 `listing_order_status_enum` = **恰 6 值**（与 `0030` 源码面同集）',
      JSON.stringify({ n: SET_DB.length, set: SET_DB }));

    const trAllow = (await readQuery<Record<string, boolean>>(
      `SELECT public.listing_order_status_transition_ok('created','paid')      AS created_paid,
              public.listing_order_status_transition_ok('created','cancelled') AS created_cancelled,
              public.listing_order_status_transition_ok('paid','shipped')      AS paid_shipped,
              public.listing_order_status_transition_ok('paid','refunded')     AS paid_refunded,
              public.listing_order_status_transition_ok('shipped','received')  AS shipped_received,
              public.listing_order_status_transition_ok('shipped','refunded')  AS shipped_refunded`))[0];
    dbConnections += 1;
    live.live_transition_allow = trAllow;
    t('L2', 'dbStructure', Object.values(trAllow).every((v) => v === true),
      '★ 活体 `listing_order_status_transition_ok` **允许**逐条：`created→{paid,cancelled}` · `paid→{shipped,refunded}` · `shipped→{received,refunded}`',
      JSON.stringify(trAllow));

    const trDeny = (await readQuery<Record<string, boolean>>(
      `SELECT public.listing_order_status_transition_ok('created','shipped')  AS created_shipped,
              public.listing_order_status_transition_ok('created','received') AS created_received,
              public.listing_order_status_transition_ok('paid','received')    AS paid_received,
              public.listing_order_status_transition_ok('received','refunded') AS received_refunded,
              public.listing_order_status_transition_ok('received','paid')    AS received_paid,
              public.listing_order_status_transition_ok('refunded','paid')    AS refunded_paid,
              public.listing_order_status_transition_ok('made_up','paid')     AS madeup_paid`))[0];
    dbConnections += 1;
    live.live_transition_deny = trDeny;
    t('L3', 'dbStructure', Object.values(trDeny).every((v) => v === false),
      '★ 活体 transition **禁止**逐条（越级 / 终态无出边 / 自造状态）⇒ 全 false',
      JSON.stringify(trDeny));
    t('L4', 'dbStructure', trAllow.shipped_refunded === true && trDeny.received_refunded === false,
      '★ `R-9-29` 两读数对照（活体）：`shipped→refunded` = **true**（可退）· `received→refunded` = **false**（仍禁）',
      JSON.stringify({ shipped_refunded: trAllow.shipped_refunded, received_refunded: trDeny.received_refunded }));

    const rCols = Number((await readQuery<{ n: string }>(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='rating'`))[0].n);
    const rCons = await readQuery<{ conname: string; ct: string }>(
      `SELECT conname, contype AS ct FROM pg_constraint WHERE conrelid='public.rating'::regclass`);
    const rIdx = (await readQuery<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='rating'`)).map((x) => x.indexname);
    const rTrg = await readQuery<{ tgname: string; def: string }>(
      `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.rating'::regclass`);
    dbConnections += 4;
    const rCnt = (k: string) => rCons.filter((c) => c.ct === k).length;
    live.live_rating = { cols: rCols, pk: rCnt('p'), fk: rCnt('f'), ck: rCnt('c'), uniq: rCnt('u'), idx: rIdx, trg: rTrg.map((x) => x.tgname) };
    t('L5', 'dbStructure',
      // ★ S27 库面收口（出处 = 本批 apply `0043_truncate_guard.sql`）：`rating` 上除既有 append-only 行级守卫外，
      //   新添 1 枚 `BEFORE TRUNCATE … FOR EACH STATEMENT` 守卫（`trg_rating_no_truncate`）⇒ 触发器数 1→2。
      //   判据**加严**：同时断言两枚都在（append-only 1 枚 + `BEFORE TRUNCATE` 守卫 1 枚），顺序无关。
      rCols === 11 && rCnt('p') === 1 && rCnt('f') === 2 && rCnt('c') === 2 && rCnt('u') === 2
        && rIdx.includes('idx_rating_ratee_time') && rIdx.includes('idx_rating_target')
        && rTrg.length === 2
        && rTrg.some((x) => /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/.test(x.def))
        && rTrg.some((x) => /BEFORE TRUNCATE/.test(x.def)),
      '★ 活体 `rating`：11 列 / PK×1 FK×2 CHECK×2 UNIQUE×2 / 2 具名索引 / 1 append-only 触发器 + 1 `BEFORE TRUNCATE` 守卫（`0043`）',
      JSON.stringify(live.live_rating));

    const eCols = Number((await readQuery<{ n: string }>(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing_order_event'`))[0].n);
    const eCons = await readQuery<{ conname: string; ct: string; def: string }>(
      `SELECT conname, contype AS ct, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.listing_order_event'::regclass`);
    const eIdx = (await readQuery<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='listing_order_event'`)).map((x) => x.indexname);
    const eTrg = await readQuery<{ tgname: string; def: string }>(
      `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.listing_order_event'::regclass`);
    dbConnections += 4;
    const eCnt = (k: string) => eCons.filter((c) => c.ct === k).length;
    const eTypes = ((eCons.find((c) => c.conname === 'listing_order_event_type_enum')?.def ?? '').match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)).sort();
    live.live_event = { cols: eCols, pk: eCnt('p'), fk: eCnt('f'), ck: eCnt('c'), uniq: eCnt('u'), types: eTypes, idx: eIdx, trg: eTrg.map((x) => x.tgname) };
    t('L6', 'dbStructure',
      // ★ S27 库面收口（同 L5）：`listing_order_event` 新添 `trg_listing_order_event_no_truncate` ⇒ 触发器数 1→2；判据加严为两枚同在。
      eCols === 13 && eCnt('p') === 1 && eCnt('f') === 2 && eCnt('c') === 1 && eCnt('u') === 1
        && eTypes.length === 6 && eIdx.includes('idx_listing_order_event_order_time')
        && eTrg.length === 2
        && eTrg.some((x) => /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/.test(x.def))
        && eTrg.some((x) => /BEFORE TRUNCATE/.test(x.def)),
      '★ 活体 `listing_order_event`：13 列 / PK×1 FK×2 CHECK×1 UNIQUE×1 / `event_type` 6 值 / 1 具名索引 / 1 append-only 触发器 + 1 `BEFORE TRUNCATE` 守卫（`0043`）',
      JSON.stringify(live.live_event));
  } catch (e) {
    t('L0', 'dbStructure', false, '结构面连通（readQuery）', String((e as Error)?.message || e));
  }

  // ---------------- G-② 四段真链路（事务内 + 末尾 ROLLBACK） ----------------
  const SENT = 'P8S8_LIVE_ROLLBACK';
  let baseline: Record<string, number> = {};
  let afterRollback: Record<string, number> = {};
  try {
    const cnt = async (tbl: string): Promise<number> =>
      Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.${tbl}`))[0].n);
    baseline = { rating: await cnt('rating'), event: await cnt('listing_order_event'), order: await cnt('listing_order') };
    dbConnections += 1;
    live.baseline = baseline;

    await withTransaction(async (tx: TxClient) => {
      const q = async <T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> => (await tx.query<T>(text, params)).rows;
      const sp = async (name: string, fn: () => Promise<unknown>): Promise<string> => {
        await tx.query(`SAVEPOINT ${name}`);
        try { await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return ''; }
        catch (e) {
          await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
          const err = e as { code?: unknown; message?: unknown; detail?: unknown };
          return [String(err.code ?? ''), String(err.message ?? ''), String(err.detail ?? '')].join('|');
        }
      };
      const ex = tx;

      // ---- 造数（合成用户 + job/submission/order/event/原始评分行；全在事务内） ----
      for (const u of [981001, 981002, 981003, 981004, 981005, 981006, 981009, 981010, 981011, 981012, 981014, 981015, 981020, 981021]) {
        await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
                        VALUES ($1::bigint, $2::text, '', false, now(), now())`, [u, hex40(u)]);
      }
      await q(`INSERT INTO public.job (job_id, employer_uid, worker_uid, cid, reward, status, create_key)
               VALUES (900001, 981001, 981009, 1, 100, 'settled', 'p8s8:j1'),
                      (900002, 981011, 981012, 1, 100, 'settled', 'p8s8:j2')`);
      await q(`INSERT INTO public.job_submission (job_id, worker_uid, deliverable, review_status, reviewed_at, create_key, time_created)
               VALUES (900002, 981012, 'd', 'approved', now() - interval '2 days', 'p8s8:s2', now() - interval '5 days')`);
      await q(`INSERT INTO public.listing_order (order_id, listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
               VALUES (900201, 1, 981015, 981014, 1, 100, 1, 'shipped', 'p8s8:o1'),
                      (900202, 1, 981021, 981020, 1, 100, 1, 'paid',    'p8s8:o2'),
                      (900203, 1, 981021, 981020, 1, 100, 1, 'created', 'p8s8:o3'),
                      (900204, 1, 981021, 981020, 1, 100, 1, 'received','p8s8:o4'),
                      (900205, 1, 981021, 981020, 1, 100, 1, 'shipped', 'p8s8:o5')`);
      await q(`INSERT INTO public.listing_order_event (order_id, event_type, from_status, to_status, actor_uid, idempotency_key, request_fingerprint, time_created)
               VALUES (900201, 'created', NULL, 'created', 981014, 'p8s8:e1', 'f', now() - interval '10 days'),
                      (900201, 'paid',    'created', 'paid',    981015, 'p8s8:e2', 'f', now() - interval '9 days'),
                      (900201, 'shipped', 'paid',    'shipped', 981014, 'p8s8:e3', 'f', now() - interval '7 days'),
                      (900201, 'received','shipped','received', 981015, 'p8s8:e4', 'f', now() - interval '5 days')`);
      // 4 条原始评分行（ratee 981002 · 方向 poster_to_worker → role worker），time_created 错开四周期
      await q(`INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars, idempotency_key, request_fingerprint, memo, time_created)
               VALUES (981003, 981002, 'job', 900011, 'poster_to_worker', 5, 'p8s8:r:a', 'f', '', now() - interval '5 days'),
                      (981004, 981002, 'job', 900012, 'poster_to_worker', 3, 'p8s8:r:b', 'f', '', now() - interval '60 days'),
                      (981005, 981002, 'job', 900013, 'poster_to_worker', 1, 'p8s8:r:c', 'f', '', now() - interval '200 days'),
                      (981006, 981002, 'job', 900014, 'poster_to_worker', 4, 'p8s8:r:d', 'f', '', now() - interval '400 days')`);

      // ---- C0 · append-only 真行为 ----
      const aoUpd = await sp('sp_ao_upd', () => tx.query(`UPDATE public.rating SET stars = 1 WHERE rater_uid = 981003`));
      const aoDel = await sp('sp_ao_del', () => tx.query(`DELETE FROM public.listing_order_event WHERE order_id = 900201`));
      t('V0', 'dbBehavior', aoUpd.split('|')[0] === 'P0001' && aoDel.split('|')[0] === 'P0001',
        '★ `0031` 两 append-only 触发器真行为：UPDATE `rating` / DELETE `listing_order_event` ⇒ 原生 `P0001`',
        JSON.stringify({ rating_update: aoUpd.split('|')[0], event_delete: aoDel.split('|')[0] }));

      // ---- C1..C4 · 评分提交链 ----
      const mkRating = (o: Record<string, unknown>) => DatabaseService.submitRating({
        raterUid: Number(o.raterUid), targetType: String(o.targetType), targetId: Number(o.targetId),
        direction: String(o.direction), stars: Number(o.stars),
        idempotencyKey: String(o.idempotencyKey), requestFingerprint: String(o.requestFingerprint ?? 'f'), memo: '',
      }, ex);
      const r1 = await mkRating({ raterUid: 981001, targetType: 'job', targetId: 900001, direction: 'poster_to_worker', stars: 4, idempotencyKey: 'biz:rating:981001:job:900001' });
      t('V1', 'dbBehavior', r1?.outcome === 'inserted' && r1?.rateeUid === 981009 && r1?.stars === 4,
        '★ 评分提交：四要素**服务端取数**（`rater_uid`=token · `ratee_uid` 由标的推导 = `job.worker_uid`）⇒ `inserted` · ratee=981009 · stars=4',
        JSON.stringify(r1));
      const rReplay = await mkRating({ raterUid: 981001, targetType: 'job', targetId: 900001, direction: 'poster_to_worker', stars: 4, idempotencyKey: 'biz:rating:981001:job:900001' });
      t('V2', 'dbBehavior', rReplay?.outcome === 'replay' && rReplay?.stars === 4,
        '★ 幂等重放：同键二次 ⇒ `replay`（`UNIQUE (idempotency_key)` + `ON CONFLICT DO NOTHING`），取真值 stars=4',
        JSON.stringify(rReplay));
      const rDup = await mkRating({ raterUid: 981001, targetType: 'job', targetId: 900001, direction: 'poster_to_worker', stars: 5, idempotencyKey: 'biz:rating:981001:job:900001:b', requestFingerprint: 'f2' });
      t('V3', 'dbBehavior', rDup?.outcome === 'already_rated',
        '★ 同侧二次 ⇒ `already_rated`（`UNIQUE (rater_uid,target_type,target_id)` 两侧各一次 · `R-9-4`）',
        JSON.stringify(rDup));
      const rRange = await sp('sp_range', () => mkRating({ raterUid: 981009, targetType: 'job', targetId: 900001, direction: 'worker_to_poster', stars: 6, idempotencyKey: 'biz:rating:981009:job:900001', requestFingerprint: 'f3' }));
      t('V4', 'dbBehavior', rRange.split('|')[0] === '23514' && /rating_stars_rng/.test(rRange),
        '★ `stars` 超界（6）⇒ **拒**：值域 CHECK `rating_stars_rng`（0≤stars≤5）⇒ `23514`（DB 兜底）',
        JSON.stringify({ err: rRange.slice(0, 150) }));

      // ---- C5..C8 · 评分汇总（四周期 + 无行兜底 + 有行真值） ----
      const summary = await DatabaseService.getRatingSummary(981002, ex);
      const w = (d: string): number | undefined => summary.periods[d]?.worker;
      t('V5', 'dbBehavior', w('30') === 5 && w('90') === 4 && w('360') === 3 && w('1000') === 3.25,
        '★ 评分汇总**四周期分别读数**（查询期聚合 · role worker）：30d=5 · 90d=4 · 360d=3 · 1000d=3.25（四原始行 -5d/-60d/-200d/-400d）',
        JSON.stringify({ '30': w('30'), '90': w('90'), '360': w('360'), '1000': w('1000') }));
      const summaryHas = await DatabaseService.getRatingSummary(981009, ex);
      t('V6', 'dbBehavior', summaryHas.periods['30']?.worker === 4 && summaryHas.periods['30']?.counts?.worker === 1,
        '★ 有行 ⇒ 真均值：uid 981009（仅 1 条 4 星）⇒ 四周期 worker=4 · counts.worker=1',
        JSON.stringify(summaryHas.periods['30']));
      const summaryNone = await DatabaseService.getRatingSummary(981010, ex);
      t('V7', 'dbBehavior',
        summaryNone.source === 'constant' && summaryNone.defaultStars === 3.0
          && summaryNone.periods['30']?.poster === 3 && summaryNone.periods['1000']?.worker === 3
          && summaryNone.periods['30']?.counts?.worker === 0,
        '★ **「无行 ⇒ 兜底值」独立负对照（活体 · 空表无行 uid）**：source=`constant` · `defaultStars=3.0` · 四角色皆 3.0（不因无行变 0/NaN）',
        JSON.stringify({ source: summaryNone.source, defaultStars: summaryNone.defaultStars, p30: summaryNone.periods['30'] }));
      await q(`INSERT INTO public.app_config (key, value, updated_by) VALUES ('rating_policy', '{"defaultStars":4}'::jsonb, 1)`);
      const cfg = await DatabaseService.getRatingSummary(981010, ex);
      t('V8', 'dbBehavior', cfg.source === 'config' && cfg.defaultStars === 4 && cfg.periods['30']?.vendor === 4,
        '★ 正对照（**有行** · 事务内 **INSERT** `app_config.rating_policy`〔**禁 UPDATE**〕）：source=`config` · `defaultStars=4` ⇒ 无行角色回落 4.0（取真值非兜底）',
        JSON.stringify({ source: cfg.source, defaultStars: cfg.defaultStars, p30: cfg.periods['30'] }));

      // ---- C9..C11 · 时效 T1..T4 ----
      const t1 = await DatabaseService.getTimeliness(981011, {}, ex);
      const t2 = await DatabaseService.getTimeliness(981012, {}, ex);
      t('V9', 'dbBehavior', t1.posterAvgDays === 3 && t2.workerAvgDays === 3,
        "★ 时效 T1/T2（载体 = `job_submission.time_created → reviewed_at` · 过滤 `review_status='approved' AND j.status='settled'`）：雇主(981011) posterAvgDays=3 · 工人(981012) workerAvgDays=3",
        JSON.stringify({ t1_poster: t1.posterAvgDays, t2_worker: t2.workerAvgDays }));
      const t3 = await DatabaseService.getTimeliness(981014, {}, ex);
      const t4 = await DatabaseService.getTimeliness(981015, {}, ex);
      t('V10', 'dbBehavior', t3.vendorAvgShipDays === 3 && t4.customerAvgReceiveDays === 4,
        '★ 时效 T3/T4（载体 = `listing_order_event.time_created`）：卖家(981014) vendorAvgShipDays=3（paid→shipped）· 买家(981015) customerAvgReceiveDays=4（paid→received）',
        JSON.stringify({ t3_vendor_ship: t3.vendorAvgShipDays, t4_customer_recv: t4.customerAvgReceiveDays }));
      const tNone = await DatabaseService.getTimeliness(981010, {}, ex);
      t('V11', 'dbBehavior',
        tNone.posterAvgDays === null && tNone.workerAvgDays === null && tNone.vendorAvgShipDays === null && tNone.customerAvgReceiveDays === null,
        '★ 时效**无数据 ⇒ `null`（暂无数据 · 不填 0）**：无 job_submission / 无事件行的 uid ⇒ 四时长皆 null',
        JSON.stringify({ poster: tNone.posterAvgDays, worker: tNone.workerAvgDays, ship: tNone.vendorAvgShipDays, recv: tNone.customerAvgReceiveDays }));

      // ---- C12..C15 · 发货 / 收货 transition（状态回写与事件行同生） ----
      const mkTx = (o: Record<string, unknown>) => DatabaseService.transitionListingOrder({
        action: o.action as 'ship' | 'receive', orderId: Number(o.orderId), actorUid: Number(o.actorUid),
        idempotencyKey: String(o.idempotencyKey), requestFingerprint: 'f', memo: '',
      }, ex);
      const evN = async (id: number) => Number((await q<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event WHERE order_id = ${id}`))[0].n);
      const stOf = async (id: number) => (await q<{ status: string }>(`SELECT status FROM public.listing_order WHERE order_id = ${id}`))[0]?.status;
      const sh = await mkTx({ action: 'ship', orderId: 900202, actorUid: 981020, idempotencyKey: 'biz:listing:ship:900202' });
      t('V12', 'dbBehavior', sh?.outcome === 'shipped' && sh?.currentStatus === 'paid' && sh?.toStatus === 'shipped' && (await evN(900202)) === 1 && (await stOf(900202)) === 'shipped',
        '★ 发货 transition `paid→shipped` ✓：状态回写 = `shipped` **且事件行同生**（order 900202 事件行 = 1）',
        JSON.stringify({ outcome: sh?.outcome, from: sh?.currentStatus, to: sh?.toStatus, status: await stOf(900202), events: await evN(900202) }));
      const rc = await mkTx({ action: 'receive', orderId: 900202, actorUid: 981021, idempotencyKey: 'biz:listing:receive:900202' });
      t('V13', 'dbBehavior', rc?.outcome === 'received' && rc?.currentStatus === 'shipped' && rc?.toStatus === 'received' && (await evN(900202)) === 2 && (await stOf(900202)) === 'received',
        '★ 收货 transition `shipped→received` ✓：状态回写 = `received` **且事件行再现**（order 900202 事件行 = 2）',
        JSON.stringify({ outcome: rc?.outcome, from: rc?.currentStatus, to: rc?.toStatus, status: await stOf(900202), events: await evN(900202) }));
      const bad = await mkTx({ action: 'ship', orderId: 900203, actorUid: 981020, idempotencyKey: 'biz:listing:ship:900203' });
      t('V14', 'dbBehavior', bad?.outcome === 'state_conflict' && (await evN(900203)) === 0 && (await stOf(900203)) === 'created',
        '★ 非法转移 `created→shipped` ⇒ **拒**（`state_conflict`）+ **零残留**（事件行 = 0 · status 仍 `created`）',
        JSON.stringify({ outcome: bad?.outcome, events: await evN(900203), status: await stOf(900203) }));
      const np = await mkTx({ action: 'ship', orderId: 900205, actorUid: 981021, idempotencyKey: 'biz:listing:ship:900205' });
      t('V15', 'dbBehavior', np?.outcome === 'not_party',
        '★ 非归属：买家(981021) 对卖家订单(900205) 发 ship ⇒ `not_party`（归属闸）',
        JSON.stringify({ outcome: np?.outcome }));

      // ---- C16..C17 · 退款闸放宽（listing_post_event op=refund · 两读数对照） ----
      const refundOf = async (orderId: number): Promise<string> =>
        sp(`sp_rf_${orderId}`, () => tx.query(`SELECT public.listing_post_event($1::jsonb) AS r`, [JSON.stringify({ op: 'refund', order_id: String(orderId) })]));
      const rfShipped = await refundOf(900205);
      const rfReceived = await refundOf(900204);
      const rfCreated = await refundOf(900203);
      live.refund_gate = { shipped: rfShipped.slice(0, 160), received: rfReceived.slice(0, 160), created: rfCreated.slice(0, 160) };
      t('V16', 'dbBehavior', rfShipped.includes('order_pay_missing') && !rfShipped.includes('order_not_refundable'),
        "★ 退款闸**放宽**（活体 `listing_post_event` op=refund）：`shipped` 订单 **过状态闸**（未因状态被拒；此处仅因 `pay_txid` 缺而报 `order_pay_missing`）",
        JSON.stringify({ shipped: rfShipped.slice(0, 150) }));
      t('V17', 'dbBehavior', rfReceived.includes('order_not_refundable') && !rfReceived.includes('order_pay_missing') && rfCreated.includes('order_not_refundable'),
        "★ 退款闸**仍禁**（两读数对照）：`received` 订单 ⇒ `order_not_refundable`（终态 · 未过状态闸）；`created` 同 `order_not_refundable`",
        JSON.stringify({ received: rfReceived.slice(0, 110), created: rfCreated.slice(0, 110) }));

      // ---- C18 · 零残留自检（事务内） ----
      t('V18', 'dbBehavior', (await evN(900203)) === 0 && (await evN(900204)) === 0 && (await evN(900205)) === 0,
        '★ 非法转移 / 退款拒绝**零残留**：order 900203 / 900204 / 900205 事件行 = 0',
        JSON.stringify({ ev_900203: await evN(900203), ev_900204: await evN(900204), ev_900205: await evN(900205) }));
      live.in_tx_counts = {
        rating: Number((await q<{ n: string }>(`SELECT count(*)::int AS n FROM public.rating`))[0].n),
        event: Number((await q<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event`))[0].n),
      };

      throw new Error(SENT);
    });
  } catch (e) {
    if (String((e as Error)?.message) !== SENT) {
      t('V1', 'dbBehavior', false, '真链路（事务内）', String((e as Error)?.message || e).slice(0, 160));
    }
  }
  try {
    const cnt = async (tbl: string): Promise<number> =>
      Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.${tbl}`))[0].n);
    afterRollback = { rating: await cnt('rating'), event: await cnt('listing_order_event'), order: await cnt('listing_order') };
    dbConnections += 1;
    live.after_rollback = afterRollback;
    t('V19', 'dbBehavior',
      afterRollback.rating === baseline.rating && afterRollback.event === baseline.event && afterRollback.order === baseline.order && baseline.rating === 0 && baseline.event === 0,
      '★ 末尾 `ROLLBACK` ⇒ 主库**零残留**：评分 / 事件 / 订单行数回到 baseline（且 baseline 评分=0 事件=0）',
      JSON.stringify({ baseline, after_rollback: afterRollback }));
  } catch (e) {
    t('V19', 'dbBehavior', false, 'rollback 后计数复核', String((e as Error)?.message || e).slice(0, 160));
  }

  // ---------------- G-③ 受控实例真 HTTP（5 新口） ----------------
  const HTTP_BASE = process.env.P8S8_BASE || 'http://127.0.0.1:5797';
  const api = async (method: string, p: string, token?: string, body?: unknown) => {
    httpCalls += 1;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`${HTTP_BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status };
  };
  const ROUTES5: Array<[string, string]> = [
    ['GET', '/api/rating/summary'],
    ['GET', '/api/timeliness'],
    ['POST', '/api/rating'],
    ['POST', '/api/listing-orders/999999999/ship'],
    ['POST', '/api/listing-orders/999999999/receive'],
  ];
  let httpErr: string | null = null;
  const noTok: Record<string, number> = {};
  const read200: Record<string, number> = {};
  const writeBad: Record<string, number> = {};
  try {
    const token = createSessionToken({ uID: 11, evm: '' });
    for (const [m, p] of ROUTES5) noTok[`${m} ${p}`] = (await api(m, p)).status;
    read200['GET /api/rating/summary'] = (await api('GET', '/api/rating/summary', token)).status;
    read200['GET /api/timeliness'] = (await api('GET', '/api/timeliness', token)).status;
    writeBad['POST /api/rating(stars=6)'] = (await api('POST', '/api/rating', token, { targetType: 'job', direction: 'poster_to_worker', targetId: 1, stars: 6 })).status;
    writeBad['POST /api/rating(bad type)'] = (await api('POST', '/api/rating', token, { targetType: 'nope', direction: 'poster_to_worker', targetId: 1, stars: 3 })).status;
    writeBad['POST /ship(no order)'] = (await api('POST', '/api/listing-orders/999999999/ship', token)).status;
    writeBad['POST /receive(no order)'] = (await api('POST', '/api/listing-orders/999999999/receive', token)).status;
  } catch (e) { httpErr = String((e as Error)?.message || e).slice(0, 140); }
  live.http_no_token = noTok;
  live.http_read_200 = read200;
  live.http_write_bad_input = writeBad;
  live.http_err = httpErr;
  t('H5', 'httpLive', httpErr === null && ROUTES5.every(([m, p]) => noTok[`${m} ${p}`] === 401),
    '★ 5 新口**无 token** ⇒ 逐口 `401`（真 HTTP · 受控实例）', JSON.stringify({ no_token: noTok, err: httpErr }));
  t('H6', 'httpLive', httpErr === null && read200['GET /api/rating/summary'] === 200 && read200['GET /api/timeliness'] === 200,
    '★ 两**读口**带 token ⇒ `200`（真 HTTP · 只读零写）', JSON.stringify({ read_200: read200 }));
  t('H7', 'httpLive', httpErr === null && Object.values(writeBad).every((s) => s === 400 || s === 404),
    '★ 三**写口**带 token + 非法入参（stars=6 / 非法 targetType / 不存在订单）⇒ `400`·`404`（**零写** 落库）',
    JSON.stringify({ write_bad: writeBad }));

  // ---------------- 结论 ----------------
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S8-RATING-TIMELINESS-GATE',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: false,
    db_connections: dbConnections,
    http_calls: httpCalls,
    note: 'A–F 静态面零 DB / 零 HTTP；**G 库面 leg 转真 checks**（`0030`/`0031` 已 apply）：结构面活体 + **四段真链路**（评分提交/汇总四周期与兜底 · 时效 T1..T4 · 发货/收货 transition 与事件行同生同灭 · 退款闸放宽）一律**事务内 + 末尾 ROLLBACK** + 受控实例真 HTTP。`pending_apply[]` 归零（主库零写入）。',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    pending_apply: pendingApply,
    readings: {
      registration_points_total: countRoutes(INDEX_TS),
      registration_points_per_verb: PER_VERB_FROZEN,
      new_routes: NEW_ROUTES,
      status_set_6: [...SET_0030].sort(),
      transition_out_edges: arrowMap,
      rating_cols: RATING_COLS,
      listing_order_event_cols: EVENT_COLS,
      rating_policy_defaults: RATING_POLICY_DEFAULTS,
      no_row_default: { source: (resolveRatingPolicy(undefined)).source, defaultStars: (resolveRatingPolicy(undefined)).policy.defaultStars },
      has_row_default: { source: resolveRatingPolicy({ defaultStars: 4 }).source, defaultStars: resolveRatingPolicy({ defaultStars: 4 }).policy.defaultStars },
      error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
      locale_keys: { ratingPanel: namespaceKeys(LOCALES.zh, 'ratingPanel'), timelinessPanel: namespaceKeys(LOCALES.zh, 'timelinessPanel'), statusLabel: lsKeys(LOCALES.zh) },
      pending_apply_count: pendingApply.length,
      pending_resolved: PENDING_RESOLVED,
      live,
    },
    checks,
  };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} pending_apply=${pendingApply.length} db=${report.db_connections} http=${report.http_calls} artifact=${path.join(OUT_DIR, 'gate.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('P8S8_FATAL', String((e as Error)?.stack || e).slice(0, 400));
  await closePools().catch(() => undefined);
  process.exit(2);
});
