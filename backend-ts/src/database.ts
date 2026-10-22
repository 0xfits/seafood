import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { createHash } from 'crypto';
import { PLATFORM_UID, SYSTEM_CURRENCY_CID, postEvent, type LedgerEventEntryInput } from './ledger';
// 批 8⑤（`route-layer.spec` v2.10 §25 / `data-layer.spec` v0.17 §28）：招工仲裁写路径需
// **同事务**内「迁 `submitted→disputed`（既有白名单边）→ 调既有 `job_post_event`（资金腿 + 终态）
// → 写 `job_arbitration_log`」⇒ 复用 `db.ts` 的交互式事务（R55/R56）；商品下架无账务 ⇒ 仍单语句。
import { txQuery, withTransaction, type TxClient } from './db';
// ★ 2026-10-19 商品卡改版（Kevin 第 4 条）：feed 行 `seller` 键与详情卖家视图**同源**取
//   （星号打码助手 / 信用档位 / 均星归一，定义在 messages-service —— 它不回依 database，无循环）。
import { maskWalletAddress, creditFromAvg, toRatingAvg, type SellerView } from './messages-service';

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
  // 8⑥ 审计台（route-layer.spec v2.21 §32.14 `R-9-75`）：新增 `manage_audit`（闭集 11 → 12）。
  // 库侧 `admin_permission` 行由 `0039_admin_audit_console.sql` 补（本单不 apply）；前端
  // `frontend/src/admin-utils.js` 离线兜底列表须同批 +1（三处编码同集）。
  'manage_audit',
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
// · 顶层合法键（`app_config.key` 取值）**恰好 10 个** = `system_settings`（`AK1`，§21.1）
//   + `listing_deposit_policy`（`AK2`，§23.1 入册；真源 = `R-8-9` 批准键名）
//   + P9 候选 7 键（§29.2(B) `B1`–`B7`；`R-9-13`-1 裁准入册 = 变体 Ⅰ）
//   + `detail_view_dedup`（P58 · 迁移 0058 · 详情浏览去重开关，只经配置行/迁移改）；
//   **任何其它键名一律非法**（含 `foo` / `deposit_amount` / `fee_rate` / `rate_bp`）。
// · ★ **「在册」=「可写」**（`data-layer.spec` v0.13 §24 · `route-layer.spec` v2.6 §21 · `R-8-19`）：
//   `AK2` 已可经 `POST /api/admin/settings` 的**形态 B**（显式信封 `{key, value}`）**键级寻址**写入
//   （校验叠加 `AV1` 顶层键 → `AV2` 逐键字段闭集 → `AV3` 逐键类型 → `AV4` `amount` 语义域）；
//   形态 A（裸值对象）的**目标键仍 = 单键 `system_settings`**（线格式逐字兼容 · §24.1(f)）。
//   ⇒ 把 `listing_deposit_policy` 当 `AK1` 值对象的**字段**塞进请求体 ⇒ **仍必被 `AG1` 拒**（**键 ≠ 字段**）。
// · `system_settings` 的 `value` = **jsonb object**（容器硬约束 `0017:77`），对象内字段 = 下 9 个（类型规格见 `SYSTEM_SETTINGS_FIELD_TYPES`）。
// · `listing_deposit_policy` 的 `value` = **jsonb object**（同容器约束），对象内字段 = `amount`（正整数 · 最小单位；
//   逐字段规格见 `LISTING_DEPOSIT_POLICY_FIELD_TYPES`；**数值真值 = `Kevin 2026-10-04 定值 50000`**）。
// · `value` 内**字段名**亦为**关闭集**：请求体出现清单外的键即按其为「未知键」判负（`AG1`）。
// ⚠️ 纪律（§21.3 规则①）：**本清单是键名的唯一真源** —— 实现 / 测试 / 探针**不得自拟键名**。
/**
 * §21.1 `AK1` ∪ §23.1 `AK2` ∪ §29.2(B)（P9 候选 `B1`–`B7` · `R-9-13`-1 裁准入册）∪ P58：
 * `app_config` 顶层合法键（关闭集 · 恰 10 键）。逐字 10 键 =
 *   `system_settings` · `listing_deposit_policy` ·
 *   `batt_policy`(B1) · `checkin_policy`(B2) · `invite_reward_policy`(B3) ·
 *   `mint_burn_policy`(B4) · `rating_policy`(B5) · `site_text_overrides`(B6) · `role_names`(B7) ·
 *   `detail_view_dedup`（P58 · 详情浏览去重开关；迁移 0058 落行 `{"dedup":"off"}`）。
 * ★ 「在册 ≠ 可写」仍成立（§29.2(D) 三重复核）：入册后仍须过 `AV2`–`AV5` + `ops:` 键级寻址 + 闸 `manage_settings`；
 *   `detail_view_dedup` **在册但不可经 /api/admin/settings 写**（`validateAppConfigValue` 分发无其
 *   校验器 ⇒ fail-closed 兜底拒；开关只经配置行 / 迁移 0058 改）。
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
  'detail_view_dedup',
] as const;

/**
 * ★ P58（迁移 0058 · 详情浏览去重开关）：开关键 + 值对象字段 + 合法值闭集（判据真源三件套）。
 * · 存储 = `app_config` 行 `{"dedup": "on"|"off"}`（0017 容器 CHECK ⇒ 裸标量不可存）；
 * · **代码默认 = on（去重）**：行缺席 / `dedup` 字段缺席 / 非字符串 / 闭集外值 ⇒ 一律按 on（fail-safe，
 *   见 `parseDetailViewDedupSwitch`）；**当前配置 = off**（迁移 0058 落行，不去重 = 现状行为不变）。
 */
export const DETAIL_VIEW_DEDUP_KEY = 'detail_view_dedup' as const;
export const DETAIL_VIEW_DEDUP_FIELD = 'dedup' as const;
export const DETAIL_VIEW_DEDUP_LEGAL_VALUES = ['on', 'off'] as const;

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
// · 字段层：对象内**只允许** `amount`（**正整数 · 最小单位**；`AG3`(ii)）—— 数值真值 = `Kevin 2026-10-04 定值 50000`。
// · ★ **键 ≠ 字段**（§23.3 末段两禁令）：本表描述的是**某个顶层键的 `value` 内部**，
//   **不得**并入 `SYSTEM_SETTINGS_FIELD_TYPES`（那会同时破 `AK1` 的 9 字段关闭集与 `AG1` 的键维语义）。
/** §23.3 `AK2`：`listing_deposit_policy` 值对象的**逐字段类型规格**（`AG3`(ii) 的判据真源）。 */
export const LISTING_DEPOSIT_POLICY_FIELD_TYPES = {
  /** 上市保证金金额（**整数 · 最小单位**；数值真值 `Kevin 2026-10-04 定值 50000`）。 */
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

/**
 * ★ P9③（§29.2 B5 + `R-9-13`-3）`rating_policy` 服务端常量兜底（`app_config` 无行 / 字段非法 ⇒ 回落本表）。
 * 逐字 = `storageDecimals 4`（存储标度）/ `displayDecimals 0`（展示无小数）/ `defaultStars 3.0`（中性初始值）。
 * `defaultStars` 生效值**钳制 ∈ [0,5]**（`STAR_RANGE`）；这是评分「无数据默认 3.0」的代码面唯一真源。
 */
export const RATING_POLICY_DEFAULTS = {
  storageDecimals: 4, displayDecimals: 0, defaultStars: 3.0,
} as const;

export type RatingPolicy = { storageDecimals: number; displayDecimals: number; defaultStars: number };

/** `rating_policy` 解析（**逐字段** fail-closed 到 `RATING_POLICY_DEFAULTS`；`defaultStars` 钳 ∈ [0,5]）。 */
export const resolveRatingPolicy = (raw: unknown): { policy: RatingPolicy; source: PolicySource } => {
  const isObj = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  const v = isObj ? raw as Record<string, unknown> : {};
  const storageDecimals = policyNonNegInt(v.storageDecimals) ?? RATING_POLICY_DEFAULTS.storageDecimals;
  const displayDecimals = policyNonNegInt(v.displayDecimals) ?? RATING_POLICY_DEFAULTS.displayDecimals;
  const rawDefault = policyFiniteNumber(v.defaultStars);
  const defaultStars = rawDefault === null
    ? RATING_POLICY_DEFAULTS.defaultStars
    : Math.min(Math.max(rawDefault, 0), 5);
  return {
    policy: { storageDecimals, displayDecimals, defaultStars },
    source: isObj && Object.keys(v).length > 0 ? 'config' : 'constant',
  };
};

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

/**
 * ★ P9④（`data-layer.spec` v0.25 §33.2(a) `R-9-40`）：`mint_burn_policy` 五键**服务端常量兜底**。
 * 逐字 = 需求 §5.2.2「100 batt + 1$ ⇒ 铸 1 BTTC」/ §5.3.2「1 BTTC + 1$ ⇒ 分解」/ §5.3.3「+100 batt」。
 * `app_config` 无行 / 字段非法 ⇒ 该字段回落本表；`source = 'config'`（有行）| `'constant'`（无行）。
 */
export const MINT_BURN_POLICY_DEFAULTS = {
  mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100,
} as const;

export type MintBurnPolicy = {
  mintBattCost: number; mintFeeUsd: number; burnBttcCost: number; burnFeeUsd: number; burnBattGain: number;
};

/**
 * ★ `R-9-23`（生效值钳制到下游 DB CHECK 同构）· P9④ 附加两键：
 *   · `mintBattCost` 生效值 ≤ `capBatt` 生效值（`capBatt` 自身已钳 ≤ 100）—— 否则当 `capBatt < 100`
 *     时铸造恒不可达（耗 100 batt 永不能满足）；
 *   · `burnBattGain` 生效值 ≤ `BATT_CAP_HARD_MAX`（100）—— DB 兜底 `CHECK (batt BETWEEN 0 AND 100)`
 *     （`0029:53`）⇒ 否则分解写入被 **23514** 拒。
 *  `capBatt` 由调用方（已解析的 `batt_policy`）传入；缺省 = 硬上限 100。
 */
export const resolveMintBurnPolicy = (
  raw: unknown,
  capBatt: number = BATT_CAP_HARD_MAX,
): { policy: MintBurnPolicy; source: PolicySource } => {
  const isObj = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  const v = isObj ? raw as Record<string, unknown> : {};
  const capBound = Number.isSafeInteger(capBatt) && capBatt > 0 ? capBatt : BATT_CAP_HARD_MAX;
  // ★ `R-9-23` 钳制：`mintBattCost` ≤ capBatt；`burnBattGain` ≤ 100（DB CHECK 兜底同构）。
  const mintBattCost = Math.min(policyPositiveInt(v.mintBattCost) ?? MINT_BURN_POLICY_DEFAULTS.mintBattCost, capBound);
  const burnBattGain = Math.min(policyPositiveInt(v.burnBattGain) ?? MINT_BURN_POLICY_DEFAULTS.burnBattGain, BATT_CAP_HARD_MAX);
  return {
    policy: {
      mintBattCost,
      mintFeeUsd: policyPositiveInt(v.mintFeeUsd) ?? MINT_BURN_POLICY_DEFAULTS.mintFeeUsd,
      burnBttcCost: policyPositiveInt(v.burnBttcCost) ?? MINT_BURN_POLICY_DEFAULTS.burnBttcCost,
      burnFeeUsd: policyPositiveInt(v.burnFeeUsd) ?? MINT_BURN_POLICY_DEFAULTS.burnFeeUsd,
      burnBattGain,
    },
    source: isObj ? 'config' : 'constant',
  };
};

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
/** 有限数域（fail-closed：非法 / 非有限 ⇒ `null` ⇒ 调用方回落常量）。 */
const policyFiniteNumber = (raw: unknown): number | null => {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
  return Number.isFinite(n) ? n : null;
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

// ============================================================================
// ★★ 批 9 第 5 片（P9⑤ · `commission.spec` v0.4 §19.5⑦ + `R-9-57` + 需求 §6.2 ·
//    `data-layer.spec` v0.26 §34.3）：`invite_reward_policy`（`B3`）服务端常量兜底 + 解析器。
// ----------------------------------------------------------------------------
// · 逐字 = 需求 §6.2：「注册完成即刻到账 30 batt」/「完成首个平台任务后邀请双方各 10$」/
//   `R-9-57`：`rewardLevels = 6`（总层数单值；域 `POSITIVE_INT` 不变）。
// · `app_config` 无行 / 字段非法 ⇒ 该字段回落本表；`source = 'config'`（有行）| `'constant'`（无行）。
// · ★ 本模块**不写** `app_config`（唯一写口 = `POST /api/admin/settings`，`AG2`）。
// ============================================================================
export const INVITE_REWARD_POLICY_DEFAULTS = {
  signupBatt: 30, firstTaskUsd: 10, rewardLevels: 6,
} as const;

export type InviteRewardPolicy = { signupBatt: number; firstTaskUsd: number; rewardLevels: number };

/** `invite_reward_policy` 解析（**逐字段** fail-closed 到 `INVITE_REWARD_POLICY_DEFAULTS`；域 `POSITIVE_INT`）。 */
export const resolveInviteRewardPolicy = (raw: unknown): { policy: InviteRewardPolicy; source: PolicySource } => {
  const isObj = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
  const v = isObj ? raw as Record<string, unknown> : {};
  return {
    policy: {
      signupBatt: policyPositiveInt(v.signupBatt) ?? INVITE_REWARD_POLICY_DEFAULTS.signupBatt,
      firstTaskUsd: policyPositiveInt(v.firstTaskUsd) ?? INVITE_REWARD_POLICY_DEFAULTS.firstTaskUsd,
      rewardLevels: policyPositiveInt(v.rewardLevels) ?? INVITE_REWARD_POLICY_DEFAULTS.rewardLevels,
    },
    source: isObj ? 'config' : 'constant',
  };
};

/** P9⑤ 注册腿 batt 幂等键前缀（`biz:invite:signup:<uid>`）。 */
export const INVITE_SIGNUP_KEY_PREFIX = 'biz:invite:signup:';

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

// ============================================================================
// FEED-RANK-v2 + FEED-SORT-v1（首页 / 商品列表排序 · 算法文档 · 唯一定义点）
// ----------------------------------------------------------------------------
// ① **推荐态**（`sort=recommend` · **缺省**）—— 五因子加权综合分（Kevin 2026-10-22 定权）：
//      score = 0.40·recency + 0.20·rating + 0.15·wants + 0.15·views + 0.10·sale_rate
//        · recency   = 1/(1+age_days)                 —— **发布时间**（指数衰减，半衰期 ≈ 1 天）
//                      age_days = (now() − listing.time_created)/86400（GREATEST(_,0) 兜未来时间戳）
//        · rating    = COALESCE(卖家**收到的**均星, 3.0)/5 —— **质量**（无评分 ⇒ 中性 3 星；不区分 direction）
//        · wants     = c/(c+5)                       —— **收藏热度**饱和归一（c = listing_favorite 计数；
//                                                      c=0 ⇒ 0，c=5 ⇒ .5，c=45 ⇒ .9 —— 单调、有界、抗长尾）
//        · views     = v/(v+100)                     —— **浏览热度**饱和归一（v = listing.view_count，0057 列；
//                                                      NULL / 负数 ⇒ 0；v=100 ⇒ .5，900 ⇒ .9）
//        · sale_rate = 已售/(已售+库存)                —— **成交率**（0..1；分母 = 0 ⇒ 0）
//      **已售口径**（写清，供复核）：`SUM(quantity) FROM listing_order WHERE status = 'paid'`。
//        订单 status 闭集 = created / paid / refunded / cancelled（0015 `listing_order_status_enum`）：
//        `paid` = 已付款且未退款 = 唯一的「真成交」稳态；`created`（未付）/ `refunded`（已退款）/
//        `cancelled`（已取消）**一律不计**。计**件数**（quantity）而非订单行数 —— 与库存同量纲
//        （多件购买下单条 quantity>1 不会被低估）。
//      tie-break 全确定、可重复：feed_score DESC, time_created DESC, listing_id DESC
// ② **排序轴**（`?sort=`）—— **只决定服务端默认顺序，不影响分值**（★ 2026-10-22 Kevin 改口：
//    排序改回前端 ⇒ 服务端把排序依据 `feed_score` 交给前端，前端只对**已加载行**重排、不重拉）：
//     · `recommend`（缺省）⇒ 三级序 = `feed_score DESC, time_created DESC, listing_id DESC`；
//     · `new` ⇒ 同一行 ORDER BY 里 `CASE WHEN $sort='new' THEN 0.0 ELSE f.feed_score END` 取 0.0
//       ⇒ 该项零区分度 ⇒ 退化为 `time_created DESC, listing_id DESC`（纯发布时间降序 =
//       「无分值两键排序」逐字等价）。
//    手法 = **分值无条件算（公式不再包 CASE）** + ORDER BY 里一层 CASE 把排序轴摘出来 ⇒
//    单条 SQL 两态共用、ORDER BY 字面量恰一处 ⇒ 永不出现第二份排序真源。
//    ⇒ 服务端默认顺序**与页面显示顺序解耦**：全序稳定才能保证无限滚动翻页**不重不漏**
//    （首页不分页 / 滚到 18 行×6 列 = 108 件，但 `skip/limit` 语义一字未改）。
// ④ **契约键 `feed_score`**（feed 行**加性**键 · 行键 50 → **51**）：五因子加权分以
//    **6 位小数字符串**（`toFixed(6)`）下发，`/api/prize/all` 与 `/api/home` 两口同源一致。
//    ★ 保密口径**改判**（2026-10-22 Kevin：前端要自己排序 ⇒ 分值必须可见）：由「零泄露」改为
//    「**恰一个**派生键 `feed_score`；五因子**原始值**（recency / rating / wants_n / views_n /
//    sale_rate）及中间量（均星裸值、view_count、sold_qty）仍一律不出」。
//    `sort=new` 时该键**照旧返回**（同权重同公式，与排序无关）⇒ 前端切回推荐无需重拉。
//    透出面 = `normalizeBrand` 的「行携带该列才出」条件块：feed 两个读口带、详情读口不带
//    ⇒ 详情响应键数不变。
// ⑤ **权重读口**（两态共用：分值无条件算 ⇒ `sort=new` 也必须读权重，原「new 态不读配置」作废）——
//    见下 ③ 权重配置（可选单行 · 改权不改码 · fail-open · **逐项回落**）：
//      app_config 行 key='feed_score_weights'，value 例：
//        {"recency":"0.40","rating":"0.20","wants":"0.15","views":"0.15","sale_rate":"0.10"}
//      · 值可为 JSON 数字或数字字符串（运维手写友好）；
//      · **逐项**判定：缺失 / 非数 / 负数 / 非有限 ⇒ **该项**回落该项默认（其余项照用配置值）；
//        清单外字段忽略（不参与打分，也不使整行失效）；
//      · **按和归一化**：SQL 用 w_i / Σw ⇒ 写 `4/2/1.5/1.5/1` 与 `0.4/0.2/0.15/0.15/0.1` 等价；
//        Σw = 0（五项全 0）⇒ **回落全默认**（否则全行同分，排序失去意义）；
//      · 只读接缝 `getFeedScoreWeights()`：每请求单行 SELECT、**无进程内缓存**（体例 = P58 开关读）；
//        读失败（DB 抖）⇒ 默认 + warn（**fail-open**：推荐态永远可用，绝不因配置坏/配置读坏而 5xx）。
//      · ★ 本键**不登记**进 `APP_CONFIG_LEGAL_KEYS`（登记会撞既有白名单冻结判据：p8-s1 `B1` 逐字 10 键 /
//        p8-s6 `C1-C2` 9 键 / p58 `A` 10 键 —— 既有门不回归）⇒ 该键**只读不写**
//        （`POST /api/admin/settings` 无其校验器 ⇒ fail-closed 拒写），行由运维 SQL / 迁移落。登记另立单。
//   权重 / 中性分 / 饱和常数**集中在此**；SQL 侧只引用参数与同源常量（不得散落字面量）。
// ============================================================================
/** 排序模式闭集（`GET /api/prize/all?sort=` 的合法值；其它值 ⇒ 路由层 400 `sort_invalid`） */
export const FEED_SORT_MODES = ['recommend', 'new'] as const;
export type FeedSortMode = (typeof FEED_SORT_MODES)[number];
/** 缺省排序模式（**推荐**）—— 缺参 / 空串 / 服务层收到非法值 时一律回落此值 */
export const FEED_SORT_DEFAULT: FeedSortMode = 'recommend';
/** 权重配置键名（唯一常量；读口只经 `getFeedScoreWeights`，写入不在本模块） */
export const FEED_SCORE_WEIGHTS_KEY = 'feed_score_weights' as const;
/** 权重字段闭集（顺序即归一化与日志的固定顺序） */
export const FEED_SCORE_WEIGHT_FIELDS = ['recency', 'rating', 'wants', 'views', 'sale_rate'] as const;
export type FeedScoreWeightField = (typeof FEED_SCORE_WEIGHT_FIELDS)[number];
/**
 * 代码面默认权重（**逐项回落真源**；和为 1 ⇒ 归一化后与配置缺省时逐字相等）——
 * 改这里 = 改全站推荐口径（Kevin 2026-10-22 定值）。
 */
export const DEFAULT_FEED_SCORE_WEIGHTS: Readonly<Record<FeedScoreWeightField, number>> = {
  recency: 0.40,
  rating: 0.20,
  wants: 0.15,
  views: 0.15,
  sale_rate: 0.10,
} as const;
const FEED_RATING_NEUTRAL_STARS = 3.0;
/** 饱和归一常数：`wants = c/(c+5)` · `views = v/(v+100)`（集中在此，SQL 侧引用同源常量） */
const FEED_WANTS_SATURATION = 5;
const FEED_VIEWS_SATURATION = 100;
/**
 * ★ 契约键 `feed_score` 的下发精度（**6 位小数**固定串）—— 唯一定义点。
 * 为什么是**字符串**：分值 = 浮点派生量，`number` 经 JSON 序列化后位数不定（0.44 vs 0.4400000000000001），
 * 前端要拿它做**稳定排序依据**（同分才落 tie-break）⇒ 定长小数串把「同一分」钉成同一字面量。
 */
export const FEED_SCORE_DECIMALS = 6;

/** 权重解析结果（`normalized` 供 SQL 直接用；其余字段供门 / 日志诊断） */
export interface FeedScoreWeights {
  /** **归一化后**权重（五项之和 = 1）—— SQL 只用这五个数 */
  normalized: Record<FeedScoreWeightField, number>;
  /** 归一化**前**的逐项生效值（配置值，或该项默认） */
  raw: Record<FeedScoreWeightField, number>;
  /** 真正来自配置的字段（逐项回落诊断用；空 = 全默认） */
  overridden: FeedScoreWeightField[];
  /** `config` 五项全配置 · `partial` 部分回落 · `default` 全默认（缺行 / 全非法 / 全 0） */
  source: 'config' | 'partial' | 'default';
  /** 归一化分母（= `raw` 之和；回落全默认时 = 1.0） */
  sum: number;
}

/** `sort` 归一（trim + lowercase）：闭集内 ⇒ 该值；其余（含非字符串 / 空串 / `undefined`）⇒ `null` */
export const normalizeFeedSort = (raw: unknown): FeedSortMode | null => {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  return (FEED_SORT_MODES as readonly string[]).includes(normalized) ? normalized as FeedSortMode : null;
};

/** 单个权重值归一：JSON 数字 / 数字字符串 ⇒ 有限非负数；其余（含负数 / 空串 / `null`）⇒ `null`（非法） */
const parseFeedWeightValue = (raw: unknown): number | null => {
  const numeric = typeof raw === 'number'
    ? raw
    : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim()) : Number.NaN);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0) return null;
  return numeric;
};

