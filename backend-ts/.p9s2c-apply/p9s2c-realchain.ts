/**
 * P9② 库面收口单 · ① 四段真链路（**一律 withTransaction 内 + 末尾哨兵 ROLLBACK**）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2c-apply/p9s2c-realchain.ts
 * 产物：backend-ts/.p9s2c-apply/realchain-<RUN>.json
 *
 * ★ 纪律：库面写一律事务内 + 末尾 ROLLBACK（`0028`/`0029` 已 apply；`batt_entry`/`checkin_log`/
 *   `checkin_makeup_log`/`ledger_entry` append-only ⇒ **无 DELETE+INSERT 复原路径**）。生产库零净写。
 * ★ 走**真实服务层方法**（`DatabaseService.checkin/checkinMakeup/applyToJob/acceptJobApplication/getBatt`，
 *   经 `sqlFor(ex)` 事务内注入）—— 单一真源，无第二套取数。
 * 四段：A 签到（+30 / 第7天60 / 封顶丢弃 / 幂等）· B 补签（100$→uid−1·不burn·留痕·不补发·幂等重放·拒绝）
 *      · C 双闸两读数（apply 前置拦 / accept 扣9+二次判）· D 日界 UTC。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, closePools, txQuery, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { LEDGER_KINDS } from '../src/ledger';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, `realchain-${RUN}.json`);
class Sentinel extends Error { constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); } }

const legs: Record<string, unknown> = {};
const checks: Array<{ id: string; pass: boolean; note: string; actual: unknown }> = [];
const ck = (id: string, pass: boolean, note: string, actual: unknown): void => { checks.push({ id, pass: Boolean(pass), note, actual }); };

/** 事务内造夹具/读态小工具 */
const get1 = async <T = Record<string, unknown>>(tx: TxClient, sql: string, p?: unknown[]): Promise<T | null> =>
  (await txQuery<T>(tx, sql, p))[0] ?? null;
