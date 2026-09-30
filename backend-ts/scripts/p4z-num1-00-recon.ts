// p4z-num1-00-recon.ts — NUM-1 前置侦察：Σtotal 基线 + 可用余额最大的用户（只 SELECT）
// 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-num1-00-recon.ts
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}
/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sql = neon(String(process.env.DATABASE_URL || ''));

const main = async () => {
  const s = (await sql('SELECT COALESCE(sum(balance+frozen),0)::text AS sigma, COALESCE(sum(balance),0)::text AS sbal, COALESCE(sum(frozen),0)::text AS sfrz, count(*)::int AS n FROM public.account')) as Array<Record<string, string>>;
  const top = (await sql('SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen FROM public.account WHERE cid = 1 ORDER BY balance::bigint DESC LIMIT 12')) as Array<Record<string, string>>;
  const cidSum = (await sql('SELECT cid::text AS cid, count(*)::int AS n, COALESCE(sum(balance+frozen),0)::text AS sigma FROM public.account GROUP BY cid ORDER BY cid::bigint')) as Array<Record<string, string>>;
  console.log('CIDSUM ' + JSON.stringify(cidSum));
  const drafts = (await sql("SELECT cid::text AS cid, owner_uid::text AS owner_uid, symbol FROM public.currency WHERE status = 'draft' ORDER BY cid")) as Array<Record<string, string>>;
  console.log('SIGMA ' + JSON.stringify(s[0]));
  console.log('TOP ' + JSON.stringify(top));
  console.log('DRAFTS ' + JSON.stringify(drafts.slice(0, 20)));
};
main().catch((e) => { console.error('RECON_ERR ' + String(e).slice(0, 300)); process.exit(1); });
