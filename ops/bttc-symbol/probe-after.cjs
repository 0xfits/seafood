const fs=require('fs');
const {createRequire}=require('module');
const req=createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const {neon}=req('@neondatabase/serverless');
const dotenv=req('dotenv');
const p=dotenv.parse(fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local'));
const sql=neon(p.DATABASE_URL_UNPOOLED||p.POSTGRES_URL_NON_POOLING||p.DATABASE_URL);
(async()=>{
  const id=await sql`SELECT current_setting('neon.project_id', true) AS pid`;
  console.log('project_id=',id[0].pid);
  const rows=await sql`SELECT cid::text AS cid, symbol, name, is_platform_coin, status, total_supply::text AS supply FROM public.currency WHERE is_platform_coin = true`;
  console.log('platform_rows=',JSON.stringify(rows));
  const stale=await sql`SELECT count(*)::int AS n FROM public.currency WHERE symbol = 'BTTC'`;
  console.log('rows_with_symbol_BTTC=',stale[0].n);
  const all=await sql`SELECT cid::text AS cid, symbol, name FROM public.currency ORDER BY cid`;
  console.log('currency_rows=',all.length);
  const dup=await sql`SELECT symbol,count(*)::int AS n FROM public.currency GROUP BY symbol HAVING count(*)>1`;
  console.log('dup=',JSON.stringify(dup));
  const acct=await sql`SELECT cid::text AS cid, count(*)::int AS n, sum(balance)::text AS total FROM public.account WHERE cid = (SELECT cid FROM public.currency WHERE is_platform_coin = true) GROUP BY cid`;
  console.log('accounts_on_platform_coin=',JSON.stringify(acct));
  const mig=await sql`SELECT version,name FROM public.schema_migration ORDER BY version DESC LIMIT 2`;
  console.log('schema_top=',JSON.stringify(mig));
  // replay the migration SQL as-is (idempotency proof)
  const txt=fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/migrations/0066_bttc_symbol_rename.sql','utf8');
  await sql.unsafe(txt);
  const after=await sql`SELECT cid::text AS cid, symbol, name FROM public.currency WHERE is_platform_coin = true`;
  console.log('after_replay=',JSON.stringify(after));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
