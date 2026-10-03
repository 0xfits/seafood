// P9④ K3 结构面探针（Kong · 只读 · 探针不落 scripts/）
import { readQuery, closePools } from '../src/db';
(async () => {
  try {
    const rows = await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_post_event' AND pronamespace='public'::regnamespace AND pg_get_function_identity_arguments(oid)='payload jsonb'`);
    const src = rows[0]?.src || '';
    const m = src.match(/v_op NOT IN\s*\(([^)]*)\)/);
    const idx = src.indexOf("'burn'");
    console.log('LEN', src.length);
    console.log('OPWL_MATCH', m ? JSON.stringify(m[1]) : 'NULL');
    console.log('BURN_CTX', JSON.stringify(src.slice(Math.max(0, idx - 60), idx + 20)));
    const all = [...src.matchAll(/'burn'/g)].map((x) => x.index);
    console.log('BURN_HITS', all.length);
  } catch (e) { console.log('ERR', (e as Error).message); }
  await closePools().catch(() => {});
})();
