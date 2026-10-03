import { readQuery, closePools } from '../src/db';
(async () => {
  try {
    const acc = await readQuery<Record<string, unknown>>(
      `SELECT a.uid::text, a.cid::text, c.symbol, a.balance::text, a.frozen::text FROM public.account AS a JOIN public.currency AS c ON c.cid=a.cid ORDER BY a.cid, a.uid LIMIT 60`);
    console.log('ACCOUNTS', JSON.stringify(acc));
    const batt = await readQuery<Record<string, unknown>>(
      `SELECT uid::text, batt FROM public.batt_account ORDER BY uid`);
    console.log('BATT', JSON.stringify(batt));
    const users = await readQuery<Record<string, unknown>>(
      `SELECT uid::text FROM public.users ORDER BY uid LIMIT 10`);
    console.log('USERS', JSON.stringify(users));
    const cur = await readQuery<Record<string, unknown>>(
      `SELECT cid::text, symbol, status, owner_uid::text, total_supply::text, is_platform_coin FROM public.currency ORDER BY cid`);
    console.log('CURRENCY', JSON.stringify(cur));
    const ac = await readQuery<Record<string, unknown>>(
      `SELECT key, left(value::text, 120) AS v FROM public.app_config`);
    console.log('APP_CONFIG', JSON.stringify(ac));
    const mx = await readQuery<Record<string, unknown>>(
      `SELECT max(cid)::text AS mx, max(uid)::text AS mu FROM public.currency, public.users`);
    console.log('MAX', JSON.stringify(mx));
  } catch (e) { console.log('ERR', String((e as Error).stack || e).slice(0, 600)); }
  await closePools().catch(() => {});
})();
