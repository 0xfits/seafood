/**
 * 批 8①（§21）· **真链路四段读数**探针（受控实例 5796 + 真库只读/受控写）
 * ============================================================================
 * 用法：cd backend-ts && P8S1_BASE=http://127.0.0.1:5796 npx ts-node --transpile-only scripts/p8-s1-01-e2e.ts
 * 产物：backend-ts/.p8s1-artifacts/p8s1-e2e-<RUN>/e2e.json
 *
 * 四段（8① 形态 = 「合法键可写·读回同值」+「未知键被拒·库内零污染」）：
 *   ① 后台写（POST /api/admin/settings）→ ② 库内落值（直读 public.app_config）→
 *   ③ 业务读口取数（GET /api/admin/settings）→ ④ 行为随之（读回同值 + time_updated 前移）
 * 另测（判负）：未知键 / 类型不符 / 非 object / 费率键 ⇒ 400 + R107，且**库内零污染**（行前后对拍）。
 * 末尾**恢复原值**（受控写：只改 `siteDescription` 一个展示字段，随后复原）。
 * ⚠️ 只打印 uid / 计数 / 机读字段，**不打印任何密钥 / 连接串**。
 */
import '../src/env';
import { createSessionToken } from '../src/auth';
import { readQuery } from '../src/db';
import { DatabaseService, SystemSettingsWriteError } from '../src/database';

const BASE = process.env.P8S1_BASE || 'http://127.0.0.1:5796';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = require('path').join(__dirname, '..', '.p8s1-artifacts', `p8s1-e2e-${RUN}`);
require('fs').mkdirSync(OUT_DIR, { recursive: true });

interface Row { key: string; value: unknown; updated_by: string; time_updated: string; }
const readRows = (): Promise<Row[]> => readQuery<Row>(
  'SELECT key, value, updated_by::text AS updated_by, time_updated::text AS time_updated FROM public.app_config ORDER BY key',
);
const asObj = (v: unknown): Record<string, unknown> => (typeof v === 'string' ? JSON.parse(v) : (v as Record<string, unknown>));

