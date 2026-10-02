/**
 * 批 8②（spec `route-layer.spec` v2.4 §19）· **费率 / 返佣权重矩阵**类级门
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s2-artifacts/p8s2-gate-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只读源码文本 + 纯文本比对）—— 与「离线 126/126 套件」同族。
 *
 * 判据四大面（派单 ④ 逐字）+ 门自证：
 *   A  **读口注册**：注册点 **68 → 69**（增量登记）；读口恰 1 处；闸 = `manage_settings`；
 *      取数**复用** `getCommissionPolicy`（**不得自写第二套取数**，§19.2(c)）；只读纪律（`SELECT` only）
 *   B  **读口 `data` 8 键齐备**：`CommissionPolicy` 接口 / `mapPolicy` / 读口 SELECT 三处键集 = 逐字冻结 8 键
 *   C  **后台页 8 字段齐备**：两页字段 ⊆ 8 键；两条路由 + 两条菜单（闸 `manage_settings`）；
 *      两页**零 CJK**（文案必须走 i18n）；前端守卫常量与 `src/commission.ts` 守卫**逐值相等**
 *   D  **四语键齐**：`adminFeeRate`(18) / `adminWeightMatrix`(21) / `adminNav`(20) 四语键集相等、值非空、
 *      `en`/`vn` 零 CJK、`hk` 为繁体
 *   E  **六类工程口径泄漏 = 0**（§19.5(c) 写死六类）：四语 × 两命名空间全部键值正则扫描，命中 = 0
 *   F  **门自证（负对照）**：六类各注入一例 ⇒ 扫描器**必须转红**（不转红 = 假门，§19.4(d)-⑥）
 */
import * as fs from 'fs';
import * as path from 'path';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s2-artifacts', `p8s2-gate-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const INDEX_TS = read('backend-ts/src/index.ts');
const COMMISSION_TS = read('backend-ts/src/commission.ts');
const APP_JSX = read('frontend/src/App.jsx');
const ADMIN_LAYOUT = read('frontend/src/components/layout/AdminLayout.jsx');
const FEE_PAGE = read('frontend/src/pages/admin/FeeRatePage.jsx');
const MATRIX_PAGE = read('frontend/src/pages/admin/ReferralWeightMatrixPage.jsx');
const LANGS = ['zh', 'en', 'hk', 'vn'] as const;
const LOCALES: Record<string, Record<string, Record<string, string>>> = {};
for (const lang of LANGS) LOCALES[lang] = JSON.parse(read(`frontend/src/locales/${lang}.json`));

/** 冻结键集（逐字 · `src/commission.ts:126-135` 现取 8 键） */
const FROZEN_POLICY_KEYS = [
  'created_by', 'effective_from', 'fee_rate_bp', 'levels',
  'policy_id', 'time_created', 'weights_bp', 'weights_sum_bp',
];
const READ_ROUTE = "app.get('/api/admin/commission_policy'";
const WRITE_ROUTE = "app.post('/api/admin/commission_policy'";

/** 从源码里切出「某注册点起、到下一个注册点止」的 handler 文本 */
const handlerBlock = (src: string, routeLiteral: string): string => {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes(routeLiteral));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^app\.(get|post|put|delete|patch)\(/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
};
const countMatches = (hay: string, re: RegExp): number => (hay.match(re) || []).length;

