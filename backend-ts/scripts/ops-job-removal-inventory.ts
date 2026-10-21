/**
 * job 域下线 · 库容清单探针（只读）
 * 输出：全部 job 相关表 / 视图 / 索引 / 触发器 / 函数 / FK / 约束 / 依赖（其它表指向 job 的 FK）
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  '';

const q = async (client: any, sql: string, params: any[] = []) => {
  const r = await client.query(sql, params);
  return r.rows;
};

(async () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    const ver = await q(client, 'SELECT current_database() db, current_user usr');
    const mig = await q(client, 'SELECT version, checksum FROM public.schema_migration ORDER BY version DESC LIMIT 3');
    console.log(JSON.stringify({ db: ver[0], top_migrations: mig }, null, 2));

    const tables = await q(
      client,
      `SELECT c.relname, c.relkind
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
          AND (c.relname ~* 'job')
        ORDER BY c.relname`,
    );
    console.log('--- rels matching job ---');
    console.log(JSON.stringify(tables, null, 2));

    const indexes = await q(
      client,
      `SELECT tablename, indexname, indexdef FROM pg_indexes
        WHERE schemaname='public' AND (indexname ~* 'job' OR tablename ~* 'job')
        ORDER BY tablename, indexname`,
    );
    console.log('--- indexes ---');
    console.log(JSON.stringify(indexes, null, 2));

    const triggers = await q(
      client,
      `SELECT c.relname tbl, t.tgname, p.proname fn
         FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         JOIN pg_proc p ON p.oid=t.tgfoid
         JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND NOT t.tgisinternal
          AND (t.tgname ~* 'job' OR c.relname ~* 'job' OR p.proname ~* 'job')
        ORDER BY c.relname, t.tgname`,
    );
    console.log('--- triggers ---');
    console.log(JSON.stringify(triggers, null, 2));

    const funcs = await q(
      client,
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) args
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname ~* 'job'
        ORDER BY p.proname`,
    );
    console.log('--- functions ---');
    console.log(JSON.stringify(funcs, null, 2));

    const fks = await q(
      client,
      `SELECT con.conname, src.relname src_tbl, dst.relname dst_tbl
         FROM pg_constraint con
         JOIN pg_class src ON src.oid=con.conrelid
         JOIN pg_class dst ON dst.oid=con.confrelid
         JOIN pg_namespace n ON n.oid=src.relnamespace
        WHERE con.contype='f' AND n.nspname='public'
          AND (src.relname ~* 'job' OR dst.relname ~* 'job')
        ORDER BY src.relname, con.conname`,
    );
    console.log('--- FKs touching job ---');
    console.log(JSON.stringify(fks, null, 2));

    // 视图/函数依赖 job 表（反向依赖：非 job 名但引用了 job 表）
    const deps = await q(
      client,
      `SELECT DISTINCT dependent.relname dependent, dependent.relkind, referenced.relname referenced
         FROM pg_depend d
         JOIN pg_rewrite r ON r.oid=d.objid
         JOIN pg_class dependent ON dependent.oid=r.ev_class
         JOIN pg_class referenced ON referenced.oid=d.refobjid
         JOIN pg_namespace n ON n.oid=dependent.relnamespace
        WHERE n.nspname='public' AND referenced.relname ~* 'job' AND dependent.relname !~* 'job'
        ORDER BY 1`,
    );
    console.log('--- non-job named views depending on job ---');
    console.log(JSON.stringify(deps, null, 2));

    // 列名含 job 的其它表
    const cols = await q(
      client,
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_schema='public' AND column_name ~* 'job' AND table_name !~* 'job'
        ORDER BY table_name, column_name`,
    );
    console.log('--- job-named columns on non-job tables ---');
    console.log(JSON.stringify(cols, null, 2));

    // 约束名含 job
    const cons = await q(
      client,
      `SELECT con.conname, c.relname tbl, con.contype FROM pg_constraint con
         JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND (con.conname ~* 'job' OR c.relname ~* 'job')
        ORDER BY c.relname, con.conname`,
    );
    console.log('--- constraints on/with job ---');
    console.log(JSON.stringify(cons, null, 2));

    // 行数
    const cnts: any[] = [];
    for (const t of tables.filter((x: any) => x.relkind === 'r')) {
      const c = await q(client, `SELECT count(*)::bigint n FROM public.${t.relname}`);
      cnts.push({ table: t.relname, rows: c[0].n });
    }
    console.log('--- row counts ---');
    console.log(JSON.stringify(cnts, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error('PROBE FAILED', e);
  process.exit(1);
});
