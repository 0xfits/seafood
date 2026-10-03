/**
 * R-9-24 迁移真跑自证（P9③ · Kong）· 探针（**放 backend-ts/.p9s3-r9-24/ 目录，不进 scripts/**）。
 * 对每份迁移给出「**单事务内 `BEGIN; <文件全文>; ROLLBACK;`**（**禁 COMMIT**）」四项读数：
 *   (a) 无错（逐字）  (b) 回滚后 `to_regclass` 全 NULL  (c) `schema_migration` 无新行  (d) 目标对象复原
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s3-r9-24/probe.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { getTransactionPool, closePools } from '../src/db';

const MIG = path.resolve(__dirname, '..', 'migrations');
const OUT = path.resolve(__dirname, 'r9-24-reading.json');

type R = Record<string, unknown>;

const main = async () => {
  const pool = getTransactionPool();
  const client = (await pool.connect()) as unknown as {
    query: (t: string, p?: unknown[]) => Promise<{ rows: R[] }>;
    release: () => void;
  };
  const one = async (t: string, p?: unknown[]): Promise<R | undefined> => (await client.query(t, p)).rows[0];
  const readings: R = { generated_at: new Date().toISOString(), migrations: {} };

  const snapCommon = async (): Promise<R> => ({
    schema_migration_rows: Number((await one('SELECT count(*)::int AS n FROM public.schema_migration'))?.n),
    last_version: (await one('SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1'))?.version ?? null,
  });

  // ---------------------------------------------------------------- 0030
  {
    const file = path.join(MIG, '0030_listing_order_status_extend.sql');
    const sql = fs.readFileSync(file, 'utf8');
    const pre = {
      ...(await snapCommon()),
      enum_def: (await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='public.listing_order'::regclass AND conname='listing_order_status_enum'`))?.d ?? null,
      gate_is_paid_only: String((await one(`SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='listing_post_event'`))?.d ?? '').includes("v_order.status <> 'paid'"),
      transition_old: (await one(`SELECT public.listing_order_status_transition_ok('paid','shipped') AS v`))?.v ?? null,
    };
    let err: string | null = null;
    let inTx: R = {};
    await client.query('BEGIN');
    try {
      await client.query(sql);
      inTx = {
        enum_def: (await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='public.listing_order'::regclass AND conname='listing_order_status_enum'`))?.d ?? null,
        gate_widened: String((await one(`SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='listing_post_event'`))?.d ?? '').includes("NOT IN ('paid', 'shipped')"),
        transition_new: (await one(`SELECT public.listing_order_status_transition_ok('paid','shipped') AS a, public.listing_order_status_transition_ok('shipped','refunded') AS b, public.listing_order_status_transition_ok('received','refunded') AS c`)) ?? null,
        schema_migration_rows: Number((await one('SELECT count(*)::int AS n FROM public.schema_migration'))?.n),
      };
    } catch (e) {
      err = String((e as Error)?.message || e).slice(0, 300);
    }
    await client.query('ROLLBACK');
    const post = {
      ...(await snapCommon()),
      enum_def: (await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='public.listing_order'::regclass AND conname='listing_order_status_enum'`))?.d ?? null,
      gate_is_paid_only: String((await one(`SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='listing_post_event'`))?.d ?? '').includes("v_order.status <> 'paid'"),
      transition_old: (await one(`SELECT public.listing_order_status_transition_ok('paid','shipped') AS v`))?.v ?? null,
      to_regclass: (await one(`SELECT to_regclass('public.listing_order_status_enum')::text AS a`))?.a ?? null,
    };
    (readings.migrations as R)['0030'] = { file: path.basename(file), bytes: Buffer.byteLength(sql), pre, tx: inTx, error: err, post };
  }

  // ---------------------------------------------------------------- 0031
  {
    const file = path.join(MIG, '0031_rating_and_order_event.sql');
    const sql = fs.readFileSync(file, 'utf8');
    const rels = ['public.rating', 'public.listing_order_event'];
    const idx = ['idx_rating_ratee_time', 'idx_rating_target', 'idx_listing_order_event_order_time'];
    const relState = async (): Promise<R> => {
      const r: R = {};
      for (const x of rels) r[x] = (await one(`SELECT to_regclass('${x}')::text AS a`))?.a ?? null;
      for (const x of idx) r[x] = (await one(`SELECT to_regclass('${x}')::text AS a`))?.a ?? null;
      return r;
    };
    const pre = { ...(await snapCommon()), rels: await relState() };
    let err: string | null = null;
    let inTx: R = {};
    await client.query('BEGIN');
    try {
      await client.query(sql);
      inTx = {
        rels: await relState(),
        rating_cols: (await one(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) AS c FROM information_schema.columns WHERE table_schema='public' AND table_name='rating'`))?.c ?? null,
        ev_cols: (await one(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) AS c FROM information_schema.columns WHERE table_schema='public' AND table_name='listing_order_event'`))?.c ?? null,
        schema_migration_rows: Number((await one('SELECT count(*)::int AS n FROM public.schema_migration'))?.n),
      };
    } catch (e) {
      err = String((e as Error)?.message || e).slice(0, 300);
    }
    await client.query('ROLLBACK');
    const post = { ...(await snapCommon()), rels: await relState() };
    (readings.migrations as R)['0031'] = { file: path.basename(file), bytes: Buffer.byteLength(sql), pre, tx: inTx, error: err, post };
  }

  client.release();
  fs.writeFileSync(OUT, JSON.stringify(readings, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(readings, null, 1));
  console.log('WROTE', OUT);
  await closePools();
};

main().catch(async (e) => {
  console.error('PROBE_FATAL', String((e as Error)?.message || e).slice(0, 400));
  await closePools().catch(() => undefined);
  process.exit(2);
});
