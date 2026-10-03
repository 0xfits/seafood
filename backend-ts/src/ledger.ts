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
 *   §7   事务边界（R55 写路径必须在事务内 + R57 一事件一事务）
 *        〔P1e/D10 变更：写路径的单条 `SELECT ledger_post_event(...)` 自带隐式事务即满足 R55/R57，
 *          不再需要应用层 BEGIN…COMMIT；需 spec 同步，见交付报告「需 spec 同步的行清单」〕
 *   §8   金额表示（R66 bigint 最小单位 + R70 出入参十进制字符串 + R71 上限 + R72 入参校验）
 *   §9   append-only + account 守卫（R74 先插分录后更账户 + R75 开户必须 0/0）
 *   §10  加锁全序（R79 currency(cid 升序) → account(uid 升序) → 业务行）+ 负余额禁令（R80）
 *   §13  平台保留 uid（R98 / R100 / R101 / R103：只进不出）
 *   §14  统一错误码（R104 唯一来源 = ./ledger-errors.ts）
 *
 * 基础设施：读路径已重写为 `src/db.ts` 的 readQuery / healthCheck；
 *   写路径（P1e / D10 变体 B）**不再走 withTransaction**，改由单条 `SELECT ledger_post_event($1::jsonb)`
 *   承载（见 `migrations/0004_ledger_post_event.sql` 与本文件 §5b）。
 *
 * ---------------------------------------------------------------- 幂等键分工（R51 落地口径）
 * 〔P1e：以下协议**已整体下沉**到 DB 函数 `ledger_post_event`（0004），此处保留为口径说明〕
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
 *                                  | 'unclassified_pg_error' | 'protocol_violation', error_name, error_code|pg_code }
 *
 * 〔P1i 收口（Kong，2026-09）—— 本文件在 F1/F2/F3 修复轮的对外契约变化，逐条登记〕
 *   ① `normalizeIdempotencyKey` **字符集收紧**：调用方键禁 `#`（内部派生键分隔符）与控制字符
 *      ⇒ 违规 400 `LEDGER_IDEMPOTENCY_KEY_INVALID`（`reason=RESERVED_SEPARATOR` / `CONTROL_CHARACTER`）；
 *      校验顺序固定 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`，
 *      与 DB 侧 C0（`migrations/0005…`）**同序同码**。R60 的键空间互斥由 MK 单射性保证。
 *   ② `RETRYABLE_SQLSTATES` 增 `'LD027'`：DB 层自 0005 起把 `40P01`/`40001` 归一为 LD027
 *      （`retries_performed=0` / `retry_owner=caller`）⇒ 不在 TS 侧补上就等于**死锁不再重试**。
 *   ③ `findByKey` 改按 `event_root_key` **精确归属**（删除字符串前缀「键族」匹配）。
 *   ④ `ledger-errors.ts` 基础设施类（`53*`/`58*`/`XX*`、`57*` 除 `57014`、`08*` 除 `08P01`）
 *      → `LEDGER_TX_TIMEOUT`（503 可重试），**不再落 500**（R108 的「500 = 代码缺陷」语义不被污染）。
 *   ⑤ 〔P1n 收口 · **回退轮**（Kong，2026-09）〕`toCid` 对 `cid <= 0` **回到** 404
 *      `LEDGER_CURRENCY_NOT_FOUND` + `{ cid }`（与 DB 侧 `ledger_cid_arg` 逐字一致）。
 *      上一轮曾依「`cid<=0` 属形状非法」的**错误前提**把它改成 400 `LEDGER_AMOUNT_NOT_POSITIVE`；
 *      该前提已被实测证伪：DB 侧 `ledger_cid_arg('0')`/`('-5')` 一直是 `LD007`/404，即**改前两侧本就一致**
 *      ⇒ 上一轮的改动是引入了原本不存在的不一致，本轮逐字回退（详情见交付报告 P1n 与
 *      `src/ledger.ts` 中 `toCid` 的注释块）。**重新裁定的口径**：`cid`/`uid` 等**标识符**参数 ——
 *      形状非法（非十进制整数 / 空 / 超 bigint / 缺失）⇒ 400 `LEDGER_AMOUNT_INVALID` + `details.reason`；
 *      形状合法但该行不存在 ⇒ 404（`cid <= 0` 属**不存在**这一类）。⇒ 需 spec 同步：§14.3 附补一行。
 *   ⇒ 需 spec 同步：R48/R49/R50/R51/R52、§11、§14.1/§14.3/§14.4、§19.5（详见交付报告）。
 *
 * 〔P1o 收口（Kong，2026-09）—— 读路径「超 `bigint`」逃逸回归的**按类修**，对外契约变化逐条登记〕
 *   ① **`toAmount` 增「真 `bigint` 范围闸」**（`bigint` 分支 + 十进制字符串分支都查）：
 *      超界 ⇒ `400 LEDGER_AMOUNT_INVALID` + `details.reason = 'OUT_OF_BIGINT_RANGE'`
 *      （`details.field` 标字段、`details.value` 截 40 字符，与 DB 侧 `ledger_int_amount` 同形）。
 *      修前 TS `BigInt(s)` 无界 ⇒ `getCurrency('99999999999999999999999')` 把该串直交 PG ⇒
 *      PG 抛 `22003`（`status = undefined` / `mapped = false`）逃到调用方。**唯一共用形状闸**，
 *      读路径 + 写路径全部入口点一次收敛（不再按点补）。
 *   ② **`reason` 名对齐**（§14.3 v0.6 增补块 (B) / §19.10.D）：**缺失**（`undefined` / `null`）
 *      ⇒ `'MISSING'`（原 `'BAD_TYPE'`，与 DB 侧 `ledger_int_amount(p_raw IS NULL)` 逐字一致）；
 *      **其余非字符串类型**（对象 / 数组 / 布尔）⇒ `'NOT_STRING'`（`ledger_parse_user_amount` 同改）。
 *      三种失败仍是 `400 LEDGER_AMOUNT_INVALID` ⇒ **状态类不变**。
 *   ③ **账户自建路径的错误收敛**（`lockAccounts` / `getOrCreateAccount` / `ensurePlatformAccounts`）：
 *      `cid` 形状合法但不存在时，`account.cid → currency(cid)` 外键炸出的裸 `23503` 原先直接逃到
 *      调用方 ⇒ 现交 `normalizeLedgerError` 归 `LEDGER_CURRENCY_NOT_FOUND` / `404`（§14.3 枚举块 ②）。
 *   ④ **`listEntriesByAccount` 的 `limit` 闸**（附带发现）：`NaN` / 非数值原先被发成 `LIMIT "NaN"`
 *      ⇒ 裸 `22P02` 逃逸；现非有限值取默认 50，仍钳 `[1,200]`。
 *   ⑤ 取证脚本：`scripts/p1o-00-escape-sweep.ts`（入口点 × 输入形状矩阵，605+ 格，三条硬判据
 *      `raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0`，run-tagged 落盘）。
 *   ⇒ 需 spec 同步：§14.3 v0.6 增补块 (A) ④ d 的「修后读数回填」（§16 #12，由 Jing 执行）。
 *
 * ---------------------------------------------------------------- 本阶段**未**实现（明确留白，勿误判为遗漏）
 *   - 招工 / 商品 / 交易所 / 返佣 / 上市费 / 保证金冻结 等业务动作（P3/P4/P5）
 *   - `burn`（P1a 未在交付清单内；kind 白名单与 §5 已就绪，实现时走 DB 函数的 op='entries'）
 *   - `reversal` 冲正动作（表结构与 R20/R46 约束已就绪，未写服务函数）
 *   - R81 乐观锁分支：本阶段**全部**走 `SELECT ... FOR UPDATE`（spec §15 #17 明示「可改」）
 *   - R108 告警通道：仅提供 `isDefectError()` 判定，未接日志/指标
 *   - R92/R87 对账脚本与判负演练：属下一阶段交付物
 *   - `platform_withdraw`：未实现，平台账户**只进不出**（D7 更正版 + R103，未获批准前禁止）
 */
import { Pool, neon } from '@neondatabase/serverless';
import {
  TxClient,
  withTransaction,
  txQuery,
  readQuery,
  resolveReadUrl,
  resolveTransactionUrl,
} from './db';
import {
  LedgerError,
  LedgerErrorCode,
  LedgerErrorDetails,
  isLedgerError,
  isLedgerErrorCode,
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
 * ★ P9②（`data-layer.spec` v0.21 §31.1 Zang 裁定 **R-9-14**，2026-10-03）：**C-3 = 方案 ② 扩容 +1**
 *   ⇒ **20 → 21**，新增第 21 值 **`checkin_makeup_fee`**（补签 100 `$` 腿，**只追加于末位**、
 *   **不改既有 20 值次序**）。DB 侧同款扩容见 `migrations/0028_kind_close_set_21.sql`（CHECK 重建、非 enum）；
 *   `−1` 归属白名单同步见 `PLATFORM_KIND_WHITELIST['-1'].credit`。**不真 burn**（`R-9-3`）。
 * ★ P9④（`data-layer.spec` v0.25 §33.10 `R-9-36` / `R-9-42`，2026-10-03）：**21 → 23**，
 *   新增第 22/23 值 **`bttc_mint_fee`** + **`bttc_burn_fee`**（BTTC 铸造 / 分解的 `$` 费腿，
 *   **只追加于末位**、**不改既有 21 值次序**；`$` 费腿 → `uid = −1` **不真 burn** · `R-9-3`）。
 *   DB 侧同款扩容见 `migrations/0032_kind_close_set_23.sql`（CHECK 重建 · `ledger_kind_ok` 同步）；
 *   `−1` 归属白名单同步见 `PLATFORM_KIND_WHITELIST['-1'].credit`（追加两值）。
 */
export const LEDGER_KINDS = [
  'mint', 'burn', 'transfer', 'hold', 'hold_release', 'hold_forfeit',
  'job_escrow', 'job_escrow_refund', 'job_payout', 'job_fee', 'commission',
  'purchase', 'sale', 'purchase_refund',
  'trade', 'trade_fee',
  'listing_fee', 'listing_deposit',
  'currency_create_fee', 'reversal',
  'checkin_makeup_fee',
  'bttc_mint_fee', 'bttc_burn_fee',
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

/** §4.2 三态记账：hold 家族（同账户搬运，必须是 2 条分录）〔P1c：移除已删的 `listing_deposit_refund`〕
 *  〔P4-B3a-FIX-A：**移除 `listing_deposit`** —— 依据 `ledger.spec` R31（v0.2）/ DL67 / DL88（均【已冻结】）：
 *    保证金**上市即消耗**（余额 → `uid = -1`）、**不可退、无罚没** ⇒ **不是**冻结可退的 hold 家族成员。
 *    P1c 删 `listing_deposit_forfeit` 时漏删本项；本次补齐（只删这一项）。
 *    DB 侧同类落点：本 kind 的入账由 `-1` credit 白名单放行，见 `migrations/0019_*.sql`。〕 */
export const HOLD_KINDS: LedgerKind[] = ['hold', 'hold_release', 'job_escrow', 'job_escrow_refund'];

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
  /** P1e 新增（可选，加字段不影响既有调用方）：DB 函数回传的取证信息 —— op + 真实加锁顺序（R79） */
  meta?: LedgerEventMeta;
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

/**
 * `bigint` 的**真**边界（与 PG `bigint` 上下界同值；`§8.3 R66`）。
 * P1o（Kong，2026-09）：TS 侧 `BigInt` **无界** ⇒ 23 位十进制串能穿过形状闸、被直交 PG，
 * 由 PG 抛 `22003`（**未映射的原始 SQLSTATE 逃到调用方**，见 `docs/ledger.spec.md`
 * §14.3 v0.6 增补块 (A)）。本闸把它收在**唯一共用形状闸**内 ⇒ 一次修掉全部经 `toAmount`
 * 的入口点（读 + 写），不再按点补。
 */
const BIGINT_MAX = 9223372036854775807n;
const BIGINT_MIN = -9223372036854775808n;

/** 超 `bigint` 的统一抛法：`400 LEDGER_AMOUNT_INVALID` + `reason = OUT_OF_BIGINT_RANGE`（**不新增码**） */
const throwOutOfBigintRange = (field: string, raw: string): never => {
  throw new LedgerError('LEDGER_AMOUNT_INVALID', {
    field, value: raw.slice(0, 40), reason: 'OUT_OF_BIGINT_RANGE',
  });
};

/**
 * 严格整数金额（允许负数，供 delta 使用）。浮点 JSON number 一律拒绝（R72①）。
 *
 * P1o 收口（Zang 裁定 / §14.3 v0.6 增补块 (A)③ · 增补块 (B)）：
 *   ① **真 `bigint` 范围闸（`bigint` 分支与十进制字符串分支都要查）**：
 *      `> 9223372036854775807` 或 `< -9223372036854775808` ⇒ `400 LEDGER_AMOUNT_INVALID` +
 *      `reason = 'OUT_OF_BIGINT_RANGE'` —— 与 DB 侧 `ledger_int_amount`（0005：`numeric` 查界后
 *      再转型）**同族同码**（**不新增错误码**，33 码关闭集不动）。
 *      修前实测：`getCurrency('99999999999999999999999')` 把该串直交 PG ⇒ PG 抛 `22003`
 *      （`status = undefined` / `mapped = false`）⇒ 违反「33 码关闭集 + `bucket↔状态类` 映射、
 *      不得吐未映射原始 SQLSTATE」的硬口径（`.p1f-artifacts/p1o-00-escape-sweep-before-*.json`）。
 *   ② **`reason` 名对齐**（§19.10.D）：**缺失**（`undefined` / `null`）⇒ `'MISSING'`（原 `'BAD_TYPE'`，
 *      与 DB 侧 `ledger_int_amount(p_raw IS NULL)` 逐字一致）；**其余非字符串类型**
 *      （对象 / 数组 / 布尔等）⇒ `'NOT_STRING'`（DB 侧身份字段只收 JSON 字符串，同 reason）。
 *   ③ `number` 分支**保留**：`Amount = bigint | number | string` 是本模块既有契约，且实测
 *      `getCurrency(0)`（JSON number）走到的是**存在性判定**（`404`，见 `p1n-tocid-shape-*`）⇒
 *      整数 number **不**归 `NOT_STRING`（登记项：`docs/ledger.spec.md` §19.9.F 对拍表把
 *      `cid = 0`（JSON number）标为与 DB 一致的 `404`）。
 *   ④ 三种失败一律仍是 **`400 LEDGER_AMOUNT_INVALID`** ⇒ **状态类不变**，只改 `reason` 名。
 */
export const toAmount = (v: Amount, field: string): bigint => {
  if (typeof v === 'bigint') {
    // TS `bigint` 无界 ⇒ 必须查界（`BigInt('9'.repeat(25))` 是合法 bigint，但超 PG bigint）
    if (v > BIGINT_MAX || v < BIGINT_MIN) throwOutOfBigintRange(field, v.toString());
    return v;
  }
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || !Number.isSafeInteger(v)) {
      throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_INTEGER_OR_UNSAFE' });
    }
    return BigInt(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^-?\d+$/.test(s)) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_DECIMAL_INTEGER' });
    const n = BigInt(s); // 无界：下面显式查界（修前缺这一步 ⇒ 22003 逃逸）
    if (n > BIGINT_MAX || n < BIGINT_MIN) throwOutOfBigintRange(field, s);
    return n;
  }
  if (v === null || v === undefined) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'MISSING' });
  }
  throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_STRING', provided_type: typeof v });
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
  } else if (v === null || v === undefined) {
    // P1o · reason 名对齐（§14.3 v0.6 增补块 (B) / §19.10.D）：缺失 ⇒ MISSING
    // （DB 侧 ledger_parse_user_amount 的 `p_raw IS NULL` 分支即 MISSING）
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'MISSING' });
  } else {
    // 其余非字符串类型（对象 / 数组 / 布尔等）⇒ NOT_STRING（修前为 BAD_TYPE；状态类不变，仍 400）
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'NOT_STRING', provided_type: typeof v });
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

/**
 * 内部派生键分隔符（`deriveEventKey` 用 `#`）。**调用方键禁止出现**：
 * 「调用方键集合 K」与「内部派生键集合 D = { k || '#' || i | k ∈ K, i ≥ 2 }」由此**按构造互斥**，
 * 且派生函数在合法键域上单射 ⇒ F1 的「键族碰撞」两个方向都无法再构造。
 */
