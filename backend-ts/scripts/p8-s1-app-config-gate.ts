/**
 * 批 8①（`data-layer.spec` v0.10 §21）· `app_config` 合法键清单 + 写入门禁**类级门**
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s1-artifacts/p8s1-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码文本）—— 与「离线 126/126 套件」同族。
 *
 * 覆盖（每条判据都**可判负**：把判据真源改回「静默吸收」⇒ 本门必红）：
 *   A  **`AG2` 类级**：写 `app_config` 的语句**只允许**出现在 `database.ts` 的 `saveSystemSettings`（越权面 ⇒ 拒）
 *   B  **`AK1` ∪ `AK2` 合法键清单 = 关闭集**：顶层键恰好 `system_settings` + `listing_deposit_policy`（批 8③ 入册）；
 *      值对象字段恰好 9 个（逐字冻结；**`AK2` 是顶层键、不作 `AK1` 第 10 个字段**）
 *   C  **`AG1`**：未知键 ⇒ 拒（`reason='SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'`（**稳定常量** · `R-8-10`，不随键名插值）+ `unknown_keys` 逐键）
 *   D  **`AG3`**：非 object（裸标量/数组/null）⇒ 拒；已知字段类型不符 ⇒ 拒（`reason='SETTING_TYPE_INVALID'` + `{field,expected,got}`）
 *   E  **`AG4`**：合法键 + 未知键**混合体** ⇒ 整请求拒（未知键非空、`ok=false`；不得「一半落库一半吞掉」）
 *   F  正例：合法全量 / 合法部分补丁 / 空补丁 ⇒ `ok=true`（**不给默认值**、不隐式转换）
 *   G  **写侧不得静默吸收（类级源码断言）**：路由调 `screenSystemSettingsWrite`；`saveSystemSettings` 调
 *      `assertSystemSettingsPatch`；旧名 `normalizeSystemSettings(`（静默吸收形态）**零命中**
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  APP_CONFIG_LEGAL_KEYS,
  SYSTEM_SETTINGS_FIELDS,
  validateSystemSettingsPatch,
} from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s1-artifacts', `p8s1-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

/** 冻结关闭集（逐字，**只在门里出现一次**；与 §21.1 的 9 字段逐字对齐）。 */
const FROZEN_FIELDS = [
  'siteName', 'siteDescription', 'maintenance', 'allowRegistration', 'emailNotifications',
  'defaultLanguage', 'pointsPerTask', 'maxDailyTasks', 'rewardCooldown',
];
// ★ 批 8③（`data-layer.spec` v0.12 §23.1）：合法键清单 **1 键 → 恰 2 键**（+ `AK2` = `listing_deposit_policy`）。
//   期望订正（逐字登记 · 不删断言）：`['system_settings']` ⇒ `['system_settings','listing_deposit_policy']`（顺序 = 代码面）。
const FROZEN_TOP_KEYS = ['system_settings', 'listing_deposit_policy'];

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const walkTs = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};

const SRC_DIR = path.resolve(REPO_ROOT, 'backend-ts', 'src');
const SRC_FILES = walkTs(SRC_DIR);
/** 去注释（同类判断必须只看代码位；注释里的字面提及不得计入）。 */
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '').replace(/\/\/[^\n]*$/gm, '');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const DATABASE_CODE = stripComments(DATABASE_TS);
const INDEX_TS = readSrc('backend-ts/src/index.ts');

// ==================================================================== A · AG2 类级
{
  const writeRe = /(INSERT INTO public\.app_config|UPDATE public\.app_config)/g;
  const hitFiles: string[] = [];
  const hits: Array<{ file: string; stmt: string; offset: number }> = [];
  for (const f of SRC_FILES) {
    const text = stripComments(fs.readFileSync(f, 'utf8'));
    let m: RegExpExecArray | null;
    writeRe.lastIndex = 0;
    let found = false;
    while ((m = writeRe.exec(text))) {
      hits.push({ file: path.relative(REPO_ROOT, f), stmt: m[0], offset: m.index });
      found = true;
    }
    if (found) hitFiles.push(path.relative(REPO_ROOT, f));
  }
  t('A1', 'AG2', hitFiles.length === 1 && hitFiles[0] === 'backend-ts/src/database.ts',
    "写 app_config 的文件 = ['backend-ts/src/database.ts']（唯一）", JSON.stringify(hitFiles));
  t('A2', 'AG2', hits.length === 1 && hits[0].stmt === 'INSERT INTO public.app_config',
    '写 app_config 的语句 = 1 处（INSERT）', JSON.stringify(hits.map((h) => h.stmt)));

  // 命中的语句必须落在 `saveSystemSettings` 方法体内（越权面 = 其它任何位置）
  const start = DATABASE_CODE.indexOf('static async saveSystemSettings(');
  const after = DATABASE_CODE.indexOf('static async ', start + 10);
  const end = after > start ? after : DATABASE_CODE.length;
  const dbOffset = hits.length ? hits[0].offset : -1;
  t('A3', 'AG2', start > 0 && end > start && dbOffset >= start && dbOffset < end,
    '唯一写入语句落在 saveSystemSettings 方法体内',
    `save=[${start},${end}) hit_offset=${dbOffset}`);
}

