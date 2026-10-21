/**
 * job 域下线 · 函数体引用扫描（只读）
 * 找出「名字不含 job 但 prosrc 引用 job 表」的函数 —— DROP TABLE ... CASCADE 会连带删除它们
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
(async () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const c = await pool.connect();
  try {
    const rows = (await c.query(
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) args,
              (p.prosrc ~* '\\mjob\\M') hit,
              substring(p.prosrc from 'job') probe
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname !~* 'job' AND p.prosrc ~* 'job'
        ORDER BY p.proname`,
    )).rows;
    console.log(JSON.stringify(rows, null, 2));

    // 依赖 job 表的对象（全类目，pg_depend 反查）
    const deps = (await c.query(
      `SELECT DISTINCT d.classid::regclass::text cls, coalesce(d.objid::regclass::text,'?') obj, r.relname referenced
         FROM pg_depend d JOIN pg_class r ON r.oid=d.refobjid
        WHERE r.relname IN ('job','job_application','job_submission','job_arbitration_log')
          AND d.refclassid='pg_class'::regclass
        ORDER BY 1,2`,
    )).rows;
    console.log('--- pg_depend objects referencing job tables ---');
    console.log(JSON.stringify(deps, null, 2));

    // 序列
    const seqs = (await c.query(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='S' AND c.relname ~* 'job' ORDER BY 1`,
    )).rows;
    console.log('--- sequences ---');
    console.log(JSON.stringify(seqs, null, 2));

    // 其它类型（enum/domain/composite）
    const types = (await c.query(
      `SELECT t.typname, t.typtype FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typname ~* 'job' ORDER BY 1`,
    )).rows;
    console.log('--- types ---');
    console.log(JSON.stringify(types, null, 2));
  } finally { c.release(); await pool.end(); }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
