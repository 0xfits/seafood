/**
 * p59-00 · 详情读口缓存头「无条件 no-store」+ 浏览数每次 +1（CDN 缓存缺陷回归门）
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/item-detail/p59-00-detail-nocache-gate.ts
 * 读数：`ops/item-detail/readings/p59-detail-nocache-gate-<RUN>.json`
 *
 * ★ 缺陷背景（2026-10-20 生产实测）：
 *   `/api/prize/:bID` 非 cookie 分支原挂 `setPublicCache(res)`（`public, s-maxage=30,
 *   stale-while-revalidate=300`）⇒ **CDN 会缓存该 JSON**，命中缓存时请求不到 origin ⇒
 *   浏览数不增、且读数在「边缘缓存值」与「库内真值」之间跳动（生产实测 views 2→4→4）。
 *   而浏览计数的语义是「**每次打开 +1**」⇒ 缓存直接破坏语义。
 *   修法：本路由**无条件** `private, no-store`，删除 `detailViewer?.mintedCookie` 二分；
 *   其余读口（`/api/prize/all` / `/api/task/all` / `/api/home` 等）缓存语义**一字不改**。
 *
 * ★ 覆盖面：
 *   A · 静态面（零 DB）：本单零新路由（regs=110 → 111 由 0059 admin-edit 单前推）· 详情块 `setPrivateNoStore` 无条件在场、
 *       `setPublicCache` / `mintedCookie` 零命中 · 其余四个 `setPublicCache` 调用点原样、
 *       `/api/home` 仍双分支（private+public）且 `Vary: Authorization` 未被挪动 · 详情读口
 *       仍是「自增+读」专用口；
 *   B · **行为面（真 HTTP）**：`http.createServer(app)` 绑 127.0.0.1 临时端口（**不占 5793–5799、
 *       不占 5788**）⇒ 实测 `Cache-Control` **头字符串**：详情恒 `private, no-store`（不含
 *       `public` / `s-maxage`）· 带 Authorization 垃圾头同语义 · 3 次连续请求 views 逐次 +1 ·
 *       feed `/api/prize/all` 仍 `public … s-maxage` · `/api/task/all` 仍 public ·
 *       `/api/home` 匿名仍 public + `Vary: Authorization` 在场；
 *   E · 零残留：目标 listing 的 `view_count` **回写复原**并读回复核；`listing_view_log`
 *       本 run 的探针 viewer_key 命中 = 0；dev 库身份自证（`neon.project_id`）。
 *
 * 纪律：**只读 + 一次可复原写**（详情自增是产品行为本身；探针结束必 `UPDATE` 回原值，
 *   并在读数里记 pre/post 两数）。不 apply 迁移、不写版本表。凭据只读 `.env.local`（dev 库）。
 *   若库身份不是 dev ⇒ 立即 STOP（不发文/不写库），防误打生产。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { checker, mkPool, raw1, RUN } from '../../backend-ts/scripts/p7b-lib';

const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DEV_PROJECT = 'quiet-math-65207667';
const VIEWER_PREFIX = 'anon:p59-gate-';

const sliceBetween = (src: string, startMark: string, endMark: string): string => {
  const a = src.indexOf(startMark);
  if (a < 0) return '';
  const b = src.indexOf(endMark, a + startMark.length);
  return b < 0 ? src.slice(a) : src.slice(a, b);
};

type Resp = { status: number; headers: Record<string, string>; json: Record<string, unknown> | null; body: string };

const req = (port: number, urlPath: string, headers: Record<string, string> = {}): Promise<Resp> =>
  new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        let json: Record<string, unknown> | null = null;
        try { json = JSON.parse(body) as Record<string, unknown>; } catch { json = null; }
        const hdrs: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) hdrs[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
        resolve({ status: res.statusCode ?? 0, headers: hdrs, json, body });
      });
    });
    r.on('error', reject);
    r.end();
  });

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/item-detail/p59-00-detail-nocache-gate.ts' };
  const pool = mkPool(2);

  try {
    // ==================================================================== A · 静态面（零 DB / 零 HTTP）
    const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
    ck.t('A1', '**零新路由**：注册点 = 127（118 + campaign-domain 九口 route §49.18；本单零新路由，只改详情路由的响应头）',
      regs === 127, `registration_points=${regs}`);

    const detailBlock = sliceBetween(INDEX_TS, "app.get('/api/prize/:bID'", "app.get('/api/user'");
    const noStoreInDetail = (detailBlock.match(/setPrivateNoStore\(res\)/g) ?? []).length;
    const publicInDetail = (detailBlock.match(/setPublicCache\(/g) ?? []).length;
    const ifGuard = /if\s*\([^)]*mintedCookie/.test(detailBlock) || /\?\s*setPrivateNoStore/.test(detailBlock);
    ck.t('A2', '详情路由**无条件** no-store：`setPrivateNoStore(res)` 恰 1 处且不在条件分支里（`mintedCookie` 二分已删）· 详情块 `setPublicCache(` **零命中**',
      noStoreInDetail === 1 && publicInDetail === 0 && !ifGuard && !/mintedCookie/.test(detailBlock),
      JSON.stringify({ no_store: noStoreInDetail, public_cache: publicInDetail, conditional: ifGuard, minted_cookie: /mintedCookie/.test(detailBlock) }));

    // 其余读口缓存语义「一字不改」：全仓 setPublicCache 调用点 = 4（原 5 处，减去详情这一处）
    const publicCalls = (INDEX_TS.match(/setPublicCache\(res\)/g) ?? []).length;
    const feederBlocks: Array<[string, string]> = [
      ['/api/prize/all', sliceBetween(INDEX_TS, "app.get('/api/prize/all'", "app.get('/api/task/all'")],
      ['/api/task/all', sliceBetween(INDEX_TS, "app.get('/api/task/all'", "app.get('/api/task/:tID'")],
      ['/api/task/:tID', sliceBetween(INDEX_TS, "app.get('/api/task/:tID'", "app.get('/api/prize/:bID'")],
    ];
    const feederHits = feederBlocks.map(([name, blk]) => [name, /setPublicCache\(res\)/.test(blk)] as [string, boolean]);
    ck.t('A3', '其余公开读口**缓存语义零变化**：全仓 `setPublicCache(res)` 调用点 = 4（feed/任务列表/任务详情 + home 匿名臂）· `/api/prize/all`、`/api/task/all`、`/api/task/:tID` 三块各仍有 1 处',
      publicCalls === 4 && feederHits.every(([, hit]) => hit),
      JSON.stringify({ public_cache_calls: publicCalls, blocks: feederHits }));

    const homeBlock = sliceBetween(INDEX_TS, "app.get('/api/home'", "app.post('/api/auth/login'");
    ck.t('A4', '`/api/home` 双分支原样（登录 ⇒ private/no-store、匿名 ⇒ public）且 `Vary: Authorization` 未挪窝（详情块**没有**该头 —— 历史上只有 home 设，故无既有体例需保留）',
      /if \(actor\) \{\s*\n\s*setPrivateNoStore\(res\);/.test(homeBlock) && /setPublicCache\(res\);/.test(homeBlock)
      && homeBlock.includes("res.setHeader('Vary', 'Authorization')") && !/Vary/.test(detailBlock),
      JSON.stringify({ home_private: /setPrivateNoStore\(res\)/.test(homeBlock), home_public: /setPublicCache\(res\)/.test(homeBlock), home_vary: /Vary/.test(homeBlock), detail_vary: /Vary/.test(detailBlock) }));

    ck.t('A5', '详情读口未被本单顺手换口：`DatabaseService.getPrizeDetailRecordingView(bID)` 字面仍在 · `getPrizeById(` 仍不在详情块（自增语义单一真源）',
      /DatabaseService\.getPrizeDetailRecordingView\(bID\)/.test(detailBlock) && !/getPrizeById\(/.test(detailBlock),
      JSON.stringify({ dedicated_read: /getPrizeDetailRecordingView/.test(detailBlock), bare_read: /getPrizeById\(/.test(detailBlock) }));

    // ==================================================================== ENV · 库身份（写库前自证）
    const pid = (await raw1<{ pid: string | null }>(pool as never, "SELECT current_setting('neon.project_id', true) AS pid"))?.pid ?? null;
    const isDev = pid === DEV_PROJECT;
    ck.t('ENV', `库身份自证：neon.project_id = ${DEV_PROJECT}（dev）—— 写库/发文前的前置闸，不符即停手`,
      isDev, `project_id=${pid}`);
    if (!isDev) throw new Error(`STOP: target db is not dev (project_id=${pid})`);

    // 目标 listing：取最小 listing_id（详情读口任何状态都可读；不造夹具、只做一次可复原自增）
    const target = await raw1<{ listing_id: string; view_count: string }>(pool as never,
      'SELECT listing_id, view_count FROM public.listing ORDER BY listing_id LIMIT 1');
    if (!target) throw new Error('no listing row to probe');
    const bID = Number(target.listing_id);
    const preViews = Number(target.view_count);
    const dedupRow = await raw1<{ value: unknown }>(pool as never,
      "SELECT value FROM public.app_config WHERE key = 'detail_view_dedup'");
    const dedupOn = String((dedupRow?.value as Record<string, unknown> | undefined)?.dedup ?? '') === 'on';

    // ==================================================================== B · 行为面（真 HTTP，临时端口）
    // VERCEL=1 ⇒ index.ts 不在 import 期自起 5788 实例；本探针自己起临时端口（不与 dev 实例冲突）
    process.env.VERCEL = '1';
    const mod = await import('../../backend-ts/src/index');
    const app = (mod.default ?? (mod as unknown as { default: unknown }).default) as http.RequestListener;
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as AddressInfo).port;

    try {
      const r1 = await req(port, `/api/prize/${bID}`, { 'x-sf-viewer': `${VIEWER_PREFIX}1` });
      const cc1 = String(r1.headers['cache-control'] ?? '');
      const views1 = Number(((r1.json?.data ?? {}) as Record<string, unknown>).views);
      ck.t('B1', '**详情响应头实测**：`Cache-Control` = `private, no-store` · **不含** `public` / `s-maxage` / `max-age`（原缺陷形态）',
        r1.status === 200 && cc1 === 'private, no-store'
        && !/public/i.test(cc1) && !/s-maxage/i.test(cc1) && !/max-age/i.test(cc1),
        `status=${r1.status} cache_control=${JSON.stringify(cc1)}`);

      const r2 = await req(port, `/api/prize/${bID}`, { 'x-sf-viewer': `${VIEWER_PREFIX}2` });
      const r3 = await req(port, `/api/prize/${bID}`, { 'x-sf-viewer': `${VIEWER_PREFIX}3` });
      const views2 = Number(((r2.json?.data ?? {}) as Record<string, unknown>).views);
      const views3 = Number(((r3.json?.data ?? {}) as Record<string, unknown>).views);
      ck.t('B2', '**每次打开 +1（真 HTTP × 3，无缓存介入）**：views = pre+1, pre+2, pre+3 逐次自增（CDN 缓存形态下第二次起会停在同值）',
        views1 === preViews + 1 && views2 === preViews + 2 && views3 === preViews + 3,
        JSON.stringify({ bID, pre: preViews, r1: views1, r2: views2, r3: views3 }));

      const ccAll = `/api/prize/${bID}`;
      const authHeader = { authorization: 'Bearer p59-gate.garbage.token', 'x-sf-viewer': `${VIEWER_PREFIX}au` };
      const rAuth = await req(port, ccAll, authHeader);
      const ccAuth = String(rAuth.headers['cache-control'] ?? '');
      ck.t('B3', '**无二分**：带 `Authorization`（垃圾令牌 ⇒ 匿名路径）时仍 `private, no-store` · 不发 `Set-Cookie` 的分支也没有 public 回潮',
        rAuth.status === 200 && ccAuth === 'private, no-store' && !rAuth.headers['set-cookie'],
        `status=${rAuth.status} cache_control=${JSON.stringify(ccAuth)} set_cookie=${rAuth.headers['set-cookie'] ?? 'none'}`);

      const feed = await req(port, '/api/prize/all?skip=0&limit=6');
      const ccFeed = String(feed.headers['cache-control'] ?? '');
      ck.t('B4', '**feed 仍 public**（缓存语义一字不改）：`/api/prize/all` 的 `Cache-Control` 实测含 `public` + `s-maxage`（逐字 `public, s-maxage=30, stale-while-revalidate=300`）',
        feed.status === 200 && /public/.test(ccFeed) && /s-maxage=30/.test(ccFeed) && /stale-while-revalidate=300/.test(ccFeed),
        `status=${feed.status} cache_control=${JSON.stringify(ccFeed)}`);

      const tasks = await req(port, '/api/task/all?skip=0&limit=6');
      const ccTasks = String(tasks.headers['cache-control'] ?? '');
      ck.t('B5', '`/api/task/all` 仍 public（同上，逐字 `public, s-maxage=30, stale-while-revalidate=300`）',
        tasks.status === 200 && /public/.test(ccTasks) && /s-maxage=30/.test(ccTasks),
        `status=${tasks.status} cache_control=${JSON.stringify(ccTasks)}`);

      const home = await req(port, '/api/home?task_limit=2&prize_limit=2');
      const ccHome = String(home.headers['cache-control'] ?? '');
      ck.t('B6', '`/api/home` 匿名臂仍 public 且 `Vary: Authorization` 在场（双分支体例未被本单波及）',
        home.status === 200 && /public/.test(ccHome) && /s-maxage=30/.test(ccHome)
        && /authorization/i.test(String(home.headers['vary'] ?? '')),
        `status=${home.status} cache_control=${JSON.stringify(ccHome)} vary=${JSON.stringify(home.headers['vary'] ?? '')}`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // ==================================================================== E · 零残留（回写复原）
    const restored = await raw1<{ view_count: string }>(pool as never,
      'UPDATE public.listing SET view_count = $1 WHERE listing_id = $2 RETURNING view_count', [preViews, bID]);
    const logs = await raw1<{ n: number }>(pool as never,
      'SELECT count(*)::int AS n FROM public.listing_view_log WHERE viewer_key LIKE $1', [`${VIEWER_PREFIX}%`]);
    ck.t('E1', '**零残留**：探针自增已回写复原（`view_count` 读回 = 改前值）· 探针 viewer_key 在 `listing_view_log` 命中 = 0（去重开关 off 时本不该写日志）',
      Number(restored?.view_count) === preViews && Number(logs?.n ?? -1) === 0,
      JSON.stringify({ bID, pre: preViews, restored: Number(restored?.view_count), log_rows: logs?.n, dedup_on: dedupOn }));

    out.target = { bID, pre_views: preViews, restored_views: Number(restored?.view_count), dedup_on: dedupOn };
    out.env = { project_id: pid };
  } finally {
    await pool.end().catch(() => undefined);
  }

  // ====================================================================== 落盘
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p59-detail-nocache-gate', out);
  console.log(JSON.stringify({ saved: f, summary: out.summary, red: (out.summary as { red: string[] }).red }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
