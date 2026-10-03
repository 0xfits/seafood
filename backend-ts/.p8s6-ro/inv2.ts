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

  // PK constraint def per table
  for (const t of AUDIT) {
    const pk = await q(`select pg_get_constraintdef(oid) as d from pg_constraint where conrelid=('public.'||$1)::regclass and contype='p'`, [t]);
    const trg = await q(`select t.tgname, t.tgenabled::text as en, pg_get_triggerdef(t.oid) as def
       from pg_trigger t join pg_class c on c.oid=t.tgrelid
       where c.relname=$1 and not t.tgisinternal order by t.tgname`, [t]);
    console.error('PKTRG=' + JSON.stringify({ t, pk: pk[0]?.d, trg: trg.map((x:any)=>({n:x.tgname,en:x.en,ev:(x.def.match(/(BEFORE|AFTER)[^O]*ON/)||[''])[0].trim()})) }));
  }

  // exact ledger_entry PK
  const le = await q(`select pg_get_constraintdef(oid) as d from pg_constraint where conname='ledger_entry_pkey'`);
  console.error('LEDGER_PK=' + JSON.stringify(le));
  // uniqueness of txid in ledger_entry
  const u = await q(`select count(*)::int as rows, count(distinct txid)::int as dtx from public.ledger_entry`);
  console.error('LEDGER_TXID=' + JSON.stringify(u[0]));
  // count of trigger-enabled tables overall
  await pool.end();
})().catch(e => { console.error('FAIL', e?.message); process.exit(1); });
