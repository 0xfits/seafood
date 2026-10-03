/**
 * D2 存量用户补发（R-9-81）· 只读现取探针（零写；不入 scripts/ 扫面根）。
 * 现取：batt_account 列形/约束 · batt_entry 全列/约束/append-only 触发器 ·
 *      schema_migration 现态 · 目标集合逐计数（无 batt_account 行 ∧ 无 invite_signup entry）。
 */
import { readQuery, closePools } from '../src/db';

type Row = Record<string, unknown>;
const g = async (s: string, p?: unknown[]) => (await readQuery<Row>(s, p))[0] ?? {};
const all = async (s: string, p?: unknown[]) => await readQuery<Row>(s, p);

(async () => {
  const out: Record<string, unknown> = { unit: 'D2-R981-COUNT-RO', generated_at: new Date().toISOString() };

  out.mig = await g(`SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`);
  out.mig_rows = await all(`SELECT version, name FROM schema_migration ORDER BY version`);

  // ---- batt_account 列形 ----
  out.batt_account_columns = await all(`SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema='public' AND table_name='batt_account' ORDER BY ordinal_position`);
  out.batt_account_constraints = await all(`SELECT conname, contype, pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE conrelid='public.batt_account'::regclass ORDER BY conname`);
  out.batt_account_triggers = await all(`SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS def
     FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='batt_account' AND NOT t.tgisinternal`);

  // ---- batt_entry 列形 ----
  out.batt_entry_columns = await all(`SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema='public' AND table_name='batt_entry' ORDER BY ordinal_position`);
  out.batt_entry_constraints = await all(`SELECT conname, contype, pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE conrelid='public.batt_entry'::regclass ORDER BY conname`);
  out.batt_entry_triggers = await all(`SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS def
     FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='batt_entry' AND NOT t.tgisinternal`);

  out.users_columns = await all(`SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);

  // ---- 目标集合逐计数 ----
  out.n_users_total = (await g(`SELECT count(*)::int AS n FROM public.users`)).n;
  out.n_no_batt_account = (await g(`SELECT count(*)::int AS n FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)`)).n;
  out.n_no_invite_signup_entry = (await g(`SELECT count(*)::int AS n FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')`)).n;
  out.n_target = (await g(`SELECT count(*)::int AS n FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
       AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')`)).n;
  out.n_target_after_minus = (await g(`SELECT count(*)::int AS n FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
        OR NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')`)).n;

  out.batt_account_rows = (await g(`SELECT count(*)::int AS n FROM public.batt_account`)).n;
  out.batt_entry_rows = (await g(`SELECT count(*)::int AS n FROM public.batt_entry`)).n;
  out.batt_entry_reason_hist = await all(`SELECT reason, count(*)::int AS n FROM public.batt_entry GROUP BY reason ORDER BY reason`);
  out.batt_entry_key_prefix_hist = await all(`SELECT split_part(idempotency_key, ':', 1) AS p1,
     split_part(idempotency_key, ':', 2) AS p2, count(*)::int AS n
     FROM public.batt_entry GROUP BY 1,2 ORDER BY 1,2`);

  // 实例 uid 970213
  out.uid_970213 = await all(`SELECT u.uid, (SELECT b.batt FROM public.batt_account b WHERE b.uid=u.uid) AS batt,
     (SELECT count(*)::int FROM public.batt_entry e WHERE e.uid=u.uid) AS entry_rows
     FROM public.users u WHERE u.uid=970213`);

  // 目标集合样本（前 20 uid） + uid 基线 hash
  out.target_sample = await all(`SELECT u.uid FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
       AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')
     ORDER BY u.uid LIMIT 20`);
  out.target_uid_md5 = (await g(`SELECT md5(coalesce(string_agg(u.uid::text, ',' ORDER BY u.uid),'')) AS m
     FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uid)
       AND NOT EXISTS (SELECT 1 FROM public.batt_entry e WHERE e.uid=u.uid AND e.reason='invite_signup')`)).m;

  // batt_account / batt_entry 现状对拍基线（md5 全表）
  out.batt_account_md5 = (await g(`SELECT md5(coalesce(string_agg(uid::text||':'||batt::text, ',' ORDER BY uid),'')) AS m
     FROM public.batt_account`)).m;
  out.batt_entry_md5 = (await g(`SELECT md5(coalesce(string_agg(txid::text||':'||uid::text||':'||delta::text||':'||batt_after::text||':'||reason||':'||idempotency_key, ',' ORDER BY txid),'')) AS m
     FROM public.batt_entry`)).m;

  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1200)); await closePools().catch(() => undefined); process.exit(2); });
