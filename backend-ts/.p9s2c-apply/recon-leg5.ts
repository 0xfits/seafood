import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const cnt = await readQuery<{ n: string }>(`SELECT count(*)::int::text AS n FROM public.checkin_log WHERE checkin_day=(now() AT TIME ZONE 'UTC')::date`);
  const makers = await readQuery<{ uid: string; day: string; n: string }>(`SELECT uid::text AS uid, target_day::text AS day, count(*)::int::text AS n FROM public.checkin_makeup_log WHERE result='applied' GROUP BY uid, target_day ORDER BY uid LIMIT 8`);
  const totalC = await readQuery<{ n: string }>(`SELECT count(*)::int::text AS n FROM public.checkin_log`);
  const totalM = await readQuery<{ n: string }>(`SELECT count(*)::int::text AS n FROM public.checkin_makeup_log`);
  const tabs = await readQuery<{ t: string }>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('batt_account','batt_entry','checkin_log','checkin_makeup_log') ORDER BY table_name`);
  const kind = await readQuery<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`);
  const nk = await readQuery<{ b: string }>(`SELECT ledger_kind_ok('checkin_makeup_fee',false)::text AS b`);
  const trg = await readQuery<{ t: string }>(`SELECT tgname AS t FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`);
  console.log(JSON.stringify({
    checkins_today: cnt[0]?.n, total_checkins: totalC[0]?.n, total_makeups: totalM[0]?.n,
    applied_makeups: makers, tables: tabs.map((x) => x.t),
    kind_def_len: kind[0]?.def?.length ?? 0, kind_has_new: (kind[0]?.def ?? '').includes('checkin_makeup_fee'),
    live_kind_ok_new: nk[0]?.b, triggers: trg.map((x) => x.t).filter((t) => /batt|checkin/.test(t)),
  }, null, 1));
  await closePools();
})().catch(async (e) => { console.error('RECON_FATAL', String((e as Error)?.message || e)); await closePools().catch(() => undefined); process.exit(1); });
