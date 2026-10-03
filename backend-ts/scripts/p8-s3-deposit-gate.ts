/**
 * 批 8③（`data-layer.spec` v0.12 §23 · `route-layer.spec` v2.5 §20）：
 * **上市保证金「金额可配置」（仅 (a) 可配置 —— `R-8-17` 已作废 (b) 退市退还）** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s3-artifacts/p8s3-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / spec 文本）—— 同「离线 126/126 套件」族。
 *
 * 判据（每条**可判负**）：
 *   A  **`AK2` 入册**：代码常量恰好 2 键、**与 spec §21.1 ∪ §23.1 逐字一致**；注释块同轮改（不再写「恰好 1 个」）；
 *      `AK1` 值对象字段仍恰 9 个（**`AK2` 不复用为第 10 个字段**）
 *   B  **★ 键 ≠ 字段（两条判负）**：把 `AK2` 当 `AK1` 第 10 个字段塞进写口 body ⇒ **必拒**（`AG1` 未知键）；
 *      合法键 + `AK2` 混合体 ⇒ **整请求拒**
 *   C  **`AK2` 值规格**（`AG3`(ii) 字段层）：字段恰 `{amount: number}`；读侧解析**不发明 / 不隐式转换**
 *   D  **★ 下限 fail-closed 有效**（`route-layer.spec` §20.7）：读不到 / 非法 ⇒ **回落常量**；合法键值 ⇒ 用键值；
 *      常量标 `TODO: Kevin 定值`；`currency-service` **确实先读 `AK2`**
 *   E  **★ 无退还 / 罚没面（`R-8-17` 禁线）**：零新增路由（注册点仍 69 · **★ `R-8-20`：计数判据容忍
 *      **前置空白**（行局部 `^[ \t]*app\.` = 裁定所写 `^\s*` 的同义形）—— **缩进路由仍计入**），
 *      附**负对照 E1b**「以 2 空格缩进插入一条路由 ⇒ 计数必须 +1」；`hold_forfeit` / `hold_release` /
 *      `unfreeze` / `listing_deposit_refund` **不得**挂上上市保证金面；零新增迁移
 *   F  **`AG2` 不变**：写 `app_config` 语句仍**唯一**且落在 `saveSystemSettings`；`AK2` 读口**只读**
 *   G  **门自证（负对照）**：若干判据谓词喂错值 ⇒ **必须转红**（不转红 = 假门）
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  APP_CONFIG_LEGAL_KEYS,
  SYSTEM_SETTINGS_FIELDS,
  validateSystemSettingsPatch,
  LISTING_DEPOSIT_POLICY_FIELD_TYPES,
  LISTING_DEPOSIT_POLICY_FIELDS,
  parseListingDepositPolicyAmount,
  SETTINGS_WRITE_REASONS,
} from '../src/database';
import { CURRENCY_LIST_DEPOSIT_FLOOR, resolveListingDepositFloor } from '../src/currency-service';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s3-artifacts', `p8s3-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};
/** 门自证：谓词喂「故意错」的输入 ⇒ 必须返 false（不转红 = 假门，§20.4(c)-⑥ 口径）。 */
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, expect: string): void => {
  const fired = predicate(wrongInput) === false;
  checks.push({ id: `${id}__selftest`, group: `${group}SelfTest`, pass: fired, expect, actual: JSON.stringify({ wrong_input: wrongInput, judge_fired: fired }) });
};

