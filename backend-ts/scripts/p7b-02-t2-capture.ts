/**
 * p7b-02 · T-2 捕获机制（★ 必测项）+ AC-14 传播机制 + AC-11 锁争用机制面
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p7b-02-t2-capture.ts
 * 读数：`.p7b-artifacts/p7b-02-*`（run-tagged）
 *
 * ★ 必测项（派单硬约束 4）：**服务端 PL/pgSQL 内 `GET STACKED DIAGNOSTICS … PG_EXCEPTION_DETAIL`
 *   是否真能取到 `ledger_raise` 的 `reason`** —— 先例（`0004:1094` / `0008:88`）是**转引**；
 *   本脚本对**真实既有** `public.listing_post_event(op='refund')` 的 `LD011` 状态机闸**实测**。
 *   （**不需要** `0024` apply：抛出点在既有 `0015`。）
 *
 * 全部在**回滚事务**内跑 ⇒ 真库零位移（前后指纹逐字相等自证）。
 */
import { mkPool, raw, raw1, inRollbackTx, save, checker, pgErr, sp, type Qx } from './p7b-lib';

const fingerprintLedger = async (ex: Qx) => ({
  ledger_entry: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry`))?.n,
  purchase_refund: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE kind='purchase_refund'`))?.n,
  listing_order_1: JSON.stringify(await raw(ex, `SELECT status, pay_txid::text AS pay_txid FROM public.listing_order WHERE order_id=1`)),
  listing_order_3: JSON.stringify(await raw(ex, `SELECT status, refund_txid::text AS refund_txid FROM public.listing_order WHERE order_id=3`)),
  probe_fns: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'p7b_probe_%'`))?.n,
});

(async () => {
  const p = mkPool(3);
  const ck = checker();
  const out: Record<string, unknown> = { script: 'scripts/p7b-02-t2-capture.ts' };

  try {
    out.fp_before = await fingerprintLedger(p);

    // ========================================================================
    // ① ★ 必测项：真实 `listing_post_event(op='refund')` 的 LD011 是否带 DETAIL.reason
    // ========================================================================
    const t2 = await inRollbackTx(p, async (c) => {
      const r: Record<string, unknown> = {};
      // --- 场景 A：order 1（status='created'）⇒ 状态机拒绝 reason=order_not_refundable
      //     plpgsql 的 RAISE NOTICE 不回传 ⇒ 用具名临时表收集（同一事务内）
      await c.query(`CREATE TEMP TABLE IF NOT EXISTS p7b_t2_out(k text primary key, v text) ON COMMIT DROP`);
      await c.query(`TRUNCATE p7b_t2_out`);
      await c.query(`
        DO $do$
        DECLARE v_state text; v_msg text; v_detail text; v_reason text;
        BEGIN
          BEGIN
            PERFORM public.listing_post_event(jsonb_build_object(
              'op','refund','order_id','1','request_fingerprint','p7b:t2:fp:1','memo','p7b t2'));
          EXCEPTION WHEN SQLSTATE 'LD011' THEN
            GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
            v_reason := substring(v_detail from '"reason"[[:space:]]*:[[:space:]]*"([^"]*)"');
            INSERT INTO p7b_t2_out(k,v) VALUES ('state', COALESCE(v_state,'<null>')), ('msg', COALESCE(v_msg,'<null>')),
              ('reason', COALESCE(v_reason,'<null>')), ('detail', COALESCE(v_detail,'<null>'))
              ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
          END;
        END $do$;`);
      r['A_state_machine'] = await raw(c, `SELECT k, v FROM p7b_t2_out ORDER BY k`);

      // --- 场景 B：order_pay_missing（把 order 1 在**事务内**改成 status='paid' 且 pay_txid NULL）
      await c.query(`UPDATE public.listing_order SET status='paid', pay_txid=NULL WHERE order_id=1`);
      await c.query(`TRUNCATE p7b_t2_out`);
      await c.query(`
        DO $do$
        DECLARE v_detail text; v_reason text;
        BEGIN
          BEGIN
            PERFORM public.listing_post_event(jsonb_build_object(
              'op','refund','order_id','1','request_fingerprint','p7b:t2:fp:1b','memo','p7b t2b'));
          EXCEPTION WHEN SQLSTATE 'LD011' THEN
            GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
            v_reason := substring(v_detail from '"reason"[[:space:]]*:[[:space:]]*"([^"]*)"');
            INSERT INTO p7b_t2_out(k,v) VALUES ('reason', COALESCE(v_reason,'<null>')), ('detail', COALESCE(v_detail,'<null>'))
              ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
          END;
        END $do$;`);
      r['B_pay_missing'] = await raw(c, `SELECT k, v FROM p7b_t2_out ORDER BY k`);

      // --- 场景 C：订单不存在 ⇒ LD022（**非** LD011 ⇒ 不该被白名单捕获）
      await c.query(`TRUNCATE p7b_t2_out`);
      const notFound = await sp(c, () => c.query(`
        DO $do$
        BEGIN
          BEGIN
            PERFORM public.listing_post_event(jsonb_build_object(
              'op','refund','order_id','999999999','request_fingerprint','x','memo','x'));
          EXCEPTION WHEN SQLSTATE 'LD011' THEN
            INSERT INTO p7b_t2_out(k,v) VALUES ('caught','LD011') ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v;
          END;
        END $do$;`));
      r['C_404'] = { error: pgErr(notFound.error), table: await raw(c, `SELECT k, v FROM p7b_t2_out ORDER BY k`) };
      return r;
    });
    out.t2 = t2.result;
    out.t2_error = t2.error ? pgErr(t2.error) : null;

    const A = ((t2.result as Record<string, unknown>)?.['A_state_machine'] ?? []) as Array<{ k: string; v: string }>;
    const B = ((t2.result as Record<string, unknown>)?.['B_pay_missing'] ?? []) as Array<{ k: string; v: string }>;
    const get = (rows: Array<{ k: string; v: string }>, k: string) => rows.find((x) => x.k === k)?.v ?? '<missing>';
    ck.t('T2-A-state', '★ 必测项：真实 refund 的 LD011 可被 SQLSTATE 捕获', get(A, 'state') === 'LD011', `state=${get(A, 'state')}`);
    ck.t('T2-A-detail', '★ 必测项：PG_EXCEPTION_DETAIL 真能取到 DETAIL（非空）', get(A, 'detail') !== '<null>' && get(A, 'detail') !== '<missing>', `detail=${get(A, 'detail')}`);
    ck.t('T2-A-reason', '★ 必测项：reason 解析 = order_not_refundable', get(A, 'reason') === 'order_not_refundable', `reason=${get(A, 'reason')}`);
    ck.t('T2-B-reason', '同码异 reason：order_pay_missing（白名单第二项）', get(B, 'reason') === 'order_pay_missing', `reason=${get(B, 'reason')}`);
    const c404 = ((t2.result as Record<string, unknown>)?.['C_404'] ?? {}) as { error?: { sqlstate?: string | null } };
    ck.t('T2-C-404', 'LD022（404）**不**被 LD011 白名单捕获（保持传播）', c404.error?.sqlstate === 'LD022', JSON.stringify((t2.result as Record<string, unknown>)?.['C_404']));

    // ========================================================================
    // ② AC-14 机制面：白名单捕获 vs 兜底子句（注入 53300 / XX000）
    // ========================================================================
    const ac14 = await inRollbackTx(p, async (c) => {
      await c.query(`CREATE OR REPLACE FUNCTION public.p7b_probe_throw(p_code text, p_detail text) RETURNS void
        LANGUAGE plpgsql AS $f$
        BEGIN
          RAISE EXCEPTION 'p7b probe' USING ERRCODE = p_code, DETAIL = p_detail;
        END $f$;`);
      // 白名单版：只捕 LD011（与 0024 编排函数的子句**逐字同型**）
      await c.query(`CREATE OR REPLACE FUNCTION public.p7b_probe_capture(p_code text, p_detail text) RETURNS text
        LANGUAGE plpgsql AS $f$
        DECLARE v_d text;
        BEGIN
          BEGIN
            PERFORM public.p7b_probe_throw(p_code, p_detail);
          EXCEPTION WHEN SQLSTATE 'LD011' THEN
            GET STACKED DIAGNOSTICS v_d = PG_EXCEPTION_DETAIL;
            RETURN 'caught:' || COALESCE(v_d, '<null>');
          END;
          RETURN 'not-caught';
        END $f$;`);
      // 变异版：兜底子句（AC-14 判负对象）
      await c.query(`CREATE OR REPLACE FUNCTION public.p7b_probe_capture_mut(p_code text, p_detail text) RETURNS text
        LANGUAGE plpgsql AS $f$
        DECLARE v_d text;
        BEGIN
          BEGIN
            PERFORM public.p7b_probe_throw(p_code, p_detail);
          EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_d = PG_EXCEPTION_DETAIL;
            RETURN 'caught:' || COALESCE(v_d, '<null>');
          END;
          RETURN 'not-caught';
        END $f$;`);
      const one = async (fn: string, code: string, detail: string) => {
        const res = await sp(c, async () => (await raw1<{ v: string }>(c, `SELECT public.${fn}($1,$2) AS v`, [code, detail])));
        return res.ok ? { value: res.value?.v ?? '<null>', error: null } : { value: null, error: pgErr(res.error) };
      };
      return {
        whitelist_LD011: await one('p7b_probe_capture', 'LD011', '{"reason":"order_not_refundable"}'),
        whitelist_53300: await one('p7b_probe_capture', '53300', '{"reason":"too_many_connections"}'),
        whitelist_XX000: await one('p7b_probe_capture', 'XX000', '{"reason":"internal_error"}'),
        whitelist_LD022: await one('p7b_probe_capture', 'LD022', '{"reason":"order_not_found"}'),
        mutant_53300: await one('p7b_probe_capture_mut', '53300', '{"reason":"too_many_connections"}'),
        mutant_XX000: await one('p7b_probe_capture_mut', 'XX000', '{"reason":"internal_error"}'),
      };
    });
    out.ac14_mechanism = ac14.result;
    out.ac14_error = ac14.error ? pgErr(ac14.error) : null;
    const a14 = (ac14.result ?? {}) as Record<string, { value: string | null; error: { sqlstate: string | null } | null }>;
    ck.t('AC14-mech-1', '白名单版：LD011 被捕获', String(a14.whitelist_LD011?.value ?? '').startsWith('caught:'), JSON.stringify(a14.whitelist_LD011));
    ck.t('AC14-mech-2', '★ 白名单版：53300 **向上抛**（不得被吞）', a14.whitelist_53300?.error?.sqlstate === '53300', JSON.stringify(a14.whitelist_53300));
    ck.t('AC14-mech-3', '★ 白名单版：XX000 **向上抛**（不得被吞）', a14.whitelist_XX000?.error?.sqlstate === 'XX000', JSON.stringify(a14.whitelist_XX000));
    ck.t('AC14-mech-4', '白名单版：LD022（404 面）亦向上抛（射程 = 只 LD011）', a14.whitelist_LD022?.error?.sqlstate === 'LD022', JSON.stringify(a14.whitelist_LD022));
    ck.t('AC14-mech-5', '★ 判负自证：兜底子句变体会把 53300/XX000 吞成「被捕获」', String(a14.mutant_53300?.value ?? '').startsWith('caught:') && String(a14.mutant_XX000?.value ?? '').startsWith('caught:'), JSON.stringify({ m53300: a14.mutant_53300, mXX000: a14.mutant_XX000 }));

    // ========================================================================
    // ③ AC-11 机制面：`0015:670` 的 `FOR UPDATE` 行锁真能串行化同订单退款
    // ========================================================================
    const lock = await (async () => {
      const a = await p.connect();
      const b = await p.connect();
      const r: Record<string, unknown> = {};
      try {
        await a.query('BEGIN');
        await a.query('SELECT * FROM public.listing_order WHERE order_id=3 FOR UPDATE');
        await b.query('BEGIN');
        const t0 = Date.now();
        const pB = b.query('SELECT * FROM public.listing_order WHERE order_id=3 FOR UPDATE').then(() => Date.now() - t0).catch((e) => ({ error: pgErr(e).sqlstate }));
        await new Promise((res) => setTimeout(res, 700));
        const bDoneEarly = await Promise.race([pB, Promise.resolve('BLOCKED')]);
        r['b_before_release'] = bDoneEarly === 'BLOCKED' ? 'BLOCKED' : `DONE(${bDoneEarly})`;
        await a.query('ROLLBACK'); // 释放行锁
        const waited = await pB;
        r['b_wait_ms'] = typeof waited === 'number' ? waited : waited;
        await b.query('ROLLBACK');
      } finally {
        await a.query('ROLLBACK').catch(() => undefined);
        await b.query('ROLLBACK').catch(() => undefined);
        a.release();
        b.release();
      }
      return r;
    })();
    out.lock_contention = lock;
    ck.t('AC11-lock', '★ 同订单并发 `FOR UPDATE` 被串行化（B 阻塞至 A 释放）', lock['b_before_release'] === 'BLOCKED' && typeof lock['b_wait_ms'] === 'number' && (lock['b_wait_ms'] as number) >= 500, JSON.stringify(lock));

    // ========================================================================
    // ④ 零残留自证
    // ========================================================================
    out.fp_after = await fingerprintLedger(p);
    ck.t('Z-1', '★ 零位移：前后指纹逐字相等（含 ledger_entry / listing_order / 探针函数）', JSON.stringify(out.fp_before) === JSON.stringify(out.fp_after), JSON.stringify({ before: out.fp_before, after: out.fp_after }));
  } finally {
    await p.end().catch(() => undefined);
  }

  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p7b-02-t2-capture', out);
  console.log(JSON.stringify({ saved: f, summary: out.summary, t2: out.t2, ac14: out.ac14_mechanism, lock: out.lock_contention, fp_same: JSON.stringify(out.fp_before) === JSON.stringify(out.fp_after) }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
