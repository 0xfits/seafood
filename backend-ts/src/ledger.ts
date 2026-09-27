/**
 * P1a · 多币种账本服务层（账本唯一入口）
 * ============================================================================
 * 权威口径：`docs/ledger.spec.md`（962 行 / R1..R108）。本文件逐条落地的规则：
 *   §2   三张核心表数据契约（currency / account / ledger_entry）
 *   §3   币种语义与「状态 × 操作」矩阵（R26 / R28）
 *   §4   余额语义与三态记账（balance / frozen、同账户两条分录）
 *   §5   20 个 kind 关闭集（R40）+ 配对不变式（R41）
 *        〔P1c 收口（Zang 裁定）：22 → 20 —— 删 `listing_deposit_refund`（spec v0.2 已删）
 *          与 `listing_deposit_forfeit`（保证金上市时即消耗，强制下架不存在可罚没标的物）；
 *          见 `migrations/0003_kind_close_set_20.sql`。spec §5.1 回写由 Jing 另单执行。〕
 *   §6   幂等键（R48 全局唯一 + R49 前缀强制 + R50 确定性派生 + R51 协议 + R52 返回语义）
 *   §7   事务边界（R55 写路径必须在 withTransaction 内 + R57 一事件一事务）
 *   §8   金额表示（R66 bigint 最小单位 + R70 出入参十进制字符串 + R71 上限 + R72 入参校验）
 *   §9   append-only + account 守卫（R74 先插分录后更账户 + R75 开户必须 0/0）
 *   §10  加锁全序（R79 currency(cid 升序) → account(uid 升序) → 业务行）+ 负余额禁令（R80）
 *   §13  平台保留 uid（R98 / R100 / R101 / R103：只进不出）
 *   §14  统一错误码（R104 唯一来源 = ./ledger-errors.ts）
 *
 * 基础设施（不重写）：`src/db.ts` 的 withTransaction / txQuery / readQuery / healthCheck。
 *
 * ---------------------------------------------------------------- 幂等键分工（R51 落地口径）
 * 一次业务事件写 N 条分录，而 `ledger_entry.idempotency_key` 是**全局唯一**（R48），
 * 因此：第 1 条分录使用**调用方传入的键**（它就是幂等探针本身），第 i 条（i≥2）使用
 * `deriveEventKey(key, i)` = `<key>#<i>`：同一键空间、前缀不变、可确定性派生（R49/R50）。
 * 探针一律用 `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING txid`，
 * 返回 0 行 ⇒ 抛内部哨兵 ⇒ 整个事务 ROLLBACK ⇒ 另起只读查询按键取回既有结果（R51）。
 * **绝不**「先 SELECT 查在不在，再 INSERT」（并发下必然双扣，R51 明令禁止）。
 *
 * ---------------------------------------------------------------- 错误码 details 形状表（R107）
 *   LEDGER_INSUFFICIENT_BALANCE  { uid, cid, required, available }
 *   LEDGER_INSUFFICIENT_FROZEN   { uid, cid, required, available, reason? }   reason='business_frozen_cap'
 *   LEDGER_IDEMPOTENCY_CONFLICT  { idempotency_key, expected?, actual? }
 *   LEDGER_CURRENCY_*            { cid, symbol, status }
 *   LEDGER_SUPPLY_CAP_EXCEEDED   { cid, symbol, total_supply, supply_cap, requested }
 *   LEDGER_UNAUTHORIZED_MINT     { cid, owner_uid, actor_uid, platform }
 *   LEDGER_AMOUNT_*              { field, value?, reason? }
 *   LEDGER_DECIMALS_OVERFLOW     { cid, field, decimals, provided }
 *   LEDGER_RESERVED_UID          { field, uid, reason? }
 *   LEDGER_UNKNOWN_KIND          { kind } / LEDGER_HOLD_NOT_ALLOWED { uid, cid, reason }
 *   LEDGER_NEGATIVE_BALANCE_GUARD / LEDGER_ACCOUNT_GUARD_VIOLATION / LEDGER_APPEND_ONLY_VIOLATION { constraint? }
 *   〔P1c 收口新增〕驱动级 / 非 PG 错误的可机读 reason（Zang 裁定，spec §14.4 待同步）：
 *   LEDGER_TX_TIMEOUT            { reason: 'pool_connection_timeout' | 'driver_connection_error', ... }
 *                                —— 连接池过载 / 拿连接超时 / 驱动连接级错误，HTTP 503（原本被误报成 500）
 *   LEDGER_TRANSACTION_REQUIRED  { cause, reason: 'unclassified_non_pg_error' | 'unclassified_driver_error'
 *                                  | 'unclassified_pg_error', error_name, error_code|pg_code }
 *
 * ---------------------------------------------------------------- 本阶段**未**实现（明确留白，勿误判为遗漏）
 *   - 招工 / 商品 / 交易所 / 返佣 / 上市费 / 保证金冻结 等业务动作（P3/P4/P5）
 *   - `burn`（P1a 未在交付清单内；kind 白名单与 §5 已就绪，实现时可复用 postEntry）
 *   - `reversal` 冲正动作（表结构与 R20/R46 约束已就绪，未写服务函数）
 *   - R81 乐观锁分支：本阶段**全部**走 `SELECT ... FOR UPDATE`（spec §15 #17 明示「可改」）
 *   - R108 告警通道：仅提供 `isDefectError()` 判定，未接日志/指标
 *   - R92/R87 对账脚本与判负演练：属下一阶段交付物
 *   - `platform_withdraw`：未实现，平台账户**只进不出**（D7 更正版 + R103，未获批准前禁止）
 */
import {
  TxClient,
  withTransaction,
  txQuery,
  readQuery,
  assertInTransaction,
} from './db';
import {
  LedgerError,
  LedgerErrorCode,
  LedgerErrorDetails,
  isLedgerError,
  normalizeLedgerError,
  toErrorResponse,
} from './ledger-errors';

export * from './ledger-errors';

// ============================================================================
// 常量（§5 kind 关闭集 / §2 ref_type 白名单 / §13 保留 uid / §8 上限）
// ============================================================================

/** §13.2 保留 uid：平台主体 0，手续费归集 −1，佣金池 −2，罚没 −3 */
export const PLATFORM_UID = {
  /** 平台主体（`$` 的 owner_uid，铸币源） */
  PLATFORM: 0n,
  /** 手续费归集账户 = 平台收入（只进不出，R103） */
  FEE: -1n,
  /** 佣金池（唯一入口 job_fee，唯一出口 commission） */
  COMMISSION: -2n,
  /** 罚没账户（hold_forfeit） */
  FORFEIT: -3n,
} as const;

/** R2：`$` 系统币 cid = 1（migration 显式插入，BY DEFAULT IDENTITY 即为此） */
export const SYSTEM_CURRENCY_CID = 1n;

/** R71：单笔金额上限（最小单位整数），远低于 bigint 上限 */
export const MAX_SINGLE_AMOUNT = 1_000_000_000_000_000n; // 1e15

/**
 * §5.1 kind 关闭集（R40：改这个集合必须走 migration + 回写 spec）。
 * P1c 收口后 = **20 个**（Zang 裁定 22 → 20）：
 *   - `listing_deposit_refund`：spec v0.2 已删（保证金 = 消耗不可退）
 *   - `listing_deposit_forfeit`：P1c 新裁定删（保证金在上市时即消耗、进平台收入 `uid=-1`，
 *     强制下架时**不存在可罚没的标的物**；将来若做「强制下架罚款」属**新语义、新 kind**，需单独定）
 *   DB 侧同款删除见 `migrations/0003_kind_close_set_20.sql`（CHECK 约束重建，非 enum 类型）。
 */