const defaultFeedScoreWeights = (): FeedScoreWeights => ({
  normalized: { ...DEFAULT_FEED_SCORE_WEIGHTS },
  raw: { ...DEFAULT_FEED_SCORE_WEIGHTS },
  overridden: [],
  source: 'default',
  sum: FEED_SCORE_WEIGHT_FIELDS.reduce((acc, f) => acc + DEFAULT_FEED_SCORE_WEIGHTS[f], 0),
});

/**
 * ★ 权重配置解析（**fail-open + 逐项回落**的判据唯一真源）：`app_config.feed_score_weights` 的
 *   **原始 jsonb 值**（行缺席 / 读失败 ⇒ 传 `null`/`undefined`）⇒ `FeedScoreWeights`。
 *   · 逐项：字段值合法（有限数或数字字符串、≥ 0）⇒ 采信；缺失 / 非数 / 负数 / 非有限 ⇒ **该项**回落默认；
 *   · 清单外字段**忽略**（不参与打分、也不让整行失效 —— 允许未来加注释型字段）；
 *   · 归一化：`normalized_i = raw_i / Σraw`；**Σraw = 0 或非有限 ⇒ 整行回落全默认**；
 *   · 永不抛、永不产出 NaN ⇒ 推荐态不会因配置坏而 5xx（调用方按 `source` 决定是否 warn）。
 */
export const parseFeedScoreWeights = (raw: unknown): FeedScoreWeights => {
  const fallback = defaultFeedScoreWeights();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const obj = raw as Record<string, unknown>;
  const effective = {} as Record<FeedScoreWeightField, number>;
  const overridden: FeedScoreWeightField[] = [];
  for (const field of FEED_SCORE_WEIGHT_FIELDS) {
    const parsed = parseFeedWeightValue(obj[field]);
    if (parsed === null) {
      effective[field] = DEFAULT_FEED_SCORE_WEIGHTS[field];
    } else {
      effective[field] = parsed;
      overridden.push(field);
    }
  }
  const sum = FEED_SCORE_WEIGHT_FIELDS.reduce((acc, f) => acc + effective[f], 0);
  if (!Number.isFinite(sum) || sum <= 0) return fallback;
  const normalized = {} as Record<FeedScoreWeightField, number>;
  for (const field of FEED_SCORE_WEIGHT_FIELDS) normalized[field] = effective[field] / sum;
  const source: FeedScoreWeights['source'] = overridden.length === 0
    ? 'default'
    : (overridden.length === FEED_SCORE_WEIGHT_FIELDS.length ? 'config' : 'partial');
  return { normalized, raw: effective, overridden, source, sum };
};

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
export type SqlRunner = { query: (text: string, params?: unknown[]) => Promise<{ rows: RawRow[] }> };

