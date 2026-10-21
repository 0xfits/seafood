// ============================================================================
// src/listing-service.ts — P4-B2b · 商品（listing）**非资金**写入与状态机（内部 service 层）
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md v0.1
//   §1 #42/#43/#44（`/api/admin/prize/*` 弃用面）· §1 #16（`/api/prize-item` 正式化）
//   §1.1:130（`POST /api/listing` = 批 2 · **直 DML · 无分录 · create_key 幂等**）
//   §4.2 P1（商品上架/编辑/下架：`public.listing`，状态机 draft→listed→{delisted,frozen}→listed，delisted 终态）
//   §4.0 R3（无分录的写**不得**借账本幂等 ⇒ 业务侧 create_key + 状态机）
//   §4.0 R5 / §4.6 批 2 ②（**只做非资金**：purchase/sale/refund/hold… 一律归批 3）
//   §4.4-6（币种状态闸：商品标价只允许 `listed` 单位；保留 uid 前置闸）· DL125
//   §3.1/§3.2/§3.3（404 三类 / 逐码适用条件 / R107 收尾规则）· §4.5（创建键前缀与字符集）
//   §1.2 母约束（批 2/批 3「既有路径 = 唯一对外路径」⇒ §4.1 新命名只作**内部 service 命名**）
//
// 硬边界（本文件自证）：
//   · **不 import** ./ledger、./commission ⇒ 无编排函数调用、无 ledger_entry/account/currency 写。
//   · 只写 `public.listing`（`migrations/0015_listing.sql:115-140` 的既有 13 列；**不增删列**）。
//   · 本模块**不**实现 buy/refund/交付（§4.2 P2/P3/P4 ⇒ 批 3，禁半实现：无分录的「状态落了、钱没动」= 静默欠款）。
//   · 路径注册：`POST /api/listing` **本片不注册**（§1.2 + 派单硬口径 #2「注册点须仍为 51」），
//     本模块**仅**以 service 直调交付（HTTP 层读数见报告 §3.2/§4）。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService, isListingEditAdminAccess, type ListingEditAdminAccess } from './database';
import {
  ITEM_ID_CREATE_ATTEMPTS,
  codeFromSnowflake,
  isItemIdUniqueViolation,
  nextSnowflake,
} from './item-id';
import { errorMessageOf } from './ledger-errors';
import {
  ledgerErrorBody,
  sendGone,
  sendVerbError,
  type VerbErr,
  type VerbResult,
} from './verb-shape';

export { ledgerErrorBody, sendGone, sendVerbError };
export type { VerbErr, VerbResult };

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状）--------------------------------
const fail = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  message?: string,
): VerbErr => ({
  ok: false,
  status,
  code,
  message: message ?? errorMessageOf(code),
  details,
  authDomain: code.startsWith('AUTH_'),
});

/** §3.1：detail-miss（单资源读不到 / 写目标不存在）一律 404 + `details.ref_type/ref_id` **必填** */
const gone404 = (refType: string, refId: string | number): VerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: refType, ref_id: String(refId) }, 'Referenced object not found');

/** §3.2：业务状态机非法转移 ⇒ 409 + 借码 `LEDGER_CURRENCY_INVALID_TRANSITION` + details.field + reason 大写（DL119/C5） */
const stateConflict = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', { field, reason, ...extra }, 'Business state transition rejected');

const keyError = (details: Record<string, unknown>): VerbErr =>
  fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', details, 'Idempotency key is invalid');

/**
 * §3.2 形状闸 ⇒ 400 + 借码 `LEDGER_AMOUNT_INVALID`（零新错误码）。
 * ★ S55：改为 **export**（`listingShapeError`），供路由层复用同一构造 —— `PATCH /api/listing/:listingId`
 *   的「状态+字段混传 / 空体」两支在**路由层**就判 400（不必进 service 打 DB），但**形状必须逐字同源**
 *   （同一 `code/message`，只换 `details.field/reason`）⇒ 单一真源、不复制体例。
 */
export const listingShapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

const shapeError = listingShapeError;

// ---- 创建键（§4.5：前缀只允许 biz:/cm:/cli:/ops:；禁 `#` 与控制字符；顺序固定）----
const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'];
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const CONTROL_CHARS_TEST = (value: string) => CONTROL_CHARS.test(value);

const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);

/**
 * §4.5：调用方给 `create_key` 时按序校验（TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER）；
 * 未给时派生**确定性**键 `cli:p4b2c:listing:<verb>:<parts>:<digest>`（同一请求重试 ⇒ 同键 ⇒ 200 重放）。
 * 登记：派生键**不构成**「账本幂等键」（§4.0 R3 / DL99：无分录的写靠业务侧 create_key）。
 */
export const resolveListingCreateKey = (
  raw: unknown,
  fallbackParts: Array<string | number>,
): { ok: true; key: string; derived: boolean } | { ok: false; details: Record<string, unknown> } => {
  const provided = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!provided) {
    return { ok: true, key: `cli:p4b2c:listing:${fallbackParts.join(':')}:${digest(fallbackParts.join('|'))}`, derived: true };
  }
  if (provided.length > 200) return { ok: false, details: { field: 'create_key', reason: 'TOO_LONG' } };
  if (!KEY_PREFIXES.some((prefix) => provided.startsWith(prefix))) {
    return { ok: false, details: { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: KEY_PREFIXES } };
  }
  if (provided.includes('#')) return { ok: false, details: { field: 'create_key', reason: 'RESERVED_SEPARATOR' } };
  if (CONTROL_CHARS_TEST(provided)) return { ok: false, details: { field: 'create_key', reason: 'CONTROL_CHARACTER' } };
  return { ok: true, key: provided, derived: false };
};

// ---- 商品分类枚举（迁移 0054 换集；承 0053）----------------------------------
// 闭集唯一真源 = `migrations/0054_item_type_delivery_split.sql` 的 CHECK
// （'DigitalAutoDeliver' / 'DigitalManualDeliver' / 'PhysicalFreeShip' / 'PhysicalBuyerShip'）；
// 本常量与之逐字一致（含顺序），仅作**入参闸**（不落库、不派生）。
// 语义：DigitalAutoDeliver = 数字商品·自动发货 · DigitalManualDeliver = 数字商品·手动发货
//        PhysicalFreeShip = 实物包邮 · PhysicalBuyerShip = 实物买家付运费。
// ★ **裸值 `Digital`**（0053 的旧三值之一）**已退役** ⇒ 传它 = 闭集外 ⇒ 400（负控见 s53/s54 门）；
//   注意新值 `DigitalAutoDeliver` / `DigitalManualDeliver` 只是**带前缀的新名**，与裸值 `Digital` 不互认。
export const ITEM_TYPES = ['DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/**
 * `item_type` 入参规范化（§3.2 形状闸，体例对齐仓内闭集闸 `compliance-review-service` /
 * `currency-review-service`）：未传 / `null` ⇒ `null`（= 未分类，存量行同义）；
 * **空串 / 闭集外 / 非字符串 / 大小写不符 ⇒ 400** `LEDGER_AMOUNT_INVALID` + `details.field='listing.item_type'`
 * + `reason`（`NOT_A_STRING` / `NOT_IN_CLOSED_SET` + `provided`/`allowed`）——零新错误码（33 码闭集不动）。
 */
export const normalizeItemType = (
  raw: unknown,
): { ok: true; value: ItemType | null } | { ok: false; err: VerbErr } => {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, err: shapeError('listing.item_type', 'NOT_A_STRING') };
  const text = raw.trim();
  if (!(ITEM_TYPES as readonly string[]).includes(text)) {
    return {
      ok: false,
      err: fail(
        400,
        'LEDGER_AMOUNT_INVALID',
        { field: 'listing.item_type', reason: 'NOT_IN_CLOSED_SET', provided: text, allowed: [...ITEM_TYPES] },
        'Request shape is invalid',
      ),
    };
  }
  return { ok: true, value: text as ItemType };
};

