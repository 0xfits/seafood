/**
 * 批 8④ 补漏 · **权限面 / 非法入参** 真 HTTP 只读探针（受控实例 5796）。
 * ============================================================================
 * 用法：PORT=5796 起实例后 → cd backend-ts && npx ts-node --transpile-only scripts/p8-s4-02-http-readonly.ts
 * 产物：backend-ts/.p8s4-artifacts/p8s4-http-<RUN>/http.json
 *
 * ★ 只跑**读面 / 鉴权面 / 早退面**（400/401/403/404）——**绝不**用有效 admin 凭据发真 approve/reject
 *   （那会在生产库 `COMMIT` 一条不可删的台账行 + 迁 status ⇒ 不可复原；按 §23.5(b) 登记 NOT_MEASURED）。
 *   · 令牌由**本仓自身** `createSessionToken`（读 `.env.local` 的 SECRET_KEY）现签，**不打印令牌值**；
 *   · 动作口只用「非数字 `:cid`」⇒ 路由在**任何 DB / 写逻辑之前** 404（零写）。
 * ⚠️ 只打印状态码 / 机读码 / reason，**不打印任何令牌 / 密钥 / 连接串**。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createSessionToken } from '../src/auth';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p8s4-artifacts', `p8s4-http-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = `http://127.0.0.1:${process.env.PORT || '5796'}`;

interface Check { id: string; group: string; pass: boolean; detail: unknown; neg_rule: string; }
const checks: Check[] = [];
const rec = (id: string, g: string, pass: boolean, detail: unknown, neg: string) => checks.push({ id, group: g, pass, detail, neg_rule: neg });

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Record<string, unknown> | null = null;
  try { json = await r.json() as Record<string, unknown>; } catch { /* noop */ }
  const err = (json?.error ?? {}) as Record<string, unknown>;
  const details = (err.details ?? {}) as Record<string, unknown>;
  return { status: r.status, code: err.code ?? null, reason: details.reason ?? null };
};

const main = async (): Promise<void> => {
  const adminRow = (await readQuery<{ uid: string }>(`SELECT uid::text AS uid FROM public.users WHERE is_admin = true ORDER BY uid ASC LIMIT 1`))[0];
  const nonAdminRow = (await readQuery<{ uid: string }>(`SELECT u.uid::text AS uid FROM public.users u
      WHERE u.is_admin = false AND NOT EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid)
      ORDER BY u.uid ASC LIMIT 1`))[0];
  if (!adminRow || !nonAdminRow) throw new Error('PRECONDITION: no admin / no plain non-admin user');
  const adminTok = createSessionToken({ uID: Number(adminRow.uid), evm: '' });
  const plainTok = createSessionToken({ uID: Number(nonAdminRow.uid), evm: '' });

  const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null) as Record<string, unknown> | null;
  const summary: Record<string, unknown> = { base: BASE, health: { status: health?.status ?? null, schema_version: health?.schema_version ?? null } };

  // 401 · 无 token（两路由）
  const n1 = await call('GET', '/api/admin/currency');
  const n2 = await call('POST', '/api/admin/currency/1/review', undefined, { action: 'approve', reason: 'x' });
  rec('H1', 'auth401', n1.status === 401 && n1.code === 'AUTH_UNAUTHORIZED', n1, '读口无 token 须 401 AUTH_UNAUTHORIZED ⇒ 落业务 200/500 ⇒ 判负');
  rec('H2', 'auth401', n2.status === 401 && n2.code === 'AUTH_UNAUTHORIZED', n2, '动作口无 token 须 401 AUTH_UNAUTHORIZED（**先于**任何 DB / 写）⇒ 否则 ⇒ 判负');

  // 403 · 非 admin（凭据有效但无 admin 访问权）⇒ NOT_ADMIN（两路由）
  const p1 = await call('GET', '/api/admin/currency', plainTok);
  const p2 = await call('POST', '/api/admin/currency/1/review', plainTok, { action: 'reject', reason: 'x' });
  rec('H3', 'auth403', p1.status === 403 && p1.reason === 'NOT_ADMIN', p1, '读口：非 admin 须 403 reason=NOT_ADMIN ⇒ 落 200 / 其它 reason ⇒ 判负');
  rec('H4', 'auth403', p2.status === 403 && p2.reason === 'NOT_ADMIN', p2, '动作口：非 admin 须 403 reason=NOT_ADMIN（**先于**写）⇒ 否则 ⇒ 判负');

  // 正控 · admin token 读口 200（只读）
  const a1 = await call('GET', '/api/admin/currency', adminTok);
  rec('H5', 'positive', a1.status === 200, a1, 'admin token 读口须 200（正控；证明凭据真有效）⇒ 非 200 ⇒ 判负');

  // 非法入参（早退 · 零写）· 动作口非数字 :cid ⇒ 404 LD007
  const b1 = await call('POST', '/api/admin/currency/abc/review', adminTok, { action: 'approve', reason: 'x' });
  rec('H6', 'illegalInput', b1.status === 404 && b1.code === 'LEDGER_CURRENCY_NOT_FOUND', b1, '非数字 :cid ⇒ 404 LD007（路由在写逻辑前早退）⇒ 静默按 0 / 200 ⇒ 判负');

  summary.readings = { no_token_read: n1, no_token_action: n2, plain_read: p1, plain_action: p2, admin_read: a1, bad_cid_action: b1 };
  summary.notes = {
    not_measured_reason: '非 admin 有效凭据已实测 403 NOT_ADMIN；「缺 review_tasks（PERMISSION_NOT_GRANTED）」子面需库内「有 admin 角色但不含 review_tasks」的账号，本轮现取无合适样本 ⇒ 见报告 NOT_MEASURED',
    write_surface: '真 admin 凭据的 approve/reject 真 HTTP 写面 = NOT_MEASURED（按 §23.5(b) 禁在生产库落不可复原写）',
  };

  const failed = checks.filter((c) => !c.pass);
  fs.writeFileSync(path.join(OUT_DIR, 'http.json'), JSON.stringify({ unit: 'P8-S4-HTTP-READONLY', run: RUN, total: checks.length, passed: checks.length - failed.length, failed: failed.length, summary, checks }, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, failed_ids: failed.map((f) => f.id), summary }, null, 1));
  console.log(`ARTIFACT ${path.join(OUT_DIR, 'http.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
};
main().catch(async (e) => { console.error('HTTP PROBE FAIL:', (e as Error)?.message); await closePools(); process.exit(2); });
