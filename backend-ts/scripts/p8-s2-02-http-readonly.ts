/**
 * 批 8② · **HTTP 面只读探针**（受控实例 5796）
 * ============================================================================
 * 用法：cd backend-ts && P8S2_BASE=http://127.0.0.1:5796 npx ts-node --transpile-only scripts/p8-s2-02-http-readonly.ts
 * 产物：backend-ts/.p8s2-artifacts/p8s2-http-<RUN>/http.json
 *
 * ★ `R-8-15`：**HTTP 面只做只读探针**（`GET` 读口 + 鉴权 401 / 403 面）。
 *   **`HTTP POST` 面 = `NOT_MEASURED`** —— 原因（逐字）：`commission_policy` 表 **append-only**（不可删），
 *   且新政策行会以新 `effective_from` **直接成为现行政策** ⇒ 跑一发真 `POST` 就是**永久改变线上费率 / 佣金**。
 *   「后台写」段已改由 `scripts/p8-s2-01-effective.ts` 在**事务内 ROLLBACK** 完成（服务层同路径）。
 *
 * ⚠️ 只打印 uid / 状态码 / 键集 / 计数，**不打印任何密钥 / 连接串 / token**。
 */
import '../src/env';
import { createSessionToken } from '../src/auth';
import { readQuery } from '../src/db';

const BASE = process.env.P8S2_BASE || 'http://127.0.0.1:5796';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = require('path').join(__dirname, '..', '.p8s2-artifacts', `p8s2-http-${RUN}`);
require('fs').mkdirSync(OUT_DIR, { recursive: true });

const api = async (method: string, p: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, { method, headers });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text_len: text.length };
};

const out: Record<string, unknown> = {
  script: 'scripts/p8-s2-02-http-readonly.ts', base: BASE, run: RUN,
  http_post_face: {
    verdict: 'NOT_MEASURED',
    reason: 'R-8-15：`commission_policy` 表 append-only（`0007:102-112`，UPDATE/DELETE 直接 RAISE）+ 新政策行以新 `effective_from` 直接成为现行政策 ⇒ 真 POST 即永久改变线上费率/佣金。写段改由 `scripts/p8-s2-01-effective.ts` 在事务内 ROLLBACK 完成（服务层同路径 `withTransaction` + `insertCommissionPolicy`）。',
  },
};
const results: Array<{ id: string; pass: boolean; detail: unknown }> = [];
const rec = (id: string, pass: boolean, detail: unknown) => { results.push({ id, pass, detail }); };

(async () => {
  const health = await api('GET', '/');
  out.health = { status: health.status };

  const admins = await readQuery<{ uid: number; evm: string }>(
    'SELECT u.uid, u.evm FROM "users" u WHERE u.is_admin = true ORDER BY u.uid LIMIT 1');
  const admin = admins[0];
  if (!admin) throw new Error('NO_ADMIN_USER_FOUND');
  const nonAdmin = (await readQuery<{ uid: number; evm: string }>(
    `SELECT u.uid, u.evm FROM "users" u
      WHERE u.is_admin IS NOT TRUE AND NOT EXISTS (
        SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid)
      ORDER BY u.uid LIMIT 1`))[0];
  out.actors = { admin_uid: admin.uid, non_admin_uid: nonAdmin?.uid ?? null };
  const adminToken = createSessionToken({ uID: admin.uid, evm: admin.evm });
  const nonAdminToken = nonAdmin ? createSessionToken({ uID: nonAdmin.uid, evm: nonAdmin.evm }) : '';

  // ---------------- 读口 200（管理员） ----------------
  const g1 = await api('GET', '/api/admin/commission_policy', adminToken);
  const dataKeys = g1.json?.data ? Object.keys(g1.json.data).sort() : [];
  out.get_admin = {
    status: g1.status,
    top_keys: g1.json ? Object.keys(g1.json).sort() : null,
    success: g1.json?.success ?? null,
    data_keys: dataKeys,
    data: g1.json?.data ?? null,
  };
  rec('GET-200-admin', g1.status === 200 && g1.json?.success === true, { status: g1.status });
  rec('GET-data-8keys', JSON.stringify(dataKeys) === JSON.stringify(
    ['created_by', 'effective_from', 'fee_rate_bp', 'levels', 'policy_id', 'time_created', 'weights_bp', 'weights_sum_bp']),
    { data_keys: dataKeys });
  // 读口 `data` 与「业务读口」独立复取应当逐值相同（同源 = 现行政策）
  const dbNow = (await readQuery<Record<string, unknown>>(
    `SELECT policy_id::text AS policy_id, fee_rate_bp, levels FROM commission_policy
      WHERE effective_from <= now() ORDER BY effective_from DESC LIMIT 1`))[0];
  out.get_admin_vs_db = { http: { policy_id: g1.json?.data?.policy_id, fee_rate_bp: g1.json?.data?.fee_rate_bp, levels: g1.json?.data?.levels }, db: dbNow };
  rec('GET-matches-db-current', String(g1.json?.data?.policy_id) === String(dbNow.policy_id)
    && Number(g1.json?.data?.fee_rate_bp) === Number(dbNow.fee_rate_bp), out.get_admin_vs_db);

  // ---------------- 鉴权面：无 token ⇒ 401 ----------------
  const n1 = await api('GET', '/api/admin/commission_policy');
  out.get_no_token = { status: n1.status, body: n1.json };
  const errKeys = n1.json?.error ? Object.keys(n1.json.error).sort() : [];
  rec('AUTH-401-no-token', n1.status === 401, { status: n1.status });
  rec('R107-error-shape', JSON.stringify(errKeys) === JSON.stringify(['code', 'details', 'i18n_key', 'message'])
    && Object.keys(n1.json || {}).length === 1, { error_keys: errKeys, top_keys: Object.keys(n1.json || {}) });

  // ---------------- 鉴权面：非管理员 ⇒ 403 ----------------
  if (nonAdmin) {
    const n2 = await api('GET', '/api/admin/commission_policy', nonAdminToken);
    out.get_non_admin = { status: n2.status, body: n2.json };
    rec('AUTH-403-non-admin', n2.status === 403, { status: n2.status, body: n2.json });
  } else {
    rec('AUTH-403-non-admin', false, 'NOT_MEASURED: 库内无非管理员用户可取材');
  }

  // ---------------- 鉴权面：伪造 token ⇒ 401 ----------------
  const n3 = await api('GET', '/api/admin/commission_policy', 'not-a-real-token');
  out.get_bad_token = { status: n3.status, body: n3.json };
  rec('AUTH-401-bad-token', n3.status === 401, { status: n3.status });

  // ---------------- 只读纪律：政策表行数/现行值在探针前后不变 ----------------
  const cnt = Number((await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM commission_policy'))[0].n);
  out.policy_count_after_probe = cnt;
  rec('POLICY-append-only-untouched', cnt === 3, { count: cnt });

  const failed = results.filter((r) => !r.pass);
  const report = {
    unit: 'P8-S2-HTTP-READONLY', run: RUN, base: BASE, generated_at: new Date().toISOString(),
    total: results.length, passed: results.length - failed.length, failed: failed.length,
    out, results,
  };
  require('fs').writeFileSync(require('path').join(OUT_DIR, 'http.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${require('path').join(OUT_DIR, 'http.json')}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HTTP_PROBE_CRASHED', String((e as Error)?.stack || e).slice(0, 800)); process.exit(2); });
