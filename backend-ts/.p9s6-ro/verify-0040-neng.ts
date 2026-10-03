/**
 * Neng 独立质检（P9⑥ 继承单）· 库面真态只读复核（零写；探针不入 scripts/ 扫面根）。
 * 全部读数**现取现跑**，不信任实现方/派单方证据。
 */
import { readQuery, closePools } from '../src/db';

type Row = Record<string, unknown>;
const g = async (s: string, p?: unknown[]) => (await readQuery<Row>(s, p))[0] ?? {};
const all = async (s: string, p?: unknown[]) => await readQuery<Row>(s, p);

(async () => {
  const out: Record<string, unknown> = { unit: 'P9S6-NENG-0040-DB-RO', generated_at: new Date().toISOString() };

  // ---- schema_migration ----
  out.mig = await g(`SELECT count(*)::int AS n, max(version) AS max_v FROM public.schema_migration`);
  out.mig_0040 = await all(`SELECT version, name, checksum, applied_at::text FROM public.schema_migration WHERE version='0040'`);

  // ---- 行数 ----
  out.batt_account_n = (await g(`SELECT count(*)::int AS n FROM public.batt_account`)).n;
  out.batt_entry_n = (await g(`SELECT count(*)::int AS n FROM public.batt_entry`)).n;
  out.users_n = (await g(`SELECT count(*)::int AS n FROM public.users`)).n;

  // ---- 按 reason 汇总 ----
  out.by_reason = await all(`SELECT reason, count(*)::int AS n, sum(delta)::int AS sum_delta
                             FROM public.batt_entry GROUP BY reason ORDER BY reason`);

  // ---- 补发行专项（delta / batt_after / key 形态 / memo）----
  out.backfill = await g(`SELECT count(*)::int AS n, count(distinct uid)::int AS uniq_uid,
       min(delta)::int AS min_d, max(delta)::int AS max_d, min(batt_after)::int AS min_a, max(batt_after)::int AS max_a
       FROM public.batt_entry WHERE idempotency_key LIKE 'biz:backfill:invite-signup:%'`);
  out.backfill_bad = await g(`SELECT
       count(*) FILTER (WHERE delta <> 30)::int AS bad_delta,
       count(*) FILTER (WHERE batt_after <> 30)::int AS bad_after,
       count(*) FILTER (WHERE reason <> 'invite_signup')::int AS bad_reason,
       count(*) FILTER (WHERE idempotency_key <> 'biz:backfill:invite-signup:' || uid::text)::int AS bad_key,
       count(*) FILTER (WHERE memo <> '存量补发（R-9-81 · D2）：P9⑤ 前注册用户一次性补发 +30 batt')::int AS bad_memo
       FROM public.batt_entry WHERE idempotency_key LIKE 'biz:backfill:invite-signup:%'`);
  out.backfill_acct_batt_bad = (await g(`SELECT count(*)::int AS n FROM public.batt_account AS b
       WHERE EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=b.uid AND e.idempotency_key LIKE 'biz:backfill:invite-signup:%')
         AND b.batt <> 30`)).n;
  out.backfill_acct_batt_hist = await all(`SELECT b.batt, count(*)::int AS n FROM public.batt_account AS b
       WHERE EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=b.uid AND e.idempotency_key LIKE 'biz:backfill:invite-signup:%')
       GROUP BY b.batt ORDER BY b.batt`);

  // ---- 幂等键重复 / 越界 ----
  out.dup_keys = (await g(`SELECT count(*)::int AS n FROM (SELECT idempotency_key FROM public.batt_entry
       GROUP BY idempotency_key HAVING count(*)>1) x`)).n;
  out.out_of_range = (await g(`SELECT count(*)::int AS n FROM public.batt_account WHERE batt < 0 OR batt > 100`)).n;

  // ---- 剩余目标（双重条件 / 单条件「无 batt_account 行」）----
  out.remaining_target_full = (await g(`SELECT count(*)::int AS n FROM public.users u
       WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
         AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')`)).n;
  out.remaining_no_acct = (await g(`SELECT count(*)::int AS n FROM public.users u
       WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)`)).n;
  out.remaining_no_invite_entry = (await g(`SELECT count(*)::int AS n FROM public.users u
       WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')`)).n;

  // ---- 既有（非补发归属）行 —— checkin 逐字未动对拍锚 ----
  out.preexist_acct = await all(`SELECT b.uid::text AS uid, b.batt, b.time_created::text AS t_created, b.time_updated::text AS t_updated
       FROM public.batt_account b
       WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=b.uid AND e.idempotency_key LIKE 'biz:backfill:invite-signup:%')
       ORDER BY b.uid`);
  out.preexist_acct_md5 = (await g(`SELECT md5(coalesce(string_agg(b.uid::text||':'||b.batt::text||':'||b.time_created::text||':'||b.time_updated::text, ',' ORDER BY b.uid),'')) AS m
       FROM public.batt_account b
       WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=b.uid AND e.idempotency_key LIKE 'biz:backfill:invite-signup:%')`)).m;
  out.preexist_entry = await all(`SELECT e.txid::text AS txid, e.uid::text AS uid, e.delta, e.batt_after, e.reason, e.idempotency_key, e.memo, e.time_created::text AS t_created
       FROM public.batt_entry e WHERE e.idempotency_key NOT LIKE 'biz:backfill:invite-signup:%' ORDER BY e.txid`);
  out.preexist_entry_md5 = (await g(`SELECT md5(coalesce(string_agg(e.txid::text||':'||e.uid::text||':'||e.delta::text||':'||e.batt_after::text||':'||e.reason||':'||e.idempotency_key, ',' ORDER BY e.txid),'')) AS m
       FROM public.batt_entry e WHERE e.idempotency_key NOT LIKE 'biz:backfill:invite-signup:%'`)).m;
  out.applied_at = (await g(`SELECT applied_at::text AS a FROM public.schema_migration WHERE version='0040'`)).a;

  // ---- Kevin 实例 uid 970213（evm 尾号 09b0）----
  out.kevin_user = await all(`SELECT uid::text AS uid, evm, is_admin FROM public.users WHERE evm ILIKE '%09b0'`);
  out.kevin_uid_970213 = await all(`SELECT u.uid::text AS uid, (SELECT b.batt FROM public.batt_account b WHERE b.uid=u.uid) AS batt,
       (SELECT count(*)::int FROM public.batt_entry e WHERE e.uid=u.uid) AS entry_n,
       (SELECT count(*)::int FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup') AS invite_signup_n
       FROM public.users u WHERE u.uid=970213`);
  out.kevin_entries = await all(`SELECT txid::text AS txid, delta, batt_after, reason, idempotency_key, memo
       FROM public.batt_entry WHERE uid=970213 ORDER BY txid`);

  // ---- app_config batt_policy 现取（只读）----
  out.batt_policy_row = await all(`SELECT key, value FROM public.app_config WHERE key='batt_policy'`);

  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1200)); await closePools().catch(() => undefined); process.exit(2); });
