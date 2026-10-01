/**
 * P6-TR-1b · 临时测试数据清理 + 残留登记
 * 用法：npx ts-node --transpile-only scripts/p4z-tr1b-03-cleanup.ts
 * 语义：删掉本次探针写入 content_translation / translation_cache 的一切行；
 *       job/listing 测试行（触发器禁 DELETE）**逐行登记为 residual**。
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
import { sha256Hex } from '../src/translate-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '', max: 3 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];

const TEXTS = [
  '海鲜招工测试甲：整理货架与盘点',
  '负责每日盘点与货架整理，包午餐',
  '海鲜礼盒测试丙：虾蟹双拼',
  '顺丰包邮，含虾蟹各两斤，冷链发货',
];

const main = async () => {
  const artDir = path.join(__dirname, '..', '.p4-artifacts');
  const runs = fs.readdirSync(artDir).filter((d) => /^p6tr1b-\d/.test(d)).sort();
  const latest = runs[runs.length - 1];
  const e2e = JSON.parse(fs.readFileSync(path.join(artDir, latest, 'e2e.json'), 'utf8')) as any;
  const jobIds: string[] = [...(e2e.residual?.job_ids ?? [])];
  const listIds: string[] = [...(e2e.residual?.listing_ids ?? [])];
  const jobB: string | undefined = e2e.ids?.jobB && /^\d+$/.test(String(e2e.ids.jobB)) ? String(e2e.ids.jobB) : undefined;
  const ids = [...new Set([...jobIds, ...listIds, ...(jobB ? [jobB] : [])])];
  console.log('ARTIFACT_RUN', latest, 'target_entity_ids', JSON.stringify(ids));

  const hashes = [...new Set(TEXTS.map(sha256Hex))];
  const delCt = await q<{ n: string }>(
    `with d as (delete from public.content_translation where entity_id = any($1::text[]) returning 1)
     select count(*)::text as n from d`, [ids]);
  const delCache = await q<{ n: string }>(
    `with d as (delete from public.translation_cache where src_hash = any($1::text[]) returning 1)
     select count(*)::text as n from d`, [hashes]);

  const leftCt = await q<{ c: string }>(
    `select count(*)::text as c from public.content_translation where entity_id = any($1::text[])`, [ids]);
  const leftCache = await q<{ c: string }>(
    `select count(*)::text as c from public.translation_cache where src_hash = any($1::text[])`, [hashes]);
  // translation_cache 里 engine='opencc' / engine='stub' 的行是否还剩（本单探针产物）
  const leftEng = await q<{ engine: string; n: string }>(
    `select engine, count(*)::text as n from public.translation_cache
      where engine in ('opencc','stub') group by engine order by engine`);

  console.log('CLEANUP', JSON.stringify({
    content_translation_deleted: delCt[0].n,
    translation_cache_deleted: delCache[0].n,
    remaining_content_translation_for_test_ids: leftCt[0].c,
    remaining_translation_cache_for_test_hashes: leftCache[0].c,
  }));
  console.log('CACHE_BY_ENGINE_LEFT', JSON.stringify(leftEng));
  console.log('RESIDUAL', JSON.stringify({
    delete_blocked_by_trigger: { job: jobIds, listing: listIds },
    note: '0013/0015 DL79 触发器禁 DELETE ⇒ 内容行残留（已在报告逐行登记）；译文行/缓存行已清零',
  }));
};

main()
  .catch((e) => { console.error('CLEANUP_FATAL:', (e as Error)?.message ?? e); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => undefined); });