export const DERIVED_KEY_SEPARATOR = '#';

/**
 * 控制字符（C0 `\u0000`–`\u001F` + DEL `\u007F`）。
 * 与 DB 侧 `v_key ~ '[[:cntrl:]]'`（0005 C0）**同集**；两侧必须同时改，否则读数会分叉。
 */
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;

/**
 * R49：键前缀强制；R52③：写路径必须带键 ⇒ 缺失抛 LEDGER_IDEMPOTENCY_KEY_REQUIRED。
 * P1f（F1①）/ P1i：字符集收紧 —— 校验**顺序固定**为
 *   `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`，
 * 与 DB 侧 `ledger_post_event` C0（0005）**同序同码**（同一条规则的两处投影，
 * 同一非法键在 TS 与 DB 必须得到逐字相同的 code/reason）。
 */
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
  // ③ `#` = 内部派生键分隔符 ⇒ 调用方一律不许用（否则可构造出等于他人派生键的键）
  if (key.includes(DERIVED_KEY_SEPARATOR)) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', {
      reason: 'RESERVED_SEPARATOR',
      value: key.slice(0, 40),
      note: 'char # is reserved for internal derived entry keys (<key>#<i>)',
    });
  }
  // ④ 控制字符（C0/DEL）不得出现在键里
  if (CONTROL_CHAR_RE.test(key)) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', { reason: 'CONTROL_CHARACTER' });
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

