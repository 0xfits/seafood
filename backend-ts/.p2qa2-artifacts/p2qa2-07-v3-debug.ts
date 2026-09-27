/** p2qa2-07 · V3 为何没判负——直接复算 §C ④ 的正则（在回滚事务里） */
import { mkPool, raw1, save, beginTx, raw } from './p2qa2-lib';

(async () => {
  const p = mkPool(2);
  try {
    const row = await raw1<{ def: string }>(p, `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_post_event'
        AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`);
    const def = String((row as { def: string }).def);
    const BM = '0012-REPLAY-PRE-GATE-BEGIN';
    const gs = def.lastIndexOf('\n', def.indexOf(BM));
    const ge = def.indexOf('\n', gs);
    const injected = def.slice(0, ge + 1) + '  UPDATE account SET balance = balance WHERE false;\n' + def.slice(ge + 1);

    const t = await beginTx(p, 60_000);
    try {
      await t.q.query(injected);
      const [r] = await raw<Record<string, unknown>>(t.q, `
        WITH s AS (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                    WHERE n.nspname='public' AND p.proname='ledger_post_event'
                      AND pg_get_function_identity_arguments(p.oid)='payload jsonb')
        SELECT
          position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc) AS b,
          position('0012-REPLAY-PRE-GATE-END' IN prosrc) AS e,
          length(substr(prosrc, position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc),
                        position('0012-REPLAY-PRE-GATE-END' IN prosrc) - position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc))) AS win_len,
          position('UPDATE account' IN prosrc) AS pos_update,
          (regexp_replace(substr(prosrc, position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc),
             position('0012-REPLAY-PRE-GATE-END' IN prosrc) - position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc)),
             '--[^' || chr(10) || ']*', ' ', 'g')
            ~* '(insert[[:space:]]|update[[:space:]]|delete[[:space:]]|for update|for share|lock table|set constraints)') AS readonly_violation,
          substr(regexp_replace(substr(prosrc, position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc),
             position('0012-REPLAY-PRE-GATE-END' IN prosrc) - position('0012-REPLAY-PRE-GATE-BEGIN' IN prosrc)),
             '--[^' || chr(10) || ']*', ' ', 'g'), 1, 400) AS code_head
        FROM s`);
      const out = { run: process.env.P2QA2_RUN ?? null, injected_at: gs, injected_context: def.slice(gs - 60, ge + 120), db: r };
      const f = save('p2qa2-07-v3-debug', out);
      console.log(JSON.stringify({ file: f, db: r }, null, 1));
    } finally { await t.rollback(); }
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
