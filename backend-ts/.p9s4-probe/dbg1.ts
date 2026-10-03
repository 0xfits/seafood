import { withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
const SENT = 'DBG_ROLLBACK';
(async () => {
  try {
    await withTransaction(async (tx: TxClient) => {
      const raw = await tx.query(`SELECT to_regclass('public.currency') AS c`);
      console.log('TOCLASS', JSON.stringify(raw.rows));
      const r = await DatabaseService.ensureBttcCurrency(tx);
      console.log('ENSURE', JSON.stringify(r));
      const r2 = await tx.query(`SELECT count(*)::int AS n FROM public.currency WHERE symbol='BTTC'`);
      console.log('COUNT', JSON.stringify(r2.rows));
      const raw3 = await tx.query(`WITH ins AS (
        INSERT INTO public.currency (symbol,name,owner_uid,decimals,status,listed_at,deposit_amount,deposit_cid,supply_cap,is_platform_coin)
        SELECT 'ZZDBG'::text,'zz'::text,0::bigint,0::smallint,'listed',now(),0::bigint,1::bigint,NULL::bigint,true
        ON CONFLICT (symbol) DO NOTHING RETURNING cid)
        SELECT (SELECT count(*)::int FROM ins) AS inserted,
        (SELECT c.cid::text FROM public.currency c WHERE c.symbol='ZZDBG' LIMIT 1) AS cid`);
      console.log('RAW3', JSON.stringify(raw3.rows));
      throw new Error(SENT);
    }).catch((e) => { if (String((e as Error).message) !== SENT) throw e; });
  } catch (e) { console.log('FATAL', String((e as Error).stack || e).slice(0, 700)); }
  await closePools().catch(() => {});
})();
