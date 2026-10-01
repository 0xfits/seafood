/**
 * P6-TR-1c-B · 真引擎单次诊断（**不落库**：store=null；1 次真实调用）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-06-probe-llm.ts
 * 目的：看清 deepseek-flash 对「单字段/双字段」批任务的实际 JSON 形态与三重校验结论。
 * 安全：只打印**测试内容**（job 24 为测试数据）；不打印任何 key 值。
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
import { translateFields, validateFieldSet, hasVietnameseDiacritics, hasCJK, getTranslateConfig } from '../src/translate-service';
import type { FetchLike } from '../src/translate-service';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1c-${RUN}-probe`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '', max: 2 });
const q = async (s: string, p: unknown[] = []) => (await pool.query(s, p as never[])).rows;

let calls = 0;
const raws: string[] = [];
const capturing: FetchLike = (async (url: string, init: Record<string, unknown>) => {
  calls += 1;
  const res = await (globalThis.fetch as unknown as (u: string, i: unknown) => Promise<Response>)(url, init);
  const bodyText = await res.text();
  try { const e = JSON.parse(bodyText) as { choices?: Array<{ message?: { content?: string } }> }; raws.push(String(e?.choices?.[0]?.message?.content || '')); } catch { raws.push('<non-json>'); }
  return { ok: res.ok, status: res.status, text: async () => bodyText };
}) as unknown as FetchLike;

const main = async (): Promise<void> => {
  const src = await q(`select title, coalesce(description,'') as description from public.job where job_id=24`);
  const title = String((src[0] as { title: string }).title || '');
  const desc = String((src[0] as { description: string }).description || '');
  const out: Record<string, unknown> = { unit: 'P6-TR-1c-B-probe', run: RUN, engine: getTranslateConfig().engine, model: getTranslateConfig().model };

  // A) 单字段 title → en+vn
  const a = await translateFields({ title }, { entityType: 'job', entityId: '24', store: null, fetchImpl: capturing });
  out.single_field = { statuses: a.statuses, errors: a.errors, texts: a.texts, calls_so_far: calls, raw_head: raws[0] ? raws[0].slice(0, 400) : null };

  // B) 双字段 title+description → en+vn
  const b = await translateFields({ title, description: desc }, { entityType: 'job', entityId: '24', store: null, fetchImpl: capturing });
  out.two_fields = { statuses: b.statuses, errors: b.errors, texts: b.texts, calls_so_far: calls, raw_head: raws[1] ? raws[1].slice(0, 500) : null };

  out.checks = {
    single_title_en_ok: !hasCJK(String(a.texts.title?.en || '')),
    single_title_vn_has_diacritics: hasVietnameseDiacritics(String(a.texts.title?.vn || '')),
    two_title_en_ok: !hasCJK(String(b.texts.title?.en || '')),
    two_title_vn_has_diacritics: hasVietnameseDiacritics(String(b.texts.title?.vn || '')),
    two_valid_en_subset: validateFieldSet({ title, description: desc }, 'en', raws[1] || '').errors,
    two_valid_vn_subset: validateFieldSet({ title, description: desc }, 'vn', raws[1] || '').errors,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'probe.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  console.log(`PROBE calls=${calls} artifact=${path.join(OUT_DIR, 'probe.json')}`);
  await pool.end();
};
main().catch(async (e) => { console.error('PROBE_CRASHED', (e as Error)?.message); try { await pool.end(); } catch { /* */ } process.exit(2); });
