/**
 * P6-TR-1c-A · 写路径 waitUntil 端到端（**只走账本中性写路径**：商品上架 / 用户 bio）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-01-e2e-stub.ts [stub|hang]
 *   · stub（默认）：TRANSLATE_ENGINE=stub，验证「写入后若干秒 content_translation 变 ready、
 *      hk 行为繁体、API 读回 stub 形态、重复 backfill 不重复付费（缓存命中）」
 *   · hang：引擎指向**本脚本内的挂起 TCP 服务器**（永不响应）⇒ 证明**写请求不等待翻译**
 *      （15s 挂起 vs 写响应 <3s）、pending 行先行、失败不写脏数据。
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p4-artifacts/p6tr1c-<RUN>-<MODE>/e2e.json
 *
 * 硬口径：**不调用任何资金端点**（不上架招工/不买不卖）；job/listing 测试行因 DL79 触发器
 *   禁 DELETE ⇒ 登记 residual；content_translation / translation_cache 测试行**测后清干净**；
 *   用户 bio 测后**原值还原**。**不读取/打印 .env.local 或任何密钥值**（只判存在）。
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as crypto from 'crypto';
import { AddressInfo } from 'net';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const MODE: 'stub' | 'hang' = process.argv[2] === 'hang' ? 'hang' : 'stub';
/** 哨兵「key」（**不是真 key**，仅用于让深链走到 hang 服务器；绝不落产物/日志）。 */
const SENTINEL_KEY = 'tr1c-e2e-sentinel-not-a-real-key';

// ★ 先钉死运行环境，再用**运行期 require** 取 app（避免 TS import 提升抢先读到 env）
process.env.VERCEL = '1'; // 阻止 src/index.ts 的 auto-listen；本脚本自管瞬时 http server
process.env.TRANSLATE_ENGINE = MODE === 'stub' ? 'stub' : 'deepseek';
if (MODE === 'stub') delete process.env.DEEPSEEK_API_KEY;

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

import { toTraditional, sha256Hex } from '../src/translate-service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = (require('../src/index') as { default: import('express').Express }).default;

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1c-${RUN}-${MODE}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_DIRECT = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
const URL_ANY = URL_DIRECT || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!URL_ANY) { console.error('NO_URL: 无法解析任何数据库连接串'); process.exit(2); }
const SECRET = String(process.env.SECRET_KEY || '');
if (!SECRET) { console.error('NO_SECRET_KEY: 无法构造 token'); process.exit(2); }

const pool = new Pool({ connectionString: URL_ANY, max: 4 });
const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> =>
  (await pool.query(sql, params as never[])).rows as R[];
const countOf = async (table: string): Promise<string> => {
  try { return String((await q(`select count(*)::text as n from ${table}`))[0].n); }
  catch (e) { return `ERR:${String((e as Error).message).slice(0, 60)}`; }
};
const sigmaCid1 = async (): Promise<string> => {
  try { return String((await q(`select coalesce(sum(balance+frozen),0)::text as s from public.account where cid = 1`))[0].s); }
  catch (e) { return `NOT_MEASURED:${String((e as Error).message).slice(0, 60)}`; }
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const checks: Array<Record<string, unknown>> = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown, note?: string) => {
  checks.push({ id, pass: Boolean(pass), expect: String(expect), actual: String(actual), note });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} | expect=${String(expect)} | actual=${String(actual)}${note ? ' | ' + note : ''}`);
};

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xtr1c${String(uid).padStart(4, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', SECRET).update(unsigned).digest('base64url')}`;
};

