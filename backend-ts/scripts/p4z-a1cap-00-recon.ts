// p4z-a1cap-00-recon.ts — A1-CAP **只读侦察**（不改库、不删、不发写请求）
// ============================================================================
// 口径（派单 §② + §5.7）：库内是否已有「审计 / 操作日志」表（只查不造）；A1 成功路径
//   依赖的 `asset` 表是否存在（`database.ts:889 upsertAsset` 写 `asset`，而
//   `database.ts:861 getUserAsset` 读 `account`）；cid=1 账户候选（夹具 uid 选择用）。
// 用法：node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-a1cap-00-recon.ts <outDirAbs>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'a1cap-recon'));
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
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));
const sql = async <T = Record<string, unknown>>(q: string): Promise<T[]> => {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try { return (await sqlRaw(q)) as T[]; } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw last;
};

const out: Record<string, unknown> = { run: path.basename(outDir) };

(async () => {
  out.tables = await sql(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
  out.audit_like_tables = await sql(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public'
       AND (table_name ILIKE '%audit%' OR table_name ILIKE '%log%' OR table_name ILIKE '%history%' OR table_name ILIKE '%journal%')
     ORDER BY 1`);
  out.audit_like_columns = await sql(
    `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'
       AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema='public'
         AND (table_name ILIKE '%audit%' OR table_name ILIKE '%log%' OR table_name ILIKE '%history%' OR table_name ILIKE '%journal%'))
     ORDER BY table_name, ordinal_position`);
  const names = (out.tables as Array<{ table_name: string }>).map((t) => t.table_name);
  out.asset_table_exists = names.includes('asset');
  if (out.asset_table_exists) {
    out.asset_columns = await sql(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='asset' ORDER BY ordinal_position`);
    out.asset_rowcount = await sql(`SELECT count(*)::int AS n FROM asset`);
  }
  out.account_cid1 = await sql(`SELECT uid::text AS uid, balance::text AS bal, frozen::text AS frz FROM account WHERE cid = 1 AND uid > 0 ORDER BY uid LIMIT 15`);
  out.account_cid1_tail = await sql(`SELECT uid::text AS uid, balance::text AS bal, frozen::text AS frz FROM account WHERE cid = 1 AND uid > 900000 ORDER BY uid LIMIT 15`);
  out.sigma = await sql(`SELECT COALESCE(sum(balance+frozen),0)::text AS sigma, COALESCE(sum(balance),0)::text AS sbal, COALESCE(sum(frozen),0)::text AS sfrz FROM account`);
  out.ledger_entry_count = await sql(`SELECT count(*)::int AS n FROM ledger_entry`);
  out.user_admin_cols = await sql(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
  out.kinds = await sql(`SELECT kind, count(*)::int AS n FROM ledger_entry GROUP BY kind ORDER BY 1`);
  out.errors = 'none';
  fs.writeFileSync(path.join(outDir, 'recon.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: true, outDir, keys: Object.keys(out) }));
})().catch(async (e) => {
  out.errors = String(e).slice(0, 400);
  fs.writeFileSync(path.join(outDir, 'recon.json'), JSON.stringify(out, null, 2));
  console.error('RECON_ERROR', String(e).slice(0, 400));
  process.exitCode = 2;
});
