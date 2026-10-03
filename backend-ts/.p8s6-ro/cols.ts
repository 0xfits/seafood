import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string) => (await pool.query(s)).rows;
  for (const t of ['users','batt_account','batt_entry','job','job_application','referral']) {
    const r = await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='${t}' order by ordinal_position`);
    console.log(t, '=>', r.map((x: any) => x.column_name).join(', '));
  }
  await pool.end();
})().catch(e => { console.error('FAIL', e?.message); process.exit(1); });
