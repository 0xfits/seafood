// p4z-errfid-02-http.ts — ERRCODE-AUDIT **路由端到端实测**（只发**会自己失败**的请求；独立一次性命名空间）
// ============================================================================
// 目的：把「机制取证」（`p4z-errfid-01-mech.ts`，经 HTTP `neon()` 直取驱动形态）补上**路由面**读数：
//   A) `POST /api/admin/points/adjust` + `uID = -1`（立案案由：保留 uid）⇒ 现行 HEAD 是否仍以 500 露面；
//   B) `POST /api/currency`（C1 建单位）⇒ **余额不足** 是否以 `409 LD001` 露面（走真驱动 + 真分类器）。
// 口径（㊳）：
//   · 只走**已注册**的 HTTP 端点 + `neon()` 只读取数；**不发**任何会成功的写请求
//     （B 前置：先只读查 `ledger_account.balance`；余额 **> 0** 则**不发**，直接记 `SKIPPED_BALANCE_SUFFICIENT`）；
//   · 幂等键用独立一次性命名空间前缀 `p4zerrfid:`；**产物禁落 token**（只记 token 长度与 sha256 前 12 位）。
// 用法：node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-errfid-02-http.ts <outDirAbs> [baseUrl]
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'errfid-probe'));
const BASE = process.argv[3] || 'http://127.0.0.1:5788';
fs.mkdirSync(outDir, { recursive: true });

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless');
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));
const run = async (q: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
  const anySql = sqlRaw as unknown as {
    (t: string, p?: unknown[]): Promise<unknown[]>;
    query?: (t: string, p?: unknown[]) => Promise<unknown[]>;
    unsafe?: (t: string, p?: unknown[]) => Promise<unknown[]>;
  };
  if (typeof anySql.query === 'function') return (await anySql.query(q, params)) as Record<string, unknown>[];
  if (typeof anySql.unsafe === 'function' && params.length) return (await anySql.unsafe(q, params)) as Record<string, unknown>[];
  return (await anySql(q, params)) as Record<string, unknown>[];
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createSessionToken } = require('../src/auth');

const sha12 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const post = async (p: string, token: string, body: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  const text = await res.text();
  try { parsed = JSON.parse(text); } catch { parsed = { raw_head: text.slice(0, 300) }; }
  return { status: res.status, body: parsed };
};

(async () => {
  const out: Record<string, unknown> = { run_tag: path.basename(outDir), started_at: new Date().toISOString(), base: BASE, cases: [] as unknown[] };
  const cases: Record<string, unknown>[] = out.cases as Record<string, unknown>[];

  // 取一个真实用户（uid/EVM 对）+ 一个管理员（若有）
  const users = await run(`SELECT u.uid::text AS uid, u.evm, a.balance::text AS balance FROM public.users u
                           LEFT JOIN public.account a ON a.uid = u.uid AND a.cid = 1
                           WHERE u.uid > 0 ORDER BY u.uid LIMIT 5`);
  out.users_probe = users.map((u) => ({ uid: u.uid, balance: u.balance }));
  const admin = await run(`SELECT uid::text AS uid, evm FROM public.users WHERE COALESCE(is_admin,false) = true ORDER BY uid LIMIT 3`)
    .catch(() => [] as Record<string, unknown>[]);
  out.admin_probe = admin.map((a) => ({ uid: a.uid }));
  const actor = users[0];
  if (!actor) { out.fatal = 'NO_USER_ROW'; fs.writeFileSync(path.join(outDir, 'http-cases.json'), JSON.stringify(out, null, 2)); return; }

  const token = `${createSessionToken({ uID: Number(actor.uid), evm: String(actor.evm) })}`;
  out.token_meta = { len: token.length, sha256_12: sha12(token) };

  // A) 保留 uid 前置闸（立案案由）
  const adminRow = admin[0] ?? actor;
  const tAdmin = admin[0] ? `${createSessionToken({ uID: Number(adminRow.uid), evm: String(adminRow.evm) })}` : token;
  const a = await post('/api/admin/points/adjust', tAdmin,
    { uID: -1, amount: 1, reason: 'p4z-errfid-audit' },
    { 'idempotency-key': `ops:points_adjust:p4zerrfid:${Date.now()}` });
  cases.push({ id: 'ROUTE_A_LD021', endpoint: 'POST /api/admin/points/adjust', sent: { uID: -1, amount: 1 }, actor_uid: adminRow.uid,
    expected: { status: 400, code: 'LEDGER_RESERVED_UID' }, measured: a });

  // B) 余额不足（C1 建单位）：**先只读查余额**；余额 > 0 则不发
  const bal = Number(String(actor.balance ?? '0'));
  const symbol = `P4Z${String(Date.now()).slice(-6)}`;
  if (bal > 0) {
    cases.push({ id: 'ROUTE_B_LD001', endpoint: 'POST /api/currency', outcome: 'SKIPPED_BALANCE_SUFFICIENT',
      note: 'owner 余额 > 0 ⇒ 可能成功建单位（= 真写）⇒ 按口径不发', actor_balance: actor.balance, symbol });
  } else {
    const b = await post('/api/currency', token,
      { symbol, name: 'P4Z ERR FID PROBE', decimals: 2, owner_uid: Number(actor.uid) },
      { 'idempotency-key': `biz:currency:create:${symbol}` });
    cases.push({ id: 'ROUTE_B_LD001', endpoint: 'POST /api/currency', sent: { symbol, decimals: 2, owner_uid: Number(actor.uid), fee: '<default>' },
      actor_balance: actor.balance, expected: { status: 409, code: 'LEDGER_INSUFFICIENT_BALANCE' }, measured: b });
    // 只读复核：错误路径**不得**留孤儿 currency 行
    const orphan = await run(`SELECT count(*)::int AS n FROM public.currency WHERE symbol = $1`, [symbol]).catch(() => [{ n: -1 }]);
    cases[cases.length - 1].orphan_currency_rows = orphan?.[0]?.n ?? -1;
  }

  out.finished_at = new Date().toISOString();
  const p = path.join(outDir, 'http-cases.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  for (const c of cases) console.log(JSON.stringify({ id: c.id, status: (c.measured as { status?: number } | undefined)?.status, error_code: ((c.measured as { body?: { error?: { code?: string } } } | undefined)?.body?.error?.code) ?? null, outcome: c.outcome ?? null }));
  console.log('ARTIFACT', p);
})().catch((e) => { console.error('FATAL', (e as Error)?.stack ?? e); process.exit(1); });
