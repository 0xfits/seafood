/**
 * P1g · 改名后物理核对（只读）
 */
import { readQuery, closePools } from '../src/db';
(async () => {
  const dump = (l: string, r: any[]) => { console.log(`\n### ${l} (${r.length})`); r.forEach(x => console.log(JSON.stringify(x))); };

  dump('public_base_tables', await readQuery(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`));

  dump('old_name_gone_in_information_schema', await readQuery(`
    SELECT count(*)::text AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_name='user'`));

  dump('new_name_present_in_information_schema', await readQuery(`
    SELECT count(*)::text AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_name='users'`));

  dump('count_users', await readQuery(`SELECT count(*)::text AS n FROM "users"`));

  dump('pg_class_user_objects', await readQuery(`
    SELECT c.relkind, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND (c.relname LIKE '%user%' OR c.relname LIKE '%users%') ORDER BY 1,2`));

  dump('constraints_on_users', await readQuery(`
    SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='users' ORDER BY 2,1`));

  dump('indexes_on_users', await readQuery(`
    SELECT i.relname AS index_name, x.indisprimary, x.indisunique, pg_get_indexdef(x.indexrelid) AS def
      FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid
      JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='users' ORDER BY 1`));

  dump('sequence_of_users', await readQuery(`
    SELECT a.attname, a.attidentity, pg_get_serial_sequence('public.users', a.attname) AS seq
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='users' AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`));

  dump('columns_of_users', await readQuery(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`));

  dump('fk_into_public_users', await readQuery(`
    SELECT src.relname AS src, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class src ON src.oid=con.conrelid JOIN pg_namespace s ON s.oid=src.relnamespace
      JOIN pg_class dst ON dst.oid=con.confrelid JOIN pg_namespace d ON d.oid=dst.relnamespace
     WHERE con.contype='f' AND d.nspname='public' AND dst.relname='users'`));

  dump('neon_auth_untouched', await readQuery(`
    SELECT table_schema, table_name FROM information_schema.tables
     WHERE table_name IN ('user','users') ORDER BY 1,2`));

  dump('funcs_prosrc_quoted_user', await readQuery(`
    SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosrc LIKE '%"user"%'`));

  dump('schema_migration', await readQuery(`SELECT version, name FROM schema_migration ORDER BY version`));

  // 保留字陷阱 · 改名后实测（两口径对照）
  const cnt = await readQuery<{ quoted_users: string; bare_user: string; quoted_old: string | null }>(`
    SELECT (SELECT count(*) FROM "users")::text AS quoted_users,
           (SELECT count(*) FROM user)::text     AS bare_user`);
  dump('trap_post_rename', cnt as unknown as any[]);

  // 旧写法现在报什么错（用于报告）
  try {
    await readQuery(`SELECT count(*) FROM "user"`);
    dump('old_quoted_form', [{ result: 'NO ERROR (unexpected)' }]);
  } catch (e) {
    dump('old_quoted_form', [{ error: String((e as any)?.message || e), code: (e as any)?.code ?? null }]);
  }
  try {
    await readQuery(`SELECT count(*) FROM users`);
    dump('new_bare_form', [{ result: 'OK (unquoted users works — not a reserved word)' }]);
  } catch (e) {
    dump('new_bare_form', [{ error: String((e as any)?.message || e) }]);
  }
})().catch(e => { console.error('postrename fatal:', String((e as Error)?.message || e)); process.exitCode = 2; })
  .finally(async () => { await closePools(); });