export const LEDGER_KINDS = [
  'mint', 'burn', 'transfer', 'hold', 'hold_release', 'hold_forfeit',
  'job_escrow', 'job_escrow_refund', 'job_payout', 'job_fee', 'commission',
  'purchase', 'sale', 'purchase_refund',
  'trade', 'trade_fee',
  'listing_fee', 'listing_deposit',
  'currency_create_fee', 'reversal',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/** §2 ledger_ref_type_enum 白名单（R18） */
export const REF_TYPES = [
  'job', 'listing', 'listing_order', 'market_order', 'market_trade', 'currency', 'commission_payout', 'system',
] as const;
export type RefType = (typeof REF_TYPES)[number];

/** §3.1 币种四态 */
export const CURRENCY_STATUSES = ['draft', 'listed', 'frozen', 'delisted'] as const;
export type CurrencyStatus = (typeof CURRENCY_STATUSES)[number];

/** §4.2 三态记账：hold 家族（同账户搬运，必须是 2 条分录）〔P1c：移除已删的 `listing_deposit_refund`〕 */
export const HOLD_KINDS: LedgerKind[] = ['hold', 'hold_release', 'job_escrow', 'job_escrow_refund',
  'listing_deposit'];

/** §4.2 / §5：冻结资金可以直接支付给对方的 kind 白名单（R33 ① ②）〔P1c：移除已删的 `listing_deposit_forfeit`〕 */
export const FROZEN_SETTLE_KINDS: LedgerKind[] = [
  'job_payout', 'purchase', 'trade', 'hold_forfeit',
];

/** §5：成对出账时的受款方 kind（如买家侧 purchase 对卖家侧 sale） */
export const SETTLE_PAYEE_KIND: Partial<Record<LedgerKind, LedgerKind>> = {
  purchase: 'sale',
  trade: 'trade',
  job_payout: 'job_payout',
  hold_forfeit: 'hold_forfeit',
};

/** R28「状态 × 操作」矩阵（逐格判定；未列入的操作见 assertCurrencyOperable 注释） */
export type CurrencyOp = 'mint' | 'transfer' | 'hold' | 'hold_release' | 'settle' | 'price';
export const CURRENCY_OP_MATRIX: Record<CurrencyOp, Record<CurrencyStatus, boolean>> = {
  // mint（owner 铸币）：draft ✅ listed ✅ frozen ❌ delisted ❌
  mint: { draft: true, listed: true, frozen: false, delisted: false },
  // transfer（用户间转账）：存量持仓永远可转 ⇒ 四态全 ✅
  transfer: { draft: true, listed: true, frozen: true, delisted: true },
  // hold / 交易所挂单：draft ❌ listed ✅ frozen ❌ delisted ❌
  hold: { draft: false, listed: true, frozen: false, delisted: false },
  // hold_release：R28 未逐格列出。按 §7.2 #14（下架必须撤销挂单并解冻）⇒ 必须四态全可
  hold_release: { draft: true, listed: true, frozen: true, delisted: true },
  // settle（冻结资金结算）：R28 未列出，取与 hold 同档（frozen/delisted 不再产生新成交）
  settle: { draft: false, listed: true, frozen: false, delisted: false },
  // 商品标价 / 招工酬金计价：draft ❌ listed ✅ frozen ❌ delisted ❌
  price: { draft: false, listed: true, frozen: false, delisted: false },
};

// ============================================================================
// 类型
// ============================================================================

/** 金额入参：最小单位整数（bigint / 安全整数 number / 十进制字符串，R66/R70）；展示字符串见 parseUserAmount */
export type Amount = bigint | number | string;

/** DB 行（库里列名 snake_case 无引号，R22）；金额一律以十进制字符串出参（R70） */
export interface AccountRecord {
  uid: string;
  cid: string;
  balance: string;
  frozen: string;
  version: string;
  time_created: string | null;
  time_updated: string | null;
}

export interface CurrencyRecord {
  cid: string;
  symbol: string;
  name: string;
  icon_url: string;
  owner_uid: string;
  decimals: number;
  total_supply: string;
  supply_cap: string | null;
  status: CurrencyStatus;
  deposit_amount: string;
  deposit_cid: string;
  listed_at: string | null;
  time_created: string | null;
  time_updated: string | null;
}

export interface LedgerEntryRecord {
  txid: string;
  uid: string;
  cid: string;
  /** 可用余额变动 */
  delta: string;
  /** 冻结余额变动（R15 双字段） */
  frozen_delta: string;
  balance_after: string;
  frozen_after: string;
  kind: LedgerKind;
  ref_type: string | null;
  ref_id: string | null;
  idempotency_key: string;
  request_fingerprint: string | null;
  reversal_of_txid: string | null;
  memo: string;
  time_created: string | null;
}

/** 落账后余额快照（对上层唯一需要关心的余额形状） */
export interface AccountSnapshot {
  uid: string;
  cid: string;
  balance: string;
  frozen: string;
}

/** 五个高层动作的统一返回（R52：`idempotent_replay` 必须能被上层直接读到） */
export interface LedgerOpResult {
  ok: true;
  /** false = 首次生效；true = 同键重放（R106：前端按成功处理） */
  idempotent_replay: boolean;
  idempotency_key: string;
  /** 本事件首条分录 txid（幂等键所在行） */
  txid: string;
  entries: LedgerEntryRecord[];
  accounts: AccountSnapshot[];
  extra: Record<string, string | null>;
}

type RawRow = Record<string, unknown>;

// ============================================================================
// 金额工具（§8）
// ============================================================================

const rawStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const rawStrOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const tsOrNull = (v: unknown): string | null =>
  (v === null || v === undefined ? null : new Date(v as string | number | Date).toISOString());
const big = (v: Amount): string => toAmount(v, 'amount').toString();

/** 严格整数金额（允许负数，供 delta 使用）。浮点 JSON number 一律拒绝（R72①） */
export const toAmount = (v: Amount, field: string): bigint => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || !Number.isSafeInteger(v)) {
      throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_INTEGER_OR_UNSAFE' });
    }
    return BigInt(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^-?\d+$/.test(s)) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_DECIMAL_INTEGER' });
    return BigInt(s);
  }
  throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'BAD_TYPE' });
};

/**
 * 用户输入金额解析（R69/R72）：`"123.45"` + `decimals = 2` ⇒ `12345n`。
 * ① 浮点 JSON number ⇒ 拒绝（不四舍五入）；② `<= 0` ⇒ LEDGER_AMOUNT_NOT_POSITIVE；
 * ③ 小数位超过币种 decimals ⇒ LEDGER_DECIMALS_OVERFLOW；④ 超单笔上限 ⇒ LEDGER_AMOUNT_INVALID。
 */
