const fs=require('fs');
const {createRequire}=require('module');
const req=createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const {neon}=req('@neondatabase/serverless');
const dotenv=req('dotenv');
const p=dotenv.parse(fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local'));
const url=p.DATABASE_URL_UNPOOLED||p.POSTGRES_URL_NON_POOLING||p.DATABASE_URL;
const sql=neon(url);
(async()=>{
  const id=await sql`SELECT current_setting('neon.project_id', true) AS pid`;
  console.log('project_id=',id[0].pid);
  // (a) DML 幂等单元：同名 UPDATE 带 RETURNING ⇒ 重放应为 0 行
  const upd=await sql`UPDATE public.currency SET symbol = '₿', name = 'BTTC'
     WHERE is_platform_coin = true AND symbol = 'BTTC' RETURNING cid`;
  console.log('replay_update_rows=',upd.length);
  // (b) 整文件重放走 Neon HTTP /sql（与 migrate.ts 同一驱动通道之外的直连写法）
  const txt=fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/migrations/0066_bttc_symbol_rename.sql','utf8');
  const host=new URL(url).host;
  const res=await fetch(`https://${host}/sql`,{method:'POST',headers:{'Content-Type':'application/json','Neon-Connection-String':url},body:JSON.stringify({query:txt,params:[]})});
  const body=await res.text();
  console.log('file_replay_http=',res.status,body.slice(0,300));
  const after=await sql`SELECT cid::text AS cid, symbol, name FROM public.currency WHERE is_platform_coin = true`;
  console.log('after=',JSON.stringify(after));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
