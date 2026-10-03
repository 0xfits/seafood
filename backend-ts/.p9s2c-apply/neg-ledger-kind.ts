/**
 * N3 库面判负：`ledger_kind_ok` 回 20（**事务内 CREATE OR REPLACE + 末尾 ROLLBACK**）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2c-apply/neg-ledger-kind.ts
 * 主张：活体 `ledger_kind_ok` 的 21 值集是**承重**的 —— 去掉 `checkin_makeup_fee`（回到 20）后，
 *   ① 直接调 `ledger_kind_ok('checkin_makeup_fee', false)` ⇒ false（活体应为 true）；
 *   ② 真链路 `checkinMakeup` 的 `-1` credit 腿被 `ledger_post_event` 逐条目拒绝（`P0001`）。
 *   ROLLBACK 后活体复原 ⇒ 判负成立且零净写。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, closePools, txQuery, readQuery, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, `neg-ledger-kind-${RUN}.json`);
class Sentinel extends Error { constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); } }
const out: Record<string, unknown> = {};
const get1 = async <T = Record<string, unknown>>(tx: TxClient, sql: string, p?: unknown[]): Promise<T | null> =>
  (await txQuery<T>(tx, sql, p))[0] ?? null;

const liveKindsOk = async (): Promise<{ n: number; hasNew: boolean }> => {
  const rows = await readQuery<{ k: string; ok: boolean }>(`
    SELECT k, ledger_kind_ok(k, false) AS ok FROM unnest(ARRAY[
      'mint','burn','transfer','hold','hold_release','hold_forfeit','job_escrow','job_escrow_refund',
      'job_payout','job_fee','commission','purchase','sale','purchase_refund','trade','trade_fee',
      'listing_fee','listing_deposit','currency_create_fee','reversal','checkin_makeup_fee'
    ]) AS k`);
  return { n: rows.filter((r) => r.ok).length, hasNew: !!rows.find((r) => r.k === 'checkin_makeup_fee')?.ok };
};

(async () => {
  out.live_before = await liveKindsOk();   // 事务外只读快照（活体）

  try {
    await withTransaction(async (tx) => {
      const defRow = await get1<{ def: string }>(tx,
        `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
          WHERE p.proname='ledger_kind_ok' ORDER BY p.oid LIMIT 1`);
      const def = defRow?.def ?? '';
      out.fn_def_len = def.length;
      out.fn_occurrences_new_kind = (def.match(/'checkin_makeup_fee'/g) || []).length;
      const mutated = def.replace("'checkin_makeup_fee'", "'__n3_removed_kind__'");
      out.mutated_len = mutated.length;
      out.mutated_occurrences_new_kind = (mutated.match(/'checkin_makeup_fee'/g) || []).length;

      await txQuery(tx, mutated);   // CREATE OR REPLACE FUNCTION ledger_kind_ok ... （回 20）
      const r1 = await get1<{ b: boolean }>(tx, `SELECT ledger_kind_ok('checkin_makeup_fee', false) AS b`);
      out.after_mutation_fn_returns = r1?.b;

      // 真链路：补签（uid 12 · 昨日）⇒ 期望被 live 判据拒绝
      const UID = 12;
      const targetDay = (await get1<{ d: string }>(tx,
        `SELECT ((now() AT TIME ZONE 'UTC')::date - 1)::text AS d`))?.d as string;
      const key = `biz:checkin:makeup:${UID}:${targetDay}`;
      let chainErr: unknown = null;
      await txQuery(tx, 'SAVEPOINT n3chain');
      try {
        const r = await DatabaseService.checkinMakeup({ uid: UID, targetDay, idempotencyKey: key,
          requestFingerprint: `fp:${UID}:${targetDay}`, memo: 'p9s2c neg N3' }, tx);
        out.chain_result = r;
      } catch (e) {
        chainErr = e;
        out.chain_error = {
          code: (e as { code?: unknown }).code ?? null,
          pgCode: (e as { pgCode?: unknown }).pgCode ?? null,
          message: String((e as Error)?.message || e).slice(0, 160),
        };
        await txQuery(tx, 'ROLLBACK TO SAVEPOINT n3chain').catch(() => undefined);
      }
      if (!chainErr) await txQuery(tx, 'RELEASE SAVEPOINT n3chain').catch(() => undefined);
      throw new Sentinel('N3');
    });
  } catch (e) { if (!(e instanceof Sentinel)) throw e; }

  out.live_after = await liveKindsOk();    // ROLLBACK 后活体复原核对
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  console.log(`ARTIFACT ${OUT}`);
  await closePools();
  process.exit(0);
})().catch(async (e) => {
  console.error('N3_FATAL', String((e as Error)?.message || e).slice(0, 400));
  await closePools().catch(() => undefined); process.exit(2);
});
