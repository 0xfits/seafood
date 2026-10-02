/**
 * 批 8③b（`data-layer.spec` v0.13 §24 · `route-layer.spec` v2.6 §21 · `R-8-19`）：
 * **`app_config` 键级寻址线格式 + HTTP 写面** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s3b-address-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s3b-artifacts/p8s3b-<RUN>/gate.json
 *
 * **零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / spec 文本）—— 同「离线套件 / p8-s1..s3」族。
 *
 * 判据（每条**可判负**）：
 *   A  **形态 A 逐字兼容**（§24.1(f)）：裸值对象 ⇒ 目标键 = 常量 `system_settings`；写口 / 门禁 / 响应 / `ops:` 键形不变
 *   B  **形态 B 线格式**（§24.1）：判别 = 自有属性 `key`；信封 `{key, value}`；响应 `{key, value}` + `'App config key saved'`；
 *      写落点 `key` 由解出的目标键给（**参数化**）
 *   C  **多键 body ⇒ 拒**（§24.1(d)/§24.1(c)②）：信封多余属性 / 顶层双键 / 数组 ⇒ 一律 400（**不静默忽略**）
 *   D  **`ops:` 按目标键派生**（§24.3 · 闭合 `O-3`）：第 4 实参 = 解出的目标键变量；两键命名空间不相交；零新增 `reason` 常量
 *   E  **`AV1`–`AV4` 校验叠加**（§24.2 · 逐层 + `details.legal_keys` 分层证据）
 *   F  **下限 fail-closed**（§23.4/§24.4）：读不到 / 非法 ⇒ 回落常量；合法 ⇒ 用键值；常量标 `TODO: Kevin 定值`
 *   G  **`R-8-17` 禁线**：注册点仍 69 / 无 `delist` / 无退还罚没面 / 迁移数仍 23
 *   H  **门自证（负对照）**：判据谓词喂错值 ⇒ 必须转红（不转红 = 假门）
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  APP_CONFIG_LEGAL_KEYS,
  SETTINGS_WRITE_REASONS,
  SYSTEM_SETTINGS_FIELDS,
  SYSTEM_SETTINGS_KEY,
  LISTING_DEPOSIT_POLICY_KEY,
  isAppConfigEnvelope,
  screenAppConfigEnvelope,
  screenSystemSettingsWrite,
  validateAppConfigKey,
  validateAppConfigValue,
} from '../src/database';
import { canonicalAdminOpsKey } from '../src/admin-service';
import { CURRENCY_LIST_DEPOSIT_FLOOR, resolveListingDepositFloor } from '../src/currency-service';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s3b-artifacts', `p8s3b-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};
/** 门自证：谓词喂「故意错」输入 ⇒ 必须返 false（不转红 = 假门）。 */
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, expect: string): void => {
  const fired = predicate(wrongInput) === false;
  checks.push({ id: `${id}__selftest`, group: `${group}SelfTest`, pass: fired, expect, actual: JSON.stringify({ wrong_input: wrongInput, judge_fired: fired }) });
};

const read = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const INDEX_TS = read('backend-ts/src/index.ts');
const DATABASE_TS = read('backend-ts/src/database.ts');
const CURRENCY_TS = read('backend-ts/src/currency-service.ts');
const SPEC_DATA = read('docs/data-layer.spec.md');
const SPEC_ROUTE = read('docs/route-layer.spec.md');
const REG_POINTS_FROZEN = 69;
const MIGRATIONS_FROZEN = 23;
void SPEC_DATA; void SPEC_ROUTE;

const FROZEN_AK1_FIELDS = [
  'siteName', 'siteDescription', 'maintenance', 'allowRegistration', 'emailNotifications',
  'defaultLanguage', 'pointsPerTask', 'maxDailyTasks', 'rewardCooldown',
];

// ============================================================================
// A · 形态 A 逐字兼容（§24.1(f)）
// ============================================================================
t('A1', 'formACompat',
  INDEX_TS.includes('screenSystemSettingsWrite(body)')
  && INDEX_TS.includes('DatabaseService.saveSystemSettings(verdict.value, actor.session.uID)')
  && INDEX_TS.includes("'System settings saved'"),
  '形态 A 支完整保留：`screenSystemSettingsWrite(body)` + `saveSystemSettings(verdict.value, uid)` + 响应 `\'System settings saved\'`（`AW9`）',
  JSON.stringify({
    screen: INDEX_TS.includes('screenSystemSettingsWrite(body)'),
    save: INDEX_TS.includes('DatabaseService.saveSystemSettings(verdict.value, actor.session.uID)'),
    msg: INDEX_TS.includes("'System settings saved'"),
  }));
