// p4z-07-relprobe.ts — READ-ONLY triple-caliber relation existence probe (pg_class / to_regclass /
// information_schema) + quoted-name direct count (SQLSTATE). ZERO writes. neon() HTTP driver only.
// Usage: ts-node --transpile-only scripts/p4z-07-relprobe.ts <comma,separated,names> <outJson>
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

const names = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
const outPath = process.argv[3];
if (!names.length || !outPath) { console.error('USAGE: <names> <outJson>'); process.exit(2); }

async function main() {
  const out: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    caliber: 'triple caliber (pg_class / to_regclass / information_schema) + quoted-name direct count (SQLSTATE); neon() HTTP; read-only',
    per_name: {} as Record<string, unknown>,
  };
  const per = out.per_name as Record<string, unknown>;
  for (const t of names) {
    const a = await sql(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1`, [t]) as Array<{ n: number }>;
    const b = await sql(`SELECT to_regclass('public.' || $1) IS NOT NULL AS e`, [t]) as Array<{ e: boolean }>;
    const c = await sql(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]) as Array<{ n: number }>;
    let quoted: Record<string, unknown>;
    try {
      const q = await sql(`SELECT count(*)::int AS n FROM "${t}"`) as Array<{ n: number }>;
      quoted = { ok: true, n: q[0].n };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      quoted = { ok: false, code: err.code || null, message: String(err.message || '').split('\n')[0].slice(0, 120) };
    }
    per[t] = { pg_class_n: a[0].n, to_regclass: b[0].e, information_schema_n: c[0].n, quoted_probe: quoted };
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('WROTE ' + outPath);
}
main().catch((e) => { console.error('FATAL', (e as Error).message); process.exit(1); });
