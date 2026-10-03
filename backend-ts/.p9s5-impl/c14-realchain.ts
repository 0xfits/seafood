/**
 * P9⑤ 接线 + 库面收口单 · ③ `C-14` 四段真链路（单事务内 + 末尾 `ROLLBACK`，注入 `ex`）。
 * ============================================================================
 * 段 ①：注册真路径 —— `DatabaseService.findOrCreateUserByEvm(evm, tx)`（建户分支）⇒ `+30 batt`；
 *        幂等重放（二次调用 ⇒ 建户分支不再命中 ⇒ 零新增）。
 * 段 ②：首任务腿 —— `settleInviteFirstTaskReward({jobIdRaw}, tx)`（★ 本单新增 `ex` 注入）：
 *        N=2 ⇒ `-1 -20` / 本人 `+10` / 上级 `+10`；重放 ⇒ 零新增；无上级（N=1）⇒ `-1 -10` / 本人 `+10`。
 * 段 ③：**接线后经结算路径**触发 —— `settleJob({jobIdRaw, reviewerUid}, tx)`（`dispatchJobEvent` 结算后
 *        调 `settleInviteFirstTaskReward(..., ex)`）⇒ 奖励事件随结算落地；结算重放 ⇒ 奖励零新增。
 * 段 ④：负对照 —— 白名单外 `-1` debit 必红 `PLATFORM_DEBIT_FORBIDDEN`；`-1` credit 新 kind 必红
 *        `PLATFORM_CREDIT_KIND_FORBIDDEN`。
 * 每段「改动前后两读数」+ 末尾**表级零残渣**（`before == after`）。
 * 写库一律事务内 + 末尾 `ROLLBACK`（禁 `COMMIT`）；入 `.p9s5-impl/`（不入 `scripts/` 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { settleJob } from '../src/job-funds-service';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, '..', '.p9s5-impl');
fs.mkdirSync(OUT, { recursive: true });
const SENT = 'P9S5_C14_ROLLBACK';
const CID = '1';
const FEE = '-1';
const fp = (parts: Array<string | number>) => createHash('sha256').update(parts.join('|')).digest('hex');
const strOf = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const counts = async (q: <T>(s: string, p?: unknown[]) => Promise<T[]>) => {
  const r = (await q<Record<string, unknown>>(`SELECT
    (SELECT count(*)::int FROM public.batt_account) AS batt_account,
    (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
    (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
    (SELECT count(*)::int FROM public.account) AS account,
    (SELECT count(*)::int FROM public.users) AS users`))[0] ?? {};
  return { batt_account: Number(r.batt_account), batt_entry: Number(r.batt_entry),
    ledger_entry: Number(r.ledger_entry), account: Number(r.account), users: Number(r.users) };
};

const tryJs = async <T>(tx: TxClient, label: string, fn: () => Promise<T>) => {
  const sp = `sp_${Math.random().toString(36).slice(2, 8)}`;
  await tx.query(`SAVEPOINT ${sp}`);
  try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT ${sp}`); return { label, ok: true as const, value: v }; }
  catch (e) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => undefined);
    const err = e as { code?: string; message?: string; details?: unknown; detail?: string };
    let reason: string | null = null;
    try { reason = (JSON.parse(strOf(err.detail)) as { reason?: string })?.reason ?? null; } catch { /* noop */ }
    return { label, ok: false as const, sqlstate: strOf(err.code), message: strOf(err.message).slice(0, 160),
      reason, detail: strOf(err.detail).replace(/\s+/g, ' ').slice(0, 240), details: err.details ?? null };
  }
};

const rewardRows = async (tx: TxClient, key: string) =>
  (await tx.query(`SELECT txid::text AS txid, uid::text AS uid, delta::text AS delta, kind,
      idempotency_key, event_root_key, ref_type, ref_id::text AS ref_id, memo FROM public.ledger_entry
     WHERE event_root_key = $1 OR split_part(idempotency_key,'#',1) = $1 ORDER BY txid`, [key])).rows;