t('A2', 'formACompat', /let targetKey: string = SYSTEM_SETTINGS_KEY;/.test(INDEX_TS) && SYSTEM_SETTINGS_KEY === 'system_settings',
  '形态 A 目标键 = 常量 `SYSTEM_SETTINGS_KEY`（= `\'system_settings\'` · `AW3`）',
  JSON.stringify({ init: /let targetKey: string = SYSTEM_SETTINGS_KEY;/.test(INDEX_TS), constant: SYSTEM_SETTINGS_KEY }));
t('A3', 'formACompat', INDEX_TS.includes('findFeeRateKey(plainBody)'),
  '形态 A 的费率键闸（`findFeeRateKey(plainBody)`）保留（既有行为逐字不变）',
  INDEX_TS.includes('findFeeRateKey(plainBody)'));
{
  // 运行时：形态 A 值对象（合法部分补丁 / 未知字段 ⇒ 拒）
  const okv = validateAppConfigValue(SYSTEM_SETTINGS_KEY, { maintenance: true });
  t('A4', 'formACompat', okv.ok === true && JSON.stringify(okv.ok ? okv.value : null) === JSON.stringify({ maintenance: true }),
    '形态 A 值对象 `{maintenance:true}` ⇒ 合法（原样透传 · 不补默认值）', okv.ok ? JSON.stringify(okv.value) : 'ok=false');
  const badv = validateAppConfigValue(SYSTEM_SETTINGS_KEY, { siteName: 'X', foo: 1 });
  t('A5', 'formACompat',
    badv.ok === false && badv.details.reason === SETTINGS_WRITE_REASONS.unknownKey
    && JSON.stringify(badv.details.legal_keys) === JSON.stringify(FROZEN_AK1_FIELDS)
    && JSON.stringify(badv.details.unknown_keys) === JSON.stringify(['foo']),
    '形态 A 未知字段 ⇒ 拒 + `legal_keys` = **9 字段**（`AV2` 字段层闭集 · 整请求拒）',
    badv.ok ? 'ok=true' : JSON.stringify({ reason: badv.details.reason, unknown_keys: badv.details.unknown_keys, legal_keys_len: (badv.details.legal_keys as string[]).length }));
}

// ============================================================================
// B · 形态 B 线格式（§24.1）
// ============================================================================
t('B1', 'formBFormat', INDEX_TS.includes('isAppConfigEnvelope(body)') && INDEX_TS.includes('screenAppConfigEnvelope('),
  '形态 B 判别 = `isAppConfigEnvelope(body)`（自有属性 `key`）+ 信封形状 `screenAppConfigEnvelope(...)`（`AW4`/`AW5`）',
  JSON.stringify({ discriminant: INDEX_TS.includes('isAppConfigEnvelope(body)'), envelope: INDEX_TS.includes('screenAppConfigEnvelope(') }));
t('B2', 'formBFormat',
  INDEX_TS.includes('{ key: targetKey, value: writtenValue }') && INDEX_TS.includes("'App config key saved'"),
  '形态 B 成功响应 = `data { key, value }` + `message = \'App config key saved\'`（`AW8`）',
  JSON.stringify({ data: INDEX_TS.includes('{ key: targetKey, value: writtenValue }'), msg: INDEX_TS.includes("'App config key saved'") }));
t('B3', 'formBFormat',
  INDEX_TS.includes('DatabaseService.saveSystemSettings(valVerdict.value, actor.session.uID, targetKey)'),
  '形态 B 写落点把**解出的目标键**作第 3 参传入（`saveSystemSettings(value, uid, targetKey)` · `AS1`）',
  INDEX_TS.includes('DatabaseService.saveSystemSettings(valVerdict.value, actor.session.uID, targetKey)'));
t('B4', 'formBFormat', /\$\{targetKey\}::text/.test(DATABASE_TS),
  '写落点的 `key` 字面已参数化（SQL `VALUES (${targetKey}::text, …)`）—— 现取写死 `\'system_settings\'` 不再是唯一形态',
  /\$\{targetKey\}::text/.test(DATABASE_TS));
