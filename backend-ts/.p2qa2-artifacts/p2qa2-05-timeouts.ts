/** p2qa2-05 · 锁/预算超时默认值（只读） */
import { mkPool, raw, save } from './p2qa2-lib';
(async () => {
  const p = mkPool(2);
  try {
    const defs = await raw(p, `SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('ledger_lock_timeout_ms','ledger_stmt_budget_ms','ledger_budget_remaining_ms','ledger_check_budget','ledger_arm_lock_timeout')`);
    const cfg = await raw(p, `SELECT name, setting, source FROM pg_settings WHERE name IN ('lock_timeout','statement_timeout','default_transaction_isolation')`);
    const probes = await raw(p, `SELECT ledger_lock_timeout_ms()::text AS lock_ms, ledger_stmt_budget_ms()::text AS stmt_ms, current_setting('lock_timeout') AS cur_lock_timeout, current_setting('statement_timeout') AS cur_stmt_timeout`);
    const out = { defs: defs.map((d) => ({ proname: d.proname, prosrc: String(d.prosrc).slice(0, 1200) })), pg_settings: cfg, probes };
    const f = save('p2qa2-05-timeouts', out);
    console.log(JSON.stringify({ file: f, pg_settings: cfg, probes,
      defs_head: out.defs.map((d) => ({ proname: d.proname, head: d.prosrc.replace(/\s+/g, ' ').slice(0, 420) })) }, null, 1));
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
