import { readQuery, closePools } from '../src/db';
(async () => {
  const o: any = {};
  o.now = (await readQuery<any>(`SELECT now()::text AS n`))[0].n;
  o.job_cols = (await readQuery<any>(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='job' ORDER BY ordinal_position`)).map((r:any)=>r.column_name);
  o.batt_account_fks = (await readQuery<any>(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.batt_account'::regclass AND contype='f'`));
  o.referral_cols = (await readQuery<any>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='referral' ORDER BY ordinal_position`)).map((r:any)=>r.column_name);
  o.job_post_event_args = (await readQuery<any>(`SELECT pg_get_function_identity_arguments(oid) AS a FROM pg_proc WHERE proname='job_post_event'`));
  o.appcfg_keys = (await readQuery<any>(`SELECT key FROM app_config ORDER BY key`)).map((r:any)=>r.key);
  o.u970001 = await readQuery<any>(`SELECT u.uid::text, a.balance::text FROM users u LEFT JOIN account a ON a.uid=u.uid AND a.cid=1 WHERE u.uid=970001`);
  o.batt_fk_users = (await readQuery<any>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.batt_account'::regclass`)).map((r:any)=>r.def);
  console.log(JSON.stringify(o,null,1));
  await closePools();
})().catch(async e=>{console.error('ERR',e); try{await closePools()}catch{}; process.exit(1)});