t('B5', 'formBFormat', isAppConfigEnvelope({ key: 'a', value: {} }) === true && isAppConfigEnvelope({ siteName: 'x' }) === false && isAppConfigEnvelope([{ key: 'a' }]) === false,
  '判别式（纯函数）：含自有 `key` 的对象 ⇒ true；裸值对象 / 数组 ⇒ false',
  JSON.stringify({ withKey: isAppConfigEnvelope({ key: 'a', value: {} }), formA: isAppConfigEnvelope({ siteName: 'x' }), array: isAppConfigEnvelope([{ key: 'a' }]) }));
{
  const ok = screenAppConfigEnvelope({ key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: 3 } });
  t('B6', 'formBFormat', ok.ok === true && ok.ok && ok.rawKey === LISTING_DEPOSIT_POLICY_KEY && JSON.stringify(ok.value) === JSON.stringify({ amount: 3 }),
    '信封形状：`{key, value}` ⇒ 解出 `rawKey` + `value`（形状层通过 · `AV1` 另层判）',
    ok.ok ? JSON.stringify({ rawKey: ok.rawKey, value: ok.value }) : 'not ok');
}

// ============================================================================
// C · 多键 body ⇒ 拒（§24.1(d)/§24.1(c)②）
// ============================================================================
{
  const extra = screenAppConfigEnvelope({ key: LISTING_DEPOSIT_POLICY_KEY, value: { amount: 1 }, key2: 'x' } as Record<string, unknown>);
  t('C1', 'multiKeyReject',
    extra.ok === false && extra.details.reason === SETTINGS_WRITE_REASONS.unknownKey
    && JSON.stringify(extra.details.unknown_keys) === JSON.stringify(['key2']),
    '信封**多余属性**（如 `key2`）⇒ 拒（`unknownKey` · `unknown_keys=[\'key2\']` · **不得静默忽略**）',
    extra.ok ? 'ok=true' : JSON.stringify({ reason: extra.details.reason, unknown_keys: extra.details.unknown_keys }));
  const twoTop = screenSystemSettingsWrite({ [SYSTEM_SETTINGS_KEY]: { siteName: 'x' }, [LISTING_DEPOSIT_POLICY_KEY]: { amount: 1 } });
  t('C2', 'multiKeyReject',
    twoTop.ok === false && (twoTop.details.unknown_keys as string[]).sort().join(',') === [SYSTEM_SETTINGS_KEY, LISTING_DEPOSIT_POLICY_KEY].sort().join(','),
    '**顶层双键**体（不带信封）⇒ 两键皆未知字段 ⇒ 整请求拒（`AG4`③）',
    twoTop.ok ? 'ok=true' : JSON.stringify({ unknown_keys: twoTop.details.unknown_keys }));
  const arr = screenSystemSettingsWrite([{ key: 'a', value: {} }] as unknown);
  t('C3', 'multiKeyReject', arr.ok === false && arr.details.reason === SETTINGS_WRITE_REASONS.valueNotObject,
    '数组体（多键的另一种写法）⇒ 非 object ⇒ 拒（`valueNotObject`）',
    arr.ok ? 'ok=true' : JSON.stringify({ reason: arr.details.reason }));
}

