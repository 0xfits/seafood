/**
 * P6-B5-CLAIM · 真实 HTTP 实测（本机服务；**必须先重启服务**再跑，否则旧进程假红）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-b5claim-01-http.ts
 * 断言（任一不满足 ⇒ exit 1）：
 *   H1 该面（不带上下文 / 带上下文两种请求）恒 `410`
 *   H2 两次响应体**逐字节相同**（撤 `requireActor` 前置 ⇒ 无令牌下亦可观测「已下线」）
 *   H3 信封键集 + `code` 与**既有 410 面**（参照 `/api/admin/task/create`）一致（R107）
 *   H4 机读 reason = `CLAIM_RETIRED`（`details.reason`）
 *   H5 `details.http_status=410` + `i18n_key` 同参照面
 *   H6 路由注册点（现取）= 67
 * 产物：backend-ts/.p4-artifacts/p6b5claim-http-<RUN>/http.json
 */
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const HOST = process.env.SEAFOOD_HOST || '127.0.0.1';
const PORT = Number(process.env.SEAFOOD_PORT || 5788);
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6b5claim-http-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface HttpOut { status: number; raw: string; body: Record<string, any>; }

const post = (p: string, headers: Record<string, string>): Promise<HttpOut> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: HOST, port: PORT, path: p, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': 2, ...headers } },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let parsed: Record<string, any> = {};
          try { parsed = JSON.parse(raw || '{}'); } catch { parsed = { _unparsed: raw }; }
          resolve({ status: res.statusCode || 0, raw, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write('{}');
    req.end();
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
const errKeys = (o: Record<string, any>): string => Object.keys((o && o.error) || {}).join(',');

(async () => {
  const checks: Array<{ id: string; pass: boolean; expect: string; actual: string }> = [];
  const add = (id: string, pass: boolean, expect: string, actual: string) => checks.push({ id, pass, expect, actual });

  const refFace = await post('/api/admin/task/create', {});                                  // 既有 410 面（参照）
  const noAuth = await post('/api/task-progress/claim/1', {});                               // 不带上下文
  const withAuth = await post('/api/task-progress/claim/1', { Authorization: 'Bearer p6b5claim-probe-token' }); // 带上文

  add('H1', noAuth.status === 410 && withAuth.status === 410, '两请求均 410', `${noAuth.status}/${withAuth.status}`);
  add('H2', noAuth.raw === withAuth.raw, '带/不带上文响应体逐字节相同', noAuth.raw === withAuth.raw ? 'same' : 'diff');
  add('H3', errKeys(noAuth.body) === errKeys(refFace.body) && noAuth.body.error?.code === refFace.body.error?.code,
    '信封键集+code 同既有 410 面', `${errKeys(noAuth.body)} vs ${errKeys(refFace.body)} / ${noAuth.body.error?.code}`);
  add('H4', noAuth.body.error?.details?.reason === 'CLAIM_RETIRED', 'details.reason=CLAIM_RETIRED', String(noAuth.body.error?.details?.reason));
  add('H5', noAuth.body.error?.details?.http_status === 410 && noAuth.body.error?.i18n_key === refFace.body.error?.i18n_key,
    'details.http_status=410 + i18n_key 同参照面', `${noAuth.body.error?.details?.http_status}/${noAuth.body.error?.i18n_key}`);

  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
  const routes = src.split('\n').filter((l) => /^\s*app\.(get|post|put|patch|delete|all)\(/.test(l)).length;
  add('H6', routes === 67, '注册点=67', String(routes));

  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P6-B5-CLAIM',
    kind: 'http',
    generated_at: new Date().toISOString(),
    host: `${HOST}:${PORT}`,
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    claim_statuses: [noAuth.status, withAuth.status],
    ref_face: { path: '/api/admin/task/create', body: refFace.body },
    claim_no_auth: noAuth.body,
    claim_with_auth: withAuth.body,
    routes,
    checks,
  };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'http.json'), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'http.json')}`);
  if (failed.length) process.exit(1);
})().catch((e) => {
  console.error('HTTP_TEST_CRASHED', (e as Error)?.message);
  process.exit(2);
});
