/**
 * P9③ 收口（Kong）· 四段真链路 draft 探针（事务内 + 末尾 ROLLBACK）
 * 放 .p9s3c-closeout/（不进 scripts/）。仅本地验证行为，随后并入门 p8-s8。
 */
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';

const SENT = 'P9S3C_ROLLBACK';
const hex40 = (n: number): string => '0x' + String(n).padStart(40, '0');

(async () => {
  const out: Record<string, unknown> = {};
  const R: Record<string, unknown> = {};
  out.baseline = {
    rating: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.rating`))[0].n,
    event: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.listing_order_event`))[0].n,
    order: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.listing_order`))[0].n,
    users: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.users`))[0].n,
  };

  try {
    await withTransaction(async (tx: TxClient) => {
      const q = async <T = Record<string, unknown>>(text: string, params?: unknown[]) => (await tx.query<T>(text, params)).rows;
      const sp = async (name: string, fn: () => Promise<unknown>): Promise<string | null> => {
        await tx.query(`SAVEPOINT ${name}`);
        try { await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return null; }
        catch (e) {
          await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
          const err = e as { code?: unknown; message?: unknown; detail?: unknown };
          return `${String(err.code ?? '')}|${String(err.message ?? '')}|${String(err.detail ?? '')}`;
        }
      };
      const ex = tx;

      // ---------------- 造数：合成用户 ----------------
      const UIDS = [981001, 981002, 981003, 981004, 981005, 981006, 981009, 981010, 981011, 981012, 981014, 981015, 981020, 981021];
      for (const u of UIDS) {
        await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
                        VALUES ($1::bigint, $2::text, '', false, now(), now())`, [u, hex40(u)]);
      }

      // ---------------- 造数：job / submission / order / events ----------------
      await q(`INSERT INTO public.job (job_id, employer_uid, worker_uid, cid, reward, status, create_key)
               VALUES (900001, 981001, 981009, 1, 100, 'settled', 'p9s3c:j1'),
                      (900002, 981011, 981012, 1, 100, 'settled', 'p9s3c:j2')`);
      await q(`INSERT INTO public.job_submission (job_id, worker_uid, deliverable, review_status, reviewed_at, create_key, time_created)
               VALUES (900002, 981012, 'd', 'approved', now() - interval '2 days', 'p9s3c:s2', now() - interval '5 days')`);
      await q(`INSERT INTO public.listing_order (order_id, listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
               VALUES (900201, 1, 981015, 981014, 1, 100, 1, 'shipped', 'p9s3c:o1'),
                      (900202, 1, 981021, 981020, 1, 100, 1, 'paid',    'p9s3c:o2'),
                      (900203, 1, 981021, 981020, 1, 100, 1, 'created', 'p9s3c:o3'),
                      (900204, 1, 981021, 981020, 1, 100, 1, 'received','p9s3c:o4'),
                      (900205, 1, 981021, 981020, 1, 100, 1, 'shipped', 'p9s3c:o5')`);
      await q(`INSERT INTO public.listing_order_event (order_id, event_type, from_status, to_status, actor_uid, idempotency_key, request_fingerprint, time_created)
               VALUES (900201, 'created', NULL, 'created', 981014, 'k:o1:c', 'f', now() - interval '10 days'),
                      (900201, 'paid',    'created', 'paid',    981015, 'k:o1:p', 'f', now() - interval '9 days'),
                      (900201, 'shipped', 'paid',    'shipped', 981014, 'k:o1:s', 'f', now() - interval '7 days'),
                      (900201, 'received','shipped','received', 981015, 'k:o1:r', 'f', now() - interval '5 days')`);

      // ================= ① 评分提交链 =================
      const r1 = await DatabaseService.submitRating({ raterUid: 981001, targetType: 'job', targetId: 900001, direction: 'poster_to_worker', stars: 4, idempotencyKey: 'biz:rating:981001:job:900001', requestFingerprint: 'f', memo: '' }, ex);
      R.rating_submit = r1;
      const rReplay = await DatabaseService.submitRating({ raterUid: 981001, targetType: 'job', targetId: 900001, direction: 'poster_to_worker', stars: 4, idempotencyKey: 'biz:rating:981001:job:900001', requestFingerprint: 'f', memo: '' }, ex);
      R.rating_replay = rReplay;
      const rDup = await DatabaseService.submitRating({ raterUid: 981001, targetType: 'job', targetId: 900001, direction: 'poster_to_worker', stars: 5, idempotencyKey: 'biz:rating:981001:job:900001:b', requestFingerprint: 'f2', memo: '' }, ex);
      R.rating_already = rDup;
      const rRange = await sp('sp_range', () => DatabaseService.submitRating({ raterUid: 981009, targetType: 'job', targetId: 900001, direction: 'worker_to_poster', stars: 6, idempotencyKey: 'biz:rating:981009:job:900001', requestFingerprint: 'f3', memo: '' }, ex));
      R.rating_out_of_range = rRange;

      // ================= 评分汇总读链（四周期 + 兜底） =================
      // 种入 4 条原始评分行（ratee=981002，方向 poster_to_worker → role worker），时间错开四周期
      await q(`INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars, idempotency_key, request_fingerprint, memo, time_created)
               VALUES (981003, 981002, 'job', 900011, 'poster_to_worker', 5, 'k:r:a', 'f', '', now() - interval '5 days'),
                      (981004, 981002, 'job', 900012, 'poster_to_worker', 3, 'k:r:b', 'f', '', now() - interval '60 days'),
                      (981005, 981002, 'job', 900013, 'poster_to_worker', 1, 'k:r:c', 'f', '', now() - interval '200 days'),
                      (981006, 981002, 'job', 900014, 'poster_to_worker', 4, 'k:r:d', 'f', '', now() - interval '400 days')`);
      const summary = await DatabaseService.getRatingSummary(981002, ex);
      R.summary_981002 = summary;
      const summaryHas = await DatabaseService.getRatingSummary(981009, ex);
      R.summary_981009 = summaryHas;
      const summaryNone = await DatabaseService.getRatingSummary(981010, ex);
      R.summary_981010 = summaryNone;
      // 无行/有行（app_config 策略键）对照：事务内 INSERT rating_policy（禁 UPDATE）
      const beforeCfg = await DatabaseService.getRatingSummary(981010, ex);
      R.policy_before_insert = { source: beforeCfg.source, defaultStars: beforeCfg.defaultStars };
      await q(`INSERT INTO public.app_config (key, value, updated_by) VALUES ('rating_policy', '{"defaultStars":4}'::jsonb, 1)`);
      const afterCfg = await DatabaseService.getRatingSummary(981010, ex);
      R.policy_after_insert = { source: afterCfg.source, defaultStars: afterCfg.defaultStars, p30: afterCfg.periods['30'] };

      // ================= ② 时效 T1..T4 =================
      const t1 = await DatabaseService.getTimeliness(981011, {}, ex);
      const t2 = await DatabaseService.getTimeliness(981012, {}, ex);
      R.timeliness_t1t2 = { posterAvgDays: t1.posterAvgDays, workerAvgDays: t2.workerAvgDays };
      const t3 = await DatabaseService.getTimeliness(981014, {}, ex);
      const t4 = await DatabaseService.getTimeliness(981015, {}, ex);
      R.timeliness_t3t4 = { vendorAvgShipDays: t3.vendorAvgShipDays, customerAvgReceiveDays: t4.customerAvgReceiveDays };
      const tNone = await DatabaseService.getTimeliness(981010, {}, ex);
      R.timeliness_none = { posterAvgDays: tNone.posterAvgDays, workerAvgDays: tNone.workerAvgDays, vendorAvgShipDays: tNone.vendorAvgShipDays, customerAvgReceiveDays: tNone.customerAvgReceiveDays };

      // ================= ③ 发货 / 收货 transition =================
      const sh = await DatabaseService.transitionListingOrder({ action: 'ship', orderId: 900202, actorUid: 981020, idempotencyKey: 'biz:listing:ship:900202', requestFingerprint: 'f', memo: '' }, ex);
      const evAfterShip = await q(`SELECT count(*)::int n FROM public.listing_order_event WHERE order_id = 900202`);
      const stAfterShip = (await q<{ status: string }>(`SELECT status FROM public.listing_order WHERE order_id = 900202`))[0]?.status;
      R.ship = { outcome: sh?.outcome, from: sh?.currentStatus, to: sh?.toStatus, events: evAfterShip[0].n, status: stAfterShip };
      const rc = await DatabaseService.transitionListingOrder({ action: 'receive', orderId: 900202, actorUid: 981021, idempotencyKey: 'biz:listing:receive:900202', requestFingerprint: 'f', memo: '' }, ex);
      const evAfterRecv = await q(`SELECT count(*)::int n FROM public.listing_order_event WHERE order_id = 900202`);
      const stAfterRecv = (await q<{ status: string }>(`SELECT status FROM public.listing_order WHERE order_id = 900202`))[0]?.status;
      R.receive = { outcome: rc?.outcome, from: rc?.currentStatus, to: rc?.toStatus, events: evAfterRecv[0].n, status: stAfterRecv };
      // 非法 created→shipped
      const bad = await DatabaseService.transitionListingOrder({ action: 'ship', orderId: 900203, actorUid: 981020, idempotencyKey: 'biz:listing:ship:900203', requestFingerprint: 'f', memo: '' }, ex);
      const evBad = await q(`SELECT count(*)::int n FROM public.listing_order_event WHERE order_id = 900203`);
      const stBad = (await q<{ status: string }>(`SELECT status FROM public.listing_order WHERE order_id = 900203`))[0]?.status;
      R.illegal_ship = { outcome: bad?.outcome, events: evBad[0].n, status: stBad };
      // 非归属（buyer 发 ship）
      const np = await DatabaseService.transitionListingOrder({ action: 'ship', orderId: 900205, actorUid: 981021, idempotencyKey: 'biz:listing:ship:900205', requestFingerprint: 'f', memo: '' }, ex);
      R.not_party_ship = { outcome: np?.outcome };

      // ================= ④ 退款闸放宽（listing_post_event） =================
      const refund = async (orderId: number): Promise<string | null> => sp(`sp_rf_${orderId}`, () => tx.query(`SELECT public.listing_post_event($1::jsonb) AS r`, [JSON.stringify({ op: 'refund', order_id: String(orderId) })]));
      R.refund_shipped_900205 = await refund(900205);
      R.refund_received_900204 = await refund(900204);
      R.refund_created_900203 = await refund(900203);

      // ================= 残留自检（事务内） =================
      const evFor = async (id: number) => (await q<{ n: number }>(`SELECT count(*)::int n FROM public.listing_order_event WHERE order_id = ${id}`))[0].n;
      R.residue = { ev_900203: await evFor(900203), ev_900204: await evFor(900204), ev_900205: await evFor(900205) };
      R.live_counts = {
        rating: (await q<{ n: number }>(`SELECT count(*)::int n FROM public.rating`))[0].n,
        event: (await q<{ n: number }>(`SELECT count(*)::int n FROM public.listing_order_event`))[0].n,
      };

      throw new Error(SENT);
    });
  } catch (e) { if (String((e as Error)?.message) !== SENT) throw e; }

  out.after_rollback = {
    rating: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.rating`))[0].n,
    event: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.listing_order_event`))[0].n,
    order: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.listing_order`))[0].n,
    users: (await readQuery<{ n: number }>(`SELECT count(*)::int n FROM public.users`))[0].n,
  };
  out.readings = R;
  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch(async (e) => { console.error('DRAFT_FAIL', (e as Error)?.stack || e); await closePools().catch(() => undefined); process.exit(1); });
