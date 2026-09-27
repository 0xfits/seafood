/** p2qa2-07b · 直接 dump 变体 prosrc 里闸前 120 字符，定位 V3 注入落点 */
import { mkPool, raw1, save, beginTx, raw } from './p2qa2-lib';
(async () => {
  const p = mkPool(2);
  try {
    const row = await raw1<{ def: string }>(p, `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_post_event'
        AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`);
    const def = String((row as { def: string }).def);
    const BM = '0012-REPLAY-PRE-GATE-BEGIN';
    const bmInDef = def.indexOf(BM);
    const gs = def.lastIndexOf('\n', bmInDef);
    const ge = def.indexOf('\n', gs);
    const ins = def.slice(0, ge + 1) + '  UPDATE account SET balance = balance WHERE false;\n' + def.slice(ge + 1);
    const t = await beginTx(p, 60_000);
    try {
      await t.q.query(ins);
      const [r] = await raw<Record<string, unknown>>(t.q, `
        WITH s AS (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                    WHERE n.nspname='public' AND p.proname='ledger_post_event'
                      AND pg_get_function_identity_arguments(p.oid)='payload jsonb')
        SELECT position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc) AS b,
               position('UPDATE account' IN prosrc) AS pos_update,
               substr(prosrc, position('UPDATE account' IN prosrc) - 60, 160) AS ctx
        FROM s`);
      const f = save('p2qa2-07b-v3-dump', { run: process.env.P2QA2_RUN ?? null, def_header: def.slice(0, 130),
        bm_in_def: bmInDef, gs, ge, def_ctx: def.slice(gs - 40, ge + 60), db: r });
      console.log(JSON.stringify({ file: f, db: r,
        bm_in_def: bmInDef, gs, ge, def_ctx: JSON.stringify(def.slice(gs - 40, ge + 60)) }, null, 1));
    } finally { await t.rollback(); }
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
