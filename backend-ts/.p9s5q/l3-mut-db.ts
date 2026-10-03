/**
 * P9⑤ L4-M6 库面变异判负（Neng · 真连库 · 事务内 DDL 变异 + 末尾 ROLLBACK）。
 * 目的：证「去 0038 白名单」⇒ 白名单内 −1 debit（invite_first_task_reward）**必红**。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s5q/l3-mut-db.ts
 */
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const OUT: Record<string, unknown> = {};
const SENT = 'M6_ROLLBACK';
type Runner = { query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> };
const callDirect = async (runner: Runner, savepoint: string | null, uid: number, kind: string, dir: string) => {
  try {
    if (savepoint) await runner.query(`SAVEPOINT ${savepoint}`);
    await runner.query(`SELECT ledger_assert_platform_mutation($1::bigint,$2::text,$3::text)`, [uid, kind, dir]);
    if (savepoint) await runner.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { allowed: true };
  } catch (e) {
    if (savepoint) await runner.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(() => undefined);
    const err = e as { code?: string; message?: string; detail?: string; details?: { reason?: string } };
    let reason = err.details?.reason ?? null;
    if (reason === null && err.detail) { try { reason = (JSON.parse(String(err.detail)) as { reason?: string }).reason ?? null; } catch { /* noop */ } }
    return { allowed: false, sqlstate: String(err.code ?? ''), code: String(err.message ?? ''), reason };
  }
};
const callOut = (uid: number, kind: string, dir: string) =>
  callDirect({ query: (s, p) => readQuery(s, p).then((r) => ({ rows: r as Array<Record<string, unknown>> })) }, null, uid, kind, dir);

(async () => {
  OUT.baseline_allow = await callOut(-1, 'invite_first_task_reward', 'debit');   // 期望 allowed:true

  await withTransaction(async (tx: TxClient) => {
    await tx.query(`
      CREATE OR REPLACE FUNCTION public.ledger_assert_platform_mutation(
        p_uid bigint, p_kind text, p_dir text
      ) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
      DECLARE v_ok boolean;
      BEGIN
        v_ok := CASE p_uid::text
          WHEN '0'  THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('mint','transfer','reversal')
                                          ELSE p_kind IN ('transfer','burn','reversal') END
          WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee','listing_fee','currency_create_fee','job_fee','listing_deposit','checkin_makeup_fee','bttc_mint_fee','bttc_burn_fee')
                                          ELSE false END
          WHEN '-2' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('job_fee')
                                          ELSE p_kind IN ('commission') END
          WHEN '-3' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('hold_forfeit')
                                          ELSE p_kind IN ('hold_forfeit','transfer') END
          ELSE NULL END;
        IF v_ok IS NULL OR v_ok THEN RETURN; END IF;
        PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
          'uid', p_uid::text, 'kind', p_kind,
          'reason', CASE p_dir WHEN 'debit' THEN 'PLATFORM_DEBIT_FORBIDDEN' ELSE 'PLATFORM_CREDIT_KIND_FORBIDDEN' END));
      END $$;`);
    OUT.mutated_debit = await callDirect(tx, 'sp_m6a', -1, 'invite_first_task_reward', 'debit'); // 期望红
    OUT.mutated_credit_still_ok = await callDirect(tx, 'sp_m6b', -1, 'job_fee', 'credit');      // −1 credit 未动 ⇒ 仍放行
    throw new Error(SENT);
  }).catch((e) => { if (String((e as Error)?.message) !== SENT) throw e; });

  OUT.restored_allow = await callOut(-1, 'invite_first_task_reward', 'debit');     // 复原回绿 ⇒ allowed:true

  const md = OUT.mutated_debit as { allowed?: boolean; sqlstate?: string; code?: string; reason?: string };
  const pass = (OUT.baseline_allow as { allowed?: boolean }).allowed === true
    && md.allowed === false && md.sqlstate === 'LD021' && md.code === 'LEDGER_RESERVED_UID' && md.reason === 'PLATFORM_DEBIT_FORBIDDEN'
    && (OUT.mutated_credit_still_ok as { allowed?: boolean }).allowed === true
    && (OUT.restored_allow as { allowed?: boolean }).allowed === true;
  OUT.verdict = pass ? 'RED_OK' : 'RED_MISS';
  console.log(JSON.stringify(OUT, null, 1));
  await closePools();
  process.exit(pass ? 0 : 1);
})().catch(async (e) => { console.error('M6_FATAL', String((e as Error)?.stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
