// p4z-02-counts.ts — READ-ONLY per-relation row counts + relation-existence dual caliber.
// Uses neon() HTTP driver (NOT Client/ws). Only SELECT / catalog reads. No writes.
// Usage: ts-node --transpile-only scripts/p4z-02-counts.ts <outJson>
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

const outPath = process.argv[2];
if (!outPath) { console.error('USAGE: <outJson>'); process.exit(2); }

// asset-side read targets + the out-of-scope (slice 2/3) tables, for root-cause evidence
const PROBE = ['asset', 'account', 'currency', 'users', 'task', 'task_progress', 'prize', 'prize_item', 'shard', 'shard_transfer'];

async function main() {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), caliber: 'neon() HTTP driver, read-only SELECT/catalog; NOT Client(ws)' };

  // 1. all public relations (relkind r/v/m/p)
  const rels = await sql(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','v','m','p') ORDER BY 1`) as Array<{ relname: string }>;
  out.relations = rels.map((r) => r.relname);

  // 2. row counts for every public relation (quoted identifiers)
  const counts: Record<string, unknown> = {};
  for (const r of rels) {
    try {
      const q = await sql(`SELECT count(*)::int AS n FROM "${r.relname}"`) as Array<{ n: number }>;
      counts[r.relname] = q[0].n;
    } catch (e) {
      counts[r.relname] = 'ERR:' + String((e as { code?: string }).code || (e as Error).message).slice(0, 80);
    }
  }
  out.row_counts = counts;

  // 3. relation existence, dual caliber: (a) pg_class, (b) to_regclass, (c) information_schema
  const exist: Record<string, unknown> = {};
  for (const t of PROBE) {
    const a = await sql(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=$1`, [t]) as Array<{ n: number }>;
    const b = await sql(`SELECT to_regclass('public.' || $1) IS NOT NULL AS e`, [t]) as Array<{ e: boolean }>;
    const c = await sql(`SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema='public' AND table_name=$1`, [t]) as Array<{ n: number }>;
    exist[t] = { pg_class_n: a[0].n, to_regclass: b[0].e, information_schema_n: c[0].n };
  }
  out.existence_dual_caliber = exist;

  // 4. direct probe of the read queries: quoted name + SQLSTATE
  const probeQ: Record<string, unknown> = {};
  for (const t of ['asset', 'account', 'task', 'prize', 'task_progress', 'prize_item', 'shard', 'shard_transfer']) {
    try {
      const q = await sql(`SELECT count(*)::int AS n FROM "${t}"`) as Array<{ n: number }>;
      probeQ[t] = { ok: true, n: q[0].n };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      probeQ[t] = { ok: false, code: err.code || null, message: String(err.message || '').split('\n')[0].slice(0, 120) };
    }
  }
  out.quoted_count_probe = probeQ;

  // 5. account rows by cid (system-currency read-side truth)
  try {
    const rows = await sql(`SELECT cid::text AS cid, count(*)::int AS n, COALESCE(sum(balance),0)::text AS balance_sum
        FROM "account" GROUP BY cid ORDER BY cid`) as unknown[];
    out.account_by_cid = rows;
  } catch (e) {
    out.account_by_cid = 'ERR:' + String((e as Error).message).slice(0, 120);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('WROTE ' + outPath);
}
main().catch((e) => { console.error('FATAL', (e as Error).message); process.exit(1); });
