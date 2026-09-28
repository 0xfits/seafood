/**
 * P3-L · 探针 03：同版本重放**前置自测**（只读，不删不改任何对象/行）
 *
 * 目的：为「同版本重放」提供**现取**（不得转抄）的判别读数：
 *   · registry `0015` 行 checksum vs 迁移文件 sha256
 *   · `listing_order` 行数 / `listing` 行数 / `listing.ledger_event_keys` 非空数
 *   · 本片命名空间 `biz:listing:*` 分录数（期望 0）
 *   · `ref_type='listing_order'` 的历史行按 `event_root_key` 分组枚举（期望全为 `ops:p1e:smoke:*`）
 *   · 指向 `listing*` 的外键全集（contype='f' confrelid IN (listing, listing_order)）
 *   · 0015 自建的函数 / 触发器 / 索引**现取名单**（与文件 grep 名单互拍）
 *   · listing 全量行 dump（重放前留痕）
 *
 * 用法：P3L_RUN=<tag> npx ts-node --transpile-only scripts/p3l-03-replay-prep.ts
 * 只读：仅 SELECT + 读文件系统；无 DDL/DML。
 */
import { mkPool, raw, raw1, save, RUN, REPO, sha256, md5 } from './p3l-lib';
import * as fs from 'fs';
import * as path from 'path';

const FILE = path.join(REPO, 'migrations', '0015_listing.sql');

// 0015 自建对象名单（由**文件 grep 现取**，见报告 §2/§3；此处再由 DB 侧现取互拍）
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
const IDX_NAMES = ['idx_listing_status_time', 'idx_listing_seller', 'idx_listing_order_buyer', 'idx_listing_order_listing'];

