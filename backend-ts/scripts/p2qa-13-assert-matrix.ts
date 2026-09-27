/**
 * p2qa-13 · 修复轮复检（Neng）：F1 的**判据矩阵**（纯函数，零 DB 写入）
 * ============================================================================
 * 逐格验证 `assertReferralChainInvariants`：
 *   · 三个断言各自为 false ⇒ `details.failed_assertions` 精确点名（不是只报「有一个坏了」）
 *   · 三者同时 false ⇒ 全列 + failed_count = 3
 *   · `within_cap === false` 单独 ⇒ **不抛**（设计内）
 *   · 错误码 ∈ 既有闭集（33 码）、无新码、`httpStatusOf` ⇒ 500、bucket = defect
 */
import { save, RUN, sha256 } from './p2qa-lib';
import { assertReferralChainInvariants, COMMISSION_REASON, type ReferralChain } from '../src/commission';
import {
  LEDGER_ERROR_CODES, LEDGER_ERROR_BUCKETS, httpStatusOf, isLedgerErrorCode, LEDGER_ERROR_TABLE,
} from '../src/ledger-errors';

const chain = (a: Partial<ReferralChain['assertions']>): ReferralChain => ({
  nodes: [{ beneficiary_uid: '958701', level: 1 }], chain_depth: 1, truncated: false,
  assertions: { contiguous_levels: true, within_cap: true, all_user_uids: true, no_duplicate_uid: true, ...a },
});

const cell = (a: Partial<ReferralChain['assertions']>) => {
  try {
    assertReferralChainInvariants(chain(a), { worker_uid: '958701', job_id: '1' });
    return { assertions: a, threw: false };
  } catch (e) {
    const le = e as { code?: string; httpStatus?: number; status?: unknown; details?: Record<string, unknown> };
    return { assertions: a, threw: true, code: le.code, http_status: le.httpStatus, status_field: le.status,
      reason: le.details?.reason, failed_assertions: le.details?.failed_assertions,
      failed_count: le.details?.failed_count, worker_uid: le.details?.worker_uid };
  }
};

(async () => {
  const cells = {
    all_true: cell({}),
    only_within_cap_false: cell({ within_cap: false }),
    only_no_duplicate_false: cell({ no_duplicate_uid: false }),
    only_contiguous_false: cell({ contiguous_levels: false }),
    only_all_user_uids_false: cell({ all_user_uids: false }),
    duplicate_plus_contiguous: cell({ no_duplicate_uid: false, contiguous_levels: false }),
    all_three_false: cell({ no_duplicate_uid: false, contiguous_levels: false, all_user_uids: false }),
    within_cap_false_plus_all_three: cell({ within_cap: false, no_duplicate_uid: false,
      contiguous_levels: false, all_user_uids: false }),
  };
  const out: Record<string, unknown> = {
    script: 'scripts/p2qa-13-assert-matrix.ts', run: RUN,
    reason_constants: { CHAIN_ASSERTION_VIOLATED: COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED,
      LEDGER_REPLAY_INCONSISTENT: COMMISSION_REASON.LEDGER_REPLAY_INCONSISTENT },
    cells,
    code_closure: {
      count: LEDGER_ERROR_CODES.length,
      is_closed_set_33: LEDGER_ERROR_CODES.length === 33,
      CHAIN_ASSERTION_VIOLATED_is_not_a_code: !isLedgerErrorCode(COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED),
      LEDGER_REPLAY_INCONSISTENT_is_not_a_code: !isLedgerErrorCode(COMMISSION_REASON.LEDGER_REPLAY_INCONSISTENT),
      LD032_in_table: Object.prototype.hasOwnProperty.call(LEDGER_ERROR_TABLE, 'LEDGER_RECONCILE_MISMATCH'),
      http_status_of_LD032: httpStatusOf('LEDGER_RECONCILE_MISMATCH'),
      bucket_LD032: LEDGER_ERROR_BUCKETS.LEDGER_RECONCILE_MISMATCH,
    },
    verdict: {
      names_exact_failing_assertion: (cells.only_no_duplicate_false as Record<string, unknown>).failed_assertions === 'no_duplicate_uid'
        && (cells.only_contiguous_false as Record<string, unknown>).failed_assertions === 'contiguous_levels'
        && (cells.only_all_user_uids_false as Record<string, unknown>).failed_assertions === 'all_user_uids',
      all_three_named_and_counted: (cells.all_three_false as Record<string, unknown>).failed_count === 3
        && String((cells.all_three_false as Record<string, unknown>).failed_assertions).split(',').length === 3,
      within_cap_alone_not_rejected: (cells.only_within_cap_false as Record<string, unknown>).threw === false,
      within_cap_false_still_reports_others: (cells.within_cap_false_plus_all_three as Record<string, unknown>).threw === true
        && (cells.within_cap_false_plus_all_three as Record<string, unknown>).failed_count === 3,
      error_is_500_class: (cells.only_no_duplicate_false as Record<string, unknown>).http_status === 500,
      error_code_is_existing_closed_set_code: (cells.only_no_duplicate_false as Record<string, unknown>).code === 'LEDGER_RECONCILE_MISMATCH',
    },
  };
  const f = save('p2qa-13-assert-matrix', out);
  console.log(JSON.stringify({ saved: f, cells, verdict: out.verdict, code_closure: out.code_closure,
    reason_constants: out.reason_constants, probe_sha256: sha256(JSON.stringify(out)) }, null, 1));
})().catch((e) => { console.error('FATAL', String(e)); process.exit(1); });
