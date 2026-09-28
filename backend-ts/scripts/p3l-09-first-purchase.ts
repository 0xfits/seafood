/**
 * P3-L · 探针 09：**最小「首次购买」尺子**（判负自证用）
 *
 * 只做一件事：给一个**无冻结额**的买家买一件商品，断言
 *   success 且 买家 `balance −n`、卖家 `balance +n`、买家 `frozen` 不变、恰 2 条 `frozen_delta=0` 的分录。
 * 任何一条不成立 ⇒ 打印 verdict=RED 并以 exit 1 收尾（供「改坏 ⇒ 必红」的判负自证使用）。
 * 用法：P3L_RUN=<tag> P3L_TAG=<tag> npx ts-node --transpile-only scripts/p3l-09-first-purchase.ts
 */
import {
  mkPool, raw, raw1, errInfo, sha256, acct, entriesOfKey, listingPostEvent, fundFromResidual,
} from './p3l-lib';

const TAG = process.env.P3L_TAG || String(Date.now());
const SELLER = '990301';
const BUYER = '990302';

const ensureUserAt = async (p: ReturnType<typeof mkPool>, uid: string, seed: string): Promise<string> => {
  const evm = `0x${sha256(seed).slice(0, 40)}`;
  const cols = await raw<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }>(
    p, `SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
  const extra = cols.filter((c) => c.is_nullable === 'NO' && c.column_default === null
    && c.column_name !== 'uid' && c.column_name !== 'evm');
  const names = ['uid', 'evm', ...extra.map((c) => c.column_name)];
  const vals = [`${BigInt(uid)}`, `'${evm}'`, ...extra.map((c) => (/timestamp|date/.test(c.data_type) ? 'now()' : "''"))];
  try { await raw(p, `INSERT INTO public.users (${names.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT DO NOTHING`); }
  catch (e) { if (errInfo(e).sqlstate !== '23505') throw e; }
  const got = await raw1<{ uid: string }>(p, 'SELECT uid::text AS uid FROM public.users WHERE uid = $1::bigint LIMIT 1', [uid]);
  if (!got) throw new Error(`ensureUserAt(${uid}) failed`);
  return got.uid;
};

(async () => {
  const pool = mkPool(1);
  let verdict = 'RED';
  const readout: Record<string, unknown> = { tag: TAG };
  try {
    const seller = await ensureUserAt(pool, SELLER, `kong15-seller-neg`);
    const buyer = await ensureUserAt(pool, BUYER, `kong15-buyer-neg`);
    const b0 = await acct(pool, buyer);
    if (BigInt(String(b0?.balance ?? '0')) < 1000n) await fundFromResidual(pool, buyer, 2000n);
    const key = `cli:kong15-neg-${TAG}-listing`;
    const ins = await raw1<{ listing_id: string }>(pool,
      `INSERT INTO public.listing (seller_uid, cid, price, stock, title, status, create_key)
       VALUES ($1::bigint, 1, 100, 5, '', 'listed', $2) RETURNING listing_id::text AS listing_id`, [seller, key]);
    const listingId = ins!.listing_id;
    const bBefore = await acct(pool, buyer);
    const sBefore = await acct(pool, seller);
    let res: Record<string, unknown> | null = null;
    let err: Record<string, unknown> | null = null;
    try {
      res = await listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-neg-${TAG}-buy`, listing_id: listingId, buyer_uid: buyer, quantity: '1' });
    } catch (e) { err = errInfo(e) as unknown as Record<string, unknown>; }
    const bAfter = await acct(pool, buyer);
    const sAfter = await acct(pool, seller);
    const entries = res ? await entriesOfKey(pool, `biz:listing:buy:${res.order_id}`) : [];
    const bb = BigInt(String(bBefore?.balance ?? '0')); const ba = BigInt(String(bAfter?.balance ?? '0'));
    const sb = BigInt(String(sBefore?.balance ?? '0')); const sa = BigInt(String(sAfter?.balance ?? '0'));
    const pass = !!res && err === null
      && ba === bb - 100n && sa === sb + 100n
      && String(bAfter?.frozen) === String(bBefore?.frozen)
      && entries.length === 2 && entries.every((e) => String(e.frozen_delta) === '0');
    verdict = pass ? 'GREEN' : 'RED';
    Object.assign(readout, { listing_id: listingId, order_id: res?.order_id ?? null,
      error: err ? { sqlstate: err.sqlstate, reason: err.reason, message: err.message } : null,
      buyer_before: bBefore, buyer_after: bAfter, seller_before: sBefore, seller_after: sAfter,
      entries_len: entries.length, entries_frozen: entries.map((e) => e.frozen_delta), entries });
  } catch (e) {
    verdict = 'RED';
    readout.fatal = errInfo(e);
  } finally {
    await pool.end().catch(() => undefined);
  }
  console.log(JSON.stringify({ verdict, ...readout }, null, 2));
  process.exit(verdict === 'GREEN' ? 0 : 1);
})();
