// QA-job read-only DB probe (AC2 negative control): currency rows in dev DB.
// STRICTLY SELECT — no writes, no DDL. Reads connection string from backend-ts/.env.local only.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const { neon } = require('@neondatabase/serverless');

const envText = fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const sql = neon(env.DATABASE_URL);

const rows = await sql`SELECT cid::text AS cid, symbol, name, status FROM public.currency ORDER BY cid::int`;
const listed = rows.filter((r) => r.status === 'listed');
const notListed = rows.filter((r) => r.status !== 'listed');

console.log(JSON.stringify({
  sql: 'SELECT cid::text,symbol,name,status FROM public.currency ORDER BY cid::int  -- READ ONLY',
  at: new Date().toISOString(),
  total: rows.length,
  status_counts: rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}),
  listed: listed.map((r) => ({ cid: r.cid, symbol: r.symbol, name: r.name })),
  not_listed: notListed.map((r) => ({ cid: r.cid, symbol: r.symbol, name: r.name, status: r.status })),
}, null, 2));
