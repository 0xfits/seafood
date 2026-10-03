/**
 * P8⑥ 审计台实现单 · ② 统一读口 `GET /api/admin/audit/:table` 只读真跑冒烟（不启服务 · 不入 scripts/）。
 * 覆盖：
 *   · 白名单闭集 = 14 面（逐字集合相等 · 排除 app_config）；
 *   · 14 面逐表取数真跑（只读 SELECT · 默认 limit 50）⇒ 各表 rows 读数；
 *   · 负路径：非白名单 ⇒ 400 AUDIT_TABLE_NOT_FOUND；参数不适用 ⇒ 400 PARAM_NOT_APPLICABLE +
 *     supportedFilters；limit=101 ⇒ 400 LIMIT_OUT_OF_RANGE；坏游标 ⇒ 400 CURSOR_INVALID；
 *   · keyset：ledger_entry limit=5 两页（游标续读 · 无重叠 · 降序）；
 *   · R-9-76 原因码枚举（POINTS_ADJUST_REASONS）。
 * 全文只读；入 .p8s6-impl/（不入 scripts/ 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, closePools } from '../src/db';
import { DatabaseService } from '../src/database';
import {
  AUDIT_TABLES, AUDIT_TABLE_NAMES, AUDIT_LIMIT_DEFAULT, AUDIT_LIMIT_MAX,
  parseAuditRequest, buildAuditSql, buildAuditView, supportedFiltersOf,
} from '../src/audit-console';
import { POINTS_ADJUST_REASONS, isPointsAdjustReason } from '../src/points-adjust-reasons';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, '..', '.p8s6-impl');
fs.mkdirSync(OUT, { recursive: true });

const EXPECTED_14 = [
  'admin_ops_audit_log', 'admin_refund_audit_log', 'ledger_entry', 'currency_review_log',
  'currency_status_log', 'listing_review_log', 'job_arbitration_log', 'batt_entry',
  'checkin_log', 'checkin_makeup_log', 'rating', 'listing_order_event', 'referral', 'commission_policy',
];

type Row = Record<string, unknown>;

const runPage = async (table: string, query: Record<string, unknown>) => {
  const parsed = parseAuditRequest(table, query);
  if (!parsed.ok) return { ok: false as const, err: parsed.err };
  const { text, params } = buildAuditSql(parsed.plan);
  const rows = await DatabaseService.readAuditPage(text, params);
  return { ok: true as const, view: buildAuditView(parsed.plan, rows), text };
};

(async () => {
  const out: Record<string, unknown> = { unit: 'P8S6-AUDIT-READ-SMOKE', generated_at: new Date().toISOString(), run: RUN };

  // ① 白名单闭集逐字相等（14 · 排除 app_config）
  const names = [...AUDIT_TABLE_NAMES];
  out.whitelist = {
    count: names.length,
    exact_equal_expected_14: names.length === EXPECTED_14.length && EXPECTED_14.every((t) => names.includes(t)),
    has_app_config: names.includes('app_config'),
    names,
  };

  // ② 14 面逐表真跑（默认分页）
  const perTable: Record<string, unknown> = {};
  for (const t of AUDIT_TABLE_NAMES) {
    try {
      const r = await runPage(t, {});
      if (!r.ok) { perTable[t] = { ok: false, http: r.err.status, code: r.err.code, reason: r.err.details.reason }; continue; }
      const v = r.view as { rows: Row[]; nextCursor: string | null; capabilities: unknown };
      perTable[t] = { ok: true, rows: v.rows.length, has_next: v.nextCursor !== null, capabilities: v.capabilities };
    } catch (e) {
      perTable[t] = { ok: false, exec_err: String((e as Error)?.message || e).slice(0, 160) };
    }
  }
  out.per_table = perTable;

  // ③ 负路径
  const neg: Record<string, unknown> = {};
  {
    const r = await parseAuditRequest('app_config', {}); // 已裁出 ⇒ 非白名单
    neg.app_config_out = r.ok ? 'UNEXPECTED_OK' : { http: r.err.status, code: r.err.code, details: r.err.details };
    const r2 = await parseAuditRequest('made_up_table', {});
    neg.unknown_table = r2.ok ? 'UNEXPECTED_OK' : { http: r2.err.status, code: r2.err.code, details: r2.err.details };
    const r3 = await parseAuditRequest('ledger_entry', { actor: '1' }); // ledger_entry.actor = null ⇒ 不适用
    neg.param_not_applicable = r3.ok ? 'UNEXPECTED_OK' : { http: r3.err.status, code: r3.err.code, details: r3.err.details };
    const r4 = await parseAuditRequest('ledger_entry', { limit: '101' });
    neg.limit_101 = r4.ok ? 'UNEXPECTED_OK' : { http: r4.err.status, code: r4.err.code, details: r4.err.details };
    const r5 = await parseAuditRequest('ledger_entry', { cursor: 'not-a-cursor' });
    neg.bad_cursor = r5.ok ? 'UNEXPECTED_OK' : { http: r5.err.status, code: r5.err.code, details: r5.err.details };
    const r6 = await parseAuditRequest('ledger_entry', { from: 'not-a-date' });
    neg.bad_from = r6.ok ? 'UNEXPECTED_OK' : { http: r6.err.status, code: r6.err.code, details: r6.err.details };
    const r7 = await parseAuditRequest('ledger_entry', { refId: 'abc' });
    neg.bad_refid = r7.ok ? 'UNEXPECTED_OK' : { http: r7.err.status, code: r7.err.code, details: r7.err.details };
    const rDefault = await parseAuditRequest('ledger_entry', {});
    neg.default_limit = rDefault.ok ? (rDefault.plan.limit === AUDIT_LIMIT_DEFAULT ? 'default=50 OK' : 'BAD') : 'PARSE_FAIL';
  }
  out.negatives = neg;

  // ③b 逐表 supportedFilters（能力面 · 参数名清单）
  const caps: Record<string, unknown> = {};
  for (const t of AUDIT_TABLE_NAMES) caps[t] = supportedFiltersOf(AUDIT_TABLES[t]);
  out.supported_filters = caps;

  // ④ keyset 双页（ledger_entry）
  try {
    const p1 = await runPage('ledger_entry', { limit: '5' });
    if (p1.ok) {
      const v1 = p1.view as { rows: Row[]; nextCursor: string | null };
      const ids1 = v1.rows.map((r) => String(r.txid));
      const p2 = await runPage('ledger_entry', { limit: '5', cursor: v1.nextCursor ?? '' });
      const v2 = p2.ok ? (p2.view as { rows: Row[]; nextCursor: string | null }) : null;
      const ids2 = v2 ? v2.rows.map((r) => String(r.txid)) : [];
      out.keyset = {
        page1_rows: ids1.length, page1_has_next: v1.nextCursor !== null, page1_txids: ids1,
        page2_rows: ids2.length, page2_txids: ids2,
        overlap: ids1.filter((x) => ids2.includes(x)),
        descending_page1: ids1.every((x, i) => i === 0 || BigInt(ids1[i - 1]) > BigInt(x)),
      };
    }
  } catch (e) {
    out.keyset = { exec_err: String((e as Error)?.message || e).slice(0, 160) };
  }

  // ⑤ R-9-76 原因码枚举
  out.reasons = {
    count: POINTS_ADJUST_REASONS.length,
    values: [...POINTS_ADJUST_REASONS],
    accepts_valid: isPointsAdjustReason('MANUAL_CORRECTION'),
    rejects_bogus: isPointsAdjustReason('made_up'),
    rejects_empty: isPointsAdjustReason(''),
    rejects_old_free_text: isPointsAdjustReason('历史自由文本示例'),
  };

  fs.writeFileSync(path.join(OUT, `audit-read-smoke-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  const allTablesOk = AUDIT_TABLE_NAMES.every((t) => (perTable[t] as { ok?: boolean })?.ok === true);
  process.exit(out.whitelist && (out.whitelist as { exact_equal_expected_14: boolean }).exact_equal_expected_14 && allTablesOk ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 900)); await closePools().catch(() => undefined); process.exit(2); });