(async () => {
  const readQ = <T>(s: string, p?: unknown[]) => readQuery<T>(s, p);
  const out: Record<string, unknown> = {
    unit: 'P9S5-C14-REALCHAIN', generated_at: new Date().toISOString(), run: RUN,
    note: '单事务内 + 末尾 ROLLBACK（禁 COMMIT）；段①注册真路径 / 段②首任务腿方法 / 段③接线后经结算路径 / 段④负对照。',
  };
  out.before = await counts(readQ);
  const pre = (await readQ<Record<string, unknown>>(
    `SELECT ledger_kind_ok('invite_first_task_reward') AS k,
            (SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1) AS v,
            (SELECT count(*)::int FROM public.commission_policy) AS policies`))[0] ?? {};
  out.precondition = { db_kind_ok_new: pre.k ?? null, schema_version: pre.v ?? null, commission_policy_rows: pre.policies ?? null };

  let execErr: string | null = null;
  const seg: Record<string, unknown> = {};

  try {
    await withTransaction(async (tx: TxClient) => {
      const q = <T>(s: string, p?: unknown[]) => tx.query<T>(s, p).then((r) => r.rows);
      const evmOf = (s: string) => `0x${createHash('sha256').update(`c14:${RUN}:${s}`).digest('hex').slice(0, 40)}`;

      // ---------- fixtures（事务内；末尾一并回滚） ----------
      // 雇主：取一条活体有余额的 `$` 账户（出账/冻结用；事务内一切回滚）
      const empRow = (await q<Record<string, unknown>>(
        `SELECT a.uid::text AS uid, a.balance::text AS balance FROM public.account a
          WHERE a.cid = 1 AND a.balance >= 1000 AND a.uid > 0 ORDER BY a.balance DESC LIMIT 1`))[0] ?? {};
      const employer = strOf(empRow.uid);
      seg.fixtures_employer = { uid: employer, balance: strOf(empRow.balance) };

      // 夹具用户（显式 uid；BY DEFAULT identity 允许）
      const users = [990001, 990002, 990003, 990004, 990005];
      for (const uid of users) {
        await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
          VALUES ($1, $2, '', false, now(), now())`, [uid, evmOf(`u${uid}`)]);
      }
      // referral：990001→990002（N=2）；990004→990005（③ 用）；990003 无上级
      await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [990001, 990002]);
      await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [990004, 990005]);
      // 首任务腿读口用 job（② 只需 worker_uid；不结算）
      const mkJob = async (worker: number, tag: string) => {
        const r = (await q<Record<string, unknown>>(
          `INSERT INTO public.job (employer_uid, cid, reward, title, description, status, create_key, worker_uid)
           VALUES ($1::bigint, 1, 100, $2, '', 'open', $3, $4::bigint) RETURNING job_id::text AS job_id`,
          [employer, tag, `cli:c14-${RUN}-${tag}`, worker]))[0] ?? {};
        return strOf(r.job_id);
      };
      const J1 = await mkJob(990001, 'j1-n2');
      const J2 = await mkJob(990003, 'j2-n1');
      seg.fixtures_jobs = { J1, J2 };

      // ================= 段 ①：注册真路径（findOrCreateUserByEvm 建户分支） =================
      const evmA = evmOf('reg-a');
      const u1 = await DatabaseService.findOrCreateUserByEvm(evmA, tx);
      const battAfter1 = (await q<Record<string, unknown>>(
        `SELECT batt FROM public.batt_account WHERE uid=$1`, [u1.uID]))[0] ?? {};
      const ent1 = await q<Record<string, unknown>>(
        `SELECT delta, batt_after, reason, idempotency_key FROM public.batt_entry WHERE uid=$1 ORDER BY txid`, [u1.uID]);
      // 二次调用 ⇒ 建户分支不再命中 ⇒ 零新增
      const u2 = await DatabaseService.findOrCreateUserByEvm(evmA, tx);
      const battAfter2 = (await q<Record<string, unknown>>(
        `SELECT batt FROM public.batt_account WHERE uid=$1`, [u1.uID]))[0] ?? {};
      const ent2 = await q<Record<string, unknown>>(
        `SELECT delta, reason, idempotency_key FROM public.batt_entry WHERE uid=$1 ORDER BY txid`, [u1.uID]);
      // 奖励腿幂等（同键重放 ⇒ 零新增）
      const reGrant = await DatabaseService.grantSignupInviteBatt(u1.uID, tx);
      const ent3 = await q<Record<string, unknown>>(
        `SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [u1.uID]);
      seg.S1_register = {
        uid: strOf(u1.uID), evm: evmA,
        first_call: { batt: Number(battAfter1.batt ?? 0), batt_entry_rows: ent1.length, entry: ent1 },
        second_call_same_uid: strOf(u2.uID) === strOf(u1.uID),
        after_replay: { batt: Number(battAfter2.batt ?? 0), batt_entry_rows: ent2.length },
        reward_leg_replay: { outcome: reGrant.outcome, batt_entry_rows: Number((ent3[0] ?? {}).n ?? 0) },
        batt_entry_rows_for_new_uid: Number((ent3[0] ?? {}).n ?? 0),
      };

      // ================= 段 ②：首任务腿（方法真跑 · 注入 ex） =================
      const key1 = `biz:invite:firsttask:990001`;
      const rows1Before = await rewardRows(tx, key1);
      const m1 = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: J1 }, tx);
      const rows1After = await rewardRows(tx, key1);
      const m1b = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: J1 }, tx);
      const rows1After2 = await rewardRows(tx, key1);
      const key2 = `biz:invite:firsttask:990003`;
      const m2 = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: J2 }, tx);
      const rows2 = await rewardRows(tx, key2);
      seg.S2_first_task = {
        N2: { outcome: m1.outcome, recipients: m1.recipientUids, total: m1.totalUsdFromPlatform, key: m1.idempotencyKey,
          rows_before: rows1Before.length,
          rows_after: rows1After.map((x) => ({ uid: x.uid, delta: x.delta, ref: `${x.ref_type}:${x.ref_id}` })),
          event_root_key: strOf(rows1After[0]?.event_root_key) },
        N2_replay: { outcome: m1b.outcome, rows_before: rows1After.length, rows_after: rows1After2.length },
        N1: { outcome: m2.outcome, recipients: m2.recipientUids, total: m2.totalUsdFromPlatform, key: m2.idempotencyKey,
          rows: rows2.map((x) => ({ uid: x.uid, delta: x.delta })) },
      };

      // ================= 段 ③：接线后经结算路径触发（settleJob → dispatchJobEvent → 奖励） =================
      // 建可结算 job：publish（冻结雇主 reward）→ accepted(worker=990004) → submitted → settleJob
      const pubKey = `cli:c14-${RUN}-j3-publish`;
      const pub = await tx.query<{ r: Record<string, unknown> }>(
        `SELECT public.job_post_event($1::jsonb) AS r`,
        [JSON.stringify({ op: 'publish', create_key: pubKey, employer_uid: employer, cid: CID, reward: '100', title: 'c14 settle', description: '' })]);
      const J3 = strOf(((pub.rows[0]?.r ?? {}) as Record<string, unknown>).job_id);
      await tx.query(`UPDATE public.job SET status='accepted', worker_uid=990004 WHERE job_id=$1::bigint AND status='open'`, [J3]);
      await tx.query(`UPDATE public.job SET status='submitted' WHERE job_id=$1::bigint AND status='accepted'`, [J3]);
      const key3 = `biz:invite:firsttask:990004`;
      const rows3Before = await rewardRows(tx, key3);
      const settleRes = await settleJob({ jobIdRaw: J3, reviewerUid: Number(employer) || 1 }, tx);
      const rows3After = await rewardRows(tx, key3);
      const job3Row = (await q<Record<string, unknown>>(
        `SELECT status, settle_txid::text AS settle_txid FROM public.job WHERE job_id=$1::bigint`, [J3]))[0] ?? {};
      // 结算重放 ⇒ 奖励零新增
      const settleReplay = await settleJob({ jobIdRaw: J3, reviewerUid: Number(employer) || 1 }, tx);
      const rows3After2 = await rewardRows(tx, key3);
      seg.S3_wired_settle = {
        job_id: J3,
        settle: { ok: settleRes.ok, replay: (settleRes as { replay?: boolean }).replay, job_status: strOf(job3Row.status),
          settle_txid: strOf(job3Row.settle_txid) },
        reward_rows_before: rows3Before.length,
        reward_rows_after: rows3After.map((x) => ({ uid: x.uid, delta: x.delta, ref: `${x.ref_type}:${x.ref_id}`, key: x.idempotency_key })),
        reward_event_root_key: strOf(rows3After[0]?.event_root_key),
        settle_replay: { ok: settleReplay.ok, replay: (settleReplay as { replay?: boolean }).replay,
          reward_rows_before: rows3After.length, reward_rows_after: rows3After2.length },
      };

      // ================= 段 ④：负对照（白名单外 -1 mutation 必红） =================
      const neg = (entries: unknown[], key: string) => tryJs(tx, key, () =>
        tx.query(`SELECT ledger_post_event($1::jsonb) AS r`,
          [JSON.stringify({ op: 'entries', idempotency_key: key, request_fingerprint: fp([key]), memo: 'p9s5-c14-neg',
            ref_type: 'job', ref_id: J1, entries })]).then((r) => r.rows[0]?.r));
      seg.S4_neg = {
        minus1_debit_nonwhitelist: await neg(
          [{ uid: FEE, cid: CID, kind: 'job_fee', delta: '-10', frozen_delta: '0' },
           { uid: '990002', cid: CID, kind: 'job_fee', delta: '10', frozen_delta: '0' }], 'ops:p9s5:c14:neg:debit'),
        minus1_credit_newkind: await neg(
          [{ uid: FEE, cid: CID, kind: 'invite_first_task_reward', delta: '10', frozen_delta: '0' },
           { uid: '990002', cid: CID, kind: 'invite_first_task_reward', delta: '-10', frozen_delta: '0' }], 'ops:p9s5:c14:neg:credit'),
      };

      throw new Error(SENT);
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 220)}` : msg.slice(0, 260);
  }

  out.after = await counts(readQ);
  out.rollback_clean = JSON.stringify(out.before) === JSON.stringify(out.after);
  out.exec_err = execErr;
  out.segments = seg;

  fs.writeFileSync(path.join(OUT, `c14-realchain-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  process.exit(execErr === null ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1200)); await closePools().catch(() => undefined); process.exit(2); });
