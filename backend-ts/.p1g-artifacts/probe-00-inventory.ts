/**
 * P1g · 第一步：DB 侧引用清单（只读，不改任何东西）
 * 目的：把 public."user" 的全部关联对象/依赖顺序地列出来，供 0006 迁移使用。
 */
import { readQuery, closePools } from '../src/db';

type AnyRow = Record<string, unknown>;

const dump = (label: string, rows: AnyRow[]) => {
  console.log(`\n### ${label}  (${rows.length} rows)`);
  for (const r of rows) console.log(JSON.stringify(r));
};

(async () => {
  // 0. 表是否存在
  dump('tables_relkind', await readQuery(`
    SELECT c.relname, c.relkind, CASE WHEN c.relkind IN ('v','m') THEN 'view' END AS note
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN ('user','users') ORDER BY 1`));

  dump('public_base_tables', await readQuery(`
    SELECT table_name, table_type FROM information_schema.tables
     WHERE table_schema='public' ORDER BY 1`));

  // 1. FK 约束（出边：其它表指向 "user"；入边："user" 指向其它表）
  dump('fk_contype_f_all', await readQuery(`
    SELECT con.conname, con.contype,
           src.relname AS src_table, dst.relname AS dst_table,
           pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class src ON src.oid=con.conrelid
      JOIN pg_class dst ON dst.oid=con.confrelid
      JOIN pg_namespace ns ON ns.oid=src.relnamespace
     WHERE con.contype='f' AND (src.relname='user' OR dst.relname='user' OR src.relname='users' OR dst.relname='users')
     ORDER BY 1`));

  // 2. "user" 上的全部约束（PK/UNIQUE/CHECK）
  dump('constraints_on_user', await readQuery(`
    SELECT con.conname, con.contype, con.condeferrable, con.convalidated,
           pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
     WHERE c.relname IN ('user','users') ORDER BY 2,1`));

  // 3. 索引
  dump('indexes_on_user', await readQuery(`
    SELECT i.relname AS index_name, x.indisprimary, x.indisunique,
           pg_get_indexdef(x.indexrelid) AS def
      FROM pg_index x
      JOIN pg_class c ON c.oid=x.indrelid
      JOIN pg_class i ON i.oid=x.indexrelid
     WHERE c.relname IN ('user','users') ORDER BY 1`));

  // 4. 序列 / identity
  dump('identity_and_sequences', await readQuery(`
    SELECT a.attname, a.attidentity, a.attgenerated, pg_get_serial_sequence('public.' || quote_ident(c.relname), a.attname) AS seq
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN ('user','users') AND a.attnum>0 AND NOT a.attisdropped
     ORDER BY a.attnum`));

  dump('sequences_owned_or_named_user', await readQuery(`
    SELECT c.relname AS seqname, d.refobjid::regclass::text AS owned_by, pg_get_serial_sequence('public.user','uid') AS guess
      FROM pg_class c LEFT JOIN pg_depend d ON d.objid=c.oid AND d.deptype IN ('a','i')
     WHERE c.relkind='S' AND c.relname LIKE '%user%' ORDER BY 1`));

  dump('all_public_sequences', await readQuery(`
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' ORDER BY 1`));

  // 5. 触发器（含 internal）
  dump('triggers', await readQuery(`
    SELECT c.relname, t.tgname, t.tgenabled, t.tgisinternal, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE c.relname IN ('user','users') ORDER BY 1,2`));

  // 6. 视图 / 物化视图 引用 public.user
  dump('views_referencing', await readQuery(`
    SELECT c.relname, c.relkind, pg_get_viewdef(c.oid) AS def
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('v','m')
       AND pg_get_viewdef(c.oid) ~ '"user"' ORDER BY 1`));

  // 7. RLS 策略
  dump('rls_policies', await readQuery(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE tablename IN ('user','users') ORDER BY 1,2,3`));

  dump('rls_enabled', await readQuery(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN ('user','users')`));

  // 8. PL/pgSQL 函数体里出现 "user" 的
  dump('functions_with_quoted_user', await readQuery(`
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosrc LIKE '%"user"%' ORDER BY 1,2`));

  dump('function_bodies_matching', await readQuery(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           -- 只截取命中附近的片段
           substring(p.prosrc from greatest(1, position('"user"' in p.prosrc)-90) for 220) AS ctx
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosrc LIKE '%"user"%' ORDER BY 1`));

  // 9. 任何对象定义里出现 "user"/user 的（兜底扫描）
  dump('dependency_graph_on_user', await readQuery(`
    SELECT DISTINCT pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent, d.deptype
      FROM pg_depend d
     WHERE d.refobjid = 'public.user'::regclass OR d.refobjid = to_regclass('public.user')
     ORDER BY 1`).catch(() => [] as AnyRow[]));

  // 10. 行数 + 裸/引号读数对照（保留字陷阱实测）
  const cnt = await readQuery<{ quoted: string; bare: string }>(`
    SELECT (SELECT count(*) FROM "user")::text AS quoted,
           (SELECT count(*) FROM user)::text      AS bare`);
  dump('count_quoted_vs_bare', cnt as unknown as AnyRow[]);

  // 11. 列结构
  dump('columns', await readQuery(`
    SELECT column_name, data_type, is_nullable, column_default,
           is_identity, identity_generation
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name IN ('user','users') ORDER BY table_name, ordinal_position`));

  dump('row_count_user', await readQuery(`SELECT count(*)::text AS n FROM "user"`));
})().catch((e) => {
  console.error('inventory fatal:', String((e as Error)?.message || e));
  process.exitCode = 2;
}).finally(async () => { await closePools(); });
