/*
 * p4z-d1p-03-ledger-count.ts — D1' 账本零位移读数（**只读**；两个数）
 * ============================================================================
 * 用法：ts-node --transpile-only scripts/p4z-d1p-03-ledger-count.ts <label>
 *   label ∈ {pre, post}（写进产物与 stdout，用于改前/改后对拍）
 * 读数：① public.ledger_entry 行数；② public.account 行数（另附 account.balance 合计）
 * 口径：`neon()` HTTP 驱动、仅 SELECT、不导入 src/db（**不**注入 ws）。不改库、不建表。
 * 纪律：绝不回显连接串（只打印 host 指纹位）；退出码取自脚本自身。
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const envPath = path.join(REPO, '.env.local');
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
const label = String(process.argv[2] || 'unknown');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '';

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless');

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');

(async () => {
  const out: Record<string, unknown> = { label, generated_at: new Date().toISOString(), read_only: true, url_present: Boolean(url) };
  if (!url) {
    out.error = 'NO_URL';
    console.log(`LEDGER_COUNT label=${label} ERROR=NO_URL`);
    process.exitCode = 1;
    return;
  }
  try {
    const host = new URL(url.replace(/^postgres(ql)?:\/\//, 'https://')).host;
    out.db_host_masked = host.replace(/^[^.]+/, '***');
  } catch { out.db_host_masked = '<unparsable>'; }

  const sql = neon(url);
  try {
    const le = (await sql('SELECT count(*)::int AS n FROM public.ledger_entry')) as Array<{ n: number }>;
    const ac = (await sql('SELECT count(*)::int AS n FROM public.account')) as Array<{ n: number }>;
    const bs = (await sql('SELECT COALESCE(sum(balance),0)::text AS s FROM public.account')) as Array<{ s: string }>;
    out.ledger_entry_rows = le[0].n;
    out.account_rows = ac[0].n;
    out.account_balance_sum = bs[0].s;
    console.log(`LEDGER_COUNT label=${label} ledger_entry=${le[0].n} account=${ac[0].n} balance_sum=${bs[0].s}`);
  } catch (e) {
    const err = e as { code?: string; name?: string; message?: string };
    out.error = { name: err.name || null, code: err.code ?? null, message: String(err.message || '').slice(0, 200) };
    console.log(`LEDGER_COUNT label=${label} ERROR=${JSON.stringify(out.error)}`);
    process.exitCode = 1;
  }
  const dir = path.join(REPO, '.p4-artifacts', `p6d1p-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `ledger-count-${label}.json`);
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`ARTIFACT=${file}`);
})();
