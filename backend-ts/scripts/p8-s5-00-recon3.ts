import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const cols = await readQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_entry' ORDER BY ordinal_position`);
  const ev = await readQuery(`SELECT evm FROM "users" WHERE uid IN (1,3,11,6,7,2) ORDER BY uid`);
  const jev = await readQuery(`SELECT evm FROM "users" WHERE uid=910004`);
  console.log(JSON.stringify({ ledger_cols: cols.map((r:any)=>r.column_name), users_evm: ev, u910004: jev }, null, 1));
  await closePools(); process.exit(0);
})().catch(async e => { console.error(String(e?.stack||e).slice(0,800)); await closePools(); process.exit(2); });
