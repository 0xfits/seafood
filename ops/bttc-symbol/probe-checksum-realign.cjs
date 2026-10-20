const fs=require('fs');const crypto=require('crypto');
const {createRequire}=require('module');
const req=createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const {neon}=req('@neondatabase/serverless');const dotenv=req('dotenv');
const p=dotenv.parse(fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local'));
const sql=neon(p.DATABASE_URL_UNPOOLED||p.POSTGRES_URL_NON_POOLING||p.DATABASE_URL);
const txt=fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/migrations/0066_bttc_symbol_rename.sql','utf8');
const sha=crypto.createHash('sha256').update(txt,'utf8').digest('hex');
(async()=>{
  const pid=(await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid;
  if(pid!=='quiet-math-65207667'){throw new Error('wrong project: '+pid);}
  const before=(await sql`SELECT cid::text AS cid, symbol, name, is_platform_coin FROM public.currency WHERE is_platform_coin = true`);
  const upd=await sql`UPDATE public.schema_migration SET checksum = ${sha} WHERE version = '0066' RETURNING version, checksum`;
  const after=(await sql`SELECT cid::text AS cid, symbol, name, is_platform_coin FROM public.currency WHERE is_platform_coin = true`);
  console.log(JSON.stringify({project:pid,before,updated:upd,after,state_identical:JSON.stringify(before)===JSON.stringify(after)},null,1));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