/**
 * `cid` 形状闸（Zang **重新裁定**（P1n 回退轮）/ spec §14.3）：
 *   「**形状**」与「目标**是否存在**」是两件事：
 *     ① 形状非法（非十进制整数 / 空 / 超 bigint / 缺失）⇒ **400** `LEDGER_AMOUNT_INVALID`
 *        + `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}`
 *        + `details.field` —— 码名 `LEDGER_AMOUNT_INVALID` 是历史名，被兼用作「参数形状非法」码，
 *        靠 `details.field` 区分字段（**不新增错误码**）。
 *     ② 形状合法但该行不存在 ⇒ **404**（`LEDGER_CURRENCY_NOT_FOUND` / `LEDGER_ACCOUNT_NOT_FOUND`）。
 *   `cid <= 0`（含负数）属**第 ②类**：`currency.cid` 是正整数序列，构造上不存在
 *   ⇒ **404，不是 400**。
 *
 * P1n 回退说明（Kong，2026-09 —— 修订上一轮的错改）：
 *   上一轮派单把 `cid <= 0` 误归为「形状非法」，据此把本闸改成 400 `LEDGER_AMOUNT_NOT_POSITIVE`
 *   —— 该前提**已被实测证伪**：DB 侧 `ledger_cid_arg('0')` / `ledger_cid_arg('-5')` 自 0004 起
 *   一直是 `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / 404 / DETAIL `{"cid":"0"}`（见
 *   `migrations/0004_ledger_post_event.sql` 的 `ledger_cid_arg`，实测读数落盘于
 *   `.p1f-artifacts/p1n-tocid-shape-*.json`）。⇒ **改之前 TS 与 DB 两侧本来就一致（都是 404）**，
 *   上一轮的改动反而引入了原本不存在的不一致；本轮逐字回退为 DB 侧口径：
 *     - **404** `LEDGER_CURRENCY_NOT_FOUND` + `details = { cid }`（`cid` 为十进制字符串）；
 *     - 与 `ledger_cid_arg(p_raw)` 的 `ledger_raise('LEDGER_CURRENCY_NOT_FOUND', {"cid": v_c::text})`
 *       **同码 / 同 status / 同 details 形状**。
 *   形状分支（非十进制整数串）仍走 `toAmount`，其 `reason = NOT_DECIMAL_INTEGER` 与 DB 侧
 *   `ledger_int_amount` 同码同 reason（DB 侧另附 `value` 字段，为 0004/0005 既有形态，非本轮引入）。
 *   DB 侧（`migrations/**`）**未改动**且无需改动 —— 它本来就是对的。
 */
const toCid = (cid: Amount): bigint => {
  const c = toAmount(cid, 'cid');
  // cid <= 0 ⇒ 该币种不存在（currency.cid 为正整数序列）⇒ 404，与 DB 侧 ledger_cid_arg 逐字一致
  if (c <= 0n) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: c.toString() });
  return c;
};

/**
 * R101 平台账户 kind 白名单（只针对 −1 / −2 / −3 / 0）。
 * 违反 ⇒ LEDGER_RESERVED_UID（§14 无「平台账户写操作非法」专用码，见交付报告「歧义点」）。
 */
