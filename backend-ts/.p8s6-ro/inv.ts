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

  // 1) all base tables summary
  const tbls = await q(`select c.relname as tbl,
      (select count(*)::int from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as cols,
      coalesce((select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),0)::int as trg,
      coalesce((select string_agg(distinct t.tgenabled::text, ',') from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),'-') as trg_state
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname`);
  const counts: Record<string, number> = {};
  for (const r of tbls) counts[r.tbl as string] = (await q(`select count(*)::int as n from public."${r.tbl}"`))[0].n;
  const summary = tbls.map((r: any) => ({ tbl: r.tbl, cols: r.cols, trg: r.trg, trg_state: r.trg_state, rows: counts[r.tbl] }));
  console.error('TOTAL_TABLES=' + summary.length);
  console.error('SUMMARY=' + JSON.stringify(summary));

  // 2) columns per audit table
  for (const t of AUDIT) {
    const cols = await q(`select column_name, data_type, is_nullable, column_default
       from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t]);
    const pk = await q(`select a.attname from pg_index i join pg_class c on c.oid=i.indrelid
       join pg_attribute a on a.attrelid=c.oid and a.attnum=any(i.indkey)
       where c.relname=$1 and i.indisprimary`, [t]);
    const idx = await q(`select indexname from pg_indexes where schemaname='public' and tablename=$1`, [t]);
    const chk = await q(`select conname, pg_get_constraintdef(oid) as def from pg_constraint
       where conrelid=('public.'||$1)::regclass and contype='c'`, [t]);
    console.error('COLS=' + JSON.stringify({ t, rows: counts[t], pk: pk.map((x:any)=>x.attname),
      cols: cols.map((c:any)=>({n:c.column_name,ty:c.data_type,nn:c.is_nullable,def:c.column_default})),
      idx: idx.map((x:any)=>x.indexname), chk: chk.map((x:any)=>({n:x.conname,d:x.def})) }));
  }

  // 3) schema_version + kind enum + registries sanity
  const sv = await q(`select max(version) as v from public.schema_migration`).catch(async () => await q(`select max(version) as v from public.schema_migrations`).catch(()=>[{v:'NA'}]));
  console.error('SCHEMA_VERSION=' + JSON.stringify(sv));
  const ke = await q(`select pg_get_constraintdef(oid) as d from pg_constraint where conname='ledger_kind_enum'`).catch(()=>[]);
  console.error('KIND_ENUM=' + JSON.stringify(ke));
  await pool.end();
})().catch(e => { console.error('FAIL', e?.message); process.exit(1); });
