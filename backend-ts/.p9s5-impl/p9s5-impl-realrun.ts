/**
 * P9⑤ 收尾单 A · ② 两新方法真跑（单事务内先跑 0038 全文再调用；末尾 ROLLBACK；不 apply）。
 *   · 注册腿：`DatabaseService.grantSignupInviteBatt(uid, tx)`（方法自带事务内注入口 `ex`）——
 *     建行 +30 / 重放零新增 / 已有 batt 封顶。
 *   · 首任务腿：`settleInviteFirstTaskReward` **不接收 `ex`**，其写路径 = 高层 `postEvent`
 *     （自带连接 · 单语句隐式事务 · `ledger.ts:1040-1057`）⇒ **无法加入本事务**；故账本腿在**同事务内**
 *     以其**逐字同形的 `ledger_post_event` payload**（镜像 `database.ts:4744-4761`）真跑：
 *     `-1` 出 `-(perLeg×N)` + 每受益人 `+perLeg`、重放零新增、无上级只发本人、白名单外必红。
 *   · 另附：`settleInviteFirstTaskReward` 事务内/原生两次真跑，取证「其写连接不共享本事务」。
 * 写库一律事务内 + 末尾 ROLLBACK。入 .p9s5-impl/（不入 scripts/ 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, '..', '.p9s5-impl');
fs.mkdirSync(OUT, { recursive: true });
const SENT = 'P9S5_IMPL_ROLLBACK';
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
    return { label, ok: false as const, sqlstate: strOf(err.code), message: strOf(err.message).slice(0, 160),
      reason_detail: strOf(err.detail).replace(/\s+/g, ' ').slice(0, 220), details: err.details ?? null };
  }
};

/** 镜像 `database.ts:4744-4761`：构造与 settleInviteFirstTaskReward 逐字同形的 op='entries' payload。 */
const buildRewardPayload = (jobId: string, workerUid: string, parentUid: string | null, perLeg: number) => {
  const recipients = parentUid ? [workerUid, parentUid] : [workerUid];
  const total = perLeg * recipients.length;
  const key = `biz:invite:firsttask:${workerUid}`;
  const memoBase = `邀请首任务奖励（平台发放）job=${jobId}`;
  const entries = [
    { uid: FEE, cid: CID, kind: 'invite_first_task_reward', delta: String(-total), frozen_delta: '0',
      ref_type: 'job', ref_id: jobId, memo: `${memoBase}（平台出账）` },
    ...recipients.map((u, i) => ({ uid: u, cid: CID, kind: 'invite_first_task_reward', delta: String(perLeg),
      frozen_delta: '0', ref_type: 'job', ref_id: jobId,
      memo: i === 0 ? `${memoBase}（打工人本人）` : `${memoBase}（直接上级）` })),
  ];
  const payload = { op: 'entries', idempotency_key: key, request_fingerprint: fp(['invite.first_task', jobId, workerUid, parentUid ?? '-', perLeg]),
    memo: memoBase, ref_type: 'job', ref_id: jobId, entries };
  return { key, recipients, total, payload };
};

