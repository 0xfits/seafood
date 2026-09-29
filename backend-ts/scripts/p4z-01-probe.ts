// p4z-01-probe.ts — READ-ONLY probe for P4-B1: columns/types/nulls/defaults, constraints, indexes, row counts.
// Uses neon() HTTP driver (NOT Client/ws). Only SELECT / catalog reads. No writes.
// Usage: ts-node --transpile-only scripts/p4z-01-probe.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

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
const sql = neon(url);

const outDir = process.argv[2] || path.join(__dirname, '..', '.p4-artifacts', 'probe');
fs.mkdirSync(outDir, { recursive: true });

const TABLES = [
  'account', 'currency', 'job', 'job_application', 'job_submission',
  'listing', 'listing_order', 'market_order', 'market_trade',
  'admin_role', 'admin_role_permission', 'admin_user_role',
  'users', 'app_config',
];

async function main() {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString() };

  // 1. columns: name, type, nullable, default
  const cols: Record<string, Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>> = {};
  for (const t of TABLES) {
    const rows = await sql(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    cols[t] = rows as never;
  }
  out.columns = cols;

  // 2. constraints (pk / unique / fk / check)
  const cons = await sql(
    `SELECT c.conrelid::regclass::text AS tbl, c.conname, c.contype,
            pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname='public' AND c.conrelid::regclass::text = ANY($1)
      ORDER BY tbl, c.contype, c.conname`, [TABLES]);
  out.constraints = cons;

  // 3. indexes (unique?) per table
  const idx = await sql(
    `SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename = ANY($1) ORDER BY tablename, indexname`, [TABLES]);
  out.indexes = idx;

  // 4. row counts for every public relation (quoted names)
  const rels = await sql(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','v','m','p') ORDER BY 1`);
  const counts: Record<string, unknown> = {};
  for (const r of rels as Array<{ relname: string }>) {
    const t = r.relname;
    try {
      const q = await sql(`SELECT count(*)::int AS n FROM "${t}"`);
      counts[t] = (q as Array<{ n: number }>)[0].n;
    } catch (e) {
      counts[t] = 'ERR:' + String((e as { code?: string }).code || (e as Error).message).slice(0, 60);
    }
  }
  out.row_counts = counts;
  out.relations = (rels as Array<{ relname: string }>).map((r) => r.relname);

  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(out, null, 2));
  console.log('WROTE ' + path.join(outDir, 'probe.json'));
}
main().catch((e) => { console.error('FATAL', (e as Error).message); process.exit(1); });