// ---- 商品成色枚举（迁移 0057）--------------------------------------------------
// 闭集唯一真源 = `migrations/0057_listing_view_count.sql` 的 CHECK
// （'BrandNewSealed' / 'LikeNew' / 'MinorWear' / 'HeavyWear'）；本常量与之逐字一致（含顺序），
// 仅作**入参闸**（不落库、不派生、不做中文名翻译 —— 显示名由前端 i18n 按 `condition` 字面量映射）。
// 语义：BrandNewSealed = 全新未拆封 · LikeNew = 几乎全新
//        MinorWear = 细微磕碰划痕 · HeavyWear = 严重磨损。
// ★ **数字商品不适用**（Kevin 2026-10-20）：非空成色仅允许 `item_type ∈ PHYSICAL_ITEM_TYPES`
//   （PhysicalFreeShip / PhysicalBuyerShip）；数字两分类 / 未分类（item_type NULL）带值 ⇒ 400。
export const ITEM_CONDITIONS = ['BrandNewSealed', 'LikeNew', 'MinorWear', 'HeavyWear'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];
export const PHYSICAL_ITEM_TYPES = ['PhysicalFreeShip', 'PhysicalBuyerShip'] as const;

/**
 * `item_condition` 入参规范化（与 `normalizeItemType` 同体例）：未传 / `null` ⇒ `null`（= 无成色）；
 * **空串 / 闭集外 / 非字符串 / 大小写不符 ⇒ 400** `LEDGER_AMOUNT_INVALID` + `details.field='listing.item_condition'`
 * + `reason`（`NOT_A_STRING` / `NOT_IN_CLOSED_SET` + `provided`/`allowed`）——零新错误码（33 码闭集不动）。
 */
export const normalizeItemCondition = (
  raw: unknown,
): { ok: true; value: ItemCondition | null } | { ok: false; err: VerbErr } => {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, err: shapeError('listing.item_condition', 'NOT_A_STRING') };
  const text = raw.trim();
  if (!(ITEM_CONDITIONS as readonly string[]).includes(text)) {
    return {
      ok: false,
      err: fail(
        400,
        'LEDGER_AMOUNT_INVALID',
        { field: 'listing.item_condition', reason: 'NOT_IN_CLOSED_SET', provided: text, allowed: [...ITEM_CONDITIONS] },
        'Request shape is invalid',
      ),
    };
  }
  return { ok: true, value: text as ItemCondition };
};

/**
 * 成色适用性（**纯函数**，创建与 PATCH 共用同一闸）：非空成色仅允许实物两分类。
 * `itemType = null`（未分类）或数字两分类 + 带值成色 ⇒ 400 `ITEM_CONDITION_NOT_APPLICABLE`
 * （借既有 `LEDGER_AMOUNT_INVALID`，零新错误码；`requires_item_type` = 实物两分类可机读指引）。
 */
export const itemConditionApplicabilityError = (
  itemType: ItemType | null,
  condition: ItemCondition | null,
): VerbErr | null =>
  condition === null || (itemType !== null && (PHYSICAL_ITEM_TYPES as readonly string[]).includes(itemType))
    ? null
    : fail(
        400,
        'LEDGER_AMOUNT_INVALID',
        {
          field: 'listing.item_condition',
          reason: 'ITEM_CONDITION_NOT_APPLICABLE',
          item_type: itemType,
          requires_item_type: [...PHYSICAL_ITEM_TYPES],
        },
        'Request shape is invalid',
      );

// ---- 多件购买授权（迁移 0061 · route §49.17.2/§49.17.3 · data §40.13.2）----------
/**
 * `allow_multi_buy` **入参形状闸**（W6 · 严格布尔）。
 *
 * 只收 JSON `true` / `false`；`undefined` = **未传**（⇒ `value = null`，交给归一规则）。
 * **字符串 `'true'` / `'1'` / `'0'`、数字 `1` / `0`、`null`（显式传值）一律 400**
 * `LEDGER_AMOUNT_INVALID` + `details:{field:'listing.allow_multi_buy', reason:'NOT_A_BOOLEAN'}`
 * （零新错误码 —— 33 码闭集不动）。
 * ★ 为什么连 `'false'` 串也拒：JS 里 `Boolean('false') === true` ⇒ 收串 = 前端一个笔误就把
 *   「关」落成「开」，而这个开关直接放大成交件数（data §40.13.3）。
 */
export const normalizeAllowMultiBuy = (
  raw: unknown,
): { ok: true; value: boolean | null } | { ok: false; err: VerbErr } => {
  if (raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'boolean') {
    return {
      ok: false,
      err: fail(
        400,
        'LEDGER_AMOUNT_INVALID',
        {
          field: 'listing.allow_multi_buy',
          reason: 'NOT_A_BOOLEAN',
          provided_type: raw === null ? 'null' : typeof raw,
          provided: typeof raw === 'string' ? raw.slice(0, 16) : undefined,
        },
        'Request shape is invalid',
      ),
    };
  }
  return { ok: true, value: raw };
};

/**
 * 归一 / 400 的**唯一不变式**（W3 / W7 · data §40.13.2 #3）：显式 `true` ∧ 生效 `stock <= 1`
 * ⇒ 400 `MULTI_BUY_NOT_APPLICABLE`（借码 `LEDGER_AMOUNT_INVALID`，`details.stock` 带生效值）。
 * ★ 库面**不设**该跨列约束（`stock` 随购买递减 ⇒ 写进 CHECK 会打断正常购买）；故这是唯一闸。
 * ★ 与「未传 ⇒ 归一 false」（W1 / W5）**不得混成同一个行为**（MB-N2）：
 *   · 显式 `true` + `stock ≤ 1` ⇒ **400**（调用方以为开了、实际关了 = 最难的账实不符）；
 *   · 未传 + 生效 `stock ≤ 1` ⇒ **归一 false**（合法编辑，不 400）。
 */
export const multiBuyApplicabilityError = (
  allowMultiBuy: boolean | null,
  effectiveStock: number,
  listingId?: number,
): VerbErr | null =>
  allowMultiBuy === true && effectiveStock <= 1
    ? fail(
        400,
        'LEDGER_AMOUNT_INVALID',
        {
          field: 'listing.allow_multi_buy',
          reason: 'MULTI_BUY_NOT_APPLICABLE',
          stock: effectiveStock,
          min_stock: 2,
          ...(listingId === undefined ? {} : { listing_id: String(listingId) }),
        },
        'Request shape is invalid',
      )
    : null;

