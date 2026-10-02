import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { SYSTEM_CURRENCY_CID } from './ledger';

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

const normalizeSystemSettings = (value: unknown): SystemSettingsRecord => {
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
  }): Promise<RawRow> {
    const sql = getSql();
    const rows = extractRows(await sql`
      WITH cur AS (
        SELECT c.cid, c.owner_uid, c.status, c.deposit_cid
        FROM public.currency AS c
        WHERE c.cid = ${input.cid}::bigint
        FOR UPDATE
      ),
      keyhit AS (
        SELECT e.request_fingerprint::text AS fp
        FROM public.ledger_entry AS e
        WHERE e.idempotency_key = ${input.idempotencyKey}::text
        LIMIT 1
      ),
      apply AS (
        UPDATE public.currency AS c
        SET status = 'listed',
            listed_at = now(),
            deposit_amount = ${input.depositAmount}::bigint,
            time_updated = now()
        WHERE c.cid = ${input.cid}::bigint
          AND c.status = 'draft'
          AND (SELECT cur.owner_uid FROM cur) = ${input.actorUid}::bigint
        RETURNING c.cid, c.symbol, c.owner_uid, c.status, c.decimals,
                  c.deposit_amount, c.deposit_cid, c.listed_at
      ),
      slog AS (
        INSERT INTO public.currency_status_log (cid, from_status, to_status, actor_uid, memo)
        SELECT ${input.cid}::bigint, 'draft', 'listed', ${input.actorUid}::bigint, ${input.memo}::text
        FROM apply
        RETURNING log_id
      ),
      ev AS (
        SELECT ledger_post_event(jsonb_build_object(
          'op', 'entries',
          'idempotency_key', ${input.idempotencyKey}::text,
          'request_fingerprint', ${input.requestFingerprint}::text,
          'ref_type', 'currency',
          'ref_id', ${String(input.cid)}::text,
          'memo', ${input.memo}::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', (SELECT cur.owner_uid::text FROM cur), 'cid', '1',
              'delta', ${String(-input.fee)}::text, 'kind', 'currency_create_fee',
              'ref_type', 'currency', 'ref_id', ${String(input.cid)}::text),
            jsonb_build_object('uid', '-1', 'cid', '1',
              'delta', ${String(input.fee)}::text, 'kind', 'currency_create_fee',
              'ref_type', 'currency', 'ref_id', ${String(input.cid)}::text),
            jsonb_build_object('uid', (SELECT cur.owner_uid::text FROM cur),
              'cid', (SELECT cur.deposit_cid::text FROM cur),
              'delta', ${String(-input.depositAmount)}::text, 'kind', 'listing_deposit',
              'ref_type', 'currency', 'ref_id', ${String(input.cid)}::text),
            jsonb_build_object('uid', '-1',
              'cid', (SELECT cur.deposit_cid::text FROM cur),
              'delta', ${String(input.depositAmount)}::text, 'kind', 'listing_deposit',
              'ref_type', 'currency', 'ref_id', ${String(input.cid)}::text)
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
    `);
    const row = rows[0] || null;
    if (!row) throw new Error('listCurrencyWithDeposit: no row returned');
    return row;
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
  ): Promise<{
    outcome: 'applied' | 'replay' | 'already_applied' | 'not_open' | 'self_application' | 'conflict';
    applicationId: number | null;
    jobStatus: string;
  } | null> {
    const sql = getSql();
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
                           ELSE 'conflict' END) AS outcome,
             c.application_id AS application_id
        FROM j
        LEFT JOIN cur AS c ON TRUE
    `);

    if (!row) return null;

    return {
      outcome: (toStringValue(getValue(row, 'outcome')) || 'conflict') as
        'applied' | 'replay' | 'already_applied' | 'not_open' | 'self_application' | 'conflict',
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
  ): Promise<{
    outcome: 'accepted' | 'not_employer' | 'already_accepted' | 'app_state_invalid' | 'job_state_invalid';
    applicationId: number;
    jobId: number;
    workerUid: number;
    applicationStatus: string;
    jobStatus: string;
  } | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      WITH target AS (
        SELECT a.application_id, a.job_id, a.worker_uid, a.status AS app_status,
               j.employer_uid, j.status AS job_status
          FROM public.job_application AS a
          JOIN public.job AS j ON j.job_id = a.job_id
         WHERE a.application_id = ${applicationId}
           AND a.job_id = ${jobId}
      ), upd AS (
        UPDATE public.job_application AS a
           SET status = 'accepted'
          FROM target AS t
         WHERE a.application_id = t.application_id
           AND t.app_status = 'applied'
           AND t.employer_uid = ${actorUid}
           AND t.job_status = 'open'
        RETURNING a.application_id
      ), upd_job AS (
        UPDATE public.job AS j
           SET status = 'accepted', worker_uid = t.worker_uid
          FROM target AS t
         WHERE j.job_id = t.job_id
           AND t.job_status = 'open'
           AND EXISTS (SELECT 1 FROM upd)
        RETURNING j.job_id
      )
      SELECT t.application_id AS application_id, t.job_id AS job_id, t.worker_uid AS worker_uid,
             t.app_status AS application_status, t.job_status AS job_status,
             COALESCE(CASE WHEN EXISTS (SELECT 1 FROM upd) THEN 'accepted' END,
                      CASE WHEN t.employer_uid <> ${actorUid} THEN 'not_employer'
                           WHEN t.app_status = 'accepted' THEN 'already_accepted'
                           WHEN t.app_status <> 'applied' THEN 'app_state_invalid'
                           ELSE 'job_state_invalid' END) AS outcome
        FROM target AS t
    `);

    if (!row) return null;

    return {
      outcome: (toStringValue(getValue(row, 'outcome')) || 'app_state_invalid') as
        'accepted' | 'not_employer' | 'already_accepted' | 'app_state_invalid' | 'job_state_invalid',
      applicationId: toNumberValue(getValue(row, 'application_id')),
      jobId: toNumberValue(getValue(row, 'job_id')),
      workerUid: toNumberValue(getValue(row, 'worker_uid')),
      applicationStatus: toStringValue(getValue(row, 'application_status')),
      jobStatus: toStringValue(getValue(row, 'job_status')),
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

    return normalizeSystemSettings(rows[0]?.value || DEFAULT_SYSTEM_SETTINGS);
  }

  // P4-B2c（§1 #33 / DL36 / DL71）：补 `updated_by`（**NOT NULL 无默认** ⇒ 旧实现必违约）+ 显式 public.。
  static async saveSystemSettings(input: Partial<SystemSettingsRecord>, updatedBy = 0): Promise<SystemSettingsRecord> {
    const current = await this.getSystemSettings();
    const next = normalizeSystemSettings({
      ...current,
      ...(input || {}),
    });
    const sql = getSql();

    const rows = asItems<{ value: unknown }>(await sql`
      INSERT INTO public.app_config (key, value, updated_by, time_updated)
      VALUES ('system_settings', ${JSON.stringify(next)}::jsonb, ${Number(updatedBy) || 0}::bigint, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        time_updated = NOW()
      RETURNING value
    `);

    return normalizeSystemSettings(rows[0]?.value || next);
  }

  // P4-B2c：**不再有路由**（§1 #34 ⇒ 410；C3 ② 删除）。保留方法体仅作回退点（DL42 可切换点）。
  static async resetSystemSettings(): Promise<SystemSettingsRecord> {
    return this.saveSystemSettings({ ...DEFAULT_SYSTEM_SETTINGS });
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