const api = async (method: string, path: string, body?: unknown, token?: string, hdr?: Record<string, string>) => {
  const headers: Record<string, string> = { ...(hdr || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
};

const out: Record<string, unknown> = { script: 'scripts/p8-s1-01-e2e.ts', base: BASE, run: RUN };
const results: Array<Record<string, unknown>> = [];
const rec = (id: string, pass: boolean, detail: unknown) => { results.push({ id, pass, detail }); };

(async () => {
  // --- 0) 实例就绪 ---
  const health = await api('GET', '/');
  out.health = { status: health.status };

  // --- 管理员 uid（只读） ---
  const admins = await readQuery<{ uid: number; evm: string }>(
    'SELECT u.uid, u.evm FROM "users" u WHERE u.is_admin = true ORDER BY u.uid LIMIT 1',
  );
  const admin = admins[0] || (await readQuery<{ uid: number; evm: string }>(
    'SELECT u.uid, u.evm FROM "users" u JOIN public.admin_user_role r ON r.uid = u.uid ORDER BY u.uid LIMIT 1',
  ))[0];
  if (!admin) throw new Error('NO_ADMIN_USER_FOUND');
  out.admin_uid = admin.uid;
  const token = createSessionToken({ uID: admin.uid, evm: admin.evm });
  const opsKey = `ops:${admin.uid}:setting:system_settings`;

  const me = await api('GET', '/api/admin/me', undefined, token);
  out.me = { status: me.status, can_access_admin: me.json?.data?.can_access_admin ?? null };
  rec('S0-admin-access', me.status === 200 && me.json?.data?.can_access_admin === true, out.me);

  // --- 基线：读口 + 库行 ---
  const g0 = await api('GET', '/api/admin/settings', undefined, token);
  const before = await readRows();
  out.baseline = {
    get_status: g0.status,
    data_keys: g0.json?.data ? Object.keys(g0.json.data).sort() : null,
    db_row_keys: before.map((r) => r.key),
    db_rows: before.length,
    siteDescription: g0.json?.data?.siteDescription ?? null,
    time_updated: before[0]?.time_updated ?? null,
  };

  const original = asObj(before.find((r) => r.key === 'system_settings')?.value || {});
  const marker = `p8s1-probe-${RUN}`;

  // ==================== ① 后台写（合法键） ====================
  const w1 = await api('POST', '/api/admin/settings',
    { ...original, siteDescription: marker, create_key: opsKey }, token);
  rec('①-write-legal', w1.status === 200 && w1.json?.success === true
    && w1.json?.data?.siteDescription === marker,
    { status: w1.status, siteDescription: w1.json?.data?.siteDescription });

  // ==================== ② 库内落值 ====================
  const afterWrite = await readRows();
  const rowW = afterWrite.find((r) => r.key === 'system_settings');
  const dbVal = asObj(rowW?.value || {});
  rec('②-db-landed', dbVal.siteDescription === marker && rowW?.updated_by === String(admin.uid),
    { siteDescription: dbVal.siteDescription, updated_by: rowW?.updated_by, time_updated: rowW?.time_updated });

  // ==================== ③ 业务读口取数 ====================
  const g1 = await api('GET', '/api/admin/settings', undefined, token);
  rec('③-read-endpoint', g1.status === 200 && g1.json?.data?.siteDescription === marker,
    { status: g1.status, siteDescription: g1.json?.data?.siteDescription, keys: Object.keys(g1.json?.data || {}).length });

  // ==================== ④ 行为随之（读回同值 + time_updated 前移） ====================
  rec('④-behavior-same-value', g1.json?.data?.siteDescription === marker
    && g1.json?.data?.siteDescription === dbVal.siteDescription,
    { read_back: g1.json?.data?.siteDescription, db: dbVal.siteDescription });
  rec('④-time-advanced', String(rowW?.time_updated) !== String(before[0]?.time_updated),
    { before: before[0]?.time_updated, after: rowW?.time_updated });

  // ==================== 判负 A：未知键（库内零污染） ====================
  const dbSnapshot = JSON.stringify(await readRows());
  const badKey = await api('POST', '/api/admin/settings',
    { siteName: 'HACK', foo: 1, create_key: opsKey }, token);
  const dbAfterBad = JSON.stringify(await readRows());
  out.unknown_key_body = badKey.json;
  rec('NEG-AG1-unknown-key', badKey.status === 400
    && badKey.json?.error?.details?.reason === 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'
    && Array.isArray(badKey.json?.error?.details?.unknown_keys)
    && badKey.json.error.details.unknown_keys.includes('foo'), badKey.json);
  rec('NEG-AG1-zero-pollution', dbSnapshot === dbAfterBad, { changed: dbSnapshot !== dbAfterBad });
  rec('NEG-AG4-mixed-whole-reject', badKey.status === 400, { status: badKey.status });

  // ==================== 判负 B：类型不符 ====================
  const badType = await api('POST', '/api/admin/settings', { pointsPerTask: 'abc', create_key: opsKey }, token);
  out.type_error_body = badType.json;
  rec('NEG-AG3-type', badType.status === 400
    && badType.json?.error?.details?.reason === 'SETTING_TYPE_INVALID'
    && badType.json?.error?.details?.field === 'pointsPerTask'
    && badType.json?.error?.details?.got === 'string', badType.json);

  // ==================== 判负 C：非 object（数组体；scalar 被 express.json strict 前置拒） ====================
  const arrBody = await api('POST', '/api/admin/settings', [1, 2], token, { 'Idempotency-Key': opsKey });
  out.array_body_body = arrBody.json;
  rec('NEG-AG3-not-object', arrBody.status === 400
    && arrBody.json?.error?.details?.reason === 'SETTING_VALUE_NOT_OBJECT'
    && arrBody.json?.error?.details?.got === 'array', arrBody.json);

  // ==================== 判负 D：费率键（既有黑名单，保留） ====================
  const feeBody = await api('POST', '/api/admin/settings', { fee_rate: 5, create_key: opsKey }, token);
  out.fee_body = feeBody.json;
  rec('NEG-fee-rate-key', feeBody.status === 400
    && ['SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST', 'FEE_RATE_KEY_NOT_IN_APP_CONFIG'].includes(feeBody.json?.error?.details?.reason), feeBody.json);

  // ==================== 判负 E：R107 形状逐字（键集） ====================
  const shape = badKey.json?.error ? Object.keys(badKey.json.error).sort() : [];
  rec('R107-shape', JSON.stringify(shape) === JSON.stringify(['code', 'details', 'i18n_key', 'message'])
    && Object.keys(badKey.json).length === 1, { error_keys: shape, top_keys: Object.keys(badKey.json || {}) });

  // ==================== 判负 F：服务层严格（绕路由直调 saveSystemSettings） ====================
  let svcThrew = false; let svcName = '';
  try { await DatabaseService.saveSystemSettings({ foo: 1 } as never, admin.uid); }
  catch (e) { svcThrew = e instanceof SystemSettingsWriteError; svcName = (e as Error)?.name || ''; }
  const dbAfterSvc = JSON.stringify(await readRows());
  rec('NEG-service-layer-strict', svcThrew && dbAfterSvc === dbSnapshot, { threw: svcThrew, name: svcName, zero_pollution: dbAfterSvc === dbSnapshot });

  // ==================== AG2：app_config 全部行（键集 = 关闭集） ====================
  const finalRows = await readRows();
  rec('AG2-key-closure', finalRows.every((r) => r.key === 'system_settings'),
    { keys: finalRows.map((r) => r.key) });

  // ==================== 恢复原值 ====================
  const restore = await api('POST', '/api/admin/settings',
    { ...original, create_key: opsKey }, token);
  const afterRestore = await readRows();
  const restored = asObj(afterRestore.find((r) => r.key === 'system_settings')?.value || {});
  rec('RESTORE', restore.status === 200 && restored.siteDescription === original.siteDescription,
    { status: restore.status, siteDescription: restored.siteDescription, original: original.siteDescription });

  const failed = results.filter((r) => !r.pass);
  const report = {
    unit: 'P8-S1-E2E', run: RUN, base: BASE, generated_at: new Date().toISOString(),
    total: results.length, passed: results.length - failed.length, failed: failed.length,
    out, results,
  };
  require('fs').writeFileSync(require('path').join(OUT_DIR, 'e2e.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${require('path').join(OUT_DIR, 'e2e.json')}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E_CRASHED', (e as Error)?.message); process.exit(2); });
