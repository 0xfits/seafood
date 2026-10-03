/**
 * 批 9 第 1 片（P9① · `route-layer.spec` v2.12 §27 · `data-layer.spec` v0.19 §29/§30）：
 * **站点文案覆盖层 + P9 配置键（后台可配置面）** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s6-site-text-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s6-artifacts/p8s6-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / locale 文本）—— 同「离线 126/126」族。
 * 公开读口「无 token ⇒ 200」= **静态判据**（handler 体内零鉴权调用 ⇒ 请求必达 handler）；
 *   真 HTTP 200 读数另册（受控实例探针，报告 §4/§9）。
 *
 * 判据（每条**可判负**）：
 *   A  **注册点 87 逐 verb + 公开读口在场**：`get 36 / post 48 / put 0 / patch 1 / delete 2`（和 = 87）；
 *      `app.get('/api/role-names', …)` 在场且取数 `DatabaseService.getSiteTextOverlay(`；负对照（缩进注入 ⇒ +1）
 *   B  **公开读口无鉴权（无 token ⇒ 应 200）**：handler 体内**零** `requireAdmin(` / `requireActor(` / `Authorization` /
 *      `token` / 任何 `require*` 闸；零 `resolveAdminOpsKey`（读口无副作用）；负对照（注入闸 ⇒ 谓词转红）
 *   C  **白名单 9 键逐字现取**：`APP_CONFIG_LEGAL_KEYS` 恰 9 键逐字；9 键皆过 `AV1`；**清单外键 ⇒ 拒**（稳定常量 reason）；
 *      「**在册 ≠ 可写**」仍成立（入册键仍须过 `AV2`–`AV4`）；负对照（2 键清单 ⇒ 谓词转红）
 *   D  **覆盖层字段 / 语言闭集逐字**：`role_names` 四角色 / `site_text_overrides` 三键 / 四语闭集
 *   E  **`AV2`–`AV4`（`validateOverlayValue`）四语键集相等 + 缺语 fail-closed**：合法 ⇒ 过；缺语 / 多语 / 未知字段 /
 *      非 object / 空串 ⇒ 逐条判负；部分补丁（缺字段）合法；负对照
 *   F  **读侧 fail-closed（`parseRoleNamesOverride` / `parseSiteTextOverridesOverlay`）**：合法 ⇒ 解析；缺语 / 多语 /
 *      未知字段 / 非 object ⇒ `null`（调用方回落 locale 基值，**绝不空串**）；负对照
 *   G  **数值策略键（`B1`–`B5`）`AV2`–`AV4`**:`rating_policy` / `batt_policy` 合法 ⇒ 过；域外 / 清单外键 ⇒ 拒（零新增码）
 *   H  **四语键齐 + 六类泄漏 = 0**：`roleNames` / `siteSlogan` / `adminRoleNames` / `adminSiteText` + `adminNav` 新 2 键；
 *      en/vn 无 CJK、hk 繁體
 *   I  **`adminNav` 冻结计数 = 28 三处同步现取**：`p8-s5` `NAV_KEYS_FROZEN` / `p8-s2` `NS_KEYS.adminNav` /
 *      `b4a` `NEW_NS.adminNav`（沿 `R-8-22`；未删任何断言）
 *   J  **零新增错误码**：闭集仍恰 33；覆盖层/数值面只用既有 `SETTINGS_WRITE_REASONS` 三常量
 *   K  **门自证（负对照）**：若干判据谓词喂错值 ⇒ **必须转红**（不转红 = 假门）
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  APP_CONFIG_LEGAL_KEYS,
  ROLE_NAMES_KEY,
  SITE_TEXT_OVERRIDES_KEY,
  ROLE_NAME_FIELDS,
  SITE_TEXT_FIELDS,
  OVERLAY_LANGS,
  SETTINGS_WRITE_REASONS,
  validateAppConfigKey,
  validateAppConfigValue,
  validateOverlayValue,
  validateNumericPolicyValue,
  parseRoleNamesOverride,
  parseSiteTextOverridesOverlay,
} from '../src/database';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s6-artifacts', `p8s6-${RUN}`);
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
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number =>
  (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const PER_VERB_FROZEN: Record<string, number> = { get: 36, post: 48, put: 0, patch: 1, delete: 2 };
/** 白名单 9 键逐字（顺序 = 代码面 `APP_CONFIG_LEGAL_KEYS`）。 */
const WHITELIST_FROZEN = ['system_settings', 'listing_deposit_policy', 'batt_policy', 'checkin_policy', 'invite_reward_policy', 'mint_burn_policy', 'rating_policy', 'site_text_overrides', 'role_names'];
const WELL_KNOWN_REASONS = new Set(Object.values(SETTINGS_WRITE_REASONS));