// ---- 派生标题（`listing.title` 退场后的唯一口径）------------------------------
// ★★ 2026-10-20 Kevin 数据模型指令：**取消商品标题字段，正文并入 `description`**
//   · 标题 = 描述首个 `\n` 之前（`split_part(description, E'\n', 1)`）；
//   · 无回车 ⇒ 整段即标题；
//   · **存储层不截断**（原文完整入 `description`；显示层 48 显示宽单位 + `...` 由前端做）。
// 本函数 = SQL 派生式 `split_part(description, E'\n', 1)` 的 **JS 同源实现**（离线门/单测用它，
//   保证「服务层口径」与「读口 SQL 口径」逐字一致；不得出现第二个派生算法）。
export const deriveListingTitle = (description: unknown): string => {
  const text = typeof description === 'string' ? description : '';
  const cut = text.indexOf('\n');
  return cut >= 0 ? text.slice(0, cut) : text;
};

// ---- 入参规范化（§3.2：形状非法 ⇒ 400；金额 = 最小单位整数，§4.4-9）----------
type IntOk = { ok: true; value: number };
type IntErr = { ok: false; err: VerbErr };

const toBigIntLike = (raw: unknown, field: string, min: number): IntOk | IntErr => {
  const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
  if (!/^-?\d+$/.test(text)) return { ok: false, err: shapeError(field, 'NOT_AN_INTEGER') };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { ok: false, err: shapeError(field, 'OUT_OF_RANGE') };
  if (value < min) {
    return {
      ok: false,
      err: min > 0
        ? fail(400, 'LEDGER_AMOUNT_NOT_POSITIVE', { field, value: text }, 'Amount must be positive')
        : shapeError(field, 'NEGATIVE_OR_NON_INTEGER'),
    };
  }
  return { ok: true, value };
};

const toOptionalText = (raw: unknown, field: string): { ok: true; value: string | null } | IntErr => {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, err: shapeError(field, 'NOT_A_STRING') };
  return { ok: true, value: raw };
};

const toOptionalUrls = (raw: unknown): { ok: true; value: string[] | null } | IntErr => {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (!Array.isArray(raw) || raw.some((u) => typeof u !== 'string')) {
    return { ok: false, err: shapeError('listing.media_urls', 'NOT_A_STRING_ARRAY') };
  }
  return { ok: true, value: raw as string[] };
};

// ---- 币种状态闸（§4.4-6 / DL125：商品标价只允许 `listed` 单位）---------------
const currencyGate = async (cid: number): Promise<VerbErr | null> => {
  const currency = await DatabaseService.getCurrencyStatus(cid);
  if (!currency) {
    return fail(404, 'LEDGER_CURRENCY_NOT_FOUND', { cid: String(cid) }, 'Currency not found');
  }
  switch (currency.status) {
    case 'listed':
      return null;
    case 'draft':
      return fail(409, 'LEDGER_CURRENCY_NOT_LISTED', { cid: String(cid), status: currency.status }, 'Currency not listed');
    case 'frozen':
      return fail(423, 'LEDGER_CURRENCY_FROZEN', { cid: String(cid), status: currency.status }, 'Currency frozen');
    case 'delisted':
      return fail(409, 'LEDGER_CURRENCY_DELISTED', { cid: String(cid), status: currency.status }, 'Currency delisted');
    default:
      return fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', { field: 'currency.status', reason: 'UNKNOWN_CURRENCY_STATUS', status: currency.status, cid: String(cid) }, 'Unknown currency status');
  }
};

/** §4.4-6 前置闸：平台/保留 uid（`<= 0`）不得作为商品卖家 */
const reservedUidGate = (uid: number, field: string): VerbErr | null =>
  Number.isInteger(uid) && uid > 0 ? null : fail(400, 'LEDGER_RESERVED_UID', { field, value: String(uid) }, 'Reserved uid is not allowed');

// ---- 创建指纹（可重构口径，见报告 §4.2 自曝）--------------------------------
// `public.listing` 只有 DL59 的 13 列、**无指纹列**（migrations 冻结、不得加列）⇒
// 同键重投的指纹按**可重构不变子集**判定：`seller_uid, cid, price, description, media_urls`
// （排除可变列 `stock` / `status`：二者由本模块的 update/transition 正常变更，若纳入会把合法重投误判为 409）。
// ★★ 2026-10-20 Kevin 数据模型指令（`title` 退场、正文并入 `description`）⇒ 指纹集**去 `title`**：
//   字段数 6 → 5。指纹集是「创建幂等判据」的冻结口径，`description` 已承载全部正文（含标题），
//   不再有第二路文本 ⇒ 保留 `title` 会引用已 DROP 的列（且同键重投时 title 已无从取得）。
const fingerprintOf = (row: Record<string, unknown>) => JSON.stringify([
  Number(row.seller_uid),
  Number(row.cid),
  Number(row.price),
  String(row.description ?? ''),
  Array.isArray(row.media_urls) ? row.media_urls.map(String) : null,
]);

// ---- P1-a · 上架（create；§4.2 P1）-----------------------------------------
/**
 * 上架（`POST /api/listing`）。
 *
 * ★★ 2026-10-20 Kevin 数据模型指令（**取消商品标题字段，正文并入 `description`**）：
 *   ① `title` **不再接受**：body 带**值** ⇒ 400 `NOT_SUPPORTED`（与 `updateListingDetails` 的
 *      `NOT_SUPPORTED` 同码同 `details.field='listing.title'` 同 `reason_detail`，单一真源）；
 *      `title: null` / 未传 = 不承载内容 ⇒ 放行（等价于不出现）。闸在**一切校验与 DB 之前**（非法 ⇒ 零 DB 调用）。
 *   ② `description` **必填**：trim 后为空（含未传 / `null` / 非字符串 / 纯空白）⇒ 400
 *      `LEDGER_AMOUNT_INVALID` + `details.reason='REQUIRED'`（承仓内既有 REQUIRED 体例）。
 *      存储**不截断**；标题由读口派生 `split_part(description, E'\n', 1)`（见 `deriveListingTitle`）。
 *   ③ 幂等指纹与派生键**去 `title`**（见 `fingerprintOf` / `resolveListingCreateKey` 的 fallbackParts）。
 */