const setBatt = async (tx: TxClient, uid: number, batt: number): Promise<void> => {
  await txQuery(tx, `INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint, $2::int)
                     ON CONFLICT (uid) DO UPDATE SET batt = EXCLUDED.batt`, [String(uid), String(batt)]);
};
const state = async (tx: TxClient, uid: number): Promise<Record<string, unknown>> => {
  const r = await get1(tx, `SELECT
      COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid=$1::bigint),0)::int AS batt,
      COALESCE((SELECT c.streak_day FROM public.checkin_log c WHERE c.uid=$1::bigint ORDER BY c.checkin_day DESC LIMIT 1),0)::int AS streak,
      (SELECT count(*)::int FROM public.batt_entry e WHERE e.uid=$1::bigint) AS batt_entries,
      (SELECT count(*)::int FROM public.checkin_log c WHERE c.uid=$1::bigint) AS checkins,
      (SELECT count(*)::int FROM public.checkin_makeup_log m WHERE m.uid=$1::bigint) AS makeups,
      COALESCE((SELECT a.balance FROM public.account a WHERE a.uid=$1::bigint AND a.cid=1),0)::bigint AS usd`,
    [String(uid)]);
  return r ?? {};
};
const inSavepoint = async <T>(tx: TxClient, name: string, fn: () => Promise<T>): Promise<{ ok: boolean; err?: string; val?: T }> => {
  await txQuery(tx, `SAVEPOINT ${name}`);
  try { const val = await fn(); await txQuery(tx, `RELEASE SAVEPOINT ${name}`); return { ok: true, val }; }
  catch (e) {
    await txQuery(tx, `ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
    await txQuery(tx, `RELEASE SAVEPOINT ${name}`).catch(() => undefined);
    return { ok: false, err: String((e as { code?: unknown }).code ?? (e as Error).message).slice(0, 120) };
  }
};

(async () => {
  // ==========================================================================
  // A · batt 签到（uid 7 / 8 / 11）
  // ==========================================================================
  try {
    await withTransaction(async (tx) => {
      const UID = 7;
      const pre = await state(tx, UID);
      const r1 = await DatabaseService.checkin(UID, `biz:checkin:${UID}:day1`, tx);
      const mid = await state(tx, UID);
      const r2 = await DatabaseService.checkin(UID, `biz:checkin:${UID}:day1`, tx);   // 幂等重放（同键）
      const entryRow = await get1(tx, `SELECT reason, delta::int AS delta, batt_after::int AS batt_after
         FROM public.batt_entry WHERE uid=$1::bigint ORDER BY txid DESC LIMIT 1`, [String(UID)]);
      // 同日第二笔（异键）⇒ 服务层幂等 + 直接重复 INSERT ⇒ 23505（UNIQUE(uid,checkin_day)）
      const r2b = await DatabaseService.checkin(UID, `biz:checkin:${UID}:day1-otherkey`, tx);
      const dup = await inSavepoint(tx, 'sp_dup', () => txQuery(tx,
        `INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
         VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date, 1, 30)`, [String(UID)]));
      legs.A_base = { uid: UID, pre, checkin1: r1, mid, checkin2_samekey: r2, checkin3_otherkey: r2b,
        last_batt_entry: entryRow, dup_insert_same_day: dup };
      ck('A1', r1?.outcome === 'inserted' && r1.streakDay === 1 && r1.rewardBatt === 30 && r1.creditedBatt === 30 && r1.batt === 30,
        '首签 +30 · streak=1', r1);
      ck('A2', Number(pre.batt) === 0 && Number(mid.batt) === 30 && Number(mid.batt_entries) === 1,
        '改前 batt=0/entries=0 ⇄ 改后 batt=30/entries=1', { pre, mid });
      ck('A3', r2?.outcome === 'replayed', '同键重放 ⇒ replayed', r2);
      ck('A4', r2b?.outcome === 'replayed', '同日异键第二笔 ⇒ 服务层拒（replayed · 不新增行）', r2b);
      ck('A5', dup.ok === false && String(dup.err).includes('23505'), '同日重复 INSERT ⇒ 23505（UNIQUE(uid,checkin_day)）', dup);
      ck('A6', Number(entryRow?.delta) === 30 && entryRow?.reason === 'checkin', 'batt_entry 逐笔 delta=+30 reason=checkin', entryRow);
      throw new Sentinel('A');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  try { // 第 7 天 = 60
    await withTransaction(async (tx) => {
      const UID = 8;
      const pre = await state(tx, UID);
      for (let k = 1; k <= 6; k += 1) {
        await txQuery(tx, `INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
          VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date - $2::int, $3::smallint, 30)`,
          [String(UID), String(k), String(7 - k)]);
      }
      const pre7 = await state(tx, UID);
      const r = await DatabaseService.checkin(UID, `biz:checkin:${UID}:day7`, tx);
      const post = await state(tx, UID);
      legs.A_day7 = { uid: UID, pre, seeded_streak6: pre7.streak, checkin: r, post };
      ck('A7', r?.streakDay === 7 && r.rewardBatt === 60 && r.creditedBatt === 60 && r.batt === 60,
        '第 7 天 ⇒ streak=7 · reward=60 · batt=60', r);
      throw new Sentinel('A7');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  try { // 封顶丢弃
    await withTransaction(async (tx) => {
      const UID = 11;
      await setBatt(tx, UID, 90);
      const pre = await state(tx, UID);
      const r = await DatabaseService.checkin(UID, `biz:checkin:${UID}:cap`, tx);
      const post = await state(tx, UID);
      const entry = await get1(tx, `SELECT delta::int AS delta, batt_after::int AS batt_after FROM public.batt_entry
         WHERE uid=$1::bigint ORDER BY txid DESC LIMIT 1`, [String(UID)]);
      legs.A_cap = { uid: UID, pre, checkin: r, post, batt_entry: entry };
      ck('A8', r?.rewardBatt === 30 && r.creditedBatt === 10 && r.batt === 100 && Number(entry?.delta) === 10,
        '封顶丢弃：batt=90 签到 ⇒ 只入 10（reward 30 被丢弃 20）· delta=10 · batt=100', r);
      throw new Sentinel('A8');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // ==========================================================================
  // B · 补签（100$ → uid=−1 · 不 burn · 留痕 · 不补发 · 幂等重放）
  // ==========================================================================
  try {
    await withTransaction(async (tx) => {
      const UID = 12;
      const pre = await state(tx, UID);
      const supplyPre = (await get1(tx, `SELECT total_supply::text AS s FROM public.currency WHERE cid=1`))?.s;
      const targetDay = (await get1(tx, `SELECT ((now() AT TIME ZONE 'UTC')::date - 1)::text AS d`))?.d as string;
      const key = `biz:checkin:makeup:${UID}:${targetDay}`;
      const r = await DatabaseService.checkinMakeup({ uid: UID, targetDay, idempotencyKey: key,
        requestFingerprint: `fp:${UID}:${targetDay}`, memo: 'p9s2c probe' }, tx);
      const post = await state(tx, UID);
      const supplyPost = (await get1(tx, `SELECT total_supply::text AS s FROM public.currency WHERE cid=1`))?.s;
      const legsRows = await txQuery(tx, `SELECT uid::text AS uid, delta::text AS delta, kind, cid::text AS cid
         FROM public.ledger_entry WHERE idempotency_key = $1::text OR idempotency_key LIKE $1::text || '#%' ORDER BY uid`, [key]);
      const logRow = await get1(tx, `SELECT result, target_day::text AS target_day, cost_usd::text AS cost, txid::text AS txid
         FROM public.checkin_makeup_log WHERE idempotency_key=$1::text`, [key]);
      const replay = await DatabaseService.checkinMakeup({ uid: UID, targetDay, idempotencyKey: key,
        requestFingerprint: `fp:${UID}:${targetDay}`, memo: 'p9s2c probe' }, tx);
      const otherKey = await DatabaseService.checkinMakeup({ uid: UID, targetDay,
        idempotencyKey: `biz:checkin:makeup:${UID}:${targetDay}#2`, requestFingerprint: `fp2:${UID}`, memo: 'x' }, tx);
      const makeupsAfter = (await state(tx, UID)).makeups;
      legs.B_applied = { uid: UID, targetDay, key, pre, applied: r, post, supply_pre: supplyPre, supply_post: supplyPost,
        ledger_legs: legsRows, log_row: logRow, replay, other_key_same_day: otherKey, makeups_after: makeupsAfter };
      const byUid = (u: string) => legsRows.find((x) => String(x.uid) === u);
      ck('B1', r?.outcome === 'applied' && r.costUsd === 100 && r.txid !== null, '补签 applied · cost=100 · 回执 txid', r);
      ck('B2', String(byUid('-1')?.delta) === '100' && byUid('-1')?.kind === 'checkin_makeup_fee' && byUid('-1')?.cid === '1',
        '100$ → uid=−1 credit（kind=checkin_makeup_fee）', legsRows);
      ck('B3', String(byUid(String(UID))?.delta) === '-100' && byUid(String(UID))?.kind === 'checkin_makeup_fee',
        `uid=${UID} debit −100（同 kind）`, legsRows);
      ck('B4', supplyPre === supplyPost, '★ 不 burn：currency(1).total_supply 不变', { supply_pre: supplyPre, supply_post: supplyPost });
      ck('B5', logRow?.result === 'applied' && logRow?.target_day === targetDay, '留痕：checkin_makeup_log result=applied', logRow);
      ck('B6', Number(post.batt_entries) === Number(pre.batt_entries) && Number(post.batt) === Number(pre.batt),
        '★ 不补发 batt：batt_entry 行数不变 · batt_account 不变', { pre, post });
      ck('B7', replay?.outcome === 'replayed', '幂等键重放 ⇒ replayed', replay);
      ck('B8', otherKey?.outcome === 'rejected_daily_limit', '同日异键第二笔 ⇒ 拒（rejected_daily_limit）', otherKey);
      throw new Sentinel('B');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  try { // 三类拒绝留痕（各自当日首次尝试）
    await withTransaction(async (tx) => {
      const today = (await get1(tx, `SELECT (now() AT TIME ZONE 'UTC')::date::text AS d`))?.d as string;
      // ① target_invalid（target_day = today ⇒ >= today）
      const uidTI = 2;
      const kTI = `biz:checkin:makeup:${uidTI}:${today}`;
      const rTI = await DatabaseService.checkinMakeup({ uid: uidTI, targetDay: today, idempotencyKey: kTI, requestFingerprint: 'fpTI', memo: 'x' }, tx);
      const logTI = await get1(tx, `SELECT result FROM public.checkin_makeup_log WHERE idempotency_key=$1::text`, [kTI]);
      // ② insufficient_balance（uid=4 余额 4 < 100）
      const uidIB = 4;
      const targetDay = (await get1(tx, `SELECT ((now() AT TIME ZONE 'UTC')::date - 2)::text AS d`))?.d as string;
      const kIB = `biz:checkin:makeup:${uidIB}:${targetDay}`;
      const rIB = await DatabaseService.checkinMakeup({ uid: uidIB, targetDay, idempotencyKey: kIB, requestFingerprint: 'fpIB', memo: 'x' }, tx);
      const logIB = await get1(tx, `SELECT result FROM public.checkin_makeup_log WHERE idempotency_key=$1::text`, [kIB]);
      legs.B_reject = { today, target_invalid: { outcome: rTI?.outcome, log_row: logTI },
        insufficient: { outcome: rIB?.outcome, log_row: logIB } };
      ck('B9', rTI?.outcome === 'rejected_target_invalid' && logTI?.result === 'rejected_target_invalid',
        '拒绝① target_invalid ⇒ 留痕（result 落行）', { rTI, logTI });
      ck('B10', rIB?.outcome === 'rejected_insufficient_balance' && logIB?.result === 'rejected_insufficient_balance',
        '拒绝② insufficient_balance ⇒ 留痕（result 落行）', { rIB, logIB });
      throw new Sentinel('B9');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // ==========================================================================
  // C · 双闸两读数
  // ==========================================================================
  try {
    await withTransaction(async (tx) => {
      const EMP = 3, W = 6, JOB = 990001;
      await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, status, create_key)
        VALUES ($1::bigint,$2::bigint,1,1,'open',$3::text)`, [String(JOB), String(EMP), `p9s2c:job:${JOB}:${RUN}`]);
      const dbgThr = await get1(tx, `SELECT
          COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid=$1::bigint),0)::int AS batt,
          (SELECT (p.value->>'acceptThresholdBatt') FROM public.app_config p WHERE p.key='batt_policy' LIMIT 1) AS raw_cfg,
          COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
            THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END FROM public.app_config p WHERE p.key='batt_policy' LIMIT 1), $2::int)::int AS thr,
          COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
            THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END FROM public.app_config p WHERE p.key='batt_policy' LIMIT 1), $3) AS thr_uncast,
          ((SELECT COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid=$1::bigint),0))
             < COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                 THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END FROM public.app_config p WHERE p.key='batt_policy' LIMIT 1), $3)) AS lt_expr
        `, [String(W), String(9), 9]);
      // 读数①：batt=0 < 9 ⇒ apply 拒
      const below = await DatabaseService.applyToJob(JOB, W, `p9s2c:apply:${JOB}:${W}:below`, tx);
      // 读数②：batt=9 ⇒ apply 放行
      await setBatt(tx, W, 9);
      const ok = await DatabaseService.applyToJob(JOB, W, `p9s2c:apply:${JOB}:${W}:ok`, tx);
      legs.C_apply = { job: JOB, employer: EMP, worker: W, debug_threshold: dbgThr, batt_below_read: below, batt_ok_read: ok };
      ck('C1', below?.outcome === 'batt_below_threshold', '★ 落点A 改前读数：worker batt=0 < 9 ⇒ applyToJob 拒（batt_below_threshold）', below);
      ck('C2', ok?.outcome === 'applied' && ok.applicationId !== null, '★ 落点A 改后读数：worker batt=9 ⇒ applyToJob 放行（applied）', ok);
      throw new Sentinel('C1');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  try { // accept 二次判（报名后电量被耗到 < 9）
    await withTransaction(async (tx) => {
      const EMP = 3, W = 19, JOB = 990002;
      await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, status, create_key)
        VALUES ($1::bigint,$2::bigint,1,1,'open',$3::text)`, [String(JOB), String(EMP), `p9s2c:job2:${JOB}:${RUN}`]);
      await setBatt(tx, W, 9);
      const applied = await DatabaseService.applyToJob(JOB, W, `p9s2c:apply:${JOB}:${W}`, tx);
      await setBatt(tx, W, 5);            // 报名后电量被耗到 <9
      const preState = await state(tx, W);
      const acc = await DatabaseService.acceptJobApplication(JOB, Number(applied?.applicationId), EMP, tx);
      const postState = await state(tx, W);
      const appRow = await get1(tx, `SELECT status FROM public.job_application WHERE application_id=$1::bigint`, [String(applied?.applicationId)]);
      const jobRow = await get1(tx, `SELECT status FROM public.job WHERE job_id=$1::bigint`, [String(JOB)]);
      legs.C_accept_second_judge = { job: JOB, worker: W, applied, batt_drained_to: 5, accept: acc, pre: preState, post: postState,
        application_status_after: appRow?.status, job_status_after: jobRow?.status };
      ck('C3', acc?.outcome === 'batt_below_threshold', '★ 落点B 二次判：报名后 batt=5 < 9 ⇒ accept 拒（batt_below_threshold）', acc);
      ck('C4', appRow?.status === 'applied' && jobRow?.status === 'open' && Number(postState.batt) === 5
        && Number(postState.batt_entries) === Number(preState.batt_entries),
        '★ 整体回滚、零残留：application 仍 applied · job 仍 open · batt 仍 5 · batt_entry 未增', { appRow, jobRow, pre: preState, post: postState });
      throw new Sentinel('C3');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  try { // accept 正常腿（batt=9 ⇒ 扣 9 + 二次判通过）
    await withTransaction(async (tx) => {
      const EMP = 3, W = 7, JOB = 990003;
      await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, status, create_key)
        VALUES ($1::bigint,$2::bigint,1,1,'open',$3::text)`, [String(JOB), String(EMP), `p9s2c:job3:${JOB}:${RUN}`]);
      await setBatt(tx, W, 9);
      const applied = await DatabaseService.applyToJob(JOB, W, `p9s2c:apply:${JOB}:${W}`, tx);
      const acc = await DatabaseService.acceptJobApplication(JOB, Number(applied?.applicationId), EMP, tx);
      const post = await state(tx, W);
      const entry = await get1(tx, `SELECT delta::int AS delta, batt_after::int AS batt_after, reason FROM public.batt_entry
         WHERE uid=$1::bigint ORDER BY txid DESC LIMIT 1`, [String(W)]);
      legs.C_accept_ok = { job: JOB, worker: W, applied, accept: acc, post, batt_entry: entry };
      ck('C5', acc?.outcome === 'accepted' && acc.workerBattAfter === 0 && Number(post.batt) === 0,
        '★ accept 通过：扣 9（9→0）· workerBattAfter=0', acc);
      ck('C6', Number(entry?.delta) === -9 && entry?.reason === 'task_cost', '扣减落 batt_entry 逐笔（delta=−9 · reason=task_cost）', entry);
      throw new Sentinel('C5');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // ==========================================================================
  // D · 日界 = UTC（读数）
  // ==========================================================================
  try {
    await withTransaction(async (tx) => {
      const row = await get1(tx, `SELECT (now() AT TIME ZONE 'UTC')::date::text AS utc_day,
        (now() AT TIME ZONE 'UTC')::text AS utc_ts, now()::date::text AS db_session_day,
        current_setting('TimeZone') AS tz`);
      const jsNow = new Date();
      const localDay = `${jsNow.getFullYear()}-${String(jsNow.getMonth() + 1).padStart(2, '0')}-${String(jsNow.getDate()).padStart(2, '0')}`;
      const utcDay = jsNow.toISOString().slice(0, 10);
      legs.D_day = { sql: row, node_local_day: localDay, node_utc_day: utcDay, utc_minus_local_day_delta: (Date.parse(utcDay) - Date.parse(localDay)) / 86400000 };
      ck('D1', typeof row?.utc_day === 'string' && row.utc_day === utcDay,
        '日界 = UTC：SQL (now() AT TIME ZONE UTC)::date == node toISOString().slice(0,10)', { sql: row?.utc_day, node: utcDay });
      throw new Sentinel('D');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'P9S2C-REALCHAIN', run: RUN, at: new Date().toISOString(),
    legs_count: Object.keys(legs).length, total: checks.length, passed: checks.length - failed.length,
    failed: failed.length, all_rolled_back: true, legs, checks };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} legs=${report.legs_count} artifact=${OUT}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error('REALCHAIN_FATAL', String((e as Error)?.message || e).slice(0, 300)); await closePools().catch(() => undefined); process.exit(2); });
