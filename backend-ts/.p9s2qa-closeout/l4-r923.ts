/**
 * P9② QA 收尾单 · ① L4 `R-9-23` 钳制独立复核（Neng 自写）
 * ============================================================================
 * 手法：`withTransaction` 内 INSERT `app_config` 策略键（capBatt=200 / streakCapDays=10）
 *   → 事务内读回 + resolver 生效值 + 真写路径（checkin / applyToJob / acceptJobApplication）
 *   → 越界反事实判负（savepoint）
 *   → 哨兵 throw 强制 ROLLBACK（生产库零净写）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2qa-closeout/l4-r923.ts
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, closePools, txQuery, TxClient } from '../src/db';
import {
  DatabaseService, resolveBattPolicy, resolveCheckinPolicy,
  BATT_CAP_HARD_MAX, CHECKIN_STREAK_CAP_HARD_MAX,
} from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, `l4-r923-${RUN}.json`);
class Sentinel extends Error { constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); } }

const checks: Array<{ id: string; pass: boolean; note: string; actual: unknown }> = [];
const ck = (id: string, pass: boolean, note: string, actual: unknown): void => { checks.push({ id, pass: Boolean(pass), note, actual }); };
const legs: Record<string, unknown> = {};

const get1 = async <T = Record<string, unknown>>(tx: TxClient, sql: string, p?: unknown[]): Promise<T | null> =>
  (await txQuery<T>(tx, sql, p))[0] ?? null;
const inSavepoint = async <T>(tx: TxClient, name: string, fn: () => Promise<T>): Promise<{ ok: boolean; err?: string; val?: T }> => {
  await txQuery(tx, `SAVEPOINT ${name}`);
  try { const val = await fn(); await txQuery(tx, `RELEASE SAVEPOINT ${name}`); return { ok: true, val }; }
  catch (e) {
    await txQuery(tx, `ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
    await txQuery(tx, `RELEASE SAVEPOINT ${name}`).catch(() => undefined);
    return { ok: false, err: String((e as { code?: unknown }).code ?? (e as Error).message).slice(0, 160) };
  }
};

(async () => {
  // -------------------------------------------------------------------------
  // L4-1 · 纯 resolver（不涉库）：AV4 域未破 + 生效值钳制
  // -------------------------------------------------------------------------
  const bRaw = { taskCostBatt: 9, capBatt: 200, floorBatt: 0, acceptThresholdBatt: 9 };
  const cRaw = { baseRewardBatt: 30, streakCapDays: 10, streakDay7RewardBatt: 60, makeupCostUsd: 100, makeupDailyLimit: 1 };
  const bP = resolveBattPolicy(bRaw);
  const cP = resolveCheckinPolicy(cRaw);
  const bFloor = resolveBattPolicy({ capBatt: 100, floorBatt: 150 });
  legs.L4_1_pure = {
    hard_max: { BATT_CAP_HARD_MAX, CHECKIN_STREAK_CAP_HARD_MAX },
    batt_in: bRaw, batt_effective: bP.policy, batt_source: bP.source,
    checkin_in: cRaw, checkin_effective: cP.policy, checkin_source: cP.source,
    floor_over_cap: { in: { capBatt: 100, floorBatt: 150 }, out: bFloor.policy.floorBatt },
  };
  ck('L4-a', bP.policy.capBatt === 100 && bP.source === 'config',
    'capBatt 200 ⇒ 生效 100；source=config（AV4 域仍放行任意正整数，钳制在读生效值）', { capBatt: bP.policy.capBatt, source: bP.source });
  ck('L4-b', cP.policy.streakCapDays === 7 && cP.source === 'config',
    'streakCapDays 10 ⇒ 生效 7；source=config（同上）', { streakCapDays: cP.policy.streakCapDays, source: cP.source });
  ck('L4-c', bFloor.policy.floorBatt === 100,
    'floorBatt 150 > capBatt 100 ⇒ floor 生效 100（floor ∈ [0,capBatt]）', bFloor.policy.floorBatt);

  // -------------------------------------------------------------------------
  // L4-2 · 库面事务：INSERT 策略键 → 读回 → 真写路径（签到 / 消耗）不 23514 → ROLLBACK
  // -------------------------------------------------------------------------
  try {
    await withTransaction(async (tx) => {
      const baseline = {
        appcfg_rows: (await get1(tx, `SELECT count(*)::int AS n FROM public.app_config`))?.n,
        batt_policy_present: (await get1(tx, `SELECT 1 AS x FROM public.app_config WHERE key='batt_policy'`)) !== null,
        checkin_policy_present: (await get1(tx, `SELECT 1 AS x FROM public.app_config WHERE key='checkin_policy'`)) !== null,
        batt_rows: (await get1(tx, `SELECT count(*)::int AS n FROM public.batt_account`))?.n,
        checkin_rows: (await get1(tx, `SELECT count(*)::int AS n FROM public.checkin_log`))?.n,
      };
      // 隔离夹具 uid：无 batt / checkin / batt_entry 既有行（避免撞既有 UNIQUE）
      const uidRow = await get1<{ uid: number }>(tx, `SELECT u.uid::int AS uid FROM public.users u
        WHERE NOT EXISTS (SELECT 1 FROM public.checkin_log c WHERE c.uid=u.uid)
          AND NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
          AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid)
        ORDER BY u.uid LIMIT 1`);
      const UID = Number(uidRow?.uid);
      const EMP = 3;

      // ★ 事务内 INSERT（非 UPDATE）策略键：capBatt=200 / streakCapDays=10
      await txQuery(tx, `INSERT INTO public.app_config (key, value, updated_by, time_updated)
        VALUES ('batt_policy', $1::jsonb, 0, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(bRaw)]);
      await txQuery(tx, `INSERT INTO public.app_config (key, value, updated_by, time_updated)
        VALUES ('checkin_policy', $1::jsonb, 0, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(cRaw)]);

      // 事务内读回（服务层同一 SQL `getAppConfigValueByKey`）
      const rawBatt = await DatabaseService.getAppConfigValueByKey('batt_policy', tx);
      const rawCheckin = await DatabaseService.getAppConfigValueByKey('checkin_policy', tx);
      const effBatt = resolveBattPolicy(rawBatt);
      const effCheckin = resolveCheckinPolicy(rawCheckin);
      // 读口生效值（getBatt / getCheckinStatus）
      const gb = await DatabaseService.getBatt(UID, tx);
      const gc = await DatabaseService.getCheckinStatus(UID, tx);

      // 种子：batt=95；前一日 streak_day=7（CHECK 允许的最大值）
      await txQuery(tx, `INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint, 95)
        ON CONFLICT (uid) DO UPDATE SET batt = EXCLUDED.batt`, [String(UID)]);
      await txQuery(tx, `INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
        VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date - 1, 7, 60)
        ON CONFLICT (uid, checkin_day) DO NOTHING`, [String(UID)]);

      // 真写路径 A · 签到（cap 若未钳 ⇒ LEAST(95+30, 200)=125 ⇒ batt_after 23514；streak 若未钳 ⇒ 8 ⇒ 23514）
      let checkinRes: Record<string, unknown> | null = null;
      let checkinErr: { code?: unknown; message?: string } | null = null;
      try { checkinRes = (await DatabaseService.checkin(UID, `biz:checkin:${UID}:l4qa`, tx)) as unknown as Record<string, unknown>; }
      catch (e) { checkinErr = { code: (e as { code?: unknown }).code, message: (e as Error).message }; }

      // 真写路径 B · 消耗（applyToJob 前置闸 + acceptJobApplication 同事务扣 9）
      const JOB = 991401;
      await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, status, create_key)
        VALUES ($1::bigint, $2::bigint, 1, 1, 'open', $3::text)`, [String(JOB), String(EMP), `l4qa:job:${JOB}:${RUN}`]);
      const applied = await DatabaseService.applyToJob(JOB, UID, `l4qa:apply:${JOB}:${UID}`, tx);
      let acceptRes: Record<string, unknown> | null = null;
      let acceptErr: { code?: unknown; message?: string } | null = null;
      try { acceptRes = (await DatabaseService.acceptJobApplication(JOB, Number(applied?.applicationId), EMP, tx)) as unknown as Record<string, unknown>; }
      catch (e) { acceptErr = { code: (e as { code?: unknown }).code, message: (e as Error).message }; }
      const afterWrites = await get1(tx, `SELECT
        COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid=$1::bigint),0)::int AS batt,
        COALESCE((SELECT max(c.streak_day) FROM public.checkin_log c WHERE c.uid=$1::bigint),0)::int AS max_streak,
        (SELECT count(*)::int FROM public.batt_entry e WHERE e.uid=$1::bigint) AS batt_entries`, [String(UID)]);

      // 反事实判负（savepoint）：越界写必 23514（坐实 DB CHECK 为兜底、钳制为荷载）
      const overBatt = await inSavepoint(tx, 'sp_over_batt', () => txQuery(tx,
        `INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key)
         VALUES ($1::bigint, 30, 125, 'checkin', $2::text)`, [String(UID), `l4qa:over:${RUN}`]));
      const overStreak = await inSavepoint(tx, 'sp_over_streak', () => txQuery(tx,
        `INSERT INTO public.checkin_log (uid, checkin_day, streak_day, reward_batt)
         VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date - 3, 8, 60)`, [String(UID)]));

      legs.L4_2_db = {
        baseline, uid: UID, employer: EMP,
        raw_batt: rawBatt, raw_checkin: rawCheckin,
        eff_batt: effBatt, eff_checkin: effCheckin,
        getBatt: gb, getCheckinStatus: gc,
        checkin_res: checkinRes, checkin_err: checkinErr,
        apply_res: applied, accept_res: acceptRes, accept_err: acceptErr,
        after_writes: afterWrites,
        negative_batt_after_125: overBatt, negative_streak_8: overStreak,
      };

      ck('L4-1', Number((rawBatt as { capBatt?: unknown })?.capBatt) === 200 && effBatt.policy.capBatt === 100,
        '事务内 INSERT capBatt=200 ⇒ 读回原始 200 ⇒ 生效 100', { raw: (rawBatt as { capBatt?: unknown })?.capBatt, eff: effBatt.policy.capBatt });
      ck('L4-2', Number((rawCheckin as { streakCapDays?: unknown })?.streakCapDays) === 10 && effCheckin.policy.streakCapDays === 7,
        '事务内 INSERT streakCapDays=10 ⇒ 读回原始 10 ⇒ 生效 7', { raw: (rawCheckin as { streakCapDays?: unknown })?.streakCapDays, eff: effCheckin.policy.streakCapDays });
      ck('L4-3', gb.capBatt === 100 && gb.floorBatt === 0, '读口 GET /api/batt 生效 capBatt=100 / floorBatt=0', { capBatt: gb.capBatt, floorBatt: gb.floorBatt });
      ck('L4-4', gc.streakCapDays === 7, '读口 GET /api/checkin 生效 streakCapDays=7', { streakCapDays: gc.streakCapDays });
      ck('L4-5', checkinErr === null && Number(checkinRes?.batt) === 100 && Number(checkinRes?.streakDay) === 7 && Number(checkinRes?.creditedBatt) === 5,
        '★ 签到写路径（capBatt=200 配置在册）不 23514：batt 95→100（封顶丢弃）· streak 钳到 7 · creditedBatt=5', { res: checkinRes, err: checkinErr });
      ck('L4-6', acceptErr === null && applied?.outcome === 'applied' && acceptRes?.outcome === 'accepted' && Number(acceptRes?.workerBattAfter) === 91,
        '★ 消耗写路径（前置闸 + 同事务扣 9）不 23514：applied ⇒ accepted · batt 100→91', { applied, acc: acceptRes, err: acceptErr });
      ck('L4-7', String(overBatt.err).includes('23514'), '反事实判负①：batt_after=125 直插 ⇒ 23514（DB 兜底 CHECK 为荷载）', overBatt);
      ck('L4-8', String(overStreak.err).includes('23514'), '反事实判负②：streak_day=8 直插 ⇒ 23514', overStreak);

      throw new Sentinel('L4'); // ★ 强制 ROLLBACK
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  // 回滚后零净写核（新连接只读；只读也走哨兵 ROLLBACK，双保险）
  const post = await withTransaction(async (tx) => {
    const r = await get1(tx, `SELECT
      (SELECT count(*)::int FROM public.app_config) AS appcfg_rows,
      (SELECT count(*)::int FROM public.app_config WHERE key IN ('batt_policy','checkin_policy')) AS policy_rows,
      (SELECT count(*)::int FROM public.batt_account) AS batt_rows,
      (SELECT count(*)::int FROM public.checkin_log) AS checkin_rows`);
    throw new Sentinel(JSON.stringify(r));
  }).catch((e) => { if (e instanceof Sentinel) return JSON.parse(e.tag) as Record<string, number>; throw e; });
  legs.after_rollback = post;
  const base = legs.L4_2_db as { baseline: { appcfg_rows: number; batt_rows: number; checkin_rows: number } };
  ck('L4-9', post.appcfg_rows === base.baseline.appcfg_rows && post.policy_rows === 0
    && post.batt_rows === base.baseline.batt_rows && post.checkin_rows === base.baseline.checkin_rows,
    '零净写终证：ROLLBACK 后 app_config/policy/batt/checkin 计数与基线逐项相同', { post, baseline: base.baseline });

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'P9S2QA-L4-R923', run: RUN, at: new Date().toISOString(),
    total: checks.length, passed: checks.length - failed.length, failed: failed.length, all_rolled_back: true, legs, checks };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${OUT}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error('L4_FATAL', String((e as Error)?.message || e).slice(0, 300)); await closePools().catch(() => undefined); process.exit(2); });
