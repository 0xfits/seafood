// p4z-b3afix2-03-fixtures.ts — 夹具普查（只读）：列出可用账户 (uid,cid) 与币种状态，供负对照选样
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix2-03-fixtures.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix2-run'));
fs.mkdirSync(outDir, { recursive: true });

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
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), mode: 'READ-ONLY' };
  out.accounts = await sql(`SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen FROM public.account ORDER BY uid, cid`);
  out.currencies = await sql(`SELECT cid::text AS cid, symbol, status, decimals::int AS decimals FROM public.currency ORDER BY cid`);
  out.users = await sql(`SELECT uid::text AS uid, left(evm, 10) AS evm_head FROM public."users" ORDER BY uid LIMIT 10`);
  fs.writeFileSync(path.join(outDir, 'b3afix2-03-fixtures.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3afix2-03-fixtures.json'));
  console.log('ACCOUNTS ' + JSON.stringify(out.accounts));
  console.log('CURRENCIES ' + JSON.stringify(out.currencies));
  console.log('USERS ' + JSON.stringify(out.users));
};
main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