export const parseUserAmount = (v: Amount, decimals: number, field = 'amount', cid?: string): bigint => {
  let units: bigint;
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || !Number.isSafeInteger(v)) {
      throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_INTEGER_OR_UNSAFE' });
    }
    units = BigInt(v); // 整数 number 按「最小单位」解释（与 §8 一致）
  } else if (typeof v === 'bigint') {
    units = v;
  } else if (typeof v === 'string') {
    const s = v.trim();
    if (/^-/.test(s)) throw new LedgerError('LEDGER_AMOUNT_NOT_POSITIVE', { field, value: s });
    const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
    if (!m) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_DECIMAL_STRING' });
    const frac = m[2] ?? '';
    if (frac.length > decimals) {
      throw new LedgerError('LEDGER_DECIMALS_OVERFLOW', { cid: cid ?? null, field, decimals, provided: frac.length });
    }
    const scale = 10n ** BigInt(decimals);
    units = BigInt(m[1]) * scale + BigInt(frac.padEnd(decimals, '0') || '0');
  } else {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'BAD_TYPE' });
  }

  if (units <= 0n) throw new LedgerError('LEDGER_AMOUNT_NOT_POSITIVE', { field, value: units.toString() });
  if (units > MAX_SINGLE_AMOUNT) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, value: units.toString(), reason: 'OVER_MAX_SINGLE_AMOUNT' });
  }
  return units;
};

// ============================================================================
// 幂等键（§6）
// ============================================================================

const IDEMPOTENCY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'] as const;

/** R49：键前缀强制；R52③：写路径必须带键 ⇒ 缺失抛 LEDGER_IDEMPOTENCY_KEY_REQUIRED */
export const normalizeIdempotencyKey = (v: unknown): string => {
  if (v === null || v === undefined || v === '') {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_REQUIRED');
  }
  if (typeof v !== 'string') throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', { reason: 'NOT_STRING' });
  const key = v.trim();
  if (key.length === 0 || key.length > 256) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', { reason: key.length === 0 ? 'EMPTY' : 'TOO_LONG' });
  }
  if (!IDEMPOTENCY_PREFIXES.some((p) => key.startsWith(p))) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', { reason: 'PREFIX_REQUIRED', provided: key.slice(0, 8) });
  }
  return key;
};

/** 同一事件第 i 条分录（i ≥ 2）的派生键：`<key>#<i>`（前缀不变，确定性派生 R50） */
export const deriveEventKey = (key: string, index: number): string => `${key}#${index}`;

// ============================================================================
// kind / ref / uid 校验
// ============================================================================

export const isLedgerKind = (v: unknown): v is LedgerKind =>
  typeof v === 'string' && (LEDGER_KINDS as readonly string[]).includes(v);

export const assertLedgerKind = (kind: unknown): LedgerKind => {
  if (!isLedgerKind(kind)) throw new LedgerError('LEDGER_UNKNOWN_KIND', { kind: String(kind) });
  return kind;
};

/** R18：ref_type / ref_id 成对出现或成对为 NULL（§14 无专用码 ⇒ 归 AMOUNT_INVALID + reason） */
const normalizeRef = (refType: unknown, refId: unknown): { refType: RefType | null; refId: string | null } => {
  const hasType = refType !== null && refType !== undefined && refType !== '';
  const hasId = refId !== null && refId !== undefined && refId !== '';
  if (hasType !== hasId) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'ref_type/ref_id', reason: 'REF_PAIR_MISMATCH' });
  }
  if (!hasType) return { refType: null, refId: null };
  if (!(REF_TYPES as readonly string[]).includes(String(refType))) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'ref_type', value: String(refType), reason: 'NOT_IN_WHITELIST' });
  }
  return { refType: String(refType) as RefType, refId: toAmount(refId as Amount, 'ref_id').toString() };
};

/** R98/R100：真实用户 uid 恒 > 0；平台保留区间 0 / −1..−99 */
export const assertUserUid = (uid: Amount, field = 'uid'): bigint => {
  const u = toAmount(uid, field);
  if (u <= 0n) throw new LedgerError('LEDGER_RESERVED_UID', { field, uid: u.toString() });
  if (u > 9_000_000_000_000_000n) throw new LedgerError('LEDGER_RESERVED_UID', { field, uid: u.toString(), reason: 'OUT_OF_RANGE' });
  return u;
};

const toUid = (uid: Amount, field = 'uid'): bigint => {
  const u = toAmount(uid, field);
  if (u < -99n) throw new LedgerError('LEDGER_RESERVED_UID', { field, uid: u.toString(), reason: 'BELOW_RESERVED_RANGE' });
  return u;
};

const toCid = (cid: Amount): bigint => {
  const c = toAmount(cid, 'cid');
  if (c <= 0n) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: c.toString() });
  return c;
};

/**
 * R101 平台账户 kind 白名单（只针对 −1 / −2 / −3 / 0）。
 * 违反 ⇒ LEDGER_RESERVED_UID（§14 无「平台账户写操作非法」专用码，见交付报告「歧义点」）。
 */
const PLATFORM_KIND_WHITELIST: Record<string, { credit: LedgerKind[]; debit: LedgerKind[] }> = {
  '0': { credit: ['mint', 'transfer', 'reversal'], debit: ['transfer', 'burn', 'reversal'] },
  '-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee'], debit: [] }, // R103：只进不出
  '-2': { credit: ['job_fee'], debit: ['commission'] },
  // R38 说明「退还 = 反向 hold_forfeit 或从 −3 transfer」；R101 却禁止平台账户用 transfer
  // ⇒ spec 内部张力，本实现取宽松侧（允许退还路径），已登记为歧义点。
  '-3': { credit: ['hold_forfeit'], debit: ['hold_forfeit', 'transfer'] },
};

export const assertPlatformAccountMutation = (uid: bigint, kind: LedgerKind, dir: 'credit' | 'debit'): void => {
  const rule = PLATFORM_KIND_WHITELIST[uid.toString()];
  if (!rule) return; // −4..−99 预留区间 / 真实用户：不在本白名单管辖内
  if (!rule[dir].includes(kind)) {
    throw new LedgerError('LEDGER_RESERVED_UID', {
      uid: uid.toString(),
      kind,
      reason: dir === 'debit' ? 'PLATFORM_DEBIT_FORBIDDEN' : 'PLATFORM_CREDIT_KIND_FORBIDDEN',
    });
  }
};

// ============================================================================
// §3 币种读取与状态机
// ============================================================================

const mapCurrency = (r: RawRow): CurrencyRecord => ({
  cid: rawStr(r.cid),
  symbol: rawStr(r.symbol),
  name: rawStr(r.name),
  icon_url: rawStr(r.icon_url),
  owner_uid: rawStr(r.owner_uid),
  decimals: Number(r.decimals ?? 0),
  total_supply: rawStr(r.total_supply),
  supply_cap: rawStrOrNull(r.supply_cap),
  status: rawStr(r.status) as CurrencyStatus,
  deposit_amount: rawStr(r.deposit_amount),
  deposit_cid: rawStr(r.deposit_cid),
  listed_at: tsOrNull(r.listed_at),
  time_created: tsOrNull(r.time_created),
  time_updated: tsOrNull(r.time_updated),
});

const CURRENCY_COLS = 'cid, symbol, name, icon_url, owner_uid, decimals, total_supply, '
  + 'supply_cap, status, deposit_amount, deposit_cid, listed_at, time_created, time_updated';

/** 读币种（读路径走 pooler；传入 tx 则参与当前事务） */
export const getCurrency = async (cid: Amount, tx?: TxClient): Promise<CurrencyRecord | null> => {
  const c = toCid(cid);
  const rows = tx
    ? await txQuery<RawRow>(tx, `SELECT ${CURRENCY_COLS} FROM currency WHERE cid = $1`, [c.toString()])
    : await readQuery<RawRow>(`SELECT ${CURRENCY_COLS} FROM currency WHERE cid = $1`, [c.toString()]);
  return rows.length ? mapCurrency(rows[0]) : null;
};