// ---------------------------------------------------------------- 冻结常量
/** §21.1 ∪ §23.1 ∪ §29.2(B)（逐字 · spec 侧期望 · 恰 9 键）。 */
const FROZEN_LEGAL_KEYS = ['system_settings', 'listing_deposit_policy', 'batt_policy', 'checkin_policy', 'invite_reward_policy', 'mint_burn_policy', 'rating_policy', 'site_text_overrides', 'role_names'];
/** §21.1 `AK1` 值对象 9 字段（逐字冻结 · 与 p8-s1 门同源）。 */
const FROZEN_AK1_FIELDS = [
  'siteName', 'siteDescription', 'maintenance', 'allowRegistration', 'emailNotifications',
  'defaultLanguage', 'pointsPerTask', 'maxDailyTasks', 'rewardCooldown',
];
const AK2_KEY = 'listing_deposit_policy';
const REG_POINTS_FROZEN = 76;
/**
 * ★ `R-8-20`（本片新裁）注册点计数判据 —— **容忍前置空白**。
 * 改前判据 `^app\.` 写死**列 0** ⇒ **带缩进插入的路由不被计入**（缩进路由**仍是已注册路由**！）
 * = `v4` 暴露的**判据射程缺口**。升级为行局部 `^[ \t]*app\.`（= 裁定所写 `^\s*` 的**同义行局部形**，
 * 避免 `\s` 跨行贪婪吞并空行 ⇒ 计数虚增/错配）。附负对照 E1b 常态化验证「缩进路由必计数」。
 */
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const MIGRATIONS_FROZEN = 26;
const ENVELOPE_FIELDS = ['create_key', 'idempotency_key', 'idempotencyKey'];

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const walkTs = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '').replace(/\/\/[^\n]*$/gm, '');

const SRC_DIR = path.resolve(REPO_ROOT, 'backend-ts', 'src');
const SRC_FILES = walkTs(SRC_DIR);
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const DATABASE_CODE = stripComments(DATABASE_TS);
const CURRENCY_TS = readSrc('backend-ts/src/currency-service.ts');
const CURRENCY_CODE = stripComments(CURRENCY_TS);
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const SPEC_DATA = readSrc('docs/data-layer.spec.md');
const SPEC_ROUTE = readSrc('docs/route-layer.spec.md');

// ============================================================================
// A · AK2 入册（清单恰 2 键 · 与 spec 一致 · AK1 字段集不动）
// ============================================================================
const akSpecKeys = [...SPEC_DATA.matchAll(/^\| \*\*`AK\d+`\*\* \| \*\*`([a-z_]+)`\*\*/gm)].map((m) => m[1]);
// ★ P9①（§29.2(B)）：`B1`–`B7` 候选键行（表体格式 `| B<d> | **`<key>`** | …`）—— 与 `AK*` 行合并 = 现取 9 键。
const bSpecKeys = [...SPEC_DATA.matchAll(/^\| B\d+ \| \*\*`([a-z_]+)`\*\*/gm)].map((m) => m[1]);
const specKeys = [...new Set([...akSpecKeys, ...bSpecKeys])];
t('A1', 'ak2Registered', JSON.stringify([...APP_CONFIG_LEGAL_KEYS]) === JSON.stringify(FROZEN_LEGAL_KEYS),
  `代码常量 APP_CONFIG_LEGAL_KEYS = ${JSON.stringify(FROZEN_LEGAL_KEYS)}（恰 9 键）`, JSON.stringify([...APP_CONFIG_LEGAL_KEYS]));
t('A2', 'ak2Registered',
  JSON.stringify([...specKeys].sort()) === JSON.stringify([...FROZEN_LEGAL_KEYS].sort()) && specKeys.includes(AK2_KEY),
  `spec §21.1 ∪ §23.1 解析出的键集 = ${JSON.stringify([...FROZEN_LEGAL_KEYS].sort())}（代码常量与 spec 一致）`,
  JSON.stringify({ specKeys, sorted: [...specKeys].sort() }));
t('A3', 'ak2Registered',
  JSON.stringify([...APP_CONFIG_LEGAL_KEYS].slice().sort()) === JSON.stringify([...specKeys].slice().sort()),
  '代码常量键集 == spec 键集（逐字一致 · 跨册同步）',
  JSON.stringify({ code: [...APP_CONFIG_LEGAL_KEYS].sort(), spec: [...specKeys].sort() }));
t('A4', 'ak2Registered', /顶层合法键（`app_config\.key` 取值）\*\*恰好 9 个\*\*/.test(DATABASE_TS) && !DATABASE_TS.includes('恰好 1 个') && !DATABASE_TS.includes('恰好 2 个'),
  '注释块同轮更新：写「恰好 9 个」、**不再写**「恰好 1 个」/「恰好 2 个」（注释即证据源 · AR6）',
  JSON.stringify({ has9: /恰好 9 个/.test(DATABASE_TS), has1: DATABASE_TS.includes('恰好 1 个'), has2: DATABASE_TS.includes('恰好 2 个') }));
