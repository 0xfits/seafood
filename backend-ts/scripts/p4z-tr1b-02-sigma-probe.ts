/**
 * P6-TR-1b · Σtotal(cid=1) 与 Δledger_entry 的真实前后读数（补 E2E 里 NOT_MEASURED 的口径）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1b-02-sigma-probe.ts <job_id>
 * 语义：对既有 job 重新登记 6 条 pending（title/description × en,hk,vn）⇒ 跑一次**真实** stub 回填
 *   （写出译文行）⇒ 前后各读一次 `Σ(cid=1)` 与 `ledger_entry` ⇒ 断言 Δ=0。
 * 清理：本次写入的 content_translation / translation_cache 行**全部删除**（job 行本身不动）。
 * ============================================================================
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

process.env.TRANSLATE_ENGINE = 'stub';
delete process.env.DEEPSEEK_API_KEY;

import { createDbStore, backfillPending, sha256Hex, getTranslateConfig } from '../src/translate-service';

const JOB = process.argv[2] || '24';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '', max: 3 });
const q = async <R = Record<string, unknown>>(s: string, p: unknown[] = []): Promise<R[]> =>
  (await pool.query(s, p as never[])).rows as R[];

const main = async () => {
  const cols = await q<{ column_name: string }>(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='account' order by ordinal_position`);
  console.log('account_columns=', cols.map((c) => c.column_name).join(','));
  const sumCol = ['total', 'balance', 'amount', 'points', 'value']
    .find((c) => cols.some((x) => x.column_name === c));
  if (!sumCol) throw new Error('account 表无可用求和列 ⇒ 无法测 Σ');
  const sigma = async (): Promise<string> =>
    String((await q(`select coalesce(sum(${sumCol}),0)::text as s from public.account where cid = 1`))[0].s);
  const ledgerEntry = async (): Promise<string> =>
    String((await q('select count(*)::text as n from public.ledger_entry'))[0].n);

  const text = `P6TR1B sigma probe ${new Date().toISOString()}`;
  const store = createDbStore();
  const before = { sigma_cid1: await sigma(), ledger_entry: await ledgerEntry(), sum_col: sumCol };
  console.log('BEFORE', JSON.stringify(before));

  for (const field of ['title', 'description']) {
    for (const lang of ['en', 'hk', 'vn']) {
      await store.upsertTranslation({
        entity_type: 'job', entity_id: JOB, field, lang,
        text: null, status: 'pending', attempts: 0, last_error: null,
      });
    }
  }
  const report = await backfillPending(20);
  console.log('BACKFILL', JSON.stringify({ ...report, engine_cfg: getTranslateConfig().engine }));

  const after = { sigma_cid1: await sigma(), ledger_entry: await ledgerEntry() };
  console.log('AFTER ', JSON.stringify(after));
  const ready = String((await q(
    `select count(*)::text as n from public.content_translation where entity_id=$1 and status='ready'`, [JOB]))[0].n);
  console.log('READY_ROWS_FOR_JOB', ready);

  const delCt = await q<{ n: string }>(
    `with d as (delete from public.content_translation where entity_id=$1 returning 1) select count(*)::text as n from d`, [JOB]);
  const hashes = [text].map(sha256Hex);
  const delCache = await q<{ n: string }>(
    `with d as (delete from public.translation_cache where src_hash = any($1::text[]) returning 1) select count(*)::text as n from d`, [hashes]);
  console.log('CLEANUP', JSON.stringify({ ct_deleted: delCt[0].n, cache_deleted: delCache[0].n }));
  console.log('RESULT', JSON.stringify({
    sigma_delta_zero: before.sigma_cid1 === after.sigma_cid1,
    ledger_entry_delta_zero: before.ledger_entry === after.ledger_entry,
    sigma_before: before.sigma_cid1, sigma_after: after.sigma_cid1, sum_col: sumCol,
    ledger_entry_before: before.ledger_entry, ledger_entry_after: after.ledger_entry,
    ready_rows_written: ready,
  }));
  if (before.sigma_cid1 !== after.sigma_cid1 || before.ledger_entry !== after.ledger_entry) process.exitCode = 1;
};

main()
  .catch((e) => { console.error('PROBE_FATAL:', (e as Error)?.message ?? e); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => undefined); });
