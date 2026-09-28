/**
 * 账本统一错误码表（唯一来源 · spec §14 / R104 · R105 · R106 · R107）
 * ============================================================================
 * R104：账本错误码只有一个来源（本文件）。业务代码**不得**手写中文错误文案、
 *       不得 `new Error('...')`；一律 `new LedgerError(CODE, details)`。
 * R105：code → HTTP status 映射在本表冻结：400 请求不合法 / 403 权限 / 404 不存在 /
 *       409 状态冲突 / 423 被锁定 / 500 实现缺陷 / 503 暂时不可用。
 * R106：`LEDGER_IDEMPOTENCY_REPLAY` **不是错误**（200 + idempotent_replay），
 *       它登记在本表只为日志检索与统计；本模块的构造函数对它的使用有显式注释。
 * R107：统一错误响应结构 `{ error: { code, message, i18n_key, details } }`，
 *       `details` 只放非敏感上下文（cid / symbol / 期望值 / 实际值 / 关联键），
 *       禁止放 SQL、约束名、堆栈、表名、连接串。
 *
 * i18n key 命名：`ledger.err.<CODE>`（D4：本期只 zh，保留 i18n 框架，key 先建好）
 */

export interface LedgerErrorMeta {
  /** HTTP 状态码；null = 非 HTTP 错误（脚本退出码语义，见 §11 R88） */
  readonly status: number | null;
  /** zh 文案（D4：本期唯一语种） */
  readonly message: string;
}

/**
 * §14.1 全表（33 条，逐条落地，不增不减）。
 * 注意：`LEDGER_IDEMPOTENCY_REPLAY` 在此登记但**永不进入错误分支**（R106）。
 */
export const LEDGER_ERROR_TABLE = {
  // --- §14 #1..#6 余额 / 幂等
  LEDGER_INSUFFICIENT_BALANCE: { status: 409, message: '可用余额不足' },
  LEDGER_INSUFFICIENT_FROZEN: { status: 409, message: '冻结余额不足' },
  LEDGER_IDEMPOTENCY_REPLAY: { status: 200, message: '' },
  LEDGER_IDEMPOTENCY_CONFLICT: { status: 409, message: '该请求与先前的请求内容不一致' },
  LEDGER_IDEMPOTENCY_KEY_REQUIRED: { status: 400, message: '请求缺少幂等标识' },
  LEDGER_IDEMPOTENCY_KEY_INVALID: { status: 400, message: '请求标识格式不合法' },
  // --- §14 #7..#13 币种
  LEDGER_CURRENCY_NOT_FOUND: { status: 404, message: '该单位不存在' },
  LEDGER_CURRENCY_NOT_LISTED: { status: 409, message: '该单位尚未上市，暂不可交易' },
  LEDGER_CURRENCY_FROZEN: { status: 423, message: '该单位已暂停交易' },
  LEDGER_CURRENCY_DELISTED: { status: 409, message: '该单位已下架' },
  LEDGER_CURRENCY_INVALID_TRANSITION: { status: 409, message: '状态不允许此变更' },
  LEDGER_CURRENCY_SYMBOL_TAKEN: { status: 409, message: '该符号已被占用' },
  LEDGER_CURRENCY_MISMATCH: { status: 400, message: '币种不一致' },
  // --- §14 #14..#16 铸造 / 冻结授权
  LEDGER_SUPPLY_CAP_EXCEEDED: { status: 409, message: '已达该单位发行上限' },
  LEDGER_UNAUTHORIZED_MINT: { status: 403, message: '你没有发行该单位的权限' },
  LEDGER_HOLD_NOT_ALLOWED: { status: 403, message: '不支持手动冻结' },
  // --- §14 #17..#20 金额
  LEDGER_AMOUNT_INVALID: { status: 400, message: '金额格式不正确' },
  LEDGER_AMOUNT_NOT_POSITIVE: { status: 400, message: '金额必须大于 0' },
  LEDGER_DECIMALS_OVERFLOW: { status: 400, message: '该单位支持的小数位数不足' },
  LEDGER_SELF_TRANSFER: { status: 400, message: '不能转给自己' },
  // --- §14 #21..#24 目标对象
  LEDGER_ACCOUNT_NOT_FOUND: { status: 404, message: '账户不存在' },
  LEDGER_RESERVED_UID: { status: 400, message: '目标账户无效' },
  LEDGER_REF_NOT_FOUND: { status: 404, message: '关联单据不存在' },
  LEDGER_UNKNOWN_KIND: { status: 400, message: '不支持的账务类型' },
  // --- §14 #25..#28 事务
  LEDGER_TRANSACTION_REQUIRED: { status: 500, message: '服务暂不可用，请稍后重试' },
  LEDGER_LOCK_TIMEOUT: { status: 503, message: '系统繁忙，请稍后重试' },
  LEDGER_TX_TIMEOUT: { status: 503, message: '系统繁忙，请稍后重试' },
  LEDGER_DEADLOCK_RETRY_EXHAUSTED: { status: 503, message: '系统繁忙，请稍后重试' },
  // --- §14 #29..#32 DB 兜底 = 实现缺陷告警（R108）
  LEDGER_NEGATIVE_BALANCE_GUARD: { status: 500, message: '服务异常，请联系客服' },
  LEDGER_APPEND_ONLY_VIOLATION: { status: 500, message: '服务异常，请联系客服' },
  LEDGER_ACCOUNT_GUARD_VIOLATION: { status: 500, message: '服务异常，请联系客服' },
  LEDGER_FEE_RATE_INVALID: { status: 500, message: '服务配置异常' },
  // --- §14 #33 对账（脚本退出码语义，不映射 HTTP）
  LEDGER_RECONCILE_MISMATCH: { status: null, message: '' },
} as const satisfies Record<string, LedgerErrorMeta>;

