/** L5：schema_migration checksum 双对拍（DB vs 文件 sha256）+ 零净写基线。只读。 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.join(__dirname, '..', '.p9s3qa-artifacts');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '..', '..'); // repo root (copy)
const sha = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

(async () => {
  const rows = await readQuery<{ version: string; name: string; checksum: string }>(
    `SELECT version, name, checksum FROM public.schema_migration ORDER BY version`);
  const files = fs.readdirSync(path.join(ROOT, 'backend-ts', 'migrations')).filter((f) => f.endsWith('.sql'));
  const byVer: Record<string, string> = {};
  for (const f of files) byVer[f.slice(0, 4)] = f;
  const mism: Array<{ version: string; db: string; file: string | null; fileSha: string | null }> = [];
  const pairs: Array<{ version: string; name: string; db_checksum: string; file_sha256: string }> = [];
  for (const r of rows) {
    const f = byVer[r.version];
    const fs_ = f ? sha(path.join(ROOT, 'backend-ts', 'migrations', f)) : null;
    if (f) pairs.push({ version: r.version, name: r.name, db_checksum: r.checksum, file_sha256: fs_ as string });
    if (!f || fs_ !== r.checksum) mism.push({ version: r.version, db: r.checksum, file: f ?? null, fileSha: fs_ });
  }
  const target = (v: string) => pairs.find((p) => p.version === v);
  const out = {
    run: RUN,
    migration_rows: rows.length,
    migration_files: files.length,
    mismatch_count: mism.length,
    mismatches: mism,
    named_0030: target('0030'),
    named_0031: target('0031'),
    counts: {
      rating: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.rating`))[0].n),
      event: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event`))[0].n),
      listing_order: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order`))[0].n),
      users: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.users`))[0].n),
      app_config: Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.app_config`))[0].n),
    },
  };
  const text = JSON.stringify(out, null, 1);
  fs.writeFileSync(path.join(OUT, `l5-checksum-${RUN}.json`), text + '\n', 'utf8');
  console.log(text);
  await closePools();
  process.exit(0);
})().catch(async (e) => { console.error('L5_FATAL', String((e as Error)?.stack || e).slice(0, 400)); await closePools().catch(() => undefined); process.exit(2); });