t('A5', 'ak2Registered', JSON.stringify([...SYSTEM_SETTINGS_FIELDS]) === JSON.stringify(FROZEN_AK1_FIELDS),
  `AK1 值对象字段仍恰 9 个（逐字冻结 · 未被 AK2 污染）`, JSON.stringify([...SYSTEM_SETTINGS_FIELDS]));
t('A6', 'ak2Registered',
  !(SYSTEM_SETTINGS_FIELDS as readonly string[]).includes(AK2_KEY) && !Object.prototype.hasOwnProperty.call(LISTING_DEPOSIT_POLICY_FIELD_TYPES, AK2_KEY),
  '★ 键 ≠ 字段：`AK2` **不在** `SYSTEM_SETTINGS_FIELD_TYPES`（AK1）之内',
  JSON.stringify({ inAk1: (SYSTEM_SETTINGS_FIELDS as readonly string[]).includes(AK2_KEY) }));
t('A7', 'ak2Registered', /\| \*\*`AK2`\*\* \| \*\*`listing_deposit_policy`\*\*/.test(SPEC_DATA),
  'spec §23.1 有 AK2 行且键名逐字 = `listing_deposit_policy`',
  /\| \*\*`AK2`\*\* \|[^\n]{0,40}/.exec(SPEC_DATA)?.[0] ?? '(no AK2 row)');
t('A8', 'ak2Registered', SPEC_ROUTE.includes('`listing_deposit_policy`') && SPEC_ROUTE.includes('§20') && SPEC_DATA.includes('§23'),
  '姊妹册 route v2.5 §20 与 data-layer v0.12 §23 均在册（两册互指）',
  JSON.stringify({ route_has_key: SPEC_ROUTE.includes('`listing_deposit_policy`'), data_has_s23: SPEC_DATA.includes('§23') }));

// ============================================================================
// B · ★ 键 ≠ 字段（两条判负 · §23.3 末段两禁令）
// ============================================================================
{
  const v = validateSystemSettingsPatch({ [AK2_KEY]: { amount: 50000 } });
  t('B1', 'keyNotField',
    v.ok === false && v.details.reason === SETTINGS_WRITE_REASONS.unknownKey
    && Array.isArray(v.details.unknown_keys) && (v.details.unknown_keys as string[]).includes(AK2_KEY)
    && v.code === 'LEDGER_AMOUNT_INVALID',
    '把 AK2 当 AK1 第 10 个字段塞进写口 body ⇒ 必拒（ok=false + 稳定常量 reason + unknown_keys 含它）',
    v.ok ? 'ok=true' : JSON.stringify({ code: v.code, reason: v.details.reason, unknown_keys: v.details.unknown_keys }));
  const mixed = validateSystemSettingsPatch({ siteName: 'X', [AK2_KEY]: { amount: 1 } });
  t('B2', 'keyNotField',
    mixed.ok === false && Array.isArray(mixed.details.unknown_keys) && (mixed.details.unknown_keys as string[]).length === 1
    && (mixed.details.unknown_keys as string[])[0] === AK2_KEY,
    '合法 AK1 字段 + AK2（当字段）混合体 ⇒ **整请求拒**（unknown_keys 恰 [AK2]）',
    mixed.ok ? 'ok=true' : JSON.stringify({ unknown_keys: mixed.details.unknown_keys }));
}

// ============================================================================
// C · AK2 值规格（字段层 · 读侧解析不发明 / 不隐式转换）
// ============================================================================
t('C1', 'ak2Spec', JSON.stringify(LISTING_DEPOSIT_POLICY_FIELD_TYPES) === JSON.stringify({ amount: 'number' }),
  'AK2 值对象逐字段规格 = { amount: "number" }（§23.3 AG3(ii) 字段层）', JSON.stringify(LISTING_DEPOSIT_POLICY_FIELD_TYPES));
t('C2', 'ak2Spec', JSON.stringify([...LISTING_DEPOSIT_POLICY_FIELDS]) === JSON.stringify(['amount']),
  'AK2 合法字段名（关闭集）= ["amount"]', JSON.stringify([...LISTING_DEPOSIT_POLICY_FIELDS]));
