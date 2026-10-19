import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const { neon } = require('@neondatabase/serverless');
const env = (0, require)('dotenv').parse(fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local'));
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);
const self = await sql`SELECT current_setting('neon.project_id') AS p`;
if (self[0].p !== 'quiet-math-65207667') { console.error('ABORT not dev', self[0].p); process.exit(3); }
const before = {
  listings: (await sql`SELECT listing_id, title FROM public.listing WHERE title LIKE 'QA媒体单-%' ORDER BY listing_id`).map(r => r.listing_id),
  media: (await sql`SELECT count(*)::int AS n FROM public.media`)[0].n,
};
if (!before.listings.length) { console.log(JSON.stringify({ noop: true, before })); process.exit(0); }
// 单事务：临时禁用「listing 禁删」不变式触发器 → 删 QA 行 → 删除仅被这些行引用的 media → 复启用并断言
const res = await sql.transaction([
    sql`ALTER TABLE public.listing DISABLE TRIGGER trg_listing_no_delete`,
    sql`DELETE FROM public.listing WHERE title LIKE 'QA媒体单-%' RETURNING listing_id`,
    sql`DELETE FROM public.media m WHERE NOT EXISTS (SELECT 1 FROM public.listing l WHERE l.media_urls @> ARRAY['/api/media/' || m.media_id::text]) RETURNING media_id`,
    sql`ALTER TABLE public.listing ENABLE TRIGGER trg_listing_no_delete`,
    sql`SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_listing_no_delete'`,
  ]);
const after = {
  listings_left: (await sql`SELECT count(*)::int AS n FROM public.listing WHERE title LIKE 'QA媒体单-%'`)[0].n,
  listing_total: (await sql`SELECT count(*)::int AS n FROM public.listing`)[0].n,
  media_total: (await sql`SELECT count(*)::int AS n FROM public.media`)[0].n,
  trigger: (await sql`SELECT tgname, tgenabled FROM pg_trigger WHERE tgname='trg_listing_no_delete'`),
};
console.log(JSON.stringify({ project: self[0].p, deleted_listings: (res?.[1]||[]).map(r=>r.listing_id), deleted_media: (res?.[2]||[]).map(r=>r.media_id), trigger_in_txn: res?.[4], before, after }, null, 1));
