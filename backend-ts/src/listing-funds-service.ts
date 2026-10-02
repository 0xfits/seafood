// ============================================================================
// src/listing-funds-service.ts — P4-B3d · 商品（listing）**资金**编排（P2 购买 / P4 退款）
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md **v0.5**
//   §4.2 P2（`:510` 商品下单）· P4（`:512` 退款）· §4.3 资金四栏（`:531,532`）
//   §4.0 R1/R2/R6/R7（`:475-481`）· §4.4-9（`:550` 金额最小单位）· §4.5 幂等键总表（`:568,569`）
//   §4.1 关闭集（`:488` kind 恰好 20）· §3.1/§3.2/§3.3（404 三类 / 逐码条件 / R107 收尾）
// 数据层依据：docs/data-layer.spec.md **DL85**（【已冻结】商品购买 = `purchase` + `sale` **恰好两条**；
//   退款 = `purchase_refund` **恰好两条**；**超范围即拒**）；DL99（无分录的写不得借账本幂等）；
//   DL60（库存递减与 `purchase` 分录同一事件）；DL62（库存回滚策略由 P4 spec 定 —— 本片口径见 §7-7）。
//
// 硬口径（本文件自证）：
//   · **唯一资金写路径** = 迁移既有 DB 编排函数 `public.listing_post_event($1::jsonb)`
//     （`migrations/0015_listing.sql:449`；函数内「锁业务行 → 派生分录 → 调 `ledger_post_event`
//     → 回写 `pay_txid`/`refund_txid`/`ledger_event_keys`/`status`/`stock`」= **一条语句**）。
//     本文件**不**写 `account`/`ledger_entry`/`currency`/`listing`/`listing_order`，
//     **不**派生任何分录，**不**自造幂等键（DL95：键由函数按 §4.5 确定性派生）。
//   · **金额与对手方一律服务端取数**（派单硬口径 #1、《§4.2 P2 必需字段》**不含 price/seller**）：
//     `amount = listing.price × quantity` 与 `seller_uid = listing.seller_uid` 均在 DB 函数内取
//     （`0015:590,647`；refund 侧取 `listing_order.price/quantity/seller_uid`，`0015:710,721,724`）
//     ⇒ **服务层不接受、不透传任何 price / seller 入参**（连透传都不做，避免「客户端传价」的洞）。
//   · **买方 = token 的 actor**（服务层强制覆盖 `buyer_uid := actorUid`；body 里即使带 `buyer_uid`
//     也**被丢弃**）⇒ 代他人付款在结构上不可能。
//   · **kind 白名单零自由度**（DL85【已冻结】）：buy ⇒ 只 `purchase`/`sale`；refund ⇒ 只 `purchase_refund`。
//     DB 侧为硬闸（`0015:744-755`，事后核对 ⇒ 越界 = `LEDGER_ACCOUNT_GUARD_VIOLATION` 500 defect）。
//   · **前置闸最小化**：本文件只做「token 侧身份」「create_key 形状（fail-loud）」「退款发起人」
//     三道**应用层**闸；其余一切入参/状态/币种/余额/库存闸**一律交 DB 编排函数**（其码 = §4.2 期望码真源），
//     异常经 `ledgerErrorFromDbError` → `normalizeLedgerError` 原码/原 status 映射（§3.3-4）。
//   · **`src/ledger.ts` / `src/commission.ts` 只读引用**：唯一 `./ledger` 引用 = `:36` 的错误映射助手
//     ⇒ 「零自拼分录」是结构保证（§4.0 R1 ②，同批 3b 口径）。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { ledgerErrorFromDbError, normalizeLedgerError } from './ledger';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr, type JobVerbResult as VerbResult } from './job-service';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr, VerbResult };

// ============================================================================
// ★★ 本片的两个「单点判定」（派单硬口径 #3 + 服务层无 spec 明文的两处授权/行为口径）
// ============================================================================