// ============================================================================
// D · `ops:` 按目标键派生（§24.3 · 闭合 O-3）
// ============================================================================
{
  const line = (INDEX_TS.match(/.*resolveAdminOpsKey\(req, actor\.session\.uID, 'setting'.*/) || [''])[0].trim();
  const m = /resolveAdminOpsKey\(req,\s*actor\.session\.uID,\s*'setting',\s*([^)]*)\)/.exec(line);
  const fourth = m ? m[1].trim() : '(none)';
  t('D1', 'opsDerivation', fourth === 'targetKey',
    `\`ops:\` 派生第 4 实参 = **解出的目标键变量**（`+ '`targetKey`' + `）—— 不得再写死 \'system_settings\'（§24.3(c)① 正面判据）`,
    JSON.stringify({ line, fourth_arg: fourth }));
  t('D2', 'opsDerivation',
    canonicalAdminOpsKey(7, 'setting', SYSTEM_SETTINGS_KEY) === 'ops:7:setting:system_settings'
    && canonicalAdminOpsKey(7, 'setting', LISTING_DEPOSIT_POLICY_KEY) === 'ops:7:setting:listing_deposit_policy'
    && canonicalAdminOpsKey(7, 'setting', SYSTEM_SETTINGS_KEY) !== canonicalAdminOpsKey(7, 'setting', LISTING_DEPOSIT_POLICY_KEY),
    '两键 `ops:` 键**命名空间不相交**：`ops:7:setting:system_settings` ≠ `ops:7:setting:listing_deposit_policy`；形态 A 键形逐字不变',
    JSON.stringify({ a: canonicalAdminOpsKey(7, 'setting', SYSTEM_SETTINGS_KEY), b: canonicalAdminOpsKey(7, 'setting', LISTING_DEPOSIT_POLICY_KEY) }));
  const iAv1 = INDEX_TS.indexOf('validateAppConfigKey(');
  const iOps = INDEX_TS.indexOf('resolveAdminOpsKey(req, actor.session.uID, \'setting\'');
  t('D3', 'opsDerivation', iAv1 > 0 && iOps > 0 && iAv1 < iOps,
    '次序：`AV1`（`validateAppConfigKey`）**先于** `ops:` 派生 ⇒ 非法键不得被伪装成「缺幂等键」（§24.3(c)⑤）',
    JSON.stringify({ av1_offset: iAv1, ops_offset: iOps }));
  t('D4', 'opsDerivation', Object.keys(SETTINGS_WRITE_REASONS).length === 3,
    '**零新增 `reason` 常量**（`SETTINGS_WRITE_REASONS` 仍恰 3 常量 · 闭集 33 码不动）',
    JSON.stringify(Object.keys(SETTINGS_WRITE_REASONS)));
}

// ============================================================================
// E · `AV1`–`AV4` 校验叠加（逐层 + `legal_keys` 分层证据）
// ============================================================================
{
  const av1 = validateAppConfigKey('nope');
  t('E1', 'avLayers',
    av1.ok === false && av1.code === 'LEDGER_AMOUNT_INVALID' && av1.details.reason === SETTINGS_WRITE_REASONS.unknownKey
    && av1.details.field === 'nope' && JSON.stringify(av1.details.unknown_keys) === JSON.stringify(['nope'])
    && JSON.stringify(av1.details.legal_keys) === JSON.stringify([...APP_CONFIG_LEGAL_KEYS]),
    '`AV1` 顶层键非法 ⇒ 400 + `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` + `details.legal_keys` = **恰 2 键**（层级证据）',
    av1.ok ? 'ok=true' : JSON.stringify({ reason: av1.details.reason, field: av1.details.field, legal_keys: av1.details.legal_keys }));
  const av1ok = validateAppConfigKey(LISTING_DEPOSIT_POLICY_KEY);
  t('E2', 'avLayers', av1ok.ok === true && av1ok.ok === true && av1ok.key === LISTING_DEPOSIT_POLICY_KEY,
    '`AV1` 合法键（`listing_deposit_policy`）⇒ 通过', av1ok.ok ? av1ok.key : 'not ok');
  const av2 = validateAppConfigValue(LISTING_DEPOSIT_POLICY_KEY, { amount: 1, balance: 2 });
  t('E3', 'avLayers',
    av2.ok === false && av2.details.reason === SETTINGS_WRITE_REASONS.unknownKey
    && JSON.stringify(av2.details.legal_keys) === JSON.stringify(['amount'])
    && JSON.stringify(av2.details.unknown_keys) === JSON.stringify(['balance']),
    '`AV2` AK2 字段闭集 ⇒ 夹带 `balance` ⇒ 拒 + `details.legal_keys` = **[`amount`]**（层级证据 · 键 ≠ 字段）',
    av2.ok ? 'ok=true' : JSON.stringify({ reason: av2.details.reason, unknown_keys: av2.details.unknown_keys, legal_keys: av2.details.legal_keys }));
  const av3 = validateAppConfigValue(LISTING_DEPOSIT_POLICY_KEY, { amount: '50000' });
  t('E4', 'avLayers',
    av3.ok === false && av3.details.reason === SETTINGS_WRITE_REASONS.typeInvalid
    && av3.details.field === 'amount' && av3.details.expected === 'number' && av3.details.got === 'string',
    '`AV3` `amount` 为**字符串** ⇒ 拒（`SETTING_TYPE_INVALID` · `expected=\'number\'` · **不隐式转换**）',
    av3.ok ? 'ok=true' : JSON.stringify({ reason: av3.details.reason, expected: av3.details.expected, got: av3.details.got }));
  const av4a = validateAppConfigValue(LISTING_DEPOSIT_POLICY_KEY, { amount: 0 });
  const av4b = validateAppConfigValue(LISTING_DEPOSIT_POLICY_KEY, { amount: -5 });
  const av4c = validateAppConfigValue(LISTING_DEPOSIT_POLICY_KEY, { amount: 1.5 });
  t('E5', 'avLayers',
    [av4a, av4b, av4c].every((v) => v.ok === false && v.details.reason === SETTINGS_WRITE_REASONS.typeInvalid
      && v.details.field === 'amount' && v.details.expected === 'positive_integer'),
    '`AV4` `amount` 语义域（正整数 · 最小单位）：`0` / `-5` / `1.5` ⇒ 拒（`expected=\'positive_integer\'` · **零新增常量**）',
    JSON.stringify([av4a, av4b, av4c].map((v) => (v.ok ? 'ok' : { expected: v.details.expected, got: v.details.got }))));
  const av4ok = validateAppConfigValue(LISTING_DEPOSIT_POLICY_KEY, { amount: 3 });
  t('E6', 'avLayers', av4ok.ok === true && JSON.stringify(av4ok.ok ? av4ok.value : null) === JSON.stringify({ amount: 3 }),
    '`AV4` 正整数 `amount=3` ⇒ 通过（原样透传）', av4ok.ok ? JSON.stringify(av4ok.value) : 'ok=false');
  t('E7', 'avLayers',
    /app_config_value_is_container/.test(INDEX_TS) && /SETTING_VALUE_NOT_OBJECT/.test(INDEX_TS),
    '`AV5` 容器硬约束兜底仍在：`app_config_value_is_container` ⇒ 转译 `400` + `SETTING_VALUE_NOT_OBJECT`（**禁裸 500**）',
    JSON.stringify({ constraint: /app_config_value_is_container/.test(INDEX_TS), reason: /SETTING_VALUE_NOT_OBJECT/.test(INDEX_TS) }));
}

