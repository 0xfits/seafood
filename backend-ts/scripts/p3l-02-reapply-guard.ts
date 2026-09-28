/**
 * P3-L · 探针 02：**同版本重放前置闸**（首版 0015 被本单行为用例判负后走「同版本重放」）
 *
 * 背景（自证缺陷）：首版 `0015_listing.sql` 的 `listing_post_event` 用 `ledger_post_event(op='settle',
 * kind='purchase')` 实现购买 ⇒ 账本把**付款方**建模成 `frozen_delta −n`（冻结释放形态）⇒ 买家无冻结额，
 * 第一次购买即 `LD002 LEDGER_INSUFFICIENT_FROZEN`（与 §7.1「买家 `balance −n`」不符）。
 * 修正 = 改走 `op='entries'` 的两条显式分录（`delta=−n/+n`、`frozen_delta=0`）+ `currency_op='settle'`。
 *
 * 重放前必须**证明**首版未留下任何已提交的账本/业务残迹（否则只能前滚、不能重放）：
 *   · `public.listing_order` 中 `status <> 'created'` 的行数 = 0
 *   · `public.ledger_entry` 中 `ref_type='listing_order'` 的行数 = 0
 *   · `public.listing.ledger_event_keys` 非空的行数 = 0
 * 全 0 ⇒ 删 `schema_migration` 的 `0015` 行、以修正后的同一版本号重新应用（DL49：无 down 迁移，
 * 同版本重放是「修正后重放」的唯一合法路径；**不新建版本号、不改 `0001`–`0014` 字节、不前滚**）。
 *
 * 用法：npx ts-node --transpile-only scripts/p3l-02-reapply-guard.ts <apply|check>
 *   apply = 过闸后执行 DELETE（重放）；check = 只读，不删。
 */
import { mkPool, raw, raw1, save, RUN, REPO, md5 } from './p3l-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const MODE = process.argv[2] === 'apply' ? 'apply' : 'check';
const FILE = path.join(REPO, 'migrations', '0015_listing.sql');

(async () => {
  const pool = mkPool(1);
  try {
    const probe = async () => ({
      listing_order_total: (await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order'))?.n,
      listing_order_non_created: (await raw1<{ n: string }>(pool,
        `SELECT count(*)::text AS n FROM public.listing_order WHERE status <> 'created'`))?.n,
      listing_order_paid_rows: await raw(pool,
        `SELECT order_id::text AS order_id, status, create_key FROM public.listing_order WHERE status <> 'created' ORDER BY order_id`),
      ledger_ref_listing_order: (await raw1<{ n: string }>(pool,
        `SELECT count(*)::text AS n FROM public.ledger_entry WHERE ref_type = 'listing_order'`))?.n,
      // ★ 真正的判别量：**只可能由本迁移的编排函数产出**的根键前缀
      ledger_my_namespace: (await raw1<{ n: string }>(pool,
        `SELECT count(*)::text AS n FROM public.ledger_entry
          WHERE event_root_key LIKE 'biz:listing:buy:%' OR event_root_key LIKE 'biz:listing:refund:%'
             OR event_root_key LIKE 'biz:listing:buy:%#%' OR event_root_key LIKE 'biz:listing:refund:%#%'`))?.n,
      ledger_foreign_namespace_ref_listing_order: (await raw1<{ n: string }>(pool,
        `SELECT count(*)::text AS n FROM public.ledger_entry
          WHERE ref_type = 'listing_order'
            AND NOT (event_root_key LIKE 'biz:listing:buy:%' OR event_root_key LIKE 'biz:listing:refund:%')`))?.n,
      ledger_foreign_namespace_roots: await raw(pool,
        `SELECT event_root_key, count(*)::text AS n FROM public.ledger_entry
          WHERE ref_type = 'listing_order'
            AND NOT (event_root_key LIKE 'biz:listing:buy:%' OR event_root_key LIKE 'biz:listing:refund:%')
          GROUP BY event_root_key ORDER BY event_root_key`),
      ledger_entries_ref_listing_order: await raw(pool,
        `SELECT txid::text AS txid, uid::text AS uid, kind, event_root_key FROM public.ledger_entry
          WHERE ref_type = 'listing_order' ORDER BY txid`),
      listing_with_keys: (await raw1<{ n: string }>(pool,
        `SELECT count(*)::text AS n FROM public.listing WHERE array_length(ledger_event_keys, 1) IS NOT NULL`))?.n,
      migration_rows: await raw(pool,
        `SELECT version, name, checksum, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version`),
      listing_post_event_prosrc_md5: (await raw1<{ m: string; bytes: string }>(pool,
        `SELECT md5(p.prosrc) AS m, octet_length(p.prosrc)::text AS bytes
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.oid = 'public.listing_post_event(jsonb)'::regprocedure`)),
    });

    const before = await probe();
    const pristine = fs.readFileSync(FILE);
    const fileSha = crypto.createHash('sha256').update(pristine).digest('hex');
    const appliedRow = before.migration_rows.find((r) => r.version === '0015') ?? null;
    const safe =
      before.listing_order_non_created === '0'
      && before.ledger_ref_listing_order === '0'
      && before.listing_with_keys === '0';

    let deleted: unknown = null;
    if (MODE === 'apply') {
      if (!safe) {
        deleted = { refused: true, reason: 'NOT_SAFE: 首版留下了已提交残迹 ⇒ 只准前滚，禁止同版本重放（立停上报）' };
      } else {
        const r = await raw1(pool, 'DELETE FROM public.schema_migration WHERE version = $1 RETURNING version', ['0015']);
        deleted = { refused: false, deleted_row: r };
      }
    }
    const after = await probe();
    const file = save('reapply-guard', {
      mode: MODE, repo: REPO,
      corrected_file: { path: path.relative(REPO, FILE), sha256: fileSha, md5: md5(pristine), bytes: pristine.length },
      applied_row_before: appliedRow,
      safe_to_replay: safe,
      gate: {
        listing_order_non_created_must_be_0: before.listing_order_non_created,
        ledger_entry_ref_listing_order_must_be_0: before.ledger_ref_listing_order,
        listing_with_keys_must_be_0: before.listing_with_keys,
      },
      deleted, before, after,
    });
    console.log(JSON.stringify({ ok: safe, file, safe_to_replay: safe, deleted,
      applied_checksum_before: appliedRow?.checksum ?? null, corrected_file_sha256: fileSha,
      corrected_file_md5: md5(pristine) }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