/**
 * ★ **7-7 单点判定：退款是否回滚 `listing.stock`**（派单硬口径 #3 · **待 Kevin 一句话可改**）。
 *
 * **取值 = `false`（不回滚）** —— Kevin 未表态 ⇒ 本片取**默认值**。
 * **真源 = `migrations/0015_listing.sql:773-781`**：refund 分支**只** `UPDATE public.listing_order
 * SET status='refunded', refund_txid=…, ledger_event_keys=…`，**不** `UPDATE public.listing`（frozen
 * migration 的注释逐字：「DL62：库存回滚策略由 P4 spec 定（登记为「未定」）⇒ 本迁移**不复原库存**（不发明）」）。
 * **改法（将来一句话）**：① 若是「回滚」⇒ 需**新迁移**（本片**禁改** `migrations/**`）；或 ② 在
 * `DatabaseService.listingPostEvent` 的**同一语句**内补一条 `UPDATE public.listing SET stock = stock + n`
 * （必须与编排函数**同事务**，否则破坏派单硬口径 #4「单语句原子」）。**两处都不得在本片做**。
 */
export const REFUND_ROLLS_BACK_STOCK = false;

/**
 * ★★ **退款发起人授权口径**（P7-B · §7-32「管理员退款发起」· 硬约束③「单点升级」）。
 *
 * **取值 = `'seller_or_admin'`（卖方 ∨ 管理员）** —— 口径从**单点常量**升级为
 * **权限闸驱动的 actor 分流**（真源 = `resolveRefundActorRoute`，本文件唯一准入判定）。
 * **`REFUND_ACTOR_IS_SELLER_ONLY` 已由本常量 + 闸**取代**（不作并行真源保留**）。
 *
 * 真源：`docs/route-layer.spec.md` §12.1 / §12.11.4（Z1 = 权限键 `manage_points`；Z6 = 复用同路径 +
 * actor 分流顺序写死）+ §12.3 G2–G5 + §12.11.6 AC-13。
 *
 * **★ 口径冲突（登记，不改 spec）**：§12.3 的 **G2**（`can_access_admin=false` ⇒ `reason='NOT_ADMIN'`）
 * 与 **G5 / AC-13④**（非卖方且非 admin ⇒ `reason='ACTOR_NOT_ALLOWED'`）对**同一输入**给了**两个**
 * reason；AC-13⑥（非 admin 但有 `manage_points` ⇒ `'NOT_ADMIN'`）本身**不可达**
 * （`can_access_admin = is_admin ∨ 有角色行 ∨ 有权限位` ⇒ 有 `manage_points` 必 `can_access_admin`）。
 * 本单**取 AC-13（§12.11.6，v1.7+ 的可证伪验收表）为准**：非卖方非 admin ⇒ `ACTOR_NOT_ALLOWED`；
 * `'NOT_ADMIN'` 仅在 AC-13⑥ 那条**构造上不可达**的分支保留（见 `resolveRefundActorRoute` 实现）。
 * ⇒ 若派单方要 G2 口径，只改本函数一处（**一句话可改**）。
 */
export const REFUND_ACTOR_SCOPE = 'seller_or_admin' as const;

/** token 侧身份 + 订单两侧（**全部服务端取数**）—— 仅供 `resolveRefundActorRoute` 判准入 */
export interface RefundActorInput {
  /** 发起人（token 侧；客户端**不得**声明） */
  actorUid: number;
  /** `listing_order.seller_uid`（服务端取数） */
  sellerUid: number;
  /** `listing_order.buyer_uid`（服务端取数） */
  buyerUid: number;
  /** `actor.adminAccess.can_access_admin`（§6.1 单一真源） */
  canAccessAdmin: boolean;
  /** `actor.adminAccess.is_admin` */
  isAdmin: boolean;
  /** `actor.adminAccess.permissions` */
  permissions: readonly string[];
}

export type RefundActorRoute = 'seller' | 'admin';
export type RefundActorDecision = { ok: true; route: RefundActorRoute } | { ok: false; err: VerbErr };

/**
 * **本面唯一的准入真源**（纯函数、零 IO ⇒ 可离线判负）。分流顺序（§12.11.4 写死）：
 *   ① `actor = seller` ⇒ **卖方路**（**不要求** admin 闸）；
 *   ② 否则 actor = buyer ⇒ `403 AUTH_FORBIDDEN` + `'ACTOR_NOT_ALLOWED'`（§12.1 禁令：管理员兼买方
 *      也落在同一禁令内 —— 买方单方退款 = 对卖方的单向掠夺向量）；
 *   ③ 否则 `can_access_admin ∧ manage_points` ⇒ **管理员路**；
 *   ④ 否则 admin 但缺 `manage_points` ⇒ `'PERMISSION_NOT_GRANTED'`；
 *   ⑤ 否则（非 admin）⇒ `'ACTOR_NOT_ALLOWED'`（AC-13④ / G5；AC-13⑥ 的 `'NOT_ADMIN'` 分支不可达但保留）。
 * **闸必早于任何资金调用**（§12.3 G6）。
 */
