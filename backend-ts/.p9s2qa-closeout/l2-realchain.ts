/**
 * P9② QA 收尾单 · L2 四段真链路独立重取（Neng 自写夹具 · 事务内 + 哨兵 ROLLBACK）
 * A 签到（首签/第7天/封顶丢弃/幂等）· B 补签（账本腿/不burn/不补发/幂等/日限）
 * C 双闸两读数（apply 前置拦 / accept 二次判 + 正常扣 9）· D 日界 UTC
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2qa-closeout/l2-realchain.ts
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, closePools, txQuery, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, `l2-realchain-${RUN}.json`);
class Sentinel extends Error { constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); } }
const checks: Array<{ id: string; pass: boolean; note: string; actual: unknown }> = [];
const ck = (id: string, pass: boolean, note: string, actual: unknown) => { checks.push({ id, pass: Boolean(pass), note, actual }); };
const legs: Record<string, unknown> = {};
const get1 = async <T = Record<string, unknown>>(tx: TxClient, sql: string, p?: unknown[]): Promise<T | null> =>
  (await txQuery<T>(tx, sql, p))[0] ?? null;
const setBatt = async (tx: TxClient, uid: number, batt: number) =>
  txQuery(tx, `INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint,$2::int) ON CONFLICT (uid) DO UPDATE SET batt=EXCLUDED.batt`, [String(uid), String(batt)]);
const st = async (tx: TxClient, uid: number) => (await get1<Record<string, unknown>>(tx, `SELECT
  COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid=$1::bigint),0)::int AS batt,
  COALESCE((SELECT max(c.streak_day) FROM public.checkin_log c WHERE c.uid=$1::bigint),0)::int AS streak,
  (SELECT count(*)::int FROM public.batt_entry e WHERE e.uid=$1::bigint) AS entries,
  (SELECT count(*)::int FROM public.checkin_log c WHERE c.uid=$1::bigint) AS checkins,
  (SELECT count(*)::int FROM public.checkin_makeup_log m WHERE m.uid=$1::bigint) AS makeups`, [String(uid)])) ?? {};
const freeUids = async (tx: TxClient, n: number): Promise<number[]> =>
  (await txQuery<{ uid: number }>(tx, `SELECT u.uid::int AS uid FROM public.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.checkin_log c WHERE c.uid=u.uid)
      AND NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
      AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid)
      AND NOT EXISTS (SELECT 1 FROM public.checkin_makeup_log m WHERE m.uid=u.uid)
    ORDER BY u.uid LIMIT ${n}`)).map((r) => Number(r.uid));
const inSP = async <T>(tx: TxClient, name: string, fn: () => Promise<T>) => {
  await txQuery(tx, `SAVEPOINT ${name}`);
  try { const val = await fn(); await txQuery(tx, `RELEASE SAVEPOINT ${name}`); return { ok: true, val }; }
  catch (e) { await txQuery(tx, `ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined); await txQuery(tx, `RELEASE SAVEPOINT ${name}`).catch(() => undefined); return { ok: false, err: String((e as { code?: unknown }).code) }; }
};

(async () => {
  // A · 签到
  try { await withTransaction(async (tx) => {
    const [u1, u7, ucap] = await freeUids(tx, 3);
    const preA = await st(tx, u1);
    const r1 = await DatabaseService.checkin(u1, `biz:qa:ck:${u1}:d1`, tx);
    const r2 = await DatabaseService.checkin(u1, `biz:qa:ck:${u1}:d1`, tx);
    const r3 = await DatabaseService.checkin(u1, `biz:qa:ck:${u1}:other`, tx);
    // 第7天
    for (let k = 1; k <= 6; k += 1) await txQuery(tx, `INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
      VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date - $2::int, $3::smallint, 30)`, [String(u7), String(k), String(7 - k)]);
    const r7 = await DatabaseService.checkin(u7, `biz:qa:ck:${u7}:d7`, tx);
    // 封顶丢弃
    await setBatt(tx, ucap, 90);
    const rc = await DatabaseService.checkin(ucap, `biz:qa:ck:${ucap}:cap`, tx);
    const postCap = await st(tx, ucap);
    legs.A = { u1, u7, ucap, preA, r1, r2, r3, r7, rc, postCap };
    ck('L2-A1', r1?.outcome === 'inserted' && r1.streakDay === 1 && r1.rewardBatt === 30 && r1.batt === 30, '首签 +30 · streak=1 · batt=30', r1);
    ck('L2-A2', r2?.outcome === 'replayed' && r3?.outcome === 'replayed', '同键重放 / 同日异键 ⇒ replayed（服务层幂等）', { r2, r3 });
    ck('L2-A3', r7?.outcome === 'inserted' && r7.streakDay === 7 && r7.rewardBatt === 60 && r7.batt === 60, '第7天 ⇒ streak=7 · reward=60', r7);
    ck('L2-A4', rc?.creditedBatt === 10 && rc?.batt === 100 && Number(postCap.batt) === 100, '封顶丢弃：batt=90 签到 ⇒ credited=10 · batt=100', rc);
    throw new Sentinel('A');
  }); } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // B · 补签
  try { await withTransaction(async (tx) => {
    // 补签需余额 ≥ 100（cid=1）⇒ 在“干净且已充值”的用户里取
    const ubRow = await get1<{ uid: number }>(tx, `SELECT u.uid::int AS uid FROM public.users u
      JOIN public.account a ON a.uid=u.uid AND a.cid=1
      WHERE a.balance >= 200
        AND NOT EXISTS (SELECT 1 FROM public.checkin_log c WHERE c.uid=u.uid)
        AND NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
        AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid)
        AND NOT EXISTS (SELECT 1 FROM public.checkin_makeup_log m WHERE m.uid=u.uid)
      ORDER BY u.uid LIMIT 1`);
    const ub = Number(ubRow?.uid);
    const pre = await st(tx, ub);
    const supplyPre = (await get1(tx, `SELECT total_supply::text AS s FROM public.currency WHERE cid=1`))?.s;
    const targetDay = (await get1(tx, `SELECT ((now() AT TIME ZONE 'UTC')::date - 1)::text AS d`))?.d as string;
    const key = `biz:qa:mk:${ub}:${targetDay}`;
    const r = await DatabaseService.checkinMakeup({ uid: ub, targetDay, idempotencyKey: key, requestFingerprint: `fp:${ub}`, memo: 'qa' }, tx);
    const post = await st(tx, ub);
    const supplyPost = (await get1(tx, `SELECT total_supply::text AS s FROM public.currency WHERE cid=1`))?.s;
    const legsRows = await txQuery<{ uid: string; delta: string; kind: string; cid: string }>(tx, `SELECT uid::text AS uid, delta::text AS delta, kind, cid::text AS cid
      FROM public.ledger_entry WHERE idempotency_key = $1::text OR idempotency_key LIKE $1::text || '#%' ORDER BY uid`, [key]);
    const replay = await DatabaseService.checkinMakeup({ uid: ub, targetDay, idempotencyKey: key, requestFingerprint: `fp:${ub}`, memo: 'qa' }, tx);
    const other = await DatabaseService.checkinMakeup({ uid: ub, targetDay, idempotencyKey: `${key}#2`, requestFingerprint: 'fp2', memo: 'qa' }, tx);
    const byUid = (u: string) => legsRows.find((x) => String(x.uid) === u);
    legs.B = { ub, targetDay, pre, r, post, supplyPre, supplyPost, legsRows, replay, other };
    ck('L2-B1', r?.outcome === 'applied' && r.costUsd === 100 && r.txid !== null, '补签 applied · cost=100 · 回执 txid', r);
    ck('L2-B2', String(byUid('-1')?.delta) === '100' && byUid('-1')?.kind === 'checkin_makeup_fee', '-1 credit 100 kind=checkin_makeup_fee（不真 burn）', legsRows);
    ck('L2-B3', String(byUid(String(ub))?.delta) === '-100' && supplyPre === supplyPost, `${ub} debit -100；currency(1).total_supply 不变`, { legsRows, supplyPre, supplyPost });
    ck('L2-B4', Number(post.entries) === Number(pre.entries) && Number(post.batt) === Number(pre.batt), '不补发 batt：batt_entry 行数 / batt 不变', { pre, post });
    ck('L2-B5', replay?.outcome === 'replayed' && other?.outcome === 'rejected_daily_limit', '幂等重放；同日异键 ⇒ rejected_daily_limit', { replay, other });
    throw new Sentinel('B');
  }); } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // C · 双闸
  try { await withTransaction(async (tx) => {
    const [w1, w2, w3] = await freeUids(tx, 3);
    const empRow = await get1<{ uid: number }>(tx, `SELECT uid::int AS uid FROM public.users
      WHERE uid NOT IN ($1::bigint,$2::bigint,$3::bigint) AND uid > 0 ORDER BY uid LIMIT 1`, [String(w1), String(w2), String(w3)]);
    const EMP = Number(empRow?.uid); const J1 = 991501, J2 = 991502, J3 = 991503;
    for (const J of [J1, J2, J3]) await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, status, create_key)
      VALUES ($1::bigint,$2::bigint,1,1,'open',$3::text)`, [String(J), String(EMP), `biz:qa:job:${J}:${RUN}`]);
    // 前置拦：batt=0 < 9 ⇒ 拒
    const below = await DatabaseService.applyToJob(J1, w1, `biz:qa:ap:${J1}`, tx);
    await setBatt(tx, w1, 9);
    const okA = await DatabaseService.applyToJob(J1, w1, `biz:qa:ap:${J1}:ok`, tx);
    // 二次判：报名后耗到 5 ⇒ accept 拒 + 整体回滚
    await setBatt(tx, w2, 9);
    const ap2 = await DatabaseService.applyToJob(J2, w2, `biz:qa:ap:${J2}`, tx);
    await setBatt(tx, w2, 5);
    const acc2 = await DatabaseService.acceptJobApplication(J2, Number(ap2?.applicationId), EMP, tx);
    const w2post = await st(tx, w2);
    const j2 = await get1(tx, `SELECT status FROM public.job WHERE job_id=$1::bigint`, [String(J2)]);
    // 正常扣 9
    await setBatt(tx, w3, 9);
    const ap3 = await DatabaseService.applyToJob(J3, w3, `biz:qa:ap:${J3}`, tx);
    const acc3 = await DatabaseService.acceptJobApplication(J3, Number(ap3?.applicationId), EMP, tx);
    const e3 = await get1(tx, `SELECT delta::int AS delta, reason FROM public.batt_entry WHERE uid=$1::bigint ORDER BY txid DESC LIMIT 1`, [String(w3)]);
    legs.C = { EMP, w1, w2, w3, below, okA, acc2, w2post, j2status: j2?.status, acc3, e3 };
    ck('L2-C1', below?.outcome === 'batt_below_threshold' && okA?.outcome === 'applied', '前置拦：batt=0 ⇒ batt_below_threshold；batt=9 ⇒ applied', { below, okA });
    ck('L2-C2', acc2?.outcome === 'batt_below_threshold' && Number(w2post.batt) === 5 && j2?.status === 'open', '二次判：报名后 batt=5<9 ⇒ accept 拒 + 整体回滚（job 仍 open · batt 仍 5）', { acc2, w2post, j2 });
    ck('L2-C3', acc3?.outcome === 'accepted' && acc3.workerBattAfter === 0 && e3?.delta === -9 && e3?.reason === 'task_cost', '正常：batt 9→0 扣 9 · batt_entry delta=-9 reason=task_cost', { acc3, e3 });
    throw new Sentinel('C');
  }); } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // D · 日界 UTC
  try { await withTransaction(async (tx) => {
    const row = await get1(tx, `SELECT (now() AT TIME ZONE 'UTC')::date::text AS utc_day, current_setting('TimeZone') AS tz`);
    const nodeUtc = new Date().toISOString().slice(0, 10);
    legs.D = { sql: row, node_utc: nodeUtc };
    ck('L2-D1', row?.utc_day === nodeUtc, '日界 = UTC：SQL(now() AT TIME ZONE UTC)::date == node toISOString', { sql: row?.utc_day, node: nodeUtc });
    throw new Sentinel('D');
  }); } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'P9S2QA-L2-REALCHAIN', run: RUN, at: new Date().toISOString(),
    total: checks.length, passed: checks.length - failed.length, failed: failed.length, all_rolled_back: true, legs, checks };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${OUT}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error('L2_FATAL', String((e as Error)?.message || e).slice(0, 300)); await closePools().catch(() => undefined); process.exit(2); });