// ============================================================================
// A · 读口注册（增量登记 68 → 69）+ 闸 + 取数复用 + 只读纪律
// ============================================================================
const REG_COUNT = countMatches(INDEX_TS, /^app\.(get|post|put|delete|patch)\(/gm);
t('A1', 'readRouteRegistered', REG_COUNT === 71,
  '注册点 = 71（`grep -cE \'^app\\.(get|post|put|delete|patch)\\(\'`；v1.8 的 68 ⇒ 8② 读口 +1〔69〕⇒ 8④ 读口/动作口 +2 = 71）', REG_COUNT);
t('A2', 'readRouteRegistered', countMatches(INDEX_TS, new RegExp(READ_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) === 1,
  '`GET /api/admin/commission_policy` 注册**恰 1 处**',
  countMatches(INDEX_TS, new RegExp(READ_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')));
t('A3', 'readRouteRegistered', countMatches(INDEX_TS, new RegExp(WRITE_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) === 1,
  '写口 `POST /api/admin/commission_policy` 仍在**同路径**（同族先例 = `GET|POST /api/admin/settings`）',
  countMatches(INDEX_TS, new RegExp(WRITE_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')));
const READ_BLOCK = handlerBlock(INDEX_TS, READ_ROUTE);
const WRITE_BLOCK = handlerBlock(INDEX_TS, WRITE_ROUTE);
t('A4', 'readRouteRegistered', /requireAdmin\(req,\s*res,\s*'manage_settings'\)/.test(READ_BLOCK),
  "读口闸 = `requireAdmin(req, res, 'manage_settings')`（与写口同键 · 11 键内 · `R-8-1` 零新增键）",
  JSON.stringify((READ_BLOCK.match(/requireAdmin\([^)]*\)/) || ['(none)'])[0]));
t('A5', 'readRouteRegistered', /requireAdmin\(req,\s*res,\s*'manage_settings'\)/.test(WRITE_BLOCK),
  "写口闸 = `manage_settings`（现取锚不动）",
  JSON.stringify((WRITE_BLOCK.match(/requireAdmin\([^)]*\)/) || ['(none)'])[0]));
t('A6', 'readRouteRegistered', /getCommissionPolicy\s*\(/.test(READ_BLOCK),
  '读口取数 = **复用** `getCommissionPolicy`（`src/commission.ts:201`）；**不得自写第二套取数**（§19.2(c)）',
  JSON.stringify((READ_BLOCK.match(/[A-Za-z]+CommissionPolicy\s*\(/) || ['(none)'])[0]));
t('A7', 'readRouteRegistered', !/FROM\s+commission_policy|SELECT\s/i.test(READ_BLOCK),
  '读口 handler **内零 SQL**（取数只在 `commission.ts` 一处）', /FROM\s+commission_policy|SELECT/i.test(READ_BLOCK));
t('A8', 'readRouteRegistered', !/\b(INSERT|UPDATE|DELETE)\b/i.test(READ_BLOCK) && !/\binsertCommissionPolicy\s*\(/.test(READ_BLOCK),
  '读口**只读纪律**：handler 内零写路径（政策表 append-only，`0007:102-112`）',
  JSON.stringify((READ_BLOCK.match(/\b(INSERT|UPDATE|DELETE)\b|insertCommissionPolicy\s*\(/gi) || [])));
t('A9', 'readRouteRegistered', /sendSuccess\(res,\s*policy\b/.test(READ_BLOCK),
  '读口响应 = 形态 A（`data` = 政策**本体**，`sendSuccess(res, policy, …)`）',
  JSON.stringify((READ_BLOCK.match(/sendSuccess\([^;]*/) || ['(none)'])[0].slice(0, 90)));

// ============================================================================
// B · 读口 `data` 8 键齐备（接口 / mapPolicy / SELECT 三处同键集）
// ============================================================================
const ifaceBody = (COMMISSION_TS.match(/export interface CommissionPolicy\s*\{([\s\S]*?)\n\}/) || ['', ''])[1];
const ifaceKeys = (ifaceBody.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm) || [])
  .map((s) => s.trim().replace(/:$/, '')).sort();
t('B1', 'readShape8Keys', JSON.stringify(ifaceKeys) === JSON.stringify(FROZEN_POLICY_KEYS),
  `\`CommissionPolicy\` 接口键集 = 逐字冻结 8 键（src/commission.ts:126）`, JSON.stringify(ifaceKeys));

const mapPolicyBody = (COMMISSION_TS.match(/const mapPolicy = [\s\S]*?\n\};/) || [''])[0];
const mapPolicyKeys = (mapPolicyBody.match(/^\s{4}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm) || [])
  .map((s) => s.trim().replace(/:$/, '')).sort();
t('B2', 'readShape8Keys', JSON.stringify(mapPolicyKeys) === JSON.stringify(FROZEN_POLICY_KEYS),
  '`mapPolicy` 返回键集 = 冻结 8 键（读口 `data` 的实际构造点）', JSON.stringify(mapPolicyKeys));

const getPolicySql = (COMMISSION_TS.match(/export const getCommissionPolicy[\s\S]*?LIMIT 1`/) || [''])[0];
const sqlCols = (getPolicySql.match(/\b(policy_id|fee_rate_bp|levels|weights_bp|effective_from|created_by|time_created)\b/g) || []);
const sqlColSet = Array.from(new Set(sqlCols)).sort();
t('B3', 'readShape8Keys',
  JSON.stringify(sqlColSet) === JSON.stringify(['created_by', 'effective_from', 'fee_rate_bp', 'levels', 'policy_id', 'time_created', 'weights_bp']),
  '`getCommissionPolicy` 的 `SELECT` 列 = 7 列（第 8 键 `weights_sum_bp` = 读时算一次，非存储列）',
  JSON.stringify(sqlColSet));
t('B4', 'readShape8Keys', /weights_sum_bp:\s*weights\.reduce/.test(mapPolicyBody),
  '`weights_sum_bp` = `weights.reduce(...)`（读时算一次 · **非存储列**）',
  /weights_sum_bp:\s*weights\.reduce/.test(mapPolicyBody));
// §19.5(a)/(b) 页面用字段 ⊆ 8 键（逐字对照 spec 两张表）
const PAGE_FIELDS_FEE = ['fee_rate_bp', 'effective_from', 'created_by', 'time_created', 'policy_id', 'weights_sum_bp'];
const PAGE_FIELDS_MATRIX = ['levels', 'weights_bp', 'weights_sum_bp'];
const missingFee = PAGE_FIELDS_FEE.filter((k) => !FEE_PAGE.includes(k));
const missingMatrix = PAGE_FIELDS_MATRIX.filter((k) => !MATRIX_PAGE.includes(k));
t('B5', 'readShape8Keys', missingFee.length === 0 && missingMatrix.length === 0,
  '§19.5(a)/(b) 页面用字段全部落在冻结 8 键内', JSON.stringify({ missingFee, missingMatrix }));

// ============================================================================
// C · 后台页 8 字段齐备 + 路由 / 菜单 / 闸 + 零 CJK + 守卫常量逐值相等
// ============================================================================
t('C1', 'adminPages', FROZEN_POLICY_KEYS.filter((k) => !FEE_PAGE.includes(k)).length === 0,
  '`FeeRatePage.jsx` 引用**全部 8 键**（页面字段面齐）',
  JSON.stringify(FROZEN_POLICY_KEYS.filter((k) => !FEE_PAGE.includes(k))));
t('C2', 'adminPages', ['levels', 'weights_bp', 'weights_sum_bp', 'fee_rate_bp'].filter((k) => !MATRIX_PAGE.includes(k)).length === 0,
  '`ReferralWeightMatrixPage.jsx` 引用矩阵面 4 键（`levels` / `weights_bp` / `weights_sum_bp` / `fee_rate_bp`）',
  JSON.stringify(['levels', 'weights_bp', 'weights_sum_bp', 'fee_rate_bp'].filter((k) => !MATRIX_PAGE.includes(k))));
const feeRoute = /path="fee-rate"[\s\S]{0,160}requiredPermission="manage_settings"[\s\S]{0,40}<FeeRatePage\s*\/>/.test(APP_JSX);
const matrixRoute = /path="weight-matrix"[\s\S]{0,160}requiredPermission="manage_settings"[\s\S]{0,40}<ReferralWeightMatrixPage\s*\/>/.test(APP_JSX);
t('C3', 'adminPages', feeRoute && matrixRoute,
  '`App.jsx` 两条路由（`fee-rate` / `weight-matrix`）且闸 = `manage_settings`（§19.5(d)）',
  JSON.stringify({ feeRoute, matrixRoute }));
const feeMenu = /t\('adminNav\.feeRate'\)[\s\S]{0,220}requiredPermission:\s*'manage_settings'/.test(ADMIN_LAYOUT);
const matrixMenu = /t\('adminNav\.weightMatrix'\)[\s\S]{0,240}requiredPermission:\s*'manage_settings'/.test(ADMIN_LAYOUT);
t('C4', 'adminPages', feeMenu && matrixMenu,
  '`AdminLayout.jsx` 两条菜单（`adminNav.feeRate` / `adminNav.weightMatrix`）且闸 = `manage_settings`',
  JSON.stringify({ feeMenu, matrixMenu }));
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CJK = /[\u4E00-\u9FFF]/;
const cjkFee = stripComments(FEE_PAGE).split('\n').filter((l) => CJK.test(l)).length;
const cjkMatrix = stripComments(MATRIX_PAGE).split('\n').filter((l) => CJK.test(l)).length;
t('C5', 'adminPages', cjkFee === 0 && cjkMatrix === 0,
  '两页源码（**注释剥离后**）**零 CJK** ⇒ 用户可见文案必须走 i18n（不得硬编码中文）',
  JSON.stringify({ FeeRatePage_CJK_lines: cjkFee, ReferralWeightMatrixPage_CJK_lines: cjkMatrix }));
// 前端守卫常量必须与 `src/commission.ts` 守卫**逐值相等**（§19.5(a)：前端不得自造范围）
const gFeeMin = Number((COMMISSION_TS.match(/p\.fee_rate_bp < (\d+)/) || [])[1]);
const gFeeMax = Number((COMMISSION_TS.match(/p\.fee_rate_bp > (\d+)/) || [])[1]);
const gLvMin = Number((COMMISSION_TS.match(/p\.levels < (\d+)/) || [])[1]);
const gLvMax = Number((COMMISSION_TS.match(/p\.levels > (\d+)/) || [])[1]);
const gSumMax = Number((COMMISSION_TS.match(/sum > (\d+)/) || [])[1]);
const constOf = (src: string, name: string): number => Number((src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`)) || [])[1]);
const guardMirror = {
  guard: { FEE_RATE_MIN: gFeeMin, FEE_RATE_MAX: gFeeMax, LEVELS_MIN: gLvMin, LEVELS_MAX: gLvMax, WEIGHTS_SUM_MAX: gSumMax },
  FeeRatePage: { FEE_RATE_MIN: constOf(FEE_PAGE, 'FEE_RATE_MIN'), FEE_RATE_MAX: constOf(FEE_PAGE, 'FEE_RATE_MAX') },
  MatrixPage: { LEVELS_MIN: constOf(MATRIX_PAGE, 'LEVELS_MIN'), LEVELS_MAX: constOf(MATRIX_PAGE, 'LEVELS_MAX'), WEIGHTS_SUM_MAX: constOf(MATRIX_PAGE, 'WEIGHTS_SUM_MAX') },
};
t('C6', 'adminPages',
  guardMirror.FeeRatePage.FEE_RATE_MIN === gFeeMin && guardMirror.FeeRatePage.FEE_RATE_MAX === gFeeMax
  && guardMirror.MatrixPage.LEVELS_MIN === gLvMin && guardMirror.MatrixPage.LEVELS_MAX === gLvMax
  && guardMirror.MatrixPage.WEIGHTS_SUM_MAX === gSumMax
  && [gFeeMin, gFeeMax, gLvMin, gLvMax, gSumMax].every((v) => Number.isInteger(v) && v > 0),
  '前端守卫常量 = `src/commission.ts:175-191` 守卫**逐值相等**（前端不得自造范围）',
  JSON.stringify(guardMirror));
t('C7', 'adminPages', /Page not found|TODO|FIXME|PLACEHOLDER/.test(FEE_PAGE + MATRIX_PAGE) === false
  && FEE_PAGE.length > 2000 && MATRIX_PAGE.length > 2000,
  '两页无占位符 / TODO / 空壳（页面本体已实现）',
  JSON.stringify({ fee_bytes: FEE_PAGE.length, matrix_bytes: MATRIX_PAGE.length }));

// ============================================================================
// D · 四语键齐（`adminFeeRate` 18 / `adminWeightMatrix` 21 / `adminNav` 22）
// ============================================================================
const NS_KEYS: Record<string, number> = { adminFeeRate: 18, adminWeightMatrix: 21, adminNav: 22 };
for (const [ns, size] of Object.entries(NS_KEYS)) {
  const present = LANGS.every((l) => LOCALES[l][ns] && typeof LOCALES[l][ns] === 'object');
  const base = Object.keys(LOCALES.zh[ns] || {}).sort();
  const equal = LANGS.every((l) => JSON.stringify(Object.keys(LOCALES[l][ns] || {}).sort()) === JSON.stringify(base));
  const sizeOk = base.length === size;
  t(`D1-${ns}`, 'fourLangKeys', present && equal && sizeOk,
    `\`${ns}\` 四语齐备且键集相等、键数 = ${size}（现值）`,
    JSON.stringify({ per_lang: LANGS.map((l) => (LOCALES[l][ns] ? Object.keys(LOCALES[l][ns]).length : null)), equal, zh_keys: base.length }));
}
const NEW_NAV_KEYS = ['feeRate', 'feeRateDesc', 'weightMatrix', 'weightMatrixDesc'];
t('D2-adminNav-add4', 'fourLangKeys', LANGS.every((l) => NEW_NAV_KEYS.every((k) => k in LOCALES[l].adminNav)),
  '`adminNav` 四语均含本片 +4 键（`feeRate` / `feeRateDesc` / `weightMatrix` / `weightMatrixDesc`）',
  JSON.stringify(LANGS.map((l) => NEW_NAV_KEYS.filter((k) => !(k in LOCALES[l].adminNav)))));
const EMPTY = LANGS.flatMap((l) => Object.entries({ ...LOCALES[l].adminFeeRate, ...LOCALES[l].adminWeightMatrix }))
  .filter(([, v]) => typeof v !== 'string' || v.trim().length === 0).map(([k]) => k);
t('D3', 'fourLangKeys', EMPTY.length === 0, '四语两命名空间**逐键非空串**', JSON.stringify(EMPTY));
const EN_VN_CJK = LANGS.filter((l) => l === 'en' || l === 'vn')
  .flatMap((l) => Object.entries({ ...LOCALES[l].adminFeeRate, ...LOCALES[l].adminWeightMatrix }))
  .filter(([, v]) => CJK.test(v)).map(([k]) => k);
t('D4', 'fourLangKeys', EN_VN_CJK.length === 0, '`en` / `vn` 两命名空间**零 CJK**', JSON.stringify(EN_VN_CJK));
t('D5', 'fourLangKeys',
  LOCALES.hk.adminFeeRate.labelFeeRate !== LOCALES.zh.adminFeeRate.labelFeeRate
  || LOCALES.hk.adminWeightMatrix.colWeight !== LOCALES.zh.adminWeightMatrix.colWeight,
  '`hk` 为**繁体**（与 `zh` 简体逐字不同 · 抽查 2 条）',
  JSON.stringify({ hk: LOCALES.hk.adminFeeRate.labelFeeRate, zh: LOCALES.zh.adminFeeRate.labelFeeRate }));

// ============================================================================
// E · 六类工程口径泄漏 = 0（§19.5(c) 写死六类）
// ============================================================================
/** 六类判据（正则 · 逐条写死） */
const LEAK_PATTERNS: Array<{ id: string; label: string; re: RegExp; sample: string }> = [
  { id: 'E1', label: '① 本册章节号 / 条号', re: /§\s*\d|\bR-\d+|\bDL\d+/, sample: '费率（§19.2）' },
  { id: 'E2', label: '② HTTP 状态码', re: /\b(400|401|403|404|409|410|500|503)\b/, sample: '保存失败 400' },
  { id: 'E3', label: '③ 接口路径 / 方法', re: /\/api\/|\b(POST|GET|PUT|PATCH|DELETE)\b/, sample: 'POST /api/admin/commission_policy' },
  { id: 'E4', label: '④ 内部批次名 / 单号', re: /8[①②③④⑤⑥]|\bP[0-9]\b|\bB[0-9]\b|JING-SPEC|FIX-[A-Z]/, sample: '批 8② 变更' },
  { id: 'E5', label: '⑤ 机读码 / 裸 i18n 键', re: /\b[A-Z][A-Z0-9_]{5,}\b|\badmin[A-Za-z]*\.[A-Za-z]/, sample: 'POLICY_SHAPE_INVALID / adminFeeRate.title' },
  { id: 'E6', label: '⑥ 表名 / 列名 / 函数名', re: /commission_policy|weights_bp|job_settle_plan|fee_rate_bp|policy_id|effective_from|time_created|splitPool|job_fee/, sample: 'commission_policy.weights_bp' },
];
/** 扫描器 = 唯一判负出口（负对照也走它） */
const scanLeaks = (values: string[]): Array<{ id: string; hit: string; value: string }> => {
  const hits: Array<{ id: string; hit: string; value: string }> = [];
  for (const v of values) {
    for (const p of LEAK_PATTERNS) {
      const m = v.match(p.re);
      if (m) hits.push({ id: p.id, hit: m[0], value: v });
    }
  }
  return hits;
};
const ALL_VALUES = LANGS.flatMap((l) => [...Object.values(LOCALES[l].adminFeeRate), ...Object.values(LOCALES[l].adminWeightMatrix)]);
const leakHits = scanLeaks(ALL_VALUES);
for (const p of LEAK_PATTERNS) {
  const hits = leakHits.filter((h) => h.id === p.id);
  t(p.id, 'noEngLeak', hits.length === 0, `禁泄漏 ${p.label} ⇒ 命中 = 0`, JSON.stringify(hits.slice(0, 3)));
}

// ============================================================================
// F · 门自证（负对照）：六类各注入一例 ⇒ 扫描器必须转红（不转红 = 假门）
// ============================================================================
for (const p of LEAK_PATTERNS) {
  const injected = scanLeaks([p.sample]);
  const fired = injected.some((h) => h.id === p.id);
  t(`${p.id}__selftest`, 'noEngLeakSelfTest', fired,
    `负对照：注入 \`${p.sample}\` ⇒ ${p.label} 判据**必须转红**`,
    JSON.stringify({ sample: p.sample, fired }));
}
// 反向负对照：干净文案不得误报（防「一律转红」的假门）
const cleanProbe = scanLeaks([LOCALES.zh.adminFeeRate.saved, LOCALES.en.adminWeightMatrix.colShare]);
t('F-clean-control', 'noEngLeakSelfTest', cleanProbe.length === 0,
  '反向负对照：干净文案（`adminFeeRate.saved` / `adminWeightMatrix.colShare`）**零命中**',
  JSON.stringify(cleanProbe));

// ==================================================================== 结论
const failed = checks.filter((c) => !c.pass);
const report = {
  unit: 'P8-S2-FEE-REBATE-GATE',
  generated_at: new Date().toISOString(),
  run: RUN,
  offline: true,
  db_connections: 0,
  http_calls: 0,
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  readings: {
    registration_points: REG_COUNT,
    registration_by_verb: {
      get: countMatches(INDEX_TS, /^app\.get\(/gm),
      post: countMatches(INDEX_TS, /^app\.post\(/gm),
      put: countMatches(INDEX_TS, /^app\.put\(/gm),
      patch: countMatches(INDEX_TS, /^app\.patch\(/gm),
      delete: countMatches(INDEX_TS, /^app\.delete\(/gm),
    },
    frozen_policy_keys: FROZEN_POLICY_KEYS,
    locale_ns_key_counts: Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(
      Object.keys(NS_KEYS).map((ns) => [ns, Object.keys(LOCALES[l][ns]).length]))])),
    leak_scan_values: ALL_VALUES.length,
    leak_hits: leakHits,
  },
  checks,
};
const text = JSON.stringify(report, null, 1);
fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
console.log(text);
console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
process.exit(failed.length ? 1 : 0);
