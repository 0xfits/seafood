/**
 * D2 存量用户补发（R-9-81）· `0040_backfill_signup_batt.sql` 的 `R-9-24` 真跑自证（**不 apply**）。
 * 单事务内 `BEGIN; <负对照 fixture>; <0040 全文>; <重跑>; ROLLBACK;`（**禁 COMMIT**）+ 四项读数：
 *   ① 无错执行；② 回滚后 batt_account/batt_entry 行数回基线；③ schema_migration 无新行；
 *   ④ 目标对象逐字复原（md5 / 目标集合计数·uid md5 / 既有 batt_account uid 集回基线）。
 * 判负读数（事务内）：构造「无 batt_account 行 ∧ 已有 invite_signup entry」者 ⇒ **不得被补发**；
 *   既有 batt_account 行用户（条件①）⇒ 亦不得被补发；fixture 自身不改。
 * 写库一律事务内 + 末尾 ROLLBACK（禁 COMMIT）。入 .p8s6-impl/（不入 scripts/ 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, '..', '.p8s6-impl');
fs.mkdirSync(OUT, { recursive: true });
const SENT = 'D2_0040_ROLLBACK';
const KEY_PREFIX = 'biz:backfill:invite-signup:';

type Row = Record<string, unknown>;
type Q = <T>(s: string, p?: unknown[]) => Promise<T[]>;
const g = async (q: Q, s: string, p?: unknown[]) => (await q<Row>(s, p))[0] ?? {};
const all = async (q: Q, s: string, p?: unknown[]) => await q<Row>(s, p);

const TARGET_PRED = `NOT EXISTS (SELECT 1 FROM public.batt_account AS b WHERE b.uid = u.uid)
     AND NOT EXISTS (SELECT 1 FROM public.batt_entry AS e WHERE e.uid = u.uid AND e.reason = 'invite_signup')`;

const snap = async (q: Q) => {
  const mig = await g(q, `SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`);
  const acct = await g(q, `SELECT count(*)::int AS n,
     md5(coalesce(string_agg(uid::text||':'||batt::text||':'||time_created::text||':'||time_updated::text, ',' ORDER BY uid),'')) AS m
     FROM public.batt_account`);
  const entry = await g(q, `SELECT count(*)::int AS n,
     md5(coalesce(string_agg(txid::text||':'||uid::text||':'||delta::text||':'||batt_after::text||':'||reason||':'||idempotency_key, ',' ORDER BY txid),'')) AS m
     FROM public.batt_entry`);
  const tgt = await g(q, `SELECT count(*)::int AS n,
     md5(coalesce(string_agg(u.uid::text, ',' ORDER BY u.uid),'')) AS m
     FROM public.users AS u WHERE ${TARGET_PRED}`);
  const bf = await g(q, `SELECT count(*)::int AS n, count(DISTINCT uid)::int AS u
     FROM public.batt_entry WHERE idempotency_key LIKE '${KEY_PREFIX}%'`);
  const preAcct = await all(q, `SELECT uid::text AS uid FROM public.batt_account ORDER BY uid`);
  return {
    mig_rows: Number(mig.n ?? -1), mig_max: (mig.v ?? null) as string | null,
    acct_n: Number(acct.n ?? -1), acct_md5: String(acct.m ?? ''),
    entry_n: Number(entry.n ?? -1), entry_md5: String(entry.m ?? ''),
    target_n: Number(tgt.n ?? -1), target_md5: String(tgt.m ?? ''),
    backfill_n: Number(bf.n ?? -1), backfill_distinct_uid: Number(bf.u ?? -1),
    preexist_acct_uids: preAcct.map((r) => String(r.uid)),
  };
};

(async () => {
  const readQ: Q = <T>(s: string, p?: unknown[]) => readQuery<T>(s, p);
  const sql = fs.readFileSync(path.resolve(ROOT, 'migrations/0040_backfill_signup_batt.sql'), 'utf8');
  const out: Record<string, unknown> = {
    unit: 'D2-R981-0040-R9-24-REALRUN', generated_at: new Date().toISOString(), run: RUN,
    file: 'migrations/0040_backfill_signup_batt.sql', bytes: Buffer.byteLength(sql, 'utf8'), lines: sql.split('\n').length,
    note: '单事务 BEGIN;<负对照 fixture>;<0040 全文>;<重跑>;ROLLBACK（禁 COMMIT）；不 apply。',
    key_prefix: KEY_PREFIX,
  };

  const before = await snap(readQ);
  let execErr: string | null = null;
  let rerunErr: string | null = null;
  const inTx: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx: TxClient) => {
      const q = <T>(s: string, p?: unknown[]) => tx.query<T>(s, p).then((r) => r.rows);

      // ---- 负对照 fixture：挑一个目标用户（无 batt_account 行），仅塞 1 条 reason='invite_signup' 流水 ----
      const fix = await g(q, `SELECT min(u.uid)::text AS uid FROM public.users AS u WHERE ${TARGET_PRED}`);
      const fixUid = String(fix.uid);
      inTx.fixture_uid = fixUid;
      await tx.query(
        `INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
         SELECT $1::bigint, 30, 30, 'invite_signup', 'biz:invite:signup:' || $1::text, 'invite', $1::bigint,
                '负对照 fixture（R-9-81 判负：已有 invite_signup 者不得重复发放）'`,
        [fixUid],
      );
      const afterFix = await snap(q);
      inTx.target_n_with_fixture = afterFix.target_n;      // 应 = 基线目标 - 1
      inTx.entry_n_with_fixture = afterFix.entry_n;        // 基线 entry + 1
      inTx.mid_fixture_acct_md5 = afterFix.acct_md5;       // fixture 后「既有 batt_account」基线
      inTx.mid_fixture_entry_md5 = afterFix.entry_md5;     // fixture 后「既有 batt_entry」基线（含 fixture）

      // ---- 第一次真跑 0040 全文（含文件内 DO 自检）----
      await tx.query(sql);
      const post = await snap(q);
      inTx.post_acct_n = post.acct_n;
      inTx.post_entry_n = post.entry_n;
      inTx.post_target_n = post.target_n;                  // 应 = 0
      inTx.post_backfill_n = post.backfill_n;
      inTx.post_backfill_distinct_uid = post.backfill_distinct_uid;
      inTx.post_acct_md5 = post.acct_md5;
      inTx.post_entry_md5 = post.entry_md5;

      // 补发行专项：delta / reason / key 形态
      inTx.post_bad_delta = (await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
        WHERE idempotency_key LIKE '${KEY_PREFIX}%' AND delta <> 30`)).n;
      inTx.post_bad_reason = (await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
        WHERE idempotency_key LIKE '${KEY_PREFIX}%' AND reason <> 'invite_signup'`)).n;
      inTx.post_bad_key = (await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
        WHERE idempotency_key LIKE '${KEY_PREFIX}%' AND idempotency_key <> '${KEY_PREFIX}' || uid::text`)).n;
      inTx.post_memo_bad = (await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
        WHERE idempotency_key LIKE '${KEY_PREFIX}%' AND memo <> '存量补发（R-9-81 · D2）：P9⑤ 前注册用户一次性补发 +30 batt'`)).n;
      inTx.post_bad_acct_batt = (await g(q, `SELECT count(*)::int AS n FROM public.batt_account AS b
        WHERE EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=b.uid AND e.idempotency_key LIKE '${KEY_PREFIX}%')
          AND b.batt <> 30`)).n;

      // 逐字未动：既有行（非补发归属）指纹前后对拍
      inTx.post_preexist_acct_md5 = (await g(q, `SELECT md5(coalesce(string_agg(b.uid::text||':'||b.batt::text||':'||b.time_created::text||':'||b.time_updated::text, ',' ORDER BY b.uid),'')) AS m
        FROM public.batt_account AS b
        WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=b.uid AND e.idempotency_key LIKE '${KEY_PREFIX}%')`)).m;
      inTx.post_preexist_entry_md5 = (await g(q, `SELECT md5(coalesce(string_agg(e.txid::text||':'||e.uid::text||':'||e.delta::text||':'||e.batt_after::text||':'||e.reason||':'||e.idempotency_key, ',' ORDER BY e.txid),'')) AS m
        FROM public.batt_entry AS e WHERE e.idempotency_key NOT LIKE '${KEY_PREFIX}%'`)).m;

      // ---- 判负读数 ----
      inTx.neg2_fixture_backfill_rows = (await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
        WHERE idempotency_key = '${KEY_PREFIX}' || $1::text`, [fixUid])).n;        // 应 0
      inTx.neg2_fixture_batt_account_rows = (await g(q, `SELECT count(*)::int AS n FROM public.batt_account
        WHERE uid = $1::bigint`, [fixUid])).n;                                     // 应 0
      inTx.neg2_fixture_invite_signup_entry_rows = (await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
        WHERE uid = $1::bigint AND reason='invite_signup'`, [fixUid])).n;          // 应 1（fixture 自身，未被改）
      const preUidList = before.preexist_acct_uids;
      inTx.neg1_preexist_acct_backfill_rows = preUidList.length
        ? Number((await g(q, `SELECT count(*)::int AS n FROM public.batt_entry
            WHERE idempotency_key LIKE '${KEY_PREFIX}%' AND uid = ANY($1::bigint[])`, [preUidList])).n)
        : 0;                                                                        // 应 0

      // ---- 重跑（幂等）：同事务内再跑一次 0040 全文 ⇒ 目标应为 0、零新增 ----
      const beforeRerun = await snap(q);
      try {
        await tx.query(sql);
      } catch (e) {
        rerunErr = `${(e as { code?: string }).code ?? ''}:${String((e as Error)?.message ?? e).slice(0, 200)}`;
      }
      const afterRerun = await snap(q);
      inTx.rerun_target_n = afterRerun.target_n;
      inTx.rerun_backfill_n = afterRerun.backfill_n;
      inTx.rerun_acct_n = afterRerun.acct_n;
      inTx.rerun_entry_n = afterRerun.entry_n;
      inTx.rerun_delta_backfill = afterRerun.backfill_n - beforeRerun.backfill_n;
      inTx.rerun_delta_acct = afterRerun.acct_n - beforeRerun.acct_n;
      inTx.rerun_delta_entry = afterRerun.entry_n - beforeRerun.entry_n;

      throw new Error(SENT);
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 240)}` : msg.slice(0, 260);
  }
  const after = await snap(readQ);

  const expBackfill = before.target_n - 1; // 去掉 fixture 那位
  out.reads = {
    '1_no_error': execErr === null,
    exec_err: execErr,
    rerun_err: rerunErr,
    '2_rows_back_to_baseline':
      after.acct_n === before.acct_n && after.entry_n === before.entry_n && after.backfill_n === 0,
    acct_n_before: before.acct_n, acct_n_after: after.acct_n,
    entry_n_before: before.entry_n, entry_n_after: after.entry_n,
    backfill_n_after: after.backfill_n,
    '3_schema_migration_no_new_row': after.mig_rows === before.mig_rows && after.mig_max === before.mig_max,
    mig_rows_before: before.mig_rows, mig_rows_after: after.mig_rows,
    mig_max_before: before.mig_max, mig_max_after: after.mig_max,
    '4_target_object_restored':
      after.acct_md5 === before.acct_md5 && after.entry_md5 === before.entry_md5
      && after.target_n === before.target_n && after.target_md5 === before.target_md5
      && JSON.stringify(after.preexist_acct_uids) === JSON.stringify(before.preexist_acct_uids),
    acct_md5_before: before.acct_md5, acct_md5_after: after.acct_md5,
    entry_md5_before: before.entry_md5, entry_md5_after: after.entry_md5,
    target_n_before: before.target_n, target_n_after: after.target_n,
    target_md5_before: before.target_md5, target_md5_after: after.target_md5,
    preexist_acct_uids_before: before.preexist_acct_uids, preexist_acct_uids_after: after.preexist_acct_uids,
    // 事务内正向读数
    in_tx_backfill_n_expected: expBackfill,
    in_tx_target_n_with_fixture: inTx.target_n_with_fixture,
    in_tx_post_target_n: inTx.post_target_n,
    '5_grant_rowcount_equals_target': inTx.post_backfill_n === expBackfill,
    '6_existing_rows_untouched':
      inTx.post_preexist_acct_md5 === inTx.mid_fixture_acct_md5
      && inTx.post_preexist_entry_md5 === inTx.mid_fixture_entry_md5,
    // 判负读数
    '7_neg_no_dup_for_existing_invite_signup': inTx.neg2_fixture_backfill_rows === 0 && inTx.neg2_fixture_batt_account_rows === 0,
    '8_neg_preexist_batt_account_excluded': inTx.neg1_preexist_acct_backfill_rows === 0,
    '9_rerun_idempotent_zeronew':
      inTx.rerun_delta_backfill === 0 && inTx.rerun_delta_acct === 0 && inTx.rerun_delta_entry === 0 && rerunErr === null,
  };
  out.before = before;
  out.after = after;
  out.in_tx = inTx;

  fs.writeFileSync(path.join(OUT, `r9-24-0040-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  const r = out.reads as Record<string, unknown>;
  const ok = ['1_no_error', '2_rows_back_to_baseline', '3_schema_migration_no_new_row', '4_target_object_restored',
    '5_grant_rowcount_equals_target', '6_existing_rows_untouched',
    '7_neg_no_dup_for_existing_invite_signup', '8_neg_preexist_batt_account_excluded', '9_rerun_idempotent_zeronew']
    .every((k) => r[k] === true);
  process.exit(ok ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1200)); await closePools().catch(() => undefined); process.exit(2); });
