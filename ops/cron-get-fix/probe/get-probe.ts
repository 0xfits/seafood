/**
 * 行为探针 · `/api/translate/backfill` GET 注册面（**零真实翻译 API / 零写库**）
 * ---------------------------------------------------------------------------
 * 用法（cwd = backend-ts）：
 *   PROBE_BACKEND_ROOT=<abs backend-ts> npx ts-node --transpile-only ../ops/cron-get-fix/probe/get-probe.ts
 *   · 缺省 PROBE_BACKEND_ROOT = 本仓 backend-ts（修后代码）；
 *   · 修前基线：指向 `git worktree` 导出的 HEAD 版本（只读，不动主工作区）。
 *
 * 为什么不是「起真服务 + 真跑一次」：
 *   cron 语义 = scan（写 pending 行）+ translate（调 DeepSeek 付费）。本单只修**注册面**，
 *   故在**进程内**把服务层两个导出替换为恒零 stub（require 缓存内改导出，index 侧是
 *   `ts_1.backfillPending(...)` 属性取值 ⇒ 生效），鉴权闸 / 参数解析 / 回执组装**全部走真码**。
 *   ⇒ 探针证的是「GET 是否**进入 handler** 并按 CRON_SECRET 分档」，不是翻译正确性。
 *
 * 密钥口径：`CRON_SECRET` 只从 `process.env` 读（index 首 import 的 `./env` 已加载
 *   backend-ts/.env.local）⇒ **打印的只有状态码与键名，绝不回显密钥值**。
 */
import * as path from 'path';
import * as http from 'http';
import type { AddressInfo } from 'net';

const BACKEND_ROOT = process.env.PROBE_BACKEND_ROOT
  ? path.resolve(process.env.PROBE_BACKEND_ROOT)
  : path.resolve(__dirname, '../../../backend-ts');
const LABEL = process.env.PROBE_LABEL || (process.env.PROBE_BACKEND_ROOT ? 'worktree' : 'fixed');

// ---- ① 服务层 stub（在 index 被 require 之前改导出，零网络 / 零 DB）------------
/* eslint-disable @typescript-eslint/no-var-requires */
const svc = require(path.join(BACKEND_ROOT, 'src/translate-service'));
let svcCalls = 0;
svc.scanRegisterPending = async () => {
  svcCalls += 1;
  return { scanned: 0, registered: 0, existing: 0, by_entity: { job: 0, listing: 0, users: 0, currency: 0 } };
};
svc.backfillPending = async () => {
  svcCalls += 1;
  return { scanned: 0, ready: 0, failed: 0, skipped: 0, deferred: 0, retried: 0, reason: null, engine: 'stub' };
};

// 先加载真 app（`src/env.ts` 首 import 会把 backend-ts/.env.local 注入 process.env），
// 再取真密钥长度做判据；随后才把 CRON_SECRET 清空造「未配」档 ⇒ 三档都能真跑。
process.env.VERCEL = '1';
const app = require(path.join(BACKEND_ROOT, 'src/index')).default;
const REAL_SECRET = String(process.env.CRON_SECRET || '').trim();
const WRONG_SECRET = 'probe-wrong-secret-not-the-real-one';

type Reading = { id: string; method: string; url: string; auth: string; status: number; body_keys: string[]; data_keys?: string[]; ok?: unknown; mode?: unknown; status_code?: unknown; code?: unknown; message?: unknown; note?: string };

/** `sendSuccess` 把业务键装在 `data` 下 ⇒ 读数一律取 `data.*`（键面同读）。 */
const dataOf = (json: Record<string, unknown>): Record<string, unknown> =>
  json.data && typeof json.data === 'object' ? (json.data as Record<string, unknown>) : {};