export const createListing = async (params: {
  sellerUid: number;
  cid: number;
  price: unknown;
  stock: unknown;
  /** ★ 已退场字段：带**值**即 400 `NOT_SUPPORTED`（保留在类型里 = 能显式拒绝，不是能用） */
  title?: unknown;
  description?: unknown;
  mediaUrls?: unknown;
  /** 商品分类（迁移 0054 换集，承 0053）：闭集 `ItemType`（4 值），未传 ⇒ null（未分类）。仅创建时定，编辑/状态迁移不可改。 */
  itemType?: unknown;
  /** ★ 商品成色（迁移 0057）：闭集 `ItemCondition`（4 值），未传 ⇒ null（无成色）。
   *  **仅实物两分类允许非空**（数字两分类 / 未分类带值 ⇒ 400 `ITEM_CONDITION_NOT_APPLICABLE`，
   *  闸在 currencyGate 之前 ⇒ 零 DB 调用）。不进幂等指纹（与 `item_type` 同口径，见下方注释）。 */
  itemCondition?: unknown;
  /**
   * ★ 迁移 0061 多件购买授权（route §49.17.2）：可选布尔。
   *   · 未传 ⇒ 落 `false`（W1）；
   *   · `true` ∧ 生效 `stock >= 2` ⇒ 落 `true`（W2）；
   *   · `true` ∧ 生效 `stock <= 1` ⇒ **400 `MULTI_BUY_NOT_APPLICABLE`**（W3，零 DB）；
   *   · `false` ⇒ 落 `false`（W4）；
   *   · `'true'` / `1` / `'1'` / `null` ⇒ **400 `NOT_A_BOOLEAN`**（W6，零 DB）。
   * 不进幂等指纹（同键重投 ⇒ 200 replay 回库内真值，route §49.17.2 / MB-N4）。
   */
  allowMultiBuy?: unknown;
  createKeyRaw?: unknown;
}): Promise<VerbResult> => {
  const uidErr = reservedUidGate(Number(params.sellerUid), 'listing.seller_uid');
  if (uidErr) return uidErr;

  // ★ 第一道：退场字段即拒（先于任何字段校验与 DB；与 `updateListingDetails` 同一 field/reason 口径）
  if (params.title !== undefined && params.title !== null) {
    return listingShapeError('listing.title', 'NOT_SUPPORTED', {
      retired_fields: [...LISTING_RETIRED_FIELDS],
      reason_detail: 'listing.title retired: put the title on the first line of description',
      editable_when_creating: ['description', 'price', 'stock', 'media_urls', 'item_type', 'item_condition', 'allow_multi_buy'],
    });
  }

  const cid = toBigIntLike(params.cid, 'listing.cid', 1);
  if (!cid.ok) return cid.err;
  const price = toBigIntLike(params.price, 'listing.price', 1);
  if (!price.ok) return price.err;
  const stock = toBigIntLike(params.stock, 'listing.stock', 0);
  if (!stock.ok) return stock.err;
  const description = toOptionalText(params.description, 'listing.description');
  if (!description.ok) return description.err;
  // ★ 描述必填：trim 后非空（描述已承载标题 ⇒ 空描述 = 无标题可选）；存储**不截断**（原样入库）
  const descriptionText = description.value ?? '';
  if (!descriptionText.trim()) {
    return shapeError('listing.description', 'REQUIRED', {
      reason_detail: 'description is required: first line becomes the title',
    });
  }
  const mediaUrls = toOptionalUrls(params.mediaUrls);
  if (!mediaUrls.ok) return mediaUrls.err;
  // §3.2 形状闸：分类只允许四值闭集（非法 ⇒ 400，**早于**任何 DB 调用；`Digital` 已退役 = 非法）
  const itemType = normalizeItemType(params.itemType);
  if (!itemType.ok) return itemType.err;
  // ★ 商品成色（迁移 0057 · 承 item_type 同体例）：闭集四值 + **适用性**（仅实物两分类允许非空）。
  //   两闸都在 currencyGate 之前 ⇒ 非法值 / 数字带成色 / 未分类带成色 **零 DB 调用**。
  const itemCondition = normalizeItemCondition(params.itemCondition);
  if (!itemCondition.ok) return itemCondition.err;
  const conditionAppErr = itemConditionApplicabilityError(itemType.value, itemCondition.value);
  if (conditionAppErr) return conditionAppErr;

  // ★ 迁移 0061 多件购买授权（route §49.17.2 校验序 ②③④）：布尔形状闸 ⇒ 生效 stock（= 请求 stock，
  //   创建场景无行内现值）⇒ 归一 / 400。三闸都在 currencyGate 与任何 DB 调用之前。
  const allowMultiBuy = normalizeAllowMultiBuy(params.allowMultiBuy);
  if (!allowMultiBuy.ok) return allowMultiBuy.err;
  const multiBuyErr = multiBuyApplicabilityError(allowMultiBuy.value, stock.value);
  if (multiBuyErr) return multiBuyErr;
  // 未传 ⇒ false（W1）；显式 false ⇒ false（W4）；仅显式 true ∧ stock ≥ 2 才为 true（W2）
  const allowMultiBuyValue = allowMultiBuy.value === true;

  // ★ 派生键去 `title`（6 段 → 5 段）：同键重投的键不再随标题变化（标题已并入 description）
  const resolvedKey = resolveListingCreateKey(params.createKeyRaw, ['create', params.sellerUid, cid.value, price.value, stock.value]);
  if (!resolvedKey.ok) return keyError(resolvedKey.details);

  const gate = await currencyGate(cid.value);
  if (gate) return gate;

  // ★ 迁移 0060（Kevin 2026-10-20 指令第 3 条「统一商品 Id」）：对外标识两列由**服务层生成后写入**
  //   （DB 侧零 default —— 发号策略只在 `item-id.ts` 一处，可单测、门里可注入）。
  //   · 唯一冲突（23505 且落在 `snowflake_id` / `item_code` 两个具名唯一索引上）⇒ **重生重试 ≤3 次**：
  //     每次重取雪花（毫秒或序号必进）⇒ 7 位码随之变化 ⇒ 重试必然换码；
  //   · 3 次仍撞 ⇒ 上抛（发号器/码表异常是**缺陷**，不静默落半行、不编造 id）；
  //   · `create_key` 撞车**不进**本重试（幂等键语义，`isItemIdUniqueViolation` 已按名排除）。
  let write: Awaited<ReturnType<typeof DatabaseService.createListingRow>> | null = null;
  let idWriteError: unknown = null;
  for (let attempt = 0; attempt < ITEM_ID_CREATE_ATTEMPTS; attempt += 1) {
    const snowflake = nextSnowflake();
    try {
      write = await DatabaseService.createListingRow({
        sellerUid: Number(params.sellerUid),
        cid: cid.value,
        price: price.value,
        stock: stock.value,
        description: descriptionText,
        mediaUrls: mediaUrls.value || [],
        itemType: itemType.value,
        itemCondition: itemCondition.value,
        createKey: resolvedKey.key,
        snowflakeId: snowflake.toString(),
        itemCode: codeFromSnowflake(snowflake),
        allowMultiBuy: allowMultiBuyValue,
      });
      break;
    } catch (error) {
      if (!isItemIdUniqueViolation(error)) throw error;
      idWriteError = error;
    }
  }
  if (!write) throw idWriteError ?? new Error('createListing: listing id generation failed');

  // ★ 幂等指纹口径（迁移 0053 选择）：`item_type` **不进**指纹 —— 指纹字段集沿用既有 5 字段
  //   （`seller_uid, cid, price, description, media_urls`，见 `fingerprintOf` 上方注释：可重构不变子集、
  //   仓库面无指纹列；`title` 已按 2026-10-20 指令退出指纹，6 → 5）。理由：① 指纹集是**创建幂等判据**
  //   的冻结口径，扩列会把「同键同请求重放」的判定面改宽，影响的是**既有** create_key 的语义（本单不该动）；
  //   ② 分类**创建后不可变**（编辑/PATCH 均不写该列），同键重投带不同 item_type 属客户端误用 ⇒
  //   落 `replay`（200）并回**库内**真值 + `idempotent_replay: true`，客户端可据此发现分歧，无静默写入错误。
  //   ★ 迁移 0057：`item_condition` **同样不进**指纹（与 item_type 同口径 —— 可选创建属性、重放回库内真值）。

  if (write.outcome === 'existing') {
    if (fingerprintOf(write.row) !== JSON.stringify([Number(params.sellerUid), cid.value, price.value, descriptionText, mediaUrls.value || []])) {
      // §3.2 409：同键异指纹 ⇒ LEDGER_IDEMPOTENCY_CONFLICT
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { field: 'listing.create_key', reason: 'REPLAY_FINGERPRINT_MISMATCH', ref_id: resolvedKey.key }, 'Idempotency conflict');
    }
  }

  return {
    ok: true,
    replay: write.outcome === 'existing',
    view: { ...write.row, create_key: resolvedKey.key, created_key_derived: resolvedKey.derived },
  };
};

