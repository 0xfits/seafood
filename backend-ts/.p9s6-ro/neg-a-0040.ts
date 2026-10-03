/**
 * Neng 独立质检 · 判负 (a)：0040 幂等闸删除 ⇒ 重复发放应被门/断言撞红（库面）。
 * 仓外副本 = /Users/kevin/bistro/_neng_p9s6_neg/（只从主仓读 env，不复制）。
 * 库面写一律事务内 + 末尾 ROLLBACK（throw SENT）。
 */
import * as fs from 'fs';
import { withTransaction, closePools, TxClient } from '../src/db';

const NEG = '/Users/kevin/bistro/_neng_p9s6_neg';
const ORIG = '/Users/kevin/bistro/seafood/backend-ts/migrations/0040_backfill_signup_batt.sql';
const SENT = 'NENG_A_ROLLBACK';
type Row = Record<string, unknown>;

const attempt = async (label: string, sql: string) => {
  const out: Record<string, unknown> = { label, sql_bytes: Buffer.byteLength(sql, 'utf8') };
  let threw: string | null = null;
  let readErr: string | null = null;
  try {
    await withTransaction(async (tx: TxClient) => {
      try { await tx.query(sql); }
      catch (e) { const er = e as { code?: string; message?: string }; threw = `${er.code ?? ''}:${String(er.message ?? e).slice(0, 200)}`; }
      try {
        const q = async (s: string) => (await tx.query<{ n: number }>(s)).rows[0]?.n;
        out.acct_n = Number(await q(`SELECT count(*)::int AS n FROM public.batt_account`));
        out.entry_n = Number(await q(`SELECT count(*)::int AS n FROM public.batt_entry`));
        out.dup_batt60 = Number(await q(`SELECT count(*)::int AS n FROM public.batt_account WHERE batt = 60`));
        out.dup_invite_signup_uids = Number(await q(`SELECT count(*)::int AS n FROM (SELECT uid FROM public.batt_entry WHERE reason='invite_signup' GROUP BY uid HAVING count(*)>1) x`));
        out.batt_hist = (await tx.query<Row>(`SELECT batt, count(*)::int AS n FROM public.batt_account GROUP BY batt ORDER BY batt`)).rows;
      } catch (e2) { readErr = `${(e2 as { code?: string }).code ?? ''}:${String((e2 as Error)?.message).slice(0, 120)}`; }
      throw new Error(SENT);
    });
  } catch (e) { if (String((e as Error)?.message) !== SENT) out.tx_err = String((e as Error)?.message).slice(0, 200); }
  out.threw = threw;
  out.read_err = readErr;
  return out;
};

(async () => {
  const orig = fs.readFileSync(ORIG, 'utf8');
  const a1 = fs.readFileSync(`${NEG}/mutant_a1_gate_removed.sql`, 'utf8');
  const a2 = fs.readFileSync(`${NEG}/mutant_a2_dup.sql`, 'utf8');
  const a3 = fs.readFileSync(`${NEG}/mutant_a3_gate_removed_selfcheck_kept.sql`, 'utf8');
  const results: unknown[] = [];
  results.push(await attempt('control: 原 0040 重跑（幂等）', orig));
  results.push(await attempt('mutant_a1: 删 §B 幂等闸（self-check 保留）', a1));
  results.push(await attempt('mutant_a3: 删幂等闸 + DO UPDATE（self-check 保留）', a3));
  results.push(await attempt('mutant_a2: 删幂等闸 + DO UPDATE + self-check 关闭', a2));
  console.log(JSON.stringify({ unit: 'NEG-A-0040-GATE-DELETE', generated_at: new Date().toISOString(), results }, null, 1));
  await closePools().catch(() => undefined);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
