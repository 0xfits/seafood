import { readQuery, closePools } from '../src/db';
(async () => {
  const dump = (l: string, r: any[]) => { console.log(`\n### ${l} (${r.length})`); r.forEach(x => console.log(JSON.stringify(x))); };
  dump('funcs_prosrc_bare_user_word', await readQuery(`
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           substring(p.prosrc from greatest(1, position('user' in lower(p.prosrc))-100) for 260) AS ctx
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosrc ~* '\\yuser\\y' ORDER BY 1,2`));
  dump('funcs_depending_on_user_rel', await readQuery(`
    SELECT pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent, d.deptype
      FROM pg_depend d WHERE d.refobjid = to_regclass('public.user')::oid AND d.deptype <> 'a' ORDER BY 1`));
  dump('fk_from_public_schema_only', await readQuery(`
    SELECT ns.nspname AS src_schema, src.relname AS src_table, con.conname,
           dns.nspname AS dst_schema, dst.relname AS dst_table, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class src ON src.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=src.relnamespace
      JOIN pg_class dst ON dst.oid=con.confrelid JOIN pg_namespace dns ON dns.oid=dst.relnamespace
     WHERE con.contype='f' AND dns.nspname='public' AND dst.relname IN ('user','users') ORDER BY 1,2`));
  dump('public_objects_named_like_user', await readQuery(`
    SELECT c.relkind, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname LIKE '%user%' ORDER BY 1,2`));
  dump('all_schemas_user_tables', await readQuery(`
    SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('user','users') ORDER BY 1,2`));
  dump('grants_on_user', await readQuery(`
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='user' ORDER BY 1,2`));
})().catch(e => { console.error('fatal', e?.message); process.exitCode=2; }).finally(async()=>{await closePools();});
