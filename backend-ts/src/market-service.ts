// ============================================================================
// src/market-service.ts — P4-B3e · 交易所（market）**资金**编排：M1 挂单 / M2 撤单 / M3 成交
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md **v0.6**
//   §4.2 M1（`:544`）/ M2（`:545`）/ M3（`:546`）· §4.3 资金四栏（M1/M2/M3 行）
//   §4.1 关闭集（`:515-528` kind 恰好 20 / ref_type 恰好 8 / 平台保留 uid）
//   §4.0 R1/R2/R6/R7（`:502-515`）· §4.4-5 加锁全序 / §4.4-9 金额最小单位 / §4.4-13/14（金额口径 / 无自然键 fail-loud）
//   §4.5 幂等键总表（`:591-620`：挂单 create_key 即事件根键 / cancel=`biz:market:cancel:<order_id>`
//     / trade=`biz:market:trade:<taker_order_id>:<fill_no>`）· §3.1 三类 404 · §3.2 逐码 · §3.3 R107 收尾
// 数据层依据：docs/data-layer.spec.md **v0.7**
//   **DL85**（成交 = `trade` ×4 + `trade_fee` ×2；挂单复用 `hold` 族；**超范围即拒**）
//   **DL87**（`trade_fee` 承担方 = **taker**；计价与扣除币种**恒 `$`(cid=1)**；**是消耗不是冻结 ⇒ 撤单不退**）
//   **DL90**（挂单复用 `hold`，`ref_type='market_order'`）· **DL68**（+ v0.6 加注：币对级串行化义务 **不在 DB 层**
//     ⇒ **登记为 P5 路由层/撮合服务的必须交付项** ⇒ **本片兑现**，手段 = `pg_advisory_xact_lock`）
//   DL64（`quote_cid` 恒 1）· DL141–DL144（加锁全序 / 同键重放 / 同键异内容 409）
//
// 硬口径（本文件自证）：
//   · **唯一资金写路径** = 迁移既有 DB 编排函数 `public.market_post_event($1::jsonb)`
//     （`migrations/0016_market.sql:393`；函数内「锁业务行（主键升序）→ 派生分录 → 调 `ledger_post_event`
//     → 回写 `ledger_event_keys`/`status`/`amount_filled`」= **一条语句**）。本文件**不**写
//     `account`/`ledger_entry`/`currency`/`market_order`/`market_trade`，**不**派生任何分录，
//     **不**自造幂等键（DL95：键由函数按 §4.5 确定性派生）。
//   · **★ DL68 币对级串行化（本片兑现）** = 写语句**外层 CTE 先取** `pg_advisory_xact_lock(base_cid, quote_cid)`
//     （`DatabaseService.marketPostEvent`：`WITH l AS (SELECT pg_advisory_xact_lock(...)) SELECT market_post_event(...) FROM l`
//     —— 含**易变函数**的 CTE **不可内联**（PostgreSQL 规则）⇒ 物化后先行求值 ⇒ 锁在编排函数执行**之前**取得、
//     在语句（隐式事务）结束释放 ⇒ **同币对串行、异币对并行**；实测 = 报告 §4.3（锁占位探针：同币对阻塞 / 异币对不阻塞）。
//     **残余（明记，不静默）**：**对手方选择**是锁**之前**的一次只读读（`resolveMarketCounterparty`）
//     ⇒ DL68 v0.6 ②c 的「**撮合决策新鲜度**」残余风险**仍在**（并发同币对两笔选择同一对手方时，
//     后到者在锁内被 DB 闸**响亮拒绝**，**不会**超卖）；消除残余需「选择也进锁内」的**交互式事务**方案
//     （`src/db.ts` 的 R55/R56 事务层已存在）⇒ 已登记供 Zang 裁定（报告 §4.3 / §6 待裁项）。
//   · **金额/对手方一律服务端取数**（派单硬口径 #4，3c 先例）：
//     — M1（挂单）：`price`/`amount` = **用户自己的限价单条款**（同族 = §4.4-13 的 `job.reward`「业务约定额」，
//       **不适用**「金额服务端取数」）；`quote_cid` **服务端恒 `1`**（DL64；前端不传）；`owner_uid` = **token 的 actor**
//       （客户端传值**被丢弃并登记**）。
//     — M3（成交）：**`price` / `buy_order_id` / `sell_order_id` 全部服务端从 `market_order` 行取**
//       （`price` = **买单限价**，DL85/`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`；对手方 = 同币对反向最优单）
//       ⇒ **客户端传价 / 传对手方一律被丢弃并登记**（`client_inputs_ignored`）。
//     — **手续费（`fee`）** 服务端取数（**D-2**）：`fee = (qty × 买单限价 × fee_rate_bp + 5000) / 10000`
//       （半进位 = §4.3 J5 的**全项目唯一取整点**同族），`fee_rate_bp` 来自 **`commission_policy`** 现行政策
//       （§4.4-11 逐字：「费率真源 = `commission_policy.fee_rate_bp`（**唯一真源**）」）；**客户端传 `fee` 被丢弃**。
//   · **不涉佣金（十级返佣）**：§4.2 M1/M2/M3 与 §4.3 的交易所行**均无** `commission` 要求
//     ⇒ 本片**不做、也不假设**（DL87 的 `trade_fee` **全额入 `-1`**，不是佣金池 `-2`）。
//   · **不实现「价差改善」第 7 条分录**（DL85 v0.6 加注 + §12.2-13 明文待裁 ⇒ 裁定前**不得**实现）：
//     本片的对手方选择**只选可成交（crossable）**的反向单，成交价**恒 = 买单限价**
//     ⇒ 事件恒为 `trade`×4（+ `fee>0` 时 `trade_fee`×2），**不产生**多余冻结 ⇒ **无第 7 条分录**。
//   · **`src/ledger.ts` / `src/commission.ts` 只读引用**：唯一 `./ledger` 引用 = `:37` 的错误映射助手
//     ⇒ 「零自拼分录」是结构保证（§4.0 R1 ②，同批 3b/3c/3d 口径）。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { ledgerErrorFromDbError, normalizeLedgerError } from './ledger';
import { errorMessageOf } from './ledger-errors';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr, type JobVerbResult as VerbResult } from './job-service';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr, VerbResult };