export type LedgerErrorCode = keyof typeof LEDGER_ERROR_TABLE;

export const LEDGER_ERROR_CODES = Object.keys(LEDGER_ERROR_TABLE) as LedgerErrorCode[];

export const isLedgerErrorCode = (v: unknown): v is LedgerErrorCode =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(LEDGER_ERROR_TABLE, v);

/** 500 类错误 = 只可能是代码缺陷（R108 必须告警） */
export const DEFECT_ERROR_CODES: LedgerErrorCode[] = [
  'LEDGER_NEGATIVE_BALANCE_GUARD',
  'LEDGER_APPEND_ONLY_VIOLATION',
  'LEDGER_ACCOUNT_GUARD_VIOLATION',
  'LEDGER_FEE_RATE_INVALID',
];

export const isDefectError = (code: LedgerErrorCode): boolean => DEFECT_ERROR_CODES.includes(code);

/**
 * §14.1 码 → 分类器桶（**与 DB 侧 `ledger_error_for_sqlstate`（`0009` 的 LD0nn 分支）同表同值**）
 * ============================================================================
 * 依据：`docs/ledger.spec.md` §14.3 附（bucket 纪律冻结，S1）+ `migrations/0009_…sql` 文件头 +
 *       `docs/seafood.master-plan.md` §5.23（`200` 改判：**不是错误类，不参与 bucket 校验**）。
 * 取值规则（真源 = 本表 `status` + 冻结的 `bucket↔状态类` 映射，逐条可复核）：
 *   `400 ⇒ input` / `404|409 ⇒ integrity` / `500 ⇒ defect` / `503 ⇒ retryable`；
 *   冻结映射**未覆盖**的状态类取**最小扩展**（与 `0009` 逐字一致）：
 *   `403 ⇒ input`（权限不足 = 调用方身份不对）· `423 ⇒ integrity`（资源被锁定 = 合规冻结）·
 *   `null ⇒ defect`（对账不符）。
 * ⚠️ **`200` 不再作为「扩展档位」参与 bucket↔状态类校验**（master-plan §5.23 裁定）：
 *    `LEDGER_IDEMPOTENCY_REPLAY`（`LD006`）是**良性结果**，单列 `benign_outcomes` 一类
 *    —— 见 `LEDGER_BENIGN_CODES`。但**本表的桶字段对它仍记 `'input'`**（= 「input 起源的良性结果」，
 *    与**已应用**的 `0009` 的 DB 侧 `bucket='input'` 保持一致）；**改桶 = 改已应用迁移的语义 = 撒谎态**，
 *    且会立刻把往返闭合测试的 `db_js_bucket_mismatch` 打红。**纪律：桶字段不动，改的是「谁参与校验」。**
 * ⚠️ **27 个 4xx 码集中在 `input`/`integrity` 两桶**：这两桶都含 400，故桶不能由状态反推，
 *    必须按码定死 —— 与 `0009` 的逐条 `WHEN` 一一对应。两侧漂移由
 *    `scripts/p2c-00-code-roundtrip.ts`（33 码全量往返闭合测试）逐条对拍，非零即缺陷。
 * 用途：① 质检脚本对拍 DB 桶与 JS 桶；② `httpStatusOf` 的缺陷类兜底判据。
 * **本表不新增任何错误码**（§14.1 关闭集 33 不动；键集 = `LEDGER_ERROR_TABLE` 的键集）。
 */
export type LedgerErrorBucket = 'input' | 'integrity' | 'retryable' | 'infra' | 'defect';

