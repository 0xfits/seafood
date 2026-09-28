/**
 * P3-L · 探针 08：`listing_order.pay_txid = NULL` 的原始错误形态（只读诊断 + 一条被拒的 UPDATE）
 * 目的：K4 的 `order_pay_txid_nullout` 被拒（ok=false）但 errInfo 读出 sqlstate=null ⇒ 需要知道原始错误对象。
 * 用法：P3L_RUN=<tag> npx ts-node --transpile-only scripts/p3l-08-probe-paytxid.ts
 */
import { mkPool, raw, raw1 } from './p3l-lib';

const shape = (e: unknown): Record<string, unknown> => {
  const a = e as Record<string, unknown>;
  return {
    typeof: typeof e, name: a?.name ?? null, code: a?.code ?? null, severity: a?.severity ?? null,
    message: String(a?.message ?? e).slice(0, 300), detail: String(a?.detail ?? '').slice(0, 300),
    hint: a?.hint ?? null, where: a?.where ?? null, routine: a?.routine ?? null,
    keys: e && typeof e === 'object' ? Object.keys(a) : null,
  };
};

(async () => {
  const pool = mkPool(1);
  try {
    const ord = await raw1<{ order_id: string; pay_txid: string; status: string }>(pool,
      `SELECT order_id::text AS order_id, pay_txid::text AS pay_txid, status
         FROM public.listing_order WHERE create_key LIKE 'cli:kong15-%' AND pay_txid IS NOT NULL
        ORDER BY order_id DESC LIMIT 1`);
    const out: Record<string, unknown> = { order: ord };
    try {
      await raw(pool, `UPDATE public.listing_order SET pay_txid=NULL WHERE order_id=$1::bigint`, [String(ord?.order_id)]);
      out.direct_nullout = { ok: true };
    } catch (e) { out.direct_nullout = { ok: false, shape: shape(e) }; }
    // 对照：单列改写（非 NULL）
    try {
      await raw(pool, `UPDATE public.listing_order SET pay_txid=pay_txid+1 WHERE order_id=$1::bigint`, [String(ord?.order_id)]);
      out.rewrite = { ok: true };
    } catch (e) { out.rewrite = { ok: false, shape: shape(e) }; }
    // 对照：其它两列同时改（core guard）
    try {
      await raw(pool, `UPDATE public.listing_order SET price=1 WHERE order_id=$1::bigint`, [String(ord?.order_id)]);
      out.price_rewrite = { ok: true };
    } catch (e) { out.price_rewrite = { ok: false, shape: shape(e) }; }
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