t('C3', 'ak2Spec', parseListingDepositPolicyAmount({ amount: 123456 }) === 123456,
  '解析：正整数金额 ⇒ 原样返回（不发明数值）', JSON.stringify(parseListingDepositPolicyAmount({ amount: 123456 })));
{
  // ★ 判负形态：字符串型金额 / 非 object / 非正整数 / 多余字段仍须「取不到」⇒ null（供 fail-closed）
  const bads: Array<[string, unknown, string]> = [
    ['C4', { amount: '50000' }, '字符串型金额 "50000"（无下游转换）⇒ null'],
    ['C5', null, 'null ⇒ null'],
    ['C6', [1, 2], '数组 ⇒ null'],
    ['C7', 5, '裸标量 ⇒ null'],
    ['C8', { amount: 0 }, 'amount = 0 ⇒ null（须正整数）'],
    ['C9', { amount: -5 }, 'amount = -5 ⇒ null'],
    ['C10', { amount: 1.5 }, 'amount = 1.5（非整数）⇒ null'],
    ['C11', { foo: 1 }, '无 `amount` 字段 ⇒ null'],
    ['C12', { amount: 100, balance: 100 }, '夹带清单外字段 `balance`（§23.8 禁形）⇒ null（关闭集外 ⇒ fail-closed）'],
  ];
  for (const [id, input, expect] of bads) {
    const got = parseListingDepositPolicyAmount(input);
    t(id, 'ak2Spec', got === null, expect, JSON.stringify(got));
  }
}

