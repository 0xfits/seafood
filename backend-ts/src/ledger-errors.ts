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

/** details 只允许非敏感标量/数组（R107） */
export type LedgerErrorDetails = Record<string, string | number | boolean | null | undefined>;

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  /** HTTP 状态码（R105）；null = 非 HTTP（对账脚本语义） */
  readonly status: number | null;
  /** i18n key：`ledger.err.<CODE>`（D4） */
  readonly i18nKey: string;
  readonly details: LedgerErrorDetails;

  constructor(code: LedgerErrorCode, details: LedgerErrorDetails = {}) {
    const meta = LEDGER_ERROR_TABLE[code] as LedgerErrorMeta;
    super(meta.message);
    this.name = 'LedgerError';
    this.code = code;
    this.status = meta.status;
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

const pgCode = (e: unknown): string => String((e as PgErrorLike)?.code ?? '');
const pgConstraint = (e: unknown): string => String((e as PgErrorLike)?.constraint ?? '');
const pgMessage = (e: unknown): string => String((e as PgErrorLike)?.message ?? '');

/**
 * 把 DB 层抛出的原始错误归类到 §14 错误码。
 * 目的：`500` 四兄弟（R108）能真正落到「代码缺陷」语义上，而不是裸 pg 错误冒到路由层。
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
    case 'P0001': // trigger 主动 RAISE
      if (/append-only/i.test(message)) return new LedgerError('LEDGER_APPEND_ONLY_VIOLATION');
      if (/account\b|account rows|must start at 0\/0|without any ledger_entry/i.test(message)) {
        return new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION');
      }
      break;
    default:
      break;
  }

  // 兜底：非账本错误不外泄原始信息（R107），但仍要能被上层区分
  return new LedgerError('LEDGER_TRANSACTION_REQUIRED', {
    cause: code || 'non_pg_error',
  });
};
