import { readQuery, closePools } from '../src/db';
(async () => {
  const rows = await readQuery<any>(`SELECT uid::text, cid::text, balance::text, frozen::text FROM account WHERE cid=1 AND balance>=200000 ORDER BY balance DESC LIMIT 8`);
  console.log('FUNDED', JSON.stringify(rows));
  const u = await readQuery<any>(`SELECT uid::text FROM users WHERE uid IN (6,7,11) ORDER BY uid`);
  console.log('USERS', JSON.stringify(u));
  await closePools();
})();
