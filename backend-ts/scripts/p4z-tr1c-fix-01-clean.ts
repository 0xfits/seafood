/**
 * P6-TR-1c-FIX · 数据清洗（stub 假译文污染）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-fix-01-clean.ts
 * 动作（**仅此两件 DML**；先报改前计数，事务内执行，再报改后计数）：
 *   ① content_translation：text 匹配 `^\[(en|vn)\] `（stub 前缀）⇒ **复位**（不删行）：
 *        status='pending', text=NULL, attempts=0, last_error=NULL（保留登记，让真引擎重做）；
 *   ② translation_cache：text_out 匹配 `^\[(en|vn)\] ` ⇒ **删除**（否则真翻译永远命中假缓存）。
 * 只打印计数/机读 reason；不读取/打印任何密钥值。
 * 产物：backend-ts/.p4-artifacts/p6tr1cfix-<RUN>/clean.json
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1cfix-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_WRITE = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING
  || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!URL_WRITE) { console.error('NO_URL'); process.exit(2); }
const pool = new Pool({ connectionString: URL_WRITE, max: 2 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];

/** stub 前缀正则（Postgres ~ 语义）：`^\[(en|vn)\] ` */
const STUB = '^\\[(en|vn)\\] ';

const counts = async (): Promise<Record<string, unknown>> => {
  const ct = await q(`select
      count(*)::int as ct_total,
      count(*) filter (where text ~ $1)::int as ct_stub_text,
      count(*) filter (where status='ready')::int as ct_ready,
      count(*) filter (where status='pending')::int as ct_pending,
      count(*) filter (where status='failed')::int as ct_failed,
      count(*) filter (where status='deferred')::int as ct_deferred
    from public.content_translation`, [STUB]);
  const ca = await q(`select
      count(*)::int as cache_total,
      count(*) filter (where text_out ~ $1)::int as cache_stub_text,
      count(*) filter (where engine='stub')::int as cache_engine_stub,
      count(*) filter (where engine='opencc')::int as cache_engine_opencc,
      count(*) filter (where engine='deepseek')::int as cache_engine_deepseek
    from public.translation_cache`, [STUB]);
  return { ...ct[0], ...ca[0] };
};

const main = async (): Promise<void> => {
  const before = await counts();
  const tx = await (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE public.content_translation
            SET status='pending', text=NULL, attempts=0, last_error=NULL, updated_at=now()
          WHERE text ~ $1`, [STUB]);
      const del = await client.query(
        `DELETE FROM public.translation_cache WHERE text_out ~ $1`, [STUB]);
      await client.query('COMMIT');
      return { reset: upd.rowCount || 0, deleted: del.rowCount || 0 };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
      throw e;
    } finally { client.release(); }
  })();
  const after = await counts();
  const out = { unit: 'P6-TR-1c-FIX', run: RUN, generated_at: new Date().toISOString(), stub_pattern: STUB, before, dml: tx, after };
  fs.writeFileSync(path.join(OUT_DIR, 'clean.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log('BEFORE', JSON.stringify(before));
  console.log('DML', JSON.stringify(tx));
  console.log('AFTER', JSON.stringify(after));
  console.log('ARTIFACT', path.join(OUT_DIR, 'clean.json'));
  await pool.end();
};
main().catch(async (e) => { console.error('CLEAN_CRASHED', (e as Error)?.message); try { await pool.end(); } catch { /* */ } process.exit(1); });