// ============================================================================
// ★★ 本片三个「单点判定」（派单硬口径 #3/#4/#7 的三处无 spec 明文口径；**均单点可改**）
// ============================================================================

/**
 * **D-1：`fill_no` 必填 fail-loud（不派生）**。
 *
 * §4.5 的成交事件根键 = `biz:market:trade:<taker_order_id>:<fill_no>`（`0016:382`）⇒ 键 = **实体自然标识
 * （taker 订单）+ 成交序号**。`fill_no` **不能服务端派生**：任何「按 `count(已有成交)+1` 派生」的写法对
 * **同一次撮合决策的重投不幂等**（重投会拿到 `n+1` ⇒ 新键 ⇒ **不是重放** ⇒ 只要订单还有余量就会**再成交一次**
 * = 重复交割）。⇒ 取 **fail-loud**（口径 = §4.4-14 的判据族：**无法由不可变业务标识唯一确定 ⇒ 响亮拒绝**，
 * 与 J1 的 `create_key` 缺失同族、与 2a 的「有自然标识 ⇒ 派生」互斥面）。
 * **改法（将来一句话）**：若 Kevin 裁定「由撮合服务在决策内给出、允许缺省」⇒ 只改本文件 `matchMarketOrders`
 * 的 ④ 一处（`DatabaseService.resolveNextFillNo` 已有实现位：按 `ledger_entry.ref_id` 的 `market_trade` 行计数）。
 * 实测（报告 §4.1）= `T07_missing_fill_no ⇒ 400` + **零分录**。
 */
export const MATCH_FILL_NO_REQUIRED = true;

/**
 * **D-2：`trade_fee` 的服务端取数口径（费率真源 + 取整点）**。
 *
 * 真源 = **`commission_policy.fee_rate_bp`**（§4.4-11 逐字「费率真源 = `commission_policy.fee_rate_bp`
 * （**唯一真源**）」）；公式 = `fee = (qty × 买单限价 × fee_rate_bp + 5000) / 10000`（**半进位**，
 * 与 §4.3 J5 的「全项目唯一取整点」同族）；**计价 = 成交额（quote 侧 `$`）**（DL87 逐字「计价与扣除币种
 * **恒为 `$`（cid=1）**」）⇒ 与「`amount`（base 数量）× 费率」的另一读法**并列登记**，**单点可改**。
 * **无政策行 ⇒ `fee = 0`**（只 4 条分录；报告 §4.5 登记 + `NOT_MEASURED`：无政策行的经济含义待 Kevin）。
 * **客户端传 `fee` 一律丢弃**（服务端取数，§4.4-11/12 的洞不会在本面重现）。
 */