const call = (method: string, url: string, headers: Record<string, string>, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> =>
  new Promise((resolve, reject) => {
    const addr = (httpServer.address() as AddressInfo).port;
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const req = http.request(
      { host: '127.0.0.1', port: addr, path: url, method, headers: { ...headers, ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: Record<string, unknown> = {};
          try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = { _raw_head: text.slice(0, 200) }; }
          resolve({ status: res.statusCode || 0, json });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

let httpServer: http.Server;

(async () => {
  httpServer = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise<void>((r) => httpServer.once('listening', () => r()));

  const readings: Reading[] = [];
  const push = (r: Reading) => {
    readings.push(r);
    const shown = { ...r, body_keys: r.body_keys };
    console.log(JSON.stringify(shown));
  };

  const URL_TB = '/api/translate/backfill';

  // ① CRON_SECRET 未配（空）⇒ 503 fail-loud（安全红线，绝不默认放行）
  process.env.CRON_SECRET = '';
  {
    const { status, json } = await call('GET', URL_TB, {});
    const d = dataOf(json);
    push({ id: `${LABEL}-A1_GET_no_secret_unset`, method: 'GET', url: URL_TB, auth: 'none', status, body_keys: Object.keys(json), ok: d.ok, mode: d.mode, code: (json.error as Record<string, unknown> | undefined)?.code ?? json.code, message: json.message, note: 'CRON_SECRET 未配 ⇒ 期望 503（fail-loud）' });
  }

  // ② 已配 CRON_SECRET 但无密钥 ⇒ 401；错密钥 ⇒ 401
  process.env.CRON_SECRET = REAL_SECRET;
  {
    const { status, json } = await call('GET', URL_TB, {});
    push({ id: `${LABEL}-B1_GET_no_header`, method: 'GET', url: URL_TB, auth: 'none', status, body_keys: Object.keys(json), code: (json.error as Record<string, unknown> | undefined)?.code ?? json.code, note: 'secret 已配、无头 ⇒ 期望 401' });
  }
  {
    const { status, json } = await call('GET', URL_TB, { authorization: `Bearer ${WRONG_SECRET}` });
    push({ id: `${LABEL}-B2_GET_wrong_bearer`, method: 'GET', url: URL_TB, auth: 'bearer(wrong)', status, body_keys: Object.keys(json), code: (json.error as Record<string, unknown> | undefined)?.code ?? json.code, note: '错密钥 ⇒ 期望 401' });
  }

  // ③ 正确密钥 ⇒ 期望 200 + ok:true + mode（GET 无 body ⇒ 走 req.query 分支）
  {
    const { status, json } = await call('GET', URL_TB, { authorization: `Bearer ${REAL_SECRET}` });
    const d = dataOf(json);
    push({ id: `${LABEL}-C1_GET_correct_bearer`, method: 'GET', url: URL_TB, auth: 'bearer(correct · 值不打印)', status, body_keys: Object.keys(json), data_keys: Object.keys(d), ok: d.ok, mode: d.mode, note: '期望 200 + data.ok:true + data.mode=scan_translate（GET 默认档）' });
  }
  {
    const { status, json } = await call('GET', `${URL_TB}?mode=scan&limit=5`, { 'x-cron-secret': REAL_SECRET });
    const d = dataOf(json);
    push({ id: `${LABEL}-C2_GET_query_mode_scan`, method: 'GET', url: `${URL_TB}?mode=scan&limit=5`, auth: 'x-cron-secret(correct)', status, body_keys: Object.keys(json), data_keys: Object.keys(d), ok: d.ok, mode: d.mode, note: '期望 200 + data.mode=scan（无 body ⇒ req.query 分支真可用）' });
  }

  // ④ 回归：POST 仍通（旧调用面不变）
  {
    const { status, json } = await call('POST', URL_TB, { authorization: `Bearer ${REAL_SECRET}` }, { mode: 'translate', limit: 3 });
    const d = dataOf(json);
    push({ id: `${LABEL}-D1_POST_correct_bearer`, method: 'POST', url: URL_TB, auth: 'bearer(correct)', status, body_keys: Object.keys(json), data_keys: Object.keys(d), ok: d.ok, mode: d.mode, note: 'POST 旧调用面不得回归（body.mode=translate）' });
  }
  {
    const { status, json } = await call('POST', URL_TB, {}, { mode: 'scan' });
    push({ id: `${LABEL}-D2_POST_wrong_none`, method: 'POST', url: URL_TB, auth: 'none', status, body_keys: Object.keys(json), code: (json.error as Record<string, unknown> | undefined)?.code ?? json.code, note: 'POST 鉴权闸不变 ⇒ 401' });
  }

  // ⑤ 未注册方法/路径对照（catch-all 形状，用于区分「进 handler」与 route_not_found）
  {
    const { status, json } = await call('GET', '/api/translate/backfill-not-a-route', {});
    push({ id: `${LABEL}-E1_GET_unregistered_path`, method: 'GET', url: '/api/translate/backfill-not-a-route', auth: 'none', status, body_keys: Object.keys(json), code: (json.error as Record<string, unknown> | undefined)?.code ?? json.code, note: '对照：未注册路径 ⇒ catch-all route_not_found' });
  }

  console.log(JSON.stringify({ probe: 'get-probe', backend_root: BACKEND_ROOT, label: LABEL, svc_stub_calls: svcCalls, cron_secret_configured: REAL_SECRET.length > 0, cron_secret_len: REAL_SECRET.length, readings }));
  httpServer.close();
  process.exit(0);
})().catch((e) => {
  console.error('PROBE_FATAL', e instanceof Error ? e.message : String(e));
  process.exit(2);
});