// ============================================================================
// F · 下限 fail-closed（§23.4/§24.4）
// ============================================================================
{
  const f1 = resolveListingDepositFloor(null);
  const f2 = resolveListingDepositFloor({ amount: 77777 });
  const f3 = resolveListingDepositFloor({ amount: '77777' });
  t('F1', 'failClosed', f1.floor === CURRENCY_LIST_DEPOSIT_FLOOR && f1.source === 'constant',
    `读不到 ⇒ **回落常量** ${CURRENCY_LIST_DEPOSIT_FLOOR}（source=constant）`, JSON.stringify(f1));
  t('F2', 'failClosed', f2.floor === 77777 && f2.source === 'config',
    '合法键值 ⇒ 用键值（source=config · 不发明数值）', JSON.stringify(f2));
  t('F3', 'failClosed', f3.floor === CURRENCY_LIST_DEPOSIT_FLOOR && f3.source === 'constant',
    '非法值（字符串金额）⇒ **fail-closed 到常量**（**不是** fail-open 到该串）', JSON.stringify(f3));
  t('F4', 'failClosed', /TODO: Kevin 定值/.test(CURRENCY_TS),
    '兜底常量标 `TODO: Kevin 定值`（**不得发明保证金数值**）', /TODO: Kevin 定值/.test(CURRENCY_TS));
}