export const getCurrencyBySymbol = async (symbol: string, tx?: TxClient): Promise<CurrencyRecord | null> => {
  const rows = tx
    ? await txQuery<RawRow>(tx, `SELECT ${CURRENCY_COLS} FROM currency WHERE symbol = $1`, [symbol])
    : await readQuery<RawRow>(`SELECT ${CURRENCY_COLS} FROM currency WHERE symbol = $1`, [symbol]);
  return rows.length ? mapCurrency(rows[0]) : null;
};

/** R2：`$` 系统币（cid = 1，owner_uid = 0） */
export const getSystemCurrency = (tx?: TxClient): Promise<CurrencyRecord | null> =>
  getCurrency(SYSTEM_CURRENCY_CID, tx);

/** 锁 `currency` 行（R83：mint/burn/状态变更必须先锁 currency，再动 account） */
const lockCurrency = async (tx: TxClient, cid: bigint): Promise<CurrencyRecord> => {
  const rows = await txQuery<RawRow>(
    tx, `SELECT ${CURRENCY_COLS} FROM currency WHERE cid = $1 FOR UPDATE`, [cid.toString()],
  );
  if (!rows.length) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: cid.toString() });
  return mapCurrency(rows[0]);
};

/** R27：状态转移白名单（§3.2 的 5 条），其余一律 LEDGER_CURRENCY_INVALID_TRANSITION */
const CURRENCY_TRANSITIONS: Record<CurrencyStatus, CurrencyStatus[]> = {
  draft: ['listed', 'delisted'],
  listed: ['frozen', 'delisted'],
  frozen: ['listed', 'delisted'],
  delisted: [], // R30：终态不可复活
};

export const assertCurrencyTransition = (from: CurrencyStatus, to: CurrencyStatus): void => {
  if (!CURRENCY_TRANSITIONS[from]?.includes(to)) {
    throw new LedgerError('LEDGER_CURRENCY_INVALID_TRANSITION', { from, to });
  }
};

/** R26：`$` 恒为 listed，禁止被冻结/下架 */
export const assertSystemCurrencyImmutable = (cur: CurrencyRecord): void => {
  if (BigInt(cur.cid) === SYSTEM_CURRENCY_CID && cur.status !== 'listed') {
    throw new LedgerError('LEDGER_CURRENCY_INVALID_TRANSITION', { cid: cur.cid, from: 'listed', to: cur.status });
  }
};

/** R28：逐格判定「状态 × 操作」；失败按状态返回精确错误码 */
export const assertCurrencyOperable = (cur: CurrencyRecord, op: CurrencyOp): void => {
  assertSystemCurrencyImmutable(cur);
  if (CURRENCY_OP_MATRIX[op][cur.status]) return;
  const details: LedgerErrorDetails = { cid: cur.cid, symbol: cur.symbol, status: cur.status, op };
  if (cur.status === 'frozen') throw new LedgerError('LEDGER_CURRENCY_FROZEN', details);
  if (cur.status === 'delisted') throw new LedgerError('LEDGER_CURRENCY_DELISTED', details);
  throw new LedgerError('LEDGER_CURRENCY_NOT_LISTED', details);
};

// ============================================================================
// §4 账户读写
// ============================================================================

const ACCOUNT_COLS = 'uid, cid, balance, frozen, version, time_created, time_updated';

const mapAccount = (r: RawRow): AccountRecord => ({
  uid: rawStr(r.uid),
  cid: rawStr(r.cid),
  balance: rawStr(r.balance),
  frozen: rawStr(r.frozen),
  version: rawStr(r.version),
  time_created: tsOrNull(r.time_created),
  time_updated: tsOrNull(r.time_updated),
});

export const getAccount = async (uid: Amount, cid: Amount, tx?: TxClient): Promise<AccountRecord | null> => {
  const u = toUid(uid).toString();
  const c = toCid(cid).toString();
  const rows = tx
    ? await txQuery<RawRow>(tx, `SELECT ${ACCOUNT_COLS} FROM account WHERE uid = $1 AND cid = $2`, [u, c])
    : await readQuery<RawRow>(`SELECT ${ACCOUNT_COLS} FROM account WHERE uid = $1 AND cid = $2`, [u, c]);
  return rows.length ? mapAccount(rows[0]) : null;
};

/**
 * 并发安全开户（R75：开户必须 0/0）。
 * 用 `INSERT ... ON CONFLICT (uid, cid) DO NOTHING` 处理「两只手同时开户」的赛跑：
 * 落败方会**等待**赢家提交（唯一索引冲突等待）而不是报错，随后 SELECT 拿到同一行。
 */
const ensureAccount = async (tx: TxClient, uid: bigint, cid: bigint): Promise<void> => {
  await txQuery(
    tx,
    'INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, $2, 0, 0) ON CONFLICT (uid, cid) DO NOTHING',
    [uid.toString(), cid.toString()],
  );
};

/** 开户 + 行锁（R79：同一事务内多账户必须按 uid 升序加锁，唯一允许的加锁入口） */
const lockAccount = async (tx: TxClient, uid: bigint, cid: bigint): Promise<AccountRecord> => {
  await ensureAccount(tx, uid, cid);
  const rows = await txQuery<RawRow>(
    tx, `SELECT ${ACCOUNT_COLS} FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE`,
    [uid.toString(), cid.toString()],
  );
  if (!rows.length) {
    throw new LedgerError('LEDGER_ACCOUNT_NOT_FOUND', { uid: uid.toString(), cid: cid.toString() });
  }
  return mapAccount(rows[0]);
};

/** R79：按 uid 升序（同 uid 再按 cid 升序）批量加锁，只接受已排序集合 */
export const lockAccounts = async (tx: TxClient, targets: Array<{ uid: Amount; cid: Amount }>): Promise<AccountRecord[]> => {
  const pairs = targets
    .map((t) => ({ uid: toUid(t.uid).toString(), cid: toCid(t.cid).toString() }))
    .sort((a, b) => (BigInt(a.uid) < BigInt(b.uid) ? -1 : BigInt(a.uid) > BigInt(b.uid) ? 1
      : BigInt(a.cid) < BigInt(b.cid) ? -1 : BigInt(a.cid) > BigInt(b.cid) ? 1 : 0));
  const out: AccountRecord[] = [];
  for (const p of pairs) out.push(await lockAccount(tx, BigInt(p.uid), BigInt(p.cid)));
  return out;
};

/**
 * 取账户，不存在则按 0/0 开出来（R75 + R99）。
 * 传入 tx ⇒ 用当前事务的连接（**业务事件内必须传 tx**，R57；不传则自开一个事务）。
 */
export const getOrCreateAccount = async (uid: Amount, cid: Amount, tx?: TxClient): Promise<AccountRecord> => {
  const u = toUid(uid);
  const c = toCid(cid);
  if (tx) return lockAccount(tx, u, c);
  return withTransaction((t) => lockAccount(t, u, c));
};

/**
 * R99：为某个新币种为**全部平台保留 uid** 开户（新币种创建流程必须调用，防遗漏）。
 * P1a 未实现币种创建动作，此函数供后续阶段直接复用。
 */
export const ensurePlatformAccounts = async (cid: Amount, tx?: TxClient): Promise<AccountRecord[]> => {
  const c = toCid(cid);
  const run = async (t: TxClient): Promise<AccountRecord[]> => {
    const out: AccountRecord[] = [];
    for (const uid of [0n, PLATFORM_UID.FEE, PLATFORM_UID.COMMISSION, PLATFORM_UID.FORFEIT]) {
      out.push(await lockAccount(t, uid, c));
    }
    return out;
  };
  return tx ? run(tx) : withTransaction(run);
};

