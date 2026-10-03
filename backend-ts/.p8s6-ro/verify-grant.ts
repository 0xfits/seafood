import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  const cols = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='ledger_entry' order by ordinal_position`);
  console.log('ledger_entry 列 =', (cols as any[]).map(r=>r.column_name).join(', '));
  console.log('txid 1439 行 =', JSON.stringify(await q(`select * from public.ledger_entry where txid = 1439`)));
  console.log('uid 970213 的账本行 =', JSON.stringify(await q(`select txid, kind, uid, cid, amount_e5::text, idempotency_key from public.ledger_entry where uid = 970213 order by txid desc limit 3`).catch(async () => await q(`select txid, kind, uid, cid from public.ledger_entry where uid = 970213 order by txid desc limit 3`))));
  console.log('account 全 =', JSON.stringify(await q(`select uid, cid, balance::text from public.account where uid = 970213`)));
  console.log('平台供应(cid1) =', JSON.stringify(await q(`select coalesce(sum(amount_e5),0)::text as supply from public.ledger_entry where cid = 1`).catch(()=>[])));
  await pool.end();
})().catch(e=>{console.error('FAIL', e?.message); process.exit(1);});
