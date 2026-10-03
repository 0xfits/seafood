/**
 * QA 8④ 终审质检 · 自写探针 03b：读口 200 的 data 键集 + 403 逐字体（只读 · 零写）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p8s4qa-artifacts/qa8s4-03b-http-shape.ts
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createSessionToken } from '../src/auth';
import { readQuery } from '../src/db';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5796';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.join(__dirname, `qa8s4-03b-${RUN}`);
fs.mkdirSync(OUT, { recursive: true });

const get = async (p: string, token?: string): Promise<{ status: number; json: unknown }> => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(BASE + p, { method: 'GET', headers });
  let json: unknown = null;
  try { json = await r.json(); } catch { /* ignore */ }
  return { status: r.status, json };
};

const main = async (): Promise<void> => {
  const adminT = createSessionToken({ uID: 1, evm: '0x99a7ae985ec41c5ba94dd640b74307d9d9cd8f74' });
  const noptsT = createSessionToken({ uID: 900004, evm: '0x32777d543c62dbf88b7b540420c6fd2a55bd491f' });

  const admin = await get('/api/admin/currency', adminT);
  const aj = (admin.json ?? {}) as Record<string, unknown>;
  const data = aj.data;
  const rowShape = Array.isArray(data) && data.length > 0 ? Object.keys(data[0] as Record<string, unknown>).sort() : null;

  const forbidden = await get('/api/admin/currency', noptsT);

  // 只读残渣核对：两 log 表行数（写面零发生的旁证）
  const revCnt = await readQuery('SELECT count(*)::int AS n FROM public.currency_review_log');
  const slogCnt = await readQuery('SELECT count(*)::int AS n FROM public.currency_status_log');

  const out = {
    unit: 'QA8S4-03B-HTTP-SHAPE',
    run: RUN,
    base: BASE,
    admin_read_200: { status: admin.status, top_keys: Object.keys(aj).sort(), data_is_array: Array.isArray(data), data_len: Array.isArray(data) ? data.length : null, row_keys: rowShape },
    nopts_read_403_verbatim: { status: forbidden.status, body: forbidden.json },
    readonly_log_rows: { currency_review_log: revCnt[0]?.n ?? null, currency_status_log: slogCnt[0]?.n ?? null },
  };
  fs.writeFileSync(path.join(OUT, 'http-shape.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL', (e as Error)?.message); process.exit(2); });
