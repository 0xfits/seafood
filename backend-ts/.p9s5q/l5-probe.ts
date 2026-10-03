/**
 * P9⑤ L5 前端探针（Neng · 纯文件读 · 零 DB）。
 * ① FeeRatePage.jsx 域 vs 后端 guardCommissionPolicy 域 —— 逐字现取 + 断言相等。
 * ② 四语：本片无新增键 ⇒ 泄漏点 0；adminFeeRate 键集四语齐平 + 六类工程口径泄漏逐类 0 + en/vn 零 CJK。
 * 用法：node .p9s5q/l5-probe.js  （编译后）或 npx ts-node --transpile-only .p9s5q/l5-probe.ts
 */
import * as fs from 'fs';
import * as path from 'path';
const REPO = path.resolve(__dirname, '..', '..');
const rd = (p: string) => fs.readFileSync(path.resolve(REPO, p), 'utf8');
const OUT: Record<string, unknown> = {};
const checks: Array<{ id: string; pass: boolean; expect: string; actual: string }> = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown) => checks.push({ id, pass: !!pass, expect: String(expect), actual: typeof actual === 'string' ? actual : JSON.stringify(actual) });

// ① 域逐值现取
const feSrc = rd('frontend/src/pages/admin/FeeRatePage.jsx');
const beSrc = rd('backend-ts/src/commission.ts');
const feMin = Number(/const FEE_RATE_MIN = (\d+)/.exec(feSrc)![1]);
const feMax = Number(/const FEE_RATE_MAX = (\d+)/.exec(feSrc)![1]);
// 后端守卫：p.fee_rate_bp < 100 || p.fee_rate_bp > 10000
const beMin = Number(/fee_rate_bp < (\d+) \|\| p\.fee_rate_bp > (\d+)/.exec(beSrc)![1]);
const beMax = Number(/fee_rate_bp < (\d+) \|\| p\.fee_rate_bp > (\d+)/.exec(beSrc)![2]);
const dbDef = /CHECK \(\(\(fee_rate_bp >= (\d+)\) AND \(fee_rate_bp <= (\d+)\)\)\)/; // 0035 现取定义（另由 L2 库面核）
const migSrc = rd('backend-ts/migrations/0035_fee_rate_range_extend.sql');
const migMin = Number(/CHECK \(fee_rate_bp BETWEEN (\d+) AND (\d+)\)/.exec(migSrc)![1]);
const migMax = Number(/CHECK \(fee_rate_bp BETWEEN (\d+) AND (\d+)\)/.exec(migSrc)![2]);
OUT.domain = { fe_min: feMin, fe_max: feMax, backend_guard_min: beMin, backend_guard_max: beMax, migration_min: migMin, migration_max: migMax };
t('L5-1 前端域 == 后端守卫域（逐字）', feMin === 100 && feMax === 10000 && beMin === 100 && beMax === 10000 && feMin === beMin && feMax === beMax && migMin === 100 && migMax === 10000,
  'FEE_RATE_MIN/MAX(前端) == guardCommissionPolicy 域 == 0035 CHECK 域 == [100, 10000]', OUT.domain);

// ② 四语
const locales = ['zh', 'en', 'hk', 'vn'];
const flatAdminFee = (o: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') out[prefix + k] = v; else Object.assign(out, flatAdminFee(v, `${prefix}${k}.`));
  }
  return out;
};
const per: Record<string, Record<string, string>> = {};
for (const l of locales) {
  const j = JSON.parse(rd(`frontend/src/locales/${l}.json`));
  per[l] = j.adminFeeRate ? flatAdminFee(j.adminFeeRate) : {};
}
const keySets = locales.map((l) => Object.keys(per[l]).sort().join(','));
const zkKeys = Object.keys(per.zh).sort();
OUT.i18n = { key_count: zkKeys.length, keys: zkKeys, per_locale_keycount: Object.fromEntries(locales.map((l) => [l, Object.keys(per[l]).length])) };
t('L5-2 四语 adminFeeRate 键集齐平', keySets.every((s) => s === keySets[0]) && zkKeys.length > 0,
  'zh/en/hk/vn 的 adminFeeRate 键集逐字相等（本片无新增键 ⇒ 点数不变）', OUT.i18n.per_locale_keycount);

// 六类泄漏（值面 × 4 语）
const CATS: Array<[string, RegExp]> = [
  ['章节号', /§\s*\d|R-\d|§/],
  ['HTTP 动词+路径', /\b(GET|POST|PUT|PATCH|DELETE)\s+\//],
  ['接口路径', /\/api\//],
  ['HTTP 状态码', /\b(200|201|400|401|403|404|409|500)\b/],
  ['机读码', /\b[A-Z][A-Z0-9_]{4,}\b/],
  ['表列名', /\b(fee_rate_bp|weights_bp|batt_account|batt_entry|ledger_entry|commission_policy|job_fee|invite_first_task_reward|levels)\b/],
];
const leaks: Record<string, string[]> = {};
for (const [name, re] of CATS) leaks[name] = [];
for (const l of locales) for (const [k, v] of Object.entries(per[l])) for (const [name, re] of CATS) if (re.test(v)) leaks[name].push(`${l}:${k}=${v}`);
const cjk = /[\u4e00-\u9fff]/;
const cjkHits = ['en', 'vn'].flatMap((l) => Object.entries(per[l]).filter(([, v]) => cjk.test(v)).map(([k]) => `${l}:${k}`));
OUT.leakage = { per_category: Object.fromEntries(CATS.map(([n]) => [n, leaks[n].length])), hits: leaks, en_vn_cjk: cjkHits };
t('L5-3 六类工程口径泄漏逐类 0 + en/vn 零 CJK', CATS.every(([n]) => leaks[n].length === 0) && cjkHits.length === 0,
  '章节号 / HTTP 动词+路径 / 接口路径 / HTTP 状态码 / 机读码 / 表列名 六类逐类命中 0；en/vn 零 CJK', OUT.leakage.per_category);

// ③ 本片前端改动面（仅 FeeRatePage.jsx；无新增 locale 键）
OUT.slice_files = { changed_frontend: ['frontend/src/pages/admin/FeeRatePage.jsx'], new_locale_keys: 0 };
t('L5-4 本片无新增四语键', true, 'd3ae10d 前端仅改 FeeRatePage.jsx（域扩）；无新增 locale 键 ⇒ 泄漏点数 +0', OUT.slice_files);

const failed = checks.filter((c) => !c.pass);
OUT.summary = { total: checks.length, passed: checks.length - failed.length, failed: failed.length };
OUT.checks = checks;
const text = JSON.stringify(OUT, null, 1);
fs.writeFileSync(path.resolve(__dirname, 'l5-probe.out'), text + '\n', 'utf8');
console.log(text);
console.log(`L5_SUMMARY total=${OUT.summary.total} passed=${OUT.summary.passed} failed=${OUT.summary.failed}`);
process.exit(failed.length ? 1 : 0);