export const LEDGER_ERROR_BUCKETS: Record<LedgerErrorCode, LedgerErrorBucket> = {
  // --- input：400 类（调用方可触发）+ 403（权限不足，扩展档）；LD006 是「非错误」哨兵（R106）
  LEDGER_IDEMPOTENCY_KEY_REQUIRED: 'input',
  LEDGER_IDEMPOTENCY_KEY_INVALID: 'input',
  LEDGER_IDEMPOTENCY_REPLAY: 'input',
  LEDGER_CURRENCY_MISMATCH: 'input',
  LEDGER_UNAUTHORIZED_MINT: 'input',
  LEDGER_HOLD_NOT_ALLOWED: 'input',
  LEDGER_AMOUNT_INVALID: 'input',
  LEDGER_AMOUNT_NOT_POSITIVE: 'input',
  LEDGER_DECIMALS_OVERFLOW: 'input',
  LEDGER_SELF_TRANSFER: 'input',
  LEDGER_RESERVED_UID: 'input',
  LEDGER_UNKNOWN_KIND: 'input',
  // --- integrity：完整性 / 状态冲突 / 目标不存在（400|404|409）+ 423（资源被锁定，扩展档）
  LEDGER_INSUFFICIENT_BALANCE: 'integrity',
  LEDGER_INSUFFICIENT_FROZEN: 'integrity',
  LEDGER_IDEMPOTENCY_CONFLICT: 'integrity',
  LEDGER_CURRENCY_NOT_FOUND: 'integrity',
  LEDGER_CURRENCY_NOT_LISTED: 'integrity',
  LEDGER_CURRENCY_FROZEN: 'integrity',
  LEDGER_CURRENCY_DELISTED: 'integrity',
  LEDGER_CURRENCY_INVALID_TRANSITION: 'integrity',
  LEDGER_SUPPLY_CAP_EXCEEDED: 'integrity',
  LEDGER_ACCOUNT_NOT_FOUND: 'integrity',
  LEDGER_REF_NOT_FOUND: 'integrity',
  LEDGER_CURRENCY_SYMBOL_TAKEN: 'integrity',
  // --- retryable：503（事务冲突 / 超时；调用方同键重试，R60）
  LEDGER_LOCK_TIMEOUT: 'retryable',
  LEDGER_TX_TIMEOUT: 'retryable',
  LEDGER_DEADLOCK_RETRY_EXHAUSTED: 'retryable',
  // --- defect：500 类 = 实现缺陷（R108 必须告警）
  LEDGER_TRANSACTION_REQUIRED: 'defect',
  LEDGER_NEGATIVE_BALANCE_GUARD: 'defect',
  LEDGER_APPEND_ONLY_VIOLATION: 'defect',
  LEDGER_ACCOUNT_GUARD_VIOLATION: 'defect',
  LEDGER_FEE_RATE_INVALID: 'defect',
  LEDGER_RECONCILE_MISMATCH: 'defect',
};

/**
 * **良性结果码**（`benign_outcomes`）—— **不是错误类，不参与 `bucket ↔ 状态类` 校验**
 * ============================================================================
 * 裁定（`docs/seafood.master-plan.md` §5.23）：`200` 曾被塞进「扩展档位：`200 ⇒ input`」，
 * 语义不对 —— `LD006 = LEDGER_IDEMPOTENCY_REPLAY`（200 + `idempotent_replay`）是**良性结果**
 * （调用方重复提交；R106 保证它**永不进入错误分支**），不是「调用方但书类错误」。
 * ⇒ **单列 `benign_outcomes` 一类**，校验侧（`scripts/p2c-00-code-roundtrip.ts`）把它
 *   从 bucket↔状态类校验中**排除**并单独计数（不参与校验的码数 = 1），**而不是**为了让校验变绿去改桶。
 *
 * ⚠️ 纪律（两条必须**同时**成立，不得只做一半）：
 *   ① `LEDGER_ERROR_BUCKETS[c]` **保持 `'input'`** —— 桶字段描述的是「**来源**」（input 起源），
 *      且必须与**已应用**的 `0009`（DB 侧 `bucket='input'`）**逐字一致**
 *      ⇒ 改桶 = 改已应用迁移的语义 = 撒谎态，并立刻打红 `db_js_bucket_mismatch`。
 *   ② 但**校验侧不得再把 `200` 当成一条合法的「状态类 ⇒ 桶」映射来对拍** —— 这是本单的改动点。
 *
 * 附：`httpStatusOf` 对良性码恒返 **200**（R106：不是错误，**不得**落 500 兜底）。
 * 本清单**不新增错误码**（§14.1 关闭集 33 不动）。
 */
export const LEDGER_BENIGN_CODES: readonly LedgerErrorCode[] = ['LEDGER_IDEMPOTENCY_REPLAY'];

const BENIGN_CODE_SET: ReadonlySet<string> = new Set<string>(LEDGER_BENIGN_CODES);

/** 良性结果码的 HTTP 语义（R106：200，不是错误） */
export const BENIGN_HTTP_STATUS = 200;

export const isBenignLedgerCode = (code: LedgerErrorCode): boolean => BENIGN_CODE_SET.has(code);

/**
 * **响应层兜底规则**：`defect` 类码的 `status` **不得为 `null`** ⇒ HTTP 状态取 `status ?? 500`；
 * **良性码恒取 200**（R106 —— 它根本不是错误，不得落 500）。
 *
 * 为什么需要它：`LEDGER_RECONCILE_MISMATCH` 在本表登记为 `status: null` —— `null` 是**脚本退出码
 * 语义**（§11 R88：对账脚本不映射 HTTP），不是「没有状态」的占位。**但同一个码现在会被 HTTP 路径
 * 见到**：`0007` 的佣金守恒断言（`trg_ledger_entry_commission_conservation`）失败时抛的正是
 * `LD032` ⇒ `LEDGER_RECONCILE_MISMATCH`（账实不符 = 实现缺陷）。若响应层直接透传 `null`，
 * 会得到「状态码缺失」的响应（实测形态：`status = undefined` / 前端无法按 5xx 报警）。
 * ⇒ 表内保留 `null`（脚本语义不变），**响应层一律走本函数**：`defect` 类码兜底 `500`（R105/R108）。
 */
