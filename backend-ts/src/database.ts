import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { SYSTEM_CURRENCY_CID } from './ledger';
// 批 8⑤（`route-layer.spec` v2.10 §25 / `data-layer.spec` v0.17 §28）：招工仲裁写路径需
// **同事务**内「迁 `submitted→disputed`（既有白名单边）→ 调既有 `job_post_event`（资金腿 + 终态）
// → 写 `job_arbitration_log`」⇒ 复用 `db.ts` 的交互式事务（R55/R56）；商品下架无账务 ⇒ 仍单语句。
import { txQuery, withTransaction, type TxClient } from './db';

// 本地凭据在 .env.local，先加载它、再补 .env（dotenv 默认不覆盖已存在的变量，故 .env.local 优先）
dotenv.config({ path: '.env.local' });
dotenv.config();

type RawRow = Record<string, unknown>;

const ALL_ADMIN_PERMISSIONS = [
  'dashboard_access',
  'manage_tasks',
  'publish_tasks',
  'manage_rewards',
  'publish_prizes',
  'read_users',
  'manage_users',
  'manage_points',
  'manage_permissions',
  'manage_settings',
  'review_tasks',
] as const;

const DEFAULT_SYSTEM_SETTINGS = {
  siteName: 'Seafood Club',
  siteDescription: '去中心化社区奖励平台',
  maintenance: false,
  allowRegistration: true,
  emailNotifications: true,
  defaultLanguage: 'zh',
  pointsPerTask: 100,
  maxDailyTasks: 10,
  rewardCooldown: 24,
} as const;

// ============================================================================
// 批 8①（`data-layer.spec` v0.10 §21.1 / §21.2 · `AK1` / `AG1`–`AG4`）
//   + 批 8③（`data-layer.spec` v0.12 §23.1 · `AK2` 入册）· `route-layer.spec` v2.5 §20：
// `app_config` **合法键清单（关闭集）** + **写入门禁的判据真源**。
// ============================================================================
// · 顶层合法键（`app_config.key` 取值）**恰好 9 个** = `system_settings`（`AK1`，§21.1）
//   + `listing_deposit_policy`（`AK2`，§23.1 入册；真源 = `R-8-9` 批准键名）
//   + P9 候选 7 键（§29.2(B) `B1`–`B7`；`R-9-13`-1 裁准入册 = 变体 Ⅰ）；
//   **任何其它键名一律非法**（含 `foo` / `deposit_amount` / `fee_rate` / `rate_bp`）。
// · ★ **「在册」=「可写」**（`data-layer.spec` v0.13 §24 · `route-layer.spec` v2.6 §21 · `R-8-19`）：
//   `AK2` 已可经 `POST /api/admin/settings` 的**形态 B**（显式信封 `{key, value}`）**键级寻址**写入
//   （校验叠加 `AV1` 顶层键 → `AV2` 逐键字段闭集 → `AV3` 逐键类型 → `AV4` `amount` 语义域）；
//   形态 A（裸值对象）的**目标键仍 = 单键 `system_settings`**（线格式逐字兼容 · §24.1(f)）。
//   ⇒ 把 `listing_deposit_policy` 当 `AK1` 值对象的**字段**塞进请求体 ⇒ **仍必被 `AG1` 拒**（**键 ≠ 字段**）。
// · `system_settings` 的 `value` = **jsonb object**（容器硬约束 `0017:77`），对象内字段 = 下 9 个（类型规格见 `SYSTEM_SETTINGS_FIELD_TYPES`）。
// · `listing_deposit_policy` 的 `value` = **jsonb object**（同容器约束），对象内字段 = `amount`（正整数 · 最小单位；
//   逐字段规格见 `LISTING_DEPOSIT_POLICY_FIELD_TYPES`；**数值真值 = `TODO: Kevin 定值`**）。
// · `value` 内**字段名**亦为**关闭集**：请求体出现清单外的键即按其为「未知键」判负（`AG1`）。
// ⚠️ 纪律（§21.3 规则①）：**本清单是键名的唯一真源** —— 实现 / 测试 / 探针**不得自拟键名**。
/**
 * §21.1 `AK1` ∪ §23.1 `AK2` ∪ §29.2(B)（P9 候选 `B1`–`B7` · `R-9-13`-1 裁准入册）：
 * `app_config` 顶层合法键（关闭集 · 恰 9 键）。逐字 9 键 =
 *   `system_settings` · `listing_deposit_policy` ·
 *   `batt_policy`(B1) · `checkin_policy`(B2) · `invite_reward_policy`(B3) ·
 *   `mint_burn_policy`(B4) · `rating_policy`(B5) · `site_text_overrides`(B6) · `role_names`(B7)。
 * ★ 「在册 ≠ 可写」仍成立（§29.2(D) 三重复核）：入册后仍须过 `AV2`–`AV5` + `ops:` 键级寻址 + 闸 `manage_settings`。
 */
export const APP_CONFIG_LEGAL_KEYS = [
  'system_settings',
  'listing_deposit_policy',
  'batt_policy',
  'checkin_policy',
  'invite_reward_policy',
  'mint_burn_policy',
  'rating_policy',
  'site_text_overrides',
  'role_names',
] as const;

/**
 * ★ 批 8③b（`data-layer.spec` v0.13 §24.1(b) · `AW3`）：**形态 A** 的目标键常量（唯一）。
 * 形态 A = 既有裸值对象（无自有属性 `key`）⇒ 目标键 = 本常量 ⇒ **`ops:` 键形逐字不变**。
 */
export const SYSTEM_SETTINGS_KEY = 'system_settings' as const;

/** §21.1 `AK1`：`system_settings` 值对象的**逐字段类型规格**（`AG3` 的判据真源；严格比对、不做隐式转换）。 */
const SYSTEM_SETTINGS_FIELD_TYPES = {
  siteName: 'string',
  siteDescription: 'string',
  maintenance: 'boolean',
  allowRegistration: 'boolean',
  emailNotifications: 'boolean',
  defaultLanguage: 'string',
  pointsPerTask: 'number',
  maxDailyTasks: 'number',
  rewardCooldown: 'number',
} as const;

/** `system_settings` 的合法字段名（关闭集，9 个）。 */
export const SYSTEM_SETTINGS_FIELDS = Object.keys(SYSTEM_SETTINGS_FIELD_TYPES) as Array<keyof SystemSettingsRecord>;

/**
 * 请求信封的**控制字段**（`DL36` 幂等键载体）—— **不是** settings 字段、**不是** `app_config` 键。
 * 由 `resolveAdminOpsKey`（`admin-service.ts:59`）消费；写入门禁判定前**剥离**（否则会被误判为未知键）。
 */
export const SETTINGS_CONTROL_FIELDS = ['create_key', 'idempotency_key', 'idempotencyKey'] as const;

/**
 * 写入口禁的**稳定原因串**（`details.reason` 取值；**机读判据 —— 恒为常量、不随输入插值**）。
 * ★ `R-8-10` 裁定：`reason` 是**稳定机读面**（要**能枚举** + **能映射 i18n**）⇒ 未知键**不得**用
 * `<KEY>_NOT_IN_APP_CONFIG_WHITELIST` 插值形（逐键不同 ⇒ 判据不可枚举）；改用**单一常量**，
 * 「哪些键未知」由 `details.unknown_keys`（数组，逐键）承载。
 */
export const SETTINGS_WRITE_REASONS = {
  /** `AG1`：未知键 —— **常量**（与键名无关，`R-8-10`）。 */
  unknownKey: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST',
  /** `AG3`②：字段类型不符。 */
  typeInvalid: 'SETTING_TYPE_INVALID',
  /** `AG3`①：`value` 不是 jsonb object（裸标量 / 数组 / null）。 */
  valueNotObject: 'SETTING_VALUE_NOT_OBJECT',
} as const;

// ============================================================================
// 批 8③（`data-layer.spec` v0.12 §23.3 `AG3`(ii) · §23.4 · `route-layer.spec` v2.5 §20.7）：
// `AK2` = `listing_deposit_policy` 的 **值对象逐字段类型规格** + **读侧解析**（fail-closed）。
// ============================================================================
// · 容器层：`value` **必须** jsonb object（`0017:77` 硬约束）。
// · 字段层：对象内**只允许** `amount`（**正整数 · 最小单位**；`AG3`(ii)）—— 数值真值 = `TODO: Kevin 定值`。
// · ★ **键 ≠ 字段**（§23.3 末段两禁令）：本表描述的是**某个顶层键的 `value` 内部**，
//   **不得**并入 `SYSTEM_SETTINGS_FIELD_TYPES`（那会同时破 `AK1` 的 9 字段关闭集与 `AG1` 的键维语义）。
/** §23.3 `AK2`：`listing_deposit_policy` 值对象的**逐字段类型规格**（`AG3`(ii) 的判据真源）。 */
export const LISTING_DEPOSIT_POLICY_FIELD_TYPES = {
  /** 上市保证金金额（**整数 · 最小单位**；数值真值 `TODO: Kevin 定值`）。 */
  amount: 'number',
} as const;

/** `listing_deposit_policy` 的合法字段名（关闭集，1 个）。 */
export const LISTING_DEPOSIT_POLICY_FIELDS = Object.keys(LISTING_DEPOSIT_POLICY_FIELD_TYPES);

// ============================================================================
// ★★ 批 9 第 1 片（P9①）（`data-layer.spec` v0.19 §29 / §30 · `route-layer.spec` v2.12 §26 / §27）：
//   P9 配置键面 —— 数值策略键 `B1`–`B5` + 两类文案覆盖层键 `B6` / `B7` 的**键名唯一真源** +
//   `AV2`–`AV4` 校验体（**零新增错误码 / 零新增 `reason` 常量**：复用 `SETTINGS_WRITE_REASONS` 三常量）。
// · `R-9-13`-1 载体 = **变体 Ⅰ**（`app_config` 键）；**零 DDL / 零迁移**（`AS5`）；唯一写口 = 形态 B。
// ============================================================================

/** `B7`（`R-9-8` 范围更正 · §29.13）：四角色名覆盖层键名常量。 */
export const ROLE_NAMES_KEY = 'role_names' as const;
/** `B6`（`R-9-10` · §29.12）：站点标语覆盖层键名常量。 */
export const SITE_TEXT_OVERRIDES_KEY = 'site_text_overrides' as const;

/** §29.13⑤：`role_names` 字段闭集 = 显式四角色（禁任意 i18n 键）。 */
export const ROLE_NAME_FIELDS = ['poster', 'worker', 'seller', 'buyer'] as const;
/** §29.12(d)：`site_text_overrides` 字段闭集 = 显式三键（禁任意 i18n 键）。 */
export const SITE_TEXT_FIELDS = ['siteTitle', 'siteSlogan', 'slogan'] as const;
/** §29.13① / §29.12(a)：覆盖层语言闭集（四语键集必须相等；缺语 ⇒ fail-closed）。 */
export const OVERLAY_LANGS = ['zh', 'en', 'hk', 'vn'] as const;

/** `B1`–`B5`（§29.2(B)）数值策略键的**逐字段类型规格**（`AV2`/`AV3` 判据真源）。 */
export const BATT_POLICY_FIELD_TYPES = {
  taskCostBatt: 'number', capBatt: 'number', floorBatt: 'number', acceptThresholdBatt: 'number',
} as const;
export const CHECKIN_POLICY_FIELD_TYPES = {
  baseRewardBatt: 'number', streakCapDays: 'number', streakDay7RewardBatt: 'number',
  makeupCostUsd: 'number', makeupDailyLimit: 'number',
} as const;
export const INVITE_REWARD_POLICY_FIELD_TYPES = {
  signupBatt: 'number', firstTaskUsd: 'number', rewardLevels: 'number',
} as const;
export const MINT_BURN_POLICY_FIELD_TYPES = {
  mintBattCost: 'number', mintFeeUsd: 'number', burnBttcCost: 'number', burnFeeUsd: 'number', burnBattGain: 'number',
} as const;
export const RATING_POLICY_FIELD_TYPES = {
  storageDecimals: 'number', displayDecimals: 'number', defaultStars: 'number',
} as const;

/** `AV4` 语义域函数（真 ⇒ 合法）。 */
type NumericDomain = (value: number) => boolean;
const POSITIVE_INT: NumericDomain = (v) => Number.isSafeInteger(v) && v > 0;
const NON_NEG_INT: NumericDomain = (v) => Number.isSafeInteger(v) && v >= 0;
const STAR_RANGE: NumericDomain = (v) => Number.isFinite(v) && v >= 0 && v <= 5;
const ZERO_ONLY: NumericDomain = (v) => v === 0;

/** 数值策略键的 `AV2`/`AV3`/`AV4` 规格表（键名 → 字段类型 + 域 + 域标签）。 */
const NUMERIC_POLICY_SPECS: Record<string, {
  fields: Record<string, string>;
  domain: Record<string, NumericDomain>;
  domainLabel: Record<string, string>;
}> = {
  batt_policy: {
    fields: { ...BATT_POLICY_FIELD_TYPES },
    domain: { taskCostBatt: POSITIVE_INT, capBatt: POSITIVE_INT, floorBatt: NON_NEG_INT, acceptThresholdBatt: NON_NEG_INT },
    domainLabel: { taskCostBatt: 'positive_integer', capBatt: 'positive_integer', floorBatt: 'non_negative_integer', acceptThresholdBatt: 'non_negative_integer' },
  },
  checkin_policy: {
    fields: { ...CHECKIN_POLICY_FIELD_TYPES },
    domain: { baseRewardBatt: POSITIVE_INT, streakCapDays: POSITIVE_INT, streakDay7RewardBatt: POSITIVE_INT, makeupCostUsd: POSITIVE_INT, makeupDailyLimit: POSITIVE_INT },
    domainLabel: { baseRewardBatt: 'positive_integer', streakCapDays: 'positive_integer', streakDay7RewardBatt: 'positive_integer', makeupCostUsd: 'positive_integer', makeupDailyLimit: 'positive_integer' },
  },
  invite_reward_policy: {
    fields: { ...INVITE_REWARD_POLICY_FIELD_TYPES },
    domain: { signupBatt: POSITIVE_INT, firstTaskUsd: POSITIVE_INT, rewardLevels: POSITIVE_INT },
    domainLabel: { signupBatt: 'positive_integer', firstTaskUsd: 'positive_integer', rewardLevels: 'positive_integer' },
  },
  mint_burn_policy: {
    fields: { ...MINT_BURN_POLICY_FIELD_TYPES },
    domain: { mintBattCost: POSITIVE_INT, mintFeeUsd: POSITIVE_INT, burnBttcCost: POSITIVE_INT, burnFeeUsd: POSITIVE_INT, burnBattGain: POSITIVE_INT },
    domainLabel: { mintBattCost: 'positive_integer', mintFeeUsd: 'positive_integer', burnBttcCost: 'positive_integer', burnFeeUsd: 'positive_integer', burnBattGain: 'positive_integer' },
  },
  rating_policy: {
    fields: { ...RATING_POLICY_FIELD_TYPES },
    domain: { storageDecimals: NON_NEG_INT, displayDecimals: ZERO_ONLY, defaultStars: STAR_RANGE },
    domainLabel: { storageDecimals: 'non_negative_integer', displayDecimals: '0', defaultStars: 'number_in_[0,5]' },
  },
};

// ============================================================================
// 批 9 第 2 片（P9② · `data-layer.spec` v0.21 §31.3(b) / §31.4(a) / §31.3(c-3)）：
//   batt / 签到 策略的 **TS 侧 fail-closed 解析器** + **服务端常量兜底**
// ----------------------------------------------------------------------------
// · 口径（写死 · 承 §24.4 下限 fail-closed + §31.3(a) `B-5` + §31.3(c-3)）：
//   `app_config` 无行 / 值非 object / 某字段非法 ⇒ **该字段回落服务端常量**
//   （**绝不放行客户端值**）；`source` = `'config'`（有行）| `'constant'`（无行）。
// · ★ 交叉一致性（§31.3(b) 尾注）：`taskCostBatt`（消耗 9）与 `acceptThresholdBatt`（阈值 9）
//   **语义耦合 ⇒ 默认均 9**（本常量表据此取 9）。
// · ★ 这些常量是**代码面兜底唯一真源**；`app_config` 权威值只经既有唯一写口
//   `POST /api/admin/settings` 落地（`AG2`）⇒ 本模块**不写** `app_config`。
// ============================================================================
export const BATT_POLICY_DEFAULTS = {
  taskCostBatt: 9, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 9,
} as const;
export const CHECKIN_POLICY_DEFAULTS = {
  baseRewardBatt: 30, streakCapDays: 7, streakDay7RewardBatt: 60, makeupCostUsd: 100, makeupDailyLimit: 1,
} as const;

export type BattPolicy = { taskCostBatt: number; capBatt: number; floorBatt: number; acceptThresholdBatt: number };
export type CheckinPolicy = { baseRewardBatt: number; streakCapDays: number; streakDay7RewardBatt: number; makeupCostUsd: number; makeupDailyLimit: number };
export type PolicySource = 'config' | 'constant';

/**
 * ★ `R-9-23`：**配置键与 DB CHECK 的耦合硬上限**（钳制落在 resolver 内 ⇒ 全部读/写路径同一生效值）。
 *   · `capBatt` 生效值上限 = 100（DB 兜底 `CHECK (batt BETWEEN 0 AND 100)`，`0029`）；
 *   · `streakCapDays` 生效值上限 = 7（需求 §4.2.2「最大连续签到 7 天」= 硬上限；DB 兜底
 *     `CHECK (streak_day BETWEEN 1 AND 7)`，`0029`）。
 * 否则后台把 `capBatt`/`streakCapDays` 调大 ⇒ 写路径被 **23514** 拒 ⇒ 配置面不可用（真实耦合风险）。
 * ★ 不破 P9① 冻结的 `AV4` 域（`positive_integer`）—— 域校验仍在**入口**放行任意正整数，
 *   本节只在**读生效值**时钳制（DB CHECK 保持为兜底，非判据）。
 */
export const BATT_CAP_HARD_MAX = 100;
export const CHECKIN_STREAK_CAP_HARD_MAX = 7;

