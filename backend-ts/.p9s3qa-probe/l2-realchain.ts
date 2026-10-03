/**
 * L2 四段真链路独立重取（Neng 自写 · 不复用 Kong 夹具）——
 * ① 评分提交/幂等/同侧二次/stars 越界 + 汇总四周期/有行均值/无行兜底/有行 config；
 * ② 时效 T1..T4（job_submission→reviewed_at · 事件行 time_created）+ 无数据 null；
 * ③ 发货/收货 transition（状态回写与事件行同生同灭）+ 非法转移拒 + 零残留；
 * ④ 退款闸 shipped 可退 ⇄ received 禁退（两读数对照）。
 * ★ 全部在 withTransaction 内 + 末尾哨兵 ROLLBACK ⇒ 生产零净写。
 * ★ 「无行 ⇒ 兜底值」负对照（C-15）：空 uid/标的 → 汇总 3.0 / 时效 null；并核 COALESCE 在标量子查询外层。
 */
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, RATING_POLICY_DEFAULTS } from '../src/database';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.join(__dirname, '..', '.p9s3qa-artifacts');
fs.mkdirSync(OUT, { recursive: true });

interface C { id: string; grp: string; pass: boolean; expect: string; actual: string; }
const checks: C[] = [];
const t = (id: string, grp: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, grp, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

// 自写夹具 id 段（避开既有数据 / Kong 夹具）
const U = {
  emp1: 7710001, wk1: 7710002, rA: 7710003, ratee1: 7710004, rB: 7710005, rC: 7710006, rD: 7710007,
  emp2: 7710011, wk2: 7710012, seller: 7710014, buyer: 7710015,
  clean: 7710019, empty: 7710020,
};
const JOBS = [7710001, 7710002];
const ORDS = [7710201, 7710202, 7710203, 7710204, 7710205]; // 201 ship/recv, 203 created(illegal), 204 received, 205 shipped

(async () => {
  const baseline = {
    rating: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.rating`))[0].n),
    event: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event`))[0].n),
    order: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order`))[0].n),
    users: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.users`))[0].n),
  };
  const SENT = 'QAP9S3_L2_ROLLBACK';
  try {
    await withTransaction(async (tx: TxClient) => {
      const q = async <T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> =>
        (await tx.query<T>(text, params)).rows;
      const one = async <T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | undefined> =>
        (await q<T>(text, params))[0];
      const sp = async (name: string, fn: () => Promise<unknown>): Promise<string> => {
        await tx.query(`SAVEPOINT ${name}`);
        try { await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return ''; }
        catch (e) {
          await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
          const err = e as { code?: unknown; message?: unknown; detail?: unknown };
          return [String(err.code ?? ''), String(err.message ?? ''), String(err.detail ?? '')].join('|');
        }
      };
      const ex = tx;
      const hex = (n: number): string => '0x' + String(n).padStart(40, '0');
      const evN = async (id: number): Promise<number> =>
        Number((await one<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event WHERE order_id = $1::bigint`, [id]))?.n);
      const stOf = async (id: number): Promise<string | undefined> =>
        (await one<{ status: string }>(`SELECT status FROM public.listing_order WHERE order_id = $1::bigint`, [id]))?.status;

      // ---- 造数（事务内）----
      for (const u of Object.values(U)) {
        await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
                        VALUES ($1::bigint, $2::text, '', false, now(), now())`, [u, hex(u)]);
      }
      await q(`INSERT INTO public.job (job_id, employer_uid, worker_uid, cid, reward, status, create_key)
               VALUES (${JOBS[0]}, ${U.emp1}, ${U.wk1}, 1, 100, 'settled', 'qap9s3:j1'),
                      (${JOBS[1]}, ${U.emp2}, ${U.wk2}, 1, 100, 'settled', 'qap9s3:j2')`);
      // T1/T2 载体：submission time_created → reviewed_at (+3 天)
      await q(`INSERT INTO public.job_submission (job_id, worker_uid, deliverable, review_status, reviewed_at, create_key, time_created)
               VALUES (${JOBS[1]}, ${U.wk2}, 'd', 'approved', now() - interval '2 days', 'qap9s3:s2', now() - interval '5 days')`);
      // listing_order 夹具
      await q(`INSERT INTO public.listing_order (order_id, listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
               VALUES (${ORDS[0]}, 1, ${U.buyer}, ${U.seller}, 1, 100, 1, 'paid',     'qap9s3:o1'),
                      (${ORDS[1]}, 1, ${U.buyer}, ${U.seller}, 1, 100, 1, 'paid',     'qap9s3:o2'),
                      (${ORDS[2]}, 1, ${U.buyer}, ${U.seller}, 1, 100, 1, 'created',  'qap9s3:o3'),
                      (${ORDS[3]}, 1, ${U.buyer}, ${U.seller}, 1, 100, 1, 'received', 'qap9s3:o4'),
                      (${ORDS[4]}, 1, ${U.buyer}, ${U.seller}, 1, 100, 1, 'shipped',  'qap9s3:o5')`);
      // T3/T4 事件行：created(-10d) paid(-9d) shipped(-7d) received(-5d) ⇒ ship-created=3d · recv-paid=4d
      await q(`INSERT INTO public.listing_order_event (order_id, event_type, from_status, to_status, actor_uid, idempotency_key, request_fingerprint, time_created)
               VALUES (${ORDS[4]}, 'created', NULL, 'created', ${U.seller}, 'qap9s3:e1', 'f', now() - interval '10 days'),
                      (${ORDS[4]}, 'paid',    'created', 'paid',     ${U.buyer},  'qap9s3:e2', 'f', now() - interval '9 days'),
                      (${ORDS[4]}, 'shipped', 'paid',    'shipped',  ${U.seller}, 'qap9s3:e3', 'f', now() - interval '7 days'),
                      (${ORDS[4]}, 'received','shipped','received', ${U.buyer},  'qap9s3:e4', 'f', now() - interval '5 days')`);
      // 评分原始行（ratee = U.ratee1 · worker 角色 ← poster_to_worker）错开四周期
      await q(`INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars, idempotency_key, request_fingerprint, memo, time_created)
               VALUES (${U.rA}, ${U.ratee1}, 'job', 7710010, 'poster_to_worker', 5, 'qap9s3:r:a', 'f', '', now() - interval '5 days'),
                      (${U.rB}, ${U.ratee1}, 'job', 7710011, 'poster_to_worker', 3, 'qap9s3:r:b', 'f', '', now() - interval '60 days'),
                      (${U.rC}, ${U.ratee1}, 'job', 7710012, 'poster_to_worker', 1, 'qap9s3:r:c', 'f', '', now() - interval '200 days'),
                      (${U.rD}, ${U.ratee1}, 'job', 7710013, 'poster_to_worker', 4, 'qap9s3:r:d', 'f', '', now() - interval '400 days')`);

      // ================= ① 评分提交链 =================
      const mk = (o: Record<string, unknown>) => DatabaseService.submitRating({
        raterUid: Number(o.raterUid), targetType: String(o.targetType), targetId: Number(o.targetId),
        direction: String(o.direction), stars: Number(o.stars),
        idempotencyKey: String(o.idempotencyKey), requestFingerprint: 'f', memo: '',
      }, ex);
      const r1 = await mk({ raterUid: U.emp1, targetType: 'job', targetId: JOBS[0], direction: 'poster_to_worker', stars: 4, idempotencyKey: `qap9s3:rating:${U.emp1}:job:${JOBS[0]}` });
      t('L2-R1', 'rating', r1?.outcome === 'inserted' && r1?.rateeUid === U.wk1 && r1?.stars === 4,
        '提交：四要素服务端取数（rater=token · ratee=job.worker_uid）⇒ inserted', JSON.stringify(r1));
      const r2 = await mk({ raterUid: U.emp1, targetType: 'job', targetId: JOBS[0], direction: 'poster_to_worker', stars: 4, idempotencyKey: `qap9s3:rating:${U.emp1}:job:${JOBS[0]}` });
      t('L2-R2', 'rating', r2?.outcome === 'replay' && r2?.stars === 4,
        '幂等重放：同键二次 ⇒ replay（取真值 stars=4）', JSON.stringify(r2));
      const r3 = await mk({ raterUid: U.emp1, targetType: 'job', targetId: JOBS[0], direction: 'poster_to_worker', stars: 5, idempotencyKey: `qap9s3:rating:${U.emp1}:job:${JOBS[0]}:b` });
      t('L2-R3', 'rating', r3?.outcome === 'already_rated',
        '同侧二次（异键）⇒ already_rated（UNIQUE(rater,target_type,target_id)）', JSON.stringify(r3));
      const r4 = await sp('sp_r6', () => mk({ raterUid: U.wk1, targetType: 'job', targetId: JOBS[0], direction: 'worker_to_poster', stars: 6, idempotencyKey: `qap9s3:rating:${U.wk1}:job:${JOBS[0]}` }));
      t('L2-R4', 'rating', r4.split('|')[0] === '23514' && /rating_stars_rng/.test(r4),
        'stars=6 越界 ⇒ 拒 23514（值域 CHECK rating_stars_rng 兜底）', JSON.stringify({ err: r4.slice(0, 140) }));

      // 汇总四周期
      const sum = await DatabaseService.getRatingSummary(U.ratee1, ex);
      const w = (d: string): number | undefined => sum.periods[d]?.worker;
      t('L2-R5', 'rating',
        w('30') === 5 && w('90') === 4 && w('360') === 3 && w('1000') === 3.25
        && sum.periods['30']?.counts?.worker === 1 && sum.periods['1000']?.counts?.worker === 4,
        '汇总四周期分别读数：30=5 · 90=4 · 360=3 · 1000=3.25（counts 1/2/3/4）',
        JSON.stringify({ '30': w('30'), '90': w('90'), '360': w('360'), '1000': w('1000'), counts: { 30: sum.periods['30']?.counts?.worker } }));
      t('L2-R6', 'rating', sum.source === 'config' || sum.source === 'constant',
        '有行 ⇒ source 为 config/constant 之一（此处无 rating_policy 行 ⇒ constant）', JSON.stringify({ source: sum.source }));
      const sumHas = await DatabaseService.getRatingSummary(U.wk1, ex);
      t('L2-R7', 'rating', sumHas.periods['30']?.worker === 4 && sumHas.periods['30']?.counts?.worker === 1,
        '有行 ⇒ 真均值：uid 7710002（1 条 4 星）⇒ worker=4 · counts.worker=1', JSON.stringify(sumHas.periods['30']));

      // ★ 无行 ⇒ 兜底 3.0（source=constant）
      const sumNone = await DatabaseService.getRatingSummary(U.empty, ex);
      t('L2-R8', 'norow',
        sumNone.source === 'constant' && sumNone.defaultStars === 3.0
        && sumNone.periods['30']?.poster === 3 && sumNone.periods['1000']?.worker === 3
        && sumNone.periods['30']?.counts?.worker === 0,
        '★ 无行 uid ⇒ 兜底 3.0（source=constant · 不因无行变 0/NaN）',
        JSON.stringify({ source: sumNone.source, defaultStars: sumNone.defaultStars, p30: sumNone.periods['30'] }));

      // 有行 ⇒ config（事务内 INSERT 策略键 · 禁 UPDATE app_config）
      await q(`INSERT INTO public.app_config (key, value, updated_by) VALUES ('rating_policy', '{"defaultStars":4}'::jsonb, 1)`);
      const sumCfg = await DatabaseService.getRatingSummary(U.empty, ex);
      t('L2-R9', 'norow', sumCfg.source === 'config' && sumCfg.defaultStars === 4 && sumCfg.periods['30']?.vendor === 4,
        '★ 有行（config）⇒ source=config · defaultStars=4 ⇒ 无行角色回落 4.0',
        JSON.stringify({ source: sumCfg.source, defaultStars: sumCfg.defaultStars, p30: sumCfg.periods['30'] }));
      await tx.query(`DELETE FROM public.app_config WHERE key='rating_policy'`).catch(() => undefined);

      // ================= ② 时效 T1..T4 =================
      const tl1 = await DatabaseService.getTimeliness(U.emp2, {}, ex);
      const tl2 = await DatabaseService.getTimeliness(U.wk2, {}, ex);
      t('L2-T1', 'timeliness', tl1.posterAvgDays === 3 && tl2.workerAvgDays === 3,
        'T1/T2（job_submission.time_created→reviewed_at · approved+settled）⇒ poster=3 · worker=3',
        JSON.stringify({ poster: tl1.posterAvgDays, worker: tl2.workerAvgDays }));
      const tl3 = await DatabaseService.getTimeliness(U.seller, {}, ex);
      const tl4 = await DatabaseService.getTimeliness(U.buyer, {}, ex);
      t('L2-T2', 'timeliness', tl3.vendorAvgShipDays === 3 && tl4.customerAvgReceiveDays === 4,
        'T3/T4（listing_order_event.time_created）：卖家 ship=3（created→shipped）· 买家 recv=4（paid→received）',
        JSON.stringify({ ship: tl3.vendorAvgShipDays, recv: tl4.customerAvgReceiveDays }));
      const tlN = await DatabaseService.getTimeliness(U.clean, {}, ex);
      t('L2-T3', 'norow',
        tlN.posterAvgDays === null && tlN.workerAvgDays === null && tlN.vendorAvgShipDays === null && tlN.customerAvgReceiveDays === null,
        '★ 无数据 ⇒ null（不填 0）', JSON.stringify({ poster: tlN.posterAvgDays, worker: tlN.workerAvgDays, ship: tlN.vendorAvgShipDays, recv: tlN.customerAvgReceiveDays }));

      // ★ C-15：COALESCE 必须在标量子查询外层（内层形态对「无行」不兜底）
      const c15 = await one<{ inner: string | null; outer: string | null }>(
        `SELECT (SELECT COALESCE(b.batt,0) FROM public.batt_account b WHERE b.uid = 7719999)::text AS inner,
                COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid = 7719999),0)::text AS outer`);
      t('L2-C15', 'norow', c15?.inner === null && c15?.outer === '0',
        '★ C-15：内层 `(SELECT COALESCE(col,0) …)` 对无行 ⇒ null；外层 `COALESCE((SELECT col …),0)` ⇒ 0',
        JSON.stringify(c15));

      // ================= ③ 发货 / 收货 transition =================
      const mkTx = (o: Record<string, unknown>) => DatabaseService.transitionListingOrder({
        action: o.action as 'ship' | 'receive', orderId: Number(o.orderId), actorUid: Number(o.actorUid),
        idempotencyKey: String(o.idempotencyKey), requestFingerprint: 'f', memo: '',
      }, ex);
      const sh = await mkTx({ action: 'ship', orderId: ORDS[0], actorUid: U.seller, idempotencyKey: `qap9s3:ship:${ORDS[0]}` });
      t('L2-S1', 'transition',
        sh?.outcome === 'shipped' && sh?.currentStatus === 'paid' && sh?.toStatus === 'shipped'
        && (await evN(ORDS[0])) === 1 && (await stOf(ORDS[0])) === 'shipped',
        '发货 paid→shipped ✓：状态回写 shipped 且事件行同生（=1）',
        JSON.stringify({ outcome: sh?.outcome, from: sh?.currentStatus, to: sh?.toStatus, status: await stOf(ORDS[0]), events: await evN(ORDS[0]) }));
      const rc = await mkTx({ action: 'receive', orderId: ORDS[0], actorUid: U.buyer, idempotencyKey: `qap9s3:recv:${ORDS[0]}` });
      t('L2-S2', 'transition',
        rc?.outcome === 'received' && rc?.currentStatus === 'shipped' && rc?.toStatus === 'received'
        && (await evN(ORDS[0])) === 2 && (await stOf(ORDS[0])) === 'received',
        '收货 shipped→received ✓：状态回写 received 且事件行再现（=2）',
        JSON.stringify({ outcome: rc?.outcome, from: rc?.currentStatus, to: rc?.toStatus, status: await stOf(ORDS[0]), events: await evN(ORDS[0]) }));
      const bad = await mkTx({ action: 'ship', orderId: ORDS[2], actorUid: U.seller, idempotencyKey: `qap9s3:ship:${ORDS[2]}` });
      t('L2-S3', 'transition',
        bad?.outcome === 'state_conflict' && (await evN(ORDS[2])) === 0 && (await stOf(ORDS[2])) === 'created',
        '非法转移 created→shipped ⇒ 拒 state_conflict + 零残留（事件行=0 · status 仍 created）',
        JSON.stringify({ outcome: bad?.outcome, events: await evN(ORDS[2]), status: await stOf(ORDS[2]) }));
      const np = await mkTx({ action: 'ship', orderId: ORDS[4], actorUid: U.buyer, idempotencyKey: `qap9s3:ship:${ORDS[4]}` });
      t('L2-S4', 'transition', np?.outcome === 'not_party',
        '非归属（买方对卖方订单发 ship）⇒ not_party', JSON.stringify({ outcome: np?.outcome }));
      void RATING_POLICY_DEFAULTS;

      // ================= ④ 退款闸（两读数对照） =================
      const refundOf = async (orderId: number): Promise<string> =>
        sp(`sp_rf_${orderId}`, () => tx.query(`SELECT public.listing_post_event($1::jsonb) AS r`, [JSON.stringify({ op: 'refund', order_id: String(orderId) })]));
      const rfShipped = await refundOf(ORDS[4]);   // shipped ⇒ 过状态闸
      const rfReceived = await refundOf(ORDS[3]);  // received ⇒ 终态禁
      const rfCreated = await refundOf(ORDS[2]);   // created ⇒ 禁
      t('L2-F1', 'refundGate',
        rfShipped.includes('order_pay_missing') && !rfShipped.includes('order_not_refundable'),
        '退款闸放宽：shipped 订单过状态闸（仅因 pay_txid 缺 ⇒ order_pay_missing）',
        JSON.stringify({ shipped: rfShipped.slice(0, 150) }));
      t('L2-F2', 'refundGate',
        rfReceived.includes('order_not_refundable') && rfCreated.includes('order_not_refundable'),
        '退款闸仍禁（两读数对照）：received ⇒ order_not_refundable · created ⇒ order_not_refundable',
        JSON.stringify({ received: rfReceived.slice(0, 120), created: rfCreated.slice(0, 120) }));

      // 零残留自检（事务内）
      const evs = (await q<{ order_id: string; n: string }>(
        `SELECT order_id::text AS order_id, count(*)::int::text AS n FROM public.listing_order_event
          WHERE order_id = ANY($1::bigint[]) GROUP BY order_id ORDER BY order_id`, [ORDS])).map((r) => `${r.order_id}:${r.n}`).join(',');
      t('L2-S5', 'transition', (await evN(ORDS[2])) === 0 && (await evN(ORDS[3])) === 0,
        '非法转移 / 退款拒绝 零残留（203/204 事件行 = 0）', JSON.stringify({ events: evs }));

      throw new Error(SENT);
    });
  } catch (e) {
    if (String((e as Error)?.message) !== SENT) {
      t('L2-FATAL', 'fatal', false, '真链路（事务内）无异常', String((e as Error)?.message || e).slice(0, 200));
    }
  }

  // 回滚后零净写复核
  const after = {
    rating: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.rating`))[0].n),
    event: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event`))[0].n),
    order: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order`))[0].n),
    users: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.users`))[0].n),
  };
  const zero = JSON.stringify(baseline) === JSON.stringify(after) && baseline.rating === 0 && baseline.event === 0;
  t('L2-Z0', 'rollback', zero, '末尾 ROLLBACK ⇒ 生产零净写（rating/event/order/users 回 baseline）',
    JSON.stringify({ baseline, after }));

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'P9S3QA-L2-REALCHAIN', run: RUN, total: checks.length, passed: checks.length - failed.length, failed: failed.length, baseline, after, checks };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT, `l2-realchain-${RUN}.json`), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT, `l2-realchain-${RUN}.json`)}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('L2_FATAL', String((e as Error)?.stack || e).slice(0, 600));
  await closePools().catch(() => undefined);
  process.exit(2);
});