export const httpStatusOf = (code: LedgerErrorCode): number =>
  isBenignLedgerCode(code)
    ? BENIGN_HTTP_STATUS                                    // R106 良性结果：200，**不**走 500 兜底
    : LEDGER_ERROR_TABLE[code].status ?? 500;

/** details 只允许非敏感标量/数组（R107） */
export type LedgerErrorDetails = Record<string, string | number | boolean | null | undefined>;

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  /** HTTP 状态码（R105）；null = 非 HTTP（对账脚本语义） */
  readonly status: number | null;
  /**
   * **HTTP 响应层必须用的状态**（R105 + 兜底规则）：`status ?? 500`。
   * `status = null` 只对脚本有意义（§11 R88），**不得**透传到 HTTP（会变成缺状态码的响应）；
   * `defect` 类码（如 LD032 对账不符）一律兜底 `500`（R108 必须告警）。见 `httpStatusOf`。
   */
  readonly httpStatus: number;
  /** i18n key：`ledger.err.<CODE>`（D4） */
  readonly i18nKey: string;
  readonly details: LedgerErrorDetails;

  constructor(code: LedgerErrorCode, details: LedgerErrorDetails = {}) {
    const meta = LEDGER_ERROR_TABLE[code] as LedgerErrorMeta;
    super(meta.message);
    this.name = 'LedgerError';
    this.code = code;
    this.status = meta.status;
    this.httpStatus = httpStatusOf(code);
    this.i18nKey = `ledger.err.${code}`;
    this.details = details;
  }
}

export const isLedgerError = (e: unknown): e is LedgerError => e instanceof LedgerError;

/** R107 统一错误响应结构 */
export interface LedgerErrorResponse {
  error: {
    code: LedgerErrorCode;
    message: string;
    i18n_key: string;
    details: LedgerErrorDetails;
  };
}

/**
 * R107 统一错误响应体。
 * ⚠️ **HTTP 状态码一律取 `isLedgerError(e) ? e.httpStatus : 500`（= `status ?? 500`）**，
 *    **不得**用 `err.status` 直接写响应：`status = null` 是脚本退出码语义（§11 R88），
 *    透传到 HTTP 会得到「缺状态码」的响应（现实例：`LD032` / `LEDGER_RECONCILE_MISMATCH`，
 *    由 `0007` 的佣金守恒断言抛出）。见 `httpStatusOf`。
 */
export const toErrorResponse = (e: unknown): LedgerErrorResponse => {
  const err = isLedgerError(e) ? e : normalizeLedgerError(e);
  return {
    error: {
      code: err.code,
      message: err.message,
      i18n_key: err.i18nKey,
      details: err.details,
    },
  };
};

// ---------------------------------------------------------------- PG 错误 → §14 映射
interface PgErrorLike {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
  detail?: unknown;
}

/**
 * P3W（Unit H · Kong）：**守卫读取** —— 分类路径上对 `e` 的任何属性读取都可能踩到会抛的 getter
 * 或 Proxy trap（Unit G §6.3 实测：`message` getter 抛 ⇒ 修前修后**分类器整体抛**，
 * `classifyNonPgError` / `normalizeLedgerError` 双双 THREW ⇒ 上层拿到一个非 §14 码的异常）。
 * 裁定（逐字执行）：读抛 ⇒ 该子句视为**不匹配**（返回 `undefined`），**绝不向上抛**；
 *   分类继续走下去 ⇒ 最终落一个**确定性**的 §14 码（本文件所有分支都覆盖 `code === ''` 的情形）。
 * ⚠️ 只读、**不改值**：非抛路径的返回值与 `e[key]` 逐字节相同（含 `null`/`0`/`false` 等 falsy 值）。
 */
const safeRead = (e: unknown, key: string): unknown => {
  if (e === null || (typeof e !== 'object' && typeof e !== 'function')) return undefined;
  try {
    return (e as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
};

const pgCode = (e: unknown): string => String(safeRead(e, 'code') ?? '');
const pgConstraint = (e: unknown): string => String(safeRead(e, 'constraint') ?? '');
const pgMessage = (e: unknown): string => String(safeRead(e, 'message') ?? '');
// ⚠️ `errName` **按单不动**（对外 `details.error_name` 的归一化值不得变；不在本单元范围内）。
const errName = (e: unknown): string => String((e as { name?: unknown })?.name ?? 'Error').slice(0, 64);

// ---------------------------------------------------------------------------
// P1c 收口（Zang 裁定）：**非 PG 错误**（驱动级 / 无 `code` 的裸 Error）单独归类
// ---------------------------------------------------------------------------
// 实测缺陷（P1b §2.4）：`@neondatabase/serverless` 的 WS 连接池在并发超过池 `max`
// （`db.ts` 默认 4）时，抛开一个**无 `code`** 的裸 `Error`（message = `timeout exceeded
// when trying to connect`，源自 `connectionTimeoutMillis`）。该错误原先被本文件的 `default`
// 兜底统一改写成 `LEDGER_TRANSACTION_REQUIRED`（500 类「实现缺陷」）——
// 于是**过载（503「暂时不可用、可重试」）被误报成 500**，污染 R108 的「500 必须告警」规则。
//
// 裁定（逐字执行）：
//   ① 不新增错误码（§14.1 关闭集不动）；连接/拿连接超时一律归 **`LEDGER_TX_TIMEOUT`（503）**
//      + 可机读 `details.reason = 'pool_connection_timeout'`（语义一致：系统繁忙、可重试）；
//   ② 其余无 `code` 的裸错误仍可保留 500 类语义，但 `details.reason` 必须写明可机读原因
//      （不得只留 `cause = 'non_pg_error'`）。

/** 连接池「拿连接」超时/耗尽（驱动原文，pg-pool 与 @neondatabase/serverless 共用此措辞） */
const POOL_CONNECTION_TIMEOUT_RE =
  /timeout exceeded when trying to connect|connection (acquisition )?timeout|timed out (while )?(acquiring|waiting for) (a )?connection|pool (is )?(full|exhausted)/i;

/** 驱动 / OS 级瞬时错误码（非 PG SQLSTATE）——同属 503「暂时不可用」语义 */
const DRIVER_TRANSIENT_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'EAI_AGAIN',
]);