/** 上市（`POST /api/currency/:cid/list`）的 DB 侧唯一显式语句（单语句 CTE = 一个隐式事务）。 */
const LIST_CURRENCY_WITH_DEPOSIT_SQL = `
      WITH cur AS (
        SELECT c.cid, c.owner_uid, c.status, c.deposit_cid, c.is_platform_coin
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
          --    ★★ 批 8④ C2 审核闸（fail-closed · route-layer.spec v2.8 §23.5 ④）：
          --    无「已通过审核的台账行」（currency_review_log.result='approved'）⇒ 本 CTE 不产行
          --    ⇒ 整条语句零副作用（不改 status / 不写 currency_status_log / 零账本分录）
          --    ⇒ 服务层落既有 stateConflict('currency.status','CURRENCY_STATE_INVALID',
          --      required_from='draft') @ currency-service.ts:454（未审 draft 不得上市）。
          --    闸在唯一写路径的 SQL 内（R-8-18 单一真源）⇒ 服务层 / 探针两路共用、不可绕过。
          --    台账表为 append-only（0025）⇒「已通过」单调不可撤销 ⇒ 无 TOCTOU 逃逸。
          --    ★★ P9④（R-9-39 · data-layer.spec v0.25 §33.10-B）：**平台币豁免 = 追加一个谓词**
          --      （c.is_platform_coin = true；变体 Ⅱ 标记列 · 迁移 0033）。豁免**只对带平台标记的行生效**
          --      （C-1）；**既有 6 条条件一字未动**（仅把 AND EXISTS(…) 从单谓词包为 AND (EXISTS(…) OR 平台)），
          --      **不造第二写路径**。存量行 is_platform_coin = false ⇒ 非平台行仍必须走审核闸。
          AND (
            EXISTS (
              SELECT 1 FROM public.currency_review_log AS r
               WHERE r.cid = $1::bigint AND r.result = 'approved'
            )
            OR c.is_platform_coin = true
          )
          -- ★ P9④（R-9-39）：保证金腿对**平台行跳过** —— 平台币豁免保证金（R-9-2）。
          --   非平台行（is_platform_coin = false）仍全额缴保证金（C-1 判据）。
          AND NOT (c.is_platform_coin = true AND $3::bigint <> 0)
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

/** 幂等 `request_fingerprint`（`R53`）—— 规范化请求体的 sha256（沿 `job-funds-service.ts:108` 手法）。 */
const fingerprintOf = (parts: Array<string | number>): string =>
  createHash('sha256').update(parts.join('|')).digest('hex');

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

/**
 * ★ S23（台账 B4）：`headcount`（招募总人数）读侧兜底 —— 缺省 / 非整数 / `< 1` ⇒ `1`。
 *   与迁移 `0041_job_headcount.sql` 的 `NOT NULL DEFAULT 1` **同语义**（fail-closed，
 *   绝不返回 0 / 负数 / NaN ⇒ 前端「共 N 人」永不显示非法值）。
 */
const toHeadcount = (value: unknown): number => {
  const next = toOptionalNumber(value);
  return next !== null && Number.isInteger(next) && next >= 1 ? next : 1;
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

/**
 * ★ P58（迁移 0058）`detail_view_dedup` 开关值解析（fail-safe 判据唯一真源）：
 *   `'on'` ⇒ true（去重）；`'off'` ⇒ false（不去重）；**其余一切** —— 行缺席 / `dedup` 字段缺席 /
 *   非字符串 / 闭集外值 —— ⇒ **默认 on（去重）**（Kevin 口径「代码默认 = 去重」⇒ 缺配置永不静默关闸）。
 * 大小写 / 首尾空白 normalize 后比对闭集 `DETAIL_VIEW_DEDUP_LEGAL_VALUES`（单一真源、不二写）。
 */
export const parseDetailViewDedupSwitch = (raw: unknown): boolean => {
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  if (!(DETAIL_VIEW_DEDUP_LEGAL_VALUES as readonly string[]).includes(normalized)) return true;
  return normalized === 'on';
};

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
  /**
   * ★ 2026-10-22 用户头像写口（列 = 迁移 `0052`，读侧 feed/详情早已在用）：
   *   `users.avatar_url` ⇒ **站内媒体相对路径** `/api/media/<media_id>`；未设 ⇒ `null`。
   *   出形态恒在场（`null` 不是缺键）：`normalizeUser` 逐行归一；`GET /api/user` /
   *   `POST /api/user/profile` 回执经 `buildUserPayload` 的 `...user` **同源**透出。
   */
  avatar_url: string | null;
}

export interface BrandRecord {
  bID: number;
  symbol: string;
  name: string;
  description: string;
  image_url: string;
  url_image: string;
  /** 媒体单前端阶段 A：`listing.media_urls` 读侧透出（媒体 URL 数组，真图 `/api/media/:id`；无媒体 ⇒ 空数组）。 */
  media_urls: string[];
  /** ★ 2026-10-20 商品分类枚举（迁移 0054 换集 · 承 0053）：`listing.item_type` 读侧透出。
   *   闭集 `ItemType` = 'DigitalAutoDeliver' | 'DigitalManualDeliver' | 'PhysicalFreeShip' | 'PhysicalBuyerShip'
   *   （裸 `Digital` 已退役 = 闭集外）；**存量行 NULL**（= 未分类，前端不显示标签）
   *   ⇒ 本键恒在场、值为 `string | null`（不是缺键）。
   *   feed（`listBrands`）与详情（`getBrandById`）同源 `l.*` ⇒ 两口**各 +1 键**（feed 47→48、详情 46→47）。 */
  item_type: string | null;
  /** ★ 迁移 0060（Kevin 2026-10-20 第 3 条「统一商品 Id」）：页面地址码（7 位、base56 去混淆
   *  字母表）。全数字 id / bID 仍是内部键；**对外链接一律用本键**（`/item/<item_code>`）。
   *  feed 与详情同源 `l.item_code` ⇒ 两口各 +1 键；生产库 pre-apply 过渡态缺列 ⇒ `null`。 */
  item_code: string | null;
  /** ★ 迁移 0060：雪花标识，**恒以字符串下发**（63 bit 超出 JS `Number.MAX_SAFE_INTEGER`
   *  ⇒ 落 Number 会静默丢精度；与 `bID` 并存，前端/外部系统按字符串比对即可）。 */
  snowflake_id: string | null;
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
  /** ★ 2026-10-19 商品卡结构重定义：加性键 `wants`（feed 行键 46→47）= 该商品 `listing_favorite`
   *   收藏计数（`count(*)`，无收藏 ⇒ 0）。**只发数字**，不含收藏者身份 ⇒ 无权限 / 隐私面。
   *   ★ P57 起 feed（`listBrands`）与详情（`getPrizeDetailRecordingView`）**同源携带**（同一
   *   `listing_favorite` 聚合 LEFT JOIN）⇒ 详情 data 顶层 47→50 三加性键之一；feed 行键 48 不变。 */
  wants?: number;
  /** ★ P57 详情浏览计数（Kevin 2026-10-20 详情页改版 · 后端件 · 迁移 0057）：加性键 `views`
   *  （详情 data 顶层 47→50 三加性键之一，同批 +`condition` +`wants`）= 详情读口「自增 + 读」
   *  单语句 CTE（`getPrizeDetailRecordingView`）返回的**自增后** `listing.view_count`。
   *  简单计数口径：任何状态都计（不过滤 status）、不区分访问者、
   *  **卖家自看也计**（去重 / 自看排除策略挂 OPEN-ITEMS 待裁）。
   *  仅详情读口携带；feed（`listBrands`）不选该列 ⇒ 行键 48 不变、键不出现。 */
  views?: number;
  /** ★ P57 商品成色（迁移 0057 四值闭集）：`BrandNewSealed` / `LikeNew` / `MinorWear` / `HeavyWear`；
   *  `null` = 无成色（数字商品 / 未分类 / 存量未填）。中文名由前端 i18n 按 `condition` 字面量映射
   *  （服务端只发枚举字面量，与 `item_type` 同体例）。仅详情读口携带（47→50 三加性键之一；
   *  feed 行键 48 不变 ⇒ 键不出现）。 */
  condition?: string | null;
  /** ★ 迁移 0061 多件购买授权（Kevin 2026-10-20）：加性键 `allow_multi_buy`（详情 data 顶层 52→53）
   *  = `listing.allow_multi_buy`（boolean，真布尔下发，**不**转 `'true'` 串 / `0-1`）。
   *  仅详情读口携带（feed 不加：列表卡不参与购买决策）；行未携带该列 ⇒ 键不出现。
   *  ★ 读面必须容忍「`true` 且 `stock = 1`」这个**正常终态**（购买递减 stock 不回写本列）⇒
   *  照实返回 `true`，上限收敛由前端算（route §49.17.5 / data §40.13.5）。 */
  allow_multi_buy?: boolean;
  /** ★ 2026-10-19 商品卡改版（Kevin 第 4 条）：加性键（feed 行键 45→46；详情行经 `getPrizeSellerView`
   *  于路由层合成同构对象 ⇒ 详情顶层键数不变）。形状 = `SellerView`（uid/nickname/avatar/credit）。 */
  seller?: SellerView;
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

// ---- 本批五口（卖家轴两条交易读口 + 收藏三口）行形 ------------------------------
// 「我发布的」：listing.seller_uid = me 全状态行（字段沿 listing 表现列）。
// ★ S55（发布动作单 · `/profile/trades/published` 行内【降价】【编辑】）：加性两键
//   `description` / `item_type`（行键 **8 → 10**，键名/顺序 = 表列原名，零改名、零删键）——
//   目的：① 编辑页（`/item/:id/edit`）回填描述；② 行内按分类渲染（四值闭集，服务端不翻译）；
//   ③ 编辑写口回执与读口**同族同键**（前端可用回执整行替换列表行，无需二次拉取）。
//   两键均为**本人可见面**（seller 自己发布的内容）⇒ 无越权/隐私面。
export interface ListingMineRow {
  listing_id: number;
  title: string;
  price: number;
  cid: number;
  status: string;
  stock: number;
  media_urls: string[];
  time_created: number;
  /** ★ S55 加性键：商品描述（`listing.description`，NOT NULL DEFAULT ''；编辑器允许清空为 ''） */
  description: string;
  /** ★ S55 加性键：商品分类（`listing.item_type`；四值闭集 或 `null` = 未分类，原样透出） */
  item_type: string | null;
  /** ★ P57 加性键（行键 10→11）：商品成色（`listing.item_condition`，迁移 0057 四值闭集 或
   *  `null` = 无成色）—— 编辑页（/item/:id/edit）预填成色用；键名与详情读口 `condition` 一致。 */
  condition: string | null;
  /** ★ 迁移 0060 加性键（行键 11→13）：7 位页面地址码（对外链接 `/item/<item_code>`）。 */
  item_code: string | null;
  /** ★ 迁移 0060 加性键：雪花标识，**字符串**（63 bit 超出 JS 安全整数）。 */
  snowflake_id: string | null;
  /** ★ 迁移 0061 加性键（行键 13→14）：多件购买授权（`listing.allow_multi_buy`）。
   *  **真布尔**（`true` / `false`，禁 `'true'` 串 / `0-1`）；编辑页预填与 mine 行逐键同族
   *  （route §49.16.3 / §49.17.5 同族硬律：`edit` 与 `mine` 键面恒等）。
   *  读面容忍「`true` 且 `stock = 1`」（购买递减不回写本列）。 */
  allow_multi_buy: boolean;
}

// 「我卖出的」：行形与买家轴 listPrizeItemsByUser（GET /api/prize-item）同族（gID/bID/uID
// 键族 + 两个恒 NULL 的时间占位列）且**必须含 status**；gID = order_id、bID = listing_id、
// uID = buyer_uid。
export interface ListingOrderSoldRow {
  gID: number;
  bID: number;
  uID: number;
  status: string;
  time_created: number;
  time_claimed: number;
  time_actived: number;
}

// 「我的收藏」单行：listing_favorite 行 join listing 概要；time_created = **收藏行自己的**
// 收藏时刻（非 listing.time_created）。
export interface ListingFavoriteRow {
  fav_id: number;
  listing_id: number;
  title: string;
  price: number;
  cid: number;
  status: string;
  media_urls: string[];
  time_created: number;
}

// 收藏写口（POST /api/favorites）回体现态：不 join listing 概要，只回收藏行自身三列。
export interface ListingFavoriteMutationRow {
  fav_id: number;
  listing_id: number;
  time_created: number;
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
  // 头像 = 站内媒体相对路径；缺列/无值 ⇒ null（不是缺键，`|| null` 与 `seller.avatar` 同口径）
  avatar_url: toStringValue(getValue(row, 'avatar_url')) || null,
});

/**
 * `feed_score` 归一（**唯一**派生键的出形态）：number / numeric 字符串 ⇒ `toFixed(6)` 定长串。
 * 缺值 / 非有限数 ⇒ `null`（不编值：正常路径两读口恒带该列 ⇒ 走不到兜底，兜底只为不炸）。
 */
const toFeedScoreString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(FEED_SCORE_DECIMALS) : null;
};

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
    // 媒体单前端阶段 A：`listing` 表已带 `media_urls`（l.* 直取），归一层原先丢弃 ⇒ 补透出（纯增键、向后兼容）。
    media_urls: toStringArrayValue(getValue(row, 'media_urls')),
    // ★ 2026-10-20 商品分类枚举（迁移 0053）：feed 与详情同源 `l.*` ⇒ 两口各 +1 键
    //   （feed 47→48、详情 46→47）。值为闭集三字面量之一或 NULL（= 未分类 / 列未迁移时的兜底）；
    //   **恒在场**（不按行缺列选择性省略）——分类是**行属性**不是卖家/聚合派生面，前端按 null 判「无标签」。
    item_type: toStringValue(getValue(row, 'item_type')) || null,
    // ★ 迁移 0060（页面地址键 + 雪花键，两口同源 `l.item_code` / `l.snowflake_id`）：
    //   · `item_code` = 7 位码（`char(7)` 回来恒 7 字符；缺列/未回填 ⇒ `null`，不编值）；
    //   · `snowflake_id` = **字符串**（63 bit ⇒ 落 Number 会静默丢精度；前端按串比对/拼 URL）。
    //   两键**恒在场**（行属性，不按行缺列选择性省略；feed 48→50、详情 50→52）。
    item_code: (() => {
      const rawCode = getValue(row, 'item_code');
      return rawCode === undefined || rawCode === null ? null : String(rawCode);
    })(),
    snowflake_id: (() => {
      const rawSnowflake = getValue(row, 'snowflake_id');
      return rawSnowflake === undefined || rawSnowflake === null ? null : String(rawSnowflake);
    })(),
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
  // ★ 2026-10-19 商品卡改版（Kevin 第 4 条）：feed 行加性键 `seller`（行键 45→46）——
  //   `nickname` = 星号打码钱包地址（`maskWalletAddress`，与详情 `getPrizeSellerView` 单源共用）；
  //   `avatar` = `users.avatar_url`（迁移 0052；null ⇒ 前端灰底占位头像）；
  //   `credit` = 卖家收到评分均星档位（服务端算好下发：无评分 ⇒ 'new'（≠ 排序中性 3 星），
  //   ≥4.5 ⇒ 'excellent' / ≥3.5 ⇒ 'good' / 其余 ⇒ 'normal'；前端不本地算）。
  //   仅当行携带卖家取数列（`listBrands` 专有 LEFT JOIN）时构建；详情行不带这些列 ⇒
  //   详情 `seller` 仍由 `getPrizeSellerView` 在路由层合成（`index.ts` 顶层 `{ ...prize, seller }`），
  //   两处形状一致，详情顶层键数不变。
  if (row.seller_evm !== undefined) {
    record.seller = {
      uid: toNumberValue(getValue(row, 'seller_uid')),
      nickname: maskWalletAddress(toStringValue(row.seller_evm)),
      avatar: toStringValue(row.seller_avatar_url) || null,
      credit: creditFromAvg(toRatingAvg(row.seller_rating_avg)),
    } satisfies SellerView;
  }
  // ★ 2026-10-19 商品卡结构重定义：feed 行加性键 `wants`（行键 46→47）= 该商品收藏数
  //   （`listing_favorite` 按 listing 聚合的 `count(*)`，LEFT JOIN + COALESCE ⇒ 无收藏 ⇒ 0）。
  //   仅当行携带聚合列（`listBrands` 专有）时透出：详情行无此列 ⇒ 键不出现（详情键数不变）。
  //   **只发数字**（不含收藏者身份 / 时间），故无权限与隐私面。
  if (row.want_count !== undefined) {
    record.wants = toNumberValue(getValue(row, 'want_count'));
  }
  // ★ P57 详情浏览计数 + 商品成色 + wants（Kevin 2026-10-20 详情页改版 · 迁移 0057）：详情行加性三键
  //   `views` / `condition` / `wants` ⇒ 详情 data 顶层 47→**50**（service 层 49 + 路由层 `seller`）。
  //   · `views` = **自增后**的 `listing.view_count`（详情专用「自增+读」CTE 的 RETURNING；
  //     bigint 经驱动回字符串 ⇒ toNumberValue 归一成 number）；
  //   · `condition` = `listing.item_condition` 四值闭集字面量或 `null`（= 无成色 / 数字商品 / 未分类；
  //     服务端只发字面量，中文名映射在前端 i18n —— 与 `item_type` 同体例；此处不走
  //     `getValue`/`toStringValue`：两者会把 NULL 归一成 ''/undefined，污染「无成色」语义）；
  //   · `wants` = 收藏计数（`want_count`，走上方既有条件透出块；详情 SELECT 已与 feed 同源 left join）。
  //   三键都**仅当行携带该列**（详情专用口）时透出：feed（`listBrands`）不选 `view_count`/`item_condition`
  //   ⇒ feed 行键 48 不变、两键不出现（wants feed 本就携带）。
  if (row.view_count !== undefined) {
    record.views = toNumberValue(row.view_count);
  }
  if (row.item_condition !== undefined) {
    record.condition = row.item_condition === null ? null : String(row.item_condition);
  }
  // ★ 迁移 0061（多件购买授权 · route §49.17.5）：详情行加性键 `allow_multi_buy` ⇒ 详情 52→53。
  //   仅当行携带该列（详情两个读口：自增臂 + 已见访客只读臂）时透出；feed（`listBrands`）不选该列
  //   ⇒ feed 行键 50 不变、键不出现（列表卡不参与购买决策）。
  //   **真布尔**（禁 `'true'` 串 / `0-1`）；`true ∧ stock = 1` 是正常终态 ⇒ 照实返回 true。
  if (row.allow_multi_buy !== undefined) {
    record.allow_multi_buy = row.allow_multi_buy === true;
  }
  // ★ 2026-10-22 契约键 `feed_score`（feed 行加性键 · 行键 50→**51**，尾部追加 ⇒ 零重排）：
  //   五因子加权分（FEED-RANK-v2）以 **6 位小数字符串**下发 —— 前端的排序依据（排序改回前端）。
  //   · 仅当行携带该列（`listBrands` 专有派生列）时透出：详情读口不选 ⇒ 详情键数不变；
  //   · **保密口径改判**：由「零泄露」改为「**恰这一个**派生键」—— 五个因子的原始值与中间量
  //     （均星裸值 / 浏览量 / 成交量等）仍一律不出（口径见文件顶部常量块）；
  //   · `sort=new` 也照旧返回（值与排序无关）⇒ 前端在「推荐/新发」间切换无需重拉。
  if (row.feed_score !== undefined) {
    record.feed_score = toFeedScoreString(row.feed_score);
  }
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

// ---- 本批五口归一器（bigint 经 pg 回来是字符串 ⇒ id/price/cid 一律 Number 归一，既有纪律）----
const toStringArrayValue = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item)) : []);

const normalizeListingMineRow = (row: RawRow): ListingMineRow => ({
  listing_id: toNumberValue(getValue(row, 'listing_id')),
  title: toStringValue(getValue(row, 'title')),
  price: toNumberValue(getValue(row, 'price')),
  cid: toNumberValue(getValue(row, 'cid')),
  status: toStringValue(getValue(row, 'status')),
  stock: toNumberValue(getValue(row, 'stock')),
  media_urls: toStringArrayValue(getValue(row, 'media_urls')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  // ★ S55 加性键 + P57 第三键（键序 = 依次追加在既有 8 键之后 ⇒ 零重排）：`item_type` 保留 `null`
  //   （未分类），不用 `toStringValue`（后者把 null 归一成 ''，会把「未分类」污染成空串）。
  //   `condition`（P57 · 迁移 0057）同体例：四值闭集字面量或 null；undefined 兜成 null
  //   （两个调用口 SELECT/RETURNING 均恒带该列，兜底只为不炸）。
  description: toStringValue(getValue(row, 'description')),
  item_type: (() => {
    const rawItemType = getValue(row, 'item_type');
    return rawItemType === undefined || rawItemType === null ? null : String(rawItemType);
  })(),
  condition: (() => {
    const rawCondition = getValue(row, 'item_condition');
    return rawCondition === undefined || rawCondition === null ? null : String(rawCondition);
  })(),
  // ★ 迁移 0060（Kevin 2026-10-20 第 3 条）：对外标识两键（行键 11→**13**，尾部追加 ⇒ 零重排）。
  //   · `item_code` = 7 位页面地址码（编辑页 / 列表页拼 `/item/<item_code>` 用）；
  //   · `snowflake_id` = **字符串**（63 bit，落 Number 会静默丢精度）。
  //   三个调用口（mine 列表 / 编辑预填 / PATCH 回执）的 SELECT 与 RETURNING 均恒带这两列。
  item_code: (() => {
    const rawCode = getValue(row, 'item_code');
    return rawCode === undefined || rawCode === null ? null : String(rawCode);
  })(),
  snowflake_id: (() => {
    const rawSnowflake = getValue(row, 'snowflake_id');
    return rawSnowflake === undefined || rawSnowflake === null ? null : String(rawSnowflake);
  })(),
  // ★ 迁移 0061（多件购买授权）：加性键 `allow_multi_buy`（行键 13→14，尾部追加 ⇒ 零重排）。
  //   **真布尔**：`=== true` 归一（DB `boolean` 经驱动回来已是 JS boolean；缺列 / 缺值兜 `false`
  //   只为不炸 —— 三个调用口 SELECT/RETURNING 均恒带该列，正常路径不会走兜底）。
  //   禁输出 `'true'` 串 / `0-1`：前端按 `=== true` 判「已授权」，形态漂移 = 静默只卖 1 件。
  allow_multi_buy: getValue(row, 'allow_multi_buy') === true,
});

/**
 * ★ S55（发布动作单）· `PATCH /api/listing/:listingId` **字段编辑**的 DB 侧单一真源语句。
 *
 * 承既有体例（`LIST_CURRENCY_WITH_DEPOSIT_SQL` / `R-8-18`「单一真源 + `ex` 既有事务内执行口」）：
 * 语句写成**显式 `$n` 占位文本**，服务层（neon）路径与门探针（`inRollbackTx` 客户端）**共用同一份 SQL**。
 *
 * ★★ 2026-10-20 Kevin 数据模型指令：**`listing.title` 退场、正文并入 `description`** ⇒
 *   本语句**不读也不写 `title` 列**（可改字段 = `description / price / stock / media_urls / item_type`）。
 *   数据面（DROP COLUMN）由**另一单**负责；本单零 DDL、零回填、零列引用 —— 故下一单 DROP 后本语句
 *   **无需改动、也不会 42P01**（这是「不期望 title 列」的结构性落实）。
 *
 * 三道闸（全部在**唯一写路径的 SQL 内**，服务层不可绕过、探针同理）：
 *   ① **归属闸**：`cur.seller_uid <> $2` ⇒ `not_owner`（⇒ 服务层 403 ACTOR_NOT_ALLOWED）；
 *   ② **可编辑态闸**：`cur.status NOT IN ('draft','listed')` ⇒ `status_not_editable`
 *      （⇒ 服务层 409 + LISTING_STATE_INVALID；`delisted` 终态 / `frozen` 冻结 = 只读）；
 *      ★ 顺序在库存闸**之前** ⇒ 非法态下即使改库存也落 `status_not_editable`（不落误导性的库存码）。
 *   ③ **库存状态闸**（承 DL60 / `listing_stock_guard` 触发器，与 `updateListingRow` 同码）：
 *      库存实际变更且 `status <> 'listed'` ⇒ `stock_requires_listed`
 *      （⇒ 409 + reason `listing_stock_change_requires_listed`；触发器本身也会 RAISE，此处前置判
 *      只为给**确定性业务码**而不是冒泡成基础设施异常；库内触发器仍是最终真源）。
 *   ④ **成色适用性闸**（P57 · 迁移 0057）：生效 item_condition 非空而有效 item_type ∉
 *      {PhysicalFreeShip, PhysicalBuyerShip} ⇒ `condition_not_applicable`（⇒ 400）；
 *      patch 同时带 item_type 时服务层已纯预检（零 DB），本臂接「只提成色、需回读行现值」的路径。
 *
 * 「未传字段不动」= `COALESCE($n, l.xxx)`（NULL 占位不覆盖）；`item_type` 需区分「未传」与「显式置 NULL」
 * ⇒ 单独 `$8::boolean` 开关（`CASE WHEN $8 THEN $7::text ELSE l.item_type END`）；
 * `item_condition` 同体例走 `$10::boolean` 开关（P57 · 迁移 0057）。
 * `prev_description` 同语句带回 ⇒ 服务层判「描述是否实际变化」（决定是否重置翻译），零额外往返。
 *
 * ★ 0059（管理员可编辑他人商品 · 迁移 `0059_listing_edit_log`）：归属闸加**管理员放行位**
 *   `$11::boolean`（= `can_access_admin ∧ (is_admin ∨ permissions∋manage_rewards)`；判定真源 =
 *   `isListingEditAdminAccess`，路由层只注入 token 侧 `adminAccess`，客户端不得声明）：
 *     · 本人 ⇒ `$11` 分支根本不参与（`seller_uid = $2` ⇒ 通行），**不写台账**（零行为变化）；
 *     · 非本人 ∧ `$11` ⇒ 放行（跳过 `not_owner`），并且**同一语句内**插一条
 *       `listing_edit_log`（`admin_edit = true`；`owner_uid` = 行快照 `seller_uid`；
 *       `changed_fields` = 逐列 `IS DISTINCT FROM` 算出的**实际变化字段名数组**）⇒ 更新与留痕
 *       同一语句、同一事务，不存在「改了没记账」的窗口；
 *     · 非本人 ∧ ¬`$11` ⇒ 仍 `not_owner`（⇒ 服务层 403 `ACTOR_NOT_ALLOWED`）。
 *   ★ 台账 `ins` CTE 只在 `$11 ∧ seller_uid <> $2` 时插行 ⇒ **本人编辑零台账行**（不污染审计面）；
 *     其余校验闸（可编辑态 / 库存 / 成色适用性）**对管理员同样生效**（管理员不放宽字段规则）。
 *
 * 参数位（11 位，**无 title 位**）：$1 listing_id · $2 actor_uid · $3 description · $4 price ·
 *   $5 stock · $6 media_urls · $7 item_type · $8 item_type_set · $9 item_condition · $10 item_condition_set ·
 *   $11 admin_edit（0059 管理员放行位）
 */
const UPDATE_LISTING_DETAILS_SQL = `
      WITH cur AS (
        SELECT pl.listing_id, pl.seller_uid, pl.cid, pl.price, pl.stock, pl.description, pl.media_urls, pl.item_type,
               pl.item_condition, pl.status, pl.time_created,
               -- ★ 0060 两列：guarded 走 cur.* ⇒ 这里漏选则下面 UNION 的 g.item_code 直接 42703
               pl.item_code, pl.snowflake_id,
               -- ★ 0061 多件购买授权：生效 stock 判定（W5 归一 / W7 400）要读行内现值 ⇒ 必须在此取列
               pl.allow_multi_buy
        FROM public.listing AS pl
        WHERE pl.listing_id = $1::bigint
        FOR UPDATE
      ),
      guarded AS (
        SELECT cur.*,
               CASE
                 WHEN cur.seller_uid <> $2::bigint AND NOT $11::boolean THEN 'not_owner'
                 WHEN cur.status NOT IN ('draft', 'listed') THEN 'status_not_editable'
                 WHEN $5::int IS NOT NULL AND $5::int IS DISTINCT FROM cur.stock AND cur.status <> 'listed' THEN 'stock_requires_listed'
                 WHEN (CASE WHEN $10::boolean THEN $9::text ELSE cur.item_condition END) IS NOT NULL
                      AND COALESCE(CASE WHEN $8::boolean THEN $7::text ELSE cur.item_type END, '')
                          NOT IN ('PhysicalFreeShip', 'PhysicalBuyerShip')
                      THEN 'condition_not_applicable'
                 -- ★ 0061（W3 / W7 · route §49.17.3）：显式 true ∧ 生效 stock <= 1 ⇒ 400 MULTI_BUY_NOT_APPLICABLE。
                 --   生效 stock = COALESCE(请求值 $5, 行内现值 cur.stock) ⇒ **只传 true、不带 stock**（行内 = 1）
                 --   这一臂（W7，最易漏）在此被抓住。★ 追加在既有四条之后 ⇒ 既有 outcome 优先级逐字不变。
                 WHEN $12::boolean IS TRUE AND COALESCE($5::int, cur.stock) <= 1 THEN 'multi_buy_not_applicable'
                 ELSE 'ok'
               END AS outcome
        FROM cur
      ),
      upd AS (
        UPDATE public.listing AS l
        SET description = COALESCE($3::text, l.description),
            price       = COALESCE($4::bigint, l.price),
            stock       = COALESCE($5::int, l.stock),
            media_urls  = COALESCE($6::text[], l.media_urls),
            item_type   = CASE WHEN $8::boolean THEN $7::text ELSE l.item_type END,
            item_condition = CASE WHEN $10::boolean THEN $9::text ELSE l.item_condition END,
            -- ★ 0061：$12 = NULL ⇒ 未传该键 ⇒ W5 归一（生效 stock <= 1 ⇒ false，否则保留现值，不 400）；
            --   $12 非 NULL ⇒ 落原值（true 的 stock<=1 情形已被 guarded 臂拦下）。
            allow_multi_buy = CASE
              WHEN $12::boolean IS NULL THEN (CASE WHEN COALESCE($5::int, l.stock) <= 1 THEN false ELSE l.allow_multi_buy END)
              ELSE $12::boolean
            END
        FROM guarded AS g
        WHERE l.listing_id = $1::bigint
          AND g.outcome = 'ok'
        RETURNING l.listing_id, split_part(l.description, E'\\n', 1) AS title, l.price, l.cid, l.status, l.stock,
                  l.media_urls, l.time_created, l.description, l.item_type, l.item_condition,
                  l.item_code, l.snowflake_id, l.allow_multi_buy,
                  g.description AS prev_description,
                  g.seller_uid,
                  array_remove(ARRAY[
                    CASE WHEN $3::text IS NOT NULL AND $3::text IS DISTINCT FROM g.description THEN 'description' END,
                    CASE WHEN $4::bigint IS NOT NULL AND $4::bigint IS DISTINCT FROM g.price THEN 'price' END,
                    CASE WHEN $5::int IS NOT NULL AND $5::int IS DISTINCT FROM g.stock THEN 'stock' END,
                    CASE WHEN $6::text[] IS NOT NULL AND $6::text[] IS DISTINCT FROM g.media_urls THEN 'media_urls' END,
                    CASE WHEN $8::boolean AND $7::text IS DISTINCT FROM g.item_type THEN 'item_type' END,
                    CASE WHEN $10::boolean AND $9::text IS DISTINCT FROM g.item_condition THEN 'item_condition' END,
                    -- ★ 0061：changed_fields = **实际变化集**（含 W5 归一带来的 false 落值 ——
                    --   管理员代编他人商品时，只把库存改成 1 也会真实改掉本列 ⇒ 必须入账）
                    CASE WHEN (CASE
                                 WHEN $12::boolean IS NULL THEN (CASE WHEN COALESCE($5::int, g.stock) <= 1 THEN false ELSE g.allow_multi_buy END)
                                 ELSE $12::boolean
                               END) IS DISTINCT FROM g.allow_multi_buy THEN 'allow_multi_buy' END
                  ], NULL::text) AS changed_fields,
                  'updated'::text AS outcome
      ),
      ins AS (
        INSERT INTO public.listing_edit_log (listing_id, actor_uid, owner_uid, admin_edit, changed_fields)
        SELECT u.listing_id, $2::bigint, u.seller_uid, true, u.changed_fields
        FROM upd AS u
        WHERE $11::boolean
          AND u.seller_uid <> $2::bigint
        RETURNING log_id
      )
      SELECT x.listing_id, x.title, x.price, x.cid, x.status, x.stock, x.media_urls,
             x.time_created, x.description, x.item_type, x.item_condition, x.item_code, x.snowflake_id,
             x.allow_multi_buy,
             x.prev_description, x.outcome,
             x.seller_uid, x.changed_fields,
             (SELECT count(*)::int FROM ins) AS edit_log_written
      FROM (
        SELECT u.listing_id, u.title, u.price, u.cid, u.status, u.stock, u.media_urls,
               u.time_created, u.description, u.item_type, u.item_condition, u.item_code, u.snowflake_id,
               u.allow_multi_buy,
               u.prev_description, u.outcome,
               u.seller_uid, u.changed_fields
        FROM upd AS u
        UNION ALL
        SELECT g.listing_id, split_part(g.description, E'\\n', 1) AS title, g.price, g.cid, g.status, g.stock, g.media_urls,
               g.time_created, g.description, g.item_type, g.item_condition, g.item_code, g.snowflake_id,
               g.allow_multi_buy,
               g.description, g.outcome,
               g.seller_uid, '{}'::text[] AS changed_fields
        FROM guarded AS g WHERE g.outcome <> 'ok'
      ) AS x
    `;

/**
 * ★ 0059：**管理员代编他人商品**的准入判定（唯一真源 · 纯函数）。
 *
 * 口径 = `adminAccess.can_access_admin ∧ (is_admin ∨ permissions ∋ 'manage_rewards')`
 *   （与 §6.1 `AdminAccessRecord` 同源；`can_access_admin` 的「有角色行」一支不含权限位时
 *   仍需 `manage_rewards` 明示 ⇒ **不放宽**：仅「能进后台」不等于「能改商品」）。
 * ★ 只吃 token 侧派生的 `adminAccess`（路由层注入），**任何来自 body/query 的声明都不进本函数**。
 * ★ 本函数只回答「是否具备管理员代编**资格**」；**是否真为他人商品**由 SQL 的 `seller_uid <> $2` 判
 *   —— 本人编辑走「本人」臂，与资格无关（⇒ 管理员编自己的商品同样零台账行）。
 */
export const LISTING_EDIT_ADMIN_PERMISSION = 'manage_rewards';

export interface ListingEditAdminAccess {
  can_access_admin?: boolean;
  is_admin?: boolean;
  permissions?: readonly string[];
}

export const isListingEditAdminAccess = (access?: ListingEditAdminAccess | null): boolean =>
  access?.can_access_admin === true
  && (access.is_admin === true || (access.permissions ?? []).includes(LISTING_EDIT_ADMIN_PERMISSION));

const normalizeListingOrderSoldRow = (row: RawRow): ListingOrderSoldRow => ({
  gID: toNumberValue(getValue(row, 'gID')),
  bID: toNumberValue(getValue(row, 'bID')),
  uID: toNumberValue(getValue(row, 'uID')),
  status: toStringValue(getValue(row, 'status')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_claimed: toTimestamp(getValue(row, 'time_claimed')),
  time_actived: toTimestamp(getValue(row, 'time_actived')),
});

const normalizeListingFavoriteRow = (row: RawRow): ListingFavoriteRow => ({
  fav_id: toNumberValue(getValue(row, 'fav_id')),
  listing_id: toNumberValue(getValue(row, 'listing_id')),
  title: toStringValue(getValue(row, 'title')),
  price: toNumberValue(getValue(row, 'price')),
  cid: toNumberValue(getValue(row, 'cid')),
  status: toStringValue(getValue(row, 'status')),
  media_urls: toStringArrayValue(getValue(row, 'media_urls')),
  time_created: toTimestamp(getValue(row, 'time_created')),
});

const normalizeListingFavoriteMutationRow = (row: RawRow): ListingFavoriteMutationRow => ({
  fav_id: toNumberValue(getValue(row, 'fav_id')),
  listing_id: toNumberValue(getValue(row, 'listing_id')),
  time_created: toTimestamp(getValue(row, 'time_created')),
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

// ============================================================================
// 媒体上传存储面（route-layer.spec v2.39 §48 / data-layer.spec v0.34 §40 · 迁移 0050）：
// 唯一写路径 = `createMedia`（POST /api/media 交入；内容寻址去重键 UNIQUE(sha256, size_bytes)
// 承重）· 唯一读路径 = `getMediaById`（公开读口 GET /api/media/:id 交入）。本表无更新 / 无删除口
// （一期 §40.2；清理策略 = B33 挂账）。bytea 以 hex 字符串 + 服务端 `decode(…,'hex')` 绑定
// （驱动无关：neon http / ws 两路径都收纯字符串参数，不经 Buffer 参数序列化路径）。
// ============================================================================

export interface MediaUploadRecord {
  media_id: number;
  sha256: string;
  content_type: string;
  size_bytes: number;
  owner_uid: number;
  time_created: string;
}

export interface MediaBinaryRecord {
  media_id: number;
  content_type: string;
  bytes: Buffer;
}

/** bytea 归一化：pg 二进制路径回 Buffer / Uint8Array；文本路径回 `\x<hex>`（pgwire 文本格式）。 */
const normalizeBytea = (value: unknown): Buffer => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') || value.startsWith('\\X') ? value.slice(2) : value;
    if (hex.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(hex)) return Buffer.from(hex, 'hex');
  }
  throw new Error('media.bytes column did not return binary data');
};

const normalizeMediaUploadRow = (row: RawRow): MediaUploadRecord => ({
  media_id: toNumberValue(getValue(row, 'media_id')),
  sha256: String(getValue(row, 'sha256')),
  content_type: String(getValue(row, 'content_type')),
  size_bytes: toNumberValue(getValue(row, 'size_bytes')),
  owner_uid: toNumberValue(getValue(row, 'owner_uid')),
  time_created: String(getValue(row, 'time_created')),
});

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

  static async getUserByEvm(evmAddress: string, ex?: SqlRunner): Promise<UserRecord | null> {
    // ★ P9⑤（`R-9-68`）：可选 `ex` 注入（供「注册真路径」探针在同一事务内走建户分支）；省略 ⇒ 自有连接。
    const sql = sqlFor(ex);
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
    const row = firstRow(await sql`
      SELECT u.*
      FROM "users" AS u
      WHERE lower(u.evm) = ${normalizedAddress}
      LIMIT 1
    `);

    return row ? normalizeUser(row) : null;
  }

  static async createUserByEvm(evmAddress: string, ex?: SqlRunner): Promise<UserRecord> {
    // ★ P9⑤（`R-9-68`）：可选 `ex` 注入（同上）。
    const sql = sqlFor(ex);
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

  static async findOrCreateUserByEvm(evmAddress: string, ex?: SqlRunner): Promise<UserRecord> {
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
    let user = await this.getUserByEvm(normalizedAddress, ex);

    if (!user) {
      user = await this.createUserByEvm(normalizedAddress, ex);
      // ★ P9⑤（`commission.spec §19.5⑦` + `R-9-57` + 需求 §6.2①）：**注册腿** —— 新用户注册
      //   即刻 `+signupBatt`（默认 30）batt → `batt_account`（batt 面零 kind · 沿 P9② 表形）。
      //   **仅首次注册**命中本分支（`getUserByEvm` 未命中才建户）；batt 腿再以幂等键
      //   `biz:invite:signup:<uid>` 兜底（重放不双发）。失败不阻断注册（沿 `touchUserLogin` 容错风格），
      //   但记录告警（诚实边界：见报告 §4.3）。
      await this.grantSignupInviteBatt(user.uID, ex).catch((error) => {
        console.warn('Failed to grant signup invite batt:', error);
      });
    }

    await this.touchUserLogin(user.uID).catch((error) => {
      console.warn('Failed to update user login time:', error);
    });

    return (await this.getUserById(user.uID)) || user;
  }

  /**
   * 账户设置写口（`POST /api/user/profile` 的唯一落库点）。
   *
   * ★ 2026-10-22 头像写口（Kevin：`/profile/settings` 要能改头像）：
   *   **三键全部按「是否给出」判增删**（has-flag），**不再用 `COALESCE($n, 列)`** ——
   *   `avatar_url` 的 `null` 是**真语义**（清空头像），COALESCE 词法上无法区分
   *   「未给 ⇒ 保留」与「给 null ⇒ 置空」。
   *     · `undefined` ⇒ 该列**不进 SET**（保留库内现值）；
   *     · `null`（仅 `avatar_url`）⇒ 显式 `= $n::text` 绑 NULL ⇒ 置空；
   *     · 字符串 ⇒ 原样写入（形状校验在路由层，服务层不解析 URL）。
   *   `bio` / `is_admin` 的旧行为逐字不变：`undefined` 不改、给了就写（`bio` 非空/超长等
   *   业务闸仍在路由层）。
   */
  static async updateUserProfile(
    uID: number,
    fields: { bio?: string; is_admin?: boolean; avatar_url?: string | null },
  ): Promise<UserRecord | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (fields.bio !== undefined) {
      params.push(fields.bio);
      assignments.push(`"bio" = $${params.length}`);
    }
    if (fields.is_admin !== undefined) {
      params.push(String(fields.is_admin));
      assignments.push(`"is_admin" = $${params.length}::boolean`);
    }
    if (fields.avatar_url !== undefined) {
      // `null` ⇒ 绑定 NULL（清空头像）；未给 ⇒ 本分支不执行（保留现值）
      params.push(fields.avatar_url);
      assignments.push(`"avatar_url" = $${params.length}::text`);
    }

    // 零字段 = 纯回读（路由层已保证「bio 与 avatar_url 至少给一个」；本分支只防呆，不写库）
    if (!assignments.length) {
      return this.getUserById(uID);
    }

    params.push(uID);
    const rows = await runSql(
      `UPDATE "users" AS u
          SET ${assignments.join(', ')}
        WHERE u.uid = $${params.length}
        RETURNING u.*`,
      params,
    );
    const row = rows[0];
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
   * 用户多币种余额读口（`GET /api/user/balances` 的落点）。
   *   · 取数 = `account JOIN currency`，**只出余额 > 0 的币种**（零余额 = 「用户没有这个币」⇒ 不出行）；
   *   · 顺序 = `cid` **升序**（`$` = cid 1 恒首位，其后按建币顺序），与前端分行渲染一致；
   *   · `balance` = `bigint` 经 `::text` 下发 ⇒ **字符串**（大数不丢精度；前端禁 `Number()` 截断）；
   *   · **纯 SELECT**（DL23）：无 DDL / 无懒开户 / 无 `upsert*`，`uid` 只由 token actor 传入。
   *   · `ex` 可注入（门在回滚事务内跑真路径，与 `getBttcState` 同体例）。
   */
  static async listUserBalances(
    uid: number,
    ex?: SqlRunner,
  ): Promise<Array<{ cid: number; symbol: string; name: string; balance: string }>> {
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      SELECT a."cid"::text AS cid,
             c."symbol"    AS symbol,
             c."name"      AS name,
             a."balance"::text AS balance
      FROM public.account AS a
      JOIN public.currency AS c ON c."cid" = a."cid"
      WHERE a."uid" = ${uid}
        AND a."balance" > 0
      ORDER BY a."cid" ASC
    `);
    return rows.map((row) => ({
      cid: Number(row.cid),
      symbol: String(row.symbol ?? ''),
      name: String(row.name ?? ''),
      balance: String(row.balance ?? '0'),
    }));
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

  /**
   * ★ FEED-RANK-v2 权重读口（`app_config.feed_score_weights` · 改权不改码）：
   *   每请求**单行 SELECT**、无进程内缓存（体例 = `isDetailViewDedupEnabled` / `AK2` 同族）；
   *   行缺席 / 字段缺失 / 值非法 ⇒ **逐项**回落默认（解析真源 = `parseFeedScoreWeights`）；
   *   读语句本身失败（DB 抖 / 传输错）⇒ **fail-open** 落默认 + warn：推荐态**绝不**因配置读坏而 5xx
   *   （推荐是首页主路径，可用性优先于配置精度；`source` 字段让调用方/门区分两种回落）。
   *   `ex` = 既有事务内执行口：门在事务内翻转配置行后读本方法 ⇒ 同一真源语句。
   */
  static async getFeedScoreWeights(ex?: SqlRunner): Promise<FeedScoreWeights> {
    let rawValue: unknown = null;
    try {
      const row = firstRow(await runSql(
        'SELECT value FROM public.app_config WHERE key = $1 LIMIT 1',
        [FEED_SCORE_WEIGHTS_KEY],
        ex,
      ));
      rawValue = row ? getValue(row, 'value') : null;
    } catch (error) {
      console.warn(
        '[feed.score] 读 app_config.feed_score_weights 失败 ⇒ 回落默认权重 '
        + JSON.stringify(DEFAULT_FEED_SCORE_WEIGHTS)
        + ' / '
        + String((error as { message?: unknown })?.message ?? error).slice(0, 160),
      );
      return defaultFeedScoreWeights();
    }
    const parsed = parseFeedScoreWeights(rawValue);
    if (rawValue !== null && rawValue !== undefined && parsed.overridden.length === 0) {
      console.warn(
        '[feed.score] app_config.feed_score_weights 无任何合法字段 ⇒ 回落默认权重 '
        + JSON.stringify(DEFAULT_FEED_SCORE_WEIGHTS)
        + ' / raw='
        + JSON.stringify(rawValue).slice(0, 200),
      );
    } else if (parsed.overridden.length > 0 && parsed.source === 'partial') {
      console.warn(
        '[feed.score] app_config.feed_score_weights 部分字段非法 ⇒ 逐项回落默认 / overridden='
        + JSON.stringify(parsed.overridden)
        + ' raw='
        + JSON.stringify(rawValue).slice(0, 200),
      );
    }
    return parsed;
  }

  /**
   * ★ FEED-SORT-v1 · 首页 / 商品列表读口（`/api/prize/all`、`/api/home` 共用）—— 改**排序轴**，不改行形状
   *   （唯一例外 = 2026-10-22 Kevin 改口后的加性契约键 `feed_score`）。
   *   `sort` ∈ `FEED_SORT_MODES`（`recommend` 缺省 / `new`）；缺参或非法值 ⇒ 回落 `recommend`
   *   （**路由层才是 400 闸**，服务层只做归一 —— 单一定义点，避免两处判据漂移）。
   *   · 分值 `feed_score` = FEED-RANK-v2 五因子加权（公式 / 口径见文件顶部常量块注释）：
   *       feed_score = w·recency + w·rating + w·wants + w·views + w·sale_rate（权重已归一化，来自
   *       `app_config.feed_score_weights`，缺行/非法 ⇒ 默认 0.40/0.20/0.15/0.15/0.10，逐项回落）；
   *       **两态无条件算、无条件下发**（`sort` 不影响分值 ⇒ `new` 也带真分值）。
   *   · `recommend` ⇒ `ORDER BY feed_score DESC, time_created DESC, listing_id DESC`；
   *   · `new` ⇒ ORDER BY 里 `CASE WHEN $sort='new' THEN 0.0 ELSE f.feed_score END` 取 0.0 ⇒ 退化为
   *       `time_created DESC, listing_id DESC`（与两键排序逐字等价）；
   *   · 两态共用同一条 SQL、同一行 ORDER BY 字面量 ⇒ 排序真源只有一处（无第二套实现）。
   *   三级 tie-break 全确定、可重复；**分页语义不变**（LIMIT/OFFSET 照旧）⇒ 前端无限滚动
   *   「下一页」不重不漏；**页面显示顺序由前端对已加载行重排**（服务端顺序与之解耦）。
   *   `feed_score` 是**唯一**派生输出列（`normalizeBrand` 逐键显式列举输出、无 spread ⇒ 只出这一键）；
   *   wants / views 的**原始值**不新增键（wants 走既有 `want_count` 口径，views 完全不出）。
   *   性能注记：分值两态都算 ⇒ rating 均星子查询 + 订单聚合各一次（后者已在 `so` 里预聚合）；
   *   真上量后另立单评估索引，本单不加索引 / 不加缓存。
   */
  static async listBrands(skip = 0, limit = 100, ex?: SqlRunner, sort: unknown = FEED_SORT_DEFAULT): Promise<BrandRecord[]> {
    const sql = sqlFor(ex);
    // 排序模式归一（非法 ⇒ 推荐）
    const feedSort = normalizeFeedSort(sort) ?? FEED_SORT_DEFAULT;
    // ★ 2026-10-22 改口：分值**无条件算**（`sort` 只影响 ORDER BY）⇒ 两态都要权重配置
    //   （原 `new` 态三元短路省一次往返的做法作废 —— 否则 new 态下发的 `feed_score` 是假分）。
    const feedWeightParams = (await this.getFeedScoreWeights(ex)).normalized;
    // P4-B1-c: prize→listing 读侧换表（bID←listing_id、points←price、name←title；description/status/
    // time_created/time_updated 同名核对）。旧 gift_counts/shard_counts/transfer_counts CTE 引用的
    // prize_item/shard/shard_transfer 在新 schema 无对应表（probe.json 三口径 42P01）
    // ⇒ 聚合键保留、值恒 0（不编值）。
    //
    // ★ FEED-RANK-v1（2026-10-19）：原 `ORDER BY l.listing_id`（升序）⇒ 永远先给最早发布，新发商品被
    //   LIMIT 挤掉（dev 26 件时首页只见 [1..8]，新发的 76 完全不可见）⇒ 改按复合分排序。
    // ★ FEED-RANK-v2（2026-10-22 Kevin 定权）：由「时间 + 质量」两因子扩为**五因子**
    //   （recency / rating / wants / views / sale_rate），权重集中在上方常量块、可按配置逐项覆盖。
    //
    // ★ FEED-PAGING-v1（2026-10-19）：**只列可展示商品** —— `WHERE l.status = 'listed'`。
    //   修前本函数不过滤 status ⇒ dev 库 26 行里 15 行 `draft` + 2 行 `delisted` 会漏进列表
    //   （用户面出现未上架 / 已下架商品）。本函数同时供 `/api/home` 与 `/api/prize/all`
    //   ⇒ 两个读口同批生效（**行为变更**：draft/delisted 不再出现在任何列表读口）。
    //   详情读口 `getBrandById` **不过滤**（下架商品详情仍可查看），本单不动。
    //   分页语义不变（LIMIT/OFFSET 不变）；零新路由 / 零迁移 / 零 DDL。
    const rows = extractRows(await sql`
      SELECT
        f.*
      FROM (
        SELECT
          -- ★★ 2026-10-20 Kevin 数据模型指令（listing.title 退场、正文并入 description）：
          --   原 l.* 换成**显式列清单**（不引 title 列）+ 派生 title = 描述首个换行之前
          --   （以 E 字符串换行作分隔符的 split_part，与 service 层 deriveListingTitle 同源）。
          --   显式清单同时消掉「0055 已 apply / 0056 未 apply 过渡态下 l.* 里仍有 title 列」与派生列
          --   **重名**的歧义（重复列名在 pg 行对象里谁胜出是实现细节，不可依赖）；DROP 后零 42P01。
          l.listing_id, l.seller_uid, l.cid, l.price, l.stock,
          split_part(l.description, E'\\n', 1) AS title,
          l.description, l.media_urls, l.status, l.create_key, l.ledger_event_keys,
          l.item_type, l.time_created, l.time_updated,
          -- ★ 迁移 0060：对外标识两列（页面地址码 + 雪花）—— feed 行键 48→50（两口同源加性键）
          l.item_code, l.snowflake_id,
          0::int AS stores_count,
          0::int AS claims_count,
          0::int AS activated_count,
          0::int AS current_shard_supply,
          0::int AS free_shards_distributed,
          -- ★ 2026-10-19 商品卡结构重定义：feed 行加性键 wants = 该商品收藏数
          --   （listing_favorite 按 listing 聚合；LEFT JOIN + COALESCE ⇒ 无收藏 ⇒ 0）。
          --   只发数字、不含收藏者身份 ⇒ 无权限 / 隐私面；零新路由 / 零迁移 / 零 DDL。
          COALESCE(fav.want_count, 0)::int AS want_count,
          u.evm AS seller_evm,
          u.avatar_url AS seller_avatar_url,
          -- 均星**裸值**（不 COALESCE）：credit 档位需区分「无评分（⇒ 'new'）」与「均 3 星（⇒ 'normal'）」；
          -- score 里的 COALESCE（中性 3 星）是排序口径，两者**独立**、不得互相替代。
          (SELECT avg(r.stars)::float8 FROM public.rating AS r WHERE r.ratee_uid = l.seller_uid) AS seller_rating_avg,
          -- ★ FEED-RANK-v2（五因子加权 · 权重 = 配置归一化后的值，见顶部常量块）：
          --   recency(发布时间) · rating(质量) · wants(收藏饱和) · views(浏览饱和) · sale_rate(成交率)
          --   ★ 2026-10-22 改口：公式**不再包 CASE**（分值两态都算、都下发 —— 前端排序依据）；
          --     sort 只进下方 ORDER BY 的 CASE ⇒ 排序轴与分值解耦。
          --   列名 feed_score = 下发给前端的契约键（归一器出 6 位小数串）。
          ${feedWeightParams.recency}::float8
            * (1.0 / (1.0 + GREATEST((EXTRACT(EPOCH FROM (now() - l.time_created)) / 86400.0)::float8, 0.0)))
          + ${feedWeightParams.rating}::float8
            * (
                COALESCE(
                  (SELECT avg(r.stars)::float8 FROM public.rating AS r WHERE r.ratee_uid = l.seller_uid),
                  ${FEED_RATING_NEUTRAL_STARS}::float8
                ) / 5.0
              )
          -- wants = c/(c+5)（无收藏 ⇒ 0；c=5 ⇒ .5；有界、抗长尾）
          + ${feedWeightParams.wants}::float8
            * (
                COALESCE(fav.want_count, 0)::float8
                / (COALESCE(fav.want_count, 0)::float8 + ${FEED_WANTS_SATURATION}::float8)
              )
          -- views = v/(v+100)（listing.view_count，迁移 0057；NULL / 负数 ⇒ 0）
          + ${feedWeightParams.views}::float8
            * (
                GREATEST(COALESCE(l.view_count, 0), 0)::float8
                / (GREATEST(COALESCE(l.view_count, 0), 0)::float8 + ${FEED_VIEWS_SATURATION}::float8)
              )
          -- sale_rate = 已售/(已售+库存)（已售 = status='paid' 的 quantity 之和；分母 0 ⇒ 0）
          + ${feedWeightParams.sale_rate}::float8
            * COALESCE(
                so.sold_qty::float8
                / NULLIF(so.sold_qty::float8 + GREATEST(l.stock, 0)::float8, 0.0),
                0.0
              )
          AS feed_score
        FROM listing AS l
        LEFT JOIN public.users AS u ON u.uid = l.seller_uid
        -- ★ 2026-10-19 商品卡结构重定义：收藏聚合（每个 listing 一行；无收藏的 listing 由
        --   COALESCE 兜 0）。聚合面只出 count，不出收藏者身份 ⇒ 无权限 / 隐私面。
        LEFT JOIN (
          SELECT listing_id, count(*)::int AS want_count
          FROM public.listing_favorite
          GROUP BY listing_id
        ) AS fav ON fav.listing_id = l.listing_id
        -- ★ FEED-RANK-v2：成交聚合（sale_rate 分子）。**口径**：只计 status = 'paid'
        --   （订单状态闭集 created/paid/refunded/cancelled 中唯一「已付款且未退款」稳态；
        --    未付 / 已退款 / 已取消一律不计），按 listing 预先 SUM(quantity) ⇒ 单行、无扇出。
        LEFT JOIN (
          SELECT listing_id, sum(quantity)::int AS sold_qty
          FROM public.listing_order
          WHERE status = 'paid'
          GROUP BY listing_id
        ) AS so ON so.listing_id = l.listing_id
        WHERE l.status = 'listed'
      ) AS f
      -- ★ 排序轴（sort 在 SQL 里**只出现这一次**）：recommend ⇒ feed_score DESC 三级序；
      --   new ⇒ CASE 取常量 0.0 ⇒ 该项零区分度 ⇒ 纯 time_created DESC, listing_id DESC。
      --   **与分值下发解耦**：feed_score 两态都算、都返回（前端排序依据）。
      --   服务端默认序 = 稳定全序（三级 tie-break 全确定）⇒ 无限滚动翻页不重不漏。
      ORDER BY (CASE WHEN ${feedSort}::text = 'new' THEN 0.0::float8 ELSE f.feed_score END) DESC,
               f.time_created DESC,
               f.listing_id DESC
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

  // ============================================================================
  // 本批五口 · 卖家轴两条交易读口 + 收藏三口（DatabaseService 层）
  //   · 路由面挂 requireActor，uid 恒取 token 侧 actor；本层不重复归属闸。
  //   · bigint id / price / cid 一律经归一器 Number 归一（既有纪律）。
  //   · 收藏三口无资金动作：不写 ledger、无幂等键；幂等承重墙 =
  //     listing_favorite 表级 UNIQUE(fav_uid, listing_id)（0047）。
  // ============================================================================

  /** 「我发布的」（GET /api/listing/mine）：listing.seller_uid = me **全状态行**（draft/listed/delisted/frozen 都回），listing_id 降序。 */
  static async listListingsBySeller(sellerUid: number, skip = 0, limit = 100, ex?: SqlRunner): Promise<ListingMineRow[]> {
    const sql = sqlFor(ex);
    // ★ S55：SELECT 加性两列 `description` / `item_type`（行键 8 → 10；既有 8 键位置与顺序一字未动）。
    // ★ P57（迁移 0057）：再加性一列 `item_condition`（行键 10 → 11，响应键 `condition`）——
    //   编辑页（/item/:id/edit）预填成色用；与编辑回执（`updateListingDetailsRow` 的 ListingMineRow
    //   同族）逐键一致。
    // ★★ 2026-10-20 Kevin 指令（title 退场、正文并入 description）：`title` 改为**派生列**
    //   = 描述首个换行之前（split_part）。本口对 title **列零引用** ⇒ 0056 DROP 后照跑、不会 42P01；
    //   响应形状与取值**逐字不变**（title 恒在场 = 首行文本；描述首行即标题）。
    const rows = extractRows(await sql`
      SELECT
        l.listing_id,
        split_part(l.description, E'\\n', 1) AS title,
        l.price,
        l.cid,
        l.status,
        l.stock,
        l.media_urls,
        l.time_created,
        l.description,
        l.item_type,
        l.item_condition,
        -- ★ 迁移 0060：对外标识两列（行键 11→13；位置追加在既有列之后、既有顺序不动）
        l.item_code,
        l.snowflake_id,
        -- ★ 迁移 0061：多件购买授权（行键 13→14；与编辑预填行逐键同族）
        l.allow_multi_buy
      FROM public.listing AS l
      WHERE l.seller_uid = ${sellerUid}::bigint
      ORDER BY l.listing_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizeListingMineRow);
  }

  /**
   * ★ S55（发布动作单）· P1-b′ **字段编辑**（`PATCH /api/listing/:listingId` 的字段支）。
   *
   * 与 `updateListingRow`（旧 `POST` 编辑面）**并存、互不改写**：本方法的差异只有三处 ——
   *   ① **可编辑态 = `draft|listed`**（旧面只禁 `delisted`）⇒ `frozen` 一并只读（`status_not_editable`）；
   *   ② 可改字段 = **`description / price / stock / media_urls / item_type`（无 `title`）** +
   *      `item_type` 区分「未传」与「显式置 NULL」（`itemTypeSet` 开关）+
   *      `item_condition`（P57 · 迁移 0057，第 6 可改字段；同体例 `conditionSet` 开关）；
   *   ③ 回执 = **`ListingMineRow` 同族**（与 `listListingsBySeller` 逐键一致，前端可整行替换）+ `prev` 旧描述。
   *
   * `ex`（可选）= 既有事务内执行口（承 `R-8-18`）：门探针在 `inRollbackTx` 内跑**同一份 SQL** ⇒ 真库读数、零残留。
   * 返回 `row = null` ⇒ listing 行不存在（由服务层落 404，沿用 `LEDGER_REF_NOT_FOUND`）。
   */
  static async updateListingDetailsRow(input: {
    listingId: number;
    actorUid: number;
    description: string | null;
    price: number | null;
    stock: number | null;
    mediaUrls: string[] | null;
    itemType: string | null;
    itemTypeSet: boolean;
    /** ★ 迁移 0057：`item_condition` 新值（`conditionSet = false` 时语句忽略本参数、保留行现值） */
    itemCondition: string | null;
    conditionSet: boolean;
    /**
     * ★ 迁移 0061（多件购买授权）：`allow_multi_buy` 新值 —— **`null` = 未传该键**（`$12` 占位）。
     *   · `null` ⇒ 语句按 W5 归一（生效 stock ≤ 1 ⇒ 落 `false`；否则保留现值）；
     *   · 非 null ⇒ 落原值（`true` 且生效 stock ≤ 1 已在服务层/SQL 守卫臂 ⇒ 400，不会走到这里）。
     *   服务层已把 JSON 非布尔（含 `null` 显式传值）在**入参闸**拦成 400，故 `null` 在这里只表示「未传」。
     */
    allowMultiBuy: boolean | null;
    /**
     * ★ 0059：token 侧管理员旗标（路由层注入 `actor.adminAccess`）—— 判定真源 =
     * `isListingEditAdminAccess`（本文件同源纯函数），落到 SQL 的 `$11` 放行位。
     * 省略 / `null` ⇒ 与 0058 及以前**逐字同行为**（`$11 = false` ⇒ 非本人仍 `not_owner`）。
     */
    adminAccess?: ListingEditAdminAccess | null;
  }, ex?: SqlRunner): Promise<{
    outcome: 'updated' | 'not_owner' | 'status_not_editable' | 'stock_requires_listed' | 'condition_not_applicable' | 'multi_buy_not_applicable';
    row: ListingMineRow | null;
    prev: { description: string } | null;
    /** ★ 0059：行快照的 `seller_uid`（`null` = 行不存在）—— 供服务层判「是否本人」/ 台账对拍 */
    sellerUid: number | null;
    /** ★ 0059：SQL 内算出的**实际变化字段名数组**（`[description, price, stock, media_urls, item_type, item_condition]` 子集，保序） */
    changedFields: string[];
    /** ★ 0059：本语句是否插了一条 `listing_edit_log`（1 = 管理员代编；0 = 本人编辑 / 未放行 / 行不存在） */
    editLogWritten: boolean;
  }> {
    const rows = await runSql(UPDATE_LISTING_DETAILS_SQL, [
      input.listingId,
      input.actorUid,
      input.description,
      input.price,
      input.stock,
      input.mediaUrls,
      input.itemType,
      input.itemTypeSet,
      input.itemCondition,
      input.conditionSet,
      isListingEditAdminAccess(input.adminAccess),
      // ★ 0061：$12 —— `null` = 未传该键（语句走 W5 归一）
      input.allowMultiBuy,
    ], ex);
    const row = rows[0] || null;
    if (!row) {
      return { outcome: 'updated', row: null, prev: null, sellerUid: null, changedFields: [], editLogWritten: false };
    }
    const outcome = String(getValue(row, 'outcome')) as
      'updated' | 'not_owner' | 'status_not_editable' | 'stock_requires_listed' | 'condition_not_applicable' | 'multi_buy_not_applicable';
    return {
      outcome,
      row: normalizeListingMineRow(row),
      prev: { description: toStringValue(getValue(row, 'prev_description')) },
      sellerUid: row.seller_uid === undefined || row.seller_uid === null ? null : Number(row.seller_uid),
      changedFields: toStringArrayValue(getValue(row, 'changed_fields')),
      editLogWritten: Number(getValue(row, 'edit_log_written') ?? 0) === 1,
    };
  }

  /**
   * ★ 0059 · **编辑页统一预填读口**（`GET /api/listing/:listingId/edit` 的 DB 侧单一真源）。
   *
   * 返回与 `listListingsBySeller`（`GET /api/listing/mine`）**同族 11 键行** + `seller_uid`
   *   （= 归属判定用的旁路键，**不进** 响应体；权限判定后再剥掉）。
   * 行不存在 ⇒ `null`（服务层落 404）。纯只读，零写、零锁（编辑页预填不需要行锁；真写口自带 `FOR UPDATE`）。
   */
  static async getListingEditRow(listingId: number, ex?: SqlRunner): Promise<{
    row: ListingMineRow;
    sellerUid: number;
  } | null> {
    const sql = sqlFor(ex);
    const rows = extractRows(await sql`
      SELECT
        l.listing_id,
        split_part(l.description, E'\\n', 1) AS title,
        l.price,
        l.cid,
        l.status,
        l.stock,
        l.media_urls,
        l.time_created,
        l.description,
        l.item_type,
        l.item_condition,
        -- ★ 迁移 0060：对外标识两列（与 mine 行逐键同族）
        l.item_code,
        l.snowflake_id,
        -- ★ 迁移 0061：多件购买授权（编辑预填必需 —— 只加 mine 漏 edit ⇒ 开关永远预填不到）
        l.allow_multi_buy,
        l.seller_uid
      FROM public.listing AS l
      WHERE l.listing_id = ${listingId}::bigint
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      row: normalizeListingMineRow(row),
      sellerUid: Number(getValue(row, 'seller_uid')),
    };
  }

  /**
   * ★ 迁移 0061 · **购买闸前置只读**（`POST /api/listing/:listingId/buy` 的唯一读点）。
   *
   * 只回答两件事：① `allow_multi_buy`（卖家是否授权一次买多件）；② `stock`（供后续诊断/回执口径）。
   *   · **零写、零锁**（`for update` 不在本方法 —— 真库存闸仍是资金链函数内的事）；
   *   · 行不存在 ⇒ `null`（**不在此落 404**：404 语义真源仍是 `listing_post_event` 的既有码，
   *     本方法只做「读到才判」⇒ 缺失时一律放行给 DB 函数，行为与改前逐字一致）；
   *   · `ex` = 既有事务内执行口（门探针在回滚事务里跑同一份语句）。
   * ★ 这不是授权真源、也不是库存真源：唯一硬闸仍是 `public.listing_post_event`；
   *   本方法只承载 route §49.17.4 的 B2 臂（`allow=false ∧ qty>1` ⇒ 400，零 DB 写）。
   */
  static async getListingBuyAuthRow(listingId: number, ex?: SqlRunner): Promise<{
    allowMultiBuy: boolean;
    stock: number;
    status: string;
  } | null> {
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      SELECT l.allow_multi_buy, l.stock, l.status
      FROM public.listing AS l
      WHERE l.listing_id = ${listingId}::bigint
      LIMIT 1
    `);
    if (!row) return null;
    return {
      allowMultiBuy: getValue(row, 'allow_multi_buy') === true,
      stock: toNumberValue(getValue(row, 'stock')),
      status: toStringValue(getValue(row, 'status')),
    };
  }

  /** 「我卖出的」（GET /api/listing-orders/sold）：listing_order.seller_uid = me，order_id 降序；行形与买家轴 listPrizeItemsByUser（GET /api/prize-item）同族 + status（time_claimed/time_actived 无对应列 ⇒ 恒 NULL → 0，同买家轴「不编值」口径）。 */
  static async listListingOrdersBySeller(sellerUid: number, skip = 0, limit = 100): Promise<ListingOrderSoldRow[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT
        o.order_id AS "gID",
        o.listing_id AS "bID",
        o.buyer_uid AS "uID",
        o.status,
        o.time_created,
        NULL::timestamptz AS time_claimed,
        NULL::timestamptz AS time_actived
      FROM listing_order AS o
      WHERE o.seller_uid = ${sellerUid}::bigint
      ORDER BY o.order_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizeListingOrderSoldRow);
  }

  /** 「我的收藏」（GET /api/favorites）：favorite 行 join listing 概要；按收藏时间降序（同刻并列以 fav_id DESC 稳定排序）。 */
  static async listFavoritesByUser(favUid: number, skip = 0, limit = 100): Promise<ListingFavoriteRow[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT
        f.fav_id,
        f.listing_id,
        -- ★ 2026-10-20：title 派生自描述首个换行之前（与 feed/详情/卖家轴同源；列已随 0056 DROP）
        split_part(l.description, E'\\n', 1) AS title,
        l.price,
        l.cid,
        l.status,
        l.media_urls,
        f.time_created
      FROM public.listing_favorite AS f
      JOIN public.listing AS l ON l.listing_id = f.listing_id
      WHERE f.fav_uid = ${favUid}::bigint
      ORDER BY f.time_created DESC, f.fav_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizeListingFavoriteRow);
  }

  /**
   * 收藏（POST /api/favorites）：幂等唯一权威 = `listing_favorite` 表级 UNIQUE(fav_uid, listing_id)
   * （0047 承重墙）。单语句三态：
   *   · 'inserted'  —— 新落一行；
   *   · 'existing'  —— 撞唯一约束 ⇒ 取既有行（重复收藏不落第二行，同 createListingRow 手法）；
   *   · 'listing_missing' —— listing 行不存在 ⇒ 0 行返回（路由层落 404）。
   * 注：同一语句内各部分共用同一快照 ⇒ 主查询不会看到本语句 CTE 刚插入的行，
   *     'inserted' 分支不会与 'existing' 分支重复出 row。
   */
  static async createFavoriteRow(input: {
    favUid: number;
    listingId: number;
  }): Promise<{ outcome: 'inserted' | 'existing' | 'listing_missing'; row: ListingFavoriteMutationRow | null }> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH ins AS (
        INSERT INTO public.listing_favorite (fav_uid, listing_id)
        SELECT ${input.favUid}::bigint, ${input.listingId}::bigint
        WHERE EXISTS (
          SELECT 1 FROM public.listing AS l WHERE l.listing_id = ${input.listingId}::bigint
        )
        ON CONFLICT (fav_uid, listing_id) DO NOTHING
        RETURNING fav_id, fav_uid, listing_id, time_created, 'inserted'::text AS outcome
      )
      SELECT i.fav_id, i.fav_uid, i.listing_id, i.time_created, i.outcome
      FROM ins AS i
      UNION ALL
      SELECT e.fav_id, e.fav_uid, e.listing_id, e.time_created, 'existing'::text AS outcome
      FROM public.listing_favorite AS e
      WHERE e.fav_uid = ${input.favUid}::bigint
        AND e.listing_id = ${input.listingId}::bigint
    `);
    const row = rows[0] || null;
    if (!row) return { outcome: 'listing_missing', row: null };
    const outcome = String(getValue(row, 'outcome'));
    if (outcome === 'inserted') return { outcome: 'inserted', row: normalizeListingFavoriteMutationRow(row) };
    return { outcome: 'existing', row: normalizeListingFavoriteMutationRow(row) };
  }

  /** 取消收藏（DELETE /api/favorites/:listingId）：幂等 —— 删 0 行（从未收藏 / 已删）也回成功；返回实际删除行数。 */
  static async deleteFavoriteRow(input: {
    favUid: number;
    listingId: number;
  }): Promise<number> {
    const sql = getSql();
    const rows = extractRows(await sql`
      DELETE FROM public.listing_favorite
      WHERE fav_uid = ${input.favUid}::bigint
        AND listing_id = ${input.listingId}::bigint
      RETURNING fav_id
    `);

    return rows.length;
  }

  // P4-B1-b: 空态任务（完整 TaskRecord 键集），GET miss 回退用（类比 B1-a emptyAsset）；纯内存、零写库
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
  // 商品发布页币种下拉（Kevin 2026-10-19）· 读口 `GET /api/currencies` 的 DB 侧取数
  //   公开只读（无鉴权闸）：只列 `status = 'listed'` 的币种，供 `item-select-cid` 选项使用。
  //   data 行键集自本单起冻结 = **恰三键**：cid / symbol / name（**不**外泄 owner_uid /
  //   deposit_amount 一类后台字段，与 §23.2 的后台读口区分开）。
  //   ★ 只读（只 `SELECT`）；零写、零 DDL；**不得**借读口补写（`DL23` 同向）。
  // ==========================================================================================
  static async listListedCurrencies(): Promise<RawRow[]> {
    const rows = await runSql(
      `SELECT c.cid AS cid,
              c.symbol AS symbol,
              c.name AS name
         FROM public.currency AS c
        WHERE c.status = 'listed'
        ORDER BY c.cid`,
      [],
    );
    return rows;
  }

  // ==========================================================================================
  // 批 8⑤（`route-layer.spec` v2.10 §25.2）· 读口 `GET /api/admin/listing` 的 DB 侧取数
  //   data 键集自 §25.2 起冻结（承 `§24.8(b)`）：listing_id / seller_uid / cid / price / stock /
  //   title / status / time_created。只读（只 `SELECT`）；非法 `status` 由**服务层**判 `400`，
  //   **不得静默回落**；**不得**借读口补写（`DL23` 同向）。
  // ★ 2026-10-20（title 退场）：键名 `title` 保留，值改为**派生** = 描述首个换行之前（split_part），
  //   本口对 title 列零引用 ⇒ 0056 DROP 后照跑；键集与顺序不动（零计数前推）。
  // ==========================================================================================
  static async listListingsForAdmin(statusFilter: string | null): Promise<RawRow[]> {
    const rows = await runSql(
      `SELECT l.listing_id  AS listing_id,
              l.seller_uid  AS seller_uid,
              l.cid         AS cid,
              l.price       AS price,
              l.stock       AS stock,
              split_part(l.description, E'\\n', 1) AS title,
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
  /**
   * ★ 8⑥ 审计台统一读口（`GET /api/admin/audit/:table` · `route-layer.spec` v2.21 §32.14
   * `R-9-74`/`R-9-77`/`R-9-78`/`R-9-79`）：**唯一取数口** = 按 `audit-console.ts` 的白名单映射
   * 生成的参数化语句执行（`sqlText` 的**表名 / 列名一律取自白名单映射**，请求值只进 `params`）。
   * **只读**（§32.10）：只执行 `SELECT`；不动任何 `append-only` 留痕面；不新造第二写入面。
   * `sqlText` 由 `buildAuditSql`（同批次单一真源）产出 ⇒ 本方法**不自拼**任何 SQL。
   */
  static async readAuditPage(sqlText: string, params: unknown[]): Promise<RawRow[]> {
    return runSql(sqlText, params);
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

  /** P1-a 上架：幂等 = `listing.create_key` UNIQUE（同键 ⇒ `existing`，由 service 判重放 / 冲突）
   *  ★ 2026-10-20 商品分类枚举（迁移 0053）：`itemType` 可选（`null` = 未分类）；分类**只在创建时定**，
   *  编辑（`updateListingRow`）与状态迁移都不写该列 ⇒ 本函数是 `item_type` 的**唯一写点**。
   *  ★ 迁移 0060（Kevin 2026-10-20 第 3 条「统一商品 Id」）：对外标识两列由**服务层生成后传入**
   *  （`snowflakeId` / `itemCode`）—— 本层**不设 DB default、不自行发号**：发号策略只在
   *  `item-id.ts` 一处（可单测、可在门里注入），本层只负责写。 */
  static async createListingRow(input: {
    sellerUid: number;
    cid: number;
    price: number;
    stock: number;
    /** ★ 已退场（2026-10-20）：标题 = 描述首个换行之前，由下方 SQL 派生 ⇒ 本入参**无 title** */
    description: string;
    mediaUrls: string[];
    itemType: string | null;
    /** ★ 商品成色（迁移 0057）：可空；非空仅实物两分类（服务层 applicability 闸已把关，本层直存） */
    itemCondition: string | null;
    createKey: string;
    /** ★ 迁移 0060：snowflake 以**字符串**传入（bigint 超出 JS 安全整数 ⇒ 全程不落 Number） */
    snowflakeId: string;
    /** ★ 迁移 0060：7 位页面地址码（字母表/唯一性由 `item-id.ts` + DB 唯一索引双闸） */
    itemCode: string;
    /**
     * ★ 迁移 0061 多件购买授权（route §49.17.2 / data §40.13）：服务层已按 W1–W7 归一后的**真布尔**
     *   （未传 ⇒ `false`；显式 `true` 且 `stock <= 1` 已在服务层 400、到不了本层）。
     *   本层只落值、不判业务（归一是写口唯一不变式）。
     */
    allowMultiBuy: boolean;
  }, ex?: SqlRunner): Promise<{ outcome: 'inserted' | 'existing'; row: RawRow }> {
    const sql = sqlFor(ex);
    // ★★ 2026-10-20 Kevin 数据模型指令（`listing.title` 退场、正文并入 `description`）：
    //   本语句对 `title` **列零引用**（INSERT 列清单 / CTE 取列 / RETURNING 全去），响应键 `title`
    //   一律**派生** `split_part(description, E'\n', 1)`（与读口 / `deriveListingTitle` 同源）
    //   ⇒ 0056 DROP 后照跑、不会 42P01；行键集与顺序**逐字不变**。
    // ★ 迁移 0060：两列追加在既有列之后（INSERT 列清单 / existing 取列 / RETURNING / 外层 SELECT
    //   一律**尾部追加** ⇒ 既有 12 键位置与顺序不动；新增两键 = 回执可直接带出页面地址）。
    const rows = extractRows(await sql`
      WITH existing AS (
        SELECT listing_id, seller_uid, cid, price, stock, description, media_urls, item_type, status, create_key,
               snowflake_id, item_code
        FROM public.listing
        WHERE create_key = ${input.createKey}::text
      ),
      ins AS (
        INSERT INTO public.listing (seller_uid, cid, price, stock, description, media_urls, item_type, item_condition, status, create_key, snowflake_id, item_code, allow_multi_buy)
        SELECT ${input.sellerUid}::bigint, ${input.cid}::bigint, ${input.price}::bigint, ${input.stock}::int, ${input.description}::text, ${input.mediaUrls}::text[], ${input.itemType}::text, ${input.itemCondition}::text, 'draft', ${input.createKey}::text, ${input.snowflakeId}::bigint, ${input.itemCode}::char(7), ${input.allowMultiBuy}::boolean
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING listing_id, seller_uid, cid, price, stock, description, media_urls, item_type, status, create_key, snowflake_id, item_code, 'inserted'::text AS outcome
      )
      SELECT i.listing_id, i.seller_uid, i.cid, i.price, i.stock,
             split_part(i.description, E'\\n', 1) AS title,
             i.description, i.media_urls, i.item_type, i.status, i.create_key, i.snowflake_id, i.item_code, i.outcome
      FROM ins AS i
      UNION ALL
      SELECT e.listing_id, e.seller_uid, e.cid, e.price, e.stock,
             split_part(e.description, E'\\n', 1) AS title,
             e.description, e.media_urls, e.item_type, e.status, e.create_key, e.snowflake_id, e.item_code, 'existing'::text
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
    /** ★ 已退场（2026-10-20）：标题 = 描述首个换行之前，SQL 派生 ⇒ 入参无 title、SET 无 title */
    description: string | null;
    mediaUrls: string[] | null;
  }): Promise<{ outcome: 'updated' | 'not_owner' | 'stock_requires_listed' | 'delisted_terminal'; row: RawRow | null }> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH cur AS (
        SELECT listing_id, seller_uid, cid, price, stock, description, media_urls, status, create_key
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
            description  = COALESCE(${input.description}::text, l.description),
            media_urls   = COALESCE(${input.mediaUrls}::text[], l.media_urls)
        WHERE l.listing_id = ${input.listingId}::bigint
          AND (SELECT g.outcome FROM guarded AS g) = 'ok'
        RETURNING l.listing_id, l.seller_uid, l.cid, l.price, l.stock, split_part(l.description, E'\\n', 1) AS title, l.description, l.media_urls, l.status, l.create_key, 'updated'::text AS outcome
      )
      SELECT u.listing_id, u.seller_uid, u.cid, u.price, u.stock, u.title, u.description, u.media_urls, u.status, u.create_key, u.outcome
      FROM upd AS u
      UNION ALL
      SELECT g.listing_id, g.seller_uid, g.cid, g.price, g.stock, split_part(g.description, E'\\n', 1) AS title, g.description, g.media_urls, g.status, g.create_key, g.outcome
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
        SELECT listing_id, seller_uid, cid, price, stock, description, media_urls, status, create_key
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
        RETURNING l.listing_id, l.seller_uid, l.cid, l.price, l.stock, split_part(l.description, E'\\n', 1) AS title, l.description, l.media_urls, l.status, l.create_key, 'updated'::text AS outcome
      )
      SELECT u.listing_id, u.seller_uid, u.cid, u.price, u.stock, u.title, u.description, u.media_urls, u.status, u.create_key, u.outcome
      FROM upd AS u
      UNION ALL
      SELECT g.listing_id, g.seller_uid, g.cid, g.price, g.stock, split_part(g.description, E'\\n', 1) AS title, g.description, g.media_urls, g.status, g.create_key, g.outcome
      FROM guarded AS g WHERE g.outcome <> 'ok'
    `);
    const row = rows[0] || null;
    if (!row) return { outcome: 'updated', row: null };
    const outcome = String(getValue(row, 'outcome'));
    if (outcome === 'updated') return { outcome: 'updated', row };
    return { outcome: outcome as 'not_owner' | 'invalid_transition', row };
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

  /**
   * §4.2 M3 / **D-1 的服务面派生位**（`market-service.ts` 文件头既有注释位兑现；**只读**）：
   * taker 订单的**下一个 `fill_no`** = 该 taker 已落账成交笔数 + 1。
   * 计数口径 = `ledger_entry` 里 `ref_type='market_trade'` 且事件根键命中
   * `biz:market:trade:<taker_order_id>:<fill_no>` 前缀（`0016:382` 键形状 / `0016:865` ref 落列）的
   * **DISTINCT event_root_key** 数 —— 每笔成交事件恰一次 `market_trade` 引用，重放不新增键
   * ⇒ 同一次撮合决策的重投计数不变，幂等键稳定；**本方法不派生任何业务内容、不写库**。
   * 专供撮合**循环**编排（`matchTakerOrderLoop`）；M3 单笔动词仍维持 **D-1 fail-loud（fill_no 必填）**。
   */
  static async resolveNextFillNo(takerOrderId: number): Promise<number> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT count(DISTINCT e.event_root_key)::int AS fills
        FROM public.ledger_entry e
       WHERE e.ref_type = 'market_trade'
         AND e.event_root_key LIKE 'biz:market:trade:' || ${takerOrderId}::text || ':%'
    `);
    const fills = Number(getValue(row ?? {}, 'fills') ?? 0);
    return Number.isFinite(fills) && fills >= 0 ? fills + 1 : 1;
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

  /**
   * ★ 迁移 0060（Kevin 2026-10-20 第 3 条）：`item_code` → `listing_id` 解析（页面地址 → 内部键）。
   *
   * 路由层判据（`GET /api/prize/:ref`）：**全数字 ⇒ 按 `listing_id`**（向后兼容既有 `bID` 链接）；
   * **否则 ⇒ 按 `item_code`**（7 位字母数字，`isItemCode` 先校验形状）⇒ 本方法只做后者。
   *   · 命中 ⇒ `listing_id`；未命中 ⇒ `null`（路由落既有 404，**不区分**「码不存在」与「码非法」）；
   *   · `item_code` 是 `char(7)`：入参先按 `char(7)` 绑定（7 位输入 = 原样，索引可用）；
   *   · 只读单行 SELECT，零锁、零副作用（详情自增仍只发生在 `getPrizeDetailRecordingView`）；
   *   · `ex` = 既有事务内执行口（门探针在回滚事务里跑同一份语句）。
   */
  static async getListingIdByItemCode(itemCode: string, ex?: SqlRunner): Promise<number | null> {
    const text = typeof itemCode === 'string' ? itemCode.trim() : '';
    if (text.length !== 7) return null;
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      SELECT listing_id FROM public.listing WHERE item_code = ${text}::char(7) LIMIT 1
    `);
    return row ? Number(getValue(row, 'listing_id')) : null;
  }

  static async getBrandById(bID: number): Promise<BrandRecord | null> {
    const sql = getSql();
    // P4-B1-c: prize→listing 读侧换表（单行，bID=listing_id）；旧 selected_prize/gift_counts/shard_counts/
    // transfer_counts CTE 的表在新 schema 无对应 ⇒ 聚合键保留、值恒 0。miss ⇒ null（路由层 404 语义保留）。
    const row = firstRow(await sql`
      SELECT
        -- ★★ 2026-10-20 Kevin 数据模型指令（title 退场、正文并入 description）：显式列清单
        --   （不引 title 列）+ 派生 title = 描述首个换行之前（与 feed 口 / service 层同源）。
        l.listing_id, l.seller_uid, l.cid, l.price, l.stock,
        split_part(l.description, E'\\n', 1) AS title,
        l.description, l.media_urls, l.status, l.create_key, l.ledger_event_keys,
        l.item_type, l.time_created, l.time_updated,
        -- ★ 迁移 0060：对外标识两列（与 feed 同源加性键）
        l.item_code, l.snowflake_id,
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

  /**
   * ★ P57 详情浏览计数（Kevin 2026-10-20 详情页改版 · 后端件 · 迁移 0057）：
   *   详情读口（`GET /api/prize/:bID`）专用「自增 + 读」**单语句 CTE** ——
   *   `WITH bumped AS (UPDATE … RETURNING)` 先自增（自增语句见方法体，全仓唯一一处），
   *   外层 SELECT 经 JOIN 读回**自增后**的值（`b.view_count`）与其余列（外层读 l 的行快照；
   *   UPDATE 不改其它列 ⇒ 无读偏）。单语句 = 原子（隐式事务），即「自增后读」口径。
   *   · 行不存在 ⇒ `bumped` 空 ⇒ 返回 null（路由层 404 语义保留；UPDATE 0 行 ⇒ **不计数**）；
   *   · 简单计数口径：**任何状态都计**（不过滤 status，直链 draft 仍可看）、**不区分访问者**、
   *     **卖家自看也计**（去重 / 自看排除策略挂 OPEN-ITEMS 待裁）；
   *   · 行键 = `getBrandById` 同款显式清单 + `l.item_condition`（成色，响应键 `condition`）+ `b.view_count`
   *     + `want_count`（收藏计数 left join，**与 feed `listBrands` 同源**，响应键 `wants`）
   *     ⇒ 归一后详情 data 顶层 47→**50**（+`views` +`condition` +`wants`；service 层 49 键，
   *     路由层合成 `seller` ⇒ 50）；feed（`listBrands`）不选这三列 ⇒ 行键 48 不变；
   *   · 与 `getBrandById`（创建回执等共用、**不计数**、不带三加性键）分离：只有本方法计数并透出
   *     `views`/`condition`/`wants`，其余读面零影响；
   *   · `ex` = 既有事务内执行口（`sqlFor` 同族体例，承 R-8-18「单一真源」）：离线门把它路由进
   *     `inRollbackTx` 客户端干跑（迁移先在事务内 ADD COLUMN ⇒ 零 apply / 零残留）；生产路径不传 ⇒ `getSql()`。
   */
  static async getPrizeDetailRecordingView(bID: number, ex?: SqlRunner): Promise<BrandRecord | null> {
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      WITH bumped AS (
        UPDATE listing
        SET view_count = view_count + 1
        WHERE listing_id = ${bID}
        RETURNING listing_id, view_count
      )
      SELECT
        -- 显式列清单与 getBrandById 同款（不引 title 列）+ 派生 title = 描述首个换行之前；
        -- 加选 l.item_condition（迁移 0057 成色）、b.view_count（自增后浏览计数）与
        -- want_count（收藏计数，LEFT JOIN + COALESCE ⇒ 无收藏 ⇒ 0，与 feed 同一聚合形态）。
        l.listing_id, l.seller_uid, l.cid, l.price, l.stock,
        split_part(l.description, E'\\n', 1) AS title,
        l.description, l.media_urls, l.status, l.create_key, l.ledger_event_keys,
        l.item_type, l.item_condition, l.time_created, l.time_updated,
        -- ★ 迁移 0060：对外标识两列（详情与 feed 同形；+item_code +snowflake_id ⇒ 详情 50→52）
        l.item_code, l.snowflake_id,
        -- ★ 迁移 0061：多件购买授权（+1 键 ⇒ 详情 52→53；真布尔直出）
        l.allow_multi_buy,
        b.view_count AS view_count,
        COALESCE(fav.want_count, 0)::int AS want_count,
        0::int AS stores_count,
        0::int AS claims_count,
        0::int AS activated_count,
        0::int AS current_shard_supply,
        0::int AS free_shards_distributed
      FROM listing AS l
      JOIN bumped AS b ON b.listing_id = l.listing_id
      -- ★ wants 与 feed 同源：listing_favorite 按 listing 聚合（每 listing 至多一行）；
      --   聚合面只出 count、不含收藏者身份 ⇒ 无权限 / 隐私面。
      LEFT JOIN (
        SELECT listing_id, count(*)::int AS want_count
        FROM public.listing_favorite
        GROUP BY listing_id
      ) AS fav ON fav.listing_id = l.listing_id
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

  /**
   * ★ P58 浏览去重开关读（迁移 0058 · Kevin 2026-10-20「后台开关」）：每请求单行 SELECT
   *   `app_config` 行 `detail_view_dedup` 的 `dedup` 字段（体例 = `AK2` / `batt_policy` 同族的
   *   **每请求读、无进程内缓存**）。行缺席 / 字段缺席 / 闭集外值 ⇒ fail-safe 默认 on（去重，
   *   解析唯一真源 = `parseDetailViewDedupSwitch`）；**当前配置 = off**（迁移落行 ⇒ 现状不去重）。
   *   `ex` = 既有事务内执行口（`R-8-18`）：门探针在事务内翻转配置行后读本方法 ⇒ 同一真源语句。
   */
  static async isDetailViewDedupEnabled(ex?: SqlRunner): Promise<boolean> {
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      SELECT value ->> ${DETAIL_VIEW_DEDUP_FIELD}::text AS dedup
      FROM public.app_config
      WHERE key = ${DETAIL_VIEW_DEDUP_KEY}
      LIMIT 1
    `);
    return parseDetailViewDedupSwitch(row ? getValue(row, 'dedup') : undefined);
  }

  /**
   * ★ P58 去重日志落行（on 分支判定写）：同访客×同商品×同天至多一行（真源 = 具名约束
   *   `listing_view_log_uniq`，迁移 0058）。
   *   · `INSERT … SELECT … WHERE EXISTS(listing)` ⇒ **404 不写日志**（商品行不存在 ⇒ 零行插入）；
   *   · `ON CONFLICT ON CONSTRAINT listing_view_log_uniq DO NOTHING` + `RETURNING` ⇒
   *     有返回行 = 本次插入成功（新访客 / 新一天）⇒ `true`；空 = 当天已见（唯一约束冲突）⇒ `false`；
   *   · 不建 FK（迁移 0058 取舍）：历史商品删除不阻碍日志保留；
   *   · 抛错由调用方 `getPrizeDetailViewWithViewer` fail-open 承接（日志失败不阻塞详情）。
   */
  static async recordDetailViewLog(bID: number, viewerKey: string, ex?: SqlRunner): Promise<boolean> {
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      INSERT INTO public.listing_view_log (listing_id, viewer_key)
      SELECT ${bID}, ${viewerKey}
      WHERE EXISTS (SELECT 1 FROM public.listing WHERE listing_id = ${bID})
      ON CONFLICT ON CONSTRAINT listing_view_log_uniq DO NOTHING
      RETURNING listing_id
    `);
    return row !== null;
  }

  /**
   * ★ P58 已见访客**只读臂**（不增不写）：列清单 = `getPrizeDetailRecordingView` 外层 SELECT 同款
   *   （+views +condition +wants ⇒ service 层 49 键同形），`view_count` **直读现值**、
   *   无 `bumped` CTE、零自增（全仓自增语句仍恰 1 处 —— 单一真源不破）。
   *   ⚠️ 两臂键形一致性由 p58 门同源断言；改详情列清单须两处同步。
   */
  static async getPrizeDetailReadOnly(bID: number, ex?: SqlRunner): Promise<BrandRecord | null> {
    const sql = sqlFor(ex);
    const row = firstRow(await sql`
      SELECT
        l.listing_id, l.seller_uid, l.cid, l.price, l.stock,
        split_part(l.description, E'\\n', 1) AS title,
        l.description, l.media_urls, l.status, l.create_key, l.ledger_event_keys,
        l.item_type, l.item_condition, l.time_created, l.time_updated,
        -- ★ 迁移 0060：对外标识两列（只读臂与自增臂**同列清单**，键形一致性由门断言）
        l.item_code, l.snowflake_id,
        -- ★ 迁移 0061：多件购买授权（两臂同列清单 ⇒ 键形一致；只读臂不增计数、照常带本键）
        l.allow_multi_buy,
        l.view_count AS view_count,
        COALESCE(fav.want_count, 0)::int AS want_count,
        0::int AS stores_count,
        0::int AS claims_count,
        0::int AS activated_count,
        0::int AS current_shard_supply,
        0::int AS free_shards_distributed
      FROM listing AS l
      LEFT JOIN (
        SELECT listing_id, count(*)::int AS want_count
        FROM public.listing_favorite
        GROUP BY listing_id
      ) AS fav ON fav.listing_id = l.listing_id
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

  /**
   * ★ P58 on 分支编排（路由层开关 on 时走本口）：
   *   · 落去重日志（`recordDetailViewLog`）→ 有返回行（新访客/新一天）⇒ 走既有「自增 + 读」专用口
   *     `getPrizeDetailRecordingView`（**同一自增语句**，不二写自增面）；
   *   · 冲突（当天已见）⇒ `getPrizeDetailReadOnly`（只读不增）；
   *   · 日志写失败 ⇒ **fail-open**：不阻塞详情返回、按「新访客」落旧口径自增（与 off 模式同形；
   *     反例 fail-closed = 因日志挂而整读挂，违背「日志失败不阻塞详情」）；
   *   · `viewerKey` = 路由层解析（`uid:<id>` 登录 / `anon:<x-sf-viewer 头或 sf_viewer cookie>` 匿名）；
   *     空/缺失 ⇒ 防御性落旧口径自增（理论不达：on 时路由必解出一个 key）。
   */
  static async getPrizeDetailViewWithViewer(bID: number, viewerKey: string | null, ex?: SqlRunner): Promise<BrandRecord | null> {
    if (!viewerKey) {
      return this.getPrizeDetailRecordingView(bID, ex);
    }

    let logged: boolean | null;
    try {
      logged = await this.recordDetailViewLog(bID, viewerKey, ex);
    } catch {
      logged = null; // fail-open：日志失败不阻塞详情返回、按新访客自增
    }

    return logged === false
      ? this.getPrizeDetailReadOnly(bID, ex)
      : this.getPrizeDetailRecordingView(bID, ex);
  }

  /**
   * `GET /api/prize/all` 读口（薄壳）：`sort` 透传给 `listBrands`（`recommend` 缺省 / `new` 纯时间降序）。
   * 语义/口径（五因子、权重配置、tie-break）全部在 `listBrands` 一处，本方法**零业务**。
   */
  static async listPrizes(
    skip = 0,
    limit = 100,
    sort: unknown = FEED_SORT_DEFAULT,
    ex?: SqlRunner,
  ): Promise<PrizeRecord[]> {
    return this.listBrands(skip, limit, ex, sort);
  }

  static async getPrizeById(bID: number): Promise<PrizeRecord | null> {
    // ★ P57：详情读口（GET /api/prize/:bID）已换 `getPrizeDetailRecordingView`（浏览计数 + 成色）。
    //   本方法 = **不计数**的裸读（创建回执等内部共用），勿再用于详情路由（否则浏览计数断链）。
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

  // ==========================================================================
  // ★★ 批 9 第 5 片（P9⑤ · `commission.spec` v0.4 §19.5⑦ + `R-9-57`/`R-9-65` · 需求 §6.2 ·
  //    `data-layer.spec` v0.26 §34.3 · `route-layer.spec` v2.19 §31）：
  //   **§6.2 两条一次性奖励** —— ① 注册腿（`signupBatt` → `batt_account`）；
  //   ② 首任务腿（`firstTaskUsd` → 完成首任务者本人 + 其直接上级 `parent_uid` 各一份 · `$`）。
  // --------------------------------------------------------------------------
  // · 配置面：键 `invite_reward_policy`（`B3`，`database.ts:73`）；字段闭集 `{signupBatt, firstTaskUsd,
  //   rewardLevels}`（`:167-169`）；域 `POSITIVE_INT`（`:200-203`）⇒ 解析器 `resolveInviteRewardPolicy`
  //   （fail-closed 到 `INVITE_REWARD_POLICY_DEFAULTS`）。
  // · 注册腿 = **batt 面零 kind**（写 `batt_account` + `batt_entry` · 沿 P9② 表形）；幂等键
  //   `biz:invite:signup:<uid>`；**仅首次注册**触发（`findOrCreateUserByEvm` 建户分支）。
  // · 首任务腿 = **唯一写入面 `ledger_post_event`**（`R-9-65`：资金来源 = `uid = −1` 平台收入账户
  //   出账；kind = `invite_first_task_reward`）；幂等键 `biz:invite:firsttask:<worker_uid>`
  //   （「首个」= 首个提交本键的结算动作，重放即成功不双发）；**无上级 ⇒ 只发本人、平台不吞**。
  //   ★ 本方法 = 可调用 / 可质检入口；**接线点**见报告 §4.4（`reviewJobSubmission` settle 成功后）。
  // ==========================================================================

  /**
   * **注册腿写入**（`R-9-57` · 需求 §6.2①）：`+signupBatt` batt → `batt_account`（封顶 `BATT_CAP_HARD_MAX`）。
   * 单语句 CTE（batt 面零 kind）：`batt_account`（`ON CONFLICT (uid) DO UPDATE`）+ `batt_entry`
   * （`reason = 'invite_signup'`、幂等键 `biz:invite:signup:<uid>`、`batt_after ∈ [0,100]`）。
   * 幂等：同键重放不双发；`prior` 在场 ⇒ 整条语句零副作用。
   */
  static async grantSignupInviteBatt(uid: number, ex?: SqlRunner): Promise<{
    outcome: 'granted' | 'replayed' | 'capped';
    batt: number; grantedBatt: number; signupBatt: number; source: PolicySource; idempotencyKey: string;
  }> {
    const { policy, source } = resolveInviteRewardPolicy(await this.getAppConfigValueByKey('invite_reward_policy', ex));
    const signupBatt = policy.signupBatt;
    const key = `${INVITE_SIGNUP_KEY_PREFIX}${uid}`;
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH prior AS (SELECT 1 FROM public.batt_entry AS e WHERE e.idempotency_key = ${key}::text),
      cur AS (SELECT COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${uid}), 0)::int AS batt),
      target AS (SELECT LEAST((SELECT batt FROM cur) + ${signupBatt}::int, ${BATT_CAP_HARD_MAX}::int)::int AS after),
      ins AS (
        INSERT INTO public.batt_account (uid, batt)
        SELECT ${uid}, (SELECT after FROM target)
        WHERE NOT EXISTS (SELECT 1 FROM prior)
        ON CONFLICT (uid) DO UPDATE SET batt = EXCLUDED.batt
        RETURNING batt
      ),
      entry AS (
        INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
        SELECT ${uid}, (SELECT after FROM target) - (SELECT batt FROM cur), (SELECT after FROM target),
               'invite_signup', ${key}::text, 'invite', ${uid}, ''
        FROM ins
        WHERE (SELECT after FROM target) <> (SELECT batt FROM cur)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING txid
      )
      SELECT
        (SELECT count(*)::int FROM entry) AS entry_rows,
        COALESCE((SELECT batt FROM ins), (SELECT batt FROM cur))::int AS batt,
        ((SELECT after FROM target) - (SELECT batt FROM cur))::int AS delta,
        EXISTS (SELECT 1 FROM prior) AS was_prior
    `);
    const row = rows[0] || {};
    const delta = Number(row.delta ?? 0) || 0;
    const entryRows = Number(row.entry_rows ?? 0) || 0;
    const wasPrior = row.was_prior === true;
    const outcome: 'granted' | 'replayed' | 'capped' =
      entryRows > 0 ? (delta === signupBatt ? 'granted' : 'capped') : (wasPrior ? 'replayed' : 'capped');
    return {
      outcome,
      batt: Number(row.batt ?? 0) || 0,
      grantedBatt: entryRows > 0 ? delta : 0,
      signupBatt,
      source,
      idempotencyKey: key,
    };
  }

  // ==========================================================================
  // 批 9 第 4 片（P9④ · `data-layer.spec` v0.25 §33 · `route-layer.spec` v2.18 §30）：
  //   BTTC 代币（`battcoin`）铸造 / 分解 —— 载体 = `currency` 表一行（`R-9-2` / `R-9-40`）
  //   + `batt_account` / `batt_entry`（P9② 复用）+ `ledger_entry`（既有 `mint` / `burn` 本体腿
  //   + 新 kind `bttc_mint_fee` / `bttc_burn_fee` 的 `$` 费腿 → `uid = −1`，**不真 burn** · `R-9-3`）。
  // --------------------------------------------------------------------------
  // · 事务形态 = **单语句 CTE**（`R-9-41`）：batt 扣 / 加 + `$` 费腿 + BTTC 本体腿（`op='mint'` /
  //   `op='burn'` ⇒ 账本**自动双写** `currency.total_supply` · `R-9-37`）+ `batt_entry` 台账行——
  //   全部**同一条语句**（不可绕过的唯一写路径，沿 8④ `C2` 教训）。
  // · 幂等键 = **`cli:<UUID>`**（调用方供键 · `R-9-41`）；`$` 费腿事件键 = **`<key>:fee`**（同族派生）。
  // · ★ `C-15`：「无行 ⇒ 兜底值」一律 `COALESCE((SELECT …), 0)`（**外层 `COALESCE`**）；
  //   无行 / 闸不过 ⇒ 整条语句**零副作用**（不改 batt / 不写 `batt_entry` / 不调 `ledger_post_event`）。
  // · 库面 leg = **活体可验**（`0032` / `0033` / `0034` **已 apply** ⇒ `schema_version = 0034`）。
  // ==========================================================================

  /** BTTC 铸造 / 分解策略取数（`mint_burn_policy` 五键 · fail-closed 到常量 · `R-9-23` 钳制）。 */
  private static async resolveMintBurn(ex?: SqlRunner): Promise<MintBurnPolicy> {
    const rawBatt = await this.getAppConfigValueByKey('batt_policy', ex);
    const { policy: battPolicy } = resolveBattPolicy(rawBatt);
    const rawMb = await this.getAppConfigValueByKey('mint_burn_policy', ex);
    const { policy } = resolveMintBurnPolicy(rawMb, battPolicy.capBatt);
    return policy;
  }

  /**
   * ★ BTTC 载体行创建（`R-9-40` · 走既有 `currency` 写路径 · idempotent）。
   *   逐列：`symbol='₿'` / `name='BTTC'`（Kevin 2026-10-20 口径：**BTTC 是货币名称、₿ 是货币符号**）
   *   / `owner_uid=0` / `decimals=0` / `status='listed'`
   *   （`listed_at=now()` 满足 `currency_listed_at` CHECK）/ `deposit_amount=0` / `deposit_cid=1` /
   *   `supply_cap=NULL` / **`is_platform_coin=true`**（`0033`）。`ON CONFLICT (symbol) DO NOTHING` 幂等。
   *   ★ **定位口径 = `is_platform_coin = true`，不按 `symbol` 字面**（cid 两库不同：dev 399 /
   *   生产 4；`symbol` 本身是会被改名的值）⇒ 插入谓词与回读兜底一律走平台标记列。
   *   ★ 平台受信任路径（非普通用户 `POST /api/currency`）；`0033` 已 apply ⇒ 活体可验。
   *   ★ `R-9-45`：**返回确定值** —— 插入那一次经 `ins RETURNING` **同名取回**（PG 数据修改型 CTE
   *   与主查询同快照互不可见 ⇒ 主查询直接读 `public.currency` 会得到 `cid=NULL`），故对每列
   *   `COALESCE((SELECT … FROM ins), (SELECT … FROM public.currency …))` 兜底；调用方不得据 `null` 判「未创建」。
   */
  static async ensureBttcCurrency(ex?: SqlRunner): Promise<{
    cid: string; symbol: string; name: string; decimals: number; status: string;
    total_supply: string; is_platform_coin: boolean; inserted: boolean;
  } | null> {
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH ins AS (
        INSERT INTO public.currency
          (symbol, name, owner_uid, decimals, status, listed_at, deposit_amount, deposit_cid, supply_cap, is_platform_coin)
        SELECT '₿'::text, 'BTTC'::text, 0::bigint, 0::smallint, 'listed', now(),
               0::bigint, 1::bigint, NULL::bigint, true
        WHERE NOT EXISTS (SELECT 1 FROM public.currency AS c WHERE c.is_platform_coin = true)
        ON CONFLICT (symbol) DO NOTHING
        RETURNING cid, symbol, name, decimals, status, total_supply, is_platform_coin
      )
      SELECT
        (SELECT count(*)::int FROM ins) AS inserted,
        COALESCE((SELECT i.cid::text FROM ins AS i), (SELECT c.cid::text FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS cid,
        COALESCE((SELECT i.symbol FROM ins AS i), (SELECT c.symbol FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS symbol,
        COALESCE((SELECT i.name FROM ins AS i), (SELECT c.name FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS name,
        COALESCE((SELECT i.decimals::int FROM ins AS i), (SELECT c.decimals::int FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS decimals,
        COALESCE((SELECT i.status FROM ins AS i), (SELECT c.status FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS status,
        COALESCE((SELECT i.total_supply::text FROM ins AS i), (SELECT c.total_supply::text FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS total_supply,
        COALESCE((SELECT i.is_platform_coin FROM ins AS i), (SELECT c.is_platform_coin FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1)) AS is_platform_coin
    `);
    const row = rows[0];
    if (!row) return null;
    const cid = row.cid === null || row.cid === undefined ? null : String(row.cid);
    if (cid === null) return null;
    return {
      cid,
      symbol: String(row.symbol ?? ''),
      name: String(row.name ?? ''),
      decimals: Number(row.decimals ?? 0) || 0,
      status: String(row.status ?? ''),
      total_supply: String(row.total_supply ?? '0'),
      is_platform_coin: row.is_platform_coin === true,
      inserted: Number(row.inserted ?? 0) > 0,
    };
  }

  /**
   * R1 · 用户 BTTC 资产读口（并入既有 `GET /api/batt` 用户资产面 · 变体 Ⅱ）。
   *   取数：平台币行（**`is_platform_coin = true`**，不按 `symbol` 字面 —— 符号现役 `'₿'`、
   *   名称现役 `'BTTC'`，改名不再影响定位）+ 用户 `account(cid=平台币).balance` + `$` 余额 + `batt`
   *   + `mint_burn_policy` 五键生效值 ⇒ 派生布尔 `canMint` / `canBurn`（即时重算 · 不落列）。
   *   ★ `C-15`：无 `account` / 无 `batt_account` 行 ⇒ `COALESCE(…, 0)`（**外层**）。
   */
  static async getBttcState(uid: number, ex?: SqlRunner): Promise<{
    symbol: string; name: string; decimals: number; status: string | null; totalSupply: string;
    balance: string; usdBalance: string; batt: number;
    canMint: boolean; canBurn: boolean;
    policy: MintBurnPolicy; source: PolicySource;
  }> {
    const rawBatt = await this.getAppConfigValueByKey('batt_policy', ex);
    const { policy: battPolicy } = resolveBattPolicy(rawBatt);
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH bttc AS (
        SELECT c.cid, c.symbol, c.name, c.decimals, c.status, c.total_supply
        FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1
      )
      SELECT
        (SELECT bttc.symbol FROM bttc) AS symbol,
        (SELECT bttc.name FROM bttc) AS name,
        (SELECT bttc.decimals::int FROM bttc) AS decimals,
        (SELECT bttc.status FROM bttc) AS status,
        (SELECT bttc.total_supply::text FROM bttc) AS total_supply,
        COALESCE((SELECT a.balance::text FROM public.account AS a
                   WHERE a.uid = ${uid} AND a.cid = (SELECT bttc.cid FROM bttc)), '0') AS bttc_balance,
        COALESCE((SELECT a.balance::text FROM public.account AS a
                   WHERE a.uid = ${uid} AND a.cid = 1), '0') AS usd_balance,
        COALESCE((SELECT b.batt::int FROM public.batt_account AS b WHERE b.uid = ${uid}), 0) AS batt,
        (SELECT p.value FROM public.app_config AS p WHERE p.key = 'mint_burn_policy' LIMIT 1) AS mb_policy
    `);
    const row = (rows[0] || {}) as Record<string, unknown>;
    const { policy, source } = resolveMintBurnPolicy(row.mb_policy, battPolicy.capBatt);
    const balance = String(row.bttc_balance ?? '0');
    const usdBalance = String(row.usd_balance ?? '0');
    const batt = Number(row.batt ?? 0) || 0;
    const status = row.status === null || row.status === undefined ? null : String(row.status);
    const mintable = status === 'draft' || status === 'listed';
    return {
      symbol: String(row.symbol ?? '₿'),
      name: String(row.name ?? 'BTTC'),
      decimals: Number(row.decimals ?? 0) || 0,
      status,
      totalSupply: String(row.total_supply ?? '0'),
      balance,
      usdBalance,
      batt,
      canMint: mintable && batt >= policy.mintBattCost && BigInt(usdBalance) >= BigInt(policy.mintFeeUsd),
      canBurn: BigInt(balance) >= BigInt(policy.burnBttcCost) && BigInt(usdBalance) >= BigInt(policy.burnFeeUsd),
      policy,
      source,
    };
  }

  /**
   * A1 · `POST /api/bttc/mint` 写口（**单语句 CTE** · `R-9-41`）。
   *   batt `−mintBattCost`（→ 0 清零）+ `$` 费腿 `−mintFeeUsd` → `uid = −1`（kind `bttc_mint_fee`）
   *   + BTTC 本体 `+1`（`op='mint'` ⇒ 双写 `total_supply`）。三面**同一条语句**（原子）。
   *   闸（写路径内 · `C-15` 外层 `COALESCE`）：`batt ≥ mintBattCost` ∧ `$ ≥ mintFeeUsd` ∧ BTTC 可铸（`listed`/`draft`）。
   */
  static async bttcMint(input: { uid: number; idempotencyKey: string; requestFingerprint: string; memo: string }, ex?: SqlRunner): Promise<{
    outcome: 'applied' | 'replayed' | 'rejected';
    batt: number; balance: string; usdBalance: string; held: string; bstatus: string | null;
    txid: string | null; supplyBefore: string | null; supplyAfter: string | null;
  } | null> {
    const { uid, idempotencyKey, requestFingerprint, memo } = input;
    const p = await this.resolveMintBurn(ex);
    const feeKey = `${idempotencyKey}:fee`;
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH
      bttc AS (SELECT c.cid, c.status FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1),
      cur AS (SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${uid} FOR UPDATE),
      usd AS (SELECT COALESCE((SELECT a.balance FROM public.account AS a WHERE a.uid = ${uid} AND a.cid = 1), 0) AS bal),
      held AS (SELECT COALESCE((SELECT a.balance FROM public.account AS a
                WHERE a.uid = ${uid} AND a.cid = (SELECT bttc.cid FROM bttc)), 0) AS bal),
      gate AS (
        SELECT
          COALESCE((SELECT cur.batt FROM cur), 0)::int AS batt,
          (SELECT usd.bal FROM usd)::bigint AS usd,
          (SELECT held.bal FROM held)::bigint AS held,
          (SELECT bttc.cid FROM bttc) AS bcid,
          (SELECT bttc.status FROM bttc) AS bstatus
      ),
      ok AS (
        SELECT
          (SELECT batt FROM gate) >= ${String(p.mintBattCost)}::int
          AND (SELECT usd FROM gate) >= ${String(p.mintFeeUsd)}::bigint
          AND (SELECT bcid FROM gate) IS NOT NULL
          AND (SELECT bstatus FROM gate) IN ('draft', 'listed') AS pass
      ),
      prior AS (SELECT 1 FROM public.batt_entry AS e WHERE e.idempotency_key = ${idempotencyKey}::text),
      fee_ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'entries',
          'idempotency_key', ${feeKey}::text,
          'request_fingerprint', ${requestFingerprint}::text,
          'ref_type', 'currency',
          'ref_id', (SELECT gate.bcid::text FROM gate),
          'memo', ${memo}::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', ${String(uid)}::text, 'cid', '1', 'delta', ${String(-p.mintFeeUsd)}::text,
              'kind', 'bttc_mint_fee', 'ref_type', 'currency', 'ref_id', (SELECT gate.bcid::text FROM gate)),
            jsonb_build_object('uid', '-1', 'cid', '1', 'delta', ${String(p.mintFeeUsd)}::text,
              'kind', 'bttc_mint_fee', 'ref_type', 'currency', 'ref_id', (SELECT gate.bcid::text FROM gate))
          )
        )) AS r
        FROM ok WHERE (SELECT pass FROM ok)
      ),
      body_ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'mint',
          'idempotency_key', ${idempotencyKey}::text,
          'request_fingerprint', ${requestFingerprint}::text,
          'ref_type', 'currency',
          'ref_id', (SELECT gate.bcid::text FROM gate),
          'uid', ${String(uid)}::text,
          'cid', (SELECT gate.bcid::text FROM gate),
          'amount', '1',
          'platform', true
        )) AS r
        FROM fee_ev
      ),
      upd_batt AS (
        INSERT INTO public.batt_account (uid, batt)
        SELECT ${uid}, (COALESCE((SELECT cur.batt FROM cur), 0) - ${String(p.mintBattCost)}::int)
        WHERE (SELECT pass FROM ok) AND NOT EXISTS (SELECT 1 FROM prior)
        ON CONFLICT (uid) DO UPDATE SET batt = (COALESCE((SELECT cur.batt FROM cur), 0) - ${String(p.mintBattCost)}::int)
        RETURNING batt
      ),
      ins_batt AS (
        INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
        SELECT ${uid}, ${String(-p.mintBattCost)}::int, (SELECT batt FROM upd_batt), 'bttc_mint',
               ${idempotencyKey}::text, 'currency', (SELECT gate.bcid FROM gate), ''
        FROM upd_batt
        RETURNING txid
      )
      SELECT
        (SELECT pass FROM ok) AS gated,
        EXISTS (SELECT 1 FROM prior) AS was_prior,
        (SELECT count(*)::int FROM ins_batt) AS inserted_batt,
        COALESCE((SELECT batt FROM upd_batt), (SELECT cur.batt FROM cur), 0)::int AS batt,
        (SELECT gate.usd::text FROM gate) AS gate_usd,
        (SELECT gate.held::text FROM gate) AS gate_held,
        (SELECT gate.bstatus FROM gate) AS gate_bstatus,
        (SELECT (body_ev.r->>'txid') FROM body_ev) AS body_txid,
        (SELECT (body_ev.r->'extra'->>'supply_before') FROM body_ev) AS supply_before,
        (SELECT (body_ev.r->'extra'->>'supply_after') FROM body_ev) AS supply_after
    `);
    const row = rows[0];
    if (!row) return null;
    const gated = row.gated === true;
    const wasPrior = row.was_prior === true;
    return {
      outcome: !gated ? 'rejected' : (wasPrior ? 'replayed' : 'applied'),
      batt: Number(row.batt ?? 0) || 0,
      balance: '',
      usdBalance: String(row.gate_usd ?? '0'),
      held: String(row.gate_held ?? '0'),
      bstatus: row.gate_bstatus === null || row.gate_bstatus === undefined ? null : String(row.gate_bstatus),
      txid: row.body_txid === null || row.body_txid === undefined ? null : String(row.body_txid),
      supplyBefore: row.supply_before === null || row.supply_before === undefined ? null : String(row.supply_before),
      supplyAfter: row.supply_after === null || row.supply_after === undefined ? null : String(row.supply_after),
    };
  }

  /**
   * A2 · `POST /api/bttc/burn` 写口（**单语句 CTE** · `R-9-41`）。
   *   BTTC 本体 `−burnBttcCost`（`op='burn'` ⇒ 真销毁 + 双写 `total_supply` · `R-9-37`）
   *   + `$` 费腿 `−burnFeeUsd` → `uid = −1`（kind `bttc_burn_fee`）+ batt `+burnBattGain`
   *   （**封顶丢弃** · `R-9-17`）。三面**同一条语句**。
   *   闸：`BTTC ≥ burnBttcCost` ∧ `$ ≥ burnFeeUsd`（`R-9-38` 持有人本人 = token uid）。
   */
  static async bttcBurn(input: { uid: number; idempotencyKey: string; requestFingerprint: string; memo: string }, ex?: SqlRunner): Promise<{
    outcome: 'applied' | 'replayed' | 'rejected';
    batt: number; balance: string; usdBalance: string; held: string; bstatus: string | null;
    txid: string | null; supplyBefore: string | null; supplyAfter: string | null;
  } | null> {
    const { uid, idempotencyKey, requestFingerprint, memo } = input;
    const rawBatt = await this.getAppConfigValueByKey('batt_policy', ex);
    const { policy: battPolicy } = resolveBattPolicy(rawBatt);
    const p = await this.resolveMintBurn(ex);
    const capBatt = Math.min(Math.max(1, battPolicy.capBatt), BATT_CAP_HARD_MAX);
    const feeKey = `${idempotencyKey}:fee`;
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH
      bttc AS (SELECT c.cid, c.status FROM public.currency AS c WHERE c.is_platform_coin = true ORDER BY c.cid LIMIT 1),
      cur AS (SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${uid} FOR UPDATE),
      usd AS (SELECT COALESCE((SELECT a.balance FROM public.account AS a WHERE a.uid = ${uid} AND a.cid = 1), 0) AS bal),
      held AS (SELECT COALESCE((SELECT a.balance FROM public.account AS a
                WHERE a.uid = ${uid} AND a.cid = (SELECT bttc.cid FROM bttc)), 0) AS bal),
      gate AS (
        SELECT
          COALESCE((SELECT cur.batt FROM cur), 0)::int AS batt,
          (SELECT usd.bal FROM usd)::bigint AS usd,
          (SELECT held.bal FROM held)::bigint AS held,
          (SELECT bttc.cid FROM bttc) AS bcid,
          (SELECT bttc.status FROM bttc) AS bstatus
      ),
      ok AS (
        SELECT
          (SELECT held FROM gate) >= ${String(p.burnBttcCost)}::bigint
          AND (SELECT usd FROM gate) >= ${String(p.burnFeeUsd)}::bigint
          AND (SELECT bcid FROM gate) IS NOT NULL
          AND (SELECT bstatus FROM gate) IN ('draft', 'listed') AS pass
      ),
      prior AS (SELECT 1 FROM public.batt_entry AS e WHERE e.idempotency_key = ${idempotencyKey}::text),
      fee_ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'entries',
          'idempotency_key', ${feeKey}::text,
          'request_fingerprint', ${requestFingerprint}::text,
          'ref_type', 'currency',
          'ref_id', (SELECT gate.bcid::text FROM gate),
          'memo', ${memo}::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', ${String(uid)}::text, 'cid', '1', 'delta', ${String(-p.burnFeeUsd)}::text,
              'kind', 'bttc_burn_fee', 'ref_type', 'currency', 'ref_id', (SELECT gate.bcid::text FROM gate)),
            jsonb_build_object('uid', '-1', 'cid', '1', 'delta', ${String(p.burnFeeUsd)}::text,
              'kind', 'bttc_burn_fee', 'ref_type', 'currency', 'ref_id', (SELECT gate.bcid::text FROM gate))
          )
        )) AS r
        FROM ok WHERE (SELECT pass FROM ok)
      ),
      body_ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'burn',
          'idempotency_key', ${idempotencyKey}::text,
          'request_fingerprint', ${requestFingerprint}::text,
          'ref_type', 'currency',
          'ref_id', (SELECT gate.bcid::text FROM gate),
          'uid', ${String(uid)}::text,
          'cid', (SELECT gate.bcid::text FROM gate),
          'amount', ${String(p.burnBttcCost)}::text
        )) AS r
        FROM fee_ev
      ),
      after AS (
        SELECT LEAST(COALESCE((SELECT cur.batt FROM cur), 0) + ${String(p.burnBattGain)}::int, ${String(capBatt)}::int)::int AS batt
      ),
      delta AS (SELECT ((SELECT batt FROM after) - COALESCE((SELECT cur.batt FROM cur), 0))::int AS d),
      upd_batt AS (
        INSERT INTO public.batt_account (uid, batt)
        SELECT ${uid}, (SELECT batt FROM after)
        WHERE (SELECT pass FROM ok) AND NOT EXISTS (SELECT 1 FROM prior)
        ON CONFLICT (uid) DO UPDATE SET batt = (SELECT batt FROM after)
        RETURNING batt
      ),
      ins_batt AS (
        INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
        SELECT ${uid}, (SELECT d FROM delta), (SELECT batt FROM after), 'bttc_burn',
               ${idempotencyKey}::text, 'currency', (SELECT gate.bcid FROM gate), ''
        FROM upd_batt
        WHERE (SELECT d FROM delta) <> 0
        RETURNING txid
      )
      SELECT
        (SELECT pass FROM ok) AS gated,
        EXISTS (SELECT 1 FROM prior) AS was_prior,
        (SELECT count(*)::int FROM ins_batt) AS inserted_batt,
        COALESCE((SELECT batt FROM upd_batt), (SELECT cur.batt FROM cur), 0)::int AS batt,
        (SELECT gate.usd::text FROM gate) AS gate_usd,
        (SELECT gate.held::text FROM gate) AS gate_held,
        (SELECT gate.bstatus FROM gate) AS gate_bstatus,
        (SELECT (body_ev.r->>'txid') FROM body_ev) AS body_txid,
        (SELECT (body_ev.r->'extra'->>'supply_before') FROM body_ev) AS supply_before,
        (SELECT (body_ev.r->'extra'->>'supply_after') FROM body_ev) AS supply_after
    `);
    const row = rows[0];
    if (!row) return null;
    const gated = row.gated === true;
    const wasPrior = row.was_prior === true;
    return {
      outcome: !gated ? 'rejected' : (wasPrior ? 'replayed' : 'applied'),
      batt: Number(row.batt ?? 0) || 0,
      balance: '',
      usdBalance: String(row.gate_usd ?? '0'),
      held: String(row.gate_held ?? '0'),
      bstatus: row.gate_bstatus === null || row.gate_bstatus === undefined ? null : String(row.gate_bstatus),
      txid: row.body_txid === null || row.body_txid === undefined ? null : String(row.body_txid),
      supplyBefore: row.supply_before === null || row.supply_before === undefined ? null : String(row.supply_before),
      supplyAfter: row.supply_after === null || row.supply_after === undefined ? null : String(row.supply_after),
    };
  }

  // ==========================================================================
  // 批 9 第 3 片（P9③ · `data-layer.spec` v0.23 §32 · `route-layer.spec` v2.16 §29）：
  //   评分（双向互评 · 四要素必锚 · 周期**查询期聚合**）+ 时效（四时长 · 事件行 `time_created`）
  //   + 比率（四类 · `R-9-34` 分母 = `accepted`）+ 订单动作口（`shipped` / `received`）。
  // --------------------------------------------------------------------------
  // · 载体：`public.rating` / `public.listing_order_event`（迁移 `0031`；**未 apply** ⇒ 库面 leg `PENDING_APPLY`）。
  // · 时点真源 = 事件行 `time_created`（`R-9-28`）；评分聚合 = 保留原始行 + 查询期聚合（`R-9-1` 禁预聚合分桶）。
  // · 兜底：星级 = `rating_policy.defaultStars`（默认 3.0）；时长无数据 = `null`（前端文案「暂无数据」· **不填 0**）；
  //   比率无数据 = 100%。★ 凡「无行 ⇒ 兜底值」断言须带独立负对照（`C-15`）。
  // ==========================================================================

  /**
   * R1 · `GET /api/rating/summary` 取数（**查询期聚合** · 禁预聚合分桶）。
   * 四角色星级 = 该 uid 作为 `ratee_uid` 收到的**有效评分行**平均星级（0–5）；周期恰 4 档（30/90/360/1000 天）。
   * 角色 ↔ `direction` 映射：poster ⇐ `worker_to_poster`；worker ⇐ `poster_to_worker`；
   * vendor ⇐ `customer_to_vendor`；customer ⇐ `vendor_to_customer`。
   * **无数据（分母 = 0）⇒ `defaultStars`（默认 3.0）**（**不填 0 / 不隐藏**）。
   */
  static async getRatingSummary(uid: number, ex?: SqlRunner): Promise<{
    defaultStars: number;
    source: PolicySource;
    periods: Record<string, {
      poster: number; worker: number; vendor: number; customer: number;
      counts: { poster: number; worker: number; vendor: number; customer: number };
    }>;
  }> {
    const { policy, source } = resolveRatingPolicy(await this.getAppConfigValueByKey('rating_policy', ex));
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      SELECT p.days::int AS days, r.direction AS direction,
             COALESCE(sum(r.stars), 0)::text AS s, count(r.rating_id)::int AS n
        FROM (VALUES (30),(90),(360),(1000)) AS p(days)
        LEFT JOIN public.rating AS r
          ON r.ratee_uid = ${uid}
         AND r.time_created >= now() - make_interval(days => p.days)
       GROUP BY p.days, r.direction
    `);
    const dirRole: Record<string, 'poster' | 'worker' | 'vendor' | 'customer'> = {
      worker_to_poster: 'poster', poster_to_worker: 'worker',
      customer_to_vendor: 'vendor', vendor_to_customer: 'customer',
    };
    const roles = ['poster', 'worker', 'vendor', 'customer'] as const;
    const round4 = (n: number): number => Math.round(n * 10000) / 10000; // storageDecimals = 4
    const acc: Record<string, Record<string, { s: number; n: number }>> = {};
    const periods: Record<string, {
      poster: number; worker: number; vendor: number; customer: number;
      counts: { poster: number; worker: number; vendor: number; customer: number };
    }> = {};
    for (const d of [30, 90, 360, 1000]) {
      acc[String(d)] = { poster: { s: 0, n: 0 }, worker: { s: 0, n: 0 }, vendor: { s: 0, n: 0 }, customer: { s: 0, n: 0 } };
      periods[String(d)] = {
        poster: policy.defaultStars, worker: policy.defaultStars, vendor: policy.defaultStars, customer: policy.defaultStars,
        counts: { poster: 0, worker: 0, vendor: 0, customer: 0 },
      };
    }
    for (const row of rows) {
      const role = dirRole[toStringValue(row.direction)];
      const key = row.days === null || row.days === undefined ? '' : String(Number(row.days));
      if (!role || !acc[key]) continue;
      acc[key][role].s += Number(row.s) || 0;
      acc[key][role].n += Number(row.n) || 0;
    }
    for (const days of Object.keys(acc)) {
      for (const role of roles) {
        const { s, n } = acc[days][role];
        periods[days][role] = n > 0 ? round4(s / n) : policy.defaultStars;
        periods[days].counts[role] = n;
      }
    }
    return { defaultStars: policy.defaultStars, source, periods };
  }

  /**
   * A1 · `POST /api/rating` 写口（**四要素由服务端取数**：`rater_uid` = token；`ratee_uid` / `direction`
   * 由标的 + 发起人推导 —— 客户端**不得**声明 `ratee_uid`）。
   * 幂等 = `UNIQUE (idempotency_key)`；「一侧恰一次」= `UNIQUE (rater_uid, target_type, target_id)`。
   * outcome 闭集 = `inserted` | `replay` | `already_rated` | `target_not_found`。
   */
  static async submitRating(input: {
    raterUid: number; targetType: string; targetId: number; direction: string;
    stars: number; idempotencyKey: string; requestFingerprint: string; memo: string;
  }, ex?: SqlRunner): Promise<{
    outcome: 'inserted' | 'replay' | 'already_rated' | 'target_not_found';
    rateeUid: number | null; ratingId: number | null; stars: number | null;
  } | null> {
    const { raterUid, targetType, targetId, direction, stars, idempotencyKey, requestFingerprint, memo } = input;
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH cand AS (
        -- ★ 2026-10-21（0070）：评分标的闭集从 {job, listing} 收为 {listing}；
        --   招工轴（poster_to_worker / worker_to_poster）随头表下线一并移除。
        SELECT CASE
          WHEN ${targetType}::text = 'listing' THEN (
            SELECT CASE
              WHEN ${direction}::text = 'vendor_to_customer' AND o.seller_uid = ${raterUid} THEN o.buyer_uid
              WHEN ${direction}::text = 'customer_to_vendor' AND o.buyer_uid = ${raterUid} THEN o.seller_uid
              ELSE NULL END
              FROM public.listing_order AS o
             WHERE o.listing_id = ${targetId}::bigint
               AND (o.buyer_uid = ${raterUid} OR o.seller_uid = ${raterUid})
             ORDER BY o.order_id DESC LIMIT 1)
          ELSE NULL
        END AS ratee_uid
      ),
      res AS (SELECT ratee_uid FROM cand),
      dup AS (SELECT rating_id FROM public.rating
               WHERE rater_uid = ${raterUid} AND target_type = ${targetType}::text AND target_id = ${targetId}::bigint
               LIMIT 1),
      ins AS (
        INSERT INTO public.rating
          (rater_uid, ratee_uid, target_type, target_id, direction, stars, idempotency_key, request_fingerprint, memo)
        SELECT ${raterUid}, (SELECT ratee_uid FROM res), ${targetType}::text, ${targetId}::bigint, ${direction}::text,
               ${stars}::numeric, ${idempotencyKey}::text, ${requestFingerprint}::text, ${memo}::text
         WHERE (SELECT ratee_uid FROM res) IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM dup)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING rating_id, ratee_uid, stars
      )
      SELECT
        (SELECT count(*)::int FROM ins) AS inserted,
        (SELECT ratee_uid::text FROM res) AS ratee_uid,
        (SELECT rating_id::text FROM ins) AS rating_id,
        (SELECT stars::text FROM ins) AS stars,
        (SELECT rating_id::text FROM dup) AS dup_id,
        (SELECT stars::text FROM public.rating WHERE idempotency_key = ${idempotencyKey}::text LIMIT 1) AS existing_stars
    `);
    const row = rows[0];
    if (!row) return null;
    const inserted = Number(row.inserted ?? 0) || 0;
    const rateeRaw = row.ratee_uid === null || row.ratee_uid === undefined ? null : String(row.ratee_uid);
    const rateeUid = rateeRaw === null ? null : Number(rateeRaw);
    const existingStars = row.existing_stars === null || row.existing_stars === undefined ? null : Number(row.existing_stars);
    const dupId = row.dup_id === null || row.dup_id === undefined ? null : Number(row.dup_id);
    let outcome: 'inserted' | 'replay' | 'already_rated' | 'target_not_found';
    let ratingId: number | null = null;
    let starsOut: number | null = null;
    if (inserted > 0) {
      outcome = 'inserted';
      ratingId = row.rating_id === null || row.rating_id === undefined ? null : Number(row.rating_id);
      starsOut = row.stars === null || row.stars === undefined ? null : Number(row.stars);
    } else if (rateeUid === null) {
      outcome = 'target_not_found';
    } else if (existingStars !== null) {
      outcome = 'replay';
      starsOut = existingStars;
    } else if (dupId !== null) {
      outcome = 'already_rated';
      ratingId = dupId;
    } else {
      outcome = 'target_not_found';
    }
    return { outcome, rateeUid, ratingId, stars: starsOut };
  }

  /**
   * R2 · `GET /api/timeliness` 取数（商品轴四读数 + 比率两类）。
   * ★ 2026-10-21（migration 0070）：**招工轴整体下线** —— T1/T2（任务平均通过天数）、M1（工人通过率）、
   *   M3（单任务通过率）与 `?jobId` 入参一并移除；对应载荷键（`posterAvgDays` / `workerAvgDays` /
   *   `workerPassRate` / `jobPassRate`）由路由层保留键名并恒回 `null`（= 原「无数据」语义）。
   * 时长时点一律取**事件行 `time_created`**（`R-9-28`）；**无数据 ⇒ `null`**（路由映射「暂无数据」，**不填 0**）。
   *   T3 店家平均发货天数 = avg(发货事件 − 下单事件)（`seller_uid = uid` 的已发货订单）；
   *   T4 顾客平均收货天数 = avg(收货事件 − 付款事件)（`buyer_uid = uid` 的已收货订单）。
   * 比率（默认 100%）：M2 顾客成交率 = `received / 全部订单`；可选 `listingId` ⇒ M4（单标的；未给 ⇒ `null`）。
   */
  static async getTimeliness(uid: number, opts: { listingId?: number } = {}, ex?: SqlRunner): Promise<{
    posterAvgDays: number | null; workerAvgDays: number | null;
    vendorAvgShipDays: number | null; customerAvgReceiveDays: number | null;
    workerPassRate: number | null; customerDealRate: number | null;
    jobPassRate: number | null; listingDealRate: number | null;
  }> {
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH ship AS (
        SELECT avg(EXTRACT(EPOCH FROM (e_ship.time_created - e_created.time_created)) / 86400.0) AS d
          FROM public.listing_order AS o
          JOIN public.listing_order_event AS e_created ON e_created.order_id = o.order_id AND e_created.to_status = 'created'
          JOIN public.listing_order_event AS e_ship    ON e_ship.order_id    = o.order_id AND e_ship.to_status    = 'shipped'
         WHERE o.seller_uid = ${uid}
      ),
      recv AS (
        SELECT avg(EXTRACT(EPOCH FROM (e_recv.time_created - e_paid.time_created)) / 86400.0) AS d
          FROM public.listing_order AS o
          JOIN public.listing_order_event AS e_paid ON e_paid.order_id = o.order_id AND e_paid.to_status = 'paid'
          JOIN public.listing_order_event AS e_recv ON e_recv.order_id = o.order_id AND e_recv.to_status = 'received'
         WHERE o.buyer_uid = ${uid}
      ),
      m2 AS (SELECT count(*) FILTER (WHERE o.status = 'received')::int AS num, count(*)::int AS den
               FROM public.listing_order AS o WHERE o.buyer_uid = ${uid}),
      m4 AS (SELECT count(*) FILTER (WHERE o.status = 'received')::int AS num, count(*)::int AS den
               FROM public.listing_order AS o WHERE o.listing_id = ${opts.listingId ?? null}::bigint)
      SELECT
        (SELECT d FROM ship)::text AS vendor_avg_ship_days,
        (SELECT d FROM recv)::text AS customer_avg_receive_days,
        (SELECT num FROM m2)::int AS m2_num, (SELECT den FROM m2)::int AS m2_den,
        (SELECT num FROM m4)::int AS m4_num, (SELECT den FROM m4)::int AS m4_den
    `);
    const row = rows[0] || {};
    const numOf = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
    const round4 = (n: number): number => Math.round(n * 10000) / 10000;
    // 比率：分母 = 0 ⇒ **默认 100%**（需求 §2.1.4）；否则 = num/den。
    const rate = (num: unknown, den: unknown): number => {
      const d = Number(den ?? 0) || 0;
      const n = Number(num ?? 0) || 0;
      return d > 0 ? round4(n / d) : 1;
    };
    return {
      // ★ 2026-10-21（0070）：招工轴四读数随 job 域下线恒 `null`（原「无数据 ⇒ null」同语义；载荷键保留）。
      posterAvgDays: null,
      workerAvgDays: null,
      vendorAvgShipDays: numOf(row.vendor_avg_ship_days),
      customerAvgReceiveDays: numOf(row.customer_avg_receive_days),
      workerPassRate: null,
      customerDealRate: rate(row.m2_num, row.m2_den),
      jobPassRate: null,
      listingDealRate: opts.listingId === undefined ? null : rate(row.m4_num, row.m4_den),
    };
  }

  /**
   * 订单动作口（`A2` 发货 / `A3` 收货）· **单语句 CTE**（状态回写 + 事件行**同语句** ⇒ 同生同灭 · 变体 C-Ⅰ）。
   * 归属闸（ship ⇒ 卖方本人 / receive ⇒ 买方本人）+ 状态闸（ship: `paid→shipped`；receive: `shipped→received`）
   * 在 SQL 内取数比对；状态机白名单真源 = `public.listing_order_status_transition_ok`（`0030` 已改写；
   * **未 apply 前本口 409** · 库面 leg `PENDING_APPLY`）。outcome 闭集 =
   * `shipped` | `received` | `replay` | `order_not_found` | `not_party` | `state_conflict`。
   */
  static async transitionListingOrder(input: {
    action: 'ship' | 'receive'; orderId: number; actorUid: number;
    idempotencyKey: string; requestFingerprint: string; memo: string;
  }, ex?: SqlRunner): Promise<{
    outcome: 'shipped' | 'received' | 'replay' | 'order_not_found' | 'not_party' | 'state_conflict';
    orderId: number; currentStatus: string | null; toStatus: string;
  } | null> {
    const { action, orderId, actorUid, idempotencyKey, requestFingerprint, memo } = input;
    const toStatus = action === 'ship' ? 'shipped' : 'received';
    const fromStatus = action === 'ship' ? 'paid' : 'shipped';
    const sql = sqlFor(ex);
    const rows = asItems<Record<string, unknown>>(await sql`
      WITH ord AS (
        SELECT o.order_id, o.seller_uid, o.buyer_uid, o.status
          FROM public.listing_order AS o WHERE o.order_id = ${orderId}::bigint
      ),
      upd AS (
        UPDATE public.listing_order AS o SET status = ${toStatus}::text
         WHERE o.order_id = ${orderId}::bigint
           AND o.status = ${fromStatus}::text
           AND (CASE WHEN ${action}::text = 'ship' THEN o.seller_uid ELSE o.buyer_uid END) = ${actorUid}
        RETURNING o.order_id, o.status
      ),
      ev AS (
        INSERT INTO public.listing_order_event
          (order_id, event_type, from_status, to_status, actor_uid, idempotency_key, request_fingerprint, ref_type, ref_id, memo)
        SELECT u.order_id, ${toStatus}::text, ${fromStatus}::text, ${toStatus}::text, ${actorUid},
               ${idempotencyKey}::text, ${requestFingerprint}::text, 'listing_order', u.order_id, ${memo}::text
          FROM upd AS u
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING event_id
      )
      SELECT
        (SELECT count(*)::int FROM upd) AS updated,
        (SELECT count(*)::int FROM ev) AS event_inserted,
        (SELECT status FROM ord) AS current_status,
        (SELECT seller_uid::text FROM ord) AS seller_uid,
        (SELECT buyer_uid::text FROM ord) AS buyer_uid,
        (SELECT count(*)::int FROM public.listing_order_event WHERE idempotency_key = ${idempotencyKey}::text) AS existing_event
    `);
    const row = rows[0];
    if (!row) return null;
    const updated = Number(row.updated ?? 0) || 0;
    const current = row.current_status === null || row.current_status === undefined ? null : String(row.current_status);
    const sellerUid = row.seller_uid === null || row.seller_uid === undefined ? null : Number(row.seller_uid);
    const buyerUid = row.buyer_uid === null || row.buyer_uid === undefined ? null : Number(row.buyer_uid);
    const existing = Number(row.existing_event ?? 0) || 0;
    let outcome: 'shipped' | 'received' | 'replay' | 'order_not_found' | 'not_party' | 'state_conflict';
    if (current === null) outcome = 'order_not_found';
    else if (updated > 0) outcome = action === 'ship' ? 'shipped' : 'received';
    else if (existing > 0) outcome = 'replay';
    else if ((action === 'ship' ? sellerUid : buyerUid) !== actorUid) outcome = 'not_party';
    else outcome = 'state_conflict';
    return { outcome, orderId, currentStatus: current, toStatus };
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

  /**
   * 媒体上传（POST /api/media · route-layer.spec v2.39 §48.2 / data-layer.spec v0.34 §40 · 迁移 0050）：
   * 内容寻址去重的唯一权威 = `media` 表级 `UNIQUE(sha256, size_bytes)`（0050 承重墙）。单语句三态：
   *   · 'inserted'  —— 新落一行；
   *   · 'existing'  —— 撞去重键 ⇒ 取既有行（同字节重传不落第二行，同 createFavoriteRow 手法；
   *     同一语句内各部分共用同一快照 ⇒ 两分支不会重复出 row）。
   * 路由侧 fail-loud（content_type 闭集 / base64 严格解码 / ≤2MiB / 魔数一致）先于本函数；
   * DB 侧 CHECK（content_type 闭集 / size_bytes ∈ (0, 2MiB]）为第二层兜底（§40.1 双层闸口径）。
   */
  static async createMedia(input: {
    sha256: string;
    contentType: string;
    bytes: Buffer;
    sizeBytes: number;
    ownerUid: number;
  }): Promise<{ outcome: 'inserted' | 'existing'; row: MediaUploadRecord }> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH ins AS (
        INSERT INTO public.media (sha256, content_type, bytes, size_bytes, owner_uid)
        VALUES (${input.sha256}::char(64), ${input.contentType}::text, decode(${input.bytes.toString('hex')}, 'hex'),
                ${input.sizeBytes}::int, ${input.ownerUid}::bigint)
        ON CONFLICT (sha256, size_bytes) DO NOTHING
        RETURNING media_id, sha256, content_type, size_bytes, owner_uid, time_created, 'inserted'::text AS outcome
      )
      SELECT i.media_id, i.sha256, i.content_type, i.size_bytes, i.owner_uid, i.time_created, i.outcome
      FROM ins AS i
      UNION ALL
      SELECT e.media_id, e.sha256, e.content_type, e.size_bytes, e.owner_uid, e.time_created, 'existing'::text AS outcome
      FROM public.media AS e
      WHERE e.sha256 = ${input.sha256}::char(64)
        AND e.size_bytes = ${input.sizeBytes}::int
    `);
    const row = rows[0];
    if (!row) {
      throw new Error('media insert returned no row');
    }
    const outcome = String(getValue(row, 'outcome'));
    return {
      outcome: outcome === 'existing' ? 'existing' : 'inserted',
      row: normalizeMediaUploadRow(row),
    };
  }

  /**
   * 媒体读取（GET /api/media/:id · route-layer.spec v2.39 §48.3）：公开读口，只取二进制与
   * content_type；miss ⇒ null（路由层落 404 R107 `sendRefNotFound`）。只读零写。
   */
  static async getMediaById(mediaId: number): Promise<MediaBinaryRecord | null> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT media_id, content_type, bytes
      FROM public.media
      WHERE media_id = ${mediaId}::bigint
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      media_id: toNumberValue(getValue(row, 'media_id')),
      content_type: String(getValue(row, 'content_type')),
      bytes: normalizeBytea(getValue(row, 'bytes')),
    };
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
