/**
 * P6-TR-1c-FIX · 只读探针：stub 假译文污染计数 + i18n 分布快照
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-fix-00-probe.ts
 * 只读；不打印任何密钥值。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const URL_ANY = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!URL_ANY) { console.error('NO_URL'); process.exit(2); }
const pool = new Pool({ connectionString: URL_ANY, max: 2 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];

const STUB = `^\\[(en|vn)\\] `;

const main = async (): Promise<void> => {
  const ct = await q(`select
      count(*)::int as total,
      count(*) filter (where text ~ $1)::int as stub_text,
      count(*) filter (where status='ready')::int as ready,
      count(*) filter (where status='pending')::int as pending,
      count(*) filter (where status='failed')::int as failed,
      count(*) filter (where status='deferred')::int as deferred
    from public.content_translation`, [STUB]);
  const cache = await q(`select
      count(*) filter (where text_out ~ $1)::int as stub_cache,
      count(*) filter (where engine='stub')::int as engine_stub,
      count(*) filter (where engine='opencc')::int as engine_opencc,
      count(*) filter (where engine='deepseek')::int as engine_deepseek,
      count(*)::int as total
    from public.translation_cache`, [STUB]);
  const byLang = await q(`select lang, status, count(*)::int as n
    from public.content_translation group by lang, status order by lang, status`);
  const ctStub = await q(`select entity_type, entity_id, field, lang, status, left(text,40) as text_head
    from public.content_translation where text ~ $1 order by entity_type, entity_id, field, lang limit 20`, [STUB]);
  const cacheStub = await q(`select tgt_lang, engine, left(text_out,40) as head
    from public.translation_cache where text_out ~ $1 order by tgt_lang limit 20`, [STUB]);
  console.log('CT', JSON.stringify(ct[0]));
  console.log('CACHE', JSON.stringify(cache[0]));
  console.log('BY_LANG_STATUS', JSON.stringify(byLang));
  console.log('CT_STUB_ROWS', JSON.stringify(ctStub, null, 1));
  console.log('CACHE_STUB_ROWS', JSON.stringify(cacheStub, null, 1));
  await pool.end();
};
main().catch(async (e) => { console.error('PROBE_CRASHED', (e as Error)?.message); try { await pool.end(); } catch { /* */ } process.exit(1); });