// ============================================================================
// §5 分录写入器（原子：先插 ledger_entry，后更新 account，R74）
// ============================================================================

export interface PostEntryInput {
  uid: Amount;
  cid: Amount;
  /** 可用余额变动（可为 0，但不得与 frozenDelta 同时为 0 —— ledger_move_guard） */
  delta: Amount;
  /** 冻结余额变动（R15 双字段） */
  frozenDelta?: Amount;
  kind: LedgerKind;
  refType?: RefType | null;
  refId?: Amount | null;
  /** R49：必须带 biz:/cm:/cli:/ops: 前缀；首次事件的首条分录用调用方原始键 */
  idempotencyKey: string;
  /** R53：规范化请求体的 sha256；NULL = 「同键即重放」 */
  requestFingerprint?: string | null;
  memo?: string;
  /** kind = 'reversal' 时必须给出（ledger_reversal_guard） */
  reversalOfTxid?: Amount | null;
}

const ENTRY_COLS = 'txid, uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, '
  + 'ref_id, idempotency_key, request_fingerprint, reversal_of_txid, memo, time_created';

const mapEntry = (r: RawRow): LedgerEntryRecord => ({
  txid: rawStr(r.txid),
  uid: rawStr(r.uid),
  cid: rawStr(r.cid),
  delta: rawStr(r.delta),
  frozen_delta: rawStr(r.frozen_delta),
  balance_after: rawStr(r.balance_after),
  frozen_after: rawStr(r.frozen_after),
  kind: rawStr(r.kind) as LedgerKind,
  ref_type: rawStrOrNull(r.ref_type),
  ref_id: rawStrOrNull(r.ref_id),
  idempotency_key: rawStr(r.idempotency_key),
  request_fingerprint: rawStrOrNull(r.request_fingerprint),
  reversal_of_txid: rawStrOrNull(r.reversal_of_txid),
  memo: rawStr(r.memo),
  time_created: tsOrNull(r.time_created),
});

/** 同键重放哨兵：**只在事务内部**抛出，事务必须 ROLLBACK，再由外层按键取回既有结果（R51） */
class IdempotencyReplayDetected extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`idempotency replay detected: ${key}`);
    this.name = 'IdempotencyReplayDetected';
    this.key = key;
  }
}

/**
 * 分录写入器（R55：**必须在调用方事务内**；R74：先插分录后更账户，两者原子）。
 * 返回落账后的完整分录行（含 txid / balance_after / frozen_after）。
 */
export const postEntry = async (tx: TxClient, input: PostEntryInput): Promise<LedgerEntryRecord> => {
  assertInTransaction(tx); // R55 运行时断言：写路径无事务 ⇒ LEDGER_TRANSACTION_REQUIRED

  const kind = assertLedgerKind(input.kind);
  const uid = toUid(input.uid);
  const cid = toCid(input.cid);
  const delta = toAmount(input.delta, 'delta');
  const frozenDelta = toAmount(input.frozenDelta ?? 0n, 'frozenDelta');
  const key = normalizeIdempotencyKey(input.idempotencyKey);

  if (delta === 0n && frozenDelta === 0n) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'delta/frozen_delta', reason: 'BOTH_ZERO' });
  }

  const { refType, refId } = normalizeRef(input.refType, input.refId);
  const reversalOf = input.reversalOfTxid === null || input.reversalOfTxid === undefined
    ? null
    : toAmount(input.reversalOfTxid, 'reversal_of_txid').toString();
  if ((kind === 'reversal') !== (reversalOf !== null)) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'reversal_of_txid', reason: 'REVERSAL_GUARD' });
  }

  // R101：平台账户 kind 白名单（先判方向：delta/frozen_delta 谁非 0）
  if (delta > 0n || frozenDelta > 0n) assertPlatformAccountMutation(uid, kind, 'credit');
  if (delta < 0n || frozenDelta < 0n) assertPlatformAccountMutation(uid, kind, 'debit');

  // ① 锁账户（并按需 0/0 开户）
  const account = await lockAccount(tx, uid, cid);
  const balance = BigInt(account.balance);
  const frozen = BigInt(account.frozen);

  // ② 负余额禁令（R80：应用层先判，DB CHECK 只作兜底）
  const balanceAfter = balance + delta;
  const frozenAfter = frozen + frozenDelta;
  if (balanceAfter < 0n) {
    throw new LedgerError('LEDGER_INSUFFICIENT_BALANCE', {
      uid: uid.toString(), cid: cid.toString(), required: (-delta).toString(), available: balance.toString(),
    });
  }
  if (frozenAfter < 0n) {
    throw new LedgerError('LEDGER_INSUFFICIENT_FROZEN', {
      uid: uid.toString(), cid: cid.toString(), required: (-frozenDelta).toString(), available: frozen.toString(),
    });
  }

  // ③ 幂等探针 = 本事务的第一条 ledger_entry 插入（R51：靠唯一约束，禁止先查后插）
  const inserted = await txQuery<RawRow>(
    tx,
    `INSERT INTO ledger_entry
       (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id,
        idempotency_key, request_fingerprint, reversal_of_txid, memo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${ENTRY_COLS}`,
    [
      uid.toString(), cid.toString(), delta.toString(), frozenDelta.toString(),
      balanceAfter.toString(), frozenAfter.toString(), kind, refType, refId,
      key, input.requestFingerprint ?? null, reversalOf, input.memo ?? '',
    ],
  );
  if (!inserted.length) throw new IdempotencyReplayDetected(key);

  // ④ 更新账户（必须逐列等于刚插入的快照，否则 trg_account_guard 直接拒）
  const updated = await txQuery<RawRow>(
    tx,
    'UPDATE account SET balance = $3, frozen = $4, version = version + 1, time_updated = now() '
    + 'WHERE uid = $1 AND cid = $2 RETURNING ' + ACCOUNT_COLS,
    [uid.toString(), cid.toString(), balanceAfter.toString(), frozenAfter.toString()],
  );
  if (!updated.length) {
    throw new LedgerError('LEDGER_ACCOUNT_NOT_FOUND', { uid: uid.toString(), cid: cid.toString() });
  }

  return mapEntry(inserted[0]);
};

/**
 * R41 配对不变式：写库前断言「本事件不凭空造钱 / 不吞钱」。
 *
 * ⚠️ 口径说明（spec 内部张力，已登记进交付报告的歧义点）：
 *   R41 / §11 判据 8 的字面写法是「Σdelta = 0 **且** Σfrozen_delta = 0」，但该写法与
 *   §4.2 的三态记账**互相矛盾**：同一账户的 `hold`（balance −n / frozen +n）必然得到
 *   Σdelta = −n、Σfrozen_delta = +n。因此本实现断言的是其**等价且自洽**的形式：
 *   `Σ(delta + frozen_delta) = 0`（净资产守恒），含 mint/burn 的事件例外（差额 = 净增发）。
 */
export interface BalanceAssertion {
  delta_sum: string;
  frozen_delta_sum: string;
  /** Σ(delta + frozen_delta)；无 mint/burn 时必须为 0 */
  net_sum: string;
  net_issuance: string;
  has_mint_or_burn: boolean;
}

