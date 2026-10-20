/** 临时只读探针（不提交）：多件购买现状读数 —— 列数 / 迁移头 / 四读口键数 */
import { mkPool, raw1, raw1Retry, raw } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';

(async () => {
  const pool = mkPool(1);
  const cols = await raw1Retry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing'");
  const am = await raw1Retry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='allow_multi_buy'");
  const head = await raw1Retry<{ version: string }>(pool, 'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1');
  const proj = await raw1Retry<{ project_id: string }>(pool, "SELECT current_setting('neon.project_id', true) AS project_id");
  const some = await raw<{ listing_id: string; seller_uid: string }>(pool,
    'SELECT listing_id::text, seller_uid::text FROM public.listing ORDER BY listing_id DESC LIMIT 3');
  const detail = some[0] ? await DatabaseService.getPrizeDetailRecordingView(Number(some[0].listing_id)) : null;
  const mine = some[0] ? await DatabaseService.listListingsBySeller(Number(some[0].seller_uid), 0, 5) : [];
  const edit = some[0] ? await DatabaseService.getListingEditRow(Number(some[0].listing_id)) : null;
  const feed = await DatabaseService.listBrands(0, 3);
  const authRow = some[0] ? await DatabaseService.getListingBuyAuthRow(Number(some[0].listing_id)) : null;
  console.log(JSON.stringify({
    project_id: proj?.project_id, migration_head: head?.version, listing_cols: cols?.n, has_allow_multi_buy: am?.n,
    sample_listing: some[0]?.listing_id ?? null,
    detail_keys: detail ? Object.keys(detail).length : -1,
    detail_has_allow: detail ? 'allow_multi_buy' in detail : false,
    mine_keys: mine[0] ? Object.keys(mine[0]).length : -1,
    edit_keys: edit ? Object.keys(edit.row).length : -1,
    feed_keys: feed[0] ? Object.keys(feed[0]).length : -1,
    buy_auth: authRow,
  }, null, 1));
  await pool.end();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
