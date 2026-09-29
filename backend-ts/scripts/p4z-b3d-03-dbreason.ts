/**
 * p4z-b3d-03-dbreason.ts — P4-B3d：**DB 层** `details.reason` 取证（HTTP 驱动不搬运 DETAIL 的补测）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3d-03-dbreason.ts <runDirAbs>
 * 口径：全部为**负例**（不产生任何写入）；只读 + 无副作用；产物 run-tagged + 绝对路径。
 */
import fs from 'fs';
import path from 'path';
import { mkPool, raw, raw1, errInfo } from './p3j-lib';

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });
const RUN = path.basename(outDir);

async function main() {
  const pool = mkPool(2);
  const tag = `b3d:${RUN}:listing:`;
  const L = await raw<{ listing_id: string; tag: string; price: string; stock: string; seller_uid: string }>(pool,
    `SELECT listing_id::text AS listing_id, split_part(create_key, ':', 5) AS tag, price::text AS price,
            stock::text AS stock, seller_uid::text AS seller_uid
       FROM public.listing WHERE create_key LIKE $1::text ORDER BY listing_id`, [`cli:${tag}%`]);
  const byTag: Record<string, string> = {};
  for (const r of L) byTag[String(r.tag)] = String(r.listing_id);
  const sellerUid = L.length ? String(L[0].seller_uid) : '';
  const created = await raw1<{ order_id: string; buyer_uid: string }>(pool,
    `SELECT order_id::text AS order_id, buyer_uid::text AS buyer_uid FROM public.listing_order
      WHERE create_key = $1::text LIMIT 1`, [`cli:b3d:${RUN}:order-created`]);
  const happyOrder = await raw1<{ order_id: string; buyer_uid: string }>(pool,
    `SELECT o.order_id::text AS order_id, o.buyer_uid::text AS buyer_uid FROM public.listing_order o
      JOIN public.listing l ON l.listing_id = o.listing_id
      WHERE l.create_key LIKE $1::text ORDER BY o.order_id LIMIT 1`, [`cli:${tag}%`]);
  const buyerUid = created ? String(created.buyer_uid) : (happyOrder ? String(happyOrder.buyer_uid) : '');

  const probe = async (id: string, payload: Record<string, unknown>) => {
    try {
      const r = await raw1<{ r: unknown }>(pool, `SELECT public.listing_post_event($1::jsonb) AS r`, [payload]);
      return { id, ok: true, sqlstate: null, message: null, detail: null, returned: r?.r ?? null };
    } catch (e) {
      const i = errInfo(e);
      return { id, ok: false, sqlstate: i.sqlstate, message: i.message, reason: i.reason, detail: i.detail, detail_parsed: i.detail_parsed };
    }
  };

  const out = {
    run: RUN, at: new Date().toISOString(), probe: 'p4z-b3d-03-dbreason',
    fixtures: { listings_by_tag: byTag, seller_uid: sellerUid, buyer_uid: buyerUid, created_order: created?.order_id ?? null },
    cases: [
      await probe('buy_stock_insufficient', { op: 'buy', create_key: `cli:b3d:${RUN}:db-ne-stock`, listing_id: byTag.empty, buyer_uid: buyerUid, quantity: '1', request_fingerprint: 'probe' }),
      await probe('buy_self_purchase', { op: 'buy', create_key: `cli:b3d:${RUN}:db-ne-self`, listing_id: byTag.happy, buyer_uid: sellerUid, quantity: '1', request_fingerprint: 'probe' }),
      await probe('buy_unknown_listing', { op: 'buy', create_key: `cli:b3d:${RUN}:db-ne-miss`, listing_id: '999999999', buyer_uid: buyerUid, quantity: '1', request_fingerprint: 'probe' }),
      await probe('refund_order_not_refundable', { op: 'refund', order_id: created?.order_id ?? '0', request_fingerprint: 'probe' }),
      await probe('refund_unknown_order', { op: 'refund', order_id: '999999999', request_fingerprint: 'probe' }),
      await probe('buy_same_key_diff_content', { op: 'buy', create_key: `cli:b3d:${RUN}:buy1`, listing_id: byTag.happy, buyer_uid: buyerUid, quantity: '1', request_fingerprint: 'probe' }),
      await probe('buy_insufficient_balance', { op: 'buy', create_key: `cli:b3d:${RUN}:db-ne-bal`, listing_id: byTag.pricey, buyer_uid: buyerUid, quantity: '1', request_fingerprint: 'probe' }),
      await probe('buy_no_create_key', { op: 'buy', listing_id: byTag.happy, buyer_uid: buyerUid, quantity: '1', request_fingerprint: 'probe' }),
      await probe('buy_bad_prefix', { op: 'buy', create_key: 'zzz:1', listing_id: byTag.happy, buyer_uid: buyerUid, quantity: '1', request_fingerprint: 'probe' }),
    ],
  };
  const file = path.join(outDir, 'post', 'db-reason.json');
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('WROTE ' + file);
  for (const c of out.cases) console.log(c.id + ' | sqlstate=' + c.sqlstate + ' | msg=' + c.message + ' | detail=' + c.detail);
  await pool.end().catch(() => undefined);
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e && (e as Error).stack || e)); process.exit(1); });
