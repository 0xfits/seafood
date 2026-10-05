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
import { DatabaseService } from './database';
import { errorMessageOf } from './ledger-errors';
import {
  ledgerErrorBody,
  sendGone,
  sendVerbError,
  type JobVerbErr as VerbErr,
  type JobVerbResult as VerbResult,
} from './job-service';

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

const shapeError = (field: string, reason: string): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason }, 'Request shape is invalid');

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
// 同键重投的指纹按**可重构不变子集**判定：`seller_uid, cid, price, title, description, media_urls`
// （排除可变列 `stock` / `status`：二者由本模块的 update/transition 正常变更，若纳入会把合法重投误判为 409）。
const fingerprintOf = (row: Record<string, unknown>) => JSON.stringify([
  Number(row.seller_uid),
  Number(row.cid),
  Number(row.price),
  String(row.title ?? ''),
  String(row.description ?? ''),
  Array.isArray(row.media_urls) ? row.media_urls.map(String) : null,
]);

// ---- P1-a · 上架（create；§4.2 P1）-----------------------------------------
export const createListing = async (params: {
  sellerUid: number;
  cid: number;
  price: unknown;
  stock: unknown;
  title?: unknown;
  description?: unknown;
  mediaUrls?: unknown;
  createKeyRaw?: unknown;
}): Promise<VerbResult> => {
  const uidErr = reservedUidGate(Number(params.sellerUid), 'listing.seller_uid');
  if (uidErr) return uidErr;

  const cid = toBigIntLike(params.cid, 'listing.cid', 1);
  if (!cid.ok) return cid.err;
  const price = toBigIntLike(params.price, 'listing.price', 1);
  if (!price.ok) return price.err;
  const stock = toBigIntLike(params.stock, 'listing.stock', 0);
  if (!stock.ok) return stock.err;
  const description = toOptionalText(params.description, 'listing.description');
  if (!description.ok) return description.err;
  const mediaUrls = toOptionalUrls(params.mediaUrls);
  if (!mediaUrls.ok) return mediaUrls.err;
  const title = typeof params.title === 'string' ? params.title : (params.title === undefined || params.title === null ? '' : null);
  if (title === null) return shapeError('listing.title', 'NOT_A_STRING');

  const resolvedKey = resolveListingCreateKey(params.createKeyRaw, ['create', params.sellerUid, cid.value, price.value, stock.value, title]);
  if (!resolvedKey.ok) return keyError(resolvedKey.details);

  const gate = await currencyGate(cid.value);
  if (gate) return gate;

  const write = await DatabaseService.createListingRow({
    sellerUid: Number(params.sellerUid),
    cid: cid.value,
    price: price.value,
    stock: stock.value,
    title,
    description: description.value || '',
    mediaUrls: mediaUrls.value || [],
    createKey: resolvedKey.key,
  });

  if (write.outcome === 'existing') {
    if (fingerprintOf(write.row) !== JSON.stringify([Number(params.sellerUid), cid.value, price.value, title, description.value || '', mediaUrls.value || []])) {
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
export const updateListing = async (params: {
  listingId: number;
  actorUid: number;
  price?: unknown;
  stock?: unknown;
  title?: unknown;
  description?: unknown;
  mediaUrls?: unknown;
}): Promise<VerbResult> => {
  const listingId = toBigIntLike(params.listingId, 'listing.listing_id', 1);
  if (!listingId.ok) return listingId.err;
  const uidErr = reservedUidGate(Number(params.actorUid), 'actor.uid');
  if (uidErr) return uidErr;

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
  const title = toOptionalText(params.title, 'listing.title');
  if (!title.ok) return title.err;
  const description = toOptionalText(params.description, 'listing.description');
  if (!description.ok) return description.err;
  const mediaUrls = toOptionalUrls(params.mediaUrls);
  if (!mediaUrls.ok) return mediaUrls.err;

  if (price === null && stock === null && title.value === null && description.value === null && mediaUrls.value === null) {
    return shapeError('listing', 'NO_EDITABLE_FIELD');
  }

  const write = await DatabaseService.updateListingRow({
    listingId: listingId.value,
    actorUid: Number(params.actorUid),
    price,
    stock,
    title: title.value,
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
