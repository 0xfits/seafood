import { readQuery, closePools } from '../src/db';
(async()=>{const o:any={};
 o.app_config_cols=await readQuery<any>(`SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='app_config' ORDER BY ordinal_position`);
 o.app_config_checks=(await readQuery<any>(`SELECT conname,pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.app_config'::regclass`)).map((r:any)=>`${r.conname}: ${r.d}`);
 o.system_settings=await readQuery<any>(`SELECT key, jsonb_typeof(value) t, value FROM app_config WHERE key='system_settings'`);
 console.log(JSON.stringify(o,null,1)); await closePools();
})().catch(async e=>{console.error('ERR',e); try{await closePools()}catch{}; process.exit(1)});
