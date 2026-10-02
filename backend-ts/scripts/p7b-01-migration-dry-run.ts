/**
 * p7b-01 · 迁移 `0024` **干跑** + 事务内行为读数 + apply-time 自检**变异判负**
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p7b-01-migration-dry-run.ts
 * 读数：`.p7b-artifacts/p7b-01-*`（run-tagged）
 *
 * 口径（派单硬约束）：
 *   · **不 apply 真库**：整份 `0024` 在一个**回滚事务**里执行（含其自检），跑完 `ROLLBACK`
 *     ⇒ 真库零位移（用「前后指纹逐字相等」自证）。
 *   · 事务内的行为读数（成功腿 / 幂等重投 / 被拒留痕）**不是** HTTP 面证据，只证明 DB 编排函数
 *     的**事务内**语义（HTTP 面 = 待 `0024` apply 后由 AC 脚本跑）。
 *   · 变异判负 = 把 `0024` 文本**在内存里**改坏（不改仓库文件）后重跑干跑 ⇒ 必红。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { mkPool, raw, raw1, inRollbackTx, save, checker, pgErr, sp, REPO_BACKEND, type Qx } from './p7b-lib';

const MIG = 'migrations/0024_admin_refund_audit.sql';
const SQL_TEXT = fs.readFileSync(path.resolve(REPO_BACKEND, MIG), 'utf8');

/** 真库指纹（**只读**）—— 干跑前后必须逐字相等 ⇒ 零位移自证 */
const fingerprint = async (ex: Qx) => ({
  base_tables: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`))?.n,
  triggers: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`))?.n,
  functions: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'`))?.n,
  indexes: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM pg_indexes WHERE schemaname='public'`))?.n,
  schema_migration_rows: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.schema_migration`))?.n,
  ledger_entry: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry`))?.n,
  purchase_refund: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE kind='purchase_refund'`))?.n,
  account_cid1_sum_balance: (await raw1<{ n: string }>(ex, `SELECT COALESCE(sum(balance),0)::text AS n FROM public.account WHERE cid=1`))?.n,
  account_cid1_sum_frozen: (await raw1<{ n: string }>(ex, `SELECT COALESCE(sum(frozen),0)::text AS n FROM public.account WHERE cid=1`))?.n,
  admin_refund_audit_log: (await raw1<{ n: string }>(ex, `SELECT to_regclass('public.admin_refund_audit_log')::text AS n`))?.n,
  listing_refund_fn: (await raw1<{ n: string }>(ex, `SELECT to_regprocedure('public.listing_refund_post_event(jsonb)')::text AS n`))?.n,
});

const callFn = async (ex: Qx, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await ex.query(`SELECT public.listing_refund_post_event($1::jsonb) AS r`, [JSON.stringify(payload)]);
  const v = (r.rows[0] as { r: unknown })?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
};

const auditRows = async (ex: Qx, orderId: number) =>
  raw(ex, `SELECT result, txid::text AS txid, idempotency_key, request_fingerprint, actor_uid::text AS actor_uid,
      seller_uid::text AS seller_uid, buyer_uid::text AS buyer_uid, cid::text AS cid, amount::text AS amount, memo
    FROM public.admin_refund_audit_log WHERE order_id = $1 ORDER BY log_id`, [String(orderId)]);

