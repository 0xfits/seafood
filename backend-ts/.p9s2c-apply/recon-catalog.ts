import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const cons = await readQuery<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='public.batt_account'::regclass OR conname LIKE '%batt%' OR conname LIKE '%checkin%' ORDER BY conname`);
  const trg = await readQuery<{ n: string; def: string }>(
    `SELECT tgname AS n, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'trg_batt%' OR tgname LIKE 'trg_checkin%' ORDER BY tgname`);
  const u = await readQuery<{ uid: string }>(
    `SELECT u.uid::text AS uid FROM public.users u
      WHERE NOT EXISTS (SELECT 1 FROM public.checkin_log c WHERE c.uid=u.uid AND c.checkin_day=(now() AT TIME ZONE 'UTC')::date)
      ORDER BY u.uid LIMIT 1`);
  console.log(JSON.stringify({ cons, trg, freeUid: u[0]?.uid }, null, 1));
  await closePools();
})().catch(async (e) => { console.error('F', String((e as Error)?.message || e)); await closePools().catch(() => undefined); process.exit(1); });
