/**
 * P3-L · 探针 07：`schema_migration` 指定版本行复位（**非破坏性再应用**的入口）
 *
 * 用途：把某版本的 registry 行删掉，使 `scripts/migrate.ts` 能对**同一版本号**再次应用
 * （0015 按 DL48 全幂等：CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION /
 *  DROP TRIGGER IF EXISTS + CREATE TRIGGER / CREATE INDEX IF NOT EXISTS ⇒ 可原地重放）。
 *
 * 与探针 04（破坏性重放）的区别：本探针**不 DROP 任何对象** ⇒ 不动 `listing*` 的业务行、
 * 不影响既有账本分录（DL79 禁 DELETE 业务行 ⇒ 夹具无法「清理」，只能原地复用）。
 * 同版本重放安全性核（沿用 Zang 口径，但把「无 DROP」作为等价条件记录）：
 *   · `listing_order.listing_id → listing.listing_id` 是本片唯一对外可见的外键（两新表之间）
 *   · 无 DROP ⇒ 不产生孤儿 ⇒ 破坏性重放的闸在本路径上不适用
 * 同时给出**本片独占命名空间**读数（用于「冲突行是否全属 cli:kong15-/9903xx」的自证）。
 *
 * 用法：P3L_RUN=<tag> P3L_TAG=<tag> npx ts-node --transpile-only scripts/p3l-07-reset-registry.ts <version>
 */
import { mkPool, raw, raw1, save, RUN, REPO } from './p3l-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const VER = process.argv[2] || '0015';
const TAG = process.env.P3L_TAG || String(Date.now());

(async () => {
  const pool = mkPool(1);
  try {
    const FILE = path.join(REPO, 'migrations', '0015_listing.sql');
    const sha = crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex');
    const registryBefore = await raw(pool, `SELECT version, checksum, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version`);
    const namespace = {
      ledger_biz_listing_ns: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:%'`))?.n,
      listing_rows: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.listing`))?.n,
      listing_order_rows: (await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.listing_order`))?.n,
      foreign_listing_rows: await raw(pool, `SELECT listing_id::text AS listing_id, create_key FROM public.listing WHERE create_key NOT LIKE 'cli:kong15-%'`),
      foreign_order_rows: await raw(pool, `SELECT order_id::text AS order_id, create_key FROM public.listing_order WHERE create_key NOT LIKE 'cli:kong15-%'`),
      uid_window_users: await raw(pool, `SELECT uid::text AS uid, left(evm, 10) AS evm_prefix FROM public.users WHERE uid BETWEEN 990300 AND 990399 ORDER BY uid`),
      users_outside_window_touched_by_this_unit: await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.users WHERE uid > 990299 AND uid NOT BETWEEN 990300 AND 990399`),
    };
    const del = await raw1(pool, `DELETE FROM public.schema_migration WHERE version=$1 RETURNING version`, [VER]);
    const rowsAfter = await raw1<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public.schema_migration`);
    const file = save(`reset-registry-${VER}-${TAG}`, {
      repo: REPO, requested_version: VER, file_sha256_of_0015_now: sha,
      registry_before: registryBefore, namespace, deleted: del, registry_rows_after: rowsAfter?.n,
    });
    console.log(JSON.stringify({ ok: true, file, requested_version: VER, file_sha256_of_0015_now: sha,
      deleted: del, registry_rows_after: rowsAfter?.n, namespace,
      foreign_rows_present: (namespace.foreign_listing_rows.length + namespace.foreign_order_rows.length) === 0 ? [] : 'NON_EMPTY' }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
