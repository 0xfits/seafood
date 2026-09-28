/**
 * P3-M-01 · 迁移后指纹（只读）：逐列 / 逐约束 / 逐索引（含 indexdef）/ 触发器 tgenabled /
 * registry 第 16 行 / prosrc 字节 + md5 / 视图列 / 命名空间与外来行审计。
 */
import { mkPool, raw, raw1, save, md5, RUN } from './p3m-lib';

const main = async () => {
  const p = mkPool();
  try {
    const registry = await raw(
      p, `SELECT version, name, checksum, md5(checksum) AS checksum_md5, applied_at::text AS applied_at
            FROM public.schema_migration ORDER BY version`,
    );
    const row16 = registry.filter((r: any) => r.version === '0016');
    const tables = await raw(p, `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
    const views = await raw(p, `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`);

    const colOf = async (t: string) => raw(
      p, `SELECT column_name, data_type, is_nullable, column_default, identity_generation, ordinal_position
            FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    const marketOrderCols = await colOf('market_order');
    const marketTradeCols = await colOf('market_trade');
    const candleViewCols = await colOf('candle_view');

    const cons = await raw(
      p, `SELECT c.conrelid::regclass::text AS tbl, c.conname, c.contype,
                 pg_get_constraintdef(c.oid) AS def
            FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
           WHERE n.nspname='public' AND r.relname IN ('market_order','market_trade','candle_view')
           ORDER BY 1, 3, 2`,
    );
    const idx = await raw(
      p, `SELECT tablename, indexname, indexdef FROM pg_indexes
           WHERE schemaname='public' AND tablename IN ('market_order','market_trade')
           ORDER BY tablename, indexname`,
    );
    const partialUnique = await raw(
      p, `SELECT tablename, indexname, indexdef FROM pg_indexes
           WHERE schemaname='public' AND tablename IN ('market_order','market_trade')
             AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%WHERE%'`,
    );
    const trg = await raw(
      p, `SELECT t.tgrelid::regclass::text AS tbl, t.tgname, t.tgenabled,
                 pg_get_triggerdef(t.oid) AS def
            FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace
           WHERE n.nspname='public' AND NOT t.tgisinternal AND r.relname IN ('market_order','market_trade')
           ORDER BY 1, 2`,
    );
    const prose = async (name: string) => {
      const r = await raw1<{ bytes: number; md5: string; chars: number }>(
        p, `SELECT octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5, length(p.prosrc) AS chars
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname=$1 LIMIT 1`, [name]);
      return r;
    };
    const fnFingerprints: Record<string, unknown> = {};
    for (const f of ['ledger_post_event', 'market_post_event', 'market_order_status_transition_ok',
      'market_order_status_guard', 'market_trade_append_only']) {
      fnFingerprints[f] = await prose(f);
    }
    const extFk = await raw(
      p, `SELECT c.conname, r.relname AS from_table, c.confrelid::regclass::text AS to_table
            FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
           WHERE n.nspname='public' AND c.contype='f'
             AND c.confrelid IN ('public.market_order'::regclass, 'public.market_trade'::regclass)
           ORDER BY 2, 1`,
    );
    const ledgerFk = await raw1(
      p, `SELECT count(*)::text AS n FROM pg_constraint c
           WHERE c.conrelid IN ('public.market_order'::regclass,'public.market_trade'::regclass)
             AND c.contype='f' AND c.confrelid='public.ledger_entry'::regclass`,
    );
    const ns = await raw1(p, `SELECT
        (SELECT count(*) FROM public.market_order) AS market_order_rows,
        (SELECT count(*) FROM public.market_trade) AS market_trade_rows,
        (SELECT count(*) FROM public.market_order WHERE create_key NOT LIKE 'cli:kong16-%') AS foreign_order_rows,
        (SELECT count(*) FROM public.market_order WHERE owner_uid NOT BETWEEN 990501 AND 990599) AS foreign_order_owners,
        (SELECT count(*) FROM public.market_trade WHERE taker_uid NOT BETWEEN 990501 AND 990599) AS foreign_trade_takers,
        (SELECT count(*) FROM public.ledger_entry WHERE event_root_key LIKE 'biz:market%') AS biz_market_entries,
        (SELECT count(*) FROM public.ledger_entry WHERE event_root_key LIKE 'cli:kong16-%') AS cli_kong16_entries,
        (SELECT count(*) FROM public.ledger_entry WHERE event_root_key LIKE 'ops:p3m:%') AS ops_p3m_entries,
        (SELECT count(*)::text FROM public.ledger_entry) AS ledger_total`);
    const cid1 = await raw1(p, `SELECT
        (SELECT COALESCE(sum(balance+frozen),0)::text FROM public.account WHERE cid=1) AS sum_bal_frozen,
        (SELECT total_supply::text FROM public.currency WHERE cid=1) AS total_supply,
        (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'O') AS disabled_triggers,
        (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname LIKE 'market%') AS market_functions,
        (SELECT count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS base_tables`);

    const out = {
      run: RUN,
      schema_version: (registry[registry.length - 1] as any).version,
      registry_rows: registry.length,
      registry_row_0016: row16,
      public_base_tables: tables.map((t: any) => t.table_name),
      public_base_table_count: tables.length,
      public_views: views.map((v: any) => v.table_name),
      market_order_columns: marketOrderCols,
      market_trade_columns: marketTradeCols,
      candle_view_columns: candleViewCols,
      market_constraints: cons,
      market_indexes: idx,
      partial_unique_indexes: partialUnique,
      market_triggers: trg,
      function_fingerprints: fnFingerprints,
      external_fks_to_market: extFk,
      fks_to_ledger_entry: ledgerFk,
      namespace_audit: ns,
      invariants: cid1,
    };
    const file = save('fingerprint-post', out);
    console.log(JSON.stringify({
      artifact: file,
      schema_version: out.schema_version,
      registry_rows: out.registry_rows,
      row_0016: row16,
      tables: out.public_base_table_count,
      views: out.public_views,
      market_order_cols: marketOrderCols.length,
      market_trade_cols: marketTradeCols.length,
      candle_view_cols: candleViewCols.length,
      indexes: idx.map((i: any) => i.indexname),
      partial_unique: partialUnique.length,
      triggers: trg.map((t: any) => `${t.tbl}.${t.tgname}=${t.tgenabled}`),
      fn: fnFingerprints,
      external_fks: extFk,
      fks_to_ledger_entry: ledgerFk?.n,
      ns: ns,
      inv: cid1,
    }, null, 2));
  } finally { await p.end().catch(() => undefined); }
};
main().catch((e) => { console.error('p3m-01 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