export const MARKET_FEE_RATE_SOURCE = 'commission_policy.fee_rate_bp' as const;
export const MARKET_FEE_ROUNDING = 'half_up:(x*bp+5000)/10000' as const;

/**
 * **D-3：币对级串行化的手段形态**。
 *
 * 取 **两参 `int4` 形式** `pg_advisory_xact_lock(base_cid::int, quote_cid::int)`（DL68 原文为
 * `pg_advisory_xact_lock(hash(币对))`）：**语义等价**（同币对 ⇒ 同锁、异币对 ⇒ 异锁），且
 * ① **无哈希碰撞**（`(base_cid, quote_cid)` 是**单射**）；② **探针可逐字复现**同一把锁（报告 §4.3 的锁占位实测）。
 * 锁**作用域 = 语句级隐式事务**（PostgreSQL 的 `xact` 变体在语句结束释放）⇒ 覆盖整个 `market_post_event`。
 * **改法（一句话）**：改 `DatabaseService.marketPostEvent` 的 CTE 一处（换成 `hashtextextended(...)` 亦可）。
 */
export const MARKET_PAIR_LOCK = 'pg_advisory_xact_lock(base_cid::int4, quote_cid::int4)' as const;

/** 币对锁**对哪些 op 生效**：本片三 op **一律纳管**（DL68 的强制项 = 成交；挂单/撤单一并纳管 ⇒ 同币对
 * 的挂单/撤单不会与成交交错，代价 = 同币对写吞吐下降 —— 登记为口径选择，可由 Zang 收窄为「仅 trade」）。 */
export const MARKET_PAIR_LOCK_SCOPE = 'order|cancel|trade' as const;

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状；与 job-funds/listing-funds 同族）-
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

/** §3.2 400：入参形状/语义非法（`LEDGER_AMOUNT_INVALID` 兼作参数形状码，靠 `details.field` 区分） */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §3.1「币种不存在」= `LEDGER_CURRENCY_NOT_FOUND` + `{cid}`（`cid<=0`/非数字同码，v0.5 裁定） */
const currency404 = (cid: unknown): VerbErr =>
  fail(404, 'LEDGER_CURRENCY_NOT_FOUND', { cid: String(cid ?? 'null') }, 'Currency not found');

/** §3.1「业务对象不存在」= `LEDGER_REF_NOT_FOUND` + `{ref_type,ref_id}`（开放取值域） */
const ref404 = (refType: string, refId: string | number, extra: Record<string, unknown> = {}): VerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: refType, ref_id: String(refId), ...extra }, 'Referenced object not found');

/** §3.3-4：DB 抛出的命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE，禁堆栈） */
const fromLedgerError = (e: unknown): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, 'market');
  if (mapped) {
    return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>);
  }
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>);
};

// ---- 幂等键（§4.5：前缀只允许 biz:/cm:/cli:/ops:；禁 `#` 与控制字符；校验序固定，与 DB 同序同码）----
const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'] as const;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * M1 的**创建键**（`market_order.create_key`，`cli:<uuid-v4>`）。
 * **缺失 ⇒ `400 LD005 LEDGER_IDEMPOTENCY_KEY_REQUIRED`（fail-loud，与 DB 侧 `0016:457-460` 同码）**，
 * **本片不派生** —— 判据 = §4.4-14/DL85 v0.6 契约 3：`market_order` 的 `order_id` 是 **IDENTITY**、
 * **无自然键** ⇒ 内容派生会让「同内容的两笔不同挂单」相互碰撞成 `200` 重放 = **静默丢单**。
 * 校验序逐字对齐 §4.5 = `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`。
 */
