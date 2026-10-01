/**
 * P6-TR-1c-B · 存量登记 + **真 DeepSeek** 端到端（成本克制）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-07-real-e2e.ts
 * 产物：backend-ts/.p4-artifacts/p6tr1c-<RUN>-real/e2e.json
 *
 * P1 扫描登记幂等（HTTP `mode=scan` ×2 ⇒ 第二次 registered=0、行数不增、零 API）
 * P2 `i18n_status` 改前 = pending（`/api/task/all` 真读回）
 * P3 真引擎 backfill（服务层 `backfillPending` + 计数 fetch）：真调用 + token 用量
 *    · 断言**引擎产出**：en 真英文（非 CJK）/ vn 含越南语声调 / JSON 结构正确
 * P4 读回：`i18n_status` pending → partial/ready；`title_hk` 真繁体；en 现状如实登记
 * P5 HTTP 路由面 `mode=translate` 真跑一次（同函数 + 同路由 + CRON_SECRET 鉴权）
 * P6 账本不变：`Δledger_entry=0`、`Σ(account.balance, cid=1)` 不变
 *
 * 安全：**不打印/不落盘** 任何密钥值（只判存在）；不 `DELETE` job/listing 行（DL79）⇒ 残余登记；
 *   **不删存量译文行**。测试控制（显式登记）：为让真引擎样本确定，把目标实体 pending 行的
 *   `updated_at` 置为最早（仅影响 `listPending` 排序）。清除 TR-1b 探针留下的 `engine='stub'`
 *   假缓存（否则该对象永远命中假缓存、永不产生真译文；只删 stub 假缓存，绝不动译文行）。
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

const API = `http://127.0.0.1:${process.env.PORT || 5788}`;
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1c-${RUN}-real`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGET_JOB = '24';
const REPORT: Record<string, unknown> = { unit: 'P6-TR-1c-B', run: RUN, generated_at: new Date().toISOString(), api_base: API, target_job: TARGET_JOB };
const CHECKS: Array<{ id: string; pass: boolean; expect: unknown; actual: unknown }> = [];
const check = (id: string, pass: boolean, expect: unknown, actual: unknown): void => {
  CHECKS.push({ id, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
  if (!pass) console.log(`FAIL ${id}: expect=${JSON.stringify(expect)} actual=${JSON.stringify(actual)}`);
};
const put = (k: string, v: unknown): void => { REPORT[k] = v; console.log(`>> ${k} = ${JSON.stringify(v)}`); };

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '', max: 3 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];
const scalar = async (s: string, p: unknown[] = []): Promise<string> => String(((await q(s, p))[0] as { v?: unknown })?.v ?? '');

const cronSecret = String(process.env.CRON_SECRET || '').trim();
const apiKeyPresent = String(process.env.DEEPSEEK_API_KEY || '').trim().length > 0;

const httpPost = async (p: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> => {
  const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret }, body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json()) as Record<string, unknown> };
};
const httpGet = async (p: string): Promise<{ status: number; json: Record<string, unknown> }> => {
  const r = await fetch(API + p);
  return { status: r.status, json: (await r.json()) as Record<string, unknown> };
};
const findJob = (json: Record<string, unknown>): Record<string, unknown> | undefined => {
  const data = json.data as Array<Record<string, unknown>> | undefined;
  return Array.isArray(data) ? data.find((x) => Number(x.tID ?? x.tid ?? x.job_id) === Number(TARGET_JOB)) : undefined;
};

interface Usage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; }
const LLM = { calls: 0, usages: [] as Usage[], statuses: [] as number[], raws: [] as string[] };
const countingFetch = (async (url: string, init: Record<string, unknown>) => {
  LLM.calls += 1;
  const res = await (globalThis.fetch as unknown as (u: string, i: unknown) => Promise<Response>)(url, init);
  LLM.statuses.push(res.status);
  const bodyText = await res.text();
  try {
    const envl = JSON.parse(bodyText) as { usage?: Usage; choices?: Array<{ message?: { content?: string } }> };
    if (envl.usage) LLM.usages.push(envl.usage);
    LLM.raws.push(String(envl?.choices?.[0]?.message?.content || ''));
  } catch { LLM.raws.push('<non-json>'); }
  return { ok: res.ok, status: res.status, text: async () => bodyText };
}) as unknown as import('../src/translate-service').FetchLike;

const main = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ts = require('../src/translate-service') as typeof import('../src/translate-service');
  const cfg = ts.getTranslateConfig();

  put('preflight', { deepseek_api_key_present: apiKeyPresent, cron_secret_present: cronSecret.length > 0, engine: cfg.engine, model: cfg.model, base_url: cfg.base_url });
  check('P0.1', apiKeyPresent, 'DEEPSEEK_API_KEY 就位', apiKeyPresent);
  check('P0.2', cronSecret.length > 0, 'CRON_SECRET 就位', cronSecret.length > 0);
  const health = await httpGet('/api/health');
  check('P0.3', health.status === 200, 'service /api/health = 200', health.status);

  const sigma = async (): Promise<string> => scalar('select coalesce(sum(balance),0)::text as v from public.account where cid = 1');
  const ledgerEntryN = async (): Promise<number> => Number(await scalar('select count(*)::text as v from public.ledger_entry'));
  const ctRows = async (): Promise<number> => Number(await scalar('select count(*)::text as v from public.content_translation'));
  const cacheRows = async (): Promise<number> => Number(await scalar('select count(*)::text as v from public.translation_cache'));
  const rowCount = async (t: string): Promise<number> => Number(await scalar(`select count(*)::text as v from public.${t}`));

  const before = {
    sigma_cid1: await sigma(), ledger_entry_n: await ledgerEntryN(), ct_rows: await ctRows(), cache_rows: await cacheRows(),
    job_rows: await rowCount('job'), listing_rows: await rowCount('listing'),
  };
  put('before', before);

  const src = await q<{ title: string; description: string }>(
    `select title, coalesce(description,'') as description from public.job where job_id = $1::bigint`, [TARGET_JOB]);
  const srcTitle = String(src[0]?.title || '');
  const srcDesc = String(src[0]?.description || '');
  put('source', { title: srcTitle, description: srcDesc });
  check('P0.4', srcTitle.length > 0, 'job 24 有源标题', srcTitle);

  const stubBefore = Number(await scalar(`select count(*)::text as v from public.translation_cache where engine='stub'`));
  await q(`delete from public.translation_cache where engine = 'stub'`);
  const stubAfter = Number(await scalar(`select count(*)::text as v from public.translation_cache where engine='stub'`));
  put('stub_cache_cleanup', {
    rationale: "TR-1b 探针写入的 engine='stub' 假缓存（非真译文）；不清则该对象永远命中假缓存",
    removed: stubBefore - stubAfter, ct_rows_untouched: await ctRows(),
  });

  // ---- P1 扫描登记幂等（HTTP `mode=scan`，零 API） ----
  const scan1 = await httpPost('/api/translate/backfill', { mode: 'scan' });
  const ctAfterScan1 = await ctRows();
  const scan2 = await httpPost('/api/translate/backfill', { mode: 'scan' });
  const ctAfterScan2 = await ctRows();
  const d1 = (scan1.json.data || {}) as Record<string, unknown>;
  const d2 = (scan2.json.data || {}) as Record<string, unknown>;
  put('scan_1', { status: scan1.status, data: d1 });
  put('scan_2', { status: scan2.status, data: d2 });
  check('P1.1', scan1.status === 200 && d1.ok === true, 'scan#1 HTTP 200/ok', `${scan1.status}/${d1.ok}`);
  check('P1.2', Number(d1.scan_scanned) > 0 && Number(d1.scan_scanned) === Number(d1.scan_registered) + Number(d1.scan_existing), 'scan#1 scanned=registered+existing>0', JSON.stringify({ s: d1.scan_scanned, r: d1.scan_registered, e: d1.scan_existing }));
  check('P1.3', ctAfterScan1 === before.ct_rows + Number(d1.scan_registered), 'DB 行数 = 基线 + 新登记数', `${ctAfterScan1} vs ${before.ct_rows + Number(d1.scan_registered)}`);
  check('P1.4', Number(d2.scan_registered) === 0, 'scan#2 registered=0（幂等）', d2.scan_registered);
  check('P1.5', ctAfterScan2 === ctAfterScan1, 'scan#2 行数不增', `${ctAfterScan2} vs ${ctAfterScan1}`);
  check('P1.6', Number(d2.scan_existing) === Number(d1.scan_scanned), 'scan#2 existing=scan#1 scanned', `${d2.scan_existing}/${d1.scan_scanned}`);
  const be = (d1.scan_by_entity || {}) as Record<string, { scanned: number; registered: number }>;
  check('P1.7', ['job', 'listing', 'user', 'currency'].every((k) => be[k] && be[k].scanned > 0), '逐实体分解：四类均扫到', JSON.stringify(be));

  // ---- 测试控制：目标实体 6 行复位为 pending（本 run 自造数据；**仅复位、不删行**）并置最早 ----
  await q(`update public.content_translation set status='pending', text=NULL, last_error=NULL, attempts=0,
                  updated_at = now() - interval '2 hours'
            where entity_type='job' and entity_id=$1`, [TARGET_JOB]);

  // ---- P2 改前 i18n_status ----
  const jobBefore = findJob((await httpGet('/api/task/all?limit=100')).json);
  put('job_read_before', jobBefore ? { tID: jobBefore.tID, i18n_status: jobBefore.i18n_status, title: jobBefore.title, title_en: jobBefore.title_en, title_hk: jobBefore.title_hk, title_vn: jobBefore.title_vn } : null);
  check('P2.1', String(jobBefore?.i18n_status) === 'pending', "改前 i18n_status='pending'", jobBefore?.i18n_status);

  // ---- P3 真引擎 backfill（进程内同一函数 + 计数 fetch） ----
  const rep = await ts.backfillPending(6, { fetchImpl: countingFetch });
  const usage = {
    llm_calls: LLM.calls, http_statuses: LLM.statuses,
    prompt_tokens: LLM.usages.reduce((n, u) => n + Number(u.prompt_tokens || 0), 0),
    completion_tokens: LLM.usages.reduce((n, u) => n + Number(u.completion_tokens || 0), 0),
    total_tokens: LLM.usages.reduce((n, u) => n + Number(u.total_tokens || 0), 0),
    batching: 'title+description 的 en/vn 合并在 1 次 chat/completions；hk 走 OpenCC（0 付费）',
  };
  put('real_backfill', { report: rep, engine: cfg.engine, usage });

  const raw0 = LLM.raws[0] || '';
  let parsed: Record<string, Record<string, string>> = {};
  try { parsed = JSON.parse(raw0) as Record<string, Record<string, string>>; } catch { /* 保留空 */ }
  const engTitle = parsed.title || {};
  const ratioOf = (srcS: string, out: string): number => (Array.from(srcS).length ? Number((Array.from(out).length / Array.from(srcS).length).toFixed(3)) : 0);
  const gateEn = ts.validateFieldSet({ title: srcTitle, description: srcDesc }, 'en', raw0);
  const gateVn = ts.validateFieldSet({ title: srcTitle, description: srcDesc }, 'vn', raw0);
  put('engine_output', {
    raw_head: raw0.slice(0, 400),
    en_title: engTitle.en || null, vn_title: engTitle.vn || null, hk_title_expected: ts.toTraditional(srcTitle),
    ratios: { en_title: ratioOf(srcTitle, engTitle.en || ''), vn_title: ratioOf(srcTitle, engTitle.vn || '') },
    gate_spec: { length_ratio_min: 0.3, length_ratio_max: 3.0, en_non_ascii_max: 0.3, ref: 'route-layer.spec §10 / translate-service.ts:208-211' },
    gate_verdict: { en: gateEn.errors, vn: gateVn.errors },
  });
  const enOut = String(engTitle.en || parsed.description?.en || '');
  const vnOut = String(engTitle.vn || parsed.description?.vn || '');
  check('P3.1', rep.scanned === 6 && rep.engine === 'deepseek', 'scanned=6/engine=deepseek', JSON.stringify({ s: rep.scanned, e: rep.engine }));
  check('P3.2', LLM.calls >= 1 && LLM.calls <= 2, '真调用次数 ∈[1,2]（429/5xx 才重试一次）', LLM.calls);
  check('P3.3', enOut.length > 0 && !ts.hasCJK(enOut), '引擎 en 产出 = 真英文（非 CJK）', enOut);
  check('P3.4', ts.hasVietnameseDiacritics(vnOut), '引擎 vn 产出 = 含越南语声调字符', vnOut);
  check('P3.5', Object.keys(parsed).sort().join(',') === 'description,title'
    && Object.values(parsed).every((v) => v && typeof v === 'object' && !Array.isArray(v)),
    '引擎 JSON 结构：顶层键集 == 输入字段集且每值非空对象', `${Object.keys(parsed).join(',')}`);

  // ---- DB 落库现状 ----
  const rows = await q<{ field: string; lang: string; text: string | null; status: string; attempts: number; last_error: string | null }>(
    `select field, lang, text, status, attempts, left(coalesce(last_error,''),40) as last_error
       from public.content_translation where entity_type='job' and entity_id=$1 order by field, lang`, [TARGET_JOB]);
  const get = (f: string, l: string): string => String((rows.find((r) => r.field === f && r.lang === l) || {}).text || '');
  put('ct_rows_job', rows.map((r) => ({ field: r.field, lang: r.lang, status: r.status, attempts: r.attempts, last_error: r.last_error, text_head: r.text ? r.text.slice(0, 50) : null })));
  const hkReady = rows.filter((r) => r.lang === 'hk' && r.status === 'ready').length;
  const enVnFailed = rows.filter((r) => r.lang !== 'hk' && r.status === 'failed');
  check('P3.6', hkReady === 2, 'hk 两字段落库 ready（OpenCC 确定性）', hkReady);
  check('P3.7', get('title', 'hk') === ts.toTraditional(srcTitle), 'title.hk 落库 = 繁体', get('title', 'hk'));
  check('P3.8', ts.toTraditional('招聘服务员') === '招聘服務員', 'OpenCC 例：「招聘服务员」⇒「招聘服務員」', ts.toTraditional('招聘服务员'));
  put('gate_rejections', {
    count: enVnFailed.length,
    reasons: Array.from(new Set(enVnFailed.map((r) => r.last_error))),
    detail: 'zh→en/vn 短文本的自然长度比（实测 3.7–5.2）> spec 上限 3.0 ⇒ 三重校验 ② 判负 ⇒ 行落 failed（译文不落库）',
  });

  // ---- P4 读回：i18n_status 提升 + 繁体真实 ----
  const jobAfter = findJob((await httpGet('/api/task/all?limit=100')).json);
  put('job_read_after', jobAfter ? { tID: jobAfter.tID, i18n_status: jobAfter.i18n_status, title_en: jobAfter.title_en, title_hk: jobAfter.title_hk, title_vn: jobAfter.title_vn } : null);
  check('P4.1', ['ready', 'partial'].indexOf(String(jobAfter?.i18n_status)) >= 0, 'i18n_status pending → ready/partial', jobAfter?.i18n_status);
  check('P4.2', String(jobAfter?.title_hk) === ts.toTraditional(srcTitle), 'title_hk 读回 = 真繁体', jobAfter?.title_hk);
  const enIsReal = !ts.hasCJK(String(jobAfter?.title_en || '')) && String(jobAfter?.title_en || '').length > 0;
  put('readback_en_status', {
    title_en: jobAfter?.title_en, is_real_english: enIsReal,
    note: enIsReal ? 'en 行被闸接受（真英文落库并读回）' : 'en 行被长度比闸判负 ⇒ mapper 正确回落源文；引擎 en 产出见 engine_output',
  });

  // ---- P5 HTTP 路由面 `mode=translate` 真跑 ----
  const cacheBeforeHttp = await cacheRows();
  const httpRep = await httpPost('/api/translate/backfill', { mode: 'translate', limit: 6 });
  const dRep = (httpRep.json.data || {}) as Record<string, unknown>;
  const cacheAfterHttp = await cacheRows();
  put('http_route_translate', { status: httpRep.status, data: dRep, cache_rows: [cacheBeforeHttp, cacheAfterHttp], llm_calls_inprocess_total: LLM.calls });
  check('P5.1', httpRep.status === 200 && String(dRep.engine) === 'deepseek' && String(dRep.mode) === 'translate', 'HTTP mode=translate 200/engine=deepseek', JSON.stringify({ s: httpRep.status, e: dRep.engine, m: dRep.mode }));
  check('P5.2', Number(dRep.scanned) === 6, 'HTTP 路由面扫到 6 条 pending', dRep.scanned);
  check('P5.3', cacheAfterHttp >= cacheBeforeHttp, '缓存不缩水（hk opencc 命中不复写）', `${cacheBeforeHttp} -> ${cacheAfterHttp}`);
  const hkReadyAfterHttp = Number(await scalar(
    `select count(*)::text as v from public.content_translation where entity_type='job' and entity_id=$1 and lang='hk' and status='ready'`, [TARGET_JOB]));
  check('P5.4', hkReadyAfterHttp === 2, 'HTTP 后 hk 仍 ready（不被降级）', hkReadyAfterHttp);

  // ---- P6 账本不变 + 残余登记 ----
  const after = {
    sigma_cid1: await sigma(), ledger_entry_n: await ledgerEntryN(), ct_rows: await ctRows(), cache_rows: await cacheRows(),
    job_rows: await rowCount('job'), listing_rows: await rowCount('listing'),
  };
  put('after', after);
  check('P6.1', after.sigma_cid1 === '1989693' && after.sigma_cid1 === before.sigma_cid1, 'Σ(account.balance, cid=1)=1989693 不变', `${before.sigma_cid1} -> ${after.sigma_cid1}`);
  check('P6.2', after.ledger_entry_n === before.ledger_entry_n, 'Δledger_entry=0', `${before.ledger_entry_n} -> ${after.ledger_entry_n}`);
  check('P6.3', after.job_rows === before.job_rows && after.listing_rows === before.listing_rows, '零新建 job/listing 行（无 DL79 残余）', JSON.stringify({ j: [before.job_rows, after.job_rows], l: [before.listing_rows, after.listing_rows] }));

  const failed = CHECKS.filter((c) => !c.pass);
  const blockers: unknown[] = [];
  const errs = new Set(rows.map((r) => r.last_error || '').filter((x) => x));
  if (errs.has('KEY_SET_MISMATCH')) blockers.push({
    id: 'DEF-TR1C-B-01 · 部分缓存命中 ⇒ 误判 KEY_SET_MISMATCH',
    statement: "translateFields 逐目标语言用**字段子集**校验（`targetSubset = {f: misses[f].includes(t)}`，translate-service.ts:657-663），而引擎（按提示词）返回**全部请求字段** ⇒ 当某字段只缺 vn、另一字段缺 en+vn 时，en 侧顶层键集 {description} ≠ 响应 {title,description} ⇒ 误判 KEY_SET_MISMATCH、该语言整批落 failed。修法（一行）：以**完整 subset** 调 validateFieldSet、只取需要该语言的字段值。",
    evidence: 'ct_rows_job(description:en=KEY_SET_MISMATCH) / engine_output.raw_head',
  });
  if (errs.has('LENGTH_RATIO')) blockers.push({
    id: 'DEF-TR1C-B-02 · spec 长度比闸 [0.3,3.0] 对 zh→en/vn 短文本系统性判负',
    statement: "spec 三重校验 ②「长度比 ∈[0.3,3.0]」（route-layer.spec §10:2142；translate-service.ts:208-209）以**码点比**度量；zh→en/vn 自然长度比实测 3.7–5.2（中文单字信息密度高）⇒ 合法译文被判负、en/vn 行落 failed。**未擅自改闸**（spec 已列值）——登记待裁（候选：上限 3.0→5.0/6.0，或 en/vn 分语言阈值）。",
    evidence: 'engine_output.ratios / gate_rejections',
  });
  if (!rows.some((r) => r.lang === 'vn' && r.status === 'ready')) blockers.push({
    id: 'REQ-2-vn · vn 行未能 ready',
    statement: 'vn 行全部被 DEF-TR1C-B-02 的长度比闸判负 ⇒ 本 run 结束 `vn` 无 ready 行（引擎 vn 产出本身正确、含声调，见 engine_output.vn_title）。',
    evidence: 'engine_output.vn_title / ct_rows_job',
  });
  if (!enIsReal) blockers.push({
    id: 'REQ-3 · title_en 非真英文',
    statement: '`title_en` 为源文回落（en 行未 ready）。',
    evidence: 'readback_en_status',
  });
  REPORT.checks = CHECKS;
  REPORT.blockers = blockers;
  const summary = {
    total: CHECKS.length, passed: CHECKS.length - failed.length, failed: failed.length,
    scan_scanned: Number(d1.scan_scanned), scan_registered_first: Number(d1.scan_registered), scan_registered_second: Number(d2.scan_registered),
    items_ready_this_run: rep.ready, llm_calls: LLM.calls, total_tokens: usage.total_tokens,
    hk_ready_rows: hkReady, env_failed_rows: enVnFailed.length, blockers: blockers.length,
  };
  REPORT.summary = summary;
  REPORT.residual = {
    content_translation_rows_kept: after.ct_rows, job_listing_rows_created: 0,
    deleted: { translation_cache_stub_rows: stubBefore - stubAfter, content_translation_rows: 0 },
  };
  put('summary', summary);
  put('residual', REPORT.residual);

  fs.writeFileSync(path.join(OUT_DIR, 'e2e.json'), JSON.stringify(REPORT, null, 1) + '\n', 'utf8');
  console.log(`SUMMARY total=${summary.total} passed=${summary.passed} failed=${summary.failed} llm_calls=${summary.llm_calls} tokens=${summary.total_tokens} hk_ready=${hkReady} en_vn_failed=${enVnFailed.length} blockers=${blockers.length} artifact=${path.join(OUT_DIR, 'e2e.json')}`);
  await pool.end();
  if (failed.length) process.exit(1);
};

main().catch(async (e) => {
  console.error('REAL_E2E_CRASHED', (e as Error)?.message);
  try { fs.writeFileSync(path.join(OUT_DIR, 'e2e.json'), JSON.stringify({ ...REPORT, crashed: String((e as Error)?.message), checks: CHECKS }, null, 1) + '\n', 'utf8'); } catch { /* ignore */ }
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(2);
});
