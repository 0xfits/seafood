import { readQuery, closePools } from '../src/db';
(async () => {
  const r = await readQuery<any>(`SELECT u.uid::text AS uid, a.cid::text AS cid, a.balance::text AS bal, a.frozen::text AS frz
    FROM users u JOIN account a ON a.uid=u.uid WHERE a.cid=1 AND a.balance>=200000 ORDER BY a.balance DESC LIMIT 10`);
  console.log('FUNDED_USERS', JSON.stringify(r));
  const q6 = await readQuery<any>(`SELECT uid::text, balance::text, frozen::text FROM account WHERE uid IN (6,970001) AND cid=1`);
  console.log('UID6_970001', JSON.stringify(q6));
  const u6 = await readQuery<any>(`SELECT uid::text FROM users WHERE uid IN (6,970001)`);
  console.log('IN_USERS', JSON.stringify(u6));
  await closePools();
})();
