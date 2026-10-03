/**
 * QA 8④ 终审质检 · 自写探针 03：受控实例权限面 / 鉴权面 / 早退面（只读 · 零写）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p8s4qa-artifacts/qa8s4-03-http.ts
 * 前置：受控实例已在 PORT=5796 起（链 .env.local）。令牌由本仓 createSessionToken 现签，**不打印令牌值**。
 * ★ 只跑 401 / 403 / 读口 200 / 非数字 :cid 早退 404 —— 绝不发任何有效 cid 的 POST（禁真写）。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createSessionToken } from '../src/auth';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5796';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.join(__dirname, `qa8s4-03-${RUN}`);
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = { uid: 1, evm: '0x99a7ae985ec41c5ba94dd640b74307d9d9cd8f74' };
const NONADMIN = { uid: 2, evm: '0xaf2102ef4ef7e285dbe7558b748f62f16fa67b1e' };
const NOPTS = { uid: 900004, evm: '0x32777d543c62dbf88b7b540420c6fd2a55bd491f' };

interface Check { id: string; pass: boolean; detail: unknown; expect: string; }
const checks: Check[] = [];
const rec = (id: string, pass: boolean, detail: unknown, expect: string): void => { checks.push({ id, pass: Boolean(pass), detail, expect }); };

const call = async (method: string, p: string, token?: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Record<string, unknown> = {};
  try { json = await r.json() as Record<string, unknown>; } catch { /* ignore */ }
  return { status: r.status, json };
};

const reasonOf = (j: Record<string, unknown>): unknown => ((j.error as Record<string, unknown> | undefined)?.details as Record<string, unknown> | undefined)?.reason ?? null;
const codeOf = (j: Record<string, unknown>): unknown => (j.error as Record<string, unknown> | undefined)?.code ?? null;

const main = async (): Promise<void> => {
  // 健康
  const health = await fetch(BASE + '/health');
  const hj = await health.json() as Record<string, unknown>;
  rec('H0', health.status === 200, { status: health.status, schema_version: hj.schema_version }, 'GET /health = 200');

  const adminT = createSessionToken({ uID: ADMIN.uid, evm: ADMIN.evm });
  const nonT = createSessionToken({ uID: NONADMIN.uid, evm: NONADMIN.evm });
  const noptsT = createSessionToken({ uID: NOPTS.uid, evm: NOPTS.evm });
  // 自证：本进程签的令牌能被本仓 verify 回读
  const { verifySessionToken } = require('../src/auth');
  let roundTrip: unknown = null;
  try { roundTrip = verifySessionToken(adminT); } catch (e) { roundTrip = `ERR:${(e as Error).message}`; }
  console.error(`[diag] SECRET_KEY present=${Boolean(process.env.SECRET_KEY)} len=${String(process.env.SECRET_KEY ?? '').length} roundTrip=${JSON.stringify(roundTrip)}`);

  const r1 = await call('GET', '/api/admin/currency');
  rec('H1', r1.status === 401 && codeOf(r1.json) === 'AUTH_UNAUTHORIZED', { status: r1.status, code: codeOf(r1.json) }, '无 token 读口 ⇒ 401 AUTH_UNAUTHORIZED');
  const r2 = await call('POST', '/api/admin/currency/1/review', undefined, { action: 'approve', reason: 'x' });
  rec('H2', r2.status === 401 && codeOf(r2.json) === 'AUTH_UNAUTHORIZED', { status: r2.status, code: codeOf(r2.json) }, '无 token 动作口 ⇒ 401 AUTH_UNAUTHORIZED');
  const r3 = await call('GET', '/api/admin/currency', nonT);
  rec('H3', r3.status === 403 && codeOf(r3.json) === 'AUTH_FORBIDDEN' && reasonOf(r3.json) === 'NOT_ADMIN', { status: r3.status, code: codeOf(r3.json), reason: reasonOf(r3.json) }, '非 admin 读口 ⇒ 403 NOT_ADMIN');
  const r4 = await call('POST', '/api/admin/currency/1/review', nonT, { action: 'approve', reason: 'x' });
  rec('H4', r4.status === 403 && codeOf(r4.json) === 'AUTH_FORBIDDEN' && reasonOf(r4.json) === 'NOT_ADMIN', { status: r4.status, code: codeOf(r4.json), reason: reasonOf(r4.json) }, '非 admin 动作口 ⇒ 403 NOT_ADMIN');
  const r5 = await call('GET', '/api/admin/currency', adminT);
  rec('H5', r5.status === 200, { status: r5.status, code: codeOf(r5.json), data_is_array: Array.isArray(r5.json.data) }, 'admin 读口 ⇒ 200');
  const r6 = await call('POST', '/api/admin/currency/abc/review', adminT, { action: 'approve', reason: 'x' });
  rec('H6', r6.status === 404 && codeOf(r6.json) === 'LEDGER_CURRENCY_NOT_FOUND', { status: r6.status, code: codeOf(r6.json) }, 'admin + 非数字 :cid ⇒ 404 LD007（写逻辑前早退）');
  const r7 = await call('GET', '/api/admin/currency', noptsT);
  rec('H7', r7.status === 403 && codeOf(r7.json) === 'AUTH_FORBIDDEN' && reasonOf(r7.json) === 'PERMISSION_NOT_GRANTED', { status: r7.status, code: codeOf(r7.json), reason: reasonOf(r7.json) }, '缺 review_tasks（有 admin 角色但不含该权限）读口 ⇒ 403 PERMISSION_NOT_GRANTED');
  const r8 = await call('POST', '/api/admin/currency/1/review', noptsT, { action: 'approve', reason: 'x' });
  rec('H8', r8.status === 403 && codeOf(r8.json) === 'AUTH_FORBIDDEN' && reasonOf(r8.json) === 'PERMISSION_NOT_GRANTED', { status: r8.status, code: codeOf(r8.json), reason: reasonOf(r8.json) }, '缺 review_tasks 动作口 ⇒ 403 PERMISSION_NOT_GRANTED（写逻辑前早退）');

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'QA8S4-03-HTTP', run: RUN, base: BASE, tokens_minted_for: { admin: ADMIN.uid, nonadmin: NONADMIN.uid, nopts: NOPTS.uid }, total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks };
  fs.writeFileSync(path.join(OUT, 'http.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  process.exit(failed.length ? 1 : 0);
};

main().catch((e) => { console.error('FAIL', (e as Error)?.message); process.exit(2); });
