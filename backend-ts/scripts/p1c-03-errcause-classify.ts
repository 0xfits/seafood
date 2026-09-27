/**
 * P1c 第 1 件 · 归类矩阵单测（确定性，不依赖池过载的时序）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1c-03-errcause-classify.ts
 */
import { normalizeLedgerError, classifyNonPgError } from '../src/ledger-errors';
import { DbTxError } from '../src/db';

const bare = (message: string, name = 'Error'): Error => {
  const e = new Error(message);
  e.name = name;
  return e;
};
const coded = (code: string, message: string, extra: Record<string, unknown> = {}): Error =>
  Object.assign(new Error(message), { code, ...extra });

const cases: Array<{ label: string; err: unknown }> = [
  { label: '裸 Error: 连接池拿连接超时（实测驱动原文）', err: bare('timeout exceeded when trying to connect') },
  { label: '裸 Error: connection timeout 变体', err: bare('Connection timeout') },
  { label: '裸 Error: 池耗尽措辞', err: bare('pool is exhausted') },
  { label: '裸 Error: 与连接无关的普通异常', err: bare('boom: unexpected token') },
  { label: '裸 TypeError: 代码 bug 形态', err: bare('x is not a function', 'TypeError') },
  { label: 'syscall ECONNREFUSED（非 SQLSTATE）', err: coded('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:5432') },
  { label: 'DbTxError: db.ts 已命名的 TX 超时', err: new DbTxError('LEDGER_TX_TIMEOUT', '事务超时（statement_timeout）', '57014') },
  { label: 'PG 57014 (query_canceled)', err: coded('57014', 'canceling statement due to statement timeout') },
  { label: 'PG 55P03 (lock_not_available)', err: coded('55P03', 'canceling statement due to lock timeout') },
  { label: 'PG 40001 (serialization_failure)', err: coded('40001', 'could not serialize access') },
  { label: 'PG 23514 + account_bal_guard', err: coded('23514', 'new row violates check constraint', { constraint: 'account_bal_guard' }) },
  { label: 'PG 23505 + ledger_idem_uniq', err: coded('23505', 'duplicate key', { constraint: 'ledger_idem_uniq' }) },
  { label: 'PG 23514 + ledger_kind_enum（被删 kind）', err: coded('23514', 'new row violates check constraint', { constraint: 'ledger_kind_enum' }) },
  { label: 'PG P0001 trigger append-only', err: coded('P0001', 'ledger_entry is append-only: DELETE forbidden (txid=1)') },
  { label: 'PG P0001 trigger account_guard', err: coded('P0001', 'account rows are not deletable (uid=1, cid=1)') },
  { label: '未知 SQLSTATE XX000', err: coded('XX000', 'internal error') },
];

const rows = cases.map((c) => {
  const n = normalizeLedgerError(c.err);
  return {
    label: c.label,
    non_pg_reason: classifyNonPgError(c.err),
    code: n.code,
    status: n.status,
    details: n.details,
    is_500_class: n.status === 500,
  };
});

console.log(JSON.stringify({
  case: 'p1c-03-classification-matrix',
  rows,
  summary: {
    total: rows.length,
    status_500: rows.filter((r) => r.is_500_class).map((r) => r.label),
    status_503: rows.filter((r) => r.status === 503).map((r) => r.label),
    any_bare_error_in_500_class: rows.some((r) => r.is_500_class && r.non_pg_reason === 'pool_connection_timeout'),
    fallback_rows_missing_reason: rows.filter((r) => r.code === 'LEDGER_TRANSACTION_REQUIRED' && !r.details.reason).map((r) => r.label),
  },
}, null, 2));
