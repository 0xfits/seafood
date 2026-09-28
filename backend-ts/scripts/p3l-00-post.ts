/**
 * P3-L · 探针 00：迁移前/后指纹 + 逐列/约束/索引/触发器 + `schema_migration` 第 15 行 + 编排函数指纹
 *
 * 用法：npx ts-node --transpile-only scripts/p3l-00-post.ts
 * 只读：仅 SELECT / 读文件系统；无任何 DDL/DML。
 *
 * 「迁移前」= 11 张基表：由**本单环境真值**（Zang 现取：`schema_version=0014`、`schema_migration` 14 行、
 * `public` 基表 11）＋ 0014 报告 §3.1 的 9→11 递推给出 —— 本探针**不谎称实测了 pre**：
 * 它给出 `oid` 序证据（新建的两张表的 oid **大于**其余 11 张），以此证明「本次只新建了 2 张表、没动既有 11 张」。
 */
import { mkPool, raw, raw1, save, OUT_DIR, RUN, REPO, md5 } from './p3l-lib';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
  const pool = mkPool(1);
  try {
    // ---------------------------------------------------------------- 基表集 + 新建证据（oid 序）
    const baseTables = await raw<{ table_name: string; oid: string }>(pool,
      `SELECT c.relname AS table_name, c.oid::text AS oid
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relispartition = false
          AND c.relname NOT LIKE 'pg_%'
          AND c.oid NOT IN (SELECT inhrelid FROM pg_inherits)
        ORDER BY c.oid`);
    const newTables = ['listing', 'listing_order'];
    const oidOf = (t: string) => baseTables.find((b) => b.table_name === t)?.oid ?? null;
    const minNewOid = BigInt(Math.min(...newTables.map((t) => Number(oidOf(t)))));
    const preExisting = baseTables.filter((b) => !newTables.includes(b.table_name));
    const preAllBelowNew = preExisting.every((b) => BigInt(b.oid) < minNewOid);

    // ---------------------------------------------------------------- 逐列
    const colsOf = async (t: string) => raw(pool,
      `SELECT column_name, data_type, udt_name, is_nullable, column_default,
              is_identity, identity_generation, character_maximum_length,
              numeric_precision, numeric_scale, ordinal_position::text AS ordinal_position
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    const listingCols = await colsOf('listing');
    const orderCols = await colsOf('listing_order');

    // ---------------------------------------------------------------- 约束 / 索引 / 触发器
    const consOf = async (t: string) => raw(pool,
      `SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c JOIN pg_class t2 ON t2.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t2.relnamespace
        WHERE n.nspname='public' AND t2.relname=$1 ORDER BY c.conname`, [t]);
    const idxOf = async (t: string) => raw(pool,
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`, [t]);
    const trgOf = async (t: string) => raw(pool,
      `SELECT tg.tgname, tg.tgenabled, pg_get_triggerdef(tg.oid) AS definition
         FROM pg_trigger tg JOIN pg_class t2 ON t2.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = t2.relnamespace
        WHERE n.nspname='public' AND t2.relname=$1 AND NOT tg.tgisinternal ORDER BY tg.tgname`, [t]);

    const listingCons = await consOf('listing');
    const orderCons = await consOf('listing_order');
    const listingIdx = await idxOf('listing');
    const orderIdx = await idxOf('listing_order');
    const listingTrg = await trgOf('listing');
    const orderTrg = await trgOf('listing_order');
    const partialIdx = [...listingIdx, ...orderIdx].filter((i) => /WHERE/i.test(i.indexdef));

    // ---------------------------------------------------------------- schema_migration 第 15 行 + 版本
    const migRows = await raw(pool,
      `SELECT id::text AS id, version, name, checksum, applied_at::text AS applied_at
         FROM public.schema_migration ORDER BY version`);
    const row15 = migRows.find((r) => r.version === '0015') ?? null;
    const maxVer = await raw1<{ v: string }>(pool,
      `SELECT version AS v FROM public.schema_migration ORDER BY version DESC LIMIT 1`);

    // ---------------------------------------------------------------- 函数指纹（prosrc 字节 + md5）
    const fnFinger = async (fn: string) => {
      const r = await raw1<{ proname: string; args: string; result: string; vol: string; lang: string; bytes: string; chars: string; src: string }>(pool,
        `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
                pg_get_function_result(p.oid) AS result, p.provolatile AS vol, l.lanname AS lang,
                octet_length(p.prosrc)::text AS bytes, length(p.prosrc)::text AS chars, p.prosrc AS src
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           JOIN pg_language l ON l.oid = p.prolang
          WHERE n.nspname='public' AND p.oid = $1::regprocedure`, [fn]);
      if (!r) return null;
      return { fn, args: r.args, result: r.result, volatile: r.vol, language: r.lang,
               prosrc_bytes: Number(r.bytes), prosrc_chars: Number(r.chars), prosrc_md5: md5(r.src) };
    };
    const fns = {
      listing_post_event: await fnFinger('public.listing_post_event(jsonb)'),
      listing_status_transition_ok: await fnFinger('public.listing_status_transition_ok(text,text)'),
      listing_order_status_transition_ok: await fnFinger('public.listing_order_status_transition_ok(text,text)'),
      ledger_post_event: await fnFinger('public.ledger_post_event(jsonb)'),
      job_post_event: await fnFinger('public.job_post_event(jsonb)'),
    };

    // ---------------------------------------------------------------- 不可变指纹（DL142 守护：不许被本单碰到）
    const protectedFingerprint = {
      ledger_post_event_bytes: fns.ledger_post_event?.prosrc_bytes ?? null,
      ledger_post_event_md5: fns.ledger_post_event?.prosrc_md5 ?? null,
      expected_bytes: 45598,
      expected_md5: 'd94dd902697dfe60aba409d808c6d63a',
    };

    // ---------------------------------------------------------------- 残留计数（不属本单范围，只登记）
    const counts = await raw(pool,
      `SELECT 'users' t, count(*)::text n FROM public.users
       UNION ALL SELECT 'job', count(*)::text FROM public.job
       UNION ALL SELECT 'job_application', count(*)::text FROM public.job_application
       UNION ALL SELECT 'job_submission', count(*)::text FROM public.job_submission
       UNION ALL SELECT 'ledger_entry', count(*)::text FROM public.ledger_entry
       UNION ALL SELECT 'currency', count(*)::text FROM public.currency
       UNION ALL SELECT 'commission_policy', count(*)::text FROM public.commission_policy
       UNION ALL SELECT 'listing', count(*)::text FROM public.listing
       UNION ALL SELECT 'listing_order', count(*)::text FROM public.listing_order
       ORDER BY 1`);

    const fileSha = fs.existsSync(path.join(REPO, 'migrations', '0015_listing.sql'))
      ? (await import('crypto')).createHash('sha256').update(fs.readFileSync(path.join(REPO, 'migrations', '0015_listing.sql'))).digest('hex')
      : null;

    const file = save('fingerprint-post', {
      repo: REPO, out_dir: OUT_DIR,
      public_base_tables: baseTables.map((b) => b.table_name),
      public_base_table_count: baseTables.length,
      migration_pre: {
        public_base_table_count: 11,
        schema_version: '0014',
        schema_migration_rows: 14,
        measured_by_this_probe: false,
        source: 'Zang 本单环境真值（现取）; 递推自 0014 报告 §3.1（9→11）',
      },
      migration_post: {
        public_base_table_count: baseTables.length,
        schema_version: maxVer?.v ?? null,
        schema_migration_rows: migRows.length,
        new_tables: newTables,
      },
      oid_evidence: {
        note: '新建对象在 oid 序上位于末尾 ⇒ 本次只**新增** 2 张表，既有 11 张未被重建（重建会换 oid）',
        min_new_oid: minNewOid.toString(),
        oid_listing: oidOf('listing'), oid_listing_order: oidOf('listing_order'),
        pre_existing_all_below_new: preAllBelowNew,
        pre_existing_max_oid: preExisting.reduce((m, b) => (BigInt(b.oid) > BigInt(m) ? b.oid : m), '0'),
        ordered: baseTables.map((b) => `${b.table_name}:${b.oid}`),
      },
      schema_migration_row_15: row15,
      schema_migration_all: migRows.map((r) => ({ version: r.version, name: r.name, checksum: r.checksum, applied_at: r.applied_at })),
      listing_columns: listingCols, listing_column_count: listingCols.length,
      listing_order_columns: orderCols, listing_order_column_count: orderCols.length,
      listing_constraints: listingCons, listing_order_constraints: orderCons,
      listing_indexes: listingIdx, listing_order_indexes: orderIdx,
      partial_unique_indexes: partialIdx.length ? partialIdx : [],
      partial_unique_indexes_note: partialIdx.length ? null : 'DL63 未规定部分唯一索引 ⇒ 本柱无（不是遗漏）',
      listing_triggers: listingTrg, listing_order_triggers: orderTrg,
      trigger_enabled_counts: {
        listing_O: listingTrg.filter((t) => t.tgenabled === 'O').length,
        listing_order_O: orderTrg.filter((t) => t.tgenabled === 'O').length,
        not_O_anywhere: [...listingTrg, ...orderTrg].filter((t) => t.tgenabled !== 'O').map((t) => t.tgname),
      },
      functions: fns,
      protected_fingerprint: protectedFingerprint,
      residual_counts: counts,
      migration_file_sha256: fileSha,
    });
    console.log(JSON.stringify({ ok: true, file, base_tables: baseTables.length,
      row15: row15, protected: protectedFingerprint }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
