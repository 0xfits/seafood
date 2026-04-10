import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

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
  siteName: 'Jinli Club',
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
let supportSchemaPromise: Promise<void> | null = null;

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

const ensureSupportSchema = async () => {
  if (supportSchemaPromise) {
    return supportSchemaPromise;
  }

  supportSchemaPromise = (async () => {
    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS app_config (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        time_updated timestamptz NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS permission_group (
        id text PRIMARY KEY,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
        user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        readonly boolean NOT NULL DEFAULT false,
        time_created timestamptz NOT NULL DEFAULT NOW(),
        time_updated timestamptz NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS prize (
        "bID" bigserial PRIMARY KEY,
        symbol text NOT NULL,
        name text NOT NULL,
        description text,
        url_image text,
        image_url text,
        points integer NOT NULL DEFAULT 0,
        market_floor_points integer NOT NULL DEFAULT 0,
        gift_limit integer NOT NULL DEFAULT 0,
        total_quantity integer NOT NULL DEFAULT 0,
        free_shard_ratio numeric NOT NULL DEFAULT 0,
        time_start timestamptz,
        time_end timestamptz,
        time_created timestamptz NOT NULL DEFAULT NOW(),
        time_updated timestamptz NOT NULL DEFAULT NOW(),
        time_actived timestamptz,
        name_en text,
        name_hk text,
        name_vn text,
        description_en text,
        description_hk text,
        description_vn text
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS market_order (
        "oID" bigserial PRIMARY KEY,
        "bID" integer NOT NULL,
        "uID" integer NOT NULL,
        side text NOT NULL CHECK (side IN ('buy', 'sell')),
        price integer NOT NULL CHECK (price > 0),
        volume_total integer NOT NULL CHECK (volume_total > 0),
        volume_filled integer NOT NULL DEFAULT 0 CHECK (volume_filled >= 0),
        status text NOT NULL DEFAULT 'open',
        time_created timestamptz NOT NULL DEFAULT NOW(),
        time_updated timestamptz NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS market_trade (
        "trID" bigserial PRIMARY KEY,
        "bID" integer NOT NULL,
        "buy_oID" bigint,
        "sell_oID" bigint,
        "buyer_uID" integer NOT NULL,
        "seller_uID" integer NOT NULL,
        price integer NOT NULL CHECK (price > 0),
        volume integer NOT NULL CHECK (volume > 0),
        time_created timestamptz NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS shard_transfer (
        "txID" bigserial PRIMARY KEY,
        "bID" integer NOT NULL,
        "from_uID" integer,
        "to_uID" integer,
        volume integer NOT NULL,
        reason text NOT NULL DEFAULT '',
        "related_oID" bigint,
        "related_trID" bigint,
        time_created timestamptz NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS shard (
        "sID" bigserial PRIMARY KEY,
        "bID" integer NOT NULL,
        "uID" integer NOT NULL,
        time_created timestamptz NOT NULL DEFAULT NOW(),
        volume integer NOT NULL DEFAULT 0
      )
    `;

    await sql`ALTER TABLE IF EXISTS "user" ADD COLUMN IF NOT EXISTS "bio" text DEFAULT ''`;
    await sql`ALTER TABLE IF EXISTS "user" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false`;
    await sql`ALTER TABLE IF EXISTS "user" ADD COLUMN IF NOT EXISTS "time_login_last" timestamptz DEFAULT NOW()`;

    await sql`ALTER TABLE IF EXISTS asset ADD COLUMN IF NOT EXISTS points integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS asset ADD COLUMN IF NOT EXISTS lucks integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS asset ADD COLUMN IF NOT EXISTS "time_updated" timestamptz DEFAULT NOW()`;

    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS points integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS market_floor_points integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS gift_limit integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS total_quantity integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS free_shard_ratio numeric DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS image_url text`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS name_en text`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS name_hk text`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS name_vn text`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS description_en text`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS description_hk text`;
    await sql`ALTER TABLE IF EXISTS prize ADD COLUMN IF NOT EXISTS description_vn text`;

    await sql`
      DO $$
      BEGIN
        IF to_regclass('public.brand') IS NOT NULL THEN
          INSERT INTO prize (
            "bID",
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
            time_updated,
            time_actived,
            name_en,
            name_hk,
            name_vn,
            description_en,
            description_hk,
            description_vn
          )
          SELECT
            COALESCE((to_jsonb(legacy_brand)->>'bID')::bigint, 0),
            COALESCE(to_jsonb(legacy_brand)->>'symbol', ''),
            COALESCE(to_jsonb(legacy_brand)->>'name', ''),
            NULLIF(to_jsonb(legacy_brand)->>'description', ''),
            NULLIF(to_jsonb(legacy_brand)->>'url_image', ''),
            COALESCE(NULLIF(to_jsonb(legacy_brand)->>'image_url', ''), NULLIF(to_jsonb(legacy_brand)->>'url_image', '')),
            COALESCE((to_jsonb(legacy_brand)->>'points')::int, 0),
            COALESCE((to_jsonb(legacy_brand)->>'market_floor_points')::int, 0),
            COALESCE((to_jsonb(legacy_brand)->>'gift_limit')::int, 0),
            COALESCE((to_jsonb(legacy_brand)->>'total_quantity')::int, COALESCE((to_jsonb(legacy_brand)->>'gift_limit')::int, 0)),
            COALESCE((to_jsonb(legacy_brand)->>'free_shard_ratio')::numeric, 0),
            CASE
              WHEN NULLIF(to_jsonb(legacy_brand)->>'time_start', '') IS NULL THEN NULL
              WHEN (to_jsonb(legacy_brand)->>'time_start') ~ '^[0-9]+([.][0-9]+)?$' THEN TO_TIMESTAMP(
                CASE
                  WHEN LENGTH(SPLIT_PART(to_jsonb(legacy_brand)->>'time_start', '.', 1)) > 10
                    THEN (to_jsonb(legacy_brand)->>'time_start')::double precision / 1000.0
                  ELSE (to_jsonb(legacy_brand)->>'time_start')::double precision
                END
              )
              ELSE CAST(NULLIF(to_jsonb(legacy_brand)->>'time_start', '') AS timestamptz)
            END,
            CASE
              WHEN NULLIF(to_jsonb(legacy_brand)->>'time_end', '') IS NULL THEN NULL
              WHEN (to_jsonb(legacy_brand)->>'time_end') ~ '^[0-9]+([.][0-9]+)?$' THEN TO_TIMESTAMP(
                CASE
                  WHEN LENGTH(SPLIT_PART(to_jsonb(legacy_brand)->>'time_end', '.', 1)) > 10
                    THEN (to_jsonb(legacy_brand)->>'time_end')::double precision / 1000.0
                  ELSE (to_jsonb(legacy_brand)->>'time_end')::double precision
                END
              )
              ELSE CAST(NULLIF(to_jsonb(legacy_brand)->>'time_end', '') AS timestamptz)
            END,
            COALESCE(
              CASE
                WHEN NULLIF(to_jsonb(legacy_brand)->>'time_created', '') IS NULL THEN NULL
                WHEN (to_jsonb(legacy_brand)->>'time_created') ~ '^[0-9]+([.][0-9]+)?$' THEN TO_TIMESTAMP(
                  CASE
                    WHEN LENGTH(SPLIT_PART(to_jsonb(legacy_brand)->>'time_created', '.', 1)) > 10
                      THEN (to_jsonb(legacy_brand)->>'time_created')::double precision / 1000.0
                    ELSE (to_jsonb(legacy_brand)->>'time_created')::double precision
                  END
                )
                ELSE CAST(NULLIF(to_jsonb(legacy_brand)->>'time_created', '') AS timestamptz)
              END,
              NOW()
            ),
            COALESCE(
              CASE
                WHEN NULLIF(to_jsonb(legacy_brand)->>'time_updated', '') IS NULL THEN NULL
                WHEN (to_jsonb(legacy_brand)->>'time_updated') ~ '^[0-9]+([.][0-9]+)?$' THEN TO_TIMESTAMP(
                  CASE
                    WHEN LENGTH(SPLIT_PART(to_jsonb(legacy_brand)->>'time_updated', '.', 1)) > 10
                      THEN (to_jsonb(legacy_brand)->>'time_updated')::double precision / 1000.0
                    ELSE (to_jsonb(legacy_brand)->>'time_updated')::double precision
                  END
                )
                ELSE CAST(NULLIF(to_jsonb(legacy_brand)->>'time_updated', '') AS timestamptz)
              END,
              NOW()
            ),
            CASE
              WHEN NULLIF(to_jsonb(legacy_brand)->>'time_actived', '') IS NULL THEN NULL
              WHEN (to_jsonb(legacy_brand)->>'time_actived') ~ '^[0-9]+([.][0-9]+)?$' THEN TO_TIMESTAMP(
                CASE
                  WHEN LENGTH(SPLIT_PART(to_jsonb(legacy_brand)->>'time_actived', '.', 1)) > 10
                    THEN (to_jsonb(legacy_brand)->>'time_actived')::double precision / 1000.0
                  ELSE (to_jsonb(legacy_brand)->>'time_actived')::double precision
                END
              )
              ELSE CAST(NULLIF(to_jsonb(legacy_brand)->>'time_actived', '') AS timestamptz)
            END,
            NULLIF(to_jsonb(legacy_brand)->>'name_en', ''),
            NULLIF(to_jsonb(legacy_brand)->>'name_hk', ''),
            NULLIF(to_jsonb(legacy_brand)->>'name_vn', ''),
            NULLIF(to_jsonb(legacy_brand)->>'description_en', ''),
            NULLIF(to_jsonb(legacy_brand)->>'description_hk', ''),
            NULLIF(to_jsonb(legacy_brand)->>'description_vn', '')
          FROM brand AS legacy_brand
          ON CONFLICT ("bID") DO UPDATE SET
            symbol = EXCLUDED.symbol,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            url_image = EXCLUDED.url_image,
            image_url = EXCLUDED.image_url,
            points = EXCLUDED.points,
            market_floor_points = EXCLUDED.market_floor_points,
            gift_limit = EXCLUDED.gift_limit,
            total_quantity = EXCLUDED.total_quantity,
            free_shard_ratio = EXCLUDED.free_shard_ratio,
            time_start = EXCLUDED.time_start,
            time_end = EXCLUDED.time_end,
            time_created = EXCLUDED.time_created,
            time_updated = EXCLUDED.time_updated,
            time_actived = EXCLUDED.time_actived,
            name_en = EXCLUDED.name_en,
            name_hk = EXCLUDED.name_hk,
            name_vn = EXCLUDED.name_vn,
            description_en = EXCLUDED.description_en,
            description_hk = EXCLUDED.description_hk,
            description_vn = EXCLUDED.description_vn;
        END IF;
      END
      $$;
    `;

    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS points integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS type integer DEFAULT 0`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS "linkA" text`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS title_en text`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS title_hk text`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS title_vn text`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS note_en text`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS note_hk text`;
    await sql`ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS note_vn text`;

    await sql`ALTER TABLE IF EXISTS journey ADD COLUMN IF NOT EXISTS time_submitted timestamptz`;
    await sql`ALTER TABLE IF EXISTS journey ADD COLUMN IF NOT EXISTS points_claimed integer DEFAULT 0`;

    await sql`ALTER TABLE IF EXISTS gift ADD COLUMN IF NOT EXISTS time_claimed timestamptz`;
  })().catch((error) => {
    supportSchemaPromise = null;
    throw error;
  });

  return supportSchemaPromise;
};

export interface AssetRecord {
  index_id: number;
  uID: number;
  points: number;
  lucks: number;
  time_update: number;
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
}

export type PrizeRecord = BrandRecord;

export interface GiftRecord {
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
}

export interface JourneyRecord {
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

export interface PendingVerificationRecord extends JourneyRecord {
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

const normalizeAsset = (row: RawRow): AssetRecord => ({
  index_id: toNumberValue(getValue(row, 'index_id', 'aID', 'id')),
  uID: toNumberValue(getValue(row, 'uID')),
  points: toNumberValue(getValue(row, 'points')),
  lucks: toNumberValue(getValue(row, 'lucks')),
  time_update: toTimestamp(getValue(row, 'time_update', 'time_updated')),
});

const normalizeUser = (row: RawRow): UserRecord => ({
  uID: toNumberValue(getValue(row, 'uID', 'id')),
  EVM: toStringValue(getValue(row, 'EVM', 'evm_address')),
  bio: toStringValue(getValue(row, 'bio')),
  is_admin: toBooleanValue(getValue(row, 'is_admin')),
  time_reg: toTimestamp(getValue(row, 'time_reg', 'created_at')),
  time_login_last: toTimestamp(getValue(row, 'time_login_last', 'updated_at')),
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
  return {
    bID: toNumberValue(getValue(row, 'bID')),
    symbol: toStringValue(getValue(row, 'symbol')),
    name: toStringValue(getValue(row, 'name')),
    description: toStringValue(getValue(row, 'description')),
    image_url: imageUrl,
    url_image: imageUrl,
    points: toNumberValue(getValue(row, 'points')),
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
    name_en: toStringValue(getValue(row, 'name_en')),
    name_hk: toStringValue(getValue(row, 'name_hk')),
    name_vn: toStringValue(getValue(row, 'name_vn')),
    description_en: toStringValue(getValue(row, 'description_en')),
    description_hk: toStringValue(getValue(row, 'description_hk')),
    description_vn: toStringValue(getValue(row, 'description_vn')),
  };
};

const normalizeGift = (row: RawRow): GiftRecord => ({
  gID: toNumberValue(getValue(row, 'gID')),
  bID: toNumberValue(getValue(row, 'bID')),
  uID: toNumberValue(getValue(row, 'uID')),
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_claimed: toTimestamp(getValue(row, 'time_claimed')),
  time_actived: toTimestamp(getValue(row, 'time_actived')),
});

const normalizeTask = (row: RawRow, participantsCount = 0): TaskRecord => {
  const linkA = toStringValue(getValue(row, 'linkA', 'link0'));
  const isOpenValue = getValue(row, 'is_open');
  return {
    tID: toNumberValue(getValue(row, 'tID', 'ttID')),
    title: toStringValue(getValue(row, 'title')),
    note: toStringValue(getValue(row, 'note')),
    refcode: toStringValue(getValue(row, 'refcode')),
    link0: toStringValue(getValue(row, 'link0', 'linkA')),
    linkA,
    linkB: toStringValue(getValue(row, 'linkB')),
    points: toNumberValue(getValue(row, 'points')),
    type: toNumberValue(getValue(row, 'type')),
    time_start: toTimestamp(getValue(row, 'time_start')),
    time_end: toTimestamp(getValue(row, 'time_end')),
    time_created: toTimestamp(getValue(row, 'time_created', 'created_at')),
    time_updated: toTimestamp(getValue(row, 'time_updated', 'updated_at')),
    is_open: isOpenValue === undefined ? true : toBooleanValue(isOpenValue),
    participants_count: participantsCount,
    title_en: toStringValue(getValue(row, 'title_en')),
    title_hk: toStringValue(getValue(row, 'title_hk')),
    title_vn: toStringValue(getValue(row, 'title_vn')),
    note_en: toStringValue(getValue(row, 'note_en')),
    note_hk: toStringValue(getValue(row, 'note_hk')),
    note_vn: toStringValue(getValue(row, 'note_vn')),
  };
};

const normalizeJourney = (row: RawRow): JourneyRecord => ({
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

const normalizeMarketOrder = (
  row: RawRow,
  brand?: BrandRecord | null,
): MarketOrderRecord => ({
  oID: toNumberValue(getValue(row, 'oID', 'id')),
  bID: toNumberValue(getValue(row, 'bID')),
  uID: toNumberValue(getValue(row, 'uID')),
  side: toStringValue(getValue(row, 'side')) === 'sell' ? 'sell' : 'buy',
  price: toNumberValue(getValue(row, 'price')),
  volume_total: toNumberValue(getValue(row, 'volume_total')),
  volume_filled: toNumberValue(getValue(row, 'volume_filled')),
  status: toStringValue(getValue(row, 'status')) || 'open',
  time_created: toTimestamp(getValue(row, 'time_created')),
  time_updated: toTimestamp(getValue(row, 'time_updated')),
  symbol: brand?.symbol || toStringValue(getValue(row, 'symbol', 'brand_symbol')),
  brand_name: brand?.name || toStringValue(getValue(row, 'brand_name', 'name')),
});

const normalizeMarketTrade = (
  row: RawRow,
  brand?: BrandRecord | null,
): MarketTradeRecord => ({
  trID: toNumberValue(getValue(row, 'trID', 'id')),
  bID: toNumberValue(getValue(row, 'bID')),
  buy_oID: toNumberValue(getValue(row, 'buy_oID')),
  sell_oID: toNumberValue(getValue(row, 'sell_oID')),
  buyer_uID: toNumberValue(getValue(row, 'buyer_uID')),
  seller_uID: toNumberValue(getValue(row, 'seller_uID')),
  price: toNumberValue(getValue(row, 'price')),
  volume: toNumberValue(getValue(row, 'volume')),
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

export class DatabaseService {
  static async listLegacyBrandRows(skip = 0, limit = 100): Promise<RawRow[]> {
    const sql = getSql();
    try {
      return extractRows(await sql`
        SELECT to_jsonb(b) AS row
        FROM brand AS b
        ORDER BY COALESCE((to_jsonb(b)->>'bID')::int, 0)
        LIMIT ${limit} OFFSET ${skip}
      `);
    } catch {
      return [];
    }
  }

  static async getLegacyBrandRowById(bID: number): Promise<RawRow | null> {
    const sql = getSql();
    try {
      return firstRow(await sql`
        SELECT to_jsonb(b) AS row
        FROM brand AS b
        WHERE COALESCE((to_jsonb(b)->>'bID')::int, 0) = ${bID}
        LIMIT 1
      `);
    } catch {
      return null;
    }
  }

  static async listLegacyTaskRows(skip = 0, limit = 100): Promise<RawRow[]> {
    const sql = getSql();
    try {
      return extractRows(await sql`
        SELECT to_jsonb(t) AS row
        FROM task_type AS t
        ORDER BY COALESCE((to_jsonb(t)->>'ttID')::int, 0)
        LIMIT ${limit} OFFSET ${skip}
      `);
    } catch {
      return [];
    }
  }

  static async getLegacyTaskRowById(tID: number): Promise<RawRow | null> {
    const sql = getSql();
    try {
      return firstRow(await sql`
        SELECT to_jsonb(t) AS row
        FROM task_type AS t
        WHERE COALESCE((to_jsonb(t)->>'ttID')::int, 0) = ${tID}
        LIMIT 1
      `);
    } catch {
      return null;
    }
  }

  static async getBrandAggregateCounts(): Promise<Map<number, BrandAggregateCounts>> {
    const sql = getSql();
    let giftRows: Array<{
      bid: number;
      stores_count: number;
      claims_count: number;
      activated_count: number;
    }> = [];
    let shardRows: Array<{ bid: number; volume: number }> = [];
    let transferRows: Array<{ bid: number; volume: number }> = [];

    try {
      [giftRows, shardRows, transferRows] = await Promise.all([
        asItems<{
          bid: number;
          stores_count: number;
          claims_count: number;
          activated_count: number;
        }>(await sql`
          SELECT
            COALESCE((to_jsonb(g)->>'bID')::int, 0) AS bid,
            COUNT(1) FILTER (
              WHERE COALESCE((to_jsonb(g)->>'uID')::int, 0) = 0
            )::int AS stores_count,
            COUNT(1) FILTER (
              WHERE COALESCE((to_jsonb(g)->>'uID')::int, 0) <> 0
            )::int AS claims_count,
            COUNT(1) FILTER (
              WHERE COALESCE((to_jsonb(g)->>'uID')::int, 0) <> 0
                AND COALESCE(NULLIF(TRIM(COALESCE(to_jsonb(g)->>'time_actived', '')), ''), '') <> ''
            )::int AS activated_count
          FROM gift AS g
          GROUP BY bid
        `),
        asItems<{ bid: number; volume: number }>(await sql`
          SELECT
            COALESCE((to_jsonb(s)->>'bID')::int, 0) AS bid,
            COALESCE(SUM(COALESCE((to_jsonb(s)->>'volume')::int, 0)), 0)::int AS volume
          FROM shard AS s
          GROUP BY bid
        `),
        asItems<{ bid: number; volume: number }>(await sql`
          SELECT
            COALESCE((to_jsonb(st)->>'bID')::int, 0) AS bid,
            COALESCE(SUM(COALESCE((to_jsonb(st)->>'volume')::int, 0)), 0)::int AS volume
          FROM shard_transfer AS st
          WHERE COALESCE(to_jsonb(st)->>'reason', '') = 'free_chest'
          GROUP BY bid
        `),
      ]);
    } catch (error) {
      console.warn('Failed to load brand aggregate counts, falling back to zero counts:', error);
    }

    const counts = new Map<number, BrandAggregateCounts>();
    const ensureCounts = (bID: number) => {
      if (!counts.has(bID)) {
        counts.set(bID, {
          stores_count: 0,
          claims_count: 0,
          activated_count: 0,
          current_shard_supply: 0,
          free_shards_distributed: 0,
        });
      }
      return counts.get(bID)!;
    };

    for (const row of giftRows) {
      const entry = ensureCounts(Number(row.bid || 0));
      entry.stores_count = Number(row.stores_count || 0);
      entry.claims_count = Number(row.claims_count || 0);
      entry.activated_count = Number(row.activated_count || 0);
    }

    for (const row of shardRows) {
      ensureCounts(Number(row.bid || 0)).current_shard_supply = Number(row.volume || 0);
    }

    for (const row of transferRows) {
      ensureCounts(Number(row.bid || 0)).free_shards_distributed = Number(row.volume || 0);
    }

    return counts;
  }

  static async getTaskParticipantCounts(): Promise<Map<number, number>> {
    const sql = getSql();
    try {
      const rows = asItems<{ tid: number; count: number }>(await sql`
        SELECT
          COALESCE((to_jsonb(j)->>'tID')::int, 0) AS tid,
          COUNT(1)::int AS count
        FROM journey AS j
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
        SELECT to_jsonb(u) AS row
        FROM "user" AS u
        ORDER BY COALESCE((to_jsonb(u)->>'uID')::int, 0)
        LIMIT ${limit} OFFSET ${skip}
      `);
      return rows.map(normalizeUser);
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  static async getUserById(uID: number): Promise<UserRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT to_jsonb(u) AS row
      FROM "user" AS u
      WHERE COALESCE((to_jsonb(u)->>'uID')::int, 0) = ${uID}
      LIMIT 1
    `);

    return row ? normalizeUser(row) : null;
  }

  static async getUserByEvm(evmAddress: string): Promise<UserRecord | null> {
    const sql = getSql();
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();
    const row = firstRow(await sql`
      SELECT to_jsonb(u) AS row
      FROM "user" AS u
      WHERE LOWER(COALESCE(to_jsonb(u)->>'EVM', to_jsonb(u)->>'evm_address', '')) = ${normalizedAddress}
      LIMIT 1
    `);

    return row ? normalizeUser(row) : null;
  }

  static async createUserByEvm(evmAddress: string): Promise<UserRecord> {
    const sql = getSql();
    const normalizedAddress = String(evmAddress || '').trim().toLowerCase();

    try {
      const row = firstRow(await sql`
        INSERT INTO "user" AS u ("EVM", "bio", "is_admin", "time_reg", "time_login_last")
        VALUES (${normalizedAddress}, '', false, NOW(), NOW())
        RETURNING to_jsonb(u) AS row
      `);
      if (!row) throw new Error('User insert returned no row');
      return normalizeUser(row);
    } catch (primaryError) {
      const row = firstRow(await sql`
        INSERT INTO "user" AS u (evm_address, bio, is_admin, created_at, updated_at)
        VALUES (${normalizedAddress}, '', false, NOW(), NOW())
        RETURNING to_jsonb(u) AS row
      `);
      if (!row) {
        throw primaryError;
      }
      return normalizeUser(row);
    }
  }

  static async touchUserLogin(uID: number): Promise<void> {
    const sql = getSql();

    try {
      await sql`
        UPDATE "user" AS u
        SET "time_login_last" = NOW()
        WHERE COALESCE((to_jsonb(u)->>'uID')::int, 0) = ${uID}
      `;
    } catch (primaryError) {
      await sql`
        UPDATE "user" AS u
        SET updated_at = NOW()
        WHERE COALESCE((to_jsonb(u)->>'uID')::int, 0) = ${uID}
      `;
      console.warn('Fell back to updated_at for user login time:', primaryError);
    }
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
    const isAdmin = fields.is_admin;

    try {
      const row = firstRow(await sql`
        UPDATE "user" AS u
        SET "bio" = COALESCE(${bio}, "bio"),
            "is_admin" = COALESCE(${isAdmin}, "is_admin")
        WHERE COALESCE((to_jsonb(u)->>'uID')::int, 0) = ${uID}
        RETURNING to_jsonb(u) AS row
      `);
      return row ? normalizeUser(row) : null;
    } catch (primaryError) {
      const row = firstRow(await sql`
        UPDATE "user" AS u
        SET bio = COALESCE(${bio}, bio),
            is_admin = COALESCE(${isAdmin}, is_admin),
            updated_at = NOW()
        WHERE COALESCE((to_jsonb(u)->>'uID')::int, 0) = ${uID}
        RETURNING to_jsonb(u) AS row
      `);
      if (!row) {
        console.warn('Failed to update user profile:', primaryError);
        return null;
      }
      return normalizeUser(row);
    }
  }

  static async getUserAsset(uID: number): Promise<AssetRecord | null> {
    try {
      const sql = getSql();
      const row = firstRow(await sql`
        SELECT to_jsonb(a) AS row
        FROM asset AS a
        WHERE COALESCE((to_jsonb(a)->>'uID')::int, 0) = ${uID}
        LIMIT 1
      `);
      return row ? normalizeAsset(row) : null;
    } catch (error) {
      console.error('Error getting user asset:', error);
      return null;
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
        WHERE COALESCE((to_jsonb(a)->>'uID')::int, 0) = ${uID}
        RETURNING to_jsonb(a) AS row
      `);

      if (!row) {
        throw new Error('Failed to update asset');
      }

      return normalizeAsset(row);
    }

    const row = firstRow(await sql`
      INSERT INTO asset AS a ("uID", points, lucks, "time_updated")
      VALUES (${uID}, ${pointsDelta}, 0, NOW())
      RETURNING to_jsonb(a) AS row
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

  static async adjustPoints(
    uID: number,
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; message: string; asset?: AssetRecord }> {
    try {
      const existingAsset = await this.getUserAsset(uID);
      if (!existingAsset) {
        return {
          success: false,
          message: '用户资产记录不存在',
        };
      }

      const updatedAsset = await this.upsertAsset(uID, amount);
      console.log(`[API] 积分调整结果: 用户${uID}, 金额${amount}, 原因: ${reason}`);
      return {
        success: true,
        message: '积分调整成功',
        asset: updatedAsset,
      };
    } catch (error) {
      console.error('Error adjusting points:', error);
      return {
        success: false,
        message: '积分调整失败',
      };
    }
  }

  static async listBrands(skip = 0, limit = 100): Promise<BrandRecord[]> {
    await ensureSupportSchema();
    const sql = getSql();
    let prizeRows: RawRow[] = [];
    try {
      prizeRows = extractRows(await sql`
        SELECT to_jsonb(b) AS row
        FROM prize AS b
        ORDER BY COALESCE((to_jsonb(b)->>'bID')::int, 0)
        LIMIT ${limit} OFFSET ${skip}
      `);
    } catch {
      prizeRows = [];
    }
    const rows = prizeRows.length > 0 ? prizeRows : await this.listLegacyBrandRows(skip, limit);
    const counts = await this.getBrandAggregateCounts();

    return rows.map((row) => {
      const bID = toNumberValue(getValue(row, 'bID'));
      const aggregate = counts.get(bID);
      return normalizeBrand(row, aggregate);
    });
  }

  static async countGiftStoresByBrand(bID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ count: number }>(await sql`
      SELECT COUNT(1)::int AS count
      FROM gift AS g
      WHERE COALESCE((to_jsonb(g)->>'bID')::int, 0) = ${bID}
        AND COALESCE((to_jsonb(g)->>'uID')::int, 0) = 0
    `);
    return Number(rows[0]?.count || 0);
  }

  static async countGiftClaimsByBrand(bID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ count: number }>(await sql`
      SELECT COUNT(1)::int AS count
      FROM gift AS g
      WHERE COALESCE((to_jsonb(g)->>'bID')::int, 0) = ${bID}
        AND COALESCE((to_jsonb(g)->>'uID')::int, 0) <> 0
    `);
    return Number(rows[0]?.count || 0);
  }

  static async countGiftActivatedByBrand(bID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ count: number }>(await sql`
      SELECT COUNT(1)::int AS count
      FROM gift AS g
      WHERE COALESCE((to_jsonb(g)->>'bID')::int, 0) = ${bID}
        AND COALESCE((to_jsonb(g)->>'uID')::int, 0) <> 0
        AND COALESCE(NULLIF(TRIM(COALESCE(to_jsonb(g)->>'time_actived', '')), ''), '') <> ''
    `);
    return Number(rows[0]?.count || 0);
  }

  static async getCurrentShardSupplyByBrand(bID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ volume: number }>(await sql`
      SELECT COALESCE(SUM(COALESCE((to_jsonb(s)->>'volume')::int, 0)), 0)::int AS volume
      FROM shard AS s
      WHERE COALESCE((to_jsonb(s)->>'bID')::int, 0) = ${bID}
    `);
    return Number(rows[0]?.volume || 0);
  }

  static async countFreeShardsDistributedByBrand(bID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ volume: number }>(await sql`
      SELECT COALESCE(SUM(COALESCE((to_jsonb(st)->>'volume')::int, 0)), 0)::int AS volume
      FROM shard_transfer AS st
      WHERE COALESCE((to_jsonb(st)->>'bID')::int, 0) = ${bID}
        AND COALESCE(to_jsonb(st)->>'reason', '') = 'free_chest'
    `);
    return Number(rows[0]?.volume || 0);
  }

  static async listGiftsByUser(uID: number, skip = 0, limit = 200): Promise<GiftRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(g) AS row
      FROM gift AS g
      WHERE COALESCE((to_jsonb(g)->>'uID')::int, 0) = ${uID}
      ORDER BY COALESCE((to_jsonb(g)->>'gID')::int, 0) DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizeGift);
  }

  static async listTasks(skip = 0, limit = 100): Promise<TaskRecord[]> {
    const sql = getSql();
    let primaryRows: RawRow[] = [];
    try {
      primaryRows = extractRows(await sql`
        SELECT to_jsonb(t) AS row
        FROM task AS t
        ORDER BY COALESCE((to_jsonb(t)->>'tID')::int, 0)
        LIMIT ${limit} OFFSET ${skip}
      `);
    } catch {
      primaryRows = [];
    }
    const rows = primaryRows.length > 0 ? primaryRows : await this.listLegacyTaskRows(skip, limit);
    const participantCounts = await this.getTaskParticipantCounts();

    return rows.map((row) => {
      const tID = toNumberValue(getValue(row, 'tID', 'ttID'));
      return normalizeTask(row, participantCounts.get(tID) || 0);
    });
  }

  static async getTask(tID: number): Promise<TaskRecord | null> {
    const sql = getSql();
    let row: RawRow | null = null;
    try {
      row = firstRow(await sql`
        SELECT to_jsonb(t) AS row
        FROM task AS t
        WHERE COALESCE((to_jsonb(t)->>'tID')::int, 0) = ${tID}
        LIMIT 1
      `);
    } catch {
      row = null;
    }

    const legacyRow = row || await this.getLegacyTaskRowById(tID);
    if (!legacyRow) return null;
    const participantsCount = await this.countTaskParticipants(tID);
    return normalizeTask(legacyRow, participantsCount);
  }

  static async countTaskParticipants(tID: number): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ count: number }>(await sql`
      SELECT COUNT(1)::int AS count
      FROM journey AS j
      WHERE COALESCE((to_jsonb(j)->>'tID')::int, 0) = ${tID}
    `);
    return Number(rows[0]?.count || 0);
  }

  static async getJourney(jID: number): Promise<JourneyRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT to_jsonb(j) AS row
      FROM journey AS j
      WHERE COALESCE((to_jsonb(j)->>'jID')::int, 0) = ${jID}
      LIMIT 1
    `);

    return row ? normalizeJourney(row) : null;
  }

  static async listJourneysByUser(uID: number, skip = 0, limit = 100): Promise<JourneyRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(j) AS row
      FROM journey AS j
      WHERE COALESCE((to_jsonb(j)->>'uID')::int, 0) = ${uID}
      ORDER BY COALESCE((to_jsonb(j)->>'jID')::int, 0) DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    return rows.map(normalizeJourney);
  }

  static async findJourneyByUserAndTask(uID: number, tID: number): Promise<JourneyRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT to_jsonb(j) AS row
      FROM journey AS j
      WHERE COALESCE((to_jsonb(j)->>'uID')::int, 0) = ${uID}
        AND COALESCE((to_jsonb(j)->>'tID')::int, 0) = ${tID}
      ORDER BY COALESCE((to_jsonb(j)->>'jID')::int, 0) DESC
      LIMIT 1
    `);

    return row ? normalizeJourney(row) : null;
  }

  static async createJourney(uID: number, tID: number): Promise<JourneyRecord> {
    const sql = getSql();
    const row = firstRow(await sql`
      INSERT INTO journey AS j ("tID", "uID", info_input, time_created, points_claimed)
      VALUES (${tID}, ${uID}, NULL, NOW(), 0)
      RETURNING to_jsonb(j) AS row
    `);

    if (!row) {
      throw new Error('Failed to create journey');
    }

    return normalizeJourney(row);
  }

  static async ensureJourneyForUserTask(uID: number, tID: number): Promise<JourneyRecord> {
    const existingJourney = await this.findJourneyByUserAndTask(uID, tID);
    if (existingJourney) {
      return existingJourney;
    }

    return this.createJourney(uID, tID);
  }

  static async submitJourneyInfo(jID: number, infoInput: string): Promise<JourneyRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE journey AS j
      SET info_input = ${infoInput},
          time_submitted = NOW()
      WHERE COALESCE((to_jsonb(j)->>'jID')::int, 0) = ${jID}
      RETURNING to_jsonb(j) AS row
    `);

    return row ? normalizeJourney(row) : null;
  }

  static async markJourneyChecked(jID: number): Promise<JourneyRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE journey AS j
      SET time_checked = NOW()
      WHERE COALESCE((to_jsonb(j)->>'jID')::int, 0) = ${jID}
      RETURNING to_jsonb(j) AS row
    `);

    return row ? normalizeJourney(row) : null;
  }

  static async claimJourney(jID: number, rewardPoints: number): Promise<JourneyRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE journey AS j
      SET points_claimed = ${rewardPoints},
          time_claimed = NOW()
      WHERE COALESCE((to_jsonb(j)->>'jID')::int, 0) = ${jID}
      RETURNING to_jsonb(j) AS row
    `);

    return row ? normalizeJourney(row) : null;
  }

  static async listPendingVerification(skip = 0, limit = 50): Promise<PendingVerificationRecord[]> {
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(j) AS row
      FROM journey AS j
      WHERE COALESCE(NULLIF(TRIM(COALESCE(to_jsonb(j)->>'info_input', '')), ''), '') <> ''
        AND COALESCE(to_jsonb(j)->>'time_checked', '') = ''
        AND COALESCE(to_jsonb(j)->>'time_claimed', '') = ''
      ORDER BY COALESCE((to_jsonb(j)->>'time_submitted')::timestamptz, (to_jsonb(j)->>'time_created')::timestamptz) DESC NULLS LAST,
               COALESCE((to_jsonb(j)->>'jID')::int, 0) DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const items = await Promise.all(rows.map(async (row) => {
      const journey = normalizeJourney(row);
      const [task, user] = await Promise.all([
        this.getTask(journey.tID),
        this.getUserById(journey.uID),
      ]);

      return {
        ...journey,
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
      FROM journey AS j
      WHERE COALESCE(NULLIF(TRIM(COALESCE(to_jsonb(j)->>'info_input', '')), ''), '') <> ''
        AND COALESCE(to_jsonb(j)->>'time_checked', '') = ''
        AND COALESCE(to_jsonb(j)->>'time_claimed', '') = ''
    `);
    return Number(rows[0]?.count || 0);
  }

  static async rejectPendingJourney(jID: number): Promise<JourneyRecord | null> {
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE journey AS j
      SET info_input = NULL,
          time_submitted = NULL
      WHERE COALESCE((to_jsonb(j)->>'jID')::int, 0) = ${jID}
      RETURNING to_jsonb(j) AS row
    `);

    return row ? normalizeJourney(row) : null;
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
    await ensureSupportSchema();
    const sql = getSql();
    let row: RawRow | null = null;
    try {
      row = firstRow(await sql`
        SELECT to_jsonb(b) AS row
        FROM prize AS b
        WHERE COALESCE((to_jsonb(b)->>'bID')::int, 0) = ${bID}
        LIMIT 1
      `);
    } catch {
      row = null;
    }

    const targetRow = row || await this.getLegacyBrandRowById(bID);
    if (!targetRow) {
      return null;
    }

    const [storesCount, claimsCount, activatedCount, currentShardSupply, freeShardsDistributed] = await Promise.all([
      this.countGiftStoresByBrand(bID),
      this.countGiftClaimsByBrand(bID),
      this.countGiftActivatedByBrand(bID),
      this.getCurrentShardSupplyByBrand(bID),
      this.countFreeShardsDistributedByBrand(bID),
    ]);

    return normalizeBrand(targetRow, {
      stores_count: storesCount,
      claims_count: claimsCount,
      activated_count: activatedCount,
      current_shard_supply: currentShardSupply,
      free_shards_distributed: freeShardsDistributed,
    });
  }

  static async listPrizes(skip = 0, limit = 100): Promise<PrizeRecord[]> {
    return this.listBrands(skip, limit);
  }

  static async getPrizeById(bID: number): Promise<PrizeRecord | null> {
    return this.getBrandById(bID);
  }

  static async listPersistedPermissionGroups(): Promise<PermissionGroupRecord[]> {
    await ensureSupportSchema();
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(pg) AS row
      FROM permission_group AS pg
      ORDER BY pg.readonly DESC, pg.name ASC, pg.id ASC
    `);

    return rows.map(normalizePermissionGroup);
  }

  static async getPermissionsForUser(uID: number): Promise<string[]> {
    const groups = await this.listPersistedPermissionGroups();
    const permissions = groups.flatMap((group) => (
      group.user_ids.includes(uID) ? group.permissions : []
    ));
    return uniqueStrings(permissions);
  }

  static async resolveAdminAccess(user: UserRecord, isAdminAddress: boolean): Promise<AdminAccessRecord> {
    const extraPermissions = user.is_admin || isAdminAddress
      ? []
      : await this.getPermissionsForUser(user.uID);

    return this.buildAdminAccess(user, isAdminAddress, extraPermissions);
  }

  static async listPermissionGroups(): Promise<PermissionGroupRecord[]> {
    const [groups, users] = await Promise.all([
      this.listPersistedPermissionGroups(),
      this.getAllUsers(0, 10000),
    ]);

    const adminUserIds = users
      .filter((user) => user.is_admin)
      .map((user) => user.uID);

    return [
      {
        id: 'admin_access',
        name: '管理员访问',
        description: '系统内置只读权限组，映射完整后台访问权限。',
        permissions: [...ALL_ADMIN_PERMISSIONS],
        user_ids: uniqueNumbers(adminUserIds),
        readonly: true,
        time_created: 0,
        time_updated: 0,
      },
      {
        id: 'task_publishers',
        name: '任务发布组',
        description: '系统内置权限组，可进入后台并发布任务。',
        permissions: ['dashboard_access', 'publish_tasks'],
        user_ids: groups.find((group) => group.id === 'task_publishers')?.user_ids || [],
        readonly: false,
        time_created: 0,
        time_updated: 0,
      },
      {
        id: 'prize_publishers',
        name: '奖品发布组',
        description: '系统内置权限组，可进入后台并发布奖品。',
        permissions: ['dashboard_access', 'publish_prizes'],
        user_ids: groups.find((group) => group.id === 'prize_publishers')?.user_ids || [],
        readonly: false,
        time_created: 0,
        time_updated: 0,
      },
      ...groups.filter((group) => !['admin_access', 'task_publishers', 'prize_publishers'].includes(group.id)),
    ];
  }

  static async savePermissionGroup(input: {
    id?: string;
    name?: string;
    description?: string | null;
    permissions?: string[];
    user_ids?: number[];
  }): Promise<PermissionGroupRecord> {
    await ensureSupportSchema();

    const id = String(input.id || '').trim() || slugify(input.name || '') || `group-${Date.now()}`;
    if (id === 'admin_access') {
      throw new Error('System permission group is read-only');
    }

    const name = String(input.name || '').trim();
    if (!name) {
      throw new Error('Permission group name is required');
    }

    const permissions = uniqueStrings(
      (input.permissions || []).filter((permission) =>
        ALL_ADMIN_PERMISSIONS.includes(permission as typeof ALL_ADMIN_PERMISSIONS[number]),
      ),
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
    const row = firstRow(await sql`
      INSERT INTO permission_group AS pg (
        id,
        name,
        description,
        permissions,
        user_ids,
        readonly,
        time_created,
        time_updated
      )
      VALUES (
        ${id},
        ${name},
        ${String(input.description || '').trim()},
        ${JSON.stringify(permissions)}::jsonb,
        ${JSON.stringify(userIDs)}::jsonb,
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions,
        user_ids = EXCLUDED.user_ids,
        time_updated = NOW()
      RETURNING to_jsonb(pg) AS row
    `);

    if (!row) {
      throw new Error('Failed to save permission group');
    }

    return normalizePermissionGroup(row);
  }

  static async deletePermissionGroup(id: string): Promise<boolean> {
    await ensureSupportSchema();

    if (id === 'admin_access') {
      throw new Error('System permission group is read-only');
    }

    const sql = getSql();
    const existing = firstRow(await sql`
      SELECT to_jsonb(pg) AS row
      FROM permission_group AS pg
      WHERE pg.id = ${id}
      LIMIT 1
    `);

    if (!existing) {
      return false;
    }

    if (toBooleanValue(getValue(existing, 'readonly'))) {
      throw new Error('Readonly permission group cannot be deleted');
    }

    await sql`
      DELETE FROM permission_group
      WHERE id = ${id}
    `;
    return true;
  }

  static async getSystemSettings(): Promise<SystemSettingsRecord> {
    await ensureSupportSchema();
    const sql = getSql();
    const rows = asItems<{ value: unknown }>(await sql`
      SELECT value
      FROM app_config
      WHERE key = 'system_settings'
      LIMIT 1
    `);

    return normalizeSystemSettings(rows[0]?.value || DEFAULT_SYSTEM_SETTINGS);
  }

  static async saveSystemSettings(input: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord> {
    await ensureSupportSchema();
    const current = await this.getSystemSettings();
    const next = normalizeSystemSettings({
      ...current,
      ...(input || {}),
    });
    const sql = getSql();

    const rows = asItems<{ value: unknown }>(await sql`
      INSERT INTO app_config (key, value, time_updated)
      VALUES ('system_settings', ${JSON.stringify(next)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        time_updated = NOW()
      RETURNING value
    `);

    return normalizeSystemSettings(rows[0]?.value || next);
  }

  static async resetSystemSettings(): Promise<SystemSettingsRecord> {
    return this.saveSystemSettings({ ...DEFAULT_SYSTEM_SETTINGS });
  }

  static async updateUserAdminStatus(uID: number, isAdmin: boolean): Promise<UserRecord | null> {
    await ensureSupportSchema();
    return this.updateUserProfile(uID, { is_admin: isAdmin });
  }

  static async createPrizeInventoryRows(bID: number, count: number): Promise<void> {
    if (count <= 0) {
      return;
    }

    const sql = getSql();
    await sql`
      INSERT INTO gift AS g ("bID", "uID", time_created)
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
      DELETE FROM gift
      WHERE "gID" IN (
        SELECT COALESCE((to_jsonb(g)->>'gID')::int, 0)
        FROM gift AS g
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
    await ensureSupportSchema();
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
    await ensureSupportSchema();
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
    await ensureSupportSchema();
    const sql = getSql();
    const [giftRows, orderRows, tradeRows, shardRows] = await Promise.all([
      asItems<{ count: number }>(await sql`
        SELECT COUNT(1)::int AS count
        FROM gift AS g
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
    await ensureSupportSchema();
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
    await ensureSupportSchema();
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
    await ensureSupportSchema();
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

  static async listShardHoldingsByUser(uID: number, skip = 0, limit = 100): Promise<ShardHoldingRecord[]> {
    await ensureSupportSchema();
    const sql = getSql();
    const rows = asItems<RawRow>(await sql`
      SELECT
        MIN(COALESCE((to_jsonb(s)->>'sID')::bigint, 0))::int AS "sID",
        COALESCE((to_jsonb(s)->>'bID')::int, 0) AS "bID",
        COALESCE((to_jsonb(s)->>'uID')::int, 0) AS "uID",
        SUM(COALESCE((to_jsonb(s)->>'volume')::int, 0))::int AS volume,
        MAX(COALESCE((to_jsonb(s)->>'time_created')::timestamptz, NOW())) AS time_created
      FROM shard AS s
      WHERE COALESCE((to_jsonb(s)->>'uID')::int, 0) = ${uID}
      GROUP BY COALESCE((to_jsonb(s)->>'bID')::int, 0), COALESCE((to_jsonb(s)->>'uID')::int, 0)
      HAVING SUM(COALESCE((to_jsonb(s)->>'volume')::int, 0)) > 0
      ORDER BY COALESCE((to_jsonb(s)->>'bID')::int, 0)
      LIMIT ${limit} OFFSET ${skip}
    `);

    const brandCache = new Map<number, BrandRecord | null>();
    return Promise.all(rows.map(async (row) => {
      const bID = toNumberValue(getValue(row, 'bID'));
      if (!brandCache.has(bID)) {
        brandCache.set(bID, await this.getBrandById(bID));
      }
      return normalizeShardHolding(row, brandCache.get(bID) || null);
    }));
  }

  static async getUserShardBalance(uID: number, bID: number): Promise<number> {
    await ensureSupportSchema();
    const sql = getSql();
    const rows = asItems<{ volume: number }>(await sql`
      SELECT COALESCE(SUM(COALESCE((to_jsonb(s)->>'volume')::int, 0)), 0)::int AS volume
      FROM shard AS s
      WHERE COALESCE((to_jsonb(s)->>'uID')::int, 0) = ${uID}
        AND COALESCE((to_jsonb(s)->>'bID')::int, 0) = ${bID}
    `);
    return Number(rows[0]?.volume || 0);
  }

  static async createShardLedgerEntry(uID: number, bID: number, delta: number): Promise<void> {
    await ensureSupportSchema();
    if (!delta) {
      return;
    }

    const sql = getSql();
    await sql`
      INSERT INTO shard AS s ("bID", "uID", time_created, volume)
      VALUES (${bID}, ${uID}, NOW(), ${delta})
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
    await ensureSupportSchema();
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
      RETURNING to_jsonb(st) AS row
    `);

    if (!row) {
      return null;
    }

    const brand = await this.getBrandById(input.bID);
    return normalizeShardTransfer(row, brand);
  }

  static async listShardTransfersByUser(uID: number, skip = 0, limit = 100): Promise<ShardTransferRecord[]> {
    await ensureSupportSchema();
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(st) AS row
      FROM shard_transfer AS st
      WHERE COALESCE((to_jsonb(st)->>'from_uID')::int, 0) = ${uID}
         OR COALESCE((to_jsonb(st)->>'to_uID')::int, 0) = ${uID}
      ORDER BY COALESCE((to_jsonb(st)->>'time_created')::timestamptz, NOW()) DESC,
               COALESCE((to_jsonb(st)->>'txID')::bigint, 0) DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const brandCache = new Map<number, BrandRecord | null>();
    return Promise.all(rows.map(async (row) => {
      const bID = toNumberValue(getValue(row, 'bID'));
      if (!brandCache.has(bID)) {
        brandCache.set(bID, await this.getBrandById(bID));
      }
      return normalizeShardTransfer(row, brandCache.get(bID) || null);
    }));
  }

  static async getMarketOrderById(oID: number): Promise<MarketOrderRecord | null> {
    await ensureSupportSchema();
    const sql = getSql();
    const row = firstRow(await sql`
      SELECT to_jsonb(o) AS row
      FROM market_order AS o
      WHERE COALESCE((to_jsonb(o)->>'oID')::bigint, 0) = ${oID}
      LIMIT 1
    `);

    if (!row) {
      return null;
    }

    const brand = await this.getBrandById(toNumberValue(getValue(row, 'bID')));
    return normalizeMarketOrder(row, brand);
  }

  static async updateMarketOrderFill(oID: number, fillDelta: number): Promise<MarketOrderRecord | null> {
    await ensureSupportSchema();
    const sql = getSql();
    const row = firstRow(await sql`
      UPDATE market_order AS o
      SET volume_filled = LEAST(volume_total, volume_filled + ${fillDelta}),
          status = CASE
            WHEN volume_filled + ${fillDelta} >= volume_total THEN 'filled'
            ELSE 'partial'
          END,
          time_updated = NOW()
      WHERE COALESCE((to_jsonb(o)->>'oID')::bigint, 0) = ${oID}
      RETURNING to_jsonb(o) AS row
    `);

    if (!row) {
      return null;
    }

    const brand = await this.getBrandById(toNumberValue(getValue(row, 'bID')));
    return normalizeMarketOrder(row, brand);
  }

  static async findMatchingOrder(order: MarketOrderRecord): Promise<MarketOrderRecord | null> {
    await ensureSupportSchema();
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
          SELECT to_jsonb(o) AS row
          FROM market_order AS o
          WHERE COALESCE((to_jsonb(o)->>'bID')::int, 0) = ${order.bID}
            AND side = 'sell'
            AND COALESCE((to_jsonb(o)->>'uID')::int, 0) <> ${order.uID}
            AND status IN ('open', 'partial')
            AND COALESCE((to_jsonb(o)->>'price')::int, 0) <= ${order.price}
            AND COALESCE((to_jsonb(o)->>'volume_total')::int, 0) > COALESCE((to_jsonb(o)->>'volume_filled')::int, 0)
          ORDER BY COALESCE((to_jsonb(o)->>'price')::int, 0) ASC,
                   COALESCE((to_jsonb(o)->>'time_created')::timestamptz, NOW()) ASC,
                   COALESCE((to_jsonb(o)->>'oID')::bigint, 0) ASC
          LIMIT 1
        `)
      : firstRow(await sql`
          SELECT to_jsonb(o) AS row
          FROM market_order AS o
          WHERE COALESCE((to_jsonb(o)->>'bID')::int, 0) = ${order.bID}
            AND side = 'buy'
            AND COALESCE((to_jsonb(o)->>'uID')::int, 0) <> ${order.uID}
            AND status IN ('open', 'partial')
            AND COALESCE((to_jsonb(o)->>'price')::int, 0) >= ${Math.max(order.price, minimumShardPrice)}
            AND COALESCE((to_jsonb(o)->>'volume_total')::int, 0) > COALESCE((to_jsonb(o)->>'volume_filled')::int, 0)
          ORDER BY COALESCE((to_jsonb(o)->>'price')::int, 0) DESC,
                   COALESCE((to_jsonb(o)->>'time_created')::timestamptz, NOW()) ASC,
                   COALESCE((to_jsonb(o)->>'oID')::bigint, 0) ASC
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
    await ensureSupportSchema();
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
      RETURNING to_jsonb(t) AS row
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
    await ensureSupportSchema();
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(o) AS row
      FROM market_order AS o
      WHERE COALESCE((to_jsonb(o)->>'uID')::int, 0) = ${uID}
      ORDER BY COALESCE((to_jsonb(o)->>'time_created')::timestamptz, NOW()) DESC,
               COALESCE((to_jsonb(o)->>'oID')::bigint, 0) DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const brandCache = new Map<number, BrandRecord | null>();
    return Promise.all(rows.map(async (row) => {
      const bID = toNumberValue(getValue(row, 'bID'));
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
    await ensureSupportSchema();
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
      RETURNING to_jsonb(o) AS row
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
    await ensureSupportSchema();
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
      WHERE COALESCE((to_jsonb(o)->>'oID')::bigint, 0) = ${oID}
      RETURNING to_jsonb(o) AS row
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
    await ensureSupportSchema();
    const sql = getSql();
    const rows = asItems<MarketOrderBookRow>(await sql`
      SELECT
        side,
        price,
        SUM(volume_total - volume_filled)::int AS volume
      FROM market_order AS o
      WHERE COALESCE((to_jsonb(o)->>'bID')::int, 0) = ${bID}
        AND status IN ('open', 'partial')
        AND volume_total > volume_filled
      GROUP BY side, price
      ORDER BY side ASC, price DESC
    `);

    return rows.map((row) => ({
      side: row.side === 'sell' ? 'sell' : 'buy',
      price: toNumberValue(row.price),
      volume: toNumberValue(row.volume),
    }));
  }

  static async listTradesByBrand(bID: number, skip = 0, limit = 50): Promise<MarketTradeRecord[]> {
    await ensureSupportSchema();
    const sql = getSql();
    const rows = extractRows(await sql`
      SELECT to_jsonb(t) AS row
      FROM market_trade AS t
      WHERE COALESCE((to_jsonb(t)->>'bID')::int, 0) = ${bID}
      ORDER BY COALESCE((to_jsonb(t)->>'time_created')::timestamptz, NOW()) DESC,
               COALESCE((to_jsonb(t)->>'trID')::bigint, 0) DESC
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
    await ensureSupportSchema();
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

  static async redeemShardGift(uID: number, bID: number): Promise<GiftRecord> {
    await ensureSupportSchema();
    const holdings = await this.getUserShardBalance(uID, bID);
    if (holdings < 1000) {
      throw new Error('Insufficient shards to redeem gift');
    }

    const sql = getSql();
    const availableGift = firstRow(await sql`
      SELECT to_jsonb(g) AS row
      FROM gift AS g
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
      UPDATE gift AS g
      SET "uID" = ${uID},
          time_claimed = NOW(),
          time_actived = COALESCE(time_actived, NOW())
      WHERE COALESCE((to_jsonb(g)->>'gID')::int, 0) = ${gID}
      RETURNING to_jsonb(g) AS row
    `);

    if (!row) {
      throw new Error('Failed to redeem gift');
    }

    return normalizeGift(row);
  }

  static buildAdminAccess(
    user: UserRecord,
    isAdminAddress: boolean,
    extraPermissions: string[] = [],
  ): AdminAccessRecord {
    const isAdmin = user.is_admin || isAdminAddress;
    const permissions = isAdmin
      ? [...ALL_ADMIN_PERMISSIONS]
      : uniqueStrings(extraPermissions);
    const canAccessAdmin = isAdmin || permissions.length > 0;

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
