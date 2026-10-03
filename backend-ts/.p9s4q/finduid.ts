import { readQuery, closePools } from '../src/db';
async function main(){
  const r = await readQuery(`SELECT u.uID::text AS uid FROM public.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a.uid=u.uID AND a.cid=1)
       AND NOT EXISTS (SELECT 1 FROM public.batt_account b WHERE b.uid=u.uID)
     ORDER BY u.uID LIMIT 10`);
  console.log(JSON.stringify(r)); 
  const u4 = await readQuery(`SELECT count(*)::int AS n FROM public.users WHERE uID=4`);
  console.log('uid4_in_users', JSON.stringify(u4));
  await closePools();
}
main().catch(e=>{console.error(e.message);process.exit(1)});