const PLATFORM_KIND_WHITELIST: Record<string, { credit: LedgerKind[]; debit: LedgerKind[] }> = {
  '0': { credit: ['mint', 'transfer', 'reversal'], debit: ['transfer', 'burn', 'reversal'] },
  // R103：只进不出。
  // 🆕 P2（commission.spec v0.2 裁定 #11 / CR84 / CR85 ④）：`-1` 的 credit 增加 `job_fee` ——
  //    「无邀请人 ⇒ 手续费仍收、但入 `-1`（平台收入）】，不入 `-2`（`-2` 只作佣金中转、同事件净额 0）」。
  //    **必须与 DB 侧同改**：`migrations/0008_platform_revenue_job_fee.sql` 的
  //    `ledger_assert_platform_mutation` 已把 `job_fee` 加入 `-1` 的 `credit` 白名单（0008 已应用）。
  //    ⇒ 本行是那次迁移的 **TS 侧同步**（0008 文件头把这一项登记为「下一单的第一件事」）。
  //    `debit` 仍恒为空（不许被顺带松掉；0008 的自检负例②已取证）。
  // 🆕 P4-B3a-FIX-A（`ledger.spec` R31 v0.2 / `data-layer.spec` DL67 / DL88，均【已冻结】）：
  //    `-1` 的 credit 增加 `listing_deposit` ——「保证金**上市即消耗**、进平台收入 `-1`、**不可退、无罚没**」
  //    （`HOLD_KINDS` 侧同轮已把本 kind 移出，见 `HOLD_KINDS` 注释；两处必须同改，否则「消耗入 `-1`」不可实现）。
  //    **必须与 DB 侧同改**：`migrations/0019_listing_deposit_platform_credit.sql` 的
  //    `ledger_assert_platform_mutation` 已把 `listing_deposit` 加入 `-1` 的 `credit` 白名单。
  //    `debit` 仍恒为空（不许被顺带松掉；`0019` 自检负例②已取证）。
  // 🆕 P9②（`data-layer.spec` v0.21 §31.1 R-9-14「−1 归属白名单追加」+ §31.5 + `ledger.spec` R101）：
  //    `-1` 的 credit 再接纳 `checkin_makeup_fee`（补签 100 `$` 手续费入平台收入、**不真 burn** ·
  //    `R-9-3`）。**必须与 DB 侧同改**：`migrations/0028_kind_close_set_21.sql` 扩容 kind 关闭集；
  //    `ledger_assert_platform_mutation` 的 `-1` credit 白名单须同轮加入本 kind（沿 `0019` 对
  //    `listing_deposit` 的加法式扩展手法）。`debit` 仍恒为空。
  // 🆕 P9④（`data-layer.spec` v0.25 §33.10 `R-9-36`「−1 credit 白名单追加两值」+ `ledger.spec` R101）：
  //    `-1` 的 credit 再接纳 `bttc_mint_fee` + `bttc_burn_fee`（BTTC 铸造 / 分解的 `$` 费腿 → 平台收入、
  //    **不真 burn** · `R-9-3`）。**必须与 DB 侧同改**：`migrations/0032_kind_close_set_23.sql` 扩容 kind
  //    关闭集（21 → 23）；`ledger_assert_platform_mutation` 的 `-1` credit 白名单须同轮追加两值。
  //    `debit` 仍恒为空（不许被顺带松掉）。
  '-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit', 'checkin_makeup_fee', 'bttc_mint_fee', 'bttc_burn_fee'], debit: [] },
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

/**
 * P1o（Kong，2026-09）· **账户自建路径**的错误收敛：不得让原始 PG SQLSTATE 逃到调用方。
 *
 * 场景（P1o 逃逸扫描实测，见 `.p1f-artifacts/p1o-00-escape-sweep-before-*.json` 的
 * `E-W7/E-W8/E-W9`）：`cid` **形状合法但该行不存在**时，`ensureAccount` 的 `INSERT` 撞
 * `account.cid REFERENCES currency(cid)` ⇒ PG 抛裸 `23503`（`mapped = false` / `status = undefined`）
 * 直接逃到调用方 —— 与 §14.3 v0.5 枚举块 ②（**形状合法但不存在 ⇒ `404`**）不符，同属
 * 「33 码关闭集 + 不得吐未映射原始 SQLSTATE」的硬口径（`normalizeLedgerError` 早已把 `23503`
 * 归 `LEDGER_CURRENCY_NOT_FOUND` / `404`，只是这三条账户自建路径此前没走它）。
 * ⇒ 本包装只做**归类**：`LedgerError` 原样透传，其余（含裸 `23503`）交 `normalizeLedgerError`。
 * 这三条路径当前无任何脚本/上层调用（`grep` 实测只有定义），故对既有读数零影响。
 */
const withLedgerErrorMapping = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (isLedgerError(e)) throw e;
    throw normalizeLedgerError(e);
  }
};

/** R79：按 uid 升序（同 uid 再按 cid 升序）批量加锁，只接受已排序集合 */
export const lockAccounts = async (tx: TxClient, targets: Array<{ uid: Amount; cid: Amount }>): Promise<AccountRecord[]> =>
  withLedgerErrorMapping(async () => {
    const pairs = targets
      .map((t) => ({ uid: toUid(t.uid).toString(), cid: toCid(t.cid).toString() }))
      .sort((a, b) => (BigInt(a.uid) < BigInt(b.uid) ? -1 : BigInt(a.uid) > BigInt(b.uid) ? 1
        : BigInt(a.cid) < BigInt(b.cid) ? -1 : BigInt(a.cid) > BigInt(b.cid) ? 1 : 0));
    const out: AccountRecord[] = [];
    for (const p of pairs) out.push(await lockAccount(tx, BigInt(p.uid), BigInt(p.cid)));
    return out;
  });

/**
 * 取账户，不存在则按 0/0 开出来（R75 + R99）。
 * 传入 tx ⇒ 用当前事务的连接（**业务事件内必须传 tx**，R57；不传则自开一个事务）。
 */
export const getOrCreateAccount = async (uid: Amount, cid: Amount, tx?: TxClient): Promise<AccountRecord> =>
  withLedgerErrorMapping(async () => {
    const u = toUid(uid);
    const c = toCid(cid);
    if (tx) return lockAccount(tx, u, c);
    return withTransaction((t) => lockAccount(t, u, c));
  });

/**
 * R99：为某个新币种为**全部平台保留 uid** 开户（新币种创建流程必须调用，防遗漏）。
 * P1a 未实现币种创建动作，此函数供后续阶段直接复用。
 */
export const ensurePlatformAccounts = async (cid: Amount, tx?: TxClient): Promise<AccountRecord[]> =>
  withLedgerErrorMapping(async () => {
    const c = toCid(cid);
    const run = async (t: TxClient): Promise<AccountRecord[]> => {
      const out: AccountRecord[] = [];
      for (const uid of [0n, PLATFORM_UID.FEE, PLATFORM_UID.COMMISSION, PLATFORM_UID.FORFEIT]) {
        out.push(await lockAccount(t, uid, c));
      }
      return out;
    };
    return tx ? run(tx) : withTransaction(run);
  });