const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const S5_GATE = readSrc('backend-ts/scripts/p8-s5-compliance-gate.ts');
const S2_GATE = readSrc('backend-ts/scripts/p8-s2-fee-rebate-gate.ts');
const B4A_TEST = readSrc('frontend/src/test/unit/i18n-batch-b4a.test.jsx');

const LANGS = ['zh', 'en', 'hk', 'vn'];
const LOCALES: Record<string, Record<string, unknown>> = Object.fromEntries(LANGS.map((l) => [
  l, JSON.parse(readSrc(`frontend/src/locales/${l}.json`)),
]));

/** 提取 `app.<verb>(<path>', …` 起至下一个 `\n});` 的路由体（找不到 ⇒ ''）。 */
const routeBlock = (declRe: RegExp): string => {
  const m = declRe.exec(INDEX_TS);
  if (!m) return '';
  const end = INDEX_TS.indexOf('\n});', m.index);
  return end === -1 ? INDEX_TS.slice(m.index) : INDEX_TS.slice(m.index, end + 4);
};
const roleNamesDecl = /^[ \t]*app\.get\('\/api\/role-names',/m;
const roleNamesBlock = routeBlock(roleNamesDecl);

/** ★ 公开读口「无鉴权」谓词：handler 体内零鉴权闸 / 零 token 读取 / 零写副作用（读口）。 */
const isUnauthenticatedRead = (block: string): boolean =>
  !/\brequire(Admin|Actor|User|Role|Permission)\s*\(/.test(block)
  && !/Authorization|Bearer|\btoken\b/i.test(block)
  && !/resolveAdminOpsKey|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i.test(block)
  && /DatabaseService\.getSiteTextOverlay\(/.test(block)
  && /sendSuccess\(/.test(block);

// ============================================================================
// A · 注册点 80 逐 verb + 公开读口在场
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
    `注册点 = ${REG_POINTS_FROZEN}（P9① 公开读口 +1〔75→76〕⇒ P9② batt/签到 4 新口 +4〔76→80〕⇒ P9③ 评分/时效/订单 5 新口 +5〔80→85〕⇒ P9④ BTTC 铸造/分解 2 新口 +2〔85→87〕）`, countRoutes(INDEX_TS));
  t('A2', 'registration', JSON.stringify(perVerb) === JSON.stringify(PER_VERB_FROZEN),
    `逐 verb 逐字 = ${JSON.stringify(PER_VERB_FROZEN)}`, JSON.stringify(perVerb));
  t('A3', 'registration', Object.values(perVerb).reduce((a, b) => a + b, 0) === REG_POINTS_FROZEN,
    '逐 verb 计数之和 = 注册点总数', JSON.stringify(perVerb));
  t('A4', 'registration', roleNamesDecl.test(INDEX_TS), '公开读口 `GET /api/role-names` 在场', roleNamesDecl.test(INDEX_TS));
  t('A5', 'registration', /DatabaseService\.getSiteTextOverlay\(/.test(roleNamesBlock),
    '读口取数 = `DatabaseService.getSiteTextOverlay(`（单一真源 · 无副作用）', /getSiteTextOverlay\(/.test(roleNamesBlock));
  t('A6', 'registration', /sendSuccess\(res,/.test(roleNamesBlock), '读口成功面 = `sendSuccess(res, …)`', /sendSuccess\(res,/.test(roleNamesBlock));
  t('A7', 'registration', /sendInfraMapped\(res, 'roleNames\.get',/.test(roleNamesBlock),
    '读口基础设施异常 ⇒ 既有 §14 分类器（`roleNames.get`）', /sendInfraMapped\(res, '[^']*'/.exec(roleNamesBlock)?.[0] ?? '(none)');
  const INJ = "  app.get('/api/p8s6-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  t('A8', 'registration', countRoutes(INDEX_TS + INJ) === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`,
    JSON.stringify({ injected: countRoutes(INDEX_TS + INJ) }));
}

// ============================================================================
// B · 公开读口无鉴权（无 token ⇒ 应 200 · 静态判据）
// ============================================================================
{
  t('B1', 'publicRead', roleNamesBlock.length > 0 && isUnauthenticatedRead(roleNamesBlock),
    '★ handler 体内**零鉴权闸**（无 `requireAdmin(` / `requireActor(` / `Authorization` / `token`）⇒ 无 token 请求必达 handler ⇒ 应 200',
    JSON.stringify({
      block_bytes: roleNamesBlock.length,
      requireGuard: /\brequire(Admin|Actor|User|Role|Permission)\s*\(/.test(roleNamesBlock),
      tokenRead: /Authorization|Bearer|\btoken\b/i.test(roleNamesBlock),
      sideEffect: /resolveAdminOpsKey|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i.test(roleNamesBlock),
      unauthenticated_read: isUnauthenticatedRead(roleNamesBlock),
    }));
  t('B2', 'publicRead', /^[ \t]*app\.get\('\/api\/role-names',/m.test(roleNamesBlock) && !/app\.post\('\/api\/role-names'/.test(INDEX_TS),
    'read口 = GET（无 POST 孪生读口）', JSON.stringify({ get: roleNamesDecl.test(roleNamesBlock), post: /app\.post\('\/api\/role-names'/.test(INDEX_TS) }));
  // ★ 负对照：把鉴权闸注入 handler ⇒ 谓词转红
  const withGuard = roleNamesBlock.replace('try {', "const actor = await requireAdmin(req, res, 'manage_settings');\n  if (!actor) return;\n  try {");
  t('B3', 'publicRead', isUnauthenticatedRead(roleNamesBlock) && !isUnauthenticatedRead(withGuard),
    '★ 负对照：给公开读口**注入鉴权闸** ⇒ 「无鉴权」谓词转红',
    JSON.stringify({ original: isUnauthenticatedRead(roleNamesBlock), with_guard: isUnauthenticatedRead(withGuard) }));
  selfTest('B1', 'publicRead', (v) => isUnauthenticatedRead(String(v)),
    "app.get('/api/role-names', async (req, res) => {\n  const actor = await requireAdmin(req, res, 'manage_settings');\n  if (!actor) return;\n  const overlay = await DatabaseService.getSiteTextOverlay();\n  sendSuccess(res, overlay);\n});",
    '把「带鉴权闸」的 handler 喂入 ⇒ 谓词必须转红');
}

// ============================================================================
// C · 白名单 9 键逐字现取 + 「在册 ≠ 可写」
// ============================================================================
{
  t('C1', 'whitelist', APP_CONFIG_LEGAL_KEYS.length === 9, '`app_config` 顶层合法键恰 9 键', APP_CONFIG_LEGAL_KEYS.length);
  t('C2', 'whitelist', JSON.stringify([...APP_CONFIG_LEGAL_KEYS]) === JSON.stringify(WHITELIST_FROZEN),
    `白名单逐字 = ${JSON.stringify(WHITELIST_FROZEN)}`, JSON.stringify([...APP_CONFIG_LEGAL_KEYS]));
  const perKey = WHITELIST_FROZEN.map((k) => validateAppConfigKey(k).ok);
  t('C3', 'whitelist', perKey.every(Boolean), '9 键**逐键**皆过 `AV1`（validateAppConfigKey ⇒ ok）', JSON.stringify(perKey));
  const bad = validateAppConfigKey('made_up_key');
  t('C4', 'whitelist', bad.ok === false && bad.details.reason === SETTINGS_WRITE_REASONS.unknownKey
    && JSON.stringify(bad.details.legal_keys) === JSON.stringify(WHITELIST_FROZEN),
    '清单外键 ⇒ 拒（reason = 稳定常量 `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` + `legal_keys` = 9 键）',
    bad.ok ? 'ok=true' : JSON.stringify({ reason: bad.details.reason, legal_keys: bad.details.legal_keys }));
  // ★ 「在册 ≠ 可写」：入册键仍须过 `AV2`–`AV4`（role_names 合法准入 ⇒ 值非法仍拒）
  const inListButBadValue = validateAppConfigValue(ROLE_NAMES_KEY, { poster: { zh: 'x', en: 'y' } });
  t('C5', 'whitelist', validateAppConfigKey(ROLE_NAMES_KEY).ok === true && inListButBadValue.ok === false,
    '★ 「在册 ≠ 可写」：`role_names` 过 `AV1`（在册）但仍须过 `AV2`–`AV4`（缺语值 ⇒ 拒）',
    JSON.stringify({ av1_ok: validateAppConfigKey(ROLE_NAMES_KEY).ok, av_value_ok: inListButBadValue.ok }));
  selfTest('C2', 'whitelist', (v) => JSON.stringify(v) === JSON.stringify(WHITELIST_FROZEN),
    ['system_settings', 'listing_deposit_policy'], '把「白名单退回 2 键」喂入 ⇒ 谓词必须转红');
}

// ============================================================================
// D · 覆盖层字段 / 语言闭集逐字
// ============================================================================
{
  t('D1', 'overlayShape', ROLE_NAMES_KEY === 'role_names' && SITE_TEXT_OVERRIDES_KEY === 'site_text_overrides',
    '两覆盖层键名常量逐字 = `role_names` / `site_text_overrides`',
    JSON.stringify({ role: ROLE_NAMES_KEY, site: SITE_TEXT_OVERRIDES_KEY }));
  t('D2', 'overlayShape', JSON.stringify([...ROLE_NAME_FIELDS]) === JSON.stringify(['poster', 'worker', 'seller', 'buyer']),
    '`role_names` 字段闭集 = 显式四角色（禁任意 i18n 键）', JSON.stringify([...ROLE_NAME_FIELDS]));
  t('D3', 'overlayShape', JSON.stringify([...SITE_TEXT_FIELDS]) === JSON.stringify(['siteTitle', 'siteSlogan', 'slogan']),
    '`site_text_overrides` 字段闭集 = 显式三键（禁任意 i18n 键）', JSON.stringify([...SITE_TEXT_FIELDS]));
  t('D4', 'overlayShape', JSON.stringify([...OVERLAY_LANGS]) === JSON.stringify(LANGS),
    '覆盖层语言闭集 = 四语 `zh/en/hk/vn`（四语键集必须相等）', JSON.stringify([...OVERLAY_LANGS]));
}

// ============================================================================
// E · AV2–AV4（validateOverlayValue）四语键集相等 + 缺语 fail-closed
// ============================================================================
const fourLang = (v: string) => ({ zh: `${v}zh`, en: `${v}en`, hk: `${v}hk`, vn: `${v}vn` });
{
  const goodRole = { poster: fourLang('p'), worker: fourLang('w'), seller: fourLang('s'), buyer: fourLang('b') };
  const e1 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, goodRole);
  t('E1', 'overlayAV', e1.ok === true, '合法覆盖层（四角色 × 四语齐）= 过', e1.ok ? 'ok=true' : JSON.stringify(e1));
  const missing = { poster: { zh: 'p', en: 'e', hk: 'h' } }; // 缺 vn
  const e2 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, missing);
  t('E2', 'overlayAV', e2.ok === false && String(e2.details.field).startsWith('poster.') && e2.details.reason === SETTINGS_WRITE_REASONS.typeInvalid,
    '★ **缺语 ⇒ fail-closed 拒**（`poster` 缺 `vn` ⇒ ok=false · reason = typeInvalid）',
    e2.ok ? 'ok=true' : JSON.stringify({ field: e2.details.field, reason: e2.details.reason }));
  const extra = { poster: { zh: 'p', en: 'e', hk: 'h', vn: 'v', jp: 'j' } };
  const e3 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, extra);
  t('E3', 'overlayAV', e3.ok === false && e3.details.reason === SETTINGS_WRITE_REASONS.unknownKey,
    '★ 多语（`jp`）⇒ 拒（reason = unknownKey · legal_keys = 四语闭集）',
    e3.ok ? 'ok=true' : JSON.stringify({ reason: e3.details.reason, legal_keys: e3.details.legal_keys }));
  const unknownField = { poster: fourLang('p'), ghost: fourLang('g') };
  const e4 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, unknownField);
  t('E4', 'overlayAV', e4.ok === false && e4.details.reason === SETTINGS_WRITE_REASONS.unknownKey,
    '★ 未知字段（`ghost`）⇒ 拒（reason = unknownKey）', e4.ok ? 'ok=true' : JSON.stringify({ reason: e4.details.reason }));
  const e5 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, 'scalar');
  t('E5', 'overlayAV', e5.ok === false && e5.details.reason === SETTINGS_WRITE_REASONS.valueNotObject,
    '★ 非 object（裸标量）⇒ 拒（reason = valueNotObject）', e5.ok ? 'ok=true' : JSON.stringify({ reason: e5.details.reason }));
  const e6 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, { poster: { zh: 'p', en: 'e', hk: 'h', vn: '   ' } });
  t('E6', 'overlayAV', e6.ok === false, '★ 空白串语值 ⇒ 拒（不得空串覆盖）', e6.ok ? 'ok=true' : JSON.stringify({ reason: e6.details?.reason }));
  const e7 = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, { poster: fourLang('p') });
  t('E7', 'overlayAV', e7.ok === true, '部分补丁（仅 `poster` · 缺其余字段）合法（不发明「必填」）', e7.ok ? 'ok=true' : JSON.stringify(e7));
  selfTest('E2', 'overlayAV', (v) => {
    const r = validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, v as Record<string, unknown>);
    return r.ok === false;
  }, { poster: fourLang('p') }, '把「四语齐」的合法值喂入「缺语」谓词 ⇒ 判据必须转红');
}

// ============================================================================
// F · 读侧 fail-closed（parse*：非法 / 缺语 / 多语 ⇒ null ⇒ 前端回落 locale）
// ============================================================================
{
  const good = { poster: fourLang('p'), worker: fourLang('w') };
  t('F1', 'readFailClosed', JSON.stringify(parseRoleNamesOverride(good)) === JSON.stringify(good),
    '合法 `role_names` ⇒ 原样解析（四语齐）', JSON.stringify(parseRoleNamesOverride(good)));
  t('F2', 'readFailClosed', parseRoleNamesOverride({ poster: { zh: 'p', en: 'e', hk: 'h' } }) === null,
    '★ 缺语 ⇒ `null`（前端回落 locale 基值 · 绝不空串）', JSON.stringify(parseRoleNamesOverride({ poster: { zh: 'p', en: 'e', hk: 'h' } })));
  t('F3', 'readFailClosed', parseRoleNamesOverride({ poster: { zh: 'p', en: 'e', hk: 'h', vn: 'v', jp: 'j' } }) === null,
    '★ 多语 ⇒ `null`', JSON.stringify(parseRoleNamesOverride({ poster: { zh: 'p', en: 'e', hk: 'h', vn: 'v', jp: 'j' } })));
  t('F4', 'readFailClosed', parseRoleNamesOverride({ ghost: fourLang('g') }) === null,
    '★ 未知字段 ⇒ `null`', JSON.stringify(parseRoleNamesOverride({ ghost: fourLang('g') })));
  t('F5', 'readFailClosed', parseRoleNamesOverride(42) === null && parseRoleNamesOverride(null) === null,
    '★ 非 object ⇒ `null`', JSON.stringify({ n: parseRoleNamesOverride(42), nil: parseRoleNamesOverride(null) }));
  const goodSite = { siteTitle: fourLang('t'), siteSlogan: fourLang('s') };
  t('F6', 'readFailClosed', JSON.stringify(parseSiteTextOverridesOverlay(goodSite)) === JSON.stringify(goodSite),
    '合法 `site_text_overrides` ⇒ 原样解析', JSON.stringify(parseSiteTextOverridesOverlay(goodSite)));
  t('F7', 'readFailClosed', parseSiteTextOverridesOverlay({ slogan: { zh: 'a', en: 'b', hk: 'c' } }) === null,
    '★ 缺语（`site_text_overrides`）⇒ `null`', JSON.stringify(parseSiteTextOverridesOverlay({ slogan: { zh: 'a', en: 'b', hk: 'c' } })));
  selfTest('F2', 'readFailClosed', (v) => parseRoleNamesOverride(v) === null && Object.keys(v as object).length > 0,
    { poster: fourLang('p') }, '把「四语齐」合法值喂入「缺语 ⇒ null」谓词 ⇒ 判据必须转红');
}

// ============================================================================
// G · 数值策略键（B1–B5）AV2–AV4
// ============================================================================
{
  const g1 = validateNumericPolicyValue('rating_policy', { storageDecimals: 4 });
  t('G1', 'numericPolicy', g1.ok === true, '`rating_policy.storageDecimals = 4` 合法（非负整数）', g1.ok ? 'ok=true' : JSON.stringify(g1));
  const g2 = validateNumericPolicyValue('rating_policy', { displayDecimals: 5 });
  t('G2', 'numericPolicy', g2.ok === false && g2.details.reason === SETTINGS_WRITE_REASONS.typeInvalid,
    '★ 域外（`displayDecimals` 只允许 0）⇒ 拒', g2.ok ? 'ok=true' : JSON.stringify({ reason: g2.details.reason, expected: g2.details.expected }));
  const g3 = validateNumericPolicyValue('batt_policy', { capBatt: -1 });
  t('G3', 'numericPolicy', g3.ok === false, '★ 域外（`capBatt < 0`）⇒ 拒', g3.ok ? 'ok=true' : JSON.stringify({ reason: g3.details?.reason }));
  const g4 = validateNumericPolicyValue('batt_policy', { unknownField: 1 });
  t('G4', 'numericPolicy', g4.ok === false && g4.details.reason === SETTINGS_WRITE_REASONS.unknownKey,
    '★ 清单外字段 ⇒ 拒（reason = unknownKey）', g4.ok ? 'ok=true' : JSON.stringify({ reason: g4.details.reason }));
  const g5 = validateNumericPolicyValue('not_a_policy', { x: 1 });
  t('G5', 'numericPolicy', g5.ok === false && g5.details.reason === SETTINGS_WRITE_REASONS.unknownKey,
    '★ 非策略键 ⇒ 拒（reason = unknownKey · legal_keys = 9 键）', g5.ok ? 'ok=true' : JSON.stringify({ reason: g5.details.reason, legal: g5.details.legal_keys?.length }));
}

// ============================================================================
// H · 四语键齐 + 六类泄漏 = 0
// ============================================================================
const LEAK: Array<[string, RegExp]> = [
  ['章节号/条号', /§|R-\d|DL\d|LD\d/],
  ['HTTP 状态码', /\b(400|401|402|403|404|405|409|410|418|422|429|500|502|503|504)\b/],
  ['接口路径/方法', /\/api\/|\b(GET|POST|PUT|PATCH|DELETE)\b\s*\//],
  ['内部批次名/单号', /8[①②③④⑤⑥]|批\s*8|P6\b|P7\b|P9\b|JING-SPEC|BE-AUDIT/],
  ['机读码/裸 i18n 键', /\b[A-Z][A-Z0-9_]{5,}\b|adminRoleNames\.|adminSiteText\.|roleNames\.|ledger\.err\./],
  ['表名/列名/函数名', /app_config|role_names|site_text_overrides|time_updated|siteSlogan|roleNames/],
];
const CJK = /[\u3400-\u9fff]/;
const leakHits = (ns: Record<string, string>): string[] => {
  const hits: string[] = [];
  for (const [k, v] of Object.entries(ns)) for (const [name, re] of LEAK) if (re.test(String(v))) hits.push(`${k} [${name}] ${v}`);
  return hits;
};
const nsOf = (l: string, name: string): Record<string, string> => {
  const v = LOCALES[l][name];
  return v && typeof v === 'object' ? (v as Record<string, string>) : {};
};
{
  const roleKeys = Object.keys(nsOf('zh', 'roleNames')).sort();
  t('H1', 'i18n', JSON.stringify(roleKeys) === JSON.stringify([...ROLE_NAME_FIELDS].sort()),
    `\`roleNames\` 键集 = 四角色 = ${JSON.stringify([...ROLE_NAME_FIELDS])}`, JSON.stringify(roleKeys));
  for (const l of LANGS) {
    t(`H2.${l}`, 'i18n',
      JSON.stringify(Object.keys(nsOf(l, 'roleNames')).sort()) === JSON.stringify(roleKeys)
      && Object.values(nsOf(l, 'roleNames')).every((v) => typeof v === 'string' && v.trim().length > 0)
      && typeof LOCALES[l].siteSlogan === 'string' && String(LOCALES[l].siteSlogan).trim().length > 0,
      `\`roleNames\` 四语键集齐 + 非空 · \`siteSlogan\` 在场非空（${l}）`,
      JSON.stringify({ roleKeys: Object.keys(nsOf(l, 'roleNames')).length, slogan: LOCALES[l].siteSlogan }));
  }
  // en/vn 无 CJK（覆盖 roleNames / siteSlogan / adminRoleNames / adminSiteText / adminNav 新 2 键）
  for (const l of ['en', 'vn']) {
    const vals = [...Object.values(nsOf(l, 'roleNames')), String(LOCALES[l].siteSlogan),
      ...Object.values(nsOf(l, 'adminRoleNames')), ...Object.values(nsOf(l, 'adminSiteText')),
      String((LOCALES[l].adminNav as Record<string, string>).siteText), String((LOCALES[l].adminNav as Record<string, string>).siteTextDesc)];
    t(`H3.${l}`, 'i18n', !vals.some((v) => CJK.test(String(v))), `${l} 五处新文案面零 CJK`, JSON.stringify(vals.filter((v) => CJK.test(String(v)))));
  }
  t('H4', 'i18n', String(nsOf('hk', 'roleNames').buyer) !== String(nsOf('zh', 'roleNames').buyer)
    && String(LOCALES.hk.siteSlogan) !== String(LOCALES.zh.siteSlogan) && CJK.test(String(LOCALES.hk.siteSlogan)),
    'hk 为繁體（`roleNames.buyer` 与 zh 逐字不同 · `siteSlogan` 与 zh 不同且含 CJK）',
    JSON.stringify({ hk_buyer: nsOf('hk', 'roleNames').buyer, zh_buyer: nsOf('zh', 'roleNames').buyer, hk_slogan: LOCALES.hk.siteSlogan, zh_slogan: LOCALES.zh.siteSlogan }));
  const allHits = LANGS.flatMap((l) => [
    ...leakHits(nsOf(l, 'roleNames')).map((h) => `${l}.roleNames.${h}`),
    ...leakHits(nsOf(l, 'adminRoleNames')).map((h) => `${l}.adminRoleNames.${h}`),
    ...leakHits(nsOf(l, 'adminSiteText')).map((h) => `${l}.adminSiteText.${h}`),
    ...leakHits({ siteSlogan: String(LOCALES[l].siteSlogan) }).map((h) => `${l}.siteSlogan.${h}`),
    ...leakHits({ siteText: String((LOCALES[l].adminNav as Record<string, string>).siteText), siteTextDesc: String((LOCALES[l].adminNav as Record<string, string>).siteTextDesc) }).map((h) => `${l}.adminNav.${h}`),
  ]);
  t('H5', 'i18n', allHits.length === 0, '六类工程口径泄漏 = 0（四语 × 五处新文案面）', JSON.stringify(allHits));
  const adminNavNewKeys = ['siteText', 'siteTextDesc'];
  t('H6', 'i18n', LANGS.every((l) => adminNavNewKeys.every((k) => Boolean((LOCALES[l].adminNav as Record<string, string>)[k]))),
    '`adminNav` 新 2 键（`siteText` / `siteTextDesc`）四语齐', JSON.stringify(LANGS.map((l) => Object.keys(nsOf(l, 'adminNav')).length)));
  selfTest('H5', 'i18n', (v) => leakHits(v as Record<string, string>).length === 0, { title: '站点文案（§29.12）' },
    '把带章节号的文案喂入 ⇒ 泄漏谓词必须转红');
}

// ============================================================================
// I · adminNav 冻结计数 = 28 三处同步现取（沿 R-8-22；未删断言）
// ============================================================================
{
  const navCounts = LANGS.map((l) => Object.keys(nsOf(l, 'adminNav')).length);
  t('I1', 'navSync', navCounts.every((n) => n === 28), '四语 `adminNav` 键数 = 28（+2 = `siteText` / `siteTextDesc`）', JSON.stringify(navCounts));
  t('I2', 'navSync', /const NAV_KEYS_FROZEN = 28;/.test(S5_GATE),
    '① `p8-s5-compliance-gate.ts`：`NAV_KEYS_FROZEN = 28`', /NAV_KEYS_FROZEN = \d+/.exec(S5_GATE)?.[0] ?? '(none)');
  t('I3', 'navSync', /adminNav:\s*28\s*}/.test(S2_GATE),
    '② `p8-s2-fee-rebate-gate.ts`：`NS_KEYS.adminNav = 28`', /adminNav:\s*\d+/.exec(S2_GATE)?.[0] ?? '(none)');
  t('I4', 'navSync', /adminNav:\s*28\s*,/.test(B4A_TEST),
    '③ `i18n-batch-b4a.test.jsx`：`NEW_NS.adminNav = 28`', /adminNav:\s*\d+/.exec(B4A_TEST)?.[0] ?? '(none)');
  // ★ 反证：三处旧值 26 已零残留（只此三处曾冻结；防「改一处漏两处」）
  const stale = [S5_GATE, S2_GATE, B4A_TEST].filter((s) => /NAV_KEYS_FROZEN = 26|adminNav:\s*26\b/.test(s));
  t('I5', 'navSync', stale.length === 0, '三处冻结旧值 `26` 零残留（同步彻底）', JSON.stringify(stale.map((_, i) => i)));
  selfTest('I2', 'navSync', (v) => /const NAV_KEYS_FROZEN = 28;/.test(String(v)), 'const NAV_KEYS_FROZEN = 26;',
    '把旧冻结值喂入 ⇒ 同步谓词必须转红');
}

// ============================================================================
// J · 零新增错误码 / 零新增 reason 常量
// ============================================================================
{
  t('J1', 'closedSets', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（不动）', LEDGER_ERROR_CODES.length);
  const usedReasons = new Set<string>([
    SETTINGS_WRITE_REASONS.unknownKey, SETTINGS_WRITE_REASONS.typeInvalid, SETTINGS_WRITE_REASONS.valueNotObject,
  ]);
  const badValues = [
    validateAppConfigKey('made_up_key'), validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, 'x'),
    validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, { ghost: fourLang('g') }),
    validateOverlayValue(ROLE_NAMES_KEY, ROLE_NAME_FIELDS, { poster: { zh: 'p', en: 'e', hk: 'h' } }),
  ];
  const emitted = badValues.filter((v) => !v.ok).map((v) => (v as { details: { reason?: string } }).details.reason).filter(Boolean) as string[];
  t('J2', 'closedSets', emitted.every((r) => usedReasons.has(r)),
    '覆盖层失败只用既有 `SETTINGS_WRITE_REASONS` 三常量（零新增 reason 常量）', JSON.stringify([...new Set(emitted)]));
  const codes = badValues.filter((v) => !v.ok).map((v) => (v as { code: string }).code);
  t('J3', 'closedSets', codes.every((c) => LEDGER_ERROR_CODES.includes(c as never)),
    '覆盖层失败码 ⊆ 既有 §14 闭集（零新增码）', JSON.stringify([...new Set(codes)]));
  selfTest('J1', 'closedSets', (v) => (v as string[]).every((c) => LEDGER_ERROR_CODES.includes(c as never)), ['LEDGER_NEW_MADEUP_CODE'],
    '自造码喂入 ⇒ 闭集谓词必须转红');
}

// ============================================================================
// 结论
// ============================================================================
const failed = checks.filter((c) => !c.pass);
const report = {
  unit: 'P8-S6-SITE-TEXT-GATE',
  generated_at: new Date().toISOString(),
  run: RUN,
  offline: true,
  db_connections: 0,
  http_calls: 0,
  note: '本门**零 DB / 零 HTTP**：注册点 / 公开读口（静态无鉴权判据）/ 白名单 / 覆盖层 AV2–AV4 与读侧 fail-closed / 数值策略 / 四语与泄漏 / 三处冻结同步 / 零新增码。公开读口真 HTTP 200 与 `GET /api/admin/settings` 读面结论另册（受控实例探针 · 报告 §4/§9）。',
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  readings: {
    registration_points_total: countRoutes(INDEX_TS),
    registration_points_per_verb: PER_VERB_FROZEN,
    public_read_path: '/api/role-names',
    whitelist_keys: [...APP_CONFIG_LEGAL_KEYS],
    role_name_fields: [...ROLE_NAME_FIELDS],
    site_text_fields: [...SITE_TEXT_FIELDS],
    overlay_langs: [...OVERLAY_LANGS],
    admin_nav_keys: LANGS.map((l) => Object.keys(nsOf(l, 'adminNav')).length),
    error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
  },
  checks,
};
const text = JSON.stringify(report, null, 1);
fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
console.log(text);
console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
process.exit(failed.length ? 1 : 0);