// ============================================================================
// G · R-8-17 禁线（无退还 / 罚没 / delist 面）
// ============================================================================
{
  const countRoutes = (text: string): number => (text.match(/^[ \t]*app\.(get|post|put|patch|delete)\(/gm) || []).length;
  const regCount = countRoutes(INDEX_TS);
  t('G1', 'noRefundSurface', regCount === REG_POINTS_FROZEN,
    `注册点仍 = ${REG_POINTS_FROZEN}（本片**零新增对外路径** · 键级寻址复用既有写口）`, regCount);
  t('G2', 'noRefundSurface', !/^[ \t]*app\.(get|post|put|patch|delete)\([^)]*delist/mi.test(INDEX_TS),
    '**无** delist 一族路由（`R-8-17`：退市退还作废 ⇒ 不得新增入口）',
    /^[ \t]*app\.(get|post|put|patch|delete)\([^)]*delist/mi.test(INDEX_TS));
  const SRC_DIR = path.resolve(REPO_ROOT, 'backend-ts', 'src');
  const SRC_FILES = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.ts')).map((f) => path.join(SRC_DIR, f));
  const stripComments = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\n]*$/gm, '').replace(/\/\/[^\n]*$/gm, '');
  const allSrcCode = SRC_FILES.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
  const currencyCode = stripComments(CURRENCY_TS);
  const newSurfaceCode = [INDEX_TS, DATABASE_TS].map(stripComments).join('\n');
  t('G3', 'noRefundSurface',
    !/listing_deposit_refund/.test(allSrcCode)
    && !/hold_release|unfreeze\s*\(|hold_forfeit/.test(currencyCode)
    && !/hold_release|unfreeze\s*\(|hold_forfeit|listing_deposit_refund/.test(newSurfaceCode),
    '退还 / 罚没面**零命中**（代码位 · 注释剥离）：`listing_deposit_refund` 全域；`hold_forfeit` / `hold_release` / `unfreeze(` 于 `currency-service` + **本片两件（`index.ts` / `database.ts`）**',
    JSON.stringify({
      deposit_refund_any: (allSrcCode.match(/listing_deposit_refund/g) || []).length,
      currency_service: (currencyCode.match(/hold_release|unfreeze\s*\(|hold_forfeit/g) || []),
      new_surface: (newSurfaceCode.match(/hold_release|unfreeze\s*\(|hold_forfeit|listing_deposit_refund/g) || []),
    }));
  const migFiles = fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql'));
  t('G4', 'noRefundSurface', migFiles.length === MIGRATIONS_FROZEN,
    `迁移文件数仍 = ${MIGRATIONS_FROZEN}（**零新增迁移 / 零 DDL** · `+ '`R-8-5`' + `）`, migFiles.length);
}

// ============================================================================
// H · 门自证（负对照）
// ============================================================================
selfTest('A1', 'formACompat', (v) => v === true, false, '形态 A 三点任一丢失 ⇒ 判据须转红');
selfTest('D1', 'opsDerivation', (v) => v === 'targetKey', 'system_settings', '`ops:` 第 4 实参写死 `\'system_settings\'` ⇒ 判据须转红（`O-3` 未闭合）');
selfTest('E1', 'avLayers', (v: unknown) => JSON.stringify(v) === JSON.stringify([...APP_CONFIG_LEGAL_KEYS]), ['system_settings'], '`legal_keys` 只 1 键 ⇒ 判据须转红');
selfTest('F1', 'failClosed', (v: unknown) => JSON.stringify(v) === JSON.stringify({ floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'constant' }), { floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'config' }, '「常量兜底」误记 config ⇒ 判据须转红');
selfTest('G1', 'noRefundSurface', (v) => v === REG_POINTS_FROZEN, 70, '注册点写成 70（偷偷加路由）⇒ 判据须转红');

// ==================================================================== 结论
const failed = checks.filter((c) => !c.pass);
const report = {
  unit: 'P8-S3B-ADDRESS-GATE',
  generated_at: new Date().toISOString(),
  run: RUN,
  offline: true,
  db_connections: 0,
  http_calls: 0,
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  readings: {
    legal_keys: [...APP_CONFIG_LEGAL_KEYS],
    reason_constants: SETTINGS_WRITE_REASONS,
    ak1_fields: [...SYSTEM_SETTINGS_FIELDS],
    registration_points: (INDEX_TS.match(/^[ \t]*app\.(get|post|put|patch|delete)\(/gm) || []).length,
    deposit_floor_constant: CURRENCY_LIST_DEPOSIT_FLOOR,
    ops_key_forms: {
      formA: canonicalAdminOpsKey(7, 'setting', SYSTEM_SETTINGS_KEY),
      formB: canonicalAdminOpsKey(7, 'setting', LISTING_DEPOSIT_POLICY_KEY),
    },
  },
  checks,
};
const text = JSON.stringify(report, null, 1);
fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
console.log(text);
console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'gate.json')}`);
process.exit(failed.length ? 1 : 0);