/** 正整数域（fail-closed：非安全整数 / ≤0 ⇒ `null` ⇒ 调用方回落常量）。 */
const policyPositiveInt = (raw: unknown): number | null => {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
/** 非负整数域（fail-closed）。 */
const policyNonNegInt = (raw: unknown): number | null => {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/** `batt_policy` 解析（**逐字段** fail-closed 到 `BATT_POLICY_DEFAULTS`）。 */
export const resolveBattPolicy = (raw: unknown): { policy: BattPolicy; source: PolicySource } => {
  const isObj = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  const v = isObj ? raw as Record<string, unknown> : {};
  // ★ `R-9-23` 钳制：`capBatt` 生效值 ≤ 100；`floorBatt` 生效值 ∈ [0, capBatt]（capBatt 先钳）。
  const capBatt = Math.min(policyPositiveInt(v.capBatt) ?? BATT_POLICY_DEFAULTS.capBatt, BATT_CAP_HARD_MAX);
  const floorBatt = Math.min(policyNonNegInt(v.floorBatt) ?? BATT_POLICY_DEFAULTS.floorBatt, capBatt);
  return {
    policy: {
      taskCostBatt: policyPositiveInt(v.taskCostBatt) ?? BATT_POLICY_DEFAULTS.taskCostBatt,
      capBatt,
      floorBatt,
      acceptThresholdBatt: policyNonNegInt(v.acceptThresholdBatt) ?? BATT_POLICY_DEFAULTS.acceptThresholdBatt,
    },
    source: isObj ? 'config' : 'constant',
  };
};

/** `checkin_policy` 解析（**逐字段** fail-closed 到 `CHECKIN_POLICY_DEFAULTS`）。 */
export const resolveCheckinPolicy = (raw: unknown): { policy: CheckinPolicy; source: PolicySource } => {
  const isObj = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  const v = isObj ? raw as Record<string, unknown> : {};
  return {
    policy: {
      baseRewardBatt: policyPositiveInt(v.baseRewardBatt) ?? CHECKIN_POLICY_DEFAULTS.baseRewardBatt,
      // ★ `R-9-23` 钳制：`streakCapDays` 生效值 ≤ 7（硬上限；DB 兜底 CHECK streak_day ∈ [1,7]）。
      streakCapDays: Math.min(policyPositiveInt(v.streakCapDays) ?? CHECKIN_POLICY_DEFAULTS.streakCapDays, CHECKIN_STREAK_CAP_HARD_MAX),
      streakDay7RewardBatt: policyPositiveInt(v.streakDay7RewardBatt) ?? CHECKIN_POLICY_DEFAULTS.streakDay7RewardBatt,
      makeupCostUsd: policyPositiveInt(v.makeupCostUsd) ?? CHECKIN_POLICY_DEFAULTS.makeupCostUsd,
      makeupDailyLimit: policyPositiveInt(v.makeupDailyLimit) ?? CHECKIN_POLICY_DEFAULTS.makeupDailyLimit,
    },
    source: isObj ? 'config' : 'constant',
  };
};

/** ISO 串或 `null`（读口 `updated_at`）。 */
export const isoOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};


const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const rejectUnknownKey = (unknown: string[], legal: readonly string[], message: string): SystemSettingsWriteReject => ({
  ok: false,
  code: 'LEDGER_AMOUNT_INVALID',
  message,
  details: { field: unknown[0], reason: SETTINGS_WRITE_REASONS.unknownKey, unknown_keys: unknown, legal_keys: [...legal] },
});

const rejectType = (field: string, expected: string, got: unknown, message = 'Setting field type is invalid'): SystemSettingsWriteReject => ({
  ok: false,
  code: 'LEDGER_AMOUNT_INVALID',
  message,
  details: { field, reason: SETTINGS_WRITE_REASONS.typeInvalid, expected, got: shapeOf(got) },
});

/**
 * `B1`–`B5` 数值策略键的 `AV2`（字段闭集）→ `AV3`（类型）→ `AV4`（语义域）判定（层序写死 · 短路）。
 * 缺字段合法（部分补丁语义）；未知字段 ⇒ `unknownKey`（`legal_keys` = 该键字段清单）。
 */
export const validateNumericPolicyValue = (targetKey: string, input: unknown): AppConfigValueVerdict => {
  const spec = NUMERIC_POLICY_SPECS[targetKey];
  if (!spec) return rejectUnknownKey([targetKey], APP_CONFIG_LEGAL_KEYS, 'Unknown key(s) are not writable via /api/admin/settings');
  if (!isJsonbObject(input)) {
    return {
      ok: false, code: 'LEDGER_AMOUNT_INVALID', message: 'Setting value must be a JSON object',
      details: { field: 'value', reason: SETTINGS_WRITE_REASONS.valueNotObject, expected: 'object', got: shapeOf(input) },
    };
  }
  const unknown = Object.keys(input).filter((k) => !hasOwn(spec.fields, k));
  if (unknown.length) return rejectUnknownKey(unknown, Object.keys(spec.fields), `Unknown field(s) are not writable for ${targetKey}`);
  for (const [field, expected] of Object.entries(spec.fields)) {
    if (!hasOwn(input, field)) continue;
    const value = input[field];
    if (!fieldTypeMatches(expected, value)) return rejectType(field, expected, value);
    const domain = spec.domain[field];
    if (domain && !domain(value as number)) return rejectType(field, spec.domainLabel[field] || 'domain', value, 'Setting field value is out of domain');
  }
  return { ok: true, value: input };
};

/**
 * `B6` / `B7` 覆盖层键的 `AV2`（字段闭集）→ `AV3`（逐字段 = `{zh,en,hk,vn}` 非空串对象）判定。
 * ★ **四语键集必须相等**：某字段的键集 ≠ 恰 4 语 ⇒ 拒（缺语 / 多语皆判负 · 沿 §29.13④）。
 * 缺字段合法（部分补丁）；未知字段 / 未知语言 ⇒ `unknownKey`（`legal_keys` = 字段清单 / 四语闭集）。
 */
export const validateOverlayValue = (targetKey: string, fields: readonly string[], input: unknown): AppConfigValueVerdict => {
  if (!isJsonbObject(input)) {
    return {
      ok: false, code: 'LEDGER_AMOUNT_INVALID', message: 'Setting value must be a JSON object',
      details: { field: 'value', reason: SETTINGS_WRITE_REASONS.valueNotObject, expected: 'object', got: shapeOf(input) },
    };
  }
  const unknown = Object.keys(input).filter((k) => !fields.includes(k));
  if (unknown.length) return rejectUnknownKey(unknown, fields, `Unknown field(s) are not writable for ${targetKey}`);
  for (const field of fields) {
    if (!hasOwn(input, field)) continue;
    const perLang = input[field];
    if (!isJsonbObject(perLang)) return rejectType(field, 'language_object', perLang);
    const unknownLangs = Object.keys(perLang).filter((l) => !(OVERLAY_LANGS as readonly string[]).includes(l));
    if (unknownLangs.length) return rejectUnknownKey(unknownLangs, OVERLAY_LANGS, `Unknown language(s) are not writable for ${targetKey}`);
    for (const lang of OVERLAY_LANGS) {
      if (!hasOwn(perLang, lang)) return rejectType(`${field}.${lang}`, 'non_empty_string', undefined, 'Overlay language set is incomplete');
      const text = perLang[lang];
      if (typeof text !== 'string' || text.trim().length === 0) return rejectType(`${field}.${lang}`, 'non_empty_string', text);
    }
  }
  return { ok: true, value: input };
};

/** 覆盖层字段的**读侧解析**（fail-closed）：非法 / 缺语 / 多语 ⇒ `null`（调用方回落 locale 基值）。 */
const parseOverlayField = (value: unknown): Record<string, string> | null => {
  if (!isJsonbObject(value)) return null;
  if (Object.keys(value).length !== OVERLAY_LANGS.length) return null;
  const out: Record<string, string> = {};
  for (const lang of OVERLAY_LANGS) {
    if (!hasOwn(value, lang)) return null;
    const text = value[lang];
    if (typeof text !== 'string' || text.trim().length === 0) return null;
    out[lang] = text;
  }
  return out;
};

/** `B7` `role_names` 读侧解析（fail-closed）：非法 ⇒ `null` ⇒ 前端回落 locale（**绝不空串**）。 */
export const parseRoleNamesOverride = (value: unknown): Record<string, Record<string, string>> | null => {
  if (!isJsonbObject(value)) return null;
  if (Object.keys(value).some((k) => !(ROLE_NAME_FIELDS as readonly string[]).includes(k))) return null;
  const out: Record<string, Record<string, string>> = {};
  for (const field of ROLE_NAME_FIELDS) {
    if (!hasOwn(value, field)) continue;
    const parsed = parseOverlayField(value[field]);
    if (parsed === null) return null;
    out[field] = parsed;
  }
  return out;
};

/** `B6` `site_text_overrides` 读侧解析（fail-closed）：非法 ⇒ `null` ⇒ 前端回落 locale（**绝不空串**）。 */
export const parseSiteTextOverridesOverlay = (value: unknown): Record<string, Record<string, string>> | null => {
  if (!isJsonbObject(value)) return null;
  if (Object.keys(value).some((k) => !(SITE_TEXT_FIELDS as readonly string[]).includes(k))) return null;
  const out: Record<string, Record<string, string>> = {};
  for (const field of SITE_TEXT_FIELDS) {
    if (!hasOwn(value, field)) continue;
    const parsed = parseOverlayField(value[field]);
    if (parsed === null) return null;
    out[field] = parsed;
  }
  return out;
};

/**
 * `AK2` 读侧解析（`route-layer.spec` §20.7「先读 `AK2` · 读不到 / 非法 ⇒ **fail-closed 到常量**」）：
 * 入参 = `app_config.value` 的**原始值**（读不到 / 行不存在 ⇒ 传 `null` / `undefined`）。
 * 合法（jsonb object 且**字段 ⊆ 关闭集** `{amount}` 且 `amount` 为**正整数**）⇒ 返 `amount`；**其余一律返 `null`**
 * （⇒ 调用方回落兜底常量）。★ **不发明数值**、**不隐式转换**（字符串型金额 `"50000"` ⇒ `null` ⇒ 回落常量）。
 * 纯函数（离线可判负），**零 DB / 零副作用**。
 */
export const parseListingDepositPolicyAmount = (value: unknown): number | null => {
  if (!isJsonbObject(value)) return null;
  const obj = value as Record<string, unknown>;
  // 字段层（`AG3`(ii)）：容器内**只允许** `LISTING_DEPOSIT_POLICY_FIELDS`（关闭集）——
  //   出现清单外字段（如 `{"balance":…}`，§23.8 禁形）⇒ 判为非法 ⇒ 回落常量（fail-closed）。
  if (Object.keys(obj).some((k) => !LISTING_DEPOSIT_POLICY_FIELDS.includes(k))) return null;
  const amount = obj.amount;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null;
  return amount;
};

/** `AK2` 键名的**唯一常量**（读 / 判据共用；不得散落字面量 —— §21.3 规则① 同族纪律）。 */
export const LISTING_DEPOSIT_POLICY_KEY = 'listing_deposit_policy' as const;

const PRIZE_MARKET_THRESHOLD_SECONDS = 30 * 24 * 60 * 60;
const PRIZE_PRICE_FLOOR_MIN_DURATION_SECONDS = 30 * 24 * 60 * 60;

const resolvePrizeDurationSeconds = (timeStart: number, timeEnd: number) => {
  const normalizedStart = Math.max(0, Math.trunc(Number(timeStart) || 0));
  const normalizedEnd = Math.max(0, Math.trunc(Number(timeEnd) || 0));
  if (!normalizedStart || !normalizedEnd || normalizedEnd <= normalizedStart) {
    return 0;
  }
  return normalizedEnd - normalizedStart;
};

const isPrizePriceFloorEligible = (timeStart: number, timeEnd: number) => (
  resolvePrizeDurationSeconds(timeStart, timeEnd) > PRIZE_PRICE_FLOOR_MIN_DURATION_SECONDS
);

const resolveMinimumShardPrice = (marketFloorPoints: number) => (
  Math.max(0, Math.ceil(Math.max(0, Math.trunc(Number(marketFloorPoints) || 0)) / 1000))
);

let sqlClient: ReturnType<typeof neon> | null = null;

const resolveDatabaseUrl = () => (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.jinli_DATABASE_URL ||
  process.env.jinli_POSTGRES_URL ||
  process.env.jinli_POSTGRES_PRISMA_URL ||
  process.env.jinli_DATABASE_URL_UNPOOLED ||
  process.env.jinli_POSTGRES_URL_NON_POOLING ||
  ''
);

const getSql = () => {
  if (sqlClient) {
    return sqlClient;
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('Database URL not found in environment variables');
  }

  sqlClient = neon(databaseUrl);
  return sqlClient;
};

const asItems = <T>(result: unknown): T[] => result as T[];

// ============================================================================
// 批 8③（`route-layer.spec` v2.5 §20.4(d) · `R-8-18`）：上市路径 DB 侧语句**单一真源** +
// 「既有事务内（`ex`）」执行口 —— 让「服务层（neon）路径」与「真生效四段探针的事务内路径」
// **共用同一份 SQL**（防「自写第二套取数」）。语义与改前 tagged-template 版**逐字等价**（仅占位符化）。
// ============================================================================
/** 语句执行器最小接口（`db.ts` 的 `TxClient` 与 neon `Sql` 都满足其可执行形态）。 */
type SqlRunner = { query: (text: string, params?: unknown[]) => Promise<{ rows: RawRow[] }> };

/** 上市（`POST /api/currency/:cid/list`）的 DB 侧唯一显式语句（单语句 CTE = 一个隐式事务）。 */
const LIST_CURRENCY_WITH_DEPOSIT_SQL = `
      WITH cur AS (
        SELECT c.cid, c.owner_uid, c.status, c.deposit_cid
        FROM public.currency AS c
        WHERE c.cid = $1::bigint
        FOR UPDATE
      ),
      keyhit AS (
        SELECT e.request_fingerprint::text AS fp
        FROM public.ledger_entry AS e
        WHERE e.idempotency_key = $2::text
        LIMIT 1
      ),
      apply AS (
        UPDATE public.currency AS c
        SET status = 'listed',
            listed_at = now(),
            deposit_amount = $3::bigint,
            time_updated = now()
        WHERE c.cid = $1::bigint
          AND c.status = 'draft'
          AND (SELECT cur.owner_uid FROM cur) = $4::bigint
          -- ★★ 批 8④ C2 审核闸（fail-closed · route-layer.spec v2.8 §23.5 ④）：
          --    无「已通过审核的台账行」（currency_review_log.result='approved'）⇒ 本 CTE 不产行
          --    ⇒ 整条语句零副作用（不改 status / 不写 currency_status_log / 零账本分录）
          --    ⇒ 服务层落既有 stateConflict('currency.status','CURRENCY_STATE_INVALID',
          --      required_from='draft') @ currency-service.ts:454（未审 draft 不得上市）。
          --    闸在唯一写路径的 SQL 内（R-8-18 单一真源）⇒ 服务层 / 探针两路共用、不可绕过。
          --    台账表为 append-only（0025）⇒「已通过」单调不可撤销 ⇒ 无 TOCTOU 逃逸。
          AND EXISTS (
            SELECT 1 FROM public.currency_review_log AS r
             WHERE r.cid = $1::bigint AND r.result = 'approved'
          )
        RETURNING c.cid, c.symbol, c.owner_uid, c.status, c.decimals,
                  c.deposit_amount, c.deposit_cid, c.listed_at
      ),
      slog AS (
        INSERT INTO public.currency_status_log (cid, from_status, to_status, actor_uid, memo)
        SELECT $1::bigint, 'draft', 'listed', $4::bigint, $5::text
        FROM apply
        RETURNING log_id
      ),
      ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'entries',
          'idempotency_key', $2::text,
          'request_fingerprint', $6::text,
          'ref_type', 'currency',
          'ref_id', $7::text,
          'memo', $5::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', (SELECT cur.owner_uid::text FROM cur), 'cid', '1',
              'delta', $8::text, 'kind', 'currency_create_fee',
              'ref_type', 'currency', 'ref_id', $7::text),
            jsonb_build_object('uid', '-1', 'cid', '1',
              'delta', $9::text, 'kind', 'currency_create_fee',
              'ref_type', 'currency', 'ref_id', $7::text),
            jsonb_build_object('uid', (SELECT cur.owner_uid::text FROM cur),
              'cid', (SELECT cur.deposit_cid::text FROM cur),
              'delta', $10::text, 'kind', 'listing_deposit',
              'ref_type', 'currency', 'ref_id', $7::text),
            jsonb_build_object('uid', '-1',
              'cid', (SELECT cur.deposit_cid::text FROM cur),
              'delta', $11::text, 'kind', 'listing_deposit',
              'ref_type', 'currency', 'ref_id', $7::text)
          )
        )) AS r
        FROM apply
      )
      SELECT
        (SELECT count(*)::int FROM cur) AS cur_found,
        (SELECT cur.status FROM cur) AS cur_status,
        (SELECT cur.owner_uid::text FROM cur) AS cur_owner,
        (SELECT count(*)::int FROM apply) AS applied,
        (SELECT to_jsonb(a) FROM (SELECT * FROM apply) AS a) AS applied_row,
        (SELECT ev.r FROM ev) AS ledger_result,
        (SELECT keyhit.fp FROM keyhit) AS key_fingerprint
    `;

// ============================================================================
// 批 8④（`route-layer.spec` v2.8 §23 · `data-layer.spec` v0.15 §26）：自建单位审核（变体 Ⅱ 旁路台账）
// DB 侧**单一真源**语句 + 「既有事务内（`ex`）」执行口（与 `LIST_CURRENCY_WITH_DEPOSIT_SQL` 同族）。
// ----------------------------------------------------------------------------
// ★ 一条语句（CTE = **一个隐式事务**）= 三件事同生同灭（§26.4 / §23.3(a) 事务纪律）：
//   ① `apply` ：**仅通过路径**（result='approved'）走**既有** `draft → listed` 边
//               （`SET status='listed', listed_at=now()` —— 满足 `0001:37` 的 `currency_listed_at` CHECK）；
//   ② `slog`  ：**仅通过路径**同事务写 `public.currency_status_log` **恰 1 行**
//               （from_status='draft' / to_status='listed' / actor_uid=admin；DL157②③）；
//   ③ `review`：台账行 `public.currency_review_log` **恰 1 行**（通过/驳回**都写** —— 驳回必须落台账，
//               §26.4 / §23.3(b)：**驳回不得静默**）。
// ★ 幂等（`0023` 裁定四）：同键同 `result` 重投 ⇒ `prior` 命中 ⇒ **不写第二行**（`DO NOTHING` 兜底）；
//   同键异 `result`（先驳后成 / 先成后驳）⇒ 允许，各留一行。
// ★ 状态闸（§26.5）：单位非 `draft` ⇒ `review`/`apply` 均不落 ⇒ 服务层映射既有码 `LD011`（409）；
//   单位不存在 ⇒ `cur_found=0` ⇒ 服务层映射既有码 `LD007`（404）。**零新增错误码**（33 码闭集不动）。
// ★ 无退还 / 罚没面（`R-8-17` / `DL67` / `DL88`）：本语句**零账本分录**（不调 `ledger_post_event`）。
// ============================================================================
/** 审核动作（`POST /api/admin/currency/:cid/review`）的 DB 侧唯一显式语句（单语句 CTE = 一个隐式事务）。 */
const CURRENCY_REVIEW_POST_EVENT_SQL = `
      WITH cur AS (
        SELECT c.cid, c.status
        FROM public.currency AS c
        WHERE c.cid = $1::bigint
        FOR UPDATE
      ),
      prior AS (
        SELECT r.log_id
        FROM public.currency_review_log AS r
        WHERE r.idempotency_key = $5::text
          AND r.result = $3::text
        LIMIT 1
      ),
      apply AS (
        UPDATE public.currency AS c
        SET status = 'listed',
            listed_at = now(),
            time_updated = now()
        WHERE c.cid = $1::bigint
          AND $3::text = 'approved'
          AND c.status = 'draft'
          AND NOT EXISTS (SELECT 1 FROM prior)
        RETURNING c.cid, c.status
      ),
      slog AS (
        INSERT INTO public.currency_status_log (cid, from_status, to_status, actor_uid, memo)
        SELECT $1::bigint, 'draft', 'listed', $2::bigint, 'currency_review:approved'
        FROM apply
        RETURNING log_id
      ),
      review AS (
        INSERT INTO public.currency_review_log
          (cid, actor_uid, result, request_fingerprint, idempotency_key, memo)
        SELECT $1::bigint, $2::bigint, $3::text, $4::text, $5::text, $6::text
        FROM cur
        WHERE cur.status = 'draft'
          AND NOT EXISTS (SELECT 1 FROM prior)
          AND ($3::text <> 'approved' OR EXISTS (SELECT 1 FROM apply))
        ON CONFLICT (idempotency_key, result) DO NOTHING
        RETURNING log_id, result
      )
      SELECT
        (SELECT count(*)::int FROM cur)   AS cur_found,
        (SELECT cur.status FROM cur)      AS cur_status,
        (SELECT count(*)::int FROM prior) AS prior_count,
        (SELECT count(*)::int FROM apply) AS applied,
        (SELECT count(*)::int FROM slog)  AS slogged,
        (SELECT count(*)::int FROM review) AS reviewed
    `;

/** `CURRENCY_REVIEW_POST_EVENT_SQL` 的 `$1..$6` 绑定（顺序写死）。 */
const currencyReviewPostEventParams = (input: {
  cid: number; actorUid: number; result: 'approved' | 'rejected';
  requestFingerprint: string; idempotencyKey: string; memo: string;
}): unknown[] => [
  input.cid,                       // $1  cid（bigint；cur / apply / slog / review 复用）
  input.actorUid,                  // $2  actor_uid（bigint；= admin）
  input.result,                    // $3  result（text；'approved' | 'rejected'）
  input.requestFingerprint,        // $4  request_fingerprint（text）
  input.idempotencyKey,            // $5  idempotency_key（text；ops:<admin_uid>:currency_review:<cid>）
  input.memo,                      // $6  memo（text；= reason）
];

// ============================================================================
// 批 8⑤（`route-layer.spec` v2.10 §25.2 / `data-layer.spec` v0.17 §28.6）：商品合规下架（takedown）
//   的 DB 侧唯一显式语句（单语句 CTE = 一个隐式事务；**商品无账务分录** DL59 ⇒ 零 `ledger_post_event`）。
//   · 台账 `public.listing_review_log`（`0026`）：通过（approved）与驳回（rejected）**都必须落行**
//     （`$3 <> 'approved' OR EXISTS(apply)`）；同键同 `result` 重投 ⇒ `ON CONFLICT (idempotency_key, result) DO NOTHING`。
//   · 状态迁移走**既有已白名单边** `public.listing_status_transition_ok`（0015:83-93）：`listed→{delisted,frozen}`。
//   · `txid` 恒 `NULL`（商品无分录 ⇒ 对账**显式豁免**，姊妹册 §25.8(c)）。
//   · 非法状态（非 `listed`）⇒ `reviewed=0` ⇒ 服务层映射既有码 `LD011`（409）；商品不存在 ⇒ `listing_found=0` ⇒ `LD007` 系 404。
// ============================================================================
const LISTING_TAKEDOWN_POST_EVENT_SQL = `
      WITH cur AS (
        SELECT l.listing_id, l.status
        FROM public.listing AS l
        WHERE l.listing_id = $1::bigint
        FOR UPDATE
      ),
      prior AS (
        SELECT r.log_id
        FROM public.listing_review_log AS r
        WHERE r.idempotency_key = $5::text
          AND r.result = $3::text
        LIMIT 1
      ),
      apply AS (
        UPDATE public.listing AS l
        SET status = $7::text,
            time_updated = now()
        WHERE l.listing_id = $1::bigint
          AND $3::text = 'approved'
          AND (SELECT cur.status FROM cur) = 'listed'
          AND public.listing_status_transition_ok((SELECT cur.status FROM cur), $7::text)
          AND NOT EXISTS (SELECT 1 FROM prior)
        RETURNING l.listing_id, l.status
      ),
      review AS (
        INSERT INTO public.listing_review_log
          (listing_id, actor_uid, result, request_fingerprint, idempotency_key, txid, memo)
        SELECT $1::bigint, $2::bigint, $3::text, $4::text, $5::text, NULL, $6::text
        FROM cur
        WHERE cur.status = 'listed'
          AND NOT EXISTS (SELECT 1 FROM prior)
          AND ($3::text <> 'approved' OR EXISTS (SELECT 1 FROM apply))
        ON CONFLICT (idempotency_key, result) DO NOTHING
        RETURNING log_id, result
      )
      SELECT
        (SELECT count(*)::int FROM cur)   AS listing_found,
        (SELECT cur.status FROM cur)      AS listing_status,
        (SELECT count(*)::int FROM prior) AS prior_count,
        (SELECT count(*)::int FROM apply) AS applied,
        (SELECT count(*)::int FROM review) AS reviewed
    `;

/** `LISTING_TAKEDOWN_POST_EVENT_SQL` 的 `$1..$7` 绑定（顺序写死）。 */
const listingTakedownPostEventParams = (input: {
  listingId: number; actorUid: number; result: 'approved' | 'rejected';
  targetStatus: string; requestFingerprint: string; idempotencyKey: string; memo: string;
}): unknown[] => [
  input.listingId,                 // $1  listing_id（bigint；cur / apply / review 复用）
  input.actorUid,                  // $2  actor_uid（bigint；= admin）
  input.result,                    // $3  result（text；'approved' | 'rejected'）
  input.requestFingerprint,        // $4  request_fingerprint（text）
  input.idempotencyKey,            // $5  idempotency_key（text；ops:<admin_uid>:listing_takedown:<listingId>）
  input.memo,                      // $6  memo（text；= reason）
  input.targetStatus,              // $7  target_status（text；'delisted' | 'frozen'）
];

/** `listCurrencyWithDeposit` 入参 → `LIST_CURRENCY_WITH_DEPOSIT_SQL` 的 `$1..$11` 绑定（顺序写死）。 */
const listCurrencyWithDepositParams = (input: {
  cid: number; actorUid: number; fee: number; depositAmount: number;
  idempotencyKey: string; requestFingerprint: string; memo: string;
}): unknown[] => [
  input.cid,                     // $1  cid（bigint；cur / apply / slog / ref_id 复用）
  input.idempotencyKey,          // $2  idempotency_key（text）
  input.depositAmount,           // $3  deposit_amount（bigint）
  input.actorUid,                // $4  actor_uid（bigint）
  input.memo,                    // $5  memo（text）
  input.requestFingerprint,      // $6  request_fingerprint（text）
  String(input.cid),             // $7  ref_id（text）
  String(-input.fee),            // $8  fee 腿 delta（text）
  String(input.fee),             // $9  fee 腿 delta（text）
  String(-input.depositAmount),  // $10 保证金腿 delta（text）
  String(input.depositAmount),   // $11 保证金腿 delta（text）
];

/**
 * 执行 `text + params`：给了 `ex`（**既有事务**）⇒ 走它；否则走 neon 单语句（隐式事务）。
 * ★ 抽出来是为「真生效四段」探针能在**同一事务内**调 `list` 同路径语句（`R-8-18`），
 *   从而**零生产落盘**（末尾 `ROLLBACK`）。两路径**同一 SQL**，无第二套取数。
 */
const runSql = async (text: string, params: unknown[], ex?: SqlRunner): Promise<RawRow[]> => (
  ex
    ? (await ex.query(text, params)).rows
    : extractRows(await (getSql() as unknown as (t: string, p: unknown[]) => Promise<unknown>)(text, params))
);

const extractRows = (result: unknown): RawRow[] => {
  const items = asItems<Record<string, unknown>>(result);
  return items
    .map((item) => {
      const maybeRow = item?.row;
      return maybeRow && typeof maybeRow === 'object' ? maybeRow as RawRow : item as RawRow;
    })
    .filter((item) => item && typeof item === 'object');
};

const getValue = (row: RawRow, ...keys: string[]) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined) {
      return row[key];
    }
  }

  return undefined;
};

/**
 * ★ P9② 库面收口（`R-8-18` 同向 · 单一真源）：batt / 签到 / 补签 / 双闸 六方法的 **tagged-template
 *   执行口的事务内注入**。给了 `ex`（`db.ts` 的 `TxClient`，既有事务）⇒ 用它充当 tagged-template：
 *   把模板串的洞按 neon 同语义占位符化为 `$1..$n`（值作参数绑定），返回 `rows` 数组；否则走 `getSql()`
 *   （neon 单语句隐式事务）。⇒ 服务层路径与「真链路探针的事务内路径」**共用同一份 SQL**，无第二套取数。
 */
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<RawRow[]>;
const sqlFor = (ex?: SqlRunner): SqlTag => {
  if (!ex) return getSql() as unknown as SqlTag;
  const runner: SqlTag = async (strings, ...values) => {
    let text = '';
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i += 1) {
      text += strings[i];
      if (i < values.length) {
        params.push(values[i]);
        text += `$${params.length}`;
      }
    }
    const out = (await ex.query(text, params)).rows;
    return out;
  };
  return runner;
};

const toStringValue = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    return String(value);
  }
  return '';
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const toNumberValue = (...values: unknown[]) => {
  for (const value of values) {
    const next = toOptionalNumber(value);
    if (next !== null) {
      return next;
    }
  }
  return 0;
};

const toBooleanValue = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'f', 'no', 'n', 'off'].includes(normalized)) return false;
  }

  return false;
};

const toArrayValue = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return [];
    }

    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return normalized
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const uniqueNumbers = (values: number[]) => Array.from(new Set(values.filter((value) => Number.isFinite(value))));

const toStringArray = (...values: unknown[]) => {
  for (const value of values) {
    const items = toArrayValue(value)
      .map((item) => String(item).trim())
      .filter(Boolean);
    if (items.length > 0) {
      return uniqueStrings(items);
    }
  }

  return [] as string[];
};

const toNumberArray = (...values: unknown[]) => {
  for (const value of values) {
    const items = toArrayValue(value)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .map((item) => Math.trunc(item));
    if (items.length > 0) {
      return uniqueNumbers(items);
    }
  }

  return [] as number[];
};

const toTimestamp = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;

    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
    }

    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && String(value).trim() !== '') {
      return asNumber > 1_000_000_000_000 ? Math.floor(asNumber / 1000) : Math.floor(asNumber);
    }

    const parsed = Date.parse(String(value));
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return 0;
};

const firstRow = (result: unknown) => extractRows(result)[0] || null;

const slugify = (value: string) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

export interface AssetRecord {
  index_id: number;
  uID: number;
  points: number;
  lucks: number;
  time_update: number;
}

/**
 * P7-A：`ledger_entry` 的**对外读形状**（账本流水行）。
 * 键名 = 真列名（`data-layer.spec` DL25 只冻结分页口径，未冻结列集 ⇒ 对齐本仓既有读面惯例：
 * 读面**归一为固定业务键集**，不裸露内部机械列）。**刻意排除**三个内部列：
 * `idempotency_key` / `request_fingerprint` / `event_root_key`（幂等机械，R48/R51/R53 的实现细节，
 * 非账单语义；见报告 §5 说明）。其余列逐字保留真列名。
 */
export interface LedgerEntryRecord {
  txid: number;
  uid: number;
  cid: number;
  delta: number;
  frozen_delta: number;
  balance_after: number;
  frozen_after: number;
  kind: string;
  ref_type: string | null;
  ref_id: number | null;
  reversal_of_txid: number | null;
  memo: string;
  time_created: number;
}

export interface UserRecord {
  uID: number;
  EVM: string;
  bio: string;
  is_admin: boolean;
  time_reg: number;
  time_login_last: number;
}

export interface BrandRecord {
  bID: number;
  symbol: string;
  name: string;
  description: string;
  image_url: string;
  url_image: string;
  points: number;
  market_floor_points: number;
  duration_seconds: number;
  price_floor_eligible: boolean;
  price_floor_enabled: boolean;
  price_floor_active: boolean;
  minimum_shard_price: number;
  gift_limit: number;
  total_quantity: number;
  available_quantity: number;
  issued_quantity: number;
  redeemed_quantity: number;
  free_shard_ratio: number;
  free_shard_quota: number;
  free_shards_distributed: number;
  free_shards_remaining: number;
  market_shard_cap: number;
  current_shard_supply: number;
  remaining_market_shards: number;
  circulation_seconds: number;
  liquidation_seconds: number;
  lifecycle_status: 'circulation' | 'liquidation' | 'expired';
  market_is_open: boolean;
  time_start: number;
  time_end: number;
  time_created: number;
  time_updated: number;
  time_actived: number;
  stores_count: number;
  claims_count: number;
  activated_count: number;
  name_en: string;
  name_hk: string;
  name_vn: string;
  description_en: string;
  description_hk: string;
  description_vn: string;
  /** P6-TR-1b 读侧翻译覆盖度：所有可译字段 × en/vn/hk 全 ready ⇒ 'ready'；一个都没有 ⇒ 'pending'；否则 'partial'。 */
  i18n_status: I18nStatus;
}

export type PrizeRecord = BrandRecord;

export interface PrizeItemRecord {
  gID: number;
  bID: number;
  uID: number;
  time_created: number;
  time_claimed: number;
  time_actived: number;
}

export interface TaskRecord {
  tID: number;
  title: string;
  note: string;
  refcode: string;
  link0: string;
  linkA: string;
  linkB: string;
  points: number;
  type: number;
  time_start: number;
  time_end: number;
  time_created: number;
  time_updated: number;
  is_open: boolean;
  participants_count: number;
  title_en: string;
  title_hk: string;
  title_vn: string;
  note_en: string;
  note_hk: string;
  note_vn: string;
  /** P6-TR-1b 读侧翻译覆盖度（同 BrandRecord.i18n_status）。 */
  i18n_status: I18nStatus;
}

export interface TaskProgressRecord {
  jID: number;
  tID: number;
  uID: number;
  info_input: string;
  time_created: number;
  time_submitted: number;
  time_checked: number;
  time_claimed: number;
  points_claimed: number;
}

export interface PendingVerificationRecord extends TaskProgressRecord {
  task: TaskRecord | null;
  user: {
    uID: number;
    EVM: string;
    is_admin: boolean;
  } | null;
}

export interface AdminAccessRecord {
  uID: number;
  EVM: string;
  is_admin: boolean;
  permissions: string[];
  can_access_admin: boolean;
  preferred_admin_path: string;
}

export interface SystemSettingsRecord {
  siteName: string;
  siteDescription: string;
  maintenance: boolean;
  allowRegistration: boolean;
  emailNotifications: boolean;
  defaultLanguage: string;
  pointsPerTask: number;
  maxDailyTasks: number;
  rewardCooldown: number;
}

export interface PermissionGroupRecord {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  user_ids: number[];
  readonly: boolean;
  time_created: number;
  time_updated: number;
}

export interface ShardHoldingRecord {
  sID: number;
  bID: number;
  uID: number;
  volume: number;
  time_created: number;
  symbol: string;
  brand_name: string;
}

export interface MarketOrderRecord {
  oID: number;
  bID: number;
  uID: number;
  side: 'buy' | 'sell';
  price: number;
  volume_total: number;
  volume_filled: number;
  status: string;
  time_created: number;
  time_updated: number;
  symbol: string;
  brand_name: string;
}

export interface MarketOrderBookRow {
  side: 'buy' | 'sell';
  price: number;
  volume: number;
}

export interface MarketTradeRecord {
  trID: number;
  bID: number;
  buy_oID: number;
  sell_oID: number;
  buyer_uID: number;
  seller_uID: number;
  price: number;
  volume: number;
  time_created: number;
  brand_symbol: string;
}

export interface ShardTransferRecord {
  txID: number;
  bID: number;
  from_uID: number | null;
  to_uID: number | null;
  volume: number;
  reason: string;
  related_oID: number | null;
  related_trID: number | null;
  time_created: number;
  brand_symbol: string;
}

type BrandAggregateCounts = {
  stores_count: number;
  claims_count: number;
  activated_count: number;
  current_shard_supply: number;
  free_shards_distributed: number;
};

// P4-B1-a: 系统币读侧改走 `account`（cid = SYSTEM_CURRENCY_CID）。
// 键契约不变（index_id/uID/points/lucks/time_update 恒在）；`balance`/`uid` 仅作 account 行的回退键。
const normalizeAsset = (row: RawRow): AssetRecord => ({
  index_id: toNumberValue(getValue(row, 'index_id', 'aID', 'id')),
  uID: toNumberValue(getValue(row, 'uID', 'uid')),
  points: toNumberValue(getValue(row, 'points', 'balance')),
  lucks: toNumberValue(getValue(row, 'lucks')),
  time_update: toTimestamp(getValue(row, 'time_updated')),
});

// P7-A：账本流水行归一（键集见 `LedgerEntryRecord` 注释；可空列保留 `null`，不塌成 0）。
const normalizeLedgerEntry = (row: RawRow): LedgerEntryRecord => ({
  txid: toNumberValue(getValue(row, 'txid')),
  uid: toNumberValue(getValue(row, 'uid')),
  cid: toNumberValue(getValue(row, 'cid')),
  delta: toNumberValue(getValue(row, 'delta')),
  frozen_delta: toNumberValue(getValue(row, 'frozen_delta')),
  balance_after: toNumberValue(getValue(row, 'balance_after')),
  frozen_after: toNumberValue(getValue(row, 'frozen_after')),
  kind: toStringValue(getValue(row, 'kind')),
  ref_type: getValue(row, 'ref_type') === undefined ? null : String(getValue(row, 'ref_type')),
  ref_id: toOptionalNumber(getValue(row, 'ref_id')),
  reversal_of_txid: toOptionalNumber(getValue(row, 'reversal_of_txid')),
  memo: toStringValue(getValue(row, 'memo')),
  time_created: toTimestamp(getValue(row, 'time_created')),
});

// P4-B2a-HTTP: users 真列名 = uid/evm（bio/is_admin/time_reg/time_login_last 同名）。
// 回退键追加在旧键之后 ⇒ 响应键集（uID/EVM/bio/is_admin/time_reg/time_login_last）逐字不变。
const normalizeUser = (row: RawRow): UserRecord => ({
  uID: toNumberValue(getValue(row, 'uID', 'uid', 'id')),
  EVM: toStringValue(getValue(row, 'EVM', 'evm')),
  bio: toStringValue(getValue(row, 'bio')),
  is_admin: toBooleanValue(getValue(row, 'is_admin')),
  time_reg: toTimestamp(getValue(row, 'time_reg')),
  time_login_last: toTimestamp(getValue(row, 'time_login_last')),
});

const normalizeBrand = (
  row: RawRow,
  counts?: {
    stores_count?: number;
    claims_count?: number;
    activated_count?: number;
    current_shard_supply?: number;
    free_shards_distributed?: number;
  },
  i18nIndex?: I18nIndex | null,
): BrandRecord => {
  const imageUrl = toStringValue(getValue(row, 'image_url', 'url_image'));
  const timeStart = toTimestamp(getValue(row, 'time_start'));
  const timeEnd = toTimestamp(getValue(row, 'time_end'));
  const durationSeconds = resolvePrizeDurationSeconds(timeStart, timeEnd);
  const totalQuantity = Math.max(
    toNumberValue(getValue(row, 'total_quantity')),
    toNumberValue(getValue(row, 'gift_limit')),
    (counts?.stores_count ?? 0) + (counts?.claims_count ?? 0),
  );
  const availableQuantity = counts?.stores_count ?? 0;
  const issuedQuantity = counts?.claims_count ?? 0;
  const redeemedQuantity = counts?.activated_count ?? 0;
  const marketFloorPoints = Math.max(0, toNumberValue(getValue(row, 'market_floor_points')));
  const freeShardRatio = Math.min(100, Math.max(0, toNumberValue(getValue(row, 'free_shard_ratio'))));
  const freeShardQuota = Math.floor(totalQuantity * 1000 * (freeShardRatio / 100));
  const currentShardSupply = Math.max(0, counts?.current_shard_supply ?? 0);
  const freeShardsDistributed = Math.max(0, counts?.free_shards_distributed ?? 0);
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = timeEnd > now ? timeEnd - now : 0;
  const lifecycleStatus: BrandRecord['lifecycle_status'] = remainingSeconds <= 0
    ? 'expired'
    : remainingSeconds > PRIZE_MARKET_THRESHOLD_SECONDS
      ? 'circulation'
      : 'liquidation';
  const circulationSeconds = lifecycleStatus === 'circulation'
    ? Math.max(0, remainingSeconds - PRIZE_MARKET_THRESHOLD_SECONDS)
    : 0;
  const liquidationSeconds = lifecycleStatus === 'expired'
    ? 0
    : Math.min(PRIZE_MARKET_THRESHOLD_SECONDS, remainingSeconds);
  const priceFloorEligible = isPrizePriceFloorEligible(timeStart, timeEnd);
  const priceFloorEnabled = priceFloorEligible && marketFloorPoints > 0;
  const minimumShardPrice = priceFloorEnabled ? resolveMinimumShardPrice(marketFloorPoints) : 0;
  const priceFloorActive = priceFloorEnabled && lifecycleStatus === 'circulation';
  const marketShardCap = Math.max((totalQuantity - redeemedQuantity) * 1000, 0);
  const remainingMarketShards = Math.max(marketShardCap - currentShardSupply, 0);
  const freeShardsRemaining = Math.max(
    Math.min(freeShardQuota - freeShardsDistributed, remainingMarketShards),
    0,
  );
  const record: Record<string, unknown> = {
    // P4-B1-c: listing 读侧回退键（旧列名在前 ⇒ 旧行为不变；listing 列名在后）：
    // bID←listing_id、name←title、points←price。symbol/image_url/时间窗等 listing 无对应列 ⇒ 沿用空态默认（不编值）。
    bID: toNumberValue(getValue(row, 'bID', 'listing_id')),
    symbol: toStringValue(getValue(row, 'symbol')),
    name: toStringValue(getValue(row, 'name', 'title')),
    description: toStringValue(getValue(row, 'description')),
    image_url: imageUrl,
    url_image: imageUrl,
    points: toNumberValue(getValue(row, 'points', 'price')),
    market_floor_points: marketFloorPoints,
    duration_seconds: durationSeconds,
    price_floor_eligible: priceFloorEligible,
    price_floor_enabled: priceFloorEnabled,
    price_floor_active: priceFloorActive,
    minimum_shard_price: minimumShardPrice,
    gift_limit: Math.max(toNumberValue(getValue(row, 'gift_limit')), totalQuantity),
    total_quantity: totalQuantity,
    available_quantity: availableQuantity,
    issued_quantity: issuedQuantity,
    redeemed_quantity: redeemedQuantity,
    free_shard_ratio: freeShardRatio,
    free_shard_quota: freeShardQuota,
    free_shards_distributed: freeShardsDistributed,
    free_shards_remaining: freeShardsRemaining,
    market_shard_cap: marketShardCap,
    current_shard_supply: currentShardSupply,
    remaining_market_shards: remainingMarketShards,
    circulation_seconds: circulationSeconds,
    liquidation_seconds: liquidationSeconds,
    lifecycle_status: lifecycleStatus,
    market_is_open: lifecycleStatus === 'circulation',
    time_start: timeStart,
    time_end: timeEnd,
    time_created: toTimestamp(getValue(row, 'time_created', 'created_at')),
    time_updated: toTimestamp(getValue(row, 'time_updated', 'updated_at')),
    time_actived: toTimestamp(getValue(row, 'time_actived')),
    stores_count: availableQuantity,
    claims_count: issuedQuantity,
    activated_count: redeemedQuantity,
  };
  // P6-TR-1b：`name_*`/`description_*` 由 applyI18n 生成（有 ready 译文用译文，否则回落源文；含 i18n_status）
  applyI18n('listing', String(record.bID), record, i18nIndex);
  return record as unknown as BrandRecord;
};

