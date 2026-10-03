import { readQuery, closePools } from '../src/db';
(async()=>{const o:any={};
 o.job_fks=(await readQuery<any>(`SELECT conname, pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.job'::regclass AND contype='f'`)).map((r:any)=>`${r.conname}: ${r.d}`);
 o.currency1=await readQuery<any>(`SELECT cid::text,status FROM currency WHERE cid=1`);
 o.users_req=(await readQuery<any>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND is_nullable='NO' ORDER BY ordinal_position`)).map((r:any)=>r.column_name);
 o.maxuid=(await readQuery<any>(`SELECT max(uid)::text m FROM users`))[0].m;
 console.log(JSON.stringify(o,null,1)); await closePools();
})().catch(async e=>{console.error('ERR',e); try{await closePools()}catch{}; process.exit(1)});