/** 非 PG 错误的机器可读原因（R107：`details` 只放非敏感标量，值是枚举而非中文自由文本） */
export type NonPgErrorReason =
  /** 连接池过载 / 拿连接超时 ⇒ `LEDGER_TX_TIMEOUT`（503） */
  | 'pool_connection_timeout'
  /** 驱动 / OS 连接级错误 ⇒ `LEDGER_TX_TIMEOUT`（503） */
  | 'driver_connection_error'
  /** 其余无 `code` 的裸错误 ⇒ 仍 500 类，但带 reason/error_name */
  | 'unclassified_non_pg_error'
  /** 带非 SQLSTATE 码且未识别的错误 ⇒ 仍 500 类 */
  | 'unclassified_driver_error';

/** PG SQLSTATE 形状（5 位大写字母/数字），用于把 PG 错误与非 PG 错误分开 */
const isSqlstate = (code: string): boolean => /^[0-9A-Z]{5}$/.test(code);

// ---------------------------------------------------------------------------
// P1i（F3③）：**基础设施类** OK SQLSTATE → `LEDGER_TX_TIMEOUT`（503，可重试）
// ---------------------------------------------------------------------------
// 缺陷（P1e 质检 F3）：基础设施错误（资源不足 / 系统错误 / 内部错误 / 运维干预 / 连接类）
// 修前会落到本文件末尾的 500 类兜底 ⇒ 与「代码缺陷（R108 必须告警）」混为一谈，
// 调用方也无法区分「重试可能成功」与「重试必然失败」。
// 裁定（逐字执行）：与 DB 侧 `ledger_error_for_sqlstate`（0005 §C）的 `infra` 桶**同集同码** ——
//   53*（资源不足） / 58*（系统错误） / XX*（内部错误） / 57* 除 57014（运维干预）
//   / 08* 除 08P01（连接类） / 另有 25006（只读事务）与 3D000（库不可达）两条同样归 infra；
//   ⇒ 一律 `LEDGER_TX_TIMEOUT`（§14.1 已登记码，**不新增码**；与 503 的「系统繁忙、请稍后重试」语义一致）。
//   两个**排除**项（都不是瞬时故障，必须留在 500 类供 R108 告警）：
//     · `08P01` 启动协议参数错误 = 我方连接配置缺陷（如向 pooler 传 `options=`，实测被拒）；
//     · `57014` 语句超时/取消 —— 已在下面的 switch 归 `LEDGER_TX_TIMEOUT`（语义更精确，此处排除重复）。
const INFRA_SQLSTATE_REASONS: Record<string, string> = {
  '53300': 'too_many_connections',
  '53200': 'out_of_memory',
  '53100': 'disk_full',
  '57P01': 'admin_shutdown',
  '57P02': 'crash_shutdown',
  '57P03': 'cannot_connect_now',
  '58030': 'io_error',
  '25006': 'read_only_transaction',
  '3D000': 'database_unavailable',
};

/** 按 SQLSTATE 类别兜底的 infra reason（逐字对齐 0005 §C 的分类器输出） */
const INFRA_CLASS_REASONS: Record<string, string> = {
  '53': 'insufficient_resources',
  '57': 'operator_intervention',
  '58': 'system_error',
  '08': 'connection_error',
  XX: 'internal_error',
};

/**
 * 判「基础设施类」SQLSTATE ⇒ 返回可机读 reason；非 infra（含两个排除项）⇒ `null`。
 * 导出以便质检脚本直接取证分类逻辑（与 DB 侧分类器做同集对拍，不引入副作用）。
 */
export const infraSqlstateReason = (code: string): string | null => {
  if (INFRA_SQLSTATE_REASONS[code] !== undefined) return INFRA_SQLSTATE_REASONS[code];
  if (code === '08P01' || code === '57014') return null; // 见上方「两个排除项」
  return INFRA_CLASS_REASONS[code.slice(0, 2)] ?? null;
};