type Call = { status: number; json: any; text: string };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown; hdr?: Record<string, string> } = {}): Promise<Call> => {
  const headers: Record<string, string> = { ...(opts.hdr || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:${PORT}${p}`, {
    method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
};

let PORT = 0;

const main = async () => {
  // ---------- 挂起服务器（hang 模式）：接受连接、永不响应 ----------
  let hangServer: net.Server | null = null;
  if (MODE === 'hang') {
    hangServer = net.createServer((sock) => { sock.on('error', () => { /* keep open */ }); });
    await new Promise<void>((r) => hangServer!.listen(0, '127.0.0.1', () => r()));
    const hp = (hangServer.address() as AddressInfo).port;
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${hp}`;
    process.env.DEEPSEEK_API_KEY = SENTINEL_KEY; // 让深链真正发出请求（挂起 15s）
    process.env.TRANSLATE_ENGINE = 'deepseek';
  }

  // ---------- 瞬时 http server（进程内真实路由）----------
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  PORT = (server.address() as AddressInfo).port;

  // ---------- 锚点夹具（只读）----------
  const uidRow = await q<{ uid: string; bio: string | null }>('select uid::text as uid, bio from public.users where uid > 0 order by uid limit 1');
  const cidRow = await q<{ cid: string }>(`select cid::text as cid from public.currency where status = 'listed' order by cid limit 1`);
  if (!uidRow[0] || !cidRow[0]) throw new Error('缺少 users(>0)/listed currency 锚点行，无法构建测试内容');
  const uid = uidRow[0].uid;
  const originalBio = uidRow[0].bio;
  const cid = cidRow[0].cid;
  const token = jwt(uid);
  t('fixture.token_ok', (await call('GET', '/api/user', { token })).status === 200, 200, (await call('GET', '/api/user', { token })).status);

  const tag = `tr1c${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
  const listTitle = `海鲜礼盒TR1C测试：虾蟹双拼-${tag}`;
  const listDesc = `冷链发货，含虾蟹各两斤，顺丰包邮-${tag}`;
  const bio = `TR1C 写路径翻译联测自我介绍：专注海产生鲜零售-${tag}`;
  const hashes = { title: sha256Hex(listTitle), desc: sha256Hex(listDesc), bio: sha256Hex(bio) };

  const before = {
    ledger_entry: await countOf('public.ledger_entry'),
    ledger_tx: await countOf('public.ledger_tx'),
    content_translation: await countOf('public.content_translation'),
    translation_cache: await countOf('public.translation_cache'),
    sigma_cid1: await sigmaCid1(),
    at: new Date().toISOString(),
  };

  // ---------- ① 商品上架（账本中性；度量响应时延）----------
  const t0 = Date.now();
  const listRes = await call('POST', '/api/listing', {
    token,
    body: { cid: Number(cid), price: 120, stock: 3, title: listTitle, description: listDesc, create_key: `cli:tr1c:${tag}:listing` },
  });
  const listElapsed = Date.now() - t0;
  const listingId = String(listRes.json?.data?.listing_id ?? '');
  t('write.listing_200', listRes.status === 200, 200, listRes.status, `elapsed_ms=${listElapsed}`);
  t('write.listing_has_id', !!listingId, 'listing_id', listingId);
  t('write.listing_fast', listElapsed < (MODE === 'hang' ? 3000 : 2500), `<${MODE === 'hang' ? 3000 : 2500}ms`, `${listElapsed}ms`, '响应不得被翻译拖慢');

  // ---------- ① 用户 bio（账本中性；度量响应时延）----------
  const t1 = Date.now();
  const profRes = await call('POST', '/api/user/profile', { token, body: { bio } });
  const profElapsed = Date.now() - t1;
  t('write.profile_200', profRes.status === 200, 200, profRes.status, `elapsed_ms=${profElapsed}`);
  t('write.profile_fast', profElapsed < (MODE === 'hang' ? 3000 : 2500), `<${MODE === 'hang' ? 3000 : 2500}ms`, `${profElapsed}ms`);

  // ---------- ② 写路径前台：pending 行「立即」存在（读侧有据可依）----------
  const pendRows = await q<{ entity_type: string; field: string; lang: string; status: string; text: string | null }>(
    `select entity_type, field, lang, status, text from public.content_translation
      where (entity_type='listing' and entity_id=$1) or (entity_type='user' and entity_id=$2)
      order by entity_type, field, lang`, [listingId, uid]);
  t('pending.registered_rows', pendRows.length === 9, 9, pendRows.length, 'listing(title+description)×3 + user(bio)×3');
  t('pending.listing_6', pendRows.filter((r) => r.entity_type === 'listing').length === 6, 6, pendRows.filter((r) => r.entity_type === 'listing').length);
  t('pending.user_3', pendRows.filter((r) => r.entity_type === 'user').length === 3, 3, pendRows.filter((r) => r.entity_type === 'user').length);
  t('pending.no_text', pendRows.every((r) => r.text === null), 'all text NULL', pendRows.map((r) => r.text).join('|'));

  let settled: Array<{ field: string; lang: string; status: string; text: string | null; last_error: string | null }> = [];
  if (MODE === 'stub') {
    // ---------- ③ 后台完成：ready + hk 繁体 + API 读回 ----------
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      settled = await q(
        `select field, lang, status, text, last_error from public.content_translation
          where entity_type='listing' and entity_id=$1 order by field, lang`, [listingId]);
      if (settled.length === 6 && settled.every((r) => r.status === 'ready')) break;
      await sleep(500);
    }
    t('bg.listing_ready', settled.length === 6 && settled.every((r) => r.status === 'ready'), '6 rows ready', settled.map((r) => `${r.field}:${r.lang}=${r.status}`).join(' '));
    const tEn = settled.find((r) => r.field === 'title' && r.lang === 'en');
    const tHk = settled.find((r) => r.field === 'title' && r.lang === 'hk');
    const dVn = settled.find((r) => r.field === 'description' && r.lang === 'vn');
    t('bg.title_en_stub', tEn?.text === `[en] ${listTitle}`, `[en] ${listTitle}`, tEn?.text);
    t('bg.title_hk_trad', tHk?.text === toTraditional(listTitle), toTraditional(listTitle), tHk?.text);
    t('bg.desc_vn_stub', dVn?.text === `[vn] ${listDesc}`, `[vn] ${listDesc}`, dVn?.text);

    // user bio 后台完成
    let userRows: Array<{ field: string; lang: string; status: string; text: string | null }> = [];
    const deadline2 = Date.now() + 15000;
    while (Date.now() < deadline2) {
      userRows = await q(`select field, lang, status, text from public.content_translation where entity_type='user' and entity_id=$1 order by lang`, [uid]);
      if (userRows.length === 3 && userRows.every((r) => r.status === 'ready')) break;
      await sleep(400);
    }
    t('bg.user_bio_ready', userRows.length === 3 && userRows.every((r) => r.status === 'ready'), '3 rows ready', userRows.map((r) => `${r.lang}=${r.status}`).join(' '));

    // API 读回（listing 读侧 = GET /api/prize/:listingId；无 GET /api/listing/:id）
    const prize = (await call('GET', `/api/prize/${listingId}`)).json?.data ?? {};
    t('api.name_en_stub', prize.name_en === `[en] ${listTitle}`, `[en] ${listTitle}`, prize.name_en);
    t('api.name_hk_trad', prize.name_hk === toTraditional(listTitle), toTraditional(listTitle), prize.name_hk);
    t('api.description_vn_stub', prize.description_vn === `[vn] ${listDesc}`, `[vn] ${listDesc}`, prize.description_vn);
    t('api.i18n_ready', prize.i18n_status === 'ready', 'ready', prize.i18n_status);

    // ---------- ④ 重复 backfill ⇒ 缓存命中、不重复付费 ----------
    const foreignPending = await q<{ n: string }>(
      `select count(*)::text as n from public.content_translation
        where status in ('pending','failed') and attempts < 5
          and not (entity_type='listing' and entity_id=$1)
          and not (entity_type='user' and entity_id=$2)`, [listingId, uid]);
    const foreign = Number(foreignPending[0].n);
    if (foreign > 0) {
      // 安全护栏：全局 backfill 会在 stub 模式下把**他人**待译行写成假译文 ⇒ 绝不在该状态下调全局端点
      t('backfill.guard_foreign_pending', true, 'skip global backfill', foreign, '存在他人待译行 ⇒ 跳过全局 backfill（避免 stub 假译文污染），改证缓存命中幂等');
      const cacheBefore = await countOf('public.translation_cache');
      const { backfillPending } = require('../src/translate-service') as typeof import('../src/translate-service');
      const rep = await backfillPending(20, { resolveSource: async (row: { entity_type: string; entity_id: string }) => (row.entity_id === listingId || row.entity_id === uid ? 'x' : null) });
      const cacheAfter = await countOf('public.translation_cache');
      t('backfill.no_new_cache', cacheBefore === cacheAfter, cacheBefore, cacheAfter, `scoped backfill scanned=${rep.scanned}`);
    } else {
      process.env.CRON_SECRET = `tr1c-${tag}`;
      const cacheBefore = await countOf('public.translation_cache');
      const b1 = await call('POST', '/api/translate/backfill', { hdr: { 'x-cron-secret': `tr1c-${tag}` }, body: { limit: 20 } });
      const cacheMid = await countOf('public.translation_cache');
      const b2 = await call('POST', '/api/translate/backfill', { hdr: { 'x-cron-secret': `tr1c-${tag}` }, body: { limit: 20 } });
      const cacheAfter = await countOf('public.translation_cache');
      t('backfill.http_200', b1.status === 200 && b2.status === 200, '200/200', `${b1.status}/${b2.status}`);
      t('backfill.no_new_cache', cacheMid === cacheAfter && cacheBefore === cacheMid, `${cacheBefore}=${cacheMid}=${cacheAfter}`, `${cacheBefore}=${cacheMid}=${cacheAfter}`, '重复 backfill 缓存命中 ⇒ 不重复付费');
      delete process.env.CRON_SECRET;
    }
  } else {
    // ---------- hang 模式：pending 先行 + 写响应不等翻译 + 失败不写脏数据 ----------
    t('hang.pending_now', pendRows.every((r) => r.status === 'pending'), 'all pending (写响应已回，翻译尚未开始)', pendRows.map((r) => `${r.entity_type}:${r.field}:${r.lang}=${r.status}`).join(' '));
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      settled = await q(
        `select field, lang, status, text, last_error from public.content_translation
          where entity_type='listing' and entity_id=$1 order by field, lang`, [listingId]);
      if (settled.length === 6 && settled.every((r) => r.status !== 'pending')) break;
      await sleep(1000);
    }
    // hk = OpenCC 确定性转换（不走 LLM/不付费）⇒ 即使引擎挂起/失败也照常 ready；en/vn 才走 LLM。
    const enVn = settled.filter((r) => r.lang === 'en' || r.lang === 'vn');
    const hk = settled.filter((r) => r.lang === 'hk');
    t('hang.en_vn_failed_timeout', enVn.length === 4 && enVn.every((r) => r.status === 'failed' && /TIMEOUT/.test(r.last_error || '')), '4 rows(en/vn) failed/TIMEOUT', enVn.map((r) => `${r.field}:${r.lang}=${r.status}/${r.last_error}`).join(' '));
    t('hang.en_vn_no_dirty_text', enVn.every((r) => r.text === null), 'en/vn text NULL(不写脏数据)', enVn.map((r) => r.text).join('|'));
    t('hang.hk_ready_trad', hk.length === 2 && hk.every((r) => r.status === 'ready'), '2 rows(hk) ready(OpenCC 免费/确定性)', hk.map((r) => `${r.field}:${r.lang}=${r.status}`).join(' '));
    t('hang.hk_trad_text', hk.every((r) => r.text === toTraditional(r.field === 'title' ? listTitle : listDesc)), 'hk 繁体文本', hk.map((r) => `${r.field}=${r.text}`).join(' '));
  }

  // ---------- ⑤ 账本不变 ----------
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
  t('ledger.sigma_cid1_unchanged', before.sigma_cid1 === after.sigma_cid1, before.sigma_cid1, after.sigma_cid1);

  // ---------- 清理：译文面删干净 + bio 还原；listing 行 residual ----------
  const cleanup = { content_translation_deleted: -1, translation_cache_deleted: -1, bio_restored: false };
  {
    const d1 = await q<{ n: string }>(
      `with d as (delete from public.content_translation
        where (entity_type='listing' and entity_id=$1) or (entity_type='user' and entity_id=$2) returning 1)
       select count(*)::text as n from d`, [listingId, uid]);
    cleanup.content_translation_deleted = Number(d1[0].n);
    const d2 = await q<{ n: string }>(
      `with d as (delete from public.translation_cache where src_hash = any($1::text[]) returning 1)
       select count(*)::text as n from d`, [[hashes.title, hashes.desc, hashes.bio]]);
    cleanup.translation_cache_deleted = Number(d2[0].n);
    await q(`update public.users set bio = $1 where uid = $2`, [originalBio, uid]);
    const chk = await q<{ bio: string | null }>(`select bio from public.users where uid = $1`, [uid]);
    cleanup.bio_restored = (chk[0]?.bio ?? null) === (originalBio ?? null);
  }
  t('cleanup.bio_restored', cleanup.bio_restored, String(originalBio ?? ''), String((await q<{ bio: string | null }>(`select bio from public.users where uid=$1`, [uid]))[0]?.bio ?? ''));
  t('cleanup.translation_rows_cleared', cleanup.content_translation_deleted >= 9, '>=9', cleanup.content_translation_deleted);

  server.close();
  if (hangServer) hangServer.close();

  const summary = {
    unit: 'P6-TR-1c-A', mode: MODE, run: RUN, at: new Date().toISOString(),
    anchors: { uid, cid, listing_id: listingId },
    seed_texts: { listTitle, listDesc, bio },
    timing_ms: { listing: listElapsed, profile: profElapsed },
    before, after, cleanup,
    residual: {
      listing_ids: [listingId], note: 'listing 测试行因 DL79 触发器禁 DELETE ⇒ residual；content_translation/translation_cache 测试行已清；bio 已还原',
    },
    passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass).length,
    checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'e2e.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nARTIFACT=${path.join(OUT_DIR, 'e2e.json')}`);
  console.log(`SUMMARY mode=${MODE} passed=${summary.passed} failed=${summary.failed} listing=${listingId} uid=${uid}`);
  if (summary.failed > 0) process.exitCode = 1;
};

main()
  .catch((e) => { console.error('E2E_FATAL:', (e as Error)?.message ?? e); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => undefined); });