// ============================================================================
// D · ★ 下限 fail-closed 有效（§20.7）
// ============================================================================
{
  const d1 = resolveListingDepositFloor(null);
  t('D1', 'failClosed', d1.floor === CURRENCY_LIST_DEPOSIT_FLOOR && d1.source === 'constant',
    `读不到（null）⇒ **回落常量** ${CURRENCY_LIST_DEPOSIT_FLOOR}（source=constant）`, JSON.stringify(d1));
  const d2 = resolveListingDepositFloor({ amount: 77777 });
  t('D2', 'failClosed', d2.floor === 77777 && d2.source === 'config',
    '合法键值（{amount:77777}）⇒ 用键值（source=config）', JSON.stringify(d2));
  const d3 = resolveListingDepositFloor({ amount: '77777' });
  t('D3', 'failClosed', d3.floor === CURRENCY_LIST_DEPOSIT_FLOOR && d3.source === 'constant',
    '值非法（字符串金额）⇒ **fail-closed 到常量**（**不是** fail-open 到该串）', JSON.stringify(d3));
  const d4 = resolveListingDepositFloor({});
  t('D4', 'failClosed', d4.floor === CURRENCY_LIST_DEPOSIT_FLOOR && d4.source === 'constant',
    '值非法（缺 amount）⇒ fail-closed 到常量', JSON.stringify(d4));
  t('D5', 'failClosed', /TODO: Kevin 定值/.test(CURRENCY_TS),
    '兜底常量标 `TODO: Kevin 定值`（**不得发明数值**）', /TODO: Kevin 定值/.test(CURRENCY_TS));
  t('D6', 'failClosed',
    /DatabaseService\.getListingDepositPolicyValue\(/.test(CURRENCY_CODE) && /resolveListingDepositFloorFromDb/.test(CURRENCY_CODE)
    && /catch\s*\{/.test(CURRENCY_CODE),
    '`currency-service` **确实先读 AK2**（`getListingDepositPolicyValue` + `resolveListingDepositFloorFromDb` + try/catch 兜底）',
    JSON.stringify({
      reads: /DatabaseService\.getListingDepositPolicyValue\(/.test(CURRENCY_CODE),
      wrapper: /resolveListingDepositFloorFromDb/.test(CURRENCY_CODE),
    }));
  t('D7', 'failClosed', /CURRENCY_LIST_DEPOSIT_FLOOR\s*=\s*50000/.test(CURRENCY_TS),
    '常量形态保持单点（值 = 50000 = **现取读数**，非本单发明）', /CURRENCY_LIST_DEPOSIT_FLOOR\s*=\s*\d+/.exec(CURRENCY_TS)?.[0] ?? '(none)');
  // 自证：把「按键值 + 来源=config」当判据 ⇒ 喂常量情形必须转红
  selfTest('D1', 'failClosed', (v) => JSON.stringify(v) === JSON.stringify({ floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'constant' }),
    { floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'config' }, '把「常量兜底」误记为 config ⇒ 谓词必须转红');
}

// ============================================================================
// E · ★ 无退还 / 罚没面（R-8-17 禁线 · 类级）
// ============================================================================
{
  const regCount = countRoutes(INDEX_TS);
  t('E1', 'noRefundSurface', regCount === REG_POINTS_FROZEN,
    `注册点仍 = ${REG_POINTS_FROZEN}（本片**零新增对外路径** · 不新增 delist 路由 · \`R-8-20\` 计数**容忍前置空白**）`, regCount);
  {
    // ★ R-8-20 负对照（常态化）：把「以 2 空格缩进插入一条路由」作为**必判负谓词** ——
    //   升级判据**必须 +1**；并同轮**反证**旧「列 0」判据对该注入**不**增计（= v4 盲区复现）。
    const INJ = "  app.get('/api/p8s3-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
    const injected = INDEX_TS + INJ;
    const nUpgraded = countRoutes(injected);
    const nLegacyColumn0 = (injected.match(/^app\.(get|post|put|delete|patch)\(/gm) || []).length;
    t('E1b', 'noRefundSurface',
      nUpgraded === REG_POINTS_FROZEN + 1 && nLegacyColumn0 === REG_POINTS_FROZEN,
      `★ R-8-20 负对照：2 空格缩进插入一条路由 ⇒ 升级判据计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}（旧列 0 判据仍 = ${REG_POINTS_FROZEN} = v4 盲区复现）`,
      JSON.stringify({ upgraded: nUpgraded, legacy_column0: nLegacyColumn0 }));
  }
  const delistRoute = /^[ \t]*app\.(get|post|put|delete|patch)\([^)]*delist/mi.test(INDEX_TS);
  t('E2', 'noRefundSurface', delistRoute === false,
    '**无** delist 一族路由（`R-8-17`：退市退还作废 ⇒ 不得新增入口 · `R-8-20` 容忍前置空白）', delistRoute);
  t('E3', 'noRefundSurface', !/listing_deposit_refund/.test(SRC_FILES.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n')),
    'kind 名 `listing_deposit_refund` **零命中**（不复活已删名 · `R-8-2`）',
    (SRC_FILES.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n').match(/listing_deposit_refund/g) || []).length);
  t('E4', 'noRefundSurface',
    !/unfreeze\s*\(|hold_release/.test(CURRENCY_CODE),
    '`currency-service`（含新 AK2 读路径）**不引用** `unfreeze(` / `hold_release`（**不挂退还面**）',
    JSON.stringify((CURRENCY_CODE.match(/unfreeze\s*\(|hold_release/g) || [])));
  t('E5', 'noRefundSurface', !/hold_forfeit/.test(CURRENCY_CODE),
    '`currency-service` 代码位（去注释）`hold_forfeit` 零命中（禁线）',
    JSON.stringify((CURRENCY_CODE.match(/hold_forfeit/g) || [])));
  const migFiles = fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql'));
  t('E6', 'noRefundSurface', migFiles.length === MIGRATIONS_FROZEN,
    `迁移文件数仍 = ${MIGRATIONS_FROZEN}（**零新增迁移 / 零 DDL** · R-8-5）`, migFiles.length);
  const ak2ReadSql = (DATABASE_CODE.match(/WHERE key = 'listing_deposit_policy'[^\n]*/g) || []);
  t('E7', 'noRefundSurface', ak2ReadSql.length >= 1 && !/INSERT|UPDATE|DELETE/i.test(ak2ReadSql.join(' ')),
    '`AK2` 读 SQL 为**只读 SELECT**（无 INSERT/UPDATE/DELETE）', JSON.stringify(ak2ReadSql));
}

// ============================================================================
// F · AG2 不变（写 app_config 语句唯一 · AK2 读口只读）
// ============================================================================
{
  const writeRe = /(INSERT INTO public\.app_config|UPDATE public\.app_config)/g;
  const hits: Array<{ file: string; stmt: string; offset: number }> = [];
  for (const f of SRC_FILES) {
    const text = stripComments(fs.readFileSync(f, 'utf8'));
    let m: RegExpExecArray | null;
    writeRe.lastIndex = 0;
    while ((m = writeRe.exec(text))) hits.push({ file: path.relative(REPO_ROOT, f), stmt: m[0], offset: m.index });
  }
  t('F1', 'ag2Invariant', hits.length === 1 && hits[0].file === 'backend-ts/src/database.ts' && hits[0].stmt === 'INSERT INTO public.app_config',
    '写 `app_config` 语句仍**唯一**（database.ts · 1 处 INSERT）', JSON.stringify(hits.map((h) => [h.file, h.stmt])));
  const start = DATABASE_CODE.indexOf('static async saveSystemSettings(');
  const after = DATABASE_CODE.indexOf('static async ', start + 10);
  const end = after > start ? after : DATABASE_CODE.length;
  t('F2', 'ag2Invariant', start > 0 && hits.length === 1 && hits[0].offset >= start && hits[0].offset < end,
    '唯一写入语句仍落在 `saveSystemSettings` 方法体内',
    `save=[${start},${end}) hit=${hits.length ? hits[0].offset : -1}`);
  t('F3', 'ag2Invariant', /getListingDepositPolicyValue\(/.test(DATABASE_CODE) && /static async getListingDepositPolicyValue\(/.test(DATABASE_CODE),
    '`AK2` 读口 `getListingDepositPolicyValue` 落在 database.ts（读侧独立方法）',
    /static async getListingDepositPolicyValue\(/.test(DATABASE_CODE));
  t('F4', 'ag2Invariant', !/LIST_CURRENCY_WITH_DEPOSIT_SQL[\s\S]{0,40}app_config/.test(DATABASE_CODE),
    '上市语句（`LIST_CURRENCY_WITH_DEPOSIT_SQL`）**不触碰** `app_config`（上市只写 currency / status_log / 账本）',
    /app_config/.test(DATABASE_CODE.slice(DATABASE_CODE.indexOf('LIST_CURRENCY_WITH_DEPOSIT_SQL'), DATABASE_CODE.indexOf('LIST_CURRENCY_WITH_DEPOSIT_SQL') + 2600)));
}

// ============================================================================
// G · 门自证（负对照 · 判据谓词喂错值必须转红）
// ============================================================================
selfTest('A1', 'ak2Registered', (v) => JSON.stringify(v) === JSON.stringify(FROZEN_LEGAL_KEYS),
  ['system_settings'], '把清单写成「恰 1 键」⇒ 谓词必须转红（旧值 = 假绿陷阱）');
selfTest('C1', 'ak2Spec', (v) => JSON.stringify(v) === JSON.stringify({ amount: 'number' }),
  { amount: 'string' }, '把字段类型写成 string ⇒ 谓词必须转红');
selfTest('E1', 'noRefundSurface', (v) => v === REG_POINTS_FROZEN, 75, '注册点写成 75（= 偷偷少一条）⇒ 谓词必须转红');

// ==================================================================== 结论
const failed = checks.filter((c) => !c.pass);
const report = {
  unit: 'P8-S3-DEPOSIT-GATE',
  generated_at: new Date().toISOString(),
  run: RUN,
  offline: true,
  db_connections: 0,
  http_calls: 0,
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  readings: {
    legal_keys_code: [...APP_CONFIG_LEGAL_KEYS],
    legal_keys_spec: specKeys,
    ak1_fields: [...SYSTEM_SETTINGS_FIELDS],
    ak2_field_types: LISTING_DEPOSIT_POLICY_FIELD_TYPES,
    deposit_floor_constant: CURRENCY_LIST_DEPOSIT_FLOOR,
    registration_points: countRoutes(INDEX_TS),
    registration_points_legacy_column0: (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) || []).length,
    envelope_fields: ENVELOPE_FIELDS,
  },
  checks,
};
const text = JSON.stringify(report, null, 1);
fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
console.log(text);
console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
process.exit(failed.length ? 1 : 0);
