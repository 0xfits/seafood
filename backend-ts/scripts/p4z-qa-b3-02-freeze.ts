/**
 * p4z-qa-b3-02-freeze.ts — QA-B3 腿3：冻结面（migrations 逐文件 sha256 ↔ schema_migration 注册表）+ 夹具选人
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qa-b3-02-freeze.ts <outDir>
 * 只读（除 `SELECT * FROM schema_migration` 外零写）。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <outDir>');
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const RUN = path.basename(outDir);
type Row = Record<string, unknown>;
const sha256 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

async function main() {
  const migDir = path.resolve('migrations');
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const disk = files.map((f) => {
    const p = path.join(migDir, f);
    const b = fs.readFileSync(p);
    return {
      file: f, sha256: sha256(b), md5: crypto.createHash('md5').update(b).digest('hex'),
      bytes: b.length, mtime: fs.statSync(p).mtime.toISOString(),
    };
  });

  const cols = (await sql`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='schema_migration' ORDER BY ordinal_position`) as Row[];
  const registry = (await sql`SELECT * FROM public.schema_migration ORDER BY 1`) as Row[];

  // 逐文件 ↔ 注册表 checksum 对拍
  const comparisons = disk.map((d) => {
    const ver = d.file.replace(/_.*$/, ''); // 0001
    const hit = registry.find((r) => {
      const vals = Object.values(r).map((v) => String(v));
      return vals.some((v) => v === ver || v === d.file || v.startsWith(ver + '_'));
    });
    const checksum = hit ? String(hit.checksum ?? hit.checksum_sha256 ?? hit.hash ?? '') : '';
    return {
      file: d.file, version: ver, sha256: d.sha256, md5: d.md5,
      registry_row: hit ? JSON.stringify(hit) : null,
      checksum_match: checksum.toLowerCase() === d.sha256.toLowerCase(),
      md5_match: checksum.toLowerCase() === d.md5.toLowerCase(),
      registered_checksum: checksum || null,
    };
  });

  // kind 关闭集（DB 侧）
  const kindCons = (await sql`
    SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.ledger_entry'::regclass AND contype = 'c'`) as Row[];

  // 夹具选人：cid=1 余额表 + users
  const users = (await sql`
    SELECT uID::text AS uid FROM public.users ORDER BY uID`) as Row[];
  const acc = (await sql`
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
      FROM public.account WHERE cid = 1 AND balance >= 2000 ORDER BY balance DESC`) as Row[];

  const out = {
    run: RUN, at: new Date().toISOString(), probe: 'p4z-qa-b3-02-freeze',
    migrations: { count: disk.length, per_file: disk, names: files },
    schema_migration: {
      columns: cols.map((c) => ({ name: String(c.column_name), type: String(c.data_type) })),
      rows: registry.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))),
    },
    comparison: comparisons,
    all_checksum_match: comparisons.every((c) => c.checksum_match),
    matched_count: comparisons.filter((c) => c.checksum_match).length,
    ledger_entry_checks: kindCons.map((c) => String(c.def)),
    users: users.map((u) => ({ uid: String(u.uid), username: String(u.username), evm: String(u.evm) })),
    rich_accounts_cid1: acc.map((a) => ({ uid: String(a.uid), cid: String(a.cid), balance: String(a.balance), frozen: String(a.frozen) })),
  };
  const file = path.join(outDir, 'qa-b3-02-freeze.json');
  if (fs.existsSync(file)) throw new Error('refuse to overwrite: ' + file);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log('WROTE ' + file);
  console.log('migration_files=' + disk.length + ' registry_rows=' + registry.length);
  console.log('registry_cols=' + JSON.stringify(out.schema_migration.columns));
  console.log('all_checksum_match=' + out.all_checksum_match + ' matched=' + out.matched_count + '/' + comparisons.length);
  for (const c of comparisons) {
    if (!c.checksum_match) console.log('  MISMATCH ' + c.file + ' sha256=' + c.sha256 + ' reg=' + c.registered_checksum + ' row=' + c.registry_row);
  }
  console.log('users=' + JSON.stringify(out.users.map((u) => u.uid)));
  console.log('rich_cid1=' + JSON.stringify(out.rich_accounts_cid1.slice(0, 10)));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