const ledgerFact = async (ex: Qx) => ({
  rows: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry`))?.n,
  purchase_refund: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE kind='purchase_refund'`))?.n,
  rootkey3: (await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key='biz:listing:refund:3'`))?.n,
});

(async () => {
  const p = mkPool(2);
  const ck = checker();
  const out: Record<string, unknown> = { script: 'scripts/p7b-01-migration-dry-run.ts', migration: MIG, sql_sha256: createHash('sha256').update(SQL_TEXT).digest('hex'), sql_bytes: SQL_TEXT.length };

  try {
    out.fingerprint_before = await fingerprint(p);
    const baseLedger = await ledgerFact(p);
    out.ledger_before = baseLedger;

    // ========================================================================
    // ① 干跑：整份 0024 在回滚事务里执行 + 事务内行为读数
    // ========================================================================
    const run = await inRollbackTx(p, async (c) => {
      const r: Record<string, unknown> = {};
      await c.query(SQL_TEXT); // 含 §D 自检：不通过这里就抛
      r['A_dry_run_executed'] = true;

      // ---- 结构面（事务内现取）
      r['A_columns'] = (await raw<{ column_name: string }>(c, `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='admin_refund_audit_log' ORDER BY ordinal_position`)).map((x) => x.column_name).join(',');
      r['A_fn_def_len'] = (await raw1<{ n: number }>(c, `SELECT length(pg_get_functiondef('public.listing_refund_post_event(jsonb)'::regprocedure))::int AS n`))?.n;

      // ---- AC-12 / AC-14 静态判据（在**真库函数定义**上复核，非源码文本）
      const defRow = await raw1<{ def: string }>(c, `SELECT pg_get_functiondef('public.listing_refund_post_event(jsonb)'::regprocedure) AS def`);
      const def = String(defRow?.def ?? '');
      r['AC12_purchase_refund_pos'] = def.indexOf('purchase_refund');
      r['AC12_listing_post_event_pos'] = def.indexOf('listing_post_event');
      r['AC12_admin_refund_audit_log_pos'] = def.indexOf('admin_refund_audit_log');
      r['AC14_when_others_pos'] = def.indexOf('WHEN OTHERS');
      r['AC14_exception_pos'] = def.indexOf('EXCEPTION');
      r['AC14_ld011_pos'] = def.indexOf('LD011');
      r['Z4b_pg_advisory_pos'] = def.indexOf('pg_advisory');
      r['Z3_raise_pos'] = def.indexOf('RAISE');
      r['state_field_pos'] = def.indexOf('rejected_state');
      ck.t('AC12-1', '函数体 position(purchase_refund)=0', def.indexOf('purchase_refund') === -1, `pos=${def.indexOf('purchase_refund')}`);
      ck.t('AC12-2', '函数体 position(listing_post_event)<>0', def.indexOf('listing_post_event') !== -1, `pos=${def.indexOf('listing_post_event')}`);
      ck.t('AC14-1', '函数体 position(WHEN OTHERS)=0', def.indexOf('WHEN OTHERS') === -1, `pos=${def.indexOf('WHEN OTHERS')}`);
      ck.t('AC14-2', '函数体含 EXCEPTION + LD011 白名单', def.indexOf('EXCEPTION') !== -1 && def.indexOf('LD011') !== -1, `exc=${def.indexOf('EXCEPTION')} ld011=${def.indexOf('LD011')}`);
      ck.t('Z3-1', '函数体 position(RAISE)=0', def.indexOf('RAISE') === -1, `pos=${def.indexOf('RAISE')}`);
      ck.t('Z4b-1', '函数体 position(pg_advisory)=0', def.indexOf('pg_advisory') === -1, `pos=${def.indexOf('pg_advisory')}`);
      ck.t('Z3-2', '函数体含 rejected_state 留痕分支', def.indexOf('rejected_state') !== -1, `pos=${def.indexOf('rejected_state')}`);

      // ---- 成功腿：order 3（现成 paid / seller 7 / buyer 8 / 100×1）
      const payload = { actor_uid: '7', order_id: '3', request_fingerprint: 'p7b:dryrun:fp:3', memo: 'p7b dryrun refund:3' };
      const stockBefore = await raw1<{ stock: number }>(c, `SELECT stock FROM public.listing WHERE listing_id=13`);
      const led0 = await ledgerFact(c);
      const r1 = await callFn(c, payload);
      const led1 = await ledgerFact(c);
      const a1 = await auditRows(c, 3);
      r['B1_receipt'] = r1;
      r['B1_audit_rows'] = a1;
      r['B1_ledger_delta'] = { purchase_refund: Number(led1.purchase_refund) - Number(led0.purchase_refund), rows: Number(led1.rows) - Number(led0.rows) };
      r['B1_listing_order_3'] = await raw(c, `SELECT status, refund_txid::text AS refund_txid, pay_txid::text AS pay_txid,
          ledger_event_keys FROM public.listing_order WHERE order_id=3`);
      r['B1_listing_stock'] = await raw1<{ stock: number }>(c, `SELECT stock FROM public.listing WHERE listing_id=13`);
      const rr1 = ((r1['refund_receipt'] as Record<string, unknown>) ?? {});
      ck.t('B1-ok', '成功腿回执 ok=true / result=applied / audit_logged=true', r1['ok'] === true && r1['result'] === 'applied' && r1['audit_logged'] === true, JSON.stringify({ ok: r1['ok'], result: r1['result'], audit_logged: r1['audit_logged'] }));
      ck.t('B1-legs', 'Δpurchase_refund=+2', Number(led1.purchase_refund) - Number(led0.purchase_refund) === 2, `Δ=${Number(led1.purchase_refund) - Number(led0.purchase_refund)}`);
      ck.t('B1-audit1', '审计行恰 1 行 result=applied', a1.length === 1 && a1[0].result === 'applied', JSON.stringify(a1));
      ck.t('B1-txid', '审计行 txid 与大写回执 txid 逐字相同', String(a1[0]?.txid) === String(r1['txid']) && String(r1['txid'] ?? '') !== 'null', `audit=${a1[0]?.txid} fn=${r1['txid']}`);
      ck.t('B1-key', '审计行 idempotency_key = biz:listing:refund:3', a1[0]?.idempotency_key === 'biz:listing:refund:3', String(a1[0]?.idempotency_key));
      ck.t('B1-fields', '审计行 seller/buyer/cid/amount = 7/8/1/100', a1[0]?.seller_uid === '7' && a1[0]?.buyer_uid === '8' && a1[0]?.cid === '1' && a1[0]?.amount === '100', JSON.stringify(a1[0]));
      ck.t('B1-actor', '审计行 actor_uid = 发起人（token 侧）', a1[0]?.actor_uid === '7', String(a1[0]?.actor_uid));
      ck.t('B1-no-stock', '★ 不回滚库存：stock 前后逐字相等（AC-2）', String((r['B1_listing_stock'] as { stock: number })?.stock) === String(stockBefore?.stock), `before=${stockBefore?.stock} after=${(r['B1_listing_stock'] as { stock: number })?.stock}`);
      ck.t('B1-status', 'listing_order.status = refunded', String((r['B1_listing_order_3'] as Array<{ status: string }>)?.[0]?.status) === 'refunded', JSON.stringify(r['B1_listing_order_3']));
      ck.t('B1-sidekeys', '★ 两 actor 面差异仅在准入：回执 ledger_idempotency_key 仍为资金根键', rr1['ledger_idempotency_key'] === 'biz:listing:refund:3', String(rr1['ledger_idempotency_key']));

      // ---- 幂等：同键重投 ⇒ 200 重放 / 资金 delta 0 / 审计行不新增
      const r2 = await callFn(c, payload);
      const led2 = await ledgerFact(c);
      const a2 = await auditRows(c, 3);
      r['B2_receipt'] = r2;
      r['B2_ledger_delta'] = { rows: Number(led2.rows) - Number(led1.rows), purchase_refund: Number(led2.purchase_refund) - Number(led1.purchase_refund) };
      ck.t('B2-replay', '同键重投 ⇒ ok / idempotent_replay=true', r2['ok'] === true && r2['idempotent_replay'] === true, JSON.stringify({ ok: r2['ok'], replay: r2['idempotent_replay'] }));
      ck.t('B2-zero', '同键重投 ⇒ 资金 delta 0（rows / purchase_refund）', Number(led2.rows) === Number(led1.rows) && Number(led2.purchase_refund) === Number(led1.purchase_refund), JSON.stringify(r['B2_ledger_delta']));
      ck.t('B2-audit', '同键重投 ⇒ 审计行不新增（仍 1 行 applied）', a2.length === 1 && a2[0].result === 'applied', JSON.stringify(a2));
      ck.t('B2-txid', '同键重投 ⇒ txid 与首投逐字相同', String(a2[0]?.txid) === String(a1[0]?.txid), `a1=${a1[0]?.txid} a2=${a2[0]?.txid}`);

      // ---- 被拒留痕（AC-15）：order 1（status='created' / 无 pay_txid / **无既有退款根键**）
      const led3 = await ledgerFact(c);
      const r3 = await callFn(c, { actor_uid: '7', order_id: '1', request_fingerprint: 'p7b:dryrun:fp:1', memo: 'p7b dryrun refund:1' });
      const led4 = await ledgerFact(c);
      const a3 = await auditRows(c, 1);
      r['C1_receipt'] = r3;
      r['C1_audit_rows'] = a3;
      r['C1_ledger_delta'] = { rows: Number(led4.rows) - Number(led3.rows), purchase_refund: Number(led4.purchase_refund) - Number(led3.purchase_refund), rootkey1: String((await raw1<{ n: string }>(c, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key='biz:listing:refund:1'`))?.n) };
      r['C1_listing_order_1'] = await raw(c, `SELECT status, refund_txid::text AS refund_txid FROM public.listing_order WHERE order_id=1`);
      ck.t('C1-reject', '被拒 ⇒ ok=false / result=rejected_state / audit_logged=true', r3['ok'] === false && r3['result'] === 'rejected_state' && r3['audit_logged'] === true, JSON.stringify({ ok: r3['ok'], result: r3['result'], audit_logged: r3['audit_logged'] }));
      ck.t('C1-reason', '被拒 ⇒ reason=order_not_refundable（白名单）', r3['reason'] === 'order_not_refundable', String(r3['reason']));
      ck.t('C1-zerofunds', '被拒 ⇒ 零资金残留（Δledger_entry=0 / Δpurchase_refund=0 / 根键 0 行）', Number(led4.rows) === Number(led3.rows) && Number(led4.purchase_refund) === Number(led3.purchase_refund) && String((r['C1_ledger_delta'] as Record<string, unknown>)['rootkey1']) === '0', JSON.stringify(r['C1_ledger_delta']));
      ck.t('C1-audit+1', '被拒 ⇒ 审计行恰 1 行 rejected_state（与拒收回执一起提交）', a3.length === 1 && a3[0].result === 'rejected_state', JSON.stringify(a3));
      ck.t('C1-txidnull', '被拒审计行 txid = NULL', a3[0]?.txid === null, String(a3[0]?.txid));
      ck.t('C1-order-unchanged', '被拒 ⇒ listing_order.status 不变（仍 created）', String((r['C1_listing_order_1'] as Array<{ status: string }>)?.[0]?.status) === 'created', JSON.stringify(r['C1_listing_order_1']));
      // 同键重投被拒 ⇒ ON CONFLICT DO NOTHING ⇒ 不放大
      const r3b = await callFn(c, { actor_uid: '7', order_id: '1', request_fingerprint: 'p7b:dryrun:fp:1', memo: 'p7b dryrun refund:1' });
      const a4 = await auditRows(c, 1);
      r['C2_receipt'] = r3b;
      ck.t('C2-conflict', '★ 同键重投被拒 ⇒ ON CONFLICT DO NOTHING ⇒ 审计行仍 1 行（不放大）', a4.length === 1, `rows=${a4.length}`);

      // ---- 404 不留痕（T-3）：order_id 不存在 ⇒ LD022 传播、审计 Δ=0
      const before404 = (await raw1<{ n: string }>(c, `SELECT count(*)::text AS n FROM public.admin_refund_audit_log`))?.n;
      const call404 = await sp(c, () => callFn(c, { actor_uid: '7', order_id: '999999999', request_fingerprint: 'p7b:fp:404', memo: 'x' }));
      const err404 = call404.error;
      const after404 = (await raw1<{ n: string }>(c, `SELECT count(*)::text AS n FROM public.admin_refund_audit_log`))?.n;
      r['D1_err404'] = pgErr(err404);
      ck.t('D1-404-propagates', '订单不存在 ⇒ LD022 向上传播（不吞）', pgErr(err404).sqlstate === 'LD022', JSON.stringify(pgErr(err404)));
      ck.t('D1-404-nomark', '★ 404 不留痕 ⇒ 审计表 Δ=0', before404 === after404, `${before404}->${after404}`);

      // ---- append-only 触发器：UPDATE / DELETE 必被拒
      const upRes = await sp(c, () => c.query(`UPDATE public.admin_refund_audit_log SET memo='x' WHERE order_id=3`));
      const delRes = await sp(c, () => c.query(`DELETE FROM public.admin_refund_audit_log WHERE order_id=3`));
      r['E1_append_only'] = { update: pgErr(upRes.error), delete: pgErr(delRes.error) };
      ck.t('E1-ao-update', 'append-only：UPDATE 被拒（P0001）', pgErr(upRes.error).sqlstate === 'P0001', JSON.stringify(pgErr(upRes.error)));
      ck.t('E1-ao-delete', 'append-only：DELETE 被拒（P0001）', pgErr(delRes.error).sqlstate === 'P0001', JSON.stringify(pgErr(delRes.error)));

      return r;
    });
    out.dry_run = { error: run.error ? pgErr(run.error) : null, ms: run.ms, rolled_back: run.rolled_back };
    out.in_tx = run.result;
    ck.t('A-1', '整份 0024 干跑通过（含 §D 自检）', run.error === null, run.error ? JSON.stringify(pgErr(run.error)) : 'ok');

    // ========================================================================
    // ② apply-time 自检的**变异判负**（AC⑫）：在内存里改坏 `0024` ⇒ 必红 + 整体回滚
    // ========================================================================
    const mutants: Array<{ id: string; what: string; sql: string }> = [
      {
        id: 'M1',
        what: '★ Z4 硬约束变异：把编排函数内的 `public.listing_post_event(v_envelope)` 换成不回退到既有资金路径 ⇒ 自检「必须复用」断言须拦住',
        sql: SQL_TEXT.replace(
          '    v_ledger := public.listing_post_event(v_envelope);',
          "    v_ledger := jsonb_build_object('txid', 0, 'idempotent_replay', false, 'entries', '[]'::jsonb);",
        ),
      },
      {
        id: 'M2',
        what: '★ AC-12 反断言变异：往函数体内塞 `purchase_refund` 字面量（复制退款资金腿 = 第二真源）',
        sql: SQL_TEXT.replace(
          '  v_envelope := jsonb_build_object(',
          "  PERFORM jsonb_build_object('kind', 'purchase_refund');\n  v_envelope := jsonb_build_object(",
        ),
      },
      {
        id: 'M3',
        what: '★ AC-14 反断言变异：把白名单捕获换成兜底类子句（基础设施错会被吞成「被拒」）',
        sql: SQL_TEXT.replace(
          "    v_ledger := public.listing_post_event(v_envelope);\n  EXCEPTION WHEN SQLSTATE 'LD011' THEN",
          '    v_ledger := public.listing_post_event(v_envelope);\n  EXCEPTION WHEN OTHERS THEN',
        ),
      },
      {
        id: 'M4',
        what: '索引面变异：把 `admin_refund_audit_log_actor_day_idx` 改名 ⇒ 自检「索引在场」断言须拦住',
        sql: SQL_TEXT.replace(/admin_refund_audit_log_actor_day_idx/g, 'admin_refund_audit_log_actor_day_idx_DISABLED'),
      },
      {
        id: 'M5',
        what: '键集变异：把 `UNIQUE (idempotency_key, result)` 降为单列 `UNIQUE (idempotency_key)`',
        sql: SQL_TEXT.replace('CONSTRAINT admin_refund_audit_log_idem_uniq UNIQUE (idempotency_key, result)', 'CONSTRAINT admin_refund_audit_log_idem_uniq UNIQUE (idempotency_key)'),
      },
      {
        id: 'M6',
        what: 'result 闭集变异：把 `rejected_state` 改成 `rejected_x`（闭集断言须拦住）',
        sql: SQL_TEXT.replace("CHECK (result IN ('applied', 'rejected_state'))", "CHECK (result IN ('applied', 'rejected_x'))"),
      },
    ];

    const mutantResults: Array<Record<string, unknown>> = [];
    for (const m of mutants) {
      const mr = await inRollbackTx(p, async (c) => {
        await c.query(m.sql);
        return { executed: true };
      });
      // 变异后回滚 ⇒ 真实对象必须**不存在**（自证整体回滚 + 非破坏）
      const residue = await raw1<{ t: string }>(p, `SELECT to_regclass('public.admin_refund_audit_log')::text AS t`);
      const rec = {
        id: m.id, what: m.what, mutation_changed_text: m.sql !== SQL_TEXT,
        error: mr.error ? pgErr(mr.error) : null, rolled_back: mr.rolled_back,
        residue_after_rollback: residue?.t ?? null,
      };
      mutantResults.push(rec);
      ck.t(`MUT-${m.id}`, `变异 ${m.id} 必红（自检拦住）且残留在回滚后 = null`, mr.error !== null && (residue?.t ?? null) === null, JSON.stringify(rec));
    }
    out.mutants = mutantResults;

    // ========================================================================
    // ②′ AC-15③ 判负（**行为面**）：把审计行 INSERT 移到 `BEGIN` 块**内**（子事务里）
    //     ⇒ `LD011` 抛出时子事务回滚会把它一并撤销 ⇒ `rejected_state` 行 = 0 ⇒ 必红。
    //     这直接证伪「子事务回滚不得波及其他已写对象」这条判据（Zang 附加硬约束③）。
    // ========================================================================
    const M7_INBLOCK = [
      '    INSERT INTO public.admin_refund_audit_log',
      '      (actor_uid, order_id, seller_uid, buyer_uid, cid, amount, result, txid, idempotency_key, request_fingerprint, memo)',
      "    SELECT v_actor, v_order_id, o.seller_uid, o.buyer_uid, o.cid, (o.price*o.quantity)::bigint,",
      "           'rejected_state', NULL, v_key, v_fp, 'mutant-subtx'",
      '      FROM public.listing_order o WHERE o.order_id = v_order_id',
      '    ON CONFLICT (idempotency_key, result) DO NOTHING;',
      '',
    ].join('\n');
    const handlerInsert = [
      '        INSERT INTO public.admin_refund_audit_log',
      '          (actor_uid, order_id, seller_uid, buyer_uid, cid, amount,',
      '           result, txid, idempotency_key, request_fingerprint, memo)',
      '        VALUES',
      '          (v_actor, v_order_id, v_seller, v_buyer, v_cid, v_amount,',
      "           'rejected_state', NULL, v_key, v_fp, v_reason)",
      '        ON CONFLICT (idempotency_key, result) DO NOTHING;',
    ].join('\n');
    const sqlM7 = SQL_TEXT
      .replace('  BEGIN\n    v_ledger := public.listing_post_event(v_envelope);', `  BEGIN\n${M7_INBLOCK}    v_ledger := public.listing_post_event(v_envelope);`)
      .replace(handlerInsert, '        PERFORM 1;');
    const mut7 = await inRollbackTx(p, async (c) => {
      await c.query(sqlM7);
      const rr = await callFn(c, { actor_uid: '7', order_id: '1', request_fingerprint: 'p7b:mutant:fp:1', memo: 'mutant' });
      const rows = await auditRows(c, 1);
      return { receipt: rr, total_rows_order1: rows.length, rejected_rows_order1: rows.filter((x) => x.result === 'rejected_state').length };
    });
    out.mutant_m7_subtransaction = {
      mutation_changed_text: sqlM7 !== SQL_TEXT && sqlM7.includes("'mutant-subtx'") && !sqlM7.includes(handlerInsert),
      error: mut7.error ? pgErr(mut7.error) : null,
      result: mut7.result,
    };
    ck.t(
      'MUT-M7',
      '★ AC-15③ 判负：审计行 INSERT 落进子事务块 ⇒ 被拒留痕必红（rejected_state 行 = 0）',
      mut7.error === null && (mut7.result as { rejected_rows_order1: number } | null)?.rejected_rows_order1 === 0,
      JSON.stringify(out.mutant_m7_subtransaction),
    );

    // ========================================================================
    // ③ 零残留自证：干跑后真库指纹与干跑前**逐字相等**
    // ========================================================================
    out.fingerprint_after = await fingerprint(p);
    const same = JSON.stringify(out.fingerprint_before) === JSON.stringify(out.fingerprint_after);
    ck.t('Z-1', '★ 零位移：干跑前后真库指纹逐字相等（含 ledger/account/schema_migration）', same, JSON.stringify({ before: out.fingerprint_before, after: out.fingerprint_after }));
  } finally {
    await p.end().catch(() => undefined);
  }

  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p7b-01-migration-dry-run', out);
  console.log(JSON.stringify({ saved: f, summary: out.summary, dry_run_error: out.dry_run, mut_red: (out.mutants as Array<Record<string, unknown>>).map((m) => `${m.id}:${m.error ? 'RED' : 'GREEN'}${(m.residue_after_rollback ?? 'null') === null ? '' : '/RESIDUE!'}`) }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
