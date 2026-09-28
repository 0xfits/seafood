/**
 * P3-L · 探针 04：同版本重放**执行**（DL49：无 down 迁移 ⇒ 同版本重放是修正后重放的唯一合法路径）
 *
 * 授权：Zang 已裁定授权同版本重放（不新建版本号 / 不前滚 / 不动 0001–0014 字节与行）。
 * 前置：探针 03 已核（现取）本片残迹为 0 ⇒ 可安全 DROP。
 * 闸（判别量 = **本片独占命名空间**，不用 ref_type 这类跨片共用列）：
 *   · ledger_entry.event_root_key LIKE 'biz:listing:%' == 0
 *   · listing.ledger_event_keys 非空 == 0
 *   · listing_order 行数 == 0
 *   · 指向 listing* 的外键只有 listing_order→listing（两新表之间，无外部表 FK）
 * 任一不满足 ⇒ **拒绝重放并报告**。
 *
 * 动作（单事务，原子）：DELETE schema_migration 的 0015 行 → DROP TABLE listing_order/listing（连带行=清残迹）
 *   → DROP FUNCTION 0015 自建 14 个。COMMIT 后由 `scripts/migrate.ts` 以 v2 干净应用。
 *
 * 用法：P3L_RUN=<tag> npx ts-node --transpile-only scripts/p3l-04-replay-apply.ts <check|apply>
 */
import { mkPool, raw, raw1, save, errInfo, RUN, REPO } from './p3l-lib';
import * as fs from 'fs';
import * as path from 'path';

const MODE = process.argv[2] === 'apply' ? 'apply' : 'check';
const FILE = path.join(REPO, 'migrations', '0015_listing.sql');

const FN_NAMES = [
  'listing_status_transition_ok', 'listing_order_status_transition_ok',
  'listing_status_guard', 'listing_stock_guard', 'listing_create_key_guard',
  'listing_touch_time_updated', 'listing_no_delete',
  'listing_order_status_guard', 'listing_order_core_immutable_guard',
  'listing_order_create_key_guard', 'listing_order_ledger_ref_guard',
  'listing_order_touch_time_updated', 'listing_order_no_delete',
  'listing_post_event',
];
const TRG_NAMES = [
  'trg_listing_create_key_guard', 'trg_listing_status_guard', 'trg_listing_stock_guard',
  'trg_listing_touch_time_updated', 'trg_listing_no_delete',
  'trg_listing_order_core_immutable_guard', 'trg_listing_order_create_key_guard',
  'trg_listing_order_ledger_ref_guard', 'trg_listing_order_status_guard',
  'trg_listing_order_touch_time_updated', 'trg_listing_order_no_delete',
];
const OTHER_TABLES = ['users', 'job', 'job_application', 'job_submission', 'currency', 'commission_policy', 'account', 'ledger_entry', 'referral', 'ledger_owner', 'schema_migration'];

