/**
 * p7b-07 · AC-11（R-B 三条替代判据 + R-C 自建夹具）
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && P7B_RUN=<run> npx ts-node --transpile-only scripts/p7b-07-ac11.ts
 * 读数：.p7b-artifacts/p7b-07-ac11-<RUN>.json
 *
 * 三条判据（逐条给读数）：
 *   (i)   源码级：position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0
 *   (ii)  竞争实测：两会话同订单 FOR UPDATE 并发 ⇒ 受害者阻塞时长 > 0
 *   (iii) 正向：并发两笔同订单退款 ⇒ 恰一次生效（另一笔 409 或 replay）+ 资金腿恰一次 + applied 审计恰 1 行
 */
import { mkPool, raw, raw1, save, pgErr, inRollbackTx, type Qx } from './p7b-lib';

const ORDER = 11; // f4（seller 900008 · buyer 900002 · 1×1 · paid）
const ACTOR = 900008; // 卖方
const ROOT = `biz:listing:refund:${ORDER}`;

const facts = async (ex: Qx) => ({
  purchase_refund: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE kind='purchase_refund'`))?.n,
  rootkey_rows: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key=$1`, [ROOT]))?.n,
  audit_applied: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.admin_refund_audit_log WHERE order_id=$1 AND result='applied'`, [String(ORDER)]))?.n,
  audit_rejected: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.admin_refund_audit_log WHERE order_id=$1 AND result='rejected_state'`, [String(ORDER)]))?.n,
  order_status: (await raw1<{ status: string; refund_txid: string | null }>(ex, `SELECT status, refund_txid::text AS refund_txid FROM public.listing_order WHERE order_id=$1`, [String(ORDER)])),
  sum_cid1: (await raw1<{ n: string }>(ex, `SELECT COALESCE(sum(balance),0)::text AS n FROM public.account WHERE cid=1`))?.n,
});

const callFn = async (ex: Qx, actor: number) => {
  const r = await ex.query(`SELECT public.listing_refund_post_event($1::jsonb) AS r`, [JSON.stringify({
    actor_uid: String(actor), op: 'refund', order_id: String(ORDER),
    request_fingerprint: `p7b:ac11:${ORDER}`, memo: `p7b ac11 refund:${ORDER}`,
  })]);
  const v = (r.rows[0] as { r: unknown })?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
};

(async () => {
  const p = mkPool(3);
  const out: Record<string, unknown> = { script: 'scripts/p7b-07-ac11.ts', order: ORDER, root_key: ROOT };
  try {
    // ================================================================ (i) 源码级
    out.criterion_i_source = await raw1(p, `SELECT
        (position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0) AS has_for_update_regproc,
        position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) AS pos_regproc,
        (position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) > 0) AS has_for_update_regprocedure,
        position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure)) AS pos_regprocedure,
        (length(pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure))
          - length(replace(pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure), 'FOR UPDATE', '')))
          / length('FOR UPDATE') AS for_update_count`);

    out.before = await facts(p);

    // ================================================================ (ii) 竞争实测
    const cA = await p.connect();
    const cB = await p.connect();
    try {
      await cA.query('BEGIN');
      await cA.query(`SELECT order_id FROM public.listing_order WHERE order_id=$1 FOR UPDATE`, [String(ORDER)]);
      await cB.query('BEGIN');
      const t0 = Date.now();
      const blocked = cB.query(`SELECT order_id FROM public.listing_order WHERE order_id=$1 FOR UPDATE`, [String(ORDER)]);
      let blockedMs = -1;
      let bErr: unknown = null;
      const waiter = blocked.then(() => { blockedMs = Date.now() - t0; }).catch((e) => { bErr = e; blockedMs = Date.now() - t0; });
      await new Promise((r) => setTimeout(r, 700));
      await cA.query('COMMIT');
      await waiter;
      out.criterion_ii_contention = { victim_blocked_ms: blockedMs, victim_error: bErr ? pgErr(bErr) : null };
      await cB.query('ROLLBACK').catch(() => undefined);
    } finally {
      cA.release(); cB.release();
    }

    // ================================================================ (iii) 并发两笔同订单
    const c1 = await p.connect();
    const c2 = await p.connect();
    try {
      const [r1, r2] = await Promise.allSettled([
        callFn(c1 as unknown as Qx, ACTOR),
        callFn(c2 as unknown as Qx, 900005 /* 第二发起人（管理员面 fixture，仍属合法 actor）*/),
      ]);
      const norm = (s: PromiseSettledResult<Record<string, unknown>>) =>
        s.status === 'fulfilled'
          ? { outcome: 'ok', ok: s.value.ok, result: s.value.result, idempotent_replay: s.value.idempotent_replay, txid: s.value.txid, reason: s.value.reason ?? null }
          : { outcome: 'threw', err: pgErr(s.reason) };
      out.criterion_iii_concurrent = { a: norm(r1), b: norm(r2) };
    } finally {
      c1.release(); c2.release();
    }

    const after = await facts(p);
    out.after = after;
    out.deltas = {
      purchase_refund: Number(after.purchase_refund) - Number(out.before && (out.before as any).purchase_refund),
      rootkey_rows: Number(after.rootkey_rows) - Number((out.before as any).rootkey_rows),
      audit_applied: Number(after.audit_applied) - Number((out.before as any).audit_applied),
      audit_rejected: Number(after.audit_rejected) - Number((out.before as any).audit_rejected),
      sum_cid1_shift: (BigInt(after.sum_cid1!) - BigInt((out.before as any).sum_cid1)).toString(),
      order_status_after: after.order_status,
    };
    out.verdict_iii = {
      exactly_one_effective: (out.deltas as any).rootkey_rows === 2 && (out.deltas as any).audit_applied === 1 && (out.deltas as any).audit_rejected === 0 && (out.deltas as any).sum_cid1_shift === '0' && (after.order_status as any)?.status === 'refunded',
    };
  } finally {
    await p.end().catch(() => undefined);
  }
  const f = save('p7b-07-ac11', out);
  console.log(JSON.stringify({ saved: f, i: out.criterion_i_source, ii: out.criterion_ii_contention, iii: out.criterion_iii_concurrent, deltas: out.deltas, verdict_iii: out.verdict_iii }, null, 1));
})().catch((e) => {
  console.error('FATAL', pgErr(e));
  process.exit(2);
});