const normalizePrizeItem = (row: RawRow): PrizeItemRecord => ({
  gID: toNumberValue(getValue(row, 'gID')),
  bID: toNumberValue(getValue(row, 'bID')),
  uID: toNumberValue(getValue(row, 'uID')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_claimed: toTimestamp(getValue(row, 'time_claimed')),
  time_actived: toTimestamp(getValue(row, 'time_actived')),
});

const normalizeTask = (row: RawRow, participantsCount = 0, i18nIndex?: I18nIndex | null): TaskRecord => {
  const linkA = toStringValue(getValue(row, 'linkA', 'link0'));
  const isOpenValue = getValue(row, 'is_open');
  const record: Record<string, unknown> = {
    // P4-B1-b: task→job 读侧换表 —— 旧列名在前、新列名在后（旧行为不变；job 无对应列走既有空态默认）
    tID: toNumberValue(getValue(row, 'tID', 'job_id')),
    title: toStringValue(getValue(row, 'title')),
    note: toStringValue(getValue(row, 'note', 'description')),
    refcode: toStringValue(getValue(row, 'refcode')),
    link0: toStringValue(getValue(row, 'link0', 'linkA')),
    linkA,
    linkB: toStringValue(getValue(row, 'linkB')),
    points: toNumberValue(getValue(row, 'points', 'reward')),
    type: toNumberValue(getValue(row, 'type')),
    time_start: toTimestamp(getValue(row, 'time_start')),
    time_end: toTimestamp(getValue(row, 'time_end')),
    time_created: toTimestamp(getValue(row, 'time_created', 'created_at')),
    time_updated: toTimestamp(getValue(row, 'time_updated', 'updated_at')),
    is_open: isOpenValue === undefined ? true : toBooleanValue(isOpenValue),
    participants_count: participantsCount,
  };
  // P6-TR-1b：`title_*`/`note_*` 由 applyI18n 生成（有 ready 译文用译文，否则回落源文；含 i18n_status）
  applyI18n('job', String(record.tID), record, i18nIndex);
  return record as unknown as TaskRecord;
};

const normalizeTaskProgress = (row: RawRow): TaskProgressRecord => ({
  jID: toNumberValue(getValue(row, 'jID')),
  tID: toNumberValue(getValue(row, 'tID')),
  uID: toNumberValue(getValue(row, 'uID')),
  info_input: toStringValue(getValue(row, 'info_input')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_submitted: toTimestamp(getValue(row, 'time_submitted')),
  time_checked: toTimestamp(getValue(row, 'time_checked')),
  time_claimed: toTimestamp(getValue(row, 'time_claimed')),
  points_claimed: toNumberValue(getValue(row, 'points_claimed')),
});

/**
 * **读侧**归一（读 DB 行 → 记录；宽容：非 object / 缺字段 ⇒ 回落默认值）。
 * ⚠️ 批 8① 起：本函数**只用于读路径**与**已校验写侧的终态回填**；**写侧输入**一律先过
 * `assertSystemSettingsPatch`（`AG1`/`AG3`）⇒ 未知键**不再**由本函数静默吸收（`AG4`）。
 */
const normalizeSystemSettingsRead = (value: unknown): SystemSettingsRecord => {
  const payload = value && typeof value === 'object' ? value as RawRow : {};

  return {
    siteName: toStringValue(getValue(payload, 'siteName'), DEFAULT_SYSTEM_SETTINGS.siteName),
    siteDescription: toStringValue(getValue(payload, 'siteDescription'), DEFAULT_SYSTEM_SETTINGS.siteDescription),
    maintenance: toBooleanValue(getValue(payload, 'maintenance'), DEFAULT_SYSTEM_SETTINGS.maintenance),
    allowRegistration: toBooleanValue(getValue(payload, 'allowRegistration'), DEFAULT_SYSTEM_SETTINGS.allowRegistration),
    emailNotifications: toBooleanValue(getValue(payload, 'emailNotifications'), DEFAULT_SYSTEM_SETTINGS.emailNotifications),
    defaultLanguage: toStringValue(getValue(payload, 'defaultLanguage'), DEFAULT_SYSTEM_SETTINGS.defaultLanguage),
    pointsPerTask: toNumberValue(getValue(payload, 'pointsPerTask'), DEFAULT_SYSTEM_SETTINGS.pointsPerTask),
    maxDailyTasks: toNumberValue(getValue(payload, 'maxDailyTasks'), DEFAULT_SYSTEM_SETTINGS.maxDailyTasks),
    rewardCooldown: toNumberValue(getValue(payload, 'rewardCooldown'), DEFAULT_SYSTEM_SETTINGS.rewardCooldown),
  };
};

/**
 * 写侧门禁**拒绝**结果（`AG1`/`AG3`）—— 路由层据此构造 R107 错误体。
 * `code` ∈ §14.1 **既有 33 码**（**不新造码**）：一律借「参数形状非法」历史码 `LEDGER_AMOUNT_INVALID`（`400`），
 * 具体形态靠 `details.reason` / `details.field` 区分（`ledger.spec` §14.3 借用方案；见报告 §5）。
 */
export interface SystemSettingsWriteReject {
  ok: false;
  code: 'LEDGER_AMOUNT_INVALID';
  message: string;
  details: Record<string, unknown>;
}

export type SystemSettingsPatchVerdict =
  | { ok: true; value: Partial<SystemSettingsRecord> }
  | SystemSettingsWriteReject;

/** jsonb 容器判定（`AG3`①）：**须为普通对象**（数组 / 裸标量 / null 一律判负）。 */
const isJsonbObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** 值的**形态名**（`details.got` 用；不泄漏原值 —— R107 只放非敏感上下文）。 */
const shapeOf = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const fieldTypeMatches = (expected: string, value: unknown): boolean => {
  if (expected === 'string') return typeof value === 'string';
  if (expected === 'boolean') return typeof value === 'boolean';
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return false;
};

/**
 * ★★ 批 8① 写入门禁判据（`AG1` / `AG3` / `AG4` 的**唯一纯函数真源** · 可离线判负）：
 *   ① 非 jsonb object（裸标量 / 数组 / null） ⇒ 拒（`AG3`①）；
 *   ② 出现**合法字段清单外**的键名（未知键） ⇒ 拒（`AG1`；**整请求拒**，`AG4` ③ 选「整请求拒」支）；
 *   ③ 已知字段**类型不符** ⇒ 拒（`AG3`②）。
 * **不做任何隐式转换 / 不静默吸收 / 不回落默认值**（`AG4` 元规则）。缺省字段合法（部分补丁语义）。
 */
export const validateSystemSettingsPatch = (input: unknown): SystemSettingsPatchVerdict => {
  // ① 容器形状（AG3①）：`value` 必须是 jsonb object
  if (!isJsonbObject(input)) {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Setting value must be a JSON object',
      details: {
        field: 'value',
        reason: SETTINGS_WRITE_REASONS.valueNotObject,
        expected: 'object',
        got: shapeOf(input),
      },
    };
  }

  // ② 未知键（AG1）：逐键列出，整请求拒（AG4③）
  const unknownKeys = Object.keys(input).filter(
    (key) => !Object.prototype.hasOwnProperty.call(SYSTEM_SETTINGS_FIELD_TYPES, key),
  );
  if (unknownKeys.length) {
    const first = unknownKeys[0];
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Unknown key(s) are not writable via /api/admin/settings',
      details: {
        // ★ `R-8-10`：`reason` = **稳定常量**（**不随键名插值**，保证可枚举 / 可映射 i18n）；
        //   未知键**逐个**进 `details.unknown_keys`（数组）；`field` = 首个未知键（便于定位、非机读键）。
        field: first,
        reason: SETTINGS_WRITE_REASONS.unknownKey,
        unknown_keys: unknownKeys,
        legal_keys: [...SYSTEM_SETTINGS_FIELDS],
      },
    };
  }

  // ③ 类型不符（AG3②）：严格比对，不做隐式转换
  for (const [field, expected] of Object.entries(SYSTEM_SETTINGS_FIELD_TYPES)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = (input as Record<string, unknown>)[field];
    if (!fieldTypeMatches(expected, value)) {
      return {
        ok: false,
        code: 'LEDGER_AMOUNT_INVALID',
        message: 'Setting field type is invalid',
        details: {
          field,
          reason: SETTINGS_WRITE_REASONS.typeInvalid,
          expected,
          got: shapeOf(value),
        },
      };
    }
  }

  return { ok: true, value: input as Partial<SystemSettingsRecord> };
};

/**
 * 写侧门禁抛出的**结构化**异常（供 `saveSystemSettings` 在**任何**调用方下都不静默吸收）。
 * 路由层 catch 转 `400` + R107；**不是**实现缺陷 ⇒ **不得**落 500（`DL126`）。
 */
export class SystemSettingsWriteError extends Error {
  readonly code = 'LEDGER_AMOUNT_INVALID' as const;
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'SystemSettingsWriteError';
    this.details = details;
  }
}

/**
 * 严格断言写侧补丁（`AG1`/`AG3`）：不合法 ⇒ **抛** `SystemSettingsWriteError`（**不再静默吞未知键**，`AG4`）。
 * 返回**只含合法字段**的补丁（原样透传，**不补默认值** —— 未给字段在 `saveSystemSettings` 里与现态合流）。
 */
export const assertSystemSettingsPatch = (input: unknown): Partial<SystemSettingsRecord> => {
  const verdict = validateSystemSettingsPatch(input);
  if (!verdict.ok) throw new SystemSettingsWriteError(verdict.message, verdict.details);
  return verdict.value;
};

/**
 * 写入口禁的**路由层 helper**（`AG1`/`AG3`/`AG4`）：
 * 剥离请求信封的控制字段（`create_key` 等）后做白名单/类型判定；返回 verdict 供路由构造 R107 响应。
 * 非 object 请求体（裸标量 / 数组 / null）**原样**交判定 ⇒ 落 `SETTING_VALUE_NOT_OBJECT`（`AG3`①）。
 */
export const screenSystemSettingsWrite = (body: unknown): SystemSettingsPatchVerdict => {
  if (!isJsonbObject(body)) return validateSystemSettingsPatch(body);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if ((SETTINGS_CONTROL_FIELDS as readonly string[]).includes(key)) continue;
    patch[key] = value;
  }
  return validateSystemSettingsPatch(patch);
};

// ============================================================================
// ★★ 批 8③b（`data-layer.spec` v0.13 §24 · `route-layer.spec` v2.6 §21）：
//   键级寻址线格式（**形态 B** = 显式信封 `{ key, value }`）+ `AK1`/`AK2` **校验叠加**
//   （`AV1` 顶层键 → `AV2` 逐键字段闭集 → `AV3` 逐键类型 → `AV4` `amount` 语义域）。
// ============================================================================
// · **零新增错误码 / 零新增 `reason` 常量**（沿用 `SETTINGS_WRITE_REASONS` 三常量；层级靠
//   `details.legal_keys` 的内容区分：**顶层 ⇒ 恰 2 键**；**字段层 ⇒ 该键的字段清单**）。
// · 全部为**纯函数**（离线可判负 · 零 DB / 零副作用）；写落点仍**唯一** = `saveSystemSettings`。
// · **键 ≠ 字段**（§24.1(b)）：`key` / `value` 是信封地址字段，不是 `system_settings` 的字段、
//   也不是 `app_config` 键名；`AV1` 判**顶层键**，`AV2` 判**该键值对象的字段**。

/** §24.1(c)① 判别式：请求体为 jsonb object **且含自有属性 `key`** ⇒ **形态 B**（不得回落形态 A）。 */
export const isAppConfigEnvelope = (body: unknown): body is Record<string, unknown> =>
  isJsonbObject(body) && Object.prototype.hasOwnProperty.call(body, 'key');

/** 形态 B 的**信封形状**判定结果（`ok:true` ⇒ 目标键为字符串，但**尚未过 `AV1`**）。 */
export type AppConfigEnvelopeVerdict =
  | { ok: true; rawKey: string; value: Record<string, unknown> }
  | SystemSettingsWriteReject;

/**
 * §24.1(b)/(c) **信封形状**（`AV1` 之外的形状层 · 层序写死）：
 *   ① 信封**多余属性**（除 `key` / `value` / `SETTINGS_CONTROL_FIELDS`）⇒ `unknownKey`
 *      （`details.field` = 首个、`unknown_keys` = 全部 · **不得静默忽略**）；
 *   ② `key` **非字符串** ⇒ `typeInvalid`（`details.{field:'key', expected:'string', got}`）；
 *   ③ `value` **缺失 / `null` / 非 object** ⇒ `valueNotObject`（**不做隐式补默认**，`AG4`）。
 */
export const screenAppConfigEnvelope = (body: Record<string, unknown>): AppConfigEnvelopeVerdict => {
  const extra = Object.keys(body).filter(
    (k) => k !== 'key' && k !== 'value' && !(SETTINGS_CONTROL_FIELDS as readonly string[]).includes(k),
  );
  if (extra.length) {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Unknown key(s) are not writable via /api/admin/settings',
      details: {
        field: extra[0],
        reason: SETTINGS_WRITE_REASONS.unknownKey,
        unknown_keys: extra,
        legal_keys: [...APP_CONFIG_LEGAL_KEYS],
      },
    };
  }
  const rawKey = body.key;
  if (typeof rawKey !== 'string') {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Setting key must be a string',
      details: { field: 'key', reason: SETTINGS_WRITE_REASONS.typeInvalid, expected: 'string', got: shapeOf(rawKey) },
    };
  }
  if (!isJsonbObject(body.value)) {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Setting value must be a JSON object',
      details: { field: 'value', reason: SETTINGS_WRITE_REASONS.valueNotObject, expected: 'object', got: shapeOf(body.value) },
    };
  }
  return { ok: true, rawKey, value: body.value as Record<string, unknown> };
};

/** `AV1` 顶层键判定结果。 */
export type AppConfigKeyVerdict =
  | { ok: true; key: (typeof APP_CONFIG_LEGAL_KEYS)[number] }
  | SystemSettingsWriteReject;

/**
 * `AV1`（§24.2）：目标键 **∈ `APP_CONFIG_LEGAL_KEYS`**（恰 2 键）。
 * 非法 ⇒ `400` + `reason='SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'`（**稳定常量、不插值**）
 *   + `details.field` = 首个非法键 + `details.unknown_keys` = [该键] + `details.legal_keys` = **恰 2 键**。
 */
export const validateAppConfigKey = (rawKey: string): AppConfigKeyVerdict => {
  if (!(APP_CONFIG_LEGAL_KEYS as readonly string[]).includes(rawKey)) {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Unknown key(s) are not writable via /api/admin/settings',
      details: {
        field: rawKey,
        reason: SETTINGS_WRITE_REASONS.unknownKey,
        unknown_keys: [rawKey],
        legal_keys: [...APP_CONFIG_LEGAL_KEYS],
      },
    };
  }
  return { ok: true, key: rawKey as (typeof APP_CONFIG_LEGAL_KEYS)[number] };
};

/** `AV2`/`AV3`/`AV4` 的通用值判定结果（键级寻址下，`value` 的形态见目标键）。 */
export type AppConfigValueVerdict =
  | { ok: true; value: Record<string, unknown> }
  | SystemSettingsWriteReject;

/**
 * `AV2`/`AV3`/`AV4`（§24.2）—— `listing_deposit_policy` 值对象的**逐键字段闭集 + 类型 + 语义域**。
 *   · `AV2`：字段闭集恰 `{amount}`（`LISTING_DEPOSIT_POLICY_FIELDS`）⇒ 清单外字段 ⇒ `unknownKey`
 *     （`details.legal_keys` = `['amount']` ⇒ **层级靠它区分**于 `AV1` 的 2 键面）；
 *   · `AV3`：`amount` = `'number'`（严格比对、**不隐式转换**）；
 *   · `AV4`：正整数 · 最小单位（逐字 = `parseListingDepositPolicyAmount` 的语义域：
 *     `Number.isSafeInteger(amount) && amount > 0`）⇒ `details.expected='positive_integer'`
 *     （**`expected` 的新取值、不是新 `reason` 常量**）。
 * ★ 缺 `amount` 字段合法（部分补丁语义 · 与 `AK1` 同口径）：**不发明**「必填」约束（无先例）。
 */
export const validateListingDepositPolicyValue = (input: unknown): AppConfigValueVerdict => {
  if (!isJsonbObject(input)) {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Setting value must be a JSON object',
      details: { field: 'value', reason: SETTINGS_WRITE_REASONS.valueNotObject, expected: 'object', got: shapeOf(input) },
    };
  }
  const unknownFields = Object.keys(input).filter(
    (k) => !Object.prototype.hasOwnProperty.call(LISTING_DEPOSIT_POLICY_FIELD_TYPES, k),
  );
  if (unknownFields.length) {
    return {
      ok: false,
      code: 'LEDGER_AMOUNT_INVALID',
      message: 'Unknown field(s) are not writable for listing_deposit_policy',
      details: {
        field: unknownFields[0],
        reason: SETTINGS_WRITE_REASONS.unknownKey,
        unknown_keys: unknownFields,
        legal_keys: [...LISTING_DEPOSIT_POLICY_FIELDS],
      },
    };
  }
  if (Object.prototype.hasOwnProperty.call(input, 'amount')) {
    const amount = (input as Record<string, unknown>).amount;
    if (!fieldTypeMatches('number', amount)) {
      return {
        ok: false,
        code: 'LEDGER_AMOUNT_INVALID',
        message: 'Setting field type is invalid',
        details: { field: 'amount', reason: SETTINGS_WRITE_REASONS.typeInvalid, expected: 'number', got: shapeOf(amount) },
      };
    }
    if (!(typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0)) {
      return {
        ok: false,
        code: 'LEDGER_AMOUNT_INVALID',
        message: 'Setting field value is out of domain',
        details: { field: 'amount', reason: SETTINGS_WRITE_REASONS.typeInvalid, expected: 'positive_integer', got: shapeOf(amount) },
      };
    }
  }
  return { ok: true, value: input as Record<string, unknown> };
};

/**
 * `AV2`–`AV4` 的**按目标键分发**（唯一入口）：
 *   · `system_settings` ⇒ 既有 `validateSystemSettingsPatch`（`AV2` = 9 字段闭集 + `AV3` 类型）；
 *   · `listing_deposit_policy` ⇒ `validateListingDepositPolicyValue`（`AV2` = `{amount}` + `AV3` + `AV4`）；
 *   · `batt_policy` / `checkin_policy` / `invite_reward_policy` / `mint_burn_policy` / `rating_policy`（`B1`–`B5`）
 *     ⇒ `validateNumericPolicyValue`（`AV2` 字段闭集 + `AV3` 类型 + `AV4` 语义域）；
 *   · `site_text_overrides`（`B6`）/ `role_names`（`B7`）⇒ `validateOverlayValue`（`AV2` 字段闭集 + 四语键集相等）；
 *   · 其它键 ⇒ **不可达**（`AV1` 已拦），仍 fail-closed 拒绝（不静默放行）。
 */
export const validateAppConfigValue = (targetKey: string, value: unknown): AppConfigValueVerdict => {
  if (targetKey === SYSTEM_SETTINGS_KEY) {
    const verdict = validateSystemSettingsPatch(value);
    return verdict.ok ? { ok: true, value: verdict.value as Record<string, unknown> } : verdict;
  }
  if (targetKey === LISTING_DEPOSIT_POLICY_KEY) {
    return validateListingDepositPolicyValue(value);
  }
  if (targetKey === SITE_TEXT_OVERRIDES_KEY) {
    return validateOverlayValue(targetKey, SITE_TEXT_FIELDS, value);
  }
  if (targetKey === ROLE_NAMES_KEY) {
    return validateOverlayValue(targetKey, ROLE_NAME_FIELDS, value);
  }
  if (Object.prototype.hasOwnProperty.call(NUMERIC_POLICY_SPECS, targetKey)) {
    return validateNumericPolicyValue(targetKey, value);
  }
  return {
    ok: false,
    code: 'LEDGER_AMOUNT_INVALID',
    message: 'Unknown key(s) are not writable via /api/admin/settings',
    details: { field: targetKey, reason: SETTINGS_WRITE_REASONS.unknownKey, unknown_keys: [targetKey], legal_keys: [...APP_CONFIG_LEGAL_KEYS] },
  };
};

/**
 * 写侧 `AK2` 值对象的**严格断言**（双保险 · `saveSystemSettings` 内用）：不合法 ⇒ **抛** `SystemSettingsWriteError`。
 * 返回**只含合法字段**的 `{amount}` 值对象（原样透传 · **不补默认值 / 不隐式转换**）。
 */
export const assertListingDepositPolicyValue = (input: unknown): Record<string, unknown> => {
  const verdict = validateListingDepositPolicyValue(input);
  if (!verdict.ok) throw new SystemSettingsWriteError(verdict.message, verdict.details);
  return verdict.value;
};

