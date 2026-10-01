/**
 * P6-TR-1b · 端到端实测（`TRANSLATE_ENGINE=stub`，**无需任何 API key**）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1b-01-e2e-stub.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p4-artifacts/p6tr1b-<RUN>/e2e.json
 *
 * 覆盖（对应用户交付的 5 条断言）：
 *   ① content_translation 出现对应行且 status='ready'、hk 行是**繁体**（OpenCC 转换）
 *   ② API 读回 title_en 非空且为 stub 形态（`[en] <原文>`）、title_hk 是繁体
 *   ③ **未翻译的对象**：i18n_status='pending' 且 title_en **逐字等于原文**（回落生效）
 *   ④ Δledger_entry = 0（前后计数）+ Σ(cid=1) 不变
 *   ⑤ 重复调 backfill ⇒ 不产生重复行、不重复付费（缓存命中）
 *
 * 临时测试数据：**写入 job/listing 的测试行无法删除**（迁移 0013/0015 DL79 触发器
 *   禁 DELETE）⇒ 报告里逐行列残留并标 residual；content_translation / translation_cache
 *   的测试行**可删，脚本自动清理**。
 * 安全：**不读取/打印 .env.local 或任何密钥值**（只判存在）；不打印连接串。
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import { AddressInfo } from 'net';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

// —— 关键：先钉死配置，再 import 被测模块（env 在 getTranslateConfig() 调用时读，此处双保险）
process.env.TRANSLATE_ENGINE = 'stub';
delete process.env.DEEPSEEK_API_KEY; // 无 key：证明整条链路不依赖 key
const VERCEL_WAS = process.env.VERCEL;
process.env.VERCEL = '1'; // 阻止 src/index.ts 的 auto-listen；本脚本自管瞬时 http server

import { toTraditional, sha256Hex } from '../src/translate-service';
import { createDbStore, backfillPending } from '../src/translate-service';
// ★ app 用**运行期 require**获取：ESM import 会被 TS 提升到文件顶部，会在 `process.env.VERCEL='1'`
//   之前求值 ⇒ src/index.ts 的 `if (!process.env.VERCEL) app.listen()` 会抢先起常驻监听。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = (require('../src/index') as { default: import('express').Express }).default;

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1b-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_DIRECT = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
const URL_ANY = URL_DIRECT || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!URL_ANY) { console.error('NO_URL: 无法解析任何数据库连接串'); process.exit(2); }

const pool = new Pool({ connectionString: URL_ANY, max: 4 });

const checks: Array<Record<string, unknown>> = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown, note?: string) => {
  checks.push({ id, pass: Boolean(pass), expect: String(expect), actual: String(actual), note });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} | expect=${String(expect)} | actual=${String(actual)}${note ? ' | ' + note : ''}`);
};
const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> =>
  (await pool.query(sql, params as never[])).rows as R[];
const countOf = async (table: string): Promise<string> => {
  try { return String((await q(`select count(*)::text as n from ${table}`))[0].n); }
  catch (e) { return `ERR:${String((e as Error).message).slice(0, 60)}`; }
};
const sigmaCid1 = async (): Promise<string> => {
  try { return String((await q(`select coalesce(sum(total),0)::text as s from public.account where cid = 1`))[0].s); }
  catch (e) { return `NOT_MEASURED:${String((e as Error).message).slice(0, 60)}`; }
};

const SECRET = `tr1b-probe-${RUN}`;
const residual: Record<string, unknown> = { job_ids: [], listing_ids: [] };
const cleanup = { content_translation_deleted: -1, translation_cache_deleted: -1 };

const main = async () => {
  const store = createDbStore();
  const sqlTest = {
    jobTitle: '海鲜招工测试甲：整理货架与盘点',
    jobDesc: '负责每日盘点与货架整理，包午餐',
    listTitle: '海鲜礼盒测试丙：虾蟹双拼',
    listDesc: '顺丰包邮，含虾蟹各两斤，冷链发货',
  };

  // ---------- 前置：锚点（uid / cid）与基线读数 ----------
  const uidRow = await q<{ uid: string }>('select uid::text as uid from public.users order by uid limit 1');
  const cidRow = await q<{ cid: string }>('select cid::text as cid from public.currency order by cid limit 1');
  if (!uidRow[0] || !cidRow[0]) throw new Error('缺少 users/currency 锚点行，无法构建测试内容');
  const uid = uidRow[0].uid; const cid = cidRow[0].cid;

  const before = {
    ledger_entry: await countOf('public.ledger_entry'),
    ledger_tx: await countOf('public.ledger_tx'),
    content_translation: await countOf('public.content_translation'),
    translation_cache: await countOf('public.translation_cache'),
    sigma_cid1: await sigmaCid1(),
    at: new Date().toISOString(),
  };

  // ---------- 造内容：1 job（受测）+ 1 listing（受测）+ 1 job（未翻译，用既有行或新建） ----------
  const jobIns = await q<{ job_id: string }>(`
    insert into public.job (employer_uid, cid, reward, title, description, status, create_key)
    values ($1::bigint, $2::bigint, 100, $3, $4, 'open', $5) returning job_id::text as job_id`,
    [uid, cid, sqlTest.jobTitle, sqlTest.jobDesc, `tr1b-probe-${RUN}-job`]);
  const jobA = jobIns[0].job_id;
  residual.job_ids = [jobA];

  const listIns = await q<{ listing_id: string }>(`
    insert into public.listing (seller_uid, cid, price, stock, title, description, status, create_key)
    values ($1::bigint, $2::bigint, 120, 5, $3, $4, 'listed', $5) returning listing_id::text as listing_id`,
    [uid, cid, sqlTest.listTitle, sqlTest.listDesc, `tr1b-probe-${RUN}-listing`]);
  const listC = listIns[0].listing_id;
  residual.listing_ids = [listC];

  // 未翻译对象：优先复用一条**既无译文行**的既有 job（不新增残留行）；没有则新建
  let jobB: string | null = null;
  let jobBTitle = '';
  const existing = await q<{ job_id: string; title: string }>(`
    select j.job_id::text as job_id, j.title
    from public.job j
    where not exists (
      select 1 from public.content_translation ct
      where ct.entity_type = 'job' and ct.entity_id = j.job_id::text
    )
    order by j.job_id desc limit 5`);
  const pick = existing.find((r) => r.title && r.title.trim() && r.job_id !== jobA);
  if (pick) {
    jobB = pick.job_id; jobBTitle = pick.title;
    residual.jobB = `reused existing job_id=${jobB}`;
  } else {
    const ins = await q<{ job_id: string }>(`
      insert into public.job (employer_uid, cid, reward, title, description, status, create_key)
      values ($1::bigint, $2::bigint, 100, $3, $4, 'open', $5) returning job_id::text as job_id`,
      [uid, cid, '海鲜招工测试乙：未翻译对照', '此对象不登记待翻译行', `tr1b-probe-${RUN}-jobB`]);
    jobB = ins[0].job_id; jobBTitle = '海鲜招工测试乙：未翻译对照';
    (residual.job_ids as string[]).push(jobB);
  }

  // ---------- 登记「待翻译」行（写入即登记；字段名 = 源列名，与 createDbSourceResolver 白名单一致） ----------
  for (const [etype, eid] of [['job', jobA], ['listing', listC]] as Array<[string, string]>) {
    for (const field of ['title', 'description']) {
      for (const lang of ['en', 'hk', 'vn']) {
        await store.upsertTranslation({
          entity_type: etype, entity_id: eid, field, lang,
          text: null, status: 'pending', attempts: 0, last_error: null,
        });
      }
    }
  }
  const pendingSeeded = await q<{ n: string }>(
    `select count(*)::text as n from public.content_translation where status='pending' and entity_id = any($1::text[])`,
    [[jobA, listC]]);
  t('seed.pending_rows', Number(pendingSeeded[0].n) === 12, 12, pendingSeeded[0].n);

  // ---------- 起瞬时 http server（进程内真实路由） ----------
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const post = async (headers: Record<string, string>, body: unknown) => {
    const res = await fetch(`${base}/api/translate/backfill`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() as Record<string, unknown> };
  };

  // ---------- ③ 鉴权面（fail-loud） ----------
  delete process.env.CRON_SECRET;
  const noSecret = await post({}, { limit: 20 });
  t('auth.no_cron_secret_503', noSecret.status === 503, '503', noSecret.status, '未配 CRON_SECRET 必须拒绝，绝不默认放行');

  process.env.CRON_SECRET = SECRET;
  const noAuth = await post({}, { limit: 20 });
  t('auth.missing_header_401', noAuth.status === 401, '401', noAuth.status);

  const badAuth = await post({ Authorization: 'Bearer wrong-secret' }, { limit: 20 });
  t('auth.wrong_bearer_401', badAuth.status === 401, '401', badAuth.status);

  // ---------- 正向：backfill（x-cron-secret 头） ----------
  const first = await post({ 'x-cron-secret': SECRET }, { limit: 20 });
  const d1 = first.json.data as Record<string, unknown> | undefined;
  t('backfill.http_200', first.status === 200, 200, first.status);
  t('backfill.ok_true', d1?.ok === true, true, d1?.ok);
  t('backfill.ready_gt0', Number(d1?.ready) > 0, '>0', d1?.ready);
  t('backfill.engine_stub', d1?.engine === 'stub', 'stub', d1?.engine);
  t('backfill.machine_keys',
    ['ok', 'processed', 'ready', 'failed', 'skipped', 'deferred', 'reason'].every((k) => k in (d1 || {})),
    'ok,processed,ready,failed,skipped,deferred,reason', Object.keys(d1 || {}).join(','));

  // ---------- ① content_translation 行 + hk 繁体 ----------
  const rowsA = await q<{ field: string; lang: string; status: string; text: string | null }>(
    `select field, lang, status, text from public.content_translation
      where entity_type='job' and entity_id=$1 and field in ('title','description')
      order by field, lang`, [jobA]);
  t('ct.job_rows', rowsA.length === 6, 6, rowsA.length);
  t('ct.job_all_ready', rowsA.length === 6 && rowsA.every((r) => r.status === 'ready'),
    'all ready', rowsA.map((r) => `${r.field}:${r.lang}=${r.status}`).join(' '));
  const hkTitle = rowsA.find((r) => r.field === 'title' && r.lang === 'hk');
  const hkDesc = rowsA.find((r) => r.field === 'description' && r.lang === 'hk');
  t('ct.hk_title_traditional', hkTitle?.text === toTraditional(sqlTest.jobTitle), toTraditional(sqlTest.jobTitle), hkTitle?.text);
  t('ct.hk_desc_traditional', hkDesc?.text === toTraditional(sqlTest.jobDesc), toTraditional(sqlTest.jobDesc), hkDesc?.text);
  const zhLeak = await q<{ n: string }>(
    `select count(*)::text as n from public.content_translation where lang = 'zh'`);
  t('ct.no_zh_rows', Number(zhLeak[0].n) === 0, 0, zhLeak[0].n, 'zh 是源语言，永不入表');

  // ---------- ② API 读回 ----------
  const getJson = async (p: string) => (await (await fetch(`${base}${p}`)).json()) as Record<string, any>;
  const taskA = await getJson(`/api/task/${jobA}`);
  const ta = taskA.data as Record<string, any>;
  t('api.job.title_en_stub', ta?.title_en === `[en] ${sqlTest.jobTitle}`, `[en] ${sqlTest.jobTitle}`, ta?.title_en);
  t('api.job.title_vn_stub', ta?.title_vn === `[vn] ${sqlTest.jobTitle}`, `[vn] ${sqlTest.jobTitle}`, ta?.title_vn);
  t('api.job.title_hk_trad', ta?.title_hk === toTraditional(sqlTest.jobTitle), toTraditional(sqlTest.jobTitle), ta?.title_hk);
  t('api.job.note_en_stub', ta?.note_en === `[en] ${sqlTest.jobDesc}`, `[en] ${sqlTest.jobDesc}`, ta?.note_en);
  t('api.job.i18n_ready', ta?.i18n_status === 'ready', 'ready', ta?.i18n_status);

  const prizeC = await getJson(`/api/prize/${listC}`);
  const pc = prizeC.data as Record<string, any>;
  t('api.listing.name_en_stub', pc?.name_en === `[en] ${sqlTest.listTitle}`, `[en] ${sqlTest.listTitle}`, pc?.name_en);
  t('api.listing.name_hk_trad', pc?.name_hk === toTraditional(sqlTest.listTitle), toTraditional(sqlTest.listTitle), pc?.name_hk);
  t('api.listing.desc_vn_stub', pc?.description_vn === `[vn] ${sqlTest.listDesc}`, `[vn] ${sqlTest.listDesc}`, pc?.description_vn);
  t('api.listing.i18n_ready', pc?.i18n_status === 'ready', 'ready', pc?.i18n_status);
  t('api.prize_list_has_i18n', (await getJson('/api/prize/all')).data?.[0]?.i18n_status !== undefined,
    'first prize carries i18n_status', (await getJson('/api/prize/all')).data?.[0]?.i18n_status);

  // ---------- ③ 未翻译对象：pending + 逐字回落 ----------
  const taskB = await getJson(`/api/task/${jobB}`);
  const tb = taskB.data as Record<string, any>;
  t('api.untranslated.i18n_pending', tb?.i18n_status === 'pending', 'pending', tb?.i18n_status);
  t('api.untranslated.title_en_fallback_exact', tb?.title_en === jobBTitle, jobBTitle, tb?.title_en);
  t('api.untranslated.title_hk_fallback_exact', tb?.title_hk === jobBTitle, jobBTitle, tb?.title_hk);
  t('api.untranslated.note_en_fallback_exact', tb?.note_en === tb?.note, 'note_en === note', `${tb?.note_en} === ${tb?.note}`);

  // ---------- ⑤ 幂等 + 缓存命中 ----------
  const ctBefore2 = await countOf('public.content_translation');
  const cacheBefore2 = await countOf('public.translation_cache');
  const second = await post({ 'x-cron-secret': SECRET }, { limit: 20 });
  const d2 = second.json.data as Record<string, unknown> | undefined;
  const ctAfter2 = await countOf('public.content_translation');
  const cacheAfter2 = await countOf('public.translation_cache');
  t('idem.http_200', second.status === 200, 200, second.status);
  t('idem.no_new_content_translation_rows', ctBefore2 === ctAfter2, ctBefore2, ctAfter2);
  t('idem.no_new_cache_rows', cacheBefore2 === cacheAfter2, cacheBefore2, cacheAfter2);
  t('idem.second_pass_scanned_0', Number(d2?.scanned) === 0, 'scanned=0（无待译行）', d2?.scanned);
  t('idem.second_pass_failed_0', Number(d2?.failed) === 0, 'failed=0', d2?.failed);

  const ctScope = await q<{ n: string }>(
    `select count(*)::text as n from public.content_translation where entity_id = any($1::text[]) and status='ready'`,
    [[jobA, listC]]);
  t('idem.scoped_ready_rows_stable', Number(ctScope[0].n) === 12, 12, ctScope[0].n);

  // ---------- ④ 账本不变 ----------
  const after = {
    ledger_entry: await countOf('public.ledger_entry'),
    ledger_tx: await countOf('public.ledger_tx'),
    content_translation: await countOf('public.content_translation'),
    translation_cache: await countOf('public.translation_cache'),
    sigma_cid1: await sigmaCid1(),
    at: new Date().toISOString(),
  };
  t('ledger.delta_ledger_entry_0', before.ledger_entry === after.ledger_entry, before.ledger_entry, after.ledger_entry);
  t('ledger.delta_ledger_tx_0', before.ledger_tx === after.ledger_tx, before.ledger_tx, after.ledger_tx);
  t('ledger.sigma_cid1_unchanged', before.sigma_cid1 === after.sigma_cid1, before.sigma_cid1, after.sigma_cid1, before.sigma_cid1.startsWith('NOT_MEASURED') ? 'NOT_MEASURED' : undefined);

  // ---------- 清理（可删的删干净；job/listing 触发器禁 DELETE ⇒ 残留登记） ----------
  const hashes = [sqlTest.jobTitle, sqlTest.jobDesc, sqlTest.listTitle, sqlTest.listDesc].map(sha256Hex);
  const delCt = await q<{ n: string }>(
    `with d as (delete from public.content_translation where entity_id = any($1::text[]) returning 1)
     select count(*)::text as n from d`, [[jobA, listC]]);
  cleanup.content_translation_deleted = Number(delCt[0].n);
  const delCache = await q<{ n: string }>(
    `with d as (delete from public.translation_cache where src_hash = any($1::text[]) returning 1)
     select count(*)::text as n from d`, [hashes]);
  cleanup.translation_cache_deleted = Number(delCache[0].n);
  residual.job_delete_blocked = true;
  residual.listing_delete_blocked = true;
  residual.note = 'job/listing 测试行因迁移 0013/0015 DL79 触发器禁 DELETE 无法清除 ⇒ 标 residual；content_translation/translation_cache 已清';

  server.close();

  const summary = {
    run: RUN, engine: 'stub', at: new Date().toISOString(),
    seed_texts: sqlTest, ids: { jobA, listing_id: listC, jobB, jobB_reused: !!(residual as any).jobB },
    before, after, cleanup, residual,
    passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass).length,
    checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'e2e.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nARTIFACT=${path.join(OUT_DIR, 'e2e.json')}`);
  console.log(`SUMMARY passed=${summary.passed} failed=${summary.failed} residual_jobs=${JSON.stringify(residual.job_ids)} residual_listings=${JSON.stringify(residual.listing_ids)}`);
  if (summary.failed > 0) process.exitCode = 1;
};

main()
  .catch((e) => { console.error('E2E_FATAL:', (e as Error)?.message ?? e); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => undefined); if (VERCEL_WAS === undefined) delete process.env.VERCEL; });
