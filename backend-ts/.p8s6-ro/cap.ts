import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const rows = (await pool.query(`select p.proname, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ilike '%points_adjust%'`)).rows;
  for (const r of rows) {
    const def = String(r.def || '');
    console.log('### FN:', r.proname, 'len=', def.length);
    const lines = def.split('\n');
    lines.forEach((l: string, i: number) => { if (/cap|daily|1000|10000|5000|limit|SUM\(|memo/i.test(l)) console.log(`  ${i+1}: ${l.trim().slice(0,160)}`); });
  }
  await pool.end();
})().catch(e=>{console.error('FAIL', e?.message); process.exit(1);});
