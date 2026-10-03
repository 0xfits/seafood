/**
 * L0 现取（只读）：schema 版本 / 基础表数 / 两新表列集·约束·索引·触发器 /
 * listing_order_status_enum / 活体 transition_ok / p8-s7 HTTP actor 现状。
 * 零写：仅 readQuery（pooler 单语句只读）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.join(__dirname, '..', '.p9s3qa-artifacts');
fs.mkdirSync(OUT, { recursive: true });
const out: Record<string, unknown> = { run: RUN };

(async () => {
  const one = async <T = Record<string, unknown>>(q: string, p?: unknown[]): Promise<T | undefined> =>
    (await readQuery<T>(q, p))[0];

  out.schema_version = (await one<{ v: string | null }>(
    `SELECT max(version) AS v FROM public.schema_migration`))?.v;
  out.schema_migration_rows = Number((await one<{ n: string }>(
    `SELECT count(*)::int AS n FROM public.schema_migration`))?.n);
  out.base_tables = Number((await one<{ n: string }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`))?.n);

  // 两新表列集（逐字列序）
  out.rating_cols = (await readQuery<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='rating' ORDER BY ordinal_position`)).map((r) => r.column_name);
  out.event_cols = (await readQuery<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='listing_order_event' ORDER BY ordinal_position`)).map((r) => r.column_name);

  // 约束
  out.rating_cons = await readQuery(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.rating'::regclass ORDER BY conname`);
  out.event_cons = await readQuery(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.listing_order_event'::regclass ORDER BY conname`);
  // 索引
  out.rating_idx = (await readQuery<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='rating' ORDER BY indexname`)).map((r) => r.indexname);
  out.event_idx = (await readQuery<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='listing_order_event' ORDER BY indexname`)).map((r) => r.indexname);
  // 触发器
  out.rating_trg = await readQuery(
    `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.rating'::regclass ORDER BY tgname`);
  out.event_trg = await readQuery(
    `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.listing_order_event'::regclass ORDER BY tgname`);

  // 状态集
  out.status_enum_def = (await one<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.listing_order'::regclass AND conname='listing_order_status_enum'`))?.def;

  // 活体 transition_ok 矩阵
  out.transition_ok = await one(
    `SELECT public.listing_order_status_transition_ok('created','paid') AS created_paid,
            public.listing_order_status_transition_ok('shipped','received') AS shipped_received,
            public.listing_order_status_transition_ok('shipped','refunded') AS shipped_refunded,
            public.listing_order_status_transition_ok('received','refunded') AS received_refunded,
            public.listing_order_status_transition_ok('created','received') AS created_received,
            public.listing_order_status_transition_ok('created','cancelled') AS created_cancelled,
            public.listing_order_status_transition_ok('paid','shipped') AS paid_shipped,
            public.listing_order_status_transition_ok('paid','refunded') AS paid_refunded`);

  // p8-s7 HTTP actor 现状（决定带实例腿是否零净写）
  const actor = await one<{ uid: string }>(
    `SELECT u.uid::text AS uid FROM public.users u
      WHERE u.is_admin IS NOT TRUE AND NOT EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid=u.uid)
        AND COALESCE((SELECT a.balance FROM public.account a WHERE a.uid=u.uid AND a.cid=1),0) >= 100
      ORDER BY u.uid LIMIT 1`);
  out.p8s7_actor = actor?.uid ?? null;
  if (actor) {
    out.p8s7_actor_checkedin_today = Number((await one<{ n: string }>(
      `SELECT count(*)::int AS n FROM public.checkin_log WHERE uid=$1::bigint AND checkin_day=(now() AT TIME ZONE 'UTC')::date`, [actor.uid]))?.n);
    out.p8s7_actor_makeup_today = Number((await one<{ n: string }>(
      `SELECT count(*)::int AS n FROM public.checkin_makeup_log WHERE uid=$1::bigint AND makeup_day=(now() AT TIME ZONE 'UTC')::date`, [actor.uid]))?.n);
    out.p8s7_actor_makeup_applied_target = Number((await one<{ n: string }>(
      `SELECT count(*)::int AS n FROM public.checkin_makeup_log WHERE uid=$1::bigint AND result='applied'`, [actor.uid]))?.n);
  }
  out.today_utc = (await one<{ d: string }>(`SELECT (now() AT TIME ZONE 'UTC')::date::text AS d`))?.d;
  out.us_holiday_probe = null;
  // 计数快照（零净写基线）
  out.counts = {
    rating: Number((await one<{ n: string }>(`SELECT count(*)::int AS n FROM public.rating`))?.n),
    event: Number((await one<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order_event`))?.n),
    listing_order: Number((await one<{ n: string }>(`SELECT count(*)::int AS n FROM public.listing_order`))?.n),
    schema_migration: Number((await one<{ n: string }>(`SELECT count(*)::int AS n FROM public.schema_migration`))?.n),
  };

  const text = JSON.stringify(out, null, 1);
  fs.writeFileSync(path.join(OUT, `l0-schema-${RUN}.json`), text + '\n', 'utf8');
  console.log(text);
  await closePools();
  process.exit(0);
})().catch(async (e) => {
  console.error('L0_FATAL', String((e as Error)?.stack || e).slice(0, 500));
  await closePools().catch(() => undefined);
  process.exit(2);
});
