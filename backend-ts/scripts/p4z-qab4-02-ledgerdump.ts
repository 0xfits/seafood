/**
 * p4z-qab4-02-ledgerdump.ts — QA-B4 腿1:台账全量 dump（只读）+ 用户映射
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qab4-02-ledgerdump.ts <outDir>
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <outDir>');
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = neon(url);
type Row = Record<string, unknown>;

async function main() {
  const entries = (await sql`
    SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid,
           delta::text AS delta, frozen_delta::text AS frozen_delta,
           kind, ref_type, ref_id::text AS ref_id,
           idempotency_key, event_root_key, memo,
           to_char(time_created AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS t
      FROM public.ledger_entry ORDER BY txid`) as Row[];
  const users = (await sql`
    SELECT uid::text AS uid, is_admin, bio FROM public.users ORDER BY uid`) as Row[];
  fs.writeFileSync(path.join(outDir, 'qab4-02-ledger.json'), JSON.stringify({ entries, users }, null, 1));
  console.log(JSON.stringify({ n_entries: entries.length, n_users: users.length, last_txid: entries.length ? entries[entries.length - 1].txid : null }));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