// ---- P1-b · 编辑（update；含**库存字段维护**；§4.2 P1）----------------------
/**
 * 旧编辑面（`POST /api/listing/:listingId`，语义分工：POST = 编辑 / PATCH = 状态迁移）。
 *
 * ★★ 2026-10-20 Kevin 数据模型指令（`listing.title` 退场、正文并入 `description`）：
 *   本口**不再接受 `title`** —— 带值即 400 `NOT_SUPPORTED`（与 `updateListingDetails` 逐字同码、
 *   同 `details.field='listing.title'`；`title: null` = 未传 ⇒ 放行）；只改
 *   `description` / `price` / `stock` / `media_urls`（`media_urls` 语义与 PATCH 同族）。
 *   校验顺序：退场字段闸 → 各字段形状闸 → 空体闸 → DB（非法形状 **零 DB 调用**）。
 */
export const updateListing = async (params: {
  listingId: number;
  actorUid: number;
  price?: unknown;
  stock?: unknown;
  /** ★ 已退场字段：透传进来即 400 `NOT_SUPPORTED`（保留在类型里 = 能显式拒绝，不是能用） */
  title?: unknown;
  description?: unknown;
  mediaUrls?: unknown;
}): Promise<VerbResult> => {
  const listingId = toBigIntLike(params.listingId, 'listing.listing_id', 1);
  if (!listingId.ok) return listingId.err;
  const uidErr = reservedUidGate(Number(params.actorUid), 'actor.uid');
  if (uidErr) return uidErr;

  // ★ 第一道：退场字段即拒（先于任何字段校验与 DB；与 `updateListingDetails` 同一 field/reason 口径）
  if (params.title !== undefined && params.title !== null) {
    return listingShapeError('listing.title', 'NOT_SUPPORTED', {
      retired_fields: [...LISTING_RETIRED_FIELDS],
      reason_detail: 'listing.title retired: edit description instead',
      editable_fields: [...LISTING_EDIT_FIELDS],
    });
  }

  let price: number | null = null;
  if (params.price !== undefined) {
    const parsed = toBigIntLike(params.price, 'listing.price', 1);
    if (!parsed.ok) return parsed.err;
    price = parsed.value;
  }
  let stock: number | null = null;
  if (params.stock !== undefined) {
    const parsed = toBigIntLike(params.stock, 'listing.stock', 0);
    if (!parsed.ok) return parsed.err;
    stock = parsed.value;
  }
  const description = toOptionalText(params.description, 'listing.description');
  if (!description.ok) return description.err;
  const mediaUrls = toOptionalUrls(params.mediaUrls);
  if (!mediaUrls.ok) return mediaUrls.err;

  if (price === null && stock === null && description.value === null && mediaUrls.value === null) {
    return shapeError('listing', 'NO_EDITABLE_FIELD', { editable_fields: [...LISTING_EDIT_FIELDS] });
  }

  const write = await DatabaseService.updateListingRow({
    listingId: listingId.value,
    actorUid: Number(params.actorUid),
    price,
    stock,
    description: description.value,
    mediaUrls: mediaUrls.value,
  });

  if (!write.row) return gone404('listing', listingId.value);
  switch (write.outcome) {
    case 'not_owner':
      // §6.2 附表：已参与但无该动作权限 ⇒ 403 + reason=ACTOR_NOT_ALLOWED（C6：不得借 LEDGER_HOLD_NOT_ALLOWED）
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', ref_type: 'listing', ref_id: String(listingId.value) });
    case 'stock_requires_listed':
      return stateConflict('listing.stock', 'listing_stock_change_requires_listed', { listing_id: String(listingId.value), status: write.row.status });
    case 'delisted_terminal':
      return stateConflict('listing.status', 'LISTING_STATE_INVALID', { listing_id: String(listingId.value), status: write.row.status, terminal: 'delisted' });
    default:
      break;
  }

  return { ok: true, replay: false, view: { ...write.row } };
};

// ---- P1-c · 状态迁移（上架 / 下架 / 冻结 / 复牌；§4.2 P1）-------------------
export const transitionListingStatus = async (params: {
  listingId: number;
  actorUid: number;
  toStatus: unknown;
}): Promise<VerbResult> => {
  const listingId = toBigIntLike(params.listingId, 'listing.listing_id', 1);
  if (!listingId.ok) return listingId.err;
  const uidErr = reservedUidGate(Number(params.actorUid), 'actor.uid');
  if (uidErr) return uidErr;
  const toStatus = typeof params.toStatus === 'string' ? params.toStatus.trim() : '';
  if (!toStatus) return shapeError('listing.status', 'NOT_A_STRING');

  const write = await DatabaseService.transitionListingRow(listingId.value, Number(params.actorUid), toStatus);
  if (!write.row) return gone404('listing', listingId.value);
  switch (write.outcome) {
    case 'not_owner':
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', ref_type: 'listing', ref_id: String(listingId.value) });
    case 'invalid_transition':
      // 白名单唯一真源 = `public.listing_status_transition_ok`（migrations/0015_listing.sql:83-95）
      return stateConflict('listing.status', 'LISTING_STATE_INVALID', { from: write.row.status, to: toStatus, listing_id: String(listingId.value) });
    default:
      break;
  }

  return { ok: true, replay: false, view: { ...write.row } };
};

// ============================================================================
// ★ S55（发布动作单 · Kevin 2026-10-20 口径）· P1-b′ **独立字段编辑**
//   `/profile/trades/published` 行内【编辑】= 独立页 `/item/:id/edit`（复用发布页表单：描述 / 价格 /
//   库存 / 图片 / 分类；★ `title` 已按 Kevin 2026-10-20 数据模型指令退场、正文并入 `description`）；
//   【降价】= 弹窗只改价（**必须低于当前价**，这条**业务规则在前端与门**，服务端只保证「合法价格」——
//   服务端不引入第二个价格写口语义，见报告「口径与自曝」）。
//
//   硬边界（本段自证）：
//     · **零新路由**（扩既有 `PATCH /api/listing/:listingId`）· **零迁移** · **零新错误码** ·
//       **零 ledger 写**（改价不涉资金 ⇒ 无分录、无幂等键；本文件仍不 import `./ledger`）。
//     · **可编辑态 = `draft` | `listed`**（`delisted` 终态 / `frozen` 冻结 = 只读 ⇒ 409）；
//     · **可改字段 = `description / price / stock / media_urls / item_type / item_condition / allow_multi_buy`**
//       （7 项 · `title` ⇒ 400 NOT_SUPPORTED；`item_code` / `snowflake_id` 不在集内）；
//     · **归属闸在 SQL 内**（`updateListingDetailsRow` 的 `not_owner`）⇒ 服务层只做码映射 ↦ 403，
//       与 `transitionListingStatus` 逐字同形（`AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`）。
// ============================================================================