const postReward = async (tx: TxClient, payload: unknown) =>
  (await tx.query('SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)])).rows[0]?.r;

const rewardRows = async (tx: TxClient, key: string) =>
  (await tx.query(`SELECT uid::text AS uid, delta::text AS delta, kind, idempotency_key,
      event_root_key, ref_type, ref_id::text AS ref_id FROM public.ledger_entry
     WHERE event_root_key = $1 OR idempotency_key LIKE $2 ORDER BY txid`, [key, `${key}%`])).rows;

(async () => {
  const readQ = <T>(s: string, p?: unknown[]) => readQuery<T>(s, p);
  const sql38 = fs.readFileSync(path.resolve(ROOT, 'migrations/0038_kind_close_set_24.sql'), 'utf8');
  const out: Record<string, unknown> = {
    unit: 'P9S5-IMPL-REALRUN', generated_at: new Date().toISOString(), run: RUN,
    note: '单事务内先跑 0038 全文再调用；末尾 ROLLBACK（禁 COMMIT）；不 apply。',
  };
  out.before = await counts(readQ);

  let execErr: string | null = null;
  const inTx: Record<string, unknown> = {};

  // ---- 事务外（原生）尝试：settleInviteFirstTaskReward 写连接是否共享本事务的对照
  // 前置换行闸：DB 现取 kind 闭集不含新 kind ⇒ 写必被拦（不会真写）。
  const pre = (await readQ<Record<string, unknown>>(
    `SELECT ledger_kind_ok('invite_first_task_reward') AS k, (SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1) AS v`))[0] ?? {};
  out.precondition = { db_kind_ok_new: pre.k ?? null, schema_version: pre.v ?? null };
  if (pre.k === true) {
    out.native_settle_method = { skipped: 'DB 已含新 kind ⇒ 为守「不得真写」跳过原生真跑' };
  } else {
    try {
      const r = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: '8' });
      out.native_settle_method = { ok: true, returned: r };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      out.native_settle_method = { ok: false, sqlstate: strOf(err.code), code_name: strOf(err.message).slice(0, 120) };
    }
  }

  try {
    await withTransaction(async (tx: TxClient) => {
      const q = <T>(s: string, p?: unknown[]) => tx.query<T>(s, p).then((r) => r.rows);
      await tx.query(sql38);   // ★ 同事务先跑 0038 全文

      // ---------- fixtures（事务内；末尾一并回滚）
      const users = [990001, 990002, 990003, 990011, 990012, 990013, 990014];
      const evmOf = (uid: number) => `0x${uid.toString(16).padStart(40, '0')}`;
      for (const uid of users) {
        await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
          VALUES ($1, $2, '', false, now(), now())`, [uid, evmOf(uid)]);
      }
      await tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [990001, 990002]);   // W2 → P2
      await tx.query(`INSERT INTO public.batt_account (uid, batt, time_created, time_updated) VALUES
        (990012, 90, now(), now()), (990013, 100, now(), now())`);
      inTx.fixtures_ok = true;

      // ---------- 注册腿（方法真跑 · 事务内注入 ex）
      const g = async (uid: number) => {
        const r = await DatabaseService.grantSignupInviteBatt(uid, tx);
        const acct = (await q<Record<string, unknown>>('SELECT batt FROM public.batt_account WHERE uid=$1', [uid]))[0] ?? {};
        const entry = await q<Record<string, unknown>>(`SELECT delta, batt_after, reason, idempotency_key
          FROM public.batt_entry WHERE uid=$1 ORDER BY txid`, [uid]);
        return { ...r, batt_row: acct.batt ?? null, batt_entry_rows: entry };
      };
      inTx.grant_G1_new = await g(990011);                    // 无 batt 行 ⇒ 建行 +30
      inTx.grant_G2_replay = await g(990011);                 // 重放 ⇒ 零新增
      inTx.grant_G3_capped = await g(990012);                 // 90 ⇒ +30 封顶 100（丢弃 20）
      inTx.grant_G4_fullcap = await g(990013);                // 100 ⇒ +30 全丢弃
      // 策略键事务内 INSERT（严禁 UPDATE app_config；仅 INSERT）⇒ 走 config 源
      await tx.query(`INSERT INTO public.app_config (key, value, updated_by) VALUES
        ('invite_reward_policy', '{"signupBatt":40,"firstTaskUsd":25,"rewardLevels":6}'::jsonb, -1)`);
      inTx.grant_G5_config_source = await g(990014);          // config 源 ⇒ 40

      // ---------- 首任务腿（账本腿 · 同事务内 ledger_post_event · 方法写入面等价）
      // S1 N=2：本人 + 直接上级各 10$，-1 出 20$
      const s1 = buildRewardPayload('9900002', '990001', '990002', 10);
      const beforeS1 = await rewardRows(tx, s1.key);
      const r1 = await postReward(tx, s1.payload);
      const afterS1 = await rewardRows(tx, s1.key);
      inTx.settle_S1_N2 = { key: s1.key, recipients: s1.recipients, total: s1.total,
        rows_before: beforeS1.length, rows_after: afterS1.map((x) => ({ uid: x.uid, delta: x.delta, ref: `${x.ref_type}:${x.ref_id}` })),
        event_root_key: afterS1[0]?.event_root_key ?? null, replay: (r1 as Record<string, unknown>)?.idempotent_replay ?? null };
      // S2 重放（同键同 payload）⇒ 零新增
      const r2 = await postReward(tx, s1.payload);
      const afterS2 = await rewardRows(tx, s1.key);
      inTx.settle_S2_replay = { replay: (r2 as Record<string, unknown>)?.idempotent_replay ?? null,
        rows_before: afterS1.length, rows_after: afterS2.length };
      // S3 无上级 N=1：只发本人 10$，-1 出 10$
      const s3 = buildRewardPayload('9900003', '990003', null, 10);
      const r3 = await postReward(tx, s3.payload);
      const afterS3 = await rewardRows(tx, s3.key);
      inTx.settle_S3_N1 = { key: s3.key, recipients: s3.recipients, total: s3.total,
        rows: afterS3.map((x) => ({ uid: x.uid, delta: x.delta })), replay: (r3 as Record<string, unknown>)?.idempotent_replay ?? null };

      // ---------- 负对照（白名单外 -1 mutation ⇒ 必红）
      const neg = (entries: unknown[], key: string) => tryJs(tx, key, () => tx.query('SELECT ledger_post_event($1::jsonb)',
        [JSON.stringify({ op: 'entries', idempotency_key: key, request_fingerprint: fp([key]), memo: 'p9s5-neg', ref_type: 'job', ref_id: '9900009', entries })]).then((r) => r.rows[0]?.r));
      // N1: -1 debit 非白名单 kind（job_fee）—— 平衡事件（-1:-10 / user:+10）
      inTx.neg_N1_minus1_debit_jobfee = await neg(
        [{ uid: '-1', cid: '1', kind: 'job_fee', delta: '-10', frozen_delta: '0' },
         { uid: '990001', cid: '1', kind: 'job_fee', delta: '10', frozen_delta: '0' }], 'ops:p9s5:neg:n1');
      // N2: -1 debit 白名单外 kind（trade_fee）
      inTx.neg_N2_minus1_debit_tradefee = await neg(
        [{ uid: '-1', cid: '1', kind: 'trade_fee', delta: '-10', frozen_delta: '0' },
         { uid: '990001', cid: '1', kind: 'trade_fee', delta: '10', frozen_delta: '0' }], 'ops:p9s5:neg:n2');
      // N3: -1 credit 非白名单 kind（commission）
      inTx.neg_N3_minus1_credit_commission = await neg(
        [{ uid: '-1', cid: '1', kind: 'commission', delta: '10', frozen_delta: '0' },
         { uid: '990001', cid: '1', kind: 'commission', delta: '-10', frozen_delta: '0' }], 'ops:p9s5:neg:n3');

      // ---------- 方法事务内真跑（对照：其写连接不共享本事务）
      inTx.method_in_tx_attempt = await tryJs(tx, 'settle-method-in-tx',
        () => DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: '8' }));

      throw new Error(SENT);
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 220)}` : msg.slice(0, 260);
  }

  out.after = await counts(readQ);
  out.rollback_clean = JSON.stringify(out.before) === JSON.stringify(out.after);
  out.exec_err = execErr;
  out.in_tx = inTx;

  fs.writeFileSync(path.join(OUT, `p9s5-impl-realrun-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  process.exit(execErr === null ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1000)); await closePools().catch(() => undefined); process.exit(2); });