// ============================================================================
// §5 分录写入器（保留件：分录列集 / 行映射 / 配对不变式 / 按键取回 / 快照聚合）
//    —— 这些是**读**与**纯校验**用的，不再包含任何写库语句（写路径见下面的 §5b）
// ============================================================================

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

/**
 * 事件自己的流水（R51③④ 只读侧）。
 * P1i（F1②）：改为按 `event_root_key` **精确归属** ——
 *   删除了修前的 `left(idempotency_key, length($1)+1) = $1 || '#'` **字符串前缀算术**。
 *   那正是 F1 的根因：它会把他**人事件**的派生行（`<别人根键>#<i>`）当成自己的重放结果返回。
 *   历史行（0005 之前写入 ⇒ 归属列为 NULL）只按 `idempotency_key = $1` 的**精确等值**兜底，
 *   不做任何前缀匹配；历史脏数据的清理由后续单负责（见交付报告「测试数据」节）。
 *   注：`event_root_key` 只作**过滤谓词**，不进 `ENTRY_COLS` / `LedgerEntryRecord`
 *   ⇒ 出参形状逐字不变（对外 API 零破坏）。
 */
const findByKey = async (key: string, tx?: TxClient): Promise<LedgerEntryRecord[]> => {
  const sql = `SELECT ${ENTRY_COLS} FROM ledger_entry
               WHERE event_root_key = $1
                  OR (event_root_key IS NULL AND idempotency_key = $1)
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

// ============================================================================
// §5b · 记账写路径（D10 变体 B / P1e）：一个业务事件 = 一条语句 = 一趟往返
// ============================================================================
// Kevin 拍板口径（D10，2026-09）：把「参数校验 + 幂等占位 + 加锁全序 + 分录写入 +
// 余额/冻结更新 + 配对不变式」**全部**下沉到 DB 函数 `ledger_post_event(jsonb)`
// （`migrations/0004_ledger_post_event.sql`，PL/pgSQL）。本文件在写路径上只剩三件事：
//   ① 组装 payload（纯数据组装：金额语义分流、ref 成对、uid/cid 形状；**不换算、不加锁、不写库**）
//   ② 发**一条** `SELECT ledger_post_event($1::jsonb)` —— 单语句自带隐式事务，
//      即 R57「一个业务事件一个事务」；不再需要 `withTransaction` 的 BEGIN…COMMIT 往返
//   ③ 把 DB 抛出的自定义 SQLSTATE（LD001..LD033）映射回 §14 错误码（R104 唯一来源）
//
// 为什么（P1b 实测，非推测）：本机 ↔ Neon(新加坡) 每语句 RTT 190–290 ms，旧实现一笔
// `transfer` 要 10–14 条语句 ⇒ 单笔 3.3–4.4 s，连 BEGIN…COMMIT 都要 1.4–2.3 s；
// 压成一条语句后，行锁持有时间 = 该语句执行时间，R82 的 lock_timeout 不再被「语句数 × RTT」放大。
//
// **已删除，禁止双真源**：`postEntry`（逐条 INSERT + UPDATE account）、`withIdempotentEvent`
// （withTransaction 外壳）、`IdempotencyReplayDetected`（旧哨兵）、`PostEntryInput`。
// 旧 TS 记账逻辑在本文件已不存在；金额换算/幂等/加锁/分录/不变式**只有 DB 一份实现**。
// 结构复杂但分录集合预先已知的事件（P2 十级返佣、P5 交易所成交 4 条分录）走
// `postEvent({ op: 'entries', ... })`，后续阶段不必再改 DB 函数。
//
// TS 侧仍保留的**纯函数**校验（不入库、不加锁、语义与 DB 相同，只为保持既有错误形状/快速失败）：
//   toUid/assertUserUid/toCid/toAmount/normalizeRef/assertLedgerKind/assertBalanced。
// 注意：这些校验**不是**唯一防线 —— DB 函数对同一批规则再判一次（判负演练已证，见
// scripts/p1e-04-db-fn-probe.ts 的 30 例裸 SQL 拒绝读数）。

/** 六个 op（与 DB 函数 `ledger_post_event` 的 dispatch 一一对应） */
export type LedgerEventOp = 'mint' | 'transfer' | 'hold' | 'hold_release' | 'settle' | 'entries';

/** `op = 'entries'` 的显式分录入参（金额一律**最小单位**整数，R66/R70） */
export interface LedgerEventEntryInput {
  uid: Amount;
  cid: Amount;
  /** 可用余额变动；与 frozenDelta 不得同时为 0（ledger_move_guard） */
  delta: Amount;
  frozenDelta?: Amount | null;
  kind: LedgerKind;
  refType?: RefType | null;
  refId?: Amount | null;
  memo?: string;
  /** kind = 'reversal' 时必须给出（ledger_reversal_guard） */
  reversalOfTxid?: Amount | null;
}

/** TS 侧入口 `postEvent(payload)` 的入参形状（字段名与 DB 契约逐字一致，见 0004 文件头） */
export interface LedgerEventPayload {
  op: LedgerEventOp;
  idempotencyKey: string;
  /** R53：规范化请求体的 sha256；NULL = 「同键即重放」 */
  requestFingerprint?: string | null;
  memo?: string;
  refType?: RefType | null;
  refId?: Amount | null;
  /** mint / hold / hold_release */
  uid?: Amount;
  /** transfer / settle */
  fromUid?: Amount;
  toUid?: Amount;
  cid?: Amount;
  /** 用户输入形态十进制字符串（DB 按 currency.decimals 换算）或最小单位整数 */
  amount?: Amount;
  /** mint：R23 平台受信任路径 */
  platform?: boolean;
  /** settle：R33 出账白名单 kind */
  kind?: LedgerKind;
  /** settle：受款方 kind（缺省由 DB 按 SETTLE_PAYEE_KIND 映射） */
  payeeKind?: LedgerKind;
  /** hold / hold_release / settle：R36 业务表证明的在冻额上界（最小单位整数） */
  businessFrozenCap?: Amount | null;
  /** op = 'entries'：显式分录列表（1..32 条，去重后账户 ≤ 16） */
  entries?: LedgerEventEntryInput[];
  /** op = 'entries'：可选，对该事件涉及的每个 cid 施加 R28 状态矩阵 */
  currencyOp?: CurrencyOp;
}

/** DB 函数返回的余额快照（与 LedgerOpResult.accounts 同形） */
interface DbAccounts {
  uid: string;
  cid: string;
  balance: string;
  frozen: string;
}

/** DB 函数返回的取证信息：op + 加锁顺序（R79 取证读数） */
export interface LedgerEventMeta {
  op: string;
  /** 例：["currency:10","account:920001:10","account:920002:10"] —— 真实加锁顺序 */
  lock_trace: string[];
}

// ---------------------------------------------------------------- 驱动选择（评估用）
/**
 * 写路径驱动（默认 `pool`；三种都只发**同一条**语句，差别只在传输层）：
 *   - `pool`   ：`db.ts` 的只读池（WS over pooler）—— 单语句无会话态，PgBouncer transaction 模式安全
 *   - `direct` ：自建池走 `DATABASE_URL_UNPOOLED`（R56 直连口径）
 *   - `neon`   ：SQL-over-HTTP（`neon()`），用于评估「`ws` / `Pool` 能否整体移除」
 * 环境变量：`SEAFOOD_LEDGER_WRITE_DRIVER = pool | direct | neon`
 * 注意：HTTP 模式下 PostgreSQL 的 `DETAIL` 不进 `error.detail`（驱动只搬运 message+code），
 * 因此 §14.4 的 details 形状在 `neon` 模式下会退化为 `{ detail_unavailable: 'http_driver' }`；
 * code/status 映射**不受影响**（闭包性不破）。要细节就留在 ws 池（默认）。
 */
type LedgerWriteDriver = 'pool' | 'direct' | 'neon';

const ledgerWriteDriver = (): LedgerWriteDriver => {
  const v = (process.env.SEAFOOD_LEDGER_WRITE_DRIVER ?? 'pool').trim().toLowerCase();
  return v === 'direct' || v === 'neon' ? v : 'pool';
};

let ledgerWritePool: Pool | null = null;

const getLedgerWritePool = (): Pool => {
  if (ledgerWritePool) return ledgerWritePool;
  const url = resolveTransactionUrl();
  if (!url) throw new LedgerError('LEDGER_TRANSACTION_REQUIRED', { cause: 'non_pg_error', reason: 'unclassified_non_pg_error', error_code: 'DATABASE_URL_MISSING' });
  ledgerWritePool = new Pool({
    connectionString: url,
    max: Number(process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX ?? 4),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return ledgerWritePool;
};

/** 收尾：脚本必须调用（否则 `direct` 模式的池会吊住事件循环） */
export const closeLedgerWritePool = async (): Promise<void> => {
  if (ledgerWritePool) {
    const p = ledgerWritePool;
    ledgerWritePool = null;
    await p.end().catch(() => undefined);
  }
};

const LEDGER_FN_SQL = 'SELECT ledger_post_event($1::jsonb) AS r';

/** 发**一条**语句（三种驱动同形）；返回函数的 jsonb 结果 */
const callLedgerFnOnce = async (payloadJson: string): Promise<unknown> => {
  const driver = ledgerWriteDriver();
  if (driver === 'neon') {
    const url = resolveReadUrl();
    if (!url) throw new LedgerError('LEDGER_TRANSACTION_REQUIRED', { cause: 'non_pg_error', reason: 'unclassified_non_pg_error', error_code: 'DATABASE_URL_MISSING' });
    const rows = await neon(url)(LEDGER_FN_SQL, [payloadJson]) as unknown as RawRow[];
    return rows?.[0]?.r ?? null;
  }
  if (driver === 'direct') {
    const res = await getLedgerWritePool().query<RawRow>(LEDGER_FN_SQL, [payloadJson]);
    return res.rows?.[0]?.r ?? null;
  }
  const rows = await readQuery<RawRow>(LEDGER_FN_SQL, [payloadJson]);
  return rows?.[0]?.r ?? null;
};

// ---------------------------------------------------------------- 错误映射（DB SQLSTATE → §14）
/** DB 自定义 SQLSTATE → §14 码（逐条对应 0004 的 `ledger_sqlstate_of`，两侧必须同步）
 *  导出：质检脚本需枚举这张表的容量（封闭性反证：非账本 SQLSTATE 不得被误映射）。 */
export const LEDGER_SQLSTATE_TO_CODE: Record<string, LedgerErrorCode> = {
  LD001: 'LEDGER_INSUFFICIENT_BALANCE',
  LD002: 'LEDGER_INSUFFICIENT_FROZEN',
  LD003: 'LEDGER_IDEMPOTENCY_CONFLICT',
  LD004: 'LEDGER_IDEMPOTENCY_KEY_REQUIRED',
  LD005: 'LEDGER_IDEMPOTENCY_KEY_INVALID',
  LD006: 'LEDGER_IDEMPOTENCY_REPLAY',
  LD007: 'LEDGER_CURRENCY_NOT_FOUND',
  LD008: 'LEDGER_CURRENCY_NOT_LISTED',
  LD009: 'LEDGER_CURRENCY_FROZEN',
  LD010: 'LEDGER_CURRENCY_DELISTED',
  LD011: 'LEDGER_CURRENCY_INVALID_TRANSITION',
  LD012: 'LEDGER_CURRENCY_MISMATCH',
  LD013: 'LEDGER_SUPPLY_CAP_EXCEEDED',
  LD014: 'LEDGER_UNAUTHORIZED_MINT',
  LD015: 'LEDGER_HOLD_NOT_ALLOWED',
  LD016: 'LEDGER_AMOUNT_INVALID',
  LD017: 'LEDGER_AMOUNT_NOT_POSITIVE',
  LD018: 'LEDGER_DECIMALS_OVERFLOW',
  LD019: 'LEDGER_SELF_TRANSFER',
  LD020: 'LEDGER_ACCOUNT_NOT_FOUND',
  LD021: 'LEDGER_RESERVED_UID',
  LD022: 'LEDGER_REF_NOT_FOUND',
  LD023: 'LEDGER_UNKNOWN_KIND',
  LD024: 'LEDGER_TRANSACTION_REQUIRED',
  LD025: 'LEDGER_LOCK_TIMEOUT',
  LD026: 'LEDGER_TX_TIMEOUT',
  LD027: 'LEDGER_DEADLOCK_RETRY_EXHAUSTED',
  LD028: 'LEDGER_NEGATIVE_BALANCE_GUARD',
  LD029: 'LEDGER_APPEND_ONLY_VIOLATION',
  LD030: 'LEDGER_ACCOUNT_GUARD_VIOLATION',
  LD031: 'LEDGER_FEE_RATE_INVALID',
  LD032: 'LEDGER_RECONCILE_MISMATCH',
  LD033: 'LEDGER_CURRENCY_SYMBOL_TAKEN',
};

/** 内部哨兵（**不是**对外错误）：探针冲突但重放行在当前语句快照里不可见 ⇒ 同键重发一次 */
const REPLAY_NOT_VISIBLE_SQLSTATE = 'LD006';
const REPLAY_NOT_VISIBLE_MESSAGE = 'LEDGER_IDEMPOTENCY_REPLAY';

/**
 * 可重试 SQLSTATE（R60：同键重试；其余一律不重试）。
 * P1i：**必须**含 `'LD027'` —— 0005 起 DB 层把 `40001` / `40P01` 归一化后**抛 LD027**
 * （DETAIL: `retries_performed=0` / `retry_owner=caller`，见 F3④），裸 `40P01` 不再逃出函数。
 * 不同步这一项 = 死锁**不再被重试** = 行为回归（R60 形同失效）。
 * `'40001'` / `'40P01'` 保留：它们是**函数之外**（如只读路径、非账本语句）仍可能逃出的原始码。
 */
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01', 'LD027']);

const sqlstateOf = (e: unknown): string => String((e as { code?: unknown })?.code ?? '');
const messageOf = (e: unknown): string => String((e as { message?: unknown })?.message ?? '');

/**
 * DB 抛出的**账本命名错误** → `LedgerError`。
 * 返回 `null` ⇒ 不是本函数抛的（PG 原生约束/超时/驱动级错误）⇒ 交给 `normalizeLedgerError`。
 *
 * 映射口径（R107）：只搬运 `DETAIL` 里的 §14.4 形状 JSON；不搬运 SQL/约束名/堆栈。
 * 导出：`ledgerErrorFromDbError` 供质检脚本对**同一份原始 PG 错误**两路取证
 * （DB SQLSTATE + TS 映射码），证明映射封闭。
 */
export const ledgerErrorFromDbError = (e: unknown, fallbackKey?: string): LedgerError | null => {
  const sqlstate = sqlstateOf(e);
  const mapped = LEDGER_SQLSTATE_TO_CODE[sqlstate];
  if (!mapped) return null;

  const details: LedgerErrorDetails = {};
  const rawDetail = (e as { detail?: unknown })?.detail;
  if (typeof rawDetail === 'string' && rawDetail.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawDetail) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
          details[k] = v as string | number | boolean | null;
        } else {
          details[k] = JSON.stringify(v);
        }
      }
    } catch {
      details.detail_unparsed = rawDetail.slice(0, 200);
    }
  } else {
    // HTTP 驱动不搬运 DETAIL（见驱动选择注释）⇒ 明确标注，便于质检区分「无 details」与「解析失败」
    details.detail_unavailable = 'driver_did_not_carry_detail';
  }
  if (mapped === 'LEDGER_IDEMPOTENCY_CONFLICT' && fallbackKey !== undefined && details.idempotency_key === undefined) {
    details.idempotency_key = fallbackKey;
  }
  // 双保险：MESSAGE 也必须是 §14 码名；两侧不一致 = migration 与 TS 表漂移 ⇒ 以 SQLSTATE 为准并留证
  const msg = messageOf(e);
  if (isLedgerErrorCode(msg) && msg !== mapped) details.db_message_mismatch = msg;

  return new LedgerError(mapped, details);
};

/** 解析函数返回值（三种驱动都可能给到对象或 JSON 文本） */
const parseFnResult = (raw: unknown): Record<string, unknown> => {
  let obj: unknown = raw;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      obj = null;
    }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new LedgerError('LEDGER_TRANSACTION_REQUIRED', {
      cause: 'bad_ledger_function_result', reason: 'unclassified_pg_error',
      error_code: 'LEDGER_FUNCTION_BAD_RESULT',
    });
  }
  return obj as Record<string, unknown>;
};

/** 发一条语句 + 解析 + 映射（含 R60 重试与「重放行不可见」同键重发） */
const runLedgerFn = async (payload: Record<string, unknown>): Promise<LedgerOpResult> => {
  const json = JSON.stringify(payload);
  const key = rawStr(payload.idempotency_key);
  let retries = 0;
  for (;;) {
    try {
      const res = parseFnResult(await callLedgerFnOnce(json));
      const entries = ((res.entries as RawRow[] | undefined) ?? []).map(mapEntry);
      const accountsRaw = (res.accounts as RawRow[] | undefined) ?? [];
      const accounts: AccountSnapshot[] = accountsRaw.length
        ? accountsRaw.map((a) => ({
          uid: rawStr(a.uid), cid: rawStr(a.cid), balance: rawStr(a.balance), frozen: rawStr(a.frozen),
        }))
        : snapshotsOf(entries);
      const extraRaw = (res.extra as Record<string, unknown> | undefined) ?? {};
      const extra: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(extraRaw)) extra[k] = rawStrOrNull(v);
      const metaRaw = res.meta as RawRow | undefined;
      return {
        ok: true,
        idempotent_replay: res.idempotent_replay === true,
        idempotency_key: rawStr(res.idempotency_key) || key,
        txid: rawStr(res.txid),
        entries,
        accounts,
        extra,
        meta: metaRaw
          ? { op: rawStr(metaRaw.op), lock_trace: ((metaRaw.lock_trace as unknown[]) ?? []).map((x) => rawStr(x)) }
          : undefined,
      };
    } catch (e) {
      const sqlstate = sqlstateOf(e);
      if (RETRYABLE_SQLSTATES.has(sqlstate) && retries < 3) {
        // R60：同键重试（键不变 ⇒ 重试安全；幂等约束保证只生效一次）
        await new Promise((r) => setTimeout(r, [50, 200, 800][retries]));
        retries += 1;
        continue;
      }
      if (sqlstate === REPLAY_NOT_VISIBLE_SQLSTATE && messageOf(e) === REPLAY_NOT_VISIBLE_MESSAGE && retries < 1) {
        // R51 ④：探针冲突说明该键已被占用，但重放行在本语句快照里不可见（并发提交中）⇒ 同键重发一次
        retries += 1;
        continue;
      }
      const mapped = ledgerErrorFromDbError(e, key);
      if (mapped) throw mapped;
      throw normalizeLedgerError(e);
    }
  }
};

/** 显式入参形状（TS 侧纯校验用） */
type LedgerEventPayloadInput = LedgerEventPayload;

/**
 * **TS 侧写路径唯一入口**（新增，P1e）：组装 payload → 一条语句 → 结构化结果。
 * 上层需要写「结构复杂但分录集合预先已知」的事件（P2/P5）时用它；五个高层动作也走它。
 */
export const postEvent = async (input: LedgerEventPayloadInput): Promise<LedgerOpResult> => {
  const key = normalizeIdempotencyKey(input.idempotencyKey);
  const { refType, refId } = normalizeRef(input.refType ?? null, input.refId ?? null);
  const payload: Record<string, unknown> = {
    op: input.op,
    idempotency_key: key,
    memo: input.memo ?? '',
  };
  if (input.requestFingerprint !== undefined && input.requestFingerprint !== null) {
    payload.request_fingerprint = input.requestFingerprint;
  }
  if (refType !== null) {
    payload.ref_type = refType;
    payload.ref_id = refId;
  }

  if (input.uid !== undefined) payload.uid = toUid(input.uid).toString();
  if (input.fromUid !== undefined) payload.from_uid = toUid(input.fromUid, 'fromUid').toString();
  if (input.toUid !== undefined) payload.to_uid = toUid(input.toUid, 'toUid').toString();
  if (input.cid !== undefined) payload.cid = toCid(input.cid).toString();
  if (input.amount !== undefined) Object.assign(payload, amountToPayload(input.amount));
  if (input.platform !== undefined) payload.platform = Boolean(input.platform);
  if (input.kind !== undefined) payload.kind = assertLedgerKind(input.kind);
  if (input.payeeKind !== undefined) payload.payee_kind = assertLedgerKind(input.payeeKind);
  if (input.currencyOp !== undefined) payload.currency_op = input.currencyOp;
  if (input.businessFrozenCap !== undefined && input.businessFrozenCap !== null) {
    payload.business_frozen_cap = toAmount(input.businessFrozenCap, 'businessFrozenCap').toString();
  }
  if (input.entries !== undefined) {
    assertBalanced(input.entries.map((e) => ({
      delta: e.delta, frozenDelta: e.frozenDelta ?? undefined, kind: e.kind,
    })));
    payload.entries = input.entries.map(entryToPayload);
  }
  return runLedgerFn(payload);
};

/**
 * 金额入参 → payload 字段（与 DB 侧 `ledger_payload_amount` 的二选一契约逐字对应）：
 *   - `bigint` / `number` ⇒ **最小单位**语义（R66）：`amount_units`，TS 只做整数/安全整数判定；
 *   - `string`            ⇒ **用户输入十进制**语义（R72）：`amount`，换算与校验由 DB 用
 *     `currency.decimals` 一笔完成（否则 TS 得先 SELECT 一次拿 decimals ⇒ 又变成两趟往返）。
 */
const amountToPayload = (v: Amount, field = 'amount'): Record<string, string> =>
  (typeof v === 'string' ? { amount: v } : { amount_units: toAmount(v, field).toString() });

/** 单条显式分录 → DB 契约（op='entries'；金额一律最小单位字符串） */
const entryToPayload = (e: LedgerEventEntryInput): Record<string, unknown> => {
  const uid = toUid(e.uid);
  const cid = toCid(e.cid);
  const delta = toAmount(e.delta, 'delta');
  const frozenDelta = toAmount(e.frozenDelta ?? 0n, 'frozenDelta');
  const kind = assertLedgerKind(e.kind);
  if (delta === 0n && frozenDelta === 0n) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'delta/frozen_delta', reason: 'BOTH_ZERO' });
  }
  const reversalOf = e.reversalOfTxid === null || e.reversalOfTxid === undefined
    ? null
    : toAmount(e.reversalOfTxid, 'reversal_of_txid').toString();
  if ((kind === 'reversal') !== (reversalOf !== null)) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'reversal_of_txid', reason: 'REVERSAL_GUARD' });
  }
  const { refType, refId } = normalizeRef(e.refType ?? null, e.refId ?? null);
  const out: Record<string, unknown> = {
    uid: uid.toString(), cid: cid.toString(),
    delta: delta.toString(), frozen_delta: frozenDelta.toString(),
    kind, memo: e.memo ?? '',
  };
  if (refType !== null) {
    out.ref_type = refType;
    out.ref_id = refId;
  }
  if (reversalOf !== null) out.reversal_of_txid = reversalOf;
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
  postEvent({
    op: 'mint',
    uid: input.uid,
    cid: input.cid,
    amount: input.amount,
    platform: input.platform ?? false,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? '',
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

export const transfer = async (input: TransferInput): Promise<LedgerOpResult> => {
  // R100：**用户请求**不得把平台账户当对手方（TS 侧保留；R101×R38 的 `-3` 出账例外只对
  // DB 函数 / postEvent 的内部调用开放，见 docs/ledger.spec.md §19.1）
  const fromUid = assertUserUid(input.fromUid, 'fromUid');
  const toUid = assertUserUid(input.toUid, 'toUid');
  if (fromUid === toUid) {
    throw new LedgerError('LEDGER_SELF_TRANSFER', { uid: fromUid.toString(), cid: toCid(input.cid).toString() });
  }
  return postEvent({
    op: 'transfer',
    fromUid, toUid, cid: input.cid, amount: input.amount,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? '',
  });
};

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

/** R37 共用前置：无业务单 ⇒ LEDGER_HOLD_NOT_ALLOWED（纯校验，不查库） */
const requireBusinessRef = (uid: bigint, cid: bigint, refType: RefType | null | undefined, refId: Amount | null | undefined): void => {
  if (!refType || refId === undefined || refId === null || String(refId) === '') {
    throw new LedgerError('LEDGER_HOLD_NOT_ALLOWED', { uid: uid.toString(), cid: cid.toString(), reason: 'BUSINESS_REF_REQUIRED' });
  }
};

export const freeze = async (input: FreezeInput): Promise<LedgerOpResult> => {
  const uid = assertUserUid(input.uid); // R37/R101：平台账户不接受 hold
  const cid = toCid(input.cid);
  requireBusinessRef(uid, cid, input.refType, input.refId);
  return postEvent({
    op: 'hold',
    uid, cid, amount: input.amount,
    businessFrozenCap: input.businessFrozenCap ?? null,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? '',
  });
};

// ============================================================================
// 高层动作 ④：unfreeze 冻结 → 可用（hold_release，同账户 2 条分录）
// ============================================================================

export interface UnfreezeInput extends Omit<FreezeInput, 'businessFrozenCap'> {
  /** R36：解冻额上界（业务表证明对应冻结仍存在）；提供了就校验 */
  businessFrozenCap?: Amount | null;
}

export const unfreeze = async (input: UnfreezeInput): Promise<LedgerOpResult> => {
  const uid = assertUserUid(input.uid);
  const cid = toCid(input.cid);
  requireBusinessRef(uid, cid, input.refType, input.refId);
  return postEvent({
    op: 'hold_release',
    uid, cid, amount: input.amount,
    businessFrozenCap: input.businessFrozenCap ?? null,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? '',
  });
};

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

export const settleFrozen = async (input: SettleFrozenInput): Promise<LedgerOpResult> => {
  const cid = toCid(input.cid);
  const fromUid = assertUserUid(input.fromUid, 'fromUid');
  const kind = assertLedgerKind(input.kind);
  if (!FROZEN_SETTLE_KINDS.includes(kind)) {
    throw new LedgerError('LEDGER_UNKNOWN_KIND', { kind, reason: 'NOT_IN_FROZEN_SETTLE_WHITELIST' });
  }
  const isForfeit = kind === 'hold_forfeit';
  const toUid = isForfeit ? PLATFORM_UID.FORFEIT : assertUserUid(input.toUid, 'toUid');
  if (isForfeit && input.toUid !== undefined && input.toUid !== null
      && BigInt(toAmount(input.toUid, 'toUid')) !== PLATFORM_UID.FORFEIT) {
    throw new LedgerError('LEDGER_RESERVED_UID', {
      field: 'toUid', uid: String(input.toUid), reason: 'FORFEIT_MUST_GO_TO_-3',
    });
  }
  if (fromUid === toUid) throw new LedgerError('LEDGER_SELF_TRANSFER', { uid: fromUid.toString(), cid: cid.toString() });
  const payeeKind = isForfeit ? kind : (input.payeeKind ?? SETTLE_PAYEE_KIND[kind] ?? kind);
  return postEvent({
    op: 'settle',
    fromUid, toUid, cid, amount: input.amount,
    kind, payeeKind,
    businessFrozenCap: input.businessFrozenCap ?? null,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? '',
  });
};

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
  // P1o 附带发现（同属「不得吐未映射原始 SQLSTATE」的硬口径）：`Math.trunc(NaN)` / `Math.trunc('abc')`
  // 都得到 `NaN`，`NaN` 作为 `LIMIT` 参数被驱动发成 `"NaN"` ⇒ PG 抛裸 `22P02`
  // （实测：`.p1f-artifacts/p1o-00-escape-sweep-before-*.json` 的 `E-R3_limit`）。
  // ⇒ 非有限 / 非数值一律取分页默认值 50；仍钳在 [1, 200]（R95）。
  const rawLimit = typeof limit === 'number' ? limit : Number(limit);
  const n = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.trunc(rawLimit))) : 50;
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