const normalizePermissionGroup = (row: RawRow): PermissionGroupRecord => ({
  id: toStringValue(getValue(row, 'id')),
  name: toStringValue(getValue(row, 'name')),
  description: toStringValue(getValue(row, 'description')),
  permissions: uniqueStrings(
    toStringArray(getValue(row, 'permissions')).filter((permission) =>
      ALL_ADMIN_PERMISSIONS.includes(permission as typeof ALL_ADMIN_PERMISSIONS[number]),
    ),
  ),
  user_ids: uniqueNumbers(toNumberArray(getValue(row, 'user_ids'))),
  readonly: toBooleanValue(getValue(row, 'readonly')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_updated: toTimestamp(getValue(row, 'time_updated')),
});

const normalizeShardHolding = (
  row: RawRow,
  brand?: BrandRecord | null,
): ShardHoldingRecord => ({
  sID: toNumberValue(getValue(row, 'sID', 'id')),
  bID: toNumberValue(getValue(row, 'bID')),
  uID: toNumberValue(getValue(row, 'uID')),
  volume: toNumberValue(getValue(row, 'volume')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  symbol: brand?.symbol || toStringValue(getValue(row, 'symbol', 'brand_symbol')),
  brand_name: brand?.name || toStringValue(getValue(row, 'brand_name', 'name')),
});

// P4-B1-d: market 读侧列名回退键（旧列名在前 ⇒ 旧行为不变；新表列名在后）。
// market_order: oID←order_id、bID←base_cid（币对基准币）、uID←owner_uid（挂单人）、
//               volume_total←amount、volume_filled←amount_filled。
const normalizeMarketOrder = (
  row: RawRow,
  brand?: BrandRecord | null,
): MarketOrderRecord => ({
  oID: toNumberValue(getValue(row, 'oID', 'order_id', 'id')),
  bID: toNumberValue(getValue(row, 'bID', 'base_cid')),
  uID: toNumberValue(getValue(row, 'uID', 'owner_uid')),
  side: toStringValue(getValue(row, 'side')) === 'sell' ? 'sell' : 'buy',
  price: toNumberValue(getValue(row, 'price')),
  volume_total: toNumberValue(getValue(row, 'volume_total', 'amount')),
  volume_filled: toNumberValue(getValue(row, 'volume_filled', 'amount_filled')),
  status: toStringValue(getValue(row, 'status')) || 'open',
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_updated: toTimestamp(getValue(row, 'time_updated')),
  symbol: brand?.symbol || toStringValue(getValue(row, 'symbol', 'brand_symbol')),
  brand_name: brand?.name || toStringValue(getValue(row, 'brand_name', 'name')),
});

// P4-B1-d: listOrderBook 的行映射抽为纯函数（键集 {side,price,volume} 与 HEAD 内联映射逐字等价），
// 供 key 契约夹具直接调用；零 DB 访问。
export const normalizeOrderBookRow = (row: RawRow): MarketOrderBookRow => ({
  side: row.side === 'sell' ? 'sell' : 'buy',
  price: toNumberValue(row.price),
  volume: toNumberValue(row.volume),
});

// P4-B1-d: market_trade 列名回退键：trID←trade_id、bID←base_cid、buy_oID←buy_order_id、
// sell_oID←sell_order_id、volume←amount；buyer_uID/seller_uID 由 listTradesByBrand 的
// LEFT JOIN market_order（buy_order_id/sell_order_id 各自的 owner_uid）合成别名供给，故无回退键。
const normalizeMarketTrade = (
  row: RawRow,
  brand?: BrandRecord | null,
): MarketTradeRecord => ({
  trID: toNumberValue(getValue(row, 'trID', 'trade_id', 'id')),
  bID: toNumberValue(getValue(row, 'bID', 'base_cid')),
  buy_oID: toNumberValue(getValue(row, 'buy_oID', 'buy_order_id')),
  sell_oID: toNumberValue(getValue(row, 'sell_oID', 'sell_order_id')),
  buyer_uID: toNumberValue(getValue(row, 'buyer_uID')),
  seller_uID: toNumberValue(getValue(row, 'seller_uID')),
  price: toNumberValue(getValue(row, 'price')),
  volume: toNumberValue(getValue(row, 'volume', 'amount')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  brand_symbol: brand?.symbol || toStringValue(getValue(row, 'brand_symbol', 'symbol')),
});

const normalizeShardTransfer = (
  row: RawRow,
  brand?: BrandRecord | null,
): ShardTransferRecord => ({
  txID: toNumberValue(getValue(row, 'txID', 'id')),
  bID: toNumberValue(getValue(row, 'bID')),
  from_uID: toOptionalNumber(getValue(row, 'from_uID')),
  to_uID: toOptionalNumber(getValue(row, 'to_uID')),
  volume: toNumberValue(getValue(row, 'volume')),
  reason: toStringValue(getValue(row, 'reason')),
  related_oID: toOptionalNumber(getValue(row, 'related_oID')),
  related_trID: toOptionalNumber(getValue(row, 'related_trID')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  brand_symbol: brand?.symbol || toStringValue(getValue(row, 'brand_symbol', 'symbol')),
});

// ======================================================= P6-TR-1b 读侧译文合并 ====
/**
 * 读侧回落（跨片交接面，逐字实现）：
 *   · `*_<lang>`（en/hk/vn）**恒有值** —— 有 status='ready' 译文用译文，否则**回落源文（中文）**，永不空串
 *     （除非原文本身为空）；
 *   · `i18n_status`：'ready' = 该对象**所有可译字段** × en/vn/hk 全部有 ready 译文；'pending' = 一个都没有；
 *     否则 'partial'；**P6-TR-1c-FIX2：源文本为空/空白（trim 后为空）的 (字段 × 语言) 格不计入分母**（无内容可翻）；
 *     **所有可译字段的源皆空（total===0）⇒ 真空态 `ready`**（spec v1.3 §10.15；**该键恒在**）；键缺省 ⇒ 前端不显示小标；
 *   · 语言后缀仅 en/hk/vn；zh 是源语言，**永不入表**。
 * 读失败 / 读不到 ⇒ 全部回落源文（**绝不**让内容面 500）。
 */
type I18nStatus = 'ready' | 'partial' | 'pending';
type I18nIndex = Map<string, Map<string, string>>;

/** 可译字段规格：`out` = API 键前缀，`src` = content_translation.field 候选（兼容字段命名两口径）。 */
const I18N_SPECS: Record<string, ReadonlyArray<{ out: string; src: readonly string[] }>> = {
  // job：API `title` ← field 'title'；API `note` ← field 'note' | 'description'（源列名 description）
  job: [
    { out: 'title', src: ['title'] },
    { out: 'note', src: ['note', 'description'] },
  ],
  // listing：API `name` ← field 'name' | 'title'（源列名 title）；API `description` ← field 'description'
  listing: [
    { out: 'name', src: ['name', 'title'] },
    { out: 'description', src: ['description'] },
  ],
};
const I18N_LANGS = ['en', 'hk', 'vn'] as const;

/** 就地合并译文（写 `*_<lang>` + `i18n_status`）；index 缺省 ⇒ 全部回落源文、status='pending'。 */
export const applyI18n = (
  entityType: string,
  entityId: string,
  record: Record<string, unknown>,
  index?: I18nIndex | null,
): void => {
  const specs = I18N_SPECS[entityType];
  if (!specs) return;
  const got = entityId ? index?.get(entityId) : undefined;
  let total = 0;
  let ready = 0;
  for (const spec of specs) {
    const source = typeof record[spec.out] === 'string' ? record[spec.out] as string : '';
    // P6-TR-1c-FIX2：源为空/空白 ⇒ 该 (字段 × 语言) 格**无内容可翻** ⇒ 不计入分母（否则对象被永久判 partial、小标永挂）
    const countable = source.trim() !== '';
    for (const lang of I18N_LANGS) {
      if (countable) total += 1;
      let text = '';
      if (got) {
        for (const field of spec.src) {
          const candidate = got.get(`${field}\u0000${lang}`);
          if (typeof candidate === 'string' && candidate) { text = candidate; break; }
        }
      }
      if (countable && text) ready += 1;
      record[`${spec.out}_${lang}`] = text || source; // 恒有值：取不到 ⇒ 回落源文（唯一例外：源文本身为空 ⇒ 回落空串）
    }
  }
  // P6-TR-1c-FIX2 / spec v1.3 §10.15：所有可译字段的源皆空 ⇒ total===0 ⇒ 取**真空态 `ready`**（该键**恒在**；
  // 前端对 `ready` 与键缺省的处理一致 = 都不显示小标 ⇒ §10.1「该键恒带」保持）
  const status: I18nStatus = total === 0 || ready === total
    ? 'ready'
    : (ready === 0 ? 'pending' : 'partial');
  record.i18n_status = status;
};

/** 批量读 `status='ready'` 译文，建 `entity_id → (field\0lang) → text` 索引（entity_type 白名单）。 */
const loadI18nIndex = async (entityType: string, entityIds: string[]): Promise<I18nIndex> => {
  const index: I18nIndex = new Map();
  if (!I18N_SPECS[entityType]) return index;
  const ids = Array.from(new Set(entityIds.filter((id) => id && id !== '0')));
  if (!ids.length) return index;
  try {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT entity_id, field, lang, text
      FROM public.content_translation
      WHERE entity_type = ${entityType}
        AND entity_id = ANY(${ids}::text[])
        AND status = 'ready'
        AND text IS NOT NULL
    `);
    for (const row of rows) {
      const id = String(row.entity_id ?? '');
      const field = String(row.field ?? '');
      const lang = String(row.lang ?? '');
      const text = typeof row.text === 'string' ? row.text : '';
      if (!id || !field || !lang || !text) continue;
      let bucket = index.get(id);
      if (!bucket) { bucket = new Map(); index.set(id, bucket); }
      bucket.set(`${field}\u0000${lang}`, text);
    }
  } catch (error) {
    console.warn('i18n merge skipped (content_translation read failed):', error);
  }
  return index;
};

export class DatabaseService {
  static async getNextUserId(): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ next_id: number }>(await sql`
      SELECT COALESCE(MAX(uid), 0) + 1 AS next_id
      FROM public."users"
    `);
    return Number(rows[0]?.next_id || 1);
  }

  static async getBrandAggregateCounts(): Promise<Map<number, BrandAggregateCounts>> {
    // P4-B1-c: 旧实现查询 prize_item/shard/shard_transfer —— 新 schema 均无对应表（probe.json 三口径 42P01）
    // ⇒ 聚合键（stores_count/claims_count/activated_count/current_shard_supply/free_shards_distributed）
    // 保留、值恒 0（不编值）；返回空 Map，调用方按零计数回退。语义已被积分交易所取代。
    return new Map();
  }

  static async getTaskParticipantCounts(): Promise<Map<number, number>> {
    const sql = getSql();
    try {
      const rows = asItems<{ tid: number; count: number }>(await sql`
        SELECT
          COALESCE(j."tID", 0) AS tid,
          COUNT(1)::int AS count
        FROM task_progress AS j
        GROUP BY tid
      `);

      return new Map(rows.map((row) => [Number(row.tid || 0), Number(row.count || 0)]));
    } catch (error) {
      console.warn('Failed to load task participant counts, falling back to zero counts:', error);
      return new Map();
    }
  }

  static async getAllUsers(skip = 0, limit = 100): Promise<UserRecord[]> {
    try {
      const sql = getSql();
      const rows = extractRows(await sql`
        SELECT u.*
        FROM "users" AS u
        ORDER BY u.uid
        LIMIT ${limit} OFFSET ${skip}
      `);
      return rows.map(normalizeUser);
    } catch (error) {
      // P6-D1'-SWEEP：同上 —— 原 `return []` 使库不可达时读面伪造「空列表 200」。
      // 现原样上抛 ⇒ 既有 §14 分类器（`/api/user/all`、`/api/admin/permissions` 的 catch 已同族收口）。
      console.error('Error getting users:', error);
      throw error;
    }
  }

  static async getUserById(uID: number): Promise<UserRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT u.*
      FROM "users" AS u
      WHERE u.uid = ${uID}
      LIMIT 1
    `);

    return row ? normalizeUser(row) : null;
  }

  static async getUserByEvm(evmAddress: string): Promise<UserRecord | null> {
    const sql = getSql();
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
    const row = firstRow(await sql`
      SELECT u.*
      FROM "users" AS u
      WHERE lower(u.evm) = ${normalizedAddress}
      LIMIT 1
    `);

    return row ? normalizeUser(row) : null;
  }

  static async createUserByEvm(evmAddress: string): Promise<UserRecord> {
    const sql = getSql();
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
    const nextUserId = await this.getNextUserId();
    const row = firstRow(await sql`
      INSERT INTO public."users" AS u (uid, evm, bio, is_admin, time_reg, time_login_last)
      VALUES (${nextUserId}, ${normalizedAddress}, '', false, NOW(), NOW())
      RETURNING u.*
    `);
    if (!row) throw new Error('User insert returned no row');
    return normalizeUser(row);
  }

  static async touchUserLogin(uID: number): Promise<void> {
    const sql = getSql();
    await sql`
      UPDATE "users" AS u
      SET "time_login_last" = NOW()
      WHERE u.uid = ${uID}
    `;
  }

  static async findOrCreateUserByEvm(evmAddress: string): Promise<UserRecord> {
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
    let user = await this.getUserByEvm(normalizedAddress);

    if (!user) {
      user = await this.createUserByEvm(normalizedAddress);
    }

    await this.touchUserLogin(user.uID).catch((error) => {
      console.warn('Failed to update user login time:', error);
    });

    return (await this.getUserById(user.uID)) || user;
  }

  static async updateUserProfile(uID: number, fields: { bio?: string; is_admin?: boolean }): Promise<UserRecord | null> {
    const sql = getSql();
    const bio = fields.bio;
    const isAdmin = fields.is_admin === undefined ? null : String(fields.is_admin);
    const row = firstRow(await sql`
      UPDATE "users" AS u
      SET "bio" = COALESCE(${bio}, "bio"),
          "is_admin" = COALESCE(${isAdmin}, "is_admin")
      WHERE u.uid = ${uID}
      RETURNING u.*
    `);
    return row ? normalizeUser(row) : null;
  }

  // P4-B1-a: 纯读。系统币（`$`，cid = SYSTEM_CURRENCY_CID=1）的余额读侧自 `account` 取（原 `asset` 表不存在）。
  static async getUserAsset(uID: number): Promise<AssetRecord | null> {
    try {
      const sql = getSql();
      const row = firstRow(await sql`
        SELECT a.*
        FROM account AS a
        WHERE a."uid" = ${uID}
          AND a."cid" = ${Number(SYSTEM_CURRENCY_CID)}
        LIMIT 1
      `);
      return row ? normalizeAsset(row) : null;
    } catch (error) {
      // P6-D1'-SWEEP：基础设施异常**不得**静默降级成「空态资产（HTTP 200）」——
      // 原 `return null` 使库不可达时 `GET /api/user/asset/:uID` 实测 **200 `points:0`**（把 infra 错伪装成成功）。
      // 现原样上抛 ⇒ 路由层 catch 交既有 §14 分类器（DB/传输类 ⇒ 503）。正常路径（无行 ⇒ `null`）逐字不变。
      console.error('Error getting user asset:', error);
      throw error;
    }
  }

  // P4-B1-a: 无 account 行时的空态资产（零值 + 完整键集），供 GET 端点纯读回退，避免隐式写库。
  static emptyAsset(uID: number): AssetRecord {
    return {
      index_id: 0,
      uID,
      points: 0,
      lucks: 0,
      time_update: 0,
    };
  }

  /**
   * P7-A（批 7-A · Kong）：**账本流水纯读**（`GET /api/user/ledger` 的落点）。
   * 依据（逐字）：
   *   · `data-layer.spec` **DL25**（【已冻结】）/ `ledger.spec` **R95**：流水分页**必须 keyset**
   *     （`WHERE uid=$1 [AND cid=$2] [AND kind=$3] AND txid < $before ORDER BY txid DESC LIMIT n`），
   *     **禁 `OFFSET`**（大偏移退化 + 翻页期间新流水会重复/漏项）。
   *   · **DL23**：读路径**绝不产生写副作用** ⇒ 本方法**纯 SELECT**，无 DDL / 无懒开户 / 无 `upsert*`
   *     （函数名无写动词；不像旧 `GET /api/user/asset/:uID` 那样内部建行）。
   *   · §1.1 硬口径：表引用显式限定 schema（`public.`）；`uid` 取 token actor（**不 join 身份表**，
   *     故天然绕开 `user` 保留字陷阱，也不碰 `neon_auth`）。
   *   · 走 `idx_ledger_uid_cid_txid (uid, cid, txid DESC)`（`ledger.spec` §12.1「最重要读索引」）。
   * 游标：`beforeTxid`（可空）⇒ 首页不传；后续页传上一页末条 `txid`。响应回传 `next_before_txid`
   *   由**路由层**计算（满页 = 末条 `txid`；不足页 = `null` 表示到底）。
   */
  static async listLedgerEntriesByUser(input: {
    uid: number;
    cid?: number | null;
    kind?: string | null;
    beforeTxid?: number | null;
    limit: number;
  }): Promise<LedgerEntryRecord[]> {
    const uid = Math.trunc(Number(input.uid) || 0);
    const cid = input.cid === null || input.cid === undefined ? null : Math.trunc(Number(input.cid));
    const kind = input.kind === null || input.kind === undefined || input.kind === ''
      ? null
      : String(input.kind);
    const beforeTxid = input.beforeTxid === null || input.beforeTxid === undefined
      ? null
      : Math.trunc(Number(input.beforeTxid));
    const limit = Math.max(1, Math.trunc(Number(input.limit) || 0));

    try {
      const sql = getSql();
      // 条件过滤用「`$n::type IS NULL OR col = $n::type`」写死，**不拼接 SQL**（值一律走参数位）。
      // `LIMIT $n` 由驱动参数化（PG 接受）；`ORDER BY txid DESC` + `txid < $before` = 纯 keyset。
      const rows = extractRows(await sql`
        SELECT le.txid,
               le.uid,
               le.cid,
               le.delta,
               le.frozen_delta,
               le.balance_after,
               le.frozen_after,
               le.kind,
               le.ref_type,
               le.ref_id,
               le.reversal_of_txid,
               le.memo,
               le.time_created
          FROM public.ledger_entry AS le
         WHERE le.uid = ${uid}
           AND (${cid}::bigint IS NULL OR le.cid = ${cid}::bigint)
           AND (${kind}::text IS NULL OR le.kind = ${kind}::text)
           AND (${beforeTxid}::bigint IS NULL OR le.txid < ${beforeTxid}::bigint)
         ORDER BY le.txid DESC
         LIMIT ${limit}
      `);
      return rows.map(normalizeLedgerEntry);
    } catch (error) {
      // P6-D1'-SWEEP 同族口径：基础设施异常**不得**静默降级成「空流水（HTTP 200）」。
      // 原样上抛 ⇒ 路由层 catch 交既有 §14 分类器（DB/传输类 ⇒ 503）。正常路径（无行 ⇒ `[]`）不变。
      console.error('Error listing ledger entries:', error);
      throw error;
    }
  }

  static async upsertAsset(uID: number, pointsDelta: number): Promise<AssetRecord> {
    const sql = getSql();
    const existingAsset = await this.getUserAsset(uID);

    if (existingAsset) {
      const row = firstRow(await sql`
        UPDATE asset AS a
        SET points = COALESCE(points, 0) + ${pointsDelta},
            "time_updated" = NOW()
        WHERE a."uID" = ${uID}
        RETURNING a.*
      `);

      if (!row) {
        throw new Error('Failed to update asset');
      }

      return normalizeAsset(row);
    }

    const row = firstRow(await sql`
      INSERT INTO asset AS a ("uID", points, lucks, "time_updated")
      VALUES (${uID}, ${pointsDelta}, 0, NOW())
      RETURNING a.*
    `);

    if (!row) {
      throw new Error('Failed to create asset');
    }

    return normalizeAsset(row);
  }

  static async initializeAllAssets(): Promise<{ total: number; initialized: number }> {
    const users = await this.getAllUsers(0, 10000);
    let initializedCount = 0;

    for (const user of users) {
      const existingAsset = await this.getUserAsset(user.uID);
      if (!existingAsset) {
        await this.upsertAsset(user.uID, 0);
        initializedCount += 1;
      }
    }

    return {
      total: users.length,
      initialized: initializedCount,
    };
  }

  /**
   * P4-A1-LEDGER-IMPL（Zang §5.99 裁定）：后台调分**改接账本** `ledger_post_event`（**单语句**）。
   *   · 有符号 `amount`（单位 = `$`(`cid=1`) **最小单位**，R66 `amount_units`）：
   *       `> 0` ⇒ `op='mint'`（铸币到目标用户；`$(owner_uid=0)` ⇒ 必须 `platform=true`；
   *                R23 授权 + R24 供给上限由 DB 判；**系统无对手方 ⇒ 恰 1 条 `+n` 分录**）；
   *       `< 0` ⇒ `op='entries'` + **单腿** `kind='burn'`（`delta = -|n|`，从目标用户销毁、净减发）。
   *     ⇒ `burn` **只能**走 `entries`：`ledger_post_event` 的 op 白名单 = `mint/transfer/hold/
   *       hold_release/settle/entries`（`migrations/0020:156`，**其中无 `burn`**；`migrations/**` 已冻结）。
   *   · **零表写入**：本方法不写 `account` / `ledger_entry` / `asset`（R1）；余额变动只由账本函数落。
   *   · **不得造幽灵账户**：目标 uid 在 `public."users"` 无行 ⇒ `ev` CTE 零行 ⇒ **不调账本**
   *     （零分录 / 零开户）⇒ 返回 `user_found = 0`，由路由层映射为既有码 `LEDGER_RESERVED_UID`。
   *   · `uid <= 0`（平台 / 保留 uid）**故意放行到账本** ⇒ 由 `ledger_uid_arg` 抛 `LD021`（既有码）。
   *   · 幂等键 / 请求指纹由**路由层**传入（DL36/DL96/DL97/DL146②）：同键同指纹 ⇒ 200 重放（零新增分录）。
   */
  static async adjustPoints(input: {
    actorUid: number;
    uID: number;
    amount: number;
    reason: string;
    idempotencyKey: string;
    requestFingerprint: string;
  }): Promise<{
    ok: boolean;
    user_found: number;
    reason: string | null;
    daily_cap: string | null;
    daily_used: string | null;
    requested: string | null;
    op: string | null;
    txid: string | null;
    idempotent_replay: boolean;
    new_balance: string | null;
    audit_logged: boolean;
  }> {
    const sql = getSql();
    // P6-B6-AUDIT（Kong）：**唯一资金写路径**改为一条语句调用新增编排函数
    // `public.admin_points_adjust_post_event($1::jsonb)`（`migrations/0023_admin_points_audit_daily_cap.sql`）
    // —— 函数内「并发闸（`pg_advisory_xact_lock`，按操作人）→ 目标存在性闸 → **日累计闸（同语句内对
    // 当日审计行求和）** → 派生分录 → `ledger_post_event` → **写审计行**」**同函数、同语句**
    // （= 一个隐式事务）⇒ **审计行与资金事件同生同灭**（与 `job_post_event` 同构；R1/R2/DL20）。
    // 本方法只转发 payload：不派生分录、不写 `account`/`ledger_entry`/审计表、不自造幂等键。
    const payload = {
      actor_uid: String(input.actorUid),
      target_uid: String(input.uID),
      cid: '1',
      amount: String(input.amount),
      reason: input.reason,
      idempotency_key: input.idempotencyKey,
      request_fingerprint: input.requestFingerprint,
    };

    const row = firstRow(await sql`
      SELECT
        (t.r->>'ok')::boolean                AS ok,
        (t.r->>'user_found')::int            AS user_found,
        (t.r->>'reason')                     AS reason,
        (t.r->>'daily_cap')                  AS daily_cap,
        (t.r->>'daily_used')                 AS daily_used,
        (t.r->>'requested')                  AS requested,
        (t.r->>'op')                         AS op,
        (t.r->>'txid')                       AS txid,
        (t.r->>'idempotent_replay')::boolean AS idempotent_replay,
        (t.r->>'new_balance')                AS new_balance,
        (t.r->>'audit_logged')::boolean      AS audit_logged
      FROM (SELECT public.admin_points_adjust_post_event(${JSON.stringify(payload)}::jsonb) AS r) AS t
    `) as Record<string, unknown> | null;

    const nullableText = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
    return {
      ok: row?.ok === true,
      user_found: Number(row?.user_found ?? 0),
      reason: nullableText(row?.reason),
      daily_cap: nullableText(row?.daily_cap),
      daily_used: nullableText(row?.daily_used),
      requested: nullableText(row?.requested),
      op: nullableText(row?.op),
      txid: nullableText(row?.txid),
      idempotent_replay: row?.idempotent_replay === true,
      new_balance: nullableText(row?.new_balance),
      audit_logged: row?.audit_logged === true,
    };
  }

  static async listBrands(skip = 0, limit = 100): Promise<BrandRecord[]> {
    const sql = getSql();
    // P4-B1-c: prize→listing 读侧换表（bID←listing_id、points←price、name←title；description/status/
    // time_created/time_updated 同名核对）。旧 gift_counts/shard_counts/transfer_counts CTE 引用的
    // prize_item/shard/shard_transfer 在新 schema 无对应表（probe.json 三口径 42P01）
    // ⇒ 聚合键保留、值恒 0（不编值）。
    const rows = extractRows(await sql`
      SELECT
        l.*,
        0::int AS stores_count,
        0::int AS claims_count,
        0::int AS activated_count,
        0::int AS current_shard_supply,
        0::int AS free_shards_distributed
      FROM listing AS l
      ORDER BY l.listing_id
      LIMIT ${limit} OFFSET ${skip}
    `);

    const index = await loadI18nIndex('listing', rows.map((row) => String(toNumberValue(getValue(row, 'bID', 'listing_id')))));
    return rows.map((row) => {
      return normalizeBrand(row, {
        stores_count: toNumberValue(getValue(row, 'stores_count')),
        claims_count: toNumberValue(getValue(row, 'claims_count')),
        activated_count: toNumberValue(getValue(row, 'activated_count')),
        current_shard_supply: toNumberValue(getValue(row, 'current_shard_supply')),
        free_shards_distributed: toNumberValue(getValue(row, 'free_shards_distributed')),
      }, index);
    });
  }

  // P4-B1-c: 以下 5 个计数函数的源表 prize_item/shard/shard_transfer 新 schema 无对应表
  //（P4-0 §4.1 裁定勿硬凑建表）⇒ 恒 0（不编值）；「免费礼品店/领取/激活/碎片供给/免费碎片发放」
  // 语义已被积分交易所取代。HTTP 层无独立端点，值经 BrandRecord 聚合键与 prize 明细暴露。
  static async countGiftStoresByBrand(bID: number): Promise<number> {
    void bID;
    return 0;
  }

  static async countGiftClaimsByBrand(bID: number): Promise<number> {
    void bID;
    return 0;
  }

  static async countGiftActivatedByBrand(bID: number): Promise<number> {
    void bID;
    return 0;
  }

  static async getCurrentShardSupplyByBrand(bID: number): Promise<number> {
    void bID;
    return 0;
  }

  static async countFreeShardsDistributedByBrand(bID: number): Promise<number> {
    void bID;
    return 0;
  }

  static async listPrizeItemsByUser(uID: number, skip = 0, limit = 200): Promise<PrizeItemRecord[]> {
    const sql = getSql();
    // P4-B1-c: prize_item→listing_order 换表（buyer_uid = uID 且已支付 status='paid'；
    // listing_order_status_enum CHECK 真值 = created/paid/refunded/cancelled，probe.json）。
    // time_claimed/time_actived 无对应列 ⇒ 恒 NULL（不编值，B1-b 同口径）；键经 SQL 别名保留旧形状。
    const rows = extractRows(await sql`
      SELECT
        o.order_id AS "gID",
        o.listing_id AS "bID",
        o.buyer_uid AS "uID",
        o.time_created,
        NULL::timestamptz AS time_claimed,
        NULL::timestamptz AS time_actived
      FROM listing_order AS o
      WHERE o.buyer_uid = ${uID}
        AND o.status = 'paid'
      ORDER BY o.order_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizePrizeItem);
  }

  static async listClaimedPrizeIdsByUser(uID: number): Promise<number[]> {
    const sql = getSql();
    // P4-B1-c: prize_item→listing_order 换表（已支付 = status 'paid'）；空库 ⇒ 空数组。
    const rows = asItems<{ bID: number }>(await sql`
      SELECT DISTINCT o.listing_id AS "bID"
      FROM listing_order AS o
      WHERE o.buyer_uid = ${uID}
        AND o.status = 'paid'
      ORDER BY "bID"
    `);

    return rows
      .map((row) => Number(row.bID || 0))
      .filter((bID) => bID > 0);
  }

  static async listTasks(skip = 0, limit = 100): Promise<TaskRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH selected_tasks AS (
        SELECT t.*
        FROM job AS t
        ORDER BY t.job_id
        LIMIT ${limit} OFFSET ${skip}
      ),
      participant_counts AS (
        SELECT
          j.job_id AS tid,
          COUNT(1)::int AS participants_count
        FROM job_application AS j
        JOIN selected_tasks AS t ON t.job_id = j.job_id
        GROUP BY j.job_id
      )
      SELECT
        t.*,
        COALESCE(pc.participants_count, 0)::int AS participants_count
      FROM selected_tasks AS t
      LEFT JOIN participant_counts AS pc ON pc.tid = t.job_id
      ORDER BY t.job_id
    `);

    const index = await loadI18nIndex('job', rows.map((row) => String(toNumberValue(getValue(row, 'tID', 'job_id')))));
    return rows.map((row) => normalizeTask(row, toNumberValue(getValue(row, 'participants_count')), index));
  }

  static async getTask(tID: number): Promise<TaskRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      WITH selected_task AS (
        SELECT t.*
        FROM job AS t
        WHERE t.job_id = ${tID}
        LIMIT 1
      ),
      participant_counts AS (
        SELECT
          j.job_id AS tid,
          COUNT(1)::int AS participants_count
        FROM job_application AS j
        JOIN selected_task AS t ON t.job_id = j.job_id
        GROUP BY j.job_id
      )
      SELECT
        t.*,
        COALESCE(pc.participants_count, 0)::int AS participants_count
      FROM selected_task AS t
      LEFT JOIN participant_counts AS pc
        ON pc.tid = t.job_id
      LIMIT 1
    `);

    if (!row) return null;
    return normalizeTask(row, toNumberValue(getValue(row, 'participants_count')), await loadI18nIndex('job', [String(tID)]));
  }

  // P4-B1-b: 空态任务（完整 TaskRecord 键集），GET miss 回退用（类比 B1-a emptyAsset）；纯内存、零写库
  static emptyTask(tID: number): TaskRecord {
    return { ...normalizeTask({}, 0), tID };
  }

  static async countTaskParticipants(tID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ count: number }>(await sql`
      SELECT COUNT(1)::int AS count
      FROM task_progress AS j
      WHERE COALESCE(NULLIF(BTRIM(j."tID"), '')::int, 0) = ${tID}
    `);
    return Number(rows[0]?.count || 0);
  }

  static async getTaskProgress(jID: number): Promise<TaskProgressRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT
        a.application_id AS "jID",
        a.job_id AS "tID",
        a.worker_uid AS "uID",
        s.deliverable AS info_input,
        a.time_created,
        s.time_created AS time_submitted,
        s.reviewed_at AS time_checked,
        NULL::timestamptz AS time_claimed,
        0::int AS points_claimed
      FROM job_application AS a
      LEFT JOIN LATERAL (
        SELECT *
        FROM job_submission AS s0
        WHERE s0.job_id = a.job_id AND s0.worker_uid = a.worker_uid
        ORDER BY s0.submission_id DESC
        LIMIT 1
      ) AS s ON TRUE
      WHERE a.application_id = ${jID}
      ORDER BY s.submission_id DESC NULLS LAST
      LIMIT 1
    `);

    return row ? normalizeTaskProgress(row) : null;
  }

  static async listTaskProgressByUser(uID: number, skip = 0, limit = 100): Promise<TaskProgressRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT
        a.application_id AS "jID",
        a.job_id AS "tID",
        a.worker_uid AS "uID",
        s.deliverable AS info_input,
        a.time_created,
        s.time_created AS time_submitted,
        s.reviewed_at AS time_checked,
        NULL::timestamptz AS time_claimed,
        0::int AS points_claimed
      FROM job_application AS a
      LEFT JOIN LATERAL (
        SELECT *
        FROM job_submission AS s0
        WHERE s0.job_id = a.job_id AND s0.worker_uid = a.worker_uid
        ORDER BY s0.submission_id DESC
        LIMIT 1
      ) AS s ON TRUE
      WHERE a.worker_uid = ${uID}
      ORDER BY a.application_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizeTaskProgress);
  }

  static async findTaskProgressByUserAndTask(uID: number, tID: number): Promise<TaskProgressRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT j.*
      FROM task_progress AS j
      WHERE COALESCE(NULLIF(BTRIM(j."uID"), '')::int, 0) = ${uID}
        AND COALESCE(NULLIF(BTRIM(j."tID"), '')::int, 0) = ${tID}
      ORDER BY COALESCE(NULLIF(BTRIM(j."jID"), '')::int, 0) DESC
      LIMIT 1
    `);

    return row ? normalizeTaskProgress(row) : null;
  }

  static async createTaskProgress(uID: number, tID: number): Promise<TaskProgressRecord> {
    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO task_progress AS j ("tID", "uID", info_input, time_created, points_claimed)
      VALUES (${tID}, ${uID}, NULL, NOW(), 0)
      RETURNING j.*
    `);

    if (!row) {
      throw new Error('Failed to create task progress');
    }

    return normalizeTaskProgress(row);
  }

  static async ensureTaskProgressForUserTask(uID: number, tID: number): Promise<TaskProgressRecord> {
    const existingTaskProgress = await this.findTaskProgressByUserAndTask(uID, tID);
    if (existingTaskProgress) {
      return existingTaskProgress;
    }

    return this.createTaskProgress(uID, tID);
  }

  static async submitTaskProgressInfo(jID: number, infoInput: string): Promise<TaskProgressRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE task_progress AS j
      SET info_input = ${infoInput},
          time_submitted = NOW()
      WHERE COALESCE(NULLIF(BTRIM(j."jID"), '')::int, 0) = ${jID}
      RETURNING j.*
    `);

    return row ? normalizeTaskProgress(row) : null;
  }

  static async markTaskProgressChecked(jID: number): Promise<TaskProgressRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE task_progress AS j
      SET time_checked = NOW()
      WHERE COALESCE(NULLIF(BTRIM(j."jID"), '')::int, 0) = ${jID}
      RETURNING j.*
    `);

    return row ? normalizeTaskProgress(row) : null;
  }

  static async claimTaskProgress(jID: number, rewardPoints: number): Promise<TaskProgressRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE task_progress AS j
      SET points_claimed = ${rewardPoints},
          time_claimed = NOW()
      WHERE COALESCE(NULLIF(BTRIM(j."jID"), '')::int, 0) = ${jID}
      RETURNING j.*
    `);

    return row ? normalizeTaskProgress(row) : null;
  }

  // ==========================================================================
  // P4-B2a · 招工**非资金**写入（J2 apply / J3 accept / J4 submit）
  // 依据：docs/route-layer.spec.md §1 #19/#20 · §4.2 J2/J3/J4 · §4.0 R3（无分录的写不得借账本幂等）
  //   · 表（既有 DDL）：migrations/0014_job_flow.sql:79-133（job_application / job_submission）
  //                    migrations/0013_job.sql:60-70（job 状态白名单）· :161-197（核心字段/worker 一次写定守卫）
  //   · 单语句 CTE ⇒ neon HTTP 下一次隐式事务；**零账本**（不写 ledger_entry / account / currency）
  //   · 状态机非法转移由 DB 守卫触发器或本层显式判定挡下 ⇒ 409（借码 LEDGER_CURRENCY_INVALID_TRANSITION，DL119/C5）
  // ==========================================================================

  // ==========================================================================
  // P4-B2b：商品（listing）**非资金**写入与状态机（§1.1:130 / §4.2 P1 / §4.6 批 2 ②）
  //   · 只写 `public.listing`（`migrations/0015_listing.sql:115-140` 的 13 列）；**零** `ledger_entry` /
  //     `account` / `currency` 写（§4.0 R3 + DL99：无分录的写不得借账本幂等）。
  //   · 单语句 CTE（neon HTTP 下一次隐式事务）+ 业务行 `FOR UPDATE` 先锁（§4.4-5 / DL141 加锁全序）。
  //   · 状态机白名单**唯一真源** = `public.listing_status_transition_ok`（0015:83-95）：本层不复制白名单。
  //   · 库存变更闸**唯一真源** = `public.listing_stock_guard`（0015:214-227）：本层在 SQL 内**先判**，
  //     避免裸触发器异常；触发器的 `LD011` 只作第二道防线。
  // ==========================================================================

  /** §4.4-6 / DL125：币种状态闸的读侧（商品标价只允许 `listed` 单位） */
  static async getCurrencyStatus(cid: number): Promise<{ cid: number; status: string } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT c.cid AS cid, c.status AS status
      FROM public.currency AS c
      WHERE c.cid = ${cid}::bigint
      LIMIT 1
    `);
    if (!row) return null;
    return { cid: Number(getValue(row, 'cid') ?? 0), status: String(getValue(row, 'status') ?? '') };
  }

  // ==========================================================================================
  // P4-B3a（§4.2 C1）· 建自定义积分单位 + 建单位费 `currency_create_fee` ×2（owner −fee / uid=-1 +fee）
  // ==========================================================================================
  /**
   * **单语句 CTE = 一个隐式事务**（§4.0 R2「业务行 + 分录必须同一事务」在本仓的等价实现：
   * 迁移冻结 ⇒ 不新增 DB 编排函数 `0018`、不改 `src/ledger.ts` ⇒ 把「锁/写业务行 → 调
   * `ledger_post_event` → 回写引用列」压进**一条** `SELECT`；任一闸失败 ⇒ 整条语句回滚 ⇒
   * **不留孤儿 `currency` 行**）。
   *   · `ins`   ：INSERT `public.currency`（`symbol` UNIQUE ⇒ `ON CONFLICT DO NOTHING`）
   *   · `keyhit`：同键既有 `ledger_entry.request_fingerprint`（重放判定用；快照口径）
   *   · `ev`    ：`FROM ins` 门控 ⇒ **只有真插入时才调账本**（重放/符号占用时**不产生分录**）
   * 口径：`currency` 仅写 DL 既有列（不增删列）；`ref_type='currency'`、`ref_id=新 cid`。
   */
  static async createCurrencyWithFee(input: {
    symbol: string;
    name: string;
    ownerUid: number;
    decimals: number;
    fee: number;
    idempotencyKey: string;
    requestFingerprint: string;
    memo: string;
  }): Promise<RawRow> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH ins AS (
        INSERT INTO public.currency (symbol, name, owner_uid, decimals, status, deposit_cid)
        SELECT ${input.symbol}::text, ${input.name}::text, ${input.ownerUid}::bigint,
               ${input.decimals}::smallint, 'draft', 1
        ON CONFLICT (symbol) DO NOTHING
        RETURNING cid
      ),
      keyhit AS (
        SELECT e.request_fingerprint::text AS fp
        FROM public.ledger_entry AS e
        WHERE e.idempotency_key = ${input.idempotencyKey}::text
        LIMIT 1
      ),
      ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'entries',
          'idempotency_key', ${input.idempotencyKey}::text,
          'request_fingerprint', ${input.requestFingerprint}::text,
          'ref_type', 'currency',
          'ref_id', (SELECT ins.cid::text FROM ins),
          'memo', ${input.memo}::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', ${String(input.ownerUid)}::text, 'cid', '1',
              'delta', ${String(-input.fee)}::text, 'kind', 'currency_create_fee',
              'ref_type', 'currency', 'ref_id', (SELECT ins.cid::text FROM ins)),
            jsonb_build_object('uid', '-1', 'cid', '1',
              'delta', ${String(input.fee)}::text, 'kind', 'currency_create_fee',
              'ref_type', 'currency', 'ref_id', (SELECT ins.cid::text FROM ins))
          )
        )) AS r
        FROM ins
      )
      SELECT
        (SELECT count(*)::int FROM ins) AS inserted,
        (SELECT ins.cid::text FROM ins) AS new_cid,
        (SELECT ev.r FROM ev) AS ledger_result,
        (SELECT keyhit.fp FROM keyhit) AS key_fingerprint,
        (SELECT to_jsonb(t) FROM (
           SELECT c.cid, c.symbol, c.name, c.owner_uid, c.decimals, c.status,
                  c.deposit_amount, c.deposit_cid, c.listed_at
           FROM public.currency AS c
           WHERE c.symbol = ${input.symbol}::text
           LIMIT 1
        ) AS t) AS existing_row
    `);
    const row = rows[0] || null;
    if (!row) throw new Error('createCurrencyWithFee: no row returned');
    return row;
  }

  // ==========================================================================================
  // P4-B3b / FIX-B（§4.2 C2 + §4.3 资金四栏 + §7-3 v0.3）· 上市：
  //   上市费 `currency_create_fee` ×2（→ `-1`）+ 保证金 `listing_deposit` ×2（→ **贷 `uid = -1`**）
  // ==========================================================================================
  /**
   * 单语句 CTE = 一个隐式事务，含四件事：
   *   ① `cur`   ：业务行 `FOR UPDATE`（DL141 加锁全序的**第一步**：业务行先锁）
   *   ② `apply` ：`draft → listed` + `listed_at=now()` + `deposit_amount`（**同一事务**）
   *   ③ `slog`  ：`public.currency_status_log` 审计行（DL73/DL157②：路由层硬约束，
   *               DB 无兜底 ⇒ 本实现用**同一条语句**保证「改状态必有审计」）
   *   ④ `ev`    ：`FROM apply` 门控 ⇒ 只有真迁移时才调账本 ⇒ 重放 / 状态非法 ⇒ **零分录**
   *
   * ★★ **保证金 = `listing_deposit`「上市即消耗」**（不再是 HOLD 冻结形状）：
   *   4 条分录**全部落在 `balance`**、**`frozen_delta` 一律不出现（= 零 `frozen` 变动）**：
   *     ① user `balance -fee` → ② `-1` `balance +fee`（kind `currency_create_fee`，cid 恒 1）
   *     ③ user `balance -dep` → ④ `-1` `balance +dep`（kind `listing_deposit`，cid = 行 `deposit_cid`）
   *   权威口径（本片依据，**不自行推导**）：`ledger.spec` §3.1 R31（v0.2 `:287`）/
   *   `data-layer.spec` DL67（`:454`）/ DL88（`:530`）【均【已冻结】】+ `route-layer.spec`
   *   §4.2 C2 行 / §4.3 资金四栏 / §7-3（v0.3 更正；Zang §5.81 最终裁定）：
   *   **不可退、无退还 kind（`listing_deposit_refund` 不存在）、无罚没**（`hold_forfeit` P3 不启用）。
   *   DB 侧对齐：`0019`（`-1` credit 白名单收 `listing_deposit`）+ `0020`
   *   （`ledger_post_event` 函数体 hold 家族 IN 列表摘除它）—— **均已应用**（注册表 19）。
   *   〔**v0.2 旧形状（错，FIX-B 已改，留痕）**：同 uid 同 cid 两条 `delta=-d` / `frozen_delta=+d`〕
   */
  static async listCurrencyWithDeposit(input: {
    cid: number;
    actorUid: number;
    fee: number;
    depositAmount: number;
    idempotencyKey: string;
    requestFingerprint: string;
    memo: string;
  }, ex?: SqlRunner): Promise<RawRow> {
    // ★ 批 8③：语句 = 模块常量 `LIST_CURRENCY_WITH_DEPOSIT_SQL`（**单一真源**）；
    //   传 `ex`（既有事务）⇒ 在**事务内**执行（供「真生效四段」探针 · `R-8-18`）；否则走 neon 单语句。
    const rows = await runSql(LIST_CURRENCY_WITH_DEPOSIT_SQL, listCurrencyWithDepositParams(input), ex);
    const row = rows[0] || null;
    if (!row) throw new Error('listCurrencyWithDeposit: no row returned');
    return row;
  }

  // ==========================================================================================
  // 批 8④（`route-layer.spec` v2.8 §23.3 · `data-layer.spec` v0.15 §26.4）· 审核动作：
  //   通过 ⇒ 台账行 + 同事务 `draft → listed` + `currency_status_log` 恰 1 行；
  //   驳回 ⇒ 台账行（**必须落**）；`currency.status` 不动、不写状态日志。
  // ==========================================================================================
  /**
   * 单语句 CTE = 一个隐式事务（模块常量 `CURRENCY_REVIEW_POST_EVENT_SQL` 单一真源）；
   * 传 `ex`（既有事务）⇒ 在**事务内**执行（供「真生效四段」探针 · `R-8-18`）。
   * 回执键（路由层用 `->>` / `getValue` 取值）：`cur_found` / `cur_status` / `prior_count` /
   * `applied` / `slogged` / `reviewed` —— 由服务层据此映射既有码（不新增码）。
   */
  static async currencyReviewPostEvent(input: {
    cid: number;
    actorUid: number;
    result: 'approved' | 'rejected';
    requestFingerprint: string;
    idempotencyKey: string;
    memo: string;
  }, ex?: SqlRunner): Promise<RawRow> {
    const rows = await runSql(CURRENCY_REVIEW_POST_EVENT_SQL, currencyReviewPostEventParams(input), ex);
    const row = rows[0] || null;
    if (!row) throw new Error('currencyReviewPostEvent: no row returned');
    return row;
  }

  // ==========================================================================================
  // 批 8④（`route-layer.spec` v2.8 §23.2）· 读口 `GET /api/admin/currency` 的 DB 侧取数
  //   data 键集自 §23.2 起冻结：cid / symbol / name / status / owner_uid / time_created /
  //   listed_at（+ 可选 deposit_amount / deposit_cid）。
  // ==========================================================================================
  /**
   * 只读（`SELECT`）；`statusFilter=null` ⇒ 全量。非法 `status` 由**服务层**（路由层）判 `400`，
   * **不得静默回落**（§23.2 / §23.3(c) 同口径）。**不得**借读口补写（`DL23` 同向）。
   */
  static async listCurrenciesForAdmin(statusFilter: string | null): Promise<RawRow[]> {
    const rows = await runSql(
      `SELECT c.cid AS cid,
              c.symbol AS symbol,
              c.name AS name,
              c.status AS status,
              c.owner_uid AS owner_uid,
              c.time_created AS time_created,
              c.listed_at AS listed_at,
              c.deposit_amount AS deposit_amount,
              c.deposit_cid AS deposit_cid
         FROM public.currency AS c
        WHERE ($1::text IS NULL OR c.status = $1::text)
        ORDER BY c.cid`,
      [statusFilter],
    );
    return rows;
  }

  // ==========================================================================================
  // 批 8⑤（`route-layer.spec` v2.10 §25.2）· 读口 `GET /api/admin/listing` 的 DB 侧取数
  //   data 键集自 §25.2 起冻结（承 `§24.8(b)`）：listing_id / seller_uid / cid / price / stock /
  //   title / status / time_created。只读（只 `SELECT`）；非法 `status` 由**服务层**判 `400`，
  //   **不得静默回落**；**不得**借读口补写（`DL23` 同向）。
  // ==========================================================================================
  static async listListingsForAdmin(statusFilter: string | null): Promise<RawRow[]> {
    const rows = await runSql(
      `SELECT l.listing_id  AS listing_id,
              l.seller_uid  AS seller_uid,
              l.cid         AS cid,
              l.price       AS price,
              l.stock       AS stock,
              l.title       AS title,
              l.status      AS status,
              l.time_created AS time_created
         FROM public.listing AS l
        WHERE ($1::text IS NULL OR l.status = $1::text)
        ORDER BY l.listing_id`,
      [statusFilter],
    );
    return rows;
  }

  /**
   * 商品合规下架（`POST /api/admin/listing/:listingId/takedown`）· 单语句 CTE（隐式事务）。
   * 传 `ex`（既有事务）⇒ 在**事务内**执行（供「真生效四段」探针 · `R-8-18`）。
   * 回执键：`listing_found` / `listing_status` / `prior_count` / `applied` / `reviewed`。
   * **商品轴零账本分录**（`DL59`）⇒ `txid` 恒 `NULL`。
   */
  static async listingTakedownPostEvent(input: {
    listingId: number;
    actorUid: number;
    result: 'approved' | 'rejected';
    targetStatus: string;
    requestFingerprint: string;
    idempotencyKey: string;
    memo: string;
  }, ex?: SqlRunner): Promise<RawRow> {
    const rows = await runSql(LISTING_TAKEDOWN_POST_EVENT_SQL, listingTakedownPostEventParams(input), ex);
    const row = rows[0] || null;
    if (!row) throw new Error('listingTakedownPostEvent: no row returned');
    return row;
  }

  // ==========================================================================================
  // 批 8⑤（`route-layer.spec` v2.10 §25.2）· 读口 `GET /api/admin/arbitration` 的 DB 侧取数
  //   data 键集自 §25.2 起冻结（承 `§24.8(b)`）：job_id / employer_uid / worker_uid / cid /
  //   reward / title / status / time_created。只读（只 `SELECT`）。
  // ==========================================================================================
  static async listJobsForArbitration(statusFilter: string | null): Promise<RawRow[]> {
    const rows = await runSql(
      `SELECT j.job_id       AS job_id,
              j.employer_uid AS employer_uid,
              j.worker_uid   AS worker_uid,
              j.cid          AS cid,
              j.reward       AS reward,
              j.title        AS title,
              j.status       AS status,
              j.time_created AS time_created
         FROM public.job AS j
        WHERE ($1::text IS NULL OR j.status = $1::text)
        ORDER BY j.job_id`,
      [statusFilter],
    );
    return rows;
  }

  /**
   * ★ 批 8⑤ 归属闸（`R-8-25①` / `R-8-26` · `route-layer.spec` v2.10 §25.6）：只读取该 job 的
   * **雇主 uid**（真列 = `public.job.employer_uid`，`0013:81`）供路由层判定「雇主本人 ∨ admin」。
   * **只读**（只 `SELECT`）；job 不存在 ⇒ `null`（路由层据此落既有 `404`）。**无任何写副作用**
   * （状态 / 资金闸真源仍是 `job_post_event` 的单语句）。
   */
  static async getJobEmployerUid(jobId: number): Promise<number | null> {
    const rows = await runSql(
      `SELECT j.employer_uid AS employer_uid
         FROM public.job AS j
        WHERE j.job_id = $1::bigint`,
      [jobId],
    );
    const row = rows[0] || null;
    if (!row) return null;
    return toNumberValue(getValue(row, 'employer_uid'));
  }

  /**
   * 招工仲裁（`POST /api/admin/arbitration/:jobId`）· **唯一写路径**（R1/R2 · 同事务多语句）。
   *
   * 同事务内三段（`withTransaction` · R55/R56）：
   *   ① 锁 `public.job` 行（`FOR UPDATE`）→ 迁入 `disputed`（**既有白名单边** `submitted→disputed`
   *      via `public.job_status_transition_ok`；已 `disputed` ⇒ 不变）—— 兑现 §25.6(d)「平台仲裁 =
   *      唯一把 job 迁入 / 迁出 `disputed` 的动作面」；
   *   ② 调**既有** `public.job_post_event($1::jsonb)`（`op='settle'`（支持雇主 ⇒ `…→settled`）/
   *      `op='refund'` + `to_status='cancelled'`（退单 / 支持打工人 ⇒ `…→cancelled`））—— **资金腿由
   *      DB 侧派生**（`job_payout`/`job_fee`/`commission` 或 `job_escrow_refund` ×2；DL84 白名单）
   *      ⇒ 本方法**不派生任何分录、不自造任何幂等键**（DL95）；
   *   ③ 写 `public.job_arbitration_log`（**通过 / 驳回都必落** ⇒ 驳回不得静默；同键同 `result`
   *      重投 ⇒ `ON CONFLICT (idempotency_key, result) DO NOTHING`）。
   *
   * 回执键：`job_found` / `job_status`（**终态**）/ `prior_status`（**前置态** · `R-9-9①`）/ `prior_count` /
   * `applied` / `reviewed` / `txid`。★ `prior_status` = 同一事务内 `FOR UPDATE` 读得的**前置态**（`curStatus`，
   * 未加第二个往返）；服务层**只许**用它做「可仲裁态」判定，`job_status`（终态）**仅**用于回执输出。
   * 传 `ex`（既有 `TxClient`）⇒ 在**事务内**执行（供「真生效四段」探针 · `R-8-18`）。
   */
  static async jobArbitrationPostEvent(input: {
    jobId: number;
    actorUid: number;
    result: 'approved' | 'rejected';
    targetStatus: 'settled' | 'cancelled';
    requestFingerprint: string;
    idempotencyKey: string;
    memo: string;
  }, ex?: TxClient): Promise<RawRow> {
    const run = async (tx: TxClient): Promise<RawRow> => {
      const curRows = await txQuery<RawRow>(tx,
        `SELECT job_id, employer_uid, worker_uid, status
           FROM public.job
          WHERE job_id = $1::bigint
          FOR UPDATE`,
        [input.jobId]);
      const cur = curRows[0];
      if (!cur) {
        return { job_id: String(input.jobId), job_found: 0, job_status: null, prior_status: null, prior_count: 0, applied: 0, reviewed: 0, txid: null };
      }
      const curStatus = String(cur.status ?? '');

      // 幂等探测（只读）：同键同 result 已落 ⇒ 重放（不再迁状态 / 不再派生资金腿）
      const priorRows = await txQuery<{ n: number }>(tx,
        `SELECT count(*)::int AS n
           FROM public.job_arbitration_log
          WHERE idempotency_key = $1::text
            AND result = $2::text`,
        [input.idempotencyKey, input.result]);
      const prior = Number(priorRows[0]?.n ?? 0);
      if (prior >= 1) {
        return { job_id: String(input.jobId), job_found: 1, job_status: curStatus, prior_status: curStatus, prior_count: prior, applied: 0, reviewed: 0, txid: null };
      }

      // 非可仲裁态（非 submitted / 非 disputed）⇒ 不落任何值（服务层 → 409 JOB_STATE_INVALID）
      if (curStatus !== 'submitted' && curStatus !== 'disputed') {
        return { job_id: String(input.jobId), job_found: 1, job_status: curStatus, prior_status: curStatus, prior_count: 0, applied: 0, reviewed: 0, txid: null };
      }

      // ① 迁入 disputed（既有白名单边；已 disputed ⇒ 白名单不满足 ⇒ 不变）
      if (curStatus === 'submitted') {
        await txQuery(tx,
          `UPDATE public.job AS j
              SET status = 'disputed',
                  time_updated = now()
            WHERE j.job_id = $1::bigint
              AND public.job_status_transition_ok(j.status, 'disputed')`,
          [input.jobId]);
      }

      // ② 资金腿 + 终态（既有编排函数；不派生分录、不自造键）
      const payload = input.targetStatus === 'settled'
        ? { op: 'settle', job_id: String(input.jobId), request_fingerprint: input.requestFingerprint, memo: input.memo }
        : { op: 'refund', job_id: String(input.jobId), to_status: 'cancelled', request_fingerprint: input.requestFingerprint, memo: input.memo };
      const evRows = await txQuery<{ r: Record<string, unknown> }>(tx,
        `SELECT public.job_post_event($1::jsonb) AS r`,
        [JSON.stringify(payload)]);
      const r = (evRows[0]?.r || {}) as Record<string, unknown>;
      const replay = r.idempotent_replay === true;
      const finalStatus = r.status === undefined || r.status === null ? null : String(r.status);
      const txid = r.txid === undefined || r.txid === null ? null : String(r.txid);

      // ③ 台账行（通过 / 驳回都必落；同键同 result 重投不放大）
      let reviewed = 0;
      if (!replay) {
        const insRows = await txQuery<{ log_id: number }>(tx,
          `INSERT INTO public.job_arbitration_log
             (job_id, actor_uid, result, request_fingerprint, idempotency_key, txid, memo)
           VALUES ($1::bigint, $2::bigint, $3::text, $4::text, $5::text, $6::bigint, $7::text)
           ON CONFLICT (idempotency_key, result) DO NOTHING
           RETURNING log_id`,
          [input.jobId, input.actorUid, input.result, input.requestFingerprint, input.idempotencyKey, txid, input.memo]);
        reviewed = insRows.length;
      }

      const applied = finalStatus === input.targetStatus ? 1 : 0;
      // ★ R-9-9①：回执**同时**给「前置态」（`prior_status` = 事务内 `FOR UPDATE` 读得的 `curStatus`）与
      //   「终态」（`job_status` = `job_post_event` 回执的 `finalStatus`）。零新增往返（同事务同读）。
      return { job_id: String(input.jobId), job_found: 1, job_status: finalStatus, prior_status: curStatus, prior_count: 0, applied, reviewed, txid };
    };

    if (ex) return run(ex);
    return withTransaction((tx) => run(tx as TxClient));
  }

  /**
   * ★ 批 8③（`data-layer.spec` v0.12 §23.4）· `AK2` 读口：读 `app_config` 的
   * `listing_deposit_policy` 键**原始 `value`**（只读；**行不存在 / 读不到 ⇒ `null`**）。
   *
   * 落地口径（`route-layer.spec` v2.5 §20.7）：**先读 `AK2` · 读不到 / 非法 ⇒ fail-closed 到常量**；
   * 本方法只负责「读」，**判定与回落**在业务侧（`currency-service.ts` 的 `parseListingDepositPolicyAmount`
   * + 兜底常量）。★ 传 `ex`（既有事务）⇒ 在**同一事务内**取数（供「真生效四段」探针 · `R-8-18`）。
   * ★ 只读；**不得**借此写 `app_config`（`AG2`：唯一写落点 = `saveSystemSettings`）。
   */
  static async getListingDepositPolicyValue(ex?: SqlRunner): Promise<unknown> {
    const rows = await runSql(
      `SELECT value FROM public.app_config WHERE key = 'listing_deposit_policy' LIMIT 1`,
      [],
      ex,
    );
    return (rows[0] as { value?: unknown } | undefined)?.value ?? null;
  }

  /** P1-a 上架：幂等 = `listing.create_key` UNIQUE（同键 ⇒ `existing`，由 service 判重放 / 冲突） */
  static async createListingRow(input: {
    sellerUid: number;
    cid: number;
    price: number;
    stock: number;
    title: string;
    description: string;
    mediaUrls: string[];
    createKey: string;
  }): Promise<{ outcome: 'inserted' | 'existing'; row: RawRow }> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH existing AS (
        SELECT listing_id, seller_uid, cid, price, stock, title, description, media_urls, status, create_key
        FROM public.listing
        WHERE create_key = ${input.createKey}::text
      ),
      ins AS (
        INSERT INTO public.listing (seller_uid, cid, price, stock, title, description, media_urls, status, create_key)
        SELECT ${input.sellerUid}::bigint, ${input.cid}::bigint, ${input.price}::bigint, ${input.stock}::int, ${input.title}::text, ${input.description}::text, ${input.mediaUrls}::text[], 'draft', ${input.createKey}::text
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING listing_id, seller_uid, cid, price, stock, title, description, media_urls, status, create_key, 'inserted'::text AS outcome
      )
      SELECT i.listing_id, i.seller_uid, i.cid, i.price, i.stock, i.title, i.description, i.media_urls, i.status, i.create_key, i.outcome
      FROM ins AS i
      UNION ALL
      SELECT e.listing_id, e.seller_uid, e.cid, e.price, e.stock, e.title, e.description, e.media_urls, e.status, e.create_key, 'existing'::text
      FROM existing AS e
    `);
    const row = rows[0] || null;
    if (!row) throw new Error('createListingRow: no row returned');
    return { outcome: String(getValue(row, 'outcome')) === 'inserted' ? 'inserted' : 'existing', row };
  }

  /**
   * P1-b 编辑（含**库存字段维护**）：业务行先锁；`stock` 变更仅允许 `status='listed'`（0015:214-227）；
   * `delisted` 为**终态** ⇒ 任何字段编辑拒（§4.2 P1「delisted 终态」，读码推断见报告 §1.3-4）。
   * 返回 `row = null` ⇒ listing 不存在（由 service 落 `404`）。
   */
  static async updateListingRow(input: {
    listingId: number;
    actorUid: number;
    price: number | null;
    stock: number | null;
    title: string | null;
    description: string | null;
    mediaUrls: string[] | null;
  }): Promise<{ outcome: 'updated' | 'not_owner' | 'stock_requires_listed' | 'delisted_terminal'; row: RawRow | null }> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH cur AS (
        SELECT listing_id, seller_uid, cid, price, stock, title, description, media_urls, status, create_key
        FROM public.listing
        WHERE listing_id = ${input.listingId}::bigint
        FOR UPDATE
      ),
      guarded AS (
        SELECT cur.*,
               CASE
                 WHEN cur.seller_uid <> ${input.actorUid}::bigint THEN 'not_owner'
                 WHEN cur.status = 'delisted' THEN 'delisted_terminal'
                 WHEN ${input.stock}::int IS NOT NULL AND ${input.stock}::int IS DISTINCT FROM cur.stock AND cur.status <> 'listed' THEN 'stock_requires_listed'
                 ELSE 'ok'
               END AS outcome
        FROM cur
      ),
      upd AS (
        UPDATE public.listing AS l
        SET price        = COALESCE(${input.price}::bigint, l.price),
            stock        = COALESCE(${input.stock}::int, l.stock),
            title        = COALESCE(${input.title}::text, l.title),
            description  = COALESCE(${input.description}::text, l.description),
            media_urls   = COALESCE(${input.mediaUrls}::text[], l.media_urls)
        WHERE l.listing_id = ${input.listingId}::bigint
          AND (SELECT g.outcome FROM guarded AS g) = 'ok'
        RETURNING l.listing_id, l.seller_uid, l.cid, l.price, l.stock, l.title, l.description, l.media_urls, l.status, l.create_key, 'updated'::text AS outcome
      )
      SELECT u.listing_id, u.seller_uid, u.cid, u.price, u.stock, u.title, u.description, u.media_urls, u.status, u.create_key, u.outcome
      FROM upd AS u
      UNION ALL
      SELECT g.listing_id, g.seller_uid, g.cid, g.price, g.stock, g.title, g.description, g.media_urls, g.status, g.create_key, g.outcome
      FROM guarded AS g WHERE g.outcome <> 'ok'
    `);
    const row = rows[0] || null;
    if (!row) return { outcome: 'updated', row: null };
    const outcome = String(getValue(row, 'outcome'));
    if (outcome === 'updated') return { outcome: 'updated', row };
    return { outcome: outcome as 'not_owner' | 'stock_requires_listed' | 'delisted_terminal', row };
  }

  /**
   * P1-c 状态迁移（上架 / 下架 / 冻结 / 复牌）：白名单**唯一真源** = `public.listing_status_transition_ok`。
   * 白名单外（含 `from == to`）⇒ `invalid_transition`（由 service 落 `409 LD011 + LISTING_STATE_INVALID`）。
   */
  static async transitionListingRow(
    listingId: number,
    actorUid: number,
    toStatus: string,
  ): Promise<{ outcome: 'updated' | 'not_owner' | 'invalid_transition'; row: RawRow | null }> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH cur AS (
        SELECT listing_id, seller_uid, cid, price, stock, title, description, media_urls, status, create_key
        FROM public.listing
        WHERE listing_id = ${listingId}::bigint
        FOR UPDATE
      ),
      guarded AS (
        SELECT cur.*,
               CASE
                 WHEN cur.seller_uid <> ${actorUid}::bigint THEN 'not_owner'
                 WHEN public.listing_status_transition_ok(cur.status, ${toStatus}::text) THEN 'ok'
                 ELSE 'invalid_transition'
               END AS outcome
        FROM cur
      ),
      upd AS (
        UPDATE public.listing AS l
        SET status = ${toStatus}::text
        WHERE l.listing_id = ${listingId}::bigint
          AND (SELECT g.outcome FROM guarded AS g) = 'ok'
        RETURNING l.listing_id, l.seller_uid, l.cid, l.price, l.stock, l.title, l.description, l.media_urls, l.status, l.create_key, 'updated'::text AS outcome
      )
      SELECT u.listing_id, u.seller_uid, u.cid, u.price, u.stock, u.title, u.description, u.media_urls, u.status, u.create_key, u.outcome
      FROM upd AS u
      UNION ALL
      SELECT g.listing_id, g.seller_uid, g.cid, g.price, g.stock, g.title, g.description, g.media_urls, g.status, g.create_key, g.outcome
      FROM guarded AS g WHERE g.outcome <> 'ok'
    `);
    const row = rows[0] || null;
    if (!row) return { outcome: 'updated', row: null };
    const outcome = String(getValue(row, 'outcome'));
    if (outcome === 'updated') return { outcome: 'updated', row };
    return { outcome: outcome as 'not_owner' | 'invalid_transition', row };
  }

  /** §3.1/DL111：解析 :identifier（application_id 或 job_id）→ 该 worker 的申请；他人申请返回 ownership='other' */
  static async resolveJobApplication(
    identifier: number,
    workerUid: number,
  ): Promise<{ applicationId: number; workerUid: number; ownership: 'self' | 'other' } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT a.application_id, a.worker_uid,
             CASE WHEN a.worker_uid = ${workerUid} THEN 'self' ELSE 'other' END AS ownership
        FROM public.job_application AS a
       WHERE a.application_id = ${identifier} OR a.job_id = ${identifier}
       ORDER BY (a.application_id = ${identifier}) DESC,
                (a.worker_uid = ${workerUid}) DESC,
                a.application_id DESC
       LIMIT 1
    `);

    if (!row) return null;

    return {
      applicationId: toNumberValue(getValue(row, 'application_id')),
      workerUid: toNumberValue(getValue(row, 'worker_uid')),
      ownership: toStringValue(getValue(row, 'ownership')) === 'self' ? 'self' : 'other',
    };
  }

  // ==========================================================================================
  // P4-B3c（§4.2 J1/J5/J6 + §4.0 R1/R2/R4/DL20）· 招工**资金**编排的唯一调用口
  // ==========================================================================================
  /**
   * **唯一资金写路径**（§4.0 R1）：一条语句调用迁移既有编排函数 `public.job_post_event($1::jsonb)`。
   * 函数内完成「锁业务行（`FOR UPDATE`）→ 派生分录 → 调 `ledger_post_event` → 回写
   * `escrow_txid`/`settle_txid`/`ledger_event_keys`/`status`」⇒ **业务行 + 分录同生同灭**（R2/DL20）。
   * 本方法**只转发 payload**：不派生分录、不自造幂等键（DL95：键由函数按 §8 确定性派生
   * `biz:job:{escrow,settle,refund}:<job_id>`）、不写 `account`/`ledger_entry`。
   * 返回值 = 函数回执 `{ok, idempotent_replay, op, job_id, status, escrow_txid, settle_txid,
   * ledger_event_keys, txid, ledger_idempotency_key, entries, accounts, extra}`。
   */
  static async jobPostEvent(payload: Record<string, unknown>): Promise<RawRow> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT public.job_post_event(${JSON.stringify(payload)}::jsonb) AS r
    `);
    if (!row) throw new Error('jobPostEvent: no row returned');
    return row;
  }

  /**
   * §4.2 J5/J6 路由前置（**只读**）：解析 `POST /api/tasklist/:jID/verify` 的 `:jID` → 目标 job。
   * 口径与 `resolveJobApplication`（DL111）同族：**先按 `application_id` 精确匹配**，未命中再容错按
   * `job_id` 匹配（前端读口 `getTaskProgress`/`listPendingVerification` 的 `jID` 键 = `application_id`）。
   * 资金/状态写入**一律不在此处**（仍由 `job_post_event` 的单语句完成）⇒ 本方法无任何写副作用。
   */
  static async resolveReviewTarget(identifier: number): Promise<{
    applicationId: number;
    jobId: number;
    applicantUid: number;
    jobWorkerUid: number | null;
    employerUid: number;
    jobStatus: string;
    applicationStatus: string;
  } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT a.application_id, a.job_id, a.worker_uid AS applicant_uid, a.status AS application_status,
             j.worker_uid AS job_worker_uid, j.employer_uid, j.status AS job_status
        FROM public.job_application AS a
        JOIN public.job AS j ON j.job_id = a.job_id
       WHERE a.application_id = ${identifier} OR a.job_id = ${identifier}
       ORDER BY (a.application_id = ${identifier}) DESC, a.application_id DESC
       LIMIT 1
    `);
    if (!row) return null;
    const jw = getValue(row, 'job_worker_uid');
    return {
      applicationId: toNumberValue(getValue(row, 'application_id')),
      jobId: toNumberValue(getValue(row, 'job_id')),
      applicantUid: toNumberValue(getValue(row, 'applicant_uid')),
      jobWorkerUid: jw === null || jw === undefined ? null : toNumberValue(jw),
      employerUid: toNumberValue(getValue(row, 'employer_uid')),
      jobStatus: toStringValue(getValue(row, 'job_status')),
      applicationStatus: toStringValue(getValue(row, 'application_status')),
    };
  }

  /**
   * §4.0 R4 / 派单硬口径 #3「**审核通过 → 发放必须原子**」的本仓等价实现：
   * `job_post_event(...)`（业务行状态 + 全部资金分录）与 `job_submission.review_status` 的**结论位**
   * 压在**同一条 SQL 语句**（= 一个隐式事务）内 ⇒ 任一失败 ⇒ **整条回滚**，
   * **不存在**「状态 `settled` 但没发放」「已审核但没发放」「已发放但未审核」三种半成品。
   *   · `ev`  ：先跑编排函数（它内部对 `public.job` 行 `FOR UPDATE` —— DL141 全序第一段，
   *             且它在**自己的语句内**调用 `ledger_post_event`；失败 ⇒ 本语句整体报错、`sub` 一并回滚）
   *   · `sub` ：只改**该 job × 该 worker 的最新一条 `pending` 提交**的结论位
   *             （`pending → approved|rejected`；`reviewed_by/reviewed_at/review_memo` 一次写定，
   *              符合 `0014:209-248` 的 `job_submission_immutable_guard`）
   * 返回值 = `{ r: <job_post_event 回执>, submissions_reviewed: <int> }`。
   * 注：重放（同键同指纹）时编排函数返回 `idempotent_replay=true`，此时 `submissions_reviewed` 通常 = 0
   * （结论位已非 `pending`，`WHERE` 不命中）—— 这是**正确**读数，不是缺陷。
   */
  static async reviewJobSubmission(input: {
    payload: Record<string, unknown>;
    reviewStatus: 'approved' | 'rejected';
    reviewedBy: number;
    reviewMemo: string;
  }): Promise<RawRow> {
    const sql = getSql();
    const jobIdText = String(input.payload.job_id ?? '');
    const rows = extractRows(await sql`
      WITH ev AS (
        SELECT public.job_post_event(${JSON.stringify(input.payload)}::jsonb) AS r
      ), sub AS (
        UPDATE public.job_submission AS s
           SET review_status = ${input.reviewStatus}::text,
               reviewed_by   = ${input.reviewedBy}::bigint,
               reviewed_at   = now(),
               review_memo   = ${input.reviewMemo}::text
         WHERE s.job_id = ${jobIdText}::bigint
           AND s.review_status = 'pending'
           AND s.worker_uid = (SELECT j.worker_uid FROM public.job AS j WHERE j.job_id = ${jobIdText}::bigint)
           AND s.submission_id = (
                 SELECT max(s0.submission_id) FROM public.job_submission AS s0
                  WHERE s0.job_id = ${jobIdText}::bigint
                    AND s0.worker_uid = (SELECT j.worker_uid FROM public.job AS j WHERE j.job_id = ${jobIdText}::bigint))
        RETURNING s.submission_id
      )
      SELECT (SELECT ev.r FROM ev) AS r,
             (SELECT count(*)::int FROM sub) AS submissions_reviewed
    `);
    const row = rows[0] || null;
    if (!row) throw new Error('reviewJobSubmission: no row returned');
    return row;
  }

  // ==========================================================================================
  // P4-B3d（§4.2 P2/P4 + §4.0 R1/R2/DL85）· 商品**资金**编排的唯一调用口
  // ==========================================================================================
  /**
   * **唯一资金写路径**（§4.0 R1）：一条语句调用迁移既有编排函数 `public.listing_post_event($1::jsonb)`
   * （`migrations/0015_listing.sql:449`）。函数内完成「锁业务行（`FOR UPDATE`，listing 先于
   * `listing_order`/`account`，DL141 全序）→ 派生分录 → 调 `ledger_post_event` → 回写
   * `pay_txid`/`refund_txid`/`ledger_event_keys`/`status`/`stock`」⇒ **业务行 + 分录同生同灭**（R2/DL20）。
   * 本方法**只转发 payload**：不派生分录、不自造幂等键（DL95：键由函数按 §4.5 确定性派生
   * `biz:listing:buy:<order_id>` / `biz:listing:refund:<order_id>`）、不写 `account`/`ledger_entry`/`listing*`。
   * **金额/对手方一律服务端取数**：`amount = listing.price × quantity`、`seller_uid = listing.seller_uid`
   * 均在函数体 `0015:590,647`（refund 侧 `0015:710,721,724`）内取 ⇒ 本方法的 payload 契约**不含** price/seller。
   * 返回值 = 函数回执 `{ok, idempotent_replay, op, listing_id, order_id, listing_status, order_status,
   * stock, created, pay_txid, refund_txid, ledger_event_keys, txid, ledger_idempotency_key, entries,
   * accounts, extra}`。
   */
  static async listingPostEvent(payload: Record<string, unknown>): Promise<RawRow> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT public.listing_post_event(${JSON.stringify(payload)}::jsonb) AS r
    `);
    if (!row) throw new Error('listingPostEvent: no row returned');
    return row;
  }

  /**
   * ★★ P7-B（§7-32 / §12.11.3 · I-11）：商品退款（**卖方 ∨ 管理员**）的**唯一资金写路径**。
   *
   * 调用 **一条语句** `SELECT public.listing_refund_post_event($1::jsonb)`
   * （`migrations/0024_admin_refund_audit.sql`）—— 该函数在**同一函数体、同一条语句**内完成
   * 「（无 advisory lock · Z4b）→ 调**既有** `public.listing_post_event(op='refund')`
   * （**复用资金腿**：`purchase_refund` ×2 / 金额服务端取数 / 不回滚库存全在 `0015`）
   * → 写 `public.admin_refund_audit_log`」⇒ **审计行与资金事件同生同灭**。
   *
   * 本方法**只转发 payload**：不派生分录、不写 `account`/`ledger_entry`/审计表、不自造幂等键
   * （DL95：键由函数按 §4.5 确定性派生）。
   *
   * 回执 = **编排函数回执**（`{ ok, order_id, txid, idempotent_replay, audit_logged, result,
   * refund_receipt }`；成功面 `refund_receipt` = 既有 `listing_post_event` 的回执）。
   * **★ §12.12.5③**：编排回执与对外路由回执是**两层** ⇒ 服务层**不得**把编排回执原样透传
   * （对外视图取自 `refund_receipt`）。
   */
  static async listingRefundPostEvent(payload: Record<string, unknown>): Promise<RawRow> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT public.listing_refund_post_event(${JSON.stringify(payload)}::jsonb) AS r
    `);
    if (!row) throw new Error('listingRefundPostEvent: no row returned');
    return row;
  }

  /**
   * ★★ P4-B3e（§4.2 M1/M2/M3 · **DL68 币对级串行化**）：交易所（market）唯一资金写路径。
   *
   * `public.market_post_event($1::jsonb)`（`migrations/0016_market.sql:393`）在**单条语句**内完成
   * 「锁业务行（主键升序）→ 派生分录 → 调 `ledger_post_event` → 回写 `ledger_event_keys`/`status`/
   * `amount_filled`」⇒ 业务行 + 分录**同生同灭**（R2/DL20）。本方法**只转发 payload**：不派生分录、
   * 不自造幂等键（DL95：键由函数按 §4.5 确定性派生）、不写 `account`/`ledger_entry`/`market_*`。
   *
   * **★★ DL68 币对级串行化（本片兑现）**：DL68 v0.6 加注逐字「本条的串行化义务**不在 DB 层兑现**，登记为
   * **P5 路由层 / 撮合服务的必须交付项**」⇒ 本方法在**唯一写语句的外层 CTE** 取
   * `pg_advisory_xact_lock(base_cid::int4, quote_cid::int4)`（两参 int4 形式；语义等价于
   * `hash(币对)` 且**无碰撞**、探针可逐字复现）。**取锁是可靠的**：`pg_advisory_xact_lock` 是 **VOLATILE**
   * ⇒ 含它的 CTE **不被内联**（另加 `OFFSET 0` 强制物化，双保险）⇒ 物化先于外层求值 ⇒
   * **锁在 `market_post_event` 执行之前取得**，并在**语句（隐式事务）结束**时释放（`xact` 变体）
   * ⇒ 同币对串行、异币对并行。**残余（明记）**：调用方（`market-service`）的**对手方选择**是锁**之前**的
   * 一次只读读 ⇒ DL68 v0.6 ②c 的「撮合决策新鲜度」残余风险仍在（并发同币对时后到者在锁内被 DB 闸
   * **响亮拒绝**，不会超卖）；消除残余需「选择也进锁内」的交互式事务方案（`src/db.ts` R55/R56 已存在）。
   *
   * 返回值 = 函数回执 `{ok, idempotent_replay, op, order_id, owner_uid, side, base_cid, quote_cid, price,
   * amount, amount_filled, status, frozen_hold, created, ledger_event_keys, txid, ledger_idempotency_key,
   * entries, accounts, extra}`。
   */
  static async marketPostEvent(
    payload: Record<string, unknown>,
    pair: { baseCid: number; quoteCid: number },
  ): Promise<RawRow> {
    const sql = getSql();
    const row = firstRow(await sql`
      WITH l AS (
        SELECT pg_advisory_xact_lock(${pair.baseCid}::int4, ${pair.quoteCid}::int4) AS k
        OFFSET 0
      )
      SELECT public.market_post_event(${JSON.stringify(payload)}::jsonb) AS r
        FROM l
    `);
    if (!row) throw new Error('marketPostEvent: no row returned');
    return row;
  }

  /**
   * §4.2 M2/M3 路由前置（**只读**）：`market_order` 行的服务端真源字段。
   * 用途 = ① 撤单的「须 = `owner_uid`」应用层授权闸；② 成交的 taker 行（pair/side/price/owner）。
   * **无任何写副作用** —— 授权/状态/余额/币种闸的真源仍是 `market_post_event` 的单语句
   * （`0016:517-...` 的 `FOR UPDATE` + 状态机 + `side/cid/price` 自洽闸）。
   */
  static async resolveMarketOrder(orderId: number): Promise<{
    orderId: number;
    ownerUid: number;
    side: string;
    baseCid: number;
    quoteCid: number;
    price: string;
    amount: string;
    amountFilled: string;
    status: string;
  } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT o.order_id::text      AS order_id,
             o.owner_uid::text     AS owner_uid,
             o.side                AS side,
             o.base_cid::text      AS base_cid,
             o.quote_cid::text     AS quote_cid,
             o.price::text         AS price,
             o.amount::text        AS amount,
             o.amount_filled::text AS amount_filled,
             o.status              AS status
        FROM public.market_order o
       WHERE o.order_id = ${orderId}::bigint
    `);
    if (!row) return null;
    return {
      orderId: Number(getValue(row, 'order_id')),
      ownerUid: Number(getValue(row, 'owner_uid')),
      side: String(getValue(row, 'side') ?? ''),
      baseCid: Number(getValue(row, 'base_cid')),
      quoteCid: Number(getValue(row, 'quote_cid')),
      price: String(getValue(row, 'price') ?? ''),
      amount: String(getValue(row, 'amount') ?? ''),
      amountFilled: String(getValue(row, 'amount_filled') ?? ''),
      status: String(getValue(row, 'status') ?? ''),
    };
  }

  /**
   * §4.2 M3（**只读**）：**服务端**选择最优**可成交**对手方（撮合决策口径 = `market-service` 文件头，单点可改）。
   * 口径：同 `(base_cid,quote_cid)` · 反向 · `status ∈ {open,partial}` · 有余量 · **可成交**
   * （taker=buy ⇒ `o.price <= 买单限价`；taker=sell ⇒ `o.price >= 卖单限价`）·
   * **价优优先 → `time_created` → `order_id`**（确定性全序）；`excludeSelf=true` ⇒ 排除同 owner（**自成交**）。
   * **本方法不接受任何客户端入参**（只接受服务端已解析的订单真值）。
   */
  static async resolveMarketCounterparty(input: {
    baseCid: number;
    quoteCid: number;
    takerOrderId: number;
    takerSide: string;
    takerPrice: string;
    takerOwnerUid: number;
    excludeSelf: boolean;
  }): Promise<{ orderId: number; ownerUid: number; price: string; remaining: string } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT o.order_id::text AS order_id,
             o.owner_uid::text AS owner_uid,
             o.price::text AS price,
             (o.amount - o.amount_filled)::text AS remaining
        FROM public.market_order o
       WHERE o.base_cid  = ${input.baseCid}::bigint
         AND o.quote_cid = ${input.quoteCid}::bigint
         AND o.side <> ${input.takerSide}::text
         AND o.status IN ('open','partial')
         AND o.order_id <> ${input.takerOrderId}::bigint
         AND o.amount > o.amount_filled
         AND (CASE WHEN ${input.takerSide}::text = 'buy'
                   THEN o.price <= ${input.takerPrice}::bigint
                   ELSE o.price >= ${input.takerPrice}::bigint END)
         AND (NOT ${input.excludeSelf}::boolean OR o.owner_uid <> ${input.takerOwnerUid}::bigint)
       ORDER BY (o.owner_uid = ${input.takerOwnerUid}::bigint) ASC,
                (CASE WHEN ${input.takerSide}::text = 'buy'  THEN o.price END) ASC,
                (CASE WHEN ${input.takerSide}::text = 'sell' THEN o.price END) DESC,
                o.time_created ASC,
                o.order_id ASC
       LIMIT 1
    `);
    if (!row) return null;
    return {
      orderId: Number(getValue(row, 'order_id')),
      ownerUid: Number(getValue(row, 'owner_uid')),
      price: String(getValue(row, 'price') ?? ''),
      remaining: String(getValue(row, 'remaining') ?? ''),
    };
  }

  /** §4.2 M2「全撤 = 逐单」的**只读**候选集（`status ∈ {open,partial}` 且有余量；`order_id` 升序确定）。 */
  static async listOpenMarketOrderIds(uid: number): Promise<number[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT o.order_id::text AS order_id
        FROM public.market_order o
       WHERE o.owner_uid = ${uid}::bigint
         AND o.status IN ('open','partial')
         AND o.amount > o.amount_filled
       ORDER BY o.order_id ASC
    `);
    return rows.map((r) => Number(getValue(r, 'order_id'))).filter((n) => Number.isInteger(n) && n > 0);
  }

  /**
   * §4.2 M3 / **D-2**（**只读**）：现行佣金政策费率（`fee_rate_bp`）。
   * 「**唯一真源 = `commission_policy.fee_rate_bp`**」（§4.4-11 逐字）⇒ 交易所手续费**服务端取数**用它，
   * **不接受客户端传 `fee`**。无政策行 ⇒ 返回 `null`（调用方取 `fee = 0` 并**登记**，不静默编造费率）。
   */
  static async currentFeeRateBp(): Promise<number | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT p.fee_rate_bp::int AS bp
        FROM public.commission_policy p
       WHERE p.effective_from <= now()
       ORDER BY p.effective_from DESC, p.policy_id DESC
       LIMIT 1
    `);
    if (!row) return null;
    const bp = Number(getValue(row, 'bp'));
    return Number.isFinite(bp) ? bp : null;
  }

  /**
   * §4.2 P4 路由前置（**只读**）：解析 `POST /api/listing/order/:orderId/refund` 的 `:orderId`
   * ⇒ 订单行的**服务端真源字段**（供服务层做「发起人须 = 卖方」的应用层闸）。
   * **本方法无任何写副作用** —— 授权/金额/状态/库存闸的真源仍是 `listing_post_event` 的单语句
   * （`0015:670-692` 的 `FOR UPDATE` + 状态机 + `pay_txid IS NULL` 三道 DB 闸）。
   */
  static async resolveListingOrder(orderId: number): Promise<{
    orderId: number;
    listingId: number;
    buyerUid: number;
    sellerUid: number;
    cid: number;
    price: string;
    quantity: number;
    status: string;
    hasPayTxid: boolean;
    hasRefundTxid: boolean;
  } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT o.order_id, o.listing_id, o.buyer_uid, o.seller_uid, o.cid,
             o.price::text AS price, o.quantity, o.status,
             (o.pay_txid IS NOT NULL) AS has_pay_txid,
             (o.refund_txid IS NOT NULL) AS has_refund_txid
        FROM public.listing_order AS o
       WHERE o.order_id = ${orderId}
       LIMIT 1
    `);
    if (!row) return null;
    return {
      orderId: toNumberValue(getValue(row, 'order_id')),
      listingId: toNumberValue(getValue(row, 'listing_id')),
      buyerUid: toNumberValue(getValue(row, 'buyer_uid')),
      sellerUid: toNumberValue(getValue(row, 'seller_uid')),
      cid: toNumberValue(getValue(row, 'cid')),
      price: String(getValue(row, 'price') ?? ''),
      quantity: toNumberValue(getValue(row, 'quantity')),
      status: toStringValue(getValue(row, 'status')),
      hasPayTxid: getValue(row, 'has_pay_txid') === true,
      hasRefundTxid: getValue(row, 'has_refund_txid') === true,
    };
  }

  /** §4.2 J4：提交交付物 —— `job_submission` 落行（review_status='pending'）+ `job.status→'submitted'`，同语句原子 */
  static async submitJobWork(
    applicationId: number,
    workerUid: number,
    deliverable: string,
    createKey: string,
  ): Promise<{
    outcome: 'inserted' | 'replay' | 'blocked';
    applicationId: number;
    applicationStatus: string;
    jobStatus: string;
    existingDeliverable: string | null;
  } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      WITH target AS (
        SELECT a.application_id, a.job_id, a.worker_uid, a.status AS app_status,
               j.status AS job_status
          FROM public.job_application AS a
          JOIN public.job AS j ON j.job_id = a.job_id
         WHERE a.application_id = ${applicationId}
           AND a.worker_uid = ${workerUid}
      ), upd_job AS (
        UPDATE public.job AS j
           SET status = 'submitted'
          FROM target AS t
         WHERE j.job_id = t.job_id
           AND t.job_status = 'accepted'
           AND t.app_status = 'accepted'
        RETURNING j.job_id
      ), ins AS (
        INSERT INTO public.job_submission (job_id, worker_uid, deliverable, review_status, create_key)
        SELECT t.job_id, t.worker_uid, ${deliverable}, 'pending', ${createKey}
          FROM target AS t
         WHERE t.app_status = 'accepted'
        ON CONFLICT (create_key) DO NOTHING
        RETURNING submission_id, deliverable
      ), cur AS (
        SELECT 'inserted' AS outcome, i.submission_id, i.deliverable
          FROM ins AS i
        UNION ALL
        SELECT 'replay', s.submission_id, s.deliverable
          FROM public.job_submission AS s, target AS t
         WHERE s.create_key = ${createKey}
           AND s.job_id = t.job_id
           AND s.worker_uid = t.worker_uid
           AND NOT EXISTS (SELECT 1 FROM ins)
      )
      SELECT t.application_id AS application_id,
             t.app_status AS application_status,
             t.job_status AS job_status,
             COALESCE(c.outcome, 'blocked') AS outcome,
             c.deliverable AS existing_deliverable
        FROM target AS t
        LEFT JOIN cur AS c ON TRUE
    `);

    if (!row) return null;

    return {
      outcome: (toStringValue(getValue(row, 'outcome')) || 'blocked') as 'inserted' | 'replay' | 'blocked',
      applicationId: toNumberValue(getValue(row, 'application_id')),
      applicationStatus: toStringValue(getValue(row, 'application_status')),
      jobStatus: toStringValue(getValue(row, 'job_status')),
      existingDeliverable: getValue(row, 'existing_deliverable') === null || getValue(row, 'existing_deliverable') === undefined
        ? null
        : toStringValue(getValue(row, 'existing_deliverable')),
    };
  }

  /** §4.2 J2：报名 —— `job_application` 落行（status='applied'），同语句原子；`job.status` 必须 'open' 且非雇主自投 */
  static async applyToJob(
    jobId: number,
    workerUid: number,
    createKey: string,
    ex?: SqlRunner,
  ): Promise<{
    outcome: 'applied' | 'replay' | 'already_applied' | 'not_open' | 'self_application' | 'batt_below_threshold' | 'conflict';
    applicationId: number | null;
    jobStatus: string;
  } | null> {
    // ★ P9② 双闸（`R-9-18`）落点 A · **前置闸（fail-fast）**：阈值取 `batt_policy.acceptThresholdBatt`
    //   （TS fail-closed 到常量 9）；闸在 **SQL 单写路径 CTE `ins` 的 `WHERE`** 内（沿 8④ `C2` 教训）。
    const { policy: battPolicy } = resolveBattPolicy(await this.getAppConfigValueByKey('batt_policy', ex));
    const acceptThresholdBatt = battPolicy.acceptThresholdBatt;
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      WITH j AS (
        SELECT job.job_id, job.employer_uid, job.status AS job_status
          FROM public.job AS job
         WHERE job.job_id = ${jobId}
      ), ins AS (
        INSERT INTO public.job_application (job_id, worker_uid, status, create_key)
        SELECT j.job_id, ${workerUid}, 'applied', ${createKey}
          FROM j
         WHERE j.job_status = 'open'
           AND j.employer_uid <> ${workerUid}
           AND COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${workerUid}), 0)
               >= COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                                        THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END
                               FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1),
                           ${acceptThresholdBatt})
        ON CONFLICT DO NOTHING
        RETURNING application_id
      ), cur AS (
        SELECT 'applied' AS outcome, i.application_id
          FROM ins AS i
        UNION ALL
        SELECT 'replay', a.application_id
          FROM public.job_application AS a, j
         WHERE a.create_key = ${createKey}
           AND a.job_id = j.job_id
           AND a.worker_uid = ${workerUid}
           AND NOT EXISTS (SELECT 1 FROM ins)
        UNION ALL
        SELECT 'already_applied', a.application_id
          FROM public.job_application AS a, j
         WHERE a.job_id = j.job_id
           AND a.worker_uid = ${workerUid}
           AND a.create_key <> ${createKey}
           AND NOT EXISTS (SELECT 1 FROM ins)
      )
      SELECT j.job_id AS job_id, j.job_status AS job_status,
             COALESCE(c.outcome,
                      CASE WHEN j.job_status <> 'open' THEN 'not_open'
                           WHEN j.employer_uid = ${workerUid} THEN 'self_application'
                           WHEN COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${workerUid}), 0)
                                < COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                                                       THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END
                                              FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1),
                                          ${acceptThresholdBatt})
                                THEN 'batt_below_threshold'
                           ELSE 'conflict' END) AS outcome,
             c.application_id AS application_id
        FROM j
        LEFT JOIN cur AS c ON TRUE
    `);

    if (!row) return null;

    return {
      outcome: (toStringValue(getValue(row, 'outcome')) || 'conflict') as
        'applied' | 'replay' | 'already_applied' | 'not_open' | 'self_application' | 'batt_below_threshold' | 'conflict',
      applicationId: getValue(row, 'application_id') === null || getValue(row, 'application_id') === undefined
        ? null
        : toNumberValue(getValue(row, 'application_id')),
      jobStatus: toStringValue(getValue(row, 'job_status')),
    };
  }

  /** §4.2 J3：雇主选定打工人 —— `job_application.status→'accepted'` + `job.status→'accepted'` / `job.worker_uid` 一次写定 */
  static async acceptJobApplication(
    jobId: number,
    applicationId: number,
    actorUid: number,
    ex?: SqlRunner,
  ): Promise<{
    outcome: 'accepted' | 'not_employer' | 'already_accepted' | 'app_state_invalid' | 'job_state_invalid' | 'batt_below_threshold';
    applicationId: number;
    jobId: number;
    workerUid: number;
    applicationStatus: string;
    jobStatus: string;
    workerBattAfter: number | null;
  } | null> {
    // ★ P9② 双闸（`R-9-18`）落点 B · **权威扣费点**：`upd` CTE 同事务追加电量闸（标的 = `t.worker_uid`）；
    //   `deduct` CTE **同事务扣 `taskCostBatt`（fallback 9）** + **二次判 ≥ cost**（不满足 ⇒ 无行 ⇒
    //   整体回滚 ⇒ 409）；`ins_entry` 为该扣减落 `batt_entry` 逐笔凭证（reason `task_cost`）。
    //   两处均 **SQL 单写路径 CTE**（不可绕过 · 沿 8④ `C2` 教训）；`batt_account` 无行 ⇒ `COALESCE 0`（fail-closed）。
    const { policy: battPolicy } = resolveBattPolicy(await this.getAppConfigValueByKey('batt_policy', ex));
    const acceptThresholdBatt = battPolicy.acceptThresholdBatt;
    const taskCostBatt = battPolicy.taskCostBatt;
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      WITH target AS (
        SELECT a.application_id, a.job_id, a.worker_uid, a.status AS app_status,
               j.employer_uid, j.status AS job_status
          FROM public.job_application AS a
          JOIN public.job AS j ON j.job_id = a.job_id
         WHERE a.application_id = ${applicationId}
           AND a.job_id = ${jobId}
      ), thr AS (
        SELECT COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                                      THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END
                             FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1), ${acceptThresholdBatt}) AS accept,
               COALESCE((SELECT CASE WHEN (p.value->>'taskCostBatt') ~ '^[0-9]+$'
                                      THEN (p.value->>'taskCostBatt')::int ELSE NULL END
                             FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1), ${taskCostBatt}) AS cost
      ), gate AS (
        SELECT t.*, COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = t.worker_uid), 0)::int AS worker_batt
          FROM target AS t
      ), upd AS (
        UPDATE public.job_application AS a
           SET status = 'accepted'
          FROM gate AS g, thr
         WHERE a.application_id = g.application_id
           AND g.app_status = 'applied'
           AND g.employer_uid = ${actorUid}
           AND g.job_status = 'open'
           AND g.worker_batt >= thr.accept
        RETURNING a.application_id
      ), upd_job AS (
        UPDATE public.job AS j
           SET status = 'accepted', worker_uid = t.worker_uid
          FROM target AS t
         WHERE j.job_id = t.job_id
           AND t.job_status = 'open'
           AND EXISTS (SELECT 1 FROM upd)
        RETURNING j.job_id
      ), deduct AS (
        UPDATE public.batt_account AS b
           SET batt = b.batt - (SELECT cost FROM thr)
          FROM gate AS g, thr
         WHERE b.uid = g.worker_uid
           AND EXISTS (SELECT 1 FROM upd)
           AND b.batt >= (SELECT cost FROM thr)
        RETURNING b.batt, b.uid
      ), ins_entry AS (
        INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
        SELECT d.uid, -1 * (SELECT cost FROM thr), d.batt, 'task_cost',
               'biz:job:accept:cost:' || d.uid::text || ':' || ${applicationId}::text,
               'job_application', ${applicationId}::bigint, ''
          FROM deduct AS d
         WHERE (SELECT cost FROM thr) <> 0
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING txid
      )
      SELECT t.application_id AS application_id, t.job_id AS job_id, t.worker_uid AS worker_uid,
             t.app_status AS application_status, t.job_status AS job_status,
             COALESCE(CASE WHEN EXISTS (SELECT 1 FROM upd) THEN 'accepted' END,
                      CASE WHEN t.employer_uid <> ${actorUid} THEN 'not_employer'
                           WHEN t.app_status = 'accepted' THEN 'already_accepted'
                           WHEN t.app_status <> 'applied' THEN 'app_state_invalid'
                           WHEN t.job_status <> 'open' THEN 'job_state_invalid'
                           WHEN g.worker_batt < thr.accept THEN 'batt_below_threshold'
                           ELSE 'job_state_invalid' END) AS outcome,
             (SELECT d.batt FROM deduct AS d LIMIT 1) AS worker_batt_after
        FROM target AS t, gate AS g, thr
    `);

    if (!row) return null;

    return {
      outcome: (toStringValue(getValue(row, 'outcome')) || 'app_state_invalid') as
        'accepted' | 'not_employer' | 'already_accepted' | 'app_state_invalid' | 'job_state_invalid' | 'batt_below_threshold',
      applicationId: toNumberValue(getValue(row, 'application_id')),
      jobId: toNumberValue(getValue(row, 'job_id')),
      workerUid: toNumberValue(getValue(row, 'worker_uid')),
      applicationStatus: toStringValue(getValue(row, 'application_status')),
      jobStatus: toStringValue(getValue(row, 'job_status')),
      workerBattAfter: getValue(row, 'worker_batt_after') === null || getValue(row, 'worker_batt_after') === undefined
        ? null
        : toNumberValue(getValue(row, 'worker_batt_after')),
    };
  }

  static async listPendingVerification(skip = 0, limit = 50): Promise<PendingVerificationRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT
        a.application_id AS "jID",
        a.job_id AS "tID",
        a.worker_uid AS "uID",
        s.deliverable AS info_input,
        a.time_created,
        s.time_created AS time_submitted,
        s.reviewed_at AS time_checked,
        NULL::timestamptz AS time_claimed,
        0::int AS points_claimed
      FROM job_application AS a
      JOIN "users" AS u
        ON u.uid = a.worker_uid
      LEFT JOIN LATERAL (
        SELECT *
        FROM job_submission AS s0
        WHERE s0.job_id = a.job_id AND s0.worker_uid = a.worker_uid
        ORDER BY s0.submission_id DESC
        LIMIT 1
      ) AS s ON TRUE
      WHERE COALESCE(NULLIF(BTRIM(COALESCE(s.deliverable, '')), ''), '') <> ''
        AND s.review_status = 'pending'
        AND COALESCE(u.is_admin, false) = false
      ORDER BY COALESCE(s.time_created, a.time_created) DESC NULLS LAST,
               a.application_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const items = await Promise.all(rows.map(async (row) => {
      const taskProgress = normalizeTaskProgress(row);
      const [task, user] = await Promise.all([
        this.getTask(taskProgress.tID),
        this.getUserById(taskProgress.uID),
      ]);

      return {
        ...taskProgress,
        task,
        user: user
          ? {
              uID: user.uID,
              EVM: user.EVM,
              is_admin: user.is_admin,
            }
          : null,
      };
    }));

    return items;
  }

  static async countPendingVerification(): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ count: number }>(await sql`
      SELECT COUNT(1)::int AS count
      FROM job_application AS a
      JOIN "users" AS u
        ON u.uid = a.worker_uid
      LEFT JOIN LATERAL (
        SELECT *
        FROM job_submission AS s0
        WHERE s0.job_id = a.job_id AND s0.worker_uid = a.worker_uid
        ORDER BY s0.submission_id DESC
        LIMIT 1
      ) AS s ON TRUE
      WHERE COALESCE(NULLIF(BTRIM(COALESCE(s.deliverable, '')), ''), '') <> ''
        AND s.review_status = 'pending'
        AND COALESCE(u.is_admin, false) = false
    `);
    return Number(rows[0]?.count || 0);
  }

  static async rejectPendingTaskProgress(jID: number): Promise<TaskProgressRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE task_progress AS j
      SET info_input = NULL,
          time_submitted = NULL
      WHERE COALESCE(NULLIF(BTRIM(j."jID"), '')::int, 0) = ${jID}
      RETURNING j.*
    `);

    return row ? normalizeTaskProgress(row) : null;
  }

  static async getUserStats(): Promise<{
    user_count: number;
    admin_count: number;
    asset_count: number;
    total_points: number;
    avg_points: number;
  }> {
    const users = await this.getAllUsers(0, 10000);
    let assetCount = 0;
    let totalPoints = 0;

    for (const user of users) {
      const asset = await this.getUserAsset(user.uID);
      if (asset) {
        assetCount += 1;
        totalPoints += asset.points;
      }
    }

    return {
      user_count: users.length,
      admin_count: users.filter((user) => user.is_admin).length,
      asset_count: assetCount,
      total_points: totalPoints,
      avg_points: assetCount > 0 ? totalPoints / assetCount : 0,
    };
  }

  static async getBrandById(bID: number): Promise<BrandRecord | null> {
    const sql = getSql();
    // P4-B1-c: prize→listing 读侧换表（单行，bID=listing_id）；旧 selected_prize/gift_counts/shard_counts/
    // transfer_counts CTE 的表在新 schema 无对应 ⇒ 聚合键保留、值恒 0。miss ⇒ null（路由层 404 语义保留）。
    const row = firstRow(await sql`
      SELECT
        l.*,
        0::int AS stores_count,
        0::int AS claims_count,
        0::int AS activated_count,
        0::int AS current_shard_supply,
        0::int AS free_shards_distributed
      FROM listing AS l
      WHERE l.listing_id = ${bID}
      LIMIT 1
    `);

    if (!row) {
      return null;
    }

    return normalizeBrand(row, {
      stores_count: toNumberValue(getValue(row, 'stores_count')),
      claims_count: toNumberValue(getValue(row, 'claims_count')),
      activated_count: toNumberValue(getValue(row, 'activated_count')),
      current_shard_supply: toNumberValue(getValue(row, 'current_shard_supply')),
      free_shards_distributed: toNumberValue(getValue(row, 'free_shards_distributed')),
    }, await loadI18nIndex('listing', [String(bID)]));
  }

  static async listPrizes(skip = 0, limit = 100): Promise<PrizeRecord[]> {
    return this.listBrands(skip, limit);
  }

  static async getPrizeById(bID: number): Promise<PrizeRecord | null> {
    return this.getBrandById(bID);
  }

  // P4-B2c（§1 #35 / DL72 / 0017 §B）：数据源换接 `admin_role*` 三表（旧 `permission_group` 已废弃 ⇒ 零引用）。
  // 三表当前 0 行 = **预期空态**（种子留批 6 走迁移；本片**禁插任何 admin 种子**）。
  static async listPersistedPermissionGroups(): Promise<PermissionGroupRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT
        r.role_key AS id,
        COALESCE(r.name, '') AS name,
        ''::text AS description,
        COALESCE((
          SELECT jsonb_agg(rp.permission_key ORDER BY rp.permission_key)
          FROM public.admin_role_permission AS rp
          WHERE rp.role_key = r.role_key
        ), '[]'::jsonb) AS permissions,
        COALESCE((
          SELECT jsonb_agg(ur.uid ORDER BY ur.uid)
          FROM public.admin_user_role AS ur
          WHERE ur.role_key = r.role_key
        ), '[]'::jsonb) AS user_ids,
        false AS readonly,
        r.time_created,
        r.time_created AS time_updated
      FROM public.admin_role AS r
      ORDER BY r.role_key
    `);
    return rows.map(normalizePermissionGroup);
  }

  // P4-B2c（§6.1 / DL72）：can_access_admin 的「角色行」一支 ⇒ 权限位 = admin_user_role ⋈ admin_role_permission。
  static async getPermissionsForUser(uID: number): Promise<string[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT DISTINCT rp.permission_key
      FROM public.admin_user_role AS ur
      JOIN public.admin_role_permission AS rp ON rp.role_key = ur.role_key
      WHERE ur.uid = ${uID}
      ORDER BY rp.permission_key
    `);
    return uniqueStrings(rows.map((row) => toStringValue(getValue(row, 'permission_key'))));
  }

  // P4-B2c（§6.1 第二支）：EXISTS(admin_user_role.uid = :uid) —— 与「有无权限位」解耦
  //（角色行存在但该角色 0 权限位时，can_access_admin 仍应为 true）。
  static async hasAdminRoleRow(uID: number): Promise<boolean> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT 1 AS present
      FROM public.admin_user_role AS ur
      WHERE ur.uid = ${uID}
      LIMIT 1
    `);
    return Boolean(row);
  }

  // P4-B2c（§6.3 / DL72）：角色是否存在（admin_role PK）。
  static async roleExists(roleKey: string): Promise<boolean> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT 1 AS present
      FROM public.admin_role AS r
      WHERE r.role_key = ${roleKey}
      LIMIT 1
    `);
    return Boolean(row);
  }

  // P4-B2c（§1.3-5 / DL72）：admin_role_permission.permission_key 有 FK ⇒ 落行前先判，
  // 使 miss 走 404 LEDGER_REF_NOT_FOUND 而**不是**裸 23503（§3.3-4）。
  static async findMissingPermissions(permissionKeys: string[]): Promise<string[]> {
    if (permissionKeys.length === 0) {
      return [];
    }
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT x AS permission_key
      FROM unnest(${permissionKeys}::text[]) AS x
      WHERE NOT EXISTS (
        SELECT 1 FROM public.admin_permission AS p WHERE p.permission_key = x
      )
      ORDER BY x
    `);
    return rows.map((row) => toStringValue(getValue(row, 'permission_key')));
  }

  // P4-B2c（§1 #38 / DL72）：用户 → 角色的读侧（**不**经 mapper 出对外键，键集冻结）。
  static async listUserRoles(uID: number): Promise<string[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT ur.role_key
      FROM public.admin_user_role AS ur
      WHERE ur.uid = ${uID}
      ORDER BY ur.role_key
    `);
    return uniqueStrings(rows.map((row) => toStringValue(getValue(row, 'role_key'))));
  }

  // P4-B2c（§1 #38）：整体替换该用户的角色分配（单事务；admin_user_role 的 PK 对 DELETE 允许，§6.3）。
  static async replaceUserRoles(uID: number, roleKeys: string[]): Promise<string[]> {
    const sql = getSql();
    await sql.transaction([
      sql`DELETE FROM public.admin_user_role WHERE uid = ${uID}`,
      sql`
        INSERT INTO public.admin_user_role (uid, role_key)
        SELECT ${uID}, x FROM unnest(${roleKeys}::text[]) AS x
      `,
    ]);
    return this.listUserRoles(uID);
  }

  static async resolveAdminAccess(user: UserRecord): Promise<AdminAccessRecord> {
    // P6-B6-PERM（批 6 · `isAdminAddress` 收敛）：**唯一**真源 = `users.is_admin` OR
    // EXISTS(admin_user_role.uid)（DL72）。第三真源 `isAdminAddress`（硬编码地址 / `ADMIN_EVM_ADDRESSES`）
    // 已**移除**，不再参与判定。运营管理员的角色行由 `0022_admin_permission_seed.sql` 种子承担
    // （§6.5 顺序依赖：**先种子、后收敛**）。
    const bypass = user.is_admin;
    const [hasRoleRow, extraPermissions] = bypass
      ? [false, [] as string[]]
      : await Promise.all([this.hasAdminRoleRow(user.uID), this.getPermissionsForUser(user.uID)]);

    return this.buildAdminAccess(user, extraPermissions, hasRoleRow);
  }

  // P4-B2c（§1 #35 / §5.1「撤销 deprecated」）：唯一数据源 = **admin_role* 三表**（DL72）。
  // 撤销 B1-c 的 3 个内置合成组（admin_access / task_publishers / prize_publishers）——
  // 它们是旧 permission_group 语义的替身；新口径下「角色」的唯一定义在 admin_role。
  static async listPermissionGroups(): Promise<PermissionGroupRecord[]> {
    return this.listPersistedPermissionGroups();
  }

  // P4-B2c（§1 #36 / §4.1 #39 / DL72）：换接 admin_role* 三表（单事务、原子重建）。
  // 旧 permission_group 表已废弃（B7：已 DROP）⇒ 本函数零引用旧表。
  static async savePermissionGroup(input: {
    id?: string;
    name?: string;
    description?: string | null;
    permissions?: string[];
    user_ids?: number[];
  }): Promise<PermissionGroupRecord> {
    const id = String(input.id || '').trim() || slugify(input.name || '') || `group-${Date.now()}`;

    const name = String(input.name || '').trim();
    if (!name) {
      throw new Error('Permission group name is required');
    }

    const permissions = uniqueStrings(
      (input.permissions || []).map((value) => String(value ?? '').trim()).filter(Boolean),
    );
    if (permissions.length === 0) {
      throw new Error('At least one valid permission is required');
    }

    const userIDs = uniqueNumbers(
      (input.user_ids || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.trunc(value)),
    );

    const sql = getSql();
    // 单事务（顺序执行，避免同语句 CTE 互不可见导致 FK/唯一键误判）：
    // upsert 角色 → 清子行 → 重建「角色→权限」/「用户→角色」。
    await sql.transaction([
      sql`
        INSERT INTO public.admin_role AS r (role_key, name, time_created)
        VALUES (${id}, ${name}, NOW())
        ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name
      `,
      sql`DELETE FROM public.admin_role_permission WHERE role_key = ${id}`,
      sql`DELETE FROM public.admin_user_role WHERE role_key = ${id}`,
      sql`
        INSERT INTO public.admin_role_permission (role_key, permission_key)
        SELECT ${id}, x FROM unnest(${permissions}::text[]) AS x
      `,
      sql`
        INSERT INTO public.admin_user_role (uid, role_key)
        SELECT x, ${id} FROM unnest(${userIDs}::bigint[]) AS x
      `,
    ]);

    const row = firstRow(await sql`
      SELECT
        r.role_key AS id,
        COALESCE(r.name, '') AS name,
        ''::text AS description,
        COALESCE((
          SELECT jsonb_agg(rp.permission_key ORDER BY rp.permission_key)
          FROM public.admin_role_permission AS rp
          WHERE rp.role_key = r.role_key
        ), '[]'::jsonb) AS permissions,
        COALESCE((
          SELECT jsonb_agg(ur.uid ORDER BY ur.uid)
          FROM public.admin_user_role AS ur
          WHERE ur.role_key = r.role_key
        ), '[]'::jsonb) AS user_ids,
        false AS readonly,
        r.time_created,
        r.time_created AS time_updated
      FROM public.admin_role AS r
      WHERE r.role_key = ${id}
      LIMIT 1
    `);

    if (!row) {
      throw new Error('Failed to save permission group');
    }

    return normalizePermissionGroup(row);
  }

  // P4-B2c（§1 #37 / §4.1 #40 / DL72）：删 admin_role（先清子行）；**该角色下无在用用户才可删**。
  static async deletePermissionGroup(id: string): Promise<"deleted" | "in_use" | "not_found"> {
    const sql = getSql();
    const existing = firstRow(await sql`
      SELECT r.role_key AS id FROM public.admin_role AS r WHERE r.role_key = ${id} LIMIT 1
    `);
    if (!existing) {
      return 'not_found';
    }
    const inUse = firstRow(await sql`
      SELECT ur.uid AS uid FROM public.admin_user_role AS ur WHERE ur.role_key = ${id} LIMIT 1
    `);
    if (inUse) {
      return 'in_use';
    }
    await sql.transaction([
      sql`DELETE FROM public.admin_role_permission WHERE role_key = ${id}`,
      sql`DELETE FROM public.admin_user_role WHERE role_key = ${id}`,
      sql`DELETE FROM public.admin_role WHERE role_key = ${id}`,
    ]);
    return 'deleted';
  }

  // P4-B2c（§1 #32 / DL71 / DL151）：显式 public. 限定；`app_config` 是**单列 key/value**（**无 privacy 列**）。
  static async getSystemSettings(): Promise<SystemSettingsRecord> {
    const sql = getSql();
    const rows = asItems<{ value: unknown }>(await sql`
      SELECT value
      FROM public.app_config
      WHERE key = 'system_settings'
      LIMIT 1
    `);

    return normalizeSystemSettingsRead(rows[0]?.value || DEFAULT_SYSTEM_SETTINGS);
  }

  /**
   * ★ 批 9 第 1 片（P9① · `route-layer.spec` v2.12 §27.2 · `data-layer.spec` v0.19 §30.2）：
   * 覆盖层**公开读口** `GET /api/role-names` 的取数（**只读** · 无副作用 · 无鉴权）。
   * 返回 = `{ role_names, site_text_overrides, updated_at }`；两键各自经读侧 fail-closed 解析
   * （非法 / 缺语 / 无行 ⇒ `null` ⇒ 前端回落 locale 基值，**绝不空串**）；
   * `updated_at` = 两行 `time_updated` 的最大值（ISO 串；无行 ⇒ `null`）。
   */
  static async getSiteTextOverlay(): Promise<{
    role_names: Record<string, Record<string, string>> | null;
    site_text_overrides: Record<string, Record<string, string>> | null;
    updated_at: string | null;
  }> {
    const sql = getSql();
    const rows = asItems<{ key: unknown; value: unknown; time_updated: unknown }>(await sql`
      SELECT key, value, time_updated
      FROM public.app_config
      WHERE key IN (${ROLE_NAMES_KEY}, ${SITE_TEXT_OVERRIDES_KEY})
    `);
    const isoOf = (value: unknown): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const date = value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value));
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };
    let updatedAt: string | null = null;
    for (const row of rows) {
      const iso = isoOf(row.time_updated);
      if (iso && (updatedAt === null || iso > updatedAt)) updatedAt = iso;
    }
    const byKey = new Map(rows.map((row) => [String(row.key), row]));
    const roleRow = byKey.get(ROLE_NAMES_KEY);
    const siteRow = byKey.get(SITE_TEXT_OVERRIDES_KEY);
    return {
      role_names: roleRow ? parseRoleNamesOverride(roleRow.value) : null,
      site_text_overrides: siteRow ? parseSiteTextOverridesOverlay(siteRow.value) : null,
      updated_at: updatedAt,
    };
  }

  // ==========================================================================
  // 批 9 第 2 片（P9② · `data-layer.spec` v0.21 §31.2–§31.5 · `route-layer.spec` v2.14 §28）：
  //   **batt / 签到 / 补签** 读口 + 写口（**单语句 CTE** = 一个隐式事务，沿 `createCurrencyWithFee` 先例）。
  // --------------------------------------------------------------------------
  // · 载体（变体 Ⅰ · `R-9-19`）：`batt_account` / `batt_entry` / `checkin_log` / `checkin_makeup_log`。
  // · 日界 = **UTC 自然日**（`R-9-15`）；签到溢出 = **封顶丢弃**（`R-9-17`）；补签**不补发** batt（`R-9-20`）。
  // · 补签腿 kind = `checkin_makeup_fee` → `uid = −1`（**不真 burn** · `R-9-14` / `R-9-3`）。
  // · 策略取数一律 **TS fail-closed 到常量**（`resolveBattPolicy` / `resolveCheckinPolicy`）。
  // ==========================================================================

  /** 读 `app_config` 某键的原始 `value`（只读；无行 ⇒ `null`）。传 `ex` ⇒ 同事务取数。 */
  static async getAppConfigValueByKey(key: string, ex?: SqlRunner): Promise<unknown> {
    const rows = await runSql(`SELECT value FROM public.app_config WHERE key = $1 LIMIT 1`, [key], ex);
    return (rows[0] as { value?: unknown } | undefined)?.value ?? null;
  }

  /** R1 · `GET /api/batt` 取数（`batt_account` + `batt_policy`；策略 fail-closed 到常量）。 */
  static async getBatt(uid: number, ex?: SqlRunner): Promise<{
    batt: number; capBatt: number; floorBatt: number; acceptThresholdBatt: number;
    canAccept: boolean; source: PolicySource; updated_at: string | null;
  }> {
    const sql = sqlFor(ex);
    const rows = asItems<{ batt: unknown; time_updated: unknown; policy: unknown }>(await sql`
      SELECT
        COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${uid}), 0) AS batt,
        (SELECT b.time_updated FROM public.batt_account AS b WHERE b.uid = ${uid} LIMIT 1) AS time_updated,
        (SELECT p.value FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1) AS policy
    `);
    const row = rows[0] || {};
    const { policy, source } = resolveBattPolicy((row as { policy?: unknown }).policy);
    const batt = Number((row as { batt?: unknown }).batt ?? 0) || 0;
    return {
      batt,
      capBatt: policy.capBatt,
      floorBatt: policy.floorBatt,
      acceptThresholdBatt: policy.acceptThresholdBatt,
      canAccept: batt >= policy.acceptThresholdBatt,
      source,
      updated_at: isoOrNull((row as { time_updated?: unknown }).time_updated),
    };
  }

  /** R2 · `GET /api/checkin` 取数（`checkin_log` + `checkin_makeup_log` + `checkin_policy`）。 */
  static async getCheckinStatus(uid: number, ex?: SqlRunner): Promise<{
    streakDay: number; streakCapDays: number; checkedInToday: boolean; canMakeup: boolean;
    makeupCostUsd: number; makeupDailyLimit: number; source: PolicySource; updated_at: string | null;
  }> {
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      SELECT
        (SELECT c.streak_day FROM public.checkin_log AS c WHERE c.uid = ${uid} ORDER BY c.checkin_day DESC LIMIT 1) AS last_streak,
        EXISTS (SELECT 1 FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = (now() AT TIME ZONE 'UTC')::date) AS checked_in_today,
        EXISTS (SELECT 1 FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = ((now() AT TIME ZONE 'UTC')::date - 1)) AS prev_checkin,
        EXISTS (SELECT 1 FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.result = 'applied' AND m.target_day = ((now() AT TIME ZONE 'UTC')::date - 1)) AS prev_makeup,
        (SELECT m.restored_streak_day FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.result = 'applied'
           AND m.target_day = ((now() AT TIME ZONE 'UTC')::date - 1) ORDER BY m.log_id DESC LIMIT 1) AS prev_makeup_streak,
        (SELECT count(*)::int FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.makeup_day = (now() AT TIME ZONE 'UTC')::date) AS makeup_today,
        (SELECT max(x.t) FROM (
           SELECT max(c.time_created) AS t FROM public.checkin_log AS c WHERE c.uid = ${uid}
           UNION ALL
           SELECT max(m.time_created) AS t FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid}
         ) AS x) AS updated_at,
        (SELECT p.value FROM public.app_config AS p WHERE p.key = 'checkin_policy' LIMIT 1) AS policy
    `);
    const row = (rows[0] || {}) as Record<string, unknown>;
    const { policy, source } = resolveCheckinPolicy(row.policy);
    const checkedInToday = row.checked_in_today === true;
    const prevCheckin = row.prev_checkin === true;
    const prevMakeup = row.prev_makeup === true;
    const lastStreak = Number(row.last_streak ?? 0) || 0;
    const prevMakeupStreak = Number(row.prev_makeup_streak ?? 0) || 0;
    // 连续天数即时重算：今日已签 ⇒ last_streak；否则「昨日已签」⇒ last_streak（链未断）；
    // 否则「昨日已成功补签」⇒ 该补签恢复的连续天数；否则 0（断签清零 · §31.4(b)-4）。
    const streakDay = checkedInToday ? lastStreak : (prevCheckin ? lastStreak : (prevMakeup ? prevMakeupStreak : 0));
    const makeupToday = Number(row.makeup_today ?? 0) || 0;
    return {
      streakDay,
      streakCapDays: policy.streakCapDays,
      checkedInToday,
      canMakeup: makeupToday < policy.makeupDailyLimit,
      makeupCostUsd: policy.makeupCostUsd,
      makeupDailyLimit: policy.makeupDailyLimit,
      source,
      updated_at: isoOrNull(row.updated_at),
    };
  }

  /**
   * A1 · `POST /api/checkin` 写口（**单语句 CTE**）：
   *   判连续天数 → INSERT `checkin_log`（`UNIQUE (uid, checkin_day)` 兜底）→ 加发 batt
   *   （**封顶丢弃** `R-9-17`）→ INSERT `batt_entry`（`delta=0` 不落行 · 移动守卫）。
   *   ★ 零账本腿（batt = 独立数据面 · `R-9-6`）；幂等 = 同日 `UNIQUE` + 复用读侧（重放返 `replayed`）。
   */
  static async checkin(uid: number, idempotencyKey: string, ex?: SqlRunner): Promise<{
    outcome: 'inserted' | 'replayed';
    checkinDay: string; streakDay: number; rewardBatt: number; creditedBatt: number; batt: number;
  } | null> {
    const rawPolicy = await this.getAppConfigValueByKey('checkin_policy', ex);
    const { policy } = resolveCheckinPolicy(rawPolicy);
    const rawBatt = await this.getAppConfigValueByKey('batt_policy', ex);
    const { policy: battPolicy } = resolveBattPolicy(rawBatt);
    const base = policy.baseRewardBatt;
    const day7 = policy.streakDay7RewardBatt;
    const cap = Math.max(1, policy.streakCapDays);
    // DB 不变式 `batt BETWEEN 0 AND 100` ⇒ 写入侧 fail-closed 再夹一次（策略域无上界）。
    const capBatt = Math.min(Math.max(1, battPolicy.capBatt), 100);

    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH today AS (SELECT (now() AT TIME ZONE 'UTC')::date AS d),
      prev AS (
        SELECT COALESCE(
          (SELECT c.streak_day FROM public.checkin_log AS c
            WHERE c.uid = ${uid} AND c.checkin_day = (SELECT d FROM today) - 1 LIMIT 1),
          (SELECT m.restored_streak_day FROM public.checkin_makeup_log AS m
            WHERE m.uid = ${uid} AND m.result = 'applied' AND m.target_day = (SELECT d FROM today) - 1
            ORDER BY m.log_id DESC LIMIT 1)
        )::int AS s
      ),
      calc AS (SELECT LEAST(COALESCE((SELECT s FROM prev), 0) + 1, ${cap})::smallint AS streak),
      dup AS (SELECT 1 FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = (SELECT d FROM today)),
      ins_log AS (
        INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
        SELECT ${uid}, (SELECT d FROM today), calc.streak,
               CASE WHEN calc.streak >= ${cap} THEN ${day7}::int ELSE ${base}::int END
        FROM calc
        WHERE NOT EXISTS (SELECT 1 FROM dup)
        ON CONFLICT (uid, checkin_day) DO NOTHING
        RETURNING log_id, streak_day, reward_batt
      ),
      cur AS (SELECT COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${uid}), 0) AS batt),
      reward AS (SELECT COALESCE((SELECT reward_batt FROM ins_log), 0)::int AS r),
      newbatt AS (SELECT LEAST((SELECT batt FROM cur) + (SELECT r FROM reward), ${capBatt})::int AS after),
      delta AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM ins_log) THEN (SELECT after FROM newbatt) - (SELECT batt FROM cur) ELSE 0 END AS d),
      upd_acct AS (
        INSERT INTO public.batt_account (uid, batt)
        SELECT ${uid}, (SELECT after FROM newbatt)
        WHERE EXISTS (SELECT 1 FROM ins_log)
        ON CONFLICT (uid) DO UPDATE SET batt = EXCLUDED.batt
        RETURNING batt
      ),
      ins_entry AS (
        INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
        SELECT ${uid}, (SELECT d FROM delta), (SELECT after FROM newbatt),
               CASE WHEN (SELECT streak_day FROM ins_log) >= ${cap} THEN 'checkin_day7' ELSE 'checkin' END,
               ${idempotencyKey}::text, 'checkin', (SELECT log_id FROM ins_log), ''
        FROM ins_log
        WHERE (SELECT d FROM delta) <> 0
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING txid
      )
      SELECT
        (SELECT count(*)::int FROM ins_log) AS inserted,
        COALESCE((SELECT streak_day FROM ins_log),
                 (SELECT c.streak_day FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = (SELECT d FROM today) LIMIT 1)) AS streak_day,
        COALESCE((SELECT reward_batt FROM ins_log),
                 (SELECT c.reward_batt FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = (SELECT d FROM today) LIMIT 1)) AS reward_batt,
        (SELECT d FROM delta) AS credited_batt,
        COALESCE((SELECT batt FROM upd_acct), (SELECT batt FROM cur))::int AS batt,
        (SELECT d FROM today)::text AS checkin_day
    `);
    const row = rows[0];
    if (!row) return null;
    const inserted = Number(row.inserted ?? 0) || 0;
    return {
      outcome: inserted > 0 ? 'inserted' : 'replayed',
      checkinDay: String(row.checkin_day ?? ''),
      streakDay: Number(row.streak_day ?? 0) || 0,
      rewardBatt: Number(row.reward_batt ?? 0) || 0,
      creditedBatt: Number(row.credited_batt ?? 0) || 0,
      batt: Number(row.batt ?? 0) || 0,
    };
  }

  /**
   * A2 · `POST /api/checkin/makeup` 写口（**单语句 CTE** · **含账本腿**）：
   *   判 result（`applied` / 三类 `rejected_*`）→ `applied` 时**同语句**调 `ledger_post_event`
   *   （`−cost $` → `uid = −1`，kind `checkin_makeup_fee`，**不真 burn**）→ INSERT `checkin_makeup_log`
   *   （`UNIQUE (uid, makeup_day)` 兜底 `≤1/日`；`UNIQUE (idempotency_key, result)` 幂等）。
   *   ★ **不补发该日 batt**（`R-9-20`：不写 `batt_entry`、不动 `batt_account`）。
   *   `result` 闭集 = `applied` / `rejected_daily_limit` / `rejected_insufficient_balance` / `rejected_target_invalid`。
   */
  static async checkinMakeup(input: {
    uid: number; targetDay: string; idempotencyKey: string; requestFingerprint: string; memo: string;
  }, ex?: SqlRunner): Promise<{
    outcome: 'applied' | 'replayed' | 'rejected_daily_limit' | 'rejected_insufficient_balance' | 'rejected_target_invalid';
    targetDay: string; costUsd: number; restoredStreakDay: number | null; txid: string | null; ledger: unknown;
  } | null> {
    const rawPolicy = await this.getAppConfigValueByKey('checkin_policy', ex);
    const { policy } = resolveCheckinPolicy(rawPolicy);
    const cost = Math.max(1, policy.makeupCostUsd);
    const cap = Math.max(1, policy.streakCapDays);
    const { uid, targetDay, idempotencyKey, requestFingerprint, memo } = input;

    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH today AS (SELECT (now() AT TIME ZONE 'UTC')::date AS d),
      target AS (SELECT ${targetDay}::date AS d),
      dup AS (SELECT 1 FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.makeup_day = (SELECT d FROM today)),
      res AS (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM dup) THEN 'rejected_daily_limit'
          WHEN (SELECT d FROM target) >= (SELECT d FROM today) THEN 'rejected_target_invalid'
          WHEN EXISTS (SELECT 1 FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = (SELECT d FROM target)) THEN 'rejected_target_invalid'
          WHEN EXISTS (SELECT 1 FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.result = 'applied' AND m.target_day = (SELECT d FROM target)) THEN 'rejected_target_invalid'
          WHEN COALESCE((SELECT a.balance FROM public.account AS a WHERE a.uid = ${uid} AND a.cid = 1), 0) < ${cost}::bigint THEN 'rejected_insufficient_balance'
          ELSE 'applied'
        END AS result
      ),
      restored AS (
        SELECT LEAST(COALESCE(
          (SELECT c.streak_day FROM public.checkin_log AS c WHERE c.uid = ${uid} AND c.checkin_day = (SELECT d FROM target) - 1 LIMIT 1),
          (SELECT m.restored_streak_day FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.result = 'applied'
             AND m.target_day = (SELECT d FROM target) - 1 ORDER BY m.log_id DESC LIMIT 1),
          0) + 1, ${cap})::smallint AS s
      ),
      ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'entries',
          'idempotency_key', ${idempotencyKey}::text,
          'request_fingerprint', ${requestFingerprint}::text,
          'memo', ${memo}::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', ${String(uid)}::text, 'cid', '1', 'delta', ${String(-cost)}::text,
              'kind', 'checkin_makeup_fee'),
            jsonb_build_object('uid', '-1', 'cid', '1', 'delta', ${String(cost)}::text,
              'kind', 'checkin_makeup_fee')
          )
        )) AS r
        FROM res WHERE res.result = 'applied'
      ),
      ins_log AS (
        INSERT INTO public.checkin_makeup_log
          (uid, makeup_day, target_day, cost_usd, restored_streak_day, cid, result, txid, idempotency_key, request_fingerprint, memo)
        SELECT ${uid}, (SELECT d FROM today), (SELECT d FROM target), ${cost}::bigint,
               (SELECT s FROM restored), 1, (SELECT result FROM res),
               CASE WHEN (SELECT result FROM res) = 'applied'
                    THEN (SELECT (ev.r->>'txid')::bigint FROM ev) ELSE NULL END,
               ${idempotencyKey}::text, ${requestFingerprint}::text, ${memo}::text
        ON CONFLICT (uid, makeup_day) DO NOTHING
        RETURNING log_id, result, txid, restored_streak_day
      )
      SELECT
        (SELECT count(*)::int FROM ins_log) AS inserted,
        (SELECT result FROM ins_log) AS inserted_result,
        (SELECT txid FROM ins_log) AS txid,
        (SELECT restored_streak_day FROM ins_log) AS restored_streak_day,
        (SELECT result FROM res) AS intended_result,
        (SELECT m.result FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.idempotency_key = ${idempotencyKey}::text LIMIT 1) AS existing_result,
        (SELECT m.txid FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.idempotency_key = ${idempotencyKey}::text LIMIT 1) AS existing_txid,
        (SELECT m.restored_streak_day FROM public.checkin_makeup_log AS m WHERE m.uid = ${uid} AND m.idempotency_key = ${idempotencyKey}::text LIMIT 1) AS existing_restored,
        (SELECT ev.r FROM ev) AS ledger_result,
        (SELECT d FROM target)::text AS target_day
    `);
    const row = rows[0];
    if (!row) return null;
    const intended = String(row.intended_result ?? '');
    const inserted = Number(row.inserted ?? 0) || 0;
    const existing = row.existing_result === null || row.existing_result === undefined ? null : String(row.existing_result);
    const restoredFrom = (v: unknown): number | null => (v === null || v === undefined ? null : (Number(v) || 0));
    let outcome: 'applied' | 'replayed' | 'rejected_daily_limit' | 'rejected_insufficient_balance' | 'rejected_target_invalid';
    let restored: number | null;
    let txid: string | null;
    if (inserted > 0) {
      outcome = (intended || 'rejected_target_invalid') as typeof outcome;
      restored = restoredFrom(row.restored_streak_day ?? (row as { s?: unknown }).s);
      txid = row.txid === null || row.txid === undefined ? null : String(row.txid);
    } else if (existing !== null) {
      // 同键同日重放（幂等）
      outcome = 'replayed';
      restored = restoredFrom(row.existing_restored);
      txid = row.existing_txid === null || row.existing_txid === undefined ? null : String(row.existing_txid);
    } else {
      // 同 uid 当日已有**异键**行 ⇒ 每日上限（含首次被拒的留痕行占位 · `UNIQUE (uid, makeup_day)`）
      outcome = 'rejected_daily_limit';
      restored = null;
      txid = null;
    }
    return {
      outcome,
      targetDay: String(row.target_day ?? targetDay),
      costUsd: cost,
      restoredStreakDay: restored,
      txid,
      ledger: row.ledger_result ?? null,
    };
  }


  // P4-B2c（§1 #33 / DL36 / DL71）：补 `updated_by`（**NOT NULL 无默认** ⇒ 旧实现必违约）+ 显式 public.。
  // 批 8①（`data-layer.spec` §21.2 `AG1`/`AG3`/`AG4`）：**写侧先过「逐键白名单 + 类型闸」** ——
  //   未知键 / 类型不符 / 非 object ⇒ `assertSystemSettingsPatch` **抛** `SystemSettingsWriteError`
  //   ⇒ **删除**了原实现「把 `input` 直接喂给 `normalizeSystemSettings` ⇒ 未知键被静默吸收」的形态（那是 `AG4` 要治的缺口）。
  // ★ 批 8③b（`data-layer.spec` v0.13 §24 · `route-layer.spec` v2.6 §21 · `R-8-19`）：
  //   本方法**仍是 `app_config` 的唯一写入落点**（`AG2`：类级扫描 INSERT/UPDATE public.app_config 只允许出现在此处），
  //   但 `key` 由第 3 参 `targetKey`（**解出的目标键**）给 —— 现取写死的 `'system_settings'` 字面**已参数化**（§24.7 `AS1`）。
  //   · `targetKey = 'system_settings'`（形态 A / `AW3`）：`input` = 9 字段部分补丁 ⇒ 与现态合流 ⇒ 返回 `SystemSettingsRecord`（`AW9` 逐字不变）。
  //   · `targetKey = 'listing_deposit_policy'`（形态 B）：`input` = 该键**值对象**（已过 `AV2`–`AV4`）⇒ 直写（即全量）；
  //     此处再过 `assertListingDepositPolicyValue`（双保险 ⇒ 任何绕过前置层的调用也 fail-closed 抛错）。
  //   · 其它键 ⇒ `SystemSettingsWriteError`（fail-closed；`AV1` 已在前置层拦截，此为兜底）。
  static async saveSystemSettings(
    input: Partial<SystemSettingsRecord> | Record<string, unknown>,
    updatedBy = 0,
    targetKey: string = SYSTEM_SETTINGS_KEY,
  ): Promise<SystemSettingsRecord | Record<string, unknown>> {
    let nextValue: Record<string, unknown>;
    if (targetKey === SYSTEM_SETTINGS_KEY) {
      const patch = assertSystemSettingsPatch(input);
      const current = await this.getSystemSettings();
      nextValue = normalizeSystemSettingsRead({
        ...current,
        ...patch,
      }) as unknown as Record<string, unknown>;
    } else if (targetKey === LISTING_DEPOSIT_POLICY_KEY) {
      nextValue = assertListingDepositPolicyValue(input);
    } else if (Object.prototype.hasOwnProperty.call(NUMERIC_POLICY_SPECS, targetKey)
      || targetKey === SITE_TEXT_OVERRIDES_KEY || targetKey === ROLE_NAMES_KEY) {
      // ★ 批 9 第 1 片（P9① · §29/§30）：B1–B5 数值策略键 + B6/B7 覆盖层键 —— 双保险断言
      //   （任何绕过前置层的调用也 fail-closed 抛错）；值 = 全量（形态 B 直写）。
      const verdict = validateAppConfigValue(targetKey, input);
      if (!verdict.ok) throw new SystemSettingsWriteError(verdict.message, verdict.details);
      nextValue = verdict.value;
    } else {
      throw new SystemSettingsWriteError('Unknown app_config key', {
        field: targetKey,
        reason: SETTINGS_WRITE_REASONS.unknownKey,
        unknown_keys: [targetKey],
        legal_keys: [...APP_CONFIG_LEGAL_KEYS],
      });
    }
    const sql = getSql();

    const rows = asItems<{ value: unknown }>(await sql`
      INSERT INTO public.app_config (key, value, updated_by, time_updated)
      VALUES (${targetKey}::text, ${JSON.stringify(nextValue)}::jsonb, ${Number(updatedBy) || 0}::bigint, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        time_updated = NOW()
      RETURNING value
    `);

    if (targetKey === SYSTEM_SETTINGS_KEY) {
      return normalizeSystemSettingsRead(rows[0]?.value || nextValue);
    }
    const written = rows[0]?.value;
    return (written !== null && typeof written === 'object' ? written : nextValue) as Record<string, unknown>;
  }

  // P4-B2c：**不再有路由**（§1 #34 ⇒ 410；C3 ② 删除）。保留方法体仅作回退点（DL42 可切换点）。
  static async resetSystemSettings(): Promise<SystemSettingsRecord> {
    // ★ 批 8③b：`saveSystemSettings` 现返回联合（形态 A / 形态 B）；本调用恒为形态 A（默认 `targetKey`）
    //   ⇒ 返回类型必为 `SystemSettingsRecord`（断言收窄，行为不变）。
    return this.saveSystemSettings({ ...DEFAULT_SYSTEM_SETTINGS }) as Promise<SystemSettingsRecord>;
  }

  static async updateUserAdminStatus(uID: number, isAdmin: boolean): Promise<UserRecord | null> {
    return this.updateUserProfile(uID, { is_admin: isAdmin });
  }

  static async createPrizeInventoryRows(bID: number, count: number): Promise<void> {
    if (count <= 0) {
      return;
    }

    const sql = getSql();
    await sql`
      INSERT INTO prize_item AS g ("bID", "uID", time_created)
      SELECT ${bID}, 0, NOW()
      FROM generate_series(1, ${count})
    `;
  }

  static async trimAvailablePrizeInventory(bID: number, count: number): Promise<void> {
    if (count <= 0) {
      return;
    }

    const sql = getSql();
    await sql`
      DELETE FROM prize_item
      WHERE "gID" IN (
        SELECT COALESCE((to_jsonb(g)->>'gID')::int, 0)
        FROM prize_item AS g
        WHERE COALESCE((to_jsonb(g)->>'bID')::int, 0) = ${bID}
          AND COALESCE((to_jsonb(g)->>'uID')::int, 0) = 0
        ORDER BY COALESCE((to_jsonb(g)->>'gID')::int, 0) DESC
        LIMIT ${count}
      )
    `;
  }

  static async syncPrizeInventory(bID: number, totalQuantity: number): Promise<void> {
    const [storesCount, claimsCount] = await Promise.all([
      this.countGiftStoresByBrand(bID),
      this.countGiftClaimsByBrand(bID),
    ]);

    if (totalQuantity < claimsCount) {
      throw new Error('Total quantity cannot be less than issued quantity');
    }

    const targetStores = Math.max(totalQuantity - claimsCount, 0);
    const delta = targetStores - storesCount;

    if (delta > 0) {
      await this.createPrizeInventoryRows(bID, delta);
    } else if (delta < 0) {
      await this.trimAvailablePrizeInventory(bID, Math.abs(delta));
    }
  }

  static async createBrand(input: {
    symbol?: string | null;
    name?: string | null;
    description?: string | null;
    url_image?: string | null;
    points?: number | null;
    market_floor_points?: number | null;
    gift_limit?: number | null;
    total_quantity?: number | null;
    free_shard_ratio?: number | null;
    time_start?: number | string | null;
    time_end?: number | string | null;
  }): Promise<BrandRecord> {
    const symbol = String(input.symbol || '').trim();
    const name = String(input.name || '').trim();
    if (!symbol || !name) {
      throw new Error('Prize symbol and name are required');
    }

    const description = String(input.description || '').trim();
    const imageUrl = String(input.url_image || '').trim();
    const points = Math.max(0, Math.trunc(Number(input.points) || 0));
    const marketFloorPoints = Math.max(0, Math.trunc(Number(input.market_floor_points) || 0));
    const totalQuantity = Math.max(
      1,
      Math.trunc(Number(input.total_quantity ?? input.gift_limit) || 0),
    );
    const giftLimit = totalQuantity;
    const freeShardRatio = Math.min(100, Math.max(0, Number(input.free_shard_ratio) || 0));
    const timeStart = toTimestamp(input.time_start) || Math.floor(Date.now() / 1000);
    const timeEnd = toTimestamp(input.time_end);
    if (!timeEnd || timeEnd <= timeStart) {
      throw new Error('Prize time_end must be later than time_start');
    }
    if (marketFloorPoints > 0 && !isPrizePriceFloorEligible(timeStart, timeEnd)) {
      throw new Error('Price floor is only available for prizes lasting more than 30 days');
    }

    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO prize AS b (
        symbol,
        name,
        description,
        url_image,
        image_url,
        points,
        market_floor_points,
        gift_limit,
        total_quantity,
        free_shard_ratio,
        time_start,
        time_end,
        time_created,
        time_updated
      )
      VALUES (
        ${symbol},
        ${name},
        ${description || null},
        ${imageUrl || null},
        ${imageUrl || null},
        ${points},
        ${marketFloorPoints},
        ${giftLimit},
        ${totalQuantity},
        ${freeShardRatio},
        TO_TIMESTAMP(${timeStart}),
        TO_TIMESTAMP(${timeEnd}),
        NOW(),
        NOW()
      )
      RETURNING to_jsonb(b) AS row
    `);

    if (!row) {
      throw new Error('Failed to create prize');
    }

    const bID = toNumberValue(getValue(row, 'bID'));
    await this.syncPrizeInventory(bID, totalQuantity);
    const createdPrize = await this.getBrandById(bID);
    if (!createdPrize) {
      throw new Error('Failed to load created prize');
    }

    return createdPrize;
  }

  static async updateBrand(
    bID: number,
    input: {
      symbol?: string | null;
      name?: string | null;
      description?: string | null;
      url_image?: string | null;
      points?: number | null;
      market_floor_points?: number | null;
      gift_limit?: number | null;
      total_quantity?: number | null;
      free_shard_ratio?: number | null;
      time_start?: number | string | null;
      time_end?: number | string | null;
    },
  ): Promise<BrandRecord | null> {
    const existingPrize = await this.getBrandById(bID);
    if (!existingPrize) {
      return null;
    }

    const nextTotalQuantity = Math.max(
      1,
      Math.trunc(Number(input.total_quantity ?? input.gift_limit ?? existingPrize.total_quantity) || existingPrize.total_quantity),
    );
    const nextMarketFloorPoints = Math.max(
      0,
      Math.trunc(Number(input.market_floor_points ?? existingPrize.market_floor_points) || 0),
    );
    const nextFreeShardRatio = Math.min(
      100,
      Math.max(0, Number(input.free_shard_ratio ?? existingPrize.free_shard_ratio) || 0),
    );
    const nextTimeStart = toTimestamp(input.time_start) || existingPrize.time_start || Math.floor(Date.now() / 1000);
    const nextTimeEnd = toTimestamp(input.time_end) || existingPrize.time_end;
    if (!nextTimeEnd || nextTimeEnd <= nextTimeStart) {
      throw new Error('Prize time_end must be later than time_start');
    }
    if (nextMarketFloorPoints > 0 && !isPrizePriceFloorEligible(nextTimeStart, nextTimeEnd)) {
      throw new Error('Price floor is only available for prizes lasting more than 30 days');
    }

    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE prize AS b
      SET symbol = COALESCE(${String(input.symbol || '').trim() || null}, symbol),
          name = COALESCE(${String(input.name || '').trim() || null}, name),
          description = COALESCE(${String(input.description || '').trim() || null}, description),
          url_image = COALESCE(${String(input.url_image || '').trim() || null}, url_image),
          image_url = COALESCE(${String(input.url_image || '').trim() || null}, image_url),
          points = COALESCE(${toOptionalNumber(input.points)}, points),
          market_floor_points = ${nextMarketFloorPoints},
          gift_limit = ${nextTotalQuantity},
          total_quantity = ${nextTotalQuantity},
          free_shard_ratio = ${nextFreeShardRatio},
          time_start = TO_TIMESTAMP(${nextTimeStart}),
          time_end = TO_TIMESTAMP(${nextTimeEnd}),
          time_updated = NOW()
      WHERE COALESCE((to_jsonb(b)->>'bID')::int, 0) = ${bID}
      RETURNING to_jsonb(b) AS row
    `);

    if (!row) {
      return null;
    }

    await this.syncPrizeInventory(bID, nextTotalQuantity);
    return this.getBrandById(bID);
  }

  static async deleteBrand(bID: number): Promise<boolean> {
    const sql = getSql();
    const [giftRows, orderRows, tradeRows, shardRows] = await Promise.all([
      asItems<{ count: number }>(await sql`
        SELECT COUNT(1)::int AS count
        FROM prize_item AS g
        WHERE COALESCE((to_jsonb(g)->>'bID')::int, 0) = ${bID}
      `),
      asItems<{ count: number }>(await sql`
        SELECT COUNT(1)::int AS count
        FROM market_order AS o
        WHERE COALESCE((to_jsonb(o)->>'bID')::int, 0) = ${bID}
      `),
      asItems<{ count: number }>(await sql`
        SELECT COUNT(1)::int AS count
        FROM market_trade AS t
        WHERE COALESCE((to_jsonb(t)->>'bID')::int, 0) = ${bID}
      `),
      asItems<{ count: number }>(await sql`
        SELECT COUNT(1)::int AS count
        FROM (
          SELECT 1
          FROM shard AS s
          WHERE COALESCE((to_jsonb(s)->>'bID')::int, 0) = ${bID}
          GROUP BY COALESCE((to_jsonb(s)->>'uID')::int, 0)
          HAVING SUM(COALESCE((to_jsonb(s)->>'volume')::int, 0)) <> 0
        ) AS active_holdings
      `),
    ]);

    if (Number(giftRows[0]?.count || 0) > 0) {
      throw new Error('Brand has gift inventory or claim history');
    }

    if (Number(orderRows[0]?.count || 0) > 0 || Number(tradeRows[0]?.count || 0) > 0) {
      throw new Error('Brand has market activity and cannot be deleted');
    }

    if (Number(shardRows[0]?.count || 0) > 0) {
      throw new Error('Brand still has user shard holdings');
    }

    await sql`
      DELETE FROM prize
      WHERE "bID" = ${bID}
    `;
    return true;
  }

  static async createTask(input: {
    title?: string | null;
    note?: string | null;
    refcode?: string | null;
    points?: number | null;
    is_open?: boolean | null;
    link0?: string | null;
    linkB?: string | null;
  }): Promise<TaskRecord> {
    const title = String(input.title || '').trim();
    if (!title) {
      throw new Error('Task title is required');
    }

    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO task AS t (
        title,
        note,
        refcode,
        points,
        is_open,
        link0,
        "linkA",
        "linkB",
        time_created,
        time_updated
      )
      VALUES (
        ${title},
        ${String(input.note || '').trim() || null},
        ${String(input.refcode || '').trim() || null},
        ${Math.max(0, Math.trunc(Number(input.points) || 0))},
        ${input.is_open !== false},
        ${String(input.link0 || '').trim() || null},
        ${String(input.link0 || '').trim() || null},
        ${String(input.linkB || '').trim() || null},
        NOW(),
        NOW()
      )
      RETURNING to_jsonb(t) AS row
    `);

    if (!row) {
      throw new Error('Failed to create task');
    }

    return normalizeTask(row, 0);
  }

  static async updateTask(
    tID: number,
    input: {
      title?: string | null;
      note?: string | null;
      refcode?: string | null;
      points?: number | null;
      is_open?: boolean | null;
      link0?: string | null;
      linkB?: string | null;
    },
  ): Promise<TaskRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE task AS t
      SET title = COALESCE(${String(input.title || '').trim() || null}, title),
          note = COALESCE(${String(input.note || '').trim() || null}, note),
          refcode = COALESCE(${String(input.refcode || '').trim() || null}, refcode),
          points = COALESCE(${toOptionalNumber(input.points)}, points),
          is_open = COALESCE(${input.is_open ?? null}, is_open),
          link0 = COALESCE(${String(input.link0 || '').trim() || null}, link0),
          "linkA" = COALESCE(${String(input.link0 || '').trim() || null}, "linkA"),
          "linkB" = COALESCE(${String(input.linkB || '').trim() || null}, "linkB"),
          time_updated = NOW()
      WHERE COALESCE((to_jsonb(t)->>'tID')::int, 0) = ${tID}
      RETURNING to_jsonb(t) AS row
    `);

    if (!row) {
      return null;
    }

    const participantsCount = await this.countTaskParticipants(tID);
    return normalizeTask(row, participantsCount);
  }

  static async deleteTask(tID: number): Promise<boolean> {
    const participantsCount = await this.countTaskParticipants(tID);
    if (participantsCount > 0) {
      throw new Error('Task already has participation records');
    }

    const sql = getSql();
    await sql`
      DELETE FROM task
      WHERE "tID" = ${tID}
    `;
    return true;
  }

  // P4-B1-c: shard 新 schema 无对应表（P4-0 §4.1 裁定「勿硬凑建表」）⇒ 碎片族读侧恒空态（不编值）；
  // 碎片/开箱语义已被积分交易所取代（listing/listing_order）。/api/shard 响应体带 deprecated: true（index.ts）。
  static async listShardHoldingsByUser(uID: number, skip = 0, limit = 100): Promise<ShardHoldingRecord[]> {
    void uID;
    void skip;
    void limit;
    return [];
  }

  static async getUserShardBalance(uID: number, bID: number): Promise<number> {
    // P4-B1-c: shard 无对应表 ⇒ 恒 0（不编值）；语义已被积分交易所取代。
    void uID;
    void bID;
    return 0;
  }

  static async createShardLedgerEntry(uID: number, bID: number, delta: number): Promise<void> {
    if (!delta) {
      return;
    }

    const sql = getSql();
    await sql`
      INSERT INTO shard AS s ("bID", "uID", time_created, time_updated, volume)
      VALUES (${bID}, ${uID}, NOW(), NOW(), ${delta})
    `;
  }

  static async recordShardTransfer(input: {
    bID: number;
    from_uID?: number | null;
    to_uID?: number | null;
    volume: number;
    reason: string;
    related_oID?: number | null;
    related_trID?: number | null;
  }): Promise<ShardTransferRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO shard_transfer AS st (
        "bID",
        "from_uID",
        "to_uID",
        volume,
        reason,
        "related_oID",
        "related_trID",
        time_created
      )
      VALUES (
        ${input.bID},
        ${input.from_uID ?? null},
        ${input.to_uID ?? null},
        ${input.volume},
        ${input.reason},
        ${input.related_oID ?? null},
        ${input.related_trID ?? null},
        NOW()
      )
      RETURNING st.*
    `);

    if (!row) {
      return null;
    }

    const brand = await this.getBrandById(input.bID);
    return normalizeShardTransfer(row, brand);
  }

  // P4-B1-c: shard_transfer 无对应表 ⇒ 恒空（不编值）；语义已被积分交易所取代。
  // /api/shard/transfer 响应体带 deprecated: true（index.ts）。
  static async listShardTransfersByUser(uID: number, skip = 0, limit = 100): Promise<ShardTransferRecord[]> {
    void uID;
    void skip;
    void limit;
    return [];
  }

  static async getMarketOrderById(oID: number): Promise<MarketOrderRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT o.*
      FROM market_order AS o
      WHERE o."oID" = ${oID}
      LIMIT 1
    `);

    if (!row) {
      return null;
    }

    const brand = await this.getBrandById(toNumberValue(getValue(row, 'bID')));
    return normalizeMarketOrder(row, brand);
  }

  static async updateMarketOrderFill(oID: number, fillDelta: number): Promise<MarketOrderRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE market_order AS o
      SET volume_filled = LEAST(volume_total, volume_filled + ${fillDelta}),
          status = CASE
            WHEN volume_filled + ${fillDelta} >= volume_total THEN 'filled'
            ELSE 'partial'
          END,
          time_updated = NOW()
      WHERE o."oID" = ${oID}
      RETURNING o.*
    `);

    if (!row) {
      return null;
    }

    const brand = await this.getBrandById(toNumberValue(getValue(row, 'bID')));
    return normalizeMarketOrder(row, brand);
  }

  static async findMatchingOrder(order: MarketOrderRecord): Promise<MarketOrderRecord | null> {
    const brand = await this.getBrandById(order.bID);
    if (!brand) {
      return null;
    }
    const minimumShardPrice = brand.price_floor_active ? brand.minimum_shard_price : 0;
    if (order.side === 'buy' && minimumShardPrice > 0 && order.price < minimumShardPrice) {
      return null;
    }

    const sql = getSql();
    const row = order.side === 'buy'
      ? firstRow(await sql`
          SELECT o.*
          FROM market_order AS o
          WHERE o."bID" = ${order.bID}
            AND side = 'sell'
            AND o."uID" <> ${order.uID}
            AND status IN ('open', 'partial')
            AND o.price <= ${order.price}
            AND o.volume_total > o.volume_filled
          ORDER BY o.price ASC,
                   COALESCE(o.time_created, NOW()) ASC,
                   o."oID" ASC
          LIMIT 1
        `)
      : firstRow(await sql`
          SELECT o.*
          FROM market_order AS o
          WHERE o."bID" = ${order.bID}
            AND side = 'buy'
            AND o."uID" <> ${order.uID}
            AND status IN ('open', 'partial')
            AND o.price >= ${Math.max(order.price, minimumShardPrice)}
            AND o.volume_total > o.volume_filled
          ORDER BY o.price DESC,
                   COALESCE(o.time_created, NOW()) ASC,
                   o."oID" ASC
          LIMIT 1
        `);

    if (!row) {
      return null;
    }

    return normalizeMarketOrder(row, brand);
  }

  static async createMarketTrade(input: {
    bID: number;
    buy_oID: number;
    sell_oID: number;
    buyer_uID: number;
    seller_uID: number;
    price: number;
    volume: number;
  }): Promise<MarketTradeRecord> {
    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO market_trade AS t (
        "bID",
        "buy_oID",
        "sell_oID",
        "buyer_uID",
        "seller_uID",
        price,
        volume,
        time_created
      )
      VALUES (
        ${input.bID},
        ${input.buy_oID},
        ${input.sell_oID},
        ${input.buyer_uID},
        ${input.seller_uID},
        ${input.price},
        ${input.volume},
        NOW()
      )
      RETURNING t.*
    `);

    if (!row) {
      throw new Error('Failed to create trade');
    }

    const brand = await this.getBrandById(input.bID);
    return normalizeMarketTrade(row, brand);
  }

  static async matchMarketOrder(initialOrder: MarketOrderRecord): Promise<MarketTradeRecord[]> {
    const trades: MarketTradeRecord[] = [];
    let currentOrder = initialOrder;

    while (currentOrder.status === 'open' || currentOrder.status === 'partial') {
      const counterOrder = await this.findMatchingOrder(currentOrder);
      if (!counterOrder) {
        break;
      }

      const currentRemaining = Math.max(0, currentOrder.volume_total - currentOrder.volume_filled);
      const counterRemaining = Math.max(0, counterOrder.volume_total - counterOrder.volume_filled);
      const matchedVolume = Math.min(currentRemaining, counterRemaining);

      if (!matchedVolume) {
        break;
      }

      const buyerOrder = currentOrder.side === 'buy' ? currentOrder : counterOrder;
      const sellerOrder = currentOrder.side === 'sell' ? currentOrder : counterOrder;
      const executionPrice = buyerOrder.price;

      await this.createShardLedgerEntry(buyerOrder.uID, currentOrder.bID, matchedVolume);
      await this.upsertAsset(sellerOrder.uID, executionPrice * matchedVolume);

      const trade = await this.createMarketTrade({
        bID: currentOrder.bID,
        buy_oID: buyerOrder.oID,
        sell_oID: sellerOrder.oID,
        buyer_uID: buyerOrder.uID,
        seller_uID: sellerOrder.uID,
        price: executionPrice,
        volume: matchedVolume,
      });

      await this.recordShardTransfer({
        bID: currentOrder.bID,
        from_uID: sellerOrder.uID,
        to_uID: buyerOrder.uID,
        volume: matchedVolume,
        reason: 'market_trade',
        related_oID: currentOrder.oID,
        related_trID: trade.trID,
      });

      const [updatedBuyer, updatedSeller] = await Promise.all([
        this.updateMarketOrderFill(buyerOrder.oID, matchedVolume),
        this.updateMarketOrderFill(sellerOrder.oID, matchedVolume),
      ]);

      trades.push(trade);

      currentOrder = currentOrder.oID === updatedBuyer?.oID
        ? (updatedBuyer || currentOrder)
        : currentOrder.oID === updatedSeller?.oID
          ? (updatedSeller || currentOrder)
          : ((await this.getMarketOrderById(currentOrder.oID)) || currentOrder);
    }

    return trades;
  }

  static async listOrdersByUser(uID: number, skip = 0, limit = 100): Promise<MarketOrderRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT o.*
      FROM market_order AS o
      WHERE o.owner_uid = ${uID}
      ORDER BY COALESCE(o.time_created, NOW()) DESC,
               o.order_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const brandCache = new Map<number, BrandRecord | null>();
    return Promise.all(rows.map(async (row) => {
      const bID = toNumberValue(getValue(row, 'bID', 'base_cid'));
      if (!brandCache.has(bID)) {
        brandCache.set(bID, await this.getBrandById(bID));
      }
      return normalizeMarketOrder(row, brandCache.get(bID) || null);
    }));
  }

  static async placeOrder(input: {
    uID: number;
    bID: number;
    side: string;
    price: number;
    volume: number;
  }): Promise<{ order: MarketOrderRecord; trades: MarketTradeRecord[] }> {
    const bID = Math.trunc(Number(input.bID) || 0);
    const price = Math.trunc(Number(input.price) || 0);
    const volume = Math.trunc(Number(input.volume) || 0);
    const side: 'buy' | 'sell' = input.side === 'sell' ? 'sell' : 'buy';

    if (!bID || !price || !volume) {
      throw new Error('Invalid order payload');
    }

    const brand = await this.getBrandById(bID);
    if (!brand) {
      throw new Error('Prize not found');
    }

    if (!brand.market_is_open) {
      throw new Error('Prize is not in circulation');
    }

    if (brand.price_floor_active && price < brand.minimum_shard_price) {
      throw new Error(`Price floor for this prize is ${brand.minimum_shard_price} J per shard`);
    }

    if (side === 'buy') {
      const asset = (await this.getUserAsset(input.uID)) || (await this.upsertAsset(input.uID, 0));
      const requiredPoints = price * volume;
      if (asset.points < requiredPoints) {
        throw new Error('Insufficient points for buy order');
      }
      await this.upsertAsset(input.uID, -requiredPoints);
    } else {
      const balance = await this.getUserShardBalance(input.uID, bID);
      if (balance < volume) {
        throw new Error('Insufficient shard balance for sell order');
      }
      await this.createShardLedgerEntry(input.uID, bID, -volume);
      await this.recordShardTransfer({
        bID,
        from_uID: input.uID,
        to_uID: null,
        volume,
        reason: 'market_sell_lock',
      });
    }

    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO market_order AS o (
        "bID",
        "uID",
        side,
        price,
        volume_total,
        volume_filled,
        status,
        time_created,
        time_updated
      )
      VALUES (
        ${bID},
        ${input.uID},
        ${side},
        ${price},
        ${volume},
        0,
        'open',
        NOW(),
        NOW()
      )
      RETURNING o.*
    `);

    if (!row) {
      throw new Error('Failed to create order');
    }

    let order = normalizeMarketOrder(row, brand);
    const trades = await this.matchMarketOrder(order);
    order = (await this.getMarketOrderById(order.oID)) || order;

    return {
      order,
      trades,
    };
  }

  static async cancelOrder(uID: number, oID: number): Promise<{
    cancelled: boolean;
    refunded_points: number;
    restored_shards: number;
    order: MarketOrderRecord;
  }> {
    const existing = await this.getMarketOrderById(oID);
    if (!existing) {
      throw new Error('Order not found');
    }

    if (existing.uID !== uID) {
      throw new Error('Forbidden');
    }

    if (!['open', 'partial'].includes(existing.status)) {
      return {
        cancelled: false,
        refunded_points: 0,
        restored_shards: 0,
        order: existing,
      };
    }

    const remainingVolume = Math.max(0, existing.volume_total - existing.volume_filled);
    const refundedPoints = existing.side === 'buy' ? remainingVolume * existing.price : 0;
    const restoredShards = existing.side === 'sell' ? remainingVolume : 0;

    if (refundedPoints > 0) {
      await this.upsertAsset(uID, refundedPoints);
    }

    if (restoredShards > 0) {
      await this.createShardLedgerEntry(uID, existing.bID, restoredShards);
      await this.recordShardTransfer({
        bID: existing.bID,
        from_uID: null,
        to_uID: uID,
        volume: restoredShards,
        reason: 'market_sell_cancel',
        related_oID: existing.oID,
      });
    }

    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE market_order AS o
      SET status = 'cancelled',
          time_updated = NOW()
      WHERE o."oID" = ${oID}
      RETURNING o.*
    `);

    const order = row ? normalizeMarketOrder(row, await this.getBrandById(existing.bID)) : existing;
    return {
      cancelled: true,
      refunded_points: refundedPoints,
      restored_shards: restoredShards,
      order,
    };
  }

  static async cancelAllOrders(uID: number): Promise<{ cancelled: number }> {
    const orders = (await this.listOrdersByUser(uID, 0, 500))
      .filter((order) => ['open', 'partial'].includes(order.status));

    let cancelled = 0;
    for (const order of orders) {
      const result = await this.cancelOrder(uID, order.oID);
      if (result.cancelled) {
        cancelled += 1;
      }
    }

    return { cancelled };
  }

  static async listOrderBook(bID: number): Promise<MarketOrderBookRow[]> {
    const sql = getSql();
    const rows = asItems<RawRow>(await sql`
      SELECT
        side,
        price,
        SUM(amount - amount_filled)::int AS volume
      FROM market_order AS o
      WHERE o.base_cid = ${bID}
        AND status IN ('open', 'partial')
        AND amount > amount_filled
      GROUP BY side, price
      ORDER BY side ASC, price DESC
    `);

    return rows.map((row) => normalizeOrderBookRow(row));
  }

  static async listTradesByBrand(bID: number, skip = 0, limit = 50): Promise<MarketTradeRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT
        t.*,
        buy_o.owner_uid AS "buyer_uID",
        sell_o.owner_uid AS "seller_uID"
      FROM market_trade AS t
      LEFT JOIN market_order AS buy_o ON buy_o.order_id = t.buy_order_id
      LEFT JOIN market_order AS sell_o ON sell_o.order_id = t.sell_order_id
      WHERE t.base_cid = ${bID}
      ORDER BY COALESCE(t.time_created, NOW()) DESC,
               t.trade_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const brand = await this.getBrandById(bID);
    return rows.map((row) => normalizeMarketTrade(row, brand));
  }

  static async openFreeShardChest(uID: number, bID: number): Promise<{
    bID: number;
    shards_awarded: number;
    user_shard_balance: number;
    prize: PrizeRecord;
    transfer: ShardTransferRecord | null;
  }> {
    const prize = await this.getPrizeById(bID);
    if (!prize) {
      throw new Error('Prize not found');
    }

    if (!prize.market_is_open) {
      throw new Error('Prize is not in circulation');
    }

    if (prize.free_shards_remaining <= 0) {
      throw new Error('No free shards remaining for this prize');
    }

    const maxChestAward = Math.min(100, prize.free_shards_remaining);
    const shardsAwarded = Math.max(1, Math.floor(Math.random() * maxChestAward) + 1);

    await this.createShardLedgerEntry(uID, bID, shardsAwarded);
    const transfer = await this.recordShardTransfer({
      bID,
      from_uID: null,
      to_uID: uID,
      volume: shardsAwarded,
      reason: 'free_chest',
    });

    const [userShardBalance, updatedPrize] = await Promise.all([
      this.getUserShardBalance(uID, bID),
      this.getPrizeById(bID),
    ]);

    if (!updatedPrize) {
      throw new Error('Failed to load updated prize');
    }

    return {
      bID,
      shards_awarded: shardsAwarded,
      user_shard_balance: userShardBalance,
      prize: updatedPrize,
      transfer,
    };
  }

  static async redeemPrizeItemFromShards(uID: number, bID: number): Promise<PrizeItemRecord> {
    const holdings = await this.getUserShardBalance(uID, bID);
    if (holdings < 1000) {
      throw new Error('Insufficient shards to redeem gift');
    }

    const sql = getSql();
    const availableGift = firstRow(await sql`
      SELECT to_jsonb(g) AS row
      FROM prize_item AS g
      WHERE COALESCE((to_jsonb(g)->>'bID')::int, 0) = ${bID}
        AND COALESCE((to_jsonb(g)->>'uID')::int, 0) = 0
      ORDER BY COALESCE((to_jsonb(g)->>'gID')::int, 0) ASC
      LIMIT 1
    `);

    if (!availableGift) {
      throw new Error('Gift inventory is unavailable');
    }

    const gID = toNumberValue(getValue(availableGift, 'gID'));
    await this.createShardLedgerEntry(uID, bID, -1000);
    await this.recordShardTransfer({
      bID,
      from_uID: uID,
      to_uID: null,
      volume: 1000,
      reason: 'gift_redeem',
    });

    const row = firstRow(await sql`
      UPDATE prize_item AS g
      SET "uID" = ${uID},
          time_claimed = NOW(),
          time_actived = COALESCE(time_actived, NOW())
      WHERE COALESCE((to_jsonb(g)->>'gID')::int, 0) = ${gID}
      RETURNING to_jsonb(g) AS row
    `);

    if (!row) {
      throw new Error('Failed to redeem gift');
    }

    return normalizePrizeItem(row);
  }

  static buildAdminAccess(
    user: UserRecord,
    extraPermissions: string[] = [],
    hasRoleRow = false,
  ): AdminAccessRecord {
    // P6-B6-PERM（批 6 · `isAdminAddress` 收敛）：`is_admin` 只看 `users.is_admin`（第二支 = `hasRoleRow`）。
    const isAdmin = user.is_admin;
    const permissions = isAdmin
      ? [...ALL_ADMIN_PERMISSIONS]
      : uniqueStrings(extraPermissions);
    // P4-B2c（§6.1）：can_access_admin = is_admin OR EXISTS(admin_user_role.uid) OR 有权限位。
    const canAccessAdmin = isAdmin || hasRoleRow || permissions.length > 0;

    let preferredAdminPath = '/';
    if (canAccessAdmin) {
      if (permissions.includes('manage_settings')) preferredAdminPath = '/dashboard/settings';
      else if (permissions.includes('manage_permissions')) preferredAdminPath = '/dashboard/permissions';
      else if (permissions.includes('manage_users') || permissions.includes('read_users')) preferredAdminPath = '/dashboard/users';
      else if (permissions.includes('manage_points')) preferredAdminPath = '/dashboard/points';
      else if (permissions.includes('manage_rewards') || permissions.includes('publish_prizes')) preferredAdminPath = '/dashboard/rewards';
      else if (permissions.includes('manage_tasks') || permissions.includes('publish_tasks')) preferredAdminPath = '/dashboard/tasks';
      else preferredAdminPath = '/dashboard';
    }

    return {
      uID: user.uID,
      EVM: user.EVM,
      is_admin: isAdmin,
      permissions,
      can_access_admin: canAccessAdmin,
      preferred_admin_path: preferredAdminPath,
    };
  }
}
