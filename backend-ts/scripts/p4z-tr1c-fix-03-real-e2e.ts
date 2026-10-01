/**
 * P6-TR-1c-FIX · 收尾：真引擎小批复验（≤6 行）× 2 路
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-fix-03-real-e2e.ts
 *   路径 A（**mandated**）：POST /api/translate/backfill {mode:'translate', limit:6}
 *      —— 走既有 backfill 端点（listPending 按 updated_at ASC 取最旧 6 行）。
 *   路径 B（补充）：真引擎**定向小批**——对 listing 19（中文源，仍 pending）跑
 *      translateFields（同一真引擎代码路径）；因最旧 6 行是 ASCII 夹具（job 11/12），
 *      路径 A 的源无 CJK ⇒ vn 无「声调」可言，故须对 CJK 源另跑一小批证明
 *      ② en 非 CJK / vn 含声调 / hk 繁体。
 * 成本：路径 A 在**独立进程** ⇒ usage 不可观测（记 NOT_MEASURED，非 0）；
 *       路径 B 在**本进程**内以 fetch 包装实测 calls + tokens。
 * 不打印任何密钥值。产物：.p4-artifacts/p6tr1cfix-<RUN>/real-e2e.json
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

const BASE = process.env.SEAFOOD_API || 'http://127.0.0.1:5788';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1cfix-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_ANY = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!URL_ANY) { console.error('NO_URL'); process.exit(2); }
const pool = new Pool({ connectionString: URL_ANY, max: 2 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];

const STUB_RE = /^\[(en|vn)\] /;
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const VN_RE = /[\u00c0-\u00c3\u00c8-\u00ca\u00cc-\u00cd\u00d2-\u00d5\u00d9-\u00da\u00e0-\u00e3\u00e8-\u00ea\u00ec-\u00ed\u00f2-\u00f5\u00f9-\u00fa\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/;

const rowsOf = async (et: string, id: string) => q<{ field: string; lang: string; status: string; text: string | null; last_error: string | null }>(
  `select field, lang, status, text, last_error from public.content_translation
    where entity_type=$1 and entity_id=$2 order by field, lang`, [et, id]);

const main = async (): Promise<void> => {
  const out: Record<string, unknown> = { unit: 'P6-TR-1c-FIX', run: RUN, generated_at: new Date().toISOString() };

  // ---------- 路径 A：既有 backfill 端点（真引擎，limit=6） ----------
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) { console.error('NO_CRON_SECRET'); process.exit(2); }
  const beforeA = await q(`select entity_type, entity_id, field, lang from public.content_translation
      where status in ('pending','failed') and attempts < 5 order by updated_at asc limit 6`);
  const resA = await fetch(`${BASE}/api/translate/backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ mode: 'translate', limit: 6 }),
  });
  const jsonA = await resA.json() as { data?: Record<string, unknown> };
  const processedA = Array.from(new Set(beforeA.map((r) => `${r.entity_type}:${r.entity_id}`)));
  const afterA: Record<string, unknown> = {};
  for (const g of processedA) {
    const [et, id] = g.split(':');
    afterA[g] = await rowsOf(et, id);
  }
  out.pathA_backfill_endpoint = {
    http_status: resA.status,
    batch_selected: beforeA,
    batch_entities: processedA,
    response: jsonA.data || jsonA,
    rows_after: afterA,
    llm_calls: (jsonA.data as { retried?: number } | undefined)?.retried ?? 'NOT_MEASURED',
    tokens: 'NOT_MEASURED（端点跑在独立服务进程，本进程无法观测 usage）',
  };

  // ---------- 路径 B：真引擎定向小批（CJK 源 listing 19） ----------
  const TS = await import('../src/translate-service');
  let calls = 0; let promptTokens = 0; let completionTokens = 0;
  const origFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: unknown }).fetch = async (u: string, init: Record<string, unknown>) => {
    calls += 1;
    const r = await (origFetch as unknown as (a: string, b: unknown) => Promise<Response>)(u, init);
    try {
      const j = await r.clone().json() as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
      promptTokens += Number(j?.usage?.prompt_tokens || 0);
      completionTokens += Number(j?.usage?.completion_tokens || 0);
    } catch { /* usage 不可得 */ }
    return r;
  };
  const srcRows = await q<{ title: string; description: string }>(
    `select title, description from public.listing where listing_id = 19`);
  const srcTitle = String(srcRows[0]?.title ?? '');
  const srcDesc = String(srcRows[0]?.description ?? '');
  const cfg = TS.getTranslateConfig();
  const t0 = Date.now();
  const runB = await TS.translateFields({ title: srcTitle, description: srcDesc }, {
    entityType: 'listing', entityId: '19', store: TS.createDbStore(),
  });
  const msB = Date.now() - t0;
  (globalThis as unknown as { fetch: unknown }).fetch = origFetch;
  const rowsAfterB = await rowsOf('listing', '19');
  const get = (f: string, l: string) => rowsAfterB.find((r) => r.field === f && r.lang === l);

  const enTitle = String(get('title', 'en')?.text ?? '');
  const vnTitle = String(get('title', 'vn')?.text ?? '');
  const hkTitle = String(get('title', 'hk')?.text ?? '');
  const vnDesc = String(get('description', 'vn')?.text ?? '');
  const enDesc = String(get('description', 'en')?.text ?? '');
  const hkDesc = String(get('description', 'hk')?.text ?? '');

  out.pathB_targeted_real = {
    source: { title: srcTitle, description: srcDesc },
    engine: cfg.engine, model: cfg.model, api_key_present: cfg.api_key_present,
    llm_calls: calls, prompt_tokens: promptTokens, completion_tokens: completionTokens, elapsed_ms: msB,
    result_statuses: runB.statuses, result_errors: runB.errors,
    rows_after: rowsAfterB,
    assertions: {
      vn_title_status_ready: get('title', 'vn')?.status === 'ready',
      vn_desc_status_ready: get('description', 'vn')?.status === 'ready',
      en_majority_non_cjk: (enTitle.match(CJK_RE) || []).length === 0 && (enDesc.match(CJK_RE) || []).length === 0,
      vn_has_diacritics: VN_RE.test(vnTitle) && VN_RE.test(vnDesc),
      hk_is_traditional: hkTitle.length > 0 && hkDesc.length > 0 && hkTitle !== srcTitle,
      hk_no_latin_only: CJK_RE.test(hkTitle),
      no_stub_prefix: ![enTitle, vnTitle, hkTitle, enDesc, vnDesc, hkDesc].some((x) => STUB_RE.test(x)),
    },
  };

  // ---------- 读回面无 stub 前缀（类级） ----------
  const stubNow = await q(`select count(*)::int n from public.content_translation c
      join public.listing l on l.listing_id::text = c.entity_id
     where c.entity_type='listing' and (c.text ~ '^\\[(en|vn)\\] ')`);
  out.stub_rows_in_listing_ct = stubNow[0]?.n ?? 'NOT_MEASURED';

  const text = JSON.stringify(out, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'real-e2e.json'), text + '\n', 'utf8');
  console.log(text);
  await pool.end();
};
main().catch(async (e) => { console.error('REAL_E2E_CRASHED', (e as Error)?.message); try { await pool.end(); } catch { /* */ } process.exit(1); });