const resolveMarketCreateKeyRequired = (raw: unknown): { ok: true; key: string } | { ok: false; err: VerbErr } => {
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

/** cid 形状：非数字 / `0` ⇒ **`404 LEDGER_CURRENCY_NOT_FOUND` + `{cid}`**（§3.1 v0.5 裁定含 `cid<=0`） */
const cidText = (raw: unknown, field: string): { ok: true; value: string } | { ok: false; err: VerbErr } => {
  const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
  if (!/^\d+$/.test(text) || text === '0') return { ok: false, err: currency404(text || 'null') };
  void field;
  return { ok: true, value: text };
};

/** 编排函数回执 → 只读视图（**不新增任何 kind、不改任何白名单**） */
const marketEventView = (r: Record<string, unknown>): Record<string, unknown> => {
  const entries = Array.isArray(r.entries) ? (r.entries as Array<Record<string, unknown>>) : [];
  const extra = (r.extra || {}) as Record<string, unknown>;
  const pick = (k: string): string | null => (r[k] === undefined || r[k] === null ? null : String(r[k]));
  return {
    op: pick('op'),
    order_id: pick('order_id'),
    owner_uid: pick('owner_uid'),
    side: pick('side'),
    base_cid: pick('base_cid'),
    quote_cid: pick('quote_cid'),
    price: pick('price'),
    amount: pick('amount'),
    amount_filled: pick('amount_filled'),
    order_status: pick('status'),
    frozen_hold: pick('frozen_hold'),
    trade_id: r.trade_id === undefined || r.trade_id === null ? (extra.trade_id ?? null) : String(r.trade_id),
    created: r.created === true,
    idempotent_replay: r.idempotent_replay === true,
    txid: pick('txid'),
    ledger_idempotency_key: pick('ledger_idempotency_key'),
    ledger_event_keys: Array.isArray(r.ledger_event_keys) ? r.ledger_event_keys : [],
    currency_status: extra.currency_status === undefined || extra.currency_status === null ? null : String(extra.currency_status),
    event_kinds: extra.event_kinds === undefined || extra.event_kinds === null ? null : String(extra.event_kinds),
    entry_count: entries.length,
    kinds: entries.map((e) => String(e.kind ?? '')),
    entries,
    accounts: Array.isArray(r.accounts) ? r.accounts : [],
  };
};

// ============================================================================
// M1 · 挂单（`market_post_event(op='order')`；`hold` ×2 同 uid 同 cid，DL85/DL90/DL64）
// ----------------------------------------------------------------------------
// 触发端点（§4.2 M1）= `POST /api/market/order`（**未注册**）/ `POST /api/order`（**已注册 `:731`** ⇒ 本片改接）。
// 资金四栏（§4.3 M1）：**谁出钱** = 挂单人（买单：`$` **可用 → 冻结** `amount×price`；卖单：base 币 `amount`）；
//   **谁收钱** = **无人**（冻结）；**平台费 / 佣金 = 无**。
// 单语句原子 + 币对锁：见文件头（`DatabaseService.marketPostEvent`）。
// ============================================================================
export const placeMarketOrder = async (params: {
  /** token 侧身份（**挂单人唯一真源**；body 里的 `owner_uid`/`uID` 一律被丢弃） */
  actorUid: number;
  body: Record<string, unknown> | undefined;
  /** `Idempotency-Key` 头（与 body 键同口径，§4.5） */
  headerKey?: string | null;
}): Promise<VerbResult> => {
  const body = params.body || {};
  const actor = actorGate(params.actorUid);
  if (!actor.ok) return actor.err;

  // ① 创建键（§4.4-14 判据：`market_order` 无自然键 ⇒ fail-loud、不派生）
  const keyed = resolveMarketCreateKeyRequired(
    body.create_key ?? body.createKey ?? body.idempotency_key ?? body.idempotencyKey ?? params.headerKey,
  );
  if (!keyed.ok) return keyed.err;

  // ② base_cid：前端键 = `bID`；形状非法/`0` ⇒ `404 LEDGER_CURRENCY_NOT_FOUND`
  const base = cidText(body.base_cid ?? body.baseCid ?? body.bID, 'base_cid');
  if (!base.ok) return base.err;

  // ③ quote_cid：**缺省 ⇒ 服务端恒 `1`**（DL64；前端不传）；
  //    显式传值**原样交 DB**（`QUOTE_CID_MUST_BE_ONE` 的真源在函数内 `0016:492-495`，不在本层重造）
  const quoteRaw = body.quote_cid ?? body.quoteCid;
  const quoteText = quoteRaw === undefined || quoteRaw === null || String(quoteRaw).trim() === ''
    ? '1' : String(quoteRaw).trim();

  // ④ base = quote 的**前置闸**（避免裸 `23514` CHECK 触发；码与 DB `BASE_QUOTE_CID_EQUAL` 同名同码类）
  if (base.value === quoteText) {
    return shapeError('base_cid', 'BASE_QUOTE_CID_EQUAL', { value: base.value, quote_cid: quoteText });
  }

  // ⑤ side（DB 真源 = `UNKNOWN_MARKET_SIDE`，同码同名）
  const sideText = String(body.side ?? '').trim();
  if (sideText !== 'buy' && sideText !== 'sell') {
    return shapeError('side', 'UNKNOWN_MARKET_SIDE', { value: sideText || 'null' });
  }

  // ⑥ price / amount（**用户自定限价单条款**，见文件头硬口径；前端键 `volume`）
  const price = toPosIntText(body.price, 'price');
  if (!price.ok) return price.err;
  const amount = toPosIntText(body.amount ?? body.volume ?? body.quantity, 'amount');
  if (!amount.ok) return amount.err;

  // ⑦ owner = **actor**（服务端注入；客户端传值被丢弃并登记）
  const ignoredOwner = body.owner_uid ?? body.ownerUid ?? body.uID;
  const payload = {
    op: 'order',
    create_key: keyed.key,
    owner_uid: String(actor.uid),
    side: sideText,
    base_cid: base.value,
    quote_cid: quoteText,
    price: price.value,
    amount: amount.value,
    request_fingerprint: fingerprintOf(['market.order', keyed.key, actor.uid, sideText, base.value, quoteText, price.value, amount.value]),
    memo: `market order:${keyed.key}`,
  };

  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.marketPostEvent(payload, { baseCid: Number(base.value), quoteCid: Number(quoteText) });
  } catch (e) {
    return fromLedgerError(e);
  }
  const r = (row.r || {}) as Record<string, unknown>;
  return {
    ok: true,
    replay: r.idempotent_replay === true,
    view: {
      ...marketEventView(r),
      client_owner_uid_ignored:
        ignoredOwner !== undefined && ignoredOwner !== null && String(ignoredOwner) !== String(actor.uid)
          ? String(ignoredOwner) : null,
      pair_lock: MARKET_PAIR_LOCK,
    },
  };
};

