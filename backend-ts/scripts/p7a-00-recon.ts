/**
 * p7a-00-recon.ts — 批 7-A 开工前 DB 侦察（**只读**）
 * 口径：只 SELECT；产物 run-tagged；不落 token/密钥。
 * 用途：确认 `public.ledger_entry` / `public.account` / `public.currency` 真值分布，
 *       挑出「多行 uid」「有 transfer 行」的夹具候选，供 keyset 翻页自证。
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p7a-00-recon.ts <outDirAbs>
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
if (!url) throw new Error('no DB url');
const sql = neon(url);
type Row = Record<string, unknown>;

(async () => {
  const out: Record<string, unknown> = { run: path.basename(outDir), probe: 'p7a-00-recon' };
  out.ledger_total = (await sql`SELECT COUNT(1)::int AS n FROM public.ledger_entry`) as Row[];
  out.by_kind = (await sql`SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY n DESC`) as Row[];
  out.top_uids = (await sql`SELECT uid::text AS uid, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY uid HAVING COUNT(1) >= 3 ORDER BY n DESC LIMIT 15`) as Row[];
  out.transfer_uids = (await sql`SELECT uid::text AS uid, COUNT(1)::int AS n FROM public.ledger_entry WHERE kind='transfer' GROUP BY uid ORDER BY n DESC LIMIT 8`) as Row[];
  out.account_all = (await sql`SELECT COUNT(1)::int AS n, COALESCE(SUM(balance),0)::text AS sb, COALESCE(SUM(frozen),0)::text AS sf FROM public.account`) as Row[];
  out.account_cid1 = (await sql`SELECT COUNT(1)::int AS n, COALESCE(SUM(balance),0)::text AS sb FROM public.account WHERE cid=1`) as Row[];
  out.currency = (await sql`SELECT cid::text AS cid, symbol, status FROM public.currency ORDER BY cid LIMIT 30`) as Row[];
  out.ledger_cols = (await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_entry' ORDER BY ordinal_position`) as Row[];
  out.public_tables = (await sql`SELECT COUNT(1)::int AS n FROM information_schema.tables WHERE table_schema='public'`) as Row[];
  // 挑一个 uid：既有足够多行、又含 transfer（用于 keyset 翻页 + kind 过滤自证）
  out.pick_uid = (await sql`
    SELECT uid::text AS uid,
           COUNT(1)::int AS total,
           SUM(CASE WHEN kind='transfer' THEN 1 ELSE 0 END)::int AS transfers,
           MIN(txid)::text AS min_txid, MAX(txid)::text AS max_txid
      FROM public.ledger_entry WHERE uid > 0 GROUP BY uid
     HAVING COUNT(1) >= 4 ORDER BY COUNT(1) DESC LIMIT 10`) as Row[];

  const file = path.join(outDir, `p7a-00-recon-${path.basename(outDir)}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('WROTE', file);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