/**
 * 可编辑字段闭集（`PATCH /api/listing/:listingId` 字段支；顺序即错误 `field_keys` 的列出顺序）
 * ★ 迁移 0061：第 7 项 `allow_multi_buy`（多件购买授权；与创建面 `editable_when_creating` 7 项同批）。
 *   `item_code` / `snowflake_id` **永不进本集**（对外标识两列 = 服务层生成，客户端不可写）。
 */
export const LISTING_EDIT_FIELDS = ['description', 'price', 'stock', 'media_urls', 'item_type', 'item_condition', 'allow_multi_buy'] as const;
export type ListingEditField = (typeof LISTING_EDIT_FIELDS)[number];

/**
 * **已退场字段**（2026-10-20 Kevin 数据模型指令：`listing.title` 取消、正文并入 `description`）：
 * 编辑/更新面**不得接受、不得校验** `title` —— 出现在 body 即 **400 `NOT_SUPPORTED`**
 * （借码 `LEDGER_AMOUNT_INVALID`，`details.field='listing.title'`；**零新错误码**，33 码闭集不动）。
 * ★ 不静默忽略：静默会把「前端还在发 title」这类误用藏起来（旧前端未升级时会以为改标题生效了）。
 * ★ 数据面（`DROP COLUMN title`）归**另一单**：本单零 DDL、零回填、不碰该列。
 */
export const LISTING_RETIRED_FIELDS = ['title'] as const;

/** 状态迁移别名（§4.2 P1 的 `to_status` / 前端常见写法 `status`）—— 与字段支**互斥** */
export const LISTING_STATUS_KEYS = ['to_status', 'status'] as const;

/** 图片张数上限 = 4（Kevin 2026-10-19 裁定「张数 ≤4、卡用第一张」· 发布页同口径；此处为**入参闸**） */
export const MAX_LISTING_MEDIA_ITEMS = 4;

/** 图片 URL 形态：只收媒体表读口形态 `/api/media/<数字 id>`（发布页上传回执即此形态） */
export const LISTING_MEDIA_URL_RE = /^\/api\/media\/\d+$/;

/**
 * `PATCH /api/listing/:listingId` 的 **verb 分类闸**（纯函数 · 零 DB）：
 *   · 含**已退场字段**（`title`）⇒ 400 `NOT_SUPPORTED`（最高优先：即使同时带状态键也先报这条，
 *     因为「发 title」本身就是要纠正的误用，不该进状态机）；
 *   · 同时出现「状态键」与「可编辑字段」⇒ 400 `STATUS_AND_FIELDS_EXCLUSIVE`（两支语义冲突，不猜）；
 *   · 只出现状态键 ⇒ `'status'`（走既有 `transitionListingStatus`）；
 *   · 只出现字段键 ⇒ `'fields'`（走 `updateListingDetails`）；
 *   · 两者都无 ⇒ 400 `NO_EDITABLE_FIELD`。
 * ★ 放在 service 而非路由内联：与 `listingShapeError` 同一构造、可离线判负（门直接调本函数），
 *   路由层只剩「分支 + 发送」。
 */
export type ListingPatchRoute =
  | { kind: 'fields'; fields: string[] }
  | { kind: 'status'; statusKeys: string[] }
  | { kind: 'invalid'; err: VerbErr };

export const classifyListingPatchBody = (body: Record<string, unknown>): ListingPatchRoute => {
  const b = body && typeof body === 'object' ? body : {};
  // `title: null` = 未传（不承载内容，等价于不出现）；只有**带值**的 title 才 400 NOT_SUPPORTED
  const retired = LISTING_RETIRED_FIELDS.filter((k) => b[k] !== undefined && b[k] !== null);
  if (retired.length) {
    return {
      kind: 'invalid',
      err: listingShapeError('listing.title', 'NOT_SUPPORTED', {
        retired_fields: [...retired],
        reason_detail: 'listing.title retired: edit description instead',
        editable_fields: [...LISTING_EDIT_FIELDS],
      }),
    };
  }
  const statusKeys = LISTING_STATUS_KEYS.filter((k) => b[k] !== undefined);
  const fieldKeys = LISTING_EDIT_FIELDS.filter((k) => b[k] !== undefined);
  if (statusKeys.length && fieldKeys.length) {
    return {
      kind: 'invalid',
      err: listingShapeError('listing', 'STATUS_AND_FIELDS_EXCLUSIVE', {
        status_keys: [...statusKeys],
        field_keys: [...fieldKeys],
      }),
    };
  }
  if (statusKeys.length) return { kind: 'status', statusKeys: [...statusKeys] };
  if (fieldKeys.length) return { kind: 'fields', fields: [...fieldKeys] };
  return {
    kind: 'invalid',
    err: listingShapeError('listing', 'NO_EDITABLE_FIELD', { editable_fields: [...LISTING_EDIT_FIELDS] }),
  };
};

/**
 * `updateListingDetails` 回执：成功支在 `VerbResult` 之上**加一个离线判据键** `text_changed`
 * （= title/description **实际**变化 ⇒ 调用方应重置翻译回 `pending`）。
 * ★ 不塞进 `view`：`view` 必须与 `GET /api/listing/mine` 行**逐键同族**（前端整行替换），
 *   多一个键就会污染读口形状；故用**同级旁路键**，只在服务端内部（路由）消费、不下发。
 */
export type UpdateListingDetailsResult =
  | VerbErr
  | { ok: true; replay: false; view: Record<string, unknown>; text_changed: boolean };