// ---------------------------------------------------------------------------
// P3T（Unit E · Kong）：**非 PG「事件对象族」**判据 —— 连接建立期故障不再冒充 500
// ---------------------------------------------------------------------------
// 缺陷（证据：`docs/audit/p3-p1o-500-rca.md` + `.p3s-artifacts/p3s-03-fold-repro-*.json` 的
// `three_state.RED_info_lost_500` = 9 项）：驱动连接建立期的故障以**事件对象**（`ws` 的 `ErrorEvent`）
// 形态冒上来 —— `message` 定义在**原型上的 getter**（实例**没有** own `message`）、**无 `name`、无 `code`**。
// 旧判据只认「`code` ∈ 瞬时集」或「`message` 命中正则」，事件对象两样都不占
// ⇒ `unclassified_non_pg_error`（不在 `TRANSIENT_NON_PG_REASONS`）
// ⇒ 跳过既有 503 通路（见下面 `normalizeLedgerError` 的 P1c 分支）
// ⇒ 落 `LEDGER_TRANSACTION_REQUIRED`（**LD024 / 500**）：违 `DL126`（500 类码只允许由不变式被破坏
// 触发且必须告警）—— 把**基础设施故障记成实现缺陷**，污染 R108 告警面、掩盖真因。
// 裁定（逐字执行）：事件对象族一律归**既有** `driver_connection_error`（**既有 reason、既有 503 通路**）；
// **不新增错误码、不动 §14 的 33 码闭集、不动状态映射表**。判据（任一成立）：
//   ① `e instanceof Event`（标准事件对象；Node ≥ 15 有全局 `Event`，DOM 亦有）；
//   ② `e.type === 'error'`（事件对象的判别位）；
//   ③ 读得到的 `message` 是字符串，但**不是 own 数据属性** —— 原型 getter / 自有 getter-only 访问器
//      （`ws` 的 `ErrorEvent` 正落这一条：驱动 `_connectionCallback` 的
//       `Cannot set property message of #<ErrorEvent>` 崩溃即源于「有 getter 无 setter」）。
// ⚠️ 判据**只读不写**：缓 `Object.freeze` 的事件对象同样命中（不得依赖给对象赋值）。
const isEventObjectFamily = (e: unknown): boolean => {
  if (e === null || typeof e !== 'object') return false;
  // ① 标准事件对象 **且** 判别位是 `error` —— 只看 `instanceof` 会把 `new Event('open'/'message')`
  //    这类**非错误**事件也吃进来（Unit G X2/X3 实测）；加 `type` 条件后它们释放，DOM 形误差事件仍命中。
  const EventCtor = (globalThis as { Event?: unknown }).Event;
  if (typeof EventCtor === 'function') {
    let isEvent = false;
    try {
      isEvent = e instanceof (EventCtor as new (...args: unknown[]) => object);
    } catch {
      isEvent = false; // `instanceof` 自身抛（Proxy trap 等）⇒ 本子句视为不匹配
    }
    if (isEvent && safeRead(e, 'type') === 'error') return true;
  }
  // ② 判别位：`type === 'error'`（**逐字不变**）—— 标准事件判别位。
  if (safeRead(e, 'type') === 'error') return true;
  // ③ 自有（own）**getter-only** 字符串 `message`：只有第一子句。
  //    ⚠️ 原第二子句 `desc === undefined && typeof message === 'string'` **已删除**（Unit H 收窄）：
  //    它把「`message` 不是 own 数据属性」等同于「是事件对象」，而 `Error.prototype.message === ''`
  //    是字符串 ⇒ `new Error()` / `new TypeError()` / 无参子类 / `Object.create(Error.prototype)`
  //    全被误判成事件族（9 例误捕中 7 例的唯一来源）⇒ 把 R108 的 500 缺陷告警静默降级成 503。
  let desc: PropertyDescriptor | undefined;
  try {
    desc = Object.getOwnPropertyDescriptor(e, 'message');
  } catch {
    return false; // 取自有描述符抛 ⇒ 本子句不匹配（绝不向上抛）
  }
  if (desc === undefined && typeof safeRead(e, 'message') === 'string') return true;
  return false;
};

/**
 * 分类「非 PG 错误」。返回 `null` ⇒ 是 PG SQLSTATE 或账本命名码，交给下面的 switch / 命名分支。
 * 导出以便质检脚本直接取证分类逻辑（不引入副作用）。
 */
export const classifyNonPgError = (e: unknown): NonPgErrorReason | null => {
  const code = pgCode(e);
  const message = pgMessage(e);
  if (code.startsWith('LEDGER_') || isSqlstate(code)) return null;
  // ⚠️ 顺序有讲究：池超时正则**先判**（它的 message 来自内层真因，reason 更精确：同样是 503、
  //    同样在既有 transient 集里）；随后才是事件对象族。事件对象族**不再**看 message 内容。
  if (POOL_CONNECTION_TIMEOUT_RE.test(message)) return 'pool_connection_timeout';
  if (isEventObjectFamily(e)) return 'driver_connection_error';
  if (DRIVER_TRANSIENT_CODES.has(code)
      || /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up|connection refused|connection closed|connection terminated/i.test(message)) {
    return 'driver_connection_error';
  }
  return code ? 'unclassified_driver_error' : 'unclassified_non_pg_error';
};

/** 归入 503 类的非 PG 原因（「暂时不可用、可重试」） */
const TRANSIENT_NON_PG_REASONS: NonPgErrorReason[] = ['pool_connection_timeout', 'driver_connection_error'];