// ==================================================================== B · AK1 关闭集
{
  t('B1', 'AK1', JSON.stringify([...APP_CONFIG_LEGAL_KEYS]) === JSON.stringify(FROZEN_TOP_KEYS),
    JSON.stringify(FROZEN_TOP_KEYS), JSON.stringify([...APP_CONFIG_LEGAL_KEYS]));
  t('B2', 'AK1', JSON.stringify([...SYSTEM_SETTINGS_FIELDS]) === JSON.stringify(FROZEN_FIELDS),
    JSON.stringify(FROZEN_FIELDS), JSON.stringify([...SYSTEM_SETTINGS_FIELDS]));

  // 代码面 `app_config` 关联的键名字面量只能落在**合法键清单**内（不得自拟键名 · §21.3 规则①）
  //   取法：定位 `public.app_config`，在其附近窗口内抽 SQL 键字面量（`key = '<k>'` / `VALUES ('<k>'`）。
  const keyLiterals = new Set<string>();
  for (const f of SRC_FILES) {
    const text = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of text.matchAll(/public\.app_config/g)) {
      const win = text.slice(Math.max(0, m.index - 300), m.index + 400);
      for (const k of win.matchAll(/(?:key\s*=\s*|VALUES\s*\(\s*)'([a-z_][a-z0-9_]*)'/gi)) keyLiterals.add(k[1]);
    }
  }
  const literalsArr = [...keyLiterals].sort();
  // ★ 批 8③：清单 = 恰 2 键 ⇒ 健字面量 ⊆ 合法键清单（现取 = 两键：`system_settings` + `listing_deposit_policy`）。
  t('B3', 'AK1', literalsArr.length > 0
    && literalsArr.every((k) => (APP_CONFIG_LEGAL_KEYS as readonly string[]).includes(k)),
    `app_config 的 SQL 键字面量 ⊆ 合法键清单（${JSON.stringify([...FROZEN_TOP_KEYS].sort())}）`,
    JSON.stringify(literalsArr));
}

// ==================================================================== C · AG1 未知键
{
  const cases: Array<[string, Record<string, unknown>]> = [
    ['C1', { foo: 1 }],
    ['C2', { deposit_amount: '50000' }],
    ['C3', { listing_deposit_policy: { amount: '50000' } }],
  ];
  for (const [id, input] of cases) {
    const v = validateSystemSettingsPatch(input);
    const key = Object.keys(input)[0];
    const ok = v.ok === false
      && v.details.reason === 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'
      && Array.isArray(v.details.unknown_keys) && (v.details.unknown_keys as string[]).includes(key)
      && v.code === 'LEDGER_AMOUNT_INVALID';
    t(id, 'AG1', ok, `ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 ${key}`,
      v.ok ? 'ok=true' : JSON.stringify({ code: v.code, reason: v.details.reason, unknown_keys: v.details.unknown_keys }));
  }
}

// ==================================================================== D · AG3 类型/容器
{
  const d1 = validateSystemSettingsPatch(5);
  t('D1', 'AG3', d1.ok === false && d1.details.reason === 'SETTING_VALUE_NOT_OBJECT' && d1.details.got === 'number',
    'ok=false/reason=SETTING_VALUE_NOT_OBJECT/got=number',
    d1.ok ? 'ok=true' : JSON.stringify({ reason: d1.details.reason, got: d1.details.got }));
  const d2 = validateSystemSettingsPatch(['a']);
  t('D2', 'AG3', d2.ok === false && d2.details.reason === 'SETTING_VALUE_NOT_OBJECT' && d2.details.got === 'array',
    'ok=false/reason=SETTING_VALUE_NOT_OBJECT/got=array',
    d2.ok ? 'ok=true' : JSON.stringify({ reason: d2.details.reason, got: d2.details.got }));
  const d3 = validateSystemSettingsPatch(null);
  t('D3', 'AG3', d3.ok === false && d3.details.reason === 'SETTING_VALUE_NOT_OBJECT' && d3.details.got === 'null',
    'ok=false/reason=SETTING_VALUE_NOT_OBJECT/got=null',
    d3.ok ? 'ok=true' : JSON.stringify({ reason: d3.details.reason, got: d3.details.got }));

  const typeCases: Array<[string, Record<string, unknown>, string, string]> = [
    ['D4', { pointsPerTask: 'abc' }, 'pointsPerTask', 'string'],
    ['D5', { maintenance: 1 }, 'maintenance', 'number'],
    ['D6', { siteName: 42 }, 'siteName', 'number'],
    ['D7', { maxDailyTasks: false }, 'maxDailyTasks', 'boolean'],
  ];
  for (const [id, input, field, got] of typeCases) {
    const v = validateSystemSettingsPatch(input);
    const ok = v.ok === false && v.details.reason === 'SETTING_TYPE_INVALID'
      && v.details.field === field && v.details.got === got && typeof v.details.expected === 'string';
    t(id, 'AG3', ok, `ok=false/reason=SETTING_TYPE_INVALID/field=${field}/got=${got}/expected=<string>`,
      v.ok ? 'ok=true' : JSON.stringify({ reason: v.details.reason, field: v.details.field, got: v.details.got, expected: v.details.expected }));
  }
}