export const assertBalanced = (entries: ReadonlyArray<{ delta: Amount; frozenDelta?: Amount; kind: LedgerKind }>): BalanceAssertion => {
  let d = 0n;
  let f = 0n;
  let issuance = 0n;
  let hasMintBurn = false;
  for (const e of entries) {
    const delta = toAmount(e.delta, 'delta');
    d += delta;
    f += toAmount(e.frozenDelta ?? 0n, 'frozenDelta');
    if (e.kind === 'mint' || e.kind === 'burn') {
      hasMintBurn = true;
      issuance += delta;
    }
  }
  const net = d + f;
  if (!hasMintBurn && net !== 0n) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', {
      field: 'entries', reason: 'EVENT_NOT_BALANCED',
      delta_sum: d.toString(), frozen_delta_sum: f.toString(), net_sum: net.toString(),
    });
  }
  return {
    delta_sum: d.toString(),
    frozen_delta_sum: f.toString(),
    net_sum: net.toString(),
    net_issuance: issuance.toString(),
    has_mint_or_burn: hasMintBurn,
  };
};

// ============================================================================
// 幂等重放（R51 ③④ / R52）
// ============================================================================

const findByKey = async (key: string, tx?: TxClient): Promise<LedgerEntryRecord[]> => {
  const sql = `SELECT ${ENTRY_COLS} FROM ledger_entry
               WHERE idempotency_key = $1
                  OR left(idempotency_key, length($1) + 1) = $1 || '#'
               ORDER BY txid ASC`;
  const rows = tx ? await txQuery<RawRow>(tx, sql, [key]) : await readQuery<RawRow>(sql, [key]);
  return rows.map(mapEntry);
};

/** 同一事件的既有流水（键 + 派生键） */
export const findEntriesByIdempotencyKey = (key: string, tx?: TxClient): Promise<LedgerEntryRecord[]> =>
  findByKey(normalizeIdempotencyKey(key), tx);

const snapshotsOf = (entries: LedgerEntryRecord[]): AccountSnapshot[] => {
  const byAccount = new Map<string, AccountSnapshot>();
  for (const e of entries) {
    byAccount.set(`${e.uid}:${e.cid}`, { uid: e.uid, cid: e.cid, balance: e.balance_after, frozen: e.frozen_after });
  }
  return [...byAccount.values()];
};

const buildResult = (
  key: string,
  entries: LedgerEntryRecord[],
  replayed: boolean,
  extra: Record<string, string | null> = {},
): LedgerOpResult => ({
  ok: true,
  idempotent_replay: replayed,
  idempotency_key: key,
  txid: entries[0]?.txid ?? '',
  entries,
  accounts: snapshotsOf(entries),
  extra,
});

/** R52：同键同指纹 ⇒ 200 + idempotent_replay；同键不同指纹 ⇒ 409 LEDGER_IDEMPOTENCY_CONFLICT */
const replayResult = async (key: string, fingerprint: string | null): Promise<LedgerOpResult> => {
  const entries = await findByKey(key);
  if (!entries.length) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_CONFLICT', { idempotency_key: key, reason: 'REPLAY_WITHOUT_EXISTING_ENTRY' });
  }
  const stored = entries[0].request_fingerprint;
  if (fingerprint && stored && fingerprint !== stored) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_CONFLICT', {
      idempotency_key: key, expected: stored, actual: fingerprint,
    });
  }
  return buildResult(key, entries, true);
};

/** 五个动作的公共外壳：一个业务事件一个事务（R57），重放检测在事务外完成（R51） */
const withIdempotentEvent = async (
  rawKey: unknown,
  fingerprint: string | null,
  body: (tx: TxClient, key: string) => Promise<LedgerOpResult>,
): Promise<LedgerOpResult> => {
  const key = normalizeIdempotencyKey(rawKey);
  try {
    return await withTransaction((tx) => body(tx, key));
  } catch (e) {
    if (e instanceof IdempotencyReplayDetected) return replayResult(key, fingerprint);
    throw normalizeLedgerError(e);
  }
};

/** 按顺序写出一整组分录：第 1 条用调用方键，其余用派生键（见文件头「幂等键分工」） */
const postEvent = async (
  tx: TxClient,
  key: string,
  inputs: Array<Omit<PostEntryInput, 'idempotencyKey'>>,
): Promise<LedgerEntryRecord[]> => {
  assertBalanced(inputs);
  const out: LedgerEntryRecord[] = [];
  for (let i = 0; i < inputs.length; i += 1) {
    out.push(await postEntry(tx, { ...inputs[i], idempotencyKey: i === 0 ? key : deriveEventKey(key, i + 1) }));
  }
  return out;
};

// ============================================================================
// 高层动作 ①：mint 铸币（R23 授权 + R24 supply_cap + R28 状态矩阵）
// ============================================================================

export interface MintInput {
  /** 受铸主体（自建单位只能铸给 owner 自己；`$` 由平台指定受铸人） */
  uid: Amount;
  cid: Amount;
  /** 金额：最小单位整数，或按该币种 decimals 的用户输入字符串（"1.50"） */
  amount: Amount;
  idempotencyKey: string;
  /** R23：调用方是平台受信任路径（仅对 `owner_uid = 0` 的 `$` 有意义） */
  platform?: boolean;
  refType?: RefType | null;
  refId?: Amount | null;
  memo?: string;
  requestFingerprint?: string | null;
}

export const mint = async (input: MintInput): Promise<LedgerOpResult> =>
  withIdempotentEvent(input.idempotencyKey, input.requestFingerprint ?? null, async (tx, key) => {
    const cid = toCid(input.cid);
    const uid = toUid(input.uid);

    // R83：先锁 currency 行，再动 account（与 R79 全序一致）
    const cur = await lockCurrency(tx, cid);
    const n = parseUserAmount(input.amount, cur.decimals, 'amount', cur.cid);
    const ownerUid = BigInt(cur.owner_uid);

    // R28：mint 仅 draft / listed
    assertCurrencyOperable(cur, 'mint');

    // R23 授权：owner 自铸，或平台受信任路径铸 `$`
    if (ownerUid > 0n) {
      if (uid !== ownerUid) {
        throw new LedgerError('LEDGER_UNAUTHORIZED_MINT', {
          cid: cur.cid, owner_uid: cur.owner_uid, actor_uid: uid.toString(), platform: Boolean(input.platform),
        });
      }
    } else if (!input.platform) {
      throw new LedgerError('LEDGER_UNAUTHORIZED_MINT', {
        cid: cur.cid, owner_uid: cur.owner_uid, actor_uid: uid.toString(), platform: false,
      });
    }
    if (uid < 0n) throw new LedgerError('LEDGER_RESERVED_UID', { field: 'uid', uid: uid.toString(), reason: 'MINT_TO_POOL' });

    // R24 供给上限（`$` 的 supply_cap = NULL ⇒ 无限）
    const supply = BigInt(cur.total_supply);
    const cap = cur.supply_cap === null ? null : BigInt(cur.supply_cap);
    if (cap !== null && supply + n > cap) {
      throw new LedgerError('LEDGER_SUPPLY_CAP_EXCEEDED', {
        cid: cur.cid, symbol: cur.symbol, total_supply: supply.toString(), supply_cap: cap.toString(), requested: n.toString(),
      });
    }

    const entries = await postEvent(tx, key, [{
      uid: uid.toString(), cid: cid.toString(), delta: n, frozenDelta: 0n, kind: 'mint',
      refType: input.refType ?? null, refId: input.refId ?? null, memo: input.memo ?? '',
      requestFingerprint: input.requestFingerprint ?? null,
    }]);

    // 双写 currency.total_supply（R9：必须与分录同事务）
    const updated = await txQuery<RawRow>(
      tx, 'UPDATE currency SET total_supply = total_supply + $2, time_updated = now() WHERE cid = $1 RETURNING total_supply',
      [cid.toString(), n.toString()],
    );

    return buildResult(key, entries, false, {
      supply_before: supply.toString(),
      supply_after: rawStr(updated[0]?.total_supply),
      supply_cap: cap === null ? null : cap.toString(),
    });
  });

