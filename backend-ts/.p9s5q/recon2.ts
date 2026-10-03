import { readQuery, closePools } from '../src/db';
(async () => {
  const o:any={};
  o.job_submission_cols = await readQuery<any>(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='job_submission' ORDER BY ordinal_position`);
  o.submission_checks = (await readQuery<any>(`SELECT conname, pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.job_submission'::regclass`)).map((r:any)=>`${r.conname}: ${r.d}`);
  o.job_triggers = (await readQuery<any>(`SELECT tgname FROM pg_trigger WHERE tgrelid='public.job'::regclass AND NOT tgisinternal`)).map((r:any)=>r.tgname);
  o.batt_entry_cols = (await readQuery<any>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='batt_entry' ORDER BY ordinal_position`)).map((r:any)=>r.column_name);
  o.users_req = (await readQuery<any>(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND is_nullable='NO' ORDER BY ordinal_position`)).map((r:any)=>r.column_name);
  o.maxuid = (await readQuery<any>(`SELECT max(uid)::text m FROM users`))[0].m;
  o.max_jobid = (await readQuery<any>(`SELECT max(job_id)::text m FROM job`))[0].m;
  o.referral_fn = await readQuery<any>(`SELECT pg_get_function_identity_arguments(oid) a FROM pg_proc WHERE proname='referral_bind'`);
  o.uid970001_users = await readQuery<any>(`SELECT uid::text FROM users WHERE uid=970001`);
  o.jobstatus_ok = await readQuery<any>(`SELECT job_status_transition_ok('open','accepted') a, job_status_transition_ok('accepted','submitted') b`);
  console.log(JSON.stringify(o,null,1));
  await closePools();
})().catch(async e=>{console.error('ERR',e); try{await closePools()}catch{}; process.exit(1)});
