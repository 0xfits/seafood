import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  for (const t of ['job_submission','job_application','job']) {
    const r = (await pool.query(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='${t}' order by ordinal_position`)).rows;
    console.log(t, '=>', r.map((x:any)=>`${x.column_name}:${x.data_type}`).join(', '));
  }
  await pool.end();
})().catch(e=>{console.error('FAIL', e?.message); process.exit(1);});