// ============================================================================
// 高层动作 ②：transfer 可用余额转账（R32 只从 balance 扣；R100 平台账户不可为对手方）
// ============================================================================

export interface TransferInput {
  fromUid: Amount;
  toUid: Amount;
  cid: Amount;
  amount: Amount;
  idempotencyKey: string;
  refType?: RefType | null;
  refId?: Amount | null;
  memo?: string;
  requestFingerprint?: string | null;
}

export const transfer = async (input: TransferInput): Promise<LedgerOpResult> =>
  withIdempotentEvent(input.idempotencyKey, input.requestFingerprint ?? null, async (tx, key) => {
    const cid = toCid(input.cid);
    const fromUid = assertUserUid(input.fromUid, 'fromUid'); // R100：用户请求不得命中平台账户
    const toUid = assertUserUid(input.toUid, 'toUid');
    if (fromUid === toUid) throw new LedgerError('LEDGER_SELF_TRANSFER', { uid: fromUid.toString(), cid: cid.toString() });

    const cur = await getCurrency(cid, tx);
    if (!cur) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: cid.toString() });
    assertCurrencyOperable(cur, 'transfer'); // R28：transfer 四态全可
    const n = parseUserAmount(input.amount, cur.decimals, 'amount', cur.cid);

    // R79：跨账户搬运先按 uid 升序把两把行锁都拿到，再写分录
    await lockAccounts(tx, [{ uid: fromUid, cid }, { uid: toUid, cid }]);

    const entries = await postEvent(tx, key, [
      {
        uid: fromUid.toString(), cid: cid.toString(), delta: -n, frozenDelta: 0n, kind: 'transfer',
        refType: input.refType ?? null, refId: input.refId ?? null, memo: input.memo ?? '',
        requestFingerprint: input.requestFingerprint ?? null,
      },
      {
        uid: toUid.toString(), cid: cid.toString(), delta: n, frozenDelta: 0n, kind: 'transfer',
        refType: input.refType ?? null, refId: input.refId ?? null, memo: input.memo ?? '',
      },
    ]);

    return buildResult(key, entries, false, { amount: n.toString(), symbol: cur.symbol });
  });

// ============================================================================
// 高层动作 ③：freeze 可用 → 冻结（hold，同账户 2 条分录）
// ============================================================================

export interface FreezeInput {
  uid: Amount;
  cid: Amount;
  amount: Amount;
  idempotencyKey: string;
  /** R37：hold 只能由业务事件触发 ⇒ 必须给出业务单（挂单 / 招工 / 保证金） */
  refType?: RefType | null;
  refId?: Amount | null;
  memo?: string;
  requestFingerprint?: string | null;
  /** R36：业务表证明的在冻额上界（提供了就校验：本次冻结不得超它） */
  businessFrozenCap?: Amount | null;
}

export const freeze = async (input: FreezeInput): Promise<LedgerOpResult> =>
  withIdempotentEvent(input.idempotencyKey, input.requestFingerprint ?? null, async (tx, key) => {
    const cid = toCid(input.cid);
    const uid = assertUserUid(input.uid); // R37/R101：平台账户不接受 hold

    // R37：不存在「用户手动冻结自己余额」⇒ 没有业务单就不给冻
    if (!input.refType || input.refId === undefined || input.refId === null) {
      throw new LedgerError('LEDGER_HOLD_NOT_ALLOWED', { uid: uid.toString(), cid: cid.toString(), reason: 'BUSINESS_REF_REQUIRED' });
    }

    const cur = await getCurrency(cid, tx);
    if (!cur) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: cid.toString() });
    assertCurrencyOperable(cur, 'hold');
    const n = parseUserAmount(input.amount, cur.decimals, 'amount', cur.cid);

    if (input.businessFrozenCap !== undefined && input.businessFrozenCap !== null) {
      const cap = toAmount(input.businessFrozenCap, 'businessFrozenCap');
      if (n > cap) {
        throw new LedgerError('LEDGER_INSUFFICIENT_FROZEN', {
          uid: uid.toString(), cid: cid.toString(), required: n.toString(), available: cap.toString(),
          reason: 'business_frozen_cap',
        });
      }
    }

    await lockAccount(tx, uid, cid);
    const entries = await postEvent(tx, key, [
      {
        uid: uid.toString(), cid: cid.toString(), delta: -n, frozenDelta: 0n, kind: 'hold',
        refType: input.refType, refId: input.refId, memo: input.memo ?? '',
        requestFingerprint: input.requestFingerprint ?? null,
      },
      {
        uid: uid.toString(), cid: cid.toString(), delta: 0n, frozenDelta: n, kind: 'hold',
        refType: input.refType, refId: input.refId, memo: input.memo ?? '',
      },
    ]);

    return buildResult(key, entries, false, { amount: n.toString(), symbol: cur.symbol });
  });

// ============================================================================
// 高层动作 ④：unfreeze 冻结 → 可用（hold_release，同账户 2 条分录）
// ============================================================================

export interface UnfreezeInput extends Omit<FreezeInput, 'businessFrozenCap'> {
  /** R36：解冻额上界（业务表证明对应冻结仍存在）；提供了就校验 */
  businessFrozenCap?: Amount | null;
}

export const unfreeze = async (input: UnfreezeInput): Promise<LedgerOpResult> =>
  withIdempotentEvent(input.idempotencyKey, input.requestFingerprint ?? null, async (tx, key) => {
    const cid = toCid(input.cid);
    const uid = assertUserUid(input.uid);

    if (!input.refType || input.refId === undefined || input.refId === null) {
      throw new LedgerError('LEDGER_HOLD_NOT_ALLOWED', { uid: uid.toString(), cid: cid.toString(), reason: 'BUSINESS_REF_REQUIRED' });
    }

    const cur = await getCurrency(cid, tx);
    if (!cur) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: cid.toString() });
    // §7.2 #14：下架必须能撤销挂单并解冻 ⇒ hold_release 四态全可（见 CURRENCY_OP_MATRIX 注释）
    assertCurrencyOperable(cur, 'hold_release');
    const n = parseUserAmount(input.amount, cur.decimals, 'amount', cur.cid);

    if (input.businessFrozenCap !== undefined && input.businessFrozenCap !== null) {
      const cap = toAmount(input.businessFrozenCap, 'businessFrozenCap');
      if (n > cap) {
        throw new LedgerError('LEDGER_INSUFFICIENT_FROZEN', {
          uid: uid.toString(), cid: cid.toString(), required: n.toString(), available: cap.toString(),
          reason: 'business_frozen_cap',
        });
      }
    }

    await lockAccount(tx, uid, cid);
    const entries = await postEvent(tx, key, [
      {
        uid: uid.toString(), cid: cid.toString(), delta: 0n, frozenDelta: -n, kind: 'hold_release',
        refType: input.refType, refId: input.refId, memo: input.memo ?? '',
        requestFingerprint: input.requestFingerprint ?? null,
      },
      {
        uid: uid.toString(), cid: cid.toString(), delta: n, frozenDelta: 0n, kind: 'hold_release',
        refType: input.refType, refId: input.refId, memo: input.memo ?? '',
      },
    ]);

    return buildResult(key, entries, false, { amount: n.toString(), symbol: cur.symbol });
  });