// ============================================================================
// M2 · 撤单（`market_post_event(op='cancel')`；`hold_release` ×2 同账户 balance↔frozen）
// ----------------------------------------------------------------------------
// 触发端点（§4.2 M2）= `DELETE /api/market/order/:orderId`（**未注册**）/ `DELETE /api/order/:oID`（**已注册 `:763`**）
//   / `DELETE /api/order`（**已注册 `:750`** ⇒ **全撤 = 逐单 op='cancel'**；**入参一律走 query，不得读 body**，§1 #27）。
// 资金四栏（§4.3 M2）：**谁出钱/谁收钱** = 挂单人自己（**冻结 → 可用**）；平台费 / 佣金 = 无。
// **手续费不可退**（DL87：`trade_fee` 是**消耗不是冻结** ⇒ 撤单**只**释放 `(amount−amount_filled)×price` /
//   `amount−amount_filled` 的**剩余在冻额**，**不**触碰已扣手续费）—— 实测 = 报告 §4.2 T05/T06。
// 授权：**只有订单 `owner_uid` 可撤**（spec §4.2 M2 未定义 actor ⇒ 服务层最严口径；非 owner ⇒ `403 AUTH_FORBIDDEN`
//   + `ACTOR_NOT_ALLOWED`，与 3c/3d 同族；**不可观察性**（DL111/DL124）与「响亮的 403」二选一已择 403 —— 登记供 Zang）。
// ============================================================================
const cancelOne = async (actorUid: number, orderIdText: string): Promise<VerbResult> => {
  // ① 只读解析订单（拿 `owner_uid` 做授权闸；**这不是**授权真源 —— 真源仍是服务端取的订单行）
  let order: Awaited<ReturnType<typeof DatabaseService.resolveMarketOrder>>;
  try {
    order = await DatabaseService.resolveMarketOrder(Number(orderIdText));
  } catch (e) {
    return fromLedgerError(e);
  }
  if (!order) return ref404('market_order', orderIdText, { field: 'order_id', reason: 'order_not_found' });

  // ② 授权闸（**仅 owner**）——§6.2 附表口径：已参与但无该动作权限 ⇒ `403 AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`
  if (order.ownerUid !== actorUid) {
    return fail(403, 'AUTH_FORBIDDEN', {
      reason: 'ACTOR_NOT_ALLOWED',
      field: 'actor.uid',
      ref_type: 'market_order',
      ref_id: orderIdText,
      required_uid: String(order.ownerUid),
    });
  }

  const payload = {
    op: 'cancel',
    order_id: orderIdText,
    request_fingerprint: fingerprintOf(['market.cancel', orderIdText, actorUid]),
    memo: `market cancel:${orderIdText}`,
  };
  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.marketPostEvent(payload, { baseCid: order.baseCid, quoteCid: order.quoteCid });
  } catch (e) {
    return fromLedgerError(e);
  }
  const r = (row.r || {}) as Record<string, unknown>;
  return { ok: true, replay: r.idempotent_replay === true, view: { ...marketEventView(r), pair_lock: MARKET_PAIR_LOCK } };
};

