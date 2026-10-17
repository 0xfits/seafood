/**
 * Neng 独立质检探针 · 父提交基线（`be483cc`，**无**告警面）
 * --------------------------------------------------------------------------------
 * 目的：给「告警面不改变对账响应」一个**直接对照**——同一套桩、同一套 env、同一组
 * 三臂（clean / drift / db_error），在父提交源码上跑一遍，落 status + 响应体 + 外发计数。
 * 子提交同名臂的响应体应与父提交**逐字节相同**（告警是纯旁路）。
 *
 * 跑法（cwd = backend-ts；QA_TREE 指父提交源码树）：
 *   QA_TREE=<scratch>/qa-parent/backend-ts npx ts-node --transpile-only ../ops/recon-alert/qa/probe/qa-parent-baseline.ts
 *
 * 零真实 DB / 零真实网络。
 */
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';

const BACKEND_ROOT = path.resolve(String(process.env.QA_TREE || ''));
const OUT_DIR = path.resolve(__dirname, '..', 'readings');

process.env.VERCEL = '1';
process.env.CRON_SECRET = 'qa-only-cron-secret';
process.env.TELEGRAM_BOT_TOKEN = '123456789:AAFakeTokenXYZ0123456789abcdefghij';
process.env.OPS_ALERT_UID = '100';
process.env.RECON_HEARTBEAT_URL = 'https://hc-ping.invalid/ping/11111111-2222-3333-4444-555555555555';

type Row = Record<string, unknown>;
type FetchCall = { url: string };
let fetchCalls: FetchCall[] = [];
globalThis.fetch = ((input: unknown) => {
  fetchCalls.push({ url: String(input) });
  return Promise.resolve({ ok: true, status: 200, text: async () => 'OK' });
}) as unknown as typeof fetch;

/* eslint-disable @typescript-eslint/no-var-requires */
const db = require(path.join(BACKEND_ROOT, 'src/db'));
let reconMode: 'clean' | 'supply_drift' | 'db_error' | 'db_error_dirty' = 'clean';
const errorLines: string[] = [];
const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  errorLines.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
};

const supplyRows = (diff: string): Row[] => [{
  cid: 1, symbol: '$', total_supply: '2010200', sum_mint: '210274', sum_burn: '-200074',
  ledger_derived: String(2010200 - Number(diff)), diff,
}];

db.readQuery = async (text: string): Promise<Row[]> => {
  const sql = String(text);
  if (sql.includes('FROM public.users WHERE uid')) return [{ tg_user_id: '970001' }];
  if (reconMode === 'db_error_dirty') {
    const e = new Error('connect failed: postgresql://sf_user:S3cretPassw0rd@db.example.tech:5432/seafood bot 123456789:AAFakeTokenXYZ0123456789abcdefghij') as Error & { code?: string };
    e.code = 'ECONNREFUSED';
    throw e;
  }
  if (reconMode === 'db_error') {
    const e = new Error('connect ECONNREFUSED 127.0.0.1:5432') as Error & { code?: string };
    e.code = 'ECONNREFUSED';
    throw e;
  }
  if (sql.includes('FROM public.currency')) return supplyRows(reconMode === 'supply_drift' ? '2000001' : '2000000');
  return [];
};

const app = require(path.join(BACKEND_ROOT, 'src/index')).default;

const arms: Array<{ id: string; status: number; body: Row; ping_calls: number; tg_calls: number; error_lines: string[] }> = [];

(async () => {
  const server: http.Server = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  const port = (server.address() as AddressInfo).port;

  const call = (): Promise<{ status: number; body: Row }> => new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/api/ops/recon/ledger', method: 'GET', headers: { authorization: 'Bearer qa-only-cron-secret' } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: Row = {};
          try { body = JSON.parse(raw) as Row; } catch { body = { _raw: raw.slice(0, 200) }; }
          resolve({ status: res.statusCode || 0, body });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

  for (const [id, mode] of [['P_clean', 'clean'], ['P_drift', 'supply_drift'], ['P_db_error', 'db_error'], ['P_db_error_dirty', 'db_error_dirty']] as const) {
    reconMode = mode as typeof reconMode;
    fetchCalls = [];
    const e0 = errorLines.length;
    const started = Date.now();
    const { status, body } = await call();
    arms.push({
      id,
      status,
      body,
      ping_calls: fetchCalls.filter((c) => !c.url.includes('api.telegram.org')).length,
      tg_calls: fetchCalls.filter((c) => c.url.includes('api.telegram.org')).length,
      error_lines: errorLines.slice(e0),
      // @ts-expect-error 仅读数用途
      elapsed_ms: Date.now() - started,
    });
  }

  const out = { probe: 'qa-parent-baseline', tree: BACKEND_ROOT, at: new Date().toISOString(), arms };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.resolve(OUT_DIR, 'parent-responses.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
  origError(JSON.stringify({ saved: file, arms: arms.map((a) => ({ id: a.id, status: a.status, ping: a.ping_calls, tg: a.tg_calls, err_lines: a.error_lines.length, leaks_conn: a.error_lines.filter((l) => l.includes('S3cretPassw0rd')).length, leaks_token: a.error_lines.filter((l) => l.includes('AAFakeTokenXYZ')).length })) }));
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error('PARENT_PROBE_FATAL', e instanceof Error ? e.stack : String(e));
  process.exit(2);
});