// ==================================================================== E · AG4 混合体（整请求拒）
{
  const mixed = validateSystemSettingsPatch({ siteName: 'X', foo: 1 });
  t('E1', 'AG4', mixed.ok === false && Array.isArray(mixed.details.unknown_keys) && (mixed.details.unknown_keys as string[]).length === 1,
    '合法键+未知键混合 ⇒ ok=false 且 unknown_keys=[\'foo\']（整请求拒，合法字段不落库）',
    mixed.ok ? 'ok=true' : JSON.stringify({ unknown_keys: mixed.details.unknown_keys }));
  const mixed2 = validateSystemSettingsPatch({ siteName: 'X', foo: 1, fee_rate: 2, bar: 3 });
  t('E2', 'AG4', mixed2.ok === false && (mixed2.details.unknown_keys as string[]).length === 3,
    '3 个未知键**逐键列出**', mixed2.ok ? 'ok=true' : JSON.stringify(mixed2.details.unknown_keys));
}

// ==================================================================== F · 正例
{
  const full = {
    siteName: 'Seafood Club', siteDescription: 'x', maintenance: false, allowRegistration: true,
    emailNotifications: true, defaultLanguage: 'zh', pointsPerTask: 100, maxDailyTasks: 10, rewardCooldown: 24,
  };
  const vf = validateSystemSettingsPatch(full);
  t('F1', 'positive', vf.ok === true && JSON.stringify(Object.keys(vf.ok ? vf.value : {})).length > 0,
    'ok=true（全量合法）', vf.ok ? `ok=true keys=${Object.keys(vf.value).length}` : 'ok=false');
  const vp = validateSystemSettingsPatch({ maintenance: true });
  t('F2', 'positive', vp.ok === true && Object.keys(vp.ok ? vp.value : {}).length === 1 && vp.ok === true && vp.value.maintenance === true,
    "ok=true 且只含给定字段（不补默认值）", vp.ok ? JSON.stringify(vp.value) : 'ok=false');
  const ve = validateSystemSettingsPatch({});
  t('F3', 'positive', ve.ok === true, 'ok=true（空补丁合法）', ve.ok ? 'ok=true' : 'ok=false');
}

// ==================================================================== G · 写侧不得静默吸收（类级源码断言）
{
  t('G1', 'noSilentAbsorb', INDEX_TS.includes('screenSystemSettingsWrite('),
    '路由层调用 screenSystemSettingsWrite（AG1/AG3/AG4 门禁）', INDEX_TS.includes('screenSystemSettingsWrite('));
  const start = DATABASE_TS.indexOf('static async saveSystemSettings(');
  const after = DATABASE_TS.indexOf('static async ', start + 10);
  const saveFn = DATABASE_TS.slice(start, after > start ? after : start + 1200);
  t('G2', 'noSilentAbsorb', saveFn.includes('assertSystemSettingsPatch('),
    'saveSystemSettings 调 assertSystemSettingsPatch（严格断言）', saveFn.includes('assertSystemSettingsPatch('));
  const oldNameHits = SRC_FILES.filter((f) => /\bnormalizeSystemSettings\s*\(/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(REPO_ROOT, f));
  t('G3', 'noSilentAbsorb', oldNameHits.length === 0,
    '旧静默吸收函数 normalizeSystemSettings( 零命中（已改写为 Read/Strict 二分）', JSON.stringify(oldNameHits));
}

// ==================================================================== 结论
const failed = checks.filter((c) => !c.pass);
const report = {
  unit: 'P8-S1-APP-CONFIG-GATE',
  generated_at: new Date().toISOString(),
  run: RUN,
  offline: true,
  db_connections: 0,
  http_calls: 0,
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  checks,
};
const text = JSON.stringify(report, null, 1);
fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
console.log(text);
console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
if (failed.length) process.exit(1);
