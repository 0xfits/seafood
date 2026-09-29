// p4y-db-probe.ts — READ-ONLY reconnaissance probe (P4-0 / ROUTE-INVENTORY)
// Only SELECT / catalog reads. No writes. No connection string ever printed.
import * as fs from 'fs';
import * as path from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '';
if (!url) { console.error('NO_URL'); process.exit(2); }

const pool = new Pool({ connectionString: url });

const out: Record<string, unknown> = {};

async function main() {
  // 1. actual public relations (tables/views/matviews/sequences)
  const rel = await pool.query(
    `SELECT c.relname, c.relkind
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p','S')
      ORDER BY c.relkind, c.relname`);
  out.relations = rel.rows;

  // 2. public functions
  const fn = await pool.query(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' ORDER BY 1`);
  out.functions = fn.rows.map((r: { proname: string }) => r.proname);

  // 3. non-internal triggers
  const tg = await pool.query(
    `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal`);
  out.noninternal_triggers = tg.rows[0].n;

  // 4. schema_version (as src/db.ts getSchemaVersion reads it) + db version
  let schemaVersion: unknown = 'ERR';
  try {
    const sv = await pool.query(`SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`);
    schemaVersion = sv.rows[0]?.version ?? null;
  } catch (e) { schemaVersion = 'NO_TABLE:' + (e as Error).message.slice(0, 80); }
  out.schema_version_probe = schemaVersion;

  // 5. row counts for the baseline-cited tables
  const tables = [
    'currency','ledger_owner','account','commission_policy','ledger_entry','referral',
    'job','job_application','job_submission','listing','listing_order','market_order',
    'market_trade','app_config','admin_role','admin_permission','admin_role_permission',
    'admin_user_role','currency_status_log','users',
    'task','task_progress','prize','prize_item','shard','shard_transfer','asset',
    'permission_group','selected_prize','selected_prizes','selected_task','selected_tasks',
    'shard_counts','transfer_counts','gift_counts','participant_counts',
    'candle_view',
  ];
  const counts: Record<string, unknown> = {};
  for (const t of tables) {
    try {
      const q = await pool.query(`SELECT count(*)::int AS n FROM "${t}"`);
      counts[t] = q.rows[0].n;
    } catch (e) {
      counts[t] = 'ERR:' + String((e as { code?: string }).code || (e as Error).message).slice(0, 60);
    }
  }
  out.row_counts = counts;
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}
main().catch((e) => { console.error('FATAL', (e as Error).message); process.exit(1); });
