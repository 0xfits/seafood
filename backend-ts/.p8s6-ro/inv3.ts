import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
const AUDIT = ['admin_ops_audit_log','admin_refund_audit_log','ledger_entry','currency_review_log',
  'currency_status_log','listing_review_log','job_arbitration_log','batt_entry','checkin_log',
  'checkin_makeup_log','rating','listing_order_event','referral','app_config','commission_policy'];
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: any[]) => (await pool.query(s, p)).rows;
  for (const t of AUDIT) {
    const trg = await q(`select t.tgname, t.tgtype::int as tgtype, t.tgenabled::text as en,
        p.proname as fn from pg_trigger t join pg_class c on c.oid=t.tgrelid
        join pg_proc p on p.oid=t.tgfoid
       where c.relname=$1 and not t.tgisinternal order by t.tgname`, [t]);
    console.error('T=' + t + ' ' + JSON.stringify(trg));
  }
  await pool.end();
})().catch(e => { console.error('FAIL', e?.message); process.exit(1); });