// ============================================================================
// 高层动作 ⑤：settleFrozen 冻结资金直接支付给对方（R15 双字段的存在理由 / R33 白名单）
// ============================================================================

export interface SettleFrozenInput {
  /** 付款方（冻结资金持有者，恒为真实用户） */
  fromUid: Amount;
  /** 受款方；罚没类 kind 只能付给平台罚没账户 −3 */
  toUid: Amount;
  cid: Amount;
  amount: Amount;
  /** R33 出账白名单：job_payout / purchase / trade / hold_forfeit〔P1c：移除已删的 `listing_deposit_forfeit`〕 */
  kind: LedgerKind;
  /** 受款方分录的 kind；缺省按 SETTLE_PAYEE_KIND 映射（purchase ⇒ sale） */
  payeeKind?: LedgerKind;
  refType?: RefType | null;
  refId?: Amount | null;
  memo?: string;
  idempotencyKey: string;
  requestFingerprint?: string | null;
  /** R36：业务表证明的在冻额上界 */
  businessFrozenCap?: Amount | null;
}

export const settleFrozen = async (input: SettleFrozenInput): Promise<LedgerOpResult> =>
  withIdempotentEvent(input.idempotencyKey, input.requestFingerprint ?? null, async (tx, key) => {
    const cid = toCid(input.cid);
    const fromUid = assertUserUid(input.fromUid, 'fromUid');
    const kind = assertLedgerKind(input.kind);
    if (!FROZEN_SETTLE_KINDS.includes(kind)) {
      throw new LedgerError('LEDGER_UNKNOWN_KIND', { kind, reason: 'NOT_IN_FROZEN_SETTLE_WHITELIST' });
    }
    const isForfeit = kind === 'hold_forfeit';
    const toUid = isForfeit
      ? PLATFORM_UID.FORFEIT
      : assertUserUid(input.toUid, 'toUid');
    if (isForfeit && input.toUid !== undefined && input.toUid !== null && BigInt(toAmount(input.toUid, 'toUid')) !== PLATFORM_UID.FORFEIT) {
      throw new LedgerError('LEDGER_RESERVED_UID', {
        field: 'toUid', uid: String(input.toUid), reason: 'FORFEIT_MUST_GO_TO_-3',
      });
    }
    if (fromUid === toUid) throw new LedgerError('LEDGER_SELF_TRANSFER', { uid: fromUid.toString(), cid: cid.toString() });

    const cur = await getCurrency(cid, tx);
    if (!cur) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: cid.toString() });
    assertCurrencyOperable(cur, 'settle');
    const n = parseUserAmount(input.amount, cur.decimals, 'amount', cur.cid);

    if (input.businessFrozenCap !== undefined && input.businessFrozenCap !== null) {
      const cap = toAmount(input.businessFrozenCap, 'businessFrozenCap');
      if (n > cap) {
        throw new LedgerError('LEDGER_INSUFFICIENT_FROZEN', {
          uid: fromUid.toString(), cid: cid.toString(), required: n.toString(), available: cap.toString(),
          reason: 'business_frozen_cap',
        });
      }
    }

    // R79：跨账户搬运按 uid 升序加锁（−3 < 真实 uid，天然满足「数值升序」）
    await lockAccounts(tx, [{ uid: fromUid, cid }, { uid: toUid, cid }]);

    const payeeKind = isForfeit ? kind : (input.payeeKind ?? SETTLE_PAYEE_KIND[kind] ?? kind);
    const entries = await postEvent(tx, key, [
      {
        // 减方：可用不动，只冻减（这正是 R15 双字段要解决的记账形态）
        uid: fromUid.toString(), cid: cid.toString(), delta: 0n, frozenDelta: -n, kind,
        refType: input.refType ?? null, refId: input.refId ?? null, memo: input.memo ?? '',
        requestFingerprint: input.requestFingerprint ?? null,
      },
      {
        // 增方：受款方可用余额增加
        uid: toUid.toString(), cid: cid.toString(), delta: n, frozenDelta: 0n, kind: payeeKind,
        refType: input.refType ?? null, refId: input.refId ?? null, memo: input.memo ?? '',
      },
    ]);

    return buildResult(key, entries, false, { amount: n.toString(), symbol: cur.symbol, kind, payee_kind: payeeKind });
  });

// ============================================================================
// 只读辅助（供上层 / 脚本使用；不参与写路径）
// ============================================================================

/** 某账户的流水分页（R95：keyset 分页，禁止 OFFSET） */
export const listEntriesByAccount = async (
  uid: Amount,
  cid: Amount,
  beforeTxid: Amount | null = null,
  limit = 50,
  tx?: TxClient,
): Promise<LedgerEntryRecord[]> => {
  const u = toUid(uid).toString();
  const c = toCid(cid).toString();
  const n = Math.max(1, Math.min(200, Math.trunc(limit)));
  const sql = beforeTxid === null
    ? `SELECT ${ENTRY_COLS} FROM ledger_entry WHERE uid = $1 AND cid = $2 ORDER BY txid DESC LIMIT $3`
    : `SELECT ${ENTRY_COLS} FROM ledger_entry WHERE uid = $1 AND cid = $2 AND txid < $3 ORDER BY txid DESC LIMIT $4`;
  const params = beforeTxid === null ? [u, c, n] : [u, c, toAmount(beforeTxid, 'before_txid').toString(), n];
  const rows = tx ? await txQuery<RawRow>(tx, sql, params) : await readQuery<RawRow>(sql, params);
  return rows.map(mapEntry);
};

/** §11 判据 1：账户级守恒（balance == Σdelta 且 frozen == Σfrozen_delta）的差异清单 */
export const findAccountDrift = async (): Promise<Array<Record<string, string>>> => {
  const rows = await readQuery<RawRow>(
    `SELECT a.uid, a.cid, a.balance, a.frozen, COALESCE(s.d, 0) AS sum_delta, COALESCE(s.f, 0) AS sum_frozen
       FROM account a
       LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f FROM ledger_entry GROUP BY uid, cid) s
              ON s.uid = a.uid AND s.cid = a.cid
      WHERE a.balance <> COALESCE(s.d, 0) OR a.frozen <> COALESCE(s.f, 0)`,
  );
  return rows.map((r) => ({
    uid: rawStr(r.uid), cid: rawStr(r.cid),
    balance: rawStr(r.balance), sum_delta: rawStr(r.sum_delta),
    frozen: rawStr(r.frozen), sum_frozen: rawStr(r.sum_frozen),
  }));
};

/** 所有账户的 balance + frozen 总和（按 cid 分组）；用于守恒读数 */
export const sumAccountTotals = async (): Promise<Array<Record<string, string>>> => {
  const rows = await readQuery<RawRow>(
    'SELECT cid, SUM(balance) AS total_balance, SUM(frozen) AS total_frozen, SUM(balance + frozen) AS total_net '
    + 'FROM account GROUP BY cid ORDER BY cid',
  );
  return rows.map((r) => ({
    cid: rawStr(r.cid), total_balance: rawStr(r.total_balance),
    total_frozen: rawStr(r.total_frozen), total_net: rawStr(r.total_net),
  }));
};

export { toErrorResponse, isLedgerError, normalizeLedgerError };
export type { LedgerErrorCode, LedgerErrorDetails };