/**
 * P1-b′ 字段编辑（`PATCH /api/listing/:listingId` 字段支）：**仅本人**、**仅 `draft|listed`**。
 *
 * 入参 `patch` 只含业务字段（**已由路由层剔掉状态键**）；**未传的字段一律不动**（`undefined` = 不触碰；
 * `null` 对 `media_urls` 表示「不动」、对 `item_type` 表示「显式置 NULL（= 未分类）」）。
 *
 * ★ 2026-10-20 Kevin 数据模型指令：**`title` 已退场**（正文并入 `description`）⇒ 本函数
 *   **不接受、不校验** `title`：`patch.title !== undefined` ⇒ 400 `NOT_SUPPORTED`（早于一切校验与 DB，
 *   零 DB 调用）；可改字段只有 `description / price / stock / media_urls / item_type`。
 *
 * 逐字段闸（先全部验完再打 DB ⇒ 非法形状**零 DB 调用**）：
 *   · `description`：字符串（**允许空串** = 清空描述；不 trim —— 描述保留作者排版）
 *   · `price`：整数（`toBigIntLike` 同口径）且 **> 0**（DB `listing_price_positive CHECK (price > 0)`）；
 *     上限 = `Number.MAX_SAFE_INTEGER`（>`OUT_OF_RANGE` 400）——DB 列为 bigint（上限 2^63-1），
 *     服务层沿仓内既有「JS 安全整数」纪律归一，故**有效上限取更紧的一侧**（报告已写明）
 *   · `stock`：整数 **≥ 0**（DB `listing_stock_nonneg`）；★ 实际变更且 `status <> 'listed'` ⇒ 409
 *     `listing_stock_change_requires_listed`（DL60 触发器同口径，不改迁移、不绕触发器）
 *   · `media_urls`：字符串数组（`toOptionalUrls` 同口径）→ 元素 `trim` 后须匹配 `/api/media/<id>`、
 *     张数 ≤4；`[]` = 清空
 *   · `item_type`：四值闭集 或 `null`（`normalizeItemType`；裸 `Digital` = 退役 ⇒ 400）
 *   · `allow_multi_buy`（★ 迁移 0061 · 第 7 可改字段）：**严格布尔**（`'true'` / `1` / `'1'` / `null` ⇒ 400
 *     `NOT_A_BOOLEAN`）；显式 `true` ∧ 生效 `stock ≤ 1` ⇒ 400 `MULTI_BUY_NOT_APPLICABLE`（同 patch 带
 *     `stock` ⇒ 纯预检零 DB；不带 ⇒ DB 守卫臂读行内现值）；未传 ∧ 改后 `stock ≤ 1` ⇒ 归一 `false`（不 400）
 *
 * 译文：**只有 `description` 实际变化**才置 `text_changed=true`（调用方据此重置翻译回 `pending`）；
 *   改价 / 库存 / 图片 / 分类 / 多件授权**不触翻译**（`media_urls` 不进译文源白名单）。
 */
export const updateListingDetails = async (params: {
  listingId: number;
  actorUid: number;
  patch: {
    /** ★ 已退场字段：透传进来即 400 NOT_SUPPORTED（保留在类型里 = 能显式拒绝，不是能用） */
    title?: unknown;
    description?: unknown;
    price?: unknown;
    stock?: unknown;
    mediaUrls?: unknown;
    itemType?: unknown;
    /** ★ 商品成色（迁移 0057）：`undefined` = 不动；`null` = 显式置 NULL（数字商品 / 清除成色）；
     *  带值 = 改成色（**仅实物两分类允许非空** —— 与 item_type 同 patch 提交时纯预检零 DB；
     *  只提成色时有效 item_type 要读行 ⇒ 交 DB 侧守卫臂 `condition_not_applicable`）。 */
    itemCondition?: unknown;
    /** ★ 迁移 0061 多件购买授权（route §49.17.3）：`undefined` = 不动；
     *  `true`/`false` = 落值（严格布尔，`'true'`/`1`/`null` ⇒ 400 `NOT_A_BOOLEAN`，零 DB）；
     *  `true` ∧ 生效 `stock ≤ 1` ⇒ **400 `MULTI_BUY_NOT_APPLICABLE`**（同 patch 带 `stock` ⇒ 纯预检零 DB；
     *  不带 `stock` ⇒ 交 SQL 守卫臂 `multi_buy_not_applicable` 读行内现值）。 */
    allowMultiBuy?: unknown;
  };
  /**
   * ★ 0059：token 侧管理员旗标（路由层注入 `actor.adminAccess`；客户端声明的任何
   * `admin*` 字段都**不**读）。判定真源 = `isListingEditAdminAccess`
   * （`can_access_admin ∧ (is_admin ∨ permissions∋manage_rewards)`）。
   * 省略 / `null` ⇒ 与 0058 及以前**逐字同行为**（仅本人可编辑）。
   */
  adminAccess?: ListingEditAdminAccess | null;
}): Promise<UpdateListingDetailsResult> => {
  const listingId = toBigIntLike(params.listingId, 'listing.listing_id', 1);
  if (!listingId.ok) return listingId.err;
  const uidErr = reservedUidGate(Number(params.actorUid), 'actor.uid');
  if (uidErr) return uidErr;

  const patch = params.patch || {};

  // ★ 第一道：退场字段即拒（先于任何字段校验与 DB；与 `classifyListingPatchBody` 同一 reason/field ⇒ 单一真源口径）
  if (patch.title !== undefined && patch.title !== null) {
    return listingShapeError('listing.title', 'NOT_SUPPORTED', {
      retired_fields: [...LISTING_RETIRED_FIELDS],
      reason_detail: 'listing.title retired: edit description instead',
      editable_fields: [...LISTING_EDIT_FIELDS],
    });
  }

  let description: string | null = null;
  if (patch.description !== undefined) {
    if (typeof patch.description !== 'string') return shapeError('listing.description', 'NOT_A_STRING');
    description = patch.description;
  }

  let price: number | null = null;
  if (patch.price !== undefined) {
    const parsed = toBigIntLike(patch.price, 'listing.price', 1);
    if (!parsed.ok) return parsed.err;
    price = parsed.value;
  }

  let stock: number | null = null;
  if (patch.stock !== undefined) {
    const parsed = toBigIntLike(patch.stock, 'listing.stock', 0);
    if (!parsed.ok) return parsed.err;
    stock = parsed.value;
  }

  let mediaUrls: string[] | null = null;
  if (patch.mediaUrls !== undefined && patch.mediaUrls !== null) {
    const urls = toOptionalUrls(patch.mediaUrls);
    if (!urls.ok) return urls.err;
    const list = (urls.value ?? []).map((u) => u.trim());
    if (list.length > MAX_LISTING_MEDIA_ITEMS) {
      return shapeError('listing.media_urls', 'TOO_MANY_ITEMS', {
        max_items: MAX_LISTING_MEDIA_ITEMS,
        count: list.length,
      });
    }
    const invalid = list.filter((u) => !LISTING_MEDIA_URL_RE.test(u));
    if (invalid.length) {
      return listingShapeError('listing.media_urls', 'INVALID_MEDIA_URL', {
        invalid: invalid.slice(0, MAX_LISTING_MEDIA_ITEMS),
        allowed_pattern: '/api/media/<id>',
      });
    }
    mediaUrls = list;
  }

  // `item_type`：`undefined` = 不动；`null` = 显式置 NULL（未分类）⇒ 需 `itemTypeSet` 开关区分
  const itemTypeSet = patch.itemType !== undefined;
  const itemType = normalizeItemType(patch.itemType);
  if (!itemType.ok) return itemType.err;

  // ★ 商品成色（迁移 0057）：`undefined` = 不动；`null` = 显式置 NULL（⇒ `conditionSet` 开关区分，同 item_type 体例）。
  const conditionSet = patch.itemCondition !== undefined;
  const itemCondition = normalizeItemCondition(patch.itemCondition);
  if (!itemCondition.ok) return itemCondition.err;
  // 适用性预检：patch **同时**带 item_type 时两值都在手 ⇒ 纯函数闸、零 DB；
  // 只带 item_condition（有效 item_type 要读行）⇒ 交 UPDATE 语句内的 `condition_not_applicable` 守卫臂。
  if (itemCondition.value !== null && itemTypeSet) {
    const appErr = itemConditionApplicabilityError(itemType.value, itemCondition.value);
    if (appErr) return appErr;
  }

  // ★ 迁移 0061 多件购买授权（第 7 可改字段）：形状闸（严格布尔）⇒ 生效 stock 适用性。
  //   · `undefined` = 不动（但 SQL 仍按 W5 归一：改后 stock ≤ 1 ⇒ 落 false，**不 400**）；
  //   · 同 patch 带 `stock` ⇒ 生效 stock 已在手 ⇒ **纯预检零 DB**（W3 最易漏的一臂：`true` + `stock:1`）；
  //   · 只传 `allow_multi_buy: true` ⇒ 生效 stock = 行内现值 ⇒ 交 SQL 守卫臂（W7，读行后才判）。
  const allowMultiBuy = normalizeAllowMultiBuy(patch.allowMultiBuy);
  if (!allowMultiBuy.ok) return allowMultiBuy.err;
  if (stock !== null) {
    const multiBuyErr = multiBuyApplicabilityError(allowMultiBuy.value, stock, listingId.value);
    if (multiBuyErr) return multiBuyErr;
  }

  if (description === null && price === null && stock === null && mediaUrls === null && !itemTypeSet && !conditionSet
    && allowMultiBuy.value === null) {
    return shapeError('listing', 'NO_EDITABLE_FIELD', { editable_fields: [...LISTING_EDIT_FIELDS] });
  }

  const write = await DatabaseService.updateListingDetailsRow({
    listingId: listingId.value,
    actorUid: Number(params.actorUid),
    description,
    price,
    stock,
    mediaUrls,
    itemType: itemType.value,
    itemTypeSet,
    itemCondition: itemCondition.value,
    conditionSet,
    // ★ 迁移 0061：`null` = 未传该键（语句按 W5 归一）
    allowMultiBuy: allowMultiBuy.value,
    // ★ 0059：管理员代编放行位（本人编辑不受影响；非管理员 ⇒ false ⇒ 归属闸照旧 403）
    adminAccess: params.adminAccess ?? null,
  });

  if (!write.row) return gone404('listing', listingId.value);
  switch (write.outcome) {
    case 'not_owner':
      // 与 `transitionListingStatus` 逐字同形（§6.2 附表 · C6：不借 LEDGER_HOLD_NOT_ALLOWED）
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', ref_type: 'listing', ref_id: String(listingId.value) });
    case 'status_not_editable':
      // 可编辑态 = draft|listed（delisted 终态 / frozen 冻结 ⇒ 只读）
      return stateConflict('listing.status', 'LISTING_STATE_INVALID', {
        listing_id: String(listingId.value),
        status: write.row.status,
        editable_statuses: ['draft', 'listed'],
      });
    case 'stock_requires_listed':
      return stateConflict('listing.stock', 'listing_stock_change_requires_listed', {
        listing_id: String(listingId.value),
        status: write.row.status,
      });
    case 'condition_not_applicable': {
      // ★ 迁移 0057：有效（item_type, item_condition）违反「非空成色仅实物两分类」⇒ 400。
      //   有效 item_type = patch 带了用 patch 值，否则回读行现值（write.row = cur 行快照）。
      const effectiveType = itemTypeSet ? itemType.value : write.row.item_type;
      return fail(400, 'LEDGER_AMOUNT_INVALID', {
        field: 'listing.item_condition',
        reason: 'ITEM_CONDITION_NOT_APPLICABLE',
        item_type: effectiveType,
        requires_item_type: [...PHYSICAL_ITEM_TYPES],
      }, 'Request shape is invalid');
    }
    case 'multi_buy_not_applicable': {
      // ★ 迁移 0061（W7 · route §49.17.3）：只传 `allow_multi_buy: true`、行内生效 stock ≤ 1 ⇒ 400。
      //   与创建面 / 同 patch 带 stock 的纯预检**同一形状**（`multiBuyApplicabilityError` 单一真源），
      //   生效 stock 取行快照值（write.row.stock）。
      return multiBuyApplicabilityError(true, Number(write.row.stock), listingId.value)
        ?? stateConflict('listing.allow_multi_buy', 'MULTI_BUY_NOT_APPLICABLE', {
          listing_id: String(listingId.value),
          stock: write.row.stock,
        });
    }
    default:
      break;
  }

  // ★ 译文重置判据：**只认 `description` 的实际变化**（title 已退场 ⇒ 不再有第二路文本）
  const prev = write.prev ?? { description: write.row.description };
  const textChanged = description !== null && description !== prev.description;

  return {
    ok: true,
    replay: false,
    view: { ...(write.row as unknown as Record<string, unknown>) },
    text_changed: textChanged,
  };
};