// ---------------------------------------------------------------------------
// P3T（Unit E · Kong）：**R108 服务端诊断面**（原始信息只进服务端日志/告警）
// ---------------------------------------------------------------------------
// 裁定（逐字执行）：**允许**把原始 `message`（截断）、栈前几帧、`constructor.name`、`cause` 链
//   保留到**服务端日志 / 告警载荷（R108）**；**严禁**把原始 `message` / `stack` 写进对外
//   `LedgerError.details`（R107 —— 见 `normalizeLedgerError` 尾部「非账本错误**不外泄原始信息**」）。
// 为什么单开一个面：`details` 是**对外**的（`toErrorResponse`），`errName` 也只喂对外 details；
//   真因、栈、cause 链没有别的地方可去（`src/ledger.ts:98` 登记「R108 告警通道：仅提供
//   `isDefectError()` 判定，未接日志/指标」）。本函数就是那个**载荷**：调用方（进程内日志/告警
//   通道）拿到它，把「哪个形态崩的、怎么崩的」记下来，而对外响应仍只有 §14 的码 + 非敏感 details。
// ⚠️ **只读、无副作用、不参与 details 组装、不落任何 sink**（决定写哪儿是调用方的事）。
export interface LedgerErrorDiagnostics {
  /** 归一化后的 §14 码（对外那个） */
  code: string;
  http_status: number;
  /** 对外 `details.reason`（可机读原因）；无则 null */
  reason: string | null;
  /** 分类器给出的非 PG 原因（分类逻辑的独立取证） */
  non_pg_class: NonPgErrorReason | null;
  /** ②要求的 `constructor.name`（`ErrorEvent` 与 `Error` 由此可辨） */
  constructor_name: string;
  /** 诊断侧错误形态名（与 `details.error_name` 同源，仅供日志比对） */
  error_name: string;
  /** 是否命中「事件对象族」判据（见上方 `isEventObjectFamily`） */
  event_object_family: boolean;
  /** 原始 message（截断 `DIAG_MESSAGE_MAX`；超长尾部标 `…[全长]`） */
  message: string | null;
  /** 栈前 `DIAG_STACK_FRAMES` 帧（每帧截断 `DIAG_LINE_MAX`）；无栈则 null */
  stack_head: string[] | null;
  /** `cause` / `error`（`ErrorEvent` 内层）链，最多 `DIAG_CAUSE_DEPTH` 层 */
  cause_chain: Array<{ constructor_name: string; message: string | null; code: string | null }>;
}

const DIAG_MESSAGE_MAX = 200;
const DIAG_STACK_FRAMES = 5;
const DIAG_CAUSE_DEPTH = 5;
const DIAG_LINE_MAX = 300;

/** 安全读 message（getter 可能抛；`ErrorEvent` 的 message 就在原型上） */
const safeMessage = (v: unknown): string => {
  try {
    return pgMessage(v);
  } catch {
    return '';
  }
};

const truncateText = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? (v.length > max ? `${v.slice(0, max)}…[${v.length}]` : v) : null;

const stackHeadOf = (e: unknown): string[] | null => {
  let s: unknown;
  try {
    s = (e as { stack?: unknown })?.stack;
  } catch {
    return null;
  }
  if (typeof s !== 'string' || s === '') return null;
  return s.split('\n').slice(0, DIAG_STACK_FRAMES).map((l) => l.trim().slice(0, DIAG_LINE_MAX));
};

const ctorNameOf = (e: unknown): string => {
  const n = (e as { constructor?: { name?: unknown } })?.constructor?.name;
  return typeof n === 'string' && n !== '' ? n.slice(0, 64) : 'unknown';
};

/**
 * 构造**服务端**诊断/告警载荷（R108）。**只准进服务端日志/告警，永不进对外 `details`（R107）**。
 * 导出的两个用途：① 进程内告警通道取证；② 质检脚本对拍（纯函数、无副作用）。
 */
export const ledgerErrorDiagnostics = (e: unknown): LedgerErrorDiagnostics => {
  const norm = normalizeLedgerError(e);
  const chain: LedgerErrorDiagnostics['cause_chain'] = [];
  const seen = new Set<unknown>([e]);
  // `cause` 是标准链；`error` 是 `ws` 的 `ErrorEvent` 装内层错误的地方（事件的「真因」）
  let cur: unknown = safeRead(e, 'cause') ?? safeRead(e, 'error');
  for (let i = 0; i < DIAG_CAUSE_DEPTH && typeof cur === 'object' && cur !== null && !seen.has(cur); i += 1) {
    seen.add(cur);
    chain.push({
      constructor_name: ctorNameOf(cur),
      message: truncateText(safeMessage(cur), DIAG_MESSAGE_MAX),
      code: pgCode(cur) || null,
    });
    cur = safeRead(cur, 'cause') ?? safeRead(cur, 'error');
  }
  const reason = (norm.details as { reason?: unknown } | undefined)?.reason;
  return {
    code: norm.code,
    http_status: norm.httpStatus,
    reason: typeof reason === 'string' ? reason : null,
    non_pg_class: classifyNonPgError(e),
    constructor_name: ctorNameOf(e),
    error_name: errName(e),
    event_object_family: isEventObjectFamily(e),
    message: truncateText(safeMessage(e), DIAG_MESSAGE_MAX) || null,
    stack_head: stackHeadOf(e),
    cause_chain: chain,
  };
};

