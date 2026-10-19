const fs = require('fs');
const { createRequire } = require('node:module');
const req = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const { neon } = req('@neondatabase/serverless');
const txt = fs.readFileSync('.env.local', 'utf8');
const m = txt.match(/^(?:export\s+)?DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
(async () => {
  const sql = neon(m[1].replace(/^[\s'"]+|[\s'"]+$/g, ''));
  const rows = await sql`select listing_id::int as id, status from public.listing order by 1`;
  let all = [];
  let skip = 0;
  for (;;) {
    const r = await fetch(`http://localhost:5788/api/prize/all?skip=${skip}&limit=36`);
    const j = await r.json();
    const d = j.data || [];
    all.push(...d.map((x) => x.bID));
    if (d.length < 36) break;
    skip += 36;
  }
  const nonListed = rows.filter((r) => r.status !== 'listed').map((r) => r.id);
  const leaked = nonListed.filter((id) => all.includes(id));
  const listedMissing = rows.filter((r) => r.status === 'listed').map((r) => r.id).filter((id) => !all.includes(id));
  console.log('db rows=', rows.length, 'feed cards=', all.length, 'nonListed=', nonListed.length, 'LEAKED=', JSON.stringify(leaked), 'listedMissing=', JSON.stringify(listedMissing));
  console.log('status dist=', JSON.stringify(rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})));
})().catch((e) => { console.error('ERR', String(e).slice(0, 200)); process.exit(1); });
