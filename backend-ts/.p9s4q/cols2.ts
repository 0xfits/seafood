import { readQuery, closePools } from '../src/db';
async function main(){
  const out:any = {};
  out.uid4_cid1 = await readQuery(`SELECT a.balance::text AS acct,
     (SELECT e.balance_after::text FROM ledger_entry e WHERE e.uid=4 AND e.cid=1 ORDER BY e.txid DESC LIMIT 1) AS snap,
     (SELECT count(*)::int FROM ledger_entry e WHERE e.uid=4 AND e.cid=1) AS n FROM account a WHERE a.uid=4 AND a.cid=1`);
  out.consistency = await readQuery(`SELECT a.uid::text, a.cid::text, a.balance::text AS acct,
     (SELECT e.balance_after::text FROM ledger_entry e WHERE e.uid=a.uid AND e.cid=a.cid ORDER BY e.txid DESC LIMIT 1) AS snap
     FROM account a WHERE a.uid IN (4,12,2) ORDER BY a.uid, a.cid`);
  out.batt_trig = await readQuery(`SELECT tgname FROM pg_trigger t WHERE tgrelid='public.batt_account'::regclass AND NOT tgisinternal`);
  console.log(JSON.stringify(out,null,1)); await closePools();
}
main().catch(e=>{console.error(e.message);process.exit(1)});
