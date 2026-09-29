/*
 * p4z-qab4-04-freeze.ts — QA-B4 腿5：冻结面（migrations checksum + schema_migration）+ 腿2复测读数落盘
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qab4-04-freeze.ts <runDirAbs>
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDirAbs>');
fs.mkdirSync(outDir, { recursive: true });
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
type Row = Record<string, unknown>;

async function main() {
  const md = path.resolve('migrations');
  const files = fs.readdirSync(md).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  const rows = (await sql`SELECT version::text AS version, name::text AS name, checksum::text AS checksum FROM public.schema_migration ORDER BY version`) as Row[];
  const dbc = new Map<string, string>();
  for (const r of rows) {
    if (r.name) dbc.set(String(r.name), String(r.checksum));
    const v = String(r.version || '').replace(/^0*/, '');
    for (const f of fs.readdirSync(path.resolve('migrations'))) {
      if (new RegExp(`^0*${v}_`).test(f) || new RegExp(`^0*${v}\\.`).test(f)) dbc.set(f, String(r.checksum));
    }
  }
  const out: Record<string, unknown> = { migrations_dir: md, files_n: files.length, db_rows_n: rows.length, per_file: [], mismatches: [], missing_in_db: [] };
  let match = 0;
  for (const f of files) {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(md, f))).digest('hex');
    const db = dbc.get(f) ?? null;
    const ok = db === sha;
    if (ok) match += 1; else if (!db) (out.missing_in_db as string[]).push(f); else (out.mismatches as string[]).push(`${f}: file=${sha} db=${db}`);
    (out.per_file as unknown[]).push({ file: f, sha256: sha, db_checksum: db, match: ok });
  }
  out.match_n = match;
  out.db_files_not_on_disk = rows.map((r) => String(r.name ?? r.version ?? '?')).filter((f) => !files.includes(f));
  fs.writeFileSync(path.join(outDir, 'qab4-04-freeze.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ files_n: out.files_n, db_rows_n: out.db_rows_n, match_n: match, mismatches: out.mismatches, missing_in_db: out.missing_in_db, db_files_not_on_disk: out.db_files_not_on_disk }));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