export const cancelMarketOrder = async (params: {
  actorUid: number;
  /** URL 参数 `:oID`（原样，形状闸在本函数） */
  orderIdRaw: unknown;
}): Promise<VerbResult> => {
  const actor = actorGate(params.actorUid);
  if (!actor.ok) return actor.err;

  const orderIdText = typeof params.orderIdRaw === 'string'
    ? params.orderIdRaw.trim() : String(params.orderIdRaw ?? '');
  // 非数字 / `0` ⇒ 404（§3.1「写目标不存在」与「非数字 id」同族；与批 2/3c/3d 的 404 口径一致）
  if (!/^\d+$/.test(orderIdText) || orderIdText === '0') {
    return ref404('market_order', orderIdText || 'null', { field: 'order_id', reason: 'order_not_found' });
  }
  return cancelOne(actor.uid, orderIdText);
};

/**
 * `DELETE /api/order`（**全撤**）：§4.2 M2 / §1 #27「全撤 ⇒ `op='cancel'`（**逐单**）；**入参一律走 query，
 * 不得读 body**」（已裁 §7-5）。**逐单**各成一次事件（不合并 ⇒ 每单一个 `biz:market:cancel:<order_id>` 根键，
 * 与 §4.5 逐字一致）；**不做全或无**（一笔失败不阻断其余，逐条登记在 `orders[]`）。
 * 返回体保留旧前端读的 `cancelled` 键（`frontend/src/pages/ShardPage.jsx:333`）—— **键集登记见报告 §5**。
 */
export const cancelAllMarketOrders = async (params: {
  actorUid: number;
  /** `req.query`（**不得**读 body）；带 `order_id`/`oID` ⇒ 退化为单撤 */
  query?: Record<string, unknown>;
}): Promise<VerbResult> => {
  const actor = actorGate(params.actorUid);
  if (!actor.ok) return actor.err;

  const one = params.query?.order_id ?? params.query?.orderId ?? params.query?.oID ?? params.query?.id;
  if (one !== undefined && one !== null && String(one).trim() !== '') {
    return cancelOne(actor.uid, String(one).trim());
  }

  let ids: number[];
  try {
    ids = await DatabaseService.listOpenMarketOrderIds(actor.uid);
  } catch (e) {
    return fromLedgerError(e);
  }

  const orders: Array<Record<string, unknown>> = [];
  let cancelled = 0;
  for (const id of ids) {
    const r = await cancelOne(actor.uid, String(id));
    if (r.ok) {
      cancelled += 1;
      orders.push({ order_id: String(id), ok: true, order_status: r.view?.order_status ?? null, replay: r.replay === true });
    } else {
      orders.push({ order_id: String(id), ok: false, status: r.status, code: r.code, details: r.details });
    }
  }
  return {
    ok: true,
    replay: false,
    view: {
      cancelled,
      attempted: ids.length,
      failed: orders.filter((o) => o.ok !== true).length,
      orders,
      pair_lock: MARKET_PAIR_LOCK,
      scope: MARKET_PAIR_LOCK_SCOPE,
    },
  };
};