(async () => {
  const pool = mkPool(1);
  try {
    const fileBytes = fs.readFileSync(FILE);
    const fileSha = sha256(fileBytes);

    const registry = await raw(pool,
      `SELECT version, name, checksum, applied_at::text AS applied_at
         FROM public.schema_migration ORDER BY version`);

    const counts = await raw(pool,
      `SELECT 'listing_order' t, count(*)::text n FROM public.listing_order
        UNION ALL SELECT 'listing', count(*)::text FROM public.listing
        UNION ALL SELECT 'listing_with_keys', count(*)::text FROM public.listing
          WHERE array_length(ledger_event_keys, 1) IS NOT NULL
        UNION ALL SELECT 'ledger_entry_total', count(*)::text FROM public.ledger_entry
        UNION ALL SELECT 'ledger_biz_listing_ns', count(*)::text FROM public.ledger_entry
          WHERE event_root_key LIKE 'biz:listing:%'
        UNION ALL SELECT 'ledger_ref_type_listing_order', count(*)::text FROM public.ledger_entry
          WHERE ref_type = 'listing_order'
        ORDER BY 1`);

    // ref_type='listing_order' 的历史行按 event_root_key 分组
    const refGroups = await raw(pool,
      `SELECT event_root_key, ref_type, kind, count(*)::text AS n
         FROM public.ledger_entry WHERE ref_type = 'listing_order'
        GROUP BY event_root_key, ref_type, kind ORDER BY event_root_key, kind`);
    const refRows = await raw(pool,
      `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, kind, ref_type,
              ref_id::text AS ref_id, delta::text AS delta, frozen_delta::text AS frozen_delta,
              event_root_key, time_created::text AS time_created
         FROM public.ledger_entry WHERE ref_type = 'listing_order' ORDER BY txid`);

    // 指向 listing* 的外键全集
    const fkTo = await raw(pool,
      `SELECT c.conname, c.contype, t.relname AS child_table, rt.relname AS parent_table,
              c.confdeltype, pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_class rt ON rt.oid = c.confrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f' AND n.nspname = 'public'
          AND c.confrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace
                                AND relname IN ('listing','listing_order'))
        ORDER BY c.conname`);
    const fkFrom = await raw(pool,
      `SELECT c.conname, t.relname AS child_table, rt.relname AS parent_table,
              pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_class rt ON rt.oid = c.confrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f' AND n.nspname = 'public'
          AND c.conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace
                               AND relname IN ('listing','listing_order'))
        ORDER BY c.conname`);

    // 现取对象名单
    const fns = await raw(pool,
      `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
              pg_get_function_result(p.oid) AS result, l.lanname AS lang, p.provolatile AS vol,
              octet_length(p.prosrc)::text AS bytes, md5(p.prosrc) AS md5
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname='public' AND p.proname = ANY($1::text[]) ORDER BY p.proname`, [FN_NAMES]);
    const trgs = await raw(pool,
      `SELECT tg.tgname, c.relname AS on_table, tg.tgenabled,
              pg_get_triggerdef(tg.oid) AS definition
         FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND tg.tgname = ANY($1::text[]) AND NOT tg.tgisinternal
        ORDER BY tg.tgname`, [TRG_NAMES]);
    const idxs = await raw(pool,
      `SELECT indexname, tablename, indexdef FROM pg_indexes
        WHERE schemaname='public' AND indexname = ANY($1::text[]) ORDER BY indexname`, [IDX_NAMES]);

    // 夹具命名空间基座（users/currency 形状）
    const usersCols = await raw(pool,
      `SELECT a.attname, a.attidentity, a.attnotnull, format_type(a.atttypid, a.atttypmod) AS type
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname='users' AND a.attnum>0 AND NOT a.attisdropped
        ORDER BY a.attnum`);
    const currencyCols = await raw(pool,
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='currency' ORDER BY ordinal_position`);
    const cid1 = await raw1(pool, `SELECT * FROM public.currency WHERE cid = 1`);

    // listing 全量行 dump（重放前留痕）
    const listingDump = await raw(pool,
      `SELECT listing_id::text AS listing_id, seller_uid::text AS seller_uid, cid::text AS cid,
              price::text AS price, stock, title, description, media_urls, status, create_key,
              ledger_event_keys, time_created::text AS time_created, time_updated::text AS time_updated
         FROM public.listing ORDER BY listing_id`);
    const orderDump = await raw(pool,
      `SELECT * FROM public.listing_order ORDER BY order_id`);

    const reg15 = registry.find((r) => r.version === '0015') ?? null;
    const dbFnNames = fns.map((f) => f.proname).sort();
    const dbTrgNames = trgs.map((t) => t.tgname).sort();

    const file = save('replay-prep', {
      repo: REPO,
      file: { path: path.relative(REPO, FILE), bytes: fileBytes.length, sha256: fileSha, md5: md5(fileBytes) },
      registry_0015: reg15,
      registry_rows: registry.length,
      registry_all: registry,
      counts: Object.fromEntries(counts.map((c) => [c.t, c.n])),
      drift: { registry_checksum: (reg15 as any)?.checksum ?? null, file_sha256: fileSha,
               equal: ((reg15 as any)?.checksum ?? null) === fileSha },
      ref_type_listing_order_groups: refGroups,
      ref_type_listing_order_rows: refRows,
      fk_pointing_to_listing_tables: fkTo,
      fk_on_listing_tables: fkFrom,
      objects_created_by_0015: {
        functions_from_db: fns, functions_expected: FN_NAMES.slice().sort(),
        functions_ok: JSON.stringify(dbFnNames) === JSON.stringify(FN_NAMES.slice().sort()),
        triggers_from_db: trgs, triggers_expected: TRG_NAMES.slice().sort(),
        triggers_ok: JSON.stringify(dbTrgNames) === JSON.stringify(TRG_NAMES.slice().sort()),
        indexes_from_db: idxs, indexes_expected: IDX_NAMES.slice().sort(),
        indexes_ok: JSON.stringify(idxs.map((i) => i.indexname).sort()) === JSON.stringify(IDX_NAMES.slice().sort()),
      },
      users_columns: usersCols, currency_columns: currencyCols, currency_cid1: cid1,
    });
    const dump = save('listing-dump', {
      note: '同版本重放前对 public.listing / public.listing_order 的全量行留痕（DROP TABLE 会连带删行）',
      listing_rows: listingDump.length, listing_rows_dump: listingDump,
      listing_order_rows: orderDump.length, listing_order_rows_dump: orderDump,
      registry_0015_row: reg15,
      file_sha256: fileSha,
    });

    console.log(JSON.stringify({
      ok: true, prep_file: file, dump_file: dump,
      registry_0015_checksum: (reg15 as any)?.checksum ?? null,
      file_sha256: fileSha, drift: ((reg15 as any)?.checksum ?? null) !== fileSha,
      counts: Object.fromEntries(counts.map((c) => [c.t, c.n])),
      ref_listing_order_roots: refGroups.map((g) => `${g.event_root_key}|${g.kind}=${g.n}`),
      fk_to_listing: fkTo.map((f) => `${f.child_table}.${f.conname}->${f.parent_table}`),
      fk_on_listing: fkFrom.map((f) => `${f.child_table}.${f.conname}->${f.parent_table}`),
      functions_ok: JSON.stringify(dbFnNames) === JSON.stringify(FN_NAMES.slice().sort()),
      triggers_ok: JSON.stringify(dbTrgNames) === JSON.stringify(TRG_NAMES.slice().sort()),
      indexes_ok: JSON.stringify(idxs.map((i) => i.indexname).sort()) === JSON.stringify(IDX_NAMES.slice().sort()),
      users_cols: usersCols.map((c) => `${c.attname}:${c.type}${c.attidentity !== '' ? '[' + c.attidentity + ']' : ''}`),
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
