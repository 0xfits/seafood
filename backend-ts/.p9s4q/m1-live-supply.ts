/**
 * P9④ 质检收尾 · M1 活体佐证：去 `total_supply` 双写 ⇒ 供应量配对断言必红
 * 手法：事务内 CREATE OR REPLACE 活体函数（去掉 burn 双写，`- v_amount` → 无操作）⇒
 *       控制链（双写在）⇄ 变异链（双写去）对拍 ⇒ 末尾 ROLLBACK（DDL 事务内可回滚）。
 * 角色 Neng · 自写探针 · 库面写一律事务内 + 末尾 ROLLBACK。
 */
import { readQuery, getTransactionPool, closePools } from '../src/db';
import { DatabaseService } from '../src/database';
import * as fs from 'fs';
import * as path from 'path';

const MUT = 'total_supply = total_supply - v_amount';
const OUT_DIR = path.join(__dirname, 'out');

async function main(): Promise<void> {
  const OUT: Record<string, unknown> = {};
  const pool = getTransactionPool();
  const client = await pool.connect();
  const UID = 4;
  const uuid = (): string => require('crypto').randomUUID();
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL lock_timeout=3000');
    await client.query('SET LOCAL statement_timeout=20000');
    const q = (t: string, p?: unknown[]) => client.query(t, p);

    const def = String((await q(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='ledger_post_event' AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`
    )).rows[0].def);
    OUT.control_def_doublewrite_occurrences = def.split(MUT).length - 1;
    const mutated = def.split(MUT).join('total_supply = total_supply');
    OUT.mutated_def_doublewrite_occurrences = mutated.split(MUT).length - 1;

    const chain = async (tag: string): Promise<Record<string, unknown>> => {
      const cur = await DatabaseService.ensureBttcCurrency(client);
      const cid = Number(cur!.cid);
      await q(`INSERT INTO public.batt_account (uid,batt) VALUES ($1,100) ON CONFLICT (uid) DO UPDATE SET batt=100`, [UID]);
      await q(`INSERT INTO public.account (uid,cid,balance,frozen) VALUES ($1,$2,0,0) ON CONFLICT (uid,cid) DO NOTHING`, [UID, cid]);
      const mint = await DatabaseService.bttcMint({ uid: UID, idempotencyKey: `cli:${uuid()}`, requestFingerprint: `M1Q:${tag}`, memo: '' }, client);
      const afterMint = String((await q(`SELECT total_supply::text AS s FROM public.currency WHERE cid=$1`, [cid])).rows[0].s);
      await q(`UPDATE public.batt_account SET batt=50 WHERE uid=$1`, [UID]);
      const burn = await DatabaseService.bttcBurn({ uid: UID, idempotencyKey: `cli:${uuid()}`, requestFingerprint: `M1Q:${tag}`, memo: '' }, client);
      const supply = String((await q(`SELECT total_supply::text AS s FROM public.currency WHERE cid=$1`, [cid])).rows[0].s);
      const sumMint = String((await q(`SELECT COALESCE(sum(delta),0)::text AS s FROM public.ledger_entry WHERE cid=$1 AND kind='mint'`, [cid])).rows[0].s);
      const sumBurn = String((await q(`SELECT COALESCE(sum(delta),0)::text AS s FROM public.ledger_entry WHERE cid=$1 AND kind='burn'`, [cid])).rows[0].s);
      return {
        cid, mint_outcome: mint?.outcome, burn_outcome: burn?.outcome,
        burn_supplyBefore: burn?.supplyBefore, burn_supplyAfter: burn?.supplyAfter,
        supply_after_burn: supply, sumMint, sumBurn,
        eq_plus: BigInt(supply) === BigInt(sumMint) + BigInt(sumBurn),
      };
    };

    OUT.control_chain = await chain('ctl');            // 双写在（活体原函数）
    await q(mutated);                                   // 事务内替换：去掉 burn 双写
    OUT.fn_swapped_in_tx = true;
    OUT.mutated_chain = await chain('mut');             // 双写去

    const c = OUT.control_chain as Record<string, unknown>;
    const m = OUT.mutated_chain as Record<string, unknown>;
    OUT.verdict = {
      control_invariant_holds: c.eq_plus === true,
      mutated_invariant_broken: m.eq_plus === false,
      claim_去双写_供应量断言必红: c.eq_plus === true && m.eq_plus === false,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'm1-live-supply.json'), JSON.stringify(OUT, null, 2));
    console.log(JSON.stringify(OUT, null, 2));
    const resid = await q(`SELECT count(*)::int AS n FROM public.currency WHERE symbol='BTTC'`);
    console.log('btc_rows_in_tx(expect 1)', JSON.stringify(resid.rows[0]));
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  const after = await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.currency WHERE symbol='BTTC'`);
  console.log('btc_rows_after_rollback(expect 0) =', after[0]?.n);
  await closePools();
}
main().catch((e) => { console.error('ERR', (e as Error).message, (e as { code?: string }).code); process.exit(1); });