export const resolveRefundActorRoute = (input: RefundActorInput): RefundActorDecision => {
  const { actorUid, sellerUid, buyerUid, canAccessAdmin, isAdmin, permissions } = input;
  const hasPointsKey = permissions.includes('manage_points');

  // ① 卖方路（与 §4.7.2 卖方面重合 ⇒ 无额外闸）
  if (actorUid === sellerUid) {
    return { ok: true, route: 'seller' };
  }
  // ② 买方禁令（含「管理员兼买方」；§12.1 / G4 / AC-13③）
  if (actorUid === buyerUid) {
    return { ok: false, err: actorDenied('ACTOR_NOT_ALLOWED', actorUid, sellerUid) };
  }
  // ③ 管理员路
  if (canAccessAdmin && (isAdmin || hasPointsKey)) {
    return { ok: true, route: 'admin' };
  }
  // ④ admin 但缺 manage_points
  if (canAccessAdmin && !(isAdmin || hasPointsKey)) {
    return { ok: false, err: actorDenied('PERMISSION_NOT_GRANTED', actorUid, sellerUid) };
  }
  // ⑤ AC-13⑥（构造上不可达：有 manage_points ⇒ can_access_admin=true）—— 保留映射
  if (hasPointsKey) {
    return { ok: false, err: actorDenied('NOT_ADMIN', actorUid, sellerUid) };
  }
  // ⑥ 非卖方、非买方、非 admin（AC-13④ / G5）
  return { ok: false, err: actorDenied('ACTOR_NOT_ALLOWED', actorUid, sellerUid) };
};

/** §3.3-6 / DL147③：`reason` 值域是**闭集**（3 值）⇒ 本面不得新增 */
const actorDenied = (reason: 'ACTOR_NOT_ALLOWED' | 'NOT_ADMIN' | 'PERMISSION_NOT_GRANTED', actorUid: number, sellerUid: number): VerbErr =>
  fail(403, 'AUTH_FORBIDDEN', {
    reason,
    field: 'actor.uid',
    required_uid: String(sellerUid),
    ...(reason === 'ACTOR_NOT_ALLOWED' ? { seller_uid: String(sellerUid) } : {}),
    actor_uid: String(actorUid),
  }, reason);

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状；与 job-funds-service 同族）-------
const fail = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  message?: string,
): VerbErr => ({
  ok: false,
  status,
  code,
  message: message || code,
  details,
  authDomain: code.startsWith('AUTH_'),
});

/** §3.2 400：入参形状/语义非法（`LEDGER_AMOUNT_INVALID` 兼作参数形状码，靠 `details.field` 区分） */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §3.1：引用对象不存在 ⇒ 404 `LEDGER_REF_NOT_FOUND` + `details.ref_type`（开放取值域，§4.1 注） */
const ref404 = (refType: string, refId: string | number, extra: Record<string, unknown> = {}): VerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: refType, ref_id: String(refId), ...extra }, 'Referenced object not found');

/** §3.3-4：DB 抛出的命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE，禁堆栈） */
const fromLedgerError = (e: unknown): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, 'listing');
  if (mapped) {
    return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>, mapped.code);
  }
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>, norm.code);
};

// ---- 幂等键（§4.5：前缀只允许 biz:/cm:/cli:/ops:；禁 `#` 与控制字符；校验序固定，与 DB 同序同码）----
const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'] as const;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * P2 的**创建键**（`listing_order.create_key`，`cli:<uuid-v4>`，DL94：「键只能由不可变业务标识派生；
 * 调用方不得自造」的**创建面**例外 —— 创建键**必须由调用方给**）。
 * **缺失 ⇒ `400 LD005 LEDGER_IDEMPOTENCY_KEY_REQUIRED`（fail-loud，与 DB 侧 `0015:499-502` 同码）**，
 * **本片不派生**（`docs/route-layer.spec.md` §4.4-14 的口径：内容派生键会让「同内容的两笔不同下单」
 * 相互碰撞成 `200` 重放 ⇒ **静默丢单**）。校验序逐字对齐 §4.5 = `TOO_LONG → PREFIX_REQUIRED →
 * RESERVED_SEPARATOR → CONTROL_CHARACTER`。
 */