(async () => {
  const pool = mkPool(1);
  try {
    const fileBytes = fs.readFileSync(FILE);
    const fileSha = (await import('crypto')).createHash('sha256').update(fileBytes).digest('hex');

    const snap = async () => {
      const base = {
        registry_rows: (await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.schema_migration'))?.n,
        registry_0015: await raw1(pool, `SELECT version, checksum FROM public.schema_migration WHERE version='0015'`),
        ledger_total: (await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.ledger_entry'))?.n,
        ledger_ref_listing_order: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE ref_type='listing_order'`))?.n,
        ledger_biz_listing_ns: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:%'`))?.n,
        fn_present: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname = ANY($1::text[])`, [FN_NAMES]))?.n,
        trg_present: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND tg.tgname = ANY($1::text[]) AND NOT tg.tgisinternal`, [TRG_NAMES]))?.n,
        fk_to_listing: await raw(pool, `SELECT c.conname, t.relname AS child, rt.relname AS parent FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class rt ON rt.oid=c.confrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype='f' AND n.nspname='public' AND c.confrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('listing','listing_order')) ORDER BY c.conname`),
        oids: await raw(pool, `SELECT c.relname AS t, c.oid::text AS oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('listing','listing_order')`),
        other_counts: await raw(pool,
          `SELECT 'users' t, count(*)::text n FROM public.users
            UNION ALL SELECT 'account', count(*)::text FROM public.account
            UNION ALL SELECT 'currency', count(*)::text FROM public.currency
            UNION ALL SELECT 'commission_policy', count(*)::text FROM public.commission_policy
            ORDER BY 1`),
      };
      const has = (await raw1<{ b: boolean }>(pool, `SELECT to_regclass('public.listing') IS NOT NULL AS b`))?.b === true
        && (await raw1<{ b: boolean }>(pool, `SELECT to_regclass('public.listing_order') IS NOT NULL AS b`))?.b === true;
      const listingPart = has ? {
        listing_tables_present: true,
        listing_rows: (await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing'))?.n,
        listing_order_rows: (await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order'))?.n,
        listing_with_keys: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.listing WHERE array_length(ledger_event_keys,1) IS NOT NULL`))?.n,
      } : { listing_tables_present: false, listing_rows: null, listing_order_rows: null, listing_with_keys: null };
      return { ...base, ...listingPart };
    };

    const before = await snap();
    // 闸的判别量：本片独占命名空间
    const gate = {
      ledger_biz_listing_ns_must_be_0: before.ledger_biz_listing_ns,
      listing_with_keys_must_be_0: before.listing_with_keys,
      listing_order_rows_must_be_0: before.listing_order_rows,
      fk_external_must_be_none: before.fk_to_listing.filter((f) => f.parent === 'listing' || f.parent === 'listing_order'),
    };
    const safe = before.ledger_biz_listing_ns === '0' && before.listing_with_keys === '0'
      && before.listing_order_rows === '0';

    let action: Record<string, unknown> = { refused: true, reason: 'check-only mode' };
    if (MODE === 'apply') {
      if (!safe) {
        action = { refused: true, reason: 'GATE_NOT_SAFE ⇒ 拒绝重放并上报（本片命名空间非空）' };
      } else {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const del = (await client.query(`DELETE FROM public.schema_migration WHERE version='0015' RETURNING version`)).rows;
          await client.query(`DROP TABLE IF EXISTS public.listing_order CASCADE`);
          await client.query(`DROP TABLE IF EXISTS public.listing CASCADE`);
          const fnDrops: unknown[] = [];
          for (const fn of FN_NAMES) {
            await client.query(`DROP FUNCTION IF EXISTS public.${fn}`);
            fnDrops.push({ fn, dropped: true });
          }
          await client.query('COMMIT');
          action = { refused: false, deleted_migration_rows: del, dropped_tables: ['listing_order', 'listing'], dropped_functions: fnDrops };
        } catch (e) {
          await client.query('ROLLBACK').catch(() => undefined);
          action = { refused: false, rolled_back: true, error: errInfo(e) };
        } finally {
          client.release();
        }
      }
    }

    const after = await snap();
    const LABEL = MODE === 'apply' ? 'replay-apply-exec' : 'replay-check';
    const file = save(LABEL, {
      mode: MODE, repo: REPO,
      file: { path: path.relative(REPO, FILE), sha256: fileSha, bytes: fileBytes.length },
      gate, safe_to_replay: safe, action, before, after,
      untouched_checks: {
        registry_rows_after_must_be_14_when_applied: after.registry_rows,
        registry_0015_after: after.registry_0015,
        ledger_total_before: before.ledger_total, ledger_total_after: after.ledger_total,
        ledger_ref_listing_order_before: before.ledger_ref_listing_order,
        ledger_ref_listing_order_after: after.ledger_ref_listing_order,
        fn_present_after: after.fn_present, trg_present_after: after.trg_present,
      },
    });
    console.log(JSON.stringify({ ok: true, file, mode: MODE, safe_to_replay: safe, action,
      file_sha256: fileSha, before_registry_rows: before.registry_rows,
      after_registry_rows: after.registry_rows, after_registry_0015: after.registry_0015,
      after_fn_present: after.fn_present, after_trg_present: after.trg_present,
      ledger_total_before: before.ledger_total, ledger_total_after: after.ledger_total,
      ledger_ref_before: before.ledger_ref_listing_order, ledger_ref_after: after.ledger_ref_listing_order,
      listing_rows_before: before.listing_rows, listing_order_rows_before: before.listing_order_rows,
      listing_with_keys_before: before.listing_with_keys }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
