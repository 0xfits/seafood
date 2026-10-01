/**
 * P6-TR-1c-B · 存量「可译内容」侦察（真库只读）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-00-recon.ts
 * 目的：为「扫存量 ⇒ 补 pending 行」推导**候选集合规模**（真库现取，非硬编码），
 *   并报「现有 content_translation 行数」以量化缺口（存量无行）。
 * 只读：零 INSERT/UPDATE/DELETE；零 API 调用；不打印任何密钥值（只判存在）。
 * 产物：backend-ts/.p4-artifacts/p6tr1c-<RUN>-recon/recon.json
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
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1c-${RUN}-recon`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '', max: 3 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];

const main = async (): Promise<void> => {
  const out: Record<string, unknown> = { unit: 'P6-TR-1c-B', run: RUN, generated_at: new Date().toISOString() };

  // 表 / 列存在性（避免存量库 schema 漂移导致 42P01 直接崩）
  const cols = async (t: string): Promise<string[]> =>
    (await q<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t],
    )).map((r) => r.column_name);
  out.tables = { job: await cols('job'), listing: await cols('listing'), users: await cols('users'), currency: await cols('currency') };

  // 候选读数：每个 (entity, field, lang) 组合 = 非空文本字段数 × 3 语言
  const cand = async (sql: string): Promise<number> => Number(((await q<{ n: number }>(sql))[0] || {}).n || 0);
  const jobRows = await cand(`select count(*)::int as n from public.job`);
  const jobTitle = await cand(`select count(*)::int as n from public.job where coalesce(btrim(title),'') <> ''`);
  const jobDesc = await cand(`select count(*)::int as n from public.job where coalesce(btrim(description),'') <> ''`);
  const listingRows = await cand(`select count(*)::int as n from public.listing`);
  const listingTitle = await cand(`select count(*)::int as n from public.listing where coalesce(btrim(title),'') <> ''`);
  const listingDesc = await cand(`select count(*)::int as n from public.listing where coalesce(btrim(description),'') <> ''`);
  const userBio = await cand(`select count(*)::int as n from public.users where coalesce(btrim(bio),'') <> ''`);
  const currencyName = await cand(`select count(*)::int as n from public.currency where coalesce(btrim(name),'') <> ''`);
  const ctRows = await cand(`select count(*)::int as n from public.content_translation`);
  const ctByType = await q(`select entity_type, count(*)::int as n from public.content_translation group by entity_type order by entity_type`);
  const todayRows = await cand(`select count(*)::int as n from public.content_translation where updated_at >= date_trunc('day', now())`);
  const cacheRows = await cand(`select count(*)::int as n from public.translation_cache`);

  out.readings = {
    job_rows: jobRows, job_title_nonempty: jobTitle, job_desc_nonempty: jobDesc,
    listing_rows: listingRows, listing_title_nonempty: listingTitle, listing_desc_nonempty: listingDesc,
    users_bio_nonempty: userBio, currency_name_nonempty: currencyName,
    content_translation_rows: ctRows, content_translation_by_type: ctByType,
    content_translation_today_rows: todayRows, translation_cache_rows: cacheRows,
  };
  out.candidate_combos = {
    definition: '每张表的非空可译字段数 × 3 语言（en/vn/hk）之和',
    job: (jobTitle + jobDesc) * 3,
    listing: (listingTitle + listingDesc) * 3,
    user: userBio * 3,
    currency: currencyName * 3,
    total: (jobTitle + jobDesc + listingTitle + listingDesc + userBio + currencyName) * 3,
  };

  // 抽 3 个含 CJK 的 job（标题）作真引擎翻译候选（现取，非硬编码 id）
  out.translation_cache_dump = await q(`
    select src_hash, src_lang, tgt_lang, engine, left(text_out, 40) as text_out_head
      from public.translation_cache order by created_at asc`);
  out.cjk_job_samples = await q(`
    select job_id::text as id, left(title, 40) as title, left(coalesce(description,''), 60) as description
      from public.job
     where coalesce(btrim(title),'') <> '' and title ~ '[\\u4e00-\\u9fff]'
     order by job_id asc limit 3`);
  out.cjk_listing_samples = await q(`
    select listing_id::text as id, left(title, 40) as title
      from public.listing
     where coalesce(btrim(title),'') <> '' and title ~ '[\\u4e00-\\u9fff]'
     order by listing_id asc limit 3`);

  const text = JSON.stringify(out, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'recon.json'), text + '\n', 'utf8');
  console.log(text);
  await pool.end();
};

main().catch(async (e) => {
  console.error('RECON_CRASHED', (e as Error)?.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