/** `getListingEditView` 回执：与 `UpdateListingDetailsResult` 同族，**无** `text_changed`（纯读口，不触译文）。 */
export type ListingEditViewResult =
  | VerbErr
  | { ok: true; replay: false; view: Record<string, unknown> };

/**
 * ★ 0059 · **编辑页统一预填读口**（`GET /api/listing/:listingId/edit`）。
 *
 * 授权（唯一真源，本函数内单点判定）：
 *   ① 本人（`listing.seller_uid = actorUid`）⇒ 200 —— 与 `GET /api/listing/mine` 的**同一行**
 *      （同族 11 键：`listing_id / title(派生) / price / cid / status / stock / media_urls /
 *      time_created / description / item_type / condition`）；
 *   ② 非本人 ∧ `isListingEditAdminAccess(adminAccess)` ⇒ 200（**同形状**，前端一套预填逻辑）；
 *   ③ 否则 ⇒ 403 `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`（与写口 403 逐字同形；
 *      ★ 判序 = **先 404 后 403**：行不存在时任何 actor 都得 404，不因「无权限」而伪装成 403，
 *      避免用 403/404 差异枚举 listing_id 的存在性 —— 与写口「行不存在 ⇒ 404」同序）。
 *
 * 纯读：零写、零台账、零译文副作用；`title` 仍是 `split_part(description, …)` 派生（title 列已 DROP）。
 */
export const getListingEditView = async (params: {
  listingId: number;
  actorUid: number;
  adminAccess?: ListingEditAdminAccess | null;
}): Promise<ListingEditViewResult> => {
  const listingId = toBigIntLike(params.listingId, 'listing.listing_id', 1);
  if (!listingId.ok) return listingId.err;
  const uidErr = reservedUidGate(Number(params.actorUid), 'actor.uid');
  if (uidErr) return uidErr;

  const found = await DatabaseService.getListingEditRow(listingId.value);
  if (!found) return gone404('listing', listingId.value);

  const isOwner = found.sellerUid === Number(params.actorUid);
  if (!isOwner && !isListingEditAdminAccess(params.adminAccess)) {
    return fail(403, 'AUTH_FORBIDDEN', {
      reason: 'ACTOR_NOT_ALLOWED',
      ref_type: 'listing',
      ref_id: String(listingId.value),
    });
  }

  return {
    ok: true,
    replay: false,
    // ★ 只出 11 键行：`seller_uid` 是归属判定旁路键，**不下发**（读口形状与 listing/mine 逐键同族）
    view: { ...(found.row as unknown as Record<string, unknown>) },
  };
};
