/** P8⑥ · 过滤面正向真跑（只读）——证明五类过滤真的落到列上（非假过滤）。入 .p8s6-impl/。 */
import { readQuery, closePools } from '../src/db';
import { DatabaseService } from '../src/database';
import { parseAuditRequest, buildAuditSql, buildAuditView } from '../src/audit-console';

type Row = Record<string, unknown>;
const page = async (table: string, q: Record<string, unknown>) => {
  const p = parseAuditRequest(table, q);
  if (!p.ok) return { ok: false as const, err: p.err };
  const { text, params } = buildAuditSql(p.plan);
  const rows = await DatabaseService.readAuditPage(text, params);
  return { ok: true as const, view: buildAuditView(p.plan, rows) as { rows: Row[] } };
};

(async () => {
  const out: Record<string, unknown> = { unit: 'P8S6-FILTER-POS', generated_at: new Date().toISOString() };

  // admin_ops_audit_log：action='points_adjust'（恒值列）应命中全部 4 行；乱值应 0
  const a1 = await page('admin_ops_audit_log', { action: 'points_adjust' });
  const a2 = await page('admin_ops_audit_log', { action: '__none__' });
  out.admin_ops_action = { points_adjust_rows: a1.ok ? a1.view.rows.length : 'ERR', bogus_rows: a2.ok ? a2.view.rows.length : 'ERR' };

  // 时间窗：远未来 from ⇒ 0；远过去 to ⇒ 0
  const f1 = await page('ledger_entry', { from: '2999-01-01T00:00:00Z' });
  const f2 = await page('ledger_entry', { to: '2000-01-01T00:00:00Z' });
  out.time_window = { future_from_rows: f1.ok ? f1.view.rows.length : 'ERR', past_to_rows: f2.ok ? f2.view.rows.length : 'ERR' };

  // referral：取一行 child_uid，再按 target 过滤 ⇒ ≥1 且每行 child_uid 或 parent_uid 命中
  const rf0 = await page('referral', {});
  const first = rf0.ok ? rf0.view.rows[0] : null;
  if (first) {
    const child = String(first.child_uid);
    const rf1 = await page('referral', { target: child });
    const hit = rf1.ok ? rf1.view.rows.every((r) => String(r.child_uid) === child || String(r.parent_uid) === child) : false;
    out.referral_target = { child, filtered_rows: rf1.ok ? rf1.view.rows.length : 'ERR', all_match: hit };
  }

  // commission_policy：取一行 created_by，按 actor 过滤
  const cp0 = await page('commission_policy', {});
  const cpRow = cp0.ok ? cp0.view.rows[0] : null;
  if (cpRow) {
    const by = String(cpRow.created_by);
    const cp1 = await page('commission_policy', { actor: by });
    out.commission_actor = { created_by: by, filtered_rows: cp1.ok ? cp1.view.rows.length : 'ERR', all_match: cp1.ok ? cp1.view.rows.every((r) => String(r.created_by) === by) : false };
  }

  // ledger_entry：refId 过滤（取一行 ref_id 非空者）
  const le0 = await readQuery<Row>(`SELECT ref_id FROM public.ledger_entry WHERE ref_id IS NOT NULL LIMIT 1`);
  if (le0[0]) {
    const ref = String(le0[0].ref_id);
    const le1 = await page('ledger_entry', { refId: ref });
    out.ledger_refid = { ref_id: ref, filtered_rows: le1.ok ? le1.view.rows.length : 'ERR', all_match: le1.ok ? le1.view.rows.every((r) => String(r.ref_id) === ref) : false };
  }

  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