const resolveBuyCreateKeyRequired = (
  raw: unknown,
): { ok: true; key: string } | { ok: false; err: VerbErr } => {
  const provided = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!provided) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', { field: 'create_key' }, 'Idempotency key is required') };
  }
  if (provided.length > 256) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'TOO_LONG' }, 'Idempotency key is invalid') };
  }
  if (!KEY_PREFIXES.some((prefix) => provided.startsWith(prefix))) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: KEY_PREFIXES }, 'Idempotency key is invalid') };
  }
  if (provided.includes('#')) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'RESERVED_SEPARATOR' }, 'Idempotency key is invalid') };
  }
  if (CONTROL_CHARS.test(provided)) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'CONTROL_CHARACTER' }, 'Idempotency key is invalid') };
  }
  return { ok: true, key: provided };
};

/** 请求指纹（R53/DL96：路由层强制传 ⇒ 本模块即「路由层」，**服务端算出**，调用方不得自造） */
const fingerprintOf = (parts: Array<string | number>): string =>
  createHash('sha256').update(parts.join('|')).digest('hex');

const actorGate = (actorUid: unknown) => {
  const uid = Number(actorUid);
  if (!Number.isInteger(uid) || uid <= 0) {
    return { ok: false as const, err: fail(400, 'LEDGER_RESERVED_UID', { field: 'actor.uid', value: String(actorUid) }, 'Reserved uid is not allowed') };
  }
  return { ok: true as const, uid };
};

/** 正整数形状（§4.4-9：金额一律最小单位整数；形状非法 ⇒ 400，不透传 NaN/浮点） */
const toPosIntText = (raw: unknown, field: string): { ok: true; value: string } | { ok: false; err: VerbErr } => {
  const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
  if (!/^\d+$/.test(text)) return { ok: false, err: shapeError(field, 'NOT_A_POSITIVE_INTEGER') };
  if (text === '0') return { ok: false, err: fail(400, 'LEDGER_AMOUNT_NOT_POSITIVE', { field, value: text }, 'Amount must be positive') };
  return { ok: true, value: text };
};

/** 账本/编排函数回执 → 只读视图（**不新增任何 kind、不改任何白名单**） */
const listingEventView = (r: Record<string, unknown>): Record<string, unknown> => {
  const entries = Array.isArray(r.entries) ? (r.entries as Array<Record<string, unknown>>) : [];
  const extra = (r.extra || {}) as Record<string, unknown>;
  return {
    op: r.op === undefined || r.op === null ? null : String(r.op),
    listing_id: r.listing_id === undefined || r.listing_id === null ? null : String(r.listing_id),
    order_id: r.order_id === undefined || r.order_id === null ? null : String(r.order_id),
    listing_status: r.listing_status === undefined || r.listing_status === null ? null : String(r.listing_status),
    order_status: r.order_status === undefined || r.order_status === null ? null : String(r.order_status),
    stock: r.stock === undefined || r.stock === null ? null : String(r.stock),
    /** ★ 7-7 判定值的**可观测投影**（真源 = 常量，见文件头注释） */
    stock_rolled_back: REFUND_ROLLS_BACK_STOCK,
    created: r.created === true,
    idempotent_replay: r.idempotent_replay === true,
    txid: r.txid === undefined || r.txid === null ? null : String(r.txid),
    ledger_idempotency_key: r.ledger_idempotency_key === undefined || r.ledger_idempotency_key === null
      ? null : String(r.ledger_idempotency_key),
    pay_txid: r.pay_txid === undefined || r.pay_txid === null ? null : String(r.pay_txid),
    refund_txid: r.refund_txid === undefined || r.refund_txid === null ? null : String(r.refund_txid),
    ledger_event_keys: Array.isArray(r.ledger_event_keys) ? r.ledger_event_keys : [],
    amount: extra.amount === undefined || extra.amount === null ? null : String(extra.amount),
    currency_status: extra.currency_status === undefined || extra.currency_status === null ? null : String(extra.currency_status),
    event_kinds: extra.event_kinds === undefined || extra.event_kinds === null ? null : String(extra.event_kinds),
    entry_count: entries.length,
    kinds: entries.map((e) => String(e.kind ?? '')),
    entries,
    accounts: Array.isArray(r.accounts) ? r.accounts : [],
  };
};

