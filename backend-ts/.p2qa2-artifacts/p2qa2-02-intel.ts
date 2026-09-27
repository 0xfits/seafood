/** p2qa2-02 · 只读情报（op 集合 / kind 白名单 / 错误码映射 / NULL 根键行 / 锁超时默认） */
import { mkPool, raw, raw1, save, fnSrc, NET_RETRIES } from './p2qa2-lib';

(async () => {
  const p = mkPool(2);
  try {
    const src = await fnSrc(p);
    const ops = [...new Set([...src.matchAll(/v_op\s*=\s*'([a-z_]+)'/g)].map((m) => m[1]))];
    const opsIn = [...new Set([...src.matchAll(/'([a-z_]+)'\s*IN\s*\([^)]*v_op/g)].map((m) => m[1]))];
    const errMap = await raw(p, `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'ledger%' ORDER BY 1`).then((r) => r.map((x) => x.proname));
    const codes = [...new Set([...src.matchAll(/'?(LD0\d\d)'?/g)].map((m) => m[1]))];
    const nullRoot = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE event_root_key IS NULL`);
    const nullRootSample = await raw(p, `SELECT idempotency_key, txid::text, request_fingerprint, kind
       FROM ledger_entry WHERE event_root_key IS NULL ORDER BY txid LIMIT 5`);
    const kindChecks = await raw(p, `SELECT k AS kind, ledger_kind_ok(k) AS ok, ledger_kind_ok(k,true) AS ok_frozen
       FROM unnest(ARRAY['job_payout','hold','hold_release','mint','job_fee','reversal','purchase','sale','commission']) AS k`);
    const lockDef = await raw(p, `SELECT p.proname, pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('ledger_arm_lock_timeout','ledger_check_budget','ledger_raise')`);
    const cfg = await raw(p, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%config%'`);
    const errRows = await raw(p, `SELECT * FROM ledger_error_code LIMIT 3`).catch(() => []);
    const ld = await raw1<{ v: string }>(p, `SELECT current_setting('transaction_read_only', true) AS v`);
    const tz = await raw1<{ v: string }>(p, `SELECT now()::text AS v`);
    const out = { run: process.env.P2QA2_RUN ?? null, ops_in_source: ops, ops_in_clause: opsIn, codes_seen: codes,
      ledger_functions: errMap, null_event_root_key_rows: Number(nullRoot?.n ?? -1), null_root_sample: nullRootSample,
      kind_whitelist_probe: kindChecks, config_tables: cfg, ledger_error_code_sample: errRows, now: tz?.v ?? null,
      arm_lock_defs: lockDef.map((d) => ({ proname: d.proname, def_len: String(d.def).length })),
      net_retries: NET_RETRIES };
    const f = save('p2qa2-02-intel', out);
    console.log(JSON.stringify({ file: f,
      ops_in_source: out.ops_in_source, codes_seen: out.codes_seen,
      null_event_root_key_rows: out.null_event_root_key_rows, null_root_sample: out.null_root_sample,
      kind_whitelist_probe: out.kind_whitelist_probe, ledger_functions: out.ledger_functions,
      config_tables: out.config_tables, now: out.now }, null, 1));
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
