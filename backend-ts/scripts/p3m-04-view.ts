/**
 * P3-M-04 · `candle_view` 聚合语义核对（只读）：
 * 把视图行与**独立**的 GROUP BY 聚合（同 bucket 表达式）逐桶对比，并断言 OHLC/volume 口径（DL66）。
 */
import { mkPool, raw, raw1, save, RUN } from './p3m-lib';

const main = async () => {
  const p = mkPool();
  try {
    const fx = await raw1<any>(p, `SELECT cid::text AS cid, symbol, decimals FROM public.currency
       WHERE cid = (SELECT base_cid FROM public.market_trade WHERE buy_order_id IN
                      (SELECT order_id FROM public.market_order WHERE create_key LIKE 'cli:kong16-%')
                    ORDER BY trade_id DESC LIMIT 1)`);
    if (!fx) throw new Error('no fixture trade found — run scripts/p3m-02-cases.ts first');
    const viewRows = await raw<any>(p, `SELECT base_cid::text AS base_cid, quote_cid::text AS quote_cid,
        bucket_start::text AS bucket_start, open::text AS open, high::text AS high, low::text AS low,
        close::text AS close, volume::text AS volume
      FROM public.candle_view WHERE base_cid = $1::bigint ORDER BY bucket_start`, [fx.cid]);
    const manual = await raw<any>(p, `SELECT t.base_cid::text AS base_cid, t.quote_cid::text AS quote_cid,
        date_trunc('minute', t.time_created)::text AS bucket_start,
        (array_agg(t.price ORDER BY t.time_created, t.trade_id))[1]::text AS open,
        max(t.price)::text AS high, min(t.price)::text AS low,
        (array_agg(t.price ORDER BY t.time_created DESC, t.trade_id DESC))[1]::text AS close,
        sum(t.amount)::text AS volume
      FROM public.market_trade t WHERE t.base_cid = $1::bigint
      GROUP BY t.base_cid, t.quote_cid, date_trunc('minute', t.time_created)
      ORDER BY 3`, [fx.cid]);
    const types = await raw(p, `SELECT column_name, data_type, numeric_precision FROM information_schema.columns
       WHERE table_schema='public' AND table_name='candle_view' AND column_name IN ('open','high','low','close','volume','bucket_start')
       ORDER BY column_name`);
    const equal = JSON.stringify(viewRows) === JSON.stringify(manual);
    const artifact = save('view-candles', { run: RUN, fixture_currency: fx, view_rows: viewRows,
      manual_aggregation: manual, view_types: types, view_equals_manual: equal,
      note: 'grouping expression in the view is date_trunc(minute, time_created); the same trade set is 逐桶对比' });
    console.log(JSON.stringify({ artifact, currency: fx, bucketed_rows: viewRows.length,
      view_equals_manual_aggregation: equal, view_types: types,
      sample: viewRows.slice(-3) }, null, 2));
    if (!equal) process.exitCode = 6;
  } finally { await p.end().catch(() => undefined); }
};
main().catch((e) => { console.error('p3m-04 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