// ============================================================================
// P2 · 商品下单（`listing_post_event(op='buy')`；`purchase` ×1 + `sale` ×1，DL85 恰好两条）
// ----------------------------------------------------------------------------
// 触发端点（spec §4.2 P2）= `POST /api/listing/:listingId/buy`；**前端零调用**（§1.2 现取扫描 0 命中）
//   ⇒ 本片**只交付服务层**（路由随批 4；报告 §1.2 已登记待入 spec §1.8）。
// 资金四栏（§4.3:531）：**谁出钱** = 买家（可用余额 `−price×qty`）；**谁收钱** = 卖家（`sale` `+price×qty`）；
//   **平台费 = 无**（DL85 钉死恰好两条 ⇒ 商品柱不抽成）。
// 单语句原子：见 §4.0 R2 与 `DatabaseService.listingPostEvent`（同一条 `SELECT public.listing_post_event(...)`）。
// ============================================================================
export const buyListing = async (params: {
  /** token 侧身份（**买方**唯一真源；body 里的 `buyer_uid` 一律被丢弃） */
  actorUid: number;
  /** URL 参数 `:listingId`（原样，形状闸在本函数） */
  listingIdRaw: unknown;
  body: Record<string, unknown> | undefined;
}): Promise<VerbResult> => {
  const body = params.body || {};
  const actor = actorGate(params.actorUid);
  if (!actor.ok) return actor.err;

  // ① listing_id：形状非法 ⇒ 404（§3.1「写目标不存在」与「非数字 id」同族；与批次 2 的 404 口径一致）
  const listingIdText = typeof params.listingIdRaw === 'string'
    ? params.listingIdRaw.trim() : String(params.listingIdRaw ?? '');
  if (!/^\d+$/.test(listingIdText) || listingIdText === '0') {
    return ref404('listing', listingIdText || 'null', { field: 'listing_id', reason: 'listing_not_found' });
  }

  // ② 创建键（§4.5）：缺失 ⇒ fail-loud，**不派生**（§4.4-14 口径）
  const keyed = resolveBuyCreateKeyRequired(body.create_key ?? body.idempotency_key ?? body.idempotencyKey);
  if (!keyed.ok) return keyed.err;

  // ③ quantity：正整数形状（语义闸「≤ int4 / 库存」交 DB）
  const qty = toPosIntText(body.quantity, 'quantity');
  if (!qty.ok) return qty.err;

  // ④ 买方 = **actor**（硬口径 #1）：`buyer_uid` 由服务端注入，客户端传值（若有）被忽略并登记
  const ignoredBuyer = body.buyer_uid === undefined || body.buyer_uid === null ? null : String(body.buyer_uid);
  const buyerUid = actor.uid;

  // ⑤ payload **不含 price / 不含 seller_uid**（服务端取数；见文件头硬口径）
  const payload = {
    op: 'buy',
    create_key: keyed.key,
    listing_id: listingIdText,
    buyer_uid: String(buyerUid),
    quantity: qty.value,
    request_fingerprint: fingerprintOf(['listing.buy', keyed.key, listingIdText, buyerUid, qty.value]),
    memo: `listing buy:${keyed.key}`,
  };

  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.listingPostEvent(payload);
  } catch (e) {
    return fromLedgerError(e);
  }
  const r = (row.r || {}) as Record<string, unknown>;
  const view = listingEventView(r);
  return {
    ok: true,
    replay: r.idempotent_replay === true,
    view: {
      ...view,
      buyer_uid: String(buyerUid),
      quantity: qty.value,
      client_buyer_uid_ignored: ignoredBuyer !== null && ignoredBuyer !== String(buyerUid) ? ignoredBuyer : null,
    },
  };
};

