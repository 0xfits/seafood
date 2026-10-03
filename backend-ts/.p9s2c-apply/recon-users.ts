import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const users = await readQuery<{ uid: string; bal: string; admin: boolean }>(
    `SELECT u.uid::text AS uid, COALESCE((SELECT a.balance FROM public.account a WHERE a.uid=u.uid AND a.cid=1),0)::text AS bal, u.is_admin AS admin
       FROM public.users u ORDER BY u.uid LIMIT 25`);
  const y = await readQuery<{ y: string; dow: string }>(
    `SELECT ((now() AT TIME ZONE 'UTC')::date - 1)::text AS y, to_char((now() AT TIME ZONE 'UTC')::date - 1,'Dy') AS dow`);
  console.log(JSON.stringify({ users, yesterday: y[0] }, null, 1));
  await closePools();
})().catch(async (e) => { console.error('F', String((e as Error)?.message || e)); await closePools().catch(() => undefined); process.exit(1); });