/**
 * 把 DB 层抛出的原始错误归类到 §14 错误码。
 * 目的：`500` 四兄弟（R108）能真正落到「代码缺陷」语义上，而不是裸 pg 错误冒到路由层。
 *
 * P1c 收口后新增前置分支：**非 PG 错误**（驱动级 / 无 `code` 的裸 Error）单独归类，
 * 不再无差别落入 500 类兜底（见文件上方「P1c 收口」注释块）。
 */
export const normalizeLedgerError = (e: unknown): LedgerError => {
  if (isLedgerError(e)) return e;
  const code = pgCode(e);
  const constraint = pgConstraint(e);
  const message = pgMessage(e);

  // db.ts 基础设施已把超时/死锁归到 §14 命名（R82/R60）
  if (code === 'LEDGER_LOCK_TIMEOUT' || code === 'LEDGER_TX_TIMEOUT' || code === 'LEDGER_DEADLOCK_RETRY_EXHAUSTED'
      || code === 'LEDGER_TRANSACTION_REQUIRED') {
    return new LedgerError(code as LedgerErrorCode);
  }

  // --- P1c：驱动级 / 非 PG 错误先归类（绝不再让「过载」冒充 500 实现缺陷）
  const nonPgReason = classifyNonPgError(e);
  if (nonPgReason !== null && TRANSIENT_NON_PG_REASONS.includes(nonPgReason)) {
    // 连接池过载 / 拿连接超时 / 驱动连接级错误 ⇒ 503「暂时不可用、可重试」
    // 裁定：不新增错误码，统一借 LEDGER_TX_TIMEOUT（503）+ 可机读 reason
    return new LedgerError('LEDGER_TX_TIMEOUT', {
      reason: nonPgReason,
      ...(nonPgReason === 'pool_connection_timeout'
        ? { source: 'connection_pool' }
        : { error_code: code || 'none' }),
    });
  }

  switch (code) {
    case '23514': // check_violation
      if (constraint === 'account_bal_guard' || constraint === 'account_frz_guard'
          || constraint === 'ledger_after_guard') {
        return new LedgerError('LEDGER_NEGATIVE_BALANCE_GUARD', { constraint });
      }
      if (constraint === 'currency_supply_guard') {
        return new LedgerError('LEDGER_SUPPLY_CAP_EXCEEDED', { constraint });
      }
      if (constraint === 'ledger_kind_enum') return new LedgerError('LEDGER_UNKNOWN_KIND', { constraint });
      return new LedgerError('LEDGER_AMOUNT_INVALID', { constraint: constraint || 'unknown_check' });
    case '23505': // unique_violation
      if (constraint === 'ledger_idem_uniq') return new LedgerError('LEDGER_IDEMPOTENCY_CONFLICT', { constraint });
      return new LedgerError('LEDGER_AMOUNT_INVALID', { constraint: constraint || 'unknown_unique' });
    case '23503': // foreign_key_violation
      return new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { constraint: constraint || 'fk' });
    case '55P03':
      return new LedgerError('LEDGER_LOCK_TIMEOUT');
    case '57014':
      return new LedgerError('LEDGER_TX_TIMEOUT');
    case '40001':
    case '40P01':
      return new LedgerError('LEDGER_DEADLOCK_RETRY_EXHAUSTED');
    case '08P01': // 启动协议参数错误：我方连接配置缺陷（**不是**瞬时故障）⇒ 500 类（R108 告警）
      return new LedgerError('LEDGER_TRANSACTION_REQUIRED', {
        cause: '08P01', reason: 'protocol_violation',
        error_name: 'ProtocolViolation', pg_code: '08P01',
      });
    case 'P0001': // trigger 主动 RAISE
      if (/append-only/i.test(message)) return new LedgerError('LEDGER_APPEND_ONLY_VIOLATION');
      if (/account\b|account rows|must start at 0\/0|without any ledger_entry/i.test(message)) {
        return new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION');
      }
      break;
    default:
      break;
  }

  // --- P1i（F3③）：基础设施类 ⇒ 503（可重试），**不得**落 500（见上方 INFRA_* 注释块）
  const infraReason = infraSqlstateReason(code);
  if (infraReason !== null) {
    return new LedgerError('LEDGER_TX_TIMEOUT', {
      reason: infraReason, pg_code: code, retryable: true, source: 'pg_infra_class',
    });
  }

  // 兜底：非账本错误不外泄原始信息（R107），但仍要能被上层区分。
  // P1c 收口：**必须**带可机读 `reason`（不得只留 `cause='non_pg_error'`），并登记错误形态
  // （name / 原始 code），否则 500 告警（R108）无法定位「哪个不变量被破坏」。
  if (nonPgReason !== null) {
    return new LedgerError('LEDGER_TRANSACTION_REQUIRED', {
      cause: 'non_pg_error',
      reason: nonPgReason,
      error_name: errName(e),
      error_code: code || 'none',
    });
  }

  return new LedgerError('LEDGER_TRANSACTION_REQUIRED', {
    cause: code || 'non_pg_error',
    reason: 'unclassified_pg_error',
    error_name: errName(e),
    pg_code: code || 'none',
  });
};