// ============================================================================
// M3 · 成交（`market_post_event(op='trade')`；`trade` ×4 + `trade_fee` ×2，DL85/DL87）
// ----------------------------------------------------------------------------
// 触发端点（§4.2 M3）= **撮合服务调用**（批 3 新端点）；**本片只交付服务层**（无前端调用 ⇒ 路由随批 4 = §1.8 待补行）。
// 资金四栏（§4.3 M3）：**买方** `−quote`、**卖方** `−base`（**均从各自冻结额结算**，`trade` ×4）；
//   受款方 = 买方 `+base` / 卖方 `+quote`；**平台费** = `trade_fee`（**taker 付、恒 `$`、消耗**，全额入 `-1`）；**佣金 = 无**。
// 服务端取数（硬口径 #4）：`price` = **买单限价**；`buy_order_id`/`sell_order_id` = **服务端选择的最优对手方**；
//   `fee` = 服务端按 D-2 计算。**客户端传 `price`/`buy_order_id`/`sell_order_id`/`fee` 一律丢弃并登记**。
// 对手方选择口径（**本片明文 + 单点可改**，见报告 §3）：同币对、反向、`status ∈ {open,partial}`、
//   **可成交（crossable）**：taker=buy ⇒ 选 `sell.price <= buy.price` 中**价优（price 升序）→ `time_created` → `order_id`**；
//   taker=sell ⇒ 选 `buy.price >= sell.price` 中**价优（price 降序）→ `time_created` → `order_id`**；
//   **优先非自身**（`owner_uid <> taker.owner_uid`）；**无「非自身」候选时**才退到含自身 ⇒ 让 DB 的
//   `self_trade_not_allowed` 闸**响亮拒绝**（`LEDGER_SELF_TRANSFER`，实测 = 报告 §4.2 T08）。
// ============================================================================
export const matchMarketOrders = async (params: {
  /** token/服务侧身份（可选）：给定则**必须 = taker 订单的 `owner_uid`**；未给 ⇒ 内部撮合服务调用面 */
  actorUid?: number | null;
  body: Record<string, unknown> | undefined;
}): Promise<VerbResult> => {
  const body = params.body || {};

  // ① taker_order_id（§4.5 事件根键的自然标识 = **订单**）；形状 ⇒ 404
  const takerIdText = String(body.taker_order_id ?? body.takerOrderId ?? body.order_id ?? '').trim();
  if (!/^\d+$/.test(takerIdText) || takerIdText === '0') {
    return ref404('market_order', takerIdText || 'null', { field: 'taker_order_id', reason: 'order_not_found' });
  }

  // ② fill_no（**D-1：必填 fail-loud**，码与 DB 同码同名 `FILL_NO_REQUIRED`）
  const fillNo = toPosIntText(body.fill_no ?? body.fillNo, 'fill_no');
  if (!fillNo.ok) {
    if (body.fill_no === undefined || body.fillNo === undefined || String(body.fill_no ?? body.fillNo ?? '').trim() === '') {
      return shapeError('fill_no', 'FILL_NO_REQUIRED');
    }
    return fillNo.err;
  }

  // ③ amount（本次成交量；`> 剩余` 由 DB 闸 `market_order_amount_insufficient` ⇒ 409）
  const amount = toPosIntText(body.amount ?? body.volume ?? body.quantity, 'amount');
  if (!amount.ok) return amount.err;

  // ④ 只读解析 taker 行（服务端真源；含 pair / side / price / owner）
  let taker: Awaited<ReturnType<typeof DatabaseService.resolveMarketOrder>>;
  try {
    taker = await DatabaseService.resolveMarketOrder(Number(takerIdText));
  } catch (e) {
    return fromLedgerError(e);
  }
  if (!taker) return ref404('market_order', takerIdText, { field: 'taker_order_id', reason: 'order_not_found' });

  // ⑤ 可选 actor 闸（给定则须 = taker owner）
  if (params.actorUid !== undefined && params.actorUid !== null) {
    const actor = actorGate(params.actorUid);
    if (!actor.ok) return actor.err;
    if (actor.uid !== taker.ownerUid) {
      return fail(403, 'AUTH_FORBIDDEN', {
        reason: 'ACTOR_NOT_ALLOWED',
        field: 'actor.uid',
        ref_type: 'market_order',
        ref_id: takerIdText,
        required_uid: String(taker.ownerUid),
      });
    }
  }

  // ⑥ 对手方（**服务端选择**；客户端传值被丢弃并登记）
  const base = taker.baseCid;
  const quote = taker.quoteCid;
  let cp: Awaited<ReturnType<typeof DatabaseService.resolveMarketCounterparty>>;
  try {
    cp = await DatabaseService.resolveMarketCounterparty({
      baseCid: base, quoteCid: quote, takerOrderId: taker.orderId, takerSide: taker.side,
      takerPrice: taker.price, takerOwnerUid: taker.ownerUid, excludeSelf: true,
    });
    if (!cp) {
      // 无「非自身」候选 ⇒ 退到含自身（让 DB 自成交闸响亮拒绝；仍无候选 ⇒ 404 无对手方）
      cp = await DatabaseService.resolveMarketCounterparty({
        baseCid: base, quoteCid: quote, takerOrderId: taker.orderId, takerSide: taker.side,
        takerPrice: taker.price, takerOwnerUid: taker.ownerUid, excludeSelf: false,
      });
    }
  } catch (e) {
    return fromLedgerError(e);
  }
  if (!cp) {
    return ref404('market_order', takerIdText, {
      field: 'counterparty', reason: 'no_matchable_counterparty',
      base_cid: String(base), quote_cid: String(quote), side: taker.side,
    });
  }

  // ⑦ 服务端定价（**price 恒 = 买单限价**，DL85/`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`）
  const buyOrderId = taker.side === 'buy' ? taker.orderId : cp.orderId;
  const sellOrderId = taker.side === 'sell' ? taker.orderId : cp.orderId;
  const buyPrice = taker.side === 'buy' ? taker.price : cp.price;

  // ⑧ 手续费（**D-2：服务端取数**）；无政策行 ⇒ 0（登记 + NOT_MEASURED）
  let rateBp: number | null;
  try {
    rateBp = await DatabaseService.currentFeeRateBp();
  } catch (e) {
    return fromLedgerError(e);
  }
  const turnover = BigInt(amount.value) * BigInt(buyPrice);
  const fee = rateBp === null ? 0n : (turnover * BigInt(rateBp) + 5000n) / 10000n;

  const ignored = {
    client_price: body.price ?? null,
    client_buy_order_id: body.buy_order_id ?? body.buyOrderId ?? null,
    client_sell_order_id: body.sell_order_id ?? body.sellOrderId ?? null,
    client_fee: body.fee ?? null,
  };
  const anyIgnored = Object.values(ignored).some((v) => v !== null && v !== undefined && String(v).trim() !== '');

  const payload = {
    op: 'trade',
    taker_order_id: takerIdText,
    buy_order_id: String(buyOrderId),
    sell_order_id: String(sellOrderId),
    price: String(buyPrice),
    amount: amount.value,
    fee: fee.toString(),
    fill_no: fillNo.value,
    request_fingerprint: fingerprintOf(['market.trade', takerIdText, fillNo.value, amount.value, buyPrice, fee.toString()]),
    memo: `market trade:${takerIdText}:${fillNo.value}`,
  };

  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.marketPostEvent(payload, { baseCid: Number(base), quoteCid: Number(quote) });
  } catch (e) {
    return fromLedgerError(e);
  }
  const r = (row.r || {}) as Record<string, unknown>;
  return {
    ok: true,
    replay: r.idempotent_replay === true,
    view: {
      ...marketEventView(r),
      taker_order_id: takerIdText,
      taker_uid: String(taker.ownerUid),
      buy_order_id: String(buyOrderId),
      sell_order_id: String(sellOrderId),
      buy_price: String(buyPrice),
      fill_no: fillNo.value,
      quantity: amount.value,
      turnover: turnover.toString(),
      fee: fee.toString(),
      fee_rate_bp: rateBp,
      fee_rate_source: MARKET_FEE_RATE_SOURCE,
      fee_rounding: MARKET_FEE_ROUNDING,
      counterparty_selected_server_side: true,
      client_inputs_ignored: anyIgnored ? ignored : null,
      pair_lock: MARKET_PAIR_LOCK,
    },
  };
};
