/**
 * p3q-02 —— 命名空间/角色键字符串普查（只读）
 * 用途：核实 brief 台账里的 `p3p:` / `neng17:` / `neng*` / `cli:*` / `ops:*` 角色键落在哪个表列。
 * 只读：仅 SELECT。落盘 .p3q-artifacts/p3q-02-ns-scan-<RUN>.{json,txt}
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const RUN = process.env.P3Q_RUN || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
const OUT_DIR = path.resolve(__dirname, '..', '.p3q-artifacts');
const writeArtifact = (name: string, body: string): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  if (fs.existsSync(p)) throw new Error(`REFUSE_OVERWRITE: ${p}`);
  fs.writeFileSync(p, body); return p;
};

const main = async (): Promise<void> => {
  if (!DIRECT_URL) { console.error('FATAL: no DATABASE_URL'); process.exit(2); }
  const pool = new Pool({ connectionString: DIRECT_URL, max: 3, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });
  const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> => (await pool.query(sql, params)).rows as R[];
  const out: Record<string, unknown> = { run: RUN, ts_utc: new Date().toISOString(), mode: 'READ_ONLY' };

  // 全 public 文本列扫描 p3p: / neng17 / neng / cli: / ops:
  const needles = ['p3p:', 'neng17', 'neng', 'cli:', 'ops:'];
  const scan: Array<{ col: string; needle: string; n: number }> = [];
  for (const needle of needles) {
    const rows = await q<{ tbl: string; col: string; n: string }>(
      `SELECT c.table_name AS tbl, c.column_name AS col, count(*)::text AS n
       FROM information_schema.columns c
       WHERE c.table_schema='public' AND c.data_type IN ('text','character varying')
       GROUP BY 1,2 ORDER BY 1,2`);
    for (const r of rows) {
      const hit = await q<{ n: string }>(
        `SELECT count(*)::text AS n FROM public."${r.tbl}" WHERE "${r.col}" LIKE $1`, [`%${needle}%`]);
      const n = Number(hit[0]?.n ?? 0);
      if (n > 0) scan.push({ col: `${r.tbl}.${r.col}`, needle, n });
    }
  }
  out.needle_scan = scan;

  // ledger_owner 全文（4 行）
  out.ledger_owner_rows = await q(`SELECT uid::text AS uid, owner_type, name FROM public.ledger_owner ORDER BY uid`);
  // users.evm 窗口样例
  out.users_window_rows = await q(
    `SELECT uid::text AS uid, evm, is_admin FROM public.users WHERE left(uid::text,4) = ANY($1) ORDER BY uid`,
    [['9903', '9904', '9905', '9906', '9907', '9908']]);
  // account 窗口行（含 cid）
  out.account_window_rows = await q(
    `SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
     FROM public.account WHERE left(uid::text,4) = ANY($1) ORDER BY uid, cid`,
    [['9903', '9904', '9905', '9906', '9907', '9908']]);
  // currency 窗口 owner
  out.currency_window_owners = await q(
    `SELECT cid::text AS cid, symbol, status, owner_uid::text AS owner FROM public.currency
     WHERE left(owner_uid::text,4) = ANY($1) ORDER BY cid`, [['9903', '9904', '9905', '9906', '9907', '9908']]);

  await pool.end();
  const json = JSON.stringify(out, null, 2);
  const jp = writeArtifact(`p3q-02-ns-scan-${RUN}.json`, json);
  const lines: string[] = [`RUN=${RUN}`, `## needle_scan`, ...scan.map((s) => `${s.col} ~ '${s.needle}' => ${s.n}`)];
  lines.push(`## ledger_owner_rows`, ...(out.ledger_owner_rows as any[]).map((r) => JSON.stringify(r)));
  lines.push(`## users_window_rows (${(out.users_window_rows as any[]).length})`, ...(out.users_window_rows as any[]).map((r) => JSON.stringify(r)));
  lines.push(`## account_window_rows (${(out.account_window_rows as any[]).length})`, ...(out.account_window_rows as any[]).map((r) => JSON.stringify(r)));
  lines.push(`## currency_window_owners (${(out.currency_window_owners as any[]).length})`, ...(out.currency_window_owners as any[]).map((r) => JSON.stringify(r)));
  lines.push(`artifact_json=${jp}`);
  const tp = writeArtifact(`p3q-02-ns-scan-${RUN}.txt`, lines.join('\n'));
  console.log(lines.join('\n'));
  console.log(`artifact_txt=${tp}`);
  console.log(`--- EXIT_OK ---`);
};
main().catch((e) => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(2); });
