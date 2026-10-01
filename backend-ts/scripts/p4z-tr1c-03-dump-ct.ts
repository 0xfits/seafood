/**
 * P6-TR-1c-B · 诊断：content_translation / translation_cache 现状 dump（只读）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-03-dump-ct.ts [entity_id]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '', max: 2 });
const q = async (s: string, p: unknown[] = []) => (await pool.query(s, p as never[])).rows;

const main = async (): Promise<void> => {
  const id = process.argv[2] || '24';
  const rows = await q(
    `select entity_type, entity_id, field, lang, status, attempts, left(coalesce(last_error,''), 200) as last_error,
            case when text is null then 'NULL' else left(text, 60) end as text_head
       from public.content_translation where entity_type='job' and entity_id=$1 order by field, lang`, [id]);
  console.log('CT_ROWS', JSON.stringify(rows, null, 1));
  const cache = await q(
    `select tgt_lang, engine, left(text_out, 60) as head from public.translation_cache order by engine, tgt_lang`);
  console.log('CACHE', JSON.stringify(cache, null, 1));
  await pool.end();
};
main().catch(async (e) => { console.error('DUMP_CRASHED', (e as Error)?.message); try { await pool.end(); } catch { /* */ } process.exit(1); });
