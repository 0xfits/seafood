// 只读钻取（零写）：为什么事件级配对不变式在生产有 28 个非零根键
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const REPO = '/Users/kevin/bistro/seafood';
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');
const envFile = path.join(process.env.HOME, '.config/seafood/prod-db.env');
const envText = fs.readFileSync(envFile, 'utf8');
const pick = (k) => { const m = envText.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
const url = pick('DATABASE_URL_UNPOOLED');
const sql = neon(url);
(async () => {
  const out = {};
  out.sample_market_trade = await sql`
    SELECT txid::text, uid::text, kind, delta::text, frozen_delta::text, ref_type, ref_id::text
      FROM public.ledger_entry WHERE ref_type='market_trade' AND ref_id=4 ORDER BY txid`;
  out.sample_transfer_nullref = await sql`
    SELECT txid::text, uid::text, kind, delta::text, frozen_delta::text, ref_type, ref_id::text,
           idempotency_key
      FROM public.ledger_entry WHERE ref_type IS NULL ORDER BY txid LIMIT 30`;
  out.transfer_rows = await sql`
    SELECT ref_type, ref_id::text AS ref_id, count(*)::int AS n, SUM(delta)::text AS net
      FROM public.ledger_entry WHERE kind='transfer' GROUP BY 1,2 ORDER BY 1,2`;
  out.kind_has_ref = await sql`
    SELECT kind, count(*)::int AS n, count(*) FILTER (WHERE ref_type IS NULL)::int AS null_ref
      FROM public.ledger_entry GROUP BY kind ORDER BY kind`;
  out.platform_uid = await sql`
    SELECT uid::text, cid::text, balance::text, frozen::text FROM public.account WHERE uid < 0 ORDER BY uid`;
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(__dirname, 'drill-' + new Date().toISOString().replace(/[:.]/g,'') + '.json'), JSON.stringify(out, null, 2));
})().catch((e) => { console.log('ERROR=', e && e.message); process.exit(1); });
