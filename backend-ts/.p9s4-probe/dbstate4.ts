import { readQuery, closePools } from '../src/db';
(async () => {
  try {
    const zero = await readQuery<Record<string, unknown>>(
      `SELECT a.uid::text AS uid, a.balance::text AS bal, (u.uid IS NOT NULL) AS in_users, (b.uid IS NOT NULL) AS has_batt
         FROM public.account a LEFT JOIN public.users u ON u.uid=a.uid LEFT JOIN public.batt_account b ON b.uid=a.uid
        WHERE a.cid=1 AND a.balance=0 ORDER BY a.uid`);
    console.log('ZERO_USD', JSON.stringify(zero));
    const have = await readQuery<Record<string, unknown>>(
      `SELECT a.uid::text AS uid, a.balance::text AS bal, (u.uid IS NOT NULL) AS in_users, (b.uid IS NOT NULL) AS has_batt, COALESCE(b.batt,0) AS batt
         FROM public.account a LEFT JOIN public.users u ON u.uid=a.uid LEFT JOIN public.batt_account b ON b.uid=a.uid
        WHERE a.cid=1 AND a.balance>0 ORDER BY a.uid LIMIT 40`);
    console.log('POS_USD', JSON.stringify(have));
    const u = await readQuery<Record<string, unknown>>(`SELECT uid::text FROM public.users ORDER BY uid`);
    console.log('ALL_USERS', JSON.stringify(u.map((r) => r.uid)));
    const maxuid = await readQuery<Record<string, unknown>>(`SELECT max(uid)::text AS m FROM public.users`);
    console.log('MAX_USER', JSON.stringify(maxuid));
  } catch (e) { console.log('ERR', String((e as Error).stack || e).slice(0, 600)); }
  await closePools().catch(() => {});
})();
