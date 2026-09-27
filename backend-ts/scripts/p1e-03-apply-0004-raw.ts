/**
 * P1e · 把 0004 的 SQL 直接灌进真库（**迭代用**：绕过 migrate.ts 的 checksum 登记）
 * ----------------------------------------------------------------------------
 * 用途：0004 定稿前反复 CREATE OR REPLACE 迭代，避免「先登记后改文件 ⇒ checksum drift」。
 * 定稿后必须再跑一次 `npx ts-node --transpile-only scripts/migrate.ts` 正式登记版本行。
 *
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1e-03-apply-0004-raw.ts
 * 说明：所有语句都是 CREATE OR REPLACE FUNCTION，可重复执行；不写入 schema_migration。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const FILE = path.resolve(__dirname, '..', 'migrations', '0004_ledger_post_event.sql');

/** 按 dollar-quote 终止符 `$$;` / `$fn$;` 扫描切分（本文件所有语句都是函数定义） */
const splitStatements = (sql: string): string[] => {
  const out: string[] = [];
  let cursor = 0;
  const re = /(\$\$|(\$fn\$));/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const end = m.index + m[0].length;
    const stmt = sql.slice(cursor, end).trim();
    if (stmt) out.push(stmt);
    cursor = end;
  }
  const tail = sql.slice(cursor).trim();
  if (tail && !/^--/.test(tail)) out.push(tail);
  return out;
};

(async () => {
  const sql = fs.readFileSync(FILE, 'utf8');
  const stmts = splitStatements(sql);
  const pool = new Pool({ connectionString: url, max: 2 });
  const client = await pool.connect();
  const report: Array<Record<string, unknown>> = [];
  let failed = 0;
  try {
    for (let i = 0; i < stmts.length; i += 1) {
      const s = stmts[i];
      const name = (s.match(/FUNCTION\s+([a-z_]+)/i) || [, '?'])[1];
      const t0 = Date.now();
      try {
        await client.query(s);
        report.push({ i: i + 1, fn: name, ok: true, ms: Date.now() - t0 });
      } catch (e) {
        failed += 1;
        const anyE = e as Record<string, unknown>;
        report.push({
          i: i + 1, fn: name, ok: false,
          message: String(anyE?.message || e).slice(0, 500),
          code: anyE?.code ?? null,
          hint: anyE?.hint ?? null,
          where: String(anyE?.where ?? '').slice(0, 200),
          position: anyE?.position ?? null,
          source_excerpt: s.split('\n').slice(0, 6).join(' | ').slice(0, 200),
        });
      }
    }
    const fns = await client.query(
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE 'ledger%' ORDER BY 1`);
    console.log(JSON.stringify({
      file: FILE, statements: stmts.length, failed,
      steps: report,
      ledger_functions: fns.rows,
    }, null, 2));
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('APPLY FAILED:', (e as Error)?.stack ?? e);
  process.exit(2);
});
