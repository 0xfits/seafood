
import { readQuery, closePools } from '../src/db';
async function main(){
  const cols = await readQuery(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='currency' ORDER BY ordinal_position`);
  const cons = await readQuery(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.currency'::regclass ORDER BY conname`);
  const cols2 = await readQuery(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='account' ORDER BY ordinal_position`);
  const cons2 = await readQuery(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.account'::regclass ORDER BY conname`);
  console.log(JSON.stringify({currency_cols:cols, currency_cons:cons, account_cols:cols2, account_cons:cons2}, null, 1));
  await closePools();
}
main().catch(e=>{console.error(e.message);process.exit(1)});