// ============================================================================
// P4 · 退款（`listing_post_event(op='refund')`；`purchase_refund` ×2，DL85 恰好两条）
// ----------------------------------------------------------------------------
// 触发端点（spec §4.2 P4）= `POST /api/listing/order/:orderId/refund`；**前端零调用**
//   ⇒ 本片**只交付服务层**（路由随批 4；报告 §1.2 已登记待入 spec §1.8）。
// 资金四栏（§4.3:532）：**谁出钱** = **卖家**（可用余额 `−amount`）；**谁收钱** = **买家**（`+amount`）。
// 发起人闸：见文件头 `REFUND_ACTOR_IS_SELLER_ONLY`（spec 未定义 actor ⇒ 服务层最严口径 + 单点可改）。
// 库存：**不回滚**（★7-7 单点判定，见文件头 `REFUND_ROLLS_BACK_STOCK`）。
// ============================================================================
export const refundListingOrder = async (params: {
  /** token 侧身份（发起人；**卖方 ∨ 管理员** —— 准入真源 = `resolveRefundActorRoute`） */
  actorUid: number;
  /** URL 参数 `:orderId` */
  orderIdRaw: unknown;
  /** `actor.adminAccess`（§6.1 单一真源；路由层从 token 侧注入，客户端不得声明） */
  adminAccess?: { can_access_admin?: boolean; is_admin?: boolean; permissions?: readonly string[] };
}): Promise<VerbResult> => {
  const actor = actorGate(params.actorUid);
  if (!actor.ok) return actor.err;

  const orderIdText = typeof params.orderIdRaw === 'string'
    ? params.orderIdRaw.trim() : String(params.orderIdRaw ?? '');
  if (!/^\d+$/.test(orderIdText) || orderIdText === '0') {
    return ref404('listing_order', orderIdText || 'null', { field: 'order_id', reason: 'order_not_found' });
  }

  // ① 只读解析订单（拿 seller/buyer 做发起人闸；**这不是**授权真源 —— 真源仍是服务端取的订单行）
  let order: Awaited<ReturnType<typeof DatabaseService.resolveListingOrder>>;
  try {
    order = await DatabaseService.resolveListingOrder(Number(orderIdText));
  } catch (e) {
    return fromLedgerError(e);
  }
  if (!order) return ref404('listing_order', orderIdText, { field: 'order_id', reason: 'order_not_found' });

  // ② 准入闸（**唯一真源** = `resolveRefundActorRoute`；§12.11.4 actor 分流顺序）
  //    卖方路 / 管理员路（`can_access_admin ∧ manage_points`）/ 兼买方禁令 / 403 逐场景 reason。
  const decision = resolveRefundActorRoute({
    actorUid: actor.uid,
    sellerUid: order.sellerUid,
    buyerUid: order.buyerUid,
    canAccessAdmin: params.adminAccess?.can_access_admin === true,
    isAdmin: params.adminAccess?.is_admin === true,
    permissions: params.adminAccess?.permissions ?? [],
  });
  if (!decision.ok) {
    // 保持既有 `details` 面上的 ref_type / ref_id（最小 delta；R107 顶层键集不变）
    return { ...decision.err, details: { ...decision.err.details, ref_type: 'listing_order', ref_id: orderIdText } };
  }

  // ③ payload（§4.2 P4 必需字段逐字 + actor 侧；金额/对手方仍全部由 DB 从订单行派生）+ 走新编排函数
  const payload = {
    actor_uid: String(actor.uid),
    op: 'refund',
    order_id: orderIdText,
    request_fingerprint: fingerprintOf(['listing.refund', orderIdText]),
    memo: `listing refund:${orderIdText}`,
  };

  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.listingRefundPostEvent(payload);
  } catch (e) {
    return fromLedgerError(e);
  }
  const r = (row.r || {}) as Record<string, unknown>;

  // ④ 拒收回执（状态机拒绝，`LD011`；§12.12.5 内部回执口径）⇒ 由路由映射既有 `409`（**零新码**）
  if (r.ok !== true) {
    return fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
      field: 'listing_order.status',
      reason: r.reason === null || r.reason === undefined ? 'order_not_refundable' : String(r.reason),
      ref_type: 'listing_order',
      ref_id: orderIdText,
      status_code: 409,
    }, 'LEDGER_CURRENCY_INVALID_TRANSITION');
  }

  // ⑤ 成功面：对外视图取自**嵌套的资金回执**（F10 的 23 键 + `actor_uid`/`seller_uid`；§12.12.5③
  //    「内部编排回执 vs 对外路由回执 = 两层，禁止把编排回执原样透传」）
  const funds = (r.refund_receipt || {}) as Record<string, unknown>;
  const view = listingEventView(funds);
  return {
    ok: true,
    replay: funds.idempotent_replay === true,
    view: { ...view, actor_uid: String(actor.uid), seller_uid: String(order.sellerUid) },
  };
};
