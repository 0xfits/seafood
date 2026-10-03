import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string) => (await pool.query(s)).rows;
  const rows = await q(`select c.relname as tbl,
      (select count(*)::int from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as cols,
      coalesce((select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),0)::int as trg,
      coalesce((select string_agg(distinct case t.tgenabled when 'O' then 'O' else t.tgenabled end, ',') from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),'-') as trg_state
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname`);
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const n = (await q(`select count(*)::int as n from public."${r.tbl}"`))[0].n;
    counts[r.tbl as string] = n;
  }
  const out = rows.map((r: any) => ({ tbl: r.tbl, cols: r.cols, trg: r.trg, trg_state: r.trg_state, rows: counts[r.tbl] }));
  console.log(JSON.stringify(out, null, 0));
  await pool.end();
})().catch(e => { console.error('FAIL', e?.message); process.exit(1); });
