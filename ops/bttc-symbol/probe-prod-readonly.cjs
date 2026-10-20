// 生产只读预检（零写）：确认 0066 在生产的适用前提（平台行恰 1 / '₿' 未被非平台行占用 / 无重名风险）
const { createRequire } = require('module')
const req = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json')
const { neon } = req('@neondatabase/serverless')
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
if (!url) { console.error('NO_URL'); process.exit(1) }
const sql = neon(url)
;(async () => {
  const pid = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid
  const platform = await sql`SELECT cid::text AS cid, symbol, name, status, is_platform_coin, total_supply::text AS supply FROM public.currency WHERE is_platform_coin = true ORDER BY cid`
  const platformCount = (await sql`SELECT count(*)::int AS n FROM public.currency WHERE is_platform_coin = true`)[0].n
  const btcSign = (await sql`SELECT cid::text AS cid, symbol, name, is_platform_coin FROM public.currency WHERE symbol = '₿'`)
  const stale = (await sql`SELECT count(*)::int AS n FROM public.currency WHERE symbol = 'BTTC'`)[0].n
  const dup = await sql`SELECT symbol, count(*)::int AS n FROM public.currency GROUP BY symbol HAVING count(*) > 1`
  const top = await sql`SELECT version, count(*)::int AS n FROM public.schema_migration GROUP BY version ORDER BY version DESC LIMIT 1`
  const rows = (await sql`SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`)[0]
  console.log(JSON.stringify({ project_id: pid, platform_rows: platform, platform_count: platformCount, btc_sign_rows: btcSign, rows_with_symbol_BTTC: stale, dup_symbols: dup, schema: rows }, null, 1))
  process.exit(0)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
